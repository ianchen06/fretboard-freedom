// The box practice screen, laid out for an iPad in landscape so everything stays in view while
// both hands are on the guitar: the exercise and the transport on top, the neck as big as the
// screen allows, the tab, and one strip with the grades, the coach and the mic. In a window too
// small for that (Stage Manager), the same pieces stack and scroll.
import Coach
import FretboardUI
import GuitarAudio
import MusicTheory
import PracticeEngine
import SwiftUI

struct BoxPracticeScreen: View {
  @Environment(GuitarAudioEngine.self) private var audio
  @Environment(ProgressStore.self) private var progress
  @Environment(PracticeCoach.self) private var coach
  @State private var model: BoxPracticeModel?

  var body: some View {
    Group {
      if let model {
        BoxPracticeView(model: model)
      } else {
        Palette.background
      }
    }
    .onAppear {
      let m = model ?? BoxPracticeModel(audio: audio, progress: progress, coach: coach)
      model = m
      audio.onNote = { [weak m] e in m?.heard(e) }
      #if DEBUG
      if ProcessInfo.processInfo.arguments.contains("-FFDemo") { m.runDemo() }
      #endif
    }
    .onDisappear {
      model?.stop()
      audio.onNote = nil
    }
  }
}

struct BoxPracticeView: View {
  @Bindable var model: BoxPracticeModel
  @State private var showHow = false

  var body: some View {
    GeometryReader { geo in
      if geo.size.width >= 700 && geo.size.height >= 540 {
        landscape(short: geo.size.height < 820)
      } else {
        ScrollView { stacked.padding(16) }.scrollIndicators(.hidden)
      }
    }
    .background(Palette.background)
    .navigationTitle("Pentatonic boxes")
    .navigationBarTitleDisplayMode(.inline)
    .toolbar { toolbar }
  }

  // MARK: Layouts

  /// Landscape: no scrolling. The neck takes the height that's left.
  func landscape(short: Bool) -> some View {
    VStack(spacing: short ? 10 : 14) {
      header
      controls
      neck.frame(minHeight: 170, maxHeight: 480).layoutPriority(1)
      tab(rowHeight: short ? 15 : 17)
      Dashboard(model: model, short: short)
      Spacer(minLength: 0)
    }
    .padding(.horizontal, 20)
    .padding(.vertical, short ? 8 : 16)
  }

  /// A small window: the same pieces, stacked.
  var stacked: some View {
    VStack(alignment: .leading, spacing: 14) {
      header
      controls
      neck.frame(height: 260)
      tab(rowHeight: 17)
      StatsPanel(model: model, short: false).panelCard()
      CoachPanel(model: model, short: false).panelCard()
      HearingPanel(short: false).panelCard()
    }
  }

  // MARK: Header: the exercise, the last result, the transport

  /// One row: the title and the last result take what the transport leaves, and shrink or wrap.
  var header: some View {
    HStack(alignment: .center, spacing: 16) {
      titleBlock.frame(maxWidth: .infinity, alignment: .leading)
      BeatLights(model: model)
      Transport(model: model)
    }
  }

  var titleBlock: some View {
    VStack(alignment: .leading, spacing: 4) {
      HStack(alignment: .firstTextBaseline, spacing: 10) {
        Text(model.exercise?.title ?? "Doesn’t fit on the neck")
          .font(.system(.title, design: .rounded, weight: .bold))
          .foregroundStyle(Palette.text)
          .lineLimit(1)
          .minimumScaleFactor(0.6)
          .contentTransition(.opacity)
          .layoutPriority(1)
        if let ex = model.exercise {
          Text("frets \(ex.lo)–\(ex.hi)")
            .font(.subheadline.weight(.medium))
            .foregroundStyle(Palette.faint)
            .lineLimit(1)
        }
      }
      MessageLine(message: model.message)
    }
  }

  // MARK: Controls

  var controls: some View {
    GlassEffectContainer(spacing: 12) {
      ViewThatFits(in: .horizontal) {
        HStack(spacing: 12) {
          scaleMenu(titled: true)
          keyControl(titled: true)
          boxPicker(width: 240)
          patternMenu(titled: true)
          Spacer(minLength: 0)
        }
        HStack(spacing: 10) {
          scaleMenu(titled: false)
          keyControl(titled: false)
          boxPicker(width: 200)
          patternMenu(titled: false)
          Spacer(minLength: 0)
        }
        VStack(alignment: .leading, spacing: 10) {
          HStack(spacing: 10) {
            scaleMenu(titled: false)
            keyControl(titled: false)
            patternMenu(titled: false)
          }
          boxPicker(width: 200)
        }
        // A narrow window: nothing may be wider than the window, or the whole page clips.
        VStack(alignment: .leading, spacing: 10) {
          HStack(spacing: 10) {
            scaleMenu(titled: false)
            keyControl(titled: false)
          }
          patternMenu(titled: false)
          boxPicker(width: 200)
        }
      }
    }
  }

