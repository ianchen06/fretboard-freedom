// The detector against synthetic plucked strings: a port of web/test/pitch.test.js.
import Foundation
import Testing
@testable import GuitarAudio

private let sr = 48000.0
private let frameSize = 2048

/// Deterministic noise.
private struct Noise {
  var seed: UInt32 = 12345
  mutating func next() -> Double {
    seed = seed &* 1103515245 &+ 12345
    return Double(seed & 0x7fffffff) / Double(0x7fffffff) * 2 - 1
  }
}

private func midiToFreq(_ m: Int) -> Double { 440 * pow(2, Double(m - 69) / 12) }

/// A plucked string: inharmonic partials shaped by pick position, higher partials decay faster.
private func pluck(_ buf: inout [Float], at start: Double, _ midi: Int, amp: Double = 0.3, dur: Double = 2,
                   pickPos: Double = 0.18, fundGain: Double = 1, noise: inout Noise) {
  let f0 = midiToFreq(midi)
  let n0 = Int(start * sr)
  let len = min(buf.count - n0, Int(dur * sr))
  var n = 1
  while Double(n) * f0 < 6000 && n <= 30 {
    let fn = Double(n) * f0 * (1 + 0.0001 * Double(n * n)).squareRoot()
    var a = abs(sin(Double(n) * .pi * pickPos)) / Double(n)
    if n == 1 { a *= fundGain }
    let decay = 1.2 + 0.6 * Double(n)
    let ph = noise.next() * .pi
    for i in 0..<len {
      let t = Double(i) / sr
      buf[n0 + i] += Float(amp * a * min(1, t / 0.003) * exp(-decay * t) * sin(2 * .pi * fn * t + ph))
    }
    n += 1
  }
}

/// Noise-burst metronome click, like the app's.
private func click(_ buf: inout [Float], at start: Double, amp: Double = 0.4, noise: inout Noise) {
  let n0 = Int(start * sr)
  for i in 0..<Int(0.03 * sr) { buf[n0 + i] += Float(amp * noise.next() * exp(-Double(i) / (0.006 * sr))) }
}

/// Laptop-mic-ish: 2nd-order high-pass that thins out the low strings' fundamentals, plus hiss.
private func micColor(_ buf: inout [Float], fc: Double = 180, noiseDb: Double = -60, noise: inout Noise) {
  let w = tan(Double.pi * fc / sr)
  let k = 2.0.squareRoot()
  let norm = 1 / (1 + k * w + w * w)
  let (b0, b1, b2) = (norm, -2 * norm, norm)
  let a1 = 2 * (w * w - 1) * norm, a2 = (1 - k * w + w * w) * norm
  var x1 = 0.0, x2 = 0.0, y1 = 0.0, y2 = 0.0
  let nAmp = pow(10, noiseDb / 20)
  for i in buf.indices {
    let x = Double(buf[i])
    let y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
    x2 = x1; x1 = x; y2 = y1; y1 = y
    buf[i] = Float(y + nAmp * noise.next())
  }
}

private func run(_ buf: [Float], fps: Double = 60) -> [NoteEvent] {
  var tracker = NoteTracker(sampleRate: sr, frameSize: frameSize)
  tracker.gateDb = -48
  var events: [NoteEvent] = []
  var t = Double(frameSize) / sr
  buf.withUnsafeBufferPointer { b in
    while t <= Double(buf.count) / sr {
      let end = Int(t * sr)
      let frame = UnsafeBufferPointer(rebasing: b[(end - frameSize)..<end])
      if let e = tracker.process(frame, at: t).event { events.append(e) }
      t += 1 / fps
    }
  }
  return events
}

