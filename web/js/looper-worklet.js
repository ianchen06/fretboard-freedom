// The looper's audio engine (looper.html). It runs in an AudioWorklet, so every recording,
// overdub and loop wrap lands on an exact sample. The page sends it commands with exact frame
// times on the AudioContext clock; this file does no timing of its own beyond counting frames.
//
// The same LoopCore runs in node for the tests (test/looper.test.js).
//
// How it works, and where the ideas come from:
// - Loop operations follow SooperLooper (Jesse Chappell, https://github.com/essej/sooperlooper,
//   doc/html/doc_commands.html and src/looper.cpp, src/plugin.cc): record, overdub, undo/redo,
//   reverse, rate (½× and 2×, which also shift the octave), feedback.
// - Crossfades. SooperLooper fades every loop operation over `xfade` samples (64 by default:
//   Looper::initialize(), ports[FadeSamples] = 64). We fade over 3 ms (144 samples at 48 kHz):
//   a guitar's low E is 82 Hz, and 64 samples is a tenth of its period, short enough to click on
//   a loud low note. The loop seam is closed the classic way: the recording runs on for one fade
//   past the end, and that run-on is crossfaded into the loop's first samples, so the sound that
//   crossed the boundary carries on into the start instead of being cut.
// - Feedback. SooperLooper's feedback (default 1.0) is how much of the existing loop survives each
//   pass while you overdub; turning it down fades old material out as you play new material in.
//   Here every overdub pass is its own layer, and feedback multiplies the gain of the layers under
//   it at each new pass. The audio is the same as SooperLooper's in-place multiply, but every pass
//   stays separate, so Undo can take a pass back off and give the older layers their level back.
//   (SooperLooper also scales feedback of 1.0 down to 0.96 to stop overdubs piling up into
//   clipping; we don't need that: layers are summed in floating point and the mix is limited on
//   the page.)
// - Latency. SooperLooper compensates input and output latency so that what you play lines up
//   with what you heard (doc/html/doc_sync.html, "Latency Compensation"). We use one number, the
//   round trip R (output latency + input latency): you hear frame f at f + output latency, play
//   along with it, and your playing reaches the worklet at f + R. So input that arrives at frame g
//   belongs at loop time g − R. The worklet keeps the last ~6 s of input in a ring buffer, so a
//   recording can also start a moment in the past (a press that lands just after the bar line).
(function (root) {
  'use strict';

  const XFADE_SEC = 0.003;
  const RING_SEC = 6;
  const MAX_LAYERS = 24; // per track; beyond this the two oldest are merged (and can't be undone)
  const FIRST_CAP_SEC = 8; // a new recording's buffer starts this long and doubles as needed
  const MAX_REC_SEC = 180;

  const mod = (a, n) => ((a % n) + n) % n;

  function newTrack() {
    return {
      len: 0, // frames, 0 = empty
      org: 0, // the frame where loop position 0 plays (and every len frames after)
      layers: [], // { buf, g, gt, prev } prev: the older layers' gains before this layer was added
      redo: [],
      span: null, // a recording or overdub in progress
      rev: false,
      rate: 1,
      fb: 1,
      liveFrom: Infinity, // frame from which the track can be heard
      env: 0, // 0..1, fades the whole track in and out
      xf: 0, // frames left of a crossfade from the old read mapping (reverse or rate change)
      old: null, // { rev, rate } the old mapping
      pend: [], // { at, rev?, rate? } changes waiting for their frame
    };
  }

  class LoopCore {
    constructor({ sampleRate, tracks = 4 } = {}) {
      this.sr = sampleRate;
      this.xfade = Math.max(16, Math.round(sampleRate * XFADE_SEC));
      let n = 1;
      while (n < sampleRate * RING_SEC) n *= 2;
      this.ring = new Float32Array(n);
      this.mask = n - 1;
      this.f = 0; // the first frame of the next block
      this.lat = 0; // round-trip latency, frames
      this.playFrom = Infinity;
      this.stopAt = Infinity;
      this.tracks = Array.from({ length: tracks }, newTrack);
      this.out = []; // messages for the page, collected while processing
    }

    post(m) { this.out.push(m); }

    // ---------- commands ----------
    // Every command is { op, track?, ... }; frames are absolute AudioContext frames.
    command(m) {
      const t = m.track != null ? this.tracks[m.track] : null;
      switch (m.op) {
        case 'lat': this.lat = Math.max(0, Math.round(m.frames)); break;
        case 'play': this.playFrom = m.at; this.stopAt = Infinity; break;
        case 'stop': this.stopAt = m.at; break;
        case 'shift': for (const tr of this.tracks) if (tr.len) tr.org += m.frames; break;
        case 'rec': this.startRec(m.track, m.from, m.len || 0); break;
        case 'dub': this.startDub(m.track, m.from); break;
        case 'end': this.endSpan(m.track, m.at, !!m.shiftOrg); break;
        case 'undo': this.undo(m.track); break;
        case 'redo': this.redo(m.track); break;
        case 'clear': this.tracks[m.track] = newTrack(); this.post({ op: 'state', track: m.track, ...this.info(m.track) }); break;
        case 'double': this.double(m.track); break;
        case 'fb': t.fb = Math.min(1, Math.max(0, m.value)); break;
        case 'map': t.pend.push({ at: m.at, rev: m.rev, rate: m.rate }); t.pend.sort((a, b) => a.at - b.at); break;
        case 'dump': this.dump(m.track, m.id); break;
        default: break;
      }
    }

    info(i) {
      const t = this.tracks[i];
      return { len: t.len, org: t.org, layers: t.layers.length, redo: t.redo.length, busy: t.span ? t.span.kind : null, rev: t.rev, rate: t.rate };
    }

    startRec(i, from, len) {
      const t = this.tracks[i];
      if (t.len || t.span) return;
      const cap = Math.max(len + this.xfade + 1, Math.round(this.sr * FIRST_CAP_SEC));
      t.span = { kind: 'rec', from, to: len ? from + len : Infinity, lat: this.lat, buf: new Float32Array(cap), done: -Infinity, shiftOrg: false };
      t.redo = [];
      if (len) this.beginLoop(i);
      else this.post({ op: 'state', track: i, ...this.info(i) });
    }

    startDub(i, from) {
      const t = this.tracks[i];
      if (!t.len || t.span) return;
      t.span = { kind: 'dub', from, to: Infinity, lat: this.lat, layer: this.addLayer(t), pass: 0, done: -Infinity };
      t.redo = [];
      this.post({ op: 'state', track: i, ...this.info(i) });
    }

    // A new, silent layer on top. The layers under it keep their gains (feedback applies per pass).
    addLayer(t) {
      const layer = { buf: new Float32Array(t.len), g: 1, gt: 1, prev: t.layers.map((l) => l.gt) };
      t.layers.push(layer);
      if (t.layers.length > MAX_LAYERS) {
        const [a, b] = t.layers;
        const buf = new Float32Array(t.len);
        for (let k = 0; k < t.len; k++) buf[k] = a.buf[k] * a.gt + b.buf[k] * b.gt;
        t.layers.splice(0, 2, { buf, g: 1, gt: 1, prev: [] });
        for (const l of t.layers) if (l.prev.length) l.prev.splice(0, 2, 1);
      }
      return layer;
    }

    // Ends a recording or overdub at frame `at` (which may be in the past; never before it began).
    // shiftOrg (free tempo, the first loop): if `at` has already gone by, start the loop now rather
    // than skip its first moments.
    endSpan(i, at, shiftOrg) {
      const t = this.tracks[i];
      const s = t.span;
      if (!s) return;
      if (s.kind === 'rec') {
        const end = Math.max(at, s.from + this.xfade * 4);
        s.to = end;
        s.shiftOrg = shiftOrg;
        this.beginLoop(i);
      } else {
        s.to = Math.max(at, s.from);
      }
    }

    // The recording's length is known: the loop starts playing at `to` (or now, see endSpan).
    beginLoop(i) {
      const t = this.tracks[i];
      const s = t.span;
      const L = s.to - s.from;
      if (s.buf.length < L + this.xfade) {
        const b = new Float32Array(L + this.xfade);
        b.set(s.buf.subarray(0, Math.min(s.buf.length, b.length)));
        s.buf = b;
      }
      t.len = L;
      const start = s.shiftOrg ? Math.max(s.to, this.f) : s.to;
      t.org = s.from + (start - s.to);
      t.liveFrom = start;
      t.layers = [{ buf: s.buf, g: 1, gt: 1, prev: [] }];
      s.started = true;
      this.post({ op: 'recorded', track: i, len: L, org: t.org, from: s.from });
      this.post({ op: 'state', track: i, ...this.info(i) });
    }

    undo(i) {
      const t = this.tracks[i];
      if (t.span) { // cancel what's in progress
        const s = t.span;
        t.span = null;
        if (s.kind === 'rec') { this.tracks[i] = newTrack(); } else {
          const k = t.layers.indexOf(s.layer);
          if (k >= 0) t.layers.splice(k, 1);
          s.layer.prev.forEach((g, j) => { if (t.layers[j]) t.layers[j].gt = g; });
          // a multi-pass overdub: the passes before this one stay (undo again to remove them)
        }
        this.post({ op: 'state', track: i, ...this.info(i) });
        return;
      }
      if (!t.layers.length) return;
      const layer = t.layers.pop();
      layer.after = t.layers.map((l) => l.gt);
      layer.prev.forEach((g, j) => { if (t.layers[j]) t.layers[j].gt = g; });
      t.redo.push(layer);
      if (!t.layers.length) { // the first recording: the track is empty, but redo can bring it back
        t.redo[t.redo.length - 1].base = { len: t.len, org: t.org };
        t.len = 0;
        t.liveFrom = Infinity;
      }
      this.post({ op: 'state', track: i, ...this.info(i) });
    }

    redo(i) {
      const t = this.tracks[i];
      if (t.span || !t.redo.length) return;
      const layer = t.redo.pop();
      if (layer.base) {
        t.len = layer.base.len;
        t.org = layer.base.org;
        t.liveFrom = this.f;
        delete layer.base;
      }
      (layer.after || []).forEach((g, j) => { if (t.layers[j]) t.layers[j].gt = g; });
      t.layers.push(layer);
      this.post({ op: 'state', track: i, ...this.info(i) });
    }

    // Twice as long, the content repeated: overdub over it to make the second half different.
    double(i) {
      const t = this.tracks[i];
      if (!t.len || t.span) return;
      const L = t.len;
      for (const l of [...t.layers, ...t.redo]) {
        const b = new Float32Array(2 * L);
        b.set(l.buf.subarray(0, L));
        b.set(l.buf.subarray(0, L), L);
        l.buf = b;
      }
      t.len = 2 * L;
      this.post({ op: 'state', track: i, ...this.info(i) });
    }

    dump(i, id) {
      const t = this.tracks[i];
      const data = new Float32Array(t.len);
      for (const l of t.layers) for (let k = 0; k < t.len; k++) data[k] += l.buf[k] * l.gt;
      this.post({ op: 'dump', track: i, id, len: t.len, org: t.org, data });
    }

    // Loop position for frame g under a mapping { rev, rate }: fractional at rate ½.
    pos(t, g, map) {
      let x = (g - t.org) * map.rate;
      x = mod(x, t.len);
      return map.rev ? t.len - 1 - x : x;
    }

    read(t, x) {
      const L = t.len;
      let i0 = Math.floor(x);
      const fr = x - i0;
      i0 = mod(i0, L);
      let s = 0;
      if (fr === 0) { for (const l of t.layers) s += l.buf[i0] * l.g; } else {
        const i1 = i0 + 1 === L ? 0 : i0 + 1;
        for (const l of t.layers) s += (l.buf[i0] * (1 - fr) + l.buf[i1] * fr) * l.g;
      }
      return s;
    }

    // ---------- the audio ----------
    // input: Float32Array (mono), outputs: one Float32Array per track. Frames f .. f + n − 1.
    process(input, outputs) {
      const n = outputs[0].length;
      const f0 = this.f;
      const ring = this.ring;
      const mask = this.mask;
      if (input) for (let k = 0; k < n; k++) ring[(f0 + k) & mask] = input[k];
      else for (let k = 0; k < n; k++) ring[(f0 + k) & mask] = 0;
      const now = f0 + n; // input is known up to (not including) this frame
      const oldest = now - ring.length;
      for (let i = 0; i < this.tracks.length; i++) {
        const t = this.tracks[i];
        if (t.span) this.write(i, t, now, oldest);
      }
      const XF = this.xfade;
      for (let i = 0; i < this.tracks.length; i++) {
        const t = this.tracks[i];
        const out = outputs[i];
        if (!out) continue;
        for (let k = 0; k < n; k++) {
          const g = f0 + k;
          while (t.pend.length && t.pend[0].at <= g) {
            const p = t.pend.shift();
            const nr = p.rev != null ? p.rev : t.rev;
            const nrate = p.rate != null ? p.rate : t.rate;
            if (nr !== t.rev || nrate !== t.rate) {
              t.old = { rev: t.rev, rate: t.rate };
              t.xf = XF;
              t.rev = nr;
              t.rate = nrate;
            }
          }
          const on = t.len > 0 && g >= t.liveFrom && g >= this.playFrom && g < this.stopAt;
          const want = on ? 1 : 0;
          if (t.env !== want) t.env = want > t.env ? Math.min(1, t.env + 1 / XF) : Math.max(0, t.env - 1 / XF);
          if (t.env === 0 || !t.len) { out[k] = 0; continue; }
          for (const l of t.layers) if (l.g !== l.gt) l.g = Math.abs(l.gt - l.g) < 1 / XF ? l.gt : l.g + Math.sign(l.gt - l.g) / XF;
          let s = this.read(t, this.pos(t, g, t));
          if (t.xf > 0) {
            const w = t.xf / XF;
            s = s * (1 - w) + this.read(t, this.pos(t, g, t.old)) * w;
            t.xf--;
          }
          out[k] = s * t.env;
        }
      }
      this.f = now;
      const msgs = this.out;
      this.out = [];
      return msgs;
    }

    // Write the input that has arrived into the recording or overdub, as far as it's known.
    write(i, t, now, oldest) {
      const s = t.span;
      const XF = this.xfade;
      const lat = s.lat;
      const ring = this.ring;
      const mask = this.mask;
      if (s.kind === 'rec') {
        // loop time tl = g − lat; buffer index tl − from, up to L + XF (the run-on for the seam)
        const stop = s.to === Infinity ? Infinity : s.to + XF;
        let g = Math.max(s.from + lat, s.done, oldest);
        const gEnd = Math.min(now, stop + lat);
        if (s.to === Infinity && gEnd - lat - s.from > this.sr * MAX_REC_SEC) {
          this.endSpan(i, s.from + Math.round(this.sr * MAX_REC_SEC), false);
          return;
        }
        for (; g < gEnd; g++) {
          const idx = g - lat - s.from;
          if (idx >= s.buf.length) {
            if (s.to !== Infinity) break;
            const b = new Float32Array(s.buf.length * 2);
            b.set(s.buf);
            s.buf = b;
            if (t.layers.length) t.layers[0].buf = b;
          }
          s.buf[idx] = ring[g & mask];
        }
        s.done = Math.max(s.done, gEnd);
        if (s.to !== Infinity && s.done >= s.to + XF + lat) this.finishRec(i, t);
        return;
      }
      // overdub: fade in from `from`, fade out after `to`; a new layer every pass when feedback < 1
      const L = t.len;
      if (!s.faded) { // feedback applies from the first pass, as in SooperLooper
        s.faded = true;
        if (t.fb < 1) for (const l of t.layers) if (l !== s.layer) l.gt *= t.fb;
      }
      const stop = s.to === Infinity ? Infinity : s.to + XF;
      let g = Math.max(s.from + lat, s.done, oldest);
      const gEnd = Math.min(now, stop + lat);
      for (; g < gEnd; g++) {
        const tl = g - lat;
        const since = tl - s.from;
        const pass = Math.floor(since / L);
        if (pass > s.pass && tl < s.to) {
          s.pass = pass;
          if (t.fb < 1) {
            const fresh = this.addLayer(t);
            for (const l of t.layers) if (l !== fresh) l.gt *= t.fb;
            s.layer = fresh;
          }
        }
        let w = 1;
        if (since < XF) w = since / XF;
        if (tl >= s.to) w = Math.min(w, 1 - (tl - s.to) / XF);
        const x = this.pos(t, tl, t);
        const k = mod(Math.round(x), L);
        s.layer.buf[k] += ring[g & mask] * w;
      }
      s.done = Math.max(s.done, gEnd);
      if (s.to !== Infinity && s.done >= s.to + XF + lat) {
        t.span = null;
        this.post({ op: 'state', track: i, ...this.info(i) });
      }
    }

    // Close the seam: crossfade the run-on past the end into the loop's first XF samples.
    // Wait while those samples are being played (the first repeat starts while the tail is still
    // arriving), so the change can't be heard as a jump.
    finishRec(i, t) {
      const s = t.span;
      const XF = this.xfade;
      const L = t.len;
      const x = this.pos(t, this.f, t);
      if (this.f >= t.liveFrom && x < XF) return;
      const b = s.buf;
      for (let k = 0; k < XF; k++) {
        const w = k / XF;
        b[k] = b[k] * w + b[L + k] * (1 - w);
      }
      t.layers[0].buf = b.slice(0, L);
      t.span = null;
      this.post({ op: 'state', track: i, ...this.info(i) });
    }
  }

  const api = { LoopCore, XFADE_SEC };
  root.LoopCoreLib = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

  // ---------- the AudioWorklet ----------
  if (typeof registerProcessor === 'function' && typeof AudioWorkletProcessor === 'function') {
    class LooperProcessor extends AudioWorkletProcessor {
      constructor(options) {
        super();
        const tracks = (options && options.numberOfOutputs) || 4;
        this.core = new LoopCore({ sampleRate, tracks }); // eslint-disable-line no-undef
        this.core.f = currentFrame; // eslint-disable-line no-undef
        this.mono = new Float32Array(128);
        this.port.onmessage = (e) => { for (const m of [].concat(e.data || [])) this.core.command(m); };
      }

      process(inputs, outputs) {
        const chans = inputs[0];
        let x = null;
        if (chans && chans.length) {
          x = chans[0];
          if (chans.length > 1) {
            if (this.mono.length !== x.length) this.mono = new Float32Array(x.length);
            for (let k = 0; k < x.length; k++) {
              let s = 0;
              for (let c = 0; c < chans.length; c++) s += chans[c][k];
              this.mono[k] = s / chans.length;
            }
            x = this.mono;
          }
        }
        this.core.f = currentFrame; // eslint-disable-line no-undef
        const outs = outputs.map((o) => o[0]);
        const msgs = this.core.process(x, outs);
        for (const o of outputs) for (let c = 1; c < o.length; c++) o[c].set(o[0]);
        for (const m of msgs) {
          if (m.op === 'dump') this.port.postMessage(m, [m.data.buffer]);
          else this.port.postMessage(m);
        }
        return true;
      }
    }
    registerProcessor('looper', LooperProcessor);
  }
})(typeof window !== 'undefined' ? window : globalThis);
