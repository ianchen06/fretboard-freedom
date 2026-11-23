// Tests the Tuner's pitch engine (js/tunerengine.js) on synthetic sound run through the same chain
// as the Tuner page: the engine fed the latest 32768 samples (an AnalyserNode's) every 30 ms, its
// readings into TuneGuide.
//  - accuracy on realistic plucks with known truth: stiff strings, two polarizations beating, the
//    pitch glide after the pick, a weak fundamental through a phone's mic, a string ringing in sympathy;
//  - quiet strings (an unplugged electric) a few dB over the room's hiss, with no special mode;
//  - the noise filter: hum, a fan, talking and a held vowel never move the needle; a string still
//    tunes with them in the room, while its peg is turned, when another string is plucked;
//  - other sample rates, a chromatic tuner (no tuning), and the noise filter off.
// Run: node web/test/tunerengine.test.js
'use strict';
const { TunerEngine, stiffFit, Decimator } = require('../js/tunerengine.js');
const { TuneGuide } = require('../js/tuneguide.js');

let failures = 0;
const check = (ok, msg) => { if (!ok) { failures++; console.log('  FAIL', msg); } };
const cents = (f, ref) => 1200 * Math.log2(f / ref);
const dbToLin = (d) => 10 ** (d / 20);
let seed = 11;
// mulberry32: a linear congruential generator's noise has strong tones (its lattice), and this engine hears them.
const rand = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1; };
const gauss = () => { let s = 0; for (let i = 0; i < 6; i++) s += rand(); return s / Math.sqrt(2); };
const pct = (v, p) => { const s = v.slice().sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))] : NaN; };

// ---------- sounds ----------
// A realistic plucked string from `at` s, with partial 1 at f1 (the truth): stiffness B; two
// polarizations per partial a fraction of a cent apart, decaying at different rates (they beat);
// the pitch glide after the pick (`glide` cents sharp, relaxing over `tau` s); the pick's position;
// a phone's mic (a highpass at 150 Hz: the low E's fundamental ~10 dB down) or a line input; the
// pick's noise; optionally another string ringing in sympathy near partial k. peg: cents a second
// (the peg turned while it rings).
function string(n, at, f1, ampDb, { sr = 48000, B = 6e-5, glide = 8, tau = 0.15, pickPos = 0.18, mic = 'line', decay = 1, peg = 0, sympathetic = null } = {}) {
  const x = new Float32Array(n);
  const amp = dbToLin(ampDb);
  const i0 = Math.round(at * sr);
  const f0 = f1 / Math.sqrt(1 + B);
  for (let h = 1; h <= 30; h++) {
    const fh = h * f0 * Math.sqrt(1 + B * h * h);
    if (fh > Math.min(5500, sr * 0.45)) break;
    let a = Math.abs(Math.sin(h * Math.PI * pickPos)) / h;
    if (mic === 'phone') { const q = (fh / 150) ** 2; a *= q / Math.sqrt(1 + q * q); }
    a /= Math.sqrt(1 + (fh / 3000) ** 4);
    const d1 = decay * (0.6 + 0.35 * h);
    const d2 = d1 * (1.4 + 0.6 * Math.abs(rand()));
    const split = (0.3 + 0.7 * Math.abs(rand())) * (rand() < 0 ? -1 : 1);
    const a2 = 0.3 + 0.4 * Math.abs(rand());
    let p1 = Math.PI * rand();
    let p2 = Math.PI * rand();
    for (let i = i0; i < n; i++) {
      const t = (i - i0) / sr;
      const g = 2 ** ((glide * Math.exp(-t / tau) + peg * t) / 1200);
      p1 += (2 * Math.PI * fh * g) / sr;
      p2 += (2 * Math.PI * fh * g * 2 ** (split / 1200)) / sr;
      x[i] += amp * a * (Math.exp(-d1 * t) * Math.sin(p1) + a2 * Math.exp(-d2 * t) * Math.sin(p2));
    }
  }
  for (let i = i0; i < Math.min(n, i0 + Math.round(0.008 * sr)); i++) x[i] += amp * 0.4 * rand() * Math.exp(-(i - i0) / (0.002 * sr));
  if (sympathetic) {
    const { k, c, level } = sympathetic;
    const fs = k * f0 * Math.sqrt(1 + B * k * k) * 2 ** (c / 1200);
    for (let i = i0; i < n; i++) { const t = (i - i0) / sr; x[i] += amp * level * (1 - Math.exp(-t / 0.2)) * Math.exp(-0.8 * t) * Math.sin((2 * Math.PI * fs * (i - i0)) / sr); }
  }
  return x;
}

