// Level 2 · Part 1 · Rhythm and time feel (slides 4–15)
const T = require('../lib/theory');
const D = require('../lib/draw');
const { HEX, M, CONTENT_TOP, section } = require('../lib/deck');

const KICKER = '1 · Rhythm and time feel';
const FULL_W = 12.13;
const PENT_A = { root: 'A', scale: T.SCALES.minPent };
const MINOR_E = { root: 'E', scale: T.SCALES.minor };

// Small pearl heading above a diagram.
function heading(s, str, x, y, w) {
  s.addText(str, { x, y, w, h: 0.3, fontSize: 14, bold: true, color: HEX.pearl, margin: 0, valign: 'middle', isTextBox: true });
}
// Repeat a per-beat note pattern across `beats` beats of `sub` cells. pattern: [{at, len, text, accent, ghost}] in cells within one beat.
function perBeat(beats, sub, pattern, extra = {}) {
  const out = [];
  for (let b = 0; b < beats; b++) for (const p of pattern) out.push({ ...extra, ...p, at: b * sub + p.at });
  return out;
}
// Alternating pick strokes D U D U … across n equal notes of length len.
function alternating(n, len, extra = {}) {
  return Array.from({ length: n }, (_, i) => ({ ...extra, at: i * len, len, text: i % 2 ? 'U' : 'D' }));
}

