// Tests the rhythm trainer's logic: the pattern library, step timing, click and drum parts, the
// grader, statistics, the tempo ladder and the tips.
// Run: node web/test/rhythm.test.js
'use strict';
const R = require('../js/rhythm.js');

let failures = 0;
const check = (ok, msg) => { if (!ok) { failures++; console.log('  FAIL', msg); } };
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

console.log('Library');
{
  const ids = new Set();
  for (const p of R.PATTERNS) {
    check(!ids.has(p.id), `duplicate id ${p.id}`);
    ids.add(p.id);
    check(R.CATS.some((c) => c.id === p.cat), `${p.id}: unknown category ${p.cat}`);
    check(p.bpm >= 30 && p.bpm <= 240, `${p.id}: bpm ${p.bpm}`);
    check(p.how && p.why && p.cues && p.cues.length, `${p.id}: missing text`);
    if (p.click) check(R.CLICK_MODES.includes(p.click.mode), `${p.id}: click mode ${p.click.mode}`);
    p.bars.forEach((bar, b) => {
      check([1, 2, 3, 4, 6].includes(bar.grid), `${p.id} bar ${b}: grid ${bar.grid}`);
      check(bar.hits.length === bar.grid * p.meter, `${p.id} bar ${b}: ${bar.hits.length} steps for ${bar.grid} × ${p.meter}`);
      check([...bar.hits].every((c) => R.SYM[c]), `${p.id} bar ${b}: unknown symbol in ${bar.hits}`);
      check([...bar.hits].some((c) => R.SYM[c].hit), `${p.id} bar ${b}: no hits`);
      if (bar.acc) {
        check(bar.acc.length === bar.hits.length, `${p.id} bar ${b}: accents length`);
        check([...bar.acc].every((c, i) => c !== '>' || R.SYM[bar.hits[i]].hit), `${p.id} bar ${b}: accent on a step that isn't played`);
      }
      if (bar.counts) check(bar.counts.length === bar.hits.length, `${p.id} bar ${b}: counts length`);
    });
  }
  check(R.CATS.every((c) => R.PATTERNS.some((p) => p.cat === c.id)), 'every category has patterns');
  for (const p of R.PATTERNS) {
    check(Array.isArray(R.NEEDS[p.id]), `${p.id}: has prerequisites listed`);
    check((R.NEEDS[p.id] || []).every(([id, m]) => R.byId(id) && id !== p.id && m > 0 && m < 1), `${p.id}: prerequisites are other patterns`);
    check(R.SHORT[p.id] && R.SHORT[p.id].length <= 8, `${p.id}: short label`);
  }
  // Every pattern is reachable from nothing, following the prerequisites.
  const reach = new Set();
  for (let changed = true; changed;) {
    changed = false;
    for (const p of R.PATTERNS) if (!reach.has(p.id) && R.NEEDS[p.id].every(([id]) => reach.has(id))) { reach.add(p.id); changed = true; }
  }
  check(reach.size === R.PATTERNS.length, `every pattern reachable (${reach.size}/${R.PATTERNS.length})`);
  console.log(`  ${R.PATTERNS.length} patterns in ${R.CATS.length} categories`);
}

console.log('Alternate strumming');
{
  check(R.alt('x.xx.xxx') === 'DuDUdUDU', `pop strum: ${R.alt('x.xx.xxx')}`);
  check(R.alt('x..x..x.', 4) === 'DudUduDu', `3+3+2 in 16ths: ${R.alt('x..x..x.', 4)}`);
  check(R.alt('x.xxxx', 3) === 'DuDUDU', `6/8: ${R.alt('x.xxxx', 3)}`);
  check(R.byId('pop').bars[0].hits === 'DuDUdUDU', 'pop pattern');
}

