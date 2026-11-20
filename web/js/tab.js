// SVG tab for a two-bar lick: fret numbers on six lines (high e on top), the count underneath,
// bends, releases, hammer-ons, pull-offs, slides and vibrato marked the usual way, and a playhead.
// Each note can carry a state class: now, hit, alt, miss, soft, changed, was-hit, was-miss.
(function (root) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const W = 860;
  const TOP = 40;
  const SP = 26;
  const LEFT = 40;
  const RIGHT = 14;
  const TICKS = 96;
  const LETTERS = { 1: 'e', 2: 'B', 3: 'G', 4: 'D', 5: 'A', 6: 'E' };

  function el(tag, attrs = {}, parent) {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, v);
    if (parent) parent.appendChild(n);
    return n;
  }

  class Tab {
    constructor(svg) {
      this.svg = svg;
      this.notes = [];
      this.noteEls = [];
      this.H = TOP + SP * 5 + 42;
      svg.setAttribute('viewBox', `0 0 ${W} ${this.H}`);
      this.render([]);
    }

    x(t) { return LEFT + 22 + (t / TICKS) * (W - LEFT - RIGHT - 34); }
    y(s) { return TOP + (s - 1) * SP; }

    render(notes, { hidden = false, empty = '' } = {}) {
      const svg = this.svg;
      svg.innerHTML = '';
      this.notes = notes;
      this.noteEls = [];
      const x0 = LEFT;
      const x1 = W - RIGHT;
      for (let s = 1; s <= 6; s++) {
        el('line', { x1: x0, x2: x1, y1: this.y(s), y2: this.y(s), class: 'tab-line' }, svg);
        el('text', { x: 14, y: this.y(s) + 5, class: 'tab-letter' }, svg).textContent = LETTERS[s];
      }
      for (const bx of [x0, this.x(48) - 11, x1]) el('line', { x1: bx, x2: bx, y1: this.y(1), y2: this.y(6), class: 'tab-bar' }, svg);
      // The count: 1 & 2 & … with the swung "and" two-thirds through each beat.
      for (let b = 0; b < 8; b++) {
        const t = b * 12;
        el('text', { x: this.x(t), y: this.y(6) + 30, class: 'tab-count', 'text-anchor': 'middle' }, svg).textContent = String((b % 4) + 1);
        el('text', { x: this.x(t + 8), y: this.y(6) + 30, class: 'tab-count and', 'text-anchor': 'middle' }, svg).textContent = '&';
      }
      this.playhead = el('line', { x1: 0, x2: 0, y1: this.y(1) - 14, y2: this.y(6) + 12, class: 'tab-playhead', visibility: 'hidden' }, svg);
      if (!notes.length) {
        if (empty) el('text', { x: W / 2, y: this.y(3) + 14, class: 'tab-empty', 'text-anchor': 'middle' }, svg).textContent = empty;
        return;
      }
      const layer = el('g', {}, svg);
      notes.forEach((n, i) => {
        const prev = notes[i - 1];
        const x = this.x(n.t);
        const y = this.y(n.s);
        const g = el('g', { class: `tab-note${hidden ? ' hidden' : ''}` }, layer);
        const label = hidden ? '?' : String(n.fret);
        // Shrink the box when the next note on this string is close (sixteenths).
        const nextSame = notes.slice(i + 1).find((m) => m.s === n.s);
        const room = nextSame ? this.x(nextSame.t) - x - 2 : 99;
        const w = Math.max(16, Math.min(label.length > 1 ? 28 : 21, room));
        el('rect', { x: x - w / 2, y: y - 12, width: w, height: 24, rx: 6, class: 'tab-note-bg' }, g);
        el('text', { x, y: y + 6, 'text-anchor': 'middle', class: 'tab-fret' }, g).textContent = label;
        if (!hidden) {
          if (n.bend) {
            // Bend: an arrow up from the note, with how far.
            el('path', { d: `M ${x + w / 2} ${y} q 12 0 14 -${y - this.y(1) + 18}`, class: 'tab-bend' }, g);
            el('path', { d: `M ${x + w / 2 + 10} ${this.y(1) - 14} l 4 -6 l 4 6`, class: 'tab-bend' }, g);
            el('text', { x: x + w / 2 + 14, y: this.y(1) - 22, 'text-anchor': 'middle', class: 'tab-tech' }, g).textContent = n.bend === 2 ? 'full' : '½';
          }
          if (n.tech === 'rel') el('text', { x: x - w / 2 - 6, y: y - 12, class: 'tab-tech' }, g).textContent = 'r';
          if ((n.tech === 'h' || n.tech === 'p') && prev) {
            const px = this.x(prev.t);
            el('path', { d: `M ${px + 6} ${y - 11} Q ${(px + x) / 2} ${y - 26} ${x - 6} ${y - 11}`, class: 'tab-arc' }, g);
            el('text', { x: (px + x) / 2, y: y - 22, 'text-anchor': 'middle', class: 'tab-tech' }, g).textContent = n.tech;
          }
          if (n.tech === 's') {
            const from = prev ? this.x(prev.t) + 10 : x - 26;
            const up = !prev || prev.fret < n.fret;
            el('line', { x1: from, x2: x - w / 2 - 2, y1: y + (up ? 6 : -6), y2: y + (up ? -6 : 6), class: 'tab-slide' }, g);
          }
          if (n.vib) {
            const vx = x + w / 2 + (n.bend ? 4 : 3);
            el('path', { d: `M ${vx} ${y + 13} q 3 -4 6 0 t 6 0 t 6 0`, class: 'tab-vib' }, g);
          }
        }
        this.noteEls.push(g);
      });
    }

    setState(i, state) {
      const g = this.noteEls[i];
      if (!g) return;
      g.classList.remove('now', 'hit', 'alt', 'miss', 'soft');
      if (state) g.classList.add(state);
    }

    mark(i, cls, on = true) { const g = this.noteEls[i]; if (g) g.classList.toggle(cls, on); }

    clearStates() { this.noteEls.forEach((g, i) => this.setState(i, null)); }

    // tick: 0–96 within the phrase, or null to hide. kind: 'call' | 'resp'.
    setPlayhead(tick, kind = 'call') {
      if (tick == null) { this.playhead.setAttribute('visibility', 'hidden'); return; }
      const x = this.x(Math.max(0, Math.min(TICKS, tick)));
      this.playhead.setAttribute('x1', x);
      this.playhead.setAttribute('x2', x);
      this.playhead.setAttribute('visibility', 'visible');
      this.playhead.setAttribute('class', `tab-playhead ${kind}`);
    }
  }

  root.Tab = Tab;
})(window);
