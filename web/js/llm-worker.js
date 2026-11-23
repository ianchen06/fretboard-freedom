// Lyric model worker: runs Qwen2.5-1.5B-Instruct in the browser with Transformers.js.
// Loaded lazily by js/llm.js as a module worker, so generation never blocks the page.
// The model weights (~1.1 GB, q4f16) download from the Hugging Face Hub on first use and
// are cached by the browser afterwards. Nothing the user writes leaves the device.
//
// Protocol (postMessage both ways, every message carries an `id`):
//   in  { type: 'load' }                          -> out { type: 'ready', device }
//   in  { type: 'generate', messages, max_new_tokens, temperature, top_p, repetition_penalty }
//                                                 -> out { type: 'token', text }* then { type: 'result', text }
//   any failure                                   -> out { type: 'error', message }
//   while loading                                 -> out { type: 'progress', status, file, progress, loaded, total }
import { pipeline, TextStreamer, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.2/+esm';

const MODEL_ID = 'onnx-community/Qwen2.5-1.5B-Instruct';
const DTYPE = 'q4f16'; // 4-bit weights, fp16 activations: the best size/quality tradeoff for an LLM on WebGPU.

env.allowLocalModels = false; // fetch weights from the Hub; the browser cache keeps them after the first download.

let generator = null;
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
  if (generator) return device;
  device = await pickDevice();
  const progress = (p) => self.postMessage({ type: 'progress', id: currentId, ...p });
  try {
    generator = await pipeline('text-generation', MODEL_ID, { device, dtype: DTYPE, progress_callback: progress });
  } catch (err) {
    if (device === 'wasm') throw err;
    // WebGPU failed (driver, adapter lost, out of memory): retry on WebAssembly.
    device = 'wasm';
    generator = await pipeline('text-generation', MODEL_ID, { device, dtype: DTYPE, progress_callback: progress });
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
      const { messages, max_new_tokens = 80, temperature = 0.8, top_p = 0.9, repetition_penalty = 1.1 } = e.data;
      const streamer = new TextStreamer(generator.tokenizer, {
        skip_prompt: true,
        skip_special_tokens: true,
        callback_function: (text) => self.postMessage({ type: 'token', id, text }),
      });
      const out = await generator(messages, {
        max_new_tokens,
        do_sample: true,
        temperature,
        top_p,
        repetition_penalty,
        streamer,
        return_full_text: false,
      });
      const first = Array.isArray(out) ? out[0] : out;
      const text = first && typeof first.generated_text === 'string' ? first.generated_text : '';
      self.postMessage({ type: 'result', id, text });
    }
  } catch (err) {
    self.postMessage({ type: 'error', id, message: String((err && err.message) || err) });
  }
};
