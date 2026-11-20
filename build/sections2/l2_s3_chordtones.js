// Level 2 · Part 3 · Chord tones everywhere (slides 29–42)
const T = require('../lib/theory');
const D = require('../lib/draw');
const { HEX, M, CONTENT_TOP, section } = require('../lib/deck');

const KICK = '3 · Chord tones everywhere';
const FULL_W = 12.13;
const SETS = {
  GBe: { strings: [3, 2, 1], name: 'G-B-e', nums: 'strings 3-2-1' },
  DGB: { strings: [4, 3, 2], name: 'D-G-B', nums: 'strings 4-3-2' },
  ADG: { strings: [5, 4, 3], name: 'A-D-G', nums: 'strings 5-4-3' },
  EAD: { strings: [6, 5, 4], name: 'E-A-D', nums: 'strings 6-5-4' },
};
const INV_SHORT = { 'Root position': 'Root pos.', '1st inversion': '1st inv.', '2nd inversion': '2nd inv.' };

// ---------- local helpers ----------
function heading(s, txt, x, y, w, size = 15) {
  s.addText(D.runs(txt, { color: HEX.pearl, fontSize: size, bold: true }), { x, y, w, h: 0.32, margin: 0, valign: 'middle', isTextBox: true });
}
function caption(s, txt, x, y, w, h = 0.3, size = 12) {
  s.addText(D.runs(txt, { color: HEX.muted, fontSize: size }), { x, y, w, h, margin: 0, valign: 'top', isTextBox: true });
}

// All closed voicings of a triad on a string set, as dots + region brackets (bumped to row 1 when they would overlap).
function triadBoard(root, quality, set, to = 15) {
  const voicings = T.closedTriads(root, T.CHORDS[quality], set, to);
  const dots = []; const regions = []; const lastTo = [-9, -9];
  for (const v of voicings) {
    dots.push(...D.dotsFor(v.notes, { root, label: 'interval' }));
    const fs = v.notes.map((n) => n.f);
    const from = Math.min(...fs); const tt = Math.max(...fs);
    const row = from > lastTo[0] ? 0 : 1;
    lastTo[row] = tt;
    regions.push({ from, to: tt, label: INV_SHORT[v.inversion], row });
  }
  return { dots, regions, voicings };
}

// Per-column chord check for tabs that change chord bar by bar. Throws on any note outside its chord (+ allowed extras).
function checkBars(bars) {
  for (const b of bars) {
    const allowed = new Set(T.pcsOf(b.root, [...b.ivs, ...(b.extra || [])]));
    for (const col of b.notes) {
      for (const item of col.split(/\s+/)) {
        const [st, tok] = item.split(':');
        for (const n of (tok.match(/\d+/g) || []).map(Number)) {
          if (!allowed.has(T.pcAt(Number(st), n))) throw new Error(`Bar ${b.chord}: ${T.noteName(T.pcAt(Number(st), n))} (string ${st} fret ${n}) is not a chord tone`);
        }
      }
    }
  }
}

// Tab whose bars each belong to a chord: checks every bar against its chord, prints chord names over the bars.
function chordTab(s, { x, y, w, bars, gap = 0.22, fontSize = 13 }) {
  checkBars(bars);
  const cols = [];
  const firstCol = [];
  bars.forEach((b, i) => {
    if (i > 0) cols.push('|');
    firstCol.push(cols.length);
    cols.push(...b.notes);
  });
  const union = new Set();
  for (const b of bars) for (const p of T.pcsOf(b.root, [...b.ivs, ...(b.extra || [])])) union.add(T.semis('A', p));
  const colW = (w - 0.3 - 0.15) / cols.length;
  bars.forEach((b, i) => {
    const cx = x + 0.3 + 0.08 + firstCol[i] * colW;
    s.addText(b.chord, { x: cx, y: y - 0.42, w: Math.max(0.8, colW * 2), h: 0.26, fontSize: 13, bold: true, color: HEX.pearl, margin: 0, valign: 'bottom', isTextBox: true });
  });
  return D.tab(s, { x, y, w, gap, cols, fontSize, check: { root: 'A', scale: [...union] } });
}

const A7 = { root: 'A', ivs: T.CHORDS.dom7, chord: 'A7' };
const D7 = { root: 'D', ivs: T.CHORDS.dom7, chord: 'D7' };
const E7 = { root: 'E', ivs: T.CHORDS.dom7, chord: 'E7' };

