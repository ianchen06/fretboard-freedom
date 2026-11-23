// Tests the looper: the loop engine (js/looper-worklet.js, run here block by block as the
// AudioWorklet runs it) and the page's logic (js/looper.js: quantizing, key finding, WAV).
// Run: node web/test/looper.test.js
'use strict';
const { LoopCore } = require('../js/looper-worklet.js');
const L = require('../js/looper.js');

let failures = 0;
const check = (ok, msg) => { if (!ok) { failures++; console.log('  FAIL', msg); } };
const near = (a, b, tol) => Math.abs(a - b) <= tol;

const SR = 48000;
const BLOCK = 128;

// Run the core over an input signal (a function of the frame, or null for silence) until frame
// `until`, with commands at given frames. Returns each track's output.
function run(core, { input = () => 0, until, at = [] }) {
  const outs = core.tracks.map(() => []);
  const msgs = [];
  const todo = [...at].sort((a, b) => a[0] - b[0]);
  const inp = new Float32Array(BLOCK);
  const o = core.tracks.map(() => new Float32Array(BLOCK));
  while (core.f < until) {
    while (todo.length && todo[0][0] <= core.f) core.command(todo.shift()[1]);
    for (let k = 0; k < BLOCK; k++) inp[k] = input(core.f + k);
    msgs.push(...core.process(inp, o));
    o.forEach((b, i) => outs[i].push(...b));
  }
  return { outs: outs.map((a) => Float32Array.from(a)), msgs };
}

// A recognisable input: a different sine pitch in every 1/8 s, plus a marker click at each second.
const sig = (f) => {
  const seg = Math.floor(f / (SR / 8));
  return 0.3 * Math.sin((2 * Math.PI * (200 + 37 * (seg % 11)) * f) / SR);
};

console.log('loop engine');
{
  // Record one 2 s loop starting at frame 4800 with 0 latency; it plays back what came in.
  const core = new LoopCore({ sampleRate: SR, tracks: 2 });
  const len = 2 * SR;
  const from = 4800;
  const { outs } = run(core, {
    input: (f) => (f < from + len + 2000 ? sig(f) : 0),
    until: from + 3 * len,
    at: [[0, { op: 'play', at: 0 }], [0, { op: 'rec', track: 0, from, len }]],
  });
  const t = core.tracks[0];
  check(t.len === len, `loop length ${t.len} should be ${len}`);
  check(t.org === from, `loop origin ${t.org} should be ${from}`);
  check(!t.span, 'the recording has finished');
  // second repeat (after the seam crossfade is in): identical to the input, past the seam
  let err = 0;
  const XF = core.xfade;
  for (let k = XF; k < len - 10; k++) err = Math.max(err, Math.abs(outs[0][from + 2 * len + k] - sig(from + k)));
  check(err < 1e-6, `the loop plays back exactly what was recorded (max error ${err})`);
  // nothing is heard while the first pass is being recorded
  let pre = 0;
  for (let k = 0; k < from + len; k++) pre = Math.max(pre, Math.abs(outs[0][k]));
  check(pre === 0, 'silent while recording the first pass');
  // the seam: no jump bigger than the signal's own steps
  let maxStep = 0;
  for (let k = 1; k < len; k++) maxStep = Math.max(maxStep, Math.abs(sig(from + k) - sig(from + k - 1)));
  const seamAt = from + 2 * len;
  let seamStep = 0;
  for (let k = seamAt - 4; k < seamAt + XF + 4; k++) seamStep = Math.max(seamStep, Math.abs(outs[0][k] - outs[0][k - 1]));
  check(seamStep < 1.2 * maxStep + 1e-3, `seam step ${seamStep.toFixed(4)} vs the signal's largest ${maxStep.toFixed(4)}`);
}

{
  // Latency: with a round trip of 37 ms, what you play along with the loop's position p arrives
  // 37 ms later, and must land at position p.
  const core = new LoopCore({ sampleRate: SR, tracks: 1 });
  const lat = Math.round(0.037 * SR);
  const from = 9600;
  const len = SR;
  // "the player" plays sig(tl) at loop time tl; it reaches the worklet at tl + lat
  const { outs } = run(core, {
    input: (g) => (g - lat < from + len + 500 && g - lat >= 0 ? sig(g - lat) : 0),
    until: from + 3 * len,
    at: [[0, { op: 'lat', frames: lat }], [0, { op: 'play', at: 0 }], [0, { op: 'rec', track: 0, from, len }]],
  });
  let err = 0;
  for (let k = core.xfade; k < len - 10; k++) err = Math.max(err, Math.abs(outs[0][from + 2 * len + k] - sig(from + k)));
  check(err < 1e-6, `latency is taken off: position p holds what was played at p (max error ${err})`);
}

