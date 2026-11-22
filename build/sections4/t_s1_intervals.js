// Theory Intensive · Part 1 · Intervals: the atoms (slides 4–12)
const T = require('../lib/theory');
const D = require('../lib/draw');
const I = require('../lib/intensive');
const { HEX, M, CONTENT_TOP, section } = require('../lib/deck');

const K = '1 · Intervals';
const FULL_W = 12.13;

const assert = (c, msg) => { if (!c) throw new Error(`Part 1 check failed: ${msg}`); };

// Role used to color an interval name (by its semitone size).
function ivRole(iv) {
  const sm = T.mod12(T.intervalSemitones(iv));
  if (sm === 0) return 'root';
  if (sm === 3 || sm === 4) return 'third';
  if (sm === 7) return 'fifth';
  if (sm === 10 || sm === 11) return 'seventh';
  if (sm === 6) return 'blue';
  return null;
}
const colorIv = (iv) => { const r = ivRole(iv); return r ? `{${r}:${iv}}` : `**${iv}**`; };

// Small rounded pill with a centered label.
function pill(pres, s, { x, y, w, h, label, hi }) {
  s.addText(label, {
    shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: 0.06, x, y, w, h,
    fill: { color: hi ? HEX.pearl : HEX.card2 }, line: { color: hi ? HEX.pearl : HEX.card2, width: 0 },
    color: hi ? HEX.bg : HEX.white, bold: true, fontSize: 15, align: 'center', valign: 'middle', margin: 0, fontFace: 'Arial',
  });
}

