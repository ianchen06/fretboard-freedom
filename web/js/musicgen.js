// In-browser backing tracks with Meta's MusicGen-small (Transformers.js, Xenova/musicgen-small).
//
// The model takes an English text prompt and invents a short instrumental clip. It cannot
// play the user's chords or melody and it cannot hit an exact tempo, so the tracks here are
// sketches to write or practise against, not a render of the song. The weights (~1 GB, q8)
// download from the Hugging Face Hub on first use and are cached by the browser afterwards.
// The MusicGen Melody variant (an audio prompt that steers the melody) has no ONNX port
// (checked 2026-11-23), so this build is text prompts only.
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
  const PC_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  let worker = null;
  let seq = 0;
  let device = null;
  const pending = new Map(); // id -> { resolve, reject, onProgress, onGenerating }

  function isSupported() {
    return typeof Worker !== 'undefined';
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

  // Warm up (or download) the model. Reports download progress; resolves with 'webgpu' or 'wasm'.
  function load(onProgress) {
    return call('load', {}, { onProgress });
  }

  // Generate a clip. seconds is the clip length (5-30, default 10); guidance_scale 3 is
  // the value from the model's own example. Resolves with { audio: Float32Array, sampling_rate }.
  function generate(prompt, opts) {
    const o = opts || {};
    const seconds = Math.max(1, Math.min(30, Math.round(o.seconds == null ? 10 : o.seconds)));
    return call('generate', {
      prompt,
      max_new_tokens: durationToTokens(seconds),
      guidance_scale: o.guidance_scale || 3,
    }, { onProgress: o.onProgress, onGenerating: o.onGenerating });
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
      'soft piano and acoustic guitar, gentle drums, no vocals',
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
      'no vocals',
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
    isSupported,
    load,
    generate,
    durationToTokens,
    buildWritePrompt,
    buildSessionPrompt,
    encodeWav,
    toAudioBuffer,
    Player,
    get device() { return device; },
  };
});
