# AI models and open-source projects for the practice app

A survey of what could be added to the app from Hugging Face, GitHub and LLM APIs, with a recommendation. Written 2026-11-20. **Update 2026-11-23: option 1 is built, in-browser** — the lyric partner runs Qwen2.5-1.5B-Instruct in the song writing page (`js/llm.js`, `js/llm-worker.js`, `web/test/llm.test.js`). The API-key route and the weekly coach are still unbuilt. The only other third-party code in the app is still the amp engine in `vendor/nam/`.

The README explains [why the exercises come from rules](README.md#why-rules-not-ai-or-machine-learning-for-the-content), and that still holds. The options below are for jobs rules can't do: writing words, producing audio, and hearing more than one note at a time.

## Recommendation

Build in this order:

1. **Lyric partner and weekly coach** (an LLM). The smallest build, and it reuses the tone and rhyme checker.
2. **Sung demo of your song** (DiffSinger through OpenUtau, then ACE-Step). The biggest payoff for songwriting, but it needs software installed on the Mac.
3. **Play along with real songs** (alphaTab, Demucs, Beat This).

Hearing chords and watching your hands by camera are experiments to try after those.

## Three ways a model can plug in

The app is plain HTML, CSS and JavaScript with no build step. A model can join it in one of three ways:

| Where it runs | How | Suits |
|---|---|---|
| In the browser | Files vendored like `vendor/nam/` and loaded only by the page that needs them. Runtimes: TensorFlow.js, [Transformers.js](https://github.com/huggingface/transformers.js) (Apache-2.0), MediaPipe. | Small models that must react while you play |
| On the Mac | A local helper (a script, or a server on `localhost`) that the page calls, or whose output files the page loads. This Mac is Apple Silicon with 36 GB of memory. | Heavy audio models |
| Through an API | The page calls a hosted model with your own key. | Language tasks |

Each option below is a new dependency or download, so each needs a deliberate yes before it goes in.

## 1. Lyric partner and weekly coach

**What you'd get.** In Song writing: ask for a next line, a rewrite, or a line that ends in a given 轍. In Daily session: a weekly review of what improved, what's stuck and what to change.

**Built 2026-11-23, in-browser route.** The song writing page has an ✨ AI words button on every line: the model drafts three lines and the checker ranks them best first. Model: Qwen2.5-1.5B-Instruct (`onnx-community/Qwen2.5-1.5B-Instruct`, q4f16, ~1.1 GB on first use, cached after) via Transformers.js 4.3.2 in a module worker (`js/llm-worker.js`); the prompt and the scoring live in `js/llm.js`, covered by `web/test/llm.test.js`. Scoring is tone fit against the line's melody (50%), rhyme group (30%) and syllable count against the notes (20%); a line with fewer syllables than notes is fine (melisma), more is penalised. The weekly coach is still unbuilt, and so is the API-key route — the key-in-a-public-page problem in the limits below still stands for that route.

**Update 2026-11-23: server mode.** The in-browser weights crash iPhone Safari (the tab runs out of memory while the 1.1 GB model loads), so `js/llm.js` now has a server mode (default): the write page POSTs the prompt to the lyric server at `https://ai.0x1.tw/api/lyrics` (Qwen2.5-3B via Ollama on the Oracle A1, `infra/server/app.py`) and scores the returned lines the same way. The AI panel has a Server / On-device toggle (`ff.lyricMode` in browser storage); On-device keeps the in-browser route above. **Update 2026-11-24: the server first ran the 0.5B model with a raw prompt and no chat template, and it repeated itself** — it now runs Qwen2.5-3B with the prompt wrapped in the model's ChatML template and a 1.1 repetition penalty. The 1.5B model fixed the repetition but still missed the length and rhyme; the 3B model hit ~7 characters and the ang rhyme in 2 of 3 test lines (one slipped in a Simplified character). **MusicGen's server endpoint is fixed too** (the step-3 encoder-cache bug, `6fa5b80c`), so `js/musicgen.js` has the same server mode (default, `ff.musicgenMode`): the write and session pages POST the prompt to `https://ai.0x1.tw/api/musicgen` and decode the returned WAV, with a Server / On-device toggle in both backing-track panels. **Update 2026-11-24: MusicGen runs bass-heavy** — prompt wording only helps modestly and varies run to run; the write-page prompt now uses the brightest measured ballad wording (bright acoustic guitar, sparkling piano, hi-hats, clear high melody), which measured 7.88% of energy above 1 kHz against ~5% for the earlier wording.

**How it fits.** The LLM drafts and the rules check, the same pattern as the lick library (`licks-blues.js` was drafted by AI and is checked by `lickgen.js`).

- For lyrics, `zh.js` already judges tone fit against the melody and sorts line endings into the 十三轍. Each suggested line can be shown with its 倒字 and rhyme result, or filtered before you see it.
- For the coach, the practice history is already in browser storage (`ff.days`, `ff.learner`).

**Limits.**

- It needs a network connection and an API key.
- A key pasted into a static page can be read by anyone who can open that page. That's fine on `localhost` and not on a public site.
- An LLM can miscount syllables and get tones wrong, which is why the checker stays in the loop.

## 2. Sung demo of your song

| Project | What it does | License | On this Mac |
|---|---|---|---|
| [DiffSinger](https://github.com/openvpi/DiffSinger) | Singing voice synthesis from notes and lyrics. Its README points to OpenUtau for everyday use. | Apache-2.0 | Yes, through OpenUtau |
| [OpenUtau](https://github.com/stakira/OpenUtau) | Free singing-synthesis editor with Chinese phonemizers | MIT | Yes |
| [ACE-Step 1.5](https://github.com/ace-step/ACE-Step-1.5) | Generates a full song, band and vocals, from lyrics and style tags. Lyrics in 50+ languages. Also has cover and repaint modes. | MIT | Yes: MLX on Apple Silicon, a portable macOS package and a local API server |
| [YuE](https://github.com/multimodal-art-projection/YuE) (now YuE2) | Full-song generation | Apache-2.0 | No: it asks for Linux and an NVIDIA GPU with 24 GB |

**How it fits.**

- **DiffSinger sings your melody exactly.** `write.html` already holds what a singing synthesizer needs: a pitch, a length and the pinyin for every syllable. The work is an export next to the lead sheet, which today saves only .txt and .json. You open the export in OpenUtau with a Mandarin voice. The first version adds no model to the app at all.
- **ACE-Step makes a finished-sounding demo.** The page sends the lyrics and a style (ballad, Mandopop or rock, with tempo and key) to a local ACE-Step server and plays what comes back. It writes its own melody and arrangement, so it lets you hear the lyrics as a song, not hear your tune.

**Limits.**

- DiffSinger voices are separate downloads, each with its own terms.
- ACE-Step's weights are about 4.7 GB for the 2B model and about 9 GB for XL. Its speed on this Mac hasn't been measured.
- Whether ACE-Step's cover mode can be steered by the app's own guide-voice audio is untested.
- The export format (an OpenUtau project or MIDI with lyrics) is to be settled when building.

## 2b. In-browser music generation (checked 2026-11-23, built 2026-11-23)

- **MusicGen small (Meta) via Transformers.js — BUILT.** `Xenova/musicgen-small` is the ONNX port, with documented Transformers.js use (`MusicgenForConditionalGeneration`, q8 weights ~1 GB) and a live in-browser demo (Xenova/musicgen-web). Text prompt in, instrumental audio out; 0.3B parameters, short clips, slow autoregressive generation. It invents from a prompt — it cannot play your chords or melody, and it has no vocals. The Hub lists no license on either the Xenova or the facebook repo; MusicGen's original release was non-commercial, so read the card before using outputs in a release. Same worker pattern as the lyric partner: `js/musicgen.js` + `js/musicgen-worker.js`, with a `Player` (play/stop/WAV download), prompt builders for the write page (style, key, tempo) and the session page (exercise skill, tempo, key), and `web/test/musicgen.test.js`. Wired into both pages: a 🎵 Backing track button on the write page (a sketch in the song's style and tempo) and a 🎵 AI track chip on the session page (a practice groove for the current exercise; playing it stops the built-in backing). The MusicGen Melody variant (an audio prompt that steers the melody) has **no ONNX port** — `Xenova/musicgen-melody` does not exist on the Hub (checked 2026-11-23) — so this build is text prompts only.
- **Magenta.js (Google).** MusicVAE / MusicRNN (melody, trio, drums) in TensorFlow.js, small checkpoints, fast — but symbolic (MIDI), not audio; old and effectively unmaintained; trained on Western MIDI with no Mandarin tone awareness (already in "skipped" below). The rule generator in `songtheory.js` already does tone-correct melodies better for this app.

What does not exist in-browser: full songs with vocals (ACE-Step, YuE, Suno need a GPU or an API) or singing your exact melody (DiffSinger is desktop).

## 3. Play along with real songs

| Project | What it does | License | Runs |
|---|---|---|---|
| [alphaTab](https://github.com/CoderLine/alphaTab) | Reads Guitar Pro files, draws the tab and plays it back. Not ML. | MPL-2.0 | Browser |
| [Demucs](https://github.com/facebookresearch/demucs) | Splits a recording into stems. The `htdemucs_6s` model adds guitar and piano stems. | MIT | Mac (Python) |
| [Beat This](https://github.com/CPJKU/beat_this) | Finds beats and downbeats in a recording | MIT | Mac (Python) |

**How it fits.**

- alphaTab gives the notes of a real song as data. The existing sequence grader can check the mic against them, and the tempo ladder can slow a hard passage.
- Demucs makes a backing track of the actual record: drop the guitar stem and mix the rest. Soloing the guitar stem lets you hear a part on its own.
- Beat This gives the beat times, so the app's grid and tab pointer can follow a recording that wasn't played to a click.

**Limits.**

- Demucs is no longer maintained. Its README says so, and the author's [fork](https://github.com/adefossez/demucs) isn't actively maintained either.
- The Demucs README calls the guitar stem "okay quality".
- A browser port exists ([demucs.cpp](https://github.com/sevagh/demucs.cpp), MIT), but separation is heavy work, so the Mac is the better place for it.
- You supply your own Guitar Pro files and recordings, as with `.nam` captures.

## 4. Experiments

### Hearing chords and double stops

[Basic Pitch](https://github.com/spotify/basic-pitch) from Spotify (Apache-2.0) transcribes several notes at once, with pitch bends, and isn't tied to one instrument. [basic-pitch-ts](https://github.com/spotify/basic-pitch-ts) (Apache-2.0) runs it in the browser.

**How it fits.** `pitch.js` hears one note at a time, and `onset.js` hears attacks but not pitches. So the Rhythm page can time a strum but can't tell whether it was the right chord. Basic Pitch could check the notes of a recorded take.

**Limits.**

- It works on a recorded buffer, not note by note while you play.
- It hasn't been tried on a high-gain tone.
- For power chords, a plain check of which pitch classes are sounding needs no model and should be tried first.

### Watching your hands by camera

[MediaPipe](https://github.com/google-ai-edge/mediapipe) Hand Landmarker (Apache-2.0) tracks 21 points on each hand in the browser. It could flag fingers lifting far off the fretboard, the thumb creeping over the neck, or how far the picking hand travels.

**Limits.** Fingers hide each other on a neck. It sees hands, not which fret or string. It depends on where the camera sits.

## 5. A small win without ML: fuller pinyin for 多音字

`pinyin-data.js` gives each character one reading. `zh.js` adds about 100 words where the reading differs (長大, 音樂, 瞭解), and you can tap a syllable to fix a wrong one. [pinyin-pro](https://github.com/zh-lx/pinyin-pro) (MIT) would replace that hand-written list with a full phrase dictionary. The gain is modest and the cost is a dependency.

## Looked at and skipped

| Project | License | Why skipped |
|---|---|---|
| [CREPE](https://github.com/marl/crepe), [PESTO](https://github.com/SonyCSLParis/pesto) | MIT, LGPL-3.0 | Neural pitch trackers for single notes. The YIN tracker in `pitch.js` is already tuned for guitar and covered by tests, so the gain would be small. |
| [Magenta.js](https://github.com/magenta/magenta-js) and similar melody generators | Apache-2.0 | Trained on Western MIDI, with no notion of Mandarin tones. The rule generator in `songtheory.js` follows the tones. |
| [TabCNN](https://github.com/andywiggins/tab-cnn), [FretNet](https://github.com/cwitkowitz/guitar-transcription-continuous) | No license file, MIT | Audio to tab (string and fret). Research models built around acoustic guitar recordings, so unreliable on distorted electric guitar. |
| [essentia.js](https://github.com/MTG/essentia.js) | AGPL-3.0 | Sharing or hosting the app would put the whole app under the AGPL. |
| More amp modelers | | NAM is already in. |

## What was checked

- **Licenses** were read from each repository's license file on 2026-11-20. Transformers.js is included; the other runtimes' licenses weren't read.
- **Requirements and features** of ACE-Step 1.5, YuE2, Demucs, Basic Pitch, DiffSinger and OpenUtau come from their READMEs on that day.
- **Not checked:** the licenses of model weights on Hugging Face (they can differ from the code's), DiffSinger voice terms, download sizes other than those above, and how active each project is.
- **From memory, not checked:** that the tab models were trained on acoustic recordings, MediaPipe's 21 points per hand, and OpenUtau's file formats.
- **No model was run.** Quality on your guitar tone and your voice is unknown until one is tried.
