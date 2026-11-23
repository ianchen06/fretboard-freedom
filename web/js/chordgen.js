// Chord progression generator (no DOM). A model learned from the chords of 691 Chinese pop songs
// (js/chorddata.js), steered by rules, so each call writes a new progression for a part of a song.
//
// The model. A variable-order Markov chain over bars: the next bar ("4" or "3m,6m", half a bar each)
// given the part of the song (intro, verse, pre-chorus, chorus, bridge, outro) and up to two bars
// before it, backing off part + 2 bars → part + 1 → any part + 1 → the part's chords → all chords, with
// interpolated absolute discounting (Ney, Essen & Kneser 1994; the smoothing family Chen & Goodman,
// "An empirical study of smoothing techniques for language modeling", 1999, found best). Patterns
// with context count once per song, the idea behind Kneser–Ney's continuation counts: a chorus sung
// four times is one habit. We tested the choices on songs held out of training: with Witten–Bell and
// raw counts, longer contexts made the model worse on unseen songs (perplexity 58 with no context,
// 97 with three bars); counted once per song with discounting, one or two bars of context bring it
// to 49 and three bars to 52. So two bars: as good as one, and two-bar patterns stay together.
// A mood (songs in major or minor keys) or a flavor (one artist) adds those songs' own counts on top,
// with a Dirichlet prior on the full model (MacKay & Peto 1995; see adapt). Measured on held-out
// songs, an artist's other songs never predicted their next song better than the whole corpus did
// (17 Jay Chou and 8 JJ Lin songs are too few), so the page offers the mood only.
// We chose a Markov model, not a neural one: 691 songs is small for a transformer (ChordSeqAI,
// github.com/StudentTraineeCenter/chord-seq-ai, trains one on 22,367 songs from Ultimate Guitar), and a
// counted model can be steered exactly, says where its chords come from, and runs instantly offline.
//
// The rules. (1) Constraints: bars you lock, and how a phrase and a part end. Following Pachet, Roy &
// Barbieri ("Finite-length Markov processes with constraints", IJCAI 2011), each step is weighted by
// how likely the rest of the sequence can still meet them, computed backwards over a first-order
// version of the model, so locks and endings shape the bars before them instead of being forced in.
// (We worked from that paper's abstract; its full text was not reachable from here.) (2) Phrases: a
// part longer than 4 bars is built from 4-bar phrases, and the second phrase repeats the first one's
// opening as often as POP909's own phrases do (measured by gen-chorddata's data: back-to-back chorus
// phrases repeat exactly 24% of the time and keep 3, 2 or 1 opening bars 24%, 15% and 13%). (3) No
// copying: in the spirit of Papadopoulos, Roy & Pachet ("Avoiding plagiarism in Markov sequence
// generation", AAAI 2014, also read as an abstract only), a progression that repeats 6 or more bars of a
// song in a row is rejected. Short ones can't help it: 4-5-3m-6m is in hundreds of songs, so instead
// we say which song it comes from. (4) Adventure: a temperature on the model's choices, and a cap on
// chords from outside the key when you want it familiar.
(function (root) {
  'use strict';
  const Data = root.ChordData || (typeof require !== 'undefined' ? require('./chorddata.js') : null);

  const ROLE = { intro: 'I', verse: 'V', pre: 'P', chorus: 'C', bridge: 'B', outro: 'O' };
  const ROLE_NAME = { I: 'intro', V: 'verse', P: 'pre-chorus', C: 'chorus', B: 'bridge', O: 'outro' };
  const BOS = '^';
  // How the 2nd 4-bar phrase of a part starts: [opening bars repeated from the 1st phrase, share].
  // Measured on back-to-back phrases of the same part in POP909 (verse 284 pairs, chorus 421).
  const REPEAT = {
    V: [[4, 0.25], [3, 0.08], [2, 0.09], [1, 0.22], [0, 0.36]],
    C: [[4, 0.24], [3, 0.24], [2, 0.15], [1, 0.13], [0, 0.24]],
  };
  REPEAT.P = REPEAT.C; REPEAT.B = REPEAT.V; REPEAT.I = REPEAT.V; REPEAT.O = REPEAT.V;
  const MAX_COPY = 6; // bars in a row from one song that a progression may not repeat
  const FLAVOR_ALPHA = 100; // how many songs' worth the base model counts against a flavor's own (see adapt)

  // ---------- chord symbols ----------
  const SYM = /^([♭♯]?)([1-7])(maj7|m7b5|madd9|m7|m|7|sus4|sus2|add9|5|dim)?(?:\/([♭♯]?[1-7]))?$/;
  // Without colors: 7ths, sus and add9 become the plain triad; the bass of a slash chord stays.
  function plainChord(sym) {
    const m = sym.match(SYM);
    if (!m) return sym;
    const q = { m7: 'm', madd9: 'm', m7b5: 'dim', m: 'm', dim: 'dim' }[m[3]] || '';
    return `${m[1]}${m[2]}${q}${m[4] ? `/${m[4]}` : ''}`;
  }
  function plainBar(tok) {
    const [a, b] = tok.split(',').map(plainChord);
    return b && b !== a ? `${a},${b}` : a;
  }
  // In the key: no accidental, and the key's own quality (1 4 5 major, 2 3 6 minor, 7 diminished).
  const DIATONIC = { 1: ['', 'maj7', 'add9', 'sus2', 'sus4', '5'], 2: ['m', 'm7', 'madd9', 'sus2', 'sus4', '5'], 3: ['m', 'm7', 'sus4', '5'], 4: ['', 'maj7', 'add9', 'sus2', '5'], 5: ['', '7', 'sus4', 'sus2', 'add9', '5'], 6: ['m', 'm7', 'madd9', 'sus2', 'sus4', '5'], 7: ['dim', 'm7b5'] };
  function inKey(sym) {
    const m = sym.match(SYM);
    if (!m || m[1]) return false;
    if (m[4] && /[♭♯]/.test(m[4])) return false;
    return DIATONIC[m[2]].includes(m[3] || '');
  }
  const outsideCount = (bars) => bars.reduce((n, t) => n + t.split(',').filter((c) => !inKey(c)).length, 0);

  // ---------- the corpus ----------
  // Songs as { name, artist, minor, runs: [{ role, bars, ends: [bar indices that end a phrase] }] }.
  // Back-to-back phrases of the same part are joined into one run, so the model also learns how a
  // phrase leads into the next; the last bar of a run ends the part.
  let corpus = null;
  function loadCorpus() {
    if (corpus) return corpus;
    if (!Data) throw new Error('chorddata.js is not loaded');
    corpus = Data.songs.map(([name, ai, minor, secs]) => {
      const runs = [];
      for (const s of secs.split(' ')) {
        const role = s[0];
        const bars = s.slice(1).split('.').map((t) => Data.tokens[parseInt(t, 36)]);
        if (role === 'B' && bars.length < 4) continue; // short wordless tags, not bridges
        const last = runs[runs.length - 1];
        if (last && last.role === role) {
          last.ends.push(last.bars.length - 1);
          last.bars.push(...bars);
        } else runs.push({ role, bars, ends: [] });
      }
      return { name, artist: Data.artists[ai], minor: !!minor, runs };
    });
    return corpus;
  }

  // ---------- the model ----------
  class Counts {
    constructor() { this.m = new Map(); }
    add(ctx, tok, w) {
      let e = this.m.get(ctx);
      if (!e) this.m.set(ctx, (e = { n: 0, c: new Map() }));
      e.n += w;
      e.c.set(tok, (e.c.get(tok) || 0) + w);
    }
    get(ctx) { return this.m.get(ctx) || null; }
  }
  // Interpolated absolute discounting (the Kneser–Ney family, which Chen & Goodman found best):
  // P(t | ctx) = max(C(ctx, t) − D, 0) / N(ctx) + D · T(ctx) / N(ctx) · P_lower(t), T = distinct successors.
  const ad = (e, tok, lower, D) => (e ? Math.max((e.c.get(tok) || 0) - D, 0) / e.n + ((D * e.c.size) / e.n) * lower : lower);
  // Discounts for the chords of a part, one bar of context, and two. Chosen on songs left out of
  // training (test/chordgen.test.js prints the comparison).
  const D0 = 0.75, D1 = 0.9, D2 = 0.95;
  const UNK = '<unk>';

  const models = new Map();
  // exclude: song indices to leave out (for testing on songs the model hasn't seen).
  function model(opts = {}) {
    const { colors = true, flavor = null, mood = 'any', exclude = null, flavorD = FLAVOR_ALPHA } = opts;
    const skip = exclude ? new Set(exclude) : null;
    const key = `${colors}|${flavor || ''}|${mood}|${flavorD}|${skip ? [...skip].join(',') : ''}`;
    if (models.has(key)) return models.get(key);
    // A flavor or a mood: counts from those songs alone, backing off to the model of all songs.
    if (flavor || mood !== 'any') {
      const base = flavor ? model({ ...opts, flavor: null }) : model({ ...opts, mood: 'any' });
      const pickSong = flavor ? (s) => s.artist === flavor : (s) => s.minor === (mood === 'minor');
      const m = adapt(base, pickSong, skip, colors, flavorD);
      if (models.size >= 12) models.delete(models.keys().next().value);
      models.set(key, m);
      return m;
    }
    const songs = loadCorpus();
    const runsOf = (s) => s.runs.map((r) => ({ ...r, bars: colors ? r.bars : r.bars.map(plainBar) }));
    // Bars seen at least twice are the vocabulary; rarer ones are counted together as UNK.
    const raw = new Map();
    songs.forEach((s, si) => { if (!(skip && skip.has(si))) for (const r of runsOf(s)) for (const t of r.bars) raw.set(t, (raw.get(t) || 0) + 1); });
    const known = (t) => (t === BOS || (raw.get(t) || 0) >= 2 ? t : UNK);
    const ng = new Counts(); // contexts: 'R|h2|h1', 'R|h1', '*|h1' (each counted once per song), 'R', '*'
    const phraseEnd = new Counts(); // the last bar of a phrase inside a part: 'R'
    const partEnd = new Counts(); // the last bar of a part: 'R'
    const vocab = new Map();
    const seqs = []; // for the copy check: { song, role, bars }
    songs.forEach((s, si) => {
      if (skip && skip.has(si)) return;
      const w = 1;
      // A chorus sung four times is one habit, not four: patterns with context count once per song.
      const seen = new Set();
      const once = (ctx, t) => { const k = `${ctx}\u0001${t}`; if (!seen.has(k)) { seen.add(k); ng.add(ctx, t, w); } };
      for (const r of runsOf(s)) {
        seqs.push({ song: si, role: r.role, bars: r.bars });
        const h = [BOS, BOS, BOS];
        r.bars.forEach((t0, i) => {
          const t = known(t0);
          const R = r.role;
          once(`${R}|${h[1]}|${h[2]}`, t);
          once(`${R}|${h[2]}`, t);
          once(`*|${h[2]}`, t);
          ng.add(R, t, w);
          ng.add('*', t, w);
          if (t !== UNK) vocab.set(t, (vocab.get(t) || 0) + w);
          h.shift(); h.push(t);
          if (i === r.bars.length - 1) partEnd.add(R, t, w);
          else if (r.ends.includes(i)) phraseEnd.add(R, t, w);
        });
      }
    });
    // The choices the generator draws from, most common first.
    const toks = [...vocab.entries()].sort((x, y) => y[1] - x[1]).map(([t]) => t);
    const m = { key, ng, phraseEnd, partEnd, toks, vocab, seqs, colors, flavor, mood, known };
    const V = vocab.size + 1;
    m.pUni = (t) => ad(ng.get('*'), known(t), 1 / V, D0);
    m.pRole = (R, t) => ad(ng.get(R), known(t), m.pUni(t), D0);
    m.p1 = (R, h1, t) => {
      const k = known(t), c = known(h1);
      return ad(ng.get(`${R}|${c}`), k, ad(ng.get(`*|${c}`), k, m.pRole(R, k), D1), D1);
    };
    // P(bar | part, the two bars before it): h is [h3, h2, h1], most recent last.
    m.p = (R, h, t) => ad(ng.get(`${R}|${known(h[1])}|${known(h[2])}`), known(t), m.p1(R, h[2], t), D2);
    // How much likelier a bar is at the end of a phrase or part than anywhere in that part.
    m.endWeight = (R, t, kind) => {
      const e = (kind === 'part' ? partEnd : phraseEnd).get(R);
      const pr = m.pRole(R, t);
      return ad(e, known(t), pr, D0) / pr;
    };
    m.songCount = songs.length - (skip ? skip.size : 0);
    if (models.size >= 12) models.delete(models.keys().next().value);
    models.set(key, m);
    return m;
  }

  // A model that leans toward some songs: their own counts (once per song, as above) with a Dirichlet
  // prior on the base model, P(t | ctx) = (C(ctx, t) + α · P_base(t | ctx)) / (N(ctx) + α), α = D. Where
  // they have no data the base model speaks unchanged. (Tried and measured on their own held-out songs:
  // multiplying their counts undoes the discount, and absolute discounting on so few songs trusts
  // them too much; both predicted worse than no lean. α = 100 is the lightest that still moves the mood.)
  function adapt(base, pickSong, skip, colors, D) {
    const F = new Counts();
    let n = 0;
    loadCorpus().forEach((s, si) => {
      if ((skip && skip.has(si)) || !pickSong(s)) return;
      n++;
      const seen = new Set();
      const once = (ctx, t) => { const k = `${ctx}\u0001${t}`; if (!seen.has(k)) { seen.add(k); F.add(ctx, t, 1); } };
      for (const r of s.runs) {
        const h = [BOS, BOS];
        for (const t0 of colors ? r.bars : r.bars.map(plainBar)) {
          const t = base.known(t0);
          once(`${r.role}|${h[0]}|${h[1]}`, t);
          once(`${r.role}|${h[1]}`, t);
          h.shift(); h.push(t);
        }
      }
    });
    const m = Object.create(base);
    const k = (t) => base.known(t);
    // Dirichlet prior on the base model: (c + α · P_base) / (N + α).
    const dir = (e, t, lower) => (e ? ((e.c.get(t) || 0) + D * lower) / (e.n + D) : lower);
    m.p1 = (R, h1, t) => dir(F.get(`${R}|${k(h1)}`), k(t), base.p1(R, h1, t));
    m.p = (R, h, t) => dir(F.get(`${R}|${k(h[1])}|${k(h[2])}`), k(t), dir(F.get(`${R}|${k(h[2])}`), k(t), base.p(R, h, t)));
    m.mat = null;
    m.flavorSongs = n;
    return m;
  }

  // ---------- generating ----------
  function rng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function pick(rand, items, weights) {
    let sum = 0;
    for (const w of weights) sum += w;
    if (!(sum > 0)) return items[0];
    let r = rand() * sum;
    for (let i = 0; i < items.length; i++) { r -= weights[i]; if (r <= 0) return items[i]; }
    return items[items.length - 1];
  }

  // The weight a position puts on a bar: a lock, or how well it ends a phrase or the part.
  function unary(m, R, n, locks, t, tok) {
    if (locks[t] != null) return locks[t] === tok ? 1 : 0;
    if (t === n - 1) return m.endWeight(R, tok, 'part');
    if (t % 4 === 3) return m.endWeight(R, tok, 'phrase');
    return 1;
  }
  // The part's first-order model over the candidate bars, as a matrix (cached per model and part).
  function bigram(m, R, cand) {
    const key = `${R}|${cand.length}|${cand[cand.length - 1]}`;
    if (m.mat && m.mat.key === key) return m.mat;
    const k = cand.length;
    const P = new Float32Array(k * k);
    for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) P[i * k + j] = m.p1(R, cand[i], cand[j]);
    m.mat = { key, P };
    return m.mat;
  }
  // beta[t][i]: how well the bars after t can still meet the locks and endings if bar t is cand[i],
  // under the part's first-order model (Pachet et al.'s backward pass). Scaled to a max of 1 per step.
  function backward(m, R, n, locks, cand) {
    const k = cand.length;
    const { P } = bigram(m, R, cand);
    const beta = new Array(n);
    beta[n - 1] = new Float32Array(k).fill(1);
    const g = new Float32Array(k);
    for (let t = n - 2; t >= 0; t--) {
      for (let j = 0; j < k; j++) g[j] = unary(m, R, n, locks, t + 1, cand[j]) * beta[t + 1][j];
      const b = new Float32Array(k);
      let max = 0;
      for (let i = 0; i < k; i++) {
        let s = 0;
        const row = i * k;
        for (let j = 0; j < k; j++) if (g[j]) s += P[row + j] * g[j];
        b[i] = s;
        if (s > max) max = s;
      }
      if (max > 0) for (let i = 0; i < k; i++) b[i] /= max;
      beta[t] = b;
    }
    return beta;
  }

  // The longest run of bars that this progression shares with one song, and where.
  function familiar(m, bars) {
    let best = null;
    for (const s of m.seqs) {
      const sb = s.bars;
      for (let i = 0; i < bars.length; i++) {
        for (let j = 0; j < sb.length; j++) {
          if (sb[j] !== bars[i]) continue;
          let k = 1;
          while (i + k < bars.length && j + k < sb.length && sb[j + k] === bars[i + k]) k++;
          const song = loadCorpus()[s.song];
          // Prefer longer runs, then the same part, then the flavor's own songs.
          const score = k * 4 + (s.role === m.curRole ? 2 : 0) + (m.flavor && song.artist === m.flavor ? 1 : 0);
          if (!best || score > best.score) best = { score, run: k, at: i, song: song.name, artist: song.artist, role: ROLE_NAME[s.role], whole: k === bars.length };
        }
      }
    }
    if (!best) return null;
    if (best.whole) {
      const all = m.seqs.filter((s) => { const j = s.bars.join('|'); return `|${j}|`.includes(`|${bars.join('|')}|`); });
      best.songs = new Set(all.map((s) => s.song)).size;
    }
    delete best.score;
    return best;
  }

  // opts: role ('verse'…), bars (count), locks ({ index: 'bar token' }), colors, flavor (artist), mood
  // ('any' | 'major' | 'minor'), adventure (0 familiar … 1 adventurous), seed.
  // → { bars: [['4', '5'], …], tokens, familiar }
  function generate(opts = {}) {
    const R = ROLE[opts.role] || opts.role || 'V';
    const n = Math.max(1, opts.bars || 8);
    const m = model(opts);
    m.curRole = R;
    const rand = rng(opts.seed != null ? opts.seed : (Math.random() * 2 ** 32) >>> 0);
    const adventure = Math.min(1, Math.max(0, opts.adventure != null ? opts.adventure : 0.4));
    const temp = 0.6 + adventure * 1.0; // < 1 sharpens to the common, > 1 flattens toward the rare
    const capOutside = adventure < 0.3 ? 1 : adventure < 0.7 ? 2 : Infinity; // per 8 bars
    const userLocks = {};
    for (const [i, tok] of Object.entries(opts.locks || {})) if (Number(i) < n && tok) userLocks[Number(i)] = colors(m, tok);
    // The bars to choose from: the part's own (with its smoothing) and any locked ones.
    const roleTop = m.toks.filter((t) => (m.ng.get(R) && m.ng.get(R).c.has(t)) || m.vocab.get(t) >= 20).slice(0, 400);
    const cand = [...new Set([...roleTop, ...Object.values(userLocks)])];

    let best = null;
    for (let attempt = 0; attempt < 40; attempt++) {
      const locks = { ...userLocks };
      // The 2nd (and later) phrases repeat the 1st one's opening as often as real ones do.
      const reps = [];
      for (let p = 4; p < n; p += 4) reps.push([p, pick(rand, REPEAT[R].map((x) => x[0]), REPEAT[R].map((x) => x[1]))]);
      let beta = backward(m, R, n, locks, cand);
      const out = [];
      const h = [BOS, BOS, BOS];
      for (let t = 0; t < n; t++) {
        const rep = reps.find(([p]) => p === t);
        if (rep) {
          let added = false;
          for (let k = 0; k < rep[1] && t + k < n; k++) {
            if (locks[t + k] != null) break;
            locks[t + k] = out[t + k - rep[0]];
            added = true;
          }
          if (added) beta = backward(m, R, n, locks, cand);
        }
        const w = cand.map((y, j) => {
          const u = unary(m, R, n, locks, t, y);
          if (!u) return 0;
          return Math.pow(m.p(R, h, y), 1 / temp) * u * beta[t][j];
        });
        const tok = pick(rand, cand, w);
        out.push(tok);
        h.shift(); h.push(tok);
      }
      const outside = outsideCount(out.filter((_, i) => userLocks[i] == null));
      const okOutside = outside <= capOutside * Math.max(1, n / 8);
      const fam = familiar(m, out);
      const copied = fam && fam.run >= MAX_COPY && !Object.keys(userLocks).length;
      // Three identical bars in a row: 1% of POP909's choruses and pre-choruses, so only as a vamp.
      const stuck = R !== 'I' && R !== 'O' && out.some((b, i) => i > 1 && b === out[i - 1] && b === out[i - 2]);
      const fault = (okOutside ? 0 : 4) + (copied ? 2 : 0) + (stuck ? 1 : 0);
      if (!best || fault < best.fault) best = { out, fam, fault };
      if (!fault) break;
    }
    return { bars: best.out.map((t) => t.split(',')), tokens: best.out, familiar: best.fam };
  }
  const colors = (m, tok) => (m.colors ? tok : plainBar(tok));

  // The artists with the most songs, for the flavor menu: [{ name, songs }].
  function artists(min = 5) {
    const c = new Map();
    for (const s of loadCorpus()) c.set(s.artist, (c.get(s.artist) || 0) + 1);
    return [...c.entries()].filter(([, k]) => k >= min).sort((a, b) => b[1] - a[1]).map(([name, songs]) => ({ name, songs }));
  }
  const songCount = () => loadCorpus().length;

  const ChordGen = { generate, model, familiar, artists, songCount, plainBar, inKey, ROLE, ROLE_NAME, MAX_COPY, rng, _corpus: loadCorpus };
  if (typeof module !== 'undefined' && module.exports) module.exports = ChordGen;
  else root.ChordGen = ChordGen;
})(typeof self !== 'undefined' ? self : this);
