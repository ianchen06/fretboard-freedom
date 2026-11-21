// "Find any note" (Part 3 of the deck): a port of web/js/drill.js. It builds the targets, judges each
// note heard, keeps time, and keeps per-note speed stats. No UI in here: the screen feeds it notes and
// clock ticks and reacts to the events it returns.
import Foundation
import MusicTheory

public enum FindNoteMode: String, CaseIterable, Sendable, Codable, Identifiable {
  /// One note on every string, low E → high e (→ back).
  case everywhere
  /// A random note and string, card after card.
  case flash

  public var id: String { rawValue }
  public var name: String {
    switch self {
    case .everywhere: "One note everywhere"
    case .flash: "Flash cards"
    }
  }
}

public enum FindNoteDirection: String, CaseIterable, Sendable, Codable, Identifiable {
  case upBack = "upback"
  case up

  public var id: String { rawValue }
  public var name: String {
    switch self {
    case .upBack: "Low E → high e → back"
    case .up: "Up only"
    }
  }
}

public enum FindNoteNotes: String, CaseIterable, Sendable, Codable, Identifiable {
  case naturals
  case all

  public var id: String { rawValue }
  public var name: String {
    switch self {
    case .naturals: "Naturals"
    case .all: "All 12 (♯/♭)"
    }
  }
}

/// The metronome stages from the deck (Part 3, "Drill: one note everywhere").
public enum FindNotePace: String, CaseIterable, Sendable, Codable, Identifiable {
  case free, s1, s2, s3, s4

  public var id: String { rawValue }

  public var label: String {
    switch self {
    case .free: "Free"
    case .s1: "Stage 1"
    case .s2: "Stage 2"
    case .s3: "Stage 3"
    case .s4: "Stage 4"
    }
  }

  public var short: String {
    switch self {
    case .free: "No clock"
    case .s1: "40 bpm · 4 clicks"
    case .s2: "60 bpm · 2 clicks"
    case .s3: "60 bpm · 1 click"
    case .s4: "80 bpm · 1 click"
    }
  }

  public var bpm: Int? {
    switch self {
    case .free: nil
    case .s1: 40
    case .s2, .s3: 60
    case .s4: 80
    }
  }

  /// Clicks per note.
  public var clicks: Int? {
    switch self {
    case .free: nil
    case .s1: 4
    case .s2: 2
    case .s3, .s4: 1
    }
  }

  /// Seconds each note gets, or nil for Free.
  public var window: Double? {
    guard let bpm, let clicks else { return nil }
    return 60 / Double(bpm) * Double(clicks)
  }

  public var next: FindNotePace? {
    let all = Self.allCases
    let i = all.firstIndex(of: self)!
    return i + 1 < all.count ? all[i + 1] : nil
  }
}

/// How fast a note was found, for the speed map's colors.
public enum NoteSpeed: Sendable, Hashable {
  case fast, ok, slow

  public init?(ms: Int?) {
    guard let ms else { return nil }
    self = ms < FindNoteDrill.goalMs ? .fast : ms < 3500 ? .ok : .slow
  }
}

/// Per string-and-note speed, kept as a moving average so recent rounds count most. Encodes to the
/// same JSON as the web app's `ff.stats`: {"standard|3|7": {"n": 4, "hits": 3, "ema": 2410, "last": …}}.
public struct NoteStats: Sendable, Hashable, Codable {
  public struct Entry: Sendable, Hashable, Codable {
    /// Times asked.
    public var n: Int
    /// Times found.
    public var hits: Int
    /// Moving average of the time to find it, ms; a miss counts as 6 s.
    public var ema: Int?
    /// Last practiced, ms since 1970 (JavaScript's Date.now()).
    public var last: Double?
  }

  public var data: [String: Entry]

  public init(_ data: [String: Entry] = [:]) { self.data = data }

  public init(from decoder: any Decoder) throws {
    data = try decoder.singleValueContainer().decode([String: Entry].self)
  }

  public func encode(to encoder: any Encoder) throws {
    var c = encoder.singleValueContainer()
    try c.encode(data)
  }

  public static func key(tuning: String, string s: Int, pc: Int) -> String { "\(tuning)|\(s)|\(Theory.mod12(pc))" }

