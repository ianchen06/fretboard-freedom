// Music-theory engine: every note, interval, scale and chord position in the deck is computed here.
// String numbering follows guitar convention: 1 = high e ... 6 = low E. Standard tuning.

const SHARP = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const FLAT = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

const OPEN_MIDI = { 1: 64, 2: 59, 3: 55, 4: 50, 5: 45, 6: 40 }; // E4 B3 G3 D3 A2 E2
const STRING_NAME = { 1: 'e', 2: 'B', 3: 'G', 4: 'D', 5: 'A', 6: 'E' };

// Interval names by semitone distance from the root, with the scale degree each one spells.
const INTERVAL = ['R', '♭2', '2', '♭3', '3', '4', '♭5', '5', '♭6', '6', '♭7', '7'];
const INTERVAL_DEGREE = [1, 2, 2, 3, 3, 4, 5, 5, 6, 6, 7, 7];
const INTERVAL_FULL = [
  'Unison / root', 'Minor 2nd', 'Major 2nd', 'Minor 3rd', 'Major 3rd', 'Perfect 4th',
  'Tritone (♭5)', 'Perfect 5th', 'Minor 6th', 'Major 6th', 'Minor 7th', 'Major 7th',
];

const mod12 = (n) => ((n % 12) + 12) % 12;

function normalizeName(name) {
  return String(name).replace(/#/g, '♯').replace(/(?<=[A-G])b/g, '♭');
}

// Pitch class (0-11) of a note name such as 'A', 'C♯', 'Bb', 'E♭'.
function pc(name) {
  const n = normalizeName(name);
  const m = n.match(/^([A-G])([♯♭]*)$/);
  if (!m) throw new Error(`Bad note name: ${name}`);
  let v = LETTER_PC[m[1]];
  for (const ch of m[2]) v += ch === '♯' ? 1 : -1;
  return mod12(v);
}

// Alternate tunings (open-string MIDI notes, string 1 = highest). `flat` spells string names with flats.
const TUNINGS = {
  standard: { id: 'standard', name: 'Standard', short: 'E A D G B E', open: { 1: 64, 2: 59, 3: 55, 4: 50, 5: 45, 6: 40 }, flat: false },
  eflat: { id: 'eflat', name: 'E♭ standard', short: 'E♭ A♭ D♭ G♭ B♭ E♭', open: { 1: 63, 2: 58, 3: 54, 4: 49, 5: 44, 6: 39 }, flat: true },
  dropD: { id: 'dropD', name: 'Drop D', short: 'D A D G B E', open: { 1: 64, 2: 59, 3: 55, 4: 50, 5: 45, 6: 38 }, flat: false },
  dStandard: { id: 'dStandard', name: 'D standard', short: 'D G C F A D', open: { 1: 62, 2: 57, 3: 53, 4: 48, 5: 43, 6: 38 }, flat: true },
  dropC: { id: 'dropC', name: 'Drop C', short: 'C G C F A D', open: { 1: 62, 2: 57, 3: 53, 4: 48, 5: 43, 6: 36 }, flat: true },
};
const openOf = (tuning) => (tuning ? tuning.open : OPEN_MIDI);
// midi/pcAt take an optional tuning (a TUNINGS entry); standard tuning when omitted.
const midi = (s, f, tuning) => openOf(tuning)[s] + f;
const pcAt = (s, f, tuning) => mod12(midi(s, f, tuning));
// String label: high string lowercase, as in tab.
function stringName(s, tuning) {
  if (!tuning || tuning.id === 'standard') return STRING_NAME[s];
  const n = (tuning.flat ? FLAT : SHARP)[mod12(openOf(tuning)[s])];
  return s === 1 ? n[0].toLowerCase() + n.slice(1) : n;
}
const semis = (rootName, notePc) => mod12(notePc - pc(rootName));
const intervalLabel = (rootName, notePc) => INTERVAL[semis(rootName, notePc)];

// Spell a pitch class correctly relative to a root, e.g. spellIn('A', pc('C#')) = 'C♯', spellIn('A', 3) = 'E♭' (blue note).
function spellIn(rootName, notePc, intervalOverride) {
  const root = normalizeName(rootName);
  const s = semis(root, notePc);
  const degree = intervalOverride || INTERVAL_DEGREE[s];
  const rootLetterIdx = LETTERS.indexOf(root[0]);
  const letter = LETTERS[(rootLetterIdx + degree - 1) % 7];
  let diff = mod12(notePc - LETTER_PC[letter]);
  if (diff > 6) diff -= 12;
  const acc = diff > 0 ? '♯'.repeat(diff) : '♭'.repeat(-diff);
  return letter + acc;
}

// Plain name for a pitch class with no key context.
const noteName = (p, preferFlat = false) => (preferFlat ? FLAT : SHARP)[mod12(p)];

// Role drives the color code: root, third, fifth, seventh, blue (special), other.
function role(semitones) {
  switch (mod12(semitones)) {
    case 0: return 'root';
    case 3: case 4: return 'third';
    case 7: return 'fifth';
    case 10: case 11: return 'seventh';
    case 6: return 'blue';
    default: return 'other';
  }
}

const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10], // natural minor / Aeolian
  minPent: [0, 3, 5, 7, 10],
  majPent: [0, 2, 4, 7, 9],
  blues: [0, 3, 5, 6, 7, 10],
  majBlues: [0, 2, 3, 4, 7, 9],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  harmMinor: [0, 2, 3, 5, 7, 8, 11],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  locrian: [0, 1, 3, 5, 6, 8, 10],
};

