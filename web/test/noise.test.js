// Tests the Tuner's noise filter (Pitch.PluckGate): hum, a fan, people talking and a voice holding a
// note must not move the needle; a plucked string must still read to under a cent and get its ✓,
// with someone talking or a hum in the room, and while its peg is turned.
// Synthetic audio runs through the same chain as the Tuner page: NoteTracker on 2048-sample frames
// every 10 ms, refinePitch on every 3rd, then PluckGate, TunerFilter and TuneGuide.
// Run: node web/test/noise.test.js
'use strict';
const { NoteTracker, TunerFilter, PluckGate, refinePitch, linToDb, dbToLin, NORMAL, QUIET } = require('../js/pitch.js');
const { TuneGuide } = require('../js/tuneguide.js');

let failures = 0;
const check = (ok, msg) => { if (!ok) { failures++; console.log('  FAIL', msg); } };
const sr = 48000;
let seed = 11;
const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff * 2 - 1; };
const gauss = () => { let s = 0; for (let i = 0; i < 6; i++) s += rand(); return s / Math.sqrt(2); };
const cents = (f, ref) => 1200 * Math.log2(f / ref);

// ---------- sounds ----------
// A plucked string from `at` s; glide: cents a second (a peg turned while it rings).
function pluck(n, at, f0, ampDb, { glide = 0, decay = 1 } = {}) {
  const x = new Float32Array(n);
  const amp = dbToLin(ampDb);
  const i0 = Math.round(at * sr);
  for (let h = 1; h <= 15 && h * f0 < 5000; h++) {
    const w = Math.abs(Math.sin(h * Math.PI * 0.2)) / h;
    let ph = h;
    for (let i = i0; i < n; i++) {
      const t = (i - i0) / sr;
      ph += (2 * Math.PI * h * f0 * 2 ** ((glide * t) / 1200)) / sr;
      x[i] += amp * 2.2 * w * Math.exp(-decay * (0.5 + 0.25 * h) * t) * Math.sin(ph);
    }
  }
  return x;
}