function build(pres) {
  section(pres, 'Chord tones everywhere');

  // 29 · Divider
  D.divider(pres, {
    num: 3,
    title: 'Chord tones everywhere',
    subtitle: 'Scales tell you which notes are safe. Chord tones tell you which notes matter. This part puts them all over the neck.',
    outcomes: [
      'Play major and minor triads on all 4 string sets',
      'Move through I–IV–V with the closest voicings',
      'Play 7th-chord arpeggios in 5 positions',
      'Comp and solo with guide tones (3rds and 7ths)',
      'Approach and enclose any target note',
    ],
    notes: `Part 3 is the bridge between "I know the scale" and "my solos follow the chords".

In Level 1 you met target notes: land a chord tone on a strong beat and the phrase sounds intentional. The limit was that you could only find chord tones inside pentatonic box 1, or in the top-string triads. This part removes that limit.

What's coming:
• Triads on every set of three adjacent strings, not just G-B-e. Each set gives you three more inversions of every chord, so any chord lives in a dozen places.
• Voice leading: moving from chord to chord by the smallest possible steps. That's how good rhythm players make I–IV–V sound smooth instead of jumpy.
• 7th-chord arpeggios (dominant 7, minor 7, maj7, m7♭5) in positions across the neck, plus the strange and useful diminished 7.
• Guide tones: the 3rd and 7th of each chord. They define its sound, and they move by half steps from chord to chord, which makes them gold for comping and soloing.
• Approach notes and enclosures: how to sneak into a target from a half step below, a scale step above, or both. This is what makes lines sound like a real player and not like scale practice.

Work through this part slowly. One string set or one arpeggio position per week is a good pace. Say interval names out loud as you play. That habit, more than speed, is what makes this knowledge usable in a solo.`,
  });

  // 30 · Triads on all 4 string sets
  {
    const s = D.slideOf(pres, {
      kicker: KICK, title: 'Triads on all 4 string sets',
      notes: `One chord, everywhere. Each board shows every closed A major triad (A, C♯, E) on one set of three adjacent strings, from the open position to fret 15.

A triad has three notes, so on three adjacent strings it has three possible orders, called inversions:
• Root position: root on the bottom (R-3-5).
• 1st inversion: the 3rd on the bottom (3-5-R).
• 2nd inversion: the 5th on the bottom (5-R-3).

Each string set repeats the cycle root → 1st → 2nd → root as you move up the neck, and the cycle restarts 12 frets higher. Count them: four string sets with three or four voicings each gives you more than a dozen places to play a plain A major chord, without a single barre chord.

Why it matters:
• Rhythm: small three-note shapes cut through a band without clashing with the bass or keys. Choose the set and register that fits the song.
• Lead: every triad is a target zone. Wherever your hand is, a triad shape is underneath it, so you always know where the chord tones are.
• Fretboard freedom: triads connect CAGED, the pentatonic boxes and the arpeggio positions. They are the smallest shapes that still say "this is the chord".

Notice the G-B-e and D-G-B sets look different from the two lower sets. That's the G–B shift again: any shape that crosses onto the B string moves up one fret.

Next three slides: each lower string set in detail, major and minor.`,
    });
    const cellW = (FULL_W - 0.3) / 2;
    const order = [['GBe', 0, 0], ['DGB', 1, 0], ['ADG', 0, 1], ['EAD', 1, 1]];
    for (const [key, cx, cy] of order) {
      const set = SETS[key];
      const x = M + cx * (cellW + 0.3); const y = CONTENT_TOP + 0.05 + cy * 2.45;
      heading(s, `${set.name} · ${set.nums}`, x, y, cellW, 14);
      const { dots } = triadBoard('A', 'maj', set.strings);
      D.fretboard(s, { x, y: y + 0.42, w: cellW, h: 1.62, from: 0, to: 15, root: 'A', dots, fretNumbers: 'inlays', title: `Triads ${set.name}` });
    }
    caption(s, 'Every closed A major triad (R · 3 · 5 = A · C♯ · E) on each string set. Red = root, amber = 3rd, blue = 5th.', M, 6.55, FULL_W, 0.3, 12);
  }

  // 31–33 · One slide per lower string set
  const setSlides = [
    {
      key: 'DGB', title: 'Triads on D-G-B',
      tip: '**Tip:** the B string is on top, so the highest note sits one fret higher than you expect. Look for the 2nd-inversion shape: a straight line across one fret.',
      notes: `The D-G-B set (strings 4-3-2) sits right in the middle of the neck's range, the classic register for funk and rock comping.

Read the top board left to right. The A major voicings are:
• 2nd inversion at fret 2 (E-A-C♯): a flat three-string barre, like the top of an open A chord.
• Root position at frets 5–7 (A-C♯-E).
• 1st inversion at frets 9–11 (C♯-E-A).
• 2nd inversion again at fret 14, the same shape as fret 2, 12 frets higher.

The minor board is the same idea with the 3rd lowered one fret: find the amber dot in each major voicing and move it down a fret. That's the minor triad. This is the single most useful fact about triads: the only difference between major and minor is the 3rd.

How to practice:
1. Play the major voicings up the neck, then back down, saying "second, root, first, second".
2. Play each major voicing, then lower the 3rd to make it minor. Hear the mood change.
3. Pick one voicing and find the nearest voicing of D and E (the IV and V in A). You'll do that formally on the voice-leading slide.

Common mistake: letting the shapes ring into each other. Mute each voicing as you leave it. Lift your fretting fingers slightly, or rest your picking hand on the strings.`,
    },
    {
      key: 'ADG', title: 'Triads on A-D-G',
      tip: '**Tip:** no B string involved, so these shapes keep the same intervals as the E-A-D set, just one string higher.',
      notes: `The A-D-G set (strings 5-4-3) is a warmer, lower register, great for chunky rock comping and for blues rhythm under a singer.

A major on this set:
• 1st inversion around frets 2–4 (C♯-E-A).
• 2nd inversion around frets 6–7 (E-A-C♯).
• Root position around frets 9–12 (A-C♯-E).

A minor: the same voicings with the 3rd moved down one fret. There's also a 1st inversion at frets 14–15, which is the same shape as frets 2–3.

The useful observation: the A, D and G strings are each tuned a 4th apart, with no B string in the way, so these shapes are exactly the E-A-D shapes moved over one string. Learn one set and you already have the other. Only the note names change, a 4th higher.

How to practice:
1. Play the three major voicings in order up the neck. Say the inversion name and the note on top.
2. Play the root-position shape, then slide it to D and to E (the IV and V) to hear a I–IV–V with one shape.
3. Over a slow A backing track, strum one voicing per bar, moving to a different inversion each bar.

Watch your thumb: these shapes are low enough that a thumb hanging over the neck can mute the low E by accident. That's often helpful in a band, but check you aren't also killing the A string.`,
    },
    {
      key: 'EAD', title: 'Triads on E-A-D',
      tip: '**Tip:** same shapes as A-D-G, one string lower. The root-position shape shares its low A with the E-shape barre chord at fret 5.',
      notes: `The E-A-D set (strings 6-5-4) is the lowest triad set. These voicings can sound muddy with heavy distortion, but clean or lightly overdriven they are big and dark. They are also the foundation shapes inside power chords and barre chords.

A major on this set:
• Root position at frets 2–5 (A on the low E, C♯ on the A string, E on the D string). It shares its low A with the E-shape A barre chord at fret 5.
• 1st inversion at frets 7–9 (C♯-E-A).
• 2nd inversion at frets 11–12 (E-A-C♯).

The minor board shows the same shapes with the 3rd lowered.

Why bother with low triads when you have power chords? Because a power chord has no 3rd. It can't say major or minor. When a riff needs to be clearly major or clearly minor, a low triad does it while keeping the weight of the low strings. Try A5 (5-7-7 on E-A-D), then the A major triad, then A minor, and listen to how the 3rd changes the colour.

How to practice: walk the inversions up and down, then play the major/minor pair at each position. Keep the gain low so you can hear all three notes clearly.

Remember the cycle on every string set: root position → 1st inversion → 2nd inversion → root position, 12 frets later.`,
    },
  ];
  for (const ss of setSlides) {
    const set = SETS[ss.key];
    const s = D.slideOf(pres, { kicker: KICK, title: ss.title, notes: ss.notes });
    const bx = 2.7; const bw = 12.73 - bx;
    [['maj', 'A major', 'A · C♯ · E', 'R · 3 · 5'], ['min', 'A minor', 'A · C · E', 'R · ♭3 · 5']].forEach(([q, name, notes, form], i) => {
      const y = 2.0 + i * 2.45;
      const { dots, regions } = triadBoard('A', q, set.strings);
      D.fretboard(s, { x: bx, y, w: bw, h: 1.7, from: 0, to: 15, root: 'A', dots, regions, title: `${ss.title} ${name}`, fretNumbers: 'all' });
      s.addText(name, { x: M, y: y + 0.05, w: 1.9, h: 0.36, fontSize: 18, bold: true, color: HEX.white, margin: 0, isTextBox: true });
      s.addText(notes, { x: M, y: y + 0.45, w: 1.9, h: 0.3, fontSize: 14, color: HEX.text, margin: 0, isTextBox: true });
      s.addText(D.runs(q === 'maj' ? '{root:R} · {third:3} · {fifth:5}' : '{root:R} · {third:♭3} · {fifth:5}', { fontSize: 14 }), { x: M, y: y + 0.78, w: 1.9, h: 0.3, margin: 0, isTextBox: true });
      void form;
    });
    s.addText(D.runs(ss.tip, { color: HEX.text, fontSize: 14 }), { x: M, y: 6.48, w: FULL_W, h: 0.36, margin: 0, valign: 'top', isTextBox: true });
  }

  // 34 · Voice leading I–IV–V
  {
    const s = D.slideOf(pres, {
      kicker: KICK, title: 'Voice leading: I–IV–V the smooth way',
      notes: `Voice leading means moving each note of a chord to the nearest note of the next chord. The result sounds like three melodies moving together instead of a hand jumping around the neck.

The example is I–IV–V–I in A (A–D–E–A), all on the D-G-B strings around frets 4–7:
• A, root position (7-6-5): A on top of the D string, C♯ on G, E on B.
• D, 2nd inversion (7-7-7): the A stays where it is (a common tone). C♯ moves up a half step to D, E moves up a whole step to F♯.
• E, 1st inversion (6-4-5): every note moves by a small step. A→G♯, D→B, F♯→E.
• Back to A (7-6-5): G♯ rises to A, B rises to C♯, and E stays put.

The rules:
1. Keep common tones. If the next chord shares a note, hold it on the same string.
2. Move the other notes by the smallest step available, a half or whole step if possible.
3. Choose the inversion that makes rules 1 and 2 work. That's what inversions are for.

Compare this with strumming open A, open D, open E: the hand jumps, and the top note leaps around. Voice-led triads sound like a keyboard player or a session guitarist.

Practice: play the tab slowly with a metronome, two strums per chord. Then find the same progression voice-led on G-B-e (start from the A at 9-10-9) and on A-D-G. Finally, try it in E (E–A–B) and D (D–G–A).`,
    });
    const chords = [
      { name: 'A', num: 'I', inv: 'root position', root: 'A', q: 'maj', frets: [7, 6, 5] },
      { name: 'D', num: 'IV', inv: '2nd inversion', root: 'D', q: 'maj', frets: [7, 7, 7] },
      { name: 'E', num: 'V', inv: '1st inversion', root: 'E', q: 'maj', frets: [6, 4, 5] },
    ];
    const bw = 3.5; const gap = (FULL_W - bw * 3) / 2;
    chords.forEach((c, i) => {
      const x = M + i * (bw + gap);
      s.addText([{ text: `${c.num}  `, options: { color: HEX.pearl, bold: true, fontSize: 16 } }, { text: c.name, options: { color: HEX.white, bold: true, fontSize: 18 } }, { text: `  ${c.inv}`, options: { color: HEX.muted, fontSize: 13 } }], { x, y: CONTENT_TOP, w: bw, h: 0.36, margin: 0, valign: 'middle', isTextBox: true });
      const notes = [4, 3, 2].map((st, k) => ({ s: st, f: c.frets[k] }));
      D.fretboard(s, { x, y: CONTENT_TOP + 0.5, w: bw, h: 1.6, from: 3, to: 8, root: c.root, dots: D.dotsFor(notes, { root: c.root, label: 'note' }), title: `VL ${c.name}` });
      if (i < 2) s.addText('→', { x: x + bw + gap / 2 - 0.2, y: CONTENT_TOP + 1.05, w: 0.4, h: 0.4, fontSize: 22, bold: true, color: HEX.pearl, align: 'center', margin: 0, isTextBox: true });
      // verify the voicing really is this chord
      for (const n of notes) if (!T.pcsOf(c.root, T.CHORDS[c.q]).includes(T.pcAt(n.s, n.f))) throw new Error(`Voice-leading ${c.name} has a non-chord tone`);
    });
    heading(s, 'Comp it: A – D – E – A, two strums per chord', M, 4.25, 7.2, 14);
    chordTab(s, {
      x: M, y: 5.05, w: 7.2, gap: 0.22,
      bars: [
        { chord: 'A', root: 'A', ivs: T.CHORDS.maj, notes: ['4:7 3:6 2:5', '4:7 3:6 2:5'] },
        { chord: 'D', root: 'D', ivs: T.CHORDS.maj, notes: ['4:7 3:7 2:7', '4:7 3:7 2:7'] },
        { chord: 'E', root: 'E', ivs: T.CHORDS.maj, notes: ['4:6 3:4 2:5', '4:6 3:4 2:5'] },
        { chord: 'A', root: 'A', ivs: T.CHORDS.maj, notes: ['4:7 3:6 2:5', '4:7 3:6 2:5'] },
      ],
    });
    D.card(s, {
      x: 8.2, y: 4.25, w: 4.53, h: 2.55, title: 'The three rules',
      bullets: ['**Hold** common tones on the same string', '**Step** every other note to the nearest chord tone', '**Choose** the inversion that makes it work'],
      fontSize: 15, paraSpace: 8,
    });
  }

  // 35 · Dominant 7 arpeggios, 5 positions
  const WINDOWS = [
    { from: 0, to: 3, board: [0, 4], shape: 'A shape · open' },
    { from: 2, to: 5, board: [1, 6], shape: 'G shape · frets 2–5' },
    { from: 4, to: 8, board: [3, 9], shape: 'E shape · frets 4–8' },
    { from: 7, to: 10, board: [6, 11], shape: 'D shape · frets 7–10' },
    { from: 9, to: 12, board: [8, 13], shape: 'C shape · frets 9–12' },
  ];
  {
    const s = D.slideOf(pres, {
      kicker: KICK, title: 'Dominant 7 arpeggios: 5 positions in A',
      notes: `A7 (A, C♯, E, G) is the I chord of every blues in A, so its arpeggio is the most useful one you can own. These five boards show every A7 chord tone inside the five CAGED zones, from the open position up to fret 12. After fret 12 the whole pattern repeats.

The zones I've used (each about a four-fret hand position):
• A shape: open position, frets 0–3.
• G shape: frets 2–5.
• E shape: frets 4–8. This one sits right over pentatonic box 1, so start here.
• D shape: frets 7–10.
• C shape: frets 9–12.

Colours as always: red root, amber 3rd (C♯), blue 5th (E), purple ♭7 (G).

How to learn each position:
1. Find the red roots first. They anchor the shape.
2. Play the arpeggio from the lowest root up to the highest note in the zone and back down, one note per click at 60 bpm, saying the interval names.
3. Then play it from the lowest note in the zone, whatever it is. Real lines don't always start on the root.
4. Finally improvise using only these four notes over an A7 vamp. It sounds surprisingly musical, because every note is "inside" the chord.

Compare with the minor pentatonic in the same zone. The arpeggio has the C♯ (major 3rd) that the minor pentatonic lacks, which is why mixing A7 arpeggio notes into your pentatonic licks instantly makes them sound like they belong to the chord.`,
    });
    const bw = (FULL_W - 0.6) / 3; const bh = 1.65;
    WINDOWS.forEach((wd, i) => {
      const col = i % 3; const row = Math.floor(i / 3);
      const x = M + col * (bw + 0.3); const y = CONTENT_TOP + 0.05 + row * 2.6;
      heading(s, `${i + 1} · ${wd.shape}`, x, y, bw, 14);
      D.fretboard(s, {
        x, y: y + 0.42, w: bw, h: bh, from: wd.board[0], to: wd.board[1], root: 'A',
        dots: D.dotsFor(T.chordTonesIn('A', T.CHORDS.dom7, wd.from, wd.to), { root: 'A', label: 'interval' }), title: `A7 pos ${i + 1}`,
      });
    });
    D.card(s, {
      x: M + 2 * (bw + 0.3), y: CONTENT_TOP + 2.65, w: bw, h: 2.6, title: 'A7 = R · 3 · 5 · ♭7',
      body: ['{root:A} · {third:C♯} · {fifth:E} · {seventh:G}', 'Start in position 3, over pentatonic box 1. Find the roots, then say every interval out loud as you play.'],
      fontSize: 14, paraSpace: 8,
    });
  }

  // 36 · Minor 7 arpeggios (full neck)
  {
    const s = D.slideOf(pres, {
      kicker: KICK, title: 'Minor 7 arpeggios: the whole neck',
      notes: `Am7 (A, C, E, G) across the whole neck, with the same five zones bracketed above the board. Unlike the dominant-7 slide, here you see all the zones at once, so you can watch them overlap and link up.

Am7 is pentatonic box material: A minor pentatonic is A, C, D, E, G, so Am7 is the minor pentatonic with the 4th (D) removed. That makes this arpeggio the fastest way to turn your pentatonic boxes into chord-tone playing. Inside each box, just skip the D.

Things to notice:
• The ♭3 (C, amber) and ♭7 (G, purple) are the notes that make the chord minor 7. Compare with the A7 slide: there the 3rd is C♯.
• The zones overlap by one or two frets, just like the pentatonic boxes. The shared notes are your shifting points.
• From fret 12 upward everything repeats.

How to practice:
1. Play the arpeggio in one zone over an Am7 or Am vamp, one note per beat, saying the intervals.
2. Link two neighbouring zones: go up in one, shift on a shared note, come down in the next.
3. Play a pentatonic lick you already know, then play it again landing on an Am7 chord tone at the end of each phrase. Chord tones on the strong beats, as in Level 1.

When you'll use it: minor blues (the i chord), Dorian vamps (Am7 to D), and minor-key rock where the i chord is Am. In Part 4 you'll meet Am7 as a chord shape too. The arpeggio and the chord share the same notes.`,
    });
    const regions = [
      { from: 0, to: 3, label: 'A shape', row: 0 }, { from: 2, to: 5, label: 'G shape', row: 1 }, { from: 4, to: 8, label: 'E shape', row: 0 },
      { from: 7, to: 10, label: 'D shape', row: 1 }, { from: 9, to: 12, label: 'C shape', row: 0 },
    ];
    D.fretboard(s, {
      x: M, y: 2.45, w: FULL_W, h: 2.45, from: 0, to: 13, root: 'A',
      dots: D.dotsFor(T.chordTonesIn('A', T.CHORDS.min7, 0, 13), { root: 'A', label: 'interval' }), regions, title: 'Am7 full neck',
    });
    D.legend(s, { x: M, y: 5.38, roles: ['root', 'third', 'fifth', 'seventh'], names: { root: 'Root (A)', third: '♭3 (C)', fifth: '5 (E)', seventh: '♭7 (G)' } });
    D.card(s, {
      x: M, y: 5.8, w: FULL_W, h: 1.0,
      body: '**Am7 = A minor pentatonic minus the 4th (D).** Inside every box you already know, skip the D and you are playing the arpeggio.',
      fontSize: 15, pad: 0.22,
    });
  }

  // 37 · Maj7 and m7♭5
  {
    const s = D.slideOf(pres, {
      kicker: KICK, title: 'Maj7 and m7♭5 arpeggios',
      notes: `Two more 7th-chord arpeggios, each shown in two positions: root on the 6th string (top board in each column) and root on the 5th string (bottom board).

Amaj7 (A, C♯, E, G♯) is the I chord of A major with a major 7th, a half step below the root. That purple 7 is what gives maj7 its dreamy, unresolved sound. You'll meet maj7 chords as the I and IV of major keys in ballads, soul and softer rock. It's also the ♭III and ♭VI of minor keys: in A minor, those are Cmaj7 and Fmaj7.

Bm7♭5 (B, D, F, A), also called B half-diminished, is the ii chord of A minor. It's a minor 7th chord with a flattened 5th, shown in teal because the ♭5 is its special note. The minor ii–V–i (Bm7♭5 – E7 – Am) is everywhere in minor-key music, from flamenco-flavoured metal to jazz-rock. In a major key, m7♭5 is the vii chord: in C major, that's Bm7♭5 again.

Notice the shapes:
• The maj7 shapes have the 7 sitting one fret below a root. Find any root, and the major 7th is right there, a fret lower.
• The m7♭5 shapes look like minor 7 shapes with the 5th dropped a fret.

How to practice: play each arpeggio up and down in both positions, then play Am7 → Bm7♭5 → E7 → Am7 as arpeggios, one bar each, staying in the same area of the neck. Hearing how the notes shift between those chords is the start of playing through changes.`,
    });
    const colW = (FULL_W - 0.4) / 2;
    const items = [
      { col: 0, root: 'A', chord: T.CHORDS.maj7, name: 'Amaj7', form: '{root:R} · {third:3} · {fifth:5} · {seventh:7}', notes: 'A · C♯ · E · G♯', pos: [{ w: [4, 8], b: [3, 9], cap: 'Root on 6th string · fret 5' }, { w: [11, 14], b: [10, 15], cap: 'Root on 5th string · fret 12' }] },
      { col: 1, root: 'B', chord: T.CHORDS.m7b5, name: 'Bm7♭5', form: '{root:R} · {third:♭3} · {blue:♭5} · {seventh:♭7}', notes: 'B · D · F · A', pos: [{ w: [6, 10], b: [5, 11], cap: 'Root on 6th string · fret 7' }, { w: [1, 5], b: [0, 6], cap: 'Root on 5th string · fret 2' }] },
    ];
    for (const it of items) {
      const x = M + it.col * (colW + 0.4);
      s.addText([{ text: it.name, options: { bold: true, color: HEX.white, fontSize: 18 } }, { text: `   ${it.notes}`, options: { color: HEX.text, fontSize: 14 } }], { x, y: CONTENT_TOP, w: colW, h: 0.36, margin: 0, valign: 'middle', isTextBox: true });
      s.addText(D.runs(it.form, { fontSize: 14 }), { x, y: CONTENT_TOP + 0.38, w: colW, h: 0.3, margin: 0, isTextBox: true });
      it.pos.forEach((p, k) => {
        const y = CONTENT_TOP + 0.85 + k * 2.3;
        caption(s, p.cap, x, y, colW, 0.28, 12);
        D.fretboard(s, {
          x, y: y + 0.32, w: colW, h: 1.55, from: p.b[0], to: p.b[1], root: it.root,
          dots: D.dotsFor(T.chordTonesIn(it.root, it.chord, p.w[0], p.w[1]), { root: it.root, label: 'interval' }), title: `${it.name} ${k}`,
        });
      });
    }
  }

  // 38 · Diminished 7
  {
    const s = D.slideOf(pres, {
      kicker: KICK, title: 'Diminished 7: one shape, every 3 frets',
      notes: `The diminished 7th chord is built entirely from minor 3rds: A, C, E♭, G♭. Each note is 3 frets above the last, and a fourth minor 3rd brings you back to A. Because the intervals are all equal, the chord is symmetrical: move the shape up 3 frets and you get the same four notes in a different order.

That's what the board shows. The same four-string grip (D-G-B-e, frets 1-2-1-2) appears at frets 1, 4, 7 and 10. All four are the same chord. Its name depends only on which note you treat as the root: E♭°7, G♭°7, A°7 and C°7 are one chord with four names. Some theory books spell G♭ as F♯; it's the same pitch.

Where it shows up:
• As a passing chord. The classic blues move is D7 → D♯°7 in bar 6, which climbs chromatically back to A7 (with E in the bass) in bar 7.
• As a substitute for a dominant 7♭9. G♯°7 (G♯, B, D, F) is E7♭9 without its root, so over an E7 in a minor blues you can play G♯°7 arpeggios for instant tension that resolves to Am.
• In metal and neoclassical playing, the diminished arpeggio is the classic sweep and tapping figure, climbing in minor 3rds.

The tab shows the one-string version: B string frets 1-4-7-10, then the high e at 8 and 11. Every note is a dim7 chord tone, spaced 3 frets apart.

Practice: play the grip at all four positions, then the one-string climb. Then over an E7 → Am change, play G♯°7 over the E7 (the same grip one fret lower, at fret 0, 3, 6 or 9) and resolve to an A minor chord tone.`,
    });
    const dots = []; const regions = [];
    [1, 4, 7, 10].forEach((b) => {
      [4, 3, 2, 1].forEach((st, i) => {
        const f = b + [0, 1, 0, 1][i];
        const p = T.pcAt(st, f);
        const sm = T.semis('A', p);
        const name = { 0: 'A', 3: 'C', 6: 'E♭', 9: 'G♭' }[sm];
        if (!name) throw new Error('dim7 grip produced a non-chord tone');
        dots.push({ s: st, f, label: name, role: { 0: 'root', 3: 'third', 6: 'blue', 9: 'seventh' }[sm], noRoleCheck: true });
      });
      const bassName = { 0: 'A', 3: 'C', 6: 'E♭', 9: 'G♭' }[T.semis('A', T.pcAt(4, b))];
      regions.push({ from: b, to: b + 1, label: `${bassName}°7`, row: 0 });
    });
    D.fretboard(s, { x: M, y: 2.1, w: FULL_W, h: 2.1, from: 0, to: 13, root: 'A', dots, regions, title: 'dim7 grips' });
    D.card(s, {
      x: M, y: 4.75, w: 5.8, h: 2.05, title: 'Same 4 notes, 4 names',
      body: ['{root:A} · {third:C} · {blue:E♭} · {seventh:G♭}: stacked minor 3rds.', 'Slide any dim7 shape **3 frets** and you play the same chord again.'],
      fontSize: 14, paraSpace: 8,
    });
    heading(s, 'One-string climb in minor 3rds', 6.8, 4.75, 5.93, 14);
    D.tab(s, { x: 6.8, y: 5.35, w: 5.93, gap: 0.22, cols: ['2:1', '2:4', '2:7', '2:10', '1:8', '1:11'], check: { root: 'A', scale: [0, 3, 6, 9] } });
  }

  // 39 · Guide tones
  {
    const s = D.slideOf(pres, {
      kicker: KICK, title: 'Guide tones: 3rds and 7ths',
      notes: `Of the four notes in a 7th chord, two do most of the work. The root is usually covered by the bass, and the 5th is neutral (it's the same in major and dominant chords). The 3rd decides major or minor, and the 7th decides the type of 7th chord. Together, the 3rd and 7th are called guide tones, because they guide the ear through the changes.

In a 12-bar in A:
• A7: C♯ (3) and G (♭7).
• D7: F♯ (3) and C (♭7).
• E7: G♯ (3) and D (♭7).

Played on the D and G strings, each pair is the same two-fret-wide tritone shape. Watch what happens at the changes:
• A7 → D7: G falls to F♯ and C♯ falls to C. Both notes move down a half step, and the shape slides down one fret. The 7th of A7 (G) resolves to the 3rd of D7 (F♯), and the 3rd of A7 (C♯) slides down to the 7th of D7 (C).
• E7 → D7 and D7 → A7 also move by half steps or whole steps. The ear hears tiny moves and smooth harmony.

The tab comps a full 12-bar with these two-note shapes, one per bar. It's a sparse, classy rhythm part that leaves room for a singer or soloist. It's also a solo idea: land on these exact notes at each change and your lines will spell the progression even with no band.

Practice: play the tab with a shuffle backing track. Then solo using only guide tones, two notes per chord, and finally embed them into pentatonic phrases, aiming each phrase at the new chord's guide tone on beat 1.`,
    });
    const shapes = [
      { chord: 'A7', root: 'A', notes: [{ s: 4, f: 5, label: '♭7', role: 'seventh' }, { s: 3, f: 6, label: '3', role: 'third' }], txt: 'G + C♯' },
      { chord: 'D7', root: 'D', notes: [{ s: 4, f: 4, label: '3', role: 'third' }, { s: 3, f: 5, label: '♭7', role: 'seventh' }], txt: 'F♯ + C' },
      { chord: 'E7', root: 'E', notes: [{ s: 4, f: 6, label: '3', role: 'third' }, { s: 3, f: 7, label: '♭7', role: 'seventh' }], txt: 'G♯ + D' },
    ];
    const bw = 3.6; const gap = (FULL_W - bw * 3) / 2;
    shapes.forEach((sh, i) => {
      const x = M + i * (bw + gap);
      s.addText([{ text: sh.chord, options: { bold: true, color: HEX.white, fontSize: 17 } }, { text: `   ${sh.txt}`, options: { color: HEX.muted, fontSize: 14 } }], { x, y: CONTENT_TOP, w: bw, h: 0.34, margin: 0, valign: 'middle', isTextBox: true });
      D.fretboard(s, { x, y: CONTENT_TOP + 0.45, w: bw, h: 1.45, from: 3, to: 8, root: sh.root, dots: sh.notes, title: `guide ${sh.chord}` });
    });
    heading(s, 'Comp a 12-bar in A with guide tones only (one shape per bar)', M, 4.15, FULL_W, 14);
    const bar = (c, n) => ({ ...c, notes: [n] });
    const gA = '4:5 3:6'; const gD = '4:4 3:5'; const gE = '4:6 3:7';
    chordTab(s, {
      x: M, y: 5.0, w: FULL_W, gap: 0.24,
      bars: [bar(A7, gA), bar(A7, gA), bar(A7, gA), bar(A7, gA), bar(D7, gD), bar(D7, gD), bar(A7, gA), bar(A7, gA), bar(E7, gE), bar(D7, gD), bar(A7, gA), bar(E7, gE)],
    });
  }

  // 40 · Approach notes and enclosures
  {
    const s = D.slideOf(pres, {
      kicker: KICK, title: 'Approach notes and enclosures',
      notes: `A target note sounds strongest when you arrive at it from somewhere close. There are three classic ways in:

1. Chromatic from below. Play the note one fret under the target, then the target. The approach note is usually outside the scale (C before C♯ over A7, D♯ before E). That's fine: the ear hears it as tension that resolves a split second later.

2. Scale step from above. Play the scale note just above the target, then the target. Over A7, D comes down to C♯, and F♯ comes down to E. These approaches are inside the scale, so they sound smooth and melodic.

3. Enclosure. Combine both: start above, jump below, then land on the target. D → C → C♯ "surrounds" the C♯. Enclosures are a hallmark of bebop and fusion, and they work just as well in blues and rock to make a target note feel inevitable.

On the board, filled dots are targets: C♯ (3rd of A7) on the G string and E (5th) on the B string. The rings are the approach notes around each one.

Timing matters: approach notes go on weak beats (the "&"), and the target lands on the strong beat. Done the other way round, the clash sits on the beat and sounds like a mistake.

Practice: over an A7 vamp, play each of the three tab examples, then pick any chord tone in any position and approach it all three ways. When that's easy, add approaches into your pentatonic licks, just before the last note of a phrase.`,
    });
    const dots = [
      { s: 3, f: 6, label: 'C♯', role: 'third' },
      { s: 3, f: 5, label: 'C', role: 'third', ring: true, noRoleCheck: true },
      { s: 3, f: 7, label: 'D', role: 'other', ring: true },
      { s: 2, f: 5, label: 'E', role: 'fifth' },
      { s: 2, f: 4, label: 'D♯', role: 'other', ring: true, noRoleCheck: true },
      { s: 2, f: 7, label: 'F♯', role: 'other', ring: true },
      { s: 4, f: 7, label: 'A', role: 'root' },
    ];
    D.fretboard(s, { x: M, y: CONTENT_TOP + 0.45, w: 6.2, h: 2.15, from: 3, to: 9, root: 'A', dots, title: 'approach notes' });
    caption(s, 'Over A7 · filled = target chord tone · ring = approach note', M, CONTENT_TOP + 2.95, 6.2, 0.3, 12);
    D.card(s, {
      x: M, y: CONTENT_TOP + 3.4, w: 6.2, h: 1.85, title: 'Approach on the "&", land on the beat',
      body: 'Approach notes are passing tension, so put them on weak beats. The target lands on the strong beat and resolves the tension.',
      fontSize: 14,
    });
    const tabs = [
      { t: '1 · Chromatic from below: C → C♯, D♯ → E', cols: ['3:5', '3:6~', '', '2:4', '2:5~'] },
      { t: '2 · Scale step from above: D → C♯, F♯ → E', cols: ['3:7', '3:6~', '', '2:7', '2:5~'] },
      { t: '3 · Enclosure: D → C → C♯, F♯ → D♯ → E', cols: ['3:7', '3:5', '3:6~', '', '2:7', '2:4', '2:5~'] },
    ];
    const tx = 7.1; const tw = 12.73 - tx;
    tabs.forEach((tb, i) => {
      const y = CONTENT_TOP + i * 1.78;
      heading(s, tb.t, tx, y, tw, 13);
      D.tab(s, { x: tx, y: y + 0.45, w: tw, gap: 0.22, cols: tb.cols, check: { root: 'A', scale: T.CHORDS.dom7, extra: [3, 5, 6, 9] } });
    });
  }

  // 41 · Outlining a 12-bar with arpeggios
  {
    const s = D.slideOf(pres, {
      kicker: KICK, title: 'Outlining a 12-bar with arpeggios',
      notes: `This is everything in Part 3 at once: a full 12-bar blues in A played only with chord tones, staying around frets 4–8 (the E-shape zone, over pentatonic box 1).

Every bar uses only the notes of its chord: A7 = A C♯ E G, D7 = D F♯ A C, E7 = E G♯ B D. The build checked every note against its bar's chord.

Listen for the guide-tone moves at the changes, which are built into the line:
• End of bar 6 (D7) → bar 7 (A7): C (♭7 of D7) rises a half step to C♯ (3rd of A7).
• End of bar 8 (A7) → bar 9 (E7): G (♭7 of A7) rises a half step to G♯ (3rd of E7).
• End of bar 10 (D7) → bar 11 (A7): C → C♯ again.
Those half steps are what make an arpeggio line sound like it "knows" the changes.

How to use this etude:
1. Play it slowly, 4 notes per bar as quarter notes, with a metronome at 60–70 bpm. Say the chord name at the start of each bar.
2. Play it over a shuffle backing track in A. Swing the rhythm.
3. Change the rhythm: start some bars on the "&", leave rests, hold the target notes. It stops sounding like an exercise.
4. Rewrite it: keep the first note of each bar (the target) and replace the other three with pentatonic notes or approach notes. Now you are soloing through the changes.

Common mistake: playing arpeggios as fast runs. Chord tones are only powerful when they land on strong beats with good time.`,
    });
    const rows = [
      [
        { ...A7, notes: ['6:5', '5:4', '5:7', '4:5'] },
        { ...A7, notes: ['4:7', '3:6', '2:5', '2:8'] },
        { ...A7, notes: ['1:5', '2:8', '2:5', '3:6'] },
        { ...A7, notes: ['4:7', '4:5', '5:7', '5:4'] },
      ],
      [
        { ...D7, notes: ['5:5', '4:4', '4:7', '3:5'] },
        { ...D7, notes: ['1:5', '2:7', '3:7', '3:5'] },
        { ...A7, notes: ['3:6', '2:5', '2:8', '1:5'] },
        { ...A7, notes: ['1:5', '2:5', '3:6', '4:5'] },
      ],
      [
        { ...E7, notes: ['4:6', '3:4', '3:7', '2:5'] },
        { ...D7, notes: ['2:7', '3:7', '4:7', '3:5'] },
        { ...A7, notes: ['3:6', '4:7', '4:5', '5:7'] },
        { ...E7, notes: ['5:7', '6:4', '6:7', '5:5'] },
      ],
    ];
    rows.forEach((bars, i) => {
      const y = CONTENT_TOP + 0.55 + i * 1.72;
      s.addText(`Bars ${i * 4 + 1}–${i * 4 + 4}`, { x: M, y: y - 0.42, w: 1.3, h: 0.26, fontSize: 11, color: HEX.muted, margin: 0, valign: 'bottom', isTextBox: true });
      chordTab(s, { x: M + 1.3, y, w: FULL_W - 1.3, gap: 0.22, bars });
    });
  }

  // 42 · Practice this
  D.practice(pres, {
    kicker: KICK,
    intro: 'Pick one string set and one arpeggio position per week. Say every interval out loud.',
    drills: [
      {
        name: 'Triad set of the week',
        how: 'On this week\'s string set, play A major voicings up the neck, then minor. Then do I–IV–V voice-led in one zone.',
        tempo: '60 bpm, 1 voicing per beat', time: '5 min', done: 'All inversions, no looking, both qualities',
      },
      {
        name: 'Arpeggio positions',
        how: 'A7, then Am7, in one position: root to root, then lowest to highest note. Add the next position when it is clean.',
        tempo: '60 → 90 bpm, 8th notes', time: '5 min', done: 'All 5 A7 positions, linked',
      },
      {
        name: 'Guide-tone comping',
        how: 'Comp the 12-bar with 3rd + ♭7 shapes, one per bar. Then solo using only guide tones, landing on beat 1.',
        tempo: 'Shuffle, 70–90 bpm', time: '5 min', done: '3 choruses without losing the form',
        role: 'fifth',
      },
      {
        name: 'Target and enclose',
        how: 'Over A7, approach C♯ and E from below, from above, then enclose. Then add one enclosure to a pentatonic lick.',
        tempo: '60–80 bpm', time: '5 min', done: 'Enclosures land on the beat every time',
      },
    ],
    notes: `Four drills for Part 3. You don't need all four every day. Rotate two per session, but keep the triad drill in every week.

1. Triad set of the week. Spend a week on each string set: G-B-e (review), then D-G-B, A-D-G and E-A-D. Play the major voicings up and down the neck, naming each inversion, then the minor ones. Finish with I–IV–V (A–D–E) voice-led inside one four-fret zone. When you can do it without looking at the diagrams, move to the next set.

2. Arpeggio positions. Start with the A7 position that sits over pentatonic box 1 (E shape, frets 4–8). Play root to root, then from the lowest note to the highest note in the zone. Once it's clean at 90 bpm in 8th notes, add the next position and practise shifting between them. Then do the same with Am7.

3. Guide-tone comping. Put on a slow blues shuffle in A and comp the whole 12-bar with the two-note guide-tone shapes from slide 39. Then solo using only those notes. It feels limited, but it trains your ear to hear every chord change. Finally, mix guide tones into normal pentatonic soloing, aiming at them on beat 1 of each change.

4. Target and enclose. Over an A7 vamp, approach C♯ and E chromatically from below, by scale step from above, and with an enclosure. Keep approach notes on the "&" and targets on the beat. Then take one lick you already know and put an enclosure before its last note.

Checkpoint for Part 3: you can solo through a 12-bar in A and land on each chord's 3rd at every change, in at least two positions.`,
  });
}

module.exports = { build };
