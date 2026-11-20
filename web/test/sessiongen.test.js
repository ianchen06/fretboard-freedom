// Tests the shape engine (scales.js) and the session generator (sessiongen.js).
// Run: node web/test/sessiongen.test.js
'use strict';
globalThis.Theory = require('../js/theory.js');
const S = require('../js/scales.js');
const G = require('../js/sessiongen.js');
const T = globalThis.Theory;

let failures = 0;
const check = (ok, msg) => { if (!ok) { failures++; console.log('  FAIL', msg); } };
const std = T.TUNINGS.standard;
const frets = (notes, s) => notes.filter((n) => n.s === s).map((n) => n.f);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ---------- shapes match the deck ----------
console.log('shapes');
{
  const A = 9;
  const box = (k) => S.position(A, 'minPent', k);
  check(same([6, 5, 4, 3, 2, 1].map((s) => frets(box(1).notes, s)), [[5, 8], [5, 7], [5, 7], [5, 7], [5, 8], [5, 8]]), 'A minor pentatonic box 1');
  check(same([6, 5, 4, 3, 2, 1].map((s) => frets(box(2).notes, s)), [[8, 10], [7, 10], [7, 10], [7, 9], [8, 10], [8, 10]]), 'box 2');
  check(same([6, 5, 4, 3, 2, 1].map((s) => frets(box(3).notes, s)), [[10, 12], [10, 12], [10, 12], [9, 12], [10, 13], [10, 12]]), 'box 3');
  check(same([6, 5, 4, 3, 2, 1].map((s) => frets(box(4).notes, s)), [[12, 15], [12, 15], [12, 14], [12, 14], [13, 15], [12, 15]]), 'box 4');
  check(same([6, 5, 4, 3, 2, 1].map((s) => frets(box(5).notes, s)), [[3, 5], [3, 5], [2, 5], [2, 5], [3, 5], [3, 5]]), 'box 5');
  const blues = S.position(A, 'blues', 1).notes;
  check(same(frets(blues, 5), [5, 6, 7]) && same(frets(blues, 3), [5, 7, 8]), 'blues box 1 has both ♭5s');
  const pos1 = S.position(A, 'aeolian', 1).notes;
  check(same([6, 5, 4, 3, 2, 1].map((s) => frets(pos1, s)), [[5, 7, 8], [5, 7, 8], [5, 7], [4, 5, 7], [5, 6, 8], [5, 7, 8]]), 'A natural minor position 1');
  const c1 = S.position(0, 'ionian', 1).notes;
  check(same(c1.map((n) => [n.s, n.f]), pos1.map((n) => [n.s, n.f])), 'C major position 1 = A minor position 1');
  const a7 = S.arpeggio(A, 'dom7', 1).notes;
  check(same([6, 5, 4, 3, 2, 1].map((s) => frets(a7, s)), [[5], [4, 7], [5, 7], [6], [5, 8], [5]]), 'A7 arpeggio, E shape');
  const tri = S.triadVoicings(A, 'maj', 'gbe').filter((v) => v.lo >= 5 && v.lo <= 9);
  check(tri.some((v) => v.inv === 1 && same(v.notes.map((n) => n.f), [6, 5, 5])), 'A major 1st inversion on G-B-e at 6-5-5');
}

