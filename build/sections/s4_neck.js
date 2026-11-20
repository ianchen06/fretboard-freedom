// Part 4 · Breaking out of box 1 (slides 30–43)
const T = require('../lib/theory');
const D = require('../lib/draw');
const { HEX, M, CONTENT_TOP, section } = require('../lib/deck');

const KICKER = '4 · Breaking out of box 1';
const key = (p) => `${p.s}:${p.f}`;
const PENT = T.SCALES.minPent;
const pentNames = { root: 'Root (A)', third: '♭3 (C)', fifth: '5 (E)', seventh: '♭7 (G)', other: '4 (D)' };

// Small pearl heading above a diagram.
function label(slide, str, x, y, w, size = 15) {
  slide.addText(str, { x, y, w, h: 0.32, fontSize: size, bold: true, color: HEX.pearl, margin: 0, valign: 'middle', isTextBox: true });
}
// Muted caption.
function caption(slide, str, x, y, w, h = 0.5, size = 12) {
  D.text(slide, str, { x, y, w, h, fontSize: size, color: HEX.muted });
}
// Fret range of a set of positions.
const span = (ps) => [Math.min(...ps.map((p) => p.f)), Math.max(...ps.map((p) => p.f))];
// Roots inside a set of positions, as "string N fret F" text.
function rootList(ps, root) {
  const nm = { 6: 'low E', 1: 'high e' };
  return ps.filter((p) => T.pcAt(p.s, p.f) === T.pc(root)).sort((a, b) => b.s - a.s).map((p) => `${nm[p.s] || T.STRING_NAME[p.s]} ${p.f}`).join(' · ');
}
// Dots for an n-position set; positions in `filled` are solid, the rest rings.
function shapeInBox(box, shape, root) {
  const inShape = new Set(shape.map(key));
  const inBox = new Set(box.map(key));
  for (const p of shape) if (!inBox.has(key(p))) throw new Error(`Shape note ${key(p)} not inside its box`);
  return D.dotsFor(box, { root, label: 'interval', ring: (p) => !inShape.has(key(p)) });
}

