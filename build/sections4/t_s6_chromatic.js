// Theory Intensive · Part 6 · Chromatic harmony
const T = require('../lib/theory');
const D = require('../lib/draw');
const I = require('../lib/intensive');
const { HEX, M, CONTENT_TOP, section } = require('../lib/deck');

const K = '6 · Chromatic harmony';
const FULL = 12.13;
const FN_OF = { 1: 'T', 2: 'PD', 3: 'T', 4: 'PD', 5: 'D', 6: 'T', 7: 'D' };
const roleOf = (fn) => I.FN[fn].role;
const samePc = (a, b) => T.pc(a) === T.pc(b);
const inSet = (n, set) => set.some((x) => samePc(x, n));

function panel(pres, s, x, y, w, h, opts = {}) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.1, fill: { color: opts.fill || HEX.card }, line: opts.line ? { color: opts.line, width: 1.5 } : { color: opts.fill || HEX.card, width: 0 } });
}
// Notes of a chord symbol like 'A♭', 'Fm', 'G7', 'Dm7♭5', 'C♯°7'.
function chordNotes(sym) {
  const m = sym.match(/^([A-G][♯♭]?)(.*)$/);
  return T.spellChord(m[1], m[2]);
}

function build(pres) {
  section(pres, 'Chromatic harmony');
  const C3 = T.diatonicChords('C', 'major', 3);
  const CMAJ = T.spellScale('C', 'major');

  // Divider
  D.divider(pres, {
    num: 6,
    title: 'Chromatic harmony',
    subtitle: 'Step outside the key on purpose: borrowed leading tones, borrowed chords, substitutes and key changes, each with a reason.',
    outcomes: [
      'Build the secondary dominant of any diatonic chord',
      'Borrow chords from the parallel minor and name their color',
      'Swap a V7 for its tritone substitute',
      'Use diminished 7ths as passing chords',
      'Change key with a pivot chord, a direct lift or a new V7',
    ],
    notes: `Part 6: Chromatic harmony.

Everything in Parts 4 and 5 stayed inside one key: seven notes, seven chords. Real songs step outside all the time. A ballad suddenly hits an E7 in the key of C. A rock chorus lands on a huge B♭ chord. A jazz line slides down by half steps. A final chorus jumps up a whole step. None of that is random. Each chromatic chord has a reason, and the reason is almost always one of the ideas in this part.

The five tools:
• Secondary dominants: borrow the V7 of any chord in the key, so that chord briefly feels like home. One new note, the borrowed leading tone, does all the work.
• Modal interchange: borrow chords from the parallel minor (C minor inside C major). This is where the ♭VI, ♭VII and minor iv sounds come from.
• Tritone substitution: replace a V7 with the 7 chord a tritone away. It shares the same tritone, so it resolves the same way, with a chromatic bass.
• Diminished 7ths: symmetrical chords that act as rootless dominants and passing chords.
• Chromatic mediants and modulation: jumping to chords a 3rd away, and moving the whole key.

The test for every chromatic chord in this part is: which note is new, and where does it go? A chromatic note almost always resolves by a half step. If you can name the new note and its destination, you understand the chord.

The function colors continue. Teal is a secondary dominant, purple is borrowed or chromatic.`,
  });

  // Secondary dominants
  {
    const s = D.slideOf(pres, {
      kicker: K, title: 'Secondary dominants: V of anything',
      notes: `A secondary dominant is the V7 of a chord other than I. Put A7 in front of Dm and, for a moment, Dm sounds like a home chord. Then the progression moves on and C is home again. This is called tonicizing the Dm.

How to build one, in three steps:
1. Pick a target: any major or minor chord in the key. In C that's Dm, Em, F, G or Am.
2. Go up a perfect 5th from the target's root. For Dm that's A.
3. Make it a dominant 7: A7. That's "V7 of ii", written V7/ii.

The table lists all five in C. Each one brings at least one note from outside the key, and that note tells you how it works:
• V7/ii (A7) brings C♯, the leading tone of D.
• V7/iii (B7) brings D♯, the leading tone of E, plus F♯.
• V7/V (D7) brings F♯, the leading tone of G.
• V7/vi (E7) brings G♯, the leading tone of A.
• V7/IV (C7) is the exception. Its new note is B♭, its 7th. It doesn't add a leading tone, because F's leading tone, E, is already in the key. B♭ falls to A, the 3rd of F.

Why is there no V7/vii°? A diminished chord isn't stable enough to sound like a temporary home, so it can't be tonicized.

The progression at the top uses two in a row: C–E7–Am–A7–Dm–G7–C. Listen for the new notes. G♯ climbs to A, C♯ climbs to D.

Try it now: play C–Am–Dm–G7–C, then the version from the slide. Same skeleton, much more pull.

Common mistake: forgetting to resolve. A secondary dominant promises its target. If the next chord is something else, the listener feels the broken promise (which can be a deliberate effect).`,
    });
    const prog = [
      { name: 'C', numeral: 'I', fn: 'T' }, { name: T.dominantOf('A'), numeral: 'V7/vi', fn: 'SD' }, { name: 'Am', numeral: 'vi', fn: 'T' },
      { name: T.dominantOf('D'), numeral: 'V7/ii', fn: 'SD' }, { name: 'Dm', numeral: 'ii', fn: 'PD' }, { name: 'G7', numeral: 'V7', fn: 'D' }, { name: 'C', numeral: 'I', fn: 'T' },
    ];
    I.progression(s, { x: M, y: CONTENT_TOP, w: FULL, h: 1.05, chords: prog });
    I.fnLegend(s, { x: M, y: 2.82, fns: ['T', 'PD', 'D', 'SD'] });
    const rows = [['Target', 'Its V7', 'New note', 'What the new note does']];
    for (const d of [2, 3, 4, 5, 6]) {
      const c = C3[d - 1];
      const dom = T.dominantOf(c.root);
      const domNotes = chordNotes(dom);
      const fresh = domNotes.filter((n) => !CMAJ.includes(n));
      if (!fresh.length) throw new Error(`${dom} adds no new note`);
      const lt = T.noteBelow(c.root, 'm2');
      let what;
      if (fresh.includes(lt)) what = `**${lt} → ${c.root}**: leading tone of ${c.name}`;
      else what = `**${fresh[0]} → ${T.noteBelow(fresh[0], 'm2')}**: its 7th falls to the 3rd of ${c.name}`;
      rows.push([`{${roleOf(FN_OF[d])}:${c.numeral}}  ${c.name}`, `{blue:${dom}}  V7/${c.numeral}`, fresh.join(', '), what]);
    }
    D.table(s, rows, { x: M, y: 3.25, w: 7.95, colW: [1.35, 1.75, 1.2, 3.65], fontSize: 13, rowH: 0.5 });
    D.card(s, {
      x: 8.85, y: 3.25, w: 12.73 - 8.85, h: 3.0, title: 'Build one in three steps',
      body: ['**1**  Pick a target: a major or minor chord in the key', '**2**  Go up a 5th from its root', '**3**  Make that chord a dominant 7', '_No V7/vii°: a diminished chord can’t sound like home._'],
      fontSize: 14, paraSpace: 8,
    });
  }

  // Secondary dominants on the neck
  {
    const s = D.slideOf(pres, {
      kicker: K, title: 'Secondary dominants on the neck',
      notes: `Here are the two most common secondary dominants in C, in open position: A7 → Dm (V7/ii → ii) and E7 → Am (V7/vi → vi).

Look at the teal dot in each 7 chord. That's the borrowed note, and it is always the 3rd of the secondary dominant:
• In A7, C♯ sits on the B string at fret 2. In Dm, the B string plays D at fret 3. The borrowed note climbs one fret to the target's root.
• In E7, G♯ sits on the G string at fret 1. In Am, the G string plays A at fret 2. Again, one fret up to the root.

That half-step climb is the sound of a secondary dominant. When you hear a melody or inner voice rise by a half step into a chord's root, you're almost certainly hearing V7 of that chord.

The tab plays the whole move: C–A7–Dm–E7–Am. Strum it slowly and listen to the B and G strings. Then try singing the borrowed notes: C, C♯, D... G, G♯, A.

On the rest of the neck the same logic holds with any 7 chord shape. To build V7/x anywhere: find the target chord's root, go one fret down (that's the borrowed leading tone), and build a dominant 7 chord that has that note as its 3rd. On a 5th-string root A7 barre (x02020 moved up), the 3rd is on the B string. On a 6th-string root E7 barre, it's on the G string. Those are the same strings as in these open shapes.

Try it now: play C–A7–Dm in the open position, then as barre chords at the 8th and 5th frets (C at 8, A7 at 5 on the low E string, Dm at 5 on the A string). Find the borrowed C♯ in each shape.

Common mistake: playing A7 as a plain A major. The C♯ is there either way, but the G (♭7) is what makes A7 a dominant that has to resolve.`,
    });
    const bw = 2.53;
    const boards = [
      { x: M, name: 'A7', sub: 'V7/ii', root: 'A', fing: 'x02020', names: { 4: 'C♯' }, roles: { 4: 'blue' }, cap: 'C♯ is new: the 3rd of A7' },
      { x: M + bw + 0.5, name: 'Dm', sub: 'ii', root: 'D', fing: 'xx0231', cap: 'C♯ → D, one fret up the B string' },
      { x: M + 2 * bw + 1.48, name: 'E7', sub: 'V7/vi', root: 'E', fing: '020100', names: { 4: 'G♯' }, roles: { 4: 'blue' }, cap: 'G♯ is new: the 3rd of E7' },
      { x: M + 3 * bw + 1.98, name: 'Am', sub: 'vi', root: 'A', fing: 'x02210', cap: 'G♯ → A, one fret up the G string' },
    ];
    for (const b of boards) I.chordBoard(s, { ...b, y: CONTENT_TOP, w: bw, h: 1.55, from: 0, to: 4, caption: b.cap });
    for (const i of [0, 2]) {
      const x1 = boards[i].x + bw + 0.06; const ay = CONTENT_TOP + 0.42 + 0.78;
      I.arrow(s, x1, ay, x1 + 0.38, ay, { color: HEX.blue, width: 2 });
    }
    s.addText('The whole move in open chords: C – A7 – Dm – E7 – Am', { x: M, y: 4.72, w: 7.4, h: 0.28, fontSize: 12, color: HEX.muted, margin: 0, isTextBox: true });
    D.tab(s, {
      x: M, y: 5.2, w: 7.4, gap: 0.25,
      cols: ['5:3 4:2 3:0 2:1 1:0', '|', '5:0 4:2 3:0 2:2 1:0', '|', '4:0 3:2 2:3 1:1', '|', '6:0 5:2 4:0 3:1 2:0 1:0', '|', '5:0 4:2 3:2 2:1 1:0'],
      check: { root: 'C', scale: T.SCALES.major, extra: [1, 8] },
    });
    D.card(s, { x: 8.35, y: 4.72, w: 12.73 - 8.35, h: 2.13, title: 'Move it anywhere', body: 'Any 7 chord shape works. The **3rd of the secondary dominant** sits one fret below the target’s root.', fontSize: 14 });
  }

  // Dominant chains and ii–V of anything
  {
    const s = D.slideOf(pres, {
      kicker: K, title: 'Dominant chains and ii–V of anything',
      notes: `Once you can put a V7 in front of any chord, you can chain them. E7 is V7 of A. A7 is V7 of D. D7 is V7 of G. G7 is V7 of C. Play them in a row, E7–A7–D7–G7–C, and every chord resolves into the next one, which is itself unstable, until the chain finally lands on I.

On the circle of fifths the chain walks counterclockwise, one step at a time: E, A, D, G, C. That's why these chains sound so purposeful. It's the falling-5th root motion from Part 5, with a borrowed leading tone added at every step. Ragtime, swing, old pop songs and many Mandopop bridges use this sound. Start the chain further away (B7 or F♯7) for a longer journey home.

The second idea: if V7 can be borrowed, so can the ii–V in front of it. To tonicize any chord, put its ii and V7 in front of it.
• Minor target: use iiø7–V7. To tonicize Dm: Em7♭5–A7–Dm. The ø7 comes from D minor's own scale, where the ii chord is half-diminished.
• Major target: use ii7–V7. To tonicize G: Am7–D7–G.

In analysis you write these with slashes: iiø7/ii, V7/ii, ii. Read "/ii" as "of ii".

Try it now: play the chain E7–A7–D7–G7–C with open chords, then with 5th- and 6th-string barre shapes alternating so your hand barely moves (E7 at fret 7 on the A string, A7 at fret 5 on the low E string, and so on).

Common mistake: making every chord in the chain minor because "that's what the key says". In the key of C, A is normally Am. In a dominant chain it becomes A7 on purpose: the C♯ is the whole point.`,
    });
    I.heading(s, 'A dominant chain: each chord is V7 of the next', M, CONTENT_TOP, 7.6);
    const chain = ['A', 'D', 'G', 'C'].map((t) => T.dominantOf(t));
    if (chain.join(' ') !== 'E7 A7 D7 G7') throw new Error('chain');
    I.progression(s, { x: M, y: 1.98, w: 7.6, h: 1.05, chords: [
      { name: chain[0], numeral: 'V7/vi', fn: 'SD' }, { name: chain[1], numeral: 'V7/ii', fn: 'SD' }, { name: chain[2], numeral: 'V7/V', fn: 'SD' }, { name: chain[3], numeral: 'V7', fn: 'D' }, { name: 'C', numeral: 'I', fn: 'T' },
    ] });
    I.heading(s, 'ii–V of anything: put the target’s own ii–V in front of it', M, 3.42, 7.6);
    const dmin = T.diatonicChords('D', 'minor', 4)[1].name; // Em7♭5
    const gmaj = T.diatonicChords('G', 'major', 4)[1].name; // Am7
    const rowsIV = [
      { label: 'Minor target', sub: 'iiø7 – V7 – i', chords: [{ name: dmin, numeral: 'iiø7/ii', fn: 'PD' }, { name: T.dominantOf('D'), numeral: 'V7/ii', fn: 'SD' }, { name: 'Dm', numeral: 'ii', fn: 'PD' }] },
      { label: 'Major target', sub: 'ii7 – V7 – I', chords: [{ name: gmaj, numeral: 'ii7/V', fn: 'PD' }, { name: T.dominantOf('G'), numeral: 'V7/V', fn: 'SD' }, { name: 'G7', numeral: 'V7', fn: 'D' }] },
    ];
    rowsIV.forEach((r, i) => {
      const y = 3.85 + i * 1.3;
      s.addText([{ text: r.label, options: { bold: true, color: HEX.white, fontSize: 15, breakLine: true } }, { text: r.sub, options: { color: HEX.muted, fontSize: 13 } }], { x: M, y, w: 1.9, h: 1.05, margin: 0, valign: 'middle', isTextBox: true });
      I.progression(s, { x: M + 2.0, y, w: 5.6, h: 1.05, chords: r.chords });
    });
    I.fnLegend(s, { x: M, y: 6.58, fns: ['T', 'PD', 'D', 'SD'] });
    I.heading(s, 'On the circle', 8.75, CONTENT_TOP, 3.98);
    I.circleOfFifths(s, { cx: 10.68, cy: 3.95, r: 1.62, rMinor: 1.0, d: 0.56, dMinor: 0.44, sig: false, major: { E: 'blue', A: 'blue', D: 'blue', G: 'root', C: 'fifth' } });
    s.addText('Counterclockwise: E → A → D → G → C, each root down a 5th', { x: 8.6, y: 6.22, w: 4.13, h: 0.5, fontSize: 12, color: HEX.muted, align: 'center', margin: 0, isTextBox: true });
  }

  // Modal interchange
  {
    const s = D.slideOf(pres, {
      kicker: K, title: 'Modal interchange: borrowing from minor',
      notes: `C major and C minor share a tonic. Because they share a home, you can borrow chords from C minor while staying in C major. The borrowed chord brings a darker note, ♭3, ♭6 or ♭7, and the song still resolves to C major. This is called modal interchange, or borrowed chords.

The most famous move is the minor iv: C–F–Fm–C. Watch one note. The 3rd of F is A. In Fm it drops to A♭. Then it falls to G, the 5th of C. That falling half-step line, A–A♭–G, is the bittersweet sound of countless ballads. On the guitar, play F at the 1st fret, then lift one finger for Fm, and resolve to C.

The table lists the borrowed chords in C and what each one brings:
• iv (Fm): the ♭6, A♭. Bittersweet; the classic ballad cadence IV–iv–I.
• ♭VI (A♭): ♭6 and ♭3. Big, cinematic; ♭VI–♭VII–I lifts into a chorus.
• ♭VII (B♭): ♭7. Rock swagger; ♭VII–IV–I and ♭VII–I.
• ♭III (E♭): ♭3 and ♭7. Bold and bluesy.
• iiø7 (Dm7♭5): ♭6. A darker predominant that pulls hard to V7.
• v (Gm): ♭7. A soft dominant with no leading tone.
• i (Cm): ♭3. The sudden shadow: home itself turns minor for a moment.

Rock uses ♭VII and ♭VI so much that they sound native, but they still come from here.

Try it now: play C–Am–F–Fm–C, then C–A♭–B♭–C. Then write a four-chord progression in G that borrows one chord from G minor.

Common mistake: treating a borrowed chord as a key change. You only borrow a chord. If the next chords return to C major, the key never changed.`,
    });
    I.heading(s, 'The minor iv: IV → iv → I', M, CONTENT_TOP, 6.6);
    I.progression(s, { x: M, y: 1.98, w: 6.6, h: 1.05, chords: [{ name: 'C', numeral: 'I', fn: 'T' }, { name: 'F', numeral: 'IV', fn: 'PD' }, { name: 'Fm', numeral: 'iv', fn: 'B' }, { name: 'C', numeral: 'I', fn: 'T' }] });
    I.heading(s, 'One note falls by half steps', 7.75, CONTENT_TOP, 4.98);
    const line = [
      { n: T.spellChord('F', '')[1], sub: '3 of F', role: 'third' },
      { n: T.spellChord('F', 'm')[1], sub: '♭3 of Fm', role: 'seventh' },
      { n: T.spellChord('C', '')[2], sub: '5 of C', role: 'fifth' },
    ];
    if (line.map((l) => l.n).join(' ') !== 'A A♭ G') throw new Error('minor iv line');
    line.forEach((l, i) => {
      const x = 7.95 + i * 1.6;
      D.badge(s, { x, y: 2.02, d: 0.62, label: l.n, role: l.role, fontSize: 16 });
      s.addText(l.sub, { x: x - 0.3, y: 2.7, w: 1.22, h: 0.26, fontSize: 12, bold: true, color: HEX.muted, align: 'center', margin: 0, isTextBox: true });
      if (i < 2) I.arrow(s, x + 0.72, 2.33, x + 1.5, 2.33, { color: HEX.pearl, width: 1.75 });
    });
    const cm3 = T.diatonicChords('C', 'minor', 3); const cm4 = T.diatonicChords('C', 'minor', 4);
    const pick = (num) => [...cm3, ...cm4].find((c) => c.numeral === num);
    const uses = [
      ['iv', 'Bittersweet. IV–iv–I is the classic ballad cadence.'],
      ['♭VI', 'Big, cinematic. ♭VI–♭VII–I lifts into a chorus.'],
      ['♭VII', 'Rock swagger. ♭VII–IV–I, or ♭VII–I as a cadence.'],
      ['♭III', 'Bold and bluesy. Often I–♭III–IV.'],
      ['iiø7', 'A darker predominant that pulls hard to V7.'],
      ['v', 'A soft dominant: no leading tone.'],
      ['i', 'The sudden shadow: home turns minor for a moment.'],
    ];
    const rows = [['Borrowed', 'In C', 'Brings', 'Color and use']];
    for (const [num, use] of uses) {
      const c = pick(num);
      const fresh = c.notes.filter((n) => !CMAJ.includes(n));
      if (!fresh.length) throw new Error(`${c.name} borrows nothing`);
      rows.push([`{seventh:${c.numeral}}`, `**${c.name}**`, fresh.map((n) => `${n} (${T.INTERVAL[T.semis('C', T.pc(n))]})`).join(', '), use]);
    }
    D.table(s, rows, { x: M, y: 3.3, w: FULL, colW: [1.45, 1.6, 2.6, 6.48], fontSize: 13, rowH: 0.42 });
  }

  // Tritone substitution
  {
    const s = D.slideOf(pres, {
      kicker: K, title: 'Tritone substitution',
      notes: `Part 5 showed that V7 works because of its tritone: in G7, B and F. Here's the trick. The tritone splits the octave exactly in half, so the same two notes are also the tritone of another dominant 7: D♭7 (D♭ F A♭ C♭). In D♭7, F is the 3rd and C♭ (the same pitch as B) is the 7th. Same two notes, roles swapped.

Because the tritone is what resolves, D♭7 can replace G7 and still resolve to C. That's tritone substitution: replace any V7 with the 7 chord whose root is a tritone away. It's written subV7, or ♭II7 in C.

The diagrams show why guitarists love it. The G7 shell (3x34xx) and the D♭7 shell (x434xx) share the exact same top two notes: F on the D string at fret 3, B/C♭ on the G string at fret 4. Only the bass moves, from G on the low E string to D♭ on the A string.

What you gain:
• A chromatic bass line. Dm7–D♭7–Cmaj7 walks D, D♭, C, a smooth descent instead of the leap of a falling 5th.
• Free tension. Heard against G, D♭7's notes are the ♭5 (D♭) and ♭9 (A♭) of G. Altered dominant colors with no extra work.

The tab plays ii7–subV7–Imaj7 with 5th-string shells: x535, x434, x324. Every voice moves by a half step or stays put.

Try it now: play Dm7–G7–Cmaj7, then Dm7–D♭7–Cmaj7, back to back. The second one sounds jazzier and slicker.

Common mistake: substituting under a melody that sits on the plain 5th of G (D). Against D♭7, that D is a ♭9 and can clash. Check the melody note first.`,
    });
    const bw = 2.85;
    I.chordBoard(s, { x: M, y: CONTENT_TOP, w: bw, h: 1.4, name: 'G7', sub: 'V7', root: 'G', fing: '3x34xx', from: 2, to: 6 });
    I.chordBoard(s, { x: M + bw + 0.4, y: CONTENT_TOP, w: bw, h: 1.4, name: 'D♭7', sub: 'subV7', root: 'D♭', fing: 'x434xx', from: 2, to: 6 });
    const g7 = T.spellChord('G', '7'); const db7 = T.spellChord(T.noteAbove('G', 'd5'), '7');
    const shared = (n, other) => inSet(n, other);
    if (g7.filter((n) => shared(n, db7)).length !== 2) throw new Error('tritone sub shares two notes');
    [['G7', g7, db7], ['D♭7', db7, g7]].forEach(([nm, mine, other], k) => {
      const y = 4.45 + k * 0.72;
      s.addText(nm, { x: M, y, w: 0.85, h: 0.5, fontSize: 18, bold: true, color: HEX.white, margin: 0, valign: 'middle', isTextBox: true });
      I.noteRow(s, { x: M + 0.95, y, d: 0.5, gap: 0.16, notes: mine.map((n) => ({ label: n, role: shared(n, other) ? 'blue' : 'other' })) });
    });
    s.addText([
      { text: 'Teal = shared. ', options: { bold: true, color: HEX.blue, fontSize: 13 } },
      { text: 'B and C♭ are the same pitch. The roots are a tritone apart.', options: { color: HEX.muted, fontSize: 13 } },
    ], { x: M, y: 6.0, w: 6.1, h: 0.5, margin: 0, valign: 'top', isTextBox: true });
    const rx = 7.1; const rw = 12.73 - rx;
    I.heading(s, 'ii7 – subV7 – Imaj7: a chromatic bass', rx, CONTENT_TOP, rw);
    I.progression(s, { x: rx, y: 1.98, w: rw, h: 1.05, chords: [{ name: 'Dm7', numeral: 'ii7', fn: 'PD' }, { name: 'D♭7', numeral: 'subV7', fn: 'D' }, { name: 'Cmaj7', numeral: 'Imaj7', fn: 'T' }] });
    D.tab(s, { x: rx, y: 3.45, w: rw, gap: 0.25, cols: ['5:5 4:3 3:5', '', '|', '5:4 4:3 3:4', '', '|', '5:3 4:2 3:4', ''], check: { root: 'C', scale: T.SCALES.major, extra: [1] } });
    D.card(s, { x: rx, y: 4.95, w: rw, h: 1.9, title: 'When to use it', body: 'Over any V7. The bass slides by half steps, and against G you get the **♭9 (A♭)** and **♭5 (D♭)** for free.', fontSize: 14 });
  }

  // The diminished 7th
  {
    const s = D.slideOf(pres, {
      kicker: K, title: 'The diminished 7th',
      notes: `A diminished 7th chord is built entirely from minor 3rds: B, D, F, A♭, and the next minor 3rd up lands back on B. Because every gap is the same, the chord is symmetrical. Move it up three frets and you get the same four notes in a new order.

The fretboard shows one four-string shape (D string root, frets 3-4-3-4) repeated at frets 3, 6, 9 and 12. Every copy contains B, D, F and A♭. That's why the region labels give four names for one chord: F°7, A♭°7, B°7 and D°7 are the same notes, named after whichever note is in the bass.

Three consequences:
1. There are only three different dim7 chords. C°7 covers C, E♭, G♭, A. C♯°7 covers C♯, E, G, B♭. D°7 covers D, F, A♭, B. Those three account for all twelve notes.
2. A dim7 is a dominant 7♭9 without its root. G7♭9 is G B D F A♭. Remove the G and you have B°7. Since B°7 equals D°7, F°7 and A♭°7, the same shape can stand in for G7♭9, B♭7♭9, D♭7♭9 or E7♭9. One shape, four possible resolutions.
3. It makes a perfect passing chord. C–C♯°7–Dm7: the bass climbs by half steps, and C♯°7 is really A7♭9 without its root, a secondary dominant of Dm in disguise.

Try it now: play the shape at fret 3 and slide it up in 3-fret jumps. It sounds the same each time. Then play C (x32010), C♯°7 (x4535x), Dm7 (x5756x) and hear the bass rise.

Common mistake: confusing °7 with ø7. B°7 has a diminished 7th, A♭. Bm7♭5 (Bø7) has a minor 7th, A. The ø7 is the vii chord of the major key; the °7 comes from harmonic minor.`,
    });
    const dim = T.spellChord('B', '°7'); // B D F A♭
    const roleByPc = {}; const nameByPc = {};
    dim.forEach((n, i) => { roleByPc[T.pc(n)] = ['root', 'third', 'blue', 'seventh'][i]; nameByPc[T.pc(n)] = n; });
    const dots = []; const regions = [];
    for (const f of [3, 6, 9, 12]) {
      for (const [st, ff] of [[4, f], [3, f + 1], [2, f], [1, f + 1]]) {
        const p = T.pcAt(st, ff);
        if (!(p in nameByPc)) throw new Error('dim7 shape note');
        dots.push({ s: st, f: ff, label: nameByPc[p], role: roleByPc[p] });
      }
      regions.push({ from: f, to: f + 1, label: `${nameByPc[T.pcAt(4, f)]}°7` });
    }
    D.fretboard(s, { x: M, y: 2.05, w: FULL, h: 1.85, from: 2, to: 13, dots, regions, dotSize: 0.4, title: 'dim7' });
    const bw = (FULL - 0.6) / 3; const by = 4.6; const bh = 2.25;
    D.card(s, { x: M, y: by, w: bw, h: bh, title: 'Only three dim7 chords', body: 'Minor 3rds stack back to the root, so four names share one chord. **C°7, C♯°7 and D°7** cover all 12 notes.', fontSize: 14 });
    const g7b9 = T.spellChord('G', '7♭9');
    if (g7b9.slice(1).join(' ') !== dim.join(' ')) throw new Error('B°7 = G7♭9 without root');
    D.card(s, { x: M + bw + 0.3, y: by, w: bw, h: bh, title: 'A rootless V7♭9', body: `B°7 = G7♭9 (${g7b9.join(' ')}) without the G. One shape can act as **four** different dominants.`, fontSize: 14 });
    const px = M + 2 * (bw + 0.3);
    panel(pres, s, px, by, bw, bh);
    s.addText('Passing chord', { x: px + 0.22, y: by + 0.2, w: bw - 0.44, h: 0.36, fontSize: 17, bold: true, color: HEX.white, margin: 0, valign: 'middle', isTextBox: true });
    I.progression(s, { x: px + 0.22, y: by + 0.7, w: bw - 0.44, h: 0.92, gap: 0.28, chords: [{ name: 'C', numeral: 'I', fn: 'T' }, { name: 'C♯°7', numeral: 'vii°7/ii', fn: 'SD' }, { name: 'Dm7', numeral: 'ii7', fn: 'PD' }] });
    D.text(s, 'Bass climbs **C → C♯ → D**. C♯°7 = A7♭9 without the A.', { x: px + 0.22, y: by + 1.72, w: bw - 0.44, h: 0.5, fontSize: 14 });
    if (T.spellChord('A', '7♭9').slice(1).join(' ') !== T.spellChord('C♯', '°7').join(' ')) throw new Error('C♯°7 = A7♭9 rootless');
  }

  // Chromatic mediants
  {
    const s = D.slideOf(pres, {
      kicker: K, title: 'Chromatic mediants',
      notes: `A mediant relationship means two chords whose roots are a 3rd apart. Diatonic mediants, C → Am or C → Em, share two notes and change quality, and they sound smooth. Chromatic mediants keep the same quality, major to major or minor to minor, which forces in notes from outside the key. They share only one note.

From C major there are four:
• ♭VI, C → A♭: C stays. E falls to E♭, G rises to A♭.
• ♭III, C → E♭: G stays. C falls to B♭, E falls to E♭.
• III, C → E: E stays. C falls to B, G rises to G♯.
• VI, C → A: E stays. C rises to C♯, G rises to A.

In every case one note holds like an anchor while the other two slide by a half or whole step. There's no dominant pull and no leading tone resolving. The whole harmonic world just shifts, like a lighting change in a film. That's why film composers use chromatic mediants for awe, mystery and heroism, and why they sound so striking in the middle of a pop song.

In minor, the dark version is minor chords a major 3rd apart: Em → Cm. In metal the power chord makes it even easier. E5 and C5 have no 3rds, so a riff can move by 3rds without any quality clash at all. E5–C5 is the backbone of countless riffs. In E minor C is diatonic (♭VI), but the same move feels just as heavy from E major.

Try it now: hold an open E chord, then play C, then back to E. Listen to the G♯ falling to G and the B rising to C, around the held E. Then try E–G♯–E (III) and E–C♯–E (VI) with barre chords.

Common mistake: expecting a chromatic mediant to resolve like a dominant. It doesn't pull anywhere. Use it for color, then return home or move on by step.`,
    });
    const pairs = [
      { t: '♭VI', b: 'A♭' }, { t: '♭III', b: 'E♭' }, { t: 'III', b: 'E' }, { t: 'VI', b: 'A' },
    ];
    const cNotes = T.spellChord('C', '');
    const cw = 3.75; const ch = 2.48; const gx = 0.3; const gy = 0.3;
    pairs.forEach((p, i) => {
      const x = M + (i % 2) * (cw + gx); const y = CONTENT_TOP + Math.floor(i / 2) * (ch + gy);
      panel(pres, s, x, y, cw, ch);
      const other = T.spellChord(p.b, '');
      // the target's root must be a 3rd from C
      const iv = T.intervalName('C', p.b);
      if (!/^[mM](3|6)$/.test(iv)) throw new Error(`${p.b} is not a mediant of C`);
      const keep = cNotes.filter((n) => inSet(n, other));
      if (keep.length !== 1) throw new Error(`C → ${p.b} should keep one note`);
      s.addText([{ text: p.t, options: { bold: true, color: HEX.seventh, fontSize: 17 } }, { text: `   C → ${p.b}`, options: { bold: true, color: HEX.white, fontSize: 17 } }], { x: x + 0.22, y: y + 0.16, w: cw - 0.44, h: 0.36, margin: 0, valign: 'middle', isTextBox: true });
      [['C', cNotes, other], [p.b, other, cNotes]].forEach(([nm, mine, oth], k) => {
        const ry = y + 0.66 + k * 0.58;
        s.addText(nm, { x: x + 0.22, y: ry, w: 0.7, h: 0.44, fontSize: 17, bold: true, color: HEX.white, margin: 0, valign: 'middle', isTextBox: true });
        I.noteRow(s, { x: x + 1.0, y: ry, d: 0.44, gap: 0.14, notes: mine.map((n) => ({ label: n, role: inSet(n, oth) ? 'blue' : 'other' })) });
      });
      // moves: each C note not kept goes to the nearest new note
      const fresh = other.filter((n) => !inSet(n, cNotes));
      const moves = cNotes.filter((n) => !inSet(n, other)).map((n) => {
        const best = fresh.slice().sort((a, b) => Math.min(T.mod12(T.pc(a) - T.pc(n)), T.mod12(T.pc(n) - T.pc(a))) - Math.min(T.mod12(T.pc(b) - T.pc(n)), T.mod12(T.pc(n) - T.pc(b))))[0];
        return `${n}→${best}`;
      });
      D.text(s, `Keeps **${keep[0]}** · ${moves.join(', ')}`, { x: x + 0.22, y: y + 1.94, w: cw - 0.44, h: 0.34, fontSize: 14 });
    });
    const rx = M + 2 * cw + gx + 0.35; const rw = 12.73 - rx;
    D.card(s, { x: rx, y: CONTENT_TOP, w: rw, h: 2.48, title: 'Why they sound cinematic', body: 'Same quality, roots a 3rd apart, **one shared note**. Two voices slide by a step: a lighting change, not a cadence.', fontSize: 14 });
    panel(pres, s, rx, CONTENT_TOP + ch + gy, rw, ch);
    s.addText('In minor and metal', { x: rx + 0.22, y: CONTENT_TOP + ch + gy + 0.16, w: rw - 0.44, h: 0.36, fontSize: 17, bold: true, color: HEX.white, margin: 0, valign: 'middle', isTextBox: true });
    const em = T.spellChord('E', 'm'); const cm = T.spellChord('C', 'm');
    if (em.filter((n) => inSet(n, cm)).length !== 1) throw new Error('Em–Cm common tone');
    const pw = (rw - 0.44 - 0.3) / 2; const py = CONTENT_TOP + ch + gy + 0.62;
    I.progression(s, { x: rx + 0.22, y: py, w: pw, h: 0.85, gap: 0.3, chords: [{ name: 'Em', numeral: 'i', fn: 'T' }, { name: 'Cm', numeral: '♭vi', fn: 'B' }] });
    I.progression(s, { x: rx + 0.22 + pw + 0.3, y: py, w: pw, h: 0.85, gap: 0.3, chords: [{ name: 'E5', numeral: 'i', fn: 'T' }, { name: 'C5', numeral: '♭VI', fn: 'B' }] });
    D.text(s, 'Em→Cm: dark, filmic. E5→C5: no 3rds, so any 3rd move fits.', { x: rx + 0.22, y: CONTENT_TOP + ch + gy + 1.6, w: rw - 0.44, h: 0.7, fontSize: 14 });
  }

  // Modulation
  {
    const s = D.slideOf(pres, {
      kicker: K, title: 'Modulation: changing key',
      notes: `Tonicization borrows a chord for a moment. Modulation moves home for real: after the change, the new tonic is where phrases end. There are three standard ways in.

1. Pivot chord. Find a chord that belongs to both keys and use it as the hinge. C major and G major share C, Em, G and Am. In the top row, Am arrives as vi of C, but the D7 after it reinterprets Am as ii of G, and the ii–V–I lands in G. Write it "vi = ii". Pivot modulations are smooth because nothing sounds foreign at the moment of the change. Closely related keys (one sharp or flat apart on the circle) have the most pivots.

2. Direct modulation. Just go. The last chorus jumps up a half or whole step with no preparation. Mandopop and Western pop ballads use this lift constantly for the final chorus: the same melody, suddenly higher and more intense. In the middle row, the chorus in C ends on I, then the last chorus restarts in D. Singers love it and hate it, since it pushes the range up. On the guitar it's just moving every shape two frets up, or putting a capo on.

3. Via the new key's V7. Land on the dominant of the new key and resolve to it. This can reach any key, even distant ones. In the bottom row, C goes to B♭7, the V7 of E♭, and E♭ becomes the new home. Two keys three flats apart, joined by one chord.

To confirm a modulation, look for a cadence in the new key. If the music returns to the old key right away, it was only a tonicization.

Try it now: play the pivot row, then sing a short phrase over the G section that ends on G. Your ear should accept G as home.

Common mistake: forgetting that the new key changes every numeral. After the pivot, D7 is V7, not "V7/V of C".`,
    });
    const rows = [
      { title: 'Pivot chord', body: 'A chord both keys share. Am is vi in C and ii in G.', chords: [
        { name: 'C', numeral: 'I', fn: 'T', sub: 'C major' }, { name: 'F', numeral: 'IV', fn: 'PD' }, { name: 'Am', numeral: 'vi = ii', fn: 'PD', sub: 'pivot', outline: HEX.pearl },
        { name: T.dominantOf('G'), numeral: 'V7', fn: 'D', sub: 'G major' }, { name: 'G', numeral: 'I', fn: 'T' }] },
      { title: 'Direct lift', body: 'Just jump, often up a half or whole step for the final chorus.', chords: [
        { name: 'F', numeral: 'IV', fn: 'PD' }, { name: 'G', numeral: 'V', fn: 'D' }, { name: 'C', numeral: 'I', fn: 'T', sub: 'chorus: C' },
        { name: 'G', numeral: 'IV', fn: 'PD', sub: 'final: D', outline: HEX.pearl }, { name: 'A', numeral: 'V', fn: 'D' }, { name: 'D', numeral: 'I', fn: 'T' }] },
      { title: 'Via the new V7', body: 'Land on the new key’s V7 first. Reaches distant keys.', chords: [
        { name: 'C', numeral: 'I', fn: 'T', sub: 'C major' }, { name: T.dominantOf('E♭'), numeral: 'V7', fn: 'D', sub: 'V7 of E♭', outline: HEX.pearl }, { name: 'E♭', numeral: 'I', fn: 'T', sub: 'E♭ major' },
        { name: 'A♭', numeral: 'IV', fn: 'PD' }, { name: T.dominantOf('E♭'), numeral: 'V7', fn: 'D' }, { name: 'E♭', numeral: 'I', fn: 'T' }] },
    ];
    // verify the pivot and the numerals in the new keys
    const inC = T.diatonicChords('C', 'major', 3); const inG = T.diatonicChords('G', 'major', 3);
    if (inC[5].name !== 'Am' || inG[1].name !== 'Am') throw new Error('pivot Am');
    const inD = T.diatonicChords('D', 'major', 3); const inEb = T.diatonicChords('E♭', 'major', 3);
    if (inD[3].name !== 'G' || inD[4].name !== 'A' || inEb[3].name !== 'A♭') throw new Error('direct/new-V7 numerals');
    const lw = 3.6; const rh = 1.6; const rg = 0.15;
    rows.forEach((r, i) => {
      const y = CONTENT_TOP + i * (rh + rg);
      D.card(s, { x: M, y, w: lw, h: rh, title: r.title, body: r.body, fontSize: 14, titleSize: 16 });
      I.progression(s, { x: M + lw + 0.3, y: y + 0.18, w: FULL - lw - 0.3, h: 1.24, chords: r.chords, subSize: 11 });
    });
  }

  // Worksheet
  {
    const secQ = [['ii', 'G'], ['vi', 'F'], ['V', 'D'], ['IV', 'A'], ['iii', 'C'], ['ii', 'E♭'], ['vi', 'B♭']];
    const secItems = secQ.map(([num, key]) => {
      const c = T.diatonicChords(key, 'major', 3).find((x) => x.numeral === num);
      return [`V7/${num} in ${key}`, `${T.dominantOf(c.root)} (→ ${c.name})`];
    });
    const borQ = [['♭VI', 'G'], ['iv', 'D'], ['♭VII', 'A'], ['♭III', 'E'], ['iiø7', 'C'], ['iv', 'F']];
    const borItems = borQ.map(([num, key]) => {
      const c = [...T.diatonicChords(key, 'minor', 3), ...T.diatonicChords(key, 'minor', 4)].find((x) => x.numeral === num);
      if (!c) throw new Error(`${num} in ${key} minor`);
      return [`${num} in ${key}`, c.name];
    });
    const subItems = ['G', 'A', 'D', 'E', 'B'].map((r) => {
      const d = T.spellChord(r, '7');
      return [`${r}7`, `${T.noteAbove(r, 'd5')}7 (shares ${d[1]}, ${d[3]})`];
    });
    I.worksheet(pres, {
      part: 6, kicker: K, grid: 'row',
      intro: 'Work on paper first, then play every answer and listen for the new note resolving by a half step.',
      groups: [
        { key: 'A', title: 'Secondary dominants', instr: 'Write the V7 and its target.', items: secItems },
        { key: 'B', title: 'Borrowed chords', instr: 'From the parallel minor.', items: borItems },
        { key: 'C', title: 'Tritone subs', instr: 'Name the subV7 and the two shared notes.', items: subItems },
        { key: 'D', title: 'Analyze', instr: 'Roman numerals, key of C.', items: [
          ['C–A7–Dm–G7–C', 'I–V7/ii–ii–V7–I'], ['C–E7–Am–F–Fm–C', 'I–V7/vi–vi–IV–iv–I'], ['C–A♭–B♭–C', 'I–♭VI–♭VII–I'],
          ['Dm7–D♭7–Cmaj7', 'ii7–subV7–Imaj7'], ['C–C♯°7–Dm7–G7', 'I–vii°7/ii–ii7–V7'], ['C–D7–G7–C', 'I–V7/V–V7–I'], ['C–E♭–F–C', 'I–♭III–IV–I'],
        ] },
      ],
      notes: `Worksheet for Part 6. As always, write first and check the answer key afterward.

Group A: Secondary dominants. Find the target chord in the key (for V7/vi in F, the vi chord is Dm), go up a perfect 5th from its root (A), and make it a dominant 7 (A7). Write the target too, so you can play the pair.

Group B: Borrowed chords. Think of the parallel minor: same root, minor key signature. ♭VI in G is the 6th chord of G minor, E♭. Watch the spelling: these chords usually need flats.

Group C: Tritone substitutes. The substitute root is a diminished 5th above the original root: G → D♭, A → E♭. Name the shared notes, the 3rd and 7th of the original chord. Check that they're the 7th and 3rd of the substitute.

Group D: Analysis. Mark each chord: is it in C major? If not, ask the two questions from this part. Is it a 7 chord a 5th above the next chord (a secondary dominant)? Is it from C minor (borrowed)? Answers like vii°7/ii and subV7 are both standard. ♭II7 is an accepted alternative for subV7.

Scoring: at most one miss per group. For each miss, write down which note was outside the key and where it should resolve. That's usually where the mistake was.

Then play all seven progressions in group D. They are the vocabulary of this part.`,
    });
  }

  // Neck drills
  D.practice(pres, {
    kicker: K, title: 'Exercises on the neck',
    intro: 'Name the borrowed note out loud and follow it with your ear to where it resolves.',
    drills: [
      { name: 'Target practice', how: 'In C, play each target (Dm, Em, F, G, Am) with its V7 in front: A7–Dm, B7–Em... Then in G and A.', tempo: '70 bpm, 2 beats each', time: '6 min', done: 'All five targets in 3 keys, no pauses' },
      { name: 'Minor-iv cadence', how: 'Loop I–IV–iv–I in G, C, D and E. Voice the 3rd of IV on the top strings and let it fall: E–E♭–D in G.', tempo: '60 bpm, 1 bar each', time: '5 min', done: 'You can sing the falling line while you play' },
      { name: 'Tritone-sub shells', how: 'Play ii7–V7–Imaj7, then ii7–subV7–Imaj7, with 5th-string shells (x535, x434, x324) in C, F, B♭ and E♭.', tempo: '60 bpm, 1 bar each', time: '6 min', done: 'You switch V7 ↔ subV7 on cue' },
      { name: 'Dim7 passing chords', how: 'Slide the xx3434 shape up in 3-fret jumps. Then play C–C♯°7–Dm7 and G–G♯°7–Am, and find more.', tempo: '70 bpm, 2 beats each', time: '5 min', done: 'Any whole-step pair gets a dim7 between' },
    ],
    notes: `Four drills for chromatic harmony. Aim for about 20 minutes, and keep the tempo slow enough to hear every resolution.

1. Target practice. Secondary dominants have to become automatic. In C, go through the targets in order: A7–Dm, B7–Em, C7–F, D7–G, E7–Am. Say "five of two, five of three..." as you go. Then do G (E7–Am, F♯7–Bm, G7–C, A7–D, B7–Em) and A. Use open chords first, then barre shapes.

2. Minor-iv cadence. Play I–IV–iv–I and voice-lead the 3rd of the IV chord down by half steps. In G, that's C (with E), Cm (E♭), G (D). Use triads on the top three strings so the falling line sits on top where you can hear it. Sing it. This one cadence covers a huge number of ballad endings.

3. Tritone-sub shells. The three 5th-string shells from the slide (x535 for Dm7, x434 for D♭7, x324 for Cmaj7) are movable. Play the normal ii–V–I first (the V7 shell is 3x34 on the low E string), then the substituted one. Have a friend or a random timer call "sub" or "normal" each time round.

4. Dim7 passing chords. First, prove the symmetry to yourself by sliding the dim7 shape up three frets at a time. Then use it. Any two chords whose roots are a whole step apart (C to Dm, G to Am, F to G) can have a dim7 squeezed between them, built on the note in the middle. The bass climbs by half steps. Find five examples of your own.`,
  });
}

module.exports = { build };
