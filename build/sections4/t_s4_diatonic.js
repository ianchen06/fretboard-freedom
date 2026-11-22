// Theory Intensive · Part 4 · Diatonic harmony (slides 35–42)
const T = require('../lib/theory');
const D = require('../lib/draw');
const I = require('../lib/intensive');
const { HEX, M, CONTENT_TOP, section } = require('../lib/deck');

const K = '4 · Diatonic harmony';
const FULL_W = 12.13;

// Roman numeral of a chord name inside a key, searching triads and 7ths (minor keys also search harmonic minor).
function numeralIn(key, mode, chord) {
  const kinds = mode === 'major' ? ['major'] : ['minor', 'harmonicMinor'];
  for (const k of kinds) for (const size of [3, 4]) {
    const c = T.diatonicChords(key, k, size).find((x) => x.name === chord);
    if (c) return c.numeral;
  }
  throw new Error(`${chord} is not diatonic to ${key} ${mode}`);
}
const MAJOR_KEYS = ['C', 'G', 'D', 'A', 'E', 'B', 'F♯', 'D♭', 'A♭', 'E♭', 'B♭', 'F'];
// The unique major key whose triads and 7ths contain every chord in the list.
function majorKeyOf(chords) {
  const hits = MAJOR_KEYS.filter((k) => {
    const names = new Set([...T.diatonicChords(k, 'major', 3), ...T.diatonicChords(k, 'major', 4)].map((c) => c.name));
    return chords.every((c) => names.has(c));
  });
  if (hits.length !== 1) throw new Error(`Key of ${chords.join(' ')} is ambiguous: ${hits.join(', ')}`);
  return hits[0];
}

