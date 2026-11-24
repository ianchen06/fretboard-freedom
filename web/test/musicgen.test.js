// Tests the in-browser backing-track helper: prompt building, the duration-to-tokens
// math, and the WAV encoder. The model itself never runs here: loading and generation
// need a browser worker, so this file covers only the pure parts.
// Run: node web/test/musicgen.test.js
'use strict';
const M = require('../js/musicgen.js');

let failures = 0;
const check = (ok, msg) => { if (!ok) { failures++; console.log('  FAIL', msg); } };

// ---------- constants ----------
console.log('constants');
check(M.MODEL_ID === 'Xenova/musicgen-small', 'model id');
check(M.SAMPLE_RATE === 32000, '32 kHz sample rate');
check(M.TOKEN_RATE === 50, '50 tokens per second');
check(M.SERVER_URL === 'https://ai.0x1.tw', `server url (got ${M.SERVER_URL})`);

// ---------- server mode ----------
console.log('server mode');
check(M.getMode() === 'server', `default mode is server (got ${M.getMode()})`);
check(M.isSupported() === true, 'server mode needs only fetch, so it is supported in Node');
M.setMode('browser');
check(M.getMode() === 'browser', 'setMode browser');
check(M.isSupported() === false, 'browser mode needs a module worker, none in Node');
M.setMode('server');
check(M.getMode() === 'server', 'setMode server');
let threw = false;
try { M.setMode('bogus'); } catch { threw = true; }
check(threw && M.getMode() === 'server', 'setMode rejects an unknown mode');

// ---------- duration -> tokens ----------
console.log('tokens');
check(M.durationToTokens(10) === 500, '10 s is 500 tokens');
check(M.durationToTokens(20) === 1000, '20 s is 1000 tokens');
check(M.durationToTokens(30) === 1500, '30 s is 1500 tokens (the model cap)');
check(M.durationToTokens(60) === 1500, 'longer than 30 s clamps to 1500 tokens');
check(M.durationToTokens(0) === 50, '0 s clamps to the 1 s minimum (50 tokens)');

// ---------- write prompt ----------
console.log('write prompt');
const wp = M.buildWritePrompt({ style: 'ballad', bpm: 96, keyPc: 9 });
check(/Mandopop ballad/.test(wp), `ballad style (got: ${wp})`);
check(/A major/.test(wp), 'keyPc 9 is A major');
check(/96 bpm/.test(wp), 'bpm carried');
check(/no vocals/.test(wp), 'instrumental only');
check(/Mandopop rock song/.test(M.buildWritePrompt({ style: 'rock', bpm: 120, keyPc: 0 })), 'rock style + C major');
check(/Mandopop song/.test(M.buildWritePrompt({ style: 'weird', bpm: null, keyPc: null })), 'unknown style falls back');

// ---------- session prompt ----------
console.log('session prompt');
const sp = M.buildSessionPrompt({ skill: 'pent', bpm: 72, keyPc: 9 });
check(/blues-rock pentatonic/.test(sp), `pent skill (got: ${sp})`);
check(/72 bpm/.test(sp) && /A major/.test(sp), 'session bpm and key carried');
check(/heavy metal/.test(M.buildSessionPrompt({ skill: 'metal', bpm: 100, keyPc: 2 })), 'metal skill');
check(/blues string-bending/.test(M.buildSessionPrompt({ skill: 'bends', bpm: 80, keyPc: 5 })), 'bends skill');
check(/expressive rock ballad/.test(M.buildSessionPrompt({ skill: 'vibrato:narrow', bpm: 80, keyPc: 5 })), 'vibrato:narrow maps by family');
check(/melodic guitar practice groove/.test(M.buildSessionPrompt({ skill: 'something-new', bpm: 80, keyPc: 5 })), 'unknown skill falls back');

