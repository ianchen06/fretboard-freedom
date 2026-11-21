// Tests string detection: the inharmonicity estimate, the string model and its calibration, and
// placing notes, against synthetic plucked strings whose stiffness follows string physics.
// Run: node web/test/stringid.test.js
//
// Synthetic audio is not a real guitar. These tests check that the method works when the physics
// holds, and how its accuracy depends on the window length, noise and calibration; they don't
// promise the same numbers from a laptop mic in a room.
'use strict';
const SI = require('../js/stringid.js');

const SR = 48000;
let failures = 0;
const check = (ok, msg) => { if (!ok) { failures++; console.log('  FAIL', msg); } };
let seed = 777;
const rng = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const gauss = () => Math.sqrt(-2 * Math.log(rng() + 1e-12)) * Math.cos(2 * Math.PI * rng());
const midiToFreq = (m) => 440 * 2 ** ((m - 69) / 12);
const OPEN = { 1: 64, 2: 59, 3: 55, 4: 50, 5: 45, 6: 40 };

// One guitar: each string's open B, the default physics times a per-guitar factor (gauge, scale),
// and each string's own small deviation.
function makeGuitar(spread = 0.35) {
  const g = Math.exp(gauss() * spread);
  const b0 = {};
  for (const s of [1, 2, 3, 4, 5, 6]) b0[s] = SI.DEFAULT_B0[s] * g * Math.exp(gauss() * 0.15);
  return b0;
}
const trueB = (guitar, s, f) => guitar[s] * 2 ** (f / 6) * Math.exp(gauss() * 0.06); // note-to-note jitter

// A plucked note, `dur` seconds long, starting `skip` s after the attack (what the analyser gets).
// Real strings don't follow the formula exactly, so the notes are made rougher than the model:
// - each partial is detuned at random by `jitter` cents (body and bridge resonances pull them),
// - the pitch glides down `glide` cents in the first ~60 ms (the string's tension settles after the pick),
// - another string rings underneath at `sympDb` (a neighbour, or the previous note).
function note(midi, B, { dur = 0.17, skip = 0.03, pickPos = 0.12 + 0.1 * rng(), noiseDb = -62, hp = 150, jitter = 1.5, glide = 8, sympDb = -24 } = {}) {
  const n = Math.round(dur * SR);
  const x = new Float32Array(n);
  const f0 = midiToFreq(midi);
  if (sympDb != null) {
    const other = 40 + Math.floor(rng() * 30);
    addPartials(x, midiToFreq(other), SI.DEFAULT_B0[1 + Math.floor(rng() * 6)] * 2, { amp: 10 ** (sympDb / 20), skip: skip + 0.5, pickPos: 0.2, hp, jitter, glide: 0 });
  }
  addPartials(x, f0, B, { amp: 1, skip, pickPos, hp, jitter, glide });
  const nAmp = 10 ** (noiseDb / 20);
  for (let i = 0; i < n; i++) x[i] += nAmp * gauss();
  return { x, f0: f0 * (1 + 0.003 * gauss()) }; // the pitch detector's estimate is a little off
}

function addPartials(x, f0, B, { amp, skip, pickPos, hp, jitter, glide }) {
  const n = x.length;
  const gl = new Float64Array(n); // the glide, as a frequency factor per sample
  for (let i = 0; i < n; i++) gl[i] = 2 ** ((glide * Math.exp(-(skip + i / SR) / 0.06)) / 1200);
  for (let k = 1; k <= 40; k++) {
    const fk = k * f0 * Math.sqrt(1 + B * k * k) * 2 ** ((jitter * gauss()) / 1200);
    if (fk > 10000) break;
    let a = Math.abs(Math.sin(k * Math.PI * pickPos)) / k;
    a *= fk / Math.sqrt(fk * fk + hp * hp); // a small mic thins out the lows
    const dk = 1 + 0.9 * k;
    let ph = rng() * 2 * Math.PI;
    for (let i = 0; i < n; i++) {
      const t = skip + i / SR;
      ph += (2 * Math.PI * fk * gl[i]) / SR;
      x[i] += 0.3 * amp * a * Math.exp(-dk * t) * Math.sin(ph);
    }
  }
}

// ---------- FFT ----------
console.log('fft');
{
  const N = 64;
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  for (let i = 0; i < N; i++) re[i] = Math.cos((2 * Math.PI * 5 * i) / N);
  SI.fft(re, im);
  check(Math.abs(re[5] - N / 2) < 1e-9 && Math.abs(re[N - 5] - N / 2) < 1e-9, 'a cosine lands in its two bins');
  check(Math.abs(re[4]) < 1e-9 && Math.abs(im[6]) < 1e-9, 'and nowhere else');
}

