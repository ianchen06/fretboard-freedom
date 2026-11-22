// Theory Intensive · Part 2 · Scales, keys and the circle (slides 13–23)
const T = require('../lib/theory');
const D = require('../lib/draw');
const I = require('../lib/intensive');
const { HEX, M, CONTENT_TOP, section } = require('../lib/deck');

const K = '2 · Scales, keys and the circle';
const FULL_W = 12.13;

const assert = (c, msg) => { if (!c) throw new Error(`Part 2 check failed: ${msg}`); };
const semisOf = (kind) => T.FORMULAS[kind].map((d) => T.parseDegree(d).semis);

// Bracket under a span (ticks point up), with a centered label below the line.
function bracket(pres, s, { x1, x2, y, label, color = HEX.pearl, fontSize = 12 }) {
  s.addShape(pres.shapes.LINE, { x: x1, y, w: x2 - x1, h: 0, line: { color, width: 1.5 } });
  s.addShape(pres.shapes.LINE, { x: x1, y: y - 0.09, w: 0, h: 0.09, line: { color, width: 1.5 } });
  s.addShape(pres.shapes.LINE, { x: x2, y: y - 0.09, w: 0, h: 0.09, line: { color, width: 1.5 } });
  if (label) s.addText(D.runs(label, { color, fontSize, bold: true }), { x: x1, y: y + 0.05, w: x2 - x1, h: 0.25, align: 'center', margin: 0, valign: 'top', isTextBox: true });
}

// Note tile (rounded square) colored by role, or outlined for a 'ghost'.
function noteTile(pres, s, { x, y, w, h, label, role, fontSize = 16 }) {
  const ghost = role === 'ghost';
  const st = ghost ? null : D.roleStyle(role);
  s.addText(label, {
    shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: 0.06, x, y, w, h,
    fill: { color: ghost ? HEX.card : st.fill }, line: ghost ? { color: HEX.muted, width: 1.25, dashType: 'dash' } : { color: st.fill, width: 0 },
    color: ghost ? HEX.muted : st.text, bold: true, fontSize, align: 'center', valign: 'middle', margin: 0, fontFace: 'Arial',
  });
}

const MODE_PARENT = { ionian: 'P1', dorian: 'M2', phrygian: 'M3', lydian: 'P4', mixolydian: 'P5', aeolian: 'M6', locrian: 'M7' };
const MODE_LABEL = { ionian: 'Ionian', dorian: 'Dorian', phrygian: 'Phrygian', lydian: 'Lydian', mixolydian: 'Mixolydian', aeolian: 'Aeolian', locrian: 'Locrian' };
function parentMajor(root, mode) {
  const p = mode === 'ionian' ? T.normalizeName(root) : T.noteBelow(root, MODE_PARENT[mode]);
  // check: the mode's notes are the parent's notes
  const a = new Set(T.spellScale(p, 'major')); const b = T.spellScale(root, mode);
  assert(b.every((n) => a.has(n)), `${root} ${mode} parent ${p}`);
  return p;
}
function modeOfFormula(formula) {
  const hit = Object.keys(MODE_LABEL).find((m) => T.FORMULAS[m].join(' ') === formula.join(' '));
  assert(hit, `mode for ${formula}`);
  return MODE_LABEL[hit];
}
const CIRCLE_KEYS = ['C', 'G', 'D', 'A', 'E', 'B', 'F♯', 'C♯', 'F', 'B♭', 'E♭', 'A♭', 'D♭', 'G♭', 'C♭'];
function majorWith(count, type) {
  const k = CIRCLE_KEYS.find((key) => { const sg = T.keySignature(key); return sg.count === count && sg.type === type; });
  assert(k, `key with ${count}${type}`);
  return k;
}

