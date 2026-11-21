// The coach: Apple's on-device language model (Foundation Models) puts the grader's numbers into a
// sentence or two of advice. It runs on the iPad, offline, with no account or key.
//
// The split is the web app's: rules compute everything that has to be right (the shape, the grades,
// which notes you missed, the tempo), and the model only talks about those facts. It never sees
// audio and never writes exercise content. Where the model isn't available (an older iPad, Apple
// Intelligence off), the same facts go through a short rule-based coach instead.
import Foundation
import FoundationModels
import Observation
import os

/// What the grader measured, as plain facts for the coach.
public struct PracticeReport: Sendable, Hashable {
  public struct TroubleNote: Sendable, Hashable {
    /// Degree, e.g. "♭7".
    public var degree: String
    /// Note name, e.g. "G".
    public var name: String
    /// "G string fret 7".
    public var place: String
    /// Times missed or played wrong in the recent passes.
    public var count: Int
    public init(degree: String, name: String, place: String, count: Int) {
      self.degree = degree
      self.name = name
      self.place = place
      self.count = count
    }
  }

  public var exercise: String
  public var pattern: String
  public var bpm: Int
  public var passes: Int
  /// Accuracy of the recent passes, 0–1, oldest first.
  public var accuracies: [Double]
  /// Average distance from the click, ms.
  public var timingMs: Double?
  public var cleanStreak: Int
  public var cleanNeeded: Int
  /// "went up from 72 to 76 bpm", "came down to 68 bpm", or nil.
  public var tempoChange: String?
  public var bestBPM: Int
  public var trouble: [TroubleNote]
  /// The exercise's own technique cues: material for the advice.
  public var cues: [String]

  public init(exercise: String, pattern: String, bpm: Int, passes: Int, accuracies: [Double], timingMs: Double?, cleanStreak: Int,
              cleanNeeded: Int, tempoChange: String?, bestBPM: Int, trouble: [TroubleNote], cues: [String] = []) {
    self.exercise = exercise
    self.pattern = pattern
    self.bpm = bpm
    self.passes = passes
    self.accuracies = accuracies
    self.timingMs = timingMs
    self.cleanStreak = cleanStreak
    self.cleanNeeded = cleanNeeded
    self.tempoChange = tempoChange
    self.bestBPM = bestBPM
    self.trouble = trouble
    self.cues = cues
  }

  /// What to work on, decided by rules: the model only phrases it.
  public var focus: CoachFocus {
    let acc = accuracies.last ?? 0
    if acc < 0.9 { return .accuracy }
    if let ms = timingMs, ms > 35 { return .timing }
    if let change = tempoChange, change.hasPrefix("went up") { return .relaxation }
    return .speed
  }

  /// The focus with its target, so the tip is about this player's run.
  var focusDetail: String {
    switch focus {
    case .accuracy:
      if let t = trouble.first { return "accuracy, above all the \(t.degree) (\(t.name), \(t.place)), missed \(t.count)×" }
      return "accuracy: every note clean, even if the tempo has to drop"
    case .timing: return "timing: play each note exactly with the click"
    case .relaxation: return "staying relaxed at the new tempo of \(bpm) bpm"
    case .speed: return "keeping it clean for \(max(1, cleanNeeded - cleanStreak)) more pass\(cleanNeeded - cleanStreak == 1 ? "" : "es") so the tempo goes up"
    }
  }

  /// The rules' reading of the numbers, so the model doesn't have to judge them.
  var assessment: String {
    let acc = accuracies.last ?? 0
    var parts: [String] = []
    parts.append(acc >= 0.9 ? "The notes are right (a clean pass needs 90%)." : "Too many notes slipped for a clean pass (it needs 90%).")
    if let ms = timingMs {
      parts.append(ms <= 35 ? "Timing is tight." : ms <= 60 ? "Timing is close but loose; tighter is better." : "Timing is too loose for a clean pass (it needs ±60 ms).")
    }
    if accuracies.count >= 2, let a = accuracies.dropLast().last {
      parts.append(acc > a + 0.03 ? "Accuracy is improving." : acc < a - 0.03 ? "Accuracy dropped from the pass before." : "Accuracy is steady.")
    }
    let left = cleanNeeded - cleanStreak
    if left > 0 && acc >= 0.9 { parts.append("\(left) more clean pass\(left == 1 ? "" : "es") in a row and the tempo goes up.") }
    return parts.joined(separator: " ")
  }

