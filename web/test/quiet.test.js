// Tests quiet mode (Pitch.QUIET, AudioEngine.setQuiet) for note detection on the practice pages:
// an unplugged electric heard by a tablet's mic is only a few dB over the room's hiss. With the
// usual settings the note tracker hears nothing; with quiet mode's band-pass, boost, relaxed check
// and lower gate it should report each string's note, and nothing in hiss alone.
// (The Tuner needs no such mode: its engine, js/tunerengine.js, is tested by tunerengine.test.js.)
// The filters are the same RBJ biquads a BiquadFilterNode runs; the frame loop follows AudioEngine's
// (2048-sample frames every 10 ms, Auto-set from the first 0.5 s).
// Run: node web/test/quiet.test.js
'use strict';
const { NoteTracker, linToDb, dbToLin, NORMAL, QUIET } = require('../js/pitch.js');

let failures = 0;
const check = (ok, msg) => { if (!ok) { failures++; console.log('  FAIL', msg); } };
const sr = 48000;
let seed = 3;
const rand = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1; };
const gauss = () => { let s = 0; for (let i = 0; i < 6; i++) s += rand(); return s / Math.sqrt(2); };

// 0.5 s of hiss, then a pluck: a weak fundamental for the low strings (a small mic's roll-off), a
// fairly quick decay (an unplugged solid body). ampDb sets the level of the pluck, noiseDb the hiss.
function take(f0, ampDb, noiseDb, secs = 3) {
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

// The note events the tracker reports for one take, with the given mode.
function notes(x, quiet) {
  const p = quiet ? QUIET : NORMAL;
  if (quiet) {
    x = biquad('lowpass', QUIET.lowpass)(biquad('lowpass', QUIET.lowpass)(biquad('highpass', QUIET.highpass)(x)));
    const g = dbToLin(QUIET.boostDb);
    x = x.map((v) => v * g);
  }
  const frame = 2048;
  const hop = 480;
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
  const out = [];
  for (let i = frame; i < x.length; i += hop) {
    const info = tr.process(x.subarray(i - frame, i), i / sr);
    if (info.event) out.push(info.event);
  }
  return out;
}

const STRINGS = [['low E', 40], ['A', 45], ['D', 50], ['G', 55], ['B', 59], ['high e', 64]];
const hz = (m) => 440 * 2 ** ((m - 69) / 12);

console.log('normal mode: a quiet string in hiss goes unheard (the problem)');
for (const [name, m] of STRINGS) {
  const ev = notes(take(hz(m), -58, -62), false);
  check(!ev.some((e) => e.midi === m), `${name}: heard with the usual settings (${ev.map((e) => e.midi)})`);
}

console.log('quiet mode: every string, 4 dB over the hiss, is heard as its note');
for (const [name, m] of STRINGS) {
  for (const amp of [-55, -58]) {
    // The pick is heard, as its note, within half a second. (As the string fades into the hiss the
    // tracker can report a stray note late on; that's the tracker's, not this mode's, to fix.)
    const ev = notes(take(hz(m), amp, -62), true);
    check(ev.length >= 1 && ev[0].midi === m && ev[0].t < 1, `${name} at ${amp} dB: ${ev.map((e) => `${e.midi}@${e.t.toFixed(2)}`).join(',') || 'nothing'}`);
  }
}

console.log('quiet mode: hiss alone gives no notes');
for (const nz of [-62, -50, -75]) {
  const ev = notes(take(110, null, nz, 5), true);
  check(ev.length === 0, `hiss at ${nz} dB: ${ev.length} notes`);
}

console.log('quiet mode: a loud, plugged-in signal still reads');
for (const [name, m] of [STRINGS[0], STRINGS[5]]) {
  const ev = notes(take(hz(m), -20, -80), true);
  check(ev.length >= 1 && ev[0].midi === m, `${name} loud: ${ev.map((e) => e.midi)}`);
}

if (failures) { console.log(`\n${failures} failure(s)`); process.exit(1); }
console.log('\nAll quiet-mode tests passed.');
