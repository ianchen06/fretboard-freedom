// Tab for an exercise's note sequence, wrapped into lines of whole beats: fret numbers on six lines
// (high e on top), the count under the notes, bar lines, chord names, bends, technique marks (~~~,
// h, p, PM), rests, and a state per note
// (now, hit, miss). Hidden notes show "?" until revealed.
(function (root) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const W = 860;
  const LEFT = 34;
  const RIGHT = 14;
  const SP = 17;
  const TOP = 30;
  const LINE_H = TOP + SP * 5 + 40;
  const LETTERS = { 1: 'e', 2: 'B', 3: 'G', 4: 'D', 5: 'A', 6: 'E' };
  // Notes per line for each rhythm (notes per beat), so lines hold whole beats.
  const PER_LINE = { 0.5: 8, 1: 8, 2: 16, 3: 12, 4: 16, 6: 12 };

  function el(tag, attrs = {}, parent) {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, v);
    if (parent) parent.appendChild(n);
    return n;
  }

  class SeqTab {
    constructor(svg, scroller) {
      this.svg = svg;
      this.scroller = scroller;
      this.noteEls = [];
      this.nowIdx = null;
    }

    render(notes, { npb = 2, hidden = false, chords = null, empty = '' } = {}) {
      const svg = this.svg;
      svg.innerHTML = '';
      this.notes = notes;
      this.noteEls = [];
      this.nowIdx = null;
      this.hidden = hidden;
      if (!notes.length) {
        svg.setAttribute('viewBox', `0 0 ${W} 60`);
        if (empty) el('text', { x: W / 2, y: 36, class: 'tab-empty', 'text-anchor': 'middle' }, svg).textContent = empty;
        return;
      }
      const per = PER_LINE[npb] || 16;
      const lines = Math.ceil(notes.length / per);
      const H = lines * LINE_H + 4;
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      const slot = (W - LEFT - RIGHT - 20) / per;
      const perBar = npb * 4;
      this.lineOf = (i) => Math.floor(i / per);
      this.lineH = LINE_H;
      this.H = H;
      for (let L = 0; L < lines; L++) {
        const y0 = L * LINE_H + TOP;
        const g = el('g', {}, svg);
        const count = Math.min(per, notes.length - L * per);
        const x1 = LEFT + 20 + count * slot + 2;
        for (let s = 1; s <= 6; s++) {
          el('line', { x1: LEFT, x2: x1, y1: y0 + (s - 1) * SP, y2: y0 + (s - 1) * SP, class: 'stab-line' }, g);
          el('text', { x: 12, y: y0 + (s - 1) * SP + 4, class: 'stab-letter' }, g).textContent = LETTERS[s];
        }
        el('line', { x1: LEFT, x2: LEFT, y1: y0, y2: y0 + 5 * SP, class: 'stab-bar' }, g);
        el('line', { x1, x2: x1, y1: y0, y2: y0 + 5 * SP, class: L === lines - 1 ? 'stab-bar end' : 'stab-bar' }, g);
        for (let j = 0; j < count; j++) {
          const i = L * per + j;
          const n = notes[i];
          const x = LEFT + 20 + (j + 0.5) * slot;
          const y = y0 + (n.s - 1) * SP;
          // Bar lines between notes, and the count under each beat.
          if (perBar >= 1 && i > 0 && i % perBar === 0 && j > 0) el('line', { x1: x - slot / 2, x2: x - slot / 2, y1: y0, y2: y0 + 5 * SP, class: 'stab-bar' }, g);
          const beatStart = npb >= 1 ? i % npb === 0 : true;
          if (beatStart) {
            const beat = npb >= 1 ? Math.floor(i / npb) : i * (1 / npb);
            el('text', { x, y: y0 + 5 * SP + 22, class: 'stab-count', 'text-anchor': 'middle' }, g).textContent = String((beat % 4) + 1);
          }
          if (chords && n.chord != null && (i === 0 || notes[i - 1].chord !== n.chord)) {
            el('text', { x: x - slot / 2 + 2, y: y0 - 14, class: 'stab-chord' }, g).textContent = chords[n.chord].name;
          }
          const ng = el('g', { class: 'stab-note' }, g);
          if (n.rest) {
            // A rest: a dash across the middle of the staff, no fret.
            el('rect', { x: x - 7, y: y0 + 2 * SP + SP / 2 - 3, width: 14, height: 6, rx: 1.5, class: 'stab-rest' }, ng);
            ng.dataset.label = '';
            this.noteEls.push(ng);
            continue;
          }
          const label = hidden ? '?' : n.bend ? `${n.f}b` : String(n.f);
          const w = Math.max(15, label.length * 8 + 6);
          el('rect', { x: x - w / 2, y: y - 9, width: w, height: 18, rx: 5, class: 'stab-note-bg' }, ng);
          const t = el('text', { x, y: y + 4.5, 'text-anchor': 'middle', class: 'stab-fret' }, ng);
          t.textContent = label;
          if (n.bend && !hidden) el('text', { x, y: y - 12, 'text-anchor': 'middle', class: 'stab-tech' }, ng).textContent = n.bend === 2 ? 'full' : '½';
          // Technique marks: ~~~ vibrato, h hammer-on, p pull-off, PM palm mute.
          else if (n.mark && !hidden) el('text', { x, y: y - 12, 'text-anchor': 'middle', class: 'stab-tech' }, ng).textContent = n.mark;
          ng.dataset.label = n.bend ? `${n.f}b` : String(n.f);
          this.noteEls.push(ng);
        }
      }
    }

    reveal(i) {
      const g = this.noteEls[i];
      if (!g) return;
      const t = g.querySelector('.stab-fret');
      if (t) t.textContent = g.dataset.label;
    }

    setState(i, state) {
      const g = this.noteEls[i];
      if (!g) return;
      g.classList.remove('hit', 'miss');
      if (state) g.classList.add(state);
    }

    clearStates() { for (const g of this.noteEls) g.classList.remove('hit', 'miss'); }

    setNow(i) {
      if (this.nowIdx != null && this.noteEls[this.nowIdx]) this.noteEls[this.nowIdx].classList.remove('now');
      this.nowIdx = i;
      const g = this.noteEls[i];
      if (!g) return;
      g.classList.add('now');
      // Keep the current line in view inside the scroller.
      const sc = this.scroller;
      if (!sc || !this.H) return;
      const scale = sc.scrollHeight / this.H;
      const top = this.lineOf(i) * this.lineH * scale;
      const bottom = top + this.lineH * scale;
      const to = {};
      if (top < sc.scrollTop || bottom > sc.scrollTop + sc.clientHeight) to.top = Math.max(0, top - 6);
      // On a narrow screen the tab scrolls sideways too: keep the note away from the edges.
      if (sc.scrollWidth > sc.clientWidth + 1) {
        const rect = g.querySelector('rect');
        const x = rect ? (Number(rect.getAttribute('x')) + Number(rect.getAttribute('width')) / 2) * (sc.scrollWidth / W) : 0;
        if (x < sc.scrollLeft + 40 || x > sc.scrollLeft + sc.clientWidth - 40) to.left = Math.max(0, x - sc.clientWidth / 3);
      }
      if (to.top != null || to.left != null) sc.scrollTo({ ...to, behavior: 'smooth' });
    }
  }

  root.SeqTab = SeqTab;
})(window);
