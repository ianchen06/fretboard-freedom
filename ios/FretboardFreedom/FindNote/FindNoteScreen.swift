// The Find any note screen, laid out like Pentatonic boxes so it fits one landscape screen: the card
// with the note to find and the transport on top, the drill's settings, the neck (the speed map
// between rounds), the round's progress, and one strip with the stats, the method and the mic.
import FretboardUI
import GuitarAudio
import MusicTheory
import PracticeEngine
import SwiftUI

struct FindNoteScreen: View {
  @Environment(GuitarAudioEngine.self) private var audio
  @State private var model: FindNoteModel?

  var body: some View {
    Group {
      if let model {
        FindNoteView(model: model)
      } else {
        Palette.background
      }
    }
    .onAppear {
      let m = model ?? FindNoteModel(audio: audio)
      model = m
      audio.setNoteHandler(owner: m) { [weak m] e in m?.heard(e) }
      #if DEBUG
      if ProcessInfo.processInfo.arguments.contains("-FFDemo") { m.runDemo() }
      #endif
    }
    .onDisappear {
      model?.stop()
      if let model { audio.clearNoteHandler(owner: model) }
    }
  }
}

struct FindNoteView: View {
  @Bindable var model: FindNoteModel
  @State private var showHow = false
  @State private var confirmReset = false

  var body: some View {
    GeometryReader { geo in
      if geo.size.width >= 700 && geo.size.height >= 540 {
        landscape(short: geo.size.height < 820, compact: geo.size.width < 1000)
      } else {
        ScrollView { stacked.padding(16) }.scrollIndicators(.hidden)
      }
    }
    .background(Palette.background)
    .navigationTitle("Find any note")
    .navigationBarTitleDisplayMode(.inline)
    .toolbar { toolbar }
    .confirmationDialog("Clear your speed map and stage streaks?", isPresented: $confirmReset, titleVisibility: .visible) {
      Button("Reset speed map", role: .destructive) { model.resetSpeedMap() }
    } message: {
      Text("This can’t be undone.")
    }
  }

  // MARK: Layouts

  /// Landscape: no scrolling. The neck takes the height that's left.
  func landscape(short: Bool, compact: Bool) -> some View {
    VStack(spacing: short ? 10 : 14) {
      header(short: short, compact: compact)
      controls
      neck.frame(minHeight: 170, maxHeight: 460).layoutPriority(1)
      RoundStrip(model: model)
      FindNoteDashboard(model: model, short: short)
      Spacer(minLength: 0)
    }
    .padding(.horizontal, 20)
    .padding(.vertical, short ? 8 : 16)
  }

  /// A small window: the same pieces, stacked.
  var stacked: some View {
    VStack(alignment: .leading, spacing: 14) {
      TargetCard(model: model, short: true)
      RunControls(model: model, compact: false)
      controls
      neck.frame(height: 260)
      RoundStrip(model: model)
      FindNoteStatsPanel(model: model, short: false).panelCard()
      Group {
        if model.phase == .done { ResultsPanel(model: model, short: false) } else { MethodPanel(short: false) }
      }
      .panelCard()
      HearingPanel(short: false).panelCard()
    }
  }

  /// compact: with the sidebar open on a smaller iPad, the round's buttons show only their icons.
  func header(short: Bool, compact: Bool) -> some View {
    HStack(alignment: .center, spacing: 16) {
      TargetCard(model: model, short: short).frame(maxWidth: .infinity)
      RunControls(model: model, compact: compact)
    }
  }

  // MARK: Controls

