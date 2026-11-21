// Scales, chords and their degree names and colors: the tables of web/js/scales.js.

/// The deck's color roles: root red, 3rd amber, 5th blue, 7th purple, flavor/blue note teal.
public enum DegreeRole: String, Sendable, Codable, CaseIterable {
  case root, third, fifth, seventh, flavor, other
}

public enum ScaleKind: String, Sendable, Codable, CaseIterable, Identifiable {
  case minorPentatonic = "minPent"
  case majorPentatonic = "majPent"
  case blues
  case aeolian
  case ionian
  case dorian
  case mixolydian
  case phrygian
  case lydian
  case harmonicMinor = "harmMinor"
  case phrygianDominant = "phrygDom"

  public var id: String { rawValue }

  public var name: String {
    switch self {
    case .minorPentatonic: "Minor pentatonic"
    case .majorPentatonic: "Major pentatonic"
    case .blues: "Blues scale"
    case .aeolian: "Natural minor"
    case .ionian: "Major scale"
    case .dorian: "Dorian"
    case .mixolydian: "Mixolydian"
    case .phrygian: "Phrygian"
    case .lydian: "Lydian"
    case .harmonicMinor: "Harmonic minor"
    case .phrygianDominant: "Phrygian dominant"
    }
  }

  /// Semitones above the root.
  public var steps: [Int] {
    switch self {
    case .minorPentatonic: [0, 3, 5, 7, 10]
    case .majorPentatonic: [0, 2, 4, 7, 9]
    case .blues: [0, 3, 5, 6, 7, 10]
    case .aeolian: [0, 2, 3, 5, 7, 8, 10]
    case .ionian: [0, 2, 4, 5, 7, 9, 11]
    case .dorian: [0, 2, 3, 5, 7, 9, 10]
    case .mixolydian: [0, 2, 4, 5, 7, 9, 10]
    case .phrygian: [0, 1, 3, 5, 7, 8, 10]
    case .lydian: [0, 2, 4, 6, 7, 9, 11]
    case .harmonicMinor: [0, 2, 3, 5, 7, 8, 11]
    case .phrygianDominant: [0, 1, 4, 5, 7, 8, 10]
    }
  }

  /// Whose pentatonic boxes the scale's positions sit in: false = the relative minor's boxes, so
  /// C major lines up with the A minor boxes.
  public var isMinor: Bool {
    switch self {
    case .majorPentatonic, .ionian, .mixolydian, .lydian: false
    default: true
    }
  }

  /// The semitone that gives the scale its sound (colored teal).
  public var flavor: Int? {
    switch self {
    case .blues: 6
    case .aeolian: 8
    case .dorian: 9
    case .mixolydian: 10
    case .phrygian: 1
    case .lydian: 6
    case .harmonicMinor: 11
    case .phrygianDominant: 1
    default: nil
    }
  }

  public var isPentatonicFamily: Bool { steps.count == 5 || self == .blues }

  public func pitchClasses(root: Int) -> Set<Int> { Set(steps.map { Theory.mod12(root + $0) }) }
}

public enum ChordKind: String, Sendable, Codable, CaseIterable {
  case major = "maj", minor = "min", diminished = "dim"
  case dominant7 = "dom7", minor7 = "min7", major7 = "maj7", halfDiminished = "m7b5", diminished7 = "dim7"

  public var name: String {
    switch self {
    case .major: "Major"
    case .minor: "Minor"
    case .diminished: "Diminished"
    case .dominant7: "Dominant 7"
    case .minor7: "Minor 7"
    case .major7: "Major 7"
    case .halfDiminished: "Half-diminished 7"
    case .diminished7: "Diminished 7"
    }
  }

  public var symbol: String {
    switch self {
    case .major: ""
    case .minor: "m"
    case .diminished: "°"
    case .dominant7: "7"
    case .minor7: "m7"
    case .major7: "maj7"
    case .halfDiminished: "m7♭5"
    case .diminished7: "°7"
    }
  }

