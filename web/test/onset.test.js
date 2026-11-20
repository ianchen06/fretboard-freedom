// Tests the onset (pick-attack) detector against synthetic guitar audio with known attack times.
// Run: node web/test/onset.test.js
'use strict';
const { OnsetDetector } = require('../js/onset.js');

const SR = 48000;
const BLOCK = 128;
let failures = 0;
const check = (ok, msg) => { if (!ok) { failures++; console.log('  FAIL', msg); } };

let seed = 4242;
const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff * 2 - 1; };
const midiToFreq = (m) => 440 * 2 ** ((m - 69) / 12);

// A plucked string: partials shaped by pick position. Losses grow with frequency, as in a real
// string: the bright attack fades within tens of ms and the body rings on. `decay` scales it all
// (a palm mute ≈ 10). The pick itself adds a couple of ms of bright noise.
function pluck(buf, start, midi, { amp = 0.25, dur = 1.5, decay = 1, bright = 1 } = {}) {
  const f0 = midiToFreq(midi);
  const n0 = Math.round(start * SR);
  const len = Math.min(buf.length - n0, Math.floor(dur * SR));
  for (let n = 1; n * f0 < 7000 && n <= 30; n++) {
    const fn = n * f0;
    const a = (Math.abs(Math.sin(n * Math.PI * 0.18)) / n) * (n > 4 ? bright : 1);
    const dk = (0.8 + 4 * (fn / 1000) ** 2) * decay;
    const ph = rand() * Math.PI;
    const fade = 0.02 * SR; // let the note die away at the end rather than cut off with a click
    for (let i = 0; i < len; i++) {
      const t = i / SR;
      buf[n0 + i] += amp * a * Math.min(1, t / 0.002, (len - i) / fade) * Math.exp(-dk * t) * Math.sin(2 * Math.PI * fn * t + ph);
    }
  }
  for (let i = 0; i < 0.006 * SR && n0 + i < buf.length; i++) buf[n0 + i] += amp * 0.25 * rand() * Math.exp(-i / (0.002 * SR));
}

const E_MAJOR = [40, 47, 52, 56, 59, 64];
// Strings for strumming: each string's buffer, so picking a string again stops what it was playing,
// as a real pick does. Mix them into `buf` with mixStrings() when done.
const strings = (len) => Array.from({ length: 6 }, () => new Float32Array(len));
function mixStrings(buf, strs) { for (const s of strs) for (let i = 0; i < buf.length; i++) buf[i] += s[i]; }
// A strum: the strings one after another, `spread` s apart (down = low to high, up = high to low).
// `choke`: the pick damps each string as it passes (a real strum); off, the old note keeps ringing.
function strum(strs, start, { up = false, spread = 0.006, amp = 0.16, chord = E_MAJOR, choke = true } = {}) {
  const order = chord.map((m, s) => [m, s]);
  if (up) order.reverse();
  order.forEach(([m, s], j) => {
    const t = start + j * spread;
    const buf = strs[s];
    if (choke) {
      const n0 = Math.round(t * SR);
      const fade = Math.round(0.001 * SR);
      for (let i = n0; i < buf.length; i++) buf[i] *= i - n0 < fade ? 1 - (i - n0) / fade : 0;
    }
    pluck(buf, t, m, { amp, dur: 1.2 });
  });
}

function chuck(buf, start, amp = 0.2) {
  const n0 = Math.round(start * SR);
  for (let i = 0; i < 0.02 * SR; i++) buf[n0 + i] += amp * rand() * Math.exp(-i / (0.004 * SR));
}

function click(buf, start, amp = 0.4) {
  const n0 = Math.round(start * SR);
  for (let i = 0; i < 0.03 * SR; i++) buf[n0 + i] += amp * rand() * Math.exp(-i / (0.005 * SR));
}

const hiss = (buf, dbfs) => { const a = 10 ** (dbfs / 20); for (let i = 0; i < buf.length; i++) buf[i] += a * rand(); };
const drive = (buf, gain) => { for (let i = 0; i < buf.length; i++) buf[i] = Math.tanh(gain * buf[i]) * 0.5; };

function detect(buf, opts = {}) {
  const det = new OnsetDetector({ sampleRate: SR, gateDb: -50, ...opts });
  const start = 96000; // the context has been running a while: times must still line up
  const out = [];
  for (let i = 0; i + BLOCK <= buf.length; i += BLOCK) out.push(...det.process(buf.subarray(i, i + BLOCK), start + i));
  return out.map((o) => ({ ...o, t: o.t - start / SR }));
}