  var controls: some View {
    GlassEffectContainer(spacing: 12) {
      ViewThatFits(in: .horizontal) {
        HStack(spacing: 12) {
          modePicker(width: 330)
          setupMenus(titled: true)
          Spacer(minLength: 0)
        }
        HStack(spacing: 10) {
          modePicker(width: 290)
          setupMenus(titled: false)
          Spacer(minLength: 0)
        }
        VStack(alignment: .leading, spacing: 10) {
          modePicker(width: 290)
          HStack(spacing: 10) { setupMenus(titled: false) }
        }
        // A narrow window: nothing may be wider than the window, or the whole page clips.
        VStack(alignment: .leading, spacing: 10) {
          modePicker(width: 290)
          HStack(spacing: 10) { drillMenus(titled: false) }
          HStack(spacing: 10) {
            fretsMenu(titled: false)
            paceMenu(titled: false)
          }
        }
      }
    }
    .disabled(model.isPlaying)
    .opacity(model.isPlaying ? 0.45 : 1)
    .animation(.snappy, value: model.isPlaying)
  }

  @ViewBuilder func setupMenus(titled: Bool) -> some View {
    drillMenus(titled: titled)
    fretsMenu(titled: titled)
    paceMenu(titled: titled)
  }

  @ViewBuilder func drillMenus(titled: Bool) -> some View {
    if model.mode == .everywhere {
      noteMenu(titled: titled)
    } else {
      cardsMenu(titled: titled)
      stringsMenu(titled: titled)
    }
  }

  func modePicker(width: CGFloat) -> some View {
    Picker("Drill", selection: $model.mode) {
      ForEach(FindNoteMode.allCases) { Text($0.name).tag($0) }
    }
    .pickerStyle(.segmented)
    .frame(width: width)
  }

  func noteMenu(titled: Bool) -> some View {
    Menu {
      Picker("Note", selection: $model.noteChoice) {
        Label("Circle of 4ths: \(model.circleNote) next", systemImage: "arrow.trianglehead.clockwise").tag(FindNoteModel.NoteChoice.circle)
        Label("Random note", systemImage: "shuffle").tag(FindNoteModel.NoteChoice.random)
      }
      Picker(selection: $model.noteChoice) {
        ForEach(0..<12, id: \.self) { pc in
          Text(Theory.spellings(pc).joined(separator: " / ")).tag(FindNoteModel.NoteChoice.pc(pc))
        }
      } label: {
        Label("One note", systemImage: "music.note")
      }
      .pickerStyle(.menu)
      Picker("Direction", selection: $model.direction) {
        ForEach(FindNoteDirection.allCases) { Text($0.name).tag($0) }
      }
    } label: {
      ControlLabel(title: titled ? "Note" : nil, value: "\(noteValue(titled: titled)) · \(model.direction == .upBack ? "up & back" : "up only")")
    }
    .glassEffect(.regular.interactive(), in: .capsule)
    .fixedSize()
  }

  func noteValue(titled: Bool) -> String {
    switch model.noteChoice {
    case .circle: titled ? "\(model.circleNote) (circle of 4ths)" : model.circleNote
    case .random: "Random"
    case .pc(let pc): Theory.spellings(pc).joined(separator: "/")
    }
  }

  func cardsMenu(titled: Bool) -> some View {
    Menu {
      Picker("Notes", selection: $model.notes) {
        ForEach(FindNoteNotes.allCases) { Text($0.name).tag($0) }
      }
      Picker("Cards", selection: $model.count) {
        ForEach([10, 20, 40], id: \.self) { Text("\($0) cards").tag($0) }
      }
    } label: {
      ControlLabel(title: titled ? "Cards" : nil, value: "\(model.notes == .naturals ? "Naturals" : "All 12") · \(model.count)")
    }
    .glassEffect(.regular.interactive(), in: .capsule)
    .fixedSize()
  }

  func stringsMenu(titled: Bool) -> some View {
    Menu {
      ForEach(lowToHigh, id: \.self) { s in
        Toggle("\(model.tuning.stringLongName(s).capitalizedFirst) string",
               isOn: Binding(get: { model.strings.contains(s) }, set: { _ in model.toggleString(s) }))
      }
      Divider()
      Button("All strings", systemImage: "checklist") { model.strings = Set(1...6) }
    } label: {
      ControlLabel(title: titled ? "Strings" : nil, value: model.stringsName)
    }
    .menuActionDismissBehavior(.disabled)
    .glassEffect(.regular.interactive(), in: .capsule)
    .fixedSize()
  }