function build(pres) {
  section(pres, 'Scales, keys and the circle');

  // 13 · Divider
  D.divider(pres, {
    num: 2,
    title: 'Scales, keys and the circle',
    subtitle: 'Why these seven notes? Where key signatures come from, and how one circle organizes every key, every mode and the pentatonic.',
    outcomes: [
      'Build any major scale from two tetrachords',
      'Name every key signature and its relative minor',
      'Explain tendency tones and the three minor scales',
      'Order the seven modes from brightest to darkest',
      'Explain why the pentatonic never clashes',
    ],
    notes: `Part 2: Scales, keys and the circle.

Part 1 gave you intervals. Part 2 asks the next question: which seven notes belong together, and why those seven?

The answer turns out to be one pattern, the major scale's W W H W W W H, and everything in this part falls out of it:
• The major scale is two identical four-note halves (tetrachords) joined by a whole step. That one fact explains why keys pick up exactly one new sharp or flat at a time.
• Line the keys up by those one-note changes and you get the circle of fifths: every key signature, every relative minor, and (in Part 4) every chord's neighbors, on one diagram.
• The guitar is tuned in 4ths, so the circle is built into the neck. Moving one string over is moving one step around the circle.
• Inside a key, some notes are stable and some pull toward others. Those tendency tones are the raw material of harmonic tension in Part 5.
• Minor has three versions, each fixing a problem with the one before.
• The seven modes are the major scale's notes with seven different homes. Ordered by brightness, each one differs from the next by a single note.
• The pentatonic is the five notes that sit closest together on the circle. That's why it never clashes.

Keep C as your reference key for the theory (no sharps or flats to distract you), and play everything in A or E on the guitar as well, so the ideas move into the keys you actually use.

The worksheet tests spelling without the guitar. The neck drills put the circle and the modes under your fingers.`,
  });

  // 14 · Major scale anatomy
  {
    const s = D.slideOf(pres, {
      kicker: K, title: 'Major scale anatomy',
      notes: `The major scale is the reference for nearly everything in Western theory. Scale formulas, chord symbols and Roman numerals are all measured against it, so it pays to understand its structure, not just its fingering.

The formula is W W H W W W H: whole, whole, half, whole, whole, whole, half. W is 2 frets, H is 1 fret. The ruler shows C major: the only half steps are E–F (3 to 4) and B–C (7 to 8). Those two half steps are what give the scale its pull. The 4th leans down onto the 3rd, and the 7th leans up into the root.

Now look closer. Split the scale in the middle and you get two halves of four notes each, called tetrachords: C D E F and G A B C. Both halves have the same pattern, W W H. A whole step (F to G) joins them. So the major scale is really one small shape, used twice.

The fretboard shows this on the guitar. The lower tetrachord sits on the A string (frets 3, 5, 7, 8). The upper tetrachord is the same four-note shape on the D string, moved over one string and up two frets (5, 7, 9, 10). One shape, played twice, is a full octave of the major scale. (If the upper half lands on the B string, remember the +1 fret shift from Part 1.)

This matters for more than fingering. In the next slide, the tetrachord structure explains why each new key adds exactly one sharp or one flat.

Try it now: play the two-tetrachord shape from C, then move it to start on G (A string fret 10) and D (A string fret 5). Every major scale has the same two-shape structure.

Common mistake: thinking of the major scale as seven separate notes to memorize. It's one pattern from any root.`,
    });
    const sem = semisOf('major');
    const names = T.spellScale('C', 'major');
    const marks = sem.map((sm, i) => ({ semi: sm, label: names[i], sub: T.FORMULAS.major[i], role: sm === 0 ? 'root' : sm === 4 ? 'third' : sm === 7 ? 'fifth' : sm === 11 ? 'seventh' : 'other' }));
    marks.push({ semi: 12, label: 'C', sub: '8', role: 'root' });
    const rl = I.ruler(s, { x: M, y: CONTENT_TOP + 0.02, w: FULL_W, h: 0.6, marks });
    const by = rl.bottom + 0.12;
    bracket(pres, s, { x1: rl.cx(0) - rl.cellW / 2, x2: rl.cx(5) + rl.cellW / 2, y: by, label: 'Lower tetrachord: W W H' });
    bracket(pres, s, { x1: rl.cx(7) - rl.cellW / 2, x2: rl.cx(12) + rl.cellW / 2, y: by, label: 'Upper tetrachord: W W H' });
    s.addText('W joins them', { x: rl.cx(5), y: by + 0.05, w: rl.cx(7) - rl.cx(5), h: 0.25, fontSize: 11, color: HEX.muted, align: 'center', margin: 0, isTextBox: true });
    // fretboard: the two tetrachords as one shape on two strings
    const lower = [3, 5, 7, 8].map((f) => ({ s: 5, f }));
    const upper = [5, 7, 9, 10].map((f) => ({ s: 4, f }));
    lower.concat(upper).forEach((p, i) => assert(T.pcAt(p.s, p.f) === T.pc(names.concat(['C'])[i]), 'tetrachord frets'));
    const fy = 4.35;
    I.heading(s, 'One 4-note shape, played twice: next string, 2 frets up', M, fy - 0.45, 7.4);
    const links = [];
    for (const grp of [lower, upper]) for (let i = 0; i < 3; i++) links.push({ a: grp[i], b: grp[i + 1], color: HEX.pearl, width: 2 });
    D.fretboard(s, { x: M, y: fy, w: 7.4, h: 2.05, from: 2, to: 11, root: 'C', title: 'Tetrachords on the neck', links, dotSize: 0.4,
      dots: D.dotsFor(lower.concat(upper), { root: 'C', label: 'note' }) });
    D.card(s, { x: 8.4, y: fy - 0.45, w: 12.73 - 8.4, h: 6.85 - fy + 0.45, title: 'Read the pattern', bullets: [
      '**W W H W W W H** from any note builds its major scale',
      'Two identical halves, **W W H**, joined by a whole step',
      'The half steps fall on **3–4** and **7–8**: that is where the pull is',
    ], fontSize: 14, paraSpace: 8 });
  }

  // 15 · Tetrachords build the circle
  {
    const s = D.slideOf(pres, {
      kicker: K, title: 'Tetrachords build the circle',
      notes: `Here's where key signatures come from. Because the major scale is two identical halves, neighboring keys share a half.

Start with C major (second row): C D E F | G A B C. Its upper half, G A B C, can be the lower half of a new scale starting on G. To finish G major you need another W W H tetrachord on top, starting from D: D, E, then a half step to G. But D–E–F is W H, not W W. So F has to rise to F♯: D E F♯ G. G major has exactly one sharp, and it's the new 7th degree. The shaded columns show each shared half.

Do it again from G: its upper half D E F♯ G becomes the bottom of D major, and the new top half needs C♯. D major has two sharps, F♯ and C♯. Each step up a 5th keeps everything, adds one sharp, and the new sharp is always the 7th of the new key.

Going the other way works too. C's lower half, C D E F, can be the upper half of a scale that starts a 5th lower, on F. F's lower half has to be W W H from F: F G A, then a half step to B♭. So F major has one flat, B♭, and the new flat is always the 4th of the new key. From F, B♭ major adds E♭, and so on.

That's the whole logic of the circle of fifths: keys a 5th apart share six of their seven notes and differ by one. Sharp keys build clockwise, flat keys counterclockwise.

Try it now: build A major from D major on paper with the tetrachord method (D's upper half is A B C♯ D; the new upper half needs G♯). Then play A major as two tetrachords on the neck.

Common mistake: memorizing key signatures as unrelated lists. Each key is its neighbor plus one note.`,
    });
    const keys = ['F', 'C', 'G', 'D'];
    const rows = keys.map((k) => T.spellScale(k, 'major').concat([T.normalizeName(k)]));
    for (let r = 0; r < 3; r++) assert(rows[r].slice(4).join() === rows[r + 1].slice(0, 4).join(), `shared tetrachord ${keys[r]}`);
    const cols = 20; const gap = 0.07; const tw = (FULL_W - gap * (cols - 1)) / cols; const th = 0.5;
    const colX = (c) => M + c * (tw + gap);
    const rowY = (r) => 1.95 + r * 0.86;
    // shared halves
    for (let r = 0; r < 3; r++) {
      const c0 = 4 * (r + 1);
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: colX(c0) - 0.06, y: rowY(r) - 0.07, w: 4 * tw + 3 * gap + 0.12, h: rowY(r + 1) + th - rowY(r) + 0.14, rectRadius: 0.08, fill: { color: HEX.card2 }, line: { color: HEX.line, width: 0.75 } });
    }
    const prevAcc = new Set();
    rows.forEach((notes, r) => {
      const sig = T.keySignature(keys[r]);
      s.addText(`${keys[r]} major  ·  ${T.sigLabel(sig)}`, { x: colX(4 * r), y: rowY(r) - 0.31, w: 3.2, h: 0.24, fontSize: 12, bold: true, color: HEX.pearl, margin: 0, valign: 'middle', isTextBox: true });
      notes.forEach((n, i) => {
        const isNew = n.length > 1 && r > 0 && !T.keySignature(keys[r === 1 ? 1 : r - 1]).notes.includes(n) || (r === 0 && n === 'B♭');
        const role = i === 0 || i === 7 ? 'root' : isNew ? 'blue' : n.length > 1 ? 'other' : 'note';
        noteTile(pres, s, { x: colX(4 * r + i), y: rowY(r), w: tw, h: th, label: n, role, fontSize: 14 });
      });
    });
    assert(T.keySignature('G').notes.join() === 'F♯' && T.keySignature('F').notes.join() === 'B♭' && T.keySignature('D').notes.join() === 'F♯,C♯', 'signatures');
    s.addText(D.runs('{blue:Teal} = the one new accidental.  Shaded = the half two neighboring keys share.', { color: HEX.muted, fontSize: 12 }), { x: M + 6.2, y: 1.6, w: 5.93, h: 0.26, align: 'right', margin: 0, valign: 'middle', isTextBox: true });
    const cw = (FULL_W - 0.6) / 3; const cy = 5.35;
    D.card(s, { x: M, y: cy, w: cw, h: 1.5, title: 'Up a 5th: add a sharp', body: 'G reuses C\'s top half. Its new top half needs **F♯**: the new sharp is the **7th**.', fontSize: 14 });
    D.card(s, { x: M + cw + 0.3, y: cy, w: cw, h: 1.5, title: 'Down a 5th: add a flat', body: 'F reuses C\'s bottom half as its top. Its new bottom half needs **B♭**: the new flat is the **4th**.', fontSize: 14 });
    D.card(s, { x: M + 2 * (cw + 0.3), y: cy, w: cw, h: 1.5, title: 'Keep going', body: 'D adds C♯, A adds G♯… B♭ adds E♭, E♭ adds A♭… That chain is the **circle of fifths**.', fontSize: 14 });
  }

  // 16 · The circle of fifths
  {
    const s = D.slideOf(pres, {
      kicker: K, title: 'The circle of fifths',
      notes: `The circle of fifths puts every key on one clock face. Going clockwise, each key is a perfect 5th above the last and has one more sharp (or one fewer flat). Going counterclockwise, each key is a 5th below (a 4th above) and has one more flat. At the bottom, F♯ major (6 sharps) and G♭ major (6 flats) are the same keys spelled two ways.

The inner ring holds the relative minors. Each minor key shares its signature with the major key outside it, and its root is a minor 3rd below the major root: C and A minor, G and E minor, E♭ and C minor.

Order of sharps: F C G D A E B (each a 5th above the last, the same clockwise order). Order of flats: B E A D G C F, exactly backwards. A signature always uses the first N of the list: 3 sharps is F♯ C♯ G♯, never any other three.

Two tricks to name a key from its signature:
• Sharps: the last sharp is the 7th of the key, so go up a half step. F♯ C♯ G♯ → G♯ up a half step → A major.
• Flats: the second-to-last flat is the key. B♭ E♭ A♭ → E♭ major. (One flat is the exception to memorize: F major.)
For the minor key, go down a minor 3rd from the major: A major → F♯ minor.

Why a guitarist cares: the circle is also a map of chord relationships. Neighbors share six notes, so their chords sound related. In Part 4 you'll see that a key's three major chords sit side by side on the circle, and in Part 5 that the strongest chord progressions move counterclockwise, around the circle by 5ths.

Try it now: start at C and say every key clockwise with its signature ("G, one sharp, F♯…"), then counterclockwise.

Common mistake: getting the flat order backwards. Flats spell BEAD-GCF.`,
    });
    I.circleOfFifths(s, { cx: 3.55, cy: 4.2, r: 1.95, rMinor: 1.2, d: 0.6, dMinor: 0.5, rSig: 2.42, major: { C: 'root' }, minor: { Am: 'root' } });
    const rx = 6.95; const rw = 12.73 - rx;
    // card 1: order of sharps and flats
    const c1 = D.card(s, { x: rx, y: CONTENT_TOP, w: rw, h: 1.92, title: 'Order of sharps and flats' });
    const ordRow = (y, label, notes, role) => {
      s.addText(label, { x: c1.innerX, y, w: 0.85, h: 0.42, fontSize: 13, bold: true, color: HEX.muted, margin: 0, valign: 'middle', isTextBox: true });
      I.noteRow(s, { x: c1.innerX + 0.9, y, d: 0.42, gap: 0.12, notes: notes.map((n) => ({ label: n, role })), fontSize: 12 });
    };
    ordRow(c1.innerY, 'Sharps', T.SHARP_ORDER.map((l) => `${l}♯`), 'third');
    ordRow(c1.innerY + 0.55, 'Flats', T.FLAT_ORDER.map((l) => `${l}♭`), 'fifth');
    // card 2: tricks, verified
    assert(T.keySignature('A').notes.join(' ') === 'F♯ C♯ G♯' && T.keySignature('E♭').notes.join(' ') === 'B♭ E♭ A♭', 'trick examples');
    D.card(s, { x: rx, y: 3.67, w: rw, h: 1.65, title: 'Name the key from the signature', body: [
      '**Sharps:** last sharp + a half step. F♯ C♯ G♯ → **A**.',
      '**Flats:** the second-to-last flat. B♭ E♭ A♭ → **E♭**. One flat = **F**.',
    ], fontSize: 14, paraSpace: 4 });
    assert(T.keySignature('C').relative === 'A' && T.keySignature('G').relative === 'E' && T.keySignature('E♭').relative === 'C', 'relatives');
    D.card(s, { x: rx, y: 5.5, w: rw, h: 1.35, title: 'Relative minor: the inner ring', body: 'A minor 3rd below, same signature: C → Am, G → Em, E♭ → Cm.', fontSize: 14 });
  }

  // 17 · The neck is a circle of fourths
  {
    const s = D.slideOf(pres, {
      kicker: K, title: 'The neck is a circle of fourths',
      notes: `Standard tuning is (almost) all 4ths: E to A, A to D, D to G, and B to E are perfect 4ths. Only G to B is a major 3rd. So when you move straight across the neck at one fret, you're moving counterclockwise around the circle of fifths, which is clockwise around the circle of 4ths.

The board shows the complete circle of 4ths in two passes. Pass 1 starts on G (6th string, 3rd fret) and climbs straight across: G, C, F, B♭. Crossing G→B, the 4th above B♭ (E♭) sits one fret higher, and the pattern continues from there: E♭, A♭. Pass 2 picks up on the low E string at the 9th fret with D♭ and does the same: D♭, G♭, B (that's C♭, the point where flat names flip to sharp names), E, A, D. One more 4th brings you back to G. Twelve notes, every key, two diagonal shapes.

Why this is useful:
• Chord progressions that move up a 4th (V–I, ii–V–I, the "E–A–D–G" cycle at the end of many blues and rock tunes) put the next root one string over, at the same fret. Your hand barely moves.
• Learning the circle on the neck means you can find the IV chord of any key instantly: one string over from the root, same fret. The V chord is the same fret, one string down (a 5th up is a 4th down).
• Practicing the circle in this shape trains note names across all six strings.

The teal rings mark the two places where the G→B shift kicks in.

Try it now: play the two passes slowly, saying each note name. Then play root-position power chords on each 6th- and 5th-string note in the same order: the classic circle exercise.

Common mistake: forgetting the B-string shift and landing on the major 3rd instead of the 4th.`,
    });
    const pass1 = [[6, 3], [5, 3], [4, 3], [3, 3], [2, 4], [1, 4]];
    const pass2 = [[6, 9], [5, 9], [4, 9], [3, 9], [2, 10], [1, 10]];
    const labels = ['G', 'C', 'F', 'B♭', 'E♭', 'A♭', 'D♭', 'G♭', 'B', 'E', 'A', 'D'];
    const all = pass1.concat(pass2);
    for (let i = 0; i < 12; i++) assert(T.mod12(T.pc(labels[(i + 1) % 12]) - T.pc(labels[i])) === 5, 'circle of 4ths order');
    for (const pass of [pass1, pass2]) for (let i = 0; i < 5; i++) assert(T.midi(pass[i + 1][0], pass[i + 1][1]) - T.midi(pass[i][0], pass[i][1]) === 5, 'pass steps are 4ths');
    s.addText(D.runs(`Up a 4th each step:  **${labels.join(' → ')} → G**`, { color: HEX.text, fontSize: 14 }), { x: M, y: CONTENT_TOP + 0.02, w: FULL_W, h: 0.3, margin: 0, valign: 'middle', isTextBox: true });
    const dots = all.map(([st, f], i) => ({ s: st, f, label: labels[i], role: st === 2 ? 'blue' : 'note', ring: st === 2 }));
    const links = [];
    for (const pass of [pass1, pass2]) for (let i = 0; i < 5; i++) links.push({ a: { s: pass[i][0], f: pass[i][1] }, b: { s: pass[i + 1][0], f: pass[i + 1][1] }, color: HEX.pearl, width: 2 });
    links.push({ a: { s: 1, f: 4 }, b: { s: 6, f: 9 }, color: HEX.faint, width: 1.5, dash: 'dash' });
    D.fretboard(s, { x: M, y: 2.5, w: FULL_W, h: 2.2, from: 0, to: 12, dots, links, dotSize: 0.42, title: 'Circle of fourths', regions: [{ from: 3, to: 4, label: 'Pass 1' }, { from: 9, to: 10, label: 'Pass 2' }] });
    const cw = (FULL_W - 0.6) / 3; const cy = 5.2;
    D.card(s, { x: M, y: cy, w: cw, h: 1.65, title: 'Same fret, next string', body: 'One string higher at the same fret is **up a 4th**: one step around the circle.', fontSize: 14 });
    D.card(s, { x: M + cw + 0.3, y: cy, w: cw, h: 1.65, title: 'Except G→B', body: 'G to B is a major 3rd. Crossing onto the B string, the 4th is **1 fret higher** (teal rings).', fontSize: 14 });
    D.card(s, { x: M + 2 * (cw + 0.3), y: cy, w: cw, h: 1.65, title: 'Progressions in 4ths', body: 'V–I, ii–V–I and E–A–D–G cycles: the next root is **one string over**, same fret.', fontSize: 14 });
  }

  // 18 · Scale degrees and tendency tones
  {
    const s = D.slideOf(pres, {
      kicker: K, title: 'Scale degrees and tendency tones',
      notes: `Inside a key, the seven notes don't have equal status. Three are stable and four pull toward a stable neighbor. Those pulls are the source of tension and release in melody and, in Part 5, in harmony.

The stable notes are 1, 3 and 5, the notes of the tonic chord (C E G in C major). Stop a melody on any of them and it feels at rest, most of all on 1.

The unstable notes and where they lean:
• 7, the leading tone, pulls up a half step to 1 (B to C). It's the strongest pull in the scale, and it's why the V chord, which contains it, wants to resolve to I.
• 4 pulls down a half step to 3 (F to E). Together, 7→1 and 4→3 are the two half-step resolutions; you'll meet them again as the tritone in Part 5.
• 6 pulls down a whole step to 5 (A to G).
• 2 pulls down to 1 (or sometimes up to 3).
Red arrows are half-step pulls, the strongest kind.

The table gives each degree its traditional name. These names are used in every theory book, so it's worth learning them: tonic, supertonic (just above the tonic), mediant (halfway to the dominant), subdominant (a 5th below the tonic, so the "lower dominant"), dominant, submediant (halfway down to the subdominant), leading tone.

In natural minor, the 7th is a whole step below the root (G in A minor), so it doesn't pull nearly as hard. In that case it's called the subtonic. The next slide shows how harmonic minor raises it to restore the pull.

Try it now: loop a C drone (or let the open A ring and work in A). Play up the scale and stop on each degree for two beats. Feel which ones want to move, then let each resolve along its arrow.

Common mistake: ending phrases on 2, 4 or 7 by accident. Land on 1, 3 or 5 when you want a phrase to sound finished.`,
    });
    const sem = semisOf('major'); const names = T.spellScale('C', 'major');
    const stableRole = { 0: 'root', 4: 'third', 7: 'fifth' };
    const marks = sem.map((sm, i) => ({ semi: sm, label: names[i], sub: String(i + 1), role: stableRole[sm] || 'other' }));
    marks.push({ semi: 12, label: 'C', sub: '1', role: 'root' });
    const rl = I.ruler(s, { x: M, y: CONTENT_TOP + 0.02, w: FULL_W, h: 0.6, marks, steps: false });
    const ay = rl.bottom + 0.2;
    const pulls = [[11, 12, '7 → 1', true], [5, 4, '4 → 3', true], [9, 7, '6 → 5', false], [2, 0, '2 → 1', false]];
    for (const [a, b, lab, half] of pulls) {
      const col = half ? HEX.root : HEX.pearl;
      const dir = b > a ? 1 : -1;
      I.arrow(s, rl.cx(a) - dir * 0.05, ay, rl.cx(b) + dir * 0.12, ay, { color: col, width: 2.25 });
      s.addText(lab, { x: Math.min(rl.cx(a), rl.cx(b)) - 0.3, y: ay + 0.08, w: Math.abs(rl.cx(a) - rl.cx(b)) + 0.6, h: 0.24, fontSize: 12, bold: true, color: col, align: 'center', margin: 0, isTextBox: true });
    }
    const ty = ay + 0.5;
    const DEG = [['1', 'Tonic', 'Home. Most stable'], ['2', 'Supertonic', 'Leans down to 1 (or up to 3)'], ['3', 'Mediant', 'Stable: the 3rd of the I chord'], ['4', 'Subdominant', '{root:Down a half step to 3}'], ['5', 'Dominant', 'Stable, but leans toward 1'], ['6', 'Submediant', 'Down a whole step to 5'], ['7', 'Leading tone', '{root:Up a half step to 1}']];
    D.table(s, [['Degree', 'Name', 'In C', 'Tendency'], ...DEG.map(([d, n, t], i) => [d, n, names[i], t])], { x: M, y: ty, w: 7.6, colW: [0.85, 1.65, 0.75, 4.35], rowH: 0.34, fontSize: 13, align: ['center', 'left', 'center', 'left'] });
    D.card(s, { x: 8.5, y: ty, w: 12.73 - 8.5, h: 6.85 - ty, title: 'In minor: the subtonic', body: [
      `In A natural minor the 7th is **${T.spellScale('A', 'minor')[6]}**, a whole step below the root. No half-step pull, so it's called the **subtonic**.`,
      `Raise it to **${T.spellScale('A', 'harmonicMinor')[6]}** and it becomes a leading tone again: harmonic minor, next slide.`,
    ], fontSize: 14 });
  }

  // 19 · Three minor scales
  {
    const s = D.slideOf(pres, {
      kicker: K, title: 'Three minor scales',
      notes: `Minor comes in three versions. Each one exists to fix a problem with the one before, and you'll hear all three in rock, metal, classical and jazz.

Natural minor (Aeolian) is the relative minor of the major scale: A B C D E F G uses the same notes as C major. Its formula is 1 2 ♭3 4 5 ♭6 ♭7. It sounds dark and stable, the default sound of rock and metal riffs. The problem: its 7th (G) is a whole step below the root, so there's no leading tone. The chord built on the 5th degree is E minor, which doesn't pull home strongly.

Harmonic minor raises the 7th: A B C D E F G♯. Now G♯ leads up to A by a half step, and the chord on the 5th degree becomes E major, or E7 with the 7th added. That's the strong V–i cadence that minor-key classical music, and a lot of metal, depend on. The side effect is the gap between F and G♯: three frets, an augmented 2nd (a 2nd because F to G is two letters). The ruler labels that step W+H. That gap is the instantly recognizable "exotic" or neoclassical sound.

Melodic minor raises the 6th as well: A B C D E F♯ G♯. That closes the gap and makes the scale smooth to sing. In classical practice it's used going up, with the natural minor coming back down. In jazz it's used both ways, and its modes (Part 7) are the source of altered dominant sounds. Notice that it's a major scale with a minor 3rd.

Teal marks the raised notes in each version.

Try it now: in 5th position, play A natural minor, then change one note (G to G♯) for harmonic minor, then two notes (F to F♯, G to G♯) for melodic minor. Play an E7 chord and resolve each scale to A over it. Listen for which version makes the E7 sound right.

Common mistake: calling the G♯ an A♭. It's the 7th degree, so it must be a G.`,
    });
    const kinds = [['minor', 'A natural minor', []], ['harmonicMinor', 'A harmonic minor', [11]], ['melodicMinor', 'A melodic minor', [9, 11]]];
    const ROLE = { 0: 'root', 3: 'third', 7: 'fifth', 10: 'seventh', 11: 'seventh' };
    let y = CONTENT_TOP;
    const rw = 7.5;
    kinds.forEach(([kind, label, raised], k) => {
      const sem = semisOf(kind); const names = T.spellScale('A', kind);
      I.heading(s, `${label}:  ${names.join(' ')}`, M, y, rw);
      const marks = sem.map((sm, i) => ({ semi: sm, label: names[i], sub: T.prettyDegree(T.FORMULAS[kind][i]), role: raised.includes(sm) ? 'blue' : ROLE[sm] || 'other' }));
      marks.push({ semi: 12, label: 'A', sub: '8', role: 'root' });
      const rl = I.ruler(s, { x: M, y: y + 0.32, w: rw, h: 0.48, marks, numbers: k === 0, fontSize: 12 });
      y = rl.bottom + 0.1;
    });
    assert(T.intervalName('F', 'G♯') === 'A2', 'augmented 2nd');
    const rx = 8.45; const cw = 12.73 - rx;
    D.card(s, { x: rx, y: CONTENT_TOP, w: cw, h: 1.65, title: 'Natural: the relative minor', body: 'Same notes as C major. The **♭7 (G)** is a whole step below A: no leading tone.', fontSize: 14 });
    D.card(s, { x: rx, y: 3.38, w: cw, h: 1.75, title: 'Harmonic: raise 7', body: '**G♯** leads to A and makes the V chord **E7**. Leaves a 3-fret gap, F–G♯: an **augmented 2nd**.', fontSize: 14 });
    D.card(s, { x: rx, y: 5.3, w: cw, h: 1.55, title: 'Melodic: raise 6 and 7', body: '**F♯** closes the gap. Classical: going up only. Jazz: both ways.', fontSize: 14 });
  }

  // 20 · The brightness ladder
  {
    const s = D.slideOf(pres, {
      kicker: K, title: 'The brightness ladder',
      notes: `The seven modes are the seven ways to treat one set of notes (the major scale's) as home. You can also compare them from a single root, and ordered the right way they form a ladder: each mode is the one above it with exactly one note lowered by a half step.

Start at the top with Lydian, the brightest: 1 2 3 ♯4 5 6 7. Every note is as high as it can be. Lower the ♯4 to 4 and you have Ionian, the major scale. Lower the 7 and you get Mixolydian, the major scale with a ♭7, the sound of rock and blues riffs over a major chord. Lower the 3 and you get Dorian: a minor scale with a bright natural 6, used for minor funk, blues and a lot of classic rock soloing. Lower the 6 and you get Aeolian, natural minor. Lower the 2 for Phrygian, the dark, Spanish or metal sound of the ♭2. Lower the 5 for Locrian, the darkest. It's so unstable (its tonic chord is diminished) that it's rarely used as a home.

The teal cell in each row is the note that just changed. The root never moves. The dark cells are the degrees that are lower than in the major scale.

Why this order matters:
• It tells you each mode's character note: the one note that separates it from its nearest neighbor (♯4 for Lydian, ♭7 for Mixolydian, natural 6 for Dorian, ♭2 for Phrygian).
• It tells you how to move between modes: one finger, one fret.
• It's the circle of fifths again. Each step down the ladder is the same root borrowing the notes of the key a 5th lower.

All examples here are from A, the guitarist's home key. In 5th position, every row is your A minor or major shape with one or two notes moved.

Try it now: over an A drone, play down the ladder one row at a time, changing only the teal note. Then stop on each mode and improvise for 30 seconds, leaning on its teal note.

Common mistake: thinking of modes as "starting the C major scale on D". That's true for their notes, but you only hear the mode when D is home.`,
    });
    const order = ['lydian', 'ionian', 'mixolydian', 'dorian', 'aeolian', 'phrygian', 'locrian'];
    const majS = semisOf('major');
    const rowH = 0.62; const rg = 0.085; const y0 = CONTENT_TOP + 0.05;
    const cx0 = 3.55; const cw = 0.98; const cg = 0.09;
    order.forEach((mode, r) => {
      const f = T.FORMULAS[mode]; const names = T.spellScale('A', mode);
      let changed = -1; let desc = '';
      if (r === 0) { changed = 3; desc = 'raised 4: brightest'; } else {
        const prev = T.FORMULAS[order[r - 1]];
        const diffs = f.map((d, i) => (d !== prev[i] ? i : -1)).filter((i) => i >= 0);
        assert(diffs.length === 1, `${mode} differs by one note`);
        changed = diffs[0];
        assert(T.mod12(T.parseDegree(prev[changed]).semis - T.parseDegree(f[changed]).semis) === 1, `${mode} lowers by a half step`);
        desc = `lower ${T.prettyDegree(prev[changed])} → ${T.prettyDegree(f[changed])}${mode === 'locrian' ? ': darkest' : ''}`;
      }
      const y = y0 + r * (rowH + rg);
      s.addText([
        { text: MODE_LABEL[mode], options: { bold: true, color: HEX.white, fontSize: 16, breakLine: true } },
        { text: desc, options: { color: HEX.muted, fontSize: 12 } },
      ], { x: M, y, w: 2.85, h: rowH, margin: 0, valign: 'middle', isTextBox: true, lineSpacingMultiple: 1.0 });
      f.forEach((d, i) => {
        const x = cx0 + i * (cw + cg);
        const isChanged = i === changed;
        const lowered = T.parseDegree(d).semis < majS[i];
        const fill = i === 0 ? HEX.root : isChanged ? HEX.blue : lowered ? '1B1B21' : HEX.card2;
        const fg = isChanged ? HEX.bg : HEX.white;
        s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: cw, h: rowH, rectRadius: 0.06, fill: { color: fill }, line: { color: lowered && !isChanged ? HEX.line : fill, width: 0.75 } });
        s.addText([
          { text: T.prettyDegree(d), options: { bold: true, color: fg, fontSize: 15, breakLine: true } },
          { text: names[i], options: { color: isChanged ? HEX.bg : HEX.text, fontSize: 11, bold: true } },
        ], { x, y, w: cw, h: rowH, margin: 0, align: 'center', valign: 'middle', isTextBox: true, lineSpacingMultiple: 0.95 });
      });
    });
    // brightness arrow
    const ax = 11.35; const yTop = y0 + 0.1; const yBot = y0 + 7 * rowH + 6 * rg - 0.1;
    I.arrow(s, ax, yBot, ax, yTop + 0.35, { color: HEX.pearl, width: 2.25 });
    s.addText('Brighter', { x: ax - 0.6, y: yTop - 0.12, w: 1.6, h: 0.3, fontSize: 14, bold: true, color: HEX.pearl, align: 'center', margin: 0, isTextBox: true });
    s.addText('Darker', { x: ax + 0.2, y: yBot - 0.3, w: 1.1, h: 0.3, fontSize: 14, bold: true, color: HEX.muted, align: 'left', margin: 0, isTextBox: true });
    s.addText(D.runs('Each row lowers **one** note of the row above by a half step ({blue:teal}). The root never moves. Dark cells are lower than in the major scale.', { color: HEX.muted, fontSize: 12 }), { x: M, y: 6.55, w: FULL_W, h: 0.28, margin: 0, valign: 'middle', isTextBox: true });
  }

  // 21 · Why the pentatonic is safe
  {
    const s = D.slideOf(pres, {
      kicker: K, title: 'Why the pentatonic is safe',
      notes: `Every guitarist learns early that the pentatonic "always works". Here's why, in theory terms.

Stack perfect 5ths from F: F C G D A E B. Those seven notes are the C major scale. Any seven adjacent notes on the circle of fifths make a major scale (and its modes). Now take only the middle five, C G D A E. That's the C major pentatonic: five adjacent 5ths. The two notes you dropped, F and B, are the ends of the chain.

What did dropping them remove?
• Every half step. In C major the half steps are E–F and B–C. Both involve F or B. Without them, every gap in the pentatonic is a whole step or a minor 3rd (W or W+H on the ruler). No note sits a half step from another, so no note can grind against a chord tone a half step away.
• The tritone. The only tritone in C major is F–B. Both are gone, so the scale has no built-in instability.
• The tendency tones. F (4) and B (7) are the two notes with the strongest pulls in the key. Without them, nothing in the scale demands to resolve.

The result is a scale with no wrong notes over most of the chords in its key. The same five notes, started from A, are A minor pentatonic: A C D E G, formula 1 ♭3 4 5 ♭7. Same notes, different home, exactly like relative major and minor.

The flip side: the pentatonic is safe because it's neutral. The half steps and the tritone you removed are where tension and color come from. In Part 7 you'll add them back on purpose: chord tones, targeted half steps, and the blue note.

Try it now: over an A drone, play A minor pentatonic in box 1, then add F (♭6) and B (2) to get the full A natural minor. Listen to how the added notes create pull, and how easy they are to land on badly.

Common mistake: thinking "safe" means "best". It means "low risk", and it can also mean low drama.`,
    });
    const fifths = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
    for (let i = 0; i < 6; i++) assert(T.intervalName(fifths[i], fifths[i + 1]) === 'P5', 'stacked fifths');
    assert(new Set(fifths).size === 7 && T.spellScale('C', 'major').every((n) => fifths.includes(n)), 'seven fifths = C major');
    const pent = T.spellScale('C', 'majPent');
    assert(pent.every((n) => fifths.slice(1, 6).includes(n)), 'pentatonic = middle five');
    const tw = 1.22; const tg = 0.46; const tx0 = M + (FULL_W - (7 * tw + 6 * tg)) / 2; const ty = CONTENT_TOP + 0.2; const th = 0.78;
    const roleC = (n) => (n === 'F' || n === 'B' ? 'ghost' : { C: 'root', E: 'third', G: 'fifth' }[n] || 'other');
    fifths.forEach((n, i) => {
      const x = tx0 + i * (tw + tg);
      noteTile(pres, s, { x, y: ty, w: tw, h: th, label: n, role: roleC(n), fontSize: 22 });
      if (i < 6) {
        I.arrow(s, x + tw + 0.06, ty + th / 2, x + tw + tg - 0.06, ty + th / 2, { color: HEX.faint, width: 1.25 });
        s.addText('P5', { x: x + tw, y: ty + th / 2 - 0.32, w: tg, h: 0.2, fontSize: 10, bold: true, color: HEX.muted, align: 'center', margin: 0, isTextBox: true });
      }
    });
    const xL = (i) => tx0 + i * (tw + tg); const xR = (i) => xL(i) + tw;
    bracket(pres, s, { x1: xL(1), x2: xR(5), y: ty + th + 0.18, label: 'C major pentatonic: 5 adjacent fifths', color: HEX.pearl });
    bracket(pres, s, { x1: xL(0), x2: xR(6), y: ty + th + 0.68, label: 'C major: 7 adjacent fifths. F and B bring the half steps and the tritone.', color: HEX.muted });
    // ruler of C major pentatonic
    const ry = 3.95;
    I.heading(s, 'C major pentatonic: no half steps', M, ry - 0.38, 7.3);
    const pSem = semisOf('majPent');
    const marks = pSem.map((sm, i) => ({ semi: sm, label: pent[i], sub: T.FORMULAS.majPent[i], role: roleC(pent[i]) }));
    marks.push({ semi: 12, label: 'C', sub: '8', role: 'root' });
    const rl = I.ruler(s, { x: M, y: ry, w: 7.3, h: 0.5, marks, fontSize: 12 });
    const am = T.spellScale('A', 'minPent');
    const ny = rl.bottom + 0.12;
    I.heading(s, `Same five notes from A: A minor pentatonic`, M, ny, 7.3);
    I.noteRow(s, { x: M, y: ny + 0.36, d: 0.44, gap: 0.2, notes: am.map((n, i) => ({ label: n, sub: T.prettyDegree(T.FORMULAS.minPent[i]), role: { A: 'root', C: 'third', E: 'fifth', G: 'seventh' }[n] || 'other' })) });
    D.card(s, { x: 8.3, y: ry - 0.38, w: 12.73 - 8.3, h: 6.85 - ry + 0.38, title: 'Why it never clashes', bullets: [
      '**No half steps**: every gap is a W or W+H, so no note grinds against a neighbor',
      '**No tritone**: F–B is the only one in C major, and both are gone',
      '**No strong pulls**: the restless 4 and 7 are the notes that were removed',
    ], fontSize: 14, paraSpace: 8 });
  }

  // 22 · Exercises on paper
  {
    const scales = [['E♭', 'major'], ['B', 'major'], ['F♯', 'minor'], ['C', 'harmonicMinor'], ['D', 'melodicMinor'], ['G♯', 'harmonicMinor']];
    const kName = { major: 'major', minor: 'natural minor', harmonicMinor: 'harmonic minor', melodicMinor: 'melodic minor' };
    const sigText = (key, mode) => { const sg = T.keySignature(key, mode); return `${T.sigLabel(sg)}: ${sg.notes.join(' ')}`; };
    const maj4 = majorWith(4, '♯'); const maj5f = majorWith(5, '♭'); const min1f = T.keySignature(majorWith(1, '♭')).relative;
    I.worksheet(pres, {
      part: 2, kicker: K, grid: 'row',
      intro: 'Pencil only. Spell by letter: every 7-note scale uses each letter once.',
      groups: [
        { key: 'A', title: 'Spell the scale', instr: 'Write all 7 notes.', items: scales.map(([r, k]) => [`${r} ${kName[k]}`, T.spellScale(r, k).join(' ')]) },
        { key: 'B', title: 'Key signatures', weight: 1.15, items: [
          ['Major key with 4♯?', `${maj4} (relative ${T.keySignature(maj4).relative} minor)`],
          ['Major key with 5♭?', `${maj5f} (relative ${T.keySignature(maj5f).relative} minor)`],
          ['Signature of A♭ major', sigText('A♭', 'major')],
          ['Signature of B minor', sigText('B', 'minor')],
          ['Relative minor of E♭ major', `${T.keySignature('E♭').relative} minor`],
          ['Relative major of G♯ minor', `${T.keySignature('G♯', 'minor').relative} major`],
          ['Signature of F♯ major', sigText('F♯', 'major')],
          ['Minor key with 1♭?', `${min1f} minor`],
        ] },
        { key: 'C', title: 'Modes', weight: 1.3, items: [
          ['D Dorian: parent major?', parentMajor('D', 'dorian')],
          ['F♯ Phrygian: parent major?', parentMajor('F♯', 'phrygian')],
          ['B♭ Lydian: parent major?', parentMajor('B♭', 'lydian')],
          ['A Mixolydian: parent major?', parentMajor('A', 'mixolydian')],
          ['Which mode is 1 2 3 ♯4 5 6 7?', modeOfFormula(['1', '2', '3', '#4', '5', '6', '7'])],
          ['Which mode is 1 ♭2 ♭3 4 ♭5 ♭6 ♭7?', modeOfFormula(['1', 'b2', 'b3', '4', 'b5', 'b6', 'b7'])],
          ['Spell E Dorian', T.spellScale('E', 'dorian').join(' ')],
          ['Which note turns A minor into A Dorian?', `${T.spellScale('A', 'dorian').find((n) => !T.spellScale('A', 'minor').includes(n))} (natural 6)`],
        ] },
        { key: 'D', title: 'Degrees and pulls', weight: 1.15, items: [
          ['Name of degree 6?', 'Submediant'],
          ['Leading tone of E♭ major?', T.spellScale('E♭', 'major')[6]],
          ['Dominant (5th) of F♯ minor?', T.spellScale('F♯', 'minor')[4]],
          ['Subdominant (4th) of B major?', T.spellScale('B', 'major')[3]],
          ['In C major, F pulls to…?', `${T.noteBelow('F', 'm2')} (down a half step)`],
          ['In G major, F♯ resolves to…?', T.noteAbove('F♯', 'm2')],
          ['Subtonic of A natural minor?', T.spellScale('A', 'minor')[6]],
        ] },
      ],
      notes: `Worksheet for Part 2. Pencil only; check against the answer key (Part 2, groups A–D).

Group A, spell the scale: write the seven letters first (starting from the root), then apply the formula. For major, use W W H W W W H, or the key signature if you know it. For minor scales, start from the major scale on the same root and lower the right degrees (♭3, ♭6, ♭7 for natural minor), then raise back what the harmonic or melodic version needs. G♯ harmonic minor needs a double sharp; that's deliberate.

Group B, key signatures: use the order of sharps (F C G D A E B) and flats (B E A D G C F), and the two tricks from the circle slide. For relative keys, go down a minor 3rd from major to minor, up a minor 3rd from minor to major, keeping the letters straight (G♯ minor's relative major is B, not C♭).

Group C, modes: the parent major of a mode is the major scale that contains the same notes. Count down to it: Dorian is built on the 2nd degree, so its parent is a whole step down; Phrygian, a major 3rd down; Lydian, a 4th down; Mixolydian, a 5th down. For formulas, use the brightness ladder.

Group D: use the degree names and the tendency-tone arrows.

Scoring: at most one miss per group to pass. If you miss two or more, reread the matching slide and redo the group the next day with different keys of your own choosing.`,
    });
  }

  // 23 · Exercises on the neck
  D.practice(pres, {
    kicker: K, title: 'Exercises on the neck',
    intro: 'Daily, 15 minutes. Say note names and key signatures out loud.',
    drills: [
      { name: 'Tetrachord keys', how: 'Play each major scale as two tetrachords on adjacent strings. Go around the circle: C, G, D, A… then F, B♭, E♭… Say the new sharp or flat each time.', tempo: '60 bpm, 8th notes', time: '5 min', done: 'All 12 keys in under 2 minutes' },
      { name: 'Circle walk', how: 'Play the two-pass circle of 4ths on the neck, naming each note and its key signature. Then play power chords on the same roots.', tempo: '60 bpm, one note per beat', time: '3 min', done: 'Whole circle, no stops, no misses' },
      { name: 'Tendency tones', how: 'Over an A drone, play up A major and stop on each degree. Sing where it wants to go, then resolve it on the guitar.', tempo: 'Free time', time: '3 min', done: 'You can sing every resolution before playing it' },
      { name: 'Brightness ladder', how: 'Over an A drone, in 5th position: Lydian down to Locrian, changing one note per mode. Improvise 30 s in each, leaning on its teal note.', tempo: 'Free time', time: '5 min', done: 'A friend picks a mode; you name it by ear' },
    ],
    notes: `Four drills for Part 2, about 15 minutes a day for a week.

1. Tetrachord keys. Play every major scale as two four-note shapes: the lower tetrachord on one string, the upper one on the next string two frets higher (three frets higher when the upper half lands on the B string). Go clockwise around the circle from C, saying the new sharp for each key ("G: F♯. D: C♯."), then counterclockwise for the flats. This drill ties together the scale formula, the tetrachord logic and the circle.

2. Circle walk. Play the two diagonal passes from the "neck is a circle of fourths" slide. Name each note and its key signature as you play it. When that's easy, play a power chord on each root in the same order. That's the root motion of a huge number of chord progressions.

3. Tendency tones. Let an A drone ring (looper, app, or the open A string). Play the A major scale slowly. Stop on each degree, hold it, and sing the note it wants to move to before you play it: G♯ to A, D to C♯, F♯ to E, B to A. You're training your ear to hear tension as a direction.

4. Brightness ladder. Stay in 5th position over the A drone. Play A Lydian, then lower one note to get Ionian, and so on down to Locrian. Spend 30 seconds improvising in each mode, landing often on its teal note. After a week, have someone else choose a mode, or record yourself picking at random, and name it by ear.

Track which drill feels hardest; that's the one to keep going after the week ends.`,
  });
}

module.exports = { build };