// ---------- measuring B ----------
console.log('inharmonicity estimate');
{
  const errs = [];
  for (const [midi, B] of [[40, 2e-4], [45, 1e-4], [52, 1.5e-4], [55, 1.1e-4], [59, 4e-5], [64, 1.3e-5], [64, 7e-5], [69, 3e-5], [72, 2e-4]]) {
    const { x, f0 } = note(midi, B);
    const r = SI.analyze(x, SR, f0);
    check(r, `measures midi ${midi}`);
    if (!r) continue;
    const e = r.lnB - Math.log(B);
    errs.push(e);
    check(Math.abs(e) < 0.35 || (r.upper && e > 0), `midi ${midi} B=${B}: got ${r.B.toExponential(2)} (ln err ${e.toFixed(2)}, ±${r.sigma.toFixed(2)})`);
    check(Math.abs(r.f0 / midiToFreq(midi) - 1) < 0.002, `midi ${midi}: f0 from the fit`);
  }
  const rms = Math.sqrt(errs.reduce((a, e) => a + e * e, 0) / errs.length);
  console.log(`  ln B error, 170 ms windows: rms ${rms.toFixed(3)}`);
  check(SI.analyze(new Float32Array(8192).map(() => 0.001 * gauss()), SR, 110) === null, 'noise alone: no measurement');
}

// ---------- the model ----------
console.log('model');
{
  const m = new SI.StringModel();
  check(Math.abs(m.lnB(2, 12) - m.lnB(2, 0) - 2 * Math.LN2) < 1e-9, 'B quadruples at the 12th fret');
  const cal = SI.CALIBRATION.map(({ s, f }) => ({ s, f, lnB: Math.log(SI.DEFAULT_B0[s] * 2 * 2 ** (f / 6)), sigma: 0.1 }));
  const fit = SI.StringModel.fit(cal);
  check(fit.calibrated, 'fit is calibrated');
  check([1, 2, 3, 4, 5, 6].every((s) => Math.abs(fit.lnB(s, 3) - m.lnB(s, 3) - Math.LN2) < 1e-6), 'a guitar twice as stiff is fitted');
  const part = SI.StringModel.fit(cal.filter((p) => p.s === 6));
  check(Math.abs(part.lnB(1, 0) - m.lnB(1, 0) - Math.LN2) < 1e-6, 'unmeasured strings follow the measured ones');
  const back = SI.StringModel.fromJSON(JSON.parse(JSON.stringify(fit)));
  check(back.calibrated && Math.abs(back.lnB(4, 5) - fit.lnB(4, 5)) < 1e-12, 'survives JSON');
}

// ---------- telling strings apart ----------
// Notes that can be played in more than one place, each played at a random one of them. The
// locator gets no hand information (a flat prior), so this is the sound alone.
function trial(guitar, model, opts, n = 160) {
  const loc = new SI.StringLocator({ model, handWidth: 1e9 });
  let right = 0;
  let total = 0;
  let confidentWrong = 0;
  let confident = 0;
  for (let i = 0; i < n; i++) {
    const s = 1 + Math.floor(rng() * 6);
    const f = Math.floor(rng() * 13);
    const midi = OPEN[s] + f;
    const places = [1, 2, 3, 4, 5, 6].filter((t) => midi - OPEN[t] >= 0 && midi - OPEN[t] <= 22);
    if (places.length < 2) continue;
    const { x, f0 } = note(midi, trueB(guitar, s, f), opts);
    const feat = SI.analyze(x, SR, f0);
    loc.reset();
    const p = loc.place(midi, null, null, feat);
    total++;
    if (p.s === s) right++;
    if (p.p >= 0.9) { confident++; if (p.s !== s) confidentWrong++; }
  }
  return { acc: right / total, total, confident: confident / total, confWrong: confidentWrong / Math.max(1, confident) };
}

