// Backing tracks with Meta's MusicGen-small. Two modes, both producing the same
// { audio: Float32Array, sampling_rate } clip from an English text prompt:
//
//   server  (default) — POSTs to the backing-track server on the Oracle A1
//             (https://ai.0x1.tw/api/musicgen, ONNX MusicGen-small). No model
//             downloads, so it works on phones whose browsers cannot hold the
//             1 GB in-browser weights. The prompt (and only the prompt) leaves
//             the device; the server keeps no history. A 10 s track takes ~20 s.
//   browser — the model in a module worker (js/musicgen-worker.js) via
//             Transformers.js. The weights download from the Hugging Face Hub on
//             first use (~1 GB, q8) and are cached by the browser afterwards.
//             Nothing the user writes leaves the device.
//
// The mode is stored in localStorage ('ff.musicgenMode') and switched from the
// write and session pages' backing-track panels; the default is server.
//
// The model takes an English text prompt and invents a short instrumental clip. It cannot
// play the user's chords or melody and it cannot hit an exact tempo, so the tracks here are
// sketches to write or practise against, not a render of the song. The MusicGen Melody
// variant (an audio prompt that steers the melody) has no ONNX port (checked 2026-11-23),
// so this build is text prompts only.
//
// UMD: window.MusicGen in the browser, module.exports under Node (for the tests).
(function (root, factory) {
  'use strict';
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.MusicGen = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MODEL_ID = 'Xenova/musicgen-small';
  const MODEL_MB = 1000; // q8 set, first use only; the browser cache keeps it after.
  const SAMPLE_RATE = 32000; // MusicGen's EnCodec runs at 32 kHz.
  const TOKEN_RATE = 50; // the model generates 50 tokens per second of audio.
  const MAX_TOKENS = 1500; // 30 seconds, the model's positional limit.
  const WORKER_URL = 'js/musicgen-worker.js';
  const SERVER_URL = 'https://ai.0x1.tw';
  const MODE_KEY = 'ff.musicgenMode';
  const PC_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  let serverUrl = SERVER_URL;
  let mode = 'server';
  try {
    const saved = typeof localStorage !== 'undefined' && localStorage.getItem(MODE_KEY);
    if (saved === 'server' || saved === 'browser') mode = saved;
  } catch { /* storage unavailable (private mode, Node) — keep the default */ }

  function getMode() { return mode; }
  function setMode(next) {
    if (next !== 'server' && next !== 'browser') throw new Error(`Unknown MusicGen mode: ${next}`);
    if (next === mode) return mode;
    mode = next;
    try { if (typeof localStorage !== 'undefined') localStorage.setItem(MODE_KEY, mode); } catch { /* ignore */ }
    device = null;
    return mode;
  }
  function getServerUrl() { return serverUrl; }
  function setServerUrl(url) { serverUrl = String(url || SERVER_URL); return serverUrl; }

  let worker = null;
  let seq = 0;
  let device = null;
  const pending = new Map(); // id -> { resolve, reject, onProgress, onGenerating }

  function isSupported() {
    if (mode === 'server') return typeof fetch !== 'undefined';
    return typeof Worker !== 'undefined';
  }

  async function serverHealth() {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    try {
      const res = await fetch(`${serverUrl}/health`, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`server answered ${res.status}`);
    } catch (err) {
      if (err && err.name === 'AbortError') throw new Error(`Music server at ${serverUrl} did not answer in time`);
      throw new Error(`Music server unreachable at ${serverUrl} — check the connection, or switch to On-device.`);
    } finally {
      clearTimeout(timer);
    }
  }

  // Warm up (or download) the model. Reports download progress; resolves with
  // 'webgpu', 'wasm' (browser mode) or 'server' (server mode, after a health check).
  function load(onProgress) {
    if (mode === 'server') {
      if (!isSupported()) return Promise.reject(new Error('This browser cannot reach the music server (no fetch).'));
      return serverHealth().then(() => {
        device = 'server';
        return 'server';
      });
    }
    return call('load', {}, { onProgress });
  }

  // Generate a clip. seconds is the clip length (5-30, default 10); guidance_scale 3 is
  // the value from the model's own example. Resolves with { audio: Float32Array, sampling_rate }.
  // In server mode the prompt is POSTed to /api/musicgen and the returned WAV is decoded.
  function generate(prompt, opts) {
    const o = opts || {};
    const seconds = Math.max(1, Math.min(30, Math.round(o.seconds == null ? 10 : o.seconds)));
    if (mode === 'server') {
      if (o.onGenerating) o.onGenerating();
      return (async () => {
        let res;
        try {
          res = await fetch(`${serverUrl}/api/musicgen`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, duration: seconds }),
          });
        } catch {
          throw new Error(`Music server unreachable at ${serverUrl} — check the connection, or switch to On-device.`);
        }
        if (!res.ok) throw new Error(`Music server answered ${res.status} — try again, or switch to On-device.`);
        const buf = await res.arrayBuffer();
        return decodeWav(buf);
      })();
    }
    return call('generate', {
      prompt,
      max_new_tokens: durationToTokens(seconds),
      guidance_scale: o.guidance_scale || 3,
    }, { onProgress: o.onProgress, onGenerating: o.onGenerating });
  }

  // Decode a 16-bit PCM WAV (mono or multi-channel, first channel kept) into
  // { audio: Float32Array, sampling_rate }. Pure, so the tests can run it in Node.
  function decodeWav(arrayBuffer) {
    const v = new DataView(arrayBuffer);
    const str = (off, n) => String.fromCharCode(...new Uint8Array(arrayBuffer, off, n));
    if (v.byteLength < 44 || str(0, 4) !== 'RIFF' || str(8, 4) !== 'WAVE') {
      throw new Error('Not a WAV file');
    }
    let offset = 12;
    let fmt = null;
    let dataOff = -1;
    let dataLen = 0;
    while (offset + 8 <= v.byteLength) {
      const id = str(offset, 4);
      const size = v.getUint32(offset + 4, true);
      const body = offset + 8;
      if (id === 'fmt ') {
        fmt = {
          format: v.getUint16(body, true),
          channels: v.getUint16(body + 2, true),
          sampleRate: v.getUint32(body + 4, true),
          bits: v.getUint16(body + 14, true),
        };
      } else if (id === 'data') {
        dataOff = body;
        dataLen = size;
        break;
      }
      offset = body + size + (size % 2);
    }
    if (!fmt) throw new Error('WAV has no fmt chunk');
    if (fmt.format !== 1) throw new Error(`WAV is not PCM (format ${fmt.format})`);
    if (fmt.bits !== 16) throw new Error(`WAV is not 16-bit (${fmt.bits}-bit)`);
    if (dataOff < 0) throw new Error('WAV has no data chunk');
    const frames = Math.floor(dataLen / 2 / Math.max(1, fmt.channels));
    const audio = new Float32Array(frames);
    for (let i = 0; i < frames; i++) {
      audio[i] = v.getInt16(dataOff + i * fmt.channels * 2, true) / 32768;
    }
    return { audio, sampling_rate: fmt.sampleRate };
  }

  function loadWorker() {
    if (worker) return worker;
    worker = new Worker(WORKER_URL, { type: 'module' });
    worker.onmessage = (e) => {
      const msg = e.data || {};
      const entry = pending.get(msg.id);
      if (!entry) return;
      if (msg.type === 'progress') {
        if (entry.onProgress) entry.onProgress(msg);
      } else if (msg.type === 'generating') {
        if (entry.onGenerating) entry.onGenerating();
      } else if (msg.type === 'ready') {
        pending.delete(msg.id);
        device = msg.device || device;
        entry.resolve(device);
      } else if (msg.type === 'result') {
        pending.delete(msg.id);
        entry.resolve({ audio: msg.audio, sampling_rate: msg.sampling_rate || SAMPLE_RATE });
      } else if (msg.type === 'error') {
        pending.delete(msg.id);
        entry.reject(new Error(msg.message || 'MusicGen failed'));
      }
    };
    worker.onerror = (err) => {
      for (const [, entry] of pending) entry.reject(new Error(String((err && err.message) || err)));
      pending.clear();
    };
    return worker;
  }

  function call(type, payload, handlers) {
    return new Promise((resolve, reject) => {
      const w = loadWorker();
      const id = ++seq;
      pending.set(id, { resolve, reject, onProgress: handlers && handlers.onProgress, onGenerating: handlers && handlers.onGenerating });
      w.postMessage({ type, id, ...payload });
    });
  }

  // MusicGen generates 50 tokens per second of audio; the model caps at 1500 tokens (30 s).
  function durationToTokens(seconds) {
    const s = Math.max(1, Math.min(30, Math.round(seconds == null ? 10 : seconds)));
    return Math.min(MAX_TOKENS, s * TOKEN_RATE);
  }

  function keyName(keyPc) {
    if (keyPc == null) return '';
    return PC_NAMES[((keyPc % 12) + 12) % 12];
  }

  // Write page: a backing-track sketch in the song's style, key and tempo.
  function buildWritePrompt(o) {
    const styleWords = { ballad: 'Mandopop ballad', pop: 'Mandopop pop song', rock: 'Mandopop rock song' }[o.style] || 'Mandopop song';
    const key = keyName(o.keyPc);
    return [
      `${styleWords} backing track`,
      key ? `in ${key} major` : '',
      o.bpm ? `${o.bpm} bpm` : '',
      'bright acoustic guitar and sparkling piano, crisp hi-hats, gentle drums, clear high melody, no vocals',
    ].filter(Boolean).join(', ');
  }

  // Session page: a practice groove for the current exercise's skill, at its tempo and in
  // the session's key. The skill is a family name (pent, metal, bends, vibrato:narrow...);
  // unknown families fall back to a plain practice groove. The track will not be exactly
  // in key or exactly at tempo, so it is a jam track, not a click.
  const SKILL_WORDS = {
    pent: 'blues-rock pentatonic jam',
    scales: 'smooth guitar practice groove',
    arps: 'clean arpeggiated guitar groove',
    metal: 'heavy metal riff backing',
    tech: 'precise rock guitar exercise groove',
    rhythm: 'tight funk groove',
    chromatic: 'jazzy chromatic guitar groove',
    bends: 'blues string-bending jam',
    vibrato: 'expressive rock ballad groove',
    stops: 'punchy muted-guitar groove',
    noteAll: 'simple guitar practice groove',
  };
  function buildSessionPrompt(o) {
    const fam = String((o && o.skill) || '').split(':')[0];
    const key = keyName(o && o.keyPc);
    return [
      SKILL_WORDS[fam] || 'melodic guitar practice groove',
      key ? `in ${key} major` : '',
      o && o.bpm ? `${o.bpm} bpm` : '',
      'bright lead guitar, crisp hi-hats and snare, clear high melody, no vocals',
    ].filter(Boolean).join(', ');
  }

  // 16-bit PCM mono WAV. `data` is Float32Array samples in [-1, 1].
  function encodeWav(data, sampleRate) {
    const n = data.length;
    const buf = new ArrayBuffer(44 + n * 2);
    const v = new DataView(buf);
    const wstr = (off, s) => { for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)); };
    wstr(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); wstr(8, 'WAVE');
    wstr(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true);
    v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    wstr(36, 'data'); v.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) {
      const s = Math.max(-1, Math.min(1, data[i]));
      v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    return new Blob([buf], { type: 'audio/wav' });
  }

  function toAudioBuffer(ctx, data, sampleRate) {
    const buf = ctx.createBuffer(1, data.length, sampleRate);
    buf.getChannelData(0).set(data);
    return buf;
  }

  // A one-clip player with its own AudioContext, so the pages do not have to wire the
  // track into their own audio engines. play() stops any clip already playing.
  function Player() {
    this.ctx = null;
    this.source = null;
    this.audio = null;
    this.samplingRate = SAMPLE_RATE;
    this.onended = null;
  }
  Player.prototype.setTrack = function (track) {
    this.stop();
    this.audio = track && track.audio ? track.audio : null;
    this.samplingRate = (track && track.sampling_rate) || SAMPLE_RATE;
  };
  Player.prototype.play = function () {
    if (!this.audio) return false;
    if (typeof AudioContext === 'undefined' && typeof webkitAudioContext === 'undefined') return false;
    this.stop();
    if (!this.ctx) this.ctx = new (AudioContext || webkitAudioContext)();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const src = this.ctx.createBufferSource();
    src.buffer = toAudioBuffer(this.ctx, this.audio, this.samplingRate);
    src.connect(this.ctx.destination);
    const self = this;
    src.onended = function () {
      if (self.source === src) {
        self.source = null;
        if (self.onended) self.onended();
      }
    };
    src.start();
    this.source = src;
    return true;
  };
  Player.prototype.stop = function () {
    if (this.source) {
      try { this.source.stop(); } catch (e) { /* already stopped */ }
      this.source = null;
    }
  };
  Object.defineProperty(Player.prototype, 'playing', {
    get: function () { return !!this.source; },
  });
  Player.prototype.download = function (filename) {
    if (!this.audio || typeof document === 'undefined') return;
    const blob = encodeWav(this.audio, this.samplingRate);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename || 'backing-track.wav';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
  };

  return {
    MODEL_ID,
    MODEL_MB,
    SAMPLE_RATE,
    TOKEN_RATE,
    MAX_TOKENS,
    SERVER_URL,
    isSupported,
    load,
    generate,
    durationToTokens,
    buildWritePrompt,
    buildSessionPrompt,
    encodeWav,
    decodeWav,
    toAudioBuffer,
    Player,
    getMode,
    setMode,
    getServerUrl,
    setServerUrl,
    get device() { return device; },
  };
});
