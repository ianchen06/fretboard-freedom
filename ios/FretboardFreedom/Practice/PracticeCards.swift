// Under the neck: this run's grades, the coach, and what the mic hears. In landscape they share
// one strip (the Dashboard); in a small window each is its own card.
import Coach
import FretboardUI
import GuitarAudio
import MusicTheory
import PracticeEngine
import SwiftUI

/// The three panels side by side: grades, coach (widest), mic.
struct Dashboard: View {
  let model: BoxPracticeModel
  let short: Bool

  var body: some View {
    GeometryReader { geo in
      let w = geo.size.width
      HStack(alignment: .top, spacing: 0) {
        StatsPanel(model: model, short: short).frame(width: w * 0.3)
        divider
        CoachPanel(model: model, short: short).frame(width: w * 0.4)
        divider
        HearingPanel(short: short).frame(width: w * 0.3)
      }
    }
    .frame(height: short ? 132 : 168)
    .background(Palette.card, in: .rect(cornerRadius: 22))
    .clipShape(.rect(cornerRadius: 22))
  }

  var divider: some View {
    Rectangle().fill(Palette.line).frame(width: 1).padding(.vertical, 14)
  }
}

struct PanelHeader<Trailing: View>: View {
  let title: String
  let symbol: String
  @ViewBuilder var trailing: Trailing

  var body: some View {
    HStack(spacing: 8) {
      Label(title, systemImage: symbol)
        .font(.subheadline.weight(.semibold))
        .foregroundStyle(Palette.muted)
      Spacer(minLength: 4)
      trailing
    }
  }
}

extension PanelHeader where Trailing == EmptyView {
  init(title: String, symbol: String) {
    self.init(title: title, symbol: symbol) { EmptyView() }
  }
}

extension View {
  /// One panel as a card of its own (the stacked layout).
  func panelCard() -> some View {
    frame(maxWidth: .infinity, alignment: .leading)
      .background(Palette.card, in: .rect(cornerRadius: 22))
  }
}

struct StatsPanel: View {
  let model: BoxPracticeModel
  let short: Bool

  var body: some View {
    let last = model.passes.last
    VStack(alignment: .leading, spacing: short ? 8 : 12) {
      PanelHeader(title: "This run", symbol: "chart.bar.fill")
      Grid(alignment: .leading, horizontalSpacing: 16, verticalSpacing: short ? 6 : 10) {
        GridRow {
          Stat(label: "Passes", value: "\(model.passes.count)")
          Stat(label: "Notes", value: last.map { "\(Int(($0.accuracy * 100).rounded()))%" } ?? "–",
               color: last.map { $0.accuracy >= 0.9 ? Palette.teal : $0.accuracy >= 0.75 ? Palette.third : Palette.root })
          Stat(label: "Timing", value: last?.timingMs.map { "±\(Int($0.rounded())) ms" } ?? "–",
               color: last?.timingMs.map { $0 <= 35 ? Palette.teal : $0 <= 60 ? Palette.third : Palette.root })
        }
        GridRow {
          VStack(alignment: .leading, spacing: 4) {
            Text("In a row").font(.caption).foregroundStyle(Palette.faint).lineLimit(1)
            HStack(spacing: 4) {
              ForEach(0..<model.cleanNeeded, id: \.self) { i in
                Capsule().fill(i < model.cleanStreak ? Palette.teal : Palette.card2).frame(width: 16, height: 8)
              }
            }
            .frame(height: 20)
          }
          Stat(label: "Best clean", value: model.bestBPM > 0 ? "\(model.bestBPM)" : "–")
          Stat(label: "Mastery", value: "\(Int((model.mastery * 100).rounded()))%")
        }
      }
      if !short {
        Text(model.autoTempo ? "\(model.cleanNeeded) clean passes in a row (90% of the notes, ±60 ms) take the tempo up." : "Tempo ladder off.")
          .font(.caption)
          .foregroundStyle(Palette.faint)
          .lineLimit(2)
      }
    }
    .padding(short ? 14 : 18)
  }
}

struct Stat: View {
  let label: String
  let value: String
  var color: Color? = nil

  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
      Text(label).font(.caption).foregroundStyle(Palette.faint).lineLimit(1)
      Text(value)
        .font(.system(.title3, design: .rounded, weight: .semibold))
        .monospacedDigit()
        .foregroundStyle(color ?? Palette.text)
        .lineLimit(1)
        .minimumScaleFactor(0.7)
        .contentTransition(.numericText())
    }
  }
}

struct CoachPanel: View {
  let model: BoxPracticeModel
  let short: Bool
  @Environment(PracticeCoach.self) private var coach

