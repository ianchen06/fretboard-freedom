// UI controller for the rhythm trainer: the exercise, the click or drums, the lane with your hits,
// the timing offset (latency) and how to measure it, the run report and the exercise library.
//
// Kept in this browser under ff.rhythm (settings, the timing offset, per-exercise tempos, recent
// runs). Minutes and run scores also go into ff.days, so they count toward the daily streak.
(function () {
  'use strict';
  const R = window.Rhythm;
  const RP = window.RhythmPlay;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const mmss = (sec) => { const s = Math.max(0, Math.round(sec)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };

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
  const DATA = { settings: {}, lat: null, ex: {}, history: [], days: {}, ...store.get('ff.rhythm', {}) };
  const settings = { ex: 'eighths', cat: null, sound: 'click', vol: 70, hitSens: 70, ladder: true, click: null, clickEx: null, ...DATA.settings };
  const save = () => { DATA.settings = settings; store.set('ff.rhythm', DATA); };
  const exData = (id) => (DATA.ex[id] = DATA.ex[id] || { bpm: null, best: 0, runs: 0, score: null, last: null });

  // The day log the daily session keeps (ff.days). Read, add, write back, so the two pages don't
  // overwrite each other's minutes.
  function logDay(sec, item) {
    const days = store.get('ff.days', {});
    const d = (days[todayStr()] = days[todayStr()] || { sec: 0, items: {} });
    d.sec += sec;
    if (item) d.items[item.key] = item.value;
    store.set('ff.days', days);
    DATA.days[todayStr()] = (DATA.days[todayStr()] || 0) + sec;
  }

  const CLICKS = {
    all: { mode: 'all' }, gap22: { mode: 'gap', on: 2, off: 2 }, gap13: { mode: 'gap', on: 1, off: 3 },
    24: { mode: '24' }, one: { mode: 'one' }, off: { mode: 'off' },
  };
  const clickKey = (c) => (c.mode === 'gap' ? `gap${c.on}${c.off}` : c.mode);
  const CLICK_NAME = { all: 'every beat', gap22: '2 bars on, 2 off', gap13: '1 bar on, 3 off', 24: 'on 2 and 4', one: 'on beat 1', off: 'on the “&”' };

  // ---------- audio ----------
  const engine = new window.AudioEngine();
  let band = null;
  let onsetReady = false;
  let runOut = null; // this run's click bus and drum bus, so Stop silences what's already scheduled
  let runDrums = null;

  async function ensureAudio() {
    await engine.init();
    if (!band) { band = new window.Band(engine.ctx); band.init(); }
    if (!onsetReady) {
      await engine.enableOnsets('js/onset.js?v=1');
      onsetReady = true;
    }
    applyVolume();
    applyDetector();
    renderLat();
  }
  function applyVolume() {
    engine.clickVolume = settings.vol / 100;
    if (band) band.setMix({ band: (settings.vol / 100) * 1.3 });
  }
  function newBuses() {
    const ctx = engine.ctx;
    runOut = ctx.createGain();
    runOut.connect(engine.out);
    runDrums = ctx.createGain();
    runDrums.connect(band.drumBus);
  }
  function silenceBuses() {
    const ctx = engine.ctx;
    for (const g of [runOut, runDrums]) {
      if (!g) continue;
      g.gain.setTargetAtTime(0, ctx.currentTime, 0.01);
      setTimeout(() => g.disconnect(), 200);
    }
    runOut = runDrums = null;
  }

  // The onset detector's settings: threshold from Hit sensitivity, the noise gate from the Hearing
  // card, and a dead time that fits the pattern's fastest notes.
  const hitThreshold = () => 9 - 0.065 * settings.hitSens;
  const refractoryFor = (p, bpm) => clamp(0.45 * R.minGapBeats(p) * (60 / bpm), 0.03, 0.09);
  let lastGate = null;
  function applyDetector() {
    if (!onsetReady) return;
    const p = { threshold: hitThreshold() };
    if (engine.tracker) { p.gateDb = engine.tracker.gateDb; lastGate = p.gateDb; }
    if (cur) p.refractory = refractoryFor(cur.pattern, run ? run.bpm : cur.bpm);
    engine.setOnsetParams(p);
  }
  setInterval(() => { if (onsetReady && engine.tracker && engine.tracker.gateDb !== lastGate) applyDetector(); }, 500);

  // ---------- timing offset (latency) ----------
  const estLatency = () => (engine.ctx ? (engine.ctx.outputLatency || engine.ctx.baseLatency || 0.01) + 0.015 : 0.03);
  const latency = () => (DATA.lat ? DATA.lat.ms / 1000 : estLatency());
  const inputLabel = () => { const i = engine.inputInfo(); return i ? i.label.replace(/\s*\(.*\)\s*$/, '') : ''; };

  function renderLat(msg) {
    const card = $('latCard');
    if (cal) card.dataset.state = 'busy';
    else card.dataset.state = DATA.lat ? 'measured' : 'estimate';
    $('latVal').textContent = DATA.lat || engine.ctx ? String(Math.round(latency() * 1000)) : '–';
    if (msg) { $('latNote').innerHTML = msg; return; }
    if (DATA.lat) {
      const how = { play: 'by playing', loop: 'by loopback', manual: 'by hand' }[DATA.lat.how] || '';
      const other = DATA.lat.input && engine.micOn && inputLabel() && inputLabel() !== DATA.lat.input;
      $('latNote').innerHTML = `Measured ${esc(how)}${DATA.lat.input ? ` with <b>${esc(DATA.lat.input)}</b>` : ''} on ${esc(DATA.lat.at || '')}. It’s taken off every hit.`
        + (other ? ' <b>A different input is open now: measure again.</b>' : '');
    } else {
      $('latNote').innerHTML = 'Estimated from what the browser reports. <b>Measure it</b> for accurate timing: otherwise every hit reads early or late by the error.';
    }
  }

  function nudgeLat(d) {
    const ms = Math.round(latency() * 1000) + d;
    DATA.lat = { ms: clamp(ms, 0, 400), how: DATA.lat ? DATA.lat.how : 'manual', at: todayStr(), input: DATA.lat ? DATA.lat.input : inputLabel() };
    save();
    renderLat();
  }
  $('latDown').addEventListener('click', () => nudgeLat(-1));
  $('latUp').addEventListener('click', () => nudgeLat(1));

  // Measuring: by playing (you strum with 16 clicks; the typical offset is the correction, which also
  // makes your own habit of playing ahead or behind the click the zero point), or by loopback (the
  // input hears the clicks themselves: the equipment alone).
  let cal = null;
  async function measure(kind) {
    if (cal) return;
    if (run) stopRun();
    await ensureAudio();
    if (!engine.micOn) { renderLat('Enable the input first (the Hearing card), then measure.'); return; }
    const ctx = engine.ctx;
    newBuses();
    const clicks = [];
    const t0 = ctx.currentTime + 0.3;
    if (kind === 'play') {
      const beat = 60 / 90;
      for (let i = 0; i < 20; i++) { const t = t0 + i * beat; engine.click(t, i % 4 === 0, runOut); if (i >= 4) clicks.push(t); }
      cal = { kind, clicks, raw: [], end: t0 + 20 * beat + 0.4 };
      renderLat('<b>Listen to 4 clicks</b>, then play a muted strum exactly with each of the next 16.');
    } else {
      const prev = engine.clickVolume;
      engine.clickVolume = 1;
      for (let i = 0; i < 8; i++) { const t = t0 + i * 0.6; engine.click(t, true, runOut); clicks.push(t); }
      engine.clickVolume = prev;
      cal = { kind, clicks, raw: [], end: t0 + 8 * 0.6 + 0.5 };
      renderLat('<b>Stay quiet.</b> Listening for the clicks to come back through the input…');
    }
    setState('cal');
    setTimeout(finishMeasure, (cal.end - ctx.currentTime) * 1000);
  }

  function finishMeasure() {
    const c = cal;
    cal = null;
    silenceBuses();
    setState('ready');
    const offs = [];
    for (const t of c.clicks) {
      const lo = c.kind === 'play' ? t - 0.25 : t;
      const hi = c.kind === 'play' ? t + 0.35 : t + 0.4;
      const cand = c.raw.filter((x) => x >= lo && x <= hi);
      if (!cand.length) continue;
      const pick = c.kind === 'play' ? cand.reduce((a, b) => (Math.abs(b - t - 0.03) < Math.abs(a - t - 0.03) ? b : a)) : cand[0];
      offs.push(pick - t);
    }
    const med = median(offs);
    const mad = median(offs.map((x) => Math.abs(x - med)));
    if (c.kind === 'play') {
      if (offs.length < 10) { renderLat(`Only ${offs.length} of 16 strums came through. Check the input level and Hit sensitivity, then try again.`); return; }
      if (mad > 0.015) { renderLat(`Too uneven to measure (your strums scattered by ±${Math.round(mad * 1000)} ms). Try again as steadily as you can, or use Loopback.`); return; }
    } else {
      if (offs.length < 6) { renderLat('The clicks didn’t come back through the input. Loopback needs the input to hear the output: laptop speakers into the mic, or an interface’s loopback turned on. Or measure by playing.'); return; }
      if (mad > 0.004) { renderLat('The clicks came back unevenly. Turn the volume up, keep the room quiet, and try again.'); return; }
    }
    DATA.lat = { ms: Math.round(med * 1000), how: c.kind, at: todayStr(), input: inputLabel() };
    save();
    renderLat();
    say('ok', 'Timing offset set', `${DATA.lat.ms} ms, measured ${c.kind === 'play' ? 'by playing' : 'by loopback'}${c.kind === 'loop' ? '. Turn loopback off again before you play' : ''}.`);
  }
  $('latPlay').addEventListener('click', () => measure('play'));
  $('latLoop').addEventListener('click', () => measure('loop'));

  // ---------- the hearing card ----------
  window.MicPanel.setup(engine, {
    store,
    onInputChange: async (kind) => {
      if (kind) await ensureAudio().catch((err) => say('bad', 'Audio', err.message));
      renderLat();
    },
  });
  $('hitSens').value = settings.hitSens;
  $('hitSens').addEventListener('input', (e) => { settings.hitSens = Number(e.target.value); save(); applyDetector(); });
  let hitCount = 0;
  let hitTimer = null;
  function flashHit(o) {
    hitCount++;
    $('hitCount').textContent = hitCount;
    $('hitDb').textContent = `${Math.round(o.db)} dB`;
    $('hitDot').classList.add('on');
    clearTimeout(hitTimer);
    hitTimer = setTimeout(() => $('hitDot').classList.remove('on'), 90);
  }

  // ---------- the exercise ----------
  let cur = null; // { pattern, bpm, click }
  let state = 'ready';

  function loadExercise(id) {
    if (run) stopRun();
    const p = R.byId(id) || R.PATTERNS[0];
    settings.ex = p.id;
    settings.cat = p.cat;
    const click = settings.clickEx === p.id && settings.click ? settings.click : p.click || { mode: 'all' };
    cur = { pattern: p, bpm: exData(p.id).bpm || p.bpm, click };
    save();
    renderExercise();
    drawLane();
    renderLib();
    syncClickSeg();
    renderTempo();
    applyDetector();
    resetNow();
    renderStats(null);
  }

  const meterName = (p) => (p.meter === 2 && p.bars[0].grid === 3 ? '6/8' : `${p.meter}/4`);
  const gridName = (p) => (p.meter === 2 && p.bars[0].grid === 3 ? '8ths' : [...new Set(p.bars.map((b) => R.GRID_NAME[b.grid]))].join(' → '));

  function renderExercise() {
    const p = cur.pattern;
    const cat = R.CATS.find((c) => c.id === p.cat);
    $('rxCard').dataset.block = p.cat;
    $('rxKicker').textContent = cat ? cat.name : '';
    $('rxTitle').innerHTML = `${esc(p.name)}${p.zh ? ` <span class="zh">${esc(p.zh)}</span>` : ''}`;
    const ex = exData(p.id);
    const chips = [
      ['Grid', gridName(p)],
      ['Meter', meterName(p)],
      p.bars.length > 1 ? ['Bars', String(p.bars.length)] : null,
      p.swing ? ['Feel', 'swung'] : null,
      ['Click', CLICK_NAME[clickKey(cur.click)]],
      ex.best ? ['Best clean', `${ex.best} bpm`] : null,
    ].filter(Boolean);
    $('rxChips').innerHTML = chips.map(([k, v]) => `<span class="ex-chip">${esc(k)}<b>${esc(v)}</b></span>`).join('');
    $('rxHow').textContent = p.how;
    $('rxWhy').textContent = p.why;
    $('rxCue').innerHTML = p.cues.map((c) => esc(c)).join(' <span aria-hidden="true">·</span> ');
    $('beats').innerHTML = '<i></i>'.repeat(p.meter);
    $('bpmUnit').textContent = p.meter === 2 && p.bars[0].grid === 3 ? 'bpm ♩.' : 'bpm';
  }

  function renderTempo() { $('bpm').textContent = run ? run.bpm : cur.bpm; }
  function setTempo(v) {
    const bpm = clamp(Math.round(v), 30, 260);
    if (run) run.setBpm(bpm); else { cur.bpm = bpm; exData(cur.pattern.id).bpm = bpm; save(); }
    renderTempo();
    applyDetector();
  }
  $('slower').addEventListener('click', () => setTempo((run ? run.bpm : cur.bpm) - 2));
  $('faster').addEventListener('click', () => setTempo((run ? run.bpm : cur.bpm) + 2));

  function syncClickSeg() {
    const key = clickKey(cur.click);
    $('clickSeg').querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.value === key)));
    $('clickSeg').querySelectorAll('button').forEach((b) => b.setAttribute('role', 'radio'));
  }
  $('clickSeg').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const was = !!run;
    if (run) stopRun();
    cur.click = CLICKS[b.dataset.value];
    settings.click = cur.click;
    settings.clickEx = cur.pattern.id;
    save();
    syncClickSeg();
    renderExercise();
    if (was) startRun();
  });

  function syncToggles() {
    $('ladderBtn').setAttribute('aria-pressed', String(!!settings.ladder));
    $('soundBtn').setAttribute('aria-pressed', String(settings.sound === 'drums'));
  }
  $('ladderBtn').addEventListener('click', () => { settings.ladder = !settings.ladder; save(); syncToggles(); });
  $('soundBtn').addEventListener('click', () => { settings.sound = settings.sound === 'drums' ? 'click' : 'drums'; save(); syncToggles(); });
  $('vol').value = settings.vol;
  $('vol').addEventListener('input', (e) => { settings.vol = Number(e.target.value); save(); applyVolume(); });

  // ---------- the lane and the recent hits (js/rhythmplay.js) ----------
  const lane = new RP.Lane($('lane'));
  const widthOf = RP.widthOf;
  function drawLane() { lane.draw(cur.pattern); }

  let recent = [];
  const drawStrip = () => RP.drawStrip($('tstrip'), recent);
  function resetNow() {
    recent = [];
    $('nowHit').dataset.cls = '';
    $('nowVal').textContent = '–';
    $('nowSub').textContent = 'your last hit';
    drawStrip();
  }
  function showHit(off) {
    const f = R.feel(off);
    $('nowHit').dataset.cls = f.cls;
    $('nowVal').textContent = f.text === 'on the beat' ? 'On the beat' : f.text;
    $('nowSub').textContent = `your last hit · ${off >= 0 ? '+' : '−'}${Math.abs(Math.round(off * 1000))} ms`;
    recent.push(off * 1000);
    if (recent.length > 32) recent.shift();
    drawStrip();
  }
  function showExtra(why) {
    $('nowHit').dataset.cls = 'extra';
    $('nowVal').textContent = 'Extra';
    $('nowSub').textContent = RP.EXTRA_WHERE[why] || '';
  }

  // ---------- stats and feedback ----------
  function say(cls, tag, text) {
    const f = $('feedback');
    f.className = `feedback ${cls}`;
    f.innerHTML = `<span class="tag">${esc(tag)}</span><span>${esc(text)}</span>`;
  }
  const msWord = (v) => `${Math.round(Math.abs(v))}<small>ms ${v < 0 ? 'early' : 'late'}</small>`;
  // info: { need, streak, passes } for the clean-pass pips.
  function renderStats(st, info = run && run.tempo ? { need: run.tempo.need, streak: run.tempo.clean, passes: run.passCount } : null) {
    if (!st || !st.n) {
      $('stats').innerHTML = ['Hits', 'Average', 'Spread', 'Clean passes'].map((l) => `<div class="stat"><span class="stat-label">${l}</span><span class="stat-value">–</span></div>`).join('');
      return;
    }
    const need = info ? info.need : 2;
    const streak = info ? info.streak : 0;
    const pips = `<span class="pips">${[...Array(need)].map((_, i) => `<i class="${i < streak ? 'on' : ''}"></i>`).join('')}</span>`;
    const lv = (v, a, b) => (v <= a ? 'good' : v <= b ? 'meh' : 'bad');
    $('stats').innerHTML = [
      ['Hits', `${Math.round(st.hitRate * 100)}<small>% of ${st.n}</small>`, lv(1 - st.hitRate, 0.05, 0.2)],
      ['Average', Math.abs(st.bias) < 1 ? '0<small>ms</small>' : msWord(st.bias), lv(Math.abs(st.bias), 10, 20)],
      ['Spread', `±${Math.round(st.spread)}<small>ms</small>`, lv(st.spread, 15, 25)],
      ['Clean passes', `${pips} <small>${info ? info.passes : 0} played</small>`, ''],
    ].map(([l, v, c]) => `<div class="stat ${c}"><span class="stat-label">${l}</span><span class="stat-value">${v}</span></div>`).join('');
  }

  // ---------- running (the Run in js/rhythmplay.js does the timing) ----------
  let run = null;
  let clock = null;
  function setState(s) {
    state = s;
    $('rxCard').dataset.state = s;
    $('goBtn').innerHTML = s === 'run' || s === 'countin' ? 'Stop <kbd>Space</kbd>' : 'Start <kbd>Space</kbd>';
    $('goBtn').disabled = s === 'cal';
  }
  const dots = () => $('beats').querySelectorAll('i');

  async function startRun() {
    if (cal) return;
    try { await ensureAudio(); } catch (err) { say('bad', 'Audio', err.message); return; }
    const r = new RP.Run({
      engine, band, pattern: cur.pattern, bpm: cur.bpm, click: cur.click, sound: settings.sound, latency, lane,
      ladder: () => settings.ladder && r.micAtStart,
      on: {
        state: (s) => {
          setState(s === 'stopped' ? 'ready' : s);
          if (s === 'run' && !r.leakWarned && engine.micOn) say('hint', 'Go', 'Play along. The dots show where each hit landed.');
        },
        hit: (res) => showHit(res.off),
        extra: (res) => showExtra(res.why),
        pass: onPass,
        leak: () => say('bad', 'The input hears the click', 'Every count-in click came back through the input, so the click would count as your hits. Use headphones, turn the volume down, or turn off loopback on your interface.'),
        beat: (k, { countIn, quiet }) => dots().forEach((d, i) => { d.classList.toggle('on', i === k); d.classList.toggle('quiet', !countIn && quiet); }),
      },
    });
    Object.assign(r, { sec: 0, unlogged: 0, lastTick: performance.now(), micAtStart: engine.micOn });
    run = r;
    resetNow();
    renderStats(null);
    applyDetector();
    r.start();
    if (!engine.micOn) say('warn', 'No input', 'The click plays, but nothing is graded until you enable the microphone or interface.');
    else say('hint', 'Count-in', `${r.countBeats} clicks, then play.${r.click.mode === 'all' ? '' : ` After that the click is ${CLICK_NAME[clickKey(r.click)]}.`}`);
    clearInterval(clock);
    clock = setInterval(countTime, 250);
  }

  // Practice time, counted while you play with an input open.
  function countTime() {
    if (!run) return;
    const now = performance.now();
    const dt = Math.min(1, (now - run.lastTick) / 1000);
    run.lastTick = now;
    if (state === 'run' && run.micAtStart) {
      run.sec += dt;
      run.unlogged += dt;
      if (run.unlogged >= 10) { logDay(run.unlogged); run.unlogged = 0; save(); }
    }
  }

  function onPass({ n, st, all, verdict, bpm, change, text }) {
    if (verdict.clean) {
      const ex = exData(run.p.id);
      if (bpm > (ex.best || 0)) ex.best = bpm;
    }
    const head = `Pass ${n}`;
    if (change > 0) say('ok', `${head}: clean`, `${text}. Up to ${run.bpm} bpm.`);
    else if (change < 0) say('warn', `${head}: rough`, `${text}. Down to ${run.bpm} bpm to settle it.`);
    else say(verdict.clean ? 'ok' : verdict.rough ? 'bad' : 'hint', `${head}${verdict.clean ? ': clean' : ''}`, `${text}${st.extras ? ` · ${st.extras} extra` : ''}.`);
    if (change) { renderTempo(); applyDetector(); }
    renderStats(all);
    renderReport(run, all, false);
  }

  function stopRun() {
    if (!run) return;
    const r = run;
    run = null;
    clearInterval(clock);
    countTimeFor(r);
    const { st } = r.stop();
    if (r.unlogged > 0) logDay(r.unlogged);
    const ex = exData(r.p.id);
    if (r.micAtStart && st.n >= 8 && st.hits >= 4) {
      ex.runs++;
      ex.score = Math.round(st.score * 100) / 100;
      ex.last = todayStr();
      ex.bpm = r.bestClean || r.bpm; // next time, start where you last played clean
      DATA.history.unshift({ date: todayStr(), id: r.p.id, name: r.p.name, bpm: r.bpm, startBpm: r.startBpm, score: ex.score, bias: Math.round(st.bias), spread: Math.round(st.spread), hitRate: Math.round(st.hitRate * 100) / 100, sec: Math.round(r.sec) });
      DATA.history = DATA.history.slice(0, 60);
      logDay(0, { key: `rhythm:${r.p.id}`, value: { title: `Rhythm · ${r.p.name}`, block: 'rhythm', skill: `rhythm:${r.p.id}`, score: ex.score, bpm: r.bpm } });
      updateLearner(r, st);
      cur.bpm = ex.bpm;
    }
    save();
    setState('ready');
    dots().forEach((d) => d.classList.remove('on', 'quiet'));
    renderTempo();
    renderStats(st, { need: r.tempo.need, streak: r.tempo.clean, passes: r.passCount });
    renderReport(r, st, true);
    renderHistory();
    renderExercise();
    renderLib();
    if (st.n && r.micAtStart) {
      const best = r.bestClean ? ` Best clean pass: ${r.bestClean} bpm.` : '';
      say(st.score >= 0.8 ? 'ok' : 'hint', 'Stopped', `${mmss(r.sec)} played. ${Math.round(st.hitRate * 100)}% of hits, ${RP.biasText(st.bias)} on average, ±${Math.round(st.spread)} ms.${best}`);
    }
  }
  // Practice here counts in the daily session's skill model (ff.learner) too: the planner then knows
  // what you've played, and the session's rhythm exercises start at your tempo.
  function updateLearner(r, st) {
    const G = window.SessionGen;
    if (!G || !r.passCount) return;
    const L = new G.Learner(store.get('ff.learner', {}), { start: store.get('ff.session.settings', {}).start || 'box1' });
    const skill = `rhythm:${r.p.id}`;
    L.update(skill, st.score, todayStr(), { fam: 'rhythm', id: r.p.id, cat: r.p.cat, skill, tags: ['*'] });
    L.saveTempo(`${skill}:tempo`, { bpm: r.bpm, cleanBpm: r.bestClean });
    store.set('ff.learner', L.toJSON());
  }
  // The last fraction of a second before Stop.
  function countTimeFor(r) {
    const dt = Math.min(1, (performance.now() - r.lastTick) / 1000);
    if (state === 'run' && r.micAtStart) { r.sec += dt; r.unlogged += dt; }
  }

  // ---------- attacks from the detector: the light, and measuring the offset ----------
  engine.on('onset', (o) => {
    flashHit(o);
    if (cal) cal.raw.push(o.t);
  });

  // ---------- the report ----------
  let lastReport = null;
  function renderReport(r, st, final) {
    lastReport = [r, st, final];
    const ex = exData(r.p.id);
    $('repKicker').textContent = final ? 'Last run' : 'This run';
    $('repTitle').textContent = `${r.p.name} · ${r.startBpm === r.bpm ? `${r.bpm}` : `${r.startBpm} → ${r.bpm}`} bpm${r.sec ? ` · ${mmss(r.sec)}` : ''}`;
    const lv = (v, a, b) => (v <= a ? 'good' : v <= b ? 'meh' : 'bad');
    const today = Math.round((DATA.days[todayStr()] || 0) / 60);
    const tiles = st.n ? [
      ['Hits', `${Math.round(st.hitRate * 100)}<small>%</small>`, lv(1 - st.hitRate, 0.05, 0.2)],
      ['Average', Math.abs(st.bias) < 1 ? '0<small>ms</small>' : msWord(st.bias), lv(Math.abs(st.bias), 10, 20)],
      ['Spread', `±${Math.round(st.spread)}<small>ms</small>`, lv(st.spread, 15, 25)],
      ['Best clean tempo', ex.best ? `${ex.best}<small>bpm</small>` : '–', ''],
      ['Rhythm today', `${today}<small>min</small>`, ''],
    ] : [];
    $('repTiles').innerHTML = tiles.map(([l, v, c]) => `<div class="tile ${c}"><span class="tile-label">${l}</span><span class="tile-value">${v}</span></div>`).join('');
    drawDrift(r);
    drawPos(st);
    $('repTips').innerHTML = R.tips(st, { bpm: r.startBpm }).map((t) => `<li class="${t.level}">${esc(t.text)}</li>`).join('');
  }

  function drawDrift(r) {
    const svg = $('driftChart');
    const hits = r ? r.grader.doneSteps().filter((s) => s.hit && s.played) : [];
    if (hits.length < 2) {
      const w = widthOf(svg, 320, 1200);
      svg.setAttribute('viewBox', `0 0 ${w} 230`);
      svg.innerHTML = `<text class="empty" x="${w / 2}" y="120">Your hits will appear here as you play.</text>`;
      return;
    }
    const W = widthOf(svg, 320, 1200);
    const H = 230;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const L = 52;
    const Rp = 12;
    const T = 14;
    const B = 22;
    const t0 = r.firstBar;
    const t1 = Math.max(hits[hits.length - 1].t, t0 + 1);
    const X = (t) => L + ((t - t0) / (t1 - t0)) * (W - L - Rp);
    const Y = (ms) => T + ((80 - clamp(ms, -80, 80)) / 160) * (H - T - B);
    let h = '';
    for (const [a, b] of r.quiet) if (a < t1) h += `<rect class="quiet" x="${X(Math.max(a, t0))}" y="${T}" width="${Math.max(0, X(Math.min(b, t1)) - X(Math.max(a, t0)))}" height="${H - T - B}"/>`;
    h += `<rect class="band" x="${L}" y="${Y(15)}" width="${W - L - Rp}" height="${Y(-15) - Y(15)}"/>`;
    for (const v of [-50, -25, 25, 50]) h += `<line class="grid" x1="${L}" x2="${W - Rp}" y1="${Y(v)}" y2="${Y(v)}"/><text class="lbl" x="${L - 8}" y="${Y(v) + 4}" text-anchor="end">${v > 0 ? '+' : '−'}${Math.abs(v)}</text>`;
    h += `<line class="zero" x1="${L}" x2="${W - Rp}" y1="${Y(0)}" y2="${Y(0)}"/><text class="lbl" x="${L - 8}" y="${Y(0) + 4}" text-anchor="end">0</text>`;
    h += `<text class="lbl" x="${L}" y="${H - 5}">late ↑ · early ↓</text><text class="lbl" x="${W - Rp}" y="${H - 5}" text-anchor="end">${mmss(t1 - t0)}</text>`;
    const stride = Math.max(1, Math.ceil(hits.length / 1500));
    for (let i = 0; i < hits.length; i += stride) {
      const s = hits[i];
      h += `<circle class="dot ${R.feel(s.played.off).cls}" cx="${X(s.t).toFixed(1)}" cy="${Y(s.played.off * 1000).toFixed(1)}" r="3.2"/>`;
    }
    // A moving average over 8 hits: the drift.
    const pts = [];
    for (let i = 0; i < hits.length; i += stride) {
      const w = hits.slice(Math.max(0, i - 7), i + 1).map((s) => s.played.off * 1000);
      pts.push(`${X(hits[i].t).toFixed(1)},${Y(R.mean(w)).toFixed(1)}`);
    }
    if (pts.length > 1) h += `<polyline class="trend" points="${pts.join(' ')}"/>`;
    svg.innerHTML = h;
  }

  function drawPos(st) {
    const box = $('posChart');
    if (!st.byPos.length) { box.innerHTML = ''; return; }
    let h = '';
    let grid = null;
    for (const p of st.byPos) {
      if (p.grid !== grid) { grid = p.grid; h += `<div class="pos-head">${esc(R.GRID_NAME[grid])}</div>`; }
      const v = p.mean;
      const w = (clamp(Math.abs(v), 0, 40) / 40) * 50;
      const cls = R.feel(v / 1000).cls;
      const name = p.name === 'the beat' ? 'beat' : p.name.replace(/^the /, '');
      h += `<div class="pos-row"><span>${esc(name)}${p.dir ? ` <span class="fine">${p.dir === 'up' ? '↑' : '↓'}</span>` : ''}</span><span class="pos-bar"><i class="${cls}" style="${v < 0 ? `right:50%` : `left:50%`};width:${w.toFixed(1)}%"></i></span><span class="pos-val">${v >= 0 ? '+' : '−'}${Math.round(Math.abs(v))} ms</span></div>`;
    }
    h += '<div class="pos-scale"><span>40 ms early</span><span>40 ms late</span></div>';
    box.innerHTML = h;
  }

  function renderHistory() {
    const list = DATA.history.slice(0, 15);
    $('history').innerHTML = list.length ? list.map((h) => {
      const d = new Date(`${h.date}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
      const tempo = h.startBpm && h.startBpm !== h.bpm ? `${h.startBpm}→${h.bpm}` : h.bpm;
      return `<li><span>${esc(d)}</span><b>${esc(h.name)}</b><span>${tempo} bpm</span><span>${Math.round(h.hitRate * 100)}%</span><span>${h.bias < 0 ? '−' : '+'}${Math.abs(h.bias)} ms ±${h.spread}</span></li>`;
    }).join('') : '<li><span>No runs yet.</span></li>';
  }

  // ---------- the library ----------
  const preview = (p) => [...p.bars[0].hits].map((c) => (R.SYM[c].hit ? RP.GLYPH[c] : '·')).join('');
  function renderLib() {
    const catId = settings.cat || cur.pattern.cat;
    $('catSeg').innerHTML = R.CATS.map((c) => `<button type="button" role="tab" data-block="${c.id}" data-value="${c.id}" aria-checked="${c.id === catId}" aria-selected="${c.id === catId}">${esc(c.name)}</button>`).join('');
    $('libList').innerHTML = R.PATTERNS.filter((p) => p.cat === catId).map((p) => {
      const ex = exData(p.id);
      const meta = [`${gridName(p)}`, meterName(p), p.click ? CLICK_NAME[clickKey(p.click)] : null, ex.best ? `<span class="best">best ${ex.best} bpm</span>` : `from ${p.bpm} bpm`].filter(Boolean);
      return `<button type="button" role="listitem" class="lib-item" data-block="${p.cat}" data-id="${p.id}" aria-current="${p.id === cur.pattern.id}">
        <span class="lib-name">${esc(p.name)}${p.zh ? `<small>${esc(p.zh)}</small>` : ''}</span>
        <span class="lib-pat" aria-hidden="true">${esc(preview(p))}</span>
        <span class="lib-meta">${meta.map((m) => `<span>${m}</span>`).join('')}</span>
      </button>`;
    }).join('');
  }
  $('catSeg').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    settings.cat = b.dataset.value;
    save();
    renderLib();
  });
  $('libList').addEventListener('click', (e) => {
    const b = e.target.closest('.lib-item');
    if (!b) return;
    loadExercise(b.dataset.id);
    $('rxCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // ---------- controls ----------
  $('goBtn').addEventListener('click', (e) => { e.currentTarget.blur(); toggle(); });
  function toggle() { if (run) stopRun(); else startRun(); }
  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input, select, textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.code === 'Space' && e.target.closest('button, summary')) return; // the focused control handles it
    if (e.code === 'Space') { e.preventDefault(); toggle(); } else if (e.key === '-' || e.key === '_' || e.key === 'ArrowLeft') { setTempo((run ? run.bpm : cur.bpm) - 2); } else if (e.key === '=' || e.key === '+' || e.key === 'ArrowRight') { setTempo((run ? run.bpm : cur.bpm) + 2); } else if (e.key === 'l' || e.key === 'L') $('ladderBtn').click();
    else if (e.key === 'd' || e.key === 'D') $('soundBtn').click();
  });
  window.addEventListener('pagehide', () => { if (run) stopRun(); });
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (!run) drawLane(); // while running, the dots on the lane would be lost
      drawStrip();
      if (lastReport) renderReport(...lastReport);
    }, 150);
  });

  // ---------- start ----------
  syncToggles();
  loadExercise(settings.ex);
  renderLat();
  renderHistory();
  drawStrip();
  drawDrift(null);
  say('hint', 'Ready', engine.micOn ? 'Press Start.' : 'Enable the microphone (or your interface), measure the timing offset once, then press Start.');

  window.__rhythm = { engine, R, settings, DATA, latency, get run() { return run; }, get cur() { return cur; }, measure, startRun, stopRun };
})();
