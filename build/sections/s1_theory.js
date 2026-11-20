// Part 1 · Theory you actually need (slides 5–14)
const T = require('../lib/theory');
const D = require('../lib/draw');
const { HEX, M, CONTENT_TOP, section } = require('../lib/deck');

const KICK = '1 · Theory you actually need';

// Rounded tile with stacked lines of text (local helper).
function tile(pres, slide, { x, y, w, h, lines, fill, line, color = HEX.white }) {
  const runs = [];
  lines.forEach((l, i) => runs.push({ text: l.text, options: { fontSize: l.size, bold: l.bold !== false, color: l.color || color, fontFace: l.face || 'Arial', breakLine: i < lines.length - 1 } }));
  slide.addText(runs, {
    shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: 0.08, x, y, w, h,
    fill: fill ? { color: fill } : { color: HEX.bg }, line: line ? { color: line, width: 1.5 } : { color: fill || HEX.bg, width: 0 },
    align: 'center', valign: 'middle', margin: 0,
  });
}

function build(pres) {
  section(pres, 'Theory you actually need');

  // 5 · Divider
  D.divider(pres, {
    num: 1,
    title: 'Theory you actually need',
    subtitle: 'Just enough theory to make sense of the neck: 12 notes, a few formulas, and how chords live inside keys.',
    outcomes: [
      'Name all 12 notes and the two natural half steps',
      'Build a major or minor scale from any note',
      'Spell major, minor, power and 7th chords',
      'Name the chords in a key and read Roman numerals',
    ],
    notes: `Part 1: Theory you actually need.

Theory has a bad reputation among guitarists because it's usually taught from a piano and a page of notation. You don't need either. Everything in this part can be seen and heard on a single string of your guitar, and that's how we'll learn it.

What you get from this part:
• The 12 notes, and the two places where natural notes are only one fret apart (B–C and E–F). That one fact unlocks the whole fretboard map in Part 2.
• Intervals: the distances between notes. They're the real language of the guitar, because a distance is a shape you can play anywhere.
• The major scale formula (W W H W W W H) and its minor twin. With them you can build a scale from any note without memorizing anything.
• Chords: how triads, power chords and 7th chords are built from the scale.
• Keys and Roman numerals: which chords belong together, and how to describe a progression so it works in any key.

How to study it: read a slide, then immediately play it. Say the note names out loud. If something feels abstract, find it on one string and listen. The drills at the end of this part take about 10 minutes a day for a week. You don't need to master everything before moving on. Come back to these slides whenever a later topic refers to them.`,
  });

  // 6 · The 12 notes
  {
    const s = D.slideOf(pres, {
      kicker: KICK, title: 'The 12 notes',
      notes: `There are only 12 different notes in Western music. Every riff, solo and chord you will ever play uses some of these 12.

The musical alphabet has 7 letters: A B C D E F G. After G it starts again at A. These are the "natural" notes. The other 5 notes sit between them and are named with sharps (♯) and flats (♭):
• A sharp raises a note by one fret. C♯ is one fret above C.
• A flat lowers a note by one fret. D♭ is one fret below D.
• So C♯ and D♭ are the same fret. One note, two names. Which name you use depends on the key (you'll see why on the scale slides).

The single most important fact on this slide: B–C and E–F are only one fret apart. There is no B♯/C♭ or E♯/F♭ in everyday use. Every other pair of natural notes (A–B, C–D, D–E, F–G, G–A) has a sharp/flat between them, so they're 2 frets apart.

On the guitar, one fret = one half step (also called a semitone), the smallest distance in Western music. Twelve frets = 12 half steps = the same note one octave higher. That's why the inlays double up at the 12th fret: the whole pattern starts over there.

Try it now: play the open A string, then walk up one fret at a time to the 12th fret, saying each name out loud: A, A♯, B, C, C♯, D, D♯, E, F, F♯, G, G♯, A. Notice B→C and E→F are neighbors.

Common mistake: assuming every natural note is 2 frets from the next. Remember the two exceptions and the rest is simple counting.`,
    });
    const dots = [];
    for (let f = 0; f <= 12; f++) {
      const p = T.pcAt(5, f);
      const nat = !T.SHARP[p].includes('♯');
      dots.push({ s: 5, f, label: T.SHARP[p], role: nat ? 'note' : 'dim' });
    }
    const g = D.fretboard(s, {
      x: M, y: 2.15, w: 12.13, h: 2.2, from: 0, to: 12, dots, dotSize: 0.48, title: 'The 12 notes',
      regions: [{ from: 2, to: 3, label: 'B–C: 1 fret' }, { from: 7, to: 8, label: 'E–F: 1 fret' }],
    });
    // flat names under the accidentals
    for (let f = 0; f <= 12; f++) {
      const p = T.pcAt(5, f);
      if (!T.SHARP[p].includes('♯')) continue;
      s.addText(`= ${T.FLAT[p]}`, { x: g.fx(f) - 0.4, y: 4.66, w: 0.8, h: 0.26, fontSize: 11, color: HEX.muted, align: 'center', margin: 0, isTextBox: true });
    }
    s.addText('The A string, fret by fret', { x: 8.6, y: 1.62, w: 4.13, h: 0.28, fontSize: 12, color: HEX.muted, align: 'right', margin: 0, isTextBox: true });
    const cw = (12.13 - 0.6) / 3;
    const cards = [
      ['7 letters, then repeat', 'A B C D E F G, then A again. **12 frets up**, every note repeats one octave higher.'],
      ['Sharps and flats', '**♯ = one fret up, ♭ = one fret down.** C♯ and D♭ are the same fret: one note, two names.'],
      ['Two natural half steps', '**B–C** and **E–F** have no note between them. Every other pair of naturals is 2 frets apart.'],
    ];
    cards.forEach(([t, b], i) => D.card(s, { x: M + i * (cw + 0.3), y: 5.05, w: cw, h: 1.8, title: t, body: b, fontSize: 14 }));
  }

  // 7 · Intervals
  {
    const s = D.slideOf(pres, {
      kicker: KICK, title: 'Intervals: the real language of guitar',
      notes: `An interval is the distance between two notes, counted in half steps (frets). Intervals matter more to a guitarist than note names, because an interval is a shape. Once you know that a minor 3rd is 3 frets up the same string, it's 3 frets up from any note, in any key, anywhere on the neck.

The diagram shows every interval from A (high e string, 5th fret) up to the A an octave higher at the 17th fret. Each dot carries its interval name and its color code. The small numbers above count frets from the root.

Learn the names in this order:
• The power chord pair: root and 5th (7 frets). The backbone of rock.
• The two 3rds: minor 3rd (3 frets) sounds sad, major 3rd (4 frets) sounds happy. This one interval decides major vs. minor.
• The 7ths: the ♭7 (10 frets) is the bluesy, unresolved sound in every dominant 7 chord. The major 7th (11 frets) sounds dreamy and wants to resolve up to the root.
• The 4th (5 frets) and the ♭5/tritone (6 frets), the "blue note".

Naming: "♭3" means "one fret lower than the major 3rd". The same idea gives ♭2, ♭5, ♭6 and ♭7. The scale formulas later in this part are written with these labels.

Ear training: play the root, then the interval, on the same string. Sing both notes. Then play them together. Do this with the ♭3, 3, 5 and ♭7 until you can recognize each one with your eyes closed.

Common mistake: memorizing interval names without hearing them. A name is only useful if you can hear the sound behind it.`,
    });
    const pos = []; for (let f = 5; f <= 17; f++) pos.push({ s: 1, f });
    const g = D.fretboard(s, { x: M, y: 2.0, w: 12.13, h: 1.75, from: 5, to: 17, root: 'A', dots: D.dotsFor(pos, { root: 'A', label: 'interval' }), dotSize: 0.42, title: 'Intervals' });
    for (let f = 5; f <= 17; f++) s.addText(`+${f - 5}`, { x: g.fx(f) - 0.3, y: 1.66, w: 0.6, h: 0.24, fontSize: 11, bold: true, color: HEX.pearl, align: 'center', margin: 0, isTextBox: true });
    const rows = [
      [1, 'other', '♭2', 'Minor 2nd', 'Tense, horror-movie'],
      [2, 'other', '2', 'Major 2nd', 'A step, open'],
      [3, 'third', '♭3', 'Minor 3rd', 'Sad, bluesy'],
      [4, 'third', '3', 'Major 3rd', 'Happy, bright'],
      [5, 'other', '4', 'Perfect 4th', 'Open, strong'],
      [6, 'blue', '♭5', 'Tritone', 'Unstable: the blue note'],
      [7, 'fifth', '5', 'Perfect 5th', 'Solid: power chords'],
      [8, 'other', '♭6', 'Minor 6th', 'Dark, dramatic'],
      [9, 'other', '6', 'Major 6th', 'Sweet, warm'],
      [10, 'seventh', '♭7', 'Minor 7th', 'Bluesy, unresolved'],
      [11, 'seventh', '7', 'Major 7th', 'Dreamy, wants to rise'],
      [12, 'root', 'R', 'Octave', 'Same note, higher'],
    ];
    const mk = (part) => [['Frets', 'Interval', 'Sound'], ...part.map(([n, r, lab, name, snd]) => [String(n), `{${r}:${lab}}  ${name}`, snd])];
    D.table(s, mk(rows.slice(0, 6)), { x: M, y: 4.3, w: 5.9, colW: [0.75, 2.15, 3.0], fontSize: 13, align: ['center', 'left', 'left'] });
    D.table(s, mk(rows.slice(6)), { x: M + 6.23, y: 4.3, w: 5.9, colW: [0.75, 2.15, 3.0], fontSize: 13, align: ['center', 'left', 'left'] });
  }

  // 8 · The major scale
  {
    const s = D.slideOf(pres, {
      kicker: KICK, title: 'The major scale: one formula, every key',
      notes: `The major scale is the reference point for all of music theory. Every other scale, chord and mode is described as a change to it, so it's worth knowing cold.

The formula is a pattern of steps: W W H W W W H. W (whole step) means 2 frets and H (half step) means 1 fret. Start on any note, follow the pattern, and you've built that note's major scale.

The diagram builds C major along the B string: C (fret 1), D (3), E (5), F (6), G (8), A (10), B (12), C (13). The half steps land between E–F and B–C, exactly where the natural half steps are. That's why C major is the one major scale with no sharps or flats.

Scale degrees: number the notes 1 through 7. Musicians describe everything with these numbers. A major chord is 1–3–5. A ♭7 is degree 7 lowered by one fret. The dot labels show the degrees and the letters underneath show the note names.

Try another key: start on G and apply the formula. G A B C D E, then a whole step from E lands on F♯, then a half step to G. The formula forces one sharp. Each key has its own set of sharps or flats, and each letter is used exactly once.

Play it: pick a note on the A or low E string and play its major scale along that one string using the formula, saying the names. Then do the same from a different note. The sound (do-re-mi) should be identical every time.

Common mistake: playing scales only as box shapes. If you know the formula, you can rebuild any scale anywhere when you forget a shape.`,
    });
    // formula chips
    const steps = ['W', 'W', 'H', 'W', 'W', 'W', 'H'];
    steps.forEach((st, i) => tile(pres, s, { x: M + i * 0.72, y: 1.62, w: 0.6, h: 0.52, lines: [{ text: st, size: 20, face: 'Arial Black', color: st === 'W' ? HEX.white : '17171B' }], fill: st === 'W' ? HEX.card2 : HEX.pearl }));
    D.text(s, ['**W** = whole step = 2 frets     **H** = half step = 1 fret', 'Below: C major along the B string. Start on any note, follow the formula.'], { x: 5.95, y: 1.6, w: 6.78, h: 0.62, fontSize: 15 });
    const pos = T.positions(T.pcsOf('C', T.SCALES.major), { strings: [2], from: 1, to: 13 });
    const g = D.fretboard(s, { x: M, y: 2.8, w: 12.13, h: 1.55, from: 0, to: 13, root: 'C', dots: D.dotsFor(pos, { root: 'C', label: 'interval' }), dotSize: 0.4, title: 'Major scale' });
    for (let i = 0; i < pos.length - 1; i++) {
      const a = pos[i].f; const b = pos[i + 1].f;
      const isH = b - a === 1;
      tile(pres, s, { x: (g.fx(a) + g.fx(b)) / 2 - 0.17, y: 2.42, w: 0.34, h: 0.3, lines: [{ text: isH ? 'H' : 'W', size: 12, color: isH ? '17171B' : HEX.white }], fill: isH ? HEX.pearl : HEX.card2 });
    }
    pos.forEach((p) => s.addText(T.spellIn('C', T.pcAt(p.s, p.f)), { x: g.fx(p.f) - 0.3, y: 4.66, w: 0.6, h: 0.3, fontSize: 15, bold: true, color: HEX.pearl, align: 'center', margin: 0, isTextBox: true }));
    const G = T.pcsOf('G', T.SCALES.major).map((p) => T.spellIn('G', p)).join(' ');
    D.card(s, { x: M, y: 5.2, w: 5.9, h: 1.65, title: 'Scale degrees', body: 'Number the notes **1–7**. Everything else is described with them: a major chord is **1–3–5**, and **♭7** is the 7th lowered one fret.', fontSize: 14 });
    D.card(s, { x: M + 6.23, y: 5.2, w: 5.9, h: 1.65, title: 'Works from any note', body: `**G major:** ${G}. The formula forces one sharp (F♯). Each letter appears once.`, fontSize: 14 });
  }

  // 9 · Minor scale & relative keys
  {
    const s = D.slideOf(pres, {
      kicker: KICK, title: 'The minor scale and relative keys',
      notes: `The natural minor scale (also called Aeolian) is the major scale with three notes lowered: 1 2 ♭3 4 5 ♭6 ♭7. Its step pattern is W H W W H W W. The ♭3 is what makes it minor. The ♭6 and ♭7 give it its dark, heavy color, the sound of countless rock and metal songs.

Now look at the two rows. C major is C D E F G A B. A minor is A B C D E F G. They're the same 7 notes! A minor is the "relative minor" of C major. They share every note and every chord. The only difference is which note feels like home.

That changes how the notes sound. Play C D E F G A B C over a C chord and it sounds bright. Play the same notes over an A minor chord and it sounds sad. The backing chord decides the home note.

Finding the relative minor: it's the 6th degree of the major scale, or simply 3 frets below the major root. On the low E string, C is at fret 8, so A (fret 5) is the relative minor. Going the other way, the relative major is 3 frets above the minor root.

This is the first big shortcut of the course. Your A minor pentatonic box 1 is also C major pentatonic. You'll use that in Part 5 to get major-sounding solos out of shapes you already know.

The keys guitarists live in: E, A, D and G (and their relatives) use open strings as roots, so riffs can drone on open strings. Most blues and rock is in E or A. Metal lives in E minor (or lower in drop/down tunings).

Common mistake: thinking "relative" means "similar". Relative keys share exactly the same notes. Parallel keys (A major vs. A minor) share a root but not the notes.`,
    });
    const strip = (rootName, ivs, y, label, formula) => {
      s.addText(label, { x: M, y: y + 0.08, w: 1.4, h: 0.45, fontSize: 17, bold: true, color: HEX.white, margin: 0, valign: 'middle', isTextBox: true });
      ivs.forEach((iv, i) => {
        const p = T.mod12(T.pc(rootName) + iv);
        const x = 2.1 + i * 0.78;
        D.badge(s, { x, y, d: 0.62, label: T.INTERVAL[iv], role: T.role(iv) });
        s.addText(T.spellIn(rootName, p), { x: x - 0.1, y: y + 0.68, w: 0.82, h: 0.28, fontSize: 14, bold: true, color: HEX.pearl, align: 'center', margin: 0, isTextBox: true });
      });
      s.addText(formula, { x: 2.1, y: y + 0.98, w: 5.3, h: 0.26, fontSize: 12, color: HEX.muted, margin: 0, isTextBox: true });
    };
    strip('C', T.SCALES.major, 1.7, 'C major', 'W W H W W W H  ·  bright');
    strip('A', T.SCALES.minor, 3.15, 'A minor', 'W H W W H W W  ·  dark  ·  same 7 notes, new home');
    const rel = [['Major key', 'Relative minor'], ['C', 'Am'], ['G', 'Em'], ['D', 'Bm'], ['A', 'F♯m'], ['E', 'C♯m'], ['F', 'Dm']];
    D.table(s, rel, { x: 7.9, y: 1.65, w: 4.83, colW: [2.4, 2.43], fontSize: 14, align: ['center', 'center'] });
    D.fretboard(s, {
      x: M, y: 5.05, w: 6.6, h: 1.45, from: 3, to: 10, root: 'A', title: 'Relative minor',
      dots: [{ s: 6, f: 5, label: 'A', role: 'root' }, { s: 6, f: 8, label: 'C', role: 'third' }], dotSize: 0.34,
      regions: [{ from: 5, to: 8, label: '3 frets down from C → A minor' }],
    });
    D.card(s, {
      x: 7.9, y: 4.45, w: 4.83, h: 2.4, title: 'Keys guitarists live in',
      bullets: ['**E minor / G major**: open low E root', '**A minor / C major**: blues and rock home', '**D** and **A**: open-string drones', 'Metal: **E** or lower tunings'],
      fontSize: 14, paraSpace: 5,
    });
  }

  // 10 · Building chords
  {
    const s = D.slideOf(pres, {
      kicker: KICK, title: 'Building chords: stack every other note',
      notes: `A chord is three or more notes played together. The basic chord, the triad, is built by stacking every other note of the scale: 1, 3 and 5. Skipping a note each time is called "stacking thirds".

Look at the distances in the stacks:
• Major: root + 4 frets (major 3rd) + 3 frets (minor 3rd). C E G. Bright and happy.
• Minor: root + 3 frets (minor 3rd) + 4 frets (major 3rd). C E♭ G. Sad, dark.
• Diminished: root + 3 + 3. C E♭ G♭. Tense and unstable. It shows up as the vii° chord in a key.
The only difference between major and minor is the 3rd, one fret. That's why the 3rd gets its own color in this deck.

Power chords (written C5, A5, E5) are just the root and the 5th, often with the root doubled an octave up. With no 3rd, they're neither major nor minor, so they fit over both. Distortion makes the 3rd sound muddy and harsh, while root + 5th stays clean and huge. That's why rock and metal riffs live on power chords.

The two power chord shapes on the right are the most important shapes in rock:
• Root on the 6th string: root, then the 5th one string up and two frets up, plus the octave on the D string. A5 is at the 5th fret.
• Root on the 5th string: the same shape moved over one string. D5 is at the 5th fret.
Slide either shape anywhere. The name comes from the root note on the lowest string. That's why knowing the notes on the E and A strings (Part 2) matters so much.

Try it: play an open C chord and an open Cm-shaped chord (or Am vs. A). Listen only to the 3rd changing.`,
    });
    const stacks = [
      { name: 'Major', chord: 'C', ivs: [0, 4, 7], gaps: ['+4', '+3'] },
      { name: 'Minor', chord: 'Cm', ivs: [0, 3, 7], gaps: ['+3', '+4'] },
      { name: 'Diminished', chord: 'C°', ivs: [0, 3, 6], gaps: ['+3', '+3'] },
      { name: 'Power chord', chord: 'C5', ivs: [0, null, 7], gaps: ['+7 (no 3rd)'] },
    ];
    const colW = 1.6; const gapX = 0.17;
    stacks.forEach((st, i) => {
      const x0 = M + i * (colW + gapX);
      s.addText(st.name, { x: x0, y: 1.62, w: colW, h: 0.34, fontSize: 15, bold: true, color: HEX.white, align: 'center', margin: 0, isTextBox: true });
      const ys = [4.1, 3.1, 2.1]; // R, 3rd, 5th (bottom to top)
      st.ivs.forEach((iv, k) => {
        if (iv === null) return;
        const p = T.mod12(T.pc('C') + iv);
        D.badge(s, { x: x0 + 0.38, y: ys[k], d: 0.6, label: T.INTERVAL[iv], role: T.role(iv) });
        s.addText(T.spellIn('C', p), { x: x0 + 1.04, y: ys[k] + 0.1, w: 0.56, h: 0.4, fontSize: 16, bold: true, color: HEX.pearl, margin: 0, valign: 'middle', isTextBox: true });
      });
      if (st.gaps.length === 2) {
        s.addText(st.gaps[0], { x: x0, y: 3.73, w: 0.36, h: 0.3, fontSize: 12, bold: true, color: HEX.muted, align: 'right', margin: 0, isTextBox: true });
        s.addText(st.gaps[1], { x: x0, y: 2.73, w: 0.36, h: 0.3, fontSize: 12, bold: true, color: HEX.muted, align: 'right', margin: 0, isTextBox: true });
      } else {
        s.addText(st.gaps[0], { x: x0 + 0.1, y: 3.2, w: colW - 0.2, h: 0.4, fontSize: 12, bold: true, color: HEX.muted, align: 'center', margin: 0, isTextBox: true });
      }
      tile(pres, s, { x: x0 + 0.25, y: 4.9, w: colW - 0.5, h: 0.42, lines: [{ text: st.chord, size: 16 }], fill: HEX.card2 });
    });
    D.card(s, { x: M, y: 5.6, w: 6.9, h: 1.25, body: 'Stack every other scale note: **1–3–5**. Major 3rd = **4 frets**, minor 3rd = **3 frets**. Only the 3rd separates major from minor.', fontSize: 14 });
    // power chord card
    const cx = 7.9; const cw = 4.83;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: cx, y: CONTENT_TOP + 0.05, w: cw, h: 5.25, rectRadius: 0.1, fill: { color: HEX.card }, line: { color: HEX.card, width: 0 } });
    s.addText('Power chords: root + 5th', { x: cx + 0.22, y: 1.8, w: cw - 0.44, h: 0.38, fontSize: 17, bold: true, color: HEX.white, margin: 0, isTextBox: true });
    const bw = 2.05;
    [
      { label: 'A5 · root on 6th', root: 'A', dots: [{ s: 6, f: 5, label: 'R', role: 'root' }, { s: 5, f: 7, label: '5', role: 'fifth' }, { s: 4, f: 7, label: 'R', role: 'root' }] },
      { label: 'D5 · root on 5th', root: 'D', dots: [{ s: 5, f: 5, label: 'R', role: 'root' }, { s: 4, f: 7, label: '5', role: 'fifth' }, { s: 3, f: 7, label: 'R', role: 'root' }] },
    ].forEach((b, i) => {
      const bx = cx + 0.22 + i * (bw + 0.29);
      s.addText(b.label, { x: bx, y: 2.3, w: bw, h: 0.28, fontSize: 12, bold: true, color: HEX.pearl, margin: 0, isTextBox: true });
      D.fretboard(s, { x: bx, y: 2.72, w: bw, h: 1.5, from: 4, to: 8, root: b.root, dots: b.dots, dotSize: 0.24, labelSize: 10, title: b.label });
    });
    D.text(s, ['**No 3rd**, so it’s neither major nor minor and fits under both.', 'Distortion makes 3rds sound muddy. Root + 5th stays **clean and huge**, which is why riffs live here.'], { x: cx + 0.22, y: 4.7, w: cw - 0.44, h: 1.95, fontSize: 14, paraSpace: 8 });
  }

  // 11 · 7th chords
  {
    const s = D.slideOf(pres, {
      kicker: KICK, title: '7th chords: one more note, a new mood',
      notes: `Keep stacking thirds past the 5th and you get a 7th chord: 1–3–5–7. Three 7th chords cover almost everything you'll meet in blues and rock:

• Major 7 (Amaj7): R 3 5 7. The 7th is one fret below the octave. Smooth, dreamy, a little jazzy. You'll hear it in soul and ballads more than in hard rock.
• Dominant 7 (A7): R 3 5 ♭7. A major triad with a ♭7 on top. Restless and bluesy; it wants to move somewhere. This is THE blues chord.
• Minor 7 (Am7): R ♭3 5 ♭7. A minor triad with a ♭7. Mellow and cool: funk, soul, minor blues.

The name "dominant" comes from the V chord of a major key, the only dominant 7th chord the key produces naturally (G7 in C). In practice, "7" with no other word always means dominant 7.

The shapes are all movable barre-chord shapes with the root on the 6th string at fret 5 (A). Compare the dots: A7 vs. Amaj7 differ only in the purple dot (♭7 vs. 7). A7 vs. Am7 differ only in the amber dot (3 vs. ♭3). That's the color code at work.

Why blues uses dominant 7s everywhere: in a 12-bar blues in A, all three chords are dominant 7s (A7, D7, E7). Strictly speaking only E7 belongs to the key of A major. The blues ignores that rule, and the tension from those ♭7s is the blues sound. It's also why the minor pentatonic works over those major chords: its ♭3 and ♭7 rub against them in exactly the right way.

Try it: play A, then A7, then Amaj7, then Am7. Listen for the one or two notes that change.`,
    });
    const cols = [
      { name: 'Amaj7', kind: 'Major 7th', f: '5x665x', formula: '{root:R}  {third:3}  {fifth:5}  {seventh:7}', sound: 'Dreamy and smooth: soul, ballads, jazz.' },
      { name: 'A7', kind: 'Dominant 7th', f: '575655', formula: '{root:R}  {third:3}  {fifth:5}  {seventh:♭7}', sound: 'Bluesy and restless: **the** blues chord. Wants to move.' },
      { name: 'Am7', kind: 'Minor 7th', f: '575555', formula: '{root:R}  {third:♭3}  {fifth:5}  {seventh:♭7}', sound: 'Mellow minor: funk, soul, minor blues.' },
    ];
    const cw = (12.13 - 0.6) / 3;
    cols.forEach((c, i) => {
      const x = M + i * (cw + 0.3);
      s.addText([{ text: c.name, options: { fontSize: 22, bold: true, color: HEX.white } }, { text: `   ${c.kind}`, options: { fontSize: 13, color: HEX.muted } }], { x, y: 1.6, w: cw, h: 0.42, margin: 0, valign: 'middle', isTextBox: true });
      D.text(s, c.formula, { x, y: 2.05, w: cw, h: 0.32, fontSize: 15 });
      D.fretboard(s, { x, y: 2.48, w: cw, h: 1.85, from: 4, to: 8, root: 'A', dots: D.dotsFor(T.fingering(c.f), { root: 'A', label: 'interval' }), dotSize: 0.3, title: c.name });
      D.text(s, c.sound, { x, y: 4.7, w: cw, h: 0.6, fontSize: 14, color: HEX.text });
    });
    D.card(s, { x: M, y: 5.4, w: 12.13, h: 1.45, title: 'Why blues uses dominant 7s everywhere', body: 'A 12-bar in A is **A7, D7, E7**: all dominant. That {seventh:♭7} tension is the blues sound, and why the minor pentatonic’s {third:♭3} and {seventh:♭7} fit over major chords.', fontSize: 14 });
  }

  // 12 · Chords in a key
  {
    const s = D.slideOf(pres, {
      kicker: KICK, title: 'Chords in a key: the Roman numeral map',
      notes: `Build a triad on every note of a scale, using only notes from that scale, and you get the 7 chords that belong to the key. This is called harmonizing the scale.

In a major key the qualities always come out in the same order: major, minor, minor, major, major, minor, diminished. We write them as Roman numerals: uppercase = major, lowercase = minor, ° = diminished.
I ii iii IV V vi vii°
In C: C Dm Em F G Am B°.

Now look at the A minor row. It's the same 7 chords, starting from Am. Of course it is: A minor is the relative minor of C major and uses the same notes. In minor-key numerals:
i ii° ♭III iv v ♭VI ♭VII
In A minor: Am B° C Dm Em F G.
The ♭ in "♭VI" means the chord is built on the ♭6 of the minor key, compared with the major scale on the same root.

Why numerals? They describe a progression independently of key. "I–IV–V" is A–D–E in A, E–A–B in E, G–C–D in G. When a bandmate says "it's a one-four-five in E", you know every chord instantly, and when you learn a song in one key, you can move it to any other.

The minor-key chords that matter most in rock and metal are i, ♭VI and ♭VII: Am, F and G in A minor; Em, C and D in E minor. You'll meet them on the next slide.

Practice: write out the 7 chords for G, D, A and E major using the pattern, then play them as power chords or open chords. Check yourself against the major scale spellings (G major has F♯, so its vii° is F♯°).`,
    });
    const tileW = 1.35; const tileH = 1.22; const tx0 = 2.25;
    const row = (chords, y, label, sub) => {
      s.addText([{ text: label, options: { fontSize: 18, bold: true, color: HEX.white, breakLine: true } }, { text: sub, options: { fontSize: 12, color: HEX.muted } }], { x: M, y, w: 1.55, h: tileH, margin: 0, valign: 'middle', isTextBox: true });
      chords.forEach((c, i) => {
        const x = tx0 + i * (tileW + 0.1);
        const q = c.quality;
        tile(pres, s, {
          x, y, w: tileW, h: tileH,
          fill: q === 'maj' ? HEX.card2 : q === 'min' ? HEX.card : null, line: q === 'dim' ? HEX.faint : null,
          lines: [
            { text: c.numeral, size: 20, face: 'Arial Black', color: q === 'maj' ? HEX.white : HEX.pearl },
            { text: c.name, size: 16, color: HEX.white },
            { text: q === 'maj' ? 'major' : q === 'min' ? 'minor' : 'diminished', size: 11, bold: false, color: HEX.muted },
          ],
        });
      });
    };
    row(T.harmonize('C', 'major'), 1.65, 'C major', 'key');
    row(T.harmonize('A', 'minor'), 3.12, 'A minor', 'relative minor');
    s.addText('Same 7 chords: A minor just starts from Am, the vi of C major.', { x: tx0, y: 4.42, w: 10.2, h: 0.3, fontSize: 13, color: HEX.muted, margin: 0, isTextBox: true });
    D.card(s, {
      x: M, y: 4.95, w: 5.9, h: 1.9, title: 'The pattern never changes',
      body: ['Major key: **I ii iii IV V vi vii°**', 'Minor key: **i ii° ♭III iv v ♭VI ♭VII**', 'Uppercase = major, lowercase = minor, ° = diminished.'], fontSize: 14, paraSpace: 4,
    });
    const ex = ['A', 'E', 'G'].map((k) => { const h = T.harmonize(k); return `**${k}:** ${h[0].name}–${h[3].name}–${h[4].name}`; });
    D.card(s, {
      x: M + 6.23, y: 4.95, w: 5.9, h: 1.9, title: 'Numerals transpose for you',
      body: [`"One–four–five" (I–IV–V) is the same song in any key:`, ex.join('    ')], fontSize: 14, paraSpace: 6,
    });
  }

  // 13 · Common progressions
  {
    const s = D.slideOf(pres, {
      kicker: KICK, title: 'Progressions you’ll hear everywhere',
      notes: `A handful of progressions cover a huge share of blues, rock and metal. Learn to recognize them by ear and by numeral, and most songs will feel familiar the first time you hear them.

The 12-bar blues (left) is the most important form for jamming. In A: four bars of A7 (I), two of D7 (IV), two of A7, then E7 (V), D7 (IV), A7 (I) and E7 (V). The last bar (the "turnaround") sends you back to the top. A common variation, the "quick change", goes to the IV in bar 2. The colors follow the color code: the I chord is built on the root (red), the V chord on the 5th (blue), the IV chord on the 4th (gray).

The table:
• I–IV–V: the backbone of rock 'n' roll and punk.
• I–V–vi–IV: the pop-rock anthem progression, heard in countless choruses.
• I–♭VII–IV: classic rock (A–G–D). The ♭VII is borrowed from Mixolydian, which you'll meet in Part 5.
• i–♭VI–♭VII: the epic minor rock/metal progression (Am–F–G, Em–C–D).
• i–♭VII–♭VI–V: the descending "Andalusian" progression (Am–G–F–E). The E major chord (not Em) comes from harmonic minor and creates a strong pull back to Am.
• i–iv–v: minor blues and minor rock.
• i–♭II: the half-step riff move of metal (E5–F5), from the Phrygian mode.

How to practice: play each one with power chords or open chords, four beats per chord, along with a metronome. Then take songs you know and try to name their progressions. You'll find these patterns again and again.`,
    });
    // 12-bar grid
    s.addText('12-bar blues in A', { x: M, y: 1.6, w: 5, h: 0.36, fontSize: 17, bold: true, color: HEX.white, margin: 0, isTextBox: true });
    const bars = [['A7', 'I'], ['A7', 'I'], ['A7', 'I'], ['A7', 'I'], ['D7', 'IV'], ['D7', 'IV'], ['A7', 'I'], ['A7', 'I'], ['E7', 'V'], ['D7', 'IV'], ['A7', 'I'], ['E7', 'V']];
    const roleOf = { I: 'root', IV: 'other', V: 'fifth' };
    const cw = 1.18; const ch = 0.74;
    bars.forEach(([c, n], i) => {
      const x = M + (i % 4) * (cw + 0.1); const y = 2.1 + Math.floor(i / 4) * (ch + 0.1);
      const st = D.roleStyle(roleOf[n]);
      s.addText([{ text: c, options: { fontSize: 17, bold: true, color: st.text, breakLine: true } }, { text: n, options: { fontSize: 11, bold: true, color: st.text } }], {
        shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: 0.07, x, y, w: cw, h: ch, fill: { color: st.fill }, line: { color: st.fill, width: 0 }, align: 'center', valign: 'middle', margin: 0,
      });
    });
    D.legend(s, { x: M, y: 4.73, roles: ['root', 'other', 'fifth'], names: { root: 'I chord', other: 'IV chord', fifth: 'V chord' }, fontSize: 12 });
    D.card(s, { x: M, y: 5.2, w: 5.02, h: 1.65, body: ['**Quick change:** play IV in bar 2.', '**Turnaround:** bar 12 is the V, which pulls you back to bar 1.'], fontSize: 14 });
    const rows = [
      ['Numerals', 'Example', 'Where you hear it'],
      ['I–IV–V', 'A–D–E', 'Rock ’n’ roll, punk, classic rock'],
      ['I–V–vi–IV', 'A–E–F♯m–D', 'Pop-rock anthems'],
      ['I–♭VII–IV', 'A–G–D', 'Classic rock, blues-rock'],
      ['i–♭VI–♭VII', 'Am–F–G · Em–C–D', 'Epic rock and metal'],
      ['i–♭VII–♭VI–V', 'Am–G–F–E', 'Descending “Andalusian”: metal, flamenco'],
      ['i–iv–v', 'Am–Dm–Em', 'Minor blues, minor rock'],
      ['i–♭II', 'E5–F5', 'Metal riffs (Phrygian half step)'],
    ];
    D.table(s, rows, { x: 6.0, y: 1.65, w: 6.73, colW: [1.75, 1.95, 3.03], fontSize: 13, boldFirstCol: true });
    D.card(s, { x: 6.0, y: 5.2, w: 6.73, h: 1.65, title: 'Hear them', body: 'Play each with power chords, **4 beats per chord**, to a metronome. Then name the numerals in songs you already know.', fontSize: 14 });
  }

  // 14 · Practice this
  D.practice(pres, {
    kicker: KICK, title: 'Practice this: theory in your hands',
    intro: 'Ten minutes a day for one week. Theory sticks only when your hands and ears use it.',
    drills: [
      { name: 'Spell 5 major scales', how: 'Using **W W H W W W H**, spell **C, G, D, A and E** major out loud. Then play each one along a single string, naming every note.', tempo: '60 bpm, 1 note per beat', time: '3 min', done: 'All 5 spelled from memory' },
      { name: 'Name the chords in a key', how: 'For C, G, D, A and E, say the 7 chords: **I ii iii IV V vi vii°**. Then play **I–IV–V–I** in each key with power chords.', tempo: '70 bpm, 4 beats per chord', time: '3 min', done: 'Any key’s chords in 10 seconds' },
      { name: 'Hear the intervals', how: 'On one string, play the root, then 3, 4, 7 and 10 frets up. Sing both notes. Compare the sad **♭3** with the happy **3**.', tempo: 'Free time', time: '2 min', done: 'You can tell ♭3 from 3 by ear' },
      { name: 'Numeral detective', how: 'Pick 3 songs you know. Find the home chord, then write each progression in **Roman numerals**.', time: '2 min a day', done: 'Three songs written as numerals' },
    ],
    notes: `Theory drills: about 10 minutes a day for one week, then keep the parts that feel weakest in your warm-up.

Drill 1, Spell 5 major scales. Say the formula out loud as you go: "C, whole step, D, whole step, E, half step, F…". Then play the scale along one string (the A string is ideal) so you see the formula as fret distances. Check your spellings: G has F♯; D has F♯ and C♯; A has F♯, C♯ and G♯; E has F♯, C♯, G♯ and D♯. Done when you can spell all five from memory with the right sharps.

Drill 2, Name the chords in a key. Use the pattern major–minor–minor–major–major–minor–diminished. Then play I–IV–V–I with power chords: in A that's A5–D5–E5–A5, with the roots on the 6th and 5th strings. Done when someone can name a key and you can list its chords within 10 seconds.

Drill 3, Hear the intervals. On the A string: open A then fret 3 (C, the ♭3), open A then fret 4 (C♯, the 3), then fret 7 (E, the 5th) and fret 10 (G, the ♭7). Sing along. The goal is to hear the difference between the ♭3 and 3 because it's the difference between minor and major, and it guides note choice when you solo.

Drill 4, Numeral detective. Choose simple songs. The home chord is usually the first and last chord, and the one that feels "finished". Count up from it to name the other chords. If you hit a chord that isn't in the key (like ♭VII in a major key), note it — you've found a borrowed chord.

Keep a note of what was hard in the practice log (Part 7).`,
  });
}

module.exports = { build };
