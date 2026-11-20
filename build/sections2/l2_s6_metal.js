// Level 2 · Part 6 · Tunings and the metal toolkit (slides 60–69)
const T = require('../lib/theory');
const D = require('../lib/draw');
const { HEX, M, CONTENT_TOP, section } = require('../lib/deck');

const KICK = '6 · Tunings and metal';
const MINOR = T.SCALES.minor;
const PHRYG_DOM = [0, 1, 4, 5, 7, 8, 10]; // R ♭2 3 4 5 ♭6 ♭7
const DIM7 = [0, 3, 6, 9];
const HALF_WHOLE = [0, 1, 3, 4, 6, 7, 9, 10]; // R ♭2 ♯2 3 ♯4 5 6 ♭7
const STD = T.TUNINGS.standard;
const FULL_W = 12.13;

function heading(s, str, x, y, w, color = HEX.pearl, size = 15) {
  s.addText(D.runs(str, { color, fontSize: size, bold: true }), { x, y, w, h: 0.32, margin: 0, valign: 'middle', isTextBox: true });
}
function caption(s, str, x, y, w, h = 0.3, size = 12) {
  D.text(s, str, { x, y, w, h, fontSize: size, color: HEX.muted });
}
const cap = (n) => n[0].toUpperCase() + n.slice(1);

// Row of formula badges with note names underneath; returns the bottom y.
function formulaRow(s, { x, y, d = 0.52, gap = 0.2, items }) {
  items.forEach((it, i) => {
    const bx = x + i * (d + gap);
    D.badge(s, { x: bx, y, d, label: it.label, role: it.role, fontSize: it.label.length > 2 ? 12 : 15 });
    if (it.note) s.addText(it.note, { x: bx - 0.1, y: y + d + 0.04, w: d + 0.2, h: 0.28, fontSize: 13, bold: true, color: HEX.text, align: 'center', margin: 0, isTextBox: true });
  });
  return y + d + 0.36;
}

