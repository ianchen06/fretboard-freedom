// The shapes guitarists play scales and chords in, computed from pitches (no hand-drawn fret
// patterns), so they're right in any key and any tuning. A port of web/js/scales.js.
//
// A shape is a list of notes in ascending pitch, low E string first.
// - position(root, scale, k): pentatonic box k (two notes per string, each string continuing the
//   scale where the string below stopped; box k starts on the k-th note of the minor pentatonic on
//   the low E string). Scales with more notes fill the same fret window: box k + the extra notes.
// - nps(root, scale, k, n): n notes on every string from the k-th scale note on the low E string.
// - arpeggio(root, chord, k): the chord tones inside the fret window of pentatonic box k.
// - triadVoicings(root, chord, set): close triads on three adjacent strings, all inversions.

/// A note of a shape: where it is, what it sounds, and what it is in the scale or chord.
public struct ShapeNote: Sendable, Hashable, Codable, Identifiable {
  public var string: Int
  public var fret: Int
  public var midi: Int
  /// Semitones above the root (0–11).
  public var semi: Int
  /// Degree label: "R", "♭3", "5" …
  public var label: String
  public var role: DegreeRole

  public var id: FretPosition { position }
  public var position: FretPosition { FretPosition(string: string, fret: fret) }

  public init(string: Int, fret: Int, midi: Int, semi: Int, label: String, role: DegreeRole) {
    self.string = string
    self.fret = fret
    self.midi = midi
    self.semi = semi
    self.label = label
    self.role = role
  }
}

public struct Shape: Sendable, Hashable {
  public var notes: [ShapeNote]
  /// Lowest and highest fret.
  public var lo: Int
  public var hi: Int
  /// How many octave placements fit on the neck.
  public var alternatives: Int
}

public struct TriadVoicing: Sendable, Hashable {
  public var inversion: Int
  public var notes: [ShapeNote]
  public var lo: Int
  public var hi: Int
}

public enum StringSet: String, Sendable, CaseIterable {
  case gbe, dgb, adg, ead
  public var strings: [Int] {
    switch self {
    case .gbe: [3, 2, 1]
    case .dgb: [4, 3, 2]
    case .adg: [5, 4, 3]
    case .ead: [6, 5, 4]
    }
  }
}

public enum Shapes {
  public static let pentatonic = [0, 3, 5, 7, 10]
  public static let defaultMaxFret = 19

  struct Raw: Hashable { var string: Int; var fret: Int; var midi: Int }
  struct Placement { var notes: [Raw]; var lo: Int; var hi: Int }

  static func pcs(_ root: Int, _ steps: [Int]) -> Set<Int> { Set(steps.map { Theory.mod12(root + $0) }) }

  static func nextPitch(_ pcs: Set<Int>, after p: Int) -> Int {
    for q in (p + 1)...(p + 12) where pcs.contains(Theory.mod12(q)) { return q }
    preconditionFailure("empty pitch-class set")
  }

  static func atOrAbove(_ pcs: Set<Int>, _ p: Int) -> Int {
    for q in p..<(p + 12) where pcs.contains(Theory.mod12(q)) { return q }
    preconditionFailure("empty pitch-class set")
  }

  static func span<S: Sequence>(_ frets: S) -> (lo: Int, hi: Int) where S.Element == Int {
    var lo = Int.max, hi = Int.min
    for f in frets { lo = min(lo, f); hi = max(hi, f) }
    return (lo, hi)
  }

  /// n consecutive scale pitches on each string, low E to high e.
  static func perString(_ pcs: Set<Int>, start: Int, n: Int, tuning: Tuning) -> [Raw] {
    var out: [Raw] = []
    var p = start
    for s in lowToHigh {
      for _ in 0..<n {
        out.append(Raw(string: s, fret: p - tuning.open(s), midi: p))
        p = nextPitch(pcs, after: p)
      }
    }
    return out
  }

