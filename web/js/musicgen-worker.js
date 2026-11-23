// Backing-track model worker: Meta's MusicGen-small in the browser with Transformers.js.
// Loaded lazily by js/musicgen.js as a module worker. Text prompt in, mono 32 kHz audio out.
// The weights (~1 GB, q8) download from the Hugging Face Hub on first use and are cached
// by the browser afterwards.
//
// Protocol (postMessage both ways, every message carries an `id`):
//   in  { type: 'load' }                                  -> out { type: 'ready', device }
//   in  { type: 'generate', prompt, max_new_tokens, guidance_scale }
//                                                         -> out { type: 'generating' } then { type: 'result', audio, sampling_rate }
//   any failure                                           -> out { type: 'error', message }
//   while loading                                         -> out { type: 'progress', status, file, progress, loaded, total }
import { AutoTokenizer, MusicgenForConditionalGeneration, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.2/+esm';

const MODEL_ID = 'Xenova/musicgen-small';
const DTYPE = { text_encoder: 'q8', decoder_model_merged: 'q8', encodec_decode: 'fp32' };

env.allowLocalModels = false; // fetch weights from the Hub; the browser cache keeps them after the first download.

let tokenizer = null;
let model = null;
let device = null;
let currentId = null; // the load/generate call in flight, so progress reports route to it.

async function pickDevice() {
  try {
    if (typeof navigator !== 'undefined' && navigator.gpu) {
      const adapter = await navigator.gpu.requestAdapter();
      if (adapter) return 'webgpu';
    }
  } catch {
    // No WebGPU adapter: fall through to the WebAssembly runtime.
  }
  return 'wasm';
}

async function ensureLoaded() {
  if (model) return device;
  device = await pickDevice();
  const progress = (p) => self.postMessage({ type: 'progress', id: currentId, ...p });
  try {
    tokenizer = await AutoTokenizer.from_pretrained(MODEL_ID, { progress_callback: progress });
    model = await MusicgenForConditionalGeneration.from_pretrained(MODEL_ID, { device, dtype: DTYPE, progress_callback: progress });
  } catch (err) {
    if (device === 'wasm') throw err;
    // WebGPU failed (driver, adapter lost, out of memory): retry on WebAssembly.
    device = 'wasm';
    tokenizer = await AutoTokenizer.from_pretrained(MODEL_ID, { progress_callback: progress });
    model = await MusicgenForConditionalGeneration.from_pretrained(MODEL_ID, { device, dtype: DTYPE, progress_callback: progress });
  }
  return device;
}

self.onmessage = async (e) => {
  const { type, id } = e.data || {};
  currentId = id ?? null;
  try {
    if (type === 'load') {
      const d = await ensureLoaded();
      self.postMessage({ type: 'ready', id, device: d });
    } else if (type === 'generate') {
      await ensureLoaded();
      const { prompt, max_new_tokens = 500, guidance_scale = 3 } = e.data;
      self.postMessage({ type: 'generating', id });
      const inputs = tokenizer(prompt);
      const out = await model.generate({ ...inputs, max_new_tokens, do_sample: true, guidance_scale });
      const raw = out && out.data ? out.data : out;
      const data = Float32Array.from(raw);
      const sampling_rate = (model.config && model.config.audio_encoder && model.config.audio_encoder.sampling_rate) || 32000;
      self.postMessage({ type: 'result', id, audio: data, sampling_rate }, [data.buffer]);
    }
  } catch (err) {
    self.postMessage({ type: 'error', id, message: String((err && err.message) || err) });
  }
};
