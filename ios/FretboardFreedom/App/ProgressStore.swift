// Your progress on this iPad: the learner model (mastery, review intervals, tempos), saved as the
// same JSON the web app's backup uses.
import Foundation
import Observation
import PracticeEngine

@Observable
final class ProgressStore {
  var learner: Learner

  @ObservationIgnored private let url: URL

  init(url: URL? = nil) {
    let file = url ?? URL.applicationSupportDirectory.appending(path: "progress.json")
    self.url = file
    if let data = try? Data(contentsOf: file), let saved = try? JSONDecoder().decode(Learner.self, from: data) {
      learner = saved
    } else {
      learner = Learner(start: .box1)
    }
  }

  func save() {
    do {
      try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
      let encoder = JSONEncoder()
      encoder.outputFormatting = [.sortedKeys]
      try encoder.encode(learner).write(to: url, options: .atomic)
    } catch {
      assertionFailure("Couldn’t save progress: \(error)")
    }
  }
}
