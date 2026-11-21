// The tempo ladder: clean passes in a row take the tempo up, two rough passes take it down
// (onPass in web/js/scales-app.js).

public struct TempoLadder: Sendable, Hashable {
  public enum Verdict: Sendable, Hashable {
    /// Enough clean passes in a row: the tempo went up.
    case up(from: Int, to: Int)
    /// Two rough passes: the tempo came down.
    case down(from: Int, to: Int)
    /// A clean pass, `streak` of `needed` in a row.
    case clean(streak: Int, needed: Int)
    case rough
  }

  public private(set) var bpm: Int
  public let step: Int
  public var automatic: Bool
  /// The fastest tempo of a clean pass in this run.
  public private(set) var cleanBPM = 0
  /// Whether the run had to slow down.
  public private(set) var struggled = false
  var bad = 0

  public init(bpm: Int, notesPerBeat: Double, automatic: Bool = true) {
    self.bpm = Tempo.clamp(bpm)
    self.step = Tempo.step(notesPerBeat)
    self.automatic = automatic
  }

  public mutating func set(bpm: Int) { self.bpm = Tempo.clamp(bpm) }
  public mutating func faster() { set(bpm: bpm + step) }
  public mutating func slower() { set(bpm: bpm - step) }

  /// After each pass. Resets the grader's clean streak when the tempo goes up.
  public mutating func record(_ result: SequenceGrader.PassResult, grader: inout SequenceGrader) -> Verdict {
    if result.clean { cleanBPM = max(cleanBPM, bpm) }
    if automatic {
      if result.clean && grader.cleanStreak >= grader.cleanNeeded {
        grader.resetCleanStreak()
        bad = 0
        let was = bpm
        faster()
        return .up(from: was, to: bpm)
      }
      if !result.clean && result.accuracy < 0.6 {
        bad += 1
        if bad >= 2 {
          bad = 0
          struggled = true
          let was = bpm
          slower()
          return .down(from: was, to: bpm)
        }
      } else {
        bad = 0
      }
    }
    return result.clean ? .clean(streak: grader.cleanStreak, needed: grader.cleanNeeded) : .rough
  }
}
