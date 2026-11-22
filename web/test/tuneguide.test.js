// Tests the Tuner page's logic (TuneGuide): string choice, direction, holds, the guided walk-through,
// and the whole chain from synthetic audio through refinePitch and TunerFilter.
// Run: node web/test/tuneguide.test.js
'use strict';
const { TuneGuide, gaugeAngle } = require('../js/tuneguide.js');
const { refinePitch, TunerFilter } = require('../js/pitch.js');

let failures = 0;
const check = (ok, msg) => { if (!ok) { failures++; console.log('  FAIL', msg); } };
const STD = { 1: 64, 2: 59, 3: 55, 4: 50, 5: 45, 6: 40 };
const hz = (midi, cents = 0, a4 = 440) => a4 * 2 ** ((midi - 69 + cents / 100) / 12);
// Feed a steady pitch for `secs`, 30 readings a second; returns the last result.
function feed(g, freq, secs, t0 = 0, spread = 0.2) {
  let r = null;
  let just = [];
  for (let t = t0; t < t0 + secs; t += 1 / 30) {
    r = g.push({ freq, spread, t });
    if (r.justTuned) just.push(r.justTuned);
  }
  return { ...r, just };
}

console.log('auto: follows the nearest string, even far out of tune');
{
  const g = new TuneGuide({ open: STD });
  for (const [s, m] of Object.entries(STD)) {
    for (const off of [-180, -60, 0, 35, 180]) {
      g.pin(null);
      const r = feed(g, hz(m, off), 0.3);
      check(r.string === Number(s), `string ${s} at ${off}¢ → ${r.string}`);
      check(Math.abs(r.cents - off) < 1e-6, `string ${s} at ${off}¢: cents ${r.cents}`);
    }
  }
}

console.log('auto: a single stray reading doesn\'t switch strings');
{
  const g = new TuneGuide({ open: STD });
  feed(g, hz(45, -5), 0.3);
  const r = g.push({ freq: hz(50), spread: 0.2, t: 1 });
  check(r.string === 5, `one D reading while tuning A → ${r.string}`);
  const r2 = feed(g, hz(50), 0.2, 1.1);
  check(r2.string === 4, `several D readings → ${r2.string}`);
}

console.log('direction and far-off');
{
  const g = new TuneGuide({ open: STD, tolerance: 1 });
  g.pin(5);
  check(feed(g, hz(45, -12), 0.2).action === 'up', 'flat → up');
  check(feed(g, hz(45, 12), 0.2).action === 'down', 'sharp → down');
  check(feed(g, hz(45, 0.4), 0.2).action === 'ok', '+0.4¢ inside ±1¢ → ok');
  const far = feed(g, hz(43), 0.2);
  check(far.far && Math.abs(far.semis + 2) < 1e-6 && far.action === 'up', `2 semitones low: ${JSON.stringify(far)}`);
  const oct = feed(g, hz(57, 3), 0.2); // A3 while the A string (A2) is pinned
  check(Math.abs(oct.cents - 3) < 1e-6, `octave folded: ${oct.cents}`);
}

console.log('holds: tuned only after holding steady inside the tolerance');
{
  const g = new TuneGuide({ open: STD, tolerance: 1, holdTime: 0.6 });
  g.pin(1);
  let r = feed(g, hz(64, 0.5), 0.4);
  check(!r.just.length && r.hold > 0.5 && r.hold < 1, `0.4 s: not yet (hold ${r.hold})`);
  r = feed(g, hz(64, 0.5), 0.4, 0.4);
  check(r.just[0] === 1 && r.hold === 1, `0.8 s: tuned (${r.just})`);
  check(g.done.has(1), 'ticked');
  r = feed(g, hz(64, 0.5), 1, 2, 3);
  check(r.just.length === 0, 'not ticked twice');
  // Wobbly readings (spread over the tolerance) don't count.
  const w = new TuneGuide({ open: STD, tolerance: 1 });
  w.pin(1);
  check(feed(w, hz(64, 0), 2, 0, 2.5).just.length === 0, 'unsteady: never tuned');
  // Drifting out a fair way un-ticks it; a small wobble doesn't.
  feed(g, hz(64, 1.8), 0.5, 4);
  check(g.done.has(1), '1.8¢ off: still ticked');
  feed(g, hz(64, 6), 0.5, 5);
  check(!g.done.has(1), '6¢ off: un-ticked');
  // A pause between plucks resets the hold.
  const p = new TuneGuide({ open: STD, holdTime: 0.6 });
  p.pin(2);
  feed(p, hz(59), 0.4);
  p.silence();
  const r2 = feed(p, hz(59), 0.3, 1);
  check(r2.just.length === 0, 'hold doesn\'t carry over a silence');
}

