// Bridge deck · Chord → arpeggio → pentatonic: one window, three layers.
// Worked example: C major with its root on the 8th fret of the low E string.
const T = require('../lib/theory');
const D = require('../lib/draw');
const { HEX, M, CONTENT_TOP, section } = require('../lib/deck');

const K = 'Chords · arpeggios · pentatonics';
const FULL_W = 12.13;
const key = (p) => `${p.s}:${p.f}`;
const MAJ = T.CHORDS.maj;
const MAJ_PENT = T.SCALES.majPent;

function label(slide, str, x, y, w, size = 15, color = HEX.pearl) {
  slide.addText(D.runs(str, { color, fontSize: size, bold: true }), { x, y, w, h: 0.34, margin: 0, valign: 'middle', isTextBox: true });
}
function caption(slide, str, x, y, w, h = 0.5, size = 13) {
  D.text(slide, str, { x, y, w, h, fontSize: size, color: HEX.muted });
}

// The five C major windows. C major pentatonic has the same notes as A minor pentatonic,
// so each window is one of the A minor boxes from Level 1.
const WINDOWS = [
  { shape: 'C', fing: 'x32010', box: 4, shift: -1, from: 0, to: 3, roots: '5, 2' },
  { shape: 'A', fing: 'x.3.5.5.5.3', box: 5, shift: -1, from: 2, to: 5, roots: '5, 3' },
  { shape: 'G', fing: '8.7.5.5.5.8', box: 1, shift: 0, from: 5, to: 8, roots: '6, 3, 1' },
  { shape: 'E', fing: '8.10.10.9.8.8', box: 2, shift: 0, from: 7, to: 10, roots: '6, 4, 1' },
  { shape: 'D', fing: 'x.x.10.12.13.12', box: 3, shift: 0, from: 10, to: 13, roots: '4, 2' },
];
const win = (name) => WINDOWS.find((w) => w.shape === name);
const pentOf = (w) => T.pentBox('A', w.box, { shiftOctave: w.shift });

// Check a chord shape really sits inside its pentatonic window (catches a wrong table row at build time).
for (const w of WINDOWS) {
  const box = new Set(pentOf(w).map(key));
  for (const p of T.fingering(w.fing)) {
    if (!MAJ.includes(T.semis('C', T.pcAt(p.s, p.f)))) throw new Error(`${w.shape} shape note ${key(p)} is not a C chord tone`);
    if (!box.has(key(p))) throw new Error(`${w.shape} shape note ${key(p)} is outside A minor box ${w.box}`);
  }
}

// Pentatonic dots for C: chord tones colored, 2 and 6 gray; notes of `voicing` filled, others ringed when ringRest.
function layered(positions, { voicing, ringRest = false } = {}) {
  const inV = new Set((voicing || []).map(key));
  return D.dotsFor(positions, { root: 'C', label: 'interval', ring: ringRest ? (p) => !inV.has(key(p)) : undefined });
}