const CHORDS = {
  maj: [0, 4, 7], min: [0, 3, 7], dim: [0, 3, 6], aug: [0, 4, 8], pow: [0, 7],
  dom7: [0, 4, 7, 10], maj7: [0, 4, 7, 11], min7: [0, 3, 7, 10], m7b5: [0, 3, 6, 10], sus4: [0, 5, 7], sus2: [0, 2, 7],
};

const pcsOf = (rootName, intervals) => intervals.map((i) => mod12(pc(rootName) + i));

// Every fret position whose pitch class is in the set.
function positions(pcs, { strings = [1, 2, 3, 4, 5, 6], from = 0, to = 15, tuning } = {}) {
  const set = new Set(pcs);
  const out = [];
  for (const s of strings) for (let f = from; f <= to; f++) if (set.has(pcAt(s, f, tuning))) out.push({ s, f });
  return out;
}

// Ascending scale pitches starting at startMidi.
function scalePitchesFrom(rootName, intervals, startMidi, count) {
  const set = new Set(pcsOf(rootName, intervals));
  const out = [];
  for (let m = startMidi; out.length < count; m++) if (set.has(mod12(m))) out.push(m);
  return out;
}

// N-notes-per-string pattern: walks up the scale from (6, startFret), putting n notes on each string.
function npsPattern(rootName, intervals, startFret, n, strings = [6, 5, 4, 3, 2, 1]) {
  const pitches = scalePitchesFrom(rootName, intervals, midi(strings[0], startFret), n * strings.length);
  const out = [];
  strings.forEach((s, i) => {
    for (let k = 0; k < n; k++) {
      const m = pitches[i * n + k];
      out.push({ s, f: m - OPEN_MIDI[s] });
    }
  });
  return out;
}

// Pentatonic box k (1-5). Box 1 starts on the root on the low E string.
function pentBox(rootName, k, { major = false, shiftOctave = 0 } = {}) {
  const ivs = major ? SCALES.majPent : SCALES.minPent;
  let rootFret = mod12(pc(rootName) - OPEN_MIDI[6]);
  if (rootFret === 0 && !major) rootFret = 0;
  const startFret = rootFret + ivs[k - 1] + 12 * shiftOctave;
  return npsPattern(rootName, ivs, startFret, 2);
}

// Every chord tone of a chord within a fret window, on chosen strings.
function chordTonesIn(rootName, chordIntervals, from, to, strings = [1, 2, 3, 4, 5, 6]) {
  return positions(pcsOf(rootName, chordIntervals), { strings, from, to });
}