function build(pres) {
  section(pres, 'Rhythm and time feel');

  // 4 · Divider
  D.divider(pres, {
    num: 1, title: 'Rhythm and time feel',
    subtitle: 'Where you put a note matters as much as which note you choose. This part teaches you to count, feel and lock in.',
    outcomes: [
      'Count and play 8ths, triplets and 16ths at any tempo',
      'Switch between straight and swing feel on demand',
      'Play syncopated phrases and odd meters without losing beat 1',
      'Play gallops and chugs that lock with the kick and snare',
    ],
    notes: `Part 1 is about rhythm, and it comes first in Level 2 for a reason.

Listen to any great blues, rock or metal player and you'll notice they rarely play more notes than you. They place the notes better. A single repeated note with great timing and feel sounds like music. A fast scale run with sloppy timing sounds like practice. Most self-taught guitarists spend 90% of their time on which notes to play and 10% on when. This part fixes that balance.

What's coming:
• Note values as lengths on a grid, so you can read rhythm without standard notation.
• Counting out loud: "1 & 2 &" and "1 e & a 2 e & a".
• Triplets, and why three-per-beat feels so different from two or four.
• Swing vs. straight feel, the difference between a blues shuffle and a punk riff.
• Syncopation and rests: pushes, anticipations, phrases that start off the beat.
• Time signatures from 4/4 to 12/8, plus the odd meters (7/8, 5/4) used in prog and metal.
• Rhythmic displacement: making one lick sound new by moving where it starts.
• Gallops and chugs for metal.
• Locking with a drummer.

You'll read rhythm grids throughout. Time runs left to right, each beat is a column, and colored bars are the notes. Clap or play every grid with a metronome before moving on. Rhythm is learned in the body, not on the page.`,
  });

  // 5 · Note values
  {
    const s = D.slideOf(pres, {
      kicker: KICKER, title: 'Note values: lengths on a grid',
      notes: `Every rhythm is built from a handful of note lengths. The grid shows one bar of 4/4 (four beats). Each beat is split into four cells, so one cell is a 16th note.

• Whole note: lasts the whole bar, all 4 beats. Strike it once and let it ring.
• Half notes: 2 beats each, so two per bar.
• Quarter notes: 1 beat each. This is the metronome click, the pulse you tap your foot to.
• 8th notes: half a beat each, two per beat. Counted "1 & 2 & 3 & 4 &".
• 16th notes: a quarter of a beat each, four per beat. Counted "1 e & a 2 e & a…".

Each row splits the row above it in two. That doubling is the whole system. A whole note = 2 halves = 4 quarters = 8 eighths = 16 sixteenths.

Rests are silences with exactly the same lengths: a quarter rest is one beat of silence. In the grids, a rest is simply an empty stretch of cells. Silence still gets counted.

Two more ideas you'll meet:
• A dot adds half the note's length again. A dotted quarter lasts 1½ beats (6 cells), a dotted 8th lasts ¾ of a beat (3 cells). Dotted rhythms give rock riffs their bounce.
• A tie joins two notes into one longer note, often across a beat line. Ties are how syncopation is written, and you'll see them on slide 9.

Try it: set a metronome to 60 and play an open A string through each row of the grid, counting out loud. Keep the count going even when the note is sustaining. Counting through long notes is what keeps you in time.`,
    });
    const rows = [
      { label: 'Whole', notes: [{ at: 0, len: 16, role: 'root', text: '1 note = 4 beats' }] },
      { label: 'Half', notes: [0, 8].map((at) => ({ at, len: 8, role: 'third', text: '2 beats' })) },
      { label: 'Quarter', notes: [0, 4, 8, 12].map((at) => ({ at, len: 4, role: 'fifth', text: '1 beat' })) },
      { label: '8th', notes: Array.from({ length: 8 }, (_, i) => ({ at: i * 2, len: 2, role: 'seventh', text: '½' })) },
      { label: '16th', notes: Array.from({ length: 16 }, (_, i) => ({ at: i, len: 1, role: 'blue' })) },
    ];
    D.rhythm(s, { x: M, y: CONTENT_TOP + 0.1, w: FULL_W, beats: 4, sub: 4, rows });
    const cw = (FULL_W - 0.6) / 3;
    const cards = [
      ['Each row splits the one above', '1 whole = 2 halves = 4 quarters = 8 eighths = 16 sixteenths. Learn the doubling and you can read any rhythm.'],
      ['Rests have the same lengths', 'A rest is counted silence. In the grids it’s an empty stretch of cells. **Keep counting through it.**'],
      ['Dots and ties', 'A **dot** adds half again: a dotted quarter lasts 1½ beats. A **tie** joins two notes across a beat line.'],
    ];
    cards.forEach(([t, b], i) => D.card(s, { x: M + i * (cw + 0.3), y: 4.85, w: cw, h: 1.95, title: t, body: b, fontSize: 14, titleSize: 16 }));
  }

  // 6 · Counting subdivisions
  {
    const s = D.slideOf(pres, {
      kicker: KICKER, title: 'Counting subdivisions out loud',
      notes: `Counting out loud is the single most effective rhythm habit you can build. It feels silly for about a week, then it becomes the thing that keeps you in time when a song gets hard.

The grid shows the same bar three ways:
• Quarter notes, counted "1 2 3 4". One downstroke per beat.
• 8th notes, counted "1 & 2 & 3 & 4 &". The numbers are the downbeats and the "&"s are the upbeats.
• 16th notes, counted "1 e & a 2 e & a…" (say "one-ee-and-uh").

The letters inside the bars are pick strokes: D = downstroke, U = upstroke. Notice the rule. Each beat starts with a downstroke, and the pick alternates evenly between them: in 8ths the "&" is an upstroke; in 16ths the "e" and "a" are upstrokes and the "&" is a downstroke. This is the pick-hand clock. Your picking hand moves down and up constantly, like a pendulum, and simply hits or misses the strings. When you rest, the hand keeps moving. That's how strummers and riff players keep time without thinking about it.

The tab is the "1 e & a" count applied to a box 1 run: two beats of 16th notes, four notes per beat, strict alternate picking.

How to practice it:
1. Metronome at 60. Count 16ths out loud for a full minute without playing.
2. Mute the strings with your fretting hand and strum the pattern: quarters for 4 bars, 8ths for 4, 16ths for 4.
3. Play the tab run, counting out loud.

Common mistake: speeding up on 16ths. If the clicks start drifting from your "1"s, drop the tempo. Clean at 60 beats sloppy at 100.`,
    });
    D.rhythm(s, {
      x: M, y: CONTENT_TOP + 0.1, w: FULL_W, beats: 4, sub: 4,
      rows: [
        { label: 'Quarters', notes: [0, 4, 8, 12].map((at) => ({ at, len: 4, role: 'fifth', text: 'D' })) },
        { label: '8ths', notes: alternating(8, 2, { role: 'third' }) },
        { label: '16ths', notes: alternating(16, 1, { role: 'root' }) },
      ],
    });
    D.card(s, {
      x: M, y: 3.85, w: 3.85, h: 2.95, title: 'The pick-hand clock',
      bullets: ['Downbeats = **downstrokes**', 'Upbeats (& in 8ths; e and a in 16ths) = **upstrokes**', 'The hand never stops, even through rests: it just misses the strings'],
      fontSize: 14,
    });
    D.card(s, {
      x: M + 4.15, y: 3.85, w: 3.85, h: 2.95, title: 'Say it, then play it',
      bullets: ['Count a full minute before playing', 'Mute the strings and strum each row for 4 bars', 'If the count drifts from the click, slow down'],
      fontSize: 14,
    });
    heading(s, '16ths in box 1: two beats', 8.88, 3.85, 3.85);
    D.tab(s, {
      x: 8.88, y: 4.4, w: 3.85, gap: 0.24, cols: ['5:5', '5:7', '4:5', '4:7', '3:5', '3:7', '2:5', '2:8'],
      counts: ['1', 'e', '&', 'a', '2', 'e', '&', 'a'], check: PENT_A,
    });
  }

  // 7 · Triplets
  {
    const s = D.slideOf(pres, {
      kicker: KICKER, title: 'Triplets: three notes in a beat',
      notes: `A triplet squeezes three equal notes into the space of one beat. Count them "1-trip-let 2-trip-let 3-trip-let 4-trip-let".

Why they matter: two and four feel square and marching, while three feels round and rolling. Triplets give a slow blues its sway, Southern rock its swagger, and metal its galloping "triplet chug". When you hear a lick that seems to tumble, it's usually in triplets.

The grid shows:
• Quarter notes for reference: one per beat.
• 8th-note triplets: three per beat (12 per bar). With strict alternate picking the pattern is D U D, U D U. The pick direction flips on every beat because three is an odd number. That flip trips people up at first. Some players prefer down-up-down on every beat (with economy or hybrid picking), and both are fine as long as the timing is even.
• Quarter-note triplets: three notes spread over two beats. Each note lasts two triplet cells. They create a lazy, floating feel against a straight beat and are common in blues phrasing.

The tab is box 1 descending in 8th-note triplets: two notes per string, so the groups of three cross the strings in an uneven way. That's exactly what makes the run sound interesting rather than mechanical.

Practice: metronome at 60, count "1-trip-let" out loud, and play an open A as triplets for 4 bars. Then switch between 8ths and triplets every 2 bars. The switch is the skill. Most players can play each one alone, but few can change cleanly.`,
    });
    D.rhythm(s, {
      x: M, y: CONTENT_TOP + 0.1, w: FULL_W, beats: 4, sub: 3,
      rows: [
        { label: 'Quarters', notes: [0, 3, 6, 9].map((at) => ({ at, len: 3, role: 'fifth', text: 'D' })) },
        { label: '8th triplets', notes: alternating(12, 1, { role: 'seventh' }) },
        { label: '¼ triplets', notes: [0, 2, 4, 6, 8, 10].map((at) => ({ at, len: 2, role: 'blue' })) },
      ],
    });
    heading(s, 'Box 1 in 8th-note triplets: groups of three cross the strings', M, 3.85, 7.6);
    D.tab(s, {
      x: M, y: 4.4, w: 7.6, gap: 0.24,
      cols: ['1:8', '1:5', '2:8', '2:5', '3:7', '3:5', '4:7', '4:5', '5:7', '5:5', '6:8', '6:5'],
      counts: ['1', 'trip', 'let', '2', 'trip', 'let', '3', 'trip', 'let', '4', 'trip', 'let'], check: PENT_A,
    });
    D.card(s, {
      x: 8.55, y: 3.85, w: 4.18, h: 2.95, title: 'Why three feels different',
      bullets: ['Two and four march; **three rolls**', 'Alternate picking flips direction every beat', 'Slow blues, Southern rock and metal chugs all live here'],
      fontSize: 14,
    });
  }

  // 8 · Swing vs straight
  {
    const s = D.slideOf(pres, {
      kicker: KICKER, title: 'Swing vs. straight: the shuffle',
      notes: `Straight 8th notes split each beat into two equal halves. Swung 8th notes split it unevenly: the first note is long and the second is short. The standard swing feel puts the second note on the last third of a triplet. You keep the "1" and the "let" of "1-trip-let" and skip the middle.

Compare the two grids. The straight row has eight equal bars. The swung row has the same eight notes, but each pair is long-short: the long note covers two triplet cells and the short note covers one. The "&" still exists, it just arrives late.

That long-short bounce is the shuffle, the engine of countless blues and boogie-rock songs. The tab is the shuffle riff from Level 1 (A5 alternating with A6 on the A and D strings). Play it straight first. It sounds stiff, almost like punk. Now swing it, "long-short, long-short", and it turns into a blues shuffle. Same notes, different universe.

Where you hear each feel:
• Swung: blues shuffles, boogie, Texas blues, jump blues, some classic rock.
• Straight: most hard rock, punk, metal, pop-rock.
• 12/8 slow blues: essentially swing at a slow tempo, felt as four big beats of three.

How to learn it:
1. Count triplets out loud, "1-trip-let 2-trip-let", and play only on the "1" and the "let".
2. Then stop saying "trip" out loud but keep feeling it.
3. Switch between straight and swung every 4 bars.

Decide the feel before the count-in. In a jam, the drummer's hi-hat tells you, so listen for it.`,
    });
    D.rhythm(s, { x: M, y: CONTENT_TOP + 0.1, w: FULL_W, beats: 4, sub: 2, rows: [{ label: 'Straight 8ths', notes: alternating(8, 1, { role: 'fifth' }) }] });
    D.rhythm(s, {
      x: M, y: CONTENT_TOP + 1.05, w: FULL_W, beats: 4, sub: 3,
      rows: [{ label: 'Swung 8ths', notes: perBeat(4, 3, [{ at: 0, len: 2, text: 'D' }, { at: 2, len: 1, text: 'U' }], { role: 'root' }) }],
      countLabels: (b, k) => (k === 0 ? String(b + 1) : k === 2 ? '&' : ''),
    });
    heading(s, 'The A shuffle riff: play it straight, then swing the &s', M, 3.75, 6.6);
    D.tab(s, {
      x: M, y: 4.3, w: 6.6, gap: 0.24,
      cols: ['5:0 4:2', '5:0 4:2', '5:0 4:4', '5:0 4:4', '5:0 4:2', '5:0 4:2', '5:0 4:4', '5:0 4:4'],
      counts: ['1', '&', '2', '&', '3', '&', '4', '&'], check: { root: 'A', scale: [0, 7, 9] },
    });
    D.card(s, { x: 7.6, y: 3.75, w: 5.13, h: 1.45, title: 'Feel it as triplets', body: 'Swing = play the **1** and the **let** of “1-trip-let”. The & arrives late.', fontSize: 14 });
    D.card(s, { x: 7.6, y: 5.4, w: 5.13, h: 1.45, title: 'Which feel when', body: '**Swung:** shuffles, boogie, Texas blues. **Straight:** hard rock, punk, metal.', fontSize: 14 });
  }

  // 9 · Syncopation and rests
  {
    const s = D.slideOf(pres, {
      kicker: KICKER, title: 'Syncopation and rests',
      notes: `Syncopation means stressing the "wrong" parts of the beat: the "&"s instead of the numbers, or holding a note across a beat line so the beat itself is silent. It's what makes a riff groove instead of plod.

The grid shows four rhythms in 8th notes:
• On the beat: four quarter notes. Solid but square.
• Push to beat 3: the note that "should" land on 3 arrives early, on the "&" of 2, and is held through beat 3 (the ">" marks the accent). Rock and funk riffs push into a chord change like this all the time. The band hits the new chord half a beat early.
• Start on the "&": the phrase begins after a rest on beat 1. Starting off the beat is the quickest way to make a solo sound conversational instead of stiff.
• Off-beat stabs: only the "&"s, all accented. Classic reggae and ska upstrokes, and a great rhythm-guitar trick in rock for leaving space for the drummer.

The tab applies it to a box 1 phrase: rest on beat 1, enter on the "&", bend on the "&" of 2 and let the bend ring through beat 3, then resolve to the root. Count it out loud. The empty columns are counted silence, not dead air.

Three rules:
1. Accent the off-beat note so the listener hears the push.
2. Let pushed notes ring across the beat. Don't cut them off early.
3. Rests are notes too: count them as deliberately as you play.

Practice by looping a drum beat and clapping each grid row for 4 bars, then playing it on one note, then turning it into a lick.`,
    });
    D.rhythm(s, {
      x: M, y: CONTENT_TOP + 0.05, w: FULL_W, beats: 4, sub: 2,
      rows: [
        { label: 'On the beat', notes: [0, 2, 4, 6].map((at) => ({ at, len: 2, role: 'fifth' })) },
        { label: 'Push to 3', notes: [{ at: 0, len: 2, role: 'third' }, { at: 2, len: 1, role: 'third' }, { at: 3, len: 3, role: 'third', accent: true, text: 'held' }, { at: 6, len: 2, role: 'third' }] },
        { label: 'Start on &', notes: [{ at: 1, len: 1, role: 'root' }, { at: 2, len: 1, role: 'root' }, { at: 3, len: 1, role: 'root' }, { at: 5, len: 3, role: 'root' }] },
        { label: 'Off-beat stabs', notes: [1, 3, 5, 7].map((at) => ({ at, len: 1, role: 'seventh', accent: true })) },
      ],
    });
    heading(s, 'A syncopated box 1 phrase: rest on 1, push the bend', M, 4.35, 7.3);
    D.tab(s, {
      x: M, y: 4.9, w: 7.3, gap: 0.24, cols: ['', '1:5', '1:8', '2:8b10', '', '2:5', '3:7', '4:7~'],
      counts: ['1', '&', '2', '&', '3', '&', '4', '&'], check: PENT_A,
    });
    D.card(s, {
      x: 8.3, y: 4.35, w: 4.43, h: 2.45, title: 'Three rules',
      bullets: ['**Accent** the off-beat note', '**Let it ring** across the beat line', '**Count the rests** as carefully as the notes'],
      fontSize: 14,
    });
  }

  // 10 · Time signatures
  {
    const s = D.slideOf(pres, {
      kicker: KICKER, title: 'Time signatures: 4/4, 3/4, 6/8, 12/8',
      notes: `A time signature tells you how beats are grouped. The bottom number names a note value (4 = quarter note, 8 = 8th note) and the top number says how many of them fill a bar. In simple meters (4/4, 3/4) each one is a beat. In compound meters (6/8, 12/8) they group in threes, so 6/8 is felt as two big beats. The strongest beat is always beat 1, the start of the bar.

• 4/4 (common time): four quarter-note beats. The vast majority of blues, rock and metal. Beat 1 is strongest, and in rock beats 2 and 4 carry the snare backbeat.
• 3/4: three beats, the waltz feel. "ONE two three". Rare in heavy music but common in ballads, folk and some blues.
• 6/8: six 8th notes, felt as two big beats of three: "ONE two three FOUR five six". It sways. Power ballads and some metal use it.
• 12/8: twelve 8th notes felt as four big beats, each split into three. Count it "1 & a 2 & a 3 & a 4 & a". This is the slow blues and the swing feel from the previous slide written out. If you can feel triplets in 4/4, you can feel 12/8.

How to tell which one a song is in: tap your foot to the pulse and count until the music feels like it starts over (the chord change or the crash cymbal usually marks it). If you land on 4, it's 4/4. If the pulse divides into threes, it's 6/8 or 12/8. Two big beats per bar is 6/8 and four is 12/8.

Practice: put on songs you know and count them. Then strum an A chord in each meter, accenting beat 1 hard. Accenting the "one" is how you show the band where the bar starts.`,
    });
    const qw = (FULL_W - 0.3) / 2; const qh = 2.55;
    const quads = [
      { t: '4/4 · common time', d: 'Four beats per bar: blues, rock and metal, almost everything.', g: { beats: 4, sub: 1, beatsPerBar: 4, notes: [0, 1, 2, 3].map((at) => ({ at, len: 1, role: at === 0 ? 'root' : 'other', accent: at === 0 })) } },
      { t: '3/4 · waltz', d: 'Three beats: ONE two three. Ballads, folk, some blues.', g: { beats: 3, sub: 1, beatsPerBar: 3, notes: [0, 1, 2].map((at) => ({ at, len: 1, role: at === 0 ? 'root' : 'other', accent: at === 0 })) } },
      { t: '6/8 · two big beats', d: 'Six 8ths felt in two: ONE two three FOUR five six.', g: { beats: 6, sub: 1, beatsPerBar: 6, notes: [0, 1, 2, 3, 4, 5].map((at) => ({ at, len: 1, role: at === 0 ? 'root' : at === 3 ? 'fifth' : 'other', accent: at === 0 || at === 3 })) } },
      { t: '12/8 · slow blues', d: 'Four big beats, each split in three: 1 & a 2 & a.', g: { beats: 4, sub: 3, beatsPerBar: 4, notes: Array.from({ length: 12 }, (_, i) => ({ at: i, len: 1, role: i % 3 === 0 ? 'root' : 'other', accent: i % 3 === 0 })), countLabels: (b, k) => (k === 0 ? String(b + 1) : k === 1 ? '&' : 'a') } },
    ];
    quads.forEach((q, i) => {
      const x = M + (i % 2) * (qw + 0.3); const y = CONTENT_TOP + 0.05 + Math.floor(i / 2) * (qh + 0.15);
      const inner = D.card(s, { x, y, w: qw, h: qh, title: q.t, titleSize: 17 });
      D.rhythm(s, { x: x + 0.22, y: inner.innerY, w: qw - 0.44, beats: q.g.beats, sub: q.g.sub, beatsPerBar: q.g.beatsPerBar, rows: [{ notes: q.g.notes }], countLabels: q.g.countLabels });
      D.text(s, q.d, { x: x + 0.22, y: inner.innerY + 1.08, w: qw - 0.44, h: 0.5, fontSize: 14 });
    });
  }

  // 11 · Odd meters
  {
    const s = D.slideOf(pres, {
      kicker: KICKER, title: 'Odd meters in rock and metal',
      notes: `Odd meters sound complicated but are built from just two pieces: groups of 2 and groups of 3. Nobody counts "1 2 3 4 5 6 7" at speed. You count the groups.

7/8 is seven 8th notes per bar. The two most common groupings:
• 2+2+3: "1-2, 1-2, 1-2-3". Feels like a bar of 4/4 with the last 8th note chopped off, so the riff "trips" back to the start early.
• 3+2+2: "1-2-3, 1-2, 1-2". The long group comes first, which gives a lurching start.
The grouping changes the feel completely even though the bar is the same length. The accents (">") mark where each group starts.

5/4 is five quarter-note beats, usually felt as 3+2 ("1-2-3, 1-2") or 2+3. It's a classic of prog rock and jazz.

The tab is a metal riff in 7/8 in E minor, grouped 2+2+3. Palm-mute the open E chugs, and let the three-note figure at the end of each bar (E-G-A or B-A-G, played on the low E string) mark the "1-2-3" group. Loop it until the bar line stops feeling like a stumble and starts feeling like the groove.

How to learn an odd meter:
1. Clap it while counting the groups out loud, accenting each group's "1".
2. Play only the accented notes on a muted string, then fill in the rest.
3. Loop the riff over a metronome set to click on 8th notes.
4. Finally, feel the groups without counting. That's the goal.

Odd meters appear in prog metal, djent and math rock, and occasionally in mainstream rock as one "extra" or "missing" bar.`,
    });
    const r78 = (counts, accents, roles) => Array.from({ length: 7 }, (_, i) => ({ at: i, len: 1, role: accents.includes(i) ? roles : 'other', accent: accents.includes(i) }));
    D.rhythm(s, {
      x: M, y: CONTENT_TOP + 0.05, w: FULL_W, beats: 7, sub: 1, beatsPerBar: 7,
      rows: [{ label: '7/8: 2+2+3', notes: r78(null, [0, 2, 4], 'root') }, { label: '7/8: 3+2+2', notes: r78(null, [0, 3, 5], 'fifth') }],
      countLabels: (b) => ['1', '2', '1', '2', '1', '2', '3'][b],
    });
    s.addText('Counts shown for 2+2+3. For 3+2+2 count 1-2-3, 1-2, 1-2.', { x: M + 1.15, y: 3.2, w: 8, h: 0.24, fontSize: 11, color: HEX.muted, margin: 0, isTextBox: true });
    D.rhythm(s, {
      x: M, y: 3.5, w: FULL_W, beats: 5, sub: 1, beatsPerBar: 5,
      rows: [{ label: '5/4: 3+2', notes: Array.from({ length: 5 }, (_, i) => ({ at: i, len: 1, role: i === 0 || i === 3 ? 'third' : 'other', accent: i === 0 || i === 3 })) }],
      countLabels: (b) => ['1', '2', '3', '1', '2'][b],
    });
    heading(s, 'E minor riff in 7/8 (2+2+3), palm-muted chugs', M, 4.6, 7.6);
    D.tab(s, {
      x: M, y: 5.12, w: 7.6, gap: 0.22,
      cols: ['6:0', '6:0', '6:0', '6:0', '6:0', '6:3', '6:5', '|', '6:0', '6:0', '6:0', '6:0', '6:7', '6:5', '6:3'],
      counts: ['1', '2', '1', '2', '1', '2', '3', '', '1', '2', '1', '2', '1', '2', '3'], check: MINOR_E,
    });
    D.card(s, {
      x: 8.5, y: 4.6, w: 4.23, h: 2.2, title: 'Count the groups',
      bullets: ['Accent each group’s 1', 'Clap it, then play it', 'Feel it, then stop counting'],
      fontSize: 14,
    });
  }

  // 12 · Rhythmic displacement
  {
    const s = D.slideOf(pres, {
      kicker: KICKER, title: 'Displacement: same lick, new start',
      notes: `Rhythmic displacement means taking a lick and starting it somewhere else in the bar, without changing a single note. It's one of the fastest ways to get more out of the vocabulary you already have.

The grid uses a three-note A minor pentatonic motif: C (an 8th note), then A and G (two 16ths). It's played twice per bar, and each row starts it later:
• On beat 1: the obvious version, which sounds "square" and predictable.
• One 16th later: the C and A land off the beat, and the G falls on beats 2 and 4. It instantly sounds funkier and more urgent.
• One 8th later: the motif starts on the "&". Very common in blues phrasing.
• One beat later: the accents now fall on 2 and 4, so it lines up with the snare.

Why it works: the listener's ear tracks where notes fall against the beat, not just which notes they are. Move the start point and the accents land on new parts of the beat, so the same notes sound like a new phrase. Great improvisers do this constantly, repeating an idea but shifting it so it never sounds like a loop.

The tab plays the motif twice, back to back; the grid spaces it on beats 1 and 3. Learn it, then play it against a drum loop starting on each of the four positions in the grid. Count "1 e & a" out loud the whole time. The hardest part is knowing where "1" is when your lick no longer starts there.

Extend it: take any lick from Level 1 and displace it by an 8th note. Then try a displacement that is not a whole number of beats, like a dotted 8th (3 sixteenths). Repeated, that creates a cycle that floats over the bar line, a favorite trick in rock and metal riffs.`,
    });
    const motif = (start) => [0, 8].flatMap((o) => [
      { at: start + o, len: 2, role: 'third', text: 'C' }, { at: start + o + 2, len: 1, role: 'root', text: 'A' }, { at: start + o + 3, len: 1, role: 'seventh', text: 'G' },
    ]);
    D.rhythm(s, {
      x: M, y: CONTENT_TOP + 0.05, w: FULL_W, beats: 4, sub: 4,
      rows: [
        { label: 'On beat 1', notes: motif(0) },
        { label: '+ one 16th', notes: motif(1) },
        { label: '+ one 8th', notes: motif(2) },
        { label: '+ one beat', notes: motif(4) },
      ],
    });
    heading(s, 'The motif in tab (A minor pentatonic, box 1)', M, 4.35, 6.4);
    D.tab(s, {
      x: M, y: 4.9, w: 6.4, gap: 0.24, cols: ['1:8', '', '1:5', '2:8', '1:8', '', '1:5', '2:8'],
      counts: ['1', 'e', '&', 'a', '2', 'e', '&', 'a'], check: PENT_A,
    });
    D.card(s, {
      x: 7.4, y: 4.35, w: 5.33, h: 2.45, title: 'Why it works',
      bullets: ['The ear tracks **where** notes land, not just which notes', 'New start point = new accents = a new phrase', 'Repeat an idea, but shift it so it never sounds like a loop'],
      fontSize: 14,
    });
  }

  // 13 · Metal rhythms
  {
    const s = D.slideOf(pres, {
      kicker: KICKER, title: 'Metal rhythms: gallops and chugs',
      notes: `Metal rhythm guitar is built from a few 16th-note and triplet cells, played palm-muted on the low strings with relentless precision.

• Gallop: an 8th note followed by two 16ths, "1 . & a", like a horse running. Pick it down, down-up (D D U). The first downstroke is the 8th, and the down-up pair is the two 16ths. Classic heavy metal and thrash use it to drive whole songs.
• Reverse gallop: two 16ths then an 8th, "1 e &". Picked D U D. It pushes forward into the next beat.
• 16th-note chug: four even notes per beat with strict alternate picking. The foundation of thrash and modern metal riffs.
• Triplet chug: three per beat, rolling instead of marching. Often alternate-picked, sometimes all downstrokes at slower tempos for a heavier attack.

The tab is an E gallop riff: three beats of galloping open E, then a G5 power chord gallop on beat 4. Palm-mute the open string and release the mute slightly (or hit harder) on the power chord so it jumps out.

How to build speed without tension:
1. Start where every note is even. Record yourself: gallops tend to rush, so the 16ths turn into a lazy triplet.
2. Use the metronome ladder: 3 clean passes, then add 4 bpm.
3. Keep the motion small and from the wrist. Your forearm should not burn. If it does, stop, shake out, and slow down.
4. Lock the downstrokes to the kick drum (next slide).

A good target is a clean gallop at 100 bpm within four weeks (the Level 2 milestone), then 120. Speed comes from relaxed accuracy, never from forcing it.`,
    });
    D.rhythm(s, {
      x: M, y: CONTENT_TOP + 0.05, w: FULL_W, beats: 4, sub: 4,
      rows: [
        { label: 'Gallop', notes: perBeat(4, 4, [{ at: 0, len: 2, text: 'D' }, { at: 2, len: 1, text: 'D' }, { at: 3, len: 1, text: 'U' }], { role: 'root' }) },
        { label: 'Reverse', notes: perBeat(4, 4, [{ at: 0, len: 1, text: 'D' }, { at: 1, len: 1, text: 'U' }, { at: 2, len: 2, text: 'D' }], { role: 'third' }) },
        { label: '16th chug', notes: alternating(16, 1, { role: 'fifth' }) },
      ],
    });
    D.rhythm(s, { x: M, y: 3.62, w: FULL_W, beats: 4, sub: 3, rows: [{ label: 'Triplet chug', notes: alternating(12, 1, { role: 'seventh' }) }] });
    heading(s, 'E gallop riff, palm-muted, G5 on beat 4', M, 4.55, 8.1);
    D.tab(s, {
      x: M, y: 5.08, w: 8.1, gap: 0.22,
      cols: ['6:0', '', '6:0', '6:0', '6:0', '', '6:0', '6:0', '6:0', '', '6:0', '6:0', '6:3 5:5', '', '6:3 5:5', '6:3 5:5'],
      counts: ['1', 'e', '&', 'a', '2', 'e', '&', 'a', '3', 'e', '&', 'a', '4', 'e', '&', 'a'], check: MINOR_E,
    });
    D.card(s, {
      x: 9.0, y: 4.55, w: 3.73, h: 2.25, title: 'Picking it',
      bullets: ['Gallop: **D D U**', 'Small wrist motion', 'Gallops rush: record yourself'],
      fontSize: 14,
    });
  }

  // 14 · Locking with the drummer
  {
    const s = D.slideOf(pres, {
      kicker: KICKER, title: 'Locking with the drummer',
      notes: `A band feels tight when the guitar, bass and drums agree on where every beat is. The fastest way to get there is to listen to the drummer's kick and snare and build your part around them.

The grid shows a basic rock beat:
• Hi-hat: steady 8th notes. This is the subdivision everyone feels.
• Snare: beats 2 and 4, the backbeat.
• Kick: beat 1, beat 3 and the "&" of 3.
• Guitar: the riff's main hits land with the kick, played as accented downstrokes, with muted ghost strums (x) filling gaps on the snare beats.

When your accents land with the kick and your gaps leave room for the snare, the riff and the beat become one sound. That's "locking in". Metal players often double the kick pattern exactly with palm-muted chugs.

Where you play against the beat matters too, as the three cards show:
• Ahead: notes land a hair before the click. It sounds urgent and driving, as in punk and thrash.
• On: dead center. Tight and machine-like, the norm in modern metal and pop.
• Behind: notes land a hair late. Relaxed and heavy, the "laid-back" blues and groove feel.

None of these is wrong. They're choices. Great players can do all three on purpose.

Practice: play along with drum loops (search "rock drum loop 90 bpm") and mute your guitar so you only hear the chugs. Can you hear your pick attack and the kick drum as one sound? Then try deliberately playing ahead of and behind the beat for 4 bars each, and return to center.`,
    });
    D.rhythm(s, {
      x: M, y: CONTENT_TOP + 0.05, w: FULL_W, beats: 4, sub: 2,
      rows: [
        { label: 'Hi-hat', notes: Array.from({ length: 8 }, (_, i) => ({ at: i, len: 1, role: 'other' })) },
        { label: 'Snare', notes: [2, 6].map((at) => ({ at, len: 1, role: 'seventh' })) },
        { label: 'Kick', notes: [0, 4, 5].map((at) => ({ at, len: 1, role: 'root' })) },
        { label: 'Guitar', notes: [{ at: 0, len: 1, role: 'fifth', text: 'D', accent: true }, { at: 2, len: 1, role: 'fifth', ghost: true, text: 'x' }, { at: 4, len: 1, role: 'fifth', text: 'D', accent: true }, { at: 5, len: 1, role: 'fifth', text: 'U', accent: true }, { at: 6, len: 1, role: 'fifth', ghost: true, text: 'x' }] },
      ],
    });
    const cw = (FULL_W - 0.6) / 3;
    const feels = [
      ['Ahead of the beat', -0.32, 'root', 'Urgent and driving: punk, thrash.'],
      ['On the beat', 0, 'fifth', 'Tight and precise: modern metal, pop.'],
      ['Behind the beat', 0.32, 'seventh', 'Relaxed and heavy: blues, groove.'],
    ];
    feels.forEach(([t, off, role, d], i) => {
      const x = M + i * (cw + 0.3); const y = 4.45;
      D.card(s, { x, y, w: cw, h: 2.35, title: t, titleSize: 16 });
      const cx = x + cw / 2;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: cx + off, y: y + 0.88, w: 1.2, h: 0.3, rectRadius: 0.06, fill: { color: D.ROLE_HEX[role] }, line: { color: D.ROLE_HEX[role], width: 0 } });
      s.addShape(pres.shapes.LINE, { x: cx, y: y + 0.72, w: 0, h: 0.62, line: { color: HEX.pearl, width: 2 } });
      s.addText('beat', { x: cx - 0.5, y: y + 1.36, w: 1.0, h: 0.22, fontSize: 11, color: HEX.muted, align: 'center', margin: 0, isTextBox: true });
      D.text(s, d, { x: x + 0.22, y: y + 1.65, w: cw - 0.44, h: 0.55, fontSize: 14 });
    });
  }

  // 15 · Practice this
  D.practice(pres, {
    kicker: KICKER, intro: 'Ten to fifteen minutes a day with a metronome. Count out loud every time.',
    drills: [
      { name: 'Subdivision ladder', how: 'On an A5 chord: 4 bars of quarters, then 8ths, triplets and 16ths, counting out loud. Keep the pick hand moving down-up the whole time.', tempo: '60 → 90 bpm', time: '4 min', done: 'Switch on the bar line without a hiccup' },
      { name: 'Swing switch', how: 'A shuffle riff: 4 bars straight, 4 bars swung. Then solo in box 1 the same way, straight phrases then swung phrases.', tempo: '70–100 bpm', time: '4 min', done: 'A listener can tell which feel you’re in' },
      { name: 'Displace one lick', how: 'Take one 3-note lick. Start it on 1, a 16th later, an 8th later and a beat later. Loop each version for 4 bars over a drum loop.', tempo: '60–80 bpm', time: '3 min', done: 'All four starts feel natural' },
      { name: 'Gallop and 7/8', how: 'Palm-muted E gallop, then the 7/8 riff counted 1-2, 1-2, 1-2-3. Use the ladder: 3 clean passes, then +4 bpm.', tempo: '80 → 120 bpm', time: '4 min', done: 'Clean gallop at 100, then 120; 7/8 without counting aloud' },
    ],
    notes: `Rhythm improves fastest with short, daily, focused work, always with a metronome or drum loop and always counting out loud.

1. Subdivision ladder. Hold an A5 power chord (or mute the strings) and play 4 bars of each subdivision in a row: quarters, 8ths, triplets, 16ths, then back down. Count out loud the whole time ("1 2 3 4", "1 & 2 &", "1-trip-let", "1 e & a"). The skill is the switch. Changing subdivision exactly on the bar line, without speeding up, is what lets you play fills and phrases that mix rhythms.

2. Swing switch. Play the A shuffle riff from slide 8 for 4 bars straight and 4 bars swung, alternating. Then improvise in box 1 doing the same. Your phrasing should change feel with the groove. Record it and listen back: can you hear the difference clearly? If not, exaggerate the long-short.

3. Displace one lick. Pick one short lick (the C-A-G motif from slide 12 works). Loop it over a drum beat starting on 1, then a 16th later, an 8th later and a beat later. Count "1 e & a" out loud. Knowing where "1" is while your lick starts elsewhere is the real skill.

4. Gallop and 7/8. Palm-muted E gallop (slide 13) on the metronome ladder: 3 clean passes, then add 4 bpm. Then the 7/8 riff (slide 11), counting the groups. Record the gallop now and then. Gallops tend to drift into triplets, and only recordings reveal it.

Write your tempos in the practice log. Seeing 80 become 120 over a month is the best motivation there is.`,
  });
}

module.exports = { build };
