// The real-time half of the audio engine. Nothing in this file is actor-isolated: the render blocks
// run on Core Audio's real-time thread, so they only read atomics and write preallocated memory.
//
//   inputNode ─▶ AVAudioSinkNode ─▶ SampleRing ─▶ PitchWorker thread (NoteTracker, 100 frames/s) ─▶ AsyncStream
//   Metronome AVAudioSourceNode (clicks computed from the host clock) ─┐
//   Pluck players (Karplus–Strong buffers) ────────────────────────────┴─▶ mainMixerNode ─▶ output
//
// Input and output share one clock, the host clock in seconds (mach_absolute_time), so a note's
// time and the click grid can be compared directly.
@preconcurrency import AVFoundation
import Darwin
import Synchronization

/// The host clock in seconds: the clock both the input timestamps and the metronome use.
public enum HostClock {
  static let secondsPerTick: Double = {
    var info = mach_timebase_info_data_t()
    mach_timebase_info(&info)
    return Double(info.numer) / Double(info.denom) / 1e9
  }()

  public static func now() -> Double { Double(mach_absolute_time()) * secondsPerTick }
  @inline(__always) static func seconds(_ hostTime: UInt64) -> Double { Double(hostTime) * secondsPerTick }
}

/// Which input channel to listen to. An audio interface often has the guitar on only one of them.
public enum InputChannel: Int, Sendable, CaseIterable, Identifiable {
  case both, left, right
  public var id: Int { rawValue }
  public var name: String {
    switch self {
    case .both: "Both"
    case .left: "1 · Left"
    case .right: "2 · Right"
    }
  }
}

/// Single-producer single-consumer ring of mono samples. The producer is the input render thread.
final class SampleRing: @unchecked Sendable {
  let capacity: Int
  private let mask: Int
  private let storage: UnsafeMutablePointer<Float>
  /// first: samples written in total; second: the host time (Double bits) just after the last one.
  private let state = Atomic<WordPair>(WordPair(first: 0, second: 0))

  init(capacity: Int = 1 << 16) {
    precondition(capacity & (capacity - 1) == 0, "capacity must be a power of two")
    self.capacity = capacity
    mask = capacity - 1
    storage = .allocate(capacity: capacity)
    storage.initialize(repeating: 0, count: capacity)
  }

  deinit { storage.deallocate() }

  /// Producer: append samples; `endTime` is the host time just after the last one.
  @inline(__always) func write(_ count: Int, endTime: Double, sample: (Int) -> Float) {
    let total = Int(state.load(ordering: .relaxed).first)
    for i in 0..<count { storage[(total + i) & mask] = sample(i) }
    state.store(WordPair(first: UInt(total + count), second: UInt(endTime.bitPattern)), ordering: .releasing)
  }

  /// Consumer: samples written so far, and the host time just after the newest.
  func snapshot() -> (total: Int, endTime: Double) {
    let s = state.load(ordering: .acquiring)
    return (Int(s.first), Double(bitPattern: UInt64(s.second)))
  }

  /// Consumer: copy `count` samples ending (exclusively) at absolute index `end`.
  func copy(endingAt end: Int, count: Int, into out: UnsafeMutablePointer<Float>) {
    for i in 0..<count { out[i] = storage[(end - count + i) & mask] }
  }

  func reset() { state.store(WordPair(first: 0, second: 0), ordering: .releasing) }
}

/// What the render thread needs to play the click: everything is an atomic.
final class MetronomeState: Sendable {
  let running = Atomic<Bool>(false)
  /// Host time of beat 0 (Double bits).
  let start = Atomic<UInt64>(0)
  /// Seconds per beat (Double bits).
  let beat = Atomic<UInt64>((0.5).bitPattern)
  let beatsPerBar = Atomic<Int>(4)
  /// 0–1 (Float bits).
  let volume = Atomic<UInt32>(Float(0.7).bitPattern)
}

/// Input settings the render thread reads.
final class InputState: Sendable {
  let channel = Atomic<Int>(InputChannel.both.rawValue)
}

/// Results from the analysis thread, in order.
enum AnalysisOutput: Sendable {
  case frame(PitchFrame)
  case note(NoteEvent)
}

/// Tracker settings the UI can change while the worker runs.
struct TrackerSettings: Sendable {
  var gateDb: Double = -50
  var checkOctave = true
}

/// Runs the NoteTracker on its own thread, 100 frames a second, from the ring.
final class PitchWorker: @unchecked Sendable {
  let ring: SampleRing
  let sampleRate: Double
  let frameSize: Int
  let hop: Int
  let settings = Mutex(TrackerSettings())
  private let stopFlag = Atomic<Bool>(false)
  private let continuation: AsyncStream<AnalysisOutput>.Continuation
  private var thread: Thread?

  init(ring: SampleRing, sampleRate: Double, continuation: AsyncStream<AnalysisOutput>.Continuation) {
    self.ring = ring
    self.sampleRate = sampleRate
    frameSize = NoteTracker.frameSize(forSampleRate: sampleRate)
    hop = Int((sampleRate * 0.01).rounded())
    self.continuation = continuation
  }

