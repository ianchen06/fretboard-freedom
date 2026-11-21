import Testing
import MusicTheory
@testable import PracticeEngine

@Suite("Sequences")
struct SequenceTests {
  @Test(arguments: SequencePattern.allCases)
  func noNoteTwiceInARowEvenWhereItLoops(pattern: SequencePattern) {
    for n in [6, 10, 12, 14, 18] {
      let idx = pattern.indices(n)
      #expect(!idx.isEmpty)
      #expect(idx.allSatisfy { (0..<n).contains($0) })
      let looped = idx + [idx[0]]
      #expect(zip(looped, looped.dropFirst()).allSatisfy { $0 != $1 }, "\(pattern) n=\(n)")
    }
  }

  @Test func straightGoesUpAndBackDown() {
    #expect(SequencePattern.straight.indices(5) == [0, 1, 2, 3, 4, 3, 2, 1])
    #expect(SequencePattern.threes.indices(5) == [0, 1, 2, 1, 2, 3, 2, 3, 4, 3, 2, 1])
  }
}

@Suite("Box drill")
struct DrillTests {
  @Test func aMinorBoxOneExercise() throws {
    let ex = try #require(ShapeDrill(key: 9, scale: .minorPentatonic, box: 1).build())
    #expect(ex.title == "A minor pentatonic · box 1")
    #expect(ex.skill == "box:minPent:1")
    #expect(ex.tempoKey == "box:minPent:1:straight:2")
    #expect(ex.notes.count == 22) // 12 up, 10 back down
    #expect(ex.dots.count == 12)
    #expect(ex.chips.first?.value == "A minor")
    #expect(ex.chips[1].value == "5–8")
  }

  @Test func everyKeyAndBoxBuilds() {
    for key in 0..<12 {
      for box in 1...5 {
        for pattern in SequencePattern.allCases where pattern != .sixes {
          #expect(ShapeDrill(key: key, scale: .minorPentatonic, box: box, pattern: pattern).build() != nil)
        }
      }
    }
  }
}

@Suite("Grader")
struct GraderTests {
  let ex = ShapeDrill(key: 9, scale: .minorPentatonic, box: 1).build()!

  @Test func aPerfectPassIsClean() throws {
    var g = SequenceGrader(ex)
    var passes: [SequenceGrader.PassResult] = []
    for n in ex.notes {
      for e in g.note(n.midi, deviation: 0.01) { if case .pass(let r) = e { passes.append(r) } }
    }
    let r = try #require(passes.first)
    #expect(r.accuracy == 1 && r.clean && r.timingMs! < 11)
    #expect(g.cleanStreak == 1 && g.index == 0)
    #expect(g.cleanNeeded == 3)
  }

  @Test func skippingANoteMissesItAndHitsTheNext() {
    var g = SequenceGrader(ex)
    _ = g.note(ex.notes[0].midi)
    let events = g.note(ex.notes[2].midi)
    #expect(events == [.miss(index: 1), .hit(index: 2, cents: nil)])
    #expect(g.index == 3)
  }

  @Test func aWrongNoteDoesNotMoveThePointer() {
    var g = SequenceGrader(ex)
    let events = g.note(ex.notes[0].midi + 1)
    #expect(events == [.wrong(index: 0, midi: ex.notes[0].midi + 1)])
    #expect(g.index == 0)
  }

  @Test func sloppyTimingIsNotClean() throws {
    var g = SequenceGrader(ex)
    var last: SequenceGrader.PassResult?
    for n in ex.notes { for e in g.note(n.midi, deviation: 0.08) { if case .pass(let r) = e { last = r } } }
    let r = try #require(last)
    #expect(r.accuracy == 1 && !r.clean)
    #expect(g.score()! < 0.9)
  }

  @Test func ladderGoesUpAfterThreeCleanPassesAndDownAfterTwoRough() {
    var g = SequenceGrader(ex)
    var ladder = TempoLadder(bpm: 72, notesPerBeat: 2)
    var verdicts: [TempoLadder.Verdict] = []
    for _ in 0..<3 {
      for n in ex.notes { for e in g.note(n.midi, deviation: 0) { if case .pass(let r) = e { verdicts.append(ladder.record(r, grader: &g)) } } }
    }
    #expect(verdicts == [.clean(streak: 1, needed: 3), .clean(streak: 2, needed: 3), .up(from: 72, to: 76)])
    #expect(ladder.bpm == 76 && ladder.cleanBPM == 72 && g.cleanStreak == 0)
    // Two rough passes: half the notes wrong.
    var rough: [TempoLadder.Verdict] = []
    for _ in 0..<2 {
      for n in ex.notes {
        _ = g.note(n.midi + 1)
        _ = g.note(n.midi + 1)
        for e in g.note(n.midi) { if case .pass(let r) = e { rough.append(ladder.record(r, grader: &g)) } }
      }
    }
    // Every note was hit but with two wrong notes each: accuracy 22 / (22 + 22) = 0.5.
    #expect(rough == [.rough, .down(from: 76, to: 72)])
    #expect(ladder.struggled)
  }
}

@Suite("Learner")
struct LearnerTests {
  @Test func priorsAndUpdates() {
    var L = Learner(start: .box1)
    #expect(L.mastery("box:minPent:1") == 0.7 && L.mastery("box:minPent:4") == 0)
    L.update("box:minPent:2", score: 0.9, today: DayKey("2026-11-20"))
    #expect(L.mastery("box:minPent:2") > 0.3)
    #expect(L.dueIn("box:minPent:2", today: DayKey("2026-11-20"))! > 1)
    L.update("box:minPent:3", score: 0.3, today: DayKey("2026-11-20"))
    #expect(L.dueIn("box:minPent:3", today: DayKey("2026-11-21"))! <= 0)
  }

  @Test func tempoMemory() {
    var L = Learner()
    #expect(L.tempo("box:minPent:1:straight:2", notesPerBeat: 2) == 72)
    L.saveTempo("box:minPent:1:straight:2", bpm: 84, cleanBPM: 80)
    #expect(L.tempo("box:minPent:1:straight:2", notesPerBeat: 2) == 80 && L.best("box:minPent:1:straight:2") == 80)
    L.saveTempo("box:minPent:1:straight:2", bpm: 84, struggled: true)
    #expect(L.tempo("box:minPent:1:straight:2", notesPerBeat: 2) == 80)
  }

  @Test func dayMath() {
    #expect(DayKey("2026-11-20").days(until: DayKey("2026-12-01")) == 11)
    #expect(DayKey("2024-02-28").days(until: DayKey("2024-03-01")) == 2)
    #expect(DayKey("1970-01-01").dayNumber == 0)
  }

  @Test func readsAWebBackup() throws {
    let json = #"{"skills":{"box:minPent:1":{"m":0.82,"n":5,"interval":4.8,"last":"2026-11-19","score":0.91}},"tempos":{"box:minPent:1:straight:2":{"bpm":88,"best":92}}}"#
    let L = try JSONDecoder().decode(Learner.self, from: Data(json.utf8))
    #expect(L.mastery("box:minPent:1") == 0.82)
    #expect(L.tempo("box:minPent:1:straight:2", notesPerBeat: 2) == 88)
  }
}

import Foundation
