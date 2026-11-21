// Notes, spelling and pitch math: a port of web/js/theory.js.
// String numbering follows guitar convention: 1 = high e … 6 = low E.
import Foundation

public enum Theory {
  public static let sharpNames = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"]
  public static let flatNames = ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"]
  public static let naturalPCs = [0, 2, 4, 5, 7, 9, 11]
  static let letters: [Character] = ["C", "D", "E", "F", "G", "A", "B"]
  static let letterPC: [Character: Int] = ["C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11]

  /// Up a 4th each step: the order the deck drills keys in.
  public static let circleOfFourths = ["C", "F", "B♭", "E♭", "A♭", "D♭", "G♭", "B", "E", "A", "D", "G"]

  @inlinable public static func mod12(_ n: Int) -> Int { ((n % 12) + 12) % 12 }
  public static func isNatural(_ pc: Int) -> Bool { naturalPCs.contains(mod12(pc)) }

  /// Pitch class of a note name: "B♭", "C#", "Fb" → 10, 1, 4. nil if it isn't a note name.
  public static func pitchClass(_ name: String) -> Int? {
    let s = name.replacingOccurrences(of: "#", with: "♯")
    guard let first = s.first, var v = letterPC[first] else { return nil }
    for ch in s.dropFirst() {
      switch ch {
      case "♯": v += 1
      case "♭", "b": v -= 1
      default: return nil
      }
    }
    return mod12(v)
  }

  public static func noteName(_ pc: Int, preferFlat: Bool = false) -> String {
    (preferFlat ? flatNames : sharpNames)[mod12(pc)]
  }

  /// Both spellings for an accidental, one for a natural: [primary, alternate?].
  public static func spellings(_ pc: Int, preferFlat: Bool = false) -> [String] {
    let p = mod12(pc)
    if isNatural(p) { return [sharpNames[p]] }
    return preferFlat ? [flatNames[p], sharpNames[p]] : [sharpNames[p], flatNames[p]]
  }

  // MARK: Spelling by letter
  // A scale uses each letter once (A harmonic minor has G♯, not A♭) and a chord stacks every other
  // letter (D7 is D F♯ A C, not D G♭ A C), so a note's name depends on what it is in the scale or
  // chord, not only on its pitch.

  /// The note `letterSteps` letter names above `from`, `semis` semitones up, spelled on that letter:
  /// ("D", 4, 2) → "F♯", ("E♭", 8, 5) → "C♭". nil if it would need a double sharp or flat.
  public static func spellAbove(_ from: String, semis: Int, letterSteps: Int) -> String? {
    let s = from.replacingOccurrences(of: "#", with: "♯")
    guard let letter = s.first, let li0 = letters.firstIndex(of: letter), s.count <= 2,
          let fromPC = pitchClass(s) else { return nil }
    if s.count == 2, s.last != "♯", s.last != "♭" { return nil }
    let li = (li0 + letterSteps) % 7
    var acc = mod12(fromPC + semis - naturalPCs[li])
    if acc > 6 { acc -= 12 }
    if abs(acc) > 1 { return nil }
    return String(letters[li]) + (acc > 0 ? "♯" : acc < 0 ? "♭" : "")
  }

  /// Letter steps of a degree label: "R" → 0, "♭3" → 2, "♯4" → 3, "°7" → 6.
  public static func letterSteps(_ label: String) -> Int {
    if label == "R" { return 0 }
    let digits = label.filter { ("1"..."7").contains($0) }
    return (Int(digits) ?? 1) - 1
  }

  /// Names for a set of degrees over a root.
  public struct SpelledSet: Sendable, Hashable {
    /// The root's name.
    public var root: String
    /// One name per step.
    public var names: [String]
    /// How to name notes outside the set.
    public var flat: Bool
    /// Pitch class → name.
    public var byPC: [Int: String]
  }

  /// Names for a set of degrees over a root: steps (semitones) with their degree labels. An accidental
  /// root takes the spelling (sharp or flat) that needs fewer accidentals; preferFlat settles a tie.
  /// A note that would need a double accidental takes its plain name. rootName fixes the root's spelling.
  public static func spellSet(rootPC: Int, steps: [Int], labels: [String], preferFlat: Bool = false, rootName: String? = nil) -> SpelledSet {
    struct Attempt { var root: String; var names: [String?]; var cost: Int }
    func attempt(_ root: String) -> Attempt {
      var cost = 0
      let names = steps.enumerated().map { i, x -> String? in
        let n = spellAbove(root, semis: x, letterSteps: letterSteps(labels[i]))
        cost += n.map { $0.count - 1 } ?? 2
        return n
      }
      return Attempt(root: root, names: names, cost: cost)
    }
    let opts = (rootName.map { [$0] } ?? spellings(rootPC, preferFlat: preferFlat)).map(attempt)
    let best = opts.count > 1 && opts[1].cost < opts[0].cost ? opts[1] : opts[0]
    func count(_ ch: Character) -> Int { best.names.filter { $0?.contains(ch) ?? false }.count }
    let flats = count("♭"), sharps = count("♯")
    let flat = flats != sharps ? flats > sharps : best.root.count > 1 ? best.root.contains("♭") : preferFlat
    let names = best.names.enumerated().map { i, n in n ?? noteName(rootPC + steps[i], preferFlat: flat) }
    var byPC: [Int: String] = [:]
    for (i, x) in steps.enumerated() { byPC[mod12(rootPC + x)] = names[i] }
    return SpelledSet(root: best.root, names: names, flat: flat, byPC: byPC)
  }

  /// Scientific pitch name, e.g. 55 → "G3".
  public static func midiLabel(_ m: Double, preferFlat: Bool = false) -> String {
    let r = Int(m.rounded())
    return noteName(r, preferFlat: preferFlat) + String(Int(floor(Double(r) / 12)) - 1)
  }

  public static func freqToMidi(_ f: Double, a4: Double = 440) -> Double { 69 + 12 * log2(f / a4) }
  public static func midiToFreq(_ m: Double, a4: Double = 440) -> Double { a4 * pow(2, (m - 69) / 12) }
}
