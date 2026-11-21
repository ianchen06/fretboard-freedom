// Tests the technique graders (technique.js) on synthetic electric-guitar audio run through the
// real note tracker (pitch.js): vibrato, legato, palm mute vs open, and stops.
// Run: node web/test/technique.test.js
'use strict';
const { NoteTracker } = require('../js/pitch.js');
const { OnsetDetector } = require('../js/onset.js');
const Tech = require('../js/technique.js');
globalThis.Theory = require('../js/theory.js');
require('../js/scales.js');
const G = require('../js/sessiongen.js');

const SR = 48000;
const FRAME = 2048;
let failures = 0;
const check = (ok, msg) => { if (!ok) { failures++; console.log('  FAIL', msg); } };
let seed = 7;
const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff * 2 - 1; };
const mtof = (m) => 440 * 2 ** ((m - 69) / 12);

// A string tone: harmonics with a running phase (so the pitch can move), each fading with env(t)
// and faster for higher partials. bright: 1 for open, lower for palm-muted (fewer highs).
function tone(buf, start, dur, { freq, env, amp = 0.25, bright = 1 }) {
  const n0 = Math.floor(start * SR);
  const len = Math.min(buf.length - n0, Math.floor(dur * SR));
  const ph = new Float64Array(16);
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const f0 = freq(t);
    const e = env(t) * Math.min(1, t / 0.003);
    let s = 0;
    for (let n = 1; n <= 12; n++) {
      if (n * f0 > 8000) break;
      ph[n] += (2 * Math.PI * n * f0) / SR;
      s += (Math.abs(Math.sin(n * Math.PI * 0.18)) / n) * Math.exp(-(n - 1) * (1.3 - bright) * 0.6) * Math.sin(ph[n]);
    }
    buf[n0 + i] += amp * e * s;
  }
}
const noise = (buf, db = -70) => { const a = 10 ** (db / 20); for (let i = 0; i < buf.length; i++) buf[i] += a * rand(); };

// Runs the audio through the tracker at 100 frames a second and the grader; rel is the time from
// t0 (beat 1 of bar 1). Returns the grader's events.
function run(buf, grader, { t0 = 0, beatDur = 1 } = {}) {
  const tr = new NoteTracker({ sampleRate: SR, frameSize: FRAME });
  tr.setGateDb(-55);
  const det = new OnsetDetector({ sampleRate: SR, gateDb: -55 });
  let done = 0;
  const events = [];
  const hop = SR / 100;
  for (let end = FRAME; end <= buf.length; end += hop) {
    const t = end / SR;
    // The onset detector runs on 128-sample blocks up to now, as the worklet does.
    for (; done + 128 <= end; done += 128) {
      for (const o of det.process(buf.subarray(done, done + 128), done)) {
        if (grader.onset) for (const e of grader.onset(o, o.t - t0, beatDur)) events.push(e);
      }
    }
    const info = tr.process(buf.subarray(end - FRAME, end), t);
    for (const e of grader.frame(info, t - t0, beatDur)) events.push(e);
  }
  return events;
}
const reps = (ev) => ev.filter((e) => e.kind === 'rep').map((e) => e.result);

// ---------- vibrato ----------
console.log('vibrato');
{
  // The analysis alone, on a clean curve.
  const pts = [];
  for (let i = 0; i < 200; i++) { const t = i / 100; pts.push({ t, c: 40 * (1 - Math.cos(2 * Math.PI * 5.5 * t)) }); }
  const a = Tech.analyzeVibrato(pts);
  check(Math.abs(a.width - 80) < 6, `analysis: width 80¢ (${a.width.toFixed(1)})`);
  check(Math.abs(a.rate - 5.5) < 0.2, `analysis: 5.5 Hz (${a.rate.toFixed(2)})`);
  check(a.evenness > 0.9 && Math.abs(a.floor) < 6, 'analysis: even, back to the note');

  const ex = { notes: [{ midi: 64 }, { midi: 67 }], tech: { kind: 'vibrato', width: 'narrow' } };
  const vib = (W, rate, midi) => ({ freq: (t) => mtof(midi) * 2 ** ((W / 2) * (1 - Math.cos(2 * Math.PI * rate * Math.max(0, t - 0.2))) / 1200), env: (t) => Math.exp(-0.5 * t) });
  for (const [W, rate, want, good] of [[40, 6, 'narrow', true], [110, 5, 'wide', true], [110, 5, 'narrow', false], [40, 9.5, 'narrow', false], [0, 6, 'narrow', false]]) {
    const buf = new Float32Array(SR * 6);
    tone(buf, 0.1, 2.6, vib(W, rate, 64));
    tone(buf, 3.0, 2.6, vib(W, rate, 67));
    noise(buf);
    const g = new Tech.VibratoGrader({ ...ex, tech: { kind: 'vibrato', width: want } });
    const r = reps(run(buf, g));
    const tag = `${W}¢ at ${rate} Hz, ${want}`;
    check(r.length === 2, `${tag}: both notes judged (${r.length})`);
    if (W > 0 && r[0]) {
      check(Math.abs(r[0].width - W) < W * 0.25 + 6, `${tag}: width measured (${Math.round(r[0].width)})`);
      check(Math.abs(r[0].rate - rate) < 0.6, `${tag}: speed measured (${r[0].rate.toFixed(2)})`);
    }
    check(r.every((x) => x.clean === good), `${tag}: ${good ? 'clean' : 'not clean'} (${r.map((x) => x.score.toFixed(2)).join(', ')})`);
    if (W === 0) check(r[0] && r[0].tag === 'No vibrato', 'a plain held note: no vibrato');
    check(g.i === 0, `${tag}: back to the first note`);
  }
}

