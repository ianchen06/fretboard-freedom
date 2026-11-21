// Find any note (Part 3 of the deck): one note on every string, or flash cards, free or against the
// deck's four metronome stages. The mic (or a tap on the neck) feeds the drill, the drill's events
// drive the card, the neck and the speed map. The same flow as web/js/app.js.
import Foundation
import FretboardUI
import GuitarAudio
import MusicTheory
import Observation
import PracticeEngine

@Observable
final class FindNoteModel {
  enum Phase { case idle, countIn, running, done }

  /// How the target card looks.
  enum CardState { case idle, countIn, active, hit, miss, done, clean }

  /// Which note "One note everywhere" asks for.
  enum NoteChoice: Hashable {
    case circle, random, pc(Int)

    init?(rawValue: String) {
      switch rawValue {
      case "circle": self = .circle
      case "random": self = .random
      default:
        guard let pc = Int(rawValue), (0..<12).contains(pc) else { return nil }
        self = .pc(pc)
      }
    }

    var rawValue: String {
      switch self {
      case .circle: "circle"
      case .random: "random"
      case .pc(let pc): String(pc)
      }
    }
  }

  enum FretRange: String, CaseIterable, Identifiable {
    case all = "0-12", low = "0-5", high = "5-12"
    var id: String { rawValue }
    var frets: ClosedRange<Int> {
      switch self {
      case .all: 0...12
      case .low: 0...5
      case .high: 5...12
      }
    }
    var name: String { "\(frets.lowerBound)–\(frets.upperBound)" }
  }

  struct Flash: Identifiable {
    let id = UUID()
    var dot: FretDot
  }

  struct Tip: Identifiable {
    enum Kind { case star, warn, plain }
    let id = UUID()
    var kind: Kind
    var text: AttributedString
  }

  // MARK: Settings (saved between launches)

  var mode: FindNoteMode { didSet { settingsChanged() } }
  var noteChoice: NoteChoice { didSet { settingsChanged() } }
  var direction: FindNoteDirection { didSet { settingsChanged() } }
  var notes: FindNoteNotes { didSet { settingsChanged() } }
  var strings: Set<Int> { didSet { settingsChanged() } }
  var count: Int { didSet { settingsChanged() } }
  var pace: FindNotePace { didSet { settingsChanged() } }
  var range: FretRange { didSet { settingsChanged() } }
  var tuning: Tuning { didSet { settingsChanged() } }
  /// Only the octave on the target string counts.
  var strictOctave: Bool { didSet { settingsChanged() } }
  /// The first hint after 5 s (Free pace only).
  var autoHint: Bool { didSet { settingsChanged() } }
  /// Flash cards pick slow and missed notes more often.
  var weakSpots: Bool { didSet { settingsChanged() } }

  // MARK: State

  private(set) var phase: Phase = .idle
  private(set) var drill: FindNoteDrill?
  private(set) var card: CardState = .idle
  private(set) var message: PracticeMessage?
  private(set) var roundDots: [FretDot] = []
  private(set) var hintDots: [FretDot] = []
  private(set) var flashes: [Flash] = []
  private(set) var summary: FindNoteDrill.Summary?
  private(set) var resultKicker = ""
  private(set) var resultTitle = ""
  private(set) var tips: [Tip] = []
  /// Seconds per click on a clocked pace, for the count-in and the beat lights.
  private(set) var beat: Double?
  /// Bumped on every wrong note and every find, for the card's nudge and flash.
  private(set) var wrongCount = 0
  private(set) var hitCount = 0
  private(set) var progress: FindNoteProgress

  @ObservationIgnored private var loop: Task<Void, Never>?
  @ObservationIgnored private var round = 0
  @ObservationIgnored private var ignoreMicUntil = 0.0

  let audio: GuitarAudioEngine

