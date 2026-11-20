// Tests the song writing modules: pinyin and tones, tone sandhi, rhymes, the tone/melody judge,
// chords, the melody generator, quantizing and 简谱.
// Run: node web/test/songwriter.test.js
'use strict';
const Zh = require('../js/zh.js');
const S = require('../js/songtheory.js');

let failures = 0;
const check = (ok, msg) => { if (!ok) { failures++; console.log('  FAIL', msg); } };
const sung = (text) => Zh.syllables(text).map((s) => `${s.base}${s.sung}`).join(' ');

// ---------- pinyin ----------
console.log('pinyin');
check(Zh.PY.size > 20000, `pinyin data covers the CJK block (${Zh.PY.size})`);
check(sung('我爱你') === 'wo2 ai4 ni3' || sung('我爱你') === 'wo3 ai4 ni3', `我爱你 (got ${sung('我爱你')})`);
check(sung('月亮代表我的心') === 'yue4 liang4 dai4 biao2 wo3 de5 xin1', `3+3 sandhi in 表我 (got ${sung('月亮代表我的心')})`);
check(sung('我也想你') === 'wo2 ye3 xiang2 ni3', `3+3+3+3 (got ${sung('我也想你')})`);
check(sung('一个') === 'yi2 ge4', `一 before 4th → 2nd (got ${sung('一个')})`);
check(sung('一起') === 'yi4 qi3', `一 before 3rd → 4th (got ${sung('一起')})`);
check(sung('第一') === 'di4 yi1', `第一 keeps 1st (got ${sung('第一')})`);
check(sung('不要') === 'bu2 yao4', `不 before 4th → 2nd (got ${sung('不要')})`);
check(sung('长大') === 'zhang3 da4' && sung('长久') === 'chang2 jiu3', 'word readings: 长大 / 长久');
check(sung('少年') === 'shao4 nian2' && sung('音乐') === 'yin1 yue4' && sung('重来') === 'chong2 lai2', 'word readings: 少年 音乐 重来');
check(sung('慢慢地') === 'man4 man4 de5' && sung('天地') === 'tian1 di4', 'AA地 is the particle de; 天地 is dì');
{
  const syl = Zh.syllables('baby 你好，再见');
  check(syl.length === 5 && !syl[0].han && syl[0].tone === 0, 'a Latin word is one syllable with no tone');
  check(syl[1].gap === 'space' && syl[3].gap === 'comma', 'spaces and commas mark breaths');
  const fixed = Zh.syllables('行', { 0: 'hang2' });
  check(fixed[0].py === 'hang2', 'a reading fix applies');
}
check(Zh.marked('lv4') === 'lǜ' && Zh.marked('xiu1') === 'xiū' && Zh.marked('gou3') === 'gǒu' && Zh.marked('de5') === 'de', 'tone marks go on the right vowel');

// ---------- rhyme ----------
console.log('rhyme');
const groupOf = (ch) => { const s = Zh.syllables(ch)[0]; const g = Zh.rhymeOf(s.base); return g && g.zh; };
check(groupOf('来') === '怀来' && groupOf('在') === '怀来', '来 在 → 怀来');
check(groupOf('歌') === '梭波' && groupOf('落') === '梭波' && groupOf('我') === '梭波', '歌 落 我 → 梭波');
check(groupOf('夜') === '乜斜' && groupOf('月') === '乜斜', '夜 月 → 乜斜');
check(groupOf('心') === '人辰' && groupOf('云') === '人辰' && groupOf('春') === '人辰', '心 云 春 → 人辰');
check(groupOf('风') === '中东' && groupOf('星') === '中东' && groupOf('翁') === '中东', '风 星 翁 → 中东');
check(groupOf('雨') === '一七' && groupOf('子') === '一七' && groupOf('去') === '一七', '雨 子 去 → 一七');
check(groupOf('秋') === '油求' && groupOf('走') === '油求', '秋 走 → 油求');
check(groupOf('醉') === '灰堆' && groupOf('飞') === '灰堆', '醉 飞 → 灰堆');
for (const g of Zh.RHYME_GROUPS) {
  for (const w of g.words.split(' ')) {
    const r = Zh.rhymeSyllable(Zh.syllables(w));
    const got = r && Zh.rhymeOf(r.base);
    check(got && got.id === g.id, `bank word ${w} rhymes in ${g.zh} (got ${got && got.zh})`);
  }
}
check(Zh.rhymeSyllable(Zh.syllables('等你回来吧')).ch === '来', 'a trailing particle is skipped for the rhyme');

// ---------- tones vs melody ----------
console.log('tone judge');
check(Zh.judge(4, 3, 5).fit === 'bad', '4th then 3rd tone, melody leaps up: bad');
check(Zh.judge(4, 3, -3).fit === 'good', '4th then 3rd tone, melody goes down: good');
check(Zh.judge(3, 1, 4).fit === 'good' && Zh.judge(3, 1, -4).fit === 'bad', '3rd → 1st wants up');
check(Zh.judge(1, 1, 0).fit === 'good' && Zh.judge(1, 1, 7).fit === 'bad', '1st → 1st wants level');
check(Zh.judge(1, 5, -2).fit === 'good' && Zh.judge(3, 5, 2).fit === 'good', 'neutral tone: lower after 1st, higher after 3rd');
check(Zh.judge(4, 2, 9).fit === 'good', '4th → 2nd: anything goes');

