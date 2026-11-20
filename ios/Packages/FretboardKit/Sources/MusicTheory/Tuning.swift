// Tunings and fret math. String numbering follows guitar convention: 1 = high e … 6 = low E.

/// Strings from low E to high e: the order shapes are built in.
public let lowToHigh = [6, 5, 4, 3, 2, 1]
/// Strings from high e to low E: the order tab and the fretboard draw them, top to bottom.
public let highToLow = [1, 2, 3, 4, 5, 6]

public struct Tuning: Sendable, Hashable, Identifiable, Codable {
  public var id: String
  public var name: String
  /// Open-string MIDI notes, high e first: open[0] is string 1.
  public var openNotes: [Int]
  /// Spell string names with flats.
  public var flat: Bool

  public init(id: String, name: String, openNotes: [Int], flat: Bool) {
    precondition(openNotes.count == 6, "A tuning has six strings")
    self.id = id
    self.name = name
    self.openNotes = openNotes
    self.flat = flat
  }

  /// MIDI note of the open string s (1 = high e … 6 = low E).
  @inlinable public func open(_ s: Int) -> Int { openNotes[s - 1] }
  @inlinable public func midi(string s: Int, fret f: Int) -> Int { open(s) + f }
  @inlinable public func pitchClass(string s: Int, fret f: Int) -> Int { Theory.mod12(midi(string: s, fret: f)) }

  /// String label: high string lowercase, as in tab.
  public func stringName(_ s: Int) -> String {
    let n = Theory.noteName(open(s), preferFlat: flat)
    return s == 1 ? n.prefix(1).lowercased() + n.dropFirst() : n
  }

  /// Long string name for prompts: "low E", "A", "high e".
  public func stringLongName(_ s: Int) -> String {
    let n = Theory.noteName(open(s), preferFlat: flat)
    if s == 6 { return "low \(n)" }
    if s == 1 { return "high \(n.prefix(1).lowercased())\(n.dropFirst())" }
    return n
  }

  /// Every fret in from...to on string s whose pitch class is pc.
  public func frets(string s: Int, pitchClass pc: Int, from: Int, to: Int) -> [Int] {
    (from...to).filter { pitchClass(string: s, fret: $0) == Theory.mod12(pc) }
  }

  /// Every place on the neck (frets from...to) that sounds exactly this MIDI note.
  public func places(midi: Int, from: Int = 0, to: Int = 22) -> [FretPosition] {
    highToLow.compactMap { s in
      let f = midi - open(s)
      return f >= from && f <= to ? FretPosition(string: s, fret: f) : nil
    }
  }

  public static let standard = Tuning(id: "standard", name: "Standard (E A D G B E)", openNotes: [64, 59, 55, 50, 45, 40], flat: false)
  public static let eFlat = Tuning(id: "eflat", name: "E♭ standard", openNotes: [63, 58, 54, 49, 44, 39], flat: true)
  public static let dropD = Tuning(id: "dropD", name: "Drop D", openNotes: [64, 59, 55, 50, 45, 38], flat: false)
  public static let dStandard = Tuning(id: "dStandard", name: "D standard", openNotes: [62, 57, 53, 48, 43, 38], flat: true)
  public static let dropC = Tuning(id: "dropC", name: "Drop C", openNotes: [62, 57, 53, 48, 43, 36], flat: true)
  public static let all: [Tuning] = [.standard, .eFlat, .dropD, .dStandard, .dropC]
}

/// A place on the neck.
public struct FretPosition: Sendable, Hashable, Codable {
  public var string: Int
  public var fret: Int
  public init(string: Int, fret: Int) { self.string = string; self.fret = fret }
}