  init(audio: GuitarAudioEngine) {
    self.audio = audio
    let d = UserDefaults.standard
    mode = d.string(forKey: "find.mode").flatMap(FindNoteMode.init) ?? .everywhere
    noteChoice = d.string(forKey: "find.note").flatMap(NoteChoice.init) ?? .circle
    direction = d.string(forKey: "find.direction").flatMap(FindNoteDirection.init) ?? .upBack
    notes = d.string(forKey: "find.notes").flatMap(FindNoteNotes.init) ?? .naturals
    let saved = Set((d.array(forKey: "find.strings") as? [Int] ?? []).filter { (1...6).contains($0) })
    strings = saved.isEmpty ? Set(1...6) : saved
    count = d.object(forKey: "find.count") as? Int ?? 20
    pace = d.string(forKey: "find.pace").flatMap(FindNotePace.init) ?? .free
    range = d.string(forKey: "find.range").flatMap(FretRange.init) ?? .all
    tuning = d.string(forKey: "find.tuning").flatMap { id in Tuning.all.first { $0.id == id } } ?? .standard
    strictOctave = d.object(forKey: "find.strictOctave") as? Bool ?? true
    autoHint = d.object(forKey: "find.autoHint") as? Bool ?? false
    weakSpots = d.object(forKey: "find.weakSpots") as? Bool ?? true
    progress = FindNoteProgress.load()
  }

  // MARK: Derived

  var isPlaying: Bool { phase == .countIn || phase == .running }
  var frets: ClosedRange<Int> { range.frets }
  var current: FindNoteTarget? { phase == .running ? drill?.current : nil }
  var streakKey: String { FindNoteProgress.streakKey(mode, pace) }
  var streak: Int { progress.streaks[streakKey] ?? 0 }

  /// The note "One note everywhere" will ask for next on the circle.
  var circleNote: String { Theory.circleOfFourths[progress.circle % 12] }

  /// After a round of the circle: the note after this one.
  var nextNoteName: String? {
    guard phase == .done, let d = drill, d.config.mode == .everywhere, noteChoice == .circle else { return nil }
    return Theory.circleOfFourths[(progress.circle + 1) % 12]
  }

  var noteChoiceName: String {
    switch noteChoice {
    case .circle: "Circle of 4ths: \(circleNote)"
    case .random: "Random note"
    case .pc(let pc): Theory.spellings(pc).joined(separator: " / ")
    }
  }

  var stringsName: String {
    strings.count == 6 ? "All" : lowToHigh.filter(strings.contains).map(tuning.stringName).joined(separator: " ")
  }

  /// What the neck draws: the speed map between rounds, this round's notes and hints during one.
  var dots: [FretDot] {
    (phase == .idle ? speedMap : hintDots + roundDots) + flashes.map(\.dot)
  }

  var highlightString: Int? { current?.string }

  /// One dot per place on the neck, colored by your average time for that string and note.
  var speedMap: [FretDot] {
    highToLow.flatMap { s in
      frets.map { f in
        let pc = tuning.pitchClass(string: s, fret: f)
        let e = progress.stats.entry(tuning: tuning.id, string: s, pc: pc)
        return FretDot(FretPosition(string: s, fret: f), label: Theory.noteName(pc, preferFlat: tuning.flat), role: .other,
                       style: .heat(NoteSpeed(ms: e?.ema).map(FretDot.HeatTone.init)))
      }
    }
  }

  /// String-and-note pairs in the fret range: how many there are, how many you've practiced, how many are under 2 s.
  var speedMapCounts: (cells: Int, seen: Int, fast: Int) {
    var cells = Set<String>(), seen = 0, fast = 0
    for s in highToLow {
      for f in frets {
        let pc = tuning.pitchClass(string: s, fret: f)
        guard cells.insert("\(s):\(pc)").inserted else { continue }
        if let ema = progress.stats.entry(tuning: tuning.id, string: s, pc: pc)?.ema {
          seen += 1
          if ema < FindNoteDrill.goalMs { fast += 1 }
        }
      }
    }
    return (cells.count, seen, fast)
  }

  var boardTitle: String {
    switch phase {
    case .idle: "Your speed map"
    case .done: "This round"
    case .countIn, .running:
      if let d = drill, d.config.mode == .everywhere { "Every \(d.config.names[0]) from fret \(frets.lowerBound) to \(frets.upperBound)" }
      else { "Flash cards" }
    }
  }

  var modeHelp: String {
    mode == .everywhere
      ? "Find one note on every string, low E to high e and back, saying its name each time. The deck’s best two-minute drill."
      : "A note and a string, at random. Read it, find it, play it. Checkpoint: 20 cards, each under 2 seconds."
  }

  var paceHelp: String {
    guard let bpm = pace.bpm, let clicks = pace.clicks else {
      return "No metronome. Take the time you need; every note is timed against the 2-second checkpoint."
    }
    let each = clicks == 1 ? "one note every click" : "one note every \(clicks) clicks"
    return "\(bpm) bpm, \(each). Don’t stop for misses. Move up a stage after 3 clean rounds in a row\(streak > 0 ? " (you have \(streak))" : "")."
  }

