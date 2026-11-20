// SVG fretboard in the deck's style: rosewood, cream frets, high e on top so it reads like tab.
(function (root) {
  'use strict';
  const T = root.Theory;
  const NS = 'http://www.w3.org/2000/svg';
  const INLAYS = [3, 5, 7, 9, 15, 17, 19, 21];
  const DOUBLE = [12, 24];
  const STRING_W = { 1: 1.2, 2: 1.5, 3: 1.9, 4: 2.4, 5: 3, 6: 3.6 };

  function el(tag, attrs = {}, parent) {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) n.setAttribute(k, v);
    if (parent) parent.appendChild(n);
    return n;
  }

  class Fretboard {
    constructor(svg, { from = 0, to = 12, tuning = T.TUNINGS.standard, onPick = null } = {}) {
      this.svg = svg;
      this.from = from;
      this.to = to;
      this.tuning = tuning;
      this.onPick = onPick;
      this.targetString = null;
      this.dots = [];
      this.render();
    }

    configure({ from = this.from, to = this.to, tuning = this.tuning }) {
      this.from = from;
      this.to = to;
      this.tuning = tuning;
      this.render();
    }

    render() {
      const svg = this.svg;
      svg.innerHTML = '';
      const W = 1000;
      const labelW = 30;
      const hasOpen = this.from === 0;
      const openW = hasOpen ? 50 : 0;
      const first = hasOpen ? 1 : this.from;
      const nCells = this.to - first + 1;
      const top = 14;
      const sp = 34;
      const boardH = sp * 6;
      const bx = labelW + openW;
      const bw = W - bx - 8;
      const cellW = bw / nCells;
      const H = top + boardH + 30;
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.setAttribute('role', 'img');
      svg.setAttribute('aria-label', `Fretboard, frets ${this.from} to ${this.to}`);

      this.geom = { first, hasOpen, cellW, bx, sp, top, boardH, labelW, openW };
      this.y = (s) => top + sp / 2 + (s - 1) * sp;
      this.x = (f) => (f === 0 && hasOpen ? labelW + openW * 0.45 : bx + (f - first + 0.5) * cellW);

      const defs = el('defs', {}, svg);
      const grad = el('linearGradient', { id: 'wood', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
      el('stop', { offset: '0%', 'stop-color': '#4a2e1e' }, grad);
      el('stop', { offset: '50%', 'stop-color': '#3d2619' }, grad);
      el('stop', { offset: '100%', 'stop-color': '#321e13' }, grad);
      const glow = el('filter', { id: 'glow', x: '-20%', y: '-200%', width: '140%', height: '500%' }, defs);
      el('feGaussianBlur', { stdDeviation: 4 }, glow);

      el('rect', { x: bx, y: top, width: bw, height: boardH, fill: 'url(#wood)', stroke: '#2a1810', 'stroke-width': 1.5, rx: 2 }, svg);
      this.highlightLayer = el('g', {}, svg);

      for (let f = first; f <= this.to; f++) {
        const cx = this.x(f);
        const r = Math.min(cellW, sp) * 0.17;
        if (INLAYS.includes(f)) el('circle', { cx, cy: top + boardH / 2, r, fill: '#7d6754' }, svg);
        if (DOUBLE.includes(f)) {
          el('circle', { cx, cy: top + sp * 1.5 + sp / 2, r, fill: '#7d6754' }, svg);
          el('circle', { cx, cy: top + sp * 3.5 + sp / 2, r, fill: '#7d6754' }, svg);
        }
      }
      for (let i = 1; i <= nCells; i++) {
        el('line', { x1: bx + i * cellW, y1: top, x2: bx + i * cellW, y2: top + boardH, stroke: '#b9b2a4', 'stroke-width': 3 }, svg);
      }
      el('line', { x1: bx, y1: top - 1, x2: bx, y2: top + boardH + 1, stroke: hasOpen ? '#efe8d8' : '#b9b2a4', 'stroke-width': hasOpen ? 8 : 3 }, svg);

      this.stringEls = {};
      this.labelEls = {};
      for (const s of T.STRINGS) {
        const y = this.y(s);
        this.stringEls[s] = el('line', { x1: hasOpen ? labelW + 4 : bx, y1: y, x2: W - 8, y2: y, stroke: '#cec6b6', 'stroke-width': STRING_W[s], class: 'fb-string' }, svg);
        const lab = el('text', { x: 4, y: y + 5, class: 'fb-label' }, svg);
        lab.textContent = T.stringName(s, this.tuning);
        this.labelEls[s] = lab;
      }
      for (let f = this.from; f <= this.to; f++) {
        const mark = INLAYS.includes(f) || DOUBLE.includes(f);
        const t = el('text', { x: this.x(f), y: top + boardH + 21, class: mark ? 'fb-fretnum mark' : 'fb-fretnum', 'text-anchor': 'middle' }, svg);
        t.textContent = f;
      }

      this.dotLayer = el('g', {}, svg);
      this.hitLayer = el('g', { class: this.onPick ? 'fb-hits' : '' }, svg);
      if (this.onPick) {
        for (const s of T.STRINGS) {
          for (let f = this.from; f <= this.to; f++) {
            const x0 = f === 0 && hasOpen ? labelW : bx + (f - first) * cellW;
            const w = f === 0 && hasOpen ? openW : cellW;
            const cell = el('rect', { x: x0, y: this.y(s) - sp / 2, width: w, height: sp, class: 'fb-cell' }, this.hitLayer);
            const hover = el('circle', { cx: this.x(f), cy: this.y(s), r: 12, class: 'fb-hover' }, this.hitLayer);
            cell.addEventListener('pointerenter', () => hover.classList.add('on'));
            cell.addEventListener('pointerleave', () => hover.classList.remove('on'));
            cell.addEventListener('pointerdown', (e) => { e.preventDefault(); this.onPick(s, f); });
          }
        }
      }
      this.setTargetString(this.targetString);
      this.setDots(this.dots);
    }

    setTargetString(s) {
      this.targetString = s;
      this.highlightLayer.innerHTML = '';
      for (const k of T.STRINGS) {
        this.stringEls[k].classList.toggle('target', k === s);
        this.labelEls[k].classList.toggle('target', k === s);
      }
      if (!s) return;
      const y = this.y(s);
      const { bx, labelW, hasOpen } = this.geom;
      el('rect', { x: hasOpen ? labelW : bx, y: y - this.geom.sp / 2 + 3, width: 1000 - 8 - (hasOpen ? labelW : bx), height: this.geom.sp - 6, class: 'fb-band', rx: 4 }, this.highlightLayer);
      el('line', { x1: hasOpen ? labelW + 4 : bx, y1: y, x2: 992, y2: y, class: 'fb-glow', filter: 'url(#glow)' }, this.highlightLayer);
    }

    // dots: [{ s, f, label, kind }]; kind = found | missed | anchor | reveal | wrong | heat; heat dots take a `tone`.
    setDots(dots) {
      this.dots = dots;
      this.dotLayer.innerHTML = '';
      for (const d of dots) this.drawDot(d);
    }

    drawDot(d) {
      if (d.f < this.from || d.f > this.to) return null;
      const g = el('g', { class: `fb-dot ${d.kind}${d.tone ? ` tone-${d.tone}` : ''}${d.pop ? ' pop' : ''}`, transform: `translate(${this.x(d.f)} ${this.y(d.s)})` }, this.dotLayer);
      const r = d.kind === 'heat' ? 12.5 : 14;
      el('circle', { r, class: 'fb-dot-bg' }, g);
      if (d.label) {
        const t = el('text', { y: 4.5, 'text-anchor': 'middle', class: 'fb-dot-label' }, g);
        t.textContent = d.label;
        if (d.label.length > 2) t.setAttribute('font-size', '10');
      }
      if (d.title) el('title', {}, g).textContent = d.title;
      return g;
    }

    // A dot that fades out on its own (e.g. where a wrong note probably was).
    flash(d, ms = 1400) {
      const g = this.drawDot({ ...d, pop: true });
      if (!g) return;
      setTimeout(() => g.classList.add('fade'), ms - 400);
      setTimeout(() => g.remove(), ms);
    }
  }

  root.Fretboard = Fretboard;
})(window);