function build(pres) {
  section(pres, 'Tunings and the metal toolkit');

  // 60 · Divider
  D.divider(pres, {
    num: 6,
    title: 'Tunings and the metal toolkit',
    subtitle: 'Lower tunings, exotic scales, diminished tension, chromatic riffs, twin-guitar harmony and the muting that keeps high gain tight.',
    outcomes: [
      'Retune to E♭, Drop D, D standard or Drop C and rename your shapes',
      'Write one-finger power-chord riffs in Drop D',
      'Use Phrygian dominant and diminished sounds over E',
      'Build chromatic, tritone and harmonized riffs',
      'Kill string noise at high gain with both hands',
    ],
    notes: `Part 6 is the heavy toolbox.

Rock and metal guitarists rarely stay in standard tuning. A half step down (E♭ standard) is everywhere in blues-rock and classic metal. Drop D and Drop C give one-finger power chords and a lower, heavier root. D standard drops everything a whole step. The good news: none of this means relearning the neck. Your shapes stay the same. Only the note names shift, and this part shows you exactly how.

Then come the sounds that make metal sound like metal:
• Phrygian dominant: the "exotic" scale, the 5th mode of harmonic minor. You met harmonic minor in Level 1. Here you play it from its 5th note.
• Diminished arpeggios and the half-whole scale: perfectly symmetrical, maximum tension, and shapes that repeat every 3 frets.
• Chromatic and tritone riffing: notes outside the key, used on purpose.
• Harmony lines: the twin-guitar sound, built from 3rds and 5ths inside the key.
• Muting: the unglamorous skill that separates tight high-gain playing from noise.

Work through this part in standard tuning first, then retune and repeat the drills. If you only have one guitar, tune down for a week rather than flipping back and forth every day. The strings settle and stay in tune better. Keep the Level 1 metronome habits: clean first, fast later.`,
  });

  // 61 · Tunings overview
  {
    const s = D.slideOf(pres, {
      kicker: KICK, title: 'Five tunings and what each changes',
      notes: `Five tunings cover almost all rock and metal guitar.

Read each row from the low string on the left to the high string on the right. The small teal number under a string says how many half steps (frets) it is tuned down from standard. Pearl strings are unchanged.

• Standard (E A D G B E): the reference. Every chart, lesson and Level 1 diagram uses it.
• E♭ standard (E♭ A♭ D♭ G♭ B♭ E♭): every string down one half step. Same shapes, slightly slacker strings, which means easier bends and a darker tone. Very common in blues-rock, grunge and classic metal.
• Drop D (D A D G B E): only the low string drops a whole step. The bottom three strings now form a D5 power chord, so one finger across them plays any power chord. It also gives you a low D.
• D standard (D G C F A D): every string down a whole step. Heavier and looser. Shapes are identical to standard, and every name shifts down 2 frets.
• Drop C (C G C F A D): D standard with the low string dropped another whole step. Same one-finger trick as Drop D, two frets lower.

Practical tips:
• Lower tunings feel floppy on light strings. Many players move up a gauge (for example 10s to 11s) for D standard and Drop C.
• After retuning, retune again. The neck relaxes, and the first tuning pass is never stable.
• Use a clip-on or pedal tuner, and tune up to the note rather than down. It holds better.`,
    });
    const rows = ['standard', 'eflat', 'dropD', 'dStandard', 'dropC'];
    const why = {
      standard: 'The reference: every chart, lesson and Level 1 diagram.',
      eflat: 'All down a half step: easier bends, darker tone. Blues-rock, classic metal.',
      dropD: 'Only the low string drops. One-finger power chords and a low D.',
      dStandard: 'All down a whole step. Heavier; same shapes, names shift by 2.',
      dropC: 'D standard with the low string down to C. One-finger, very heavy.',
    };
    const top = CONTENT_TOP + 0.45; const rowH = 0.92; const bx0 = 3.05; const bd = 0.5; const bstep = 0.66;
    heading(s, 'Tuning', M, CONTENT_TOP, 2.2, HEX.muted, 12);
    heading(s, 'Strings, low → high (teal = half steps down)', bx0, CONTENT_TOP, 4.2, HEX.muted, 12);
    heading(s, 'Why players use it', 7.3, CONTENT_TOP, 5.4, HEX.muted, 12);
    rows.forEach((id, i) => {
      const tu = T.TUNINGS[id];
      const y = top + i * rowH;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y, w: FULL_W, h: rowH - 0.14, rectRadius: 0.08, fill: { color: HEX.card }, line: { color: HEX.card, width: 0 } });
      s.addText(tu.name, { x: M + 0.2, y: y + 0.08, w: 2.3, h: 0.34, fontSize: 16, bold: true, color: HEX.white, margin: 0, valign: 'middle', isTextBox: true });
      s.addText(tu.short, { x: M + 0.2, y: y + 0.42, w: 2.3, h: 0.28, fontSize: 12, color: HEX.muted, margin: 0, valign: 'middle', isTextBox: true });
      [6, 5, 4, 3, 2, 1].forEach((st, k) => {
        const diff = tu.open[st] - STD.open[st];
        const x = bx0 + k * bstep;
        D.badge(s, { x, y: y + 0.08, d: bd, label: cap(T.stringName(st, tu)), role: diff ? 'blue' : 'note', fontSize: 14 });
        if (diff) s.addText(`−${-diff}`, { x: x - 0.05, y: y + 0.58, w: bd + 0.1, h: 0.2, fontSize: 11, bold: true, color: HEX.blue, align: 'center', margin: 0, isTextBox: true });
      });
      D.text(s, why[id], { x: 7.3, y: y + 0.08, w: 5.25, h: rowH - 0.3, fontSize: 14, valign: 'middle' });
    });
  }

  // 62 · Drop D
  {
    const s = D.slideOf(pres, {
      kicker: KICK, title: 'Drop D: one-finger power chords',
      notes: `Drop D changes one string, and that one change opens up a whole style of riffing.

Tune the low E down a whole step to D. Check it against the open D string: they should sound the same note an octave apart, with no wobble.

Top diagram: the new low-string map. The low string now has exactly the same note names as your D string (the rings), one octave lower. Your Level 1 landmarks move by 2 frets: G is at fret 5 (not 3), A at 7 (not 5), C at 10, D at 12. If you know the D string, you already know the new low string.

Bottom diagram: the one-finger power chord. In Drop D, the three lowest strings are tuned D–A–D, which is root, 5th, octave. So laying one finger flat across those three strings at any fret plays a power chord named after the low-string note:
• open = D5
• 3rd fret = F5
• 5th fret = G5
• 7th fret = A5
That makes fast chord changes and chromatic slides easy. It's the reason so many heavy riffs live in Drop D.

The tab is a riff in D minor using only one-finger chords and palm-muted low D chugs. Keep the chugs short and muted, and let the chords ring. Counting it as 8th notes helps: "1 & 2 & 3 & 4 &".

Common mistakes: barring with the fingertip (use the flat pad of one finger or your index joint), and letting the unused higher strings ring. Lay the rest of your fretting hand lightly across them.`,
    });
    const leftW = 7.2;
    heading(s, 'Low-string map: your D string, one octave lower', M, CONTENT_TOP, leftW);
    const naturals = [0, 2, 3, 5, 7, 9, 10, 12];
    const dots1 = [];
    naturals.forEach((f) => {
      const n = T.noteName(T.pcAt(6, f, T.TUNINGS.dropD));
      dots1.push({ s: 6, f, label: n, role: n === 'D' ? 'root' : 'note' });
      dots1.push({ s: 4, f, label: n, role: n === 'D' ? 'root' : 'note', ring: true, small: true });
    });
    D.fretboard(s, { x: M, y: CONTENT_TOP + 0.45, w: leftW, h: 1.65, from: 0, to: 12, tuning: T.TUNINGS.dropD, root: 'D', dots: dots1, dotSize: 0.32, title: 'Drop D map' });
    heading(s, 'One finger across the 3 low strings', M, 4.15, leftW);
    const chordFrets = [[0, 'D5'], [3, 'F5'], [5, 'G5'], [7, 'A5']];
    const dots2 = [];
    for (const [f] of chordFrets) {
      for (const st of [6, 5, 4]) {
        dots2.push({ s: st, f, label: T.noteName(T.pcAt(st, f, T.TUNINGS.dropD)), role: st === 5 ? 'fifth' : 'root' });
      }
    }
    D.fretboard(s, {
      x: M, y: 4.95, w: leftW, h: 1.55, from: 0, to: 9, tuning: T.TUNINGS.dropD, dots: dots2, dotSize: 0.3, title: 'Drop D one-finger',
      regions: chordFrets.map(([f, l]) => ({ from: f, to: f, label: l })),
    });
    // right column
    const rx = 8.2; const rw = 12.73 - rx;
    D.card(s, {
      x: rx, y: CONTENT_TOP, w: rw, h: 2.3, title: 'Tune it right',
      body: ['Low E → **D**: match it to the open D string, an octave down.', 'Low string = **root**, 5th string = **5th**, 4th string = **octave**.'],
      fontSize: 14, paraSpace: 8,
    });
    heading(s, 'Riff in D minor (palm-mute the chugs)', rx, 4.15, rw);
    D.tab(s, {
      x: rx, y: 4.7, w: rw, gap: 0.24, tuning: T.TUNINGS.dropD,
      cols: ['6:0 5:0 4:0', '6:0', '6:0', '6:3 5:3 4:3', '6:0', '6:0', '6:5 5:5 4:5', '6:3 5:3 4:3'],
      check: { root: 'D', scale: MINOR },
      counts: ['1', '&', '2', '&', '3', '&', '4', '&'],
    });
  }

  // 63 · E♭, D standard and Drop C
  {
    const s = D.slideOf(pres, {
      kicker: KICK, title: 'E♭, D standard and Drop C',
      notes: `Lower tunings don't change shapes. They change names.

The four diagrams show the same hand position: a power chord with its root at the 5th fret of the low string.
• Standard: A5.
• E♭ standard: every string is a half step lower, so the identical shape sounds A♭5.
• D standard: every string is a whole step lower, so it sounds G5.
• Drop C: the low string is dropped an extra whole step, so you use the one-finger shape instead. One finger across the low three strings at fret 5 gives F5.

The rule of thumb:
• E♭ standard: subtract 1 half step from every standard name (E5 → E♭5, A5 → A♭5, C5 → B5).
• D standard: subtract 2 half steps (E5 → D5, G5 → F5, A5 → G5).
• Drop C: think "D standard", plus one-finger power chords on the bottom three strings.

That's why tabs for lower tunings are written with normal fret numbers. You play the frets you read, and the tuning does the transposing. When you jam with someone in standard tuning, though, you have to convert. A song played in "E" in D standard sounds in D, so a player in standard needs to play in D.

The table converts the most common power-chord names. Keep it handy until it becomes automatic. A useful habit: when you learn a riff in a lower tuning, say the real chord names out loud, not the standard-tuning names. It keeps your fretboard knowledge honest.

String tension drops as you tune down. If notes buzz or go sharp when you pick hard, a heavier string gauge and a quick setup help a lot.`,
    });
    const boards = [
      { tu: T.TUNINGS.standard, frets: [[6, 5], [5, 7], [4, 7]], name: 'Standard', chord: 'A5' },
      { tu: T.TUNINGS.eflat, frets: [[6, 5], [5, 7], [4, 7]], name: 'E♭ standard', chord: 'A♭5' },
      { tu: T.TUNINGS.dStandard, frets: [[6, 5], [5, 7], [4, 7]], name: 'D standard', chord: 'G5' },
      { tu: T.TUNINGS.dropC, frets: [[6, 5], [5, 5], [4, 5]], name: 'Drop C', chord: 'F5 (one finger)' },
    ];
    const gap = 0.3; const bw = (FULL_W - gap * 3) / 4;
    boards.forEach((b, i) => {
      const x = M + i * (bw + gap);
      heading(s, `${b.name}: {third:${b.chord}}`, x, CONTENT_TOP, bw, HEX.white, 14);
      const dots = b.frets.map(([st, f]) => {
        const p = T.pcAt(st, f, b.tu);
        return { s: st, f, label: (b.tu.flat ? T.FLAT : T.SHARP)[p], role: st === 5 ? 'fifth' : 'root' };
      });
      D.fretboard(s, { x, y: CONTENT_TOP + 0.45, w: bw, h: 1.55, from: 3, to: 8, tuning: b.tu, dots, dotSize: 0.27, labelSize: 10, title: `${b.name} shape` });
    });
    // name-shift table
    const names = ['E5', 'G5', 'A5', 'C5', 'D5'];
    const shift = (n, k) => {
      const p = T.pc(n.replace('5', ''));
      return `${T.FLAT[T.mod12(p - k)]}5`;
    };
    const rows = [['Shape played in standard', ...names]];
    rows.push(['E♭ standard sounds', ...names.map((n) => shift(n, 1))]);
    rows.push(['D standard sounds', ...names.map((n) => shift(n, 2))]);
    D.table(s, rows, { x: M, y: 4.2, w: 7.6, colW: [2.6, 1, 1, 1, 1, 1], fontSize: 14, align: ['left', 'center', 'center', 'center', 'center', 'center'], boldFirstCol: true });
    D.card(s, {
      x: 8.55, y: 4.2, w: 12.73 - 8.55, h: 2.6, title: 'The rule',
      body: ['Same frets, new names.', '**E♭:** every name down 1 half step.', '**D standard:** down 2. **Drop C:** D standard + one-finger chords.'],
      fontSize: 14, paraSpace: 6,
    });
  }

  // 64 · Phrygian dominant
  {
    const s = D.slideOf(pres, {
      kicker: KICK, title: 'Phrygian dominant: the exotic sound',
      notes: `Phrygian dominant is the scale behind that "exotic", Middle-Eastern-flavored metal sound.

Where it comes from: take A harmonic minor (A B C D E F G♯) and play it starting from its 5th note, E. You get E F G♯ A B C D, which is E Phrygian dominant. Its formula is R ♭2 3 4 5 ♭6 ♭7.

Two notes give it the character, shown in teal:
• the ♭2 (F), a half step above the root. The same dark half step as plain Phrygian.
• the major 3rd (G♯). Plain Phrygian has a minor 3rd (G). Combining a ♭2 with a major 3rd creates the 1½-step gap between F and G♯. That wide step is the "exotic" interval.

Where to use it:
• As a home sound over an E5 or E major riff. Very common in metal, and the open position works beautifully because the low E rings under everything.
• Over the V chord in a minor key. In A minor, the E or E7 chord takes E Phrygian dominant, which is the same as playing A harmonic minor. It's the neoclassical move from Level 1, viewed from E.

The diagram is the open position, frets 0–4. The lick on the low strings leans on F → E and G♯ → A, the two half-step pulls. Play it slowly over a low E drone first, so your ear learns the sound before your fingers learn the speed.

Common mistake: playing G instead of G♯ out of habit from E minor. The major 3rd is the whole point. Exaggerate it with vibrato until it feels natural.`,
    });
    const items = PHRYG_DOM.map((iv) => ({
      label: T.INTERVAL[iv],
      role: iv === 1 || iv === 4 ? 'blue' : T.role(iv),
      note: T.spellIn('E', T.mod12(T.pc('E') + iv)),
    }));
    heading(s, 'E Phrygian dominant = R ♭2 3 4 5 ♭6 ♭7', M, CONTENT_TOP, 6.2);
    formulaRow(s, { x: M, y: CONTENT_TOP + 0.45, d: 0.55, gap: 0.24, items });
    D.card(s, {
      x: 6.55, y: CONTENT_TOP, w: 12.73 - 6.55, h: 1.75, title: 'Where it comes from',
      body: 'A harmonic minor (A B C D E F G♯) played from its 5th note, E. Teal = the flavor notes: {blue:♭2} (F) and the major {blue:3} (G♯).',
      fontSize: 14,
    });
    heading(s, 'Open position, frets 0–4', M, 3.6, 6.6);
    const pos = T.positions(T.pcsOf('E', PHRYG_DOM), { from: 0, to: 4 });
    D.fretboard(s, {
      x: M, y: 4.05, w: 6.6, h: 2.15, from: 0, to: 5, root: 'E', title: 'E Phrygian dominant',
      dots: D.dotsFor(pos, { root: 'E', label: 'interval', roleOf: (sm) => (sm === 1 || sm === 4 ? 'blue' : T.role(sm)) }),
      dotSize: 0.32,
    });
    heading(s, 'Lick over an E drone', 7.6, 3.6, 5.1);
    D.tab(s, {
      x: 7.6, y: 4.15, w: 5.13, gap: 0.25,
      cols: ['6:0', '6:1', '6:4', '5:0', '5:2', '5:3', '5:2', '6:4', '6:1', '6:0~'],
      check: { root: 'E', scale: PHRYG_DOM },
    });
    caption(s, 'Lean on the half steps: F → E and G♯ → A.', 7.6, 5.75, 5.1, 0.3, 13);
  }

  // 65 · Diminished
  {
    const s = D.slideOf(pres, {
      kicker: KICK, title: 'Diminished arpeggios and half-whole',
      notes: `Diminished sounds are perfectly symmetrical, which makes them easy to play and very tense to hear.

The diminished 7th arpeggio stacks minor 3rds: E, G, B♭, D♭, then back to E. Every note is exactly 3 frets from the next. That has two big consequences:
• Any of the four notes can be the root. E°7, G°7, B♭°7 and D♭°7 are the same four notes.
• Any shape repeats every 3 frets. Learn one shape and move it up 3 frets, then 3 more, and you're playing the same arpeggio across the neck.

The top diagram shows this. Every 3-fret window holds one E°7 note per string, and each window is the same shape moved up 3 frets (the brackets). Red is E, amber G (the ♭3), teal B♭ (the ♭5), and gray D♭ (the double-flat 7, written D♭ rather than C♯ because it's a 7th).

The half-whole diminished scale fills in the gaps by alternating half steps and whole steps: E F G G♯ A♯ B C♯ D. Its formula is R ♭2 ♯2 3 ♯4 5 6 ♭7. Because it contains a major 3rd and a ♭7, it fits over dominant chords with a ♭9 (like E7♭9) and gives a dark, twisting sound. Its pattern also repeats every 3 frets.

Uses in rock and metal:
• As a passing chord or run between two diatonic chords, to build tension before resolving.
• Over the V chord in a minor key. D♯°7 shapes (the same chord as F♯°7, A°7 and C°7) over B7 pull hard to E minor.
• Fast symmetrical runs. The one-string tab climbs E°7 in minor 3rds on the B string, then drops to the G string. It's the same fingering every time.

Resolve it. Diminished tension is great for a beat or a bar, not a whole solo.`,
    });
    const dimName = { 0: 'E', 3: 'G', 6: 'B♭', 9: 'D♭' };
    const dimRole = { 0: 'root', 3: 'third', 6: 'blue', 9: 'other' };
    const pos = T.positions(T.pcsOf('E', DIM7), { from: 1, to: 12 });
    const dots = pos.map((p) => { const sm = T.semis('E', T.pcAt(p.s, p.f)); return { s: p.s, f: p.f, label: dimName[sm], role: dimRole[sm] }; });
    D.fretboard(s, {
      x: M, y: CONTENT_TOP + 0.5, w: FULL_W, h: 2.05, from: 1, to: 12, root: 'E', dots, dotSize: 0.34, title: 'E dim7',
      regions: [{ from: 1, to: 3, label: 'Shape' }, { from: 4, to: 6, label: '+3 frets' }, { from: 7, to: 9, label: '+6 frets' }, { from: 10, to: 12, label: '+9 frets' }],
    });
    // half-whole formula
    heading(s, 'E half-whole diminished scale', M, 4.5, 6.6);
    const hw = HALF_WHOLE.map((iv, i) => ({ label: ['R', '♭2', '♯2', '3', '♯4', '5', '6', '♭7'][i], role: iv === 0 ? 'root' : iv === 4 ? 'third' : iv === 7 ? 'fifth' : iv === 10 ? 'seventh' : 'other', note: ['E', 'F', 'G', 'G♯', 'A♯', 'B', 'C♯', 'D'][i] }));
    hw.forEach((h, i) => { if (T.pc(h.note) !== T.mod12(T.pc('E') + HALF_WHOLE[i])) throw new Error(`half-whole spelling ${h.note}`); });
    const by = formulaRow(s, { x: M, y: 4.95, d: 0.5, gap: 0.27, items: hw });
    const steps = ['H', 'W', 'H', 'W', 'H', 'W', 'H'];
    steps.forEach((st, i) => {
      s.addText(st, { x: M + 0.5 + i * 0.77, y: 5.05, w: 0.27, h: 0.3, fontSize: 11, bold: true, color: HEX.pearl, align: 'center', valign: 'middle', margin: 0, isTextBox: true });
    });
    caption(s, 'H = half step (1 fret), W = whole step (2 frets). The pattern also repeats every 3 frets.', M, by + 0.05, 6.6, 0.5, 12);
    heading(s, 'E°7 up one string, then down', 7.6, 4.5, 5.1);
    D.tab(s, {
      x: 7.6, y: 5.0, w: 5.13, gap: 0.24,
      cols: ['2:5', '2:8', '2:11', '2:14', '2:11', '2:8', '3:6', '3:3'],
      check: { root: 'E', scale: DIM7 },
    });
  }

  // 66 · Chromatic and tritone riffs
  {
    const s = D.slideOf(pres, {
      kicker: KICK, title: 'Chromatic and tritone riffs',
      notes: `Metal riffs often use notes outside the key on purpose. Two devices cover most of it.

1. Chromatic passing notes. Walking down (or up) one fret at a time between scale notes. In the left riff, the low E chugs, then the line walks down from B through B♭ and A on the A string, then G, F♯, F on the low string, and lands on E. Two notes, B♭ and F, are outside E minor. They work because they're quick, they move in one direction, and they land on a strong note (E) on a strong beat.
The rule: chromatic notes are passing notes. Put them between beats or on weak beats, and land on a chord tone (E, G or B) when the beat is strong.

2. The tritone (♭5). Six frets, three whole steps: the most unstable interval in music. From E it's B♭. Moving a power chord from E5 up to B♭5 creates instant menace. In the right riff, E5 chugs, then hits B♭5, A5, B♭5. That's tritone and half-step tension stacked together.
The ♭5 sits one fret below the 5th (diagram). That's why sliding B♭5 → B5 or B♭5 → A5 feels like a resolution.

The ♭2 (F over E) from the Phrygian sound pairs naturally with the tritone. Both are half steps away from "safe" notes (E and B), and much of metal's darkness lives in those two half steps.

Practice: play both riffs slowly with strict downstrokes and palm muting on the open E. Then write your own 2-bar riff using exactly one chromatic walk and one tritone hit. Keep the root E as home base so the outside notes have something to pull against.`,
    });
    const half = (FULL_W - 0.4) / 2;
    heading(s, 'Chromatic walk-down to E', M, CONTENT_TOP, half);
    D.tab(s, {
      x: M, y: CONTENT_TOP + 0.5, w: half, gap: 0.25,
      cols: ['6:0', '6:0', '5:2', '5:1', '5:0', '6:3', '6:2', '6:1', '6:0'],
      check: { root: 'E', scale: MINOR, extra: [1, 6] },
    });
    heading(s, 'Tritone power chords: E5 → B♭5', M + half + 0.4, CONTENT_TOP, half);
    D.tab(s, {
      x: M + half + 0.4, y: CONTENT_TOP + 0.5, w: half, gap: 0.25,
      cols: ['6:0 5:2', '6:0', '6:0', '6:6 5:8', '6:0', '6:0', '6:5 5:7', '6:6 5:8'],
      check: { root: 'E', scale: MINOR, extra: [1, 6] },
    });
    heading(s, 'The tritone on the neck', M, 3.75, 6.6);
    D.fretboard(s, {
      x: M, y: 4.2, w: 6.6, h: 1.95, from: 0, to: 8, root: 'E', title: 'Tritone',
      dots: [
        { s: 6, f: 0, label: 'R', role: 'root' }, { s: 6, f: 6, label: '♭5', role: 'blue' }, { s: 6, f: 7, label: '5', role: 'fifth' },
        { s: 5, f: 1, label: '♭5', role: 'blue' }, { s: 5, f: 2, label: '5', role: 'fifth' },
      ],
      links: [{ a: { s: 6, f: 0 }, b: { s: 6, f: 6 }, color: HEX.blue, dash: 'dash' }],
      dotSize: 0.32,
    });
    caption(s, 'Tritone = 6 frets = 3 whole steps. The ♭5 sits one fret below the 5th.', M, 6.45, 6.6, 0.3, 12);
    D.card(s, {
      x: 7.6, y: 3.75, w: 12.73 - 7.6, h: 3.05, title: 'Rules for outside notes',
      bullets: ['Chromatic notes **pass**: put them between beats', 'Land on **E, G or B** when the beat is strong', 'Tritone = maximum tension: **resolve it** or repeat it until it becomes the riff'],
      fontSize: 14, paraSpace: 8,
    });
  }

  // 67 · Harmony lines
  {
    const s = D.slideOf(pres, {
      kicker: KICK, title: 'Harmony lines: twin guitars in 3rds',
      notes: `The twin-guitar sound comes from one idea: play the same melody twice, with the second part shifted up by a 3rd inside the key.

"Inside the key" is the important part. You don't move the second line a fixed number of frets. You move it up two scale steps. In E minor, the note above E is G, above F♯ is A, above G is B, and so on (table). Some of those 3rds are minor (3 frets) and some are major (4 frets). Following the scale picks the right one automatically, so the harmony never clashes with the key.

On the neck (diagram), Guitar 1 plays the melody on the B string (filled dots) and Guitar 2 plays the 3rd above on the high e string (rings). The lines connect each melody note to its harmony note. Notice the shape is not parallel: sometimes the e-string note is 2 frets lower than the B-string note, sometimes 1. That uneven shape is the sound of "diatonic" harmony.

5ths work the same way (third column): four scale steps up. They sound more powerful and less sweet. Watch out for F♯: its 5th in E minor is C, a diminished 5th (♭5), not a perfect 5th. That's correct in the key, but it stands out, so pass through it quickly.

How to practice without a second guitarist:
1. Record Guitar 1 into a looper and play Guitar 2 over it. Then swap.
2. Play both lines yourself as double stops (two strings at once), slowly.
3. Write a 4-note melody in E minor, then harmonize it in 3rds using the table.

Tuning matters more than usual. Two guitars a little out of tune with each other sound much worse in harmony than either one alone.`,
    });
    const melody = [5, 7, 8, 10, 12, 10, 8, 7]; // B string
    const harm = melody.map((f) => {
      const m = T.midi(2, f);
      const up = T.scalePitchesFrom('E', MINOR, m + 1, 2)[1]; // two scale steps above
      const hf = up - T.midi(1, 0);
      if (hf < 0 || hf > 15) throw new Error('harmony fret out of range');
      return hf;
    });
    const uniq = [...new Set(melody)].sort((a, b) => a - b);
    const dots = [];
    const links = [];
    uniq.forEach((f) => {
      const i = melody.indexOf(f);
      const mp = T.pcAt(2, f); const hp = T.pcAt(1, harm[i]);
      dots.push({ s: 2, f, label: T.spellIn('E', mp), role: T.role(T.semis('E', mp)) });
      dots.push({ s: 1, f: harm[i], label: T.spellIn('E', hp), role: T.role(T.semis('E', hp)), ring: true });
      links.push({ a: { s: 2, f }, b: { s: 1, f: harm[i] }, color: HEX.pearl, width: 1.25 });
    });
    heading(s, 'Melody on B (filled) + 3rd above on e (rings)', M, CONTENT_TOP, 7.6);
    D.fretboard(s, { x: M, y: CONTENT_TOP + 0.45, w: 7.6, h: 1.95, from: 2, to: 13, root: 'E', dots, links, dotSize: 0.34, title: 'Harmony 3rds' });
    // diatonic harmony table
    const scale = T.pcsOf('E', MINOR);
    const q3 = { 3: 'm3', 4: 'M3' }; const q5 = { 6: '♭5', 7: 'P5' };
    const rows = [['Note', '3rd above', '5th above']];
    scale.forEach((p, d) => {
      const n = T.spellIn('E', p);
      const p3 = scale[(d + 2) % 7]; const p5 = scale[(d + 4) % 7];
      const i3 = T.mod12(p3 - p); const i5 = T.mod12(p5 - p);
      const five = `${T.spellIn('E', p5)} (${q5[i5]})`;
      rows.push([`**${n}**`, `${T.spellIn('E', p3)} (${q3[i3]})`, i5 === 6 ? `{blue:${five}}` : five]);
    });
    D.table(s, rows, { x: 8.55, y: CONTENT_TOP, w: 12.73 - 8.55, colW: [1.0, 1.59, 1.59], fontSize: 12, rowH: 0.27, align: ['center', 'center', 'center'] });
    // two-line tab
    const tw = (FULL_W - 0.4) / 2;
    heading(s, 'Guitar 1: melody', M, 4.75, tw);
    D.tab(s, { x: M, y: 5.25, w: tw, gap: 0.24, cols: melody.map((f, i) => `2:${f}${i === melody.length - 1 ? '~' : ''}`), check: { root: 'E', scale: MINOR } });
    heading(s, 'Guitar 2: a 3rd above, in the key', M + tw + 0.4, 4.75, tw);
    D.tab(s, { x: M + tw + 0.4, y: 5.25, w: tw, gap: 0.24, cols: harm.map((f, i) => `1:${f}${i === harm.length - 1 ? '~' : ''}`), check: { root: 'E', scale: MINOR } });
  }

  // 68 · Muting for high gain
  {
    const s = D.slideOf(pres, {
      kicker: KICK, title: 'Muting for high gain: both hands',
      notes: `High gain amplifies everything, including strings you aren't playing. Tight heavy playing is mostly about what you stop from ringing.

Fretting hand (diagram, a D5 power chord with its root on the A string):
• The tip of the finger fretting the root leans lightly against the low E string. That kills it (the x on the low string).
• The underside of your index finger, or any spare fingers, lies flat and relaxed across the G, B and e strings. No pressure, just contact (the x marks on the top strings).
• Releasing pressure without lifting the finger mutes a chord instantly. This "release mute" is how you get tight stops and staccato chords.

Picking hand:
• Palm muting: rest the edge of your palm on the strings right at the bridge saddles. Too far forward and the note dies; too far back and nothing is muted. Small moves change the sound a lot, so experiment.
• When you play the higher strings, let the side of your palm drift down and rest on the lower strings you aren't using. This "floating" palm follows you across the neck.
• Your thumb can rest on the string just above the one you're picking.

The rhythm grid shows the classic metal texture: an accented, open (ringing) power chord on beats 1 and 3, with palm-muted chugs (PM) on the other 8th notes. The contrast between muted and open notes is the groove.

Gear: a noise gate helps with hum between notes, but it can't fix sloppy muting. And use less gain than you think. Tight riffs often use less distortion than it sounds like.

Test: play a riff with high gain, then stop dead. If anything keeps ringing, find which hand should have caught it.`,
    });
    heading(s, 'D5 with the unused strings muted', M, CONTENT_TOP, 6.6);
    D.fretboard(s, {
      x: M, y: CONTENT_TOP + 0.45, w: 6.6, h: 2.1, from: 3, to: 9, root: 'D', title: 'Muting',
      dots: [
        { s: 5, f: 5, label: 'D', role: 'root' }, { s: 4, f: 7, label: 'A', role: 'fifth' },
        { s: 6, f: 5, label: 'x', role: 'ghost', small: true }, { s: 3, f: 5, label: 'x', role: 'ghost', small: true },
        { s: 2, f: 5, label: 'x', role: 'ghost', small: true }, { s: 1, f: 5, label: 'x', role: 'ghost', small: true },
      ],
      dotSize: 0.34,
    });
    caption(s, 'x = touched, not pressed: fingertip on the low E, index finger flat across G, B and e.', M, 4.45, 6.6, 0.5, 12);
    heading(s, 'Open accents vs. palm-muted chugs', M, 5.05, 6.6);
    D.rhythm(s, {
      x: M, y: 5.45, w: 6.6, beats: 4, sub: 2, rowH: 0.4,
      rows: [{ notes: [
        { at: 0, accent: true, text: 'open' }, { at: 1, role: 'other', text: 'PM' }, { at: 2, role: 'other', text: 'PM' }, { at: 3, role: 'other', text: 'PM' },
        { at: 4, accent: true, text: 'open' }, { at: 5, role: 'other', text: 'PM' }, { at: 6, role: 'other', text: 'PM' }, { at: 7, role: 'other', text: 'PM' },
      ] }],
    });
    const rx = 7.6; const rw = 12.73 - rx; const ch = 1.6; const cg = 0.2;
    D.card(s, { x: rx, y: CONTENT_TOP, w: rw, h: ch, title: 'Fretting hand', badge: 'L', badgeRole: 'fifth', body: 'Fingertip leans on the string below; a finger lies flat across the strings above. Release pressure to stop a chord dead.', fontSize: 14 });
    D.card(s, { x: rx, y: CONTENT_TOP + ch + cg, w: rw, h: ch, title: 'Picking hand', badge: 'R', badgeRole: 'root', body: 'Palm edge at the bridge for chugs. The side of the palm floats on unused low strings as you move up.', fontSize: 14 });
    D.card(s, { x: rx, y: CONTENT_TOP + 2 * (ch + cg), w: rw, h: ch, title: 'Gear helps, a little', badge: 'G', badgeRole: 'seventh', body: 'A noise gate stops hum between notes but can’t fix sloppy muting. Use less gain than you think.', fontSize: 14 });
  }

  // 69 · Practice this
  D.practice(pres, {
    kicker: KICK,
    intro: 'Each drill names its tuning. Keep the gain high so you hear every stray string.',
    drills: [
      { name: 'Drop D riff builder', how: 'In Drop D, write a 2-bar riff with one-finger chords at frets 0, 3, 5 and 7, palm-muted chugs between. Then play the same riff in standard with full shapes.', tempo: '80 → 120 bpm', time: '5 min', done: 'Same riff, both tunings, no string noise' },
      { name: 'Phrygian dominant drone', how: 'Over a low E drone, play E Phrygian dominant in open position. Lean on F → E and G♯ → A. Then play A harmonic minor over Am–E.', tempo: 'Free, then 70 bpm', time: '4 min', done: 'You hear the exotic sound right away' },
      { name: 'Diminished shifts', how: 'Play the E°7 shape, then move it up 3 frets, 3 more, 3 more. One note per click, naming each. Then climb one string in minor 3rds.', tempo: '60 bpm', time: '3 min', done: 'All four positions, no hesitation' },
      { name: 'Twin-guitar harmony', how: 'Loop Guitar 1, play Guitar 2 a 3rd above, then swap. Write your own 4-note line in E minor and harmonize it with the table.', tempo: '70 bpm', time: '5 min', done: 'Both parts lock in time and in tune' },
    ],
    notes: `Four drills, about 17 minutes in total. Rotate two per session through the week.

1. Drop D riff builder. Tune to Drop D and write a 2-bar riff: one-finger chords at frets 0, 3, 5 and 7, with palm-muted open-D chugs between them. Count 8th notes out loud. Then retune to standard and play the same riff with full three-finger power-chord shapes. Notice which feels easier and which sounds heavier. Done when the riff is clean in both tunings with no stray strings ringing at high gain.

2. Phrygian dominant drone. Play a low open E, or use a drone track, and improvise slowly in E Phrygian dominant using the open-position diagram. Lean on the two half-step pulls, F → E and G♯ → A. Then put on an A minor backing track that goes to E (Am–E or Am–Dm–E) and play A harmonic minor over the whole thing. It's the same notes seen from A. Done when the exotic sound jumps out at you every time you hit the G♯.

3. Diminished shifts. Play the E°7 shape from slide 65 one note per click, naming every note, then shift it up 3 frets and repeat, four times in all. Then play the one-string run on the B string. Done when you can move through all four positions without stopping.

4. Twin-guitar harmony. Record the Guitar 1 line into a looper and play Guitar 2 over it, then swap parts. Next, write a 4-note melody in E minor and harmonize it in 3rds using the table on slide 67. Done when both parts lock together rhythmically and sound in tune with each other.`,
  });
}

module.exports = { build };
