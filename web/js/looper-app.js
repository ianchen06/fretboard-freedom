// UI controller for the Looper (looper.html): the transport (tempo, count-in, click, drums), four
// tracks (record, overdub, undo/redo, reverse, ½×/2×, ×2, fade, mute/solo, volume, pan, echo, room),
// the input (record level, monitoring through an amp), the timing offset, the key and scale
// suggestions for the loops, and the WAV download.
//
// The loops themselves are recorded and played by js/looper-worklet.js; this file tells it when, in
// exact frames on the AudioContext clock. Quantizing, the grooves and the key finding are in
// js/looper.js. Settings are kept in this browser under ff.looper; the loops are not (they live in
// the tab until it's closed).
(function () {
  'use strict';
  const LP = window.Looper;
  const T = window.Theory;
  const S = window.Scales;
  const BL = window.BandLib;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const mod = (a, n) => ((a % n) + n) % n;
  const TRACKS = 4;
  const COLORS = ['#14b8a6', '#f5a524', '#3b82f6', '#a855f7'];

  // ---------- settings ----------
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode: nothing is remembered */ }
    },
  };
  const trackDefaults = () => ({ vol: 80, pan: 0, echo: 0, room: 20, fb: 1 });
  const saved = store.get('ff.looper', {});
  const settings = {
    bpm: 90, beats: 4, mode: 'tempo', length: 0, after: 'play', countIn: true, click: false, drums: 'off', beatVol: 60,
    monitor: false, tone: 'clean', recDb: 0, latMs: null, box: 1,
    ...saved,
  };
  settings.tracks = Array.from({ length: TRACKS }, (_, i) => ({ ...trackDefaults(), ...((saved.tracks || [])[i] || {}) }));
  const save = () => store.set('ff.looper', settings);

  // ---------- audio ----------
  const engine = new window.AudioEngine();
  let G = null; // the audio graph, made on the first tap
  let sr = 48000;
  const fr = (sec) => Math.round(sec * sr);
  const outLat = () => (engine.ctx ? engine.ctx.outputLatency || engine.ctx.baseLatency || 0 : 0);
  // "Now" as you hear it: the frame the speakers are playing.
  const heardFrame = () => fr(engine.ctx.currentTime - outLat());

  // The round trip (see looper-worklet.js): set here, else measured on the Rhythm page, else estimated.
  function latency() {
    if (settings.latMs != null) return { ms: settings.latMs, how: 'here' };
    const r = store.get('ff.rhythm', {}).lat;
    if (r && r.ms != null) return { ms: r.ms, how: r.how === 'loop' ? 'loopback' : r.how === 'play' ? 'playing' : 'hand', from: 'rhythm' };
    const est = engine.ctx ? (engine.ctx.outputLatency || engine.ctx.baseLatency || 0.01) + 0.015 : 0.03;
    return { ms: Math.round(est * 1000), how: 'estimate' };
  }
  const post = (m) => { if (G) G.node.port.postMessage(m); };
  const sendLat = () => post({ op: 'lat', frames: fr(latency().ms / 1000) });

  // The mix: track inputs → volume → pan → master, with sends to a tempo-synced echo and a room.
  // Built the same way live and for the download (an OfflineAudioContext).
  function buildMix(ctx, out) {
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -8;
    comp.knee.value = 6;
    comp.ratio.value = 10;
    comp.attack.value = 0.003;
    comp.release.value = 0.15;
    const master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(comp).connect(out);
    const room = ctx.createConvolver();
    room.buffer = BL.renderRoom(ctx, 2.4);
    const roomRet = ctx.createGain();
    roomRet.gain.value = 0.45;
    room.connect(roomRet).connect(master);
    const delay = ctx.createDelay(4);
    const fbk = ctx.createGain();
    fbk.gain.value = 0.38;
    const dl = BL.biquad(ctx, 'lowpass', 3200, 0.7);
    const dh = BL.biquad(ctx, 'highpass', 180, 0.7);
    delay.connect(dl).connect(dh).connect(fbk).connect(delay);
    const delayRet = ctx.createGain();
    delayRet.gain.value = 0.6;
    dh.connect(delayRet).connect(master);
    const delayRoom = ctx.createGain();
    delayRoom.gain.value = 0.3;
    delayRet.connect(delayRoom).connect(room);
    const trk = [];
    for (let i = 0; i < TRACKS; i++) {
      const inp = ctx.createGain();
      const vol = ctx.createGain();
      const pan = ctx.createStereoPanner();
      const echo = ctx.createGain();
      const rm = ctx.createGain();
      inp.connect(vol).connect(pan).connect(master);
      pan.connect(echo).connect(delay);
      pan.connect(rm).connect(room);
      trk.push({ inp, vol, pan, echo, rm });
    }
    const drumBus = ctx.createGain();
    drumBus.connect(master);
    const drumRoom = ctx.createGain();
    drumRoom.gain.value = 0.12;
    drumBus.connect(drumRoom).connect(room);
    const clickBus = ctx.createGain();
    clickBus.connect(out);
    return { master, trk, delay, drumBus, clickBus };
  }

  // Volume 0–100 (80 = as recorded), squared so the slider feels even.
  const volGain = (v) => (v / 80) ** 2;
  const sendGain = (v) => (v / 100) ** 2;

  function applyTrackMix(mix, i, live = true) {
    const s = settings.tracks[i];
    const tr = tracks[i];
    const anySolo = tracks.some((t) => t.solo);
    const on = !tr.mute && (!anySolo || tr.solo);
    const set = (param, v) => { if (live) param.setTargetAtTime(v, engine.ctx.currentTime, 0.015); else param.value = v; };
    const m = mix.trk[i];
    set(m.vol.gain, on ? volGain(s.vol) : 0);
    set(m.pan.pan, s.pan / 100);
    set(m.echo.gain, sendGain(s.echo));
    set(m.rm.gain, sendGain(s.room));
  }

  // An echo of a dotted 8th (¾ of a beat), the classic rhythmic delay; in Free mode, 3/16 of the
  // first loop. Clamped to what the delay line holds.
  function echoTime() {
    if (settings.mode === 'tempo' || !grid) return clamp((0.75 * 60) / settings.bpm, 0.05, 3.9);
    return clamp((grid.cyc / sr) * (3 / 16), 0.05, 3.9);
  }

  async function ensureAudio() {
    await engine.init();
    if (G) return G;
    const ctx = engine.ctx;
    sr = ctx.sampleRate;
    if (!ctx.audioWorklet || typeof AudioWorkletNode === 'undefined') {
      throw new Error('This browser can’t run the looper (no AudioWorklet). Use a current Chrome, Edge, Firefox or Safari.');
    }
    await ctx.audioWorklet.addModule('js/looper-worklet.js?v=1');
    const node = new AudioWorkletNode(ctx, 'looper', {
      numberOfInputs: 1, numberOfOutputs: TRACKS, outputChannelCount: Array(TRACKS).fill(1),
      channelCount: 1, channelCountMode: 'explicit', channelInterpretation: 'speakers',
    });
    const mix = buildMix(ctx, engine.out);
    for (let i = 0; i < TRACKS; i++) node.connect(mix.trk[i].inp, i);
    // input → record level → [amp] → recBus → the looper (and, if monitoring, the mix)
    const inGain = ctx.createGain();
    engine.input.connect(inGain);
    const recBus = ctx.createGain();
    recBus.connect(node);
    const monitor = ctx.createGain();
    monitor.gain.value = 0;
    recBus.connect(monitor).connect(mix.master);
    const amps = {
      clean: BL.makeAmp(ctx, { drive: 1.3, mid: 1, level: 0.9 }),
      crunch: BL.makeAmp(ctx, { drive: 3.5, mid: 3, level: 0.6 }),
      lead: BL.makeAmp(ctx, { drive: 9, mid: 4, level: 0.45 }),
    };
    for (const a of Object.values(amps)) a.output.connect(recBus);
    const drums = {};
    for (const [k, d] of Object.entries(BL.renderDrums(sr))) {
      const b = ctx.createBuffer(1, d.length, sr);
      b.copyToChannel(d, 0);
      drums[k] = b;
    }
    node.port.onmessage = (e) => onWorklet(e.data);
    G = { node, mix, inGain, recBus, monitor, amps, drums, route: null };
    for (let i = 0; i < TRACKS; i++) applyTrackMix(mix, i);
    mix.delay.delayTime.value = echoTime();
    applyRecLevel();
    applyMonitor();
    applyBeatVol();
    sendLat();
    renderLat();
    return G;
  }

  function applyRecLevel() {
    $('lpRecDb').value = settings.recDb;
    $('lpRecDbVal').textContent = `${settings.recDb > 0 ? '+' : ''}${settings.recDb} dB`;
    if (G) G.inGain.gain.setTargetAtTime(10 ** (settings.recDb / 20), engine.ctx.currentTime, 0.02);
  }

  // Monitoring: only for an interface. A mic would hear the speakers and feed back.
  function applyMonitor() {
    const kind = engine.micOn ? mic.inputKind() : null;
    const allowed = kind && kind !== 'mic';
    const on = settings.monitor && allowed;
    $('lpMonitor').checked = settings.monitor;
    setSeg('lpToneSeg', settings.tone);
    $('lpToneSeg').classList.toggle('dim', !on);
    $('lpMonitorNote').innerHTML = settings.monitor && engine.micOn && !allowed
      ? 'That input looks like a microphone, so monitoring stays off: the mic would hear the speakers and feed back.'
      : settings.monitor && !engine.micOn ? 'Turns on when an audio interface is the input.'
        : on ? 'The loops record what you hear: with an amp, they keep its tone.'
          : 'Off: the loops record your guitar as it comes in. Turn it on to play through the page’s amp (and record its tone).';
    if (!G) return;
    const route = on && settings.tone !== 'dry' ? settings.tone : 'dry';
    if (G.route !== route) {
      try { G.inGain.disconnect(); } catch { /* not connected */ }
      if (route === 'dry') G.inGain.connect(G.recBus);
      else G.inGain.connect(G.amps[route].input);
      G.route = route;
    }
    G.monitor.gain.setTargetAtTime(on ? 1 : 0, engine.ctx.currentTime, 0.02);
  }

  function applyBeatVol() {
    $('lpBeatVol').value = settings.beatVol;
    engine.clickVolume = (settings.beatVol / 100) * 0.7;
    if (G) G.mix.drumBus.gain.setTargetAtTime(0.9 * (settings.beatVol / 100) ** 1.5, engine.ctx.currentTime, 0.02);
  }

  // ---------- state ----------
  // grid: { t0, cyc } in frames: bar lines (Tempo) or the first loop's length (Free).
  let grid = null;
  let running = false;
  let countInUntil = 0; // frame
  let sel = 0;
  const tracks = Array.from({ length: TRACKS }, () => ({
    info: { len: 0, org: 0, layers: 0, redo: 0, busy: null, rev: false, rate: 1 },
    rec: null, // { from, to } frames, while recording a new loop
    dubFrom: null,
    pendDub: null, // overdub as soon as the recording closes (frame)
    mute: false, solo: false,
    data: null, pcp: null, rms: 0, // the last dump (the loop's mix of layers) and its analysis
    clearArm: 0,
  }));
  const barFrames = () => fr((settings.beats * 60) / settings.bpm);
  const anyLoop = () => tracks.some((t) => t.info.len > 0 || t.rec);

  // What a track is doing, as the player sees it: empty | armed | rec | play | dub | stopped
  function stateOf(i) {
    const t = tracks[i];
    if (!G) return 'empty';
    const now = heardFrame();
    if (t.rec && (!t.rec.to || now < t.rec.to)) return now < t.rec.from ? 'armed' : 'rec';
    if (t.info.busy === 'dub') return 'dub';
    if (t.info.len > 0) return running ? 'play' : 'stopped';
    return 'empty';
  }

  function onWorklet(m) {
    const t = tracks[m.track];
    if (m.op === 'state') {
      const was = t.info.busy;
      const lenWas = t.data ? t.data.length : 0;
      delete m.rev; // the page sets reverse and speed (they take effect on a beat; the worklet's
      delete m.rate; // own copy can lag behind until then)
      Object.assign(t.info, m);
      if (m.busy !== 'rec') t.rec = null;
      if (!m.busy) {
        if (t.pendDub != null && t.info.len) {
          post({ op: 'dub', track: m.track, from: t.pendDub });
          t.pendDub = null;
        }
        if (t.info.len && (was || m.layers !== t.lastLayers || m.len !== lenWas)) requestDump(m.track);
      }
      if (!t.info.len) { t.data = null; t.pcp = null; analyse(); }
      renderTracks();
    } else if (m.op === 'recorded') {
      t.info.len = m.len;
      t.info.org = m.org;
      if (!grid) { // Free mode: the first loop is the cycle
        grid = { t0: m.org, cyc: m.len };
        G.mix.delay.delayTime.value = echoTime();
      }
      if (t.rec) t.rec.to = m.from + m.len;
      renderTracks();
    } else if (m.op === 'dump') {
      t.data = m.data;
      t.lastLayers = t.info.layers;
      const N = m.data.length;
      let e = 0;
      for (let k = 0; k < N; k += 4) e += m.data[k] * m.data[k];
      t.rms = Math.sqrt(e / Math.max(1, N / 4));
      t.pcp = t.rms > 1e-4 ? LP.chroma(m.data, sr) : null;
      t.wave = peaks(m.data, 600);
      analyse();
      renderTracks();
    }
  }

  function requestDump(i) { post({ op: 'dump', track: i }); }

  // ---------- the transport ----------
  // Starts the loops (and the beat) at the next moment, after a count-in bar if asked.
  // Returns the frame the music starts on.
  function startTransport({ countIn = false } = {}) {
    const ctx = engine.ctx;
    const tempo = settings.mode === 'tempo';
    if (tempo && (!grid || !anyLoop())) grid = { t0: 0, cyc: barFrames() };
    let t0 = fr(ctx.currentTime + 0.12);
    if (tempo && countIn) t0 += grid.cyc;
    countInUntil = tempo && countIn ? t0 : 0;
    if (grid && anyLoop()) post({ op: 'shift', frames: t0 - grid.t0 });
    for (const t of tracks) if (t.info.len) t.info.org += t0 - (grid ? grid.t0 : t0);
    if (grid) grid.t0 = t0;
    post({ op: 'play', at: t0 });
    running = true;
    startBeat(t0, tempo && countIn);
    G.mix.delay.delayTime.value = echoTime();
    render();
    return t0;
  }

  function stopTransport() {
    if (!running) return;
    const at = fr(engine.ctx.currentTime + 0.02);
    for (let i = 0; i < TRACKS; i++) {
      const st = stateOf(i);
      if (st === 'rec' || st === 'armed') { // a loop that hasn't closed yet: cancel it
        post({ op: 'undo', track: i });
        tracks[i].rec = null;
      } else if (st === 'dub') post({ op: 'end', track: i, at: heardFrame() });
      tracks[i].pendDub = null;
    }
    post({ op: 'stop', at });
    running = false;
    stopBeat();
    render();
  }

  // ---------- the beat: count-in, click and drums, scheduled ahead on the audio clock ----------
  let beatTimer = null;
  let nextBeat = 0;
  let beatT0 = 0;
  let beatFrom = 0;
  function startBeat(t0, countIn) {
    stopBeat();
    beatT0 = t0;
    beatFrom = countIn ? -settings.beats : 0;
    nextBeat = beatFrom;
    const tick = () => {
      const ctx = engine.ctx;
      const tempo = settings.mode === 'tempo';
      const horizon = fr(ctx.currentTime + 0.15);
      const per = grid.cyc / settings.beats;
      while (beatT0 + nextBeat * per < horizon) {
        const k = nextBeat;
        const t = (beatT0 + k * per) / sr;
        const first = mod(k, settings.beats) === 0;
        if (tempo && t >= ctx.currentTime - 0.01) {
          if (k < 0 || settings.click) engine.click(t, first, G.mix.clickBus);
          if (k >= 0 && first && settings.drums !== 'off') playGroove(G, t, grid.cyc / sr);
        }
        nextBeat++;
      }
    };
    tick();
    beatTimer = setInterval(tick, 25);
  }
  function stopBeat() { if (beatTimer) clearInterval(beatTimer); beatTimer = null; }

  function playGroove(g, barStart, barSec, ctx = engine.ctx, dest = g.mix.drumBus, drums = g.drums) {
    const groove = LP.GROOVES[settings.drums];
    if (!groove) return;
    const { spb, hits } = groove.make(settings.beats);
    const step = barSec / (settings.beats * spb);
    for (const [s, kind, vol] of hits) {
      const src = ctx.createBufferSource();
      src.buffer = drums[kind];
      const gn = ctx.createGain();
      gn.gain.value = vol;
      src.connect(gn).connect(dest);
      src.start(barStart + s * step);
    }
  }

  // ---------- track actions ----------
  function say(kind, tag, text) {
    const el = $('lpSay');
    el.className = `feedback ${kind}`;
    el.innerHTML = tag ? `<span class="tag">${esc(tag)}</span> <span>${text}</span>` : text;
  }

  async function act(i) {
    try { await ensureAudio(); } catch (err) { say('bad', 'Audio', esc(err.message)); return; }
    if (!engine.micOn) {
      say('hint', 'Input', 'Turn on the input first (the <b>Input</b> card), then press record.');
      return;
    }
    const st = stateOf(i);
    if (st === 'armed') { post({ op: 'undo', track: i }); tracks[i].rec = null; renderTracks(); return; }
    if (st === 'empty') { startRecord(i); return; }
    if (st === 'rec') { endRecord(i); return; }
    if (st === 'stopped') { startTransport(); return; }
    if (st === 'play') { startDub(i); return; }
    if (st === 'dub') { post({ op: 'end', track: i, at: heardFrame() }); return; }
  }

  function startRecord(i) {
    const tempo = settings.mode === 'tempo';
    let from;
    if (!running) {
      if (!tempo && !grid) { // the very first loop in Free mode: from right now
        post({ op: 'play', at: 0 });
        running = true;
        from = heardFrame();
      } else {
        from = startTransport({ countIn: tempo && settings.countIn && !anyLoop() });
      }
    } else if (!grid) from = heardFrame();
    else from = LP.startAt(heardFrame(), grid.t0, grid.cyc, LP.GRACE * sr);
    const len = settings.length && grid ? settings.length * grid.cyc : 0;
    tracks[i].rec = { from, to: len ? from + len : null };
    post({ op: 'rec', track: i, from, len });
    if (len) afterRecord(i, from + len);
    say('', '', '');
    renderTracks();
  }

  function endRecord(i) {
    const t = tracks[i];
    if (!t.rec) return;
    const now = heardFrame();
    if (!grid) { // Free mode, the first loop: it ends now, and starts again at once
      post({ op: 'end', track: i, at: now, shiftOrg: true });
      t.rec.to = now;
      afterRecord(i, null);
      return;
    }
    const to = t.rec.to || LP.endAt(now, t.rec.from, grid.cyc, LP.GRACE * sr);
    if (!t.rec.to) post({ op: 'end', track: i, at: to });
    t.rec.to = to;
    afterRecord(i, to);
  }

  function afterRecord(i, to) {
    if (settings.after === 'dub') tracks[i].pendDub = to != null ? to : heardFrame();
    else if (settings.after === 'next') select((i + 1) % TRACKS);
  }

  function startDub(i) {
    if (tracks[i].info.rate !== 1) {
      say('hint', 'Overdub', 'Overdubs record at 1× speed: set this track back to 1× first.');
      return;
    }
    post({ op: 'dub', track: i, from: heardFrame() });
  }

  // When a change of reverse or speed takes effect: the next beat in Tempo mode, now in Free.
  function nextBeatFrame() {
    const now = fr(engine.ctx.currentTime + 0.02);
    if (settings.mode !== 'tempo' || !grid || !running) return now;
    const per = grid.cyc / settings.beats;
    return grid.t0 + Math.ceil((now - grid.t0) / per) * per;
  }

  function toggleRev(i) {
    const t = tracks[i];
    if (!t.info.len || t.info.busy === 'dub') return;
    t.info.rev = !t.info.rev;
    post({ op: 'map', track: i, at: Math.round(nextBeatFrame()), rev: t.info.rev });
    renderTracks();
  }

  function setRate(i, rate) {
    const t = tracks[i];
    if (!t.info.len || t.info.busy === 'dub') return;
    t.info.rate = t.info.rate === rate ? 1 : rate;
    post({ op: 'map', track: i, at: Math.round(nextBeatFrame()), rate: t.info.rate });
    renderTracks();
  }

  function undo(i) {
    if (!G) return;
    if (tracks[i].rec) tracks[i].rec = null;
    tracks[i].pendDub = null;
    post({ op: 'undo', track: i });
  }

  function clearTrack(i) {
    const t = tracks[i];
    if (Date.now() - t.clearArm > 2500) {
      t.clearArm = Date.now();
      say('warn', 'Clear', `Press <b>Clear</b> again to erase track ${i + 1}. It can’t be undone.`);
      renderTracks();
      return;
    }
    t.clearArm = 0;
    t.rec = null;
    t.pendDub = null;
    t.info.rev = false;
    t.info.rate = 1;
    post({ op: 'clear', track: i });
    if (!tracks.some((x, k) => k !== i && x.info.len)) { grid = settings.mode === 'free' ? null : grid; }
    say('', '', '');
  }

  function clearAll() {
    if (!confirm('Erase all four tracks? This can’t be undone.')) return;
    stopTransport();
    for (let i = 0; i < TRACKS; i++) {
      tracks[i].rec = null;
      tracks[i].pendDub = null;
      tracks[i].info.rev = false;
      tracks[i].info.rate = 1;
      post({ op: 'clear', track: i });
    }
    grid = null;
    render();
  }

  function select(i) {
    sel = clamp(i, 0, TRACKS - 1);
    renderTracks();
  }

  // ---------- track strips ----------
  const STATE_TEXT = {
    empty: ['Record', 'empty'],
    armed: ['Waiting', 'starts on the bar'],
    rec: ['Recording', 'press to close the loop'],
    play: ['Playing', 'press to overdub'],
    dub: ['Overdub', 'press to stop overdubbing'],
    stopped: ['Stopped', 'press to play'],
  };

  function buildTracks() {
    const wrap = $('lpTracks');
    wrap.innerHTML = tracks.map((_, i) => `
      <div class="lp-track" role="listitem" data-i="${i}" style="--trk:${COLORS[i]}">
        <button class="lp-big" type="button" data-act="main" aria-describedby="lpSt${i}">
          <span class="lp-num">${i + 1}</span><span class="lp-st" id="lpSt${i}"></span><span class="lp-sub"></span>
        </button>
        <div class="lp-body">
          <div class="lp-wave-wrap"><canvas class="lp-wave"></canvas><div class="lp-head"></div><div class="lp-meta"></div></div>
          <div class="lp-btns">
            <button class="chip-btn" type="button" data-act="mute" aria-pressed="false" title="Mute (M)">Mute</button>
            <button class="chip-btn" type="button" data-act="solo" aria-pressed="false" title="Solo: only the soloed tracks play (S)">Solo</button>
            <button class="chip-btn" type="button" data-act="rev" aria-pressed="false" title="Play backwards (R)">Rev</button>
            <button class="chip-btn" type="button" data-act="half" aria-pressed="false" title="Half speed: an octave down, twice as long (H)">½×</button>
            <button class="chip-btn" type="button" data-act="dbl" aria-pressed="false" title="Double speed: an octave up, twice round per loop">2×</button>
            <button class="chip-btn" type="button" data-act="x2" title="Make the loop twice as long, the content repeated, so you can overdub a different second half (D)">×2 length</button>
            <button class="chip-btn" type="button" data-act="undo" title="Take off the last overdub, or cancel what's in progress (Z)">Undo</button>
            <button class="chip-btn" type="button" data-act="redo" title="Put it back (Y)">Redo</button>
            <button class="chip-btn lp-clear" type="button" data-act="clear" title="Erase this track">Clear</button>
          </div>
          <div class="lp-knobs">
            <label><span>Vol</span><input type="range" min="0" max="100" step="1" data-k="vol"></label>
            <label><span>Pan</span><input type="range" min="-100" max="100" step="5" data-k="pan"></label>
            <label title="A dotted-8th echo, in time with the tempo"><span>Echo</span><input type="range" min="0" max="100" step="1" data-k="echo"></label>
            <label><span>Room</span><input type="range" min="0" max="100" step="1" data-k="room"></label>
            <label title="While you overdub, how much of the old loop stays each pass"><span>Fade</span>
              <select data-k="fb"><option value="1">100%</option><option value="0.9">90%</option><option value="0.75">75%</option><option value="0.5">50%</option></select></label>
          </div>
        </div>
      </div>`).join('');
    wrap.querySelectorAll('.lp-track').forEach((el) => {
      const i = Number(el.dataset.i);
      el.addEventListener('pointerdown', () => { if (sel !== i) select(i); });
      el.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', (e) => {
        e.currentTarget.blur();
        const a = b.dataset.act;
        select(i);
        if (a === 'main') act(i);
        else if (a === 'mute') { tracks[i].mute = !tracks[i].mute; mixChanged(i); }
        else if (a === 'solo') { tracks[i].solo = !tracks[i].solo; for (let k = 0; k < TRACKS; k++) mixChanged(k); }
        else if (a === 'rev') toggleRev(i);
        else if (a === 'half') setRate(i, 0.5);
        else if (a === 'dbl') setRate(i, 2);
        else if (a === 'x2') post({ op: 'double', track: i });
        else if (a === 'undo') undo(i);
        else if (a === 'redo') post({ op: 'redo', track: i });
        else if (a === 'clear') clearTrack(i);
      }));
      el.querySelectorAll('[data-k]').forEach((inp) => {
        const k = inp.dataset.k;
        inp.value = settings.tracks[i][k];
        inp.addEventListener('input', () => {
          settings.tracks[i][k] = Number(inp.value);
          save();
          if (k === 'fb') post({ op: 'fb', track: i, value: settings.tracks[i].fb });
          else mixChanged(i);
        });
      });
    });
  }

  function mixChanged(i) {
    if (G) applyTrackMix(G.mix, i);
    analyse();
    renderTracks();
  }

  function renderTracks() {
    document.querySelectorAll('.lp-track').forEach((el) => {
      const i = Number(el.dataset.i);
      const t = tracks[i];
      const st = stateOf(i);
      el.dataset.state = st;
      el.classList.toggle('sel', i === sel);
      el.classList.toggle('muted', t.mute || (tracks.some((x) => x.solo) && !t.solo));
      const [a, b] = STATE_TEXT[st];
      el.querySelector('.lp-st').textContent = a;
      el.querySelector('.lp-sub').textContent = b;
      const has = t.info.len > 0;
      const busy = !!t.info.busy || !!t.rec;
      const btn = (k) => el.querySelector(`[data-act="${k}"]`);
      btn('mute').setAttribute('aria-pressed', String(t.mute));
      btn('solo').setAttribute('aria-pressed', String(t.solo));
      btn('rev').setAttribute('aria-pressed', String(t.info.rev));
      btn('half').setAttribute('aria-pressed', String(t.info.rate === 0.5));
      btn('dbl').setAttribute('aria-pressed', String(t.info.rate === 2));
      for (const k of ['rev', 'half', 'dbl']) btn(k).disabled = !has || t.info.busy === 'dub';
      btn('x2').disabled = !has || busy;
      btn('undo').disabled = !(t.info.layers || busy);
      btn('redo').disabled = !t.info.redo || busy;
      btn('clear').disabled = !has && !busy;
      btn('clear').classList.toggle('armed', Date.now() - t.clearArm < 2500);
      const cyc = grid ? grid.cyc : 0;
      const bars = has && cyc ? t.info.len / cyc : 0;
      const unit = settings.mode === 'tempo' ? 'bar' : 'cycle';
      const lenTxt = has ? (bars && Math.abs(bars - Math.round(bars)) < 1e-6 ? `${Math.round(bars)} ${unit}${Math.round(bars) === 1 ? '' : 's'}` : `${(t.info.len / sr).toFixed(2)} s`) : '';
      const layers = t.info.layers > 1 ? ` · ${t.info.layers - 1} overdub${t.info.layers === 2 ? '' : 's'}` : '';
      const fx = [t.info.rev ? 'reversed' : '', t.info.rate !== 1 ? `${t.info.rate === 0.5 ? '½' : '2'}×` : ''].filter(Boolean).join(' · ');
      el.querySelector('.lp-meta').textContent = [lenTxt + layers, fx].filter(Boolean).join(' · ');
      drawWave(el, t);
    });
    const any = tracks.some((t) => t.info.len);
    $('lpExport').disabled = !any;
    $('lpClearAll').disabled = !any && !tracks.some((t) => t.rec);
    const locked = anyLoop();
    for (const id of ['lpSlower', 'lpFaster', 'lpTap', 'lpMeter']) $(id).disabled = locked;
    $('lpTempo').title = locked ? 'The loops are locked to this tempo. Clear all to change it.' : '';
    document.querySelectorAll('#lpModeSeg button').forEach((b) => { b.disabled = locked; });
  }

  // The waveform: one min/max pair per column.
  function peaks(data, cols) {
    const out = new Float32Array(cols * 2);
    const per = data.length / cols;
    for (let c = 0; c < cols; c++) {
      let lo = 0;
      let hi = 0;
      const a = Math.floor(c * per);
      const b = Math.floor((c + 1) * per);
      for (let k = a; k < b; k += 2) { const v = data[k]; if (v < lo) lo = v; if (v > hi) hi = v; }
      out[2 * c] = lo;
      out[2 * c + 1] = hi;
    }
    return out;
  }

  function drawWave(el, t) {
    const cv = el.querySelector('.lp-wave');
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(cv.clientWidth * dpr));
    const h = Math.max(1, Math.round(cv.clientHeight * dpr));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    const g = cv.getContext('2d');
    g.clearRect(0, 0, w, h);
    const color = getComputedStyle(el).getPropertyValue('--trk').trim() || '#e9dfc8';
    if (grid && t.info.len && grid.cyc) { // bar lines
      const bars = Math.round(t.info.len / grid.cyc);
      g.fillStyle = 'rgba(255,255,255,0.08)';
      for (let b = 1; b < bars; b++) g.fillRect(Math.round((b / bars) * w), 0, 1, h);
    }
    if (!t.wave) return;
    let peak = 0.05;
    for (const v of t.wave) peak = Math.max(peak, Math.abs(v));
    const cols = t.wave.length / 2;
    g.fillStyle = color;
    g.globalAlpha = 0.85;
    for (let c = 0; c < cols; c++) {
      const cc = t.info.rev ? cols - 1 - c : c; // reversed: draw it the way it plays
      const lo = t.wave[2 * cc] / peak;
      const hi = t.wave[2 * cc + 1] / peak;
      const x = Math.floor((c / cols) * w);
      const x2 = Math.floor(((c + 1) / cols) * w);
      const y1 = h / 2 - (hi * h) / 2;
      const y2 = h / 2 - (lo * h) / 2;
      g.fillRect(x, y1, Math.max(1, x2 - x), Math.max(1, y2 - y1));
    }
    g.globalAlpha = 1;
  }

  // The playheads, beat dots and bar count, every animation frame.
  function frameLoop() {
    requestAnimationFrame(frameLoop);
    if (!G) return;
    const now = heardFrame();
    document.querySelectorAll('.lp-track').forEach((el) => {
      const i = Number(el.dataset.i);
      const t = tracks[i];
      const head = el.querySelector('.lp-head');
      const st = el.dataset.state;
      const live = stateOf(i);
      if (live !== st) renderTracks();
      let x = null;
      if (t.rec && now >= t.rec.from && (!t.rec.to || now < t.rec.to)) {
        const total = t.rec.to ? t.rec.to - t.rec.from : (grid ? Math.max(grid.cyc, Math.ceil((now - t.rec.from) / grid.cyc) * grid.cyc) : 0);
        x = total ? (now - t.rec.from) / total : null;
        el.style.setProperty('--fill', x == null ? '100%' : `${(x * 100).toFixed(2)}%`);
      } else el.style.setProperty('--fill', '0%');
      if (running && t.info.len && !t.rec) {
        // reversed, the waveform is drawn reversed too, so the head still moves left to right
        x = mod((now - t.info.org) * t.info.rate, t.info.len) / t.info.len;
      }
      head.style.left = x == null ? '-10px' : `${(x * 100).toFixed(2)}%`;
    });
    // beat dots + position
    const dots = $('lpBeatDots');
    if (dots.children.length !== settings.beats) dots.innerHTML = Array.from({ length: settings.beats }, (_, k) => `<span class="beat${k === 0 ? ' last' : ''}"></span>`).join('');
    if (running && grid && settings.mode === 'tempo') {
      const per = grid.cyc / settings.beats;
      const k = Math.floor((now - grid.t0) / per);
      const b = mod(k, settings.beats);
      [...dots.children].forEach((d, j) => d.classList.toggle('on', j === b && now >= grid.t0 - grid.cyc));
      $('lpPos').textContent = now < countInUntil ? `Count-in ${b + 1}` : `Bar ${Math.floor(k / settings.beats) + 1} · ${b + 1}`;
    } else {
      [...dots.children].forEach((d) => d.classList.remove('on'));
      $('lpPos').textContent = running ? (grid ? 'Free' : 'Free · first loop') : 'Stopped';
    }
    $('lpCard').dataset.run = running ? 'running' : 'stopped';
  }

  // ---------- what to play over it ----------
  const FLAT_MAJORS = [5, 10, 3, 8, 1, 6];
  const flatFor = (k) => FLAT_MAJORS.includes(k.mode === 'minor' ? mod(k.tonic + 3, 12) : k.tonic);
  const keyName = (k) => `${T.noteName(k.tonic, flatFor(k))} ${k.mode}`;
  let analysis = null;
  let pick = 0;

  function analyse() {
    const anySolo = tracks.some((t) => t.solo);
    const audible = tracks.filter((t) => t.pcp && !t.mute && (!anySolo || t.solo));
    if (!audible.length) { analysis = null; renderKey(); return; }
    const pcp = new Array(12).fill(0);
    for (const t of audible) t.pcp.forEach((v, i) => { pcp[i] += v * t.rms; });
    const sum = pcp.reduce((a, b) => a + b, 0);
    for (let i = 0; i < 12; i++) pcp[i] /= sum;
    // the opening bass: the first beat of every audible loop, mixed
    const beat = grid ? Math.round(grid.cyc / settings.beats) : Math.round(sr * 0.5);
    const open = new Float32Array(Math.max(beat, Math.round(sr * 0.35)));
    for (const t of audible) for (let k = 0; k < open.length && k < t.data.length; k++) open[k] += t.data[k];
    const keys = LP.findKey(pcp, LP.bassNote(open, sr));
    const key = keys[0];
    const prev = analysis && analysis.key;
    analysis = { pcp, keys, key, conf: LP.confidence(keys), sug: LP.suggest(key, pcp) };
    if (!prev || prev.tonic !== key.tonic || prev.mode !== key.mode) pick = 0;
    renderKey();
  }

  function renderKey() {
    const card = $('lpKeyCard');
    const svg = $('lpChroma');
    if (!analysis) {
      card.dataset.state = 'empty';
      $('lpKeyName').textContent = tracks.some((t) => t.info.len) ? 'Nothing to hear' : 'Record a loop';
      $('lpKeyNote').textContent = tracks.some((t) => t.info.len)
        ? 'The loops that are playing are too quiet to tell. Unmute a track, or record louder.'
        : 'Once a loop is down, the page listens to all of them and works out the key and a scale to solo with.';
      svg.innerHTML = '';
      $('lpSuggest').innerHTML = '';
      $('lpBoardRow').hidden = true;
      $('lpBoardWrap').hidden = true;
      return;
    }
    const { key, conf, keys, sug, pcp } = analysis;
    card.dataset.state = conf;
    const rel = keys[1] && keys[1].mode !== key.mode && keys[1].tonic === mod(key.tonic + (key.mode === 'major' ? 9 : 3), 12) ? keys[1] : null;
    $('lpKeyName').textContent = keyName(key);
    const relTonic = mod(key.tonic + (key.mode === 'major' ? 9 : 3), 12);
    const relName = `${T.noteName(relTonic, flatFor(key))} ${key.mode === 'major' ? 'minor' : 'major'}`;
    $('lpKeyNote').innerHTML = (conf === 'clear' ? 'Clearly in this key.' : conf === 'likely' ? 'Most likely this key.' : 'Hard to tell: the loops don’t point strongly at one key. Try the suggestions and trust your ears.')
      + (rel && key.r - rel.r < 0.15 ? ` It could also be heard as <b>${esc(relName)}</b>: the same notes, so the same scales work.` : ` (Its relative, ${esc(relName)}, has the same notes.)`);
    // chroma bars, from the tonic up
    const flat = flatFor(key);
    const scaleSet = sug[pick] ? new Set(S.SCALES[sug[pick].id].steps.map((x) => mod(key.tonic + x, 12))) : new Set();
    const max = Math.max(...pcp);
    svg.innerHTML = Array.from({ length: 12 }, (_, j) => {
      const pc = mod(key.tonic + j, 12);
      const h = (pcp[pc] / max) * 84;
      const x = 6 + j * 29.5;
      const cls = pc === key.tonic ? 'root' : scaleSet.has(pc) ? 'in' : 'out';
      return `<rect class="lp-bar ${cls}" x="${x}" y="${96 - h}" width="22" height="${Math.max(1, h)}" rx="3"></rect>
        <text class="lp-bar-label ${cls}" x="${x + 11}" y="113" text-anchor="middle">${esc(T.noteName(pc, flat))}</text>`;
    }).join('');
    $('lpSuggest').innerHTML = sug.map((s, k) => `<button type="button" role="radio" aria-checked="${k === pick}" data-k="${k}">
      <b>${esc(T.noteName(key.tonic, flat))} ${esc(S.SCALES[s.id].name.toLowerCase())}</b><small>${esc(s.why)}</small></button>`).join('');
    $('lpSuggest').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { pick = Number(b.dataset.k); renderKey(); }));
    renderBoard();
  }

  let board = null;
  function renderBoard() {
    const s = analysis && analysis.sug[pick];
    $('lpBoardRow').hidden = !s;
    $('lpBoardWrap').hidden = !s;
    if (!s) return;
    if (!board) board = new window.Fretboard($('lpBoard'), { from: 0, to: 17 });
    setSeg('lpBoxSeg', String(settings.box));
    const pos = S.position(analysis.key.tonic, s.id, settings.box, {}) || S.position(analysis.key.tonic, s.id, 1, {});
    if (!pos) { board.setDots([]); return; }
    const flat = flatFor(analysis.key);
    board.setDots(pos.notes.map((n) => ({ s: n.s, f: n.f, label: T.noteName(n.midi, flat), kind: mod(n.midi - analysis.key.tonic, 12) === 0 ? 'found' : 'anchor', title: n.label })));
  }

  // ---------- the download ----------
  async function exportMix() {
    const loops = tracks.map((t, i) => ({ t, i })).filter(({ t }) => t.info.len && t.data);
    if (!loops.length) return;
    const btn = $('lpExport');
    btn.disabled = true;
    btn.textContent = 'Rendering…';
    try {
      const cap = sr * 180;
      let len = LP.mixLength(loops.map(({ t }) => ({ len: t.info.len, rate: t.info.rate })), cap) || loops[0].t.info.len;
      const reps = Math.max(1, Math.ceil((sr * 12) / len)); // at least ~12 s, whole cycles
      len = Math.min(cap, len * reps);
      const off = new OfflineAudioContext(2, len, sr);
      const mix = buildMix(off, off.destination);
      mix.delay.delayTime.value = echoTime();
      const t0 = grid ? grid.t0 : loops[0].t.info.org;
      for (const { t, i } of loops) {
        applyTrackMix(mix, i, false);
        const b = off.createBuffer(1, t.info.len, sr);
        const d = t.info.rev ? Float32Array.from(t.data).reverse() : t.data;
        b.copyToChannel(d, 0);
        const src = off.createBufferSource();
        src.buffer = b;
        src.loop = true;
        src.playbackRate.value = t.info.rate;
        src.connect(mix.trk[i].inp);
        src.start(0, mod((t0 - t.info.org) * t.info.rate, t.info.len) / sr);
      }
      if (settings.mode === 'tempo' && settings.drums !== 'off' && grid) {
        const drums = {};
        for (const [k, d] of Object.entries(BL.renderDrums(sr))) {
          const b = off.createBuffer(1, d.length, sr);
          b.copyToChannel(d, 0);
          drums[k] = b;
        }
        mix.drumBus.gain.value = G.mix.drumBus.gain.value;
        for (let s = 0; s < len; s += grid.cyc) playGroove(null, s / sr, grid.cyc / sr, off, mix.drumBus, drums);
      }
      const out = await off.startRendering();
      const wav = LP.encodeWav([out.getChannelData(0), out.getChannelData(1)], sr);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([wav], { type: 'audio/wav' }));
      const d = new Date();
      a.download = `loop-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}.wav`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
      say('ok', 'Saved', `${(len / sr).toFixed(1)} s of the mix${settings.drums !== 'off' && settings.mode === 'tempo' ? ', with the drums' : ''}.`);
    } catch (err) {
      say('bad', 'Download', esc(err.message));
    } finally {
      btn.textContent = 'Download the mix (.wav)';
      btn.disabled = false;
    }
  }

  // ---------- timing offset ----------
  function renderLat() {
    const l = latency();
    $('lpLatVal').textContent = engine.ctx || l.how !== 'estimate' ? String(l.ms) : '–';
    $('lpLatReset').hidden = settings.latMs == null;
    const base = 'Every recording is moved earlier by this much, so it lines up with what you heard.';
    $('lpLatNote').innerHTML = l.how === 'here' ? `Set by hand. ${base}`
      : l.from === 'rhythm' ? `Measured by ${esc(l.how)} on the <a href="rhythm.html">Rhythm page</a>. ${base}`
        : `Estimated from what the browser reports. ${base} For tight overdubs, measure it on the <a href="rhythm.html">Rhythm page</a> (Timing offset card): the looper uses that.`;
  }
  function nudgeLat(d) {
    settings.latMs = clamp(latency().ms + d, 0, 400);
    save();
    sendLat();
    renderLat();
  }

  // ---------- controls ----------
  function setSeg(id, value) {
    document.querySelectorAll(`#${id} button`).forEach((b) => b.setAttribute('aria-checked', String(b.dataset.value === String(value))));
  }
  function seg(id, fn) {
    const el = $(id);
    el.querySelectorAll('button').forEach((b) => { b.setAttribute('role', 'radio'); b.addEventListener('click', (e) => { e.currentTarget.blur(); fn(b.dataset.value); }); });
  }

  function render() {
    $('lpBpm').textContent = settings.bpm;
    $('lpMeter').value = String(settings.beats);
    setSeg('lpModeSeg', settings.mode);
    setSeg('lpLenSeg', String(settings.length));
    setSeg('lpAfterSeg', settings.after);
    $('lpCountIn').setAttribute('aria-pressed', String(settings.countIn));
    $('lpClick').setAttribute('aria-pressed', String(settings.click));
    $('lpDrums').value = settings.drums;
    const tempo = settings.mode === 'tempo';
    for (const id of ['lpCountIn', 'lpClick', 'lpDrums', 'lpBeatVol']) $(id).disabled = !tempo;
    $('lpTempo').classList.toggle('dim', !tempo);
    $('lpPlay').innerHTML = running ? 'Stop all <kbd>Enter</kbd>' : 'Play all <kbd>Enter</kbd>';
    $('lpPlay').disabled = !tracks.some((t) => t.info.len) && !running;
    document.querySelector('#lpLenSeg [data-value="1"]').textContent = tempo ? '1 bar' : '1 cycle';
    renderTracks();
  }

  $('lpDrums').innerHTML = `<option value="off">No drums</option>${Object.entries(LP.GROOVES).map(([k, g]) => `<option value="${k}">${esc(g.name)}</option>`).join('')}`;
  $('lpPlay').addEventListener('click', async (e) => {
    e.currentTarget.blur();
    await ensureAudio().catch((err) => say('bad', 'Audio', esc(err.message)));
    if (!G) return;
    if (running) stopTransport(); else if (tracks.some((t) => t.info.len)) startTransport();
  });
  const setBpm = (v) => {
    if (anyLoop()) return;
    if (running) stopTransport();
    settings.bpm = clamp(Math.round(v), 40, 240);
    save();
    render();
  };
  $('lpSlower').addEventListener('click', () => setBpm(settings.bpm - 2));
  $('lpFaster').addEventListener('click', () => setBpm(settings.bpm + 2));
  let taps = [];
  function tap() {
    if (anyLoop()) return;
    const t = performance.now();
    taps = taps.filter((x) => t - x < 2500);
    taps.push(t);
    if (taps.length >= 3) {
      const iv = (taps[taps.length - 1] - taps[0]) / (taps.length - 1);
      setBpm(60000 / iv);
    }
    if (engine.ctx) engine.click(engine.ctx.currentTime, taps.length === 1, G ? G.mix.clickBus : engine.out);
  }
  $('lpTap').addEventListener('click', (e) => { e.currentTarget.blur(); ensureAudio().catch(() => {}); tap(); });
  $('lpMeter').addEventListener('change', (e) => { if (running) stopTransport(); settings.beats = Number(e.target.value); save(); render(); });
  seg('lpModeSeg', (v) => { if (anyLoop()) return; settings.mode = v; grid = null; save(); render(); });
  seg('lpLenSeg', (v) => { settings.length = Number(v); save(); render(); });
  seg('lpAfterSeg', (v) => { settings.after = v; save(); render(); });
  seg('lpToneSeg', (v) => { settings.tone = v; save(); applyMonitor(); });
  seg('lpBoxSeg', (v) => { settings.box = Number(v); save(); renderBoard(); });
  $('lpCountIn').addEventListener('click', () => { settings.countIn = !settings.countIn; save(); render(); });
  $('lpClick').addEventListener('click', () => { settings.click = !settings.click; save(); render(); });
  $('lpDrums').addEventListener('change', (e) => { settings.drums = e.target.value; save(); render(); });
  $('lpBeatVol').addEventListener('input', (e) => { settings.beatVol = Number(e.target.value); save(); applyBeatVol(); });
  $('lpRecDb').addEventListener('input', (e) => { settings.recDb = Number(e.target.value); save(); applyRecLevel(); });
  $('lpMonitor').addEventListener('change', (e) => { settings.monitor = e.target.checked; save(); applyMonitor(); });
  $('lpLatDown').addEventListener('click', () => nudgeLat(-1));
  $('lpLatUp').addEventListener('click', () => nudgeLat(1));
  $('lpLatReset').addEventListener('click', () => { settings.latMs = null; save(); sendLat(); renderLat(); });
  $('lpExport').addEventListener('click', exportMix);
  $('lpClearAll').addEventListener('click', clearAll);

  // Keys. A Bluetooth page-turner pedal sends PageDown/PageUp or the arrow keys: right = the main
  // action, left = undo, like a looper pedal's two switches.
  document.addEventListener('keydown', (e) => {
    const tag = e.target && e.target.tagName;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || (e.target && e.target.isContentEditable)) {
      if (e.key !== 'Escape') return;
    }
    const k = e.key;
    const handled = () => e.preventDefault();
    if (k === ' ' || k === 'PageDown' || k === 'ArrowRight' || k === 'ArrowDown') { handled(); if (!e.repeat) act(sel); }
    else if (k === 'z' || k === 'Z' || k === 'Backspace' || k === 'PageUp' || k === 'ArrowLeft' || k === 'ArrowUp') { handled(); if (!e.repeat) undo(sel); }
    else if (k === 'y' || k === 'Y') post({ op: 'redo', track: sel });
    else if (k >= '1' && k <= String(TRACKS)) select(Number(k) - 1);
    else if (k === '[') select(sel - 1);
    else if (k === ']') select(sel + 1);
    else if (k === 'Enter') { handled(); $('lpPlay').click(); }
    else if (k === 'Escape') stopTransport();
    else if (k === 'r' || k === 'R') toggleRev(sel);
    else if (k === 'h' || k === 'H') setRate(sel, 0.5);
    else if (k === 'd' || k === 'D') { if (G) post({ op: 'double', track: sel }); }
    else if (k === 'm' || k === 'M') { tracks[sel].mute = !tracks[sel].mute; mixChanged(sel); }
    else if (k === 's' || k === 'S') { tracks[sel].solo = !tracks[sel].solo; for (let i = 0; i < TRACKS; i++) mixChanged(i); }
    else if (k === 't' || k === 'T') { ensureAudio().catch(() => {}); tap(); }
    else if (k === 'k' || k === 'K') $('lpClick').click();
  });

  window.addEventListener('beforeunload', (e) => {
    if (tracks.some((t) => t.info.len)) { e.preventDefault(); e.returnValue = ''; }
  });

  // ---------- the input card ----------
  const MIC_NOTE = $('micNote').innerHTML;
  const mic = window.MicPanel.setup(engine, {
    store,
    quietOption: false,
    onInputChange: async (kind) => {
      if (kind) {
        try { await ensureAudio(); } catch (err) { say('bad', 'Audio', esc(err.message)); }
      }
      // the shared card writes the practice pages' note about pitch grading here: put ours back
      $('micNote').innerHTML = kind === 'mic'
        ? '<b>Wear headphones.</b> A mic hears the loops coming out of the speakers, and each overdub would record them again.'
        : kind ? 'A guitar straight into the interface records cleanest. Its loopback must be off, or the loops record themselves.'
          : MIC_NOTE;
      applyMonitor();
      renderLat();
      sendLat();
    },
  });

  buildTracks();
  render();
  renderLat();
  renderKey();
  applyRecLevel();
  applyMonitor();
  applyBeatVol();
  requestAnimationFrame(frameLoop);
  window.addEventListener('resize', () => renderTracks());
  window.__looper = { engine, tracks, settings, get grid() { return grid; }, get running() { return running; }, get G() { return G; }, act, stateOf, analyse, exportMix };
})();