  func fretsMenu(titled: Bool) -> some View {
    Menu {
      Picker("Frets", selection: $model.range) {
        ForEach(FindNoteModel.FretRange.allCases) { Text("Frets \($0.name)").tag($0) }
      }
    } label: {
      ControlLabel(title: titled ? "Frets" : nil, value: model.range.name)
    }
    .glassEffect(.regular.interactive(), in: .capsule)
    .fixedSize()
  }

  func paceMenu(titled: Bool) -> some View {
    Menu {
      Picker("Pace", selection: $model.pace) {
        ForEach(FindNotePace.allCases) { p in
          // The second line is the item's subtitle.
          VStack {
            Text(p.label)
            Text(p.short)
          }
          .tag(p)
        }
      }
    } label: {
      ControlLabel(title: titled ? "Pace" : nil, value: paceValue(titled: titled))
    }
    .glassEffect(.regular.interactive(), in: .capsule)
    .fixedSize()
  }

  func paceValue(titled: Bool) -> String {
    guard let bpm = model.pace.bpm, let clicks = model.pace.clicks else { return "Free" }
    return titled ? "\(model.pace.label) · \(bpm) bpm × \(clicks)" : "\(model.pace.label)"
  }

  // MARK: Neck

  var neck: some View {
    VStack(spacing: 6) {
      HStack(spacing: 12) {
        Text(model.boardTitle)
          .font(.subheadline.weight(.semibold))
          .foregroundStyle(Palette.muted)
          .lineLimit(1)
        Spacer(minLength: 8)
        if model.phase == .idle || model.phase == .done {
          SpeedLegend(round: model.phase == .done)
        }
      }
      FretboardView(tuning: model.tuning, frets: model.frets, dots: model.dots, highlightString: model.highlightString) { p in
        model.tapped(p)
      }
    }
    .padding(.horizontal, 14)
    .padding(.top, 10)
    .padding(.bottom, 6)
    .background(Palette.card, in: .rect(cornerRadius: 22))
    .animation(.snappy(duration: 0.2), value: model.range)
  }

  // MARK: Toolbar

  @ToolbarContentBuilder var toolbar: some ToolbarContent {
    ToolbarItemGroup(placement: .primaryAction) {
      Button("How it works", systemImage: "info.circle") { showHow.toggle() }
        .popover(isPresented: $showHow) { FindNoteHelp(model: model) }
      Menu("Options", systemImage: "slider.horizontal.3") {
        Toggle(isOn: $model.strictOctave) {
          Text("Check the octave")
          Text("Only the octave on the target string counts")
        }
        Toggle(isOn: $model.autoHint) {
          Text("Auto-hint after 5 s")
          Text("Free pace only")
        }
        Toggle(isOn: $model.weakSpots) {
          Text("Focus on weak spots")
          Text("Flash cards bring up slow and missed notes more often")
        }
        Picker("Tuning", selection: $model.tuning) {
          ForEach(Tuning.all) { Text($0.name).tag($0) }
        }
        .pickerStyle(.menu)
        Divider()
        Button("Reset speed map…", systemImage: "trash", role: .destructive) { confirmReset = true }
      }
      .disabled(model.isPlaying)
    }
  }
}

// MARK: - The target card

/// The note to find and where, how long it's taking, and what the mic just heard.
struct TargetCard: View {
  let model: FindNoteModel
  let short: Bool
  @Environment(GuitarAudioEngine.self) private var audio