  func scaleMenu(titled: Bool) -> some View {
    Menu {
      Picker("Scale", selection: $model.scale) {
        ForEach([ScaleKind.minorPentatonic, .majorPentatonic, .blues]) { Text($0.name).tag($0) }
      }
    } label: {
      ControlLabel(title: titled ? "Scale" : nil, value: model.scale.name)
    }
    .glassEffect(.regular.interactive(), in: .capsule)
    .fixedSize()
  }

  func keyControl(titled: Bool) -> some View {
    HStack(spacing: 4) {
      Menu {
        Picker("Key", selection: $model.key) {
          ForEach(model.keys, id: \.pc) { Text($0.name).tag($0.pc) }
        }
      } label: {
        ControlLabel(title: titled ? "Key" : nil, value: model.keyName)
      }
      Button("Up a 4th", systemImage: "arrow.trianglehead.clockwise") { model.upAFourth() }
        .labelStyle(.iconOnly)
        .keyboardShortcut("k", modifiers: [])
        .help("Up a 4th (K): the order the deck drills keys in")
        .padding(.trailing, 12)
    }
    .glassEffect(.regular.interactive(), in: .capsule)
    .fixedSize()
  }

  func boxPicker(width: CGFloat) -> some View {
    HStack(spacing: 10) {
      Text("Box").font(.subheadline).foregroundStyle(Palette.faint)
      Picker("Box", selection: $model.box) {
        ForEach(1...5, id: \.self) { Text("\($0)").tag($0) }
      }
      .pickerStyle(.segmented)
      .frame(width: width)
    }
    .fixedSize()
  }

  func patternMenu(titled: Bool) -> some View {
    Menu {
      Picker("Pattern", selection: $model.pattern) {
        ForEach(SequencePattern.allCases.filter { $0 != .sixes }) { Text($0.name.capitalizedFirst).tag($0) }
      }
      Picker("Rhythm", selection: $model.notesPerBeat) {
        ForEach(model.pattern.rhythms, id: \.self) { Text(Tempo.rhythmName(Double($0)).capitalizedFirst).tag($0) }
      }
    } label: {
      ControlLabel(title: titled ? "Pattern" : nil,
                   value: titled ? "\(model.pattern.name) · \(Tempo.rhythmName(Double(model.notesPerBeat)))"
                     : "\(model.pattern.shortName) · \(Tempo.shortRhythmName(model.notesPerBeat))")
    }
    .glassEffect(.regular.interactive(), in: .capsule)
    .fixedSize()
  }

  // MARK: Neck and tab

  var neck: some View {
    FretboardView(tuning: model.tuning, frets: model.frets, dots: model.dots, window: model.window) { p in
      model.tapped(p)
    }
    .padding(.horizontal, 14)
    .padding(.vertical, 10)
    .background(Palette.card, in: .rect(cornerRadius: 22))
    .animation(.snappy(duration: 0.2), value: model.box)
  }

  func tab(rowHeight: CGFloat) -> some View {
    TabStripView(tuning: model.tuning, notes: model.exercise?.notes ?? [], states: model.states,
                 current: model.isRunning ? model.pointer : nil, notesPerBeat: model.notesPerBeat,
                 hidden: model.fromMemory, rowHeight: rowHeight)
      .padding(.vertical, 8)
      .background(Palette.card, in: .rect(cornerRadius: 22))
  }

  // MARK: Toolbar

  @ToolbarContentBuilder var toolbar: some ToolbarContent {
    ToolbarItemGroup(placement: .primaryAction) {
      Button("Previous box", systemImage: "chevron.left") { model.previousBox() }
        .keyboardShortcut(.leftArrow, modifiers: [])
      Button("Next box", systemImage: "chevron.right") { model.nextBox() }
        .keyboardShortcut(.rightArrow, modifiers: [])
      Button("How to play it", systemImage: "info.circle") { showHow.toggle() }
        .popover(isPresented: $showHow) { HowToPlay(exercise: model.exercise) }
      Menu("View", systemImage: "slider.horizontal.3") {
        Toggle("Whole neck", isOn: $model.showWholeNeck)
        Toggle("Note names instead of degrees", isOn: $model.noteNames)
        Toggle("From memory", isOn: $model.fromMemory)
        Divider()
        Toggle("Tempo ladder", isOn: $model.autoTempo)
      }
    }
  }
}

// MARK: - Pieces

struct ControlLabel: View {
  let title: String?
  let value: String

