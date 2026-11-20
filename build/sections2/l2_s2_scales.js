// Level 2 · Part 2 · The major scale everywhere, and the modes (slides 16–28)
const T = require('../lib/theory');
const D = require('../lib/draw');
const { HEX, M, CONTENT_TOP, section } = require('../lib/deck');

const K = '2 · The major scale everywhere';
const MINOR = T.SCALES.minor;
const FULL_W = 12.13;
let PRES = null; // set in build(); needed for shape constants

// The 5 positions of A natural minor / C major: each pentatonic box window, plus the 2 (B) and ♭6 (F) that fall inside it.
const POSITIONS = [
  { n: 1, from: 4, to: 8, box: 1 },
  { n: 2, from: 7, to: 10, box: 2 },
  { n: 3, from: 9, to: 13, box: 3 },
  { n: 4, from: 12, to: 15, box: 4 },
  { n: 5, from: 14, to: 17, box: 5, low: [2, 5] },
];
const ADDED = (sm) => sm === 2 || sm === 8; // B (2) and F (♭6): the notes the pentatonic leaves out

function positionNotes(from, to) {
  return T.positions(T.pcsOf('A', MINOR), { from, to });
}
function positionDots(from, to) {
  return D.dotsFor(positionNotes(from, to), {
    root: 'A', label: 'interval',
    ring: (p, sm) => ADDED(sm),
    roleOf: (sm) => (ADDED(sm) ? 'other' : T.role(sm)),
  });
}
// Check that a position contains its whole pentatonic box (build fails otherwise).
function assertContainsBox(pos) {
  const have = new Set(positionNotes(pos.from, pos.to).map((p) => `${p.s}:${p.f}`));
  for (const p of T.pentBox('A', pos.box)) {
    const f = p.f > 17 ? p.f - 12 : p.f;
    if (!have.has(`${p.s}:${f}`)) throw new Error(`Position ${pos.n} (${pos.from}–${pos.to}) misses box ${pos.box} note ${p.s}:${f}`);
  }
}
// "B: low E 7, G 4, high e 7 · F: A 8, B 6"
function addedText(from, to) {
  const notes = positionNotes(from, to);
  const name = { 1: 'high e', 2: 'B', 3: 'G', 4: 'D', 5: 'A', 6: 'low E' };
  const part = (sm, label) => {
    const list = notes.filter((p) => T.semis('A', T.pcAt(p.s, p.f)) === sm).sort((a, b) => b.s - a.s).map((p) => `${name[p.s]} ${p.f}`);
    return `**${label}:** ${list.join(', ')}`;
  };
  return `${part(2, 'B (2)')}   ·   ${part(8, 'F (♭6)')}`;
}

// 3-notes-per-string patterns: one starting on each scale note on the low E.
const NPS = [
  { n: 1, start: 5, note: 'A', mode: 'A Aeolian (natural minor)' },
  { n: 2, start: 7, note: 'B', mode: 'B Locrian' },
  { n: 3, start: 8, note: 'C', mode: 'C Ionian (major)' },
  { n: 4, start: 10, note: 'D', mode: 'D Dorian' },
  { n: 5, start: 12, note: 'E', mode: 'E Phrygian' },
  { n: 6, start: 1, note: 'F', mode: 'F Lydian (also at fret 13)' },
  { n: 7, start: 3, note: 'G', mode: 'G Mixolydian (also at fret 15)' },
];
const npsNotes = (start) => T.npsPattern('A', MINOR, start, 3);
const npsSpan = (start) => { const fr = npsNotes(start).map((p) => p.f); return [Math.min(...fr), Math.max(...fr)]; };
function npsDots(start) {
  return D.dotsFor(npsNotes(start), { root: 'A', label: 'interval' });
}

function head(s, str, x, y, w, size = 15) {
  s.addText(D.runs(str, { color: HEX.pearl, fontSize: size, bold: true }), { x, y, w, h: 0.32, margin: 0, valign: 'middle', isTextBox: true });
}
function caption(s, str, x, y, w, h = 0.3, size = 12) {
  s.addText(D.runs(str, { color: HEX.muted, fontSize: size }), { x, y, w, h, margin: 0, valign: 'top', isTextBox: true });
}
// Hollow dot with a label: marks an added (ringed) note outside a fretboard.
function ringBadge(s, { x, y, d, label, color = HEX.pearl, fontSize = 13 }) {
  s.addText(label, { shape: PRES.shapes.OVAL, x, y, w: d, h: d, fill: { color: HEX.bg }, line: { color, width: 2 }, color, bold: true, fontSize, align: 'center', valign: 'middle', margin: 0, fontFace: 'Arial' });
}

