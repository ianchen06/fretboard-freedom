// The Hearing card's small instruments: an input meter with the noise gate, and a tuner.
import MusicTheory
import SwiftUI

/// Input level from -80 to 0 dBFS, with the gate marked: a note below the line counts as silence.
public struct LevelMeter: View {
  public var db: Double
  public var gateDb: Double

  public init(db: Double, gateDb: Double) {
    self.db = db
    self.gateDb = gateDb
  }

  func fraction(_ v: Double) -> CGFloat { CGFloat(min(1, max(0, (v + 80) / 80))) }

  public var body: some View {
    GeometryReader { g in
      ZStack(alignment: .leading) {
        Capsule().fill(Palette.card2)
        Capsule()
          .fill(db >= gateDb ? Palette.teal : Palette.faint)
          .frame(width: g.size.width * fraction(db))
          .animation(.linear(duration: 0.05), value: db)
        Rectangle().fill(Palette.third).frame(width: 2).offset(x: g.size.width * fraction(gateDb) - 1)
      }
    }
    .frame(height: 8)
    .accessibilityElement()
    .accessibilityLabel("Input level")
    .accessibilityValue("\(Int(db)) dB")
  }
}

/// The note the mic hears and how far off it is.
public struct TunerReadout: View {
  public var midi: Int?
  public var cents: Double
  public var flat: Bool

  public init(midi: Int?, cents: Double, flat: Bool = false) {
    self.midi = midi
    self.cents = cents
    self.flat = flat
  }

  public var body: some View {
    HStack(spacing: 10) {
      Text(midi.map { Theory.midiLabel(Double($0), preferFlat: flat) } ?? "–")
        .font(.system(size: 22, weight: .bold, design: .rounded))
        .monospacedDigit()
        .foregroundStyle(midi == nil ? Palette.faint : Palette.text)
        .frame(minWidth: 52, alignment: .leading)
        .contentTransition(.numericText())
      GeometryReader { g in
        let w = g.size.width
        ZStack {
          Capsule().fill(Palette.card2).frame(height: 4)
          Rectangle().fill(Palette.line2).frame(width: 1, height: 14)
          if midi != nil {
            let off = CGFloat(max(-50, min(50, cents)) / 50) * (w / 2 - 4)
            Capsule()
              .fill(abs(cents) < 5 ? Palette.teal : abs(cents) < 15 ? Palette.third : Palette.root)
              .frame(width: 4, height: 16)
              .offset(x: off)
              .animation(.snappy(duration: 0.1), value: cents)
          }
        }
        .frame(maxHeight: .infinity)
      }
      .frame(height: 18)
    }
    .accessibilityElement()
    .accessibilityLabel("Tuner")
    .accessibilityValue(midi.map { "\(Theory.midiLabel(Double($0), preferFlat: flat)), \(Int(cents)) cents" } ?? "no note")
  }
}
