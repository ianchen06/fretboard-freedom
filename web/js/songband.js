// The song writing page's band: the Call & response band (band.js) with three new grooves.
// - Ballad 抒情: fingerpicked clean guitar, root bass, brushes of drums that grow into the chorus, a pad.
// - Mandopop 流行: an 8-beat groove, strummed clean guitar (D D U U D U), eighth-note bass, a pad.
// - Rock 摇滚: palm-muted power chords in the verse, open ones in the chorus, double-tracked.
// Every section has an energy level, so verses are lighter than choruses. It also sings the
// melody with a soft guide voice (or the lead guitar), so you hear your lyrics' tune.
(function (root) {
  'use strict';
  const { BAR } = root.BandLib;
  const ST = root.SongTheory;
  const mod12 = (n) => ((n % 12) + 12) % 12;
  const ENERGY = { intro: 0.6, verse: 0.5, pre: 0.75, chorus: 1, bridge: 0.7, outro: 0.6 };

  function renderCrash(sr) {
    const n = Math.floor(sr * 1.8);
    const d = new Float32Array(n);
    const freqs = [340, 512, 587, 845, 1030, 1270].map((f) => f * 2.3);
    let hp = 0;
    let x1 = 0;
    const a = 1 / (1 + (2 * Math.PI * 4000) / sr);
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      let metal = 0;
      for (const f of freqs) metal += Math.sign(Math.sin(2 * Math.PI * f * t));
      const x = 0.7 * (Math.random() * 2 - 1) + 0.08 * metal;
      hp = a * (hp + x - x1);
      x1 = x;
      d[i] = hp * (0.75 * Math.exp(-t / 0.55) + 0.25 * Math.exp(-t / 0.05)) * 0.55;
    }
    return d;
  }

  class SongBand extends root.Band {
    constructor(ctx) {
      super(ctx);
      this.style = 'ballad';
      this.voice = 'voice'; // melody: 'voice' | 'guitar' | 'off'
    }

    init() {
      if (this.ready) return;
      super.init();
      const ctx = this.ctx;
      const { makeAmp, biquad } = root.BandLib;
      const sr = ctx.sampleRate;
      const crash = renderCrash(sr);
      this.drums.crash = ctx.createBuffer(1, crash.length, sr);
      this.drums.crash.copyToChannel(crash, 0);
      // The comp (rhythm) guitar's busses sit with bass and rhythm, so "drums only" mutes them.
      const room = (node, amt) => { const g = ctx.createGain(); g.gain.value = amt; node.connect(g).connect(this.room); };
      this.cleanBus = ctx.createGain();
      const cleanPan = ctx.createStereoPanner();
      cleanPan.pan.value = 0.22;
      this.cleanBus.connect(biquad(ctx, 'highpass', 90, 0.7)).connect(biquad(ctx, 'lowpass', 7500, 0.7)).connect(cleanPan).connect(this.dropBus);
      room(cleanPan, 0.35);
      // Rock: one crunch amp, double-tracked by a short delay and panned wide.
      const crunch = makeAmp(ctx, { drive: 5.5, mid: 2, level: 0.26 });
      this.crunchBus = crunch.input;
      const left = ctx.createStereoPanner();
      const right = ctx.createStereoPanner();
      left.pan.value = -0.65;
      right.pan.value = 0.65;
      const dly = ctx.createDelay(0.05);
      dly.delayTime.value = 0.014;
      crunch.output.connect(left).connect(this.dropBus);
      crunch.output.connect(dly).connect(right).connect(this.dropBus);
      room(left, 0.12);
      // Pad: detuned saws through a soft filter.
      this.padBus = ctx.createGain();
      this.padBus.gain.value = 0.5;
      this.padBus.connect(biquad(ctx, 'lowpass', 1500, 0.5)).connect(this.dropBus);
      room(this.padBus, 0.5);
      // The guide voice for the melody.
      this.voiceBus = ctx.createGain();
      this.voiceBus.gain.value = 0.9;
      const voiceTone = biquad(ctx, 'lowpass', 3200, 0.6);
      this.voiceBus.connect(voiceTone).connect(this.master);
      room(voiceTone, 0.45);
    }

    setVoice(v) { this.voice = v; }
    setMelodyVol(v) { if (this.ready) this.voiceBus.gain.setTargetAtTime(v, this.ctx.currentTime, 0.03); }

    buffer(kind, midi) {
      const opts = {
        clean: { dur: 3.4, t60: 2.6, pick: 0.16, pickup: 0.24, tone: 0.5, level: 0.42 },
        strum: { dur: 1.6, t60: 1.5, pick: 0.2, pickup: 0.22, tone: 0.62, level: 0.36 },
        power: { dur: 2.8, t60: 2.8, pick: 0.13, pickup: 0.16, tone: 0.65, level: 0.5 },
      }[kind];
      if (!opts) return super.buffer(kind, midi);
      const key = `${kind}:${midi}`;
      let b = this.cache.get(key);
      if (!b) {
        const sr = this.ctx.sampleRate;
        const data = root.BandLib.renderString(sr, midi, opts);
        b = this.ctx.createBuffer(1, data.length, sr);
        b.copyToChannel(data, 0);
        this.cache.set(key, b);
      }
      return b;
    }

    // An oscillator voice that stop() can silence.
    osc(type, freq, dest, when, end, detune = 0) {
      const o = this.ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      o.detune.value = detune;
      const g = this.ctx.createGain();
      g.gain.value = 1;
      o.connect(g).connect(dest);
      o.start(when);
      o.stop(end + 0.05);
      const item = { src: o, gain: g, end };
      this.live.add(item);
      o.onended = () => this.live.delete(item);
      return item;
    }

    pad(pcs, when, dur, vol) {
      const ctx = this.ctx;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, when);
      env.gain.linearRampToValueAtTime(vol, when + Math.min(0.5, dur * 0.3));
      env.gain.setValueAtTime(vol, when + dur - 0.05);
      env.gain.linearRampToValueAtTime(0, when + dur + 0.5);
      env.connect(this.padBus);
      for (const pc of pcs.slice(0, 4)) {
        const midi = 57 + mod12(pc - 9); // A3 … G♯4
        const f = 440 * 2 ** ((midi - 69) / 12);
        this.osc('sawtooth', f, env, when, when + dur + 0.5, -7);
        this.osc('sawtooth', f, env, when, when + dur + 0.5, 7);
      }
    }

    // One melody note in the guide voice. glide: start from this pitch (a melisma or slur).
    sing(midi, when, dur, glide = null) {
      const ctx = this.ctx;
      const f = 440 * 2 ** ((midi - 69) / 12);
      const env = ctx.createGain();
      const end = when + dur;
      env.gain.setValueAtTime(0, when);
      env.gain.linearRampToValueAtTime(0.32, when + 0.035);
      env.gain.setTargetAtTime(0.24, when + 0.04, 0.15);
      env.gain.setValueAtTime(0.24, Math.max(when + 0.05, end - 0.04));
      env.gain.setTargetAtTime(0, end - 0.03, 0.05);
      env.connect(this.voiceBus);
      const a = this.osc('triangle', f, env, when, end + 0.4);
      const b = this.osc('sine', f * 2, env, when, end + 0.4, 4);
      b.gain.gain.value = 0.18;
      for (const it of [a, b]) {
        const fr = it.src.frequency;
        const base = fr.value;
        if (glide != null) {
          fr.setValueAtTime(base * 2 ** ((glide - midi) / 12), when);
          fr.exponentialRampToValueAtTime(base, when + Math.min(0.09, dur * 0.4));
        }
        if (dur > 0.35) {
          const lfo = ctx.createOscillator();
          lfo.frequency.value = 5.2;
          const depth = ctx.createGain();
          depth.gain.setValueAtTime(0, when);
          depth.gain.setValueAtTime(0, when + 0.22);
          depth.gain.linearRampToValueAtTime(base * 0.011, when + 0.5);
          lfo.connect(depth).connect(fr);
          lfo.start(when);
          lfo.stop(end + 0.4);
          it.lfo = lfo;
        }
      }
    }

    // Guitar voicing for a chord: bass, then root-5-root-3-5 (+ the 7th, 9th or 4th) going up.
    // The 5th is the chord's own: the ♭5 in a diminished or half-diminished chord.
    voicing(ci) {
      const bass = 40 + mod12(ci.bassPc - 4); // E2 … D♯3
      const r = 40 + mod12(ci.rootPc - 4);
      const iv = ci.intervals;
      const third = iv.find((x) => x >= 2 && x <= 5);
      const fifth = iv.find((x) => x >= 6 && x <= 8);
      const notes = [bass];
      if (fifth != null) notes.push(r + fifth);
      notes.push(r + 12);
      if (third != null) notes.push(r + 12 + third);
      if (fifth != null) notes.push(r + 12 + fifth);
      const ext = iv.find((x) => x === 10 || x === 11 || x === 14);
      if (ext != null) notes.push(r + 12 + ext);
      else if (third != null) notes.push(r + 24);
      const out = [...new Set(notes.filter((m) => m >= bass))].sort((a, b) => a - b);
      return out;
    }

    // Plays to the end of the bars, or loops. onEnd fires when a non-looping run finishes.
    start(opts) {
      this.loop = opts.loop !== false;
      this.onEnd = opts.onEnd || null;
      this.style = opts.style || this.style;
      return super.start(opts);
    }

    scheduleBar(i) {
      const t0 = this.barStart(i);
      const spt = this.secPerTick;
      const at = (tick) => t0 + tick * spt;
      const human = () => (Math.random() - 0.5) * 0.008;
      const d = this.drums;
      if (i < 0) {
        for (let b = 0; b < 4; b++) this.play(d.stick, this.drumBus, at(b * 12), { vol: b === 0 ? 1 : 0.7 });
        return;
      }
      const n = this.bars.length;
      if (!this.loop && i >= n) {
        if (i === n && this.onEnd) {
          const cb = this.onEnd;
          setTimeout(() => { if (this.running) cb(); }, Math.max(0, (t0 - this.ctx.currentTime) * 1000 + 600));
        }
        return;
      }
      const bar = this.bars[i % n];
      const content = (this.getBar && this.getBar(i, t0)) || {};
      this.dropBus.gain.setTargetAtTime(content.drop ? 0 : 1, t0 - 0.02, 0.02);
      const key = this.keyPc;
      const chords = bar.chords.map((c) => ST.chordInfo(c, key)).filter(Boolean);
      if (!chords.length) return;
      const chordAt = (tick) => (chords.length > 1 && tick >= BAR / 2 ? chords[1] : chords[0]);
      const e = ENERGY[bar.role] != null ? ENERGY[bar.role] : 0.7;
      const style = this.style;

      // ---------- drums ----------
      const kick = (tick, v = 1) => this.play(d.kick, this.drumBus, at(tick) + human(), { vol: v });
      const snare = (tick, v = 0.85) => this.play(d.snare, this.drumBus, at(tick) + human(), { vol: v });
      const hat = (tick, v = 0.4) => this.play(d.hat, this.drumBus, at(tick) + human(), { vol: v });
      const stick = (tick, v = 0.6) => this.play(d.stick, this.drumBus, at(tick) + human(), { vol: v });
      const crash = (tick, v = 0.6) => this.play(d.crash, this.drumBus, at(tick), { vol: v });
      const fill = bar.last && bar.nextRole && bar.nextRole !== bar.role && e >= 0.5;
      if (bar.first && (bar.role === 'chorus' || (style === 'rock' && bar.role !== 'verse'))) crash(0, style === 'rock' ? 0.75 : 0.5);
      if (style === 'ballad') {
        if (e < 0.7) {
          kick(0, 0.55);
          stick(12, 0.45);
          stick(36, 0.45);
        } else {
          kick(0, 0.8);
          kick(18, 0.45);
          kick(24, 0.6);
          snare(12, 0.55);
          snare(36, 0.6);
          for (let k = 0; k < 8; k++) hat(k * 6, k % 2 ? 0.18 : 0.28);
        }
        if (fill) for (const [t, v] of [[36, 0.4], [40, 0.5], [44, 0.6]]) snare(t, v);
      } else if (style === 'pop') {
        for (let k = 0; k < 8; k++) hat(k * 6, k % 2 ? 0.22 : 0.38);
        kick(0, 0.9);
        kick(18, 0.6);
        kick(24, 0.8);
        if (e >= 0.75) kick(42, 0.4);
        if (e < 0.6) { stick(12, 0.55); stick(36, 0.55); } else { snare(12, 0.8); snare(36, 0.8); }
        if (fill) for (const [t, v] of [[36, 0.5], [39, 0.55], [42, 0.65], [45, 0.75]]) snare(t, v);
      } else {
        for (let k = 0; k < 8; k++) {
          if (e >= 1) this.play(d.openHat, this.drumBus, at(k * 6) + human(), { vol: k % 2 ? 0.16 : 0.26 });
          else hat(k * 6, k % 2 ? 0.3 : 0.45);
        }
        kick(0, 1);
        kick(6, 0.55);
        kick(24, 0.9);
        kick(30, 0.6);
        snare(12, 0.95);
        snare(36, 0.95);
        if (fill) for (const t of [24, 30, 36, 39, 42, 45]) snare(t, 0.55 + t / 120);
      }

      // ---------- bass ----------
      const bassNote = (tick, len, ci, up = 0, v = 0.9) => {
        const m = 28 + mod12(ci.bassPc - 4) + up;
        this.play(this.buffer('bass', m), this.bassBus, at(tick) + human(), { vol: v, stopAt: at(tick + len) });
      };
      if (style === 'ballad') {
        if (chords.length > 1) { bassNote(0, 22, chords[0]); bassNote(24, 22, chords[1]); } else if (e < 0.7) bassNote(0, 46, chords[0]);
        else { bassNote(0, 22, chords[0]); bassNote(24, 22, chords[0], 0, 0.75); }
      } else if (style === 'pop') {
        if (e < 0.6) for (let b = 0; b < 4; b++) bassNote(b * 12, 10, chordAt(b * 12), 0, b ? 0.75 : 0.9);
        else for (let k = 0; k < 8; k++) bassNote(k * 6, 5, chordAt(k * 6), k % 4 === 3 ? 12 : 0, k % 2 ? 0.7 : 0.9);
      } else {
        for (let k = 0; k < 8; k++) bassNote(k * 6, 5, chordAt(k * 6), 0, k % 2 ? 0.75 : 0.95);
      }

      // ---------- guitar ----------
      if (style === 'ballad') {
        const order = [0, 1, 2, 3, 4, 3, 2, 1];
        for (let k = 0; k < 8; k++) {
          const tick = k * 6;
          const v = this.voicing(chordAt(tick));
          const m = v[Math.min(v.length - 1, order[k])];
          this.play(this.buffer('clean', m), this.cleanBus, at(tick) + human(), { vol: k === 0 ? 0.62 : 0.5, stopAt: at(tick + 22) });
        }
      } else if (style === 'pop') {
        // D D U U D U on the 8ths: 1, 2, &2, &3, 4, &4.
        const strokes = e < 0.6 ? [[0, 'D', 0.8], [18, 'U', 0.45], [24, 'D', 0.65], [42, 'U', 0.45]] : [[0, 'D', 0.85], [12, 'D', 0.65], [18, 'U', 0.5], [30, 'U', 0.5], [36, 'D', 0.65], [42, 'U', 0.5]];
        strokes.forEach(([tick, dir, vol], k) => {
          const next = strokes[k + 1] ? strokes[k + 1][0] : BAR;
          const v = this.voicing(chordAt(tick));
          const notes = dir === 'D' ? v : v.slice(-4).reverse();
          const tt = at(tick) + human();
          notes.forEach((m, j) => this.play(this.buffer('strum', m), this.cleanBus, tt + j * (dir === 'D' ? 0.011 : 0.008), { vol: vol * (dir === 'D' && j === 0 ? 1 : 0.85), stopAt: at(next) + 0.02 }));
        });
      } else {
        // Root, 5th, octave: the chord's own 5th, so a diminished chord gets its ♭5.
        const power = (ci) => { const r = 40 + mod12(ci.rootPc - 4); const fifth = ci.intervals.find((x) => x >= 6 && x <= 8) || 7; return [r, r + fifth, r + 12]; };
        if (e < 0.7) {
          for (let k = 0; k < 8; k++) {
            const tt = at(k * 6) + human();
            power(chordAt(k * 6)).slice(0, 2).forEach((m, j) => this.play(this.buffer('mute', m), this.crunchBus, tt + j * 0.004, { vol: k % 2 ? 0.75 : 0.95, stopAt: tt + 5 * spt }));
          }
        } else {
          const hits = chords.length > 1 ? [[0, 24], [24, 24]] : [[0, 18], [18, 6], [24, 24]];
          for (const [tick, len] of hits) {
            const tt = at(tick) + human();
            power(chordAt(tick)).forEach((m, j) => this.play(this.buffer('power', m), this.crunchBus, tt + j * 0.006, { vol: 0.9, stopAt: at(tick + len) - 0.01 }));
          }
        }
      }

      // ---------- pad ----------
      const padOn = style === 'ballad' ? e >= 0.7 || bar.role === 'intro' || bar.role === 'outro' : style === 'pop' ? e >= 0.75 : false;
      if (padOn) {
        if (chords.length > 1) { this.pad(chords[0].pcs, at(0), 24 * spt, 0.05); this.pad(chords[1].pcs, at(24), 24 * spt, 0.05); } else this.pad(chords[0].pcs, at(0), BAR * spt, 0.05);
      }

      // ---------- melody ----------
      if (content.melody && this.voice !== 'off') {
        let prev = null;
        content.melody.forEach((nt) => {
          const when = at(nt.t);
          const dur = Math.max(0.06, nt.d * spt * 0.94);
          if (this.voice === 'guitar') this.leadNote({ fretMidi: nt.midi, bend: 0, tech: nt.m ? 's' : 'pick', vib: dur > 0.4 }, when, dur);
          else this.sing(nt.midi, when, dur, nt.m && prev ? prev.midi : null);
          prev = nt;
        });
      }
    }
  }

  root.SongBand = SongBand;
  root.SongBandLib = { ENERGY };
})(window);
