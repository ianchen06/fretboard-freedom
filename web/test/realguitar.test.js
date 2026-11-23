// Tests the Tuner's pitch engine on real guitar recordings (test/data/), as the Tuner hears them:
// through a line input, a phone's mic (its roll-off takes ~10 dB more off the low E's already weak
// fundamental) in a room, and an unplugged electric's level, a few dB over the room's noise.
// Real strings are what the synthetic tests can't fully stand in for: their harmonics are stretched
// and each wanders by a few cents, the low E's fundamental is 20-30 dB under its 2nd harmonic,
// other strings ring in sympathy. A tuner that only passes synthetic tests can fail on these.
// Each clip's reference pitch is its own: the fundamental of a stiff-string fit to its first ten
// partials, read from one 2 s spectrum (as the engine defines a string's pitch).
// Run: node web/test/realguitar.test.js
'use strict';
const fs = require('fs');
const path = require('path');
const { TunerEngine, stiffFit, fft } = require('../js/tunerengine.js');

let failures = 0;
const check = (ok, msg) => { if (!ok) { failures++; console.log('  FAIL', msg); } };
const cents = (f, ref) => 1200 * Math.log2(f / ref);
const dbToLin = (d) => 10 ** (d / 20);
const pct = (v, p) => { const s = v.slice().sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))] : NaN; };
let seed = 5;
const rand = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1; };
const gauss = () => { let s = 0; for (let i = 0; i < 6; i++) s += rand(); return s / Math.sqrt(2); };

const SR = 48000;
const CLIPS = [['acoustic', 'E2', 40], ['electric', 'E2', 40], ['nylon', 'E2', 40], ['acoustic', 'A2', 45], ['acoustic', 'G3', 55], ['acoustic', 'E4', 64]];

// A clip (12 kHz, 16-bit) at 48 kHz: ×4 with a windowed-sinc interpolator.
function load(kind, note) {
  const b = fs.readFileSync(path.join(__dirname, 'data', `guitar-${kind}-${note}.s16`));
  const x = new Float32Array(b.length / 2);
  for (let i = 0; i < x.length; i++) x[i] = b.readInt16LE(2 * i) / 32768;
  const U = 4;
  const L = 32;
  const h = new Float32Array(2 * L * U + 1);
  for (let k = -L * U; k <= L * U; k++) {
    const u = k / U;
    const s = k === 0 ? 1 : Math.sin(Math.PI * u) / (Math.PI * u);
    h[k + L * U] = s * (0.42 + 0.5 * Math.cos((Math.PI * k) / (L * U)) + 0.08 * Math.cos((2 * Math.PI * k) / (L * U)));
  }
  const y = new Float32Array(x.length * U);
  for (let n = 0; n < y.length; n++) {
    let s = 0;
    const c = n / U;
    for (let m = Math.ceil(c - L); m <= Math.floor(c + L); m++) if (m >= 0 && m < x.length) s += x[m] * h[(n - m * U) + L * U];
    y[n] = s;
  }
  return y;
}

// The clip's reference pitch: a stiff-string fit to its partials, from one spectrum of 0.3-2.3 s.
function reference(x, midi) {
  const a = Math.round(0.3 * SR);
  const n = 2 ** 18;
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  const len = Math.min(x.length - a, Math.round(2 * SR));
  for (let i = 0; i < len; i++) re[i] = x[a + i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (len - 1)));
  fft(re, im);
  const mag = (k) => Math.hypot(re[k], im[k]);
  const df = SR / n;
  const f0 = 440 * 2 ** ((midi - 69) / 12);
  const pts = [];
  for (let h = 1; h <= 10; h++) {
    const k0 = Math.floor((h * f0 * 2 ** (-40 / 1200)) / df);
    const k1 = Math.ceil((h * f0 * 2 ** (60 / 1200)) / df);
    let best = k0;
    for (let k = k0; k <= k1; k++) if (mag(k) > mag(best)) best = k;
    const A = Math.log(mag(best - 1)), Bm = Math.log(mag(best)), C = Math.log(mag(best + 1));
    const sh = (0.5 * (A - C)) / (A - 2 * Bm + C);
    const fl = [];
    for (let k = Math.floor(best * 0.85); k < best * 1.15; k += 7) fl.push(mag(k));
    const snr = 20 * Math.log10(mag(best) / pct(fl, 0.5));
    if (snr > 15) pts.push({ h, f: (best + sh) * df, sigma: (best + sh) * df * 1e-5, snr });
  }
  const top = Math.max(...pts.map((p) => p.snr));
  for (const p of pts) p.rel = top - p.snr;
  return stiffFit(pts, f0 < 160 ? 5e-5 : f0 < 280 ? 9e-5 : 1.4e-4, 1.2e-4).f1;
}

