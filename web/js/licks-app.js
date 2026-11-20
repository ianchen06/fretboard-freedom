// UI controller for Call & response: settings, the band, the lick on screen, listening to your
// answer and grading it.
//
// Timeline: every 4 bars is a slot. Bars 1–2 the band plays a lick ("Listen"), bars 3–4 you play it
// back ("Your turn"). The lick for a slot is chosen when its first bar is scheduled, a moment before
// it starts; that's also when the previous answer gets graded.
(function () {
  'use strict';
  const T = window.Theory;
  const LG = window.LickGen;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const mod12 = (n) => ((n % 12) + 12) % 12;

  // ---------- persistence (per browser; the page works without it) ----------
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode etc. */ }
    },
  };
  // The neural amp capture can be a megabyte or so: IndexedDB, not localStorage.
  const idb = {
    open() {
      return new Promise((resolve, reject) => {
        const req = indexedDB.open('fretboard-freedom', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('kv');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    },
    async get(key) {
      try {
        const db = await idb.open();
        return await new Promise((resolve) => {
          const r = db.transaction('kv').objectStore('kv').get(key);
          r.onsuccess = () => resolve(r.result);
          r.onerror = () => resolve(undefined);
        });
      } catch { return undefined; }
    },
    async set(key, value) {
      try {
        const db = await idb.open();
        db.transaction('kv', 'readwrite').objectStore('kv').put(value, key);
      } catch { /* storage blocked: the capture just won't be remembered */ }
    },
  };

  const DEFAULTS = {
    key: 9, bpm: 76, prog: 'twelve', level: '1', mode: 'repeat', turn: 'full',
    amp: 'builtin', cab: false, bandVol: 70, leadVol: 80, drive: 50, ear: false, strictOctave: true, monitor: false,
  };
  const settings = { ...DEFAULTS, ...store.get('ff.licks', {}) };
  const save = () => store.set('ff.licks', settings);

  const FLAT_KEYS = [1, 3, 5, 8, 10];
  const KEY_ORDER = [4, 5, 6, 7, 8, 9, 10, 11, 0, 1, 2, 3];
  const keyPc = () => Number(settings.key);
  const preferFlat = () => FLAT_KEYS.includes(keyPc());
  const pcName = (pc) => T.noteName(pc, preferFlat());
  const chordName = (name, key = keyPc()) => `${pcName(key + LG.CHORD_ROOT[name])}7`;
  const chordOfRoot = (root) => `${pcName(keyPc() + root)}7`;
  const INTERVAL = { 0: 'root', 2: '9th', 3: '♭3 (blue note)', 4: '3rd', 5: '4th', 6: '♭5', 7: '5th', 9: '6th', 10: '♭7' };
  const STRING_NAME = { 1: 'high e', 2: 'B', 3: 'G', 4: 'D', 5: 'A', 6: 'low E' };

  // ---------- audio ----------
  const engine = new window.AudioEngine();
  let band = null;
  const latency = () => (engine.ctx ? (engine.ctx.outputLatency || engine.ctx.baseLatency || 0) + 0.03 : 0.03);

  async function ensureAudio() {
    await engine.init();
    if (band) return;
    band = new window.Band(engine.ctx);
    band.init();
    applyMix();
    band.setCab(settings.cab);
    if (settings.amp === 'nam') restoreNam();
  }
  const applyMix = () => {
    if (!band) return;
    band.setMix({ band: (settings.bandVol / 100) * 1.2, lead: (settings.leadVol / 100) * 1.3 });
    band.setDrive(0.4 + (settings.drive / 100) * 1.6);
  };

  // ---------- generator ----------
  const gen = new LG.LickGen(window.LickLibrary.blues);
  if (gen.rejected.length) console.warn('Licks that break the rules were skipped:', gen.rejected);

  // ---------- input panel (mic or USB interface) ----------
  const TURN_HELP = 'No headphones? Pick Drums only so the mic doesn’t hear the bass and guitar.';
  const mic = window.MicPanel.setup(engine, { store, preferFlat, onInputChange });
  function onInputChange(kind) {
    const iface = kind === 'katana' || kind === 'interface';
    if (!bleedWarned) {
      $('turnHelp').textContent = iface
        ? 'Your input is an audio interface, so the band can’t leak in through the air: Full band is fine.'
        : TURN_HELP;
    }
    applyMonitor();
  }

  // Hear your guitar through the lick's amp. Only for an interface: with a mic it would feed back.
  async function applyMonitor() {
    const kind = mic.inputKind();
    const allowed = kind === 'katana' || kind === 'interface';
    const want = settings.monitor && allowed && engine.micOn;
    const note = $('monitorNote');
    if (settings.monitor && !allowed) {
      note.hidden = false;
      note.textContent = engine.micOn ? 'That input looks like a microphone, so monitoring stays off: it would feed back.' : 'Turns on when an audio interface is the input.';
    } else note.hidden = true;
    if (!want && !band) return;
    await ensureAudio();
    band.setMonitor(engine.input, want);
  }

  // ---------- fretboard and tab ----------
  const board = new window.Fretboard($('board'), { onPick: pickOnScreen });
  const tab = new window.Tab($('tab'));

  function configureBoard() {
    const R = LG.rootFret(keyPc());
    board.configure({ from: Math.max(0, R - 3), to: R + 6 });
  }

  function boxDots() {
    return LG.boxSpots(keyPc()).map((b) => ({
      s: b.s, f: b.f, label: LG.describeDegree(b.degree),
      kind: `box${b.degree === 0 ? ' root' : ''}${b.blue ? ' blue' : ''}`,
    }));
  }

  // Lick notes on the fretboard, numbered in playing order. states[i]: now | hit | alt | miss.
  function drawBoard(slot, states = []) {
    const dots = boxDots();
    if (slot && !slot.hidden) {
      const seen = new Map();
      slot.notes.forEach((n, i) => {
        const k = `${n.s}:${n.fret}`;
        const st = states[i];
        const d = seen.get(k);
        if (d) {
          if (st) d.kind = `lick ${st}`;
          return;
        }
        const dot = { s: n.s, f: n.fret, label: String(i + 1), kind: st ? `lick ${st}` : 'lick', title: n.bend ? `bend ${n.bend === 2 ? 'a whole step' : 'a half step'}` : undefined };
        seen.set(k, dot);
        dots.push(dot);
      });
    }
    board.setDots(dots);
  }

  // ---------- controls ----------
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
      save();
      sync();
      b.blur();
      if (onChange) onChange();
    });
    sync();
    return sync;
  }

  $('keySelect').innerHTML = KEY_ORDER.map((pc) => `<option value="${pc}">${T.noteName(pc, FLAT_KEYS.includes(pc))}${pc === 4 ? ' (metal’s favorite)' : pc === 9 ? ' (blues home)' : ''}</option>`).join('');
  $('keySelect').value = settings.key;
  $('keySelect').addEventListener('change', (e) => { settings.key = Number(e.target.value); save(); configureBoard(); refreshIdle(); restartIfRunning(); });

  const showTempo = () => { $('tempoVal').textContent = `${settings.bpm} bpm`; };
  $('tempo').value = settings.bpm;
  showTempo();
  $('tempo').addEventListener('input', (e) => { settings.bpm = Number(e.target.value); showTempo(); });
  $('tempo').addEventListener('change', () => { save(); restartIfRunning(); });

  bindSeg('prog', () => { refreshIdle(); restartIfRunning(); });
  bindSeg('level');
  bindSeg('mode');
  bindSeg('turn');
  const syncAmp = bindSeg('amp', async () => {
    if (settings.amp === 'nam') {
      await ensureAudio();
      if (!band.nam && !(await restoreNam())) setNamStatus('Load a capture first. Until then the lick uses the built-in amp.', 'warn');
    }
    if (band) band.setAmp(settings.amp);
  });

  for (const id of ['bandVol', 'leadVol', 'drive']) {
    $(id).value = settings[id];
    $(id).addEventListener('input', (e) => { settings[id] = Number(e.target.value); save(); applyMix(); });
  }
  $('earMode').checked = settings.ear;
  $('earMode').addEventListener('change', (e) => { settings.ear = e.target.checked; save(); });
  $('strictOctave').checked = settings.strictOctave;
  $('strictOctave').addEventListener('change', (e) => { settings.strictOctave = e.target.checked; save(); });
  $('monitor').checked = settings.monitor;
  $('monitor').addEventListener('change', (e) => { settings.monitor = e.target.checked; save(); applyMonitor(); });
  $('cabToggle').checked = settings.cab;
  $('cabToggle').addEventListener('change', (e) => { settings.cab = e.target.checked; save(); if (band) band.setCab(settings.cab); });

  function setNamStatus(text, kind = '') {
    $('namStatus').textContent = text;
    $('namStatus').className = `nam-status ${kind}`;
  }

  function describeNam(info) {
    const bits = [info.name];
    if (info.gear && info.gear !== info.name) bits.push(info.gear);
    let text = `Loaded: ${bits.join(' · ')}.`;
    if (!info.rateOk) text += ` It was captured at ${Math.round(info.expectedRate / 1000)} kHz but your audio runs at ${Math.round(info.rate / 100) / 10} kHz, so it may sound a little off.`;
    return text;
  }

  async function useNam(json, name) {
    const info = await band.loadNam(json, name);
    settings.amp = 'nam';
    settings.cab = info.useCab;
    $('cabToggle').checked = info.useCab;
    save();
    syncAmp();
    band.setAmp('nam');
    setNamStatus(describeNam(info), info.rateOk ? 'ok' : 'warn');
    return info;
  }

  async function restoreNam() {
    const saved = await idb.get('nam-model');
    if (!saved || !saved.json) return false;
    try {
      await useNam(saved.json, saved.name);
      return true;
    } catch (err) {
      setNamStatus(`Couldn’t load the saved capture: ${err.message}`, 'bad');
      return false;
    }
  }

  $('namFile').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setNamStatus('Loading…');
    try {
      const json = await file.text();
      await ensureAudio();
      await useNam(json, file.name.replace(/\.nam$/i, ''));
      idb.set('nam-model', { json, name: file.name.replace(/\.nam$/i, '') });
    } catch (err) {
      setNamStatus(`Couldn’t load that capture: ${err.message}`, 'bad');
      settings.amp = 'builtin';
      save();
      syncAmp();
      if (band) band.setAmp('builtin');
    }
  });
  idb.get('nam-model').then((saved) => { if (saved && saved.name) setNamStatus(`Saved capture: ${saved.name}. It loads when the band starts.`); });

  // ---------- the progression strip ----------
  function renderBars(bars) {
    $('bars').style.setProperty('--n', bars.length);
    $('bars').dataset.n = bars.length;
    $('bars').innerHTML = bars.map((b, j) => `<div class="bar-cell ${j % 4 < 2 ? 'call' : 'resp'}" data-j="${j}"><span class="bar-chord">${esc(chordName(b))}</span><span class="bar-role">${j % 4 < 2 ? 'Listen' : 'You'}</span></div>`).join('');
  }

  function refreshIdle() {
    const bars = LG.PROGRESSIONS[settings.prog].bars;
    renderBars(bars);
    $('jamKicker').textContent = `Call & response · ${LG.PROGRESSIONS[settings.prog].name} in ${pcName(keyPc())}`;
    $('boardTitle').textContent = `${pcName(keyPc())} minor pentatonic, box 1 (root on fret ${LG.rootFret(keyPc())})`;
    if (!run) {
      $('chordNow').textContent = chordName(bars[0]);
      $('chordNext').textContent = '';
      drawBoard(null);
    }
  }

  // ---------- the session ----------
  let run = null; // { bars, keyPc, slots, recent, cur, shown, ... } while the band plays
  let forceNew = false;
  let bleedWarned = false;
  const session = { answers: [], streak: 0, best: 0 };

  function makeSlot(s, t0) {
    const ctx = LG.slotContext(run.bars, s);
    const level = Number(settings.level);
    let phrase = null;
    const cur = run.cur;
    if (settings.mode === 'repeat' && cur && !forceNew && !cur.passed && cur.attempts < 3 && cur.level === level) {
      phrase = gen.retarget(cur.base, ctx);
    }
    if (!phrase) {
      phrase = gen.pick({ level, ctx, avoid: new Set(run.recent.slice(-12)) });
      const base = gen.byId.get(phrase.retargetedFrom || phrase.id);
      run.cur = { base, attempts: 0, passed: false, level, lastResults: null };
      run.recent.push(base.id);
    }
    forceNew = false;
    const attempt = run.cur.attempts + 1;
    const notes = LG.inKey(phrase, run.keyPc);
    const barDur = band.barDur;
    return {
      index: s, phrase, notes, ctx, attempt,
      prevResults: attempt > 1 ? run.cur.lastResults : null,
      hidden: settings.ear && attempt === 1,
      callStart: t0, respStart: t0 + 2 * barDur, respEnd: t0 + 4 * barDur,
      events: [], frames: [], callHeard: [], graded: null, live: [],
    };
  }

  // The band asks for bar i, LOOKAHEAD before it starts.
  function getBar(i, t0) {
    const s = Math.floor(i / 4);
    const pos = i % 4;
    if (pos === 0) {
      const prev = run.slots.get(s - 1);
      if (prev && !prev.graded) gradeSlot(prev);
      run.slots.set(s, makeSlot(s, t0));
      run.slots.delete(s - 3);
      return { lead: run.slots.get(s).notes.filter((n) => n.t < LG.BAR), drop: false };
    }
    const slot = run.slots.get(s);
    if (pos === 1) return { lead: slot ? slot.notes.filter((n) => n.t >= LG.BAR).map((n) => ({ ...n, t: n.t - LG.BAR })) : null, drop: false };
    return { lead: null, drop: settings.turn === 'drums' };
  }

  // The slot whose answer window covers time t (mic time, which runs behind by the latency).
  function slotAnswering(t) {
    if (!run) return null;
    const lat = latency();
    for (const slot of run.slots.values()) {
      if (!slot.graded && t >= slot.respStart - 0.15 + lat && t <= slot.respEnd + lat) return slot;
    }
    return null;
  }
  function slotCalling(t) {
    if (!run) return null;
    const lat = latency();
    for (const slot of run.slots.values()) if (t >= slot.callStart + 0.15 + lat && t < slot.respStart + lat - 0.1) return slot;
    return null;
  }

  engine.on('frame', (info) => {
    const slot = slotAnswering(info.t);
    if (slot) slot.frames.push({ t: info.t, midi: info.midi });
  });
  engine.on('note', (ev) => {
    const t = ev.playedAt;
    const slot = slotAnswering(t);
    if (slot) slot.events.push({ t, midi: ev.midi });
    const calling = slotCalling(t);
    if (calling) calling.callHeard.push(ev.midi);
  });

  async function pickOnScreen(s, f) {
    await ensureAudio();
    const midi = T.TUNINGS.standard.open[s] + f;
    band.pluck(midi);
    board.flash({ s, f, kind: 'wrong', label: pcName(midi) }, 700);
    // You click in time with what you hear, which is the output latency behind the clock; the
    // grader takes the mic's latency off, so add it here to match.
    const ctx = engine.ctx;
    const t = ctx.currentTime - (ctx.outputLatency || ctx.baseLatency || 0) + latency();
    const slot = slotAnswering(t);
    if (slot) slot.events.push({ t, midi });
  }

  function heardFor(slot) {
    const lat = latency();
    return LG.collectHeard(slot.events, slot.frames).map((h) => ({ midi: h.midi, t: h.t - slot.respStart - lat }));
  }

  function gradeSlot(slot) {
    const exp = LG.expectedFor(slot.notes, band.secPerTick);
    const heard = heardFor(slot);
    const g = LG.grade(exp, heard, { octave: settings.strictOctave });
    slot.graded = g;
    const answered = heard.length > 0;
    const bleed = slot.callHeard.filter((m) => slot.notes.some((n) => n.midi === m || n.fretMidi === m)).length;
    if (bleed >= 2 && !bleedWarned) {
      bleedWarned = true;
      const kind = mic.inputKind();
      $('turnHelp').classList.add('warn');
      $('turnHelp').textContent = kind === 'katana' || kind === 'interface'
        ? 'The input picked up the band playing the lick: your interface is probably sending its playback back (loopback). Turn Loopback off, or pick Drums only.'
        : 'The mic heard the band playing the lick, so it will hear the band on your turn too. Wear headphones, or pick Drums only.';
    }
    if (!answered) {
      slot.unanswered = true;
      feedback('hint', 'No answer heard', engine.micOn ? 'Play it back in the two bars after the band. If the mic doesn’t react, raise Sensitivity.' : 'Turn the microphone on, or click the fretboard to answer.');
      return;
    }
    if (run && run.cur && gen.byId.get(slot.phrase.retargetedFrom || slot.phrase.id) === run.cur.base) {
      run.cur.attempts++;
      run.cur.lastResults = g.results.map((r) => r.status);
      if (g.pass) run.cur.passed = true;
    }
    record(slot, g);
  }

  function timingWords(offset) {
    if (offset == null) return '';
    if (Math.abs(offset) < 0.1) return 'right on time';
    if (offset > 0) return offset < 0.25 ? 'a little late' : 'late';
    return offset > -0.25 ? 'a little early' : 'early';
  }

  function record(slot, g) {
    const entry = {
      name: slot.phrase.name, score: g.score, pass: g.pass, hits: g.hits, required: g.required,
      chord: chordOfRoot(slot.ctx.resp[1]), attempt: slot.attempt, timing: timingWords(g.offset),
      dots: g.results.map((r) => r.status), level: slot.phrase.level,
      alts: g.results.filter((r) => r.status === 'alt').length, offset: g.offset,
    };
    session.answers.push(entry);
    session.streak = g.pass ? session.streak + 1 : 0;
    session.best = Math.max(session.best, session.streak);

    const firstMiss = g.results.findIndex((r) => r.status === 'miss');
    let tip = '';
    if (firstMiss >= 0) {
      const n = slot.notes[firstMiss];
      tip = ` First miss: note ${firstMiss + 1}, ${pcName(n.midi)} (${STRING_NAME[n.s]} string, fret ${n.fret}${n.bend ? ', bent' : ''}).`;
    } else if (entry.alts) tip = ' Bend a little higher: the mic heard the note before the bend.';
    const timing = entry.timing ? `, ${entry.timing}` : '';
    const next = settings.mode === 'repeat' ? (g.pass ? ' New lick next.' : slot.attempt >= 3 ? ' Moving on to a new one.' : ' Same lick again.') : '';
    if (g.pass) feedback('ok', g.score === 1 ? 'Nailed it' : 'Got it', `${g.hits}/${g.required} notes${timing}.${tip}${next}`);
    else if (g.score >= 0.5) feedback('warn', 'Close', `${g.hits}/${g.required} notes${timing}.${tip}${next}`);
    else feedback('bad', 'Not yet', `${g.hits}/${g.required} notes.${tip}${next}`);
    renderSession();
  }

  function feedback(kind, tag, text) {
    const fb = $('feedback');
    fb.className = `feedback ${kind || ''}`;
    fb.innerHTML = tag ? `<span class="tag">${esc(tag)}</span><span>${esc(text || '')}</span>` : esc(text || '');
  }

  function renderSession() {
    const a = session.answers;
    if (!a.length) { $('sessionTitle').textContent = 'No answers yet'; $('tiles').innerHTML = ''; $('history').innerHTML = ''; $('insights').innerHTML = ''; return; }
    const nailed = a.filter((x) => x.pass).length;
    const acc = a.reduce((s, x) => s + x.score, 0) / a.length;
    $('sessionTitle').textContent = `${nailed} of ${a.length} licks nailed`;
    const tile = (label, value, cls = '') => `<div class="tile ${cls}"><span class="tile-label">${label}</span><span class="tile-value">${value}</span></div>`;
    $('tiles').innerHTML = [
      tile('Answered', a.length),
      tile('Nailed', nailed, nailed / a.length >= 0.7 ? 'good' : ''),
      tile('Notes right', `${Math.round(acc * 100)}<small>%</small>`, acc >= 0.8 ? 'good' : acc >= 0.5 ? 'meh' : 'bad'),
      tile('Streak', session.streak),
      tile('Best streak', session.best),
    ].join('');
    const dot = (st) => `<i class="hd ${st}"></i>`;
    $('history').innerHTML = a.slice(-10).reverse().map((x) => `
      <li class="${x.pass ? 'pass' : 'fail'}">
        <span class="h-score">${x.hits}/${x.required}</span>
        <span class="h-name">${esc(x.name)}</span>
        <span class="h-dots">${x.dots.map(dot).join('')}</span>
        <span class="h-meta">L${x.level} · over ${esc(x.chord)}${x.attempt > 1 ? ` · try ${x.attempt}` : ''}${x.timing ? ` · ${esc(x.timing)}` : ''}</span>
      </li>`).join('');
    const tips = [];
    const lv = Number(settings.level);
    const recent = a.filter((x) => x.level <= lv).slice(-6);
    if (recent.length >= 6 && recent.every((x) => x.score >= 0.85)) {
      tips.push(['star', lv < 3 ? `Six clean answers in a row: try level ${lv + 1}, or push the tempo up 8 bpm.` : 'Six clean answers in a row at level 3: push the tempo up, or switch keys.']);
    }
    const late = a.slice(-6).filter((x) => x.offset != null && x.offset > 0.2).length;
    if (late >= 3) tips.push(['warn', 'You’re coming in late. Count “1 & 2 &” with the band, and start your answer right on the downbeat of your turn.']);
    const alts = a.slice(-6).reduce((s, x) => s + x.alts, 0);
    if (alts >= 2) tips.push(['warn', 'Your bends are falling short. Push until the note matches the target (play the target fret first to hear it).']);
    if (bleedWarned) tips.push(['warn', mic.inputKind() === 'mic' ? 'The mic can hear the band. Headphones fix it; Drums only on your turn helps.' : 'The band is leaking into your interface’s input. Turn its Loopback off.']);
    $('insights').innerHTML = tips.map(([cls, t]) => `<li class="${cls}">${esc(t)}</li>`).join('');
  }

  // ---------- what's on screen ----------
  function describeLanding(slot) {
    const notes = slot.notes;
    const last = notes[notes.length - 1];
    const bar = last.t < LG.BAR ? 0 : 1;
    const callRoot = slot.ctx.call[bar];
    const respRoot = slot.ctx.resp[bar];
    const iv = (root) => INTERVAL[mod12(last.degree - root)] || LG.describeDegree(mod12(last.degree - root));
    let text = `Lands on <b>${esc(pcName(last.midi))}</b>: the ${iv(callRoot)} of ${esc(chordOfRoot(callRoot))}`;
    if (respRoot !== callRoot) text += `, and the ${iv(respRoot)} of ${esc(chordOfRoot(respRoot))} when you answer`;
    text += '.';
    if (last.changed) text += ' <span class="changed-note">New ending for these chords.</span>';
    return text;
  }

  function showSlot(slot) {
    run.shown = slot;
    tab.render(slot.notes, { hidden: slot.hidden });
    slot.notes.forEach((n, i) => {
      if (n.changed) tab.mark(i, 'changed');
      if (slot.prevResults && !slot.hidden) {
        const st = slot.prevResults[i];
        if (st === 'hit' || st === 'alt') tab.mark(i, 'was-hit');
        if (st === 'miss') tab.mark(i, 'was-miss');
      }
    });
    const tries = settings.mode === 'repeat' ? ` · try ${slot.attempt} of 3` : '';
    const name = slot.hidden ? 'Ear training: listen, then play it back' : esc(slot.phrase.name);
    $('lickInfo').innerHTML = `<span class="lick-name">${name}</span><span class="lick-level">Level ${slot.phrase.level}${tries}</span>${slot.hidden ? '' : `<span class="lick-landing">${describeLanding(slot)}</span>`}`;
    slot.boardKey = null;
  }

  // Index of the note sounding at `tick`, or -1.
  function noteAt(notes, tick) {
    let k = -1;
    for (let i = 0; i < notes.length; i++) if (notes[i].t <= tick) k = i;
    if (k >= 0 && tick > notes[k].t + notes[k].d + 2) return -1;
    return k;
  }

  let lastLive = 0;
  function frame() {
    if (!run) return;
    const ctx = engine.ctx;
    const now = ctx.currentTime - (ctx.outputLatency || ctx.baseLatency || 0);
    const p = band.position(now);
    const card = $('jamCard');
    const beats = $('beats').children;
    if (p) for (let b = 0; b < 4; b++) beats[b].classList.toggle('on', p.bar >= -1 && b === p.beat && now >= band.t0);
    if (!p || p.bar < 0) {
      card.dataset.phase = 'countin';
      $('phase').textContent = p && now >= band.t0 ? `Count-in ${p.beat + 1}` : 'Count-in';
      requestAnimationFrame(frame);
      return;
    }
    const n = run.bars.length;
    const s = Math.floor(p.bar / 4);
    const pos = p.bar % 4;
    const slot = run.slots.get(s);
    const listening = pos < 2;
    card.dataset.phase = listening ? 'listen' : 'answer';
    $('phase').textContent = listening ? 'Listen' : 'Your turn';
    $('chordNow').textContent = chordName(run.bars[p.bar % n]);
    $('chordNext').textContent = p.beat === 3 ? `→ ${chordName(run.bars[(p.bar + 1) % n])}` : '';
    document.querySelectorAll('.bar-cell').forEach((c) => c.classList.toggle('active', Number(c.dataset.j) === p.bar % n));
    if (slot) {
      if (run.shown !== slot) showSlot(slot);
      const tick = (listening ? pos : pos - 2) * LG.BAR + p.tick;
      tab.setPlayhead(tick, listening ? 'call' : 'resp');
      let states = [];
      if (listening) {
        const k = noteAt(slot.notes, tick);
        states = slot.notes.map((_, i) => (i === k ? 'now' : null));
      } else if (slot.graded) {
        states = slot.graded.results.map((r) => r.status);
      } else {
        // Light up notes as you play them.
        if (performance.now() - lastLive > 120) {
          lastLive = performance.now();
          const g = LG.grade(LG.expectedFor(slot.notes, band.secPerTick), heardFor(slot), { octave: settings.strictOctave });
          slot.live = g.results.map((r) => (r.status === 'hit' || r.status === 'alt' ? r.status : null));
        }
        states = slot.live;
      }
      const key = states.join(',');
      if (key !== slot.boardKey) {
        slot.boardKey = key;
        states.forEach((st, i) => tab.setState(i, st));
        drawBoard(slot, states);
      }
    }
    requestAnimationFrame(frame);
  }

  // ---------- start / stop ----------
  async function start() {
    if (run) return;
    await ensureAudio();
    const bars = LG.PROGRESSIONS[settings.prog].bars;
    run = { bars, keyPc: keyPc(), slots: new Map(), recent: [], cur: null, shown: null };
    renderBars(bars);
    configureBoard();
    tab.render([], { empty: 'The first lick comes after the count-in' });
    $('lickInfo').textContent = 'Listen for two bars, then play it back for two bars.';
    feedback('', '', '');
    band.start({ bpm: settings.bpm, keyPc: run.keyPc, bars, getBar, countIn: 1 });
    $('startBtn').innerHTML = 'Stop <kbd>Space</kbd>';
    $('newBtn').hidden = false;
    requestAnimationFrame(frame);
  }

  function stop() {
    if (!run) return;
    band.stop();
    run = null;
    $('jamCard').dataset.phase = 'idle';
    $('phase').textContent = 'Stopped';
    $('startBtn').innerHTML = 'Start the band <kbd>Space</kbd>';
    $('newBtn').hidden = true;
    for (const b of $('beats').children) b.classList.remove('on');
    document.querySelectorAll('.bar-cell').forEach((c) => c.classList.remove('active'));
    tab.setPlayhead(null);
  }

  async function restartIfRunning() {
    if (!run) return;
    stop();
    await start();
  }

  function newLick() {
    forceNew = true;
    feedback('hint', 'New lick', 'coming up on the next call.');
  }

  $('startBtn').addEventListener('click', (e) => { e.currentTarget.blur(); run ? stop() : start(); });
  $('newBtn').addEventListener('click', (e) => { e.currentTarget.blur(); newLick(); });
  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input, select, textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.code === 'Space') { e.preventDefault(); run ? stop() : start(); }
    else if (e.key === 'Escape') stop();
    else if (e.key === 'n' || e.key === 'N') { if (run) newLick(); }
  });

  configureBoard();
  refreshIdle();
  renderSession();
  tab.render([], { empty: 'Press Start: the band counts you in' });
})();