function build(pres) {
  PRES = pres;
  section(pres, 'The major scale everywhere');
  POSITIONS.forEach(assertContainsBox);

  // 16 · Divider
  D.divider(pres, {
    num: 2, title: 'The major scale everywhere',
    subtitle: 'Add two notes to every pentatonic box and you have the full scale: seven notes, every mode, the whole neck.',
    outcomes: [
      'Play A minor / C major in 5 positions across the neck',
      'Play all seven 3-notes-per-string patterns',
      'Explain how the 7 modes come from one parent scale',
      'Hear and use each mode’s flavor note over a drone',
    ],
    notes: `Part 2 turns the pentatonic you already own into the full 7-note scale, everywhere on the neck.

The pentatonic is a brilliant starting point because it has no "wrong" notes over most rock and blues. But it leaves out two notes of the key, and those two notes are where a lot of melody, emotion and every mode lives. In A minor the missing notes are B (the 2nd) and F (the ♭6). Add them to each of the five boxes you know and you get the five positions of the A natural minor scale. Those are the same notes as C major, so you're learning both at once.

Then you'll learn a second system: seven 3-notes-per-string patterns. They cover the same notes but are built for speed, legato and long horizontal runs, which is why rock and metal players love them.

Finally, the modes. A mode is just the same seven notes heard from a different home note. Once the full scale is on the neck, every mode is already under your fingers. You only need to hear where home is and which flavor note makes it special.

Pace yourself: one position per week is plenty. Keep using the pentatonic in your playing while the new notes settle in.`,
  });

  // 17 · Why the full scale
  {
    const s = D.slideOf(pres, {
      kicker: K, title: 'Why the full scale: pentatonic + 2',
      notes: `The pentatonic has 5 notes. The full scale has 7. The difference is exactly two notes, and they're the most expressive ones in the key.

Look at the rows. A minor pentatonic is R ♭3 4 5 ♭7: A C D E G. A natural minor adds the 2 (B) and the ♭6 (F), drawn as rings. Those two notes sit a half step away from something: B is a half step below C, and F is a half step above E. Half steps create tension and pull, and that's why the full scale sounds more "melodic" and less "bluesy" than the pentatonic.

Now the third row: C major. It's the same seven notes as A natural minor, starting from C instead of A. That's the relative major/minor relationship from Level 1. So every shape in this part is simultaneously A minor and C major. Which one you're "in" depends on which note sounds like home: the chord the band is playing, or the note the song resolves to.

And because a mode is just the same seven notes with a different home, this one set of shapes also gives you D Dorian, E Phrygian, F Lydian, G Mixolydian and B Locrian. You'll meet those later in this part.

Practical rule: keep landing on pentatonic notes (the filled dots) and use the two added notes as passing tones or spicy stops. B over Am sounds open and sophisticated, and F over Am sounds dark and dramatic. Try sustaining each over an Am chord and listen.`,
    });
    const cols = ['R', '♭2', '2', '♭3', '3', '4', '♭5', '5', '♭6', '6', '♭7', '7'];
    const gx = 3.2; const step = 0.62; const d = 0.48;
    cols.forEach((c, i) => s.addText(c, { x: gx + i * step - 0.1, y: CONTENT_TOP, w: d + 0.2, h: 0.28, fontSize: 12, bold: true, color: HEX.muted, align: 'center', margin: 0, isTextBox: true }));
    const rows = [
      { name: 'A minor pentatonic', sub: '5 notes', key: 'A', ivs: T.SCALES.minPent, ring: () => false },
      { name: 'A natural minor', sub: '7 notes: + B and F', key: 'A', ivs: MINOR, ring: (sm) => ADDED(sm) },
      { name: 'C major', sub: 'same 7 notes, home on C', key: 'C', ivs: T.SCALES.major, ring: () => false, alt: true },
    ];
    rows.forEach((r, ri) => {
      const y = CONTENT_TOP + 0.45 + ri * 0.95;
      s.addText(r.name, { x: M, y: y - 0.02, w: 2.5, h: 0.3, fontSize: 15, bold: true, color: HEX.white, margin: 0, isTextBox: true });
      s.addText(r.sub, { x: M, y: y + 0.28, w: 2.5, h: 0.26, fontSize: 12, color: HEX.muted, margin: 0, isTextBox: true });
      for (const iv of r.ivs) {
        // C major is drawn relative to C, but in the A-minor columns it lines up under A's intervals
        const col = r.alt ? T.semis('A', T.mod12(T.pc('C') + iv)) : iv;
        const p = T.mod12(T.pc(r.key) + iv);
        const x = gx + col * step;
        const name = T.spellIn(r.key, p);
        if (r.ring(iv)) ringBadge(s, { x, y, d, label: T.INTERVAL[iv] });
        else D.badge(s, { x, y, d, label: r.alt ? name : T.INTERVAL[iv], role: r.alt ? (iv === 0 ? 'root' : 'note') : T.role(iv) });
        if (!r.alt) s.addText(name, { x: x - 0.1, y: y + d + 0.02, w: d + 0.2, h: 0.24, fontSize: 11, color: HEX.muted, align: 'center', margin: 0, isTextBox: true });
      }
    });
    caption(s, 'Columns are intervals from A. The C major row uses the same 7 notes, so its dots land in the same columns.', gx, CONTENT_TOP + 2.95, 9.4, 0.3);
    const cy = 4.95; const cw = (FULL_W - 0.6) / 3;
    D.card(s, { x: M, y: cy, w: cw, h: 1.85, title: 'Two notes, big effect', body: 'B and F each sit a **half step** from a pentatonic note. Half steps create pull: more melody, more drama.', fontSize: 14 });
    D.card(s, { x: M + cw + 0.3, y: cy, w: cw, h: 1.85, title: 'One set of shapes', body: 'A natural minor = **C major**. Every position in this part is both. The home note decides which one you hear.', fontSize: 14 });
    D.card(s, { x: M + 2 * (cw + 0.3), y: cy, w: cw, h: 1.85, title: 'Every mode is in here', body: 'D Dorian, E Phrygian, F Lydian, G Mixolydian, B Locrian: the **same 7 notes**, different homes.', fontSize: 14 });
  }

  // 18 · Five positions overview
  {
    const s = D.slideOf(pres, {
      kicker: K, title: 'Five positions of A minor / C major',
      notes: `This is the whole A natural minor scale from the nut to fret 17. Filled dots are the pentatonic notes you already know. Rings are the two added notes, B (2) and F (♭6).

The brackets show the five positions. Each one is simply a pentatonic box with the added notes that fall inside the same hand position:
• Position 1: frets 4–8 (box 1 + B and F).
• Position 2: frets 7–10 (box 2).
• Position 3: frets 9–13 (box 3).
• Position 4: frets 12–15 (box 4).
• Position 5: frets 14–17 (box 5). It's also at frets 2–5, twelve frets lower.

Notice that the positions overlap, just like the boxes did. The top notes of one position are the bottom notes of the next, so you can slide between them on any string.

How to learn them: don't try to memorize five new shapes from scratch. Play the pentatonic box you know, then find the two added notes on each string. Say "B" and "F" out loud when you hit them. After a week you'll see each position as "my box plus two".

Everything moves. Slide the whole map down 5 frets (or up 7) and it's E natural minor / G major, with the same shapes and the same order. The positions are always numbered from the one with the root on the low E string under your first finger.

Learn the root locations first (red dots), then the chord tones (♭3, 5), then the passing notes. It's the same order as in Level 1.`,
    });
    const pos = positionNotes(0, 17);
    D.fretboard(s, {
      x: M, y: 2.45, w: FULL_W, h: 3.1, from: 0, to: 17, root: 'A',
      dots: D.dotsFor(pos, { root: 'A', label: 'interval', ring: (p, sm) => ADDED(sm), roleOf: (sm) => (ADDED(sm) ? 'other' : T.role(sm)) }),
      regions: [
        { from: 2, to: 5, label: 'Position 5', row: 0 },
        { from: 7, to: 10, label: 'Position 2', row: 0 },
        { from: 12, to: 15, label: 'Position 4', row: 0 },
        { from: 4, to: 8, label: 'Position 1', row: 1 },
        { from: 9, to: 13, label: 'Position 3', row: 1 },
        { from: 14, to: 17, label: 'Position 5', row: 1 },
      ],
    });
    const lx = D.legend(s, { x: M, y: 6.25, roles: ['root', 'third', 'fifth', 'seventh', 'other'], names: { root: 'R = A', third: '♭3 = C', fifth: '5 = E', seventh: '♭7 = G', other: '4 = D' } });
    ringBadge(s, { x: lx, y: 6.25, d: 0.24, label: '', fontSize: 9 });
    s.addText('ring = added note: 2 (B) or ♭6 (F)', { x: lx + 0.31, y: 6.22, w: 3.6, h: 0.3, fontSize: 12, color: HEX.muted, margin: 0, valign: 'middle', isTextBox: true });
  }

  // 19 · Position 1
  {
    const s = D.slideOf(pres, {
      kicker: K, title: 'Position 1: box 1 + two notes',
      notes: `Position 1 is box 1 with five added notes: three Bs and two Fs.

Where the new notes are:
• B (the 2nd): low E fret 7, G string fret 4, high e fret 7.
• F (the ♭6): A string fret 8, B string fret 6.
The D string doesn't change: G at 5 and A at 7, the same as box 1. (Its B is at fret 9, just outside the position.)

Fingering: one finger per fret, with your index on fret 5, middle on 6, ring on 7 and pinky on 8. The only stretch is the G-string B at fret 4. Reach back with your index for it, then return. Some players instead shift the whole hand back one fret on the G string. Either works, as long as you choose one fingering and stick to it.

The tab plays the position from the lowest A to the highest C, three notes per string where the position has them. Play it slowly with a metronome, saying the note names: "A B C, D E F, G A, B C D, E F G, A B C". That sentence is the whole scale. Then play it backwards.

Musical use: over an Am chord, try ending a phrase on B (high e 7) and let it ring. It sounds open and unresolved. Then try leaning on F (B string 6) and resolving down to E (B string 5). That half step F→E is the dark, dramatic sound of natural minor that metal and classical-flavored rock use constantly.

Common mistake: speeding up and losing the new notes. Accuracy first. Use the Level 1 metronome ladder: 3 clean passes, then add 4 bpm.`,
    });
    const P = POSITIONS[0];
    head(s, 'Position 1 · frets 4–8', M, CONTENT_TOP, 7.3);
    D.fretboard(s, { x: M, y: CONTENT_TOP + 0.45, w: 7.3, h: 2.85, from: 3, to: 9, root: 'A', dots: positionDots(P.from, P.to) });
    const cx = 8.3; const cw = 12.73 - cx;
    D.card(s, { x: cx, y: CONTENT_TOP, w: cw, h: 1.75, title: 'New notes vs. box 1', body: ['**B** (2): low E 7, G 4, high e 7', '**F** (♭6): A 8, B 6', 'D string: unchanged'], fontSize: 14, paraSpace: 4, bodyColor: HEX.text });
    D.card(s, { x: cx, y: CONTENT_TOP + 1.95, w: cw, h: 1.55, title: 'Fingering', body: 'One finger per fret from fret 5. Reach back with your index for the **G-string B at fret 4**.', fontSize: 14 });
    head(s, 'Up through the position, saying every note name', M, 5.15, 8);
    const asc = positionNotes(P.from, P.to).sort((a, b) => T.midi(a.s, a.f) - T.midi(b.s, b.f)).map((p) => `${p.s}:${p.f}`);
    D.tab(s, { x: M, y: 5.62, w: FULL_W, gap: 0.235, cols: asc, check: { root: 'A', scale: MINOR } });
  }

  // 20 · Positions 2 and 3
  {
    const s = D.slideOf(pres, {
      kicker: K, title: 'Positions 2 and 3',
      notes: `Positions 2 and 3 cover the middle of the neck, from fret 7 to fret 13.

Position 2 (frets 7–10) is box 2 plus the added notes. It's a very comfortable four-fret shape: index on 7, pinky on 10, no stretches. Its added notes are listed under the diagram. Notice the B string only has two notes in this position (G and A), and its F sits outside at fret 6. Many players borrow that F from position 1 when they need it.

Position 3 (frets 9–13) is box 3 plus the added notes. It spans five frets, so expect a small stretch or a one-fret shift. The A string only has G and A here; its B is at fret 14, in position 4.

Why some strings have two notes and some have three: the scale has 7 notes per octave spread over 6 strings, so the notes don't divide evenly. Box shapes always have a couple of strings with only two notes. The 3-notes-per-string patterns later in this part fix that, at the cost of wider stretches.

How to connect them: play position 1 up to the high e string, then slide on the high e from fret 8 (C) to fret 10 (D) and come down position 2. The shared notes (fret 7 and 8 on most strings) are your doorway. Do the same between positions 2 and 3 using frets 9 and 10.

Root check: in position 2 the roots are D string 7 and B string 10. In position 3 they're A string 12 and B string 10. Find them before you play anything else.`,
    });
    const w = (FULL_W - 0.4) / 2;
    [[POSITIONS[1], 6, 11], [POSITIONS[2], 8, 14]].forEach(([P, from, to], i) => {
      const x = M + i * (w + 0.4);
      head(s, `Position ${P.n} · frets ${P.from}–${P.to} (box ${P.box})`, x, CONTENT_TOP, w);
      D.fretboard(s, { x, y: CONTENT_TOP + 0.45, w, h: 2.7, from, to, root: 'A', dots: positionDots(P.from, P.to) });
      s.addText(D.runs(addedText(P.from, P.to), { color: HEX.text, fontSize: 13 }), { x, y: CONTENT_TOP + 3.5, w, h: 0.55, margin: 0, valign: 'top', isTextBox: true });
    });
    D.card(s, { x: M, y: 5.75, w: FULL_W, h: 1.05, title: 'The doorway between positions', body: 'Shared frets (7–8 between positions 1 and 2, 9–10 between 2 and 3) let you **slide** from one position to the next on any string.', fontSize: 14, titleSize: 15 });
  }

  // 21 · Positions 4 and 5
  {
    const s = D.slideOf(pres, {
      kicker: K, title: 'Positions 4 and 5',
      notes: `Positions 4 and 5 finish the neck.

Position 4 (frets 12–15) is box 4 plus the added notes: a tidy four-fret shape starting on the octave A at fret 12. Many players find this the easiest position after position 1, because the 12th fret is such a clear landmark. Its roots are the A string 12 and G string 14.

Position 5 lives in two places: frets 14–17 and, twelve frets lower, frets 2–5. The diagram shows the lower one because it's easier to see and play, and it mixes nicely with open strings. Its roots are low E 5, G string 2 and high e 5. Notice that the low E and high e strings only hold G and A here. F and B on those strings sit just outside the position.

After position 5 the pattern repeats: position 1 at fret 17 is position 1 at fret 5, an octave up. So the full cycle is 1 → 2 → 3 → 4 → 5 → 1, and it never changes, in any key.

Exercise: play an A minor phrase in position 1, then repeat the same phrase (same pitches where possible) in position 5 at frets 2–5, then in position 4 at frets 12–15. Hearing the same notes come out of different shapes is what finally breaks "box thinking".

Moving keys: every position moves as a block. For E minor, take everything down 5 frets. Position 1 then starts at the open strings and fret 0–3, and position 5 sits at frets 9–12.`,
    });
    const bw = 7.4;
    head(s, 'Position 4 · frets 12–15 (box 4)', M, CONTENT_TOP, bw);
    D.fretboard(s, { x: M, y: CONTENT_TOP + 0.42, w: bw, h: 1.85, from: 11, to: 16, root: 'A', dots: positionDots(12, 15) });
    head(s, 'Position 5 · frets 2–5 (also at 14–17)', M, 4.3, bw);
    D.fretboard(s, { x: M, y: 4.72, w: bw, h: 1.85, from: 1, to: 6, root: 'A', dots: positionDots(2, 5) });
    const cx = 8.4; const cw = 12.73 - cx;
    D.card(s, {
      x: cx, y: CONTENT_TOP, w: cw, h: 5.25, title: 'Connecting all five',
      bullets: [
        'Each position **overlaps** the next by one or two frets',
        'Position 5 at 2–5 is position 5 at 14–17, **12 frets lower**',
        'After position 5 comes **position 1 again** at fret 17',
        'Find the **roots** before you play anything',
        'For E minor, move the **whole map** down 5 frets',
      ],
      fontSize: 15, paraSpace: 10,
    });
  }

  // 22 · Seven 3-notes-per-string patterns
  {
    const s = D.slideOf(pres, {
      kicker: K, title: 'Seven 3-notes-per-string patterns',
      notes: `The box positions put two or three notes on each string. The 3-notes-per-string system (3nps) puts exactly three on every string. That makes the picking and the fingering completely regular, which is why rock and metal players use it for speed, legato and long runs.

There are seven patterns, one starting on each note of the scale on the low E string:
• Pattern 1 starts on A (fret 5).
• Pattern 2 on B (7).
• Pattern 3 on C (8).
• Pattern 4 on D (10).
• Pattern 5 on E (12).
• Pattern 6 on F (fret 1, or 13).
• Pattern 7 on G (fret 3, or 15).

The labeled dots on the low E string are those starting notes. The faint rings are the rest of the scale.

Each pattern also starts on a mode of C major. Pattern 3 starts on C, so on its own it's the C Ionian (major) fingering. Pattern 4 starts on D, so it's the "D Dorian" fingering, and so on. You don't need modes to use the patterns; this is just a handy way to name them.

Because every string has three notes, the stretches are wider than in the box positions, often a five- or six-fret span. Use your pinky, keep your thumb low behind the neck, and shift slightly on the higher strings if you need to.

Strict alternate picking with three notes per string means your pick direction flips on every new string: down-up-down, then up-down-up. That's a great workout for your picking hand. Legato players instead pick once per string and hammer the other two notes.`,
    });
    const all = positionNotes(0, 17);
    const starts = NPS.map((p) => ({ s: 6, f: p.start }));
    const startKeys = new Set(starts.map((p) => `${p.s}:${p.f}`));
    const dots = [
      ...all.filter((p) => !startKeys.has(`${p.s}:${p.f}`)).map((p) => ({ s: p.s, f: p.f, role: 'ghost', small: true })),
      ...D.dotsFor(starts, { root: 'A', label: 'note' }),
    ];
    D.fretboard(s, { x: M, y: CONTENT_TOP + 0.05, w: FULL_W, h: 2.15, from: 0, to: 17, root: 'A', dots });
    const rows = [['Pattern', 'Starts on (low E)', 'Frets', 'Starts on this mode of C major']];
    NPS.forEach((p) => { const [a, b] = npsSpan(p.start); rows.push([String(p.n), `${p.note} · fret ${p.start}`, `${a}–${b}`, p.mode]); });
    D.table(s, rows, { x: M, y: 4.15, w: FULL_W, colW: [1.3, 2.6, 1.6, 6.63], fontSize: 13, rowH: 0.29, align: ['center', 'left', 'center', 'left'] });
  }

  // 23 & 24 · 3nps detail
  const npsCell = (s, p, x, y, w) => {
    const [a, b] = npsSpan(p.start);
    head(s, `Pattern ${p.n} · starts on ${p.note} · frets ${a}–${b}`, x, y, w, 14);
    D.fretboard(s, { x, y: y + 0.4, w, h: 1.85, from: Math.max(0, a - 1), to: b + 1, root: 'A', dots: npsDots(p.start) });
  };
  {
    const s = D.slideOf(pres, {
      kicker: K, title: '3-notes-per-string patterns 1–4',
      notes: `Patterns 1 to 4, in order up the neck. All four are A natural minor (= C major). The colors are relative to A, so the red dots are always your A roots.

Pattern 1 (frets 5–10) starts on the root, A, at the 5th fret. It's the one to learn first: it lines up with pentatonic box 1, so you already know half of it. Its widest stretch is on the B and high e strings, where the pattern moves up a fret or two because of the G–B tuning shift.

Pattern 2 (frets 7–12) starts on B. Pattern 3 (frets 8–13) starts on C. Pattern 4 (frets 10–15) starts on D.

Look at how each pattern relates to the next: the middle note of each string in one pattern becomes the first note of the same string in the next pattern. So consecutive patterns share two of their three notes on every string. That makes moving between them smooth: you can shift up one note at a time on any string.

How to practice each pattern:
1. Play it slowly, ascending and descending, alternate picking, naming the notes.
2. Play it in groups of three notes (one string at a time), accenting the first note of each string.
3. Play it as a sequence: groups of 4 ascending (1-2-3-4, 2-3-4-5, …).
4. Improvise a short phrase using only that pattern, landing on a red root.

Common mistake: letting the pinky collapse on the wide stretches. Keep the fingertips arched and the thumb low. If a stretch hurts, shift the hand instead. Never force it.`,
    });
    const w = (FULL_W - 0.4) / 2;
    NPS.slice(0, 4).forEach((p, i) => npsCell(s, p, M + (i % 2) * (w + 0.4), CONTENT_TOP + 0.05 + Math.floor(i / 2) * 2.65, w));
  }
  {
    const s = D.slideOf(pres, {
      kicker: K, title: '3-notes-per-string patterns 5–7',
      notes: `Patterns 5 to 7 complete the set.

Pattern 5 (frets 12–17) starts on E, the 5th of A minor, at the 12th fret.

Pattern 6 starts on F. In the open part of the neck that's fret 1 (frets 1–7), and it's also at fret 13. The diagram shows the low version.

Pattern 7 starts on G at fret 3 (frets 3–8), or at fret 15.

After pattern 7 comes pattern 1 again, so the seven patterns tile the whole neck: 1 at fret 5, 2 at 7, 3 at 8, 4 at 10, 5 at 12, 6 at 13 (or 1), 7 at 15 (or 3), then 1 again at 17.

How 3nps patterns relate to the box positions: they hold the same notes, grouped differently. Pattern 1 covers roughly the same notes as position 1, but it extends further up on the top strings. Use the box positions when you want chord tones and blues phrasing close at hand. Use 3nps patterns for speed, sequences and legato runs that travel across the neck.

A great exercise for connecting patterns is the "diagonal scale": play pattern 1's three notes on the low E, then slide up into the next pattern on each new string so you never skip a scale note. You climb the neck as you cross the strings, covering two or more octaves in one sweep. It's the classic rock and metal run.

Keep the picking strict and the tempo honest. Speed built on clean alternate picking lasts. Speed built on sloppy picking doesn't.`,
    });
    const w = (FULL_W - 0.4) / 2;
    NPS.slice(4).forEach((p, i) => npsCell(s, p, M + (i % 2) * (w + 0.4), CONTENT_TOP + 0.05 + Math.floor(i / 2) * 2.65, w));
    D.card(s, {
      x: M + w + 0.4, y: CONTENT_TOP + 0.05 + 2.65, w, h: 2.6, title: 'How to use them',
      bullets: ['**Speed:** strict alternate picking, three notes per string', '**Legato:** pick once per string, hammer the other two', '**Travel:** climb pattern to pattern on each new string', 'Same notes as the positions, grouped for **runs**'],
      fontSize: 14, paraSpace: 6,
    });
  }

  // 25 · One parent scale, seven modes
  {
    const s = D.slideOf(pres, {
      kicker: K, title: 'One parent scale, seven modes',
      notes: `Here is the big idea behind modes: they aren't new scales to memorize. They're the same seven notes heard from seven different home notes.

Take C major: C D E F G A B. Start on C and you get C Ionian, which is just the major scale. Start the same notes on D and you get D Dorian. Start on E: E Phrygian. On F: F Lydian. On G: G Mixolydian. On A: A Aeolian, the natural minor you've been playing all part. On B: B Locrian.

Each row in the diagram is one mode. The dots are colored relative to that row's own home note: red root, amber 3rd, blue 5th, purple 7th. Teal marks a ♯4 or ♭5, the tritone. Watch how the colors move as the home note changes, even though the note names never do. That's the whole secret: the home note decides which notes are the 3rd, the 5th and the 7th, and that decides the mood.

The quality column tells you whether the mode's 3rd is major or minor. Three modes are major (Ionian, Lydian, Mixolydian), three are minor (Dorian, Phrygian, Aeolian), and one is diminished (Locrian, because its 5th is flat).

What this means on the guitar: every position and 3nps pattern you just learned already contains all seven modes. To play D Dorian, play the C-major shapes over a D minor groove and make D sound like home. You don't need new fingerings at all.

On the next slide we flip the view: all seven modes from the same root, A, which is how you actually choose a mode over a chord.`,
    });
    const notes = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
    const names = ['Ionian', 'Dorian', 'Phrygian', 'Lydian', 'Mixolydian', 'Aeolian', 'Locrian'];
    const gx = 2.95; const step = 0.66; const d = 0.48; const rowH = 0.66;
    [1, 2, 3, 4, 5, 6, 7].forEach((n, i) => s.addText(String(n), { x: gx + i * step - 0.1, y: CONTENT_TOP, w: d + 0.2, h: 0.26, fontSize: 11, bold: true, color: HEX.muted, align: 'center', margin: 0, isTextBox: true }));
    s.addText('Quality', { x: gx + 7 * step + 0.05, y: CONTENT_TOP, w: 1.2, h: 0.26, fontSize: 11, bold: true, color: HEX.muted, margin: 0, isTextBox: true });
    notes.forEach((root, r) => {
      const y = CONTENT_TOP + 0.35 + r * rowH;
      s.addText(D.runs(`**${root} ${names[r]}**`, { color: HEX.white, fontSize: 15 }), { x: M, y, w: 2.3, h: d, margin: 0, valign: 'middle', isTextBox: true });
      const rot = [...notes.slice(r), ...notes.slice(0, r)];
      rot.forEach((n, i) => D.badge(s, { x: gx + i * step, y, d, label: n, role: T.role(T.semis(root, T.pc(n))) }));
      const third = T.semis(root, T.pc(rot[2])); const fifth = T.semis(root, T.pc(rot[4]));
      const q = fifth === 6 ? 'diminished' : third === 4 ? 'major' : 'minor';
      s.addText(q, { x: gx + 7 * step + 0.05, y, w: 1.3, h: d, fontSize: 13, color: q === 'major' ? HEX.third : q === 'minor' ? HEX.text : HEX.blue, margin: 0, valign: 'middle', isTextBox: true });
    });
    D.card(s, {
      x: 9.75, y: CONTENT_TOP, w: 12.73 - 9.75, h: 4.95, title: 'Same notes, new home',
      body: ['All seven rows use **C D E F G A B**.', 'The home note decides which notes are the **3rd, 5th and 7th**, and that decides the mood.', 'Every shape in this part already holds all seven modes.'],
      fontSize: 14, paraSpace: 10,
    });
    caption(s, 'Colors are relative to each row’s own root. Teal = ♯4 or ♭5.', M, 6.55, 9, 0.3);
  }

  // 26 · All 7 modes from A
  {
    const s = D.slideOf(pres, {
      kicker: K, title: 'All 7 modes from A, bright to dark',
      notes: `Now the useful view: all seven modes built on the same root, A. This is how you choose a mode in real life. The band is playing something over an A, and you pick the mode whose notes fit the chord and the mood.

The rows are ordered from brightest to darkest. Each mode differs from its neighbor by exactly one note:
• Lydian → Ionian: ♯4 becomes 4.
• Ionian → Mixolydian: 7 becomes ♭7.
• Mixolydian → Dorian: 3 becomes ♭3. That's the jump from major to minor.
• Dorian → Aeolian: 6 becomes ♭6.
• Aeolian → Phrygian: 2 becomes ♭2.
• Phrygian → Locrian: 5 becomes ♭5.

The teal dot in each row is the flavor note, the note that gives the mode its character compared with plain major or minor:
• Lydian's ♯4 (D♯ in A) sounds dreamy and floating.
• Mixolydian's ♭7 (G) gives major a bluesy, rock edge.
• Dorian's natural 6 (F♯) makes minor sound hopeful and funky.
• Phrygian's ♭2 (B♭) is dark, Spanish-sounding, and pure metal.
• Locrian's ♭5 (E♭) removes the stable 5th, so it rarely works as a home key.
• Ionian and Aeolian are the references. Their flavor notes (7 and ♭6) are what separates them from their neighbors.

How to choose: match the chord first (major 3rd or minor 3rd? ♭7 or 7?), then pick the flavor you want. Over A7, the ♭7 rules out Ionian, so use Mixolydian. Over Am7, use Dorian or Aeolian. Over an E5–F5 riff, use Phrygian.`,
    });
    const cols = ['R', '♭2', '2', '♭3', '3', '4', '♯4/♭5', '5', '♭6', '6', '♭7', '7'];
    const modes = [
      { name: 'Lydian', ivs: T.SCALES.lydian, flavor: 6, lab: '♯4', use: 'Dreamy major: ♯4 (D♯)' },
      { name: 'Ionian', ivs: T.SCALES.major, flavor: 11, lab: '7', use: 'The major scale: 7 (G♯)' },
      { name: 'Mixolydian', ivs: T.SCALES.mixolydian, flavor: 10, lab: '♭7', use: 'Rock major, A7 vamps: ♭7 (G)' },
      { name: 'Dorian', ivs: T.SCALES.dorian, flavor: 9, lab: '6', use: 'Hopeful minor, Am7 vamps: 6 (F♯)' },
      { name: 'Aeolian', ivs: T.SCALES.minor, flavor: 8, lab: '♭6', use: 'Natural minor, rock and metal: ♭6 (F)' },
      { name: 'Phrygian', ivs: T.SCALES.phrygian, flavor: 1, lab: '♭2', use: 'Dark metal, A5–B♭5: ♭2 (B♭)' },
      { name: 'Locrian', ivs: T.SCALES.locrian, flavor: 6, lab: '♭5', use: 'Unstable, over m7♭5: ♭5 (E♭)' },
    ];
    caption(s, 'Brightest at the top, darkest at the bottom. Each row changes **one note** from the row above. Teal = flavor note.', M, CONTENT_TOP, FULL_W, 0.3, 13);
    const gx = 2.55; const step = 0.53; const d = 0.4;
    cols.forEach((c, i) => s.addText(c, { x: gx + i * step - 0.15, y: CONTENT_TOP + 0.4, w: d + 0.3, h: 0.25, fontSize: 10, bold: true, color: HEX.muted, align: 'center', margin: 0, isTextBox: true }));
    modes.forEach((m, r) => {
      const y = CONTENT_TOP + 0.72 + r * 0.645;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y: y - 0.06, w: FULL_W, h: 0.54, rectRadius: 0.08, fill: { color: HEX.card }, line: { color: HEX.card, width: 0 } });
      s.addText(D.runs(`**A ${m.name}**`, { color: HEX.white, fontSize: 14 }), { x: M + 0.15, y: y - 0.06, w: 1.85, h: 0.54, margin: 0, valign: 'middle', isTextBox: true });
      for (let iv = 0; iv < 12; iv++) {
        const x = gx + iv * step;
        if (m.ivs.includes(iv)) {
          const lab = iv === m.flavor ? m.lab : (iv === 6 ? '♭5' : T.INTERVAL[iv]);
          D.badge(s, { x, y, d, label: lab, role: iv === m.flavor ? 'blue' : (iv === 6 ? 'other' : T.role(iv)), fontSize: 11 });
        } else {
          s.addShape(pres.shapes.OVAL, { x: x + d / 2 - 0.04, y: y + d / 2 - 0.04, w: 0.08, h: 0.08, fill: { color: HEX.line }, line: { color: HEX.line, width: 0 } });
        }
      }
      s.addText(D.runs(m.use, { color: HEX.text, fontSize: 13 }), { x: gx + 12 * step + 0.15, y: y - 0.06, w: 12.73 - (gx + 12 * step + 0.15) - 0.1, h: 0.54, margin: 0, valign: 'middle', isTextBox: true });
    });
  }

  // 27 · Modes inside the boxes, by ear
  {
    const s = D.slideOf(pres, {
      kicker: K, title: 'Modes inside the boxes, by ear',
      notes: `You don't need new shapes to play modes. Take the box you know best and change one or two notes.

The three diagrams are all built on pentatonic box 1 at the 5th fret (filled dots in red, amber, blue, purple and gray):
• A Aeolian (natural minor) adds B and F. Its flavor note is the ♭6, F (teal).
• A Dorian adds B and F♯. Its flavor note is the natural 6, F♯ (teal). Every F moves up one fret to F♯; in this window that puts F♯ on the D string (fret 4) and the B string (fret 7).
• A Phrygian adds B♭ and F. Its flavor note is the ♭2, B♭ (teal), on the low E and high e at fret 6 and the D string at fret 8.

Rings mark the other added note, the one that isn't the flavor.

How to hear modes (the drone method):
1. Make a drone: let the open A string ring, use a looper, or play an "A drone" track.
2. Play the mode slowly, one note at a time, over the drone.
3. Stop on the flavor note and hold it for four beats. Listen to the color it adds against the A.
4. Sing it, then improvise for two minutes using that mode only, resolving to A.

The tab is a short Dorian phrase over the open A string. Notice how the F♯ (D string 4, B string 7) makes the minor sound brighter than plain Aeolian would. Play the same phrase with F instead (D string 3, B string 6) and hear it turn sad.

Over a real backing track, the chord decides. Dorian fits Am7 or Am–D vamps. Aeolian fits Am–F–G. Phrygian fits A5–B♭5 riffs (the E5–F5 riff is E Phrygian).`,
    });
    const w = (FULL_W - 0.6) / 3;
    const pent = new Set(T.pentBox('A', 1).map((p) => `${p.s}:${p.f}`));
    const modes = [
      { name: 'A Aeolian', sub: 'box 1 + B, {blue:F}', ivs: MINOR, flavor: 8 },
      { name: 'A Dorian', sub: 'box 1 + B, {blue:F♯}', ivs: T.SCALES.dorian, flavor: 9 },
      { name: 'A Phrygian', sub: 'box 1 + {blue:B♭}, F', ivs: T.SCALES.phrygian, flavor: 1 },
    ];
    modes.forEach((m, i) => {
      const x = M + i * (w + 0.3);
      s.addText(D.runs(`**${m.name}** · ${m.sub}`, { color: HEX.pearl, fontSize: 14 }), { x, y: CONTENT_TOP, w, h: 0.32, margin: 0, valign: 'middle', isTextBox: true });
      const pos = T.positions(T.pcsOf('A', m.ivs), { from: 4, to: 8 });
      D.fretboard(s, {
        x, y: CONTENT_TOP + 0.42, w, h: 2.05, from: 3, to: 9, root: 'A',
        dots: D.dotsFor(pos, {
          root: 'A', label: 'interval',
          roleOf: (sm, p) => (pent.has(`${p.s}:${p.f}`) ? T.role(sm) : sm === m.flavor ? 'blue' : 'other'),
          ring: (p, sm) => !pent.has(`${p.s}:${p.f}`) && sm !== m.flavor,
        }),
      });
    });
    D.card(s, {
      x: M, y: 4.55, w: 5.6, h: 2.25, title: 'The drone method',
      bullets: ['Let the **open A** ring (or loop it)', 'Play the mode slowly, one note at a time', '**Hold the flavor note** for 4 beats', 'Sing it, then improvise 2 minutes'],
      fontSize: 14, paraSpace: 4,
    });
    head(s, 'Dorian phrase over the open A string', 6.5, 4.55, 6.2);
    D.tab(s, { x: 6.5, y: 5.05, w: 6.23, gap: 0.25, cols: ['5:0 3:4', '3:5', '2:7', '2:5', '', '5:0 4:4', '3:4', '4:4~'], check: { root: 'A', scale: T.SCALES.dorian } });
  }

  // 28 · Practice this
  D.practice(pres, {
    kicker: K,
    intro: 'Rotate these through the week. Name every new note (B and F) out loud as you play it.',
    drills: [
      { name: 'Position walk', how: 'Play positions 1 → 5 up and back in A minor, sliding through the shared frets. Then move the whole map to **E minor** (down 5 frets).', tempo: '60 bpm, 8th notes', time: '5 min', done: 'All 5 positions with no stops' },
      { name: '3nps ladder', how: 'Pattern 1 up and down with **strict alternate picking**. Then patterns 2–7 in order up the neck, one per bar.', tempo: 'Ladder from 60, +4 bpm', time: '5 min', done: 'All 7 patterns clean at 90 bpm 8ths' },
      { name: 'Mode of the day', how: 'Drone an open A. Pick one mode, play it slowly in position 1, **hold its flavor note**, then improvise for 2 minutes.', tempo: 'Free time', time: '5 min', done: 'You can name the mode by ear' },
      { name: 'Two positions, one phrase', how: 'Over an A minor backing track, solo with positions 1 and 2 only. **Cross between them** in every phrase.', tempo: 'Track, about 80 bpm', time: '5 min', done: 'Phrases cross the seam without a pause' },
    ],
    notes: `Four drills that turn the full scale into something you can actually use.

1. Position walk. Play position 1 ascending, slide up into position 2 on the high e string, descend position 2, slide into position 3 on the low E, and so on through position 5, then back. The goal is a single continuous line with no stops. Say "B" and "F" out loud whenever you play them, because those are the new notes. Once it's smooth in A, move the whole map down 5 frets to E minor. Same shapes, new landmarks.

2. 3nps ladder. Pattern 1 up and down with strict alternate picking, then the other six patterns in order up the neck, one pattern per bar. Use the metronome ladder from Level 1: start at 60 bpm, and after 3 clean passes add 4 bpm. If it gets sloppy, drop back 10. Log your best clean tempo.

3. Mode of the day. Pick one of the seven modes each day. Drone an open A and play the mode slowly in position 1 (change the one or two notes the mode needs). Hold the flavor note for four beats, sing it, then improvise for two minutes. Within a couple of weeks you'll recognize the modes by ear.

4. Two positions, one phrase. Over an A minor backing track, limit yourself to positions 1 and 2, and make every phrase cross between them. This builds the habit of moving horizontally, which is the whole point of learning five positions.

Spend about 20 minutes total and rotate the drills, so you don't have to do all four every day.`,
  });
}

module.exports = { build };
