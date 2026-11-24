// UI controller: settings, mic, the live tuner, and the drill's screens.
(function () {
  'use strict';
  const T = window.Theory;
  const { Drill, NoteStats, PACES, PACE_ORDER, GOAL_MS, tone } = window.DrillLib;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const secs = (ms) => (ms / 1000).toFixed(1);

  // ---------- persistence (per browser; the app works without it) ----------
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode etc. */ }
    },
  };

  const DEFAULTS = {
    mode: 'everywhere', note: 'circle', direction: 'upback', notes: 'naturals', strings: [1, 2, 3, 4, 5, 6], count: '20',
    pace: 'free', range: '0-12', tuning: 'standard', strictOctave: true, autoHint: false, weakSpots: true,
    clickVolume: 70, sensitivity: 58, deviceId: '',
  };
  const settings = { ...DEFAULTS, ...store.get('ff.settings', {}) };
  // The input settings in ff.settings belong to the Hearing card (micpanel.js): keep its values.
  // These are every key micpanel.js saves; `settings` holds the copies from page load, which go stale
  // as soon as the card changes one (Unplugged guitar, the A4 reference).
  const INPUT_KEYS = ['sensitivity', 'deviceId', 'channel', 'outputId', 'a4', 'quiet'];
  const saveSettings = () => {
    const saved = store.get('ff.settings', {});
    const out = { ...saved, ...settings };
    for (const k of INPUT_KEYS) if (k in saved) out[k] = saved[k];
    store.set('ff.settings', out);
  };
  const stats = new NoteStats(store.get('ff.stats', {}));
  let circleIdx = store.get('ff.circle', 0) % 12;
  const streaks = store.get('ff.streaks', {});

  const tuning = () => T.TUNINGS[settings.tuning] || T.TUNINGS.standard;
  const range = () => settings.range.split('-').map(Number);

  // ---------- audio ----------
  const engine = new window.AudioEngine();
  let ignoreMicUntil = 0;

  // ---------- fretboard ----------
  const board = new window.Fretboard($('board'), { tuning: tuning(), onPick: pickOnScreen });
  const [r0, r1] = range();
  board.configure({ from: r0, to: r1 });

  // ---------- setup controls ----------
  function bindSeg(name, onChange) {
    const seg = document.querySelector(`.seg[data-name="${name}"]`);
    const sync = () => seg.querySelectorAll('button').forEach((b) => {
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(b.dataset.value === String(settings[name])));
    });
    seg.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      settings[name] = b.dataset.value;
      saveSettings();
      sync();
      b.blur();
      if (onChange) onChange();
    });
    sync();
  }

  // Pace buttons come from the stage table.
  $('paceSeg').innerHTML = PACE_ORDER.map((id) => `<button type="button" data-value="${id}">${PACES[id].label}<small>${PACES[id].short}</small></button>`).join('');

  bindSeg('mode', refreshSetup);
  bindSeg('direction');
  bindSeg('notes');
  bindSeg('count');
  bindSeg('pace', refreshSetup);
  bindSeg('range', () => {
    const [a, b] = range();
    board.configure({ from: a, to: b });
    showIdleBoard();
  });

  function renderStringChips() {
    const tun = tuning();
    $('stringChips').innerHTML = [6, 5, 4, 3, 2, 1].map((s) => `<button type="button" data-s="${s}" role="checkbox" aria-checked="${settings.strings.includes(s)}">${T.stringName(s, tun)}</button>`).join('');
  }
  $('stringChips').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const s = Number(b.dataset.s);
    const on = settings.strings.includes(s);
    if (on && settings.strings.length === 1) return; // keep at least one string
    settings.strings = on ? settings.strings.filter((x) => x !== s) : [...settings.strings, s].sort();
    saveSettings();
    b.setAttribute('aria-checked', String(!on));
    b.blur();
  });

  function renderNoteSelect() {
    const opts = [`<option value="circle">Circle of 4ths: ${T.CIRCLE_OF_FOURTHS[circleIdx]} next</option>`, '<option value="random">Random note</option>'];
    for (let pc = 0; pc < 12; pc++) {
      const sp = T.spellings(pc);
      opts.push(`<option value="${pc}">${sp.join(' / ')}</option>`);
    }
    $('noteSelect').innerHTML = opts.join('');
    $('noteSelect').value = settings.note;
  }
  $('noteSelect').addEventListener('change', (e) => { settings.note = e.target.value; saveSettings(); });

  $('tuningSelect').innerHTML = Object.values(T.TUNINGS).map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join('');
  $('tuningSelect').value = settings.tuning;
  $('tuningSelect').addEventListener('change', (e) => {
    settings.tuning = e.target.value;
    strCheck = newCheck();
    saveSettings();
    board.configure({ tuning: tuning() });
    renderStringChips();
    showIdleBoard();
  });

  for (const id of ['strictOctave', 'autoHint', 'weakSpots']) {
    $(id).checked = !!settings[id];
    $(id).addEventListener('change', (e) => { settings[id] = e.target.checked; saveSettings(); });
  }
  $('clickVol').value = settings.clickVolume;
  engine.clickVolume = settings.clickVolume / 100;
  $('clickVol').addEventListener('input', (e) => {
    settings.clickVolume = Number(e.target.value);
    engine.clickVolume = settings.clickVolume / 100;
    saveSettings();
  });
  $('resetStats').addEventListener('click', () => {
    if (!confirm('Clear your speed map and stage streaks? This can’t be undone.')) return;
    stats.data = {};
    store.set('ff.stats', {});
    for (const k of Object.keys(streaks)) delete streaks[k];
    store.set('ff.streaks', streaks);
    showIdleBoard();
  });

  function refreshSetup() {
    document.querySelectorAll('[data-show]').forEach((el) => { el.hidden = el.dataset.show !== settings.mode; });
    $('modeHelp').textContent = settings.mode === 'everywhere'
      ? 'Find one note on every string, low E to high e and back, saying its name each time. The deck’s best two-minute drill.'
      : 'A note and a string, at random. Read it, find it, play it. Checkpoint: 20 cards, each under 2 seconds.';
    const p = PACES[settings.pace];
    const streak = streaks[`${settings.mode}|${settings.pace}`] || 0;
    $('paceHelp').textContent = p.bpm
      ? `${p.bpm} bpm, ${p.clicks === 1 ? 'one note every click' : `one note every ${p.clicks} clicks`}. Don’t stop for misses. Move up a stage after 3 clean rounds in a row${streak ? ` (you have ${streak})` : ''}.`
      : 'No metronome. Take the time you need; every note is timed against the 2-second checkpoint.';
  }

  // ---------- input (mic or USB interface), output and the live readout ----------
  // Shared with the other practice pages: see micpanel.js.
  window.MicPanel.setup(engine, {
    store,
    preferFlat: () => (drill && drill.current ? /♭/.test(drill.current.names[0]) : tuning().flat),
    tuning: () => tuning(),
  });
  let hearing = null; // the mic note being judged right now (for the string check)
  engine.on('note', (ev) => {
    if (engine.now() < ignoreMicUntil) return;
    hearing = ev;
    if (drill) drill.hear(ev, engine.now());
    hearing = null;
  });

  // ---------- string check ----------
  // The drill accepts the right pitch on any string. Once a found note's sound has been measured
  // (js/stringid.js), say so if it clearly came from another string than the one asked for. It's a
  // hint, never a miss: the guess from a room mic isn't sure enough to grade on.
  const SI = window.StringId;
  const newCheck = () => (SI ? new SI.StringCheck({ model: SI.StringModel.fromJSON(store.get('ff.strings', null)), tuning: tuning().open }) : null);
  let strCheck = newCheck();
  window.addEventListener('ff:strings', () => { strCheck = newCheck(); });
  engine.on('timbre', ({ id, feat }) => {
    if (!strCheck) return;
    const r = strCheck.check(id, feat);
    if (!r) return;
    const tg = r.want.tg;
    tg.offString = { s: r.s, f: r.f };
    const sounded = `${esc(T.stringLongName(r.s, tuning()))} string, fret ${r.f}`;
    feedback('warn', `${esc(tg.names[0])}: other string?`, `Right note, but it sounded like the ${sounded}. This one is on the ${esc(T.stringLongName(tg.s, tuning()))} string.`);
    board.flash({ s: r.s, f: r.f, label: '?', kind: 'wrong' }, 1500);
  });

  async function pickOnScreen(s, f) {
    await engine.init();
    const midi = T.midiAt(s, f, tuning());
    engine.pluck(midi);
    const now = engine.now();
    ignoreMicUntil = now + 1.3; // don't let the mic hear the synth and count it again
    if (drill) drill.hear({ midi, s, playedAt: now, t: now }, now);
  }

  // ---------- the drill ----------
  let drill = null;
  let roundDots = [];
  let hintDots = [];
  let metroBeat = null;

  // Hints go underneath, so a note you've already found stays visible (and doubles as an anchor).
  const drawBoard = () => board.setDots([...hintDots, ...roundDots]);

  function feedback(kind, tag, text) {
    const fb = $('feedback');
    fb.className = `feedback ${kind || ''}`;
    fb.innerHTML = tag ? `<span class="tag">${tag}</span><span>${text || ''}</span>` : (text || '');
  }

  function setCardState(state) {
    const card = $('targetCard');
    card.dataset.state = state;
    if (state === 'wrong') {
      // restart the nudge animation, then fall back to active
      card.style.animation = 'none';
      void card.offsetWidth;
      card.style.animation = '';
      setTimeout(() => { if (card.dataset.state === 'wrong') card.dataset.state = 'active'; }, 300);
    }
  }

  function buildConfig() {
    const [from, to] = range();
    const cfg = {
      mode: settings.mode, direction: settings.direction, notes: settings.notes, strings: settings.strings.map(Number),
      count: Number(settings.count), pace: settings.pace, from, to, tuning: settings.tuning,
      strictOctave: settings.strictOctave, autoHint: settings.autoHint, weakSpots: settings.weakSpots,
    };
    if (settings.mode === 'everywhere') {
      if (settings.note === 'circle') {
        const name = T.CIRCLE_OF_FOURTHS[circleIdx];
        cfg.pc = T.pcOf(name);
        cfg.names = T.spellings(cfg.pc, /♭/.test(name));
      } else if (settings.note === 'random') {
        cfg.pc = Math.floor(Math.random() * 12);
        cfg.names = T.spellings(cfg.pc, Math.random() < 0.5);
      } else {
        cfg.pc = Number(settings.note);
        cfg.names = T.spellings(cfg.pc);
      }
    }
    return cfg;
  }

  async function start() {
    if (drill && drill.state !== 'done') return;
    await engine.init();
    const cfg = buildConfig();
    const pace = PACES[cfg.pace];
    drill = new Drill(cfg, stats, { target: onTarget, hit: onHit, wrong: onWrong, miss: onMiss, hint: onHint, done: onDone });
    if (!drill.targets.length) {
      feedback('warn', 'Nothing to play', 'No notes fit those strings and frets. Widen the fret range.');
      drill = null;
      return;
    }
    roundDots = [];
    hintDots = [];
    drawBoard();
    board.setTargetString(null);
    $('boardTitle').textContent = cfg.mode === 'everywhere' ? `Every ${cfg.names[0]} from fret ${cfg.from} to ${cfg.to}` : 'Flash cards';
    $('boardLegend').innerHTML = '';
    $('boardFoot').textContent = engine.micOn ? '' : 'The mic is off: click the fretboard to answer, or turn the mic on.';
    $('setupPanel').hidden = true;
    $('resultsPanel').hidden = true;
    $('runPanel').hidden = false;
    $('skipBtn').hidden = !!pace.bpm;
    $('clock').hidden = false;
    renderProgress();
    feedback('', '', '');

    const now = engine.now();
    if (pace.bpm) {
      const beat = 60 / pace.bpm;
      const startAt = now + 0.15;
      const countIn = 4;
      metroBeat = { beat, startAt, countIn, clicks: pace.clicks };
      engine.startMetronome({ bpm: pace.bpm, startAt, accentEvery: pace.clicks >= 2 ? pace.clicks : 4 });
      drill.begin(startAt + countIn * beat);
      $('targetSub').textContent = 'Count-in…';
    } else {
      metroBeat = null;
      drill.begin(now + 0.7);
      $('targetSub').textContent = 'Get ready…';
    }
    $('targetNote').textContent = '·';
    $('targetAlt').textContent = '';
    $('targetString').innerHTML = cfg.mode === 'everywhere' ? `Find <b>${esc(cfg.names[0])}</b> on every string` : `${drill.targets.length} cards`;
    setCardState('countin');
    updateRunInfo();
    loop();
  }

  function stringPhrase(s) {
    const ord = ['', '1st', '2nd', '3rd', '4th', '5th', '6th'][s];
    return `on the <span class="str">${esc(T.stringLongName(s, tuning()))}</span> string <span class="target-alt">(${ord})</span>`;
  }

  function onTarget(tg, i) {
    hintDots = [];
    const previous = drill.cfg.mode === 'flash' ? roundDots : [];
    if (drill.cfg.mode === 'flash') roundDots = [];
    drawBoard();
    for (const d of previous) board.flash({ ...d, pop: false }, 1200); // let the last answer linger briefly
    board.setTargetString(tg.s);
    const note = $('targetNote');
    note.textContent = tg.names[0];
    note.classList.remove('pop');
    void note.offsetWidth;
    note.classList.add('pop');
    $('targetAlt').textContent = tg.names[1] ? `also called ${tg.names[1]}` : '';
    $('targetString').innerHTML = stringPhrase(tg.s);
    $('targetSub').textContent = 'Play it, and say its name out loud.';
    setCardState('active');
    renderProgress();
    updateRunInfo();
  }

  function onHit(tg) {
    if (strCheck && hearing && hearing.id != null) strCheck.expect(hearing.id, { s: tg.s, f: tg.fret, midi: T.midiAt(tg.s, tg.fret, tuning()), tg });
    stats.record(settings.tuning, tg.s, tg.pc, tg.ms);
    store.set('ff.stats', stats.data);
    roundDots.push({ s: tg.s, f: tg.fret, label: tg.names[0], kind: 'found', pop: true, title: `${secs(tg.ms)} s` });
    drawBoard();
    const fast = tg.ms < GOAL_MS;
    feedback('ok', `✓ ${esc(tg.names[0])}`, `${stringWord(tg.s)} string, fret ${tg.fret} · ${secs(tg.ms)} s${fast ? '' : ' (goal: under 2 s)'}`);
    if (drill.current === tg) setCardState('hit');
    flashCard();
    renderProgress();
  }

  function flashCard() {
    const card = $('targetCard');
    card.classList.remove('flash-ok');
    void card.offsetWidth;
    card.classList.add('flash-ok');
  }

  function onWrong(tg, ev, j) {
    const heard = T.midiLabel(ev.midi, /♭/.test(tg.names[0]));
    let text;
    if (j.reason === 'string') text = `That’s the ${esc(T.stringLongName(ev.s, tuning()))} string. Find it on the ${esc(T.stringLongName(tg.s, tuning()))} string.`;
    else if (j.reason === 'octave') text = `Right note, wrong octave: that ${esc(tg.names[0])} isn’t on the ${esc(T.stringLongName(tg.s, tuning()))} string.`;
    else if (j.off != null && j.off !== 0) text = `If you’re on the ${esc(T.stringLongName(tg.s, tuning()))} string, that’s ${Math.abs(j.off)} fret${Math.abs(j.off) > 1 ? 's' : ''} too ${j.off < 0 ? 'low' : 'high'}.`;
    else text = 'Not it. Keep looking.';
    feedback('warn', `Heard ${esc(heard)}`, text);
    if (j.reason === 'note' && j.fret != null) board.flash({ s: tg.s, f: j.fret, label: T.noteName(ev.midi, /♭/.test(tg.names[0])), kind: 'wrong' });
    setCardState('wrong');
  }

  function onMiss(tg) {
    stats.record(settings.tuning, tg.s, tg.pc, null);
    store.set('ff.stats', stats.data);
    for (const f of tg.frets) roundDots.push({ s: tg.s, f, label: tg.names[0], kind: 'missed' });
    drawBoard();
    const where = tg.frets.length > 1 ? `frets ${tg.frets.join(' or ')}` : `fret ${tg.frets[0]}`;
    feedback('bad', tg.status === 'skip' ? 'Skipped' : 'Missed', `${esc(tg.names[0])} on the ${esc(T.stringLongName(tg.s, tuning()))} string is at ${where}.`);
    if (drill.current === tg) setCardState('miss');
    renderProgress();
  }

  function onHint(tg, level) {
    const tun = tuning();
    const [from, to] = range();
    if (level === 1) {
      if (tg.s === 6 || tg.s === 5) {
        // On an anchor string itself: show its natural-note landmarks (minus the answer).
        hintDots = [];
        for (let f = from; f <= to; f++) {
          const pc = T.pcAt(tg.s, f, tun);
          if (T.isNatural(pc) && pc !== tg.pc) hintDots.push({ s: tg.s, f, label: T.noteName(pc), kind: 'anchor' });
        }
        feedback('hint', 'Hint', `Landmarks on the ${esc(T.stringLongName(tg.s, tun))} string. Count frets from the nearest one (1 fret = 1 half step; no ♯ between B–C and E–F).`);
      } else {
        hintDots = [5, 6].flatMap((s) => T.fretsFor(s, tg.pc, tun, from, to).map((f) => ({ s, f, label: tg.names[0], kind: 'anchor' })));
        feedback('hint', 'Hint', `Here are your anchors on the E and A strings. Carry one up with an octave shape: 2 strings up, 2 frets up (3 frets if you cross the B string).`);
      }
    } else {
      hintDots = hintDots.concat(tg.frets.map((f) => ({ s: tg.s, f, label: tg.names[0], kind: 'reveal' })));
      feedback('hint', 'Shown', `It’s at ${tg.frets.length > 1 ? `fret ${tg.frets.join(' or ')}` : `fret ${tg.frets[0]}`}. Play it and say the name.`);
    }
    drawBoard();
  }

  const stringWord = (s) => esc(T.stringLongName(s, tuning())).replace(/^./, (c) => c.toUpperCase());

  function renderProgress() {
    if (!drill) { $('progress').hidden = true; return; }
    const tun = tuning();
    $('progress').hidden = false;
    $('progress').innerHTML = drill.targets.map((t) => {
      const cls = [t.status, t.status === 'hit' && t.ms >= GOAL_MS ? 'slow' : ''].join(' ');
      const title = t.status === 'hit' ? `${t.names[0]}, ${T.stringLongName(t.s, tun)} string: ${secs(t.ms)} s` : '';
      const label = drill.cfg.mode === 'everywhere'
        ? esc(T.stringName(t.s, tun))
        : (['pending', 'active'].includes(t.status) ? '?' : `${esc(t.names[0])}<small>${esc(T.stringName(t.s, tun))}</small>`);
      return `<span class="chip ${cls}" title="${esc(title)}">${label}</span>`;
    }).join('');
  }

  function updateRunInfo() {
    if (!drill) return;
    const n = drill.targets.length;
    const i = Math.min(n, Math.max(0, drill.idx + 1));
    const p = drill.pace;
    $('runInfo').innerHTML = `<b>${i} / ${n}</b> · ${p.bpm ? `${p.label}, ${p.bpm} bpm` : 'Free pace'}${engine.micOn ? '' : ' · mic off: click the board'}`;
  }

  let rafId = null;
  function loop() {
    cancelAnimationFrame(rafId);
    const step = () => {
      if (!drill) return;
      const now = engine.now();
      drill.tick(now);
      updateClock(now);
      if (drill.state !== 'done') rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
  }

  function updateClock(now) {
    if (!drill || drill.state === 'done') return;
    if (drill.state === 'countin') {
      if (metroBeat) {
        const left = Math.ceil((drill.t0 - now) / metroBeat.beat - 1e-6);
        $('targetNote').textContent = left > 0 && left <= metroBeat.countIn ? String(left) : '·';
      }
      renderBeats(0, metroBeat ? metroBeat.clicks : 0);
      $('timerText').textContent = '';
      $('timerFill').style.width = '0';
      return;
    }
    const tg = drill.current;
    if (!tg) return;
    if (metroBeat) {
      const into = Math.floor((now - tg.shownAt) / metroBeat.beat + 1e-6) + 1;
      renderBeats(Math.min(into, metroBeat.clicks), metroBeat.clicks);
    } else {
      renderBeats(0, 0);
    }
    const ms = tg.status === 'hit' ? tg.ms : Math.max(0, (now - tg.shownAt) * 1000);
    $('timerText').textContent = `${secs(ms)} s`;
    const fill = $('timerFill');
    fill.style.width = `${Math.min(100, (ms / (GOAL_MS * 2)) * 100)}%`;
    fill.classList.toggle('over', ms >= GOAL_MS);
  }

  let beatsKey = '';
  function renderBeats(on, total) {
    const key = `${on}/${total}`;
    if (key === beatsKey) return;
    beatsKey = key;
    $('beats').innerHTML = Array.from({ length: total }, (_, k) => `<span class="beat ${k < on ? 'on' : ''} ${k === total - 1 ? 'last' : ''}"></span>`).join('');
  }

  function stop() {
    if (drill && drill.state !== 'done') drill.stop();
  }

  function onDone(sum) {
    engine.stopMetronome();
    if (sum.aborted && sum.played === 0) { backToSetup(); return; }
    cancelAnimationFrame(rafId);
    board.setTargetString(null);
    hintDots = [];
    const cfg = drill.cfg;
    const pace = drill.pace;

    // Board: this round's notes, colored by speed.
    roundDots = [];
    for (const t of drill.targets) {
      if (t.status === 'hit') roundDots.push({ s: t.s, f: t.fret, label: t.names[0], kind: 'heat', tone: tone(t.ms), title: `${secs(t.ms)} s` });
      else if (t.status === 'miss' || t.status === 'skip') for (const f of t.frets) roundDots.push({ s: t.s, f, label: t.names[0], kind: 'missed' });
    }
    drawBoard();
    $('boardTitle').textContent = 'This round';
    $('boardLegend').innerHTML = legendHTML(true);
    $('boardFoot').textContent = '';

    // Streaks for the stage ladder.
    const key = `${cfg.mode}|${cfg.pace}`;
    if (!sum.aborted) {
      streaks[key] = sum.clean ? (streaks[key] || 0) + 1 : 0;
      store.set('ff.streaks', streaks);
      const hist = store.get('ff.history', []);
      hist.push({ at: new Date().toISOString(), mode: cfg.mode, pace: cfg.pace, note: cfg.names ? cfg.names[0] : null, total: sum.total, hits: sum.hits, avgMs: sum.avgMs });
      store.set('ff.history', hist.slice(-50));
    }

    $('runPanel').hidden = true;
    $('resultsPanel').hidden = false;
    $('clock').hidden = true;
    setCardState(sum.clean ? 'hit' : 'done');
    $('targetNote').textContent = sum.clean ? '✓' : `${sum.hits}`;
    $('targetAlt').textContent = '';
    $('targetString').innerHTML = sum.aborted ? 'Stopped' : sum.clean ? 'Clean round' : `of ${sum.total} found`;
    $('targetSub').textContent = '';
    feedback('', '', '');

    $('resultsKicker').textContent = sum.aborted ? 'Round stopped' : `${cfg.mode === 'everywhere' ? `One note everywhere · ${cfg.names[0]}` : 'Flash cards'} · ${pace.label}`;
    $('resultsTitle').textContent = sum.aborted ? `${sum.hits} of ${sum.played} found before you stopped`
      : sum.clean && sum.underGoal === sum.total ? 'Clean round, every note under 2 seconds.'
        : sum.clean ? 'Clean round.'
          : `${sum.hits} of ${sum.total} found.`;

    const pct = sum.total ? sum.hits / (sum.aborted ? Math.max(1, sum.played) : sum.total) : 0;
    const tiles = [
      ['Found', `${sum.hits}<small>/ ${sum.aborted ? sum.played : sum.total}</small>`, pct === 1 ? 'good' : pct >= 0.8 ? 'meh' : 'bad'],
      ['Average', sum.avgMs != null ? `${secs(sum.avgMs)}<small>s</small>` : '–', sum.avgMs == null ? '' : sum.avgMs < GOAL_MS ? 'good' : sum.avgMs < 3500 ? 'meh' : 'bad'],
      ['Under 2 s', `${sum.underGoal}<small>/ ${sum.hits}</small>`, sum.hits && sum.underGoal === sum.hits ? 'good' : ''],
      ['Fastest', sum.bestMs != null ? `${secs(sum.bestMs)}<small>s</small>` : '–', ''],
      ['Wrong notes', String(sum.slips), sum.slips === 0 ? 'good' : ''],
    ];
    $('tiles').innerHTML = tiles.map(([l, v, c]) => `<div class="tile ${c}"><span class="tile-label">${l}</span><span class="tile-value">${v}</span></div>`).join('');

    const tips = [];
    if (sum.clean && sum.underGoal === sum.total) tips.push(['star', 'Checkpoint pace: every note in under 2 seconds. Keep it there for a week, then make it harder.']);
    if (pace.bpm && !sum.aborted) {
      const n = streaks[key] || 0;
      const nextIdx = PACE_ORDER.indexOf(cfg.pace) + 1;
      const next = PACES[PACE_ORDER[nextIdx]];
      if (sum.clean && n >= 3 && next) tips.push(['star', `${n} clean rounds in a row at ${pace.label}. Move up to <b>${next.label}</b> (${next.short}).`]);
      else if (sum.clean && n >= 3) tips.push(['star', `${n} clean rounds at Stage 4. You’ve hit the Part 3 checkpoint for this drill.`]);
      else if (sum.clean) tips.push(['', `Clean rounds in a row at ${pace.label}: <b>${n} of 3</b>.`]);
      else tips.push(['warn', `Streak reset. You need 3 clean rounds in a row (no misses, no hints) to move up from ${pace.label}.`]);
    } else if (!pace.bpm && !sum.aborted && sum.clean && sum.avgMs < GOAL_MS) {
      tips.push(['', 'You’re ready for the metronome: try <b>Stage 1</b> (40 bpm, 4 clicks per note).']);
    }
    if (sum.slowest) tips.push(['', `Slowest string: <b>${esc(T.stringLongName(sum.slowest.s, tuning()))}</b> (${secs(sum.slowest.ms)} s average). Give it its own day of string-by-string work.`]);
    if (sum.misses.length) {
      const list = sum.misses.slice(0, 4).map((t) => `${esc(t.names[0])} on ${esc(T.stringLongName(t.s, tuning()))} (fret ${t.frets.join('/')})`).join(', ');
      tips.push(['warn', `Missed: ${list}${sum.misses.length > 4 ? '…' : ''}. The red dashed rings on the board show where they are.`]);
    }
    const off = drill ? drill.targets.filter((t) => t.offString) : [];
    if (off.length) {
      const list = off.slice(0, 3).map((t) => `${esc(t.names[0])} (asked on ${esc(T.stringLongName(t.s, tuning()))}, sounded like ${esc(T.stringLongName(t.offString.s, tuning()))})`).join(', ');
      tips.push(['warn', `${off.length} note${off.length > 1 ? 's' : ''} sounded like another string: ${list}${off.length > 3 ? '…' : ''}. They still counted. The guess can be wrong, so if you were on the right string, teach it your guitar under Hearing.`]);
    }
    if (sum.hints) tips.push(['', `You used a hint ${sum.hints} time${sum.hints > 1 ? 's' : ''}. Next round, try the 3-step method first: anchor, octave shape, name it.`]);
    if (sum.slips >= 3) tips.push(['', 'Lots of wrong notes. Slow down: think first, then play. Finding it in your head before you play is the skill you’re building.']);
    $('insights').innerHTML = tips.map(([c, t]) => `<li class="${c}">${t}</li>`).join('');

    const nn = $('nextNoteBtn');
    if (cfg.mode === 'everywhere' && settings.note === 'circle') {
      nn.hidden = false;
      nn.innerHTML = `Next note: ${esc(T.CIRCLE_OF_FOURTHS[(circleIdx + 1) % 12])} <kbd>N</kbd>`;
    } else nn.hidden = true;
    renderProgress();
  }

  function nextNote() {
    circleIdx = (circleIdx + 1) % 12;
    store.set('ff.circle', circleIdx);
    renderNoteSelect();
    start();
  }

  function backToSetup() {
    stop();
    drill = null;
    engine.stopMetronome();
    $('resultsPanel').hidden = true;
    $('runPanel').hidden = true;
    $('setupPanel').hidden = false;
    $('clock').hidden = true;
    $('progress').hidden = true;
    setCardState('idle');
    $('targetNote').textContent = '?';
    $('targetAlt').textContent = '';
    $('targetString').innerHTML = 'Pick a drill below, then press <b>Start</b>.';
    $('targetSub').textContent = 'Play the note. Say its name out loud.';
    feedback('', '', '');
    refreshSetup();
    showIdleBoard();
  }

  function legendHTML(round) {
    return [
      ['var(--teal)', 'under 2 s'], ['var(--third)', '2–3.5 s'], ['var(--root)', round ? 'slower' : 'slower or missed'],
      ...(round ? [['transparent;border:1.5px dashed var(--root)', 'missed']] : [['#2a1810;border:1.5px solid #6b5848', 'not practiced yet']]),
    ].map(([c, t]) => `<span><i style="background:${c}"></i>${t}</span>`).join('');
  }

  // Idle board: the speed map, one dot per string and note.
  function showIdleBoard() {
    if (drill) return;
    const tun = tuning();
    const [from, to] = range();
    roundDots = [];
    let seen = 0;
    let fast = 0;
    const cells = new Set();
    for (const s of T.STRINGS) {
      for (let f = from; f <= to; f++) {
        const pc = T.pcAt(s, f, tun);
        const e = stats.get(settings.tuning, s, pc);
        const k = `${s}:${pc}`;
        if (!cells.has(k)) {
          cells.add(k);
          if (e) { seen++; if (e.ema < GOAL_MS) fast++; }
        }
        roundDots.push({
          s, f, label: T.noteName(pc, tun.flat), kind: 'heat', tone: e ? tone(e.ema) : null,
          title: e ? `${T.noteName(pc, tun.flat)}, ${T.stringLongName(s, tun)} string: ${secs(e.ema)} s average over ${e.n} tries` : 'Not practiced yet',
        });
      }
    }
    hintDots = [];
    board.setTargetString(null);
    drawBoard();
    $('boardTitle').textContent = 'Your speed map';
    $('boardLegend').innerHTML = legendHTML(false);
    $('boardFoot').textContent = seen
      ? `${fast} of ${cells.size} string-and-note pairs under 2 seconds · ${seen} practiced so far. The checkpoint is all of them.`
      : 'Every note lights up as you practice it: teal once you can find it in under 2 seconds.';
  }

  // ---------- buttons & keys ----------
  $('startBtn').addEventListener('click', (e) => { e.currentTarget.blur(); start(); });
  $('againBtn').addEventListener('click', (e) => { e.currentTarget.blur(); start(); });
  $('nextNoteBtn').addEventListener('click', (e) => { e.currentTarget.blur(); nextNote(); });
  $('setupBtn').addEventListener('click', (e) => { e.currentTarget.blur(); backToSetup(); });
  $('hintBtn').addEventListener('click', (e) => { e.currentTarget.blur(); if (drill) drill.hint(); });
  $('skipBtn').addEventListener('click', (e) => { e.currentTarget.blur(); if (drill) drill.skip(engine.now()); });
  $('stopBtn').addEventListener('click', (e) => { e.currentTarget.blur(); stop(); });

  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    const running = drill && drill.state !== 'done';
    const k = e.key.toLowerCase();
    if (e.code === 'Space') {
      e.preventDefault();
      if (!running) start();
    } else if (k === 'h' && running) drill.hint();
    else if (k === 's' && running) drill.skip(engine.now());
    else if (k === 'escape' && running) stop();
    else if (k === 'n' && !running && !$('nextNoteBtn').hidden && !$('resultsPanel').hidden) nextNote();
  });

  // ---------- init ----------
  renderStringChips();
  renderNoteSelect();
  refreshSetup();
  showIdleBoard();
  if (!window.isSecureContext) {
    $('micNote').textContent = 'The microphone only works when the app is served from http://localhost or https. See the README.';
  }

  // Exposed for debugging and automated checks.
  window.__ff = { engine, board, get drill() { return drill; }, settings };
})();
