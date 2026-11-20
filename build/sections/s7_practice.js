// Part 7 · Practice plan & reference (slides 73–81)
const T = require('../lib/theory');
const D = require('../lib/draw');
const { HEX, M, CONTENT_TOP, section } = require('../lib/deck');

const KICK = '7 · Practice plan & reference';
const SHEET = 'Cheat sheet';

// ---------- local helpers ----------
// Proportional time bar: one colored segment per activity, details underneath.
function timeBar(pres, slide, { x, y, w, h, segs }) {
  const total = segs.reduce((a, s) => a + s.min, 0);
  let cx = x;
  segs.forEach((sg) => {
    const sw = (w * sg.min) / total;
    const st = D.roleStyle(sg.role);
    slide.addShape(pres.shapes.RECTANGLE, { x: cx, y, w: sw - 0.05, h, fill: { color: st.fill }, line: { color: st.fill, width: 0 } });
    slide.addText([{ text: sg.name, options: { bold: true, breakLine: true } }, { text: `${sg.min} min`, options: {} }], { x: cx + 0.08, y, w: sw - 0.18, h, fontSize: 13, color: st.text, valign: 'middle', margin: 0, isTextBox: true });
    slide.addText(sg.detail, { x: cx, y: y + h + 0.08, w: sw - 0.12, h: 0.85, fontSize: 11, color: HEX.muted, valign: 'top', margin: 0, isTextBox: true });
    cx += sw;
  });
}

// Printable log grid with visible borders (the shared table helper uses very faint borders on light slides).
function logTable(slide, rows, { x, y, w, colW, rowH }) {
  const data = rows.map((row, ri) => row.map((cell, ci) => ({
    text: cell,
    options: {
      fill: { color: ri === 0 ? 'E4E4E7' : 'FFFFFF' }, color: '18181B', fontSize: ri === 0 ? 12 : 13, bold: ri === 0 || ci === 0,
      align: ci === 0 ? 'left' : 'center', valign: 'middle', margin: [3, 6, 3, 6], border: { type: 'solid', color: 'A1A1AA', pt: 0.75 },
    },
  })));
  slide.addTable(data, { x, y, w, colW, rowH, fontFace: 'Arial', autoPage: false });
}

function checkbox(pres, slide, x, y, label) {
  slide.addShape(pres.shapes.RECTANGLE, { x, y: y + 0.04, w: 0.24, h: 0.24, fill: { color: 'FFFFFF' }, line: { color: '52525B', width: 1.25 } });
  slide.addText(label, { x: x + 0.38, y: y - 0.04, w: 2.6, h: 0.55, fontSize: 14, color: HEX.lightText, valign: 'top', margin: 0, isTextBox: true });
}

function sub(slide, str, x, y, w, light = true, size = 14) {
  slide.addText(str, { x, y, w, h: 0.3, fontSize: size, bold: true, color: light ? HEX.lightText : HEX.pearl, margin: 0, valign: 'middle', isTextBox: true });
}

