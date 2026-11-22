// Tests the precise tuner (refinePitch + TunerFilter) on synthetic plucked strings.
// Run: node web/test/tuner.test.js
'use strict';
const { refinePitch, TunerFilter } = require('../js/pitch.js');

let failures = 0;
const check = (ok, msg) => { if (!ok) { failures++; console.log('  FAIL', msg); } };

let seed = 4242;
const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff * 2 - 1; };
const midiToFreq = (m) => 440 * 2 ** ((m - 69) / 12);
const cents = (f, ref) => 1200 * Math.log2(f / ref);

// A held string `t0` seconds after the pick: partials shaped by the pick position, decaying.
// B: inharmonicity (partial n at n·f0·√(1 + B·n²)); f0 is the fundamental's actual frequency.
function note(sr, n, f0, { t0 = 0.3, amp = 0.3, B = 0, noise = 0, pickPos = 0.18 } = {}) {
  const x = new Float32Array(n);
  for (let h = 1; h * f0 < 6000 && h <= 25; h++) {
    const fh = h * f0 * Math.sqrt(1 + B * h * h);
    const a = Math.abs(Math.sin(h * Math.PI * pickPos)) / h;
    const decay = 1.2 + 0.6 * h;
    const ph = rand() * Math.PI;
    for (let i = 0; i < n; i++) {
      const t = t0 + i / sr;
      x[i] += amp * a * Math.exp(-decay * t) * Math.sin(2 * Math.PI * fh * t + ph);
    }
  }
  if (noise) for (let i = 0; i < n; i++) x[i] += noise * rand();
  return x;
}

console.log('refinePitch: accuracy across the neck');
for (const sr of [44100, 48000, 96000]) {
  const N = 2 ** Math.ceil(Math.log2(sr * 0.17));
  let worst = 0;
  for (const midi of [40, 45, 50, 55, 59, 64, 69, 76, 84]) {
    for (const off of [-23.7, -4.2, 0, 0.3, 7.9, 31]) {
      const f = midiToFreq(midi) * 2 ** (off / 1200);
      const rough = f * 2 ** ((rand() * 8) / 1200); // the tracker's estimate: a few cents off
      const r = refinePitch(note(sr, N, f), sr, rough);
      check(r && r.clarity > 0.9, `sr ${sr} midi ${midi} ${off}¢: ${r ? `clarity ${r.clarity.toFixed(3)}` : 'no result'}`);
      if (r) worst = Math.max(worst, Math.abs(cents(r.freq, f)));
      if (r && Math.abs(cents(r.freq, f)) > 0.1) console.log("   ", sr, midi, off, cents(r.freq, f).toFixed(3));
    }
  }
  console.log(`  ${sr} Hz: worst error ${worst.toFixed(3)}¢`);
  check(worst < 0.1, `sr ${sr}: worst error ${worst.toFixed(3)}¢ should be under 0.1¢`);
}

console.log('refinePitch: noise and string stiffness');
{
  const sr = 48000;
  const N = 8192;
  for (const midi of [40, 52, 64]) {
    const f = midiToFreq(midi);
    const r = refinePitch(note(sr, N, f, { noise: 0.01 }), sr, f);
    check(r && Math.abs(cents(r.freq, f)) < 0.3, `noisy midi ${midi}: ${r && cents(r.freq, f).toFixed(3)}¢`);
    // A stiff (wound) string's upper partials run sharp; the reading follows the fundamental closely.
    const s = refinePitch(note(sr, N, f, { B: 0.0001 }), sr, f);
    check(s && Math.abs(cents(s.freq, f)) < 1.5, `stiff midi ${midi}: ${s && cents(s.freq, f).toFixed(3)}¢`);
  }
  const silent = refinePitch(new Float32Array(N), sr, 110);
  check(silent === null, 'silence gives no reading');
  const r = refinePitch(note(sr, N, 110), sr, 110 * 2 ** (40 / 1200));
  check(r === null || Math.abs(cents(r.freq, 110)) < 0.1, 'a rough estimate 40¢ off: no reading, or the right one');
}

console.log('TunerFilter');
{
  const tf = new TunerFilter();
  let out = null;
  // A4 + 2.5¢ with ±0.3¢ jitter, 30 readings a second.
  for (let i = 0; i < 20; i++) out = tf.push(440 * 2 ** ((2.5 + 0.3 * rand()) / 1200), i / 30) || out;
  check(out && out.midi === 69, `midi ${out && out.midi}`);
  check(out && Math.abs(out.cents - 2.5) < 0.3, `cents ${out && out.cents.toFixed(2)}`);
  check(out && out.stable, 'steady readings are stable');
  // A new note starts afresh: no reading until enough of it is in.
  const first = tf.push(midiToFreq(64), 1);
  check(first === null, 'a new note resets the filter');
  for (let i = 1; i < 6; i++) out = tf.push(midiToFreq(64) * 2 ** (-12 / 1200), 1 + i / 30) || out;
  check(out && out.midi === 64 && Math.abs(out.cents + 12) < 0.01, `new note: ${out && out.midi} ${out && out.cents.toFixed(2)}`);
  // Wobbly readings are not stable.
  tf.reset();
  for (let i = 0; i < 12; i++) out = tf.push(440 * 2 ** ((i % 2 ? 4 : -4) / 1200), i / 30) || out;
  check(!out.stable, 'jumping readings are not stable');
  // Reference pitch A4 = 432.
  const t2 = new TunerFilter({ a4: 432 });
  for (let i = 0; i < 6; i++) out = t2.push(432, i / 30) || out;
  check(out.midi === 69 && Math.abs(out.cents) < 1e-6, 'A4 = 432 reference');
}

if (failures) { console.log(`${failures} failure(s)`); process.exit(1); }
console.log('all tuner tests passed');