// Every shape in every key: right notes, ascending, playable.
for (let key = 0; key < 12; key++) {
  for (const scaleId of Object.keys(S.SCALES)) {
    const pcs = new Set(S.SCALES[scaleId].steps.map((x) => T.mod12(key + x)));
    const shapes = [];
    for (let k = 1; k <= 5; k++) shapes.push([`pos ${k}`, S.position(key, scaleId, k)]);
    if (S.SCALES[scaleId].steps.length === 7) for (let k = 1; k <= 7; k++) shapes.push([`3nps ${k}`, S.nps(key, scaleId, k)]);
    for (const [what, sh] of shapes) {
      const tag = `${T.noteName(key)} ${scaleId} ${what}`;
      check(sh, `${tag} fits on the neck`);
      if (!sh) continue;
      const ns = sh.notes;
      check(ns.every((n) => pcs.has(T.mod12(n.midi)) && n.midi === std.open[n.s] + n.f && n.f >= 0), `${tag}: every note in the scale and where it says`);
      check(ns.every((n, i) => i === 0 || n.midi > ns[i - 1].midi), `${tag}: ascending, each pitch once`);
      check(ns.every((n, i) => i === 0 || S.nextPitch(pcs, ns[i - 1].midi) === n.midi), `${tag}: no scale note skipped`);
      for (let s = 1; s <= 6; s++) {
        const f = frets(ns, s);
        if (!f.length) { check(false, `${tag}: string ${s} is empty`); continue; }
        check(Math.max(...f) - Math.min(...f) <= (what.startsWith('3nps') ? 5 : 4), `${tag}: string ${s} spans ${Math.max(...f) - Math.min(...f)} frets`);
      }
      check(sh.hi - sh.lo <= (what.startsWith('3nps') ? 7 : 6), `${tag}: spans ${sh.hi - sh.lo + 1} frets`);
      if (what.startsWith('3nps')) check([1, 2, 3, 4, 5, 6].every((s) => frets(ns, s).length === 3), `${tag}: 3 per string`);
      if (S.SCALES[scaleId].steps.length === 5 && what.startsWith('pos')) check([1, 2, 3, 4, 5, 6].every((s) => frets(ns, s).length === 2), `${tag}: 2 per string`);
    }
  }
  for (const chordId of Object.keys(S.CHORDS)) {
    for (let k = 1; k <= 5; k++) {
      const sh = S.arpeggio(key, chordId, k);
      if (!sh) continue;
      const pcs = new Set(S.CHORDS[chordId].steps.map((x) => T.mod12(key + x)));
      check(sh.notes.every((n) => pcs.has(T.mod12(n.midi))), `${T.noteName(key)}${chordId} arpeggio ${k}: chord tones only`);
      check(sh.notes.every((n, i) => i === 0 || S.nextPitch(pcs, sh.notes[i - 1].midi) === n.midi), `${T.noteName(key)}${chordId} arpeggio ${k}: no chord tone skipped`);
    }
  }
  for (const setId of Object.keys(S.STRING_SETS)) {
    for (const chordId of ['maj', 'min']) {
      const vs = S.triadVoicings(key, chordId, setId);
      check(new Set(vs.map((v) => v.inv)).size === 3, `${T.noteName(key)}${chordId} on ${setId}: all 3 inversions`);
      const pcs = new Set(S.CHORDS[chordId].steps.map((x) => T.mod12(key + x)));
      check(vs.every((v) => new Set(v.notes.map((n) => T.mod12(n.midi))).size === 3 && v.notes.every((n) => pcs.has(T.mod12(n.midi)))), `${T.noteName(key)}${chordId} on ${setId}: complete triads`);
    }
  }
}

// ---------- sequences ----------
console.log('sequences');
for (const id of Object.keys(G.SEQS)) {
  for (const n of [12, 17, 18]) {
    const idx = G.seqIndices(n, id);
    const loop = [...idx, idx[0]];
    check(loop.every((x, i) => i === 0 || x !== loop[i - 1]), `${id} on ${n} notes never repeats a note, even where it loops`);
    check(idx.every((x) => x >= 0 && x < n), `${id} on ${n}: indices in range`);
  }
}
check(same(G.seqIndices(5, 'threes'), [0, 1, 2, 1, 2, 3, 2, 3, 4, 3, 2, 1]), 'in 3s: up in groups, back down');

// ---------- every family builds in every key ----------
console.log('families');
const learner = new G.Learner({}, { start: 'scales' });
const ctxFor = (seed) => ({
  rng: G.mulberry32(seed), learner, today: '2026-11-20', focus: new Set(['pent', 'scales', 'arps', 'metal', 'tech']), keyMode: 'rotate', fixedKey: 9,
  keyOfDay: 0, usedSkills: new Set(), usedFams: new Map(), newCount: 0, newCap: 99,
});
for (const [famId, fam] of Object.entries(G.FAM)) {
  const cands = fam.cands(ctxFor(1));
  let built = 0;
  let tried = 0;
  for (const c of cands) {
    for (let key = 0; key < 12; key++) {
      const ctx = { ...ctxFor(key * 31 + 7), keyMode: 'fixed', fixedKey: key };
      const d = fam.make({ ...c }, ctx);
      tried++;
      const ex = G.buildExercise(JSON.parse(JSON.stringify(d)));
      if (!ex) continue;
      built++;
      const tag = `${famId} ${c.skill} in ${T.noteName(key)}`;
      check(typeof ex.title === 'string' && ex.how && ex.why, `${tag}: has text`);
      check(ex.notes.every((n) => n.midi === std.open[n.s] + n.f || n.bend), `${tag}: notes sit where they say`);
      if (ex.grade === 'seq') {
        check(ex.notes.length >= 2, `${tag}: has notes`);
        check(ex.tempoKey, `${tag}: has a tempo ladder`);
      }
      if (ex.allowed && ex.grade === 'seq' && famId !== 'chromatic' && famId !== 'bends') {
        const al = new Set(ex.allowed);
        check(ex.notes.every((n) => al.has(T.mod12(n.midi))), `${tag}: every note in the scale`);
      }
      check(same(G.buildExercise(JSON.parse(JSON.stringify(d))).notes, ex.notes), `${tag}: same descriptor, same exercise`);
    }
  }
  check(built >= tried * 0.85, `${famId}: builds in most keys (${built}/${tried})`);
}