function build(pres) {
  section(pres, 'Practice plan & reference');

  // 73 · Divider
  D.divider(pres, {
    num: 7, title: 'Practice plan & reference',
    subtitle: 'Knowledge becomes skill only through repetition. Here are the routine, the 12-week plan, the log and the pages to keep on your music stand.',
    outcomes: [
      'Run a focused 30- or 60-minute session',
      'Follow a 12-week plan with clear milestones',
      'Track your tempos and progress every week',
      'Review everything from four printable cheat sheets',
    ],
    notes: `Part 7: the practice plan and the reference pages.

Everything up to here is knowledge. This part turns it into a routine you can actually follow, day after day, for the next three months.

What's in this part:
• Daily routines for 30 and 60 minutes. Both follow the same order: warm-up, fretboard and note work, shapes and technique, then music (soloing and jamming). The order matters: do the brain-heavy work while you're fresh and finish with the fun part so you want to come back tomorrow.
• A 12-week roadmap split into three 4-week blocks, each with a clear milestone. Milestones are concrete and testable ("name any note on the E and A strings in under 2 seconds"), so you always know whether you're ready to move on.
• A printable practice log. Print one per week. Tick the days, write your starting and best tempos, and check off milestones. Watching tempos climb week by week is surprisingly motivating, and the log shows you honestly what you've been skipping.
• Four cheat sheets designed to print on white: the fretboard map with octave shapes, CAGED in A with all five pentatonic boxes, intervals with chords in a key and progressions, and which scale to use over which chord.

A word on consistency: 12 weeks of 30 minutes a day is about 42 hours of focused practice. That's enough to transform how you see the neck, as long as the minutes are focused. Phone in another room, metronome on, log open.`,
  });

  // 74 · Daily routines
  {
    const s = D.slideOf(pres, {
      kicker: KICK, title: 'Daily routines: 30 or 60 minutes',
      notes: `Pick the routine that fits your day. A short session every day beats a long one twice a week.

The 30-minute routine:
• Warm-up (3 min): the chromatic 1-2-3-4 exercise across all strings, then a few slow bends to pitch. Just enough to get the hands moving.
• Note finder (5 min): the Part 3 drills. Do "one note everywhere" with a new note each day, plus one lap of the circle of fourths on one string.
• Shapes (10 min): rotate through the Part 4 drills. Monday and Thursday, link the pentatonic boxes. Tuesday and Friday, chain triads and CAGED shapes. Wednesday and Saturday, play along one string and do diagonal runs.
• Solo and jam (12 min): put on a backing track and apply today's shape. Use the Part 5 soloing drills: the 3-note solo, the target-note chorus, the one-string solo.

The 60-minute routine adds dedicated technique and rhythm time:
• Warm-up (5): chromatics plus bends and vibrato.
• Note finder (10): one note everywhere, string by string, circle of fourths, interval shapes.
• Shapes and theory (15): boxes, CAGED, triads, 3-notes-per-string, and that week's theory topic.
• Technique and licks (10): bends in tune, legato, alternate picking with the metronome ladder, and one new lick a week.
• Rhythm and jam (15): the shuffle form, riffs, triad comping on the looper, then improvising over a backing track.
• Record and log (5): record one minute, listen back, and write down tempos and notes in the log.

Sunday can be a free day: just play songs and jam. Music is the point of all this.`,
    });
    sub(s, '30 minutes', M, CONTENT_TOP, 4, false, 16);
    timeBar(pres, s, {
      x: M, y: CONTENT_TOP + 0.4, w: 12.13, h: 0.8, segs: [
        { name: 'Warm-up', min: 3, role: 'other', detail: 'Chromatic 1-2-3-4, slow bends' },
        { name: 'Note finder', min: 5, role: 'root', detail: 'One note everywhere + circle of fourths' },
        { name: 'Shapes', min: 10, role: 'third', detail: 'Rotate: linking the boxes · chaining triads and CAGED · one-string and diagonal runs' },
        { name: 'Solo & jam', min: 12, role: 'fifth', detail: 'Backing track: 3-note solo, target-note chorus, one-string solo' },
      ],
    });
    sub(s, '60 minutes', M, CONTENT_TOP + 2.35, 4, false, 16);
    timeBar(pres, s, {
      x: M, y: CONTENT_TOP + 2.75, w: 12.13, h: 0.8, segs: [
        { name: 'Warm-up', min: 5, role: 'other', detail: 'Chromatics, bends, vibrato' },
        { name: 'Note finder', min: 10, role: 'root', detail: 'One note everywhere, string by string, interval shapes' },
        { name: 'Shapes & theory', min: 15, role: 'third', detail: 'Boxes, CAGED, triads, 3-notes-per-string + this week’s theory topic' },
        { name: 'Technique & licks', min: 10, role: 'seventh', detail: 'Bends in tune, legato, metronome ladder, one new lick' },
        { name: 'Rhythm & jam', min: 15, role: 'fifth', detail: 'Shuffle form, riffs, looper comping, backing track' },
        { name: 'Record & log', min: 5, role: 'blue', detail: '1-minute recording, write tempos' },
      ],
    });
    D.text(s, 'Same order every day: **fretboard first** while your brain is fresh, **music last** so you end on fun.', { x: M, y: 6.35, w: 12.13, h: 0.4, fontSize: 15 });
  }

  // 75 · 12-week roadmap
  {
    const s = D.slideOf(pres, {
      kicker: KICK, title: 'The 12-week roadmap',
      notes: `Three 4-week blocks, each ending with a milestone you can test. If you hit a milestone early, move on. If not, repeat the block's final week. There's no prize for rushing.

Weeks 1–4: Map the neck and escape box 1.
• Part 1 theory: the 12 notes, intervals, the major scale and chords in a key.
• Part 2: natural notes on the low E and A strings, octave shapes and the G–B shift.
• Part 3 drills: one note everywhere and string by string, every day.
• Part 4: pentatonic boxes 1 and 2, linked together. Part 6: the 12-bar shuffle in A.
Milestone: name any note on the E or A string in under 2 seconds, and play boxes 1–2 linked at 80 bpm.

Weeks 5–8: Connect the whole neck.
• All five pentatonic boxes and CAGED in A, and how they lock together (Part 4).
• Triads on the top three strings, plus arpeggios.
• Target notes: land on the 3rds of A7, D7 and E7 in a 12-bar (Part 5).
• Bends in tune, vibrato, and the major pentatonic.
Milestone: any note on any string in under 2 seconds, and a 12-bar solo that lands on chord tones at every change.

Weeks 9–12: Speak the language.
• 3-notes-per-string shapes, natural and harmonic minor.
• Modes over vamps: Dorian, Mixolydian, Phrygian.
• Learn 4 new licks (one per week), review all 10, and transcribe one short solo by ear.
• Part 6: finding keys, the rock progressions and metal riffs.
Milestone: improvise three choruses over a backing track in any key, and jam with another player (or play along with three songs).

Keep the daily note finder running all 12 weeks. It's the foundation everything else rests on.`,
    });
    const blocks = [
      { title: 'Weeks 1–4 · Map & escape', role: 'root', items: ['Part 1 theory: notes, intervals, major scale', 'Part 2: E and A string notes, octave shapes', 'Part 3: one note everywhere, string by string', 'Boxes 1–2 linked; 12-bar shuffle in A'], ms: 'Any note on E or A in under 2 s. Boxes 1–2 linked at 80 bpm.' },
      { title: 'Weeks 5–8 · Connect the neck', role: 'third', items: ['All 5 boxes + CAGED in A', 'Triads on the top 3 strings; arpeggios', 'Target the 3rds of A7, D7, E7', 'Bends in tune, vibrato, major pentatonic'], ms: 'Any note, any string in under 2 s. A 12-bar solo that lands on the changes.' },
      { title: 'Weeks 9–12 · Speak the language', role: 'fifth', items: ['3-notes-per-string; natural & harmonic minor', 'Dorian, Mixolydian, Phrygian over vamps', '4 new licks; review all 10; transcribe a solo', 'Keys, rock progressions, metal riffs'], ms: '3 choruses over any backing track, any key. Jam with another player.' },
    ];
    // week timeline
    const tl = CONTENT_TOP + 0.25; const step = 12.13 / 12;
    s.addShape(pres.shapes.LINE, { x: M + step / 2, y: tl, w: step * 11, h: 0, line: { color: HEX.line, width: 2.5 } });
    for (let wk = 0; wk < 12; wk++) {
      D.badge(s, { x: M + step * wk + step / 2 - 0.22, y: tl - 0.22, d: 0.44, label: String(wk + 1), role: blocks[Math.floor(wk / 4)].role, fontSize: 13 });
    }
    const cw = (12.13 - 0.3 * 2) / 3; const cy = CONTENT_TOP + 0.75; const ch = 6.85 - cy;
    blocks.forEach((b, i) => {
      const x = M + i * (cw + 0.3);
      D.card(s, { x, y: cy, w: cw, h: ch, title: b.title, badge: String(i + 1), badgeRole: b.role, titleSize: 16, bullets: b.items, fontSize: 14 });
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x + 0.18, y: cy + ch - 1.38, w: cw - 0.36, h: 1.2, rectRadius: 0.08, fill: { color: HEX.card2 }, line: { color: HEX.card2, width: 0 } });
      s.addText([{ text: 'MILESTONE', options: { bold: true, color: HEX.pearl, fontSize: 11, charSpacing: 2, breakLine: true } }, { text: b.ms, options: { color: HEX.white, fontSize: 14 } }], { x: x + 0.32, y: cy + ch - 1.3, w: cw - 0.64, h: 1.05, valign: 'top', margin: 0, isTextBox: true });
    });
  }

  // 76 · Practice log (light, printable)
  {
    const s = D.slideOf(pres, {
      kicker: KICK, title: 'Practice log: one page per week', light: true,
      notes: `Print this page once a week (or copy the grid into a notebook).

How to use it:
• Write the week and one focus for the week at the top, for example "box 3 + target notes over E7."
• Each day, tick the drills you did, or write the minutes.
• Start bpm is the tempo where you could play the drill cleanly on Monday. Best bpm is the fastest clean tempo you reached by the end of the week. Clean means three passes in a row with no mistakes. Next week's start bpm is usually a few clicks below this week's best, and that's normal.
• The minutes row at the bottom keeps you honest about consistency.
• Tick a milestone when you can do it after only a short warm-up (first thing in a session). That's the real test that a skill is yours.
• Use the notes box at the bottom for the one thing to fix next week, usually whatever you heard in your weekly recording: rushing, sharp bends, buzzing notes.

The milestones on the right are the same ones in the 12-week roadmap. Two per block.

Why log at all? Progress on the guitar is slow enough that you can't feel it day to day. The log makes it visible. After a month, looking back at a column of tempos that went from 60 to 92 bpm is the best motivation there is. It also exposes patterns: if the "Rhythm & riffs" row is always empty, you know what to fix.`,
    });
    s.addText('Week of  ______________          This week’s focus:  ______________________________________', { x: M, y: CONTENT_TOP, w: 12.13, h: 0.35, fontSize: 14, color: HEX.lightText, margin: 0, valign: 'middle', isTextBox: true });
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const drills = ['Note finder', 'Box linking / CAGED', 'Triads / arpeggios', 'Licks & technique', 'Rhythm & riffs', 'Improvise / jam'];
    const rows = [['Drill', ...days, 'Start bpm', 'Best bpm']];
    for (const d of drills) rows.push([d, ...days.map(() => ''), '', '']);
    rows.push(['Minutes', ...days.map(() => ''), '', '']);
    logTable(s, rows, { x: M, y: CONTENT_TOP + 0.55, w: 8.75, colW: [2.15, ...days.map(() => 0.6), 1.2, 1.2], rowH: 0.5 });
    // milestones
    const mx = M + 9.1;
    sub(s, 'Milestones', mx, CONTENT_TOP + 0.55, 3.0);
    const ms = ['E and A notes under 2 sec', 'Boxes 1–2 linked at 80 bpm', 'Any note, any string: 2 sec', 'A 12-bar that lands on the changes', '3 choruses over any backing track', 'Jam with another player'];
    ms.forEach((m, i) => checkbox(pres, s, mx, CONTENT_TOP + 1.0 + i * 0.6, m));
    s.addShape(pres.shapes.RECTANGLE, { x: M, y: 6.2, w: 12.13, h: 0.62, fill: { color: 'FFFFFF' }, line: { color: 'A1A1AA', width: 0.75 } });
    s.addText('Fix next week:', { x: M + 0.12, y: 6.26, w: 3, h: 0.26, fontSize: 12, bold: true, color: HEX.lightMuted, margin: 0, isTextBox: true });
  }

  // 77 · Cheat sheet: fretboard map + octave shapes
  {
    const s = D.slideOf(pres, {
      kicker: SHEET, title: 'Fretboard map and octave shapes', light: true,
      notes: `Cheat sheet 1: the fretboard map and the octave shapes. Print it and keep it on your music stand.

The map shows every note from the open strings to the 12th fret. Pearl dots are the natural notes, dark dots are sharps/flats (each one has two names: C♯ = D♭, and so on). After the 12th fret everything repeats an octave higher, so this map covers the whole neck.

How to use the map: don't try to memorize it as a picture. Use it to check yourself during the Part 3 drills. Memorize the natural notes on the low E and A strings first, since those are the root landmarks for power chords, barre chords and every shape in the deck. Then use octave shapes to carry those notes to the other strings.

The octave shapes (bottom row):
1. From the 6th string to the 4th: two strings up, two frets up.
2. From the 5th string to the 3rd: two strings up, two frets up.
3. From the 4th string to the 2nd: two strings up, three frets up, because the B string is tuned a major 3rd above G rather than a 4th, so every shape that crosses the G–B pair shifts up one fret.
4. From the 3rd string to the 1st: also three frets up, for the same reason.
5. The 6th and 1st strings are both E, two octaves apart, so the same fret gives the same note name.

With just the E and A string landmarks and these five shapes you can find any note anywhere. Tuning reminder: E A D G B E, with the strings 5, 5, 5, 4 and 5 frets apart.`,
    });
    const dots = [];
    for (let st = 1; st <= 6; st++) for (let f = 0; f <= 12; f++) {
      const p = T.pcAt(st, f); const nat = !T.SHARP[p].includes('♯');
      dots.push({ s: st, f, label: T.SHARP[p], role: nat ? 'note' : 'dim' });
    }
    D.fretboard(s, { x: M, y: CONTENT_TOP + 0.05, w: 12.13, h: 2.45, from: 0, to: 12, dots, title: 'Cheat sheet map' });
    sub(s, 'Octave shapes: the G–B shift adds one fret', M, CONTENT_TOP + 2.95, 7);
    s.addText('Tuning: E A D G B E · strings 5-5-5-4-5 frets apart', { x: M + 6.5, y: CONTENT_TOP + 2.95, w: 5.63, h: 0.3, fontSize: 12, color: HEX.lightMuted, align: 'right', margin: 0, valign: 'middle', isTextBox: true });
    const shapes = [
      { cap: '6th → 4th: 2 frets up', root: 'A', a: { s: 6, f: 5 }, b: { s: 4, f: 7 } },
      { cap: '5th → 3rd: 2 frets up', root: 'D', a: { s: 5, f: 5 }, b: { s: 3, f: 7 } },
      { cap: '4th → 2nd: 3 frets up', root: 'G', a: { s: 4, f: 5 }, b: { s: 2, f: 8 } },
      { cap: '3rd → 1st: 3 frets up', root: 'C', a: { s: 3, f: 5 }, b: { s: 1, f: 8 } },
      { cap: '6th → 1st: same fret', root: 'A', a: { s: 6, f: 5 }, b: { s: 1, f: 5 } },
    ];
    const bw = (12.13 - 4 * 0.25) / 5;
    shapes.forEach((sh, i) => {
      const x = M + i * (bw + 0.25);
      s.addText(sh.cap, { x, y: CONTENT_TOP + 3.35, w: bw, h: 0.26, fontSize: 12, bold: true, color: HEX.lightText, align: 'center', margin: 0, isTextBox: true });
      D.fretboard(s, {
        x, y: CONTENT_TOP + 3.7, w: bw, h: 1.3, from: 4, to: 8, root: sh.root, stringLabels: false, title: `Octave ${sh.cap}`,
        dots: [{ ...sh.a, label: sh.root, role: 'root' }, { ...sh.b, label: sh.root, role: 'root' }],
        links: [{ a: sh.a, b: sh.b, color: 'E9DFC8' }],
      });
    });
  }

  // 78 · Cheat sheet: CAGED + pentatonic boxes
  {
    const s = D.slideOf(pres, {
      kicker: SHEET, title: 'CAGED in A and the 5 pentatonic boxes', light: true,
      notes: `Cheat sheet 2: CAGED in A major (top) and the five A minor pentatonic boxes (bottom).

Top: every A major chord tone (A, C♯, E) from the open position to the 15th fret, colored root, 3rd and 5th. The brackets mark the five CAGED shapes in order up the neck: the A shape (open), G shape (frets 2–5), E shape (the barre at 5), D shape (7–10), C shape (9–12), and then the A shape again an octave up at 12. Each shape overlaps the next, and they always come in the same order: C, A, G, E, D, then C again.

Bottom: the five minor pentatonic boxes in A. Box 1 is the one you know at the 5th fret. Boxes 2, 3 and 4 climb the neck, and box 5 is shown in its lower octave (frets 2–5) because that's where most players use it. Box 5 also sits at frets 14–17, just above box 4.

How the two connect: each pentatonic box surrounds one of the minor CAGED shapes. Box 1 wraps the E-shape A minor barre chord at the 5th fret, box 2 the D shape, box 3 the C shape, box 4 the A shape and box 5 the G shape. That's why the red roots in each box line up with a chord shape you already know.

Use this sheet when practicing the Part 4 drills: linking the boxes, playing the chord shape inside each box, and finding the closest chord tone. To change key, move everything so the roots land on the new key's root. The shapes don't change, only the position.`,
    });
    const tones = T.chordTonesIn('A', T.CHORDS.maj, 0, 15);
    D.fretboard(s, {
      x: M, y: CONTENT_TOP + 0.82, w: 12.13, h: 1.65, from: 0, to: 15, root: 'A', title: 'CAGED in A',
      dots: D.dotsFor(tones, { root: 'A', label: 'interval' }),
      regions: [
        { from: 0, to: 2, label: 'A shape', row: 0, color: '52525B' }, { from: 2, to: 5, label: 'G shape', row: 1, color: '52525B' },
        { from: 5, to: 7, label: 'E shape', row: 0, color: '52525B' }, { from: 7, to: 10, label: 'D shape', row: 1, color: '52525B' },
        { from: 9, to: 12, label: 'C shape', row: 0, color: '52525B' }, { from: 12, to: 14, label: 'A shape', row: 1, color: '52525B' },
      ],
    });
    sub(s, 'A minor pentatonic: the 5 boxes', M, CONTENT_TOP + 2.85, 5.5);
    D.legend(s, { x: M + 5.4, y: CONTENT_TOP + 2.88, roles: ['root', 'third', 'fifth', 'seventh', 'other'], names: { root: 'R', third: '3 / ♭3', fifth: '5', seventh: '♭7', other: '4' }, fontSize: 12, gap: 0.22 });
    const boxes = [
      { k: 1, from: 4, to: 8, shift: 0, cap: 'Box 1 · frets 5–8' },
      { k: 2, from: 7, to: 11, shift: 0, cap: 'Box 2 · frets 7–10' },
      { k: 3, from: 9, to: 13, shift: 0, cap: 'Box 3 · frets 9–13' },
      { k: 4, from: 11, to: 15, shift: 0, cap: 'Box 4 · frets 12–15' },
      { k: 5, from: 2, to: 6, shift: -1, cap: 'Box 5 · frets 2–5 (or 14–17)' },
    ];
    const bw = (12.13 - 4 * 0.25) / 5;
    boxes.forEach((b, i) => {
      const x = M + i * (bw + 0.25);
      const pos = T.pentBox('A', b.k, { shiftOctave: b.shift });
      const lo = Math.min(...pos.map((p) => p.f)); const hi = Math.max(...pos.map((p) => p.f));
      if (lo < b.from || hi > b.to) throw new Error(`Box ${b.k} (${lo}-${hi}) does not fit board ${b.from}-${b.to}`);
      s.addText(b.cap, { x, y: CONTENT_TOP + 3.27, w: bw, h: 0.26, fontSize: 12, bold: true, color: HEX.lightText, align: 'center', margin: 0, isTextBox: true });
      D.fretboard(s, { x, y: CONTENT_TOP + 3.6, w: bw, h: 1.4, from: b.from, to: b.to, root: 'A', stringLabels: false, title: `Box ${b.k}`, dots: D.dotsFor(pos, { root: 'A', label: 'interval' }) });
    });
  }

  // 79 · Cheat sheet: intervals, chords in a key, progressions
  {
    const s = D.slideOf(pres, {
      kicker: SHEET, title: 'Intervals, chords in a key, progressions', light: true,
      notes: `Cheat sheet 3: the theory on one page.

Left, intervals: the distance between two notes, counted in semitones (frets on one string). Learn the names and labels in the third column, since those labels are what the colored dots throughout the deck use. The "sound" column gives the character of each interval, so you can start hearing them. The most important for soloing are the ♭3 and 3 (minor vs. major), the 5 (stability), the ♭7 (blues and rock bite) and the ♭5 (the blue note).

Top right, chords in a key: build triads on every note of the scale and you get the same pattern of major, minor and diminished chords in every key.
• Major keys: I ii iii IV V vi vii°. Upper-case numerals are major, lower-case minor, ° diminished.
• Minor keys: i ii° ♭III iv v ♭VI ♭VII.
The rows show G and A major and E and A minor, the most guitar-friendly keys. In rock and blues, the v chord in a minor key is often played as a major V (E instead of Em in A minor) for a stronger pull home. That's the harmonic minor sound.

Bottom right, progressions: the common ones written in numerals, with an example in A. Numerals are how musicians talk about progressions independent of key. "It's a one-four-five in E" tells a jam everything it needs.

How to use this page: before a jam, if someone names a key, look up the chords in that key. If they name a progression, look up the numerals and translate. After a few weeks you won't need the sheet.`,
    });
    const iv = [['Semis', 'Interval', 'Label', 'Sound']];
    const sound = ['Home', 'Tense, rubs', 'A step', 'Sad, bluesy', 'Happy, bright', 'Open, suspended', 'Unstable: blue note', 'Strong, power', 'Dark', 'Sweet', 'Bluesy, rock', 'Dreamy, leading'];
    for (let i = 0; i < 12; i++) iv.push([String(i), T.INTERVAL_FULL[i], `**${T.INTERVAL[i]}**`, sound[i]]);
    iv.push(['12', 'Octave', '**R**', 'Same note, higher']);
    D.table(s, iv, { x: M, y: CONTENT_TOP + 0.02, w: 5.35, colW: [0.7, 1.75, 0.75, 2.15], fontSize: 12, rowH: 0.36, align: ['center', 'left', 'center', 'left'] });
    const rx = M + 5.65; const rw = 12.13 - 5.65;
    sub(s, 'Chords in a key', rx, CONTENT_TOP, rw);
    const maj = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
    const min = ['i', 'ii°', '♭III', 'iv', 'v', '♭VI', '♭VII'];
    const keyRow = (k, mode) => [`**${k} ${mode}**`, ...T.harmonize(k, mode).map((c) => c.name)];
    D.table(s, [
      ['Major key', ...maj], keyRow('G', 'major'), keyRow('A', 'major'),
      ['**Minor key**', ...min.map((n) => `**${n}**`)], keyRow('E', 'minor'), keyRow('A', 'minor'),
    ], { x: rx, y: CONTENT_TOP + 0.38, w: rw, colW: [1.39, ...maj.map(() => 0.727)], fontSize: 12, rowH: 0.34, header: true, align: ['left', 'center', 'center', 'center', 'center', 'center', 'center', 'center'] });
    sub(s, 'Progressions', rx, CONTENT_TOP + 2.55, rw);
    D.table(s, [
      ['Progression', 'In A', 'Sound'],
      ['I – IV – V', 'A – D – E', 'Rock ’n’ roll, blues'],
      ['12-bar blues: I7 – IV7 – V7', 'A7 – D7 – E7', 'The blues'],
      ['I – V – vi – IV', 'A – E – F♯m – D', 'Anthem pop-rock'],
      ['I – ♭VII – IV', 'A – G – D', 'Classic rock'],
      ['i – ♭VI – ♭VII', 'Am – F – G', 'Heroic minor'],
      ['i – ♭VII – ♭VI – V', 'Am – G – F – E', 'Descending, dramatic'],
      ['i – iv – v', 'Am – Dm – Em', 'Moody minor'],
    ], { x: rx, y: CONTENT_TOP + 2.92, w: rw, colW: [2.6, 1.95, 1.93], fontSize: 12, rowH: 0.3 });
  }

  // 80 · Cheat sheet: scale over chord
  {
    const s = D.slideOf(pres, {
      kicker: SHEET, title: 'Which scale over which chord', light: true,
      notes: `Cheat sheet 4: what to reach for over each kind of chord or progression, with examples in A and E.

How to read it: first identify the chord type or situation (column 1). Then reach for the scale in column 2. Column 3 names the flavor note: the one note that gives that scale its sound. Lean on that note to make the sound obvious. The colored note names follow the deck's color code: amber for 3rds, purple for 7ths, teal for flavor and blue notes.

The big ideas behind the table:
• Minor pentatonic is the universal starting point for blues, rock and metal. It works over minor chords, power chords and (with attitude) dominant 7th blues chords.
• Over a dominant 7 blues, the minor pentatonic's C rubs against the chord's C♯. That rub is the blues. Bend the ♭3 slightly sharp, or slide or hammer from ♭3 to 3. Mixing in major pentatonic gives the sweet, Allman-style sound.
• Major-sounding progressions want major pentatonic or the major scale, which means landing on the major 3rd.
• Modes are about one note each: Dorian's natural 6, Mixolydian's ♭7, Phrygian's ♭2, harmonic minor's raised 7th over the V chord.
• Power chords have no 3rd, so both major and minor work. Let the bass line, the other chords and the melody decide.

Rule of thumb at the bottom: when in doubt, play minor pentatonic from the key's root, and when the chord changes land on that chord's root or 3rd. In a major-key song that isn't a blues, use major pentatonic instead.`,
    });
    D.table(s, [
      ['Chord or situation', 'Reach for', 'Flavor note', 'Style'],
      ['Dominant 7 blues: A7 D7 E7', 'A minor pent + blues scale; mix in A major pent', '{third:C → C♯} (♭3 → 3), {blue:E♭} (♭5)', 'Blues, blues-rock'],
      ['Major chord / major key: A, I–IV–V, I–V–vi–IV', 'A major pentatonic, A major scale', '{third:C♯} (3)', 'Rock, pop-rock, country'],
      ['Minor chord / minor key: Am, i–♭VI–♭VII', 'A minor pentatonic, A natural minor', '{blue:F} (♭6)', 'Rock, metal'],
      ['Minor vamp, funky or soulful: Am7', 'A Dorian', '{blue:F♯} (6)', 'Rock, funk, Latin rock'],
      ['Major with ♭VII: A – G – D', 'A Mixolydian', '{seventh:G} (♭7)', 'Classic rock'],
      ['V chord in a minor key: E7 in A minor', 'A harmonic minor', '{seventh:G♯} (7)', 'Metal, neoclassical'],
      ['Riff on E5 with F5: E – F', 'E Phrygian', '{blue:F} (♭2)', 'Metal'],
      ['Power chords only (no 3rd)', 'Minor or major pentatonic', 'Let the bass and melody decide', 'Rock, punk, metal'],
    ], { x: M, y: CONTENT_TOP + 0.02, w: 12.13, colW: [3.55, 3.55, 3.0, 2.03], fontSize: 13, rowH: 0.5 });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y: 6.25, w: 12.13, h: 0.58, rectRadius: 0.08, fill: { color: HEX.lightCard }, line: { color: HEX.lightCard, width: 0 } });
    D.text(s, '**In doubt (blues or minor key)?** Minor pentatonic from the key’s root; land on each new chord’s {root:root} or {third:3rd}.', { x: M + 0.2, y: 6.3, w: 11.73, h: 0.48, fontSize: 14, valign: 'middle' });
  }

  // 81 · Closing
  {
    const s = D.slideOf(pres, {
      kicker: KICK, title: 'Three things, every day',
      notes: `If you remember nothing else from this deck, remember these three habits. Do them every day, even on days when you only have 25 minutes.

1. Find one note everywhere (5 minutes). Pick a note, a new one each day. Find it on all six strings, saying its name out loud, using the E and A landmarks and octave shapes. This is how the map gets into your head. Within a few weeks the fretboard stops being a grid of frets and becomes a field of named notes.

2. Play one shape, then connect it (10 minutes). Take one shape: a pentatonic box, a CAGED chord or a triad. Play it, find the roots and the chord tones inside it, then connect it to the shape next door. Every shape you link removes another wall from the neck. That's the escape from box 1, one connection at a time.

3. Make music over a backing track (10 minutes). Put on a blues, rock or metal backing track and improvise using today's note and today's shape. Phrase, leave space, aim for chord tones, play with feeling. This is the reason you picked up the guitar, so never skip it.

The neck below is A minor pentatonic across the whole fretboard, the five boxes joined into one map. Once you can see it like this, in any key, you'll have the freedom this deck is named after.

Keep the cheat sheets on your stand, print a fresh practice log each week, and record yourself every Sunday. In 12 weeks, listen to your first recording next to your latest. You'll hear the difference.

See you on the fretboard.`,
    });
    const items = [
      { n: '1', role: 'root', t: 'Find one note everywhere', b: 'A new note each day, on all 6 strings, **named out loud**.', m: '5 min' },
      { n: '2', role: 'third', t: 'Play one shape, then connect it', b: 'One box, CAGED shape or triad. Find its chord tones, then **link it to the next one**.', m: '10 min' },
      { n: '3', role: 'fifth', t: 'Make music over a track', b: 'Improvise with today’s note and shape. **Phrase, leave space, land on chord tones.**', m: '10 min' },
    ];
    const cw = (12.13 - 0.3 * 2) / 3; const cy = CONTENT_TOP + 0.05; const ch = 3.15;
    items.forEach((it, i) => {
      const x = M + i * (cw + 0.3);
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: cy, w: cw, h: ch, rectRadius: 0.1, fill: { color: HEX.card }, line: { color: HEX.card, width: 0 } });
      D.badge(s, { x: x + 0.25, y: cy + 0.25, d: 0.8, label: it.n, role: it.role, fontSize: 26 });
      s.addText(it.m, { x: x + cw - 1.35, y: cy + 0.4, w: 1.1, h: 0.5, fontSize: 16, bold: true, color: HEX.pearl, align: 'right', valign: 'middle', margin: 0, isTextBox: true });
      s.addText(it.t, { x: x + 0.25, y: cy + 1.2, w: cw - 0.5, h: 0.65, fontSize: 18, bold: true, color: HEX.white, valign: 'top', margin: 0, isTextBox: true });
      D.text(s, it.b, { x: x + 0.25, y: cy + 1.9, w: cw - 0.5, h: 1.1, fontSize: 15 });
    });
    const pos = T.positions(T.pcsOf('A', T.SCALES.minPent), { from: 0, to: 17 });
    D.fretboard(s, { x: M, y: 4.95, w: 12.13, h: 1.4, from: 0, to: 17, root: 'A', fretNumbers: 'inlays', title: 'Closing neck', dots: D.dotsFor(pos, { root: 'A', label: '' }) });
    s.addText('See you on the fretboard.', { x: M, y: 6.66, w: 12.13, h: 0.26, fontSize: 14, italic: true, color: HEX.pearl, align: 'right', margin: 0, isTextBox: true });
  }
}

module.exports = { build };