// ---------- WAV ----------
(async () => {
  console.log('wav');
  const data = new Float32Array([0, 0.5, -0.5, 1, -1]);
  const blob = M.encodeWav(data, 32000);
  check(blob.type === 'audio/wav', 'wav mime type');
  check(blob.size === 44 + 10, `wav size is header + 2 bytes per sample (got ${blob.size})`);
  const ab = await blob.arrayBuffer();
  const v = new DataView(ab);
  const str = (o, n) => String.fromCharCode(...new Uint8Array(ab, o, n));
  check(str(0, 4) === 'RIFF', 'RIFF header');
  check(str(8, 4) === 'WAVE', 'WAVE header');
  check(str(12, 4) === 'fmt ', 'fmt chunk');
  check(str(36, 4) === 'data', 'data chunk');
  check(v.getUint32(24, true) === 32000, 'sample rate field');
  check(v.getUint16(22, true) === 1, 'mono');
  check(v.getUint16(34, true) === 16, '16-bit samples');
  check(v.getInt16(44, true) === 0, 'silence encodes to 0');
  check(v.getInt16(44 + 2, true) === 0x3FFF, '0.5 encodes to 16383');
  check(v.getInt16(44 + 4, true) === -0x4000, '-0.5 encodes to -16384');
  check(v.getInt16(44 + 6, true) === 0x7FFF, '1.0 encodes to 32767');
  check(v.getInt16(44 + 8, true) === -0x8000, '-1.0 encodes to -32768');

  // ---------- WAV decode (round-trip through the encoder) ----------
  console.log('wav decode');
  const decoded = M.decodeWav(ab);
  check(decoded.sampling_rate === 32000, `decoded sample rate (got ${decoded.sampling_rate})`);
  check(decoded.audio.length === 5, `decoded length (got ${decoded.audio.length})`);
  check(Math.abs(decoded.audio[1] - 16383 / 32768) < 1e-6, '0.5 round-trips through int16');
  check(Math.abs(decoded.audio[2] - (-16384 / 32768)) < 1e-6, '-0.5 round-trips through int16');
  check(decoded.audio[3] === 32767 / 32768, '1.0 round-trips through int16');
  let badWav = false;
  try { M.decodeWav(new Uint8Array([1, 2, 3, 4]).buffer); } catch { badWav = true; }
  check(badWav, 'decodeWav rejects non-WAV bytes');

  // ---------- server generate (stubbed fetch) ----------
  console.log('server generate');
  const realFetch = globalThis.fetch;
  const wavBytes = ab;
  globalThis.fetch = async (url, opts) => {
    if (String(url).endsWith('/health')) return { ok: true, json: async () => ({ status: 'ok' }) };
    if (String(url).endsWith('/api/musicgen')) {
      const body = JSON.parse(opts.body);
      check(typeof body.prompt === 'string' && /ballad/.test(body.prompt), 'server generate sends the prompt');
      check(body.duration === 10, `server generate sends duration in seconds (got ${body.duration})`);
      return { ok: true, arrayBuffer: async () => wavBytes.slice(0) };
    }
    return { ok: false, status: 404 };
  };
  try {
    let generatingCalled = false;
    const track = await M.generate('Mandopop ballad backing track, 96 bpm, no vocals', {
      seconds: 10,
      onGenerating: () => { generatingCalled = true; },
    });
    check(generatingCalled, 'server generate calls onGenerating');
    check(track.sampling_rate === 32000, `server track sample rate (got ${track.sampling_rate})`);
    check(track.audio.length === 5, `server track length (got ${track.audio.length})`);
    check(Math.abs(track.audio[1] - 16383 / 32768) < 1e-6, 'server track samples decode');
    check((await M.load()) === 'server', `load reports server (got ${M.device})`);
    // A dead server rejects with a clear message, not a bare TypeError.
    globalThis.fetch = async () => { throw new TypeError('fetch failed'); };
    let failed = false;
    try { await M.generate('x', { seconds: 10 }); } catch (err) { failed = /unreachable/.test(err.message); }
    check(failed, 'dead server rejects as unreachable');
  } finally {
    globalThis.fetch = realFetch;
    M.setMode('server');
  }

  console.log(failures ? `${failures} FAILURES` : 'ALL PASS');
  process.exit(failures ? 1 : 0);
})();