{
  // A press after the bar line, in the past: the ring buffer supplies the input from before it.
  const core = new LoopCore({ sampleRate: SR, tracks: 1 });
  const from = 24000;
  const len = SR;
  const { outs } = run(core, {
    input: sig,
    until: from + 3 * len,
    at: [[0, { op: 'play', at: 0 }], [from + 6000, { op: 'rec', track: 0, from, len }]],
  });
  let err = 0;
  for (let k = core.xfade; k < len - 10; k++) err = Math.max(err, Math.abs(outs[0][from + 2 * len + k] - sig(from + k)));
  check(err < 1e-6, `a recording can start 125 ms in the past (max error ${err})`);
}

{
  // Open-ended recording, ended in the future; then overdub, undo, redo.
  const core = new LoopCore({ sampleRate: SR, tracks: 1 });
  const from = 4096;
  const len = SR;
  const tone = (f, hz) => 0.2 * Math.sin((2 * Math.PI * hz * f) / SR);
  let phase = 'a';
  const { outs } = run(core, {
    input: (f) => (phase === 'a' ? (f < from + len + 1000 ? tone(f, 220) : 0) : 0),
    until: from + 3 * len,
    at: [[0, { op: 'play', at: 0 }], [0, { op: 'rec', track: 0, from }], [from + len / 2, { op: 'end', track: 0, at: from + len }]],
  });
  check(core.tracks[0].len === len, 'open recording ended on the frame asked for');
  const base = outs[0].slice(from + 2 * len, from + 3 * len);
  // overdub a second tone for exactly one pass
  phase = 'b';
  const dubFrom = core.f + 1000;
  const t2 = (f) => tone(f, 330);
  const r2 = run(core, {
    input: (f) => (f >= dubFrom && f < dubFrom + len + core.xfade ? t2(f) : 0),
    until: dubFrom + 3 * len,
    at: [[core.f, { op: 'dub', track: 0, from: dubFrom }], [dubFrom + len / 2, { op: 'end', track: 0, at: dubFrom + len }]],
  });
  check(core.tracks[0].layers.length === 2, `two layers after an overdub (got ${core.tracks[0].layers.length})`);
  // after the dub, the output = base + the 330 Hz tone
  const g = dubFrom + 2 * len + 5000;
  const want = base[(g - from) % len] + t2(g - len * 2);
  const got = r2.outs[0][g - (r2.outs[0].length ? core.f - r2.outs[0].length : 0)];
  check(near(got, want, 1e-4), `overdub sums onto the loop (${got.toFixed(4)} vs ${want.toFixed(4)})`);
  core.command({ op: 'undo', track: 0 });
  check(core.tracks[0].layers.length === 1 && core.tracks[0].redo.length === 1, 'undo takes the overdub off');
  core.command({ op: 'redo', track: 0 });
  check(core.tracks[0].layers.length === 2, 'redo puts it back');
  core.command({ op: 'undo', track: 0 });
  core.command({ op: 'undo', track: 0 });
  check(core.tracks[0].len === 0, 'undoing the first recording empties the track');
  core.command({ op: 'redo', track: 0 });
  check(core.tracks[0].len === len && core.tracks[0].org === from, 'redo brings it back, on the same grid');
}

{
  // Feedback: overdubbing three passes with feedback 0.5 fades the old layers by half each pass.
  const core = new LoopCore({ sampleRate: SR, tracks: 1 });
  const len = SR / 2;
  const from = 0;
  run(core, {
    input: (f) => (f < len + 500 ? 0.1 : 0),
    until: 2 * len,
    at: [[0, { op: 'play', at: 0 }], [0, { op: 'rec', track: 0, from, len }]],
  });
  core.command({ op: 'fb', track: 0, value: 0.5 });
  const d0 = core.f;
  run(core, { input: () => 0, until: d0 + 3 * len + 1000, at: [[d0, { op: 'dub', track: 0, from: d0 }], [d0, { op: 'end', track: 0, at: d0 + 3 * len }]] });
  const layers = core.tracks[0].layers;
  check(layers.length === 4, `a layer per pass with feedback < 1 (got ${layers.length})`);
  check(near(layers[0].gt, 0.125, 1e-9), `the base is down to 0.5³ after three passes (got ${layers[0].gt})`);
  core.command({ op: 'undo', track: 0 });
  check(near(core.tracks[0].layers[0].gt, 0.25, 1e-9), 'undo gives the older layers their level back');
}

