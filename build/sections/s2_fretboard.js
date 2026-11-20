// Part 2 · Mapping the fretboard (slides 15–23)
const T = require('../lib/theory');
const D = require('../lib/draw');
const { HEX, M, CONTENT_TOP, section } = require('../lib/deck');

const KICK = '2 · Mapping the fretboard';
const NATURALS = new Set(['C', 'D', 'E', 'F', 'G', 'A', 'B']);

// Natural-note dots on one string within a fret range.
function naturalsOn(s, from, to, opts = {}) {
  const out = [];
  for (let f = from; f <= to; f++) {
    const name = T.SHARP[T.pcAt(s, f)];
    if (NATURALS.has(name)) out.push({ s, f, label: name, role: opts.role || 'note', ring: opts.ring || false });
  }
  return out;
}

function build(pres) {
  section(pres, 'Mapping the fretboard');

  // 15 · Divider
  D.divider(pres, {
    num: 2,
    title: 'Mapping the fretboard',
    subtitle: 'The neck is a grid with a few simple rules. Learn the rules and a handful of landmarks, and you can work out the rest.',
    outcomes: [
      'Name the strings and explain why the neck repeats at fret 12',
      'Name every natural note on the low E and A strings instantly',
      'Use octave shapes to carry any note across all 6 strings',
      'Explain the G–B shift and why shapes bend there',
    ],
    notes: `Part 2 turns the fretboard from a mystery into a map.

Most players who are stuck in box 1 know shapes but not notes. They can play the box, but they can't tell you which note they're on, so they can't move the idea anywhere else. This part fixes that from the ground up.

The good news: you don't have to memorize 78 separate positions (6 strings × 13 frets). The neck follows a few rules:
• Each fret is one half step.
• Each string is tuned a 4th (5 frets) above the one below it, except G to B, which is a major 3rd (4 frets).
• Everything repeats after fret 12.

Add two landmark strings (the low E and A strings, which you'll memorize cold) and a set of octave shapes, and you can find any note anywhere in a couple of seconds.

How to work through this part:
1. Read each slide with the guitar in your hands and play every dot.
2. Say note names out loud as you play them. Seriously, out loud.
3. Do the drills on the "Practice this" slide for a week before you expect them to feel automatic. Most people need two to three weeks of daily 5-minute sessions before the low E and A strings are instant.

Part 3 then turns this map into reflexes with targeted drills.`,
  });

  // 16 · Anatomy
  {
    const s = D.slideOf(pres, {
      kicker: KICK, title: 'Anatomy of the neck',
      notes: `The four facts on this slide are the foundation for everything else in the deck.

1. String names. From the thickest (lowest, closest to your chin) to the thinnest: E A D G B E. The usual memory trick is "Eddie Ate Dynamite, Good Bye Eddie." The thick string is called "low E" or "6th string". The thin string is "high e" or "1st string". In this deck high e is always on top of the diagram, as in tab.

2. One fret = one half step. Moving up one fret raises the pitch by the smallest step in Western music. Two frets = a whole step. This is why the fretboard is so logical: it's a ruler for pitch.

3. Inlay dots. Most guitars have markers at frets 3, 5, 7, 9 and a double marker at 12 (then 15, 17, 19, 21). Use them as street signs. On the low E string, the dots at 3, 5 and 7 are G, A and B, which makes them easy anchors.

4. Fret 12 = the open strings again, one octave higher. Twelve half steps make an octave, so the note at fret 12 has the same name as the open string. Everything above fret 12 is a copy of frets 0–11. Learn frets 0–12 once and you know the whole neck.

On the diagram, the open strings (fret 0, left of the nut) and fret 12 carry identical note names. Play each open string and then its 12th fret and listen: same note, higher.

Common mistake: thinking of the neck as six unrelated strings. It's one grid, and the strings are related by fixed distances (next slides).`,
    });
    const dots = [];
    for (let st = 1; st <= 6; st++) {
      const name = T.STRING_NAME[st].toUpperCase();
      dots.push({ s: st, f: 0, label: name, role: 'note' });
      dots.push({ s: st, f: 12, label: name, role: 'note', ring: true });
    }
    const top = CONTENT_TOP + 0.2;
    D.fretboard(s, { x: M, y: top, w: 12.13, h: 2.6, from: 0, to: 12, dots, title: 'Anatomy', dotSize: 0.38 });
    s.addText('open strings', { x: M + 0.1, y: top + 2.95, w: 1.4, h: 0.26, fontSize: 11, color: HEX.muted, margin: 0, isTextBox: true });
    s.addText('fret 12 = open strings, one octave up', { x: 9.0, y: top + 2.95, w: 3.73, h: 0.26, fontSize: 11, color: HEX.muted, align: 'right', margin: 0, isTextBox: true });
    const cards = [
      ['String names', 'Low to high: **E A D G B E**. _Eddie Ate Dynamite, Good Bye Eddie._', 'root'],
      ['Half steps', '1 fret = 1 half step. Two frets = a whole step. The neck is a ruler for pitch.', 'third'],
      ['Inlay dots', 'Single dots at 3, 5, 7, 9 · double at 12. On low E: 3 = G, 5 = A, 7 = B.', 'fifth'],
      ['Repeats at 12', 'Fret 12 = open string an octave up. Learn 0–12 and you know the neck.', 'seventh'],
    ];
    const cw = (12.13 - 0.3 * 3) / 4; const cy = 5.05; const ch = 1.75;
    cards.forEach(([t, b, r], i) => D.card(s, { x: M + i * (cw + 0.3), y: cy, w: cw, h: ch, title: t, body: b, badge: String(i + 1), badgeRole: r, titleSize: 15, fontSize: 13 }));
  }

  // 17 · Full map
  {
    const s = D.slideOf(pres, {
      kicker: KICK, title: 'The full map: every note, frets 0–12',
      notes: `Here is every note from the open strings to fret 12. Don't try to memorize this grid one cell at a time. That's the slow way. Use it as a reference while the landmark and octave-shape methods on the next slides do the real work.

How to read it:
• Pearl dots are the natural notes: A B C D E F G.
• Dark dots are the sharps and flats. Each has two names: C♯ is the same pitch as D♭, F♯ = G♭, and so on. The name depends on the key you're in. A major uses C♯, while F major uses B♭.

Patterns worth noticing:
1. There's a sharp/flat between every pair of natural notes EXCEPT B–C and E–F. Those pairs sit on neighboring frets. Find them on every string.
2. Frets 0 and 12 are identical columns. The whole map repeats.
3. Low E and high e are identical rows, two octaves apart. Learn one and you get the other free.
4. Every string's pattern is the low E pattern shifted. The A string is the same sequence starting from A.

Try this right now: pick a column (say fret 5) and play down it from low E to high e, naming each note: A, D, G, C, E, A. Then do fret 7: B, E, A, D, F♯, B. You're reading the map like a grid.

Common mistake: staring at this chart instead of playing. Every time you look something up here, play it and say the name. Looking it up without playing teaches you nothing.`,
    });
    const dots = [];
    for (let st = 1; st <= 6; st++) {
      for (let f = 0; f <= 12; f++) {
        const name = T.SHARP[T.pcAt(st, f)];
        dots.push({ s: st, f, label: name, role: NATURALS.has(name) ? 'note' : 'dim' });
      }
    }
    D.fretboard(s, { x: M, y: CONTENT_TOP + 0.2, w: 12.13, h: 3.7, from: 0, to: 12, dots, title: 'Full map' });
    const ly = 6.08;
    D.badge(s, { x: M, y: ly, d: 0.4, label: 'C', role: 'note' });
    s.addText('natural note', { x: M + 0.5, y: ly + 0.05, w: 1.5, h: 0.3, fontSize: 13, color: HEX.muted, margin: 0, isTextBox: true });
    D.badge(s, { x: M + 2.05, y: ly, d: 0.4, label: 'C♯', role: 'dim' });
    s.addText('sharp / flat (C♯ = D♭)', { x: M + 2.55, y: ly + 0.05, w: 2.6, h: 0.3, fontSize: 13, color: HEX.muted, margin: 0, isTextBox: true });
    D.text(s, 'No sharp between **B–C** or **E–F**. Learn landmarks, not cells.', { x: 5.9, y: ly + 0.04, w: 6.83, h: 0.35, fontSize: 14, align: 'right' });
  }

  // 18 · Low E landmarks
  {
    const s = D.slideOf(pres, {
      kicker: KICK, title: 'Landmarks: natural notes on the low E',
      notes: `The low E string is your first landmark. Learn its natural notes until you can name any of them instantly, without counting up from the open string.

The notes: open E, F at 1, G at 3, A at 5, B at 7, C at 8, D at 10, E again at 12.

Memory hooks:
• The inlay dots at 3, 5, 7 are G, A, B: three letters in a row on three dots in a row.
• 8 is C (one fret after B, because B–C has no sharp between them).
• 10 is D, and 12 is E again.
• E to F is also a single fret (0 to 1). The two "no gap" pairs, E–F and B–C, are marked above the board.

Why low E first?
1. It's the root string for E-shape power chords and barre chords, which you probably already play. Know the note under your index finger and you know the chord's name.
2. It's the root of pentatonic box 1. A minor pentatonic box 1 starts at fret 5 because A is at fret 5.
3. The high e string is exactly the same: same frets, same names, two octaves higher (the rings on the top line). One string learned, two strings known.

How to practice it:
• Play the naturals up and down, saying each name. Then skip around: "C!" → fret 8, "A!" → fret 5.
• Play a G power chord, then A, B, C, D, naming each root.

Common mistake: counting up from the open string every time ("E, F, F♯, G…"). Counting is fine for the first few days, but the goal is recall, not calculation. Quiz yourself randomly until the answer just appears.`,
    });
    const dots = [...naturalsOn(6, 0, 12, { role: 'note' }), ...naturalsOn(1, 0, 12, { role: 'note', ring: true })];
    const top = CONTENT_TOP + 0.75;
    D.fretboard(s, {
      x: M, y: top, w: 12.13, h: 2.4, from: 0, to: 12, dots, title: 'Low E landmarks',
      regions: [{ from: 0, to: 1, label: 'E–F: no gap' }, { from: 7, to: 8, label: 'B–C: no gap' }],
    });
    const cy = top + 2.85; const ch = 6.85 - cy;
    D.card(s, {
      x: M, y: cy, w: 5.9, h: ch, title: 'Memorize these first',
      body: ['**3** = G   ·   **5** = A   ·   **7** = B', '**8** = C   ·   **10** = D   ·   **12** = E'], fontSize: 17, paraSpace: 6,
    });
    D.card(s, {
      x: M + 6.2, y: cy, w: 5.93, h: ch, title: 'Two strings for the price of one',
      body: 'The **high e** (rings) has the same notes on the same frets, two octaves up. Low E is also the root string for power chords and box 1.', fontSize: 14,
    });
  }

  // 19 · A string landmarks
  {
    const s = D.slideOf(pres, {
      kicker: KICK, title: 'Landmarks: the A string, your root finder',
      notes: `The A string is landmark number two. Its natural notes: open A, B at 2, C at 3, D at 5, E at 7, F at 8, G at 10, A again at 12.

Notice the "no gap" pairs again: B–C sits at frets 2–3 and E–F at 7–8.

Memory hooks:
• 3 = C, 5 = D, 7 = E: three dots, three letters in a row (C D E), just like G A B on the low E.
• Fret 5 on the A string is D, which is also the open D string. That's the tuning relationship you'll meet on the next slide.

Why the E and A strings together are your root finder:
Almost every movable shape you'll use (power chords, barre chords, pentatonic boxes, CAGED shapes) has its root on the low E or A string. If you can name any note on those two strings instantly, you can play any chord or scale in any key.

The diagram on the right shows two power chords:
• G5 with its root on the low E (fret 3): root, then 5th and octave on the next strings.
• F5 with its root on the A string (fret 8): the same shape moved up one string.
Same shape, different root string. The root note decides the chord name.

How to practice:
• Call out a random chord name (G, C, F, D, B♭…). Play it as a power chord twice: once with the root on E, once with the root on A. Say the root as you play.
• For sharps/flats: find the natural next to it and move one fret (B♭ = one fret below B).

Common mistake: always using the same root string. Forcing yourself to find both options doubles your choices and keeps your hand from getting stuck in one area.`,
    });
    const top = CONTENT_TOP + 0.2;
    D.fretboard(s, { x: M, y: top, w: 12.13, h: 1.9, from: 0, to: 12, dots: naturalsOn(5, 0, 12), title: 'A string landmarks' });
    const by = top + 2.45;
    D.card(s, {
      x: M, y: by, w: 5.6, h: 6.85 - by, title: 'A string naturals',
      body: ['**2** = B   ·   **3** = C   ·   **5** = D', '**7** = E   ·   **8** = F   ·   **10** = G   ·   **12** = A', '_C D E on the dots at 3, 5, 7_'], fontSize: 16, paraSpace: 6,
    });
    // power chords rooted on E and A strings
    const px = M + 5.95; const pw = 12.73 - px;
    s.addText([{ text: 'Same shape, two root strings: ', options: { bold: true, color: HEX.pearl } }, { text: 'G5 on low E · F5 on A', options: { color: HEX.muted } }], { x: px, y: by, w: pw, h: 0.3, fontSize: 14, margin: 0, isTextBox: true });
    D.fretboard(s, {
      x: px, y: by + 0.42, w: pw, h: 1.95, from: 1, to: 10, fretNumbers: 'all', title: 'power chords',
      dots: [
        { s: 6, f: 3, label: 'G', role: 'root' }, { s: 5, f: 5, label: 'D', role: 'fifth' }, { s: 4, f: 5, label: 'G', role: 'root' },
        { s: 5, f: 8, label: 'F', role: 'root' }, { s: 4, f: 10, label: 'C', role: 'fifth' }, { s: 3, f: 10, label: 'F', role: 'root' },
      ],
    });
  }

  // 20 · Tuning: 5-5-5-4-5
  {
    const s = D.slideOf(pres, {
      kicker: KICK, title: 'How the strings are tuned: 5-5-5-4-5',
      notes: `Each string is tuned so that fret 5 on it plays the same note as the next higher string open. The one exception: on the G string you only go up to fret 4 to match the open B.

So the distances between neighboring strings are 5, 5, 5, 4, 5 frets:
• Low E fret 5 = A (open A string)
• A fret 5 = D (open D string)
• D fret 5 = G (open G string)
• G fret 4 = B (open B string) ← the odd one
• B fret 5 = E (open high e)

Five frets is a perfect 4th, and four frets is a major 3rd. Guitars are tuned this way so that common chords and scales fit under one hand.

Why this matters so much: the G–B shift.
Any shape that stays on strings E, A, D, G keeps its form when you move it across strings. As soon as a shape crosses from the G string to the B string, everything on the B and high e strings moves UP one fret to make up for the "short" interval. This single fact explains:
• why octave shapes change when they cross the B string (next slide)
• why the pentatonic boxes have that kink on the B string
• why chord shapes look different on the top strings.

You can also tune by ear with this: play fret 5 on low E and the open A together. If they wobble ("beat"), adjust the A string until the wobble stops. Repeat up the strings, using fret 4 on G.

Common mistake: memorizing scale shapes as rigid patterns and getting confused when they bend. They bend in exactly one place for exactly one reason. Once you know the reason, you can predict the shape.`,
    });
    const top = CONTENT_TOP + 0.45;
    D.fretboard(s, {
      x: M, y: top, w: 7.3, h: 3.5, from: 0, to: 7, title: 'Tuning',
      dots: [
        { s: 6, f: 5, label: 'A', role: 'note' }, { s: 5, f: 0, label: 'A', role: 'note' },
        { s: 5, f: 5, label: 'D', role: 'note' }, { s: 4, f: 0, label: 'D', role: 'note' },
        { s: 4, f: 5, label: 'G', role: 'note' }, { s: 3, f: 0, label: 'G', role: 'note' },
        { s: 3, f: 4, label: 'B', role: 'blue' }, { s: 2, f: 0, label: 'B', role: 'blue' },
        { s: 2, f: 5, label: 'E', role: 'note' }, { s: 1, f: 0, label: 'E', role: 'note' },
      ],
      links: [
        { a: { s: 6, f: 5 }, b: { s: 5, f: 0 } }, { a: { s: 5, f: 5 }, b: { s: 4, f: 0 } }, { a: { s: 4, f: 5 }, b: { s: 3, f: 0 } },
        { a: { s: 3, f: 4 }, b: { s: 2, f: 0 }, color: HEX.blue }, { a: { s: 2, f: 5 }, b: { s: 1, f: 0 } },
      ],
    });
    s.addText('Fret 5 = next string open · except G string: fret 4', { x: M, y: top + 3.85, w: 7.3, h: 0.3, fontSize: 13, color: HEX.muted, margin: 0, isTextBox: true });
    // distances column
    const rx = 8.35; const rw = 12.73 - rx;
    s.addText('Frets between neighboring strings', { x: rx, y: CONTENT_TOP + 0.05, w: rw, h: 0.3, fontSize: 14, bold: true, color: HEX.pearl, margin: 0, isTextBox: true });
    const pairs = [['E → A', '5'], ['A → D', '5'], ['D → G', '5'], ['G → B', '4'], ['B → e', '5']];
    pairs.forEach(([p, n], i) => {
      const y = CONTENT_TOP + 0.55 + i * 0.58;
      const odd = n === '4';
      D.badge(s, { x: rx, y, d: 0.46, label: n, role: odd ? 'blue' : 'note', fontSize: 16 });
      s.addText(p, { x: rx + 0.62, y: y + 0.04, w: 1.4, h: 0.38, fontSize: 17, bold: true, color: odd ? HEX.blue : HEX.white, margin: 0, valign: 'middle', isTextBox: true });
      s.addText(odd ? 'major 3rd: the short one' : 'perfect 4th', { x: rx + 2.0, y: y + 0.04, w: rw - 2.0, h: 0.38, fontSize: 13, color: HEX.muted, margin: 0, valign: 'middle', isTextBox: true });
    });
    D.card(s, {
      x: rx, y: 4.95, w: rw, h: 1.9, title: 'The G–B shift',
      body: 'Any shape crossing from G to B moves **up one fret** on the B and e strings. That rule explains every kink in scale and chord shapes.', fontSize: 13, titleColor: HEX.blue, titleSize: 15,
    });
  }

  // 21 · Octave shapes
  {
    const s = D.slideOf(pres, {
      kicker: KICK, title: 'Octave shapes: one note on every string',
      notes: `Octave shapes are the fastest way to carry a note you know (on the E or A string) to every other string.

An octave is the same note name, 12 half steps higher. On guitar, octaves form four fixed shapes, all "two strings up":

1. Low E → D string: 2 strings up, 2 frets up. (A at E5 → A at D7)
2. A → G string: 2 strings up, 2 frets up. (A at A0 → A at G2, or A12 → G14)
3. D → B string: 2 strings up, 3 frets up. (A at D7 → A at B10)
4. G → high e: 2 strings up, 3 frets up. (A at G2 → A at e5)

Why do shapes 3 and 4 need an extra fret? Both cross the G–B gap, which is one fret "short", so you add one fret to make up for it. That's the G–B shift from the previous slide in action.

Bonus shape: low E and high e are the same note at the same fret, two octaves apart (A at E5 and e5).

On the diagram, every A from fret 0 to 15 is shown. Solid lines are the 2-fret shapes, dashed lines the 3-fret shapes that cross the B string. Follow the chain from E5: → D7 → B10. And from A0: → G2 → e5.

How to practice:
• Play A on low E (fret 5), then its octave on D (7), then B (10). Say "A, A, A."
• Do the same from the A string: A12 → G14, or from open A → G2 → e5.
• Then pick other notes: C (E8 → D10 → B13), D (A5 → G7 → e10).

Common mistake: using the 2-fret shape across the B string and landing a half step flat. If it sounds "off", you forgot the extra fret.`,
    });
    s.addText('Every A from fret 0 to 15. Lines join octave pairs.', { x: M, y: CONTENT_TOP, w: 8, h: 0.3, fontSize: 14, color: HEX.muted, margin: 0, isTextBox: true });
    const pos = T.positions([T.pc('A')], { from: 0, to: 15 });
    D.fretboard(s, {
      x: M, y: CONTENT_TOP + 0.5, w: 12.13, h: 2.4, from: 0, to: 15, root: 'A', title: 'Octave shapes',
      dots: pos.map((p) => ({ ...p, label: 'A', role: 'root' })),
      links: [
        { a: { s: 6, f: 5 }, b: { s: 4, f: 7 } },
        { a: { s: 5, f: 0 }, b: { s: 3, f: 2 } },
        { a: { s: 5, f: 12 }, b: { s: 3, f: 14 } },
        { a: { s: 4, f: 7 }, b: { s: 2, f: 10 }, dash: 'dash' },
        { a: { s: 3, f: 2 }, b: { s: 1, f: 5 }, dash: 'dash' },
      ],
    });
    const shapes = [
      ['E → D', '+2', '2 strings up, **2 frets** up', 'note'],
      ['A → G', '+2', '2 strings up, **2 frets** up', 'note'],
      ['D → B', '+3', '2 strings up, **3 frets** up (crosses B)', 'blue'],
      ['G → e', '+3', '2 strings up, **3 frets** up (crosses B)', 'blue'],
    ];
    const cw = (12.13 - 0.3 * 3) / 4; const cy = 5.35; const ch = 1.5;
    shapes.forEach(([t, b, body, r], i) => D.card(s, { x: M + i * (cw + 0.3), y: cy, w: cw, h: ch, title: t, badge: b, badgeRole: r, body, fontSize: 14, titleSize: 17 }));
    s.addText('solid line = 2-fret shape · dashed = 3-fret shape · bonus: low E and high e match at the same fret', { x: M, y: 4.85, w: 12.13, h: 0.28, fontSize: 11, color: HEX.muted, margin: 0, isTextBox: true });
  }

  // 22 · One pitch, five places
  {
    const s = D.slideOf(pres, {
      kicker: KICK, title: 'One pitch, five places on the neck',
      notes: `On a piano each pitch lives in exactly one place. On a guitar the same exact pitch (not just the same name, the same sound) shows up on several strings.

The filled dots are middle C, played in five places:
• B string, fret 1
• G string, fret 5
• D string, fret 10
• A string, fret 15
• low E string, fret 20 (if your guitar has 20+ frets)
The rings are other Cs: the same note name in a different octave (lower or higher).

The rule: moving to the next thicker string, the same pitch is 5 frets higher. The exception is crossing from B down to G, where it's 4 frets (the G–B shift again).

Why it matters:
1. Tone. The same pitch sounds different on each string. Thicker strings played higher up sound warmer and fatter, while thinner strings sound brighter. Blues and rock players often choose a fatter position for the same melody.
2. Position choice. You can play any phrase in several places. Choose the one where the next notes are closest, or where the bends feel best.
3. Freedom. Once you see these unisons, you stop thinking "my lick only lives in box 1". It can live anywhere.

How to practice:
• Play the five middle Cs one after another, low fret to high. Listen for the identical pitch and the changing tone.
• Pick another note on the B string (e.g., D at fret 3) and find it on G (fret 7), D (12) and A (17).

Common mistake: mixing up "same pitch" with "same note name". The rings are Cs, but an octave away. Both are useful, but they sound different.`,
    });
    const midC = [{ s: 2, f: 1 }, { s: 3, f: 5 }, { s: 4, f: 10 }, { s: 5, f: 15 }, { s: 6, f: 20 }];
    const isMid = (p) => midC.some((m) => m.s === p.s && m.f === p.f);
    const allC = T.positions([T.pc('C')], { from: 0, to: 20 });
    const dots = allC.map((p) => ({ ...p, label: 'C', role: 'root', ring: !isMid(p) }));
    const top = CONTENT_TOP + 0.15;
    D.fretboard(s, {
      x: M, y: top, w: 12.13, h: 2.4, from: 0, to: 20, root: 'C', title: 'One pitch', dots,
      links: midC.slice(1).map((m, i) => ({ a: midC[i], b: m })),
    });
    const ly = top + 2.9;
    D.badge(s, { x: M, y: ly, d: 0.3, label: '', role: 'root' });
    s.addText('middle C: the identical pitch', { x: M + 0.4, y: ly - 0.02, w: 3.2, h: 0.34, fontSize: 13, color: HEX.muted, margin: 0, valign: 'middle', isTextBox: true });
    s.addShape(pres.shapes.OVAL, { x: M + 3.7, y: ly, w: 0.3, h: 0.3, fill: { color: HEX.wood }, line: { color: HEX.root, width: 2.25 } });
    s.addText('other Cs: same name, different octave', { x: M + 4.1, y: ly - 0.02, w: 3.8, h: 0.34, fontSize: 13, color: HEX.muted, margin: 0, valign: 'middle', isTextBox: true });
    const cards = [
      ['The unison rule', 'Next thicker string = same pitch **5 frets higher** (4 when going from B to G).'],
      ['Same pitch, new tone', 'Thicker strings higher up sound **warmer and fatter**. Thin strings sound brighter.'],
      ['Choose by what’s next', 'Play a phrase where its **next notes are closest**, or where bends feel best.'],
    ];
    const cw = (12.13 - 0.3 * 2) / 3; const cy = ly + 0.55; const ch = 6.85 - cy;
    cards.forEach(([t, b], i) => D.card(s, { x: M + i * (cw + 0.3), y: cy, w: cw, h: ch, title: t, body: b, fontSize: 14, titleSize: 16 }));
  }

  // 23 · Practice this
  D.practice(pres, {
    kicker: KICK,
    intro: 'Five minutes a day. Say every note name out loud, and use a metronome.',
    drills: [
      {
        name: 'Name the naturals', how: 'Play every natural note on the **low E**, frets 0 → 12 → 0, saying each name. Then the **A string**. Then random: call a note, hit it.',
        tempo: '60 bpm, 1 note per beat', time: '2 min', done: 'Any natural on E or A, instantly',
      },
      {
        name: 'Power-chord roots', how: 'Call out a chord (G, C, F, B♭, D…). Play it as a power chord with the root on **E**, then with the root on **A**. Say the root.',
        tempo: '1 chord every 4 beats at 70 bpm', time: '1 min', done: '10 random chords, no misses',
      },
      {
        name: 'Octave chains', how: 'Pick a note on low E. Jump **E → D → B** with octave shapes (+2, then +3). Then from the A string: **A → G → e**. Say the name every time.',
        tempo: '60 bpm, 1 note per beat', time: '1 min', done: 'Every note lands in tune',
      },
      {
        name: 'Unison hunt', how: 'Pick a note on the B string. Find the same pitch on **G** (+4), **D**, **A** (+5 each). Play them back to back and compare the tone.',
        tempo: 'No metronome: listen', time: '1 min', done: 'You hear one pitch, not two',
      },
    ],
    notes: `The practice slide for Part 2. These four drills take about five minutes together. Do them every day for two to three weeks, at the start of your session while your attention is fresh.

1. Name the naturals. Start slow, with the metronome at 60 and one note per click. Play every natural note on the low E from fret 0 up to 12 and back down, saying each name out loud. Then the A string. After a few days, switch to random order: think of a note, then find it. Random recall is what you actually need when playing.

2. Power-chord roots. This connects the map to something you already play. Call out chord names (write a list or use a random-note app). For each, play a power chord with the root on the low E, then again with the root on the A string. For sharps/flats, find the natural next to it and move one fret.

3. Octave chains. Start on a note on the low E. Use the 2-fret octave shape to jump to the D string, then the 3-fret shape (crossing B) to jump to the B string. Same thing from the A string to G to high e. If a note sounds slightly out of tune, you used the wrong shape across the B string.

4. Unison hunt. Pick any note on the B string and find the identical pitch on the G, D and A strings. Play them back to back. This trains your ears as well as your eyes.

Write your tempos in the practice log. When the "Done when" goal is met for a drill, move on to the Part 3 drills, but keep doing a minute of random naturals each day as a warm-up.`,
  });
}

module.exports = { build };
