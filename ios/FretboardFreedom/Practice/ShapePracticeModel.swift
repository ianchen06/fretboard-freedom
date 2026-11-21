// Shape practice: one shape as a sequence against the click. The mic (or a tap on the neck) feeds the
// sequence grader, the grader feeds the tempo ladder, and the run's grade goes into the learner.
// The same flow as "Learn a shape" on the web app's Scales page.
import Coach
import Foundation
import FretboardUI
import GuitarAudio
import MusicTheory
import Observation
import PracticeEngine

enum ShapePracticeMode: String {
  case boxes = "box"
  case arpeggios = "arp"

  var title: String { self == .boxes ? "Pentatonic boxes" : "Arpeggios" }
  var positionLabel: String { self == .boxes ? "Box" : "Position" }
  var positionSetting: String { self == .boxes ? "box.box" : "arp.position" }
  var patterns: [SequencePattern] {
    self == .boxes ? [.straight, .threes, .fours, .thirds] : [.straight, .threes]
  }

  func rhythms(for pattern: SequencePattern) -> [Int] {
    guard self == .arpeggios else { return pattern.rhythms }
    return pattern == .straight ? [2, 3, 4] : [3]
  }
}

@Observable
final class ShapePracticeModel {
  typealias Message = PracticeMessage

  struct Flash: Identifiable {
    let id = UUID()
    var dot: FretDot
  }

  // MARK: Settings (saved between launches)

  var key: Int { didSet { settingsChanged() } }
  var scale: ScaleKind { didSet { settingsChanged() } }
  var chord: ChordKind { didSet { settingsChanged() } }
  var position: Int { didSet { settingsChanged() } }
  var pattern: SequencePattern {
    didSet {
      if !rhythms.contains(notesPerBeat) { notesPerBeat = pattern.notesPerBeat } else { settingsChanged() }
    }
  }
  var notesPerBeat: Int { didSet { settingsChanged() } }
  var autoTempo = true { didSet { ladder?.automatic = autoTempo } }
  var showWholeNeck = true
  var noteNames = false
  /// The dots and tab show "?" until you find each note.
  var fromMemory = false

  // MARK: State

  private(set) var exercise: PracticeExercise?
  private(set) var bpm = 72
  private(set) var isRunning = false
  private(set) var musicStart: Double?
  private(set) var beatDuration = 0.5
  private(set) var pointer = 0
  private(set) var states: [TabStripView.NoteState] = []
  private(set) var flashes: [Flash] = []
  private(set) var message: Message?
  private(set) var passes: [SequenceGrader.PassResult] = []
  private(set) var cleanStreak = 0
  private(set) var cleanNeeded = 3
  private(set) var lastTempoChange: String?
  private(set) var revealed: Set<FretPosition> = []

  @ObservationIgnored private var grader: SequenceGrader?
  @ObservationIgnored private var ladder: TempoLadder?
  @ObservationIgnored private var startTask: Task<Void, Never>?
  /// Misses and wrong notes per target in this run, for the coach.
  @ObservationIgnored private var trouble: [Int: Int] = [:]
  @ObservationIgnored private var lastCoachAt: Date?

  let audio: GuitarAudioEngine
  let progress: ProgressStore
  let coach: PracticeCoach
  let mode: ShapePracticeMode
  let tuning = Tuning.standard

  init(mode: ShapePracticeMode, audio: GuitarAudioEngine, progress: ProgressStore, coach: PracticeCoach) {
    self.mode = mode
    self.audio = audio
    self.progress = progress
    self.coach = coach
    let d = UserDefaults.standard
    let keySetting = "\(mode.rawValue).key"
    key = d.object(forKey: keySetting) == nil ? 9 : Theory.mod12(d.integer(forKey: keySetting))
    scale = d.string(forKey: "box.scale").flatMap(ScaleKind.init) ?? .minorPentatonic
    chord = d.string(forKey: "arp.chord").flatMap(ChordKind.init) ?? .dominant7
    let savedPosition = d.integer(forKey: mode.positionSetting)
    position = (1...5).contains(savedPosition) ? savedPosition : 1
    let savedPattern = d.string(forKey: "\(mode.rawValue).pattern").flatMap(SequencePattern.init)
    let p = savedPattern.flatMap { mode.patterns.contains($0) ? $0 : nil } ?? .straight
    pattern = p
    let savedRhythm = d.integer(forKey: "\(mode.rawValue).npb")
    notesPerBeat = mode.rhythms(for: p).contains(savedRhythm) ? savedRhythm : p.notesPerBeat
    rebuild()
  }

  // MARK: Derived

