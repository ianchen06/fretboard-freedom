// In-browser lyric partner: Qwen2.5-1.5B-Instruct running in a module worker (js/llm-worker.js)
// via Transformers.js. The model drafts lines; js/zh.js and js/songtheory.js score them, so a
// line is only offered when it fits the melody's tones, the section's rhyme group and the
// syllable count. The weights download from the Hugging Face Hub on first use (~1.1 GB) and
// are cached by the browser afterwards. Nothing the user writes leaves the device.
//
// The scoring and cleaning are pure (no DOM, no Worker), so the tests can run this file in Node.
// Loading and generation need a browser: isSupported() is false in Node, and load() rejects.
(function (root) {
  'use strict';

  const MODEL_ID = 'onnx-community/Qwen2.5-1.5B-Instruct';
  const MODEL_MB = 1165; // q4f16 weights, first use only; the browser cache keeps them after.
  const WORKER_URL = 'js/llm-worker.js';
  const DEFAULT_COUNT = 3;

  let worker = null;
  let nextId = 1;
  const pending = new Map(); // id -> { kind, resolve, reject, onProgress, onToken }
  let readyPromise = null;
  let readyDevice = null;

  function isSupported() {
    return typeof Worker !== 'undefined';
  }

  function ensureWorker() {
    if (worker) return worker;
    worker = new Worker(WORKER_URL, { type: 'module' });
    worker.onmessage = (e) => {
      const msg = e.data || {};
      if (msg.type === 'progress') {
        // Progress carries the id of the load in flight; fall back to it if the id is missing.
        const target = pending.get(msg.id) || [...pending.values()].find((p) => p.kind === 'load');
        if (target && target.onProgress) target.onProgress(msg);
        return;
      }
      const entry = pending.get(msg.id);
      if (!entry) return;
      if (msg.type === 'token') { if (entry.onToken) entry.onToken(msg.text); return; }
      pending.delete(msg.id);
      if (msg.type === 'error') entry.reject(new Error(msg.message || 'Model error'));
      else entry.resolve(msg);
    };
    worker.onerror = (err) => {
      const message = String((err && err.message) || err || 'Model worker failed to start');
      for (const [, entry] of pending) entry.reject(new Error(message));
      pending.clear();
      worker = null;
      readyPromise = null;
    };
    return worker;
  }

  // Load the model (downloading it on first use). Resolves { device: 'webgpu' | 'wasm' }.
  // Rejects on browsers without module workers, or when the download or the model fails.
  function load(onProgress) {
    if (readyPromise) return readyPromise;
    if (!isSupported()) return Promise.reject(new Error('This browser cannot run the in-browser model (no module worker).'));
    readyPromise = new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, {
        kind: 'load',
        resolve: (msg) => { readyDevice = msg.device; resolve({ device: msg.device }); },
        reject,
        onProgress,
      });
      ensureWorker().postMessage({ type: 'load', id });
    });
    readyPromise.catch(() => { readyPromise = null; });
    return readyPromise;
  }

  // One generation. Messages use the model's chat template. Returns the raw generated text.
  function generate(messages, { max_new_tokens = 80, temperature = 0.8, top_p = 0.9, repetition_penalty = 1.1, onToken, onProgress } = {}) {
    return load(onProgress).then(() => new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { kind: 'generate', resolve: (msg) => resolve(msg.text || ''), reject, onToken });
      ensureWorker().postMessage({ type: 'generate', id, messages, max_new_tokens, temperature, top_p, repetition_penalty });
    }));
  }

  // The prompt: Traditional Chinese only, one line, with the constraints the checker will test.
  // `section` is a SongTheory SECTION_TYPES entry, `rhymeGroup` a Zh RHYME_GROUPS entry.
  function buildPrompt({ section, style, title, prevLines, syllables, rhymeGroup }) {
    const secName = section ? `${section.zh}（${section.name}）` : '歌詞';
    const prev = (prevLines || []).filter(Boolean);
    const rhymeWords = rhymeGroup && rhymeGroup.words ? rhymeGroup.words.split(' ').slice(0, 8).join('、') : '';
    const user = [
      `寫一句${secName}的歌詞。`,
      title ? `歌名：${title}` : '',
      prev.length ? `前面的歌詞：\n${prev.map((l) => `「${l}」`).join('\n')}` : '這是第一句。',
      `要求：約 ${syllables || 7} 個字。`,
      rhymeGroup ? `最後一個字押${rhymeGroup.zh}轍（${rhymeGroup.sound}韻，例如：${rhymeWords}）。` : '',
      style ? `風格：${style}。` : '',
      '只回那一句歌詞，不要解釋，不要加引號，不要編號。',
    ].filter(Boolean).join('\n');
    return [
      { role: 'system', content: '你是一位華語流行歌詞作者。只寫繁體中文歌詞，每次只回一句。' },
      { role: 'user', content: user },
    ];
  }

  // Small models wrap lines in numbering, quotes or explanations: keep the first real line.
  function cleanLine(raw) {
    const lines = String(raw || '').replace(/```/g, '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    let line = lines[0] || '';
    line = line.replace(/^(?:\d+[.、）)]|[-*•>])\s*/, '');
    line = line.replace(/^歌詞[：:]\s*/, '');
    line = line.replace(/^["'「『（(]+|["'」』）)]+$/g, '');
    return line.trim();
  }

  // How well a drafted line fits: tone against the melody (50%), rhyme group (30%), and
  // syllable count against the notes (20%). A line with fewer syllables than notes is fine
  // (melisma); more syllables than notes has nowhere to sing. Without a melody the tone and
  // count parts are neutral, so the rhyme decides. Returns 0–100 plus the parts.
  function scoreCandidate(text, notes, rhymeId, ZhApi, STApi) {
    const Zh = ZhApi || root.Zh;
    const ST = STApi || root.SongTheory;
    const syl = Zh.syllables(text);
    const last = Zh.rhymeSyllable(syl);
    const group = last ? Zh.rhymeOf(last.base) : null;
    const rhymeOk = rhymeId && group ? group.id === rhymeId : null;
    const tone = notes && notes.length && syl.length && ST ? ST.toneCheck(notes, syl).score : null;
    const noteCount = notes ? notes.length : 0;
    const over = noteCount ? Math.max(0, syl.length - noteCount) : 0;
    const tonePart = tone == null ? 50 : tone;
    const rhymePart = rhymeOk == null ? 50 : (rhymeOk ? 100 : 0);
    const countPart = noteCount ? Math.max(0, 100 - over * 30) : 100;
    const score = Math.round(0.5 * tonePart + 0.3 * rhymePart + 0.2 * countPart);
    return { text, syllables: syl.length, tone, rhyme: group ? group.id : null, rhymeOk, over, score };
  }

  // Draft `count` lines, clean and score each, drop duplicates and empties, best first.
  // `opts` is the buildPrompt input plus `notes` (the line's melody) for scoring.
  async function suggestCandidates(opts, { count = DEFAULT_COUNT, onProgress, onToken } = {}) {
    const messages = buildPrompt(opts);
    const rhymeId = opts.rhymeGroup ? opts.rhymeGroup.id : (opts.rhymeId || null);
    const seen = new Set();
    const out = [];
    for (let k = 0; k < count; k++) {
      const text = cleanLine(await generate(messages, { onToken, onProgress }));
      if (!text || seen.has(text)) continue;
      seen.add(text);
      out.push(scoreCandidate(text, opts.notes, rhymeId));
    }
    out.sort((a, b) => b.score - a.score);
    return out;
  }

  const api = {
    MODEL_ID, MODEL_MB,
    isSupported, load, generate, buildPrompt, cleanLine, scoreCandidate, suggestCandidates,
    device: () => readyDevice,
  };
  root.LyricAI = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
