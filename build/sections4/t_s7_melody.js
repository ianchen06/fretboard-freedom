// Theory Intensive · Part 7 · Melody over harmony (slides 64–73)
const T = require('../lib/theory');
const D = require('../lib/draw');
const I = require('../lib/intensive');
const { HEX, M, CONTENT_TOP, CONTENT_BOTTOM, section } = require('../lib/deck');

const K = '7 · Melody over harmony';
const FULL_W = 12.13;
const assert = (c, m) => { if (!c) throw new Error(`Part 7: ${m}`); };
const pcSet = (names) => new Set(names.map(T.pc));
const sameSet = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));

// Chord tones, available tensions and avoid notes per chord type (semitones above the root → label).
const SPEC = {
  maj7: { ct: ['1', '3', '5', '7'], tens: { 2: '9', 6: '♯11', 9: '13' }, avoid: { 5: '11' } },
  7: { ct: ['1', '3', '5', 'b7'], tens: { 2: '9', 9: '13', 1: '♭9', 3: '♯9', 6: '♯11', 8: '♭13' }, avoid: { 5: '11' }, dominant: true },
  m7: { ct: ['1', 'b3', '5', 'b7'], tens: { 2: '9', 5: '11', 9: '13' }, avoid: { 1: '♭9', 8: '♭13' } },
  'm7♭5': { ct: ['1', 'b3', 'b5', 'b7'], tens: { 2: '9', 5: '11', 8: '♭13' }, avoid: { 1: '♭9' } },
};
// Check the half-step rule: on non-dominant chords every avoid note sits a half step above a chord tone and no tension does.
for (const [suf, sp] of Object.entries(SPEC)) {
  const cts = sp.ct.map((d) => T.parseDegree(d).semis);
  for (const a of Object.keys(sp.avoid).map(Number)) assert(cts.includes(T.mod12(a - 1)), `avoid ${a} over ${suf} is not a half step above a chord tone`);
  if (!sp.dominant) for (const t of Object.keys(sp.tens).map(Number)) assert(!cts.includes(T.mod12(t - 1)), `tension ${t} over ${suf} sits a half step above a chord tone`);
}
// What a note is over a chord: { kind: 'chord tone'|'tension'|'avoid', label }.
function classify(root, suffix, note) {
  const sp = SPEC[suffix];
  const sm = T.semis(root, T.pc(note));
  for (const d of sp.ct) if (T.parseDegree(d).semis === sm) return { kind: 'chord tone', label: T.prettyDegree(d) };
  if (sp.tens[sm]) return { kind: 'tension', label: sp.tens[sm] };
  if (sp.avoid[sm]) return { kind: 'avoid', label: sp.avoid[sm] };
  throw new Error(`${note} over ${root}${suffix} is outside the chord's scale`);
}
// Degree label of any note over a chord, using 9/11/13 names for tensions.
const DEG = (root, suffix, note) => classify(root, suffix, note).label;

// Modes of the major scale, in order of the scale degree they start on.
const MODES = ['ionian', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'aeolian', 'locrian'];
const COLOR_DEG = { ionian: '4', dorian: '6', phrygian: 'b2', lydian: '#4', mixolydian: 'b7', aeolian: 'b6', locrian: 'b5' };
const MIXO_B13 = ['1', '2', '3', '4', '5', 'b6', 'b7'];

// Secondary dominant scale: the key's notes with the chord's 3rd raised (it is the target's leading tone).
function secondaryScale(key, root, formula) {
  const notes = T.spellFormula(root, formula);
  const keyPcs = pcSet(T.spellScale(key, 'major'));
  const outside = notes.filter((n) => !keyPcs.has(T.pc(n)));
  assert(outside.length === 1 && outside[0] === T.noteAbove(root, 'M3'), `${root} secondary scale should differ from ${key} only by its 3rd`);
  return { notes, outside: outside[0] };
}

// Local heading in the accent color.
function heading(s, str, x, y, w, size = 15) {
  s.addText(D.runs(str, { color: HEX.pearl, fontSize: size, bold: true }), { x, y, w, h: 0.32, margin: 0, valign: 'middle', isTextBox: true });
}

// D.tab plus labels above groups of columns. groups: [{ from, to, label }] (column indexes, inclusive).
function tabGroups(s, o) {
  const n = o.cols.length;
  const colW = (o.w - 0.3 - 0.15) / n;
  const cx = (i) => o.x + 0.3 + 0.08 + (i + 0.5) * colW;
  for (const g of o.groups || []) {
    const x1 = cx(g.from) - colW / 2; const x2 = cx(g.to) + colW / 2;
    s.addText(D.runs(g.label, { color: HEX.pearl, fontSize: 12, bold: true }), { x: x1 - 0.1, y: o.y - 0.42, w: x2 - x1 + 0.2, h: 0.26, align: 'center', valign: 'bottom', margin: 0, isTextBox: true });
  }
  return D.tab(s, o);
}

// Scale-step arithmetic for motif transformations in A natural minor (index 0 = A).
const AMIN = T.spellScale('A', 'minor');
const stepName = (i) => AMIN[((i % 7) + 7) % 7];
const motifOps = {
  sequence: (m, k) => m.map((i) => i + k),
  inversion: (m) => m.map((i) => 2 * m[0] - i),
  retrograde: (m) => [...m].reverse(),
};
const names = (m) => m.map(stepName).join(' ');

