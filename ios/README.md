# Fretboard Freedom for iPad

A native SwiftUI version of the practice app in `web/`, for iPadOS 26 and later (built with the iOS 27.2 SDK). It's the same method as the deck and the web app: you play your guitar, and the mic checks every note. The engine is a Swift port of the web app's rules, held to the same tests.

**Landscape only.** The app runs full screen in landscape left or right. The practice screen fits on one screen without scrolling, from the iPad mini (1133 × 744 pt) to the 13-inch (1376 × 1032 pt), so nothing needs a hand while you play. The neck takes whatever height is left after the header, the controls, the tab and the grades strip.

On iPadOS 26 and later, the landscape-only orientation list is only a preference for apps that can be resized, so the app also sets `UIRequiresFullScreen`. That key is what actually locks the orientation, and it also turns off Split View and Stage Manager windows for this app. Apple deprecated it in iOS 26 and says a future release will ignore it, which is why Xcode shows a warning. If that happens, the screen still works in any window size: below about 700 × 540 pt it falls back to a stacked layout that scrolls.

**Built so far:** Pentatonic boxes. Pick a minor or major pentatonic or blues box (1 to 5) in any key, then play it up and down, in 3s, in 4s or in 3rds against the click. The mic grades every note, the tempo ladder moves the click, and an on-device AI coach turns the grades into one tip for the next pass. The other pages are in the sidebar as "Coming next".

## Build and run

Open `ios/FretboardFreedom.xcodeproj` in Xcode 27 and run the **FretboardFreedom** scheme on an iPad or an iPad simulator. To run it on your own iPad, pick your team under *Signing & Capabilities* first.

From the command line:

```bash
xcodebuild -project ios/FretboardFreedom.xcodeproj -scheme FretboardFreedom -destination 'platform=iOS Simulator,name=iPad Pro 13-inch (M5)' build
```

The engine's tests run on the Mac in about 25 seconds, no simulator needed:

```bash
swift test --package-path ios/Packages/FretboardKit
```

If `xcodebuild` says the developer directory is the Command Line Tools, point it at Xcode once with `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`, or prefix each command with `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer`.

**Without a guitar.** Tap the notes on the neck: each tap plays the note and counts as played, though not for timing. In a Debug build, the launch argument `-FFDemo` plays the box in time straight into the grader for 40 seconds, with a few wrong notes. The mic stays closed and the click is muted. It runs the clock, grader, tempo ladder, learner and coach without audio input.

## How it's put together

```
ios/
├── FretboardFreedom.xcodeproj      app target: iPad only, Swift 6, main-actor by default
├── FretboardFreedom/               the app (a synchronized folder: new files are picked up)
│   ├── App/                        entry point, sidebar shell, ProgressStore
│   └── Practice/                   box practice: model, screen, cards
└── Packages/FretboardKit/          the engine, one Swift package with five modules
    ├── MusicTheory                 ← web/js/theory.js + scales.js
    ├── PracticeEngine              ← web/js/sessiongen.js (sequences, SeqGrader, Learner) + the tempo ladder
    ├── GuitarAudio                 ← web/js/pitch.js + audio.js
    ├── FretboardUI                 ← web/js/fretboard.js + seqtab.js, the deck's palette
    └── Coach                       new: Foundation Models
```

The modules depend on each other in one direction only. `MusicTheory`, `PracticeEngine` and the detector in `GuitarAudio` are plain value types with no UI and no audio hardware, so they're tested with Swift Testing on the Mac.