{
  // Reverse and ½×: positions mapped as expected, and the switch is crossfaded.
  const core = new LoopCore({ sampleRate: SR, tracks: 1 });
  const len = SR;
  const ramp = (f) => ((f % len) / len) * 0.5; // the loop holds a ramp, so the value is its position
  run(core, { input: ramp, until: 2 * len + 2000, at: [[0, { op: 'play', at: 0 }], [0, { op: 'rec', track: 0, from: 0, len }]] });
  const t = core.tracks[0];
  check(near(core.read(t, core.pos(t, 3 * len + 1000, { rev: false, rate: 1 })), ramp(1000), 1e-6), 'forward position');
  check(near(core.read(t, core.pos(t, 3 * len + 1000, { rev: true, rate: 1 })), ramp(len - 1 - 1000), 1e-6), 'reversed position');
  check(near(core.read(t, core.pos(t, 2 * len + 2000, { rev: false, rate: 0.5 })), ramp(1000), 1e-6), '½× position (a 1 s loop takes 2 s)');
  const at = core.f + 256;
  const { outs } = run(core, { input: () => 0, until: at + 2000, at: [[core.f, { op: 'map', track: 0, at, rev: true }]] });
  const base = core.f - outs[0].length;
  let step = 0;
  for (let k = at - base; k < at - base + core.xfade + 2; k++) step = Math.max(step, Math.abs(outs[0][k] - outs[0][k - 1]));
  check(step < 0.02, `reversing is crossfaded (largest step ${step.toFixed(4)})`);
  check(t.rev === true, 'reversed');
}

{
  // ×2: twice as long, the content repeated, no jump.
  const core = new LoopCore({ sampleRate: SR, tracks: 1 });
  const len = SR / 2;
  run(core, { input: sig, until: 2 * len + 1000, at: [[0, { op: 'play', at: 0 }], [0, { op: 'rec', track: 0, from: 0, len }]] });
  const t = core.tracks[0];
  const before = core.read(t, core.pos(t, core.f + 77, t));
  core.command({ op: 'double', track: 0 });
  check(t.len === 2 * len, 'doubled');
  check(near(core.read(t, core.pos(t, core.f + 77, t)), before, 1e-9), 'the same sample plays at the same moment');
}

{
  // Free tempo, the first loop: the end is pressed in the past; the loop starts now instead.
  const core = new LoopCore({ sampleRate: SR, tracks: 1 });
  const from = 1000;
  run(core, { input: sig, until: from + SR + 2000, at: [[0, { op: 'play', at: 0 }], [0, { op: 'rec', track: 0, from }]] });
  const now = core.f;
  core.command({ op: 'end', track: 0, at: from + SR, shiftOrg: true });
  const t = core.tracks[0];
  check(t.len === SR, 'free loop length');
  check(t.liveFrom === now && core.pos(t, now, t) === 0, 'the first repeat starts from its beginning, now');
}

console.log('quantizing');
{
  const t0 = 10;
  const bar = 2;
  check(L.startAt(11.2, t0, bar) === 12, 'a press mid-bar starts at the next bar');
  check(L.startAt(12.1, t0, bar) === 12, 'a press just after the bar line counts as on it');
  check(L.startAt(12.3, t0, bar) === 14, 'a press well after waits for the next bar');
  check(L.endAt(13.9, 12, bar) === 14, 'an end press just before the bar line ends there');
  check(L.endAt(14.1, 12, bar) === 14, 'an end press just after it ends there too');
  check(L.endAt(14.5, 12, bar) === 16, 'later than the grace: the next bar');
  check(L.endAt(12.3, 12, bar) === 14, 'at least one bar');
  check(L.mixLength([{ len: 3 }, { len: 4 }], 1000) === 12, 'polymeter 3 against 4 comes round after 12');
  check(L.mixLength([{ len: 4, rate: 0.5 }, { len: 4 }], 1000) === 8, '½× doubles a loop’s length');
  check(L.mixLength([{ len: 997 }, { len: 991 }], 5000) === 997, 'capped: the longest loop');
  for (const [id, g] of Object.entries(L.GROOVES)) {
    for (const beats of [3, 4, 5, 6, 7]) {
      const { spb, hits } = g.make(beats);
      check(hits.length && hits.every(([s]) => s >= 0 && s < beats * spb), `${id} in ${beats}: hits inside the bar`);
      check(hits.some(([s, k]) => s === 0 && k === 'kick'), `${id} in ${beats}: a kick on 1`);
    }
  }
}