// Talking: voiced syllables of 120-320 ms with gaps, each gliding (intonation), with vowel formants.
// flat: syllables that hold their pitch within ±1.5% (a held vowel, humming, singing a note).
function speech(n, ampDb, { flat = false, from = 0.1, lo = 95, hi = 230, sr = 48000 } = {}) {
  const x = new Float32Array(n);
  const amp = dbToLin(ampDb);
  const vowels = [[700, 1200, 2500], [300, 2300, 3000], [500, 900, 2400], [400, 2000, 2600], [600, 1700, 2500]];
  let i = Math.round(sr * from);
  while (i < n) {
    const len = Math.round(sr * (0.12 + 0.2 * Math.abs(rand())));
    const fa = lo + (hi - lo) * Math.abs(rand());
    const glide = flat ? 1 + 0.015 * rand() : 1 + 0.35 * rand();
    const V = vowels[Math.floor(Math.abs(rand()) * 5) % 5];
    const fm = fa * glide ** 0.5;
    const gains = [];
    for (let h = 1; h * fm * Math.max(1, glide) < 4000; h++) {
      const f = h * fm;
      let g = 1 / h ** 1.2;
      for (const F of V) g /= ((1 - (f / F) ** 2) ** 2 + ((f * 90) / (F * F)) ** 2) ** 0.25;
      gains.push(g);
    }
    let ph = 0;
    for (let j = 0; j < len && i + j < n; j++) {
      const u = j / len;
      ph += (2 * Math.PI * fa * glide ** u) / sr;
      let s = 0;
      for (let h = 1; h <= gains.length; h++) s += gains[h - 1] * Math.sin(h * ph);
      x[i + j] += amp * Math.sin(Math.PI * u) ** 2 * s * 0.3;
    }
    i += len + Math.round(sr * (0.03 + 0.12 * Math.abs(rand())));
  }
  return x;
}

// Mains hum (or a fridge, a transformer): a steady tone with a few harmonics, from `from` s.
function hum(n, f, ampDb, from = 0, sr = 48000) {
  const x = new Float32Array(n);
  const a = dbToLin(ampDb);
  for (let i = Math.round(from * sr); i < n; i++) {
    const p = (2 * Math.PI * f * i) / sr;
    x[i] = a * (Math.sin(p) + 0.5 * Math.sin(2 * p + 1) + 0.3 * Math.sin(3 * p + 2));
  }
  return x;
}

// Room noise: hiss, plus a fan (low rumble: hiss through a one-pole lowpass at ~200 Hz).
function room(n, db, fanDb = null, sr = 48000) {
  const x = new Float32Array(n);
  const a = dbToLin(db);
  const b = fanDb == null ? 0 : dbToLin(fanDb) * 4;
  const k = Math.exp((-2 * Math.PI * 200) / sr);
  let y = 0;
  for (let i = 0; i < n; i++) {
    y = k * y + (1 - k) * gauss();
    x[i] = a * gauss() + b * y;
  }
  return x;
}

const mix = (...xs) => { const y = new Float32Array(xs[0].length); for (const x of xs) for (let i = 0; i < y.length; i++) y[i] += x[i]; return y; };

// ---------- the Tuner's chain ----------
// Returns the readings the gauge would show: [{ t, freq, spread }] (and .done: the strings ticked).
const OPEN = { 1: 64, 2: 59, 3: 55, 4: 50, 5: 45, 6: 40 };
function tuner(x, { sr = 48000, noiseFilter = true, strings = Object.values(OPEN), pinned = null, open = null, holdTime = 0.6 } = {}) {
  const e = new TunerEngine({ sampleRate: sr, noiseFilter });
  e.setPrior({ strings, pinned });
  const guide = open ? new TuneGuide({ open, tolerance: 1, holdTime }) : null;
  const out = [];
  const hop = Math.round(sr * 0.03);
  for (let i = hop; i <= x.length; i += hop) {
    const t = i / sr;
    const r = e.process(x.subarray(Math.max(0, i - 32768), i), t);
    if (r.freq == null) continue;
    const o = { t, freq: r.freq, spread: r.spread };
    if (guide) o.g = guide.push({ freq: r.freq, spread: r.spread, t });
    out.push(o);
  }
  if (guide) out.done = guide.done;
  return out;
}

