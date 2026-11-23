// Tests the chord progression generator (js/chordgen.js) and checks it against real songs: every
// chord in the data reads in the app, locks and lengths hold, and on POP909 songs the model has not
// seen (5-fold cross-validation by song) it predicts the next bar better than simpler models, and
// covers more real progressions than the fixed library it adds to.
// Run: node web/test/chordgen.test.js
'use strict';
const ST = require('../js/songtheory.js');
const G = require('../js/chordgen.js');
const Data = require('../js/chorddata.js');

let failures = 0;
const check = (ok, msg) => { if (!ok) { failures++; console.log('  FAIL', msg); } };

// ---------- the data ----------
console.log('data');
const corpus = G._corpus();
check(corpus.length > 600, `songs kept (${corpus.length})`);
const unreadable = Data.tokens.flatMap((t) => t.split(',')).filter((c) => !ST.parseChord(c));
check(unreadable.length === 0, `every chord in the data reads in the app (${unreadable.slice(0, 5)})`);
{
  const s = corpus.find((x) => x.name === '123我爱你');
  const c = s && s.runs.find((r) => r.role === 'C');
  check(c && c.bars.slice(0, 4).join(' | ') === '4,5 | 3m,6m | 4,5 | 1', `123我爱你's chorus is 4536-1 (${c && c.bars.slice(0, 4).join(' | ')})`);
}
check(corpus.filter((x) => x.artist === '周杰伦').length >= 10, 'Jay Chou songs are in the data');

// ---------- generating ----------
console.log('generate');
for (const role of ['intro', 'verse', 'pre', 'chorus', 'bridge', 'outro']) {
  for (const bars of [4, 8, 6]) {
    const r = G.generate({ role, bars, seed: 7 + bars });
    check(r.bars.length === bars, `${role} ${bars} bars (got ${r.bars.length})`);
    check(r.bars.every((b) => b.length >= 1 && b.length <= 2 && b.every((c) => ST.parseChord(c))), `${role}: every chord reads (${r.tokens.join(' | ')})`);
  }
}
{
  const a = G.generate({ role: 'chorus', bars: 8, seed: 42 }).tokens.join('|');
  const b = G.generate({ role: 'chorus', bars: 8, seed: 42 }).tokens.join('|');
  check(a === b, 'the same seed gives the same progression');
  const seen = new Set();
  for (let i = 0; i < 30; i++) seen.add(G.generate({ role: 'chorus', bars: 8, seed: 100 + i }).tokens.join('|'));
  check(seen.size >= 25, `30 clicks give at least 25 different choruses (${seen.size})`);
}
{
  const r = G.generate({ role: 'chorus', bars: 8, locks: { 0: '4', 7: '5' }, seed: 3 });
  check(r.tokens[0] === '4' && r.tokens[7] === '5', `locked bars stay (${r.tokens.join(' | ')})`);
  const p = G.generate({ role: 'verse', bars: 8, locks: { 2: '3m7,6m' }, colors: false, seed: 3 });
  check(p.tokens[2] === '3m,6m', `a lock follows the colors setting (${p.tokens[2]})`);
}
{
  let colored = 0;
  for (let i = 0; i < 20; i++) colored += G.generate({ role: 'verse', bars: 8, colors: false, seed: i }).tokens.filter((t) => /maj7|m7|sus|add9|(^|[^m])7/.test(t.replace(/\/.*/, ''))).length;
  check(colored === 0, `no 7ths, sus or add9 without colors (${colored})`);
  let out = 0;
  for (let i = 0; i < 20; i++) out += G.generate({ role: 'chorus', bars: 8, adventure: 0, seed: i }).tokens.flatMap((t) => t.split(',')).filter((c) => !G.inKey(c)).length;
  check(out <= 20, `familiar: at most one chord from outside the key per 8 bars (${out} in 20)`);
  let copied = 0;
  for (let i = 0; i < 30; i++) { const f = G.generate({ role: 'chorus', bars: 8, seed: 500 + i }).familiar; if (f && f.run >= G.MAX_COPY) copied++; }
  check(copied <= 1, `8-bar choruses don't copy ${G.MAX_COPY}+ bars of a song (${copied} of 30)`);
}
{
  // Pre-choruses lead into the chorus: they should end on 5 (or 5sus4, 4,5…) more than verses do.
  const ends5 = (role) => { let k = 0; for (let i = 0; i < 200; i++) { const t = G.generate({ role, bars: 4, seed: i }).tokens; if (/(^|,)5(sus4)?$/.test(t[3])) k++; } return k / 200; };
  const pre = ends5('pre'); const real = (() => { let k = 0, n = 0; for (const s of corpus) for (const r of s.runs) if (r.role === 'P') { n++; if (/(^|,)5(sus4)?$/.test(r.bars[r.bars.length - 1])) k++; } return k / n; })();
  console.log(`  pre-choruses ending on 5: generated ${(pre * 100).toFixed(0)}%, POP909 ${(real * 100).toFixed(0)}%`);
  check(Math.abs(pre - real) < 0.15, 'pre-chorus endings match the real ones within 15 points');
}

