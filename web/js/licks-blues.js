// Blues lick library for the Call & response practice.
//
// Written by an AI (Claude) as a one-time draft, then checked note by note by the rule checker in
// lickgen.js (scale, reach, techniques, timing). The test suite fails if any entry breaks a rule.
// At run time the generator picks from these, joins 1-bar cells into 2-bar phrases, moves them to
// your key and swaps endings to fit the chords.
//
// Everything is written in A, minor pentatonic box 1 (root on the low E string, fret 5), so the
// tab reads like real tab. The generator shifts it to other keys.
//
// Time: 12 ticks per beat, 48 per bar. In a shuffle the "and" of a beat lands on tick 8 of it
// (triplet feel): beats 0 12 24 36, ands 8 20 32 44. Triplets step by 4, sixteenths by 3.
//
// A note is [tick, token, duration]. Token grammar:
//   [h|p|s] string fret [b<fret> | r] [~]
//   string: E A D G B e (low to high)    h = hammer-on, p = pull-off, s = slide in (no new pick)
//   b<fret> = bend until it sounds like that fret    r = release a bend back to the fret
//   ~ = vibrato
(function (root) {
  'use strict';

  // One-bar cells. role: 'open' = good first bar (a question), 'end' = good second bar (an answer
  // that lands), 'any' = either.
  const CELLS = [
    { id: 'bend-five-root', name: 'Bend, 5th, root', role: 'end', notes: [[0, 'G7b9', 12], [12, 'B5', 8], [20, 'e5~', 28]] },
    { id: 'triplet-cascade', name: 'Triplet cascade', role: 'any', notes: [[0, 'e8', 4], [4, 'e5', 4], [8, 'B8', 4], [12, 'B5', 4], [16, 'G7', 4], [20, 'G5', 4], [24, 'D7~', 24]] },
    { id: 'curl-settle', name: 'Curl and settle', role: 'end', notes: [[0, 'G5b6', 8], [8, 'D7', 4], [12, 'D5', 12], [24, 'hD7~', 24]] },
    { id: 'unison-stutter', name: 'Unison-bend stutter', role: 'open', notes: [[0, 'B8b10', 8], [8, 'e5', 4], [12, 'B8b10', 8], [20, 'e5', 4], [24, 'B8b10', 12], [36, 'B8r', 12]] },
    { id: 'box-walk-up', name: 'Walk up the box', role: 'open', notes: [[0, 'E5', 8], [8, 'E8', 4], [12, 'A5', 8], [20, 'A7', 4], [24, 'D5', 8], [32, 'D7', 4], [36, 'G5', 12]] },
    { id: 'three-note-call', name: 'Three-note call', role: 'any', notes: [[0, 'B8', 8], [8, 'B5', 4], [12, 'G7~', 36]] },
    { id: 'root-pedal', name: 'Home to the root', role: 'end', notes: [[0, 'G5', 8], [8, 'G7', 4], [12, 'D7~', 36]] },
    { id: 'bend-release-resolve', name: 'Bend, release, resolve', role: 'end', notes: [[0, 'G7b9', 8], [8, 'G7r', 4], [12, 'G5', 12], [24, 'D7~', 24]] },
    { id: 'high-wail', name: 'High wail', role: 'any', notes: [[0, 'e8b10', 12], [12, 'e8r', 8], [20, 'e5', 4], [24, 'B8', 8], [32, 'e5~', 16]] },
    { id: 'low-growl', name: 'Low growl', role: 'any', notes: [[0, 'A5', 8], [8, 'A6', 4], [12, 'A7', 12], [24, 'E8', 8], [32, 'E5~', 16]] },
    { id: 'blue-climb', name: 'Blue-note climb', role: 'any', notes: [[0, 'A5', 8], [8, 'A6', 4], [12, 'A7', 8], [20, 'D5', 4], [24, 'D7~', 24]] },
    { id: 'sweet-sixth-fall', name: 'Sweet-sixth fall', role: 'end', notes: [[0, 'B8', 8], [8, 'B7', 4], [12, 'B5', 12], [24, 'G7', 8], [32, 'G5', 4], [36, 'D7~', 12]] },
    { id: 'question-b7', name: 'Question on the ♭7', role: 'open', notes: [[0, 'D7', 8], [8, 'G5', 4], [12, 'G7', 8], [20, 'B5', 4], [24, 'B8~', 24]] },
    { id: 'hammer-pull-triplets', name: 'Hammer-pull triplets', role: 'any', notes: [[0, 'G5', 4], [4, 'hG7', 4], [8, 'pG5', 4], [12, 'D7', 12], [24, 'G5', 4], [28, 'hG7', 4], [32, 'pG5', 4], [36, 'D7', 12]] },
    { id: 'slide-to-five', name: 'Slide to the 5th', role: 'open', notes: [[0, 'sB5~', 24], [24, 'G7', 8], [32, 'G5', 16]] },
    { id: 'low-walk-down', name: 'Walk down low', role: 'any', notes: [[0, 'D7', 8], [8, 'D5', 4], [12, 'A7', 8], [20, 'A5', 4], [24, 'E8', 8], [32, 'E5~', 16]] },
    { id: 'sixteenth-burst', name: 'Sixteenth burst', role: 'open', notes: [[0, 'e5', 3], [3, 'B8', 3], [6, 'B5', 3], [9, 'G7', 3], [12, 'e5', 3], [15, 'B8', 3], [18, 'B5', 3], [21, 'G7', 3], [24, 'e8b10', 12], [36, 'e5~', 12]] },
    { id: 'three-octaves', name: 'Three octaves', role: 'any', notes: [[0, 'E5', 12], [12, 'D7', 12], [24, 'e5~', 24]] },
    { id: 'bend-and-fall', name: 'Bend and fall', role: 'open', notes: [[0, 'G7b9', 12], [12, 'G7r', 12], [24, 'G5~', 24]] },
    { id: 'lazy-five', name: 'Lazy 5th', role: 'end', notes: [[8, 'B8', 4], [12, 'B5~', 36]] },
    { id: 'root-resolve', name: 'Root resolve', role: 'end', notes: [[0, 'e8', 8], [8, 'e5', 4], [12, 'B8', 12], [24, 'e5~', 24]] },
    { id: 'land-on-d', name: 'Land on D', role: 'end', notes: [[0, 'B5', 8], [8, 'G7', 4], [12, 'G5', 12], [24, 'G7~', 24]] },
    { id: 'land-on-e-low', name: 'Land on the low 5th', role: 'end', notes: [[0, 'D5', 8], [8, 'A7', 4], [12, 'A5', 12], [24, 'A7~', 24]] },
    { id: 'bend-to-d', name: 'Bend up to D', role: 'end', notes: [[0, 'e5', 8], [8, 'B8', 4], [12, 'e5', 12], [24, 'e8b10~', 24]] },
    { id: 'chromatic-climb', name: 'Chromatic climb', role: 'open', notes: [[0, 'A5', 4], [4, 'A6', 4], [8, 'A7', 4], [12, 'D5', 8], [20, 'D7', 4], [24, 'G5~', 24]] },
    { id: 'lazy-root', name: 'Lazy root', role: 'end', notes: [[0, 'B5', 12], [12, 'B8', 12], [24, 'e5~', 24]] },
    { id: 'b7-to-root', name: '♭7 to root', role: 'end', notes: [[0, 'D5', 12], [12, 'hD7~', 36]] },
    { id: 'turn-on-e', name: 'Climb to the 5th', role: 'end', notes: [[0, 'G5', 8], [8, 'G7', 4], [12, 'B5~', 36]] },
  ];

  // Two-bar licks, written whole.
  const LICKS = [
    { id: 'question-bend', name: 'Question bend', notes: [[0, 'B8b10', 12], [12, 'B8r', 8], [20, 'B5', 4], [24, 'G7', 12], [36, 'G5', 12], [48, 'D7~', 36]] },
    { id: 'triplet-loop', name: 'Triplet loop', notes: [[0, 'e8', 4], [4, 'e5', 4], [8, 'B8', 4], [12, 'e8', 4], [16, 'e5', 4], [20, 'B8', 4], [24, 'e8', 4], [28, 'e5', 4], [32, 'B8', 4], [36, 'B5', 12], [48, 'G7b9', 12], [60, 'B5', 12], [72, 'e5~', 24]] },
    { id: 'low-shuffle', name: 'Low shuffle', notes: [[0, 'E5', 8], [8, 'E8', 4], [12, 'A5', 8], [20, 'A7', 4], [24, 'A5', 12], [36, 'E8', 12], [48, 'E5~', 36]] },
    { id: 'blue-walk-up', name: 'Blue walk-up', notes: [[0, 'A5', 8], [8, 'A6', 4], [12, 'A7', 8], [20, 'D5', 4], [24, 'D7', 12], [36, 'G5', 8], [44, 'G5b6', 4], [48, 'D7~', 36]] },
    { id: 'unison-fall', name: 'Unison bends and fall', notes: [[0, 'B8b10', 8], [8, 'e5', 4], [12, 'B8b10', 8], [20, 'e5', 4], [24, 'e8', 8], [32, 'e5', 4], [36, 'B8', 12], [48, 'B5', 12], [60, 'G7', 8], [68, 'G5', 4], [72, 'D7~', 24]] },
    { id: 'high-root-call', name: 'High-root call', notes: [[0, 'e5~', 24], [24, 'e8', 8], [32, 'e5', 4], [36, 'B8', 12], [48, 'B5', 8], [56, 'G7', 4], [60, 'G7b9~', 36]] },
    { id: 'space-then-answer', name: 'Leave space, then answer', notes: [[24, 'G5', 8], [32, 'G7', 4], [36, 'B5', 12], [48, 'B8', 8], [56, 'B5', 4], [60, 'G7', 12], [72, 'D7~', 24]] },
    { id: 'simple-descent', name: 'Simple descent', notes: [[0, 'G7', 12], [12, 'G5', 12], [24, 'D7~', 36]] },
    { id: 'five-and-root', name: '5th and root', notes: [[0, 'B5', 12], [12, 'B8', 12], [24, 'B5', 24], [48, 'e5~', 36]] },
    { id: 'held-bend', name: 'Held bend', notes: [[0, 'G7b9~', 24], [24, 'B5', 12], [36, 'G7', 12], [48, 'D7~', 36]] },
    { id: 'target-d', name: 'Aim for D', notes: [[0, 'e5', 8], [8, 'B8', 4], [12, 'B5', 12], [24, 'G7', 12], [36, 'G5', 12], [48, 'G7~', 36]] },
    { id: 'target-e', name: 'Aim for the low 5th', notes: [[0, 'G5', 8], [8, 'G7', 4], [12, 'G5', 12], [24, 'D7', 12], [36, 'D5', 12], [48, 'A7~', 36]] },
    { id: 'sixteenth-run', name: 'Sixteenth-note run', notes: [[0, 'e8', 3], [3, 'e5', 3], [6, 'B8', 3], [9, 'e5', 3], [12, 'e8', 3], [15, 'e5', 3], [18, 'B8', 3], [21, 'e5', 3], [24, 'B8b10', 12], [36, 'B8r', 6], [42, 'B5', 6], [48, 'G7', 8], [56, 'G5', 4], [60, 'D7~', 36]] },
    { id: 'slow-hand', name: 'Slow hand', notes: [[0, 'sG7~', 24], [24, 'G5', 8], [32, 'D7', 16], [48, 'D5', 12], [60, 'hD7~', 36]] },
    { id: 'easy-five', name: 'Easy 5th', notes: [[0, 'G7', 12], [12, 'B5~', 36], [48, 'B8', 12], [60, 'B5~', 36]] },
    { id: 'easy-d', name: 'Easy D', notes: [[0, 'B5', 12], [12, 'G7~', 36], [48, 'G5', 12], [60, 'G7~', 36]] },
  ];

  const api = { blues: { name: 'Blues · minor pentatonic box 1', refKey: 'A', refRootFret: 5, cells: CELLS, licks: LICKS } };
  root.LickLibrary = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
