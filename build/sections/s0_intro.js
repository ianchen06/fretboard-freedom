// Part 0 · Start here (slides 1–4)
const T = require('../lib/theory');
const D = require('../lib/draw');
const { HEX, M, CONTENT_TOP, section, content } = require('../lib/deck');

function build(pres) {
  section(pres, 'Start here');

  // 1 · Title
  {
    const s = pres.addSlide({ masterName: 'Title', sectionTitle: 'Start here' });
    s._title = 'Fretboard Freedom';
    s.addText('A PRACTICE SYSTEM FOR ELECTRIC GUITAR', { placeholder: 'kicker' });
    s.addText('Fretboard Freedom', { placeholder: 'title' });
    s.addText('Know every note. Get out of box 1. Solo with intent. Jam with anyone.', { placeholder: 'body' });
    // Box 1 of A minor pentatonic, colored by function
    D.fretboard(s, {
      x: 8.35, y: 2.3, w: 4.4, h: 2.6, from: 4, to: 9, root: 'A', title: 'title',
      dots: D.dotsFor(T.pentBox('A', 1), { root: 'A', label: 'interval' }), fretNumbers: 'all', dotSize: 0.44,
    });
    s.addText('A minor pentatonic · box 1', { x: 8.65, y: 5.3, w: 4.1, h: 0.3, fontSize: 12, color: HEX.muted, align: 'center', margin: 0, isTextBox: true });
    D.legend(s, { x: 8.75, y: 5.75, roles: ['root', 'third', 'fifth', 'seventh', 'other'], names: { root: 'Root', third: '♭3', fifth: '5', seventh: '♭7', other: '4' }, gap: 0.2, fontSize: 11 });
    s.addNotes(`Welcome to Fretboard Freedom.

This deck is a self-study course. It's for a player who already knows open chords, power chords and the first minor pentatonic box, and wants to use the whole neck: find any note fast, solo with intent rather than running patterns, and jam with other people.

How to use it:
• Work through the parts in order. Each one builds on the one before.
• Every part ends with a "Practice this" slide. Those drills are the real course. The other slides explain why the drills work.
• The speaker notes (where you're reading this) hold the full explanation for every slide. Read them the first time through.
• Keep your guitar in your hands while you read. Play every diagram as you meet it.

The diagram on this slide is the box you already know, A minor pentatonic box 1 at the 5th fret. The colors on it are the system used throughout the deck: red marks the root, amber the 3rd, blue the 5th, purple the 7th. Even this familiar box contains a hidden A minor chord. By the end of the deck you'll see chord tones like that inside every shape, anywhere on the neck.`);
  }

  // 2 · Roadmap
  {
    const s = content(pres, {
      kicker: 'Start here', title: 'From box 1 to the whole neck',
      notes: `The roadmap. Seven parts take you from "I know box 1" to "I can play anywhere on the neck and jam with anyone."

1. Theory you actually need. Just enough to explain everything that follows: the 12 notes, intervals, how scales and chords are built, and how chords work together in a key. No reading music required.
2. Mapping the fretboard. How the neck is laid out, why it repeats, and the landmarks that make it learnable.
3. Finding any note. Drills that turn the map into reflexes, plus interval shapes so you can find notes relative to a root.
4. Breaking out of box 1. CAGED, all five pentatonic boxes, horizontal and diagonal playing, 3-notes-per-string, triads and arpeggios.
5. Soloing. Note choice (target notes), phrasing, technique, licks, and which scale goes over which chord, for blues, rock and metal.
6. Rhythm and jamming. Finding the key, roles, comping, the common jam progressions, and etiquette.
7. Practice plan. Daily routines, a 12-week roadmap, a practice log and cheat sheets.

Don't wait to finish one part before touching the next. A good weekly mix: some fretboard/note work every day (parts 2–4), plus some soloing and jamming every day (parts 5–6). The 12-week plan at the end spells this out.`,
    });
    s._title = 'roadmap';
    const parts = [
      ['1', 'Theory you actually need', 'Notes, intervals, scales, chords, keys'],
      ['2', 'Map the fretboard', 'Landmarks, octaves, the G–B shift'],
      ['3', 'Find any note', 'Drills until it’s a reflex'],
      ['4', 'Break out of box 1', 'CAGED, 5 boxes, triads, arpeggios'],
      ['5', 'Solo', 'Target notes, phrasing, licks, modes'],
      ['6', 'Jam', 'Keys, roles, progressions, etiquette'],
      ['7', 'Practice plan', 'Routines, roadmap, log, cheat sheets'],
    ];
    const roles = ['root', 'third', 'fifth', 'seventh', 'blue', 'root', 'third'];
    const x0 = M; const step = 12.13 / 7; const lineY = 3.05;
    s.addShape(pres.shapes.LINE, { x: x0 + step / 2, y: lineY, w: step * 6, h: 0, line: { color: HEX.line, width: 3 } });
    parts.forEach(([n, title, sub], i) => {
      const cx = x0 + step * i + step / 2;
      D.badge(s, { x: cx - 0.36, y: lineY - 0.36, d: 0.72, label: n, role: roles[i], fontSize: 22 });
      s.addText(title, { x: cx - step / 2 + 0.06, y: lineY + 0.6, w: step - 0.12, h: 0.75, fontSize: 15, bold: true, color: HEX.white, align: 'center', valign: 'top', margin: 0, isTextBox: true });
      s.addText(sub, { x: cx - step / 2 + 0.08, y: lineY + 1.35, w: step - 0.16, h: 0.9, fontSize: 12, color: HEX.muted, align: 'center', valign: 'top', margin: 0, isTextBox: true });
    });
    // you are here
    s.addText([{ text: 'YOU ARE HERE  ', options: { bold: true, color: HEX.pearl, fontSize: 12, charSpacing: 2 } }, { text: 'open chords, power chords, pentatonic box 1', options: { color: HEX.text, fontSize: 13 } }], { x: M, y: 1.65, w: 8, h: 0.35, margin: 0, isTextBox: true });
    s.addShape(pres.shapes.LINE, { x: x0 + step / 2, y: 2.05, w: 0, h: 0.55, line: { color: HEX.pearl, width: 1.5, endArrowType: 'triangle' } });
    D.card(s, { x: M, y: 5.55, w: 12.13, h: 1.05, body: '**Goal:** play anywhere on the neck in any key, know what every note is doing against the chord, and hold your own in a blues, rock or metal jam.', fontSize: 15, pad: 0.25 });
  }

  // 3 · How to read this deck
  {
    const s = content(pres, {
      kicker: 'Start here', title: 'How to read this deck',
      notes: `Three conventions run through every slide.

1. The color code. Every dot is colored by its job relative to the root (the "home" note of the chord or key):
• Red: the root. Home base. Phrases that end here sound finished.
• Amber: the 3rd. Major 3rd (happy) or minor 3rd (sad). It's the note that tells the listener major or minor.
• Blue: the 5th. Strong and stable. Power chords are root + 5th.
• Purple: the 7th. The ♭7 gives blues and rock their bite. The major 7th sounds dreamy.
• Teal: the special note. Either the blues scale's ♭5 "blue note", or the one note that gives a mode its flavor.
• Light gray: other scale notes (2nd, 4th, 6th). They pass between the colored notes.
On plain note maps (no key), naturals are pearl and sharps/flats are dark.

2. Fretboard diagrams are drawn as if you laid the guitar across your lap and looked down at it. High e is at the TOP and low E at the BOTTOM, the same as tab. The nut and open strings are on the left, and fret numbers sit underneath.

3. Tab: six lines, high e on top. Numbers are frets. Read left to right. Symbols: h = hammer-on, p = pull-off, b = bend (7b9 means fret 7 and bend up to the pitch of fret 9), r = release, / and \\ = slide up or down, ~ = vibrato.

The example: an open A minor chord shown both ways. Its notes are A (root), C (♭3) and E (5th). Notice how the diagram and the tab show the same thing.`,
    });
    s._title = 'How to read this deck';
    // color code list
    const rows = [
      ['root', 'R', 'Root', 'Home. Phrases that end here sound resolved.'],
      ['third', '3', '3rd (♭3 or 3)', 'Decides major vs. minor: the emotional note.'],
      ['fifth', '5', '5th', 'Strong and stable. Power chord = R + 5.'],
      ['seventh', '7', '7th (♭7 or 7)', 'The ♭7 is the bite in blues and rock.'],
      ['blue', '♭5', 'Special note', 'Blue note (♭5) or a mode’s flavor note.'],
      ['other', '4', 'Other scale note', '2nd, 4th, 6th: notes that move between the colored ones.'],
    ];
    rows.forEach(([role, lab, name, desc], i) => {
      const y = CONTENT_TOP + 0.1 + i * 0.78;
      D.badge(s, { x: M, y, d: 0.5, label: lab, role });
      s.addText(name, { x: M + 0.7, y: y - 0.04, w: 5, h: 0.3, fontSize: 16, bold: true, color: HEX.white, margin: 0, isTextBox: true });
      s.addText(desc, { x: M + 0.7, y: y + 0.26, w: 5.2, h: 0.3, fontSize: 13, color: HEX.muted, margin: 0, isTextBox: true });
    });
    // orientation diagram: open A minor chord
    const fx = 7.2;
    s.addText('Fretboard diagram', { x: fx, y: CONTENT_TOP, w: 5.5, h: 0.3, fontSize: 14, bold: true, color: HEX.pearl, margin: 0, isTextBox: true });
    D.fretboard(s, {
      x: fx, y: CONTENT_TOP + 0.5, w: 5.5, h: 2.0, from: 0, to: 5, root: 'A', title: 'How to read',
      dots: D.dotsFor(T.fingering('x02210'), { root: 'A', label: 'note' }), dotSize: 0.32,
    });
    s.addText('high e on top · low E at the bottom · nut on the left', { x: fx, y: CONTENT_TOP + 2.85, w: 5.5, h: 0.28, fontSize: 12, color: HEX.muted, margin: 0, isTextBox: true });
    s.addText('Same chord as tab', { x: fx, y: CONTENT_TOP + 3.35, w: 5.5, h: 0.3, fontSize: 14, bold: true, color: HEX.pearl, margin: 0, isTextBox: true });
    D.tab(s, { x: fx, y: CONTENT_TOP + 3.85, w: 3.2, gap: 0.24, cols: ['', '1:0 2:1 3:2 4:2 5:0', '', '5:0', '4:2', '3:2', '2:1', '1:0'], check: { root: 'A', scale: T.CHORDS.min } });
    const sym = [['h', 'hammer-on'], ['p', 'pull-off'], ['b', 'bend'], ['r', 'release'], ['/ \\', 'slide'], ['~', 'vibrato']];
    sym.forEach(([k, v], i) => {
      const cx = 10.62 + Math.floor(i / 3) * 1.22; const cy = CONTENT_TOP + 3.78 + (i % 3) * 0.42;
      s.addText([{ text: k, options: { bold: true, color: HEX.pearl } }, { text: `  ${v}`, options: { color: HEX.muted } }], { x: cx, y: cy, w: 1.2, h: 0.3, fontSize: 12, margin: 0, valign: 'middle', isTextBox: true });
    });
  }

  // 4 · How to practice
  {
    const s = content(pres, {
      kicker: 'Start here', title: 'How to practice so it actually sticks',
      notes: `Six habits make the difference between practicing for years without improving and improving every month.

1. Slow is fast. Your hands learn exactly what you repeat, mistakes included. Play at a tempo where you make no mistakes, even if it feels embarrassingly slow. Speed is a side effect of clean repetitions.

2. Metronome, always. Start drills around 60 bpm. After 3 clean passes in a row, add 4–5 bpm. If you make a mistake, drop back 10 bpm. Write your tempos in the practice log so you can see progress.

3. Short and daily. 20–30 focused minutes every day beats a 3-hour Sunday. Memory consolidates during sleep, so daily repetition wins.

4. Say it out loud. When you play a note, say its name ("A… C… D…") or its interval ("root… flat 3… 4…"). Naming forces your brain to know the note rather than just the shape. It's the single biggest accelerator for fretboard knowledge.

5. Record yourself weekly. One minute on your phone is enough. Listen back for timing, bend pitch and dead notes. You'll hear things you can't hear while playing.

6. Always end with music. End every session improvising over a backing track, using what you practiced that day. Drills build skills, and making music is how those skills get into your actual playing.

Bonus: stop while it's still fun. Ending on a good note makes you want to pick the guitar up tomorrow.`,
    });
    s._title = 'How to practice';
    const tips = [
      ['Slow is fast', 'Practice at a tempo you can play **perfectly**. Speed comes from clean repetitions, not from forcing it.'],
      ['Metronome, always', 'Start at **60 bpm**. After 3 clean passes add 4–5 bpm. After a mistake, drop back 10.'],
      ['Short and daily', '**20–30 minutes every day** beats 3 hours on Sunday. Memory locks in overnight.'],
      ['Say it out loud', 'Name every note or interval as you play it. Naming turns shapes into **knowledge**.'],
      ['Record yourself weekly', 'One minute on your phone. Listen for **timing, bend pitch** and dead notes.'],
      ['Always end with music', 'Finish by **improvising over a backing track** with what you practiced today.'],
    ];
    const roles = ['root', 'third', 'fifth', 'seventh', 'blue', 'root'];
    const w = (12.13 - 0.3 * 2) / 3; const h = 2.35;
    tips.forEach(([t, b], i) => {
      const x = M + (i % 3) * (w + 0.3); const y = CONTENT_TOP + 0.1 + Math.floor(i / 3) * (h + 0.3);
      D.card(s, { x, y, w, h, title: t, badge: String(i + 1), badgeRole: roles[i], body: b, fontSize: 17, titleSize: 18 });
    });
  }
}

module.exports = { build };
