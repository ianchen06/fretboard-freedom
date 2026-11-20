// Under the neck: the round's progress, then one strip with the stats (the speed map between
// rounds), the 3-step method (the results after a round) and the mic.
import FretboardUI
import GuitarAudio
import MusicTheory
import PracticeEngine
import SwiftUI

/// One chip per note of the round: the string (one note everywhere) or the card, once it's played.
struct RoundStrip: View {
  let model: FindNoteModel

  var body: some View {
    GeometryReader { geo in
      if let d = model.drill, model.phase != .idle {
        let n = max(1, d.targets.count)
        let spacing: CGFloat = n > 24 ? 3 : 6
        let w = min(58, (geo.size.width - spacing * CGFloat(n - 1)) / CGFloat(n))
        HStack(spacing: spacing) {
          ForEach(d.targets.indices, id: \.self) { i in
            chip(d.targets[i], active: model.phase == .running && i == d.index, everywhere: d.config.mode == .everywhere, labeled: w >= 34)
              .frame(width: w)
          }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .animation(.snappy(duration: 0.2), value: d.index)
      } else {
        Text("No guitar handy? Tap the neck to answer.  Keys: Space start · H hint · S skip · Esc stop · N next note")
          .font(.caption)
          .foregroundStyle(Palette.faint)
          .lineLimit(1)
          .minimumScaleFactor(0.8)
          .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
          .padding(.horizontal, 6)
      }
    }
    .frame(height: 30)
  }

  func chip(_ t: FindNoteTarget, active: Bool, everywhere: Bool, labeled: Bool) -> some View {
    let slow = t.status == .hit && (t.ms ?? 0) >= FindNoteDrill.goalMs
    let (fill, edge, ink): (Color, Color, Color) = switch t.status {
    case .hit where slow: (Palette.third.opacity(0.12), Palette.third.opacity(0.45), Color(hex: 0xFCD34D))
    case .hit: (Palette.teal.opacity(0.14), Palette.teal.opacity(0.45), Color(hex: 0x5EEAD4))
    case .miss, .skip: (Palette.root.opacity(0.12), Palette.root.opacity(0.45), Color(hex: 0xFCA5A5))
    case .pending, .active: (Palette.card2, active ? Palette.third : Palette.line, active ? Palette.text : Palette.muted)
    }
    let string = model.tuning.stringName(t.string)
    return RoundedRectangle(cornerRadius: 8)
      .fill(fill)
      .strokeBorder(edge, lineWidth: active ? 2 : 1)
      .shadow(color: active ? Palette.third.opacity(0.35) : .clear, radius: 4)
      .overlay {
        if labeled {
          Group {
            if everywhere {
              Text(string)
            } else if t.isFinished {
              Text("\(t.name)\(Text(" \(string)").font(.caption2).foregroundStyle(ink.opacity(0.75)))")
            } else {
              Text("?")
            }
          }
          .font(.system(.footnote, design: .rounded, weight: .bold))
          .foregroundStyle(ink)
          .lineLimit(1)
          .minimumScaleFactor(0.6)
          .padding(.horizontal, 2)
        }
      }
      .help(t.status == .hit ? "\(t.name), \(model.tuning.stringLongName(t.string)) string: \(secs(t.ms ?? 0)) s" : "")
  }
}

/// The speed map's colors.
struct SpeedLegend: View {
  /// After a round: "missed" instead of "not practiced yet".
  let round: Bool

  var body: some View {
    HStack(spacing: 12) {
      swatch(Palette.teal, "under 2 s")
      swatch(Palette.third, "2–3.5 s")
      swatch(Palette.root, round ? "slower" : "slower or missed")
      if round {
        item(Circle().strokeBorder(Palette.root, style: StrokeStyle(lineWidth: 1.5, dash: [3, 2])), "missed")
      } else {
        item(Circle().fill(Palette.woodEdge).strokeBorder(Color(hex: 0x6B5848), lineWidth: 1.5), "not practiced yet")
      }
    }
    .font(.caption)
    .foregroundStyle(Palette.muted)
    .lineLimit(1)
  }