const STRINGS = [['low E', 82.41, 6, 4e-5], ['A', 110, 5, 5e-5], ['D', 146.83, 4, 6e-5], ['G', 196, 3, 1.5e-4], ['B', 246.94, 2, 1.2e-4], ['high e', 329.63, 1, 1e-4]];
const sr = 48000;
const N = sr * 6;
const NS = Math.round(sr * 3.5);

// How a plucked string reads: readings after `from` s, their median and worst error, and its ✓.
function judge(out, f0, s, from = 1.0) {
  const settled = out.filter((o) => o.t > from);
  const errs = settled.map((o) => Math.abs(cents(o.freq, f0)));
  return { n: settled.length, med: pct(errs, 0.5), p95: pct(errs, 0.95), worst: errs.length ? Math.max(...errs) : Infinity, tuned: out.done ? out.done.has(s) : null };
}

console.log('the stiff-string fit: the fundamental from the other partials, a stray partial ignored');
seed = 1001;
{
  const f0 = 82.3;
  const B = 3e-5;
  const pts = [];
  for (let h = 2; h <= 10; h++) pts.push({ h, f: h * f0 * Math.sqrt(1 + B * h * h) * (h === 3 ? 2 ** (4 / 1200) : 1), sigma: 0.01 });
  const r = stiffFit(pts, 5e-5, 1.2e-4);
  check(r && Math.abs(cents(r.f1, f0 * Math.sqrt(1 + B))) < 0.1, `no fundamental, partial 3 off by 4¢: ${r && cents(r.f1, f0 * Math.sqrt(1 + B)).toFixed(3)}¢`);
  check(r && !r.used.includes(3), 'partial 3 left out');
}

console.log('decimation: overlapping snapshots, filtered incrementally, match the whole');
seed = 1002;
{
  const d1 = new Decimator(sr);
  const d2 = new Decimator(sr);
  const x = room(sr * 2, -20);
  const a = new Float32Array(7920);
  const b = new Float32Array(7920);
  let worst = 0;
  for (let i = 1300; i <= x.length; i += 1300 + Math.round(200 * rand())) {
    const snap = x.subarray(Math.max(0, i - 32768), i);
    const n = d1.feed(snap, a.length, a, 1400);
    const ref = snap.subarray(0, snap.length - d1.lag);
    const m = Math.min(n, d2.outLength(ref.length));
    d2.run(ref, m, b);
    for (let k = 0; k < m; k++) worst = Math.max(worst, Math.abs(a[n - m + k] - b[k]));
  }
  check(worst === 0, `incremental vs whole: ${worst}`);
}

console.log('accuracy: realistic plucks, a line input and a phone mic');
seed = 1003;
for (const mic of ['line', 'phone']) {
  const errs = [];
  let wrong = 0, short = 0, slow = 0;
  for (const [name, f, s, B] of STRINGS) {
    for (const off of [-23, -4.5, 0.7, 11]) {
      const f1 = f * 2 ** (off / 1200);
      const x = mix(room(NS, mic === 'phone' ? -66 : -80), string(NS, 0.5, f1, -14, { B: B * (0.7 + 0.6 * Math.abs(rand())), glide: 4 + 10 * Math.abs(rand()), tau: 0.08 + 0.15 * Math.abs(rand()), pickPos: 0.1 + 0.15 * Math.abs(rand()), mic, sympathetic: off === 0.7 ? { k: 3, c: 2.5, level: 0.04 } : null }));
      const out = tuner(x);
      const win = out.filter((o) => o.t > 1.1 && o.t < 2.5);
      const e = win.map((o) => cents(o.freq, f1));
      wrong += e.filter((v) => Math.abs(v) > 40).length;
      if (win.length < 0.95 * (1.4 / 0.03)) short++;
      const first = out.find((o) => Math.abs(cents(o.freq, f1)) < 5);
      if (!first || first.t - 0.5 > 0.4) { slow++; console.log(`    slow: ${mic} ${name} ${off}¢: ${first ? (first.t - 0.5).toFixed(2) : "never"} s`); }
      for (const v of e) errs.push(Math.abs(v));
      if (e.length && pct(e.map(Math.abs), 0.95) > 1.2) console.log(`    ${mic} ${name} ${off}¢: p95 ${pct(e.map(Math.abs), 0.95).toFixed(2)}¢`);
    }
  }
  console.log(`  ${mic}: |error| median ${pct(errs, 0.5).toFixed(2)}¢, p95 ${pct(errs, 0.95).toFixed(2)}¢`);
  check(pct(errs, 0.5) < 0.3, `${mic}: median error ${pct(errs, 0.5).toFixed(2)}¢`);
  check(pct(errs, 0.95) < 1, `${mic}: p95 error ${pct(errs, 0.95).toFixed(2)}¢`);
  check(wrong === 0, `${mic}: ${wrong} readings of the wrong note`);
  check(short === 0, `${mic}: ${short} takes with readings missing`);
  check(slow === 0, `${mic}: ${slow} takes slower than 0.4 s to the first reading within 5¢ (a hard pick starts up to ~15¢ sharp)`);
}