  var body: some View {
    HStack(alignment: .center, spacing: 16) {
      bigNote
        .frame(minWidth: short ? 84 : 104)
      VStack(alignment: .leading, spacing: short ? 3 : 5) {
        HStack(alignment: .center, spacing: 12) {
          Text(kicker)
            .font(.caption.weight(.semibold))
            .textCase(.uppercase)
            .foregroundStyle(Palette.faint)
            .lineLimit(1)
            .frame(maxWidth: .infinity, alignment: .leading)
          if model.isPlaying { NoteClock(model: model) }
        }
        HStack(alignment: .firstTextBaseline, spacing: 10) {
          whereLine
            .font(.system(short ? .title3 : .title2, design: .rounded, weight: .semibold))
            .foregroundStyle(Palette.text)
            .lineLimit(1)
            .minimumScaleFactor(0.7)
          if let alt = model.current?.names.dropFirst().first {
            Text("also called \(alt)").font(.subheadline).foregroundStyle(Palette.muted).lineLimit(1)
          }
        }
        detailLine
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    }
    .padding(.horizontal, 18)
    .padding(.vertical, short ? 10 : 14)
    .background(Palette.card, in: .rect(cornerRadius: 22))
    .overlay(RoundedRectangle(cornerRadius: 22).strokeBorder(border, lineWidth: 1.5))
    .keyframeAnimator(initialValue: 0.0, trigger: model.hitCount) { content, glow in
      content.overlay(RoundedRectangle(cornerRadius: 22).fill(Palette.teal.opacity(glow)).allowsHitTesting(false))
    } keyframes: { _ in
      KeyframeTrack {
        LinearKeyframe(0.2, duration: 0.05)
        LinearKeyframe(0, duration: 0.55)
      }
    }
    .keyframeAnimator(initialValue: 0.0, trigger: model.wrongCount) { content, x in
      content.offset(x: x)
    } keyframes: { _ in
      KeyframeTrack {
        LinearKeyframe(-7, duration: 0.06)
        LinearKeyframe(7, duration: 0.08)
        LinearKeyframe(-4, duration: 0.07)
        LinearKeyframe(0, duration: 0.07)
      }
    }
    .animation(.snappy(duration: 0.25), value: model.card)
  }

  // MARK: The big note

  @ViewBuilder var bigNote: some View {
    if model.phase == .countIn {
      TimelineView(.animation(minimumInterval: 1 / 30)) { _ in
        noteText(model.countInLeft(now: audio.now()).map(String.init) ?? "·")
      }
    } else {
      noteText(noteValue)
        .id(noteKey)
        .transition(.scale(scale: 0.7).combined(with: .opacity))
        .animation(.snappy(duration: 0.22), value: noteKey)
    }
  }

  func noteText(_ s: String) -> some View {
    Text(s)
      .font(.system(size: short ? 56 : 68, weight: .bold, design: .rounded))
      .foregroundStyle(noteColor)
      .lineLimit(1)
      .minimumScaleFactor(0.5)
      .contentTransition(.numericText())
  }

  var noteValue: String {
    switch model.card {
    case .idle: "?"
    case .countIn: "·"
    case .active, .hit, .miss: model.current?.name ?? "·"
    case .clean: "✓"
    case .done: "\(model.summary?.hits ?? 0)"
    }
  }

  /// Changes with each new target, so the note pops in.
  var noteKey: String { "\(model.phase)-\(model.drill?.index ?? -1)-\(noteValue)" }

  var noteColor: Color {
    switch model.card {
    case .idle: Palette.line2
    case .countIn: Palette.muted
    case .active, .done: Palette.text
    case .hit, .clean: Palette.teal
    case .miss: Palette.root
    }
  }

  var border: Color {
    switch model.card {
    case .hit, .clean: Palette.teal.opacity(0.7)
    case .miss: Palette.root.opacity(0.6)
    case .active, .countIn: Palette.line2
    case .idle, .done: Palette.line
    }
  }

  // MARK: The lines beside it

  var kicker: String {
    switch model.phase {
    case .idle: return "Part 3 · Find any note"
    case .done: return model.resultKicker
    case .countIn, .running:
      guard let d = model.drill else { return "" }
      let i = min(d.targets.count, max(0, d.index + 1))
      let pace = d.pace.bpm.map { " · \(d.pace.label), \($0) bpm" } ?? ""
      return "\(d.config.mode.name) · \(i) of \(d.targets.count)\(pace)"
    }
  }

  @ViewBuilder var whereLine: some View {
    switch model.phase {
    case .idle:
      Text("Pick a drill, then press \(Text("Start").foregroundStyle(Palette.teal)).")
    case .countIn:
      if let d = model.drill, d.config.mode == .everywhere {
        Text("Find \(Text(d.config.names[0]).foregroundStyle(Palette.third)) on every string")
      } else {
        Text("\(model.drill?.targets.count ?? 0) cards")
      }
    case .running:
      if let tg = model.current {
        let ord = ["", "1st", "2nd", "3rd", "4th", "5th", "6th"][tg.string]
        Text("on the \(Text(model.tuning.stringLongName(tg.string)).foregroundStyle(Palette.third)) string \(Text("(\(ord))").foregroundStyle(Palette.faint))")
      } else {
        Text(" ")
      }
    case .done:
      if let s = model.summary {
        Text(s.aborted ? "Stopped" : s.clean ? "Clean round" : "of \(s.total) found")
      }
    }
  }

  /// After a round, what the card says under the headline: what's next.
  var doneDetail: String {
    guard let s = model.summary else { return "" }
    if s.aborted { return model.resultTitle + "." }
    if s.clean && s.underGoal == s.total { return "Every note under 2 seconds." }
    let next = model.nextNoteName.map { ", or the next note on the circle: \($0) (N)" } ?? ""
    return "Again (Space)\(next)."
  }

  @ViewBuilder var detailLine: some View {
    if model.phase == .done {
      Text(doneDetail).font(.subheadline).foregroundStyle(Palette.muted).lineLimit(2, reservesSpace: true)
    } else {
      MessageLine(message: model.message, placeholder: placeholder, lineLimit: 2, reservesSpace: true)
    }
  }

  var placeholder: String {
    switch model.phase {
    case .idle: "Play the note. Say its name out loud."
    case .countIn: model.beat == nil ? "Get ready…" : "Count-in…"
    case .running, .done:
      "Play it, and say its name out loud." + (model.audio.micState == .listening ? "" : " The mic is off: tap the neck to answer.")
    }
  }
}

/// The clicks for this note and the time against the 2-second checkpoint.
struct NoteClock: View {
  let model: FindNoteModel
  @Environment(GuitarAudioEngine.self) private var audio