  func start() {
    stopFlag.store(false, ordering: .relaxed)
    let t = Thread { [self] in run() }
    t.name = "Pitch analysis"
    t.qualityOfService = .userInteractive
    thread = t
    t.start()
  }

  func stop() { stopFlag.store(true, ordering: .relaxed) }

  private func run() {
    var tracker = NoteTracker(sampleRate: sampleRate, frameSize: frameSize)
    var applied = TrackerSettings()
    tracker.gateDb = applied.gateDb
    let frame = UnsafeMutablePointer<Float>.allocate(capacity: frameSize)
    defer { frame.deallocate() }
    var nextEnd = -1
    while !stopFlag.load(ordering: .relaxed) {
      let wanted = settings.withLock { $0 }
      if wanted.gateDb != applied.gateDb || wanted.checkOctave != applied.checkOctave {
        applied = wanted
        tracker.gateDb = wanted.gateDb
        tracker.checkOctave = wanted.checkOctave
      }
      let (total, endTime) = ring.snapshot()
      if nextEnd < 0 { if total >= frameSize { nextEnd = total } }
      // Fell too far behind (the app was suspended): skip to the newest audio.
      if nextEnd >= 0 && total - nextEnd > ring.capacity - frameSize - hop { nextEnd = total; tracker.reset() }
      while nextEnd >= 0 && nextEnd <= total {
        ring.copy(endingAt: nextEnd, count: frameSize, into: frame)
        let t = endTime - Double(total - nextEnd) / sampleRate
        let info = tracker.process(UnsafeBufferPointer(start: frame, count: frameSize), at: t)
        continuation.yield(.frame(info))
        if let e = info.event { continuation.yield(.note(e)) }
        nextEnd += hop
      }
      Thread.sleep(forTimeInterval: 0.004)
    }
  }
}

/// The AVAudioEngine graph. Created and torn down from the main actor, but its methods and the
/// render blocks they create are nonisolated.
final class AudioGraph: @unchecked Sendable {
  let engine = AVAudioEngine()
  let metronome = MetronomeState()
  let ring = SampleRing()
  let input = InputState()
  private(set) var worker: PitchWorker?
  private var sink: AVAudioSinkNode?
  private var click: AVAudioSourceNode?
  private var players: [AVAudioPlayerNode] = []
  private var nextPlayer = 0
  private var pluckCache: [Int: AVAudioPCMBuffer] = [:]
  private var outputFormat: AVAudioFormat?

  var outputSampleRate: Double { outputFormat?.sampleRate ?? 48000 }

  /// Build the graph. withInput: also listen to the mic (needs permission).
  func build(withInput: Bool, continuation: AsyncStream<AnalysisOutput>.Continuation) throws {
    let out = engine.outputNode.outputFormat(forBus: 0)
    let sr = out.sampleRate > 0 ? out.sampleRate : 48000
    guard let mono = AVAudioFormat(standardFormatWithSampleRate: sr, channels: 1) else { throw AudioError.format }
    outputFormat = mono

    let clickNode = Self.makeClickNode(state: metronome, sampleRate: sr)
    engine.attach(clickNode)
    engine.connect(clickNode, to: engine.mainMixerNode, format: mono)
    click = clickNode

    for _ in 0..<4 {
      let p = AVAudioPlayerNode()
      engine.attach(p)
      engine.connect(p, to: engine.mainMixerNode, format: mono)
      players.append(p)
    }

    if withInput {
      let input = engine.inputNode
      let format = input.outputFormat(forBus: 0)
      guard format.sampleRate > 0, format.channelCount > 0 else { throw AudioError.noInput }
      ring.reset()
      let sinkNode = Self.makeSinkNode(ring: ring, input: self.input, sampleRate: format.sampleRate)
      engine.attach(sinkNode)
      engine.connect(input, to: sinkNode, format: format)
      sink = sinkNode
      let w = PitchWorker(ring: ring, sampleRate: format.sampleRate, continuation: continuation)
      worker = w
    }
    engine.prepare()
  }

  func start() throws {
    try engine.start()
    worker?.start()
    for p in players { p.play() }
  }

  func stop() {
    worker?.stop()
    worker = nil
    engine.stop()
    for n in [sink as AVAudioNode?, click] + players.map({ $0 as AVAudioNode? }) {
      if let n { engine.detach(n) }
    }
    sink = nil
    click = nil
    players = []
  }

  /// A plucked string (Karplus–Strong), for notes tapped on the screen.
  func pluck(midi: Int, volume: Float = 0.55) {
    guard engine.isRunning, !players.isEmpty, let format = outputFormat else { return }
    let buffer = pluckCache[midi] ?? Self.renderPluck(midi: midi, format: format)
    pluckCache[midi] = buffer
    let p = players[nextPlayer % players.count]
    nextPlayer += 1
    p.volume = volume
    p.scheduleBuffer(buffer, at: nil, options: .interrupts)
    if !p.isPlaying { p.play() }
  }

