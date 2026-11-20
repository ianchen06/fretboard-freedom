// Tests the lick library, the rule checker, the generator and the grader.
// Run: node web/test/lickgen.test.js
'use strict';
globalThis.Theory = require('../js/theory.js');
const L = require('../js/lickgen.js');
const { blues } = require('../js/licks-blues.js');

let failures = 0;
const check = (ok, msg) => { if (!ok) { failures++; console.log('  FAIL', msg); } };
let seed = 2024;
const rng = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

// ---------- library ----------
console.log('library');
for (const c of blues.cells) {
  const errs = L.check(L.parseNotes(c.notes, blues.refRootFret), L.BAR);
  check(!errs.length, `cell ${c.id}: ${errs.join('; ')}`);
  check(['open', 'end', 'any'].includes(c.role), `cell ${c.id} has a role`);
}
for (const l of blues.licks) {
  const errs = L.check(L.parseNotes(l.notes, blues.refRootFret));
  check(!errs.length, `lick ${l.id}: ${errs.join('; ')}`);
}
const ids = [...blues.cells, ...blues.licks].map((x) => x.id);
check(new Set(ids).size === ids.length, 'ids are unique');

const gen = new L.LickGen(blues, { rng });
check(gen.rejected.length === 0, `generator rejected ${gen.rejected.map((r) => r.id).join(', ')}`);
check(gen.phrases.length >= 150, `at least 150 phrases (got ${gen.phrases.length})`);
for (const lv of [1, 2, 3]) {
  const n = gen.phrases.filter((p) => p.level === lv).length;
  check(n >= 10, `level ${lv} has at least 10 phrases (got ${n})`);
}

// ---------- the rule checker catches mistakes ----------
console.log('rules');
const bad = (notes, why) => check(L.check(L.parseNotes(notes, 5)).length > 0, `should reject: ${why}`);
bad([[0, 'A7b9', 24]], 'bend on the A string');
bad([[0, 'G5', 12], [12, 'hB8', 24]], 'hammer-on across strings');
bad([[0, 'B6', 24]], 'held ♭6');
bad([[0, 'G7', 12], [12, 'G7r', 24]], 'release without a bend');
bad([[0, 'E5', 12], [12, 'e10', 24]], 'stretch wider than 4 frets');
bad([[0, 'e5', 3], [3, 'e8', 3], [6, 'e5', 3], [9, 'e8', 3], [11, 'e5', 24]], 'five notes in a beat');
bad([[0, 'e5', 4]], 'short last note');
bad([[0, 'B8b9', 24]], 'half-step bend that isn’t the curl');
check(L.check(L.parseNotes([[0, 'e8b9', 24]], 5)).length === 0, 'the curl works on the high e too');
check(L.check(L.parseNotes([[0, 'G5b6', 8], [8, 'D7', 24]], 5)).length === 0, 'the curl (♭3 up to 3) is allowed');
let threw = false;
try { L.parseToken('X5'); } catch { threw = true; }
check(threw, 'bad token throws');

// ---------- generator ----------
console.log('generator');
for (const prog of Object.values(L.PROGRESSIONS)) {
  const slots = prog.bars.length / 4;
  for (let slot = 0; slot < slots; slot++) {
    const ctx = L.slotContext(prog.bars, slot);
    for (const level of [1, 2, 3]) {
      const seen = new Set();
      for (let k = 0; k < 60; k++) {
        const p = gen.pick({ level, ctx });
        if (!p) { check(false, `${prog.id} slot ${slot} L${level}: no phrase`); break; }
        seen.add(p.id);
        const errs = L.check(p.notes);
        check(!errs.length, `${p.id}: ${errs.join('; ')}`);
        check(L.fit(p.notes, ctx).fits, `${p.id} fits ${prog.id} slot ${slot}`);
        check(p.level <= level, `${p.id} level ${p.level} <= ${level}`);
      }
      check(seen.size >= 5, `${prog.id} slot ${slot} L${level}: variety (${seen.size} different)`);
    }
  }
}

// Every key: frets stay on the neck, pitches in guitar range.
for (let key = 0; key < 12; key++) {
  const R = L.rootFret(key);
  check(R >= 3 && R <= 14, `root fret for pc ${key} is ${R}`);
  for (const p of gen.phrases) {
    for (const n of L.inKey(p, key)) {
      if (n.fret < 1 || n.fret > 20 || n.midi < 40 || n.midi > 90) { check(false, `${p.id} in pc ${key}: fret ${n.fret} midi ${n.midi}`); break; }
    }
  }
}
// Root fret really is the key's root on the low E string.
check(globalThis.Theory.mod12(40 + L.rootFret(9)) === 9, 'A root on low E');

