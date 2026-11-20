// Scales, chords and the shapes guitarists play them in. Every shape is computed from pitches (no
// hand-drawn fret patterns), so it's right in any key and any tuning. No DOM.
//
// A shape is a list of notes { s, f, midi } in ascending pitch, low E string first.
// - position(root, scale, k): pentatonic box k (two notes per string, each string continuing the
//   scale where the string below stopped; box k starts on the k-th note of the minor pentatonic on
//   the low E string). Scales with more notes fill the same fret window: box k + the extra notes.
// - nps(root, scale, k, n): n notes on every string from the k-th scale note on the low E string
//   (n = 3: the 3-notes-per-string patterns; a pentatonic with n = 3 runs diagonally up the neck).
// - arpeggio(root, chord, k): the chord tones inside the fret window of pentatonic box k.
// - triadVoicings(root, chord, set): close triads on three adjacent strings, all inversions.
(function (root) {
  'use strict';
  const T = root.Theory;
  const { mod12 } = T;
  const PENT = [0, 3, 5, 7, 10];

  // ref: which pentatonic's boxes the scale's positions sit in ('maj' = the relative minor's boxes,
  // so C major lines up with the A minor boxes). flavor: the semitone that gives the scale its sound.
  const SCALES = {
    minPent: { name: 'Minor pentatonic', steps: [0, 3, 5, 7, 10], ref: 'min' },
    majPent: { name: 'Major pentatonic', steps: [0, 2, 4, 7, 9], ref: 'maj' },
    blues: { name: 'Blues scale', steps: [0, 3, 5, 6, 7, 10], ref: 'min', flavor: 6 },
    aeolian: { name: 'Natural minor', steps: [0, 2, 3, 5, 7, 8, 10], ref: 'min', flavor: 8 },
    ionian: { name: 'Major scale', steps: [0, 2, 4, 5, 7, 9, 11], ref: 'maj' },
    dorian: { name: 'Dorian', steps: [0, 2, 3, 5, 7, 9, 10], ref: 'min', flavor: 9 },
    mixolydian: { name: 'Mixolydian', steps: [0, 2, 4, 5, 7, 9, 10], ref: 'maj', flavor: 10 },
    phrygian: { name: 'Phrygian', steps: [0, 1, 3, 5, 7, 8, 10], ref: 'min', flavor: 1 },
    lydian: { name: 'Lydian', steps: [0, 2, 4, 6, 7, 9, 11], ref: 'maj', flavor: 6 },
    harmMinor: { name: 'Harmonic minor', steps: [0, 2, 3, 5, 7, 8, 11], ref: 'min', flavor: 11 },
    phrygDom: { name: 'Phrygian dominant', steps: [0, 1, 4, 5, 7, 8, 10], ref: 'min', flavor: 1 },
  };

  const CHORDS = {
    maj: { sym: '', name: 'major', steps: [0, 4, 7] },
    min: { sym: 'm', name: 'minor', steps: [0, 3, 7] },
    dim: { sym: '°', name: 'diminished', steps: [0, 3, 6] },
    dom7: { sym: '7', name: 'dominant 7', steps: [0, 4, 7, 10] },
    min7: { sym: 'm7', name: 'minor 7', steps: [0, 3, 7, 10] },
    maj7: { sym: 'maj7', name: 'major 7', steps: [0, 4, 7, 11] },
    m7b5: { sym: 'm7♭5', name: 'half-diminished', steps: [0, 3, 6, 10] },
    dim7: { sym: '°7', name: 'diminished 7', steps: [0, 3, 6, 9] },
  };

  const STRING_SETS = {
    gbe: { name: 'G-B-e', strings: [3, 2, 1] },
    dgb: { name: 'D-G-B', strings: [4, 3, 2] },
    adg: { name: 'A-D-G', strings: [5, 4, 3] },
    ead: { name: 'E-A-D', strings: [6, 5, 4] },
  };

  const DEG = ['R', '♭2', '2', '♭3', '3', '4', '♭5', '5', '♭6', '6', '♭7', '7'];

  function degreeLabel(semi, { scaleId = null, chordId = null } = {}) {
    if (scaleId === 'lydian' && semi === 6) return '♯4';
    if (chordId === 'dim7' && semi === 9) return '°7';
    return DEG[mod12(semi)];
  }

  // The deck's color roles: root red, 3rd amber, 5th blue, 7th purple, flavor/blue note teal.
  function scaleRole(semi, scaleId) {
    const flavor = scaleId ? SCALES[scaleId].flavor : null;
    if (semi === 0) return 'root';
    if (flavor != null && semi === flavor) return 'flavor';
    if (semi === 3 || semi === 4) return 'third';
    if (semi === 7) return 'fifth';
    if (semi === 10 || semi === 11) return 'seventh';
    if (semi === 6) return 'flavor';
    return 'other';
  }
  function chordRole(semi) {
    if (semi === 0) return 'root';
    if (semi === 3 || semi === 4) return 'third';
    if (semi >= 6 && semi <= 8) return 'fifth';
    if (semi >= 9) return 'seventh';
    return 'other';
  }

  const pcsOf = (rootPc, steps) => new Set(steps.map((x) => mod12(rootPc + x)));
  function nextPitch(pcs, p) {
    for (let q = p + 1; q <= p + 12; q++) if (pcs.has(mod12(q))) return q;
    return null;
  }
  function atOrAbove(pcs, p) {
    for (let q = p; q < p + 12; q++) if (pcs.has(mod12(q))) return q;
    return null;
  }
  function span(notes) {
    let lo = Infinity;
    let hi = -Infinity;
    for (const n of notes) { lo = Math.min(lo, n.f); hi = Math.max(hi, n.f); }
    return { lo, hi };
  }

  // n consecutive scale pitches on each string, low E to high e.
  function perString(pcs, startMidi, n, tuning) {
    const out = [];
    let p = startMidi;
    for (const s of [6, 5, 4, 3, 2, 1]) {
      for (let i = 0; i < n; i++) {
        out.push({ s, f: p - tuning.open[s], midi: p });
        p = nextPitch(pcs, p);
      }
    }
    return out;
  }

  // Every pitch of the set inside a fret window, ascending, one place each. A string takes pitches
  // until the next one would pass the window's top fret; then the next string takes over. A string
  // may reach one fret below the window (the usual stretch), and keeps a pitch rather than hand it to
  // a string where it would sit below that.
  function windowWalk(pcs, lo, hi, tuning) {
    const out = [];
    const floor = Math.max(0, lo - 1);
    let p = atOrAbove(pcs, tuning.open[6] + lo);
    for (const s of [6, 5, 4, 3, 2, 1]) {
      const nextOpen = s > 1 ? tuning.open[s - 1] : null;
      for (;;) {
        const f = p - tuning.open[s];
        if (f > hi && (nextOpen === null || p - nextOpen >= floor)) break;
        if (f > hi + 2) break;
        out.push({ s, f, midi: p });
        p = nextPitch(pcs, p);
      }
    }
    return out;
  }

  // Octave placements of a shape that fit on the neck: off the open strings first, then lowest.
  function placements(build, maxFret) {
    const out = [];
    for (const o of [-24, -12, 0, 12, 24]) {
      const notes = build(o);
      if (!notes || !notes.length) continue;
      const { lo, hi } = span(notes);
      if (lo >= 0 && hi <= maxFret) out.push({ notes, lo, hi });
    }
    out.sort((a, b) => ((a.lo >= 1) === (b.lo >= 1) ? a.lo - b.lo : a.lo >= 1 ? -1 : 1));
    return out;
  }

  // Minor pentatonic box k of `minorRoot`, placed on the neck: { notes, lo, hi }[] (best first).
  function boxPlacements(minorRoot, k, tuning, maxFret) {
    const pcs = pcsOf(minorRoot, PENT);
    const base = tuning.open[6] + mod12(minorRoot - tuning.open[6]);
    return placements((o) => perString(pcs, base + PENT[k - 1] + o, 2, tuning), maxFret);
  }

  const DEFAULTS = { tuning: T.TUNINGS.standard, maxFret: 19, alt: 0 };

  function annotateScale(notes, rootPc, scaleId) {
    return notes.map((n) => {
      const semi = mod12(n.midi - rootPc);
      return { ...n, semi, label: degreeLabel(semi, { scaleId }), role: scaleRole(semi, scaleId) };
    });
  }
  function annotateChord(notes, rootPc, chordId) {
    return notes.map((n) => {
      const semi = mod12(n.midi - rootPc);
      return { ...n, semi, label: degreeLabel(semi, { chordId }), role: chordRole(semi) };
    });
  }

  // Scale position k (1–5). Returns { notes, lo, hi, alts } or null if it doesn't fit.
  function position(rootPc, scaleId, k, opts = {}) {
    const { tuning, maxFret, alt } = { ...DEFAULTS, ...opts };
    const sc = SCALES[scaleId];
    const ref = sc.ref === 'maj' ? mod12(rootPc - 3) : rootPc;
    const boxes = boxPlacements(ref, k, tuning, maxFret);
    if (!boxes.length) return null;
    const box = boxes[Math.min(alt, boxes.length - 1)];
    const pcs = pcsOf(rootPc, sc.steps);
    const raw = sc.steps.length === 5 && sc.steps.every((x) => pcsOf(ref, PENT).has(mod12(rootPc + x)))
      ? box.notes
      : windowWalk(pcs, box.lo, box.hi, tuning);
    const notes = annotateScale(raw, rootPc, scaleId);
    const { lo, hi } = span(notes);
    if (lo < 0 || hi > maxFret + 1) return null;
    return { notes, lo, hi, alts: boxes.length };
  }

  // n-notes-per-string pattern k (1..number of scale notes).
  function nps(rootPc, scaleId, k, opts = {}) {
    const { tuning, maxFret, alt, n = 3 } = { ...DEFAULTS, ...opts };
    const sc = SCALES[scaleId];
    const pcs = pcsOf(rootPc, sc.steps);
    const base = tuning.open[6] + mod12(rootPc - tuning.open[6]);
    const opts2 = placements((o) => perString(pcs, base + sc.steps[k - 1] + o, n, tuning), maxFret);
    if (!opts2.length) return null;
    const pick = opts2[Math.min(alt, opts2.length - 1)];
    return { notes: annotateScale(pick.notes, rootPc, scaleId), lo: pick.lo, hi: pick.hi, alts: opts2.length };
  }

  // Chord tones in the window of minor pentatonic box k of `windowRoot` (default: the chord's root).
  // `window` ({ lo, hi }) overrides the box.
  function arpeggio(rootPc, chordId, k, opts = {}) {
    const { tuning, maxFret, alt, windowRoot = rootPc, window = null } = { ...DEFAULTS, ...opts };
    let w = window;
    if (!w) {
      const boxes = boxPlacements(windowRoot, k, tuning, maxFret);
      if (!boxes.length) return null;
      w = boxes[Math.min(alt, boxes.length - 1)];
    }
    const raw = windowWalk(pcsOf(rootPc, CHORDS[chordId].steps), w.lo, w.hi, tuning);
    const notes = annotateChord(raw, rootPc, chordId);
    const { lo, hi } = span(notes);
    if (!notes.length || lo < 0 || hi > maxFret + 1) return null;
    return { notes, lo, hi, window: { lo: w.lo, hi: w.hi } };
  }

  // Close-position triads on a string set: [{ inv, notes, lo, hi }], every inversion and fret.
  function triadVoicings(rootPc, chordId, setId, opts = {}) {
    const { tuning, maxFret } = { ...DEFAULTS, ...opts };
    const steps = CHORDS[chordId].steps.slice(0, 3);
    const strings = STRING_SETS[setId].strings;
    const out = [];
    for (let inv = 0; inv < 3; inv++) {
      const pcs = [0, 1, 2].map((i) => mod12(rootPc + steps[(inv + i) % 3]));
      for (let f = 0; f <= maxFret; f++) {
        const p0 = tuning.open[strings[0]] + f;
        if (mod12(p0) !== pcs[0]) continue;
        const p1 = p0 + (mod12(pcs[1] - p0) || 12);
        const p2 = p1 + (mod12(pcs[2] - p1) || 12);
        const fr = [f, p1 - tuning.open[strings[1]], p2 - tuning.open[strings[2]]];
        if (fr.some((x) => x < 0 || x > maxFret)) continue;
        if (Math.max(...fr) - Math.min(...fr) > 4) continue;
        const notes = annotateChord([p0, p1, p2].map((midi, i) => ({ s: strings[i], f: fr[i], midi })), rootPc, chordId);
        out.push({ inv, notes, lo: Math.min(...fr), hi: Math.max(...fr) });
      }
    }
    return out.sort((a, b) => a.lo - b.lo);
  }

  // Every scale note on one string between two frets.
  function oneString(rootPc, scaleId, s, from, to, opts = {}) {
    const { tuning } = { ...DEFAULTS, ...opts };
    const pcs = pcsOf(rootPc, SCALES[scaleId].steps);
    const raw = [];
    for (let f = from; f <= to; f++) if (pcs.has(mod12(tuning.open[s] + f))) raw.push({ s, f, midi: tuning.open[s] + f });
    return annotateScale(raw, rootPc, scaleId);
  }

  const chordName = (rootPc, chordId, preferFlat = false) => T.noteName(rootPc, preferFlat) + CHORDS[chordId].sym;

  // The scale's note names, spelled by degree (one letter per degree: A Phrygian has B♭, not A♯;
  // the blue note of A is E♭). → { root, names (one per step), flat, byPc }. See Theory.spellSet.
  function spellScale(rootPc, scaleId, preferFlat = false) {
    const steps = SCALES[scaleId].steps;
    // The blues scale is the minor pentatonic plus one note: it keeps the pentatonic's name for the root.
    const root = scaleId === 'blues' ? spellScale(rootPc, 'minPent', preferFlat).root : null;
    return T.spellSet(rootPc, steps, steps.map((x) => degreeLabel(x, { scaleId })), preferFlat, root);
  }
  // A chord's tones named from its root's name (thirds stacked by letter): ('D', 'dom7') → D F♯ A C.
  function spellChord(rootName, chordId) {
    const flat = rootName.includes('♭');
    const rootPc = T.pcOf(rootName);
    return CHORDS[chordId].steps.map((x) => T.spellAbove(rootName, x, T.letterSteps(degreeLabel(x, { chordId }))) || T.noteName(rootPc + x, flat));
  }
  // Letter steps of a chord root above the key's tonic, by semitones (♭2, 2, ♭3, 3, 4, ♭5, 5 …).
  const ROOT_LETTERS = [0, 1, 1, 2, 2, 3, 4, 4, 5, 5, 6, 6];
  // The name of the chord root `off` semitones above a tonic called `tonic`: ('E♭', 8) → 'C♭'.
  const rootNameIn = (tonic, off, preferFlat = false) => T.spellAbove(tonic, off, ROOT_LETTERS[mod12(off)]) || T.noteName(T.pcOf(tonic) + off, preferFlat);

  const api = {
    SCALES, CHORDS, STRING_SETS, PENT, DEG,
    degreeLabel, scaleRole, chordRole, pcsOf, nextPitch, span,
    perString, windowWalk, boxPlacements, position, nps, arpeggio, triadVoicings, oneString, chordName,
    spellScale, spellChord, rootNameIn,
    annotateScale, annotateChord,
  };
  root.Scales = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
