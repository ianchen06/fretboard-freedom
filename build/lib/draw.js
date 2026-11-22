// Drawing helpers: fretboards, tab, cards, rich text, tables, legends, practice slides.
// Every fretboard dot and tab note is checked against the theory engine at build time (see VERIFY).
const T = require('./theory');
const { HEX, M, CONTENT_TOP, CONTENT_BOTTOM, content, getSection } = require('./deck');

const VERIFY = { dots: 0, dotsChecked: 0, tabNotes: 0, tabChecked: 0, slides: new Set() };

let PRES = null; // set by init(); needed for shape constants and scheme colors
let C = null;
function init(pres) { PRES = pres; C = pres.SchemeColor; }

// ---------- colors ----------
function roleStyle(role) {
  switch (role) {
    case 'root': return { fill: C.accent1, text: 'FFFFFF' };
    case 'third': return { fill: C.accent2, text: '17171B' };
    case 'fifth': return { fill: C.accent3, text: 'FFFFFF' };
    case 'seventh': return { fill: C.accent4, text: 'FFFFFF' };
    case 'blue': return { fill: C.accent5, text: '17171B' };
    case 'other': return { fill: C.accent6, text: '17171B' };
    case 'note': return { fill: C.background2, text: '17171B' }; // natural note on a plain note map
    case 'dim': return { fill: '3F3F46', text: 'D4D4D8' }; // sharp/flat on a plain note map
    case 'ghost': return { fill: null, line: 'A1A1AA', text: 'D4D4D8' };
    default: throw new Error(`Unknown role: ${role}`);
  }
}
const ROLE_HEX = { root: HEX.root, third: HEX.third, fifth: HEX.fifth, seventh: HEX.seventh, blue: HEX.blue, other: HEX.other };
const ROLE_NAME = { root: 'Root', third: '3rd', fifth: '5th', seventh: '7th', blue: 'Blue / flavor note', other: 'Other scale note' };

const th = (light) => (light
  ? { bg: HEX.lightBg, card: HEX.lightCard, card2: HEX.lightCard2, text: HEX.lightText, muted: HEX.lightMuted, head: HEX.lightText, line: HEX.lightLine, accent: '8A6D3B' }
  : { bg: HEX.bg, card: HEX.card, card2: HEX.card2, text: HEX.text, muted: HEX.muted, head: HEX.white, line: HEX.line, accent: HEX.pearl });

// ---------- text measuring (Arial / Helvetica advance widths, 1/1000 em) ----------
const W_REG = { ' ': 278, a: 556, b: 556, c: 500, d: 556, e: 556, f: 278, g: 556, h: 556, i: 222, j: 222, k: 500, l: 222, m: 833, n: 556, o: 556, p: 556, q: 556, r: 333, s: 500, t: 278, u: 556, v: 500, w: 722, x: 500, y: 500, z: 500, A: 667, B: 667, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, I: 278, J: 500, K: 667, L: 556, M: 833, N: 722, O: 778, P: 667, Q: 778, R: 722, S: 667, T: 611, U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611, '.': 278, ',': 278, ':': 278, ';': 278, '-': 333, '–': 556, '—': 1000, '’': 222, "'": 191, '(': 333, ')': 333, '/': 278, '&': 667, '+': 584, '·': 278, '→': 1000, '♭': 500, '♯': 556, '°': 400 };
const W_BOLD = { ...W_REG, b: 611, d: 611, f: 333, g: 611, h: 611, i: 278, j: 278, k: 556, l: 278, m: 889, n: 611, o: 611, p: 611, q: 611, r: 389, s: 556, t: 333, u: 611, v: 556, w: 778, x: 556, y: 556, A: 722, B: 722, J: 556, K: 722, L: 611, ':': 333, ';': 333, '’': 278 };
function textWidth(str, pt, { bold = false, black = false } = {}) {
  const tbl = bold || black ? W_BOLD : W_REG;
  let u = 0;
  for (const ch of str) u += tbl[ch] ?? (/[0-9]/.test(ch) ? 556 : 600);
  return (u / 1000) * pt / 72 * (black ? 1.2 : 1);
}
// Greedy word wrap: number of lines `str` takes in `width` inches.
function lineCount(str, pt, width, opts) {
  const plain = str.replace(/\*\*|_|\{\w+:|\}/g, '');
  let lines = 1; let cur = '';
  for (const word of plain.split(/\s+/)) {
    const next = cur ? `${cur} ${word}` : word;
    if (cur && textWidth(next, pt, opts) > width * 0.97) { lines++; cur = word; } else cur = next;
  }
  return lines;
}