// Pair each expected time with a detected one; report misses, extras and the timing error.
function score(name, found, expected, { tol = 0.004, spreadTol = 0.0025, p90Tol = null, maxMissed = 0, maxExtra = 0 } = {}) {
  const errs = [];
  let missed = 0;
  const used = new Set();
  for (const t of expected) {
    let best = -1;
    for (let i = 0; i < found.length; i++) if (!used.has(i) && Math.abs(found[i].t - t) < 0.03 && (best < 0 || Math.abs(found[i].t - t) < Math.abs(found[best].t - t))) best = i;
    if (best < 0) { missed++; continue; }
    used.add(best);
    errs.push(found[best].t - t);
  }
  const extras = found.length - used.size;
  const sorted = [...errs].sort((a, b) => a - b);
  const med = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
  const dev = errs.map((e) => Math.abs(e - med)).sort((a, b) => a - b);
  const worst = dev.length ? dev[dev.length - 1] : 0;
  const p90 = dev.length ? dev[Math.floor(0.9 * (dev.length - 1))] : 0;
  console.log(`  ${name}: ${expected.length - missed}/${expected.length} found, ${extras} extra, median ${(med * 1000).toFixed(1)} ms, 90% within ${(p90 * 1000).toFixed(1)} ms, worst ${(worst * 1000).toFixed(1)} ms`);
  check(missed <= maxMissed, `${name}: missed ${missed}`);
  check(extras <= maxExtra, `${name}: ${extras} extra onsets`);
  check(Math.abs(med) <= tol, `${name}: median error ${(med * 1000).toFixed(1)} ms`);
  if (p90Tol != null) check(p90 <= p90Tol, `${name}: 90% jitter ${(p90 * 1000).toFixed(1)} ms`);
  else check(worst <= spreadTol, `${name}: jitter ${(worst * 1000).toFixed(1)} ms`);
  return { errs, med };
}

// Slightly human times on a grid: `jitter` s either way, deterministic.
const grid = (n, step, t0 = 0.5, jitter = 0.012) => Array.from({ length: n }, (_, i) => t0 + i * step + jitter * rand());

console.log('Single notes, quarter notes at 100 bpm (mic-ish, hiss at −62 dB)');
{
  const times = grid(16, 0.6);
  const buf = new Float32Array(SR * 11);
  times.forEach((t, i) => pluck(buf, t, [45, 52, 57, 60][i % 4]));
  hiss(buf, -62);
  score('notes', detect(buf), times);
}

console.log('Strummed E chord, 8ths at 120 bpm, down and up');
{
  const times = grid(24, 0.25, 0.5, 0.01);
  const buf = new Float32Array(SR * 7);
  const strs = strings(buf.length);
  times.forEach((t, i) => strum(strs, t, { up: i % 2 === 1 }));
  mixStrings(buf, strs);
  hiss(buf, -64);
  score('strums', detect(buf), times, { p90Tol: 0.006 });
}

console.log('Stress: strums that don\'t damp the strings (each new strum adds to the ringing chord)');
{
  const times = grid(24, 0.25, 0.5, 0.01);
  const buf = new Float32Array(SR * 7);
  const strs = strings(buf.length);
  times.forEach((t, i) => strum(strs, t, { up: i % 2 === 1, choke: false, amp: 0.1 }));
  mixStrings(buf, strs);
  hiss(buf, -64);
  score('ringing strums', detect(buf), times, { tol: 0.005, p90Tol: 0.02, maxExtra: 1 });
}

console.log('Distorted strums (high-gain amp: everything squashed to one level)');
{
  const times = grid(24, 0.25, 0.5, 0.01);
  const buf = new Float32Array(SR * 7);
  const strs = strings(buf.length);
  times.forEach((t, i) => strum(strs, t, { up: i % 2 === 1, amp: 0.1 }));
  mixStrings(buf, strs);
  drive(buf, 12);
  hiss(buf, -60);
  score('distorted strums', detect(buf), times, { tol: 0.005, p90Tol: 0.008, maxMissed: 1 });
}

