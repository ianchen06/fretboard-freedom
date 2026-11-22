// Helpers for the Theory Intensive deck: progression tiles, step ruler, circle of fifths, arrows,
// chord boards, and worksheets whose answers are collected into an answer key at the back of the deck.
const T = require('./theory');
const D = require('./draw');
const { HEX, M, CONTENT_TOP, CONTENT_BOTTOM, content, getSection } = require('./deck');

let PRES = null;
function init(pres) { PRES = pres; }
const FULL_W = 12.13;

// ---------- harmonic function color code ----------
// Progression tiles color the numeral by job: Tonic blue, Predominant amber, Dominant red, Secondary dominant teal, Borrowed purple.
const FN = {
  T: { role: 'fifth', name: 'Tonic' },
  PD: { role: 'third', name: 'Predominant' },
  D: { role: 'root', name: 'Dominant' },
  SD: { role: 'blue', name: 'Secondary dominant' },
  B: { role: 'seventh', name: 'Borrowed / chromatic' },
  X: { role: 'other', name: 'Other' },
};
function fnLegend(slide, { x, y, fns = ['T', 'PD', 'D'], fontSize = 12 }) {
  const names = {}; const roles = [];
  for (const f of fns) { roles.push(FN[f].role); names[FN[f].role] = FN[f].name; }
  return D.legend(slide, { x, y, roles, names, fontSize });
}

// ---------- arrows ----------
// Straight arrow from (x1,y1) to (x2,y2), head at the end.
function arrow(slide, x1, y1, x2, y2, { color = HEX.muted, width = 1.75, head = true, dash = 'solid', both = false } = {}) {
  slide.addShape(PRES.shapes.LINE, {
    x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1),
    flipH: x2 < x1, flipV: y2 < y1,
    line: { color, width, dashType: dash, endArrowType: head ? 'triangle' : undefined, beginArrowType: both ? 'triangle' : undefined },
  });
}

// ---------- tiles ----------
// Rounded tile with a big top line and a smaller colored bottom line (chord name over numeral, note over degree...).
function tile(slide, { x, y, w, h, top, bottom, sub, role, fill, topSize = 20, bottomSize = 14, subSize = 11, topColor, outline, light }) {
  const t = D.th(light ?? slide._light);
  slide.addShape(PRES.shapes.ROUNDED_RECTANGLE, {
    x, y, w, h, rectRadius: 0.08, fill: { color: fill || t.card },
    line: outline ? { color: D.ROLE_HEX[outline] || outline, width: 2 } : { color: fill || t.card, width: 0 },
  });
  const r = [{ text: top, options: { fontSize: topSize, bold: true, color: topColor || t.head, breakLine: !!(bottom || sub) } }];
  if (bottom) r.push({ text: bottom, options: { fontSize: bottomSize, bold: true, color: role ? D.ROLE_HEX[role] : t.accent, breakLine: !!sub } });
  if (sub) r.push({ text: sub, options: { fontSize: subSize, color: t.muted } });
  slide.addText(r, { x, y, w, h, margin: 2, align: 'center', valign: 'middle', isTextBox: true, lineSpacingMultiple: 1.0 });
}

/**
 * Row of chord tiles joined by small arrows.
 * o: { x, y, w, h=1.15, gap=0.34, chords: [{ name, numeral, fn:'T'|'PD'|'D'|'SD'|'B'|'X', sub }], arrows=true, topSize }
 * Returns { bottom, centers:[x...], tileW }.
 */
function progression(slide, o) {
  const n = o.chords.length;
  const gap = o.gap ?? 0.34;
  const h = o.h || 1.15;
  const tw = (o.w - gap * (n - 1)) / n;
  const centers = [];
  o.chords.forEach((c, i) => {
    const x = o.x + i * (tw + gap);
    centers.push(x + tw / 2);
    const topSize = o.topSize || (tw < 1.05 ? 16 : tw < 1.4 ? 18 : 20);
    tile(slide, { x, y: o.y, w: tw, h, top: c.name, bottom: c.numeral, sub: c.sub, role: c.fn ? FN[c.fn].role : undefined, topSize, bottomSize: o.bottomSize || 14, subSize: o.subSize || 11, outline: c.outline });
    if (o.arrows !== false && i < n - 1) {
      const ax = x + tw + 0.06; const ay = o.y + h / 2;
      arrow(slide, ax, ay, ax + gap - 0.12, ay, { color: HEX.faint, width: 1.25 });
    }
  });
  return { bottom: o.y + h, centers, tileW: tw };
}