console.log('quiet strings (an unplugged electric), a few dB over the hiss, no special mode');
seed = 1004;
for (const [name, f, s, B] of STRINGS) {
  // The string's level (RMS while it rings) is about the hiss's.
  const x = mix(room(N, -58), string(N, 0.5, f, -42, { B, mic: 'phone', decay: 0.7 }));
  const out = tuner(x, { open: OPEN });
  const j = judge(out, f, s);
  check(j.n >= 25 && j.med < 0.5 && j.p95 < 2, `${name}: ${j.n} readings, median ${j.med.toFixed(2)}¢, p95 ${j.p95.toFixed(2)}¢`);
  check(j.tuned, `${name} quiet: never got its ✓`);
}

console.log('noise alone: nothing on the gauge');
seed = 1005;
{
  const cases = [
    ['hiss', () => room(N, -50)],
    ['60 Hz mains hum', () => mix(room(N, -75), hum(N, 60, -45))],
    ['100 Hz hum', () => mix(room(N, -75), hum(N, 100, -45))],
    ['120 Hz hum', () => mix(room(N, -75), hum(N, 120, -40))],
    ['hum switching on mid-take', () => mix(room(N, -75), hum(N, 120, -40, 2))],
    ['a fan', () => room(N, -70, -40)],
    ['talking', () => mix(room(N, -75), speech(N, -30))],
    ['talking, close and loud', () => mix(room(N, -75), speech(N, -18))],
    ['a held vowel, humming', () => mix(room(N, -75), speech(N, -30, { flat: true }))],
    ['a low voice', () => mix(room(N, -75), speech(N, -30, { lo: 75, hi: 130 }))],
    ['quiet: hum', () => mix(room(N, -62), hum(N, 120, -55))],
    ['quiet: talking', () => mix(room(N, -62), speech(N, -45))],
  ];
  for (const [name, make] of cases) {
    const x = make();
    const before = tuner(x, { noiseFilter: false }).length;
    const after = tuner(x);
    // A hum that switches on (an attack, a steady pitch) gets through until it's clearly not fading.
    const allowed = name.includes('switching') ? 1.6 : 0;
    const span = after.length ? after[after.length - 1].t - after[0].t : 0;
    console.log(`  ${name}: ${before} readings without the filter, ${after.length} with it${after.length ? ` (over ${span.toFixed(2)} s)` : ''}`);
    check(allowed ? span <= allowed && after.every((o) => o.t < 2 + allowed + 0.2) : after.length === 0, `${name}: ${after.length} readings got through`);
  }
}

console.log('a plucked string still reads, and gets its ✓');
seed = 1006;
for (const [name, f, s, B] of STRINGS) {
  const scenes = [
    ['quiet room', mix(room(NS, -70), string(NS, 0.5, f, -26, { B }))],
    ['someone talking', mix(room(NS, -70), string(NS, 0.5, f, -26, { B }), speech(NS, -40, { from: 0.9 }))],
    ['120 Hz hum', mix(room(NS, -70), hum(NS, 120, -48), string(NS, 0.5, f, -26, { B }))],
    ['a fan', mix(room(NS, -72, -48), string(NS, 0.5, f, -26, { B }))],
  ];
  for (const [scene, x] of scenes) {
    const out = tuner(x, { open: OPEN });
    const j = judge(out, f, s);
    const first = out.length ? out[0].t - 0.5 : Infinity;
    check(first < 0.3, `${name}, ${scene}: first reading ${first.toFixed(2)} s after the pick`);
    check(j.n >= 40, `${name}, ${scene}: ${j.n} readings`);
    check(j.med < 0.5, `${name}, ${scene}: median error ${j.med.toFixed(3)}¢`);
    check(j.worst < 3, `${name}, ${scene}: worst reading ${j.worst.toFixed(2)}¢ off`);
    check(j.tuned, `${name}, ${scene}: never got its ✓`);
  }
}

