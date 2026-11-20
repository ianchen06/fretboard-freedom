// Level 2 · Part 4 · Chords beyond triads (slides 43–51)
const T = require('../lib/theory');
const D = require('../lib/draw');
const { HEX, M, CONTENT_TOP, section } = require('../lib/deck');

const KICKER = '4 · Chords beyond triads';
const FULL_W = 12.13;

// Dots for a fingering like 'x76777', labeled by interval from `root`.
// names: { semitones: label } overrides (e.g. { 2: '9' }); roles: { semitones: role } overrides (role check skipped).
function chordDots(root, fing, names = {}, roles = {}) {
  return T.fingering(fing).map((p) => {
    const sm = T.semis(root, T.pcAt(p.s, p.f));
    const role = roles[sm] ?? T.role(sm);
    return { s: p.s, f: p.f, label: names[sm] ?? T.INTERVAL[sm], role, noRoleCheck: roles[sm] !== undefined };
  });
}

const fingText = (fing) => (fing.includes('.') ? fing.split('.') : fing.split('')).join(' ');

// Chord name, small fretboard, fingering string underneath, optional caption.
function chordBoard(s, o) {
  const h = o.h || 1.9;
  s.addText([
    { text: o.name, options: { bold: true, color: HEX.white, fontSize: o.nameSize || 17 } },
    ...(o.sub ? [{ text: `   ${o.sub}`, options: { color: HEX.muted, fontSize: 12 } }] : []),
  ], { x: o.x, y: o.y, w: o.w, h: 0.34, margin: 0, valign: 'middle', isTextBox: true });
  D.fretboard(s, {
    x: o.x, y: o.y + 0.42, w: o.w, h, from: o.from ?? 0, to: o.to ?? 4, root: o.root, title: o.name,
    dots: o.dots || chordDots(o.root, o.fing, o.names, o.roles), dotSize: o.dotSize,
  });
  let y = o.y + 0.42 + h + 0.3;
  if (o.fing) {
    s.addText([{ text: 'Frets  ', options: { color: HEX.faint, fontSize: 11 } }, { text: fingText(o.fing), options: { color: HEX.text, fontSize: 12, bold: true } }], { x: o.x + 0.3, y, w: o.w - 0.3, h: 0.24, margin: 0, isTextBox: true });
    y += 0.28;
  }
  if (o.caption) {
    const lines = D.lineCount(o.caption, 12, o.w - 0.3);
    D.text(s, o.caption, { x: o.x + 0.3, y, w: o.w - 0.3, h: lines * 0.22 + 0.06, fontSize: 12, color: HEX.muted });
    y += lines * 0.22 + 0.06;
  }
  return y;
}

function heading(s, str, x, y, w) {
  s.addText(str, { x, y, w, h: 0.32, fontSize: 15, bold: true, color: HEX.pearl, margin: 0, valign: 'middle', isTextBox: true });
}

// Chord tile: name with its numeral underneath.
function tile(s, x, y, w, h, name, numeral, role) {
  s.addShape(s._pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.08, fill: { color: HEX.card }, line: { color: HEX.card, width: 0 } });
  s.addText(name, { x, y: y + 0.08, w, h: h * 0.5, fontSize: 18, bold: true, color: HEX.white, align: 'center', valign: 'middle', margin: 0, isTextBox: true });
  s.addText(numeral, { x, y: y + h * 0.55, w, h: h * 0.38, fontSize: 13, bold: true, color: D.ROLE_HEX[role] || HEX.pearl, align: 'center', valign: 'middle', margin: 0, isTextBox: true });
}

function arrow(s, x, y) {
  s.addText('→', { x, y, w: 0.4, h: 0.4, fontSize: 18, color: HEX.muted, align: 'center', valign: 'middle', margin: 0, isTextBox: true });
}

