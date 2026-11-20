// Rhythm trainer logic (no DOM): the pattern library, where each hit falls in time, what the click
// and drums play, the timing grader, statistics, tips and the tempo ladder.
//
// Times are in seconds on the AudioContext clock. The page schedules bars, hands the grader every
// step of every bar (hits, ghost strokes and rests), and feeds it the attacks the onset detector
// heard, already corrected for latency. The grader pairs each attack with the nearest step.
(function (root) {
  'use strict';

  // ---------- notation ----------
  // A bar is a string with one symbol per step. The grid is the steps per beat: 1, 2 (8ths),
  // 3 (triplets), 4 (16ths) or 6 (sextuplets).
  const SYM = {
    D: { hit: true, kind: 'strum', dir: 'down' },
    U: { hit: true, kind: 'strum', dir: 'up' },
    d: { hit: false, kind: 'ghost', dir: 'down' }, // the hand moves but misses the strings
    u: { hit: false, kind: 'ghost', dir: 'up' },
    X: { hit: true, kind: 'chuck' }, // a muted, percussive strum
    P: { hit: true, kind: 'pm', dir: 'down' }, // palm-muted pick
    p: { hit: true, kind: 'pm', dir: 'up' },
    C: { hit: true, kind: 'chord' }, // an open chord, let ring
    o: { hit: true, kind: 'note' }, // a single note, picked or fingered
    '.': { hit: false, kind: 'rest' }, // silence: mute the strings
    '-': { hit: false, kind: 'tie' }, // no new attack: let the last one ring
  };

  // Strumming hand: down on the beat-side steps, up on the others, moving all the time. `mask` has
  // 'x' where the pick hits and '.' where it passes over the strings (a ghost stroke).
  function alt(mask, grid = 2) {
    return [...mask].map((c, i) => {
      const down = grid === 3 ? i % 2 === 0 : (i % grid) % 2 === 0;
      if (c === 'x') return down ? 'D' : 'U';
      return down ? 'd' : 'u';
    }).join('');
  }
  const rep = (s, n) => s.repeat(n);

  // Count names within one beat, by grid.
  const COUNTS = {
    1: [''],
    2: ['', '&'],
    3: ['', 'trip', 'let'],
    4: ['', 'e', '&', 'a'],
    6: ['', 'ta', 'ki', '&', 'ta', 'ki'],
  };
  const GRID_NAME = { 1: 'quarter notes', 2: '8ths', 3: 'triplets', 4: '16ths', 6: 'sextuplets' };

  // ---------- the library ----------
  const CATS = [
    { id: 'time', name: 'Time & subdivisions' },
    { id: 'strum', name: 'Strumming' },
    { id: 'metal', name: 'Palm mute & metal' },
    { id: 'clock', name: 'Inner clock' },
  ];

  const MUTED = 'Mute the strings with your fretting hand so you hear only the rhythm.';
  const PATTERNS = [
    // --- time ---
    {
      id: 'quarters', cat: 'time', name: 'Quarter notes', meter: 4, bpm: 80,
      bars: [{ grid: 1, hits: 'DDDD' }],
      how: `${MUTED} Strum down on every beat. Land exactly with the click, so the click disappears under your strum.`,
      why: 'The foundation of everything else. If the click vanishes, you are on it; if you hear two sounds, you are early or late.',
      cues: ['Tap your foot on every beat.', 'Count out loud: “1, 2, 3, 4”.'],
    },
    {
      id: 'eighths', cat: 'time', name: 'Eighth notes', meter: 4, bpm: 80,
      bars: [{ grid: 2, hits: 'DUDUDUDU' }],
      how: `${MUTED} Down on the beat, up on the “&”. The hand moves down and up like a pendulum and never stops.`,
      why: 'The up-strokes are where most players drift. Even 8ths are the core of rock, pop and Mandopop strumming.',
      cues: ['Count “1 & 2 & 3 & 4 &”.', 'Same loudness down and up.'],
    },
    {
      id: 'triplets', cat: 'time', name: 'Triplets', meter: 4, bpm: 70,
      bars: [{ grid: 3, hits: 'DUDUDUDUDUDU' }],
      how: `${MUTED} Three even strums in every beat, alternating, so each beat starts with a different stroke.`,
      why: 'Triplets are the feel under blues, shuffles and 6/8 ballads. Because the stroke flips every beat, they also train both hands to stay on the grid.',
      cues: ['Count “1-trip-let 2-trip-let”.', 'Accent the first of each three if it helps.'],
    },
    {
      id: 'sixteenths', cat: 'time', name: 'Sixteenth notes', meter: 4, bpm: 65,
      bars: [{ grid: 4, hits: rep('DUDU', 4) }],
      how: `${MUTED} Four even strums per beat: down, up, down, up. Keep the motion small and from the wrist.`,
      why: 'Sixteenths are the grid under funk, ballad strumming and metal riffs. Evenness here makes everything else easier.',
      cues: ['Count “1 e & a 2 e & a”.', 'Small motion, loose wrist.'],
    },
    {
      id: 'ladder', cat: 'time', name: 'Subdivision ladder', meter: 4, bpm: 60,
      bars: [{ grid: 1, hits: 'DDDD' }, { grid: 2, hits: 'DUDUDUDU' }, { grid: 3, hits: 'DUDUDUDUDUDU' }, { grid: 4, hits: rep('DUDU', 4) }],
      how: `${MUTED} One bar each of quarters, 8ths, triplets and 16ths, without stopping. The beat never changes; only how many strums fit in it.`,
      why: 'Switching subdivisions on the fly is what fills and riffs demand. The jump from 8ths to triplets is where most players rush.',
      cues: ['Keep your foot on the beat throughout.', 'Look ahead: the next bar is shown below.'],
    },
    {
      id: 'offbeats', cat: 'time', name: 'Offbeats only', meter: 4, bpm: 80,
      bars: [{ grid: 2, hits: 'dUdUdUdU' }],
      how: `${MUTED} Only the up-strokes hit, on every “&”. On the beat the hand still moves down, just above the strings.`,
      why: 'This is the reggae and ska skank, and the push in rock and Mandopop choruses. Playing between the clicks is a different skill from playing on them.',
      cues: ['Say “1” and “2” silently, play on “&”.', 'Keep the down-motion: it is your clock.'],
    },
    {
      id: 'upbeats16', cat: 'time', name: 'The “e” and the “a”', meter: 4, bpm: 60,
      bars: [{ grid: 4, hits: rep('dUdU', 4) }],
      how: `${MUTED} Sixteenth-note motion, but only the up-strokes hit: the “e” and the “a” of every beat.`,
      why: 'The weakest spots in the beat. Funk and ballad strumming live on them, and they show quickly whether your 16th grid is even.',
      cues: ['Count all four: “1 e & a”.', 'Down-strokes miss the strings by a few mm.'],
    },
    {
      id: 'tresillo', cat: 'time', name: '3 + 3 + 2', meter: 4, bpm: 80,
      bars: [{ grid: 4, hits: alt(rep('x..x..x.', 2), 4) }],
      how: 'Strum the 3 + 3 + 2 rhythm (the tresillo): 1, the “a” of 1, the “&” of 2, then the same from 3. The hand keeps going in 16ths.',
      why: 'The most common syncopation in pop, Latin, Mandopop and djent. It sounds like it pulls against the beat, so it is easy to rush.',
      cues: ['Count “1 2 3, 1 2 3, 1 2” in 16ths.', 'The hits alternate down, up, down.'],
    },
    // --- strumming ---
    {
      id: 'pop', cat: 'strum', name: 'Pop strum · D DU UDU', zh: '流行', meter: 4, bpm: 80,
      bars: [{ grid: 2, hits: alt('x.xx.xxx'), acc: '..>...>.' }],
      how: 'Down, down-up, up-down-up. On beat 3 the hand goes down without hitting the strings. The same pattern as the Mandopop band on the Song writing page.',
      why: 'The most-used strum in pop, folk and Mandopop. The missed stroke on 3 is the whole trick: if you stop the hand there, the up-stroke after it comes late.',
      cues: ['Keep the hand moving on beat 3.', 'A little accent on 2 and 4.'],
    },
    {
      id: 'ballad16', cat: 'strum', name: 'Ballad 16ths', zh: '抒情', meter: 4, bpm: 66,
      bars: [{ grid: 4, hits: alt(rep('x.xx', 4), 4), acc: '....>.......>...' }],
      how: 'On every beat: down on the beat, skip the “e”, then down-up on the “& a” (D · D U). Light and even, with a soft accent on 2 and 4.',
      why: 'The standard 16-beat strum under Mandarin ballads. At slow tempos the gaps are long, which is exactly where time wanders.',
      cues: ['Small strokes, mostly the top 4 strings.', 'Count “1 e & a”.'],
    },
    {
      id: 'sixeight', cat: 'strum', name: '6/8 ballad', zh: '6/8 抒情', meter: 2, bpm: 50,
      bars: [{ grid: 3, hits: alt('x.xxxx', 3), acc: '>..>..', counts: ['1', '2', '3', '4', '5', '6'] }],
      how: 'Six 8ths per bar, felt in two (the tempo is the dotted quarter). Down on 1, the hand passes on 2, then down-up-down-up. Lean on 1 and 4.',
      why: 'The rolling feel of many waltz-like ballads. It is easy to let 6/8 turn into straight 8ths; the accents keep it swaying.',
      cues: ['Count “1 2 3 4 5 6”, accent 1 and 4.', 'The click is on 1 and 4.'],
    },
    {
      id: 'rock8', cat: 'strum', name: 'Rock 8ths, all downstrokes', meter: 4, bpm: 100,
      bars: [{ grid: 2, hits: 'DDDDDDDD', acc: '..>...>.' }],
      how: 'Every 8th note is a downstroke. Lift the hand back up between strokes without touching the strings. Accent 2 and 4 with the snare.',
      why: 'Downstrokes drive punk and rock rhythm guitar. They get harder to keep even as the tempo climbs, so they show stamina as well as time.',
      cues: ['Relax the forearm; the motion is small.', 'If it gets tense, drop 10 bpm.'],
    },
    {
      id: 'chuck24', cat: 'strum', name: 'Chuck on 2 and 4', meter: 4, bpm: 90,
      bars: [{ grid: 2, hits: 'DUXUDUXU', acc: '..>...>.' }],
      how: 'Eighths, but on 2 and 4 the down-strum is a chuck: lay the fretting hand on the strings just as you hit them, for a percussive “chk”.',
      why: 'The chuck plays the snare drum on an acoustic guitar. Used everywhere in acoustic pop and Mandopop when there is no drummer.',
      cues: ['Release the chord on the “&” after the chuck.', 'The chuck is a full stroke, not a tap.'],
    },
    {
      id: 'shuffle', cat: 'strum', name: 'Shuffle strum', meter: 4, bpm: 90, swing: 2 / 3,
      bars: [{ grid: 2, hits: 'DUDUDUDU', acc: '..>...>.' }],
      how: 'Swung 8ths: the “&” comes late, on the last third of the beat (long-short, long-short). Down on the beat, up on the “&”.',
      why: 'The blues and boogie feel. A shuffle that drifts back toward straight 8ths, or speeds up, is the most common blues-jam problem.',
      cues: ['Think “1-(trip)-let”: play only the 1 and the let.', 'Long-short, long-short.'],
    },
    {
      id: 'funk', cat: 'strum', name: 'Funk 16ths with chucks', meter: 4, bpm: 84,
      bars: [{ grid: 4, hits: 'DuDU' + 'XuDu' + 'dUDu' + 'XuDU', acc: '....>.......>...' }],
      how: 'Constant 16th motion. Some strokes hit, some miss, and the chucks on 2 and 4 are the backbeat. Keep the strums short and tight.',
      why: 'Funk is the hardest test of a 16th grid: the hits are sparse, so all the timing lives in the moving hand.',
      cues: ['Loose wrist, small motion.', 'Mute between strums with the fretting hand.'],
    },
    {
      id: 'arp8', cat: 'strum', name: 'Fingerpicked 8ths', zh: '分解和弦', meter: 4, bpm: 70,
      bars: [{ grid: 2, hits: 'oooooooo', acc: '>...>...' }],
      how: 'Pick a chord one string at a time in 8ths: the bass note on 1 and 3, then the treble strings (for example bass, 3, 2, 3, 1, 3, 2, 3).',
      why: 'The verse accompaniment of countless ballads. Even fingerpicking makes a song flow; uneven picking makes it limp.',
      cues: ['Let every note ring.', 'Thumb on the bass, fingers on the top strings.'],
    },
    // --- palm mute & metal ---
    {
      id: 'chug8', cat: 'metal', name: 'Downpicked 8th chugs', meter: 4, bpm: 120,
      bars: [{ grid: 2, hits: 'PPPPPPPP' }],
      how: 'Palm-mute the low E (the side of your picking hand just touching the strings at the bridge) and downpick every 8th note.',
      why: 'Thrash and metal rhythm is built on fast, even downpicking. The tempo ladder shows how far your stamina goes.',
      cues: ['Mute lightly: the note still has pitch.', 'Motion from the wrist, not the elbow.'],
    },
    {
      id: 'chug16', cat: 'metal', name: '16th chugs, alternate picking', meter: 4, bpm: 90,
      bars: [{ grid: 4, hits: rep('Pp', 8) }],
      how: 'Palm-muted low E in 16ths, down-up-down-up. Up-strokes as strong as down-strokes.',
      why: 'Tight 16ths are the engine of metal riffs. Uneven up-strokes make chugs sound like a gallop by accident.',
      cues: ['Same pick depth down and up.', 'Count “1 e & a”.'],
    },
    {
      id: 'gallop', cat: 'metal', name: 'Gallop', meter: 4, bpm: 100,
      bars: [{ grid: 4, hits: rep('P.Pp', 4) }],
      how: 'An 8th then two 16ths, on every beat: “da, da-da”. Palm-muted low E.',
      why: 'The classic heavy-metal gallop. The two 16ths tend to rush into the next beat.',
      cues: ['Count “1 & a 2 & a”.', 'Downpick it all if you can; alternate if not.'],
    },
    {
      id: 'revgallop', cat: 'metal', name: 'Reverse gallop', meter: 4, bpm: 100,
      bars: [{ grid: 4, hits: rep('PpP.', 4) }],
      how: 'Two 16ths then an 8th, on every beat: “da-da, da”. Palm-muted low E.',
      why: 'The other half of the gallop vocabulary. The 8th at the end is where players cut the beat short.',
      cues: ['Count “1 e & 2 e &”.', 'Let the 8th last its full length.'],
    },
    {
      id: 'stops', cat: 'metal', name: 'Chugs and stops', meter: 4, bpm: 100,
      bars: [{ grid: 4, hits: rep('Pp', 4) + 'C---....', acc: '........>.......' }],
      how: 'Two beats of 16th chugs, an open power chord on 3, then silence: kill the chord on 4 with your palm and come back in on 1.',
      why: 'Stops make riffs hit hard, but only if the band comes back in together. Silence is part of the rhythm.',
      cues: ['The silence counts: mute it cleanly.', 'Count the rest out loud.'],
    },
    {
      id: 'syncopated', cat: 'metal', name: 'Syncopated chugs (3 + 3 + 2)', meter: 4, bpm: 90,
      bars: [{ grid: 4, hits: 'P..P..P.P..P..P.' }],
      how: 'Downpicked chugs on the 3 + 3 + 2 rhythm: 1, the “a” of 1, the “&” of 2, then again from 3.',
      why: 'The groove behind modern metal and djent riffs. Without the steady 16th feel in your head, it drifts.',
      cues: ['Count 16ths silently.', 'All downstrokes.'],
    },
    {
      id: 'threes', cat: 'metal', name: 'Accents in 3s over 16ths', meter: 4, bpm: 70,
      bars: [0, 1, 2].map((b) => ({ grid: 4, hits: rep('Pp', 8), acc: [...Array(16)].map((_, i) => ((b * 16 + i) % 3 === 0 ? '>' : '.')).join('') })),
      how: 'Steady 16th chugs, accenting every third one. The accents cross the bar line and take three bars to come back to beat 1.',
      why: 'Groups of 3 over 4 are the polyrhythm under countless prog and metal riffs. The danger is letting the accents pull the 16ths out of shape.',
      cues: ['Keep the 16ths dead even; only the volume changes.', 'Accented notes: unmuted or harder.'],
    },
    {
      id: 'sixteenSext', cat: 'metal', name: '16ths ↔ sextuplets', meter: 4, bpm: 70,
      bars: [{ grid: 4, hits: rep('Pp', 8) }, { grid: 6, hits: rep('Pp', 12) }],
      how: 'A bar of 16ths (4 per beat), then a bar of sextuplets (6 per beat), alternate picking all the way.',
      why: 'Switching between 4 and 6 per beat is the core of tremolo picking and fast metal fills.',
      cues: ['Count “1 e & a” then “1 ta ki & ta ki”.', 'The beat stays put; only the speed of the hand changes.'],
    },
    // --- inner clock ---
    {
      id: 'gap22', cat: 'clock', name: 'Gap click: 2 bars on, 2 off', meter: 4, bpm: 80,
      bars: [{ grid: 2, hits: 'DUDUDUDU' }], click: { mode: 'gap', on: 2, off: 2 },
      how: `${MUTED} Strum 8ths. The click plays for two bars, then goes silent for two. Keep the tempo; when the click comes back, you should still be on it.`,
      why: 'Your own internal clock is what you play with when there is no click: in a band, in a song you write. The drift chart shows whether you speed up or slow down.',
      cues: ['Count bars out loud: “1, 2, 3, 4”.', 'Tap your foot through the gap.'],
    },
    {
      id: 'gap13', cat: 'clock', name: 'Gap click: 1 bar on, 3 off', meter: 4, bpm: 72,
      bars: [{ grid: 2, hits: 'DUDUDUDU' }], click: { mode: 'gap', on: 1, off: 3 },
      how: `${MUTED} One bar of click, three of silence. Take the tempo from that one bar and hold it.`,
      why: 'Longer gaps reveal tempo drift that shorter ones hide.',
      cues: ['Breathe; tension speeds you up.', 'Listen for the click’s return.'],
    },
    {
      id: 'backbeat', cat: 'clock', name: 'Click on 2 and 4 only', meter: 4, bpm: 90,
      bars: [{ grid: 2, hits: 'DUDUDUDU' }], click: { mode: '24' },
      how: `${MUTED} The click only sounds on 2 and 4, like a snare drum. Beats 1 and 3 are yours to place.`,
      why: 'How jazz, soul and pop players practice: it makes the backbeat the anchor and leaves more of the time to you.',
      cues: ['Count “1 2 3 4”, the click on 2 and 4.', 'Start slower than you think.'],
    },
    {
      id: 'oneonly', cat: 'clock', name: 'Click on beat 1 only', meter: 4, bpm: 70,
      bars: [{ grid: 4, hits: rep('DUDU', 4) }], click: { mode: 'one' },
      how: `${MUTED} Sixteenths, with the click only on beat 1 of each bar. Beats 2, 3 and 4 come from you.`,
      why: 'Less help from the click means more of your own time. Sixteenths make any drift obvious by the end of the bar.',
      cues: ['Count all four beats.', 'Aim to land beat 1 together with the click.'],
    },
    {
      id: 'offclick', cat: 'clock', name: 'The click is on the “&”', meter: 4, bpm: 70,
      bars: [{ grid: 1, hits: 'DDDD' }], click: { mode: 'off' },
      how: `${MUTED} The click sounds between the beats. Strum on the beats, in the gaps between clicks.`,
      why: 'It flips your sense of where the beat is. If you can hold it, offbeat parts in songs stop throwing you.',
      cues: ['Hear the click as “&”: “1 & 2 & …”.', 'If you flip onto the click, stop and restart.'],
    },
  ];

  const byId = (id) => PATTERNS.find((p) => p.id === id) || null;

  // For the daily session's planner: what each pattern builds on ([pattern, mastery 0–1]), and a
  // short label for the skill map.
  const NEEDS = {
    quarters: [], eighths: [['quarters', 0.4]], triplets: [['eighths', 0.5]], sixteenths: [['eighths', 0.5]],
    ladder: [['sixteenths', 0.5], ['triplets', 0.4]], offbeats: [['eighths', 0.5]], upbeats16: [['sixteenths', 0.5], ['offbeats', 0.4]],
    tresillo: [['sixteenths', 0.5]],
    pop: [['eighths', 0.4]], ballad16: [['sixteenths', 0.4], ['pop', 0.4]], sixeight: [['triplets', 0.4]], rock8: [['eighths', 0.4]],
    chuck24: [['pop', 0.4]], shuffle: [['triplets', 0.4]], funk: [['ballad16', 0.5], ['chuck24', 0.4]], arp8: [['eighths', 0.4]],
    chug8: [['eighths', 0.4]], chug16: [['sixteenths', 0.4]], gallop: [['chug16', 0.4]], revgallop: [['gallop', 0.4]],
    stops: [['chug16', 0.4]], syncopated: [['tresillo', 0.4]], threes: [['chug16', 0.5]], sixteenSext: [['chug16', 0.5], ['triplets', 0.5]],
    gap22: [['eighths', 0.5]], gap13: [['gap22', 0.5]], backbeat: [['eighths', 0.5]], oneonly: [['sixteenths', 0.5], ['gap22', 0.4]], offclick: [['offbeats', 0.5]],
  };
  const SHORT = {
    quarters: 'Qtr', eighths: '8ths', triplets: 'Trip', sixteenths: '16ths', ladder: 'Ladder', offbeats: 'Off', upbeats16: 'e · a', tresillo: '3+3+2',
    pop: 'Pop', ballad16: '抒情', sixeight: '6/8', rock8: 'Rock', chuck24: 'Chuck', shuffle: 'Shuffle', funk: 'Funk', arp8: 'Arp',
    chug8: '8 chug', chug16: '16 chug', gallop: 'Gallop', revgallop: 'Rev', stops: 'Stops', syncopated: 'Sync', threes: '3s', sixteenSext: '4↔6',
    gap22: 'Gap 2/2', gap13: 'Gap 1/3', backbeat: '2 & 4', oneonly: 'Beat 1', offclick: 'On &',
  };
  const CLICK_MODES = ['all', 'gap', '24', 'one', 'off'];

  // ---------- where each step falls ----------
  // A step's position within its bar, in beats. With swing (0.5 = straight, 2/3 = triplet swing),
  // the second 8th of each beat (grid 2), or the second 16th of each 8th (grid 4), comes later.
  function stepPos(grid, i, swing = 0.5) {
    const beat = Math.floor(i / grid);
    const sub = i % grid;
    let frac = sub / grid;
    if (swing !== 0.5) {
      if (grid === 2 && sub === 1) frac = swing;
      else if (grid === 4 && sub % 2 === 1) frac = Math.floor(sub / 2) * 0.5 + swing * 0.5;
    }
    return beat + frac;
  }

  // Every step of one bar of a pattern: { i, beat, sub, grid, pos (beats), sym, hit, kind, dir, acc, count }.
  function barSteps(pattern, barIdx) {
    const bar = pattern.bars[barIdx % pattern.bars.length];
    const swing = pattern.swing || 0.5;
    return [...bar.hits].map((sym, i) => {
      const s = SYM[sym];
      const beat = Math.floor(i / bar.grid);
      const sub = i % bar.grid;
      const count = bar.counts ? bar.counts[i] : sub === 0 ? String(beat + 1) : COUNTS[bar.grid][sub];
      return { i, beat, sub, grid: bar.grid, pos: stepPos(bar.grid, i, swing), sym, hit: s.hit, kind: s.kind, dir: s.dir || null, acc: !!(bar.acc && bar.acc[i] === '>'), count };
    });
  }

  // The shortest gap between two steps of the pattern, in beats: sets the detector's dead time.
  function minGapBeats(pattern) {
    let min = 1;
    for (let b = 0; b < pattern.bars.length; b++) {
      const st = barSteps(pattern, b).filter((s) => s.hit);
      for (let k = 1; k < st.length; k++) min = Math.min(min, st[k].pos - st[k - 1].pos);
    }
    return min;
  }

  // Whether the click plays in this bar (the gap click silences some bars). barIdx counts from 0.
  function clickOn(click, barIdx) {
    if (!click || click.mode !== 'gap') return true;
    const on = click.on || 2;
    const off = click.off || 2;
    return barIdx % (on + off) < on;
  }

  // What the click plays in one bar: [{ pos (beats), accent }].
  function clickBar(click, meter, barIdx, swing = 0.5) {
    const mode = (click && click.mode) || 'all';
    if (!clickOn(click, barIdx)) return [];
    const beats = [...Array(meter).keys()];
    if (mode === 'all' || mode === 'gap') return beats.map((b) => ({ pos: b, accent: b === 0 }));
    if (mode === 'one') return [{ pos: 0, accent: true }];
    if (mode === '24') {
      const back = meter === 4 ? [1, 3] : meter === 3 ? [1, 2] : beats.slice(1);
      return back.map((b) => ({ pos: b, accent: false }));
    }
    if (mode === 'off') return beats.map((b) => ({ pos: b + (swing !== 0.5 ? swing : 0.5), accent: false }));
    return [];
  }

  // A drum part instead of the click: [{ pos, drum: 'kick'|'snare'|'hat', vol }]. It follows the click
  // mode: full groove for every beat (and the gap's "on" bars), only the backbeat for 2 & 4, a kick
  // on 1 for beat-1-only, hats on the offbeats for the "&" click.
  function drumBar(click, meter, barIdx, swing = 0.5, grid = 2) {
    const mode = (click && click.mode) || 'all';
    if (!clickOn(click, barIdx)) return [];
    const out = [];
    const off = swing !== 0.5 ? swing : 0.5;
    if (mode === 'one') return [{ pos: 0, drum: 'kick', vol: 1 }];
    if (mode === '24') return clickBar(click, meter, barIdx).map((c) => ({ pos: c.pos, drum: 'snare', vol: 0.9 }));
    if (mode === 'off') return [...Array(meter).keys()].map((b) => ({ pos: b + off, drum: 'hat', vol: 0.8 }));
    if (meter === 2 && grid === 3) { // 6/8: hats on the 8ths, kick on 1, snare on 4
      for (let k = 0; k < 6; k++) out.push({ pos: k / 3, drum: 'hat', vol: k % 3 === 0 ? 0.7 : 0.45 });
      out.push({ pos: 0, drum: 'kick', vol: 1 }, { pos: 1, drum: 'snare', vol: 0.85 });
      return out;
    }
    for (let b = 0; b < meter; b++) {
      out.push({ pos: b, drum: 'hat', vol: 0.65 }, { pos: b + off, drum: 'hat', vol: 0.4 });
      if (meter === 4 ? b % 2 === 0 : b === 0) out.push({ pos: b, drum: 'kick', vol: b === 0 ? 1 : 0.85 });
      else out.push({ pos: b, drum: 'snare', vol: 0.85 });
    }
    return out;
  }

  // ---------- the grader ----------
  const MAX_WIN = 0.15; // s: an attack further than this from every step is a stray, not a hit

  class Grader {
    constructor() {
      this.steps = []; // in time order; each: { t, hit, kind, acc, pass, bar, ..., played: { off, db } | null, done }
      this.extras = []; // { t, off, db, kind: ghost|rest|tie|double|stray, step }
      this.next = 0; // first step not yet finalized
      this.closed = new Set(); // passes that have been reported
    }

    // Steps of one bar, already timed (each needs t). Must come in time order.
    addSteps(steps) {
      for (const s of steps) this.steps.push({ ...s, played: null, done: false });
    }

    // The step nearest to time t, and how far the attack may be from it on that side.
    nearest(t) {
      const st = this.steps;
      if (!st.length) return null;
      let lo = 0;
      let hi = st.length - 1;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (st[mid].t < t) lo = mid + 1; else hi = mid; }
      let k = lo;
      if (k > 0 && Math.abs(st[k - 1].t - t) <= Math.abs(st[k].t - t)) k--;
      const s = st[k];
      const prev = st[k - 1];
      const next = st[k + 1];
      const gap = t < s.t ? (prev ? s.t - prev.t : MAX_WIN * 2) : (next ? next.t - s.t : MAX_WIN * 2);
      return { k, s, win: Math.min(MAX_WIN, gap / 2) };
    }

    // An attack at time t (latency already removed). Returns what it was:
    // { kind: 'hit', step, off } | { kind: 'extra', why, step, off } | { kind: 'before' } (count-in).
    onset({ t, db = 0 }) {
      if (!this.steps.length || t < this.steps[0].t - MAX_WIN) return { kind: 'before' };
      const n = this.nearest(t);
      const off = t - n.s.t;
      if (Math.abs(off) > n.win) { this.extras.push({ t, off, db, kind: 'stray', step: n.s }); return { kind: 'extra', why: 'stray', step: n.s, off }; }
      const s = n.s;
      if (!s.hit) { this.extras.push({ t, off, db, kind: s.kind, step: s }); return { kind: 'extra', why: s.kind, step: s, off }; }
      if (s.played) {
        // Two attacks for one step: the closer one is the hit, the other a double.
        if (Math.abs(off) < Math.abs(s.played.off)) {
          this.extras.push({ t: s.t + s.played.off, off: s.played.off, db: s.played.db, kind: 'double', step: s });
          s.played = { off, db };
          return { kind: 'hit', step: s, off, replaced: true };
        }
        this.extras.push({ t, off, db, kind: 'double', step: s });
        return { kind: 'extra', why: 'double', step: s, off };
      }
      s.played = { off, db };
      return { kind: 'hit', step: s, off };
    }

    // Finalize steps whose window has passed by `now`. Returns { missed: [steps], passes: [pass numbers now complete] }.
    flush(now) {
      const st = this.steps;
      const missed = [];
      while (this.next < st.length) {
        const s = st[this.next];
        const nx = st[this.next + 1];
        const win = Math.min(MAX_WIN, nx ? (nx.t - s.t) / 2 : MAX_WIN);
        if (s.t + win > now) break;
        s.done = true;
        if (s.hit && !s.played) missed.push(s);
        this.next++;
      }
      // A pass is complete once all its steps are done and a later pass has started.
      const passes = [];
      const firstOpen = this.next < st.length ? st[this.next].pass : Infinity;
      const known = new Set(st.slice(0, this.next).map((s) => s.pass));
      for (const p of [...known].sort((a, b) => a - b)) {
        if (p < firstOpen && !this.closed.has(p) && st.some((s) => s.pass > p)) { this.closed.add(p); passes.push(p); }
      }
      return { missed, passes };
    }

    passSteps(p) { return this.steps.filter((s) => s.pass === p); }
    passExtras(p) { return this.extras.filter((e) => e.step.pass === p); }
    doneSteps() { return this.steps.filter((s) => s.done); }
    doneExtras() { return this.extras.filter((e) => e.step.done); }
  }

  // ---------- statistics ----------
  const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  const sd = (a) => { if (a.length < 2) return 0; const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)); };
  const POS_NAME = { '': 'the beat', e: 'the “e”', '&': 'the “&”', a: 'the “a”', trip: 'the “trip”', let: 'the “let”', ta: 'the “ta”', ki: 'the “ki”' };

  // Least-squares slope of y on x.
  function slope(xs, ys) {
    const mx = mean(xs);
    const my = mean(ys);
    let num = 0;
    let den = 0;
    for (let i = 0; i < xs.length; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
    return den > 0 ? num / den : 0;
  }

  // Summary of a set of steps and extras. Offsets are reported in ms (positive = late).
  function summarize(steps, extras = []) {
    const exp = steps.filter((s) => s.hit);
    const hits = exp.filter((s) => s.played);
    const offs = hits.map((s) => s.played.off * 1000);
    const n = exp.length;
    const bias = mean(offs);
    const spread = sd(offs);
    const rms = Math.sqrt(bias * bias + spread * spread);
    const extraBy = { ghost: 0, rest: 0, tie: 0, double: 0, stray: 0 };
    for (const e of extras) extraBy[e.kind] = (extraBy[e.kind] || 0) + 1;

    // By position in the beat (grid and sub-step): where the hand is consistently early or late.
    const pos = {};
    for (const s of hits) {
      const key = `${s.grid}:${s.sub}`;
      if (!pos[key]) pos[key] = { grid: s.grid, sub: s.sub, name: s.sub === 0 ? 'the beat' : POS_NAME[COUNTS[s.grid][s.sub]] || `step ${s.sub + 1}`, offs: [], dirs: new Set() };
      pos[key].offs.push(s.played.off * 1000);
      if (s.dir) pos[key].dirs.add(s.dir);
    }
    const byPos = Object.values(pos).map((p) => ({ grid: p.grid, sub: p.sub, name: p.name, n: p.offs.length, mean: mean(p.offs), dir: p.dirs.size === 1 ? [...p.dirs][0] : null }))
      .sort((a, b) => a.grid - b.grid || a.sub - b.sub);

    // Accents: are the marked ones louder?
    const accDb = hits.filter((s) => s.acc).map((s) => s.played.db);
    const restDb = hits.filter((s) => !s.acc).map((s) => s.played.db);
    const accent = accDb.length >= 2 && restDb.length >= 2 ? { diff: mean(accDb) - mean(restDb), n: accDb.length } : null;

    // With and without the click (gap click): bias, spread, and the tempo you drifted to.
    const split = (on) => {
      const h = hits.filter((s) => s.clickOn === on);
      if (h.length < 3) return null;
      const o = h.map((s) => s.played.off * 1000);
      const out = { n: h.length, bias: mean(o), spread: sd(o) };
      if (!on) {
        // Drift within each silent stretch: how fast the offset grows, as a tempo.
        let wsum = 0;
        let ssum = 0;
        let dsum = 0;
        const blocks = {};
        for (const s of h) (blocks[s.gapBlock] = blocks[s.gapBlock] || []).push(s);
        for (const b of Object.values(blocks)) {
          if (b.length < 4) continue;
          const x = b.map((s) => s.t);
          const y = b.map((s) => s.played.off);
          ssum += slope(x, y) * b.length;
          dsum += (x[x.length - 1] - x[0]) * b.length;
          wsum += b.length;
        }
        if (wsum) {
          const sl = ssum / wsum; // s of offset per s of music
          const bpm = mean(h.map((s) => s.bpm || 0));
          out.slope = sl;
          out.bpm = bpm; // the click's tempo in those bars
          out.driftMs = sl * (dsum / wsum) * 1000; // how far the drift alone carries you by the end of a gap
          if (bpm) out.driftBpm = bpm / (1 + sl);
        }
      }
      return out;
    };

    const hitRate = n ? hits.length / n : 0;
    const timing = Math.min(1, Math.max(0, 1 - (rms - 10) / 40)); // 10 ms or better = 1, 50 ms = 0
    const extraN = extras.length;
    const score = n ? hitRate * (0.35 + 0.65 * timing) * (1 - 0.5 * Math.min(1, extraN / Math.max(4, n))) : 0;
    return {
      n, hits: hits.length, missed: n - hits.length, hitRate, extras: extraN, extraBy,
      bias, spread, rms, offs, byPos, accent,
      withClick: split(true), withoutClick: split(false),
      score,
    };
  }

  // A pass is clean when nearly every hit is there, there's at most one stray, and the time is tight.
  const CLEAN = { hitRate: 0.95, bias: 20, spread: 20 };
  function judgePass(st) {
    const extrasOk = st.extras <= (st.n >= 12 ? 1 : 0);
    const clean = st.n > 0 && st.hitRate >= CLEAN.hitRate && extrasOk && Math.abs(st.bias) <= CLEAN.bias && st.spread <= CLEAN.spread;
    const rough = st.hitRate < 0.8 || st.spread > 40 || Math.abs(st.bias) > 45;
    return { clean, rough };
  }

  // ---------- tempo ladder ----------
  // Clean passes in a row move the tempo up; two rough ones in a row move it down.
  const ladderStep = (bpm) => Math.max(2, Math.round(bpm * 0.04));
  class Ladder {
    constructor({ need = 2 } = {}) { this.need = need; this.clean = 0; this.rough = 0; }
    update(verdict, bpm) {
      if (verdict.clean) { this.clean++; this.rough = 0; } else if (verdict.rough) { this.rough++; this.clean = 0; } else { this.clean = 0; this.rough = 0; }
      if (this.clean >= this.need) { this.clean = 0; return ladderStep(bpm); }
      if (this.rough >= 2) { this.rough = 0; return -ladderStep(bpm); }
      return 0;
    }
  }

  // ---------- tips ----------
  // A few concrete things to work on, most important first: [{ level: 'star'|'warn'|'', text }].
  // bpm: the click's tempo, to compare the silent bars of a gap click with.
  function tips(st, { bpm = 0 } = {}) {
    const out = [];
    const ms = (v) => `${Math.round(Math.abs(v))} ms`;
    if (!st.n) return out;
    if (st.hits < 4) {
      out.push({ level: 'warn', text: 'Hardly any hits came through. Check the input level on the Hearing card, or raise Hit sensitivity.' });
      return out;
    }
    if (st.missed / st.n > 0.15) out.push({ level: 'warn', text: `${st.missed} of ${st.n} hits were missing. If you played them, raise Hit sensitivity; if not, slow down until the pattern is automatic.` });
    if (st.bias < -12) out.push({ level: 'warn', text: `You’re rushing: on average ${ms(st.bias)} ahead of the beat. Relax and let the beat come to you; think “lay back”.` });
    else if (st.bias > 12) out.push({ level: 'warn', text: `You’re dragging: on average ${ms(st.bias)} behind the beat. Anticipate a little: feel the beat arrive with your strum, not before it.` });
    if (st.spread > 25) out.push({ level: 'warn', text: `Your hits scatter by ±${ms(st.spread)}. Drop the tempo about 10 bpm and keep the strumming hand moving even when it doesn’t hit.` });

    // A position in the beat that is off compared with the others.
    const pos = st.byPos.filter((p) => p.n >= 4);
    if (pos.length >= 2) {
      let worst = null;
      for (const p of pos) {
        const rel = p.mean - st.bias;
        if (Math.abs(rel) >= 12 && (!worst || Math.abs(rel) > Math.abs(worst.rel))) worst = { ...p, rel };
      }
      if (worst) {
        const what = worst.dir === 'up' ? ` (your up-strokes)` : worst.dir === 'down' && worst.sub !== 0 ? ' (down-strokes)' : '';
        out.push({ level: 'warn', text: `${worst.name[0].toUpperCase()}${worst.name.slice(1)}${what} lands ${ms(worst.rel)} ${worst.rel < 0 ? 'early' : 'late'} compared with the rest. Count it out loud and aim for it.` });
      }
    }
    if (st.extraBy.ghost >= 2) out.push({ level: 'warn', text: `You hit the strings ${st.extraBy.ghost}× on ghost strokes. Keep the motion, but lift the pick a few millimetres over the strings there.` });
    if (st.extraBy.rest >= 2) out.push({ level: 'warn', text: `Sound in the rests (${st.extraBy.rest}×). Mute the strings with your palm or fretting hand when the pattern stops.` });
    if (st.extraBy.double >= 3) out.push({ level: '', text: `Some strums registered twice (${st.extraBy.double}×). Strum through the strings in one quick motion, or lower Hit sensitivity a little.` });
    if (st.accent && st.accent.diff < 2.5) out.push({ level: 'warn', text: `The accents barely stand out (${st.accent.diff >= 0 ? '+' : ''}${st.accent.diff.toFixed(1)} dB). Dig in on the marked strums and play the others lighter.` });
    const wo = st.withoutClick;
    if (wo && wo.driftBpm && (wo.bpm || bpm)) {
      bpm = wo.bpm || bpm;
      const d = wo.driftBpm;
      const fmt = (v) => (Math.abs(v - Math.round(v)) < 0.05 || Math.abs(v - bpm) >= 3 ? String(Math.round(v)) : v.toFixed(1));
      if (Math.abs(wo.driftMs) >= 25) {
        out.push({ level: 'warn', text: `In the silent bars you ${d > bpm ? 'sped up' : 'slowed down'} to about ${fmt(d)} bpm (the click was ${Math.round(bpm)}). By the end of a gap that put you ${ms(wo.driftMs)} ${wo.driftMs < 0 ? 'ahead' : 'behind'}.` });
      } else {
        out.push({ level: 'star', text: `In the silent bars you held the tempo: about ${fmt(d)} bpm, within ${ms(Math.max(Math.abs(wo.driftMs), 1))} by the end of a gap.` });
      }
    }
    if (!out.length || (st.hitRate >= 0.95 && Math.abs(st.bias) <= 10 && st.spread <= 15)) {
      out.unshift({ level: 'star', text: `Locked in: ${Math.round(st.hitRate * 100)}% of hits, ${ms(st.bias)} ${st.bias < 0 ? 'early' : 'late'} on average, ±${ms(st.spread)} spread. Take the tempo up.` });
    }
    return out.slice(0, 5);
  }

  // How one hit is described, from its offset in seconds.
  function feel(off) {
    const v = off * 1000;
    const a = Math.abs(v);
    if (a <= 10) return { cls: 'good', text: 'on the beat' };
    if (a <= 25) return { cls: 'good', text: `${Math.round(a)} ms ${v < 0 ? 'early' : 'late'}` };
    if (a <= 45) return { cls: 'meh', text: `${Math.round(a)} ms ${v < 0 ? 'early' : 'late'}` };
    return { cls: 'bad', text: `${Math.round(a)} ms ${v < 0 ? 'early' : 'late'}` };
  }

  const api = { SYM, COUNTS, GRID_NAME, CATS, PATTERNS, NEEDS, SHORT, CLICK_MODES, byId, alt, stepPos, barSteps, minGapBeats, clickOn, clickBar, drumBar, Grader, MAX_WIN, summarize, judgePass, CLEAN, Ladder, ladderStep, tips, feel, mean, sd };
  root.Rhythm = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
