// Song writing page: UI wiring. Songs live in this browser (localStorage); the theory is in
// songtheory.js, the Mandarin side in zh.js, the band in songband.js.
(function () {
  'use strict';
  const ST = window.SongTheory;
  const Zh = window.Zh;
  const { TPB, BAR, LINE, LINE_BARS, S16 } = ST;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const mod12 = (n) => ((n % 12) + 12) % 12;

  // ---------- persistence (per browser; the page works without it) ----------
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode, full storage */ }
    },
  };
  const PREFS_DEFAULT = { voice: 'voice', toneWeight: '1', recBand: 'drums', take: '0', sec: 'V', rhyme: null, genMood: 'any', genAdv: '0.4', genColors: '1' };
  const prefs = { ...PREFS_DEFAULT, ...store.get('ff.write', {}) };
  const savePrefs = () => store.set('ff.write', prefs);

  const lib = store.get('ff.songs', null) || { current: null, songs: {} };
  const uid = () => Math.random().toString(36).slice(2, 10);
  let saveTimer = null;
  function save() {
    song.updated = Date.now();
    lib.songs[song.id] = song;
    lib.current = song.id;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { store.set('ff.songs', lib); renderSheet(); renderSongSelect(); }, 250);
  }

  // An original demo song, so there is something to hear and change on the first visit.
  function demoSong() {
    const s = ST.newSong('ballad', 7);
    s.id = uid();
    s.title = '老地方 (demo)';
    const words = {
      V: ['路灯一盏一盏 亮起来', '我在老地方 等你回来', '风吹过空荡荡的站台', '说好的明天 还在不在'],
      P: ['如果时间 可以倒带', '我会不会 勇敢一点说爱'],
      C: ['我把思念 唱成一首歌', '在你听不见的 角落', '每一句 都是我', '舍不得'],
    };
    for (const [sec, lines] of Object.entries(words)) {
      lines.forEach((w, i) => {
        const ln = s.sections[sec].lines[i];
        ln.lyrics[0] = w;
        const syl = Zh.syllables(w);
        const prev = i ? s.sections[sec].lines[i - 1].notes.slice(-1)[0] : null;
        ln.notes = ST.suggestMelody(syl, {
          bars: s.sections[sec].bars.slice(i * 2, i * 2 + 2), keyPc: s.key, role: ST.SECTION_TYPES[sec].role, style: s.style,
          prevMidi: prev ? prev.midi : null, lastLine: i === lines.length - 1, seed: 7 + i * 31 + sec.charCodeAt(0),
        });
      });
    }
    return s;
  }

  let song = lib.songs[lib.current];
  if (!song) {
    const ids = Object.keys(lib.songs);
    song = ids.length ? lib.songs[ids[0]] : demoSong();
    lib.songs[song.id] = song;
    lib.current = song.id;
    store.set('ff.songs', lib);
  }

  const ui = { sec: song.sections[prefs.sec] ? prefs.sec : 'V', take: Number(prefs.take) || 0, sel: null, lastInput: null, playing: null };
  const sec = () => song.sections[ui.sec];
  const type = () => ST.SECTION_TYPES[ui.sec];
  const keyPc = () => song.key;
  const flatKey = () => ST.FLAT_KEYS.includes(mod12(song.key));
  const formHasTake2 = (id) => song.form.includes(`${id}2`);

  // ---------- audio ----------
  const engine = new window.AudioEngine();
  let band = null;
  const outLatency = () => (engine.ctx ? engine.ctx.outputLatency || engine.ctx.baseLatency || 0 : 0);
  const latency = () => outLatency() + 0.03;
  async function ensureAudio() {
    await engine.init();
    if (band) return;
    band = new window.SongBand(engine.ctx);
    band.init();
    band.setMix({ band: 1, lead: 1.1 });
    band.setDrive(1.2);
  }
  const mic = window.MicPanel.setup(engine, { store, preferFlat: flatKey, onInputChange: () => {} });

  // ---------- lyrics ----------
  // Syllables of a line for one take, with the reading fixes that still match their characters.
  function analyze(ln, take = ui.take) {
    const text = ln.lyrics[take] || '';
    const plain = Zh.syllables(text);
    const stored = (ln.fix && ln.fix[take]) || {};
    const fix = {};
    for (const [k, v] of Object.entries(stored)) {
      const [ch, py] = v.split(':');
      if (plain[k] && plain[k].ch === ch) fix[k] = py;
    }
    return Object.keys(fix).length ? Zh.syllables(text, fix) : plain;
  }
  const TONE_CLASS = { 1: 't1', 2: 't2', 3: 't3', 4: 't4', 5: 't5', 0: 't0' };

  // ---------- small UI helpers ----------
  function toast(msg, ms = 2600) {
    const t = $('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { t.hidden = true; }, ms);
  }
  function bindSeg(name, get, set) {
    const seg = document.querySelector(`.seg[data-name="${name}"]`);
    const sync = () => seg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.value === String(get()))));
    seg.querySelectorAll('button').forEach((b) => b.setAttribute('role', 'radio'));
    seg.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      set(b.dataset.value);
      sync();
    });
    sync();
    return sync;
  }
  const secLabel = (f) => {
    const { sec: id, take } = ST.formEntry(f);
    const t = ST.SECTION_TYPES[id];
    return { zh: t.zh, name: `${t.name}${take ? ' 2' : ''}` };
  };

  // ---------- header: song, style, key, tempo ----------
  function renderSongSelect() {
    const sel = $('songSelect');
    const list = Object.values(lib.songs).sort((a, b) => b.updated - a.updated);
    sel.innerHTML = list.map((s) => `<option value="${s.id}"${s.id === song.id ? ' selected' : ''}>${esc(s.title || `Untitled · ${new Date(s.created).toLocaleDateString()}`)}</option>`).join('');
  }
  $('songSelect').addEventListener('change', (e) => { stop(); song = lib.songs[e.target.value]; lib.current = song.id; store.set('ff.songs', lib); ui.sel = null; renderAll(); });
  $('newSong').addEventListener('click', () => {
    stop();
    const s = ST.newSong(song.style, song.key);
    s.id = uid();
    song = s;
    ui.sec = 'V';
    ui.take = 0;
    save();
    renderAll();
    $('title').focus();
  });
  $('delSong').addEventListener('click', () => {
    if (!confirm(`Delete “${song.title || 'Untitled'}”? This can’t be undone.`)) return;
    stop();
    delete lib.songs[song.id];
    const rest = Object.values(lib.songs).sort((a, b) => b.updated - a.updated);
    song = rest[0] || (() => { const s = ST.newSong('ballad', 0); s.id = uid(); return s; })();
    save();
    renderAll();
  });
  $('title').addEventListener('input', (e) => { song.title = e.target.value; save(); });

  const syncStyle = bindSeg('style', () => song.style, (v) => {
    if (v === song.style) return;
    stop();
    const fresh = ST.newSong(v, song.key);
    const untouched = Object.values(song.sections).every((s) => s.lines.every((l) => !l.lyrics[0] && !l.lyrics[1] && !l.notes.length));
    song.style = v;
    song.bpm = ST.STYLES[v].bpm;
    // A blank song takes the new style's chords too; one with words keeps its chords.
    if (untouched) for (const id of Object.keys(song.sections)) song.sections[id].bars = fresh.sections[id].bars;
    else toast(`Style: ${ST.STYLES[v].name}. Your chords stay; pick a progression for a part to change them.`);
    save();
    renderAll();
  });
  bindSeg('voice', () => prefs.voice, (v) => { prefs.voice = v; savePrefs(); if (band) band.setVoice(v); });
  bindSeg('toneWeight', () => prefs.toneWeight, (v) => { prefs.toneWeight = v; savePrefs(); });
  bindSeg('recBand', () => prefs.recBand, (v) => { prefs.recBand = v; savePrefs(); });
  bindSeg('genMood', () => prefs.genMood, (v) => { prefs.genMood = v; savePrefs(); });
  bindSeg('genAdv', () => prefs.genAdv, (v) => { prefs.genAdv = v; savePrefs(); });
  bindSeg('genColors', () => prefs.genColors, (v) => { prefs.genColors = v; savePrefs(); });
  const syncTake = bindSeg('take', () => ui.take, (v) => { ui.take = Number(v); prefs.take = v; savePrefs(); renderForm(); renderLines(); renderRhyme(); });

  const KEY_ORDER = [0, 7, 2, 9, 4, 11, 5, 10, 3, 8, 1, 6];
  $('keySelect').innerHTML = KEY_ORDER.map((pc) => `<option value="${pc}">1 = ${ST.keyName(pc)}</option>`).join('');
  $('keySelect').addEventListener('change', (e) => {
    stop();
    const old = song.key;
    song.key = Number(e.target.value);
    // Move every melody with the key, by the smallest step.
    let d = mod12(song.key - old);
    if (d > 6) d -= 12;
    for (const s of Object.values(song.sections)) for (const l of s.lines) for (const n of l.notes) n.midi += d;
    save();
    renderAll();
  });
  $('tempo').addEventListener('input', (e) => { song.bpm = Number(e.target.value); $('tempoVal').textContent = `${song.bpm} bpm`; if (ui.playing) stop(); save(); });

  // ---------- song form ----------
  function renderForm() {
    const chips = song.form.map((f, i) => {
      const { sec: id, take } = ST.formEntry(f);
      const l = secLabel(f);
      return `<span class="form-chip sec-${id}${id === ui.sec && take === ui.take ? ' active' : ''}" data-i="${i}"><button type="button" class="fc-main" data-i="${i}"><span class="fc-zh">${l.zh}</span> ${esc(l.name)}</button><button type="button" class="fc-x" data-x="${i}" aria-label="Remove ${esc(l.name)}">×</button></span>`;
    }).join('');
    const opts = Object.entries(ST.SECTION_TYPES).map(([id, t]) => `<option value="${id}">${t.zh} ${t.name}</option>`).join('')
      + Object.entries(ST.SECTION_TYPES).filter(([, t]) => t.lyrics).map(([id, t]) => `<option value="${id}2">${t.zh} ${t.name} 2 (2nd lyrics)</option>`).join('');
    $('formChips').innerHTML = `${chips}<select class="fc-add" id="formAdd" aria-label="Add a part"><option value="">+ Add a part</option>${opts}</select><button type="button" class="link-btn" id="formReset">Reset</button>`;
  }
  $('formChips').addEventListener('click', (e) => {
    const x = e.target.closest('[data-x]');
    if (x) {
      if (song.form.length <= 1) return;
      stop();
      song.form.splice(Number(x.dataset.x), 1);
      save();
      renderForm();
      return;
    }
    const m = e.target.closest('.fc-main');
    if (m) {
      const { sec: id, take } = ST.formEntry(song.form[Number(m.dataset.i)]);
      selectSection(id, take);
    }
    if (e.target.id === 'formReset') { stop(); song.form = ST.FORM.slice(); save(); renderForm(); }
  });
  $('formChips').addEventListener('change', (e) => {
    if (e.target.id !== 'formAdd' || !e.target.value) return;
    stop();
    song.form.push(e.target.value);
    save();
    renderForm();
    renderEditorHead();
  });
  function selectSection(id, take = 0) {
    ui.sec = id;
    ui.take = ST.SECTION_TYPES[id].lyrics ? take : 0;
    ui.sel = null;
    prefs.sec = id;
    prefs.take = String(ui.take);
    savePrefs();
    if (ui.playing && ui.playing.kind === 'section') stop();
    renderForm();
    renderEditor();
    renderRhyme();
  }

  // ---------- section editor ----------
  function renderEditorHead() {
    const t = type();
    $('secKicker').textContent = `${t.zh} · ${t.lyrics ? `${sec().lines.length} lines` : 'instrumental'}`;
    $('secTitle').textContent = t.name;
    $('takeSeg').hidden = !t.lyrics || !formHasTake2(ui.sec);
    if ($('takeSeg').hidden && ui.take) ui.take = 0;
    syncTake();
    const role = t.role;
    const good = ST.PROGRESSIONS.filter((p) => p.for.includes(role));
    const other = ST.PROGRESSIONS.filter((p) => !p.for.includes(role));
    const opt = (p) => `<option value="${p.id}">${p.zh} · ${esc(p.name)} (${p.bars.replace(/\s*\|\s*/g, ' ')})</option>`;
    $('progSelect').innerHTML = `<option value="">Use a progression…</option><optgroup label="Good for a ${esc(t.name.toLowerCase())}">${good.map(opt).join('')}</optgroup><optgroup label="Others">${other.map(opt).join('')}</optgroup>`;
    const now = ST.barsToString(sec().bars);
    const match = ST.PROGRESSIONS.find((p) => {
      const pb = ST.parseBars(p.bars);
      return sec().bars.length % pb.length === 0 && ST.barsToString(Array.from({ length: sec().bars.length }, (_, i) => pb[i % pb.length])) === now;
    });
    const genKey = `${ui.sec}|${now}`;
    if (genKey in genInfo) $('progDesc').innerHTML = `<b>🎲 New chords</b> from the habits of ${ChordGen.songCount()} Chinese pop songs. ${famText(genInfo[genKey])}`;
    else $('progDesc').innerHTML = match ? `<b>${match.zh} · ${esc(match.name)}.</b> ${esc(match.desc)}` : 'Your own progression. Pick one from the list to start from a classic, or ask for 🎲 new chords.';
    const h = genHist[ui.sec];
    $('genBack').disabled = !h || h.i <= 0;
    $('genFwd').disabled = !h || h.i >= h.list.length - 1;
  }
  $('progSelect').addEventListener('change', (e) => {
    const p = ST.progById(e.target.value);
    if (!p) return;
    const pb = ST.parseBars(p.bars);
    const n = Math.max(sec().bars.length, pb.length);
    sec().bars = Array.from({ length: n }, (_, i) => pb[i % pb.length].slice());
    pruneLocks();
    syncLinesToBars();
    save();
    renderEditor();
    if (ui.playing && ui.playing.kind === 'section') playSection();
  });

  // ---------- chord generator (js/chordgen.js) ----------
  const genHist = {}; // per part: { list: progressions as text, i: the one showing }
  const genInfo = {}; // 'part|progression' → where it comes from (ChordGen's familiar)
  function pruneLocks(s = sec()) { if (s.locks) s.locks = s.locks.filter((i) => i < s.bars.length); }
  function famText(f) {
    const where = `the ${f ? esc(f.role) : ''} of 《${f ? esc(f.song) : ''}》 (${f ? esc(f.artist) : ''})`;
    if (!f || f.run <= 2) return 'Fresh: no song in the data shares more than two bars in a row with it.';
    if (f.whole) return `Familiar: ${where} has these exact chords${f.songs > 1 ? `, and so do ${f.songs - 1} other song${f.songs > 2 ? 's' : ''}` : ''}.`;
    return `Its longest run from one song is ${f.run} bars (bars ${f.at + 1}–${f.at + f.run}), from ${where}.`;
  }
  function remember(id) {
    const h = genHist[id] || (genHist[id] = { list: [], i: -1 });
    const cur = ST.barsToString(song.sections[id].bars);
    if (h.list[h.i] !== cur) { h.list.splice(h.i + 1); h.list.push(cur); h.i = h.list.length - 1; }
    return h;
  }
  // While this part loops, the band picks up the new chords on its next bar.
  function refreshPlaying(id) {
    const p = ui.playing;
    if (!p || (p.kind !== 'section' && p.kind !== 'jam') || !p.meta.length || p.meta[0].sec !== id) return;
    const bars = song.sections[id].bars;
    p.meta.forEach((b, j) => { if (bars[j]) b.chords = bars[j]; });
  }
  function newChords(id = ui.sec) {
    const s = song.sections[id];
    const locks = {};
    (s.locks || []).forEach((i) => { if (s.bars[i]) locks[i] = s.bars[i].join(','); });
    const h = remember(id);
    const r = ChordGen.generate({ role: ST.SECTION_TYPES[id].role, bars: s.bars.length, locks, mood: prefs.genMood, adventure: Number(prefs.genAdv), colors: prefs.genColors !== '0' });
    s.bars = r.bars.map((b) => b.map((c) => ST.chordSym(ST.parseChord(c))));
    const str = ST.barsToString(s.bars);
    genInfo[`${id}|${str}`] = r.familiar;
    h.list.splice(h.i + 1); h.list.push(str); h.i = h.list.length - 1;
    save();
    refreshPlaying(id);
    if (id === ui.sec) renderEditor();
  }
  function stepHistory(d) {
    const h = genHist[ui.sec];
    if (!h || !h.list[h.i + d]) return;
    remember(ui.sec);
    h.i += d;
    sec().bars = ST.parseBars(h.list[h.i]);
    save();
    refreshPlaying(ui.sec);
    renderEditor();
  }
  $('genChords').addEventListener('click', (e) => { e.currentTarget.blur(); newChords(); });
  $('genBack').addEventListener('click', () => stepHistory(-1));
  $('genFwd').addEventListener('click', () => stepHistory(1));
  // Jam: loop the part, and each time round it comes back with new chords.
  $('genJam').addEventListener('click', (e) => {
    e.currentTarget.blur();
    if (ui.playing && ui.playing.kind === 'jam') { stop(); return; }
    const id = ui.sec;
    newChords(id);
    const meta = barsFor([{ sec: id, take: ui.take, formIdx: -1 }]);
    start(meta, {
      kind: 'jam', loop: true,
      onBar: (i) => { if (i > 0 && i % meta.length === 0) newChords(id); },
    });
  });

  function syncLinesToBars() {
    const s = sec();
    if (!type().lyrics) return;
    const want = Math.ceil(s.bars.length / LINE_BARS);
    while (s.lines.length < want) s.lines.push(ST.newLine());
    if (s.lines.length > want) s.lines.length = want;
  }

  function renderChords() {
    const k = keyPc();
    $('chords').style.setProperty('--n', Math.min(8, sec().bars.length));
    const locks = sec().locks || [];
    $('chords').innerHTML = sec().bars.map((b, i) => `<button type="button" class="chord-cell${b.length > 1 ? ' split' : ''}${locks.includes(i) ? ' locked' : ''}" data-bar="${i}">${b.map((c) => `<span class="cc"><span class="cc-name">${esc(ST.chordName(c, k))}</span><span class="cc-num">${esc(ST.chordNum(c))}</span></span>`).join('')}<span class="cc-bar">${i + 1}</span>${locks.includes(i) ? '<span class="cc-lock" title="Kept when you ask for new chords">🔒</span>' : ''}</button>`).join('');
  }
  $('addBars').addEventListener('click', () => {
    const s = sec();
    const n = s.bars.length;
    s.bars.push(...(n >= 2 ? s.bars.slice(n - 2) : [['1'], ['5']]).map((b) => b.slice()));
    syncLinesToBars();
    save();
    renderEditor();
  });
  $('removeBars').addEventListener('click', () => {
    const s = sec();
    if (s.bars.length <= 2) return;
    const last = s.lines[s.lines.length - 1];
    if (last && (last.lyrics[0] || last.lyrics[1] || last.notes.length) && !confirm('Remove the last line too (its words and melody)?')) return;
    s.bars.length -= 2;
    pruneLocks(s);
    syncLinesToBars();
    save();
    renderEditor();
  });

  // Chord popover: swaps, or type your own.
  const pop = $('popover');
  function openPopover(anchor, html, onClick) {
    pop.innerHTML = html;
    pop.hidden = false;
    const r = anchor.getBoundingClientRect();
    const w = Math.min(320, window.innerWidth - 24);
    pop.style.width = `${w}px`;
    pop.style.left = `${Math.max(12, Math.min(window.innerWidth - w - 12, r.left + window.scrollX))}px`;
    pop.style.top = `${r.bottom + window.scrollY + 6}px`;
    pop.onclick = onClick;
    const input = pop.querySelector('input');
    if (input) setTimeout(() => input.focus(), 0);
  }
  const closePopover = () => { pop.hidden = true; pop.onclick = null; };
  document.addEventListener('pointerdown', (e) => { if (!pop.hidden && !pop.contains(e.target) && !e.target.closest('.chord-cell, .syl')) closePopover(); });

  $('chords').addEventListener('click', (e) => {
    const cell = e.target.closest('.chord-cell');
    if (!cell) return;
    const i = Number(cell.dataset.bar);
    const bar = sec().bars[i];
    const k = keyPc();
    const parts = bar.map((c, j) => {
      const swaps = ST.swapsFor(c);
      return `<div class="pop-sub">${bar.length > 1 ? `${j ? 'Second' : 'First'} half: ` : ''}<b>${esc(ST.chordName(c, k))}</b> <span class="muted">(${esc(c)})</span></div>`
        + `<div class="pop-swaps">${swaps.map(([s, why]) => `<button type="button" class="pop-swap" data-j="${j}" data-sym="${esc(s)}"><span class="ps-name">${esc(ST.chordName(s, k))}</span><span class="ps-num">${esc(s)}</span><span class="ps-why">${esc(why)}</span></button>`).join('')}</div>`;
    }).join('');
    const locked = (sec().locks || []).includes(i);
    openPopover(cell, `<div class="pop-title">Bar ${i + 1}</div><button type="button" class="link-btn pop-lock">${locked ? '🔓 Let new chords change this bar' : '🔒 Keep this bar when I ask for new chords'}</button>${parts}
      <form class="pop-form"><input type="text" value="${esc(bar.join(','))}" aria-label="Chords for this bar" placeholder="e.g. 6m or 4,5/7"><button class="btn btn-sm" type="submit">Set</button></form>
      <p class="fine">Numbers are 简谱 degrees: 1 4 5 major, 2m 3m 6m minor. Add 7, maj7, sus4, add9, a ♭ (b) or a bass note: 5/7.</p>`, (ev) => {
      if (ev.target.closest('.pop-lock')) {
        const s = sec();
        s.locks = locked ? (s.locks || []).filter((x) => x !== i) : [...(s.locks || []), i];
        save();
        closePopover();
        renderChords();
        return;
      }
      const b = ev.target.closest('.pop-swap');
      if (b) {
        bar[Number(b.dataset.j)] = b.dataset.sym;
        save();
        closePopover();
        renderChords();
        renderEditorHead();
        renderLines();
        previewChord(b.dataset.sym);
      }
    });
    pop.querySelector('form').addEventListener('submit', (ev) => {
      ev.preventDefault();
      const syms = ev.target.querySelector('input').value.split(/[,\s]+/).filter(Boolean).slice(0, 2);
      const bad = syms.filter((s) => !ST.parseChord(s));
      if (!syms.length || bad.length) { toast(`“${bad[0] || ''}” isn’t a chord I know. Try 1, 6m, 5/7, 4maj7, ♭7.`); return; }
      sec().bars[i] = syms.map((s) => ST.chordSym(ST.parseChord(s)));
      save();
      closePopover();
      renderChords();
      renderEditorHead();
      renderLines();
    });
  });
  async function previewChord(sym) {
    await ensureAudio();
    if (band.running) return;
    const ci = ST.chordInfo(sym, keyPc());
    const now = engine.ctx.currentTime + 0.02;
    band.voicing(ci).forEach((m, j) => band.play(band.buffer('clean', m), band.cleanBus, now + j * 0.03, { vol: 0.55, stopAt: now + 1.6 }));
  }

  // ---------- lines ----------
  function renderEditor() {
    renderEditorHead();
    renderChords();
    renderLines();
  }

  function renderLines() {
    const t = type();
    $('editorFoot').hidden = !t.lyrics;
    if (!t.lyrics) {
      $('lines').innerHTML = `<p class="instrumental">${t.zh} ${t.name}: instrumental. The band plays these chords; there are no words to write here.</p>`;
      return;
    }
    $('lines').innerHTML = sec().lines.map((ln, i) => {
      const other = ln.lyrics[ui.take ? 0 : 1];
      const ph = ui.take ? (other ? `2nd time, same tune: ${other}` : '2nd-time words for the same tune') : (i === 0 ? '写一句歌词… type a line in Chinese. Spaces and commas are breaths.' : '下一句…');
      return `<div class="line" data-line="${i}">
        <div class="line-top">
          <span class="line-no">${i + 1}</span>
          <input class="lyric" type="text" data-line="${i}" value="${esc(ln.lyrics[ui.take] || '')}" placeholder="${esc(ph)}" aria-label="Line ${i + 1} lyrics" lang="zh">
          <span class="fit-badge" data-fit="${i}" hidden></span>
          <span class="rhyme-badge" data-rhyme="${i}" hidden></span>
        </div>
        <div class="lane-wrap"><svg class="lane" data-lane="${i}" viewBox="0 0 960 168" role="img" aria-label="Melody of line ${i + 1}"></svg></div>
        <div class="line-foot">
          <div class="line-actions">
            <button class="btn btn-sm" type="button" data-act="suggest" data-line="${i}" title="Set these words to a melody that follows their tones">✨ Suggest</button>
            <button class="btn btn-sm btn-rec" type="button" data-act="record" data-line="${i}" title="Play or hum the line over the band; the app writes it down">● Record</button>
            <button class="btn btn-sm btn-ghost" type="button" data-act="play" data-line="${i}">▶ Play</button>
            <button class="link-btn" type="button" data-act="clear" data-line="${i}">Clear tune</button>
          </div>
          <div class="line-notes" data-notes="${i}"></div>
        </div>
      </div>`;
    }).join('');
    sec().lines.forEach((_, i) => renderLine(i));
  }

  const LANE = { W: 960, L: 10, R: 10, top: 22, pitchH: 84, sylY: 128 };
  const xOf = (t) => LANE.L + (t / LINE) * (LANE.W - LANE.L - LANE.R);
  const tOf = (x) => ((x - LANE.L) / (LANE.W - LANE.L - LANE.R)) * LINE;

  function laneRange(notes) {
    const tonic = ST.doMidi(keyPc());
    if (!notes.length) return [tonic - 5, tonic + 9];
    let lo = Math.min(...notes.map((n) => n.midi)) - 2;
    let hi = Math.max(...notes.map((n) => n.midi)) + 2;
    while (hi - lo < 14) { lo--; hi++; }
    return [lo, hi];
  }

  // The chord-tone color code from the deck: root red, 3rd amber, 5th blue.
  function noteRole(midi, chordSym) {
    const ci = chordSym && ST.chordInfo(chordSym, keyPc());
    if (!ci) return 'other';
    const iv = mod12(midi - ci.rootPc);
    if (iv === 0) return 'root';
    if (iv === 3 || iv === 4) return 'third';
    if (iv === 7) return 'fifth';
    return ci.pcs.includes(mod12(midi)) ? 'ext' : 'other';
  }

  function renderLine(i) {
    const ln = sec().lines[i];
    const svg = document.querySelector(`.lane[data-lane="${i}"]`);
    if (!svg) return;
    const syl = analyze(ln);
    const notes = ln.notes;
    const bars = sec().bars.slice(i * LINE_BARS, i * LINE_BARS + LINE_BARS);
    const [lo, hi] = laneRange(notes);
    const yOf = (m) => LANE.top + ((hi - m) / (hi - lo)) * LANE.pitchH;
    const k = keyPc();
    const parts = [];
    // Beat grid, bar line, chord names.
    for (let b = 0; b <= LINE_BARS * 4; b++) {
      const x = xOf(b * TPB);
      parts.push(`<line class="${b % 4 === 0 ? 'ln-bar' : 'ln-beat'}" x1="${x}" x2="${x}" y1="${LANE.top - 4}" y2="${LANE.top + LANE.pitchH + 8}"/>`);
    }
    bars.forEach((b, bi) => b.forEach((c, j) => {
      const x = xOf(bi * BAR + (j ? BAR / 2 : 0)) + 4;
      parts.push(`<text class="ln-chord" x="${x}" y="14">${esc(ST.chordName(c, k))}</text>`);
    }));
    // Tonic guide line (do).
    const tonic = ST.doMidi(k);
    for (const m of [tonic - 12, tonic, tonic + 12]) if (m > lo && m < hi) parts.push(`<line class="ln-do" x1="${LANE.L}" x2="${LANE.W - LANE.R}" y1="${yOf(m)}" y2="${yOf(m)}"/><text class="ln-do-t" x="${LANE.W - LANE.R - 2}" y="${yOf(m) - 3}">${ST.jianpuText(m, k)}</text>`);
    const al = ST.align(notes, syl);
    const check = ST.toneCheck(notes, syl);
    // Tone-fit links between notes.
    for (const p of check.pairs) {
      if (p.fit === 'good') continue;
      const a = notes[p.noteA];
      const b = notes[p.noteB];
      parts.push(`<line class="ln-link ${p.fit}" x1="${xOf(a.t + a.d) - 3}" y1="${yOf(a.midi) + 6}" x2="${xOf(b.t) + 3}" y2="${yOf(b.midi) + 6}"/>`);
    }
    // Notes.
    notes.forEach((n, j) => {
      const x = xOf(n.t) + 1;
      const w = Math.max(10, xOf(n.t + n.d) - xOf(n.t) - 2);
      const y = yOf(n.midi) - 1;
      const role = noteRole(n.midi, ST.chordAt(bars, n.t));
      const jp = ST.jianpu(n.midi, k, ST.chordAt(bars, n.t));
      const sel = ui.sel && ui.sel.line === i && ui.sel.note === j;
      const dots = jp.oct === 0 ? '' : Array.from({ length: Math.abs(jp.oct) }, (_, d) => `<circle class="jp-dot" cx="${x + 9}" cy="${jp.oct > 0 ? y - 4 - d * 4 : y + 18 + d * 4}" r="1.6"/>`).join('');
      parts.push(`<g class="note ${role}${sel ? ' sel' : ''}${n.m ? ' melisma' : ''}" data-note="${j}"><rect x="${x}" y="${y}" width="${w}" height="14" rx="4"/><text class="jp" x="${x + 9}" y="${y + 11}">${jp.acc}${jp.num}</text>${dots}</g>`);
    });
    // Syllables under their notes.
    const placed = new Set();
    al.map.forEach((k2, j) => {
      const n = notes[j];
      const x = xOf(n.t) + 1;
      if (k2 == null) { parts.push(`<text class="syl-none" x="${x + 2}" y="${LANE.sylY}">·</text>`); return; }
      if (placed.has(k2)) { parts.push(`<text class="syl-tie" x="${x + 2}" y="${LANE.sylY}">~</text>`); return; }
      placed.add(k2);
      parts.push(sylSvg(syl[k2], x, false));
    });
    // Words with no note yet.
    const extra = syl.slice(al.used);
    extra.forEach((s, j) => {
      const x = (notes.length ? Math.min(LANE.W - 30, xOf(notes[notes.length - 1].t + notes[notes.length - 1].d) + 8) : LANE.L + 4) + j * 26;
      if (x < LANE.W - 20) parts.push(sylSvg(s, x, true));
    });
    if (!notes.length) parts.push(`<text class="ln-empty" x="${LANE.W / 2}" y="${LANE.top + LANE.pitchH / 2 + 4}">${syl.length ? '✨ Suggest a melody for these words, ● record one, or click here to place notes' : 'Write the words above, then ✨ Suggest. Or click here to place notes.'}</text>`);
    parts.push(`<line class="playhead" x1="0" x2="0" y1="${LANE.top - 6}" y2="${LANE.sylY + 18}" visibility="hidden"/>`);
    svg.innerHTML = parts.join('');
    svg.dataset.lo = lo;
    svg.dataset.hi = hi;

    // Badges and notes on the fit.
    const badge = document.querySelector(`[data-fit="${i}"]`);
    if (check.score != null) {
      badge.hidden = false;
      badge.textContent = `Tone fit ${check.score}`;
      badge.dataset.level = check.score >= 85 ? 'ok' : check.score >= 65 ? 'warn' : 'bad';
      badge.title = 'How well the melody moves with the tones of the words. Red links mark moves against them.';
    } else badge.hidden = true;
    const msgs = [];
    if (al.extraSyl && notes.length) msgs.push(`<span class="warn">${al.extraSyl} more ${al.extraSyl === 1 ? 'syllable' : 'syllables'} than notes.</span> ✨ Suggest again, click the lane to add a note, or shorten the line.`);
    for (const p of check.pairs.filter((x) => x.fit === 'bad').slice(0, 2)) {
      const a = syl[p.a];
      const b = syl[p.b];
      const semis = notes[p.noteB].midi - notes[p.noteA].midi;
      msgs.push(`<span class="bad">「${esc(a.ch)}${esc(b.ch)}」</span> ${esc(Zh.marked(`${a.base}${a.sung}`))} → ${esc(Zh.marked(`${b.base}${b.sung}`))}: ${Zh.WHY[a.sung]} then ${Zh.WHY[b.sung]} want the tune to <b>${Zh.describeWant(p.want)}</b>, but it goes ${semis > 0 ? 'up' : 'down'} ${Math.abs(semis)} semitone${Math.abs(semis) === 1 ? '' : 's'}.`);
    }
    if (ui.sel && ui.sel.line === i) msgs.push('<span class="muted">Selected note: ↑ ↓ move it in the scale (Shift: a half step) · ← → next note · [ ] shorter / longer · M 拖腔 (carry the word on) · Delete removes it.</span>');
    document.querySelector(`[data-notes="${i}"]`).innerHTML = msgs.map((m) => `<p>${m}</p>`).join('');
    renderRhymeBadges();
  }

  function sylSvg(s, x, extra) {
    const tone = s.han ? s.sung : 0;
    const py = s.py ? Zh.marked(`${s.base}${s.sung}`) : '';
    const changed = s.sandhi ? ' sandhi' : '';
    return `<g class="syl ${TONE_CLASS[tone] || 't0'}${extra ? ' extra' : ''}${changed}" data-syl="${s.i}"><text class="syl-ch" x="${x + 2}" y="${LANE.sylY}">${esc(s.ch.length > 6 ? `${s.ch.slice(0, 6)}…` : s.ch)}</text><text class="syl-py" x="${x + 2}" y="${LANE.sylY + 18}">${esc(py)}</text>${s.sandhi ? `<title>Spoken as ${esc(py)}: ${s.sandhi === '3' ? 'a 3rd tone before another 3rd becomes 2nd' : `${s.sandhi} changes tone before the next syllable`}</title>` : ''}</g>`;
  }

  // ---------- line interactions ----------
  $('lines').addEventListener('input', (e) => {
    if (!e.target.classList.contains('lyric')) return;
    const i = Number(e.target.dataset.line);
    sec().lines[i].lyrics[ui.take] = e.target.value;
    save();
    renderLine(i);
    renderRhyme(false);
  });
  $('lines').addEventListener('focusin', (e) => {
    if (e.target.classList.contains('lyric')) ui.lastInput = e.target;
  });
  $('lines').addEventListener('click', async (e) => {
    const act = e.target.closest('[data-act]');
    if (act) {
      const i = Number(act.dataset.line);
      if (act.dataset.act === 'suggest') suggestLine(i, true);
      else if (act.dataset.act === 'record') recordLine(i);
      else if (act.dataset.act === 'play') playLine(i);
      else if (act.dataset.act === 'clear') { sec().lines[i].notes = []; ui.sel = null; save(); renderLine(i); }
      return;
    }
    const svg = e.target.closest('.lane');
    if (!svg) return;
    const i = Number(svg.dataset.lane);
    const ln = sec().lines[i];
    const syl = e.target.closest('.syl');
    if (syl) { cycleTone(i, Number(syl.dataset.syl)); return; }
    const note = e.target.closest('.note');
    if (note) { selectNote(i, Number(note.dataset.note)); return; }
    // Click on the lane: place a note there (8th grid), at the pitch you clicked (in the scale).
    const pt = svgPoint(svg, e);
    const t = Math.max(0, Math.min(LINE - 6, Math.floor(tOf(pt.x) / 6) * 6));
    const lo = Number(svg.dataset.lo);
    const hi = Number(svg.dataset.hi);
    let midi = Math.round(hi - ((pt.y - LANE.top) / LANE.pitchH) * (hi - lo));
    midi = Math.max(lo, Math.min(hi, midi));
    const tonic = ST.doMidi(keyPc());
    while (![0, 2, 4, 5, 7, 9, 11].includes(mod12(midi - tonic))) midi--;
    if (pt.y > LANE.top + LANE.pitchH + 14) return;
    if (ln.notes.some((n) => n.t === t)) return;
    const next = ln.notes.filter((n) => n.t > t).sort((a, b) => a.t - b.t)[0];
    const prev = ln.notes.filter((n) => n.t < t).sort((a, b) => b.t - a.t)[0];
    if (prev && prev.t + prev.d > t) prev.d = t - prev.t;
    ln.notes.push({ t, d: Math.max(S16, Math.min(6, next ? next.t - t : 6)), midi });
    ln.notes.sort((a, b) => a.t - b.t);
    save();
    selectNote(i, ln.notes.findIndex((n) => n.t === t));
  });
  function svgPoint(svg, e) {
    const r = svg.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * LANE.W, y: ((e.clientY - r.top) / r.height) * 168 };
  }

  // Tap a syllable to fix its tone (for a character read the other way here): cycles 1 → 2 → 3 → 4 → neutral.
  function cycleTone(i, k) {
    const ln = sec().lines[i];
    const syl = analyze(ln);
    const s = syl[k];
    if (!s || !s.han || !s.base) return;
    const next = (s.tone % 5) + 1;
    ln.fix = ln.fix || [{}, {}];
    ln.fix[ui.take] = ln.fix[ui.take] || {};
    ln.fix[ui.take][k] = `${s.ch}:${s.base}${next}`;
    save();
    renderLine(i);
    renderRhyme(false);
    toast(`${s.ch}: ${Zh.marked(`${s.base}${next}`)}. Tap again for the next tone.`, 1800);
  }

  async function selectNote(i, j) {
    const prevLine = ui.sel && ui.sel.line;
    ui.sel = j >= 0 ? { line: i, note: j } : null;
    if (prevLine != null && prevLine !== i) renderLine(prevLine);
    renderLine(i);
    const n = sec().lines[i].notes[j];
    if (n) { await ensureAudio(); if (!band.running) band.sing(n.midi, engine.ctx.currentTime + 0.01, 0.35); }
  }

  document.addEventListener('keydown', (e) => {
    const typing = e.target.closest && e.target.closest('input, textarea, select');
    if (e.key === 'Escape') { closePopover(); if (ui.sel) { const l = ui.sel.line; ui.sel = null; renderLine(l); } return; }
    if (typing) return;
    if (e.code === 'Space') { e.preventDefault(); if (ui.playing) stop(); else playSong(); return; }
    if ((e.key === 'g' || e.key === 'G') && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); newChords(); return; }
    if (!ui.sel) return;
    const ln = sec().lines[ui.sel.line];
    const n = ln && ln.notes[ui.sel.note];
    if (!n) return;
    let changed = true;
    let sing = false;
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { n.midi = ST.stepNote(n.midi, e.key === 'ArrowUp' ? 1 : -1, keyPc(), e.shiftKey); sing = true; }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { const j = ui.sel.note + (e.key === 'ArrowRight' ? 1 : -1); if (j >= 0 && j < ln.notes.length) selectNote(ui.sel.line, j); changed = false; }
    else if (e.key === '[') n.d = Math.max(S16, n.d - S16);
    else if (e.key === ']') { const nx = ln.notes[ui.sel.note + 1]; n.d = Math.min(nx ? nx.t - n.t : LINE - n.t, n.d + S16); }
    else if (e.key === 'm' || e.key === 'M') { if (ui.sel.note > 0) n.m = !n.m; }
    else if (e.key === 'Delete' || e.key === 'Backspace') { ln.notes.splice(ui.sel.note, 1); ui.sel = ln.notes.length ? { line: ui.sel.line, note: Math.min(ui.sel.note, ln.notes.length - 1) } : null; }
    else changed = false;
    if (!changed) return;
    e.preventDefault();
    const line = ui.sel ? ui.sel.line : null;
    save();
    if (line != null) renderLine(line); else renderLines();
    if (sing && band && !band.running) band.sing(n.midi, engine.ctx.currentTime + 0.01, 0.3);
  });

  // ---------- suggest ----------
  function suggestLine(i, andPlay = false) {
    const ln = sec().lines[i];
    const syl = analyze(ln);
    if (!syl.length) { toast('Write the words first. Or ● record a melody, or click the lane to place notes.'); return false; }
    const prevLine = sec().lines[i - 1];
    const prev = prevLine && prevLine.notes.length ? prevLine.notes[prevLine.notes.length - 1].midi : null;
    ln.notes = ST.suggestMelody(syl, {
      bars: sec().bars.slice(i * LINE_BARS, i * LINE_BARS + LINE_BARS), keyPc: keyPc(), role: type().role, style: song.style,
      prevMidi: prev, lastLine: i === sec().lines.length - 1, toneWeight: Number(prefs.toneWeight),
    });
    ui.sel = null;
    save();
    renderLine(i);
    if (andPlay) playLine(i);
    return true;
  }
  $('suggestAll').addEventListener('click', () => {
    let n = 0;
    sec().lines.forEach((_, i) => { if (analyze(sec().lines[i]).length && suggestLine(i)) n++; });
    if (!n) toast('Write some words first: each line gets its own melody.');
    else { toast(`New melodies for ${n} line${n === 1 ? '' : 's'}. Playing the section.`); playSection(); }
  });

  // ---------- playback ----------
  // Bars to play, each with what the band needs: chords, the part's role, and where it sits.
  function barsFor(entries) {
    const out = [];
    entries.forEach(({ sec: id, take, formIdx }, ei) => {
      const s = song.sections[id];
      const role = ST.SECTION_TYPES[id].role;
      const next = entries[ei + 1];
      s.bars.forEach((chords, b) => out.push({
        chords, role, sec: id, take, formIdx, barInSec: b,
        first: b === 0, last: b === s.bars.length - 1, nextRole: next ? ST.SECTION_TYPES[next.sec].role : null,
      }));
    });
    return out;
  }
  function melodyForBar(b) {
    const s = song.sections[b.sec];
    const ln = s.lines[Math.floor(b.barInSec / LINE_BARS)];
    if (!ln) return null;
    const off = (b.barInSec % LINE_BARS) * BAR;
    return ln.notes.filter((n) => n.t >= off && n.t < off + BAR).map((n) => ({ ...n, t: n.t - off }));
  }
  async function start(meta, { kind, loop = false, countIn = 1, melody = true, drop = false, onEnd = null, line = null, onBar = null }) {
    await ensureAudio();
    stop();
    if (!meta.length) return;
    band.setVoice(prefs.voice);
    ui.playing = { kind, meta, line };
    band.start({
      bpm: song.bpm, keyPc: song.key, bars: meta, countIn, loop, style: song.style,
      getBar: (i) => { if (onBar) onBar(i); return { melody: melody ? melodyForBar(meta[i % meta.length]) : null, drop }; },
      onEnd: () => { const cb = onEnd; stop(); if (cb) cb(); },
    });
    $('songCard').dataset.playing = 'true';
    $('playSong').innerHTML = 'Stop <kbd>Space</kbd>';
    $('loopSection').textContent = kind === 'section' ? 'Stop the loop' : 'Loop this section';
    $('genJam').setAttribute('aria-pressed', String(kind === 'jam'));
    $('genJam').textContent = kind === 'jam' ? '■ Stop the jam' : '♾ Jam: new chords every loop';
    if (!frameTimer) frameTimer = setInterval(frame, 33);
  }
  function stop() {
    if (band) band.stop();
    if (ui.playing && ui.playing.kind === 'record') finishRecord(true);
    ui.playing = null;
    $('songCard').dataset.playing = 'false';
    $('playSong').innerHTML = 'Play the song <kbd>Space</kbd>';
    $('loopSection').textContent = 'Loop this section';
    $('genJam').setAttribute('aria-pressed', 'false');
    $('genJam').textContent = '♾ Jam: new chords every loop';
    $('npSec').textContent = '';
    $('npChord').textContent = '';
    document.querySelectorAll('#beats i').forEach((b) => b.classList.remove('on'));
    document.querySelectorAll('.form-chip.playing, .chord-cell.playing, .line.recording').forEach((el) => el.classList.remove('playing', 'recording'));
    document.querySelectorAll('.playhead').forEach((p) => p.setAttribute('visibility', 'hidden'));
  }
  function playSong() {
    const entries = song.form.map((f, formIdx) => ({ ...ST.formEntry(f), formIdx })).filter((e) => song.sections[e.sec]);
    start(barsFor(entries), { kind: 'song' });
  }
  function playSection() {
    start(barsFor([{ sec: ui.sec, take: ui.take, formIdx: -1 }]), { kind: 'section', loop: true });
  }
  function playLine(i) {
    const meta = barsFor([{ sec: ui.sec, take: ui.take, formIdx: -1 }]).slice(i * LINE_BARS, i * LINE_BARS + LINE_BARS);
    start(meta, { kind: 'line', countIn: 0, line: i });
  }
  $('playSong').addEventListener('click', (e) => { e.currentTarget.blur(); if (ui.playing) stop(); else playSong(); });
  $('loopSection').addEventListener('click', (e) => { e.currentTarget.blur(); if (ui.playing && ui.playing.kind === 'section') stop(); else playSection(); });

  // What's playing now: beat dots, part and chord, the form chip, the chord cell, a playhead.
  // A timer rather than animation frames, which some embedded views and low-power modes throttle.
  let frameTimer = null;
  function frame() {
    if (!ui.playing || !band || !band.running) { clearInterval(frameTimer); frameTimer = null; return; }
    const pos = band.position(engine.ctx.currentTime - outLatency());
    if (pos) {
      document.querySelectorAll('#beats i').forEach((b, k) => b.classList.toggle('on', k === pos.beat));
      const meta = ui.playing.meta;
      if (pos.bar < 0) {
        $('npSec').textContent = ui.playing.kind === 'record' ? 'Get ready…' : 'Count-in';
        $('npChord').textContent = '';
      } else {
        const idx = ui.playing.kind === 'section' || ui.playing.kind === 'jam' ? pos.bar % meta.length : pos.bar;
        const b = meta[idx];
        if (b) {
          const t = ST.SECTION_TYPES[b.sec];
          $('npSec').textContent = ui.playing.kind === 'record' ? '● Recording' : `${t.zh} ${t.name}${b.take ? ' 2' : ''}`;
          const chord = b.chords.length > 1 && pos.tick >= BAR / 2 ? b.chords[1] : b.chords[0];
          $('npChord').textContent = ST.chordName(chord, song.key);
          document.querySelectorAll('.form-chip').forEach((c) => c.classList.toggle('playing', Number(c.dataset.i) === b.formIdx));
          const here = b.sec === ui.sec;
          document.querySelectorAll('.chord-cell').forEach((c) => c.classList.toggle('playing', here && Number(c.dataset.bar) === b.barInSec));
          const li = Math.floor(b.barInSec / LINE_BARS);
          document.querySelectorAll('.lane').forEach((svg) => {
            const ph = svg.querySelector('.playhead');
            if (!ph) return;
            const on = here && Number(svg.dataset.lane) === li;
            ph.setAttribute('visibility', on ? 'visible' : 'hidden');
            if (on) { const x = xOf((b.barInSec % LINE_BARS) * BAR + pos.tick); ph.setAttribute('x1', x); ph.setAttribute('x2', x); }
          });
        }
      }
    }
  }

  // ---------- record a melody ----------
  let rec = null;
  async function recordLine(i) {
    if (ui.playing && ui.playing.kind === 'record') { stop(); return; }
    await ensureAudio();
    if (!engine.micOn) {
      await mic.enable();
      if (!engine.micOn) { toast('Turn on the microphone (or your audio interface) to record.'); return; }
    }
    const meta = barsFor([{ sec: ui.sec, take: ui.take, formIdx: -1 }]).slice(i * LINE_BARS, i * LINE_BARS + LINE_BARS);
    await start(meta, { kind: 'record', countIn: 1, melody: false, drop: prefs.recBand === 'drums', line: i, onEnd: () => {} });
    rec = { line: i, sec: ui.sec, events: [], t0: band.barStart(0), spt: band.secPerTick };
    document.querySelector(`.line[data-line="${i}"]`).classList.add('recording');
    toast('One bar to count in, then play or hum the line (2 bars).', 2200);
  }
  engine.on('note', (ev) => {
    if (!rec) return;
    rec.events.push({ time: ev.playedAt - latency() - rec.t0, midi: ev.midi });
  });
  function finishRecord(stopped) {
    if (!rec) return;
    const r = rec;
    rec = null;
    const notes = ST.quantize(r.events, { secPerTick: r.spt });
    const s = song.sections[r.sec];
    if (!notes.length) { toast(stopped && !r.events.length ? 'Didn’t hear any notes. Check the Hearing card: is the level moving?' : 'No notes in time. Try again.'); return; }
    s.lines[r.line].notes = notes;
    save();
    if (r.sec === ui.sec) renderLine(r.line);
    toast(`Got ${notes.length} notes. Your words are laid on them in order; red links show where the tune fights the tones.`, 3200);
  }

  // ---------- rhyme ----------
  function lineEndings(take = ui.take) {
    return sec().lines.map((ln) => {
      const syl = analyze(ln, take);
      const r = Zh.rhymeSyllable(syl);
      return r ? { s: r, group: Zh.rhymeOf(r.base) } : null;
    });
  }
  function renderRhymeBadges() {
    if (!type().lyrics) return;
    const ends = lineEndings();
    const letters = new Map();
    ends.forEach((e, i) => {
      const el = document.querySelector(`[data-rhyme="${i}"]`);
      if (!el) return;
      if (!e || !e.group) { el.hidden = true; return; }
      if (!letters.has(e.group.id)) letters.set(e.group.id, String.fromCharCode(65 + letters.size));
      el.hidden = false;
      el.textContent = `${letters.get(e.group.id)} · ${e.group.zh}`;
      el.title = `${e.s.ch} ${Zh.marked(`${e.s.base}${e.s.sung}`)} rhymes in ${e.group.zh} (${e.group.sound})`;
      el.dataset.group = e.group.id;
    });
  }
  function renderRhyme(resetGroup = true) {
    const card = $('rhymeLines');
    if (!type().lyrics) {
      card.innerHTML = '<li class="muted">Pick a part with words (verse, chorus…) to see its rhymes.</li>';
    } else {
      const ends = lineEndings();
      const letters = new Map();
      const counts = new Map();
      card.innerHTML = ends.map((e, i) => {
        if (!e) return `<li><span class="rl-no">${i + 1}</span><span class="muted">no words yet</span></li>`;
        const g = e.group;
        if (g && !letters.has(g.id)) letters.set(g.id, String.fromCharCode(65 + letters.size));
        if (g) counts.set(g.id, (counts.get(g.id) || 0) + 1);
        const tone = e.s.sung;
        return `<li><span class="rl-no">${i + 1}</span><span class="rl-ch ${TONE_CLASS[tone]}">${esc(e.s.ch)}</span><span class="rl-py">${esc(Zh.marked(`${e.s.base}${tone}`))}</span>${g ? `<span class="rl-g" data-group="${g.id}">${letters.get(g.id)} · ${g.zh}</span>` : '<span class="muted">?</span>'}<span class="rl-tone">${tone === 1 || tone === 2 ? '平 level' : tone === 3 || tone === 4 ? '仄 oblique' : ''}</span></li>`;
      }).join('');
      if (resetGroup || !prefs.rhyme) {
        const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
        if (top) prefs.rhyme = top[0];
      }
    }
    if (!prefs.rhyme) prefs.rhyme = 'huailai';
    $('rhymeGroups').innerHTML = Zh.RHYME_GROUPS.map((g) => `<button type="button" data-g="${g.id}" aria-checked="${g.id === prefs.rhyme}">${g.zh} <small>${g.sound}</small></button>`).join('');
    const g = Zh.groupById(prefs.rhyme);
    $('rhymeNote').innerHTML = g ? `<b>${g.zh}辙</b> (${g.sound}): finals ${g.finals.map((f) => f.replace('v', 'ü')).join(', ')}. ${g.open ? 'An open, ringing vowel: sings well on long, high chorus notes.' : 'A closed vowel: softer and more intimate, better for verses or short notes.'} Ending lines on a 1st or 2nd tone (平) holds well; 3rd and 4th (仄) sound punchier.` : '';
    $('wordBank').innerHTML = g ? g.words.split(' ').map((w) => `<button type="button" class="word" data-w="${esc(w)}">${esc(w)}</button>`).join('') : '';
  }
  $('rhymeGroups').addEventListener('click', (e) => {
    const b = e.target.closest('[data-g]');
    if (!b) return;
    prefs.rhyme = b.dataset.g;
    savePrefs();
    renderRhyme(false);
  });
  // Keep the caret in the lyric box: clicking a word shouldn't take focus from it.
  $('wordBank').addEventListener('pointerdown', (e) => {
    if (!e.target.closest('.word')) return;
    if (document.activeElement && document.activeElement.classList.contains('lyric')) ui.lastInput = document.activeElement;
    e.preventDefault();
  });
  $('wordBank').addEventListener('click', (e) => {
    const b = e.target.closest('.word');
    if (!b) return;
    const active = document.activeElement && document.activeElement.classList.contains('lyric') ? document.activeElement : null;
    const input = active || (ui.lastInput && document.body.contains(ui.lastInput) ? ui.lastInput : document.querySelector('.lyric'));
    if (!input) { toast('Pick a part with words first.'); return; }
    const w = b.dataset.w;
    const s = input.selectionStart != null ? input.selectionStart : input.value.length;
    const end = input.selectionEnd != null ? input.selectionEnd : s;
    input.value = input.value.slice(0, s) + w + input.value.slice(end);
    input.focus();
    input.setSelectionRange(s + w.length, s + w.length);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });

  // ---------- spark ----------
  const SPARK = {
    场景: ['末班地铁', '凌晨的便利店', '下雨的公交站', '老房子的阳台', '机场出发大厅', '海边的防波堤', '毕业后的空教室', '城市天台', '高速公路休息站', '夏夜的天桥', '旧书店', '回老家的火车', '演唱会散场后', '十字路口的红灯', '搬家那天', '医院走廊'],
    物件: ['旧耳机', '没寄出的信', '一把吉他', '褪色的照片', '一把伞', '一串钥匙', '船票', '打火机', '围巾', '未读消息', '冷掉的咖啡', '车票根', '手表', '风筝', '录音带', '纸飞机'],
    情绪: ['释怀', '不甘', '想念', '倔强', '温柔', '后悔', '期待', '孤独', '感激', '愤怒', '自由', '迷茫', '心动', '告别'],
    写法: ['写给十年前的自己', '全程用“你”说话', '让物件开口说话', '只写一个晚上发生的事', '副歌只有一句，反复唱', '先写最后一句，再往回写', '整首歌不用“爱”这个字', '用天气写心情', '一问一答的对话', '从结局倒着讲', '写给一座城市', '写给已经离开的人'],
  };
  const SPARK_EN = { 场景: 'Scene', 物件: 'Object', 情绪: 'Feeling', 写法: 'Angle' };
  function newSpark() {
    $('spark').innerHTML = Object.entries(SPARK).map(([k, list]) => `<div><dt>${k} <small>${SPARK_EN[k]}</small></dt><dd>${esc(list[Math.floor(Math.random() * list.length)])}</dd></div>`).join('');
  }
  $('newSpark').addEventListener('click', newSpark);

  // ---------- lead sheet, backup ----------
  function renderSheet() { $('sheet').textContent = ST.leadSheet(song); }
  const fileName = (ext) => `${(song.title || 'song').replace(/[\\/:*?"<>|]+/g, '').trim() || 'song'}.${ext}`;
  function download(name, text, mime) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: mime }));
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  $('copySheet').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(ST.leadSheet(song)); toast('Lead sheet copied.'); } catch { toast('Couldn’t copy here. Select the text and copy it.'); }
  });
  $('saveSheet').addEventListener('click', () => download(fileName('txt'), ST.leadSheet(song), 'text/plain;charset=utf-8'));
  $('exportJson').addEventListener('click', () => download(fileName('json'), JSON.stringify(song, null, 1), 'application/json'));
  $('importJson').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try {
      const s = JSON.parse(await f.text());
      if (!s || !s.sections || !s.form || !ST.STYLES[s.style]) throw new Error('not a song');
      s.id = uid();
      stop();
      song = s;
      save();
      renderAll();
      toast(`Restored “${s.title || 'Untitled'}”.`);
    } catch { toast('That file isn’t a song backup from this page.'); }
  });

  // ---------- render everything ----------
  function renderAll() {
    $('title').value = song.title || '';
    renderSongSelect();
    syncStyle();
    $('keySelect').value = String(song.key);
    $('tempo').value = song.bpm;
    $('tempoVal').textContent = `${song.bpm} bpm`;
    if (!song.sections[ui.sec]) ui.sec = 'V';
    renderForm();
    renderEditor();
    renderRhyme();
    renderSheet();
  }
  renderAll();
  newSpark();
  window.addEventListener('beforeunload', () => store.set('ff.songs', lib));
})();