  // MARK: Settings

  func toggleString(_ s: Int) {
    if strings.contains(s) {
      if strings.count > 1 { strings.remove(s) } // keep at least one
    } else {
      strings.insert(s)
    }
  }

  private func settingsChanged() {
    let d = UserDefaults.standard
    d.set(mode.rawValue, forKey: "find.mode")
    d.set(noteChoice.rawValue, forKey: "find.note")
    d.set(direction.rawValue, forKey: "find.direction")
    d.set(notes.rawValue, forKey: "find.notes")
    d.set(strings.sorted(), forKey: "find.strings")
    d.set(count, forKey: "find.count")
    d.set(pace.rawValue, forKey: "find.pace")
    d.set(range.rawValue, forKey: "find.range")
    d.set(tuning.id, forKey: "find.tuning")
    d.set(strictOctave, forKey: "find.strictOctave")
    d.set(autoHint, forKey: "find.autoHint")
    d.set(weakSpots, forKey: "find.weakSpots")
    // A new drill: back to the speed map (the View menu's toggles apply from the next round).
    if phase == .done { backToIdle() } else if phase == .idle { message = nil }
  }

  func resetSpeedMap() {
    progress.stats = NoteStats()
    progress.streaks = [:]
    progress.save()
    if phase == .done { backToIdle() }
  }

  // MARK: Transport

  func buildConfig() -> FindNoteConfig {
    var pc = 0
    var names: [String] = []
    switch noteChoice {
    case .circle:
      let name = circleNote
      pc = Theory.pitchClass(name) ?? 0
      names = Theory.spellings(pc, preferFlat: name.contains("♭"))
    case .random:
      pc = Int.random(in: 0..<12)
      names = Theory.spellings(pc, preferFlat: Bool.random())
    case .pc(let p):
      pc = p
      names = Theory.spellings(p)
    }
    return FindNoteConfig(mode: mode, pc: pc, names: names, direction: direction, notes: notes,
                          strings: lowToHigh.filter(strings.contains), count: count, pace: pace, frets: frets,
                          tuning: tuning, strictOctave: strictOctave, autoHint: autoHint, weakSpots: weakSpots)
  }

  /// Start (or start again). listen: open the mic first.
  func start(listen: Bool = true) {
    guard !isPlaying else { return }
    let d = FindNoteDrill(config: buildConfig(), stats: progress.stats)
    guard !d.targets.isEmpty else {
      message = PracticeMessage(kind: .warn, title: "Nothing to play", detail: "No notes fit those strings and frets. Widen the fret range.")
      return
    }
    round += 1
    let thisRound = round
    drill = d
    roundDots = []
    hintDots = []
    flashes = []
    summary = nil
    tips = []
    message = nil
    beat = pace.bpm.map { 60 / Double($0) }
    phase = .countIn
    card = .countIn
    Task {
      if listen && audio.micState != .listening { await audio.startMic() }
      if !audio.isRunning { await audio.startOutput() }
      guard round == thisRound, phase == .countIn else { return }
      let now = audio.now()
      if let bpm = pace.bpm, let clicks = pace.clicks, let beat {
        let startAt = now + 0.15
        audio.startMetronome(bpm: Double(bpm), at: startAt, beatsPerBar: clicks >= 2 ? clicks : 4)
        drill?.begin(at: startAt + 4 * beat)
      } else {
        drill?.begin(at: now + 0.7)
      }
      runLoop()
    }
  }

  func stop() {
    guard isPlaying, var d = drill else { return }
    let events = d.stop()
    drill = d
    handle(events)
  }

  func hint() { apply { $0.hint() } }
  func skip() { apply { $0.skip(now: audio.now()) } }

  func nextNote() {
    guard nextNoteName != nil else { return }
    progress.circle = (progress.circle + 1) % 12
    progress.save()
    start()
  }

  /// From the results back to the speed map.
  func backToIdle() {
    if isPlaying { stop() }
    loop?.cancel()
    audio.stopMetronome()
    phase = .idle
    drill = nil
    card = .idle
    message = nil
    roundDots = []
    hintDots = []
    summary = nil
    tips = []
  }

  /// Seconds left in the count-in, as clicks (4, 3, 2, 1), on a clocked pace.
  func countInLeft(now: Double) -> Int? {
    guard phase == .countIn, let beat, let d = drill, d.state == .countIn else { return nil }
    let left = Int(((d.t0 - now) / beat - 1e-6).rounded(.up))
    return (1...4).contains(left) ? left : nil
  }

