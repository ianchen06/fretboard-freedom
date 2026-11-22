// Pitch detection for a single guitar note.
//
// Yin: the YIN estimator (de Cheveigné & Kawahara, 2002) on one frame of audio.
// NoteTracker: turns a stream of frames into "a note was played" events. It needs the pitch to hold
// steady for a moment before reporting it, and it reports the same pitch again only after a new pick
// attack, so a ringing string isn't counted twice and a re-picked one is.
// refinePitch + TunerFilter: the precise tuner, to a tenth of a cent on a held note.
(function (root) {
  'use strict';

  const dbToLin = (db) => 10 ** (db / 20);
  const linToDb = (v) => (v > 0 ? 20 * Math.log10(v) : -120);

  // Energy at one frequency (Goertzel), Hann-windowed.
  function toneEnergy(x, freq, sr) {
    const n = x.length;
    const w = 2 * Math.cos((2 * Math.PI * freq) / sr);
    let s1 = 0;
    let s2 = 0;
    for (let i = 0; i < n; i++) {
      const s0 = x[i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1))) + w * s1 - s2;
      s2 = s1;
      s1 = s0;
    }
    return s1 * s1 + s2 * s2 - w * s1 * s2;
  }

  // A new note an octave (or a 12th, or two octaves) above one that's still ringing makes a mix that
  // repeats at the lower note's period, so YIN hears the old note. What gives it away is which
  // harmonics just got louder: only every m-th one means the new note is at m × f0. Returns m (1 = no shift).
  function harmonicShift(pre, post, f0, sr) {
    const H = Math.min(10, Math.floor(Math.min(sr / 2.2, 9000) / f0));
    if (H < 4) return 1;
    const a = [0];
    const b = [0];
    for (let k = 1; k <= H; k++) { a.push(toneEnergy(pre, k * f0, sr)); b.push(toneEnergy(post, k * f0, sr)); }
    const eps = b.reduce((x, y) => x + y, 0) * 2e-3 + 1e-12;
    // Each harmonic's gain counts equally (geometric mean), so one loud fundamental can't mask the rest.
    const logGain = [0];
    for (let k = 1; k <= H; k++) logGain.push(Math.log((b[k] + eps) / (a[k] + eps)));
    let best = 1;
    let bestScore = 0;
    for (const m of [4, 3, 2]) {
      if (2 * m > H) continue;
      let inSum = 0, inN = 0, outSum = 0, outN = 0;
      for (let k = 1; k <= H; k++) {
        if (k % m === 0) { inSum += logGain[k]; inN++; } else { outSum += logGain[k]; outN++; }
      }
      const gIn = Math.exp(inSum / inN);
      const gOut = Math.exp(outSum / outN);
      const score = gIn / gOut;
      if (gIn > 2.5 && gOut < 1.6 && score > 3 && score > bestScore) { best = m; bestScore = score; }
    }
    return best;
  }

  class Yin {
    constructor({ sampleRate, size, minFreq = 60, maxFreq = 1400, threshold = 0.15 }) {
      this.sr = sampleRate;
      this.tauMax = Math.min(Math.floor(size / 2), Math.ceil(sampleRate / minFreq));
      this.tauMin = Math.max(2, Math.floor(sampleRate / maxFreq));
      this.W = size - this.tauMax - 1; // integration window; leaves room for lag tauMax + 1
      this.threshold = threshold;
      this.d = new Float32Array(this.tauMax + 2);
    }

    // Returns { freq, cmnd } where cmnd (0..1+) is the aperiodicity: lower = clearer pitch.
    detect(x) {
      const { tauMax, tauMin, W, d } = this;
      for (let tau = 1; tau <= tauMax + 1; tau++) {
        let sum = 0;
        for (let j = 0; j < W; j++) {
          const v = x[j] - x[j + tau];
          sum += v * v;
        }
        d[tau] = sum;
      }
      // Cumulative mean normalized difference, in place.
      d[0] = 1;
      let running = 0;
      for (let tau = 1; tau <= tauMax + 1; tau++) {
        running += d[tau];
        d[tau] = running > 0 ? (d[tau] * tau) / running : 1;
      }
      // First dip under the threshold, walked down to its local minimum.
      let tau = -1;
      for (let t = tauMin; t <= tauMax; t++) {
        if (d[t] < this.threshold) {
          while (t + 1 <= tauMax && d[t + 1] < d[t]) t++;
          tau = t;
          break;
        }
      }
      if (tau < 0) {
        // Nothing under the threshold: report the global minimum; the caller judges it by cmnd.
        tau = tauMin;
        for (let t = tauMin + 1; t <= tauMax; t++) if (d[t] < d[tau]) tau = t;
      }
      const a = d[tau - 1];
      const b = d[tau];
      const c = d[tau + 1];
      const den = a - 2 * b + c;
      const shift = den > 0 ? Math.max(-0.5, Math.min(0.5, (0.5 * (a - c)) / den)) : 0;
      return { freq: this.sr / (tau + shift), cmnd: b };
    }
  }

  class NoteTracker {
    // frameSize: samples per frame at sampleRate. Frames are decimated to ~24 kHz before analysis.
    constructor({ sampleRate, frameSize, minFreq = 60, maxFreq = 1400 }) {
      this.decim = Math.max(1, Math.round(sampleRate / 24000));
      this.sr = sampleRate / this.decim;
      this.size = Math.floor(frameSize / this.decim);
      this.work = new Float32Array(this.size);
      this.minFreq = minFreq;
      this.maxFreq = maxFreq;
      this.yin = new Yin({ sampleRate: this.sr, size: this.size, minFreq, maxFreq });
      this.recentN = Math.min(this.size, Math.round(this.sr * 0.02)); // ~20 ms for loudness / attacks

      this.gate = dbToLin(-50); // below this RMS we treat the input as silence
      this.maxCmnd = 0.2; // YIN aperiodicity allowed for a note
      this.stableTime = 0.045; // s a pitch must hold (over at least 2 frames) before it counts
      this.legatoTime = 0.1; // s a new pitch must hold to count without a new pick attack
      this.onsetRatio = 1.6; // loudness jump that marks a possible pick attack
      this.confirmDelay = 0.08; // s after the jump to check it was a real attack, not a click
      this.confirmRatio = 1.15;
      this.a4 = 440;
      this.reset();
    }

    setGateDb(db) { this.gate = dbToLin(db); }
    get gateDb() { return linToDb(this.gate); }

    reset() {
      this.history = []; // { t, rms } for the last ~0.3 s
      this.cand = null; // { midi, n, t0 }
      this.lastEmit = null; // MIDI note of the last reported note, null after silence
      this.segment = new Set(); // pitches already reported since the last pick attack
      this.recent = []; // { midi, t } of reports in the last few seconds
      this.past = []; // { t, data, rms } recent analysis frames, to compare an attack against
      this.attackPre = null; // the frame from just before the latest attack, if something was ringing
      this.armed = false; // true after a confirmed attack: allows re-reporting the same pitch
      this.pending = null; // { t, pre, consumed } an attack waiting for confirmation
      this.lastOnsetT = -Infinity;
      this.quietSince = null;
      this.peak = 0;
    }

    process(frame, t) {
      const { decim, size, work } = this;
      // Decimate with a box filter (also a gentle low-pass).
      const offset = frame.length - size * decim;
      for (let i = 0; i < size; i++) {
        let s = 0;
        const base = offset + i * decim;
        for (let k = 0; k < decim; k++) s += frame[base + k];
        work[i] = s / decim;
      }
      let sq = 0;
      for (let i = size - this.recentN; i < size; i++) sq += work[i] * work[i];
      const rms = Math.sqrt(sq / this.recentN);
      const loud = rms >= this.gate;

      // Quietest level in the 12–60 ms before now: the baseline an attack must jump over.
      // If frames arrive slowly (a throttled tab), fall back to the previous frame.
      let prevMin = Infinity;
      for (const h of this.history) if (h.t <= t - 0.012 && h.t >= t - 0.06) prevMin = Math.min(prevMin, h.rms);
      if (prevMin === Infinity) prevMin = this.history.length ? this.history[this.history.length - 1].rms : 0;
      this.history.push({ t, rms });
      while (this.history.length && this.history[0].t < t - 0.3) this.history.shift();
      this.past.push({ t, data: work.slice(), rms });
      while (this.past.length > 2 && this.past[1].t <= t - 0.08) this.past.shift();

      // Attack detection, confirmed a little later so a metronome click over a ringing note doesn't count.
      const sinceOnset = t - this.lastOnsetT;
      if (loud && !this.pending && sinceOnset > 0.1 && (prevMin < this.gate || rms > this.onsetRatio * prevMin)) {
        this.pending = { t, pre: prevMin, consumed: false };
        this.lastOnsetT = t;
        // Keep the newest frame that ends before the attack (≥ 45 ms old), if a note was ringing then.
        let before = null;
        for (const f of this.past) if (f.t <= t - 0.045) before = f;
        this.attackPre = before && before.rms >= this.gate && this.lastEmit !== null ? before.data : null;
        this.attackPreMidi = this.lastEmit;
      }
      if (this.pending && t - this.pending.t >= this.confirmDelay) {
        if (rms >= this.gate && rms >= this.confirmRatio * this.pending.pre) {
          if (!this.pending.consumed) this.armed = true;
          this.peak = rms;
        }
        this.pending = null;
      }

      if (!loud) {
        if (this.quietSince === null) this.quietSince = t;
        if (t - this.quietSince > 0.1) {
          this.lastEmit = null;
          this.segment.clear();
          this.cand = null;
          this.peak = 0;
          this.armed = false;
        }
      } else {
        this.quietSince = null;
      }
      this.peak = Math.max(this.peak, rms);

      const info = { t, rms, db: linToDb(rms), loud, freq: null, midi: null, cents: null, cmnd: null, event: null };
      if (!loud) return info;

      const r = this.yin.detect(work);
      info.cmnd = r.cmnd;
      if (!(r.cmnd <= this.maxCmnd && r.freq >= this.minFreq && r.freq <= this.maxFreq)) {
        this.cand = null;
        return info;
      }
      let freq = r.freq;
      // Right after an attack over a ringing note, if YIN still hears the old note, check whether the
      // new note sits an octave (or a 12th, or two octaves) above it.
      if (this.attackPre && t - this.lastOnsetT < 0.5 && Math.round(69 + 12 * Math.log2(freq / this.a4)) === this.attackPreMidi) {
        const m = harmonicShift(this.attackPre, work, freq, this.sr);
        if (m > 1) freq *= m;
      }
      const mf = 69 + 12 * Math.log2(freq / this.a4);
      const midi = Math.round(mf);
      info.freq = freq;
      info.midi = midi;
      info.cents = (mf - midi) * 100;

      if (this.cand && this.cand.midi === midi) this.cand.n++;
      else this.cand = { midi, n: 1, t0: t };

      const held = t - this.cand.t0;
      if (this.cand.n >= 2 && held >= this.stableTime) {
        const attack = this.armed || this.pending !== null || this.lastEmit === null;
        const isNew = !this.segment.has(midi);
        let emit;
        if (this.armed || this.lastEmit === null) emit = true; // a confirmed new pick, or the first note after silence
        else if (this.pending) emit = isNew; // a pick in progress: a new pitch can't wait (same pitch waits for confirmation)
        else {
          // No new pick: a hammer-on or slide. It must hold a little longer and come while the note is
          // still strong; a pitch deep in the decay is usually the detector slipping an octave. A pitch
          // reported in the last few seconds is most likely another string still ringing.
          const ringing = this.recent.some((r) => r.midi === midi && t - r.t < 3);
          emit = isNew && !ringing && held >= this.legatoTime && rms >= 0.3 * this.peak;
        }
        if (emit) {
          const playedAt = t - this.lastOnsetT < 0.4 ? this.lastOnsetT : t - held;
          info.event = { midi, freq, cents: info.cents, t, playedAt };
          if (attack) this.segment.clear();
          this.segment.add(midi);
          this.attackPre = null; // this attack has its answer
          this.recent = this.recent.filter((r) => t - r.t < 3);
          this.recent.push({ midi, t });
          this.lastEmit = midi;
          this.armed = false;
          if (this.pending) this.pending.consumed = true;
        }
      }
      return info;
    }
  }

  // High-precision pitch for the precise tuner. x: a long stretch of raw (full-rate) input, ~170 ms;
  // f0: a rough estimate (the note tracker's). Instead of one period, it compares the signal with
  // itself k periods later (k as large as half the buffer allows), so a sub-sample error in the lag
  // is k times smaller in the frequency. Normalized cross-correlation, so a decaying note doesn't
  // bias it. Returns { freq, clarity } (clarity 0..1, the correlation at the peak) or null.
  // A high note fits many periods, so the lag is found in steps (k = 1, 4, 16, …): each step's
  // estimate is close enough that the next, longer lag can't land a whole period off.
  function refinePitch(x, sr, f0) {
    const kMax = Math.floor((x.length * 0.5) / (sr / f0));
    if (kMax < 1) return null;
    let res = null;
    let f = f0;
    let tol = 0.012; // ±20 cents of slack around the rough estimate
    for (let k = 1; ; k = Math.min(kMax, k * 4)) {
      res = ncclag(x, sr, f, k, tol);
      if (!res) return null;
      f = res.freq;
      tol = 0.002; // the next step starts from a few cents at most
      if (k === kMax) return res;
    }
  }

  function ncclag(x, sr, f0, k, tol) {
    const N = x.length;
    const P = sr / f0;
    const L = k * P;
    const r = Math.min(Math.ceil(L * tol) + 3, Math.floor(P * 0.4));
    const lo = Math.max(2, Math.floor(L - r));
    const hi = Math.ceil(L + r);
    const W = N - hi - 2;
    if (W < P) return null;
    let e0 = 0;
    for (let j = 0; j < W; j++) e0 += x[j] * x[j];
    if (e0 <= 0) return null;
    const ncc = new Float64Array(hi - lo + 3);
    // Energy of the shifted window, slid one sample at a time.
    let e1 = 0;
    for (let j = lo - 1; j < lo - 1 + W; j++) e1 += x[j] * x[j];
    for (let tau = lo - 1; tau <= hi + 1; tau++) {
      if (tau > lo - 1) e1 += x[tau + W - 1] * x[tau + W - 1] - x[tau - 1] * x[tau - 1];
      let c = 0;
      for (let j = 0; j < W; j++) c += x[j] * x[j + tau];
      ncc[tau - lo + 1] = e1 > 0 ? c / Math.sqrt(e0 * e1) : 0;
    }
    let best = lo;
    for (let tau = lo + 1; tau <= hi; tau++) if (ncc[tau - lo + 1] > ncc[best - lo + 1]) best = tau;
    const i = best - lo + 1;
    const a = ncc[i - 1];
    const b = ncc[i];
    const c = ncc[i + 1];
    if (!(b > a && b >= c)) return null; // peak at the edge of the search: the estimate was off
    const den = a - 2 * b + c;
    const shift = den < 0 ? Math.max(-0.5, Math.min(0.5, (0.5 * (a - c)) / den)) : 0;
    return { freq: (k * sr) / (best + shift), clarity: b };
  }

  // Steadies the precise tuner's readings: the median of the last ~0.3 s on the same note, and how
  // far they spread. A jump of more than ~60 cents is a new note and starts afresh, except when it's
  // the detector slipping, which happens as a note fades into the noise: a jump to a sub- or overtone
  // (×/÷ 2, 3, 4) with no new pick attack (attackT, the note tracker's latest), or any jump while the
  // sound is 10 dB or more under the note's peak (db). A new pluck is loud. Those readings are ignored.
  class TunerFilter {
    constructor({ a4 = 440, window = 0.3, minReadings = 4 } = {}) {
      this.a4 = a4;
      this.window = window;
      this.minReadings = minReadings;
      this.reset();
    }

    reset() { this.pts = []; this.midi = null; this.attackT = null; this.peakDb = -Infinity; }

    // Returns { midi, cents, freq, spread, stable } or null until there are enough readings.
    push(freq, t, attackT, db) {
      const mf = 69 + 12 * Math.log2(freq / this.a4);
      if (this.midi !== null && Math.abs(mf - this.midi) > 0.6) {
        // A jump to 2, 3 or 4 times the frequency, or a half, a third or a quarter of it.
        const d = Math.abs(mf - this.midi);
        const slip = [2, 3, 4].some((k) => Math.abs(d - 12 * Math.log2(k)) < 0.5);
        const noPick = attackT != null && this.attackT != null && attackT <= this.attackT;
        const fading = db != null && db < this.peakDb - 10;
        if ((slip && noPick) || fading) return null;
        this.pts = [];
        this.midi = null;
      }
      if (this.midi === null) { this.midi = Math.round(mf); this.attackT = attackT == null ? null : attackT; this.peakDb = -Infinity; }
      if (db != null) this.peakDb = Math.max(this.peakDb, db);
      this.pts.push({ t, c: (mf - this.midi) * 100 });
      while (this.pts.length && this.pts[0].t < t - this.window) this.pts.shift();
      // A note that settles into the neighbour: follow it.
      if (this.pts.length >= this.minReadings && this.pts.every((p) => Math.abs(p.c) > 50)) {
        const shift = Math.round(this.pts.reduce((s, p) => s + p.c, 0) / this.pts.length / 100);
        this.midi += shift;
        for (const p of this.pts) p.c -= shift * 100;
      }
      if (this.pts.length < this.minReadings) return null;
      const cs = this.pts.map((p) => p.c).sort((x, y) => x - y);
      const n = cs.length;
      const med = n % 2 ? cs[(n - 1) / 2] : (cs[n / 2 - 1] + cs[n / 2]) / 2;
      const spread = cs[Math.floor(n * 0.75)] - cs[Math.floor(n * 0.25)];
      const fr = this.a4 * 2 ** ((this.midi + med / 100 - 69) / 12);
      return { midi: this.midi, cents: med, freq: fr, spread, stable: spread < 1 };
    }
  }

  // Quiet mode (AudioEngine.setQuiet), for a guitar the mic barely hears: the pitch detectors get the
  // input band-passed (highpass, then two lowpasses: room hiss is broadband, the strings are not) and
  // boosted, accept a noisier pitch, read the precise tuner over a longer stretch, and Auto-set puts
  // the gate closer to the noise. The Tuner page steadies over tunerWindow and needs holdTime in tune
  // (a quiet note fades into the hiss sooner). NORMAL holds the usual values. test/quiet.test.js checks both.
  const NORMAL = { maxCmnd: 0.2, clarity: 0.85, tuneSecs: 0.17, gateMargin: 12 };
  const QUIET = { highpass: 70, lowpass: 1500, boostDb: 20, maxCmnd: 0.35, clarity: 0.6, tuneSecs: 0.34, gateMargin: 5, tunerWindow: 0.5, holdTime: 0.45 };

  const api = { Yin, NoteTracker, TunerFilter, harmonicShift, refinePitch, dbToLin, linToDb, NORMAL, QUIET };
  root.Pitch = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
