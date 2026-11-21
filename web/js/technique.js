// Electric-guitar technique, graded from the input's pitch and level frames (NoteTracker.process in
// js/pitch.js, about 100 a second). A clean signal from an audio interface works best; a mic works
// with headphones on.
//
// - Vibrato: each held note's pitch curve gives the width (cents, peak to peak), the speed (Hz), how
//   even the cycles are, and whether the pitch comes back down to the note between pushes.
// - Legato: hammer-ons and pull-offs, checked in order like a sequence, and how loud each legato note
//   is next to the picked note it comes from.
// - Palm mute vs open: each attack's decay, mutes against opens, slot by slot in a 1-bar pattern.
// - Stops: play two beats, then silence on beat 3. How late the sound stops, and what still rings.
//
// Every grader takes frame(info, rel, beatDur): info from the tracker, rel the frame's time in
// seconds from beat 1 of the first bar (latency taken off; negative during the count-in). It returns
// events: { kind: 'rep', result } after each judged repetition, and for legato the sequence events
// (hit, miss, wrong, pass). result: { score 0–1, clean, kind ok|warn|bad, tag, text, ...measures }.
(function (root) {
  'use strict';
  const dbOf = (rms) => 20 * Math.log10(Math.max(rms, 1e-9));
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const median = (a) => {
    if (!a.length) return null;
    const s = [...a].sort((x, y) => x - y);
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };
  const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  const cv = (a) => { const m = mean(a); return a.length > 1 && m ? Math.sqrt(mean(a.map((x) => (x - m) ** 2))) / Math.abs(m) : 0; };
  // 1 inside [lo, hi], falling to 0 over `soft` outside it.
  const inBand = (x, lo, hi, soft) => (x >= lo && x <= hi ? 1 : clamp01(1 - (x < lo ? lo - x : x - hi) / soft));
  const kindOf = (score) => (score >= 0.8 ? 'ok' : score >= 0.55 ? 'warn' : 'bad');

  class Reps {
    constructor(cleanNeeded = 3) { this.passes = []; this.cleanStreak = 0; this.cleanNeeded = cleanNeeded; }
    resetStreak() { this.cleanStreak = 0; }
    add(result) {
      this.passes.push(result);
      this.cleanStreak = result.clean ? this.cleanStreak + 1 : 0;
      return { kind: 'rep', result };
    }
    // 0–1 for the learner: the last four, or null before the first.
    score() {
      const r = this.passes.slice(-4);
      return r.length ? clamp01(mean(r.map((x) => x.score))) : null;
    }
  }

  // ---------- vibrato ----------
  const VIB = {
    narrow: { lo: 20, hi: 60, name: 'narrow', words: 'a quarter step' },
    wide: { lo: 70, hi: 160, name: 'wide', words: 'a half step' },
  };
  const RATE = { lo: 4.5, hi: 7.5 };
  const HYST = 6; // cents the curve must turn back by before a peak or trough counts

  // pts: [{ t, c }], the pitch in cents above the target. Returns null if too short, else
  // { width, rate, evenness, floor, cycles } (width: median peak-to-peak cents; floor: the median
  // trough, cents above the note).
  function analyzeVibrato(pts) {
    if (pts.length < 20) return null;
    const c = pts.map((p, i) => {
      let s = 0;
      let n = 0;
      for (let k = -1; k <= 1; k++) { const q = pts[i + k]; if (q) { s += q.c; n++; } }
      return s / n;
    });
    const ext = [];
    let mode = 0;
    let hi = 0;
    let lo = 0;
    for (let i = 1; i < c.length; i++) {
      if (c[i] > c[hi]) hi = i;
      if (c[i] < c[lo]) lo = i;
      if (mode !== 1 && c[hi] - c[i] >= HYST) { ext.push({ i: hi, max: true }); mode = 1; lo = i; hi = i; }
      else if (mode !== -1 && c[i] - c[lo] >= HYST) { ext.push({ i: lo, max: false }); mode = -1; hi = i; lo = i; }
    }
    const swings = [];
    for (let k = 1; k < ext.length; k++) swings.push(Math.abs(c[ext[k].i] - c[ext[k - 1].i]));
    const maxT = ext.filter((e) => e.max).map((e) => pts[e.i].t);
    const periods = [];
    for (let k = 1; k < maxT.length; k++) periods.push(maxT[k] - maxT[k - 1]);
    const troughs = ext.filter((e) => !e.max).map((e) => c[e.i]);
    if (periods.length < 2 || swings.length < 3) {
      const span = Math.max(...c) - Math.min(...c);
      return { width: span < HYST * 2 ? 0 : span, rate: 0, evenness: 0, floor: median(c), cycles: periods.length };
    }
    return {
      width: median(swings),
      rate: 1 / median(periods),
      evenness: clamp01(1 - (cv(swings) + cv(periods)) / 2),
      floor: median(troughs),
      cycles: periods.length,
    };
  }

  function judgeVibrato(a, want) {
    const W = VIB[want] || VIB.narrow;
    if (!a || a.width < 12 || a.cycles < 2) {
      return { score: 0.1, clean: false, kind: 'bad', tag: 'No vibrato', text: `Hold the note and rock it ${W.words} up and back, about 5–7 times a second.`, width: a ? a.width : 0, rate: 0 };
    }
    const w = inBand(a.width, W.lo, W.hi, W.lo);
    const r = inBand(a.rate, RATE.lo, RATE.hi, 2.5);
    const e = clamp01((a.evenness - 0.4) / 0.45);
    const back = inBand(a.floor, -25, 30, 40);
    const score = clamp01(0.35 * w + 0.3 * r + 0.25 * e + 0.1 * back);
    let tip = '';
    if (a.width < W.lo) tip = `Push further: aim for ${W.words} (${W.lo}–${W.hi}¢).`;
    else if (a.width > W.hi) tip = `Smaller: ${W.words} is ${W.lo}–${W.hi}¢.`;
    else if (a.rate < RATE.lo) tip = 'A little faster: 5–7 pushes a second.';
    else if (a.rate > RATE.hi) tip = 'Slower and wider, from the wrist, not a finger shake.';
    else if (a.evenness < 0.7) tip = 'Even it out: every push the same height and speed.';
    else if (a.floor > 30) tip = 'Come all the way back down to the note between pushes.';
    const text = `${Math.round(a.width)}¢ wide, ${a.rate.toFixed(1)} per second, ${Math.round(a.evenness * 100)}% even.${tip ? ` ${tip}` : ''}`;
    const clean = score >= 0.8 && w >= 0.7 && r >= 0.7;
    return { score, clean, kind: kindOf(score), tag: clean ? 'Even vibrato' : 'Vibrato', text, width: a.width, rate: a.rate, evenness: a.evenness, floor: a.floor };
  }

  class VibratoGrader extends Reps {
    constructor(ex) {
      super(3);
      this.ex = ex;
      this.notes = ex.notes;
      this.want = (ex.tech && ex.tech.width) || 'narrow';
      this.i = 0;
      this.hold = null;
    }
    frame(info) {
      const want = this.notes[this.i];
      const dev = info.loud && info.midi != null ? (info.midi + info.cents / 100 - want.midi) * 100 : null;
      if (dev != null && dev > -70 && dev < 260) {
        if (!this.hold) this.hold = { t0: info.t, pts: [], gap: 0 };
        this.hold.pts.push({ t: info.t, c: dev });
        this.hold.gap = 0;
        if (info.t - this.hold.t0 > 6) return this.end();
      } else if (this.hold && ++this.hold.gap >= 5) return this.end(); // 50 ms without the note
      return [];
    }
    end() {
      const h = this.hold;
      this.hold = null;
      const last = h.pts[h.pts.length - 1];
      if (!last || last.t - h.t0 < 0.9) return []; // too short to judge: a passing note, or a slip
      const a = analyzeVibrato(h.pts.filter((p) => p.t >= h.t0 + 0.15));
      const result = judgeVibrato(a, this.want);
      result.i = this.i;
      this.i = (this.i + 1) % this.notes.length;
      return [this.add(result)];
    }
    stats() {
      const last = this.passes[this.passes.length - 1];
      const W = VIB[this.want];
      return [
        ['Notes held', String(this.passes.length), ''],
        ['Width', last && last.width ? `${Math.round(last.width)}<small>¢ (${W.lo}–${W.hi})</small>` : '–', last ? (last.width >= W.lo && last.width <= W.hi ? 'good' : 'meh') : ''],
        ['Speed', last && last.rate ? `${last.rate.toFixed(1)}<small>/s</small>` : '–', last && last.rate ? (last.rate >= RATE.lo && last.rate <= RATE.hi ? 'good' : 'meh') : ''],
        ['Even', last && last.evenness != null ? `${Math.round(last.evenness * 100)}<small>%</small>` : '–', last && last.evenness != null ? (last.evenness >= 0.7 ? 'good' : 'meh') : ''],
      ];
    }
  }

  // ---------- legato ----------
  // Notes come from the frames: a new pitch held for 3 frames is a note, picked or not (the note
  // tracker's own events skip a pitch that rang a moment ago, which is what legato does all the time).
  class LegatoGrader {
    constructor(ex, { SeqGrader, strictOctave = true } = {}) {
      this.ex = ex;
      this.seq = new SeqGrader(ex, { strictOctave });
      this.reps = new Reps(3);
      this.cand = null;
      this.last = null; // { midi, t } of the last note
      this.quiet = 0;
      this.levels = new Array(ex.notes.length).fill(null);
      this.open = []; // notes still collecting their level
      this.pending = null; // a finished pass, waiting for its last note's level
      this.beatDur = 1;
    }
    get i() { return this.seq.i; }
    get passes() { return this.reps.passes; }
    get cleanStreak() { return this.reps.cleanStreak; }
    get cleanNeeded() { return this.reps.cleanNeeded; }
    resetStreak() { this.reps.resetStreak(); }
    score() { return this.reps.score(); }
    frame(info, rel, beatDur) {
      if (beatDur) this.beatDur = beatDur;
      const out = [];
      for (const o of this.open) { o.peak = Math.max(o.peak, info.rms); o.n++; }
      this.open = this.open.filter((o) => { if (o.n >= 5) { this.levels[o.i] = dbOf(o.peak); return false; } return true; });
      if (this.pending && !this.open.length) { out.push(this.finishPass(this.pending)); this.pending = null; }
      if (!info.loud || info.midi == null) {
        this.cand = null;
        if (++this.quiet > 10) this.last = null; // 100 ms of silence: the same pitch can count again
        return out;
      }
      this.quiet = 0;
      if (this.cand && this.cand.midi === info.midi) { this.cand.n++; this.cand.peak = Math.max(this.cand.peak, info.rms); }
      else this.cand = { midi: info.midi, n: 1, t0: info.t, rel0: rel, peak: info.rms };
      if (this.cand.n === 3 && (!this.last || this.last.midi !== this.cand.midi)) {
        this.last = { midi: this.cand.midi, t: this.cand.t0 };
        const unit = this.beatDur / (this.ex.npb || 4);
        const at = this.cand.rel0 - 0.02; // the pitch settles a little after the note starts
        const dev = this.ex.timing && at > -unit / 2 ? at - Math.round(at / unit) * unit : null;
        const evs = this.seq.note(this.cand.midi, dev);
        for (const e of evs) {
          if (e.kind === 'hit') this.open.push({ i: e.i, peak: this.cand.peak, n: 3 });
          if (e.kind === 'pass') this.pending = e.result;
          out.push(e);
        }
      }
      return out;
    }
    finishPass(r) {
      const notes = this.ex.notes;
      const drops = [];
      let head = null;
      notes.forEach((n, i) => {
        const L = this.levels[i];
        if (!n.legato) { head = L; return; }
        if (L != null && head != null) drops.push(L - head);
      });
      this.levels.fill(null);
      const drop = drops.length ? median(drops) : null;
      const even = drop == null ? 0.4 : inBand(drop, -4, 6, 10);
      const legatoMissed = notes.some((n, i) => n.legato && r.states[i] !== 'hit');
      const score = clamp01(r.acc * (0.5 + 0.5 * even) * (r.timing == null || r.timing <= 60 ? 1 : 0.85));
      const clean = r.clean && drop != null && drop >= -6;
      let tip = '';
      if (drop != null && drop < -6) tip = 'The hammer-ons and pull-offs are much quieter than the picked notes: hammer from higher, and pull off down and away, like a small pluck.';
      else if (legatoMissed) tip = 'Some legato notes didn’t come through: hammer harder, right behind the fret.';
      else if (r.timing != null && r.timing > 60) tip = 'Lock the legato notes to the click: they tend to rush.';
      const text = `${Math.round(r.acc * 100)}% of the notes${drop != null ? `, legato notes ${drop >= 0 ? '+' : ''}${drop.toFixed(0)} dB against the picked ones` : ''}${r.timing != null ? `, timing ±${Math.round(r.timing)} ms` : ''}.${tip ? ` ${tip}` : ''}`;
      return this.reps.add({ score, clean, kind: kindOf(score), tag: clean ? 'Smooth legato' : 'Pass', text, acc: r.acc, drop, timing: r.timing });
    }
    stats() {
      const last = this.passes[this.passes.length - 1];
      const p = this.seq.pass;
      return [
        ['Pass', `${p.hits}<small>/ ${this.seq.n}</small>`, ''],
        ['Notes', last ? `${Math.round(last.acc * 100)}<small>%</small>` : '–', last ? (last.acc >= 0.9 ? 'good' : 'meh') : ''],
        ['Legato level', last && last.drop != null ? `${last.drop >= 0 ? '+' : ''}${last.drop.toFixed(0)}<small> dB</small>` : '–', last && last.drop != null ? (last.drop >= -6 ? 'good' : 'bad') : ''],
        ['Clean in a row', `${this.cleanStreak}<small>/ ${this.cleanNeeded}</small>`, ''],
      ];
    }
  }

  // ---------- palm mute vs open, and stops ----------
  // Palm mute vs open: a 1-bar pattern of 8th notes, P (palm-muted) or O (open, let it ring).
  // Attacks come from the onset detector (js/onset.js, through onset()), which hears a re-picked
  // ringing string and a muted chug alike; the level frames give each attack's decay.
  class PalmGrader extends Reps {
    constructor(ex) {
      super(3);
      this.ex = ex;
      this.pattern = ex.tech.pattern;
      this.L = this.pattern.length;
      this.hist = []; // { t, db } for the last second
      this.meas = new Map(); // absolute slot → { t, peak, decay }
      this.cycle = 0;
      this.slot = 0.25;
      this.i = 0;
    }
    get after() { return Math.min(0.6 * this.slot, 0.18); } // when the decay is measured
    resync() { this.meas.clear(); this.cycle = 0; } // the clock restarted (a new tempo, or a resume)
    onset(o, rel, beatDur) {
      this.slot = beatDur / 2;
      const k = Math.round(rel / this.slot);
      if (k < 0 || Math.abs(rel - k * this.slot) > 0.35 * this.slot || this.meas.has(k)) return [];
      this.meas.set(k, { t: o.t, peak: null, decay: null });
      return [];
    }
    frame(info, rel, beatDur) {
      const out = [];
      this.slot = beatDur / 2;
      const db = dbOf(info.rms);
      this.hist.push({ t: info.t, db });
      while (this.hist.length && this.hist[0].t < info.t - 1) this.hist.shift();
      const after = this.after;
      // The rms window ends at the frame's time, so a level "at" time x shows in the frame ~10 ms later.
      for (const m of this.meas.values()) {
        if (m.decay != null || info.t < m.t + after + 0.01) continue;
        const near = this.hist.filter((h) => h.t >= m.t && h.t <= m.t + 0.05);
        if (!near.length) { m.decay = 0; continue; }
        m.peak = Math.max(...near.map((h) => h.db));
        const at = this.hist.reduce((b, h) => (Math.abs(h.t - (m.t + after + 0.01)) < Math.abs(b.t - (m.t + after + 0.01)) ? h : b));
        m.decay = at.db - m.peak;
      }
      const end = (this.cycle + 1) * this.L * this.slot + after + 0.08;
      if (rel >= end) {
        const r = this.judge(this.cycle, after);
        if (r) out.push(this.add(r));
        for (let j = 0; j < this.L; j++) this.meas.delete(this.cycle * this.L + j);
        this.cycle = Math.max(this.cycle + 1, Math.floor((rel - after - 0.08) / (this.L * this.slot)));
      }
      return out;
    }
    judge(cycle, after) {
      const P = [];
      const O = [];
      const got = [];
      for (let j = 0; j < this.L; j++) {
        const m = this.meas.get(cycle * this.L + j);
        if (!m || m.decay == null) continue;
        got.push({ j, d: m.decay });
        (this.pattern[j] === 'P' ? P : O).push(m.decay);
      }
      if (got.length < this.L / 2) return null; // not playing yet
      const hitRate = got.length / this.L;
      if (!P.length || !O.length) {
        return { score: 0.3 * hitRate, clean: false, kind: 'bad', tag: 'Pattern', text: `Heard ${got.length} of ${this.L} notes, but not both kinds: play the open notes too.`, hitRate, sep: null };
      }
      const mp = median(P);
      const mo = median(O);
      const sep = mo - mp;
      const thr = (mp + mo) / 2;
      const right = got.filter((g) => (this.pattern[g.j] === 'P') === (g.d < thr)).length;
      const score = clamp01(hitRate * (0.55 * clamp01((sep - 3) / 6) + 0.45 * (right / got.length)));
      const clean = hitRate >= 0.9 && sep >= 7 && right === got.length;
      let tip = '';
      if (sep < 5) tip = mp > -9 ? 'The mutes ring almost as long as the opens: rest the edge of your palm on the strings right at the bridge.' : 'The open notes die like the mutes: lift the palm all the way for them.';
      else if (right < got.length) tip = 'A note went the wrong way: say the pattern out loud while you play.';
      else if (hitRate < 0.9) tip = 'Some notes were missing: keep the picking hand moving in 8ths.';
      const text = `${Math.round(after * 1000)} ms after the pick, mutes are ${Math.round(-mp)} dB down and opens ${Math.round(-mo)} dB: ${Math.round(sep)} dB apart.${tip ? ` ${tip}` : ''}`;
      return { score, clean, kind: kindOf(score), tag: clean ? 'Tight' : 'Bar', text, hitRate, sep, mute: mp, open: mo, right, got: got.length };
    }
    stats() {
      const last = this.passes[this.passes.length - 1];
      return [
        ['Bars', String(this.passes.length), ''],
        ['Notes', last ? `${Math.round(last.hitRate * 100)}<small>%</small>` : '–', last ? (last.hitRate >= 0.9 ? 'good' : 'meh') : ''],
        ['Mute vs open', last && last.sep != null ? `${Math.round(last.sep)}<small> dB</small>` : '–', last && last.sep != null ? (last.sep >= 7 ? 'good' : last.sep >= 5 ? 'meh' : 'bad') : ''],
        ['Clean in a row', `${this.cleanStreak}<small>/ ${this.cleanNeeded}</small>`, ''],
      ];
    }
  }

  // Stops: play beats 1–2 (8th notes), then silence on beat 3 until the next bar.
  class StopGrader extends Reps {
    constructor(ex) {
      super(3);
      this.ex = ex;
      this.bar = 0;
      this.frames = [];
      this.i = 0;
    }
    resync() { this.bar = 0; this.frames = []; }
    frame(info, rel, beatDur) {
      const barDur = 4 * beatDur;
      if (rel < 0) return [];
      this.frames.push({ rel, db: dbOf(info.rms), pitched: info.loud && info.midi != null });
      if (rel < (this.bar + 1) * barDur) return [];
      const r = this.judge(this.bar * barDur, beatDur);
      this.bar = Math.floor(rel / barDur);
      this.frames = this.frames.filter((f) => f.rel >= this.bar * barDur);
      return r ? [this.add(r)] : [];
    }
    judge(t0, beat) {
      const F = this.frames.filter((f) => f.rel >= t0 && f.rel < t0 + 4 * beat);
      const play = F.filter((f) => f.rel < t0 + 2 * beat - 0.05);
      const loud = play.map((f) => f.db).sort((a, b) => b - a);
      if (loud.length < 5) return null;
      const level = median(loud.slice(0, Math.max(3, Math.ceil(loud.length / 2)))); // the playing level
      if (level < -55) return null; // nothing played this bar
      const stopAt = t0 + 2 * beat;
      const fall = F.find((f) => f.rel >= stopAt - 0.5 * beat && f.db <= level - 18);
      const lag = fall ? fall.rel - stopAt : beat; // seconds; negative = stopped early
      const rest = F.filter((f) => f.rel >= stopAt + 0.2 * beat && f.rel < t0 + 4 * beat - 0.1 * beat);
      const residual = rest.length ? Math.max(...rest.map((f) => f.db)) - level : 0;
      const ringing = rest.filter((f) => f.pitched && f.db > level - 30).length >= 5;
      const lagMs = lag * 1000;
      const lagS = inBand(Math.abs(lagMs), 0, 60, 120);
      const resS = inBand(residual, -200, -24, 14);
      const score = clamp01(0.5 * lagS + 0.5 * resS);
      const clean = Math.abs(lagMs) <= 60 && residual <= -24 && !ringing;
      let tip = '';
      if (ringing) tip = 'A string keeps ringing in the rest: lay the picking-hand palm across all the strings and lift the fretting finger off the fret, keeping it on the string.';
      else if (lagMs > 60) tip = 'The sound stops late: kill it right on beat 3.';
      else if (lagMs < -60) tip = 'You stopped early: let the last 8th note last until beat 3.';
      else if (residual > -24) tip = 'There’s noise in the rest: mute every string, not just the one you played.';
      const text = `${fall ? `Stopped ${Math.abs(Math.round(lagMs))} ms ${lagMs >= 0 ? 'after' : 'before'} beat 3` : 'Didn’t stop'}, rest ${Math.round(-residual)} dB below the playing.${tip ? ` ${tip}` : ''}`;
      return { score, clean, kind: kindOf(score), tag: clean ? 'Clean stop' : 'Stop', text, lag: lagMs, residual, ringing };
    }
    stats() {
      const last = this.passes[this.passes.length - 1];
      return [
        ['Bars', String(this.passes.length), ''],
        ['Stop', last ? `${last.lag >= 0 ? '+' : ''}${Math.round(last.lag)}<small> ms</small>` : '–', last ? (Math.abs(last.lag) <= 60 ? 'good' : 'meh') : ''],
        ['Rest', last ? `${Math.round(last.residual)}<small> dB</small>` : '–', last ? (last.residual <= -24 && !last.ringing ? 'good' : 'bad') : ''],
        ['Clean in a row', `${this.cleanStreak}<small>/ ${this.cleanNeeded}</small>`, ''],
      ];
    }
  }

  function grader(ex, opts = {}) {
    const k = ex.tech && ex.tech.kind;
    if (k === 'vibrato') return new VibratoGrader(ex);
    if (k === 'legato') return new LegatoGrader(ex, opts);
    if (k === 'palm') return new PalmGrader(ex);
    if (k === 'stop') return new StopGrader(ex);
    throw new Error(`No technique grader for ${k}`);
  }

  const api = { analyzeVibrato, judgeVibrato, VIB, RATE, VibratoGrader, LegatoGrader, PalmGrader, StopGrader, grader, dbOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Technique = api;
})(typeof window !== 'undefined' ? window : globalThis);