  public func entry(tuning: String, string s: Int, pc: Int) -> Entry? { data[Self.key(tuning: tuning, string: s, pc: pc)] }

  /// A find in `ms`, or a miss (nil).
  public mutating func record(tuning: String, string s: Int, pc: Int, ms: Int?, at date: Date = Date()) {
    let k = Self.key(tuning: tuning, string: s, pc: pc)
    var e = data[k] ?? Entry(n: 0, hits: 0, ema: nil, last: nil)
    let v = min(ms ?? FindNoteDrill.missMs, FindNoteDrill.missMs)
    e.n += 1
    if ms != nil { e.hits += 1 }
    e.ema = e.ema.map { Int((Double($0) * 0.65 + Double(v) * 0.35).rounded()) } ?? v
    e.last = (date.timeIntervalSince1970 * 1000).rounded()
    data[k] = e
  }

  /// Flash-card weighting: unseen and slow notes come up more often.
  public func weight(tuning: String, string s: Int, pc: Int) -> Double {
    guard let ema = entry(tuning: tuning, string: s, pc: pc)?.ema else { return 2.5 }
    return min(4, max(0.35, Double(ema) / Double(FindNoteDrill.goalMs)))
  }
}

public struct FindNoteConfig: Sendable, Hashable {
  public var mode: FindNoteMode
  /// One note everywhere: the note and its names ([primary, alternate?]).
  public var pc: Int
  public var names: [String]
  public var direction: FindNoteDirection
  /// Flash cards: which notes, which strings, how many cards.
  public var notes: FindNoteNotes
  public var strings: [Int]
  public var count: Int
  public var pace: FindNotePace
  public var frets: ClosedRange<Int>
  public var tuning: Tuning
  /// Only the octave on the target string counts.
  public var strictOctave: Bool
  /// A first hint after 5 s (Free pace only).
  public var autoHint: Bool
  /// Flash cards pick slow and missed notes more often.
  public var weakSpots: Bool

  public init(mode: FindNoteMode, pc: Int = 0, names: [String]? = nil, direction: FindNoteDirection = .upBack,
              notes: FindNoteNotes = .naturals, strings: [Int] = lowToHigh, count: Int = 20, pace: FindNotePace = .free,
              frets: ClosedRange<Int> = 0...12, tuning: Tuning = .standard, strictOctave: Bool = true,
              autoHint: Bool = false, weakSpots: Bool = true) {
    self.mode = mode
    self.pc = Theory.mod12(pc)
    self.names = names ?? Theory.spellings(pc)
    self.direction = direction
    self.notes = notes
    self.strings = strings
    self.count = count
    self.pace = pace
    self.frets = frets
    self.tuning = tuning
    self.strictOctave = strictOctave
    self.autoHint = autoHint
    self.weakSpots = weakSpots
  }
}

public struct FindNoteTarget: Sendable, Hashable {
  public enum Status: Sendable, Hashable { case pending, active, hit, miss, skip }

  public let string: Int
  public let pc: Int
  /// [primary, alternate?]: the card shows the first and mentions the second.
  public let names: [String]
  /// Every fret in the range where it is on this string.
  public let frets: [Int]
  public let midis: [Int]
  public var status: Status = .pending
  /// How long it took, from the moment it was shown.
  public var ms: Int?
  /// Wrong notes before it was found.
  public var slips = 0
  /// Hints taken: 1 = anchors, 2 = shown.
  public var hints = 0
  /// Where it was found.
  public var fret: Int?
  public var shownAt: Double?
  /// When its time is up (clocked paces).
  public var windowEnd: Double?

  public var name: String { names[0] }
  public var isFinished: Bool { status == .hit || status == .miss || status == .skip }

  public init(string: Int, pc: Int, names: [String], frets: ClosedRange<Int>, tuning: Tuning) {
    self.string = string
    self.pc = Theory.mod12(pc)
    self.names = names
    self.frets = tuning.frets(string: string, pitchClass: pc, from: frets.lowerBound, to: frets.upperBound)
    self.midis = self.frets.map { tuning.midi(string: string, fret: $0) }
  }
}

