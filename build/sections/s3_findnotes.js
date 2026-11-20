// Part 3 · Find any note (slides 24–29)
const T = require('../lib/theory');
const D = require('../lib/draw');
const { HEX, M, CONTENT_TOP, section } = require('../lib/deck');

const KICK = '3 · Find any note';

function build(pres) {
  section(pres, 'Find any note');

  // 24 · Divider
  D.divider(pres, {
    num: 3,
    title: 'Find any note',
    subtitle: 'Turn the map into reflexes. A few minutes of daily drills, and finding notes stops being a calculation.',
    outcomes: [
      'Find any note on all 6 strings using landmarks + octave shapes',
      'Name any note on any string in under 2 seconds',
      'Walk the circle of 4ths across the neck',
      'Find the 3rd, 5th, ♭7 and octave around any root by shape',
    ],
    notes: `Part 2 gave you the map. Part 3 makes it automatic.

Knowing that "A is at the 5th fret of the low E" is not the same as seeing it instantly while you're playing. Using a fact under pressure takes repetition. The drills in this part are designed to build that speed with as little time as possible: about five minutes a day.

What you'll learn:
1. A 3-step method for finding any note anywhere: anchor it on the E or A string, carry it with an octave shape, and name it out loud.
2. Three drills that build recall: one note everywhere, string by string, and the circle of 4ths.
3. Interval shapes. This is the bridge to soloing. Instead of only finding "C", you'll find "the ♭3 of A", "the 5th of D", "the ♭7 of E". Soloing with intent means aiming at notes like these, and interval shapes let you find them by sight.

A realistic timeline: with 5 minutes a day, most players can find any natural note on any string within 2–3 weeks, and any note including sharps/flats within 4–6 weeks. The checkpoint at the end of this part is "any note on any string in under 2 seconds".

Tip: keep these drills at the very start of your practice session, before you play anything fun. They take little time and your attention is sharpest then.`,
  });

  // 25 · The 3-step method
  {
    const s = D.slideOf(pres, {
      kicker: KICK, title: 'The 3-step method for finding any note',
      notes: `Here's the method you'll use for every note until it becomes automatic.

Step 1: Anchor. Find the note on the low E or A string using your landmarks from Part 2. For D: it's at fret 10 on low E and fret 5 on the A string.

Step 2: Carry it with octave shapes. From each anchor, jump two strings up:
• From the low E (fret 10): 2 frets up to the D string (fret 12).
• From the A string (fret 5): 2 frets up to the G string (fret 7).
• Across the B string add one more fret: D12 → B15, G7 → e10.
• Open D string and fret 12 are free: they're the same note as the string name. From the open D: +3 to B3.

Step 3: Name it. Say "D" out loud every time you play one. Saying the name is what moves this from shape-following to real knowledge.

On the diagram: filled dots are the anchors on E and A, rings are the Ds you reached with octave shapes. Solid lines are 2-fret shapes, dashed lines 3-fret shapes crossing the B string. Every D on the neck from fret 0 to 15 appears, and you found all of them from two landmarks.

Speed tip: the high e string is the same as the low E. If you know D is at 10 on low E, it's also at 10 on high e. That's one extra note for free.

Common mistakes:
• Skipping step 3. Shapes without names don't stick.
• Forgetting the extra fret across the B string and landing on C♯ instead of D. Your ears will tell you: if it sounds wrong, it is.`,
    });
    const steps = [
      ['Anchor', 'Find it on the **low E** or **A** string with your landmarks.', 'root'],
      ['Octave shape', 'Jump **2 strings, 2 frets**. Add a fret when crossing the **B** string.', 'third'],
      ['Name it', 'Say the note **out loud** every time you play it.', 'fifth'],
    ];
    const cw = (12.13 - 0.3 * 2) / 3; const ch = 1.55;
    steps.forEach(([t, b, r], i) => {
      const x = M + i * (cw + 0.3);
      D.card(s, { x, y: CONTENT_TOP, w: cw, h: ch, title: t, badge: String(i + 1), badgeRole: r, body: b, fontSize: 14, titleSize: 17 });
      if (i < 2) s.addText('→', { x: x + cw - 0.02, y: CONTENT_TOP + 0.45, w: 0.34, h: 0.4, fontSize: 20, bold: true, color: HEX.pearl, align: 'center', margin: 0, isTextBox: true });
    });
    s.addText('Example: every D from fret 0 to 15', { x: M, y: CONTENT_TOP + 1.7, w: 6, h: 0.3, fontSize: 14, bold: true, color: HEX.pearl, margin: 0, isTextBox: true });
    const anchors = [{ s: 6, f: 10 }, { s: 5, f: 5 }];
    const isAnchor = (p) => anchors.some((a) => a.s === p.s && a.f === p.f);
    const pos = T.positions([T.pc('D')], { from: 0, to: 15 });
    const top = CONTENT_TOP + 2.2;
    D.fretboard(s, {
      x: M, y: top, w: 12.13, h: 2.3, from: 0, to: 15, root: 'D', title: '3-step method',
      dots: pos.map((p) => ({ ...p, label: 'D', role: 'root', ring: !isAnchor(p) })),
      links: [
        { a: { s: 6, f: 10 }, b: { s: 4, f: 12 } },
        { a: { s: 5, f: 5 }, b: { s: 3, f: 7 } },
        { a: { s: 4, f: 12 }, b: { s: 2, f: 15 }, dash: 'dash' },
        { a: { s: 3, f: 7 }, b: { s: 1, f: 10 }, dash: 'dash' },
        { a: { s: 4, f: 0 }, b: { s: 2, f: 3 }, dash: 'dash' },
      ],
    });
    const ly = top + 2.64;
    D.badge(s, { x: M, y: ly, d: 0.26, label: '', role: 'root' });
    s.addText('anchor on E or A', { x: M + 0.36, y: ly - 0.03, w: 2.2, h: 0.32, fontSize: 12, color: HEX.muted, margin: 0, valign: 'middle', isTextBox: true });
    s.addShape(pres.shapes.OVAL, { x: M + 2.6, y: ly, w: 0.26, h: 0.26, fill: { color: HEX.wood }, line: { color: HEX.root, width: 2 } });
    s.addText('found with an octave shape', { x: M + 2.96, y: ly - 0.03, w: 3, h: 0.32, fontSize: 12, color: HEX.muted, margin: 0, valign: 'middle', isTextBox: true });
    s.addText('solid = 2-fret shape · dashed = 3-fret shape (crosses B)', { x: 6.6, y: ly - 0.03, w: 6.13, h: 0.32, fontSize: 12, color: HEX.muted, margin: 0, valign: 'middle', align: 'right', isTextBox: true });
  }

  // 26 · Drill: one note everywhere
  {
    const s = D.slideOf(pres, {
      kicker: KICK, title: 'Drill: one note everywhere',
      notes: `This is the most effective fretboard drill there is, and it takes two minutes.

How it works:
1. Choose a note. Say it's G.
2. Find it on every string, from the low E up to the high e: E3, A10, D5, G0 (or 12), B8, e3. One note per string, in order.
3. Then come back down: e3, B8, G12, D5, A10, E3.
4. Say "G" each time you play it.
5. Next day (or next round), choose a new note. Work through all 12 over time. A good order is the circle of 4ths (C, F, B♭, E♭…), covered on the next slide.

The metronome is what makes this a drill rather than a search. You have a fixed number of clicks to find the next note. Start generous and tighten it:
• Stage 1: 40 bpm, one note every 4 clicks. Plenty of time to think.
• Stage 2: 60 bpm, one note every 2 clicks.
• Stage 3: 60 bpm, one note per click.
• Stage 4: 80 bpm, one note per click, and a different random note each round.
Move up a stage after 3 clean rounds in a row.

Rules that make it work:
• Don't look at a chart. Use the 3-step method if you get stuck.
• Any position on the string counts, but over the week try to use different ones (G on the G string can be fret 0 or 12).
• If you miss the click, keep going. Don't stop the metronome. Note which string tripped you up, and that's tomorrow's focus.

Common mistake: always choosing natural notes. After the first week, include sharps and flats. They're where most players freeze.`,
    });
    const pos = T.positions([T.pc('G')], { from: 0, to: 12 });
    const top = CONTENT_TOP + 0.15;
    D.fretboard(s, {
      x: M, y: top, w: 12.13, h: 2.35, from: 0, to: 12, root: 'G', title: 'one note everywhere',
      dots: pos.map((p) => ({ ...p, label: 'G', role: 'root', ring: p.s === 3 && p.f === 12 })),
    });
    s.addText('Every G from fret 0 to 12. Play low E → high e, then back down.', { x: M, y: top + 2.7, w: 12.13, h: 0.3, fontSize: 13, color: HEX.muted, margin: 0, isTextBox: true });
    const ty = top + 3.2;
    D.table(s, [
      ['Stage', 'Metronome', 'Pace', 'Move on after'],
      ['1', '40 bpm', '1 note every **4** clicks', '3 clean rounds'],
      ['2', '60 bpm', '1 note every **2** clicks', '3 clean rounds'],
      ['3', '60 bpm', '1 note **every** click', '3 clean rounds'],
      ['4', '80 bpm', '1 per click, **random** notes', 'Checkpoint'],
    ], { x: M, y: ty, w: 7.4, colW: [0.8, 1.3, 3.6, 1.7], fontSize: 13, rowH: 0.34, align: ['center', 'left', 'left', 'left'] });
    D.card(s, {
      x: 8.35, y: ty, w: 4.38, h: 6.85 - ty, title: 'Rules',
      bullets: ['No charts: use anchor → octave → name', 'Don’t stop for misses; note the string', 'After week 1, add sharps and flats'], fontSize: 13, paraSpace: 4, titleSize: 15,
    });
  }

  // 27 · String by string + circle of 4ths
  {
    const s = D.slideOf(pres, {
      kicker: KICK, title: 'Drills: string by string + circle of 4ths',
      notes: `Two more drills to rotate with "one note everywhere".

Drill A: String by string.
Pick one string, say the D string. Play every natural note on it from the open string to fret 12 (D E F G A B C D) and back, naming each one. Then call out notes at random and find them on that string only. Spend a day or two per string. The G and B strings are usually the weakest, so give them extra days.
A shortcut while you learn: each string's notes are the same as the string two below it, shifted 2 frets (3 frets on B and e). That's the octave shape again.

Drill B: Circle of 4ths.
The circle of 4ths is the order C, F, B♭, E♭, A♭, D♭, G♭, B, E, A, D, G, and back to C. Each step goes up a perfect 4th (5 half steps). It's the order that chord progressions most often move in, so musicians drill keys this way.
How to use it:
• On one string: play each note of the circle on, say, the A string, one per click. Then on the low E.
• Across strings: here's the neat part. Up a 4th is the same fret on the next higher string. So C on the A string (fret 3) → F on the D string (fret 3) → B♭ on G (fret 3) → then E♭ on B at fret 4 (G–B shift!). The circle of 4ths walks across the neck.
• Combined: play "one note everywhere" for each note of the circle in order. That's the full routine.

Tempo: start at 50 bpm with one note every 2 clicks. Two clean laps of the circle = done for the day.

Common mistake: practicing only one direction. Go backward around the circle too (that's the circle of 5ths: C G D A E B…).`,
    });
    const lx = M; const lw = 5.7;
    D.card(s, {
      x: lx, y: CONTENT_TOP, w: lw, h: 5.3, title: 'A · String by string', badge: 'A', badgeRole: 'third',
      bullets: [
        'Pick **one string**. Play its naturals from open to fret 12 and back, naming each.',
        'Then call notes **at random** and find them on that string only.',
        'One or two days per string. Give **G** and **B** extra days: they’re usually the weakest.',
        'Shortcut: each string = the string two below, **+2 frets** (+3 on B and e).',
        'Up a 4th = **same fret, next string up** (+1 fret when moving onto B).',
      ], fontSize: 14, paraSpace: 8, titleSize: 17,
    });
    // circle of fourths
    const notes = ['C', 'F', 'B♭', 'E♭', 'A♭', 'D♭', 'G♭', 'B', 'E', 'A', 'D', 'G'];
    const cx = 9.75; const cy = 4.2; const r = 2.0; const d = 0.64;
    s.addShape(pres.shapes.OVAL, { x: cx - r, y: cy - r, w: r * 2, h: r * 2, fill: { color: HEX.bg }, line: { color: HEX.line, width: 1.5 } });
    notes.forEach((n, i) => {
      const a = (-90 + i * 30) * Math.PI / 180;
      D.badge(s, { x: cx + r * Math.cos(a) - d / 2, y: cy + r * Math.sin(a) - d / 2, d, label: n, role: i === 0 ? 'root' : 'note', fontSize: 16 });
    });
    s.addText('B · Circle of 4ths', { x: cx - 1.3, y: cy - 0.62, w: 2.6, h: 0.32, fontSize: 15, bold: true, color: HEX.pearl, align: 'center', margin: 0, isTextBox: true });
    s.addText('Clockwise: up a 4th each step (5 frets)', { x: cx - 1.25, y: cy - 0.22, w: 2.5, h: 0.56, fontSize: 12, color: HEX.muted, align: 'center', margin: 0, isTextBox: true });
    s.addText('Backward = circle of 5ths', { x: cx - 1.25, y: cy + 0.38, w: 2.5, h: 0.3, fontSize: 12, color: HEX.muted, align: 'center', margin: 0, isTextBox: true });
  }

  // 28 · Interval shapes
  {
    const s = D.slideOf(pres, {
      kicker: KICK, title: 'Interval shapes: the map around a root',
      notes: `So far you've found notes by name. Soloing needs something more: finding notes by their job relative to a root. "Where's the ♭3 of A?" "Where's the 5th of D?" Interval shapes answer that by sight, with no note names needed.

The two diagrams show the same shape twice:
• Left: root A on the low E string (fret 5).
• Right: root D on the A string (fret 5).
Around each root you can see every interval within a four-to-five-fret hand span.

The four shortcuts to learn first (bottom cards):
• 3rd: next string up, one fret back. (♭3: same string, 3 frets up, or next string, 2 frets back.)
• 5th: next string up, 2 frets up. This is the power chord you already know.
• ♭7: two strings up, same fret.
• Octave: two strings up, 2 frets up.
Combine root + ♭3 (or 3) + 5 + ♭7 and you have the notes of a minor (or dominant) 7th chord, the backbone of blues and rock.

Notice the two diagrams are identical in shape. That's because strings E-A-D and A-D-G are tuned the same distance apart. The shape only changes when part of it lands on the B string: then those notes move up one fret (the G–B shift again).

How to practice:
• Put a root on the low E. Play R → 3 → 5 → ♭7 → octave, saying "root, three, five, flat seven, root."
• Move the root to a new fret and repeat. Then use a root on the A string.
• Then do it against a drone: play an A note on a backing track and find each interval by ear and shape.

Common mistake: learning interval shapes only from one string. Learn both the 6th-string and 5th-string versions, since that covers every key in one area of the neck.`,
    });
    const boards = [
      { root: 'A', x: M, label: 'Root on the 6th string (A at fret 5)', dots: [
        { s: 6, f: 5, label: 'R' }, { s: 6, f: 7, label: '2' }, { s: 6, f: 8, label: '♭3' },
        { s: 5, f: 4, label: '3' }, { s: 5, f: 5, label: '4' }, { s: 5, f: 7, label: '5' },
        { s: 4, f: 4, label: '6' }, { s: 4, f: 5, label: '♭7' }, { s: 4, f: 6, label: '7' }, { s: 4, f: 7, label: 'R' },
      ] },
      { root: 'D', x: 6.88, label: 'Root on the 5th string (D at fret 5)', dots: [
        { s: 5, f: 5, label: 'R' }, { s: 5, f: 7, label: '2' }, { s: 5, f: 8, label: '♭3' },
        { s: 4, f: 4, label: '3' }, { s: 4, f: 5, label: '4' }, { s: 4, f: 7, label: '5' },
        { s: 3, f: 4, label: '6' }, { s: 3, f: 5, label: '♭7' }, { s: 3, f: 6, label: '7' }, { s: 3, f: 7, label: 'R' },
      ] },
    ];
    const roleFor = (lab) => ({ R: 'root', '♭3': 'third', 3: 'third', 5: 'fifth', '♭7': 'seventh', 7: 'seventh' }[lab] || 'other');
    for (const b of boards) {
      s.addText(b.label, { x: b.x, y: CONTENT_TOP, w: 5.85, h: 0.3, fontSize: 14, bold: true, color: HEX.pearl, margin: 0, isTextBox: true });
      D.fretboard(s, {
        x: b.x, y: CONTENT_TOP + 0.45, w: 5.85, h: 2.35, from: 2, to: 9, root: b.root, title: 'Interval shapes',
        dots: b.dots.map((d) => ({ ...d, role: roleFor(d.label) })),
      });
    }
    const cards = [
      ['3', 'third', '3rd', 'Next string up, **1 fret back**. (♭3: same string, 3 frets up.)'],
      ['5', 'fifth', '5th', 'Next string up, **2 frets up**: the power chord.'],
      ['♭7', 'seventh', '♭7', 'Two strings up, **same fret**.'],
      ['R', 'root', 'Octave', 'Two strings up, **2 frets up**.'],
    ];
    const cw = (12.13 - 0.3 * 3) / 4; const cy = 4.95; const ch = 1.9;
    cards.forEach(([b, r, t, body], i) => D.card(s, { x: M + i * (cw + 0.3), y: cy, w: cw, h: ch, title: t, badge: b, badgeRole: r, body, fontSize: 14, titleSize: 17 }));
  }

  // 29 · Practice this
  D.practice(pres, {
    kicker: KICK,
    intro: 'Five minutes a day, before anything else. **Checkpoint:** name any note on any string in under 2 seconds.',
    drills: [
      {
        name: 'Note of the day', how: 'One note **everywhere**: low E → high e → back, saying its name. Go through the **circle of 4ths**, one new note per day.',
        tempo: 'Stage 1 → 4 (40 → 80 bpm)', time: '2 min', done: 'Stage 4 with random notes',
      },
      {
        name: 'Flash-card quiz', how: 'Use a random note generator or cards. Read a note **and** a string ("F♯, G string") and play it within 2 clicks.',
        tempo: '1 card every 2 clicks at 60 bpm', time: '1 min', done: '20 cards, under 2 s each',
      },
      {
        name: 'Interval hunt', how: 'Root on E or A. Find **R, 3, 5, ♭7, octave** by shape, saying "root, three…". New root each round, then use minor (♭3).',
        tempo: '60 bpm, 1 note per beat', time: '1 min', done: 'Any root, both strings, no pause',
      },
      {
        name: 'Use it', how: 'Over a drone or backing track in A, play slowly and **name every note** you play out loud, by name or interval.',
        tempo: 'Free', time: '1 min', done: 'You know every note you play',
      },
    ],
    notes: `The practice slide for Part 3. About five minutes a day, at the start of every session.

1. Note of the day: "one note everywhere" from slide 26. Use the circle of 4ths to choose the note: C on day 1, F on day 2, B♭ on day 3, and so on. Progress through the metronome stages: 40 bpm with 4 clicks per note, up to 80 bpm with 1 click per note. At stage 4, switch to a random note every round.

2. Flash-card quiz. Recall under time pressure is the real test. Use a random note generator (there are free apps and websites; search "random note generator"), or write the 12 notes and 6 string names on cards and draw one of each. Play the note on that string within 2 clicks. When you can do 20 in a row at under 2 seconds each, you've hit the checkpoint.

3. Interval hunt from slide 28. Put a root on the low E or A string, then play the root, 3rd, 5th, ♭7 and octave by shape while saying their names. Change the root each round. Once major is easy, use the ♭3 for minor.

4. Use it. Drills need to transfer into music. Put on an A drone or a slow backing track in A minor. Play slowly, and say the name or interval of every note you play. It feels awkward at first, which means it's working.

Checkpoint: any note on any string in under 2 seconds. When you pass it, reduce this routine to 2 minutes of random notes as a warm-up, and spend the freed-up time on Part 4.`,
  });
}

module.exports = { build };