// Talking: voiced syllables of 120-320 ms with gaps, each gliding (intonation), with vowel formants.
// flat: syllables that hold their pitch within ±1.5% (a held vowel, humming, singing a note).
function speech(n, ampDb, { flat = false, from = 0.1, lo = 95, hi = 230 } = {}) {
  const x = new Float32Array(n);
  const amp = dbToLin(ampDb);
  const vowels = [[700, 1200, 2500], [300, 2300, 3000], [500, 900, 2400], [400, 2000, 2600], [600, 1700, 2500]];
  let i = Math.round(sr * from);
  while (i < n) {
    const len = Math.round(sr * (0.12 + 0.2 * Math.abs(rand())));
    const fa = lo + (hi - lo) * Math.abs(rand());
    const glide = flat ? 1 + 0.015 * rand() : 1 + 0.35 * rand();
    const V = vowels[Math.floor(Math.abs(rand()) * 5) % 5];
    // Harmonic levels: a falling source through the vowel's formants (at the syllable's middle pitch).
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
function hum(n, f, ampDb, from = 0) {
  const x = new Float32Array(n);
  const a = dbToLin(ampDb);
  for (let i = Math.round(from * sr); i < n; i++) {
    const p = (2 * Math.PI * f * i) / sr;
    x[i] = a * (Math.sin(p) + 0.5 * Math.sin(2 * p + 1) + 0.3 * Math.sin(3 * p + 2));
  }
  return x;
}

// Room noise: hiss, plus a fan (low rumble: hiss through a one-pole lowpass at ~200 Hz).
function room(n, db, fanDb = null) {
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

function biquad(type, f, q = Math.SQRT1_2) {
  const w = (2 * Math.PI * f) / sr;
  const al = Math.sin(w) / (2 * q);
  const c = Math.cos(w);
  const a0 = 1 + al, a1 = -2 * c, a2 = 1 - al;
  const b0 = type === 'lowpass' ? (1 - c) / 2 : (1 + c) / 2;
  const b1 = type === 'lowpass' ? 1 - c : -(1 + c);
  return (x) => {
    const y = new Float32Array(x.length);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < x.length; i++) {
      const v = (b0 * x[i] + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2) / a0;
      x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
    }
    return y;
  };
}

// ---------- the Tuner's chain ----------
// Returns the readings the gauge would show: [{ t, freq, spread }]. gate: use the noise filter.
// gateDb: the note tracker's noise gate (the room's level + Auto-set's margin, measured before the take).
function tuner(x, { gate = true, quiet = false, gateDb = -58, open } = {}) {
  const p = quiet ? QUIET : NORMAL;
  if (quiet) {
    x = biquad('lowpass', QUIET.lowpass)(biquad('lowpass', QUIET.lowpass)(biquad('highpass', QUIET.highpass)(x)));
    const g = dbToLin(QUIET.boostDb);
    x = x.map((v) => v * g);
  }
  const frame = 2048;
  const hop = 480;
  const tuneN = 2 ** Math.ceil(Math.log2(sr * p.tuneSecs));
  const tr = new NoteTracker({ sampleRate: sr, frameSize: frame });
  tr.maxCmnd = p.maxCmnd;
  tr.setGateDb(gateDb);
  const pg = new PluckGate();
  const filt = new TunerFilter({ window: quiet ? QUIET.tunerWindow : 0.3 });
  const guide = open ? new TuneGuide({ open, tolerance: 1, holdTime: quiet ? QUIET.holdTime : 0.6 }) : null;
  const out = [];
  let tick = 0;
  for (let i = Math.max(frame, tuneN); i < x.length; i += hop) {
    const t = i / sr;
    const info = tr.process(x.subarray(i - frame, i), t);
    pg.frame(info);
    if (!info.freq || ++tick % 3) continue;
    const r = refinePitch(x.subarray(i - tuneN, i), sr, info.freq);
    if (!r || r.clarity <= p.clarity) continue;
    const reading = { t, freq: r.freq, attackT: tr.lastOnsetT, db: info.db };
    for (const q of gate ? pg.push(reading) : [reading]) {
      const fr = filt.push(q.freq, q.t, q.attackT, q.db);
      if (!fr) continue;
      const o = { t, freq: fr.freq, spread: fr.spread };
      if (guide) o.g = guide.push({ freq: fr.freq, spread: fr.spread, t });
      out.push(o);
    }
  }
  if (guide) out.done = guide.done;
  return out;
}

const STRINGS = [['low E', 82.41, 6], ['A', 110, 5], ['D', 146.83, 4], ['G', 196, 3], ['B', 246.94, 2], ['high e', 329.63, 1]];
const OPEN = { 1: 64, 2: 59, 3: 55, 4: 50, 5: 45, 6: 40 };
const N = sr * 6;
const NS = Math.round(sr * 3.5); // a single pluck

console.log('noise alone: nothing on the gauge');
{
  const cases = [
    ['60 Hz mains hum', () => mix(room(N, -75), hum(N, 60, -45))],
    ['100 Hz hum', () => mix(room(N, -75), hum(N, 100, -45))],
    ['120 Hz hum', () => mix(room(N, -75), hum(N, 120, -40))],
    ['hum switching on mid-take', () => mix(room(N, -75), hum(N, 120, -40, 2))],
    ['a fan', () => room(N, -70, -40)],
    ['talking', () => mix(room(N, -75), speech(N, -30))],
    ['talking, close and loud', () => mix(room(N, -75), speech(N, -18))],
    ['a held vowel, humming', () => mix(room(N, -75), speech(N, -30, { flat: true }))],
    ['a low voice', () => mix(room(N, -75), speech(N, -30, { lo: 75, hi: 130 }))],
  ];
  for (const [name, make] of cases) {
    const x = make();
    const before = tuner(x, { gate: false }).length;
    const after = tuner(x);
    // A hum that switches on (an attack, a steady pitch) gets through until it's clearly not fading.
    const allowed = name.includes('switching') ? 1.6 : 0;
    const span = after.length ? after[after.length - 1].t - after[0].t : 0;
    console.log(`  ${name}: ${before} readings without the filter, ${after.length} with it${after.length ? ` (over ${span.toFixed(2)} s)` : ''}`);
    check(allowed ? span <= allowed && after.every((o) => o.t < 2 + allowed + 0.2) : after.length === 0, `${name}: ${after.length} readings got through`);
  }
  for (const [name, make] of [['hum, quiet mode', () => mix(room(N, -75), hum(N, 120, -55))], ['talking, quiet mode', () => mix(room(N, -75), speech(N, -45))]]) {
    const after = tuner(make(), { quiet: true, gateDb: -50 });
    check(after.length === 0, `${name}: ${after.length} readings got through`);
  }
}

// How a plucked string reads: settled readings (after the first 0.5 s), their median error, the worst,
// and whether it got its ✓.
function judge(out, f0, s, from = 1.0) {
  const settled = out.filter((o) => o.t > from);
  const errs = settled.map((o) => Math.abs(cents(o.freq, f0))).sort((a, b) => a - b);
  return {
    n: settled.length,
    med: errs.length ? errs[errs.length >> 1] : Infinity,
    worst: errs.length ? errs[errs.length - 1] : Infinity,
    tuned: out.done ? out.done.has(s) : null,
  };
}

console.log('a plucked string still reads, and gets its ✓');
for (const [name, f0, s] of STRINGS) {
  const scenes = [
    ['quiet room', mix(room(NS, -70), pluck(NS, 0.5, f0, -30))],
    ['someone talking', mix(room(NS, -70), pluck(NS, 0.5, f0, -30), speech(NS, -40, { from: 0.9 }))],
    ['120 Hz hum', mix(room(NS, -70), hum(NS, 120, -48), pluck(NS, 0.5, f0, -30))],
    ['a fan', mix(room(NS, -72, -48), pluck(NS, 0.5, f0, -30))],
  ];
  for (const [scene, x] of scenes) {
    const out = tuner(x, { open: OPEN, gateDb: -52 });
    const j = judge(out, f0, s);
    const first = out.length ? out[0].t - 0.5 : Infinity;
    check(first < 0.35, `${name}, ${scene}: first reading ${first.toFixed(2)} s after the pick`);
    check(j.n >= 15, `${name}, ${scene}: ${j.n} readings`);
    check(j.med < 0.5, `${name}, ${scene}: median error ${j.med.toFixed(3)}¢`);
    check(j.worst < 5, `${name}, ${scene}: worst reading ${j.worst.toFixed(2)}¢ off`);
    check(j.tuned, `${name}, ${scene}: never got its ✓`);
  }
}

console.log('talking over a ringing string: the filter keeps out the wrong readings');
{
  let without = 0;
  let withGate = 0;
  for (const [, f0] of STRINGS) {
    for (const db of [-27, -30, -36]) {
      // Two people: a lower voice, and a higher one a little quieter.
      const x = mix(room(N, -70), pluck(N, 0.5, f0, -30), speech(N, db, { from: 0.9 }), speech(N, db - 6, { from: 1.3, lo: 160, hi: 300 }));
      without += tuner(x, { gate: false }).filter((o) => Math.abs(cents(o.freq, f0)) > 5).length;
      withGate += tuner(x).filter((o) => Math.abs(cents(o.freq, f0)) > 5).length;
    }
  }
  console.log(`  readings more than 5¢ off: ${without} without the filter, ${withGate} with it`);
  check(withGate === 0, `${withGate} wrong readings with the filter`);
}

console.log('turning the peg while the string rings: the reading follows');
for (const glide of [60, -120, 250]) {
  const f0 = 110;
  const out = tuner(mix(room(N, -70), pluck(N, 0.5, f0, -24, { glide, decay: 0.6 })));
  const late = out.filter((o) => o.t > 2.5 && o.t < 3.5);
  // TunerFilter's median trails a glide by about half its window.
  const errs = late.map((o) => Math.abs(cents(o.freq, f0) - glide * (o.t - 0.5 - 0.17))).sort((a, b) => a - b);
  const med = errs.length ? errs[errs.length >> 1] : Infinity;
  check(late.length >= 20, `glide ${glide}¢/s: ${late.length} readings between 2.5 and 3.5 s`);
  check(med < 12, `glide ${glide}¢/s: the reading is ${med.toFixed(1)}¢ from the string`);
}

console.log('a new pick on another string switches over');
{
  const x = mix(room(N, -70), pluck(N, 0.5, 110, -30), pluck(N, 2.5, 146.83, -30));
  const out = tuner(x);
  const a = out.filter((o) => o.t > 1 && o.t < 2.4);
  const d = out.filter((o) => o.t > 3);
  check(a.length > 10 && a.every((o) => Math.abs(cents(o.freq, 110)) < 2), 'the A reads before the second pick');
  check(d.length > 10 && d.every((o) => Math.abs(cents(o.freq, 146.83)) < 2), `the D reads after it (${d.length} readings)`);
  const gap = d.length ? out.find((o) => o.t > 2.5 && Math.abs(cents(o.freq, 146.83)) < 2).t - 2.5 : Infinity;
  check(gap < 0.35, `the D shows ${gap.toFixed(2)} s after its pick`);
}

console.log('the low E, plucked while the high e (two octaves up) still rings, takes over');
{
  const x = mix(room(N, -70), pluck(N, 0.5, 329.63, -30), pluck(N, 2, 82.41, -30));
  const out = tuner(x, { open: OPEN });
  const e = out.find((o) => o.t > 2 && Math.abs(cents(o.freq, 82.41)) < 2);
  check(e && e.t - 2 < 0.6, `the low E shows ${e ? (e.t - 2).toFixed(2) : 'never'} s after its pick`);
  check(out.done.has(6), 'and gets its ✓');
}

console.log('a string that rings for seconds (a wound low E) isn\'t taken for a hum');
{
  // Falling ~1.2 dB a second: under 2 dB by the drone check at 1.5 s. Plucked, rung out to 4.5 s,
  // stopped, plucked again just as hard: both plucks read all the way through.
  const NL = sr * 9;
  for (const [name, f0, s] of [['low E', 82.41, 6], ['A', 110, 5]]) {
    const first = pluck(NL, 0.5, f0, -26, { decay: 0.15 });
    for (let i = Math.round(4.5 * sr); i < NL; i++) first[i] = 0;
    const out = tuner(mix(room(NL, -70), first, pluck(NL, 4.6, f0, -26, { decay: 0.15 })), { open: OPEN });
    const on = (a, b) => out.filter((o) => o.t > a && o.t < b && Math.abs(cents(o.freq, f0)) < 2).length;
    check(on(2.5, 4.5) >= 50, `${name}: ${on(2.5, 4.5)} readings from 2.5 s to 4.5 s, while the first pluck still rings`);
    check(on(5.2, 9) >= 100, `${name}: ${on(5.2, 9)} readings after the second pluck`);
    check(out.done.has(s), `${name}: gets its ✓`);
  }
}

console.log('a hum that stops is forgotten: a string at its pitch reads again');
{
  const h = hum(N, 110, -40, 0.5);
  for (let i = Math.round(3 * sr); i < N; i++) h[i] = 0;
  const out = tuner(mix(room(N, -75), h, pluck(N, 4, 110, -44)), { open: OPEN });
  check(out.filter((o) => o.t > 2.2 && o.t < 3).length === 0, 'the hum is dropped');
  check(out.done.has(5), 'the A, plucked no louder than the hum was, gets its ✓');
}

console.log('a hum that was there first doesn\'t block a string at the same pitch');
{
  const x = mix(room(N, -70), hum(N, 110, -45), pluck(N, 1, 110, -24));
  const out = tuner(x, { open: OPEN, gateDb: -40 });
  check(out.filter((o) => o.t < 1).length === 0, 'the hum alone gives nothing');
  check(out.done.has(5), 'the A, plucked over a hum at its pitch, gets its ✓');
}

console.log('quiet mode: an unplugged electric, a few dB over the hiss, with the filter');
for (const [name, f0, s] of STRINGS) {
  const x = mix(room(N, -62), pluck(N, 0.5, f0, -50));
  const out = tuner(x, { quiet: true, gateDb: -37, open: OPEN });
  const j = judge(out, f0, s, 1.1);
  check(j.n >= 8 && j.med < 0.5 && j.worst < 5, `${name}: ${j.n} readings, median ${j.med.toFixed(3)}¢, worst ${j.worst.toFixed(2)}¢`);
  check(j.tuned, `${name} quiet: never got its ✓`);
}

console.log('PluckGate on its own');
{
  const g = new PluckGate();
  g.frame({ t: 0 });
  const at = (t, cents, attackT, db = -30) => g.push({ t, freq: 440 * 2 ** (cents / 1200), attackT, db });
  // No attack: nothing, however steady.
  let n = 0;
  for (let i = 0; i < 30; i++) n += at(1 + i * 0.03, 0, -Infinity).length;
  check(n === 0, 'a steady pitch with no attack is ignored');
  // An attack, then a steady pitch: the steady readings come out together.
  const got = [];
  for (let i = 0; i < 6; i++) got.push(...at(2 + i * 0.03, 3 + 0.5 * rand(), 1.98));
  check(got.length >= 3 && g.locked, `a pluck locks after its first steady stretch (${got.length} readings)`);
  check(got.every((r, i) => i === 0 || r.t > got[i - 1].t), 'oldest first');
  // A jump away with no new attack: ignored; the string carries on.
  check(at(2.2, 700, 1.98).length === 0, 'a reading a 5th away is ignored');
  check(at(2.23, 3, 1.98).length === 1, 'the string carries on');
  // A gliding voice after an attack never locks.
  g.reset();
  g.frame({ t: 0 });
  n = 0;
  for (let i = 0; i < 12; i++) n += at(3 + i * 0.03, i * 20, 2.98).length;
  check(n === 0, 'a pitch gliding 20¢ a reading is ignored');
  // A swelling sound never locks.
  g.reset();
  g.frame({ t: 0 });
  n = 0;
  for (let i = 0; i < 12; i++) n += at(3 + i * 0.03, 0, 2.98, -40 + i * 2).length;
  check(n === 0, 'a pitch that swells is ignored');
  // An attack right as listening starts doesn't count.
  g.reset();
  g.frame({ t: 5 });
  n = 0;
  for (let i = 0; i < 12; i++) n += at(5.05 + i * 0.03, 0, 5.01).length;
  check(n === 0, 'an attack as listening starts is ignored');
}

if (failures) { console.log(`\n${failures} failure(s)`); process.exit(1); }
console.log('\nAll noise-filter tests passed.');
