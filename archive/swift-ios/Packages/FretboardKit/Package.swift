// swift-tools-version: 6.2
// FretboardKit: the engine of the iPad app, split by layer. The lower three modules have no UI and
// no audio hardware, so `swift test` runs them on the Mac in seconds.
//
//   MusicTheory     notes, spelling, tunings, scales, chords, shapes on the neck   (theory.js + scales.js)
//   PracticeEngine  sequences, exercises, the sequence grader, tempo ladder, learner (sessiongen.js)
//   GuitarAudio     YIN + NoteTracker (pure), and the AVAudioEngine I/O: mic, metronome, pluck (pitch.js + audio.js)
//   FretboardUI     SwiftUI fretboard, tab strip, palette, meters                    (fretboard.js + seqtab.js)
//   Coach           the on-device language model (Foundation Models) that talks about your grades
import PackageDescription

let package = Package(
  name: "FretboardKit",
  platforms: [.iOS(.v26), .macOS(.v26)],
  products: [
    .library(name: "FretboardKit", targets: ["MusicTheory", "PracticeEngine", "GuitarAudio", "FretboardUI", "Coach"]),
  ],
  targets: [
    .target(name: "MusicTheory"),
    .target(name: "PracticeEngine", dependencies: ["MusicTheory"]),
    .target(name: "GuitarAudio"),
    .target(name: "FretboardUI", dependencies: ["MusicTheory"]),
    .target(name: "Coach", dependencies: ["PracticeEngine"]),
    .testTarget(name: "MusicTheoryTests", dependencies: ["MusicTheory"]),
    .testTarget(name: "PracticeEngineTests", dependencies: ["PracticeEngine"]),
    .testTarget(name: "GuitarAudioTests", dependencies: ["GuitarAudio"]),
  ],
  swiftLanguageModes: [.v6]
)