console.log('talking over a ringing string: no wrong readings');
seed = 1007;
{
  let wrong = 0;
  for (const [, f, , B] of STRINGS) {
    for (const db of [-27, -30, -36]) {
      // (A string that rings as long as the old noise-filter test's; the first 0.25 s is its pitch glide.)
      const x = mix(room(N, -70), string(N, 0.5, f, -26, { B, decay: 0.55 }), speech(N, db, { from: 0.9 }), speech(N, db - 6, { from: 1.3, lo: 160, hi: 300 }));
      wrong += tuner(x).filter((o) => o.t > 0.75 && Math.abs(cents(o.freq, f)) > 5).length;
    }
  }
  check(wrong === 0, `${wrong} readings more than 5¢ off`);
}

console.log('turning the peg while the string rings: the reading follows');
seed = 1008;
for (const peg of [60, -120, 250]) {
  const f = 110;
  const out = tuner(mix(room(N, -70), string(N, 0.5, f, -20, { peg, decay: 0.6, glide: 0 })));
  const late = out.filter((o) => o.t > 1.5 && o.t < 3);
  const lag = late.map((o) => Math.abs(cents(o.freq, f) - peg * (o.t - 0.5))).sort((a, b) => a - b);
  check(late.length >= 40, `peg ${peg}¢/s: ${late.length} readings between 1.5 and 3 s`);
  // Within ~0.1 s of the string (the needle keeps up with the peg).
  check(pct(lag, 0.5) < Math.max(2, Math.abs(peg) * 0.1), `peg ${peg}¢/s: the reading is ${pct(lag, 0.5).toFixed(1)}¢ behind`);
}

console.log('a new pick on another string switches over');
seed = 1009;
{
  const x = mix(room(N, -70), string(N, 0.5, 110, -26), string(N, 2.5, 146.83, -26));
  const out = tuner(x);
  const a = out.filter((o) => o.t > 1 && o.t < 2.45);
  const d = out.filter((o) => o.t > 3);
  check(a.length > 30 && a.every((o) => Math.abs(cents(o.freq, 110)) < 1.5), 'the A reads before the second pick');
  check(d.length > 30 && d.every((o) => Math.abs(cents(o.freq, 146.83)) < 1.5), `the D reads after it (${d.length} readings)`);
  const first = out.find((o) => o.t > 2.5 && Math.abs(cents(o.freq, 146.83)) < 5); // (it starts a few cents sharp: the glide)
  check(first && first.t - 2.5 < 0.35, `the D shows ${first ? (first.t - 2.5).toFixed(2) : 'never'} s after its pick`);
}

console.log('the low E, plucked while the high e (two octaves up) still rings, takes over');
seed = 1010;
{
  const x = mix(room(N, -70), string(N, 0.5, 329.63, -26), string(N, 2, 82.41, -26));
  const out = tuner(x, { open: OPEN });
  const e = out.find((o) => o.t > 2 && Math.abs(cents(o.freq, 82.41)) < 2);
  check(e && e.t - 2 < 0.4, `the low E shows ${e ? (e.t - 2).toFixed(2) : 'never'} s after its pick`);
  check(out.done.has(6), 'and gets its ✓');
}

console.log('the high e, plucked while the low E (two octaves down) still rings, takes over');
seed = 1011;
{
  const x = mix(room(N, -70), string(N, 0.5, 82.41, -22, { decay: 0.5 }), string(N, 2, 329.63, -26));
  const out = tuner(x, { open: OPEN });
  const e = out.find((o) => o.t > 2 && Math.abs(cents(o.freq, 329.63)) < 2);
  check(e && e.t - 2 < 0.4, `the high e shows ${e ? (e.t - 2).toFixed(2) : 'never'} s after its pick`);
  check(out.done.has(1), 'and gets its ✓');
}