// ---------- the plan ----------
console.log('plan');
for (const minutes of [60, 75, 90, 105, 120]) {
  for (const focus of [['pent', 'scales', 'arps', 'metal', 'tech'], ['pent'], ['metal'], ['scales', 'arps']]) {
    const plan = G.buildPlan({ date: '2026-11-20', minutes, focus, learner: new G.Learner({}, { start: 'box1' }) });
    const tag = `${minutes} min, ${focus.join('+')}`;
    const total = plan.items.reduce((a, x) => a + x.minutes, 0);
    check(total === minutes, `${tag}: minutes add up (${total})`);
    const ex = plan.items.filter((x) => x.kind === 'ex');
    check(ex.length >= minutes / 8, `${tag}: enough exercises (${ex.length})`);
    const main = ex.filter((x) => x.block !== 'review');
    check(new Set(main.map((x) => x.desc.skill)).size === main.length, `${tag}: no skill twice (review aside)`);
    check(ex.every((x) => x.minutes >= 3 && x.minutes <= 12), `${tag}: exercise lengths 3–12 min`);
    check(plan.items.filter((x) => x.kind === 'rest').length === Math.floor((minutes + 5) / 35), `${tag}: breaks`);
    check(ex.every((x) => G.buildExercise(x.desc)), `${tag}: every exercise builds`);
    check(ex.every((x, i) => i < 2 || x.desc.fam === 'shape' || !(x.desc.fam === ex[i - 1].desc.fam && x.desc.fam === ex[i - 2].desc.fam)), `${tag}: no family 3 times in a row`);
    if (focus.length === 5) check(new Set(ex.map((x) => x.desc.fam)).size >= (minutes >= 90 ? 8 : 7), `${tag}: variety (${new Set(ex.map((x) => x.desc.fam)).size} families)`);
  }
}
{
  const a = G.buildPlan({ date: '2026-11-20', minutes: 90, learner: new G.Learner() });
  const b = G.buildPlan({ date: '2026-11-20', minutes: 90, learner: new G.Learner() });
  const c = G.buildPlan({ date: '2026-11-21', minutes: 90, learner: new G.Learner() });
  check(same(a, b), 'same day, same plan');
  check(!same(a.items, c.items), 'next day, new plan');
  check(G.keyOfDay('2026-11-21') === T.mod12(G.keyOfDay('2026-11-20') + 5), 'key of the day moves up a 4th');
  const fresh = new G.Learner({}, { start: 'box1' });
  const p = G.buildPlan({ date: '2026-11-20', minutes: 90, focus: ['pent'], learner: fresh });
  const boxes = p.items.filter((x) => x.kind === 'ex' && /^box:minPent:/.test(x.desc.skill)).map((x) => x.desc.k);
  check(boxes.every((k) => k <= 2), `a box-1 player gets boxes 1–2 first (got ${boxes.join(',')})`);
  const rev = p.items.filter((x) => x.block === 'review');
  const news = p.items.filter((x) => x.kind === 'ex' && x.block !== 'review').map((x) => x.desc.skill);
  check(rev.every((x) => news.includes(x.desc.skill)), 'day 1: review revisits today’s new material');
  check(p.items.some((x) => x.desc && x.desc.skill === 'box:minPent:2' && x.desc.focus), 'a box-1 player gets box 2 as today’s focus');
  const L2 = new G.Learner({}, { start: 'box1' });
  L2.update('box:minPent:2', 0.95, '2026-11-18');
  L2.update('box:minPent:2', 0.95, '2026-11-19');
  check(G.buildPlan({ date: '2026-11-20', minutes: 60, focus: ['pent'], learner: L2 }).items.some((x) => x.desc && x.desc.skill === 'box:minPent:3' && x.desc.focus), 'once box 2 is solid, box 3 is the focus');
}