console.log('string identification (sound only)');
{
  const report = (name, r) => console.log(`  ${name}: ${(r.acc * 100).toFixed(0)}% right of ${r.total}; ${(r.confident * 100).toFixed(0)}% confident, ${(r.confWrong * 100).toFixed(1)}% of those wrong`);
  const guitars = [makeGuitar(), makeGuitar(), makeGuitar()];
  const agg = (fn) => {
    const rs = guitars.map(fn);
    return { acc: rs.reduce((a, r) => a + r.acc, 0) / rs.length, total: rs.reduce((a, r) => a + r.total, 0), confident: rs.reduce((a, r) => a + r.confident, 0) / rs.length, confWrong: rs.reduce((a, r) => a + r.confWrong, 0) / rs.length };
  };
  // Calibration: the 12 calibration notes, measured like any other note.
  const calibrate = (g) => SI.StringModel.fit(SI.CALIBRATION.map(({ s, f }) => {
    const { x, f0 } = note(OPEN[s] + f, trueB(g, s, f));
    const r = SI.analyze(x, SR, f0);
    return r && { s, f, lnB: r.lnB, sigma: r.sigma };
  }).filter(Boolean));
  const models = guitars.map(calibrate);

  const unc = agg((g) => trial(g, new SI.StringModel(), {}));
  report('uncalibrated, 170 ms', unc);
  const cal = agg((g) => trial(g, models[guitars.indexOf(g)], {}));
  report('calibrated, 170 ms', cal);
  const short = agg((g) => trial(g, models[guitars.indexOf(g)], { dur: 0.06 }));
  report('calibrated, 60 ms (fast playing)', short);
  const noisy = agg((g) => trial(g, models[guitars.indexOf(g)], { noiseDb: -42 }));
  report('calibrated, noisy room', noisy);
  const rough = agg((g) => trial(g, models[guitars.indexOf(g)], { jitter: 5, sympDb: -14, glide: 20 }));
  report('calibrated, rough (5¢ partial errors, loud neighbour)', rough);

  check(cal.acc >= 0.85, `calibrated: at least 85% right (got ${(cal.acc * 100).toFixed(0)}%)`);
  check(unc.acc >= 0.6, `uncalibrated: at least 60% right (got ${(unc.acc * 100).toFixed(0)}%)`);
  check(cal.confWrong <= 0.08, 'calibrated: few confident mistakes');
  check(cal.acc >= unc.acc, 'calibration helps');
}

// ---------- sound + hand together ----------
// A run that moves up the neck: box at fret 5, then a jump to the 12th position, played on the
// strings a player would use. Hand alone lags behind the jump; sound + hand follows it.
console.log('sound + hand position');
{
  const g = makeGuitar(0.2);
  const model = SI.StringModel.fit(SI.CALIBRATION.map(({ s, f }) => ({ s, f, lnB: Math.log(g[s] * 2 ** (f / 6)), sigma: 0.1 })));
  const line = [];
  for (const [s, f] of [[6, 5], [6, 8], [5, 5], [5, 7], [4, 5], [4, 7], [3, 5], [3, 7], [2, 5], [2, 8], [1, 5], [1, 8]]) line.push({ s, f });
  for (const [s, f] of [[6, 12], [6, 15], [5, 12], [5, 14], [4, 12], [4, 14], [3, 12], [3, 14], [2, 13], [2, 15], [1, 12], [1, 15]]) line.push({ s, f });
  const runWith = (useSound) => {
    const loc = new SI.StringLocator({ model });
    let right = 0;
    for (const { s, f } of line) {
      const midi = OPEN[s] + f;
      let feat = null;
      if (useSound) { const { x, f0 } = note(midi, trueB(g, s, f)); feat = SI.analyze(x, SR, f0); }
      const p = loc.place(midi, null, null, feat);
      if (p.s === s && p.f === f) right++;
    }
    return right / line.length;
  };
  const hand = runWith(false);
  const both = runWith(true);
  console.log(`  hand only ${(hand * 100).toFixed(0)}%, sound + hand ${(both * 100).toFixed(0)}%`);
  check(both > hand, 'the sound fixes notes the hand guess gets wrong');
  check(both >= 0.85, `sound + hand: at least 85% (got ${(both * 100).toFixed(0)}%)`);

  // refine(): a note placed at once from the hand, then corrected when its sound is measured.
  const loc = new SI.StringLocator({ model });
  loc.place(52, null, 'a'); // E3, placed low on the neck: the hand is around fret 2
  const first = loc.place(64, null, 'b'); // E4: from the hand alone, the B string at fret 5
  const { x, f0 } = note(64, g[1]);
  const moved = loc.refine('b', SI.analyze(x, SR, f0));
  check(first.s !== 1 ? moved && moved.s === 1 && moved.f === 0 : moved === null, 'refine moves a note to the open high E when the sound says so');
  check(loc.refine('zzz', { lnB: 0, sigma: 1 }) === null, 'refine of an unknown note does nothing');
}

