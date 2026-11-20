// Tests the pitch detector and note tracker against synthetic plucked-string audio.
// Run: node web/test/pitch.test.js
'use strict';
const { NoteTracker } = require('../js/pitch.js');

const SR = 48000;
const FRAME = 2048;
const FPS = 60;
let failures = 0;
const check = (ok, msg) => { if (!ok) { failures++; console.log('  FAIL', msg); } };

// Deterministic noise.
let seed = 12345;
const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff * 2 - 1; };

const midiToFreq = (m) => 440 * 2 ** ((m - 69) / 12);

// A plucked string: inharmonic partials shaped by pick position, higher partials decay faster.
function pluck(buf, start, midi, { amp = 0.3, dur = 2, pickPos = 0.18, B = 0.0001, fundGain = 1 } = {}) {
  const f0 = midiToFreq(midi);
  const n0 = Math.floor(start * SR);
  const len = Math.min(buf.length - n0, Math.floor(dur * SR));
  for (let n = 1; n * f0 < 6000 && n <= 30; n++) {
    const fn = n * f0 * Math.sqrt(1 + B * n * n);
    let a = Math.abs(Math.sin(n * Math.PI * pickPos)) / n;
    if (n === 1) a *= fundGain;
    const decay = 1.2 + 0.6 * n;
    const ph = rand() * Math.PI;
    for (let i = 0; i < len; i++) {
      const t = i / SR;
      const attack = Math.min(1, t / 0.003);
      buf[n0 + i] += amp * a * attack * Math.exp(-decay * t) * Math.sin(2 * Math.PI * fn * t + ph);
    }
  }
}

// Noise-burst metronome click, like the app's.
function click(buf, start, amp = 0.4) {
  const n0 = Math.floor(start * SR);
  for (let i = 0; i < 0.03 * SR; i++) buf[n0 + i] += amp * rand() * Math.exp(-i / (0.006 * SR));
}

// Laptop-mic-ish: 2nd-order high-pass that thins out the low strings' fundamentals, plus hiss.
function micColor(buf, fc = 180, noiseDb = -60) {
  const w = Math.tan(Math.PI * fc / SR);
  const k = Math.SQRT2;
  const norm = 1 / (1 + k * w + w * w);
  const b0 = norm, b1 = -2 * norm, b2 = norm;
  const a1 = 2 * (w * w - 1) * norm, a2 = (1 - k * w + w * w) * norm;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  const nAmp = 10 ** (noiseDb / 20);
  for (let i = 0; i < buf.length; i++) {
    const x = buf[i];
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    buf[i] = y + nAmp * rand();
  }
}

function run(buf, fps = FPS) {
  const tr = new NoteTracker({ sampleRate: SR, frameSize: FRAME });
  tr.setGateDb(-48);
  const frames = [];
  const events = [];
  for (let t = FRAME / SR; t <= buf.length / SR; t += 1 / fps) {
    const end = Math.floor(t * SR);
    const info = tr.process(buf.subarray(end - FRAME, end), t);
    frames.push(info);
    if (info.event) events.push(info.event);
  }
  return { frames, events };
}

// 1 · Every note from Drop C low string to high e fret 20, clean and through a thin mic.
console.log('Single notes, MIDI 36–84:');
const profiles = [
  { name: 'direct', mic: null },
  { name: 'laptop mic', mic: { fc: 180 } },
  { name: 'weak fundamental', mic: { fc: 250 }, fundGain: 0.3 },
];
for (const p of profiles) {
  let frameTotal = 0, frameRight = 0, octaveErr = 0, eventOk = 0;
  const bad = [];
  for (let m = 36; m <= 84; m++) {
    const buf = new Float32Array(SR * 2.2);
    pluck(buf, 0.2, m, { fundGain: p.fundGain ?? 1 });
    if (p.mic) micColor(buf, p.mic.fc);
    const { frames, events } = run(buf);
    for (const f of frames) {
      if (f.t < 0.3 || f.midi == null) continue;
      frameTotal++;
      if (f.midi === m) frameRight++;
      else if (Math.abs(f.midi - m) % 12 === 0) octaveErr++;
    }
    if (events.length === 1 && events[0].midi === m) eventOk++;
    else bad.push(`${m}: ${events.map((e) => e.midi).join(',') || 'none'}`);
  }
  const notes = 84 - 36 + 1;
  console.log(`  ${p.name.padEnd(17)} events right ${eventOk}/${notes} · frames right ${(100 * frameRight / frameTotal).toFixed(1)}% · octave-slipped frames ${octaveErr}`);
  if (bad.length) console.log('    wrong events →', bad.join(' | '));
  check(eventOk === notes, `${p.name}: every note reported exactly once`);
}

