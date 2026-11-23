// The Tuner's pitch engine: what note a plucked string is playing, to a fraction of a cent, from a
// phone's or tablet's mic as well as from a cable, and quiet strings (an unplugged electric) as well as loud.
//
// Why it works the way it does (see the README's Tuner section for the research behind it):
//  - A guitar's low strings reach a small mic with almost no fundamental: in real recordings of the
//    low E the 2nd harmonic is 20-30 dB louder than the 1st, and a phone's mic takes another 10 dB
//    off it. So the pitch is found from all the harmonics together, and an octave error (reading the
//    2nd harmonic as the note) is ruled out by which harmonics are there, not by the loudest one.
//  - A quiet string is only a few dB over the room's hiss in loudness, but the hiss is spread over
//    the whole spectrum and the string's energy is in a few narrow lines. Detection is done on a
//    whitened spectrum (each bin's level over the noise floor there), which hears a string ~30 dB
//    under what a loudness gate needs. Steady sounds (mains hum, a fan) are learned into the floor.
//  - A real string's harmonics aren't exact multiples (a stiff string's partial n is at
//    n·f0·√(1 + B·n²)), and each one wobbles by a few cents as it rings. A reading that follows the
//    loudest harmonics drifts as their balance changes. The reading here is the fundamental of a
//    stiff-string fit to every harmonic that's heard, so it doesn't depend on which are loud.
//  - Precision comes from following each harmonic's phase over the whole note (like a strobe
//    tuner, which watches the phase drift against a reference): the frequency is the slope of a
//    weighted least-squares line through the phase, over up to ~0.6 s since the pick.
//
// Engine (DOM-free): give it, ~30 times a second, the latest stretch of raw input (≥ 0.4 s; an
// AnalyserNode's 32768 samples is ideal) and the time of its last sample. It returns what to show.
(function (root) {
  'use strict';

  const PASS = 4500; // Hz: the band that's analysed; higher partials are left out
  const INV_SQRT = Array.from({ length: 20 }, (_, h) => (h ? 1 / Math.sqrt(h) : 0)); // harmonic weights: see salienceAt()
  const COS_LUT = Float32Array.from({ length: 1025 }, (_, i) => Math.cos(2 * Math.PI * (i / 1024 - 0.5)));
  const MAX_PARTIALS = 12;
  const RECENT = 0.25; // s: the phase fit's lean towards the newest frames (see phaseSlope)
  const centsOf = (f, ref) => 1200 * Math.log2(f / ref);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const dB = (p) => 10 * Math.log10(p);

  // ---------- FFT (radix-2, in place, cached twiddles) ----------
  const twiddles = new Map();
  function fft(re, im) {
    const n = re.length;
    let tw = twiddles.get(n);
    if (!tw) {
      tw = { c: new Float64Array(n >> 1), s: new Float64Array(n >> 1) };
      for (let i = 0; i < n >> 1; i++) { tw.c[i] = Math.cos((-2 * Math.PI * i) / n); tw.s[i] = Math.sin((-2 * Math.PI * i) / n); }
      twiddles.set(n, tw);
    }
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
      const half = len >> 1;
      const step = n / len;
      for (let i = 0; i < n; i += len) {
        for (let k = 0; k < half; k++) {
          const a = i + k;
          const b = a + half;
          const wr = tw.c[k * step];
          const wi = tw.s[k * step];
          const tr = re[b] * wr - im[b] * wi;
          const ti = re[b] * wi + im[b] * wr;
          re[b] = re[a] - tr; im[b] = im[a] - ti;
          re[a] += tr; im[a] += ti;
        }
      }
    }
  }

  // ---------- decimation to ~12 kHz ----------
  // A Kaiser-windowed sinc lowpass (~80 dB stopband: a device's ultrasonic whine mustn't alias into
  // the band as a tone), evaluated only at the kept samples. What does alias lands above PASS,
  // outside the analysed band.
  function besselI0(x) {
    let s = 1, t = 1;
    for (let k = 1; k < 30; k++) { t *= (x / (2 * k)) ** 2; s += t; }
    return s;
  }
  class Decimator {
    constructor(sr, target = 12000) {
      this.D = Math.max(1, Math.round(sr / target));
      this.rate = sr / this.D;
      if (this.D === 1) { this.h = null; this.L = 1; return; }
      const stop = this.rate - PASS;
      const width = Math.max(800, stop - PASS);
      const A = 80;
      const beta = 0.1102 * (A - 8.7);
      const L = Math.ceil((A - 8) / (2.285 * ((2 * Math.PI * width) / sr))) | 1;
      const fc = (PASS + Math.max(stop, PASS + 800)) / 2 / sr;
      const h = new Float32Array(L);
      const i0b = besselI0(beta);
      let sum = 0;
      for (let i = 0; i < L; i++) {
        const m = i - (L - 1) / 2;
        const s = m === 0 ? 2 * fc : Math.sin(2 * Math.PI * fc * m) / (Math.PI * m);
        const u = (2 * i) / (L - 1) - 1;
        h[i] = (s * besselI0(beta * Math.sqrt(Math.max(0, 1 - u * u)))) / i0b;
        sum += h[i];
      }
      for (let i = 0; i < L; i++) h[i] /= sum;
      this.h = h;
      this.L = L;
    }

    // How many output samples `len` input samples give.
    outLength(len) { return this.D === 1 ? len : Math.max(0, Math.floor((len - this.L) / this.D) + 1); }

    // The last n decimated samples of x (the last one is x's last sample), into out[0..n).
    run(x, n, out) {
      const { D, h, L } = this;
      const end = x.length - 1;
      if (D === 1) { for (let m = 0; m < n; m++) out[m] = x[end - (n - 1 - m)]; return; }
      for (let m = 0; m < n; m++) {
        const last = end - (n - 1 - m) * D; // newest input sample under the filter
        const first = last - L + 1;
        let s = 0;
        for (let k = 0; k < L; k++) s += h[k] * x[first + k];
        out[m] = s;
      }
    }

    // The same, for a stream of overlapping snapshots (an AnalyserNode gives the latest N samples
    // each time): only the samples that are new since the last call are filtered, into a ring of
    // decimated samples. The overlap is found by matching the previous snapshot's last samples
    // exactly; `newEstimate` (from the clock) settles silence, where anything matches. Fills
    // out[0..n) with the latest n decimated samples (fewer if not yet available: returns how many)
    // and sets this.lag: how many input samples the last of them is before x's end.
    feed(x, n, out, newEstimate = null) {
      const { D, h, L } = this;
      const len = x.length;
      const T = 16;
      if (!this.ring || this.ring.length < n) { this.ring = new Float32Array(n); this.count = 0; this.head = 0; this.tail = null; }
      let fresh = len;
      if (this.tail && len > T) {
        const tail = this.tail;
        let flat = true;
        for (let i = 1; i < T; i++) if (tail[i] !== tail[0]) { flat = false; break; }
        if (flat) fresh = newEstimate == null ? len : clamp(Math.round(newEstimate), 0, len);
        else {
          const match = (p) => { for (let i = 0; i < T; i++) if (x[p + i] !== tail[i]) return false; return true; };
          let best = -1;
          if (newEstimate != null) {
            const p0 = len - T - Math.round(newEstimate);
            for (let d = 0; d <= 2048 && best < 0; d++) {
              if (p0 - d >= 0 && p0 - d <= len - T && match(p0 - d)) best = len - (p0 - d + T);
              else if (d && p0 + d >= 0 && p0 + d <= len - T && match(p0 + d)) best = len - (p0 + d + T);
            }
          }
          if (best < 0) for (let p = len - T; p >= 0; p--) if (match(p)) { best = len - (p + T); break; }
          fresh = best < 0 ? len : best;
        }
      }
      if (fresh >= len) { this.count = 0; this.lag = D - 1; } // no overlap: start afresh
      this.tail = x.slice(len - T);
      // The next output is D samples after the last one; this.lag counts from the previous end.
      let idx = len - fresh - 1 - this.lag + D;
      if (fresh >= len) idx = (len - 1) % D; // align so the last sample of x is (nearly) an output
      const ring = this.ring;
      const cap = ring.length;
      let last = idx - D;
      for (; idx < len; idx += D) {
        let s;
        if (D === 1) s = x[idx];
        else {
          const first = idx - L + 1;
          if (first < 0) { last = idx; continue; }
          s = 0;
          for (let k = 0; k < L; k++) s += h[k] * x[first + k];
        }
        ring[this.head] = s;
        this.head = (this.head + 1) % cap;
        if (this.count < cap) this.count++;
        last = idx;
      }
      this.lag = len - 1 - last;
      const m = Math.min(n, this.count);
      for (let i = 0; i < m; i++) out[i] = ring[(this.head - m + i + cap) % cap];
      return m;
    }
  }

  // ---------- the stiff-string fit ----------
  // pts: [{ h, f, sigma }] partial frequencies (Hz, sigma their standard error). Fits the stiff-string
  // model f_h = h·f0·√(1 + B·h²) ≈ h·(a + b·h²) with b = a·B/2 (Fletcher), with a prior on B
  // (B0 ± sB). Real partials don't all sit on the model: a partial near a body resonance, or one an
  // open string rings along with in sympathy, is a few cents off. So the fit is robust (Tukey's
  // biweight, refitted a few times from a median start): partials far from the consensus of the
  // others don't count. Each partial's error includes `jitterCents`·√h (how far a real partial
  // strays from the model: more for the higher ones), so no single loud partial outweighs the rest,
  // and the fundamental and its neighbours count most when they're heard. Returns { f1, sigma, B, used }:
  // f1 = a + b is the frequency of the fundamental (partial 1), even when that partial is too weak to hear.
  function stiffFit(pts, B0, sB, jitterCents = 0.8) {
    const use = pts.filter((p) => p.f > 0 && Number.isFinite(p.sigma));
    if (!use.length) return null;
    const J = 2 ** (jitterCents / 1200) - 1;
    // A partial well under the strongest (rel dB) is pulled more by its neighbours and the noise.
    const sd = use.map((p) => Math.sqrt(p.sigma * p.sigma + p.h * (p.f * J) ** 2 * 10 ** (Math.max(0, (p.rel || 0) - 6) / 20))); // Hz
    // Start: the median of what each partial says the fundamental is, under the prior B.
    const implied = use.map((p) => (p.f / (p.h * Math.sqrt(1 + B0 * p.h * p.h))) * Math.sqrt(1 + B0)).sort((x, y) => x - y);
    let a = implied[implied.length >> 1] / (1 + B0 / 2);
    let b = (a * B0) / 2;
    let rw = use.map(() => 1);
    let va = 0, vb = 0, cab = 0, vstat = 0;
    for (let it = 0; it < 6; it++) {
      if (it) {
        // Tukey biweight on each partial's residual, in units of its error (cut-off 3σ, ≥ 3.5 cents).
        for (let i = 0; i < use.length; i++) {
          const p = use[i];
          const fit = p.h * (a + b * p.h * p.h);
          const cents = Math.abs(centsOf(p.f, fit));
          const sc = Math.max(3.5, (3 * 1200 * sd[i]) / (p.f * Math.LN2));
          const u = cents / sc;
          rw[i] = u < 1 ? (1 - u * u) ** 2 : 0;
        }
      }
      let S = 0, Sx = 0, Sy = 0, Sxx = 0, Sxy = 0;
      let T11 = 0, T12 = 0, T22 = 0; // Σ w²·var_stat·x·xᵀ, for the noise-only variance (sandwich)
      for (let i = 0; i < use.length; i++) {
        const p = use[i];
        const sy = sd[i] / p.h;
        const w = rw[i] / (sy * sy);
        const X = p.h * p.h;
        const y = p.f / p.h;
        S += w; Sx += w * X; Sy += w * y; Sxx += w * X * X; Sxy += w * X * y;
        const vs = w * w * (p.sigma / p.h) ** 2;
        T11 += vs; T12 += vs * X; T22 += vs * X * X;
      }
      if (S <= 0) return null;
      // The prior on b as one more observation of b alone.
      const bp = (a * B0) / 2;
      const wb = 1 / ((a * sB) / 2) ** 2;
      const A22 = Sxx + wb;
      const det = S * A22 - Sx * Sx;
      a = (Sy * A22 - Sx * (Sxy + wb * bp)) / det;
      b = (S * (Sxy + wb * bp) - Sx * Sy) / det;
      va = A22 / det; vb = S / det; cab = -Sx / det;
      // var_stat(a + b) = gᵀ M⁻¹ T M⁻¹ g, g = (1, 1)
      const g1 = (A22 - Sx) / det;
      const g2 = (S - Sx) / det;
      vstat = g1 * g1 * T11 + 2 * g1 * g2 * T12 + g2 * g2 * T22;
      // Noise can push the stretch below anything a string has (B ≥ 1e-5 for any guitar string):
      // hold it there and fit the rest given it (not B = 0: the higher partials' real stretch would
      // then all go into the fundamental, reading it sharp).
      const bmin = (a * 1e-5) / 2;
      if (b < bmin) { b = bmin; a = (Sy - b * Sx) / S; va = 1 / S; vb = 0; cab = 0; vstat = T11 / (S * S); }
    }
    const used = use.filter((_, i) => rw[i] > 0.05).map((p) => p.h);
    if (!used.length) return null;
    return { f1: a + b, sigma: Math.sqrt(Math.max(0, va + vb + 2 * cab)), sigmaStat: Math.sqrt(Math.max(0, vstat)), B: a > 0 ? (2 * b) / a : 0, used };
  }

  // ---------- analysis of one stretch of sound ----------
  class Analyzer {
    constructor({ sampleRate, minFreq = 58, maxFreq = 1400, maxSecs = 0.66 }) {
      this.sr = sampleRate;
      this.dec = new Decimator(sampleRate);
      const rate = (this.rate = this.dec.rate);
      this.minFreq = minFreq;
      this.maxFreq = maxFreq;
      this.top = Math.min(PASS, rate * 0.45);
      // The spectrum: the newest ~170 ms, Hann, zero-padded 2×.
      this.W = 2 ** Math.round(Math.log2(0.17 * rate));
      this.N = this.W * 2;
      this.df = rate / this.N;
      this.K = Math.min(this.N >> 1, Math.ceil(this.top / this.df) + 8);
      this.hann = new Float64Array(this.W);
      let e = 0;
      for (let i = 0; i < this.W; i++) { this.hann[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (this.W - 1)); e += this.hann[i] ** 2; }
      this.hannEnergy = e;
      this.re = new Float64Array(this.N);
      this.im = new Float64Array(this.N);
      this.P = new Float64Array(this.K);
      this.floor = new Float64Array(this.K);
      this.L = new Float32Array(this.K);
      this.bg = null; // the room's steady background, per bin (learned while no string is heard)
      this.maxSecs = maxSecs;
      this.xd = new Float32Array(Math.ceil(maxSecs * rate) + 4);
      this.nd = 0;
      this.grid = [];
      for (let f = minFreq; f <= maxFreq; f *= 2 ** (1 / 96)) this.grid.push(f);
      this.sal = new Float32Array(this.grid.length);
      this.windows = new Map();
    }

    // Decimates x (raw input; its last sample is at time t) and takes the newest spectrum.
    frame(x, t) {
      const { dec, W, K, P, re, im, hann } = this;
      const est = this.lastT == null ? null : (t - this.lastT) * this.sr;
      this.lastT = t;
      const n = dec.feed(x, this.xd.length, this.xd, est);
      this.nd = n;
      this.t = t - dec.lag / this.sr; // the time of the last decimated sample
      if (n < W) return false;
      re.fill(0);
      im.fill(0);
      const off = n - W;
      for (let i = 0; i < W; i++) re[i] = this.xd[off + i] * hann[i];
      fft(re, im);
      for (let k = 0; k < K; k++) P[k] = re[k] * re[k] + im[k] * im[k] + 1e-20;
      this.noiseFloor();
      return true;
    }

    // Per-bin noise floor: the spectrum's median over ~70 Hz blocks (a noise bin's power is
    // exponential, so its mean is the median / ln 2), and at least the learned background.
    noiseFloor() {
      const { P, K, floor, L } = this;
      const B = 24;
      const nb = Math.ceil(K / B);
      const med = new Float64Array(nb);
      const tmp = new Float64Array(B);
      for (let b = 0; b < nb; b++) {
        const k0 = b * B;
        const k1 = Math.min(K, k0 + B);
        for (let k = k0; k < k1; k++) tmp[k - k0] = P[k];
        const v = tmp.subarray(0, k1 - k0).sort();
        med[b] = Math.log(v[(v.length - 1) >> 1] / Math.LN2);
      }
      // A block full of partials (dense harmonics) reads high: take the lower of it and its neighbours' mean.
      const sm = new Float64Array(nb);
      for (let b = 0; b < nb; b++) {
        const nbr = (med[Math.max(0, b - 1)] + med[Math.min(nb - 1, b + 1)]) / 2;
        sm[b] = Math.min(med[b], nbr + 0.7);
      }
      for (let k = 0; k < K; k++) {
        const x = k / B - 0.5;
        const b0 = clamp(Math.floor(x), 0, nb - 1);
        const b1 = Math.min(nb - 1, b0 + 1);
        const u = clamp(x - b0, 0, 1);
        let fl = Math.exp(sm[b0] * (1 - u) + sm[b1] * u);
        if (this.bg) fl = Math.max(fl, this.bg[k]);
        floor[k] = fl;
        L[k] = clamp(dB(P[k] / fl) - 6, 0, 40);
      }
    }

    // Learns the steady background (hum, a fan's whine) while no string is heard: quickly down,
    // slowly up. dt: seconds since the last call.
    learn(dt) {
      const { P, K } = this;
      if (!this.bg) { this.bg = Float64Array.from(this.floor.subarray(0, K)); return; }
      const up = 1 - Math.exp(-dt / 2.5);
      const down = 1 - Math.exp(-dt / 0.15);
      for (let k = 0; k < K; k++) {
        // Smoothed over 3 bins, so one noise bin's spike doesn't count.
        const p = (P[Math.max(0, k - 1)] + 2 * P[k] + P[Math.min(K - 1, k + 1)]) / 4;
        this.bg[k] += (p - this.bg[k]) * (p < this.bg[k] ? down : up);
      }
    }

    // A tone that isn't a string (a hum that switched on): take its partials into the background now.
    absorb(parts) {
      if (!this.bg) return;
      for (const p of parts) {
        const c = Math.round(p.f / this.df);
        for (let k = Math.max(0, c - 4); k <= Math.min(this.K - 1, c + 4); k++) this.bg[k] = Math.max(this.bg[k], this.P[k] * 1.5);
      }
    }

    // The spectrum's peaks: [{ f, e }] where e is the evidence (dB over the floor, less 6, ≤ 40).
    peaks() {
      const { L, P, K, df } = this;
      const out = [];
      const k0 = Math.max(3, Math.floor((this.minFreq * 0.45) / df));
      for (let k = k0; k < K - 2; k++) {
        const e = L[k];
        if (e <= 0 || e < L[k - 1] || e <= L[k + 1] || e < L[k - 2] || e < L[k + 2]) continue;
        const a = Math.log(P[k - 1]);
        const b = Math.log(P[k]);
        const c = Math.log(P[k + 1]);
        const den = a - 2 * b + c;
        const sh = den < 0 ? clamp((0.5 * (a - c)) / den, -0.5, 0.5) : 0;
        out.push({ f: (k + sh) * df, e });
      }
      out.f = Float64Array.from(out, (p) => p.f);
      out.e = Float64Array.from(out, (p) => p.e);
      return out;
    }

    // How well f explains the spectrum: SWIPE's kernel (Camacho & Harris 2008) on the spectrum's
    // peaks. Around each harmonic h of f, a peak at r·f counts e·cos(2π(r − h))/√h: fully on the
    // harmonic, against it halfway between (f is an octave too high), and against it at a third
    // (an octave and a fifth too high). An octave too low gets only the even harmonics' share, at
    // most 1/√2 of the right note's score; the tuning's strings, and the note already heard, decide.
    salienceAt(f, pk) {
      const pf = pk.f;
      const pe = pk.e;
      const n = pf.length;
      // First peak at or above 0.5·f (the peaks are in frequency order).
      let lo = 0, hi = n;
      const f0 = 0.5 * f;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (pf[mid] < f0) lo = mid + 1; else hi = mid; }
      const top = Math.min(this.top, 16.5 * f);
      const inv = 1 / f;
      let s = 0;
      for (let i = lo; i < n && pf[i] < top; i++) {
        const r = pf[i] * inv;
        const h = Math.round(r);
        s += pe[i] * COS_LUT[Math.round((r - h + 0.5) * 1024)] * INV_SQRT[h];
      }
      return s;
    }

    // The best few candidates: [{ f, S }] (local maxima of the salience over the grid), best first.
    candidates(n = 4) {
      const { grid, sal } = this;
      const pk = this.peaks();
      this.pk = pk;
      for (let i = 0; i < grid.length; i++) sal[i] = pk.length ? this.salienceAt(grid[i], pk) : 0;
      const out = [];
      for (let i = 1; i < grid.length - 1; i++) {
        if (sal[i] > 0 && sal[i] >= sal[i - 1] && sal[i] > sal[i + 1]) {
          // Parabolic peak of the salience between grid points.
          const a = sal[i - 1], b = sal[i], c = sal[i + 1];
          const den = a - 2 * b + c;
          const sh = den < 0 ? clamp((0.5 * (a - c)) / den, -0.5, 0.5) : 0;
          out.push({ f: grid[i] * 2 ** (sh / 96), S: b });
        }
      }
      out.sort((a, b) => b.S - a.S);
      // The salience's side lobes around a strong pitch: keep the strongest within 1.5 semitones.
      const kept = [];
      for (const c of out) if (!kept.some((k) => Math.abs(centsOf(c.f, k.f)) < 150)) kept.push(c);
      return kept.slice(0, n);
    }

    // The partial peaks of a note near f0 (fundamental, B its stiffness): [{ h, f, snr, noise }],
    // interpolated on the spectrum, at least 8 dB over the floor.
    partials(f0, B = 0, minSnr = 8) {
      const { P, floor, df, K } = this;
      const out = [];
      for (let h = 1; h * f0 * (1 + (B * h * h) / 2) < this.top && out.length < MAX_PARTIALS + 4; h++) {
        const fh = h * f0 * Math.sqrt(1 + B * h * h);
        const c = fh / df;
        const r = Math.max(2, Math.min(c * 0.012, (0.3 * f0) / df));
        const k0 = Math.max(2, Math.floor(c - r));
        const k1 = Math.min(K - 3, Math.ceil(c + r));
        let best = -1;
        for (let k = k0; k <= k1; k++) if (best < 0 || P[k] > P[best]) best = k;
        if (best <= k0 || best >= k1) continue; // not a peak inside the range
        const snr = dB(P[best] / floor[best]);
        if (snr < minSnr) continue;
        const a = Math.log(P[best - 1]);
        const b = Math.log(P[best]);
        const cc = Math.log(P[best + 1]);
        const den = a - 2 * b + cc;
        const sh = den < 0 ? clamp((0.5 * (a - cc)) / den, -0.5, 0.5) : 0;
        out.push({ h, f: (best + sh) * df, snr, noise: floor[best] / this.hannEnergy });
      }
      // The strongest MAX_PARTIALS, in order of h.
      if (out.length > MAX_PARTIALS) {
        const keep = new Set(out.slice().sort((p, q) => q.snr - p.snr).slice(0, MAX_PARTIALS));
        return out.filter((p) => keep.has(p));
      }
      return out;
    }

    // A note's level, the same way every time (whatever partials were picked out): the spectrum's
    // power at its first 8 partials (the peak within ±1%, or ±2 bins), less the noise floor there.
    levelAt(f0, B = 0) {
      const { P, floor, df, K } = this;
      let s = 0;
      this.levelFloor = 0; // the floor under those partials, summed (set as a side effect)
      for (let h = 1; h <= 8; h++) {
        const c = (h * f0 * Math.sqrt(1 + B * h * h)) / df;
        if (c > K - 3) break;
        const r = Math.max(2, c * 0.01);
        let pk = 0, fl = 0;
        for (let k = Math.max(1, Math.floor(c - r)); k <= Math.min(K - 1, Math.ceil(c + r)); k++) if (P[k] > pk) { pk = P[k]; fl = floor[k]; }
        s += Math.max(0, pk - fl);
        this.levelFloor += fl;
      }
      return s;
    }

    window(M) {
      let w = this.windows.get(M);
      if (!w) {
        w = new Float64Array(M);
        let e = 0;
        for (let i = 0; i < M; i++) { w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * (i + 0.5)) / M); e += w[i] * w[i]; }
        w.energy = e;
        this.windows.set(M, w);
      }
      return w;
    }

    // Follows each partial through the stretch: short Hann frames (~3.5 periods, half overlapping),
    // each partial demodulated at its own frequency. Fills parts[i].z = [{ t, re, im, snr }] and
    // returns { M, times, env (summed partial power per frame, over its noise: a linear SNR) }.
    demod(parts, f0) {
      const { rate, xd, nd } = this;
      const M = Math.min(nd, Math.round(rate * clamp(3.5 / f0, 0.035, 0.08)));
      const R = M >> 1;
      const J = Math.floor((nd - M) / R) + 1;
      const w = this.window(M);
      const times = new Float64Array(J);
      const env = new Float64Array(J);
      const power = new Float64Array(J); // the partials' summed power per frame (absolute)
      const start = nd - M - (J - 1) * R;
      for (let j = 0; j < J; j++) times[j] = this.t - (nd - (start + j * R + M / 2)) / rate;
      let noiseSum = 0;
      for (const p of parts) {
        const om = (2 * Math.PI * p.f) / rate;
        const dr = Math.cos(om);
        const di = -Math.sin(om);
        const noise = p.noise * w.energy; // expected |z|² of the noise
        noiseSum += noise;
        p.z = new Array(J);
        for (let j = 0; j < J; j++) {
          const s = start + j * R;
          let cr = Math.cos(om * s);
          let ci = -Math.sin(om * s);
          let zr = 0;
          let zi = 0;
          for (let i = 0; i < M; i++) {
            const v = w[i] * xd[s + i];
            zr += v * cr;
            zi += v * ci;
            const t = cr * dr - ci * di;
            ci = cr * di + ci * dr;
            cr = t;
          }
          const pw = zr * zr + zi * zi;
          p.z[j] = { t: times[j], re: zr, im: zi, snr: pw / noise };
          env[j] += pw;
          power[j] += pw;
        }
      }
      for (let j = 0; j < J; j++) env[j] /= noiseSum || 1;
      return { M, times, env, power, noisePow: noiseSum };
    }
  }

  // The frequency of one partial over frames [j0, j1]: a weighted line through its unwrapped phase.
  // Returns { f, sigma } (Hz) or null.
  function phaseSlope(p, j0, j1) {
    const z = p.z;
    const pts = [];
    for (let j = j0; j <= j1; j++) if (z[j].snr >= 2) pts.push(z[j]);
    if (pts.length < 3) return null;
    const ph = new Float64Array(pts.length);
    const w = new Float64Array(pts.length);
    const tEnd = pts[pts.length - 1].t;
    let prev = Math.atan2(pts[0].im, pts[0].re);
    ph[0] = prev;
    for (let i = 0; i < pts.length; i++) {
      const a = Math.atan2(pts[i].im, pts[i].re);
      if (i) {
        let d = a - prev;
        d -= 2 * Math.PI * Math.round(d / (2 * Math.PI));
        ph[i] = ph[i - 1] + d;
        prev = a;
      }
      // Weighted by SNR (the phase's precision), and towards the newest frames: a string's early,
      // loud frames would otherwise dominate, and that's while its pitch is still settling.
      w[i] = 2 * Math.min(pts[i].snr, 3e4) * Math.exp((pts[i].t - tEnd) / RECENT);
    }
    const line = () => {
      let S = 0, St = 0, Sp = 0;
      for (let i = 0; i < pts.length; i++) { S += w[i]; St += w[i] * pts[i].t; Sp += w[i] * ph[i]; }
      const tm = St / S;
      const pm = Sp / S;
      let Stt = 0, Stp = 0;
      for (let i = 0; i < pts.length; i++) { const dt = pts[i].t - tm; Stt += w[i] * dt * dt; Stp += w[i] * dt * (ph[i] - pm); }
      return { tm, pm, slope: Stp / Stt, Stt };
    };
    let L = line();
    // Unwrap again against the line (a noisy frame can fool the first pass), and refit.
    for (let i = 0; i < pts.length; i++) {
      const pred = L.pm + L.slope * (pts[i].t - L.tm);
      ph[i] -= 2 * Math.PI * Math.round((ph[i] - pred) / (2 * Math.PI));
    }
    L = line();
    let chi = 0;
    for (let i = 0; i < pts.length; i++) { const r = ph[i] - L.pm - L.slope * (pts[i].t - L.tm); chi += w[i] * r * r; }
    chi /= Math.max(1, pts.length - 2);
    const varSlope = (Math.max(1, chi) * 1.3) / L.Stt; // 1.3: half-overlapping frames aren't independent
    return { f: p.f + L.slope / (2 * Math.PI), sigma: Math.sqrt(varSlope) / (2 * Math.PI), chi };
  }

  // Two pitches whose ratio is a simple fraction (p/q, p and q up to 6): one may be the other's
  // harmonic, or both harmonics of one note.
  function related(f, g) {
    const r = Math.max(f, g) / Math.min(f, g);
    for (let q = 1; q <= 6; q++) {
      const p = Math.round(r * q);
      if (p >= 1 && p <= 6 * q && p <= 12 && Math.abs(centsOf(r, p / q)) < 25) return true;
    }
    return false;
  }

  // Is f (a candidate) just part of g's harmonic series? Most of f's first harmonics land on g's.
  function explainedBy(f, g, top = PASS) {
    let n = 0, hit = 0;
    for (let h = 1; h <= 4 && h * f < top; h++) {
      n++;
      const k = Math.max(1, Math.round((h * f) / g));
      const fk = k * g * Math.sqrt(1 + 1e-4 * k * k);
      if (Math.abs(centsOf(h * f, fk)) < 25 + 2 * k) hit++;
    }
    return n > 0 && hit >= Math.max(1, Math.ceil(n * 0.75));
  }

  // Explaining away (as in Klapuri's estimate-and-cancel): is a candidate higher than g just a
  // stretch of g's own harmonic comb? Each of its partials (parts) then has spectrum peaks about g
  // below and above it: g's neighbouring partials (a stiff string's spacing widens a little up the
  // series). True when most of the candidate's partial energy is like that.
  function inComb(parts, g, pk) {
    let tot = 0, ins = 0;
    for (const p of parts) {
      const w = p.snr;
      tot += w;
      const near = (lo, hi) => pk.some((q) => q.f >= lo && q.f <= hi);
      if (near(p.f - 1.12 * g, p.f - 0.97 * g) && near(p.f + 0.97 * g, p.f + 1.12 * g)) ins += w;
    }
    return tot > 0 && ins >= 0.75 * tot;
  }

  // ---------- the tracker: from stretches of sound to what the Tuner shows ----------
  // Noise filter (on by default): only a plucked string is shown. It has an attack (its harmonics
  // jump up together), its pitch settles within ~90 ms and holds, and it fades, slowly. Hum and a
  // fan have no attack (or don't fade: they're learned into the background); a voice glides and swells.
  class TunerEngine {
    constructor({ sampleRate, a4 = 440, minFreq = 58, maxFreq = 1400, noiseFilter = true } = {}) {
      this.an = new Analyzer({ sampleRate, minFreq, maxFreq });
      this.a4 = a4;
      this.noiseFilter = noiseFilter;
      this.strings = null; // MIDI notes of the open strings (guitar mode), or null (chromatic)
      this.pinned = null; // MIDI note of the string being tuned, if picked
      this.settle = 0.08; // s after the attack before the pitch counts (the pick's noise, the pitch glide)
      this.decide = 0.14; // s after the attack before it's judged a pick or not (a voice gives itself away by then)
      this.decideFaint = 0.25; // ... for a faint one
      this.maxSpan = 0.6; // s of sound a reading is measured over, at most
      this.lostTime = 0.3;
      this.droneTime = 1.5;
      this.minSalience = 14;
      this.maxSigma = 3; // cents: readings less precise than this aren't shown
      this.smooth = 0.2; // s of readings the shown pitch is the median of
      this.reset();
    }

    get rate() { return this.an.rate; }
    get locked() { return !!this.note; }

    // strings: MIDI of the open strings, to favour them when it's unclear which octave a note is in;
    // pinned: the string being tuned. Both null: a chromatic tuner.
    setPrior({ strings = null, pinned = null } = {}) { this.strings = strings && strings.length ? strings.slice() : null; this.pinned = pinned; }
    setA4(a4) { this.a4 = a4; }

    reset() {
      this.note = null;
      this.startT = null;
      this.lastT = null;
      this.drones = []; // { f, level }: steady tones that weren't strings, until the sound stops
      this.quietSince = null;
      this.history = [];
      this.an.bg = null;
    }

    // Prior weight of a pitch: guitar mode favours the open strings' notes (and their octave is
    // what's at stake), a picked string most of all. 1 = no preference.
    prior(f) {
      const m = 69 + 12 * Math.log2(f / this.a4);
      if (this.pinned != null) {
        const d = Math.abs(m - this.pinned);
        return 1 + 0.35 * Math.exp(-((d / 5) ** 2));
      }
      if (!this.strings) return 1;
      let d = Infinity;
      for (const s of this.strings) d = Math.min(d, Math.abs(m - s));
      return 1 + 0.25 * Math.exp(-((d / 2.5) ** 2));
    }

    // x: the latest raw input (Float32Array, its last sample at time t). Returns
    // { t, heard, state: 'idle' | 'attack' | 'note', freq, cents, midi, sigma, spread, snr, B, onsetT } —
    // freq etc. only once a note is measured.
    process(x, t) {
      const an = this.an;
      if (this.startT === null) this.startT = t;
      const dt = this.lastT === null ? 0.03 : clamp(t - this.lastT, 0.001, 0.5);
      this.lastT = t;
      const out = { t, heard: false, state: 'idle', freq: null };
      if (!an.frame(x, t)) return out;

      let cands = an.candidates(4);
      const best = cands.length ? cands[0].S : 0;
      out.salience = best;
      if (best < this.minSalience * 0.5) {
        if (this.quietSince === null) this.quietSince = t;
        if (t - this.quietSince > this.lostTime) this.drones = [];
      } else this.quietSince = null;

      if (this.note) {
        const r = this.follow(cands, t, out);
        if (r) return r;
      }
      let steady = true;
      if (!this.note) steady = this.acquire(cands, t, out);
      // The room's steady sounds are learned while no string is heard, and while what is heard has
      // no attack (a hum, a fan): never while a pick is being checked.
      if (!this.note && out.state === 'idle' && steady) an.learn(dt);
      return out;
    }

    // Measures a note at about f0 (B: its stiffness so far) over the sound since `from` (s).
    // Returns { f1, sigma, sigmaStat, B, used, parts, env, power, times, moving, fast, ... } or null.
    measure(f0, B, from) {
      const an = this.an;
      let parts = an.partials(f0, B);
      if (!parts.length) return null;
      // Only every 2nd (or 3rd) harmonic there: it's the note an octave (a twelfth) up, read low.
      if (parts.length >= 3) {
        const tot = parts.reduce((a, p) => a + 10 ** (p.snr / 10), 0);
        for (const k of [2, 3]) {
          const off = parts.reduce((a, p) => a + (p.h % k ? 10 ** (p.snr / 10) : 0), 0);
          if (off < 0.03 * tot) return null;
        }
      }
      // A first fit on the spectrum's peaks, to demodulate each partial close to its frequency.
      const coarse = stiffFit(parts.map((p) => ({ h: p.h, f: p.f, sigma: an.df * 0.1 })), this.stiffPrior(f0), 1.5e-4, 3);
      if (!coarse) return null;
      const d = an.demod(parts, coarse.f1);
      const { times, env, power } = d;
      const J = times.length;
      let j0 = 0;
      while (j0 < J && times[j0] - d.M / an.rate / 2 < from) j0++;
      // A peg being turned moves the pitch tens to hundreds of cents a second: then only the newest
      // ~0.12 s is measured (a long fit would average over the move, and lose count of the phase),
      // and carried forward to now at the rate it's moving.
      const tr = this.trend(parts, j0, J - 1);
      const rate = tr && Math.abs(tr.rate) > 25 && Math.abs(tr.rate) > 3 * tr.sd ? tr.rate : 0;
      const fitOver = (k0, settling) => {
        const pts = [];
        const maxSnr = parts.reduce((a, p) => Math.max(a, p.snr), 0);
        const jm = J - 1 - Math.floor((J - 1 - k0) / 2);
        let shift = 0, shiftW = 0;
        for (const p of parts) {
          const s = k0 <= J - 3 ? phaseSlope(p, k0, J - 1) : null;
          if (!s) continue;
          pts.push({ h: p.h, f: s.f, sigma: s.sigma, snr: p.snr, rel: maxSnr - p.snr });
          // The same partial over the newer half: how far the pitch has moved since (the pitch
          // settling after a hard pick). A partial's own offset cancels out here.
          if (settling && J - 1 - k0 >= 7) {
            const r = phaseSlope(p, jm, J - 1);
            if (r) {
              const sc = (1200 * Math.hypot(r.sigma, s.sigma)) / (s.f * Math.LN2);
              const w = 1 / (sc * sc + 0.04);
              shift += w * centsOf(r.f, s.f);
              shiftW += w;
            }
          }
        }
        let fit = pts.length ? stiffFit(pts, B || this.stiffPrior(f0), B ? 6e-5 : 1.2e-4) : null;
        if (fit && shiftW > 0) {
          const mv = shift / shiftW;
          const sd = 1 / Math.sqrt(shiftW);
          // Follow the settling once it's clear (2σ → part of it, 4σ → all of it).
          const k = clamp((Math.abs(mv) / sd - 2) / 2, 0, 1) * (Math.abs(mv) > 0.25 ? 1 : 0);
          if (k > 0) fit = { ...fit, f1: fit.f1 * 2 ** ((k * mv) / 1200), sigma: Math.hypot(fit.sigma, (sd * fit.f1) / 1731), sigmaStat: Math.hypot(fit.sigmaStat, (k * sd * fit.f1) / 1731) };
        }
        return fit;
      };
      let fit = fitOver(j0, true);
      // A peg being turned moves the pitch tens to hundreds of cents a second: then only the newest
      // ~0.12 s counts (a long fit would average over the move, and lose count of the phase), carried
      // forward to now at the rate it's moving. The caller decides whether the move is real.
      let fast = null;
      if (rate) {
        let k0 = j0;
        while (k0 < J - 4 && times[k0] < times[J - 1] - 0.12) k0++;
        fast = fitOver(k0, false);
        if (fast) fast = { ...fast, f1: fast.f1 * 2 ** ((rate * (times[J - 1] - (times[k0] + times[J - 1]) / 2)) / 1200) };
      }
      const moving = rate;
      // Too little sound since the attack for the phase: the spectrum's peaks will do for now.
      const precise = !!fit;
      if (!fit) fit = coarse;
      const snr = parts.reduce((a, p) => a + p.snr, 0);
      const out = { f1: fit.f1, sigma: precise ? fit.sigma : coarse.f1 * 0.002, sigmaStat: precise ? fit.sigmaStat : coarse.f1 * 0.002, B: fit.B, precise, moving, snr, parts, env, power, noisePow: d.noisePow, times, span: { j0, j1: J - 1 }, M: d.M, used: fit.used };
      if (fast) out.fast = { f1: fast.f1, sigma: fast.sigma, sigmaStat: fast.sigmaStat, B: fast.B, used: fast.used };
      return out;
    }

    // Where the measurement starts: after the pick's noise, and later as the note goes on, so the
    // pitch glide of the first ~0.2 s (a hard pick starts sharp) is left out once there's enough after it.
    spanFrom(onsetT, t) { return onsetT + clamp(0.4 * (t - onsetT), this.settle, 0.3); }

    stiffPrior(f) { return f < 160 ? 5e-5 : f < 280 ? 9e-5 : 1.4e-4; }

    // How fast the pitch moves over frames [j0, j1]: the strongest low partials' frame-to-frame
    // frequency (from the phase advance), a weighted line through it. { rate (cents/s), sd } or null.
    trend(parts, j0, j1) {
      const low = parts.filter((p) => p.f < 1200).sort((p, q) => q.snr - p.snr).slice(0, 5);
      if (low.length < 2) return null;
      while (j0 < j1 - 3 && parts[0].z[j1].t - parts[0].z[j0].t > 0.25) j0++;
      if (j1 - j0 < 3) return null;
      const rates = [];
      for (const p of low) {
        let S = 0, St = 0, Sc = 0, Stt = 0, Stc = 0;
        const pts = [];
        for (let k = j0 + 1; k <= j1; k++) {
          const a = p.z[k - 1];
          const b = p.z[k];
          if (a.snr < 2 || b.snr < 2) continue;
          const dt = b.t - a.t;
          const dphi = Math.atan2(b.im * a.re - b.re * a.im, b.re * a.re + b.im * a.im);
          const c = (1200 * dphi) / (2 * Math.PI * dt * p.f * Math.LN2);
          const sc = (1200 * Math.sqrt(0.5 / a.snr + 0.5 / b.snr)) / (2 * Math.PI * dt * p.f * Math.LN2);
          pts.push({ t: (a.t + b.t) / 2, c, w: 1 / (sc * sc + 0.25) });
        }
        if (pts.length < 3) continue;
        for (const q of pts) { S += q.w; St += q.w * q.t; Sc += q.w * q.c; }
        const tm = St / S, cm = Sc / S;
        for (const q of pts) { Stt += q.w * (q.t - tm) ** 2; Stc += q.w * (q.t - tm) * (q.c - cm); }
        if (Stt <= 0) continue;
        const rate = Stc / Stt;
        let chi = 0;
        for (const q of pts) chi += q.w * (q.c - cm - rate * (q.t - tm)) ** 2;
        chi /= Math.max(1, pts.length - 2);
        rates.push({ rate, sd: Math.sqrt(Math.max(1, chi) / Stt) });
      }
      if (rates.length < 2) return null;
      // The partials must agree: a voice's harmonic on top of one of them glides on its own.
      rates.sort((a, b) => a.rate - b.rate);
      const med = rates[rates.length >> 1];
      const agree = rates.filter((r) => Math.abs(r.rate - med.rate) <= Math.max(15, 0.35 * Math.abs(med.rate)) + 2 * r.sd);
      if (agree.length < Math.max(Math.min(3, rates.length), Math.ceil(rates.length * 0.6))) return { rate: 0, sd: Infinity };
      let W = 0, R = 0;
      for (const r of agree) { const w = 1 / (r.sd * r.sd); W += w; R += w * r.rate; }
      return { rate: R / W, sd: 1 / Math.sqrt(W) };
    }

    // The latest attack in a note's envelope (a jump of ≥ 6 dB over the quietest of the ~4 frames
    // before, to a clear level): its time, or null. A frame centred on an attack holds about half of
    // the level after it, so the attack is placed where the envelope crosses half its new level.
    // Also sets m.rise: how long it took to get from 10% to 90% of its peak (s). A pick is all but
    // instant (it shows as about one frame's length); a voice swells into a syllable over 60-160 ms.
    onsetIn(m, after = -Infinity) {
      const { env, times } = m;
      let on = null;
      for (let j = 2; j < env.length; j++) {
        let lo = Infinity;
        for (let i = Math.max(0, j - 4); i < j - 1; i++) lo = Math.min(lo, env[i]);
        if (!(env[j] >= 8 && env[j] >= 4 * Math.max(lo, 0.5) && env[j] >= env[j - 1] * 1.5)) continue;
        let post = env[j];
        let kp = j;
        for (let i = j + 1; i < Math.min(env.length, j + 6); i++) if (env[i] > post) { post = env[i]; kp = i; }
        const cross = (level) => {
          let k = Math.max(1, j - 3);
          while (k < kp && env[k] < level) k++;
          if (env[k] > env[k - 1] && env[k - 1] < level) return times[k - 1] + ((level - env[k - 1]) / (env[k] - env[k - 1])) * (times[k] - times[k - 1]);
          return times[k];
        };
        const T = cross(0.5 * post);
        if (T > after) { on = T; m.rise = cross(0.9 * post) - cross(Math.max(0.1 * post, lo)); }
      }
      return on;
    }

    // Looks for a new pick. Returns true when nothing heard had an attack (it's safe to learn the background).
    acquire(cands, t, out) {
      const an = this.an;
      let steady = true;
      const ranked = cands.map((c) => ({ ...c, S: c.S * this.prior(c.f) })).sort((a, b) => b.S - a.S);
      // The best candidate, and the next only if it isn't the best one's harmonic (or sub-harmonic).
      const tries = ranked.slice(0, 1);
      for (const c of ranked.slice(1, 3)) if (c.S >= 0.3 * ranked[0].S && !tries.some((q) => related(c.f, q.f) || explainedBy(c.f, q.f))) tries.push(c);
      for (const c of tries) {
        if (c.S < this.minSalience) break;
        const m = this.measure(c.f, 0, -Infinity);
        if (!m || m.parts.length < 2) continue;
        if (c !== tries[0] && c.f > 4.5 * tries[0].f && inComb(m.parts, tries[0].f, an.pk)) continue;
        out.heard = true;
        let onsetT = this.onsetIn(m);
        if (onsetT != null && onsetT >= t - 1.2) steady = false;
        if (this.noiseFilter) {
          if (onsetT == null || onsetT < this.startT + 0.1) continue;
          if (t - onsetT < this.decideAfter(m, onsetT)) { out.state = 'attack'; return false; }
          // A tone that turned out to be a hum before: a pick must stand 6 dB over it.
          const drone = this.drones.find((dr) => Math.abs(centsOf(c.f, dr.f)) < 50);
          if (drone && an.levelAt(m.f1, m.B) < drone.level * 4) continue;
          if (!this.pluckLike(m, onsetT)) continue;
        } else if (onsetT == null) onsetT = t - an.nd / an.rate;
        const pm = this.measure(m.f1, m.B, onsetT + this.settle);
        if (!pm) continue;
        this.note = { f: pm.f1, B: pm.B, onsetT, lockT: t, seenT: t, peak: an.levelAt(pm.f1, pm.B), levels: [], faded: false };
        this.history = [];
        return false;
      }
      return steady;
    }

    peakAfter(m, from) {
      let pk = 0;
      for (let j = 0; j < m.power.length; j++) if (m.times[j] >= from) pk = Math.max(pk, m.power[j]);
      return pk;
    }

    // How long after an attack to wait before judging it: a clear, sharp one (20 dB over the noise,
    // all but instant) at `decide`; a faint or a slow one (a soft thumb, a voice swelling into a
    // syllable) longer, until a syllable would have died away.
    decideAfter(m, on) {
      let pk = 0;
      for (let j = 0; j < m.env.length; j++) if (m.times[j] >= on) pk = Math.max(pk, m.env[j]);
      return pk >= 100 && !this.slowRise(m) ? this.decide : this.decideFaint;
    }

    // An attack that took longer than about one frame to come in (see onsetIn).
    slowRise(m) { return m.rise != null && m.rise > m.M / this.an.rate + 0.012; }

    // A pick, not a voice: after the attack the level doesn't swell or drop away quickly, and once
    // settled (a hard pick starts tens of cents sharp) the pitch holds: the strongest partials'
    // frame-to-frame frequency stays within 20 cents, plus what the noise allows.
    pluckLike(m, onsetT) {
      const { env, times } = m;
      const half = m.M / this.an.rate / 2;
      const js = [];
      for (let j = 0; j < env.length; j++) if (times[j] - half >= onsetT + 0.02) js.push(j);
      if (js.length < 2) return false;
      const first = env[js[0]];
      const last = env[js[js.length - 1]];
      let hi = 0;
      for (const j of js) hi = Math.max(hi, env[j]);
      // (env is a power SNR: noise alone is ~1 and swings by a few units, so changes must be bigger than that.)
      if (hi > first * 2.5 && last > first * 2 && hi - first > 8) return false; // swelling: a voice
      // Dying away: a syllable ending. (A pluck often drops 5-8 dB in its first ~100 ms, the attack's
      // own sound fading, then rings on: that's fine.)
      if (last < hi * 0.1) return false;
      // Coming back up once it has fallen: the next syllable. A string only fades.
      let low = Infinity;
      for (const j of js) { if (env[j] > 2 * low && env[j] - low > 8) return false; low = Math.min(low, env[j]); }
      const ss = js.filter((j) => times[j] >= onsetT + this.settle);
      if (ss.length < 3) return ss.length >= 1 || js.length >= 2;
      const top = m.parts.slice().sort((p, q) => q.snr - p.snr).slice(0, 3);
      let lo = Infinity, hiC = -Infinity, slack = 0;
      for (let k = 1; k < ss.length; k++) {
        let sum = 0, wsum = 0, var0 = 0;
        for (const p of top) {
          const a = p.z[ss[k - 1]];
          const b = p.z[ss[k]];
          const dt = b.t - a.t;
          const dphi = Math.atan2(b.im * a.re - b.re * a.im, b.re * a.re + b.im * a.im);
          const c = (1200 * dphi) / (2 * Math.PI * dt * p.f * Math.LN2);
          const sc = (1200 * Math.sqrt(0.5 / Math.max(a.snr, 1) + 0.5 / Math.max(b.snr, 1))) / (2 * Math.PI * dt * p.f * Math.LN2);
          const w = 1 / (sc * sc + 1);
          sum += w * c; wsum += w; var0 += w * w * sc * sc;
        }
        const c = sum / wsum;
        lo = Math.min(lo, c);
        hiC = Math.max(hiC, c);
        slack = Math.max(slack, (3 * Math.sqrt(var0)) / wsum);
      }
      // A slow attack has to hold its pitch very steadily: a voice swells in, a string doesn't glide.
      return hiC - lo <= (this.slowRise(m) ? 6 : 20) + slack;
    }

    follow(cands, t, out) {
      const N = this.note;
      const an = this.an;
      // A new pick on another note takes over: a candidate with an attack of its own, after this note's.
      const own = cands.find((c) => Math.abs(centsOf(c.f, N.f)) < 60);
      const ownS = own ? own.S * this.prior(own.f) : an.salienceAt(N.f, an.pk) * this.prior(N.f);
      for (const c of cands.slice(0, 2)) {
        const cs = c.S * this.prior(c.f);
        if (cs < this.minSalience || cs < 0.6 * ownS) continue; // a new pick is about as clear as the ringing note, or clearer
        if (Math.abs(centsOf(c.f, N.f)) < 60) continue;
        let m = null;
        const above = c.f > N.f;
        if (above && !explainedBy(c.f, N.f) && c.f > 4.5 * N.f) {
          m = this.measure(c.f, 0, -Infinity);
          if (!m || inComb(m.parts, N.f, an.pk)) continue; // a stretch of the ringing note's own harmonics
        }
        if (above && explainedBy(c.f, N.f)) {
          // Made of the ringing note's harmonics. A new note at ×2, ×3 or ×4 (the high e over the low E)
          // only if those harmonics jumped up on their own; anything else is the ringing note.
          const ratio = c.f / N.f;
          const mult = Math.round(ratio);
          if (!(mult >= 2 && mult <= 4 && Math.abs(centsOf(ratio, mult)) < 30)) continue;
          m = this.measure(c.f, 0, -Infinity);
          const on = m && this.onsetIn(m, N.onsetT + 0.1);
          const whole = on != null && this.measure(N.f, N.B, -Infinity);
          if (!whole || !this.ownJump(whole, mult, on)) continue;
        }
        if (!m) m = this.measure(c.f, 0, -Infinity);
        if (!m || m.parts.length < 2) continue;
        // Judged on what it doesn't share with the ringing note (a voice over a string makes a
        // "note" an octave below it from the string's harmonics and its own).
        const judged = above && explainedBy(c.f, N.f) ? m : this.ownOf(m, N);
        if (!judged || judged.parts.length < 3) continue;
        const on = this.onsetIn(judged, N.onsetT + 0.1);
        if (on == null || this.peakAfter(judged, on) <= 0 || Math.max(...judged.env) < 30) continue;
        if (t - on < this.decideAfter(m, on)) { this.pendingT = t; continue; } // keep following this note meanwhile
        if (this.noiseFilter && !this.pluckLike(judged, on)) continue;
        this.note = null;
        return null; // acquire() picks it up
      }

      const m = this.measure(N.f, N.B, this.spanFrom(N.onsetT, t));
      if (!m || m.parts.length < 1 || m.snr < 10) {
        if (t - N.seenT > this.lostTime) this.note = null;
        return null;
      }
      // A re-pick of the same string: the measurement starts again from it. Most of its partials
      // jump (another string's attack lifts only the partials the two share), and no other note
      // is starting right now.
      let again = this.pendingT === t ? null : this.onsetIn(m, N.onsetT + 0.15);
      if (again != null && !this.broadJump(m, again)) again = null;
      // It has to look like a pick too, once there's enough of it to tell (until then, carry on).
      if (again != null && this.noiseFilter && (t - again < this.decideAfter(m, again) || !this.pluckLike(m, again))) again = null;
      if (again != null) { N.onsetT = again; N.levels = []; N.faded = false; N.peak = 0; this.history = []; N.lastC = null; N.lv = []; N.minLate = null; N.lockT = t; }
      const m0 = again != null ? this.measure(N.f, N.B, this.spanFrom(N.onsetT, t)) || m : m;
      // A peg being turned: the partials glide together, the same way, reading after reading
      // (a voice on top of some of them can fake one reading's worth).
      N.moves = (N.moves || []).filter((q) => q.t > t - 0.16);
      N.moves.push({ t, r: m0.moving });
      const sameWay = N.moves.length >= 5 && N.moves.every((q) => q.r && Math.sign(q.r) === Math.sign(m0.moving)) && !this.growing(m0, t);
      // ... and the string itself still clearly there: its low partials in the fit.
      const lowOf = (u) => (u ? u.filter((h) => h <= 5).length : 0);
      const mm = sameWay && m0.fast && lowOf(m0.fast.used) >= 3 ? { ...m0, ...m0.fast, moving: m0.moving } : { ...m0, moving: 0 };
      // Only close to the last reading (a peg turned while it rings moves it smoothly): a slip
      // to an overtone, a voice over the string, is skipped.
      const jump = Math.abs(centsOf(mm.f1, N.f));
      const dtSeen = t - N.seenT;
      if (jump > 10 + 600 * dtSeen && again == null) {
        if (dtSeen > this.lostTime) this.note = null;
        return null;
      }
      N.seenT = t;
      // Level over time: a tone that doesn't fade isn't a string (a hum that switched on).
      const level = an.levelAt(mm.f1, N.B || mm.B);
      const levelFloor = an.levelFloor;
      N.peak = Math.max(N.peak, level);
      if (this.noiseFilter && !this.fading(N, t, level)) {
        this.drones = this.drones.filter((d) => Math.abs(centsOf(d.f, N.f)) >= 50).concat({ f: N.f, level });
        an.absorb(mm.parts);
        this.note = null;
        return out;
      }
      // Only a reading it can stand behind: measured from the phase (not just the spectrum's
      // peaks), and precise to a couple of cents (a note fading into the noise isn't).
      const sStat = (1200 * mm.sigmaStat) / (mm.f1 * Math.LN2);
      const nUsed = mm.used ? mm.used.length : 0;
      // A plucked string only fades: its partials getting louder with no new pick means another
      // sound is on top of them (someone talking at its pitch), and the reading can't be trusted.
      // Also over a longer stretch: 6 dB over the quietest it's been in the last second.
      N.lv = (N.lv || []).filter((q) => q.t > t - 1);
      N.lv.push({ t, l: level });
      let minL = Infinity;
      for (const q of N.lv) minL = Math.min(minL, q.l);
      // ... or since the note settled: a string never gets back 6 dB over the quietest it's been.
      if (t >= N.lockT + 0.3) N.minLate = Math.min(N.minLate == null ? Infinity : N.minLate, level);
      // (Clear of the noise: near the floor, a bin's power alone swings by that much.)
      const above = level > 6 * levelFloor;
      const growing = this.growing(mm, t) || (above && (level > 4 * minL || (N.minLate != null && t > N.lockT + 0.5 && level > 4 * N.minLate)));
      // Where the note is looked for follows every measurement it can trust (so a peg turned fast
      // isn't lost while the move is being confirmed), whether or not the reading is shown.
      if (!growing && mm.precise) N.f = mm.f1;
      // Faded 15 dB or more from its peak, with another sound now clearer than it: it's buried.
      // (Not by its own harmonics, nor by a candidate too faint to be a sound of its own.)
      const other = cands.find((c) => Math.abs(centsOf(c.f, N.f)) >= 60 && !related(c.f, N.f) && !explainedBy(c.f, N.f) && !explainedBy(N.f, c.f));
      const buried = level < N.peak * 0.03 && !!other && other.S > 1.5 * ownS && other.S > 2 * this.minSalience;
      // With another sound about (a voice), a reading has to rest on several partials, low ones among
      // them (one sound on top of a partial or two can't fake that). Alone, a fading string's last
      // couple of partials will do.
      const risky = !!other && other.S > 0.5 * ownS && other.S > this.minSalience;
      const thin = risky ? nUsed < 2 || (nUsed < 3 && sStat > 0.7) : nUsed < 1 || (nUsed < 2 && sStat > 1);
      const why = !mm.precise ? 'early' : growing ? 'covered' : buried ? 'buried' : sStat > this.maxSigma ? 'faint' : thin ? 'few' : risky && lowOf(mm.used) < Math.min(2, nUsed) ? 'high' : null;
      if (why === 'covered' || why === 'buried') N.coveredT = t;
      if (why) return this.weak(out, why);
      // After something covered it, wait until it's been clear for a moment.
      if (N.coveredT != null && t - N.coveredT < 0.15) return this.weak(out, 'covered');
      const raw = 1200 * Math.log2(mm.f1 / this.a4);
      // Steadying: the median of the last `smooth` s of readings. A reading far from them (a slip, a
      // knock) is skipped; two in a row is a real jump (a new pick) and starts afresh. While the
      // pitch is moving (a peg being turned), only the newest readings count, so the needle keeps up.
      const H = this.history;
      const med = (a) => { const v = a.map((q) => q.c).sort((x, y) => x - y); return v.length ? (v.length % 2 ? v[v.length >> 1] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2) : null; };
      // (Over longer the less precise the readings are: a quiet string's needle stays calm.)
      const win = mm.moving ? 0.07 : clamp(this.smooth + 0.12 * sStat, this.smooth, 0.5);
      const prev = med(H.filter((q) => q.t >= t - win - 1e-9));
      // A ringing string's pitch only changes for a reason that shows: a new pick (which starts the
      // readings afresh) or a peg being turned (the partials gliding together). A reading off the
      // others for no such reason (a voice on top of one of its partials, a knock) is left out.
      const lim = Math.max(3, Math.min(6, 4 * sStat)) + Math.abs(mm.moving) * 0.1;
      // Readings held back like this that agree among themselves for a while are believed after all
      // (the peg was turned while the readings were too weak to show).
      N.held = (N.held || []).filter((q) => q.t > t - 0.4);
      const agreed = () => {
        N.held.push({ t, c: raw });
        if (N.held.length < 12) return false;
        const v = N.held.map((q) => q.c).sort((a, b) => a - b);
        return v[v.length - 1] - v[0] < 1.5;
      };
      if (prev != null && Math.abs(raw - prev) > lim) {
        if (!agreed()) return this.weak(out, 'jump');
        H.length = 0;
      }
      // ... and after a gap (readings left out, or too weak to show), close to the last one shown,
      // or to where it would be by now if a peg is being turned.
      else if (prev == null && N.lastC != null) {
        const expect = N.lastC + (mm.moving || 0) * (t - N.lastCT);
        if (Math.abs(raw - expect) > Math.max(2, 3 * sStat) + Math.abs(mm.moving) * 0.1 + Math.min(1.5, 10 * (t - N.lastCT)) && !agreed()) return this.weak(out, 'jump');
        // ... and confirmed by the next reading before it's shown.
        if (!N.pendingC || t - N.pendingC.t > 0.1 || Math.abs(raw - N.pendingC.c - (mm.moving || 0) * (t - N.pendingC.t)) > Math.max(1.5, 3 * sStat)) {
          N.pendingC = { t, c: raw };
          return this.weak(out, 'confirm');
        }
      }
      N.pendingC = null;
      N.held = [];
      if (mm.moving && Math.abs(mm.moving) > 25) { while (H.length && H[0].t < t - 0.07) H.shift(); }
      H.push({ t, c: raw });
      while (H.length && H[0].t < t - 0.3) H.shift();
      const cents = med(H.filter((q) => q.t >= t - win - 1e-9));
      N.lastC = raw;
      N.lastCT = t;
      N.B = N.B ? N.B * 0.8 + mm.B * 0.2 : mm.B;
      const midi = Math.round(69 + cents / 100);
      const cs = H.map((h) => h.c).sort((a, b) => a - b);
      const spread = cs.length >= 3 ? cs[Math.floor(cs.length * 0.75)] - cs[Math.floor(cs.length * 0.25)] : Infinity;
      Object.assign(out, {
        heard: true,
        state: 'note',
        freq: this.a4 * 2 ** (cents / 1200),
        raw: mm.f1,
        midi,
        cents: cents - (midi - 69) * 100,
        sigma: (1200 * mm.sigma) / (mm.f1 * Math.LN2),
        sigmaStat: sStat,
        spread: Math.max(spread, mm.precise ? 0 : 2),
        precise: mm.precise,
        snr: mm.snr,
        B: N.B,
        partials: mm.used ? mm.used.length : 0,
        onsetT: N.onsetT,
      });
      return out;
    }

    // A candidate's measurement without the partials it shares with the ringing note N (within 1%):
    // what's left is what's new, and it alone must look like a pick. Null if too little is left.
    ownOf(m, N) {
      const B = N.B || 0;
      const own = m.parts.filter((p) => {
        const k = Math.max(1, Math.round(p.f / N.f));
        return Math.abs(centsOf(p.f, k * N.f * Math.sqrt(1 + B * k * k))) > 17 + k;
      });
      if (own.length < 2) return null;
      const J = m.times.length;
      const env = new Float64Array(J);
      const power = new Float64Array(J);
      let noise = 0;
      for (const p of own) {
        noise += p.noise;
        for (let j = 0; j < J; j++) { const pw = p.z[j].re ** 2 + p.z[j].im ** 2; env[j] += pw; power[j] += pw; }
      }
      const w = this.an.window(m.M);
      for (let j = 0; j < J; j++) env[j] /= noise * w.energy;
      return { ...m, parts: own, env, power };
    }

    // A note is heard, but this reading isn't shown; why: 'early' (too little sound since the pick),
    // 'faint' (too imprecise), 'few' / 'high' (too few partials, or none of the low ones), 'covered' (another sound on top of it), 'buried' (faded under
    // another sound), 'jump' (off the readings before it), 'confirm' (waiting for a second one).
    weak(out, why) { out.heard = true; out.state = 'note'; out.weak = true; out.why = why; return out; }

    // Is the note's partial power, over the last ~80 ms, 2 dB or more over what it was 0.1-0.25 s ago?
    growing(m, t) {
      let a = 0, na = 0, b = 0, nb = 0;
      for (let j = 0; j < m.times.length; j++) {
        const dt = t - m.times[j];
        if (dt < 0.08) { a += m.power[j]; na++; } else if (dt >= 0.1 && dt < 0.25) { b += m.power[j]; nb++; }
      }
      if (!na || !nb) return false;
      // Less the noise's share, and by clearly more than the noise alone could add.
      const nz = m.noisePow || 0;
      const A = a / na - nz;
      const Bv = b / nb - nz;
      return A > 1.6 * Math.max(Bv, 0) && A - Bv > 3 * nz;
    }

    // Did most of a note's partials (by energy) jump up by 6 dB or more at `on`?
    broadJump(m, on) {
      let tot = 0, jumped = 0;
      for (const p of m.parts) {
        let b = 0, nb = 0, a = 0, na = 0;
        for (const z of p.z) {
          const pw = z.re * z.re + z.im * z.im;
          if (z.t > on - 0.15 && z.t < on - 0.03) { b += pw; nb++; } else if (z.t > on + 0.03 && z.t < on + 0.15) { a += pw; na++; }
        }
        if (!nb || !na) continue;
        a /= na; b /= nb;
        tot += a;
        if (a > 4 * b) jumped += a;
      }
      return tot > 0 && jumped >= 0.6 * tot;
    }

    // Did the harmonics at multiples of `mult` jump up at `on` on their own (a new note at mult × f)?
    // own: a measurement of the ringing note over the whole stretch.
    ownJump(own, mult, on) {
      const level = (p, a, b) => { let s = 0, n = 0; for (const z of p.z) if (z.t > a && z.t < b) { s += z.re * z.re + z.im * z.im; n++; } return n ? s / n : 0; };
      let ob = 0, oa = 0, mb = 0, ma = 0;
      for (const p of own.parts) {
        const b = level(p, on - 0.15, on - 0.03);
        const a = level(p, on + 0.03, on + 0.15);
        if (p.h % mult === 0) { mb += b; ma += a; } else { ob += b; oa += a; }
      }
      // The multiples jumped by 6 dB or more, the others not by 3 dB (that would be a re-pick).
      return ma > mb * 4 && !(oa > ob * 2);
    }

    // Keeps track of the note's level; false when it's clearly a drone (not fading like a string).
    fading(N, t, level) {
      if (N.faded) return true;
      N.levels.push({ t, l: dB(Math.max(level, 1e-9)) });
      if (t - N.onsetT < this.droneTime) return true;
      const mean = (a, k) => a.reduce((s, p) => s + p[k], 0) / a.length;
      const early = N.levels.filter((p) => p.t <= N.levels[0].t + 0.3);
      const late = N.levels.filter((p) => p.t >= t - 0.3);
      const e = mean(early, 'l');
      const l = mean(late, 'l');
      if (e - l >= 2) { N.faded = true; N.levels = []; return true; }
      // Not down 2 dB yet, but fading at a string's pace (a wound string can ring for seconds).
      if (e - l >= 0.5 * (mean(late, 't') - mean(early, 't'))) return true;
      return false;
    }
  }

  const api = { TunerEngine, Analyzer, Decimator, stiffFit, phaseSlope, related, explainedBy, inComb, fft };
  root.TunerEngineLib = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
