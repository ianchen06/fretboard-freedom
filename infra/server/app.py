"""Fretboard Freedom AI server.

Serves the Fretboard Freedom web app's server mode (the in-browser AI has the
same features, but the phone's browser can't hold the 1 GB models):

  GET  /health        -> service + dependency status
  POST /api/lyrics    -> lyric-line candidates from Ollama (qwen2.5:0.5b)
  POST /api/musicgen  -> backing-track WAV from MusicGen-small

MusicGen backends (env MUSICGEN_BACKEND, default "onnx"):
  - onnx: ONNX Runtime over the staged Xenova/musicgen-small weights
    (MODEL_DIR, default /opt/fretboard-ai/models/musicgen-small). First
    version — needs the live smoke test in infra/README.md.
  - transformers: facebook/musicgen-small via transformers + torch. Slower
    (tens of seconds per 10 s clip on CPU) but the code path is the canonical
    one. Needs a working torch install (the PyTorch Ampere image ships one).

Run by systemd (infra/systemd/fretboard-ai.service) as user ubuntu,
listening on 127.0.0.1:8000. Exposed to the internet only via a Cloudflare
Tunnel (see infra/README.md). Everything is localhost-only by design.
"""

import io
import json
import logging
import os
import random
import traceback
import wave
from pathlib import Path

import httpx
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field

log = logging.getLogger("fretboard-ai")

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "qwen2.5:0.5b")
MODEL_DIR = Path(os.environ.get(
    "MODEL_DIR", "/opt/fretboard-ai/models/musicgen-small"))
MUSICGEN_BACKEND = os.environ.get("MUSICGEN_BACKEND", "onnx").lower()
ALLOWED_ORIGINS = [
    o.strip() for o in
    os.environ.get("ALLOWED_ORIGINS", "https://ianchen06.github.io").split(",")
    if o.strip()
]

app = FastAPI(title="fretboard-ai", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

_http = httpx.Client(timeout=180.0)


# ---------------------------------------------------------------- lyrics

class LyricsRequest(BaseModel):
    prompt: str = Field(..., description="Full prompt for the lyric line")
    count: int = Field(3, ge=1, le=5, description="How many candidates")
    temperature: float = Field(0.9, ge=0.0, le=1.5)


class LyricsResponse(BaseModel):
    candidates: list[str]


@app.post("/api/lyrics", response_model=LyricsResponse)
def lyrics(req: LyricsRequest):
    """One lyric line per candidate, from Ollama. The web app ranks them
    (tone fit / rhyme group / syllable count) exactly as it does in-browser."""
    candidates: list[str] = []
    for _ in range(req.count):
        try:
            r = _http.post(f"{OLLAMA_URL}/api/generate", json={
                "model": OLLAMA_MODEL,
                "prompt": req.prompt,
                "stream": False,
                "seed": random.randint(0, 2**31 - 1),
                "stop": ["\n"],
                "options": {
                    "temperature": req.temperature,
                    "num_predict": 80,
                },
            })
            r.raise_for_status()
        except httpx.HTTPError as e:
            raise HTTPException(502, f"Ollama request failed: {e}") from e
        text = (r.json().get("response") or "").strip()
        if text:
            candidates.append(text)
    if not candidates:
        raise HTTPException(502, "Ollama returned no lyric candidates")
    return LyricsResponse(candidates=candidates)


# ---------------------------------------------------------------- MusicGen

class MusicGenRequest(BaseModel):
    prompt: str = Field(..., description="Style prompt, e.g. 'gentle acoustic guitar, 90 bpm'")
    duration: int = Field(10, ge=5, le=30, description="Seconds of audio (5-30)")


def _wav_bytes(samples: np.ndarray, sample_rate: int) -> bytes:
    """Mono float32 in [-1, 1] -> 16-bit PCM WAV bytes."""
    pcm = np.clip(samples, -1.0, 1.0)
    pcm = (pcm * 32767).astype(np.int16)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sample_rate)
        w.writeframes(pcm.tobytes())
    return buf.getvalue()


def _find_onnx(model_dir: Path, *needles: str) -> Path:
    """Pick an ONNX file under model_dir/onnx, preferring quantized builds."""
    onnx_dir = model_dir / "onnx"
    if not onnx_dir.is_dir():
        raise FileNotFoundError(f"No onnx/ directory under {model_dir}")
    files = sorted(onnx_dir.glob("*.onnx"))
    for needle in needles:
        for f in files:
            if needle in f.name and "quantized" in f.name:
                return f
    for needle in needles:
        for f in files:
            if needle in f.name:
                return f
    raise FileNotFoundError(
        f"No ONNX file matching {needles} under {onnx_dir} "
        f"(found: {[f.name for f in files]})")


