# AI models and open-source projects for the practice app

A survey of what could be added to the app from Hugging Face, GitHub and LLM APIs, with a recommendation. Written 2026-11-20.

**Update 2026-11-24: two of these were built and then removed.** An LLM lyric partner (option 1) and MusicGen backing tracks (option 2b) shipped on 2026-11-23, first in the browser and then on a server. Both were measured against real output on 2026-11-24, and both were taken out the same day. The results are in [Tried and removed](#tried-and-removed-2026-11-24) below. The only third-party code in the app is again the amp engine in `vendor/nam/`, and the app again makes no network requests.

The README explains [why the exercises come from rules](README.md#why-rules-not-ai-or-machine-learning-for-the-content), and that still holds. The options below are for jobs rules can't do: writing words, producing audio, and hearing more than one note at a time.

## Recommendation

Build in this order:

1. **Weekly coach** (an LLM). The lyric partner that was first on this list was built and removed (see [Tried and removed](#tried-and-removed-2026-11-24)). The coach would still need an on-device model to keep the app's no-network promise.
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

**Built 2026-11-23, removed 2026-11-24.** The lyric partner drafted lines with Qwen and ranked them with the tone and rhyme checker. It missed the length and the rhyme most of the time; see [Tried and removed](#tried-and-removed-2026-11-24). The weekly coach and the API-key route were never built.

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

## 2b. In-browser music generation (checked 2026-11-23, built 2026-11-23, removed 2026-11-24)

- **MusicGen small (Meta) via Transformers.js — built, then removed.** `Xenova/musicgen-small` is the ONNX port of `facebook/musicgen-small`. It takes a text prompt and returns a short instrumental clip. It invents the music from the prompt, so it cannot play your chords or melody, and it has no vocals. **Its weights are CC-BY-NC 4.0** (AudioCraft's [README](https://github.com/facebookresearch/audiocraft#license), `LICENSE_weights` and [model card](https://github.com/facebookresearch/audiocraft/blob/main/model_cards/MUSICGEN_MODEL_CARD.md)). The model card gives its intended use as research, and says it "should not be used on downstream applications without further investigation and mitigation of risks". The MusicGen Melody variant, which steers the melody from an audio prompt, has no ONNX port (`Xenova/musicgen-melody` does not exist on the Hub, checked 2026-11-23). Measurements and the reasons for removal are in [Tried and removed](#tried-and-removed-2026-11-24).
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

## Tried and removed (2026-11-24)

Both features ran on the song writing page, and MusicGen also on the Daily session page. Each had an in-browser mode (Transformers.js in a module worker, about 1 GB of weights from the Hugging Face Hub) and a server mode, which was the default. Server mode was a FastAPI service on an Oracle Cloud A1 instance behind a Cloudflare Tunnel: Ollama for lyrics, ONNX Runtime for MusicGen. The code is in the git history, last at `ea9651c` (`web/js/llm.js`, `web/js/musicgen.js`, their workers and tests, and `infra/`).

### Lyric partner (Qwen2.5-3B via Ollama, server mode)

**How it was measured.** The demo song 老地方 was rebuilt in Node exactly as `write-app.js` builds it. Each of its 10 lyric lines was asked of the live server exactly as the ✨ AI words button asked: the app's own prompt, three drafts per line, and the app's own cleaning and scoring. This was done twice: once with each section's own rhyme group (懷來, 梭波), and once with 江陽, 一七 and 中東. That made 60 drafts for 20 line requests. Simplified characters were found with OpenCC's `STCharacters.txt`.

| Measure | Result |
|---|---|
| Right syllable count | 4 / 60 (7%) |
| Two or more syllables short | 37 / 60 (62%) |
| Too many syllables to sing | 4 / 60 (7%) |
| Ends in the asked-for rhyme group | 34 / 60 (57%) |
| English leaked in ("等你 Until 傑頭來", "waiting") | 5 / 60 |
| Simplified characters (怀) | 2 / 60 |
| Copied the song title 老地方 into the line | 15 / 60 |
| Lines where at least one of the three drafts had the right count (or one short), the rhyme, and no English or Simplified | 8 / 20 |

That last row doesn't ask whether the line makes sense, and many don't: "等待在老地方懷你來", "存在未解的謎懷". To land the rhyme, the model often tacks a rhyme character onto a phrase ("心中的風箏東", "心中的諾聲東"). The scorer ranked those 90 to 95.

**The ranking made it worse.** The scorer let a line be any number of syllables short, as if the extra notes were melisma. So a two-character draft scored 100 on a seven-note line ("錯過"), and on 11 of the 20 lines the top-ranked draft was two or more syllables short.

**Server bugs found along the way.** The request put `seed` and `stop` at the top level. Ollama reads them only inside `options` (`GenerateRequest` and `Options` in [ollama/api/types.go](https://github.com/ollama/ollama/blob/main/api/types.go)), so both were silently ignored. The prompt was hand-wrapped in ChatML without `raw: true`, so Ollama wrapped it a second time in the model's own template.

**Why it was removed rather than fixed.**

- **It broke the app's promise.** The privacy policy (`docs/privacy.html`) says the app "doesn't send anything over the internet". The App Store listing says "No data collected" and "Works offline". Server mode, the default, sent the song's title and earlier lyrics to the server.
- **It could not work in the iPad app.** The server's CORS allowed only `https://ianchen06.github.io`. A preflight from the app's origin `capacitor://localhost` (or from a local server) got HTTP 400.
- **The in-browser mode doesn't fit a phone.** The 1.1 GB model crashed iPhone Safari.
- **Prompting can't hold the constraints.** Published systems that hit the syllable count and the rhyme reliably enforce them while decoding, not in the prompt:
  - Guo et al., [Automatic Song Translation for Tonal Languages](https://aclanthology.org/2022.findings-acl.60/) (Findings of ACL 2022) adds decoding constraints to a pre-trained model and correlates speech tone with melody.
  - Ou et al., [Songs Across Borders](https://aclanthology.org/2023.acl-long.27/) (ACL 2023) treats singable lyric translation as constrained translation and reports 99.85% length accuracy and 99.00% rhyme accuracy.
  - Xue et al., [DeepRapper](https://aclanthology.org/2021.acl-long.6/) (ACL 2021) generates each line right to left with a rhyme constraint, so the rhyme is placed first.

  Those figures and methods come from the papers' abstracts, read through search results; the PDFs weren't reachable from the build machine.

**If it comes back,** it should: run on the device; enforce the syllable count, the rhyme and Traditional-only output while decoding; and have a scorer that penalises short lines. It should also beat the numbers above on the same 老地方 test before it ships. A smaller step that needs no model: rank the 十三轍 word bank by how well each word's tones fit the end of the line's melody, using `SongTheory.toneCheck`.

### MusicGen backing tracks (MusicGen-small via ONNX Runtime, server mode)

**How it was measured.** Six 10-second tracks were made on the live server from the app's own prompts: the three song styles at their default tempos in G, and three session skills. Tempo was read with librosa's beat tracker, forgiving half- and double-time readings. Key was read with Krumhansl–Kessler key profiles on CQT chroma.

| Prompt (asked) | Tempo heard | Key heard | Energy above 1 kHz |
|---|---|---|---|
| Ballad, 68 bpm, G major | 67 (−1.5%) | G major | 1.0% |
| Pop, 92 bpm, G major | 94 (+1.9%) | F minor | 4.6% |
| Rock, 128 bpm, G major | 129 (+1.0%) | C major | 6.5% |
| Pentatonic jam, 80 bpm, A major | 83 (+4.2%) | G minor | 22.4% |
| Metal, 120 bpm, E major | 121 (+0.8%) | E major | 6.3% |
| Funk, 90 bpm, D major | 89 (−0.8%) | F major | 5.1% |

Each 10-second track took about 20 seconds to make. The ballad prompt was the one chosen for measuring 7.88% of its energy above 1 kHz; in this run it measured 1.0%.

**Why it was removed.**

- **It can't do the job of a backing track.** It doesn't play the song's chords, and the key was right in 2 of 6. Its tempo drifts against the click: at +4.2%, it is half a beat off within 10 seconds. A clip isn't a whole number of bars, so it can't loop. The app's own band (`songband.js`, `band.js`) already plays the song's exact chords, form, key and tempo in the chosen style, and the session page has its own drone and chord pad.
- **The license.** The weights are CC-BY-NC 4.0, for research use (above), and the app ships on the App Store.
- **The same privacy, offline and CORS problems as the lyric partner.**
- **It broke the Daily session page.** Commit `9dd7e60` called `$('mgMode').addEventListener`, but `session.html` has no element with that id. The page threw on load, so the key menu stayed empty and rating, the plan and the settings never got wired up. `web/test/pages.test.js` now checks every page script's id lookups against its page.

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
- **Models run (2026-11-24):** only the two in [Tried and removed](#tried-and-removed-2026-11-24), on the live server, measured as described there. The other options haven't been run, so their quality on your guitar tone and your voice is unknown until one is tried.
- **MusicGen's license** was read from AudioCraft's repository on 2026-11-24 (code MIT, weights CC-BY-NC 4.0). The 2026-11-23 note that the Hub listed no license was wrong about the weights.
