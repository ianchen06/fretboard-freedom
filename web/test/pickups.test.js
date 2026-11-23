// Tests the Pickup height page's logic (js/pickups.js): the Gibson and StewMac figures, units, what
// to turn and how far, and the level check.
// Run: node web/test/pickups.test.js
'use strict';
const P = require('../js/pickups.js');

let failures = 0;
const check = (ok, msg) => { if (!ok) { failures++; console.log('  FAIL', msg); } };
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;
const IN = 25.4;

console.log('the figures');
{
  // Gibson's factory setting: one gap per pickup, at the last fret: neck 3/32", bridge 1/16".
  const g = (pos, side) => P.target('gibson', 'humbucker', pos, side);
  check(near(g('neck', 'bass').inches, 3 / 32) && near(g('neck', 'treble').inches, 3 / 32), 'Gibson neck: 3/32" both sides');
  check(near(g('bridge', 'bass').inches, 1 / 16) && near(g('bridge', 'treble').inches, 1 / 16), 'Gibson bridge: 1/16" both sides');
  check(near(g('neck', 'bass').mm, 2.38125) && near(g('bridge', 'bass').mm, 1.5875), 'Gibson in mm: 2.4 and 1.6');
  check(g('neck', 'bass').own === true && P.target('gibson', 'soapbar', 'neck', 'bass').own === false, 'Gibson\'s figure is its humbuckers\', not a P-90 figure');
  // StewMac: 3/32" under the low E, 1/16" under the high E, for humbuckers and P-90s, either position.
  for (const pu of ['humbucker', 'soapbar', 'dogear']) {
    for (const pos of ['neck', 'bridge']) {
      const b = P.target('stewmac', pu, pos, 'bass');
      const t = P.target('stewmac', pu, pos, 'treble');
      check(near(b.inches, 3 / 32) && near(t.inches, 1 / 16) && b.own && t.own, `StewMac ${pu} ${pos}: 3/32" bass, 1/16" treble`);
    }
  }
  check(near(P.PICKUPS.humbucker.perTurnMm, IN / 48), 'a 3-48 height screw moves 1/48" a turn');
}

console.log('units');
{
  check(P.inchText(3 / 32) === '3/32″' && P.inchText(1 / 16) === '1/16″' && P.inchText(5 / 64) === '5/64″', `fractions: ${P.inchText(3 / 32)} ${P.inchText(1 / 16)} ${P.inchText(5 / 64)}`);
  check(P.inchText(1 / 8) === '1/8″' && P.inchText(1) === '1″' && P.inchText(1 + 1 / 16) === '1 1/16″' && P.inchText(0) === '0″', 'whole inches and zero');
  check(P.inchText(0.0938) === '3/32″', 'rounded to the nearest 64th');
  check(P.mmText(2.38125) === '2.4 mm' && P.mmText(1.5875) === '1.6 mm', 'mm to a tenth');
  const cases = [['3/32', 'mm', 3 / 32 * IN], ['3/32"', 'mm', 3 / 32 * IN], ['1 1/16', 'in', (1 + 1 / 16) * IN], ['2.4', 'mm', 2.4], ['2,4 mm', 'in', 2.4], ['0.094', 'in', 0.094 * IN], ['0.094in', 'mm', 0.094 * IN], ['5/64″', 'mm', 5 / 64 * IN]];
  for (const [text, unit, mm] of cases) check(near(P.parseLength(text, unit), mm, 1e-9), `parse "${text}" (${unit}): ${P.parseLength(text, unit)}`);
  for (const bad of ['', 'abc', '-1', '3/']) check(P.parseLength(bad, 'mm') === null, `"${bad}" isn't a length`);
  // Stepping lands on the grid: 64ths, or tenths of a mm, and never below 0.
  check(near(P.step(null, 1, 'in'), 6 / 64 * IN), 'the first + in inches: 3/32"');
  check(near(P.step(6 / 64 * IN, 1, 'in'), 7 / 64 * IN) && near(P.step(2.38, -1, 'in'), 5 / 64 * IN), 'a 64th up and down');
  check(near(P.step(2.4, 1, 'mm'), 2.5) && near(P.step(2.43, -1, 'mm'), 2.3) && near(P.step(null, -1, 'mm'), 2.4), 'a tenth of a mm up and down');
  check(P.step(0, -1, 'mm') === 0 && P.step(0, -1, 'in') === 0, 'never below 0');
  check(P.turnsText(0.1) === '¼ of a turn' && P.turnsText(0.74) === '¾ of a turn' && P.turnsText(1) === '1 turn' && P.turnsText(1.3) === '1¼ turns' && P.turnsText(2.5) === '2½ turns', 'turns in words');
}

