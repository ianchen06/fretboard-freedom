// Tests the Scales page's logic (scaleneck.js): CAGED names and grips, shapes across the neck,
// routes, backings, the hand-position estimate and the play-along stats.
// Run: node web/test/scaleneck.test.js
'use strict';
globalThis.Theory = require('../js/theory.js');
globalThis.Scales = require('../js/scales.js');
const N = require('../js/scaleneck.js');
const T = globalThis.Theory;
const S = globalThis.Scales;

let failures = 0;
const check = (ok, msg) => { if (!ok) { failures++; console.log('  FAIL', msg); } };
const std = T.TUNINGS.standard;
const mod12 = T.mod12;
const ALL_SCALES = Object.keys(S.SCALES);

// ---------- CAGED letters and grips ----------
console.log('CAGED');
{
  check(N.cagedLetter('minPent', 1) === 'E' && N.cagedLetter('minPent', 4) === 'A', 'minor pentatonic box 1 = E shape, box 4 = A shape');
  check(N.cagedLetter('ionian', 1) === 'G' && N.cagedLetter('ionian', 2) === 'E', 'major position 1 = G shape, position 2 = E shape');
  check(N.isMinorTonic('dorian') && !N.isMinorTonic('phrygDom') && !N.isMinorTonic('mixolydian') && N.isMinorTonic('blues'), 'tonic quality');

  // Every grip: chord tones only, the root on its root string, within 4 frets, one note per string.
  for (const minor of [true, false]) {
    for (const letter of ['C', 'A', 'G', 'E', 'D']) {
      for (let key = 0; key < 12; key++) {
        const g = N.grip(key, minor, letter, 8);
        if (!g) { check(false, `grip ${letter}${minor ? 'm' : ''} in ${key} exists`); continue; }
        const pcs = S.CHORDS[minor ? 'min' : 'maj'].steps.map((x) => mod12(key + x));
        check(g.notes.every((n) => pcs.includes(mod12(n.midi))), `${letter}${minor ? 'm' : ''} grip in ${key}: chord tones only`);
        check(mod12(std.open[g.rootString] + g.rootFret) === key, `${letter} grip in ${key}: root on the ${g.rootString} string`);
        check(g.hi - g.lo <= 4, `${letter} grip in ${key} spans ≤ 4 frets`);
        check(new Set(g.notes.map((n) => n.s)).size === g.notes.length, `${letter} grip: one note per string`);
        const third = minor ? 3 : 4;
        check(g.notes.some((n) => mod12(n.midi - key) === third), `${letter}${minor ? 'm' : ''} grip in ${key} has its 3rd`);
      }
    }
  }
  // A minor: E-shape Am barre at fret 5, D shape at 7 (root on the D string).
  const e = N.grip(9, true, 'E', 6);
  check(e.rootFret === 5 && JSON.stringify(e.notes.map((n) => n.f)) === '[5,7,7,5,5,5]', 'Am E-shape barre at fret 5');
  const d = N.grip(9, true, 'D', 8);
  check(d.rootString === 4 && d.rootFret === 7, 'Am D shape: root on the D string, fret 7');
  // The grip sits inside the box it names, in every key and scale.
  for (const scaleId of ALL_SCALES) {
    const minor = N.isMinorTonic(scaleId);
    for (let key = 0; key < 12; key++) {
      for (const p of N.shapeList(key, scaleId, 'caged')) {
        const g = N.grip(key, minor, p.letter, (p.lo + p.hi) / 2);
        check(g && g.lo >= p.lo - 1 && g.hi <= p.hi + 1, `${scaleId} in ${key}: ${p.letter} grip inside box ${p.k} (frets ${p.lo}–${p.hi}; grip ${g && g.lo}–${g && g.hi})`);
      }
    }
  }
}