  var body: some View {
    VStack(alignment: .leading, spacing: short ? 6 : 10) {
      PanelHeader(title: "Coach", symbol: "sparkles") {
        source
        Button("Ask", systemImage: "sparkles") { model.askCoach() }
          .labelStyle(.iconOnly)
          .buttonStyle(.glass)
          .controlSize(.small)
          .disabled(model.passes.isEmpty || coach.isThinking)
          .help("Ask the coach about the last passes")
      }
      if let tip = coach.tip {
        VStack(alignment: .leading, spacing: 4) {
          Text(tip.headline)
            .font(short ? .headline : .title3.weight(.semibold))
            .foregroundStyle(Palette.text)
            .lineLimit(1)
          Text(tip.advice)
            .font(.subheadline)
            .foregroundStyle(Palette.muted)
            .lineLimit(short ? 3 : 4)
            .fixedSize(horizontal: false, vertical: true)
        }
        .id(tip)
        .transition(.opacity)
      } else {
        Text("After a pass, the coach turns your grades into one thing to try next.")
          .font(.subheadline)
          .foregroundStyle(Palette.faint)
          .lineLimit(3)
        if case .rules(let why) = coach.status, !short {
          Text(why).font(.caption2).foregroundStyle(Palette.faint).lineLimit(2)
        }
      }
    }
    .padding(short ? 14 : 18)
    .animation(.snappy, value: coach.tip)
  }

  var source: some View {
    HStack(spacing: 5) {
      switch coach.status {
      case .onDevice:
        Image(systemName: "apple.intelligence")
        Text("On-device model")
      case .rules:
        Image(systemName: "list.bullet.rectangle")
        Text("Rule-based")
      case .checking:
        Text("Checking…")
      }
      if coach.isThinking { ProgressView().controlSize(.mini) }
    }
    .font(.caption.weight(.medium))
    .foregroundStyle(Palette.muted)
    .lineLimit(1)
    .padding(.horizontal, 8)
    .padding(.vertical, 4)
    .background(Palette.card2, in: Capsule())
  }
}

struct HearingPanel: View {
  let short: Bool
  @Environment(GuitarAudioEngine.self) private var audio

  var body: some View {
    @Bindable var audio = audio
    VStack(alignment: .leading, spacing: short ? 8 : 12) {
      PanelHeader(title: "Hearing", symbol: "waveform") {
        mic
      }
      TunerReadout(midi: audio.livePitch?.midi, cents: audio.livePitch?.cents ?? 0)
      HStack(spacing: 10) {
        LevelMeter(db: audio.levelDb, gateDb: audio.gateDb).frame(maxWidth: 90)
        Slider(value: Binding(get: { -audio.gateDb }, set: { audio.gateDb = -$0 }), in: 30...75) {
          Text("Sensitivity")
        } minimumValueLabel: {
          Image(systemName: "ear").font(.caption).foregroundStyle(Palette.faint)
        } maximumValueLabel: {
          Image(systemName: "ear.badge.waveform").font(.caption).foregroundStyle(Palette.faint)
        }
        .help("Sensitivity: raise it if soft notes are missed, lower it if noise counts as notes")
      }
      if !short {
        Text(status)
          .font(.caption2)
          .foregroundStyle(Palette.faint)
          .lineLimit(2)
      }
    }
    .padding(short ? 14 : 18)
  }

  @ViewBuilder var mic: some View {
    switch audio.micState {
    case .listening:
      Button { audio.stopMic() } label: {
        Label(audio.inputName.isEmpty ? "Listening" : audio.inputName, systemImage: "mic.fill").lineLimit(1)
      }
      .buttonStyle(.glass)
      .controlSize(.small)
      .tint(Palette.teal)
      .help("Listening. Tap to close the mic.")
    case .starting:
      ProgressView().controlSize(.small)
    case .denied:
      Label("Mic off in Settings", systemImage: "mic.slash").font(.caption).foregroundStyle(Palette.third)
    case .failed:
      Button("Retry", systemImage: "exclamationmark.triangle") { Task { await audio.startMic() } }
        .buttonStyle(.glass).controlSize(.small).tint(Palette.root)
    case .off:
      Button("Listen", systemImage: "mic") { Task { await audio.startMic() } }
        .buttonStyle(.glassProminent)
        .controlSize(.small)
        .help("Open the mic so it can check your notes")
    }
  }

  var status: String {
    switch audio.micState {
    case .denied: "The mic is off for this app. Turn it on in Settings › Privacy & Security › Microphone."
    case .failed(let why): why
    default: "It hears pitch, not strings. Use headphones so it doesn’t hear the click."
    }
  }
}

/// The exercise's how, why and cues, from the toolbar's info button.
struct HowToPlay: View {
  let exercise: PracticeExercise?

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      if let ex = exercise {
        Text(ex.title).font(.headline)
        Text(ex.how)
        Text(ex.why).foregroundStyle(.secondary)
        ForEach(ex.cues, id: \.self) { cue in
          Label(cue, systemImage: "checkmark.circle").foregroundStyle(.secondary)
        }
        Divider()
        Label("The mic hears pitch, not strings: a note in the right octave on another string counts. Use headphones so it doesn’t hear the click.",
              systemImage: "waveform")
          .font(.footnote)
          .foregroundStyle(.secondary)
        Label("Keys: Space start/stop · ← → box · K up a 4th · − = tempo", systemImage: "keyboard")
          .font(.footnote)
          .foregroundStyle(.secondary)
      }
    }
    .font(.subheadline)
    .padding(20)
    .frame(width: 420)
  }
}