// ---------- step ruler ----------
/**
 * A row of semitone cells from `from` to `to` (default 0–12) above a root. Marked cells are colored and labeled.
 * o: { x, y, w, h=0.62, root, from=0, to=12, marks:[{ semi, label, sub, role }], numbers=true (semitone count above),
 *      steps=true (W/H/step size below between consecutive marks), stepText: (diff) => string, unmarkedLabels=false }
 * Returns { cx(semi), bottom }.
 */
function ruler(slide, o) {
  const t = D.th(slide._light);
  const from = o.from ?? 0; const to = o.to ?? 12;
  const n = to - from + 1;
  const gap = 0.06;
  const cw = (o.w - gap * (n - 1)) / n;
  const h = o.h || 0.62;
  const cx = (s) => o.x + (s - from) * (cw + gap) + cw / 2;
  const marks = new Map((o.marks || []).map((m) => [m.semi, m]));
  let y = o.y;
  if (o.numbers !== false) {
    for (let s = from; s <= to; s++) slide.addText(String(s), { x: cx(s) - cw / 2, y, w: cw, h: 0.22, fontSize: 10, color: t.muted, align: 'center', margin: 0, isTextBox: true });
    y += 0.26;
  }
  for (let s = from; s <= to; s++) {
    const m = marks.get(s);
    const st = m ? D.roleStyle(m.role || 'other') : null;
    let label = m ? (m.label ?? '') : '';
    if (!m && o.unmarkedLabels && o.root) label = T.noteName(T.pc(o.root) + s);
    slide.addText(label, {
      shape: PRES.shapes.ROUNDED_RECTANGLE, rectRadius: 0.05, x: cx(s) - cw / 2, y, w: cw, h,
      fill: { color: m ? st.fill : t.card }, line: { color: m ? st.fill : t.card, width: 0 },
      color: m ? st.text : t.muted, bold: !!m, fontSize: o.fontSize || (cw < 0.6 ? 12 : 15), align: 'center', valign: 'middle', margin: 0, fontFace: 'Arial',
    });
  }
  y += h;
  const subs = (o.marks || []).filter((m) => m.sub);
  if (subs.length) {
    for (const m of subs) slide.addText(D.runs(m.sub, { color: t.head, fontSize: o.subSize || 12, bold: true }), { x: cx(m.semi) - cw / 2 - 0.1, y: y + 0.04, w: cw + 0.2, h: 0.24, align: 'center', margin: 0, isTextBox: true });
    y += 0.3;
  }
  if (o.steps !== false && (o.marks || []).length > 1) {
    const sorted = [...o.marks].sort((a, b) => a.semi - b.semi);
    const by = y + 0.08;
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i].semi; const b = sorted[i + 1].semi; const diff = b - a;
      const x1 = cx(a) + 0.08; const x2 = cx(b) - 0.08;
      const label = o.stepText ? o.stepText(diff, i) : ({ 1: 'H', 2: 'W', 3: 'W+H' }[diff] || String(diff));
      const col = diff === 1 ? HEX.root : t.muted;
      slide.addShape(PRES.shapes.LINE, { x: x1, y: by, w: x2 - x1, h: 0, line: { color: col, width: 1.25 } });
      slide.addShape(PRES.shapes.LINE, { x: x1, y: by - 0.06, w: 0, h: 0.06, line: { color: col, width: 1.25 } });
      slide.addShape(PRES.shapes.LINE, { x: x2, y: by - 0.06, w: 0, h: 0.06, line: { color: col, width: 1.25 } });
      slide.addText(label, { x: (x1 + x2) / 2 - 0.4, y: by + 0.02, w: 0.8, h: 0.22, fontSize: 11, bold: true, color: diff === 1 ? HEX.root : t.head, align: 'center', margin: 0, isTextBox: true });
    }
    y += 0.36;
  }
  return { cx, bottom: y, cellW: cw };
}