// ---------- shapes across the neck ----------
console.log('neck');
{
  const A = N.shapeList(9, 'minPent', 'caged');
  check(JSON.stringify(A.map((p) => [p.k, p.lo])) === '[[4,0],[5,2],[1,5],[2,7],[3,9],[4,12],[5,14],[1,17],[2,19]]', `A minor pentatonic up the neck: ${JSON.stringify(A.map((p) => [p.k, p.lo]))}`);
  check(A.map((p) => p.letter).join('') === 'AGEDCAGED', 'letters in neck order: A G E D C A G E D');
  for (const scaleId of ALL_SCALES) {
    for (let key = 0; key < 12; key++) {
      for (const system of ['caged', 'nps3']) {
        if (system === 'nps3' && !N.hasNps(scaleId)) continue;
        const list = N.shapeList(key, scaleId, system);
        const K = system === 'nps3' ? S.SCALES[scaleId].steps.length : 5;
        const ks = new Set(list.map((p) => p.k));
        check(ks.size === K, `${scaleId} ${system} in ${key}: every shape fits somewhere (${[...ks].join(',')})`);
        check(list.every((p) => p.lo >= 0 && p.hi <= N.MAX_FRET), `${scaleId} ${system} in ${key}: on the neck`);
        check(list.every((p, i) => i === 0 || p.lo >= list[i - 1].lo), `${scaleId} ${system} in ${key}: sorted up the neck`);
        // Every note of every shape is in the scale.
        const pcs = S.pcsOf(key, S.SCALES[scaleId].steps);
        check(list.every((p) => p.notes.every((n) => pcs.has(mod12(n.midi)))), `${scaleId} ${system} in ${key}: notes in the scale`);
      }
      // The CAGED shapes cover the neck: every scale note from fret 2 to 17 is in some shape.
      const list = N.shapeList(key, scaleId, 'caged');
      const covered = new Set(list.flatMap((p) => p.notes.map((n) => `${n.s}:${n.f}`)));
      const missing = N.neckNotes(key, scaleId).filter((n) => n.f >= 2 && n.f <= 17 && !covered.has(`${n.s}:${n.f}`));
      check(!missing.length, `${scaleId} in ${key}: the five shapes cover frets 2–17 (missing ${missing.map((n) => `${n.s}:${n.f}`).join(' ')})`);
    }
  }
  check(N.neckNotes(9, 'minPent').every((n) => [9, 0, 2, 4, 7].includes(mod12(n.midi))) && N.neckNotes(9, 'minPent').length >= 55, 'neck notes');
  check(!N.hasNps('minPent') && !N.hasNps('blues') && N.hasNps('aeolian'), '3 notes per string is for 7-note scales');
}

// ---------- routes ----------
console.log('routes');
{
  const noRepeats = (notes) => notes.every((n, i) => n.midi !== notes[(i + 1) % notes.length].midi);
  for (const scaleId of ALL_SCALES) {
    for (let key = 0; key < 12; key++) {
      const list = N.shapeList(key, scaleId, 'caged');
      for (const span of [2, 3, 5]) {
        for (let from = 0; from + span <= list.length; from++) {
          const r = N.ladder(list, from, span);
          check(r && noRepeats(r.notes), `${scaleId} ladder ${from}+${span} in ${key}: no note twice in a row`);
          // Up and back: the route turns around once at the top and returns to its start.
          check(r.segs.length === 2 * span && r.segs[0].dir === 'up' && r.segs[r.segs.length - 1].dir === 'down', `${scaleId} ladder ${span}: ${2 * span} segments, up first, down last`);
          // Neighbouring segments meet near each other (a shift of at most 5 frets on one string pair).
          for (let i = 1; i < r.notes.length; i++) {
            const a = r.notes[i - 1];
            const b = r.notes[i];
            if (a.seg !== b.seg) check(Math.abs(a.f - b.f) <= 5 && Math.abs(a.s - b.s) <= 1, `${scaleId} ${key} ladder shift ${a.s}:${a.f} → ${b.s}:${b.f}`);
          }
        }
      }
      for (const p of list) {
        const dg = N.diagonal(key, scaleId, p);
        if (dg) {
          check(noRepeats(dg.notes), `${scaleId} diagonal in ${key}: no repeats`);
          check(dg.hi <= N.MAX_FRET && dg.lo >= 0, `${scaleId} diagonal in ${key}: on the neck`);
          check(dg.hi - dg.lo >= 8, `${scaleId} diagonal from box ${p.k} in ${key} climbs the neck (${dg.lo}–${dg.hi})`);
        }
      }
      for (const s of [1, 2, 3, 4, 5, 6]) {
        const o = N.oneStringRun(key, scaleId, s);
        check(o && o.run.every((n) => n.s === s) && noRepeats(o.notes), `${scaleId} one string ${s} in ${key}`);
        check(o && o.hi <= N.MAX_FRET, `${scaleId} one string ${s} in ${key}: on the neck`);
      }
    }
  }
  // Most keys have a diagonal from every box; A minor pentatonic box 1 starts on fret 5.
  const A = N.shapeList(9, 'minPent', 'caged');
  const dg = N.diagonal(9, 'minPent', A.find((p) => p.k === 1));
  check(dg.run[0].f === 5 && dg.run.length === 18 && dg.perString === 3, 'A minor pentatonic diagonal from box 1: 18 notes from fret 5');
  check(JSON.stringify(N.cycleOrder(4)) === '[0,1,2,3,2,1]', 'cycle order ping-pongs');
}

