// The Pickup height page: the recommended gaps for each pickup and side (Gibson's or StewMac's), the
// gaps you measured, what to turn and how far, a diagram of the pickup's screws, and the level check
// (pluck each open string through each pickup; with the guitar plugged in). The logic is
// js/pickups.js; this is the page.
(function () {
  'use strict';
  const T = window.Theory;
  const P = window.Pickups;
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

  const empty = () => ({ neck: { bass: null, treble: null }, bridge: { bass: null, treble: null } });
  const saved = { pickup: 'humbucker', source: 'gibson', unit: 'in', lv: 'neck', m: empty(), ...store.get('ff.pickups', {}) };
  if (!P.PICKUPS[saved.pickup]) saved.pickup = 'humbucker';
  if (!P.SOURCES[saved.source]) saved.source = 'gibson';
  if (!['in', 'mm'].includes(saved.unit)) saved.unit = 'in';
  if (!saved.m || !saved.m.neck || !saved.m.bridge) saved.m = empty();
  const save = () => store.set('ff.pickups', saved);

  let tuningId = store.get('ff.settings', {}).tuning || 'standard';
  if (!T.TUNINGS[tuningId]) tuningId = 'standard';
  const tuning = () => T.TUNINGS[tuningId];

  function seg(id, value) {
    $(id).querySelectorAll('button').forEach((b) => {
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(b.dataset.value === String(value)));
    });
  }
  function onSeg(id, fn) {
    $(id).addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      b.blur();
      fn(b.dataset.value);
    });
  }

  const len = (mm) => P.lengthText(mm, saved.unit);
  const both = (mm) => (saved.unit === 'in' ? `${P.inchText(mm / P.MM)} <small>${P.mmText(mm)}</small>` : `${P.mmText(mm)} <small>${P.inchText(mm / P.MM)}</small>`);
  const POS_NAME = { neck: 'Neck pickup', bridge: 'Bridge pickup' };
  const SIDE_HEAD = { bass: 'Bass side · under the low E', treble: 'Treble side · under the high E' };

  // ---------- the source and the diagram ----------
  function renderSource() {
    const src = P.SOURCES[saved.source];
    const pu = P.PICKUPS[saved.pickup];
    const own = src.types.includes(pu.type);
    $('pkSrcNote').dataset.kind = own ? '' : 'warn';
    $('pkSrcNote').innerHTML = `<b>${esc(src.long)}.</b> Press each E string at ${esc(src.fret)} and measure to ${esc(src.to)}. ${esc(src.note)}${own ? ''
      : ' <b>For a P-90, StewMac’s starting point is the one made for it.</b>'}`;
    $('pkFigNote').textContent = {
      humbucker: 'A humbucker’s height is set by the two screws at either end, in its mounting ring: clockwise draws that end up towards the strings, anticlockwise lets the spring push it down. The pole screws set each string’s volume.',
      soapbar: 'A soapbar P-90 is held down by two screws between its pole pieces, on foam or springs: tightening one pulls that end down, loosening lets it come up. The pole screws set each string’s volume.',
      dogear: 'A dogear P-90’s two screws, in its ears, only hold it down: its height is set with shims under it, the same outline as the pickup. The pole screws set each string’s volume, and even out the two sides.',
    }[saved.pickup];
    drawTop();
  }

  // The pickup from above: the strings run left to right, low E at the top, and the pickup stands
  // across them, one pole piece under each string.
  function drawTop() {
    const k = saved.pickup;
    const ys = [0, 1, 2, 3, 4, 5].map((i) => 38 + i * 23); // low E … high e
    const slotted = (x, y, r = 6) => `<circle class="pk-screwpole" cx="${x}" cy="${y}" r="${r}"/><line class="pk-slot" x1="${x - r + 2}" y1="${y}" x2="${x + r - 2}" y2="${y}"/>`;
    const screw = (x, y, cls) => `<circle class="${cls}" cx="${x}" cy="${y}" r="8"/><line class="pk-slot" x1="${x - 5}" y1="${y}" x2="${x + 5}" y2="${y}"/>`;
    const label = (x, y, text, cls = 'pk-lbl') => `<text class="${cls}" x="${x}" y="${y}">${text}</text>`;
    let svg = '';
    if (k === 'humbucker') {
      // The mounting ring, two coils (screw poles in one, slugs in the other), a height screw at each end.
      svg += '<rect class="pk-ring" x="96" y="4" width="108" height="182" rx="12"/>';
      svg += '<rect class="pk-cover" x="108" y="24" width="40" height="142" rx="5"/><rect class="pk-cover" x="152" y="24" width="40" height="142" rx="5"/>';
      svg += ys.map((y) => slotted(128, y) + `<circle class="pk-slug" cx="172" cy="${y}" r="5.5"/>`).join('');
      svg += screw(150, 14, 'pk-hscrew') + screw(150, 176, 'pk-hscrew');
      svg += label(214, 18, 'bass-side height screw') + label(214, 180, 'treble-side height screw');
    } else if (k === 'soapbar') {
      // Two screws, between the 2nd and 3rd and the 4th and 5th pole pieces.
      svg += '<rect class="pk-cover p90" x="122" y="14" width="56" height="162" rx="8"/>';
      svg += ys.map((y) => slotted(150, y)).join('');
      const y1 = (ys[1] + ys[2]) / 2;
      const y2 = (ys[3] + ys[4]) / 2;
      svg += screw(150, y1, 'pk-hscrew') + screw(150, y2, 'pk-hscrew');
      svg += label(188, y1 + 4, 'bass-side screw') + label(188, y2 + 4, 'treble-side screw');
    } else {
      // The ears, with a screw in each that only holds it down.
      svg += '<path class="pk-cover p90" d="M122 26 L134 4 H166 L178 26 V164 L166 186 H134 L122 164 Z"/>';
      svg += ys.map((y) => slotted(150, y)).join('');
      svg += screw(150, 14, 'pk-mscrew') + screw(150, 176, 'pk-mscrew');
      svg += label(188, 18, 'holding screws only:') + label(188, 32, 'height by shims under it');
    }
    // The strings over it.
    svg += ys.map((y, i) => `<line class="pk-str" x1="18" y1="${y}" x2="300" y2="${y}" style="stroke-width:${(2.4 - i * 0.3).toFixed(1)}"/>`).join('');
    svg += ['E', 'A', 'D', 'G', 'B', 'e'].map((n, i) => label(4, ys[i] + 4, n, 'pk-lbl faint')).join('');
    $('pkTop').setAttribute('viewBox', '0 0 380 190');
    $('pkTop').innerHTML = svg;
  }

  // ---------- the two pickups ----------
  function renderPickups() {
    $('pkPickups').innerHTML = P.POSITIONS.map((pos) => `<div class="pk-pu" data-pos="${pos}">
      <div class="pk-pu-head"><b>${POS_NAME[pos]}</b></div>
      <div class="pk-sides">${P.SIDES.map((side) => `<div class="pk-sidebox" data-side="${side}">
        <div class="pk-side-name">${SIDE_HEAD[side]}</div>
        <div class="pk-target"><span class="pk-target-lbl">Set to</span> <span class="pk-target-val" data-k="target"></span></div>
        <label class="pk-meas-lbl" for="pk-${pos}-${side}">You measured</label>
        <div class="pk-measure">
          <button type="button" class="pk-step" data-d="-1" aria-label="Less">−</button>
          <input id="pk-${pos}-${side}" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" placeholder="–">
          <button type="button" class="pk-step" data-d="1" aria-label="More">+</button>
        </div>
        <p class="pk-advice" data-k="advice"></p>
      </div>`).join('')}</div>
      <p class="pk-summary" data-k="summary"></p>
    </div>`).join('');
    syncPickups();
  }

  function syncPickups() {
    for (const pos of P.POSITIONS) {
      const box = $('pkPickups').querySelector(`.pk-pu[data-pos="${pos}"]`);
      const r = P.advisePickup({ pickup: saved.pickup, source: saved.source, position: pos, bassMm: saved.m[pos].bass, trebleMm: saved.m[pos].treble, unit: saved.unit });
      for (const side of P.SIDES) {
        const sb = box.querySelector(`.pk-sidebox[data-side="${side}"]`);
        const a = r[side];
        sb.querySelector('[data-k="target"]').innerHTML = both(a.targetMm);
        const input = sb.querySelector('input');
        if (document.activeElement !== input) input.value = a.measuredMm == null ? '' : len(a.measuredMm);
        const adv = sb.querySelector('[data-k="advice"]');
        adv.dataset.status = a.status || '';
        adv.textContent = a.status ? a.say : 'Measure the gap and enter it here.';
      }
      box.querySelector('[data-k="summary"]').textContent = r.summary;
    }
  }

  $('pkPickups').addEventListener('click', (e) => {
    const b = e.target.closest('.pk-step');
    if (!b) return;
    const sb = b.closest('.pk-sidebox');
    const pos = b.closest('.pk-pu').dataset.pos;
    const side = sb.dataset.side;
    saved.m[pos][side] = P.step(saved.m[pos][side], Number(b.dataset.d), saved.unit);
    save();
    syncPickups();
  });
  $('pkPickups').addEventListener('change', (e) => {
    const input = e.target.closest('input');
    if (!input) return;
    const pos = input.closest('.pk-pu').dataset.pos;
    const side = input.closest('.pk-sidebox').dataset.side;
    const mm = P.parseLength(input.value, saved.unit);
    saved.m[pos][side] = input.value.trim() === '' ? null : mm;
    save();
    input.blur();
    syncPickups();
  });
  $('pkPickups').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.closest('input')) e.target.blur();
  });

  $('pkClear').addEventListener('click', (e) => {
    e.currentTarget.blur();
    saved.m = empty();
    save();
    syncPickups();
  });

  onSeg('pkTypeSeg', (v) => { saved.pickup = v; save(); seg('pkTypeSeg', v); renderSource(); syncPickups(); });
  onSeg('pkSrcSeg', (v) => { saved.source = v; save(); seg('pkSrcSeg', v); renderSource(); syncPickups(); });
  onSeg('pkUnitSeg', (v) => { saved.unit = v; save(); seg('pkUnitSeg', v); syncPickups(); });

  // ---------- the level check ----------
  const engine = new window.AudioEngine();
  const panel = window.MicPanel.setup(engine, {
    store,
    preferFlat: () => tuning().flat,
    tuning,
    quietOption: false, // the level check is of the plugged-in guitar: its input untouched
    onInputChange: () => sayLevels(),
  });
  engine.setQuiet(false); // (just here: the setting the practice pages use is left as it is)
  const check = new P.LevelCheck();
  let pending = null; // { s, until, db }: a pluck being measured (its loudest moment in the next 0.25 s)

  engine.on('note', (ev) => {
    const s = P.openString(ev.midi, tuning().open);
    if (s == null) return; // a fretted note: not part of the check
    pending = { s, until: ev.playedAt + 0.25, db: -Infinity, pickup: saved.lv };
  });
  engine.on('frame', (info) => {
    if (!pending) return;
    if (info.t <= pending.until) { pending.db = Math.max(pending.db, info.db); return; }
    check.add(pending.pickup, pending.s, pending.db);
    pending = null;
    drawBars();
    sayLevels();
  });

  function drawBars() {
    const tn = tuning();
    const lv = { neck: check.levels('neck'), bridge: check.levels('bridge') };
    const all = [...Object.values(lv.neck), ...Object.values(lv.bridge)];
    const top = all.length ? Math.max(...all) : 0;
    const h = (db) => (db == null ? 0 : Math.max(4, Math.min(100, 100 + (db - top) * 4))); // 25 dB of range
    const bal = { neck: check.balance('neck'), bridge: check.balance('bridge') };
    $('pkBars').innerHTML = [6, 5, 4, 3, 2, 1].map((s) => {
      const bar = (pu) => {
        const db = lv[pu][s];
        const b = bal[pu];
        const odd = b && (b.louder.includes(s) || b.quieter.includes(s));
        return `<div class="pk-bar ${pu}${odd ? ' odd' : ''}" style="height:${h(db)}%" title="${POS_NAME[pu]}: ${db == null ? 'not heard yet' : `${db.toFixed(1)} dBFS`}"></div>`;
      };
      return `<div class="pk-col" role="listitem" aria-label="${esc(T.stringLongName(s, tn))} string">
        <div class="pk-col-bars">${bar('neck')}${bar('bridge')}</div>
        <div class="pk-col-note">${esc(T.noteName(tn.open[s], tn.flat))}<small>${Math.floor(tn.open[s] / 12) - 1}</small></div></div>`;
    }).join('') + '<div class="pk-legend fine"><span class="pk-key neck"></span> neck <span class="pk-key bridge"></span> bridge</div>';
  }

  const strName = (s) => `${T.stringLongName(s, tuning())} string`;
  const listNames = (ss) => ss.map(strName).join(ss.length === 2 ? ' and ' : ', ');
  function sayLevels() {
    const say = (html) => { $('pkLvSay').innerHTML = html; };
    if (!engine.micOn) { say('Plug the guitar in and press <b>Enable input</b>.'); return; }
    if (panel.inputKind() === 'mic') { say('That’s a microphone: it hears the strings, not the pickups. Plug the guitar into an audio interface (or a KATANA:GO) and choose it as the input.'); return; }
    const pu = saved.lv;
    const other = pu === 'neck' ? 'bridge' : 'neck';
    const b = check.balance(pu);
    const lines = [];
    if (!b) lines.push(`Pluck each open string, two or three times, on the <b>${POS_NAME[pu].toLowerCase()}</b>.`);
    else {
      if (b.louder.length) lines.push(`On the ${POS_NAME[pu].toLowerCase()}, the <b>${esc(listNames(b.louder))}</b> ${b.louder.length > 1 ? 'are' : 'is'} noticeably louder than the rest: turn ${b.louder.length > 1 ? 'their' : 'its'} pole screw in a little.`);
      if (b.quieter.length) lines.push(`On the ${POS_NAME[pu].toLowerCase()}, the <b>${esc(listNames(b.quieter))}</b> ${b.quieter.length > 1 ? 'are' : 'is'} noticeably quieter than the rest: turn ${b.quieter.length > 1 ? 'their' : 'its'} pole screw out a little.`);
      if (!b.louder.length && !b.quieter.length) lines.push(`On the ${POS_NAME[pu].toLowerCase()}, the strings come out evenly (${b.heard} heard).`);
    }
    const d = check.neckOverBridge();
    if (d == null) {
      if (b && !check.balance(other)) lines.push(`Now switch the guitar to its <b>${POS_NAME[other].toLowerCase()}</b>, choose <b>${POS_NAME[other]}</b> above, and do it again.`);
    } else if (Math.abs(d) < 2) lines.push('The two pickups are about as loud as each other.');
    else {
      const loud = d > 0 ? 'neck' : 'bridge';
      const quiet = d > 0 ? 'bridge' : 'neck';
      lines.push(`The ${loud} pickup is ${Math.abs(d).toFixed(1)} dB louder than the ${quiet}: if you’d like them closer, lower the ${loud} pickup a little or raise the ${quiet}.`);
    }
    say(lines.join(' '));
  }

  onSeg('pkLvSeg', (v) => { saved.lv = v; save(); seg('pkLvSeg', v); sayLevels(); });
  $('pkLvClear').addEventListener('click', (e) => {
    e.currentTarget.blur();
    check.reset();
    pending = null;
    drawBars();
    sayLevels();
  });

  seg('pkTypeSeg', saved.pickup);
  seg('pkSrcSeg', saved.source);
  seg('pkUnitSeg', saved.unit);
  seg('pkLvSeg', saved.lv);
  renderSource();
  renderPickups();
  drawBars();
  sayLevels();
})();