function build(pres) {
  section(pres, 'Melody over harmony');
  const slide = (title, notes) => D.slideOf(pres, { kicker: K, title, notes });

  // 64 · Divider
  D.divider(pres, {
    num: 7, title: 'Melody over harmony',
    subtitle: 'A scale tells you which notes are allowed. The chord tells you which notes matter right now. This part teaches you to aim.',
    outcomes: [
      'Name the degree of any note over any chord',
      'Sort notes into chord tones, tensions and avoid notes',
      'Pick the scale for every chord in a key, including secondary dominants',
      'Name the seven non-chord tones and use them on purpose',
      'Target chord tones with approach notes and guide-tone lines',
      'Superimpose pentatonics and arpeggios, and develop a motif',
    ],
    notes: `Part 7: Melody over harmony.

Up to now the deck has mostly been about chords: how they're built, how they live in keys, and why they move. This part flips the camera around. You're the singer or the soloist, and the chords are underneath you. The question is no longer "which notes are in the scale?" but "which notes sound right at this moment, over this chord?"

The core idea is that every note has a job relative to the chord under it. A note can be a chord tone (stable, it sounds like it belongs), a tension (a color note that adds richness, the 9, 11 and 13), or an avoid note (a note that clashes if you land on it, though it's fine in passing). The same note changes job when the chord changes. The C note is the 3rd over Am, the ♭7 over D7 and the root over C.

From there we build outward:
• The chord–scale map: one scale for every chord in a key, plus the right scale for secondary dominants.
• Non-chord tones: the seven classic ways a melody leaves and returns to the chord.
• Targeting: landing chord tones on strong beats, with approach notes and guide-tone lines.
• Substitution: playing a different pentatonic or arpeggio over a chord to get extended sounds.
• Motif development: how to make a solo sound composed instead of like a scale exercise.

Have a looper or a backing track ready. This part is impossible to learn silently. Every slide needs a chord ringing underneath you so you can hear what each note does.`,
  });

  // 65 · Chord tones, tensions, avoid notes
  {
    const s = slide('Chord tones, tensions, avoid notes', `Every note you play over a chord does one of three jobs.

Chord tones (R, 3, 5, 7) are the notes of the chord itself. They're stable. Land on one at the end of a phrase or on a strong beat and the line sounds finished and "inside" the harmony. The 3rd and 7th are the most expressive chord tones because they define the chord's quality.

Tensions (9, 11, 13 and their altered forms) are the other scale notes, numbered above the octave because that's where they sit in a voicing. They add color without clashing: the 9 over a maj7 chord sounds lush, the 13 over a dominant sounds sweet and soulful.

Avoid notes are scale notes that clash when you sustain them. The rule that finds them is simple: an avoid note sits a half step above a chord tone. Over Amaj7 the D (the 11) sits a half step above C♯ (the 3), and holding it sounds like a mistake. Over Am7 the B♭ would be a ♭9 above the root and the F a ♭13 above the 5th, so in A Aeolian the F is the avoid note. Avoid notes aren't banned. They're great as passing notes on a weak beat. Just don't park on them.

The one exception is the dominant 7 chord. Its job is to create tension that resolves, so altered tensions (♭9, ♯9, ♯11, ♭13) are welcome. Only the natural 11 still clashes, because it fights the 3rd. Turn the chord into a 7sus4 and the 11 becomes a chord tone.

Try it now: loop an Amaj7 chord. Play the board slowly, and hold each note for a full bar. The colored dots sound at rest, the gray ones sound colorful, and the ringed D sounds like it wants to fall to C♯. That falling feeling is exactly the half-step rule.

Common mistake: treating the scale as flat, with every note equal. Over a chord, the scale has a shape: strong notes, color notes and one or two notes to pass through.`);
    const rows = [['Over', 'Chord tones', 'Tensions (color)', 'Avoid (don’t land)']];
    for (const suf of ['maj7', '7', 'm7', 'm7♭5']) {
      const sp = SPEC[suf];
      const ctNotes = sp.ct.map((d) => T.spellDegree('A', d));
      const fmt = (obj) => Object.entries(obj).sort((a, b) => Number(a[0]) - Number(b[0])).map(([, lab]) => `${lab} ${T.spellDegree('A', lab)}`).join('  ');
      rows.push([
        `**A${suf}**`,
        `${sp.ct.map(T.prettyDegree).join(' ')}  ·  ${ctNotes.join(' ')}`,
        suf === '7' ? `9 B  13 F♯  · altered: ♭9 ♯9 ♯11 ♭13` : fmt(sp.tens),
        `{blue:${fmt(sp.avoid)}}${suf === '7' ? ' (unless sus)' : ''}`,
      ]);
    }
    D.table(s, rows, { x: M, y: CONTENT_TOP, w: FULL_W, colW: [1.35, 3.25, 4.4, 3.13], fontSize: 14, rowH: 0.42 });
    // Fretboard: A major scale over Amaj7, frets 4–7.
    const pos = T.positions(T.pcsOf('A', T.SCALES.major), { from: 4, to: 7 });
    const dots = pos.map((p) => {
      const sm = T.semis('A', T.pcAt(p.s, p.f));
      const c = classify('A', 'maj7', T.spellIn('A', T.pcAt(p.s, p.f)));
      const role = c.kind === 'chord tone' ? T.role(sm) : c.kind === 'avoid' ? 'blue' : 'other';
      return { s: p.s, f: p.f, label: c.label === '1' ? 'R' : c.label, role, ring: c.kind === 'avoid' };
    });
    heading(s, 'A major over **Amaj7**, frets 4–7', M, 3.95, 7.0);
    D.fretboard(s, { x: M, y: 4.4, w: 7.0, h: 1.95, from: 3, to: 8, root: 'A', dots, title: 'Amaj7 avoid', fretNumbers: 'all' });
    D.legend(s, { x: M + 0.3, y: 6.68, roles: ['root', 'third', 'fifth', 'seventh', 'other', 'blue'], names: { other: 'Tension', blue: 'Avoid (11)' }, fontSize: 11, gap: 0.18 });
    D.card(s, {
      x: 7.95, y: 3.95, w: 4.78, h: 2.9, title: 'The half-step rule',
      body: ['An avoid note sits **a half step above a chord tone**: the 11 above the 3, the ♭9 above the root, the ♭13 above the 5th. Pass through it, don’t park on it.', '**Dominant 7s are the exception.** Their job is tension, so ♭9, ♯9, ♯11 and ♭13 all work. Only the 11 still fights the 3rd.'],
      fontSize: 14, paraSpace: 8,
    });
  }

  // 66 · The chord–scale map
  {
    const s = slide('The chord–scale map', `Here is the practical payoff of the modes. In a key, every diatonic chord gets its own scale, and that scale is simply the key's seven notes started from the chord's root. Over Dm7 in C you play C major notes, but you hear them as D Dorian because D is home for that bar. Over G7 the same notes are G Mixolydian.

Why bother with seven names for one set of notes? Because the name tells you where the chord tones, tensions and avoid notes fall. Dorian over Dm7 tells you the 6th (B) is the bright color note. Mixolydian over G7 tells you the 4th (C) is the note to pass through, not land on. Lydian over Fmaj7 tells you there is no avoid note at all, because the ♯4 (B) is a tension, not a clash. That's why many players prefer Lydian over a maj7 chord even on the I chord.

Secondary dominants (Part 6) borrow one note from outside the key: their 3rd, which is the leading tone of the chord they resolve to. The best scale keeps every other note of the key and raises just that one:
• D7 (V7/V) uses D Mixolydian: C major with F♯.
• A7 (V7/ii) uses A Mixolydian ♭13: C major with C♯.
• E7 (V7/vi) uses E Phrygian dominant: C major with G♯. This is the sound of harmonic minor over the V chord, a staple of neoclassical metal.
Every one of these scales was checked by the theory engine: each differs from C major only by the chord's 3rd.

Try it now: loop Dm7–G7–Cmaj7, one bar each. Play only C major notes, but start and end each bar on the root, 3rd or 7th of that bar's chord. Then add the A7: Cmaj7–A7–Dm7–G7. Over the A7 bar, change one note, C to C♯, and listen to how it pulls into the Dm7.

Common mistake: switching to a new fingering pattern for every mode. You don't need new shapes. Same notes, new home, new targets.`);
    const key = 'C';
    const keyPcs = pcSet(T.spellScale(key, 'major'));
    const dia = T.diatonicChords(key, 'major', 4);
    const COLOR_TXT = {
      ionian: '4 is the avoid note; Lydian is the no-avoid option', dorian: 'Bright 6: the hopeful minor', phrygian: '♭2 is dark and Spanish; avoid on m7',
      lydian: '♯4 floats: no avoid note', mixolydian: '♭7 is the bluesy rock dominant', aeolian: '♭6 is the sad minor; avoid on m7', locrian: '♭2 is the avoid note',
    };
    const rows = [['Chord', 'Job', 'Scale', 'Notes (color note in teal)', 'What to know']];
    dia.forEach((c, i) => {
      const mode = MODES[i];
      const notes = T.spellScale(c.root, mode);
      assert(sameSet(pcSet(notes), keyPcs), `${c.root} ${mode} is not C major`);
      const ci = T.FORMULAS[mode].indexOf(COLOR_DEG[mode]);
      rows.push([`**${c.name}**`, c.numeral, `${c.root} ${T.SCALE_NAMES[mode]}`, notes.map((n, k) => (k === ci ? `{blue:${n}}` : n)).join(' '), COLOR_TXT[mode]]);
    });
    const SEC = [
      ['D', 'V7/V', T.FORMULAS.mixolydian, 'Mixolydian', 'C major with F♯'],
      ['A', 'V7/ii', MIXO_B13, 'Mixolydian ♭13', 'C major with C♯'],
      ['E', 'V7/vi', T.FORMULAS.phrygianDominant, 'Phrygian dominant', 'C major with G♯'],
    ];
    for (const [root, num, f, name, what] of SEC) {
      const sc = secondaryScale(key, root, f);
      rows.push([`**${root}7**`, `{blue:${num}}`, `${root} ${name}`, sc.notes.map((n) => (n === sc.outside ? `{blue:${n}}` : n)).join(' '), `${what}: its 3rd leads into the target`]);
    }
    D.table(s, rows, { x: M, y: CONTENT_TOP, w: FULL_W, colW: [1.15, 0.95, 2.45, 3.1, 4.48], fontSize: 14, rowH: 0.42 });
    s.addText('Diatonic chords use the key’s own 7 notes. Secondary dominants (teal numerals) change exactly one note: their 3rd.', { x: M, y: 6.5, w: FULL_W, h: 0.3, fontSize: 13, color: HEX.muted, margin: 0, valign: 'middle', isTextBox: true });
  }

  // 67 · Non-chord tones
  {
    const s = slide('Non-chord tones: seven ways to leave the chord', `A melody that only plays chord tones sounds like an arpeggio exercise. Real melodies step away from the chord and come back, and there are only a handful of ways to do that. Classical theory gives each one a name, and the names are useful because each move has its own feeling.

• Passing tone: a scale step that connects two different chord tones, moving in one direction (C–D–E over C). Smooth, on a weak beat.
• Neighbor tone: step away and step back to the same note (E–F–E). It decorates a note.
• Appoggiatura: leap to a non-chord tone on a strong beat, then resolve by step (C up to A, down to G). This is the "sigh" or "ache" of expressive melody, and the most emotional of the seven.
• Suspension: a note from the previous chord is held while the harmony changes under it, then it resolves down by step. The classic is the 4–3: F held from a Dm or F chord into C, then falling to E. It has three parts: preparation, suspension, resolution.
• Anticipation: a note of the next chord arrives early, usually on the last 8th of the bar. Very common in pop and Mandopop vocal lines, and in pushed rock rhythms.
• Escape tone: step away from a chord tone, then leap back in the opposite direction (E–F, down to C).
• Pedal: one note is held or repeated while chords or melody move around it. On guitar this is the alternating "pedal riff", common in metal and classic rock.

The tab shows each one over C. The labeled note is the non-chord tone.

Try it now: loop a C chord. Play each example and sing it. Then improvise using only chord tones plus one kind of non-chord tone at a time: two minutes of passing tones only, then two minutes of neighbors only.

Common mistake: putting appoggiaturas and suspensions on weak beats. Their power comes from the clash landing on the beat and then resolving.`);
    const rows = [
      ['Type', 'Approached by', 'Left by', 'Beat'],
      ['**Passing**', 'Step', 'Step, same way', 'Weak'],
      ['**Neighbor**', 'Step', 'Step back', 'Weak'],
      ['**Appoggiatura**', '{third:Leap}', 'Step, opposite way', '{root:Strong}'],
      ['**Suspension**', 'Held over', 'Step down', '{root:Strong}'],
      ['**Anticipation**', 'Step', 'Held into next chord', 'Weak'],
      ['**Escape**', 'Step', '{third:Leap}, opposite way', 'Weak'],
      ['**Pedal**', 'Held or repeated', 'Harmony moves on', 'Any'],
    ];
    D.table(s, rows, { x: M, y: CONTENT_TOP, w: 6.15, colW: [1.65, 1.45, 2.05, 1.0], fontSize: 13, rowH: 0.38 });
    const CMAJ = { root: 'C', scale: T.SCALES.major };
    heading(s, 'Over C (C E G); the labeled note is the non-chord tone', 7.1, CONTENT_TOP, 5.63, 14);
    tabGroups(s, {
      x: 7.1, y: 2.55, w: 5.63, gap: 0.2, check: CMAJ,
      cols: ['3:5', '3:7', '2:5', '|', '2:5', '2:6', '2:5', '|', '3:5', '2:10', '2:8', '|', '2:6', '2:6', '2:5'],
      counts: ['', 'PT', '', '', '', 'NT', '', '', '', 'APP', '', '', 'prep', 'SUS', ''],
      groups: [{ from: 0, to: 2, label: 'Passing' }, { from: 4, to: 6, label: 'Neighbor' }, { from: 8, to: 10, label: 'Appogg.' }, { from: 12, to: 14, label: 'Suspension' }],
    });
    tabGroups(s, {
      x: 7.1, y: 4.75, w: 5.63, gap: 0.2, check: CMAJ,
      cols: ['1:7', '1:8', '1:8', '|', '2:5', '2:6', '3:5', '|', '1:5', '2:8', '1:7', '2:8', '1:8', '2:8'],
      counts: ['G', 'ANT', 'C', '', '', 'ET', '', '', '', 'PED', '', 'PED', '', 'PED'],
      groups: [{ from: 0, to: 2, label: 'Anticip. G→C' }, { from: 4, to: 6, label: 'Escape' }, { from: 8, to: 13, label: 'Pedal (repeated G)' }],
    });
    D.card(s, {
      x: M, y: 5.2, w: 6.15, h: 1.65, title: 'Strong beat or weak beat?',
      body: 'Passing, neighbor, escape and anticipation sit on **weak beats** and sound smooth. Appoggiaturas and suspensions land **on the beat**: the clash is the point, so they must resolve.',
      fontSize: 14,
    });
  }

  // 68 · Targeting and guide-tone lines
  {
    const s = slide('Targeting and guide-tone lines', `Targeting is the habit that makes a solo sound like it knows the chords. The idea: put chord tones on the strong beats (beat 1 and beat 3), and use the weak beats to approach them.

The guide-tone line is the skeleton. Of a 7th chord's four notes, the 3rd and the 7th define it, and when the chord changes they move the shortest possible distance. The three boards show the guide tones of A7, D7 and E7, the three chords of an A blues, on the D and G strings:
• A7 to D7: C♯ falls a half step to C, and G falls a half step to F♯. The 3rd of one chord becomes the 7th of the next.
• D7 to E7: both voices rise a whole step (F♯ to G♯, C to D).
• E7 back to A7: D falls to C♯ and G♯ falls to G, again by half steps.
Play only these two-note shapes through a 12-bar and you'll hear the whole progression with no root and no strumming.

Then decorate the targets. The tab shows three ways to arrive on C♯, the 3rd of A7, on beat 1:
• From a half step below: C to C♯. This is the bluesiest, since the C is also the ♭3, the blue note.
• From a scale step above: D down to C♯.
• Enclosure: above, then below, then the target (D, C, C♯). Jazz players use enclosures constantly. They sound sophisticated and they always land.

Try it now: put on an A blues shuffle. First chorus: play only the guide tones, whole notes, changing exactly with the chords. Second chorus: same notes, but approach each new guide tone from a half step below on beat 4 of the previous bar. Third chorus: improvise freely, but check that every beat 1 lands on a 3rd or 7th.

Common mistake: approaching on the strong beat and landing on the weak one. If the approach note falls on beat 1, the wrong note is the one the listener hears as important. Count it, and land the target on the beat.`);
    const boards = [
      { name: 'A7', root: 'A', dots: [{ s: 6, f: 5, label: 'R', role: 'root', small: true }, { s: 4, f: 5, label: '♭7', role: 'seventh' }, { s: 3, f: 6, label: '3', role: 'third' }], txt: 'C♯ (3) and G (♭7)' },
      { name: 'D7', root: 'D', dots: [{ s: 5, f: 5, label: 'R', role: 'root', small: true }, { s: 4, f: 4, label: '3', role: 'third' }, { s: 3, f: 5, label: '♭7', role: 'seventh' }], txt: 'F♯ (3) and C (♭7)' },
      { name: 'E7', root: 'E', dots: [{ s: 5, f: 7, label: 'R', role: 'root', small: true }, { s: 4, f: 6, label: '3', role: 'third' }, { s: 3, f: 7, label: '♭7', role: 'seventh' }], txt: 'G♯ (3) and D (♭7)' },
    ];
    const bw = 3.3; const gapB = (FULL_W - 3 * bw) / 2;
    boards.forEach((b, i) => {
      const x = M + i * (bw + gapB);
      s.addText([{ text: b.name, options: { bold: true, color: HEX.white, fontSize: 17 } }, { text: `   ${b.txt}`, options: { color: HEX.muted, fontSize: 12 } }], { x, y: CONTENT_TOP, w: bw, h: 0.34, margin: 0, valign: 'middle', isTextBox: true });
      D.fretboard(s, { x, y: CONTENT_TOP + 0.42, w: bw, h: 1.35, from: 3, to: 8, root: b.root, dots: b.dots, title: `GT ${b.name}`, fretNumbers: 'all' });
      if (i < 2) {
        const ax = x + bw + 0.12; const aw = gapB - 0.24;
        I.arrow(s, ax, CONTENT_TOP + 1.15, ax + aw, CONTENT_TOP + 1.15, { color: HEX.pearl });
        s.addText(i === 0 ? '½ down' : 'step up', { x: ax, y: CONTENT_TOP + 0.82, w: aw, h: 0.26, fontSize: 11, color: HEX.pearl, bold: true, align: 'center', valign: 'bottom', margin: 0, isTextBox: true });
      }
    });
    heading(s, 'Three ways to land on C♯ (the 3rd of A7) on beat 1', M, 4.05, 7.4);
    tabGroups(s, {
      x: M, y: 4.95, w: 7.4, gap: 0.2, check: { root: 'A', scale: T.SCALES.mixolydian, extra: [3] },
      cols: ['3:5', '3:6', '|', '3:7', '3:6', '|', '3:7', '3:5', '3:6'],
      counts: ['4&', '1', '', '4&', '1', '', '4', '4&', '1'],
      groups: [{ from: 0, to: 1, label: '½ step below' }, { from: 3, to: 4, label: 'Step above' }, { from: 6, to: 8, label: 'Enclosure' }],
    });
    D.card(s, {
      x: 8.35, y: 4.05, w: 4.38, h: 2.8, title: 'Targeting rules',
      bullets: ['Strong beats (1 and 3) get **chord tones**, ideally the 3rd or 7th', 'Weak beats get the **approach**', 'At a chord change, move to the **nearest** guide tone'],
      fontSize: 14, paraSpace: 6,
    });
  }

  // 69 · Pentatonic substitution
  {
    const s = slide('Pentatonic substitution', `You already own the minor pentatonic shapes. Pentatonic substitution reuses them: play a minor pentatonic built on a different root over the chord, and you get a different set of degrees, and so a different sound, with no new fingerings.

The table names every note's degree over the chord, computed by the theory engine.

Over Am7:
• A minor pentatonic: R ♭3 4 5 ♭7. Home base, all chord tones plus the 4.
• E minor pentatonic (from the 5th): 5 ♭7 R 2 4. It drops the ♭3 and adds the 9, so it sounds open and modern.
• B minor pentatonic (from the 2nd): 2 4 5 6 R. The 9 and the 6 together are the Dorian sound, bright and hopeful.
• D minor pentatonic (from the 4th): 4 ♭6 ♭7 R ♭3. The ♭6 makes it Aeolian, dark and sad.

Over A7:
• A minor pentatonic is the blues sound. Its ♭3 (C) rubs against the chord's major 3rd (C♯), and that friction is the blues.
• A major pentatonic is sweet and country-ish, all chord tones and safe tensions: R 2 3 5 6.
• E minor pentatonic gives 5 ♭7 R 2 4: no 3rd at all, so it sounds like A7sus4 or A9sus4. Modern rock and fusion players use it constantly.

The rule behind them all: a minor pentatonic is five adjacent notes on the circle of fifths. Pick the one that contains the colors you want and avoids the notes that clash.

The board shows B minor pentatonic box 1 labeled over an A root: the same shape you know, now spelling 2 4 5 6 R.

Try it now: loop Am7. Play box 1 of A minor pentatonic at fret 5 for eight bars, then the same box 1 shape at fret 7 (B minor) for eight bars. Same fingers, new sound. Then try E minor pentatonic at fret 12.

Common mistake: using B minor pentatonic over Am7 when the song is in A Aeolian. Its F♯ clashes with an F in the melody or chords. Substitutions have to agree with the key.`);
    const subRow = (chordLabel, chordRoot, pentRoot, sound) => {
      const notes = T.spellScale(pentRoot, 'minPent');
      const degs = notes.map((n) => T.INTERVAL[T.semis(chordRoot, T.pc(n))]);
      const nice = degs.map((d) => (['2', '6', '♭6'].includes(d) ? `{blue:${d}}` : d)).join(' ');
      return [chordLabel, `**${pentRoot} minor pent**`, notes.join(' '), nice, sound];
    };
    const rows = [
      ['Over', 'Play', 'Notes', 'Degrees over A', 'Sound'],
      subRow('Am7', 'A', 'A', 'Home: minor blues-rock'),
      subRow('Am7', 'A', 'E', 'Open, adds the 9'),
      subRow('Am7', 'A', 'B', 'Dorian: the 9 and 6'),
      subRow('Am7', 'A', 'D', 'Aeolian: dark ♭6'),
      subRow('A7', 'A', 'A', 'Blues: ♭3 rubs the 3'),
      ['A7', '**A major pent**', T.spellScale('A', 'majPent').join(' '), T.spellScale('A', 'majPent').map((n) => T.INTERVAL[T.semis('A', T.pc(n))]).join(' '), 'Sweet, country, safe'],
      subRow('A7', 'A', 'E', 'Sus sound: no 3rd'),
    ];
    D.table(s, rows, { x: M, y: CONTENT_TOP, w: 7.45, colW: [0.75, 1.7, 1.5, 1.55, 1.95], fontSize: 14, rowH: 0.6 });
    const pos = T.pentBox('B', 1);
    heading(s, 'B minor pent box 1, labeled over **A**', 8.35, CONTENT_TOP, 4.38);
    D.fretboard(s, {
      x: 8.35, y: CONTENT_TOP + 0.5, w: 4.38, h: 2.3, from: 6, to: 11, root: 'A', title: 'B pent over A',
      dots: D.dotsFor(pos, { root: 'A', label: 'interval', roleOf: (sm) => (sm === 9 || sm === 2 ? 'blue' : T.role(sm)) }),
    });
    s.addText('Teal = the Dorian colors (2 and 6)', { x: 8.35, y: CONTENT_TOP + 3.15, w: 4.38, h: 0.26, fontSize: 12, color: HEX.muted, margin: 0, isTextBox: true });
    D.card(s, {
      x: 8.35, y: 5.0, w: 4.38, h: 1.85, title: 'Same shape, new root',
      body: 'Slide box 1 to a new fret and the **degrees** change, not the fingering. Choose the root whose notes carry the color you want.',
      fontSize: 14,
    });
  }

  // 70 · Arpeggio superimposition
  {
    const s = slide('Arpeggio superimposition', `Superimposition means playing one chord's arpeggio over a different chord. The most useful version: build an arpeggio from the 3rd of the chord. Because chords are stacks of 3rds, the arpeggio from the 3rd gives you 3–5–7–9, the upper part of the chord plus its 9th. You get an extended chord sound (maj9, 9, m9) using a 7th-chord shape you already know.

The four rows show the most common cases, each one checked by the theory engine (chord + arpeggio = the extended chord):
• Over Cmaj7, play Em7 (E G B D) for 3 5 7 9, which sounds like Cmaj9.
• Over A7, play C♯m7♭5 (C♯ E G B) for 3 5 ♭7 9, which sounds like A9. This is the classic jazz-blues move.
• Over Am7, play Cmaj7 (C E G B) for ♭3 5 ♭7 9: Am9.
• Over G7, play Bm7♭5 (B D F A) for 3 5 ♭7 9: G9.

Notice the pattern: the arpeggio from the 3rd is always the diatonic 7th chord a 3rd above. In a key it's simply the chord two scale steps up: over I play iii, over V play vii, over vi play I.

Why it sounds good: the arpeggio leaves out the root, which the bass already covers, and replaces it with the 9. So you're playing the most colorful part of the chord without fighting the band.

The board shows an Em7 arpeggio, frets 7–10, labeled as degrees over a C root. The teal dots are the 9.

Try it now: loop a Cmaj7. Play a C major 7 arpeggio for four bars, then the Em7 arpeggio in the same area for four bars. Listen for the moment the line starts to sound like a ballad or neo-soul record. That's the 9.

Common mistake: superimposing from the wrong note. An arpeggio from the 5th (G major over C) gives 5 7 9, still nice; from the 7th (Bm7♭5 over Cmaj7) gives 7 9 ♯11 13 and needs a Lydian context. Start with the 3rd.`);
    const CASES = [
      { root: 'C', suf: 'maj7', arpRoot: 'E', arpSuf: 'm7', target: 'maj9' },
      { root: 'A', suf: '7', arpRoot: 'C♯', arpSuf: 'm7♭5', target: '9' },
      { root: 'A', suf: 'm7', arpRoot: 'C', arpSuf: 'maj7', target: 'm9' },
      { root: 'G', suf: '7', arpRoot: 'B', arpSuf: 'm7♭5', target: '9' },
    ];
    const tw = 1.35; const th = 0.95; const rowGap = 0.28; const y0 = CONTENT_TOP;
    CASES.forEach((c, i) => {
      assert(c.arpRoot === T.noteAbove(c.root, c.suf === 'm7' ? 'm3' : 'M3'), `arp root of ${c.root}${c.suf}`);
      const chordNotes = T.spellChord(c.root, c.suf);
      const arpNotes = T.spellChord(c.arpRoot, c.arpSuf);
      const union = new Set([...chordNotes, ...arpNotes].map(T.pc));
      assert(sameSet(union, pcSet(T.spellChord(c.root, c.target))), `${c.root}${c.suf} + ${c.arpRoot}${c.arpSuf} != ${c.root}${c.target}`);
      const degs = arpNotes.map((n) => { const sm = T.semis(c.root, T.pc(n)); return sm === 2 ? '{blue:9}' : T.INTERVAL[sm]; }).join(' ');
      const y = y0 + i * (th + rowGap);
      I.tile(s, { x: M, y, w: tw, h: th, top: c.root + c.suf, bottom: 'chord', topSize: 18, bottomSize: 12 });
      s.addText('+', { x: M + tw, y, w: 0.4, h: th, fontSize: 22, bold: true, color: HEX.muted, align: 'center', valign: 'middle', margin: 0, isTextBox: true });
      I.tile(s, { x: M + tw + 0.4, y, w: tw + 0.2, h: th, top: c.arpRoot + c.arpSuf, bottom: 'arpeggio', role: 'blue', topSize: 18, bottomSize: 12 });
      s.addText('=', { x: M + 2 * tw + 0.6, y, w: 0.4, h: th, fontSize: 22, bold: true, color: HEX.muted, align: 'center', valign: 'middle', margin: 0, isTextBox: true });
      I.tile(s, { x: M + 2 * tw + 1.0, y, w: tw, h: th, top: c.root + c.target, bottom: 'sound', role: 'third', topSize: 18, bottomSize: 12 });
      s.addText(D.runs(`${arpNotes.join(' ')}  →  ${degs}`, { color: HEX.text, fontSize: 14, bold: true }), { x: M + 3 * tw + 1.2, y, w: 2.05, h: th, margin: 0, valign: 'middle', isTextBox: true });
    });
    const pos = T.chordTonesIn('E', T.CHORDS.min7, 7, 10);
    const dots = pos.map((p) => {
      const sm = T.semis('C', T.pcAt(p.s, p.f));
      return sm === 2 ? { s: p.s, f: p.f, label: '9', role: 'blue' } : { s: p.s, f: p.f, label: T.INTERVAL[sm], role: T.role(sm) };
    });
    heading(s, 'Em7 arpeggio, labeled over **C**', 8.45, CONTENT_TOP, 4.28);
    D.fretboard(s, { x: 8.45, y: CONTENT_TOP + 0.5, w: 4.28, h: 2.2, from: 6, to: 11, root: 'C', dots, title: 'Em7 over C' });
    D.card(s, {
      x: 8.45, y: 4.85, w: 4.28, h: 2.0, title: 'From the 3rd = 3 5 7 9',
      body: 'In a key it’s the chord **two steps up**: over I play iii, over V play vii, over vi play I.',
      fontSize: 14,
    });
  }

  // 71 · Motif development
  {
    const s = slide('Motif development', `The difference between a solo that sounds composed and one that sounds like a scale exercise is usually motif development. A motif is a short idea, three to five notes with a rhythm. Instead of inventing new material every bar, you state the motif and then change it in ways the ear can still follow.

The six variations use one motif in A minor: E G A G, in 8th notes.
• Original: state it clearly, ideally twice (repetition builds expectation).
• Diatonic sequence: the same shape moved up one scale step: F A B A. The intervals adjust to stay in the key. Sequences are the backbone of neoclassical and melodic metal soloing.
• Inversion: flip the direction of every interval: up a 3rd becomes down a 3rd. Starting on E gives E C B C.
• Retrograde: play it backwards: G A G E. Harder to hear, but it keeps the same notes and makes a natural answer.
• Rhythmic displacement: same notes, starting an 8th note later. The accents land somewhere new, which is a big effect for no new notes.
• Augmentation: double every note's length. It sounds broader and more vocal, great for the start of a chorus or the climax of a solo.
Two more tools from the same box: diminution (halve the lengths) and truncation (drop the last note or two, then repeat the shortened version faster, which builds urgency).

All the tab is checked against A natural minor.

Try it now: over an Am vamp, play the original twice, then the sequence, then the inversion, then go back to the original. That's eight bars and it already sounds like a composed melody. Then improvise for 32 bars using only this motif and its variations.

Common mistake: changing everything at once. Change one thing (pitch level, direction, rhythm or length) and keep the rest, so the listener can follow.`);
    const MOTIF = [4, 6, 7, 6]; // E G A G as A-minor scale steps
    // A-minor scale step (0 = A3 on the G string area) → tab position around the 5th fret.
    const STEP_POS = { 1: '3:4', 2: '3:5', 4: '2:5', 5: '2:6', 6: '2:8', 7: '1:5', 8: '1:7' };
    const tabOf = (steps) => steps.map((i) => { assert(STEP_POS[i], `no tab position for step ${i}`); return STEP_POS[i]; });
    const seq = motifOps.sequence(MOTIF, 1);
    const inv = motifOps.inversion(MOTIF);
    const ret = motifOps.retrograde(MOTIF);
    assert(names(MOTIF) === 'E G A G' && names(seq) === 'F A B A' && names(inv) === 'E C B C' && names(ret) === 'G A G E', 'motif names');
    const pad = (cols, n = 8) => [...cols, ...Array(n - cols.length).fill('')];
    const COUNTS8 = ['1', '&', '2', '&', '3', '&', '4', '&'];
    const VARS = [
      { t: 'Original: E G A G', cols: pad(tabOf(MOTIF)) },
      { t: `Sequence up a step: ${names(seq)}`, cols: pad(tabOf(seq)) },
      { t: `Inversion: ${names(inv)}`, cols: pad(tabOf(inv)) },
      { t: `Retrograde: ${names(ret)}`, cols: pad(tabOf(ret)) },
      { t: 'Displaced an 8th later', cols: pad(['', ...tabOf(MOTIF)]) },
      { t: 'Augmented: twice as long', cols: tabOf(MOTIF).flatMap((c) => [c, '']) },
    ];
    // Check the hand-placed tab spells the intended notes.
    const spell = (cols) => cols.filter(Boolean).map((c) => { const [st, f] = c.split(':').map(Number); return T.spellIn('A', T.pcAt(st, f)); }).join(' ');
    assert(spell(VARS[0].cols) === names(MOTIF) && spell(VARS[1].cols) === names(seq) && spell(VARS[2].cols) === names(inv) && spell(VARS[3].cols) === names(ret), 'motif tab spelling');
    const cw = (FULL_W - 0.6) / 3; const rowH = 2.3;
    VARS.forEach((v, i) => {
      const x = M + (i % 3) * (cw + 0.3); const y = CONTENT_TOP + Math.floor(i / 3) * rowH;
      heading(s, v.t, x, y, cw, 14);
      D.tab(s, { x, y: y + 0.5, w: cw, gap: 0.2, cols: v.cols, counts: COUNTS8, check: { root: 'A', scale: T.SCALES.minor } });
    });
    s.addText(D.runs('**Also:** diminution (halve the lengths) and truncation (drop the last notes, repeat faster). Change **one thing** at a time.', { color: HEX.text, fontSize: 14 }), { x: M, y: 6.3, w: FULL_W, h: 0.4, margin: 0, valign: 'middle', isTextBox: true });
  }

  // 72 · Exercises on paper
  {
    const degItems = [['F♯', 'D', '7'], ['B', 'C', 'maj7'], ['D', 'F', 'maj7'], ['B♭', 'G', '7'], ['A', 'G', '7'], ['E♭', 'F', 'm7'], ['D', 'A', 'm7'], ['F', 'B', 'm7♭5'], ['C', 'E', '7'], ['G♯', 'D', 'maj7']]
      .map(([n, r, suf]) => [`${n} over ${r}${suf}`, DEG(r, suf, n)]);
    const kindItems = [['F', 'C', 'maj7'], ['D', 'C', 'maj7'], ['B', 'G', 'maj7'], ['F', 'C', '7'], ['A♭', 'C', '7'], ['B♭', 'D', 'm7'], ['E', 'D', 'm7'], ['E♭', 'D', 'm7'], ['G', 'B', 'm7♭5'], ['C', 'B', 'm7♭5']]
      .map(([n, r, suf]) => { const c = classify(r, suf, n); return [`${n} over ${r}${suf}`, `${c.kind} (${c.label})`]; });
    const G = T.diatonicChords('G', 'major', 4);
    const scaleItems = [1, 3, 4, 2, 5, 6].map((i) => [`${G[i].name} in G`, `${G[i].root} ${T.SCALE_NAMES[MODES[i]]}`]);
    const sB = secondaryScale('G', 'B', T.FORMULAS.phrygianDominant);
    const sE = secondaryScale('G', 'E', MIXO_B13);
    assert(sB.outside === 'D♯' && sE.outside === 'G♯', 'secondary scales in G');
    scaleItems.push(['B7 → Em in G', 'B Phrygian dominant'], ['E7 → Am in G', 'E Mixolydian ♭13']);
    I.worksheet(pres, {
      part: 7, kicker: K,
      intro: 'Work from memory, then check each answer on the neck over a looped chord.',
      groups: [
        { key: 'A', title: 'Degree over the chord', instr: 'Use 9, 11, 13 for tensions (♭9, ♯9, ♯11, ♭13 when altered).', cols: 2, items: degItems, weight: 1.15 },
        { key: 'B', title: 'Chord tone, tension or avoid?', instr: 'Name the job and the degree.', cols: 2, items: kindItems, weight: 1.15 },
        { key: 'C', title: 'Which scale?', instr: 'Name the scale that fits the chord in the key.', items: scaleItems, weight: 0.75 },
      ],
      notes: `Worksheet 1 for Part 7. About 25 minutes.

Group A: name the degree of the note over the chord. Count up from the chord's root by letter first, then check the half steps, exactly as in Part 1. Use the extension names for non-chord tones: 9, 11 and 13, with ♭ and ♯ for the altered versions on dominant chords. For example, B♭ over G7 is a ♯9 (it's spelled as a raised 9th even though it sounds like a minor 3rd, because the chord already has a major 3rd).

Group B: decide whether each note is a chord tone, a tension or an avoid note, and give its degree. Use the half-step rule from the slide: on maj7, m7 and m7♭5 chords, a scale note a half step above a chord tone is an avoid note. On dominant 7 chords only the natural 11 is an avoid note.

Group C: name the scale for each chord in the key of G. For the diatonic chords, use the mode that starts on the chord's root. For the two secondary dominants, keep the key's notes and raise the chord's 3rd. Then name the result.

Scoring: check against the answer key at the back of the deck. One miss per group is a pass. If you miss two or more in a group, reread that slide, loop the chord on your guitar, and play each note in the question over it before trying again tomorrow.

Make it musical: for every group B question, actually play the note over the chord and hold it for a bar. Your ear should agree with your answer, especially on the avoid notes.`,
    });

    // Superimposition answers, checked: arpeggio from the 3rd and pentatonic colors.
    const arpFrom3 = (root, suf, arpSuf, target) => {
      const ar = T.noteAbove(root, suf === 'm7' ? 'm3' : 'M3');
      const union = new Set([...T.spellChord(root, suf), ...T.spellChord(ar, arpSuf)].map(T.pc));
      assert(sameSet(union, pcSet(T.spellChord(root, target))), `superimpose ${root}${suf}`);
      return `${ar}${arpSuf}`;
    };
    const dmTensions = T.spellScale('A', 'minPent').filter((n) => !T.spellChord('D', 'm7').includes(n)).map((n) => `${DEG('D', 'm7', n)} (${n})`).join(', ');
    const supItems = [
      ['Fmaj7: arpeggio from the 3rd → Fmaj9?', arpFrom3('F', 'maj7', 'm7', 'maj9')],
      ['D7: arpeggio from the 3rd → D9?', arpFrom3('D', '7', 'm7♭5', '9')],
      ['Em7: arpeggio from the ♭3 → Em9?', arpFrom3('E', 'm7', 'maj7', 'm9')],
      ['G7: arpeggio from the 3rd → G9?', arpFrom3('G', '7', 'm7♭5', '9')],
      ['Am7: which minor pent adds the Dorian 6?', `${T.noteAbove('A', 'M2')} minor pentatonic`],
      ['A minor pent over Dm7: which tensions?', dmTensions],
    ];
    const ncItems = [
      ['Over C: C–D–E. What is the D?', 'passing tone'],
      ['Over C: E–F–E. What is the F?', 'neighbor tone'],
      ['Over C: leap C up to A, step down to G. The A?', 'appoggiatura'],
      ['F held from Dm into C, then down to E. The F?', 'suspension (4–3)'],
      ['Over C: E up to F, leap down to C. The F?', 'escape tone'],
      ['C on the last 8th of G7, held into C. The first C?', 'anticipation'],
      ['Low E repeats under changing chords. It is a?', 'pedal'],
    ];
    const M2 = [0, 2, 1, 4]; // A C B E
    assert(names(M2) === 'A C B E', 'worksheet motif');
    const motifItems = [
      ['Retrograde', names(motifOps.retrograde(M2))],
      ['Diatonic inversion from A', names(motifOps.inversion(M2))],
      ['Sequence up one scale step', names(motifOps.sequence(M2, 1))],
      ['Sequence down one scale step', names(motifOps.sequence(M2, -1))],
    ];
    I.worksheet(pres, {
      part: 7, kicker: K, title: 'Exercises on paper (2)',
      intro: 'Group F uses the motif A C B E in A natural minor. Write note names.',
      groups: [
        { key: 'D', title: 'Superimpose', instr: 'Name the arpeggio or pentatonic.', items: supItems, weight: 1.15 },
        { key: 'E', title: 'Name the non-chord tone', items: ncItems, weight: 1.15 },
        { key: 'F', title: 'Develop the motif', instr: 'Motif: A C B E.', items: motifItems, weight: 0.8 },
      ],
      notes: `Worksheet 2 for Part 7. About 20 minutes.

Group D: superimposition. For the first four, find the arpeggio built on the chord's 3rd (the ♭3 for a minor chord) and name its quality. The trick: the arpeggio from the 3rd is the diatonic 7th chord two scale steps up, so over a maj7 chord it's a m7, over a dominant 7 it's a m7♭5, and over a m7 it's a maj7. For the pentatonic questions, write out the pentatonic notes and name each one's degree over the chord.

Group E: name the non-chord tone. Ask two questions each time: how was the note approached (step, leap or held over), and how was it left (step, leap or repeated)? The table on the non-chord tones slide does the rest.

Group F: develop the motif A C B E. Think in scale steps, not frets. A to C is up two scale steps, C to B is down one, B to E is up three. Retrograde reverses the notes. Inversion flips every step's direction, starting from A. A sequence moves every note the same number of scale steps.

Scoring: one miss per group is a pass. For group F, play your answers. If the inversion doesn't sound like the motif in a mirror, recount the steps.

Then take it to the guitar: play the motif and all four of your answers over an Am vamp, two bars each. That's a ten-bar composed melody you wrote from one idea.`,
    });
  }

  // 73 · Exercises on the neck
  D.practice(pres, {
    kicker: K, title: 'Exercises on the neck',
    intro: 'All four need a chord ringing under you: a looper, a backing track or a drone.',
    drills: [
      { name: 'Name it, then play it', how: 'Loop one chord (Amaj7, A7 or Am7). In one position, pick a note, say its degree out loud, then play and hold it. Change the chord every 5 minutes.', tempo: 'Free time', time: '5 min', done: '20 notes in a row named right within 2 seconds' },
      { name: 'Land every bar', how: 'Over an A 12-bar shuffle, improvise freely, but beat 1 of every bar must be a 3rd or 7th of the chord.', tempo: '70 → 90 bpm', time: '10 min', done: '12 of 12 bars, three choruses running' },
      { name: 'Guide tones + approach', how: 'Play only 3rds and 7ths through the 12-bar (D and G strings), whole notes. Then add a half-step approach on beat 4.', tempo: '60 → 80 bpm', time: '5 min', done: 'Clean at 80 without looking' },
      { name: 'One motif, 32 bars', how: 'Over an Am vamp, play a 4-note motif, then only its sequence, inversion, retrograde, displacement and augmentation.', tempo: '70 bpm', time: '10 min', done: '32 bars with no new material' },
    ],
    notes: `Four drills that move Part 7 from paper to fingers. Budget about 30 minutes, or split them across two days.

1. Name it, then play it. This is the most important one. Loop a single chord and stay in one position. Before you play any note, say its degree over the chord out loud: "9", "3", "♭7", "11, avoid". Then play it and hold it, and listen to whether it sounds stable, colorful or tense. Change the chord type every five minutes. After a week you'll start hearing degrees instead of fret numbers.

2. Land every bar. Improvise over an A 12-bar shuffle with whatever vocabulary you like, but obey one rule: the note on beat 1 of every bar is the 3rd or 7th of that bar's chord. It forces you to know where the changes are and to plan the last beat of each bar. Count the bars you land. Three full choruses at 90 bpm with no misses is the bar to clear.

3. Guide tones with approach notes. Use the shapes from the targeting slide on the D and G strings. First pass: whole notes, just the 3rd and 7th of each chord. Second pass: on beat 4 of each bar, play the note a half step below the next guide tone. This is the skeleton of every good blues and jazz solo.

4. One motif, 32 bars. Choose four notes and a rhythm. Over an Am vamp, play only that motif and its transformations from the motif slide. It feels limiting for about a minute, then it starts to sound like composition. Record it and listen back: you'll hear structure that free improvising rarely has.

Log your scores, your tempos and the motif you used.`,
  });
}

module.exports = { build };