// Closed triad voicings on a 3-string set (e.g. [3,2,1]): each one starts on a chord tone on the lowest string.
function closedTriads(rootName, chordIntervals, stringSet = [3, 2, 1], to = 15) {
  const set = new Set(pcsOf(rootName, chordIntervals));
  const voicings = [];
  const low = stringSet[0];
  for (let f = 0; f <= to; f++) {
    if (!set.has(pcAt(low, f))) continue;
    const notes = [{ s: low, f }];
    let prev = midi(low, f);
    let ok = true;
    for (const s of stringSet.slice(1)) {
      let m = prev + 1;
      while (!set.has(mod12(m))) m++;
      const fr = m - OPEN_MIDI[s];
      if (fr < 0 || fr > to) { ok = false; break; }
      notes.push({ s, f: fr });
      prev = m;
    }
    if (!ok) continue;
    const lowSemis = semis(rootName, pcAt(low, f));
    const inversion = lowSemis === 0 ? 'Root position' : (lowSemis === 3 || lowSemis === 4) ? '1st inversion' : '2nd inversion';
    voicings.push({ notes, inversion });
  }
  return voicings;
}

// Parse a fingering string like 'x02220' (low E -> high e). Multi-digit frets use dots: 'x.12.11.9.10.9'.
function fingering(str) {
  const parts = str.includes('.') ? str.split('.') : str.split('');
  if (parts.length !== 6) throw new Error(`Fingering needs 6 strings: ${str}`);
  const out = [];
  parts.forEach((p, i) => { if (p !== 'x') out.push({ s: 6 - i, f: Number(p) }); });
  return out;
}

// Diatonic triads for a major or minor key: [{numeral, rootName, quality}].
function harmonize(keyName, mode = 'major') {
  const ivs = mode === 'major' ? SCALES.major : SCALES.minor;
  const names = ivs.map((i, d) => spellIn(keyName, mod12(pc(keyName) + i), d + 1));
  const numerals = mode === 'major'
    ? ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']
    : ['i', 'ii°', '♭III', 'iv', 'v', '♭VI', '♭VII'];
  return ivs.map((iv, d) => {
    const third = mod12(ivs[(d + 2) % 7] - iv);
    const fifth = mod12(ivs[(d + 4) % 7] - iv);
    const quality = third === 4 ? 'maj' : fifth === 7 ? 'min' : 'dim';
    const suffix = quality === 'maj' ? '' : quality === 'min' ? 'm' : '°';
    return { numeral: numerals[d], rootName: names[d], quality, name: names[d] + suffix };
  });
}

// ---------- letter-aware spelling (Theory Intensive) ----------
// Degree labels: '1', 'b3', '#4', 'bb7', '9', '#11', 'b13' (ASCII b/# or ♭/♯). Double sharps/flats print as ♯♯ / ♭♭.
const MAJOR_SEMIS = [0, 2, 4, 5, 7, 9, 11];
const mod7 = (n) => ((n % 7) + 7) % 7;
const PERFECT_NUMS = new Set([1, 4, 5]);

function accidental(diff) { return diff > 0 ? '♯'.repeat(diff) : '♭'.repeat(-diff); }
// Name a pitch class using a given letter (e.g. letter 'E', pc 3 -> 'E♭').
function spellWithLetter(letter, notePc) {
  let diff = mod12(notePc - LETTER_PC[letter]);
  if (diff > 6) diff -= 12;
  if (Math.abs(diff) > 2) throw new Error(`Cannot spell pc ${notePc} with letter ${letter}`);
  return letter + accidental(diff);
}