console.log('Step positions and swing');
{
  check(near(R.stepPos(4, 6), 1.5), '16ths: step 6 is beat 2 &');
  check(near(R.stepPos(3, 4), 1 + 1 / 3), 'triplets: step 4');
  check(near(R.stepPos(2, 1, 2 / 3), 2 / 3), 'swung 8ths: the & on the last third');
  check(near(R.stepPos(2, 2, 2 / 3), 1), 'swung 8ths: beats stay put');
  check(near(R.stepPos(4, 1, 2 / 3), 1 / 3), 'swung 16ths: the e moves later');
  check(near(R.stepPos(4, 3, 2 / 3), 0.5 + 1 / 3), 'swung 16ths: the a moves later');
  const st = R.barSteps(R.byId('funk'), 0);
  check(st.length === 16 && st[4].sym === 'X' && st[4].acc && st[4].count === '2', 'funk: chuck on 2, accented');
  check(st[1].count === 'e' && st[2].count === '&' && st[3].count === 'a', 'counts 1 e & a');
  const six = R.barSteps(R.byId('sixeight'), 0);
  check(six.map((s) => s.count).join('') === '123456', '6/8 counts 1–6');
  check(near(R.minGapBeats(R.byId('gallop')), 0.25), 'gallop: shortest gap is a 16th');
  check(near(R.minGapBeats(R.byId('quarters')), 1), 'quarters: shortest gap is a beat');
}

console.log('Click and drums');
{
  const gap = { mode: 'gap', on: 2, off: 2 };
  check([0, 1, 2, 3, 4].map((b) => R.clickOn(gap, b)).join() === 'true,true,false,false,true', 'gap 2/2 pattern');
  check(R.clickBar(gap, 4, 2).length === 0, 'silent bar');
  check(R.clickBar({ mode: 'all' }, 4, 0).map((c) => c.pos).join() === '0,1,2,3', 'every beat');
  check(R.clickBar({ mode: 'all' }, 4, 0)[0].accent, 'beat 1 accented');
  check(R.clickBar({ mode: '24' }, 4, 0).map((c) => c.pos).join() === '1,3', 'backbeat');
  check(R.clickBar({ mode: 'one' }, 4, 0).map((c) => c.pos).join() === '0', 'beat 1 only');
  check(R.clickBar({ mode: 'off' }, 4, 0).map((c) => c.pos).join() === '0.5,1.5,2.5,3.5', 'offbeats');
  const dr = R.drumBar({ mode: 'all' }, 4, 0);
  check(dr.filter((d) => d.drum === 'snare').map((d) => d.pos).join() === '1,3', 'snare on 2 and 4');
  check(dr.filter((d) => d.drum === 'kick').map((d) => d.pos).join() === '0,2', 'kick on 1 and 3');
  check(dr.filter((d) => d.drum === 'hat').length === 8, 'hats on 8ths');
  const sw = R.drumBar({ mode: 'all' }, 4, 0, 2 / 3).filter((d) => d.drum === 'hat').map((d) => d.pos);
  check(near(sw[1], 2 / 3), 'swung hats');
  const six = R.drumBar({ mode: 'all' }, 2, 0, 0.5, 3);
  check(six.filter((d) => d.drum === 'hat').length === 6 && six.some((d) => d.drum === 'snare' && d.pos === 1), '6/8 groove');
  check(R.drumBar(gap, 4, 3).length === 0, 'drums drop out in the gap');
}

// Lay out bars of a pattern from t0 at bpm, the way the page does.
function layout(pattern, { bars = 2, bpm = 120, t0 = 1, passBars = 2, click = { mode: 'all' } } = {}) {
  const beat = 60 / bpm;
  const steps = [];
  for (let b = 0; b < bars; b++) {
    const start = t0 + b * pattern.meter * beat;
    const on = R.clickOn(click, b);
    for (const s of R.barSteps(pattern, b)) steps.push({ ...s, t: start + s.pos * beat, bar: b, pass: Math.floor(b / passBars), clickOn: on, gapBlock: on ? null : Math.floor(b / 4), bpm });
  }
  return steps;
}

