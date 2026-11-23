// The practice sidebar. The app opens on the page you had open last.
import FretboardUI
import SwiftUI

enum PracticeModule: String, CaseIterable, Identifiable, Hashable {
  case boxes, arpeggios, findNote, scales, licks, rhythm, session, songwriting

  var id: String { rawValue }

  var title: String {
    switch self {
    case .boxes: ShapePracticeMode.boxes.title
    case .arpeggios: ShapePracticeMode.arpeggios.title
    case .findNote: "Find any note"
    case .scales: "Scales"
    case .licks: "Call & response"
    case .rhythm: "Rhythm"
    case .session: "Daily session"
    case .songwriting: "Song writing 寫歌"
    }
  }

  var symbol: String {
    switch self {
    case .boxes: "square.grid.3x2.fill"
    case .arpeggios: "music.note.list"
    case .findNote: "scope"
    case .scales: "point.3.connected.trianglepath.dotted"
    case .licks: "bubble.left.and.bubble.right.fill"
    case .rhythm: "metronome.fill"
    case .session: "calendar.badge.clock"
    case .songwriting: "music.quarternote.3"
    }
  }

  var isReady: Bool { self == .boxes || self == .arpeggios || self == .findNote }

  var blurb: String {
    switch self {
    case .boxes: "The five boxes in any key, as sequences against the click. The mic checks every note."
    case .arpeggios: "Play the tones of a chord in five positions across the neck."
    case .findNote: "One note everywhere and flash cards, with the 3-step hint method and a speed map."
    case .scales: "Any scale across the whole neck: CAGED shapes, routes up and down, and a band to jam with."
    case .licks: "The band plays a lick, you play it back. Every lick lands on a chord tone."
    case .rhythm: "Every strum and chug timed to the millisecond against the click or the drums."
    case .session: "60 to 120 minutes planned fresh each day from your grades: warm-up, technique, rhythm, scales, apply it."
    case .songwriting: "Chords, lyrics and a melody that follows the Mandarin tones, with a band to play it back."
    }
  }
}

struct RootView: View {
  /// The page open last. A launch argument sets it too: `-ff.page findNote`.
  @AppStorage("ff.page") private var page: PracticeModule = .boxes

  var body: some View {
    NavigationSplitView {
      List(selection: Binding<PracticeModule?>(get: { page }, set: { if let p = $0 { page = p } })) {
        Section("Practice") {
          ForEach(PracticeModule.allCases) { m in
            NavigationLink(value: m) {
              Label {
                VStack(alignment: .leading, spacing: 2) {
                  Text(m.title)
                  if !m.isReady { Text("Coming next").font(.caption2).foregroundStyle(.secondary) }
                }
              } icon: {
                Image(systemName: m.symbol).foregroundStyle(m.isReady ? Palette.third : Palette.faint)
              }
            }
          }
        }
      }
      .navigationTitle("Fretboard Freedom")
    } detail: {
      switch page {
      case .boxes: ShapePracticeScreen(mode: .boxes)
      case .arpeggios: ShapePracticeScreen(mode: .arpeggios)
      case .findNote: FindNoteScreen()
      case let other: PlannedModuleView(module: other)
      }
    }
  }
}

struct PlannedModuleView: View {
  let module: PracticeModule

  var body: some View {
    ContentUnavailableView {
      Label(module.title, systemImage: module.symbol)
    } description: {
      Text(module.blurb)
    } actions: {
      Text("It runs on the same engine as Pentatonic boxes.").font(.footnote).foregroundStyle(.secondary)
    }
    .background(Palette.background)
    .navigationTitle(module.title)
  }
}