  /// Every pitch of the set inside a fret window, ascending, one place each. A string takes pitches
  /// until the next one would pass the window's top fret; then the next string takes over. A string
  /// may reach one fret below the window (the usual stretch), and keeps a pitch rather than hand it to
  /// a string where it would sit below that.
  static func windowWalk(_ pcs: Set<Int>, lo: Int, hi: Int, tuning: Tuning) -> [Raw] {
    var out: [Raw] = []
    let floor = max(0, lo - 1)
    var p = atOrAbove(pcs, tuning.open(6) + lo)
    for s in lowToHigh {
      let nextOpen: Int? = s > 1 ? tuning.open(s - 1) : nil
      while true {
        let f = p - tuning.open(s)
        if f > hi, nextOpen.map({ p - $0 >= floor }) ?? true { break }
        if f > hi + 2 { break }
        out.append(Raw(string: s, fret: f, midi: p))
        p = nextPitch(pcs, after: p)
      }
    }
    return out
  }

  /// Octave placements of a shape that fit on the neck: off the open strings first, then lowest.
  static func placements(maxFret: Int, _ build: (Int) -> [Raw]) -> [Placement] {
    var out: [Placement] = []
    for o in [-24, -12, 0, 12, 24] {
      let notes = build(o)
      if notes.isEmpty { continue }
      let (lo, hi) = span(notes.map(\.fret))
      if lo >= 0 && hi <= maxFret { out.append(Placement(notes: notes, lo: lo, hi: hi)) }
    }
    out.sort { a, b in (a.lo >= 1) == (b.lo >= 1) ? a.lo < b.lo : a.lo >= 1 }
    return out
  }

  /// Minor pentatonic box k of `minorRoot`, placed on the neck, best first.
  static func boxPlacements(minorRoot: Int, box k: Int, tuning: Tuning, maxFret: Int) -> [Placement] {
    let set = pcs(minorRoot, pentatonic)
    let base = tuning.open(6) + Theory.mod12(minorRoot - tuning.open(6))
    return placements(maxFret: maxFret) { o in perString(set, start: base + pentatonic[k - 1] + o, n: 2, tuning: tuning) }
  }

  static func annotate(_ raw: [Raw], root: Int, scale: ScaleKind) -> [ShapeNote] {
    raw.map { n in
      let semi = Theory.mod12(n.midi - root)
      return ShapeNote(string: n.string, fret: n.fret, midi: n.midi, semi: semi,
                       label: Degrees.label(semi, scale: scale), role: Degrees.scaleRole(semi, scale: scale))
    }
  }

  static func annotate(_ raw: [Raw], root: Int, chord: ChordKind) -> [ShapeNote] {
    raw.map { n in
      let semi = Theory.mod12(n.midi - root)
      return ShapeNote(string: n.string, fret: n.fret, midi: n.midi, semi: semi,
                       label: Degrees.label(semi, chord: chord), role: Degrees.chordRole(semi))
    }
  }

  /// Scale position k (1–5): the pentatonic box, or a 7-note scale filling the box's fret window.
  /// nil if it doesn't fit below maxFret. `alt` picks another octave placement.
  public static func position(root: Int, scale: ScaleKind, box k: Int, tuning: Tuning = .standard,
                              maxFret: Int = defaultMaxFret, alt: Int = 0) -> Shape? {
    precondition((1...5).contains(k), "boxes are 1–5")
    let ref = scale.isMinor ? root : Theory.mod12(root - 3)
    let boxes = boxPlacements(minorRoot: ref, box: k, tuning: tuning, maxFret: maxFret)
    guard !boxes.isEmpty else { return nil }
    let box = boxes[min(alt, boxes.count - 1)]
    let set = pcs(root, scale.steps)
    let refSet = pcs(ref, pentatonic)
    let isBoxItself = scale.steps.count == 5 && scale.steps.allSatisfy { refSet.contains(Theory.mod12(root + $0)) }
    let raw = isBoxItself ? box.notes : windowWalk(set, lo: box.lo, hi: box.hi, tuning: tuning)
    let notes = annotate(raw, root: root, scale: scale)
    let (lo, hi) = span(notes.map(\.fret))
    if lo < 0 || hi > maxFret + 1 { return nil }
    return Shape(notes: notes, lo: lo, hi: hi, alternatives: boxes.count)
  }