// ---------- other tunings ----------
console.log('tunings');
{
  const m = new SI.StringModel();
  const dropD = { ...OPEN, 6: 38 };
  check(Math.abs(m.lnB(6, 0, dropD) - m.lnB(6, 0) - (4 * Math.LN2) / 12) < 1e-9, 'a string tuned 2 semitones down: B up by 2^(4/12) (less tension)');
  check(m.lnB(5, 3, dropD) === m.lnB(5, 3), 'the other strings are unchanged');
  // Calibrated in E♭ standard, then used in E♭: the measured values come back.
  const eflat = { 1: 63, 2: 58, 3: 54, 4: 49, 5: 44, 6: 39 };
  const g = makeGuitar(0.2);
  const tunedB = (s, f) => g[s] * 2 ** (f / 6) * 2 ** (2 / 12); // a semitone down: tension × 2^(-2/12)
  const fit = SI.StringModel.fit(SI.CALIBRATION.map(({ s, f }) => ({ s, f, lnB: Math.log(tunedB(s, f)), sigma: 0.1 })), { tuning: eflat });
  check([1, 2, 3, 4, 5, 6].every((s) => Math.abs(fit.lnB(s, 5, eflat) - Math.log(tunedB(s, 5))) < 1e-6), 'calibrated in E♭: right in E♭');
  check([1, 2, 3, 4, 5, 6].every((s) => Math.abs(fit.lnB(s, 5, OPEN) - Math.log(g[s] * 2 ** (5 / 6))) < 1e-6), 'and predicts standard tuning from it');
  const back = SI.StringModel.fromJSON(JSON.parse(JSON.stringify(fit)));
  check(back.ref[6] === 39, 'the tuning it was taught in survives JSON');
  // Drop D: the low string's notes are found on it.
  const loc = new SI.StringLocator({ model: fit, tuning: dropD, handWidth: 1e9 });
  let right = 0;
  for (let f = 5; f <= 9; f++) {
    const { x, f0 } = note(38 + f, g[6] * 2 ** (f / 6) * 2 ** (4 / 12));
    const p = loc.place(38 + f, null, null, SI.analyze(x, SR, f0));
    if (p.s === 6) right++;
  }
  check(right >= 4, `drop D: low-string notes placed on it (${right} of 5)`);
}

// ---------- the string check ----------
console.log('string check');
{
  const g = makeGuitar(0.2);
  const model = SI.StringModel.fit(SI.CALIBRATION.map(({ s, f }) => ({ s, f, lnB: Math.log(g[s] * 2 ** (f / 6)), sigma: 0.1 })));
  const chk = new SI.StringCheck({ model });
  let falseAlarm = 0;
  const caught = { 5: 0, 4: 0 };
  const misnamed = { n: 0 };
  const n = 30;
  // Asked for A3 (57) on the G string, fret 2. Played there, on the A string fret 12 (much stiffer:
  // separable), or on the D string fret 7. The last is a real limit: a plain G is so stiff that the
  // D string at fret 7 measures almost the same (ln B 0.2 apart), so the check must stay quiet there.
  for (let i = 0; i < n; i++) {
    const right = note(57, trueB(g, 3, 2));
    chk.expect(`r${i}`, { s: 3, f: 2, midi: 57 });
    if (chk.check(`r${i}`, SI.analyze(right.x, SR, right.f0))) falseAlarm++;
    for (const [s, f] of [[5, 12], [4, 7]]) {
      const wrong = note(57, trueB(g, s, f));
      chk.expect(`w${s}${i}`, { s: 3, f: 2, midi: 57 });
      const r = chk.check(`w${s}${i}`, SI.analyze(wrong.x, SR, wrong.f0));
      if (r && r.s === s) caught[s]++;
      else if (r) misnamed.n++;
    }
  }
  console.log(`  on the asked-for string: ${falseAlarm} of ${n} flagged; A string fret 12: ${caught[5]} of ${n} caught; D string fret 7: ${caught[4]} of ${n} (too close to tell)`);
  check(falseAlarm <= 1, 'almost never flags a note played on the right string');
  check(caught[5] >= 0.9 * n, 'catches a clearly stiffer string');
  check(misnamed.n === 0, 'never names the wrong other string');
  check(chk.check('nope', { lnB: -9, sigma: 0.1 }) === null, 'unknown note: no answer');
  chk.expect('x', { s: 3, f: 2, midi: 57 });
  check(chk.check('x', null) === null, 'no measurement: no answer');
}

console.log(failures ? `\n${failures} failure(s)` : '\nall passed');
process.exit(failures ? 1 : 0);