class MusicGenONNX:
    """MusicGen-small via ONNX Runtime, following the MusicGen delay pattern.

    Pipeline: T5 text encoder -> autoregressive decoder (4 codebooks, each
    delayed by its index) -> EnCodec decoder -> waveform. Generation runs in
    the delayed space with a KV cache, then the delay pattern is removed.
    """

    FRAME_RATE = 50  # audio frames per second
    NUM_CODEBOOKS = 4

    def __init__(self, model_dir: Path):
        import onnxruntime as ort
        from tokenizers import Tokenizer

        self.model_dir = model_dir
        config = json.loads((model_dir / "config.json").read_text())
        self.sample_rate = int(
            config.get("audio_encoder", {}).get("sampling_rate", 24000))
        self.start_token = int(config.get("decoder_start_token_id", 0))
        self.num_codebooks = int(config.get("num_codebooks", self.NUM_CODEBOOKS))
        # KV-cache geometry for the decoder's past_key_values inputs:
        # [batch, num_heads, seq_len, head_dim]. Needed for the first
        # generation step, which has no cache yet (empty seq_len).
        dec_cfg = config.get("decoder", {})
        self.num_heads = int(dec_cfg.get("num_attention_heads", 16))
        hidden_size = int(dec_cfg.get("hidden_size", 1024))
        self.head_dim = max(1, hidden_size // self.num_heads)

        tok_path = model_dir / "tokenizer.json"
        if not tok_path.exists():
            raise FileNotFoundError(f"tokenizer.json missing under {model_dir}")
        self.tokenizer = Tokenizer.from_file(str(tok_path))

        opts = ort.SessionOptions()
        opts.inter_op_num_threads = 4
        opts.intra_op_num_threads = 4
        self.encoder = ort.InferenceSession(
            str(_find_onnx(model_dir, "text_encoder")), opts,
            providers=["CPUExecutionProvider"])
        self.decoder = ort.InferenceSession(
            str(_find_onnx(model_dir, "decoder_model_merged")), opts,
            providers=["CPUExecutionProvider"])
        self.encodec = ort.InferenceSession(
            str(_find_onnx(model_dir, "encodec_decode")), opts,
            providers=["CPUExecutionProvider"])
        log.info("MusicGen ONNX sessions loaded from %s", model_dir)

    # -- session introspection helpers -------------------------------------
    @staticmethod
    def _input(session, *needles):
        for i in session.get_inputs():
            if all(n in i.name for n in needles):
                return i.name
        raise RuntimeError(
            f"ONNX input matching {needles} not found; have: "
            f"{[i.name for i in session.get_inputs()]}")

    @staticmethod
    def _output(session, *needles):
        for o in session.get_outputs():
            if all(n in o.name for n in needles):
                return o.name
        raise RuntimeError(
            f"ONNX output matching {needles} not found; have: "
            f"{[o.name for o in session.get_outputs()]}")

    def generate(self, prompt: str, duration: int) -> bytes:
        enc = self.tokenizer.encode(prompt)
        input_ids = np.array([enc.ids], dtype=np.int64)
        attn = np.array([enc.attention_mask], dtype=np.int64)

        enc_in = {
            self._input(self.encoder, "input_ids"): input_ids,
            self._input(self.encoder, "attention_mask"): attn,
        }
        enc_out_name = self._output(self.encoder, "last_hidden_state")
        hidden = self.encoder.run([enc_out_name], enc_in)[0]  # [1, T, H]

        dec_in_names = [i.name for i in self.decoder.get_inputs()]
        past_names = [n for n in dec_in_names if n.startswith("past_key_values")]
        present_names = [o.name for o in self.decoder.get_outputs()
                         if o.name.startswith("present")]
        logits_name = self._output(self.decoder, "logits")
        # The merged decoder selects its cache branch with use_cache_branch:
        # False on the first step (no cache exists yet), True afterwards.
        # A plain decoder_with_past model has no such input and takes the
        # cache directly, so the flag is only fed when the model declares it.
        use_cache_name = next(
            (n for n in dec_in_names if n == "use_cache_branch"), None)

        # Generation runs in the delayed space: at step s the decoder sees one
        # new column; the sampled column becomes the next input column.
        max_new = duration * self.FRAME_RATE + self.num_codebooks - 1
        delayed = np.full((1, self.num_codebooks, 1), self.start_token,
                          dtype=np.int64)
        columns = [delayed.copy()]
        past: dict = {}
        dec_mask = np.ones((1, 1), dtype=np.int64)
        use_cache = False
        for _ in range(max_new):
            feed = {
                self._input(self.decoder, "input_ids"): delayed,
                self._input(self.decoder, "attention_mask"): dec_mask,
                self._input(self.decoder, "encoder_hidden_states"): hidden,
                self._input(self.decoder, "encoder_attention_mask"): attn,
                **past,
            }
            if use_cache_name is not None:
                feed[use_cache_name] = np.array(use_cache, dtype=bool)
            if not past:
                # First step: no KV cache yet. The graph still requires its
                # past_key_values inputs, so feed empty (seq_len 0) tensors.
                for p_name in past_names:
                    feed[p_name] = np.zeros(
                        (1, self.num_heads, 0, self.head_dim),
                        dtype=np.float32)
            outs = self.decoder.run(None, feed)
            by_name = dict(zip(
                [o.name for o in self.decoder.get_outputs()], outs))
            logits = by_name[logits_name]  # [1, codebooks, 1, vocab]
            nxt = np.argmax(logits[:, :, -1, :], axis=-1)  # [1, codebooks]
            nxt = np.expand_dims(nxt, axis=2)  # [1, codebooks, 1]
            columns.append(nxt.copy())
            delayed = nxt
            dec_mask = np.ones((1, dec_mask.shape[1] + 1), dtype=np.int64)
            past = {}
            for p_name, q_name in zip(past_names, present_names):
                past[p_name] = by_name[q_name]
            use_cache = True

        # Remove the delay pattern: audio code for frame t is column t + c.
        cols = np.concatenate(columns, axis=2)[0]  # [codebooks, L]
        n_frames = cols.shape[1] - (self.num_codebooks - 1)
        codes = np.stack(
            [cols[c, c:c + n_frames] for c in range(self.num_codebooks)],
            axis=0)  # [codebooks, frames]

        # EnCodec decode: codes -> waveform.
        enc_in_name = self.encodec.get_inputs()[0].name
        enc_shape = self.encodec.get_inputs()[0].shape
        if len(enc_shape) == 4:
            audio_codes = codes[np.newaxis, np.newaxis, :, :]  # [1,1,C,T]
        else:
            audio_codes = codes[np.newaxis, :, :]  # [1,C,T]
        audio = self.encodec.run(None, {enc_in_name: audio_codes})[0]
        samples = np.asarray(audio, dtype=np.float32).reshape(-1)
        return _wav_bytes(samples, self.sample_rate)


class MusicGenTransformers:
    """Fallback backend: facebook/musicgen-small via transformers + torch."""

    def __init__(self):
        from transformers import AutoProcessor, MusicgenForConditionalGeneration
        self.processor = AutoProcessor.from_pretrained("facebook/musicgen-small")
        self.model = MusicgenForConditionalGeneration.from_pretrained(
            "facebook/musicgen-small")
        self.model.eval()
        self.sample_rate = int(
            self.model.config.audio_encoder.sampling_rate)
        log.info("MusicGen transformers backend loaded")

    def generate(self, prompt: str, duration: int) -> bytes:
        import torch
        inputs = self.processor(text=[prompt], padding=True,
                                return_tensors="pt")
        with torch.no_grad():
            audio = self.model.generate(
                **inputs, max_new_tokens=duration * 50, do_sample=False)
        samples = audio[0, 0].numpy().astype(np.float32)
        return _wav_bytes(samples, self.sample_rate)


_musicgen = None


def _get_musicgen():
    global _musicgen
    if _musicgen is None:
        if MUSICGEN_BACKEND == "transformers":
            _musicgen = MusicGenTransformers()
        else:
            _musicgen = MusicGenONNX(MODEL_DIR)
    return _musicgen


@app.post("/api/musicgen")
def musicgen(req: MusicGenRequest):
    try:
        wav = _get_musicgen().generate(req.prompt, req.duration)
    except Exception as e:
        log.error("musicgen failed: %s\n%s", e, traceback.format_exc())
        raise HTTPException(
            500, f"MusicGen generation failed ({MUSICGEN_BACKEND} backend): {e}"
        ) from e
    return Response(content=wav, media_type="audio/wav")


# ---------------------------------------------------------------- health

@app.get("/health")
def health():
    ollama_ok = False
    try:
        ollama_ok = _http.get(f"{OLLAMA_URL}/api/tags").status_code == 200
    except httpx.HTTPError:
        pass
    musicgen_ready = False
    try:
        musicgen_ready = bool(list((MODEL_DIR / "onnx").glob("*.onnx")))
    except OSError:
        pass
    return {
        "status": "ok" if (ollama_ok and musicgen_ready) else "degraded",
        "ollama": ollama_ok,
        "ollama_model": OLLAMA_MODEL,
        "musicgen_ready": musicgen_ready,
        "musicgen_backend": MUSICGEN_BACKEND,
    }


@app.get("/")
def root():
    return {
        "service": "fretboard-ai",
        "endpoints": ["/health", "/api/lyrics", "/api/musicgen"],
    }
