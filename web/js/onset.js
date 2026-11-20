// Pick-attack (onset) detection for the rhythm trainer, timed to about a millisecond.
//
// The note tracker in pitch.js needs a clear pitch, runs on a 10 ms timer and can't hear a strummed
// chord or a muted "chuck". Rhythm needs the opposite: when each attack happened, whatever it is.
//
// OnsetDetector splits the input into six bands, about an octave each (under 250 Hz up to over
// 4 kHz), and tracks each band's level in 1 ms hops. Detection uses each band's level over the last
// 6 ms: an attack is how far, summed over the bands, that level rose above the *loudest* it was 6–24
// ms earlier. Comparing with the loudest point (not the quietest) means a ringing or distorted
// chord's own pulsing and beating never counts, which matters most for high-gain tones (tested on
// real strummed and distorted loops). Working per band means a soft strum right after a loud one
// still shows up, because its fresh top end rises even when the total level falls.
//
// Timing then goes back to the 1 ms levels: the attack is the first hop that rose well above
// everything in the 12 ms before it. In a strum that is the first string the pick hits.
//
// The same file is the AudioWorklet module (registered as 'onset-detector') and a plain script for
// the tests: `require('../js/onset.js')`.
(function (root) {
  'use strict';

  // RBJ cookbook biquad, direct form I.
  function biquad(type, fc, sr, q = Math.SQRT1_2) {
    const w0 = (2 * Math.PI * fc) / sr;
    const cos = Math.cos(w0);
    const alpha = Math.sin(w0) / (2 * q);
    let b0, b1, b2;
    if (type === 'lowpass') { b0 = (1 - cos) / 2; b1 = 1 - cos; b2 = b0; } else { b0 = (1 + cos) / 2; b1 = -(1 + cos); b2 = b0; }
    const a0 = 1 + alpha;
    const c = [b0 / a0, b1 / a0, b2 / a0, (-2 * cos) / a0, (1 - alpha) / a0];
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    return (x) => {
      const y = c[0] * x + c[1] * x1 + c[2] * x2 - c[3] * y1 - c[4] * y2;
      x2 = x1; x1 = x; y2 = y1; y1 = y;
      return y;
    };
  }

  const db = (p) => 10 * Math.log10(p);
  const EDGES = [250, 500, 1000, 2000, 4000]; // band edges, Hz
  const NB = EDGES.length + 1;
  const WEIGHT = [0.4, 0.6, 0.8, 1, 1.3, 1.6]; // the top bands carry the pick's attack; the lowest move slowly and pick up thumps
  const NORM = 3 / WEIGHT.reduce((a, b) => a + b, 0); // keeps the threshold on its original scale
  const WIN = 12; // hops (ms): how far back the attack-time search compares, one cycle of a low D
  const FAST = 6; // hops (ms) the detection levels average over
  const LOOK = [6, 24]; // hops back: the window whose loudest level an attack must rise above
  const DONE = 32; // hops after the trigger before an attack is reported (its level is measured by then)
  const KEEP = 96; // hops of history

  class OnsetDetector {
    // threshold: weighted rise across the bands, in dB, that marks an attack (lower = more sensitive).
    // refractory: s after an attack before another can count (a strum is one attack, not six).
    constructor({ sampleRate, gateDb = -50, threshold = 4.5, refractory = 0.05 } = {}) {
      this.sr = sampleRate;
      this.H = Math.max(16, Math.round(sampleRate / 1000));
      this.setGateDb(gateDb);
      this.threshold = threshold;
      this.refractory = refractory;
      this.reset();
    }

    setGateDb(gdb) { this.gateDb = gdb; this.floor = 10 ** (gdb / 10) * 0.1; }

    reset() {
      const sr = this.sr;
      // Band b keeps (lowpass at EDGES[b]) ∘ (highpass at EDGES[b-1]); the ends have one filter each.
      this.filters = [];
      for (let b = 0; b < NB; b++) {
        const f = [];
        if (b > 0) f.push(biquad('highpass', EDGES[b - 1], sr));
        if (b < NB - 1) f.push(biquad('lowpass', EDGES[b], sr));
        this.filters.push(f);
      }
      this.acc = new Float64Array(NB + 1); // per band, then the whole signal
      this.sum = new Float64Array(NB + 1); // running sums of the last FAST hops' energies
      this.k = 0;
      this.n = 0; // hops since the anchor
      this.anchor = null; // absolute sample index of hop 0
      this.next = null; // the sample index the next block should start at
      this.hist = []; // per hop: { n, e, L (6 ms band levels, dB), F (1 ms band levels, dB), A, odf }
      this.armed = true;
      this.lastTrig = -1e9; // hop of the last trigger
      this.lastHop = -1e9; // hop of the last reported attack
      this.pend = []; // triggers waiting to be timed and reported
    }

    // x: a block of mono samples; frame0: the absolute sample index of x[0] (the worklet's
    // currentFrame). Returns the attacks that finished in this block: { t, db, strength }, with t in
    // seconds on the same clock as frame0 / sampleRate (the AudioContext's currentTime).
    process(x, frame0) {
      if (this.next !== null && frame0 !== this.next) this.reset(); // a gap: start over rather than mistime
      if (this.anchor === null) this.anchor = frame0;
      this.next = frame0 + x.length;
      const out = [];
      const { acc, filters } = this;
      for (let i = 0; i < x.length; i++) {
        const s = x[i];
        for (let b = 0; b < NB; b++) {
          let y = s;
          const f = filters[b];
          for (let j = 0; j < f.length; j++) y = f[j](y);
          acc[b] += y * y;
        }
        acc[NB] += s * s;
        if (++this.k === this.H) {
          this.k = 0;
          const evs = this.hop();
          if (evs) out.push(...evs);
        }
      }
      return out;
    }

    hop() {
      const { H, hist, floor, sum, acc } = this;
      const e = Array.from(acc, (v) => v / H);
      acc.fill(0);
      const n = this.n++;
      for (let b = 0; b <= NB; b++) sum[b] += e[b];
      if (hist.length >= FAST) { const old = hist[hist.length - FAST].e; for (let b = 0; b <= NB; b++) sum[b] -= old[b]; }
      const w = Math.min(FAST, hist.length + 1);
      const cur = { n, e, L: new Array(NB), F: new Array(NB), A: db(Math.max(0, sum[NB]) / w + 1e-12), odf: 0 };
      for (let b = 0; b < NB; b++) {
        cur.L[b] = db(Math.max(0, sum[b]) / w + floor);
        cur.F[b] = db(e[b] + floor);
      }
      hist.push(cur);
      if (hist.length > KEEP) hist.shift();
      const len = hist.length;

      // How far each band's level rose over its loudest point 6–24 ms ago.
      if (len > LOOK[1]) {
        let odf = 0;
        for (let b = 0; b < NB; b++) {
          let hi = -Infinity;
          for (let j = len - 1 - LOOK[1]; j <= len - 1 - LOOK[0]; j++) hi = Math.max(hi, hist[j].L[b]);
          odf += WEIGHT[b] * Math.max(0, cur.L[b] - hi);
        }
        odf *= NORM;
        cur.odf = odf;
        if (!this.armed && odf < this.threshold * 0.5) this.armed = true;
        if (this.armed && odf >= this.threshold && n - this.lastTrig >= Math.round(this.refractory * 1000)) {
          this.pend.push({ n, odf });
          this.armed = false;
          this.lastTrig = n;
        }
      }
      let out = null;
      while (this.pend.length && n >= this.pend[0].n + DONE) {
        const ev = this.finish(this.pend.shift());
        if (ev) (out = out || []).push(ev);
      }
      return out;
    }

    // Find when the attack started. Each 1 ms hop gets, in each band, its rise above everything in the
    // 12 ms before it (a ringing note's own pulses never rise above their earlier peaks), summed over
    // the bands. The attack is the first hop that rose by a good part of the biggest rise: in a strum,
    // that's the first string the pick hits (a low one on a down-strum), not the loudest. It is placed
    // in the middle of that hop. Its level (for accents) is taken 18–30 ms in, once a strum has
    // finished and the strings it passed have stopped ringing from before.
    finish(p) {
      const { hist } = this;
      const refHops = Math.round(this.refractory * 1000);
      const idx = (n) => n - hist[0].n;
      const F = (n) => hist[idx(n)].F;
      const rises = [];
      for (let m = Math.max(hist[0].n + WIN, p.n - 30, this.lastHop + refHops); m <= p.n + 2; m++) {
        let rise = 0;
        for (let b = 0; b < NB; b++) {
          let base = -Infinity;
          for (let j = m - WIN; j < m; j++) base = Math.max(base, F(j)[b]);
          rise += WEIGHT[b] * Math.max(0, F(m)[b] - base);
        }
        rises.push({ m, rise: rise * NORM });
      }
      if (!rises.length) return null; // the tail of the last attack
      const top = Math.max(...rises.map((r) => r.rise));
      const { m } = rises.find((r) => r.rise >= Math.max(6, 0.4 * top)) || rises.find((r) => r.rise === top);
      const after = hist.slice(idx(m), idx(Math.min(m + 30, hist[hist.length - 1].n)) + 1).map((h) => h.A);
      if (Math.max(...after) < this.gateDb) return null; // a rise, but too quiet to be playing
      const body = after.slice(18);
      const level = body.length ? body.reduce((a, b) => a + b, 0) / body.length : Math.max(...after);
      this.lastHop = m;
      const t = (this.anchor + (m + 0.5) * this.H) / this.sr;
      return { t, db: Math.round(level * 10) / 10, strength: Math.round(p.odf * 10) / 10 };
    }
  }

  const api = { OnsetDetector, biquad };
  root.Onset = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

  // ---------- the AudioWorklet processor ----------
  if (typeof registerProcessor === 'function' && typeof AudioWorkletProcessor === 'function') {
    class OnsetProcessor extends AudioWorkletProcessor {
      constructor() {
        super();
        this.det = new OnsetDetector({ sampleRate }); // eslint-disable-line no-undef
        this.mono = new Float32Array(128);
        this.port.onmessage = (e) => {
          const m = e.data || {};
          if (m.gateDb != null) this.det.setGateDb(m.gateDb);
          if (m.threshold != null) this.det.threshold = m.threshold;
          if (m.refractory != null) this.det.refractory = m.refractory;
          if (m.reset) this.det.reset();
        };
      }

      process(inputs) {
        const chans = inputs[0];
        if (chans && chans.length) {
          let x = chans[0];
          if (chans.length > 1) {
            if (this.mono.length !== x.length) this.mono = new Float32Array(x.length);
            for (let i = 0; i < x.length; i++) {
              let s = 0;
              for (let c = 0; c < chans.length; c++) s += chans[c][i];
              this.mono[i] = s / chans.length;
            }
            x = this.mono;
          }
          const evs = this.det.process(x, currentFrame); // eslint-disable-line no-undef
          if (evs.length) this.port.postMessage({ onsets: evs });
        }
        return true;
      }
    }
    registerProcessor('onset-detector', OnsetProcessor);
  }
})(typeof window !== 'undefined' ? window : globalThis);