  private func runLoop() {
    loop?.cancel()
    loop = Task { [weak self] in
      while !Task.isCancelled {
        guard let self, self.isPlaying else { return }
        self.apply { $0.tick(self.audio.now()) }
        try? await Task.sleep(for: .milliseconds(15))
      }
    }
  }

  /// Run one step of the drill and react to what happened. Writes the drill back only if it changed,
  /// so the 60 Hz tick doesn't redraw the screen for nothing.
  private func apply(_ step: (inout FindNoteDrill) -> [FindNoteDrill.Event]) {
    guard var d = drill else { return }
    let events = step(&d)
    if d != drill { drill = d }
    handle(events)
  }

  // MARK: Hearing notes

  /// A note from the mic.
  func heard(_ event: NoteEvent) {
    let now = audio.now()
    guard now >= ignoreMicUntil else { return } // the pluck of a tap, ringing
    apply { $0.hear(midi: event.midi, playedAt: event.playedAt - audio.latency, now: now) }
  }

  /// A tap on the neck plays the note and answers with its string.
  func tapped(_ p: FretPosition) {
    let midi = tuning.midi(string: p.string, fret: p.fret)
    audio.pluck(midi: midi)
    let now = audio.now()
    ignoreMicUntil = now + 1.3 // don't let the mic hear the pluck and count it again
    apply { $0.hear(midi: midi, string: p.string, playedAt: now, now: now) }
  }

  private func handle(_ events: [FindNoteDrill.Event]) {
    for e in events {
      switch e {
      case .target(let i): onTarget(i)
      case .hit(let i): onHit(i)
      case .wrong(let i, let midi, let string, let j): onWrong(i, midi: midi, string: string, j)
      case .miss(let i): onMiss(i)
      case .hint(let i, let level): onHint(i, level: level)
      case .done(let s): onDone(s)
      }
    }
  }

  private func target(_ i: Int) -> FindNoteTarget? { drill.flatMap { $0.targets.indices.contains(i) ? $0.targets[i] : nil } }
  private func long(_ s: Int) -> String { tuning.stringLongName(s) }

  private func onTarget(_ i: Int) {
    phase = .running
    hintDots = []
    if drill?.config.mode == .flash {
      // Let the last answer linger briefly.
      for d in roundDots { flash(d, for: 1.2) }
      roundDots = []
    }
    card = .active
  }

  private func onHit(_ i: Int) {
    guard let tg = target(i), let fret = tg.fret, let ms = tg.ms else { return }
    progress.stats.record(tuning: tuning.id, string: tg.string, pc: tg.pc, ms: ms)
    progress.save()
    roundDots.append(FretDot(FretPosition(string: tg.string, fret: fret), label: tg.name, role: .root, style: .found))
    let goal = ms < FindNoteDrill.goalMs ? "" : " (goal: under 2 s)"
    message = PracticeMessage(kind: .ok, title: "✓ \(tg.name)", detail: "\(long(tg.string).capitalizedFirst) string, fret \(fret) · \(secs(ms)) s\(goal)")
    if drill?.index == i { card = .hit }
    hitCount += 1
  }

  private func onWrong(_ i: Int, midi: Int, string: Int?, _ j: FindNoteDrill.Judgement) {
    guard let tg = target(i) else { return }
    let flat = tg.name.contains("♭")
    let heard = Theory.midiLabel(Double(midi), preferFlat: flat)
    let text: String
    switch j {
    case .wrongString:
      text = "That’s the \(long(string ?? tg.string)) string. Find it on the \(long(tg.string)) string."
    case .wrongOctave:
      text = "Right note, wrong octave: that \(tg.name) isn’t on the \(long(tg.string)) string."
    case .wrongNote(_, let off?) where off != 0:
      text = "If you’re on the \(long(tg.string)) string, that’s \(abs(off)) fret\(abs(off) > 1 ? "s" : "") too \(off < 0 ? "low" : "high")."
    default:
      text = "Not it. Keep looking."
    }
    message = PracticeMessage(kind: .warn, title: "Heard \(heard)", detail: text)
    if case .wrongNote(let f?, _) = j {
      // Gray, so it doesn't look like a missed note's red ring.
      flash(FretDot(FretPosition(string: tg.string, fret: f), label: Theory.noteName(midi, preferFlat: flat), role: .other, style: .outside), for: 1.4)
    }
    wrongCount += 1
  }

