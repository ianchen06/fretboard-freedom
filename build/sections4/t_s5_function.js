// Theory Intensive · Part 5 · Function: why chords move
const T = require('../lib/theory');
const D = require('../lib/draw');
const I = require('../lib/intensive');
const { HEX, M, CONTENT_TOP, CONTENT_BOTTOM, section } = require('../lib/deck');

const K = '5 · Function';
const FULL = 12.13;

// Job of each diatonic degree in a major key.
const FN_OF = { 1: 'T', 2: 'PD', 3: 'T', 4: 'PD', 5: 'D', 6: 'T', 7: 'D' };
const FN_WORD = { T: 'Tonic', PD: 'Predominant', D: 'Dominant' };
const roleOf = (fn) => I.FN[fn].role;

// Numeral (with any accidental/suffix) -> function, by its base Roman numeral.
function fnOfNumeral(num) {
  const base = num.replace(/^[♭♯]/, '').match(/^(vii|iii|ii|iv|vi|v|i|VII|III|II|IV|VI|V|I)/)[1].toUpperCase();
  return FN_OF[['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'].indexOf(base) + 1];
}
// Numerals colored by function: 'I–V–vi–IV' -> rich markup.
const colorNumerals = (str) => str.split('–').map((n) => `{${roleOf(fnOfNumeral(n))}:${n}}`).join('–');

// Look up the numerals of diatonic chords named in a key (triads and 7ths).
function numeralsIn(key, names) {
  const all = [...T.diatonicChords(key, 'major', 3), ...T.diatonicChords(key, 'major', 4)];
  return names.map((n) => {
    const c = all.find((x) => x.name === n);
    if (!c) throw new Error(`${n} is not diatonic in ${key}`);
    return c.numeral;
  }).join('–');
}
// 簡譜 digits to chord names in a key: digits('1564', 'A') -> 'A–E–F♯m–D'.
function digitsTo(key, digits, size = 3) {
  const ch = T.diatonicChords(key, 'major', size);
  return [...digits].map((d) => ch[Number(d) - 1].name).join('–');
}
const common = (a, b) => a.filter((n) => b.map(T.pc).includes(T.pc(n)));

// Rounded panel.
function panel(pres, s, x, y, w, h, opts = {}) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.1, fill: { color: opts.fill || HEX.card }, line: opts.line ? { color: opts.line, width: 1.5 } : { color: opts.fill || HEX.card, width: 0 } });
}

