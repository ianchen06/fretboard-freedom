// Stand mode, shared by the practice pages: one screen you can read from a music stand while both
// hands are on the guitar, and hands-free control.
//
// - The parts a page needs while playing move into .stand-view (left: neck and tab; right: title,
//   feedback, controls; below: the Hearing strip and options), and back where they were on exit.
//   In portrait the two columns merge into one, in each part's order.
//   Moving them keeps their ids and listeners; the CSS for the view is in css/style.css.
// - Pedals: page turners (AirTurn, PageFlip and others) type arrow or page keys. Right (→ ↓ PgDn)
//   and left (← ↑ PgUp) call the page's onRight / onLeft. Only in stand mode, so the arrows keep
//   their normal job otherwise. F toggles stand mode, Esc leaves it.
// - Play to start: playing the page's start note (any octave) calls start().
// - pop(): a big flash across the screen for the moments that matter.
//
// Whether a page is in stand mode is kept per page (ff.stand.pages); Play to start and Auto next
// are shared by every page (ff.stand).
(function (root) {
  'use strict';
  const RIGHT = ['ArrowRight', 'ArrowDown', 'PageDown'];
  const LEFT = ['ArrowLeft', 'ArrowUp', 'PageUp'];
  const mod12 = (n) => ((Math.round(n) % 12) + 12) % 12;
  const RING_MS = 1500; // a note still ringing from before a stop doesn't count as a start

  // Which pedal a key is, or null.
  function pedalOf(key) {
    if (RIGHT.includes(key)) return 'right';
    if (LEFT.includes(key)) return 'left';
    return null;
  }

  // Does a heard note start the exercise? want: a MIDI note (matched in any octave), 'any', or null (never).
  function startsOn(midi, want) {
    if (want == null) return false;
    if (want === 'any') return true;
    return mod12(midi) === mod12(want);
  }

  // The frets to show for an exercise in stand mode: its frets plus one each side, the open strings
  // when it's near the nut, at least 6 frets. width is the fretboard's viewBox width, so a window of
  // few frets draws bigger (each fret about as wide as on the full neck). null: no notes, full neck.
  function fretWindow(frets, maxFret = 22) {
    const fs = frets.filter((f) => Number.isFinite(f));
    if (!fs.length) return null;
    let lo = Math.max(0, Math.min(...fs) - 1);
    let hi = Math.min(maxFret, Math.max(...fs) + 1);
    if (lo <= 2) lo = 0;
    while (hi - lo < 5) { if (hi < maxFret) hi++; else lo--; }
    return { from: lo, to: hi, width: Math.min(1000, 140 + (hi - lo + 1) * 90) };
  }

  function setup({
    page, store, parts, onRight = () => {}, onLeft = () => {}, onChange = () => {},
    startNote = () => null, canPlayStart = () => false, start = () => {},
  }) {
    const doc = document;
    const $ = (id) => doc.getElementById(id);
    const opts = { playStart: true, autoNext: true, ...store.get('ff.stand', {}) };
    const saveOpts = () => store.set('ff.stand', { playStart: opts.playStart, autoNext: opts.autoNext });
    let on = !!store.get('ff.stand.pages', {})[page];

    let view = $('standView');
    if (!view) {
      view = doc.createElement('div');
      view.className = 'stand-view';
      view.id = 'standView';
      view.innerHTML = '<div class="stand-l"></div><div class="stand-r"></div><div class="stand-b"></div>';
      doc.querySelector('main').prepend(view);
    }
    let popEl = $('standPop');
    if (!popEl) {
      popEl = doc.createElement('div');
      popEl.className = 'stand-pop';
      popEl.id = 'standPop';
      popEl.setAttribute('aria-live', 'polite');
      doc.body.appendChild(popEl);
    }

    let home = null;
    function move(into) {
      if (into && !home) {
        home = [];
        for (const [col, sels] of Object.entries(parts)) {
          const dest = view.querySelector(`.stand-${col}`);
          for (const part of sels) {
            // [selector, order]: in portrait the columns merge into one, sorted by order (default 5).
            const [sel, order] = Array.isArray(part) ? part : [part, 5];
            const el = doc.querySelector(sel);
            if (!el) continue;
            home.push({ el, parent: el.parentNode, next: el.nextSibling });
            el.style.order = String(order);
            dest.appendChild(el);
          }
        }
      } else if (!into && home) {
        for (const { el, parent, next } of home.reverse()) { el.style.order = ''; parent.insertBefore(el, next); }
        home = null;
      }
    }

    function sync() {
      doc.body.classList.toggle('stand', on);
      const b = $('standBtn');
      if (b) { b.textContent = on ? 'Exit' : 'Stand mode'; b.setAttribute('aria-pressed', String(on)); }
      if ($('playStartBtn')) $('playStartBtn').setAttribute('aria-pressed', String(opts.playStart));
      if ($('autoNextBtn')) $('autoNextBtn').setAttribute('aria-pressed', String(opts.autoNext));
    }

    function set(v) {
      on = !!v;
      const pages = store.get('ff.stand.pages', {});
      pages[page] = on;
      store.set('ff.stand.pages', pages);
      move(on);
      sync();
      if (on) root.scrollTo(0, 0);
      onChange(on);
    }

    let popTimer = 0;
    function pop(kind, text) {
      if (!on) return;
      popEl.className = `stand-pop ${kind} show`;
      popEl.textContent = text;
      clearTimeout(popTimer);
      popTimer = setTimeout(() => popEl.classList.remove('show'), 1300);
    }

    let stoppedAt = 0;
    function stopped() { stoppedAt = performance.now(); }
    function heard(midi) {
      if (!on || !opts.playStart || !canPlayStart()) return false;
      if (performance.now() - stoppedAt < RING_MS) return false;
      if (!startsOn(midi, startNote())) return false;
      start();
      return true;
    }

    // Capture phase, so in stand mode the pedals win over a page's own arrow keys.
    doc.addEventListener('keydown', (e) => {
      if (e.target.closest && e.target.closest('input, select, textarea')) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'f' || e.key === 'F') { e.preventDefault(); e.stopImmediatePropagation(); set(!on); return; }
      if (!on) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); set(false); return; }
      const p = pedalOf(e.key);
      if (!p) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (p === 'right') onRight(); else onLeft();
    }, true);

    const btn = (id, fn) => { const b = $(id); if (b) b.addEventListener('click', (e) => { e.currentTarget.blur(); fn(); }); };
    btn('standBtn', () => set(!on));
    btn('playStartBtn', () => { opts.playStart = !opts.playStart; saveOpts(); sync(); onChange(on); });
    btn('autoNextBtn', () => { opts.autoNext = !opts.autoNext; saveOpts(); sync(); onChange(on); });

    return {
      get on() { return on; },
      opts,
      set,
      init() { set(on); },
      pop,
      heard,
      stopped,
    };
  }

  const api = { setup, pedalOf, startsOn, fretWindow };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Stand = api;
})(typeof window !== 'undefined' ? window : globalThis);
