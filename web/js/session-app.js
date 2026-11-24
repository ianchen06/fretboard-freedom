// UI controller for the daily session: today's plan, the current exercise (metronome, backing, mic
// grading, timer), the fretboard and tab, settings, and progress.
//
// The plan, your skill model (ff.learner), the day log (ff.days) and the settings are kept in this
// browser. Back up / Restore move them between browsers.
(function () {
  'use strict';
  const T = window.Theory;
  const S = window.Scales;
  const G = window.SessionGen;
  const Rh = window.Rhythm;
  const RP = window.RhythmPlay;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const mod12 = (n) => ((n % 12) + 12) % 12;
  const pct = (x) => `${Math.round(x * 100)}%`;
  const mmss = (sec) => { const s = Math.max(0, Math.round(sec)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  const tuning = T.TUNINGS.standard;

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
    minutes: 90, focus: ['pent', 'scales', 'arps', 'metal', 'tech'], keyMode: 'rotate', key: 9, start: 'box1',
    autoTempo: true, strictOctave: true, click: 70, backing: 55, clickOn: true, backOn: true, labels: 'deg',
  };
  const settings = { ...DEFAULTS, ...store.get('ff.session.settings', {}) };
  const saveSettings = () => store.set('ff.session.settings', settings);

  let learner = new G.Learner(store.get('ff.learner', {}), { start: settings.start });
  const saveLearner = () => store.set('ff.learner', learner.toJSON());
  let days = store.get('ff.days', {});
  const saveDays = () => store.set('ff.days', days);
  const dayLog = (date) => (days[date] = days[date] || { sec: 0, items: {} });

  // ---------- the plan ----------
  let plan = null;
  const exCache = new Map();
  const savePlan = () => store.set('ff.plan', plan);
  function buildPlan(seed) {
    const p = G.buildPlan({ date: todayStr(), minutes: settings.minutes, focus: settings.focus, keyMode: settings.keyMode, key: settings.key, learner, seed });
    plan = { ...p, cur: 0, played: {}, results: {}, salt: {}, settings: planSettings() };
    exCache.clear();
    savePlan();
  }
  // PLAN_VERSION changes when the planner gains something new (2: the Rhythm block), so an older plan
  // for today shows the "generate a new session" prompt instead of being replaced under you.
  const PLAN_VERSION = 2;
  const planSettings = () => JSON.stringify([settings.minutes, [...settings.focus].sort(), settings.keyMode, settings.keyMode === 'fixed' ? settings.key : null, settings.start, PLAN_VERSION]);
  function exOf(item) {
    if (item.kind !== 'ex') return null;
    if (!exCache.has(item.uid)) exCache.set(item.uid, G.buildExercise(item.desc));
    return exCache.get(item.uid);
  }
  const exercises = () => plan.items.filter((x) => x.kind === 'ex');
  const playedSec = (item) => plan.played[item.uid] || 0;
  const totalPlayed = () => plan.items.reduce((a, x) => a + Math.min(playedSec(x), x.minutes * 60 + 600), 0);

  // ---------- audio ----------
  const engine = new window.AudioEngine();
  let pad = null;
  const applyClick = () => { engine.clickVolume = settings.clickOn ? settings.click / 100 : 0; };
  applyClick();
  async function ensureAudio() {
    await engine.init();
    if (!pad) {
      pad = new window.Pad(engine.ctx, engine.out);
      pad.setVolume(settings.backing / 100);
    }
  }
  const latency = () => (engine.ctx ? (engine.ctx.outputLatency || engine.ctx.baseLatency || 0) + 0.03 : 0.03);

  let inputKind = null;
  const mic = window.MicPanel.setup(engine, { store, preferFlat: () => !!(cur && cur.ex && cur.ex.flat), onInputChange: (k) => { inputKind = k; renderFeedbackIdle(); } });

  // ---------- views ----------
  const board = new window.Fretboard($('board'), { from: 0, to: 15, tuning, onPick });
  const tab = new window.SeqTab($('tab'), $('tabScroll'));
  const lane = new RP.Lane($('lane'));
  let boardFrom = 0;
  let boardTo = 15;
  let boardW = 1000;

  // ---------- stand mode: one screen, big, hands-free (for a phone or tablet on a music stand) ----------
  // The page shows only what you need while playing, the neck zooms in on the exercise's frets, a pedal
  // (or the arrow keys) starts and steps through, the first note you play can start an exercise, and
  // when the time is up the next exercise comes on its own.
  function boardWindow(ex) {
    const fs = ex ? [...ex.dots, ...ex.notes].map((n) => n.f) : [];
    if (!fs.length) return { from: 0, to: 15, width: 1000 }; // a break, or a rhythm drill (no notes on the neck)
    const maxF = Math.max(...fs);
    if (!standOn()) return { from: 0, to: Math.min(22, Math.max(15, maxF + 2)), width: 1000 };
    return window.Stand.fretWindow(fs, 22);
  }
  function applyBoard() {
    const ex = cur && cur.ex;
    const w = boardWindow(ex);
    if (w.from !== boardFrom || w.to !== boardTo || w.width !== boardW) {
      boardFrom = w.from; boardTo = w.to; boardW = w.width;
      board.configure({ from: w.from, to: w.to, tuning, width: w.width });
    }
    // On a narrow screen the full neck scrolls sideways: start it where the exercise is.
    const sc = $('board').parentElement;
    const fs = ex ? [...ex.dots, ...ex.notes].map((n) => n.f) : [];
    if (fs.length && sc.scrollWidth > sc.clientWidth + 1) {
      const lo = Math.max(boardFrom, Math.min(...fs) - 1);
      sc.scrollLeft = Math.max(0, ((board.x(lo) - 40) / boardW) * sc.scrollWidth);
    } else sc.scrollLeft = 0;
  }
  // The note that starts an exercise when you play it: its first note, else the key's root. A rhythm
  // drill starts on any strum.
  function startNote(ex) {
    if (!ex) return null;
    if (ex.grade === 'rhythm') return 'any';
    const first = ex.notes.find((n) => !n.rest);
    if (first) return first.midi;
    const r = ex.dots.find((d) => d.role === 'root');
    return r ? r.midi : null;
  }
  const stand = window.Stand.setup({
    page: 'session', store,
    parts: {
      l: ['#boardCard', '#laneCard', '#tabCard', ['#stats', 6]],
      r: [['.ex-card .ex-top', 1], ['.ex-card .ex-head', 2], ['.ex-card .ex-timer', 3], ['#exChord', 4], ['#feedback', 7], ['#rateRow', 7], ['.ex-card .ex-controls', 8]],
      b: ['.listen-card', '.ex-card .stand-opts'],
    },
    onRight: () => toggleGo(),
    onLeft: () => leftPedal(),
    onChange: (on) => {
      if (!on && cur && cur.state === 'timeup') cur.autoAt = 0;
      if (!cur) return;
      applyBoard();
      drawBoard();
      if (cur.ex && cur.ex.notes.length) tab.setNow(cur.grader && cur.grader.i != null ? cur.grader.i : Math.max(0, cur.clockIdx));
      renderFeedbackIdle();
    },
    startNote: () => (cur ? startNote(cur.ex) : null),
    canPlayStart: () => !!(cur && cur.item.kind === 'ex' && cur.ex && (cur.state === 'ready' || cur.state === 'paused')),
    start: () => start(),
  });
  const standOn = () => stand.on;
  const pop = (kind, text) => stand.pop(kind, text);
  // Pedals: right is Start / Pause / Resume, and Next when the time is up. Left is +2 min while
  // playing or when the time is up, else skip to the next exercise.
  function leftPedal() {
    if (!cur) return;
    if (cur.state === 'run' || cur.state === 'timeup') $('extendBtn').click();
    else next();
  }

  // ---------- the current exercise ----------
  let cur = null;

  function initialBpm(item, ex) {
    if (!ex) return 0;
    if (ex.fixedBpm) return ex.fixedBpm;
    const r = plan.results[item.uid];
    if (r && r.bpm) return r.bpm;
    if (ex.grade === 'rhythm') {
      // Where you last left it here, else on the Rhythm page, else the pattern's own tempo.
      const own = rhythmStore().ex;
      return learner.tempo(ex.tempoKey, ex.npb, (own && own[ex.rhythm.id] && own[ex.rhythm.id].bpm) || ex.startBpm);
    }
    return ex.tempoKey ? learner.tempo(ex.tempoKey, ex.npb) : G.START_BPM[ex.npb] || 70;
  }

  function select(idx) {
    if (cur) leave();
    idx = Math.max(0, Math.min(plan.items.length - 1, idx));
    plan.cur = idx;
    savePlan();
    const item = plan.items[idx];
    const ex = exOf(item);
    cur = {
      idx, item, ex, state: 'ready', bpm: initialBpm(item, ex), grader: null, rating: null,
      musicStart: null, beatDur: 0.8, countBeats: 4, cleanBpm: 0, struggled: false, bad: 0,
      revealed: new Set(), recent: [], chordIdx: 0, clockIdx: -1, recorded: false, run: null, hits: [],
    };
    applyBoard();
    board.setTargetString(null);
    renderCard();
    renderTab();
    renderLane();
    drawBoard();
    renderStats();
    renderPlan();
    renderFeedbackIdle();
  }

  // Leaving an exercise: stop the sound and, if you played it, feed the result to the skill model.
  function leave() {
    stopAudio();
    finish();
  }

  function finish() {
    if (!cur || !cur.ex || cur.recorded) return;
    const g = cur.grader;
    const micScore = g ? g.score() : null;
    const r = cur.rating;
    if (micScore == null && r == null) return;
    const score = micScore != null && r != null ? 0.7 * micScore + 0.3 * r : micScore != null ? micScore : r;
    learner.update(cur.ex.skill, score, plan.date, cur.item.desc);
    if (cur.ex.tempoKey && (g instanceof G.SeqGrader || g instanceof G.RhythmGrade || cur.ex.grade === 'tech') && g.passes.length && !cur.ex.fixedBpm) {
      learner.saveTempo(cur.ex.tempoKey, { bpm: cur.bpm, cleanBpm: cur.cleanBpm, struggled: cur.struggled && !cur.cleanBpm });
    }
    saveLearner();
    plan.results[cur.item.uid] = { score, bpm: cur.bpm, mic: micScore, rating: r };
    savePlan();
    const log = dayLog(plan.date);
    log.items[`${plan.seed}:${cur.item.uid}`] = { title: cur.ex.title, block: cur.item.block, skill: cur.ex.skill, score: Math.round(score * 100) / 100, bpm: cur.ex.fixedBpm ? null : cur.bpm };
    saveDays();
    cur.recorded = true;
    renderProgress();
  }

  let standMicTried = false;
  async function start() {
    if (!cur) return;
    await ensureAudio();
    // In stand mode the Hearing card is folded away: Start turns the input on (once; if you turn it
    // off or the browser says no, it stays off).
    if (standOn() && !engine.micOn && !standMicTried && cur.item.kind === 'ex') {
      standMicTried = true;
      try { await mic.enable(); } catch { /* the Hearing strip says why */ }
    }
    if (cur.item.kind === 'rest') {
      cur.state = 'run';
      renderCard();
      acquireWakeLock();
      return;
    }
    if (!cur.grader) {
      cur.grader = cur.ex.grade === 'seq' ? new G.SeqGrader(cur.ex, { strictOctave: settings.strictOctave })
        : cur.ex.grade === 'tech' ? Tech.grader(cur.ex, { SeqGrader: G.SeqGrader, strictOctave: settings.strictOctave })
          : cur.ex.grade === 'rhythm' ? new G.RhythmGrade(cur.ex) : new G.FreeGrader(cur.ex);
    }
    cur.recorded = false;
    // Palm mutes and stops need every pick attack, muted or not: the onset detector hears them.
    if (cur.ex.onsets) {
      try {
        await engine.enableOnsets('js/onset.js?v=1');
        engine.setOnsetParams({ threshold: 4.5, gateDb: engine.tracker.gateDb, refractory: 0.06 });
      } catch (err) { say('bad', 'Audio', err.message); return; }
    }
    if (cur.ex.grade === 'rhythm') { if (!(await startRhythm())) return; } else startClock(true);
    cur.state = 'run';
    acquireWakeLock();
    renderCard();
    drawBoard();
    renderStats();
    if (!engine.micOn) say('hint', 'Mic is off', 'Enable it on the right to get graded, or rate the exercise yourself when you finish.');
    else if (cur.ex.backing && settings.backOn && inputKind === 'mic') say('hint', 'Headphones?', 'The mic can hear the backing. Use headphones, or turn Backing off.');
    else if (cur.ex.grade === 'rhythm') say('hint', 'Count-in', `${cur.run.countBeats} clicks, then play.${cur.ex.rhythm.click.mode === 'all' ? '' : ` After that the click is ${cur.ex.chips[2][1]}.`}`);
    else if (cur.ex.grade === 'tech') say('hint', 'Go', TECH_GO[cur.ex.tech.kind]);
    else say('hint', 'Go', cur.ex.grade === 'seq' ? 'Play along with the click. The next note is ringed on the fretboard.' : 'Play along. Notes that fit show up teal, the rest red.');
  }

  // ---------- rhythm exercises: the Run in js/rhythmplay.js, graded on timing by the onset detector ----------
  // The timing offset and Hit sensitivity are set on the Rhythm page (ff.rhythm).
  const rhythmStore = () => store.get('ff.rhythm', {});
  const rhythmLatency = () => {
    const l = rhythmStore().lat;
    return l ? l.ms / 1000 : (engine.ctx.outputLatency || engine.ctx.baseLatency || 0.01) + 0.015;
  };
  function rhythmDetector() {
    if (!cur || !cur.ex || cur.ex.grade !== 'rhythm' || !engine.onsetNode) return;
    const rs = rhythmStore().settings || {};
    const p = Rh.byId(cur.ex.rhythm.id);
    engine.setOnsetParams({
      threshold: 9 - 0.065 * (rs.hitSens != null ? rs.hitSens : 70),
      gateDb: engine.tracker.gateDb,
      refractory: Math.min(0.09, Math.max(0.03, 0.45 * Rh.minGapBeats(p) * (60 / cur.bpm))),
    });
  }
  async function startRhythm() {
    const c = cur;
    try { await engine.enableOnsets('js/onset.js?v=1'); } catch (err) { say('bad', 'Audio', err.message); return false; }
    applyClick();
    rhythmDetector();
    c.hits = [];
    showRhythmIdle();
    c.run = new RP.Run({
      engine, pattern: Rh.byId(c.ex.rhythm.id), bpm: c.bpm, click: c.ex.rhythm.click, latency: rhythmLatency, lane,
      ladder: () => settings.autoTempo && engine.micOn,
      on: {
        state: (st) => { if (st === 'run' && cur === c && c.run && !c.run.leakWarned && engine.micOn) say('hint', 'Go', 'Play along. The dots show where each hit landed: left is early, right is late.'); },
        hit: (res) => { if (cur === c) showRhythmHit(res.off); },
        extra: (res) => { if (cur === c) showRhythmExtra(res.why); },
        pass: (info) => { if (cur === c) onRhythmPass(info); },
        leak: () => { if (cur === c) say('bad', 'The input hears the click', 'Every count-in click came back through the input, so the click would count as your hits. Use headphones, or turn off loopback on your interface.'); },
        beat: (k, { countIn, quiet }) => {
          if (cur !== c) return;
          const dots = $('beats').children;
          for (let i = 0; i < dots.length; i++) { dots[i].classList.toggle('on', i === k); dots[i].classList.toggle('count', countIn); dots[i].classList.toggle('quiet', quiet); }
        },
      },
    });
    c.run.start();
    return true;
  }
  function onRhythmPass({ st, verdict, bpm, change, text }) {
    // Nothing heard (input off, or you stopped to listen): no grade for that pass.
    if (!engine.micOn || !st.hits) { say('hint', 'No hits heard', engine.micOn ? 'Play along with the click: every strum is timed.' : 'Turn on the mic (right) to get graded.'); return; }
    cur.grader.pass(st, verdict);
    if (verdict.clean) cur.cleanBpm = Math.max(cur.cleanBpm, bpm);
    if (change) {
      const was = cur.bpm;
      cur.bpm = cur.run.bpm;
      $('bpm').textContent = cur.bpm;
      if (change < 0) cur.struggled = true;
      rhythmDetector();
      say(change > 0 ? 'ok' : 'warn', change > 0 ? 'Clean passes' : 'Slowing down', `${text}. ${change > 0 ? 'Up' : 'Down'} to ${cur.bpm} bpm (from ${was}).`);
    } else if (verdict.clean) {
      say('ok', 'Clean pass', `${text}${cur.run.tempo.need > 1 ? ` · ${cur.run.tempo.clean}/${cur.run.tempo.need} in a row` : ''}`);
    } else {
      const tip = Rh.tips(st).find((t) => t.level === 'warn');
      say(verdict.rough ? 'bad' : 'warn', 'Pass', `${text}${st.extras ? ` · ${st.extras} extra` : ''}.${tip ? ` ${tip.text}` : ''}`);
    }
    renderStats();
  }
  function showRhythmIdle() {
    $('nowHit').dataset.cls = '';
    $('nowVal').textContent = '–';
    $('nowSub').textContent = 'your last hit';
    RP.drawStrip($('tstrip'), cur ? cur.hits : []);
  }
  function showRhythmHit(off) {
    const f = Rh.feel(off);
    $('nowHit').dataset.cls = f.cls;
    $('nowVal').textContent = f.text === 'on the beat' ? 'On the beat' : f.text;
    $('nowSub').textContent = `your last hit · ${off >= 0 ? '+' : '−'}${Math.abs(Math.round(off * 1000))} ms`;
    cur.hits.push(off * 1000);
    if (cur.hits.length > 32) cur.hits.shift();
    RP.drawStrip($('tstrip'), cur.hits);
  }
  function showRhythmExtra(why) {
    $('nowHit').dataset.cls = 'extra';
    $('nowVal').textContent = 'Extra';
    $('nowSub').textContent = RP.EXTRA_WHERE[why] || '';
  }
  // A rhythm exercise shows the lane instead of the fretboard.
  function renderLane() {
    const rh = !!(cur && cur.ex && cur.ex.grade === 'rhythm');
    $('laneCard').hidden = !rh;
    $('boardCard').hidden = rh;
    if (!rh) return;
    const ex = cur.ex;
    $('laneCard').dataset.block = 'rhythm';
    $('laneTitle').textContent = `Rhythm · ${Rh.byId(ex.rhythm.id).name}`;
    $('laneNote').textContent = ex.chips.map(([k, v]) => `${k.toLowerCase()} ${v}`).join(' · ');
    lane.draw(Rh.byId(ex.rhythm.id));
    showRhythmIdle();
  }

  function startClock(countIn) {
    const beatDur = 60 / cur.bpm;
    const startAt = engine.ctx.currentTime + 0.12;
    cur.beatDur = beatDur;
    cur.countBeats = countIn ? 4 : 0;
    cur.musicStart = startAt + cur.countBeats * beatDur;
    cur.clockIdx = -1;
    if (cur.grader && cur.grader.resync) cur.grader.resync(); // the bar count starts again
    applyClick();
    engine.startMetronome({ bpm: cur.bpm, startAt, accentEvery: 4, onBeat });
  }

  function onBeat(i, t) {
    if (!cur) return;
    const c = cur;
    const delay = Math.max(0, (t - engine.ctx.currentTime) * 1000);
    setTimeout(() => showBeat(c, i), delay);
    const j = i - c.countBeats;
    const bk = c.ex && c.ex.backing;
    if (bk && settings.backOn && pad && j >= 0 && j % 4 === 0) {
      const barDur = 4 * c.beatDur;
      if (bk.type === 'drone') pad.drone(bk.root, t, barDur);
      else {
        const ch = bk.chords[(j / 4) % bk.chords.length];
        pad.chord(ch.root, ch.pcs, t, barDur - 0.05);
      }
    }
  }

  function showBeat(c, i) {
    if (cur !== c || c.state !== 'run') return;
    const dots = $('beats').children;
    for (let k = 0; k < dots.length; k++) {
      dots[k].classList.toggle('on', k === i % 4);
      dots[k].classList.toggle('count', i < c.countBeats);
    }
  }

  function stopAudio() {
    engine.stopMetronome();
    if (cur && cur.run) { cur.run.stop(); cur.run = null; }
    for (const d of $('beats').children) d.classList.remove('quiet');
    if (pad) pad.stop();
    for (const d of $('beats').children) d.classList.remove('on', 'count');
    releaseWakeLock();
  }

  function pause() {
    if (!cur) return;
    stopAudio();
    cur.state = 'paused';
    stand.stopped();
    renderCard();
    say('hint', 'Paused', 'Space to carry on. Rate it whenever you like.');
  }

  function timeUp() {
    stopAudio();
    if (pad) pad.chime();
    cur.state = 'timeup';
    renderCard();
    renderPlan();
    if (standOn() && stand.opts.autoNext) {
      cur.autoAt = performance.now() + AUTO_NEXT_MS;
      pop('ok', cur.item.kind === 'rest' ? 'Break’s over' : 'Time’s up');
      autoNextTick();
      return;
    }
    if (cur.item.kind === 'rest') say('ok', 'Break’s over', 'Next when you’re ready.');
    else say('ok', 'Time’s up', 'Rate it (it steers what comes back), then Next. Or +2 min to keep going.');
  }

  // Auto next (stand mode): a countdown after the time is up, then the next exercise. A break starts
  // its timer on its own; an exercise waits for you (or for its first note, with Play to start).
  const AUTO_NEXT_MS = 8000;
  function autoNextTick() {
    if (!cur || cur.state !== 'timeup' || !cur.autoAt) return;
    const left = Math.ceil((cur.autoAt - performance.now()) / 1000);
    if (left > 0) {
      say('ok', cur.item.kind === 'rest' ? 'Break’s over' : 'Time’s up', `Next in ${left} s. Left pedal: +2 min. Right pedal: next now.`);
      return;
    }
    cur.autoAt = 0;
    const last = cur.idx === plan.items.length - 1;
    next();
    if (!last && cur.item.kind === 'rest') start();
  }

  function next(step = 1) {
    if (!cur) return;
    const n = cur.idx + step;
    if (n >= plan.items.length) {
      leave();
      cur.state = 'ready';
      renderCard();
      if (standOn()) stand.set(false);
      say('ok', 'Session done', `${Math.round(totalPlayed() / 60)} minutes today. Your skill map is below.`);
      $('progressPanel').scrollIntoView({ behavior: 'smooth' });
      return;
    }
    select(n);
  }

  function setBpm(b, { restart = true } = {}) {
    if (!cur || !cur.ex || cur.ex.fixedBpm) return;
    cur.bpm = Math.max(G.MIN_BPM, Math.min(G.MAX_BPM, Math.round(b)));
    $('bpm').textContent = cur.bpm;
    if (restart && cur.state === 'run') {
      if (cur.run) { cur.run.setBpm(cur.bpm); rhythmDetector(); } else startClock(false);
    }
    renderStats();
  }
  const step = () => G.tempoStep(cur && cur.ex ? cur.ex.npb : 2);

  // ---------- hearing notes ----------
  engine.on('note', (ev) => { stand.heard(ev.midi); hearingId = ev.id; played(ev.midi, ev.playedAt, false); hearingId = null; });

  // String check (js/stringid.js): exercises ask for each note at a place. When a found note's
  // sound clearly says another string, give a hint. It never changes the grade.
  const SI = window.StringId;
  const newCheck = () => (SI ? new SI.StringCheck({ model: SI.StringModel.fromJSON(store.get('ff.strings', null)), tuning: tuning.open }) : null);
  let strCheck = newCheck();
  let hearingId = null;
  window.addEventListener('ff:strings', () => { strCheck = newCheck(); });
  engine.on('timbre', ({ id, feat }) => {
    if (!cur || !cur.ex || cur.state !== 'run') return;
    const r = strCheck && strCheck.check(id, feat);
    if (!r) return;
    const w = r.want;
    board.flash({ s: r.s, f: r.f, kind: 'wrong', label: '?' }, 1200);
    say('warn', `${nameOf(w.midi, w.chord)}: other string?`, `it sounded like the ${T.stringLongName(r.s, tuning)} string fret ${r.f}; this exercise has it on the ${T.stringLongName(w.s, tuning)} string fret ${w.f}. It still counted.`);
  });
  engine.on('frame', (info) => {
    if (!cur || cur.state !== 'run' || !cur.grader) return;
    if (cur.ex.grade === 'tech') {
      if (cur.musicStart == null) return;
      const ev = cur.grader.frame(info, info.t - latency() - cur.musicStart, cur.beatDur);
      if (ev.length) handleTech(ev);
      return;
    }
    if (cur.ex.grade !== 'seq') return;
    const ev = cur.grader.frame(info, info.t);
    if (ev.length) handleSeq(ev, info.midi);
  });
  engine.on('onset', (o) => {
    if (!cur || cur.state !== 'run' || !cur.grader || cur.ex.grade !== 'tech' || !cur.grader.onset || cur.musicStart == null) return;
    const ev = cur.grader.onset(o, o.t - latency() - cur.musicStart, cur.beatDur);
    if (ev.length) handleTech(ev);
  });

  // ---------- technique exercises (js/technique.js): graded from the frames, not the note events ----------
  const Tech = window.Technique;
  const TECH_GO = {
    vibrato: 'Pick the ringed note and hold it for the bar with vibrato. Then the next one.',
    legato: 'Pick the first note of each beat; hammer on and pull off the rest.',
    palm: 'PM notes muted at the bridge, open notes ringing.',
    stop: 'Two beats of 8ths, then dead silence from beat 3.',
  };
  function handleTech(events) {
    const ex = cur.ex;
    for (const e of events) {
      if (e.kind === 'hit') tab.setState(e.i, 'hit');
      else if (e.kind === 'miss') tab.setState(e.i, 'miss');
      else if (e.kind === 'wrong') {
        flashWrong(e.midi);
        const want = ex.notes[e.i];
        say('bad', `Heard ${nameOf(e.midi)}`, `next is ${nameOf(want.midi)}, ${T.stringLongName(want.s, tuning)} string fret ${want.f}`);
      } else if (e.kind === 'pass') tab.clearStates();
      else if (e.kind === 'rep') onTechRep(e.result);
    }
    if (!ex.clock) tab.setNow(cur.grader.i);
    drawBoard();
    renderStats();
  }
  function onTechRep(r) {
    const g = cur.grader;
    if (r.clean) cur.cleanBpm = Math.max(cur.cleanBpm, cur.bpm);
    if (settings.autoTempo && !cur.ex.fixedBpm && cur.ex.tempoKey) {
      if (r.clean && g.cleanStreak >= g.cleanNeeded) {
        g.resetStreak();
        cur.bad = 0;
        const was = cur.bpm;
        setBpm(cur.bpm + step());
        say('ok', `Clean ×${g.cleanNeeded}`, `${r.text} Up to ${cur.bpm} bpm (from ${was}).`);
        pop('ok', `Clean · up to ${cur.bpm} bpm`);
        return;
      }
      if (!r.clean && r.score < 0.55) {
        if (++cur.bad >= 2) {
          cur.bad = 0;
          cur.struggled = true;
          setBpm(cur.bpm - step());
          say('warn', 'Slowing down', `${r.text} Two rough ones: ${cur.bpm} bpm.`);
          pop('warn', `Slower · ${cur.bpm} bpm`);
          return;
        }
      } else cur.bad = 0;
    }
    say(r.kind, r.tag, r.text);
    pop(r.kind, r.clean && g.cleanNeeded > 1 && !cur.ex.fixedBpm ? `${r.tag} ${g.cleanStreak}/${g.cleanNeeded}` : r.tag);
  }

  function played(midi, t, fromClick) {
    if (!cur || !cur.ex || cur.state !== 'run' || !cur.grader || cur.ex.grade === 'rhythm' || cur.ex.grade === 'tech') return;
    const tt = t - (fromClick ? 0 : latency());
    if (cur.ex.grade === 'seq') {
      const dev = cur.ex.timing && !fromClick && cur.musicStart != null && tt >= cur.musicStart - cur.beatDur / 2 ? gridDev(tt) : null;
      handleSeq(cur.grader.note(midi, dev), midi);
    } else {
      handleFree(cur.grader.note(midi, atTime(tt)), midi);
    }
  }

  function gridDev(tt) {
    const unit = cur.beatDur / cur.ex.npb;
    const k = Math.round((tt - cur.musicStart) / unit);
    return tt - (cur.musicStart + k * unit);
  }

  function atTime(tt) {
    if (cur.musicStart == null) return null;
    const rel = tt - cur.musicStart;
    const barDur = 4 * cur.beatDur;
    const bar = Math.floor(rel / barDur);
    const beat = (rel - bar * barDur) / cur.beatDur;
    const n = cur.ex.chords ? cur.ex.chords.length : 1;
    return { bar, beat, chord: mod12n(bar, n) };
  }
  const mod12n = (x, n) => ((x % n) + n) % n;
  // A note's name in what's being played: as a tone of the sounding chord (the 3rd of D7 is F♯),
  // else as a degree of the exercise's scale (the ♭2 of A Phrygian is B♭), else by the key's accidentals.
  const nameOf = (midi, chordIdx = cur ? cur.chordIdx : null) => {
    const ex = cur && cur.ex;
    const pc = T.mod12(Math.round(midi));
    const ch = ex && ex.chords && chordIdx != null ? ex.chords[chordIdx] : null;
    return (ch && ch.names && ch.names[pc]) || (ex && ex.names && ex.names[pc]) || T.noteName(midi, !!(ex && ex.flat));
  };
  const posKey = (n) => `${n.s}:${n.f}`;

  function handleSeq(events, midi) {
    const ex = cur.ex;
    for (const e of events) {
      if (e.kind === 'hit') {
        tab.setState(e.i, 'hit');
        if (ex.hidden) { tab.reveal(e.i); cur.revealed.add(posKey(ex.notes[e.i])); }
        const want = ex.notes[e.i];
        // Not for bends (the pitch isn't the fretted note's) or exercises that take any octave.
        if (strCheck && hearingId != null && !ex.matchPc && !want.bend) strCheck.expect(hearingId, want);
        if (e.cents != null) {
          const c = Math.round(e.cents);
          say(Math.abs(c) <= 15 ? 'ok' : 'warn', Math.abs(c) <= 15 ? 'Bend in tune' : c < 0 ? 'Bend a little flat' : 'Bend a little sharp', `${c > 0 ? '+' : ''}${c}¢`);
        }
      } else if (e.kind === 'miss') {
        tab.setState(e.i, 'miss');
      } else if (e.kind === 'wrong') {
        flashWrong(midi);
        const want = ex.notes[e.i];
        say('bad', `Heard ${nameOf(midi, want.chord)}`, `next is ${nameOf(want.midi, want.chord)}${ex.matchPc ? '' : ` (${want.label})`}, ${T.stringLongName(want.s, tuning)} string fret ${want.f}${want.bend ? ', bent up' : ''}`);
      } else if (e.kind === 'arm') {
        say('hint', 'Now bend', `push it up to ${nameOf(ex.notes[e.i].midi)}`);
      } else if (e.kind === 'under') {
        if (!cur.underAt || performance.now() - cur.underAt > 900) { cur.underAt = performance.now(); say('warn', 'Bend higher', `${Math.round(e.cents)}¢ under`); }
      } else if (e.kind === 'pass') {
        onPass(e.result);
      }
    }
    tab.setNow(cur.grader.i);
    drawBoard();
    renderStats();
  }

  function onPass(r) {
    const g = cur.grader;
    tab.clearStates();
    if (cur.ex.hidden) cur.revealed.clear();
    if (r.clean) cur.cleanBpm = Math.max(cur.cleanBpm, cur.bpm);
    const summary = `${pct(r.acc)} of the notes${r.timing != null && cur.ex.timing ? ` · timing ±${Math.round(r.timing)} ms` : ''}${r.cents != null ? ` · bends ${r.cents > 0 ? '+' : ''}${Math.round(r.cents)}¢` : ''}`;
    if (settings.autoTempo && !cur.ex.fixedBpm && cur.ex.timing) {
      if (r.clean && g.cleanStreak >= g.cleanNeeded) {
        g.cleanStreak = 0;
        cur.bad = 0;
        const was = cur.bpm;
        setBpm(cur.bpm + step());
        say('ok', `Clean ×${g.cleanNeeded}`, `${summary}. Up to ${cur.bpm} bpm (from ${was}).`);
        pop('ok', `Clean · up to ${cur.bpm} bpm`);
        return;
      }
      if (!r.clean && r.acc < 0.6) {
        cur.bad++;
        if (cur.bad >= 2) {
          cur.bad = 0;
          cur.struggled = true;
          setBpm(cur.bpm - step());
          say('warn', 'Slowing down', `${summary}. Two rough passes: ${cur.bpm} bpm. Accuracy first.`);
          pop('warn', `Slower · ${cur.bpm} bpm`);
          return;
        }
      } else cur.bad = 0;
    }
    if (r.clean) pop('ok', g.cleanNeeded > 1 ? `Clean ${g.cleanStreak}/${g.cleanNeeded}` : 'Clean pass');
    else pop(r.acc >= 0.75 ? 'warn' : 'bad', `${pct(r.acc)} of the notes`);
    if (r.clean) say('ok', 'Clean pass', `${summary}${g.cleanNeeded > 1 ? ` · ${g.cleanStreak}/${g.cleanNeeded} in a row` : ''}`);
    else say(r.acc >= 0.75 ? 'warn' : 'bad', 'Pass', `${summary}${r.timing != null && r.timing > 60 ? ' · lock in with the click' : ''}`);
  }

  function handleFree(r, midi) {
    cur.recent.push({ name: nameOf(midi), ok: r.ok, land: r.land });
    if (cur.recent.length > 14) cur.recent.shift();
    if (r.land === true) say('ok', 'Landed', `${nameOf(midi)} on beat 1`);
    else if (r.land === false) say('warn', 'Beat 1', `${nameOf(midi)}: aim for ${landHint()}`);
    if (!r.ok) flashWrong(midi);
    renderStats();
  }

  function landHint() {
    const ex = cur.ex;
    if (ex.land === 'qa') return 'the 5th (end of the question) or the root (end of the answer)';
    const ch = ex.chords && ex.chords[cur.chordIdx];
    if (!ch) return 'a chord tone';
    if (ex.land === 'third') return `${(ch.tones && ch.tones[1]) || nameOf(ch.root + S.CHORDS[ch.chordId].steps[1])}, the 3rd of ${ch.name}`;
    return `a note of ${ch.name}`;
  }

  // Show a wrong note where it most likely was: the nearest place to the note you were aiming for.
  function flashWrong(midi) {
    const ex = cur.ex;
    const ref = ex.notes.length ? ex.notes[cur.grader && cur.grader.i != null ? cur.grader.i : 0] : ex.dots[0];
    if (!ref) return;
    let best = null;
    for (const s of T.STRINGS) {
      const f = midi - tuning.open[s];
      if (f < boardFrom || f > boardTo) continue;
      const d = Math.abs(f - ref.f) + Math.abs(s - ref.s) * 0.7;
      if (!best || d < best.d) best = { s, f, d };
    }
    if (best) board.flash({ s: best.s, f: best.f, kind: 'wrong', label: nameOf(midi) }, 900);
  }

  async function onPick(s, f) {
    await ensureAudio();
    const midi = T.midiAt(s, f, tuning);
    engine.pluck(midi);
    played(midi, engine.ctx.currentTime, true);
  }

  // ---------- the clock: timers and the beat-driven pointer ----------
  let lastTick = performance.now();
  let sinceSave = 0;
  setInterval(() => {
    const now = performance.now();
    const dt = Math.min(1, (now - lastTick) / 1000);
    lastTick = now;
    if (cur && cur.state === 'timeup' && cur.autoAt) autoNextTick();
    if (!cur || cur.state !== 'run') return;
    const uid = cur.item.uid;
    plan.played[uid] = (plan.played[uid] || 0) + dt;
    dayLog(plan.date).sec += dt;
    sinceSave += dt;
    if (sinceSave > 5) { sinceSave = 0; savePlan(); saveDays(); }
    renderTimer();
    if (plan.played[uid] >= cur.item.minutes * 60 + (cur.extra || 0)) timeUp();
  }, 250);

  function frame() {
    requestAnimationFrame(frame);
    if (!cur || !cur.ex || cur.state !== 'run' || cur.musicStart == null || !engine.ctx) return;
    const ex = cur.ex;
    const t = engine.ctx.currentTime - (engine.ctx.outputLatency || 0);
    const rel = t - cur.musicStart;
    if (ex.chords && ex.backing && ex.backing.type === 'chords') {
      const bar = Math.floor(rel / (4 * cur.beatDur));
      const ci = rel < 0 ? 0 : mod12n(bar, ex.chords.length);
      if (ci !== cur.chordIdx || !cur.chordShown) {
        cur.chordIdx = ci;
        cur.chordShown = true;
        $('chordNow').textContent = ex.chords[ci].name;
        $('chordNext').textContent = `→ ${ex.chords[(ci + 1) % ex.chords.length].name}`;
        drawBoard();
      }
    }
    if (ex.clock && ex.notes.length && rel >= 0) {
      const i = mod12n(Math.floor(rel / (cur.beatDur / ex.npb)), ex.notes.length);
      if (i !== cur.clockIdx) { cur.clockIdx = i; tab.setNow(i); drawBoard(); }
    }
  }
  requestAnimationFrame(frame);

  // ---------- rendering ----------
  function say(kind, tag, text) {
    const fb = $('feedback');
    fb.className = `feedback ${kind}`;
    fb.innerHTML = `<span class="tag">${esc(tag)}</span><span>${esc(text)}</span>`;
  }

  function renderFeedbackIdle() {
    if (!cur || cur.state === 'run') return;
    if (cur.item.kind === 'rest') { say('hint', 'Break', 'Start the timer, put the guitar down for two minutes.'); return; }
    if (cur.state !== 'ready') return;
    if (standOn()) {
      const sn = startNote(cur.ex);
      const how = engine.micOn && stand.opts.playStart && sn === 'any' ? 'Strum to start, or press the right pedal.'
        : engine.micOn && stand.opts.playStart && sn != null ? `Play ${nameOf(sn)} to start, or press the right pedal.`
          : engine.micOn ? 'Right pedal or Start.' : standMicTried ? 'The input is off: turn it on below to get graded.' : 'Start turns the input on, so the app can grade you.';
      say('hint', 'Ready', how);
      return;
    }
    const mic = engine.micOn ? '' : ' Turn on the mic (right) to get graded.';
    if (cur.ex && cur.ex.grade === 'rhythm') {
      const lat = rhythmStore().lat ? '' : ' For exact timing, measure your timing offset once on the Rhythm page.';
      say('hint', 'Ready', `Start gives you a count-in. Use headphones: a mic that hears the click counts it as your hits.${mic}${lat}`);
      return;
    }
    const tip = cur.ex && cur.ex.grade === 'tech' && inputKind === 'mic' ? ' This one grades your tone, so it works best through an audio interface; with a mic, use headphones and play close to it.' : '';
    say('hint', 'Ready', `Start gives you one bar of clicks first.${mic}${tip}`);
  }

  function renderCard() {
    const { item, ex } = cur;
    const card = $('exCard');
    card.dataset.block = item.block;
    card.dataset.state = cur.state;
    $('boardCard').classList.toggle('stand-hide', !ex); // Stand mode: no empty neck during a break
    $('standView').dataset.block = item.block;
    $('standView').dataset.state = cur.state;
    const exs = exercises();
    const num = exs.indexOf(item) + 1;
    $('exKicker').textContent = item.kind === 'rest' ? 'Break' : `${G.BLOCKS[item.block].name} · ${num} of ${exs.length}`;
    $('focusBadge').hidden = !(item.desc && item.desc.focus);
    if (!ex) {
      $('exTitle').textContent = 'Break · 2 minutes';
      $('exChips').innerHTML = '';
      $('exHow').textContent = 'Put the guitar down. Shake out your hands, stretch your wrists and forearms (palm up, then palm down, gently), roll your shoulders, drink some water, and look at something far away.';
      $('exWhy').textContent = 'Short breaks every half hour keep tendons happy on long sessions, and your brain consolidates what you just practiced while you rest.';
      $('exCue').textContent = '';
      $('exChord').hidden = true;
      $('tempoBox').hidden = true;
      $('backBtn').hidden = true;
      $('clickBtn').hidden = true;
      $('rateRow').hidden = true;
    } else {
      $('exTitle').textContent = ex.title;
      $('exChips').innerHTML = ex.chips.map(([k, v]) => `<span class="ex-chip">${esc(k)}<b>${esc(v)}</b></span>`).join('');
      $('exHow').textContent = ex.how;
      $('exWhy').textContent = ex.why;
      const cues = ex.cues && ex.cues.length ? ex.cues : G.CUES;
      $('exCue').innerHTML = `<b>Focus:</b> ${esc(cues[G.hashStr(`${plan.date}${item.uid}`) % cues.length])}`;
      const chordy = !!(ex.chords && ex.backing && ex.backing.type === 'chords');
      $('exChord').hidden = !chordy;
      if (chordy && cur.state !== 'run') { $('chordNow').textContent = ex.chords[0].name; $('chordNext').textContent = `→ ${ex.chords[1 % ex.chords.length].name}`; }
      $('tempoBox').hidden = false;
      $('tempoBox').classList.toggle('fixed', !!ex.fixedBpm);
      $('bpm').textContent = cur.bpm;
      $('backBtn').hidden = !ex.backing;
      $('backBtn').textContent = ex.backing && ex.backing.type === 'drone' ? 'Drone' : 'Chords';
      $('clickBtn').hidden = false;
      $('rateRow').hidden = !(cur.grader || cur.state === 'timeup');
      $('rateQ').textContent = ex.grade === 'free' ? 'How did it feel?' : 'How did it go?';
    }
    $('clickBtn').setAttribute('aria-pressed', String(settings.clickOn));
    $('backBtn').setAttribute('aria-pressed', String(settings.backOn));
    syncRate();
    const go = $('goBtn');
    go.innerHTML = cur.state === 'run' ? 'Pause <kbd>Space</kbd>' : cur.state === 'paused' ? 'Resume <kbd>Space</kbd>' : cur.state === 'timeup' ? 'Next <kbd>Space</kbd>' : 'Start <kbd>Space</kbd>';
    $('prevBtn').disabled = cur.idx === 0;
    $('nextBtn').innerHTML = cur.idx === plan.items.length - 1 ? 'Finish <kbd>N</kbd>' : 'Next <kbd>N</kbd>';
    $('boardTitle').textContent = ex ? `${ex.famName}${ex.chips[1] ? ` · ${ex.chips[1][1]}` : ''}` : 'Rest';
    renderTimer();
  }

  function syncRate() {
    $('rateSeg').querySelectorAll('button').forEach((b) => {
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(cur && cur.rating === Number(b.dataset.value)));
    });
  }

  function renderTimer() {
    if (!cur) return;
    const total = cur.item.minutes * 60 + (cur.extra || 0);
    const p = playedSec(cur.item);
    $('slotFill').style.width = `${Math.min(100, (p / total) * 100)}%`;
    $('slotText').textContent = p >= total ? `+${mmss(p - total)}` : `${mmss(total - p)} left`;
    $('dayPlayed').textContent = `${Math.floor(totalPlayed() / 60)} of ${plan.minutes} min`;
    const seg = $('timeline').children[cur.idx];
    if (seg) seg.querySelector('.tl-fill').style.width = `${Math.min(100, (p / (cur.item.minutes * 60)) * 100)}%`;
  }

  function renderTab() {
    const ex = cur.ex;
    if (!ex || !ex.notes.length) {
      $('tabCard').hidden = true;
      tab.render([]);
      return;
    }
    $('tabCard').hidden = false;
    tab.render(ex.notes, { npb: ex.npb, hidden: ex.hidden, chords: ex.chords });
    $('tabTitle').textContent = ex.clock ? 'A path through the changes (it follows the beat)' : `Sequence · ${ex.notes.length} notes, then it loops`;
    $('tabNote').textContent = ex.tabNote ? ex.tabNote : ex.hidden ? 'Hidden until you find each one' : `${G.RHYTHM[ex.npb]}${ex.npb >= 1 ? `, ${ex.npb} per click` : ', one every 2 clicks'}`;
    tab.setNow(0);
    $('tabScroll').scrollTop = 0;
  }

  // The board: the shape colored by degree (or the sounding chord's tones), and a ring on the next note.
  function drawBoard() {
    const ex = cur && cur.ex;
    if (!ex) { board.setDots([]); board.setTargetString(null); return; }
    const lab = (midi, label) => (settings.labels === 'note' ? nameOf(midi) : label);
    let dots;
    const chordy = ex.chords && ex.backing && ex.backing.type === 'chords';
    if (chordy && (ex.fam === 'changes' || ex.fam === 'guide')) {
      const ch = ex.chords[cur.chordIdx] || ex.chords[0];
      const fs = ex.dots.map((d) => d.f);
      const lo = Math.max(0, Math.min(...fs) - 1);
      const hi = Math.max(...fs) + 1;
      const steps = S.CHORDS[ch.chordId].steps;
      const want = ex.fam === 'guide' ? [steps[1], steps.length > 3 ? steps[3] : steps[2]] : steps;
      dots = ex.dots.map((d) => ({ s: d.s, f: d.f, kind: 'deg', tone: 'ghost', label: '' }));
      for (const s of T.STRINGS) {
        for (let f = lo; f <= hi; f++) {
          const midi = tuning.open[s] + f;
          const semi = mod12(midi - ch.root);
          if (!want.includes(semi)) continue;
          dots.push({ s, f, kind: 'deg', tone: S.chordRole(semi), label: lab(midi, S.degreeLabel(semi, { chordId: ch.chordId })) });
        }
      }
    } else {
      dots = ex.dots.map((d) => {
        if (ex.hidden && !cur.revealed.has(posKey(d))) return { s: d.s, f: d.f, kind: 'hidden-dot', label: '?' };
        return { s: d.s, f: d.f, kind: 'deg', tone: d.role, label: d.role === 'ghost' ? '' : lab(d.midi, d.label) };
      });
      if (chordy && ex.land === 'third') {
        const ch = ex.chords[cur.chordIdx] || ex.chords[0];
        const third = mod12(ch.root + S.CHORDS[ch.chordId].steps[1]);
        const fs = ex.dots.map((d) => d.f);
        for (const s of T.STRINGS) for (let f = Math.max(0, Math.min(...fs) - 1); f <= Math.max(...fs) + 1; f++) if (mod12(tuning.open[s] + f) === third) dots.push({ s, f, kind: 'target', label: '' });
      }
    }
    let target = null;
    if (ex.notes.length && cur.item.kind === 'ex') {
      const i = ex.clock ? Math.max(0, cur.clockIdx) : cur.grader ? cur.grader.i : 0;
      const n = ex.notes[i];
      if (n && !n.rest) {
        if (ex.hidden) target = n.s;
        else dots.push({ s: n.s, f: n.f, kind: 'now', label: '' });
      }
    }
    board.setTargetString(target);
    board.setDots(dots);
  }

  function stat(label, value, cls = '') {
    return `<div class="stat ${cls}"><span class="stat-label">${esc(label)}</span><span class="stat-value">${value}</span></div>`;
  }
  const grade = (x, good, meh) => (x == null ? '' : x >= good ? 'good' : x >= meh ? 'meh' : 'bad');

  function renderStats() {
    const ex = cur && cur.ex;
    const el = $('stats');
    if (!ex) { el.innerHTML = ''; return; }
    const g = cur.grader;
    if (ex.grade === 'rhythm') {
      const last = g && g.passes.length ? g.passes[g.passes.length - 1] : null;
      const need = cur.run ? cur.run.tempo.need : 2;
      const streak = cur.run ? cur.run.tempo.clean : 0;
      const pips = `<span class="pips">${Array.from({ length: need }, (_, i) => `<i class="${i < streak ? 'on' : ''}"></i>`).join('')}</span>`;
      const best = Math.max(learner.best(ex.tempoKey), cur.cleanBpm);
      const lv = (v, a, b) => (v <= a ? 'good' : v <= b ? 'meh' : 'bad');
      el.innerHTML = [
        stat(`Last pass${g && g.passes.length ? ` (${g.passes.length})` : ''}`, last ? `${pct(last.hitRate)}<small>hits</small>` : '–', last ? lv(1 - last.hitRate, 0.05, 0.2) : ''),
        stat('Average', last ? (Math.abs(last.bias) < 1 ? '0<small>ms</small>' : `${Math.round(Math.abs(last.bias))}<small>ms ${last.bias < 0 ? 'early' : 'late'}</small>`) : '–', last ? lv(Math.abs(last.bias), 10, 20) : ''),
        stat('Spread', last ? `±${Math.round(last.spread)}<small>ms</small>` : '–', last ? lv(last.spread, 15, 25) : ''),
        settings.autoTempo ? stat('Clean in a row', `${pips}${best ? `<small> best ${best}</small>` : ''}`) : stat('Clean passes', g ? String(g.passes.filter((x) => x.clean).length) : '0'),
      ].join('');
      return;
    }
    if (ex.grade === 'tech') {
      // Before Start there's no grader yet: a fresh one shows the empty stats.
      el.innerHTML = (g || Tech.grader(ex, { SeqGrader: G.SeqGrader })).stats().map(([l, v, c]) => stat(l, v, c)).join('');
      return;
    }
    if (ex.grade === 'seq') {
      const last = g && g.passes.length ? g.passes[g.passes.length - 1] : null;
      const need = g ? g.cleanNeeded : ex.notes.length <= 40 ? 3 : ex.notes.length <= 90 ? 2 : 1;
      const streak = g ? g.cleanStreak : 0;
      const pips = `<span class="pips">${Array.from({ length: need }, (_, i) => `<i class="${i < streak ? 'on' : ''}"></i>`).join('')}</span>`;
      const progress = g ? `${g.pass.hits + g.pass.miss}<small>/ ${ex.notes.length}</small>` : `0<small>/ ${ex.notes.length}</small>`;
      const best = ex.tempoKey ? Math.max(learner.best(ex.tempoKey), cur.cleanBpm) : 0;
      el.innerHTML = [
        stat(`Pass ${g ? g.passes.length + 1 : 1}`, progress),
        stat('Last pass', last ? pct(last.acc) : '–', grade(last && last.acc, 0.9, 0.75)),
        ex.fam === 'bends'
          ? stat('Last bends', last && last.cents != null ? `${last.cents > 0 ? '+' : ''}${Math.round(last.cents)}<small>¢</small>` : '–', last && last.cents != null ? grade(-Math.abs(last.cents), -15, -30) : '')
          : stat('Timing', last && last.timing != null && ex.timing ? `±${Math.round(last.timing)}<small>ms</small>` : '–', last && last.timing != null ? grade(-last.timing, -35, -60) : ''),
        ex.timing && settings.autoTempo && !ex.fixedBpm ? stat('Clean in a row', `${pips}${best ? `<small> best ${best}</small>` : ''}`) : stat('Clean passes', g ? String(g.passes.filter((p) => p.clean).length) : '0'),
      ].join('');
    } else {
      const ratio = g ? g.ratio : null;
      const label = ex.allowMode === 'chord' ? 'Chord tones' : ex.allowMode === 'guide' ? 'Guide tones' : ex.allowMode === 'scale+chord' ? 'In key or chord' : 'Fits the rule';
      const parts = [
        stat('Notes', g ? String(g.total) : '0'),
        stat(label, ratio != null ? pct(ratio) : '–', grade(ratio, 0.9, 0.75)),
      ];
      if (ex.land) parts.push(stat('Landed on beat 1', g && g.landTotal ? `${g.landed}<small>/ ${g.landTotal}</small>` : '–', g && g.landTotal ? grade(g.landed / g.landTotal, 0.7, 0.45) : ''));
      if (ex.flavorPc != null) parts.push(stat(`Flavor note (${S.degreeLabel(mod12(ex.flavorPc - ex.keyPc), { scaleId: ex.scaleId })})`, g ? String(g.flavor) : '0'));
      if (parts.length < 4) parts.push(stat('Tempo', `${cur.bpm}<small>bpm</small>`));
      el.innerHTML = parts.join('') + `<div class="recent-notes" style="grid-column: 1 / -1">${cur.recent.map((r) => `<span class="rn${r.ok ? '' : ' bad'}${r.land ? ' land' : ''}">${esc(r.name)}</span>`).join('')}</div>`;
    }
  }

  function renderPlan() {
    const d = new Date(`${plan.date}T12:00:00`);
    const kod = plan.keyOfDay != null ? plan.keyOfDay : G.keyOfDay(plan.date);
    $('dayKicker').textContent = d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
    $('dayTitle').textContent = `${plan.minutes}-minute session · key of the day ${T.spellings(kod, true).join('/')}`;
    $('planTitle').textContent = `${plan.minutes} minutes, ${exercises().length} exercises`;
    $('timeline').innerHTML = plan.items.map((it, i) => {
      const ex = exOf(it);
      const p = Math.min(1, playedSec(it) / (it.minutes * 60));
      const done = plan.results[it.uid] || p >= 0.95;
      return `<button type="button" role="listitem" class="tl-seg${done ? ' done' : ''}${cur && i === cur.idx ? ' current' : ''}" data-block="${it.block}" data-idx="${i}" style="flex-grow:${it.minutes}" title="${esc(ex ? ex.title : 'Break')} · ${it.minutes} min"><span class="tl-fill" style="width:${done ? 100 : p * 100}%"></span></button>`;
    }).join('');
    $('planList').innerHTML = plan.items.map((it, i) => {
      const ex = exOf(it);
      const r = plan.results[it.uid];
      const started = playedSec(it) > 5;
      const score = r ? `<span class="pr-score ${r.score >= 0.85 ? '' : r.score >= 0.6 ? 'meh' : 'bad'}">${pct(r.score)}</span>` : `<span class="pr-score">${started ? mmss(playedSec(it)) : ''}</span>`;
      if (it.kind === 'rest') {
        return `<li class="plan-row rest${cur && i === cur.idx ? ' current' : ''}" data-block="rest" data-idx="${i}"><span class="pr-dot"></span><span class="pr-time">${it.minutes}′</span><span class="pr-title"><span>Break · hands, wrists, water</span></span>${score}<button class="pr-swap" disabled></button></li>`;
      }
      const key = ex.chips.find((c) => c[0] === 'Key' || c[0] === 'Chord' || c[0] === 'Mode' || c[0] === 'Note');
      return `<li class="plan-row${r ? ' done' : ''}${cur && i === cur.idx ? ' current' : ''}" data-block="${it.block}" data-idx="${i}">
        <span class="pr-dot"></span><span class="pr-time">${it.minutes}′</span>
        <span class="pr-title"><span>${it.desc.focus ? '<b class="pr-focus">★</b> ' : ''}${esc(ex.title)}</span><small>${esc(G.BLOCKS[it.block].name)}${key ? ` · ${esc(key[1])}` : ''}</small></span>
        ${score}<button class="pr-swap" type="button" data-swap="${i}" title="Swap for another exercise" ${started || (cur && i === cur.idx && cur.state === 'run') ? 'disabled' : ''}>↻</button></li>`;
    }).join('');
    $('rebuildBtn').hidden = plan.settings === planSettings();
    $('genBtn').classList.toggle('attn', plan.settings !== planSettings());
    $('genBtn').title = plan.settings !== planSettings() ? 'Your settings changed, or the app gained new exercises (a Rhythm block): generate a session that uses them.' : 'Today’s plan is generated from the date and your progress, and kept if you reload. This draws a different one.';
  }

  // ---------- progress ----------
  const MAP = [
    ['Minor pentatonic', [1, 2, 3, 4, 5].map((k) => [`Box ${k}`, `box:minPent:${k}`])],
    ['Blues scale', [1, 2, 3, 4, 5].map((k) => [`Box ${k}`, `box:blues:${k}`])],
    ['Major pentatonic', [1, 2, 3, 4, 5].map((k) => [`Box ${k}`, `box:majPent:${k}`])],
    ['Natural minor', [1, 2, 3, 4, 5].map((k) => [`Pos ${k}`, `pos:aeolian:${k}`])],
    ['Major scale', [1, 2, 3, 4, 5].map((k) => [`Pos ${k}`, `pos:ionian:${k}`])],
    ['3 per string (minor)', [1, 2, 3, 4, 5, 6, 7].map((k) => [`P${k}`, `nps3:aeolian:${k}`])],
    ['Minor arpeggio', [1, 2, 3, 4, 5].map((k) => [`Pos ${k}`, `arp:min:${k}`])],
    ['Major arpeggio', [1, 2, 3, 4, 5].map((k) => [`Pos ${k}`, `arp:maj:${k}`])],
    ['Dominant 7 arpeggio', [1, 2, 3, 4, 5].map((k) => [`Pos ${k}`, `arp:dom7:${k}`])],
    ['Follow the changes', [1, 2, 3, 4, 5].map((k) => [`Box ${k}`, `changes:${k}`])],
    ['Triads, major', Object.entries(S.STRING_SETS).map(([id, x]) => [x.name, `triads:${id}:major`])],
    ['Triads, minor', Object.entries(S.STRING_SETS).map(([id, x]) => [x.name, `triads:${id}:minor`])],
    // Rhythm, by group: up to seven patterns a row (the ladder, fingerpicking and 16ths ↔ sextuplets
    // still count, they just aren't shown).
    ...Rh.CATS.map((c) => [`Rhythm: ${c.id === 'clock' ? 'inner clock' : c.id === 'strum' ? 'strumming' : c.id === 'metal' ? 'palm mute' : 'time'}`,
      Rh.PATTERNS.filter((p) => p.cat === c.id && !['ladder', 'arp8', 'sixteenSext'].includes(p.id)).slice(0, 7).map((p) => [Rh.SHORT[p.id], `rhythm:${p.id}`])]),
  ];
  const level = (m) => (m <= 0 ? 0 : m < 0.3 ? 1 : m < 0.6 ? 2 : m < 0.8 ? 3 : 4);

  function renderProgress() {
    const today = todayStr();
    const dates = Object.keys(days).sort();
    let streak = 0;
    for (let d = G.dayNum(today) - (days[today] && days[today].sec >= 900 ? 0 : 1); ; d--) {
      const key = dates.find((x) => G.dayNum(x) === d);
      if (key && days[key].sec >= 900) streak++;
      else break;
    }
    const week = dates.filter((x) => G.dayNum(today) - G.dayNum(x) < 7).reduce((a, x) => a + days[x].sec, 0);
    const recentScores = dates.filter((x) => G.dayNum(today) - G.dayNum(x) < 7).flatMap((x) => Object.values(days[x].items).map((i) => i.score));
    const started = Object.values(learner.skills).filter((k) => k.n > 0).length;
    const solid = Object.values(learner.skills).filter((k) => k.m >= 0.6).length;
    const tiles = [
      ['Today', `${Math.floor(((days[today] && days[today].sec) || 0) / 60)}<small>min</small>`, ''],
      ['Streak (15+ min)', `${streak}<small>${streak === 1 ? 'day' : 'days'}</small>`, streak >= 5 ? 'good' : ''],
      ['Last 7 days', `${Math.round(week / 60)}<small>min</small>`, ''],
      ['Skills started', `${started}<small>${solid ? `${solid} solid` : ''}</small>`, ''],
      ['Avg grade, 7 days', recentScores.length ? pct(recentScores.reduce((a, b) => a + b, 0) / recentScores.length) : '–', recentScores.length ? grade(recentScores.reduce((a, b) => a + b, 0) / recentScores.length, 0.85, 0.65) : ''],
    ];
    $('progTiles').innerHTML = tiles.map(([l, v, c]) => `<div class="tile ${c}"><span class="tile-label">${l}</span><span class="tile-value">${v}</span></div>`).join('');
    $('skillMap').innerHTML = MAP.map(([name, cols]) => `<div class="sm-row"><span class="sm-name">${esc(name)}</span>${cols.map(([lab, id]) => {
      const k = learner.skills[id];
      const m = learner.mastery(id);
      const tempos = Object.entries(learner.tempos).filter(([key]) => key.startsWith(`${id}:`)).map(([, t]) => t.best || 0);
      const best = tempos.length ? Math.max(...tempos) : 0;
      const tip = `${name} ${lab}: ${k ? `${pct(m)} · practiced ${k.n}× · last ${k.last}${best ? ` · best ${best} bpm` : ''}` : m > 0 ? `starting guess ${pct(m)}` : 'not started'}`;
      return `<span class="sm-cell" data-lv="${level(m)}" title="${esc(tip)}">${esc(lab)}</span>`;
    }).join('')}${'<span class="sm-cell empty"></span>'.repeat(7 - cols.length)}</div>`).join('');
    $('dayHistory').innerHTML = dates.slice(-10).reverse().map((x) => {
      const items = Object.values(days[x].items);
      const avg = items.length ? items.reduce((a, b) => a + b.score, 0) / items.length : null;
      const min = Math.round(days[x].sec / 60);
      const d = new Date(`${x}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
      return `<li><b>${esc(d)}</b><span>${min} min</span><span class="bar"><i style="width:${Math.min(100, (min / 120) * 100)}%"></i></span><span>${avg != null ? pct(avg) : ''}</span></li>`;
    }).join('');
  }

  // ---------- wake lock (long sessions shouldn't sleep the screen) ----------
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
  function toggleGo() {
    if (!cur) return;
    if (cur.state === 'run') pause();
    else if (cur.state === 'timeup') next();
    else start();
  }
  $('goBtn').addEventListener('click', (e) => { e.currentTarget.blur(); toggleGo(); });
  $('nextBtn').addEventListener('click', (e) => { e.currentTarget.blur(); next(); });
  $('prevBtn').addEventListener('click', (e) => { e.currentTarget.blur(); next(-1); });
  $('slower').addEventListener('click', () => setBpm(cur.bpm - step()));
  $('faster').addEventListener('click', () => setBpm(cur.bpm + step()));
  $('extendBtn').addEventListener('click', () => {
    if (!cur) return;
    cur.autoAt = 0;
    cur.extra = (cur.extra || 0) + 120 + Math.max(0, playedSec(cur.item) - cur.item.minutes * 60 - (cur.extra || 0));
    if (cur.state === 'timeup') start();
    renderTimer();
  });
  $('clickBtn').addEventListener('click', () => { settings.clickOn = !settings.clickOn; saveSettings(); applyClick(); renderCard(); });
  $('backBtn').addEventListener('click', () => {
    settings.backOn = !settings.backOn;
    saveSettings();
    if (!settings.backOn && pad) pad.stop();
    renderCard();
  });

  // ---------- AI practice track (MusicGen) ----------
  // A short groove for the current exercise: its skill family, tempo and the session's
  // key. The model invents it from a text prompt, so it will not be exactly in key or
  // exactly at tempo — a jam track, not a click. Playing it stops the built-in backing.
  let mgPlayer = null;
  let mgBusy = false;
  let mgSeconds = 10;
  let mgTimer = null;

  // Server mode (default) drafts on the music server; On-device runs the model
  // in the browser. The toggle lives in the panel; the mode is shared with the
  // write page through localStorage.
  const MG_MODE_TEXT = {
    server: 'Drafted by the music server (ai.0x1.tw, MusicGen-small). Your prompt is sent to your own server to draft; nothing else leaves the browser.',
    browser: 'MusicGen (Meta) runs on your device. First use downloads about 1 GB and caches it; the track is a jam track in this exercise\'s style and tempo — it will not be exactly in key or exactly at tempo. Use headphones: the track is in the guitar\'s range, like the built-in backing.',
  };
  function syncMgModeText() {
    if (!window.MusicGen) return;
    const st = $('mgStatus');
    if (st && !mgBusy) st.textContent = MG_MODE_TEXT[MusicGen.getMode()] || MG_MODE_TEXT.server;
  }
  function syncMgModeSeg() {
    const seg = $('mgMode');
    if (!seg || !window.MusicGen) return;
    seg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.value === MusicGen.getMode())));
  }
  $('mgMode').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || !window.MusicGen) return;
    MusicGen.setMode(b.dataset.value);
    syncMgModeSeg();
    syncMgModeText();
  });
  syncMgModeSeg();
  syncMgModeText();

  function mgSetPlayLabel() {
    const b = $('mgPlay');
    b.textContent = mgPlayer && mgPlayer.playing ? '■ Stop' : '▶ Play';
  }
  function mgStopTimer() { if (mgTimer) { clearInterval(mgTimer); mgTimer = null; } }

  async function mgGenerate() {
    if (mgBusy) { $('mgStatus').textContent = 'The track is already generating — give it a moment.'; return; }
    if (!window.MusicGen || !MusicGen.isSupported()) { $('mgPanel').hidden = false; $('mgStatus').textContent = 'The backing-track partner is not available in this browser.'; return; }
    mgBusy = true;
    const panel = $('mgPanel'), status = $('mgStatus'), prog = $('mgProg'), bar = $('mgProgBar');
    panel.hidden = false;
    $('mgPlay').hidden = true;
    $('mgDl').hidden = true;
    if (mgPlayer) mgPlayer.stop();
    mgSetPlayLabel();
    status.textContent = window.MusicGen && MusicGen.getMode() === 'server' ? 'Asking the server…' : 'Starting the model…';
    prog.hidden = true; bar.style.width = '0%';
    $('mgPrompt').textContent = '';
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    const skill = (cur && cur.ex && cur.ex.skill) || (settings.focus && settings.focus[0]) || null;
    const bpm = (cur && cur.bpm) || 72;
    const prompt = MusicGen.buildSessionPrompt({ skill, bpm, keyPc: settings.key });
    const startedAt = Date.now();
    const onProgress = (p) => {
      if (p.status === 'progress') {
        prog.hidden = false;
        bar.style.width = `${Math.round(p.progress || 0)}%`;
        status.textContent = `Downloading the model (${Math.round(p.progress || 0)}%): ${p.file || ''} — about 1 GB on first use, cached after.`;
      } else if (p.status === 'done') {
        status.textContent = 'Model ready — generating the track…';
      }
    };
    const onGenerating = () => {
      prog.hidden = true;
      const server = window.MusicGen && MusicGen.getMode() === 'server';
      status.textContent = server
        ? `Generating ${mgSeconds} seconds of audio on the server — about 20 seconds for a 10-second track.`
        : `Generating ${mgSeconds} seconds of audio — this takes a while, about a minute on most machines.`;
      mgStopTimer();
      mgTimer = setInterval(() => {
        const s = Math.floor((Date.now() - startedAt) / 1000);
        status.textContent = server
          ? `Generating ${mgSeconds} seconds of audio on the server — ${s}s in.`
          : `Generating ${mgSeconds} seconds of audio — ${s}s in, about a minute on most machines.`;
      }, 1000);
    };
    try {
      const track = await MusicGen.generate(prompt, { seconds: mgSeconds, onProgress, onGenerating });
      mgStopTimer();
      prog.hidden = true;
      if (!mgPlayer) {
        mgPlayer = new MusicGen.Player();
        mgPlayer.onended = mgSetPlayLabel;
      }
      mgPlayer.setTrack(track);
      $('mgPlay').hidden = false;
      $('mgDl').hidden = false;
      mgSetPlayLabel();
      status.textContent = `Ready — ${mgSeconds} seconds at ${bpm} bpm. A jam track: not exactly in key, not exactly at tempo.`;
      $('mgPrompt').textContent = `Prompt: ${prompt}`;
    } catch (err) {
      mgStopTimer();
      prog.hidden = true;
      status.textContent = `The model could not run: ${err && err.message ? err.message : err}`;
    } finally {
      mgBusy = false;
    }
  }
  $('mgBtn').addEventListener('click', mgGenerate);
  $('mgGen').addEventListener('click', mgGenerate);
  $('mgPlay').addEventListener('click', () => {
    if (!mgPlayer) return;
    if (mgPlayer.playing) { mgPlayer.stop(); mgSetPlayLabel(); return; }
    if (settings.backOn) { settings.backOn = false; saveSettings(); if (pad) pad.stop(); renderCard(); } // the built-in backing would clash.
    mgPlayer.play();
    mgSetPlayLabel();
  });
  $('mgDl').addEventListener('click', () => {
    if (!mgPlayer) return;
    const skill = (cur && cur.ex && cur.ex.skill) || 'practice';
    mgPlayer.download(`practice-track-${String(skill).replace(/[^\w\-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'practice'}.wav`);
  });
  $('mgClose').addEventListener('click', () => { if (mgPlayer) mgPlayer.stop(); $('mgPanel').hidden = true; });
  $('mgDur').querySelectorAll('button').forEach((b) => {
    b.setAttribute('aria-checked', String(Number(b.dataset.value) === mgSeconds));
    b.addEventListener('click', () => {
      mgSeconds = Number(b.dataset.value);
      $('mgDur').querySelectorAll('button').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
    });
  });
  $('rateSeg').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || !cur) return;
    cur.rating = Number(b.dataset.value);
    cur.recorded = false;
    syncRate();
    if (cur.state === 'timeup' || cur.state === 'paused') say('ok', 'Noted', 'Next when you’re ready.');
  });
  $('timeline').addEventListener('click', (e) => { const b = e.target.closest('[data-idx]'); if (b) select(Number(b.dataset.idx)); });
  $('planList').addEventListener('click', (e) => {
    const sw = e.target.closest('[data-swap]');
    if (sw) {
      e.stopPropagation();
      const i = Number(sw.dataset.swap);
      const it = plan.items[i];
      plan.salt[it.uid] = (plan.salt[it.uid] || 0) + 1;
      const d = G.reroll(plan, i, { learner, focus: settings.focus, keyMode: settings.keyMode, key: settings.key, salt: plan.salt[it.uid] });
      if (!d) return;
      it.desc = { ...d, focus: false };
      exCache.delete(it.uid);
      savePlan();
      if (cur && i === cur.idx) { cur = null; select(i); } else renderPlan();
      return;
    }
    const row = e.target.closest('[data-idx]');
    if (row) { select(Number(row.dataset.idx)); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  });
  $('planJump').addEventListener('click', () => $('planPanel').scrollIntoView({ behavior: 'smooth' }));

  $('labelSeg').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    settings.labels = b.dataset.value;
    saveSettings();
    syncSegs();
    drawBoard();
  });

  // Settings: radio groups, the focus chips, the key, options.
  function syncSegs() {
    document.querySelectorAll('.seg[data-name]').forEach((seg) => {
      seg.querySelectorAll('button').forEach((b) => {
        b.setAttribute('role', 'radio');
        b.setAttribute('aria-checked', String(String(settings[seg.dataset.name]) === b.dataset.value));
      });
    });
    $('labelSeg').querySelectorAll('button').forEach((b) => { b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(settings.labels === b.dataset.value)); });
    $('focusSeg').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(settings.focus.includes(b.dataset.value))));
    $('keySelect').hidden = settings.keyMode !== 'fixed';
    $('keySelect').value = String(settings.key);
    $('keyHelp').textContent = settings.keyMode === 'fixed' ? 'Every exercise in this key.' : 'The key of the day moves up a 4th each day. Blues exercises also use A, metal ones E.';
    $('autoTempo').checked = settings.autoTempo;
    $('strictOctave').checked = settings.strictOctave;
    $('clickVol').value = settings.click;
    $('backVol').value = settings.backing;
  }
  document.querySelectorAll('.seg[data-name]').forEach((seg) => {
    seg.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const name = seg.dataset.name;
      settings[name] = name === 'minutes' ? Number(b.dataset.value) : b.dataset.value;
      if (name === 'start') learner = new G.Learner(learner.toJSON(), { start: settings.start });
      saveSettings();
      syncSegs();
      renderPlan();
      if (name === 'start') renderProgress();
    });
  });
  $('focusSeg').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const v = b.dataset.value;
    const set = new Set(settings.focus);
    if (set.has(v)) { if (set.size > 1) set.delete(v); } else set.add(v);
    settings.focus = Object.keys(G.FOCI).filter((k) => set.has(k));
    saveSettings();
    syncSegs();
    renderPlan();
  });
  const KEY_ORDER = [9, 4, 7, 2, 0, 5, 10, 3, 8, 1, 6, 11];
  $('keySelect').innerHTML = KEY_ORDER.map((pc) => `<option value="${pc}">${T.spellings(pc, [5, 10, 3, 8, 1].includes(pc)).join(' / ')}</option>`).join('');
  $('keySelect').addEventListener('change', (e) => { settings.key = Number(e.target.value); saveSettings(); renderPlan(); });
  $('autoTempo').addEventListener('change', (e) => { settings.autoTempo = e.target.checked; saveSettings(); renderStats(); });
  $('strictOctave').addEventListener('change', (e) => { settings.strictOctave = e.target.checked; saveSettings(); });
  $('clickVol').addEventListener('input', (e) => { settings.click = Number(e.target.value); saveSettings(); applyClick(); });
  $('backVol').addEventListener('input', (e) => { settings.backing = Number(e.target.value); saveSettings(); if (pad) pad.setVolume(settings.backing / 100); });

  function rebuild() {
    // Minutes and grades you've already played stay in your progress; only today's list is replaced.
    const started = plan && plan.items.some((x) => playedSec(x) > 30);
    if (started && !window.confirm('Replace today’s plan with a new one? What you’ve played so far stays in your progress.')) return;
    if (cur) { leave(); cur = null; }
    buildPlan((plan ? plan.seed : 0) + 1);
    select(0);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  $('rebuildBtn').addEventListener('click', rebuild);
  $('shuffleBtn').addEventListener('click', rebuild);
  $('genBtn').addEventListener('click', (e) => { e.currentTarget.blur(); rebuild(); });

  // Back up / restore / reset.
  $('exportBtn').addEventListener('click', () => {
    const data = { app: 'fretboard-freedom', version: 1, saved: new Date().toISOString(), settings, learner: learner.toJSON(), days };
    const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `practice-progress-${todayStr()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
  $('importFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (data.app !== 'fretboard-freedom' || !data.learner || !data.days) throw new Error('That file isn’t a practice backup.');
      Object.assign(settings, DEFAULTS, data.settings || {});
      saveSettings();
      learner = new G.Learner(data.learner, { start: settings.start });
      saveLearner();
      days = data.days;
      saveDays();
      syncSegs();
      renderProgress();
      renderPlan();
      say('ok', 'Restored', `Progress from ${data.saved ? data.saved.slice(0, 10) : 'the backup'}. Build a new session to use it.`);
    } catch (err) {
      say('bad', 'Couldn’t restore', err.message);
    }
  });
  $('resetBtn').addEventListener('click', () => {
    if (!window.confirm('Reset your skill map, tempos and practice history in this browser? This can’t be undone (back up first if you might want it).')) return;
    learner = new G.Learner({}, { start: settings.start });
    saveLearner();
    days = {};
    saveDays();
    rebuild();
    renderProgress();
  });

  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input, select, textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.code === 'Space') { e.preventDefault(); toggleGo(); }
    else if (e.key === 'n' || e.key === 'N') next();
    else if (e.key === 'p' || e.key === 'P') next(-1);
    else if (e.key === '-' || e.key === '_') { if (cur) setBpm(cur.bpm - step()); }
    else if (e.key === '=' || e.key === '+') { if (cur) setBpm(cur.bpm + step()); }
    else if (e.key === 'm' || e.key === 'M') $('clickBtn').click();
    else if ((e.key === 'd' || e.key === 'D') && !$('backBtn').hidden) $('backBtn').click();
  });
  window.addEventListener('pagehide', () => { if (cur) finish(); savePlan(); saveDays(); });

  // ---------- go ----------
  const saved = store.get('ff.plan', null);
  if (saved && saved.date === todayStr() && Array.isArray(saved.items) && saved.items.every((x) => x.kind === 'rest' || G.buildExercise(x.desc))) plan = saved;
  else buildPlan(0);
  syncSegs();
  renderProgress();
  select(plan.cur || 0);
  stand.init();
  if (!plan.items.some((x) => x.block === 'rhythm') && plan.settings !== planSettings()) {
    say('hint', 'New: a Rhythm block', 'Today’s plan was built before rhythm drills were part of the session. ↻ Generate new session to add them; what you’ve played today stays in your progress.');
  }

  // For poking at it from the console: __session.fakeNote(64)
  window.__session = {
    get cur() { return cur; }, get plan() { return plan; }, learner: () => learner, engine, select, start, timeUp, stand,
    fakeNote: (midi) => played(midi, engine.ctx ? engine.ctx.currentTime : 0, true),
    // Swap the current exercise for another descriptor: __session.use({ fam: 'vibrato', width: 'narrow', key: 9, skill: 'vibrato:narrow' })
    use(desc) { const it = plan.items[plan.cur]; it.desc = desc; exCache.delete(it.uid); cur = null; select(plan.cur); },
  };
})();
