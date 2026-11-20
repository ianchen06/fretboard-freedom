// Mandarin lyric helpers for the song writing page (no DOM, so the tests can run it in Node):
// - pinyin and tone for every character (js/pinyin-data.js), with fixes for the multi-reading
//   characters lyrics use most, and the tone changes of speech (一, 不, and 3rd + 3rd);
// - the 十三辙 rhyme groups, and a bank of lyric words for each;
// - how well a melody move fits two tones in a row: sung Mandarin is understood partly from the
//   pitch, so a melody that moves against the tones (倒字) can make a word sound like another.
(function (root) {
  'use strict';
  const DATA = root.PinyinData || (typeof require !== 'undefined' ? require('./pinyin-data.js') : '');

  // ---------- pinyin lookup ----------
  const PY = new Map();
  for (const entry of DATA.split(' ')) {
    const i = entry.indexOf(':');
    const key = entry.slice(0, i);
    for (const ch of entry.slice(i + 1)) PY.set(ch, key);
  }
  // Single-character defaults that read better in lyrics than the dictionary's first reading.
  const CHAR_FIX = { 长: 'chang2', 長: 'chang2', 地: 'di4', 得: 'de5' };
  for (const [c, p] of Object.entries(CHAR_FIX)) PY.set(c, p);

  // Words whose reading differs from the characters' defaults. Space-separated syllables.
  const WORDS = {
    长大: 'zhang3 da4', 成长: 'cheng2 zhang3', 生长: 'sheng1 zhang3', 長大: 'zhang3 da4', 成長: 'cheng2 zhang3',
    少年: 'shao4 nian2', 少女: 'shao4 nv3',
    音乐: 'yin1 yue4', 乐队: 'yue4 dui4', 乐团: 'yue4 tuan2', 乐章: 'yue4 zhang1', 乐曲: 'yue4 qu3', 乐器: 'yue4 qi4', 音樂: 'yin1 yue4', 樂隊: 'yue4 dui4',
    重来: 'chong2 lai2', 重新: 'chong2 xin1', 重逢: 'chong2 feng2', 重复: 'chong2 fu4', 重温: 'chong2 wen1', 重生: 'chong2 sheng1',
    重叠: 'chong2 die2', 重演: 'chong2 yan3', 重回: 'chong2 hui2', 重返: 'chong2 fan3', 重重: 'chong2 chong2', 重來: 'chong2 lai2',
    睡觉: 'shui4 jiao4', 午觉: 'wu3 jiao4', 睡覺: 'shui4 jiao4',
    了解: 'liao3 jie3', 了然: 'liao3 ran2', 不了: 'bu4 liao3', 受不了: 'shou4 bu4 liao3',
    得到: 'de2 dao4', 获得: 'huo4 de2', 取得: 'qu3 de2', 难得: 'nan2 de2', 得意: 'de2 yi4', 舍得: 'she3 de5',
    成为: 'cheng2 wei2', 作为: 'zuo4 wei2', 以为: 'yi3 wei2', 认为: 'ren4 wei2', 为难: 'wei2 nan2', 行为: 'xing2 wei2', 無能為力: 'wu2 neng2 wei2 li4', 无能为力: 'wu2 neng2 wei2 li4',
    银行: 'yin2 hang2', 行业: 'hang2 ye4', 行列: 'hang2 lie4',
    回应: 'hui2 ying4', 答应: 'da1 ying5', 反应: 'fan3 ying4', 适应: 'shi4 ying4', 感应: 'gan3 ying4', 呼应: 'hu1 ying4', 响应: 'xiang3 ying4', 对应: 'dui4 ying4',
    爱好: 'ai4 hao4', 好奇: 'hao4 qi2',
    朝阳: 'zhao1 yang2', 朝霞: 'zhao1 xia2', 今朝: 'jin1 zhao1', 朝夕: 'zhao1 xi1', 朝气: 'zhao1 qi4', 朝陽: 'zhao1 yang2',
    几乎: 'ji1 hu1',
    干净: 'gan1 jing4', 干杯: 'gan1 bei1', 干涸: 'gan1 he2', 干燥: 'gan1 zao4', 饼干: 'bing3 gan1',
    灾难: 'zai1 nan4', 苦难: 'ku3 nan4', 患难: 'huan4 nan4',
    种下: 'zhong4 xia4', 种花: 'zhong4 hua1', 播种: 'bo1 zhong4', 种树: 'zhong4 shu4',
    相处: 'xiang1 chu3', 处理: 'chu3 li3',
    当作: 'dang4 zuo4', 当真: 'dang4 zhen1', 上当: 'shang4 dang4',
    缘分: 'yuan2 fen4', 过分: 'guo4 fen4', 部分: 'bu4 fen4', 本分: 'ben3 fen4', 分外: 'fen4 wai4', 情分: 'qing2 fen4',
    空白: 'kong4 bai2', 空闲: 'kong4 xian2', 空隙: 'kong4 xi4',
    旋转: 'xuan2 zhuan4', 转动: 'zhuan4 dong4', 打转: 'da3 zhuan4',
    还给: 'huan2 gei3', 归还: 'gui1 huan2', 偿还: 'chang2 huan2',
    着急: 'zhao2 ji2', 睡着: 'shui4 zhao2', 着迷: 'zhao2 mi2', 着火: 'zhao2 huo3', 着陆: 'zhuo2 lu4', 执着: 'zhi2 zhuo2', 執著: 'zhi2 zhuo2',
    首都: 'shou3 du1', 相片: 'xiang4 pian4', 便宜: 'pian2 yi5', 薄弱: 'bo2 ruo4',
    天地: 'tian1 di4', 大地: 'da4 di4',
  };
  const MAX_WORD = Math.max(...Object.keys(WORDS).map((w) => [...w].length));

  const HAN = /[㐀-鿿豈-﫿]/;
  const LATIN = /[A-Za-z0-9'’]/;
  const BREAK = /[，。、,.!?！？；;：:…—~～\n]/;

  // Split a lyric line into sung syllables. A run of Latin letters ("baby", "OK") is one syllable
  // with no tone. Spaces and punctuation mark breath points. `fix` maps syllable index → pinyin.
  function syllables(text, fix = {}) {
    const chars = [...String(text || '')];
    const out = [];
    let i = 0;
    let pendingBreak = null;
    while (i < chars.length) {
      const c = chars[i];
      if (HAN.test(c)) {
        // Longest known word starting here.
        let read = null;
        for (let L = Math.min(MAX_WORD, chars.length - i); L >= 2 && !read; L--) {
          const w = chars.slice(i, i + L).join('');
          if (WORDS[w]) read = WORDS[w].split(' ');
        }
        const n = read ? read.length : 1;
        for (let k = 0; k < n; k++) {
          const ch = chars[i + k];
          out.push({ ch, py: read ? read[k] : PY.get(ch) || null, han: true, gap: k === 0 ? pendingBreak : null });
          pendingBreak = null;
        }
        i += n;
      } else if (LATIN.test(c)) {
        let w = '';
        while (i < chars.length && LATIN.test(chars[i])) w += chars[i++];
        out.push({ ch: w, py: null, han: false, gap: pendingBreak });
        pendingBreak = null;
      } else {
        if (out.length) {
          const strong = BREAK.test(c);
          if (strong || c.trim() === '') pendingBreak = strong || pendingBreak === 'comma' ? 'comma' : 'space';
        }
        i++;
      }
    }
    // AA地 (慢慢地, 静静地): the adverb particle de.
    out.forEach((s, k) => {
      if ((s.ch === '地') && k >= 2 && out[k - 1].ch === out[k - 2].ch && !fix[k]) s.py = 'de5';
    });
    out.forEach((s, k) => {
      if (fix[k]) s.py = fix[k];
      s.tone = s.py ? Number(s.py.slice(-1)) : 0; // 0 = unknown (Latin, or not in the data)
      s.base = s.py ? s.py.slice(0, -1) : '';
      s.i = k;
    });
    applySandhi(out);
    return out;
  }

  // Tone changes in connected speech, which is what a listener matches the melody against:
  // 一 and 不 become 2nd tone before a 4th; 一 becomes 4th before the others; 3 + 3 → 2 + 3.
  function applySandhi(syl) {
    syl.forEach((s) => { s.sung = s.tone; s.sandhi = null; });
    for (let k = 0; k < syl.length; k++) {
      const s = syl[k];
      const next = syl[k + 1] && !syl[k + 1].gap ? syl[k + 1] : null;
      const prev = syl[k - 1];
      if (s.ch === '一' && s.tone === 1 && next && next.tone && !(prev && /[第十一二三四五六七八九]/.test(prev.ch))) {
        s.sung = next.tone === 4 || next.tone === 5 ? 2 : 4;
        s.sandhi = '一';
      } else if (s.ch === '不' && s.tone === 4 && next && next.tone === 4) {
        s.sung = 2;
        s.sandhi = '不';
      }
    }
    for (let k = syl.length - 2; k >= 0; k--) {
      const s = syl[k];
      const next = syl[k + 1];
      if (s.sung === 3 && next.sung === 3 && !next.gap) { s.sung = 2; s.sandhi = '3'; }
    }
    return syl;
  }

  // 'xin1' → 'xīn'.
  const MARKS = { a: 'āáǎà', e: 'ēéěè', i: 'īíǐì', o: 'ōóǒò', u: 'ūúǔù', v: 'ǖǘǚǜ' };
  function marked(py) {
    if (!py) return '';
    const tone = Number(py.slice(-1));
    let s = py.slice(0, -1);
    if (tone >= 1 && tone <= 4) {
      let at = -1;
      if (s.includes('a')) at = s.indexOf('a');
      else if (s.includes('e')) at = s.indexOf('e');
      else if (s.includes('ou')) at = s.indexOf('o');
      else for (let k = s.length - 1; k >= 0; k--) if ('iouv'.includes(s[k])) { at = k; break; }
      if (at >= 0) s = s.slice(0, at) + MARKS[s[at]][tone - 1] + s.slice(at + 1);
    }
    return s.replace(/v/g, 'ü');
  }

  // ---------- rhyme ----------
  // The final of a syllable (no tone), spelled in full: 'xiu' → 'iou', 'jun' → 'vn', 'zhi' → '-i'.
  function finalOf(base) {
    let s = String(base || '').toLowerCase();
    if (!s) return '';
    if (/^(zh|ch|sh|r|z|c|s)i$/.test(s)) return '-i';
    if (s === 'er') return 'er';
    if (s[0] === 'y') {
      s = s.slice(1);
      if (s[0] === 'u') s = `v${s.slice(1)}`;
      else if (s[0] !== 'i') s = `i${s}`;
    } else if (s[0] === 'w') {
      s = s.slice(1);
      if (s === 'eng') return 'ong';
      if (s[0] !== 'u') s = `u${s}`;
    } else {
      const m = s.match(/^(zh|ch|sh|[bpmfdtnlgkhjqxrzcs])(.*)$/);
      if (m) {
        s = m[2];
        if ('jqx'.includes(m[1]) && s[0] === 'u') s = `v${s.slice(1)}`;
      }
    }
    if (s === 'ui') return 'uei';
    if (s === 'iu') return 'iou';
    if (s === 'un') return 'uen';
    return s;
  }

  // 十三辙: the thirteen rhyme groups singers and lyricists use. Lines rhyme when their last
  // syllables are in the same group, whatever the tone.
  const RHYME_GROUPS = [
    { id: 'fahua', zh: '发花', sound: 'a', finals: ['a', 'ia', 'ua'], open: true,
      words: '天涯 年华 晚霞 烟花 回答 牵挂 长发 说话 繁华 落下 放下 童话 雪花 浪花 害怕 挣扎 回家 风沙 喧哗 灯下' },
    { id: 'suobo', zh: '梭波', sound: 'o / e', finals: ['o', 'e', 'uo'], open: true,
      words: '寂寞 漂泊 烟火 沉默 承诺 错过 角落 坠落 灯火 闪烁 星河 快乐 选择 唱歌 难过 生活 解脱 记得 执着 骆驼' },
    { id: 'miexie', zh: '乜斜', sound: 'ie / üe', finals: ['ie', 've'], open: false,
      words: '告别 季节 离别 黑夜 世界 细节 誓约 凋谢 了解 冰雪 岁月 和解 熄灭 明月 拒绝 感谢 深夜 蝴蝶 喜悦 坚决' },
    { id: 'huailai', zh: '怀来', sound: 'ai', finals: ['ai', 'uai'], open: true,
      words: '未来 等待 存在 无奈 离开 依赖 期待 大海 窗台 徘徊 尘埃 明白 舞台 色彩 释怀 澎湃 精彩 现在 心爱 关怀' },
    { id: 'huidui', zh: '灰堆', sound: 'ei / ui', finals: ['ei', 'uei'], open: false,
      words: '眼泪 心碎 后悔 憔悴 疲惫 安慰 无畏 玫瑰 珍贵 宝贝 回味 伤悲 沉睡 相随 追随 滋味 心扉 一回 光辉 枯萎' },
    { id: 'yaotiao', zh: '遥条', sound: 'ao', finals: ['ao', 'iao'], open: true,
      words: '拥抱 微笑 骄傲 燃烧 心跳 知道 寻找 奔跑 喧嚣 到老 浪潮 呼啸 味道 不要 煎熬 祈祷 美好 依靠 外套 飘摇' },
    { id: 'youqiu', zh: '油求', sound: 'ou / iu', finals: ['ou', 'iou'], open: true,
      words: '温柔 自由 守候 等候 尽头 回头 背后 挥手 理由 停留 漂流 永久 怀旧 街头 心头 烈酒 朋友 牵手 宇宙 一起走' },
    { id: 'yanqian', zh: '言前', sound: 'an', finals: ['an', 'ian', 'uan', 'van'], open: true,
      words: '从前 思念 永远 春天 身边 遇见 再见 誓言 夏天 想念 瞬间 呐喊 呼唤 遗憾 孤单 平凡 灿烂 天边 温暖 期盼' },
    { id: 'renchen', zh: '人辰', sound: 'en / in', finals: ['en', 'in', 'uen', 'vn'], open: false,
      words: '青春 灵魂 黄昏 天真 认真 爱人 伤痕 温存 缘分 眼神 森林 光阴 灰烬 回音 星辰 清晨 失神 靠近 相信 一个人' },
    { id: 'jiangyang', zh: '江阳', sound: 'ang', finals: ['ang', 'iang', 'uang'], open: true,
      words: '远方 光芒 飞翔 力量 梦想 天堂 月光 迷茫 慌张 坚强 流浪 地方 阳光 海洋 倔强 逞强 模样 时光 信仰 故乡' },
    { id: 'zhongdong', zh: '中东', sound: 'ong / eng / ing', finals: ['ong', 'eng', 'ing', 'iong', 'ueng'], open: true,
      words: '天空 梦中 心痛 感动 冲动 霓虹 彩虹 相逢 眼睛 心情 风景 宿命 生命 曾经 永恒 天明 春风 英雄 倒影 背影' },
    { id: 'yiqi', zh: '一七', sound: 'i / ü', finals: ['i', 'v', '-i', 'er'], open: false,
      words: '回忆 秘密 呼吸 雨季 勇气 距离 美丽 叹息 奇迹 唯一 世纪 日记 一起 心事 故事 名字 坚持 原地 孤寂 期许' },
    { id: 'gusu', zh: '姑苏', sound: 'u', finals: ['u'], open: false,
      words: '孤独 幸福 痛苦 道路 脚步 礼物 清楚 归宿 祝福 无数 守护 迷路 温度 认输 倾诉 速度 结束 舞步 糊涂 沉浮' },
  ];
  const GROUP_OF_FINAL = new Map();
  for (const g of RHYME_GROUPS) for (const f of g.finals) if (!GROUP_OF_FINAL.has(f)) GROUP_OF_FINAL.set(f, g);
  // 'e' after a consonant (歌, 河) is 梭波; 'ie'/'üe' (夜, 月) are 乜斜. finalOf keeps them apart.
  const rhymeOf = (base) => GROUP_OF_FINAL.get(finalOf(base)) || null;
  const groupById = (id) => RHYME_GROUPS.find((g) => g.id === id) || null;

  // The last sung syllable of a line, for rhyming (skips a trailing particle like 啊, 吧, 了).
  const PARTICLES = new Set(['啊', '吧', '呢', '吗', '了', '的', '呀', '哦', '喔', '啦', '耶', '嘛']);
  function rhymeSyllable(syl) {
    for (let k = syl.length - 1; k >= 0; k--) {
      const s = syl[k];
      if (!s.han || !s.py) continue;
      if (PARTICLES.has(s.ch) && k > 0 && k === syl.length - 1) continue;
      return s;
    }
    return null;
  }

  // ---------- tones against the melody ----------
  // Pitch shapes on the 1–5 scale: 1st high level (55), 2nd rising (35), 3rd low (21[4]), 4th
  // falling (51). For two syllables in a row, the melody should move the way the tones do.
  // Each entry: the directions that keep the words clear, from the first syllable to the second.
  const WANT = {
    11: 'level', 12: 'down level', 13: 'down', 14: 'level down',
    21: 'up level', 22: 'level up', 23: 'down', 24: 'up level',
    31: 'up', 32: 'up', 33: 'up', 34: 'up',
    41: 'up level', 42: 'any', 43: 'down', 44: 'level down',
  };
  const WHY = {
    1: '1st tone (high, level)', 2: '2nd tone (rising)', 3: '3rd tone (low)', 4: '4th tone (falling)', 5: 'neutral tone',
  };
  // The neutral tone takes its pitch from the syllable before it: low after 1st, 2nd and 4th, higher after 3rd.
  function want(a, b) {
    if (!a || !b) return 'any';
    if (b === 5) return a === 3 ? 'up level' : 'down level';
    if (a === 5) return 'any';
    return WANT[`${a}${b}`] || 'any';
  }

  // How a move of `semis` semitones between two sung syllables fits their tones.
  // → { fit: 'good' | 'ok' | 'bad', want, dir }
  function judge(a, b, semis) {
    const w = want(a, b);
    const dir = semis > 0 ? 'up' : semis < 0 ? 'down' : 'level';
    const big = Math.abs(semis);
    if (w === 'any') return { fit: 'good', want: w, dir };
    const opts = w.split(' ');
    if (opts.includes(dir)) {
      // 'level' as the only wish: a small step is fine, a leap blurs it.
      if (dir !== 'level' || opts.length > 1 || big === 0) return { fit: 'good', want: w, dir };
    }
    if (dir === 'level') return { fit: opts.includes('level') ? 'good' : 'ok', want: w, dir };
    if (opts[0] === 'level' && opts.length === 1) return { fit: big <= 2 ? 'good' : big <= 4 ? 'ok' : 'bad', want: w, dir };
    // Moving against the tones: a step is a smudge, a leap can change the word (倒字).
    return { fit: big <= 2 ? 'ok' : 'bad', want: w, dir };
  }

  function describeWant(w) {
    return { level: 'stay level', up: 'go up', down: 'go down', 'down level': 'go down or stay', 'level down': 'stay or go down a little', 'up level': 'go up or stay', 'level up': 'stay or go up', any: 'go anywhere' }[w] || w;
  }

  const api = { PY, WORDS, syllables, applySandhi, marked, finalOf, rhymeOf, groupById, rhymeSyllable, RHYME_GROUPS, PARTICLES, want, judge, describeWant, WHY };
  root.Zh = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
