// The "Find any note" drill: builds the targets, judges each note heard, keeps time, and keeps per-note speed stats.
// No DOM in here; the UI listens through callbacks.
(function (root) {
  'use strict';
  const T = root.Theory;

  // Metronome stages from the deck (Part 3, "Drill: one note everywhere").
  const PACES = {
    free: { id: 'free', label: 'Free', short: 'No clock', bpm: null, clicks: null },
    s1: { id: 's1', label: 'Stage 1', short: '40 bpm · 4 clicks', bpm: 40, clicks: 4 },
    s2: { id: 's2', label: 'Stage 2', short: '60 bpm · 2 clicks', bpm: 60, clicks: 2 },
    s3: { id: 's3', label: 'Stage 3', short: '60 bpm · 1 click', bpm: 60, clicks: 1 },
    s4: { id: 's4', label: 'Stage 4', short: '80 bpm · 1 click', bpm: 80, clicks: 1 },
  };
  const PACE_ORDER = ['free', 's1', 's2', 's3', 's4'];
  const GOAL_MS = 2000; // the Part 3 checkpoint: any note on any string in under 2 seconds
  const MISS_MS = 6000; // how a miss counts toward a note's average
  const GRACE = 0.25; // s after a window closes in which a note played on the click still counts

  const tone = (ms) => (ms == null ? null : ms < GOAL_MS ? 'fast' : ms < 3500 ? 'ok' : 'slow');

  // Per string-and-note speed, kept as a moving average so recent rounds count most.
  class NoteStats {
    constructor(data) { this.data = data || {}; }
    key(tuning, s, pc) { return `${tuning}|${s}|${pc}`; }
    get(tuning, s, pc) { return this.data[this.key(tuning, s, pc)] || null; }
    record(tuning, s, pc, ms) {
      const k = this.key(tuning, s, pc);
      const e = this.data[k] || { n: 0, hits: 0, ema: null };
      const v = ms == null ? MISS_MS : Math.min(ms, MISS_MS);
      e.n++;
      if (ms != null) e.hits++;
      e.ema = e.ema == null ? v : Math.round(e.ema * 0.65 + v * 0.35);
      e.last = Date.now();
      this.data[k] = e;
    }
    // Flash-card weighting: unseen and slow notes come up more often.
    weight(tuning, s, pc) {
      const e = this.get(tuning, s, pc);
      if (!e) return 2.5;
      return Math.min(4, Math.max(0.35, e.ema / GOAL_MS));
    }
  }

  function makeTarget(s, pc, names, cfg, tuning) {
    const frets = T.fretsFor(s, pc, tuning, cfg.from, cfg.to);
    return {
      s, pc, names, frets,
      midis: frets.map((f) => T.midiAt(s, f, tuning)),
      status: 'pending', ms: null, slips: 0, hint: 0, fret: null, shownAt: null, windowEnd: null,
    };
  }

  function weightedPick(items, weightOf) {
    const total = items.reduce((a, it) => a + weightOf(it), 0);
    let r = Math.random() * total;
    for (const it of items) { r -= weightOf(it); if (r <= 0) return it; }
    return items[items.length - 1];
  }

  function buildTargets(cfg, stats) {
    const tuning = T.TUNINGS[cfg.tuning];
    if (cfg.mode === 'everywhere') {
      const up = [6, 5, 4, 3, 2, 1];
      const seq = cfg.direction === 'up' ? up : up.concat([...up].reverse());
      return seq.map((s) => makeTarget(s, cfg.pc, cfg.names, cfg, tuning)).filter((t) => t.frets.length);
    }
    const pcs = cfg.notes === 'all' ? [...Array(12).keys()] : T.NATURAL_PCS;
    const pool = [];
    for (const s of cfg.strings) for (const pc of pcs) if (T.fretsFor(s, pc, tuning, cfg.from, cfg.to).length) pool.push({ s, pc });
    if (!pool.length) return [];
    const out = [];
    let prev = null;
    for (let i = 0; i < cfg.count; i++) {
      // Avoid the same string or the same note twice in a row when the pool allows it.
      let options = pool.filter((p) => !prev || (p.s !== prev.s && p.pc !== prev.pc));
      if (!options.length) options = pool.filter((p) => !prev || p.s !== prev.s || p.pc !== prev.pc);
      if (!options.length) options = pool;
      const w = cfg.weakSpots ? (p) => stats.weight(cfg.tuning, p.s, p.pc) : () => 1;
      const pick = weightedPick(options, w);
      out.push(makeTarget(pick.s, pick.pc, T.spellings(pick.pc, Math.random() < 0.5), cfg, tuning));
      prev = pick;
    }
    return out;
  }

  class Drill {
    // cfg: { mode, pc, names, direction, notes, strings, count, pace, from, to, tuning, strictOctave, autoHint, weakSpots }
    // on: { target, hit, wrong, miss, hint, done } callbacks
    constructor(cfg, stats, on) {
      this.cfg = cfg;
      this.tuning = T.TUNINGS[cfg.tuning];
      this.pace = PACES[cfg.pace];
      this.window = this.pace.bpm ? (60 / this.pace.bpm) * this.pace.clicks : null;
      this.targets = buildTargets(cfg, stats);
      this.on = on;
      this.idx = -1;
      this.state = 'ready';
      this.closing = null; // a target whose window has closed but is still inside its grace period
    }

    get current() { return this.idx >= 0 ? this.targets[this.idx] || null : null; }

    // The first target appears at t0 (after a count-in).
    begin(t0) {
      this.t0 = t0;
      this.state = 'countin';
    }

    activate(i, t) {
      this.idx = i;
      const tg = this.targets[i];
      tg.status = 'active';
      tg.shownAt = t;
      tg.windowEnd = this.window ? t + this.window : null;
      this.on.target(tg, i);
    }

    tick(now) {
      if (this.state === 'countin' && now >= this.t0) {
        this.state = 'running';
        this.activate(0, this.t0);
      }
      if (this.state !== 'running') return;
      if (this.closing && now > this.closing.windowEnd + GRACE) {
        this.miss(this.closing);
        this.closing = null;
      }
      const cur = this.current;
      if (this.window && cur && now >= cur.windowEnd) {
        if (cur.status === 'active') this.closing = cur;
        if (this.idx + 1 < this.targets.length) this.activate(this.idx + 1, cur.windowEnd);
        else this.idx = this.targets.length;
      } else if (!this.window && cur && this.cfg.autoHint && cur.hint === 0 && now - cur.shownAt > 5) {
        this.hint();
      }
      if (this.idx >= this.targets.length && !this.closing) this.finish(false);
    }

    // How a heard note relates to a target. ev may carry `s` (on-screen clicks know the string).
    judge(tg, ev) {
      const midi = ev.midi;
      const open = this.tuning.open[tg.s];
      if (ev.s && ev.s !== tg.s) return { ok: false, reason: 'string' };
      if (T.mod12(midi) !== tg.pc) {
        // Assume they're on the target string: how far off were they?
        const f = midi - open;
        if (f >= this.cfg.from && f <= this.cfg.to) {
          const near = tg.frets.reduce((a, b) => (Math.abs(b - f) < Math.abs(a - f) ? b : a));
          return { ok: false, reason: 'note', fret: f, off: f - near };
        }
        return { ok: false, reason: 'note' };
      }
      const exact = tg.midis.indexOf(midi);
      if (exact >= 0) return { ok: true, fret: tg.frets[exact] };
      if (!this.cfg.strictOctave) return { ok: true, fret: tg.frets[0] };
      return { ok: false, reason: 'octave' };
    }

    hear(ev, now) {
      if (this.state !== 'running') return;
      const p = ev.playedAt ?? now;
      const c = this.closing;
      if (c && p <= c.windowEnd + 0.05) {
        const j = this.judge(c, ev);
        if (j.ok) {
          this.closing = null;
          this.hit(c, j, p);
          return;
        }
      }
      const cur = this.current;
      if (!cur || cur.status !== 'active') return;
      const j = this.judge(cur, ev);
      if (j.ok) {
        this.hit(cur, j, p);
        if (!this.window) {
          if (this.idx + 1 < this.targets.length) this.activate(this.idx + 1, now);
          else { this.idx = this.targets.length; this.finish(false); }
        }
      } else {
        cur.slips++;
        this.on.wrong(cur, ev, j);
      }
    }

    hit(tg, j, p) {
      tg.status = 'hit';
      tg.fret = j.fret;
      tg.ms = Math.max(0, Math.round((p - tg.shownAt) * 1000));
      this.on.hit(tg);
    }

    miss(tg) {
      tg.status = 'miss';
      this.on.miss(tg);
    }

    hint() {
      const cur = this.current;
      if (this.state !== 'running' || !cur || cur.status !== 'active' || cur.hint >= 2) return;
      cur.hint++;
      this.on.hint(cur, cur.hint);
    }

    skip(now) {
      const cur = this.current;
      if (this.window || this.state !== 'running' || !cur || cur.status !== 'active') return;
      cur.status = 'skip';
      this.on.miss(cur);
      if (this.idx + 1 < this.targets.length) this.activate(this.idx + 1, now);
      else { this.idx = this.targets.length; this.finish(false); }
    }

    stop() {
      if (this.state === 'done') return;
      this.finish(true);
    }

    finish(aborted) {
      if (this.state === 'done') return;
      this.state = 'done';
      this.on.done(this.summary(aborted));
    }

    summary(aborted) {
      const ts = this.targets;
      const played = ts.filter((t) => ['hit', 'miss', 'skip'].includes(t.status));
      const hits = ts.filter((t) => t.status === 'hit');
      const avg = (arr) => (arr.length ? Math.round(arr.reduce((a, t) => a + t.ms, 0) / arr.length) : null);
      const byString = {};
      for (const t of hits) (byString[t.s] = byString[t.s] || []).push(t);
      let slowest = null;
      for (const [s, arr] of Object.entries(byString)) {
        const a = avg(arr);
        if (!slowest || a > slowest.ms) slowest = { s: Number(s), ms: a };
      }
      const hints = ts.reduce((a, t) => a + (t.hint ? 1 : 0), 0);
      return {
        aborted,
        total: ts.length,
        played: played.length,
        hits: hits.length,
        misses: played.filter((t) => t.status !== 'hit'),
        avgMs: avg(hits),
        bestMs: hits.length ? Math.min(...hits.map((t) => t.ms)) : null,
        underGoal: hits.filter((t) => t.ms < GOAL_MS).length,
        slips: ts.reduce((a, t) => a + t.slips, 0),
        hints,
        slowest: Object.keys(byString).length > 1 ? slowest : null,
        clean: !aborted && hits.length === ts.length && hints === 0,
      };
    }
  }

  root.DrillLib = { Drill, NoteStats, PACES, PACE_ORDER, GOAL_MS, tone };
})(window);
