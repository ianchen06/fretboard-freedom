import MusicTheory

/// A chord's tones within one of the five pentatonic positions, played as a looping sequence.
public struct ArpeggioDrill: Sendable, Hashable {
  public let root: Int
  public let chord: ChordKind
  public let position: Int
  public let pattern: SequencePattern
  public let notesPerBeat: Int

  public init(root: Int, chord: ChordKind, position: Int, pattern: SequencePattern = .straight, notesPerBeat: Int? = nil) {
    self.root = Theory.mod12(root)
    self.chord = chord
    self.position = position
    self.pattern = pattern
    self.notesPerBeat = notesPerBeat ?? pattern.notesPerBeat
  }

  /// Skill and tempo keys match the web app's arpeggio exercises.
  public var skill: String { "arp:\(chord.rawValue):\(position)" }
  public var tempoKey: String { "\(skill):\(pattern.rawValue):\(notesPerBeat)" }

  public func build(tuning: Tuning = .standard, maxFret: Int = Shapes.defaultMaxFret) -> PracticeExercise? {
    guard (1...5).contains(position),
          let shape = Shapes.arpeggio(root: root, chord: chord, box: position, tuning: tuning, maxFret: maxFret),
          shape.notes.count >= 3 else { return nil }
    let notes = pattern.indices(shape.notes.count).map { shape.notes[$0] }
    guard !notes.isEmpty else { return nil }

    let spelled = Spelling.chord(root: root, chord)
    let chordName = spelled.root + chord.symbol
    let formula = chord.steps.map { Degrees.label($0, chord: chord) }.joined(separator: "–")
    let rhythm = Double(notesPerBeat)
    return PracticeExercise(
      title: "\(chordName) arpeggio · position \(position)",
      chips: [
        .init(label: "Chord", value: "\(chordName) (\(formula))"),
        .init(label: "Frets", value: "\(shape.lo)–\(shape.hi)"),
        .init(label: "Pattern", value: pattern.name),
        .init(label: "Rhythm", value: Tempo.rhythmName(rhythm)),
      ],
      how: "Play the chord tones one at a time (\(formula)). " + pattern.how +
        " If consecutive notes share a fret on adjacent strings, roll your fingertip from one string to the next.",
      why: "Play this over \(chordName) to hear how each degree sounds against the root.",
      notes: notes,
      dots: shape.notes,
      notesPerBeat: rhythm,
      timed: true,
      keyPC: root,
      flat: spelled.flat,
      names: spelled.byPC,
      allowed: Set(spelled.byPC.keys),
      skill: skill,
      tempoKey: tempoKey,
      cues: ["Mute each note as you move to the next string.", Cues.all[3], Cues.all[0]],
      lo: shape.lo,
      hi: shape.hi
    )
  }
}
