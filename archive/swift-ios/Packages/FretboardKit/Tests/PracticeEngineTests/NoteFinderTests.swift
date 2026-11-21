import Foundation
import MusicTheory
import Testing
@testable import PracticeEngine

/// SplitMix64: the same cards every run.
struct SeededGenerator: RandomNumberGenerator {
  var state: UInt64
  init(seed: UInt64) { state = seed }
  mutating func next() -> UInt64 {
    state &+= 0x9E37_79B9_7F4A_7C15
    var z = state
    z = (z ^ (z >> 30)) &* 0xBF58_476D_1CE4_E5B9
    z = (z ^ (z >> 27)) &* 0x94D0_49BB_1331_11EB
    return z ^ (z >> 31)
  }
}

@Suite("Find any note: targets")
struct FindNoteTargetTests {
  @Test func oneNoteEverywhereGoesUpAndBack() {
    let cfg = FindNoteConfig(mode: .everywhere, pc: 5) // F
    var rng = SeededGenerator(seed: 1)
    let ts = FindNoteDrill.buildTargets(cfg, stats: NoteStats(), using: &rng)
    #expect(ts.map(\.string) == [6, 5, 4, 3, 2, 1, 1, 2, 3, 4, 5, 6])
    #expect(ts[0].frets == [1] && ts[0].midis == [41]) // F on the low E: fret 1
    #expect(ts[3].frets == [10]) // G string
    #expect(ts.allSatisfy { $0.name == "F" })
  }

  @Test func upOnlyAndAShortRangeDropStringsWithoutTheNote() {
    // A♭ in frets 0–5: low E 4, A none (11), D none (6), G 1, B none (9), high e 4.
    let cfg = FindNoteConfig(mode: .everywhere, pc: 8, names: ["A♭", "G♯"], direction: .up, frets: 0...5)
    var rng = SeededGenerator(seed: 1)
    let ts = FindNoteDrill.buildTargets(cfg, stats: NoteStats(), using: &rng)
    #expect(ts.map(\.string) == [6, 3, 1])
    #expect(ts.map(\.frets) == [[4], [1], [4]])
    #expect(ts[0].name == "A♭")
  }

  @Test func theOpenStringAndTwelfthFretAreBothThere() {
    let cfg = FindNoteConfig(mode: .everywhere, pc: 4) // E
    var rng = SeededGenerator(seed: 1)
    let ts = FindNoteDrill.buildTargets(cfg, stats: NoteStats(), using: &rng)
    #expect(ts[0].frets == [0, 12])
    #expect(ts[0].midis == [40, 52])
  }

  @Test(arguments: [1, 2, 3, 4, 5])
  func flashCardsNeverRepeatTheStringOrTheNote(seed: UInt64) {
    let cfg = FindNoteConfig(mode: .flash, notes: .all, count: 40)
    var rng = SeededGenerator(seed: seed)
    let ts = FindNoteDrill.buildTargets(cfg, stats: NoteStats(), using: &rng)
    #expect(ts.count == 40)
    for (a, b) in zip(ts, ts.dropFirst()) {
      #expect(a.string != b.string && a.pc != b.pc)
    }
    #expect(ts.allSatisfy { !$0.frets.isEmpty })
  }