// ---------- rhythm in the plan ----------
console.log('rhythm');
{
  const R = require('../js/rhythm.js');
  for (const minutes of [60, 90, 120]) {
    for (const focus of [['pent'], ['metal'], ['pent', 'scales', 'arps', 'metal', 'tech']]) {
      const plan = G.buildPlan({ date: '2026-11-20', minutes, focus, learner: new G.Learner({}, { start: 'box1' }) });
      const rh = plan.items.filter((x) => x.block === 'rhythm');
      const tag = `${minutes} min, ${focus.join('+')}`;
      check(rh.length >= 1 && rh.length <= 2, `${tag}: one or two rhythm exercises (${rh.length})`);
      for (const x of rh) {
        const ex = G.buildExercise(x.desc);
        check(ex.grade === 'rhythm' && R.byId(ex.rhythm.id) && R.CLICK_MODES.includes(ex.rhythm.click.mode), `${tag}: ${x.desc.skill} is a rhythm exercise`);
        check(ex.tempoKey === `${x.desc.skill}:tempo` && ex.startBpm > 0, `${tag}: ${x.desc.skill} has a tempo ladder`);
      }
      const order = plan.items.filter((x) => x.kind === 'ex').map((x) => x.block);
      check(order.indexOf('rhythm') > order.lastIndexOf('warmup'), `${tag}: rhythm comes after the warm-up`);
    }
  }
  const fresh = new G.Learner({}, { start: 'box1' });
  check(fresh.mastery('rhythm:quarters') === 0.6 && fresh.mastery('rhythm:funk') === 0, 'rhythm priors');
  const day1 = G.buildPlan({ date: '2026-11-20', minutes: 90, focus: ['pent'], learner: fresh });
  check(day1.items.some((x) => x.desc && x.desc.skill === 'rhythm:eighths' && x.desc.focus), 'day 1: 8ths are the rhythm focus');
  check(day1.items.filter((x) => x.block === 'rhythm').every((x) => !['funk', 'ladder', 'gap13', 'threes'].includes(x.desc.id)), 'day 1: nothing far ahead');
  const L = new G.Learner({}, { start: 'box1' });
  L.update('rhythm:eighths', 0.95, '2026-11-18');
  L.update('rhythm:eighths', 0.95, '2026-11-19');
  check(G.buildPlan({ date: '2026-11-20', minutes: 90, focus: ['pent'], learner: L }).items.some((x) => x.desc && x.desc.skill === 'rhythm:sixteenths' && x.desc.focus), 'once 8ths are solid, 16ths are the focus');
  // With the main rhythm path done, Metal moves on to chugs.
  const M = new G.Learner({}, { start: 'box1' });
  for (const id of ['quarters', 'eighths', 'sixteenths', 'triplets', 'pop', 'ballad16', 'gap22', 'chuck24', 'tresillo', 'funk']) for (const d of ['2026-11-17', '2026-11-18', '2026-11-19']) M.update(`rhythm:${id}`, 0.97, d);
  check(G.buildPlan({ date: '2026-11-20', minutes: 90, focus: ['metal'], learner: M }).items.some((x) => x.desc && x.desc.skill === 'rhythm:chug8' && x.desc.focus), 'metal focus: downpicked chugs next');
  // A solid pattern sometimes comes back with less click.
  const S2 = new G.Learner({}, { start: 'box1' });
  for (const d of ['2026-11-17', '2026-11-18', '2026-11-19']) S2.update('rhythm:pop', 0.97, d);
  const modes = new Set();
  for (let seed = 0; seed < 40; seed++) modes.add(G.FAM.rhythm.make({ fam: 'rhythm', id: 'pop', cat: 'strum', skill: 'rhythm:pop' }, { rng: G.mulberry32(seed), learner: S2 }).click.mode);
  check(modes.has('all') && (modes.has('gap') || modes.has('24')), `solid patterns vary the click (${[...modes]})`);
  check(G.FAM.rhythm.make({ fam: 'rhythm', id: 'gap13', cat: 'clock', skill: 'rhythm:gap13' }, { rng: G.mulberry32(1), learner: S2 }).click.on === 1, 'inner-clock patterns keep their own click');
  check(new G.Learner().tempo('rhythm:pop:tempo', 2, 80) === 80, 'a rhythm exercise starts at its own tempo');
  const g = new G.RhythmGrade({});
  check(g.score() === null, 'no passes, no score');
  g.pass({ hitRate: 1, bias: 3, spread: 8, extras: 0, n: 16, score: 0.95 }, { clean: true });
  g.pass({ hitRate: 0.8, bias: 20, spread: 30, extras: 2, n: 16, score: 0.6 }, { clean: false });
  check(Math.abs(g.score() - 0.775) < 1e-9 && g.cleanStreak === 0 && g.passes.length === 2, `rhythm grade (${g.score()})`);
}