console.log('guide: low E to high e, in order');
{
  const g = new TuneGuide({ open: STD, holdTime: 0.5 });
  g.guide();
  const order = [];
  let t = 0;
  for (let i = 0; i < 6; i++) {
    const s = g.pinned;
    order.push(s);
    feed(g, hz(STD[s], -40), 0.3, t); // out of tune first
    t += 0.3;
    const r = feed(g, hz(STD[s], 0.2), 0.7, t);
    t += 0.7;
    check(r.just[0] === s, `string ${s} tuned in guide`);
  }
  check(order.join('') === '654321', `order ${order.join('')}`);
  check(g.allDone && g.pinned === null, 'all done');
  // The next string's hold starts fresh: a reading the moment it advances doesn't tick it.
  const h = new TuneGuide({ open: STD, holdTime: 0.5 });
  h.guide();
  feed(h, hz(40), 0.7);
  const r = h.push({ freq: hz(45), spread: 0.1, t: 0.71 });
  check(r.string === 5 && r.hold === 0, 'hold reset on advance');
  // Another tuning: drop D starts on the low D.
  const d = new TuneGuide({ open: { ...STD, 6: 38 } });
  d.guide();
  const rd = feed(d, hz(38, 0), 1);
  check(rd.just[0] === 6 && d.pinned === 5, 'drop D low string');
}

console.log('A4 = 442 moves every target');
{
  const g = new TuneGuide({ open: STD, a4: 442 });
  g.pin(5);
  const r = feed(g, hz(45, 0, 442), 0.2);
  check(Math.abs(r.cents) < 1e-6, `A2 at 442: ${r.cents}`);
  const r2 = feed(g, hz(45, 0, 440), 0.2);
  check(Math.abs(r2.cents + 1200 * Math.log2(442 / 440)) < 1e-6, `A2 at 440 vs 442: ${r2.cents}`);
}

console.log('gauge: half the arc is ±10¢');
check(gaugeAngle(0) === 0 && gaugeAngle(10) === 30 && gaugeAngle(-10) === -30, 'ends of the fine half');
check(gaugeAngle(50) === 60 && gaugeAngle(-500) === -60, 'clamped at ±50¢');
check(gaugeAngle(1) > 2.9, '1¢ is 3° of swing');

console.log('end to end: a plucked string, through refinePitch and TunerFilter, to "tuned"');
{
  const sr = 48000;
  const N = 2 ** Math.ceil(Math.log2(sr * 0.17));
  let seed = 7;
  const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff * 2 - 1; };
  const pluck = (f0, t0) => {
    const x = new Float32Array(N);
    for (let h = 1; h * f0 < 6000 && h <= 20; h++) {
      const fh = h * f0;
      const a = Math.abs(Math.sin(h * Math.PI * 0.18)) / h;
      for (let i = 0; i < N; i++) {
        const t = t0 + i / sr;
        x[i] += 0.3 * a * Math.exp(-(1.2 + 0.5 * h) * t) * Math.sin(2 * Math.PI * fh * t + h);
      }
    }
    for (let i = 0; i < N; i++) x[i] += 0.001 * rand();
    return x;
  };
  for (const [want, off, expect] of [[2, 0.3, true], [3, -0.6, true], [6, 4, false], [4, -2.5, false]]) {
    const g = new TuneGuide({ open: STD, tolerance: 1, holdTime: 0.6 });
    const filt = new TunerFilter();
    const f = hz(STD[want], off);
    let last = null;
    let tuned = false;
    for (let t = 0.2; t < 1.6; t += 0.03) {
      const r = refinePitch(pluck(f, t), sr, f * 1.002);
      if (!r) continue;
      const fr = filt.push(r.freq, t);
      if (!fr) continue;
      last = g.push({ freq: fr.freq, spread: fr.spread, t });
      if (last.justTuned) tuned = true;
    }
    check(last && last.string === want, `string ${want}: heard as ${last && last.string}`);
    check(last && Math.abs(last.cents - off) < 0.1, `string ${want} at ${off}¢: read ${last && last.cents.toFixed(3)}¢`);
    check(tuned === expect, `string ${want} at ${off}¢: tuned=${tuned}`);
  }
}

if (failures) { console.log(`\n${failures} failure(s)`); process.exit(1); }
console.log('\nAll tuner-guide tests passed.');
