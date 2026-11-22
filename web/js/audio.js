// Web Audio plumbing: the input (a mic or a USB audio interface) → analyser → NoteTracker loop,
// the output device, the metronome, and a plucked-string synth for the clickable fretboard.
(function (root) {
  'use strict';
  const { NoteTracker, linToDb, dbToLin, refinePitch, NORMAL, QUIET } = root.Pitch;

  class AudioEngine {
    constructor() {
      this.ctx = null;
      this.stream = null;
      this.micSource = null;
      this.handlers = { frame: new Set(), note: new Set(), onset: new Set(), timbre: new Set(), tune: new Set() };
      this.noteId = 0;
      this.measuring = null; // the note whose sound is waiting to be measured (string detection)
      this.onsetNode = null;
      this.looping = false;
      this.pluckCache = new Map();
      this.metro = null;
      this.clickVolume = 0.7;
      this.channel = 'both'; // which input channel to listen to: both | left | right
      this.outputId = ''; // output device ('' = the system default)
      this.splitter = null;
      this.precise = false; // the precise tuner: emits 'tune' readings while on
      this.quiet = false; // a quiet guitar (an unplugged electric): see setQuiet
      this.tuneClarity = NORMAL.clarity;
      this.tick = 0;
    }

    on(type, fn) { this.handlers[type].add(fn); return () => this.handlers[type].delete(fn); }
    emit(type, v) { for (const fn of this.handlers[type]) fn(v); }
    now() { return this.ctx ? this.ctx.currentTime : performance.now() / 1000; }
    get micOn() { return !!this.stream; }

    // Create (or resume) the AudioContext. Call from a user gesture: everything up to the first
    // await runs inside the gesture, which iOS Safari and Chrome on Android need to start audio.
    async init() {
      setSession(this.stream ? 'play-and-record' : 'playback');
      if (!this.ctx) {
        const Ctx = root.AudioContext || root.webkitAudioContext;
        try { this.ctx = new Ctx({ latencyHint: 'interactive' }); } catch { this.ctx = new Ctx(); } // old Safari takes no options
        const ctx = this.ctx;
        watchContext(ctx);
        // ~42 ms frames at 44.1/48 kHz; larger at higher rates so the low strings still fit twice.
        const decim = Math.max(1, Math.round(ctx.sampleRate / 24000));
        this.frameSize = 2 ** Math.ceil(Math.log2(1024 * decim));
        this.input = ctx.createGain();
        // Pitch detection listens to pitchIn: the input itself, or (quiet mode) a filtered, boosted copy.
        this.pitchIn = ctx.createGain();
        this.quietChain = [
          Object.assign(ctx.createBiquadFilter(), { type: 'highpass' }),
          Object.assign(ctx.createBiquadFilter(), { type: 'lowpass' }),
          Object.assign(ctx.createBiquadFilter(), { type: 'lowpass' }),
        ];
        this.quietChain[0].frequency.value = QUIET.highpass;
        this.quietChain[1].frequency.value = QUIET.lowpass;
        this.quietChain[2].frequency.value = QUIET.lowpass;
        this.quietChain.reduce((a, b) => a.connect(b));
        this.quietBoost = ctx.createGain();
        this.quietBoost.gain.value = dbToLin(QUIET.boostDb); // so the gate and the meter keep their range
        this.quietChain[2].connect(this.quietBoost);
        this.analyser = ctx.createAnalyser();
        this.analyser.fftSize = this.frameSize;
        this.analyser.smoothingTimeConstant = 0;
        this.pitchIn.connect(this.analyser);
        // Some browsers only pull audio through nodes that reach the destination.
        const sink = ctx.createGain();
        sink.gain.value = 0;
        this.analyser.connect(sink).connect(ctx.destination);
        this.out = ctx.createGain();
        this.out.connect(ctx.destination);
        this.buf = new Float32Array(this.frameSize);
        // String detection (js/stringid.js, if the page loads it): the last ~0.7 s of raw input, so
        // each note's sound can be measured once it has rung for a moment.
        if (root.StringId) {
          this.rec = ctx.createAnalyser();
          this.rec.fftSize = 32768;
          this.rec.smoothingTimeConstant = 0;
          this.input.connect(this.rec);
          this.rec.connect(sink);
          this.recBuf = new Float32Array(this.rec.fftSize);
        }
        this.tracker = new NoteTracker({ sampleRate: ctx.sampleRate, frameSize: this.frameSize });
        this.wireQuiet();
      }
      const resumed = unlock(this.ctx); // synchronous part first, while the gesture still counts
      if (this.outputId && !this.sinkSet) { this.sinkSet = true; await this.setOutput(this.outputId).catch(() => {}); }
      await resumed;
    }

    async enableMic(deviceId) {
      await this.init();
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error(root.isSecureContext === false
        ? 'The browser only opens the microphone on https or localhost. On a phone or tablet, open the app from the https address that tools/serve-https.py prints (see the README).'
        : 'This browser can’t open the microphone. Use a current Chrome, Edge, Firefox or Safari.');
      }
      this.disableMic();
      // Echo cancellation, noise suppression and auto gain all treat a sustained note as noise: turn them off.
      // Ask for both channels: an audio interface often has the guitar on only one of them.
      const audio = { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: { ideal: 2 } };
      if (deviceId) audio.deviceId = { exact: deviceId };
      setSession('play-and-record'); // iOS: record and keep playing through the speaker
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({ audio });
      } catch (err) {
        setSession('playback');
        throw err;
      }
      // Opening the mic can switch the hardware's rate or audio route and leave the context
      // suspended or "interrupted" on iOS: start it again.
      await unlock(this.ctx);
      this.micSource = this.ctx.createMediaStreamSource(this.stream);
      this.routeInput(this.channel);
      this.tracker.reset();
      this.startLoop();
    }

    // Listen to both channels (mixed), or only the left (input 1) or right (input 2).
    routeInput(channel) {
      this.channel = channel;
      if (!this.micSource) return;
      this.micSource.disconnect();
      if (this.splitter) this.splitter.disconnect();
      if (channel === 'left' || channel === 'right') {
        if (!this.splitter) this.splitter = this.ctx.createChannelSplitter(2);
        this.micSource.connect(this.splitter);
        this.splitter.connect(this.input, channel === 'left' ? 0 : 1);
      } else {
        this.micSource.connect(this.input);
      }
    }

    // The open input: its label and channel count (null when the browser doesn't say).
    inputInfo() {
      const track = this.stream && this.stream.getAudioTracks()[0];
      if (!track) return null;
      const st = track.getSettings ? track.getSettings() : {};
      return { label: track.label || '', channels: st.channelCount || null, sampleRate: st.sampleRate || null };
    }

    // Output device. Only Chromium browsers can choose one per page (AudioContext.setSinkId);
    // elsewhere the page plays through the system's output.
    get canPickOutput() {
      const Ctx = root.AudioContext || root.webkitAudioContext;
      return !!(Ctx && Ctx.prototype && 'setSinkId' in Ctx.prototype);
    }

    async setOutput(id) {
      this.outputId = id || '';
      if (this.ctx && this.ctx.setSinkId) await this.ctx.setSinkId(this.outputId);
    }

    async listOutputs() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return [];
      const all = await navigator.mediaDevices.enumerateDevices();
      return all.filter((d) => d.kind === 'audiooutput' && d.deviceId && d.deviceId !== 'default' && d.deviceId !== 'communications');
    }

    disableMic() {
      if (this.splitter) this.splitter.disconnect();
      if (this.micSource) this.micSource.disconnect();
      if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
      this.micSource = null;
      this.stream = null;
      setSession('playback');
    }

    currentDeviceId() {
      const track = this.stream && this.stream.getAudioTracks()[0];
      return track ? track.getSettings().deviceId : null;
    }

    async listInputs() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return [];
      const all = await navigator.mediaDevices.enumerateDevices();
      return all.filter((d) => d.kind === 'audioinput');
    }

    // Analysis runs on a ~100 Hz timer rather than animation frames, which browsers throttle
    // (low-power mode, some embedded views) and which would make attacks harder to see.
    startLoop() {
      if (this.looping) return;
      this.looping = true;
      this.loopTimer = setInterval(() => {
        this.analyser.getFloatTimeDomainData(this.buf);
        const info = this.tracker.process(this.buf, this.ctx.currentTime);
        this.emit('frame', info);
        if (info.event) {
          info.event.id = ++this.noteId;
          if (this.rec) this.queueTimbre(info.event);
          this.emit('note', info.event);
        }
        if (this.measuring && this.ctx.currentTime >= this.measuring.until) this.measureTimbre();
        if (this.precise && info.freq && ++this.tick % 3 === 0) this.measureTune(info);
      }, 10);
    }

    // Quiet mode, for a guitar the mic can barely hear (an unplugged electric, a tablet across the
    // room). Room hiss covers the whole spectrum while the strings sit between ~80 Hz and ~1.5 kHz, so
    // the pitch detectors get a band-passed copy (70 Hz–1.5 kHz, which cuts most of the hiss), boosted
    // 20 dB. They also accept a noisier pitch, and the precise tuner looks at twice as much sound.
    // Timing (onsets) and string detection keep the untouched input.
    setQuiet(on) {
      this.quiet = !!on;
      if (this.ctx) this.wireQuiet();
    }

    wireQuiet() {
      try { this.input.disconnect(this.pitchIn); } catch { /* wasn't connected */ }
      try { this.input.disconnect(this.quietChain[0]); } catch { /* wasn't connected */ }
      try { this.quietBoost.disconnect(); } catch { /* wasn't connected */ }
      if (this.quiet) {
        this.input.connect(this.quietChain[0]);
        this.quietBoost.connect(this.pitchIn);
      } else {
        this.input.connect(this.pitchIn);
      }
      const p = this.quiet ? QUIET : NORMAL;
      this.tracker.maxCmnd = p.maxCmnd;
      this.tuneClarity = p.clarity;
      if (this.tuneAn) { this.tuneAn.disconnect(); this.tuneAn = null; }
      if (this.precise) this.setPrecise(true);
      this.tracker.reset();
    }

    // The precise tuner: on, it reads the last ~170 ms of raw input about 33 times a second while a
    // pitch is heard and emits 'tune' { t, freq, clarity, attackT, db }, to a hundredth of a cent on a clean note.
    setPrecise(on) {
      this.precise = !!on;
      if (!this.precise || this.tuneAn || !this.ctx) return;
      const n = 2 ** Math.ceil(Math.log2(this.ctx.sampleRate * (this.quiet ? QUIET : NORMAL).tuneSecs));
      this.tuneAn = this.ctx.createAnalyser();
      this.tuneAn.fftSize = Math.min(32768, n);
      this.tuneAn.smoothingTimeConstant = 0;
      this.pitchIn.connect(this.tuneAn);
      const sink = this.ctx.createGain();
      sink.gain.value = 0;
      this.tuneAn.connect(sink).connect(this.ctx.destination);
      this.tuneBuf = new Float32Array(this.tuneAn.fftSize);
    }

    // "Strum all six" (js/polytune.js): the last 32768 samples (~0.7 s) of what pitch detection hears,
    // for one spectrum of the whole strum (32768 is an analyser's limit: at 88.2/96 kHz it's ~0.35 s,
    // coarser but still within a few cents). readStrum() returns { x, sampleRate }.
    setStrum(on) {
      if (!on || this.strumAn || !this.ctx) return;
      this.strumAn = this.ctx.createAnalyser();
      this.strumAn.fftSize = 32768;
      this.strumAn.smoothingTimeConstant = 0;
      this.pitchIn.connect(this.strumAn);
      const sink = this.ctx.createGain();
      sink.gain.value = 0;
      this.strumAn.connect(sink).connect(this.ctx.destination);
      this.strumBuf = new Float32Array(32768);
    }

    get strumSeconds() { return this.ctx ? 32768 / this.ctx.sampleRate : 0.7; }

    readStrum() {
      if (!this.strumAn) this.setStrum(true);
      if (!this.strumAn) return null;
      this.strumAn.getFloatTimeDomainData(this.strumBuf);
      return { x: this.strumBuf, sampleRate: this.ctx.sampleRate };
    }

    measureTune(info) {
      if (!this.tuneAn) this.setPrecise(true);
      this.tuneAn.getFloatTimeDomainData(this.tuneBuf);
      const r = refinePitch(this.tuneBuf, this.ctx.sampleRate, info.freq);
      if (r && r.clarity > this.tuneClarity) this.emit('tune', { t: info.t, freq: r.freq, clarity: r.clarity, attackT: this.tracker.lastOnsetT, db: info.db });
    }

    // String detection: measure a note's sound from 30 ms after its attack (past the pick's noise) for
    // up to 170 ms, or until the next note starts. Emits 'timbre' { id, midi, feat } where feat is
    // StringId.analyze()'s result, or null when the note was too short or unclear.
    queueTimbre(ev) {
      if (this.measuring) {
        this.measuring.until = Math.min(this.measuring.until, ev.playedAt - 0.01);
        this.measureTimbre();
      }
      const from = ev.playedAt + 0.03;
      this.measuring = { ev, from, until: from + 0.17 };
    }

    measureTimbre() {
      const m = this.measuring;
      this.measuring = null;
      const sr = this.ctx.sampleRate;
      const now = this.ctx.currentTime;
      const until = Math.min(m.until, now);
      let feat = null;
      const n = Math.floor((until - m.from) * sr);
      const back = Math.round((now - m.from) * sr); // samples from the start of the window to now
      if (n >= 0.04 * sr && back <= this.recBuf.length) {
        this.rec.getFloatTimeDomainData(this.recBuf);
        const i0 = this.recBuf.length - back;
        feat = root.StringId.analyze(this.recBuf.subarray(i0, i0 + n), sr, m.ev.freq);
      }
      this.emit('timbre', { id: m.ev.id, midi: m.ev.midi, feat });
    }

    // Pick-attack detection in an AudioWorklet (js/onset.js): every attack, pitched or not (a strum, a
    // muted chuck, a palm-muted chug), timed to about a millisecond on the AudioContext clock. Emits
    // 'onset' events { t, db, strength }. `url` is the worklet module, relative to the page.
    async enableOnsets(url = 'js/onset.js') {
      await this.init();
      if (this.onsetNode) return;
      const ctx = this.ctx;
      if (!ctx.audioWorklet || typeof AudioWorkletNode === 'undefined') {
        throw new Error('This browser can’t run the timing detector (no AudioWorklet). Use a current Chrome, Edge, Firefox or Safari.');
      }
      await ctx.audioWorklet.addModule(url);
      const node = new AudioWorkletNode(ctx, 'onset-detector', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
      node.port.onmessage = (e) => { for (const o of (e.data && e.data.onsets) || []) this.emit('onset', o); };
      this.input.connect(node);
      const sink = ctx.createGain(); // silent, but keeps the node pulled in every browser
      sink.gain.value = 0;
      node.connect(sink).connect(ctx.destination);
      this.onsetNode = node;
    }

    // Detector settings: { gateDb, threshold, refractory, reset }.
    setOnsetParams(p) { if (this.onsetNode) this.onsetNode.port.postMessage(p); }

    // Average input level over `seconds`, in dBFS: used to set the noise gate above the room's hiss.
    measureNoise(seconds = 0.6) {
      return new Promise((resolve) => {
        const levels = [];
        const off = this.on('frame', (f) => levels.push(f.rms));
        setTimeout(() => {
          off();
          levels.sort((a, b) => a - b);
          resolve(linToDb(levels[Math.floor(levels.length * 0.6)] || 0));
        }, seconds * 1000);
      });
    }

    // Plucked-string tone (Karplus–Strong) for on-screen playing.
    pluck(midi, when = 0) {
      if (!this.ctx) return;
      const ctx = this.ctx;
      let buffer = this.pluckCache.get(midi);
      if (!buffer) {
        const sr = ctx.sampleRate;
        const freq = 440 * 2 ** ((midi - 69) / 12);
        const p = Math.max(2, Math.round(sr / freq - 0.5)); // the averaging filter adds half a sample
        const len = Math.floor(sr * 1.8);
        buffer = ctx.createBuffer(1, len, sr);
        const data = buffer.getChannelData(0);
        const ring = new Float32Array(p);
        let prev = 0;
        for (let i = 0; i < p; i++) { prev = 0.6 * prev + 0.4 * (Math.random() * 2 - 1); ring[i] = prev; }
        const decay = 0.996 - Math.min(0.006, freq / 200000);
        for (let i = 0; i < len; i++) {
          const k = i % p;
          const out = ring[k];
          ring[k] = decay * 0.5 * (ring[k] + ring[(k + 1) % p]);
          data[i] = out * Math.min(1, (len - i) / (sr * 0.05));
        }
        this.pluckCache.set(midi, buffer);
      }
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const g = ctx.createGain();
      g.gain.value = 0.55;
      src.connect(g).connect(this.out);
      src.start(when || ctx.currentTime);
    }

    // A woodblock-like noise click. Unpitched on purpose, so the note detector ignores it.
    // dest: where it plays (a page can route clicks through its own gain to silence them at once).
    click(when, accent = false, dest = this.out) {
      const ctx = this.ctx;
      if (!this.clickBuffer) {
        const sr = ctx.sampleRate;
        const len = Math.floor(sr * 0.03);
        this.clickBuffer = ctx.createBuffer(1, len, sr);
        const d = this.clickBuffer.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sr * 0.005));
      }
      const src = ctx.createBufferSource();
      src.buffer = this.clickBuffer;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = accent ? 3200 : 2200;
      bp.Q.value = 1.2;
      const g = ctx.createGain();
      g.gain.value = (accent ? 1.6 : 1.0) * this.clickVolume * 2.5;
      src.connect(bp).connect(g).connect(dest);
      src.start(when);
    }

    // Lookahead scheduler. onBeat(i, time) fires a little before each beat with its exact audio time.
    startMetronome({ bpm, startAt, accentEvery = 4, onBeat }) {
      this.stopMetronome();
      const beat = 60 / bpm;
      const m = { beat, startAt, next: 0 };
      const tick = () => {
        const horizon = this.ctx.currentTime + 0.12;
        while (startAt + m.next * beat < horizon) {
          const t = startAt + m.next * beat;
          if (this.clickVolume > 0) this.click(t, m.next % accentEvery === 0);
          if (onBeat) onBeat(m.next, t);
          m.next++;
        }
      };
      tick();
      m.timer = setInterval(tick, 25);
      this.metro = m;
      return m;
    }

    stopMetronome() {
      if (this.metro) clearInterval(this.metro.timer);
      this.metro = null;
    }
  }

  // ---------- mobile audio ----------
  // iOS Safari: Web Audio is silent with the ring/silent switch on and doesn't start outside a tap;
  // the context also stops ("interrupted") after a call, Siri, or a trip to the home screen.
  // Chrome on Android also needs a tap to start audio.

  // The audio session type (Safari 16.4+): 'playback' plays even with the silent switch on,
  // 'play-and-record' does too while the mic is open.
  function setSession(type) {
    try { if (navigator.audioSession && navigator.audioSession.type !== type) navigator.audioSession.type = type; } catch { /* not supported */ }
  }

  // Older iOS has no audioSession: a looping silent <audio> element moves the page into the media
  // category, which ignores the silent switch. Started once, from a tap.
  let silentEl = null;
  function silentMediaKick() {
    if (silentEl || navigator.audioSession || !/iP(hone|ad|od)|Macintosh/.test(navigator.userAgent) || !('ontouchend' in document)) return;
    const n = 4410;
    const bytes = new Uint8Array(44 + n * 2);
    const v = new DataView(bytes.buffer);
    const str = (o, t) => { for (let i = 0; i < t.length; i++) bytes[o + i] = t.charCodeAt(i); };
    str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVEfmt '); v.setUint32(16, 16, true);
    v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 44100, true); v.setUint32(28, 88200, true);
    v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, n * 2, true);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    silentEl = document.createElement('audio');
    silentEl.setAttribute('x-webkit-airplay', 'deny');
    silentEl.preload = 'auto';
    silentEl.loop = true;
    silentEl.src = `data:audio/wav;base64,${btoa(bin)}`;
    const p = silentEl.play();
    if (p && p.catch) p.catch(() => { silentEl = null; });
  }

  // Start (or restart) the context. Call from a gesture; the sync part (resume() and the silent
  // one-sample buffer, the classic iOS unlock) must run before any await.
  function unlock(ctx) {
    if (!ctx) return Promise.resolve();
    silentMediaKick();
    if (ctx.state === 'running') return Promise.resolve();
    try {
      const src = ctx.createBufferSource();
      src.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      src.connect(ctx.destination);
      src.start(0);
    } catch { /* closed */ }
    const p = ctx.resume ? ctx.resume() : null;
    // resume() can hang on iOS while another app holds the audio: don't block the page on it.
    return Promise.race([Promise.resolve(p).catch(() => {}), new Promise((r) => setTimeout(r, 800))]);
  }

  // Any later tap, or coming back to the page, restarts a context the system stopped.
  const contexts = new Set();
  let listening = false;
  function watchContext(ctx) {
    contexts.add(ctx);
    if (listening) return;
    listening = true;
    const kick = () => { for (const c of contexts) if (c.state !== 'running' && c.state !== 'closed') unlock(c); };
    for (const type of ['pointerdown', 'touchend', 'keydown']) document.addEventListener(type, kick, { capture: true, passive: true });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });
    root.addEventListener('pageshow', kick);
  }

  root.AudioEngine = AudioEngine;
})(window);