// Retarget: same notes, only the ending moves, and it now fits.
{
  const p = gen.byId.get('question-bend'); // lands on A
  const ctx = { call: [0, 5], resp: [0, 7] }; // second bar: IV under the call, V under the answer: A doesn't work over V
  check(!L.fit(p.notes, ctx).fits, 'question-bend does not land on V');
  const q = gen.retarget(p, ctx);
  check(q && L.fit(q.notes, ctx).fits, 'retargeted phrase fits');
  if (q) {
    const same = p.notes.slice(0, -1).every((n, i) => JSON.stringify(n) === JSON.stringify(q.notes[i]));
    check(same, 'only the last note changes');
    const deg = L.degreeOf(q.notes[q.notes.length - 1]);
    check([5, 7].includes(deg), `new landing is D or E (got ${L.describeDegree(deg)})`);
    check(q.retargetedFrom === 'question-bend', 'remembers where it came from');
  }
}

// ---------- grading ----------
console.log('grading');
{
  const p = gen.byId.get('question-bend');
  const notes = L.inKey(p, 9);
  const spt = 60 / 80 / L.TPB;
  const exp = L.expectedFor(notes, spt);
  check(exp[0].alt.length === 1 && exp[1].soft, 'bend accepts the unbent fret; release is optional');
  const perfect = notes.map((n) => ({ midi: n.midi, t: n.t * spt + 0.03 }));
  let g = L.grade(exp, perfect);
  check(g.score === 1 && g.pass, `perfect answer scores 1 (got ${g.score})`);
  check(Math.abs(g.offset - 0.03) < 1e-9, 'median offset');

  const noRelease = perfect.filter((_, i) => i !== 1);
  g = L.grade(exp, noRelease);
  check(g.score === 1 && g.results[1].status === 'soft', 'missing the release costs nothing');

  const missOne = perfect.filter((_, i) => i !== 3);
  g = L.grade(exp, missOne);
  check(g.results[3].status === 'miss' && Math.abs(g.score - 4 / 5) < 1e-9, `one miss of five required (got ${g.score})`);

  const unbent = perfect.map((h, i) => (i === 0 ? { ...h, midi: notes[0].fretMidi } : h));
  g = L.grade(exp, unbent);
  check(g.results[0].status === 'alt' && g.score === 1, 'unbent fret accepted as the bend');

  const noisy = [{ midi: 50, t: 0 }, ...perfect.slice(0, 3), { midi: 70, t: 0.9 }, ...perfect.slice(3)];
  g = L.grade(exp, noisy);
  check(g.score === 1 && g.extras === 2, 'extra notes are tolerated and counted');

  const octUp = perfect.map((h) => ({ ...h, midi: h.midi + 12 }));
  check(L.grade(exp, octUp).score < 0.5, 'wrong octave fails with the octave check');
  check(L.grade(exp, octUp, { octave: false }).score === 1, 'any octave passes without it');

  check(L.grade(exp, []).score === 0, 'silence scores 0');
  const reversed = [...perfect].reverse().map((h, i) => ({ ...h, t: i * 0.2 }));
  check(L.grade(exp, reversed).score < 0.5, 'notes out of order don’t count');
}

// collectHeard: a held bend target and a hammer-on show up even without a pick.
{
  const events = [{ midi: 62, t: 0.0 }, { midi: 64, t: 0.5 }];
  const frames = [];
  for (let t = 0; t < 0.3; t += 0.01) frames.push({ t, midi: 62 });
  for (let t = 0.3; t < 0.45; t += 0.01) frames.push({ t, midi: 64 }); // bend reaches E
  for (let t = 0.5; t < 0.7; t += 0.01) frames.push({ t, midi: 64 }); // picked E
  for (let t = 0.7; t < 0.72; t += 0.01) frames.push({ t, midi: 66 }); // a 20 ms blip
  for (let t = 0.8; t < 1.0; t += 0.01) frames.push({ t, midi: 69 }); // hammer-on, no event
  const h = L.collectHeard(events, frames);
  const seq = h.map((x) => x.midi).join(',');
  check(seq === '62,64,64,69', `heard sequence (got ${seq})`);
}

console.log(failures ? `\n${failures} failure(s)` : '\nall lick tests passed');
process.exit(failures ? 1 : 0);
