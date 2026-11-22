// Theory Intensive · Part 0 · Start here (slides 1–3)
const D = require('../lib/draw');
const I = require('../lib/intensive');
const { HEX, M, CONTENT_TOP, section } = require('../lib/deck');

const K = 'Start here';

function build(pres) {
  section(pres, 'Start here');

  // 1 · Title
  {
    const s = pres.addSlide({ masterName: 'Title', sectionTitle: 'Start here' });
    s._title = 'Theory Intensive';
    s.addText('FRETBOARD FREEDOM · MUSIC THEORY FOR GUITAR', { placeholder: 'kicker' });
    s.addText('Theory Intensive', { placeholder: 'title' });
    s.addText('From the half step to modulation, chord–scale theory and song form. Taught on the neck, with exercises and an answer key.', { placeholder: 'body' });
    I.circleOfFifths(s, {
      cx: 10.65, cy: 3.75, r: 1.6, rMinor: 0.98, d: 0.54, dMinor: 0.44, rSig: 2.08,
      major: { F: 'third', C: 'fifth', G: 'root' }, minor: { Dm: 'third', Am: 'fifth', Em: 'fifth' },
    });
    s.addText('The key of C on the circle: I, IV and V side by side, ii, vi and iii inside them', { x: 8.45, y: 6.1, w: 4.4, h: 0.5, fontSize: 12, color: HEX.muted, align: 'center', valign: 'top', margin: 0, isTextBox: true });
    s.addNotes(`Welcome to the Theory Intensive.

This deck is a complete course in how music works, taught on the guitar. It doesn't assume you've seen any of the other Fretboard Freedom decks. It starts at the smallest unit, the half step, and ends with chromatic harmony, melodic line theory and song form. It's deliberately dense: every slide carries one idea, the notes carry the full explanation, and every part ends with exercises.

The diagram is a preview of where this goes. It's the circle of fifths, which you'll build yourself in Part 2. The colored circles are the key of C. Its three major chords (F, C, G) sit side by side on the outer ring, and its three minor chords (Dm, Am, Em) sit right inside them. The diminished chord, B°, is the only one not shown. By Part 5 you'll know why the chords are arranged that way, and why that arrangement explains which chords sound good together.

What you need:
• Your guitar, tuned, within reach the whole time. Every idea gets played the moment you read it.
• A pencil and paper, or a notes app, for the written exercises.
• A drone or looper for the ear work (any drone app, or a looped open string).

How long it takes: about nine weeks at one part per week, with 30 to 45 minutes a day of theory inside your normal practice. The four-week plan near the end is the fast track if you can give it more time.

Color code used everywhere: root red, 3rd amber, 5th blue, 7th purple, teal for an altered or flavor note, gray for everything else. Progression tiles add a second code for harmonic function, introduced in Part 5.`);
  }

  // 2 · How this intensive works
  {
    const s = D.slideOf(pres, {
      kicker: K, title: 'How this intensive works',
      notes: `Every slide in this deck is meant to be worked, not just read. Use the same four-step loop each time.

1. Read. Read the slide, then the notes. The notes hold the reasoning; the slide holds the picture you'll remember.
2. Play. Find the idea on the neck right away. If the slide shows an interval, play it. If it shows a progression, strum it. Theory that never reaches your hands stays abstract.
3. Sing. Sing what you just played: the root and the interval, the bass line of the progression, the target note of the line. Singing is the fastest way to connect sound to name. You don't need a good voice.
4. Write. When you reach the end of a part, do the written worksheet without looking back at the slides. Then check the answer key at the back of the deck.

Two kinds of exercises close every part:
• Exercises on paper are white, printable slides. Each question has a code (A1, B3...). The answers are in the answer key at the end, grouped by part. Score yourself. If you miss more than one question in a group, reread the slides for that group and redo it the next day.
• Exercises on the neck are drill cards with a tempo, a time budget and a "done when" test. They turn the paper knowledge into reflexes.

Pacing: one part per week is a solid pace. Spend the first half of the week on the slides and neck drills, and the second half on the worksheet and review. Don't move on until you pass the worksheet, which here means at most one miss per group. Theory compounds: Part 5 is impossible without Parts 1 to 4, and easy with them.

If you already know a topic, test yourself with the worksheet first. If you pass, skim that part and move on.`,
    });
    // Left: the loop
    const steps = [
      ['1', 'Read', 'The slide gives the picture, the notes give the reasoning.', 'root'],
      ['2', 'Play', 'Find it on the neck immediately, in two places.', 'third'],
      ['3', 'Sing', 'Sing what you played. Hear it before you name it.', 'fifth'],
      ['4', 'Write', 'Do the worksheet from memory, then check the key.', 'seventh'],
    ];
    const lx = M; const lw = 6.0; const rowH = 1.12;
    I.heading(s, 'The loop for every slide', lx, CONTENT_TOP, lw);
    steps.forEach(([n, t, b, role], i) => {
      const y = CONTENT_TOP + 0.5 + i * (rowH + 0.14);
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: lx, y, w: lw, h: rowH, rectRadius: 0.1, fill: { color: HEX.card }, line: { color: HEX.card, width: 0 } });
      D.badge(s, { x: lx + 0.25, y: y + (rowH - 0.56) / 2, d: 0.56, label: n, role });
      s.addText(t, { x: lx + 1.05, y: y + 0.14, w: 1.4, h: 0.4, fontSize: 20, bold: true, color: HEX.white, margin: 0, valign: 'middle', isTextBox: true });
      D.text(s, b, { x: lx + 1.05, y: y + 0.56, w: lw - 1.3, h: 0.46, fontSize: 14, color: HEX.text });
    });
    // Right: exercises + pacing
    const rx = M + lw + 0.4; const rw = 12.73 - rx;
    D.card(s, { x: rx, y: CONTENT_TOP, w: rw, h: 1.72, title: 'Exercises on paper', badge: 'A1', badgeRole: 'fifth', body: 'White, printable worksheets that end every part. Answers are in the **answer key** at the back, by part and question code.', fontSize: 14 });
    D.card(s, { x: rx, y: CONTENT_TOP + 1.92, w: rw, h: 1.72, title: 'Exercises on the neck', badge: '♩', badgeRole: 'third', body: 'Drill cards with a **tempo**, a **time budget** and a **done-when** test, so you know when to move on.', fontSize: 14 });
    D.card(s, { x: rx, y: CONTENT_TOP + 3.84, w: rw, h: 1.46, title: 'Pace: one part a week', titleColor: HEX.pearl, body: '30–45 min a day. Pass the worksheet (at most one miss per group) before the next part.', fontSize: 14 });
  }

  // 3 · The chain of ideas
  {
    const s = D.slideOf(pres, {
      kicker: K, title: 'The chain of ideas',
      notes: `Music theory is one chain of ideas, and each part of this deck is one link. Each link answers a question that the next link depends on.

1. Intervals. How far apart are two notes, and what does that distance sound like? Everything else is built from intervals, so we start here.
2. Scales and keys. Which seven notes belong together, and why those seven? This is where the circle of fifths comes from.
3. Chords. How are chords stacked from a scale, and how do you voice them on six strings, which is a different problem from voicing them on a piano?
4. Diatonic harmony. Which chords live in a key? Harmonize the scale and you get a family of seven chords.
5. Function. Why do some chords want to move to others? Tonic, predominant and dominant, the tritone, cadences. This is where theory starts explaining what you hear.
6. Chromatic harmony. How do you step outside the key on purpose? Secondary dominants, borrowed chords, substitutions, modulation.
7. Melody over harmony. Which notes should a line or solo land on, and how does it get there? Chord tones, tensions, targeting, superimposition.
8. Rhythm, phrase and form. How do beats group into bars, bars into phrases, and phrases into a song?
9. The capstone pulls everything into one analysis and one piece of your own.

The snake shape is the order to work in. If something later in the deck confuses you, the cause is almost always a weak link earlier in the chain. Go back one part, redo its worksheet, and the later idea usually clicks.`,
    });
    const parts = [
      ['1', 'Intervals', 'How far apart are two notes, and how does that sound?'],
      ['2', 'Scales & keys', 'Which 7 notes belong together, and why those?'],
      ['3', 'Chords', 'How are chords stacked and voiced on six strings?'],
      ['4', 'Diatonic harmony', 'Which chords live in a key?'],
      ['5', 'Function', 'Why do chords want to move where they move?'],
      ['6', 'Chromatic harmony', 'How do you color outside the key on purpose?'],
      ['7', 'Melody over harmony', 'Which notes should a line land on?'],
      ['8', 'Rhythm, phrase & form', 'How do bars become phrases, and phrases songs?'],
    ];
    const gap = 0.45; const bw = (12.13 - gap * 3) / 4; const bh = 1.85;
    const y1 = CONTENT_TOP + 0.05; const y2 = y1 + bh + 0.55;
    const roles = ['root', 'third', 'fifth', 'seventh', 'root', 'third', 'fifth', 'seventh'];
    const boxPos = (i) => (i < 4 ? { x: M + i * (bw + gap), y: y1 } : { x: M + (7 - i) * (bw + gap), y: y2 });
    parts.forEach(([n, t, q], i) => {
      const p = boxPos(i);
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: p.x, y: p.y, w: bw, h: bh, rectRadius: 0.1, fill: { color: HEX.card }, line: { color: HEX.card, width: 0 } });
      D.badge(s, { x: p.x + 0.22, y: p.y + 0.22, d: 0.46, label: n, role: roles[i] });
      s.addText(t, { x: p.x + 0.8, y: p.y + 0.2, w: bw - 0.95, h: 0.5, fontSize: 16, bold: true, color: HEX.white, margin: 0, valign: 'middle', isTextBox: true });
      D.text(s, q, { x: p.x + 0.22, y: p.y + 0.86, w: bw - 0.44, h: bh - 1.0, fontSize: 14, color: HEX.text });
    });
    // arrows: 1→2→3→4 right, 4↓5, 5→6→7→8 leftward
    for (let i = 0; i < 3; i++) { const p = boxPos(i); I.arrow(s, p.x + bw + 0.07, y1 + bh / 2, p.x + bw + gap - 0.07, y1 + bh / 2, { color: HEX.pearl }); }
    { const p = boxPos(3); I.arrow(s, p.x + bw / 2, y1 + bh + 0.07, p.x + bw / 2, y2 - 0.07, { color: HEX.pearl }); }
    for (let i = 4; i < 7; i++) { const p = boxPos(i); I.arrow(s, p.x - 0.07, y2 + bh / 2, p.x - gap + 0.07, y2 + bh / 2, { color: HEX.pearl }); }
    // capstone strip
    const cy = y2 + bh + 0.28;
    s.addText([
      { text: '9  Capstone  ', options: { bold: true, color: HEX.pearl, fontSize: 14 } },
      { text: 'One full analysis, one 16-bar piece of your own, a study plan, a cheat sheet and the answer key.', options: { color: HEX.muted, fontSize: 14 } },
    ], { x: M, y: cy, w: 12.13, h: 0.36, margin: 0, valign: 'middle', isTextBox: true });
  }
}

module.exports = { build };