  var body: some View {
    HStack(spacing: 6) {
      if let title { Text(title).foregroundStyle(Palette.faint) }
      Text(value).foregroundStyle(Palette.text).fontWeight(.semibold)
      Image(systemName: "chevron.up.chevron.down").font(.caption2).foregroundStyle(Palette.faint)
    }
    .font(.subheadline)
    .lineLimit(1)
    .padding(.horizontal, 14)
    .padding(.vertical, 9)
    .contentShape(Capsule())
  }
}

struct Transport: View {
  @Bindable var model: BoxPracticeModel

  var body: some View {
    GlassEffectContainer(spacing: 10) {
      HStack(spacing: 10) {
        HStack(spacing: 2) {
          Button("Slower", systemImage: "minus") { model.slower() }
            .keyboardShortcut("-", modifiers: [])
          VStack(spacing: 0) {
            Text("\(model.bpm)")
              .font(.system(.title2, design: .rounded, weight: .bold))
              .monospacedDigit()
              .contentTransition(.numericText(value: Double(model.bpm)))
            Text("bpm").font(.caption2).foregroundStyle(Palette.faint)
          }
          .frame(minWidth: 52)
          .animation(.snappy, value: model.bpm)
          Button("Faster", systemImage: "plus") { model.faster() }
            .keyboardShortcut("=", modifiers: [])
        }
        .labelStyle(.iconOnly)
        .buttonStyle(.glass)

        Button {
          model.toggle()
        } label: {
          Label(model.isRunning ? "Stop" : "Start", systemImage: model.isRunning ? "stop.fill" : "play.fill")
            .font(.title3.weight(.semibold))
            .frame(minWidth: 96)
            .padding(.vertical, 6)
        }
        .buttonStyle(.glassProminent)
        .tint(model.isRunning ? Palette.root : Palette.teal)
        .keyboardShortcut(.space, modifiers: [])
        .disabled(model.exercise == nil)
      }
    }
    .fixedSize()
  }
}

/// Four lights for the beats of the bar; the count-in counts down.
struct BeatLights: View {
  let model: BoxPracticeModel
  @Environment(GuitarAudioEngine.self) private var audio

  var body: some View {
    TimelineView(.animation(minimumInterval: 1 / 30, paused: !model.isRunning)) { _ in
      let beat = currentBeat()
      HStack(spacing: 6) {
        ForEach(0..<4, id: \.self) { i in
          Circle()
            .fill(lit(i, beat) ? (i == 0 ? Palette.third : Palette.text) : Palette.card2)
            .frame(width: 12, height: 12)
        }
      }
      .overlay(alignment: .bottom) {
        if let b = beat, b < 0 {
          Text("\(-b)").font(.caption.weight(.bold)).foregroundStyle(Palette.third).offset(y: 18)
        }
      }
    }
    .accessibilityHidden(true)
  }

  /// Beats since the music started (negative in the count-in), or nil when stopped.
  func currentBeat() -> Int? {
    guard model.isRunning, let start = model.musicStart else { return nil }
    return Int(((audio.now() - start) / model.beatDuration).rounded(.down))
  }

  func lit(_ i: Int, _ beat: Int?) -> Bool {
    guard let beat else { return false }
    return ((beat % 4) + 4) % 4 == i
  }
}

struct MessageLine: View {
  let message: BoxPracticeModel.Message?

  var body: some View {
    Group {
      if let m = message {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
          Circle().fill(color(m.kind)).frame(width: 8, height: 8)
          Text("\(Text(m.title).fontWeight(.semibold).foregroundStyle(color(m.kind)))  \(Text(m.detail).foregroundStyle(Palette.muted))")
        }
      } else {
        Text("Pick a box and press Start, or tap the notes on the neck.")
          .foregroundStyle(Palette.faint)
      }
    }
    .font(.subheadline)
    .lineLimit(2)
  }

  func color(_ kind: BoxPracticeModel.Message.Kind) -> Color {
    switch kind {
    case .ok: Palette.teal
    case .warn: Palette.third
    case .bad: Palette.root
    case .info: Palette.text
    }
  }
}

extension String {
  var capitalizedFirst: String { prefix(1).uppercased() + dropFirst() }
}

extension SequencePattern {
  var shortName: String {
    switch self {
    case .straight: "Up & down"
    case .threes: "3s"
    case .fours: "4s"
    case .thirds: "3rds"
    case .sixes: "6s"
    }
  }
}

extension Tempo {
  static func shortRhythmName(_ notesPerBeat: Int) -> String {
    switch notesPerBeat {
    case 2: "8ths"
    case 3: "triplets"
    case 4: "16ths"
    case 6: "sextuplets"
    default: rhythmName(Double(notesPerBeat))
    }
  }
}

#Preview("Box practice", traits: .landscapeLeft) {
  NavigationStack { BoxPracticeScreen() }
    .environment(GuitarAudioEngine())
    .environment(ProgressStore())
    .environment(PracticeCoach())
    .preferredColorScheme(.dark)
}