function build(pres) {
  section(pres, 'Chords beyond triads');
  const slide = (title, notes) => { const s = D.slideOf(pres, { kicker: KICKER, title, notes }); s._pres = pres; return s; };

  // 43 · Divider
  D.divider(pres, {
    num: 4, title: 'Chords beyond triads',
    subtitle: 'Triads are the skeleton. Sus, add9, 6, 9, 13 and diminished chords add the color, and power-chord variants add the weight.',
    outcomes: [
      'Read any chord symbol and know which notes it asks for',
      'Play sus, add9 and 6 chords and know when to use them',
      'Play 9, 13 and 7♯9 chords for blues, funk and rock',
      'Use diminished and slash chords to connect chords smoothly',
      'Voice power chords five ways for heavy tones',
    ],
    notes: `Part 4 widens your chord vocabulary.

So far you've mostly played triads (root, 3rd, 5th), power chords (root and 5th) and three kinds of 7th chord. Those cover most of rock and blues, but real songs and real jams use more color. A chord chart might say Asus4, Cadd9, E9, A13, E7♯9, Bm7♭5 or D/F♯. If those symbols make you freeze, you lose the plot in a jam.

The good news is that every one of these chords is built the same way: start from a triad or 7th chord, then add, replace or alter one note. Once you know the naming rules (next slide), a chord symbol becomes a set of instructions rather than a shape to memorize.

What you'll get from this part:
• A decoder for chord symbols: sus, add, 6, 7, 9, 11, 13, ♭5, ♯5, ♯9, ° and ø.
• Sus2 and sus4: open, unresolved sounds that rock uses constantly.
• Add9 and 6 chords: sweet colors for intros, ballads and blues endings.
• Dominant 9, 13 and 7♯9: the funk chord, the blues turnaround chord and the "Hendrix chord".
• Diminished 7 and m7♭5: tense chords that make other chords sound inevitable.
• Slash chords: chords with a different bass note, for walking bass lines.
• Five power-chord voicings for distortion.

Keep the color code in mind: added and altered notes appear in teal, the "special" color, so you can see at a glance what makes each chord different from its plain triad.`,
  });

  // 44 · How chord names work
  {
    const s = slide('How chord names work', `Every chord symbol is a short instruction list. Learn the grammar once and you can decode chords you've never seen.

The ladder of 3rds. Chords are built by stacking every other note of a scale: root, 3rd, 5th, 7th. If you keep stacking you get the 9th, 11th and 13th. Those big numbers are just the 2nd, 4th and 6th an octave higher. So a 9 is the same note name as the 2, an 11 is the 4, and a 13 is the 6. The numbers above 7 tell you the 7th chord is also there.

The rules:
• A letter alone means a major triad. "m" means minor triad.
• "7" alone means the ♭7 is added: a dominant 7th. "maj7" means the natural 7.
• "9", "11", "13" mean a dominant 7th chord plus that extension. A9 = A C♯ E G B. On guitar the 11 is usually left out of 13 chords because it clashes with the 3rd, and the 5th is often dropped to save fingers.
• "add9" means add the 9 but no 7th. Aadd9 = A C♯ E B.
• "6" means add the 6 to the triad, with no 7th.
• "sus2" and "sus4" replace the 3rd with the 2nd or the 4th. No 3rd means the chord is neither major nor minor.
• "♭5", "♯5" (or "+") change the 5th. "♯9", "♭9" are altered 9ths, used on dominant chords.
• "°" is diminished (R ♭3 ♭5), "°7" adds a ♭♭7 (sounds like the 6), and "ø" (half-diminished) is m7♭5.

Practice: take any chord symbol from a song chart and spell it out loud before you play it. "E7♯9: E, G♯, B, D, plus the ♯9, F𝄪, which sounds as G."`);
    s.addText('Stack 3rds from the root: every chord name counts up this ladder', { x: M, y: CONTENT_TOP, w: 7.0, h: 0.32, fontSize: 15, bold: true, color: HEX.pearl, margin: 0, isTextBox: true });
    const ladder = [['R', 'root', 'root'], ['3', 'third', '3rd'], ['5', 'fifth', '5th'], ['♭7', 'seventh', '7th'], ['9', 'blue', '9th = 2'], ['11', 'other', '11th = 4'], ['13', 'blue', '13th = 6']];
    ladder.forEach(([lab, role, sub], i) => {
      const x = M + i * 0.98;
      D.badge(s, { x: x + 0.12, y: CONTENT_TOP + 0.48, d: 0.62, label: lab, role, fontSize: 17 });
      s.addText(sub, { x: x - 0.06, y: CONTENT_TOP + 1.16, w: 0.98, h: 0.26, fontSize: 12, color: HEX.muted, align: 'center', margin: 0, isTextBox: true });
    });
    D.card(s, {
      x: 7.75, y: CONTENT_TOP, w: 4.98, h: 1.5, title: 'Above 7, the numbers wrap',
      body: '**9 = 2, 11 = 4, 13 = 6**, an octave up. A **9** chord keeps the ♭7. An **add9** chord doesn’t.', fontSize: 14,
    });
    D.table(s, [
      ['Symbol', 'What it means', 'Example in A'],
      ['A, Am', 'Major triad, minor triad', 'A = A C♯ E · Am = A C E'],
      ['sus2, sus4', 'The 2 or 4 **replaces** the 3rd', 'Asus4 = A D E'],
      ['add9', 'Triad + 9, **no 7th**', 'Aadd9 = A C♯ E B'],
      ['6, m6', 'Triad + 6, no 7th', 'A6 = A C♯ E F♯'],
      ['7, maj7, m7', '♭7 (dominant), natural 7, minor + ♭7', 'A7 = A C♯ E G · Amaj7 = … G♯'],
      ['9, 11, 13', 'Dominant 7th + the extension', 'A9 = A C♯ E G B'],
      ['♭5, ♯5 (+)', '5th lowered or raised', 'A+ = A C♯ E♯ (sounds as F)'],
      ['♯9, ♭9', 'Altered 9th on a dominant chord', 'A7♯9 = A C♯ E G B♯ (sounds as C)'],
      ['°, °7, ø', 'Diminished, dim 7th, half-diminished (m7♭5)', 'B° = B D F · Bø = B D F A'],
    ], { x: M, y: CONTENT_TOP + 1.75, w: FULL_W, colW: [2.0, 5.0, 5.13], fontSize: 13, boldFirstCol: true });
  }

  // 45 · Sus2 and sus4
  {
    const s = slide('Sus2 and sus4: chords with no 3rd', `A suspended chord takes out the 3rd and puts the 2nd (sus2) or the 4th (sus4) in its place. With no 3rd, the chord is neither major nor minor. It sounds open, unfinished and ready to move.

The three diagrams are open A shapes side by side. Only one note changes: on the B string, fret 2 is C♯ (the 3rd), fret 3 is D (the 4th, making Asus4), and the open B is the 2nd (making Asus2). Teal marks the suspended note.

How rock uses them:
• Sus4 → major is the classic tension and release. Play A, lift into Asus4, and fall back to A. You've heard this move in countless rock and pop songs. Try it with D (xx0232 → xx0233) and E (022100 → 022200).
• Sus2 sounds airy and modern, and suits clean arpeggios and ringing open-string parts.
• Both work brilliantly with distortion. The 3rd is the note that makes heavy chords sound muddy, and a sus chord doesn't have one.
• Sus chords fit over major or minor keys because they don't commit. That makes them useful when you're not sure of the quality.

The tab shows the move on the top four strings: A, Asus4, A, then A, Asus2, A. Use a pinky or ring finger for the moving note and keep the rest of the chord held down.

Movable versions: E-shape sus4 for A is 5-7-7-7-5-5 (the 4th on the G string), and the A-shape sus2 moves anywhere: x-3-5-5-3-3 is Csus2.`);
    const w = (FULL_W - 0.6) / 3;
    const boards = [
      { name: 'Asus2', sub: 'R 2 5', fing: 'x02200', roles: { 2: 'blue' }, caption: 'Open, airy: the 2 replaces the 3rd' },
      { name: 'A', sub: 'R 3 5', fing: 'x02220', caption: 'The plain major triad, for reference' },
      { name: 'Asus4', sub: 'R 4 5', fing: 'x02230', roles: { 5: 'blue' }, caption: 'Tense, wants to fall back to the 3rd' },
    ];
    boards.forEach((b, i) => chordBoard(s, { ...b, x: M + i * (w + 0.3), y: CONTENT_TOP, w, root: 'A', from: 0, to: 4 }));
    heading(s, 'The sus move: A → Asus4 → A, then A → Asus2 → A', M, 4.85, 7.2);
    D.tab(s, {
      x: M, y: 5.35, w: 7.0, gap: 0.24,
      cols: ['4:2 3:2 2:2 1:0', '4:2 3:2 2:3 1:0', '4:2 3:2 2:2 1:0', '|', '4:2 3:2 2:2 1:0', '4:2 3:2 2:0 1:0', '4:2 3:2 2:2 1:0'],
      check: { root: 'A', scale: T.SCALES.major },
    });
    D.card(s, {
      x: 7.95, y: 4.85, w: 4.78, h: 2.0, title: 'When to reach for them',
      bullets: ['**Sus4 → major**: tension and release', '**Sus2**: open, ringing parts', 'No 3rd, so they fit **major or minor** and stay clean under distortion'],
      fontSize: 14, paraSpace: 5,
    });
  }

  // 46 · Add9 and 6 chords
  {
    const s = slide('Add9 and 6 chords: sweet colors', `Add9 and 6 chords keep the full triad and add one extra note on top. Unlike sus chords, they keep the 3rd, so they're clearly major or minor, just with more color.

Add9 adds the 9th (the 2nd, an octave up) and no 7th. It sounds bright, shimmering and slightly bittersweet. Aadd9 (x02420) puts the 9, B, on the G string at fret 4. Cadd9 (x32033) is one of the most-used chords in rock and pop: it shares the high G and D with a G chord, so G → Cadd9 → D is easy and sounds great.

Don't confuse add9 with 9. A "9" chord also contains the ♭7, which makes it a bluesy dominant chord (next slide). "Add9" has no 7th at all.

6 chords add the 6th to a triad. A6 (x02222) is a full A chord with F♯ on top. It's warm and a bit vintage: think swing, early rock 'n' roll and the last chord of a blues. Am6 (x02212) is a minor chord with a natural 6. That's exactly the Dorian sound from Level 1, which is why Am6 sounds smooth and jazzy rather than sad.

Rock rhythm players use the 6 constantly without naming it. The classic boogie pattern (on A: fret 2, then fret 4 on the D string, against the open A) moves between the 5th and the 6th.

Try each chord, then play the plain triad right after it. Hear what the teal note adds: that's the color you're choosing.`);
    const w = (FULL_W - 3 * 0.27) / 4;
    const boards = [
      { name: 'Aadd9', sub: 'R 3 5 9', fing: 'x02420', root: 'A', names: { 2: '9' }, roles: { 2: 'blue' } },
      { name: 'Cadd9', sub: 'R 3 5 9', fing: 'x32033', root: 'C', names: { 2: '9' }, roles: { 2: 'blue' } },
      { name: 'A6', sub: 'R 3 5 6', fing: 'x02222', root: 'A', roles: { 9: 'blue' } },
      { name: 'Am6', sub: 'R ♭3 5 6', fing: 'x02212', root: 'A', roles: { 9: 'blue' } },
    ];
    boards.forEach((b, i) => chordBoard(s, { ...b, x: M + i * (w + 0.27), y: CONTENT_TOP, w, from: 0, to: 4, nameSize: 16 }));
    const cw = (FULL_W - 0.3) / 2;
    D.card(s, {
      x: M, y: 4.75, w: cw, h: 2.05, title: 'Add9 is not 9',
      body: ['**Add9** = triad + 9, no 7th. Bright and shimmering.', 'A **9** chord also has the ♭7, which makes it a bluesy dominant chord.'],
      fontSize: 14, paraSpace: 6,
    });
    D.card(s, {
      x: M + cw + 0.3, y: 4.75, w: cw, h: 2.05, title: 'The 6: warm, vintage, Dorian',
      body: ['**A6**: swing, early rock ’n’ roll, a blues ending.', '**Am6**: minor + natural 6 is the **Dorian** sound, smooth and jazzy.'],
      fontSize: 14, paraSpace: 6,
    });
  }

  // 47 · Dominant 9, 13 and 7♯9
  {
    const s = slide('Dominant 9, 13 and 7♯9', `Three dominant chords that make blues, funk and rock sound like the real thing. All three contain the 3rd and ♭7 of a dominant 7th, plus one color note in teal.

E9 (x76777): root on the A string. It's E7 with the 9 (F♯) on the B string. This is the funk chord: play it as short, percussive stabs with muted scratches in between (the rhythm grid). Move the same shape to fret 5 for D9 and fret 12 for A9, and you can play a whole funky 12-bar in A without leaving the middle of the neck.

A13 (5x5677): root on the low E string. It holds R, ♭7, 3, 13 (F♯) and 9 (B). The 13 is the 6, an octave up. This is the sound of a jazzy blues, especially on the V chord or a turnaround. Slide it up from a fret below (4x4566 into 5x5677) for a classic blues approach.

E7♯9 (x7678x): often called the "Hendrix chord". It contains the major 3rd (G♯) and, on top, the ♯9 (G), which sounds like a minor 3rd. That clash of major and minor is the whole blues argument in one chord. Use it on the I chord of a heavy blues or a rock vamp in E, and hit it hard.

The rhythm grid: 16 cells per bar. Solid bars are chord hits, dashed x cells are muted scratches (fretting hand relaxed so the strings don't ring). Keep your strumming hand moving down-up on every 16th, and only let the chord ring on the hits. Accents (>) go on the first hit.

Practice the shapes slowly, then the rhythm with a metronome at 70 bpm before speeding up.`);
    const w = (FULL_W - 0.6) / 3;
    const boards = [
      { name: 'E9', sub: 'funk', fing: 'x76777', root: 'E', from: 5, to: 9, names: { 2: '9' }, roles: { 2: 'blue' }, caption: 'Move to fret 5 for D9, fret 12 for A9' },
      { name: 'A13', sub: 'blues', fing: '5x5677', root: 'A', from: 4, to: 8, names: { 2: '9', 9: '13' }, roles: { 2: 'blue', 9: 'blue' }, caption: '13 = the 6, an octave up' },
      { name: 'E7♯9', sub: 'rock', fing: 'x7678x', root: 'E', from: 5, to: 9, names: { 3: '♯9' }, roles: { 3: 'blue' }, caption: 'Major 3rd + ♯9: major and minor at once' },
    ];
    boards.forEach((b, i) => chordBoard(s, { ...b, x: M + i * (w + 0.3), y: CONTENT_TOP, w, h: 1.75 }));
    heading(s, 'E9 funk stabs: hits ring, x = muted scratch', M, 4.85, 7.2);
    const hits = [0, 3, 6, 10, 12];
    const notes = [];
    for (let i = 0; i < 16; i++) notes.push(hits.includes(i) ? { at: i, len: 1, role: 'third', accent: i === 0 } : { at: i, len: 1, ghost: true, text: 'x', role: 'other' });
    D.rhythm(s, { x: M, y: 5.25, w: 7.1, beats: 4, sub: 4, labelW: 0, rows: [{ notes }] });
    D.card(s, {
      x: 7.95, y: 4.85, w: 4.78, h: 2.0, title: 'Where they live',
      bullets: ['**9**: funk and soul rhythm', '**13**: jazzy blues, V chords, turnarounds', '**7♯9**: heavy blues and rock vamps'],
      fontSize: 14, paraSpace: 5,
    });
  }

  // 48 · Diminished 7 and m7♭5
  {
    const s = slide('Diminished 7 and m7♭5: tension chords', `Two "unstable" chords. They're rarely the home chord. Their job is to create tension that makes the next chord sound inevitable.

Diminished 7 (B°7, x2313x): R ♭3 ♭5 ♭♭7. Spelled B D F A♭. Every note is a minor 3rd (3 frets) from the next, so the chord divides the octave into four equal parts. That symmetry means any note can be the root: B°7, D°7, F°7 and A♭°7 are the same four notes, and the shape repeats every 3 frets up the neck. The diagram uses note names because the ♭♭7 (A♭) is spelled as a 7th even though it sits on the same fret as the 6.

Half-diminished (Bm7♭5, also written Bø, x2323x): R ♭3 ♭5 ♭7. It's a minor 7 chord with the 5th lowered, and it's the ii chord of a minor key.

What they do:
• Passing diminished. In A major, A → A♯°7 → Bm walks the bass up chromatically (A, A♯, B). The diminished chord is the glue between I and ii. The same trick works between almost any two chords a whole step apart.
• Leading-tone diminished. G♯°7 (G♯ B D F) contains the 3rd, 5th and ♭7 of E7 plus a ♭9. Over E it sounds like E7♭9, and it resolves powerfully to Am.
• Minor ii–V–i. Bm7♭5 → E7 → Am is the standard cadence of minor keys: jazz, flamenco, gypsy jazz and a lot of neoclassical metal.

Soloing tip: over a diminished chord, play its own arpeggio (Part 3) and land on the next chord's 3rd.`);
    const w = 3.3;
    chordBoard(s, {
      name: 'B°7', sub: 'B D F A♭', x: M, y: CONTENT_TOP, w, root: 'B', from: 0, to: 4, fing: 'x2313x',
      dots: [{ s: 5, f: 2, label: 'B', role: 'root' }, { s: 4, f: 3, label: 'F', role: 'blue' }, { s: 3, f: 1, label: 'A♭', role: 'seventh', noRoleCheck: true }, { s: 2, f: 3, label: 'D', role: 'third' }],
      caption: 'Repeats every 3 frets',
    });
    chordBoard(s, { name: 'Bm7♭5', sub: 'Bø', x: M + w + 0.3, y: CONTENT_TOP, w, root: 'B', from: 0, to: 4, fing: 'x2323x', caption: 'The ii chord of A minor' });
    D.card(s, {
      x: 7.85, y: CONTENT_TOP, w: 4.88, h: 3.0, title: 'Built from minor 3rds',
      body: ['**°7** = R ♭3 ♭5 ♭♭7: four notes, each 3 frets apart. Any of them can be the root: **B°7 = D°7 = F°7 = A♭°7**.', '**m7♭5** = R ♭3 ♭5 ♭7: a minor 7 with a flat 5th.'],
      fontSize: 14, paraSpace: 8,
    });
    const tw = 1.75; const th = 0.82;
    const strip = (y, label, chords) => {
      s.addText(runs2(label), { x: M, y, w: 3.4, h: th, margin: 0, valign: 'middle', isTextBox: true });
      chords.forEach(([n, num, role], i) => {
        const x = 4.1 + i * (tw + 0.5);
        tile(s, x, y, tw, th, n, num, role);
        if (i < chords.length - 1) arrow(s, x + tw + 0.05, y + th / 2 - 0.2);
      });
    };
    strip(4.75, '**Passing diminished**\nA major: bass walks A → A♯ → B', [['A', 'I', 'root'], ['A♯°7', '♯i°7', 'blue'], ['Bm', 'ii', 'other']]);
    strip(5.85, '**Minor ii–V–i**\nA minor: the minor-key cadence', [['Bm7♭5', 'iiø7', 'other'], ['E7', 'V7', 'fifth'], ['Am', 'i', 'root']]);
  }

  // 49 · Slash chords and inversions
  {
    const s = slide('Slash chords and inversions', `A slash chord is a chord with a specific bass note: the chord name comes first, then the bass note after the slash. A/C♯ means "play an A chord with C♯ as the lowest note." D/F♯ means "D chord, F♯ in the bass."

When the bass note is part of the chord, it's an inversion:
• A/C♯: the 3rd in the bass (1st inversion).
• A/E: the 5th in the bass (2nd inversion).
When the bass note isn't in the chord, it creates a new sound: Am/G is really Am7 with the ♭7 in the bass, and D/C gives a D chord a restless, floating feel.

Why bother? Slash chords make the bass line move smoothly. Instead of jumping from root to root, the bass walks by step:
• A → A/C♯ → D → E: the bass climbs A, C♯, D, E while the chords barely change shape.
• G → G/B → C: the classic folk-rock walk-up.
• C → C/B → Am → Am/G → F: a descending line (Am/G is the 3x2210 shape).

The three shapes:
• A/C♯ (x42220): open A with the thumb or a finger on fret 4 of the A string.
• D/F♯ (2x0232): open D with the F♯ on the low E. Mute the A string with the side of the finger on the E string, or with your thumb over the neck.
• G/B (x20033): a G chord without the low G, so B (the 3rd) is in the bass.

The tab plays the A → A/C♯ → D → E walk. Listen to the bass: that rising line is what the slash chords are for. In a band, the bass player may play the slash note for you. When it's just you, these shapes do both jobs.`);
    const w = (FULL_W - 0.6) / 3;
    const boards = [
      { name: 'A/C♯', sub: '3rd in the bass', fing: 'x42220', root: 'A', to: 5 },
      { name: 'D/F♯', sub: '3rd in the bass', fing: '2x0232', root: 'D', to: 4 },
      { name: 'G/B', sub: '3rd in the bass', fing: 'x20033', root: 'G', to: 4 },
    ];
    boards.forEach((b, i) => chordBoard(s, { ...b, x: M + i * (w + 0.3), y: CONTENT_TOP, w, from: 0 }));
    heading(s, 'Walking bass: A → A/C♯ → D → E', M, 4.85, 7.2);
    D.tab(s, {
      x: M, y: 5.35, w: 7.0, gap: 0.24,
      cols: ['5:0 4:2 3:2 2:2 1:0', '', '5:4 4:2 3:2 2:2 1:0', '', '4:0 3:2 2:3 1:2', '', '6:0 5:2 4:2 3:1 2:0 1:0'],
      check: { root: 'A', scale: T.SCALES.major },
    });
    D.card(s, {
      x: 7.95, y: 4.85, w: 4.78, h: 2.0, title: 'Reading X/Y',
      body: ['**Chord / bass note.** Play chord X with Y as the lowest note.', 'If Y is in the chord, it’s an inversion. If not, it adds a new color.'],
      fontSize: 14, paraSpace: 6,
    });
  }

  // 50 · Power chord variations
  {
    const s = slide('Power chords, five ways', `Under heavy distortion, fewer notes sound bigger. That's why power chords rule rock and metal. But there's more than one power chord, and each variation has its own character. Four of the five are rooted on A at the 5th fret of the low E string; the inverted shape's root is A on the D string, fret 7.

1. Root + 5 (A5): the basic two-note shape. Tight and punchy, ideal for fast palm-muted riffs.
2. Root + 5 + octave: add the octave on the D string for a fuller, wider sound. This is the default for big open-ringing chords.
3. Inverted (5th in the bass): the 5th below the root, a 4th apart, played with one finger flat across two strings. It sounds darker and is easy to slide around. It's common in punk and in metal riffs that alternate between the normal and inverted shapes.
4. ♭5 power chord: root + ♭5, the tritone. Instantly evil. Use it as a passing chord or a stab, not a home chord.
5. 5add9 (sus2 power chord): root, 5th and 9th (5-7-9). Open and modern under gain, with a little shimmer from the 9 but no 3rd to muddy it. It's a stretch, so use fingers 1, 3 and 4.

Why no 3rds? Distortion adds harmonics. A 3rd's harmonics clash with the root's harmonics and turn to mud, while the 5th and octave reinforce them. That's physics, not taste. Clean tones can carry full chords; heavy tones want power chords and their cousins.

The riff in tab uses four of the shapes. Palm-mute the single-note chugs, let the bigger shapes ring, and keep the picking hand moving in steady down-strokes.`);
    const w = (FULL_W - 4 * 0.22) / 5;
    const boards = [
      { name: 'A5', dots: [{ s: 6, f: 5, label: 'R', role: 'root' }, { s: 5, f: 7, label: '5', role: 'fifth' }], caption: 'Tight and punchy' },
      { name: 'A5 + octave', dots: [{ s: 6, f: 5, label: 'R', role: 'root' }, { s: 5, f: 7, label: '5', role: 'fifth' }, { s: 4, f: 7, label: 'R', role: 'root' }], caption: 'Full and wide' },
      { name: 'Inverted', dots: [{ s: 5, f: 7, label: '5', role: 'fifth' }, { s: 4, f: 7, label: 'R', role: 'root' }], caption: '5th in the bass, one finger' },
      { name: '♭5 chord', dots: [{ s: 6, f: 5, label: 'R', role: 'root' }, { s: 5, f: 6, label: '♭5', role: 'blue' }], caption: 'The tritone: evil' },
      { name: '5add9', dots: [{ s: 6, f: 5, label: 'R', role: 'root' }, { s: 5, f: 7, label: '5', role: 'fifth' }, { s: 4, f: 9, label: '9', role: 'blue' }], caption: 'Open, modern, no 3rd' },
    ];
    boards.forEach((b, i) => chordBoard(s, { ...b, x: M + i * (w + 0.22), y: CONTENT_TOP, w, h: 1.7, root: 'A', from: 4, to: 9, nameSize: 14 }));
    heading(s, 'A riff using four shapes (palm-mute the chugs)', M, 4.75, 7.3);
    D.tab(s, {
      x: M, y: 5.25, w: 7.2, gap: 0.24,
      cols: ['6:5 5:7', '6:5 5:7', '6:5 5:7 4:7', '|', '5:7 4:7', '6:5 5:6', '6:5 5:7 4:9', '6:5 5:7'],
      check: { root: 'A', scale: T.SCALES.blues, extra: [2] },
    });
    D.card(s, {
      x: 8.1, y: 4.75, w: 4.63, h: 2.05, title: 'Why no 3rds under gain',
      body: 'Distortion adds harmonics. The 5th and octave **reinforce** the root’s harmonics, while a 3rd **clashes** with them and turns to mud.',
      fontSize: 14,
    });
  }

  // 51 · Practice this
  D.practice(pres, {
    kicker: KICKER,
    intro: 'Ten minutes a day. Always say the chord’s full name and its color note as you play it.',
    drills: [
      { name: 'Sus resolutions', how: 'Strum A → Asus4 → A → Asus2, then D (xx0232/xx0233/xx0230) and E (022100/022200). Let each sus note fall back to the 3rd.', tempo: '70 bpm, 2 beats per chord', time: '3 min', done: 'Changes on the beat, no gaps' },
      { name: 'Funky 12-bar', how: 'Play a 12-bar in A with ninth chords: D9 (x54555), E9 (x76777), A9 (x.12.11.12.12.12). Strum 16ths with muted scratches between hits.', tempo: '70 → 90 bpm', time: '3 min', done: 'A full chorus without losing the groove' },
      { name: 'Slash-chord walks', how: 'Play A → A/C♯ → D → E, then G → G/B → C → D. Listen to the bass climbing while the top of the chord barely moves.', tempo: '80 bpm, 2 beats per chord', time: '2 min', done: 'Smooth bass line, clean changes' },
      { name: 'Power variants riff', how: 'Play the riff from this part with heavy gain. Then write your own 2-bar riff using at least three of the five shapes.', tempo: '90 → 120 bpm, 8ths', time: '2 min', done: 'Your riff played 4 times in a row' },
    ],
    notes: `Four drills that move the new chords from the page into your hands. Rotate through them over a week, or do all four if you have ten minutes.

1. Sus resolutions. The sus4 → major move is everywhere in rock, and practicing it on A, D and E teaches all three common open shapes. Use your pinky (or ring finger) for the moving note so the rest of the chord stays planted. Say "sus four… major… sus two… major" as you go so you connect the name to the sound.

2. Funky 12-bar. This teaches the most useful movable 9 shape and a whole new strumming feel. The fretting hand does the muting: relax the pressure slightly between hits so the strings go dead, but keep your fingers touching them. The strumming hand never stops moving in 16ths. Only the hits ring.

3. Slash-chord walks. The goal is to hear the bass line, not just play the shapes. Record yourself and listen: does the bass climb smoothly? For D/F♯, fret the low F♯ with your thumb over the neck, or with your 2nd finger while muting the A string.

4. Power variants riff. Play the riff from the slide, then compose. Limiting yourself to these five shapes is a good songwriting exercise: you'll quickly find that alternating normal and inverted power chords, or dropping a ♭5 stab into a riff, makes it sound far more professional.

Log your tempos in the Level 2 practice log, and record one minute of each drill at the end of the week.`,
  });
}

// Rich text with explicit line breaks ("\n") for the progression-strip labels.
function runs2(str) {
  const lines = str.split('\n');
  const out = [];
  lines.forEach((ln, i) => {
    const r = D.runs(ln, { color: i === 0 ? HEX.white : HEX.muted, fontSize: i === 0 ? 15 : 13 });
    if (i < lines.length - 1) r[r.length - 1].options.breakLine = true;
    out.push(...r);
  });
  return out;
}

module.exports = { build };