  /// n-notes-per-string pattern k (1…number of scale notes).
  public static func nps(root: Int, scale: ScaleKind, pattern k: Int, perString n: Int = 3, tuning: Tuning = .standard,
                         maxFret: Int = defaultMaxFret, alt: Int = 0) -> Shape? {
    let set = pcs(root, scale.steps)
    let base = tuning.open(6) + Theory.mod12(root - tuning.open(6))
    let opts = placements(maxFret: maxFret) { o in perString(set, start: base + scale.steps[k - 1] + o, n: n, tuning: tuning) }
    guard !opts.isEmpty else { return nil }
    let pick = opts[min(alt, opts.count - 1)]
    return Shape(notes: annotate(pick.notes, root: root, scale: scale), lo: pick.lo, hi: pick.hi, alternatives: opts.count)
  }

  /// Chord tones in the window of minor pentatonic box k of `windowRoot` (default: the chord's root).
  public static func arpeggio(root: Int, chord: ChordKind, box k: Int, windowRoot: Int? = nil, tuning: Tuning = .standard,
                              maxFret: Int = defaultMaxFret, alt: Int = 0) -> Shape? {
    let boxes = boxPlacements(minorRoot: windowRoot ?? root, box: k, tuning: tuning, maxFret: maxFret)
    guard !boxes.isEmpty else { return nil }
    let w = boxes[min(alt, boxes.count - 1)]
    let notes = annotate(windowWalk(pcs(root, chord.steps), lo: w.lo, hi: w.hi, tuning: tuning), root: root, chord: chord)
    let (lo, hi) = span(notes.map(\.fret))
    if notes.isEmpty || lo < 0 || hi > maxFret + 1 { return nil }
    return Shape(notes: notes, lo: lo, hi: hi, alternatives: boxes.count)
  }

  /// Close-position triads on a string set: every inversion and fret, lowest first.
  public static func triadVoicings(root: Int, chord: ChordKind, on set: StringSet, tuning: Tuning = .standard,
                                   maxFret: Int = defaultMaxFret) -> [TriadVoicing] {
    let steps = Array(chord.steps.prefix(3))
    let strings = set.strings
    var out: [TriadVoicing] = []
    for inv in 0..<3 {
      let want = (0..<3).map { Theory.mod12(root + steps[(inv + $0) % 3]) }
      for f in 0...maxFret {
        let p0 = tuning.open(strings[0]) + f
        guard Theory.mod12(p0) == want[0] else { continue }
        let p1 = p0 + (Theory.mod12(want[1] - p0) == 0 ? 12 : Theory.mod12(want[1] - p0))
        let p2 = p1 + (Theory.mod12(want[2] - p1) == 0 ? 12 : Theory.mod12(want[2] - p1))
        let fr = [f, p1 - tuning.open(strings[1]), p2 - tuning.open(strings[2])]
        if fr.contains(where: { $0 < 0 || $0 > maxFret }) { continue }
        let (lo, hi) = span(fr)
        if hi - lo > 4 { continue }
        let raw = zip([p0, p1, p2], zip(strings, fr)).map { Raw(string: $1.0, fret: $1.1, midi: $0) }
        out.append(TriadVoicing(inversion: inv, notes: annotate(raw, root: root, chord: chord), lo: lo, hi: hi))
      }
    }
    return out.sorted { $0.lo < $1.lo }
  }

  /// Every scale note on one string between two frets.
  public static func oneString(root: Int, scale: ScaleKind, string s: Int, from: Int, to: Int, tuning: Tuning = .standard) -> [ShapeNote] {
    let set = pcs(root, scale.steps)
    let raw = (from...to).compactMap { f -> Raw? in
      let m = tuning.open(s) + f
      return set.contains(Theory.mod12(m)) ? Raw(string: s, fret: f, midi: m) : nil
    }
    return annotate(raw, root: root, scale: scale)
  }

  /// Every place of the scale on the whole neck (for the faded backdrop behind a shape).
  public static func wholeNeck(root: Int, scale: ScaleKind, tuning: Tuning = .standard, frets: ClosedRange<Int>) -> [ShapeNote] {
    lowToHigh.flatMap { oneString(root: root, scale: scale, string: $0, from: frets.lowerBound, to: frets.upperBound, tuning: tuning) }
  }
}
