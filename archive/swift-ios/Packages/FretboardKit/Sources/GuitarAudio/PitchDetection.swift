// Pitch detection for a single guitar note: a port of web/js/pitch.js, with the inner loops on vDSP.
//
// YIN: the YIN estimator (de Cheveigné & Kawahara, 2002) on one frame of audio.
// NoteTracker: turns a stream of frames into "a note was played" events. It needs the pitch to hold
// steady for a moment before reporting it, and it reports the same pitch again only after a new pick
// attack, so a ringing string isn't counted twice and a re-picked one is.
import Accelerate
import Foundation

@inlinable func dbToLin(_ db: Double) -> Double { pow(10, db / 20) }
@inlinable func linToDb(_ v: Double) -> Double { v > 0 ? 20 * log10(v) : -120 }

/// Energy at one frequency (Goertzel), Hann-windowed.
func toneEnergy(_ x: [Float], freq: Double, sampleRate sr: Double) -> Double {
  let n = x.count
  let w = 2 * cos(2 * Double.pi * freq / sr)
  var s1 = 0.0, s2 = 0.0
  let k = 2 * Double.pi / Double(n - 1)
  for i in 0..<n {
    let s0 = Double(x[i]) * (0.5 - 0.5 * cos(k * Double(i))) + w * s1 - s2
    s2 = s1
    s1 = s0
  }
  return s1 * s1 + s2 * s2 - w * s1 * s2
}

/// A new note an octave (or a 12th, or two octaves) above one that's still ringing makes a mix that
/// repeats at the lower note's period, so YIN hears the old note. What gives it away is which
/// harmonics just got louder: only every m-th one means the new note is at m × f0. Returns m (1 = no shift).
func harmonicShift(pre: [Float], post: [Float], f0: Double, sampleRate sr: Double) -> Int {
  let h = min(10, Int(floor(min(sr / 2.2, 9000) / f0)))
  if h < 4 { return 1 }
  var a = [0.0], b = [0.0]
  for k in 1...h {
    a.append(toneEnergy(pre, freq: Double(k) * f0, sampleRate: sr))
    b.append(toneEnergy(post, freq: Double(k) * f0, sampleRate: sr))
  }
  let eps = b.reduce(0, +) * 2e-3 + 1e-12
  // Each harmonic's gain counts equally (geometric mean), so one loud fundamental can't mask the rest.
  var logGain = [0.0]
  for k in 1...h { logGain.append(log((b[k] + eps) / (a[k] + eps))) }
  var best = 1
  var bestScore = 0.0
  for m in [4, 3, 2] where 2 * m <= h {
    var inSum = 0.0, inN = 0.0, outSum = 0.0, outN = 0.0
    for k in 1...h {
      if k % m == 0 { inSum += logGain[k]; inN += 1 } else { outSum += logGain[k]; outN += 1 }
    }
    let gIn = exp(inSum / inN)
    let gOut = exp(outSum / outN)
    let score = gIn / gOut
    if gIn > 2.5 && gOut < 1.6 && score > 3 && score > bestScore { best = m; bestScore = score }
  }
  return best
}

public struct YIN: Sendable {
  public let sampleRate: Double
  let tauMax: Int
  let tauMin: Int
  /// Integration window; leaves room for lag tauMax + 1.
  let window: Int
  public var threshold: Float
  var d: [Float]

  public init(sampleRate: Double, size: Int, minFreq: Double = 60, maxFreq: Double = 1400, threshold: Float = 0.15) {
    self.sampleRate = sampleRate
    tauMax = min(size / 2, Int(ceil(sampleRate / minFreq)))
    tauMin = max(2, Int(floor(sampleRate / maxFreq)))
    window = size - tauMax - 1
    self.threshold = threshold
    d = Array(repeating: 0, count: tauMax + 2)
  }

  /// freq in Hz, and cmnd (0…1+): the aperiodicity, lower = clearer pitch.
  public mutating func detect(_ x: UnsafeBufferPointer<Float>) -> (freq: Double, cmnd: Double) {
    let (tauMax, tauMin, w) = (tauMax, tauMin, vDSP_Length(window))
    guard let base = x.baseAddress else { return (0, 1) }
    d.withUnsafeMutableBufferPointer { d in
      // Difference function: d(τ) = Σ (x[j] − x[j+τ])².
      for tau in 1...(tauMax + 1) {
        var sum: Float = 0
        vDSP_distancesq(base, 1, base + tau, 1, &sum, w)
        d[tau] = sum
      }
      // Cumulative mean normalized difference, in place.
      d[0] = 1
      var running: Float = 0
      for tau in 1...(tauMax + 1) {
        running += d[tau]
        d[tau] = running > 0 ? d[tau] * Float(tau) / running : 1
      }
    }
    // First dip under the threshold, walked down to its local minimum.
    var tau = -1
    var t = tauMin
    while t <= tauMax {
      if d[t] < threshold {
        while t + 1 <= tauMax && d[t + 1] < d[t] { t += 1 }
        tau = t
        break
      }
      t += 1
    }
    if tau < 0 {
      // Nothing under the threshold: report the global minimum; the caller judges it by cmnd.
      tau = tauMin
      for t in (tauMin + 1)...tauMax where d[t] < d[tau] { tau = t }
    }
    let a = Double(d[tau - 1]), b = Double(d[tau]), c = Double(d[tau + 1])
    let den = a - 2 * b + c
    let shift = den > 0 ? max(-0.5, min(0.5, 0.5 * (a - c) / den)) : 0
    return (sampleRate / (Double(tau) + shift), b)
  }
}

