// The daily session generator. No DOM.
//
// 1. A plan: the session's minutes are split into blocks (warm-up → technique → rhythm → fretboard →
//    scales → arpeggios → connect the neck → apply it → review), with 2-minute breaks about every
//    30 minutes.
// 2. Every exercise slot picks a candidate from the exercise families allowed in that block and your
//    focus. The weight follows a few rules: practice what's ready but not mastered, bring back what's
//    due (spaced repetition), cap brand-new material, and don't repeat a skill or family back to back.
// 3. The chosen candidate becomes a descriptor (key, position, sequence, rhythm …), and the descriptor
//    builds the notes from the shape engine (scales.js). The same descriptor always builds the same
//    exercise, so a plan is stored as descriptors.
// 4. A small learner model keeps, per skill, a mastery estimate (0–1, updated from the mic grades),
//    a review interval, and a tempo ladder per exercise pattern.
(function (root) {
  'use strict';
  const T = root.Theory;
  const S = root.Scales;
  // The rhythm patterns (js/rhythm.js): loaded by the page, or required in Node.
  const Rh = root.Rhythm || (typeof module !== 'undefined' && typeof require === 'function' ? require('./rhythm.js') : null);
  const { mod12 } = T;

  // ---------- randomness (seeded, so today's session is the same after a reload) ----------
  function hashStr(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function mulberry32(a) {
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
  function weighted(rng, items, w) {
    let sum = 0;
    const ws = items.map((x) => { const v = Math.max(0, w(x) || 0); sum += v; return v; });
    if (sum <= 0) return null;
    let r = rng() * sum;
    for (let i = 0; i < items.length; i++) { r -= ws[i]; if (r <= 0) return items[i]; }
    return items[items.length - 1];
  }
  const clamp01 = (x) => Math.max(0, Math.min(1, x));

  // ---------- dates and keys ----------
  const dayNum = (d) => { const [y, m, dd] = d.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, dd) / 86400000); };
  const daysBetween = (a, b) => dayNum(b) - dayNum(a);
  // The key of the day walks the circle of 4ths, one step a day.
  const keyOfDay = (date) => T.pcOf(T.CIRCLE_OF_FOURTHS[mod12(dayNum(date))]);
  const FLAT_MAJORS = [5, 10, 3, 8, 1, 6];
  const preferFlat = (pc, minor) => FLAT_MAJORS.includes(minor ? mod12(pc + 3) : mod12(pc));
  const nameOf = (pc, flat) => T.noteName(pc, flat);

  // ---------- rhythm ----------
  const RHYTHM = { 0.5: 'half notes', 1: 'quarter notes', 2: '8th notes', 3: 'triplets', 4: '16th notes', 6: 'sextuplets' };
  const START_BPM = { 0.5: 60, 1: 60, 2: 72, 3: 60, 4: 56, 6: 46 };
  const MIN_BPM = 40;
  const MAX_BPM = 220;
  const tempoStep = (npb) => (npb >= 4 ? 3 : 4);

  // ---------- sequences over a path of notes (ascending) ----------
  // Every pattern avoids playing the same note twice in a row, including where it loops.
  const SEQS = {
    straight: { name: 'up and down', minM: 0 },
    threes: { name: 'in 3s', minM: 0.35, group: 3 },
    fours: { name: 'in 4s', minM: 0.45, group: 4 },
    thirds: { name: 'in 3rds', minM: 0.5 },
    sixes: { name: 'descending 6s', minM: 0.55, group: 6 },
  };
  function seqIndices(n, id) {
    const out = [];
    if (id === 'straight' || n < 4) {
      for (let i = 0; i < n; i++) out.push(i);
      for (let i = n - 2; i >= 1; i--) out.push(i);
      return out;
    }
    if (id === 'threes' || id === 'fours') {
      const g = SEQS[id].group;
      for (let i = 0; i + g <= n; i++) for (let j = 0; j < g; j++) out.push(i + j);
      for (let i = n - 2; i >= g; i--) for (let j = 0; j < g; j++) out.push(i - j);
      return out;
    }
    if (id === 'thirds') {
      for (let i = 0; i + 2 < n; i++) out.push(i, i + 2);
      for (let i = n - 2; i >= 3; i--) out.push(i, i - 2);
      return out;
    }
    if (id === 'sixes') {
      for (let i = n - 1; i >= 5; i--) for (let j = 0; j < 6; j++) out.push(i - j);
      return out;
    }
    throw new Error(`Unknown sequence ${id}`);
  }
  const SEQ_NPB = { straight: 2, threes: 3, fours: 4, thirds: 2, sixes: 6 };
  const SEQ_HOW = {
    straight: 'Up the shape and back down in even notes. Strict alternate picking. Start slow enough to play it perfectly.',
    threes: 'Groups of three: 1-2-3, 2-3-4, 3-4-5 … then the same coming down. One group per beat, as triplets. Accent the first note of each group.',
    fours: 'Groups of four: 1-2-3-4, 2-3-4-5 … then back down. Four notes per beat (16ths). Accent each beat.',
    thirds: 'Skip a note: 1-3, 2-4, 3-5 … then back down. One pair per beat. Watch the string crossings.',
    sixes: 'Descending groups of six, one group per beat (sextuplets). Keep the picking hand moving the same way all the time.',
  };

  // ---------- progressions (root offset from the key, chord type) ----------
  const PROGS = {
    blues12: { name: '12-bar blues', mode: 'minor', scale: 'minPent', chords: [[0, 'dom7'], [5, 'dom7'], [0, 'dom7'], [0, 'dom7'], [5, 'dom7'], [5, 'dom7'], [0, 'dom7'], [0, 'dom7'], [7, 'dom7'], [5, 'dom7'], [0, 'dom7'], [7, 'dom7']] },
    quick4: { name: 'blues I7–IV7–I7–V7', mode: 'minor', scale: 'minPent', chords: [[0, 'dom7'], [5, 'dom7'], [0, 'dom7'], [7, 'dom7']] },
    rockMaj: { name: 'I–V–vi–IV', mode: 'major', scale: 'ionian', chords: [[0, 'maj'], [7, 'maj'], [9, 'min'], [5, 'maj']] },
    rockMin: { name: 'i–♭VI–♭VII–i', mode: 'minor', scale: 'aeolian', chords: [[0, 'min'], [8, 'maj'], [10, 'maj'], [0, 'min']] },
    andalusian: { name: 'i–♭VII–♭VI–V', mode: 'minor', scale: 'harmMinor', chords: [[0, 'min'], [10, 'maj'], [8, 'maj'], [7, 'maj']] },
    iiVI: { name: 'ii–V–I', mode: 'major', scale: 'ionian', chords: [[2, 'min7'], [7, 'dom7'], [0, 'maj7'], [0, 'maj7']] },
    I_IV_V: { name: 'I–IV–V–I', mode: 'major', scale: 'ionian', chords: [[0, 'maj'], [5, 'maj'], [7, 'maj'], [0, 'maj']] },
    i_iv_v: { name: 'i–iv–v–i', mode: 'minor', scale: 'aeolian', chords: [[0, 'min'], [5, 'min'], [7, 'min'], [0, 'min']] },
  };
  // How a progression's key is named. A dominant blues is named like a major key (A♭7 D♭7 E♭7, not
  // G♯7 C♯7 D♯7; F♯ rather than G♭); the others follow their mode.
  const BLUES_FLAT = [5, 10, 3, 8, 1];
  const progFlat = (progId, key) => (PROGS[progId].chords.every(([, c]) => c === 'dom7')
    ? BLUES_FLAT.includes(mod12(key)) : preferFlat(key, PROGS[progId].mode === 'minor'));
  // The key's name for a title. Where a blues is named differently from the day's minor key (A♭ blues
  // on a G♯ minor day), both names are shown.
  function progKeyName(progId, key, flat) {
    const name = nameOf(key, flat);
    const minorName = nameOf(key, preferFlat(key, true));
    return name === minorName ? name : `${name} / ${minorName}`;
  }
  // Chords spelled by letter: roots by their degree in the key (the ♭VI of E♭ minor is C♭), tones in
  // stacked thirds from the root (the 3rd of D7 is F♯). tones: one name per chord step; names: by pitch class.
  function chordsOf(progId, key, flat) {
    const tonic = nameOf(key, flat);
    return PROGS[progId].chords.map(([off, chordId]) => {
      const r = mod12(key + off);
      const rootName = S.rootNameIn(tonic, off, flat);
      const tones = S.spellChord(rootName, chordId);
      const pcs = S.CHORDS[chordId].steps.map((x) => mod12(r + x));
      const names = {};
      pcs.forEach((pc, i) => { names[pc] = tones[i]; });
      return { root: r, chordId, name: rootName + S.CHORDS[chordId].sym, pcs, tones, names };
    });
  }
  // The box windows a progression is played in: the key's minor pentatonic (its relative minor's for major keys).
  const windowRootOf = (progId, key) => (PROGS[progId].mode === 'major' ? mod12(key - 3) : key);

  // ---------- the learner model ----------
  // Starting points when there's no history yet, from the "Where are you now?" setting.
  // Anyone who strums chords can already play quarter notes and some 8ths.
  const RHYTHM_PRIORS = [[/^rhythm:quarters$/, 0.6], [/^rhythm:eighths$/, 0.45]];
  const PRIORS = {
    box1: [[/^box:minPent:1$/, 0.7], [/^box:blues:1$/, 0.35], [/^chromatic$/, 0.5], ...RHYTHM_PRIORS],
    boxes: [[/^box:minPent:/, 0.6], [/^box:blues:/, 0.4], [/^box:majPent:/, 0.3], [/^arp:(min|maj):/, 0.3], [/^chromatic$/, 0.6], [/^link:minPent:/, 0.3], ...RHYTHM_PRIORS],
    scales: [[/^box:/, 0.75], [/^pos:(aeolian|ionian):/, 0.6], [/^pos:/, 0.4], [/^nps3:aeolian:/, 0.45], [/^nps3:/, 0.3], [/^arp:(min|maj|dom7):/, 0.5], [/^arp:/, 0.35], [/^triads:/, 0.4], [/^chromatic$/, 0.7], [/^link:/, 0.5], ...RHYTHM_PRIORS],
  };

  class Learner {
    constructor(data = {}, { start = 'box1' } = {}) {
      this.skills = data.skills || {};
      this.tempos = data.tempos || {};
      this.start = PRIORS[start] ? start : 'box1';
    }
    toJSON() { return { skills: this.skills, tempos: this.tempos }; }
    prior(id) {
      for (const [re, v] of PRIORS[this.start]) if (re.test(id)) return v;
      return 0;
    }
    mastery(id) { const k = this.skills[id]; return k ? k.m : this.prior(id); }
    count(id) { const k = this.skills[id]; return k ? k.n : 0; }
    // Days until it's due for review (≤ 0 = due), or null if never practiced.
    dueIn(id, today) {
      const k = this.skills[id];
      if (!k || !k.last) return null;
      return k.interval - daysBetween(k.last, today);
    }
    // score: 0–1 from the grader (or your rating). The estimate moves faster for new skills.
    update(id, score, today, cand) {
      const k = this.skills[id] || { m: this.prior(id), n: 0, interval: 0, last: null };
      const a = k.n < 3 ? 0.4 : 0.25;
      k.m = clamp01(k.m + a * (score - k.m));
      k.n += 1;
      k.interval = score >= 0.85 ? Math.min(30, Math.max(1, k.interval) * 2.2)
        : score >= 0.6 ? Math.max(1, Math.min(k.interval, 4)) : 1;
      k.interval = Math.round(k.interval * 10) / 10;
      k.last = today;
      k.score = Math.round(score * 100) / 100;
      if (cand) k.cand = cand;
      this.skills[id] = k;
      return k;
    }
    // fallback: the exercise's own starting tempo, when it has one.
    tempo(key, npb, fallback = 0) {
      const t = this.tempos[key];
      return t && t.bpm ? t.bpm : fallback || START_BPM[npb] || 70;
    }
    best(key) { const t = this.tempos[key]; return t ? t.best || 0 : 0; }
    // Next time start where you ended clean (a step lower if it fell apart).
    saveTempo(key, { bpm, cleanBpm = 0, struggled = false }) {
      const t = this.tempos[key] || {};
      t.best = Math.max(t.best || 0, cleanBpm || 0);
      t.bpm = Math.max(MIN_BPM, Math.round(struggled ? bpm - 4 : cleanBpm || bpm));
      this.tempos[key] = t;
    }
  }

  // ---------- helpers for building exercises ----------
  const PERMS = (() => {
    const out = [];
    const rec = (a, rest) => { if (!rest.length) { out.push(a.join('')); return; } rest.forEach((x, i) => rec([...a, x], rest.filter((_, j) => j !== i))); };
    rec([], [1, 2, 3, 4]);
    return out;
  })();
  const STRING_NAME = { 1: 'high e', 2: 'B', 3: 'G', 4: 'D', 5: 'A', 6: 'low E' };
  const MODE_NAMES = ['dorian', 'mixolydian', 'phrygian', 'lydian', 'phrygDom'];
  const scaleTitle = (scaleId) => (MODE_NAMES.includes(scaleId) ? S.SCALES[scaleId].name : S.SCALES[scaleId].name.toLowerCase());
  const isMinorScale = (scaleId) => S.SCALES[scaleId].ref === 'min';
  // The key's name and its scale's note names, spelled by degree: { root, names, flat, byPc }.
  const spellKey = (key, scaleId) => S.spellScale(key, scaleId, preferFlat(key, isMinorScale(scaleId)));
  const uniqueDots = (notes) => {
    const seen = new Map();
    for (const n of notes) { const k = `${n.s}:${n.f}`; if (!seen.has(k)) seen.set(k, { s: n.s, f: n.f, midi: n.midi, role: n.role, label: n.label }); }
    return [...seen.values()];
  };
  function base(ex) {
    return {
      grade: 'seq', timing: true, matchPc: false, hidden: false, backing: null, chords: null, clock: false,
      allowed: null, allowMode: 'scale', land: null, flavorPc: null, fixedBpm: null, cues: [], names: null, ...ex,
    };
  }
  const CUES = [
    'Relax the fretting hand: press just hard enough for a clean note.',
    'Keep your fingers hovering close to the strings.',
    'Strict alternate picking: down-up, even across string changes.',
    'Say the degree names out loud for one pass.',
    'Play it quieter than you think. Clean beats loud.',
    'Mute the strings you aren’t playing: picking-hand palm and spare fretting fingers.',
    'One pass without looking at the fretboard.',
    'Shoulders down, breathe. Tension is the speed limit.',
    'Lock to the click: hear the click disappear under your notes.',
    'Play each note full length. No clipped notes on string changes.',
  ];

  // ---------- exercise families ----------
  // cands(ctx): candidates { fam, skill, base, need?: [[skill, min]], …params }.
  // make(c, ctx): resolves the random choices into a descriptor (plain JSON).
  // build(d, opts): the exercise (notes, dots, text …), or null if it doesn't fit on the neck.
  const FAM = {};

  FAM.chromatic = {
    name: 'Chromatic warm-up', blocks: ['warmup'], tags: ['*'],
    cands: () => [{ fam: 'chromatic', skill: 'chromatic', base: 3 }],
    make(c, ctx) {
      const m = ctx.learner.mastery(c.skill);
      return { ...c, perm: pick(ctx.rng, PERMS), fret: 1 + Math.floor(ctx.rng() * 7), npb: m < 0.55 ? 2 : 4 };
    },
    build(d, { tuning }) {
      const perm = d.perm.split('').map(Number);
      const notes = [];
      const N = (s, f, finger) => ({ s, f, midi: tuning.open[s] + f, role: 'other', label: String(finger) });
      for (const s of [6, 5, 4, 3, 2, 1]) for (const x of perm) notes.push(N(s, d.fret + x - 1, x));
      for (const s of [1, 2, 3, 4, 5, 6]) for (const x of [...perm].reverse()) notes.push(N(s, d.fret + x, x));
      return base({
        title: `Chromatic warm-up · fingers ${perm.join('-')}`,
        chips: [['Fret', `${d.fret}–${d.fret + 4}`], ['Rhythm', RHYTHM[d.npb]]],
        how: `One finger per fret from fret ${d.fret}. Play fingers ${perm.join('-')} on every string from low E to high e, move up one fret, and come back down with the order reversed.`,
        why: 'Wakes up all four fingers and syncs the picking hand with them. Different finger orders each day build independence, especially for the 3rd and 4th fingers.',
        notes, dots: uniqueDots(notes).map((x) => ({ ...x, label: '' })), npb: d.npb,
        tempoKey: `chromatic:${d.npb}`, cues: ['Leave each finger down until it has to move.', 'Fingertips just behind the fret.', CUES[2]],
      });
    },
  };

  // Shapes: pentatonic boxes and 7-note positions (system 'pos'), and 3-notes-per-string (system 'nps3').
  const SCALE_WHY = {
    minPent: 'The home base of blues and rock soloing. Every box holds the same five notes; only the fingering changes. Know where the roots (red) are in each one.',
    blues: 'The minor pentatonic plus the ♭5 blue note (teal). Pass through it on the way between the 4 and 5; don’t park on it.',
    majPent: 'Same shapes as the minor pentatonic, three frets lower, but the root moves. The sweeter, country-and-Southern-rock side of the sound.',
    aeolian: 'Natural minor: the minor pentatonic plus the 2 and the ♭6. The sound of rock ballads and a lot of metal.',
    ionian: 'The major scale, the parent of every mode: the major pentatonic plus the 4 and the 7.',
    dorian: 'Minor with a bright ♮6 (teal). Santana, funk, and jam-band minor grooves.',
    mixolydian: 'Major with a ♭7 (teal): the sound of dominant chords and classic-rock riffs.',
    phrygian: 'Minor with a ♭2 (teal): dark and Spanish, great over an E pedal riff.',
    lydian: 'Major with a ♯4 (teal): bright and floating, the film-score sound.',
    harmMinor: 'Natural minor with a raised 7 (teal): the leading tone that makes V → i pull so hard. Neoclassical metal.',
    phrygDom: 'The 5th mode of harmonic minor: ♭2 and a major 3rd. The Middle-Eastern metal sound over an E pedal.',
  };
  const SCALE_TAGS = {
    minPent: ['pent', 'metal'], blues: ['pent'], majPent: ['pent'],
    aeolian: ['scales', 'metal'], ionian: ['scales'], dorian: ['scales'], mixolydian: ['scales', 'pent'], phrygian: ['scales', 'metal'], lydian: ['scales'],
    harmMinor: ['metal', 'scales'], phrygDom: ['metal'],
  };
  const POS_SCALES = { minPent: 1, blues: 0.6, majPent: 0.5, aeolian: 1, ionian: 0.9, dorian: 0.6, mixolydian: 0.6, phrygian: 0.3, lydian: 0.25 };
  const NPS_SCALES = { aeolian: 1, harmMinor: 0.6, phrygDom: 0.5, ionian: 0.5, dorian: 0.35, minPent: 0 };
  const shapeSkill = (system, scaleId, k) => (system === 'pos' ? `${S.SCALES[scaleId].steps.length === 5 || scaleId === 'blues' ? 'box' : 'pos'}:${scaleId}:${k}` : `nps3:${scaleId}:${k}`);
  const shapeName = (system, scaleId, k) => (system === 'nps3' ? `3-notes-per-string pattern ${k}`
    : S.SCALES[scaleId].steps.length <= 6 ? `box ${k}` : `position ${k}`);

  function shapeNeed(system, scaleId, k) {
    if (system === 'nps3') {
      const need = k > 1 ? [[`nps3:${scaleId}:${k - 1}`, 0.25]] : [];
      if (scaleId !== 'aeolian') need.push(['nps3:aeolian:1', 0.3]);
      return need;
    }
    if (scaleId === 'minPent') return k > 1 ? [[`box:minPent:${k - 1}`, 0.3]] : [];
    if (scaleId === 'blues' || scaleId === 'majPent') return [[`box:minPent:${k}`, 0.3]];
    const need = [[`box:minPent:${k}`, 0.35]];
    if (!['aeolian', 'ionian'].includes(scaleId)) need.push([`pos:${S.SCALES[scaleId].ref === 'min' ? 'aeolian' : 'ionian'}:${k}`, 0.3]);
    return need;
  }

  function chooseSeq(ctx, system, skill, path) {
    const m = ctx.learner.mastery(skill);
    const list = system === 'nps3' ? ['straight', 'threes', 'fours', 'sixes'] : ['straight', 'threes', 'fours', 'thirds'];
    const ok = list.filter((id) => m >= SEQS[id].minM && (id !== 'sixes' || path >= 12));
    return weighted(ctx.rng, ok, (id) => (id === 'straight' ? (m < 0.4 ? 3 : 0.8) : 1)) || 'straight';
  }

  FAM.shape = {
    name: 'Scale shape', blocks: ['scales', 'warmup'], tags: [],
    cands(ctx) {
      const out = [];
      for (const [scaleId, w] of Object.entries(POS_SCALES)) {
        for (let k = 1; k <= 5; k++) out.push({ fam: 'shape', system: 'pos', scaleId, k, skill: shapeSkill('pos', scaleId, k), base: w, tags: SCALE_TAGS[scaleId], need: shapeNeed('pos', scaleId, k) });
      }
      for (const [scaleId, w] of Object.entries(NPS_SCALES)) {
        if (!w) continue;
        for (let k = 1; k <= 7; k++) out.push({ fam: 'shape', system: 'nps3', scaleId, k, skill: shapeSkill('nps3', scaleId, k), base: w * (k === 1 ? 1.2 : 1), tags: SCALE_TAGS[scaleId].includes('metal') ? ['metal', 'scales'] : ['scales'], need: shapeNeed('nps3', scaleId, k) });
      }
      return out;
    },
    make(c, ctx) {
      const m = ctx.learner.mastery(c.skill);
      const seq = c.forceSeq || chooseSeq(ctx, c.system, c.skill, c.system === 'nps3' ? 18 : 12);
      let npb = SEQ_NPB[seq];
      if (seq === 'straight' && m >= 0.65) npb = 4;
      if (seq === 'straight' && c.system === 'nps3') npb = m >= 0.5 ? 6 : 3;
      // Displacement: groups of 3 against 16ths, once the plain version is solid.
      if (seq === 'threes' && m >= 0.75 && ctx.rng() < 0.3) npb = 4;
      const style = c.tags.includes('metal') && !c.tags.includes('pent') ? 'metal' : c.tags.includes('pent') ? 'blues' : 'any';
      const key = chooseKey(ctx, style);
      const alt = m >= 0.5 && ctx.rng() < 0.25 ? 1 : 0;
      return { ...c, seq, npb, key, alt };
    },
    build(d, { tuning, maxFret }) {
      const sc = S.SCALES[d.scaleId];
      const minor = sc.ref === 'min';
      const sp = spellKey(d.key, d.scaleId);
      const flat = sp.flat;
      const shape = d.system === 'nps3'
        ? S.nps(d.key, d.scaleId, d.k, { tuning, maxFret, alt: d.alt })
        : S.position(d.key, d.scaleId, d.k, { tuning, maxFret, alt: d.alt });
      if (!shape) return null;
      const notes = seqIndices(shape.notes.length, d.seq).map((i) => shape.notes[i]);
      const where = shapeName(d.system, d.scaleId, d.k);
      const knownEdge = d.system === 'pos' && d.k > 1 ? ` It shares its lower notes with ${d.scaleId === 'minPent' || d.scaleId === 'blues' || d.scaleId === 'majPent' ? 'box' : 'position'} ${d.k - 1}: start from the notes you already know.` : '';
      const disp = d.seq === 'threes' && d.npb === 4 ? ' Here the groups of three run over 16ths, so the accent lands on a different note each beat (displacement).' : '';
      return base({
        title: `${sp.root} ${scaleTitle(d.scaleId)} · ${where}`,
        chips: [['Key', `${sp.root}${minor && ['minPent', 'blues', 'aeolian', 'harmMinor'].includes(d.scaleId) ? ' minor' : ''}`], ['Frets', `${shape.lo}–${shape.hi}`], ['Pattern', SEQS[d.seq].name], ['Rhythm', RHYTHM[d.npb]]],
        how: SEQ_HOW[d.seq] + disp,
        why: SCALE_WHY[d.scaleId] + knownEdge,
        notes, dots: uniqueDots(shape.notes), npb: d.npb, keyPc: d.key, flat, names: sp.byPc,
        allowed: sc.steps.map((x) => mod12(d.key + x)),
        tempoKey: `${d.skill}:${d.seq}:${d.npb}`,
        cues: d.seq === 'straight' ? [CUES[3], CUES[0], CUES[6]] : [CUES[2], CUES[8], CUES[7]],
      });
    },
  };

  FAM.bends = {
    name: 'Bends in tune', blocks: ['technique'], tags: ['tech', 'pent'],
    cands: () => [1, 2, 3, 4, 5].map((k) => ({ fam: 'bends', k, skill: 'bends', base: k === 1 ? 1.5 : 1, need: k > 1 ? [[`box:minPent:${k}`, 0.3]] : [] })),
    make(c, ctx) { return { ...c, key: chooseKey(ctx, 'blues'), curl: ctx.rng() < 0.5 }; },
    build(d, { tuning, maxFret }) {
      const shape = S.position(d.key, 'minPent', d.k, { tuning, maxFret });
      if (!shape) return null;
      const pcs = new Set(S.SCALES.minPent.steps.map((x) => mod12(d.key + x)));
      const flat = preferFlat(d.key, true);
      const cands = [];
      for (const n of shape.notes) {
        if (n.s > 3) continue;
        if (pcs.has(mod12(n.midi + 2)) && n.f + 2 <= maxFret) cands.push({ n, up: 2 });
        // The curl: the ♭3 pushed a half step up to the major 3rd.
        if (d.curl && n.semi === 3 && n.f + 1 <= maxFret) cands.push({ n, up: 1 });
      }
      if (cands.length < 2) return null;
      // Different bends first (4 → 5, ♭7 → R, ♭3 → 4 …), then repeats on other strings.
      const seen = new Set();
      const distinct = cands.filter(({ n, up }) => { const k = `${n.semi}:${up}`; if (seen.has(k)) return false; seen.add(k); return true; });
      const chosen = [...distinct, ...cands.filter((c) => !distinct.includes(c))].slice(0, 4);
      chosen.sort((a, b) => a.n.midi + a.up - (b.n.midi + b.up));
      const notes = [];
      for (const { n, up } of chosen) {
        const target = n.midi + up;
        const semi = mod12(target - d.key);
        const lab = S.degreeLabel(semi);
        notes.push({ s: n.s, f: n.f + up, midi: target, label: lab, role: S.scaleRole(semi, 'minPent'), ref: true });
        notes.push({ s: n.s, f: n.f, midi: target, from: n.midi, bend: up, label: lab, role: S.scaleRole(semi, 'minPent') });
      }
      const list = chosen.map(({ n, up }) => `${n.label} → ${S.degreeLabel(mod12(n.midi + up - d.key))}`).join(', ');
      return base({
        title: `Bends in tune · ${nameOf(d.key, flat)} minor pentatonic box ${d.k}`,
        chips: [['Key', `${nameOf(d.key, flat)} minor`], ['Bends', list], ['Rhythm', 'half notes']],
        how: 'For each pair: play the fretted target note, then pick the note below and bend up until it matches. The tuner and the grade tell you how close you got. Push with two or three fingers together.',
        why: 'An out-of-tune bend is what most often makes a solo sound amateur. Checking every bend against the fretted pitch trains the ear and the hand together.',
        notes, dots: uniqueDots(shape.notes), npb: 0.5, timing: false, keyPc: d.key, flat, fixedBpm: 60,
        tempoKey: 'bends', cues: ['Push from the wrist, not the finger alone.', 'Mute the strings the bend pushes against.', 'Hold the bend still at pitch for a beat before releasing.'],
      });
    },
  };

  // ---------- electric-guitar technique: graded by js/technique.js from the input's frames ----------
  const TONE_CUES = [
    'Play one pass on a clean, low-gain tone: it shows every mistake that distortion hides.',
    'Then one pass with crunch: keep it just as clean.',
  ];

  FAM.vibrato = {
    name: 'Vibrato', blocks: ['technique'], tags: ['tech', 'pent'],
    cands: () => [
      { fam: 'vibrato', width: 'narrow', skill: 'vibrato:narrow', base: 1.3 },
      { fam: 'vibrato', width: 'wide', skill: 'vibrato:wide', base: 1, need: [['vibrato:narrow', 0.4]] },
    ],
    make(c, ctx) { return { ...c, key: chooseKey(ctx, 'blues') }; },
    build(d, { tuning, maxFret }) {
      const shape = S.position(d.key, 'minPent', 1, { tuning, maxFret });
      if (!shape) return null;
      const flat = preferFlat(d.key, true);
      // Four notes on the top three strings, where vibrato lives: root first, then the 5th, ♭7, ♭3.
      const top = shape.notes.filter((n) => n.s <= 3);
      const order = [0, 7, 10, 3];
      const picked = [];
      for (const semi of order) {
        const n = top.find((x) => x.semi === semi && !picked.includes(x));
        if (n) picked.push(n);
      }
      if (picked.length < 3) return null;
      const notes = picked.map((n) => ({ s: n.s, f: n.f, midi: n.midi, label: n.label, role: n.role, mark: '~~~' }));
      const W = d.width === 'wide' ? { cents: '70–160', words: 'a half step', who: 'blues and rock' } : { cents: '20–60', words: 'a quarter step', who: 'melodic lead' };
      return base({
        title: `${d.width === 'wide' ? 'Wide' : 'Narrow'} vibrato · ${nameOf(d.key, flat)} minor pentatonic`,
        chips: [['Key', `${nameOf(d.key, flat)} minor`], ['Width', `${W.words} (${W.cents}¢)`], ['Speed', '5–7 a second']],
        how: `Pick each note and hold it for a whole bar (4 clicks) with vibrato: push the string ${W.words} up and let it back down to the note, evenly, 5–7 times a second. The grade measures the width, the speed and how even it is. Then go on to the next note.`,
        why: `Vibrato is the guitarist's voice: two players on the same note sound different because of it. ${d.width === 'wide' ? 'The wide, slow half-step vibrato is the sound of blues and rock.' : 'A narrow, even vibrato makes a held note sing without going out of tune.'} Hearing your width and speed in numbers makes it even fast.`,
        notes, dots: uniqueDots(shape.notes), npb: 0.25, timing: false, keyPc: d.key, flat, fixedBpm: 72,
        grade: 'tech', tech: { kind: 'vibrato', width: d.width }, tabNote: 'One note a bar, held, with vibrato',
        tempoKey: null, cues: ['Pivot from the wrist, the thumb hooked over the neck.', 'Support the fretting finger with the ones behind it.', TONE_CUES[0]],
      });
    },
  };

  FAM.legato = {
    name: 'Legato', blocks: ['technique'], tags: ['tech', 'scales', 'metal'],
    cands: () => [1, 2, 3].map((s) => ({ fam: 'legato', s, skill: `legato:${s}`, base: s === 2 ? 1.2 : 1 })),
    make(c, ctx) { return { ...c, scaleId: pick(ctx.rng, ['aeolian', 'ionian', 'dorian', 'aeolian']), k: 1 + Math.floor(ctx.rng() * 3), key: chooseKey(ctx) }; },
    build(d, { tuning, maxFret }) {
      const shape = S.nps(d.key, d.scaleId, d.k, { tuning, maxFret });
      if (!shape) return null;
      const three = shape.notes.filter((n) => n.s === d.s).sort((a, b) => a.f - b.f);
      if (three.length !== 3) return null;
      const [a, b, c] = three;
      const mk = (n, legato, mark) => ({ s: n.s, f: n.f, midi: n.midi, label: n.label, role: n.role, legato, mark });
      // One pick a beat, then hammer-on, hammer-on, pull-off: a b c b, a b c b …
      const notes = [mk(a, false, ''), mk(b, true, 'h'), mk(c, true, 'h'), mk(b, true, 'p')];
      const sp = spellKey(d.key, d.scaleId);
      const sc = S.SCALES[d.scaleId];
      return base({
        title: `Legato · ${sp.root} ${scaleTitle(d.scaleId)} on the ${STRING_NAME[d.s]} string`,
        chips: [['Key', sp.root], ['String', STRING_NAME[d.s]], ['Frets', `${a.f}–${c.f}`], ['Rhythm', '16th notes']],
        how: `Pick only the first note of each beat (fret ${a.f}). Hammer on to ${b.f} and ${c.f}, then pull off back to ${b.f}. The grade checks every note, its timing, and how loud the hammer-ons and pull-offs are next to the picked note: aim for the same level.`,
        why: 'Legato is how fast, fluid lines are played, and it is all fretting hand. Most players hammer too softly and the line fades after the pick; matching the levels is the skill.',
        notes, dots: uniqueDots(shape.notes), npb: 4, keyPc: d.key, flat: sp.flat, names: sp.byPc,
        allowed: sc.steps.map((x) => mod12(d.key + x)),
        grade: 'tech', tech: { kind: 'legato' },
        tempoKey: `${d.skill}:4`, cues: ['Hammer from about a centimetre up, right behind the fret.', 'Pull off down and slightly sideways, like a small pluck.', 'Mute the strings below with the picking-hand palm.', TONE_CUES[0]],
      });
    },
  };

  const PALM = {
    gallop: { name: 'six chugs and two opens', pattern: ['P', 'P', 'P', 'P', 'P', 'P', 'O', 'O'] },
    accents: { name: 'opens on the off-beats', pattern: ['P', 'P', 'O', 'P', 'P', 'O', 'P', 'O'] },
  };
  FAM.palm = {
    name: 'Palm mute vs open', blocks: ['technique'], tags: ['tech', 'metal'],
    cands: () => Object.keys(PALM).map((id) => ({ fam: 'palm', id, skill: `palm:${id}`, base: id === 'gallop' ? 1.3 : 1, need: id === 'gallop' ? [] : [['palm:gallop', 0.4]] })),
    make(c, ctx) { return { ...c, key: chooseKey(ctx, 'metal') }; },
    build(d, { tuning }) {
      // The root on the low E string, open or as low as it goes.
      const f = mod12(d.key - tuning.open[6]);
      const midi = tuning.open[6] + f;
      const flat = preferFlat(d.key, true);
      const P = PALM[d.id];
      const notes = P.pattern.map((k) => ({ s: 6, f, midi, label: 'R', role: 'root', mark: k === 'P' ? 'PM' : '' }));
      return base({
        title: `Palm mute vs open · ${nameOf(d.key, flat)}, ${P.name}`,
        chips: [['Note', `${nameOf(d.key, flat)}, low E string fret ${f}`], ['Pattern', P.pattern.map((k) => (k === 'P' ? 'PM' : 'open')).join(' ')], ['Rhythm', '8th notes']],
        how: 'Down-picked 8th notes on one note. PM notes: rest the edge of the picking hand on the strings right at the bridge, for a short, tight chug. Open notes: lift the palm and let them ring. The grade measures how fast each note dies, and checks the mutes and the opens sound clearly different.',
        why: 'The tight chug against a ringing accent is the core of metal and hard-rock rhythm. Too much palm and the chug turns into a thud, too little and it rings into mud.',
        notes, dots: [{ s: 6, f, midi, role: 'root', label: 'R' }], npb: 2, timing: false, keyPc: d.key, flat, clock: true,
        grade: 'tech', tech: { kind: 'palm', pattern: P.pattern }, onsets: true,
        tempoKey: `${d.skill}:2`, cues: ['Same picking strength for the mutes and the opens: only the palm changes.', 'Keep the palm in place between chugs; don’t bounce it.', 'Use a dry or lightly driven tone: heavy gain hides the difference.'],
      });
    },
  };

  FAM.stops = {
    name: 'Stops', blocks: ['technique'], tags: ['tech', 'metal', 'pent'],
    cands: () => [{ fam: 'stops', skill: 'stops', base: 1 }],
    make(c, ctx) { return { ...c, key: chooseKey(ctx, ctx.rng() < 0.5 ? 'metal' : 'blues') }; },
    build(d, { tuning }) {
      // A power chord's root and 5th on the low strings, played as 8ths for two beats.
      const s = mod12(d.key - tuning.open[6]) <= 7 ? 6 : 5;
      const f = mod12(d.key - tuning.open[s]);
      const root = tuning.open[s] + f;
      const fifth = tuning.open[s - 1] + f + 2;
      const flat = preferFlat(d.key, true);
      const hit = (i) => (i % 2 === 0 ? { s, f, midi: root, label: 'R', role: 'root' } : { s: s - 1, f: f + 2, midi: fifth, label: '5', role: 'fifth' });
      const notes = [hit(0), hit(1), hit(0), hit(1), ...[0, 1, 2, 3].map(() => ({ s: 3, f: 0, midi: tuning.open[3], rest: true, label: '', role: 'ghost' }))];
      return base({
        title: `Stops · ${nameOf(d.key, flat)}5, two beats on, two beats off`,
        chips: [['Riff', `${nameOf(d.key, flat)} root and 5th, ${STRING_NAME[s]} string fret ${f}`], ['Rhythm', '8th notes, then rest']],
        how: 'Play 8th notes on beats 1 and 2 (root, 5th, root, 5th), then stop dead on beat 3 and stay silent until the next bar. To stop, lay the picking-hand palm across the strings and ease the fretting fingers off the frets while they still touch the strings. The grade measures how close to beat 3 the sound stops and how quiet the rest is.',
        why: 'Silence is part of the riff. Tight stops are what make a band sound together, and on an electric with gain every string you don’t mute will ring and feed back.',
        notes, dots: [{ s, f, midi: root, role: 'root', label: 'R' }, { s: s - 1, f: f + 2, midi: fifth, role: 'fifth', label: '5' }], npb: 2, timing: false, keyPc: d.key, flat, clock: true,
        grade: 'tech', tech: { kind: 'stop' }, tabNote: 'Two beats of 8ths, then two beats of silence',
        tempoKey: `${d.skill}:2`, cues: ['Both hands mute: palm on the strings, fretting fingers relax.', 'The stop is a sound: practise it as deliberately as the notes.', TONE_CUES[1]],
      });
    },
  };

  FAM.pedal = {
    name: 'Pedal point', blocks: ['technique', 'connect'], tags: ['metal', 'tech'],
    cands: () => [1, 2, 6].map((s) => ({ fam: 'pedal', s, skill: `pedal:${s}`, base: s === 6 ? 1.2 : 1 })),
    make(c, ctx) {
      const scaleId = pick(ctx.rng, ['aeolian', 'harmMinor', 'phrygDom', 'aeolian']);
      return { ...c, scaleId, key: chooseKey(ctx, 'metal') };
    },
    build(d, { tuning, maxFret }) {
      const r = mod12(d.key - tuning.open[d.s]);
      const line = S.oneString(d.key, d.scaleId, d.s, r, Math.min(maxFret, r + 12));
      if (line.length < 6) return null;
      const P = line[0];
      const mel = line.slice(1);
      const notes = [];
      for (const x of mel) notes.push(P, x);
      for (let i = mel.length - 2; i >= 1; i--) notes.push(P, mel[i]);
      const sp = spellKey(d.key, d.scaleId);
      const flat = sp.flat;
      const sc = S.SCALES[d.scaleId];
      return base({
        title: `Pedal point · ${sp.root} ${scaleTitle(d.scaleId)} on the ${STRING_NAME[d.s]} string`,
        chips: [['Key', sp.root], ['String', STRING_NAME[d.s]], ['Rhythm', '16th notes']],
        how: `Alternate the ${P.f === 0 ? 'open string' : 'root'} (the pedal) with each scale note up the string, then back down. Strict alternate picking.${d.s === 6 ? ' Palm-mute the pedal; let the melody notes ring a little more.' : ''}`,
        why: `The pedal point is the backbone of metal and neoclassical riffs. It also drills shifting along one string while the picking hand never changes. ${SCALE_WHY[d.scaleId]}`,
        notes, dots: uniqueDots(line), npb: 4, keyPc: d.key, flat, names: sp.byPc,
        allowed: sc.steps.map((x) => mod12(d.key + x)),
        tempoKey: `${d.skill}:4`, cues: ['Keep the pick motion small.', 'Shift with the first finger leading.', CUES[8]],
      });
    },
  };

  FAM.onestring = {
    name: 'One string', blocks: ['connect'], tags: ['pent', 'scales', 'metal'],
    cands: () => [1, 2, 3, 4, 5, 6].map((s) => ({ fam: 'onestring', s, skill: `onestring:${s}`, base: s <= 3 ? 1 : 0.7 })),
    make(c, ctx) {
      const pool = [];
      if (ctx.focus.has('pent')) pool.push('minPent', 'minPent', 'blues');
      if (ctx.focus.has('scales')) pool.push('aeolian', 'ionian', 'dorian', 'mixolydian');
      if (ctx.focus.has('metal')) pool.push('harmMinor', 'aeolian');
      if (!pool.length) pool.push('minPent');
      const scaleId = pick(ctx.rng, pool);
      const seq = ctx.learner.mastery(c.skill) >= 0.45 && ctx.rng() < 0.5 ? 'threes' : 'straight';
      return { ...c, scaleId, seq, key: chooseKey(ctx, 'any') };
    },
    build(d, { tuning, maxFret }) {
      const r = mod12(d.key - tuning.open[d.s]);
      const from = r <= 7 ? r : r - 12 >= 0 ? r - 12 : 0;
      const line = S.oneString(d.key, d.scaleId, d.s, from, Math.min(maxFret, from + 12));
      if (line.length < 5) return null;
      const notes = seqIndices(line.length, d.seq).map((i) => line[i]);
      const sc = S.SCALES[d.scaleId];
      const sp = spellKey(d.key, d.scaleId);
      const flat = sp.flat;
      // Root to root where the octave fits below fret 12; otherwise the whole string up to fret 12.
      const rootToRoot = line[0].semi === 0 && line[line.length - 1].semi === 0;
      const range = rootToRoot ? 'root to the root an octave up, and back' : `from the lowest note up to fret ${line[line.length - 1].f}, and back (the root is at fret ${r})`;
      return base({
        title: `One string · ${sp.root} ${scaleTitle(d.scaleId)} on the ${STRING_NAME[d.s]} string`,
        chips: [['Key', sp.root], ['String', STRING_NAME[d.s]], ['Pattern', SEQS[d.seq].name], ['Rhythm', RHYTHM[SEQ_NPB[d.seq]]]],
        how: `Play the scale along one string, ${range}. Slide across the wider gaps and say each degree as you land on it.`,
        why: 'Boxes hide the scale’s real layout. Along one string you see the whole and half steps, and you learn to move sideways instead of up and down.',
        notes, dots: uniqueDots(line), npb: SEQ_NPB[d.seq], keyPc: d.key, flat, names: sp.byPc,
        allowed: sc.steps.map((x) => mod12(d.key + x)),
        tempoKey: `${d.skill}:${d.seq}`, cues: ['Use slides for the shifts.', CUES[3], CUES[6]],
      });
    },
  };

  const DEGREE_SETS = [
    { id: 'R', labels: ['R'], name: 'root', w: 1.2 },
    { id: 'R5', labels: ['R', '5'], name: 'root and 5th', w: 1 },
    { id: 'b3', labels: ['♭3'], name: '♭3', w: 1 },
    { id: 'b7', labels: ['♭7'], name: '♭7', w: 0.8 },
    { id: 'R35', labels: ['R', '♭3', '5'], name: 'root, ♭3 and 5th (the minor triad)', w: 0.8 },
    { id: '4', labels: ['4'], name: '4th', w: 0.5 },
  ];
  FAM.degrees = {
    name: 'Find the degrees', blocks: ['fretboard'], tags: ['*'],
    cands: () => [1, 2, 3, 4, 5].map((k) => ({ fam: 'degrees', k, skill: `degrees:${k}`, base: 1, need: k > 1 ? [[`box:minPent:${k}`, 0.2]] : [] })),
    make(c, ctx) {
      const set = weighted(ctx.rng, DEGREE_SETS, (x) => x.w);
      return { ...c, set: set.id, key: chooseKey(ctx, 'any') };
    },
    build(d, { tuning, maxFret }) {
      const set = DEGREE_SETS.find((x) => x.id === d.set);
      const shape = S.position(d.key, 'minPent', d.k, { tuning, maxFret });
      if (!shape) return null;
      const targets = shape.notes.filter((n) => set.labels.includes(n.label));
      if (targets.length < 2) return null;
      const notes = seqIndices(targets.length, 'straight').map((i) => targets[i]);
      const flat = preferFlat(d.key, true);
      const names = [...new Set(targets.map((n) => nameOf(n.midi, flat)))].join(', ');
      return base({
        title: `Every ${set.name} in box ${d.k} · ${nameOf(d.key, flat)} minor`,
        chips: [['Key', `${nameOf(d.key, flat)} minor`], ['Frets', `${shape.lo}–${shape.hi}`], ['Notes', names], ['Rhythm', 'quarter notes']],
        how: `Low to high and back, play only the ${set.name} (${names}) of box ${d.k}. Say each note name as you play it.`,
        why: 'Knowing where the root, ♭3 and 5th sit inside every box is what lets you aim for chord tones instead of running patterns.',
        notes, dots: uniqueDots(shape.notes).map((x) => (set.labels.includes(x.label) ? x : { ...x, role: 'ghost' })), npb: 1, keyPc: d.key, flat,
        tempoKey: 'degrees:1', cues: [CUES[3], CUES[6]],
      });
    },
  };

  FAM.noteAll = {
    name: 'One note everywhere', blocks: ['fretboard'], tags: ['*'],
    cands: () => [{ fam: 'noteAll', skill: 'noteAll', base: 0.9 }],
    make(c, ctx) {
      const m = ctx.learner.mastery(c.skill);
      const pool = m < 0.4 ? T.NATURAL_PCS : [...Array(12).keys()];
      return { ...c, pc: pick(ctx.rng, pool), flat: ctx.rng() < 0.5 };
    },
    build(d, { tuning }) {
      const up = [6, 5, 4, 3, 2, 1].map((s) => {
        const f = mod12(d.pc - tuning.open[s]);
        return { s, f, midi: tuning.open[s] + f, role: 'root', label: nameOf(d.pc, d.flat) };
      });
      const notes = [...up, ...up.slice(1, 5).reverse()];
      const name = nameOf(d.pc, d.flat);
      const alt = T.spellings(d.pc, d.flat)[1];
      return base({
        title: `One note everywhere · ${name}${alt ? ` (${alt})` : ''}`,
        chips: [['Note', name], ['Order', 'low E → high e → back'], ['Rhythm', '2 clicks per note']],
        how: `Find ${name} on every string, low E to high e and back. Use the 3-step method: landmark on the E or A string, octave shape, name it. Any octave counts.`,
        why: 'The deck’s checkpoint: name any note on any string in under 2 seconds. Do a different note every day and the map fills in.',
        notes, dots: up, npb: 0.5, matchPc: true, hidden: true, timing: false,
        tempoKey: 'noteAll', cues: ['Look for the octave shape before you look at the fret numbers.', 'Say the string name and the note together.'],
      });
    },
  };

  FAM.guide = {
    name: 'Guide tones', blocks: ['fretboard'], tags: ['pent', 'arps'],
    cands: () => [1, 2, 3, 4, 5].map((k) => ({ fam: 'guide', k, skill: `guide:${k}`, base: 0.8, need: [[`box:minPent:${k}`, 0.3]] })),
    make(c, ctx) {
      const prog = weighted(ctx.rng, ['quick4', 'blues12', 'iiVI', 'rockMaj'], (p) => (p === 'iiVI' || p === 'rockMaj' ? (ctx.focus.has('arps') ? 0.6 : 0) : 1));
      return { ...c, prog, key: chooseKey(ctx, PROGS[prog].mode === 'minor' ? 'blues' : 'any') };
    },
    build(d, { tuning, maxFret }) {
      const P = PROGS[d.prog];
      const flat = progFlat(d.prog, d.key);
      const chords = chordsOf(d.prog, d.key, flat);
      const box = S.boxPlacements(windowRootOf(d.prog, d.key), d.k, tuning, maxFret)[0];
      if (!box) return null;
      const lo = Math.max(0, box.lo - 1);
      const hi = box.hi + 1;
      const inWindow = (pc) => {
        const out = [];
        for (const s of [6, 5, 4, 3, 2, 1]) for (let f = lo; f <= hi; f++) if (mod12(tuning.open[s] + f) === pc) out.push({ s, f, midi: tuning.open[s] + f });
        return out;
      };
      const notes = [];
      let prev = tuning.open[3] + Math.round((lo + hi) / 2);
      let prevF = Math.round((box.lo + box.hi) / 2);
      // Nearest pitch first; then inside the box rather than on a stretch fret; then the least hand movement.
      const cost = (n) => Math.abs(n.midi - prev) * 10 + (n.f < box.lo || n.f > box.hi ? 4 : 0) + Math.abs(n.f - prevF);
      chords.forEach((ch, ci) => {
        const steps = S.CHORDS[ch.chordId].steps;
        const guide = [steps[1], steps.length > 3 ? steps[3] : steps[2]];
        for (const g of guide) {
          const pc = mod12(ch.root + g);
          const opts = inWindow(pc);
          if (!opts.length) return;
          opts.sort((a, b) => cost(a) - cost(b) || a.midi - b.midi);
          const n = opts[0];
          prev = n.midi;
          prevF = n.f;
          const semi = mod12(n.midi - ch.root);
          notes.push({ ...n, label: S.degreeLabel(semi, { chordId: ch.chordId }), role: S.chordRole(semi), chord: ci, bar: ci });
        }
      });
      if (notes.length !== chords.length * 2) return null;
      return base({
        title: `Guide tones · ${P.name} in ${progKeyName(d.prog, d.key, flat)}`,
        chips: [['Key', progKeyName(d.prog, d.key, flat)], ['Window', `box ${d.k}, frets ${box.lo}–${box.hi}`], ['Rhythm', 'half notes']],
        how: `The pad plays the chords. Over each one, play its 3rd and then its ${chords.some((c) => S.CHORDS[c.chordId].steps.length > 3) ? '7th' : '5th'}, two beats each, staying around box ${d.k}.${chords.some((c) => S.CHORDS[c.chordId].steps.length > 3) ? ' When the chord changes, the 7th usually moves just a half step to the next chord’s 3rd: listen for it.' : ''}`,
        why: 'The 3rd and 7th define a chord. Moving between them by the smallest step is how a solo audibly follows the changes, and it’s the skeleton under every good blues line.',
        notes, dots: uniqueDots(box.notes.map((n) => ({ ...n, role: 'ghost', label: '' }))), npb: 0.5, keyPc: d.key, flat,
        grade: 'free', clock: true, allowMode: 'guide', chords, backing: { type: 'chords', chords },
        tempoKey: 'guide:0.5', cues: ['Sing the note before you play it.', 'Hold each note its full two beats.'],
      });
    },
  };

  const ARP_WHY = {
    min: 'R-♭3-5: the minor triad. These three notes are home base inside every minor pentatonic box.',
    maj: 'R-3-5: the major triad. Find the 3rd (amber) and you can make any box sound major.',
    dim: 'The ♭5 is a half step below the fifth of a minor chord. Listen to how that one change adds tension.',
    dom7: 'R-3-5-♭7: the blues chord. Over a 12-bar, these are the notes that make you sound like you know the changes.',
    min7: 'R-♭3-5-♭7: the minor pentatonic minus the 4. Smooth, soulful minor lines.',
    maj7: 'R-3-5-7: the dreamy major sound; the 7 is a half step below the root.',
    m7b5: 'R-♭3-♭5-♭7: the ii chord in minor keys, and the top of a dominant 9 chord.',
    dim7: 'Stacked minor 3rds: the shape repeats every 3 frets. The neoclassical metal workhorse.',
  };
  FAM.arp = {
    name: 'Arpeggio', blocks: ['arps'], tags: [],
    cands() {
      const W = { min: [1, ['arps', 'pent', 'metal']], maj: [1, ['arps', 'pent']], dom7: [0.9, ['arps', 'pent']], min7: [0.7, ['arps']], maj7: [0.5, ['arps']], m7b5: [0.3, ['arps']], dim7: [0.4, ['metal']] };
      const out = [];
      for (const [chordId, [w, tags]] of Object.entries(W)) {
        for (let k = 1; k <= 5; k++) {
          const need = [];
          if (['min7', 'm7b5', 'dim7'].includes(chordId)) need.push([`arp:min:${k}`, 0.3]);
          if (['maj7', 'dom7'].includes(chordId)) need.push([`arp:maj:${k}`, 0.3]);
          if (chordId === 'min' || chordId === 'maj') need.push([`box:minPent:${k}`, 0.25]);
          out.push({ fam: 'arp', chordId, k, skill: `arp:${chordId}:${k}`, base: w, tags, need });
        }
      }
      return out;
    },
    make(c, ctx) {
      const m = ctx.learner.mastery(c.skill);
      const seq = m >= 0.5 && ctx.rng() < 0.4 ? 'threes' : 'straight';
      return { ...c, seq, npb: seq === 'threes' ? 3 : m >= 0.6 ? 3 : 2, key: chooseKey(ctx, c.tags.includes('metal') && !c.tags.includes('arps') ? 'metal' : 'any') };
    },
    build(d, { tuning, maxFret }) {
      const sh = S.arpeggio(d.key, d.chordId, d.k, { tuning, maxFret });
      if (!sh || sh.notes.length < 5) return null;
      const notes = seqIndices(sh.notes.length, d.seq).map((i) => sh.notes[i]);
      const ch = S.CHORDS[d.chordId];
      const sp = S.spellChordOn(d.key, d.chordId, preferFlat(d.key, ch.steps.includes(3)));
      const name = sp.root + ch.sym;
      const formula = [...new Set(ch.steps.map((x) => S.degreeLabel(x, { chordId: d.chordId })))].join('-');
      return base({
        title: `${name} arpeggio · position ${d.k}`,
        chips: [['Chord', `${name} (${formula})`], ['Frets', `${sh.lo}–${sh.hi}`], ['Pattern', SEQS[d.seq].name], ['Rhythm', RHYTHM[d.npb]]],
        how: `${SEQ_HOW[d.seq]} When successive notes sit at the same fret on neighbouring strings, roll your fingertip across. Mute each note as you leave it.`,
        why: ARP_WHY[d.chordId],
        notes, dots: uniqueDots(sh.notes), npb: d.npb, keyPc: d.key, flat: sp.flat, names: sp.byPc,
        allowed: ch.steps.map((x) => mod12(d.key + x)),
        tempoKey: `${d.skill}:${d.seq}:${d.npb}`, cues: ['Mute each note as you leave it: arpeggios shouldn’t ring like a chord.', CUES[3], CUES[0]],
      });
    },
  };

  FAM.triads = {
    name: 'Triads on a string set', blocks: ['arps'], tags: ['arps', 'pent'],
    cands: () => Object.keys(S.STRING_SETS).flatMap((set) => ['major', 'minor'].map((mode) => ({
      fam: 'triads', set, mode, skill: `triads:${set}:${mode}`, base: { gbe: 1, dgb: 0.9, adg: 0.6, ead: 0.4 }[set], need: set !== 'gbe' ? [[`triads:gbe:${mode}`, 0.3]] : [],
    }))),
    make(c, ctx) {
      const prog = c.mode === 'major' ? pick(ctx.rng, ['I_IV_V', 'rockMaj']) : pick(ctx.rng, ['i_iv_v', 'rockMin']);
      return { ...c, prog, key: chooseKey(ctx, 'any'), region: 2 + Math.floor(ctx.rng() * 8) };
    },
    build(d, { tuning }) {
      const P = PROGS[d.prog];
      const flat = progFlat(d.prog, d.key);
      const chords = chordsOf(d.prog, d.key, flat);
      const voicings = [];
      let prev = null;
      for (const ch of chords) {
        const all = S.triadVoicings(ch.root, ch.chordId, d.set, { tuning, maxFret: 17 });
        if (!all.length) return null;
        const cost = (v) => (prev ? v.notes.reduce((a, n, i) => a + Math.abs(n.f - prev.notes[i].f), 0) : Math.abs(v.lo - d.region));
        all.sort((a, b) => cost(a) - cost(b) || a.lo - b.lo);
        prev = all[0];
        voicings.push(all[0]);
      }
      const notes = [];
      voicings.forEach((v, ci) => { const [b, m, h] = v.notes; for (const n of [b, m, h, m]) notes.push({ ...n, chord: ci }); });
      const dots = uniqueDots(voicings.flatMap((v) => v.notes));
      const lo = Math.min(...dots.map((x) => x.f));
      const hi = Math.max(...dots.map((x) => x.f));
      const INV = ['root position', '1st inversion', '2nd inversion'];
      return base({
        title: `Triads on ${S.STRING_SETS[d.set].name} · ${P.name} in ${nameOf(d.key, flat)}`,
        chips: [['Chords', chords.map((c) => c.name).join(' → ')], ['Frets', `${lo}–${hi}`], ['Rhythm', '8th notes']],
        how: `Arpeggiate each triad low-middle-high-middle, then move to the next chord’s closest shape. Inversions here: ${voicings.map((v) => INV[v.inv]).join(', ')}.`,
        why: 'Three-string triads are the smallest complete chords: they free you from open-chord shapes for comping, and they’re the targets inside every solo.',
        notes, dots, npb: 2, keyPc: d.key, flat, chords,
        tempoKey: `${d.skill}:2`, cues: ['Move the least you can between chords.', 'Name the chord out loud as you change.'],
      });
    },
  };

  FAM.changes = {
    name: 'Follow the changes', blocks: ['arps', 'apply'], tags: ['arps', 'pent', 'metal'],
    cands: () => [1, 2, 3, 4, 5].map((k) => ({ fam: 'changes', k, skill: `changes:${k}`, base: 0.9, need: [[`box:minPent:${k}`, 0.3]] })),
    make(c, ctx) {
      const prog = weighted(ctx.rng, ['quick4', 'blues12', 'rockMaj', 'rockMin', 'andalusian'], (p) => {
        if (p === 'quick4' || p === 'blues12') return ctx.focus.has('pent') ? 1 : 0.2;
        if (p === 'andalusian') return ctx.focus.has('metal') ? 0.8 : 0.2;
        return ctx.focus.has('arps') ? 0.7 : 0.2;
      });
      return { ...c, prog, key: chooseKey(ctx, PROGS[prog].mode === 'minor' && prog !== 'rockMin' ? 'blues' : 'any') };
    },
    build(d, { tuning, maxFret }) {
      const P = PROGS[d.prog];
      const flat = progFlat(d.prog, d.key);
      const chords = chordsOf(d.prog, d.key, flat);
      const box = S.boxPlacements(windowRootOf(d.prog, d.key), d.k, tuning, maxFret)[0];
      if (!box) return null;
      const notes = [];
      let prevMidi = null;
      let up = true;
      for (let ci = 0; ci < chords.length; ci++) {
        const ch = chords[ci];
        const sh = S.arpeggio(ch.root, ch.chordId, d.k, { tuning, maxFret, window: { lo: box.lo, hi: box.hi } });
        if (!sh || sh.notes.length < 4) return null;
        const path = sh.notes;
        let i = prevMidi == null ? 0 : path.reduce((bi, n, j) => (Math.abs(n.midi - prevMidi) < Math.abs(path[bi].midi - prevMidi) ? j : bi), 0);
        if (i === path.length - 1) up = false;
        if (i === 0) up = true;
        for (let c = 0; c < 8; c++) {
          notes.push({ ...path[i], chord: ci, bar: ci });
          if (up && i === path.length - 1) up = false;
          else if (!up && i === 0) up = true;
          i += up ? 1 : -1;
        }
        prevMidi = notes[notes.length - 1].midi;
        up = !up;
      }
      return base({
        title: `Follow the changes · ${P.name} in ${progKeyName(d.prog, d.key, flat)}`,
        chips: [['Chords', chords.length > 4 ? `${chords.length} bars` : chords.map((c) => c.name).join(' → ')], ['Window', `box ${d.k}, frets ${box.lo}–${box.hi}`], ['Rhythm', '8th notes']],
        how: `The pad plays the chords, one per bar. Play only the notes of the chord that’s sounding, in 8th notes, and move to the nearest chord tone when it changes. The tab is one way through; any chord tone counts.`,
        why: 'This is the jump from playing the scale to playing the changes: every note belongs to the chord underneath, so the harmony is audible even without the band.',
        notes, dots: uniqueDots(box.notes.map((n) => ({ ...n, role: 'ghost', label: '' }))), npb: 2, keyPc: d.key, flat,
        grade: 'free', clock: true, allowMode: 'chord', land: 'chord', chords, backing: { type: 'chords', chords },
        tempoKey: `${d.skill}:2`, cues: ['Look one bar ahead: where is the next chord’s nearest note?', 'Land on the 3rd when the chord changes.'],
      });
    },
  };

  FAM.link = {
    name: 'Link two boxes', blocks: ['connect'], tags: ['pent', 'scales'],
    cands() {
      const out = [];
      for (let k = 1; k <= 5; k++) {
        const k2 = (k % 5) + 1;
        out.push({ fam: 'link', scaleId: 'minPent', k, skill: `link:minPent:${k}`, base: 1, tags: ['pent'], need: [[`box:minPent:${k}`, 0.3], [`box:minPent:${k2}`, 0.2]] });
        out.push({ fam: 'link', scaleId: 'aeolian', k, skill: `link:aeolian:${k}`, base: 0.7, tags: ['scales'], need: [[`pos:aeolian:${k}`, 0.3], [`pos:aeolian:${k2}`, 0.2]] });
      }
      return out;
    },
    make(c, ctx) { return { ...c, key: chooseKey(ctx, c.scaleId === 'minPent' ? 'blues' : 'any') }; },
    build(d, { tuning, maxFret }) {
      const k2 = (d.k % 5) + 1;
      let A = null;
      let B = null;
      for (let a = 0; a < 3 && !B; a++) {
        A = S.position(d.key, d.scaleId, d.k, { tuning, maxFret, alt: a });
        if (!A) break;
        for (let b = 0; b < 3; b++) {
          const cand = S.position(d.key, d.scaleId, k2, { tuning, maxFret, alt: b });
          if (cand && cand.lo > A.lo && cand.lo - A.lo <= 6) { B = cand; break; }
        }
      }
      if (!A || !B) return null;
      const notes = [...A.notes, ...[...B.notes].reverse()];
      const sc = S.SCALES[d.scaleId];
      const flat = preferFlat(d.key, true);
      const what = d.scaleId === 'minPent' ? 'box' : 'position';
      return base({
        title: `Link ${what} ${d.k} → ${what} ${k2} · ${nameOf(d.key, flat)} ${scaleTitle(d.scaleId)}`,
        chips: [['Key', `${nameOf(d.key, flat)} minor`], ['Frets', `${A.lo}–${B.hi}`], ['Rhythm', '8th notes']],
        how: `Up ${what} ${d.k}, shift on the high e string, and come down ${what} ${k2}. Then shift back on the low E and go again.`,
        why: `Neighbouring ${what}es overlap: the top edge of one is the bottom edge of the next. Linking them is how you stop getting stuck in one ${what}.`,
        notes, dots: uniqueDots([...A.notes, ...B.notes]), npb: 2, keyPc: d.key, flat,
        allowed: sc.steps.map((x) => mod12(d.key + x)),
        tempoKey: `${d.skill}:2`, cues: ['Shift with a slide: the hand moves, the sound doesn’t stop.', CUES[8]],
      });
    },
  };

  FAM.diagonal = {
    name: 'Diagonal run', blocks: ['connect'], tags: ['pent', 'metal'],
    cands: () => [1, 2, 3, 4, 5].map((k) => ({ fam: 'diagonal', k, skill: `diag:${k}`, base: 1, need: [[`box:minPent:${k}`, 0.3], [`box:minPent:${(k % 5) + 1}`, 0.2]] })),
    make(c, ctx) { return { ...c, key: chooseKey(ctx, ctx.focus.has('metal') && !ctx.focus.has('pent') ? 'metal' : 'blues') }; },
    build(d, { tuning }) {
      // Three pentatonic notes per string from box k's first note on the low E string. The run climbs
      // about 17 frets over six strings; if it would go past fret 21, it stops a string or two early.
      const pcs = S.pcsOf(d.key, S.PENT);
      const start = tuning.open[6] + T.mod12(d.key + S.PENT[d.k - 1] - tuning.open[6]);
      let best = null;
      for (const o of [0, -12, 12]) {
        const all = S.perString(pcs, start + o, 3, tuning);
        if (all[0].f < 0) continue;
        const cut = all.findIndex((n) => n.f > 21);
        const run = cut < 0 ? all : all.slice(0, cut - (cut % 3));
        if (run.length >= 12 && (!best || run.length > best.length)) best = run;
      }
      if (!best) return null;
      const sh = { notes: S.annotateScale(best, d.key, 'minPent'), ...S.span(best) };
      const notes = seqIndices(sh.notes.length, 'straight').map((i) => sh.notes[i]);
      const flat = preferFlat(d.key, true);
      return base({
        title: `Diagonal run · ${nameOf(d.key, flat)} minor pentatonic from box ${d.k}`,
        chips: [['Key', `${nameOf(d.key, flat)} minor`], ['Frets', `${sh.lo}–${sh.hi}`], ['Rhythm', 'triplets, one string per beat']],
        how: 'Three notes per string, so the run climbs the neck as it goes up. Slide or stretch into the third note on each string. One string per beat.',
        why: 'Three pentatonic notes per string crosses two or three boxes in one move: the classic rock run from the bottom of the neck to the top.',
        notes, dots: uniqueDots(sh.notes), npb: 3, keyPc: d.key, flat,
        allowed: S.SCALES.minPent.steps.map((x) => mod12(d.key + x)),
        tempoKey: `${d.skill}:3`, cues: ['Lead the shift with the 1st finger.', CUES[2]],
      });
    },
  };

  // Improvising under a constraint. Graded by how many notes fit the rule (and landings, if any).
  const IMPROV = {
    three: { name: 'Three-note solo', bpm: 76, w: 1 },
    onebox: { name: 'Stay in one box', bpm: 84, w: 1 },
    rhythm: { name: 'Rhythm only', bpm: 88, w: 0.7 },
    onestr: { name: 'One-string solo', bpm: 80, w: 0.7 },
    qa: { name: 'Question and answer', bpm: 80, w: 0.9 },
  };
  FAM.improv = {
    name: 'Improvise', blocks: ['apply'], tags: ['pent', 'scales', 'metal'],
    cands: () => Object.entries(IMPROV).map(([id, x]) => ({ fam: 'improv', rule: id, skill: `improv:${id}`, base: x.w })),
    make(c, ctx) {
      const pool = [];
      if (ctx.focus.has('pent')) pool.push('minPent', 'minPent', 'blues');
      if (ctx.focus.has('scales')) pool.push('aeolian', 'dorian');
      if (ctx.focus.has('metal')) pool.push('aeolian', 'phrygian');
      const scaleId = pool.length ? pick(ctx.rng, pool) : 'minPent';
      const k = weighted(ctx.rng, [1, 2, 3, 4, 5], (x) => 0.2 + ctx.learner.mastery(`box:minPent:${x}`) + (x > 1 ? 0.2 : 0));
      const three = [0, pick(ctx.rng, [3, 3, 5]), pick(ctx.rng, [7, 7, 10])];
      return { ...c, scaleId, k, three, s: pick(ctx.rng, [1, 2, 3]), key: chooseKey(ctx, scaleId === 'phrygian' ? 'metal' : 'blues') };
    },
    build(d, { tuning, maxFret }) {
      const sc = S.SCALES[d.scaleId];
      const sp = spellKey(d.key, d.scaleId);
      const flat = sp.flat;
      const shape = S.position(d.key, d.scaleId, d.k, { tuning, maxFret });
      if (!shape) return null;
      const K = sp.root;
      const all = sc.steps.map((x) => mod12(d.key + x));
      let allowed = all;
      let dots = uniqueDots(shape.notes);
      let how;
      let why;
      let land = null;
      if (d.rule === 'three') {
        allowed = d.three.map((x) => mod12(d.key + x));
        const labels = d.three.map((x) => S.degreeLabel(x));
        dots = dots.map((x) => (allowed.includes(mod12(x.midi)) ? x : { ...x, role: 'ghost' }));
        how = `Solo over the drone using only ${labels.join(', ')} (${allowed.map((p) => sp.byPc[p] || nameOf(p, flat)).join(', ')}) in any octave. Make it interesting with rhythm, bends, slides, repetition and space.`;
        why = 'With three notes there’s nothing to hide behind: phrasing becomes the whole solo. It’s the fastest way to stop noodling.';
      } else if (d.rule === 'onebox') {
        how = `Improvise over the drone in box ${d.k} only (frets ${shape.lo}–${shape.hi}). Start and end your phrases on a red root.`;
        why = 'Box 1 habits follow you everywhere. Spending real playing time in another box is what makes it yours.';
      } else if (d.rule === 'rhythm') {
        allowed = [d.key, mod12(d.key + 7)];
        dots = dots.map((x) => (allowed.includes(mod12(x.midi)) ? x : { ...x, role: 'ghost' }));
        how = `Only the root and 5th, but vary the rhythm: long notes, rests, 8ths, triplets, pushes before the beat. Make 8 bars that groove.`;
        why = 'Rhythm carries more of a solo than note choice. This isolates it.';
      } else if (d.rule === 'onestr') {
        dots = S.oneString(d.key, d.scaleId, d.s, 0, Math.min(maxFret, 17));
        how = `Improvise on the ${STRING_NAME[d.s]} string only. Slide between notes, use the whole neck. Sing along with what you play.`;
        why = 'One string makes you think in intervals and distances, not shapes, and it’s how a lot of vocal-sounding lines are played.';
      } else {
        land = 'qa';
        how = `Two-bar phrases: a question that ends on the 5th (blue) on beat 1 of bar 2, then an answer that ends on the root (red) on beat 1 of bar 4. Stay around box ${d.k}.`;
        why = 'Call and response is the oldest phrasing trick in the blues. Ending phrases on purpose, on chord tones, is what makes a solo sound like sentences.';
      }
      return base({
        title: `${IMPROV[d.rule].name} · ${K} ${scaleTitle(d.scaleId)}`,
        chips: [['Key', `${K} ${sc.ref === 'min' ? 'minor' : ''}`.trim()], ['Backing', 'drone'], ['Tempo', `${IMPROV[d.rule].bpm} bpm`]],
        how, why, notes: [], dots, npb: 2, keyPc: d.key, flat, names: sp.byPc, scaleId: d.scaleId, flavorPc: sc.flavor != null && (d.rule === 'onebox' || d.rule === 'onestr') ? mod12(d.key + sc.flavor) : null,
        grade: 'free', allowed, land, backing: { type: 'drone', root: d.key, minor: sc.ref === 'min' }, fixedBpm: IMPROV[d.rule].bpm,
        tempoKey: null, cues: ['Leave space: rests are part of the solo.', 'Repeat an idea before you change it.', 'Record yourself and listen back tonight.'],
      });
    },
  };

  FAM.targets = {
    name: 'Land on the 3rd', blocks: ['apply'], tags: ['pent', 'arps'],
    cands: () => ['quick4', 'blues12', 'rockMaj', 'rockMin'].map((prog) => ({ fam: 'targets', prog, skill: `targets:${prog}`, base: prog.startsWith('rock') ? 0.7 : 1, tags: prog.startsWith('rock') ? ['arps'] : ['pent', 'arps'], need: [['box:minPent:1', 0.4]] })),
    make(c, ctx) {
      const k = weighted(ctx.rng, [1, 2, 3, 4, 5], (x) => 0.2 + ctx.learner.mastery(`box:minPent:${x}`));
      return { ...c, k, key: chooseKey(ctx, PROGS[c.prog].mode === 'minor' && c.prog !== 'rockMin' ? 'blues' : 'any') };
    },
    build(d, { tuning, maxFret }) {
      const P = PROGS[d.prog];
      const flat = progFlat(d.prog, d.key);
      const chords = chordsOf(d.prog, d.key, flat);
      const scaleId = P.scale;
      const shape = S.position(d.key, scaleId, d.k, { tuning, maxFret });
      if (!shape) return null;
      const thirds = chords.map((c) => `${c.tones[1]} over ${c.name}`);
      return base({
        title: `Land on the 3rd · ${P.name} in ${progKeyName(d.prog, d.key, flat)}`,
        chips: [['Chords', chords.length > 4 ? `${chords.length} bars` : chords.map((c) => c.name).join(' → ')], ['Scale', `${S.SCALES[scaleId].name}, box ${d.k}`], ['Targets', [...new Set(thirds)].slice(0, 3).join(' · ')]],
        how: `Improvise in box ${d.k}, but on beat 1 of every bar land on the 3rd of the chord that just arrived (${[...new Set(thirds)].join(', ')}). In between, play anything.`,
        why: 'Target notes on strong beats are what separate “playing the scale” from playing the song. The 3rd is the note that says major or minor.',
        notes: [], dots: uniqueDots(shape.notes), npb: 2, keyPc: d.key, flat,
        grade: 'free', allowMode: 'scale+chord', allowed: S.SCALES[scaleId].steps.map((x) => mod12(d.key + x)), land: 'third',
        chords, backing: { type: 'chords', chords }, fixedBpm: 80, tempoKey: null,
        cues: ['Aim a beat early: know where the 3rd is before the chord changes.', 'Bend into the 3rd from a half step below.'],
      });
    },
  };

  const MODE_TEXT = {
    dorian: 'Lean on the ♮6 (teal) and resolve to the root: dark, but with a lift.',
    mixolydian: 'Lean on the ♭7 (teal) against the major 3rd: bluesy major.',
    phrygian: 'Lean on the ♭2 (teal), a half step above the root: tense, Spanish, metal.',
    lydian: 'Lean on the ♯4 (teal): bright and floating, never quite settling.',
    aeolian: 'Lean on the ♭6 (teal): the sad note of natural minor.',
    harmMinor: 'Lean on the raised 7 (teal) and let it pull up to the root.',
  };
  FAM.mode = {
    name: 'Mode over a drone', blocks: ['apply'], tags: ['scales', 'metal'],
    cands: () => Object.keys(MODE_TEXT).map((modeId) => ({
      fam: 'mode', modeId, skill: `mode:${modeId}`, base: { dorian: 1, mixolydian: 1, phrygian: 0.8, lydian: 0.5, aeolian: 0.8, harmMinor: 0.6 }[modeId],
      tags: ['phrygian', 'harmMinor', 'aeolian'].includes(modeId) ? ['scales', 'metal'] : ['scales'], need: [[`pos:${S.SCALES[modeId].ref === 'min' ? 'aeolian' : 'ionian'}:1`, 0.3]],
    })),
    make(c, ctx) {
      const ref = S.SCALES[c.modeId].ref === 'min' ? 'aeolian' : 'ionian';
      const k = weighted(ctx.rng, [1, 2, 3, 4, 5], (x) => 0.05 + ctx.learner.mastery(`pos:${ref}:${x}`) + 0.5 * ctx.learner.mastery(`box:minPent:${x}`));
      return { ...c, k, key: chooseKey(ctx, c.tags.includes('metal') ? 'metal' : 'any') };
    },
    build(d, { tuning, maxFret }) {
      const sc = S.SCALES[d.modeId];
      const sp = spellKey(d.key, d.modeId);
      const flat = sp.flat;
      const shape = S.position(d.key, d.modeId, d.k, { tuning, maxFret });
      if (!shape) return null;
      return base({
        title: `${sp.root} ${scaleTitle(d.modeId)} over a drone · position ${d.k}`,
        chips: [['Mode', `${sp.root} ${scaleTitle(d.modeId)}`], ['Frets', `${shape.lo}–${shape.hi}`], ['Backing', `${sp.root} drone`]],
        how: `Improvise slowly over the drone. ${MODE_TEXT[d.modeId]} Hold notes long enough to hear each one against the drone.`,
        why: 'A mode is a sound, not a shape: the same notes feel different over a different root. A drone makes the flavor note impossible to miss.',
        notes: [], dots: uniqueDots(shape.notes), npb: 2, keyPc: d.key, flat, names: sp.byPc, flavorPc: mod12(d.key + sc.flavor), scaleId: d.modeId,
        grade: 'free', allowed: sc.steps.map((x) => mod12(d.key + x)), backing: { type: 'drone', root: d.key, minor: sc.ref === 'min' }, fixedBpm: 66, timing: false,
        tempoKey: null, cues: ['Long notes. Listen to each one against the drone.', 'Sing the flavor note before you play it.'],
      });
    },
  };

  // Rhythm: the patterns of the Rhythm page (js/rhythm.js), graded on timing by the onset detector
  // (grade 'rhythm'). Metal patterns come up mostly with the Metal focus. A pattern you play solidly
  // sometimes comes back with less click: a gap click, or only 2 and 4.
  FAM.rhythm = {
    name: 'Rhythm', blocks: ['rhythm'], tags: ['*'],
    cands(ctx) {
      if (!Rh) return [];
      return Rh.PATTERNS.map((p) => ({
        fam: 'rhythm', id: p.id, cat: p.cat, skill: `rhythm:${p.id}`, tags: ['*'],
        base: p.cat === 'metal' ? (ctx.focus.has('metal') ? 1.2 : 0.35) : p.cat === 'clock' ? 0.8 : p.id === 'ladder' ? 0.7 : 1,
        need: (Rh.NEEDS[p.id] || []).map(([id, m]) => [`rhythm:${id}`, m]),
      }));
    },
    make(c, ctx) {
      const p = Rh.byId(c.id);
      let click = p.click || { mode: 'all' };
      if (!p.click && ctx.learner.mastery(c.skill) >= 0.65 && ctx.rng() < 0.4) click = pick(ctx.rng, [{ mode: 'gap', on: 2, off: 2 }, { mode: '24' }]);
      return { ...c, click };
    },
    build(d) {
      const p = Rh && Rh.byId(d.id);
      if (!p) return null;
      const click = d.click || p.click || { mode: 'all' };
      const sixEight = p.meter === 2 && p.bars[0].grid === 3;
      const grids = [...new Set(p.bars.map((b) => Rh.GRID_NAME[b.grid]))].join(' → ');
      const clickName = click.mode === 'gap' ? `${click.on} bar${click.on > 1 ? 's' : ''} on, ${click.off} off` : { all: 'every beat', 24: 'on 2 and 4', one: 'on beat 1', off: 'on the “&”' }[click.mode];
      const extra = click.mode === 'gap' && !p.click ? ' Today the click drops out for 2 bars in every 4: keep the tempo yourself.'
        : click.mode === '24' && !p.click ? ' Today the click only plays on 2 and 4: you place 1 and 3.' : '';
      return base({
        title: `${p.name}${p.zh ? ` ${p.zh}` : ''}`,
        chips: [['Grid', sixEight ? '8ths' : grids], ['Meter', sixEight ? '6/8' : `${p.meter}/4`], ['Click', clickName]],
        how: p.how + extra, why: p.why,
        notes: [], dots: [], npb: Math.max(...p.bars.map((b) => b.grid)),
        grade: 'rhythm', rhythm: { id: p.id, click }, startBpm: p.bpm,
        tempoKey: `rhythm:${p.id}:tempo`, cues: p.cues,
      });
    },
  };

  // ---------- the plan ----------
  const BLOCKS = {
    warmup: { name: 'Warm-up', share: 0.08, per: 6, min: 5, max: 10 },
    technique: { name: 'Technique', share: 0.09, per: 5 },
    rhythm: { name: 'Rhythm', share: 0.1, per: 5, maxSlots: 2 }, // one family: at most two in a row
    fretboard: { name: 'Fretboard', share: 0.09, per: 5 },
    scales: { name: 'Scales & sequences', share: 0.2, per: 5 },
    arps: { name: 'Arpeggios & triads', share: 0.15, per: 5 },
    connect: { name: 'Connect the neck', share: 0.09, per: 5 },
    apply: { name: 'Apply it', share: 0.12, per: 7 },
    review: { name: 'Review', share: 0.08, per: 5 },
  };
  const ORDER = ['warmup', 'technique', 'rhythm', 'fretboard', 'scales', 'arps', 'connect', 'apply', 'review'];
  const FOCI = { pent: 'Pentatonic & blues', scales: 'Scales & modes', arps: 'Arpeggios & triads', metal: 'Metal', tech: 'Technique' };

  function chooseKey(ctx, style) {
    if (ctx.keyMode === 'fixed') return ctx.fixedKey;
    if (style === 'metal') return ctx.rng() < 0.6 ? 4 : ctx.keyOfDay;
    if (style === 'blues') return ctx.rng() < 0.45 ? 9 : ctx.keyOfDay;
    return ctx.rng() < 0.7 ? ctx.keyOfDay : pick(ctx.rng, [9, 4, 7, 2, 0]);
  }

  const tagOk = (c, fam, focus) => {
    const tags = c.tags || fam.tags;
    return tags.includes('*') || tags.some((t) => focus.has(t));
  };

  // Integer minutes per block (largest remainder), and exercise lengths inside each.
  function allocate(minutes, focus) {
    const breaks = minutes >= 50 ? Math.floor((minutes + 5) / 35) : 0;
    const playing = minutes - breaks * 2;
    const on = ORDER.filter((b) => b !== 'technique' || focus.has('tech'));
    const shareSum = on.reduce((a, b) => a + BLOCKS[b].share, 0);
    const raw = on.map((b) => {
      let v = (playing * BLOCKS[b].share) / shareSum;
      if (BLOCKS[b].min) v = Math.max(BLOCKS[b].min, Math.min(BLOCKS[b].max, v));
      return { block: b, v };
    });
    const fixed = raw.filter((r) => BLOCKS[r.block].min).reduce((a, r) => a + r.v, 0);
    const flexSum = raw.filter((r) => !BLOCKS[r.block].min).reduce((a, r) => a + r.v, 0);
    for (const r of raw) if (!BLOCKS[r.block].min) r.v = (r.v * (playing - fixed)) / flexSum;
    const out = raw.map((r) => ({ block: r.block, minutes: Math.floor(r.v), rem: r.v - Math.floor(r.v) }));
    let left = playing - out.reduce((a, r) => a + r.minutes, 0);
    [...out].sort((a, b) => b.rem - a.rem).forEach((r) => { if (left > 0) { r.minutes++; left--; } });
    return { blocks: out.map(({ block, minutes: m }) => ({ block, minutes: m })), breaks };
  }

  function splitMinutes(total, per, maxSlots = Infinity) {
    const n = Math.max(1, Math.min(maxSlots, Math.round(total / per)));
    const b = Math.floor(total / n);
    const out = Array(n).fill(b);
    for (let i = 0; i < total - b * n; i++) out[i]++;
    return out;
  }

  // How many prerequisites deep a candidate is from being ready (0 = ready now). A skill can have
  // several candidates with different needs; the easiest one counts.
  function unmetDepth(need, ctx, seen = new Set()) {
    let depth = 0;
    for (const [id, min] of need || []) {
      if (ctx.learner.mastery(id) >= min) continue;
      if (seen.has(id)) { depth = Math.max(depth, 1); continue; }
      seen.add(id);
      const alts = ctx.needs.get(id) || [[]];
      depth = Math.max(depth, 1 + Math.min(...alts.map((n) => unmetDepth(n, ctx, new Set(seen)))));
    }
    return depth;
  }

  function weightOf(c, ctx) {
    const L = ctx.learner;
    const m = L.mastery(c.skill);
    let w = c.base == null ? 1 : c.base;
    if (m < 0.3) w *= ctx.newCount >= ctx.newCap ? 0.3 : 1.5; // new material, up to a cap
    else if (m < 0.8) w *= 1.3; // consolidating: the sweet spot
    else w *= 0.5; // mastered: mostly left to review
    const due = L.dueIn(c.skill, ctx.today);
    if (due != null && due <= 0) w *= 1.4 + Math.min(1, -due / 10);
    if (L.skills[c.skill] && L.skills[c.skill].last === ctx.today) w *= 0.5;
    w *= 0.4 ** (ctx.usedFams.get(c.fam) || 0);
    if (ctx.lastFam === c.fam) w *= 0.35;
    if (ctx.usedVariants.has(variantOf(c))) w *= 0.3;
    if (c.stretch) w *= 0.2;
    return w;
  }
  const variantOf = (c) => `${c.fam}:${c.scaleId || c.chordId || c.rule || c.prog || c.modeId || c.set || c.cat || ''}`;

  function buildExercise(desc, opts = {}) {
    const o = { tuning: T.TUNINGS.standard, maxFret: 19, ...opts };
    const fam = FAM[desc.fam];
    const ex = fam && fam.build(desc, o);
    if (!ex) return null;
    if (ex.grade === 'seq' && ex.notes.length < 2) return null;
    for (const n of [...ex.notes, ...ex.dots]) if (n.f < 0 || n.f > 22) return null;
    ex.skill = desc.skill;
    ex.fam = desc.fam;
    ex.famName = fam.name;
    return ex;
  }

  function poolFor(block, ctx) {
    const pool = [];
    for (const fam of Object.values(FAM)) {
      if (!fam.blocks.includes(block)) continue;
      for (const c of fam.cands(ctx)) if (tagOk(c, fam, ctx.focus)) pool.push(c);
    }
    // The warm-up shape is the box you know best, played straight.
    if (block === 'warmup') {
      const best = [1, 2, 3, 4, 5].reduce((b, k) => (ctx.learner.mastery(`box:minPent:${k}`) > ctx.learner.mastery(`box:minPent:${b}`) ? k : b), 1);
      return pool.filter((c) => c.fam !== 'shape').concat([{ fam: 'shape', system: 'pos', scaleId: 'minPent', k: best, skill: `box:minPent:${best}`, base: 1, tags: ['*'], forceSeq: 'straight' }]);
    }
    if (block === 'review') {
      // Skills you've practiced: the weak ones and the ones due come back.
      const out = [];
      for (const [id, k] of Object.entries(ctx.learner.skills)) {
        if (!k.cand || !FAM[k.cand.fam] || ctx.usedSkills.has(id)) continue;
        const due = ctx.learner.dueIn(id, ctx.today);
        if (due != null && due > 0 && k.m >= 0.6) continue;
        const { forceSeq, ...cand } = k.cand;
        out.push({ ...cand, base: 1 + (1 - k.m) * 2 + (due != null && due <= 0 ? Math.min(2, -due / 3) : 0), need: [], review: true });
      }
      if (out.length) return out;
      // Nothing to review yet: revisit today's new material in another key.
      return ctx.todayNew.map((d) => ({ ...d, base: 1, need: [], review: true, again: true }));
    }
    return pool;
  }

  // Candidates for a slot: never a skill already in the plan (review revisits on purpose), and only
  // from the readiest tier: everything that's ready now, or, if nothing is, what's next in line.
  function candidatesFor(block, ctx) {
    let pool = poolFor(block, ctx);
    if (block !== 'review') {
      const fresh = pool.filter((c) => !ctx.usedSkills.has(c.skill));
      if (fresh.length) pool = fresh;
    }
    // Readiness: each family offers its readiest variants; a family whose best is one step short of
    // the readiest tier still shows up now and then (weight × 0.2), so a block isn't one family all day.
    const depth = new Map(pool.map((c) => [c, c.review ? 0 : unmetDepth(c.need, ctx)]));
    const min = Math.min(...depth.values());
    const famMin = new Map();
    for (const c of pool) famMin.set(c.fam, Math.min(famMin.has(c.fam) ? famMin.get(c.fam) : Infinity, depth.get(c)));
    const out = pool.filter((c) => depth.get(c) === famMin.get(c.fam) && depth.get(c) <= min + 1);
    for (const c of out) c.stretch = depth.get(c) > min;
    return out;
  }

  function makeCtx({ rng, learner, date, focus, keyMode, key }) {
    const ctx = {
      rng, learner, today: date, focus: new Set(focus && focus.length ? focus : ['pent']), keyMode, fixedKey: key, keyOfDay: keyOfDay(date),
      usedSkills: new Set(), usedFams: new Map(), usedVariants: new Set(), lastFam: null, newCount: 0, newCap: 2, todayNew: [], needs: new Map(),
    };
    for (const fam of Object.values(FAM)) {
      for (const c of fam.cands(ctx)) {
        if (!ctx.needs.has(c.skill)) ctx.needs.set(c.skill, []);
        ctx.needs.get(c.skill).push(c.need || []);
      }
    }
    return ctx;
  }

  function choose(block, ctx) {
    const pool = candidatesFor(block, ctx);
    for (let tries = 0; tries < 12 && pool.length; tries++) {
      // Family first (so a family with many variants doesn't crowd out one with a few), then the variant.
      const fams = new Map();
      for (const x of pool) { if (!fams.has(x.fam)) fams.set(x.fam, []); fams.get(x.fam).push(x); }
      const fam = weighted(ctx.rng, [...fams.keys()], (f) => Math.max(...fams.get(f).map((x) => weightOf(x, ctx))));
      if (!fam) break;
      const c = weighted(ctx.rng, fams.get(fam), (x) => weightOf(x, ctx));
      if (!c) break;
      const { need, review, again, stretch, ...cand } = c;
      // A revisit keeps the shape but moves it to another key.
      const d = FAM[c.fam].make(again ? { ...cand } : cand, again ? { ...ctx, keyMode: ctx.keyMode, keyOfDay: T.mod12(ctx.keyOfDay + 7) } : ctx);
      if (again && d.key === c.key && ctx.keyMode !== 'fixed') d.key = T.mod12(d.key + 5);
      if (buildExercise(d, { maxFret: ctx.maxFret })) return d;
      pool.splice(pool.indexOf(c), 1);
    }
    return null;
  }

  // The core paths. Every session includes the next step on the path for your focus that you haven't
  // consolidated yet (mastery < 0.6): one in the scales block, one in the arpeggio block.
  const PATHS = [
    { focus: '*', block: 'rhythm', skills: ['eighths', 'sixteenths', 'triplets', 'pop', 'ballad16', 'gap22', 'chuck24', 'tresillo', 'funk'].map((id) => `rhythm:${id}`) },
    { focus: 'metal', block: 'rhythm', skills: ['chug8', 'chug16', 'gallop', 'threes', 'sixteenSext'].map((id) => `rhythm:${id}`) },
    { focus: 'pent', block: 'scales', skills: [1, 2, 3, 4, 5].map((k) => `box:minPent:${k}`) },
    { focus: 'scales', block: 'scales', skills: [1, 2, 3, 4, 5].map((k) => `pos:aeolian:${k}`) },
    { focus: 'metal', block: 'scales', skills: [1, 2, 3, 4, 5, 6, 7].map((k) => `nps3:aeolian:${k}`) },
    { focus: 'arps', block: 'arps', skills: [1, 2, 3, 4, 5].map((k) => `arp:min:${k}`) },
    { focus: 'pent', block: 'arps', skills: [1, 2, 3, 4, 5].map((k) => `arp:min:${k}`) },
  ];
  function frontier(ctx) {
    const out = new Map();
    for (const p of PATHS) {
      if ((p.focus !== '*' && !ctx.focus.has(p.focus)) || out.has(p.block)) continue;
      for (const skill of p.skills) {
        if (ctx.learner.mastery(skill) >= 0.6) continue;
        const c = poolFor(p.block, ctx).find((x) => x.skill === skill);
        if (c && unmetDepth(c.need, ctx) === 0) out.set(p.block, { ...c, need: [], base: 1 });
        break;
      }
    }
    return out;
  }

  function note(ctx, desc) {
    if (ctx.learner.mastery(desc.skill) < 0.3) { ctx.newCount++; ctx.todayNew.push(desc); }
    ctx.usedSkills.add(desc.skill);
    ctx.usedFams.set(desc.fam, (ctx.usedFams.get(desc.fam) || 0) + 1);
    ctx.usedVariants.add(variantOf(desc));
    ctx.lastFam = desc.fam;
  }

  // Build today's plan. Returns { items: [{ uid, kind: 'ex' | 'rest', block, minutes, desc }] }.
  function buildPlan({ date, minutes = 90, focus = ['pent', 'scales', 'arps', 'metal', 'tech'], keyMode = 'rotate', key = 9, learner, seed = 0, maxFret = 19 }) {
    const rng = mulberry32(hashStr(`${date}|${seed}`));
    const ctx = makeCtx({ rng, learner, date, focus, keyMode, key });
    ctx.maxFret = maxFret;
    const { blocks, breaks } = allocate(minutes, ctx.focus);
    const slots = [];
    for (const b of blocks) for (const m of splitMinutes(b.minutes, BLOCKS[b.block].per, BLOCKS[b.block].maxSlots)) slots.push({ block: b.block, minutes: m });
    ctx.newCap = Math.max(2, Math.round(slots.length * 0.25));
    const items = [];
    let uid = 0;
    const next = frontier(ctx);
    for (const slot of slots) {
      let desc = null;
      const f = next.get(slot.block);
      if (f) {
        next.delete(slot.block);
        const { need, ...cand } = f;
        const d = FAM[f.fam].make(cand, ctx);
        if (buildExercise(d, { maxFret })) desc = { ...d, focus: true };
      }
      if (!desc) desc = choose(slot.block, ctx);
      if (!desc) continue;
      note(ctx, desc);
      items.push({ uid: `x${uid++}`, kind: 'ex', block: slot.block, minutes: slot.minutes, desc });
    }
    // Close any gap from dropped slots by stretching the longest exercises.
    let diff = minutes - breaks * 2 - items.reduce((a, x) => a + x.minutes, 0);
    const exs = [...items].sort((a, b) => b.minutes - a.minutes);
    for (let i = 0; diff > 0 && exs.length; i++, diff--) exs[i % exs.length].minutes++;
    // Breaks near every ~30 minutes, between exercises.
    for (let b = 1; b <= breaks; b++) {
      const target = (minutes * b) / (breaks + 1);
      let t = 0;
      let at = items.length;
      for (let i = 0; i < items.length; i++) { t += items[i].minutes; if (t >= target) { at = i + 1; break; } }
      items.splice(at, 0, { uid: `r${b}`, kind: 'rest', block: 'rest', minutes: 2 });
    }
    return { date, seed, minutes, items, keyOfDay: ctx.keyOfDay };
  }

  // Swap one exercise for another from the same block.
  function reroll(plan, index, { learner, focus, keyMode, key, maxFret = 19, salt = 1 }) {
    const item = plan.items[index];
    if (!item || item.kind !== 'ex') return null;
    const rng = mulberry32(hashStr(`${plan.date}|${plan.seed}|${index}|${salt}`));
    const ctx = makeCtx({ rng, learner, date: plan.date, focus, keyMode, key });
    ctx.maxFret = maxFret;
    ctx.newCap = 99;
    for (const x of plan.items) if (x.kind === 'ex') note(ctx, x.desc);
    ctx.newCount = 0;
    ctx.lastFam = item.desc.fam;
    return choose(item.block, ctx);
  }

  // ---------- graders ----------
  // Ordered notes, looping. Each picked note either hits the next note, skips one (the skipped one is
  // missed), or is wrong. A bend counts when you reach the target pitch from the note below it.
  class SeqGrader {
    constructor(ex, { strictOctave = true } = {}) {
      this.ex = ex;
      this.notes = ex.notes;
      this.n = ex.notes.length;
      this.matchPc = ex.matchPc || !strictOctave;
      this.cleanNeeded = this.n <= 40 ? 3 : this.n <= 90 ? 2 : 1;
      this.passes = [];
      this.cleanStreak = 0;
      this.i = 0;
      this.pass = this.newPass();
    }
    newPass() { return { hits: 0, miss: 0, wrong: 0, devs: [], cents: [], states: new Array(this.n).fill(null) }; }
    same(midi, target) { return this.matchPc ? mod12(midi) === mod12(target) : midi === target; }
    advance(events) {
      this.i++;
      this.armed = false;
      this.hold = null;
      if (this.i >= this.n) {
        const p = this.pass;
        const acc = Math.min(1, p.hits / (this.n + 0.5 * p.wrong));
        const timing = p.devs.length >= Math.min(4, this.n / 2) ? p.devs.reduce((a, b) => a + Math.abs(b), 0) / p.devs.length * 1000 : null;
        const cents = p.cents.length ? p.cents.reduce((a, b) => a + b, 0) / p.cents.length : null;
        const clean = acc >= 0.9 && (!this.ex.timing || timing == null || timing <= 60);
        this.cleanStreak = clean ? this.cleanStreak + 1 : 0;
        const result = { acc, timing, cents, clean, hits: p.hits, wrong: p.wrong, miss: p.miss, n: this.n, states: p.states };
        this.passes.push(result);
        events.push({ kind: 'pass', result });
        this.i = 0;
        this.pass = this.newPass();
      }
    }
    hit(dev, cents, events) {
      const p = this.pass;
      p.hits++;
      p.states[this.i] = 'hit';
      if (dev != null) p.devs.push(dev);
      if (cents != null) p.cents.push(cents);
      events.push({ kind: 'hit', i: this.i, cents });
      this.advance(events);
    }
    note(midi, dev = null) {
      const events = [];
      const cur = this.notes[this.i];
      if (cur.bend) {
        if (this.same(midi, cur.from)) { this.armed = true; events.push({ kind: 'arm', i: this.i }); return events; }
        if (this.same(midi, cur.midi)) { this.hit(null, null, events); return events; }
      } else if (this.same(midi, cur.midi)) { this.hit(dev, null, events); return events; }
      const nx = this.notes[(this.i + 1) % this.n];
      if (this.n > 2 && !cur.bend && !nx.bend && this.same(midi, nx.midi)) {
        this.pass.miss++;
        this.pass.states[this.i] = 'miss';
        events.push({ kind: 'miss', i: this.i });
        this.advance(events);
        this.hit(dev, null, events);
        return events;
      }
      this.pass.wrong++;
      events.push({ kind: 'wrong', i: this.i, midi });
      return events;
    }
    // Pitch frames, for bends: the target held for 70 ms after the note below was picked.
    frame(info, t) {
      const cur = this.notes[this.i];
      if (!cur || !cur.bend || !this.armed || info.midi == null) return [];
      const dev = info.midi + info.cents / 100 - cur.midi;
      if (Math.abs(dev) <= 0.45) {
        if (!this.hold) this.hold = { t0: t, cents: [] };
        this.hold.cents.push(dev * 100);
        if (t - this.hold.t0 >= 0.07) {
          const c = this.hold.cents.slice().sort((a, b) => a - b)[Math.floor(this.hold.cents.length / 2)];
          const events = [];
          this.hit(null, c, events);
          return events;
        }
      } else {
        this.hold = null;
        if (dev < -0.45 && dev > -1.6) return [{ kind: 'under', i: this.i, cents: dev * 100 }];
      }
      return [];
    }
    // 0–1 for the learner, or null without a single finished pass.
    score() {
      const recent = this.passes.slice(-3);
      if (!recent.length) {
        const p = this.pass;
        const tried = p.hits + p.miss;
        return tried >= 8 ? Math.min(1, p.hits / (tried + 0.5 * p.wrong)) * 0.9 : null;
      }
      const acc = recent.reduce((a, r) => a + r.acc, 0) / recent.length;
      const tim = recent.filter((r) => r.timing != null);
      const t = tim.length ? tim.reduce((a, r) => a + r.timing, 0) / tim.length : null;
      const tf = !this.ex.timing || t == null ? 1 : t <= 35 ? 1 : t <= 60 ? 0.93 : t <= 90 ? 0.85 : 0.75;
      return clamp01(acc * tf);
    }
  }

  // Free playing: how many notes fit the rule (scale, chord tones, guide tones), and landings on beat 1.
  // at: { bar, beat (0–4 within the bar), chord } for the moment the note was played, or null.
  class FreeGrader {
    constructor(ex) {
      this.ex = ex;
      this.total = 0;
      this.good = 0;
      this.flavor = 0;
      this.landed = 0;
      this.landTotal = 0;
      this.judged = new Set();
    }
    allowedAt(at) {
      const ex = this.ex;
      const scale = new Set(ex.allowed || []);
      if (!ex.chords || !at) return scale;
      const chord = ex.chords[at.chord % ex.chords.length];
      const next = ex.chords[(at.chord + 1) % ex.chords.length];
      const tones = (ch) => {
        const st = S.CHORDS[ch.chordId].steps;
        if (ex.allowMode === 'guide') return [st[1], st.length > 3 ? st[3] : st[2]].map((x) => mod12(ch.root + x));
        return ch.pcs;
      };
      const out = ex.allowMode === 'scale+chord' ? new Set([...scale, ...chord.pcs]) : new Set(tones(chord));
      // Anticipating the next chord by a fraction of a beat is fine.
      if (at.beat > 3.6 && ex.allowMode !== 'scale+chord') for (const pc of tones(next)) out.add(pc);
      return out;
    }
    landTargets(bar) {
      const ex = this.ex;
      if (ex.land === 'qa') {
        const pos = ((bar % 4) + 4) % 4;
        if (pos === 1) return new Set([mod12(ex.keyPc + 7)]);
        if (pos === 3) return new Set([mod12(ex.keyPc)]);
        return null;
      }
      if (!ex.chords) return null;
      const ch = ex.chords[((bar % ex.chords.length) + ex.chords.length) % ex.chords.length];
      if (ex.land === 'third') return new Set([mod12(ch.root + S.CHORDS[ch.chordId].steps[1])]);
      if (ex.land === 'chord') return new Set(ch.pcs);
      return null;
    }
    note(midi, at) {
      const pc = mod12(midi);
      const ok = this.allowedAt(at).has(pc);
      this.total++;
      if (ok) this.good++;
      if (this.ex.flavorPc != null && pc === this.ex.flavorPc) this.flavor++;
      let land = null;
      if (at && this.ex.land && (at.beat < 0.5 || at.beat > 3.75)) {
        const bar = at.beat > 3.75 ? at.bar + 1 : at.bar;
        const targets = this.landTargets(bar);
        if (targets && !this.judged.has(bar)) {
          this.judged.add(bar);
          this.landTotal++;
          land = targets.has(pc);
          if (land) this.landed++;
        }
      }
      return { ok, land, pc };
    }
    get ratio() { return this.total ? this.good / this.total : null; }
    score() {
      if (this.total < 8) return null;
      const r = this.good / this.total;
      if (this.ex.land && this.landTotal >= 3) return clamp01(0.55 * r + 0.45 * (this.landed / this.landTotal));
      return clamp01(r);
    }
  }

  // Rhythm: each pass's timing summary (Rhythm.summarize and judgePass), kept across pauses.
  class RhythmGrade {
    constructor(ex) { this.ex = ex; this.passes = []; this.cleanStreak = 0; }
    pass(st, verdict) {
      this.passes.push({ hitRate: st.hitRate, bias: st.bias, spread: st.spread, extras: st.extras, n: st.n, score: st.score, clean: verdict.clean });
      this.cleanStreak = verdict.clean ? this.cleanStreak + 1 : 0;
    }
    // 0–1 for the learner: the last three passes, or null before a full pass.
    score() {
      const recent = this.passes.slice(-3);
      return recent.length ? clamp01(recent.reduce((a, p) => a + p.score, 0) / recent.length) : null;
    }
  }

  const api = {
    hashStr, mulberry32, weighted, dayNum, daysBetween, keyOfDay, preferFlat,
    RHYTHM, START_BPM, MIN_BPM, MAX_BPM, tempoStep, SEQS, seqIndices, SEQ_NPB, SEQ_HOW, PROGS, chordsOf,
    SCALE_WHY, shapeSkill, Learner, FAM, BLOCKS, ORDER, FOCI, CUES, allocate, splitMinutes, buildPlan, buildExercise, reroll,
    SeqGrader, FreeGrader, RhythmGrade,
  };
  root.SessionGen = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