  public var steps: [Int] {
    switch self {
    case .major: [0, 4, 7]
    case .minor: [0, 3, 7]
    case .diminished: [0, 3, 6]
    case .dominant7: [0, 4, 7, 10]
    case .minor7: [0, 3, 7, 10]
    case .major7: [0, 4, 7, 11]
    case .halfDiminished: [0, 3, 6, 10]
    case .diminished7: [0, 3, 6, 9]
    }
  }
}

public enum Degrees {
  public static let labels = ["R", "♭2", "2", "♭3", "3", "4", "♭5", "5", "♭6", "6", "♭7", "7"]

  public static func label(_ semi: Int, scale: ScaleKind? = nil, chord: ChordKind? = nil) -> String {
    if scale == .lydian && semi == 6 { return "♯4" }
    if chord == .diminished7 && semi == 9 { return "°7" }
    return labels[Theory.mod12(semi)]
  }

  public static func scaleRole(_ semi: Int, scale: ScaleKind?) -> DegreeRole {
    if semi == 0 { return .root }
    if let flavor = scale?.flavor, semi == flavor { return .flavor }
    switch semi {
    case 3, 4: return .third
    case 7: return .fifth
    case 10, 11: return .seventh
    case 6: return .flavor
    default: return .other
    }
  }

  public static func chordRole(_ semi: Int) -> DegreeRole {
    switch semi {
    case 0: .root
    case 3, 4: .third
    case 6...8: .fifth
    case 9...: .seventh
    default: .other
    }
  }
}

public enum Spelling {
  /// Major keys spelled with flats (F B♭ E♭ A♭ D♭ G♭); a minor key follows its relative major.
  static let flatMajors: Set<Int> = [5, 10, 3, 8, 1, 6]
  public static func preferFlat(_ pc: Int, minor: Bool) -> Bool {
    flatMajors.contains(minor ? Theory.mod12(pc + 3) : Theory.mod12(pc))
  }

  /// The scale's note names, spelled by degree (one letter per degree: A Phrygian has B♭, not A♯;
  /// the blue note of A is E♭).
  public static func scale(root: Int, _ scale: ScaleKind, preferFlat: Bool = false) -> Theory.SpelledSet {
    // The blues scale is the minor pentatonic plus one note: it keeps the pentatonic's name for the root.
    let rootName = scale == .blues ? Spelling.scale(root: root, .minorPentatonic, preferFlat: preferFlat).root : nil
    return Theory.spellSet(rootPC: root, steps: scale.steps, labels: scale.steps.map { Degrees.label($0, scale: scale) },
                           preferFlat: preferFlat, rootName: rootName)
  }

  /// The key's name and its scale's note names, spelled the way the deck does.
  public static func key(_ root: Int, _ scale: ScaleKind) -> Theory.SpelledSet {
    Spelling.scale(root: root, scale, preferFlat: preferFlat(root, minor: scale.isMinor))
  }

  /// The chord's root and chord tones, using the degree labels to choose the letters.
  public static func chord(root: Int, _ chord: ChordKind) -> Theory.SpelledSet {
    Theory.spellSet(rootPC: root, steps: chord.steps, labels: chord.steps.map { Degrees.label($0, chord: chord) },
                   preferFlat: preferFlat(root, minor: chord.steps.contains(3)))
  }

  /// A chord's tones named from its root's name (thirds stacked by letter): ("D", .dominant7) → D F♯ A C.
  public static func chord(rootName: String, _ chord: ChordKind) -> [String] {
    let flat = rootName.contains("♭")
    let rootPC = Theory.pitchClass(rootName) ?? 0
    return chord.steps.map { x in
      Theory.spellAbove(rootName, semis: x, letterSteps: Theory.letterSteps(Degrees.label(x, chord: chord)))
        ?? Theory.noteName(rootPC + x, preferFlat: flat)
    }
  }
}