// ---------- against real songs ----------
console.log('real songs (5-fold cross-validation by song)');
const folds = 5;
const res = { uni: [0, 0], role: [0, 0], first: [0, 0], full: [0, 0] };
const covLib = [0, 0], covGen = [0, 0];
// The library's 4-bar windows (cyclic), as bar tokens.
const libWin = new Set();
for (const p of ST.PROGRESSIONS) {
  const b = ST.parseBars(p.bars).map((x) => x.join(','));
  for (let i = 0; i < b.length; i++) libWin.add([0, 1, 2, 3].map((k) => b[(i + k) % b.length]).join('|'));
}
for (let f = 0; f < folds; f++) {
  const test = corpus.map((_, i) => i).filter((i) => i % folds === f);
  const m = G.model({ exclude: test });
  const gen = new Map();
  for (const role of ['verse', 'chorus']) {
    const set = new Set();
    for (let i = 0; i < 400; i++) set.add(G.generate({ role, bars: 4, seed: f * 1000 + i, exclude: test }).tokens.join('|'));
    gen.set(G.ROLE[role], set);
  }
  for (const si of test) {
    for (const r of corpus[si].runs) {
      const h = ['^', '^', '^'];
      for (const t of r.bars) {
        const add = (k, p) => { res[k][0] -= Math.log2(Math.max(p, 1e-12)); res[k][1]++; };
        add('uni', m.pUni(t));
        add('role', m.pRole(r.role, t));
        add('first', m.p1(r.role, h[2], t));
        add('full', m.p(r.role, h, t));
        h.shift(); h.push(t);
      }
      if ((r.role === 'V' || r.role === 'C') && r.bars.length >= 4) {
        const w = r.bars.slice(0, 4).join('|');
        covLib[1]++; covGen[1]++;
        if (libWin.has(w)) covLib[0]++;
        if (gen.get(r.role).has(w)) covGen[0]++;
      }
    }
  }
}
const ppl = (k) => 2 ** (res[k][0] / res[k][1]);
console.log(`  perplexity per bar on unseen songs (lower is better): all chords ${ppl('uni').toFixed(1)}, the part's chords ${ppl('role').toFixed(1)}, + 1 bar before ${ppl('first').toFixed(1)}, + 2 bars before (the generator) ${ppl('full').toFixed(1)}`);
check(ppl('first') < ppl('uni') * 0.9, 'context predicts unseen songs at least 10% better than chord counts alone');
check(ppl('full') < ppl('first') * 1.05, 'the 2nd bar of context costs no more than 5%');
const pc = (x) => `${((100 * x[0]) / x[1]).toFixed(1)}%`;
console.log(`  openings (first 4 bars) of unseen verses and choruses: in the 17-progression library ${pc(covLib)}, among 400 generated per part ${pc(covGen)}`);
check(covGen[0] > covLib[0] * 2, 'the generator covers more real openings than the library');

// Mood: songs in minor keys, and the lean a mood gives to what's generated.
{
  const test = corpus.map((_, i) => i).filter((i) => i % 5 === 0);
  const ev = (mood) => { const m = G.model({ exclude: test, mood, colors: false }); let L = 0, n = 0; for (const si of test) { if (!corpus[si].minor) continue; for (const r of corpus[si].runs) { const h = ['^', '^', '^']; for (const t0 of r.bars) { const t = G.plainBar(t0); L -= Math.log2(m.p(r.role, h, t)); n++; h.shift(); h.push(t); } } } return 2 ** (L / n); };
  const none = ev('any'), minor = ev('minor');
  console.log(`  unseen minor-key songs, without colors: perplexity ${none.toFixed(1)} with no mood, ${minor.toFixed(1)} with the minor mood`);
  check(minor <= none * 1.02, 'the minor mood predicts minor-key songs no worse');
  const opens6m = (mood) => { let k = 0; for (let i = 0; i < 200; i++) if (G.generate({ role: 'chorus', bars: 8, mood, seed: i }).tokens[0].startsWith('6m')) k++; return k / 200; };
  const lo = opens6m('major'), hi = opens6m('minor');
  console.log(`  choruses opening on 6m: ${(lo * 100).toFixed(0)}% in the major mood, ${(hi * 100).toFixed(0)}% in the minor mood`);
  check(hi > lo * 2, 'the minor mood opens on 6m much more often');
}
// Artists: with 8 to 17 songs each, a flavor doesn't predict an artist's unseen songs better (printed
// for the record; see the README).
for (const artist of ['周杰伦', '林俊杰']) {
  let base = 0, flav = 0, n = 0;
  corpus.forEach((s, si) => {
    if (s.artist !== artist) return;
    const m0 = G.model({ exclude: [si] });
    const m1 = G.model({ exclude: [si], flavor: artist });
    for (const r of s.runs) {
      const h = ['^', '^', '^'];
      for (const t of r.bars) { base -= Math.log2(m0.p(r.role, h, t)); flav -= Math.log2(m1.p(r.role, h, t)); n++; h.shift(); h.push(t); }
    }
  });
  console.log(`  ${artist} (${corpus.filter((x) => x.artist === artist).length} songs): perplexity on each unseen song ${(2 ** (base / n)).toFixed(1)} without leaning on the others, ${(2 ** (flav / n)).toFixed(1)} leaning`);
}

if (failures) { console.log(`\n${failures} failure(s)`); process.exit(1); }
console.log('\nall passed');