console.log('what to turn, and how far');
{
  // A humbucker's bass side 1/64" low of Gibson's neck figure: raise it, clockwise, about ¾ turn (0.4 mm / 0.53).
  const a = P.advise({ pickup: 'humbucker', source: 'gibson', position: 'neck', side: 'bass', measuredMm: 7 / 64 * IN, unit: 'in' });
  check(a.status === 'raise' && near(a.moveMm, IN / 64, 1e-9), `1/64" too big a gap: ${a.status} ${a.moveMm}`);
  check(/clockwise/.test(a.say) && !/anticlockwise/.test(a.say) && /¾ of a turn/.test(a.say) && /1\/64″/.test(a.say) && /bass-side/.test(a.say), a.say);
  const b = P.advise({ pickup: 'humbucker', source: 'gibson', position: 'bridge', side: 'treble', measuredMm: 0.6, unit: 'mm' });
  check(b.status === 'lower' && /anticlockwise/.test(b.say) && /1\.0 mm/.test(b.say) && /treble-side/.test(b.say) && /1¾ turns/.test(b.say), `too close (1.0 mm / 0.53 mm a turn): ${b.say}`);
  const c = P.advise({ pickup: 'humbucker', source: 'gibson', position: 'bridge', side: 'bass', measuredMm: 1.7, unit: 'mm' });
  check(c.status === 'ok', `within ${P.TOLERANCE_MM} mm: ${c.status}`);
  check(P.advise({ pickup: 'humbucker', source: 'gibson', position: 'neck', side: 'bass', measuredMm: null }).status === null, 'not measured: nothing to say');
  // A soapbar: its screws hold it down, so loosen to raise, tighten to lower; no turn count (wood screws vary).
  const s1 = P.advise({ pickup: 'soapbar', source: 'stewmac', position: 'neck', side: 'treble', measuredMm: 1.0, unit: 'mm' });
  check(s1.status === 'lower' && /tighten/.test(s1.say) && !/turns?\b/.test(s1.say), `soapbar too close: ${s1.say}`);
  const s2 = P.advise({ pickup: 'soapbar', source: 'stewmac', position: 'neck', side: 'bass', measuredMm: 3.4, unit: 'mm' });
  check(s2.status === 'raise' && /loosen/.test(s2.say) && /shim/.test(s2.say), `soapbar raise: ${s2.say}`);
  // A dogear: shims, and the two sides together.
  const d = P.advisePickup({ pickup: 'dogear', source: 'stewmac', position: 'bridge', bassMm: 3 / 32 * IN + 0.8, trebleMm: 1 / 16 * IN + 0.6, unit: 'mm' });
  check(d.bass.status === 'raise' && /shim/.test(d.bass.say) && !/screw/.test(d.bass.say.replace(/height screws/, '')), `dogear: ${d.bass.say}`);
  check(/Raise the whole pickup about 0\.7 mm/.test(d.summary) && /pole screws/.test(d.summary), `dogear summary: ${d.summary}`);
  const ok = P.advisePickup({ pickup: 'humbucker', source: 'stewmac', position: 'neck', bassMm: 2.4, trebleMm: 1.6, unit: 'mm' });
  check(ok.bass.status === 'ok' && ok.treble.status === 'ok' && /Both sides/.test(ok.summary), 'both right');
}

console.log('the level check');
{
  const L = new P.LevelCheck();
  check(L.balance('neck') === null && L.neckOverBridge() === null, 'nothing before any plucks');
  // Neck: even, but the G 5 dB hotter. Bridge: everything 4 dB down from the neck.
  const neck = { 6: -20, 5: -20.5, 4: -19.5, 3: -15, 2: -20, 1: -21 };
  for (const [s, db] of Object.entries(neck)) for (const j of [-0.5, 0, 0.5]) L.add('neck', Number(s), db + j);
  const b = L.balance('neck');
  check(b && b.louder.length === 1 && b.louder[0] === 3 && b.quieter.length === 0 && b.heard === 6, `the hot G stands out: ${JSON.stringify(b)}`);
  check(L.neckOverBridge() === null, 'no comparison before the bridge is heard');
  for (const [s, db] of Object.entries(neck)) L.add('bridge', Number(s), db - 4);
  check(near(L.neckOverBridge(), 4, 0.05), `the neck is 4 dB louder: ${L.neckOverBridge()}`);
  // Averaged as power; only the last three plucks are kept.
  const M = new P.LevelCheck();
  for (const db of [-60, -10, -10, -10]) M.add('neck', 6, db);
  check(near(M.levels('neck')[6], -10, 1e-9), `the last three: ${M.levels('neck')[6]}`);
  M.add('neck', 5, -10); M.add('neck', 5, -20);
  check(near(M.levels('neck')[5], 10 * Math.log10((0.1 + 0.01) / 2), 1e-9), 'as power');
  M.reset();
  check(Object.keys(M.levels('neck')).length === 0, 'reset');
  // Open strings only.
  const STD = { 1: 64, 2: 59, 3: 55, 4: 50, 5: 45, 6: 40 };
  check(P.openString(40, STD) === 6 && P.openString(64, STD) === 1 && P.openString(41, STD) === null, 'open strings by note');
}

if (failures) { console.log(`\n${failures} failure(s)`); process.exit(1); }
console.log('\nAll pickup-height tests passed.');