// ---------- backings ----------
console.log('backings');
{
  for (const b of N.BACKINGS) {
    for (const scaleId of b.fits) {
      check(S.SCALES[scaleId], `${b.id}: fits ${scaleId} is a scale`);
      if (b.groove === 'shuffle' || b.groove === 'drone' || S.SCALES[scaleId].steps.length < 7) continue;
      // A 7-note scale that fits has every chord tone of every chord.
      for (let key = 0; key < 12; key++) {
        const pcs = S.pcsOf(key, S.SCALES[scaleId].steps);
        const bars = N.backingBars(b, key, false);
        check(bars.every((c) => c.pcs.every((pc) => pcs.has(pc))), `${b.id} fits ${scaleId} in ${key}`);
      }
    }
  }
  for (const g of Object.keys(N.GENRES)) {
    for (const scaleId of ALL_SCALES) {
      const id = N.defaultBacking(g, scaleId);
      check(N.backingById(id).fits.includes(scaleId), `${g} + ${scaleId}: default backing ${id} fits`);
    }
    for (const scaleId of N.GENRES[g].scales) {
      check(N.defaultBacking(g, scaleId) !== 'drone' || ['lydian', 'phrygDom', 'harmMinor', 'phrygian'].includes(scaleId), `${g}: ${scaleId} has a band backing`);
    }
  }
  const bars = N.backingBars(N.backingById('rockMin'), 9, false);
  check(bars.map((c) => c.name).join(' ') === 'Am F G Am' && bars.map((c) => c.sym).join(' ') === '1m ♭6 ♭7 1m', 'A minor rock: Am F G Am / 1m ♭6 ♭7 1m');
  const blues = N.backingBars(N.backingById('blues12'), 9, false);
  check(blues.map((c) => c.roman).join('') === 'IIIIIVIVIIVIVIV', 'the blues band gets I / IV / V');
}

// ---------- hand tracker and stats ----------
console.log('tracker');
{
  const shapes = N.shapeList(9, 'minPent', 'caged');
  const box1 = shapes.find((p) => p.k === 1);
  const h = new N.HandTracker();
  // Box 1 played up: every note placed where box 1 has it.
  let ok = 0;
  for (const n of box1.notes) { const p = h.place(n.midi, box1); if (p && p.s === n.s && p.f === n.f) ok++; }
  check(ok === box1.notes.length, `box 1 placed in box 1 (${ok}/${box1.notes.length})`);
  // No window: box 3 played after the hand has moved there.
  const box3 = shapes.find((p) => p.k === 3);
  const h2 = new N.HandTracker();
  h2.center = 11;
  ok = 0;
  for (const n of box3.notes) { const p = h2.place(n.midi); if (p && Math.abs(p.f - n.f) <= 1 && p.f >= box3.lo - 1) ok++; }
  check(ok >= box3.notes.length - 1, `box 3 followed by the tracker (${ok}/${box3.notes.length})`);
  const where = N.shapeAt(shapes, { s: 3, f: 7 }, 6);
  check(where && where.k === 1, 'G string fret 7 with the hand at 6 is box 1');
  const where2 = N.shapeAt(shapes, { s: 3, f: 7 }, 8.5);
  check(where2 && where2.k === 2, 'the same note with the hand at 8.5 is box 2');

  const st = new N.JamStats(S.SCALES.minPent.steps.map((x) => mod12(9 + x)));
  const Am = { pcs: [9, 0, 4] };
  const Dm = { pcs: [2, 5, 9] };
  let r = st.note(57, { at: { bar: 0, beat: 0.1 }, chord: Am, next: Dm });
  check(r.inScale && r.chordTone && r.land === true, 'A on beat 1 of Am lands');
  r = st.note(60, { at: { bar: 0, beat: 0.3 }, chord: Am, next: Dm });
  check(r.land === null, 'only the first note near beat 1 is judged');
  r = st.note(62, { at: { bar: 0, beat: 3.9 }, chord: Am, next: Dm });
  check(r.land === true && st.landTotal === 2, 'D just before the Dm bar lands on it');
  r = st.note(66, { at: { bar: 2, beat: 2 }, chord: Am });
  check(!r.inScale && st.inScale === 3 && st.total === 4, 'F♯ is outside A minor pentatonic');
}