function build(pres) {
  section(pres, 'Intervals');

  // 4 · Divider
  D.divider(pres, {
    num: 1,
    title: 'Intervals: the atoms',
    subtitle: 'Every scale, chord and melody is a set of distances between notes. Learn to name them, spell them, see them and hear them.',
    outcomes: [
      'Spell notes by letter, including double sharps and flats',
      'Name any interval by number and quality',
      'Play every interval as a shape from any string',
      'Invert intervals and use compound names (9, 11, 13)',
      'Explain consonance with the harmonic series',
    ],
    notes: `Part 1: Intervals, the atoms of harmony.

An interval is the distance between two notes. That sounds too simple to deserve a whole part, but everything later in this deck is built from intervals. A scale is a list of intervals above a root. A chord is a stack of intervals. A key signature exists because of the intervals in the major scale. A melody is a chain of intervals in time. If your interval knowledge is shaky, every later topic feels like memorizing lists. If it's solid, most of theory becomes something you can work out on the spot.

This part goes deeper than the usual "count the frets" approach in three ways:
• Spelling. Two notes on the same fret can be different intervals depending on their letter names. C up to E♭ is a minor 3rd; C up to D♯ is an augmented 2nd. Same sound, different job. Getting the letters right is what makes chord symbols, key signatures and Roman numerals work.
• Shapes. On the guitar, an interval is a physical shape. You'll learn the whole set from a 6th-string root and see exactly how the B string bends every shape that crosses it.
• Sound. The harmonic series explains why some intervals sound stable and others tense, and why a power chord sounds huge under distortion while a major 3rd turns to mud.

Work with the guitar in your lap. Every time a slide names an interval, play it, sing it, and say its full name out loud: "minor sixth", not just "six frets". The worksheet at the end tests spelling without the guitar, then the neck drills turn the shapes into reflexes.`,
  });

  // 5 · Pitch, half steps and spelling
  {
    const s = D.slideOf(pres, {
      kicker: K, title: 'Pitch, half steps and spelling',
      notes: `There are 12 different pitches in an octave, and on the guitar each fret is one of them: one fret is one half step. Twelve half steps take you from C to the next C.

The ruler shows those 12 half steps from C. The seven natural notes (the letters A to G) are filled in. The brackets underneath show that most natural notes are a whole step (2 frets) apart, but E–F and B–C are only a half step apart. Those two half steps are the only irregularity in the musical alphabet, and they're the reason the major scale has the shape it does.

The in-between frets have two names each: C♯ or D♭, F♯ or G♭, and so on. Two names for one pitch are called enharmonic. So which name is right? The rule that settles it: spell by letter first. A seven-note scale uses each letter exactly once, in order. D major is D E F♯ G A B C♯. If you wrote G♭ instead of F♯, you'd have two G's and no F, and every rule that counts letters (intervals, chord spelling, key signatures) would break.

Sometimes the letter rule forces unusual names. G♯ harmonic minor raises its 7th degree, F♯, by a half step. The letter must stay F, so the note is F double-sharp (written F♯♯ here; you'll also see F𝄪 or Fx). It sounds the same as G, but the scale already has a G♯ (its root) and still needs an F. Likewise C°7 contains B♭♭, which sounds like A.

Try it now: play the A string from the open string to fret 12 and say both names for every in-between fret. Then spell E major (4 sharps) by letter: E F♯ G♯ A B C♯ D♯.

Common mistake: picking sharps or flats by habit. The key and the letter decide, never your preference.`,
    });
    const marks = [];
    for (let i = 0; i <= 12; i++) {
      const p = i % 12;
      if (!T.SHARP[p].includes('♯')) marks.push({ semi: i, label: T.SHARP[p], role: p === 0 ? 'root' : 'note' });
    }
    const rl = I.ruler(s, { x: M, y: CONTENT_TOP + 0.05, w: FULL_W, h: 0.7, marks });
    // both names in the in-between cells
    for (let i = 0; i <= 12; i++) {
      const p = i % 12;
      if (!T.SHARP[p].includes('♯')) continue;
      s.addText([
        { text: T.SHARP[p], options: { bold: true, color: HEX.text, fontSize: 13, breakLine: true } },
        { text: T.FLAT[p], options: { bold: true, color: HEX.muted, fontSize: 13 } },
      ], { x: rl.cx(i) - rl.cellW / 2, y: CONTENT_TOP + 0.05 + 0.26, w: rl.cellW, h: 0.7, align: 'center', valign: 'middle', margin: 0, isTextBox: true, lineSpacingMultiple: 0.95 });
    }
    // left: spelling rows
    const lx = M; let y = 3.18;
    const dMaj = T.spellScale('D', 'major');
    assert(dMaj.join(' ') === 'D E F♯ G A B C♯', 'D major spelling');
    I.heading(s, 'Right: D major uses each letter once', lx, y, 7.2);
    I.noteRow(s, { x: lx, y: y + 0.4, d: 0.48, gap: 0.16, notes: dMaj.map((n, i) => ({ label: n, sub: T.FORMULAS.major[i], role: n.length > 1 ? 'blue' : 'note' })) });
    y += 1.22;
    const wrong = ['D', 'E', 'G♭', 'G', 'A', 'B', 'D♭'];
    wrong.forEach((n, i) => assert(T.pc(n) === T.pc(dMaj[i]), 'wrong row is enharmonic'));
    I.heading(s, 'Wrong: same frets, letters repeat', lx, y, 7.2);
    I.noteRow(s, { x: lx, y: y + 0.4, d: 0.48, gap: 0.16, notes: wrong.map((n) => ({ label: n, role: n.length > 1 ? 'ghost' : 'note', sub: n === 'G♭' ? 'two Gs' : n === 'D♭' ? 'two Ds' : '' })) });
    y += 1.22;
    const gsh = T.spellScale('G♯', 'harmonicMinor');
    assert(gsh[6] === 'F♯♯', 'G♯ harmonic minor has F♯♯');
    I.heading(s, 'G♯ harmonic minor needs a double sharp', lx, y, 7.2);
    I.noteRow(s, { x: lx, y: y + 0.4, d: 0.48, gap: 0.16, notes: gsh.map((n, i) => ({ label: n, sub: T.prettyDegree(T.FORMULAS.harmonicMinor[i]), role: i === 6 ? 'blue' : 'note' })) });
    // right: cards
    const rx = 8.1; const rw = 12.73 - rx;
    D.card(s, { x: rx, y: 3.3, w: rw, h: 1.65, title: 'Half steps and enharmonics', body: 'One fret = one half step. **E–F** and **B–C** are the only natural half steps. C♯ and D♭ are one fret with two names.', fontSize: 14 });
    D.card(s, { x: rx, y: 5.15, w: rw, h: 1.7, title: 'Letter first, then accidental', body: 'Pick the letter the scale or chord needs, then add ♯ or ♭ to hit the pitch. Every rule in this deck counts letters.', fontSize: 14 });
  }

  // 6 · Interval number and quality
  {
    const s = D.slideOf(pres, {
      kicker: K, title: 'Interval number and quality',
      notes: `Every interval name has two parts, and they come from two different counts.

The number comes from the letters. Count the letter names from the bottom note to the top note, including both. C up to E is C-D-E, three letters, so it's a 3rd. C up to D♯ is C-D, two letters, so it's a 2nd, even though it's the same fret as E♭. Accidentals never change the number.

The quality comes from the half steps. Compare the interval with the major scale built on the lower note. If the top note is in that major scale, the interval is major (for 2nds, 3rds, 6ths and 7ths) or perfect (for unisons, 4ths, 5ths and octaves). Then each half step away moves one step along a ladder:
• 2nds, 3rds, 6ths, 7ths: diminished, minor, MAJOR, augmented.
• Unisons, 4ths, 5ths, octaves: diminished, PERFECT, augmented.
A perfect interval is never called major or minor, and a 3rd is never called perfect.

The table runs through all 13 sizes from 0 to 12 half steps, each spelled up from C, with its most common enharmonic twin in the right-hand column. The twins matter: C–E♭ (m3) is part of a C minor chord, while C–D♯ (A2) shows up in harmonic minor and in the "♯9" of a C7♯9 chord. Same fret, different function.

Try it now: name these by counting letters first, then half steps: A up to F (6th, 8 half steps: minor 6th). F up to B (4th, 6 half steps: augmented 4th). E up to D (7th, 10 half steps: minor 7th).

Common mistake: naming intervals only by fret count ("that's 3 frets, so a minor 3rd"). Fret count gives you the sound. The letters give you the name, and the name tells you what the note is doing.`,
    });
    const IVS = ['P1', 'm2', 'M2', 'm3', 'M3', 'P4', 'A4', 'P5', 'm6', 'M6', 'm7', 'M7', 'P8'];
    const TWIN = { 1: 'A1', 2: 'd3', 3: 'A2', 4: 'd4', 5: 'A3', 6: 'd5', 7: 'd6', 8: 'A5', 9: 'd7', 10: 'A6', 11: 'd8' };
    const rows = [['Frets', 'Interval', 'Name', 'From C', 'Same frets, other spelling']];
    IVS.forEach((iv, i) => {
      assert(T.intervalSemitones(iv) === i, `${iv} size`);
      const top = T.noteAbove('C', iv);
      assert(T.intervalName('C', top, { octave: i === 12 }) === iv, `${iv} round trip`);
      let twin = '';
      if (TWIN[i]) {
        const tn = T.noteAbove('C', TWIN[i]);
        assert(T.pc(tn) === T.pc(top) && T.mod12(T.intervalSemitones(TWIN[i])) === i % 12, `${TWIN[i]} twin`);
        twin = `${TWIN[i]}  C–${tn}`;
      }
      const name = iv === 'A4' ? 'Augmented 4th (tritone)' : T.intervalLong(iv);
      rows.push([String(i), colorIv(iv), name, `C–${top}`, twin]);
    });
    D.table(s, rows, { x: M, y: CONTENT_TOP, w: 7.4, colW: [0.7, 0.95, 2.25, 1.0, 2.5], rowH: 0.34, fontSize: 12, align: ['center', 'center', 'left', 'left', 'left'] });
    // right: two cards
    const rx = 8.3; const rw = 12.73 - rx;
    assert(T.intervalName('C', 'E♭') === 'm3' && T.intervalName('C', 'D♯') === 'A2', 'card examples');
    D.card(s, { x: rx, y: CONTENT_TOP, w: rw, h: 2.3, title: 'Number: count the letters', body: [
      '**C → E♭**: C-D-E is 3 letters, a 3rd. 3 half steps make it **minor**: m3.',
      '**C → D♯**: C-D is 2 letters, a 2nd. 3 half steps make it **augmented**: A2.',
      'Same fret, different name, different job.',
    ], fontSize: 14 });
    const cy = CONTENT_TOP + 2.5; const ch = 6.85 - cy;
    const inner = D.card(s, { x: rx, y: cy, w: rw, h: ch, title: 'Quality: count the half steps' });
    const ladder = (y, label, items) => {
      s.addText(label, { x: inner.innerX, y, w: inner.innerW, h: 0.24, fontSize: 12, color: HEX.muted, margin: 0, isTextBox: true });
      const pw = 0.72; const pg = 0.22;
      items.forEach(([q, off, hi], i) => {
        const px = inner.innerX + i * (pw + pg);
        pill(pres, s, { x: px, y: y + 0.28, w: pw, h: 0.4, label: q, hi });
        s.addText(off, { x: px, y: y + 0.7, w: pw, h: 0.2, fontSize: 11, color: HEX.muted, align: 'center', margin: 0, isTextBox: true });
      });
    };
    ladder(inner.innerY, '2nds, 3rds, 6ths, 7ths', [['d', '−2'], ['m', '−1'], ['M', 'major', true], ['A', '+1']]);
    ladder(inner.innerY + 1.05, 'Unisons, 4ths, 5ths, octaves', [['d', '−1'], ['P', 'perfect', true], ['A', '+1']]);
  }

  // 7 · Interval shapes on the neck
  {
    const s = D.slideOf(pres, {
      kicker: K, title: 'Interval shapes on the neck',
      notes: `On a piano every interval looks different depending on which keys it starts from. On the guitar an interval is a fixed shape that you can slide anywhere. That's the guitarist's biggest theory advantage, and these two maps are the whole set.

Left board: root A on the 6th string, 5th fret. Every interval from the unison to the octave fits in a four-fret box across three strings:
• On the root's own string: ♭2, 2, ♭3 and 3 are 1 to 4 frets up.
• One string over, same fret as the root: the 4th. Then ♭5, 5, ♭6 and 6 are 1 to 4 frets up from there.
• Two strings over, same fret: the ♭7. One fret up is the 7th, two frets up is the octave.
This map works from any root on the 6th or 5th string, and from the 4th string as long as you don't cross onto the B string.

Right board: the same root, A, now on the G string (2nd fret). The intervals on the G string are the same. But the G and B strings are tuned a major 3rd apart, not a 4th like every other pair. So everything on the B string, and everything on the high e beyond it, sits one fret higher than the left-hand map predicts. Compare the 4th: same fret as the root on the left board, one fret higher on the right board.

Try it now: play each interval from the 6th-string A and say its name. Then do the same from the 5th-string A (x-0 is the open A; use the 12th fret) and from the G-string A on the right. Feel the B-string jump.

Common mistake: memorizing shapes from one string only, then getting every shape wrong as soon as it crosses the B string. Learn the rule, not just the picture: crossing G→B, add one fret.`,
    });
    const pos1 = [[6, 5], [6, 6], [6, 7], [6, 8], [6, 9], [5, 5], [5, 6], [5, 7], [5, 8], [5, 9], [4, 5], [4, 6], [4, 7]].map(([st, f]) => ({ s: st, f }));
    const pos2 = [[3, 2], [3, 3], [3, 4], [3, 5], [3, 6], [2, 3], [2, 4], [2, 5], [2, 6], [2, 7], [1, 3], [1, 4], [1, 5]].map(([st, f]) => ({ s: st, f }));
    const bw = (FULL_W - 0.5) / 2;
    I.heading(s, 'Root on the 6th string: no G–B crossing', M, CONTENT_TOP, bw);
    D.fretboard(s, { x: M, y: CONTENT_TOP + 0.8, w: bw, h: 2.25, from: 3, to: 10, root: 'A', dots: D.dotsFor(pos1, { root: 'A', label: 'interval' }), shade: [{ from: 5, to: 5 }], title: 'Shapes 6th string', dotSize: 0.34 });
    I.heading(s, 'Root on the 3rd string: crosses G→B', M + bw + 0.5, CONTENT_TOP, bw);
    D.fretboard(s, { x: M + bw + 0.5, y: CONTENT_TOP + 0.8, w: bw, h: 2.25, from: 1, to: 8, root: 'A', dots: D.dotsFor(pos2, { root: 'A', label: 'interval' }), shade: [{ from: 2, to: 2 }], title: 'Shapes 3rd string', dotSize: 0.34, regions: [{ from: 3, to: 7, label: 'B and e strings: +1 fret' }] });
    const cw = (FULL_W - 0.6) / 3; const cy = 5.12;
    D.card(s, { x: M, y: cy, w: cw, h: 1.73, title: 'Same string', body: 'Along one string, the interval **is** the fret count: 3 frets up = m3, 7 frets = P5.', fontSize: 14 });
    D.card(s, { x: M + cw + 0.3, y: cy, w: cw, h: 1.73, title: 'Next string, same fret', body: 'One string higher at the root\'s fret is a **4th**. Two strings higher is a **♭7**.', fontSize: 14 });
    D.card(s, { x: M + 2 * (cw + 0.3), y: cy, w: cw, h: 1.73, title: 'The G→B shift', body: 'G to B is a **major 3rd**, not a 4th. Any shape that crosses onto the B string moves **up 1 fret**.', fontSize: 14 });
  }

  // 8 · Inversion and octave shapes
  {
    const s = D.slideOf(pres, {
      kicker: K, title: 'Inversion and octave shapes',
      notes: `Inverting an interval means flipping it: put the bottom note on top (raise it an octave) or the top note on the bottom. C up to E♭ is a minor 3rd. Flip it, E♭ up to C, and you get a major 6th. Together they fill exactly one octave.

The rule of 9:
• The numbers add up to 9. A 3rd inverts to a 6th, a 2nd to a 7th, a 4th to a 5th.
• The quality flips. Major becomes minor and minor becomes major; augmented becomes diminished and back. Perfect stays perfect.
• The half steps add up to 12, because together the two intervals make an octave.
The tritone is the special case: an augmented 4th inverts to a diminished 5th, and both are 6 half steps. It splits the octave exactly in half, which is part of why it sounds so unstable.

Why guitarists care: inversion doubles your options. A major 6th up is the same note as a minor 3rd down. When a shape is awkward, flip it. Most "6ths" licks in rock and soul are really 3rds with one note moved an octave.

Octave shapes, bottom board: every A from the open string to the 15th fret, linked by octave shapes.
• Two strings over, two frets up (pearl links): 6th→4th and 5th→3rd strings.
• Two strings over, three frets up (teal links): 4th→2nd and 3rd→1st, because the shape crosses the G→B gap.
• Low E to high e, same fret (dashed): two octaves.
With these three shapes you can find any note everywhere on the neck in seconds.

Try it now: pick a note, find it on the low E, then use octave shapes to find it on every string without counting from the nut.

Common mistake: inverting the quality but forgetting the number (calling the inversion of a m3 a "major 3rd"). Numbers add to 9; always do both halves of the rule.`,
    });
    const PAIRS = ['m2', 'M2', 'm3', 'M3', 'P4', 'A4'];
    const rows = [['Interval', 'Up from C', 'Inverts to', 'Up to C', 'Numbers', 'Half steps']];
    for (const iv of PAIRS) {
      const top = T.noteAbove('C', iv);
      const inv = T.invertInterval(iv);
      assert(T.noteAbove(top, inv) === 'C', `inversion ${iv}`);
      const a = T.parseInterval(iv); const b = T.parseInterval(inv);
      assert(a.num + b.num === 9 && a.semis + b.semis === 12, `rule of 9 ${iv}`);
      rows.push([colorIv(iv), `C–${top}`, colorIv(inv), `${top}–C`, `${a.num} + ${b.num} = 9`, `${a.semis} + ${b.semis} = 12`]);
    }
    D.table(s, rows, { x: M, y: CONTENT_TOP, w: 7.5, colW: [1.05, 1.15, 1.15, 1.15, 1.45, 1.55], rowH: 0.34, fontSize: 13, align: ['center', 'left', 'center', 'left', 'left', 'left'] });
    D.card(s, { x: 8.4, y: CONTENT_TOP, w: 12.73 - 8.4, h: 2.45, title: 'The rule of 9', bullets: [
      'Numbers add to **9**: 3rd ↔ 6th, 2nd ↔ 7th, 4th ↔ 5th',
      'Quality flips: **M ↔ m**, **A ↔ d**, **P stays P**',
      'Half steps add to **12**: one full octave',
    ], fontSize: 14, paraSpace: 6 });
    // octave map
    const aPos = T.positions([T.pc('A')], { from: 0, to: 15 });
    const by = 4.75;
    s.addText(D.runs('Every A from fret 0 to 15.  Pearl: 2 strings over, 2 frets up.  {blue:Teal: 3 frets up when the shape crosses G→B.}  Dashed: low E to high e, two octaves.', { color: HEX.muted, fontSize: 12 }), { x: M, y: 4.25, w: FULL_W, h: 0.3, margin: 0, valign: 'middle', isTextBox: true });
    const link = (a, b, color, dash) => ({ a: { s: a[0], f: a[1] }, b: { s: b[0], f: b[1] }, color, dash, width: 2.25 });
    D.fretboard(s, {
      x: M, y: by, w: FULL_W, h: 1.8, from: 0, to: 15, root: 'A', title: 'Octave shapes',
      dots: aPos.map((p) => ({ s: p.s, f: p.f, label: 'A', role: 'root' })),
      links: [
        link([6, 5], [4, 7], HEX.pearl), link([5, 0], [3, 2], HEX.pearl), link([5, 12], [3, 14], HEX.pearl),
        link([4, 7], [2, 10], HEX.blue), link([3, 2], [1, 5], HEX.blue),
        link([6, 5], [1, 5], HEX.muted, 'dash'),
      ],
    });
  }

  // 9 · Compound intervals and tensions
  {
    const s = D.slideOf(pres, {
      kicker: K, title: 'Compound intervals and tensions',
      notes: `Intervals bigger than an octave are called compound intervals. You name them by continuing to count letters past the octave: 8 is the root again, so 9 is the 2nd an octave up, 10 is the 3rd, 11 is the 4th, 12 is the 5th and 13 is the 6th. To convert, add or subtract 7: a 9th is a 2nd plus an octave (2 + 7), a 13th is a 6th plus an octave.

The ruler runs two octaves of C major and shows both numberings. In practice only three compound numbers get used a lot: 9, 11 and 13, the tensions (teal). The 10th and 12th are just the 3rd and 5th, so nobody calls them anything else.

Why the big numbers instead of 2, 4 and 6? Because the name tells you the note's job. In a chord, a "9" means "added on top of a full chord, above the 7th". A "2" (as in sus2) means "replaces the 3rd". Cadd9 has a 3rd and a 9 (C E G D). Csus2 has no 3rd (C D G). Same five frets on a fretboard diagram, very different sounds.

The table lists the seven tensions with their alterations. You'll meet ♭9, ♯9, ♯11 and ♭13 again in Part 3 (chord symbols) and Part 7 (which tensions fit which chords). Note that ♯9 is enharmonic with ♭3: a C7♯9 has both E and D♯, the major and minor 3rd at once. That's the "blues in one chord" sound.

The board shows a C chord (R, 3, 5, ♭7) on the A, D and G strings, with the 9, 11 and 13 an octave above the root on the B and e strings. Tensions live high in a voicing for a reason: low down they clash with the chord tones and turn to mud.

Try it now: play the C root, then each teal note, and name it out loud: "nine", "eleven", "thirteen".

Common mistake: calling the 9 a "2" in a chord name. Csus2 and Cadd9 are different chords.`,
    });
    const majSemis = T.FORMULAS.major.map((d) => T.parseDegree(d).semis);
    const names = T.spellScale('C', 'major');
    const marks = [];
    for (let o = 0; o < 2; o++) {
      majSemis.forEach((sm, i) => {
        const semi = sm + 12 * o; const num = i + 1 + 7 * o;
        if (semi > 21) return;
        const tension = [9, 11, 13].includes(num);
        const role = tension ? 'blue' : T.role(sm) === 'blue' ? 'other' : T.role(sm);
        marks.push({ semi, label: names[i], sub: String(num), role: sm === 11 ? 'seventh' : role });
      });
    }
    I.ruler(s, { x: M, y: CONTENT_TOP + 0.02, w: FULL_W, h: 0.55, from: 0, to: 21, marks, steps: false, fontSize: 12 });
    s.addText(D.runs('Past the octave keep counting letters: **8** is the root again, so **9 = 2**, **11 = 4**, **13 = 6** an octave up.', { color: HEX.muted, fontSize: 13 }), { x: M, y: 2.85, w: FULL_W, h: 0.3, margin: 0, valign: 'middle', isTextBox: true });
    // board: C on the A string with tensions above
    const dots = [
      { s: 5, f: 3, label: 'R', role: 'root' }, { s: 4, f: 2, label: '3', role: 'third' }, { s: 4, f: 5, label: '5', role: 'fifth' },
      { s: 3, f: 3, label: '♭7', role: 'seventh' }, { s: 3, f: 5, label: 'R', role: 'root' },
      { s: 2, f: 3, label: '9', role: 'blue' }, { s: 2, f: 6, label: '11', role: 'blue' }, { s: 1, f: 5, label: '13', role: 'blue' },
    ];
    // pitch check: tensions really sit more than an octave above the root
    const rootMidi = T.midi(5, 3);
    assert(T.midi(2, 3) - rootMidi === 14 && T.midi(2, 6) - rootMidi === 17 && T.midi(1, 5) - rootMidi === 21, 'compound sizes on the board');
    I.heading(s, 'C7 with its 9, 11 and 13 above', M, 3.3, 5.6);
    D.fretboard(s, { x: M, y: 3.8, w: 5.6, h: 2.3, from: 1, to: 7, root: 'C', dots, title: 'Compound board', dotSize: 0.36 });
    // table
    const TEN = [['9', 'C9, Cadd9'], ['b9', 'C7♭9'], ['#9', 'C7♯9'], ['11', 'C11, C7sus4'], ['#11', 'Cmaj7♯11'], ['b13', 'C7♭13'], ['13', 'C13']];
    const rows = [['Tension', 'Simple + 8va', 'Half steps', 'Over C', 'Where you meet it']];
    for (const [d, where] of TEN) {
      const p = T.parseDegree(d);
      const simple = T.prettyDegree(d.replace(/\d+/, (n) => String(Number(n) - 7)));
      rows.push([`{blue:${T.prettyDegree(d)}}`, `${simple} + octave`, String(12 + p.semis), T.spellDegree('C', d), where]);
    }
    D.table(s, rows, { x: 6.6, y: 3.3, w: 6.13, colW: [0.95, 1.4, 1.05, 0.8, 1.93], rowH: 0.36, fontSize: 13, align: ['center', 'left', 'center', 'center', 'left'] });
  }

  // 10 · The harmonic series and consonance
  {
    const s = D.slideOf(pres, {
      kicker: K, title: 'The harmonic series and consonance',
      notes: `Pluck the open A string and you don't hear one frequency. You hear the fundamental, 110 Hz, plus a stack of quieter partials at whole-number multiples: 220, 330, 440 Hz and up. Together they're the harmonic series, and they're the physics behind consonance.

The ladder shows the first eight partials, spaced by pitch. Look at the gaps between neighbors: octave, 5th, 4th, major 3rd, minor 3rd, then a slightly small minor 3rd and a large whole step. The intervals shrink as you climb, and they appear in roughly the order musicians rank them from most to least stable. Partials 4 to 7 even spell a dominant 7th chord on A: A, C♯, E, G. (The 7th partial is about 31 cents flatter than the G on your fretboard, which is part of why a bluesy flat 7th sounds natural.)

Simple frequency ratios mean the partials of two notes line up. A perfect 5th is 3:2: every 3rd partial of the lower note coincides with every 2nd partial of the upper note, so the two notes blend. A minor 2nd is about 16:15: almost nothing lines up, and the near-misses beat against each other, which our ears hear as roughness. The table on the right groups the intervals by this blend.

Why power chords love distortion: a distortion pedal creates new frequencies, the sums and differences of the notes you play. For a 5th (110 and 165 Hz), every new tone is a multiple of 55 Hz: a harmonic of the A an octave below your root. The chord fuses into one enormous A. For an equal-tempered major 3rd, which is about 14 cents wider than a pure 5:4, the new tones fall between the harmonics and beat. That's the mud you hear when you play full major chords with lots of gain.

Try it now: with the gain up, play A5 (5th fret low E + 7th fret A string), then A plus C♯ (5th fret + 4th fret A string). Listen to the difference.`,
    });
    const partials = [
      { n: 1, note: 'A2', hz: 110, role: 'root' }, { n: 2, note: 'A3', hz: 220, role: 'root' }, { n: 3, note: 'E4', hz: 330, role: 'fifth' },
      { n: 4, note: 'A4', hz: 440, role: 'root' }, { n: 5, note: 'C♯5', hz: 550, role: 'third' }, { n: 6, note: 'E5', hz: 660, role: 'fifth' },
      { n: 7, note: 'G5', hz: 770, role: 'seventh', extra: ', 31¢ flat' }, { n: 8, note: 'A5', hz: 880, role: 'root' },
    ];
    const letter = (n) => n.note.replace(/\d/, '');
    for (const p of partials) assert(T.role(T.semis('A', T.pc(letter(p)))) === p.role, `partial ${p.n} role`);
    const gaps = ['P8'];
    for (let i = 2; i <= 5; i++) gaps.push(T.intervalName(letter(partials[i - 1]), letter(partials[i])));
    gaps.push('≈m3', '≈M2');
    assert(gaps.slice(1, 5).join(',') === 'P5,P4,M3,m3', `series gaps ${gaps}`);
    I.heading(s, 'Partials of the open A string', M, CONTENT_TOP, 6.6);
    const top = 2.2; const base = 6.55; const k = (base - top) / 3;
    const yOf = (n) => base - k * Math.log2(n);
    // ladder spine
    s.addShape(pres.shapes.LINE, { x: 6.45, y: yOf(8), w: 0, h: yOf(1) - yOf(8), line: { color: HEX.line, width: 1.25 } });
    for (const p of partials) {
      const y = yOf(p.n);
      D.badge(s, { x: M + 0.02, y: y - 0.13, d: 0.26, label: String(p.n), role: 'other', fontSize: 10 });
      s.addText(p.note, { x: 1.02, y: y - 0.13, w: 0.7, h: 0.26, fontSize: 14, bold: true, color: D.ROLE_HEX[p.role], margin: 0, valign: 'middle', isTextBox: true });
      const len = 2.9 / Math.pow(p.n, 0.6);
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 1.75, y: y - 0.08, w: len, h: 0.16, rectRadius: 0.04, fill: { color: D.ROLE_HEX[p.role] }, line: { color: D.ROLE_HEX[p.role], width: 0 } });
      s.addText(`${p.hz} Hz${p.extra || ''}`, { x: 4.75, y: y - 0.12, w: 1.6, h: 0.24, fontSize: 12, color: HEX.muted, margin: 0, valign: 'middle', isTextBox: true });
      s.addShape(pres.shapes.LINE, { x: 6.39, y, w: 0.12, h: 0, line: { color: HEX.muted, width: 1.25 } });
    }
    for (let i = 1; i < 8; i++) {
      const ym = (yOf(i) + yOf(i + 1)) / 2;
      s.addText(gaps[i - 1], { x: 6.58, y: ym - 0.11, w: 0.7, h: 0.22, fontSize: 12, bold: true, color: HEX.pearl, margin: 0, valign: 'middle', isTextBox: true });
    }
    // right column
    const rx = 7.6; const rw = 12.73 - rx;
    D.table(s, [
      ['Blend', 'Intervals and frequency ratios'],
      ['{fifth:Pure}', 'P8 2:1 · P5 3:2 · P4 4:3'],
      ['{third:Sweet}', 'M3 5:4 · m3 6:5 · M6 5:3 · m6 8:5'],
      ['{seventh:Tense}', 'M2 9:8 · m7 16:9'],
      ['{root:Harsh}', 'M7 15:8 · m2 16:15 · tritone 45:32'],
    ], { x: rx, y: CONTENT_TOP, w: rw, colW: [1.0, rw - 1.0], rowH: 0.4, fontSize: 13 });
    D.card(s, { x: rx, y: 3.85, w: rw, h: 3.0, title: 'Why power chords love distortion', body: [
      'Distortion adds **sum and difference tones**. A 5th is 3:2, so every new tone lands on a harmonic of the note an octave below the root. The chord fuses into one huge note.',
      'A tempered major 3rd misses 5:4 by 14 cents. Its new tones fall between the harmonics and beat: **mud**.',
    ], fontSize: 14 });
  }

  // 11 · Exercises on paper
  {
    const nameQ = [['C', 'A♭'], ['F♯', 'C'], ['E♭', 'B'], ['D', 'C♯'], ['A', 'G'], ['B♭', 'E'], ['F', 'G♯'], ['E', 'C♯'], ['A♭', 'D♭'], ['C♯', 'B♭'], ['B', 'D♯'], ['G', 'A♭']];
    const aboveQ = [['M3', 'B♭'], ['m7', 'F♯'], ['A4', 'E♭'], ['P5', 'B'], ['M6', 'D♭'], ['m3', 'G♯'], ['d5', 'C♯'], ['M2', 'E']];
    const belowQ = [['m3', 'E'], ['P4', 'B♭'], ['M6', 'G'], ['M3', 'D'], ['m7', 'A'], ['A4', 'C']];
    I.worksheet(pres, {
      part: 1, kicker: K, grid: 'row',
      intro: 'Pencil only. Count letters first, then half steps. Check two answers from each group on the neck afterward.',
      groups: [
        { key: 'A', title: 'Name the interval', instr: 'Lower note first, ascending.', weight: 1.45, cols: 2, items: nameQ.map(([a, b]) => [`${a} → ${b}`, T.intervalName(a, b)]) },
        { key: 'B', title: 'Build above', instr: 'Write the note.', items: aboveQ.map(([iv, n]) => [`${iv} above ${n}`, T.noteAbove(n, iv)]) },
        { key: 'C', title: 'Build below', instr: 'Write the note.', items: belowQ.map(([iv, n]) => [`${iv} below ${n}`, T.noteBelow(n, iv)]) },
        { key: 'D', title: 'Invert and count', weight: 1.15, items: [
          ['Invert a M3', T.invertInterval('M3')],
          ['Invert an A4', T.invertInterval('A4')],
          ['Invert a m2', T.invertInterval('m2')],
          ['Half steps in a m6?', String(T.intervalSemitones('m6'))],
          ['Half steps in an A2?', String(T.intervalSemitones('A2'))],
          ['A 13th is which simple interval plus an octave?', '6th (M6)'],
          ['Respell D♯ with the letter E', T.spellWithLetter('E', T.pc('D♯'))],
        ] },
      ],
      notes: `Worksheet for Part 1. Do it with a pencil and no guitar, then check your answers in the answer key at the back of the deck (Part 1, groups A–D).

Group A, name the interval: the lower note is always written first and the interval goes up. Count the letters to get the number, including both ends. Then count half steps and compare with the major (or perfect) interval of that number to get the quality. Several pairs are enharmonic traps on purpose: F up to G♯ is not a minor 3rd.

Groups B and C, build an interval: pick the letter first (count up or down the alphabet), then add the sharp or flat that makes the half-step count right. Some answers need unusual spellings. That's expected: the letter is fixed by the number, so the accidental has to do the work.

Group D: use the rule of 9 for inversions (numbers add to 9, quality flips, perfect stays perfect). For half steps, start from the major or perfect size and adjust.

Scoring: a group is passed with at most one miss. If you miss two or more in a group, reread the matching slide (number and quality for A, spelling for B and C, inversion for D) and redo the whole group tomorrow with different notes of your own.

After you pass on paper, check two answers per group on the neck: play the interval, sing it, and make sure the shape matches the name.`,
    });
  }

  // 12 · Exercises on the neck
  D.practice(pres, {
    kicker: K, title: 'Exercises on the neck',
    intro: 'Daily, 10–15 minutes. Say every interval name out loud as you play it.',
    drills: [
      { name: 'The 3-string interval map', how: 'Pick a root on the 6th string and play all 12 intervals with the 3-string map. Then do it from a 3rd-string root with the B-string +1 shift.', tempo: 'Free time', time: '5 min', done: 'All 12 from any root in under 30 s' },
      { name: 'Sing it first', how: 'Play a root, sing the target interval, then play it to check. Start with P5, P4, M3, m3; add one interval each day.', tempo: 'Free time', time: '3 min', done: '9 of 10 sung right first try' },
      { name: 'Octave sweep', how: 'Pick a note name. Find it on every string, low E to high e and back, using only the three octave shapes.', tempo: '60 bpm, one note per beat', time: '3 min', done: 'All 7 natural notes, no misses' },
      { name: 'Distortion test', how: 'Gain up. Play A5, then A + C♯ (M3), then A + C (m3) as two-note chords. Describe each sound, then try R-5-8 vs. a full major chord.', tempo: 'Free time', time: '2 min', done: 'You can predict which ones turn to mud' },
    ],
    notes: `Four drills that turn this part into reflexes. Do them daily for a week, 10 to 15 minutes in total.

1. The 3-string interval map. Pick a random root on the 6th string. Play every interval in order using the map from the interval-shapes slide, naming each one out loud: "minor second, major second, minor third…". Then pick a root on the G string and do it again, remembering that everything on the B and high e strings moves up one fret. When you're fluent, call out intervals at random instead of in order.

2. Sing it first. This connects names to sounds. Play a root, decide on an interval, sing it, then play it to check. Start with the four most important intervals (perfect 5th, perfect 4th, major 3rd, minor 3rd) and add one new one per day. Don't worry about the quality of your voice. Accuracy of pitch is all that counts.

3. Octave sweep. Choose a note name, say F. Find it on the low E (1st fret), then use only octave shapes to jump string to string: two strings over and two frets up, or three frets up when crossing the G–B gap. Go up to the high e and back down. Use a metronome at 60 bpm, one note per beat. Do all seven natural notes, then the sharps and flats.

4. Distortion test. This one is about hearing the harmonic series slide. With a high-gain sound, compare a power chord with major and minor 3rd dyads. Then compare R-5-8 with a full open major chord. You'll hear why rhythm players under heavy gain drop the 3rd. Clean, the 3rds sound sweet; distorted, they smear.

Log your times. The first drill should get noticeably faster within a week.`,
  });
}

module.exports = { build };