// Row of colored circles with a label inside and a caption under each (spelled notes over degrees).
function noteRow(slide, { x, y, d = 0.5, gap = 0.18, notes, subSize = 12, fontSize }) {
  const t = D.th(slide._light);
  notes.forEach((n, i) => {
    const nx = x + i * (d + gap);
    D.badge(slide, { x: nx, y, d, label: n.label, role: n.role || 'other', fontSize: fontSize || (String(n.label).length > 2 ? 12 : 15) });
    if (n.sub) slide.addText(D.runs(n.sub, { color: t.muted, fontSize: subSize, bold: true }), { x: nx - 0.15, y: y + d + 0.04, w: d + 0.3, h: 0.24, align: 'center', margin: 0, isTextBox: true });
  });
  return { right: x + notes.length * (d + gap) - gap, bottom: y + d + (notes.some((n) => n.sub) ? 0.3 : 0) };
}

// ---------- circle of fifths ----------
const CIRCLE_MAJOR = ['C', 'G', 'D', 'A', 'E', 'B', 'F♯', 'D♭', 'A♭', 'E♭', 'B♭', 'F'];
const CIRCLE_MINOR = ['Am', 'Em', 'Bm', 'F♯m', 'C♯m', 'G♯m', 'D♯m', 'B♭m', 'Fm', 'Cm', 'Gm', 'Dm'];
const CIRCLE_SIG = ['', '1♯', '2♯', '3♯', '4♯', '5♯', '6♯ / 6♭', '5♭', '4♭', '3♭', '2♭', '1♭'];
/**
 * o: { cx, cy, r=2.2 (major ring radius), rMinor=r*0.6, d=0.6, dMinor=0.5, sig=true,
 *      major: { 'C': role, ... } highlighted majors, minor: { 'Am': role } highlighted minors,
 *      majorLabels/minorLabels: { index: 'text' } overrides, spokes: [index] }
 * Returns { pos(i, ring) } with ring 'major'|'minor'|'sig'.
 */
function circleOfFifths(slide, o) {
  const t = D.th(slide._light);
  const r = o.r || 2.2; const rMin = o.rMinor || r * 0.6; const rSig = o.rSig || r + 0.55;
  const d = o.d || 0.62; const dm = o.dMinor || 0.5;
  const pos = (i, ring) => {
    const a = (-90 + i * 30) * Math.PI / 180;
    const rr = ring === 'minor' ? rMin : ring === 'sig' ? rSig : r;
    return { x: o.cx + rr * Math.cos(a), y: o.cy + rr * Math.sin(a) };
  };
  // guide rings
  slide.addShape(PRES.shapes.OVAL, { x: o.cx - r, y: o.cy - r, w: 2 * r, h: 2 * r, fill: { color: t.bg, transparency: 100 }, line: { color: t.line, width: 1 } });
  slide.addShape(PRES.shapes.OVAL, { x: o.cx - rMin, y: o.cy - rMin, w: 2 * rMin, h: 2 * rMin, fill: { color: t.bg, transparency: 100 }, line: { color: t.line, width: 0.75, dashType: 'dash' } });
  for (let i = 0; i < 12; i++) {
    const maj = (o.majorLabels && o.majorLabels[i]) || CIRCLE_MAJOR[i];
    const min = (o.minorLabels && o.minorLabels[i]) || CIRCLE_MINOR[i];
    const pM = pos(i, 'major'); const pm = pos(i, 'minor');
    const roleM = o.major && o.major[CIRCLE_MAJOR[i]];
    const rolem = o.minor && o.minor[CIRCLE_MINOR[i]];
    const stM = roleM ? D.roleStyle(roleM) : null; const stm = rolem ? D.roleStyle(rolem) : null;
    slide.addText(maj, { shape: PRES.shapes.OVAL, x: pM.x - d / 2, y: pM.y - d / 2, w: d, h: d, fill: { color: stM ? stM.fill : t.card2 }, line: { color: stM ? stM.fill : t.line, width: 0.75 }, color: stM ? stM.text : t.head, bold: true, fontSize: maj.length > 2 ? 12 : 16, align: 'center', valign: 'middle', margin: 0, fontFace: 'Arial' });
    slide.addText(min, { shape: PRES.shapes.OVAL, x: pm.x - dm / 2, y: pm.y - dm / 2, w: dm, h: dm, fill: { color: stm ? stm.fill : t.card }, line: { color: stm ? stm.fill : t.line, width: 0.5 }, color: stm ? stm.text : t.text, bold: true, fontSize: min.length > 3 ? 9 : min.length > 2 ? 10 : 12, align: 'center', valign: 'middle', margin: 0, fontFace: 'Arial' });
    if (o.sig !== false && CIRCLE_SIG[i]) {
      const ps = pos(i, 'sig');
      slide.addText(CIRCLE_SIG[i], { x: ps.x - 0.45, y: ps.y - 0.13, w: 0.9, h: 0.26, fontSize: 11, color: t.muted, bold: true, align: 'center', valign: 'middle', margin: 0, isTextBox: true });
    }
  }
  return { pos };
}

