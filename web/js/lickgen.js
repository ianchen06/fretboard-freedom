// Lick generator for the Call & response practice (no DOM, runs in Node for the tests).
//
// - parse: the library's tab tokens → notes { t, d, s, r, bend, tech, vib }, where r is the fret
//   relative to the box's root fret (low E string), so a lick moves to any key by shifting frets.
// - check: the rules every phrase must follow (scale, reach, bends, legato, timing). The tests run
//   it over the whole library; the generator runs it over everything it builds.
// - fit: how well a phrase sits on the chords under it. Strong beats, long notes and above all the
//   last note should be chord tones (or the blue ♭3); a landing note has to work over the chord of
//   the call and the chord of your answer, because you play the same notes two bars later.
// - LickGen: builds every phrase it can (whole licks, two cells joined, single cells), then picks
//   one that fits the chords at your level, avoiding recent ones. retarget() swaps the ending of a
//   phrase so it lands on a chord tone of new chords (what players do when they reuse a lick).
// - grade: lines up the notes you played with the lick's notes, in order.
(function (root) {
  'use strict';
  const T = root.Theory || (typeof require !== 'undefined' ? require('./theory.js') : null);

  const TPB = 12; // ticks per beat
  const BAR = 48; // ticks per bar (4/4)
  const PHRASE = 2 * BAR;
  const STRING_OF = { E: 6, A: 5, D: 4, G: 3, B: 2, e: 1 };
  const LETTER_OF = { 6: 'E', 5: 'A', 4: 'D', 3: 'G', 2: 'B', 1: 'e' };
  const OPEN = T.TUNINGS.standard.open;
  // Each string's open note above the low E, in semitones mod 12: a note's scale degree in the
  // key is (OFFSET[s] + r + bend) mod 12, whatever the key.
  const OFFSET = { 6: 0, 5: 5, 4: 10, 3: 3, 2: 7, 1: 0 };
  const DEGREE_NAME = ['R', '♭2', '9', '♭3', '3', '4', '♭5', '5', '♭6', '6', '♭7', '7'];
  const CORE = [0, 3, 5, 7, 10]; // minor pentatonic
  const COLOR = [2, 4, 6, 9]; // 9th, major 3rd (the curl), blue ♭5, 6th: passing notes only
  const mod12 = (n) => ((n % 12) + 12) % 12;

  // Over a dominant 7 chord: interval above the chord root → tension (0 = chord tone, 1 = clash).
  const TENSION = { 0: 0, 4: 0, 7: 0, 10: 0, 2: 0.3, 9: 0.3, 3: 0.4, 6: 0.6, 5: 0.7, 1: 0.9, 8: 0.9, 11: 1 };
  const LANDING_MAX = 0.4; // a last note must be a chord tone, a 9th/13th, or the blue ♭3

  const CHORD_ROOT = { I: 0, IV: 5, V: 7 };
  const PROGRESSIONS = {
    twelve: { id: 'twelve', name: '12-bar blues', bars: ['I', 'I', 'I', 'I', 'IV', 'IV', 'I', 'I', 'V', 'IV', 'I', 'V'] },
    quick: { id: 'quick', name: '12-bar, quick change', bars: ['I', 'IV', 'I', 'I', 'IV', 'IV', 'I', 'I', 'V', 'IV', 'I', 'V'] },
    vamp: { id: 'vamp', name: 'One-chord vamp', bars: ['I', 'I', 'I', 'I'] },
  };

  // ---------- parsing ----------
  const TOKEN = /^([hps]?)([EADGBe])(\d+)(?:b(\d+)|(r))?(~?)$/;

  function parseToken(tok) {
    const m = TOKEN.exec(tok);
    if (!m) throw new Error(`Bad tab token: ${tok}`);
    const f = Number(m[3]);
    return {
      s: STRING_OF[m[2]],
      f,
      bend: m[4] ? Number(m[4]) - f : 0,
      tech: m[5] ? 'rel' : ({ h: 'h', p: 'p', s: 's' }[m[1]] || 'pick'),
      vib: m[6] === '~',
    };
  }

  // [[tick, token, dur], ...] written at refRootFret → notes relative to the box root.
  function parseNotes(list, refRootFret) {
    return list.map(([t, tok, d]) => {
      const p = parseToken(tok);
      return { t, d, s: p.s, r: p.f - refRootFret, bend: p.bend, tech: p.tech, vib: p.vib };
    });
  }

  const degreeOf = (n) => mod12(OFFSET[n.s] + n.r + n.bend);
  const fretDegreeOf = (n) => mod12(OFFSET[n.s] + n.r);
  // Pitch with the root at fret 5 (key of A): only differences matter.
  const refMidi = (n) => OPEN[n.s] + 5 + n.r + n.bend;

  // ---------- rules ----------
  function check(notes, length = PHRASE) {
    const errs = [];
    if (!notes.length) return ['no notes'];
    const rs = [];
    notes.forEach((n, i) => {
      const at = `note ${i + 1}`;
      const prev = notes[i - 1];
      if (!(n.s >= 1 && n.s <= 6)) errs.push(`${at}: bad string ${n.s}`);
      if (n.t < 0 || n.d < 3 || n.t + n.d > length) errs.push(`${at}: timing ${n.t}+${n.d} outside 0–${length}`);
      if (prev && n.t <= prev.t) errs.push(`${at}: starts before the note in front of it`);
      if (n.r < -3 || n.r > 5) errs.push(`${at}: fret ${n.r} is outside the box`);
      rs.push(n.r);
      const deg = degreeOf(n);
      const fdeg = fretDegreeOf(n);
      if (n.bend) {
        if (n.s > 4) errs.push(`${at}: bends on the low strings won't sound`);
        if (!CORE.includes(fdeg)) errs.push(`${at}: bend starts off the scale (${DEGREE_NAME[fdeg]})`);
        if (n.bend === 2 && !CORE.includes(deg)) errs.push(`${at}: bend lands off the scale (${DEGREE_NAME[deg]})`);
        if (n.bend === 1 && deg !== 4) errs.push(`${at}: half-step bends only curl the ♭3 up to the 3rd`);
        if (n.bend > 2) errs.push(`${at}: bends wider than a whole step`);
      } else if (!CORE.includes(deg)) {
        if (!COLOR.includes(deg)) errs.push(`${at}: ${DEGREE_NAME[deg]} isn't in the blues scale`);
        else if (n.d > 8 || i === notes.length - 1) errs.push(`${at}: ${DEGREE_NAME[deg]} is a passing note, it can't be held`);
      }
      const joined = prev && n.t <= prev.t + prev.d; // no gap: needed for legato and releases
      if (n.tech === 'rel') {
        if (!prev || prev.s !== n.s || prev.r !== n.r || !prev.bend || !joined) errs.push(`${at}: a release needs a bend on the same fret right before it`);
      } else if (n.tech === 'h' || n.tech === 'p') {
        const up = prev && n.r - prev.r;
        const ok = prev && prev.s === n.s && joined && !prev.bend && (n.tech === 'h' ? up >= 1 && up <= 4 : up <= -1 && up >= -4);
        if (!ok) errs.push(`${at}: ${n.tech === 'h' ? 'hammer-on' : 'pull-off'} needs a note on the same string right before it`);
      } else if (n.tech === 's' && prev) {
        const dist = Math.abs(n.r - prev.r);
        if (prev.s !== n.s || !joined || dist < 1 || dist > 5 || prev.bend) errs.push(`${at}: a slide needs a note on the same string right before it`);
      }
    });
    if (rs.length && Math.max(...rs) - Math.min(...rs) > 4) errs.push('needs a stretch wider than 4 frets');
    if (density(notes) > 4) errs.push('more than 4 notes in one beat');
    const last = notes[notes.length - 1];
    if (last.d < 12) errs.push('the last note should ring for at least a beat');
    return errs;
  }

  // Most note starts in any one-beat window.
  function density(notes) {
    let best = 0;
    for (let i = 0; i < notes.length; i++) {
      let c = 0;
      for (let j = i; j < notes.length && notes[j].t < notes[i].t + TPB; j++) c++;
      best = Math.max(best, c);
    }
    return best;
  }

  function levelOf(notes) {
    const techs = notes.filter((n) => n.bend || n.tech !== 'pick').length;
    const bends = notes.filter((n) => n.bend).length;
    const dens = density(notes);
    if (notes.length <= 5 && dens <= 2 && techs === 0) return 1;
    if (notes.length <= 10 && dens <= 3 && bends <= 3) return 2;
    return 3;
  }

  // ---------- harmony ----------
  // ctx = { call: [root, root], resp: [root, root] }: chord roots (semitones above the key) under
  // the two bars of the call and the two bars of your answer.
  function slotContext(bars, slot) {
    const b = (i) => CHORD_ROOT[bars[(slot * 4 + i) % bars.length]];
    return { call: [b(0), b(1)], resp: [b(2), b(3)] };
  }

  const tensionOver = (deg, roots) => Math.max(...roots.map((r) => TENSION[mod12(deg - r)]));

  function rootsUnder(n, ctx) {
    const roots = [];
    const bars = n.t < BAR ? (n.t + n.d > BAR + TPB ? [0, 1] : [0]) : [1];
    for (const b of bars) roots.push(ctx.call[b], ctx.resp[b]);
    return roots;
  }

  function fit(notes, ctx) {
    let sum = 0;
    let wsum = 0;
    let longClash = false;
    notes.forEach((n, i) => {
      const deg = degreeOf(n);
      const tens = tensionOver(deg, rootsUnder(n, ctx));
      const beatW = n.t % (2 * TPB) === 0 ? 1 : n.t % TPB === 0 ? 0.6 : 0.25;
      const w = i === notes.length - 1 ? 4 : beatW * (n.d >= TPB ? 1.6 : 1);
      sum += w * tens;
      wsum += w;
      if (tens >= 0.9 && n.d >= TPB) longClash = true;
    });
    const last = notes[notes.length - 1];
    const landingTension = tensionOver(degreeOf(last), rootsUnder(last, ctx));
    return { score: sum / wsum, landingTension, fits: landingTension <= LANDING_MAX && !longClash };
  }

  // ---------- phrases ----------
  const lastOf = (notes) => notes[notes.length - 1];
  const cloneNotes = (notes) => notes.map((n) => ({ ...n }));

  function makePhrase(id, name, kind, notes) {
    return { id, name, kind, notes, level: levelOf(notes) };
  }

  // Two cells, one per bar. The first cell's last note stops where the second starts.
  function joinCells(a, b) {
    const first = cloneNotes(a.notes);
    const second = cloneNotes(b.notes).map((n) => ({ ...n, t: n.t + BAR }));
    const tail = lastOf(first);
    const head = second[0];
    if (head.tech !== 'pick' && head.tech !== 's') return null;
    if (Math.abs(refMidi(tail) - refMidi(head)) > 7) return null; // too big a leap between the bars
    tail.d = Math.min(tail.d, head.t - tail.t);
    if (tail.d < 3) return null;
    return [...first, ...second];
  }

  // A single cell: its last note rings on into the second bar.
  function singleCell(c) {
    const notes = cloneNotes(c.notes);
    const tail = lastOf(notes);
    tail.d = Math.min(PHRASE - tail.t, tail.d + 2 * TPB);
    return notes;
  }

  function buildPhrases(lib) {
    const ref = lib.refRootFret;
    const cells = lib.cells.map((c) => ({ ...c, notes: parseNotes(c.notes, ref) }));
    const out = [];
    const rejected = [];
    const add = (p) => {
      const errs = check(p.notes);
      if (errs.length) rejected.push({ id: p.id, errs });
      else out.push(p);
    };
    for (const l of lib.licks) add(makePhrase(l.id, l.name, 'lick', parseNotes(l.notes, ref)));
    const opens = cells.filter((c) => c.role !== 'end');
    const ends = cells.filter((c) => c.role !== 'open');
    for (const a of opens) {
      for (const b of ends) {
        if (a.id === b.id) continue;
        const notes = joinCells(a, b);
        if (notes) add(makePhrase(`${a.id}+${b.id}`, `${a.name} → ${b.name}`, 'combo', notes));
      }
    }
    for (const c of ends) add(makePhrase(c.id, c.name, 'cell', singleCell(c)));
    return { phrases: out, rejected, cells };
  }

  // Every scale spot in the box that can end a phrase: [{ s, r, bend }].
  function landingSpots() {
    const spots = [];
    for (let s = 1; s <= 6; s++) {
      for (let r = -1; r <= 4; r++) {
        if (CORE.includes(mod12(OFFSET[s] + r))) spots.push({ s, r, bend: 0 });
        if (s <= 4 && CORE.includes(mod12(OFFSET[s] + r)) && CORE.includes(mod12(OFFSET[s] + r + 2))) spots.push({ s, r, bend: 2 });
      }
    }
    return spots;
  }
  const SPOTS = landingSpots();

  class LickGen {
    constructor(lib, { rng = Math.random } = {}) {
      const built = buildPhrases(lib);
      this.phrases = built.phrases;
      this.rejected = built.rejected;
      this.cells = built.cells;
      this.rng = rng;
      this.byId = new Map(this.phrases.map((p) => [p.id, p]));
    }

    // A phrase for these chords at this level, avoiding ids in `avoid`.
    pick({ level = 2, ctx, avoid = new Set() }) {
      const items = [];
      for (const p of this.phrases) {
        const lw = p.level === level ? 1 : p.level === level - 1 ? 0.2 : 0;
        if (!lw) continue;
        // A phrase that doesn't land on these chords can still be used with a new ending.
        let q = p;
        let f = fit(p.notes, ctx);
        let endW = 1;
        if (!f.fits) {
          q = this.retarget(p, ctx);
          if (!q) continue;
          f = fit(q.notes, ctx);
          endW = 0.4;
        }
        const kindW = p.kind === 'lick' ? 3 : p.kind === 'cell' ? (level === 1 ? 2 : 0.5) : 1;
        const w = lw * kindW * endW * Math.exp(-4 * f.score) * (avoid.has(p.id) ? 0.02 : 1);
        items.push({ p: q, w });
      }
      if (!items.length) {
        // Nothing lands on these chords as written: re-end the closest-level phrase.
        const pool = this.phrases.filter((p) => p.level <= level).sort((a, b) => b.level - a.level);
        for (const p of pool) {
          const r = this.retarget(p, ctx);
          if (r) return r;
        }
        return null;
      }
      let x = this.rng() * items.reduce((a, it) => a + it.w, 0);
      for (const it of items) { x -= it.w; if (x <= 0) return it.p; }
      return items[items.length - 1].p;
    }

    // The same phrase with its last note moved, if needed, to a spot that works over ctx.
    retarget(phrase, ctx) {
      if (fit(phrase.notes, ctx).fits) return phrase;
      const notes = cloneNotes(phrase.notes);
      const last = lastOf(notes);
      const prev = notes[notes.length - 2];
      const roots = rootsUnder(last, ctx);
      let best = null;
      for (const sp of SPOTS) {
        const cand = { ...last, s: sp.s, r: sp.r, bend: sp.bend, tech: 'pick' };
        if (tensionOver(degreeOf(cand), roots) > LANDING_MAX) continue;
        if (prev && Math.abs(refMidi(cand) - refMidi(prev)) > 7) continue;
        const cost = Math.abs(refMidi(cand) - refMidi(last)) + 0.6 * Math.abs(cand.s - last.s) + (sp.bend ? 1.5 : 0) + (prev ? 0.3 * Math.abs(refMidi(cand) - refMidi(prev)) : 0);
        if (!best || cost < best.cost) best = { cand, cost };
      }
      if (!best) return null;
      best.cand.changed = true;
      notes[notes.length - 1] = best.cand;
      if (check(notes).length || !fit(notes, ctx).fits) return null;
      const p = makePhrase(`${phrase.id}>${best.cand.s}.${best.cand.r}.${best.cand.bend}`, phrase.name, phrase.kind, notes);
      p.retargetedFrom = phrase.id;
      return p;
    }
  }

  // ---------- keys ----------
  // Fret of the root on the low E string for box 1, kept between 3 and 14 so slides from below and
  // bends above stay on the neck.
  function rootFret(keyPc) {
    const f = mod12(keyPc - 4);
    return f < 3 ? f + 12 : f;
  }

  // Notes with real frets and pitches for a key.
  function inKey(phrase, keyPc) {
    const R = rootFret(keyPc);
    return phrase.notes.map((n) => ({
      ...n,
      fret: R + n.r,
      fretMidi: OPEN[n.s] + R + n.r,
      midi: OPEN[n.s] + R + n.r + n.bend,
      degree: degreeOf(n),
    }));
  }

  // The box itself: the five pentatonic spots on each string, plus the blue ♭5, for the fretboard.
  const BOX1 = { 6: [0, 3], 5: [0, 2], 4: [0, 2], 3: [0, 2], 2: [0, 3], 1: [0, 3] };
  function boxSpots(keyPc) {
    const R = rootFret(keyPc);
    const out = [];
    for (let s = 1; s <= 6; s++) {
      for (const r of BOX1[s]) out.push({ s, f: R + r, degree: mod12(OFFSET[s] + r), blue: false });
      for (let r = 0; r <= 3; r++) if (mod12(OFFSET[s] + r) === 6) out.push({ s, f: R + r, degree: 6, blue: true });
    }
    return out;
  }

  // ---------- grading ----------
  // expected: [{ midi, alt?: [midi], soft?: bool, time }]; heard: [{ midi, t }], both in seconds
  // from the start of your answer. octave: the octave must match too (else any octave counts).
  // Returns { results: [{ status: hit|alt|miss|soft, heard, offset }], score, pass, required, extras, offset }.
  function grade(expected, heard, { octave = true } = {}) {
    const n = expected.length;
    const m = heard.length;
    const same = (a, b) => (octave ? a === b : mod12(a) === mod12(b));
    const gain = (e, h) => {
      if (same(h.midi, e.midi)) return 1;
      if (e.alt && e.alt.some((a) => same(h.midi, a))) return 0.8;
      return 0;
    };
    const EXTRA = -0.05;
    const dp = Array.from({ length: n + 1 }, () => new Float64Array(m + 1));
    for (let j = 1; j <= m; j++) dp[0][j] = dp[0][j - 1] + EXTRA;
    for (let i = 1; i <= n; i++) {
      for (let j = 0; j <= m; j++) {
        let best = dp[i - 1][j];
        if (j > 0) {
          best = Math.max(best, dp[i][j - 1] + EXTRA);
          const g = gain(expected[i - 1], heard[j - 1]);
          if (g > 0) best = Math.max(best, dp[i - 1][j - 1] + g);
        }
        dp[i][j] = best;
      }
    }
    const results = expected.map((e) => ({ status: e.soft ? 'soft' : 'miss', heard: null, offset: null }));
    let i = n;
    let j = m;
    const eq = (a, b) => Math.abs(a - b) < 1e-9;
    while (i > 0 && j > 0) {
      const g = gain(expected[i - 1], heard[j - 1]);
      if (g > 0 && eq(dp[i][j], dp[i - 1][j - 1] + g)) {
        results[i - 1] = { status: g === 1 ? 'hit' : 'alt', heard: heard[j - 1], offset: heard[j - 1].t - expected[i - 1].time };
        i--; j--;
      } else if (eq(dp[i][j], dp[i - 1][j])) i--;
      else j--;
    }
    const req = expected.map((e, k) => (e.soft ? null : results[k])).filter(Boolean);
    const got = req.filter((r) => r.status === 'hit' || r.status === 'alt').length;
    const matched = results.filter((r) => r.heard);
    const offsets = matched.map((r) => r.offset).sort((a, b) => a - b);
    const offset = offsets.length ? offsets[Math.floor(offsets.length / 2)] : null;
    const score = req.length ? got / req.length : 0;
    return { results, score, pass: score >= 0.8, required: req.length, hits: got, extras: m - matched.length, offset };
  }

  // What the mic heard, as a note list: every reported note (pick attacks), plus pitches the
  // detector held for a moment without a pick (bend targets, hammer-ons, slides), which the note
  // tracker deliberately doesn't report. frames: [{ t, midi|null }]; events: [{ t, midi }].
  function collectHeard(events, frames, { minHold = 0.06, near = 0.12 } = {}) {
    const segs = [];
    let run = null;
    const close = () => { if (run && run.end - run.t >= minHold) segs.push({ midi: run.midi, t: run.t }); run = null; };
    for (const f of frames) {
      if (f.midi == null) { close(); continue; }
      if (run && run.midi === f.midi) run.end = f.t;
      else { close(); run = { midi: f.midi, t: f.t, end: f.t }; }
    }
    close();
    const out = events.map((e) => ({ midi: e.midi, t: e.t }));
    for (const s of segs) {
      if (out.some((e) => e.midi === s.midi && Math.abs(e.t - s.t) <= near)) continue;
      const before = out.filter((e) => e.t <= s.t).sort((a, b) => b.t - a.t)[0];
      if (before && before.midi === s.midi) continue; // the same note still ringing
      out.push({ midi: s.midi, t: s.t, glide: true });
    }
    return out.sort((a, b) => a.t - b.t);
  }

  // Grading list for a phrase played in a key: the bent pitch counts, the unbent fret is accepted
  // (the detector often misses the top of a bend); legato and releases are optional.
  function expectedFor(notes, secPerTick) {
    return notes.map((n) => ({
      midi: n.midi,
      alt: n.bend ? [n.fretMidi] : [],
      soft: n.tech === 'h' || n.tech === 'p' || n.tech === 'rel',
      time: n.t * secPerTick,
    }));
  }

  const describeDegree = (deg) => DEGREE_NAME[mod12(deg)];

  const api = {
    TPB, BAR, PHRASE, PROGRESSIONS, CHORD_ROOT, DEGREE_NAME, LETTER_OF, CORE, COLOR,
    parseToken, parseNotes, check, density, levelOf, fit, slotContext, buildPhrases, LickGen,
    rootFret, inKey, boxSpots, grade, collectHeard, expectedFor, degreeOf, describeDegree, tensionOver, rootsUnder,
  };
  root.LickGen = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