// ---------- chords ----------
console.log('chords');
check(S.chordName('6m', 0) === 'Am' && S.chordName('5/7', 7) === 'D/F♯' && S.chordName('♭7', 0) === 'B♭' && S.chordName('4maj7', 5) === 'B♭maj7', 'chord names in a key');
check(S.chordInfo('3', 0).pcs.join() === '4,8,11', 'major 3 in C is E G♯ B');
check(S.chordInfo('1/3', 0).bassPc === 4, '1/3 has E in the bass');
check(S.parseChord('x9') === null && S.parseChord('8') === null, 'bad chords are rejected');
for (const p of S.PROGRESSIONS) {
  const bars = S.parseBars(p.bars);
  check(bars.length >= 4 && bars.every((b) => b.every((c) => S.parseChord(c))), `progression ${p.id} parses`);
}
for (const st of Object.values(S.STYLES)) {
  for (const [id, spec] of Object.entries(st.sections)) {
    const bars = S.progressionBars(spec);
    check(bars.length % 2 === 0 && bars.every((b) => b.every((c) => S.parseChord(c))), `${st.id} ${id} chords parse into whole lines`);
  }
}
for (const sym of ['1', '2m', '3m', '3', '4', '4m', '5', '6m', '6', '2', '♭7', '♭6', '7']) {
  const sw = S.swapsFor(sym);
  check(sw.length > 0 && sw.every(([x]) => S.parseChord(x)), `swaps for ${sym}`);
}

{
  // Chord names are spelled on the degree's letter.
  const names = (key, syms) => syms.map((c) => S.chordName(c, key)).join(' ');
  check(S.keyName(6) === 'F♯' && names(6, ['1', '4', '5/7', '6m', '♭7', '4m']) === 'F♯ B C♯/E♯ D♯m E Bm', `key of F♯ (${names(6, ['1', '4', '5/7', '6m', '♭7', '4m'])})`);
  check(names(0, ['3', '♭7', '♭6', '4m', '5/7']) === 'E B♭ A♭ Fm G/B' && names(3, ['4', '♭6', '♭7']) === 'A♭ C♭ D♭' && names(4, ['3m', '7', '♭7']) === 'G♯m D♯ D', 'borrowed chords');
  for (let key = 0; key < 12; key++) {
    const tonic = S.keyName(key);
    const seen = ['1', '2m', '3m', '4', '5', '6m', '7'].map((c) => S.chordName(c, key).replace(/m$/, ''));
    check(new Set(seen.map((n) => n[0])).size === 7, `the seven chords of ${tonic} are on seven letters (${seen.join(' ')})`);
  }
  // What a chord changes in the key, and how the progressions and swaps are described.
  check(JSON.stringify(S.alterations('3')) === '{"7":8}' && JSON.stringify(S.alterations('4m')) === '{"9":8}' && JSON.stringify(S.alterations('♭6')) === '{"4":3,"9":8}' && JSON.stringify(S.alterations('5/7')) === '{}', 'alterations');
  const roots = S.parseBars(S.progById('stepDown').bars).flat().map((c) => S.parseChord(c).deg).join('');
  check(roots.replace(/(\d)\1/g, '$1') === S.progById('stepDown').zh, `"${S.progById('stepDown').zh}" names its chords (${roots})`);
  const shared = (a, b) => S.chordInfo(a, 0).pcs.filter((x) => S.chordInfo(b, 0).pcs.includes(x)).length;
  for (const base of ['1', '2m', '3m', '4', '5', '6m', '3', '2', '6', '4m']) {
    for (const [sym, why] of S.swapsFor(base)) {
      if (/shares two notes/.test(why)) check(shared(base, sym) === 2, `${base} → ${sym} "${why}": shares ${shared(base, sym)}`);
      check(!/same notes/.test(why) || shared(base, sym) === S.chordInfo(base, 0).pcs.length, `${base} → ${sym} "${why}"`);
    }
  }
}