console.log('Grader: hits, misses and extras');
{
  const pop = R.byId('pop');
  const steps = layout(pop, { bars: 4, bpm: 120 });
  const g = new R.Grader();
  g.addSteps(steps);
  const played = steps.filter((s) => s.hit);
  // Every hit 15 ms late, except one missed and one ghost stroke that hits the strings.
  const skip = played[5];
  for (const s of played) if (s !== skip) g.onset({ t: s.t + 0.015, db: -20 });
  const ghost = steps.find((s) => s.kind === 'ghost');
  const r = g.onset({ t: ghost.t + 0.004, db: -25 });
  check(r.kind === 'extra' && r.why === 'ghost', `ghost stroke hit: ${JSON.stringify(r.why)}`);
  check(g.onset({ t: 0.2 }).kind === 'before', 'count-in attack ignored');
  const { missed, passes } = g.flush(steps[steps.length - 1].t + 1);
  check(missed.length === 1 && missed[0] === g.steps[steps.indexOf(skip)], 'one miss');
  check(passes.join() === '0', `pass 0 complete (pass 1 is still open: no later pass): ${passes}`);
  const st = R.summarize(g.passSteps(0), g.passExtras(0));
  check(near(st.bias, 15, 1e-6) && st.spread < 1e-6, `bias 15 ms: ${st.bias}`);
  check(st.extraBy.ghost === 1 && st.missed === 1, 'stats count the ghost and the miss');
}

console.log('Grader: doubles keep the closer attack');
{
  const p = R.byId('quarters');
  const steps = layout(p, { bars: 1, bpm: 60 });
  const g = new R.Grader();
  g.addSteps(steps);
  g.onset({ t: steps[0].t + 0.06, db: -20 }); // a stray-ish late attack first
  const r = g.onset({ t: steps[0].t + 0.005, db: -18 }); // then the real one
  check(r.kind === 'hit' && r.replaced, 'the closer attack wins');
  check(g.steps[0].played && near(g.steps[0].played.off, 0.005, 1e-9), 'kept the 5 ms one');
  check(g.extras.length === 1 && g.extras[0].kind === 'double', 'the other is a double');
  const far = g.onset({ t: steps[1].t + 0.2 }); // 200 ms off at 60 bpm: no step that close
  check(far.kind === 'extra' && far.why === 'stray', 'far from any step: stray');
}

console.log('Grader: nearest step decides between a late hit and the next rest');
{
  const p = R.byId('stops'); // ... C - - - . . . . : the chord rings through beat 3, silence on 4
  const steps = layout(p, { bars: 1, bpm: 100 });
  const g = new R.Grader();
  g.addSteps(steps);
  const c = steps.find((s) => s.sym === 'C');
  check(c.pos === 2 && steps.filter((s) => s.kind === 'tie').every((s) => s.pos > 2 && s.pos < 3) && steps.filter((s) => s.kind === 'rest').every((s) => s.pos >= 3), 'the chord is on 3, rings to 4, and 4 is silent (as the text says)');
  const r1 = g.onset({ t: c.t + 0.02 });
  check(r1.kind === 'hit', 'C 20 ms late is a hit');
  const r2 = g.onset({ t: c.t + 0.3 });
  check(r2.kind === 'extra' && r2.why === 'tie', 'a new attack while the chord rings');
  const r3 = g.onset({ t: c.t + 0.75 });
  check(r3.kind === 'extra' && r3.why === 'rest', 'a sound during the stop is in a rest');
}