  static func renderPluck(midi: Int, format: AVAudioFormat) -> AVAudioPCMBuffer {
    let sr = format.sampleRate
    let freq = 440 * pow(2, Double(midi - 69) / 12)
    let p = max(2, Int((sr / freq - 0.5).rounded())) // the averaging filter adds half a sample
    let len = AVAudioFrameCount(sr * 1.8)
    let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: len)!
    buffer.frameLength = len
    let data = buffer.floatChannelData![0]
    var ring = [Float](repeating: 0, count: p)
    var prev: Float = 0
    var rng = SystemRandomNumberGenerator()
    for i in 0..<p { prev = 0.6 * prev + 0.4 * Float.random(in: -1...1, using: &rng); ring[i] = prev }
    let decay = Float(0.996 - min(0.006, freq / 200000))
    let fade = Float(sr * 0.05)
    for i in 0..<Int(len) {
      let k = i % p
      let out = ring[k]
      ring[k] = decay * 0.5 * (ring[k] + ring[(k + 1) % p])
      data[i] = out * min(1, Float(Int(len) - i) / fade)
    }
    return buffer
  }

  /// Input: mix (or pick) channels into the ring, timestamped with the host clock.
  static func makeSinkNode(ring: SampleRing, input: InputState, sampleRate: Double) -> AVAudioSinkNode {
    AVAudioSinkNode { timestamp, frameCount, bufferList -> OSStatus in
      let n = Int(frameCount)
      let abl = UnsafeMutableAudioBufferListPointer(UnsafeMutablePointer(mutating: bufferList))
      let ts = timestamp.pointee
      let start = ts.mFlags.contains(.hostTimeValid) ? HostClock.seconds(ts.mHostTime) : HostClock.now() - Double(n) / sampleRate
      let end = start + Double(n) / sampleRate
      guard abl.count > 0, let d0 = abl[0].mData?.assumingMemoryBound(to: Float.self) else { return noErr }
      let pick = input.channel.load(ordering: .relaxed)
      if abl.count >= 2, let d1 = abl[1].mData?.assumingMemoryBound(to: Float.self) {
        // Non-interleaved stereo.
        switch pick {
        case InputChannel.left.rawValue: ring.write(n, endTime: end) { d0[$0] }
        case InputChannel.right.rawValue: ring.write(n, endTime: end) { d1[$0] }
        default: ring.write(n, endTime: end) { 0.5 * (d0[$0] + d1[$0]) }
        }
      } else {
        let ch = max(1, Int(abl[0].mNumberChannels))
        if ch == 1 {
          ring.write(n, endTime: end) { d0[$0] }
        } else {
          // Interleaved.
          switch pick {
          case InputChannel.left.rawValue: ring.write(n, endTime: end) { d0[$0 * ch] }
          case InputChannel.right.rawValue: ring.write(n, endTime: end) { d0[$0 * ch + 1] }
          default: ring.write(n, endTime: end) { 0.5 * (d0[$0 * ch] + d0[$0 * ch + 1]) }
          }
        }
      }
      return noErr
    }
  }

  /// A woodblock-like noise click, unpitched on purpose so the note detector ignores it. Each sample
  /// is a pure function of the host time, so the grid never drifts and a tempo change is a new start.
  static func makeClickNode(state: MetronomeState, sampleRate sr: Double) -> AVAudioSourceNode {
    let len = Int(sr * 0.03)
    var table = [Float](repeating: 0, count: len)
    var g = SystemRandomNumberGenerator()
    for i in 0..<len { table[i] = Float.random(in: -1...1, using: &g) * Float(exp(-Double(i) / (sr * 0.005))) }
    let clickTable = table
    let dt = 1 / sr
    return AVAudioSourceNode { isSilence, timestamp, frameCount, bufferList -> OSStatus in
      let abl = UnsafeMutableAudioBufferListPointer(bufferList)
      let n = Int(frameCount)
      let running = state.running.load(ordering: .relaxed)
      let ts = timestamp.pointee
      var silent = true
      let start = Double(bitPattern: state.start.load(ordering: .relaxed))
      let beat = Double(bitPattern: state.beat.load(ordering: .relaxed))
      let perBar = max(1, state.beatsPerBar.load(ordering: .relaxed))
      let vol = Float(bitPattern: state.volume.load(ordering: .relaxed))
      let t0 = ts.mFlags.contains(.hostTimeValid) ? HostClock.seconds(ts.mHostTime) : HostClock.now()
      for buf in abl {
        guard let data = buf.mData?.assumingMemoryBound(to: Float.self) else { continue }
        for i in 0..<n {
          var v: Float = 0
          if running && beat > 0 {
            let rel = t0 + Double(i) * dt - start
            if rel >= 0 {
              let k = (rel / beat).rounded(.down)
              let j = Int((rel - k * beat) * sr)
              if j < len {
                let accent = Int(k) % perBar == 0
                v = clickTable[j] * vol * (accent ? 1 : 0.6)
                silent = false
              }
            }
          }
          data[i] = v
        }
      }
      isSilence.pointee = ObjCBool(silent)
      return noErr
    }
  }
}

enum AudioError: LocalizedError {
  case format, noInput
  var errorDescription: String? {
    switch self {
    case .format: "The audio format isn’t supported."
    case .noInput: "No audio input is available."
    }
  }
}