  /// The facts as the model reads them.
  var prompt: String {
    var lines = [
      "Exercise: \(exercise), played \(pattern), at \(bpm) bpm.",
      "Passes so far: \(passes). Accuracy of the recent passes, oldest first: \(accuracies.map { "\(Int(($0 * 100).rounded()))%" }.joined(separator: ", ")).",
    ]
    if let timingMs { lines.append("Average distance from the click: \(Int(timingMs.rounded())) ms (under 35 ms is tight, over 60 ms is loose).") }
    lines.append("Clean passes in a row: \(cleanStreak) of the \(cleanNeeded) needed for the tempo to go up.")
    if let tempoChange { lines.append("The tempo just \(tempoChange).") }
    if bestBPM > 0 { lines.append("Best clean tempo on this pattern: \(bestBPM) bpm.") }
    if trouble.isEmpty {
      lines.append("No note was missed more than once.")
    } else {
      lines.append("Notes missed or played wrong most: " + trouble.map { "the \($0.degree) (\($0.name), \($0.place)) \($0.count)×" }.joined(separator: "; ") + ".")
    }
    lines.append("What the numbers mean: \(assessment)")
    lines.append("Focus for the next pass: \(focusDetail).")
    if !cues.isEmpty { lines.append("Technique cues you may adapt (don’t copy them word for word): " + cues.joined(separator: " | ")) }
    lines.append("Write one tip for the next pass about that focus.")
    return lines.joined(separator: "\n")
  }
}

@Generable
public enum CoachFocus: String, Sendable, CaseIterable {
  case accuracy, timing, speed, relaxation
}

@Generable
public struct CoachTip: Sendable, Hashable {
  @Guide(description: "An instruction for the next pass in at most seven words, starting with a verb, e.g. 'Aim for the ♭7 on the G string'. Not praise.")
  public var headline: String
  @Guide(description: "Two short sentences. First: what the numbers show, quoting one number or note from the facts. Second: one physical thing to do in the next pass (fretting hand, picking hand, counting, breathing or looking ahead).")
  public var advice: String
  @Guide(description: "What the next pass should focus on")
  public var focus: CoachFocus

  public init(headline: String, advice: String, focus: CoachFocus) {
    self.headline = headline
    self.advice = advice
    self.focus = focus
  }
}

@MainActor
@Observable
public final class PracticeCoach {
  public enum Status: Equatable, Sendable {
    case checking
    /// The on-device model is ready.
    case onDevice
    /// Rule-based tips; the reason the model isn't available.
    case rules(String)
  }

  public private(set) var status: Status = .checking
  public private(set) var tip: CoachTip?
  /// Whether the current tip came from the model.
  public private(set) var tipFromModel = false
  public private(set) var isThinking = false
  @ObservationIgnored private var tipRevision = 0

  static let instructions = """
    You are a patient guitar teacher standing next to the player. Between passes of a practice drill \
    you get what the app's microphone grader measured and what the numbers mean. Give exactly one \
    concrete, practical tip about the focus you are given. Use only the facts given: never invent \
    notes, frets, strings, tempos or numbers, and never suggest a different exercise. Name notes by \
    degree and place exactly as given. Speak to the player directly and warmly, in plain words. \
    Never reply with only praise or a generic phrase like "keep up the good work".
    """

  public init() { refreshAvailability() }