console.log('Statistics: positions, accents, gap drift');
{
  const p = R.byId('sixteenths');
  const steps = layout(p, { bars: 4, bpm: 80 });
  const g = new R.Grader();
  g.addSteps(steps);
  // The "a" of each beat 20 ms late, everything else on time.
  for (const s of steps) g.onset({ t: s.t + (s.sub === 3 ? 0.02 : 0), db: s.sub === 0 ? -12 : -18 });
  g.flush(99);
  const st = R.summarize(g.steps, g.extras);
  const a = st.byPos.find((x) => x.grid === 4 && x.sub === 3);
  check(a && near(a.mean, 20, 1e-6) && a.dir === 'up', `the a: ${a && a.mean}`);
  const tp = R.tips(st);
  check(tp.some((t) => /the “a”.*late/i.test(t.text) && /up-strokes/.test(t.text)), `tip names the a: ${tp.map((t) => t.text).join(' | ')}`);

  const acc = R.byId('rock8');
  const st2steps = layout(acc, { bars: 2, bpm: 100 });
  const g2 = new R.Grader();
  g2.addSteps(st2steps);
  for (const s of st2steps) g2.onset({ t: s.t, db: s.acc ? -20.5 : -21 }); // accents barely louder
  g2.flush(99);
  const s2 = R.summarize(g2.steps, g2.extras);
  check(s2.accent && near(s2.accent.diff, 0.5, 1e-6), `accent contrast ${s2.accent && s2.accent.diff}`);
  check(R.tips(s2).some((t) => /accents barely/.test(t.text)), 'accent tip');

  // Gap click: in the silent bars the player slows to 79 bpm (from 80).
  const gp = R.byId('gap22');
  const bpm = 80;
  const gsteps = layout(gp, { bars: 8, bpm, click: gp.click, passBars: 4 });
  const g3 = new R.Grader();
  g3.addSteps(gsteps);
  const slowBeat = 60 / 79;
  const beat = 60 / bpm;
  for (const s of gsteps) {
    if (!s.hit) continue;
    let t = s.t;
    if (!s.clickOn) {
      // time since the silent block started, played at the slower tempo
      const blockStart = 1 + (Math.floor(s.bar / 4) * 4 + 2) * 4 * beat;
      t = blockStart + (s.t - blockStart) * (slowBeat / beat);
    }
    g3.onset({ t, db: -20 });
  }
  g3.flush(99);
  const s3 = R.summarize(g3.steps, g3.extras);
  check(s3.withClick && Math.abs(s3.withClick.bias) < 1, 'with the click: on time');
  check(s3.withoutClick && Math.abs(s3.withoutClick.driftBpm - 79) < 0.3, `drift found: ${s3.withoutClick && s3.withoutClick.driftBpm}`);
  check(R.tips(s3, { bpm }).some((t) => /slowed down to about 79 bpm/.test(t.text)), `drift tip: ${R.tips(s3, { bpm }).map((t) => t.text).join(' | ')}`);
}

console.log('Clean passes and the tempo ladder');
{
  const good = { n: 16, hits: 16, hitRate: 1, extras: 0, bias: -4, spread: 9 };
  const sloppy = { n: 16, hits: 11, hitRate: 0.69, extras: 3, bias: 30, spread: 45 };
  check(R.judgePass(good).clean, 'clean');
  check(!R.judgePass({ ...good, extras: 2 }).clean, 'two extras is not clean');
  check(!R.judgePass({ ...good, bias: 25 }).clean, 'rushing by 25 ms is not clean');
  check(R.judgePass(sloppy).rough, 'rough');
  const L = new R.Ladder({ need: 2 });
  check(L.update(R.judgePass(good), 80) === 0, 'first clean pass: no change');
  check(L.update(R.judgePass(good), 80) === R.ladderStep(80) && R.ladderStep(80) === 3, 'second clean pass: +3 at 80 bpm');
  check(L.update(R.judgePass(sloppy), 83) === 0 && L.update(R.judgePass(sloppy), 83) === -3, 'two rough passes: −3');
  check(R.ladderStep(150) === 6 && R.ladderStep(40) === 2, 'step scales with tempo');
}

console.log('Tips');
{
  const base = { n: 32, hits: 32, missed: 0, hitRate: 1, extras: 0, extraBy: { ghost: 0, rest: 0, tie: 0, double: 0, stray: 0 }, bias: 0, spread: 8, rms: 8, offs: [], byPos: [], accent: null, withClick: null, withoutClick: null };
  check(R.tips(base)[0].level === 'star', 'locked in');
  check(R.tips({ ...base, bias: -20 }).some((t) => /rushing/.test(t.text)), 'rushing');
  check(R.tips({ ...base, bias: 18 }).some((t) => /dragging/.test(t.text)), 'dragging');
  check(R.tips({ ...base, spread: 32 }).some((t) => /scatter/.test(t.text)), 'scatter');
  check(R.tips({ ...base, extras: 3, extraBy: { ...base.extraBy, ghost: 3 } }).some((t) => /ghost strokes/.test(t.text)), 'ghost');
  check(R.tips({ ...base, extras: 2, extraBy: { ...base.extraBy, rest: 2 } }).some((t) => /rests/.test(t.text)), 'rests');
  check(R.tips({ ...base, hits: 2, missed: 30, hitRate: 0.06 })[0].text.includes('Hardly any'), 'no input');
  check(R.feel(0.004).text === 'on the beat' && R.feel(-0.03).text === '30 ms early' && R.feel(0.06).cls === 'bad', 'feel words');
}

if (failures) { console.log(`\n${failures} failure(s)`); process.exit(1); }
console.log('\nAll rhythm tests passed');
