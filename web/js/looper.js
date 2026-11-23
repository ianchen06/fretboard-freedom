// The Looper page's logic (no DOM, no audio graph): quantizing presses to the bar, drum grooves,
// what key the loops are in and what to solo with over them, and the WAV file for the mix.
//
// Sources:
// - Quantizing follows SooperLooper's sync (https://github.com/essej/sooperlooper,
//   doc/html/doc_sync.html): recording starts and stops on a cycle boundary (here: the bar in Tempo
//   mode, the first loop's length in Free mode), and a loop's length is always a whole number of
//   cycles. Overdub is never quantized, as in SooperLooper. One addition: a press up to GRACE
//   seconds after a boundary counts as on it (the input of the last few seconds is kept, so the
//   recording can start in the past). Guitarists' hands are busy; a press that lands a hair late
//   shouldn't cost a whole bar.
// - The key. The pitch-class profile (chroma) of the loops, as in Fujishima, "Realtime chord
//   recognition of musical sound" (ICMC 1999): each spectral peak between 60 Hz and 2 kHz adds its
//   magnitude to its pitch class. The key is the major or minor key whose Krumhansl–Kessler
//   profile correlates best with it: Krumhansl & Kessler, "Tracing the dynamic changes in perceived
//   tonal organization in a spatial representation of musical keys", Psychological Review 89
//   (1982), reprinted as Table 2.1 in Krumhansl, "Cognitive Foundations of Musical Pitch" (1990).
//   The algorithm is the Krumhansl–Schmuckler key-finding algorithm described there. The profile
//   values are the probe-tone ratings as music21 has them (music21/analysis/discrete.py,
//   KrumhanslSchmuckler, alias KrumhanslKessler); we checked them against that file, a secondary
//   source, not against the 1982 paper itself.
// - The scale suggestions are rules: minor pentatonic over a minor key and major pentatonic over a
//   major one (the first scales the Scales page teaches), plus the mode the loops' own notes point
//   to, read from the chroma (a major 6th in a minor key is Dorian, a ♭7 in a major key is
//   Mixolydian, and so on).
(function (root) {
  'use strict';
  const mod12 = (n) => ((n % 12) + 12) % 12;
  const GRACE = 0.15;
  const SIEVE = 0.3; // a peak the sieve takes for an overtone counts this much

  // ---------- quantizing ----------
  // Times in seconds on the AudioContext clock; origin t0, cycle c.
  const boundaryAtOrBefore = (t, t0, c) => t0 + Math.floor((t - t0) / c + 1e-9) * c;

  // Where a recording should start for a press at t: the boundary just gone if it's within the
  // grace, else the next one.
  function startAt(t, t0, c, grace = GRACE) {
    const b = boundaryAtOrBefore(t, t0, c);
    return t - b <= grace ? b : b + c;
  }

  // Where a recording that began at `from` should end for a press at t: at least one cycle long,
  // on a boundary; the boundary just gone if within the grace, else the next one.
  function endAt(t, from, c, grace = GRACE) {
    const n = Math.max(1, Math.floor((t - from) / c + 1e-9));
    const b = from + n * c;
    if (t >= b) return t - b <= grace ? b : b + c;
    return b;
  }

  // ---------- hands-free ----------
  // "Start when I play": a track waits, armed, and the first pick attack starts it. SooperLooper has
  // the same idea as its Record Threshold (doc/html/parameters.html: "the audio sample threshold to
  // begin recording after RECORD is triggered"; doc_commands.html: "the loop recording doesn't
  // start until the audio data is greater than the threshold"). It compares the raw input level;
  // we use the attack detector (js/onset.js) instead, so hum, hiss or a string still ringing can't
  // start it, only a new note. And SooperLooper starts on the crossing sample, with no pre-roll;
  // we keep the last seconds of input, so we start a hair before the attack. Where it starts,
  // for an attack heard at loop time tl (frames, latency already off):
  // - nothing running and no grid yet (the first loop): right at the attack, PREROLL before it, so
  //   the pick's own noise isn't cut. In Tempo mode the bar grid starts there too: the click and
  //   the drums come in with you, on your first note.
  // - a grid already (loops playing, or the click): on a bar line, by the same rule as a press
  //   (startAt): just after a bar line counts as on it, otherwise the next one.
  // Returns { from, t0 } where t0 is a new grid origin, or null to keep the grid.
  const PREROLL = 0.005;
  function autoStart(tl, { sr, grid, grace = GRACE }) {
    const pre = Math.round(PREROLL * sr);
    if (!grid) return { from: tl - pre, t0: tl - pre };
    return { from: startAt(tl, grid.t0, grid.cyc, grace * sr), t0: null };
  }

  // Chain mode: when a loop closes, the next empty track after it records. lens: each track's
  // length (0 = empty). Returns its index, or -1 when there's none left.
  function nextInChain(lens, i) {
    for (let j = i + 1; j < lens.length; j++) if (!lens[j]) return j;
    return -1;
  }

  // ---------- drums ----------
  // A groove is a function (beats per bar) → { spb (steps per beat), hits: [[step, kind, vol]] }.
  // kinds: kick, snare, hat, openHat, stick (the sounds of BandLib.renderDrums).
  function generic(beats, spb) {
    const hits = [];
    for (let b = 0; b < beats; b++) {
      hits.push([b * spb, 'hat', b === 0 ? 0.7 : 0.5]);
      if (spb >= 2) hits.push([b * spb + spb / 2, 'hat', 0.3]);
    }
    hits.push([0, 'kick', 1]);
    if (beats === 3) { hits.push([spb, 'stick', 0.6], [2 * spb, 'stick', 0.6]); return hits; }
    // the back beat: snare on every other beat, ending on the last beat for odd meters
    for (let b = 1; b < beats; b += 2) hits.push([b * spb, 'snare', 0.85]);
    if (beats % 2 === 1) hits.push([(beats - 1) * spb, 'snare', 0.7]);
    if (beats >= 4) hits.push([Math.floor(beats / 2) * spb, 'kick', 0.8]);
    return hits;
  }

  const GROOVES = {
    rock: {
      name: 'Rock',
      make(beats) {
        if (beats !== 4) return { spb: 2, hits: generic(beats, 2) };
        const hits = [];
        for (let s = 0; s < 8; s++) hits.push([s, 'hat', s % 2 ? 0.35 : 0.6]);
        hits.push([0, 'kick', 1], [4, 'kick', 0.85], [5, 'kick', 0.6], [2, 'snare', 0.9], [6, 'snare', 0.9]);
        return { spb: 2, hits };
      },
    },
    half: {
      name: 'Half-time',
      make(beats) {
        if (beats !== 4) return { spb: 2, hits: generic(beats, 2) };
        const hits = [];
        for (let s = 0; s < 8; s++) hits.push([s, 'hat', s % 2 ? 0.3 : 0.55]);
        hits.push([0, 'kick', 1], [7, 'kick', 0.5], [4, 'snare', 0.95]);
        return { spb: 2, hits };
      },
    },
    four: {
      name: 'Four on the floor',
      make(beats) {
        const hits = [];
        for (let b = 0; b < beats; b++) {
          hits.push([b * 2, 'kick', 1], [b * 2 + 1, 'openHat', 0.3]);
          if (b % 2 === 1) hits.push([b * 2, 'snare', 0.75]);
        }
        return { spb: 2, hits };
      },
    },
    funk: {
      name: 'Funk 16ths',
      make(beats) {
        if (beats !== 4) return { spb: 4, hits: generic(beats, 4) };
        const hits = [];
        for (let s = 0; s < 16; s++) hits.push([s, 'hat', s % 4 === 0 ? 0.55 : s % 2 ? 0.2 : 0.35]);
        hits.push([0, 'kick', 1], [3, 'kick', 0.55], [7, 'kick', 0.7], [10, 'kick', 0.85]);
        hits.push([4, 'snare', 0.9], [12, 'snare', 0.9], [9, 'snare', 0.15], [15, 'snare', 0.18]);
        return { spb: 4, hits };
      },
    },
    shuffle: {
      name: 'Shuffle',
      make(beats) {
        const hits = [];
        for (let b = 0; b < beats; b++) hits.push([b * 3, 'hat', 0.55], [b * 3 + 2, 'hat', 0.32]);
        hits.push([0, 'kick', 1]);
        for (let b = 1; b < beats; b += 2) hits.push([b * 3, 'snare', 0.85]);
        if (beats >= 4) hits.push([6, 'kick', 0.8]);
        return { spb: 3, hits };
      },
    },
    ballad: {
      name: 'Ballad (rim)',
      make(beats) {
        const hits = [];
        for (let b = 0; b < beats; b++) hits.push([b * 2, 'hat', 0.35]);
        hits.push([0, 'kick', 0.9]);
        if (beats === 4) hits.push([5, 'kick', 0.5], [2, 'stick', 0.7], [6, 'stick', 0.7]);
        else for (let b = 1; b < beats; b += 2) hits.push([b * 2, 'stick', 0.7]);
        return { spb: 2, hits };
      },
    },
  };

  // ---------- spectrum ----------
  function fft(re, im) { // in place, radix 2
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = (-2 * Math.PI) / len;
      const wr = Math.cos(ang);
      const wi = Math.sin(ang);
      for (let i = 0; i < n; i += len) {
        let cr = 1;
        let ci = 0;
        for (let k = 0; k < len / 2; k++) {
          const a = i + k;
          const b = a + len / 2;
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

  // The pitch-class profile of a signal: 12 numbers summing to 1 (index 0 = C), or null if silent.
  // Frames of ~170 ms (8192 samples at 48 kHz: 5.9 Hz per bin, enough to split the low E's
  // semitones), every ~85 ms. In each frame, the spectral peaks within 40 dB of the frame's loudest
  // add their magnitude to their nearest semitone, weighted by how close they are to it.
  function chroma(x, sr, { lo = 60, hi = 2000 } = {}) {
    let N = 1;
    while (N < sr * 0.17) N *= 2;
    const hop = N / 2;
    const out = new Float64Array(12);
    if (!x || x.length < N / 2) return null;
    const win = new Float64Array(N);
    for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N);
    const re = new Float64Array(N);
    const im = new Float64Array(N);
    const mag = new Float64Array(N / 2);
    const kLo = Math.max(2, Math.floor((lo * N) / sr));
    const kHi = Math.min(N / 2 - 2, Math.ceil((hi * N) / sr));
    let total = 0;
    for (let start = 0; start + N / 2 <= x.length; start += hop) {
      let energy = 0;
      for (let i = 0; i < N; i++) {
        const v = start + i < x.length ? x[start + i] : 0;
        re[i] = v * win[i];
        im[i] = 0;
        energy += v * v;
      }
      if (energy / N < 1e-8) continue; // silence (−80 dBFS)
      fft(re, im);
      let peak = 0;
      for (let k = kLo; k <= kHi; k++) { mag[k] = Math.hypot(re[k], im[k]); if (mag[k] > peak) peak = mag[k]; }
      const floor = peak * 0.01;
      const peaks = [];
      for (let k = kLo + 1; k < kHi; k++) {
        const m = mag[k];
        if (m < floor || m < mag[k - 1] || m < mag[k + 1]) continue;
        // the peak's true frequency, from a parabola through the three bins
        const a = mag[k - 1];
        const c = mag[k + 1];
        const d = a - 2 * m + c;
        const off = d ? (0.5 * (a - c)) / d : 0;
        peaks.push({ f: ((k + off) * sr) / N, m });
      }
      for (const p of peaks) {
        const midi = 69 + 12 * Math.log2(p.f / 440);
        const near = Math.round(midi);
        let w = Math.cos(Math.PI * (midi - near)) ** 2; // 1 on the semitone, 0 half-way
        // The harmonic sieve: a peak at 3, 5, 6 or 7 times a stronger peak below is most likely
        // that note's overtone (the 3rd harmonic of A is an E), not a note of its own. (Not 3/2:
        // that would also remove every chord's real 5th.)
        for (const q of peaks) {
          if (q.f >= p.f / 2.5) break;
          if (q.m < 0.5 * p.m) continue;
          const h = p.f / q.f;
          const hr = Math.round(h);
          if ((hr === 3 || hr === 5 || hr === 6 || hr === 7) && Math.abs(h - hr) < 0.025 * hr) { w *= SIEVE; break; }
        }
        out[mod12(near)] += p.m * w;
        total += p.m * w;
      }
    }
    if (!total) return null;
    return Array.from(out, (v) => v / total);
  }

  // ---------- key ----------
  const KK_MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
  const KK_MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

  function pearson(a, b) {
    const n = a.length;
    const ma = a.reduce((s, v) => s + v, 0) / n;
    const mb = b.reduce((s, v) => s + v, 0) / n;
    let num = 0;
    let da = 0;
    let db = 0;
    for (let i = 0; i < n; i++) { num += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
    return da && db ? num / Math.sqrt(da * db) : 0;
  }

  const relative = (a, b) => a.mode !== b.mode && b.tonic === mod12(a.tonic + (a.mode === 'major' ? 9 : 3));
  const profile = (k) => Array.from({ length: 12 }, (_, i) => (k.mode === 'major' ? KK_MAJOR : KK_MINOR)[mod12(i - k.tonic)]);

  // All 24 keys, best first: [{ tonic (pitch class), mode: 'major' | 'minor', r }].
  // bassPc: the loops' opening bass note (see bassNote), for our own tie-break (not part of
  // Krumhansl–Schmuckler): a relative major and minor (C major and A minor) have the same notes, so
  // the profile often can't tell them apart. When the two best are relatives within 0.15 and the
  // opening bass note is one of their tonics, that one wins: a loop usually starts at home.
  function findKey(pcp, bassPc = null) {
    if (!pcp) return [];
    const keys = [];
    for (let tonic = 0; tonic < 12; tonic++) {
      for (const mode of ['major', 'minor']) keys.push({ tonic, mode, r: pearson(pcp, profile({ tonic, mode })) });
    }
    keys.sort((a, b) => b.r - a.r);
    const [a, b] = keys;
    if (bassPc != null && relative(a, b) && a.r - b.r < 0.15 && b.tonic === bassPc) {
      keys[0] = b;
      keys[1] = a;
    }
    return keys;
  }

  // The bass note of a stretch of audio (pitch class), or null if there's no clear one. Subharmonic
  // summation (Hermes, "Measurement of pitch by subharmonic summation", JASA 83, 1988): every
  // candidate from C2 to F♯3 scores the spectrum at its first five harmonics, each 0.84× the one
  // before (Hermes' compression factor), and the best wins. A guitar's low E has a fundamental
  // 20–30 dB under its 2nd harmonic, so "the lowest peak" would often be the wrong note; summing
  // the harmonics finds it.
  function bassNote(x, sr) {
    let N = 1;
    while (N < sr * 0.34) N *= 2; // ~3 Hz bins: semitones apart at C2
    if (!x || x.length < N / 2) return null;
    const avg = new Float64Array(N / 2);
    const re = new Float64Array(N);
    const im = new Float64Array(N);
    let frames = 0;
    for (let start = 0; start + N / 2 <= x.length; start += N / 2) {
      for (let i = 0; i < N; i++) {
        const v = start + i < x.length ? x[start + i] : 0;
        re[i] = v * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N));
        im[i] = 0;
      }
      fft(re, im);
      for (let k = 0; k < N / 2; k++) avg[k] += Math.hypot(re[k], im[k]);
      frames++;
    }
    if (!frames) return null;
    const at = (f) => { // the largest magnitude within a quarter tone of f
      const lo = Math.floor((f * 2 ** (-1 / 24) * N) / sr);
      const hi = Math.ceil((f * 2 ** (1 / 24) * N) / sr);
      let m = 0;
      for (let k = Math.max(1, lo); k <= Math.min(N / 2 - 1, hi); k++) m = Math.max(m, avg[k]);
      return m;
    };
    let best = null;
    let second = 0;
    for (let m = 36; m <= 54; m++) {
      const f0 = 440 * 2 ** ((m - 69) / 12);
      let sc = 0;
      for (let h = 1; h <= 5; h++) sc += 0.84 ** (h - 1) * at(h * f0);
      if (!best || sc > best.sc) { if (best) second = Math.max(second, best.sc); best = { m, sc }; } else second = Math.max(second, sc);
    }
    if (!best || !best.sc || best.sc < 1.1 * second) return best && best.sc ? mod12(best.m) : null;
    return mod12(best.m);
  }

  // How sure: 'clear' | 'likely' | 'unclear', from the best correlation and its lead over the
  // next key that isn't its relative (C major and A minor share their notes, so they're often close).
  function confidence(keys) {
    if (!keys.length) return 'unclear';
    const [a] = keys;
    const b = keys.slice(1).find((k) => !relative(a, k));
    const lead = b ? a.r - b.r : a.r;
    if (a.r > 0.75 && lead > 0.08) return 'clear';
    if (a.r > 0.55) return 'likely';
    return 'unclear';
  }

  // What to solo with over a key, best first: scale ids of Scales.SCALES, each with why.
  function suggest(key, pcp) {
    if (!key) return [];
    const at = (iv) => (pcp ? pcp[mod12(key.tonic + iv)] : 0);
    const more = (a, b) => at(a) > 0.015 && at(a) > 1.4 * at(b);
    const out = [];
    if (key.mode === 'minor') {
      out.push({ id: 'minPent', why: 'Five notes, no wrong ones: the safe choice over a minor key.' });
      if (more(9, 8)) out.push({ id: 'dorian', why: 'Your loops have a major 6th: that’s the Dorian sound (Santana, “Oye Como Va”).' });
      else if (more(1, 2)) out.push({ id: 'phrygian', why: 'Your loops have a ♭2: dark and Spanish, the Phrygian sound.' });
      else if (more(11, 10)) out.push({ id: 'harmMinor', why: 'Your loops have a major 7th (a major V chord): harmonic minor.' });
      else out.push({ id: 'aeolian', why: 'The full natural minor scale, for melodies.' });
      out.push({ id: 'blues', why: 'Minor pentatonic plus the ♭5: grit on the way between 4 and 5.' });
    } else {
      out.push({ id: 'majPent', why: 'Five notes, no wrong ones: bright and open over a major key.' });
      if (more(10, 11)) {
        out.push({ id: 'mixolydian', why: 'Your loops have a ♭7: rock and blues-rock’s major mode.' });
        out.push({ id: 'minPent', why: 'Over a ♭7 groove, the minor pentatonic’s ♭3 rubs the right way: the blues trick.' });
      } else if (more(6, 5)) {
        out.push({ id: 'lydian', why: 'Your loops have a ♯4: dreamy, floating Lydian.' });
      } else {
        out.push({ id: 'ionian', why: 'The full major scale, for melodies.' });
      }
    }
    return out;
  }

  // ---------- export ----------
  const gcd = (a, b) => { while (b) [a, b] = [b, a % b]; return a; };

  // How many frames the mix needs to come round to where it started: the least common multiple of
  // the loops' lengths as they play (len / rate), capped (polymeter can make it very long).
  function mixLength(loops, cap) {
    let l = 1;
    for (const { len, rate = 1 } of loops) {
      const d = Math.round(len / rate);
      if (!d) continue;
      l = (l / gcd(l, d)) * d;
      if (l > cap) return Math.max(...loops.map((p) => Math.round(p.len / (p.rate || 1))));
    }
    return l === 1 ? 0 : l;
  }

  // 16-bit PCM WAV of one or two channels.
  function encodeWav(channels, sr) {
    const nc = channels.length;
    const n = channels[0].length;
    const buf = new ArrayBuffer(44 + n * nc * 2);
    const v = new DataView(buf);
    const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); v.setUint32(4, 36 + n * nc * 2, true); str(8, 'WAVE');
    str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, nc, true);
    v.setUint32(24, sr, true); v.setUint32(28, sr * nc * 2, true); v.setUint16(32, nc * 2, true); v.setUint16(34, 16, true);
    str(36, 'data'); v.setUint32(40, n * nc * 2, true);
    let o = 44;
    for (let i = 0; i < n; i++) {
      for (let c = 0; c < nc; c++) {
        const s = Math.max(-1, Math.min(1, channels[c][i]));
        v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
        o += 2;
      }
    }
    return buf;
  }

  const api = { GRACE, PREROLL, boundaryAtOrBefore, startAt, endAt, autoStart, nextInChain, GROOVES, fft, chroma, KK_MAJOR, KK_MINOR, findKey, bassNote, confidence, suggest, mixLength, encodeWav };
  root.Looper = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