// ---------- chord boards ----------
// Dots for a fingering like 'x76777', labeled by interval from `root`.
// names: { semitones: label } overrides (e.g. { 2: '9' }); roles: { semitones: role } overrides (role check skipped).
function chordDots(root, fing, names = {}, roles = {}) {
  return T.fingering(fing).map((p) => {
    const sm = T.semis(root, T.pcAt(p.s, p.f));
    const role = roles[sm] ?? T.role(sm);
    return { s: p.s, f: p.f, label: names[sm] ?? T.INTERVAL[sm], role, noRoleCheck: roles[sm] !== undefined };
  });
}
const fingText = (fing) => (fing.includes('.') ? fing.split('.') : fing.split('')).join(' ');
// Chord name, small fretboard, fingering string underneath, optional caption. Returns the bottom y.
function chordBoard(s, o) {
  const t = D.th(s._light);
  const h = o.h || 1.9;
  s.addText([
    { text: o.name, options: { bold: true, color: t.head, fontSize: o.nameSize || 17 } },
    ...(o.sub ? [{ text: `   ${o.sub}`, options: { color: t.muted, fontSize: 12 } }] : []),
  ], { x: o.x, y: o.y, w: o.w, h: 0.34, margin: 0, valign: 'middle', isTextBox: true });
  D.fretboard(s, {
    x: o.x, y: o.y + 0.42, w: o.w, h, from: o.from ?? 0, to: o.to ?? 4, root: o.root, title: o.name,
    dots: o.dots || chordDots(o.root, o.fing, o.names, o.roles), dotSize: o.dotSize, fretNumbers: o.fretNumbers, links: o.links,
  });
  let y = o.y + 0.42 + h + 0.3;
  if (o.fing && o.showFing !== false) {
    s.addText([{ text: 'Frets  ', options: { color: t.muted, fontSize: 11 } }, { text: fingText(o.fing), options: { color: t.text, fontSize: 12, bold: true } }], { x: o.x + 0.3, y, w: o.w - 0.3, h: 0.24, margin: 0, isTextBox: true });
    y += 0.28;
  }
  if (o.caption) {
    const lines = D.lineCount(o.caption, 12, o.w - 0.3);
    D.text(s, o.caption, { x: o.x + 0.3, y, w: o.w - 0.3, h: lines * 0.22 + 0.06, fontSize: 12, color: t.muted });
    y += lines * 0.22 + 0.06;
  }
  return y;
}

// Small bold heading line in the accent color.
function heading(s, str, x, y, w, { size = 15 } = {}) {
  const t = D.th(s._light);
  s.addText(D.runs(str, { color: t.accent, fontSize: size, bold: true }), { x, y, w, h: 0.32, margin: 0, valign: 'middle', isTextBox: true });
}

// ---------- worksheets and the answer key ----------
const ANSWERS = []; // { part, partTitle, key, title, answers: [string] }
let QUESTION_COUNT = 0;

/**
 * Printable worksheet on a light slide. Questions are numbered per group (A1, A2…); answers go to the answer key.
 * o: { part: 1, partTitle, kicker, title='Exercises on paper', intro, notes,
 *      groups: [{ key:'A', title, instr, items: [[question, answer], ...], cols=1, fontSize=14 }],
 *      grid: 'row' (side by side, the default; set `weight` per group) | '2x2' }
 * Overflow is a build error: shorten questions or split the group.
 */
