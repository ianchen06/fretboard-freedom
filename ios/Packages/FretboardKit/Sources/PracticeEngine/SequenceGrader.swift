// Grading a sequence note by note (SeqGrader in web/js/sessiongen.js).
//
// Ordered notes, looping. Each picked note either hits the next note, skips one (the skipped one is
// missed), or is wrong. A bend counts when you reach the target pitch from the note below it.
import MusicTheory

public struct SequenceGrader: Sendable {
  public struct Target: Sendable, Hashable {
    public var midi: Int
    /// For a bend: the fretted note it starts from.
    public var bendFrom: Int?
    public init(midi: Int, bendFrom: Int? = nil) { self.midi = midi; self.bendFrom = bendFrom }
  }

  public enum NoteState: Sendable, Hashable { case hit, miss }

  public struct PassResult: Sendable, Hashable {
    /// Share of the notes hit, with wrong notes counting half against it.
    public var accuracy: Double
    /// Average distance from the grid, in ms (nil without enough timed notes).
    public var timingMs: Double?
    /// Average bend intonation, in cents.
    public var cents: Double?
    /// 90% of the notes, and timing within ±60 ms.
    public var clean: Bool
    public var hits: Int
    public var wrong: Int
    public var missed: Int
    public var count: Int
    public var states: [NoteState?]
  }

  public enum Event: Sendable, Hashable {
    /// The note below a bend was picked: now bend it up.
    case arm(index: Int)
    case hit(index: Int, cents: Double?)
    case miss(index: Int)
    case wrong(index: Int, midi: Int)
    /// A bend still short of the target.
    case under(index: Int, cents: Double)
    case pass(PassResult)
  }

  struct Pass: Sendable {
    var hits = 0, miss = 0, wrong = 0
    var devs: [Double] = []
    var cents: [Double] = []
    var states: [NoteState?]
    init(count: Int) { states = Array(repeating: nil, count: count) }
  }

  public let targets: [Target]
  public let matchPitchClass: Bool
  public let timed: Bool
  /// Clean passes in a row before the tempo goes up: 3 for short sequences, 2 or 1 for long ones.
  public let cleanNeeded: Int
  public private(set) var passes: [PassResult] = []
  public private(set) var cleanStreak = 0
  /// The note to play next.
  public private(set) var index = 0
  var pass: Pass
  var armed = false
  var hold: (t0: Double, cents: [Double])?

  public var count: Int { targets.count }
  /// States of the notes in the pass in progress.
  public var currentStates: [NoteState?] { pass.states }

  public init(targets: [Target], timed: Bool = true, strictOctave: Bool = true, matchPitchClass: Bool = false) {
    precondition(!targets.isEmpty, "nothing to grade")
    self.targets = targets
    self.timed = timed
    self.matchPitchClass = matchPitchClass || !strictOctave
    let n = targets.count
    cleanNeeded = n <= 40 ? 3 : n <= 90 ? 2 : 1
    pass = Pass(count: n)
  }

  public init(_ exercise: PracticeExercise, strictOctave: Bool = true) {
    self.init(targets: exercise.targets, timed: exercise.timed, strictOctave: strictOctave)
  }

  /// The tempo ladder took a step: count clean passes from zero again.
  public mutating func resetCleanStreak() { cleanStreak = 0 }

  func same(_ midi: Int, _ target: Int) -> Bool {
    matchPitchClass ? Theory.mod12(midi) == Theory.mod12(target) : midi == target
  }