// ---------- spelling: one letter per scale degree ----------
console.log('spelling');
{
  const names = (pc, id) => N.spell(pc, id).names.join(' ');
  check(names(9, 'blues') === 'A C D E♭ E G', `A blues: the blue note is E♭ (${names(9, 'blues')})`);
  check(names(4, 'blues') === 'E G A B♭ B D', `E blues (${names(4, 'blues')})`);
  check(names(9, 'phrygian') === 'A B♭ C D E F G', `A Phrygian has B♭, not A♯ (${names(9, 'phrygian')})`);
  check(names(9, 'phrygDom') === 'A B♭ C♯ D E F G', `A Phrygian dominant mixes ♭ and ♯ (${names(9, 'phrygDom')})`);
  check(names(2, 'harmMinor') === 'D E F G A B♭ C♯', `D harmonic minor (${names(2, 'harmMinor')})`);
  check(names(0, 'mixolydian') === 'C D E F G A B♭', `C Mixolydian (${names(0, 'mixolydian')})`);
  check(names(4, 'ionian') === 'E F♯ G♯ A B C♯ D♯' && names(5, 'ionian') === 'F G A B♭ C D E', 'major scales');
  check(N.keyName(3, 'phrygian') === 'D♯' && N.keyName(3, 'aeolian') === 'E♭' && N.keyName(8, 'aeolian') === 'G♯' && N.keyName(6, 'mixolydian') === 'F♯', 'the tonic takes the spelling with fewer accidentals');
  // Every 7-note scale in every key: seven different letters, and each name is the right pitch.
  for (const [id, sc] of Object.entries(S.SCALES)) {
    for (let pc = 0; pc < 12; pc++) {
      const sp = N.spell(pc, id);
      check(sp.names.every((nm, i) => T.pcOf(nm) === (pc + sc.steps[i]) % 12), `${sp.root} ${id}: names match pitches`);
      const plain = sp.names.filter((nm, i) => T.spellAbove(sp.root, sc.steps[i], T.letterSteps(S.degreeLabel(sc.steps[i], { scaleId: id }))) === nm);
      if (sc.steps.length === 7) check(new Set(plain.map((nm) => nm[0])).size === plain.length, `${sp.root} ${id}: one letter per degree (${sp.names.join(' ')})`);
    }
  }
  const chords = (id, pc, tonic) => N.backingBars(N.backingById(id), pc, tonic.includes('♭'), tonic).map((c) => c.name).join(' ');
  check(chords('metalPhryg', 9, 'A') === 'Am B♭ Am B♭', `the ♭II of A is B♭ (${chords('metalPhryg', 9, 'A')})`);
  check(chords('rockMin', 3, 'E♭') === 'E♭m C♭ D♭ E♭m', `the ♭VI of E♭ minor is C♭ (${chords('rockMin', 3, 'E♭')})`);
  check(chords('blues12', 9, 'A').startsWith('A7 A7 A7 A7 D7'), 'blues in A');
  check(S.spellChord('D', 'dom7').join(' ') === 'D F♯ A C' && S.spellChord('B♭', 'min7').join(' ') === 'B♭ D♭ F A♭' && S.spellChord('B', 'm7b5').join(' ') === 'B D F A', 'chord tones stack by letter');
}

console.log(failures ? `\n${failures} failure(s)` : '\nall passed');
process.exit(failures ? 1 : 0);
