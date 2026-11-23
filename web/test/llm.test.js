// Tests the in-browser lyric partner: prompt building, line cleaning, and the
// tone/rhyme/count scoring that ranks drafted lines. The model itself never runs here:
// loading and generation need a browser worker, so this file covers only the pure parts.
// Run: node web/test/llm.test.js
'use strict';
const Zh = require('../js/zh.js');
const S = require('../js/songtheory.js');
const L = require('../js/llm.js');

let failures = 0;
const check = (ok, msg) => { if (!ok) { failures++; console.log('  FAIL', msg); } };

const notes = (midis) => midis.map((midi, j) => ({ midi, t: j * 6, d: 6 }));

// ---------- prompt ----------
console.log('prompt');
const group = Zh.groupById('jiangyang');
const msgs = L.buildPrompt({
  section: { zh: '副歌', name: 'Chorus' },
  style: 'ballad', title: '月光', prevLines: ['月亮升起的時候', '我想起你的臉'],
  syllables: 7, rhymeGroup: group,
});
check(msgs[0].role === 'system' && /繁體中文/.test(msgs[0].content), 'system prompt asks for Traditional Chinese');
const user = msgs[1].content;
check(/副歌/.test(user) && /7 個字/.test(user) && /江陽轍/.test(user), `prompt carries section, syllable target and rhyme (got: ${user})`);
check(/月亮升起的時候/.test(user) && /月光/.test(user), 'prompt carries previous lines and title');
check(/只回那一句歌詞/.test(user), 'prompt asks for one line only');

// ---------- cleaning ----------
console.log('clean');
check(L.cleanLine('1. 月亮代表我的心') === '月亮代表我的心', 'strips numbering');
check(L.cleanLine('「月亮代表我的心」') === '月亮代表我的心', 'strips quotes');
check(L.cleanLine('歌詞：月亮代表我的心\n這是一句很好的歌詞。') === '月亮代表我的心', 'strips label, takes first line');
check(L.cleanLine('```\n月亮代表我的心\n```') === '月亮代表我的心', 'strips code fences');
check(L.cleanLine('') === '', 'empty stays empty');
check(L.cleanLine('   ') === '', 'blank stays blank');

// ---------- scoring ----------
console.log('score');
// Seven level notes. A line of 1st tones fits a level melody; 1st→4th against a +7 leap does not.
const level7 = notes([60, 60, 60, 60, 60, 60, 60]);
const good = L.scoreCandidate('天天天天天光光', level7, 'jiangyang', Zh, S);
check(good.tone === 100, `level melody + 1st tones scores 100 (got ${good.tone})`);
check(good.rhyme === 'jiangyang' && good.rhymeOk === true, `光 ends in 江陽 (got ${good.rhyme}, ok=${good.rhymeOk})`);
check(good.over === 0 && good.score === 100, `perfect line scores 100 (got ${good.score})`);

const badTones = L.scoreCandidate('天去', notes([60, 67]), null, Zh, S);
check(badTones.tone === 0, `1st→4th against a +7 leap scores 0 (got ${badTones.tone})`);
const goodTones = L.scoreCandidate('天去', notes([60, 60]), null, Zh, S);
check(goodTones.tone === 100, `same tones on a level melody score 100 (got ${goodTones.tone})`);

const wrongRhyme = L.scoreCandidate('天天天天天天天', level7, 'jiangyang', Zh, S);
check(wrongRhyme.rhyme === 'yanqian' && wrongRhyme.rhymeOk === false, `天 ends in 言前, not 江陽 (got ${wrongRhyme.rhyme})`);
check(wrongRhyme.score < good.score, 'wrong rhyme scores below the matching line');

const tooLong = L.scoreCandidate('天天天天天天天天天', level7, 'jiangyang', Zh, S);
check(tooLong.over === 2 && tooLong.syllables === 9, `9 syllables over 7 notes: over=2 (got ${tooLong.over})`);
check(tooLong.score < good.score, 'over-long line scores below the fitting line');

const noMelody = L.scoreCandidate('天天天天天光光', [], 'jiangyang', Zh, S);
check(noMelody.tone === null && noMelody.score === 75, `no melody: tone neutral, rhyme decides (got ${noMelody.score})`);

// ---------- environment ----------
console.log('env');
check(L.isSupported() === false, 'no module worker in Node');
check(L.MODEL_ID === 'onnx-community/Qwen2.5-1.5B-Instruct', 'model id');
check(L.MODEL_MB === 1165, `model size note (got ${L.MODEL_MB} MB)`);

console.log(failures ? `${failures} failure(s)` : 'ok');
process.exit(failures ? 1 : 0);
