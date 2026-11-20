// Level 2 · Part 7 · Songs, harmony and your plan (slides 70–80)
const T = require('../lib/theory');
const D = require('../lib/draw');
const { HEX, M, CONTENT_TOP, section } = require('../lib/deck');

const KICK = '7 · Songs, harmony and your plan';
const SHEET = 'Cheat sheet';
const FULL_W = 12.13;

// ---------- local helpers ----------
function assert(cond, msg) { if (!cond) throw new Error(`l2_s7_songs: ${msg}`); }

function sub(slide, str, x, y, w, size = 14) {
  slide.addText(D.runs(str, { color: slide._light ? HEX.lightText : HEX.pearl, fontSize: size, bold: true }), { x, y, w, h: 0.3, margin: 0, valign: 'middle', isTextBox: true });
}

function caption(slide, str, x, y, w, h = 0.3, size = 12) {
  slide.addText(D.runs(str, { color: slide._light ? HEX.lightMuted : HEX.muted, fontSize: size }), { x, y, w, h, margin: 0, valign: 'top', isTextBox: true });
}

// Printable / light table with visible borders; cells accept the deck's rich markup.
function lightTable(slide, rows, { x, y, w, colW, rowH, fontSize = 13, align = [], boldFirstCol = true }) {
  const data = rows.map((row, ri) => row.map((cell, ci) => ({
    text: D.runs(String(cell), { color: '18181B', fontSize: ri === 0 ? fontSize - 1 : fontSize, bold: ri === 0 || (boldFirstCol && ci === 0) }),
    options: {
      fill: { color: ri === 0 ? 'E4E4E7' : (ri % 2 ? 'FFFFFF' : 'F7F7F8') },
      align: align[ci] || 'left', valign: 'middle', margin: [3, 6, 3, 6], border: { type: 'solid', color: 'A1A1AA', pt: 0.75 },
    },
  })));
  slide.addTable(data, { x, y, w, colW, rowH, fontFace: 'Arial', autoPage: false });
}

function checkbox(pres, slide, x, y, label, w = 2.6) {
  slide.addShape(pres.shapes.RECTANGLE, { x, y: y + 0.04, w: 0.24, h: 0.24, fill: { color: 'FFFFFF' }, line: { color: '52525B', width: 1.25 } });
  slide.addText(label, { x: x + 0.38, y: y - 0.04, w, h: 0.55, fontSize: 14, color: HEX.lightText, valign: 'top', margin: 0, isTextBox: true });
}

// Rounded chord tile: big numeral on top, chord name below.
function tile(pres, slide, { x, y, w, h, top, bottom, fill, topColor, bottomColor, outline, topSize = 15, bottomSize = 15 }) {
  const t = D.th(slide._light);
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.08, fill: { color: fill || t.card2 }, line: outline ? { color: outline, width: 1.75 } : { color: fill || t.card2, width: 0 } });
  slide.addText(top, { x, y: y + 0.06, w, h: h * 0.45, fontSize: topSize, bold: true, color: topColor || t.accent, align: 'center', valign: 'middle', margin: 0, isTextBox: true });
  slide.addText(bottom, { x, y: y + h * 0.48, w, h: h * 0.45, fontSize: bottomSize, bold: true, color: bottomColor || t.head, align: 'center', valign: 'middle', margin: 0, isTextBox: true });
}

// Nashville number → chord name in a major key. Supports '1', '6m', '4/6', '57'.
function nashville(num, key) {
  const m = num.match(/^([1-7])(m|-)?(7)?(?:\/([1-7]))?$/);
  assert(m, `bad Nashville number ${num}`);
  const chords = T.harmonize(key);
  const c = chords[Number(m[1]) - 1];
  if (m[2]) assert(c.quality === 'min', `${num} written minor but degree ${m[1]} is ${c.quality} in ${key}`);
  else assert(c.quality !== 'min', `${num} written major but degree ${m[1]} is minor in ${key}`);
  let name = c.rootName + (c.quality === 'min' ? 'm' : c.quality === 'dim' ? '°' : '') + (m[3] ? '7' : '');
  if (m[4]) name += `/${chords[Number(m[4]) - 1].rootName}`;
  return name;
}

// Scale position k of A natural minor: pentatonic box k + B (2) and F (♭6), each extra note placed between the
// box notes it sits between, on whichever string keeps it inside (or closest to) the box's fret window.
function scalePosition(k, lower = false) {
  const box = T.pentBox('A', k).map((p) => ({ s: p.s, f: p.f - (lower ? 12 : 0) }));
  const lo = Math.min(...box.map((p) => p.f)); const hi = Math.max(...box.map((p) => p.f));
  const withMidi = box.map((p) => ({ ...p, m: T.midi(p.s, p.f) })).sort((a, b) => a.m - b.m);
  const extras = new Set(T.pcsOf('A', [2, 8]));
  const out = [...box];
  for (let i = 0; i < withMidi.length - 1; i++) {
    const a = withMidi[i]; const b = withMidi[i + 1];
    for (let q = a.m + 1; q < b.m; q++) {
      if (!extras.has(T.mod12(q))) continue;
      const cands = [{ s: a.s, f: q - T.OPEN_MIDI[a.s] }];
      if (b.s !== a.s) cands.push({ s: b.s, f: q - T.OPEN_MIDI[b.s] });
      const dist = (c) => (c.f < lo ? lo - c.f : c.f > hi ? c.f - hi : 0);
      cands.sort((c1, c2) => dist(c1) - dist(c2) || (dist(c1) === 0 ? 0 : c2.s === b.s ? 1 : -1));
      const inside = cands.filter((c) => dist(c) === 0);
      out.push(inside.length ? inside[0] : cands.filter((c) => dist(c) === Math.min(...cands.map(dist))).sort((c1, c2) => c1.s - c2.s)[0]);
    }
  }
  return out;
}

// Degree-spelled formula for a 7-note mode, e.g. Lydian -> R 2 3 ♯4 5 6 7.
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
function modeFormula(ivs) {
  return ivs.map((iv, d) => {
    if (d === 0) return 'R';
    const diff = iv - MAJOR[d];
    return (diff < 0 ? '♭'.repeat(-diff) : '♯'.repeat(diff)) + (d + 1);
  });
}

// Semitones for a chord-formula label (R, 3, ♭3, ♭5, ♯5, ♭7, ♭♭7, 9, ♯9, 13…).
const DEG = { 1: 0, 2: 2, 3: 4, 4: 5, 5: 7, 6: 9, 7: 11, 9: 2, 11: 5, 13: 9 };
function labelSemis(l) {
  if (l === 'R') return 0;
  const m = l.match(/^([♭♯]*)(\d+)$/);
  let acc = 0; for (const ch of m[1]) acc += ch === '♯' ? 1 : -1;
  return T.mod12(DEG[Number(m[2])] + acc);
}
const DEG_NUM = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 9: 2, 11: 4, 13: 6 };
function spellChord(root, labels) {
  return labels.map((l) => {
    if (l === 'R') return root;
    const n = Number(l.match(/(\d+)$/)[1]);
    return T.spellIn(root, T.mod12(T.pc(root) + labelSemis(l)), DEG_NUM[n]);
  });
}

function noteWithOctave(m, flat) { return `${(flat ? T.FLAT : T.SHARP)[T.mod12(m)]}${Math.floor(m / 12) - 1}`; }

