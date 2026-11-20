// Level 2 · Part 0 · Start here (slides 1–3)
const T = require('../lib/theory');
const D = require('../lib/draw');
const { HEX, M, CONTENT_TOP, section, content } = require('../lib/deck');

const MINOR = T.SCALES.minor;

// Position 1 of A natural minor: pentatonic box 1 plus the 2nd (B) and ♭6 (F) inside frets 4–8.
function position1() {
  const pent = new Set(T.pentBox('A', 1).map((p) => `${p.s}:${p.f}`));
  return T.positions(T.pcsOf('A', MINOR), { from: 4, to: 8 })
    .filter((p) => pent.has(`${p.s}:${p.f}`) || [2, 8].includes(T.semis('A', T.pcAt(p.s, p.f))));
}

function build(pres) {
  section(pres, 'Start here');

  // 1 · Title
  {
    const s = pres.addSlide({ masterName: 'Title', sectionTitle: 'Start here' });
    s._title = 'Fretboard Freedom · Level 2';
    s.addText('LEVEL 2 · A PRACTICE SYSTEM FOR ELECTRIC GUITAR', { placeholder: 'kicker' });
    s.addText('Fretboard Freedom', { placeholder: 'title' });
    s.addText('Rhythm, the whole scale, chord tones everywhere, trained ears, new tunings and real songs.', { placeholder: 'body' });
    const pos = position1();
    D.fretboard(s, {
      x: 8.35, y: 2.3, w: 4.4, h: 2.6, from: 4, to: 9, root: 'A', title: 'title',
      dots: D.dotsFor(pos, { root: 'A', label: 'interval', ring: (p, sm) => sm === 2 || sm === 8, roleOf: (sm) => (sm === 2 || sm === 8 ? 'other' : T.role(sm)) }),
      dotSize: 0.42,
    });
    s.addText('Position 1: pentatonic box 1 + the 2 and ♭6 (rings)', { x: 8.35, y: 5.3, w: 4.4, h: 0.3, fontSize: 12, color: HEX.muted, align: 'center', margin: 0, isTextBox: true });
    s.addNotes(`Welcome to Level 2.

Level 1 gave you the map: every note on the neck, the five pentatonic boxes, CAGED, top-string triads, the blues scale, target notes, three modes and the common jam forms. Level 2 is about fluency, which means turning that map into music in any key, any feel and any tuning.

The diagram on this slide shows the idea behind the whole deck. It's pentatonic box 1, the shape you already know, plus two extra notes (the rings): B, the 2nd, and F, the ♭6. Those two notes turn the 5-note pentatonic into the full 7-note A natural minor scale. Every mode, every harmony line and every chord in a key comes from those 7 notes.

How Level 2 is organized:
• Seven parts. Parts 1–6 each end with a "Practice this" slide; Part 7 holds your plan, log and cheat sheets.
• Same color code as Level 1: red root, amber 3rd, blue 5th, purple 7th, teal for the special or flavor note, gray for other scale notes.
• New tools: rhythm grids, which show timing without standard notation, and tuning-aware diagrams for Drop D and lower tunings.
• Speaker notes hold the full explanations. Read them the first time through, with your guitar in your hands.

Don't rush. Level 2 material takes months to absorb, not days. The 12-week plan at the end gives you a schedule, and the practice log helps you track it.`);
  }

  // 2 · From Level 1 to Level 2
  {
    const s = D.slideOf(pres, {
      kicker: 'Start here', title: 'From Level 1 to Level 2',
      notes: `Where you are, and where Level 2 takes you.

From Level 1 you should be able to name any note on the E and A strings quickly, find any note with octave shapes, play the five A minor pentatonic boxes and link them, see the chord shape inside each box, play top-string triads, solo over a 12-bar using target notes, and hold your own in a basic jam. If some of that is still shaky, that's normal. Keep the Level 1 note-finder warm-up in your routine while you work through Level 2.

The seven parts of Level 2:
1. Rhythm and time feel. The most important part. Great players sound great because of where they put notes, not only which notes. You'll learn to count, read rhythm grids, play triplets, swing, syncopate, handle odd meters and lock with a drummer.
2. The major scale everywhere, and the modes. Five positions and seven 3-notes-per-string patterns, so the full scale covers the whole neck, plus all seven modes.
3. Chord tones everywhere. Triads on every string set, 7th-chord arpeggios in every position, guide tones and approach notes. This is the bridge from licks to real chord-change soloing.
4. Chords beyond triads. Sus, add9, 6, 9, 13, 7♯9, diminished, slash chords, and power-chord variations for distortion.
5. Ear training. Hear intervals, chord qualities and progressions, and transcribe.
6. Tunings and the metal toolkit. Drop D, E♭, D standard, Drop C, Phrygian dominant, diminished ideas, chromatic riffing, harmony lines and muting.
7. Songs, harmony and your plan. Song form, the Nashville number system, borrowed chords, key changes, a 12-week roadmap, a practice log and cheat sheets.`,
    });
    D.card(s, {
      x: M, y: CONTENT_TOP + 0.05, w: 4.6, h: 4.45, title: 'Level 1 gave you', titleColor: HEX.pearl,
      bullets: ['Every note on E and A, octave shapes everywhere', '5 pentatonic boxes, linked', 'CAGED in A and the chord inside each box', 'Top-string triads, basic arpeggios', 'Blues scale, target notes, 12-bar soloing', 'Three modes and the common jam forms'],
      fontSize: 15, paraSpace: 10,
    });
    const parts = [
      ['1', 'Rhythm and time feel', 'Counting, triplets, swing, syncopation, odd meters, the drummer', 'root'],
      ['2', 'The major scale everywhere', '5 positions, 7 three-note patterns, all 7 modes', 'third'],
      ['3', 'Chord tones everywhere', 'Triads on every string set, 7th arpeggios, guide tones', 'fifth'],
      ['4', 'Chords beyond triads', 'Sus, add9, 6, 9, 13, 7♯9, dim, slash chords', 'seventh'],
      ['5', 'Ear training', 'Intervals, chord qualities, progressions, transcription', 'blue'],
      ['6', 'Tunings and metal', 'Drop D to Drop C, Phrygian dominant, harmony lines', 'root'],
      ['7', 'Songs, harmony, your plan', 'Form, Nashville numbers, borrowed chords, 12 weeks', 'third'],
    ];
    const x0 = 5.6; const rowH = 0.74;
    parts.forEach(([n, t, sub, role], i) => {
      const y = CONTENT_TOP + 0.05 + i * rowH;
      D.badge(s, { x: x0, y: y + 0.06, d: 0.5, label: n, role, fontSize: 16 });
      s.addText(t, { x: x0 + 0.7, y, w: 6.4, h: 0.32, fontSize: 16, bold: true, color: HEX.white, margin: 0, valign: 'middle', isTextBox: true });
      s.addText(sub, { x: x0 + 0.7, y: y + 0.32, w: 6.4, h: 0.3, fontSize: 13, color: HEX.muted, margin: 0, valign: 'top', isTextBox: true });
    });
  }

  // 3 · New tools in this deck
  {
    const s = D.slideOf(pres, {
      kicker: 'Start here', title: 'New tools in this deck',
      notes: `Three new kinds of diagram appear in Level 2.

1. Rhythm grids. Time runs left to right. Each beat is a column split into equal cells: 2 cells for 8th notes, 3 for triplets, 4 for 16th notes. The count is printed under every cell ("1 e & a"), and colored bars are the notes you play. A bar's length is how long the note lasts. Heavy lines mark beats, and the lightest lines mark subdivisions. A ">" above a note is an accent (play it harder). A dashed outline is a ghost note: a muted, percussive "chk" rather than a pitched note.

The example is one bar of 8th notes with a push: notes on 1, the "&" of 1, and 2, then a note on the "&" of 2 held through beat 3, then the "&" of 3, a ghost strum on 4, and the "&" of 4. Clap it while counting out loud. Holding a note across the beat like that is syncopation, and Part 1 is built on it.

2. Tuning labels. When a diagram isn't in standard tuning, its string names change and the tuning name sits above it. The example is Drop D: only the low string changes (E down to D), so the three lowest open strings make a D5 power chord, and one finger barring frets 0, 2, 5 or 7 across them plays D5, E5, G5 or A5.

3. Targets and approach notes. Filled dots are target chord tones, the notes your phrase is aiming at. Ringed dots are approach or passing notes: the notes you move through to get there. In the example, C♯ (the 3rd of A) is the target, and the ring one fret below it, C, approaches it chromatically.`,
    });
    const colW = (12.13 - 0.6) / 3;
    const cx = (i) => M + i * (colW + 0.3);
    // rhythm grid
    s.addText('Rhythm grid', { x: cx(0), y: CONTENT_TOP, w: colW, h: 0.32, fontSize: 16, bold: true, color: HEX.pearl, margin: 0, isTextBox: true });
    D.rhythm(s, {
      x: cx(0), y: CONTENT_TOP + 0.5, w: colW, beats: 4, sub: 2,
      rows: [{ notes: [{ at: 0, len: 1 }, { at: 1, len: 1 }, { at: 2, len: 1 }, { at: 3, len: 2, accent: true, role: 'third' }, { at: 5, len: 1 }, { at: 6, len: 1, ghost: true, text: 'x' }, { at: 7, len: 1 }] }],
    });
    D.text(s, ['Time runs left to right. Bar length = how long the note lasts.', '**>** accent · dashed **x** = ghost note (muted strum).'], { x: cx(0), y: CONTENT_TOP + 1.65, w: colW, h: 1.2, fontSize: 14, paraSpace: 6 });
    // tuning label
    s.addText('Tuning label: Drop D', { x: cx(1), y: CONTENT_TOP, w: colW, h: 0.32, fontSize: 16, bold: true, color: HEX.pearl, margin: 0, isTextBox: true });
    D.fretboard(s, {
      x: cx(1), y: CONTENT_TOP + 0.5, w: colW, h: 1.7, from: 0, to: 7, tuning: T.TUNINGS.dropD, root: 'D', title: 'Drop D tool',
      dots: [{ s: 6, f: 0, label: 'D', role: 'root' }, { s: 5, f: 0, label: 'A', role: 'fifth' }, { s: 4, f: 0, label: 'D', role: 'root' }],
      dotSize: 0.26,
    });
    D.text(s, ['Low string tuned down to **D**. The three low open strings are a **D5** power chord.'], { x: cx(1), y: CONTENT_TOP + 2.5, w: colW, h: 0.8, fontSize: 14 });
    // targets and approach notes
    s.addText('Targets and approach notes', { x: cx(2), y: CONTENT_TOP, w: colW, h: 0.32, fontSize: 16, bold: true, color: HEX.pearl, margin: 0, isTextBox: true });
    D.fretboard(s, {
      x: cx(2), y: CONTENT_TOP + 0.5, w: colW, h: 1.7, from: 3, to: 7, root: 'A', title: 'Approach tool',
      dots: [{ s: 5, f: 3, label: 'C', role: 'third', ring: true, noRoleCheck: true }, { s: 5, f: 4, label: 'C♯', role: 'third' }, { s: 6, f: 5, label: 'A', role: 'root' }, { s: 5, f: 7, label: 'E', role: 'fifth' }],
      dotSize: 0.3,
    });
    D.text(s, ['**Filled** = target chord tone. **Ring** = approach or passing note.', 'Here C slides up a half step into C♯, the 3rd of A.'], { x: cx(2), y: CONTENT_TOP + 2.5, w: colW, h: 1.2, fontSize: 14, paraSpace: 6 });
    D.card(s, { x: M, y: 5.35, w: 12.13, h: 1.4, title: 'Same color code as Level 1', body: 'Root {root:red} · 3rd {third:amber} · 5th {fifth:blue} · 7th {seventh:purple} · special or flavor note {blue:teal} · other scale notes gray. Learn to see what each note does against the chord, not just where it sits.', fontSize: 15 });
  }
}

module.exports = { build };