  var rhythms: [Int] { mode.rhythms(for: pattern) }
  var keyName: String { name(of: key) }
  var mastery: Double { exercise.map { progress.learner.mastery($0.skill) } ?? 0 }
  var bestBPM: Int { max(exercise.map { progress.learner.best($0.tempoKey) } ?? 0, ladder?.cleanBPM ?? 0) }
  var frets: ClosedRange<Int> { 0...min(22, max(15, (exercise?.hi ?? 12) + 2)) }
  var window: ClosedRange<Int>? { exercise.map { $0.lo...$0.hi } }
  var nextNote: ShapeNote? { exercise.flatMap { pointer < $0.notes.count ? $0.notes[pointer] : nil } }

  /// All 12 roots, in the order of the circle of 4ths from C.
  var keys: [(pc: Int, name: String)] {
    Theory.circleOfFourths.compactMap(Theory.pitchClass).map { ($0, name(of: $0)) }
  }

  private func name(of root: Int) -> String {
    switch mode {
    case .boxes: Spelling.key(root, scale).root
    case .arpeggios: Spelling.chord(root: root, chord).root
    }
  }

  func label(for note: ShapeNote) -> String {
    noteNames ? (exercise?.name(note.midi) ?? Theory.noteName(note.midi)) : note.label
  }

  /// What the fretboard draws: nearby fingerings, the shape, the next note, and flashes.
  var dots: [FretDot] {
    guard let ex = exercise else { return [] }
    var out: [FretDot] = []
    let inShape = Set(ex.dots.map(\.position))
    if showWholeNeck {
      let neck = switch mode {
      case .boxes: Shapes.wholeNeck(root: key, scale: scale, tuning: tuning, frets: frets)
      case .arpeggios: Shapes.wholeNeck(root: key, chord: chord, tuning: tuning, frets: frets)
      }
      out += neck
        .filter { !inShape.contains($0.position) }
        .map { FretDot($0, style: .faded) }
    }
    let next = isRunning ? nextNote?.position : nil
    for n in ex.dots {
      let hiddenNow = fromMemory && !revealed.contains(n.position)
      if hiddenNow && n.position != next { continue }
      out.append(FretDot(n, style: n.position == next ? .next : .shape, label: hiddenNow ? "?" : label(for: n)))
    }
    out += flashes.map(\.dot)
    return out
  }

  // MARK: Settings

  func upAFourth() { key = Theory.mod12(key + 5) }
  func nextPosition() { position = position % 5 + 1 }
  func previousPosition() { position = (position + 3) % 5 + 1 }

  private func settingsChanged() {
    let d = UserDefaults.standard
    d.set(key, forKey: "\(mode.rawValue).key")
    switch mode {
    case .boxes: d.set(scale.rawValue, forKey: "box.scale")
    case .arpeggios: d.set(chord.rawValue, forKey: "arp.chord")
    }
    d.set(position, forKey: mode.positionSetting)
    d.set(pattern.rawValue, forKey: "\(mode.rawValue).pattern")
    d.set(notesPerBeat, forKey: "\(mode.rawValue).npb")
    let wasRunning = isRunning
    if wasRunning { stop() }
    rebuild()
    if wasRunning { start() }
  }

  private func rebuild() {
    switch mode {
    case .boxes:
      exercise = ShapeDrill(key: key, scale: scale, box: position, pattern: pattern, notesPerBeat: notesPerBeat).build(tuning: tuning)
    case .arpeggios:
      exercise = ArpeggioDrill(root: key, chord: chord, position: position, pattern: pattern, notesPerBeat: notesPerBeat).build(tuning: tuning)
    }
    bpm = exercise.map { progress.learner.tempo($0.tempoKey, notesPerBeat: $0.notesPerBeat) } ?? Tempo.startBPM(Double(notesPerBeat))
    resetRun()
    message = nil
    coach.clear()
  }

  private func resetRun() {
    pointer = 0
    states = Array(repeating: .pending, count: exercise?.notes.count ?? 0)
    passes = []
    trouble = [:]
    revealed = []
    lastTempoChange = nil
    grader = exercise.map { SequenceGrader($0) }
    cleanNeeded = grader?.cleanNeeded ?? 3
    cleanStreak = 0
    ladder = TempoLadder(bpm: bpm, notesPerBeat: Double(notesPerBeat), automatic: autoTempo)
  }

  // MARK: Transport

  func toggle() { isRunning ? stop() : start() }

  func start(listen: Bool = true) {
    guard exercise != nil, !isRunning else { return }
    resetRun()
    isRunning = true
    message = Message(kind: .info, title: "Count-in", detail: "Four clicks, then start on the first note.")
    startTask = Task {
      if listen && audio.micState != .listening { await audio.startMic() }
      guard !Task.isCancelled else { return }
      if !audio.isRunning { await audio.startOutput() }
      guard !Task.isCancelled else { return }
      startClock(countIn: true)
      coach.prewarm()
    }
  }