function worksheet(pres, o) {
  const s = content(pres, { kicker: o.kicker, title: o.title || 'Exercises on paper', light: true, notes: o.notes });
  s._title = o.title || 'Exercises on paper';
  const t = D.th(true);
  let top = CONTENT_TOP;
  if (o.intro) { D.text(s, o.intro, { x: M, y: top - 0.05, w: FULL_W, h: 0.4, fontSize: 14, color: t.muted }); top += 0.45; }
  const n = o.groups.length;
  const grid = o.grid || 'row';
  const gap = 0.3;
  const boxes = [];
  if (grid === '2x2') {
    const w = (FULL_W - gap) / 2; const h = (CONTENT_BOTTOM - top - gap) / 2;
    for (let i = 0; i < n; i++) boxes.push({ x: M + (i % 2) * (w + gap), y: top + Math.floor(i / 2) * (h + gap), w, h });
  } else {
    const weights = o.groups.map((g) => g.weight || 1);
    const tot = weights.reduce((a, b) => a + b, 0);
    let x = M;
    for (let i = 0; i < n; i++) {
      const w = (FULL_W - gap * (n - 1)) * weights[i] / tot;
      boxes.push({ x, y: top, w, h: CONTENT_BOTTOM - top });
      x += w + gap;
    }
  }
  o.groups.forEach((g, gi) => {
    const b = boxes[gi];
    const pad = 0.22;
    s.addShape(PRES.shapes.ROUNDED_RECTANGLE, { x: b.x, y: b.y, w: b.w, h: b.h, rectRadius: 0.1, fill: { color: t.card }, line: { color: t.card, width: 0 } });
    D.badge(s, { x: b.x + pad, y: b.y + pad, d: 0.4, label: g.key, role: g.role || ['root', 'third', 'fifth', 'seventh'][gi % 4] });
    const tw = b.w - pad * 2 - 0.52;
    const titleLines = D.lineCount(g.title, 16, tw, { bold: true });
    const titleH = Math.max(0.4, titleLines * 0.27 + 0.04);
    s.addText(D.runs(g.title, { color: t.head, fontSize: 16, bold: true }), { x: b.x + pad + 0.52, y: b.y + pad, w: tw, h: titleH, margin: 0, valign: titleLines === 1 ? 'middle' : 'top', isTextBox: true });
    let y = b.y + pad + titleH + 0.1;
    const iw = b.w - pad * 2;
    if (g.instr) {
      const il = D.lineCount(g.instr, 12, iw);
      D.text(s, g.instr, { x: b.x + pad, y, w: iw, h: il * 0.21 + 0.04, fontSize: 12, color: t.muted });
      y += il * 0.21 + 0.14;
    }
    const cols = g.cols || 1;
    const fs = g.fontSize || 14;
    const colGap = 0.2;
    const cw = (iw - colGap * (cols - 1)) / cols;
    const items = g.items;
    const rows = Math.ceil(items.length / cols);
    // Each row is as tall as its tallest item (items wrap within the column).
    const lineH = fs * 1.22 / 72;
    const numW = 0.42;
    const rowLines = [];
    for (let r = 0; r < rows; r++) {
      let mx = 1;
      for (let c = 0; c < cols; c++) {
        const it = items[c * rows + r];
        if (it) mx = Math.max(mx, D.lineCount(it[0], fs, cw - numW));
      }
      rowLines.push(mx);
    }
    const rowGap = g.rowGap ?? 0.1;
    const need = rowLines.reduce((a, l) => a + l * lineH + rowGap, 0) - rowGap;
    const avail = b.y + b.h - pad - y;
    if (need > avail + 0.01) throw new Error(`Worksheet group ${o.part}${g.key} "${g.title}" overflows: needs ${need.toFixed(2)}" of ${avail.toFixed(2)}"`);
    // spread rows to use the space (but not too far apart)
    const extra = Math.min(0.22, (avail - need) / Math.max(1, rows));
    let ry = y;
    const answers = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = c * rows + r;
        const it = items[idx];
        if (!it) continue;
        const ix = b.x + pad + c * (cw + colGap);
        s.addText(`${g.key}${idx + 1}`, { x: ix, y: ry, w: numW, h: lineH, fontSize: fs - 2, bold: true, color: D.ROLE_HEX[g.role || ['root', 'third', 'fifth', 'seventh'][gi % 4]] === HEX.third ? '8A6D3B' : D.ROLE_HEX[g.role || ['root', 'third', 'fifth', 'seventh'][gi % 4]], margin: 0, valign: 'top', isTextBox: true });
        D.text(s, it[0], { x: ix + numW, y: ry, w: cw - numW, h: rowLines[r] * lineH + 0.02, fontSize: fs });
      }
      ry += rowLines[r] * lineH + rowGap + extra;
    }
    items.forEach((it, i) => { if (it[1] === undefined || it[1] === '') throw new Error(`Missing answer ${o.part}${g.key}${i + 1}`); answers.push(String(it[1])); });
    QUESTION_COUNT += items.length;
    ANSWERS.push({ part: o.part, partTitle: o.partTitle || getSection(), key: g.key, title: g.title, answers });
  });
  return s;
}