// ---------- the learner ----------
console.log('learner');
{
  const L = new G.Learner({}, { start: 'box1' });
  check(L.mastery('box:minPent:1') === 0.7 && L.mastery('box:minPent:4') === 0, 'priors');
  L.update('box:minPent:2', 0.9, '2026-11-20');
  check(L.mastery('box:minPent:2') > 0.3, 'a good score raises mastery');
  check(L.dueIn('box:minPent:2', '2026-11-20') > 1, 'a good score spaces the next review');
  L.update('box:minPent:3', 0.3, '2026-11-20');
  check(L.dueIn('box:minPent:3', '2026-11-21') <= 0, 'a bad score is due tomorrow');
  L.saveTempo('k', { bpm: 80, cleanBpm: 80 });
  check(L.tempo('k', 2) === 80 && L.best('k') === 80, 'tempo ladder remembers');
  L.saveTempo('k', { bpm: 84, struggled: true });
  check(L.tempo('k', 2) === 80 && L.best('k') === 80, 'struggling steps back down');
  const plan = G.buildPlan({ date: '2026-11-21', minutes: 60, focus: ['pent'], learner: L });
  const rev = plan.items.filter((x) => x.block === 'review');
  check(rev.length >= 1, 'there is a review block');
}

// ---------- graders ----------
console.log('graders');
{
  const ex = G.buildExercise({ fam: 'shape', system: 'pos', scaleId: 'minPent', k: 1, skill: 'box:minPent:1', seq: 'straight', npb: 2, key: 9, alt: 0, tags: ['pent'] });
  const g = new G.SeqGrader(ex);
  for (const n of ex.notes) g.note(n.midi, 0.01);
  check(g.passes.length === 1 && g.passes[0].acc === 1 && g.passes[0].clean, 'a perfect pass is clean');
  const ev = [];
  ex.notes.forEach((n, i) => { if (i !== 3) ev.push(...g.note(n.midi, 0.02)); });
  check(g.passes[1].miss === 1 && g.passes[1].hits === ex.notes.length - 1, 'a skipped note is missed, the rest still count');
  g.note(30, 0);
  check(g.pass.wrong === 1, 'a stray note is wrong');
  check(g.score() > 0.9, `score (${g.score()})`);

  const bend = G.buildExercise({ fam: 'bends', k: 1, skill: 'bends', key: 9, curl: false });
  const bg = new G.SeqGrader(bend);
  const [ref, b] = bend.notes;
  bg.note(ref.midi);
  check(bg.i === 1, 'the fretted target');
  check(bg.frame({ midi: b.midi, cents: 0 }, 1.0).length === 0 && bg.frame({ midi: b.midi, cents: 0 }, 1.1).length === 0, 'the ringing target alone doesn’t count as the bend');
  bg.note(b.from);
  let hit = [];
  for (let t = 2; t < 2.1; t += 0.01) hit = hit.concat(bg.frame({ midi: b.midi, cents: -12 }, t));
  check(hit.some((e) => e.kind === 'hit' && Math.round(e.cents) === -12), 'the bend counts once it holds at pitch, with its cents');

  const ch = G.buildExercise({ fam: 'changes', k: 1, skill: 'changes:1', prog: 'quick4', key: 9 });
  const fg = new G.FreeGrader(ch);
  check(fg.note(61, { bar: 0, beat: 0.1, chord: 0 }).ok, 'C♯ fits A7');
  check(!fg.note(60, { bar: 0, beat: 1, chord: 0 }).ok, 'C doesn’t fit A7 (chord tones only)');
  check(fg.note(66, { bar: 1, beat: 0.1, chord: 1 }).land === true, 'F♯ lands on D7');
  const tg = new G.FreeGrader(G.buildExercise({ fam: 'targets', prog: 'quick4', k: 1, skill: 'targets:quick4', key: 9 }));
  check(tg.note(61, { bar: 0, beat: 0, chord: 0 }).ok && tg.note(60, { bar: 0, beat: 2, chord: 0 }).ok, 'scale + chord: C♯ and C both fit over A7');
  check(tg.note(64, { bar: 1, beat: 0.2, chord: 1 }).land === false, 'E on beat 1 of D7 is not the 3rd');
}