  func stop() {
    guard isRunning else { return }
    isRunning = false
    startTask?.cancel()
    startTask = nil
    audio.stopMetronome()
    musicStart = nil
    saveRun()
  }

  func faster() { setBPM(bpm + Tempo.step(Double(notesPerBeat))) }
  func slower() { setBPM(bpm - Tempo.step(Double(notesPerBeat))) }

  func setBPM(_ value: Int) {
    bpm = Tempo.clamp(value)
    ladder?.set(bpm: bpm)
    if isRunning { startClock(countIn: false) }
  }

  private func startClock(countIn: Bool) {
    beatDuration = 60 / Double(bpm)
    let startAt = audio.now() + 0.12
    musicStart = startAt + (countIn ? 4 * beatDuration : 0)
    audio.startMetronome(bpm: Double(bpm), at: startAt, beatsPerBar: 4)
  }

  /// The run's grade and tempo go into the learner, as on the web app.
  private func saveRun() {
    guard let exercise, let grader, let ladder else { return }
    if let score = grader.score() {
      progress.learner.update(exercise.skill, score: score, today: .today)
    }
    if !grader.passes.isEmpty || ladder.cleanBPM > 0 {
      progress.learner.saveTempo(exercise.tempoKey, bpm: ladder.bpm, cleanBPM: ladder.cleanBPM, struggled: ladder.struggled)
    }
    progress.save()
  }

  // MARK: Hearing notes

  /// A note from the mic. t: when it was played, on the host clock.
  func heard(_ event: NoteEvent) {
    played(event.midi, at: event.playedAt - audio.latency, tapped: false)
  }

  /// A tap on the neck plays the note and counts as played (no timing).
  func tapped(_ p: FretPosition) {
    let midi = tuning.midi(string: p.string, fret: p.fret)
    audio.pluck(midi: midi)
    played(midi, at: nil, tapped: true, place: p)
  }

  private func played(_ midi: Int, at t: Double?, tapped: Bool, place: FretPosition? = nil) {
    guard let ex = exercise else { return }
    guard isRunning, var g = grader else {
      // Idle: show where it probably was, nearest the shape.
      let p = place ?? likelyPlace(midi, near: ex.dots.first { $0.midi == midi }?.position ?? FretPosition(string: 3, fret: (ex.lo + ex.hi) / 2))
      if let p { flash(FretDot(p, label: noteLabel(midi), role: role(midi), style: ex.allowed.contains(Theory.mod12(midi)) ? .live : .outside)) }
      return
    }
    var dev: Double?
    if !tapped, let t, let start = musicStart, t >= start - beatDuration / 2 {
      let unit = beatDuration / Double(notesPerBeat)
      let k = ((t - start) / unit).rounded()
      dev = t - (start + k * unit)
    }
    let events = g.note(midi, deviation: dev)
    grader = g
    handle(events, midi: midi, place: place)
  }

  private func handle(_ events: [SequenceGrader.Event], midi: Int, place: FretPosition?) {
    guard let ex = exercise else { return }
    for e in events {
      switch e {
      case .hit(let i, _):
        states[i] = .hit
        let n = ex.notes[i]
        if fromMemory { revealed.insert(n.position) }
        flash(FretDot(n, style: .hit, label: label(for: n)))
      case .miss(let i):
        states[i] = .miss
        trouble[i, default: 0] += 1
      case .wrong(let i, let heard):
        let want = ex.notes[i]
        trouble[i, default: 0] += 1
        if let p = place ?? likelyPlace(heard, near: want.position) {
          flash(FretDot(p, label: noteLabel(heard), role: .other, style: .wrong))
        }
        message = Message(kind: .bad, title: "Heard \(noteLabel(heard))",
                          detail: "Next is \(ex.name(want.midi)) (\(want.label)), \(tuning.stringLongName(want.string)) string fret \(want.fret).")
      case .pass(let result):
        onPass(result)
      case .arm, .under:
        break
      }
    }
    pointer = grader?.index ?? 0
  }