/// A note the tracker heard.
public struct NoteEvent: Sendable, Hashable {
  public var midi: Int
  public var freq: Double
  public var cents: Double
  /// When it was reported, in seconds on the input clock.
  public var t: Double
  /// When it was most likely picked: the attack, when one was heard.
  public var playedAt: Double
}

/// One analysis frame: level, pitch and (sometimes) a note.
public struct PitchFrame: Sendable, Hashable {
  public var t: Double
  public var rms: Double
  public var db: Double
  public var loud: Bool
  public var freq: Double?
  public var midi: Int?
  public var cents: Double?
  public var cmnd: Double?
  public var event: NoteEvent?
}

public struct NoteTracker: Sendable {
  public let decimation: Int
  public let sampleRate: Double
  public let size: Int
  var work: [Float]
  let minFreq: Double
  let maxFreq: Double
  var yin: YIN
  /// ~20 ms for loudness and attacks.
  let recentN: Int

  /// Below this RMS the input counts as silence.
  public var gate = dbToLin(-50)
  /// YIN aperiodicity allowed for a note.
  public var maxCmnd = 0.2
  /// Seconds a pitch must hold (over at least 2 frames) before it counts.
  public var stableTime = 0.045
  /// Seconds a new pitch must hold to count without a new pick attack.
  public var legatoTime = 0.1
  /// Loudness jump that marks a possible pick attack.
  public var onsetRatio = 1.6
  /// Seconds after the jump to check it was a real attack, not a click.
  public var confirmDelay = 0.08
  public var confirmRatio = 1.15
  public var a4 = 440.0
  /// "Check the octave": tell a new note an octave up from the ringing one below it.
  public var checkOctave = true

  struct Level { var t: Double; var rms: Double }
  struct Past { var t: Double; var data: [Float]; var rms: Double }
  struct Pending { var t: Double; var pre: Double; var consumed: Bool }

  var history: [Level] = []
  var candidate: (midi: Int, n: Int, t0: Double)?
  var lastEmit: Int?
  var segment: Set<Int> = []
  var recent: [(midi: Int, t: Double)] = []
  var past: [Past] = []
  var attackPre: [Float]?
  var attackPreMidi: Int?
  var armed = false
  var pending: Pending?
  var lastOnsetT = -Double.infinity
  var quietSince: Double?
  var peak = 0.0

  public var gateDb: Double {
    get { linToDb(gate) }
    set { gate = dbToLin(newValue) }
  }

  /// frameSize: samples per frame at sampleRate. Frames are decimated to ~24 kHz before analysis.
  public init(sampleRate: Double, frameSize: Int, minFreq: Double = 60, maxFreq: Double = 1400) {
    decimation = max(1, Int((sampleRate / 24000).rounded()))
    self.sampleRate = sampleRate / Double(decimation)
    size = frameSize / decimation
    work = Array(repeating: 0, count: size)
    self.minFreq = minFreq
    self.maxFreq = maxFreq
    yin = YIN(sampleRate: self.sampleRate, size: size, minFreq: minFreq, maxFreq: maxFreq)
    recentN = min(size, Int((self.sampleRate * 0.02).rounded()))
  }

  /// The frame size that suits a sample rate: ~42 ms at 44.1/48 kHz, larger at higher rates so the
  /// low strings still fit twice.
  public static func frameSize(forSampleRate sr: Double) -> Int {
    let decim = max(1, Int((sr / 24000).rounded()))
    return 1 << Int(ceil(log2(Double(1024 * decim))))
  }

  public mutating func reset() {
    history = []
    candidate = nil
    lastEmit = nil
    segment = []
    recent = []
    past = []
    attackPre = nil
    attackPreMidi = nil
    armed = false
    pending = nil
    lastOnsetT = -.infinity
    quietSince = nil
    peak = 0
  }

  public mutating func process(_ frame: [Float], at t: Double) -> PitchFrame {
    frame.withUnsafeBufferPointer { process($0, at: t) }
  }

