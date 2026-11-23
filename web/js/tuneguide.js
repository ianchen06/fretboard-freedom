// The Tuner page's logic, without any DOM: which string you're tuning, how far it is from its
// target (in cents, or semitones when it's far off), which way to turn, and when it counts as tuned.
//
// Readings come from the precise tuner (js/tunerengine.js): { freq, spread, t }. A string counts as
// tuned once it has stayed inside the tolerance, steadily, for `holdTime` seconds. Strings can be
// picked by hand (pin), followed automatically (the nearest open string), or walked through in
// order, low to high (guide).
(function (root) {
  'use strict';

  const semisBetween = (f, ref) => 12 * Math.log2(f / ref);

  class TuneGuide {
    constructor({ open, a4 = 440, tolerance = 1, holdTime = 0.6 } = {}) {
      this.a4 = a4;
      this.tolerance = tolerance;
      this.holdTime = holdTime;
      this.mode = 'auto'; // 'auto' | 'pin' | 'guide'
      this.pinned = null;
      this.setTuning(open || { 1: 64, 2: 59, 3: 55, 4: 50, 5: 45, 6: 40 });
    }

    setTuning(open) {
      this.open = { ...open };
      this.done = new Set();
      this.current = null;
      this.cand = null;
      this.holdFrom = null;
      if (this.mode === 'guide') this.pinned = this.nextUndone();
    }

    setA4(a4) { this.a4 = a4; this.holdFrom = null; }
    setTolerance(c) { this.tolerance = c; this.holdFrom = null; }

    targetFreq(s) { return this.a4 * 2 ** ((this.open[s] - 69) / 12); }

    // Pick a string by hand (null: back to following whatever you play).
    pin(s) {
      this.mode = s ? 'pin' : 'auto';
      this.pinned = s || null;
      this.current = s || null;
      this.cand = null;
      this.holdFrom = null;
    }

    // Tune every string in turn, low to high. Starts afresh: every ✓ is cleared.
    guide() {
      this.mode = 'guide';
      this.done.clear();
      this.pinned = this.nextUndone();
      this.current = this.pinned;
      this.holdFrom = null;
    }

    nextUndone() {
      for (const s of [6, 5, 4, 3, 2, 1]) if (this.open[s] != null && !this.done.has(s)) return s;
      return null;
    }

    get allDone() { return Object.keys(this.open).every((s) => this.done.has(Number(s))); }

    // The open string nearest to freq, in semitones.
    nearestString(freq) {
      let best = null;
      for (const k of Object.keys(this.open)) {
        const s = Number(k);
        const d = Math.abs(semisBetween(freq, this.targetFreq(s)));
        if (!best || d < best.d) best = { s, d };
      }
      return best.s;
    }

    // Feed one steadied reading. Returns what to show:
    // { string, cents, semis, action: 'up' | 'down' | 'ok', far, hold (0..1), justTuned, finished }
    push({ freq, spread = 0, t }) {
      let s;
      if (this.mode === 'auto') {
        const near = this.nearestString(freq);
        // Hysteresis: a new string must be heard 3 readings running, so a slip doesn't flip it.
        if (this.current == null || near === this.current) { this.current = near; this.cand = null; } else if (this.cand && this.cand.s === near) {
          if (++this.cand.n >= 3) { this.current = near; this.cand = null; this.holdFrom = null; }
        } else this.cand = { s: near, n: 1 };
        s = this.current;
      } else {
        s = this.pinned;
        this.current = s;
      }
      if (s == null) return { string: null, finished: this.allDone };

      let semis = semisBetween(freq, this.targetFreq(s));
      // An octave out is the same string heard on its harmonic (or a sub-harmonic): fold it back.
      if (semis > 9 && semis < 15) semis -= 12;
      else if (semis < -9 && semis > -15) semis += 12;
      const cents = semis * 100;
      const tol = this.tolerance;
      const steady = spread < Math.max(1, tol);
      const inside = Math.abs(cents) <= tol;
      let justTuned = null;
      if (inside && steady) {
        if (this.holdFrom == null) this.holdFrom = t;
        if (t - this.holdFrom >= this.holdTime && !this.done.has(s)) {
          this.done.add(s);
          justTuned = s;
          if (this.mode === 'guide') { this.pinned = this.nextUndone(); this.holdFrom = null; }
        }
      } else if (!inside) {
        this.holdFrom = null;
        // A string you ticked off has drifted (tuning the others pulls on the neck): un-tick it.
        if (steady && Math.abs(cents) > Math.max(2 * tol, tol + 2)) this.done.delete(s);
      }
      const hold = this.done.has(s) && inside ? 1 : this.holdFrom == null ? 0 : Math.min(1, (t - this.holdFrom) / this.holdTime);
      return {
        string: s,
        cents,
        semis,
        far: Math.abs(cents) >= 50,
        action: inside ? 'ok' : cents < 0 ? 'up' : 'down',
        hold,
        justTuned,
        finished: this.allDone,
      };
    }

    // The sound stopped: a hold in progress doesn't carry over to the next pluck.
    silence() { this.holdFrom = null; this.cand = null; }
  }

  // Cents → angle on the gauge (±60°). Half the arc is ±10¢, so small errors are easy to see;
  // the rest stretches out to ±50¢.
  function gaugeAngle(cents) {
    const x = Math.min(50, Math.abs(cents));
    const f = x <= 10 ? 0.5 * (x / 10) : 0.5 + 0.5 * ((x - 10) / 40);
    return Math.sign(cents) * 60 * f;
  }

  const api = { TuneGuide, gaugeAngle };
  root.TuneGuideLib = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
