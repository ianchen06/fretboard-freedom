// The same checks as web/test/sessiongen.test.js: the deck's boxes in A, and every shape in every
// key has the right notes, none skipped, within reach.
import Testing
@testable import MusicTheory

private func frets(_ notes: [ShapeNote], _ s: Int) -> [Int] { notes.filter { $0.string == s }.map(\.fret) }
private func byString(_ shape: Shape?) -> [[Int]] { lowToHigh.map { frets(shape?.notes ?? [], $0) } }

@Suite("Pentatonic boxes")
struct BoxTests {
  let a = 9

  @Test func aMinorBoxesMatchTheDeck() {
    #expect(byString(Shapes.position(root: a, scale: .minorPentatonic, box: 1)) == [[5, 8], [5, 7], [5, 7], [5, 7], [5, 8], [5, 8]])
    #expect(byString(Shapes.position(root: a, scale: .minorPentatonic, box: 2)) == [[8, 10], [7, 10], [7, 10], [7, 9], [8, 10], [8, 10]])
    #expect(byString(Shapes.position(root: a, scale: .minorPentatonic, box: 3)) == [[10, 12], [10, 12], [10, 12], [9, 12], [10, 13], [10, 12]])
    #expect(byString(Shapes.position(root: a, scale: .minorPentatonic, box: 4)) == [[12, 15], [12, 15], [12, 14], [12, 14], [13, 15], [12, 15]])
    #expect(byString(Shapes.position(root: a, scale: .minorPentatonic, box: 5)) == [[3, 5], [3, 5], [2, 5], [2, 5], [3, 5], [3, 5]])
  }

  @Test func bluesBoxOneHasBothBlueNotes() throws {
    let blues = try #require(Shapes.position(root: a, scale: .blues, box: 1)).notes
    #expect(frets(blues, 5) == [5, 6, 7])
    #expect(frets(blues, 3) == [5, 7, 8])
  }

  @Test(arguments: [ScaleKind.minorPentatonic, .majorPentatonic, .blues, .aeolian, .ionian, .dorian, .mixolydian, .phrygian, .lydian])
  func everyPositionInEveryKey(scale: ScaleKind) throws {
    for key in 0..<12 {
      for k in 1...5 {
        let shape = try #require(Shapes.position(root: key, scale: scale, box: k), "\(scale) key \(key) box \(k)")
        let pcs = scale.pitchClasses(root: key)
        // Right notes, ascending, none skipped.
        #expect(shape.notes.allSatisfy { pcs.contains(Theory.mod12($0.midi)) })
        for (x, y) in zip(shape.notes, shape.notes.dropFirst()) {
          #expect(y.midi > x.midi, "\(scale) \(key) box \(k) ascends")
          let between = ((x.midi + 1)..<y.midi).filter { pcs.contains(Theory.mod12($0)) }
          #expect(between.isEmpty, "\(scale) \(key) box \(k) skips \(between)")
        }
        // Within reach: a box spans at most 5 frets (a 7-note position, one more for the stretch).
        #expect(shape.hi - shape.lo <= (scale.steps.count == 5 ? 4 : 5), "\(scale) \(key) box \(k) spans \(shape.lo)–\(shape.hi)")
        // A pentatonic box has two notes on every string.
        if scale.steps.count == 5 { #expect(lowToHigh.allSatisfy { frets(shape.notes, $0).count == 2 }) }
        #expect(shape.notes.allSatisfy { Tuning.standard.midi(string: $0.string, fret: $0.fret) == $0.midi })
      }
    }
  }

  @Test func degreesAndColors() throws {
    let box1 = try #require(Shapes.position(root: a, scale: .minorPentatonic, box: 1)).notes
    #expect(box1.first?.label == "R" && box1.first?.role == .root)
    #expect(box1.map(\.label).prefix(5) == ["R", "♭3", "4", "5", "♭7"])
    #expect(Set(box1.map(\.role)) == [.root, .third, .fifth, .seventh, .other])
    let blues = try #require(Shapes.position(root: a, scale: .blues, box: 1)).notes
    #expect(blues.contains { $0.label == "♭5" && $0.role == .flavor })
  }
}

@Suite("Spelling")
struct SpellingTests {
  @Test func scalesSpelledByDegree() {
    #expect(Spelling.scale(root: 9, .phrygian).names == ["A", "B♭", "C", "D", "E", "F", "G"])
    #expect(Spelling.scale(root: 9, .harmonicMinor).names.last == "G♯")
    #expect(Spelling.key(9, .blues).byPC[3] == "E♭")
    #expect(Spelling.key(3, .minorPentatonic).root == "E♭" || Spelling.key(3, .minorPentatonic).root == "D♯")
    #expect(Spelling.key(10, .minorPentatonic).root == "B♭")
    #expect(Spelling.key(6, .minorPentatonic).root == "F♯")
  }

  @Test func chordsStackByLetter() {
    #expect(Spelling.chord(rootName: "D", .dominant7) == ["D", "F♯", "A", "C"])
    #expect(Theory.spellAbove("E♭", semis: 8, letterSteps: 5) == "C♭")
  }

  @Test func pitchMath() {
    #expect(Theory.pitchClass("B♭") == 10 && Theory.pitchClass("C#") == 1 && Theory.pitchClass("H") == nil)
    #expect(Theory.midiLabel(55) == "G3")
    #expect(abs(Theory.freqToMidi(440) - 69) < 1e-9)
    #expect(Tuning.standard.stringName(1) == "e" && Tuning.standard.stringLongName(6) == "low E")
  }
}