/// A mark the hint puts on the neck.
public struct FindNoteHint: Sendable, Hashable {
  public enum Kind: Sendable, Hashable {
    /// A landmark or an anchor on the E or A string.
    case anchor
    /// Where the note is.
    case reveal
  }

  public var position: FretPosition
  public var label: String
  public var kind: Kind
}

public struct FindNoteDrill: Sendable, Equatable {
  /// The Part 3 checkpoint: any note on any string in under 2 seconds.
  public static let goalMs = 2000
  /// How a miss counts toward a note's average.
  public static let missMs = 6000
  /// Seconds after a window closes in which a note played on the click still counts.
  public static let grace = 0.25

  public enum State: Sendable, Hashable { case ready, countIn, running, done }

  /// How a heard note relates to a target.
  public enum Judgement: Sendable, Hashable {
    case found(fret: Int)
    /// A tap on another string (the mic can't tell strings).
    case wrongString
    /// Another note. If it was on the target string, it was at `fret`, `off` frets from the nearest right one.
    case wrongNote(fret: Int?, off: Int?)
    /// The right note in an octave that isn't on the target string.
    case wrongOctave

    public var isFound: Bool { if case .found = self { true } else { false } }
  }

  public enum Event: Sendable, Hashable {
    /// Target i is up.
    case target(Int)
    case hit(Int)
    case wrong(Int, midi: Int, string: Int?, Judgement)
    /// Missed (time ran out) or skipped: the target's status says which.
    case miss(Int)
    case hint(Int, level: Int)
    case done(Summary)
  }

  public struct Summary: Sendable, Hashable {
    public var aborted: Bool
    public var total: Int
    public var played: Int
    public var hits: Int
    public var misses: [FindNoteTarget]
    public var avgMs: Int?
    public var bestMs: Int?
    public var underGoal: Int
    public var slips: Int
    public var hints: Int
    /// The string with the slowest average and that average, when notes were found on more than one.
    public var slowestString: Int?
    public var slowestMs: Int?
    /// Every note found, without a hint.
    public var clean: Bool
  }

  public let config: FindNoteConfig
  public private(set) var targets: [FindNoteTarget]
  public private(set) var index = -1
  public private(set) var state: State = .ready
  /// When the first target appears (after the count-in).
  public private(set) var t0: Double = 0
  /// A target whose window has closed but is still inside its grace period.
  private var closing: Int?

  public var pace: FindNotePace { config.pace }
  public var window: Double? { config.pace.window }
  public var current: FindNoteTarget? { targets.indices.contains(index) ? targets[index] : nil }

  public init(config: FindNoteConfig, targets: [FindNoteTarget]) {
    self.config = config
    self.targets = targets
  }

  public init<G: RandomNumberGenerator>(config: FindNoteConfig, stats: NoteStats, using rng: inout G) {
    self.init(config: config, targets: Self.buildTargets(config, stats: stats, using: &rng))
  }

  public init(config: FindNoteConfig, stats: NoteStats) {
    var rng = SystemRandomNumberGenerator()
    self.init(config: config, stats: stats, using: &rng)
  }

  // MARK: Targets

  public static func buildTargets<G: RandomNumberGenerator>(_ cfg: FindNoteConfig, stats: NoteStats, using rng: inout G) -> [FindNoteTarget] {
    let tuning = cfg.tuning
    if cfg.mode == .everywhere {
      let seq = cfg.direction == .up ? lowToHigh : lowToHigh + lowToHigh.reversed()
      return seq.map { FindNoteTarget(string: $0, pc: cfg.pc, names: cfg.names, frets: cfg.frets, tuning: tuning) }
        .filter { !$0.frets.isEmpty }
    }
    let pcs = cfg.notes == .all ? Array(0..<12) : Theory.naturalPCs
    var pool: [(s: Int, pc: Int)] = []
    for s in cfg.strings {
      for pc in pcs where !tuning.frets(string: s, pitchClass: pc, from: cfg.frets.lowerBound, to: cfg.frets.upperBound).isEmpty {
        pool.append((s, pc))
      }
    }
    guard !pool.isEmpty else { return [] }
    var out: [FindNoteTarget] = []
    var prev: (s: Int, pc: Int)?
    for _ in 0..<cfg.count {
      // Avoid the same string or the same note twice in a row when the pool allows it.
      var options = pool.filter { p in prev.map { p.s != $0.s && p.pc != $0.pc } ?? true }
      if options.isEmpty { options = pool.filter { p in prev.map { p.s != $0.s || p.pc != $0.pc } ?? true } }
      if options.isEmpty { options = pool }
      let pick = weightedPick(options, using: &rng) { p in
        cfg.weakSpots ? stats.weight(tuning: tuning.id, string: p.s, pc: p.pc) : 1
      }
      let names = Theory.spellings(pick.pc, preferFlat: Bool.random(using: &rng))
      out.append(FindNoteTarget(string: pick.s, pc: pick.pc, names: names, frets: cfg.frets, tuning: tuning))
      prev = pick
    }
    return out
  }