function build(pres) {
  section(pres, 'Diatonic harmony');
  const slide = (title, notes) => D.slideOf(pres, { kicker: K, title, notes });

  // 35 · Divider
  D.divider(pres, {
    num: 4,
    title: 'Diatonic harmony',
    subtitle: 'Stack 3rds on every note of a scale and you get the seven chords of a key: the family every song in that key draws from.',
    outcomes: [
      'Name the seven triads and 7th chords of any major key',
      'Find a song’s key from the chords it uses',
      'Use minor-key harmony, natural and harmonic',
      'Harmonize a line in 3rds and 6ths on the neck',
    ],
    notes: `Part 4: Diatonic harmony.

"Diatonic" means "belonging to the key": built only from the seven notes of the scale. In Part 3 you stacked 3rds on a root. Now you'll stack 3rds on every note of a scale, using only notes from that scale, and see what comes out. The answer is the same in every major key: a fixed pattern of three major chords, three minor chords and one diminished chord. That pattern is the backbone of almost every song you know.

What this part covers:
• Harmonizing the major scale in triads, and the reason each chord gets the quality it does.
• Harmonizing in 7th chords, and why there's exactly one dominant 7 per key, which makes it the fingerprint that tells you the key.
• The seven diatonic 7th chords as one connected ladder of drop 2 voicings up the neck.
• Harmony in minor keys: the natural-minor chords, the fix that harmonic minor provides, and the minor-key progressions rock and metal are built on.
• Harmonizing a melody in 3rds and 6ths, the double-stop sound of soul, Southern rock and countless guitar intros.

Roman numerals: chords are named by the scale degree of their root. Upper case = major, lower case = minor, ° = diminished. The numerals stay the same in every key, so "I–vi–IV–V" describes the same progression in C (C Am F G) and in A (A F♯m D E). Think in numerals from now on. Part 5 depends on it.

How to study it: for each slide, play the chords in at least two keys and say the numerals out loud as you go.`,
  });

  // 36 · Harmonizing the major scale
  {
    const s = slide('Harmonizing the major scale', `Take the C major scale, and on every note stack two more scale notes, skipping one each time: C-E-G, D-F-A, E-G-B, and so on. You only use notes from the scale, so the 3rds you get are whatever sizes the scale provides. The result is seven triads, one per degree.

The qualities fall out of the scale's half steps (E–F and B–C):
• On 1, 4 and 5 (C, F, G) the scale has a major 3rd above the root, then a minor 3rd. Major triads: I, IV, V.
• On 2, 3 and 6 (D, E, A) it has a minor 3rd, then a major 3rd. Minor triads: ii, iii, vi.
• On 7 (B) it has two minor 3rds: B–D–F. Diminished: vii°.

Because every major scale has the same step pattern, every major key has the same chord pattern: major, minor, minor, major, major, minor, diminished. Memorize the pattern once and you know the chords of all twelve keys. The table shows eight keys, all generated from that rule.

Read it as numerals. In any major key, I, IV and V are the three major chords. If a song uses G, C and D, it's almost certainly in G (I, IV, V). If it adds Em, that's vi. That's how you'll find keys by ear later.

Try it now: play the seven chords of C as open or barre chords, saying "one, two minor, three minor, four, five, six minor, seven diminished". Then do G (G Am Bm C D Em F♯°) and D. The diminished chord is the awkward one; play it as a small triad on the top strings (for C: B–D–F at frets 4-3-1 on strings 3-2-1).

Common mistake: assuming a chord's quality from its letter. D is minor in C (ii) but major in G (V) and D (I). Quality comes from the key, not the letter.`);
    const cs = T.diatonicChords('C', 'major', 3);
    I.progression(s, { x: M, y: CONTENT_TOP, w: FULL_W, h: 1.15, gap: 0.2, arrows: false, chords: cs.map((c) => ({ name: c.name, numeral: c.numeral, sub: c.notes.join(' ') })) });
    const keys = ['C', 'G', 'D', 'A', 'E', 'F', 'B♭', 'E♭'];
    const head = ['Key', ...cs.map((c) => c.numeral)];
    const rows = keys.map((k) => [`**${k}**`, ...T.diatonicChords(k, 'major', 3).map((c) => c.name)]);
    const tw = 7.9;
    D.table(s, [head, ...rows], { x: M, y: 2.95, w: tw, colW: [0.9, ...Array(7).fill((tw - 0.9) / 7)], rowH: 0.34, fontSize: 14, align: ['left', 'center', 'center', 'center', 'center', 'center', 'center', 'center'] });
    const rx = M + tw + 0.35; const rw = 12.73 - rx;
    D.card(s, { x: rx, y: 2.95, w: rw, h: 3.06, title: 'Why each quality', titleColor: HEX.pearl, body: [
      '**1, 4, 5:** major 3rd + minor 3rd → {third:major}.',
      '**2, 3, 6:** minor 3rd + major 3rd → {third:minor}.',
      '**7:** minor 3rd + minor 3rd → {blue:diminished}.',
      'Every key, same order: **maj min min maj maj min dim**.',
    ], fontSize: 14, paraSpace: 8 });
  }

  // 37 · Diatonic seventh chords
  {
    const s = slide('Diatonic seventh chords', `Stack one more scale note on each triad and you get the diatonic 7th chords. Same method, same rule: only notes of the scale.

In every major key the pattern is:
• Imaj7 and IVmaj7: major triad + major 7th.
• ii7, iii7 and vi7: minor 7th chords.
• V7: the only dominant 7th.
• viiø7: half-diminished (m7♭5).

The important line is the dominant. V7 is the only chord in the key with a major 3rd and a minor 7th, and it holds the key's tritone (in C, the B and F of G7). One dominant 7 per key means a dominant 7 points to its key. Hear or see G7 and the key is C (or C minor, which Part 4's minor slide explains). That's the fastest key-finding trick there is: find the dominant 7, go up a 4th (or down a 5th), and you've found the tonic.

The two maj7 chords are the other clue. I and IV are both maj7, and the IV is a 4th above the I. If a song has Cmaj7 and Fmaj7 but no B♭, it's in C.

Compare the two rows: C major and G major have the same pattern of qualities and numerals, just different letters. Every major key does.

Try it now: play the seven 7th chords of C in order (Cmaj7 Dm7 Em7 Fmaj7 G7 Am7 Bm7♭5), naming numerals as you go. Then play ii7–V7–Imaj7 in C and in G: Dm7 G7 Cmaj7, Am7 D7 Gmaj7. That three-chord move is the most important progression in jazz and a staple of R&B and Mandopop ballads.

Common mistake: adding a ♭7 to every chord because "7 chords sound bluesy". In a key, only V gets a dominant 7. A dominant 7 anywhere else is a borrowed or secondary chord, which is Part 6.`);
    const rowsDef = [['C', CONTENT_TOP], ['G', CONTENT_TOP + 1.65]];
    for (const [k, y] of rowsDef) {
      I.heading(s, `${k} major`, M, y, 3);
      const cs = T.diatonicChords(k, 'major', 4);
      const gap = 0.2; const tw = (FULL_W - gap * 6) / 7;
      cs.forEach((c, i) => I.tile(s, { x: M + i * (tw + gap), y: y + 0.36, w: tw, h: 1.0, top: c.name, bottom: c.numeral, role: c.suffix === '7' ? 'root' : undefined, outline: c.suffix === '7' ? 'root' : undefined, topSize: 17 }));
    }
    const cy = 5.0; const cw = (FULL_W - 0.6) / 3;
    D.card(s, { x: M, y: cy, w: cw, h: 1.85, title: 'The pattern', body: '**maj7 m7 m7 maj7 7 m7 ø7**, in every major key.', fontSize: 14, titleSize: 16 });
    D.card(s, { x: M + cw + 0.3, y: cy, w: cw, h: 1.85, title: 'One dominant 7', body: 'Only **V7** has a major 3rd and a ♭7. It holds the tritone: **B–F** in C.', fontSize: 14, titleSize: 16 });
    D.card(s, { x: M + 2 * (cw + 0.3), y: cy, w: cw, h: 1.85, title: 'Find the key fast', body: 'Spot the dominant 7, go **up a 4th**: E7 → **A**. Bm7 E7 Amaj7 is in A.', fontSize: 14, titleSize: 16 });
    if (majorKeyOf(['Bm7', 'E7', 'Amaj7']) !== 'A') throw new Error('key example');
  }

  // 38 · The diatonic 7ths on the neck
  {
    const s = slide('The diatonic 7ths on the neck', `Here are all seven diatonic 7th chords of D major as drop 2 voicings on the top four strings, climbing the neck from the open position to the 12th fret. Each shape has the same voice order, root, 5th, 7th and 3rd from low to high, so the only thing that changes from chord to chord is the quality.

How to read the ladder:
• Every chord's root is on the D string, so the roots spell the D major scale: D E F♯ G A B C♯ D.
• Each voice also walks up the scale. On every string, each chord's note is the next scale note above the previous chord's note. That's a harmonized scale: four melodies moving in parallel.
• The colors show the quality changing: watch the amber 3rd and purple 7th shift between major and minor positions.

Why D? On these four strings, D major starts with the open D string, so the whole ladder fits between the nut and the 14th fret.

Use it three ways:
1. As a scale of chords: play up and down, naming each chord and numeral. This connects the neck to the key.
2. As a map of any progression in D. ii–V–I is Em7 (fret 2), A7 (fret 7), Dmaj7 (open or fret 12). You can also play those chords in different inversions near one position, which is the next step after this ladder.
3. As a template for every key. Move the whole ladder up 5 frets and you're in G; up 7 and you're in A.

Try it now: play the ladder up and back down with a metronome at 60, one chord per beat, saying the numeral. Then play I–vi–ii–V (Dmaj7 Bm7 Em7 A7) using only these shapes.

Common mistake: letting the 5th and 6th strings ring. These voicings live on strings 4 to 1 only.`);
    const ladder = [
      ['Dmaj7', 'xx0222', 0, 3], ['Em7', 'xx2433', 1, 4], ['F♯m7', 'xx4655', 3, 6], ['Gmaj7', 'xx5777', 4, 7],
      ['A7', 'xx7989', 6, 9], ['Bm7', 'x.x.9.11.10.10', 8, 11], ['C♯m7♭5', 'x.x.11.12.12.12', 10, 13], ['Dmaj7', 'x.x.12.14.14.14', 11, 14],
    ];
    const cs = T.diatonicChords('D', 'major', 4);
    const gap = 0.3; const bw = (FULL_W - gap * 3) / 4;
    ladder.forEach(([name, fing, from, to], i) => {
      const c = cs[i % 7];
      if (c.name !== name) throw new Error(`Ladder ${i}: expected ${c.name}, got ${name}`);
      const row = Math.floor(i / 4); const col = i % 4;
      I.chordBoard(s, { x: M + col * (bw + gap), y: CONTENT_TOP + row * 2.62, w: bw, h: 1.12, name, sub: i === 7 ? 'I (octave)' : c.numeral, root: c.root, fing, from, to, nameSize: 16 });
    });
  }

  // 39 · Harmony in minor
  {
    const s = slide('Harmony in minor', `Harmonize the natural minor scale the same way and you get the same seven chords as its relative major, starting from a different place. A minor has exactly the chords of C major, but A minor is now home: i ii° ♭III iv v ♭VI ♭VII.

The problem: the v chord is minor (Em in A minor). A minor v has no leading tone. G is a whole step below A, so nothing pulls hard toward home. Classical composers fixed this by raising the 7th degree a half step: G becomes G♯. That's the harmonic minor scale from Part 2. Harmonize it and the v becomes a major V (E), the V7 becomes E7, and vii° becomes G♯°7, a fully diminished 7th. Those are the outlined tiles in the second row.

Rock and metal mostly ignore the fix. They live on the natural-minor chords, especially ♭VI and ♭VII, which give that heavy, modal sound:
• i–♭VI–♭VII (Em C D): the most common minor rock and metal progression. ♭VII going back to i is a strong cadence with no leading tone at all.
• i–♭VII–♭VI–V (Am G F E): the Andalusian cadence, a stepwise descent from flamenco. Its last chord borrows the major V from harmonic minor, and the G♯ in that E chord drags the ear back to A.
• i–iv–v (Am Dm Em): darker and moodier than the major-V version. Swap in E or E7 for a more classical pull.

Numerals in minor are written relative to the major scale, so the chord on the lowered 3rd degree is ♭III. That keeps numerals consistent between major and minor.

Try it now: play Em–C–D with power chords, then with full chords. Then play Am–G–F–E and hold the E: feel how much it wants Am.

Common mistake: always reaching for the major V in minor rock. The minor v and the ♭VII are part of the sound.`);
    const nat = T.diatonicChords('A', 'minor', 3);
    const harm = T.diatonicChords('A', 'harmonicMinor', 3);
    const gap = 0.2; const tw = (FULL_W - gap * 6) / 7;
    I.heading(s, 'A natural minor: the chords of C major, starting on A', M, CONTENT_TOP, FULL_W);
    nat.forEach((c, i) => I.tile(s, { x: M + i * (tw + gap), y: CONTENT_TOP + 0.36, w: tw, h: 0.92, top: c.name, bottom: c.numeral, topSize: 17 }));
    I.heading(s, 'A harmonic minor: raise G to G♯ and three chords change', M, 2.95, FULL_W);
    harm.forEach((c, i) => {
      const changed = c.name !== nat[i].name;
      I.tile(s, { x: M + i * (tw + gap), y: 3.31, w: tw, h: 0.92, top: c.name, bottom: c.numeral, role: changed ? 'blue' : undefined, outline: changed ? 'blue' : undefined, topSize: 17 });
    });
    if (T.diatonicChords('A', 'harmonicMinor', 4)[4].name !== 'E7') throw new Error('harmonic minor V7');
    const progs = [
      { head: 'i–♭VI–♭VII in E', key: 'E', chords: ['Em', 'C', 'D'] },
      { head: 'Andalusian: i–♭VII–♭VI–V in A', key: 'A', chords: ['Am', 'G', 'F', 'E'] },
      { head: 'i–iv–v in A', key: 'A', chords: ['Am', 'Dm', 'Em'] },
    ];
    const pgap = 0.35; const pw = (FULL_W - pgap * 2) / 3;
    progs.forEach((p, i) => {
      const x = M + i * (pw + pgap);
      I.heading(s, p.head, x, 4.55, pw, { size: 14 });
      I.progression(s, { x, y: 4.92, w: pw, h: 1.0, gap: 0.22, topSize: 17, chords: p.chords.map((c) => ({ name: c, numeral: numeralIn(p.key, 'minor', c) })) });
    });
    D.text(s, 'Rock and metal live on **♭VI** and **♭VII**. The Andalusian ending borrows harmonic minor’s major **V** for its pull home.', { x: M, y: 6.15, w: FULL_W, h: 0.6, fontSize: 14, color: HEX.muted });
  }

  // 40 · Harmonized lines: 3rds and 6ths
  {
    const s = slide('Harmonized lines: 3rds and 6ths', `Harmonizing a melody means adding a second line that moves with it, a fixed scale distance away. The two most useful distances on guitar are 3rds and 6ths. Both stay inside the key, so each pair is sometimes major and sometimes minor, whatever the scale provides.

3rds on the G and B strings (top board). Those two strings are a major 3rd apart, so:
• Same fret = major 3rd.
• B-string note one fret lower = minor 3rd.
Walk up A major and the pairs go major, minor, minor, major, major, minor, minor: the 3rds inside the scale. Sweet and close, the sound of twin-guitar harmony leads.

6ths on the G and high e strings, skipping the B string (bottom board). Those two strings are a major 6th apart, so:
• Same fret = major 6th.
• e-string note one fret lower = minor 6th.
The skipped string gives 6ths a wider, more open sound. Pluck the two notes with pick and middle finger, or with fingers, and let the B string stay silent. It's the double-stop sound of soul, Southern rock and many ballad intros.

A 6th is an upside-down 3rd (Part 1's rule of 9): A up to F♯ is a major 6th, F♯ up to A is a minor 3rd. So the 6ths board is the 3rds board with the voices swapped by an octave.

Try it now: play both boards up and down, one pair per beat at 70 bpm. Then over an A drone, improvise short phrases using only these pairs. Add a slide into each pair from one fret below; that's the classic soul move.

Common mistake: keeping one shape for every pair (always the same fret). That's parallel harmony and it leaves the key. Let the scale decide: some pairs are same-fret, some are offset.`);
    const key = 'A';
    const deg = (s2, f) => T.INTERVAL[T.semis(key, T.pcAt(s2, f))];
    const thirds = [[2, 2], [4, 3], [6, 5], [7, 7], [9, 9], [11, 10], [13, 12], [14, 14]]; // [G-string fret, B-string fret]
    const sixths = [[2, 2], [4, 4], [6, 5], [7, 7], [9, 9], [11, 10], [13, 12], [14, 14]]; // [G-string fret, e-string fret]
    const majorSet = new Set(T.pcsOf(key, T.SCALES.major));
    const mk = (pairs, upper) => {
      const dots = []; const links = [];
      for (const [g, u] of pairs) {
        for (const [st, f] of [[3, g], [upper, u]]) {
          if (!majorSet.has(T.pcAt(st, f))) throw new Error(`Not in A major: string ${st} fret ${f}`);
          dots.push({ s: st, f, label: deg(st, f), role: T.role(T.semis(key, T.pcAt(st, f))) });
        }
        links.push({ a: { s: 3, f: g }, b: { s: upper, f: u }, color: HEX.pearl, width: 2 });
      }
      return { dots, links };
    };
    // check interval sizes stay diatonic thirds / sixths
    thirds.forEach(([g, b]) => { const n = T.intervalName(T.spellIn(key, T.pcAt(3, g)), T.spellIn(key, T.pcAt(2, b))); if (!['M3', 'm3'].includes(n)) throw new Error(`3rd pair ${g}/${b} is ${n}`); });
    sixths.forEach(([g, e]) => { const n = T.intervalName(T.spellIn(key, T.pcAt(3, g)), T.spellIn(key, T.pcAt(1, e))); if (!['M6', 'm6'].includes(n)) throw new Error(`6th pair ${g}/${e} is ${n}`); });
    const t3 = mk(thirds, 2); const t6 = mk(sixths, 1);
    I.heading(s, '3rds in A major on the G and B strings: same fret = major, B one fret back = minor', M, CONTENT_TOP, FULL_W, { size: 14 });
    D.fretboard(s, { x: M, y: CONTENT_TOP + 0.42, w: FULL_W, h: 1.65, from: 1, to: 14, root: key, dots: t3.dots, links: t3.links, title: '3rds in A', dotSize: 0.3 });
    I.heading(s, '6ths in A major on the G and e strings: same fret = major, e one fret back = minor', M, 4.1, FULL_W, { size: 14 });
    D.fretboard(s, { x: M, y: 4.52, w: FULL_W, h: 1.65, from: 1, to: 14, root: key, dots: t6.dots, links: t6.links, title: '6ths in A', dotSize: 0.3 });
    D.legend(s, { x: M, y: 6.6, roles: ['root', 'third', 'fifth', 'seventh', 'other'], names: { other: 'Other scale notes' } });
  }

  // 41 · Exercises on paper
  {
    const qA = [['ii', 'E♭', 3], ['V7', 'A', 4], ['vi', 'F', 3], ['vii°', 'G', 3], ['iii7', 'D', 4], ['IVmaj7', 'B♭', 4], ['viiø7', 'E', 4], ['ii7', 'A♭', 4]];
    const itemsA = qA.map(([num, key, size]) => {
      const c = T.diatonicChords(key, 'major', size).find((x) => x.numeral === num);
      if (!c) throw new Error(`No ${num} in ${key}`);
      return [`${num} in ${key} major`, c.name];
    });
    const qB = [['Em7', 'A7', 'Dmaj7'], ['B♭maj7', 'Gm7', 'C7'], ['C♯m', 'F♯m', 'B7'], ['Dm7', 'G7', 'Em7'], ['A♭', 'Fm', 'E♭7']];
    const itemsB = qB.map((cs) => [cs.join(' · '), `${majorKeyOf(cs)} major`]);
    const qC = [['G', 'major', ['Am7', 'D7', 'Gmaj7']], ['D', 'major', ['Bm', 'G', 'A', 'D']], ['E', 'major', ['C♯m', 'A', 'E', 'B']], ['A', 'minor', ['Am', 'F', 'C', 'G']], ['E', 'minor', ['Em', 'D', 'C', 'B7']]];
    const itemsC = qC.map(([key, mode, cs]) => [`In ${key} ${mode}: ${cs.join(' – ')}`, cs.map((c) => numeralIn(key, mode, c)).join(' – ')]);
    const qD = [['♭VI', 'E', 'minor', 3], ['V7', 'D', 'harmonicMinor', 4], ['iv', 'B', 'minor', 3], ['♭VII', 'A', 'minor', 3], ['vii°7', 'C', 'harmonicMinor', 4], ['ii°', 'F♯', 'minor', 3]];
    const itemsD = qD.map(([num, key, kind, size]) => {
      const c = T.diatonicChords(key, kind, size).find((x) => x.numeral === num);
      if (!c) throw new Error(`No ${num} in ${key} ${kind}`);
      return [`${num} in ${key} ${kind === 'harmonicMinor' ? 'harmonic minor' : 'minor'}`, c.name];
    });
    I.worksheet(pres, {
      part: 4, kicker: K,
      notes: `Four groups, 24 questions. No guitar for the first pass; then play every answer to hear it.

Group A: name the chord. Count up the major scale of the key to the degree, then use the quality pattern (maj min min maj maj min dim, or maj7 m7 m7 maj7 7 m7 ø7 for 7ths). Spell the root correctly: the vii° of G is F♯°, not G♭°.

Group B: find the major key. Look for the dominant 7 first; the key is a 4th above it. If there's no dominant 7, find the major chords: in a major key they're I, IV and V, and IV and V are a whole step apart. A♭, Fm and E♭7 has a dominant (E♭7), so the key is A♭.

Group C: Roman numerals. Write the numeral under each chord. Upper case for major, lower case for minor, the right suffix for 7ths. In minor keys, use ♭III, ♭VI and ♭VII for the chords on the lowered degrees, and note when a chord comes from harmonic minor (B7 in E minor is V7).

Group D: minor-key chords. Build the natural minor scale on the tonic, or find the relative major and start from its 6th degree. For harmonic minor, raise the 7th degree first.

Scoring: at most one miss per group. Group B is the most practical skill here. If it's shaky, do ten more by picking chords from songs you know and checking with the guitar.`,
      groups: [
        { key: 'A', title: 'Name the chord', instr: 'Degree and key given. Write the chord symbol.', weight: 0.95, items: itemsA },
        { key: 'B', title: 'Find the major key', instr: 'All chords come from one major key.', weight: 0.95, items: itemsB },
        { key: 'C', title: 'Write the Roman numerals', weight: 1.1, items: itemsC },
        { key: 'D', title: 'Minor-key chords', instr: 'Natural minor unless marked harmonic.', weight: 1.1, items: itemsD },
      ],
    });
  }

  // 42 · Exercises on the neck
  D.practice(pres, {
    kicker: K,
    title: 'Exercises on the neck',
    intro: 'Say the numeral, not just the chord name. Numerals are what transfer between keys.',
    drills: [
      { name: 'Triad ladder', how: 'Play I ii iii IV V vi vii° in C, G, D, A and E, as open, barre or top-string triads, naming each numeral aloud.', tempo: '60 bpm, 1 chord per 2 beats', time: '5 min', done: 'Two keys in a row with no hesitation' },
      { name: 'Drop 2 ladder', how: 'The D major 7th ladder up and down. Then shift it up 5 frets for G and 7 frets for A, naming each chord.', tempo: '60 bpm, 1 chord per beat', time: '5 min', done: 'Three keys, up and down, clean' },
      { name: 'Minor vocabulary', how: 'Loop Em–C–D, Am–G–F–E and Am–Dm–Em with a drum loop. Improvise over each in natural minor; hit G♯ only over the E chord.', tempo: '90 bpm', time: '6 min', done: 'You land the G♯ on the E chord every time' },
      { name: '3rds and 6ths', how: 'Both A major boards, up and down. Then improvise over an A drone with only those pairs, sliding into each from a fret below.', tempo: '70 bpm, 1 pair per beat', time: '4 min', done: '1 minute of phrases, no out-of-key pair' },
    ],
    notes: `Four drills, about 20 minutes. They make the key's chord family something your hands know, not just a table.

1. Triad ladder. The seven triads of a key in order, in any voicing you like. Saying the numerals out loud is the point. After a week you should hear "four" and know it's C in G major, A in E major and so on, without counting.

2. Drop 2 ladder. The D major ladder from this part. When it's smooth, move it: everything up 5 frets is G major (starting from Gmaj7 at fret 5), up 7 frets is A major. Then try a ii–V–I in each key using only ladder shapes: Em7 A7 Dmaj7, Am7 D7 Gmaj7, Bm7 E7 Amaj7.

3. Minor vocabulary. Three progressions with a drum loop or looper. Solo over each with the natural minor scale. Over the E chord in the Andalusian progression, switch the G to G♯, which means harmonic minor for that one chord. This is how metal and neoclassical players use harmonic minor: as a color for the V chord, not as a scale for the whole song.

4. 3rds and 6ths. Both boards ascending and descending, then free improvisation over a drone. Rule: you may only play pairs from the boards, so every note is harmonized. Add slides and hammer-ons into the pairs once the shapes are comfortable.

Record a minute of drill 4 each week and listen back: the harmonized sound should become smoother and more melodic, not just correct.`,
  });
}

module.exports = { build };