  @Test func flashCardsKeepToTheChosenStringsAndNaturals() {
    let cfg = FindNoteConfig(mode: .flash, notes: .naturals, strings: [3], count: 20, frets: 5...12)
    var rng = SeededGenerator(seed: 7)
    let ts = FindNoteDrill.buildTargets(cfg, stats: NoteStats(), using: &rng)
    #expect(ts.count == 20)
    #expect(ts.allSatisfy { $0.string == 3 && Theory.isNatural($0.pc) })
    // One string: only the note can change, so it never repeats.
    for (a, b) in zip(ts, ts.dropFirst()) { #expect(a.pc != b.pc) }
    #expect(ts.allSatisfy { $0.frets.allSatisfy { (5...12).contains($0) } })
  }

  @Test func accidentalsGetBothNames() {
    let cfg = FindNoteConfig(mode: .flash, notes: .all, count: 40)
    var rng = SeededGenerator(seed: 3)
    let ts = FindNoteDrill.buildTargets(cfg, stats: NoteStats(), using: &rng)
    for t in ts {
      #expect(t.names.count == (Theory.isNatural(t.pc) ? 1 : 2))
      #expect(t.names.allSatisfy { Theory.pitchClass($0) == t.pc })
    }
  }

  @Test func weakSpotsComeUpMoreOften() {
    // Every natural on the G string is fast except C, which is slow.
    var stats = NoteStats()
    for pc in Theory.naturalPCs {
      for _ in 0..<3 { stats.record(tuning: "standard", string: 3, pc: pc, ms: pc == 0 ? 5500 : 900) }
    }
    func cCount(weakSpots: Bool) -> Int {
      let cfg = FindNoteConfig(mode: .flash, notes: .naturals, strings: [3], count: 400, weakSpots: weakSpots)
      var rng = SeededGenerator(seed: 11)
      return FindNoteDrill.buildTargets(cfg, stats: stats, using: &rng).filter { $0.pc == 0 }.count
    }
    #expect(cCount(weakSpots: true) > 2 * cCount(weakSpots: false))
  }
}

@Suite("Find any note: speed stats")
struct NoteStatsTests {
  @Test func movingAverageAndMisses() throws {
    var s = NoteStats()
    s.record(tuning: "standard", string: 3, pc: 7, ms: 1500)
    var e = try #require(s.entry(tuning: "standard", string: 3, pc: 7))
    #expect(e.n == 1 && e.hits == 1 && e.ema == 1500)
    s.record(tuning: "standard", string: 3, pc: 7, ms: nil) // a miss counts as 6 s
    e = try #require(s.entry(tuning: "standard", string: 3, pc: 7))
    #expect(e.n == 2 && e.hits == 1 && e.ema == 3075) // 1500 × 0.65 + 6000 × 0.35
    s.record(tuning: "standard", string: 3, pc: 7, ms: 9000) // capped at 6 s
    #expect(s.entry(tuning: "standard", string: 3, pc: 7)?.ema == 4099)
  }

  @Test func weights() {
    var s = NoteStats()
    #expect(s.weight(tuning: "standard", string: 1, pc: 0) == 2.5) // never asked
    s.record(tuning: "standard", string: 1, pc: 0, ms: 300)
    #expect(s.weight(tuning: "standard", string: 1, pc: 0) == 0.35)
    s.record(tuning: "standard", string: 2, pc: 0, ms: nil)
    #expect(s.weight(tuning: "standard", string: 2, pc: 0) == 3)
  }

  @Test func readsAndWritesTheWebAppsJSON() throws {
    let web = #"{"standard|3|7":{"n":4,"hits":3,"ema":2410,"last":1763600000000},"dropD|6|2":{"n":1,"hits":0,"ema":6000,"last":1763600000001}}"#
    let s = try JSONDecoder().decode(NoteStats.self, from: Data(web.utf8))
    #expect(s.entry(tuning: "standard", string: 3, pc: 7)?.ema == 2410)
    #expect(s.entry(tuning: "dropD", string: 6, pc: 2)?.hits == 0)
    let back = try JSONSerialization.jsonObject(with: JSONEncoder().encode(s)) as? [String: [String: Double]]
    #expect(back?["standard|3|7"]?["n"] == 4)
    #expect(back?["standard|3|7"]?["last"] == 1_763_600_000_000)
  }
}

@Suite("Find any note: judging")
struct FindNoteJudgeTests {
  // G on the D string (string 4): frets 5 and 17 → in 0–12, fret 5 (MIDI 55).
  let drill = FindNoteDrill(config: FindNoteConfig(mode: .everywhere, pc: 7),
                            targets: [FindNoteTarget(string: 4, pc: 7, names: ["G"], frets: 0...12, tuning: .standard)])
  var tg: FindNoteTarget { drill.targets[0] }

  @Test func rightNoteRightOctave() {
    #expect(drill.judge(tg, midi: 55) == .found(fret: 5))
  }

  @Test func wrongNoteSaysHowFarOff() {
    #expect(drill.judge(tg, midi: 57) == .wrongNote(fret: 7, off: 2)) // A: 2 frets too high
    #expect(drill.judge(tg, midi: 53) == .wrongNote(fret: 3, off: -2))
    #expect(drill.judge(tg, midi: 80) == .wrongNote(fret: nil, off: nil)) // not on this string's range
  }