function build(pres) {
  section(pres, 'Breaking out of box 1');

  // 30 · Divider
  D.divider(pres, {
    num: 4,
    title: 'Breaking out of box 1',
    subtitle: 'Box 1 is one window onto a pattern that covers the whole neck. Learn how the windows connect and every fret becomes yours.',
    outcomes: [
      'Play A minor pentatonic in all 5 boxes and link them',
      'Find any major or minor chord in 5 places with CAGED',
      'See the chord shape hiding inside every box',
      'Move horizontally and diagonally, not just up and down',
      'Play triads and arpeggios anywhere on the neck',
    ],
    notes: `Part 4 is where the neck opens up.

Box 1 isn't wrong. It's just one window. The A minor pentatonic scale has five notes (A, C, D, E, G), and those five notes repeat everywhere on the fretboard. Box 1 shows you twelve of them between frets 5 and 8. There are roughly fifty of them between the nut and the 17th fret.

This part gives you the systems that connect everything:
• CAGED: five chord shapes that tile the neck for any chord.
• The five pentatonic boxes: the scale version of the same idea, each box wrapped around one CAGED chord shape.
• Horizontal playing: moving along a string instead of across it.
• Diagonal runs: phrases that pass through several boxes.
• 3-notes-per-string patterns: the rock and metal speed shapes.
• Triads and arpeggios: chord tones you can grab anywhere, which is what makes solos sound like they follow the chords.

Everything is in A so you can compare shapes directly, and everything is color-coded: red roots, amber 3rds, blue 5ths, purple 7ths, gray other scale notes. Watch the red dots most of all. The roots are your landmarks when switching boxes.

Don't try to learn all of this in a week. A good pace is one new box or shape every few days, always connected to one you already know.`,
  });

  // 31 · Why box 1 traps you
  {
    const s = D.slideOf(pres, {
      kicker: KICKER, title: 'Why box 1 traps you, and the way out',
      notes: `Look at the diagram: the filled dots are box 1, the twelve notes you already know. The rings are the same five notes (A, C, D, E, G) everywhere else between the nut and the 17th fret. Box 1 is a small fraction of the available scale.

Why players get stuck there:
• Every lick lives in one register (about two octaves). Solos sound samey because they literally use the same few pitches.
• The shape becomes muscle memory without knowledge. You know where your fingers go but not which note is the root, so when the key or the chord changes you're lost.
• Climbing higher means leaving the only safe zone, so you don't.

The way out is not memorizing 48 dots. It's three ideas:
1. Connect the boxes. Each box shares notes with its neighbors. Learn box 2 as "box 1 plus a little to the right," not as a separate thing.
2. Track the roots. The red dots are your anchors. If you always know where the nearest root is, you can never be lost.
3. See chords inside the shapes. Every box surrounds a chord shape (CAGED). When you see the chord, you can aim notes at it, which is the difference between running scales and soloing.

The next slides build each of these. Keep box 1 as home base and grow outward from it.`,
    });
    const all = T.positions(T.pcsOf('A', PENT), { from: 0, to: 17 });
    const box1 = new Set(T.pentBox('A', 1).map(key));
    const dots = D.dotsFor(all, { root: 'A', label: 'interval', ring: (p) => !box1.has(key(p)), small: (p) => !box1.has(key(p)) });
    D.fretboard(s, { x: M, y: 2.05, w: 12.13, h: 2.55, from: 0, to: 17, root: 'A', dots, regions: [{ from: 5, to: 8, label: 'Box 1: the 12 notes you know' }] });
    s.addText([
      { text: `${box1.size}`, options: { fontSize: 40, bold: true, color: HEX.root, fontFace: 'Arial Black' } },
      { text: `  of ${all.length}`, options: { fontSize: 22, bold: true, color: HEX.white } },
    ], { x: M, y: 5.05, w: 3.2, h: 0.75, margin: 0, valign: 'middle', isTextBox: true });
    caption(s, 'A minor pentatonic notes between the nut and fret 17 that box 1 covers', M, 5.8, 3.3, 0.8, 13);
    D.card(s, {
      x: 4.15, y: 5.0, w: 4.15, h: 1.85, title: 'The trap',
      bullets: ['Same register, same licks', 'Shapes without note names', 'Lost when the chord changes'], fontSize: 14, paraSpace: 4,
    });
    D.card(s, {
      x: 8.58, y: 5.0, w: 4.15, h: 1.85, title: 'The way out',
      bullets: ['**Connect** neighboring boxes', '**Track** the red roots', '**See** the chord inside each shape'], fontSize: 14, paraSpace: 4,
    });
  }

  // 32 · CAGED major
  {
    const s = D.slideOf(pres, {
      kicker: KICKER, title: 'CAGED: five shapes, one chord',
      notes: `CAGED is named after the five open chords every guitarist learns first: C, A, G, E and D. Each open shape can be moved up the neck (barred, or played as a fragment) to make any chord. The useful surprise is that the five shapes fit together like puzzle pieces, so any chord can be played in five places that cover the whole neck.

The diagram shows A major (A, C♯, E) in all five shapes:
• A shape: the open A chord, frets 0–2.
• G shape: an open G shape moved up 2 frets, frets 2–5.
• E shape: the E-shape barre chord at the 5th fret (the one you know), frets 5–7.
• D shape: the open D shape moved up, frets 7–10.
• C shape: the open C shape moved up, frets 9–12.
Then the A shape starts again at fret 12, an octave higher.

Two rules make it work:
1. The order never changes: C → A → G → E → D → C … Start from whichever shape matches your chord's open position.
2. Neighboring shapes share notes. The right edge of one shape is the left edge of the next.

You don't need to play all five as full barre chords. Many are awkward. What matters is seeing where the root, 3rd and 5th sit in each region, because solos aim at exactly those notes. The table shows where the roots are, your anchor for each shape.

Try it: play the five shapes in order with a metronome, one per bar, and say the shape name out loud.`,
    });
    const shapes = [
      { name: 'A', fing: 'x02220', from: 0, to: 2, row: 0 },
      { name: 'G', fing: '5.4.2.2.2.5', from: 2, to: 5, row: 1 },
      { name: 'E', fing: '577655', from: 5, to: 7, row: 0 },
      { name: 'D', fing: 'x.x.7.9.10.9', from: 7, to: 10, row: 1 },
      { name: 'C', fing: 'x.12.11.9.10.9', from: 9, to: 12, row: 0 },
      { name: 'A', fing: 'x.12.14.14.14.12', from: 12, to: 14, row: 1 },
    ];
    const seen = new Map();
    for (const sh of shapes) for (const p of T.fingering(sh.fing)) seen.set(key(p), p);
    D.fretboard(s, {
      x: M, y: 2.4, w: 12.13, h: 2.4, from: 0, to: 15, root: 'A',
      dots: D.dotsFor([...seen.values()], { root: 'A', label: 'interval' }),
      regions: shapes.map((sh) => ({ from: sh.from, to: sh.to, label: `${sh.name} shape`, row: sh.row })),
    });
    D.table(s, [
      ['A major', 'A shape', 'G shape', 'E shape', 'D shape', 'C shape'],
      ['Frets', '0–2', '2–5', '5–7', '7–10', '9–12'],
      ['Roots on strings', '5, 3', '6, 3, 1', '6, 4, 1', '4, 2', '5, 2'],
    ], { x: M, y: 5.4, w: 12.13, colW: [2.13, 2, 2, 2, 2, 2], fontSize: 14, boldFirstCol: true, align: ['left', 'center', 'center', 'center', 'center', 'center'] });
  }

  // 33 · Minor CAGED
  {
    const s = D.slideOf(pres, {
      kicker: KICKER, title: 'Minor CAGED: the Em, Am and Dm shapes',
      notes: `Minor chords follow the same CAGED logic. The three you'll actually use are moved versions of the open Em, Am and Dm chords. Each puts its root on a different string, so between them you can grab A minor almost anywhere.

• Em shape, root on the 6th string. The minor barre chord at the 5th fret. It sits inside pentatonic box 1, which is why box 1 feels so "minor."
• Am shape, root on the 5th string. The open Am chord moved up 12 frets (or barred at any fret). It sits inside box 4.
• Dm shape, root on the 4th string. A small four-string shape at frets 7–10. Great for higher, brighter minor chords, and it sits inside box 2.

Notice the colors. Each shape contains only red (A, the root), amber (C, the ♭3) and blue (E, the 5th). That's the definition of A minor. The amber ♭3 is the note that makes it minor. Raise any amber dot one fret and you'd have A major.

The other two minor shapes:
• The Gm shape (frets 2–5) and the Cm shape (frets 9–12) are awkward as full chords, so few players strum them. But they're worth knowing as patterns, because they sit inside pentatonic boxes 5 and 3. You'll see all five minor shapes inside the boxes in a few slides.

Exercise: hold a backing drone on A. Play the Em shape at fret 5, the Dm shape at 7, then the Am shape at 12. Strum each once, then pick its notes slowly and say "root, flat 3, 5" as you go.`,
    });
    const shapes = [
      { title: 'Em shape at fret 5', fing: '5.7.7.5.5.5', from: 4, to: 9, cap: 'Root on the **6th** string. The minor barre chord you probably know.' },
      { title: 'Dm shape at fret 7', fing: 'x.x.7.9.10.8', from: 6, to: 11, cap: 'Root on the **4th** string. Four strings, bright and high.' },
      { title: 'Am shape at fret 12', fing: 'x.12.14.14.13.12', from: 11, to: 16, cap: 'Root on the **5th** string. The open Am chord, 12 frets up.' },
    ];
    const w = (12.13 - 2 * 0.36) / 3;
    shapes.forEach((sh, i) => {
      const x = M + i * (w + 0.36);
      label(s, sh.title, x, 1.65, w);
      D.fretboard(s, { x, y: 2.15, w, h: 2.3, from: sh.from, to: sh.to, root: 'A', dots: D.dotsFor(T.fingering(sh.fing), { root: 'A', label: 'interval' }) });
      caption(s, sh.cap, x, 4.85, w, 0.6, 13);
    });
    D.card(s, {
      x: M, y: 5.6, w: 12.13, h: 1.2,
      body: 'Every shape is just {root:R}, {third:♭3} and {fifth:5}. Raise any {third:♭3} by one fret and the chord turns major. The **Gm** shape (frets 2–5) and **Cm** shape (frets 9–12) are clumsy to strum, but you’ll meet them inside pentatonic boxes 5 and 3.',
      fontSize: 15, pad: 0.25,
    });
  }

  // 34 · The 5 boxes
  {
    const s = D.slideOf(pres, {
      kicker: KICKER, title: 'The 5 minor pentatonic boxes in A',
      notes: `This is the whole A minor pentatonic scale from the nut to the 17th fret: every A, C, D, E and G on the neck. The brackets show how guitarists slice it into five "boxes," each a comfortable four- or five-fret hand position with two notes per string.

Key facts:
• Box 1 starts on the root on the low E string (fret 5 in A). It's the one you know.
• Each box starts where the previous one's upper notes are. Box 2 begins on box 1's right-hand notes, and so on. Neighboring boxes overlap; they don't sit side by side.
• After box 5 the pattern repeats: box 1 again at fret 17, 12 frets above fret 5. Box 5 also appears at frets 2–5, below box 1.
• The boxes are the same in every key. Only their position moves. For E minor, slide the whole picture down 5 frets so box 1 starts at fret 0. For G minor, box 1 starts at fret 3.

Watch the red roots. Every box has at least two, and they form patterns you'll start to recognize: the octave shapes from Part 2.

Don't learn the boxes as five unrelated patterns. Learn them as one map of the neck with five handholds. The next two slides zoom into each box and show where it overlaps its neighbors.

Exercise: play A minor pentatonic from the lowest note in box 5 (fret 3 on the low E) to the highest note in box 4, crossing the boxes as you go. Slow and steady.`,
    });
    const pos = T.positions(T.pcsOf('A', PENT), { from: 0, to: 17 });
    D.fretboard(s, {
      x: M, y: 2.5, w: 12.13, h: 3.25, from: 0, to: 17, root: 'A',
      dots: D.dotsFor(pos, { root: 'A', label: 'interval' }),
      regions: [{ from: 2, to: 5, label: 'Box 5', row: 1 }, { from: 5, to: 8, label: 'Box 1', row: 0 }, { from: 7, to: 10, label: 'Box 2', row: 1 }, { from: 9, to: 13, label: 'Box 3', row: 0 }, { from: 12, to: 15, label: 'Box 4', row: 1 }, { from: 14, to: 17, label: 'Box 5', row: 0 }],
    });
    D.legend(s, { x: M, y: 6.35, roles: ['root', 'third', 'fifth', 'seventh', 'other'], names: pentNames, fontSize: 12 });
    caption(s, 'The pattern repeats every 12 frets: box 5 lives at 2–5 **and** 14–17.', 7.9, 6.28, 4.83, 0.45, 13);
  }

  // 35 · Boxes 1 & 2
  {
    const s = D.slideOf(pres, {
      kicker: KICKER, title: 'Boxes 1 and 2 share a seam',
      notes: `Boxes 1 and 2 aren't separate shapes. They overlap. On every string, box 1's higher note is box 2's lower note: fret 8 on both E strings and the B string, fret 7 on the A, D and G strings. That shared column is the seam (shaded on the diagram).

Box 2 in A (frets 7–10):
• Roots: the D string at fret 7 (shared with box 1) and the B string at fret 10.
• It contains the Dm-shape A minor chord: D string 7, G string 9, B string 10, e string 8.
• It's a favorite blues and rock position. The B string 10 root and the G string 9 (the 5th) are perfect bend targets: bend G string 7 up a whole step to E, or B string 8 up a whole step to A.

How to cross the seam:
• Slide. Play box 1, then slide your 3rd finger from fret 7 to fret 9 on the G string and you're in box 2.
• Shift on a shared note. Land on fret 8 of the B string with your first finger instead of your pinky, and your hand is in box 2.

The tab is a short phrase that starts in box 1 and finishes on the root in box 2. Play it slowly and notice the moment your hand shifts.

Exercise: play box 1 ascending, then box 2 descending, then repeat, using the seam notes as pivot points. Say each root out loud as you pass it.`,
    });
    const b1 = T.pentBox('A', 1); const b2 = T.pentBox('A', 2);
    const union = new Map(); [...b1, ...b2].forEach((p) => union.set(key(p), p));
    D.fretboard(s, {
      x: M, y: 2.35, w: 12.13, h: 2.05, from: 4, to: 11, root: 'A',
      dots: D.dotsFor([...union.values()], { root: 'A', label: 'interval' }),
      shade: [{ from: 7, to: 8 }],
      regions: [{ from: 5, to: 8, label: 'Box 1', row: 1 }, { from: 7, to: 10, label: 'Box 2', row: 0, color: HEX.third }],
    });
    D.card(s, {
      x: M, y: 4.9, w: 5.6, h: 1.95, title: 'The seam (shaded)', fontSize: 16,
      body: 'Box 1’s top note on each string **is** box 2’s bottom note. Shift on those shared notes.',
      fontSize: 14,
    });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 6.5, y: 4.9, w: 6.23, h: 1.95, rectRadius: 0.1, fill: { color: HEX.card }, line: { color: HEX.card, width: 0 } });
    s.addText('Box 1 → box 2, ending on the root', { x: 6.72, y: 5.02, w: 5.8, h: 0.3, fontSize: 13, bold: true, color: HEX.pearl, margin: 0, isTextBox: true });
    D.tab(s, { x: 6.72, y: 5.5, w: 5.8, gap: 0.235, fontSize: 12, bg: HEX.card, cols: ['3:5', '3:7', '2:5', '2:8', '2:10', '1:8', '1:10', '1:8', '2:10~'], check: { root: 'A', scale: PENT } });
  }

  // 36 · Boxes 3, 4, 5
  {
    const s = D.slideOf(pres, {
      kicker: KICKER, title: 'Boxes 3, 4 and 5 complete the neck',
      notes: `The last three boxes take you to the top of the neck and back around.

Box 3 (frets 9–13): the most awkward box, because it stretches across the G–B shift. Its roots are the A string at fret 12 and the B string at fret 10. It contains the partial Cm-shape A minor chord. Many players skip it, and their solos have a gap in the middle of the neck. Don't skip it.

Box 4 (frets 12–15): box 1's "upstairs neighbor." Its roots are the A string at fret 12 and the G string at fret 14. It wraps around the Am-shape chord (the open Am chord moved up 12 frets). It has a lovely high register for melodic, singing lines.

Box 5 (frets 14–17): roots on the low E at 17, the G string at 14 and the high e at 17. It contains the Gm-shape chord. Box 5 also lives at frets 2–5, and box 4 repeats at frets 0–3 using open strings: the same boxes, 12 frets lower.

After box 5 comes box 1 again at fret 17, 12 frets above fret 5. The cycle never changes: 1 → 2 → 3 → 4 → 5 → 1.

Learning tip: learn each box by its roots first. Find the red dots, play only them, then add the amber ♭3s and blue 5ths (the A minor chord), then fill in the gray 4ths and purple ♭7s. You'll learn the box as chord tones plus passing notes, which is how you'll use it when soloing.

Exercise: for each box, play it ascending and descending, then improvise inside it for 30 seconds over an A minor backing track, starting and ending every phrase on a root.`,
    });
    const boxes = [
      { k: 3, from: 8, to: 13 },
      { k: 4, from: 11, to: 16 },
      { k: 5, from: 13, to: 18 },
    ];
    const w = (12.13 - 2 * 0.36) / 3;
    boxes.forEach((b, i) => {
      const x = M + i * (w + 0.36);
      const ps = T.pentBox('A', b.k);
      const [lo, hi] = span(ps);
      label(s, `Box ${b.k} · frets ${lo}–${hi}`, x, 1.65, w);
      D.fretboard(s, { x, y: 2.15, w, h: 2.45, from: b.from, to: b.to, root: 'A', dots: D.dotsFor(ps, { root: 'A', label: 'interval' }) });
      caption(s, `Roots: **${rootList(ps, 'A')}**`, x, 4.98, w, 0.4, 13);
    });
    D.card(s, {
      x: M, y: 5.55, w: 12.13, h: 1.25,
      body: 'After box 5 the cycle starts again: **box 1 at fret 17** is box 1 at fret 5, an octave higher. Box 5 also sits at **frets 2–5**. Learn each box by its {root:roots} first, then the chord tones ({third:♭3}, {fifth:5}), then the passing notes.',
      fontSize: 15, pad: 0.25,
    });
  }

  // 37 · Pentatonic ↔ CAGED
  {
    const s = D.slideOf(pres, {
      kicker: KICKER, title: 'Every box hides a chord shape',
      notes: `This is the link that turns scale patterns into music. Every pentatonic box is built around one of the five minor CAGED chord shapes. The filled dots in each diagram are the A minor chord shape. The rings are the rest of the box.

• Box 1 ↔ Em shape (root on the 6th string, fret 5)
• Box 2 ↔ Dm shape (root on the 4th string, fret 7)
• Box 3 ↔ Cm shape (root on the 5th string, fret 12)
• Box 4 ↔ Am shape (root on the 5th string, fret 12)
• Box 5 ↔ Gm shape (root on the 6th string, fret 5 / 17)

Why it matters:
1. You never get lost. If you can see the chord, you know where the roots and chord tones are, so you know where to land a phrase.
2. Chord tones sound strong. Ending phrases on filled dots (root, ♭3, 5) sounds intentional. Ending on a ring (the 4th or ♭7) sounds unresolved, which is fine if you mean it.
3. It works for any chord. When the band moves to D minor, find the Dm chord shape in your current area and the surrounding box is D minor pentatonic.

The order of the shapes going up the neck is E–D–C–A–G for these boxes. That's the CAGED sequence (C-A-G-E-D) again, just starting from E.

Exercise: in each box, strum the chord shape once, then improvise using only the filled dots for 4 bars, then add the rings for 4 bars. Hear how the rings add movement and the filled dots add resolution.`,
    });
    const pairs = [
      { k: 1, shape: '5.7.7.5.5.5', name: 'Box 1 ↔ Em shape', from: 4, to: 9 },
      { k: 2, shape: 'x.x.7.9.10.8', name: 'Box 2 ↔ Dm shape', from: 6, to: 11 },
      { k: 3, shape: 'x.12.10.9.10.x', name: 'Box 3 ↔ Cm shape', from: 8, to: 13 },
      { k: 4, shape: 'x.12.14.14.13.12', name: 'Box 4 ↔ Am shape', from: 11, to: 16 },
      { k: 5, shape: '5.3.2.2.5.5', name: 'Box 5 ↔ Gm shape', from: 1, to: 6, shift: -1 },
    ];
    const w = (12.13 - 2 * 0.36) / 3;
    pairs.forEach((p, i) => {
      const x = M + (i % 3) * (w + 0.36);
      const y = i < 3 ? 1.62 : 4.27;
      const box = T.pentBox('A', p.k, { shiftOctave: p.shift || 0 });
      label(s, p.name, x, y, w, 14);
      D.fretboard(s, { x, y: y + 0.4, w, h: 1.75, from: p.from, to: p.to, root: 'A', dots: shapeInBox(box, T.fingering(p.shape), 'A'), fretNumSize: 9 });
    });
    const cx = M + 2 * (w + 0.36);
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: cx, y: 4.27, w, h: 2.55, rectRadius: 0.1, fill: { color: HEX.card }, line: { color: HEX.card, width: 0 } });
    s.addText('How to read these', { x: cx + 0.22, y: 4.42, w: w - 0.44, h: 0.32, fontSize: 15, bold: true, color: HEX.white, margin: 0, isTextBox: true });
    D.badge(s, { x: cx + 0.22, y: 4.92, d: 0.3, label: 'R', role: 'root' });
    D.text(s, '**Filled:** the A minor chord shape', { x: cx + 0.65, y: 4.92, w: w - 0.9, h: 0.32, fontSize: 13, valign: 'middle' });
    s.addText('4', { shape: pres.shapes.OVAL, x: cx + 0.22, y: 5.38, w: 0.3, h: 0.3, fill: { color: HEX.wood }, line: { color: HEX.other, width: 2 }, color: HEX.pearl, bold: true, fontSize: 10, align: 'center', valign: 'middle', margin: 0 });
    D.text(s, '**Ring:** the rest of the box', { x: cx + 0.65, y: 5.38, w: w - 0.9, h: 0.32, fontSize: 13, valign: 'middle' });
    D.text(s, 'Land phrases on filled dots. Use rings to move between them.', { x: cx + 0.22, y: 5.85, w: w - 0.44, h: 0.8, fontSize: 13, color: HEX.muted });
  }

  // 38 · Playing along one string
  {
    const s = D.slideOf(pres, {
      kicker: KICKER, title: 'Playing along one string',
      notes: `Boxes teach you to play across the strings in one spot. To break free, you also need to play along the strings, moving up and down the neck. That's how singers phrase: a melody that climbs and falls, not one that stays in one place.

The diagram shows A minor pentatonic on just the B string (filled) and its neighbor, the G string (rings). Along one string the scale is a series of short jumps: 2 or 3 frets at a time, the gaps between A, C, D, E and G. Learn those gaps and you can play the scale on any string without a box.

Why it helps:
• It forces you to hear the scale as intervals (a 3-fret jump from A to C is a minor 3rd), not as finger patterns.
• Slides become natural. Moving along a string with your third finger gives a vocal, connected sound.
• It connects the boxes. Every move along a string takes you into the next box.

The tabs:
1. One string: a short melody on the B string using slides. Play it with one finger if you like. Listen for the melody, not the pattern.
2. Two strings: a climb up the G and B strings from box 1 to box 5. Each slide is a box change.

Exercise (the classic): over an A minor backing track, improvise on the B string only for a full minute. Then try the G string only. Then two strings. It feels limiting, and that's the point. You'll find melodies you'd never find inside a box.`,
    });
    const pos = T.positions(T.pcsOf('A', PENT), { strings: [2, 3], from: 0, to: 17 });
    D.fretboard(s, {
      x: M, y: 1.75, w: 12.13, h: 2.45, from: 0, to: 17, root: 'A',
      dots: D.dotsFor(pos, { root: 'A', label: 'interval', ring: (p) => p.s === 3 }),
    });
    label(s, 'One string: B-string melody', M, 4.75, 5.8, 14);
    D.tab(s, { x: M, y: 5.3, w: 5.8, gap: 0.25, cols: ['2:5', '2:8', '2:10', '2:8', '2:10/13', '2:15', '2:13', '2:10~'], check: { root: 'A', scale: PENT } });
    label(s, 'Two strings: G + B climb, box 1 → box 5', 6.93, 4.75, 5.8, 14);
    D.tab(s, { x: 6.93, y: 5.3, w: 5.8, gap: 0.25, cols: ['3:5', '2:5', '2:8', '3:7/9', '2:10', '3:12', '2:13', '3:14/17', '2:17~'], check: { root: 'A', scale: PENT } });
  }

  // 39 · Diagonal runs
  {
    const s = D.slideOf(pres, {
      kicker: KICKER, title: 'Diagonal runs: cross boxes in one phrase',
      notes: `A diagonal pattern climbs across the strings and up the neck at the same time. Instead of finishing a box and then shifting, you shift a little on every string. The result covers three octaves and five boxes in one smooth motion. It's how many rock players get those long, sweeping runs.

The pattern on the diagram (A minor pentatonic):
• Low E: 5, 8 · A: 5, 7, 10 · D: 7, 10, 12 · G: 9, 12, 14 · B: 13, 15, 17 · high e: 15, 17
The lines show the path. Notice it's every note of the scale, in order, never skipping a pitch. It just takes the higher option whenever a note appears on two strings.

How to play it:
• Use slides for the shifts. On the A string, play fret 7 with your third finger and slide to 10. You've moved from box 1 to box 2 with no gap in the sound.
• Keep your hand relaxed and let the thumb travel with it.
• Go slowly. The shift is the hard part, not the notes.

The tab is a shorter phrase from the same path. It starts in box 1, slides into box 2 on the A string, climbs through box 3 and finishes on the root at fret 14 of the G string.

Exercise: play the full diagonal up and back down at 60 bpm in eighth notes. Then improvise phrases that use only this path. You'll sound more expansive immediately, because your solos start moving in register as well as in rhythm.`,
    });
    const path = [
      { s: 6, f: 5 }, { s: 6, f: 8 }, { s: 5, f: 5 }, { s: 5, f: 7 }, { s: 5, f: 10 }, { s: 4, f: 7 }, { s: 4, f: 10 }, { s: 4, f: 12 },
      { s: 3, f: 9 }, { s: 3, f: 12 }, { s: 3, f: 14 }, { s: 2, f: 13 }, { s: 2, f: 15 }, { s: 2, f: 17 }, { s: 1, f: 15 }, { s: 1, f: 17 },
    ];
    // Check the path is the scale in strict ascending order with no gaps.
    const pitches = path.map((p) => T.midi(p.s, p.f));
    const expected = T.scalePitchesFrom('A', PENT, pitches[0], path.length);
    if (pitches.join() !== expected.join()) throw new Error('Diagonal path is not a continuous ascending A minor pentatonic run');
    const links = path.slice(1).map((p, i) => ({ a: path[i], b: p, color: HEX.pearl, width: 1.5 }));
    D.fretboard(s, {
      x: M, y: 2.4, w: 12.13, h: 2.2, from: 3, to: 18, root: 'A',
      dots: D.dotsFor(path, { root: 'A', label: 'interval' }), links,
      regions: [{ from: 5, to: 8, label: 'Box 1', row: 0 }, { from: 7, to: 10, label: 'Box 2', row: 1 }, { from: 9, to: 13, label: 'Box 3', row: 0 }, { from: 12, to: 15, label: 'Box 4', row: 1 }, { from: 14, to: 17, label: 'Box 5', row: 0 }],
    });
    label(s, 'Three-box phrase: box 1 → 2 → 3, ending on the root', M, 5.05, 7.6, 14);
    D.tab(s, { x: M, y: 5.5, w: 7.6, gap: 0.22, cols: ['6:5', '6:8', '5:5', '5:7/10', '4:7', '4:10', '4:12', '3:9', '3:12/14~'], check: { root: 'A', scale: PENT } });
    D.card(s, {
      x: 8.6, y: 5.05, w: 4.13, h: 1.8, title: 'The trick',
      body: 'Shift a little on **every** string instead of a lot all at once. Slide on the shift so the sound never breaks.',
      fontSize: 14,
    });
  }

  // 40 · 3 notes per string
  {
    const s = D.slideOf(pres, {
      kicker: KICKER, title: '3 notes per string: rock and metal speed',
      notes: `Pentatonic boxes have two notes per string. The full 7-note scale (here A natural minor: A B C D E F G) is often played with three notes per string. That's the "3nps" system behind fast rock and metal runs.

Why players love it:
• Every string has the same number of notes, so picking patterns repeat: down-up-down, up-down-up, with no awkward string changes.
• Sequences in groups of 3 and 6 fall naturally under the fingers.
• Each pattern spans about five frets and slants slightly up the neck, so it moves you along the fretboard as you climb.

The two diagrams:
• Pattern 1 starts on the root, A at fret 5 on the low E.
• Pattern 2 starts on the 2nd, B at fret 7.
There are seven patterns in total, one starting on each scale note, and they link like the pentatonic boxes do.

Colors still matter: the red A, amber C (♭3), blue E (5th) and purple G (♭7) are the A minor chord tones and the notes to land on. The gray B, D and F are passing notes. F (the ♭6) gives natural minor its dark, metal-friendly sound.

The tab is the classic warm-up: up three strings and back down in strict alternate picking (down-up-down-up…). Start at 60 bpm in sixteenth notes and use a metronome. Add speed only when it's clean.

Exercise: pattern 1 ascending and descending, 3 clean passes, then 4 bpm faster. Log your top clean tempo each week.`,
    });
    const pats = [
      { start: 5, title: 'Pattern 1 · starts on the root (A)', from: 4, to: 11 },
      { start: 7, title: 'Pattern 2 · starts on the 2nd (B)', from: 6, to: 13 },
    ];
    const w = (12.13 - 0.4) / 2;
    pats.forEach((p, i) => {
      const x = M + i * (w + 0.4);
      label(s, p.title, x, 1.65, w);
      D.fretboard(s, { x, y: 2.1, w, h: 2.4, from: p.from, to: p.to, root: 'A', dots: D.dotsFor(T.npsPattern('A', T.SCALES.minor, p.start, 3), { root: 'A', label: 'interval' }) });
    });
    label(s, 'Alternate-picking warm-up (pattern 1)', M, 4.95, 8.1, 14);
    D.tab(s, {
      x: M, y: 5.45, w: 8.1, gap: 0.25, fontSize: 12,
      cols: ['6:5', '6:7', '6:8', '5:5', '5:7', '5:8', '4:5', '4:7', '4:9', '|', '4:9', '4:7', '4:5', '5:8', '5:7', '5:5', '6:8', '6:7', '6:5'],
      check: { root: 'A', scale: T.SCALES.minor },
    });
    D.card(s, {
      x: 9.0, y: 4.95, w: 3.73, h: 1.9, title: 'Picking rule',
      body: 'Strict **down-up** picking. Three notes per string flips the pick direction on every new string.',
      fontSize: 13,
    });
  }

  // 41 · Triads on the top 3 strings
  {
    const s = D.slideOf(pres, {
      kicker: KICKER, title: 'Triads on the top 3 strings',
      notes: `A triad is the three notes of a chord: root, 3rd and 5th. On the top three strings (G, B, high e) each triad can be played in three small shapes called inversions, depending on which chord tone is lowest:
• Root position: root on the bottom (R–3–5)
• 1st inversion: 3rd on the bottom (3–5–R)
• 2nd inversion: 5th on the bottom (5–R–3)
Then the cycle repeats 12 frets higher.

A major (A, C♯, E): 2-2-0 → 6-5-5 → 9-10-9 → 14-14-12.
A minor (A, C, E): 2-1-0 → 5-5-5 → 9-10-8 → 14-13-12.
Compare them. Each minor shape is the major shape with the amber 3rd lowered by one fret. That's the whole difference between major and minor.

Why triads give you freedom:
• They're small, so you can play chords anywhere on the neck, not just in open position. That's essential for rhythm parts in a band, where you shouldn't double the bass player's low notes.
• Every triad shape is a target. When soloing over A major, those three notes are where phrases sound resolved. Triads are the skeleton inside every scale shape you know.
• Classic rock rhythm playing (think short, bright chord stabs high on the neck) is mostly triads on these strings.

Exercise: play the A major inversions up the neck and back, saying "root position, first, second." Then do A minor. Then play A, D and E (I–IV–V) within one 4-fret area, choosing whichever inversion is closest. That's voice leading, and it's how pros comp.`,
    });
    const qualities = [
      { name: 'A major', notes: 'A · C♯ · E', ivs: T.CHORDS.maj, y: 2.05, form: 'R · 3 · 5' },
      { name: 'A minor', notes: 'A · C · E', ivs: T.CHORDS.min, y: 4.7, form: 'R · ♭3 · 5' },
    ];
    const short = { 'Root position': 'Root pos.', '1st inversion': '1st inv.', '2nd inversion': '2nd inv.' };
    for (const q of qualities) {
      const vs = T.closedTriads('A', q.ivs, [3, 2, 1], 15);
      const dots = D.dotsFor(vs.flatMap((v) => v.notes), { root: 'A', label: 'interval' });
      const regions = vs.map((v) => { const [lo, hi] = span(v.notes); return { from: lo, to: hi, label: short[v.inversion] }; });
      s.addText(q.name, { x: M, y: q.y - 0.05, w: 1.7, h: 0.4, fontSize: 18, bold: true, color: HEX.white, margin: 0, isTextBox: true });
      D.text(s, q.notes, { x: M, y: q.y + 0.38, w: 1.7, h: 0.3, fontSize: 14, color: HEX.pearl });
      D.text(s, q.form, { x: M, y: q.y + 0.72, w: 1.7, h: 0.3, fontSize: 13, color: HEX.muted });
      D.fretboard(s, { x: 2.35, y: q.y, w: 10.38, h: 1.85, from: 0, to: 15, root: 'A', dots, regions });
    }
  }

  // 42 · Arpeggios
  {
    const s = D.slideOf(pres, {
      kicker: KICKER, title: 'Arpeggios: chords one note at a time',
      notes: `An arpeggio is a chord played one note at a time. Practicing arpeggios teaches your hands where the chord tones are in a position, so when you solo you can land on them without thinking.

The three diagrams are all around the 5th fret, the same area as pentatonic box 1:
• A minor (R, ♭3, 5 = A, C, E). This is box 1 with the 4ths and ♭7s removed. Compare it to box 1: you've been playing this arpeggio all along without knowing it.
• A major (R, 3, 5 = A, C♯, E). Built around the E-shape A major barre chord. The amber 3rds (C♯) sit one fret higher than in the minor version, or in different spots entirely.
• A7, dominant 7 (R, 3, 5, ♭7 = A, C♯, E, G). The blues chord. Adding the purple ♭7 (G) gives the bluesy, unresolved sound. Over a 12-bar blues in A, the A7 arpeggio is the most important thing you can know.

How to practice:
1. Play each arpeggio ascending and descending, one note per click, at 60 bpm.
2. Say the interval of each note: "root, three, five, root…"
3. Strum the chord first, then play the arpeggio, so your ear connects them.
4. Improvise using only arpeggio notes over a one-chord vamp. It sounds surprisingly musical.

Where this leads: in Part 5 you'll switch arpeggios as the chords change (A7 → D7 → E7 in a blues). That's "playing the changes," and it's what makes a solo sound like it follows the band.`,
    });
    const arps = [
      { title: 'A minor', formula: '{root:R} · {third:♭3} · {fifth:5}  (A C E)', ivs: T.CHORDS.min, from: 4, to: 8 },
      { title: 'A major', formula: '{root:R} · {third:3} · {fifth:5}  (A C♯ E)', ivs: T.CHORDS.maj, from: 4, to: 7 },
      { title: 'A7 (dominant 7)', formula: '{root:R} · {third:3} · {fifth:5} · {seventh:♭7}  (A C♯ E G)', ivs: T.CHORDS.dom7, from: 4, to: 8 },
    ];
    const w = (12.13 - 2 * 0.36) / 3;
    arps.forEach((a, i) => {
      const x = M + i * (w + 0.36);
      label(s, a.title, x, 1.65, w);
      D.fretboard(s, { x, y: 2.1, w, h: 2.4, from: 3, to: 9, root: 'A', dots: D.dotsFor(T.chordTonesIn('A', a.ivs, a.from, a.to), { root: 'A', label: 'interval' }) });
      D.text(s, a.formula, { x, y: 4.9, w, h: 0.35, fontSize: 13, color: HEX.text });
    });
    D.card(s, {
      x: M, y: 5.5, w: 12.13, h: 1.3,
      body: 'Compare A minor with pentatonic box 1: it’s the **same shape minus the 4ths and ♭7s**. Strum the chord, then play its arpeggio slowly while naming each interval, and your ear ties the sound to the shape.',
      fontSize: 15, pad: 0.25,
    });
  }

  // 43 · Practice this
  D.practice(pres, {
    kicker: KICKER,
    intro: 'Rotate through these, two per session, alongside your note-finding warm-up.',
    drills: [
      {
        name: 'Box links',
        how: 'Play box 1 up, slide into box 2 and play it down. Then box 2 up → box 3 down, all the way to box 5 and back. **Say each root** as you pass it.',
        tempo: '60 bpm, 8th notes', time: '5 min', done: 'All 5 boxes linked up and back with no stops',
      },
      {
        name: 'One-string solos',
        how: 'Over an A minor backing track, improvise on the **B string only** for a minute, then the G string, then both. Slide between notes.',
        tempo: 'Track at ~80 bpm', time: '4 min', done: 'Phrases travel 12 frets and still sing',
      },
      {
        name: 'CAGED walk',
        how: 'Play A major in all five shapes in order: A → G → E → D → C → A. Strum each once, then pick R–3–5. Then do A minor.',
        tempo: '60 bpm, 1 shape/bar', time: '4 min', done: 'No pause between shapes, roots named out loud',
      },
      {
        name: 'Triad chain',
        how: 'On the G, B and e strings, play the A, D and E triads (I–IV–V) inside one 4-fret area, picking the nearest inversion each time.',
        tempo: '70 bpm, 1 triad/beat', time: '4 min', done: 'I–IV–V clean in 3 different areas of the neck',
      },
    ],
    notes: `Four drills turn this part into habits. You don't need all four every day. Rotate them, two per session, after your 5-minute note-finding warm-up.

1. Box links. The goal is to stop thinking of five boxes and start seeing one connected scale. Going up one box and down the next forces you through the seams. Say each root out loud: it's your GPS. When you can do this at 60 bpm without stopping, climb toward 80 with the metronome ladder, then in other keys (move everything down 5 frets for E minor).

2. One-string solos. The best cure for box-thinking. Limiting yourself to one string makes you listen to the shape of the melody. Use a backing track (search for "A minor backing track 80 bpm"). Use slides, and leave space. Then add a neighboring string.

3. CAGED walk. Builds the chord map that the boxes hang on. Play each shape as a chord, then as an arpeggio (root, 3rd, 5th). Say the shape name. When it's smooth in A major, do A minor with the minor shapes, then try another key such as C or G.

4. Triad chain. The bridge between rhythm and lead. I–IV–V in A is A, D and E. Stay inside a small area (frets 5–9, say) and find each chord's nearest inversion on the top three strings. Your hand barely moves, and that smooth "voice leading" is what pro rhythm players do.

Track tempos and dates in the practice log. Progress check after two weeks: can you start a solo in any box on command ("box 3, go!") and find the root within a second?`,
  });
}

module.exports = { build };
