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

module.exports = {
  TUNINGS, stringName, SHARP, FLAT, OPEN_MIDI, STRING_NAME, INTERVAL, INTERVAL_FULL, SCALES, CHORDS,
  mod12, pc, midi, pcAt, semis, intervalLabel, spellIn, noteName, role, pcsOf,
  positions, scalePitchesFrom, npsPattern, pentBox, chordTonesIn, closedTriads, fingering, harmonize, normalizeName,
};