  private func onMiss(_ i: Int) {
    guard let tg = target(i) else { return }
    progress.stats.record(tuning: tuning.id, string: tg.string, pc: tg.pc, ms: nil)
    progress.save()
    for f in tg.frets {
      roundDots.append(FretDot(FretPosition(string: tg.string, fret: f), label: tg.name, role: .root, style: .missed))
    }
    let place = tg.frets.count > 1 ? "frets \(tg.frets.map(String.init).joined(separator: " or "))" : "fret \(tg.frets[0])"
    message = PracticeMessage(kind: .bad, title: tg.status == .skip ? "Skipped" : "Missed",
                              detail: "\(tg.name) on the \(long(tg.string)) string is at \(place).")
    if drill?.index == i { card = .miss }
  }

  private func onHint(_ i: Int, level: Int) {
    guard let d = drill, let tg = target(i) else { return }
    hintDots = d.hintMarks(for: tg, level: level).map {
      FretDot($0.position, label: $0.label, role: .root, style: $0.kind == .anchor ? .anchor : .reveal)
    }
    if level == 1 {
      message = tg.string == 6 || tg.string == 5
        ? PracticeMessage(kind: .hint, title: "Hint",
                          detail: "Landmarks on the \(long(tg.string)) string. Count frets from the nearest one (1 fret = 1 half step; no ♯ between B–C and E–F).")
        : PracticeMessage(kind: .hint, title: "Hint",
                          detail: "Your anchors on the E and A strings. Carry one up with an octave shape: 2 strings up, 2 frets up (3 if you cross the B string).")
    } else {
      let place = tg.frets.count > 1 ? "fret \(tg.frets.map(String.init).joined(separator: " or "))" : "fret \(tg.frets[0])"
      message = PracticeMessage(kind: .hint, title: "Shown", detail: "It’s at \(place). Play it and say the name.")
    }
  }

  private func onDone(_ sum: FindNoteDrill.Summary) {
    loop?.cancel()
    audio.stopMetronome()
    guard let d = drill else { return }
    if sum.aborted && sum.played == 0 {
      backToIdle()
      return
    }
    phase = .done
    hintDots = []
    // The neck: this round's notes, colored by speed.
    roundDots = d.targets.flatMap { t -> [FretDot] in
      switch t.status {
      case .hit:
        guard let fret = t.fret else { return [] }
        return [FretDot(FretPosition(string: t.string, fret: fret), label: t.name, role: .root,
                        style: .heat(NoteSpeed(ms: t.ms).map(FretDot.HeatTone.init)))]
      case .miss, .skip:
        return t.frets.map { FretDot(FretPosition(string: t.string, fret: $0), label: t.name, role: .root, style: .missed) }
      case .pending, .active:
        return []
      }
    }
    let cfg = d.config
    let key = FindNoteProgress.streakKey(cfg.mode, cfg.pace)
    if !sum.aborted {
      progress.streaks[key] = sum.clean ? (progress.streaks[key] ?? 0) + 1 : 0
      progress.history.append(.init(at: ISO8601DateFormatter().string(from: Date()), mode: cfg.mode.rawValue, pace: cfg.pace.rawValue,
                                    note: cfg.mode == .everywhere ? cfg.names[0] : nil, total: sum.total, hits: sum.hits, avgMs: sum.avgMs))
      progress.history = Array(progress.history.suffix(50))
    }
    progress.save()
    summary = sum
    card = sum.clean ? .clean : .done
    message = nil
    let what = cfg.mode == .everywhere ? "One note everywhere · \(cfg.names[0])" : "Flash cards"
    resultKicker = sum.aborted ? "Round stopped" : "\(what) · \(cfg.pace.label)"
    resultTitle = sum.aborted ? "\(sum.hits) of \(sum.played) found before you stopped"
      : sum.clean && sum.underGoal == sum.total ? "Clean round, every note under 2 seconds."
      : sum.clean ? "Clean round."
      : "\(sum.hits) of \(sum.total) found."
    tips = makeTips(sum, cfg: cfg, streak: progress.streaks[key] ?? 0)
  }