// ---------- melody ----------
console.log('melody');
const LINES = ['路灯一盏一盏 亮起来', '我在老地方 等你回来', '如果时间 可以倒带', '在你听不见的 角落', '燃烧吧 我的青春 不要回头', '一二三四五六七八九十一二三四五六七八'];
let scoreSum = 0;
let lines = 0;
for (const style of ['ballad', 'pop', 'rock']) {
  for (const [li, text] of LINES.entries()) {
    for (const role of ['verse', 'chorus']) {
      const syl = Zh.syllables(text);
      const bars = S.parseBars(li % 2 ? '6m | 4' : '1 | 5/7');
      const notes = S.suggestMelody(syl, { bars, keyPc: 7, role, style, seed: 100 + li });
      const al = S.align(notes, syl);
      check(al.used === syl.length && al.extraSyl === 0, `${style} ${role} "${text}": every syllable gets a note`);
      check(notes.every((n, i) => n.t >= 0 && n.d > 0 && n.t + n.d <= S.LINE && (i === 0 || n.t >= notes[i - 1].t + notes[i - 1].d)), `${style} ${role} "${text}": notes fit the two bars without overlapping`);
      const last = notes[notes.length - 1];
      const ci = S.chordInfo(S.chordAt(bars, last.t), 7);
      check(ci.pcs.includes(((last.midi % 12) + 12) % 12), `${style} ${role} "${text}": lands on a chord tone`);
      const c = S.toneCheck(notes, syl);
      if (c.score != null) { scoreSum += c.score; lines++; }
    }
  }
}
check(scoreSum / lines >= 90, `generated melodies follow the tones (average fit ${(scoreSum / lines).toFixed(1)})`);
{
  const syl = Zh.syllables('我爱你');
  const a = S.suggestMelody(syl, { bars: [['1'], ['5']], seed: 42 });
  const b = S.suggestMelody(syl, { bars: [['1'], ['5']], seed: 42 });
  check(JSON.stringify(a) === JSON.stringify(b), 'same seed, same melody');
}
{
  // Over a chord from outside the key the melody uses the chord's note, never the plain one a half
  // step away: no G over a major 3 (G♯), no A over 4m (A♭), no B over ♭7, no E or A over ♭6.
  let clashes = 0;
  let altered = 0;
  let total = 0;
  for (const [bars, texts] of [['1 | 3', LINES], ['4 | 4m', LINES], ['♭6 | ♭7', LINES], ['6m | 2', LINES]]) {
    for (const [li, text] of texts.entries()) {
      for (const role of ['verse', 'chorus', 'bridge']) {
        const b = S.parseBars(bars);
        const notes = S.suggestMelody(Zh.syllables(text), { bars: b, keyPc: 0, role, style: 'ballad', seed: 500 + li });
        for (const n of notes) {
          const alt = S.alterations(S.chordAt(b, n.t));
          const deg = (((n.midi - S.doMidi(0)) % 12) + 12) % 12;
          total++;
          if (alt[deg] != null) clashes++;
          if (Object.values(alt).includes(deg)) altered++;
        }
      }
    }
  }
  check(clashes === 0, `no note a half step against a borrowed chord tone (${clashes} of ${total})`);
  check(altered > 0, `the borrowed notes get sung (${altered} of ${total})`);
  check(S.jianpuText(S.doMidi(0) + 8, 0, '3') === '♯5' && S.jianpuText(S.doMidi(0) + 8, 0, '4m') === '♭6' && S.jianpuText(S.doMidi(0) + 8, 0) === '♭6', '简谱 writes a chord’s altered note on its own degree');
}
{
  const r = S.makeRhythm(30, { style: 'pop', rand: S.rng(3) });
  check(r.length === 30 && r[29].t + r[29].d <= S.LINE, 'a long line still fits two bars (16ths)');
}

// ---------- quantize, 简谱 ----------
console.log('quantize and 简谱');
{
  const spt = 60 / 90 / S.TPB;
  const ev = [{ time: 0.02, midi: 60.2 }, { time: spt * 6 - 0.01, midi: 62 }, { time: spt * 12 + 0.01, midi: 64 }, { time: 99, midi: 70 }];
  const q = S.quantize(ev, { secPerTick: spt });
  check(q.length === 3 && q[0].t === 0 && q[1].t === 6 && q[2].t === 12 && q[0].d === 6 && q[0].midi === 60, `quantize to 16ths (got ${JSON.stringify(q)})`);
}
check(S.jianpuText(S.doMidi(0), 0) === '1' && S.jianpuText(S.doMidi(0) + 12, 0) === '1̇' && S.jianpuText(S.doMidi(0) - 5, 0) === '5̣', '简谱 octave dots');
check(S.jianpuText(S.doMidi(2) + 3, 2) === '♭3', '简谱 accidentals');
check(S.melodyText([{ t: 0, d: 24, midi: S.doMidi(0) }, { t: 30, d: 6, midi: S.doMidi(0) + 2 }], 0, 1) === '1 - 02 0', `melody text (got ${S.melodyText([{ t: 0, d: 24, midi: S.doMidi(0) }, { t: 30, d: 6, midi: S.doMidi(0) + 2 }], 0, 1)})`);
check(S.stepNote(S.doMidi(0) + 4, 1, 0) === S.doMidi(0) + 5 && S.stepNote(S.doMidi(0), -1, 0) === S.doMidi(0) - 1, 'scale steps');
{
  const song = S.newSong('pop', 9);
  const sheet = S.leadSheet(song);
  check(/1 = A/.test(sheet) && /\[副歌 Chorus\]/.test(sheet) && /F♯m/.test(sheet), 'lead sheet has key, parts and chords');
}

console.log(failures ? `\n${failures} failure(s)` : '\nall song writing tests passed');
process.exit(failures ? 1 : 0);