  var body: some View {
    TimelineView(.animation(minimumInterval: 1 / 30, paused: !model.isPlaying)) { _ in
      let now = audio.now()
      HStack(spacing: 12) {
        beats(now)
        timer(now)
      }
    }
    .fixedSize()
    .accessibilityHidden(true)
  }

  @ViewBuilder func beats(_ now: Double) -> some View {
    if let beat = model.beat, let clicks = model.drill?.pace.clicks {
      let lit: Int = {
        guard let shown = model.current?.shownAt else { return 0 }
        return min(clicks, Int(((now - shown) / beat + 1e-6).rounded(.down)) + 1)
      }()
      HStack(spacing: 6) {
        ForEach(0..<clicks, id: \.self) { i in
          let on = i < lit
          Circle()
            .fill(on ? (i == clicks - 1 ? Palette.third : Palette.pearl) : .clear)
            .strokeBorder(on ? .clear : Palette.line2, lineWidth: 2)
            .frame(width: 12, height: 12)
        }
      }
    }
  }

  func timer(_ now: Double) -> some View {
    let ms: Int? = model.current.flatMap { tg in
      tg.status == .hit ? tg.ms : tg.shownAt.map { max(0, Int((now - $0) * 1000)) }
    }
    let over = (ms ?? 0) >= FindNoteDrill.goalMs
    return HStack(spacing: 8) {
      GeometryReader { g in
        ZStack(alignment: .leading) {
          Capsule().fill(Palette.card2)
          Capsule()
            .fill(over ? Palette.third : Palette.teal)
            .frame(width: g.size.width * min(1, CGFloat(ms ?? 0) / CGFloat(FindNoteDrill.goalMs * 2)))
          Rectangle().fill(Palette.pearl.opacity(0.6)).frame(width: 2, height: 14).offset(x: g.size.width / 2 - 1)
        }
      }
      .frame(width: 96, height: 8)
      Text(ms.map { "\(secs($0)) s" } ?? "")
        .font(.system(.subheadline, design: .rounded, weight: .semibold))
        .monospacedDigit()
        .foregroundStyle(over ? Palette.third : Palette.text)
        .frame(width: 52, alignment: .trailing)
    }
  }
}

struct RunControls: View {
  let model: FindNoteModel
  /// Hint, Skip and Next show only their icons.
  var compact = false