// The scenes: 0.6 s of the room, then the note.
function biquadHP(x, f, q = Math.SQRT1_2) {
  const w = (2 * Math.PI * f) / SR;
  const al = Math.sin(w) / (2 * q);
  const c = Math.cos(w);
  const a0 = 1 + al, a1 = -2 * c, a2 = 1 - al, b0 = (1 + c) / 2, b1 = -(1 + c);
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = (b0 * x[i] + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}
function scene(clip, { phone = 0, levelDb = null, noiseDb = -85 }) {
  const pre = Math.round(0.6 * SR);
  let x = new Float32Array(pre + clip.length);
  x.set(clip, pre);
  if (phone) x = biquadHP(biquadHP(x, phone), phone * 0.6, 0.5); // a phone's mic: steep below ~150 Hz
  if (levelDb != null) {
    let pk = 0;
    for (const v of x) pk = Math.max(pk, Math.abs(v));
    const g = dbToLin(levelDb) / pk;
    for (let i = 0; i < x.length; i++) x[i] *= g;
  }
  // Room noise, mostly low (a fan, traffic) with some hiss: hiss through two one-pole lowpasses.
  const nz = new Float32Array(x.length);
  let y1 = 0, y2 = 0, s = 0;
  const k1 = Math.exp((-2 * Math.PI * 300) / SR), k2 = Math.exp((-2 * Math.PI * 2000) / SR);
  for (let i = 0; i < x.length; i++) { const g = gauss(); y1 = k1 * y1 + (1 - k1) * g; y2 = k2 * y2 + (1 - k2) * g; nz[i] = 6 * y1 + 1.5 * y2 + 0.15 * g; s += nz[i] * nz[i]; }
  const a = dbToLin(noiseDb) / Math.sqrt(s / x.length);
  for (let i = 0; i < x.length; i++) x[i] += a * nz[i];
  return { x, onset: 0.6 };
}

// The engine fed as the Tuner page feeds it: the latest 32768 samples every 30 ms.
function tuner(x) {
  const e = new TunerEngine({ sampleRate: SR });
  e.setPrior({ strings: [40, 45, 50, 55, 59, 64] });
  const out = [];
  for (let i = 1440; i <= x.length; i += 1440) {
    const r = e.process(x.subarray(Math.max(0, i - 32768), i), i / SR);
    if (r.freq != null) out.push({ t: i / SR, freq: r.freq });
  }
  return out;
}

const SCENES = [
  ['line input', { noiseDb: -85 }],
  ['phone mic, close', { phone: 150, levelDb: -12, noiseDb: -70 }],
  ['phone mic, across the room', { phone: 150, levelDb: -30, noiseDb: -62 }],
  ['unplugged electric (a few dB over the room)', { phone: 200, levelDb: -42, noiseDb: -58 }],
];

for (const [kind, note, midi] of CLIPS) {
  const clip = load(kind, note);
  const ref = reference(clip, midi);
  console.log(`${kind} ${note}: reference ${ref.toFixed(3)} Hz (${cents(ref, 440 * 2 ** ((midi - 69) / 12)).toFixed(1)}¢ from ${note})`);
  for (const [name, opts] of SCENES) {
    seed = 5 + midi;
    const { x, onset } = scene(clip, opts);
    const out = tuner(x);
    const quiet = name.startsWith('unplugged');
    const win = out.filter((o) => o.t >= onset + 0.4 && o.t <= onset + 2.2);
    const c = win.map((o) => cents(o.freq, ref));
    const wrong = c.filter((v) => Math.abs(v) > 40).length;
    const first = out.find((o) => o.t > onset && Math.abs(cents(o.freq, ref)) < 10);
    const cover = win.length / (1.8 / 0.03);
    const med = pct(c, 0.5);
    // The needle's jitter: each reading against the median of its ±150 ms neighbours.
    const dev = win.map((o) => { const nb = win.filter((q) => Math.abs(q.t - o.t) <= 0.15).map((q) => cents(q.freq, ref)); return Math.abs(cents(o.freq, ref) - pct(nb, 0.5)); });
    const jit = pct(dev, 0.9);
    console.log(`  ${name}: ${(cover * 100).toFixed(0)}% of the time, first after ${first ? (first.t - onset).toFixed(2) : '-'} s, median ${Number.isFinite(med) ? med.toFixed(2) : '-'}¢, jitter ${Number.isFinite(jit) ? jit.toFixed(2) : '-'}¢`);
    check(wrong === 0, `${kind} ${note}, ${name}: ${wrong} readings of the wrong note`);
    if (quiet) {
      // The hard case: it has to be heard, and right when it is.
      check(first && first.t - onset < 0.5, `${kind} ${note}, ${name}: first reading ${first ? (first.t - onset).toFixed(2) : 'never'}`);
      check(cover >= 0.25, `${kind} ${note}, ${name}: shown ${(cover * 100).toFixed(0)}% of the time`);
      check(Math.abs(med) < 3, `${kind} ${note}, ${name}: median ${med.toFixed(2)}¢ off`);
    } else {
      check(first && first.t - onset < 0.35, `${kind} ${note}, ${name}: first reading ${first ? (first.t - onset).toFixed(2) : 'never'}`);
      check(cover >= 0.8, `${kind} ${note}, ${name}: shown ${(cover * 100).toFixed(0)}% of the time`);
      check(Math.abs(med) < 2, `${kind} ${note}, ${name}: median ${med.toFixed(2)}¢ off`);
      check(jit < 0.6, `${kind} ${note}, ${name}: jitter ${jit.toFixed(2)}¢`);
    }
  }
}

if (failures) { console.log(`\n${failures} failure(s)`); process.exit(1); }
console.log('\nAll real-guitar tests passed.');