| Module | What's in it | Tests |
|---|---|---|
| **MusicTheory** | Pitch classes and note spelling by letter (`spellSet`, `spellAbove`: A Phrygian has B♭, the 3rd of D7 is F♯), five tunings, eleven scales, eight chords, degree labels and color roles. Shapes computed from pitches: pentatonic boxes, 7-note positions, n-notes-per-string patterns, arpeggios in a box's window, triads on string sets, one-string runs. | The deck's five A minor boxes fret for fret; every position of nine scales in all 12 keys has the right notes, none skipped, ascending, within reach; spelling cases. |
| **PracticeEngine** | Sequences (up and down, 3s, 4s, 3rds, descending 6s) that never repeat a note, even where they loop. `ShapeDrill` builds an exercise with the web app's titles, chips, how/why text, skill ids and tempo keys. `SequenceGrader` grades in order: a skipped note counts as missed, bends are held for 70 ms, and a pass is clean at 90% of the notes within ±60 ms. `TempoLadder` takes the tempo up after enough clean passes in a row (3, 2 or 1 by length) and down after two rough ones. `Learner` keeps mastery, spaced-repetition intervals, priors and tempo memory. | Sequences, every key × box × pattern builds, grader (perfect pass, skip, wrong note, loose timing), ladder up and down, learner updates, day math, reading a web backup's JSON. |
| **GuitarAudio** | `YIN` on vDSP and `NoteTracker`: pick-attack confirmation, legato rules, and the octave check over a ringing string. The real-time graph: `AVAudioSinkNode` (mic) → lock-free ring → a 100 Hz analysis thread → `AsyncStream`; a metronome `AVAudioSourceNode` whose every sample is computed from the host clock, so the grid never drifts; Karplus–Strong plucks. `GuitarAudioEngine` is the observable main-actor front: mic state, level, tuner, gate, input channel. | Ported from `web/test/pitch.test.js`: all 49 notes MIDI 36–84, each heard exactly once, direct, through a thin laptop mic and with a weak fundamental; clicks rejected; re-picks, unisons, octaves over a ringing string at 100, 60 and 15 frames/s; `playedAt` within 40 ms of the attack. |
| **FretboardUI** | One-pass `Canvas` fretboard (rosewood, high e on top, the deck's colors, the box window lit, next note ringed, hits and wrong notes flashed, tap to play), tab strip that follows the pointer, level meter with the gate, tuner. | Previews. |
| **Coach** | The on-device language model writes one tip after a pass. See below. | Checked against the Mac's on-device model. |

The input and the metronome share one clock (the host clock in seconds), so a note's time and the click grid can be compared directly. The latency correction is the audio session's input + output latency. Calibrating it by playing, as on the web app's Rhythm page, is still to be ported.

Progress is saved as `progress.json` in Application Support. It's the same JSON as the web app's `ff.learner`, with the same skill ids (`box:minPent:1`) and tempo keys (`box:minPent:1:straight:2`), so a web backup can be imported later.

## AI on the iPad

The web README's rule still holds: rules make everything that has to be right (shapes, grades, which notes you missed, the tempo), and AI is only for what rules can't do. On iPad, most AI runs on the device, free and offline, with no API key.

**Built: the coach** (Foundation Models, iPadOS 26). After a pass, `PracticeReport` sends the model the grader's facts: accuracy per pass, timing, clean streak, tempo change and the notes missed most, with their degree and place. The rules also say what the numbers mean and choose the focus: accuracy, timing, relaxation or speed. The model only phrases the tip, using guided generation into a typed `CoachTip` (`@Generable`), and it's told never to invent notes, frets or numbers. The rules' own tip shows at once; the model's replaces it when it's ready.

On an M-series Mac a tip takes about 9–12 s; in the simulator, about 30 s. It hasn't been timed on an iPad yet. Without Apple Intelligence (an older iPad, or Apple Intelligence off) the rules' tips are all you see, and the card says why.

**Planned, in the order they'd pay off:**

1. **Weekly review.** Foundation Models with a `Tool` that reads the learner model and practice log: what improved, what's stuck, and what to change.
2. **Hands-free control.** On-device speech (`SpeechAnalyzer`) for "slower", "again" and "next box" while both hands are on the guitar.
3. **Lyric partner for 写歌.** Foundation Models suggests lines; the tone and rhyme checker (a port of `zh.js`) filters them, as in `AI-OPTIONS.md`.
4. **Hearing chords.** Spotify's Basic Pitch (Apache-2.0) converted to Core ML on the Neural Engine, to check strummed chords on the Rhythm page.
5. **Watching your hands.** Vision's hand-pose request (built in, no MediaPipe) on the front camera: thumb creeping over the neck, fingers lifting far off the strings.
6. **Neural amp.** The NAM core (C++, MIT) compiled natively in place of the WebAssembly build.

## Next pages to port

Find any note, then Scales (CAGED, routes, the band), Rhythm (needs the onset detector from `onset.js` as a render-thread node), Call & response, Daily session (the planner in `sessiongen.js`), and Song writing.

## Not checked yet

- **The mic path on a real iPad with a guitar.** The detector passes its tests on synthetic audio, and the app's whole loop runs in the simulator with `-FFDemo`, but no live audio has gone through the sink node yet.
- **Timing accuracy.** The latency correction hasn't been measured against a real setup.
- **Landscape on a real iPad.** Checked on the 13-inch and mini simulators, but only with the simulator held in portrait, so the app was drawn sideways in its landscape orientation. In those screenshots the status bar sits very close to the navigation titles; check that on a device or a rotated simulator.
- **The 11-inch and iPad Air sizes.** Not checked yet. Their heights lie between the two that were checked.
- **USB audio interfaces.** The input-channel choice is in the engine but not yet in the UI.
