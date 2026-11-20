// The learner model (Learner in web/js/sessiongen.js): per skill, a mastery estimate fed by the
// grades, a spaced-repetition interval, and per pattern a tempo ladder. Encodes to the same JSON as
// the web app's `ff.learner`, so a web backup can be imported.
import Foundation

/// A calendar day as "yyyy-MM-dd", the form the web app stores.
public struct DayKey: Sendable, Hashable, Codable, Comparable, CustomStringConvertible {
  public let rawValue: String
  public init(_ rawValue: String) { self.rawValue = rawValue }

  public init(_ date: Date, calendar: Calendar = .current) {
    let c = calendar.dateComponents([.year, .month, .day], from: date)
    rawValue = String(format: "%04d-%02d-%02d", c.year ?? 1970, c.month ?? 1, c.day ?? 1)
  }

  public static var today: DayKey { DayKey(Date()) }

  /// Days since 1970-01-01 (proleptic Gregorian).
  public var dayNumber: Int {
    let parts = rawValue.split(separator: "-").compactMap { Int($0) }
    guard parts.count == 3 else { return 0 }
    let (y0, m, d) = (parts[0], parts[1], parts[2])
    let y = m <= 2 ? y0 - 1 : y0
    let era = (y >= 0 ? y : y - 399) / 400
    let yoe = y - era * 400
    let doy = (153 * (m + (m > 2 ? -3 : 9)) + 2) / 5 + d - 1
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy
    return era * 146097 + doe - 719468
  }

  public func days(until other: DayKey) -> Int { other.dayNumber - dayNumber }
  public var description: String { rawValue }
  public static func < (a: DayKey, b: DayKey) -> Bool { a.rawValue < b.rawValue }

  public init(from decoder: any Decoder) throws { rawValue = try decoder.singleValueContainer().decode(String.self) }
  public func encode(to encoder: any Encoder) throws {
    var c = encoder.singleValueContainer()
    try c.encode(rawValue)
  }
}

public struct Learner: Sendable, Codable, Hashable {
  public struct Skill: Sendable, Codable, Hashable {
    /// Mastery, 0–1.
    public var m: Double
    /// Times practiced.
    public var n: Int
    /// Days until the next review.
    public var interval: Double
    public var last: DayKey?
    /// The last grade.
    public var score: Double?
  }

  public struct TempoRecord: Sendable, Codable, Hashable {
    /// Where the next run starts.
    public var bpm: Int?
    /// The best clean tempo.
    public var best: Int?
  }

  /// "Where are you now?": only the starting guess for skills with no history.
  public enum Start: String, Sendable, Codable, CaseIterable {
    case box1, boxes, scales
  }

  enum Match {
    case exact(String)
    case prefix([String])
    func matches(_ id: String) -> Bool {
      switch self {
      case .exact(let s): id == s
      case .prefix(let ps): ps.contains { id.hasPrefix($0) }
      }
    }
  }

  static let rhythmPriors: [(Match, Double)] = [(.exact("rhythm:quarters"), 0.6), (.exact("rhythm:eighths"), 0.45)]
  static func priors(_ start: Start) -> [(Match, Double)] {
    switch start {
    case .box1:
      [(.exact("box:minPent:1"), 0.7), (.exact("box:blues:1"), 0.35), (.exact("chromatic"), 0.5)] + rhythmPriors
    case .boxes:
      [(.prefix(["box:minPent:"]), 0.6), (.prefix(["box:blues:"]), 0.4), (.prefix(["box:majPent:"]), 0.3),
       (.prefix(["arp:min:", "arp:maj:"]), 0.3), (.exact("chromatic"), 0.6), (.prefix(["link:minPent:"]), 0.3)] + rhythmPriors
    case .scales:
      [(.prefix(["box:"]), 0.75), (.prefix(["pos:aeolian:", "pos:ionian:"]), 0.6), (.prefix(["pos:"]), 0.4),
       (.prefix(["nps3:aeolian:"]), 0.45), (.prefix(["nps3:"]), 0.3), (.prefix(["arp:min:", "arp:maj:", "arp:dom7:"]), 0.5),
       (.prefix(["arp:"]), 0.35), (.prefix(["triads:"]), 0.4), (.exact("chromatic"), 0.7), (.prefix(["link:"]), 0.5)] + rhythmPriors
    }
  }

  public var skills: [String: Skill] = [:]
  public var tempos: [String: TempoRecord] = [:]
  public var start: Start = .box1

  enum CodingKeys: String, CodingKey { case skills, tempos, start }

  public init(start: Start = .box1) { self.start = start }

  public init(from decoder: any Decoder) throws {
    let c = try decoder.container(keyedBy: CodingKeys.self)
    skills = try c.decodeIfPresent([String: Skill].self, forKey: .skills) ?? [:]
    tempos = try c.decodeIfPresent([String: TempoRecord].self, forKey: .tempos) ?? [:]
    start = try c.decodeIfPresent(Start.self, forKey: .start) ?? .box1
  }

  public func prior(_ id: String) -> Double {
    Self.priors(start).first { $0.0.matches(id) }?.1 ?? 0
  }

  public func mastery(_ id: String) -> Double { skills[id]?.m ?? prior(id) }
  public func count(_ id: String) -> Int { skills[id]?.n ?? 0 }

  /// Days until it's due for review (≤ 0 = due), or nil if never practiced.
  public func dueIn(_ id: String, today: DayKey) -> Double? {
    guard let k = skills[id], let last = k.last else { return nil }
    return k.interval - Double(last.days(until: today))
  }

  /// score: 0–1 from the grader (or your rating). The estimate moves faster for new skills.
  @discardableResult
  public mutating func update(_ id: String, score: Double, today: DayKey) -> Skill {
    var k = skills[id] ?? Skill(m: prior(id), n: 0, interval: 0, last: nil, score: nil)
    let a = k.n < 3 ? 0.4 : 0.25
    k.m = min(1, max(0, k.m + a * (score - k.m)))
    k.n += 1
    k.interval = score >= 0.85 ? min(30, max(1, k.interval) * 2.2)
      : score >= 0.6 ? max(1, min(k.interval, 4)) : 1
    k.interval = (k.interval * 10).rounded() / 10
    k.last = today
    k.score = (score * 100).rounded() / 100
    skills[id] = k
    return k
  }

  /// Where a pattern starts: the last tempo saved for it, or the exercise's own starting tempo.
  public func tempo(_ key: String, notesPerBeat: Double, fallback: Int? = nil) -> Int {
    tempos[key]?.bpm ?? fallback ?? Tempo.startBPM(notesPerBeat)
  }

  public func best(_ key: String) -> Int { tempos[key]?.best ?? 0 }

  /// Next time start where you ended clean (a step lower if it fell apart).
  public mutating func saveTempo(_ key: String, bpm: Int, cleanBPM: Int = 0, struggled: Bool = false) {
    var t = tempos[key] ?? TempoRecord()
    t.best = max(t.best ?? 0, cleanBPM)
    t.bpm = max(Tempo.minBPM, struggled ? bpm - 4 : cleanBPM > 0 ? cleanBPM : bpm)
    tempos[key] = t
  }
}