function parseDegree(label) {
  const s = String(label).replace(/#/g, '♯').replace(/b/g, '♭');
  const m = s.match(/^([♯♭]*)(\d+)$/);
  if (!m) throw new Error(`Bad degree label: ${label}`);
  const acc = [...m[1]].reduce((a, c) => a + (c === '♯' ? 1 : -1), 0);
  const num = Number(m[2]);
  const steps = (num - 1) % 7;
  return { num, steps, semis: mod12(MAJOR_SEMIS[steps] + acc) };
}
// Pretty degree label: 'b3' -> '♭3', 'bb7' -> '♭♭7'.
const prettyDegree = (label) => String(label).replace(/#/g, '♯').replace(/b/g, '♭');

// Spell one degree above a root: spellDegree('A', 'b3') = 'C', spellDegree('C', 'bb7') = 'B♭♭'.
function spellDegree(root, label) {
  const R = normalizeName(root);
  const d = parseDegree(label);
  const letter = LETTERS[(LETTERS.indexOf(R[0]) + d.steps) % 7];
  return spellWithLetter(letter, mod12(pc(R) + d.semis));
}

const FORMULAS = {
  // scales
  major: ['1', '2', '3', '4', '5', '6', '7'],
  ionian: ['1', '2', '3', '4', '5', '6', '7'],
  dorian: ['1', '2', 'b3', '4', '5', '6', 'b7'],
  phrygian: ['1', 'b2', 'b3', '4', '5', 'b6', 'b7'],
  lydian: ['1', '2', '3', '#4', '5', '6', '7'],
  mixolydian: ['1', '2', '3', '4', '5', '6', 'b7'],
  aeolian: ['1', '2', 'b3', '4', '5', 'b6', 'b7'],
  minor: ['1', '2', 'b3', '4', '5', 'b6', 'b7'],
  locrian: ['1', 'b2', 'b3', '4', 'b5', 'b6', 'b7'],
  harmonicMinor: ['1', '2', 'b3', '4', '5', 'b6', '7'],
  melodicMinor: ['1', '2', 'b3', '4', '5', '6', '7'],
  phrygianDominant: ['1', 'b2', '3', '4', '5', 'b6', 'b7'],
  majPent: ['1', '2', '3', '5', '6'],
  minPent: ['1', 'b3', '4', '5', 'b7'],
  blues: ['1', 'b3', '4', 'b5', '5', 'b7'],
};
const SCALE_NAMES = {
  major: 'Major (Ionian)', ionian: 'Ionian', dorian: 'Dorian', phrygian: 'Phrygian', lydian: 'Lydian', mixolydian: 'Mixolydian',
  aeolian: 'Aeolian', minor: 'Natural minor', locrian: 'Locrian', harmonicMinor: 'Harmonic minor', melodicMinor: 'Melodic minor',
  phrygianDominant: 'Phrygian dominant', majPent: 'Major pentatonic', minPent: 'Minor pentatonic', blues: 'Blues',
};
// Chord formulas keyed by the suffix printed after the root (so the key IS the chord symbol).
const CHORD_FORMULAS = {
  '': ['1', '3', '5'], m: ['1', 'b3', '5'], '°': ['1', 'b3', 'b5'], '+': ['1', '3', '#5'], 5: ['1', '5'],
  sus2: ['1', '2', '5'], sus4: ['1', '4', '5'], 6: ['1', '3', '5', '6'], m6: ['1', 'b3', '5', '6'], add9: ['1', '3', '5', '9'], madd9: ['1', 'b3', '5', '9'],
  maj7: ['1', '3', '5', '7'], 7: ['1', '3', '5', 'b7'], m7: ['1', 'b3', '5', 'b7'], 'm7♭5': ['1', 'b3', 'b5', 'b7'], '°7': ['1', 'b3', 'b5', 'bb7'],
  'm(maj7)': ['1', 'b3', '5', '7'], '+maj7': ['1', '3', '#5', '7'], '+7': ['1', '3', '#5', 'b7'], '7sus4': ['1', '4', '5', 'b7'],
  maj9: ['1', '3', '5', '7', '9'], 9: ['1', '3', '5', 'b7', '9'], m9: ['1', 'b3', '5', 'b7', '9'], 11: ['1', '5', 'b7', '9', '11'], m11: ['1', 'b3', '5', 'b7', '9', '11'],
  13: ['1', '3', '5', 'b7', '9', '13'], m13: ['1', 'b3', '5', 'b7', '9', '13'], maj13: ['1', '3', '5', '7', '9', '13'],
  '7♭9': ['1', '3', '5', 'b7', 'b9'], '7♯9': ['1', '3', '5', 'b7', '#9'], '7♯11': ['1', '3', '5', 'b7', '#11'], '7♭13': ['1', '3', '5', 'b7', 'b13'],
  'maj7♯11': ['1', '3', '5', '7', '#11'], '7alt': ['1', '3', 'b7', 'b9', '#9', 'b13'],
};
const spellFormula = (root, formula) => formula.map((d) => spellDegree(root, d));
function spellScale(root, kind) {
  if (!FORMULAS[kind]) throw new Error(`Unknown scale ${kind}`);
  return spellFormula(root, FORMULAS[kind]);
}
function spellChord(root, suffix = '') {
  const f = CHORD_FORMULAS[suffix];
  if (!f) throw new Error(`Unknown chord suffix "${suffix}"`);
  return spellFormula(root, f);
}

// Interval name from note a up to note b, by letters: intervalName('C', 'A♭') = 'm6', ('F♯', 'C') = 'd5'.
// Same letter and pitch gives 'P1'; pass { octave: true } to call that 'P8'.
function intervalName(a, b, { octave = false } = {}) {
  const A = normalizeName(a); const B = normalizeName(b);
  const steps = mod7(LETTERS.indexOf(B[0]) - LETTERS.indexOf(A[0]));
  const num = steps + 1;
  let diff = mod12(pc(B) - pc(A)) - MAJOR_SEMIS[steps];
  if (diff > 6) diff -= 12;
  if (diff < -6) diff += 12;
  let q;
  if (PERFECT_NUMS.has(num)) q = { 0: 'P', 1: 'A', '-1': 'd', 2: 'AA', '-2': 'dd' }[diff];
  else q = { 0: 'M', '-1': 'm', 1: 'A', '-2': 'd', 2: 'AA', '-3': 'dd' }[diff];
  if (!q) throw new Error(`Unnameable interval ${a}→${b}`);
  return num === 1 && octave && q === 'P' ? 'P8' : q + num;
}
function parseInterval(iv) {
  const m = String(iv).match(/^(AA|dd|P|M|m|A|d)(\d+)$/);
  if (!m) throw new Error(`Bad interval ${iv}`);
  const num = Number(m[2]); const steps = (num - 1) % 7; const simple = steps + 1;
  const perfect = PERFECT_NUMS.has(simple);
  if (perfect && (m[1] === 'M' || m[1] === 'm')) throw new Error(`${iv}: ${simple} is a perfect interval`);
  if (!perfect && m[1] === 'P') throw new Error(`${iv}: ${simple} is not a perfect interval`);
  const off = { P: 0, M: 0, m: -1, A: 1, AA: 2, d: perfect ? -1 : -2, dd: perfect ? -2 : -3 }[m[1]];
  return { q: m[1], num, steps, simple, semis: MAJOR_SEMIS[steps] + off + (num > 7 ? 12 * Math.floor((num - 1) / 7) : 0) };
}
// Half steps in an interval: intervalSemitones('m6') = 8, ('M9') = 14.
const intervalSemitones = (iv) => parseInterval(iv).semis;
// Note a given interval above / below a note: noteAbove('B♭', 'M3') = 'D', noteBelow('E', 'm3') = 'C♯'.
function noteAbove(root, iv) {
  const R = normalizeName(root); const p = parseInterval(iv);
  return spellWithLetter(LETTERS[(LETTERS.indexOf(R[0]) + p.steps) % 7], mod12(pc(R) + p.semis));
}
function noteBelow(root, iv) {
  const R = normalizeName(root); const p = parseInterval(iv);
  return spellWithLetter(LETTERS[mod7(LETTERS.indexOf(R[0]) - p.steps)], mod12(pc(R) - p.semis));
}
// Inversion within the octave: m3 <-> M6, P4 <-> P5, A4 <-> d5.
function invertInterval(iv) {
  const p = parseInterval(iv);
  const q = { P: 'P', M: 'm', m: 'M', A: 'd', d: 'A', AA: 'dd', dd: 'AA' }[p.q];
  return q + (9 - p.simple);
}
const INTERVAL_LONG = { P: 'Perfect', M: 'Major', m: 'Minor', A: 'Augmented', d: 'Diminished', AA: 'Doubly augmented', dd: 'Doubly diminished' };
const ORDINAL = { 1: 'unison', 2: '2nd', 3: '3rd', 4: '4th', 5: '5th', 6: '6th', 7: '7th', 8: 'octave', 9: '9th', 10: '10th', 11: '11th', 12: '12th', 13: '13th' };
function intervalLong(iv) { const p = parseInterval(iv); return `${INTERVAL_LONG[p.q]} ${ORDINAL[p.num]}`; }

// Key signature of a major or minor key: { count, type: '♯'|'♭'|'', notes (in signature order), relative }.
const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
const FLAT_ORDER = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];
function keySignature(key, mode = 'major') {
  const major = mode === 'major' ? normalizeName(key) : noteAbove(key, 'm3');
  const notes = spellScale(major, 'major');
  const sharps = notes.filter((n) => n.includes('♯')).map((n) => n[0]);
  const flats = notes.filter((n) => n.includes('♭')).map((n) => n[0]);
  if (sharps.length && flats.length) throw new Error(`Mixed signature for ${key}`);
  if (notes.some((n) => n.length > 2)) throw new Error(`Theoretical key ${key} ${mode}`);
  const relative = mode === 'major' ? noteBelow(major, 'm3') : major;
  if (sharps.length) return { count: sharps.length, type: '♯', notes: SHARP_ORDER.filter((l) => sharps.includes(l)).map((l) => `${l}♯`), relative };
  if (flats.length) return { count: flats.length, type: '♭', notes: FLAT_ORDER.filter((l) => flats.includes(l)).map((l) => `${l}♭`), relative };
  return { count: 0, type: '', notes: [], relative };
}
const sigLabel = (sig) => (sig.count ? `${sig.count}${sig.type}` : 'none');

// Quality of a stacked chord from its semitone content above the root.
const TRIAD_Q = { '4,7': '', '3,7': 'm', '3,6': '°', '4,8': '+' };
const SEVENTH_Q = { '4,7,11': 'maj7', '4,7,10': '7', '3,7,10': 'm7', '3,6,10': 'm7♭5', '3,6,9': '°7', '3,7,11': 'm(maj7)', '4,8,11': '+maj7', '4,8,10': '+7' };
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
// Roman numeral for a chord on scale step `steps` (0-6) whose root lies `rootSemis` above the tonic, with a chord suffix.
function numeralFor(steps, rootSemis, suffix) {
  let diff = rootSemis - MAJOR_SEMIS[steps];
  if (diff > 6) diff -= 12;
  if (diff < -6) diff += 12;
  const minorish = ['m', '°', 'm7', 'm7♭5', '°7', 'm(maj7)', 'm6', 'm9', 'm11'].includes(suffix);
  let n = ROMAN[steps]; if (minorish) n = n.toLowerCase();
  const tail = { '': '', m: '', '°': '°', '+': '+', maj7: 'maj7', 7: '7', m7: '7', 'm7♭5': 'ø7', '°7': '°7', 'm(maj7)': '(maj7)', '+maj7': '+maj7', '+7': '+7' }[suffix] ?? suffix;
  return accidental(diff) + n + tail;
}
// Diatonic chords of any 7-note scale: diatonicChords('C', 'major', 4) -> [{ numeral:'Imaj7', root:'C', suffix:'maj7', name:'Cmaj7', notes }...].
function diatonicChords(key, kind = 'major', size = 3) {
  const f = FORMULAS[kind];
  if (!f || f.length !== 7) throw new Error(`diatonicChords needs a 7-note scale, got ${kind}`);
  const names = spellScale(key, kind);
  const pcs = names.map(pc);
  return names.map((root, d) => {
    const idx = [0, 2, 4, 6].slice(0, size).map((k) => (d + k) % 7);
    const st = idx.slice(1).map((i) => mod12(pcs[i] - pcs[d]));
    const suffix = (size === 3 ? TRIAD_Q : SEVENTH_Q)[st.join(',')];
    if (suffix === undefined) throw new Error(`Unknown stack ${st} on ${root}`);
    const rootSemis = mod12(pcs[d] - pc(key));
    return { degree: d + 1, numeral: numeralFor(d, rootSemis, suffix), root, suffix, name: root + suffix, notes: idx.map((i) => names[i]) };
  });
}
// Dominant 7 chord that resolves to a target root: dominantOf('D') = 'A7'.
const dominantOf = (target) => `${noteAbove(target, 'P5')}7`;

module.exports = {
  TUNINGS, stringName, SHARP, FLAT, OPEN_MIDI, STRING_NAME, INTERVAL, INTERVAL_FULL, SCALES, CHORDS,
  mod12, pc, midi, pcAt, semis, intervalLabel, spellIn, noteName, role, pcsOf,
  positions, scalePitchesFrom, npsPattern, pentBox, chordTonesIn, closedTriads, fingering, harmonize, normalizeName,
  // Theory Intensive
  LETTERS, MAJOR_SEMIS, FORMULAS, SCALE_NAMES, CHORD_FORMULAS, SHARP_ORDER, FLAT_ORDER,
  parseDegree, prettyDegree, spellDegree, spellFormula, spellScale, spellChord, spellWithLetter,
  intervalName, parseInterval, intervalSemitones, noteAbove, noteBelow, invertInterval, intervalLong,
  keySignature, sigLabel, numeralFor, diatonicChords, dominantOf,
};