// ---------- legato ----------
console.log('legato');
{
  // On the B string, 16ths at 60 bpm: picked a, then b, c, b by hammer-on / pull-off.
  const a = 61, b = 63, c = 64;
  const ex = {
    notes: [a, b, c, b].map((m, i) => ({ midi: m, s: 2, f: m - 59, legato: i > 0 })),
    npb: 4, timing: true, tech: { kind: 'legato' },
  };
  const beat = 1;
  const play = (legatoGain) => {
    const buf = new Float32Array(SR * 9);
    // One continuous string: pitch steps every 16th, a pick (full level) on each beat, legato steps
    // only bump the level to legatoGain of the picked level.
    const seq = [];
    for (let k = 0; k < 28; k++) seq.push(ex.notes[k % 4].midi);
    const t0 = 1;
    const unit = beat / 4;
    tone(buf, t0, 28 * unit + 0.3, {
      freq: (t) => mtof(seq[Math.min(seq.length - 1, Math.floor(t / unit))]),
      env: (t) => { const k = Math.floor(t / unit); const since = t - k * unit; const lv = k % 4 === 0 ? 1 : legatoGain; return lv * Math.exp(-6 * since) * 0.7 + lv * 0.3 * Math.exp(-since); },
    });
    noise(buf);
    return { buf, t0 };
  };
  for (const [gain, wantClean] of [[0.9, true], [0.3, false]]) {
    const { buf, t0 } = play(gain);
    const g = new Tech.LegatoGrader(ex, { SeqGrader: G.SeqGrader });
    const ev = run(buf, g, { t0, beatDur: beat });
    const r = reps(ev);
    const tag = `legato at ${Math.round(20 * Math.log10(gain))} dB`;
    check(r.length >= 4, `${tag}: passes judged (${r.length})`);
    const last = r[r.length - 1];
    if (last) {
      check(last.clean === wantClean, `${tag}: ${wantClean ? 'clean' : 'not clean'} (drop ${last.drop != null ? last.drop.toFixed(1) : '–'} dB, acc ${last.acc.toFixed(2)})`);
      if (wantClean) check(last.acc >= 0.9 && Math.abs(last.drop) < 4, `${tag}: all notes, even level`);
    }
  }
}

