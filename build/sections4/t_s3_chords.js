// Theory Intensive · Part 3 · Chords and voicing (slides 24–34)
const T = require('../lib/theory');
const D = require('../lib/draw');
const I = require('../lib/intensive');
const { HEX, M, CONTENT_TOP, section } = require('../lib/deck');

const K = '3 · Chords and voicing';
const FULL_W = 12.13;

// Role for a chord degree label: altered 5ths teal, extensions gray, otherwise the usual code.
function degreeRole(label) {
  const d = T.parseDegree(label);
  if (d.num === 5 && d.semis !== 7) return 'blue';
  if (d.num > 7) return 'other';
  if (d.num === 7 && d.semis === 9) return 'seventh'; // ♭♭7 of a °7 still does the 7th's job
  return T.role(d.semis);
}

// Filled tile in a role color with a big label and an optional small second line.
function ctile(pres, s, { x, y, w, h, label, sub, role, size = 20, subSize = 12 }) {
  const st = D.roleStyle(role);
  const r = [{ text: label, options: { fontSize: size, bold: true, color: st.text, breakLine: !!sub } }];
  if (sub) r.push({ text: sub, options: { fontSize: subSize, bold: true, color: st.text } });
  s.addText(r, { shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: 0.08, x, y, w, h, fill: { color: st.fill }, line: { color: st.fill, width: 0 }, align: 'center', valign: 'middle', margin: 0, fontFace: 'Arial', lineSpacingMultiple: 0.95 });
}

const formulaText = (suffix) => T.CHORD_FORMULAS[suffix].map(T.prettyDegree).join(' ');
const notesText = (root, suffix) => T.spellChord(root, suffix).join(' ');
// Interval names between consecutive chord tones, e.g. C E G -> ['M3', 'm3'].
function stackOf(root, suffix) {
  const n = T.spellChord(root, suffix);
  return n.slice(1).map((x, i) => T.intervalName(n[i], x));
}
// Drop-N voicing from a close voicing listed low to high: the Nth voice from the top goes down an octave.
function drop(close, n) {
  const i = close.length - n;
  return [close[i], ...close.filter((_, k) => k !== i)];
}
const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

