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
check(!/[a-z]+韻/.test(user), 'rhyme instruction carries no pinyin for the model to copy');
check(/月亮升起的時候/.test(user) && /月光/.test(user), 'prompt carries previous lines and title');
check(/只回那一句歌詞/.test(user), 'prompt asks for one line only');

// ---------- cleaning ----------
console.log('clean');
check(L.cleanLine('1. 月亮代表我的心') === '月亮代表我的心', 'strips numbering');
check(L.cleanLine('「月亮代表我的心」') === '月亮代表我的心', 'strips quotes');
check(L.cleanLine('歌詞：月亮代表我的心\n這是一句很好的歌詞。') === '月亮代表我的心', 'strips label, takes first line');
check(L.cleanLine('```\n月亮代表我的心\n```') === '月亮代表我的心', 'strips code fences');
check(L.cleanLine('等待你的未來來_ai') === '等待你的未來來', 'strips trailing _ai');
check(L.cleanLine('等待在那老地方ai') === '等待在那老地方', 'strips trailing ai');
check(L.cleanLine('等你回來我懷緋 ai') === '等你回來我懷緋', 'strips trailing space + ai');
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

// ---------- server mode ----------
console.log('server mode');
check(L.getMode() === 'server', `default mode is server (got ${L.getMode()})`);
check(L.SERVER_URL === 'https://ai.0x1.tw', `server url (got ${L.SERVER_URL})`);
check(L.messagesToPrompt([
  { role: 'system', content: '你是一位華語流行歌詞作者。' },
  { role: 'user', content: '寫一句歌詞。' },
]) === '你是一位華語流行歌詞作者。\n\n寫一句歌詞。', 'messages flatten to one prompt, system first');
check(L.messagesToPrompt([{ role: 'user', content: '' }, { role: 'user', content: '寫一句歌詞。' }]) === '寫一句歌詞。', 'empty messages are skipped');
L.setMode('browser');
check(L.getMode() === 'browser', 'setMode browser');
L.setMode('server');
check(L.getMode() === 'server', 'setMode server');
let threw = false;
try { L.setMode('bogus'); } catch { threw = true; }
check(threw && L.getMode() === 'server', 'setMode rejects an unknown mode');

// ---------- environment ----------
console.log('env');
check(L.isSupported() === true, 'server mode needs only fetch, so it is supported in Node');
L.setMode('browser');
check(L.isSupported() === false, 'browser mode needs a module worker, none in Node');
L.setMode('server');
check(L.MODEL_ID === 'onnx-community/Qwen2.5-1.5B-Instruct', 'model id');
check(L.MODEL_MB === 1165, `model size note (got ${L.MODEL_MB} MB)`);

// ---------- server generate (stubbed fetch) ----------
console.log('server generate');
(async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    if (String(url).endsWith('/health')) return { ok: true, json: async () => ({ status: 'ok' }) };
    if (String(url).endsWith('/api/lyrics')) {
      const body = JSON.parse(opts.body);
      check(body.count === 1, 'server generate asks for one line per call');
      check(typeof body.prompt === 'string' && /寫一句/.test(body.prompt), 'server generate sends the flattened prompt');
      return { ok: true, json: async () => ({ candidates: ['月亮代表我的心'] }) };
    }
    return { ok: false, status: 404 };
  };
  try {
    const text = await L.generate(L.buildPrompt({ section: { zh: '副歌', name: 'Chorus' }, syllables: 7 }));
    check(text === '月亮代表我的心', `server generate returns the candidate (got ${text})`);
    check(L.device() === 'server', `device reports server (got ${L.device()})`);
    // A dead server rejects with a clear message, not a bare TypeError.
    globalThis.fetch = async () => { throw new TypeError('fetch failed'); };
    L.setMode('browser'); L.setMode('server'); // reset the cached ready state
    let failed = false;
    try { await L.generate(L.buildPrompt({ section: null, syllables: 7 })); } catch (err) { failed = /unreachable/.test(err.message); }
    check(failed, 'dead server rejects as unreachable');
  } finally {
    globalThis.fetch = realFetch;
    L.setMode('server');
  }
  console.log(failures ? `${failures} failure(s)` : 'ok');
  process.exit(failures ? 1 : 0);
})();