// ---------- slides ----------
function build(pres) {
  section(pres, 'Songs, harmony and your plan');

  // 70 · Divider
  {
    const title = 'Songs, harmony and your plan';
    assert(D.lineCount(title, 44, 6.5, { black: true }) <= 2, 'divider title must fit 2 lines');
    D.divider(pres, {
      num: 7, title,
      subtitle: 'Real songs have sections, charts and the occasional surprise chord. Learn to read the map, then follow the plan.',
      outcomes: [
        'Hear and count song sections: verse, chorus, bridge, solo',
        'Read and write a Nashville number chart in any key',
        'Recognize borrowed chords and secondary dominants',
        'Follow a key change without losing your place',
        'Run a 12-week Level 2 plan with a weekly log',
      ],
      notes: `Part 7: songs, harmony and your plan.

Parts 1 to 6 gave you the tools: rhythm, the full scale and modes, chord tones everywhere, a bigger chord vocabulary, trained ears and new tunings. This part puts them inside real songs, then gives you a schedule for the next three months.

What's in this part:
• Song form. Songs are built from sections (intro, verse, chorus, bridge, solo, outro), and those sections almost always come in groups of 4 or 8 bars. If you can count bars and hear the signposts, you never get lost in a jam or a gig.
• The Nashville number system. Studio and live players write chord charts as numbers (1, 4, 5, 6m) instead of chord names, so one chart works in every key. If you understood Roman numerals in Level 1, you already understand this. It's the same idea in a quicker shorthand.
• Borrowed chords and secondary dominants. These are the two most common "outside" chords in rock and pop: chords borrowed from the parallel minor key (♭VI, ♭VII, iv) and dominant 7th chords that point at a chord other than the 1. Knowing them tells you exactly which notes change when you solo.
• Key changes. How songs move to a new key, and how to follow along.
• The plan: a 12-week roadmap, a printable weekly log and three cheat sheets to keep on your music stand.

Level 2 is a lot of material. The roadmap spreads it out so that every week has a clear focus and a testable milestone.`,
    });
  }

  // 71 · Song form
  {
    const s = D.slideOf(pres, {
      kicker: KICK, title: 'Song form: the map of a song',
      notes: `Every song is a sequence of sections, and those sections are nearly always 4, 8, 12 or 16 bars long. Knowing the form is what lets you jam on a song you've never heard: you count bars, you listen for the signposts, and you always know where you are.

The three strips:
1. A typical rock or pop form: intro, verse, pre-chorus, chorus, then the same again, then a bridge and a solo before the last chorus and an outro. The width of each block is its length in bars. Notice how predictable it is: blocks of 4 and 8.
2. AABA, the 32-bar form behind many older pop songs and standards: three 8-bar A sections with the same melody, and one contrasting B section (the bridge or "middle eight").
3. The 12-bar blues: the "verse" and the "chorus" are the same 12-bar cycle, repeated. Solos are counted in choruses: "take two" means two times through the 12 bars.

Counting tips:
• Count bars, not beats, once you're settled: "ONE two three four, TWO two three four, THREE two three four…" The big number is the bar number.
• Most sections are 8 bars, so count in groups of 4 and expect the change after the second group.
• Listen for signposts. Drummers play a fill in the last bar of a section and hit a crash cymbal on beat 1 of the new one. The bass often walks up or down into the new section.

Endings come in three flavors: a tag (repeat the last line two or three times), a ring-out (everyone holds the last chord), and a cold stop (everyone stops dead on a hit). Agree on which one before the song starts, or watch the leader.`,
    });
    const strips = [
      { label: 'Typical rock or pop song', parts: [['Intro', 4, 'other'], ['Verse', 8, 'fifth'], ['Pre', 4, 'blue'], ['Chorus', 8, 'root'], ['Verse', 8, 'fifth'], ['Pre', 4, 'blue'], ['Chorus', 8, 'root'], ['Bridge', 8, 'seventh'], ['Solo', 8, 'third'], ['Chorus', 8, 'root'], ['Outro', 4, 'other']] },
      { label: 'AABA (32-bar form)', parts: [['A', 8, 'fifth'], ['A', 8, 'fifth'], ['B (bridge)', 8, 'seventh'], ['A', 8, 'fifth']] },
      { label: '12-bar blues: count in choruses', parts: [['Head · 12', 12, 'root'], ['Solo chorus 1 · 12', 12, 'third'], ['Solo chorus 2 · 12', 12, 'third'], ['Head · 12', 12, 'root']] },
    ];
    let y = CONTENT_TOP + 0.02;
    for (const st of strips) {
      const bars = st.parts.reduce((a, p) => a + p[1], 0);
      sub(s, `${st.label} · ${bars} bars`, M, y, 8, 14);
      y += 0.36;
      const unit = FULL_W / bars;
      let x = M;
      for (const [name, n, role] of st.parts) {
        const w = n * unit;
        const rs = D.roleStyle(role);
        s.addShape(pres.shapes.RECTANGLE, { x, y, w: w - 0.04, h: 0.5, fill: { color: rs.fill }, line: { color: rs.fill, width: 0 } });
        const lab = D.textWidth(`${name} ${n}`, 11, { bold: true }) < w - 0.1 && !name.includes('·') ? `${name} ${n}` : name;
        s.addText(lab, { x: x + 0.03, y, w: w - 0.1, h: 0.5, fontSize: 11, bold: true, color: rs.text, align: 'center', valign: 'middle', margin: 0, isTextBox: true });
        x += w;
      }
      y += 0.72;
    }
    const cw = (FULL_W - 0.6) / 3; const cy = y + 0.1; const ch = 6.85 - cy;
    D.card(s, { x: M, y: cy, w: cw, h: ch, title: 'Count in 4s and 8s', badge: '1', badgeRole: 'root', body: 'Say the **bar number** on each beat 1. Expect a change every **8 bars**, sometimes 4.', fontSize: 14 });
    D.card(s, { x: M + cw + 0.3, y: cy, w: cw, h: ch, title: 'Listen for signposts', badge: '2', badgeRole: 'third', body: 'A **drum fill** ends a section; a **crash** on 1 starts the next. The bass walks into changes.', fontSize: 14 });
    D.card(s, { x: M + 2 * (cw + 0.3), y: cy, w: cw, h: ch, title: 'Know the ending', badge: '3', badgeRole: 'fifth', body: '**Tag** (repeat the last line), **ring-out** (hold the last chord) or **cold stop**. Agree first.', fontSize: 14 });
  }

  // 72 · Nashville number system
  {
    const s = D.slideOf(pres, {
      kicker: KICK, title: 'The Nashville number system',
      notes: `The Nashville number system writes chords as scale-degree numbers instead of names. It's Roman numerals in shorthand: 1 is the key chord, 4 is the IV, 5 is the V, 6m (or 6-) is the vi. Because the numbers are relative to the key, one chart works in any key. If the singer wants the song in E instead of A, nobody rewrites anything: the band just thinks in E.

The chart on the left is written once, in numbers. Under every number are the actual chords in A and in E, so you can check the translation:
• 1 = A (or E), 4 = D (or A), 5 = E (or B), 6m = F♯m (or C♯m).
• 4/6 is a slash chord: the 4 chord with the 6th scale degree in the bass. In A that's D/F♯, and in E it's A/C♯. Slash numbers tell the bass player (and you) which note is on the bottom.

The symbols, on the right:
• Each box is one bar. A number alone fills the whole bar.
• Two numbers underlined together share one bar (usually two beats each), like "6m 5" in the verse.
• A diamond around a number means hit it once and let it ring for the whole bar.
• A caret (^) or "<" before a number is a push: the chord arrives an 8th note early, on the "&" of the previous beat 4. Pushes are where most bands fall apart, so watch for them. Symbols vary between chart writers (some use ^ for a choke), so agree on them with your band.
• A 7 after a number adds the 7th: 57 is E7 in A.

How to practice: take three songs you know, work out the key, and write each one as a number chart. Then play each chart in two other keys. After a few weeks you'll start hearing songs as numbers, which is exactly what makes jamming on unfamiliar songs easy.`,
    });
    const chart = [
      { label: 'Intro', bars: [['◇1'], ['◇1'], ['4'], ['5']] },
      { label: 'Verse', bars: [['1'], ['4'], ['6m'], ['5']] },
      { label: '', bars: [['1'], ['4'], ['6m', '5'], ['1']] },
      { label: 'Chorus', bars: [['4'], ['4/6'], ['5'], ['5']] },
      { label: '', bars: [['6m'], ['4'], ['^5'], ['1']] },
    ];
    const labelW = 1.0; const cellW = 1.72; const rowH = 0.74; const x0 = M; let y = CONTENT_TOP + 0.05;
    for (const row of chart) {
      if (row.label) s.addText(row.label, { x: x0, y, w: labelW - 0.1, h: rowH, fontSize: 14, bold: true, color: HEX.pearl, margin: 0, valign: 'middle', isTextBox: true });
      row.bars.forEach((bar, bi) => {
        const cx = x0 + labelW + bi * cellW;
        s.addShape(pres.shapes.RECTANGLE, { x: cx, y, w: cellW, h: rowH, fill: { color: HEX.card }, line: { color: '3F3F46', width: 1 } });
        const plain = bar.map((n) => n.replace(/^[◇^]/, ''));
        const inA = plain.map((n) => nashville(n, 'A')).join(' ');
        const inE = plain.map((n) => nashville(n, 'E')).join(' ');
        const shown = bar.map((n) => n.replace(/^◇/, '')).join('  ');
        if (bar[0].startsWith('◇')) {
          s.addShape(pres.shapes.DIAMOND, { x: cx + cellW / 2 - 0.27, y: y + 0.03, w: 0.54, h: 0.46, fill: { color: HEX.card }, line: { color: HEX.pearl, width: 1.5 } });
        }
        s.addText(shown, { x: cx, y: y + 0.03, w: cellW, h: 0.46, fontSize: 18, bold: true, color: HEX.white, align: 'center', valign: 'middle', margin: 0, isTextBox: true });
        if (bar.length > 1) {
          const tw = D.textWidth(shown, 18, { bold: true });
          s.addShape(pres.shapes.LINE, { x: cx + cellW / 2 - tw / 2, y: y + 0.45, w: tw, h: 0, line: { color: HEX.pearl, width: 1.5 } });
        }
        s.addText(`A: ${inA}   E: ${inE}`, { x: cx + 0.04, y: y + 0.48, w: cellW - 0.08, h: 0.24, fontSize: 11, color: HEX.muted, align: 'center', valign: 'middle', margin: 0, isTextBox: true });
      });
      y += rowH + 0.06;
    }
    caption(s, 'One chart, any key. Each bar shows the number, then the chord in A and in E.', x0, y + 0.05, 8.0, 0.3, 12);
    D.card(s, {
      x: 9.0, y: CONTENT_TOP + 0.05, w: 3.73, h: 5.25, title: 'Reading the symbols', titleColor: HEX.pearl,
      bullets: [
        '**1 4 5** = the I, IV and V chords of the key',
        '**6m** or **6-** = minor chord on degree 6',
        '**4/6** = 4 chord over the 6th in the bass',
        '**Underlined pair** = two chords share a bar',
        '**Diamond** = hit once, let it ring',
        '**^5** or **<5** = push: lands an 8th early',
        '**57** = add the 7th (E7 in A)',
      ],
      fontSize: 14, paraSpace: 8,
    });
  }

  // 73 · Borrowed chords and secondary dominants
  {
    const s = D.slideOf(pres, {
      kicker: KICK, title: 'Borrowed chords and secondary dominants',
      notes: `Most rock and pop songs stay inside the 7 chords of the key, but two kinds of "outside" chord show up constantly. Both are easy to handle once you know which note has changed.

1. Borrowed chords (modal interchange). A song in A major borrows chords from A minor, the parallel minor key that shares the same root. The common borrowed chords are ♭VII (G), ♭VI (F), iv (Dm) and ♭III (C). You've heard them everywhere: I–♭VII–IV (A–G–D) is classic rock, and I–♭VI–♭VII–I (A–F–G–A) is the big heroic rock cadence.
How to solo over them: the borrowed chord brings notes from A minor into the song. Over G and C, use G natural, not G♯. Over F and Dm, use F and C natural, not F♯ and C♯. A minor pentatonic (A C D E G) covers all of them, which is one reason it works so well over classic rock.

2. Secondary dominants. A dominant 7th chord that resolves to a chord other than the 1. "V of V" (written V/V) is the V7 chord of the key's V chord: in A major, the V is E, and E's V7 is B7. Each diatonic chord from ii to vi can have its own secondary dominant (table, top right).
What they do: most secondary dominants bring in one note from outside the key, their 3rd, which sits a half step below the root of the chord they resolve to. B7 contains D♯, which leans up into E. C♯7 contains E♯ (the same pitch as F), which leans up into F♯m. Two exceptions: V/IV (A7) is the home chord with a ♭7 added, so its outside note is G, which falls a half step to F♯, the 3rd of D. V/iii (G♯7) has two outside notes, B♯ and D♯.
How to solo over them: target the outside note. Over B7, play D♯ instead of D. The diagram shows B7 as an E-shape barre at fret 7. Its 3rd, D♯ on the G string at fret 8, is the note that isn't in A major. Land on it and resolve up a half step into the next chord.`,
    });
    const home = T.harmonize('A');
    const minor = T.harmonize('A', 'minor');
    const borrowed = minor.filter((c) => ['♭III', 'iv', '♭VI', '♭VII'].includes(c.numeral));
    assert(borrowed.map((c) => c.name).join(',') === 'C,Dm,F,G', `borrowed chords ${borrowed.map((c) => c.name)}`);
    sub(s, 'A major: the 7 home chords', M, CONTENT_TOP, 7);
    const tw = 0.92; const tg = 0.1;
    home.forEach((c, i) => tile(pres, s, { x: M + i * (tw + tg), y: CONTENT_TOP + 0.38, w: tw, h: 0.85, top: c.numeral, bottom: c.name }));
    sub(s, 'Borrowed from A minor', M, CONTENT_TOP + 1.45, 7);
    borrowed.forEach((c, i) => tile(pres, s, { x: M + i * (tw + tg), y: CONTENT_TOP + 1.83, w: tw, h: 0.85, top: c.numeral, bottom: c.name, outline: HEX.blue, topColor: HEX.blue }));
    caption(s, 'Common moves: **I–♭VII–IV** (A–G–D) and **I–♭VI–♭VII–I** (A–F–G–A).', M + 4 * (tw + tg) + 0.1, CONTENT_TOP + 1.95, 2.75, 0.75, 12);
    D.card(s, {
      x: M, y: CONTENT_TOP + 2.95, w: 6.94, h: 6.85 - (CONTENT_TOP + 2.95), title: 'Soloing over the outside chords',
      bullets: [
        'Over **G, F, C, Dm**: use the A minor notes (G, F, C natural). **A minor pentatonic** covers them all.',
        'Over a **secondary dominant**: aim at its outside note (usually the 3rd), then resolve by a half step.',
      ],
      fontSize: 14, paraSpace: 8,
    });
    // secondary dominants table
    const rx = 7.9; const rw = 4.83;
    sub(s, 'Secondary dominants: V7 of another chord', rx, CONTENT_TOP, rw);
    const rows = [['Symbol', 'Goes to', 'Chord', 'Outside notes']];
    const keyPcs = new Set(T.pcsOf('A', T.SCALES.major));
    const outsideBy = {};
    for (const [deg, sym] of [[2, 'V/ii'], [3, 'V/iii'], [4, 'V/IV'], [5, 'V/V'], [6, 'V/vi']]) {
      const target = home[deg - 1];
      const root = T.spellIn(target.rootName, T.mod12(T.pc(target.rootName) + 7), 5);
      const tones = spellChord(root, ['R', '3', '5', '♭7']);
      const outside = tones.map((n, i) => ({ n, third: i === 1 })).filter((x) => !keyPcs.has(T.pc(x.n)));
      outsideBy[sym] = outside.map((x) => x.n).join(',');
      rows.push([sym, target.name, `${root}7`, outside.map((x) => (x.third ? `{third:${x.n}} (3rd)` : `${x.n}`)).join(', ')]);
    }
    assert(rows[4][2] === 'B7' && rows[5][2] === 'C♯7' && rows[3][2] === 'A7' && rows[1][2] === 'F♯7' && rows[2][2] === 'G♯7', 'secondary dominant spellings');
    assert(outsideBy['V/IV'] === 'G' && outsideBy['V/iii'] === 'B♯,D♯' && outsideBy['V/V'] === 'D♯' && outsideBy['V/vi'] === 'E♯' && outsideBy['V/ii'] === 'A♯', `outside notes ${JSON.stringify(outsideBy)}`);
    D.table(s, rows, { x: rx, y: CONTENT_TOP + 0.38, w: rw, colW: [0.95, 1.0, 0.95, 1.93], fontSize: 13, boldFirstCol: true });
    sub(s, 'B7 (V/V) at fret 7: its 3rd is {third:D♯}', rx, CONTENT_TOP + 2.5, rw, 13);
    D.fretboard(s, {
      x: rx, y: CONTENT_TOP + 2.9, w: rw, h: 1.45, from: 5, to: 10, root: 'B', title: 'B7 secondary dominant',
      dots: D.dotsFor(T.fingering('7.9.7.8.7.7'), { root: 'B', label: 'interval' }),
    });
    caption(s, 'D♯ (G string, fret 8) is the note outside A major. It resolves up to E.', rx, 6.32, rw, 0.45, 12);
  }

  // 74 · Key changes
  {
    const s = D.slideOf(pres, {
      kicker: KICK, title: 'Key changes and how to follow them',
      notes: `Songs change key for energy, contrast or drama. There are three common ways, and each one has a simple soloing move.

1. Up a step: the "truck driver" key change. The last chorus jumps up a whole step (or a half step) with no preparation. Here the chorus goes A–E–F♯m–D in A, then B–F♯–G♯m–E in B. Every chord moves up two frets, so you do the same: slide your whole position up two frets and play the same shapes. The diagrams show A major pentatonic (the F♯ minor box 1 shape at fret 2) and the same shape two frets higher for B major at fret 4.

2. The relative minor. A major and F♯ minor share the same seven notes, so a verse in F♯ minor (F♯m–D–E) can move to a chorus in A major (A–D–E) without any new notes. Your scale shapes don't change at all. What changes is the home note: in the verse, land on F♯; in the chorus, land on A. This is why it's worth practicing pentatonic boxes as both "A major" and "F♯ minor".

3. A pivot chord. The song slides into a new key through a chord that belongs to both keys. Bm is the ii chord in A and the vi chord in D, so a progression can reach Bm in A and continue as if it were in D (G–A–D). The giveaway is a new chord that isn't in the old key, here the G (♭VII in A, but IV in D). Over the new section, move to D major shapes.

How to spot a key change while playing: your "safe" notes suddenly sound wrong, or the band lands on a new chord that feels like home. Listen for the new home chord, find its root on the low E or A string, and rebuild your position around it. In a jam, the leader will often call it out ("up a step!").`,
    });
    const cw = (FULL_W - 0.6) / 3; const py = CONTENT_TOP + 0.02; const ph = 2.75;
    const panel = (i) => M + i * (cw + 0.3);
    // panel 1: up a step
    const inA = ['1', '5', '6m', '4'].map((n) => nashville(n, 'A'));
    const inB = ['1', '5', '6m', '4'].map((n) => nashville(n, 'B'));
    D.card(s, { x: panel(0), y: py, w: cw, h: ph, title: 'Up a step', badge: '1', badgeRole: 'root' });
    const t1w = (cw - 0.44 - 0.3) / 4;
    const kt = { topSize: 12, bottomSize: 14 };
    inA.forEach((c, i) => tile(pres, s, { ...kt, x: panel(0) + 0.22 + i * (t1w + 0.1), y: py + 0.75, w: t1w, h: 0.7, top: ['I', 'V', 'vi', 'IV'][i], bottom: c }));
    inB.forEach((c, i) => tile(pres, s, { ...kt, x: panel(0) + 0.22 + i * (t1w + 0.1), y: py + 1.55, w: t1w, h: 0.7, top: ['I', 'V', 'vi', 'IV'][i], bottom: c, outline: HEX.root, topColor: HEX.root }));
    caption(s, 'Last chorus: A → B. Move every shape up 2 frets.', panel(0) + 0.22, py + 2.32, cw - 0.44, 0.4, 12);
    // panel 2: relative minor
    D.card(s, { x: panel(1), y: py, w: cw, h: ph, title: 'Relative minor', badge: '2', badgeRole: 'third' });
    const verse = [['i', 'F♯m'], ['♭VI', 'D'], ['♭VII', 'E']];
    const chorus = [['I', 'A'], ['IV', 'D'], ['V', 'E']];
    const fm = T.harmonize('F♯', 'minor');
    for (const [num, name] of verse) assert(fm.find((c) => c.numeral === num).name === name, `F♯ minor ${num}`);
    const amaj = T.harmonize('A');
    for (const [num, name] of chorus) assert(amaj.find((c) => c.numeral === num).name === name, `A major ${num}`);
    assert(T.pcsOf('F♯', T.SCALES.minor).sort().join() === T.pcsOf('A', T.SCALES.major).sort().join(), 'F♯ minor = A major notes');
    verse.forEach(([n, c], i) => tile(pres, s, { ...kt, x: panel(1) + 0.22 + i * (t1w + 0.1), y: py + 0.75, w: t1w, h: 0.7, top: n, bottom: c }));
    chorus.forEach(([n, c], i) => tile(pres, s, { ...kt, x: panel(1) + 0.22 + i * (t1w + 0.1), y: py + 1.55, w: t1w, h: 0.7, top: n, bottom: c, outline: HEX.third, topColor: HEX.third }));
    s.addText('verse', { x: panel(1) + 0.22 + 3 * (t1w + 0.1), y: py + 0.75, w: t1w, h: 0.7, fontSize: 12, color: HEX.muted, valign: 'middle', margin: 0, isTextBox: true });
    s.addText('chorus', { x: panel(1) + 0.22 + 3 * (t1w + 0.1), y: py + 1.55, w: t1w, h: 0.7, fontSize: 12, color: HEX.muted, valign: 'middle', margin: 0, isTextBox: true });
    caption(s, 'Same 7 notes. Only the home note moves: F♯ → A.', panel(1) + 0.22, py + 2.32, cw - 0.44, 0.4, 12);
    // panel 3: pivot chord
    D.card(s, { x: panel(2), y: py, w: cw, h: ph, title: 'Pivot chord', badge: '3', badgeRole: 'fifth' });
    const hA = T.harmonize('A'); const hD = T.harmonize('D');
    assert(hA[1].name === 'Bm' && hD[5].name === 'Bm', 'Bm is ii in A and vi in D');
    const pivot = [['I', 'A'], ['IV', 'D'], ['ii → vi', 'Bm']];
    const after = [['IV', 'G'], ['V', 'A'], ['I', 'D']];
    assert(hD[3].name === 'G' && hD[4].name === 'A' && hD[0].name === 'D', 'D major chords');
    pivot.forEach(([n, c], i) => tile(pres, s, { ...kt, x: panel(2) + 0.22 + i * (t1w + 0.1), y: py + 0.75, w: t1w, h: 0.7, top: n, bottom: c, outline: i === 2 ? HEX.fifth : undefined, topColor: i === 2 ? HEX.fifth : undefined, topSize: i === 2 ? 11 : 12 }));
    after.forEach(([n, c], i) => tile(pres, s, { ...kt, x: panel(2) + 0.22 + i * (t1w + 0.1), y: py + 1.55, w: t1w, h: 0.7, top: n, bottom: c, outline: HEX.fifth, topColor: HEX.fifth }));
    s.addText('in A', { x: panel(2) + 0.22 + 3 * (t1w + 0.1), y: py + 0.75, w: t1w, h: 0.7, fontSize: 12, color: HEX.muted, valign: 'middle', margin: 0, isTextBox: true });
    s.addText('in D', { x: panel(2) + 0.22 + 3 * (t1w + 0.1), y: py + 1.55, w: t1w, h: 0.7, fontSize: 12, color: HEX.muted, valign: 'middle', margin: 0, isTextBox: true });
    caption(s, 'Bm belongs to both keys. Then G tells you: now in D.', panel(2) + 0.22, py + 2.32, cw - 0.44, 0.4, 12);
    // boards: A major pentatonic → B major pentatonic
    const by = py + ph + 0.35; const bw = (FULL_W - 0.4) / 2;
    sub(s, 'Chorus in A: A major pentatonic (F♯m box 1 shape, fret 2)', M, by, bw, 13);
    D.fretboard(s, { x: M, y: by + 0.38, w: bw, h: 1.45, from: 1, to: 6, root: 'A', title: 'A major pent', dots: D.dotsFor(T.pentBox('F♯', 1), { root: 'A', label: 'interval' }) });
    sub(s, 'Up a step to B: same shape, fret 4', M + bw + 0.4, by, bw, 13);
    D.fretboard(s, { x: M + bw + 0.4, y: by + 0.38, w: bw, h: 1.45, from: 3, to: 8, root: 'B', title: 'B major pent', dots: D.dotsFor(T.pentBox('G♯', 1), { root: 'B', label: 'interval' }) });
  }

  // 75 · 12-week roadmap
  {
    const s = D.slideOf(pres, {
      kicker: KICK, title: 'The Level 2 12-week roadmap',
      notes: `A 12-week plan for Level 2, split into three 4-week blocks. Each block has a focus and a milestone you can test. Don't move on just because the calendar says so: move on when you can pass the milestone after only a short warm-up.

Weeks 1–4: time and the full scale.
• Part 1: rhythm grids every day. Count out loud ("1 e & a"), clap before you play, and practice triplets, swing and gallops at slow tempos.
• Part 2: the first two full-scale positions of A minor / C major and the first two 3-notes-per-string patterns.
• Part 5: five minutes of interval ear training a day.
Milestone: a gallop riff in time at 100 bpm, positions 1–2 linked, and 4ths, 5ths and octaves named by ear.

Weeks 5–8: chord tones everywhere.
• Part 2: all five positions and all seven 3-notes-per-string patterns; play each mode over a drone.
• Part 3: triads on every string set, dominant 7 and minor 7 arpeggios, guide tones through a 12-bar.
• Part 4: the new chord vocabulary (sus, add9, 9, 13, 7♯9) in your comping.
Milestone: comp a 12-bar with triads on three string sets, and outline A7–D7–E7 with arpeggios at 80 bpm.

Weeks 9–12: songs and sound.
• Part 6: one alternate tuning, Phrygian dominant, harmony lines and high-gain muting.
• Part 5: transcribe 8 bars of a solo you love.
• Part 7: learn two songs from Nashville number charts and play one in a second key.
• Part 1: an odd-meter riff in 7/8.
Milestone: play a full song from a number chart, transcribe 8 bars by ear, and jam in a new key or tuning.

Every week: keep the 5-minute note finder from Level 1 as your warm-up and record yourself once. The log on the next slide tracks it all.`,
    });
    const blocks = [
      { title: 'Weeks 1–4 · Time and the full scale', role: 'root', items: ['Part 1: rhythm grids, triplets, swing, gallops', 'Part 2: positions 1–2, 3nps patterns 1–2', 'Part 5: 5 min of interval ear training a day'], ms: 'Gallop riff in time at 100 bpm. Positions 1–2 linked. 4ths, 5ths, octaves by ear.' },
      { title: 'Weeks 5–8 · Chord tones everywhere', role: 'third', items: ['Part 2: all 5 positions, 7 patterns, modes over drones', 'Part 3: triads on every string set, 7th arpeggios, guide tones', 'Part 4: sus, add9, 9, 13, 7♯9 in your comping'], ms: 'Comp a 12-bar on 3 string sets. Outline A7–D7–E7 with arpeggios at 80 bpm.' },
      { title: 'Weeks 9–12 · Songs and sound', role: 'fifth', items: ['Part 6: a new tuning, Phrygian dominant, harmony lines, muting', 'Part 5: transcribe 8 bars', 'Part 7: two songs from number charts', 'Part 1: a riff in 7/8'], ms: 'A full song from a number chart. 8 bars transcribed. Jam in a new key or tuning.' },
    ];
    const tl = CONTENT_TOP + 0.25; const step = FULL_W / 12;
    s.addShape(pres.shapes.LINE, { x: M + step / 2, y: tl, w: step * 11, h: 0, line: { color: HEX.line, width: 2.5 } });
    for (let wk = 0; wk < 12; wk++) {
      D.badge(s, { x: M + step * wk + step / 2 - 0.22, y: tl - 0.22, d: 0.44, label: String(wk + 1), role: blocks[Math.floor(wk / 4)].role, fontSize: 13 });
    }
    const cw = (FULL_W - 0.6) / 3; const cy = CONTENT_TOP + 0.75; const ch = 6.85 - cy;
    blocks.forEach((b, i) => {
      const x = M + i * (cw + 0.3);
      D.card(s, { x, y: cy, w: cw, h: ch, title: b.title, badge: String(i + 1), badgeRole: b.role, titleSize: 16, bullets: b.items, fontSize: 14 });
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x + 0.18, y: cy + ch - 1.38, w: cw - 0.36, h: 1.2, rectRadius: 0.08, fill: { color: HEX.card2 }, line: { color: HEX.card2, width: 0 } });
      s.addText([{ text: 'MILESTONE', options: { bold: true, color: HEX.pearl, fontSize: 11, charSpacing: 2, breakLine: true } }, { text: b.ms, options: { color: HEX.white, fontSize: 14 } }], { x: x + 0.32, y: cy + ch - 1.3, w: cw - 0.64, h: 1.05, valign: 'top', margin: 0, isTextBox: true });
    });
  }

  // 76 · Practice log (light, printable)
  {
    const s = D.slideOf(pres, {
      kicker: KICK, title: 'Level 2 practice log: one page per week', light: true,
      notes: `Print this page once a week, or copy the grid into a notebook.

How to use it:
• At the top, write the week and one focus, for example "16th-note gallops + position 3" or "guide tones over the 12-bar".
• Each day, tick the rows you practiced or write the minutes.
• Start bpm is the tempo where a drill was clean on day one. Best bpm is the fastest clean tempo by the end of the week. Clean means three passes in a row without a mistake. Not every row has a tempo (ear training and song charts don't), so leave those blank or write a score instead, such as "8/10 intervals right".
• The minutes row keeps you honest about consistency. Five days of 30 minutes beats one day of three hours.
• Tick a milestone only when you can do it after a short warm-up. That's the test that a skill is really yours.
• "Fix next week" is for the one thing your weekly recording told you: rushing the gallops, sharp bends, buzzing notes, losing the form.

The rows follow the parts of Level 2: rhythm and time, scale positions and 3-notes-per-string patterns, modes over drones, triads and arpeggios, chord vocabulary, ear training, tunings and metal, and song charts. You won't fill every row every day. The roadmap on the previous slide tells you which rows matter in which block.

The milestones on the right are taken from the roadmap, two per 4-week block; the ear and jam milestones are tracked in the roadmap itself.`,
    });
    s.addText('Week of  ______________          This week’s focus:  ______________________________________', { x: M, y: CONTENT_TOP, w: FULL_W, h: 0.35, fontSize: 14, color: HEX.lightText, margin: 0, valign: 'middle', isTextBox: true });
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const drills = ['Rhythm & time', 'Positions / 3nps', 'Modes over drones', 'Triads & arpeggios', 'Chord vocabulary', 'Ear training', 'Tunings & metal', 'Song charts'];
    const rows = [['Practice area', ...days, 'Start bpm', 'Best bpm']];
    for (const d of drills) rows.push([d, ...days.map(() => ''), '', '']);
    rows.push(['Minutes', ...days.map(() => ''), '', '']);
    lightTable(s, rows, { x: M, y: CONTENT_TOP + 0.5, w: 8.75, colW: [2.15, ...days.map(() => 0.6), 1.2, 1.2], rowH: 0.41, fontSize: 13, align: ['left', ...days.map(() => 'center'), 'center', 'center'] });
    const mx = M + 9.1;
    sub(s, 'Milestones', mx, CONTENT_TOP + 0.5, 3.0);
    const ms = ['Gallop riff at 100 bpm', 'Positions 1–2 linked', 'Triads on 3 string sets', 'A 12-bar outlined with arpeggios', 'A song from a number chart', '8 bars transcribed by ear'];
    ms.forEach((m, i) => checkbox(pres, s, mx, CONTENT_TOP + 0.95 + i * 0.6, m, 2.65));
    s.addShape(pres.shapes.RECTANGLE, { x: M, y: 6.22, w: FULL_W, h: 0.6, fill: { color: 'FFFFFF' }, line: { color: 'A1A1AA', width: 0.75 } });
    s.addText('Fix next week:', { x: M + 0.12, y: 6.28, w: 3, h: 0.26, fontSize: 12, bold: true, color: HEX.lightMuted, margin: 0, isTextBox: true });
  }

  // 77 · Cheat sheet: scale positions + 7 modes
  {
    const s = D.slideOf(pres, {
      kicker: SHEET, title: 'Scale positions and the 7 modes', light: true,
      notes: `Cheat sheet 1: the full scale everywhere, and the seven modes.

Top row: the five positions of A natural minor, which are also the five positions of C major (the same seven notes). Each position is one of the pentatonic boxes you learned in Level 1 plus the two missing notes: B (the 2nd of A) and F (the ♭6). Red dots are A, the root. Learn each position as "box + 2 notes" and you already know 70% of it.
• Position 1 sits around fret 5 (box 1).
• Position 2 around frets 7–10 (box 2).
• Position 3 around frets 9–13 (box 3).
• Position 4 around frets 12–15 (box 4).
• Position 5 around frets 2–5, and again at 14–17 (box 5).
Play the C major scale in the same positions by treating C as home instead of A.

Bottom: the seven modes from A, ordered from brightest (Lydian) to darkest (Locrian). Each mode is a major or minor scale with one or two notes changed. The flavor note column is the note that gives each mode its sound. The parent column tells you which major scale has the same notes: A Dorian uses the notes of G major, so you can play A Dorian with any G major shape while treating A as home.

How to use this sheet: put on a drone or a one-chord backing track in A. Play one mode per day for a week, and lean on the flavor note. Your ear will learn each mode's color much faster than your eyes learn the shapes.`,
    });
    const bw = (FULL_W - 4 * 0.22) / 5;
    // Same windows as Part 2: every A natural minor note inside the position's fret window (position 5 shown at 2–5).
    const WINDOWS = { 1: [4, 8], 2: [7, 10], 3: [9, 13], 4: [12, 15], 5: [2, 5] };
    const added = (sm) => sm === 2 || sm === 8;
    for (let k = 1; k <= 5; k++) {
      const [lo, hi] = WINDOWS[k];
      const pos = T.positions(T.pcsOf('A', T.SCALES.minor), { from: lo, to: hi });
      assert(pos.length >= 15 && pos.length <= 18, `position ${k} has ${pos.length} notes`);
      for (const p of pos) assert(T.pcsOf('A', T.SCALES.minor).includes(T.pcAt(p.s, p.f)), `position ${k} note not in A minor`);
      const x = M + (k - 1) * (bw + 0.22);
      s.addText(`Position ${k} · frets ${lo}–${hi}`, { x, y: CONTENT_TOP, w: bw, h: 0.28, fontSize: 12, bold: true, color: HEX.lightText, align: 'center', margin: 0, isTextBox: true });
      D.fretboard(s, {
        x, y: CONTENT_TOP + 0.35, w: bw, h: 1.6, from: Math.max(0, lo - (lo > 0 ? 0 : 0)), to: hi, root: 'A', stringLabels: k === 1, title: `Position ${k}`, fretNumSize: 9,
        dots: D.dotsFor(pos, { root: 'A', label: 'interval', ring: (p, sm) => added(sm), roleOf: (sm) => (added(sm) ? 'other' : T.role(sm)) }),
      });
    }
    D.legend(s, { x: M, y: CONTENT_TOP + 2.35, roles: ['root', 'third', 'fifth', 'seventh', 'other'], names: { third: '♭3 (C)', fifth: '5 (E)', seventh: '♭7 (G)', other: '4 (D) · rings = 2 (B), ♭6 (F)' }, fontSize: 11 });
    // modes table
    const modes = [
      ['Lydian', T.SCALES.lydian, 5, '♯4', 'Dreamy, floating'],
      ['Ionian (major)', T.SCALES.major, 0, '7 + 4', 'Bright, resolved'],
      ['Mixolydian', T.SCALES.mixolydian, 7, '♭7', 'Major with bite: classic rock'],
      ['Dorian', T.SCALES.dorian, 2, '6', 'Minor with a lift: funk, rock'],
      ['Aeolian (natural minor)', T.SCALES.minor, 9, '♭6', 'Dark, epic: rock, metal'],
      ['Phrygian', T.SCALES.phrygian, 4, '♭2', 'Darkest minor: metal'],
      ['Locrian', T.SCALES.locrian, 11, '♭5', 'Unstable: rare, m7♭5 sound'],
    ];
    const rows = [['Mode (from A)', 'Formula', 'Flavor note', 'In A', 'Same notes as', 'Sound']];
    for (const [name, ivs, offset, flavor, sound] of modes) {
      const formula = modeFormula(ivs).join(' ');
      for (const fl of flavor.split(' + ')) assert(formula.split(' ').includes(fl), `${name} flavor ${fl}`);
      const flavorNotes = flavor.split(' + ').map((fl) => {
        const d = Number(fl.replace(/[♭♯]/g, ''));
        const semi = ivs[d - 1];
        return T.spellIn('A', T.mod12(T.pc('A') + semi), d);
      }).join(', ');
      const parentPc = T.mod12(T.pc('A') - offset);
      const parent = [10, 5].includes(parentPc) ? T.FLAT[parentPc] : T.SHARP[parentPc];
      // check: the parent major scale contains exactly the mode's notes
      const modeSet = new Set(T.pcsOf('A', ivs)); const parSet = new Set(T.pcsOf(parent, T.SCALES.major));
      assert([...modeSet].every((p) => parSet.has(p)) && modeSet.size === parSet.size, `${name} parent ${parent}`);
      rows.push([name, formula, `{blue:${flavor}}`, flavorNotes, `${parent} major`, sound]);
    }
    lightTable(s, rows, { x: M, y: CONTENT_TOP + 2.75, w: FULL_W, colW: [2.45, 2.55, 1.25, 1.2, 1.55, 3.13], rowH: 0.31, fontSize: 12 });
  }

  // 78 · Cheat sheet: triads on every string set + 7th chords
  {
    const s = D.slideOf(pres, {
      kicker: SHEET, title: 'Triads on every string set + 7th chords', light: true,
      notes: `Cheat sheet 2: A major triads on all four 3-string sets, and the 7th-chord formulas.

Each board shows every closed A major triad on one set of three adjacent strings, from the open position to fret 15. Red is the root (A), amber the 3rd (C♯), blue the 5th (E). The lowest note of each shape tells you the inversion:
• Root position: root on the bottom (R–3–5).
• 1st inversion: 3rd on the bottom (3–5–R).
• 2nd inversion: 5th on the bottom (5–R–3).
The caption above each board lists the frets of each shape, low string first.

Why four string sets? The top set (G-B-e) is bright and cuts through a band. The middle sets (D-G-B and A-D-G) are warm and full, good for rhythm parts. The bottom set (E-A-D) is heavy, and it's close to a power chord with the 3rd added. Being able to grab the same chord on any set, in any inversion, is what lets you comp anywhere on the neck and move between chords with tiny hand movements (voice leading).

To get minor triads, lower every amber 3rd by one fret. To get the other chords of a song, move the shapes so the roots land on the new chord's root.

Bottom strip: 7th-chord formulas, spelled in A. Each one is a triad plus one note:
• A7 (dominant 7): major triad + ♭7.
• Amaj7: major triad + 7.
• Am7: minor triad + ♭7.
• Am7♭5 (half-diminished): diminished triad + ♭7.
• Adim7: diminished triad + ♭♭7 (the same pitch as the 6th).
These are the arpeggios from Part 3. Say the formula as you play each arpeggio.`,
    });
    const sets = [
      { strings: [3, 2, 1], name: 'G-B-e strings' },
      { strings: [4, 3, 2], name: 'D-G-B strings' },
      { strings: [5, 4, 3], name: 'A-D-G strings' },
      { strings: [6, 5, 4], name: 'E-A-D strings' },
    ];
    const bw = (FULL_W - 0.4) / 2; const bh = 1.5;
    const short = { 'Root position': 'R', '1st inversion': '1st', '2nd inversion': '2nd' };
    sets.forEach((st, i) => {
      const x = M + (i % 2) * (bw + 0.4); const y = CONTENT_TOP + Math.floor(i / 2) * 2.3;
      const vs = T.closedTriads('A', T.CHORDS.maj, st.strings, 15);
      assert(vs.length >= 3, `${st.name} triads`);
      const desc = vs.map((v) => `${v.notes.map((n) => n.f).join('-')} (${short[v.inversion]})`).join(' · ');
      s.addText([{ text: `${st.name}  `, options: { bold: true, color: HEX.lightText } }, { text: desc, options: { color: HEX.lightMuted } }], { x, y, w: bw, h: 0.3, fontSize: 12, margin: 0, valign: 'middle', isTextBox: true });
      const dots = vs.flatMap((v) => v.notes);
      D.fretboard(s, { x, y: y + 0.38, w: bw, h: bh, from: 0, to: 15, root: 'A', title: st.name, dots: D.dotsFor(dots, { root: 'A', label: 'interval' }), fretNumSize: 9 });
    });
    // 7th chord strip
    const chords = [
      ['A7', 'Dominant 7', ['R', '3', '5', '♭7'], T.CHORDS.dom7],
      ['Amaj7', 'Major 7', ['R', '3', '5', '7'], T.CHORDS.maj7],
      ['Am7', 'Minor 7', ['R', '♭3', '5', '♭7'], T.CHORDS.min7],
      ['Am7♭5', 'Half-diminished', ['R', '♭3', '♭5', '♭7'], T.CHORDS.m7b5],
      ['Adim7', 'Diminished 7', ['R', '♭3', '♭5', '♭♭7'], [0, 3, 6, 9]],
    ];
    const tw = (FULL_W - 4 * 0.15) / 5; const ty = 6.18;
    chords.forEach(([sym, name, labels, semis], i) => {
      assert(labels.map(labelSemis).join() === semis.join(), `${sym} formula`);
      const notes = spellChord('A', labels).join(' ');
      const x = M + i * (tw + 0.15);
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: ty, w: tw, h: 0.67, rectRadius: 0.06, fill: { color: 'F4F4F5' }, line: { color: 'D4D4D8', width: 0.75 } });
      s.addText([{ text: `${sym}  `, options: { bold: true, color: HEX.lightText, fontSize: 14 } }, { text: name, options: { color: HEX.lightMuted, fontSize: 11 } }], { x: x + 0.1, y: ty + 0.04, w: tw - 0.2, h: 0.3, margin: 0, valign: 'middle', isTextBox: true });
      s.addText([{ text: labels.join(' '), options: { bold: true, color: '8A6D3B' } }, { text: `  ·  ${notes}`, options: { color: HEX.lightText } }], { x: x + 0.1, y: ty + 0.34, w: tw - 0.2, h: 0.28, fontSize: 12, margin: 0, valign: 'middle', isTextBox: true });
    });
  }

  // 79 · Cheat sheet: rhythm, tunings, chord formulas
  {
    const s = D.slideOf(pres, {
      kicker: SHEET, title: 'Rhythm counts, tunings and chord formulas', light: true,
      notes: `Cheat sheet 3: the counting system, the tunings and the chord formulas, on one page.

Top left: rhythm grids, two beats of each.
• 8th notes: two per beat, counted "1 &".
• Triplets: three per beat, counted "1 trip let".
• Swing 8ths: the first note of each pair lasts two triplet slots and the second lasts one. That's the long-short shuffle feel, written the same as straight 8ths and played as triplets.
• 16th notes: four per beat, counted "1 e & a".
Count out loud. The beat numbers stay where they are whatever the subdivision, and that's what keeps you in time.

Bottom left: tunings. E♭ standard and D standard keep every shape the same and just lower the pitch, so only the note names change. Drop D and Drop C lower only the lowest string by a whole step below the rest of the tuning, which gives one-finger power chords on the bottom three strings. The lowest note column uses scientific pitch names (E2 is the open low E in standard tuning).

Right: chord formulas. Every chord name is a formula relative to its root:
• 6 adds the 6th, and add9 adds the 9th (the 2nd an octave up) without a 7th.
• 9 means dominant 7 + 9. 7♯9 is the dominant 7 with a raised 9th: the "Hendrix chord" sound, whose ♯9 is the same pitch as the minor 3rd.
• sus chords replace the 3rd with a 2nd or a 4th, so they're neither major nor minor.
• dim7 stacks minor 3rds all the way up, and its ♭♭7 is the same pitch as the 6th.

The A column spells every formula in A so you can check your shapes.`,
    });
    // left column: rhythm grids, then tunings
    const lw = 5.75; const cx = M + lw + 0.38; const rw = FULL_W - lw - 0.38;
    sub(s, 'Counting: two beats of each', M, CONTENT_TOP, lw);
    const grids = [
      { label: '8ths', sub: 2, notes: [0, 1, 2, 3].map((a) => ({ at: a })) },
      { label: 'Triplets', sub: 3, notes: [0, 1, 2, 3, 4, 5].map((a) => ({ at: a, role: 'third' })) },
      { label: 'Swing 8ths', sub: 3, notes: [{ at: 0, len: 2, role: 'fifth' }, { at: 2, role: 'fifth' }, { at: 3, len: 2, role: 'fifth' }, { at: 5, role: 'fifth' }] },
      { label: '16ths', sub: 4, notes: [0, 1, 2, 3, 4, 5, 6, 7].map((a) => ({ at: a, role: 'seventh' })) },
    ];
    let gy = CONTENT_TOP + 0.38;
    grids.forEach((g) => {
      gy = D.rhythm(s, { x: M, y: gy, w: lw, beats: 2, sub: g.sub, rowH: 0.3, rows: [{ label: g.label, notes: g.notes }] }) + 0.06;
    });
    const ty = gy + 0.08;
    sub(s, 'Tunings', M, ty, lw);
    const tunes = ['standard', 'eflat', 'dropD', 'dStandard', 'dropC'].map((id) => T.TUNINGS[id]);
    const change = {
      standard: 'Reference', eflat: 'All down a half step', dropD: 'Low E down to D',
      dStandard: 'All down a whole step', dropC: 'D std, low string to C',
    };
    const trows = [['Tuning', 'Low → high', 'Lowest', 'What changes']];
    for (const tu of tunes) {
      const names = [6, 5, 4, 3, 2, 1].map((st) => (tu.flat ? T.FLAT : T.SHARP)[T.mod12(tu.open[st])]).join(' ');
      assert(names === tu.short, `${tu.name} names ${names}`);
      trows.push([tu.name, names, noteWithOctave(tu.open[6], tu.flat), change[tu.id]]);
    }
    lightTable(s, trows, { x: M, y: ty + 0.35, w: lw, colW: [1.3, 1.65, 0.75, 2.05], rowH: 0.27, fontSize: 11 });
    assert(ty + 0.35 + 6 * 0.27 <= 6.86, `tunings table bottom ${ty + 0.35 + 6 * 0.27}`);
    // right column: chord formula table
    sub(s, 'Chord formulas (spelled in A)', cx, CONTENT_TOP, rw);
    const forms = [
      ['maj', ['R', '3', '5'], T.CHORDS.maj], ['m', ['R', '♭3', '5'], T.CHORDS.min], ['dim', ['R', '♭3', '♭5'], T.CHORDS.dim],
      ['aug', ['R', '3', '♯5'], T.CHORDS.aug], ['sus2', ['R', '2', '5'], T.CHORDS.sus2], ['sus4', ['R', '4', '5'], T.CHORDS.sus4],
      ['6', ['R', '3', '5', '6'], [0, 4, 7, 9]], ['add9', ['R', '3', '5', '9'], [0, 4, 7, 2]],
      ['7', ['R', '3', '5', '♭7'], T.CHORDS.dom7], ['maj7', ['R', '3', '5', '7'], T.CHORDS.maj7], ['m7', ['R', '♭3', '5', '♭7'], T.CHORDS.min7],
      ['9', ['R', '3', '5', '♭7', '9'], [0, 4, 7, 10, 2]], ['7♯9', ['R', '3', '5', '♭7', '♯9'], [0, 4, 7, 10, 3]], ['dim7', ['R', '♭3', '♭5', '♭♭7'], [0, 3, 6, 9]],
    ];
    const pretty = (n) => n.replace('♯', '♯').replace('♭', '♭');
    const crow = [['Chord', 'Formula', 'In A']];
    for (const [sym, labels, semis] of forms) {
      assert(labels.map(labelSemis).join() === semis.join(), `${sym} formula semitones`);
      crow.push([`A${sym === 'maj' ? '' : sym}`, labels.join(' '), spellChord('A', labels).map(pretty).join(' ')]);
    }
    lightTable(s, crow, { x: cx, y: CONTENT_TOP + 0.38, w: rw, colW: [1.0, 2.3, rw - 3.3], rowH: 0.31, fontSize: 12 });
  }

  // 80 · Closing
  {
    const s = D.slideOf(pres, {
      kicker: KICK, title: 'Three habits for Level 2',
      notes: `If you remember only three things from Level 2, make them these. Do them every day, in every practice session, and in every jam.

1. Count everything. Before you play a riff or a lick, count it out loud: "1 e & a". Know where beat 1 is at all times, and know which bar of the section you're in. Rhythm is what makes simple notes sound like music, and it's what makes other musicians want to play with you. Five minutes of rhythm work a day pays back more than anything else in this deck.

2. Hear it before you play it. Sing or hum the phrase in your head, then find it on the neck. Every day, spend a few minutes naming intervals, chord qualities or a short melody by ear. The ear-hand connection is what turns shapes into music. It's also how you'll transcribe, learn songs quickly, and react in a jam instead of reciting licks.

3. Aim at chord tones. Whatever scale you're using, know where the current chord's root, 3rd, 5th and 7th are, and land on them at the ends of your phrases. Use approach notes and passing notes to get there. This is the difference between "playing the scale over the song" and playing the song.

The diagram at the bottom is A natural minor across the whole neck, the full map of Level 2: five positions, seven 3-notes-per-string patterns and seven modes, all from the same twelve frets repeated. You've learned the map. Now spend the next twelve weeks making music on it, and log your progress so you can see how far you've come.

See you on the fretboard.`,
    });
    const habits = [
      ['1', 'Count everything', 'Say "1 e & a" out loud. Know where **beat 1** and the **bar** are, always.', 'root', '5 min'],
      ['2', 'Hear it before you play it', 'Sing the phrase, then find it. Name **intervals and chords** by ear daily.', 'third', '5 min'],
      ['3', 'Aim at chord tones', 'Know the **R, 3, 5, 7** of the current chord. Approach notes get you there.', 'fifth', 'every solo'],
    ];
    const cw = (FULL_W - 0.6) / 3; const ch = 2.55;
    habits.forEach(([n, title, body, role, time], i) => {
      const x = M + i * (cw + 0.3); const y = CONTENT_TOP;
      D.card(s, { x, y, w: cw, h: ch });
      D.badge(s, { x: x + 0.22, y: y + 0.22, d: 0.66, label: n, role, fontSize: 24 });
      s.addText(time, { x: x + cw - 1.62, y: y + 0.3, w: 1.4, h: 0.5, fontSize: 14, bold: true, color: HEX.pearl, align: 'right', valign: 'middle', margin: 0, isTextBox: true });
      s.addText(title, { x: x + 0.22, y: y + 1.0, w: cw - 0.44, h: 0.4, fontSize: 18, bold: true, color: HEX.white, margin: 0, valign: 'top', isTextBox: true });
      D.text(s, body, { x: x + 0.22, y: y + 1.5, w: cw - 0.44, h: ch - 1.65, fontSize: 15 });
    });
    const pos = T.positions(T.pcsOf('A', T.SCALES.minor), { from: 0, to: 17 });
    D.fretboard(s, {
      x: M, y: CONTENT_TOP + 2.85, w: FULL_W, h: 1.75, from: 0, to: 17, root: 'A', title: 'closing A natural minor',
      dots: D.dotsFor(pos, { root: 'A', label: 'none' }), fretNumbers: 'inlays',
    });
    s.addText([{ text: 'A natural minor, the whole neck. ', options: { color: HEX.muted } }, { text: 'See you on the fretboard.', options: { color: HEX.pearl, italic: true } }], { x: M, y: 6.5, w: FULL_W, h: 0.32, fontSize: 14, align: 'right', margin: 0, valign: 'middle', isTextBox: true });
  }
}

module.exports = { build };
