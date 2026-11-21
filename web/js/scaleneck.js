// The Scales page's logic (no DOM): CAGED names for the scale positions and the chord grip each one
// is built around, every placement of every shape across the whole neck, routes that travel the
// neck (shape ladder, diagonal, one string), backing progressions per genre, an estimate of where on
// the neck a heard pitch was played, and the play-along stats.
//
// The shapes themselves come from scales.js (computed from pitches, right in every key). This file
// adds the neck-wide view on top of them.
(function (root) {
  'use strict';
  const T = root.Theory;
  const S = root.Scales;
  const { mod12 } = T;
  const MAX_FRET = 22;
  const STD = T.TUNINGS.standard;
  const STRINGS_LOW_FIRST = [6, 5, 4, 3, 2, 1];

  // ---------- keys, genres, scales ----------
  // keys: the keys most songs in the genre are in, for guitar (pitch classes, most common first).
  const GENRES = {
    blues: { name: 'Blues', keys: [9, 4, 7, 0, 2], scales: ['minPent', 'blues', 'majPent', 'mixolydian', 'dorian'], scale: 'minPent', bpm: 84 },
    rock: { name: 'Rock', keys: [4, 9, 2, 7, 0], scales: ['minPent', 'aeolian', 'majPent', 'ionian', 'mixolydian', 'dorian'], scale: 'minPent', bpm: 112 },
    metal: { name: 'Metal', keys: [4, 2, 0, 11, 6], scales: ['aeolian', 'phrygian', 'harmMinor', 'phrygDom', 'minPent', 'blues'], scale: 'aeolian', bpm: 132 },
    pop: { name: 'Pop · 流行', keys: [0, 7, 2, 4, 5, 9], scales: ['majPent', 'ionian', 'minPent', 'aeolian', 'lydian'], scale: 'majPent', bpm: 92 },
    ballad: { name: 'Ballad · 抒情', keys: [0, 7, 2, 5, 10], scales: ['ionian', 'majPent', 'aeolian', 'minPent'], scale: 'ionian', bpm: 70 },
  };
  const SCALE_GROUPS = [
    ['Pentatonic & blues', ['minPent', 'majPent', 'blues']],
    ['Major & minor', ['ionian', 'aeolian']],
    ['Modes', ['dorian', 'mixolydian', 'phrygian', 'lydian']],
    ['Exotic & metal', ['harmMinor', 'phrygDom']],
  ];

  // The scale's tonic chord: minor if it has a ♭3 and no 3.
  const isMinorTonic = (scaleId) => {
    const st = S.SCALES[scaleId].steps;
    return st.includes(3) && !st.includes(4);
  };
  const FLAT_MAJORS = [5, 10, 3, 8, 1, 6];
  const preferFlat = (pc, minor) => FLAT_MAJORS.includes(minor ? mod12(pc + 3) : mod12(pc));
  // The scale's note names spelled by degree, and the tonic's name with them: A Phrygian is
  // A B♭ C D E F G, D harmonic minor has B♭ and C♯. → { root, names, flat, byPc }
  const spell = (pc, scaleId) => S.spellScale(pc, scaleId, preferFlat(pc, isMinorTonic(scaleId)));
  const keyName = (pc, scaleId) => spell(pc, scaleId).root;

  // ---------- CAGED ----------
  // Box k of a scale sits around the tonic chord's barre grip of one CAGED letter. Scales whose
  // positions follow the tonic's minor pentatonic ('min') go E D C A G for boxes 1–5; those that
  // follow the relative minor's boxes ('maj', so C major lines up with A minor) go G E D C A.
  const LETTERS = { min: ['E', 'D', 'C', 'A', 'G'], maj: ['G', 'E', 'D', 'C', 'A'] };
  const cagedLetter = (scaleId, k) => LETTERS[S.SCALES[scaleId].ref][k - 1];

  // The open chord each letter names, moved up the neck: the string the root is on, and each
  // string's fret offset from that root fret (low E first; null = not played).
  const GRIPS = {
    maj: {
      E: { rs: 6, off: [0, 2, 2, 1, 0, 0] },
      A: { rs: 5, off: [null, 0, 2, 2, 2, 0] },
      D: { rs: 4, off: [null, null, 0, 2, 3, 2] },
      C: { rs: 5, off: [null, 0, -1, -3, -2, -3] },
      G: { rs: 6, off: [0, -1, -3, -3, -3, 0] },
    },
    min: {
      E: { rs: 6, off: [0, 2, 2, 0, 0, 0] },
      A: { rs: 5, off: [null, 0, 2, 2, 1, 0] },
      D: { rs: 4, off: [null, null, 0, 2, 3, 1] },
      C: { rs: 5, off: [null, 0, -2, -3, -2, 0] },
      G: { rs: 6, off: [0, -2, -3, -3, 0, 0] },
    },
  };
  const ROOT_STRING_NAME = { 6: 'low E', 5: 'A', 4: 'D' };

  // The grip of `letter` for the chord on keyPc, placed nearest fret `near` (the shape's middle).
  function grip(keyPc, minor, letter, near = 5, { tuning = STD, maxFret = MAX_FRET } = {}) {
    const g = GRIPS[minor ? 'min' : 'maj'][letter];
    if (!g) return null;
    const r0 = mod12(keyPc - tuning.open[g.rs]);
    let best = null;
    for (const r of [r0, r0 + 12, r0 + 24]) {
      const notes = [];
      STRINGS_LOW_FIRST.forEach((s, i) => {
        if (g.off[i] == null) return;
        const f = r + g.off[i];
        notes.push({ s, f, midi: tuning.open[s] + f });
      });
      if (notes.some((n) => n.f < 0 || n.f > maxFret)) continue;
      const { lo, hi } = S.span(notes);
      const d = Math.abs((lo + hi) / 2 - near);
      if (!best || d < best.d) best = { notes, lo, hi, d, rootFret: r };
    }
    if (!best) return null;
    return {
      letter, rootString: g.rs, rootFret: best.rootFret, lo: best.lo, hi: best.hi,
      notes: S.annotateChord(best.notes, keyPc, minor ? 'min' : 'maj'),
    };
  }

  // ---------- shapes across the neck ----------
  // Every placement of every shape that fits on the neck, ordered up the neck:
  // [{ idx, k, alt, letter, lo, hi, notes }]. system: 'caged' (5 positions) or 'nps3' (3 notes per string).
  function shapeList(keyPc, scaleId, system = 'caged', { tuning = STD, maxFret = MAX_FRET } = {}) {
    const out = [];
    const K = system === 'nps3' ? S.SCALES[scaleId].steps.length : 5;
    for (let k = 1; k <= K; k++) {
      const get = (alt) => (system === 'nps3'
        ? S.nps(keyPc, scaleId, k, { tuning, maxFret, alt })
        : S.position(keyPc, scaleId, k, { tuning, maxFret, alt }));
      const first = get(0);
      if (!first) continue;
      for (let a = 0; a < first.alts; a++) {
        const p = a === 0 ? first : get(a);
        if (!p || out.some((q) => q.k === k && q.lo === p.lo)) continue;
        out.push({ k, alt: a, lo: p.lo, hi: p.hi, notes: p.notes, letter: system === 'nps3' ? null : cagedLetter(scaleId, k) });
      }
    }
    out.sort((a, b) => a.lo - b.lo || a.hi - b.hi || a.k - b.k);
    out.forEach((p, i) => { p.idx = i; });
    return out;
  }

  // Which placement a (k, alt) choice is, or the nearest one with that k.
  function findShape(shapes, k, alt = 0) {
    return shapes.find((p) => p.k === k && p.alt === alt) || shapes.find((p) => p.k === k) || shapes[0] || null;
  }

  function neckPitches(keyPc, steps, tuning, maxFret) {
    const pcs = S.pcsOf(keyPc, steps);
    const raw = [];
    for (const s of STRINGS_LOW_FIRST) {
      for (let f = 0; f <= maxFret; f++) {
        const midi = tuning.open[s] + f;
        if (pcs.has(mod12(midi))) raw.push({ s, f, midi });
      }
    }
    return raw;
  }

  // Every note of the scale or chord on the neck, with its degree and color role.
  function neckNotes(keyPc, scaleId, { tuning = STD, maxFret = MAX_FRET } = {}) {
    return S.annotateScale(neckPitches(keyPc, S.SCALES[scaleId].steps, tuning, maxFret), keyPc, scaleId);
  }
  function chordNotes(root, chordId, { tuning = STD, maxFret = MAX_FRET } = {}) {
    return S.annotateChord(neckPitches(root, S.CHORDS[chordId].steps, tuning, maxFret), root, chordId);
  }

  // 3 notes per string only makes positions for 7-note scales (a pentatonic with 3 per string runs
  // diagonally instead).
  const hasNps = (scaleId) => S.SCALES[scaleId].steps.length === 7;
  const shapeLabel = (p) => (p.letter ? `${p.letter} shape` : `Pattern ${p.k}`);
  const shapeNumber = (p, scaleId) => (p.letter
    ? `${S.SCALES[scaleId].steps.length <= 6 ? 'box' : 'position'} ${p.k}`
    : `3 notes per string, from the ${S.degreeLabel(S.SCALES[scaleId].steps[p.k - 1], { scaleId })}`);

  // ---------- routes up and down the neck ----------
  // Joins segments into one looping sequence. A note that would repeat the one before it (where a
  // segment turns around, or at the loop's seam) is played once. Each note keeps its segment index.
  function joinSegments(segs) {
    const notes = [];
    segs.forEach((seg, si) => {
      seg.notes.forEach((n, j) => {
        const prev = notes[notes.length - 1];
        if (j === 0 && prev && prev.midi === n.midi) return;
        notes.push({ ...n, seg: si });
      });
    });
    while (notes.length > 2 && notes[notes.length - 1].midi === notes[0].midi) notes.pop();
    return notes;
  }

  // Up the first shape, down the next, up the next … turn around in the top shape, and come back
  // down the same way: you shift between neighbouring shapes on the high e and the low E strings.
  // shapes: the neck-ordered list; from: index of the lowest shape; span: how many shapes.
  function ladder(shapes, from, span) {
    const list = shapes.slice(from, from + span);
    if (list.length < 2) return null;
    const order = list.map((p, i) => ({ shape: p, dir: i % 2 === 0 ? 'up' : 'down' }));
    const flip = (d) => (d === 'up' ? 'down' : 'up');
    order.push({ shape: list[list.length - 1], dir: flip(order[order.length - 1].dir) });
    for (let i = list.length - 2; i >= 0; i--) order.push({ shape: list[i], dir: flip(order[order.length - 1].dir) });
    const notes = joinSegments(order.map(({ shape, dir }) => ({ notes: dir === 'up' ? shape.notes : [...shape.notes].reverse() })));
    return { segs: order, notes, shapes: list, lo: Math.min(...list.map((p) => p.lo)), hi: Math.max(...list.map((p) => p.hi)) };
  }

  // A diagonal run: n notes on every string (3 for pentatonics and the blues scale, 4 for 7-note
  // scales), from the start shape's lowest note on the low E string, so the hand climbs about two
  // shapes over six strings. Up and back down.
  function diagonal(keyPc, scaleId, start, { tuning = STD, maxFret = MAX_FRET } = {}) {
    const steps = S.SCALES[scaleId].steps;
    const n = steps.length >= 7 ? 4 : 3;
    const pcs = S.pcsOf(keyPc, steps);
    const low = start.notes.find((x) => x.s === 6) || start.notes[0];
    let best = null;
    for (const o of [0, -12, 12]) {
      const all = S.perString(pcs, low.midi + o, n, tuning);
      if (all[0].f < 0) continue;
      const cut = all.findIndex((x) => x.f > maxFret);
      const run = cut < 0 ? all : all.slice(0, cut - (cut % n));
      if (run.length < 4 * n) continue;
      if (!best || run.length > best.length) best = run;
      if (o === 0 && run.length === 6 * n) break;
    }
    if (!best) return null;
    const run = S.annotateScale(best, keyPc, scaleId);
    const seq = [...run, ...run.slice(1, -1).reverse()];
    return { run, notes: seq.map((x) => ({ ...x, seg: 0 })), perString: n, ...S.span(run) };
  }

  // The scale along one string, root to the root an octave up, and back. Where the octave doesn't
  // fit on the neck, from the open string up to the root.
  function oneStringRun(keyPc, scaleId, s, { tuning = STD, maxFret = MAX_FRET } = {}) {
    const r = mod12(keyPc - tuning.open[s]);
    const [from, to] = r + 12 <= maxFret ? [r, r + 12] : [0, r];
    const line = S.oneString(keyPc, scaleId, s, from, to, { tuning });
    if (line.length < 4) return null;
    const seq = [...line, ...line.slice(1, -1).reverse()];
    return { run: line, notes: seq.map((x) => ({ ...x, seg: 0 })), lo: from, hi: to };
  }

  // Shapes visited in turn when the play-along moves through them: up, then back down.
  function cycleOrder(count) {
    const out = [];
    for (let i = 0; i < count; i++) out.push(i);
    for (let i = count - 2; i >= 1; i--) out.push(i);
    return out;
  }

  // ---------- backing for the play-along ----------
  // chords: [semitones above the tonic, chord] per bar. groove: the band's style (shuffle = the
  // blues band; rock, metal, pop, ballad = the song band's grooves; drone = a held root and 5th).
  // fits: the scales that sound right over the progression. Outside the blues, a 7-note scale listed
  // here contains every chord tone. Over a dominant blues, Mixolydian fits the I7 and Dorian the IV7
  // (the 3rd is major over one and minor over the other), which is the sound of the style.
  const PENT_MIN = ['minPent', 'blues'];
  const BACKINGS = [
    { id: 'blues12', genre: 'blues', name: '12-bar blues', groove: 'shuffle', chords: [[0, 'dom7'], [0, 'dom7'], [0, 'dom7'], [0, 'dom7'], [5, 'dom7'], [5, 'dom7'], [0, 'dom7'], [0, 'dom7'], [7, 'dom7'], [5, 'dom7'], [0, 'dom7'], [7, 'dom7']], fits: [...PENT_MIN, 'majPent', 'mixolydian', 'dorian'] },
    { id: 'quick12', genre: 'blues', name: 'Quick-change 12-bar', groove: 'shuffle', chords: [[0, 'dom7'], [5, 'dom7'], [0, 'dom7'], [0, 'dom7'], [5, 'dom7'], [5, 'dom7'], [0, 'dom7'], [0, 'dom7'], [7, 'dom7'], [5, 'dom7'], [0, 'dom7'], [7, 'dom7']], fits: [...PENT_MIN, 'majPent', 'mixolydian', 'dorian'] },
    { id: 'vamp7', genre: 'blues', name: 'One-chord vamp (I7)', groove: 'shuffle', chords: [[0, 'dom7']], fits: [...PENT_MIN, 'majPent', 'mixolydian', 'dorian'] },
    { id: 'rockMin', genre: 'rock', name: 'i – ♭VI – ♭VII – i', groove: 'rock', chords: [[0, 'min'], [8, 'maj'], [10, 'maj'], [0, 'min']], fits: [...PENT_MIN, 'aeolian'] },
    { id: 'rockMin2', genre: 'rock', name: 'i – ♭VII – ♭VI – ♭VII', groove: 'rock', chords: [[0, 'min'], [10, 'maj'], [8, 'maj'], [10, 'maj']], fits: [...PENT_MIN, 'aeolian'] },
    { id: 'rockMixo', genre: 'rock', name: 'I – ♭VII – IV – I', groove: 'rock', chords: [[0, 'maj'], [10, 'maj'], [5, 'maj'], [0, 'maj']], fits: ['mixolydian', 'majPent', ...PENT_MIN] },
    { id: 'rockMaj', genre: 'rock', name: 'I – V – vi – IV', groove: 'rock', chords: [[0, 'maj'], [7, 'maj'], [9, 'min'], [5, 'maj']], fits: ['ionian', 'majPent'] },
    { id: 'dorianVamp', genre: 'rock', name: 'Dorian vamp i7 – IV', groove: 'rock', chords: [[0, 'min7'], [5, 'maj']], fits: ['dorian', ...PENT_MIN] },
    { id: 'metalMin', genre: 'metal', name: 'i – i – ♭VI – ♭VII', groove: 'metal', chords: [[0, 'min'], [0, 'min'], [8, 'maj'], [10, 'maj']], fits: ['aeolian', ...PENT_MIN] },
    { id: 'metalPhryg', genre: 'metal', name: 'Phrygian i – ♭II', groove: 'metal', chords: [[0, 'min'], [1, 'maj'], [0, 'min'], [1, 'maj']], fits: ['phrygian', 'minPent'] },
    { id: 'metalHarm', genre: 'metal', name: 'Harmonic minor i – ♭VI – V', groove: 'metal', chords: [[0, 'min'], [8, 'maj'], [7, 'maj'], [7, 'maj']], fits: ['harmMinor'] },
    { id: 'metalPhrygDom', genre: 'metal', name: 'Phrygian dominant I – ♭II', groove: 'metal', chords: [[0, 'maj'], [1, 'maj'], [0, 'maj'], [1, 'maj']], fits: ['phrygDom'] },
    { id: 'popAxis', genre: 'pop', name: 'I – V – vi – IV', groove: 'pop', chords: [[0, 'maj'], [7, 'maj'], [9, 'min'], [5, 'maj']], fits: ['ionian', 'majPent'] },
    { id: 'popRoyal', genre: 'pop', name: '王道 IV – V – iii – vi', groove: 'pop', chords: [[5, 'maj'], [7, 'maj'], [4, 'min'], [9, 'min']], fits: ['ionian', 'majPent'] },
    { id: 'popMin', genre: 'pop', name: 'i – ♭VI – ♭III – ♭VII', groove: 'pop', chords: [[0, 'min'], [8, 'maj'], [3, 'maj'], [10, 'maj']], fits: ['aeolian', ...PENT_MIN] },
    { id: 'lydianVamp', genre: 'pop', name: 'Lydian I – II', groove: 'pop', chords: [[0, 'maj'], [2, 'maj']], fits: ['lydian'] },
    { id: 'canon', genre: 'ballad', name: '卡农 Canon', groove: 'ballad', chords: [[0, 'maj'], [7, 'maj'], [9, 'min'], [4, 'min'], [5, 'maj'], [0, 'maj'], [5, 'maj'], [7, 'maj']], fits: ['ionian', 'majPent'] },
    { id: 'balladMin', genre: 'ballad', name: 'i – ♭VI – ♭III – ♭VII', groove: 'ballad', chords: [[0, 'min'], [8, 'maj'], [3, 'maj'], [10, 'maj']], fits: ['aeolian', ...PENT_MIN] },
    { id: 'drone', genre: '*', name: 'Drone on the root', groove: 'drone', chords: [[0, null]], fits: Object.keys(S.SCALES) },
  ];
  const backingById = (id) => BACKINGS.find((b) => b.id === id) || BACKINGS[BACKINGS.length - 1];
  // The genre's backings (and the drone), the ones that fit the scale first.
  function backingsFor(genre, scaleId) {
    const list = BACKINGS.filter((b) => b.genre === genre || b.genre === '*');
    const fit = (b) => b.fits.includes(scaleId);
    return [...list.filter(fit), ...list.filter((b) => !fit(b))].map((b) => ({ ...b, fit: fit(b) }));
  }
  // The best backing for a genre and scale: one that fits from the genre, else the drone.
  function defaultBacking(genre, scaleId) {
    const b = backingsFor(genre, scaleId).find((x) => x.fit && x.groove !== 'drone');
    return b ? b.id : 'drone';
  }

  // Bars as chords in a key: [{ root, chordId, pcs, name, sym }]. sym: the chord as a 简谱 number
  // for the song band ('1m', '♭6'); roman: the blues band's 'I' / 'IV' / 'V'.
  const DEGREE_SYM = ['1', '♭2', '2', '♭3', '3', '4', '♭5', '5', '♭6', '6', '♭7', '7'];
  const QUAL_SYM = { maj: '', min: 'm', dom7: '7', min7: 'm7' };
  const ROMAN = { 0: 'I', 5: 'IV', 7: 'V' };
  // tonic: the key's name as shown on the page; chord roots are spelled from it by degree (the ♭II of
  // A is B♭, the ♭VI of E♭ minor is C♭).
  function backingBars(backing, keyPc, flat, tonic = T.noteName(keyPc, flat)) {
    return backing.chords.map(([off, chordId]) => {
      const root = mod12(keyPc + off);
      const rootName = S.rootNameIn(tonic, off, flat);
      if (!chordId) return { root, chordId: null, pcs: [root, mod12(root + 7)], name: `${rootName} drone`, sym: '1', roman: 'I' };
      return {
        root, chordId, pcs: S.CHORDS[chordId].steps.map((x) => mod12(root + x)),
        name: rootName + S.CHORDS[chordId].sym, sym: DEGREE_SYM[off] + QUAL_SYM[chordId], roman: ROMAN[off] || 'I',
      };
    });
  }

  // ---------- where a heard pitch was played ----------
  // From the hand position alone. Pages that load js/stringid.js use its StringLocator instead,
  // which adds each note's sound; this stays as the fallback. Most pitches can be played in two or three places; this picks
  // the one nearest where the hand has been (inside the shape you're asked to stay in, if any),
  // and moves its estimate of the hand toward each note.
  class HandTracker {
    constructor({ tuning = STD, maxFret = MAX_FRET } = {}) {
      this.tuning = tuning;
      this.maxFret = maxFret;
      this.center = null;
    }
    reset() { this.center = null; }
    place(midi, win = null) {
      const mid = win ? (win.lo + win.hi) / 2 : null;
      const c = this.center != null ? (mid != null ? 0.5 * this.center + 0.5 * mid : this.center) : mid != null ? mid : 5;
      let best = null;
      for (const s of STRINGS_LOW_FIRST) {
        const f = Math.round(midi) - this.tuning.open[s];
        if (f < 0 || f > this.maxFret) continue;
        let cost = Math.abs(f - c);
        if (win && (f < win.lo - 1 || f > win.hi + 1)) cost += 3;
        if (!best || cost < best.cost) best = { s, f, cost };
      }
      if (!best) return null;
      this.center = this.center == null ? best.f : 0.6 * this.center + 0.4 * best.f;
      return { s: best.s, f: best.f };
    }
  }

  // The shape a placed note belongs to: one that contains it (the one nearest the hand when two
  // overlap), else the nearest shape.
  function shapeAt(shapes, place, center = null) {
    if (!place || !shapes.length) return null;
    const c = center != null ? center : place.f;
    const mid = (p) => (p.lo + p.hi) / 2;
    const holding = shapes.filter((p) => p.notes.some((n) => n.s === place.s && n.f === place.f));
    const pool = holding.length ? holding : shapes;
    return pool.reduce((a, p) => (Math.abs(mid(p) - c) < Math.abs(mid(a) - c) ? p : a));
  }

  // ---------- play-along stats ----------
  // Every note: in the scale or not, a chord tone or not, and (for the first note near each beat 1)
  // whether it landed on a tone of the chord there. Also counts per fret and per shape.
  class JamStats {
    constructor(scalePcs) {
      this.pcs = new Set(scalePcs);
      this.total = 0;
      this.inScale = 0;
      this.chordTones = 0;
      this.landed = 0;
      this.landTotal = 0;
      this.judged = new Set();
      this.inShape = 0;
      this.shapeTotal = 0;
      this.byShape = {};
      this.frets = new Array(MAX_FRET + 1).fill(0);
      this.outNotes = {};
    }
    // at: { bar, beat } (beat 0–4 within the bar) or null; chord/next: { pcs } for this bar and the next.
    note(midi, { at = null, chord = null, next = null, place = null, shapeKey = null, inShape = null } = {}) {
      const pc = mod12(midi);
      const inScale = this.pcs.has(pc);
      this.total++;
      if (inScale) this.inScale++;
      else this.outNotes[pc] = (this.outNotes[pc] || 0) + 1;
      const chordTone = chord ? chord.pcs.includes(pc) : null;
      if (chordTone) this.chordTones++;
      let land = null;
      if (at && chord && (at.beat < 0.5 || at.beat > 3.75)) {
        const late = at.beat > 3.75; // just ahead of the next bar counts for that bar
        const bar = late ? at.bar + 1 : at.bar;
        const target = late ? next : chord;
        if (target && !this.judged.has(bar)) {
          this.judged.add(bar);
          this.landTotal++;
          land = target.pcs.includes(pc);
          if (land) this.landed++;
        }
      }
      if (place && place.f >= 0 && place.f <= MAX_FRET) this.frets[place.f]++;
      if (shapeKey != null) this.byShape[shapeKey] = (this.byShape[shapeKey] || 0) + 1;
      if (inShape != null) {
        this.shapeTotal++;
        if (inShape) this.inShape++;
      }
      return { inScale, chordTone, land };
    }
    // A note's place turned out to be elsewhere (string detection measured it after the fact).
    relocate(from, to, fromShape, toShape) {
      if (from && from.f >= 0 && from.f <= MAX_FRET && this.frets[from.f] > 0) this.frets[from.f]--;
      if (to && to.f >= 0 && to.f <= MAX_FRET) this.frets[to.f]++;
      if (fromShape != null && this.byShape[fromShape]) {
        if (--this.byShape[fromShape] === 0) delete this.byShape[fromShape];
      }
      if (toShape != null) this.byShape[toShape] = (this.byShape[toShape] || 0) + 1;
    }
    // The span of frets that holds most of what you played (the 80% around the busiest fret).
    range() {
      const tot = this.frets.reduce((a, b) => a + b, 0);
      if (!tot) return null;
      let lo = this.frets.findIndex((x) => x > 0);
      let hi = this.frets.length - 1 - [...this.frets].reverse().findIndex((x) => x > 0);
      let cut = 0;
      while (lo < hi && cut + this.frets[lo] <= tot * 0.1) cut += this.frets[lo++];
      cut = 0;
      while (hi > lo && cut + this.frets[hi] <= tot * 0.1) cut += this.frets[hi--];
      return { lo, hi };
    }
  }

  // Short tips after a play-along. shapes: the neck list; keyOf(p) → the byShape key of a shape.
  function jamTips(st, { shapes = [], keyOf = (p) => p.idx, nameOf = (pc) => T.noteName(pc), moving = false } = {}) {
    const out = [];
    if (st.total < 12) return out;
    const r = st.inScale / st.total;
    if (r < 0.85) {
      const worst = Object.entries(st.outNotes).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([pc]) => nameOf(Number(pc)));
      out.push({ kind: 'warn', text: `${Math.round((1 - r) * 100)}% of your notes were outside the scale (mostly ${worst.join(' and ')}). Slow down and aim for the colored dots.` });
    }
    if (st.landTotal >= 4) {
      const lr = st.landed / st.landTotal;
      if (lr < 0.5) out.push({ kind: 'warn', text: `Only ${st.landed} of ${st.landTotal} bars started on a chord tone. On beat 1, aim for the ringed notes of the chord that’s just arrived.` });
      else if (lr >= 0.75) out.push({ kind: 'star', text: `${st.landed} of ${st.landTotal} bars started on a chord tone: you’re hearing the changes.` });
    }
    const counts = shapes.map((p) => ({ p, n: st.byShape[keyOf(p)] || 0 }));
    const used = counts.filter((c) => c.n > 0).sort((a, b) => b.n - a.n);
    if (!moving && used.length) {
      const top = used[0];
      const share = top.n / st.total;
      if (share >= 0.7) {
        const i = shapes.indexOf(top.p);
        const nb = shapes[i + 1] || shapes[i - 1];
        out.push({ kind: 'warn', text: `${Math.round(share * 100)}% of your notes were around the ${shapeLabel(top.p)} (frets ${top.p.lo}–${top.p.hi}).${nb ? ` Spend the next chorus in the ${shapeLabel(nb)} next to it (frets ${nb.lo}–${nb.hi}).` : ''}` });
      } else if (used.length >= 3) {
        out.push({ kind: 'star', text: `You used ${used.length} shapes across the neck: ${used.slice(0, 4).map((c) => shapeLabel(c.p)).join(', ')}.` });
      }
    }
    if (moving && st.shapeTotal >= 12) {
      const sr = Math.round((st.inShape / st.shapeTotal) * 100);
      const good = sr >= 85;
      if (moving === 'stay') out.push({ kind: good ? 'star' : 'warn', text: good ? `${sr}% of your notes stayed in the shape. Next: let it move every 4 bars.` : `${sr}% of your notes stayed in the shape. The others were in the scale, but in a neighbouring shape: keep inside the colored dots.` });
      else out.push({ kind: good ? 'star' : 'warn', text: good ? `${sr}% of your notes fit the shape of the moment. Try moving every 2 bars.` : `${sr}% of your notes fit the shape of the moment. Look one bar ahead: the next shape is outlined above the neck.` });
    }
    const rg = st.range();
    if (rg && rg.hi - rg.lo <= 4 && st.total >= 30 && !moving) out.push({ kind: 'warn', text: `Nearly everything was between frets ${rg.lo} and ${rg.hi}. Try “Move every 4 bars” to make the neck bigger.` });
    return out;
  }

  const api = {
    MAX_FRET, GENRES, SCALE_GROUPS, LETTERS, GRIPS, ROOT_STRING_NAME, BACKINGS, chordNotes,
    isMinorTonic, preferFlat, spell, keyName, cagedLetter, grip, hasNps, shapeList, findShape, neckNotes, shapeLabel, shapeNumber,
    joinSegments, ladder, diagonal, oneStringRun, cycleOrder, backingById, backingsFor, defaultBacking, backingBars,
    HandTracker, shapeAt, JamStats, jamTips,
  };
  root.ScaleNeck = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
