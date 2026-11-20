// Backing for the daily session: a soft synth pad that holds a drone (root + 5th) or plays a chord per
// bar, and a small chime for "time's up". Attacks are slow on purpose, so the note detector doesn't
// take the pad for a picked note. It still sits in the guitar's range, so a mic in the room will hear
// it: use headphones or an audio interface.
(function (root) {
  'use strict';
  const mtof = (m) => 440 * 2 ** ((m - 69) / 12);
  const mod12 = (n) => ((n % 12) + 12) % 12;

  class Pad {
    constructor(ctx, dest) {
      this.ctx = ctx;
      this.out = ctx.createGain();
      this.out.gain.value = 0.5;
      this.lp = ctx.createBiquadFilter();
      this.lp.type = 'lowpass';
      this.lp.frequency.value = 1300;
      this.lp.Q.value = 0.5;
      this.lp.connect(this.out).connect(dest);
      this.live = new Set();
    }

    setVolume(v) { this.out.gain.setTargetAtTime(Math.max(0, v), this.ctx.currentTime, 0.05); }

    voice(midi, when, dur, level, type = 'sawtooth') {
      const ctx = this.ctx;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, when);
      g.gain.linearRampToValueAtTime(level, when + 0.35);
      g.gain.setValueAtTime(level, when + dur);
      g.gain.linearRampToValueAtTime(0, when + dur + 0.45);
      g.connect(this.lp);
      const oscs = (type === 'sawtooth' ? [-7, 7] : [0]).map((det) => {
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.value = mtof(midi);
        o.detune.value = det;
        o.connect(g);
        o.start(when);
        o.stop(when + dur + 0.5);
        return o;
      });
      const v = { g, oscs };
      this.live.add(v);
      oscs[0].onended = () => { this.live.delete(v); g.disconnect(); };
    }

    // Chord tones (pitch classes) voiced between E3 and D♯4, with the root in the bass (C2–B2).
    chord(rootPc, pcs, when, dur) {
      this.voice(36 + mod12(rootPc), when, dur, 0.22, 'triangle');
      for (const pc of pcs) this.voice(52 + mod12(pc - 52), when, dur, 0.055);
    }

    // Root and 5th, low, plus the root an octave up.
    drone(rootPc, when, dur) {
      const r = 36 + mod12(rootPc);
      this.voice(r, when, dur, 0.24, 'triangle');
      this.voice(r + 7, when, dur, 0.06);
      this.voice(r + 12, when, dur, 0.05);
    }

    stop() {
      const t = this.ctx.currentTime;
      for (const v of this.live) {
        v.g.gain.cancelScheduledValues(t);
        v.g.gain.setTargetAtTime(0, t, 0.06);
        for (const o of v.oscs) { try { o.stop(t + 0.4); } catch { /* already stopped */ } }
      }
    }

    // Two soft bell partials.
    chime(when = this.ctx.currentTime) {
      const ctx = this.ctx;
      [[88, 0.18], [95, 0.1], [100, 0.06]].forEach(([m, lv], i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = mtof(m);
        const t = when + i * 0.12;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(lv, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
        o.connect(g).connect(this.out.context.destination);
        o.start(t);
        o.stop(t + 1.5);
      });
    }
  }

  root.Pad = Pad;
})(window);