  /// One frame (the newest frameSize samples), ending at time t.
  public mutating func process(_ frame: UnsafeBufferPointer<Float>, at t: Double) -> PitchFrame {
    // Decimate with a box filter (also a gentle low-pass).
    let offset = frame.count - size * decimation
    for i in 0..<size {
      var s: Float = 0
      let base = offset + i * decimation
      for k in 0..<decimation { s += frame[base + k] }
      work[i] = s / Float(decimation)
    }
    var sq: Float = 0
    work.withUnsafeBufferPointer { w in vDSP_svesq(w.baseAddress! + (size - recentN), 1, &sq, vDSP_Length(recentN)) }
    let rms = Double((sq / Float(recentN)).squareRoot())
    let loud = rms >= gate

    // Quietest level in the 12–60 ms before now: the baseline an attack must jump over.
    // If frames arrive slowly, fall back to the previous frame.
    var prevMin = Double.infinity
    for h in history where h.t <= t - 0.012 && h.t >= t - 0.06 { prevMin = min(prevMin, h.rms) }
    if prevMin == .infinity { prevMin = history.last?.rms ?? 0 }
    history.append(Level(t: t, rms: rms))
    while let first = history.first, first.t < t - 0.3 { history.removeFirst() }
    past.append(Past(t: t, data: work, rms: rms))
    while past.count > 2 && past[1].t <= t - 0.08 { past.removeFirst() }

    // Attack detection, confirmed a little later so a metronome click over a ringing note doesn't count.
    let sinceOnset = t - lastOnsetT
    if loud && pending == nil && sinceOnset > 0.1 && (prevMin < gate || rms > onsetRatio * prevMin) {
      pending = Pending(t: t, pre: prevMin, consumed: false)
      lastOnsetT = t
      // Keep the newest frame that ends before the attack (≥ 45 ms old), if a note was ringing then.
      let before = past.last { $0.t <= t - 0.045 }
      attackPre = before.flatMap { $0.rms >= gate && lastEmit != nil ? $0.data : nil }
      attackPreMidi = lastEmit
    }
    if let p = pending, t - p.t >= confirmDelay {
      if rms >= gate && rms >= confirmRatio * p.pre {
        if !p.consumed { armed = true }
        peak = rms
      }
      pending = nil
    }

    if !loud {
      if quietSince == nil { quietSince = t }
      if let q = quietSince, t - q > 0.1 {
        lastEmit = nil
        segment.removeAll()
        candidate = nil
        peak = 0
        armed = false
      }
    } else {
      quietSince = nil
    }
    peak = max(peak, rms)

    var info = PitchFrame(t: t, rms: rms, db: linToDb(rms), loud: loud)
    guard loud else { return info }

    let r = work.withUnsafeBufferPointer { yin.detect($0) }
    info.cmnd = r.cmnd
    guard r.cmnd <= maxCmnd && r.freq >= minFreq && r.freq <= maxFreq else {
      candidate = nil
      return info
    }
    var freq = r.freq
    // Right after an attack over a ringing note, if YIN still hears the old note, check whether the
    // new note sits an octave (or a 12th, or two octaves) above it.
    if checkOctave, let pre = attackPre, t - lastOnsetT < 0.5,
       Int((69 + 12 * log2(freq / a4)).rounded()) == attackPreMidi {
      let m = harmonicShift(pre: pre, post: work, f0: freq, sampleRate: sampleRate)
      if m > 1 { freq *= Double(m) }
    }
    let mf = 69 + 12 * log2(freq / a4)
    let midi = Int(mf.rounded())
    info.freq = freq
    info.midi = midi
    info.cents = (mf - Double(midi)) * 100

    if let c = candidate, c.midi == midi { candidate!.n = c.n + 1 } else { candidate = (midi, 1, t) }
    let cand = candidate!
    let held = t - cand.t0
    if cand.n >= 2 && held >= stableTime {
      let attack = armed || pending != nil || lastEmit == nil
      let isNew = !segment.contains(midi)
      let emit: Bool
      if armed || lastEmit == nil {
        emit = true // a confirmed new pick, or the first note after silence
      } else if pending != nil {
        emit = isNew // a pick in progress: a new pitch can't wait (same pitch waits for confirmation)
      } else {
        // No new pick: a hammer-on or slide. It must hold a little longer and come while the note is
        // still strong; a pitch deep in the decay is usually the detector slipping an octave. A pitch
        // reported in the last few seconds is most likely another string still ringing.
        let ringing = recent.contains { $0.midi == midi && t - $0.t < 3 }
        emit = isNew && !ringing && held >= legatoTime && rms >= 0.3 * peak
      }
      if emit {
        let playedAt = t - lastOnsetT < 0.4 ? lastOnsetT : t - held
        info.event = NoteEvent(midi: midi, freq: freq, cents: info.cents ?? 0, t: t, playedAt: playedAt)
        if attack { segment.removeAll() }
        segment.insert(midi)
        attackPre = nil // this attack has its answer
        recent.removeAll { t - $0.t >= 3 }
        recent.append((midi, t))
        lastEmit = midi
        armed = false
        if pending != nil { pending!.consumed = true }
      }
    }
    return info
  }
}
