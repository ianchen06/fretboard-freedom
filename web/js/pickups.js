// Pickup height, without any DOM: Gibson's and StewMac's recommended gaps for Gibson-style
// humbuckers and P-90s, what to turn (and how far) to get from what you measured to them, and a
// level check that compares strings and pickups by ear (well, by meter).
//
// The figures, and where they come from (see the README's Pickup height section for links):
//  - Gibson's factory setting, as Gibson support gives it (its factory setup sheet, quoted by Gibson
//    staff on Gibson's forums): measured with the string pressed at the last fret, from the bottom of
//    the string to the highest point of the pickup, with the pole pieces set flat (as they leave the
//    factory): neck ("rhythm") 3/32", bridge 1/16". One figure for each pickup, not one per side. It is
//    given for Gibson's humbucker guitars; Gibson publishes no separate P-90 figure.
//  - StewMac's instructions for humbuckers and for P-90s: "Start with about 3/32" between the Low-E
//    polepiece and the bottom of the string when fretted at the highest fret, and a 1/16" gap for the
//    High-E string" (P-90s "are usually set closer to the strings than single-coils, because they
//    have less of a focused magnetic pull"), then raise or lower the neck and bridge pickups for the
//    tone and volume balance you prefer.
//  - Gibson's owner's manual: height is set by the two screws at either end of the pickup, in the
//    mounting ring; individual string volume by the pole piece screws; closer is hotter.
//  - Gibson's humbucker height screws are 3-48 (48 threads to the inch: a full turn moves the pickup
//    1/48", 0.53 mm). Turning them clockwise draws the pickup up towards the strings.
//  - A soapbar P-90's two screws, between the pole pieces, hold it down against foam or springs
//    underneath; a dogear P-90 has none for height: it's raised with shims under it.
(function (root) {
  'use strict';

  const MM = 25.4; // mm in an inch

  const SOURCES = {
    gibson: {
      id: 'gibson',
      name: 'Gibson',
      long: 'Gibson factory setting',
      gap: { neck: { bass: 3 / 32, treble: 3 / 32 }, bridge: { bass: 1 / 16, treble: 1 / 16 } },
      fret: 'the last fret',
      to: 'the highest point of the pickup (the cover, or a pole piece if one is raised above it)',
      types: ['humbucker'],
      note: 'One gap for each pickup, the same under both E strings, with the pole pieces flat as they leave the factory. Gibson gives it for its humbucker guitars and publishes no separate figure for P-90s.',
    },
    stewmac: {
      id: 'stewmac',
      name: 'StewMac',
      long: 'StewMac starting point',
      gap: { neck: { bass: 3 / 32, treble: 1 / 16 }, bridge: { bass: 3 / 32, treble: 1 / 16 } },
      fret: 'the highest fret',
      to: 'the top of the pole piece',
      types: ['humbucker', 'p90'],
      note: 'The same for the neck and the bridge pickup, for humbuckers and P-90s alike: a little more room under the wound low E. Then raise or lower each pickup until the tone, and the balance between the two, is what you like.',
    },
  };

  // How each kind of pickup is raised and lowered.
  const PICKUPS = {
    humbucker: { id: 'humbucker', type: 'humbucker', name: 'Humbucker', how: 'screws', perTurnMm: MM / 48, thread: '3-48' },
    soapbar: { id: 'soapbar', type: 'p90', name: 'P-90 soapbar', how: 'mount' },
    dogear: { id: 'dogear', type: 'p90', name: 'P-90 dogear', how: 'shims' },
  };

  const POSITIONS = ['neck', 'bridge'];
  const SIDES = ['bass', 'treble'];
  const SIDE_NAME = { bass: 'bass side (low E)', treble: 'treble side (high E)' };
  const TOLERANCE_MM = 0.2; // within this of the target counts as there (a ruler reads to ~1/64", 0.4 mm)

  // The target gap, in mm, and whether the source gives one for this kind of pickup.
  function target(sourceId, pickupId, position, side) {
    const src = SOURCES[sourceId];
    const pu = PICKUPS[pickupId];
    return { mm: src.gap[position][side] * MM, inches: src.gap[position][side], own: src.types.includes(pu.type) };
  }

  // ---------- units ----------
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  // Inches as the nearest 64th, reduced: 0.09375 → "3/32″".
  function inchText(inches) {
    const n = Math.round(inches * 64);
    if (n === 0) return '0″';
    const whole = Math.floor(n / 64);
    const rest = n % 64;
    const g = gcd(rest, 64);
    const frac = rest ? `${rest / g}/${64 / g}` : '';
    return `${whole ? `${whole}${frac ? ' ' : ''}` : ''}${frac}″`;
  }
  const mmText = (mm) => `${(Math.round(mm * 10) / 10).toFixed(1)} mm`;
  const lengthText = (mm, unit) => (unit === 'in' ? inchText(mm / MM) : mmText(mm));

  // A typed length: "3/32", "3/32\"", "1 1/16", "0.094in", "2.4", "2.4 mm". Bare numbers are taken in
  // `unit` ('mm' or 'in'). Returns mm, or null.
  function parseLength(text, unit = 'mm') {
    let s = String(text || '').trim().toLowerCase().replace(/[″"]/g, 'in').replace(/,/g, '.');
    if (!s) return null;
    let u = unit;
    if (/mm$/.test(s)) { u = 'mm'; s = s.replace(/mm$/, '').trim(); } else if (/(in|inch|inches)$/.test(s)) { u = 'in'; s = s.replace(/(inches|inch|in)$/, '').trim(); }
    let v = null;
    const frac = /^(?:(\d+)\s+)?(\d+)\s*\/\s*(\d+)$/.exec(s);
    if (frac) { u = 'in'; v = (frac[1] ? Number(frac[1]) : 0) + Number(frac[2]) / Number(frac[3]); } else if (/^\d*\.?\d+$/.test(s)) v = Number(s);
    if (v == null || !Number.isFinite(v) || v < 0) return null;
    return u === 'in' ? v * MM : v;
  }

  // A measured value stepped up or down by one step: 1/64″ or 0.1 mm, landing on the grid.
  function step(mm, dir, unit) {
    if (unit === 'in') {
      const n = mm == null ? 6 - dir : Math.round((mm / MM) * 64);
      return (Math.max(0, n + dir) / 64) * MM;
    }
    const n = mm == null ? 24 - dir : Math.round(mm * 10);
    return Math.max(0, n + dir) / 10;
  }

  // Quarter turns, as words: 0.75 → "¾ of a turn", 1.25 → "1¼ turns".
  function turnsText(turns) {
    const q = Math.max(1, Math.round(turns * 4));
    const whole = Math.floor(q / 4);
    const part = ['', '¼', '½', '¾'][q % 4];
    if (!whole) return `${part} of a turn`;
    return `${whole}${part} turn${q === 4 ? '' : 's'}`;
  }

  // What to do to one side of one pickup: { status: 'ok' | 'raise' | 'lower', moveMm, targetMm, say }.
  // measuredMm: the gap measured there (null: not measured yet).
  function advise({ pickup, source, position, side, measuredMm, unit = 'in' }) {
    const tg = target(source, pickup, position, side);
    const out = { side, position, targetMm: tg.mm, measuredMm, status: null, moveMm: null, say: '' };
    if (measuredMm == null) return out;
    const move = measuredMm - tg.mm; // > 0: the gap's too big, the pickup is low: raise it
    out.moveMm = Math.abs(move);
    const amount = lengthText(Math.abs(move), unit);
    if (Math.abs(move) <= TOLERANCE_MM) {
      out.status = 'ok';
      out.say = 'Right there.';
      return out;
    }
    out.status = move > 0 ? 'raise' : 'lower';
    const pu = PICKUPS[pickup];
    const end = side === 'bass' ? 'bass-side' : 'treble-side';
    if (pu.how === 'screws') {
      const turns = turnsText(Math.abs(move) / pu.perTurnMm);
      out.turns = Math.abs(move) / pu.perTurnMm;
      out.say = move > 0
        ? `Raise it ${amount}: turn the ${end} height screw clockwise, about ${turns}.`
        : `Lower it ${amount}: turn the ${end} height screw anticlockwise, about ${turns}.`;
    } else if (pu.how === 'mount') {
      out.say = move > 0
        ? `Raise it ${amount}: loosen the ${end} screw a little at a time; the foam or springs under the pickup push that end up. If it doesn't rise, there's nothing under it: it needs a shim.`
        : `Lower it ${amount}: tighten the ${end} screw a little at a time.`;
    } else {
      out.say = move > 0
        ? `Raise it ${amount}: a dogear has no height screws, so it goes up on a shim under it, the same outline as the pickup.`
        : `Lower it ${amount}: only if there's a shim under it to take out (or a thinner one to put in).`;
    }
    return out;
  }

  // Both sides of one pickup, and a line for the two together (a dogear is shimmed as a whole: the
  // two sides' average; one side's balance against the other is the pole screws').
  function advisePickup({ pickup, source, position, bassMm, trebleMm, unit = 'in' }) {
    const bass = advise({ pickup, source, position, side: 'bass', measuredMm: bassMm, unit });
    const treble = advise({ pickup, source, position, side: 'treble', measuredMm: trebleMm, unit });
    let summary = '';
    if (bass.status && treble.status) {
      if (bass.status === 'ok' && treble.status === 'ok') summary = 'Both sides are where they should be.';
      else if (PICKUPS[pickup].how === 'shims') {
        const avg = (bassMm - bass.targetMm + trebleMm - treble.targetMm) / 2;
        summary = Math.abs(avg) <= TOLERANCE_MM
          ? 'On average it\'s at the right height: even out the two sides with the pole screws.'
          : `${avg > 0 ? 'Raise' : 'Lower'} the whole pickup about ${lengthText(Math.abs(avg), unit)} (${avg > 0 ? 'a shim of about that under it' : 'a shim that much thinner'}), then even out the sides with the pole screws.`;
      }
    }
    return { bass, treble, summary };
  }

  // ---------- the level check ----------
  // With the guitar plugged in: pluck each open string, a few times, as evenly as you can, on one
  // pickup and then the other. Keeps the last three plucks of each string on each pickup (their level
  // in dB) and compares: strings well off the others (what the pole screws are for), and one pickup
  // against the other (what the height is for).
  class LevelCheck {
    constructor({ keep = 3, uneven = 3 } = {}) {
      this.keep = keep;
      this.uneven = uneven; // dB from the pickup's median that counts as noticeably louder or quieter
      this.reset();
    }

    reset() { this.data = { neck: {}, bridge: {} }; }

    // A pluck of open string s (1-6) on a pickup, at db.
    add(pickup, s, db) {
      if (!this.data[pickup] || !Number.isFinite(db)) return;
      const list = this.data[pickup][s] || (this.data[pickup][s] = []);
      list.push(db);
      while (list.length > this.keep) list.shift();
    }

    // { string: average dB } for one pickup (averaged as power: a loud pluck counts as loud).
    levels(pickup) {
      const out = {};
      for (const [s, list] of Object.entries(this.data[pickup] || {})) {
        if (!list.length) continue;
        out[s] = 10 * Math.log10(list.reduce((a, db) => a + 10 ** (db / 10), 0) / list.length);
      }
      return out;
    }

    // { median, louder: [s], quieter: [s], heard: n } for one pickup, null before 3 strings.
    balance(pickup) {
      const lv = this.levels(pickup);
      const v = Object.values(lv).sort((a, b) => a - b);
      if (v.length < 3) return null;
      const median = v.length % 2 ? v[(v.length - 1) >> 1] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2;
      const louder = [];
      const quieter = [];
      for (const [s, db] of Object.entries(lv)) {
        if (db >= median + this.uneven) louder.push(Number(s));
        else if (db <= median - this.uneven) quieter.push(Number(s));
      }
      return { median, louder, quieter, heard: v.length };
    }

    // How much louder the neck pickup is than the bridge (dB), over the strings heard on both; null
    // until at least 3 strings have been heard on each.
    neckOverBridge() {
      const n = this.levels('neck');
      const b = this.levels('bridge');
      const both = Object.keys(n).filter((s) => s in b);
      if (both.length < 3) return null;
      return both.reduce((a, s) => a + n[s] - b[s], 0) / both.length;
    }
  }

  // Which open string a played note is (MIDI, in the tuning `open`: { string: MIDI }), or null.
  function openString(midi, open) {
    for (const [s, m] of Object.entries(open)) if (m === midi) return Number(s);
    return null;
  }

  const api = { MM, SOURCES, PICKUPS, POSITIONS, SIDES, SIDE_NAME, TOLERANCE_MM, target, inchText, mmText, lengthText, parseLength, step, turnsText, advise, advisePickup, LevelCheck, openString };
  root.Pickups = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