  static func weightedPick<T, G: RandomNumberGenerator>(_ items: [T], using rng: inout G, weight: (T) -> Double) -> T {
    let total = items.reduce(0) { $0 + weight($1) }
    var r = Double.random(in: 0..<1, using: &rng) * total
    for it in items {
      r -= weight(it)
      if r <= 0 { return it }
    }
    return items[items.count - 1]
  }

  // MARK: The clock

  /// The first target appears at t0 (after a count-in).
  public mutating func begin(at t0: Double) {
    self.t0 = t0
    state = .countIn
  }

  private mutating func activate(_ i: Int, at t: Double) -> Event {
    index = i
    targets[i].status = .active
    targets[i].shownAt = t
    targets[i].windowEnd = window.map { t + $0 }
    return .target(i)
  }

  /// Call often (every frame): starts the round, closes windows, gives the auto-hint, finishes.
  public mutating func tick(_ now: Double) -> [Event] {
    var events: [Event] = []
    if state == .countIn, now >= t0 {
      state = .running
      events.append(activate(0, at: t0))
    }
    guard state == .running else { return events }
    if let c = closing, now > (targets[c].windowEnd ?? now) + Self.grace {
      events.append(miss(c))
      closing = nil
    }
    if window != nil, let cur = current, let end = cur.windowEnd, now >= end {
      if cur.status == .active { closing = index }
      if index + 1 < targets.count { events.append(activate(index + 1, at: end)) } else { index = targets.count }
    } else if window == nil, config.autoHint, let cur = current, cur.status == .active, cur.hints == 0,
              let shown = cur.shownAt, now - shown > 5 {
      events += hint()
    }
    if index >= targets.count && closing == nil { events.append(finish(aborted: false)) }
    return events
  }

  // MARK: Notes

  /// How a heard note relates to a target. `string` is known only for taps on the screen.
  public func judge(_ tg: FindNoteTarget, midi: Int, string: Int? = nil) -> Judgement {
    if let s = string, s != tg.string { return .wrongString }
    if Theory.mod12(midi) != tg.pc {
      // Assume they're on the target string: how far off were they?
      let f = midi - config.tuning.open(tg.string)
      if config.frets.contains(f), let near = tg.frets.min(by: { abs($0 - f) < abs($1 - f) }) {
        return .wrongNote(fret: f, off: f - near)
      }
      return .wrongNote(fret: nil, off: nil)
    }
    if let exact = tg.midis.firstIndex(of: midi) { return .found(fret: tg.frets[exact]) }
    if !config.strictOctave, let f = tg.frets.first { return .found(fret: f) }
    return .wrongOctave
  }

  /// A note: from the mic (playedAt: its attack) or a tap (with its string).
  public mutating func hear(midi: Int, string: Int? = nil, playedAt: Double? = nil, now: Double) -> [Event] {
    guard state == .running else { return [] }
    let p = playedAt ?? now
    // A note played on the click that ends the last window still counts for it.
    if let c = closing, p <= (targets[c].windowEnd ?? 0) + 0.05 {
      let j = judge(targets[c], midi: midi, string: string)
      if case .found(let fret) = j {
        closing = nil
        return [hit(c, fret: fret, at: p)]
      }
    }
    guard let cur = current, cur.status == .active else { return [] }
    let j = judge(cur, midi: midi, string: string)
    guard case .found(let fret) = j else {
      targets[index].slips += 1
      return [.wrong(index, midi: midi, string: string, j)]
    }
    var events = [hit(index, fret: fret, at: p)]
    if window == nil { events += advance(now) }
    return events
  }

