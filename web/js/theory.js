// Music-theory helpers for the practice app: a browser port of the parts of build/lib/theory.js it needs.
// String numbering follows guitar convention: 1 = high e ... 6 = low E.
(function (root) {
  'use strict';

  const SHARP = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
  const FLAT = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
  const NATURAL_PCS = [0, 2, 4, 5, 7, 9, 11];
  const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const STRINGS = [1, 2, 3, 4, 5, 6];

  // Open-string MIDI notes per tuning. `flat` spells string names with flats.
  const TUNINGS = {
    standard: { id: 'standard', name: 'Standard (E A D G B E)', open: { 1: 64, 2: 59, 3: 55, 4: 50, 5: 45, 6: 40 }, flat: false },
    eflat: { id: 'eflat', name: 'E♭ standard', open: { 1: 63, 2: 58, 3: 54, 4: 49, 5: 44, 6: 39 }, flat: true },
    dropD: { id: 'dropD', name: 'Drop D', open: { 1: 64, 2: 59, 3: 55, 4: 50, 5: 45, 6: 38 }, flat: false },
    dStandard: { id: 'dStandard', name: 'D standard', open: { 1: 62, 2: 57, 3: 53, 4: 48, 5: 43, 6: 38 }, flat: true },
    dropC: { id: 'dropC', name: 'Drop C', open: { 1: 62, 2: 57, 3: 53, 4: 48, 5: 43, 6: 36 }, flat: true },
  };

  // Up a 4th each step: the order the deck drills keys in.
  const CIRCLE_OF_FOURTHS = ['C', 'F', 'B♭', 'E♭', 'A♭', 'D♭', 'G♭', 'B', 'E', 'A', 'D', 'G'];

  const mod12 = (n) => ((n % 12) + 12) % 12;
  const isNatural = (pc) => NATURAL_PCS.includes(mod12(pc));

  function pcOf(name) {
    const m = String(name).replace(/#/g, '♯').match(/^([A-G])([♯♭b]*)$/);
    if (!m) throw new Error(`Bad note name: ${name}`);
    let v = LETTER_PC[m[1]];
    for (const ch of m[2]) v += ch === '♯' ? 1 : -1;
    return mod12(v);
  }

  const midiAt = (s, f, tuning) => tuning.open[s] + f;
  const pcAt = (s, f, tuning) => mod12(midiAt(s, f, tuning));
  const noteName = (pc, preferFlat = false) => (preferFlat ? FLAT : SHARP)[mod12(pc)];

  // Both spellings for an accidental, one for a natural: [primary, alternate?].
  function spellings(pc, preferFlat = false) {
    const p = mod12(pc);
    if (isNatural(p)) return [SHARP[p]];
    return preferFlat ? [FLAT[p], SHARP[p]] : [SHARP[p], FLAT[p]];
  }

  // ---------- spelling by letter ----------
  // A scale uses each letter once (A harmonic minor has G♯, not A♭) and a chord stacks every other
  // letter (D7 is D F♯ A C, not D G♭ A C), so a note's name depends on what it is in the scale or
  // chord, not only on its pitch.
  const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

  // The note `letters` letter names above `from`, `semis` semitones up, spelled on that letter:
  // ('D', 4, 2) → 'F♯', ('E♭', 8, 5) → 'C♭'. null if it would need a double sharp or flat.
  function spellAbove(from, semis, letters) {
    const m = String(from).replace(/#/g, '♯').match(/^([A-G])([♯♭]?)$/);
    if (!m) return null;
    const li = (LETTERS.indexOf(m[1]) + letters) % 7;
    let acc = mod12(pcOf(m[0]) + semis - NATURAL_PCS[li]);
    if (acc > 6) acc -= 12;
    if (Math.abs(acc) > 1) return null;
    return LETTERS[li] + (acc > 0 ? '♯' : acc < 0 ? '♭' : '');
  }

  // Letter steps of a degree label: 'R' → 0, '♭3' → 2, '♯4' → 3, '°7' → 6.
  const letterSteps = (label) => (label === 'R' ? 0 : Number(String(label).replace(/[^1-7]/g, '')) - 1);

  // Names for a set of degrees over a root: steps (semitones) with their degree labels. An accidental
  // root takes the spelling (sharp or flat) that needs fewer accidentals; preferFlat settles a tie.
  // A note that would need a double accidental takes its plain name. rootName fixes the root's spelling.
  // → { root, names, flat (how to name notes outside the set), byPc: { pitch class: name } }
  function spellSet(rootPc, steps, labels, preferFlat = false, rootName = null) {
    const attempt = (root) => {
      let cost = 0;
      const names = steps.map((x, i) => {
        const n = spellAbove(root, x, letterSteps(labels[i]));
        cost += n ? n.length - 1 : 2;
        return n;
      });
      return { root, names, cost };
    };
    const opts = (rootName ? [rootName] : spellings(rootPc, preferFlat)).map(attempt);
    const best = opts.length > 1 && opts[1].cost < opts[0].cost ? opts[1] : opts[0];
    const count = (ch) => best.names.filter((n) => n && n.includes(ch)).length;
    const flat = count('♭') !== count('♯') ? count('♭') > count('♯') : best.root.length > 1 ? best.root.includes('♭') : preferFlat;
    const names = best.names.map((n, i) => n || noteName(rootPc + steps[i], flat));
    const byPc = {};
    steps.forEach((x, i) => { byPc[mod12(rootPc + x)] = names[i]; });
    return { root: best.root, names, flat, byPc };
  }

  // Scientific pitch name, e.g. 55 -> 'G3'.
  function midiLabel(m, preferFlat = false) {
    const r = Math.round(m);
    return noteName(r, preferFlat) + (Math.floor(r / 12) - 1);
  }

  // String label: high string lowercase, as in tab.
  function stringName(s, tuning) {
    const n = noteName(tuning.open[s], tuning.flat);
    return s === 1 ? n[0].toLowerCase() + n.slice(1) : n;
  }

  // Long string name for prompts: 'low E', 'A', 'high e'.
  function stringLongName(s, tuning) {
    const n = noteName(tuning.open[s], tuning.flat);
    if (s === 6) return `low ${n}`;
    if (s === 1) return `high ${n[0].toLowerCase()}${n.slice(1)}`;
    return n;
  }

  // Every fret in [from, to] on string s whose pitch class is pc.
  function fretsFor(s, pc, tuning, from, to) {
    const out = [];
    for (let f = from; f <= to; f++) if (pcAt(s, f, tuning) === mod12(pc)) out.push(f);
    return out;
  }

  const freqToMidi = (f, a4 = 440) => 69 + 12 * Math.log2(f / a4);
  const midiToFreq = (m, a4 = 440) => a4 * 2 ** ((m - 69) / 12);

  const api = {
    SHARP, FLAT, NATURAL_PCS, STRINGS, TUNINGS, CIRCLE_OF_FOURTHS,
    mod12, isNatural, pcOf, midiAt, pcAt, noteName, spellings, spellAbove, letterSteps, spellSet,
    midiLabel, stringName, stringLongName, fretsFor, freqToMidi, midiToFreq,
  };
  root.Theory = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
