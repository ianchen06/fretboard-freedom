import MusicTheory
import PracticeEngine
import Testing

@Suite("Arpeggio drill")
struct ArpeggioDrillTests {
  @Test(arguments: ChordKind.allCases)
  func everyRootAndPositionPlaysOnlyChordTones(chord: ChordKind) throws {
    for root in 0..<12 {
      for position in 1...5 {
        for pattern in [SequencePattern.straight, .threes] {
          let drill = ArpeggioDrill(root: root, chord: chord, position: position, pattern: pattern)
          let exercise = try #require(drill.build())
          let allowed = Set(chord.steps.map { Theory.mod12(root + $0) })
          #expect(exercise.allowed == allowed)
          #expect(Set(exercise.dots.map { Theory.mod12($0.midi) }) == allowed)
          #expect(exercise.dots.allSatisfy { $0.midi == Tuning.standard.midi(string: $0.string, fret: $0.fret) })
          #expect(zip(exercise.dots, exercise.dots.dropFirst()).allSatisfy { $0.midi < $1.midi })
          #expect(exercise.notes == pattern.indices(exercise.dots.count).map { exercise.dots[$0] })
          #expect(exercise.notes.first?.midi != exercise.notes.last?.midi)
        }
      }
    }
  }

  /// The root is named so the chord stacks by letter: D♯° is D♯ F♯ A (E♭° would need B𝄫).
  /// The web app spells them the same way (web/test/sessiongen.test.js).
  @Test func rootsSpelledToStackByLetter() throws {
    let cases: [(Int, ChordKind, String)] = [
      (3, .diminished, "D♯° D♯ F♯ A"), (3, .halfDiminished, "D♯m7♭5 D♯ F♯ A C♯"), (3, .diminished7, "D♯°7 D♯ F♯ A C"),
      (10, .diminished7, "A♯°7 A♯ C♯ E G"), (10, .diminished, "A♯° A♯ C♯ E"), (6, .dominant7, "F♯7 F♯ A♯ C♯ E"),
      (10, .minor, "B♭m B♭ D♭ F"), (3, .major, "E♭ E♭ G B♭"), (6, .major, "G♭ G♭ B♭ D♭"),
    ]
    for (root, chord, want) in cases {
      let exercise = try #require(ArpeggioDrill(root: root, chord: chord, position: 1).build())
      let name = exercise.title.split(separator: " ")[0]
      let tones = chord.steps.map { exercise.name(root + $0) }.joined(separator: " ")
      #expect("\(name) \(tones)" == want)
    }
  }

  @Test func dominantSeventhSpellingAndGrade() throws {
    let exercise = try #require(ArpeggioDrill(root: 2, chord: .dominant7, position: 1, notesPerBeat: 3).build())
    #expect(exercise.title == "D7 arpeggio · position 1")
    #expect(exercise.chips.first?.value == "D7 (R–3–5–♭7)")
    #expect(exercise.name(66) == "F♯")
    #expect(exercise.name(60) == "C")
    #expect(exercise.tempoKey == "arp:dom7:1:straight:3")
    #expect(exercise.notesPerBeat == 3)

    var grader = SequenceGrader(exercise)
    for note in exercise.notes {
      _ = grader.note(note.midi, deviation: 0)
    }
    #expect(grader.passes.first?.clean == true)
    #expect(grader.index == 0)
  }
}
