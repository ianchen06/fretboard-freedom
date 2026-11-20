// Shared by the Rhythm page and the daily session: the lane (a pattern, with your hits on it), the
// strip of recent hits, and a Run: count-in, click or drums, the timing grader fed by the onset
// detector, passes, and the tempo ladder.
(function (root) {
  'use strict';
  const R = root.Rhythm;
  const SVGNS = 'http://www.w3.org/2000/svg';
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  // SVGs are drawn at their real pixel width, so text stays at its CSS size.
  const widthOf = (svg, min, max) => clamp(Math.round(svg.getBoundingClientRect().width) || max, min, max);
  const el = (tag, attrs, parent, text) => {
    const n = document.createElementNS(SVGNS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (text != null) n.textContent = text;
    if (parent) parent.appendChild(n);
    return n;
  };
  const GLYPH = { D: '↓', U: '↑', d: '↓', u: '↑', X: '✕', P: '⊓', p: 'V', C: '◆', o: '•', '.': '·', '-': '–' };
  const EXTRA_WHERE = { ghost: 'on a ghost stroke', rest: 'in a rest', tie: 'where the chord rings', double: 'a strum counted twice', stray: 'off the grid' };
  const biasText = (v) => (Math.abs(v) < 1 ? 'on the beat' : `${Math.round(Math.abs(v))} ms ${v < 0 ? 'early' : 'late'}`);

  // ---------- the lane ----------
  const PADX = 34;
  const ROWH = 92;
  const MARK_Y = 55;

  class Lane {
    constructor(svg) { this.svg = svg; this.pattern = null; this.W = 1000; this.marks = null; this.head = null; }
    x(pos) { return PADX + (pos / this.pattern.meter) * (this.W - 2 * PADX); }

    draw(pattern) {
      const p = pattern;
      const svg = this.svg;
      this.pattern = p;
      const n = p.bars.length;
      this.W = widthOf(svg, 420, 1400);
      svg.setAttribute('viewBox', `0 0 ${this.W} ${n * ROWH}`);
      svg.innerHTML = '';
      for (let r = 0; r < n; r++) {
        const g = el('g', { class: 'row', 'data-row': r, transform: `translate(0 ${r * ROWH})` }, svg);
        el('rect', { class: 'row-bg', x: PADX - 22, y: 0, width: this.W - 2 * PADX + 44, height: ROWH - 6, rx: 10 }, g);
        for (let b = 0; b <= p.meter; b++) el('line', { class: `beat-line${b === 0 || b === p.meter ? ' bar' : ''}`, x1: this.x(b), x2: this.x(b), y1: 6, y2: ROWH - 12 }, g);
        const steps = R.barSteps(p, r);
        if (steps.some((s) => s.kind === 'pm')) el('text', { class: 'pm-label', x: this.W - PADX - 4, y: 13, 'text-anchor': 'end' }, g, 'P.M.');
        for (const s of steps) {
          const x = this.x(s.pos);
          el('line', { class: `tgt${s.hit ? ' hit' : ''}`, x1: x, x2: x, y1: 43, y2: 67 }, g);
          el('text', { class: `glyph ${s.kind}${s.acc ? ' acc' : ''}`, x, y: 29 }, g, GLYPH[s.sym]);
          if (s.acc) el('text', { class: 'accent', x, y: 12 }, g, '>');
          el('text', { class: `count${s.sub === 0 ? ' beat' : ''}`, x, y: ROWH - 16 }, g, s.count);
        }
      }
      this.marks = el('g', { class: 'marks' }, svg);
      this.head = el('line', { class: 'playhead', x1: 0, x2: 0, y1: 4, y2: ROWH - 10 }, svg);
    }

    // A hit, an extra or a miss. Dots sit 3× further from their line than real time, capped just
    // short of the next step.
    mark(step, off, cls) {
      if (!this.marks || !this.pattern) return;
      const row = step.bar % this.pattern.bars.length;
      let x = this.x(step.pos);
      if (off != null) {
        const pxPerBeat = (this.W - 2 * PADX) / this.pattern.meter;
        const cap = (0.48 * pxPerBeat) / step.grid;
        x += clamp(off * (step.bpm / 60) * pxPerBeat * 3, -cap, cap);
      }
      const y = row * ROWH + MARK_Y;
      const node = cls === 'extra'
        ? el('path', { class: 'mk extra pop', d: `M${x - 5} ${y - 5}L${x + 5} ${y + 5}M${x + 5} ${y - 5}L${x - 5} ${y + 5}` }, this.marks)
        : el('circle', { class: `mk ${cls} pop`, cx: x, cy: y, r: cls === 'miss' ? 7 : 6.5 }, this.marks);
      node.dataset.bar = step.bar;
      node.dataset.row = row;
    }

    // When a row starts again, its old dots fade; older ones go.
    age(row, bar) {
      if (!this.marks) return;
      const n = this.pattern.bars.length;
      for (const m of [...this.marks.children]) {
        if (Number(m.dataset.row) !== row) continue;
        const b = Number(m.dataset.bar);
        if (b < bar - n) m.remove();
        else if (b < bar) m.classList.add('old');
      }
      this.svg.querySelectorAll('.row').forEach((g) => g.classList.toggle('now', Number(g.dataset.row) === row));
    }

    running(on) { this.svg.classList.toggle('running', on); }
    playhead(row, pos) { if (this.head) this.head.setAttribute('transform', `translate(${this.x(Math.min(pos, this.pattern.meter))} ${row * ROWH})`); }
    clear() { if (this.marks) this.marks.innerHTML = ''; }
    idle() { this.running(false); this.svg.querySelectorAll('.row').forEach((g) => g.classList.remove('now')); }
  }

  // ---------- the strip of recent hits (offsets in ms) ----------
  function drawStrip(svg, recent) {
    const W = widthOf(svg, 240, 900);
    svg.setAttribute('viewBox', `0 0 ${W} 54`);
    const mid = W / 2;
    const X = (ms) => mid + (clamp(ms, -60, 60) / 60) * (mid - 8);
    let h = `<rect class="zone" x="${X(-15)}" y="12" width="${X(15) - X(-15)}" height="28" rx="4"/>`
      + `<line class="axis" x1="8" x2="${W - 8}" y1="26" y2="26"/><line class="zero" x1="${mid}" x2="${mid}" y1="8" y2="44"/>`
      + `<text class="lbl" x="8" y="52">60 ms early</text><text class="lbl mid" x="${mid}" y="52">on the beat</text><text class="lbl end" x="${W - 8}" y="52">60 ms late</text>`;
    recent.forEach((ms, i) => {
      h += `<line class="tick ${R.feel(ms / 1000).cls}" x1="${X(ms)}" x2="${X(ms)}" y1="15" y2="37" opacity="${(0.2 + 0.8 * ((i + 1) / recent.length)).toFixed(2)}"/>`;
    });
    if (recent.length >= 4) h += `<path class="avg" d="M${X(R.mean(recent))} 40l-5 7h10z"/>`;
    svg.innerHTML = h;
  }

  // ---------- a run ----------
  // opts:
  //   engine (AudioEngine, with init() done and enableOnsets() on), band (a Band, only for drums),
  //   pattern, bpm, click ({ mode, on, off }), sound ('click' | 'drums'),
  //   latency (() => seconds to take off each attack), lane (a Lane, optional),
  //   ladder (() => whether the tempo ladder may move the tempo),
  //   on: { state(s), hit(res), extra(res), miss(step), pass(info), leak(), beat(k, { countIn, quiet }) }.
  class Run {
    constructor(opts) {
      Object.assign(this, { band: null, click: { mode: 'all' }, sound: 'click', lane: null, ladder: () => false, on: {} }, opts);
      this.p = opts.pattern;
      this.startBpm = this.bpm;
      this.state = 'idle';
    }
    emit(name, ...args) { if (this.on[name]) this.on[name](...args); }
    heardNow() { const c = this.engine.ctx; return c.currentTime - (c.outputLatency || c.baseLatency || 0); }

    start() {
      const engine = this.engine;
      const ctx = engine.ctx;
      const p = this.p;
      this.cycle = this.click.mode === 'gap' ? this.click.on + this.click.off : 1;
      this.passBars = Math.max(2, (p.bars.length * this.cycle) / gcd(p.bars.length, this.cycle));
      this.grader = new R.Grader();
      this.tempo = new R.Ladder({ need: this.passBars >= 4 ? 1 : 2 });
      Object.assign(this, { passCount: 0, cleanCount: 0, bestClean: 0, bars: [], quiet: [], lastBar: -1, preRaw: [], countIn: [], leakWarned: false });
      // This run's own buses, so stopping silences what's already scheduled.
      this.out = ctx.createGain();
      this.out.connect(engine.out);
      if (this.band) { this.drums = ctx.createGain(); this.drums.connect(this.band.drumBus); }
      const beat = 60 / this.bpm;
      const t0 = ctx.currentTime + 0.25;
      const countBeats = p.meter < 3 ? p.meter * 2 : p.meter; // at least four clicks to take the tempo from
      this.countBeats = countBeats;
      this.countStart = t0;
      this.countBeat = beat;
      this.firstBar = t0 + countBeats * beat;
      this.nextBar = 0;
      this.nextStart = this.firstBar;
      for (let b = 0; b < countBeats; b++) {
        const t = t0 + b * beat;
        this.countIn.push(t);
        if (this.sound === 'drums' && this.band) this.band.play(this.band.drums.stick, this.drums, t, { vol: b % p.meter === 0 ? 1 : 0.7 });
        else engine.click(t, b % p.meter === 0, this.out);
      }
      if (this.lane) { this.lane.clear(); this.lane.running(true); }
      this.off = engine.on('onset', (o) => this.onset(o));
      this.setState('countin');
      this.timer = setInterval(() => this.tick(), 25);
      this.tick();
      const loop = () => { if (this.state === 'countin' || this.state === 'run') { this.frame(); requestAnimationFrame(loop); } };
      requestAnimationFrame(loop);
    }

    setState(s) { this.state = s; this.emit('state', s); }
    setBpm(bpm) { this.bpm = clamp(Math.round(bpm), 30, 260); }

    scheduleBar() {
      const b = this.nextBar++;
      const p = this.p;
      const beat = 60 / this.bpm;
      const start = this.nextStart;
      const end = start + p.meter * beat;
      const on = R.clickOn(this.click, b);
      const gapBlock = on ? null : Math.floor(b / this.cycle);
      this.grader.addSteps(R.barSteps(p, b).map((s) => ({ ...s, t: start + s.pos * beat, bar: b, pass: Math.floor(b / this.passBars), clickOn: on, gapBlock, bpm: this.bpm })));
      const swing = p.swing || 0.5;
      if (this.sound === 'drums' && this.band) {
        const grid = p.bars[b % p.bars.length].grid;
        for (const d of R.drumBar(this.click, p.meter, b, swing, grid)) this.band.play(this.band.drums[d.drum], this.drums, start + d.pos * beat, { vol: d.vol });
      } else {
        for (const c of R.clickBar(this.click, p.meter, b, swing)) this.engine.click(start + c.pos * beat, c.accent, this.out);
      }
      if (!on) {
        const q = this.quiet[this.quiet.length - 1];
        if (q && Math.abs(q[1] - start) < 1e-6) q[1] = end; else this.quiet.push([start, end]);
      }
      this.bars.push({ b, start, end, beat, on, row: b % p.bars.length });
      if (this.bars.length > 32) this.bars.shift();
      this.nextStart = end;
    }

    // The count-in is over once its last click has been heard. (Checked from the timer too:
    // animation frames stop while the tab is hidden.)
    countInDone() {
      if (this.state === 'countin' && this.heardNow() >= this.firstBar - 0.005) this.setState('run');
    }

    tick() {
      if (this.state !== 'countin' && this.state !== 'run') return;
      this.countInDone();
      const ctx = this.engine.ctx;
      while (this.nextStart < ctx.currentTime + 0.3) this.scheduleBar();
      // Attacks arrive about 35 ms after they happen (plus the offset): wait before calling a step missed.
      const { missed, passes } = this.grader.flush(ctx.currentTime - this.latency() - 0.09);
      for (const s of missed) { if (this.lane) this.lane.mark(s, null, 'miss'); this.emit('miss', s); }
      for (const pass of passes) this.passDone(pass);
    }

    passDone(pass) {
      const g = this.grader;
      const steps = g.passSteps(pass);
      if (!steps.length) return;
      const st = R.summarize(steps, g.passExtras(pass));
      if (!st.n) return;
      this.passCount++;
      const verdict = R.judgePass(st);
      const bpm = steps[0].bpm;
      if (verdict.clean) { this.cleanCount++; this.bestClean = Math.max(this.bestClean, bpm); }
      let change = 0;
      if (this.ladder()) change = this.tempo.update(verdict, bpm);
      if (change) this.setBpm(this.bpm + change);
      const all = R.summarize(g.doneSteps(), g.doneExtras());
      this.emit('pass', { pass, n: this.passCount, st, all, verdict, bpm, change, text: st.hits ? `${Math.round(st.hitRate * 100)}% of hits · ${biasText(st.bias)} · ±${Math.round(st.spread)} ms` : 'No hits heard' });
    }

    onset(o) {
      if (this.state !== 'countin' && this.state !== 'run') return;
      const t = o.t - this.latency();
      // Nothing should be played during the count-in: attacks that line up with the clicks within a
      // few ms, every time, are the click leaking into the input.
      if (t < this.firstBar - 0.12) { this.preRaw.push(o.t); this.checkLeak(); return; }
      const res = this.grader.onset({ t, db: o.db });
      if (res.kind === 'hit') {
        if (this.lane) this.lane.mark(res.step, res.off, R.feel(res.off).cls);
        this.emit('hit', res);
      } else if (res.kind === 'extra') {
        if (this.lane) this.lane.mark(res.step, res.off, 'extra');
        this.emit('extra', res);
      }
    }

    checkLeak() {
      const offs = [];
      for (const c of this.countIn) {
        const near = this.preRaw.find((x) => x >= c && x <= c + 0.4);
        if (near != null) offs.push(near - c);
      }
      if (offs.length >= 3 && Math.max(...offs) - Math.min(...offs) < 0.004 && !this.leakWarned) {
        this.leakWarned = true;
        this.emit('leak');
      }
    }

    frame() {
      const t = this.heardNow();
      const p = this.p;
      if (this.state === 'countin') {
        this.emit('beat', Math.floor((t - this.countStart) / this.countBeat) % p.meter, { countIn: true, quiet: false });
        this.countInDone();
        if (this.state === 'countin') return;
      }
      let bar = null;
      for (let i = this.bars.length - 1; i >= 0; i--) if (this.bars[i].start <= t) { bar = this.bars[i]; break; }
      if (!bar) return;
      const pos = (t - bar.start) / bar.beat;
      if (bar.b !== this.lastBar) { this.lastBar = bar.b; if (this.lane) this.lane.age(bar.row, bar.b); }
      if (this.lane) this.lane.playhead(bar.row, pos);
      this.emit('beat', Math.floor(pos), { countIn: false, quiet: !bar.on });
    }

    // Stop, and grade what was played: the last 200 ms before stopping don't count as missed.
    // Returns { st, steps, extras }.
    stop() {
      if (this.state === 'stopped' || this.state === 'idle') return this.result || null;
      clearInterval(this.timer);
      if (this.off) this.off();
      const ctx = this.engine.ctx;
      for (const g of [this.out, this.drums]) {
        if (!g) continue;
        g.gain.setTargetAtTime(0, ctx.currentTime, 0.01);
        setTimeout(() => g.disconnect(), 200);
      }
      const until = this.heardNow() - 0.2;
      this.grader.flush(until);
      const steps = this.grader.doneSteps().filter((s) => s.t <= until);
      const extras = this.grader.doneExtras().filter((e) => e.step.t <= until);
      this.result = { st: R.summarize(steps, extras), steps, extras };
      if (this.lane) this.lane.idle();
      this.setState('stopped');
      return this.result;
    }
  }

  root.RhythmPlay = { Lane, Run, drawStrip, widthOf, GLYPH, EXTRA_WHERE, biasText };
})(window);