  func swatch(_ c: Color, _ text: String) -> some View { item(Circle().fill(c), text) }

  func item(_ mark: some View, _ text: String) -> some View {
    HStack(spacing: 5) {
      mark.frame(width: 10, height: 10)
      Text(text)
    }
  }
}

/// The stats, the method or the results, and the mic, side by side.
struct FindNoteDashboard: View {
  let model: FindNoteModel
  let short: Bool

  var body: some View {
    GeometryReader { geo in
      let w = geo.size.width
      HStack(alignment: .top, spacing: 0) {
        FindNoteStatsPanel(model: model, short: short).frame(width: w * 0.3)
        divider
        Group {
          if model.phase == .done { ResultsPanel(model: model, short: short) } else { MethodPanel(short: short) }
        }
        .frame(width: w * 0.4)
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

struct FindNoteStatsPanel: View {
  let model: FindNoteModel
  let short: Bool

  var body: some View {
    VStack(alignment: .leading, spacing: short ? 8 : 12) {
      if model.phase == .idle { speedMap } else { round }
    }
    .padding(short ? 14 : 18)
  }

  @ViewBuilder var speedMap: some View {
    let c = model.speedMapCounts
    PanelHeader(title: "Speed map", symbol: "square.grid.3x3.fill")
    Grid(alignment: .leading, horizontalSpacing: 16, verticalSpacing: short ? 6 : 10) {
      GridRow {
        Stat(label: "Under 2 s", value: "\(c.fast)/\(c.cells)", color: c.cells > 0 && c.fast == c.cells ? Palette.teal : nil)
        Stat(label: "Practiced", value: "\(c.seen)/\(c.cells)")
        if model.pace.bpm != nil { streakStat } else { Stat(label: "Rounds", value: "\(model.progress.history.count)") }
      }
    }
    Text("Checkpoint: all \(c.cells) under 2 seconds\(model.tuning.id == "standard" ? "" : " (\(model.tuning.name))").")
      .font(.caption)
      .foregroundStyle(Palette.faint)
      .lineLimit(2)
  }

  @ViewBuilder var round: some View {
    if let d = model.drill {
      let done = model.phase == .done
      let s = model.summary ?? d.summary(aborted: false)
      let of = s.aborted ? s.played : s.total
      let pct = of > 0 ? Double(s.hits) / Double(of) : 0
      PanelHeader(title: "This round", symbol: "chart.bar.fill")
      Grid(alignment: .leading, horizontalSpacing: 16, verticalSpacing: short ? 6 : 10) {
        GridRow {
          Stat(label: "Found", value: "\(s.hits)/\(of)",
               color: done ? (pct == 1 ? Palette.teal : pct >= 0.8 ? Palette.third : Palette.root) : nil)
          Stat(label: "Average", value: s.avgMs.map { "\(secs($0)) s" } ?? "–", color: speedColor(s.avgMs))
          Stat(label: "Under 2 s", value: "\(s.underGoal)/\(s.hits)", color: s.hits > 0 && s.underGoal == s.hits ? Palette.teal : nil)
        }
        GridRow {
          Stat(label: "Fastest", value: s.bestMs.map { "\(secs($0)) s" } ?? "–")
          Stat(label: "Wrong notes", value: "\(s.slips)", color: done && s.slips == 0 ? Palette.teal : nil)
          if d.pace.bpm != nil { streakStat } else { Stat(label: "Hints", value: "\(s.hints)") }
        }
      }
    }
  }

  /// Clean rounds in a row at this pace: three move you up a stage.
  var streakStat: some View {
    VStack(alignment: .leading, spacing: 4) {
      Text("In a row").font(.caption).foregroundStyle(Palette.faint).lineLimit(1)
      HStack(spacing: 4) {
        ForEach(0..<3, id: \.self) { i in
          Capsule().fill(i < model.streak ? Palette.teal : Palette.card2).frame(width: 16, height: 8)
        }
        if model.streak > 3 {
          Text("\(model.streak)").font(.caption.weight(.bold)).foregroundStyle(Palette.teal)
        }
      }
      .frame(height: 20)
    }
  }

  func speedColor(_ ms: Int?) -> Color? {
    switch NoteSpeed(ms: ms) {
    case .fast: Palette.teal
    case .ok: Palette.third
    case .slow: Palette.root
    case nil: nil
    }
  }
}

/// The deck's 3-step method, which the hints follow.
struct MethodPanel: View {
  let short: Bool

  var body: some View {
    VStack(alignment: .leading, spacing: short ? 6 : 9) {
      PanelHeader(title: "The 3-step method", symbol: "list.number")
      step(1, Palette.root, .white, "**Anchor:** find it on the low E or A string.")
      step(2, Palette.third, Color(hex: 0x1C1404), "**Octave shape:** 2 strings, 2 frets (+1 past B).")
      step(3, Palette.fifth, .white, "**Name it** out loud, every time.")
    }
    .padding(short ? 14 : 18)
  }

  func step(_ n: Int, _ color: Color, _ ink: Color, _ markdown: String) -> some View {
    HStack(alignment: .firstTextBaseline, spacing: 9) {
      Text("\(n)")
        .font(.caption.weight(.bold))
        .foregroundStyle(ink)
        .frame(width: 20, height: 20)
        .background(color, in: Circle())
        .alignmentGuide(.firstTextBaseline) { $0[VerticalAlignment.center] + 4 }
      Text((try? AttributedString(markdown: markdown)) ?? AttributedString(markdown))
        .font(short ? .footnote : .subheadline)
        .foregroundStyle(Palette.muted)
        .lineLimit(short ? 1 : 2)
        .minimumScaleFactor(0.85)
    }
  }
}

/// After a round: what it means and what to do next.
struct ResultsPanel: View {
  let model: FindNoteModel
  let short: Bool

  var body: some View {
    VStack(alignment: .leading, spacing: short ? 6 : 8) {
      PanelHeader(title: model.resultTitle, symbol: "flag.checkered")
      ScrollView {
        VStack(alignment: .leading, spacing: 6) {
          if model.tips.isEmpty {
            Text("Again (Space) for another round, or change the drill above.")
              .foregroundStyle(Palette.faint)
          }
          ForEach(model.tips) { tip in
            HStack(alignment: .firstTextBaseline, spacing: 8) {
              Circle().fill(color(tip.kind)).frame(width: 7, height: 7)
              Text(tip.text)
                .foregroundStyle(Palette.muted)
                .fixedSize(horizontal: false, vertical: true)
            }
          }
        }
        .font(short ? .footnote : .subheadline)
        .frame(maxWidth: .infinity, alignment: .leading)
      }
      .scrollIndicators(.automatic)
    }
    .padding(short ? 14 : 18)
  }

  func color(_ kind: FindNoteModel.Tip.Kind) -> Color {
    switch kind {
    case .star: Palette.teal
    case .warn: Palette.third
    case .plain: Palette.line2
    }
  }
}

/// The drill, the pace and the keys, from the toolbar's info button.
struct FindNoteHelp: View {
  let model: FindNoteModel

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      Text(model.mode.name).font(.headline)
      Text(model.modeHelp)
      Text("\(model.pace.label): \(model.paceHelp)").foregroundStyle(.secondary)
      Text("Hints follow the 3-step method. The first shows your anchors on the E and A strings (or the landmark notes, when the note is on one of them); the second shows where it is.")
        .foregroundStyle(.secondary)
      Divider()
      Label("The mic hears pitch, not strings. It catches wrong notes and wrong octaves; using the right string is up to you. Use headphones so it doesn’t hear the click.",
            systemImage: "waveform")
        .font(.footnote)
        .foregroundStyle(.secondary)
      Label("Your speed map is kept on this iPad, per tuning.", systemImage: "square.grid.3x3")
        .font(.footnote)
        .foregroundStyle(.secondary)
      Label("Keys: Space start · H hint · S skip · Esc stop · N next note", systemImage: "keyboard")
        .font(.footnote)
        .foregroundStyle(.secondary)
    }
    .font(.subheadline)
    .padding(20)
    .frame(width: 420)
  }
}
