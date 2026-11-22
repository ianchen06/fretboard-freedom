// Tests quiet mode (Pitch.QUIET, AudioEngine.setQuiet): an unplugged electric heard by a tablet's mic
// is only a few dB over the room's hiss. With the usual settings the tuner hears nothing; with quiet
// mode's band-pass, boost, relaxed checks and lower gate it should read every string to well under a
// cent, and hear nothing in hiss alone.
// The filters are the same RBJ biquads a BiquadFilterNode runs; the frame loop follows AudioEngine's
// (2048-sample frames every 10 ms, the precise tuner on every 3rd, Auto-set from the first 0.5 s).
// Run: node web/test/quiet.test.js
'use strict';
const { NoteTracker, TunerFilter, refinePitch, linToDb, dbToLin, NORMAL, QUIET } = require('../js/pitch.js');

let failures = 0;
const check = (ok, msg) => { if (!ok) { failures++; console.log('  FAIL', msg); } };
const sr = 48000;
let seed = 3;
const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff * 2 - 1; };
const gauss = () => { let s = 0; for (let i = 0; i < 6; i++) s += rand(); return s / Math.sqrt(2); };

// 0.5 s of hiss, then a pluck: a weak fundamental for the low strings (a small mic's roll-off), a
// fairly quick decay (an unplugged solid body: the mic hears the strings, not a resonating top). ampDb sets the level of the pluck, noiseDb the hiss (white, so in every band).
function take(f0, ampDb, noiseDb, secs = 4) {
  const pre = Math.round(sr * 0.5);
  const n = pre + sr * secs;
  const x = new Float32Array(n);
  const amp = ampDb == null ? 0 : dbToLin(ampDb);
  for (let h = 1; amp && h <= 15 && h * f0 < 5000; h++) {
    const w = (Math.abs(Math.sin(h * Math.PI * 0.2)) / h) * (h === 1 && f0 < 150 ? 0.3 : 1);
    for (let i = pre; i < n; i++) {
      const t = (i - pre) / sr;
      x[i] += amp * 2.2 * w * Math.exp(-(0.5 + 0.25 * h) * t) * Math.sin(2 * Math.PI * h * f0 * t + h);
    }
  }
  const nz = dbToLin(noiseDb);
  for (let i = 0; i < n; i++) x[i] += nz * gauss();
  return x;
}

function biquad(type, f, q = Math.SQRT1_2) {
  const w = (2 * Math.PI * f) / sr;
  const al = Math.sin(w) / (2 * q);
  const c = Math.cos(w);
  const a0 = 1 + al;
  const a1 = -2 * c;
  const a2 = 1 - al;
  const b0 = type === 'lowpass' ? (1 - c) / 2 : (1 + c) / 2;
  const b1 = type === 'lowpass' ? 1 - c : -(1 + c);
  return (x) => {
    const y = new Float32Array(x.length);
    let x1 = 0; let x2 = 0; let y1 = 0; let y2 = 0;
    for (let i = 0; i < x.length; i++) {
      const v = (b0 * x[i] + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2) / a0;
      x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
    }
    return y;
  };
}

// Readings of the precise tuner (steadied by TunerFilter) for one take, with the given mode.
function tune(x, quiet) {
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
  // Auto-set (MicPanel.autoCalibrate): the 60th percentile of the level, plus the margin.
  const lv = [];
  for (let i = frame; i < sr * 0.5; i += hop) {
    let s = 0;
    for (let j = i - hop; j < i; j++) s += x[j] * x[j];
    lv.push(Math.sqrt(s / hop));
  }
  lv.sort((a, b) => a - b);
  tr.setGateDb(Math.min(-32, Math.max(-68, linToDb(lv[Math.floor(lv.length * 0.6)]) + p.gateMargin)));
  const filt = new TunerFilter({ window: quiet ? QUIET.tunerWindow : 0.3 });
  const out = [];
  let tick = 0;
  for (let i = Math.max(frame, tuneN); i < x.length; i += hop) {
    const t = i / sr;
    const info = tr.process(x.subarray(i - frame, i), t);
    if (!info.freq || ++tick % 3) continue;
    const r = refinePitch(x.subarray(i - tuneN, i), sr, info.freq);
    if (!r || r.clarity <= p.clarity) continue;
    const fr = filt.push(r.freq, t, tr.lastOnsetT, info.db);
    if (fr) out.push({ t, freq: fr.freq, spread: fr.spread });
  }
  return out;
}

const STRINGS = [['low E', 82.41], ['A', 110], ['D', 146.83], ['G', 196], ['B', 246.94], ['high e', 329.63]];
const cents = (f, ref) => 1200 * Math.log2(f / ref);

console.log('normal mode: a quiet string in hiss goes unheard (the problem)');
for (const [name, f0] of STRINGS) {
  const r = tune(take(f0, -58, -62), false);
  check(r.length < 3, `${name}: ${r.length} readings with the usual settings`);
}

console.log('quiet mode: every string, 4 dB over the hiss, read to under a cent');
for (const [name, base] of STRINGS) {
  for (const off of [-7, 0.4]) {
    const f0 = base * 2 ** (off / 1200);
    for (const amp of [-55, -58]) {
      const r = tune(take(f0, amp, -62), true);
      const settled = r.filter((o) => o.t > 0.9); // after the pick and TunerFilter's first window
      const errs = settled.map((o) => Math.abs(cents(o.freq, f0))).sort((a, b) => a - b);
      const med = errs.length ? errs[errs.length >> 1] : Infinity;
      const bad = errs.filter((e) => e > 5).length;
      check(settled.length >= 8, `${name} ${off}¢ at ${amp} dB: ${settled.length} readings`);
      check(med < 0.5, `${name} ${off}¢ at ${amp} dB: median error ${med.toFixed(3)}¢`);
      check(bad === 0, `${name} ${off}¢ at ${amp} dB: ${bad} readings off by more than 5¢`);
      // Enough steady readings for the Tuner page to count it as tuned (spread under 1¢ for QUIET.holdTime).
      const steady = settled.filter((o) => o.spread < 1);
      check(steady.length && steady[steady.length - 1].t - steady[0].t >= QUIET.holdTime, `${name} at ${amp} dB: steady for ${steady.length ? (steady[steady.length - 1].t - steady[0].t).toFixed(2) : 0} s`);
    }
  }
}

console.log('quiet mode: hiss alone gives no readings');
for (const nz of [-62, -50, -75]) {
  const r = tune(take(110, null, nz, 6), true);
  check(r.length === 0, `hiss at ${nz} dB: ${r.length} readings`);
}

console.log('quiet mode: a loud, plugged-in signal still reads exactly');
for (const [name, f0] of [['low E', 82.41], ['high e', 329.63]]) {
  const r = tune(take(f0, -20, -80), true).filter((o) => o.t > 0.9);
  const e = r.length ? Math.abs(cents(r[r.length >> 1].freq, f0)) : Infinity;
  check(r.length > 20 && e < 0.1, `${name} loud: ${r.length} readings, ${e.toFixed(3)}¢`);
}

if (failures) { console.log(`\n${failures} failure(s)`); process.exit(1); }
console.log('\nAll quiet-mode tests passed.');