// ---------- palm mute vs open ----------
console.log('palm mute');
{
  const pattern = ['P', 'P', 'P', 'P', 'P', 'P', 'O', 'O'];
  const ex = { tech: { kind: 'palm', pattern } };
  const beat = 0.5; // 120 bpm
  const slot = beat / 2;
  // Plucked like js/onset.js's tests: losses grow with frequency; a palm mute (decay ≈ 10, fewer
  // highs) dies fast. Each pick stops the note before it, as it does on one string.
  const pluck = (buf, start, midi, { amp = 0.25, dur, decay = 1, bright = 1 }) => {
    const f0 = mtof(midi);
    const n0 = Math.round(start * SR);
    const len = Math.min(buf.length - n0, Math.floor(dur * SR));
    for (let i = 0; i < len; i++) buf[n0 + i] = 0;
    for (let n = 1; n * f0 < 7000 && n <= 30; n++) {
      const fn = n * f0;
      const a = (Math.abs(Math.sin(n * Math.PI * 0.18)) / n) * (n > 4 ? bright : 1);
      const dk = (0.8 + 4 * (fn / 1000) ** 2) * decay;
      const ph = rand() * Math.PI;
      for (let i = 0; i < len; i++) {
        const t = i / SR;
        buf[n0 + i] += amp * a * Math.min(1, t / 0.002, (len - i) / (0.004 * SR)) * Math.exp(-dk * t) * Math.sin(2 * Math.PI * fn * t + ph);
      }
    }
    for (let i = 0; i < 0.006 * SR && n0 + i < buf.length; i++) buf[n0 + i] += amp * 0.25 * rand() * Math.exp(-i / (0.002 * SR));
  };
  const play = (muteDecay, openDecay, wrongAt = -1) => {
    const buf = new Float32Array(SR * 7);
    const t0 = 0.5;
    for (let bar = 0; bar < 3; bar++) {
      for (let j = 0; j < 8; j++) {
        let kind = pattern[j];
        if (bar * 8 + j === wrongAt) kind = kind === 'P' ? 'O' : 'P';
        const P = kind === 'P';
        pluck(buf, t0 + (bar * 8 + j) * slot, 40, { dur: slot + (j === 7 ? slot : 0), decay: P ? muteDecay : openDecay, bright: P ? 0.4 : 1, amp: P ? 0.2 : 0.25 });
      }
    }
    noise(buf);
    return { buf, t0 };
  };
  {
    const { buf, t0 } = play(10, 1);
    const g = new Tech.PalmGrader(ex);
    const r = reps(run(buf, g, { t0, beatDur: beat }));
    check(r.length === 3, `three bars judged (${r.length})`);
    check(r.length && r.every((x) => x.clean), `clear mutes and opens: clean (${r.map((x) => `${x.sep && x.sep.toFixed(1)} dB, ${x.hitRate}`).join('; ')})`);
  }
  {
    const { buf, t0 } = play(1.6, 1);
    const g = new Tech.PalmGrader(ex);
    const r = reps(run(buf, g, { t0, beatDur: beat }));
    check(r.length && r.every((x) => !x.clean && x.sep < 5), `mutes that ring: not clean (${r.map((x) => x.sep && x.sep.toFixed(1)).join(', ')})`);
    check(r.length && /palm/.test(r[0].text), 'tip: mute with the palm');
  }
  {
    const { buf, t0 } = play(10, 1, 9);
    const g = new Tech.PalmGrader(ex);
    const r = reps(run(buf, g, { t0, beatDur: beat }));
    check(r.length === 3 && r[0].clean && !r[1].clean && r[2].clean, `one open where a mute belongs: that bar isn't clean (${r.map((x) => x.clean).join(', ')})`);
  }
}

// ---------- stops ----------
console.log('stops');
{
  const ex = { tech: { kind: 'stop' } };
  const beat = 0.6; // 100 bpm
  const play = (stopLag, ringDb = null) => {
    const buf = new Float32Array(SR * 9);
    const t0 = 0.5;
    for (let bar = 0; bar < 3; bar++) {
      const b0 = t0 + bar * 4 * beat;
      for (let j = 0; j < 4; j++) {
        const start = b0 + j * beat / 2;
        const dur = j === 3 ? beat / 2 + stopLag : beat / 2;
        tone(buf, start, dur, { freq: () => mtof(45), env: (t) => Math.exp(-t / 0.6) * (t > dur - 0.008 ? Math.max(0, (dur - t) / 0.008) : 1) });
      }
      if (ringDb != null) tone(buf, b0 + 2 * beat, 2 * beat, { freq: () => mtof(52), env: () => 1, amp: 0.25 * 10 ** (ringDb / 20) });
    }
    noise(buf);
    return { buf, t0 };
  };
  const judge = (lag, ring) => { const { buf, t0 } = play(lag, ring); const g = new Tech.StopGrader(ex); return reps(run(buf, g, { t0, beatDur: beat })); };
  let r = judge(0.01);
  check(r.length === 3 && r.every((x) => x.clean), `stop on beat 3: clean (${r.map((x) => `${Math.round(x.lag)} ms, ${Math.round(x.residual)} dB`).join('; ')})`);
  r = judge(0.2);
  check(r.length === 3 && r.every((x) => !x.clean && x.lag > 120), `stop 200 ms late: not clean (${r.map((x) => Math.round(x.lag)).join(', ')})`);
  r = judge(0.01, -12);
  check(r.length === 3 && r.every((x) => !x.clean && x.ringing), `a string ringing in the rest: caught (${r.map((x) => `${Math.round(x.residual)} dB ${x.ringing}`).join('; ')})`);
}

console.log(failures ? `\n${failures} failure(s)` : '\nall technique tests passed');
process.exit(failures ? 1 : 0);
