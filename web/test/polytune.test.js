// Tests "Strum all six" (js/polytune.js): every string's tuning from one synthetic strum.
// The strums are made hard on purpose: every string detuned, random pick positions and levels,
// inharmonic partials (wound strings stiffer), a down-strum's stagger and room noise. In standard
// tuning several strings share partials (low E ×3 = B, low E ×4 = A ×3 = high e, A ×4 = D ×3, …).
// Run: node web/test/polytune.test.js
'use strict';
const { StrumAnalyzer, fft } = require('../js/polytune.js');

let failures = 0;
const check = (ok, msg) => { if (!ok) { failures++; console.log('  FAIL', msg); } };
let seed = 11;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const STD = { 1: 64, 2: 59, 3: 55, 4: 50, 5: 45, 6: 40 };
const hz = (m, a4 = 440) => a4 * 2 ** ((m - 69) / 12);

// The analyser's 32768 samples, starting t0 s after the strum's attack.
function strum(det, { sr = 48000, open = STD, a4 = 440, noise = 0.001, t0 = 0.1, skip = [] } = {}) {
  const N = 32768;
  const x = new Float32Array(N);
  for (const s of [6, 5, 4, 3, 2, 1]) {
    if (skip.includes(s)) continue;
    const f0 = hz(open[s], a4) * 2 ** ((det[s] || 0) / 1200);
    const p = 0.1 + 0.15 * rnd();
    const amp = 0.08 * 10 ** ((rnd() * 12 - 6) / 20);
    const B = s >= 4 ? 1.2e-4 : 5e-5;
    const ts = t0 - (6 - s) * 0.012; // a down-strum: the low string first
    for (let h = 1; h <= 20 && h * f0 < 8000; h++) {
      const w = (2 * Math.PI * h * f0 * Math.sqrt(1 + B * h * h)) / sr;
      const a = (amp * Math.abs(Math.sin(h * Math.PI * p))) / h;
      const dec = 0.8 + 0.4 * h;
      const ph = rnd() * 6.28;
      for (let i = 0; i < N; i++) x[i] += a * Math.exp(-dec * (ts + i / sr)) * Math.sin(w * i + ph);
    }
  }
  for (let i = 0; i < N; i++) x[i] += noise * (rnd() * 2 - 1);
  return x;
}
const readings = (an, x) => Object.fromEntries(an.analyze(x).map((r) => [r.s, r]));

console.log('fft: a pure tone lands in its bin');
{
  const n = 1024;
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let i = 0; i < n; i++) re[i] = Math.cos((2 * Math.PI * 37 * i) / n);
  fft(re, im);
  check(Math.abs(re[37] - n / 2) < 1e-6 && Math.abs(re[36]) < 1e-6 && Math.abs(im[37]) < 1e-6, `bin 37: ${re[37]}`);
}

console.log('random strums: every string within 2¢ (44.1 and 48 kHz)');
for (const sr of [44100, 48000]) {
  const an = new StrumAnalyzer({ sampleRate: sr, open: STD });
  const worst = {};
  for (let k = 0; k < 30; k++) {
    const det = {};
    for (const s of [1, 2, 3, 4, 5, 6]) det[s] = (rnd() * 2 - 1) * (k % 2 ? 25 : 6);
    const r = readings(an, strum(det, { sr }));
    for (const s of [1, 2, 3, 4, 5, 6]) {
      const e = r[s].cents == null ? Infinity : Math.abs(r[s].cents - det[s]);
      worst[s] = Math.max(worst[s] || 0, e);
      check(r[s].heard && !r[s].far, `${sr} Hz strum ${k}: string ${s} heard, not far`);
    }
  }
  for (const s of [1, 2, 3, 4, 5, 6]) check(worst[s] < 2, `${sr} Hz: string ${s} worst error ${worst[s].toFixed(2)}¢`);
}

console.log('the shared strings off, the rest in tune: still read, and the right way');
{
  const an = new StrumAnalyzer({ sampleRate: 48000, open: STD });
  for (const s of [2, 1, 6]) {
    for (const d of [-15, -8, -4, 4, 8, 15]) {
      const r = readings(an, strum({ [s]: d }));
      check(Math.abs(r[s].cents - d) < 3, `string ${s} at ${d}¢ read ${r[s].cents.toFixed(2)}¢`);
      check(Math.sign(r[s].cents) === Math.sign(d), `string ${s} at ${d}¢: direction`);
      for (const t of [1, 2, 3, 4, 5, 6]) if (t !== s) check(Math.abs(r[t].cents) < 2, `string ${s} at ${d}¢: in-tune string ${t} read ${r[t].cents.toFixed(2)}¢`);
    }
  }
}

console.log('far off: a string too far out to read in a strum is flagged, the rest still read');
{
  const an = new StrumAnalyzer({ sampleRate: 48000, open: STD });
  for (const d of [-90, 80]) {
    const r = readings(an, strum({ 3: d }));
    check(r[3].far, `G at ${d}¢: far`);
    for (const t of [1, 2, 4, 5, 6]) check(!r[t].far && Math.abs(r[t].cents) < 2, `G at ${d}¢: string ${t} read ${r[t].cents.toFixed(2)}¢`);
  }
  const all = readings(an, strum({ 1: -40, 2: -40, 3: -40, 4: -40, 5: -40, 6: -40 }));
  for (const t of [1, 2, 3, 4, 5, 6]) check(!all[t].far && Math.abs(all[t].cents + 40) < 2, `all 40¢ flat: string ${t} read ${all[t].cents.toFixed(2)}¢`);
}

console.log('other tunings and reference pitches');
{
  const dropD = { ...STD, 6: 38 };
  const an = new StrumAnalyzer({ sampleRate: 48000, open: dropD });
  const det = { 1: 3, 2: -5, 3: 7, 4: -2, 5: 4, 6: -9 };
  const r = readings(an, strum(det, { open: dropD }));
  for (const s of [1, 2, 3, 4, 5, 6]) check(Math.abs(r[s].cents - det[s]) < 2, `drop D string ${s}: ${r[s].cents.toFixed(2)} vs ${det[s]}`);
  const an442 = new StrumAnalyzer({ sampleRate: 48000, open: STD, a4: 442 });
  const r2 = readings(an442, strum({}, { a4: 442 }));
  for (const s of [1, 2, 3, 4, 5, 6]) check(Math.abs(r2[s].cents) < 2, `A4 = 442, string ${s}: ${r2[s].cents.toFixed(2)}`);
}

console.log('noise: a noisy room still reads');
{
  const an = new StrumAnalyzer({ sampleRate: 48000, open: STD });
  const det = { 1: 5, 2: -7, 3: 3, 4: -4, 5: 9, 6: -2 };
  for (const noise of [0.02, 0.06]) {
    const r = readings(an, strum(det, { noise }));
    for (const s of [1, 2, 3, 4, 5, 6]) check(Math.abs(r[s].cents - det[s]) < 2, `noise ${noise}: string ${s} ${r[s].cents.toFixed(2)} vs ${det[s]}`);
  }
  // Noise alone: nothing heard.
  const quiet = readings(an, strum({}, { skip: [1, 2, 3, 4, 5, 6], noise: 0.02 }));
  check(Object.values(quiet).every((r) => !r.heard), 'noise only: no string heard');
}

if (failures) { console.log(`\n${failures} failure(s)`); process.exit(1); }
console.log('\nAll strum tests passed.');
