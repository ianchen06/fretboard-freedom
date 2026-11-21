// Exercises: a shape turned into a sequence to play, with the text that explains it
// (FAM.shape in web/js/sessiongen.js).
import MusicTheory

/// What the screen shows and the grader checks.
public struct PracticeExercise: Sendable, Hashable {
  public struct Chip: Sendable, Hashable {
    public var label: String
    public var value: String
  }

  public var title: String
  public var chips: [Chip]
  public var how: String
  public var why: String
  /// The notes to play, in order. The sequence loops.
  public var notes: [ShapeNote]
  /// The shape's places on the neck, once each.
  public var dots: [ShapeNote]
  public var notesPerBeat: Double
  /// Whether timing counts toward a clean pass.
  public var timed: Bool
  public var keyPC: Int
  /// How to name notes outside the scale.
  public var flat: Bool
  /// Pitch class → note name, spelled by degree.
  public var names: [Int: String]
  public var allowed: Set<Int>
  /// The learner's skill id: "box:minPent:1" (the same ids as the web app's backups).
  public var skill: String
  /// Tempo ladder key: skill, pattern and rhythm.
  public var tempoKey: String
  public var cues: [String]
  public var lo: Int
  public var hi: Int

  public func name(_ midi: Int) -> String { names[Theory.mod12(midi)] ?? Theory.noteName(midi, preferFlat: flat) }
  public var targets: [SequenceGrader.Target] { notes.map { .init(midi: $0.midi) } }
}

public enum Cues {
  public static let all = [
    "Relax the fretting hand: press just hard enough for a clean note.",
    "Keep your fingers hovering close to the strings.",
    "Strict alternate picking: down-up, even across string changes.",
    "Say the degree names out loud for one pass.",
    "Play it quieter than you think. Clean beats loud.",
    "Mute the strings you aren’t playing: picking-hand palm and spare fretting fingers.",
    "One pass without looking at the fretboard.",
    "Shoulders down, breathe. Tension is the speed limit.",
    "Lock to the click: hear the click disappear under your notes.",
    "Play each note full length. No clipped notes on string changes.",
  ]
}

/// A scale shape played as a sequence: pentatonic boxes and 7-note positions.
public struct ShapeDrill: Sendable, Hashable, Codable {
  public var key: Int
  public var scale: ScaleKind
  public var box: Int
  public var pattern: SequencePattern
  public var notesPerBeat: Int
  /// Another octave placement of the same box.
  public var alt: Int

  public init(key: Int, scale: ScaleKind, box: Int, pattern: SequencePattern = .straight, notesPerBeat: Int? = nil, alt: Int = 0) {
    self.key = Theory.mod12(key)
    self.scale = scale
    self.box = box
    self.pattern = pattern
    self.notesPerBeat = notesPerBeat ?? pattern.notesPerBeat
    self.alt = alt
  }

  /// "box:minPent:3", "pos:aeolian:2".
  public var skill: String { "\(scale.isPentatonicFamily ? "box" : "pos"):\(scale.rawValue):\(box)" }
  public var tempoKey: String { "\(skill):\(pattern.rawValue):\(notesPerBeat)" }
  public var shapeName: String { scale.steps.count <= 6 ? "box \(box)" : "position \(box)" }

  /// Modes keep their capitals ("Dorian"); the rest read as a phrase ("minor pentatonic").
  static func title(_ scale: ScaleKind) -> String {
    [.dorian, .mixolydian, .phrygian, .lydian, .phrygianDominant].contains(scale) ? scale.name : scale.name.lowercased()
  }

  public static func why(_ scale: ScaleKind) -> String {
    switch scale {
    case .minorPentatonic: "The home base of blues and rock soloing. Every box holds the same five notes; only the fingering changes. Know where the roots (red) are in each one."
    case .blues: "The minor pentatonic plus the ♭5 blue note (teal). Pass through it on the way between the 4 and 5; don’t park on it."
    case .majorPentatonic: "Same shapes as the minor pentatonic, three frets lower, but the root moves. The sweeter, country-and-Southern-rock side of the sound."
    case .aeolian: "Natural minor: the minor pentatonic plus the 2 and the ♭6. The sound of rock ballads and a lot of metal."
    case .ionian: "The major scale, the parent of every mode: the major pentatonic plus the 4 and the 7."
    case .dorian: "Minor with a bright ♮6 (teal). Santana, funk, and jam-band minor grooves."
    case .mixolydian: "Major with a ♭7 (teal): the sound of dominant chords and classic-rock riffs."
    case .phrygian: "Minor with a ♭2 (teal): dark and Spanish, great over an E pedal riff."
    case .lydian: "Major with a ♯4 (teal): bright and floating, the film-score sound."
    case .harmonicMinor: "Natural minor with a raised 7 (teal): the leading tone that makes V → i pull so hard. Neoclassical metal."
    case .phrygianDominant: "The 5th mode of harmonic minor: ♭2 and a major 3rd. The Middle-Eastern metal sound over an E pedal."
    }
  }

  /// The exercise, or nil if the shape doesn't fit on the neck.
  public func build(tuning: Tuning = .standard, maxFret: Int = Shapes.defaultMaxFret) -> PracticeExercise? {
    let spelled = Spelling.key(key, scale)
    guard let shape = Shapes.position(root: key, scale: scale, box: box, tuning: tuning, maxFret: maxFret, alt: alt) else { return nil }
    let notes = pattern.indices(shape.notes.count).map { shape.notes[$0] }
    let minorWord = [.minorPentatonic, .blues, .aeolian, .harmonicMinor].contains(scale) ? " minor" : ""
    let unit = scale.isPentatonicFamily ? "box" : "position"
    let knownEdge = box > 1 ? " It shares its lower notes with \(unit) \(box - 1): start from the notes you already know." : ""
    let displacement = pattern == .threes && notesPerBeat == 4
      ? " Here the groups of three run over 16ths, so the accent lands on a different note each beat (displacement)." : ""
    let npb = Double(notesPerBeat)
    return PracticeExercise(
      title: "\(spelled.root) \(Self.title(scale)) · \(shapeName)",
      chips: [
        .init(label: "Key", value: spelled.root + minorWord),
        .init(label: "Frets", value: "\(shape.lo)–\(shape.hi)"),
        .init(label: "Pattern", value: pattern.name),
        .init(label: "Rhythm", value: Tempo.rhythmName(npb)),
      ],
      how: pattern.how + displacement,
      why: Self.why(scale) + knownEdge,
      notes: notes,
      dots: shape.notes,
      notesPerBeat: npb,
      timed: true,
      keyPC: key,
      flat: spelled.flat,
      names: spelled.byPC,
      allowed: scale.pitchClasses(root: key),
      skill: skill,
      tempoKey: tempoKey,
      cues: pattern == .straight ? [Cues.all[3], Cues.all[0], Cues.all[6]] : [Cues.all[2], Cues.all[8], Cues.all[7]],
      lo: shape.lo,
      hi: shape.hi
    )
  }
}