console.log('Palm-muted 16th chugs on low E at 140 bpm, distorted');
{
  const times = grid(32, 60 / 140 / 4, 0.5, 0.006);
  const buf = new Float32Array(SR * 5);
  times.forEach((t) => pluck(buf, t, 40, { decay: 10, bright: 0.5, amp: 0.3, dur: 0.3 }));
  drive(buf, 10);
  hiss(buf, -60);
  score('chugs', detect(buf, { refractory: 0.04 }), times);
}

console.log('Gallops at 160 bpm (8th + two 16ths)');
{
  const s = 60 / 160 / 4;
  const times = [];
  for (let b = 0; b < 12; b++) times.push(0.5 + b * 4 * s, 0.5 + (b * 4 + 2) * s, 0.5 + (b * 4 + 3) * s);
  const buf = new Float32Array(SR * 6);
  times.forEach((t) => pluck(buf, t, 40, { decay: 9, bright: 0.6, amp: 0.3, dur: 0.3 }));
  drive(buf, 8);
  score('gallops', detect(buf, { refractory: 0.04 }), times);
}

console.log('Muted chucks between strums (funk)');
{
  const times = grid(16, 0.3, 0.5, 0.008);
  const buf = new Float32Array(SR * 6);
  const strs = strings(buf.length);
  times.forEach((t, i) => (i % 4 === 2 ? chuck(strs[0], t) : strum(strs, t, { up: i % 2 === 1 })));
  mixStrings(buf, strs);
  score('chucks', detect(buf), times, { p90Tol: 0.006 });
}

console.log('Metronome click through speakers into the mic (loopback calibration)');
{
  const times = Array.from({ length: 8 }, (_, i) => 0.4 + i * 0.5);
  const buf = new Float32Array(SR * 5);
  times.forEach((t) => click(buf, t, 0.3));
  hiss(buf, -58);
  score('clicks', detect(buf), times, { tol: 0.003, spreadTol: 0.0015 });
}

console.log('Room noise only: nothing should count');
{
  const buf = new Float32Array(SR * 4);
  hiss(buf, -56);
  const found = detect(buf);
  console.log(`  noise: ${found.length} onsets`);
  check(found.length === 0, `noise triggered ${found.length} onsets`);
}

console.log('A slowly swelling note (volume knob) is not an attack');
{
  const buf = new Float32Array(SR * 3);
  const f = midiToFreq(57);
  for (let i = 0; i < buf.length; i++) { const t = i / SR; buf[i] = 0.2 * Math.min(1, t / 1.5) * Math.sin(2 * Math.PI * f * t); }
  const found = detect(buf).filter((o) => o.t > 0.15); // the very first sound out of silence may count
  console.log(`  swell: ${found.length} onsets after the start`);
  check(found.length === 0, `swell triggered ${found.length} onsets`);
}

console.log('Accents: a strum 4 dB louder reads at least 2.5 dB higher, and the soft ones still count');
{
  const times = grid(16, 0.25, 0.5, 0);
  const buf = new Float32Array(SR * 5);
  const strs = strings(buf.length);
  times.forEach((t, i) => strum(strs, t, { amp: i % 4 === 0 ? 0.19 : 0.12 }));
  mixStrings(buf, strs);
  const found = detect(buf);
  const acc = found.filter((o, i) => i % 4 === 0).map((o) => o.db);
  const rest = found.filter((o, i) => i % 4 !== 0).map((o) => o.db);
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const diff = mean(acc) - mean(rest);
  console.log(`  accent contrast ${diff.toFixed(1)} dB`);
  check(found.length === 16, `accents: found ${found.length} of 16`);
  check(diff >= 2.5, `accent contrast only ${diff.toFixed(1)} dB`);
}

console.log('A dropped block resets rather than mistiming');
{
  const det = new OnsetDetector({ sampleRate: SR });
  const buf = new Float32Array(SR);
  pluck(buf, 0.5, 52);
  let out = [];
  for (let i = 0; i + BLOCK <= buf.length; i += BLOCK) out.push(...det.process(buf.subarray(i, i + BLOCK), i < SR * 0.3 ? i : i + 512));
  check(out.length === 1 && Math.abs(out[0].t - (0.5 + 512 / SR)) < 0.004, `after a gap: ${JSON.stringify(out)}`);
}

if (failures) { console.log(`\n${failures} failure(s)`); process.exit(1); }
console.log('\nAll onset tests passed');