// ---------- rich text ----------
// Markup: **bold**, {root:text} {third:text} {fifth:text} {seventh:text} {blue:text} colored bold, _italic_.
function runs(str, base = {}) {
  const out = [];
  const re = /\*\*(.+?)\*\*|\{(root|third|fifth|seventh|blue|other|pearl):([^}]*)\}|_(.+?)_/g;
  let last = 0; let m;
  while ((m = re.exec(str))) {
    if (m.index > last) out.push({ text: str.slice(last, m.index), options: { ...base } });
    if (m[1] !== undefined) out.push({ text: m[1], options: { ...base, bold: true } });
    else if (m[2] !== undefined) out.push({ text: m[3], options: { ...base, bold: true, color: m[2] === 'pearl' ? HEX.pearl : ROLE_HEX[m[2]] } });
    else out.push({ text: m[4], options: { ...base, italic: true } });
    last = re.lastIndex;
  }
  if (last < str.length) out.push({ text: str.slice(last), options: { ...base } });
  return out;
}

// Paragraph text. `text` is a string (rich markup) or array of strings (one paragraph each).
function text(slide, str, o) {
  const t = th(slide._light);
  const base = { color: o.color || t.text, fontSize: o.fontSize || 16 };
  const paras = Array.isArray(str) ? str : [str];
  const all = [];
  paras.forEach((p, i) => {
    const r = runs(p, base);
    if (i < paras.length - 1) r[r.length - 1].options.breakLine = true;
    if (o.paraSpace && i < paras.length - 1) r[r.length - 1].options.paraSpaceAfter = o.paraSpace;
    all.push(...r);
  });
  slide.addText(all, {
    x: o.x, y: o.y, w: o.w, h: o.h, margin: o.margin ?? 0, valign: o.valign || 'top', align: o.align || 'left',
    isTextBox: true, fontFace: o.fontFace, lineSpacingMultiple: o.lineSpacing || 1.05, paraSpaceAfter: o.paraSpace || 0,
  });
}

// Bulleted list with rich markup.
function bullets(slide, items, o) {
  const t = th(slide._light);
  const base = { color: o.color || t.text, fontSize: o.fontSize || 16 };
  const all = [];
  items.forEach((it, i) => {
    const r = runs(it, base);
    r[0].options = { ...r[0].options, bullet: o.numbered ? { type: 'number' } : { indent: 16 } };
    r.forEach((x) => { x.options.paraSpaceAfter = o.paraSpace ?? 8; });
    if (i < items.length - 1) r[r.length - 1].options.breakLine = true;
    all.push(...r);
  });
  slide.addText(all, { x: o.x, y: o.y, w: o.w, h: o.h, margin: 0, valign: o.valign || 'top', isTextBox: true, lineSpacingMultiple: 1.05 });
}

// ---------- cards ----------
// Rounded card with optional title, body (rich string or array of paragraphs) or bullets, optional colored top dot/badge.
function card(slide, o) {
  const t = th(slide._light);
  slide.addShape(PRES.shapes.ROUNDED_RECTANGLE, { x: o.x, y: o.y, w: o.w, h: o.h, rectRadius: 0.1, fill: { color: o.fill || t.card }, line: { color: o.fill || t.card, width: 0 } });
  const pad = o.pad ?? 0.22;
  let y = o.y + pad;
  if (o.badge) {
    badge(slide, { x: o.x + pad, y, d: 0.42, label: o.badge, role: o.badgeRole || 'root' });
  }
  if (o.title) {
    const tx = o.badge ? o.x + pad + 0.55 : o.x + pad;
    const tw = o.w - pad * 2 - (o.badge ? 0.55 : 0);
    const tsz = o.titleSize || 17;
    // Measure wrapped lines so long titles push the body down instead of colliding.
    const lines = lineCount(o.title, tsz, tw, { bold: true });
    const lineH = (tsz * 1.2) / 72;
    const th2 = o.titleH || Math.max(o.badge ? 0.42 : 0.4, lines * lineH + 0.04);
    slide.addText(runs(o.title, { color: o.titleColor || t.head, fontSize: tsz, bold: true }), {
      x: tx, y, w: tw, h: th2, margin: 0, valign: o.badge && lines === 1 ? 'middle' : 'top', isTextBox: true,
    });
    y += th2 + 0.12;
  }
  const bodyH = o.y + o.h - pad - y;
  if (o.bullets) bullets(slide, o.bullets, { x: o.x + pad, y, w: o.w - pad * 2, h: bodyH, fontSize: o.fontSize || 14, paraSpace: o.paraSpace ?? 6 });
  else if (o.body) text(slide, o.body, { x: o.x + pad, y, w: o.w - pad * 2, h: bodyH, fontSize: o.fontSize || 14, paraSpace: o.paraSpace ?? 6, color: o.bodyColor });
  return { innerY: y, innerX: o.x + pad, innerW: o.w - pad * 2 };
}