  @Test func wrongOctaveUnlessTheOctaveCheckIsOff() {
    #expect(drill.judge(tg, midi: 67) == .wrongOctave) // G4: the B string, not the D
    var cfg = drill.config
    cfg.strictOctave = false
    let loose = FindNoteDrill(config: cfg, targets: drill.targets)
    #expect(loose.judge(tg, midi: 67) == .found(fret: 5))
  }

  @Test func aTapOnAnotherStringIsTheWrongString() {
    #expect(drill.judge(tg, midi: 55, string: 6) == .wrongString) // a tap on the low E string
    #expect(drill.judge(tg, midi: 55, string: 4) == .found(fret: 5))
  }
}

@Suite("Find any note: the round")
struct FindNoteRoundTests {
  func everywhere(_ pace: FindNotePace, autoHint: Bool = false) -> FindNoteDrill {
    var rng = SeededGenerator(seed: 1)
    return FindNoteDrill(config: FindNoteConfig(mode: .everywhere, pc: 5, direction: .up, pace: pace, autoHint: autoHint),
                         stats: NoteStats(), using: &rng)
  }

  @Test func freePaceAdvancesOnEachFind() throws {
    var d = everywhere(.free)
    d.begin(at: 1)
    #expect(d.tick(0.5).isEmpty)
    #expect(d.tick(1) == [.target(0)])
    #expect(d.hear(midi: 42, playedAt: 1.6, now: 1.6) == [.wrong(0, midi: 42, string: nil, .wrongNote(fret: 2, off: 1))])
    #expect(d.hear(midi: 41, playedAt: 2.2, now: 2.25) == [.hit(0), .target(1)])
    #expect(d.targets[0].ms == 1200 && d.targets[0].slips == 1)
    #expect(d.current?.shownAt == 2.25)
    var t = 3.0
    var done: FindNoteDrill.Summary?
    for tg in d.targets.dropFirst() {
      for e in d.hear(midi: tg.midis[0], now: t) { if case .done(let s) = e { done = s } }
      t += 1
    }
    let s = try #require(done)
    #expect(s.hits == 6 && s.total == 6 && s.slips == 1 && s.clean && !s.aborted)
    #expect(s.bestMs == 750 && s.underGoal == 6)
    #expect(d.state == .done)
  }

  @Test func skipAndHints() throws {
    var d = everywhere(.free)
    d.begin(at: 0)
    _ = d.tick(0)
    #expect(d.hint() == [.hint(0, level: 1)])
    #expect(d.hint() == [.hint(0, level: 2)])
    #expect(d.hint().isEmpty) // two at most
    #expect(d.skip(now: 1) == [.miss(0), .target(1)])
    #expect(d.targets[0].status == .skip)
    let s = d.summary(aborted: false)
    #expect(s.hints == 1 && s.misses.count == 1 && !s.clean)
  }

  @Test func autoHintAfterFiveSeconds() {
    var d = everywhere(.free, autoHint: true)
    d.begin(at: 0)
    _ = d.tick(0)
    #expect(d.tick(4.9).isEmpty)
    #expect(d.tick(5.1) == [.hint(0, level: 1)])
    #expect(d.tick(9).isEmpty) // only the first hint comes on its own
  }

  @Test func onTheClockTheNextNoteComesAnyway() throws {
    var d = everywhere(.s3) // 60 bpm, 1 click: one note a second
    #expect(d.window == 1)
    d.begin(at: 10)
    #expect(d.tick(10) == [.target(0)])
    #expect(d.skip(now: 10.2).isEmpty) // no skipping on the clock
    #expect(d.hear(midi: 41, playedAt: 10.4, now: 10.42) == [.hit(0)]) // stays up until its click
    #expect(d.hear(midi: 41, now: 10.6).isEmpty) // already found
    #expect(d.tick(11) == [.target(1)])
    #expect(d.current?.shownAt == 11)
    // Target 1 (A string, fret 8) isn't played: at the next click it's closing, and a beat later missed.
    #expect(d.tick(12) == [.target(2)])
    #expect(d.tick(12.2).isEmpty) // inside the grace
    #expect(d.tick(12.3) == [.miss(1)])
  }

  @Test func aNoteOnTheClickStillCountsForTheLastOne() {
    var d = everywhere(.s3)
    d.begin(at: 0)
    _ = d.tick(0)
    _ = d.tick(1) // target 0 is closing, target 1 is up
    // Played 30 ms after the click: it's late for F on the low E, but still counts for it.
    #expect(d.hear(midi: 41, playedAt: 1.03, now: 1.1) == [.hit(0)])
    #expect(d.targets[0].ms == 1030)
    #expect(d.tick(1.4).isEmpty) // nothing left to miss
    #expect(d.targets[1].status == .active)
  }