// Answer key slides (light, printable), two columns, as many slides as needed.
function answerKey(pres, { kicker = 'Answer key', notes } = {}) {
  const colW = (FULL_W - 0.4) / 2;
  const fs = 12; const lineH = fs * 1.25 / 72;
  // Build blocks: part headers and group paragraphs, each with a measured height.
  const blocks = [];
  let lastPart = null;
  for (const g of ANSWERS) {
    const partLabel = `Part ${g.part} · ${g.partTitle}`;
    if (g.part !== lastPart) { blocks.push({ kind: 'part', text: partLabel, h: 0.38 }); lastPart = g.part; }
    const body = g.answers.map((a, i) => `**${g.key}${i + 1}** ${a}`).join('   ');
    const head = `**${g.key} · ${g.title}**`;
    // lineCount collapses runs of spaces, so stand in visible characters for the 3-space gaps between answers
    const lines = D.lineCount(body.replace(/   /g, ' ,, '), fs, colW - 0.15, { bold: true }) + D.lineCount(head, fs, colW - 0.05, { bold: true });
    blocks.push({ kind: 'group', head, body, partLabel, h: lines * lineH + 0.14 });
  }
  let slide = null; let col = 0; let y = 0; let page = 0;
  const newSlide = () => {
    page++;
    slide = content(pres, { kicker, title: page === 1 ? 'Answer key' : `Answer key (${page})`, light: true, notes: page === 1 ? notes : 'Answer key, continued. Check your work one group at a time and redo any group where you missed more than one.' });
    slide._title = 'Answer key';
    col = 0; y = CONTENT_TOP;
  };
  newSlide();
  const t = D.th(true);
  const partHeader = (label, x) => {
    slide.addText(label, { x, y, w: colW, h: 0.3, fontSize: 14, bold: true, color: t.head, margin: 0, valign: 'middle', isTextBox: true });
    slide.addShape(PRES.shapes.LINE, { x, y: y + 0.32, w: colW, h: 0, line: { color: HEX.lightLine, width: 0.75 } });
  };
  blocks.forEach((b, bi) => {
    // keep a part header with its first group
    const needH = b.kind === 'part' && blocks[bi + 1] ? b.h + blocks[bi + 1].h : b.h;
    if (y + needH > CONTENT_BOTTOM) {
      if (col === 0) { col = 1; y = CONTENT_TOP; } else newSlide();
      // a part that continues from the previous column gets its header again
      if (b.kind === 'group') { partHeader(`${b.partLabel} (cont.)`, M + col * (colW + 0.4)); y += 0.38; }
    }
    const x = M + col * (colW + 0.4);
    if (b.kind === 'part') {
      partHeader(b.text, x);
    } else {
      const r = D.runs(b.head, { color: t.head, fontSize: fs });
      r[r.length - 1].options.breakLine = true;
      slide.addText([...r, ...D.runs(b.body, { color: t.text, fontSize: fs })], { x, y, w: colW, h: b.h - 0.06, margin: 0, valign: 'top', isTextBox: true, lineSpacingMultiple: 1.0 });
    }
    y += b.h;
  });
  return page;
}

module.exports = {
  init, FN, FULL_W, fnLegend, arrow, tile, progression, ruler, noteRow, circleOfFifths, CIRCLE_MAJOR, CIRCLE_MINOR, CIRCLE_SIG,
  chordDots, chordBoard, fingText, heading, worksheet, answerKey, ANSWERS, questionCount: () => QUESTION_COUNT,
};