console.log('a string that rings for seconds (a wound low E) isn\'t taken for a hum');
seed = 1012;
{
  const NL = sr * 9;
  for (const [name, f, s] of [['low E', 82.41, 6], ['A', 110, 5]]) {
    const first = string(NL, 0.5, f, -24, { decay: 0.12 });
    for (let i = Math.round(4.5 * sr); i < NL; i++) first[i] = 0;
    const out = tuner(mix(room(NL, -70), first, string(NL, 4.6, f, -24, { decay: 0.12 })), { open: OPEN });
    const on = (a, b) => out.filter((o) => o.t > a && o.t < b && Math.abs(cents(o.freq, f)) < 2).length;
    check(on(2.5, 4.5) >= 60, `${name}: ${on(2.5, 4.5)} readings from 2.5 s to 4.5 s, while the first pluck still rings`);
    check(on(5.2, 9) >= 110, `${name}: ${on(5.2, 9)} readings after the second pluck`);
    check(out.done.has(s), `${name}: gets its ✓`);
  }
}

console.log('a hum that stops is forgotten: a string at its pitch reads again');
seed = 1013;
{
  const h = hum(N, 110, -40, 0.5);
  for (let i = Math.round(3 * sr); i < N; i++) h[i] = 0;
  const out = tuner(mix(room(N, -75), h, string(N, 4, 110, -44)), { open: OPEN });
  check(out.filter((o) => o.t > 2.2 && o.t < 3).length === 0, 'the hum is dropped');
  check(out.done.has(5), 'the A, plucked no louder than the hum was, gets its ✓');
}

console.log('a hum that was there first doesn\'t block a string at the same pitch');
seed = 1014;
{
  const x = mix(room(N, -70), hum(N, 110, -45), string(N, 1, 110, -24));
  const out = tuner(x, { open: OPEN });
  check(out.filter((o) => o.t < 1).length === 0, 'the hum alone gives nothing');
  check(out.done.has(5), 'the A, plucked over a hum at its pitch, gets its ✓');
}

console.log('the noise filter off: a steady tone with no pick (a bowed string, an e-bow) reads');
seed = 1015;
{
  const x = mix(room(N, -70), hum(N, 196 * 2 ** (3 / 1200), -30, 0.5));
  const out = tuner(x, { noiseFilter: false });
  const late = out.filter((o) => o.t > 1.5);
  check(late.length > 100 && late.every((o) => Math.abs(cents(o.freq, 196) - 3) < 0.5), `${late.length} readings, ${late.length ? cents(late[late.length - 1].freq, 196).toFixed(2) : '-'}¢`);
}

console.log('other sample rates');
seed = 1016;
for (const rate of [44100, 96000, 22050]) {
  for (const [name, f, , B] of [STRINGS[0], STRINGS[5]]) {
    const n = rate * 3;
    const out = tuner(mix(room(n, -70, null, rate), string(n, 0.5, f, -26, { B, sr: rate })), { sr: rate });
    const j = judge(out, f, 0);
    check(j.n >= 40 && j.med < 0.5 && j.worst < 3, `${rate} Hz, ${name}: ${j.n} readings, median ${j.med.toFixed(2)}¢, worst ${j.worst.toFixed(2)}¢`);
  }
}

console.log('a chromatic tuner (no tuning): notes across the neck');
seed = 1017;
for (const midi of [38, 43, 52, 57, 62, 67, 71, 76, 81, 86]) {
  const f = 440 * 2 ** ((midi - 69) / 12);
  const out = tuner(mix(room(NS, -70), string(NS, 0.5, f, -26, { B: 1e-4 })), { strings: null });
  const j = judge(out, f, 0);
  check(j.n >= 30 && j.med < 0.5 && j.worst < 3, `MIDI ${midi} (${f.toFixed(1)} Hz): ${j.n} readings, median ${j.med.toFixed(2)}¢, worst ${j.worst.toFixed(2)}¢`);
}

console.log('cost');
seed = 1018;
{
  const x = mix(room(NS, -70), string(NS, 0.5, 82.41, -26));
  const t0 = process.hrtime.bigint();
  tuner(x);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6 / Math.floor(NS / 1440);
  console.log(`  ${ms.toFixed(2)} ms per reading (30 a second)`);
  check(ms < 5, `${ms.toFixed(2)} ms per reading`);
}

if (failures) { console.log(`\n${failures} failure(s)`); process.exit(1); }
console.log('\nAll tuner-engine tests passed.');
seed = 1019;