  @Test func theRoundEndsAfterTheLastWindowAndItsGrace() throws {
    var d = everywhere(.s4) // 0.75 s a note
    d.begin(at: 0)
    var t = 0.0
    var done: FindNoteDrill.Summary?
    while done == nil, t < 20 {
      for e in d.tick(t) { if case .done(let s) = e { done = s } }
      t += 0.01
    }
    let s = try #require(done)
    #expect(s.total == 6 && s.hits == 0 && s.misses.count == 6 && !s.clean)
    #expect(abs(t - (6 * 0.75 + FindNoteDrill.grace)) < 0.05)
  }

  @Test func stoppingAbortsWithWhatWasPlayed() throws {
    var d = everywhere(.free)
    d.begin(at: 0)
    _ = d.tick(0)
    _ = d.hear(midi: 41, now: 1)
    guard case .done(let s) = try #require(d.stop().first) else { Issue.record("no summary"); return }
    #expect(s.aborted && s.played == 1 && s.hits == 1 && !s.clean)
    #expect(d.stop().isEmpty)
    #expect(d.hear(midi: 46, now: 2).isEmpty)
  }

  @Test func slowestStringNeedsMoreThanOne() {
    var d = everywhere(.free)
    d.begin(at: 0)
    _ = d.tick(0)
    _ = d.hear(midi: 41, now: 1.0) // low E: 1 s
    _ = d.hear(midi: 53, now: 4.0) // A string, fret 8: 3 s
    let s = d.summary(aborted: true)
    #expect(s.slowestString == 5 && s.slowestMs == 3000)
    var one = everywhere(.free)
    one.begin(at: 0)
    _ = one.tick(0)
    _ = one.hear(midi: 41, now: 1.0)
    #expect(one.summary(aborted: true).slowestString == nil)
  }
}

@Suite("Find any note: hints")
struct FindNoteHintTests {
  let cfg = FindNoteConfig(mode: .everywhere, pc: 7) // G, frets 0–12

  @Test func offTheAnchorStringsTheHintIsTheAnchors() {
    let d = FindNoteDrill(config: cfg, targets: [FindNoteTarget(string: 2, pc: 7, names: ["G"], frets: 0...12, tuning: .standard)])
    let marks = d.hintMarks(for: d.targets[0], level: 1)
    // G on the A string at 10, on the low E at 3.
    #expect(Set(marks.map(\.position)) == [FretPosition(string: 5, fret: 10), FretPosition(string: 6, fret: 3)])
    #expect(marks.allSatisfy { $0.kind == .anchor && $0.label == "G" })
    let shown = d.hintMarks(for: d.targets[0], level: 2)
    #expect(shown.filter { $0.kind == .reveal }.map(\.position) == [FretPosition(string: 2, fret: 8)])
  }

  @Test func onAnAnchorStringTheHintIsItsLandmarks() {
    let d = FindNoteDrill(config: cfg, targets: [FindNoteTarget(string: 6, pc: 7, names: ["G"], frets: 0...12, tuning: .standard)])
    let marks = d.hintMarks(for: d.targets[0], level: 1)
    // The naturals on the low E, 0–12, without G: E F A B C D E.
    #expect(marks.map(\.position.fret) == [0, 1, 5, 7, 8, 10, 12])
    #expect(marks.map(\.label) == ["E", "F", "A", "B", "C", "D", "E"])
  }
}

@Suite("Find any note: paces")
struct FindNotePaceTests {
  @Test func theDecksStages() {
    #expect(FindNotePace.free.window == nil)
    #expect(FindNotePace.s1.window == 6) // 40 bpm × 4 clicks
    #expect(FindNotePace.s2.window == 2)
    #expect(FindNotePace.s3.window == 1)
    #expect(FindNotePace.s4.window == 0.75)
    #expect(FindNotePace.s3.next == .s4 && FindNotePace.s4.next == nil)
    #expect(NoteSpeed(ms: 1999) == .fast && NoteSpeed(ms: 2000) == .ok && NoteSpeed(ms: 3500) == .slow && NoteSpeed(ms: nil) == nil)
  }
}
