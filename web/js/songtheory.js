// Song writing theory (no DOM): chords written as 简谱 numbers ('1', '6m', '5/7', '♭7'), the
// progressions Mandopop and rock lean on, chord swaps, song forms per style, a melody generator
// that sets a lyric line to the chords while following its tones, captured-note quantizing,
// and 简谱 (numbered notation) for the melody.
(function (root) {
  'use strict';
  const Zh = root.Zh || (typeof require !== 'undefined' ? require('./zh.js') : null);
  const TPB = 12; // ticks per beat (same grid as the band)
  const BAR = 48;
  const LINE_BARS = 2;
  const LINE = BAR * LINE_BARS;
  const S16 = 3; // a 16th note in ticks
  const mod12 = (n) => ((n % 12) + 12) % 12;

  // ---------- chords ----------
  const DEG = { 1: 0, 2: 2, 3: 4, 4: 5, 5: 7, 6: 9, 7: 11 };
  const QUAL = {
    '': [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10],
    sus4: [0, 5, 7], sus2: [0, 2, 7], add9: [0, 4, 7, 14], madd9: [0, 3, 7, 14], 5: [0, 7], dim: [0, 3, 6], m7b5: [0, 3, 6, 10],
  };
  const QUAL_SHOW = { '': '', m: 'm', 7: '7', maj7: 'maj7', m7: 'm7', sus4: 'sus4', sus2: 'sus2', add9: 'add9', madd9: 'm(add9)', 5: '5', dim: '°', m7b5: 'm7♭5' };
  const SHARP = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
  const FLAT = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
  // Keys named with flats: D♭ E♭ F A♭ B♭. The key between F and G is F♯ (its 4 is B and its ♭7 is E;
  // as G♭ they would be C♭ and F♭).
  const FLAT_KEYS = [1, 3, 5, 8, 10];
  const KEYS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const keyName = (pc) => (FLAT_KEYS.includes(mod12(pc)) ? FLAT : SHARP)[mod12(pc)];
  const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const NATURAL = [0, 2, 4, 5, 7, 9, 11];
  // The name of a degree (1–7, with its accidental) in a key, spelled on the degree's own letter:
  // the 7 of F♯ is E♯, the ♭6 of E♭ is C♭. A note that would need a double accidental takes its plain name.
  function degreeName(keyPc, deg, acc = 0) {
    const li = (LETTERS.indexOf(keyName(keyPc)[0]) + deg - 1) % 7;
    const pc = mod12(keyPc + DEG[deg] + acc);
    let a = mod12(pc - NATURAL[li]);
    if (a > 6) a -= 12;
    if (Math.abs(a) > 1) return (FLAT_KEYS.includes(mod12(keyPc)) || acc < 0 ? FLAT : SHARP)[pc];
    return LETTERS[li] + (a > 0 ? '♯' : a < 0 ? '♭' : '');
  }

  // '♭7', '6m', '5/7', '4maj7', '1/3', 'b6'  →  { acc, deg, q, bass: { acc, deg } | null }
  const SYM = /^([♭b♯#]?)([1-7])(maj7|m7b5|madd9|m7|m|7|sus4|sus2|add9|5|dim)?(?:\/([♭b♯#]?)([1-7]))?$/;
  function parseChord(sym) {
    const m = String(sym).trim().match(SYM);
    if (!m) return null;
    const acc = (a) => (a === '♭' || a === 'b' ? -1 : a === '♯' || a === '#' ? 1 : 0);
    return { acc: acc(m[1]), deg: Number(m[2]), q: m[3] || '', bass: m[5] ? { acc: acc(m[4]), deg: Number(m[5]) } : null };
  }
  const accStr = (a) => (a < 0 ? '♭' : a > 0 ? '♯' : '');
  function chordSym(c) {
    return `${accStr(c.acc)}${c.deg}${c.q}${c.bass ? `/${accStr(c.bass.acc)}${c.bass.deg}` : ''}`;
  }
  const rootSemis = (c) => DEG[c.deg] + c.acc;
  // Pitch classes of a chord in a key, its root and its bass.
  function chordInfo(sym, keyPc) {
    const c = typeof sym === 'string' ? parseChord(sym) : sym;
    if (!c) return null;
    const rootPc = mod12(keyPc + rootSemis(c));
    const pcs = QUAL[c.q].map((i) => mod12(rootPc + i));
    const bassPc = c.bass ? mod12(keyPc + DEG[c.bass.deg] + c.bass.acc) : rootPc;
    const minor = c.q === 'm' || c.q === 'm7' || c.q === 'madd9' || c.q === 'dim' || c.q === 'm7b5';
    return { ...c, rootPc, pcs, bassPc, minor, intervals: QUAL[c.q] };
  }
  // 'Am', 'G/B', 'F♯m7' in a key.
  function chordName(sym, keyPc) {
    const i = chordInfo(sym, keyPc);
    if (!i) return '?';
    return `${degreeName(keyPc, i.deg, i.acc)}${QUAL_SHOW[i.q]}${i.bass ? `/${degreeName(keyPc, i.bass.deg, i.bass.acc)}` : ''}`;
  }

  // Letter steps of each chord tone above the root: thirds stacked by letter, sus and add notes on theirs.
  const QUAL_LETTERS = {
    '': [0, 2, 4], m: [0, 2, 4], 7: [0, 2, 4, 6], maj7: [0, 2, 4, 6], m7: [0, 2, 4, 6],
    sus4: [0, 3, 4], sus2: [0, 1, 4], add9: [0, 2, 4, 1], madd9: [0, 2, 4, 1], 5: [0, 4], dim: [0, 2, 4], m7b5: [0, 2, 4, 6],
  };
  // The notes of the key that a chord alters: { the plain degree: the chord's version }, both in
  // semitones above the tonic. A major 3 turns 5 into ♯5 ({ 7: 8 }), 4m turns 6 into ♭6 ({ 9: 8 }),
  // ♭7 turns 7 into ♭7. Chords inside the key alter nothing.
  function alterations(sym) {
    const c = typeof sym === 'string' ? parseChord(sym) : sym;
    const out = {};
    if (!c) return out;
    QUAL[c.q].forEach((iv, i) => {
      const plain = DEG[((c.deg - 1 + QUAL_LETTERS[c.q][i]) % 7) + 1];
      const tone = mod12(rootSemis(c) + iv);
      const diff = mod12(tone - plain);
      if (diff === 1 || diff === 11) out[plain] = tone;
    });
    return out;
  }
  // Number shown with the chord: 1, 6m, ♭7, 5/7.
  const chordNum = (sym) => { const c = parseChord(sym); return c ? chordSym(c) : sym; };

  // A bar is one chord or two (half a bar each): '4' or '3m,6m'. Progressions: bars joined by '|'.
  const parseBars = (s) => String(s).split('|').map((b) => b.trim().split(/[,\s]+/).filter(Boolean)).filter((b) => b.length);
  const barsToString = (bars) => bars.map((b) => b.join(',')).join(' | ');
  // The chord sounding at tick t of a run of bars.
  function chordAt(bars, t) {
    const b = bars[Math.floor(t / BAR)];
    if (!b) return null;
    return b.length > 1 && t % BAR >= BAR / 2 ? b[1] : b[0];
  }

  // ---------- the progression library ----------
  const PROGRESSIONS = [
    { id: 'canon', zh: '卡农进行', name: 'Canon', bars: '1 | 5 | 6m | 3m | 4 | 1 | 4 | 5', for: ['verse', 'chorus'],
      desc: 'The most-used ballad progression in Mandopop. The bass walks down slowly; tender and nostalgic.' },
    { id: 'canonWalk', zh: '卡农 · 低音下行', name: 'Canon with walking bass', bars: '1 | 5/7 | 6m | 6m/5 | 4 | 1/3 | 2m | 5', for: ['verse', 'chorus'],
      desc: 'The same idea with slash chords: the bass steps 1-7-6-5-4-3-2 and turns on 5. The classic piano-ballad verse.' },
    { id: 'royal', zh: '王道进行', name: 'Royal road (4536)', bars: '4 | 5 | 3m | 6m', for: ['chorus', 'pre'],
      desc: 'Bittersweet and lifting. Starts away from home on 4, so it never sounds finished: the go-to chorus loop in J-pop and Mandopop.' },
    { id: 'royalHome', zh: '王道 · 回到 1', name: 'Royal road, home', bars: '4maj7 | 5 | 3m7 | 6m | 2m7 | 5 | 1 | 1', for: ['chorus'],
      desc: '4536 then 2-5-1: the chorus lands home at the end, so it feels complete.' },
    { id: 'axis', zh: '1564', name: 'Pop axis', bars: '1 | 5 | 6m | 4', for: ['verse', 'chorus'],
      desc: 'The four chords of pop. Bright and easy to sing over in any section.' },
    { id: 'fifties', zh: '1645', name: "'50s / doo-wop", bars: '1 | 6m | 4 | 5', for: ['verse', 'chorus'],
      desc: 'Old-school love song: innocent and warm. 5 at the end pulls back to 1.' },
    { id: 'sadAxis', zh: '6415', name: 'Minor axis', bars: '6m | 4 | 1 | 5', for: ['verse', 'chorus'],
      desc: 'The pop axis started on 6m: darker and more dramatic. A power-ballad and rock favorite.' },
    { id: 'tug', zh: '大三和弦 3', name: 'Major 3 heart-tug', bars: '1 | 3 | 6m | 1/5 | 4 | 1/3 | 2m | 5', for: ['verse', 'chorus'],
      desc: 'Major 3 (borrowed: it is the 5 of 6m) pulls hard into 6m. That pull is the lump-in-the-throat moment of many ballads.' },
    { id: 'climb', zh: '2345 上行', name: 'The climb', bars: '2m | 3m | 4 | 5', for: ['pre'],
      desc: 'Chords step up 2-3-4-5: the pre-chorus builds and hands off to the chorus.' },
    { id: 'hold', zh: '4 · 5 悬停', name: 'Hold before the drop', bars: '4 | 4 | 5sus4 | 5', for: ['pre'],
      desc: 'Stay on 4, then 5sus4 → 5: suspense right before the chorus hits.' },
    { id: 'minorFour', zh: '4 → 4m', name: 'Minor four', bars: '4 | 4m | 3m | 6m | 2m | 5 | 1 | 1', for: ['bridge', 'outro'],
      desc: 'Borrowed 4m after 4: the tear-jerker color. Great for a bridge or the last line of a ballad.' },
    { id: 'stepDown', zh: '43625', name: 'City-pop 7ths', bars: '4maj7 | 3m7,6m7 | 2m7 | 5sus4,5', for: ['verse', 'chorus'],
      desc: '4-3-6-2-5 in 7th chords: a step down from 4 to 3, then the roots fall in fifths (3-6-2-5) and 5 turns it around. City-pop and R&B-flavored Mandopop.' },
    { id: 'vamp', zh: '1 · 4', name: 'Two-chord vamp', bars: '1 | 4 | 1 | 4', for: ['verse', 'intro'],
      desc: 'Lots of space: good for a talky verse where the words carry it.' },
    { id: 'aeolian', zh: '6m 4 5', name: 'Minor rock', bars: '6m | 4 | 5 | 6m', for: ['verse', 'chorus'],
      desc: 'Natural-minor rock: in the minor key this is i-♭VI-♭VII-i. Driving and heroic.' },
    { id: 'mixo', zh: '1 ♭7 4', name: 'Mixolydian rock', bars: '1 | ♭7 | 4 | 1', for: ['verse', 'chorus'],
      desc: 'The ♭7 chord gives classic-rock swagger.' },
    { id: 'lift', zh: '♭6 ♭7 1', name: 'Triumphant lift', bars: '♭6 | ♭7 | 1 | 1', for: ['bridge', 'outro', 'pre'],
      desc: '♭6-♭7-1 (borrowed from minor): a big, heroic rise into the last chorus or the ending.' },
  ];
  const progById = (id) => PROGRESSIONS.find((p) => p.id === id) || null;

  // Swaps for one chord, given what it is. Each: [symbol, why].
  function swapsFor(sym) {
    const c = parseChord(sym);
    if (!c) return [];
    const key = `${accStr(c.acc)}${c.deg}${c.q === 'm' || c.q === 'm7' ? 'm' : ''}`;
    const lists = {
      1: [['1add9', 'add9: open, shimmering (very Mandopop)'], ['1maj7', 'maj7: soft, dreamy'], ['1/3', '3 in the bass: smooth bass line'], ['6m', '6m: shares two notes, sadder'], ['3m', '3m: a gentler stand-in'], ['1sus4', 'sus4: tension, then resolve to 1']],
      '2m': [['2m7', 'm7: smoother'], ['4', '4: shares two notes, brighter'], ['2', 'major 2: leads strongly to 5'], ['4/5', '4 over 5: a soft gospel 5']],
      '3m': [['3m7', 'm7: smoother'], ['3', 'major 3: pulls hard to 6m'], ['1/3', '1 over 3: same bass, brighter'], ['5/7', '5 over 7: a step lower in the bass']],
      4: [['4maj7', 'maj7: dreamy'], ['4add9', 'add9: open'], ['2m', '2m: shares two notes, darker'], ['4m', '4m: borrowed, bittersweet'], ['4/5', '4 over 5: a soft 5'], ['6m', '6m: shares two notes, more wistful']],
      5: [['5sus4', 'sus4: tension that resolves to 5'], ['5/7', '7 in the bass: steps up to 1'], ['3m', '3m: softer than 5'], ['4/5', '4 over 5: a soft 5'], ['♭7', '♭7: rock swagger']],
      '6m': [['6m7', 'm7: smoother'], ['6m/5', '5 in the bass: walk down'], ['4', '4: shares two notes'], ['1/6', 'a quiet, floating 6m7'], ['6', 'major 6: pulls to 2m']],
      7: [['5/7', '5 over 7: the usual stand-in'], ['3m', '3m']],
      3: [['3m', '3m: the plain chord, no pull'], ['3sus4', 'sus4: hold the tension a beat longer'], ['37', '7: pulls even harder to 6m'], ['1/3', '1 over 3: same bass, brighter']],
      2: [['2m', '2m: the plain chord'], ['2m7', 'm7: softer'], ['4', '4: back in the key, still leads to 5']],
      6: [['6m', '6m: the plain chord'], ['6m7', 'm7: smoother'], ['4', '4: back in the key, softer']],
      '4m': [['4', '4: the plain major four'], ['♭6', '♭6: the same borrowed color'], ['2m', '2m']],
      '♭7': [['5', '5: the plain dominant'], ['♭6', '♭6: darker']],
      '♭6': [['4m', '4m: same family, softer'], ['♭7', '♭7']],
    };
    const base = lists[key] || lists[c.deg] || [];
    return base.filter(([s]) => s !== sym);
  }

  // ---------- styles and song forms ----------
  const STYLES = {
    ballad: { id: 'ballad', zh: '抒情', name: 'Ballad', bpm: 68, swing: 0, melisma: 0.55,
      sections: { I: '1 | 5/7 | 6m | 4', V: 'canonWalk', P: 'royal', C: 'tug', B: '4 | 4m | 3m | 6m | 2m | 5 | 5sus4 | 5', O: '4 | 4m | 1 | 1' } },
    pop: { id: 'pop', zh: '流行', name: 'Mandopop', bpm: 92, swing: 0, melisma: 0.35,
      sections: { I: '4 | 5 | 3m | 6m', V: '1 | 5 | 6m | 4 | 1 | 5 | 6m | 4', P: 'climb', C: 'royalHome', B: '6m | 4 | 1 | 5', O: '4 | 5 | 1 | 1' } },
    rock: { id: 'rock', zh: '摇滚', name: 'Rock', bpm: 128, swing: 0, melisma: 0.15,
      sections: { I: '6m | 4 | 5 | 5', V: '6m | 4 | 5 | 6m | 6m | 4 | 5 | 5', P: 'hold', C: '6m | 4 | 1 | 5 | 6m | 4 | 1 | 5', B: 'lift', O: '6m | 4 | 5 | 6m' } },
  };
  const SECTION_TYPES = {
    I: { name: 'Intro', zh: '前奏', role: 'intro', lyrics: false },
    V: { name: 'Verse', zh: '主歌', role: 'verse', lyrics: true },
    P: { name: 'Pre-chorus', zh: '导歌', role: 'pre', lyrics: true },
    C: { name: 'Chorus', zh: '副歌', role: 'chorus', lyrics: true },
    B: { name: 'Bridge', zh: '桥段', role: 'bridge', lyrics: true },
    O: { name: 'Outro', zh: '尾奏', role: 'outro', lyrics: false },
  };
  const FORM = ['I', 'V', 'P', 'C', 'V2', 'P2', 'C2', 'B', 'C', 'O'];

  function progressionBars(spec) {
    const p = progById(spec);
    return parseBars(p ? p.bars : spec);
  }

  // A new song: sections with chords and empty lines, in a style and key.
  function newSong(style = 'ballad', keyPc = 0) {
    const st = STYLES[style];
    const sections = {};
    for (const [id, type] of Object.entries(SECTION_TYPES)) {
      const bars = progressionBars(st.sections[id]);
      const lines = type.lyrics ? Array.from({ length: Math.ceil(bars.length / LINE_BARS) }, () => newLine()) : [];
      sections[id] = { id, bars, lines };
    }
    return { v: 1, title: '', style, key: keyPc, bpm: st.bpm, sections, form: FORM.slice(), created: Date.now(), updated: Date.now() };
  }
  // lyrics[0] is the first time through, lyrics[1] the second (V2, P2, C2 in the form).
  const newLine = () => ({ lyrics: ['', ''], fix: [{}, {}], notes: [] });
  const formEntry = (f) => ({ sec: f[0], take: f.length > 1 && f[1] === '2' ? 1 : 0 });

  // ---------- 简谱 ----------
  // The melody's 1 (do): the key's tonic between G3 and F♯4, so most of a song sits around middle C.
  const doMidi = (keyPc) => 55 + mod12(keyPc - 7);
  const JIANPU = [['1', ''], ['1', '♯'], ['2', ''], ['3', '♭'], ['3', ''], ['4', ''], ['4', '♯'], ['5', ''], ['6', '♭'], ['6', ''], ['7', '♭'], ['7', '']];
  // chord: the chord sounding under the note, if known. A tone the chord alters is written on its
  // own degree: ♯5 over a major 3 (not ♭6), ♭6 over 4m.
  function jianpu(midi, keyPc, chord = null) {
    const semis = midi - doMidi(keyPc);
    let [num, acc] = JIANPU[mod12(semis)];
    if (chord && acc) {
      for (const [plain, tone] of Object.entries(alterations(chord))) {
        if (tone !== mod12(semis)) continue;
        num = Object.keys(DEG).find((d) => DEG[d] === Number(plain));
        acc = mod12(tone - plain) === 1 ? '♯' : '♭';
      }
    }
    return { num, acc, oct: Math.floor(semis / 12) };
  }
  // Plain-text 简谱 for one note: '♯4', '5̣' (low), '1̇' (high).
  function jianpuText(midi, keyPc, chord = null) {
    const j = jianpu(midi, keyPc, chord);
    const dots = j.oct > 0 ? '̇'.repeat(j.oct) : j.oct < 0 ? '̣'.repeat(-j.oct) : '';
    return `${j.acc}${j.num}${dots}`;
  }
  // A line's melody as text, beat by beat: '0 3 56 1̇ - | …'. 0 = rest, - = held.
  // chords: the line's bars (as in chordAt), so altered notes are written on the right degree.
  function melodyText(notes, keyPc, bars = LINE_BARS, chords = null) {
    const beats = [];
    for (let b = 0; b < bars * 4; b++) {
      const t0 = b * TPB;
      const t1 = t0 + TPB;
      const starts = notes.filter((n) => n.t >= t0 && n.t < t1);
      if (starts.length) {
        let s = '';
        if (starts[0].t > t0) s += notes.some((n) => n.t < t0 && n.t + n.d > t0) ? '-' : '0';
        s += starts.map((n) => jianpuText(n.midi, keyPc, chords ? chordAt(chords, n.t) : null)).join('');
        beats.push(s);
      } else {
        const held = notes.some((n) => n.t < t0 && n.t + n.d > t0);
        beats.push(held ? '-' : '0');
      }
    }
    const out = [];
    for (let b = 0; b < bars; b++) out.push(beats.slice(b * 4, b * 4 + 4).join(' '));
    return out.join(' | ');
  }

  // Which syllable each note sings: a note marked m (melisma, 拖腔) carries on the syllable before.
  function align(notes, syl) {
    const out = [];
    let k = -1;
    for (const n of notes) {
      if (!n.m || k < 0) k++;
      out.push(k < syl.length ? k : null);
    }
    return { map: out, used: k + 1, extraSyl: Math.max(0, syl.length - (k + 1)), extraNotes: out.filter((x) => x == null).length };
  }

  // How well a line's melody fits its lyric tones. → { score 0–100, pairs: [{ a, b, fit, … }] }
  function toneCheck(notes, syl) {
    const { map } = align(notes, syl);
    const firstNote = new Map();
    map.forEach((k, i) => { if (k != null && !firstNote.has(k)) firstNote.set(k, i); });
    const pairs = [];
    let total = 0;
    let lost = 0;
    for (let k = 0; k + 1 < syl.length; k++) {
      const a = syl[k];
      const b = syl[k + 1];
      if (!firstNote.has(k) || !firstNote.has(k + 1)) continue;
      if (!a.sung || !b.sung || b.gap === 'comma') continue;
      // From the last note of a's syllable (after any melisma) to the first note of b's.
      const ib = firstNote.get(k + 1);
      const na = notes[ib - 1];
      const nb = notes[ib];
      const j = Zh.judge(a.sung, b.sung, nb.midi - na.midi);
      if (j.want === 'any') continue;
      const weight = 1 + Math.min(1, nb.d / 12); // long notes are heard more clearly
      total += weight;
      if (j.fit === 'bad') lost += weight;
      else if (j.fit === 'ok') lost += weight * 0.35;
      pairs.push({ a: k, b: k + 1, noteA: ib - 1, noteB: ib, ...j });
    }
    return { score: total ? Math.round(100 * (1 - lost / total)) : null, pairs };
  }

  // ---------- melody generator ----------
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const pickWeighted = (rand, items) => {
    const sum = items.reduce((s, [, w]) => s + w, 0);
    let r = rand() * sum;
    for (const [v, w] of items) { r -= w; if (r <= 0) return v; }
    return items[items.length - 1][0];
  };

  // Rhythm for n syllables over a two-bar line, in 16ths. gaps[k] = 'space' | 'comma' before syllable k.
  // → [{ t, d }] in ticks.
  function makeRhythm(n, { style = 'pop', gaps = [], rand = Math.random, endRest = null } = {}) {
    const SLOTS = LINE / S16; // 32
    if (n <= 0) return [];
    const startOpts = {
      ballad: [[0, 2], [2, 3], [4, 3], [6, 1]],
      pop: [[1, 1], [2, 4], [4, 3], [6, 1]],
      rock: [[0, 4], [2, 3], [4, 1]],
    }[style] || [[2, 1]];
    let start = pickWeighted(rand, startOpts);
    let rest = endRest != null ? endRest : pickWeighted(rand, [[2, 2], [4, 3], [6, 1]]);
    let last = pickWeighted(rand, style === 'rock' ? [[4, 3], [6, 2], [8, 1]] : [[4, 2], [6, 2], [8, 2]]);
    const dur = new Array(n).fill(2);
    const room = () => SLOTS - start - rest;
    const used = () => dur.reduce((s, d) => s + d, 0);
    dur[n - 1] = last;
    // Too many syllables: shrink the ending, then the start and the rest, then use 16ths.
    while (used() > room()) {
      if (dur[n - 1] > 2) dur[n - 1]--;
      else if (start > 0) start--;
      else if (rest > 1) rest--;
      else {
        // 16ths in pairs, so the beats after them stay on the grid.
        const k = dur.findIndex((d, i) => d === 2 && i + 1 < n - 1 && dur[i + 1] === 2);
        const k1 = k < 0 ? dur.findIndex((d, i) => d === 2 && i < n - 1) : -1;
        if (k >= 0) { dur[k] = 1; dur[k + 1] = 1; } else if (k1 >= 0) dur[k1] = 1;
        else if (dur[n - 1] > 1) dur[n - 1]--; else if (rest > 0) rest--; else break;
      }
    }
    // Room left over: rests at commas, longer notes before a space or comma, dotted rhythms.
    let spare = room() - used();
    const before = [];
    for (let k = 1; k < n; k++) if (gaps[k]) before.push(k - 1);
    const restBefore = new Array(n).fill(0);
    for (let k = 1; k < n && spare >= 2; k++) if (gaps[k] === 'comma') { restBefore[k] = 2; spare -= 2; }
    for (const k of before) if (spare >= 2 && k < n - 1 && rand() < 0.8) { dur[k] += 2; spare -= 2; }
    // Some long-short pairs (3+1) for lilt, not in ballads' slow verses.
    if (style !== 'ballad') {
      for (let k = 0; k + 1 < n - 1; k++) if (dur[k] === 2 && dur[k + 1] === 2 && rand() < 0.18) { dur[k] = 3; dur[k + 1] = 1; k++; }
    }
    while (spare > 0) {
      const r = rand();
      if (r < 0.35 && dur[n - 1] < 10) { dur[n - 1]++; spare--; } else if (r < 0.55 && start < 6) { start++; spare--; } else {
        const k = Math.floor(rand() * Math.max(1, n - 1));
        if (dur[k] < 4 && k < n - 1) { dur[k] += Math.min(2, spare); spare -= Math.min(2, spare); } else { rest++; spare--; }
      }
    }
    const out = [];
    let at = start;
    for (let k = 0; k < n; k++) {
      at += restBefore[k];
      out.push({ t: at * S16, d: dur[k] * S16 });
      at += dur[k];
    }
    return out;
  }

  const MAJOR = [0, 2, 4, 5, 7, 9, 11];
  const RANGES = { verse: [-5, 7], pre: [-3, 9], chorus: [0, 16], bridge: [-3, 12], intro: [-5, 12], outro: [-5, 12] };
  const CENTER = { verse: 2, pre: 5, chorus: 9, bridge: 6, intro: 4, outro: 4 };

  // Set a lyric line to a melody over its two bars of chords.
  // syl: Zh.syllables(); bars: [['1'], ['5/7']]; → notes [{ t, d, midi, m? }]
  function suggestMelody(syl, { bars, keyPc = 0, role = 'verse', style = 'pop', prevMidi = null, lastLine = false, toneWeight = 1, seed = (Math.random() * 2 ** 32) >>> 0, rhythm = null } = {}) {
    const rand = rng(seed);
    const n = syl.length;
    if (!n) return [];
    const rh = rhythm && rhythm.length === n ? rhythm : makeRhythm(n, { style, gaps: syl.map((s) => s.gap), rand });
    const tonic = doMidi(keyPc);
    const [lo, hi] = RANGES[role] || RANGES.verse;
    const cands = [];
    for (let s = lo; s <= hi; s++) if (MAJOR.includes(mod12(s))) cands.push(tonic + s);
    const pent = new Set([0, 2, 4, 7, 9]);
    const center = tonic + (CENTER[role] || 4);
    const arch = role === 'chorus' ? 4 : role === 'pre' ? 3 : 1.5;

    const chordPcsAt = (t) => { const sym = chordAt(bars, t); const ci = sym && chordInfo(sym, keyPc); return ci ? ci.pcs : []; };
    // Over a chord from outside the key, the melody takes the chord's version of a note, not the
    // key's: ♯5 over a major 3, ♭6 over 4m, ♭7 over ♭7. The plain note would clash by a half step.
    const candsAt = (t) => {
      const alt = alterations(chordAt(bars, t));
      return cands.map((q) => { const to = alt[mod12(q - tonic)]; return to == null ? q : q + (mod12(to - (q - tonic)) === 1 ? 1 : -1); });
    };
    const noise = () => (rand() - 0.5) * 1.6;
    let beam = [{ seq: [], score: 0, last: prevMidi, move: 0 }];
    for (let k = 0; k < n; k++) {
      const { t, d } = rh[k];
      const pcs = chordPcsAt(t);
      const strong = t % (TPB * 2) === 0;
      const onBeat = t % TPB === 0;
      const isLast = k === n - 1;
      const x = n > 1 ? k / (n - 1) : 0.5;
      const target = center + arch * Math.sin(Math.PI * Math.min(1, x * 1.1)) - (isLast ? 2 : 0);
      const next = [];
      const here = candsAt(t);
      for (const st of beam) {
        for (const q of here) {
          let sc = st.score;
          const inChord = pcs.includes(mod12(q));
          const deg = mod12(q - tonic);
          if (inChord) sc += (strong ? 2 : onBeat ? 1 : 0.4) * (1 + Math.min(1, d / 12));
          else if (d >= 6 && (strong || onBeat)) sc -= 2.2;
          else if (strong) sc -= 0.8;
          if (!pent.has(deg) && !inChord) sc -= 0.6;
          sc -= 0.09 * Math.abs(q - target);
          if (st.last != null) {
            const iv = q - st.last;
            const a = Math.abs(iv);
            sc += a === 0 ? (role === 'verse' ? 0.45 : 0.1) : a <= 2 ? 1 : a <= 4 ? 0.4 : a === 5 ? -0.2 : a === 7 ? -0.6 : a === 6 ? -1.8 : -2.6;
            if (Math.abs(st.move) >= 5) sc += Math.sign(iv) === -Math.sign(st.move) && a <= 3 ? 0.8 : -0.8;
            if (k > 0) {
              const prev = syl[k - 1];
              const cur = syl[k];
              if (prev.sung && cur.sung && cur.gap !== 'comma') {
                const j = Zh.judge(prev.sung, cur.sung, iv);
                if (j.want !== 'any') sc += toneWeight * (j.fit === 'good' ? 1.2 : j.fit === 'ok' ? -0.7 : -3.2);
              }
            } else if (a > 4) sc -= 0.6; // first note: close to the end of the last line
          }
          // A 3rd-tone syllable at the line's peak sounds strained; a 1st tone held high sings well.
          if (syl[k].sung === 3 && q >= center + arch + 2) sc -= 0.8;
          if (syl[k].sung === 1 && d >= 6 && q >= center) sc += 0.3;
          if (isLast) {
            sc += inChord ? 2.5 : -3;
            if (lastLine && role === 'chorus') sc += deg === 0 ? 2 : -0.5;
            if (lastLine && role === 'pre' && deg === 0) sc -= 1; // leave the pre-chorus open
          }
          next.push({ seq: st.seq.concat(q), score: sc + noise(), last: q, move: st.last == null ? 0 : q - st.last });
        }
      }
      next.sort((p, q) => q.score - p.score);
      // Keep the beam varied: at most a few states per ending note.
      const seen = new Map();
      beam = [];
      for (const st of next) {
        const c = seen.get(st.last) || 0;
        if (c >= 4) continue;
        seen.set(st.last, c + 1);
        beam.push(st);
        if (beam.length >= 36) break;
      }
    }
    const top = beam.slice(0, 3);
    const best = top[Math.floor(rand() * Math.min(top.length, rand() < 0.6 ? 1 : 3))];
    const notes = rh.map((r, k) => ({ t: r.t, d: r.d, midi: best.seq[k] }));
    // A melisma (拖腔) on the last word: a note above that falls to the landing note.
    const STYLE = STYLES[style] || STYLES.pop;
    const end = notes[notes.length - 1];
    if (end.d >= 4 * S16 && rand() < STYLE.melisma) {
      const above = candsAt(end.t).find((c) => c > end.midi);
      if (above != null) {
        const first = { t: end.t, d: 2 * S16, midi: above };
        notes.splice(notes.length - 1, 1, first, { t: end.t + first.d, d: end.d - first.d, midi: end.midi, m: true });
      }
    }
    return notes;
  }

  // Captured notes ({ time s from the line start, midi }) → notes on the 16th grid.
  function quantize(events, { secPerTick, length = LINE, minDur = S16 } = {}) {
    const snapped = [];
    for (const e of events) {
      const t = Math.round(e.time / secPerTick / S16) * S16;
      if (t < 0 || t >= length) continue;
      const midi = Math.round(e.midi);
      const prev = snapped[snapped.length - 1];
      if (prev && prev.t === t) { prev.midi = midi; continue; } // two notes in one 16th: keep the later
      snapped.push({ t, midi });
    }
    const notes = snapped.map((n, i) => {
      const nextT = i + 1 < snapped.length ? snapped[i + 1].t : Math.min(length, n.t + TPB * 2);
      return { t: n.t, d: Math.max(minDur, nextT - n.t), midi: n.midi };
    });
    return notes.filter((n) => n.d >= minDur);
  }

  // Move a note by scale steps (diatonic in the key), or by semitones when chromatic.
  function stepNote(midi, steps, keyPc, chromatic = false) {
    if (chromatic) return midi + steps;
    const tonic = doMidi(keyPc);
    let m = midi;
    const dir = Math.sign(steps);
    for (let k = 0; k < Math.abs(steps); k++) {
      do { m += dir; } while (!MAJOR.includes(mod12(m - tonic)));
    }
    return m;
  }

  // ---------- a lead sheet as text ----------
  function leadSheet(song) {
    const out = [];
    const st = STYLES[song.style] || STYLES.pop;
    out.push(song.title || 'Untitled song');
    out.push(`1 = ${keyName(song.key)} · 4/4 · ${song.bpm} bpm · ${st.zh} ${st.name}`);
    out.push('');
    const done = new Set();
    for (const f of song.form) {
      const { sec, take } = formEntry(f);
      const s = song.sections[sec];
      const type = SECTION_TYPES[sec];
      if (!s) continue;
      const label = `${type.zh} ${type.name}${take ? ' (2)' : ''}`;
      if (done.has(f)) { out.push(`[${label}] (repeat)`); out.push(''); continue; }
      done.add(f);
      out.push(`[${label}]`);
      if (!type.lyrics || !s.lines.length) {
        out.push(`  ${s.bars.map((b) => b.map((c) => chordName(c, song.key)).join(' ')).join(' | ')}`);
      }
      s.lines.forEach((ln, i) => {
        const bars = s.bars.slice(i * LINE_BARS, i * LINE_BARS + LINE_BARS);
        out.push(`  ${bars.map((b) => b.map((c) => chordName(c, song.key)).join(' ')).join(' | ')}`);
        if (ln.notes.length) out.push(`  ${melodyText(ln.notes, song.key, LINE_BARS, bars)}`);
        const words = (ln.lyrics[take] || ln.lyrics[0] || '').trim();
        if (words) out.push(`  ${words}`);
      });
      out.push('');
    }
    return out.join('\n');
  }

  const api = {
    TPB, BAR, LINE, LINE_BARS, S16, KEYS, FLAT_KEYS, keyName,
    parseChord, chordSym, chordInfo, chordName, chordNum, degreeName, alterations, parseBars, barsToString, chordAt,
    PROGRESSIONS, progById, swapsFor, STYLES, SECTION_TYPES, FORM, progressionBars, newSong, newLine, formEntry,
    doMidi, jianpu, jianpuText, melodyText, align, toneCheck, rng, makeRhythm, suggestMelody, quantize, stepNote, leadSheet,
  };
  root.SongTheory = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