  mutating func advance(_ events: inout [Event]) {
    index += 1
    armed = false
    hold = nil
    guard index >= count else { return }
    let p = pass
    let n = Double(count)
    let acc = min(1, Double(p.hits) / (n + 0.5 * Double(p.wrong)))
    let timing: Double? = Double(p.devs.count) >= min(4, n / 2) ? p.devs.map(abs).reduce(0, +) / Double(p.devs.count) * 1000 : nil
    let cents: Double? = p.cents.isEmpty ? nil : p.cents.reduce(0, +) / Double(p.cents.count)
    let clean = acc >= 0.9 && (!timed || timing == nil || timing! <= 60)
    cleanStreak = clean ? cleanStreak + 1 : 0
    let result = PassResult(accuracy: acc, timingMs: timing, cents: cents, clean: clean, hits: p.hits, wrong: p.wrong,
                            missed: p.miss, count: count, states: p.states)
    passes.append(result)
    events.append(.pass(result))
    index = 0
    pass = Pass(count: count)
  }

  mutating func hit(deviation: Double?, cents: Double?, _ events: inout [Event]) {
    pass.hits += 1
    pass.states[index] = .hit
    if let deviation { pass.devs.append(deviation) }
    if let cents { pass.cents.append(cents) }
    events.append(.hit(index: index, cents: cents))
    advance(&events)
  }

  /// A picked note. deviation: seconds from the nearest grid point (nil when untimed, e.g. a tap).
  public mutating func note(_ midi: Int, deviation: Double? = nil) -> [Event] {
    var events: [Event] = []
    let cur = targets[index]
    if let from = cur.bendFrom {
      if same(midi, from) { armed = true; return [.arm(index: index)] }
      if same(midi, cur.midi) { hit(deviation: nil, cents: nil, &events); return events }
    } else if same(midi, cur.midi) {
      hit(deviation: deviation, cents: nil, &events)
      return events
    }
    let next = targets[(index + 1) % count]
    if count > 2 && cur.bendFrom == nil && next.bendFrom == nil && same(midi, next.midi) {
      pass.miss += 1
      pass.states[index] = .miss
      events.append(.miss(index: index))
      advance(&events)
      hit(deviation: deviation, cents: nil, &events)
      return events
    }
    pass.wrong += 1
    events.append(.wrong(index: index, midi: midi))
    return events
  }

  /// Pitch frames, for bends: the target held for 70 ms after the note below was picked.
  public mutating func frame(midi: Int?, cents: Double?, at t: Double) -> [Event] {
    let cur = targets[index]
    guard cur.bendFrom != nil, armed, let midi, let cents else { return [] }
    let dev = Double(midi) + cents / 100 - Double(cur.midi)
    if abs(dev) <= 0.45 {
      if hold == nil { hold = (t, []) }
      hold!.cents.append(dev * 100)
      if t - hold!.t0 >= 0.07 {
        let sorted = hold!.cents.sorted()
        var events: [Event] = []
        hit(deviation: nil, cents: sorted[sorted.count / 2], &events)
        return events
      }
    } else {
      hold = nil
      if dev < -0.45 && dev > -1.6 { return [.under(index: index, cents: dev * 100)] }
    }
    return []
  }

  /// 0–1 for the learner: the last three passes, or nil without one finished pass.
  public func score() -> Double? {
    let recent = passes.suffix(3)
    if recent.isEmpty {
      let tried = pass.hits + pass.miss
      return tried >= 8 ? min(1, Double(pass.hits) / (Double(tried) + 0.5 * Double(pass.wrong))) * 0.9 : nil
    }
    let acc = recent.map(\.accuracy).reduce(0, +) / Double(recent.count)
    let timings = recent.compactMap(\.timingMs)
    let t: Double? = timings.isEmpty ? nil : timings.reduce(0, +) / Double(timings.count)
    let tf: Double = {
      guard timed, let t else { return 1 }
      return t <= 35 ? 1 : t <= 60 ? 0.93 : t <= 90 ? 0.85 : 0.75
    }()
    return min(1, max(0, acc * tf))
  }
}

public extension SequenceGrader.PassResult {
  /// "92% of the notes · timing ±31 ms"
  var summary: String {
    var s = "\(Int((accuracy * 100).rounded()))% of the notes"
    if let timingMs { s += " · timing ±\(Int(timingMs.rounded())) ms" }
    return s
  }
}