// Circle with a short label (number, interval, note).
function badge(slide, { x, y, d = 0.42, label, role = 'root', fontSize }) {
  const st = roleStyle(role);
  slide.addText(String(label), {
    shape: PRES.shapes.OVAL, x, y, w: d, h: d, fill: st.fill ? { color: st.fill } : undefined,
    line: st.line ? { color: st.line, width: 1.25 } : { color: st.fill, width: 0 },
    color: st.text, bold: true, fontSize: fontSize || Math.max(9, Math.min(18, d * 72 * (String(label).length > 2 ? 0.3 : 0.42))),
    align: 'center', valign: 'middle', margin: 0, fontFace: 'Arial',
  });
}

// Row of colored dots + names explaining the color code.
function legend(slide, { x, y, roles = ['root', 'third', 'fifth', 'seventh', 'other'], names = {}, gap = 0.25, fontSize = 12 }) {
  const t = th(slide._light);
  let cx = x;
  for (const r of roles) {
    const label = names[r] || ROLE_NAME[r];
    badge(slide, { x: cx, y, d: 0.24, label: '', role: r });
    const w = label.length * fontSize * 0.0078 + 0.15;
    slide.addText(label, { x: cx + 0.31, y: y - 0.03, w, h: 0.3, fontSize, color: t.muted, margin: 0, valign: 'middle', isTextBox: true });
    cx += 0.31 + w + gap;
  }
  return cx;
}

// ---------- tables ----------
// rows: array of arrays of cells (rich strings). First row is the header when header !== false.
function table(slide, rows, o) {
  const t = th(slide._light);
  const fs = o.fontSize || 13;
  const data = rows.map((row, ri) => row.map((cell, ci) => {
    const isHead = o.header !== false && ri === 0;
    const cellObj = typeof cell === 'object' && cell !== null && !Array.isArray(cell) ? cell : { text: String(cell) };
    const base = { color: isHead ? (slide._light ? HEX.lightText : HEX.pearl) : t.text, fontSize: isHead ? fs - 1 : fs, bold: isHead || (o.boldFirstCol && ci === 0) };
    return {
      text: runs(cellObj.text, base),
      options: {
        fill: { color: cellObj.fill || (isHead ? t.card2 : (ri % 2 ? t.card : (slide._light ? 'FAFAFA' : '1D1D23'))) },
        align: cellObj.align || (o.align && o.align[ci]) || 'left', valign: 'middle',
        margin: [4, 8, 4, 8], border: { type: 'solid', color: slide._light ? 'E4E4E7' : '2E2E36', pt: 0.75 },
      },
    };
  }));
  slide.addTable(data, { x: o.x, y: o.y, w: o.w, colW: o.colW, rowH: o.rowH, fontFace: 'Arial', autoPage: false });
}

// ---------- fretboard ----------
const INLAYS = [3, 5, 7, 9, 15, 17, 19, 21];
const DOUBLE = [12, 24];
const STRING_PT = { 1: 0.75, 2: 1, 3: 1.25, 4: 1.6, 5: 1.9, 6: 2.25 };

function lineBetween(slide, x1, y1, x2, y2, opts) {
  const flip = (x2 - x1) * (y2 - y1) < 0;
  slide.addShape(PRES.shapes.LINE, { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1), flipV: flip, line: opts });
}