  private mutating func hit(_ i: Int, fret: Int, at p: Double) -> Event {
    targets[i].status = .hit
    targets[i].fret = fret
    targets[i].ms = max(0, Int(((p - (targets[i].shownAt ?? p)) * 1000).rounded()))
    return .hit(i)
  }

  private mutating func miss(_ i: Int) -> Event {
    targets[i].status = .miss
    return .miss(i)
  }

  private mutating func advance(_ now: Double) -> [Event] {
    if index + 1 < targets.count { return [activate(index + 1, at: now)] }
    index = targets.count
    return [finish(aborted: false)]
  }

  // MARK: Hints, skip, stop

  public mutating func hint() -> [Event] {
    guard state == .running, let cur = current, cur.status == .active, cur.hints < 2 else { return [] }
    targets[index].hints += 1
    return [.hint(index, level: targets[index].hints)]
  }

  /// Skip the card (Free pace only: on the clock, the next one comes anyway).
  public mutating func skip(now: Double) -> [Event] {
    guard window == nil, state == .running, let cur = current, cur.status == .active else { return [] }
    targets[index].status = .skip
    return [.miss(index)] + advance(now)
  }

  public mutating func stop() -> [Event] {
    guard state != .done else { return [] }
    return [finish(aborted: true)]
  }

  private mutating func finish(aborted: Bool) -> Event {
    state = .done
    return .done(summary(aborted: aborted))
  }

  /// The hint marks for a target: level 1 shows the anchors (or, on the E and A strings themselves,
  /// the natural-note landmarks); level 2 adds where it is.
  public func hintMarks(for tg: FindNoteTarget, level: Int) -> [FindNoteHint] {
    let tun = config.tuning
    let range = config.frets
    var out: [FindNoteHint] = []
    if tg.string == 6 || tg.string == 5 {
      for f in range {
        let pc = tun.pitchClass(string: tg.string, fret: f)
        if Theory.isNatural(pc) && pc != tg.pc {
          out.append(FindNoteHint(position: FretPosition(string: tg.string, fret: f), label: Theory.noteName(pc), kind: .anchor))
        }
      }
    } else {
      for s in [5, 6] {
        for f in tun.frets(string: s, pitchClass: tg.pc, from: range.lowerBound, to: range.upperBound) {
          out.append(FindNoteHint(position: FretPosition(string: s, fret: f), label: tg.name, kind: .anchor))
        }
      }
    }
    if level >= 2 {
      out += tg.frets.map { FindNoteHint(position: FretPosition(string: tg.string, fret: $0), label: tg.name, kind: .reveal) }
    }
    return out
  }

  // MARK: Summary

  public func summary(aborted: Bool) -> Summary {
    let played = targets.filter(\.isFinished)
    let hits = targets.filter { $0.status == .hit }
    func avg(_ ts: [FindNoteTarget]) -> Int? {
      ts.isEmpty ? nil : Int((Double(ts.reduce(0) { $0 + ($1.ms ?? 0) }) / Double(ts.count)).rounded())
    }
    let byString = Dictionary(grouping: hits, by: \.string)
    var slowest: (string: Int, ms: Int)?
    for s in byString.keys.sorted() {
      if let a = avg(byString[s]!), a > (slowest?.ms ?? -1) { slowest = (s, a) }
    }
    let hints = targets.filter { $0.hints > 0 }.count
    let msList = hits.compactMap(\.ms)
    let several = byString.count > 1
    return Summary(
      aborted: aborted, total: targets.count, played: played.count, hits: hits.count,
      misses: played.filter { $0.status != .hit }, avgMs: avg(hits), bestMs: msList.min(),
      underGoal: msList.filter { $0 < Self.goalMs }.count, slips: targets.reduce(0) { $0 + $1.slips },
      hints: hints, slowestString: several ? slowest?.string : nil, slowestMs: several ? slowest?.ms : nil,
      clean: !aborted && hits.count == targets.count && hints == 0)
  }
}