function build(pres) {
  section(pres, 'Chords and voicing');
  const slide = (title, notes) => D.slideOf(pres, { kicker: K, title, notes });

  // 24 · Divider
  D.divider(pres, {
    num: 3,
    title: 'Chords and voicing',
    subtitle: 'Chords are stacked 3rds. Voicing is the guitarist’s problem: which of those notes to play, in what order, on which strings.',
    outcomes: [
      'Build any triad or 7th chord from two sizes of 3rd',
      'Read any chord symbol and spell it, extensions included',
      'Derive drop 2 and drop 3 voicings yourself',
      'Play shells, sus, power and quartal chords on purpose',
    ],
    notes: `Part 3: Chords and voicing.

In Part 1 you learned to measure the distance between two notes. In Part 2 you built scales and keys. Now you'll stack scale notes on top of each other to make chords, and then solve the problem piano-based theory books skip: how to play those chords on six strings tuned mostly in 4ths.

What this part covers:
• Triads. Every triad is two 3rds stacked on a root. There are only two sizes of 3rd (major, 4 frets, and minor, 3 frets), so there are only four possible triads: major, minor, diminished and augmented.
• Seventh chords. Add a third 3rd and you get the five common 7th chords plus one rarer one.
• Extensions and alterations. Keep stacking: 9, 11, 13, and their sharp and flat versions. Then learn what to throw away, because a guitar can't hold seven notes and a band doesn't need them.
• Chord symbols. A decoder for every symbol you're likely to meet on a chart.
• Inversions and slash chords. What happens when a note other than the root is in the bass.
• Voicings. Close voicings come from the piano. Drop 2 and drop 3 voicings are the guitar's own 7th chords, and you'll derive them rather than memorize them.
• Shells, power chords, sus chords and quartal chords: chords with notes deliberately left out.

How to study it: spell every chord out loud before you play it. "A minor 7: A, C, E, G." The spelling is the theory; the shape is just where those notes happen to sit. If you only learn shapes, you'll be stuck the first time a shape doesn't fit.`,
  });

  // 25 · Stacking thirds
  {
    const s = slide('Stacking thirds: four triads', `Every triad is a root with two 3rds stacked on top. A 3rd comes in two sizes: a major 3rd is 4 half steps (4 frets), a minor 3rd is 3 half steps (3 frets). Two slots, two sizes, so there are exactly four combinations, and those are the four triad qualities.

• Major = major 3rd, then minor 3rd. C E G. Bright, stable, finished.
• Minor = minor 3rd, then major 3rd. C E♭ G. Darker, still stable.
• Diminished = minor 3rd, then minor 3rd. C E♭ G♭. Tense and unstable: the outer interval is a diminished 5th (the tritone).
• Augmented = major 3rd, then major 3rd. C E G♯. Floating, unresolved: the outer interval is an augmented 5th.

Notice the outer interval. Major and minor both span a perfect 5th (7 frets). That's why a power chord (root + 5th) fits under either one. Diminished shrinks the 5th by a fret, augmented stretches it by a fret.

Spelling matters. The 3rd of any chord is always the letter two steps up from the root, and the 5th is four letters up. So C diminished is C E♭ G♭, not C D♯ F♯, even though they're the same frets. Chord spelling follows letters, exactly as scale spelling did in Part 2.

Try it now: on the G, B and high e strings, play C major at frets 5-5-3. Lower the B-string note one fret for C minor, then also lower the e-string note one fret for C diminished. Go back to major and raise the e-string note a fret for augmented. One finger moves at a time, and each move changes one interval.

Common mistake: thinking of minor as "sad major". It's a different stack, and the order of the 3rds is the whole difference.`);
    const chords = [['', 'C', 'Major'], ['m', 'Cm', 'Minor'], ['°', 'C°', 'Diminished'], ['+', 'C+', 'Augmented']];
    const colW = 2.05; const gap = 0.2; const tw = 1.0; const th = 0.7; const tg = 0.45;
    const top = CONTENT_TOP + 0.2;
    chords.forEach(([suf, name, qual], ci) => {
      const x = M + ci * (colW + gap);
      const notes = T.spellChord('C', suf);
      const f = T.CHORD_FORMULAS[suf];
      const st = stackOf('C', suf);
      // tiles: 5th on top, root at the bottom
      [2, 1, 0].forEach((k, row) => {
        ctile(pres, s, { x, y: top + row * (th + tg), w: tw, h: th, label: notes[k], sub: T.prettyDegree(f[k]), role: degreeRole(f[k]), size: 20 });
      });
      // interval labels between tiles
      // upper gap (3rd → 5th) and lower gap (root → 3rd)
      [[top + th + tg / 2, st[1]], [top + 2 * th + 1.5 * tg, st[0]]].forEach(([gy, label]) => {
        s.addText(`${label}  ${T.intervalSemitones(label)} frets`, { x: x + tw + 0.08, y: gy - 0.15, w: colW - tw - 0.05, h: 0.3, fontSize: 12, bold: true, color: label[0] === 'M' ? HEX.third : HEX.pearl, margin: 0, valign: 'middle', isTextBox: true });
      });
      const by = top + 3 * th + 2 * tg + 0.2;
      s.addText(name, { x, y: by, w: colW, h: 0.45, fontSize: 24, bold: true, color: HEX.white, margin: 0, valign: 'middle', isTextBox: true });
      s.addText(qual, { x, y: by + 0.47, w: colW, h: 0.3, fontSize: 14, color: HEX.muted, margin: 0, valign: 'middle', isTextBox: true });
      const outer = T.intervalName(notes[0], notes[2]);
      D.text(s, `Formula **${formulaText(suf)}**`, { x, y: by + 0.82, w: colW, h: 0.3, fontSize: 14 });
      s.addText(`Outer: ${outer} (${T.intervalSemitones(outer)} frets)`, { x, y: by + 1.14, w: colW, h: 0.26, fontSize: 12, color: outer === 'P5' ? HEX.fifth : HEX.blue, bold: true, margin: 0, isTextBox: true });
    });
    const rx = M + 4 * colW + 3 * gap + 0.25; const rw = 12.73 - rx;
    D.card(s, { x: rx, y: CONTENT_TOP, w: rw, h: 2.55, title: 'Two sizes of 3rd', titleColor: HEX.pearl, body: ['**Major 3rd** = 4 frets. **Minor 3rd** = 3 frets.', 'Two slots, two sizes: **four triads**, and no others.'], fontSize: 14, paraSpace: 8 });
    D.card(s, { x: rx, y: CONTENT_TOP + 2.75, w: rw, h: 2.55, title: 'Only three are diatonic', titleColor: HEX.pearl, body: ['Major, minor and diminished all occur inside a major scale.', 'Augmented needs a note from outside it, such as harmonic minor’s ♭III+.'], fontSize: 14, paraSpace: 8 });
  }

  // 26 · Seventh chords
  {
    const s = slide('Seventh chords: one more third', `Stack a third 3rd on a triad and you reach the 7th. Each of the four triads can take a major or a minor 7th on top, but only six of those combinations are common, and five do almost all the work in pop, rock, blues and jazz.

• maj7 (major 7th): major triad + major 7th. C E G B. Dreamy and at rest. The 7th sits a half step under the octave.
• 7 (dominant 7th): major triad + minor 7th. C E G B♭. The blues chord, and the V chord of every key. Restless: it contains a tritone (E to B♭) that wants to resolve.
• m7 (minor 7th): minor triad + minor 7th. C E♭ G B♭. Smooth, mellow minor.
• m7♭5 (half-diminished, written ø7): diminished triad + minor 7th. C E♭ G♭ B♭. Dark and unstable; its natural job is leading to a V chord in a minor key.
• °7 (diminished 7th): diminished triad + diminished 7th. C E♭ G♭ B♭♭. Every gap is a minor 3rd, so the chord is symmetrical. B♭♭ is the same fret as A, but it's spelled as a 7th because it's the 7th letter.
• m(maj7): minor triad + major 7th. C E♭ G B. Eerie and cinematic.

The naming rule that trips everyone up: a plain "7" means a minor 7th (♭7). You only get a major 7th when the symbol says "maj7". So C7 has B♭, and Cmaj7 has B.

The fretboards show all six from A, in open position or close to it. Play them in the order shown and listen to the top-to-bottom mood change. Then say each spelling out loud while you hold the shape.

Common mistake: calling m7♭5 and °7 the same chord. They share three notes; the 7th differs by a half step, and so does the job each chord does.`);
    const rows = [
      ['maj7', 'Cmaj7', 'Dreamy, at rest'],
      ['7', 'C7', 'Bluesy, wants to move'],
      ['m7', 'Cm7', 'Smooth, mellow minor'],
      ['m7♭5', 'Cm7♭5 (Cø7)', 'Dark, leads to V'],
      ['°7', 'C°7', 'Tense, symmetrical'],
      ['m(maj7)', 'Cm(maj7)', 'Eerie, cinematic'],
    ];
    const data = [['Chord', 'Stack of 3rds', 'Formula', 'From C', 'From A', 'Sound']];
    for (const [suf, name, snd] of rows) data.push([`**${name}**`, stackOf('C', suf).join(' + '), formulaText(suf), notesText('C', suf), notesText('A', suf), snd]);
    D.table(s, data, { x: M, y: CONTENT_TOP, w: FULL_W, colW: [2.05, 1.95, 1.7, 1.95, 1.95, 2.53], rowH: 0.36, fontSize: 14 });
    const boards = [
      ['Amaj7', 'x02120', 0, 3, {}, {}],
      ['A7', 'x02020', 0, 3, {}, {}],
      ['Am7', 'x02010', 0, 3, {}, {}],
      ['Am7♭5', 'x0101x', 0, 3, {}, {}],
      ['A°7', '5x454x', 3, 6, { 9: '♭♭7' }, { 9: 'seventh' }],
      ['Am(maj7)', 'x02110', 0, 3, {}, {}],
    ];
    const bw = (FULL_W - 0.25 * 5) / 6;
    boards.forEach(([name, fing, from, to, names, roles], i) => {
      I.chordBoard(s, { x: M + i * (bw + 0.25), y: 4.3, w: bw, h: 1.15, name, root: 'A', fing, from, to, names, roles, nameSize: 15 });
    });
  }

  // 27 · Extensions and alterations
  {
    const s = slide('Extensions and alterations', `Keep stacking 3rds past the 7th and you get the extensions: the 9th, 11th and 13th. Stack one more and you're back at the root, two octaves up, so 13 is as far as chord names go.

An extension is a scale note an octave up: 9 = 2, 11 = 4, 13 = 6. They're named with the bigger numbers because they sit above a 7th chord. That's also the rule for reading symbols: a 9, 11 or 13 implies the 7th is in the chord. C9 = C7 plus D. If there's no 7th, the symbol says "add": Cadd9 = C E G D.

Alterations are extensions moved by a half step: ♭9, ♯9, ♯11, ♭13. They live mostly on dominant chords, where they add tension that resolves when the chord moves. You'll use them in Part 6 when a V7 heads to a minor chord.

A guitar can't hold a seven-note chord, and a band doesn't need one. Cut notes in this order:
1. The 5th. It adds the least color, and the root's overtones already imply it.
2. The root, if a bassist is playing it.
3. Never the 3rd or 7th. Those two notes define the quality (Part 3's shells slide).
And avoid the natural 11 over major and dominant chords: F against E is a ♭9 clash. Use a sus4 chord (no 3rd) or a ♯11 instead.

The three shapes:
• C9 (x3233x): R 3 ♭7 9 with the 5th dropped.
• C7♯9 (x3234x): the same shape with the 9 raised a fret. The ♯9 (D♯, often written E♭) sits a half step above the major 3rd, so the chord sounds major and minor at once. It's the classic rock-blues dominant.
• A13 (5x567x): R ♭7 3 13. No 5th, no 9, no 11, and it still sounds like a full 13.

Try it now: play C9, then move only the B-string note up a fret for C7♯9. Hear one note change the whole mood.`);
    const lx = M; const lw = 5.7;
    I.heading(s, 'Keep stacking 3rds', lx, CONTENT_TOP, lw);
    const ext = ['1', '3', '5', '7', '9', '11', '13'];
    const extNotes = T.spellFormula('C', ext);
    I.noteRow(s, { x: lx, y: CONTENT_TOP + 0.42, d: 0.6, gap: 0.2, notes: extNotes.map((n, i) => ({ label: n, sub: ext[i], role: degreeRole(ext[i]) })) });
    D.text(s, '9 = 2, 11 = 4, 13 = 6, one octave up. Then the stack returns to the root.', { x: lx, y: CONTENT_TOP + 1.38, w: lw, h: 0.26, fontSize: 12, color: HEX.muted });
    I.heading(s, 'Altered tensions', lx, CONTENT_TOP + 1.8, lw);
    const alt = ['b9', '#9', '#11', 'b13'];
    I.noteRow(s, { x: lx, y: CONTENT_TOP + 2.22, d: 0.6, gap: 0.2, notes: T.spellFormula('C', alt).map((n, i) => ({ label: n, sub: T.prettyDegree(alt[i]), role: 'blue' })) });
    D.text(s, 'Mostly on dominant 7ths: tension that resolves when the chord moves.', { x: lx + 3.25, y: CONTENT_TOP + 2.28, w: lw - 3.25, h: 0.6, fontSize: 12, color: HEX.muted });
    D.card(s, { x: lx, y: 4.6, w: lw, h: 2.25, title: 'What to drop on guitar', titleColor: HEX.pearl, bullets: [
      '**The 5th first:** it adds the least color.',
      '**The root next,** if the bass is playing it.',
      '**Keep the 3rd and 7th:** they define the chord.',
      '**No natural 11 on major or dominant:** F over E clashes.',
    ], fontSize: 14, paraSpace: 4 });
    const rx = M + lw + 0.4; const rw = 12.73 - rx; const bw = (rw - 0.5) / 3;
    const boards = [
      { name: 'C9', root: 'C', fing: 'x3233x', from: 1, to: 4, names: { 2: '9' }, caption: 'R 3 ♭7 9, no 5th' },
      { name: 'C7♯9', root: 'C', fing: 'x3234x', from: 1, to: 4, names: { 3: '♯9' }, roles: { 3: 'blue' }, caption: 'R 3 ♭7 ♯9: major and minor 3rd' },
      { name: 'A13', root: 'A', fing: '5x567x', from: 4, to: 7, names: { 9: '13' }, caption: 'R ♭7 3 13, no 5th or 9' },
    ];
    boards.forEach((b, i) => I.chordBoard(s, { x: rx + i * (bw + 0.25), y: CONTENT_TOP, w: bw, h: 1.3, ...b }));
    D.card(s, { x: rx, y: 4.6, w: rw, h: 2.25, title: 'Reading the number', titleColor: HEX.pearl, body: [
      'A **9, 11 or 13** implies the **♭7**: C9 = C7 + D. No 7th means **add**: Cadd9 = C E G D.',
      '**maj9 / maj13** keep the major 7th. **m9 / m11** sit on a minor 7th chord.',
    ], fontSize: 14, paraSpace: 8 });
  }

  // 28 · Reading chord symbols
  {
    const s = slide('Reading chord symbols', `Chord symbols are a compressed formula. Once you can decode the pieces, you can spell any chord on any chart, even one you've never seen. The table spells every common symbol from C. Every spelling was generated from the formula, so use it to check yourself.

Read a symbol left to right:
1. The root letter, with its sharp or flat. Everything else is measured from it.
2. The quality of the 3rd. Nothing = major 3rd. "m" = minor 3rd. "sus2" or "sus4" = no 3rd at all; the 2 or 4 replaces it.
3. The 7th. A plain number 7, 9, 11 or 13 means a minor 7th (♭7). "maj" before the number means a major 7th. No number means no 7th.
4. Alterations in order: ♭5, ♯5, ♭9, ♯9, ♯11, ♭13.
5. A slash and a note: that note goes in the bass. C/E is a C chord with E as its lowest note.

Symbols with two common spellings:
• m7♭5 = ø7 (half-diminished). Same chord.
• °7 is a fully diminished 7th; ° alone is just the triad.
• + = aug = ♯5. Δ is another way of writing maj7.
• "5" means a power chord: root and 5th only, no 3rd.

Try it now: cover the "Notes" columns and spell each symbol from the formula, then uncover and check. Then do the same with D instead of C, and say the answers out loud. When you can spell all eighteen from D and from B♭ without hesitating, you're done with this slide.

Common mistake: reading C9 as "C add 9". C9 has the B♭; Cadd9 doesn't. The difference is very audible.`);
    const syms = [['', 'C'], ['m', 'Cm'], ['7', 'C7'], ['maj7', 'Cmaj7'], ['m7', 'Cm7'], ['m7♭5', 'Cm7♭5 = Cø7'], ['°7', 'C°7'], ['6', 'C6'], ['m6', 'Cm6'],
      ['add9', 'Cadd9'], ['sus2', 'Csus2'], ['sus4', 'Csus4'], ['7sus4', 'C7sus4'], ['9', 'C9'], ['7♯9', 'C7♯9'], ['13', 'C13'], ['/E', 'C/E'], ['5', 'C5']];
    const row = ([suf, name]) => (suf === '/E'
      ? [`**${name}**`, '3 in the bass', `{third:E} · C G`]
      : [`**${name}**`, formulaText(suf), notesText('C', suf)]);
    const head = ['Symbol', 'Formula', 'Notes'];
    const tw = (FULL_W - 0.3) / 2;
    const colW = [2.0, 1.95, tw - 3.95];
    D.table(s, [head, ...syms.slice(0, 9).map(row)], { x: M, y: CONTENT_TOP, w: tw, colW, rowH: 0.37, fontSize: 14 });
    D.table(s, [head, ...syms.slice(9).map(row)], { x: M + tw + 0.3, y: CONTENT_TOP, w: tw, colW, rowH: 0.37, fontSize: 14 });
    const cy = 5.5; const cw = (FULL_W - 0.6) / 3;
    D.card(s, { x: M, y: cy, w: cw, h: 1.35, title: 'The 3rd', body: 'Nothing = major. **m** = minor. **sus** = no 3rd.', fontSize: 14, titleSize: 16 });
    D.card(s, { x: M + cw + 0.3, y: cy, w: cw, h: 1.35, title: 'The 7th', body: 'Plain **7, 9, 13** = ♭7. **maj** = major 7th.', fontSize: 14, titleSize: 16 });
    D.card(s, { x: M + 2 * (cw + 0.3), y: cy, w: cw, h: 1.35, title: 'The slash', body: '**C/E** = C chord, E as the lowest note.', fontSize: 14, titleSize: 16 });
  }

  // 29 · Inversions and slash chords
  {
    const s = slide('Inversions and slash chords', `An inversion is a chord with something other than the root as its lowest note. The chord keeps its name and its notes; only the bass changes, and the bass changes the feel a lot.

• Root position: root in the bass. Solid, grounded.
• 1st inversion: 3rd in the bass (C/E). Lighter, and it leans forward.
• 2nd inversion: 5th in the bass (C/G). Unstable; in classical music it usually sits right before a V chord.
• 3rd inversion: 7th in the bass (C7/B♭). Only 7th chords have one. The 7th in the bass wants to step down, so C7/B♭ pulls strongly toward F/A.

Slash notation writes the bass note after the slash. It's also used for notes that aren't in the chord at all, like D/C, but most of the time a slash chord is an inversion.

Why guitarists care: inversions let the bass line move by step while the chords stay put. The five shapes on the slide are the most famous use, a descending bass line. The bass walks C, B, A, G, F down the scale while the upper notes barely change. C/B is really a Cmaj7 with the 7th in the bass, and Am/G is an Am7 with the ♭7 in the bass. You'll find this move in ballads in every language, Mandopop included, because a stepwise bass sounds like a melody of its own.

Try it now: play the five shapes, two beats each, and hear the bass walk. Then play just the bass notes on the A and low E strings while you sing the top. Then try writing your own: start on G and walk G, F♯, E, D under G, D/F♯, Em, D.

Common mistake: letting the open low E ring under C/B or Am. Mute it with the tip of your fretting finger, or the bass line disappears.`);
    const inv = [
      ['Root position', '{root:C} {third:E} {fifth:G}', 'Symbol **C**'],
      ['1st inversion', '{third:E} {fifth:G} {root:C}', 'Symbol **C/E**'],
      ['2nd inversion', '{fifth:G} {root:C} {third:E}', 'Symbol **C/G**'],
      ['3rd inversion', '{seventh:B♭} {root:C} {third:E} {fifth:G}', 'Symbol **C7/B♭**'],
    ];
    // check the spellings against the engine
    const c = T.spellChord('C', ''); const c7 = T.spellChord('C', '7');
    if (c.join() !== 'C,E,G' || c7[3] !== 'B♭') throw new Error('Inversion spelling check failed');
    const cw = (FULL_W - 0.9) / 4;
    inv.forEach(([t, notes, sym], i) => D.card(s, { x: M + i * (cw + 0.3), y: CONTENT_TOP, w: cw, h: 1.55, title: t, body: [`Low → high: ${notes}`, sym], fontSize: 14, titleSize: 16, paraSpace: 6 }));
    I.heading(s, 'Slash chords at work: the bass walks down, the top stays put', M, 3.3, FULL_W);
    const seq = [
      { name: 'C', root: 'C', fing: 'x32010', caption: 'Bass C' },
      { name: 'C/B', root: 'C', fing: 'x22010', caption: 'Bass B (the 7)' },
      { name: 'Am', root: 'A', fing: 'x02210', caption: 'Bass A' },
      { name: 'Am/G', root: 'A', fing: '3x2210', caption: 'Bass G (the ♭7)' },
      { name: 'F', root: 'F', fing: '133211', caption: 'Bass F' },
    ];
    const bw = (FULL_W - 0.25 * 4) / 5;
    seq.forEach((b, i) => I.chordBoard(s, { x: M + i * (bw + 0.25), y: 3.68, w: bw, h: 1.7, from: 0, to: 3, nameSize: 16, ...b }));
  }

  // 30 · Close vs. drop voicings
  {
    const s = slide('Close vs. drop voicings', `A close voicing packs a chord's notes as tightly as possible, inside one octave. That's natural on a piano, where each finger gets its own key. On a guitar it's awful: the four notes of a close 7th chord would need four adjacent strings with big stretches, and the result sounds cramped anyway.

The fix is to take one voice and drop it down an octave. That spreads the chord to just over an octave, which is exactly the span a hand covers across four strings. These are called drop voicings, and they are the guitar's own 7th chords.

Drop 2: list the close voicing, find the 2nd note from the top, and move it down an octave.
• Close Cmaj7 in 2nd inversion, low to high: G B C E.
• The 2nd voice from the top is C. Drop it an octave: C G B E.
• That's x3545x on strings 5-4-3-2, with the order R 5 7 3. Every root-position drop 2 chord has that order.

Drop 3: do the same with the 3rd voice from the top.
• Close Cmaj7 in 3rd inversion: B C E G.
• The 3rd voice from the top is C. Drop it: C B E G.
• That's 8x998x on strings 6-4-3-2, skipping the A string, with the order R 7 3 5. It's wide and warm, and it leaves room for a bassist.

Why derive them instead of memorizing? Because every close voicing has four inversions, so dropping gives you four drop 2 shapes and four drop 3 shapes for every chord type, on every string set. Learn the process and you'll never run out of voicings.

Try it now: play both shapes, then change one note at a time to get C7 (lower the B a fret), Cm7 (also lower the E) and Cm7♭5 (also lower the G).`);
    const rows = [
      { label: 'Drop 2', close: ['G', 'B', 'C', 'E'], n: 2, fing: 'x3545x', from: 2, to: 6, strings: 'Strings 5-4-3-2', text: 'Order **R 5 7 3**. The guitar’s most-used 7th chord shape.' },
      { label: 'Drop 3', close: ['B', 'C', 'E', 'G'], n: 3, fing: '8x998x', from: 7, to: 10, strings: 'Strings 6-4-3-2', text: 'Order **R 7 3 5**. Skips the A string: wide and warm.' },
    ];
    const deg = (n) => T.INTERVAL[T.semis('C', T.pc(n))];
    const roleN = (n) => T.role(T.semis('C', T.pc(n)));
    rows.forEach((r, ri) => {
      const top = CONTENT_TOP + ri * 2.68;
      const dropped = drop(r.close, r.n);
      // the result must be the voicing on the board, low to high
      const boardNotes = T.fingering(r.fing).sort((a, b) => T.midi(a.s, a.f) - T.midi(b.s, b.f)).map((p) => T.pcAt(p.s, p.f));
      if (boardNotes.join() !== dropped.map(T.pc).join()) throw new Error(`${r.label}: board does not match ${dropped.join(' ')}`);
      if (!sameSet(r.close, T.spellChord('C', 'maj7'))) throw new Error('Close voicing is not Cmaj7');
      I.heading(s, r.label, M, top, 3);
      const by = top + 0.78; const d = 0.55; const g = 0.12;
      s.addText('Close, low → high', { x: M, y: top + 0.42, w: 2.6, h: 0.26, fontSize: 12, color: HEX.muted, margin: 0, isTextBox: true });
      I.noteRow(s, { x: M, y: by, d, gap: g, notes: r.close.map((n) => ({ label: n, sub: deg(n), role: roleN(n) })) });
      const moved = r.close[r.close.length - r.n];
      const a1 = M + 4 * d + 3 * g + 0.12;
      I.arrow(s, a1, by + d / 2, a1 + 0.75, by + d / 2, { color: HEX.pearl });
      s.addText(`${moved} down 8va`, { x: a1 - 0.2, y: by + d / 2 + 0.08, w: 1.15, h: 0.4, fontSize: 11, bold: true, color: HEX.pearl, align: 'center', margin: 0, isTextBox: true });
      const x2 = a1 + 0.95;
      s.addText(`${r.label}, low → high`, { x: x2, y: top + 0.42, w: 2.6, h: 0.26, fontSize: 12, color: HEX.muted, margin: 0, isTextBox: true });
      I.noteRow(s, { x: x2, y: by, d, gap: g, notes: dropped.map((n) => ({ label: n, sub: deg(n), role: roleN(n) })) });
      const a2 = x2 + 4 * d + 3 * g + 0.12;
      I.arrow(s, a2, by + d / 2, a2 + 0.5, by + d / 2, { color: HEX.pearl });
      const bx = a2 + 0.65; const bw = 2.75;
      I.chordBoard(s, { x: bx, y: top, w: bw, h: 1.05, name: 'Cmaj7', sub: r.strings, root: 'C', fing: r.fing, from: r.from, to: r.to, nameSize: 16 });
      const tx = bx + bw + 0.3;
      D.text(s, r.text, { x: tx, y: top + 0.45, w: 12.73 - tx, h: 1.5, fontSize: 14 });
    });
  }

  // 31 · Shell voicings and guide tones
  {
    const s = slide('Shell voicings and guide tones', `A shell voicing is the smallest chord that still tells you everything: the root, the 3rd and the 7th. Three notes, three strings, no 5th.

Why those three? The 3rd decides major or minor. The 7th decides major 7, dominant 7 or minor 7. The 5th is the same in all three chords (a perfect 5th), so it adds nothing to the identity of the chord. Leave it out and the chord is still unmistakable, and much clearer under distortion or in a busy band.

The 3rd and 7th have a special name: guide tones. They're the notes that define the chord and the notes that move when the chords change. Look at A7 to D7, a IV chord move you'll play in every blues in A:
• A7 shell (5x56xx): A, G, C♯.
• D7 shell (x545xx): D, F♯, C.
• G (the ♭7 of A7) falls a half step to F♯ (the 3rd of D7).
• C♯ (the 3rd of A7) falls a half step to C (the ♭7 of D7).
Both guide tones move by a single fret while the root jumps strings. That smooth half-step motion is what makes the change sound inevitable. Part 5 explains why.

The shapes:
• 6th-string root: R, ♭7 on the D string, 3 on the G string. Change one fret to switch between 7, maj7 and m7.
• 5th-string root: R, 3 on the D string, ♭7 on the G string. The 3rd and 7th swap places.

Try it now: play a 12-bar blues in A using only shells: A7 (6th-string root, fret 5), D7 (5th-string root, fret 5), E7 (5th-string root, fret 7). Then play it again listening only to the G and B strings, the guide tones.

Common mistake: letting the open strings between shells ring. Shells only work if every other string is muted.`);
    const lw = 8.45; const bw = (lw - 0.5) / 3;
    const rowsDef = [
      { head: '6th-string root: R · ♭7 · 3', y: CONTENT_TOP, from: 4, to: 7, root: 'A', items: [['A7', '5x56xx', 'R ♭7 3'], ['Amaj7', '5x66xx', 'R 7 3'], ['Am7', '5x55xx', 'R ♭7 ♭3']] },
      { head: '5th-string root: R · 3 · ♭7', y: CONTENT_TOP + 2.62, from: 2, to: 6, root: 'D', items: [['D7', 'x545xx', 'R 3 ♭7'], ['Dmaj7', 'x546xx', 'R 3 7'], ['Dm7', 'x535xx', 'R ♭3 ♭7']] },
    ];
    for (const r of rowsDef) {
      I.heading(s, r.head, M, r.y, lw);
      r.items.forEach(([name, fing, sub], i) => I.chordBoard(s, { x: M + i * (bw + 0.25), y: r.y + 0.38, w: bw, h: 1.1, name, sub, root: r.root, fing, from: r.from, to: r.to, nameSize: 16 }));
    }
    const rx = M + lw + 0.35; const rw = 12.73 - rx;
    D.card(s, { x: rx, y: CONTENT_TOP, w: rw, h: 2.35, title: 'Root + guide tones', titleColor: HEX.pearl, body: [
      'The {third:3rd} says major or minor. The {seventh:7th} says maj7, 7 or m7.',
      'The 5th never changes, so it goes.',
    ], fontSize: 14, paraSpace: 8 });
    D.card(s, { x: rx, y: CONTENT_TOP + 2.55, w: rw, h: 2.75, title: 'A7 → D7: half steps', titleColor: HEX.pearl, body: [
      '{seventh:G} (♭7 of A7) falls to {third:F♯} (3 of D7).',
      '{third:C♯} (3 of A7) falls to {seventh:C} (♭7 of D7).',
      'Two notes move one fret each. That is the sound of a chord change.',
    ], fontSize: 14, paraSpace: 8 });
  }

  // 32 · Power chords, sus and quartal
  {
    const s = slide('Power chords, sus and quartal', `Some of the most useful chords on the guitar leave the 3rd out on purpose.

Power chords (A5) are the root and 5th, often with the root doubled on top. With no 3rd, the chord is neither major nor minor, so the same riff fits over a major or a minor key. There's an acoustic reason they rule under distortion too: a perfect 5th's overtones line up with the root's, so heavy gain makes the chord sound bigger instead of muddier. (Part 1's harmonic-series slide explains the physics.)

Sus chords replace the 3rd with a 2nd or a 4th.
• Asus2 (A B E): open, airy, unresolved. Very common in rock and in modern pop ballads.
• Asus4 (A D E): the 4th sits a half step above the major 3rd and leans on it. The classic move is sus4 to major: D falls to C♯. You hear tension, then release, without the chord changing root.
• A7sus4 adds the ♭7 and is a softer way to play a V chord.

Quartal chords are stacked 4ths instead of 3rds. Standard tuning is mostly 4ths (E-A-D-G, then G-B is the one major 3rd), so a one-finger barre across strings 6 to 3 is already a quartal chord. At fret 5 that's A D G C. Over an A bass it reads as R, 4, ♭7, ♭3: an Am11 sound with no 5th. Quartal voicings sound open, modern and ambiguous, which is why they're common in fusion and progressive metal.

Try it now: alternate Asus4 and A in a steady 8th-note strum, then Asus2, Asus4 and A. Then barre fret 5 on the four low strings and slide the whole shape up two frets and back: you're playing quartal harmony.

Common mistake: calling a sus chord minor or major. It's neither, and that ambiguity is the point.`);
    I.heading(s, 'Take out the 3rd', M, CONTENT_TOP, 6);
    const bw = (FULL_W - 0.25 * 3) / 4;
    const top = [
      { name: 'A5', fing: '577xxx', from: 4, to: 8, caption: 'R 5 R: neither major nor minor' },
      { name: 'Asus2', fing: 'x02200', from: 0, to: 3, caption: 'R 2 5: open, unresolved' },
      { name: 'Asus4', fing: 'x02230', from: 0, to: 3, caption: 'R 4 5: the 4 leans on the 3' },
      { name: 'A', fing: 'x02220', from: 0, to: 3, caption: 'Resolved: D falls to C♯' },
    ];
    top.forEach((b, i) => I.chordBoard(s, { x: M + i * (bw + 0.25), y: CONTENT_TOP + 0.38, w: bw, h: 1.05, root: 'A', nameSize: 16, ...b }));
    I.arrow(s, M + 3 * (bw + 0.25) - 0.22, CONTENT_TOP + 1.35, M + 3 * (bw + 0.25) - 0.03, CONTENT_TOP + 1.35, { color: HEX.pearl });
    I.heading(s, 'Stack 4ths instead', M, 4.45, 4.6);
    I.chordBoard(s, { x: M, y: 4.78, w: 4.4, h: 1.3, name: 'Quartal on A', sub: 'A D G C', root: 'A', fing: '5555xx', from: 3, to: 7, nameSize: 16, showFing: false });
    const cx = M + 4.75; const cw = (12.73 - cx - 0.3) / 2;
    D.card(s, { x: cx, y: 4.55, w: cw, h: 2.3, title: 'Why power chords rule', titleColor: HEX.pearl, body: 'No 3rd, so no major/minor clash: the riff fits **either key**, and gain makes a 5th sound bigger, not muddier.', fontSize: 14 });
    D.card(s, { x: cx + cw + 0.3, y: 4.55, w: cw, h: 2.3, title: 'Strings in 4ths', titleColor: HEX.pearl, body: 'E-A-D-G are 4ths apart, so **one barre across strings 6–3** is a quartal chord: R 4 ♭7 ♭3.', fontSize: 14 });
  }

  // 33 · Exercises on paper
  {
    const spell = [['E♭', 'maj7'], ['F♯', 'm7'], ['B♭', '7'], ['D', 'm7♭5'], ['G', '°7'], ['A♭', '+'], ['E', '7♯9'], ['D', '13']];
    const name = [['F', 'maj7', 1], ['B', 'm7♭5', 0], ['G', '7', 2], ['C♯', '°7', 3], ['E', '+', 1], ['D', 'm7', 2]];
    const drops = [['G B D F♯', 2], ['E G B♭ D', 2], ['B D F A', 3], ['C E♭ G B♭', 2]];
    const rot = (arr, k) => [...arr.slice(k), ...arr.slice(0, k)];
    const nameItems = name.map(([root, suf, k]) => {
      const notes = T.spellChord(root, suf);
      const shown = rot(notes, k);
      if (!sameSet(shown, notes)) throw new Error('rotation');
      return [shown.join(' '), root + suf];
    });
    const dropItems = drops.map(([close, n]) => [`Drop ${n} of ${close}`, drop(close.split(' '), n).join(' ')]);
    const g13 = T.spellFormula('G', ['1', 'b7', '3', '13']);
    const a7s9 = T.spellFormula('A', ['3', 'b7', '#9']);
    const dm9 = T.spellFormula('D', ['1', 'b3', 'b7', '9']);
    const c9five = T.spellDegree('C', '5');
    const cmaj11 = [T.spellDegree('C', '11'), T.spellDegree('C', '3')];
    I.worksheet(pres, {
      part: 3, kicker: K,
      notes: `Four groups, 22 questions. Work them on paper first, then check each answer on the guitar, then check the answer key at the back of the deck.

Group A: spell each chord, root first, then the other tones in stacking order. Write the formula above the root (for example 1 ♭3 ♭5 ♭7) and convert one degree at a time. Every tone gets the letter its degree demands: the 3rd is two letters above the root, the 5th four, the 7th six. That's why G°7 contains F♭ (its ♭♭7) rather than E, and why the ♯9 of E7♯9 is F♯♯, which sounds as G. Expect double flats and double sharps; they're correct, and the answer key uses them.

Group B: the notes are given in a scrambled order, as if from an inversion. Find the root by rearranging them into stacked 3rds (every other letter), then name the quality from the 3rds.

Group C: each close voicing is listed low to high. Find the voice the drop number names, counting from the top, and move it to the bottom. Write the result low to high.

Group D: voicing decisions. Use the order from the extensions slide: 5th first, then root, never the 3rd or 7th.

Scoring: at most one miss per group to pass. If you miss two or more in a group, reread the slide for that group, wait a day, and redo the whole group.`,
      groups: [
        { key: 'A', title: 'Spell the chord', instr: 'Root first, then 3rd, 5th, 7th, extensions.', cols: 2, rowGap: 0.06, items: spell.map(([r, sfx]) => [`${r}${sfx}`, T.spellChord(r, sfx).join(' ')]) },
        { key: 'B', title: 'Name the chord', instr: 'The notes are scrambled. Restack them in 3rds.', cols: 2, rowGap: 0.06, items: nameItems },
        { key: 'C', title: 'Find the drop voicing', instr: 'Close voicing given low → high. Answer low → high.', rowGap: 0.06, items: dropItems },
        { key: 'D', title: 'Voice it on four strings', rowGap: 0.06, items: [
          ['G13 in four notes: which four?', `${g13.join(' ')} (R ♭7 3 13)`],
          ['C9 in four notes: which tone goes?', `${c9five} (the 5th)`],
          ['Cmaj11: which tone clashes, and with what?', `${cmaj11[0]} (11) against ${cmaj11[1]} (3)`],
          ['A7♯9 over a bass player: three notes?', `${a7s9.join(' ')} (3 ♭7 ♯9; B♯ sounds as C)`],
          ['Dm9 without the 5th: which notes?', dm9.join(' ')],
        ] },
      ],
    });
  }

  // 34 · Exercises on the neck
  D.practice(pres, {
    kicker: K,
    title: 'Exercises on the neck',
    intro: 'Say every spelling out loud as you play. The shape is only where the notes happen to be.',
    drills: [
      { name: 'Four triads, one finger', how: 'On strings G-B-e, play major → minor → diminished → augmented from one root, moving one note at a time. All 12 roots around the circle of 4ths.', tempo: '60 bpm, 1 chord per beat', time: '5 min', done: 'All 12 roots, no stops' },
      { name: 'Shell blues', how: '12-bar blues in A, then C, then E, using only shells (6th- and 5th-string roots). Listen to the guide tones on the D and G strings.', tempo: '70 bpm shuffle', time: '5 min', done: '3 keys without looking' },
      { name: 'Drop 2 changes', how: 'Cmaj7 drop 2 (x3545x). Lower one note at a time: C7, Cm7, Cm7♭5, C°7. Then do it from F and B♭ on the same strings.', tempo: 'Free, then 60 bpm', time: '5 min', done: 'Say each chord tone as you change it' },
      { name: 'Color swaps', how: 'Hold a chord and change one note: A → Asus4 → A, C9 → C7♯9, A7 → A13. Strum each pair and name what changed.', tempo: '80 bpm, 2 beats each', time: '3 min', done: 'You hear the change before you see it' },
    ],
    notes: `Four drills that turn this part's spelling into reflexes. Do them in order; the whole set takes about 18 minutes.

1. Four triads, one finger. On the top three strings, start from a root on the G string and play the major triad. Then change exactly one note to get minor (lower the 3rd), then diminished (also lower the 5th), then augmented (back to major, raise the 5th). Say the quality and the moving note: "minor, E flat". Work around the circle of 4ths (C, F, B♭, E♭...) so you visit every root.

2. Shell blues. A 12-bar blues using three-note shells only: A7 with a 6th-string root, D7 and E7 with 5th-string roots. Mute everything else. Then move to C (C7, F7, G7) and E (E7, A7, B7). Your ears should start following the guide tones, the half-step moves on the D and G strings.

3. Drop 2 changes. From Cmaj7 drop 2, lower the 7th to get C7, lower the 3rd to get Cm7, lower the 5th to get Cm7♭5, and lower the 7th once more to get C°7. Each step moves one finger one fret. Then repeat from F (root on the A string at fret 8) and B♭ (fret 1).

4. Color swaps. Pairs of chords that differ by one note. Strum each pair back and forth and name the note that changed, its degree and its sound.

Log your times and the keys you covered. When drill 3 is easy, do it on strings 4-3-2-1 too.`,
  });
}

module.exports = { build };
