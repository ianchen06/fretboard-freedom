// Sequences over a path of notes, and the rhythm and tempo they're played at (web/js/sessiongen.js).

public enum SequencePattern: String, Sendable, Codable, CaseIterable, Identifiable {
  case straight, threes, fours, thirds, sixes

  public var id: String { rawValue }

  public var name: String {
    switch self {
    case .straight: "up and down"
    case .threes: "in 3s"
    case .fours: "in 4s"
    case .thirds: "in 3rds"
    case .sixes: "descending 6s"
    }
  }

  /// Mastery the shape needs before this pattern is offered.
  public var minMastery: Double {
    switch self {
    case .straight: 0
    case .threes: 0.35
    case .fours: 0.45
    case .thirds: 0.5
    case .sixes: 0.55
    }
  }

  /// Notes per beat the pattern is normally played at: the rhythm matches the grouping.
  public var notesPerBeat: Int {
    switch self {
    case .straight: 2
    case .threes: 3
    case .fours: 4
    case .thirds: 2
    case .sixes: 6
    }
  }

  /// Rhythms that make sense for the pattern. 3s over 16ths moves the accent (displacement).
  public var rhythms: [Int] {
    switch self {
    case .straight: [2, 4]
    case .threes: [3, 4]
    case .fours: [4]
    case .thirds: [2]
    case .sixes: [6]
    }
  }

  public var how: String {
    switch self {
    case .straight: "Up the shape and back down in even notes. Strict alternate picking. Start slow enough to play it perfectly."
    case .threes: "Groups of three: 1-2-3, 2-3-4, 3-4-5 … then the same coming down. One group per beat, as triplets. Accent the first note of each group."
    case .fours: "Groups of four: 1-2-3-4, 2-3-4-5 … then back down. Four notes per beat (16ths). Accent each beat."
    case .thirds: "Skip a note: 1-3, 2-4, 3-5 … then back down. One pair per beat. Watch the string crossings."
    case .sixes: "Descending groups of six, one group per beat (sextuplets). Keep the picking hand moving the same way all the time."
    }
  }

  /// The order to play n ascending notes in. No pattern plays the same note twice in a row, even
  /// where it loops back to the start.
  public func indices(_ n: Int) -> [Int] {
    var out: [Int] = []
    if self == .straight || n < 4 {
      out.append(contentsOf: 0..<n)
      if n >= 3 { out.append(contentsOf: stride(from: n - 2, through: 1, by: -1)) }
      return out
    }
    switch self {
    case .threes, .fours:
      let g = self == .threes ? 3 : 4
      var i = 0
      while i + g <= n { for j in 0..<g { out.append(i + j) }; i += 1 }
      var k = n - 2
      while k >= g { for j in 0..<g { out.append(k - j) }; k -= 1 }
    case .thirds:
      var i = 0
      while i + 2 < n { out.append(contentsOf: [i, i + 2]); i += 1 }
      var k = n - 2
      while k >= 3 { out.append(contentsOf: [k, k - 2]); k -= 1 }
    case .sixes:
      var k = n - 1
      while k >= 5 { for j in 0..<6 { out.append(k - j) }; k -= 1 }
    case .straight:
      break
    }
    return out
  }
}

public enum Tempo {
  public static let minBPM = 40
  public static let maxBPM = 220

  /// What a number of notes per beat is called.
  public static func rhythmName(_ notesPerBeat: Double) -> String {
    switch notesPerBeat {
    case 0.5: "half notes"
    case 1: "quarter notes"
    case 2: "8th notes"
    case 3: "triplets"
    case 4: "16th notes"
    case 6: "sextuplets"
    default: "\(notesPerBeat) per beat"
    }
  }

  /// Where a new pattern starts, by notes per beat.
  public static func startBPM(_ notesPerBeat: Double) -> Int {
    switch notesPerBeat {
    case 0.5, 1: 60
    case 2: 72
    case 3: 60
    case 4: 56
    case 6: 46
    default: 70
    }
  }

  /// How far the tempo ladder moves: 3 bpm for fast subdivisions, 4 otherwise.
  public static func step(_ notesPerBeat: Double) -> Int { notesPerBeat >= 4 ? 3 : 4 }

  public static func clamp(_ bpm: Int) -> Int { min(maxBPM, max(minBPM, bpm)) }
}
