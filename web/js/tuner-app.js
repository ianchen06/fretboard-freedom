// The Tuner page: a big gauge, a strobe, which way to turn the peg, and a ✓ for each string in tune.
// The pitch comes from the precise tuner (AudioEngine 'tune' readings → Pitch.TunerFilter); what it
// means for the string you're tuning comes from TuneGuide (js/tuneguide.js).
(function () {
  'use strict';
  const T = window.Theory;
  const { TunerFilter, PluckGate } = window.Pitch;
  const { TuneGuide, gaugeAngle } = window.TuneGuideLib;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode etc. */ }
    },
  };

  const TOLS = [3, 1, 0.3];
  const saved = { tol: 1, noise: true, ...store.get('ff.tuner', {}) };
  if (!TOLS.includes(saved.tol)) saved.tol = 1;
  let tuningId = store.get('ff.settings', {}).tuning || 'standard';
  if (!T.TUNINGS[tuningId]) tuningId = 'standard';
  const tuning = () => T.TUNINGS[tuningId];
  const ORD = ['', '1st', '2nd', '3rd', '4th', '5th', '6th'];
  const noteOf = (midi) => T.noteName(midi, tuning().flat);
  const octOf = (midi) => Math.floor(midi / 12) - 1;
  const strName = (s) => `${T.stringLongName(s, tuning())} string`;

  const engine = new window.AudioEngine();
  const panel = window.MicPanel.setup(engine, {
    store,
    preferFlat: () => tuning().flat,
    tuning,
    onInputChange: (kind) => {
      engine.setPrecise(!!kind);
      syncStart();
      if (kind) {
        gate.reset();
        $('micNote').textContent = kind === 'mic'
          ? 'Hold the guitar close to the mic, in a quiet room. Pluck one string at a time.'
          : 'Listening to your interface. Pluck one string at a time.';
        keepAwake(true);
        render(null);
      } else {
        keepAwake(false);
        lost();
      }
    },
  });

  const filter = new TunerFilter({ a4: panel.a4() });
  // The noise filter: only a plucked string reaches the gauge (hum, fans and voices don't). See Pitch.PluckGate.
  const gate = new PluckGate();
  // A quiet guitar gives fewer, noisier readings: steady them over a longer stretch.
  const syncSound = () => {
    seg('tnSoundSeg', panel.quiet() ? 'quiet' : 'normal');
    filter.window = panel.quiet() ? window.Pitch.QUIET.tunerWindow : 0.3;
    filter.reset();
    gate.reset(); // the note tracker starts afresh too
    guide.holdTime = panel.quiet() ? window.Pitch.QUIET.holdTime : 0.6;
  };
  const guide = new TuneGuide({ open: tuning().open, a4: panel.a4(), tolerance: saved.tol });

  // ---------- the gauge ----------
  const R = 128;
  const polar = (deg, r) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return [(r * Math.cos(a)).toFixed(2), (r * Math.sin(a)).toFixed(2)];
  };
  const arc = (d0, d1, r) => {
    const [x0, y0] = polar(d0, r);
    const [x1, y1] = polar(d1, r);
    return `M${x0} ${y0} A${r} ${r} 0 0 1 ${x1} ${y1}`;
  };
  function drawScale() {
    const tol = guide.tolerance;
    const z = Math.max(1.2, gaugeAngle(tol)); // keep a sliver visible at ±0.3¢
    let svg = `<path class="tn-track" d="${arc(-62, 62, R)}"/>`;
    svg += `<path class="tn-near" d="${arc(-30, 30, R)}"/>`;
    svg += `<path class="tn-zone" d="${arc(-z, z, R)}"/>`;
    for (const c of [-50, -40, -30, -20, -10, -5, -2, 0, 2, 5, 10, 20, 30, 40, 50]) {
      const a = gaugeAngle(c);
      const major = [0, -50, 50, -10, 10].includes(c);
      const [x0, y0] = polar(a, R - (c === 0 ? 22 : major ? 14 : 8));
      const [x1, y1] = polar(a, R + 4);
      svg += `<line class="tn-tick${c === 0 ? ' zero' : ''}" x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}"/>`;
      if (major) {
        const [lx, ly] = polar(a, R + 16);
        svg += `<text class="tn-lbl" x="${lx}" y="${ly}">${c > 0 ? `+${c}` : c}</text>`;
      }
    }
    const [fx, fy] = polar(-48, R - 34);
    const [sx, sy] = polar(48, R - 34);
    svg += `<text class="tn-side" x="${fx}" y="${fy}">flat</text><text class="tn-side" x="${sx}" y="${sy}">sharp</text>`;
    $('tnScale').innerHTML = svg;
  }

  // ---------- strings ----------
  function drawStrings() {
    const tn = tuning();
    $('tnStrings').innerHTML = [6, 5, 4, 3, 2, 1].map((s) => `<button type="button" class="tn-str" data-s="${s}" aria-pressed="false">
      <span class="tn-str-note">${esc(noteOf(tn.open[s]))}<small>${octOf(tn.open[s])}</small></span>
      <span class="tn-str-num">${ORD[s]}</span><span class="tn-str-tick" aria-hidden="true">✓</span></button>`).join('');
    syncStrings();
  }
  function syncStrings(active = guide.current) {
    for (const b of $('tnStrings').querySelectorAll('.tn-str')) {
      const s = Number(b.dataset.s);
      const pinned = guide.mode !== 'auto' && guide.pinned === s;
      b.classList.toggle('done', guide.done.has(s));
      b.classList.toggle('current', s === active || pinned);
      b.setAttribute('aria-pressed', String(pinned));
      b.setAttribute('aria-label', `${strName(s)}${guide.done.has(s) ? ', in tune' : ''}`);
    }
  }
  $('tnStrings').addEventListener('click', (e) => {
    const b = e.target.closest('.tn-str');
    if (!b) return;
    const s = Number(b.dataset.s);
    pick(guide.mode === 'pin' && guide.pinned === s ? null : s);
    b.blur();
  });

  function pick(s) {
    guide.pin(s);
    filter.reset();
    syncMode();
    render(null);
    start();
  }

  // ---------- modes & options ----------
  function seg(id, value) {
    $(id).querySelectorAll('button').forEach((b) => {
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(b.dataset.value === String(value)));
    });
  }
  const syncMode = () => { seg('tnModeSeg', guide.mode); syncStrings(); };
  $('tnModeSeg').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    b.blur();
    const m = b.dataset.value;
    if (m === 'auto') pick(null);
    else if (m === 'pin') pick(guide.current || guide.nextUndone() || 6);
    else startGuide();
  });
  function startGuide() {
    guide.guide();
    filter.reset();
    syncMode();
    pauseFor(0, null);
    render(null);
    start();
  }
  $('tnGuide').addEventListener('click', (e) => { e.currentTarget.blur(); startGuide(); });

  syncSound();
  window.addEventListener('ff:quiet', syncSound);
  $('tnSoundSeg').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    b.blur();
    panel.setQuiet(b.dataset.value === 'quiet');
  });

  seg('tnNoiseSeg', saved.noise ? 'on' : 'off');
  $('tnNoiseSeg').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    b.blur();
    saved.noise = b.dataset.value === 'on';
    store.set('ff.tuner', saved);
    seg('tnNoiseSeg', saved.noise ? 'on' : 'off');
    gate.reset();
    filter.reset();
  });

  seg('tnTolSeg', saved.tol);
  $('tnTolSeg').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    b.blur();
    saved.tol = Number(b.dataset.value);
    store.set('ff.tuner', saved);
    guide.setTolerance(saved.tol);
    seg('tnTolSeg', saved.tol);
    drawScale();
  });

  // Tuning: shared with the practice pages (ff.settings.tuning).
  $('tnTuning').innerHTML = Object.values(T.TUNINGS).map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join('');
  $('tnTuning').value = tuningId;
  $('tnTuning').addEventListener('change', (e) => {
    tuningId = e.target.value;
    store.set('ff.settings', { ...store.get('ff.settings', {}), tuning: tuningId });
    const mode = guide.mode;
    guide.setTuning(tuning().open);
    if (mode === 'guide') guide.guide();
    filter.reset();
    drawStrings();
    render(null);
  });

  // Reference pitch: the same A4 the practice pages use for note detection.
  function setA4(v) {
    const a4 = panel.setA4(v);
    $('tnA4').textContent = a4;
    guide.setA4(a4);
    filter.a4 = a4;
    filter.reset();
  }
  $('tnA4').textContent = panel.a4();
  $('tnA4Down').addEventListener('click', () => setA4(panel.a4() - 1));
  $('tnA4Up').addEventListener('click', () => setA4(panel.a4() + 1));

  // ---------- start / stop ----------
  async function start() {
    if (engine.micOn) return;
    await panel.enable();
  }
  function syncStart() {
    $('tnStart').textContent = engine.micOn ? 'Stop' : 'Start tuning';
    $('tnStart').classList.toggle('btn-start', !engine.micOn);
    $('tnStart').classList.toggle('btn-ghost', engine.micOn);
    $('tnCard').dataset.state = engine.micOn ? 'on' : 'idle';
  }
  $('tnStart').addEventListener('click', (e) => {
    e.currentTarget.blur();
    if (engine.micOn) panel.disable(); else start();
  });
  syncStart();

  // Keep a phone's screen on while tuning.
  let wake = null;
  async function keepAwake(on) {
    try {
      if (on && !wake && navigator.wakeLock) {
        wake = await navigator.wakeLock.request('screen');
        wake.addEventListener('release', () => { wake = null; });
      } else if (!on && wake) { await wake.release(); wake = null; }
    } catch { /* not allowed (battery saver, iframe): fine */ }
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && engine.micOn) keepAwake(true); });

  // ---------- reference tone ----------
  // A clean, exactly-pitched tone (oscillators, not the plucked synth, whose pitch is rounded to
  // whole samples). The tuner ignores the input while it plays, so it can't tune itself to it.
  let refWave = null;
  async function playRef() {
    const s = guide.current || guide.pinned || guide.nextUndone() || 6;
    if (guide.mode === 'auto' && guide.current == null) guide.current = s;
    await engine.init();
    const ctx = engine.ctx;
    if (!refWave) refWave = ctx.createPeriodicWave(new Float32Array([0, 0, 0, 0, 0, 0]), new Float32Array([0, 1, 0.45, 0.25, 0.12, 0.06]));
    const f = guide.targetFreq(s);
    const t0 = ctx.currentTime + 0.02;
    const dur = 2.2;
    const osc = ctx.createOscillator();
    osc.setPeriodicWave(refWave);
    osc.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.35, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g).connect(engine.out);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
    pauseFor(dur * 1000 + 250, `Listen: ${strName(s)}, ${noteOf(tuning().open[s])}${octOf(tuning().open[s])} (${f.toFixed(2)} Hz). Then pluck yours.`);
    syncStrings(s);
    showTarget(s, null);
  }
  $('tnRef').addEventListener('click', (e) => { e.currentTarget.blur(); playRef(); });

  // ---------- readings ----------
  let pausedUntil = 0;
  let lastReading = 0;
  let reading = null; // { cents, ok } for the strobe
  function pauseFor(ms, text) {
    pausedUntil = performance.now() + ms;
    filter.reset();
    guide.silence();
    if (text) say('info', text);
  }

  engine.on('tune', (reading) => {
    if (performance.now() < pausedUntil) return;
    let r = null;
    for (const q of saved.noise ? gate.push(reading) : [reading]) r = filter.push(q.freq, q.t, q.attackT, q.db) || r;
    if (!r) return;
    const { t } = reading;
    // Guide mode: the string you just tuned may still be ringing. Say so instead of reading it
    // against the next string.
    if (guide.mode === 'guide' && guide.pinned != null) {
      const near = guide.nearestString(r.freq);
      if (near !== guide.pinned && guide.done.has(near) && Math.abs(1200 * Math.log2(r.freq / guide.targetFreq(near))) < 30) {
        lastReading = performance.now();
        say('info', `That’s the ${strName(near)}, already in tune. Now pluck the <b>${esc(strName(guide.pinned))}</b>.`);
        return;
      }
    }
    const g = guide.push({ freq: r.freq, spread: r.spread, t });
    lastReading = performance.now();
    render(g, r.freq);
  });

  engine.on('frame', (info) => {
    gate.frame(info);
    if (!engine.micOn) return;
    if (lastReading && performance.now() - lastReading > 450) lost();
  });

  function lost() {
    if (!lastReading) return;
    lastReading = 0;
    reading = null;
    filter.reset();
    guide.silence();
    $('tnNeedle').classList.remove('live', 'good', 'close', 'off');
    $('tnCents').textContent = ' ';
    $('tnHold').style.width = '0%';
    if (performance.now() >= pausedUntil) render(null);
  }

  function showTarget(s, freq) {
    if (s == null) {
      $('tnNote').innerHTML = '–';
      $('tnString').textContent = guide.mode === 'auto' ? 'Pluck any open string' : '';
      $('tnFreq').innerHTML = '&nbsp;';
      return;
    }
    const m = tuning().open[s];
    $('tnNote').innerHTML = `${esc(noteOf(m))}<small>${octOf(m)}</small>`;
    $('tnString').textContent = `${strName(s)} · ${ORD[s]}`;
    $('tnFreq').textContent = `Target ${guide.targetFreq(s).toFixed(2)} Hz${freq ? ` · yours ${freq.toFixed(2)} Hz` : ''}`;
  }

  function say(kind, html) {
    $('tnSay').dataset.kind = kind;
    $('tnSayIcon').textContent = { up: '↑', down: '↓', ok: '✓', far: '!', info: '' }[kind] || '';
    $('tnSayText').innerHTML = html;
  }

  let flashUntil = 0;
  function render(g, freq) {
    const now = performance.now();
    if (!g || g.string == null) {
      reading = null;
      showTarget(guide.mode === 'auto' ? null : guide.pinned, null);
      syncStrings();
      if (now < flashUntil) return;
      if (!engine.micOn) say('info', 'Press <b>Start tuning</b>, then pluck a string.');
      else if (guide.allDone) say('ok', 'All strings in tune. Go round once more to be sure: <b>Guide me</b>.');
      else if (guide.mode === 'auto') {
        say('info', panel.inputKind() === 'mic' && !panel.quiet()
          ? 'Pluck any open string and let it ring. Electric, not plugged in? Choose <b>Unplugged electric</b> below.'
          : 'Pluck any open string and let it ring.');
      }
      else say('info', `Pluck the <b>${esc(strName(guide.pinned))}</b> and let it ring.`);
      return;
    }
    const { string: s, cents, semis, action, far, hold } = g;
    showTarget(s, freq);
    syncStrings(s);
    const tol = guide.tolerance;
    const ac = Math.abs(cents);
    const needle = $('tnNeedle');
    needle.style.transform = `rotate(${gaugeAngle(cents).toFixed(2)}deg)`;
    needle.classList.add('live');
    needle.classList.toggle('good', ac <= tol);
    needle.classList.toggle('close', ac > tol && ac <= 10);
    needle.classList.toggle('off', ac > 10);
    const dp = tol < 1 ? 2 : 1;
    $('tnCents').textContent = far ? `${semis > 0 ? '+' : '−'}${Math.abs(semis).toFixed(1)} semitones`
      : `${cents > 0.004 ? '+' : cents < -0.004 ? '−' : ''}${ac.toFixed(dp)}¢`;
    $('tnCents').dataset.state = ac <= tol ? 'good' : ac <= 10 ? 'close' : 'off';
    $('tnHold').style.width = `${Math.round(hold * 100)}%`;
    reading = { cents, ok: ac <= tol && hold > 0 };

    if (g.justTuned) {
      const next = guide.mode === 'guide' ? guide.pinned : null;
      flashUntil = now + 1400;
      if (g.finished) {
        say('ok', `<b>All ${Object.keys(tuning().open).length} strings in tune.</b> Tuning one pulls on the others, so go round once more: <b>Guide me</b>.`);
      } else if (next) {
        say('ok', `<b>${esc(strName(s))} in tune.</b> Next: the ${esc(strName(next))}.`);
        pauseFor(1400, null);
      } else {
        say('ok', `<b>${esc(strName(s))} in tune.</b>`);
      }
      syncStrings(next || s);
      return;
    }
    if (now < flashUntil) return;
    if (action === 'ok') {
      say('ok', guide.done.has(s) ? `<b>In tune.</b> ${guide.allDone ? '' : 'Pluck the next string.'}` : 'Right there. Keep it ringing…');
    } else if (far) {
      const n = Math.round(Math.abs(semis));
      const steps = `${n} semitone${n === 1 ? '' : 's'}`;
      if (action === 'up') say('far', `About ${steps} low: <b>tighten</b>, a bit at a time.`);
      else say('far', `About ${steps} high: <b>loosen</b> it. A string tuned too high can snap.`);
    } else if (action === 'up') {
      say('up', ac > 10 ? '<b>Tighten</b> to tune up.' : '<b>Tighten</b> a touch: nearly there.');
    } else {
      say('down', ac > 10 ? '<b>Loosen</b> a little past the note, then tighten back up to it.' : '<b>A touch sharp.</b> Loosen slightly below, then come up to it.');
    }
  }

  // ---------- the strobe ----------
  // Stripes drift right when sharp and left when flat, faster the further off, and stand still in tune.
  let strobeX = 0;
  let lastSpin = 0;
  function spin(now) {
    const dt = lastSpin ? Math.min(0.1, (now - lastSpin) / 1000) : 0;
    lastSpin = now;
    const strobe = $('tnStrobe');
    if (reading) {
      strobeX += Math.max(-50, Math.min(50, reading.cents)) * 8 * dt;
      strobe.style.backgroundPositionX = `${strobeX.toFixed(2)}px`;
    }
    strobe.classList.toggle('live', !!reading);
    strobe.classList.toggle('good', !!reading && reading.ok);
    requestAnimationFrame(spin);
  }
  requestAnimationFrame(spin);

  // ---------- keys ----------
  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.target.closest('input, select, textarea')) return;
    const k = e.key.toLowerCase();
    if (/^[1-6]$/.test(k)) pick(Number(k));
    else if (k === 'a') pick(null);
    else if (k === 'g') startGuide();
    else if (k === 'r') playRef();
    else return;
    e.preventDefault();
  });

  drawScale();
  drawStrings();
  syncMode();
  render(null);
})();