  private func makeTips(_ sum: FindNoteDrill.Summary, cfg: FindNoteConfig, streak n: Int) -> [Tip] {
    var tips: [Tip] = []
    func add(_ kind: Tip.Kind, _ markdown: String) {
      tips.append(Tip(kind: kind, text: (try? AttributedString(markdown: markdown)) ?? AttributedString(markdown)))
    }
    let pace = cfg.pace
    if sum.clean && sum.underGoal == sum.total {
      add(.star, "Checkpoint pace: every note in under 2 seconds. Keep it there for a week, then make it harder.")
    }
    if pace.bpm != nil && !sum.aborted {
      if sum.clean && n >= 3, let next = pace.next {
        add(.star, "\(n) clean rounds in a row at \(pace.label). Move up to **\(next.label)** (\(next.short)).")
      } else if sum.clean && n >= 3 {
        add(.star, "\(n) clean rounds at Stage 4. You’ve hit the Part 3 checkpoint for this drill.")
      } else if sum.clean {
        add(.plain, "Clean rounds in a row at \(pace.label): **\(n) of 3**.")
      } else {
        add(.warn, "Streak reset. You need 3 clean rounds in a row (no misses, no hints) to move up from \(pace.label).")
      }
    } else if pace.bpm == nil && !sum.aborted && sum.clean && (sum.avgMs ?? .max) < FindNoteDrill.goalMs {
      add(.plain, "You’re ready for the metronome: try **Stage 1** (40 bpm, 4 clicks per note).")
    }
    if let s = sum.slowestString, let ms = sum.slowestMs {
      add(.plain, "Slowest string: **\(long(s))** (\(secs(ms)) s average). Give it its own day of string-by-string work.")
    }
    if !sum.misses.isEmpty {
      let list = sum.misses.prefix(4).map { "\($0.name) on \(long($0.string)) (fret \($0.frets.map(String.init).joined(separator: "/")))" }
      add(.warn, "Missed: \(list.joined(separator: ", "))\(sum.misses.count > 4 ? "…" : ""). The dashed red rings on the neck show where they are.")
    }
    if sum.hints > 0 {
      add(.plain, "You used a hint \(sum.hints) time\(sum.hints > 1 ? "s" : ""). Next round, try the 3-step method first: anchor, octave shape, name it.")
    }
    if sum.slips >= 3 {
      add(.plain, "Lots of wrong notes. Slow down: think first, then play. Finding it in your head before you play is the skill you’re building.")
    }
    return tips
  }

  // MARK: Helpers

  private func flash(_ dot: FretDot, for seconds: Double) {
    let f = Flash(dot: dot)
    flashes.append(f)
    if flashes.count > 16 { flashes.removeFirst(flashes.count - 16) }
    Task {
      try? await Task.sleep(for: .seconds(seconds))
      flashes.removeAll { $0.id == f.id }
    }
  }

  #if DEBUG
  /// Debug only (launch argument -FFDemo): answer the cards straight into the drill, taking 0.6–2.8 s
  /// each, with a wrong note now and then, so the whole loop runs without a guitar. The mic stays closed.
  func runDemo() {
    audio.clickVolume = 0
    start(listen: false)
    Task {
      var answered = -1
      while phase == .countIn || phase == .running {
        try? await Task.sleep(for: .milliseconds(20))
        guard phase == .running, let d = drill, let tg = d.current, tg.status == .active, d.index != answered else { continue }
        answered = d.index
        let limit = (d.window ?? 3.2) * 0.85
        try? await Task.sleep(for: .seconds(Double.random(in: 0.6...max(0.7, limit))))
        guard drill?.index == answered, drill?.current?.status == .active else { continue }
        if Double.random(in: 0...1) < 0.2, let f = tg.frets.first {
          let wrong = tuning.midi(string: tg.string, fret: f) + (Bool.random() ? 2 : -1)
          apply { $0.hear(midi: wrong, playedAt: audio.now(), now: audio.now()) }
          try? await Task.sleep(for: .milliseconds(450))
        }
        if Double.random(in: 0...1) < 0.92, let midi = tg.midis.first {
          apply { $0.hear(midi: midi, playedAt: audio.now(), now: audio.now()) }
        } else if d.window == nil {
          skip() // on the clock, a note not played is missed on its own
        }
      }
    }
  }
  #endif
}

func secs(_ ms: Int) -> String { String(format: "%.1f", Double(ms) / 1000) }

extension FretDot.HeatTone {
  init(_ speed: NoteSpeed) {
    switch speed {
    case .fast: self = .fast
    case .ok: self = .ok
    case .slow: self = .slow
    }
  }
}