const looksLikeNote = (l) => /^[A-G][♯♭#b]?$/.test(l);
const looksLikeInterval = (l) => /^(R|(♭♭|[♭♯#b])?(1[13]|[1-79]))$/.test(l);
// Semitones above the root for an interval label, including extensions and enharmonic spellings (♯4 = ♭5, ♯9 = ♭3, 13 = 6).
const DEGREE_SEMIS = { 1: 0, 2: 2, 3: 4, 4: 5, 5: 7, 6: 9, 7: 11, 9: 2, 11: 5, 13: 9 };
function intervalSemis(label) {
  if (label === 'R') return 0;
  const m = label.replace(/#/g, '♯').match(/^(♭♭|[♭♯b]?)(\d+)$/);
  const acc = m[1] === '♯' ? 1 : m[1] === '♭♭' ? -2 : m[1] ? -1 : 0;
  return ((DEGREE_SEMIS[Number(m[2])] + acc) % 12 + 12) % 12;
}

function checkDot(d, o) {
  VERIFY.dots++;
  if (d.label === undefined || d.label === '' || d.noCheck) return;
  const p = T.pcAt(d.s, d.f, o.tuning);
  const ctx = `slide "${o._title || ''}" string ${d.s} fret ${d.f}`;
  if (looksLikeNote(d.label)) {
    if (T.pc(d.label) !== p) throw new Error(`Wrong note label ${d.label} at ${ctx}: actual ${T.noteName(p)}`);
    VERIFY.dotsChecked++;
  } else if (looksLikeInterval(d.label)) {
    if (!o.root) throw new Error(`Interval label ${d.label} needs fretboard root at ${ctx}`);
    if (intervalSemis(d.label) !== T.semis(o.root, p)) throw new Error(`Wrong interval ${d.label} at ${ctx}: actual ${T.intervalLabel(o.root, p)} from ${o.root}`);
    VERIFY.dotsChecked++;
  }
  if (o.root && d.role && ['root', 'third', 'fifth', 'seventh'].includes(d.role) && !d.noRoleCheck) {
    const r = T.role(T.semis(o.root, p));
    if (r !== d.role) throw new Error(`Role ${d.role} wrong at ${ctx}: interval is ${T.intervalLabel(o.root, p)}`);
  }
}

/**
 * Horizontal fretboard. High e on top (reads like tab).
 * o: { x, y, w, h, from=0, to=12, dots:[{s,f,label,role,ring,small}], root, fretNumbers:'all'|'inlays'|false,
 *      stringLabels=true, regions:[{from,to,label,row}], shade:[{from,to}], links:[{a:{s,f},b:{s,f},color}], dotSize, title,
 *      tuning (a T.TUNINGS entry; standard when omitted) }
 * Returns geometry helpers { fx(f), sy(s), cellW, sp }.
 */
function fretboard(slide, o) {
  o._title = o.title || slide._title;
  const from = o.from ?? 0; const to = o.to ?? 12;
  const hasOpen = from === 0;
  const first = hasOpen ? 1 : from;
  const nCells = to - first + 1;
  const labelW = o.stringLabels === false ? 0 : 0.3;
  const openW = hasOpen ? Math.min(0.5, (o.w - labelW) / (nCells + 1) * 0.8) : 0;
  const bx = o.x + labelW + openW;
  const bw = o.w - labelW - openW;
  const cellW = bw / nCells;
  const sp = o.h / 6.1;
  const pad = sp * 0.55;
  const sy = (s) => o.y + pad + (s - 1) * sp;
  const fx = (f) => (f === 0 && hasOpen ? o.x + labelW + openW * 0.45 : bx + (f - first + 0.5) * cellW);
  const t = th(slide._light);

  // wood
  slide.addShape(PRES.shapes.RECTANGLE, { x: bx, y: o.y, w: bw, h: o.h, fill: { color: HEX.wood }, line: { color: HEX.woodEdge, width: 0.75 } });
  // shaded windows
  for (const sh of o.shade || []) {
    const a = Math.max(sh.from, first); const b = Math.min(sh.to, to);
    slide.addShape(PRES.shapes.RECTANGLE, { x: bx + (a - first) * cellW, y: o.y, w: (b - a + 1) * cellW, h: o.h, fill: { color: sh.color || 'E9DFC8', transparency: sh.transparency ?? 82 }, line: { color: sh.color || 'E9DFC8', width: 0, transparency: 100 } });
  }
  // inlays
  // Inlays sit between two strings; skip one when a note dot on either neighboring string would half-cover it.
  const inD = Math.min(cellW, sp) * 0.34;
  const hasDot = (s, f) => (o.dots || []).some((d) => d.s === s && d.f === f);
  for (let f = first; f <= to; f++) {
    const cx = bx + (f - first + 0.5) * cellW;
    if (INLAYS.includes(f) && !(hasDot(3, f) || hasDot(4, f))) slide.addShape(PRES.shapes.OVAL, { x: cx - inD / 2, y: o.y + o.h / 2 - inD / 2, w: inD, h: inD, fill: { color: HEX.inlay }, line: { color: HEX.inlay, width: 0 } });
    if (DOUBLE.includes(f)) {
      for (const [a, b] of [[2, 3], [4, 5]]) {
        if (hasDot(a, f) || hasDot(b, f)) continue;
        const yy = sy(a) + sp / 2;
        slide.addShape(PRES.shapes.OVAL, { x: cx - inD / 2, y: yy - inD / 2, w: inD, h: inD, fill: { color: HEX.inlay }, line: { color: HEX.inlay, width: 0 } });
      }
    }
  }
  // frets + nut
  for (let i = 1; i <= nCells; i++) slide.addShape(PRES.shapes.LINE, { x: bx + i * cellW, y: o.y, w: 0, h: o.h, line: { color: HEX.fret, width: 1.75 } });
  slide.addShape(PRES.shapes.LINE, { x: bx, y: o.y, w: 0, h: o.h, line: { color: hasOpen ? HEX.nut : HEX.fret, width: hasOpen ? 5 : 1.75 } });
  // strings
  for (let s = 1; s <= 6; s++) slide.addShape(PRES.shapes.LINE, { x: hasOpen ? o.x + labelW + 0.04 : bx, y: sy(s), w: hasOpen ? bw + openW - 0.04 : bw, h: 0, line: { color: HEX.string, width: STRING_PT[s] } });
  // string names
  if (labelW) for (let s = 1; s <= 6; s++) slide.addText(T.stringName(s, o.tuning), { x: o.x, y: sy(s) - 0.13, w: labelW - 0.06, h: 0.26, fontSize: o.labelSize || 11, bold: true, color: t.muted, margin: 0, align: 'left', valign: 'middle', isTextBox: true });
  // fret numbers
  const fn = o.fretNumbers ?? 'all';
  if (fn) {
    const fy = o.y + o.h + 0.04;
    const showList = [];
    if (hasOpen && fn === 'all') showList.push(0);
    for (let f = first; f <= to; f++) if (fn === 'all' || INLAYS.includes(f) || DOUBLE.includes(f) || f === first) showList.push(f);
    for (const f of showList) {
      const isMark = INLAYS.includes(f) || DOUBLE.includes(f);
      slide.addText(String(f), { x: fx(f) - 0.25, y: fy, w: 0.5, h: 0.24, fontSize: o.fretNumSize || 10, color: isMark ? t.text : t.muted, bold: isMark, align: 'center', valign: 'top', margin: 0, isTextBox: true });
    }
  }
  // regions above the board
  for (const r of o.regions || []) {
    const row = r.row || 0;
    const ry = o.y - 0.12 - row * 0.36;
    const x1 = r.from === 0 && hasOpen ? o.x + labelW + 0.02 : bx + (Math.max(r.from, first) - first) * cellW + 0.03;
    const x2 = bx + (Math.min(r.to, to) - first + 1) * cellW - 0.03;
    const col = r.color || HEX.pearl;
    slide.addShape(PRES.shapes.LINE, { x: x1, y: ry, w: x2 - x1, h: 0, line: { color: col, width: 1.5 } });
    slide.addShape(PRES.shapes.LINE, { x: x1, y: ry, w: 0, h: 0.08, line: { color: col, width: 1.5 } });
    slide.addShape(PRES.shapes.LINE, { x: x2, y: ry, w: 0, h: 0.08, line: { color: col, width: 1.5 } });
    slide.addText(r.label, { x: x1, y: ry - 0.28, w: x2 - x1, h: 0.26, fontSize: r.fontSize || 11, bold: true, color: col, align: 'center', valign: 'bottom', margin: 0, isTextBox: true });
  }
  // links between dots (drawn under the dots)
  for (const l of o.links || []) {
    lineBetween(slide, fx(l.a.f), sy(l.a.s), fx(l.b.f), sy(l.b.s), { color: l.color || HEX.pearl, width: l.width || 2, dashType: l.dash || 'solid' });
  }
  // dots
  const baseD = o.dotSize || Math.min(cellW * 0.8, sp * 0.94, 0.52);
  for (const d of o.dots || []) {
    if (d.f < from || d.f > to) throw new Error(`Dot at fret ${d.f} outside board ${from}-${to} on "${o._title}"`);
    checkDot(d, o);
    const dd = d.small ? baseD * 0.72 : baseD;
    const role = d.role || 'note';
    const st = roleStyle(role);
    const label = d.label ?? '';
    const fsz = o.dotFont || Math.max(8, Math.min(16, dd * 72 * (label.length >= 3 ? 0.3 : label.length === 2 ? 0.36 : 0.44)));
    const ring = d.ring;
    slide.addText(label, {
      shape: PRES.shapes.OVAL, x: fx(d.f) - dd / 2, y: sy(d.s) - dd / 2, w: dd, h: dd,
      fill: ring || !st.fill ? { color: HEX.wood } : { color: st.fill },
      line: ring ? { color: st.fill || st.line, width: 2.25 } : (st.line ? { color: st.line, width: 1.5 } : { color: st.fill, width: 0 }),
      color: ring ? (role === 'note' || role === 'other' ? HEX.pearl : ROLE_HEX[role] || HEX.pearl) : st.text,
      bold: true, fontSize: fsz, fontFace: 'Arial', align: 'center', valign: 'middle', margin: 0,
    });
  }
  return { fx, sy, cellW, sp, bx, bw, labelW, openW };
}

// Build dots for a set of positions, labeled by interval or note name relative to root.
// opts: { root, label: 'interval'|'note'|'none', roleOf(semis) -> role, ring(pos) -> bool, tuning }
function dotsFor(positions, opts) {
  return positions.map((p) => {
    const s = T.semis(opts.root, T.pcAt(p.s, p.f, opts.tuning));
    const role = opts.roleOf ? opts.roleOf(s, p) : T.role(s);
    let label = '';
    if (opts.label === 'interval') label = T.INTERVAL[s];
    else if (opts.label === 'note') label = T.spellIn(opts.root, T.pcAt(p.s, p.f, opts.tuning));
    return { s: p.s, f: p.f, label, role, ring: opts.ring ? opts.ring(p, s) : false, small: opts.small ? opts.small(p, s) : false, noRoleCheck: !!opts.roleOf };
  });
}

// ---------- tab ----------
/**
 * Guitar tab. cols: array of strings like "6:5 5:7", "|" for a bar line, or "" for a rest column.
 * o: { x, y, w, gap=0.27, cols, check:{ root, scale:[semis], extra:[semis] }, fontSize, label, tuning }
 * Returns bottom y.
 */
function tab(slide, o) {
  const t = th(slide._light);
  const gap = o.gap || 0.27;
  const labelW = 0.3;
  const cols = o.cols;
  const colW = (o.w - labelW - 0.15) / cols.length;
  const sy = (s) => o.y + (s - 1) * gap;
  const bg = o.bg || (slide._light ? HEX.lightBg : HEX.bg);
  for (let s = 1; s <= 6; s++) {
    slide.addText(T.stringName(s, o.tuning), { x: o.x, y: sy(s) - 0.12, w: labelW - 0.05, h: 0.24, fontSize: 11, bold: true, color: t.muted, margin: 0, valign: 'middle', isTextBox: true });
    slide.addShape(PRES.shapes.LINE, { x: o.x + labelW, y: sy(s), w: o.w - labelW, h: 0, line: { color: slide._light ? '9CA3AF' : '6B6B75', width: 0.75 } });
  }
  slide.addShape(PRES.shapes.LINE, { x: o.x + labelW, y: sy(1), w: 0, h: gap * 5, line: { color: slide._light ? '9CA3AF' : '6B6B75', width: 1.5 } });
  slide.addShape(PRES.shapes.LINE, { x: o.x + o.w, y: sy(1), w: 0, h: gap * 5, line: { color: slide._light ? '9CA3AF' : '6B6B75', width: 1.5 } });
  const allowed = o.check ? new Set(T.pcsOf(o.check.root, [...o.check.scale, ...(o.check.extra || [])])) : null;
  cols.forEach((col, i) => {
    const cx = o.x + labelW + 0.08 + (i + 0.5) * colW;
    if (col === '|') {
      slide.addShape(PRES.shapes.LINE, { x: cx, y: sy(1), w: 0, h: gap * 5, line: { color: slide._light ? '9CA3AF' : '6B6B75', width: 1 } });
      return;
    }
    if (!col) return;
    for (const item of col.trim().split(/\s+/)) {
      const [sStr, tok] = item.split(':');
      const s = Number(sStr);
      if (!(s >= 1 && s <= 6) || tok === undefined) throw new Error(`Bad tab token "${item}"`);
      const nums = (tok.match(/\d+/g) || []).map(Number);
      VERIFY.tabNotes++;
      if (allowed) {
        for (const n of nums) {
          if (!allowed.has(T.pcAt(s, n, o.tuning))) throw new Error(`Tab note ${T.noteName(T.pcAt(s, n, o.tuning))} (string ${s} fret ${n}) not in allowed scale on "${slide._title}"`);
        }
        VERIFY.tabChecked++;
      }
      const tw = Math.max(0.22, tok.length * (o.fontSize || 13) * 0.0085 + 0.06);
      slide.addText(tok, { x: cx - tw / 2, y: sy(s) - 0.12, w: tw, h: 0.24, fontSize: o.fontSize || 13, bold: true, color: o.color || t.head, fill: { color: bg }, align: 'center', valign: 'middle', margin: 0, fontFace: 'Arial', isTextBox: true });
    }
  });
  if (o.counts) {
    o.counts.forEach((c, i) => {
      if (!c) return;
      const cx = o.x + labelW + 0.08 + (i + 0.5) * colW;
      slide.addText(c, { x: cx - 0.3, y: sy(6) + 0.16, w: 0.6, h: 0.22, fontSize: 10, color: t.muted, align: 'center', margin: 0, isTextBox: true });
    });
  }
  return sy(6) + (o.counts ? 0.42 : 0.15);
}

// ---------- rhythm grid ----------
const COUNTS = {
  1: () => [''],
  2: () => ['', '&'],
  3: () => ['', 'trip', 'let'],
  4: () => ['', 'e', '&', 'a'],
  6: () => ['', 'la', 'li', '&', 'la', 'li'],
};
/**
 * Rhythm grid (piano roll): time runs left to right, each beat is split into `sub` cells, counts sit underneath.
 * o: { x, y, w, beats=4, sub=4, beatsPerBar=4, rowH=0.42, labelW (auto),
 *      rows: [{ label, notes: [{ at, len=1, role='root', text, accent, ghost }] }],
 *      counts=true, countLabels: (beatIdx, subIdx) => string (optional override) }
 * `at` and `len` are measured in cells (0-based). A note's `text` is drawn inside it (e.g. 'D'/'U' pick strokes, 'x' mute).
 * Returns the bottom y of the drawing.
 */
function rhythm(slide, o) {
  const t = th(slide._light);
  const beats = o.beats || 4; const sub = o.sub || 4; const bpb = o.beatsPerBar || 4;
  const rows = o.rows || [];
  const labelW = o.labelW ?? (rows.some((r) => r.label) ? 1.15 : 0);
  const total = beats * sub;
  const gx = o.x + labelW; const gw = o.w - labelW;
  const cellW = gw / total;
  const rowH = o.rowH || 0.42; const gap = 0.12;
  const accentH = rows.some((r) => (r.notes || []).some((n) => n.accent)) ? 0.22 : 0;
  let y = o.y + accentH;
  rows.forEach((r, ri) => {
    const ry = y + ri * (rowH + gap);
    slide.addShape(PRES.shapes.RECTANGLE, { x: gx, y: ry, w: gw, h: rowH, fill: { color: t.card }, line: { color: t.card, width: 0 } });
    if (r.label) slide.addText(runs(r.label, { color: t.text, fontSize: 13, bold: true }), { x: o.x, y: ry, w: labelW - 0.1, h: rowH, margin: 0, valign: 'middle', isTextBox: true });
  });
  const gridH = rows.length * rowH + (rows.length - 1) * gap;
  // grid lines: subdivisions faint, beats medium, bars strong
  for (let i = 0; i <= total; i++) {
    const isBar = i % (sub * bpb) === 0; const isBeat = i % sub === 0;
    if (!isBeat && sub === 1) continue;
    slide.addShape(PRES.shapes.LINE, {
      x: gx + i * cellW, y, w: 0, h: gridH,
      line: { color: isBar ? (slide._light ? '71717A' : HEX.pearl) : isBeat ? (slide._light ? 'A1A1AA' : '6B6B75') : (slide._light ? 'E4E4E7' : '33333B'), width: isBar ? 1.75 : isBeat ? 1 : 0.5 },
    });
  }
  // notes
  rows.forEach((r, ri) => {
    const ry = y + ri * (rowH + gap);
    for (const n of r.notes || []) {
      const len = n.len || 1;
      if (n.at < 0 || n.at + len > total) throw new Error(`Rhythm note at ${n.at} len ${len} outside ${total} cells on "${slide._title}"`);
      const role = n.role || 'root';
      const st = roleStyle(role);
      const nx = gx + n.at * cellW + 0.03; const nw = len * cellW - 0.06; const nh = rowH * 0.62; const ny = ry + (rowH - nh) / 2;
      slide.addText(n.text || '', {
        shape: PRES.shapes.ROUNDED_RECTANGLE, rectRadius: Math.min(0.06, nh / 2), x: nx, y: ny, w: nw, h: nh,
        fill: n.ghost ? { color: t.card } : { color: st.fill }, line: n.ghost ? { color: ROLE_HEX[role] || HEX.pearl, width: 1.25, dashType: 'dash' } : { color: st.fill, width: 0 },
        color: n.ghost ? (ROLE_HEX[role] || HEX.pearl) : st.text, bold: true, fontSize: Math.min(12, Math.max(9, nh * 72 * 0.5)), align: 'center', valign: 'middle', margin: 0, fontFace: 'Arial',
      });
      if (n.accent && ri === 0) slide.addText('>', { x: nx, y: o.y, w: Math.max(0.3, cellW), h: 0.22, fontSize: 13, bold: true, color: t.accent, align: 'left', valign: 'bottom', margin: 0, isTextBox: true });
      else if (n.accent) slide.addText('>', { x: nx + nw - 0.16, y: ny - 0.02, w: 0.16, h: 0.18, fontSize: 11, bold: true, color: t.head, margin: 0, isTextBox: true });
    }
  });
  let bottom = y + gridH;
  if (o.counts !== false) {
    const fs = cellW < 0.33 ? 9 : cellW < 0.45 ? 10 : 11;
    for (let i = 0; i < total; i++) {
      const b = Math.floor(i / sub); const k = i % sub;
      let label = o.countLabels ? o.countLabels(b, k) : (k === 0 ? String((b % bpb) + 1) : (COUNTS[sub] || (() => []))()[k] || '');
      slide.addText(label, { x: gx + i * cellW, y: bottom + 0.05, w: cellW, h: 0.24, fontSize: fs, bold: k === 0, color: k === 0 ? t.head : t.muted, align: 'center', valign: 'top', margin: 0, isTextBox: true });
    }
    bottom += 0.32;
  }
  return bottom;
}

// ---------- slide templates ----------
// Section divider: big part number, title, subtitle, and an outcomes card on the right.
function divider(pres, { num, title, subtitle, outcomes, notes }) {
  const slide = pres.addSlide({ masterName: 'Section', sectionTitle: getSection() });
  slide._title = title;
  slide.addText(`PART ${num}`, { placeholder: 'kicker' });
  slide.addText(title, { placeholder: 'title' });
  // Title placeholder is 44pt Arial Black, 6.5" wide. Place the subtitle right under it.
  const lines = lineCount(title, 44, 6.5, { black: true });
  let y = 2.35 + lines * 0.74 + 0.3;
  if (subtitle) {
    const subLines = lineCount(subtitle, 18, 6.2);
    text(slide, subtitle, { x: M, y, w: 6.2, h: subLines * 0.33 + 0.1, fontSize: 18, color: HEX.muted });
    y += subLines * 0.33 + 0.45;
  }
  // motif: the five color-code dots
  ['root', 'third', 'fifth', 'seventh', 'blue'].forEach((r, i) => badge(slide, { x: M + i * 0.42, y, d: 0.28, label: '', role: r }));
  // outcomes card sized to its bullets (15pt in ~4.7" ≈ 42 characters per line)
  const bulletLines = outcomes.reduce((a, o) => a + lineCount(o, 15, 4.5), 0);
  const ch = Math.max(2.6, 0.44 + 0.52 + bulletLines * 0.27 + outcomes.length * 0.14 + 0.1);
  card(slide, {
    x: 7.55, y: 1.9, w: 5.18, h: ch, title: 'By the end of this part you can',
    bullets: outcomes, fontSize: 15, paraSpace: 10, titleColor: HEX.pearl,
  });
  if (notes) slide.addNotes(notes);
  return slide;
}

// "Practice this" slide: 2–4 drill cards with how / tempo / time / done-when.
function practice(pres, { kicker, title = 'Practice this', intro, drills, notes, light = false }) {
  const slide = content(pres, { kicker, title, light, notes });
  slide._title = title;
  let top = CONTENT_TOP;
  if (intro) { text(slide, intro, { x: M, y: top, w: 12.1, h: 0.45, fontSize: 16, color: th(light).muted }); top += 0.6; }
  const n = drills.length;
  const gap = 0.3;
  const w = (12.13 - gap * (n - 1)) / n;
  const h = CONTENT_BOTTOM - top;
  drills.forEach((d, i) => {
    const x = M + i * (w + gap);
    const fs = n >= 4 ? 14 : 15;
    const inner = card(slide, { x, y: top, w, h, title: d.name, badge: String(i + 1), badgeRole: d.role || ['root', 'third', 'fifth', 'seventh'][i % 4], titleSize: n >= 4 ? 15 : 16 });
    const t = th(light);
    const innerX = x + 0.22; const innerW = w - 0.44;
    const factsTop = top + h - 1.62;
    text(slide, d.how, { x: innerX, y: inner.innerY, w: innerW, h: factsTop - 0.15 - inner.innerY, fontSize: fs, paraSpace: 6 });
    // footer facts: one text box, one paragraph per fact, so wrapped lines push the next fact down
    const facts = [['Tempo', d.tempo], ['Time', d.time], ['Done when', d.done]].filter((f) => f[1]);
    slide.addShape(PRES.shapes.LINE, { x: innerX, y: factsTop - 0.08, w: innerW, h: 0, line: { color: t.line, width: 0.75 } });
    const factRuns = [];
    facts.forEach(([k, v], fi) => {
      factRuns.push({ text: `${k}  `, options: { bold: true, color: t.accent, fontSize: 12 } });
      factRuns.push({ text: v, options: { color: t.text, fontSize: 12, breakLine: fi < facts.length - 1, paraSpaceAfter: 5 } });
    });
    slide.addText(factRuns, { x: innerX, y: factsTop, w: innerW, h: 1.42, margin: 0, valign: 'top', isTextBox: true, lineSpacingMultiple: 1.0, paraSpaceAfter: 5 });
  });
  return slide;
}

// Convenience: create a content slide and remember its title for verification messages.
function slideOf(pres, opts) {
  const s = content(pres, opts);
  s._title = opts.title;
  return s;
}

module.exports = { init, VERIFY, textWidth, lineCount, rhythm, runs, text, bullets, card, badge, legend, table, fretboard, dotsFor, tab, divider, practice, slideOf, roleStyle, ROLE_HEX, ROLE_NAME, th, lineBetween };
