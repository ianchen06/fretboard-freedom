// The backing band for the Call & response practice: drums, bass, a rhythm guitar and the lead
// guitar that plays the licks. Everything is synthesized in the browser (no sample files):
// - guitars and bass are plucked strings (Karplus–Strong with a tuned loop, pick and pickup
//   position), rendered once per note and cached;
// - the drums are rendered from noise and sine sweeps;
// - the guitars go through an amp: a built-in one (drive + cabinet EQ), or, for the lead, a
//   Neural Amp Modeler capture you load yourself (vendor/nam, run in an AudioWorklet).
// A lookahead scheduler plays the progression bar by bar and asks the page what the lead plays.
(function (root) {
  'use strict';
  const TPB = 12;
  const BAR = 48;
  const LOOKAHEAD = 0.25; // s: bars are scheduled this far ahead
  const mtof = (m) => 440 * 2 ** ((m - 69) / 12);
  const dbToLin = (db) => 10 ** (db / 20);
  const mod12 = (n) => ((n % 12) + 12) % 12;

  // ---------- plucked strings ----------
  // tone: 0 = soft/dark attack, 1 = bright pick. t60: seconds to fade by 60 dB.
  function renderString(sr, midi, { dur = 3, t60 = 3, pick = 0.13, pickup = 0.18, tone = 0.6, level = 0.5 } = {}) {
    const f0 = mtof(midi);
    const len = Math.floor(sr * dur);
    const out = new Float32Array(len);
    // The loop is P samples of delay, half a sample for the averaging filter, and a fractional
    // all-pass for the rest, so the string is in tune.
    const total = sr / f0 - 0.5;
    let P = Math.floor(total);
    let frac = total - P;
    if (frac < 0.1) { P -= 1; frac += 1; }
    const C = (1 - frac) / (1 + frac);
    const rho = 10 ** (-3 / (t60 * f0));
    const line = new Float32Array(P);
    const a = 0.12 + 0.8 * tone;
    let lp = 0;
    const exc = new Float32Array(P);
    for (let i = 0; i < P; i++) { lp += a * (Math.random() * 2 - 1 - lp); exc[i] = lp; }
    const k = Math.max(1, Math.round(pick * P)); // picking at 1/k of the string cancels those harmonics
    let mean = 0;
    for (let i = 0; i < P; i++) { line[i] = exc[i] - (i >= k ? exc[i - k] : 0); mean += line[i]; }
    mean /= P;
    for (let i = 0; i < P; i++) line[i] -= mean;
    let idx = 0;
    let prev = 0;
    let apx = 0;
    let apy = 0;
    for (let n = 0; n < len; n++) {
      const y = line[idx];
      const avg = 0.5 * (y + prev);
      prev = y;
      const ap = C * avg + apx - C * apy;
      apx = avg;
      apy = ap;
      line[idx] = rho * ap;
      idx = idx + 1 === P ? 0 : idx + 1;
      out[n] = y;
    }
    const q = Math.max(1, Math.round(pickup * P)); // the pickup hears the string at one spot
    for (let n = len - 1; n >= q; n--) out[n] -= out[n - q];
    let peak = 0;
    for (let n = 0; n < len; n++) peak = Math.max(peak, Math.abs(out[n]));
    const g = level / (peak || 1);
    const fade = Math.floor(sr * 0.04);
    for (let n = 0; n < len; n++) out[n] *= g * (n > len - fade ? (len - n) / fade : 1);
    return out;
  }

  // ---------- drums ----------
  const noise = () => Math.random() * 2 - 1;
  function hp1(sr, fc) { const a = 1 / (1 + (2 * Math.PI * fc) / sr); let y = 0; let x1 = 0; return (x) => { y = a * (y + x - x1); x1 = x; return y; }; }
  function lp1(sr, fc) { const a = 1 - Math.exp((-2 * Math.PI * fc) / sr); let y = 0; return (x) => { y += a * (x - y); return y; }; }

  function renderDrums(sr) {
    const make = (secs, fn) => { const n = Math.floor(sr * secs); const d = new Float32Array(n); fn(d, n); return d; };
    const kick = make(0.5, (d, n) => {
      let ph = 0;
      const lp = lp1(sr, 3000);
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        ph += (2 * Math.PI * (46 + 115 * Math.exp(-t / 0.032))) / sr;
        const body = Math.sin(ph) * Math.exp(-t / 0.28);
        const click = lp(noise()) * Math.exp(-t / 0.002) * 0.5;
        d[i] = Math.tanh(1.5 * (body + click)) * 0.85;
      }
    });
    const snare = make(0.35, (d, n) => {
      const hp = hp1(sr, 1400);
      const lp = lp1(sr, 9000);
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const tone = 0.5 * Math.sin(2 * Math.PI * 182 * t) * Math.exp(-t / 0.045) + 0.22 * Math.sin(2 * Math.PI * 329 * t) * Math.exp(-t / 0.03);
        const wires = lp(hp(noise())) * (0.75 * Math.exp(-t / 0.11) + 0.4 * Math.exp(-t / 0.015));
        d[i] = Math.tanh(1.2 * (tone + wires)) * 0.8;
      }
    });
    const hat = (open) => make(open ? 0.55 : 0.12, (d, n) => {
      const hpA = hp1(sr, 7000);
      const hpB = hp1(sr, 7000);
      const freqs = [263, 400, 421, 474, 587, 845].map((f) => f * 1.7);
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        let metal = 0;
        for (const f of freqs) metal += Math.sign(Math.sin(2 * Math.PI * f * t));
        const x = hpB(hpA(0.6 * noise() + 0.12 * metal));
        d[i] = x * Math.exp(-t / (open ? 0.17 : 0.028)) * 0.6;
      }
    });
    const stick = make(0.05, (d, n) => {
      const hp = hp1(sr, 1800);
      const lp = lp1(sr, 5000);
      for (let i = 0; i < n; i++) d[i] = lp(hp(noise())) * Math.exp(-i / sr / 0.007) * 1.6;
    });
    return { kick, snare, hat: hat(false), openHat: hat(true), stick };
  }

  // A stereo room: decaying noise, darker as it fades.
  function renderRoom(ctx, secs = 1.8) {
    const sr = ctx.sampleRate;
    const n = Math.floor(sr * secs);
    const buf = ctx.createBuffer(2, n, sr);
    const pre = Math.floor(sr * 0.012);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      let y = 0;
      for (let i = pre; i < n; i++) {
        const t = (i - pre) / sr;
        const a = 0.9 * Math.exp(-t / 0.35) + 0.05;
        y += a * (noise() - y);
        d[i] = y * Math.exp(-t / 0.42);
      }
    }
    return buf;
  }

  // ---------- amps ----------
  function shaperCurve(drive) {
    const n = 2048;
    const c = new Float32Array(n);
    const bias = 0.12; // a little asymmetry, like a tube stage
    const norm = Math.tanh(drive * (1 + bias)) - Math.tanh(drive * bias);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / (n - 1) - 1;
      c[i] = (Math.tanh(drive * (x + bias)) - Math.tanh(drive * bias)) / norm;
    }
    return c;
  }

  function biquad(ctx, type, freq, Q = 0.7, gain = 0) {
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = Q;
    f.gain.value = gain;
    return f;
  }

  function chain(nodes) {
    for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
    return { input: nodes[0], output: nodes[nodes.length - 1] };
  }

  // A 4x12-ish cabinet: no lows below ~85 Hz, a scooped low-mid, a presence bump, no fizz.
  function makeCab(ctx) {
    return chain([
      ctx.createGain(),
      biquad(ctx, 'highpass', 85, 0.7),
      biquad(ctx, 'peaking', 420, 1, -3),
      biquad(ctx, 'peaking', 2300, 1.1, 4),
      biquad(ctx, 'lowpass', 5000, 0.7),
      biquad(ctx, 'lowpass', 5600, 0.6),
      ctx.createGain(),
    ]);
  }

  // Drive → tone → cabinet. drive ~2 = crunch, ~8 = lead.
  function makeAmp(ctx, { drive = 4, mid = 3, level = 0.5 } = {}) {
    const input = ctx.createGain();
    const tight = biquad(ctx, 'highpass', 110, 0.7);
    const pre = ctx.createGain();
    pre.gain.value = 1;
    const shaper = ctx.createWaveShaper();
    shaper.curve = shaperCurve(drive);
    shaper.oversample = '4x';
    const midBump = biquad(ctx, 'peaking', 750, 0.8, mid);
    const cab = makeCab(ctx);
    const output = ctx.createGain();
    output.gain.value = level;
    input.connect(tight).connect(pre).connect(shaper).connect(midBump).connect(cab.input);
    cab.output.connect(output);
    return { input, output, setDrive: (v) => { pre.gain.value = v; } };
  }

  // ---------- band ----------
  class Band {
    constructor(ctx) {
      this.ctx = ctx;
      this.ready = false;
      this.running = false;
      this.cache = new Map();
      this.live = new Set(); // { src, gain, end } scheduled sources, so stop() can silence them
      this.lead = null; // the lead voice's current note
      this.nam = null; // { engine, node, info, name }
      this.ampMode = 'builtin';
      this.useCab = false;
      this.drive = 1;
    }

    init() {
      if (this.ready) return;
      const ctx = this.ctx;
      const sr = ctx.sampleRate;
      this.drums = {};
      for (const [k, d] of Object.entries(renderDrums(sr))) {
        const b = ctx.createBuffer(1, d.length, sr);
        b.copyToChannel(d, 0);
        this.drums[k] = b;
      }
      // Mixer: everything → glue compressor → master.
      this.master = ctx.createGain();
      this.master.gain.value = 0.9;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.knee.value = 10;
      comp.ratio.value = 3;
      comp.attack.value = 0.01;
      comp.release.value = 0.2;
      comp.connect(this.master).connect(ctx.destination);
      this.room = ctx.createConvolver();
      this.room.buffer = renderRoom(ctx);
      const roomOut = ctx.createGain();
      roomOut.gain.value = 0.22;
      this.room.connect(roomOut).connect(comp);

      this.bandBus = ctx.createGain(); // band volume: drums, bass, rhythm
      this.bandBus.connect(comp);
      this.drumBus = ctx.createGain();
      this.drumBus.gain.value = 0.55;
      this.drumBus.connect(this.bandBus);
      this.dropBus = ctx.createGain(); // bass + rhythm, muted on your turn if you ask
      this.dropBus.connect(this.bandBus);
      const bassTone = biquad(ctx, 'lowpass', 1100, 0.8);
      this.bassBus = ctx.createGain();
      this.bassBus.gain.value = 0.9;
      this.bassBus.connect(bassTone).connect(this.dropBus);
      const rhythmAmp = makeAmp(ctx, { drive: 2.6, mid: 1, level: 0.32 });
      this.rhythmBus = rhythmAmp.input;
      const pan = ctx.createStereoPanner();
      pan.pan.value = -0.35;
      rhythmAmp.output.connect(pan).connect(this.dropBus);
      const rhythmSend = ctx.createGain();
      rhythmSend.gain.value = 0.25;
      pan.connect(rhythmSend).connect(this.room);

      // Lead: leadIn → amp (built-in or NAM) → leadOut → lead volume.
      this.leadIn = ctx.createGain();
      this.leadOut = ctx.createGain();
      this.leadVol = ctx.createGain();
      this.leadOut.connect(this.leadVol).connect(comp);
      const leadSend = ctx.createGain();
      leadSend.gain.value = 0.5;
      this.leadVol.connect(leadSend).connect(this.room);
      this.builtinLead = makeAmp(ctx, { drive: 7, mid: 4, level: 0.38 });
      this.builtinLead.output.connect(this.leadOut);
      this.leadIn.connect(this.builtinLead.input);
      this.ready = true;
      this.applyDrive();
    }

    setMix({ band, lead }) {
      if (!this.ready) return;
      if (band != null) this.bandBus.gain.setTargetAtTime(band, this.ctx.currentTime, 0.03);
      if (lead != null) this.leadVol.gain.setTargetAtTime(lead, this.ctx.currentTime, 0.03);
    }

    setDrive(v) { this.drive = v; this.applyDrive(); }
    applyDrive() {
      if (!this.ready) return;
      this.builtinLead.setDrive(this.drive);
      if (this.nam) this.nam.pre.gain.value = this.drive * this.nam.inputGain;
    }

    // ---------- the neural amp ----------
    // Load a .nam capture (its JSON text). Returns what the page needs to show about it.
    async loadNam(json, name) {
      this.init();
      const ctx = this.ctx;
      let meta = {};
      try { meta = JSON.parse(json).metadata || {}; } catch { throw new Error('That file isn’t a .nam model (it isn’t JSON).'); }
      if (!this.nam) {
        const url = new URL('vendor/nam/index.js', document.baseURI).href;
        const mod = await import(url);
        const engine = await mod.NamEngine.attach(ctx);
        const node = await engine.createNode();
        const pre = ctx.createGain();
        const post = ctx.createGain();
        this.cab = makeCab(ctx);
        pre.connect(node).connect(post);
        this.nam = { engine, node, pre, post, inputGain: 1 };
      }
      const info = await this.nam.node.loadModel(json);
      // Captures report how loud they are; bring them all to about the same level.
      this.nam.post.gain.value = info.hasLoudness ? Math.min(4, dbToLin(-20 - info.loudness)) : 0.5;
      this.nam.info = info;
      this.nam.name = meta.name || name || 'Amp capture';
      const gear = String(meta.gear_type || '').toLowerCase();
      this.useCab = gear ? !gear.includes('cab') : this.useCab;
      this.setAmp('nam');
      return {
        name: this.nam.name,
        gear: [meta.gear_make, meta.gear_model].filter(Boolean).join(' '),
        gearType: gear,
        useCab: this.useCab,
        rateOk: !info.expectedSampleRate || Math.abs(info.expectedSampleRate - ctx.sampleRate) < 1,
        expectedRate: info.expectedSampleRate,
        rate: ctx.sampleRate,
      };
    }

    setAmp(mode) {
      if (!this.ready) return;
      if (mode === 'nam' && !this.nam) mode = 'builtin';
      this.ampMode = mode;
      for (const n of [this.leadIn, this.nam && this.nam.post, this.cab && this.cab.output]) if (n) n.disconnect();
      if (mode === 'nam') {
        this.leadIn.connect(this.nam.pre);
        if (this.useCab) { this.nam.post.connect(this.cab.input); this.cab.output.connect(this.leadOut); } else this.nam.post.connect(this.leadOut);
      } else {
        this.leadIn.connect(this.builtinLead.input);
      }
      this.applyDrive();
    }

    setCab(on) { this.useCab = on; if (this.ampMode === 'nam') this.setAmp('nam'); }

    // Send a live input (your guitar from an audio interface) through the lead amp, so you hear it
    // with the same tone as the licks.
    setMonitor(src, on) {
      this.init();
      if (!this.monitor) {
        this.monitor = this.ctx.createGain();
        this.monitor.connect(this.leadIn);
      }
      if (this.monitorSrc && (!on || this.monitorSrc !== src)) {
        try { this.monitorSrc.disconnect(this.monitor); } catch { /* already gone */ }
        this.monitorSrc = null;
      }
      if (on && src && !this.monitorSrc) {
        src.connect(this.monitor);
        this.monitorSrc = src;
      }
    }

    // ---------- sounds ----------
    buffer(kind, midi) {
      const key = `${kind}:${midi}`;
      let b = this.cache.get(key);
      if (b) return b;
      const sr = this.ctx.sampleRate;
      const opts = {
        lead: { dur: 3.2, t60: 3.4, pick: 0.12, pickup: 0.2, tone: 0.75, level: 0.5 },
        legato: { dur: 3.2, t60: 3.4, pick: 0.3, pickup: 0.2, tone: 0.2, level: 0.42 },
        mute: { dur: 0.5, t60: 0.2, pick: 0.15, pickup: 0.16, tone: 0.5, level: 0.5 },
        bass: { dur: 2.2, t60: 2.6, pick: 0.22, pickup: 0.1, tone: 0.2, level: 0.6 },
      }[kind];
      const data = renderString(sr, midi, opts);
      b = this.ctx.createBuffer(1, data.length, sr);
      b.copyToChannel(data, 0);
      this.cache.set(key, b);
      return b;
    }

    play(buffer, dest, when, { vol = 1, stopAt = null, release = 0.03 } = {}) {
      const ctx = this.ctx;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const g = ctx.createGain();
      g.gain.value = vol;
      src.connect(g).connect(dest);
      src.start(when);
      const end = stopAt == null ? when + buffer.duration : stopAt;
      if (stopAt != null) {
        g.gain.setValueAtTime(vol, stopAt);
        g.gain.setTargetAtTime(0, stopAt, release);
        src.stop(stopAt + release * 6);
      }
      const item = { src, gain: g, end };
      this.live.add(item);
      src.onended = () => this.live.delete(item);
      return item;
    }

    // ---------- the lead voice ----------
    // Plays one lick note (from LickGen.inKey) at `when`, lasting `dur` s. One note at a time.
    leadNote(n, when, dur) {
      const ctx = this.ctx;
      const cur = this.lead;
      if (n.tech === 'rel' && cur) {
        // Let the bend down: the same string keeps ringing.
        const rate = cur.src.playbackRate;
        rate.setValueAtTime(2 ** (cur.bend / 12), when);
        rate.exponentialRampToValueAtTime(1, when + Math.min(0.12, dur * 0.5));
        this.extend(cur, when + dur);
        cur.bend = 0;
        return;
      }
      if (cur) this.cut(cur, when);
      const legato = n.tech === 'h' || n.tech === 'p' || n.tech === 's';
      const item = this.play(this.buffer(legato ? 'legato' : 'lead', n.fretMidi), this.leadIn, when, { stopAt: when + dur, release: 0.04 });
      const rate = item.src.playbackRate;
      if (n.tech === 's') {
        const from = cur ? cur.midi : n.fretMidi - 2;
        rate.setValueAtTime(2 ** ((from - n.fretMidi) / 12), when);
        rate.exponentialRampToValueAtTime(1, when + Math.min(0.08, dur * 0.4));
      }
      if (n.bend) {
        const start = when + Math.min(0.04, dur * 0.15);
        rate.setValueAtTime(1, start);
        rate.exponentialRampToValueAtTime(2 ** (n.bend / 12), start + Math.min(0.15, dur * 0.4));
      }
      if (n.vib && dur > 0.25) {
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 5.6;
        const depth = ctx.createGain();
        const top = 2 ** (n.bend / 12) * (2 ** (22 / 1200) - 1); // ±22 cents
        const onset = when + Math.min(0.18, dur * 0.35);
        depth.gain.setValueAtTime(0, when);
        depth.gain.setValueAtTime(0, onset);
        depth.gain.linearRampToValueAtTime(top, onset + 0.2);
        lfo.connect(depth).connect(rate);
        lfo.start(when);
        lfo.stop(when + dur + 0.3);
        item.lfo = lfo;
      }
      item.midi = n.fretMidi;
      item.bend = n.bend;
      this.lead = item;
    }

    cut(item, when) {
      if (when >= item.end) return;
      item.gain.gain.cancelScheduledValues(when);
      item.gain.gain.setValueAtTime(item.gain.gain.value, when);
      item.gain.gain.setTargetAtTime(0, when, 0.008);
      try { item.src.stop(when + 0.06); } catch { /* already stopping earlier */ }
      item.end = when;
    }

    extend(item, until) {
      if (until <= item.end) return;
      const g = item.gain.gain;
      g.cancelScheduledValues(item.end);
      g.setValueAtTime(1, item.end);
      g.setValueAtTime(1, until);
      g.setTargetAtTime(0, until, 0.04);
      try { item.src.stop(until + 0.3); } catch { /* stop() can't be moved in some browsers */ }
      item.end = until;
    }

    // A single note right now (clicking the fretboard).
    pluck(midi) {
      this.init();
      const now = this.ctx.currentTime + 0.01;
      this.leadNote({ fretMidi: midi, bend: 0, tech: 'pick', vib: false }, now, 1.4);
      this.lead = null;
    }

    // ---------- transport ----------
    get secPerTick() { return 60 / this.bpm / TPB; }
    get barDur() { return BAR * this.secPerTick; }
    barStart(i) { return this.t0 + (i + this.countIn) * this.barDur; }
    // Bar and tick at a time, or null before the count-in starts.
    position(time) {
      if (!this.running && this.stoppedAt == null) return null;
      const x = (time - this.t0) / this.barDur - this.countIn;
      const bar = Math.floor(x);
      return { bar, tick: (x - bar) * BAR, beat: Math.floor((x - bar) * 4) };
    }

    // bars: chord names ('I', 'IV', 'V'); getBar(i, time) → { lead: notes (t in ticks from the bar
    // start), drop: bool } for every bar i ≥ 0, asked LOOKAHEAD s before the bar starts.
    start({ bpm, keyPc, bars, getBar, countIn = 1 }) {
      this.init();
      this.stop();
      this.bpm = bpm;
      this.keyPc = keyPc;
      this.bars = bars;
      this.getBar = getBar;
      this.countIn = countIn;
      this.t0 = this.ctx.currentTime + 0.12;
      this.nextBar = -countIn;
      this.running = true;
      this.stoppedAt = null;
      this.dropBus.gain.cancelScheduledValues(0);
      this.dropBus.gain.value = 1;
      this.tick();
      this.timer = setInterval(() => this.tick(), 25);
      return this.t0;
    }

    stop() {
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
      if (!this.running) return;
      this.running = false;
      this.stoppedAt = this.ctx.currentTime;
      const now = this.ctx.currentTime;
      for (const it of this.live) {
        it.gain.gain.cancelScheduledValues(now);
        it.gain.gain.setTargetAtTime(0, now, 0.015);
        try { it.src.stop(now + 0.1); } catch { /* not started yet: stop() before start time is fine */ }
        if (it.lfo) try { it.lfo.stop(now + 0.1); } catch { /* ignore */ }
      }
      this.live.clear();
      this.lead = null;
    }

    tick() {
      if (!this.running) return;
      while (this.barStart(this.nextBar) < this.ctx.currentTime + LOOKAHEAD) {
        this.scheduleBar(this.nextBar);
        this.nextBar++;
      }
    }

    scheduleBar(i) {
      const t0 = this.barStart(i);
      const spt = this.secPerTick;
      const at = (tick) => t0 + tick * spt;
      const human = () => (Math.random() - 0.5) * 0.008;
      const d = this.drums;
      if (i < 0) {
        for (let b = 0; b < 4; b++) this.play(d.stick, this.drumBus, at(b * TPB), { vol: b === 0 ? 1 : 0.7 });
        return;
      }
      const n = this.bars.length;
      const chord = this.bars[i % n];
      const lastBar = i % n === n - 1;
      const content = (this.getBar && this.getBar(i, t0)) || {};

      // Drop bass and rhythm on your turn, if asked.
      this.dropBus.gain.setTargetAtTime(content.drop ? 0 : 1, t0 - 0.02, 0.02);

      // Drums: a shuffle. Hi-hat on the beats and the swung "and"s, kick 1 and 3, snare 2 and 4.
      for (let b = 0; b < 4; b++) {
        this.play(d.hat, this.drumBus, at(b * TPB) + human(), { vol: b % 2 ? 0.55 : 0.7 });
        this.play(d.hat, this.drumBus, at(b * TPB + 8) + human(), { vol: 0.32 });
      }
      this.play(d.kick, this.drumBus, at(0), { vol: 1 });
      this.play(d.kick, this.drumBus, at(24) + human(), { vol: 0.8 });
      if (i % 2 === 1) this.play(d.kick, this.drumBus, at(44) + human(), { vol: 0.35 });
      this.play(d.snare, this.drumBus, at(12) + human(), { vol: 0.85 });
      if (lastBar) {
        this.play(d.snare, this.drumBus, at(36), { vol: 0.75 });
        this.play(d.snare, this.drumBus, at(40) + human(), { vol: 0.5 });
        this.play(d.snare, this.drumBus, at(44) + human(), { vol: 0.65 });
      } else {
        this.play(d.snare, this.drumBus, at(36) + human(), { vol: 0.85 });
        this.play(d.snare, this.drumBus, at(32) + human(), { vol: 0.12 });
      }
      if (i % n === 0) this.play(d.openHat, this.drumBus, at(0), { vol: 0.35 });

      // Bass: a walking boogie, R 3 5 6, then ♭7 6 5 3 when the chord stays.
      const root = { I: 0, IV: 5, V: 7 }[chord];
      const pc = mod12(this.keyPc + root);
      const bassRoot = 28 + mod12(pc - 4); // E1 … D♯2
      let run = 0;
      for (let k = i - 1; k >= 0 && this.bars[k % n] === chord; k--) run++;
      const walk = run % 2 === 0 || lastBar ? [0, 4, 7, 9] : [10, 9, 7, 4];
      walk.forEach((iv, b) => {
        this.play(this.buffer('bass', bassRoot + iv), this.bassBus, at(b * TPB) + human(), { vol: b === 0 ? 1 : 0.85, stopAt: at(b * TPB + 10.5) });
      });

      // Rhythm guitar: the boogie shuffle, root + 5th/6th/♭7, palm-muted, down-up on each beat.
      const low = 40 + mod12(pc - 4); // E2 … D♯3
      [7, 9, 10, 9].forEach((iv, b) => {
        for (const [tick, vol, strum] of [[b * TPB, 0.9, 0], [b * TPB + 8, 0.55, 1]]) {
          const tt = at(tick) + human();
          const order = strum ? [low + iv, low] : [low, low + iv];
          order.forEach((m, k) => this.play(this.buffer('mute', m), this.rhythmBus, tt + k * 0.007, { vol, stopAt: tt + 6 * spt }));
        }
      });

      // Lead: the lick, if this bar has one.
      if (content.lead) {
        content.lead.forEach((nt, k) => {
          const next = content.lead[k + 1];
          const endTick = Math.min(nt.t + nt.d, next ? next.t : Infinity);
          this.leadNote(nt, at(nt.t), Math.max(0.05, (endTick - nt.t) * spt));
        });
      }
    }
  }

  root.Band = Band;
  root.BandLib = { renderString, renderDrums, renderRoom, makeAmp, biquad, TPB, BAR };
})(window);