console.log('key finding');
{
  // Synthetic chords: plucked-string-like partials, a few seconds of a progression.
  const midiHz = (m) => 440 * 2 ** ((m - 69) / 12);
  const render = (bars, secPer = 1) => {
    const x = new Float32Array(Math.round(bars.length * secPer * SR));
    bars.forEach((notes, b) => {
      const n0 = Math.round(b * secPer * SR);
      for (const m of notes) {
        for (let h = 1; h <= 6; h++) {
          const f = midiHz(m) * h;
          for (let i = 0; i < secPer * SR; i++) x[n0 + i] += (0.1 / h) * Math.exp(-i / SR / (1.5 / h)) * Math.sin((2 * Math.PI * f * i) / SR);
        }
      }
    });
    return x;
  };
  const name = (k) => `${['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'][k.tonic]} ${k.mode}`;
  const Am = [45, 52, 57, 60, 64];
  const C = [48, 52, 55, 60, 64];
  const D = [50, 57, 62, 66];
  const E = [40, 47, 52, 56, 59, 64];
  const F = [41, 48, 53, 57, 60, 65];
  const G = [43, 47, 50, 55, 59, 67];
  const A = [45, 52, 57, 61, 64];
  const Em = [40, 47, 52, 55, 59, 64];
  const Bm = [47, 54, 59, 62, 66];
  const Dm = [50, 57, 62, 65];
  const Am7 = [45, 52, 55, 60, 64];
  const cases = [
    ['G C D G', [G, C, D, G], 'G major'],
    // vi–IV–I–V or i–VI–III–♭VII: the same notes, heard either way. The page names both.
    ['Am F C G', [Am, F, C, G], 'A minor|C major'],
    ['C Am F G', [C, Am, F, G], 'C major'],
    ['Em C D Em', [Em, C, D, Em], 'E minor'],
    ['D G A D', [D, G, A, D], 'D major'],
    ['Am Dm E Am', [Am, Dm, E, Am], 'A minor'],
    ['E A B E', [E, A, [47, 54, 59, 63, 66], E], 'E major'],
    ['Bm G D A', [Bm, G, D, A], 'B minor'],
    ['A A G A', [A, A, G, A], 'A major'],
    ['Am7 Am7 D Am7', [Am7, Am7, D, Am7], 'A minor'],
  ];
  for (const [label, bars, want] of cases) {
    const x = render(bars);
    const keys = L.findKey(L.chroma(x, SR), L.bassNote(x.subarray(0, SR / 2), SR));
    check(keys.length && want.split('|').includes(name(keys[0])), `${label}: found ${keys.length ? name(keys[0]) : 'nothing'}`);
  }
  // Dorian: an Am7 vamp with a bar of D (the major 6th, F♯, is in the loop)
  const dor = L.chroma(render([[45, 52, 55, 60, 64], [45, 52, 55, 60, 64], [50, 57, 62, 66], [45, 52, 55, 60, 64]]), SR);
  const dk = L.findKey(dor, 9)[0];
  const ids = L.suggest(dk, dor).map((s) => s.id);
  check(dk.mode === 'minor' && dk.tonic === 9, `Am7 → D is in A minor (found ${name(dk)})`);
  check(ids[0] === 'minPent' && ids.includes('dorian'), `…and suggests Dorian (${ids.join(', ')})`);
  // Mixolydian: A to G (the ♭7)
  const mix = L.chroma(render([[45, 52, 57, 61, 64], [43, 50, 55, 59, 62], [45, 52, 57, 61, 64], [45, 52, 57, 61, 64]]), SR);
  const mk = L.findKey(mix)[0];
  check(L.suggest(mk, mix).some((s) => s.id === 'mixolydian'), `A → G suggests Mixolydian (key ${name(mk)})`);
  check(L.chroma(new Float32Array(SR), SR) === null, 'silence has no chroma');
}