@Suite("Note tracker")
struct NoteTrackerTests {
  @Test(arguments: [("direct", 0.0, 1.0), ("laptop mic", 180.0, 1.0), ("weak fundamental", 250.0, 0.3)])
  func everyNoteReportedOnce(profile: (String, Double, Double)) {
    var bad: [String] = []
    for m in 36...84 {
      var noise = Noise()
      var buf = [Float](repeating: 0, count: Int(sr * 2.2))
      pluck(&buf, at: 0.2, m, fundGain: profile.2, noise: &noise)
      if profile.1 > 0 { micColor(&buf, fc: profile.1, noise: &noise) }
      let got = run(buf).map(\.midi)
      if got != [m] { bad.append("\(m): \(got)") }
    }
    #expect(bad.isEmpty, "\(profile.0): \(bad.joined(separator: " | "))")
  }

  fileprivate static let scenarios: [(String, [Int], @Sendable (inout [Float], inout Noise) -> Void)] = [
    ("same note picked twice", [55, 55], { b, n in pluck(&b, at: 0.2, 55, noise: &n); pluck(&b, at: 1.0, 55, noise: &n) }),
    ("metronome click over a ringing note", [55], { b, n in pluck(&b, at: 0.2, 55, noise: &n); click(&b, at: 0.9, noise: &n); click(&b, at: 1.4, noise: &n) }),
    ("clicks only", [], { b, n in click(&b, at: 0.5, noise: &n); click(&b, at: 1.0, noise: &n); click(&b, at: 1.5, noise: &n) }),
    ("silence", [], { _, _ in }),
    ("two different notes", [45, 52], { b, n in pluck(&b, at: 0.2, 45, noise: &n); pluck(&b, at: 0.9, 52, noise: &n) }),
    ("octave up while the lower string rings on", [43, 55], { b, n in pluck(&b, at: 0.2, 43, dur: 2.3, noise: &n); pluck(&b, at: 1.0, 55, dur: 1.5, noise: &n) }),
    ("unison on the next string", [55, 55], { b, n in pluck(&b, at: 0.2, 55, dur: 2.3, noise: &n); pluck(&b, at: 1.0, 55, dur: 1.5, pickPos: 0.3, noise: &n) }),
    ("quiet note (−30 dB)", [52], { b, n in pluck(&b, at: 0.2, 52, amp: 0.02, noise: &n) }),
    ("octave up, quieter than the ringing note", [60, 72], { b, n in pluck(&b, at: 0.2, 60, amp: 0.5, dur: 2.3, noise: &n); pluck(&b, at: 1.0, 72, amp: 0.25, dur: 1.5, noise: &n) }),
    ("wrong note, then the right one", [47, 48], { b, n in pluck(&b, at: 0.2, 47, dur: 2.3, noise: &n); pluck(&b, at: 0.9, 48, dur: 1.5, noise: &n) }),
  ]

  @Test(arguments: scenarios.indices)
  func behaviour(_ i: Int) {
    let (name, want, build) = Self.scenarios[i]
    var noise = Noise()
    var buf = [Float](repeating: 0, count: Int(sr * 2.5))
    build(&buf, &noise)
    micColor(&buf, noise: &noise)
    for fps in [100.0, 60, 15] {
      #expect(run(buf, fps: fps).map(\.midi) == want, "\(name) at \(Int(fps)) fps")
    }
  }

  @Test func fastPickingOnOneString() {
    var noise = Noise()
    var buf = [Float](repeating: 0, count: Int(sr * 2.5))
    for (i, m) in [43, 45, 47, 48].enumerated() { pluck(&buf, at: 0.2 + Double(i) * 0.18, m, dur: 0.18, noise: &noise) }
    micColor(&buf, noise: &noise)
    for fps in [100.0, 60] { #expect(run(buf, fps: fps).map(\.midi) == [43, 45, 47, 48]) }
  }

  @Test func playedAtSitsOnTheAttack() throws {
    var noise = Noise()
    var buf = [Float](repeating: 0, count: Int(sr * 1.5))
    pluck(&buf, at: 0.5, 57, noise: &noise)
    micColor(&buf, noise: &noise)
    let e = try #require(run(buf, fps: 100).first)
    #expect(e.t - 0.5 < 0.15, "reported within 150 ms")
    #expect(abs(e.playedAt - 0.5) < 0.04, "playedAt within 40 ms of the attack")
  }
}
