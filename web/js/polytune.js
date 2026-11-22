// "Strum all six": every string's tuning from one strum, like a polyphonic tuner pedal.
//
// One microphone hears all six strings mixed together, but the tuner knows which six notes to expect
// (the tuning), so it doesn't have to pull an unknown chord apart. It takes one spectrum of the
// strum (a Hann window over ~0.7 s, zero-padded 4×, so peaks can be read to a fraction of a cent) and
// for each string looks for its fundamental and first few harmonics near where they should be.
//
// The hard part is that strings share frequencies. In standard tuning the low E's 3rd harmonic sits
// on the B string, the low E's 4th and the A's 3rd sit on the high e, and so on. Each harmonic of each
// string is scored by how much of what's at that frequency should be its own: its expected strength
// (1/n for the nth harmonic) against every other sounding string's harmonics within reach. Harmonics
// that are mostly someone else's are left out; a neighbour far enough away to tell apart narrows the
// search instead. The usable harmonics' readings are combined, weighted by that share and by how
// loud they are, keeping only those that agree with each other, if any do (a harmonic pulled by a neighbour's
// stands out from the string's other harmonics).
//
// Where a string has no harmonic of its own (the B and high e lean on shared ones), the reading is
// pulled a little towards the string it shares with. When that one is in tune, the shared string's
// reading still points the right way and reaches zero as it gets there; it just reads a little less
// than it is. That's why the strum view is for a quick check, and the single-string tuner for the end.
(function (root) {
  'use strict';

  // In-place radix-2 complex FFT. re, im: Float64Arrays of a power-of-two length.
  function fft(re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) {
        let t = re[i]; re[i] = re[j]; re[j] = t;
        t = im[i]; im[i] = im[j]; im[j] = t;
      }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = (-2 * Math.PI) / len;
      const wr = Math.cos(ang);
      const wi = Math.sin(ang);
      const half = len >> 1;
      for (let i = 0; i < n; i += len) {
        let cr = 1;
        let ci = 0;
        for (let k = 0; k < half; k++) {
          const a = i + k;
          const b = a + half;
          const tr = re[b] * cr - im[b] * ci;
          const ti = re[b] * ci + im[b] * cr;
          re[b] = re[a] - tr; im[b] = im[a] - ti;
          re[a] += tr; im[a] += ti;
          const nr = cr * wr - ci * wi;
          ci = cr * wi + ci * wr;
          cr = nr;
        }
      }
    }
  }

  const MAX_H = 4; // harmonics read per string
  const NEIGHBOUR_H = 8; // other strings' harmonics considered as overlapping
  const SEARCH = 60; // ± cents searched around each expected harmonic
  const TOUCH = 30; // cents: closer than this, two harmonics can't be told apart
  const AGREE = 2.5; // cents: harmonics of one string read this close agree

  class StrumAnalyzer {
    // open: { string: MIDI } for the tuning. a4: reference pitch.
    constructor({ sampleRate, open, a4 = 440, pad = 4 }) {
      this.sr = sampleRate;
      this.open = { ...open };
      this.a4 = a4;
      this.pad = pad;
    }

    freqOf(s) { return this.a4 * 2 ** ((this.open[s] - 69) / 12); }

    // The magnitude spectrum of x (Hann window, zero-padded), as a Float64Array of bins.
    spectrum(x) {
      const n = 2 ** Math.ceil(Math.log2(x.length * this.pad));
      const re = new Float64Array(n);
      const im = new Float64Array(n);
      const L = x.length;
      for (let i = 0; i < L; i++) re[i] = x[i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (L - 1)));
      fft(re, im);
      const mag = new Float64Array(n / 2);
      for (let i = 0; i < n / 2; i++) mag[i] = Math.hypot(re[i], im[i]);
      return { mag, df: this.sr / n, L };
    }

    // The strongest peak between f0 and f1 Hz: { freq, mag, edge } (edge: it's at the end of the range,
    // so the real peak is further out), or null.
    peak(spec, f0, f1) {
      const { mag, df } = spec;
      const b0 = Math.max(2, Math.floor(f0 / df));
      const b1 = Math.min(mag.length - 3, Math.ceil(f1 / df));
      let best = -1;
      for (let b = b0; b <= b1; b++) if (best < 0 || mag[b] > mag[best]) best = b;
      if (best < 0) return null;
      const edge = best <= b0 + 1 || best >= b1 - 1;
      // Gaussian (log-parabolic) interpolation: on a Hann window this is a small fraction of a bin.
      const a = Math.log(mag[best - 1] + 1e-30);
      const b = Math.log(mag[best] + 1e-30);
      const c = Math.log(mag[best + 1] + 1e-30);
      const den = a - 2 * b + c;
      const shift = den < 0 ? Math.max(-0.5, Math.min(0.5, (0.5 * (a - c)) / den)) : 0;
      return { freq: (best + shift) * df, mag: mag[best], edge };
    }

    // The noise floor around f: the median magnitude within ±15%.
    floor(spec, f) {
      const { mag, df } = spec;
      const b0 = Math.max(1, Math.floor((f * 0.85) / df));
      const b1 = Math.min(mag.length - 1, Math.ceil((f * 1.15) / df));
      const step = Math.max(1, Math.floor((b1 - b0) / 200));
      const v = [];
      for (let b = b0; b <= b1; b += step) v.push(mag[b]);
      v.sort((p, q) => p - q);
      return v[Math.floor(v.length / 2)] || 1e-30;
    }

    // x: ~0.7 s of the strum, starting just after the pick attack. Returns one result per string,
    // { s, heard, cents, far, sure } (sure: 0..1, how much of what it read was the string's own).
    analyze(x) {
      const spec = this.spectrum(x);
      const strings = Object.keys(this.open).map(Number);
      // Which strings are sounding at all: their fundamental or 2nd harmonic stands out of the floor.
      const level = {};
      for (const s of strings) {
        let best = 0;
        for (const h of [1, 2]) {
          const f = h * this.freqOf(s);
          const p = this.peak(spec, f * 2 ** (-SEARCH / 1200), f * 2 ** (SEARCH / 1200));
          if (p) best = Math.max(best, p.mag / this.floor(spec, f));
        }
        level[s] = best;
      }
      const sounding = (s) => level[s] >= 8;

      return strings.map((s) => {
        if (!sounding(s)) return { s, heard: false };
        const reads = [];
        for (let h = 1; h <= MAX_H; h++) {
          const f = h * this.freqOf(s);
          if (f > this.sr / 2 - 200) break;
          // Other strings' harmonics within reach of this one.
          let shared = 0;
          let lo = -SEARCH;
          let hi = SEARCH;
          for (const t of strings) {
            if (t === s || !sounding(t)) continue;
            for (let m = 1; m <= NEIGHBOUR_H; m++) {
              const d = 1200 * Math.log2((m * this.freqOf(t)) / f);
              if (Math.abs(d) >= SEARCH + TOUCH) continue;
              if (Math.abs(d) < TOUCH + 10) shared += 1 / m;
              else if (d > 0) hi = Math.min(hi, d / 2); // far enough apart: search only our side
              else lo = Math.max(lo, d / 2);
            }
          }
          const share = 1 / h / (1 / h + shared);
          if (share < 0.55) continue;
          const p = this.peak(spec, f * 2 ** (lo / 1200), f * 2 ** (hi / 1200));
          if (!p) continue;
          const snr = p.mag / this.floor(spec, f);
          if (snr < 6) continue;
          reads.push({ h, cents: 1200 * Math.log2(p.freq / f), w: share * share * Math.log(snr), share, edge: p.edge && (lo === -SEARCH || hi === SEARCH) });
        }
        if (!reads.length) return { s, heard: true, cents: null, far: false, sure: 0 };
        // Harmonics that agree are believed over one that doesn't (a neighbour's harmonic pulling it):
        // the reading the most weight agrees with (within AGREE), and those near it.
        let best = null;
        for (const r of reads) {
          const support = reads.reduce((a, q) => a + (Math.abs(q.cents - r.cents) <= AGREE ? q.w : 0), 0);
          if (!best || support > best.support + 1e-9 || (Math.abs(support - best.support) <= 1e-9 && r.share > best.r.share)) best = { r, support };
        }
        // With no two agreeing, there's nothing to choose by: average them all.
        const agreed = reads.filter((q) => Math.abs(q.cents - best.r.cents) <= AGREE);
        const use = agreed.length >= 2 ? agreed : reads;
        const W = use.reduce((a, r) => a + r.w, 0);
        const cents = use.reduce((a, r) => a + r.w * r.cents, 0) / W;
        const far = use.some((r) => r.edge) || Math.abs(cents) > SEARCH - 8;
        const sure = Math.max(...use.map((r) => r.share));
        return { s, heard: true, cents, far, sure, parts: reads.map((r) => ({ h: r.h, cents: r.cents, share: r.share, used: use.includes(r) })) };
      });
    }
  }

  const api = { StrumAnalyzer, fft };
  root.PolyTune = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
