// Theory Intensive · Part 9 · Capstone: worked analysis, project, study plan, cheat sheets, answer key
const T = require('../lib/theory');
const D = require('../lib/draw');
const I = require('../lib/intensive');
const { HEX, M, CONTENT_TOP, CONTENT_BOTTOM, section } = require('../lib/deck');

const K = '9 · Capstone';
const FULL_W = 12.13;

// Chord name + its spelled notes, from the engine.
const spelled = (root, suffix) => T.spellChord(root, suffix).join(' ');

function build(pres) {
  section(pres, 'Capstone');

  // Divider
  D.divider(pres, {
    num: 9,
    title: 'Capstone',
    subtitle: 'Put every link of the chain to work: analyze a progression completely, then write, voice and record a piece of your own.',
    outcomes: [
      'Analyze a progression: numerals, functions and every chromatic chord',
      'Plan a 16-bar period with deliberate cadences',
      'Write a line that targets chord tones and develops a motif',
      'Keep going with a study plan, two cheat sheets and the answer key',
    ],
    notes: `Part 9: the capstone.

Everything up to here has been one link at a time. The capstone asks you to use all of them at once, which is what real music asks of you too. There are two halves.

First, a worked analysis. One original 8-bar progression in A, analyzed the way you should now analyze anything you learn: Roman numerals, function colors, every chromatic chord explained by where it came from and where it resolves. Read it, play it, then cover the labels and redo the analysis yourself.

Second, a project. You'll write a 16-bar piece to a precise spec: a period with two different cadences, at least one secondary dominant and one borrowed chord, two voicing systems, a developed motif and an analysis sheet. Then you record it. The spec is strict on purpose. Writing to a constraint forces you to choose tools deliberately instead of by accident, and that's the skill the whole intensive is building.

After the project come the support pages: a four-week fast-track plan, two printable cheat sheets that compress the whole course, and the answer key for every worksheet.

How to approach the project: don't try to make it a masterpiece. Make it correct first, then make it musical. A correct, simple piece that you can explain bar by bar is worth more than an ambitious one you can't analyze. Once it's done, write a second version that breaks one rule on purpose, and explain what the broken rule buys you. That's when theory turns into taste.`,
  });

  // Worked analysis
  {
    const s = D.slideOf(pres, {
      kicker: K, title: 'Worked analysis: eight bars in A',
      notes: `Here is a complete analysis of one original 8-bar progression in A major. Play it first, two beats per chord where a bar has two chords, four beats otherwise. Then read the labels.

Bar 1, A: the tonic, I.
Bar 2, C♯7: not in the key. A has C♯ minor as its iii chord, but this C♯ is a dominant 7: C♯ E♯ G♯ B. The E♯ is the leading tone of F♯, so C♯7 is V7/vi, a secondary dominant pointing at F♯m. Spell it with E♯, not F: the letter tells you it rises to F♯.
Bar 3, F♯m: vi, tonic function, exactly where the secondary dominant promised.
Bar 4, D then Dm: IV, then iv borrowed from A minor. The F♮ in Dm is the ♭6 of A, and it sighs down to E in the next chord. This is the minor-iv move from Part 6.
Bar 5, A: home again.
Bar 6, F♯7: another secondary dominant, V7/ii. Its A♯ is the leading tone of B.
Bar 7, Bm7 then E7: ii7 to V7. E7's G♯ and D form the tritone, which resolves inward to A and C♯.
Bar 8, A: a perfect authentic cadence.

Now look at the roots in bars 6–8: F♯, B, E, A. Each one falls a 5th. That's a chain of dominants and predominants running around the circle of fifths, which is why the ending feels so inevitable.

Try it now: play the progression with drop-2 or shell voicings, keeping each move as small as possible. Then cover the numerals and redo the analysis from the chord names alone. Finally, transpose the whole thing to E, writing it by numerals first.`,
    });
    const rows = [
      [
        { name: 'A', numeral: 'I', fn: 'T', sub: 'bar 1' },
        { name: 'C♯7', numeral: 'V7/vi', fn: 'SD', sub: 'E♯ → F♯' },
        { name: 'F♯m', numeral: 'vi', fn: 'T', sub: 'bar 3' },
        { name: 'D', numeral: 'IV', fn: 'PD', sub: 'bar 4' },
        { name: 'Dm', numeral: 'iv', fn: 'B', sub: 'F♮ → E' },
      ],
      [
        { name: 'A', numeral: 'I', fn: 'T', sub: 'bar 5' },
        { name: 'F♯7', numeral: 'V7/ii', fn: 'SD', sub: 'A♯ → B' },
        { name: 'Bm7', numeral: 'ii7', fn: 'PD', sub: 'bar 7' },
        { name: 'E7', numeral: 'V7', fn: 'D', sub: 'G♯ + D' },
        { name: 'A', numeral: 'I', fn: 'T', sub: 'PAC' },
      ],
    ];
    // check every chord against the key's diatonic set or its stated source
    const dia = T.diatonicChords('A', 'major', 4).map((c) => c.numeral);
    if (!dia.includes('ii7') || T.dominantOf('F♯') !== 'C♯7' || T.dominantOf('B') !== 'F♯7') throw new Error('worked analysis check failed');
    let y = CONTENT_TOP;
    rows.forEach((r) => { I.progression(s, { x: M, y, w: FULL_W, h: 1.2, chords: r, gap: 0.4 }); y += 1.42; });
    I.fnLegend(s, { x: M, y: y - 0.02, fns: ['T', 'PD', 'D', 'SD', 'B'] });
    const cy = y + 0.42; const cw = (FULL_W - 0.6) / 3; const ch = CONTENT_BOTTOM - cy;
    D.card(s, { x: M, y: cy, w: cw, h: ch, title: 'Two secondary dominants', badge: 'SD', badgeRole: 'blue', body: `**C♯7** (${spelled('C♯', '7')}) and **F♯7** (${spelled('F♯', '7')}) each lend a leading tone: E♯ to F♯m, A♯ to Bm7.`, fontSize: 14 });
    D.card(s, { x: M + cw + 0.3, y: cy, w: cw, h: ch, title: 'One borrowed chord', badge: 'iv', badgeRole: 'seventh', body: `**Dm** (${spelled('D', 'm')}) comes from A minor. Its F♮, the ♭6, falls to E: the minor-iv sigh.`, fontSize: 14 });
    D.card(s, { x: M + 2 * (cw + 0.3), y: cy, w: cw, h: ch, title: 'A circle-of-fifths ending', badge: 'V', badgeRole: 'root', body: 'Roots **F♯ → B → E → A** each fall a 5th. E7’s tritone G♯–D resolves to A and C♯.', fontSize: 14 });
  }

  // Capstone project
  {
    const s = D.slideOf(pres, {
      kicker: K, title: 'Capstone project: a 16-bar period',
      notes: `The capstone project is a 16-bar piece written to a strict spec. Use the grid on the left as your plan. It's a period, from Part 8: an 8-bar antecedent that ends on a half cadence (bar 8 lands on V), and an 8-bar consequent that starts like the antecedent and ends on a perfect authentic cadence (V to I into bar 16).

The requirements on the right each point back to a part of the deck:
• Key: pick any key and write its signature and relative minor at the top. If you play blues and rock, A or E is natural; try a flat key like E♭ or B♭ if you want a stretch.
• Harmony: at least one secondary dominant, one borrowed chord, and two different cadence types. Make the harmonic rhythm speed up into the final cadence, for example one chord per bar, then two per bar in bars 13–15.
• Voicings: play the chords with at least two voicing systems (drop 2, shells, or top-string triads). Connect them with the smallest possible moves.
• Melody or solo: one motif, developed with a sequence plus one other technique. Strong beats land on chord tones. Include at least two guide-tone resolutions and one superimposed arpeggio or pentatonic substitution.
• Analysis: Roman numerals and function colors under every chord, and every non-chord tone in the melody labeled.

What to hand in to yourself: a chord chart with numerals, the melody in tab, a recording (a comping track plus the melody over it, using a looper or a DAW), and a one-paragraph review that explains, in theory terms, what works best and why.

Give yourself a week. Write the chords first, play them for a day before adding the melody, and record last.`,
    });
    // 16-bar plan grid
    const gx = M; const gw = 5.55; const bw = (gw - 3 * 0.12) / 4; const bh = 0.6;
    const labelH = 0.3;
    const cells = {
      1: ['I', 'fifth'], 8: ['V', 'root'], 9: ['I', 'fifth'], 15: ['ii  V', 'third'], 16: ['I', 'fifth'],
    };
    let y = CONTENT_TOP;
    const halves = [['Antecedent: bars 1–8', 'ends on a half cadence'], ['Consequent: bars 9–16', 'ends on an authentic cadence']];
    halves.forEach(([t, sub], hi) => {
      s.addText([{ text: t, options: { bold: true, color: HEX.pearl, fontSize: 14 } }, { text: `   ${sub}`, options: { color: HEX.muted, fontSize: 12 } }], { x: gx, y, w: gw, h: labelH, margin: 0, valign: 'middle', isTextBox: true });
      y += labelH + 0.1;
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 4; c++) {
          const bar = hi * 8 + r * 4 + c + 1;
          const x = gx + c * (bw + 0.12);
          const cell = cells[bar];
          s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: bw, h: bh, rectRadius: 0.06, fill: { color: HEX.card }, line: cell ? { color: D.ROLE_HEX[cell[1]], width: 2 } : { color: HEX.card, width: 0 } });
          s.addText(String(bar), { x: x + 0.07, y: y + 0.05, w: 0.4, h: 0.2, fontSize: 10, color: HEX.faint, margin: 0, isTextBox: true });
          if (cell) s.addText(cell[0], { x, y: y + 0.12, w: bw, h: bh - 0.14, fontSize: 15, bold: true, color: D.ROLE_HEX[cell[1]], align: 'center', valign: 'middle', margin: 0, isTextBox: true });
        }
        y += bh + 0.12;
      }
      y += 0.12;
    });
    D.card(s, { x: gx, y: y + 0.04, w: gw, h: CONTENT_BOTTOM - y - 0.04, title: 'Hand in to yourself', titleSize: 15, body: 'Chord chart with numerals · melody in tab · a recording (comp + melody) · a one-paragraph review in theory terms', fontSize: 14 });
    // requirements
    const rx = gx + gw + 0.35; const rw = M + FULL_W - rx;
    const reqs = [
      ['Key', 'Any key. Write its signature and relative minor at the top.', '2'],
      ['Harmony', 'One secondary dominant, one borrowed chord, two cadence types. Harmonic rhythm speeds up into bar 16.', '4–6'],
      ['Voicings', 'Two systems: drop 2, shells or top-string triads, connected with the smallest moves.', '3, 5'],
      ['Melody', 'One motif, sequenced plus one more technique. Chord tones on strong beats, two guide-tone resolutions, one superimposition.', '7'],
      ['Form', 'A period: antecedent to a half cadence, consequent to a perfect authentic cadence.', '8'],
      ['Analysis', 'Numerals and function colors under every chord. Label every non-chord tone.', '5, 7'],
    ];
    const rh = (CONTENT_BOTTOM - CONTENT_TOP - 0.12 * (reqs.length - 1)) / reqs.length;
    reqs.forEach(([t, b, part], i) => {
      const ry = CONTENT_TOP + i * (rh + 0.12);
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: rx, y: ry, w: rw, h: rh, rectRadius: 0.08, fill: { color: HEX.card }, line: { color: HEX.card, width: 0 } });
      s.addText(t, { x: rx + 0.2, y: ry, w: 1.2, h: rh, fontSize: 15, bold: true, color: HEX.white, margin: 0, valign: 'middle', isTextBox: true });
      D.text(s, b, { x: rx + 1.45, y: ry, w: rw - 2.45, h: rh, fontSize: 13, valign: 'middle' });
      s.addText(`Part ${part}`, { x: rx + rw - 0.95, y: ry, w: 0.8, h: rh, fontSize: 11, bold: true, color: HEX.pearl, align: 'right', margin: 0, valign: 'middle', isTextBox: true });
    });
  }

  // Four-week plan
  {
    const s = D.slideOf(pres, {
      kicker: K, title: 'Four-week fast track',
      notes: `This is the fast track: the whole intensive in four weeks, at about 45 minutes a day. If you'd rather go at one part per week, use the same daily shape and stretch each part across a full week.

Each week covers two parts with the same rhythm. Two days of slides and neck drills per part, one worksheet day per part, and Sunday for review. On review day, redo every worksheet group where you missed more than one answer, and replay the neck drills you found hardest. Don't skip review day. That's when the material moves from short-term to long-term memory.

The daily block has four pieces:
• 10 minutes of ear work over a drone: intervals from Part 1 in week 1, chord qualities from Part 3 in week 2, functions and cadences from Part 5 in week 3, and chord tones vs. tensions from Part 7 in week 4.
• 15 minutes on the slides and the neck: read, play and sing each idea.
• 15 minutes on worksheets or review.
• 5 minutes for your log: what you learned, what's still shaky, and tomorrow's first task.

Week 4 ends with the capstone. Write the piece across Saturday and Sunday, and record it the following week if you need more time. It's better to finish late than to skip the recording, because hearing your own analysis played back is where it all connects.

If you fall behind, don't compress. Slide the plan a day. Rushing theory just means you'll relearn it later.`,
    });
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const weeks = [
      ['Week 1', 'Intervals, scales', ['P1 slides', 'P1 neck', 'P1 sheet', 'P2 slides', 'P2 neck', 'P2 sheet', 'Review']],
      ['Week 2', 'Chords, diatonic', ['P3 slides', 'P3 neck', 'P3 sheet', 'P4 slides', 'P4 neck', 'P4 sheet', 'Review']],
      ['Week 3', 'Function, chromatic', ['P5 slides', 'P5 neck', 'P5 sheet', 'P6 slides', 'P6 neck', 'P6 sheet', 'Review']],
      ['Week 4', 'Melody, form', ['P7 slides', 'P7 neck', 'P7 sheet', 'P8 slides', 'P8 sheet', 'Capstone write', 'Capstone record']],
    ];
    const roles = ['root', 'third', 'fifth', 'seventh'];
    const labelW = 2.0; const gap = 0.1;
    const cw = (FULL_W - labelW - gap * 7) / 7; const rh = 0.72;
    let y = CONTENT_TOP;
    days.forEach((d, i) => s.addText(d, { x: M + labelW + gap + i * (cw + gap), y, w: cw, h: 0.3, fontSize: 12, bold: true, color: HEX.muted, align: 'center', margin: 0, isTextBox: true }));
    y += 0.38;
    weeks.forEach(([wk, topic, cells], wi) => {
      s.addText([{ text: wk, options: { bold: true, color: HEX.white, fontSize: 15, breakLine: true } }, { text: topic, options: { color: D.ROLE_HEX[roles[wi]], fontSize: 12, bold: true } }], { x: M, y, w: labelW - 0.1, h: rh, margin: 0, valign: 'middle', isTextBox: true });
      cells.forEach((c, ci) => {
        const x = M + labelW + gap + ci * (cw + gap);
        const special = c === 'Review' || c.startsWith('Capstone');
        const sheet = c.endsWith('sheet');
        s.addText(c, {
          shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: 0.06, x, y, w: cw, h: rh,
          fill: { color: special ? HEX.card2 : HEX.card }, line: sheet ? { color: D.ROLE_HEX[roles[wi]], width: 1.5 } : { color: special ? HEX.card2 : HEX.card, width: 0 },
          fontSize: 13, bold: special || sheet, color: special ? HEX.pearl : HEX.text, align: 'center', valign: 'middle', margin: 2, fontFace: 'Arial',
        });
      });
      y += rh + 0.12;
    });
    // daily block strip
    y += 0.25;
    s.addText('The daily 45-minute block', { x: M, y, w: 6, h: 0.3, fontSize: 15, bold: true, color: HEX.pearl, margin: 0, valign: 'middle', isTextBox: true });
    y += 0.42;
    const blocks = [['Ear over a drone', 10, 'root'], ['Slides + neck', 15, 'third'], ['Worksheet / review', 15, 'fifth'], ['Log', 5, 'seventh']];
    let x = M; const unit = (FULL_W - 0.1 * 3) / 45;
    blocks.forEach(([t, min, role]) => {
      const w = unit * min;
      const st = D.roleStyle(role);
      s.addText([{ text: t, options: { bold: true, fontSize: 14, color: st.text, breakLine: true } }, { text: `${min} min`, options: { fontSize: 12, color: st.text } }], {
        shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: 0.06, x, y, w, h: 0.78, fill: { color: st.fill }, line: { color: st.fill, width: 0 }, align: 'center', valign: 'middle', margin: 2,
      });
      x += w + 0.1;
    });
  }

  // Cheat sheet 1: intervals, scales, keys
  {
    const s = D.slideOf(pres, {
      kicker: K, title: 'Cheat sheet: intervals, scales, keys', light: true,
      notes: `Cheat sheet 1 of 2. Print this one and keep it on your music stand. Everything on it was computed by the same theory engine that checks every diagram in the deck.

Left: the twelve interval sizes, by half steps. The tritone has two names: an augmented 4th when it's spelled with letters a 4th apart (F up to B) and a diminished 5th when spelled a 5th apart (B up to F). The right column is the inversion of each interval. Remember the rule of 9: the numbers add up to 9, and major flips to minor, augmented to diminished, while perfect stays perfect.

Middle: scale formulas relative to the major scale. Read each one as "start from the major scale and change these notes". The seven modes run from brightest to darkest when you order them Lydian, Ionian, Mixolydian, Dorian, Aeolian, Phrygian, Locrian.

Right: every practical key with its signature and relative minor, plus the order of sharps and flats. Two tricks from Part 2: in a sharp key, the last sharp plus a half step is the key; in a flat key, the second-to-last flat is the key (F, with one flat, is the one you memorize).

How to use it: don't look things up during worksheets. Use the sheet afterwards to check, and when you check something, say it out loud and play it once. Within a few weeks you'll stop needing it, which is the point.`,
    });
    const t = D.th(true);
    // intervals
    const ivRows = [['Frets', 'Interval', 'Inverts']];
    const ivs = ['P1', 'm2', 'M2', 'm3', 'M3', 'P4', 'A4', 'P5', 'm6', 'M6', 'm7', 'M7'];
    ivs.forEach((iv) => {
      const n = T.intervalSemitones(iv);
      const name = iv === 'A4' ? 'A4 / d5  tritone' : iv === 'P1' ? 'P1  unison' : `${iv}  ${T.intervalLong(iv).toLowerCase()}`;
      ivRows.push([String(n), name, iv === 'A4' ? 'd5 / A4' : iv === 'P1' ? 'P8' : T.invertInterval(iv)]);
    });
    ivRows.push(['12', 'P8  octave', 'P1']);
    D.table(s, ivRows, { x: M, y: CONTENT_TOP, w: 3.75, colW: [0.7, 2.15, 0.9], fontSize: 13, align: ['center', 'left', 'left'], rowH: 0.33 });
    // scales
    const scRows = [['Scale', 'Formula']];
    const scales = [['Lydian', 'lydian'], ['Major (Ionian)', 'major'], ['Mixolydian', 'mixolydian'], ['Dorian', 'dorian'], ['Natural minor (Aeolian)', 'aeolian'], ['Phrygian', 'phrygian'], ['Locrian', 'locrian'], ['Harmonic minor', 'harmonicMinor'], ['Melodic minor', 'melodicMinor'], ['Phrygian dominant', 'phrygianDominant'], ['Major pentatonic', 'majPent'], ['Minor pentatonic', 'minPent'], ['Blues', 'blues']];
    scales.forEach(([n, k]) => scRows.push([n, T.FORMULAS[k].map(T.prettyDegree).join('  ')]));
    D.table(s, scRows, { x: M + 3.75 + 0.3, y: CONTENT_TOP, w: 4.75, colW: [2.2, 2.55], fontSize: 13, rowH: 0.33 });
    // keys
    const kx = M + 3.75 + 0.3 + 4.75 + 0.3; const kw = M + FULL_W - kx;
    const keyRows = [['Major', 'Minor', 'Signature']];
    for (const k of ['C', 'G', 'D', 'A', 'E', 'B', 'F♯', 'F', 'B♭', 'E♭', 'A♭', 'D♭', 'G♭']) {
      const sig = T.keySignature(k);
      keyRows.push([k, `${sig.relative}m`, T.sigLabel(sig)]);
    }
    D.table(s, keyRows, { x: kx, y: CONTENT_TOP, w: kw, colW: [0.95, 1.0, kw - 1.95], fontSize: 13, align: ['left', 'left', 'left'], rowH: 0.33 });
    D.text(s, `**Order of sharps** ${T.SHARP_ORDER.join(' ')}   ·   **Order of flats** ${T.FLAT_ORDER.join(' ')}   ·   **Sharp key** = last sharp + a half step   ·   **Flat key** = second-to-last flat`, { x: M, y: 6.45, w: FULL_W, h: 0.32, fontSize: 13, color: t.text });
  }

  // Cheat sheet 2: chords and harmony
  {
    const s = D.slideOf(pres, {
      kicker: K, title: 'Cheat sheet: chords and harmony', light: true,
      notes: `Cheat sheet 2 of 2: chords and harmony.

Left: chord formulas, each spelled from C. The symbol is what you'll see on a chart, the formula is what to build, and the last column is the spelling. Notice the double flat in C°7: B♭♭. It's the same fret as A, but the letter shows that the chord is a stack of minor 3rds, with each note's letter two steps from the last.

Middle: the diatonic chords. Major keys give Imaj7 ii7 iii7 IVmaj7 V7 vi7 viiø7. Natural minor gives the same seven chords starting from vi, renamed from the minor tonic. Harmonic minor raises the 7th to give minor keys a real V7 and vii°7. Under that are the three functions and the cadences from Part 5.

Right: the chromatic toolkit from Part 6 and the chord–scale map from Part 7. Each chromatic tool comes with what it borrows or adds. Use the chord–scale map as a starting point for soloing, not a rule. The chord tones are what matter most. The scale just fills the space between them.

The two sheets together are the whole intensive in compressed form. A good final test: take any song you play, write its chords as Roman numerals, color each one by function, and label every chord that isn't diatonic using the right-hand column. If you can do that for three songs in a row without opening the deck, you've finished the course.`,
    });
    const chRows = [['Symbol', 'Formula', 'From C']];
    for (const suf of ['', 'm', '°', '+', 'sus4', '6', 'maj7', '7', 'm7', 'm7♭5', '°7', 'm(maj7)', '9', '7♯9', '13']) {
      const label = `C${suf}${suf === 'm7♭5' ? ' (Cø7)' : ''}`;
      const formula = T.CHORD_FORMULAS[suf].map(T.prettyDegree).join(' ');
      chRows.push([label, formula, T.spellChord('C', suf).join(' ')]);
    }
    D.table(s, chRows, { x: M, y: CONTENT_TOP, w: 4.9, colW: [1.4, 1.65, 1.85], fontSize: 12, rowH: 0.31 });
    // diatonic + function
    const mx = M + 4.9 + 0.3; const mw = (FULL_W - 4.9 - 0.6) / 2;
    const maj7 = T.diatonicChords('C', 'major', 4).map((c) => c.numeral).join(' ');
    const min7 = T.diatonicChords('A', 'minor', 4).map((c) => c.numeral).join(' ');
    const hm = T.diatonicChords('A', 'harmonicMinor', 4);
    D.card(s, {
      x: mx, y: CONTENT_TOP, w: mw, h: 2.95, title: 'Diatonic 7th chords', titleSize: 15, fontSize: 13, paraSpace: 6,
      body: [`**Major** ${maj7}`, `**Minor** ${min7}`, `**Harmonic minor adds** ${hm[4].numeral}, ${hm[6].numeral}`],
    });
    D.card(s, {
      x: mx, y: CONTENT_TOP + 3.15, w: mw, h: 2.15, title: 'Function and cadences', titleSize: 15, fontSize: 13, paraSpace: 6,
      body: ['**Tonic** I iii vi  ·  **Predominant** ii IV  ·  **Dominant** V vii°', '**Authentic** V–I  ·  **Half** →V  ·  **Plagal** IV–I  ·  **Deceptive** V–vi', '**Rock** ♭VII–I  ·  ♭VI–♭VII–I'],
    });
    const rx = mx + mw + 0.3; const rw = M + FULL_W - rx;
    D.card(s, {
      x: rx, y: CONTENT_TOP, w: rw, h: 2.95, title: 'Chromatic toolkit', titleSize: 15, fontSize: 13, paraSpace: 4,
      body: ['**V7/x** a dominant 7 aimed at any diatonic chord but vii°', '**Borrowed** iv ♭VI ♭VII ♭III iiø7 (parallel minor)', '**Tritone sub** ♭II7 for V7  ·  **°7** passing', '**Modulate** pivot, direct, or via the new V7'],
    });
    D.card(s, {
      x: rx, y: CONTENT_TOP + 3.15, w: rw, h: 2.15, title: 'Chord–scale map', titleSize: 15, fontSize: 13, paraSpace: 4,
      body: ['**Imaj7** Ionian · **ii7** Dorian · **iii7** Phrygian', '**IVmaj7** Lydian · **V7** Mixolydian', '**vi7** Aeolian · **viiø7** Locrian', '**V7/vi** Phrygian dominant'],
    });
  }

  // Answer key: every worksheet answer, collected while the parts were built
  I.answerKey(pres, {
    kicker: 'Answer key',
    notes: `The answer key for every worksheet in the deck, grouped by part, then by group letter and question number. A1 is the first question of group A, and so on.

How to score yourself:
• Work a whole group before checking any of it. Checking after every question teaches you to rely on the key.
• Mark each answer right or wrong. Spelling counts: in a key or a chord, an answer with the right fret but the wrong letter (G♭ where the answer is F♯) is wrong, because it breaks the one-letter-per-step rule from Part 1.
• Passing a group means at most one miss. If you missed two or more, reread the slides that group draws on, wait a day, and redo the whole group, not just the misses.
• Where a question allows more than one good answer (some analysis and voicing questions), the key gives the most common one. If yours differs, check it against the rules on the relevant slide. If it follows them, it counts.

Keep a running tally in your log. The groups you miss most are the links in the chain that need work, and they predict which later parts will feel hard.`,
  });
}

module.exports = { build };