function build(pres) {
  section(pres, 'Function');
  const C3 = T.diatonicChords('C', 'major', 3);
  const C4 = T.diatonicChords('C', 'major', 4);

  // Divider
  D.divider(pres, {
    num: 5,
    title: 'Function: why chords move',
    subtitle: 'Every chord in a key has a job: rest, leave or pull home. Learn the jobs and progressions stop being lists to memorize.',
    outcomes: [
      'Sort any diatonic chord into tonic, predominant or dominant',
      'Explain why V7 pulls to I, note by note',
      'Name the four classical cadences and two rock cadences by ear',
      'Analyze a progression in Roman numerals and Chinese number notation',
      'Voice-lead I–vi–IV–V on the top strings with the smallest moves',
    ],
    notes: `Part 5: Function.

Up to now, the chords in a key have been a list: seven chords, seven numerals. This part explains why they behave the way they do. Why does V want to go to I? Why does IV feel like leaving home? Why can vi stand in for I? Why do some progressions sound inevitable while others sound random?

The core idea is that every diatonic chord has one of three jobs. Tonic chords are home. Predominant chords move away from home and set up the dominant. Dominant chords create tension that wants to resolve home. Most progressions in pop, rock, classical and jazz are some version of that cycle: home, away, tension, home.

The engine behind it is one interval, the tritone inside the V7 chord. Once you see how its two notes resolve, you'll hear dominant function everywhere.

In this part you will:
• Sort chords by job, and see why chords that share notes share jobs.
• Compare root motions: why falling 5ths sound strong and stepwise motion sounds fresh.
• Learn the cadences, the punctuation marks of music.
• Learn a set of progression templates, including the ones that drive Mandopop and J-pop ballads, in Roman numerals and 簡譜 numbers.
• See why the blues breaks these rules and still works.
• Voice-lead progressions on the top strings so the chords connect smoothly.

A second color code starts here and runs to the end of the deck. It colors chord tiles by job: tonic blue, predominant amber, dominant red, secondary dominant teal, borrowed chords purple.`,
  });

  // Tonic, predominant, dominant
  {
    const s = D.slideOf(pres, {
      kicker: K, title: 'Tonic, predominant, dominant',
      notes: `Every chord in a major key does one of three jobs.

Tonic (blue): home, rest, the end of the sentence. I is the true tonic. vi and iii are tonic substitutes because each shares two notes with I. Am (A C E) has C and E in common with C (C E G), so it can stand in for I. That's exactly what a deceptive cadence does.

Predominant (amber): the chords that move away from home and lead toward the dominant. IV is the main one. ii shares two notes with IV (Dm has F and A, F has F, A and C), so it does the same job, often more smoothly.

Dominant (red): tension that wants to resolve home. V is the main one. vii° (B D F) is all three upper notes of G7 (G B D F), so it's really a V7 without its root.

The basic cycle is T → PD → D → T. Home, leave, tension, home. It isn't a law: T can go straight to D (I–V is everywhere), and D can fall to vi instead of I. But when a progression sounds "right", you can usually find that cycle inside it.

iii is the odd one. It shares E and G with I but also G and B with V, so it sits between tonic and dominant and sounds ambiguous. Treat it as a weak tonic.

Try it now: in C, play C–F–G–C (T–PD–D–T). Then swap in the substitutes: Am–Dm–G–C, C–Dm–B°–C, Am–F–G–Am. Each version tells the same story with different colors.

Common mistake: thinking a chord's function is fixed by its name. Function comes from its relationship to the key. G is dominant in C but tonic in G.`,
    });
    const groups = [
      { fn: 'T', label: 'TONIC', sub: 'home', degrees: [1, 6, 3] },
      { fn: 'PD', label: 'PREDOMINANT', sub: 'away', degrees: [4, 2] },
      { fn: 'D', label: 'DOMINANT', sub: 'tension', degrees: [5, 7] },
    ];
    const bw = 3.3; const gap = (FULL - 3 * bw) / 2; const by = CONTENT_TOP; const bh = 1.7;
    groups.forEach((g, i) => {
      const x = M + i * (bw + gap);
      const col = D.ROLE_HEX[roleOf(g.fn)];
      panel(pres, s, x, by, bw, bh, { line: col });
      s.addText([
        { text: g.label, options: { bold: true, color: col, fontSize: 14, charSpacing: 2 } },
        { text: `   ${g.sub}`, options: { color: HEX.muted, fontSize: 13 } },
      ], { x: x + 0.2, y: by + 0.12, w: bw - 0.4, h: 0.34, margin: 0, valign: 'middle', isTextBox: true });
      const n = g.degrees.length; const tw = 0.92; const tg = 0.16;
      const tx0 = x + (bw - (n * tw + (n - 1) * tg)) / 2;
      g.degrees.forEach((d, k) => {
        const c = C3[d - 1];
        I.tile(s, { x: tx0 + k * (tw + tg), y: by + 0.58, w: tw, h: 0.95, top: c.name, bottom: c.numeral, role: roleOf(g.fn), topSize: 18, fill: HEX.card2 });
      });
    });
    // forward arrows with labels
    ['leave', 'pull'].forEach((lab, i) => {
      const x1 = M + (i + 1) * bw + i * gap + 0.1; const x2 = x1 + gap - 0.2; const ay = by + bh / 2 + 0.15;
      I.arrow(s, x1, ay, x2, ay, { color: HEX.pearl, width: 2 });
      s.addText(lab, { x: x1, y: ay - 0.36, w: x2 - x1, h: 0.26, fontSize: 12, bold: true, color: HEX.pearl, align: 'center', margin: 0, isTextBox: true });
    });
    // return path D -> T under the boxes
    const xD = M + 2 * (bw + gap) + bw / 2; const xT = M + bw / 2; const ry = by + bh + 0.32;
    s.addShape(pres.shapes.LINE, { x: xD, y: by + bh + 0.04, w: 0, h: ry - by - bh - 0.04, line: { color: HEX.pearl, width: 2 } });
    s.addShape(pres.shapes.LINE, { x: xT, y: ry, w: xD - xT, h: 0, line: { color: HEX.pearl, width: 2 } });
    I.arrow(s, xT, ry, xT, by + bh + 0.06, { color: HEX.pearl, width: 2 });
    s.addText('resolve home', { x: (xT + xD) / 2 - 0.8, y: ry - 0.13, w: 1.6, h: 0.26, fontSize: 12, bold: true, color: HEX.pearl, fill: { color: HEX.bg }, align: 'center', valign: 'middle', margin: 0, isTextBox: true });
    // shared-note table
    const n = (d) => C3[d - 1].notes;
    const g7 = T.spellChord('G', '7');
    const rows = [
      ['Chord', 'Notes', 'Why it has this job', 'Job'],
      [`{fifth:I}  C`, n(1).join(' '), 'The key center itself', '{fifth:Tonic}'],
      [`{fifth:vi}  Am`, n(6).join(' '), `Shares ${common(n(6), n(1)).join(' and ')} with I, so it can replace I`, '{fifth:Tonic}'],
      [`{fifth:iii}  Em`, n(3).join(' '), `Shares ${common(n(3), n(1)).join(' and ')} with I, but also ${common(n(3), n(5)).join(' and ')} with V: a weak tonic`, '{fifth:Tonic} (weak)'],
      [`{third:IV}  F`, n(4).join(' '), `Only ${common(n(4), n(1)).join('')} in common with I: it leaves home`, '{third:Predominant}'],
      [`{third:ii}  Dm`, n(2).join(' '), `Shares ${common(n(2), n(4)).join(' and ')} with IV, so it does IV's job`, '{third:Predominant}'],
      [`{root:V}  G`, n(5).join(' '), `Holds ${n(5)[1]}, the leading tone, a half step below C`, '{root:Dominant}'],
      [`{root:vii°}  B°`, n(7).join(' '), `All three notes are inside G7 (${g7.join(' ')}): a V7 without its root`, '{root:Dominant}'],
    ];
    if (common(n(7), g7).length !== 3) throw new Error('vii° should sit inside V7');
    D.table(s, rows, { x: M, y: by + bh + 0.58, w: FULL, colW: [1.45, 1.35, 7.03, 2.3], fontSize: 13, rowH: 0.34 });
  }

  // The tritone engine
  {
    const s = D.slideOf(pres, {
      kicker: K, title: 'The tritone engine',
      notes: `Why does V7 pull so hard to I? Look inside G7: G B D F. Between B and F is a tritone, six half steps, the most unstable interval in the key. It's the only tritone in the whole C major scale, so it points at one key and one key only.

Each note of the tritone sits a half step from a note of the C chord:
• B, the 3rd of G7, is the leading tone. It rises a half step to C.
• F, the 7th of G7, falls a half step to E.
The two notes move in opposite directions (contrary motion) and the unstable tritone collapses into a stable major 3rd, C–E. Underneath, the bass falls a 5th from G to C. Three voices all point at C at once. That's what "resolution" sounds like.

On the guitar you can hear the engine with just two strings. On the G and B strings, the tritone is B at fret 4 and F at fret 6. Slide each to its neighbor: B up to C at fret 5, F down to E at fret 5. Those two moves are the whole resolution. Add the bass, G on the low E string at fret 3 to C on the A string at fret 3, and you have the full V7–I.

Try it now: play the two-note shape back and forth (fret 4/6 to fret 5/5) and listen. It sounds finished even without a bass note.

Keep this in mind for Part 6: D♭7 contains the same two notes (F and C♭, which is B), so it can do the same job. That's tritone substitution.

Common mistake: playing V without the 7th and wondering why it sounds weaker. A plain G triad has the leading tone but no F. The tritone needs both notes.`,
    });
    const g7 = T.spellChord('G', '7');
    if (T.intervalName(g7[1], g7[3]) !== 'd5') throw new Error('G7 tritone check');
    s.addText('Rings = G7    Solid = C', { x: M, y: CONTENT_TOP, w: 5.7, h: 0.3, fontSize: 12, color: HEX.muted, margin: 0, isTextBox: true });
    D.fretboard(s, {
      x: M, y: 2.05, w: 5.7, h: 2.1, from: 2, to: 8, title: 'Tritone engine',
      dots: [
        { s: 6, f: 3, label: 'G', role: 'root', ring: true },
        { s: 3, f: 4, label: 'B', role: 'third', ring: true },
        { s: 2, f: 6, label: 'F', role: 'seventh', ring: true },
        { s: 5, f: 3, label: 'C', role: 'root' },
        { s: 3, f: 5, label: 'C', role: 'root' },
        { s: 2, f: 5, label: 'E', role: 'third' },
      ],
      links: [{ a: { s: 3, f: 4 }, b: { s: 3, f: 5 }, color: HEX.third }, { a: { s: 2, f: 6 }, b: { s: 2, f: 5 }, color: HEX.seventh }, { a: { s: 6, f: 3 }, b: { s: 5, f: 3 }, color: HEX.root }],
      dotSize: 0.4,
    });
    s.addText('G7 → C in tab, then the tritone alone', { x: M, y: 4.62, w: 5.7, h: 0.28, fontSize: 12, color: HEX.muted, margin: 0, isTextBox: true });
    D.tab(s, { x: M, y: 5.12, w: 5.7, gap: 0.25, cols: ['6:3 3:4 2:6', '', '5:3 3:5 2:5', '', '|', '3:4 2:6', '3:5 2:5', '3:4 2:6', '3:5 2:5'], check: { root: 'C', scale: T.SCALES.major } });
    // voice-leading rows
    const rx = 6.85; const rw = 12.73 - rx; const tw = 1.6;
    I.heading(s, 'Each note moves to its nearest neighbor', rx, CONTENT_TOP, rw);
    const rowsVL = [
      { a: 'F', ar: '♭7 of G7', ra: 'seventh', b: 'E', br: '3 of C', rb: 'third', how: 'down a half step' },
      { a: 'B', ar: '3 of G7', ra: 'third', b: 'C', br: 'root of C', rb: 'root', how: 'up a half step' },
      { a: 'G', ar: 'root of G7', ra: 'root', b: 'C', br: 'root of C', rb: 'root', how: 'bass: down a 5th' },
    ];
    rowsVL.forEach((r, i) => {
      const y = 2.0 + i * 0.85;
      I.tile(s, { x: rx, y, w: tw, h: 0.72, top: r.a, bottom: r.ar, role: r.ra, topSize: 20, bottomSize: 12 });
      I.tile(s, { x: 12.73 - tw, y, w: tw, h: 0.72, top: r.b, bottom: r.br, role: r.rb, topSize: 20, bottomSize: 12 });
      const x1 = rx + tw + 0.12; const x2 = 12.73 - tw - 0.12;
      I.arrow(s, x1, y + 0.46, x2, y + 0.46, { color: HEX.pearl, width: 1.75 });
      s.addText(r.how, { x: x1, y: y + 0.1, w: x2 - x1, h: 0.26, fontSize: 12, bold: true, color: HEX.text, align: 'center', margin: 0, isTextBox: true });
    });
    D.card(s, {
      x: rx, y: 4.62, w: rw, h: 2.23, title: 'Why V7 pulls so hard',
      bullets: [
        `**${g7[1]}–${g7[3]}**: a tritone, the key's most unstable interval`,
        `**${g7[1]}** (leading tone) rises to C, **${g7[3]}** falls to E`,
        'Contrary motion lands on the stable 3rd **C–E**',
      ],
      fontSize: 14, paraSpace: 6,
    });
  }

  // Root motion
  {
    const s = D.slideOf(pres, {
      kicker: K, title: 'Root motion: 5ths, 3rds and steps',
      notes: `How strong a chord change sounds depends mostly on how far the root moves. There are three families.

Down a 5th (or up a 4th, which is the same note): G → C. One note stays (G), and the bass makes the strongest move in tonal music. The root of the first chord becomes the 5th of the second, so the second chord sounds like the goal. Every V–I is a falling 5th.

Down a 3rd: C → Am. Two notes stay (C and E). Only one voice moves, by a step. The change is gentle, almost a recoloring of the same chord. That's why vi works as a substitute for I, and iii for V. Up a 3rd (C → Em) also keeps two notes.

Up or down a step: F → G. No notes in common. Every voice has to move, which sounds fresh and energetic. Rock lives on stepwise motion: IV–V, ♭VI–♭VII. Move the voices in the opposite direction to the bass if you can, or the chords can sound like one shape being slid around.

Chain falling 5ths and you get a circle progression: iii–vi–ii–V–I (Em7–Am7–Dm7–G7–Cmaj7 in C). Each chord acts like the V of the next one, so the whole line keeps pulling forward until it reaches I. Jazz standards, ballads and baroque sequences are built on this.

Try it now: play Em7–Am7–Dm7–G7–Cmaj7 slowly. Then play the same chords in a random order. The circle order sounds inevitable; the random order sounds like a list.

Common mistake: assuming "strong" means "better". Strong root motion is for arrival. Third and step motion keep a song floating. Good progressions mix them.`,
    });
    const cw = (FULL - 0.6) / 3; const ch = 2.5;
    const pairs = [
      { t: 'Down a 5th: G → C', a: 'G', b: 'C', d: 'One common tone. The bass falls a 5th: arrival.' },
      { t: 'Down a 3rd: C → Am', a: 'C', b: 'Am', d: 'Two common tones. Smooth; vi can stand in for I.' },
      { t: 'Up a step: F → G', a: 'F', b: 'G', d: 'No common tones. Fresh, but every voice moves.' },
    ];
    const notesOf = (name) => (name.endsWith('m') ? T.spellChord(name.slice(0, -1), 'm') : T.spellChord(name, ''));
    pairs.forEach((p, i) => {
      const x = M + i * (cw + 0.3); const y = CONTENT_TOP;
      panel(pres, s, x, y, cw, ch);
      s.addText(p.t, { x: x + 0.22, y: y + 0.18, w: cw - 0.44, h: 0.34, fontSize: 16, bold: true, color: HEX.white, margin: 0, valign: 'middle', isTextBox: true });
      const A = notesOf(p.a); const B = notesOf(p.b);
      [[p.a, A, B], [p.b, B, A]].forEach(([nm, mine, other], k) => {
        const ry = y + 0.68 + k * 0.6;
        s.addText(nm, { x: x + 0.22, y: ry, w: 0.75, h: 0.44, fontSize: 18, bold: true, color: HEX.white, margin: 0, valign: 'middle', isTextBox: true });
        I.noteRow(s, { x: x + 1.0, y: ry, d: 0.44, gap: 0.14, notes: mine.map((nn) => ({ label: nn, role: common([nn], other).length ? 'blue' : 'other' })) });
      });
      D.text(s, p.d, { x: x + 0.22, y: y + 1.92, w: cw - 0.44, h: 0.5, fontSize: 14 });
    });
    D.legend(s, { x: M, y: 4.25, roles: ['blue', 'other'], names: { blue: 'Common tone', other: 'Moves' } });
    I.heading(s, 'A circle progression: every root falls a 5th', M, 4.62, 8.4);
    const prog = [3, 6, 2, 5, 1].map((d) => ({ name: C4[d - 1].name, numeral: C4[d - 1].numeral, fn: FN_OF[d] }));
    const g = I.progression(s, { x: M, y: 5.05, w: 8.4, h: 1.1, gap: 0.62, chords: prog });
    for (let i = 0; i < prog.length - 1; i++) {
      const x = g.centers[i] + g.tileW / 2;
      s.addText('↓5th', { x, y: 5.05 + 0.12, w: 0.62, h: 0.24, fontSize: 11, bold: true, color: HEX.pearl, align: 'center', margin: 0, isTextBox: true });
    }
    I.fnLegend(s, { x: M, y: 6.42, fns: ['T', 'PD', 'D'] });
    D.card(s, { x: 9.35, y: 4.62, w: 12.73 - 9.35, h: 2.23, title: 'Why it pulls forward', body: 'Each root is a 5th above the next, so every chord acts like the **V of the chord after it**. The line keeps leaning toward I.', fontSize: 14 });
  }

  // Cadences
  {
    const s = D.slideOf(pres, {
      kicker: K, title: 'Cadences: how phrases end',
      notes: `A cadence is the last two or three chords of a phrase: the punctuation. Learn to hear these six and you'll be able to predict where a song is going.

Authentic (V–I): the full stop. G7 → C. If the melody also lands on the tonic note over the I chord, it's a perfect authentic cadence, the strongest ending there is. Choruses, endings, and the last line of a verse often use it.

Half (anything → V): the comma. The phrase stops on the dominant, so it sounds like a question. The next phrase usually answers it with an authentic cadence. Verse lines often end this way.

Plagal (IV–I): the "amen". F → C. It arrives without a leading tone, so it feels softer and warmer than V–I. Gospel, hymns and many rock endings use it, often after an authentic cadence as a tag.

Deceptive (V–vi): G7 → Am. Everything sets up I, then the bass steps up to vi instead. The surprise keeps the phrase going. Ballads use it to extend a chorus one more time.

Rock (♭VII–I): B♭ → C. Borrowed from Mixolydian. A whole step up into I, with no leading tone. It sounds confident rather than polite.

Aeolian (♭VI–♭VII–I): A♭ → B♭ → C. Two borrowed major chords climbing by whole steps into a major I. It's the big, triumphant ending of arena rock and game music.

Try it now: play a C–Am–F phrase and end it four ways: G7–C, G, G7–Am, then A♭–B♭–C. Notice how the same opening gets a different meaning each time.

Common mistake: calling any ending on I "authentic". F → C is plagal and B♭ → C is a rock cadence. The chord before the I decides the name.`,
    });
    I.fnLegend(s, { x: M, y: CONTENT_TOP, fns: ['T', 'PD', 'D', 'B'] });
    const cads = [
      { name: 'Authentic', num: 'V–I', chords: [['G7', 'V7', 'D'], ['C', 'I', 'T']], d: 'Full stop. Strongest when the melody also lands on 1.' },
      { name: 'Half', num: '…–V', chords: [['Dm', 'ii', 'PD'], ['G', 'V', 'D']], d: 'A comma. Ending on V leaves a question hanging.' },
      { name: 'Plagal', num: 'IV–I', chords: [['F', 'IV', 'PD'], ['C', 'I', 'T']], d: 'The amen. A softer arrival with no leading tone.' },
      { name: 'Deceptive', num: 'V–vi', chords: [['G7', 'V7', 'D'], ['Am', 'vi', 'T']], d: 'Promises I, lands on vi. Keeps the phrase going.' },
      { name: 'Rock', num: '♭VII–I', chords: [['B♭', '♭VII', 'B'], ['C', 'I', 'T']], d: 'Mixolydian arrival: a whole step up into I.' },
      { name: 'Aeolian', num: '♭VI–♭VII–I', chords: [['A♭', '♭VI', 'B'], ['B♭', '♭VII', 'B'], ['C', 'I', 'T']], d: 'The epic arrival: two borrowed chords climb to I.' },
    ];
    // verify the borrowed numerals against C minor
    const cmin = T.diatonicChords('C', 'minor', 3);
    for (const [nm, num] of [['A♭', '♭VI'], ['B♭', '♭VII']]) if (!cmin.find((c) => c.name === nm && c.numeral === num)) throw new Error(`${nm} is not ${num} of C minor`);
    const cw = (FULL - 0.6) / 3; const chh = 2.32; const top = CONTENT_TOP + 0.4;
    cads.forEach((c, i) => {
      const x = M + (i % 3) * (cw + 0.3); const y = top + Math.floor(i / 3) * (chh + 0.25);
      panel(pres, s, x, y, cw, chh);
      s.addText([
        { text: c.name, options: { bold: true, color: HEX.white, fontSize: 16 } },
        { text: `   ${c.num}`, options: { bold: true, color: HEX.pearl, fontSize: 14 } },
      ], { x: x + 0.22, y: y + 0.16, w: cw - 0.44, h: 0.34, margin: 0, valign: 'middle', isTextBox: true });
      I.progression(s, { x: x + 0.22, y: y + 0.6, w: cw - 0.44, h: 0.85, gap: 0.3, chords: c.chords.map(([name, numeral, fn]) => ({ name, numeral, fn })) });
      D.text(s, c.d, { x: x + 0.22, y: y + 1.58, w: cw - 0.44, h: 0.6, fontSize: 14 });
    });
  }

  // Progression templates
  {
    const s = D.slideOf(pres, {
      kicker: K, title: 'Progression templates',
      notes: `Most songs reuse a small set of progression templates. Learn them as numbers, not chord names, and you can play them in any key on the spot.

Two number systems are on this slide. Roman numerals (I, ii, IV...) show quality: upper case is major, lower case is minor. 簡譜 (jianpu) numbers are what Chinese-speaking musicians use: the chord is named by its scale degree, 1 to 7, and the quality is understood from the key. "6415" means vi–IV–I–V. Nashville numbers work the same way. When a bandmate says "4536251 in G", you should be able to play it without thinking.

The pop and rock templates:
• 1564 (I–V–vi–IV) and its rotation 6415 (vi–IV–I–V): the same four chords. Starting on vi makes it sound sadder.
• 1645 (I–vi–IV–V): the 1950s ballad progression.
• 145 (I–IV–V): blues, rock and roll, punk, country.
• 251 (ii–V–I): the jazz cadence, the strongest pull home.

The Mandopop and J-pop templates:
• 王道進行, the "royal road" (IV–V–iii–vi): starts away from home and never lands on I. That's the yearning sound of many choruses.
• 4536251 (IV–V–iii–vi–ii–V–I): the royal road continued by a circle of 5ths (vi–ii–V–I) until it finally resolves. It's a chorus workhorse.
• 卡農進行, the Canon (I–V–vi–iii–IV–I–IV–V): from Pachelbel's Canon. The bass walks down by steps, which makes it great for ballads.

Notice the colors. The royal road begins on predominant chords and ends on tonic vi, never on I. The Canon is mostly tonic and dominant, so it feels settled.

Try it now: play 4536251 in C (top row), then in G and D, saying the numbers aloud.`,
    });
    I.heading(s, '4536251 in C: the Mandopop chorus workhorse', M, CONTENT_TOP, 7.5);
    I.fnLegend(s, { x: 8.7, y: CONTENT_TOP + 0.04, fns: ['T', 'PD', 'D'] });
    const digits = '4536251';
    const ch = T.diatonicChords('C', 'major', 3);
    I.progression(s, { x: M, y: 1.98, w: FULL, h: 0.95, chords: [...digits].map((d) => ({ name: ch[d - 1].name, numeral: ch[d - 1].numeral, fn: FN_OF[d], sub: d })) });
    const tmpl = [
      ['Four-chord pop', '1564', 'Bright, anthemic'],
      ['Minor-start pop', '6415', 'Same chords, sadder'],
      ['50s ballad', '1645', 'Classic, nostalgic'],
      ['Three-chord rock', '145', 'Blues, punk, country'],
      ['Jazz cadence (7ths)', '251', 'The strongest pull home'],
      ['Royal road 王道進行', '4536', 'Yearning, never on I'],
      ['4536251', '4536251', 'Royal road, resolved'],
      ['Canon 卡農進行', '15634145', 'Stepwise bass; ballads'],
    ];
    const rows = [['Template', 'Numerals', '簡譜', 'In C', 'Sound']];
    for (const [name, dg, feel] of tmpl) {
      const size = name.includes('7ths') ? 4 : 3;
      const chs = T.diatonicChords('C', 'major', size);
      const nums = [...dg].map((d) => chs[d - 1].numeral).join('–');
      rows.push([`**${name}**`, colorNumerals(nums), dg, digitsTo('C', dg, size), feel]);
    }
    D.table(s, rows, { x: M, y: 3.15, w: FULL, colW: [2.45, 2.75, 1.15, 2.45, 3.33], fontSize: 13, rowH: 0.37 });
  }

  // The blues
  {
    const s = D.slideOf(pres, {
      kicker: K, title: 'The blues: its own system',
      notes: `The blues follows its own harmonic rules, and it's worth knowing exactly where it breaks the ones in this part.

Every chord is a dominant 7. In A, the 12-bar uses A7, D7 and E7: I7, IV7 and V7. Classically, a dominant 7 is a tension chord that must resolve. In the blues, A7 is home. It sits at the end of the form and nobody expects it to go anywhere. The ♭7 is color, not tension. It comes from the blues melody, which uses the minor pentatonic (♭3 and ♭7) over major-ish chords.

The 12-bar map:
• Bars 1–4: I7. Bar 2 can be IV7 instead, the "quick change".
• Bars 5–6: IV7. Bars 7–8: back to I7.
• Bar 9: V7. Bar 10: IV7. Bar 11: I7. Bar 12: V7, the turnaround, which sends you back to bar 1.

Bar 10 is the other rule-breaker: V7 falls back to IV7, a "backwards" move from dominant to predominant that classical harmony avoids. In the blues it's the signature sound.

Minor blues uses i7, iv7 and V7 (Am7, Dm7, E7). The last four bars are often ♭VI7–V7–i7–V7 (F7–E7–Am7–E7). That ♭VI7 sliding down a half step to V7 is a great sound for slow blues and metal ballads alike.

Try it now: play the 12-bar in A with the quick change, counting bars out loud. Then solo over it with A minor pentatonic and notice how the C note (♭3 of A) fits even though A7 has C♯. That clash is the blues.

Common mistake: forcing function analysis onto the blues and calling A7 "the V of D". Inside a blues, A7 is just home.`,
    });
    const bars = [
      ['A7', 'bar 1'], ['A7', 'bar 2 · or D7'], ['A7', 'bar 3'], ['A7', 'bar 4'],
      ['D7', 'bar 5'], ['D7', 'bar 6'], ['A7', 'bar 7'], ['A7', 'bar 8'],
      ['E7', 'bar 9'], ['D7', 'bar 10 · V7→IV7'], ['A7', 'bar 11'], ['E7', 'bar 12 · turnaround'],
    ];
    const num = { A7: ['I7', 'T'], D7: ['IV7', 'PD'], E7: ['V7', 'D'] };
    // verify: D7 and E7 are the IV and V of A, all dominant 7ths
    const am = T.diatonicChords('A', 'major', 3);
    if (am[3].root !== 'D' || am[4].root !== 'E') throw new Error('blues roots');
    const gw = 7.6; const tg = 0.2; const tw = (gw - 3 * tg) / 4; const th = 0.98;
    bars.forEach(([c, sub], i) => {
      const x = M + (i % 4) * (tw + tg); const y = CONTENT_TOP + Math.floor(i / 4) * (th + 0.15);
      I.tile(s, { x, y, w: tw, h: th, top: c, bottom: num[c][0], role: roleOf(num[c][1]), sub, topSize: 18, bottomSize: 13, subSize: 11, outline: i === 1 || i === 9 ? HEX.pearl : undefined });
    });
    const my = CONTENT_TOP + 3 * (th + 0.15) + 0.12;
    I.heading(s, 'Minor blues in A, bars 9–12', M, my, gw);
    const amin = T.diatonicChords('A', 'minor', 3);
    I.progression(s, { x: M, y: my + 0.4, w: gw, h: 0.92, chords: [
      { name: `${amin[5].root}7`, numeral: '♭VI7', fn: 'B' }, { name: T.dominantOf('A'), numeral: 'V7', fn: 'D' },
      { name: 'Am7', numeral: 'i7', fn: 'T' }, { name: T.dominantOf('A'), numeral: 'V7', fn: 'D' },
    ] });
    const rx = 8.55; const rw = 12.73 - rx;
    D.card(s, { x: rx, y: CONTENT_TOP, w: rw, h: 2.05, title: 'Every chord is a dominant 7', body: 'The ♭7 is **color, not tension**. A7 is home: it ends the form and never has to resolve.', fontSize: 14 });
    D.card(s, { x: rx, y: CONTENT_TOP + 2.25, w: rw, h: 2.2, title: 'Where the rules bend', body: 'Bar 10: **V7 falls back to IV7**, a move classical harmony avoids. The ♭3 and ♭7 of the melody fit over all three chords.', fontSize: 14 });
    I.fnLegend(s, { x: rx, y: 6.18, fns: ['T', 'PD', 'D'], fontSize: 11 });
    I.fnLegend(s, { x: rx, y: 6.52, fns: ['B'], fontSize: 11 });
  }

  // Voice leading on the guitar
  {
    const s = D.slideOf(pres, {
      kicker: K, title: 'Voice leading on the guitar',
      notes: `Voice leading means treating each note of a chord as its own melody, a "voice", and moving each one as little as possible from chord to chord. Good voice leading is why a progression played by a pianist sounds smooth while the same progression in open chords can sound like four separate blocks.

On the guitar, the top three strings are the easiest place to practice it. The diagrams show I–vi–IV–V in G (G–Em–C–D) using the triad shape on the G, B and high e strings that sits closest to the previous one:
• G → Em: D moves up to E. G and B don't move at all.
• Em → C: B moves up a half step to C. E and G stay.
• C → D: there are no common tones (a step move), so all three voices move, each by three frets or less.
• D → G: D stays, F♯ rises to G and A rises to B.

The whole loop stays inside frets 5 to 9. You never jump the hand to a new position, and the top note forms its own little melody: B, B, C, A, B.

The three rules:
1. Keep common tones on the same string.
2. Move the other voices to the nearest chord tone, by step when possible.
3. When every voice must move (step root motion), move some up and some down rather than sliding the whole shape.

Try it now: play the tab slowly, then speed it up to strumming tempo. Then find the same loop in C (C–Am–F–G) on the same strings, starting from any C triad.

Common mistake: grabbing the "default" shape of each chord. The best voicing is the one closest to the chord before it, not the one you learned first.`,
    });
    const chords = [
      { name: 'G', num: 'I', root: 'G', fing: 'x.x.x.7.8.7', cap: 'Start: D, G, B' },
      { name: 'Em', num: 'vi', root: 'E', fing: 'x.x.x.9.8.7', cap: 'D → E. G and B stay.' },
      { name: 'C', num: 'IV', root: 'C', fing: 'x.x.x.9.8.8', cap: 'B → C. E and G stay.' },
      { name: 'D', num: 'V', root: 'D', fing: 'x.x.x.7.7.5', cap: 'All move 1–3 frets. Then D stays for G.' },
    ];
    const bw = 2.8; const gap = (FULL - 4 * bw) / 3;
    chords.forEach((c, i) => {
      const dots = T.fingering(c.fing).map((p) => {
        const pcv = T.pcAt(p.s, p.f);
        return { s: p.s, f: p.f, label: T.spellIn(c.root, pcv), role: T.role(T.semis(c.root, pcv)) };
      });
      I.chordBoard(s, { x: M + i * (bw + gap), y: CONTENT_TOP, w: bw, h: 1.45, name: c.name, sub: c.num, root: c.root, dots, from: 4, to: 10, showFing: false, caption: c.cap, fretNumbers: 'all' });
    });
    s.addText('The loop in tab, G major', { x: M, y: 4.55, w: 6.6, h: 0.28, fontSize: 12, color: HEX.muted, margin: 0, isTextBox: true });
    D.tab(s, { x: M, y: 5.02, w: 6.6, gap: 0.25, cols: ['3:7 2:8 1:7', '|', '3:9 2:8 1:7', '|', '3:9 2:8 1:8', '|', '3:7 2:7 1:5', '|', '3:7 2:8 1:7'], check: { root: 'G', scale: T.SCALES.major } });
    D.card(s, {
      x: 7.6, y: 4.55, w: 12.73 - 7.6, h: 2.3, title: 'Three rules',
      bullets: ['**Keep** common tones on the same string', '**Step**: move the rest to the nearest chord tone', '**Split** directions when every voice must move'],
      fontSize: 14, paraSpace: 6,
    });
  }

  // Worksheet
  {
    const roman = [
      ['G', ['C', 'D', 'Em', 'G']], ['D', ['Bm', 'G', 'A', 'D']], ['E♭', ['Fm', 'B♭', 'E♭']], ['A', ['A', 'F♯m', 'D', 'E']],
      ['E', ['C♯m', 'A', 'E', 'B']], ['F', ['Gm7', 'C7', 'Fmaj7']], ['B♭', ['Dm', 'Gm', 'Cm', 'F']],
    ];
    const fnQ = [['Em', 'D'], ['F♯m', 'A'], ['A°', 'B♭'], ['B7', 'E'], ['Em', 'G'], ['C', 'G'], ['G♯m', 'E'], ['Gm', 'F']];
    const fnItems = fnQ.map(([c, key]) => {
      const all = [...T.diatonicChords(key, 'major', 3), ...T.diatonicChords(key, 'major', 4)];
      const hit = all.find((x) => x.name === c);
      if (!hit) throw new Error(`${c} not in ${key}`);
      return [`${c} in ${key}`, `${hit.degree === 3 ? 'T (weak)' : FN_OF[hit.degree]} · ${hit.numeral}`];
    });
    const trans = [['1564', 'A', 3], ['6415', 'D', 3], ['4536', 'E', 3], ['1645', 'F', 3], ['251', 'B♭', 4], ['4536251', 'G', 3]];
    I.worksheet(pres, {
      part: 5, kicker: K, grid: 'row',
      intro: 'No guitar for these. Write the answers, then check the answer key and play every progression you got right.',
      groups: [
        { key: 'A', title: 'Roman numerals', instr: 'Name each chord in the key shown.', items: roman.map(([k, ch]) => [`${k}: ${ch.join('–')}`, numeralsIn(k, ch)]) },
        { key: 'B', title: 'Function', instr: 'T, PD or D? Give the numeral too.', items: fnItems },
        { key: 'C', title: 'Cadences', instr: 'Name the cadence. Key of C unless shown.', items: [
          ['G7 → C', 'Authentic (V7–I)'], ['F → C', 'Plagal (IV–I)'], ['Dm → G, phrase ends', 'Half (ii–V)'], ['G7 → Am', 'Deceptive (V7–vi)'],
          ['B♭ → C', 'Rock (♭VII–I)'], ['A♭ → B♭ → C', 'Aeolian (♭VI–♭VII–I)'], ['In G: D7 → Em', 'Deceptive (V7–vi)'],
        ] },
        { key: 'D', title: 'Numbers to chords', instr: 'Spell each template in the key.', items: trans.map(([dg, k, size]) => [`${dg} in ${k}${size === 4 ? ' (7ths)' : ''}`, digitsTo(k, dg, size)]) },
      ],
      notes: `Worksheet for Part 5. Work it without the guitar and without looking back at the slides, then check the answer key at the back of the deck.

Group A: Roman numerals. Find the key's scale, number the chord roots, then check each quality: upper case for major, lower case for minor, ° for diminished, and the 7th suffix if there is one. A fast check: in any major key, ii, iii and vi are the minor chords.

Group B: Function. Find the chord's numeral first, then its job: I, vi and iii are tonic (iii is a weak tonic), ii and IV are predominant, V and vii° are dominant. Write both, e.g. "PD · ii".

Group C: Cadences. Look only at the last two or three chords. The chord before the final one decides the name. A phrase that stops on V is a half cadence, whatever came before it.

Group D: Numbers to chords. Spell the major scale of the key, then build the chord on each degree. Remember the qualities: 1, 4 and 5 major; 2, 3 and 6 minor.

Scoring: at most one miss per group is a pass. If you miss two or more in a group, reread the matching slide and redo that group tomorrow. Then play every progression on the guitar. Your ear should agree with your pencil: a deceptive cadence should sound like a surprise.`,
    });
  }

  // Neck drills
  D.practice(pres, {
    kicker: K, title: 'Exercises on the neck',
    intro: 'Say the function or numeral out loud as you play each chord. Naming it is the exercise.',
    drills: [
      { name: 'Function loops', how: 'In C, G and A, build T–PD–D–T loops. Pick a different chord from each family every time: C–Dm–G–Am, Em–F–B°–C...', tempo: '70 bpm, 1 chord per bar', time: '6 min', done: '10 different loops in a row without stopping' },
      { name: 'Tritone around the circle', how: 'Play the G7 tritone (G str 4, B str 6) into C (5, 5). Then play C7\'s tritone into F, and keep going round the circle of 5ths.', tempo: '60 bpm, 2 beats each', time: '5 min', done: 'All 12 keys with no pause' },
      { name: 'Cadence ear test', how: 'Record 10 short phrases, each ending in a random cadence from this part. Next day, listen back and name each one.', tempo: 'Free', time: '10 min, twice a week', done: '9 of 10 named correctly' },
      { name: 'Voice-leading loops', how: 'Play I–vi–IV–V in G, C and D on strings 3-2-1 with the smallest moves. Then on strings 4-3-2.', tempo: '80 bpm, 2 beats each', time: '6 min', done: 'No chord change jumps more than 3 frets' },
    ],
    notes: `Four drills that turn this part into reflexes. Run them in order: about 25 minutes in total, or split them across two days.

1. Function loops. The goal is to stop thinking of progressions as fixed lists. Choose one chord from the tonic family, one from predominant, one from dominant, then end on a tonic. In C that gives dozens of combinations: C–F–G–C, Am–Dm–G–C, Em–F–B°–Am, and so on. Say "tonic, predominant, dominant, tonic" as you play. When C is easy, do G and A.

2. Tritone around the circle. Start with the two-note G7 tritone on the G and B strings (frets 4 and 6) and resolve it to frets 5 and 5. Now treat the C you landed on as the root of C7: its tritone is E and B♭. Find it near the same frets and resolve it to F. Keep going, falling a 5th each time, through all twelve keys. You're drilling the most important resolution in tonal music in every key.

3. Cadence ear test. Record ten phrases on your phone, each ending in a cadence picked at random: authentic, half, plagal, deceptive, rock, Aeolian. Don't label them. Listen back the next day and name each one. This is the skill that lets you predict where a song is going while you're jamming.

4. Voice-leading loops. Use the slide's G loop as your model, then find your own voicings in C and D. The rule is that no chord change may move your hand more than three frets. Then repeat on strings 4-3-2. If a change needs a jump, look for a closer inversion.`,
  });
}

module.exports = { build };