  public func refreshAvailability() {
    switch SystemLanguageModel.default.availability {
    case .available:
      status = .onDevice
    case .unavailable(let reason):
      let why: String = switch reason {
      case .deviceNotEligible: "This iPad doesn’t run Apple Intelligence."
      case .appleIntelligenceNotEnabled: "Turn on Apple Intelligence in Settings for tips from the on-device model."
      case .modelNotReady: "The on-device model is still downloading."
      @unknown default: "The on-device model isn’t available."
      }
      status = .rules(why)
    }
  }

  /// Load the model ahead of the first tip.
  public func prewarm() {
    guard status == .onDevice else { return }
    LanguageModelSession(instructions: Self.instructions).prewarm()
  }

  public func clear() {
    tipRevision += 1
    tip = nil
  }

  /// A tip for the next pass. The rules' tip shows at once; the model's replaces it when it's ready.
  /// If the model is unavailable or fails, the rules' tip stays.
  public func reflect(on report: PracticeReport) async {
    tipRevision += 1
    let revision = tipRevision
    tip = RuleCoach.tip(for: report)
    tipFromModel = false
    guard status == .onDevice, !isThinking else { return }
    isThinking = true
    defer { isThinking = false }
    let started = ContinuousClock.now
    let instructions = Self.instructions
    let prompt = report.prompt
    do {
      // The model gets 45 s (about 10 s on an M-series Mac, 30 s in the simulator); past that the
      // rules' tip stays.
      let answer: CoachTip? = try await withThrowingTaskGroup(of: CoachTip?.self) { group in
        group.addTask {
          let session = LanguageModelSession(instructions: instructions)
          return try await session.respond(to: prompt, generating: CoachTip.self, options: GenerationOptions(temperature: 0.5)).content
        }
        group.addTask {
          try await Task.sleep(for: .seconds(45))
          return nil
        }
        let first = try await group.next() ?? nil
        group.cancelAll()
        return first
      }
      guard revision == tipRevision else { return }
      guard let answer else {
        log.error("Coach model timed out")
        return
      }
      tip = answer
      tipFromModel = true
      log.info("Coach tip in \(ContinuousClock.now - started, privacy: .public): \(answer.headline, privacy: .public) — \(answer.advice, privacy: .public)")
    } catch {
      // Guardrails, context or availability: the rules' tip stays.
      log.error("Coach model failed after \(ContinuousClock.now - started, privacy: .public): \(String(describing: error), privacy: .public)")
    }
  }
}

private let log = Logger(subsystem: "app.fretboardfreedom.practice", category: "coach")

/// The coach without a model: the same facts, fixed sentences.
public enum RuleCoach {
  public static func tip(for r: PracticeReport) -> CoachTip {
    let acc = r.accuracies.last ?? 0
    if let t = r.trouble.first, acc < 0.9 {
      return CoachTip(headline: "Find the \(t.degree) first",
                      advice: "The \(t.degree) (\(t.name), \(t.place)) slipped \(t.count)×. Look at it before the pass starts and aim for it, even if the tempo has to drop.",
                      focus: .accuracy)
    }
    if acc < 0.9 {
      return CoachTip(headline: "Slow enough to be perfect", advice: "\(Int((acc * 100).rounded()))% of the notes landed. Accuracy first: a slower clean pass teaches more than a fast messy one.", focus: .accuracy)
    }
    if let ms = r.timingMs, ms > 60 {
      return CoachTip(headline: "Lock in with the click", advice: "The notes are right, but ±\(Int(ms.rounded())) ms off the grid. Count out loud and make the click disappear under your notes.", focus: .timing)
    }
    if let change = r.tempoChange, change.hasPrefix("went up") {
      return CoachTip(headline: "New tempo, same calm", advice: "The tempo \(change). Keep the fretting hand as light as it was at the slower tempo.", focus: .relaxation)
    }
    return CoachTip(headline: "\(r.cleanStreak) of \(r.cleanNeeded) clean", advice: "Clean and in time. \(r.cleanNeeded - r.cleanStreak) more clean pass\(r.cleanNeeded - r.cleanStreak == 1 ? "" : "es") in a row and the tempo goes up.", focus: .speed)
  }
}
