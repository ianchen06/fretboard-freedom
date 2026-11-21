// Tests stand mode's pure helpers (stand.js): pedal keys, start notes, the zoomed fret window.
// Run: node web/test/stand.test.js
'use strict';
const St = require('../js/stand.js');

let failures = 0;
const check = (ok, msg) => { if (!ok) { failures++; console.log('  FAIL', msg); } };

// Pedal keys: page turners type arrows or page keys.
for (const k of ['ArrowRight', 'ArrowDown', 'PageDown']) check(St.pedalOf(k) === 'right', `${k} is the right pedal`);
for (const k of ['ArrowLeft', 'ArrowUp', 'PageUp']) check(St.pedalOf(k) === 'left', `${k} is the left pedal`);
for (const k of [' ', 'Enter', 'n', 'Escape']) check(St.pedalOf(k) === null, `${JSON.stringify(k)} is no pedal`);

// Start notes match in any octave; 'any' starts on anything; null never.
check(St.startsOn(57, 45) && St.startsOn(69, 45) && St.startsOn(45.3, 45), 'A starts an A exercise in any octave');
check(!St.startsOn(58, 45), 'B♭ does not start an A exercise');
check(St.startsOn(40, 'any') && !St.startsOn(40, null), "'any' and null");

// Fret windows: a box plus a fret each side, at least 6 frets, open strings near the nut.
const w1 = St.fretWindow([5, 7, 8]);
check(w1.from === 4 && w1.to === 9, `box at 5–8 shows 4–9 (${w1.from}–${w1.to})`);
check(w1.width < 1000, 'a narrow window draws bigger (a narrower viewBox)');
const w2 = St.fretWindow([2, 3, 5]);
check(w2.from === 0 && w2.to >= 6, `near the nut: from the open strings (${w2.from}–${w2.to})`);
const w3 = St.fretWindow([18, 20, 21], 22);
check(w3.to === 22 && w3.to - w3.from >= 5, `at the top of the neck: still 6 frets (${w3.from}–${w3.to})`);
const w4 = St.fretWindow([0, 15]);
check(w4.width === 1000, 'a whole-neck run keeps the full width');
check(St.fretWindow([]) === null, 'no notes: no window');
for (let lo = 0; lo <= 20; lo++) {
  const w = St.fretWindow([lo, lo + 2], 22);
  check(w.from <= lo && w.to >= Math.min(22, lo + 2) && w.from >= 0 && w.to <= 22 && w.to - w.from >= 5, `window around ${lo}–${lo + 2} holds it`);
}

console.log(failures ? `\n${failures} failure(s)` : '\nall stand tests passed');
process.exit(failures ? 1 : 0);