// ---------- names ----------
console.log('names');
{
  // A dominant blues is named like a major key, and each chord's 3rd is spelled from the chord.
  const thirds = (key) => G.buildExercise({ fam: 'targets', prog: 'quick4', k: 1, skill: 'targets:quick4', key }).how.match(/\((.*)\)/)[1];
  check(thirds(2) === 'F♯ over D7, B over G7, C♯ over A7', `blues in D (${thirds(2)})`);
  check(thirds(7) === 'B over G7, E over C7, F♯ over D7', `blues in G (${thirds(7)})`);
  check(thirds(8) === 'C over A♭7, F over D♭7, G over E♭7', `blues in A♭, not G♯ (${thirds(8)})`);
  check(thirds(6) === 'A♯ over F♯7, D♯ over B7, E♯ over C♯7', `blues in F♯ (${thirds(6)})`);
  const names = (prog, key, flat) => G.chordsOf(prog, key, flat).map((c) => c.name).join(' ');
  check(names('rockMin', 3, true) === 'E♭m C♭ D♭ E♭m', `i–♭VI–♭VII in E♭ minor (${names('rockMin', 3, true)})`);
  check(names('rockMaj', 6, true) === 'G♭ D♭ E♭m C♭', `I–V–vi–IV in G♭ (${names('rockMaj', 6, true)})`);
  check(names('andalusian', 9, false) === 'Am G F E' && names('iiVI', 10, true) === 'Cm7 F7 B♭maj7 B♭maj7', 'other progressions');
  for (const prog of Object.keys(G.PROGS)) {
    for (let key = 0; key < 12; key++) {
      for (const flat of [false, true]) {
        for (const c of G.chordsOf(prog, key, flat)) check(c.tones.every((nm, i) => T.pcOf(nm) === c.pcs[i]) && T.pcOf(c.name.match(/^[A-G][♯♭]?/)[0]) === c.root, `${prog} key ${key}: ${c.name} ${c.tones}`);
      }
    }
  }
  // Scale exercises carry their note names by degree.
  const ex = G.buildExercise({ fam: 'shape', system: 'pos', scaleId: 'phrygian', k: 1, skill: 'pos:phrygian:1', key: 9, seq: 'straight', npb: 2, alt: 0 });
  check(ex.names[10] === 'B♭' && /^A Phrygian/.test(ex.title), `A Phrygian names its ♭2 B♭ (${ex.names[10]})`);
  const hm = G.buildExercise({ fam: 'pedal', s: 1, skill: 'pedal:1', scaleId: 'harmMinor', key: 2 });
  check(hm.names[1] === 'C♯' && hm.names[10] === 'B♭', 'D harmonic minor: B♭ and C♯');
  const one = (key, s) => G.buildExercise({ fam: 'onestring', s, skill: `onestring:${s}`, scaleId: 'minPent', seq: 'straight', key });
  check(/root to the root an octave up/.test(one(9, 6).how) && /root is at fret 10/.test(one(2, 6).how), 'one string: the text says where the line really runs');
}

// ---------- bends: the curl ----------
console.log('bends');
{
  const kinds = (curl) => G.buildExercise({ fam: 'bends', k: 1, skill: 'bends', key: 9, curl }).chips.find((c) => c[0] === 'Bends')[1];
  check(!/→ 3\b/.test(kinds(false)) && /♭3 → 3/.test(kinds(true)), `the curl (♭3 → 3) comes up when asked for (${kinds(true)})`);
  const ex = G.buildExercise({ fam: 'bends', k: 1, skill: 'bends', key: 9, curl: true });
  for (let i = 0; i < ex.notes.length; i += 2) check(ex.notes[i].midi === ex.notes[i + 1].midi && ex.notes[i + 1].from === ex.notes[i + 1].midi - ex.notes[i + 1].bend, 'every bend has its fretted target first');
}

console.log(failures ? `\n${failures} failure(s)` : '\nall passed');
process.exit(failures ? 1 : 0);