  private func onPass(_ result: SequenceGrader.PassResult) {
    guard var g = grader, var l = ladder else { return }
    passes.append(result)
    states = Array(repeating: .pending, count: states.count)
    if fromMemory { revealed = [] }
    let verdict = l.record(result, grader: &g)
    grader = g
    ladder = l
    cleanStreak = g.cleanStreak
    lastTempoChange = nil
    switch verdict {
    case .up(let from, let to):
      lastTempoChange = "went up from \(from) to \(to) bpm"
      message = Message(kind: .ok, title: "Clean ×\(g.cleanNeeded)", detail: "\(result.summary). Up to \(to) bpm (from \(from)).")
      bpm = to
      startClock(countIn: false)
    case .down(_, let to):
      lastTempoChange = "came down to \(to) bpm after two rough passes"
      message = Message(kind: .warn, title: "Slowing down", detail: "\(result.summary). Two rough passes: \(to) bpm. Accuracy first.")
      bpm = to
      startClock(countIn: false)
    case .clean(let streak, let needed):
      message = Message(kind: .ok, title: "Clean pass", detail: result.summary + (needed > 1 ? " · \(streak)/\(needed) in a row" : ""))
    case .rough:
      message = Message(kind: result.accuracy >= 0.75 ? .warn : .bad, title: "Pass",
                        detail: result.summary + ((result.timingMs ?? 0) > 60 ? " · lock in with the click" : ""))
    }
    // A tip after a tempo change, or every 20 s of playing.
    if lastTempoChange != nil || lastCoachAt.map({ Date().timeIntervalSince($0) > 20 }) ?? true {
      askCoach()
    }
  }

  // MARK: Coach

  func askCoach() {
    guard let report = makeReport() else { return }
    lastCoachAt = Date()
    Task { await coach.reflect(on: report) }
  }

  func makeReport() -> PracticeReport? {
    guard let ex = exercise, let g = grader else { return nil }
    let top = trouble.sorted { $0.value > $1.value }.filter { $0.value >= 2 }.prefix(2)
    let notes = top.map { i, count in
      let n = ex.notes[i]
      return PracticeReport.TroubleNote(degree: n.label, name: ex.name(n.midi),
                                        place: "\(tuning.stringLongName(n.string)) string fret \(n.fret)", count: count)
    }
    return PracticeReport(
      exercise: ex.title, pattern: "\(pattern.name) in \(Tempo.rhythmName(Double(notesPerBeat)))", bpm: bpm,
      passes: passes.count, accuracies: passes.suffix(4).map(\.accuracy),
      timingMs: passes.last?.timingMs, cleanStreak: g.cleanStreak, cleanNeeded: g.cleanNeeded,
      tempoChange: lastTempoChange, bestBPM: bestBPM, trouble: notes, cues: ex.cues)
  }

  #if DEBUG
  /// Debug only (launch argument -FFDemo): play the sequence in time straight into the grader, with
  /// a few wrong notes, so the whole loop runs without a guitar. The mic stays closed.
  func runDemo(seconds: Double = 40, accuracy: Double = 0.97) {
    audio.clickVolume = 0
    start(listen: false)
    Task {
      let end = Date().addingTimeInterval(seconds)
      var base: Double?
      var i = 0
      while isRunning, Date() < end {
        guard let ex = exercise, let start = musicStart else {
          try? await Task.sleep(for: .milliseconds(10))
          continue
        }
        if base != start { base = start; i = 0 } // the tempo changed: the grid restarted
        let unit = beatDuration / Double(notesPerBeat)
        let due = start + Double(i) * unit
        let wait = due - audio.now()
        if wait > 0 { try? await Task.sleep(for: .seconds(wait)) }
        guard isRunning, musicStart == base else { continue }
        let want = ex.notes[pointer].midi
        played(Double.random(in: 0...1) < accuracy ? want : want + 1, at: audio.now(), tapped: false)
        i += 1
      }
      stop()
    }
  }
  #endif

  // MARK: Helpers

  private func noteLabel(_ midi: Int) -> String { exercise?.name(midi) ?? Theory.noteName(midi) }

  private func role(_ midi: Int) -> DegreeRole {
    let interval = Theory.mod12(midi - key)
    return switch mode {
    case .boxes: Degrees.scaleRole(interval, scale: scale)
    case .arpeggios: Degrees.chordRole(interval)
    }
  }

  /// The mic hears pitch, not strings: show a note at the place nearest where the hand is.
  private func likelyPlace(_ midi: Int, near ref: FretPosition) -> FretPosition? {
    tuning.places(midi: midi, from: 0, to: frets.upperBound)
      .min { a, b in
        Double(abs(a.fret - ref.fret)) + Double(abs(a.string - ref.string)) * 0.7
          < Double(abs(b.fret - ref.fret)) + Double(abs(b.string - ref.string)) * 0.7
      }
  }

  private func flash(_ dot: FretDot) {
    let f = Flash(dot: dot)
    flashes.append(f)
    if flashes.count > 12 { flashes.removeFirst(flashes.count - 12) }
    Task {
      try? await Task.sleep(for: .milliseconds(900))
      flashes.removeAll { $0.id == f.id }
    }
  }
}