// 2 · Behaviour tests.
console.log('Behaviour:');
// Each scenario runs with the analysis loop at 100 fps (the app's timer), 60 fps and a throttled 15 fps.
const scenario = (name, build, expect, rates = [100, 60, 15]) => {
  const buf = new Float32Array(SR * 2.5);
  build(buf);
  micColor(buf);
  const results = rates.map((fps) => {
    const got = run(buf, fps).events.map((e) => e.midi);
    return { fps, got, ok: JSON.stringify(got) === JSON.stringify(expect) };
  });
  const ok = results.every((r) => r.ok);
  const detail = ok ? `[${expect.join(', ')}]` : results.map((r) => `${r.fps} fps [${r.got.join(', ')}]`).join(' · ');
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}: ${detail}${ok ? '' : `, want [${expect.join(', ')}]`}`);
  if (!ok) failures++;
};
scenario('same note picked twice', (b) => { pluck(b, 0.2, 55); pluck(b, 1.0, 55); }, [55, 55]);
scenario('metronome click over a ringing note', (b) => { pluck(b, 0.2, 55); click(b, 0.9); click(b, 1.4); }, [55]);
scenario('clicks only', (b) => { click(b, 0.5); click(b, 1.0); click(b, 1.5); }, []);
scenario('silence (mic hiss)', () => {}, []);
scenario('two different notes', (b) => { pluck(b, 0.2, 45); pluck(b, 0.9, 52); }, [45, 52]);
// 180 ms notes are shorter than three 15 fps frames, so this one only runs at the real loop rates.
scenario('fast picking on one string, 180 ms apart', (b) => { [43, 45, 47, 48].forEach((m, i) => pluck(b, 0.2 + i * 0.18, m, { dur: 0.18 })); }, [43, 45, 47, 48], [100, 60]);
scenario('octave up while the lower string rings on', (b) => { pluck(b, 0.2, 43, { dur: 2.3 }); pluck(b, 1.0, 55, { dur: 1.5 }); }, [43, 55]);
scenario('new note while another string rings on', (b) => { pluck(b, 0.2, 40, { dur: 2.3 }); pluck(b, 1.0, 55, { dur: 1.5 }); }, [40, 55]);
scenario('unison on the next string while the first rings', (b) => { pluck(b, 0.2, 55, { dur: 2.3 }); pluck(b, 1.0, 55, { dur: 1.5, pickPos: 0.3 }); }, [55, 55]);
scenario('low E then G on the A string (wrong-string check)', (b) => { pluck(b, 0.2, 40); pluck(b, 1.0, 55); }, [40, 55]);
scenario('quiet note (−30 dB)', (b) => { pluck(b, 0.2, 52, { amp: 0.02 }); }, [52]);
scenario('octave up while the lower octave rings (B string C4 → high e C5)', (b) => { pluck(b, 0.2, 60, { dur: 2.3 }); pluck(b, 0.8, 72, { dur: 1.7 }); }, [60, 72]);
scenario('octave up, quieter than the ringing note below', (b) => { pluck(b, 0.2, 60, { dur: 2.3, amp: 0.5 }); pluck(b, 1.0, 72, { dur: 1.5, amp: 0.25 }); }, [60, 72]);
scenario('two octaves up over a ringing low string', (b) => { pluck(b, 0.2, 43, { dur: 2.3, amp: 0.4 }); pluck(b, 0.9, 67, { dur: 1.6, amp: 0.25 }); }, [43, 67]);
scenario('wrong note, then the right one while it rings', (b) => { pluck(b, 0.2, 47, { dur: 2.3 }); pluck(b, 0.9, 48, { dur: 1.5 }); }, [47, 48]);
scenario('slide up a fret without re-picking', (b) => {
  // One continuous string: B2 for 0.5 s, then C3, same decay envelope.
  const f = (t) => (t < 0.7 ? 123.47 : 130.81);
  let ph = 0;
  for (let i = Math.floor(0.2 * SR); i < Math.floor(2.0 * SR); i++) {
    const t = i / SR; ph += 2 * Math.PI * f(t) / SR;
    const env = 0.3 * Math.min(1, (t - 0.2) / 0.003) * Math.exp(-1.2 * (t - 0.2));
    b[i] += env * (Math.sin(ph) + 0.5 * Math.sin(2 * ph) + 0.25 * Math.sin(3 * ph));
  }
}, [47, 48]);

// 3 · Timing: playedAt should sit on the attack.
{
  const buf = new Float32Array(SR * 1.5);
  pluck(buf, 0.5, 57);
  micColor(buf);
  const { events } = run(buf);
  const lag = events[0] ? events[0].t - 0.5 : NaN;
  const err = events[0] ? events[0].playedAt - 0.5 : NaN;
  console.log(`Latency: reported ${(lag * 1000).toFixed(0)} ms after the pick; playedAt off by ${(err * 1000).toFixed(0)} ms`);
  check(lag < 0.15, 'reported within 150 ms');
  check(Math.abs(err) < 0.04, 'playedAt within 40 ms of the attack');
}

// 4 · Cost per frame.
{
  const tr = new NoteTracker({ sampleRate: SR, frameSize: FRAME });
  tr.setGateDb(-90);
  const frame = new Float32Array(FRAME);
  pluck(frame, 0, 45, { dur: 1 });
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < 300; i++) tr.process(frame, i / 60);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6 / 300;
  console.log(`Cost: ${ms.toFixed(2)} ms per frame (budget at 60 fps: 16 ms)`);
}

console.log(failures ? `\n${failures} failure(s)` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
