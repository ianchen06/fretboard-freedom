// UI controller for the Scales page. Pick a genre, a key, a scale and a shape system, and see every
// shape of it on the whole neck (the CAGED strip, the chord grip each shape is built around). Then:
// - Learn a shape: one position in sequences (up & down, 3s, 4s, 3rds, 6s), graded note by note.
// - Up & down the neck: shape ladders, diagonal runs and one-string runs that travel the neck.
// - Play along: a band (or a drone) in your key. Every note you play lights up on the neck and is
//   checked against the scale and the chord; the shape can move up and down the neck every few bars.
// "Play along" in the first two modes has the page play the notes with you, in time.
//
// Settings live in ff.scales. Sequence grades and tempos go into the Daily session's ff.learner
// (read, change, write back), and minutes into ff.days, so the session knows what you did here.
(function () {
  'use strict';
  const T = window.Theory;
  const S = window.Scales;
  const G = window.SessionGen;
  const N = window.ScaleNeck;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const mod12 = (n) => ((n % 12) + 12) % 12;
  const modn = (x, n) => ((x % n) + n) % n;
  const pct = (x) => `${Math.round(x * 100)}%`;
  const tuning = T.TUNINGS.standard;
  const MAXF = N.MAX_FRET;
  const posKey = (n) => `${n.s}:${n.f}`;

  // ---------- persistence ----------
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode: nothing is remembered */ }
    },
  };
  const todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const DEFAULTS = {
    genre: 'blues', key: 9, scaleId: 'minPent', system: 'caged', labels: 'deg', mode: 'shape',
    k: 1, alt: 0, seq: 'straight', route: 'ladder', span: 2, string: 6,
    backing: 'blues12', move: 'free', jamBpm: {},
    clickOn: true, guide: false, drone: false, hide: false, autoTempo: true, whole: true, grip: true,
    click: 70, back: 60, guideVol: 55,
  };
  const settings = { ...DEFAULTS, ...store.get('ff.scales', {}) };
  if (!S.SCALES[settings.scaleId]) settings.scaleId = 'minPent';
  if (!N.GENRES[settings.genre]) settings.genre = 'blues';
  const save = () => store.set('ff.scales', settings);

  // The Daily session's skill model and day log: read, change, write back, so an open Session tab
  // and this page don't overwrite each other's work.
  const learnerStart = () => store.get('ff.session.settings', {}).start || 'box1';
  const loadLearner = () => new G.Learner(store.get('ff.learner', {}), { start: learnerStart() });
  function withLearner(fn) {
    const L = loadLearner();
    fn(L);
    store.set('ff.learner', L.toJSON());
  }
  function logDay(sec, item) {
    const days = store.get('ff.days', {});
    const d = (days[todayStr()] = days[todayStr()] || { sec: 0, items: {} });
    d.sec += sec;
    if (item) d.items[item.key] = item.value;
    store.set('ff.days', days);
  }

  // ---------- audio ----------
  const engine = new window.AudioEngine();
  let pad = null;
  let band = null; // the blues band (shuffle)
  let songBand = null; // rock, metal, pop and ballad grooves; also the play-along guitar's sound
  let guideBus = null;
  const guideLive = new Set();
  const applyClick = () => { engine.clickVolume = settings.clickOn ? settings.click / 100 : 0; };
  applyClick();
  function applyVolumes() {
    applyClick();
    const b = settings.back / 100;
    if (pad) pad.setVolume(b * 0.9);
    if (band) band.setMix({ band: b * 1.2 });
    if (songBand) songBand.setMix({ band: b * 1.1 });
    if (guideBus) guideBus.gain.setTargetAtTime((settings.guideVol / 100) * 1.4, engine.ctx.currentTime, 0.03);
  }
  async function ensureAudio() {
    await engine.init();
    if (!pad) pad = new window.Pad(engine.ctx, engine.out);
    if (!songBand) {
      songBand = new window.SongBand(engine.ctx);
      songBand.init();
    }
    if (!guideBus) {
      guideBus = engine.ctx.createGain();
      guideBus.connect(engine.out);
    }
    applyVolumes();
  }
  function ensureBand() {
    if (!band) {
      band = new window.Band(engine.ctx);
      band.init();
    }
    applyVolumes();
  }
  const latency = () => (engine.ctx ? (engine.ctx.outputLatency || engine.ctx.baseLatency || 0) + 0.03 : 0.03);

  // The play-along guitar: a clean plucked string, cut at the end of its note.
  function guideNote(midi, when, dur) {
    const ctx = engine.ctx;
    const src = ctx.createBufferSource();
    src.buffer = songBand.buffer('clean', midi);
    const g = ctx.createGain();
    g.gain.setValueAtTime(1, when);
    g.gain.setTargetAtTime(0, when + dur, 0.04);
    src.connect(g).connect(guideBus);
    src.start(when);
    src.stop(when + dur + 0.35);
    guideLive.add(src);
    src.onended = () => { guideLive.delete(src); g.disconnect(); };
  }
  function stopGuide() {
    const t = engine.ctx ? engine.ctx.currentTime : 0;
    for (const src of guideLive) { try { src.stop(t + 0.02); } catch { /* already stopped */ } }
    guideLive.clear();
  }

  let inputKind = null;
  const mic = window.MicPanel.setup(engine, { store, preferFlat: () => !!(V && V.flat), onInputChange: (k) => { inputKind = k; idleFeedback(); } });

  // ---------- views ----------
  const board = new window.Fretboard($('board'), { from: 0, to: MAXF, tuning, onPick });
  let stand = null; // stand mode (js/stand.js), set up below
  let boardKey = '0:' + MAXF + ':1000';
  // Stand mode zooms the neck in on what you're playing: the shape, the route, or the shape you stay in.
  function applyBoard() {
    let fs = [];
    if (stand && stand.on && V) {
      if (settings.mode === 'shape' && V.shape) fs = V.shape.notes.map((n) => n.f);
      else if (settings.mode === 'neck' && V.ex) fs = V.ex.notes.map((n) => n.f);
      else if (settings.mode === 'jam' && settings.move === 'stay' && V.shape) fs = V.shape.notes.map((n) => n.f);
    }
    const w = window.Stand.fretWindow(fs, MAXF) || { from: 0, to: MAXF, width: 1000 };
    const key = `${w.from}:${w.to}:${w.width}`;
    if (key !== boardKey) { boardKey = key; board.configure({ from: w.from, to: w.to, tuning, width: w.width }); }
  }
  const tab = new window.SeqTab($('tab'), $('tabScroll'));

  // ---------- what's on the page: derived from the settings ----------
  let V = null; // { keyPc, minor, flat, sys, scaleId, shapes, shape, neck, ex, tempo }
  let run = null; // the running exercise or play-along, or null

  const MODES = ['dorian', 'mixolydian', 'phrygian', 'lydian', 'phrygDom'];
  const scaleName = (id) => (MODES.includes(id) ? S.SCALES[id].name : S.SCALES[id].name.toLowerCase());
  const keyLabel = () => `${V.root} ${scaleName(V.scaleId)}`;
  // A note of the scale takes its name in the scale (B♭ in A Phrygian); anything else follows the key.
  const noteName = (midi) => (V && V.names[T.mod12(Math.round(midi))]) || T.noteName(midi, V ? V.flat : false);
  const uniq = (notes) => {
    const m = new Map();
    for (const n of notes) if (!m.has(posKey(n))) m.set(posKey(n), n);
    return [...m.values()];
  };

  function compute() {
    const scaleId = settings.scaleId;
    const sys = settings.system === 'nps3' && N.hasNps(scaleId) ? 'nps3' : 'caged';
    const K = sys === 'nps3' ? S.SCALES[scaleId].steps.length : 5;
    if (settings.k > K || settings.k < 1) { settings.k = 1; settings.alt = 0; }
    const keyPc = settings.key;
    const minor = N.isMinorTonic(scaleId);
    const sp = N.spell(keyPc, scaleId);
    const shapes = N.shapeList(keyPc, scaleId, sys);
    const shape = N.findShape(shapes, settings.k, settings.alt);
    V = { keyPc, minor, flat: sp.flat, root: sp.root, names: sp.byPc, scaleNames: sp.names, sys, K, scaleId, shapes, shape, neck: N.neckNotes(keyPc, scaleId) };
    V.ex = settings.mode === 'shape' ? shapeDrill() : settings.mode === 'neck' ? neckDrill() : null;
    V.tempo = V.ex ? loadLearner().tempo(V.ex.tempoKey, V.ex.npb) : jamBpm();
    V.seg = 0;
  }

  function gripFor(p) {
    if (!p || !p.letter) return null;
    return N.grip(V.keyPc, V.minor, p.letter, (p.lo + p.hi) / 2);
  }
  const gripText = (g) => (g ? `${V.root}${V.minor ? 'm' : ''} barre, ${g.letter} shape, root on the ${N.ROOT_STRING_NAME[g.rootString]} string at fret ${g.rootFret}` : '');

  // Learn a shape: the Daily session's shape exercise, so grades and tempos are shared with it.
  function shapeDrill() {
    const p = V.shape;
    if (!p) return null;
    const system = V.sys === 'nps3' ? 'nps3' : 'pos';
    const skill = G.shapeSkill(system, V.scaleId, p.k);
    let seq = settings.seq;
    let ex = null;
    for (const s of [seq, 'straight']) {
      ex = G.buildExercise({ fam: 'shape', system, scaleId: V.scaleId, k: p.k, seq: s, npb: G.SEQ_NPB[s], key: V.keyPc, alt: p.alt, skill }, { maxFret: MAXF });
      if (ex) { seq = s; break; }
    }
    if (!ex) return null;
    const g = gripFor(p);
    ex.title = `${N.shapeLabel(p)} · ${keyLabel()}`;
    ex.chips = [['Shape', N.shapeNumber(p, V.scaleId)], ['Frets', `${p.lo}–${p.hi}`], ['Pattern', G.SEQS[seq].name], ['Rhythm', G.RHYTHM[ex.npb]]];
    ex.how = `${G.SEQ_HOW[seq]}${g ? ` The shape is built around the ${gripText(g)}: find that grip first, and the scale notes sit around it.` : ''}`;
    ex.route = { shapes: [p], segs: [{ shape: p, dir: 'up' }] };
    ex.notes = ex.notes.map((n) => ({ ...n, seg: 0 }));
    ex.seqId = seq;
    ex.kicker = 'Learn a shape';
    return ex;
  }

  // Up & down the neck: ladders, diagonals, one string.
  function neckDrill() {
    const r = settings.route;
    const base = { grade: 'seq', timing: true, matchPc: false, hidden: false };
    if (r === 'ladder') {
      const span = Math.min(settings.span, V.shapes.length);
      const from = Math.max(0, Math.min(V.shape.idx, V.shapes.length - span));
      const L = N.ladder(V.shapes, from, span);
      if (!L) return null;
      const names = L.shapes.map((p) => (p.letter || `P${p.k}`));
      const first = N.shapeLabel(L.shapes[0]);
      const second = N.shapeLabel(L.shapes[1]);
      const skill = span === 2 && V.sys === 'caged' && ['minPent', 'aeolian'].includes(V.scaleId) && L.shapes[1].k === (L.shapes[0].k % 5) + 1 ? `link:${V.scaleId}:${L.shapes[0].k}` : null;
      return {
        ...base, kicker: 'Up & down the neck',
        title: `Shape ladder ${names.join(' → ')} · ${keyLabel()}`,
        chips: [['Shapes', `${span}${span >= 5 ? ', the whole cycle' : ''}`], ['Frets', `${L.lo}–${L.hi}`], ['Notes', `${L.notes.length}, then it loops`], ['Rhythm', G.RHYTHM[2]]],
        how: `Up the ${first}, shift up on the high e string and come down the ${second}${span > 2 ? ', shift on the low E and go up the next one' : ''}. At the top, turn around in the same shape and come back down the same way. Shift with a slide so the sound never stops; the strip above the neck shows which shape you’re in.`,
        notes: L.notes, npb: 2, route: { shapes: L.shapes, segs: L.segs }, skill,
        tempoKey: skill ? `${skill}:2` : `scales:ladder:${V.scaleId}:${V.sys}:${span}:2`,
      };
    }
    if (r === 'diagonal') {
      const D = N.diagonal(V.keyPc, V.scaleId, V.shape);
      if (!D) return null;
      const shapes = V.shapes.filter((p) => D.run.some((n) => p.notes.some((q) => q.s === n.s && q.f === n.f)));
      const skill = V.scaleId === 'minPent' && V.sys === 'caged' ? `diag:${V.shape.k}` : null;
      return {
        ...base, kicker: 'Up & down the neck',
        title: `Diagonal run from the ${N.shapeLabel(V.shape)} · ${keyLabel()}`,
        chips: [['Per string', `${D.perString} notes`], ['Frets', `${D.lo}–${D.hi}`], ['Rhythm', `${G.RHYTHM[D.perString]}, one string per beat`]],
        how: D.perString === 3
          ? 'Three notes on every string, so the run climbs the neck as it goes up: slide or stretch into the third note on each string, one string per beat. Then back down.'
          : 'Four notes on every string: the hand moves up a little on every string, and the run crosses two or three positions. Slide into the 4th note with the same finger. One string per beat, then back down.',
        notes: D.notes, npb: D.perString, route: { shapes, segs: null, run: D.run }, skill,
        tempoKey: skill ? `${skill}:${D.perString}` : `scales:diag:${V.scaleId}:${D.perString}`,
      };
    }
    const s = settings.string;
    const O = N.oneStringRun(V.keyPc, V.scaleId, s);
    if (!O) return null;
    const sName = T.stringLongName(s, tuning);
    return {
      ...base, kicker: 'Up & down the neck',
      title: `One string · ${keyLabel()} on the ${sName} string`,
      chips: [['String', sName], ['Frets', `${O.lo}–${O.hi}`], ['Rhythm', G.RHYTHM[2]]],
      how: 'The scale along one string, from the root up to the root an octave higher, and back. Slide across the wider gaps and say each degree as you land on it: along one string you see the whole and half steps that boxes hide.',
      notes: O.notes, npb: 2, route: { shapes: [], segs: null, run: O.run }, skill: `onestring:${s}`,
      tempoKey: `onestring:${s}:straight`,
    };
  }

  // ---------- play along: backing and tempo ----------
  const jamBpm = () => settings.jamBpm[settings.backing] || N.GENRES[settings.genre].bpm;
  const GROOVE = {
    rock: { style: 'rock', role: 'chorus' },
    metal: { style: 'rock', role: 'verse' },
    pop: { style: 'pop', role: 'chorus' },
    ballad: { style: 'ballad', role: 'pre' },
  };
  // The shapes the play-along moves through, and the one in use at a bar.
  function moveShapes() {
    const count = Math.min(V.sys === 'nps3' ? 4 : 5, V.shapes.length);
    const from = Math.max(0, Math.min(V.shape.idx, V.shapes.length - count));
    return V.shapes.slice(from, from + count);
  }
  function activeShape(bar = run && run.jam ? run.jam.bar : 0) {
    if (settings.move === 'free') return null;
    if (settings.move === 'stay') return V.shape;
    const list = moveShapes();
    const order = N.cycleOrder(list.length);
    const every = Number(settings.move);
    return list[order[modn(Math.floor(Math.max(0, bar) / every), order.length)]];
  }
  function nextShapeInfo(bar) {
    if (settings.move !== '2' && settings.move !== '4') return null;
    const every = Number(settings.move);
    const left = every - modn(Math.max(0, bar), every);
    const nx = activeShape(Math.max(0, bar) + left);
    const now = activeShape(bar);
    return nx === now ? null : { shape: nx, left };
  }

  // ---------- running ----------
  let standMicTried = false;
  async function start() {
    if (run) return;
    await ensureAudio();
    if (stand && stand.on && !engine.micOn && !standMicTried) {
      standMicTried = true;
      try { await mic.enable(); } catch { /* the Hearing strip says why */ }
    }
    if (settings.mode === 'jam') { await startJam(); return; }
    if (!V.ex) return;
    const ex = { ...V.ex, hidden: settings.hide };
    run = {
      kind: 'drill', ex, bpm: V.tempo, grader: new G.SeqGrader(ex, { strictOctave: true }),
      musicStart: null, beatDur: 0.8, countBeats: 4, cleanBpm: 0, struggled: false, bad: 0,
      revealed: new Set(), guideIdx: null, guideBase: 0, sec: 0, unlogged: 0,
    };
    if (settings.guide) for (const n of ex.notes) songBand.buffer('clean', n.midi); // render the play-along notes before they're needed
    renderTab();
    startClock(true);
    acquireWakeLock();
    renderCard();
    drawBoard();
    renderStats();
    say('hint', 'Count-in', settings.guide ? 'One bar of clicks, then the page plays along with you.' : 'One bar of clicks, then go.');
  }

  function startClock(countIn) {
    const r = run;
    stopGuide();
    const beatDur = 60 / r.bpm;
    const startAt = engine.ctx.currentTime + 0.12;
    r.beatDur = beatDur;
    r.countBeats = countIn ? 4 : 0;
    r.musicStart = startAt + r.countBeats * beatDur;
    r.guideBase = r.grader ? r.grader.i : 0;
    applyClick();
    engine.startMetronome({ bpm: r.bpm, startAt, accentEvery: 4, onBeat: (i, t) => onBeat(r, i, t) });
  }

  function onBeat(r, i, t) {
    if (run !== r) return;
    const delay = Math.max(0, (t - engine.ctx.currentTime) * 1000);
    setTimeout(() => showBeat(r, i - r.countBeats), delay);
    const j = i - r.countBeats;
    if (j < 0) return;
    const droneOn = r.kind === 'jam' ? true : settings.drone;
    if (droneOn && pad && j % 4 === 0) pad.drone(V.keyPc, t, 4 * r.beatDur);
    if (r.kind === 'drill' && settings.guide && r.ex.notes.length) {
      const npb = r.ex.npb;
      const step = r.beatDur / npb;
      for (let q = 0; q < npb; q++) {
        const idx = (r.guideBase + j * npb + q) % r.ex.notes.length;
        const when = t + q * step;
        guideNote(r.ex.notes[idx].midi, when, step * 0.92);
        setTimeout(() => markGuide(r, idx), Math.max(0, (when - engine.ctx.currentTime) * 1000));
      }
    }
  }

  function markGuide(r, idx) {
    if (run !== r) return;
    if (r.guideIdx != null && tab.noteEls[r.guideIdx]) tab.noteEls[r.guideIdx].classList.remove('guide');
    r.guideIdx = idx;
    if (tab.noteEls[idx]) tab.noteEls[idx].classList.add('guide');
  }

  function showBeat(r, j) {
    if (run !== r) return;
    const dots = $('beats').children;
    for (let k = 0; k < dots.length; k++) {
      dots[k].classList.toggle('on', k === modn(j, 4));
      dots[k].classList.toggle('count', j < 0);
    }
  }

  async function startJam() {
    const b = N.backingById(settings.backing);
    const bpm = jamBpm();
    const once = N.backingBars(b, V.keyPc, V.flat, V.root);
    let bars = once.slice();
    while (bars.length < 4) bars = bars.concat(once);
    run = {
      kind: 'jam', bpm, beatDur: 60 / bpm, countBeats: 4, musicStart: null, groove: b.groove,
      jam: { bars, bar: -1, chord: 0, stats: new N.JamStats(S.SCALES[V.scaleId].steps.map((x) => mod12(V.keyPc + x))), tracker: newLocator(), recent: [], trail: [], placed: new Map() },
      sec: 0, unlogged: 0,
    };
    if (b.groove === 'drone') {
      startClock(true);
    } else if (b.groove === 'shuffle') {
      ensureBand();
      const t0 = band.start({ bpm, keyPc: V.keyPc, bars: bars.map((c) => c.roman), getBar: () => ({}), countIn: 1 });
      run.musicStart = t0 + band.barDur;
    } else {
      const gr = GROOVE[b.groove];
      const meta = bars.map((c, i) => ({ chords: [c.sym], role: gr.role, first: i === 0, last: i === bars.length - 1, nextRole: bars.length >= 8 && i === bars.length - 1 ? 'chorus2' : gr.role }));
      const t0 = songBand.start({ bpm, keyPc: V.keyPc, bars: meta, getBar: () => ({}), countIn: 1, loop: true, style: gr.style });
      run.musicStart = t0 + songBand.barDur;
    }
    acquireWakeLock();
    renderCard();
    renderJamPanel();
    drawStrip();
    drawBoard();
    renderStats();
    say('hint', 'Count-in', settings.move === '2' || settings.move === '4' ? 'One bar of sticks. The shape on the neck moves; the next one is outlined a bar ahead.' : 'One bar of sticks, then the band. Every note you play lights up on the neck.');
  }

  function stop() {
    if (!run) return;
    const r = run;
    engine.stopMetronome();
    stopGuide();
    if (pad) pad.stop();
    if (band) band.stop();
    if (songBand) songBand.stop();
    for (const d of $('beats').children) d.classList.remove('on', 'count');
    releaseWakeLock();
    if (stand) stand.stopped();
    finish(r);
    run = null;
    if (V) V.seg = 0;
    if (r.kind === 'drill') renderTab();
    renderCard();
    drawStrip();
    drawBoard();
    renderStats();
  }

  // A finished run: minutes into the day log; a sequence's grade and tempo into the skill model.
  function finish(r) {
    if (r.unlogged > 0) logDay(r.unlogged);
    r.unlogged = 0;
    if (r.kind === 'drill') {
      const g = r.grader;
      const score = g.score();
      if (!g.passes.length && score == null) return;
      withLearner((L) => {
        if (r.ex.skill && score != null) L.update(r.ex.skill, score, todayStr());
        if (g.passes.length) L.saveTempo(r.ex.tempoKey, { bpm: r.bpm, cleanBpm: r.cleanBpm, struggled: r.struggled && !r.cleanBpm });
      });
      if (score != null) logDay(0, { key: `scales:${r.ex.tempoKey}`, value: { title: `Scales · ${r.ex.title}`, block: 'scales', skill: r.ex.skill || null, score: Math.round(score * 100) / 100, bpm: r.bpm } });
      V.tempo = loadLearner().tempo(V.ex.tempoKey, V.ex.npb);
      const off = r.offString ? ` ${r.offString} note${r.offString > 1 ? 's' : ''} sounded like another string than the shape’s.` : '';
      if (score != null) say('ok', 'Saved', `${pct(score)} on this one${r.cleanBpm ? `, clean at ${r.cleanBpm} bpm` : ''}.${off} ${r.ex.skill ? 'It counts in the Daily session’s skill map.' : ''}`);
    } else {
      const st = r.jam.stats;
      if (st.total >= 12) {
        const score = (st.inScale / st.total) * (st.landTotal >= 4 ? 0.6 + 0.4 * (st.landed / st.landTotal) : 1);
        logDay(0, { key: `scales:jam:${settings.backing}:${V.scaleId}`, value: { title: `Scales · play along, ${keyLabel()}`, block: 'apply', skill: null, score: Math.round(score * 100) / 100, bpm: r.bpm } });
      }
      if (settings.move === 'free' || settings.move === 'stay') say('ok', 'Stopped', st.total ? `${st.total} notes. Where you played is below.` : 'Nothing heard. Is the mic on?');
    }
  }

  // Minutes count while something is running.
  let lastTick = performance.now();
  setInterval(() => {
    const now = performance.now();
    const dt = Math.min(1, (now - lastTick) / 1000);
    lastTick = now;
    if (!run) return;
    run.sec += dt;
    run.unlogged += dt;
    if (run.unlogged >= 10) { logDay(run.unlogged); run.unlogged = 0; }
  }, 250);

  function setBpm(b) {
    const v = Math.max(G.MIN_BPM, Math.min(G.MAX_BPM, Math.round(b)));
    if (settings.mode === 'jam') {
      settings.jamBpm[settings.backing] = v;
      save();
      V.tempo = v;
      $('bpm').textContent = v;
      if (run) { stop(); start(); }
      return;
    }
    V.tempo = v;
    $('bpm').textContent = v;
    if (run && run.kind === 'drill') { run.bpm = v; startClock(false); }
    renderStats();
  }
  const tempoStep = () => (settings.mode === 'jam' ? 4 : G.tempoStep(V.ex ? V.ex.npb : 2));

  // ---------- hearing notes ----------
  engine.on('note', (ev) => { if (stand && stand.heard(ev.midi)) return; played(ev.midi, ev.playedAt, false, null, ev.id); });

  // Where each note was played: placed at once from where the hand has been, then corrected from the
  // note's sound (js/stringid.js) about 0.2 s later. The string model is the one fitted to your
  // guitar under Hearing → Teach it your guitar, if you've done that.
  const SI = window.StringId;
  function newLocator() {
    if (!SI) return new N.HandTracker();
    return new SI.StringLocator({ model: SI.StringModel.fromJSON(store.get('ff.strings', null)), tuning: tuning.open, maxFret: MAXF });
  }
  // Sequences ask for each note at a place: a hint when one clearly came from another string.
  const newCheck = () => (SI ? new SI.StringCheck({ model: SI.StringModel.fromJSON(store.get('ff.strings', null)), tuning: tuning.open, maxFret: MAXF }) : null);
  let strCheck = newCheck();
  let hearingId = null;
  engine.on('timbre', ({ id, feat }) => {
    if (!V || !feat) return;
    if (run && run.kind === 'drill') { drillRefine(id, feat); return; }
    if (run && run.kind === 'jam') { jamRefine(id, feat); return; }
    if (!run && idleTracker.refine) {
      const moved = idleTracker.refine(id, feat);
      if (moved) flashLive(moved, idleNotes.get(id), S.pcsOf(V.keyPc, S.SCALES[V.scaleId].steps).has(mod12(idleNotes.get(id))));
    }
  });

  function played(midi, t, fromClick, at = null, id = null) {
    if (!V) return;
    const tt = t - (fromClick ? 0 : latency());
    if (run && run.kind === 'drill') { hearingId = id; drillNote(midi, tt, fromClick); hearingId = null; return; }
    if (run && run.kind === 'jam') { jamNote(midi, tt, at, id); return; }
    // Idle: show where it probably was, nearest the shape on screen.
    const win = settings.mode === 'jam' && settings.move === 'free' ? null : V.shape;
    const place = at || idleTracker.place(midi, win, id);
    if (id != null) { idleNotes.set(id, midi); if (idleNotes.size > 16) idleNotes.delete(idleNotes.keys().next().value); }
    if (place) flashLive(place, midi, S.pcsOf(V.keyPc, S.SCALES[V.scaleId].steps).has(mod12(midi)));
  }
  let idleTracker = newLocator();
  const idleNotes = new Map();
  // A new calibration (from the Hearing card) takes effect at once.
  window.addEventListener('ff:strings', () => {
    idleTracker = newLocator();
    strCheck = newCheck();
    if (run && run.kind === 'jam') run.jam.tracker = newLocator();
  });

  function drillNote(midi, tt, fromClick) {
    const r = run;
    const dev = !fromClick && r.musicStart != null && tt >= r.musicStart - r.beatDur / 2 ? gridDev(tt) : null;
    handleSeq(r.grader.note(midi, dev), midi);
  }
  function gridDev(tt) {
    const unit = run.beatDur / run.ex.npb;
    const k = Math.round((tt - run.musicStart) / unit);
    return tt - (run.musicStart + k * unit);
  }

  function handleSeq(events, midi) {
    const r = run;
    const ex = r.ex;
    for (const e of events) {
      if (e.kind === 'hit') {
        tab.setState(e.i, 'hit');
        if (strCheck && hearingId != null) strCheck.expect(hearingId, { ...ex.notes[e.i], i: e.i });
        if (ex.hidden) { tab.reveal(e.i); r.revealed.add(posKey(ex.notes[e.i])); }
        flashLive(ex.notes[e.i], ex.notes[e.i].midi, true);
      } else if (e.kind === 'miss') {
        tab.setState(e.i, 'miss');
      } else if (e.kind === 'wrong') {
        flashWrong(midi);
        const want = ex.notes[e.i];
        say('bad', `Heard ${noteName(midi)}`, `next is ${noteName(want.midi)} (${want.label}), ${T.stringLongName(want.s, tuning)} string fret ${want.f}`);
      } else if (e.kind === 'pass') {
        onPass(e.result);
      }
    }
    tab.setNow(r.grader.i);
    const seg = ex.notes[r.grader.i] ? ex.notes[r.grader.i].seg || 0 : 0;
    if (seg !== V.seg) { V.seg = seg; drawStrip(); renderNeckHead(); }
    drawBoard();
    renderStats();
  }

  function drillRefine(id, feat) {
    const r = strCheck && strCheck.check(id, feat);
    if (!r) return;
    run.offString = (run.offString || 0) + 1;
    const w = r.want;
    board.flash({ s: r.s, f: r.f, label: '?', kind: 'wrong' }, 1200);
    say('warn', `${noteName(w.midi)}: other string?`, `it sounded like the ${T.stringLongName(r.s, tuning)} string fret ${r.f}; the shape has it on the ${T.stringLongName(w.s, tuning)} string fret ${w.f}. It still counted.`);
  }

  function onPass(res) {
    const r = run;
    const g = r.grader;
    tab.clearStates();
    if (r.ex.hidden) r.revealed.clear();
    if (res.clean) r.cleanBpm = Math.max(r.cleanBpm, r.bpm);
    const summary = `${pct(res.acc)} of the notes${res.timing != null ? ` · timing ±${Math.round(res.timing)} ms` : ''}`;
    if (settings.autoTempo) {
      if (res.clean && g.cleanStreak >= g.cleanNeeded) {
        g.cleanStreak = 0;
        r.bad = 0;
        const was = r.bpm;
        setBpm(r.bpm + tempoStep());
        say('ok', `Clean ×${g.cleanNeeded}`, `${summary}. Up to ${run.bpm} bpm (from ${was}).`);
        if (stand) stand.pop('ok', `Clean · up to ${run.bpm} bpm`);
        return;
      }
      if (!res.clean && res.acc < 0.6) {
        r.bad++;
        if (r.bad >= 2) {
          r.bad = 0;
          r.struggled = true;
          setBpm(r.bpm - tempoStep());
          say('warn', 'Slowing down', `${summary}. Two rough passes: ${run.bpm} bpm. Accuracy first.`);
          if (stand) stand.pop('warn', `Slower · ${run.bpm} bpm`);
          return;
        }
      } else r.bad = 0;
    }
    if (stand) stand.pop(res.clean ? 'ok' : res.acc >= 0.75 ? 'warn' : 'bad', res.clean ? (g.cleanNeeded > 1 ? `Clean ${g.cleanStreak}/${g.cleanNeeded}` : 'Clean pass') : `${pct(res.acc)} of the notes`);
    if (res.clean) say('ok', 'Clean pass', `${summary}${g.cleanNeeded > 1 ? ` · ${g.cleanStreak}/${g.cleanNeeded} in a row` : ''}`);
    else say(res.acc >= 0.75 ? 'warn' : 'bad', 'Pass', `${summary}${res.timing != null && res.timing > 60 ? ' · lock in with the click' : ''}`);
  }

  // A wrong note shows where it most likely was: the nearest place to the note you were aiming for.
  function flashWrong(midi) {
    const ref = run.ex.notes[run.grader.i] || run.ex.notes[0];
    let best = null;
    for (const s of T.STRINGS) {
      const f = midi - tuning.open[s];
      if (f < 0 || f > MAXF) continue;
      const d = Math.abs(f - ref.f) + Math.abs(s - ref.s) * 0.7;
      if (!best || d < best.d) best = { s, f, d };
    }
    if (best) board.flash({ s: best.s, f: best.f, kind: 'wrong', label: noteName(midi) }, 900);
  }

  function flashLive(place, midi, inScale) {
    board.flash({ s: place.s, f: place.f, kind: `live${inScale ? '' : ' out'}`, label: settings.labels === 'note' || !inScale ? noteName(midi) : '' }, 1100);
  }

  function jamNote(midi, tt, clicked, id = null) {
    const r = run;
    const J = r.jam;
    const barDur = 4 * r.beatDur;
    let at = null;
    let chord = null;
    let next = null;
    if (r.musicStart != null && tt >= r.musicStart - r.beatDur / 4) {
      const bar = Math.floor((tt - r.musicStart) / barDur);
      at = { bar, beat: (tt - r.musicStart - bar * barDur) / r.beatDur };
      const n = J.bars.length;
      if (r.groove !== 'drone') {
        chord = J.bars[modn(bar, n)];
        next = J.bars[modn(bar + 1, n)];
      }
    }
    const active = activeShape(at ? at.bar : 0);
    const place = clicked || J.tracker.place(midi, active, id);
    if (clicked) J.tracker.center = J.tracker.center == null ? clicked.f : 0.6 * J.tracker.center + 0.4 * clicked.f;
    const shape = N.shapeAt(V.shapes, place, J.tracker.center);
    const inShape = active ? active.notes.some((n) => n.midi === midi) : null;
    const res = J.stats.note(midi, { at, chord, next, place, shapeKey: shape ? shape.idx : null, inShape });
    if (id != null && place && !clicked) {
      J.placed.set(id, { midi, place, shapeKey: shape ? shape.idx : null });
      if (J.placed.size > 32) J.placed.delete(J.placed.keys().next().value);
    }
    J.recent.push({ name: noteName(midi), ok: res.inScale && inShape !== false, land: res.land });
    if (J.recent.length > 16) J.recent.shift();
    if (place) {
      J.trail.push(place);
      if (J.trail.length > 4) J.trail.shift();
    }
    if (res.land === true) say('ok', 'Landed', `${noteName(midi)} on beat 1, a tone of ${(at.beat > 3.75 ? next : chord).name}`);
    else if (res.land === false) say('warn', 'Beat 1', `${noteName(midi)} isn’t in ${(at.beat > 3.75 ? next : chord).name}: aim for the amber-ringed notes`);
    else if (!res.inScale) say('bad', `Heard ${noteName(midi)}`, `not in ${keyLabel()}`);
    else if (inShape === false) say('warn', `Heard ${noteName(midi)}`, `in the scale, but not in the ${N.shapeLabel(active)} (frets ${active.lo}–${active.hi})`);
    drawBoard();
    if (place) flashLive(place, midi, res.inScale);
    renderStats();
    renderJamPanel();
  }

  // The note's sound says it was somewhere else on the neck: move it in the stats and on the board.
  function jamRefine(id, feat) {
    const J = run.jam;
    const was = J.placed.get(id);
    if (!was || !J.tracker.refine) return;
    const moved = J.tracker.refine(id, feat);
    if (!moved) return;
    const place = { s: moved.s, f: moved.f };
    const shape = N.shapeAt(V.shapes, place, J.tracker.center);
    J.stats.relocate(was.place, place, was.shapeKey, shape ? shape.idx : null);
    const ti = J.trail.findIndex((p) => p === was.place);
    if (ti >= 0) J.trail[ti] = place;
    J.placed.set(id, { midi: was.midi, place, shapeKey: shape ? shape.idx : null });
    drawBoard();
    flashLive(place, was.midi, J.stats.pcs.has(mod12(was.midi)));
    renderJamPanel();
  }

  async function onPick(s, f) {
    await ensureAudio();
    const midi = T.midiAt(s, f, tuning);
    engine.pluck(midi);
    played(midi, engine.ctx.currentTime, true, { s, f });
  }

  // ---------- the play-along clock: the beat, the chord, the moving shape ----------
  // A timer rather than animation frames, which browsers throttle (low-power mode, some views).
  function frame() {
    if (!run || run.kind !== 'jam' || run.musicStart == null || !engine.ctx) return;
    const r = run;
    const J = r.jam;
    const now = engine.ctx.currentTime - (engine.ctx.outputLatency || 0);
    const rel = now - r.musicStart;
    if (r.groove !== 'drone') {
      const j = Math.floor(rel / r.beatDur);
      if (j !== J.beat) { J.beat = j; showBeat(r, j); }
    }
    const bar = rel < 0 ? -1 : Math.floor(rel / (4 * r.beatDur));
    if (bar === J.bar) return;
    J.bar = bar;
    const n = J.bars.length;
    const c = J.bars[modn(Math.max(0, bar), n)];
    const nx = J.bars[modn(Math.max(0, bar) + 1, n)];
    $('chordNow').textContent = r.groove === 'drone' ? `${V.root} drone` : c.name;
    $('chordNext').textContent = r.groove === 'drone' || n === 1 ? '' : `→ ${nx.name}`;
    const info = nextShapeInfo(bar);
    const el = $('shapeNext');
    el.textContent = info ? `${info.left === 1 ? 'Next bar' : `In ${info.left} bars`}: ${N.shapeLabel(info.shape)}, frets ${info.shape.lo}–${info.shape.hi}` : '';
    el.classList.toggle('soon', !!info && info.left === 1);
    renderNeckHead();
    drawStrip();
    drawBoard();
  }
  setInterval(frame, 33);

  // ---------- rendering ----------
  function say(kind, tag, text) {
    const fb = $('feedback');
    fb.className = `feedback ${kind}`;
    fb.innerHTML = `<span class="tag">${esc(tag)}</span><span>${esc(text)}</span>`;
  }
  function idleFeedback() {
    if (run || !V) return;
    if (stand && stand.on && (settings.mode === 'jam' || V.ex)) {
      const want = standStartNote();
      say('hint', 'Ready', engine.micOn && stand.opts.playStart && want != null ? `Play ${noteName(want)} to start, or press the right pedal. Left pedal: next shape.` : engine.micOn ? 'Right pedal or Start. Left pedal: next shape.' : 'Start turns the input on, so the app can grade you.');
      return;
    }
    const mic = engine.micOn ? '' : ' Turn on the mic (right) to get graded.';
    if (settings.mode === 'jam') say('hint', 'Ready', `Start counts in one bar, then the band plays in ${V.root}. Every note you play lights up on the neck.${mic}`);
    else if (!V.ex) say('warn', 'Doesn’t fit', 'That route doesn’t fit on the neck in this key. Pick another shape or string.');
    else say('hint', 'Ready', `Start gives you one bar of clicks first.${settings.guide ? ' Play along is on: the page plays the notes with you (headphones!).' : ' Turn on Play along to hear the notes with you.'}${mic}`);
  }

  function segButtons(el, items, cur) {
    el.innerHTML = items.map(([v, label, title]) => `<button type="button" role="radio" data-value="${esc(v)}" aria-checked="${String(String(cur) === String(v))}"${title ? ` title="${esc(title)}"` : ''}>${label}</button>`).join('');
  }
  function syncSeg(el, cur) {
    el.querySelectorAll('button').forEach((b) => { b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(String(cur) === b.dataset.value)); });
  }

  const KEY_ORDER = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  function renderSetup() {
    const genre = N.GENRES[settings.genre];
    segButtons($('genreSeg'), Object.entries(N.GENRES).map(([id, g]) => [id, esc(g.name)]), settings.genre);
    segButtons($('keySeg'), KEY_ORDER.map((pc) => {
      const name = N.keyName(pc, V.scaleId);
      const sp = T.spellings(pc, name.includes('♭'));
      return [pc, esc(name), `${sp.join(' / ')}${V.minor ? ' minor' : ''}${genre.keys.includes(pc) ? ` · common in ${genre.name}` : ''}`];
    }), settings.key);
    $('keySeg').querySelectorAll('button').forEach((b) => b.classList.toggle('common', genre.keys.includes(Number(b.dataset.value))));
    $('scaleSelect').innerHTML = N.SCALE_GROUPS.map(([label, ids]) => `<optgroup label="${esc(label)}">${ids.map((id) => `<option value="${id}"${id === settings.scaleId ? ' selected' : ''}>${esc(S.SCALES[id].name)}${genre.scales.includes(id) ? '  ●' : ''}</option>`).join('')}</optgroup>`).join('');
    syncSeg($('systemSeg'), V.sys);
    const npsBtn = $('systemSeg').querySelector('[data-value="nps3"]');
    npsBtn.disabled = !N.hasNps(V.scaleId);
    npsBtn.title = N.hasNps(V.scaleId) ? 'Seven patterns with three notes on every string: the shred and metal fingering' : 'For 7-note scales (a pentatonic with 3 notes per string runs diagonally: see Up & down the neck)';
    syncSeg($('labelSeg'), settings.labels);
    const sc = S.SCALES[V.scaleId];
    const names = V.scaleNames;
    const degs = sc.steps.map((x) => S.degreeLabel(x, { scaleId: V.scaleId }));
    $('scaleWhy').innerHTML = `<b>${esc(keyLabel())}:</b> ${esc(names.join(' '))} <span class="fine">(${esc(degs.join(' '))})</span>. ${esc(G.SCALE_WHY[V.scaleId] || '')}`;
  }

  function renderNeckHead() {
    $('neckTitle').textContent = `${keyLabel()} across the neck`;
    const p = currentShape();
    const g = p ? gripFor(p) : null;
    $('neckSub').textContent = p ? `${N.shapeLabel(p)} · ${N.shapeNumber(p, V.scaleId)} · frets ${p.lo}–${p.hi}` : '';
    $('neckFoot').textContent = g && settings.grip ? `Ringed: the ${gripText(g)}.` : 'Click a shape above the neck to pick it. No guitar handy? Click the fretboard.';
    $('wholeBtn').setAttribute('aria-pressed', String(settings.whole));
    $('gripBtn').setAttribute('aria-pressed', String(settings.grip));
    $('gripBtn').hidden = V.sys !== 'caged';
  }

  // The shape the neck is about right now: the ladder segment you're in, the moving shape, or the one picked.
  function currentShape() {
    if (settings.mode === 'neck' && V.ex && V.ex.route.segs) return (V.ex.route.segs[V.seg] || V.ex.route.segs[0]).shape;
    if (settings.mode === 'neck') return V.shape;
    if (settings.mode === 'jam') return activeShape() || (settings.move === 'free' ? null : V.shape);
    return V.shape;
  }

  function shapeButtons(el, cur) {
    const items = [];
    for (let k = 1; k <= V.K; k++) {
      const p = V.shapes.find((x) => x.k === k);
      const label = V.sys === 'nps3'
        ? `${k}<small>${esc(S.degreeLabel(S.SCALES[V.scaleId].steps[k - 1], { scaleId: V.scaleId }))}</small>`
        : `${N.cagedLetter(V.scaleId, k)}<small>${k}</small>`;
      items.push([k, label, p ? `${N.shapeLabel(p)} · ${N.shapeNumber(p, V.scaleId)} · frets ${p.lo}–${p.hi}` : '']);
    }
    segButtons(el, items, cur);
  }

  function renderCard() {
    const mode = settings.mode;
    const card = $('exCard');
    card.dataset.mode = mode;
    card.dataset.state = run ? 'run' : 'ready';
    $('modeTabs').querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.value === mode)));
    $('shapeOpts').hidden = mode !== 'shape';
    $('neckOpts').hidden = mode !== 'neck';
    $('jamOpts').hidden = mode !== 'jam';
    $('jamChord').hidden = mode !== 'jam';
    $('tabCard').hidden = mode === 'jam';
    $('jamPanel').hidden = mode !== 'jam';
    $('recent').hidden = mode !== 'jam';
    const drill = mode !== 'jam';
    const drone = mode === 'jam' && N.backingById(settings.backing).groove === 'drone';
    $('guideBtn').hidden = !drill;
    $('droneBtn').hidden = !drill;
    $('ladderBtn').hidden = !drill;
    $('clickBtn').hidden = !drill && !drone;
    if (mode === 'shape') {
      shapeButtons($('shapeSeg'), settings.k);
      syncSeg($('seqSeg'), V.ex ? V.ex.seqId : settings.seq);
    } else if (mode === 'neck') {
      syncSeg($('routeSeg'), settings.route);
      syncSeg($('spanSeg'), settings.span);
      syncSeg($('stringSeg'), settings.string);
      $('spanRow').hidden = settings.route !== 'ladder';
      $('fromRow').hidden = settings.route === 'string';
      $('stringRow').hidden = settings.route !== 'string';
      $('fromLabel').textContent = settings.route === 'ladder' ? 'From' : 'Start in';
      shapeButtons($('fromSeg'), settings.k);
    } else {
      const list = N.backingsFor(settings.genre, V.scaleId);
      const bars = (b) => N.backingBars(b, V.keyPc, V.flat, V.root).map((c) => c.name.replace(/ drone$/, '')).join(' ');
      const opt = (b) => `<option value="${b.id}"${b.id === settings.backing ? ' selected' : ''}>${esc(b.name)}${b.groove === 'drone' ? '' : ` · ${esc(bars(b))}`}</option>`;
      const fit = list.filter((b) => b.fit);
      const other = list.filter((b) => !b.fit);
      const extra = N.BACKINGS.filter((b) => b.fits.includes(V.scaleId) && !list.some((x) => x.id === b.id));
      $('backingSelect').innerHTML = `<optgroup label="Fits ${esc(keyLabel())}">${fit.map(opt).join('')}</optgroup>`
        + (extra.length ? `<optgroup label="Fits it, from other genres">${extra.map(opt).join('')}</optgroup>` : '')
        + (other.length ? `<optgroup label="${esc(N.GENRES[settings.genre].name)}, but some notes will clash">${other.map(opt).join('')}</optgroup>` : '');
      syncSeg($('moveSeg'), settings.move);
      if (!run) {
        const b = N.backingById(settings.backing);
        const c = N.backingBars(b, V.keyPc, V.flat, V.root);
        $('chordNow').textContent = b.groove === 'drone' ? `${V.root} drone` : c[0].name;
        $('chordNext').textContent = c.length > 1 && b.groove !== 'drone' ? `→ ${c[1].name}` : '';
        $('shapeNext').textContent = '';
      }
    }
    // Title, chips, how.
    if (mode === 'jam') {
      const b = N.backingById(settings.backing);
      $('exKicker').textContent = 'Play along';
      $('exTitle').textContent = `${keyLabel()} over ${b.groove === 'drone' ? 'a drone' : b.name}`;
      const move = { free: 'anywhere', stay: `stay in the ${N.shapeLabel(V.shape)}`, 4: 'shape moves every 4 bars', 2: 'shape moves every 2 bars' }[settings.move];
      $('exChips').innerHTML = [['Groove', b.groove === 'shuffle' ? 'blues shuffle' : b.groove], ['Neck', move], ['Fits', b.fits.includes(V.scaleId) ? 'yes' : 'some clashes']].map(([k, v]) => `<span class="ex-chip">${esc(k)}<b>${esc(v)}</b></span>`).join('');
      $('exHow').textContent = {
        free: 'Improvise anywhere on the neck. Each note lights up where you probably played it; the report below shows which shapes you used. On beat 1, aim for a tone of the chord (amber rings).',
        stay: `Improvise inside the ${N.shapeLabel(V.shape)} only (frets ${V.shape.lo}–${V.shape.hi}): limits make melodies. On beat 1, aim for the amber-ringed chord tones.`,
        4: 'The shape moves up the neck every 4 bars, then back down. The next shape is outlined above the neck a bar ahead: on the way there, find a note the two shapes share and slide.',
        2: 'The shape moves every 2 bars. Keep the line going through the shift: slide on one string into the next shape.',
      }[settings.move];
    } else if (V.ex) {
      $('exKicker').textContent = V.ex.kicker;
      $('exTitle').textContent = V.ex.title;
      $('exChips').innerHTML = V.ex.chips.map(([k, v]) => `<span class="ex-chip">${esc(k)}<b>${esc(v)}</b></span>`).join('');
      $('exHow').textContent = V.ex.how;
    } else {
      $('exKicker').textContent = mode === 'shape' ? 'Learn a shape' : 'Up & down the neck';
      $('exTitle').textContent = 'That doesn’t fit on the neck';
      $('exChips').innerHTML = '';
      $('exHow').textContent = 'Pick another shape, string or key.';
    }
    $('bpm').textContent = run ? run.bpm : V.tempo;
    $('goBtn').innerHTML = run ? 'Stop <kbd>Space</kbd>' : 'Start <kbd>Space</kbd>';
    $('goBtn').disabled = mode !== 'jam' && !V.ex;
    for (const [id, on] of [['clickBtn', settings.clickOn], ['guideBtn', settings.guide], ['droneBtn', settings.drone], ['hideBtn', settings.hide], ['ladderBtn', settings.autoTempo]]) $(id).setAttribute('aria-pressed', String(on));
    $('clickVol').value = settings.click;
    $('backVol').value = settings.back;
    $('guideVol').value = settings.guideVol;
    renderNeckHead();
  }

  function renderTab() {
    const ex = V.ex;
    if (settings.mode === 'jam' || !ex) { tab.render([], { empty: 'Nothing to play here: pick another shape.' }); return; }
    tab.render(ex.notes, { npb: ex.npb, hidden: settings.hide });
    $('tabTitle').textContent = `Sequence · ${ex.notes.length} notes, then it loops`;
    $('tabNote').textContent = `${G.RHYTHM[ex.npb]}, ${ex.npb} per click${settings.hide ? ' · from memory: notes show as you find them' : ''}${settings.guide ? ' · amber outline: where the play-along is' : ''}`;
    tab.setNow(run && run.grader ? run.grader.i : 0);
    $('tabScroll').scrollTop = 0;
  }

  // The strip of shapes above the neck, lined up with the fretboard's frets.
  function drawStrip() {
    const svg = $('strip');
    const { first, hasOpen, cellW, bx, labelW, openW } = board.geom;
    const left = (f) => (f === 0 && hasOpen ? labelW : bx + (f - first) * cellW);
    const right = (f) => (f === 0 && hasOpen ? labelW + openW : bx + (f - first + 1) * cellW);
    const rows = V.sys === 'nps3' ? 4 : 2; // neighbours overlap: 3-per-string patterns start 1–2 frets apart
    const rowH = 26;
    const H = rows * (rowH + 4) + 2;
    svg.setAttribute('viewBox', `0 0 1000 ${H}`);
    const cur = currentShape();
    const routeShapes = settings.mode === 'neck' && V.ex ? V.ex.route.shapes : [];
    const nx = run && run.kind === 'jam' ? nextShapeInfo(run.jam.bar) : null;
    const st = run && run.kind === 'jam' ? run.jam.stats : lastJam;
    const used = settings.mode === 'jam' && st && st.total ? st.byShape : null;
    const max = used ? Math.max(1, ...Object.values(used)) : 1;
    svg.innerHTML = V.shapes.map((p) => {
      const x1 = left(p.lo) + 2;
      const x2 = right(p.hi) - 2;
      const y = 2 + (p.idx % rows) * (rowH + 4);
      const cls = ['cs-band'];
      if (cur && p === cur) cls.push('on');
      else if (nx && p === nx.shape) cls.push('next');
      else if (routeShapes.includes(p)) cls.push('route');
      if (used && used[p.idx]) cls.push('used');
      const style = used && used[p.idx] ? ` style="--use:${(used[p.idx] / max).toFixed(2)}"` : '';
      const big = p.letter || String(p.k);
      const small = p.letter ? String(p.k) : S.degreeLabel(S.SCALES[V.scaleId].steps[p.k - 1], { scaleId: V.scaleId });
      const cx = (x1 + x2) / 2;
      const title = `${N.shapeLabel(p)} · ${N.shapeNumber(p, V.scaleId)} · frets ${p.lo}–${p.hi}`;
      return `<g class="${cls.join(' ')}" data-idx="${p.idx}" tabindex="0" role="button" aria-label="${esc(title)}"${style}><title>${esc(title)}</title>`
        + `<rect x="${x1.toFixed(1)}" y="${y}" width="${Math.max(10, x2 - x1).toFixed(1)}" height="${rowH}" rx="7"/>`
        + `<text x="${(cx - 4).toFixed(1)}" y="${y + 18}" text-anchor="middle">${esc(big)}</text>`
        + `<text class="cs-num" x="${(cx + 8).toFixed(1)}" y="${y + 18}" text-anchor="start">${esc(small)}</text></g>`;
    }).join('');
  }

  // The neck: the scale faded everywhere, the shape(s) in play in color, the grip and chord tones
  // ringed, the next note ringed, and where you just played.
  function drawBoard() {
    if (!V) return;
    applyBoard();
    const lab = (n) => (settings.labels === 'note' ? noteName(n.midi) : settings.labels === 'deg' ? n.label : '');
    const mode = settings.mode;
    const cur = currentShape();
    let focus = [];
    if (mode === 'shape') focus = V.shape ? V.shape.notes : [];
    else if (mode === 'neck') focus = V.ex ? uniq(V.ex.route.run || V.ex.notes) : [];
    else if (cur) focus = cur.notes;
    else focus = V.neck;
    const fset = new Set(focus.map(posKey));
    // From memory: in a sequence, the shape's notes show as "?" until you find them; in the
    // play-along, nothing shows but what you play.
    const hide = settings.hide;
    const revealed = run && run.revealed ? run.revealed : new Set();
    const dots = [];
    if (settings.whole && !hide) {
      for (const n of V.neck) if (!fset.has(posKey(n))) dots.push({ s: n.s, f: n.f, kind: 'deg dim', tone: n.role, label: '' });
    }
    // In a ladder, the shape you're in is bright and the rest of the route a little dimmer.
    const segSet = mode === 'neck' && cur && V.ex && V.ex.route.segs ? new Set(cur.notes.map(posKey)) : null;
    for (const n of focus) {
      if (hide) {
        if (mode !== 'jam' && !revealed.has(posKey(n))) { dots.push({ s: n.s, f: n.f, kind: 'hidden-dot', label: '?' }); continue; }
        if (mode === 'jam') continue;
      }
      const away = segSet && !segSet.has(posKey(n));
      dots.push({ s: n.s, f: n.f, kind: away ? 'deg away' : 'deg', tone: n.role, label: away ? '' : lab(n) });
    }
    // Chord tones of the chord that's playing, in the shape (or near your hand).
    if (mode === 'jam' && !hide && run && run.kind === 'jam' && run.groove !== 'drone') {
      const J = run.jam;
      const ch = J.bars[modn(Math.max(0, J.bar), J.bars.length)];
      const c = J.tracker.center;
      const near = cur ? cur.notes : c != null ? V.neck.filter((n) => Math.abs(n.f - c) <= 3) : [];
      for (const n of near) if (ch.pcs.includes(mod12(n.midi))) dots.push({ s: n.s, f: n.f, kind: 'chordtone', label: '' });
    }
    if (settings.grip && cur && cur.letter && !hide) {
      const g = gripFor(cur);
      if (g) for (const n of g.notes) dots.push({ s: n.s, f: n.f, kind: 'grip', label: '' });
    }
    if (run && run.kind === 'jam') for (const p of run.jam.trail.slice(0, -1)) dots.push({ s: p.s, f: p.f, kind: 'trail', label: '' });
    let target = null;
    if (mode !== 'jam' && V.ex) {
      const i = run && run.grader ? run.grader.i : 0;
      const n = V.ex.notes[i];
      if (n && hide) target = n.s; // from memory: which string, not where
      else if (n) dots.push({ s: n.s, f: n.f, kind: 'now', label: '' });
    }
    board.setTargetString(target);
    board.setDots(dots);
  }

  function stat(label, value, cls = '') {
    return `<div class="stat ${cls}"><span class="stat-label">${esc(label)}</span><span class="stat-value">${value}</span></div>`;
  }
  const grade = (x, good, meh) => (x == null ? '' : x >= good ? 'good' : x >= meh ? 'meh' : 'bad');

  function renderStats() {
    const el = $('stats');
    if (settings.mode === 'jam') {
      const st = run && run.kind === 'jam' ? run.jam.stats : lastJam;
      const r = st && st.total ? st.inScale / st.total : null;
      const moving = settings.move !== 'free';
      el.innerHTML = [
        stat('Notes', st ? String(st.total) : '0'),
        stat('In the scale', r != null ? pct(r) : '–', grade(r, 0.9, 0.75)),
        stat('Beat 1 on a chord tone', st && st.landTotal ? `${st.landed}<small>/ ${st.landTotal}</small>` : '–', st && st.landTotal ? grade(st.landed / st.landTotal, 0.7, 0.45) : ''),
        moving
          ? stat('In the shape', st && st.shapeTotal ? pct(st.inShape / st.shapeTotal) : '–', st && st.shapeTotal ? grade(st.inShape / st.shapeTotal, 0.85, 0.65) : '')
          : stat('Shapes used', st ? String(Object.keys(st.byShape).length) : '0'),
      ].join('');
      const rec = run && run.kind === 'jam' ? run.jam.recent : [];
      $('recent').innerHTML = rec.map((x) => `<span class="rn${x.ok ? '' : ' bad'}${x.land ? ' land' : ''}">${esc(x.name)}</span>`).join('');
      return;
    }
    const ex = V.ex;
    if (!ex) { el.innerHTML = ''; return; }
    const g = run && run.kind === 'drill' ? run.grader : null;
    const last = g && g.passes.length ? g.passes[g.passes.length - 1] : null;
    const need = g ? g.cleanNeeded : ex.notes.length <= 40 ? 3 : ex.notes.length <= 90 ? 2 : 1;
    const streak = g ? g.cleanStreak : 0;
    const pips = `<span class="pips">${Array.from({ length: need }, (_, i) => `<i class="${i < streak ? 'on' : ''}"></i>`).join('')}</span>`;
    const best = Math.max(loadLearner().best(ex.tempoKey), run ? run.cleanBpm || 0 : 0);
    el.innerHTML = [
      stat(`Pass ${g ? g.passes.length + 1 : 1}`, `${g ? g.pass.hits + g.pass.miss : 0}<small>/ ${ex.notes.length}</small>`),
      stat('Last pass', last ? pct(last.acc) : '–', grade(last && last.acc, 0.9, 0.75)),
      stat('Timing', last && last.timing != null ? `±${Math.round(last.timing)}<small>ms</small>` : '–', last && last.timing != null ? grade(-last.timing, -35, -60) : ''),
      settings.autoTempo ? stat('Clean in a row', `${pips}${best ? `<small> best ${best}</small>` : ''}`) : stat('Clean passes', g ? String(g.passes.filter((p) => p.clean).length) : '0'),
    ].join('');
  }

  // Where you played: notes per shape, notes per fret, and tips.
  let lastJam = null;
  function renderJamPanel() {
    const st = run && run.kind === 'jam' ? run.jam.stats : lastJam;
    if (run && run.kind === 'jam') lastJam = run.jam.stats;
    const total = st ? st.total : 0;
    $('jamTitle').textContent = total ? `Where you played (estimated) · ${total} notes` : 'Where you played (estimated)';
    const counts = V.shapes.map((p) => ({ p, n: st ? st.byShape[p.idx] || 0 : 0 })).filter((c) => c.n);
    const max = counts.length ? Math.max(...counts.map((c) => c.n)) : 1;
    $('shapeUse').innerHTML = counts.length
      ? counts.map(({ p, n }) => `<div class="su${n === max ? ' top' : ''}"><b>${esc(N.shapeLabel(p))}</b><span>frets ${p.lo}–${p.hi} · ${pct(n / total)}</span><span class="su-bar"><i style="width:${Math.round((n / max) * 100)}%"></i></span></div>`).join('')
      : '<p class="fine">Start the band and play: each shape you use shows up here.</p>';
    // Notes per fret, lined up with the neck.
    const svg = $('fretHeat');
    const frets = st ? st.frets : new Array(MAXF + 1).fill(0);
    const fmax = Math.max(1, ...frets);
    const parts = [];
    for (let f = 0; f <= MAXF; f++) {
      const x = board.x(f);
      const w = Math.max(6, board.geom.cellW * 0.62);
      const h = (frets[f] / fmax) * 44;
      if (frets[f]) parts.push(`<rect class="fh-bar" x="${(x - w / 2).toFixed(1)}" y="${(50 - h).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="2"><title>Fret ${f}: ${frets[f]} notes</title></rect>`);
      const mark = [3, 5, 7, 9, 12, 15, 17, 19, 21].includes(f);
      parts.push(`<text class="fh-axis${mark ? ' mark' : ''}" x="${x.toFixed(1)}" y="66" text-anchor="middle">${f}</text>`);
    }
    parts.push('<line class="fh-base" x1="30" x2="992" y1="50.5" y2="50.5"/>');
    svg.innerHTML = parts.join('');
    const tips = st ? N.jamTips(st, { shapes: V.shapes, keyOf: (p) => p.idx, nameOf: (pc) => noteName(pc), moving: settings.move === 'free' ? false : settings.move === 'stay' ? 'stay' : 'move' }) : [];
    $('jamTips').innerHTML = tips.map((t) => `<li class="${t.kind}">${esc(t.text)}</li>`).join('');
  }

  function renderAll() {
    renderSetup();
    renderCard();
    renderTab();
    drawStrip();
    drawBoard();
    renderStats();
    if (settings.mode === 'jam') renderJamPanel();
    idleFeedback();
  }

  // Something about what to play changed: stop, recompute, redraw.
  function rebuild() {
    if (run) stop();
    save();
    compute();
    renderAll();
  }

  // ---------- wake lock ----------
  let wakeLock = null;
  async function acquireWakeLock() {
    try {
      if ('wakeLock' in navigator && !wakeLock) {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => { wakeLock = null; });
      }
    } catch { /* not allowed here; fine */ }
  }
  function releaseWakeLock() {
    if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
  }

  // ---------- controls ----------
  const segValue = (e) => { const b = e.target.closest('button[data-value]'); return b && !b.disabled ? b.dataset.value : null; };

  $('genreSeg').addEventListener('click', (e) => {
    const v = segValue(e);
    if (!v) return;
    settings.genre = v;
    const g = N.GENRES[v];
    const changed = [];
    if (!g.keys.includes(settings.key)) { settings.key = g.keys[0]; changed.push('key'); }
    if (!g.scales.includes(settings.scaleId)) { settings.scaleId = g.scale; changed.push('scale'); }
    settings.backing = N.defaultBacking(v, settings.scaleId);
    rebuild();
    say('hint', g.name, `${changed.length ? `Switched to ${keyLabel()}. ` : ''}Common keys are marked ●. Backing: ${N.backingById(settings.backing).name}.`);
  });
  $('keySeg').addEventListener('click', (e) => {
    const v = segValue(e);
    if (v == null) return;
    settings.key = Number(v);
    rebuild();
  });
  $('up4Btn').addEventListener('click', () => { settings.key = mod12(settings.key + 5); rebuild(); });
  $('scaleSelect').addEventListener('change', (e) => {
    settings.scaleId = e.target.value;
    const b = N.backingById(settings.backing);
    if (!b.fits.includes(settings.scaleId)) settings.backing = N.defaultBacking(settings.genre, settings.scaleId);
    rebuild();
  });
  $('systemSeg').addEventListener('click', (e) => {
    const v = segValue(e);
    if (!v) return;
    settings.system = v;
    settings.k = 1;
    settings.alt = 0;
    rebuild();
  });
  $('labelSeg').addEventListener('click', (e) => {
    const v = segValue(e);
    if (!v) return;
    settings.labels = v;
    save();
    syncSeg($('labelSeg'), v);
    drawBoard();
  });
  $('wholeBtn').addEventListener('click', () => { settings.whole = !settings.whole; save(); renderNeckHead(); drawBoard(); });
  $('gripBtn').addEventListener('click', () => { settings.grip = !settings.grip; save(); renderNeckHead(); drawBoard(); });

  function pickShape(p) {
    if (!p) return;
    settings.k = p.k;
    settings.alt = p.alt;
    rebuild();
  }
  $('strip').addEventListener('click', (e) => {
    const g = e.target.closest('[data-idx]');
    if (g) pickShape(V.shapes[Number(g.dataset.idx)]);
  });
  $('strip').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const g = e.target.closest('[data-idx]');
    if (!g) return;
    e.preventDefault();
    e.stopPropagation();
    pickShape(V.shapes[Number(g.dataset.idx)]);
  });
  const onShapeSeg = (e) => {
    const v = segValue(e);
    if (!v) return;
    settings.k = Number(v);
    settings.alt = 0;
    rebuild();
  };
  $('shapeSeg').addEventListener('click', onShapeSeg);
  $('fromSeg').addEventListener('click', onShapeSeg);

  $('modeTabs').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-value]');
    if (!b || b.dataset.value === settings.mode) return;
    settings.mode = b.dataset.value;
    rebuild();
  });
  for (const [id, key, num] of [['seqSeg', 'seq'], ['routeSeg', 'route'], ['spanSeg', 'span', true], ['stringSeg', 'string', true], ['moveSeg', 'move']]) {
    $(id).addEventListener('click', (e) => {
      const v = segValue(e);
      if (v == null) return;
      settings[key] = num ? Number(v) : v;
      rebuild();
    });
  }
  $('backingSelect').addEventListener('change', (e) => { settings.backing = e.target.value; rebuild(); });

  $('goBtn').addEventListener('click', (e) => { e.currentTarget.blur(); toggleGo(); });
  function toggleGo() { if (run) stop(); else start(); }
  $('slower').addEventListener('click', () => setBpm((run ? run.bpm : V.tempo) - tempoStep()));
  $('faster').addEventListener('click', () => setBpm((run ? run.bpm : V.tempo) + tempoStep()));
  $('clickBtn').addEventListener('click', () => { settings.clickOn = !settings.clickOn; save(); applyClick(); renderCard(); });
  $('guideBtn').addEventListener('click', () => {
    settings.guide = !settings.guide;
    save();
    if (!settings.guide) {
      stopGuide();
      if (run && run.guideIdx != null && tab.noteEls[run.guideIdx]) tab.noteEls[run.guideIdx].classList.remove('guide');
    }
    renderCard();
    renderTab();
  });
  $('droneBtn').addEventListener('click', () => { settings.drone = !settings.drone; save(); if (!settings.drone && pad) pad.stop(); renderCard(); });
  $('hideBtn').addEventListener('click', () => {
    settings.hide = !settings.hide;
    if (run && run.kind === 'drill') stop();
    save();
    renderCard();
    renderTab();
    drawBoard();
  });
  $('ladderBtn').addEventListener('click', () => { settings.autoTempo = !settings.autoTempo; save(); renderCard(); renderStats(); });
  $('clickVol').addEventListener('input', (e) => { settings.click = Number(e.target.value); save(); applyClick(); });
  $('backVol').addEventListener('input', (e) => { settings.back = Number(e.target.value); save(); applyVolumes(); });
  $('guideVol').addEventListener('input', (e) => { settings.guideVol = Number(e.target.value); save(); applyVolumes(); });
  $('jamClear').addEventListener('click', () => {
    lastJam = null;
    if (run && run.kind === 'jam') {
      run.jam.stats = new N.JamStats(S.SCALES[V.scaleId].steps.map((x) => mod12(V.keyPc + x)));
      run.jam.recent = [];
      run.jam.trail = [];
    }
    renderJamPanel();
    renderStats();
    drawStrip();
  });

  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input, select, textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.closest('#strip') && (e.key === 'Enter' || e.key === ' ')) return;
    const k = e.key;
    if (e.code === 'Space') { e.preventDefault(); toggleGo(); }
    else if (k === 'ArrowLeft' || k === 'ArrowRight') {
      e.preventDefault();
      const i = V.shape ? V.shape.idx + (k === 'ArrowLeft' ? -1 : 1) : 0;
      if (V.shapes[i]) pickShape(V.shapes[i]);
    } else if (k === 'k' || k === 'K') $('up4Btn').click();
    else if (k === '-' || k === '_') $('slower').click();
    else if (k === '=' || k === '+') $('faster').click();
    else if ((k === 'm' || k === 'M') && !$('clickBtn').hidden) $('clickBtn').click();
    else if ((k === 'g' || k === 'G') && !$('guideBtn').hidden) $('guideBtn').click();
    else if ((k === 'd' || k === 'D') && !$('droneBtn').hidden) $('droneBtn').click();
    else if (k === 'h' || k === 'H') $('hideBtn').click();
    else if ((k === 'l' || k === 'L') && !$('ladderBtn').hidden) $('ladderBtn').click();
    else if (k === 'w' || k === 'W') $('wholeBtn').click();
    else if ((k === 'c' || k === 'C') && !$('gripBtn').hidden) $('gripBtn').click();
  });
  window.addEventListener('pagehide', () => { if (run) stop(); });

  // ---------- stand mode ----------
  // The note that starts it when you play it: the sequence's first note, or the key's root in Play along.
  function standStartNote() {
    if (settings.mode === 'jam') return 48 + V.keyPc;
    return V.ex && V.ex.notes.length ? V.ex.notes[0].midi : null;
  }
  // Left pedal: the next shape along the neck (round to the first). It stops what's running.
  function nextShape() {
    if (!V || !V.shapes.length) return;
    const was = !!run;
    if (run) stop();
    const i = V.shape ? (V.shape.idx + 1) % V.shapes.length : 0;
    pickShape(V.shapes[i]);
    if (stand.on) stand.pop('ok', N.shapeLabel(V.shape));
    if (was) start();
  }
  stand = window.Stand.setup({
    page: 'scales', store,
    parts: {
      l: ['.neck-card', '#tabCard', ['#stats', 6]],
      r: [['.ex-card .ex-top', 1], ['.ex-card .ex-head', 2], ['#jamChord', 3], ['#recent', 7], ['#feedback', 7], ['.ex-card .ex-controls', 8]],
      b: ['.listen-card', '.ex-card .stand-opts'],
    },
    onRight: () => toggleGo(),
    onLeft: () => nextShape(),
    onChange: () => { drawBoard(); idleFeedback(); if (V && V.ex && settings.mode !== 'jam') tab.setNow(run && run.grader ? run.grader.i : 0); },
    startNote: () => (V ? standStartNote() : null),
    canPlayStart: () => !run && !!V && (settings.mode === 'jam' || !!V.ex),
    start: () => start(),
  });

  // ---------- go ----------
  compute();
  renderAll();
  stand.init();

  // For poking at it from the console: __scales.fakeNote(57)
  window.__scales = {
    get V() { return V; }, get run() { return run; }, settings, engine, start, stop,
    fakeNote: (midi) => played(midi, engine.ctx ? engine.ctx.currentTime : 0, true),
  };
})();