  var body: some View {
    GlassEffectContainer(spacing: 10) {
      HStack(spacing: 10) {
        switch model.phase {
        case .idle:
          prominent("Start", "play.fill", Palette.teal) { model.start() }
            .keyboardShortcut(.space, modifiers: [])
        case .countIn, .running:
          Button("Hint", systemImage: "lightbulb.fill") { model.hint() }
            .keyboardShortcut("h", modifiers: [])
            .buttonStyle(.glass)
            .disabled(!canHint)
            .help("Hint (H): first your anchors, then where it is")
          if model.drill?.window == nil {
            Button("Skip", systemImage: "forward.fill") { model.skip() }
              .keyboardShortcut("s", modifiers: [])
              .buttonStyle(.glass)
              .disabled(model.current?.status != .active)
              .help("Skip (S): counts as a miss")
          }
          prominent("Stop", "stop.fill", Palette.root) { model.stop() }
            .keyboardShortcut(.escape, modifiers: [])
        case .done:
          Button("Speed map", systemImage: "xmark") { model.backToIdle() }
            .labelStyle(.iconOnly)
            .keyboardShortcut(.escape, modifiers: [])
            .buttonStyle(.glass)
            .help("Back to your speed map (Esc)")
          if let next = model.nextNoteName {
            Button("Next: \(next)", systemImage: "arrow.trianglehead.clockwise") { model.nextNote() }
              .keyboardShortcut("n", modifiers: [])
              .buttonStyle(.glass)
              .help("The next note on the circle of 4ths (N)")
              .labelStyle(.titleAndIcon)
          }
          prominent("Again", "arrow.counterclockwise", Palette.teal) { model.start() }
            .keyboardShortcut(.space, modifiers: [])
        }
      }
      .font(.body.weight(.semibold))
      .labelStyle(IconOnlyIf(compact))
    }
    .fixedSize()
  }

  var canHint: Bool {
    guard let tg = model.current else { return false }
    return tg.status == .active && tg.hints < 2
  }

  func prominent(_ title: String, _ symbol: String, _ tint: Color, action: @escaping () -> Void) -> some View {
    Button(action: action) {
      Label(title, systemImage: symbol)
        .labelStyle(.titleAndIcon)
        .font(.title3.weight(.semibold))
        .frame(minWidth: 96)
        .padding(.vertical, 6)
    }
    .buttonStyle(.glassProminent)
    .tint(tint)
  }
}

/// Icon only when asked, title and icon otherwise.
struct IconOnlyIf: LabelStyle {
  let iconOnly: Bool
  init(_ iconOnly: Bool) { self.iconOnly = iconOnly }

  @ViewBuilder func makeBody(configuration: Configuration) -> some View {
    if iconOnly { Label(configuration).labelStyle(.iconOnly) } else { Label(configuration).labelStyle(.titleAndIcon) }
  }
}

#Preview("Find any note", traits: .landscapeLeft) {
  NavigationStack { FindNoteScreen() }
    .environment(GuitarAudioEngine())
    .preferredColorScheme(.dark)
}