console.log('real guitar recordings');
{
  // The chroma and the bass of real notes (test/data: real strings' stretched, wandering harmonics
  // and the low E's weak fundamental), then a loop made of them.
  const fs = require('fs');
  const path = require('path');
  const load = (f) => {
    const b = fs.readFileSync(path.join(__dirname, 'data', f));
    const x = new Float32Array(b.length / 2);
    for (let i = 0; i < x.length; i++) x[i] = b.readInt16LE(2 * i) / 32768;
    return x;
  };
  const RSR = 12000;
  const clips = [['acoustic-E2', 4], ['electric-E2', 4], ['nylon-E2', 4], ['acoustic-A2', 9], ['acoustic-G3', 7], ['acoustic-E4', 4]];
  for (const [c, pc] of clips) {
    const x = load(`guitar-${c}.s16`);
    const p = L.chroma(x, RSR);
    const top = p.indexOf(Math.max(...p));
    check(top === pc, `${c}: the loudest pitch class is ${top}, should be ${pc}`);
    check(L.bassNote(x, RSR) === pc, `${c}: bass note ${L.bassNote(x, RSR)}, should be ${pc}`);
  }
  // E2 + G3 + E4 together: an E minor sound (the B comes from the strings' own harmonics)
  const e2 = load('guitar-acoustic-E2.s16');
  const g3 = load('guitar-acoustic-G3.s16');
  const e4 = load('guitar-acoustic-E4.s16');
  const mix = e2.map((v, i) => v + (g3[i] || 0) + (e4[i] || 0));
  const k = L.findKey(L.chroma(mix, RSR), L.bassNote(mix, RSR))[0];
  check(k.tonic === 4 && k.mode === 'minor', `E + G + E: E minor (found ${k.tonic} ${k.mode})`);

  // A real note through the loop engine, at its own rate, 23 ms round trip: played back exactly.
  const core = new LoopCore({ sampleRate: RSR, tracks: 1 });
  const lat = Math.round(0.023 * RSR);
  const len = RSR * 2;
  const from = 600;
  const inp = (g) => { const i = g - lat - from; return i >= 0 && i < e2.length ? e2[i] : 0; };
  const { outs } = run(core, { input: inp, until: from + 3 * len, at: [[0, { op: 'lat', frames: lat }], [0, { op: 'play', at: 0 }], [0, { op: 'rec', track: 0, from, len }]] });
  let err = 0;
  for (let i = core.xfade; i < len; i++) err = Math.max(err, Math.abs(outs[0][from + 2 * len + i] - e2[i]));
  check(err < 1e-6, `a real low E loops back sample for sample (max error ${err})`);
  // its seam: the note rings across the loop's end; the run-on carries it into the start
  let jump = 0;
  for (let i = from + 2 * len - 2; i < from + 2 * len + core.xfade; i++) jump = Math.max(jump, Math.abs(outs[0][i] - outs[0][i - 1]));
  let typical = 0;
  for (let i = len - 2000; i < len; i++) typical = Math.max(typical, Math.abs(e2[i] - e2[i - 1]));
  check(jump <= 1.5 * typical + 1e-4, `no click at the seam (step ${jump.toFixed(4)} vs ${typical.toFixed(4)} just before it)`);
}

console.log('WAV');
{
  const a = Float32Array.from({ length: 100 }, (_, i) => Math.sin(i / 5) * 0.5);
  const buf = L.encodeWav([a, a], 44100);
  const v = new DataView(buf);
  check(buf.byteLength === 44 + 400, 'size');
  check(String.fromCharCode(v.getUint8(0), v.getUint8(1), v.getUint8(2), v.getUint8(3)) === 'RIFF', 'RIFF header');
  check(v.getUint16(22, true) === 2 && v.getUint32(24, true) === 44100, 'stereo, 44.1 kHz');
  check(near(v.getInt16(44 + 4 * 10, true) / 32767, a[10], 1e-3), 'samples');
}

if (failures) { console.log(`\n${failures} failed`); process.exit(1); }
console.log('\nall looper tests passed');
