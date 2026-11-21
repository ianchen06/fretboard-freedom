// Find any note keeps its own progress, as on the web app: the speed map (`ff.stats`), clean rounds
// in a row per drill and pace (`ff.streaks`), where you are on the circle of 4ths (`ff.circle`) and
// the last 50 rounds (`ff.history`). Saved as find-note.json in Application Support.
import Foundation
import PracticeEngine

struct FindNoteProgress: Codable {
  struct Round: Codable {
    var at: String
    var mode: String
    var pace: String
    var note: String?
    var total: Int
    var hits: Int
    var avgMs: Int?
  }

  var stats = NoteStats()
  /// "everywhere|s1" → clean rounds in a row.
  var streaks: [String: Int] = [:]
  /// The next note on the circle of 4ths (0 = C).
  var circle = 0
  var history: [Round] = []

  static func streakKey(_ mode: FindNoteMode, _ pace: FindNotePace) -> String { "\(mode.rawValue)|\(pace.rawValue)" }

  static let url = URL.applicationSupportDirectory.appending(path: "find-note.json")

  static func load(from url: URL = url) -> FindNoteProgress {
    guard let data = try? Data(contentsOf: url),
          let saved = try? JSONDecoder().decode(FindNoteProgress.self, from: data) else { return FindNoteProgress() }
    return saved
  }

  func save(to url: URL = Self.url) {
    do {
      try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
      let encoder = JSONEncoder()
      encoder.outputFormatting = [.sortedKeys]
      try encoder.encode(self).write(to: url, options: .atomic)
    } catch {
      assertionFailure("Couldn’t save the speed map: \(error)")
    }
  }
}