function build(pres) {
  section(pres, 'Chords, arpeggios and pentatonics');

  // 1 · Title
  {
    const s = pres.addSlide({ masterName: 'Title', sectionTitle: 'Chords, arpeggios and pentatonics' });
    s._title = 'title';
    s.addText('FRETBOARD FREEDOM · BRIDGE LESSON', { placeholder: 'kicker' });
    s.addText('Find the chord, find the scale', { placeholder: 'title' });
    s.addText('How chords, arpeggios and pentatonics fit inside each other, worked through with a C chord at the 8th fret.', { placeholder: 'body' });
    const e = win('E');
    D.fretboard(s, {
      x: 8.35, y: 2.3, w: 4.4, h: 2.6, from: 6, to: 11, root: 'C', title: 'title', dotSize: 0.44,
      dots: layered(pentOf(e), { voicing: T.fingering(e.fing), ringRest: true }),
    });
    s.addText('C chord (filled) inside C major pentatonic (rings)', { x: 8.35, y: 5.3, w: 4.4, h: 0.3, fontSize: 12, color: HEX.muted, align: 'center', margin: 0, isTextBox: true });
    D.legend(s, { x: 8.6, y: 5.75, roles: ['root', 'third', 'fifth', 'other'], names: { root: 'Root', third: '3', fifth: '5', other: '2 / 6' }, gap: 0.2, fontSize: 11 });
    s.addNotes(`This is a short bridge lesson that sits between Level 1 Part 4 (Breaking out of box 1) and Level 2 Part 3 (Chord tones everywhere).

The question it answers: "If I can find a chord on the neck, how do I find the pentatonic scale and the arpeggio that go with it, right there, without moving?"

The short answer: you don't need three separate maps. A chord shape, its arpeggio and its pentatonic scale all live in the same 4-fret window. The chord is a few of the notes. The arpeggio is every chord tone in that window. The pentatonic is the arpeggio plus two extra notes. Find the chord, and the other two are already under your fingers.

Level 1 showed this idea in A minor only (slide 37, "Every box hides a chord shape"). This lesson starts from a major chord, which is the more common real-world situation: a song says "C", and you need to know where to play.

The diagram is the whole lesson in one picture: the filled dots are the C barre chord at the 8th fret; the rings are the rest of the C major pentatonic in that window.`);
  }

  // 2 · The big idea: three layers in one window
  {
    const s = D.slideOf(pres, {
      kicker: K, title: 'One window, three layers',
      notes: `The big idea: chord, arpeggio and pentatonic are not three different things to memorize. They are three layers of the same window.

Left: the chord. The C barre chord with its root on the 8th fret of the low E string (the E-shape barre). Six strings, but only three different notes: C, E and G.

Middle: the arpeggio. Every C, E and G inside the same frets (7–10). It contains every note of the chord shape plus one more: the E on the A string at fret 7, which the barre chord doesn't use. An arpeggio is just "the chord, one note at a time, using every chord tone in the area".

Right: the pentatonic. The arpeggio plus two new notes, D (the 2) and A (the 6), shown in gray. That's C major pentatonic: C D E G A.

So: chord ⊂ arpeggio ⊂ pentatonic. Each layer contains the one before it.

Why this matters when you solo:
• The colored notes (chord tones) are where phrases sound resolved. Land on them on strong beats.
• The gray notes (2 and 6) are passing notes. They connect chord tones and give a melody movement.
• You never have to "switch maps". If you can see the chord, you can see the arpeggio and the scale.

Try it: strum the C barre at fret 8. Then pick each colored note of the middle board one at a time. Then play the right-hand board as a scale. Same hand position the whole time.`,
    });
    const e = win('E');
    const chord = T.fingering(e.fing);
    const arp = T.chordTonesIn('C', MAJ, 7, 10);
    const pent = pentOf(e);
    const w = (FULL_W - 2 * 0.36) / 3;
    const cols = [
      { name: '1 · Chord', sub: 'C barre, E shape: 3 notes, 6 strings', dots: D.dotsFor(chord, { root: 'C', label: 'interval' }) },
      { name: '2 · Arpeggio', sub: 'Every C, E and G in frets 7–10', dots: D.dotsFor(arp, { root: 'C', label: 'interval' }) },
      { name: '3 · Pentatonic', sub: 'The arpeggio + D (2) and A (6)', dots: D.dotsFor(pent, { root: 'C', label: 'interval' }) },
    ];
    cols.forEach((c, i) => {
      const x = M + i * (w + 0.36);
      label(s, c.name, x, 1.62, w, 17, HEX.white);
      caption(s, c.sub, x, 2.0, w, 0.3, 13);
      D.fretboard(s, { x, y: 2.5, w, h: 2.15, from: 6, to: 11, root: 'C', dots: c.dots, fretNumSize: 9 });
    });
    for (let i = 0; i < 2; i++) {
      const ax = M + (i + 1) * (w + 0.36) - 0.3;
      s.addText('⊂', { x: ax, y: 3.3, w: 0.24, h: 0.5, fontSize: 22, bold: true, color: HEX.pearl, align: 'center', valign: 'middle', margin: 0, isTextBox: true });
    }
    D.card(s, {
      x: M, y: 5.3, w: FULL_W, h: 1.5, pad: 0.25, fontSize: 16,
      title: 'Chord ⊂ arpeggio ⊂ pentatonic',
      body: 'Each layer contains the one before it. {root:Root}, {third:3rd} and {fifth:5th} are your landing notes; the gray **2** and **6** are passing notes that connect them.',
    });
  }

  // 3 · The recipe: add two notes
  {
    const s = D.slideOf(pres, {
      kicker: K, title: 'The recipe: arpeggio + two notes',
      notes: `Here's the formula behind the right-hand board on the last slide. It works for every major and minor chord, in every key.

Major chord → major arpeggio → major pentatonic
• Chord / arpeggio: R 3 5 (C E G).
• Add the 2 (a whole step above the root) and the 6 (a whole step above the 5th).
• Result: R 2 3 5 6 = C D E G A, C major pentatonic.

Minor chord → minor arpeggio → minor pentatonic
• Chord / arpeggio: R ♭3 5 (C E♭ G).
• Add the 4 (a whole step above the ♭3) and the ♭7 (a whole step below the root).
• Result: R ♭3 4 5 ♭7 = C E♭ F G B♭, C minor pentatonic.

Notice the pattern: in both cases the two added notes sit a whole step away from chord tones. That's why pentatonics sound so smooth: every note is at most a step or so from a chord tone.

Two bonuses:
• The minor pentatonic already contains the ♭7, so it also contains the whole m7 arpeggio (R ♭3 5 ♭7). That's the Level 2 shortcut "Am7 = A minor pentatonic minus the 4th".
• The major pentatonic contains the 6, so it contains a C6 chord (C E G A). That's the sweet, country-and-classic-rock sound of major pentatonic.

What a pentatonic does NOT contain: the 4th and 7th of a major scale (F and B in C). Remember that. It comes back on the "follow the chords" slide.`,
    });
    const rows = [
      { title: 'Major', chord: 'C major chord', ivs: MAJ_PENT, root: 'C', tones: [0, 4, 7], sum: 'C major pentatonic', y: 1.75 },
      { title: 'Minor', chord: 'C minor chord', ivs: T.SCALES.minPent, root: 'C', tones: [0, 3, 7], sum: 'C minor pentatonic', y: 3.75 },
    ];
    for (const r of rows) {
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y: r.y, w: FULL_W, h: 1.75, rectRadius: 0.1, fill: { color: HEX.card }, line: { color: HEX.card, width: 0 } });
      label(s, r.title, M + 0.3, r.y + 0.2, 2.2, 22, HEX.white);
      caption(s, `${r.chord} → arpeggio → ${r.sum}`, M + 0.3, r.y + 0.65, 2.6, 0.9, 13);
      const d = 0.72; const gap = 0.36; let x = 3.6;
      r.ivs.forEach((iv) => {
        const isTone = r.tones.includes(iv);
        const role = T.role(iv);
        const lab = T.INTERVAL[iv];
        const note = T.spellIn('C', T.mod12(T.pc('C') + iv));
        if (isTone) D.badge(s, { x, y: r.y + 0.3, d, label: lab, role, fontSize: 20 });
        else s.addText(lab, { shape: pres.shapes.OVAL, x, y: r.y + 0.3, w: d, h: d, fill: { color: HEX.card2 }, line: { color: HEX.other, width: 2, dashType: 'dash' }, color: HEX.other, bold: true, fontSize: 20, align: 'center', valign: 'middle', margin: 0 });
        s.addText(note, { x: x - 0.1, y: r.y + 1.1, w: d + 0.2, h: 0.3, fontSize: 14, bold: true, color: isTone ? HEX.text : HEX.muted, align: 'center', margin: 0, isTextBox: true });
        if (!isTone) s.addText('added', { x: x - 0.2, y: r.y + 1.38, w: d + 0.4, h: 0.24, fontSize: 10, color: HEX.muted, align: 'center', margin: 0, isTextBox: true });
        x += d + gap;
      });
      const formula = r.title === 'Major'
        ? '{root:R} {third:3} {fifth:5}  **+ 2 + 6**'
        : '{root:R} {third:♭3} {fifth:5}  **+ 4 + ♭7**';
      D.text(s, formula, { x: 9.6, y: r.y + 0.35, w: 3.0, h: 0.4, fontSize: 18 });
      caption(s, r.title === 'Major' ? 'Both added notes sit a whole step above a chord tone.' : 'Contains the whole m7 arpeggio (R ♭3 5 ♭7) for free.', 9.6, r.y + 0.85, 2.9, 0.75, 13);
    }
    D.text(s, 'Colored = chord tones (the arpeggio). Dashed gray = the two notes the pentatonic adds.', { x: M, y: 5.85, w: FULL_W, h: 0.4, fontSize: 15, color: HEX.muted });
  }

  // 4 · Step 1: find the root, pick a shape
  {
    const s = D.slideOf(pres, {
      kicker: `${K} · step 1`, title: 'C at the 8th fret: two chord shapes share that root',
      notes: `Step 1 is always: find the root, then decide which chord shape you're in.

C is on the 8th fret of the low E string (and the high e string). Two CAGED shapes have their root right there:

Left: the E shape. The barre chord you already know: 8-10-10-9-8-8. The root is under your INDEX finger and the shape reaches UP the neck to fret 10. Window: frets 7–10.

Right: the G shape. 8-7-5-5-5-8. The root is under your PINKY and the shape reaches DOWN the neck to fret 5. You'd rarely strum this whole shape (it's a stretch), but it's very real as a soloing area. Window: frets 5–8.

So "the pentatonic closest to a C at the 8th fret" has two good answers, depending on which way your hand is pointing. Both are on the next slides. The rule of thumb:
• Root under the index finger → play the window above it (frets 7–10).
• Root under the pinky → play the window below it (frets 5–8).

The same thing happens with every root on the low E string. It's the CAGED sequence: G shape, then E shape, joined at the root.

Try it: put your index finger on fret 8, low E. Play the E-shape barre. Now put your pinky on that same note and find the G shape. Same C, same root, two hand positions.`,
    });
    const g = win('G'); const e = win('E');
    const bw = 5.85;
    const boards = [
      { w: e, x: M, name: 'E shape · root under the index finger', sub: 'Reaches up the neck. Window: frets **7–10**.' },
      { w: g, x: M + bw + 0.43, name: 'G shape · root under the pinky', sub: 'Reaches down the neck. Window: frets **5–8**.' },
    ];
    for (const b of boards) {
      label(s, b.name, b.x, 1.65, bw, 16, HEX.white);
      D.fretboard(s, {
        x: b.x, y: 2.55, w: bw, h: 2.3, from: 4, to: 11, root: 'C',
        dots: D.dotsFor(T.fingering(b.w.fing), { root: 'C', label: 'interval' }),
        shade: [{ from: b.w.from, to: b.w.to }],
        regions: [{ from: b.w.from, to: b.w.to, label: `${b.w.shape}-shape window` }],
      });
      D.text(s, b.sub, { x: b.x, y: 5.25, w: bw, h: 0.35, fontSize: 15 });
    }
    D.card(s, {
      x: M, y: 5.8, w: FULL_W, h: 1.02, pad: 0.22, fontSize: 16,
      body: 'Both shapes share the {root:C} on fret 8 of the low and high E strings. **Index on the root → look up the neck. Pinky on the root → look down the neck.**',
    });
  }

  // 5 · Step 2: the arpeggio in the E-shape window
  {
    const s = D.slideOf(pres, {
      kicker: `${K} · step 2`, title: 'Step 2: light up every chord tone in the window',
      notes: `Step 2: keep your hand where the chord is and find every C, E and G inside frets 7–10. That's the C major arpeggio for this position.

The filled dots are the notes you were already holding in the barre chord. The ring is the one chord tone the barre chord skips: E on the A string, fret 7. Your index finger reaches back one fret to get it.

The tab shows the arpeggio from the lowest root up to the high C and back down: R 3 5 R 3 5 R. That's two octaves of C major, one note per string except the A string.

How to practice it:
1. Strum the C barre chord once.
2. Play the arpeggio up and down, one note per beat at 60 bpm.
3. Say the interval of each note out loud: "root, three, five, root, three, five, root".
4. Then improvise with ONLY these notes over a C drone or a C chord loop. It sounds more musical than you'd expect.

Fingering: index on fret 7–8, middle on 9, ring/pinky on 10. One finger per fret.

A minor chord? Same step. For Cm (barre 8-10-10-8-8-8) the 3rds move down a fret: E♭ instead of E. Everything else stays put.`,
    });
    const e = win('E');
    const chordSet = new Set(T.fingering(e.fing).map(key));
    const arp = T.chordTonesIn('C', MAJ, 7, 10);
    D.fretboard(s, {
      x: M, y: 1.75, w: 6.6, h: 2.9, from: 6, to: 11, root: 'C',
      dots: D.dotsFor(arp, { root: 'C', label: 'interval', ring: (p) => !chordSet.has(key(p)) }),
    });
    D.legend(s, { x: M + 0.3, y: 5.0, roles: ['root', 'third', 'fifth'], names: { root: 'Root (C)', third: '3 (E)', fifth: '5 (G)' }, fontSize: 13 });
    caption(s, 'Filled: notes in the barre chord. Ring: the extra chord tone (E, A string, fret 7).', M, 5.45, 6.6, 0.6, 13);
    label(s, 'C major arpeggio · up and back', 7.65, 1.7, 5.1, 16, HEX.white);
    D.tab(s, {
      x: 7.65, y: 2.35, w: 5.08, gap: 0.3,
      cols: ['6:8', '5:7', '5:10', '4:10', '3:9', '2:8', '1:8', '|', '2:8', '3:9', '4:10', '5:10', '5:7', '6:8'],
      check: { root: 'C', scale: MAJ },
    });
    D.text(s, '{root:R}  {third:3}  {fifth:5}  {root:R}  {third:3}  {fifth:5}  {root:R}', { x: 7.95, y: 4.1, w: 4.8, h: 0.4, fontSize: 15 });
    D.card(s, {
      x: 7.65, y: 4.75, w: 5.08, h: 1.6, title: 'Minor chord?', fontSize: 14,
      body: 'Same window, same step. For **Cm** the {third:3rds} drop one fret (E → E♭). Roots and 5ths don’t move.',
    });
  }

  // 6 · Step 3: the pentatonic in the E-shape window
  {
    const s = D.slideOf(pres, {
      kicker: `${K} · step 3`, title: 'Step 3: add the 2 and 6, and it’s a pentatonic box',
      notes: `Step 3: add the two pentatonic notes. For a major chord that's the 2 (D) and the 6 (A). Each one is a whole step (2 frets) above a chord tone, so they're easy to find: from every C, go 2 frets up for D; from every G, go 2 frets up for A.

The result is C major pentatonic in frets 7–10, two notes per string.

Here's the part that saves you work: look at the shape. It's A minor pentatonic box 2, the box you already learned in Level 1. C major pentatonic and A minor pentatonic are the same five notes (C D E G A), because A minor is C major's relative minor. So you don't need to learn a new shape. You need to know that box 2 of A minor, seen with C as the root, is "the C major pentatonic around the C barre at fret 8".

The lick on the right stays in this window and lands on chord tones:
• It starts on the 5 (G) and climbs through the 6 (A) to the root.
• It comes back down and ends on the 3 (E, G string fret 9), the note that makes the chord sound major.
Play it slowly over a C chord and listen to how the last note "sits" on the chord.

What about the ring around box 2 on the left? That's the C at fret 10 on the D string, the root in the middle of the shape. Watch it: it's the note you'll land on most often.

Practice: play the box as a scale, then play only colored notes for 4 bars, then all notes for 4 bars. Hear the difference between landing notes and passing notes.`,
    });
    const e = win('E');
    const pent = pentOf(e);
    D.fretboard(s, { x: M, y: 1.75, w: 6.6, h: 2.9, from: 6, to: 11, root: 'C', dots: D.dotsFor(pent, { root: 'C', label: 'interval' }) });
    D.legend(s, { x: M + 0.3, y: 5.0, roles: ['root', 'third', 'fifth', 'other'], names: { root: 'Root (C)', third: '3 (E)', fifth: '5 (G)', other: '2 (D) and 6 (A)' }, fontSize: 13 });
    D.card(s, {
      x: M, y: 5.45, w: 6.6, h: 1.1, pad: 0.22, fontSize: 15,
      body: '**You already know this shape:** it’s A minor pentatonic **box 2**. C major pentatonic and A minor pentatonic share the same five notes.',
    });
    label(s, 'Lick: start on the 5, end on the 3', 7.65, 1.7, 5.1, 16, HEX.white);
    D.tab(s, {
      x: 7.65, y: 2.35, w: 5.08, gap: 0.3,
      cols: ['2:8', '2:10', '1:8', '1:10', '1:8', '|', '2:10', '2:8', '3:9', '', '3:9'],
      check: { root: 'C', scale: MAJ_PENT },
    });
    D.text(s, ['{fifth:5}  6  {root:R}  2  {root:R}   |   6  {fifth:5}  {third:3}  …  {third:3}'], { x: 7.95, y: 4.1, w: 4.8, h: 0.4, fontSize: 14 });
    D.card(s, {
      x: 7.65, y: 4.75, w: 5.08, h: 1.6, title: 'How to find the 2 and 6', fontSize: 14,
      body: ['From every {root:C}, go **2 frets up** → D (the 2).', 'From every {fifth:G}, go **2 frets up** → A (the 6).'],
    });
  }

  // 7 · The other window: root under the pinky
  {
    const s = D.slideOf(pres, {
      kicker: K, title: 'The other window: root under the pinky',
      notes: `Same C at the 8th fret, but now the hand points down the neck: the G-shape window, frets 5–8.

Do the same three steps:
1. Chord: the G shape, 8-7-5-5-5-8 (filled dots).
2. Arpeggio: every C, E and G in frets 5–8.
3. Pentatonic: add D and A. The result (all dots) is C major pentatonic in frets 5–8.

And again, you already know the shape. It's A minor pentatonic box 1, the box at the 5th fret. When you've been playing box 1 in A minor, you've been playing C major pentatonic with C under your pinky on the low E string.

This is the same fact as Level 1's rule "major pentatonic = the minor shape 3 frets down": C minor box 1 lives at fret 8; slide it down 3 frets to fret 5 and it's C major pentatonic.

So the full answer to "what's the closest pentatonic to a C chord with its root on the 8th fret?":
• If you're playing the E-shape barre (root under the index): A minor box 2 shape, frets 7–10.
• If your hand is lower (root under the pinky): A minor box 1 shape, frets 5–8.
• The two windows overlap on frets 7–8, so you can slide between them through the root.

Try it: play a lick in the 5–8 window, slide up through the C at fret 8 on the low E or high e, and continue in the 7–10 window.`,
    });
    const g = win('G'); const e = win('E');
    const bw = 5.85;
    const pairs = [
      { w: g, x: M, name: 'G-shape window · frets 5–8', box: 'A minor box 1', from: 4, to: 9 },
      { w: e, x: M + bw + 0.43, name: 'E-shape window · frets 7–10', box: 'A minor box 2', from: 6, to: 11 },
    ];
    for (const p of pairs) {
      label(s, p.name, p.x, 1.65, bw, 16, HEX.white);
      D.fretboard(s, { x: p.x, y: 2.15, w: bw, h: 2.35, from: p.from, to: p.to, root: 'C', dots: layered(pentOf(p.w), { voicing: T.fingering(p.w.fing), ringRest: true }) });
      D.text(s, `Shape = **${p.box}**`, { x: p.x, y: 4.9, w: bw, h: 0.35, fontSize: 15 });
    }
    D.card(s, {
      x: M, y: 5.45, w: FULL_W, h: 1.05, pad: 0.22, fontSize: 15,
      body: '**Filled:** the chord shape. **Rings:** the rest of C major pentatonic. The windows overlap at frets 7–8: slide through the {root:C} on fret 8 to move from one to the other.',
    });
  }

  // 8 · Major or minor sound
  {
    const s = D.slideOf(pres, {
      kicker: K, title: 'Want it bluesy? Same root, minor box',
      notes: `Over a C major chord you have two pentatonic choices, and they sound very different.

Left: C major pentatonic (C D E G A), frets 7–10. Sweet, open, "happy". It matches the chord: its 3rd is E, the chord's 3rd. Use it in major-key pop, country, southern rock and classic rock.

Right: C minor pentatonic (C E♭ F G B♭), frets 8–11. This is box 1 of C minor, with the root under your index finger on fret 8. It's the dark, bluesy sound. Over a plain C major chord its ♭3 (E♭) rubs against the chord's E. In a blues (C7 chord) that rub is the point; bend the E♭ up a little toward E and it sounds great. In a sweet major-key ballad it just sounds wrong.

If the chord is Cm, the choice is easy: C minor pentatonic fits perfectly, because its ♭3 is the chord's ♭3. The Cm barre at fret 8 (8-10-10-8-8-8) sits right inside this box: that's Level 1 slide 37 again, moved from A to C (3 frets up).

Quick decision guide:
• Chord is C or Cmaj7, song is happy → C major pentatonic.
• Chord is C7, song is a blues → C minor pentatonic (and mix in the major one).
• Chord is Cm or Cm7 → C minor pentatonic.

Both boxes keep the C at fret 8 as a red root, so you can switch sound without moving your hand much.`,
    });
    const bw = 5.85;
    const e = win('E');
    const minBox = T.pentBox('C', 1);
    const cmChord = new Set(T.fingering('8.10.10.8.8.8').map(key));
    const boards = [
      { x: M, name: 'C major pentatonic · frets 7–10', dots: layered(pentOf(e), { voicing: T.fingering(e.fing), ringRest: true }), from: 6, to: 11, sub: '**Sweet, major.** Fits C and Cmaj7.' },
      { x: M + bw + 0.43, name: 'C minor pentatonic · box 1, frets 8–11', dots: D.dotsFor(minBox, { root: 'C', label: 'interval', ring: (p) => !cmChord.has(key(p)) }), from: 7, to: 12, sub: '**Dark, bluesy.** Fits Cm, Cm7, and C7 in a blues.' },
    ];
    for (const b of boards) {
      label(s, b.name, b.x, 1.65, bw, 16, HEX.white);
      D.fretboard(s, { x: b.x, y: 2.15, w: bw, h: 2.35, from: b.from, to: b.to, root: 'C', dots: b.dots });
      D.text(s, b.sub, { x: b.x, y: 4.9, w: bw, h: 0.35, fontSize: 15 });
    }
    D.table(s, [
      ['The chord is…', 'C or Cmaj7, happy song', 'C7 in a blues', 'Cm or Cm7'],
      ['Play', 'C major pentatonic', 'C minor pentatonic (+ major)', 'C minor pentatonic'],
    ], { x: M, y: 5.5, w: 11.93, colW: [2.33, 3.2, 3.2, 3.2], fontSize: 14, boldFirstCol: true, align: ['left', 'center', 'center', 'center'] });
  }

  // 9 · All five C windows
  {
    const s = D.slideOf(pres, {
      kicker: K, title: 'Every C chord shape has its own pentatonic window',
      notes: `The method works anywhere on the neck. C major can be played with all five CAGED shapes, and each one has its own window of C major pentatonic around it.

From the nut up:
• C shape (open C chord), frets 0–3 → A minor box 4 shape (an octave down).
• A shape (barre at fret 3, root on the A string), frets 2–5 → A minor box 5 shape.
• G shape (root on low E fret 8, under the pinky), frets 5–8 → A minor box 1.
• E shape (barre at fret 8), frets 7–10 → A minor box 2.
• D shape (root on the D string, fret 10), frets 10–13 → A minor box 3.
Then the C shape returns at fret 12 (box 4) and it all repeats.

The board shows the whole C major pentatonic from the nut to fret 15. Colored dots are chord tones (the arpeggio), gray dots are the 2 and 6. The brackets mark each window.

How to use it: wherever you are on the neck, find the nearest C root, figure out which chord shape it belongs to (the "Roots on strings" row helps), and you know which box you're in.

The same five shapes work for every major chord. Move everything up 2 frets and it's D major. Move it down 3 and it's A major.`,
    });
    const all = T.positions(T.pcsOf('C', MAJ_PENT), { from: 0, to: 15 });
    D.fretboard(s, {
      x: M, y: 2.45, w: FULL_W, h: 2.3, from: 0, to: 15, root: 'C',
      dots: D.dotsFor(all, { root: 'C', label: 'interval' }),
      regions: WINDOWS.map((w, i) => ({ from: w.from, to: w.to, label: `${w.shape} shape`, row: i % 2 })),
    });
    D.table(s, [
      ['C major', ...WINDOWS.map((w) => `${w.shape} shape`)],
      ['Frets', ...WINDOWS.map((w) => `${w.from}–${w.to}`)],
      ['Roots on strings', ...WINDOWS.map((w) => w.roots)],
      ['Pentatonic shape', ...WINDOWS.map((w) => `A minor box ${w.box}`)],
    ], { x: M, y: 5.25, w: 11.93, colW: [2.18, 1.95, 1.95, 1.95, 1.95, 1.95], fontSize: 13, boldFirstCol: true, align: ['left', 'center', 'center', 'center', 'center', 'center'] });
  }

  // 10 · Shortcut for any major chord
  {
    const s = D.slideOf(pres, {
      kicker: K, title: 'Shortcut for any major chord: 3 frets down',
      notes: `You learned the five boxes in A minor. Here's how to reuse them for any major chord without relearning anything.

Every major key has a relative minor whose root is 3 frets lower (a minor 3rd down). C major ↔ A minor. G major ↔ E minor. D major ↔ B minor. Same five notes in each pair's pentatonic.

So for a major chord with its root on the low E string:
1. Find the root (C at fret 8).
2. Count 3 frets down on the same string (A at fret 5).
3. That's where the relative minor's box 1 starts. Box 1 there = the G-shape window (root under the pinky). The next box up, box 2, starts right on your major root = the E-shape window.

On the board: the C notes are red (roots), the A notes are ringed. The A at fret 5 on the low E string is where "A minor box 1" starts, and box 2 begins at the C on fret 8.

The table lists the five chords you'll meet most often with their roots on the low E string.

Watch out: this works for MAJOR chords. For a MINOR chord, don't move: the minor box 1 starts right on the root (Cm at fret 8 → C minor box 1 at fret 8).`,
    });
    const bothBoxes = [...T.pentBox('A', 1), ...T.pentBox('A', 2)];
    const uniq = [...new Map(bothBoxes.map((p) => [key(p), p])).values()];
    D.fretboard(s, {
      x: M, y: 2.1, w: 6.9, h: 2.5, from: 4, to: 11, root: 'C',
      dots: D.dotsFor(uniq, { root: 'C', label: 'note', ring: (p) => T.pcAt(p.s, p.f) === T.pc('A') }),
      regions: [{ from: 5, to: 8, label: 'A minor box 1', row: 0 }, { from: 7, to: 10, label: 'box 2', row: 1 }],
    });
    D.card(s, {
      x: M, y: 5.0, w: 6.9, h: 1.5, pad: 0.24, fontSize: 15,
      body: ['**Major root, count 3 frets down** = relative minor root.', '{root:C} at 8 → A at 5. Play A minor boxes 1 and 2 and you are playing C major pentatonic.'],
    });
    const chords = [['G', 'E'], ['A', 'F♯'], ['C', 'A'], ['D', 'B'], ['E', 'C♯']];
    const fretOn6 = (n) => { const f = T.mod12(T.pc(n) - T.pc('E')); return f === 0 ? 12 : f; };
    const rows = [['Major chord', 'Root fret (low E)', 'Relative minor', 'Box 1 starts at']];
    for (const [maj, min] of chords) {
      const mf = fretOn6(maj); const nf = mf - 3;
      if (T.mod12(T.pcAt(6, nf)) !== T.pc(min)) throw new Error(`relative minor ${min} not at fret ${nf}`);
      rows.push([`**${maj}**`, String(mf), `${min}m`, `fret ${nf}`]);
    }
    D.table(s, rows, { x: 7.85, y: 1.75, w: 4.7, colW: [1.15, 1.25, 1.15, 1.15], fontSize: 14, align: ['left', 'center', 'center', 'center'] });
    D.card(s, {
      x: 7.85, y: 5.0, w: 4.7, h: 1.5, pad: 0.24, fontSize: 14, title: 'Minor chord? Don’t move',
      body: 'Minor box 1 starts on the root itself: **Cm at 8 → C minor box 1 at 8.**',
    });
  }

  // 11 · Follow the chords without moving
  {
    const s = D.slideOf(pres, {
      kicker: K, title: 'Follow the chords without leaving the window',
      notes: `The real payoff. In a song in C, the chords change but your hand doesn't have to. Stay in the 7–10 window and switch which notes you aim at.

The four boards show the chord tones of C, Am, F and G (the I–vi–IV–V progression) inside frets 7–10, labeled with their note names. Red is each chord's own root, amber its 3rd, blue its 5th.

How to use it: over each chord, play freely from the C major pentatonic box, but land on one of that chord's colored notes on beat 1 of its bar. That's "playing the changes" in its simplest form.

Notice what the F and G boards contain: F (the root of F) and B (the 3rd of G). Neither is in the C major pentatonic. This is exactly where arpeggios beat scales. The pentatonic is safe over the whole song, but it can't give you the most colorful note of F or G. The arpeggio can, and it's right there in the same window, one fret away from a pentatonic note.

Practice: loop C–Am–F–G, one bar each, at 70 bpm.
Round 1: play only the root of each chord, in this window.
Round 2: play only the 3rd of each chord (E, C, A, B). Hear how the 3rds alone outline the progression.
Round 3: improvise from the pentatonic, landing on a chord tone each time the chord changes.`,
    });
    const chords = [
      { name: 'C', root: 'C', ivs: MAJ, num: 'I' },
      { name: 'Am', root: 'A', ivs: T.CHORDS.min, num: 'vi' },
      { name: 'F', root: 'F', ivs: MAJ, num: 'IV' },
      { name: 'G', root: 'G', ivs: MAJ, num: 'V' },
    ];
    const gap = 0.3;
    const w = (FULL_W - 3 * gap) / 4;
    chords.forEach((c, i) => {
      const x = M + i * (w + gap);
      label(s, `${c.num} · ${c.name}`, x, 1.65, w, 17, HEX.white);
      caption(s, `Chord tones: ${c.ivs.map((iv) => T.spellIn(c.root, T.mod12(T.pc(c.root) + iv))).join(' ')}`, x, 2.0, w, 0.3, 13);
      const tones = T.chordTonesIn(c.root, c.ivs, 7, 10);
      D.fretboard(s, { x, y: 2.5, w, h: 2.0, from: 7, to: 10, root: c.root, dots: D.dotsFor(tones, { root: c.root, label: 'note' }), fretNumSize: 9, labelSize: 10 });
    });
    D.card(s, {
      x: M, y: 5.05, w: 7.2, h: 1.78, pad: 0.24, fontSize: 15, title: 'Same hand, new targets',
      body: 'Play C major pentatonic over the whole progression, but land on the **current chord’s** colored notes when the chord changes.',
    });
    D.card(s, {
      x: 8.1, y: 5.05, w: 4.63, h: 1.78, pad: 0.24, fontSize: 14, title: 'Where arpeggios win',
      body: 'F (root of F) and B (3rd of G) aren’t in the pentatonic. The arpeggio gives you the notes the scale is missing.',
    });
  }

  // 12 · Practice this
  D.practice(pres, {
    kicker: K,
    intro: 'Ten minutes a day. Always strum the chord first so your ear knows what the notes belong to.',
    drills: [
      {
        name: 'Chord → arpeggio → scale',
        how: 'Pick one C window. Strum the chord, play the arpeggio up and down, then the pentatonic up and down. Move to the next window.',
        tempo: '60 bpm, one note per beat',
        time: '4 min',
        done: 'All 5 C windows, no stopping',
      },
      {
        name: 'Any chord in 3 steps',
        how: 'Name a random chord (G, D, A, F, B♭, Em…). Find the root on the low E or A string, pick a shape, play its arpeggio, then its pentatonic.',
        tempo: 'No metronome: race the clock',
        time: '3 min',
        done: 'Under 10 seconds per chord',
      },
      {
        name: 'Follow C–Am–F–G',
        how: 'Loop the progression. Stay in frets 7–10. Round 1 roots only, round 2 3rds only, round 3 free pentatonic landing on chord tones.',
        tempo: '70 bpm, one bar per chord',
        time: '3 min',
        done: 'You hear the changes in your line',
      },
    ],
    notes: `Three drills, about ten minutes in total. Do them after your usual warm-up.

1. Chord → arpeggio → scale. This builds the three-layer picture into your hands. Start in the E-shape window at fret 8 (the one from this lesson), then the G-shape window at fret 5, then the others. Say "chord, arpeggio, scale" as you change layers. Once all five C windows flow, do the same in G and in A.

2. Any chord in 3 steps. This is the speed test. Have a friend (or a random list) call out chords. Find the root, choose E shape or A shape (root on the low E or the A string), play the arpeggio, then the pentatonic. Major chord → major pentatonic. Minor chord → minor pentatonic. Done when each one takes under 10 seconds.

3. Follow C–Am–F–G. Use a backing track or a looper. The 3rds-only round is the most important: E, C, A, B. If you can hear the progression from just those four notes, your ears are connected to the chord tones.

Next step: Level 2 Part 3 (Chord tones everywhere) takes this further with 7th-chord arpeggios in five positions and guide tones.`,
  });

  // 13 · Cheat sheet (light, printable)
  {
    const s = D.slideOf(pres, {
      kicker: `${K} · cheat sheet`, title: 'Cheat sheet: chord → arpeggio → pentatonic', light: true,
      notes: `A printable summary of the lesson.

Left column: the three steps and the two recipes.
Right: the five C major windows with the matching A minor box, and the decision guide for which pentatonic to play.

Keep it next to your practice space. Transpose by moving everything: up 2 frets for D, down 3 for A, down 1 for B, up 1 for C♯ and so on.`,
    });
    const colW = 5.6;
    D.card(s, {
      x: M, y: CONTENT_TOP + 0.05, w: colW, h: 2.45, title: '3 steps from any chord', fontSize: 14,
      bullets: [
        '**Find the chord**: root on the low E or A string, pick a CAGED shape.',
        '**Arpeggio**: every chord tone in that 4-fret window.',
        '**Pentatonic**: the arpeggio + 2 notes (below).',
      ],
    });
    D.card(s, {
      x: M, y: 4.2, w: colW, h: 2.6, title: 'The two recipes', fontSize: 14,
      bullets: [
        '**Major**: {root:R} {third:3} {fifth:5} + 2 + 6 = major pentatonic',
        '**Minor**: {root:R} {third:♭3} {fifth:5} + 4 + ♭7 = minor pentatonic',
        '**Major root, 3 frets down** = relative minor root: reuse your minor boxes.',
      ],
    });
    const x2 = M + colW + 0.45;
    const w2 = FULL_W - colW - 0.45;
    D.table(s, [
      ['C major shape', 'Frets', 'Pentatonic shape'],
      ...WINDOWS.map((w) => [`${w.shape} shape`, `${w.from}–${w.to}`, `A minor box ${w.box}`]),
    ], { x: x2, y: CONTENT_TOP + 0.05, w: w2, colW: [2.1, 1.4, w2 - 3.5], fontSize: 14, boldFirstCol: true, align: ['left', 'center', 'center'] });
    D.table(s, [
      ['Chord', 'Pentatonic'],
      ['C, Cmaj7 (happy)', 'C major'],
      ['C7 (blues)', 'C minor + C major'],
      ['Cm, Cm7', 'C minor'],
    ], { x: x2, y: 4.55, w: w2, colW: [3.0, w2 - 3.0], fontSize: 14, boldFirstCol: true });
  }
}

module.exports = { build };
