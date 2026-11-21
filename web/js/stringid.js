// Which string a note was played on, from the sound itself.
//
// A pitch can be played in two to five places on the neck, and the pitch detector can't tell them
// apart. What differs is the string's stiffness. A real string's overtones run a little sharp of
// whole multiples of the fundamental: partial n sits at n·f0·√(1 + B·n²). B (the inharmonicity
// coefficient) grows with the string's core diameter to the 4th power and with 1/L², so it is
// different on every string and grows as you fret higher (a shorter string is stiffer for its
// length): B(fret) = B(open) · 2^(fret/6). The same E4 is B ≈ 1e-5 on the open high E string and
// several times that at the 5th fret of the B string or the 9th of the G.
//
// 1. analyze(): measures B from ~0.1–0.2 s of a note. It finds the partials in a zero-padded FFT,
//    interpolates each peak, and fits (f_n / n)² = f0² + f0²·B·n² by least squares, dropping
//    outliers. Returns ln B with its uncertainty.
// 2. StringModel: ln B for every string and fret, from string physics (a typical 10–46 set) or,
//    better, fitted to your own guitar from a few calibration notes.
// 3. StringLocator: combines the measurement with where the hand has been (the old guess) in a
//    Bayesian way: posterior ∝ prior(position | hand) × likelihood(ln B | string, fret).
//    Without a measurement it behaves like the old hand tracker.
(function (root) {
  'use strict';

  const LN2_6 = Math.LN2 / 6; // ln B rises by this per fret: B ∝ 1/L², L halves every 12 frets
  const STD_OPEN = { 1: 64, 2: 59, 3: 55, 4: 50, 5: 45, 6: 40 };
  const STRINGS_LOW_FIRST = [6, 5, 4, 3, 2, 1];

  // ---------- FFT ----------
  // In-place radix-2 complex FFT. re, im: Float64Array of a power-of-2 length.
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
          const xr = re[b] * cr - im[b] * ci;
          const xi = re[b] * ci + im[b] * cr;
          re[b] = re[a] - xr; im[b] = im[a] - xi;
          re[a] += xr; im[a] += xi;
          const t = cr * wr - ci * wi;
          ci = cr * wi + ci * wr;
          cr = t;
        }
      }
    }
  }

  // Log-magnitude spectrum of x, Hann-windowed and zero-padded `pad` times. → { db, binHz }
  function spectrum(x, sr, pad = 4) {
    const n = x.length;
    let m = 1;
    while (m < n * pad) m <<= 1;
    const re = new Float64Array(m);
    const im = new Float64Array(m);
    let mean = 0;
    for (let i = 0; i < n; i++) mean += x[i];
    mean /= n;
    for (let i = 0; i < n; i++) re[i] = (x[i] - mean) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)));
    fft(re, im);
    const half = m >> 1;
    const db = new Float64Array(half);
    for (let k = 0; k < half; k++) db[k] = 10 * Math.log10(re[k] * re[k] + im[k] * im[k] + 1e-20);
    return { db, binHz: sr / m };
  }

  // Weighted least squares y = a + b·x. → { a, b, seB, rms }
  function linfit(xs, ys, ws) {
    let sw = 0, sx = 0, sy = 0;
    for (let i = 0; i < xs.length; i++) { sw += ws[i]; sx += ws[i] * xs[i]; sy += ws[i] * ys[i]; }
    const mx = sx / sw;
    const my = sy / sw;
    let sxx = 0, sxy = 0;
    for (let i = 0; i < xs.length; i++) { sxx += ws[i] * (xs[i] - mx) ** 2; sxy += ws[i] * (xs[i] - mx) * (ys[i] - my); }
    const b = sxx > 0 ? sxy / sxx : 0;
    const a = my - b * mx;
    let ss = 0;
    for (let i = 0; i < xs.length; i++) ss += ws[i] * (ys[i] - a - b * xs[i]) ** 2;
    const dof = Math.max(1, xs.length - 2);
    const s2 = ss / sw * (xs.length / dof);
    return { a, b, seB: sxx > 0 ? Math.sqrt(s2 / (sxx / sw) / xs.length) : Infinity, rms: Math.sqrt(ss / sw) };
  }

  const median = (v) => { const s = [...v].sort((a, b) => a - b); return s.length ? s[s.length >> 1] : 0; };

  const B_MIN = 2e-6; // below what a guitar string can be; also the floor for a fit that comes out ≤ 0

  // Measures the inharmonicity of one note. x: samples taken after the pick attack (≥ ~40 ms;
  // ~170 ms is best), sr: sample rate, f0: the detector's pitch estimate (Hz).
  // → { lnB, sigma, B, f0, partials } or null if too few partials stand out.
  // sigma: the standard error of lnB, from the fit.
  function analyze(x, sr, f0, { maxPartials = 30, maxHz = 9000 } = {}) {
    if (!x || x.length < 1024 || !(f0 > 30)) return null;
    const { db, binHz } = spectrum(x, sr, x.length < 4096 ? 8 : 4);
    const top = Math.min(db.length - 2, Math.floor(Math.min(maxHz, 0.45 * sr) / binHz));
    let peak = -Infinity;
    for (let k = 1; k <= top; k++) if (db[k] > peak) peak = db[k];
    const floor = median(db.subarray(1, top));
    const minDb = Math.max(floor + 14, peak - 65);
    const res = x.length / sr; // a partial is resolved to about 1 / window
    const parts = []; // { n, f, amp }
    let a = f0 * f0;
    let B = 0;
    let missed = 0;
    for (let n = 1; n <= maxPartials; n++) {
      const pred = n * Math.sqrt(a) * Math.sqrt(1 + B * n * n);
      if (pred > top * binHz) break;
      // Search ±25% of f0 around the prediction at first; narrower once B is known from several partials.
      const span = (parts.length >= 6 ? 0.12 : 0.25) * f0;
      const k0 = Math.max(1, Math.floor((pred - span) / binHz));
      const k1 = Math.min(top, Math.ceil((pred + span) / binHz));
      let kb = -1;
      for (let k = k0; k <= k1; k++) if (kb < 0 || db[k] > db[kb]) kb = k;
      const isPeak = kb > k0 && kb < k1 && db[kb] >= db[kb - 1] && db[kb] >= db[kb + 1];
      if (!isPeak || db[kb] < minDb) {
        if (++missed > 6 && parts.length >= 5) break;
        continue;
      }
      missed = 0;
      // Parabolic interpolation on the log spectrum (Hann's main lobe is close to a Gaussian).
      const y0 = db[kb - 1], y1 = db[kb], y2 = db[kb + 1];
      const den = y0 - 2 * y1 + y2;
      const d = den < 0 ? Math.max(-0.5, Math.min(0.5, (0.5 * (y0 - y2)) / den)) : 0;
      parts.push({ n, f: (kb + d) * binHz, amp: y1 - 0.25 * (y0 - y2) * d });
      if (parts.length >= 4) {
        const fit = fitParts(parts);
        if (fit.a > 0) { a = fit.a; B = Math.max(0, fit.b / fit.a); }
      }
    }
    if (parts.length < 5) return null;
    // Drop outliers (a peak from another ringing string or the room) and refit.
    let use = parts;
    for (let pass = 0; pass < 2; pass++) {
      const fit = fitParts(use);
      const r = use.map((p) => (p.f / p.n) ** 2 - fit.a - fit.b * p.n * p.n);
      const mad = median(r.map(Math.abs)) * 1.4826 + 1e-9;
      const keep = use.filter((p, i) => Math.abs(r[i]) <= 3 * mad);
      if (keep.length === use.length || keep.length < 5) break;
      use = keep;
    }
    const fit = fitParts(use);
    if (!(fit.a > 0)) return null;
    const Bf = fit.b / fit.a;
    const nMax = use[use.length - 1].n;
    // The B a fit of this length can still see: a shift of ~1/20 of the frequency resolution at the top partial.
    const bRes = Math.max(B_MIN, (2 * 0.05) / (res * Math.sqrt(fit.a) * nMax ** 3));
    const relSe = fit.seB / fit.a;
    const Bv = Math.max(Bf, B_MIN);
    // In log terms: the fit's spread, but never tighter than resolution allows.
    let sigma = Math.sqrt((relSe / Math.max(Bv, bRes)) ** 2 + 0.05 ** 2);
    sigma = Math.min(3, sigma);
    return { lnB: Math.log(Math.max(Bv, bRes * 0.5)), sigma, B: Bf, f0: Math.sqrt(fit.a), partials: use.length, upper: Bf < bRes };
  }

  // Fit (f_n/n)² = a + b·n², weighting partials by how far they stand above the floor.
  function fitParts(parts) {
    const xs = parts.map((p) => p.n * p.n);
    const ys = parts.map((p) => (p.f / p.n) ** 2);
    const top = Math.max(...parts.map((p) => p.amp));
    // Frequency error of a peak ∝ 1/amplitude; y error ∝ f·err/n² ... weight ∝ amp² · n² (in linear terms), capped.
    const ws = parts.map((p) => Math.min(1, 10 ** ((p.amp - top) / 20) * 10) ** 2 * p.n * p.n);
    return linfit(xs, ys, ws);
  }

  // ---------- the guitar's strings ----------
  // Open-string B for a typical 10–46 electric set at 25.5", from B = π³·E·d⁴ / (64·T·L²) with each
  // string's steel core: E 0.010" plain … low E 0.020" core. Real guitars differ by a factor of about
  // 1.5 either way (gauge, scale, wound vs plain G, acoustic sets), so the uncalibrated model is wide.
  const DEFAULT_B0 = { 1: 1.3e-5, 2: 4.0e-5, 3: 1.1e-4, 4: 7.5e-5, 5: 9.5e-5, 6: 2.0e-4 };

  class StringModel {
    // strings: { [s]: { lnB0, k } }; sigma: spread of a real note around the model (in ln B).
    constructor({ strings = null, sigma = 0.55, calibrated = false, tuning = STD_OPEN } = {}) {
      this.tuning = tuning;
      this.strings = {};
      for (const s of STRINGS_LOW_FIRST) {
        const c = strings && strings[s];
        this.strings[s] = c ? { lnB0: c.lnB0, k: c.k } : { lnB0: Math.log(DEFAULT_B0[s]), k: LN2_6 };
      }
      this.sigma = sigma;
      this.calibrated = calibrated;
    }
    lnB(s, f) { const c = this.strings[s]; return c.lnB0 + c.k * f; }

    // Fit to calibration notes [{ s, f, lnB, sigma }]. A string with notes at two or more frets gets
    // its own slope; with one, the physical slope. Strings without notes keep the default, moved by
    // how far the measured strings are from it (a heavier or lighter set moves all of them).
    static fit(samples, { tuning = STD_OPEN } = {}) {
      const base = new StringModel({ tuning });
      const shift = [];
      const strings = {};
      for (const s of STRINGS_LOW_FIRST) {
        const pts = samples.filter((p) => p.s === s);
        if (!pts.length) continue;
        const frets = new Set(pts.map((p) => p.f));
        let lnB0, k;
        if (frets.size >= 2) {
          const ft = linfit(pts.map((p) => p.f), pts.map((p) => p.lnB), pts.map((p) => 1 / (p.sigma || 0.2) ** 2));
          k = Math.max(0.6 * LN2_6, Math.min(1.6 * LN2_6, ft.b));
          const mf = pts.reduce((x, p) => x + p.f, 0) / pts.length;
          const ml = pts.reduce((x, p) => x + p.lnB, 0) / pts.length;
          lnB0 = ml - k * mf;
        } else {
          k = LN2_6;
          lnB0 = pts.reduce((x, p) => x + p.lnB - k * p.f, 0) / pts.length;
        }
        strings[s] = { lnB0, k };
        shift.push(lnB0 - base.strings[s].lnB0);
      }
      const avg = shift.length ? shift.reduce((a, b) => a + b, 0) / shift.length : 0;
      for (const s of STRINGS_LOW_FIRST) {
        if (!strings[s]) strings[s] = { lnB0: base.strings[s].lnB0 + avg, k: LN2_6 };
      }
      // How far the calibration notes sit from the fitted model, with a floor: a note played
      // with a different pick or force varies more than two careful calibration plucks.
      const res = samples.map((p) => p.lnB - (strings[p.s].lnB0 + strings[p.s].k * p.f));
      const rms = res.length ? Math.sqrt(res.reduce((a, r) => a + r * r, 0) / res.length) : 0;
      const sigma = Math.max(0.22, Math.min(0.5, 1.5 * rms));
      return new StringModel({ strings, sigma, calibrated: true, tuning });
    }

    toJSON() { return { strings: this.strings, sigma: this.sigma, calibrated: this.calibrated }; }
    static fromJSON(o, tuning = STD_OPEN) {
      if (!o || !o.strings) return new StringModel({ tuning });
      return new StringModel({ strings: o.strings, sigma: o.sigma, calibrated: !!o.calibrated, tuning });
    }
  }

  // The notes the calibration asks for: each open string, then each string at the 7th fret.
  const CALIBRATION = [
    ...STRINGS_LOW_FIRST.map((s) => ({ s, f: 0 })),
    ...STRINGS_LOW_FIRST.map((s) => ({ s, f: 7 })),
  ];

  // ---------- placing notes ----------
  // Where each heard note was played. place() answers at once from the hand position (as the old
  // tracker did); refine() answers again once the note's sound has been measured.
  class StringLocator {
    constructor({ model = new StringModel(), tuning = STD_OPEN, maxFret = 22, handWidth = 1.6 } = {}) {
      this.model = model;
      this.tuning = tuning;
      this.maxFret = maxFret;
      this.handWidth = handWidth; // frets: how sharply the prior prefers the hand's spot
      this.center = null;
      this.notes = new Map(); // id → { midi, win, c, place }
      this.lastId = null;
    }
    reset() { this.center = null; this.notes.clear(); this.lastId = null; }

    // The candidates for a pitch and each one's log prior.
    candidates(midi, win, c) {
      const out = [];
      for (const s of STRINGS_LOW_FIRST) {
        const f = Math.round(midi) - this.tuning[s];
        if (f < 0 || f > this.maxFret) continue;
        let cost = Math.abs(f - c);
        if (win && (f < win.lo - 1 || f > win.hi + 1)) cost += 3;
        out.push({ s, f, lp: -cost / this.handWidth });
      }
      return out;
    }

    handCenter(win) {
      const mid = win ? (win.lo + win.hi) / 2 : null;
      return this.center != null ? (mid != null ? 0.5 * this.center + 0.5 * mid : this.center) : mid != null ? mid : 5;
    }

    // feat: an analyze() result or null. → { s, f, p, cands: [{ s, f, p }] }
    decide(midi, win, c, feat) {
      const cands = this.candidates(midi, win, c);
      if (!cands.length) return null;
      for (const k of cands) {
        let ll = 0;
        if (feat) {
          const sd = Math.sqrt(this.model.sigma ** 2 + feat.sigma ** 2);
          const z = (feat.lnB - this.model.lnB(k.s, k.f)) / sd;
          // An "upper" reading only says B is at most this: no penalty for candidates below it.
          ll = feat.upper && z > 0 ? 0 : -0.5 * z * z;
        }
        k.lw = k.lp + ll;
      }
      const m = Math.max(...cands.map((k) => k.lw));
      const tot = cands.reduce((a, k) => a + Math.exp(k.lw - m), 0);
      for (const k of cands) k.p = Math.exp(k.lw - m) / tot;
      const best = cands.reduce((a, k) => (k.p > a.p ? k : a));
      return { s: best.s, f: best.f, p: best.p, cands: cands.map(({ s, f, p }) => ({ s, f, p })) };
    }

    // A note was heard. id: anything that names it for refine(); feat: if already measured.
    place(midi, win = null, id = null, feat = null) {
      const c = this.handCenter(win);
      const d = this.decide(midi, win, c, feat);
      if (!d) return null;
      this.moveHand(null, d.f);
      if (id != null) {
        this.notes.set(id, { midi, win, c, place: d });
        this.lastId = id;
        if (this.notes.size > 32) this.notes.delete(this.notes.keys().next().value);
      }
      return { s: d.s, f: d.f, p: d.p, measured: !!feat };
    }

    // The note's sound has been measured. → the new place if it moved, else null.
    refine(id, feat) {
      const n = this.notes.get(id);
      if (!n || !feat) return null;
      const d = this.decide(n.midi, n.win, n.c, feat);
      if (!d) return null;
      const old = n.place;
      n.place = d;
      if (d.s === old.s && d.f === old.f) return null;
      // The hand estimate followed the old guess: move it to follow the new one (only if this is
      // still the latest note, otherwise later notes have already pulled it along).
      if (id === this.lastId) this.moveHand(old.f, d.f);
      return { s: d.s, f: d.f, p: d.p, measured: true, from: { s: old.s, f: old.f } };
    }

    moveHand(oldF, f) {
      if (oldF == null) this.center = this.center == null ? f : 0.6 * this.center + 0.4 * f;
      else if (this.center != null) this.center += 0.4 * (f - oldF);
    }
  }

  const api = { fft, spectrum, analyze, StringModel, StringLocator, CALIBRATION, DEFAULT_B0, LN2_6, B_MIN };
  root.StringId = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
