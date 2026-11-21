// The app-facing audio engine: the mic, the note tracker, the metronome and the pluck synth behind
// one observable object on the main actor.
@preconcurrency import AVFoundation
import Observation

@MainActor
@Observable
public final class GuitarAudioEngine {
  public enum MicState: Equatable, Sendable {
    case off
    case starting
    case listening
    case denied
    case failed(String)
  }

  /// The pitch the tracker hears right now (for the tuner), or nil.
  public struct LivePitch: Equatable, Sendable {
    public var midi: Int
    public var cents: Double
    public var freq: Double
  }

  /// Something the iPad can listen to: its own mic, a headset, or a USB audio interface or amp
  /// (an amp like the BOSS KATANA:GO shows up as a USB input with its own name).
  public struct AudioInput: Identifiable, Equatable, Sendable {
    public enum Kind: Sendable { case builtInMic, usb, headset, line, other }
    public var id: String
    public var name: String
    public var kind: Kind
    /// A cable from the guitar's signal, so the input hears only the guitar and not the room.
    public var isCable: Bool { kind == .usb || kind == .line }
  }

  public private(set) var micState: MicState = .off
  /// Input level in dBFS, smoothed for the meter.
  public private(set) var levelDb: Double = -120
  public private(set) var livePitch: LivePitch?
  public private(set) var isRunning = false
  public private(set) var sampleRate: Double = 48000

  /// The inputs to choose from. iPadOS lists them only while the mic is open.
  public private(set) var inputs: [AudioInput] = []
  /// The input the tracker is listening to, while the mic is open.
  public private(set) var currentInput: AudioInput?
  /// How many channels the current input delivers. `channel` matters only when it's 2 or more.
  public private(set) var inputChannelCount = 0
  /// The input you picked, or nil to let iPadOS choose. iPadOS uses the device connected last, so
  /// plugging in a USB interface switches to it, and unplugging it goes back to the iPad's mic.
  public private(set) var preferredInputID: String?
  public var inputName: String { currentInput?.name ?? "" }

  /// Noise gate, dBFS. Raise it if the room's noise triggers notes; lower it if soft notes are missed.
  public var gateDb: Double = -50 { didSet { pushSettings() } }
  public var checkOctave = true { didSet { pushSettings() } }
  public var channel: InputChannel = .both { didSet { graph?.input.channel.store(channel.rawValue, ordering: .relaxed) } }
  public var clickVolume: Double = 0.7 {
    didSet { graph?.metronome.volume.store(Float(clickVolume).bitPattern, ordering: .relaxed) }
  }
  /// Your own correction on top of the measured latency, in seconds.
  public var latencyOffset: Double = 0

  /// Called for every note the tracker hears (on the main actor). Screens set it with
  /// setNoteHandler(owner:_:), so one leaving can't clear the handler of the one that replaced it.
  @ObservationIgnored public var onNote: ((NoteEvent) -> Void)?
  @ObservationIgnored private weak var noteOwner: AnyObject?
  /// Called for every analysis frame, 100 a second (for bends).
  @ObservationIgnored public var onFrame: ((PitchFrame) -> Void)?

  @ObservationIgnored private var graph: AudioGraph?
  @ObservationIgnored private var consumer: Task<Void, Never>?
  @ObservationIgnored private var observers: [NSObjectProtocol] = []
  @ObservationIgnored private var lastLevelUpdate = 0.0
  @ObservationIgnored private var metronomeConfig: (bpm: Double, start: Double, perBar: Int)?

  public init() {}

  /// Send the notes heard to `handler`, on behalf of `owner`.
  public func setNoteHandler(owner: AnyObject, _ handler: @escaping (NoteEvent) -> Void) {
    noteOwner = owner
    onNote = handler
  }

  /// Stop sending notes, if `owner` still has the handler.
  public func clearNoteHandler(owner: AnyObject) {
    guard noteOwner === owner else { return }
    noteOwner = nil
    onNote = nil
  }

  /// The host clock, the time base of note events and the metronome.
  public nonisolated func now() -> Double { HostClock.now() }

  /// How late a played note arrives after the click that it was played on: the output's and the
  /// input's latency, plus your correction.
  public var latency: Double {
    #if os(iOS)
    let s = AVAudioSession.sharedInstance()
    return s.outputLatency + s.inputLatency + latencyOffset
    #else
    return 0.03 + latencyOffset
    #endif
  }

  // MARK: Starting and stopping

  /// Start the output (metronome, plucks) without the mic.
  public func startOutput() async {
    if isRunning { return }
    do { try configure(withInput: false) } catch { micState = .failed(error.localizedDescription) }
  }

  /// Ask for the mic and start listening. Safe to call again.
  public func startMic() async {
    if micState == .listening { return }
    micState = .starting
    guard await Self.requestPermission() else {
      micState = .denied
      if !isRunning { await startOutput() }
      return
    }
    do {
      try configure(withInput: true)
      micState = .listening
    } catch {
      micState = .failed(error.localizedDescription)
      try? configure(withInput: false)
    }
  }

  public func stopMic() {
    guard micState == .listening else { return }
    try? configure(withInput: false)
    micState = .off
    livePitch = nil
    levelDb = -120
  }

  /// Listen to this input (an id from `inputs`), or nil to let iPadOS choose. Rebuilds the graph,
  /// since the new input can have another sample rate or number of channels.
  public func selectInput(_ id: String?) {
    preferredInputID = id
    if let id, id == currentInput?.id { return }
    restart()
  }

  public func shutdown() {
    consumer?.cancel()
    consumer = nil
    graph?.stop()
    graph = nil
    isRunning = false
    micState = .off
  }

  private static func requestPermission() async -> Bool {
    #if os(iOS)
    switch AVAudioApplication.shared.recordPermission {
    case .granted: return true
    case .denied: return false
    default: return await AVAudioApplication.requestRecordPermission()
    }
    #else
    return true
    #endif
  }

  private func configure(withInput: Bool) throws {
    consumer?.cancel()
    graph?.stop()
    graph = nil
    isRunning = false

    #if os(iOS)
    let session = AVAudioSession.sharedInstance()
    // Measurement mode turns off the voice processing (echo cancellation, noise suppression, auto
    // gain) that treats a sustained note as noise.
    try session.setCategory(withInput ? .playAndRecord : .playback, mode: withInput ? .measurement : .default,
                            options: withInput ? [.defaultToSpeaker, .allowBluetoothA2DP] : [])
    try? session.setPreferredSampleRate(48000)
    try? session.setPreferredIOBufferDuration(0.005)
    try session.setActive(true)
    if withInput {
      // Changes the route right away, so the input node below already has the new device's format.
      let port = preferredInputID.flatMap { id in session.availableInputs?.first { $0.uid == id } }
      if port == nil { preferredInputID = nil }
      try? session.setPreferredInput(port)
    }
    #endif

    let (stream, continuation) = AsyncStream<AnalysisOutput>.makeStream(bufferingPolicy: .bufferingNewest(512))
    let g = AudioGraph()
    g.input.channel.store(channel.rawValue, ordering: .relaxed)
    g.metronome.volume.store(Float(clickVolume).bitPattern, ordering: .relaxed)
    try g.build(withInput: withInput, continuation: continuation)
    g.worker?.settings.withLock { $0 = TrackerSettings(gateDb: gateDb, checkOctave: checkOctave) }
    try g.start()
    graph = g
    sampleRate = g.outputSampleRate
    inputChannelCount = g.inputChannelCount
    refreshInputs()
    isRunning = true
    if let m = metronomeConfig { startMetronome(bpm: m.bpm, at: m.start, beatsPerBar: m.perBar) }

    consumer = Task { [weak self] in
      for await out in stream {
        guard let self else { return }
        self.handle(out)
      }
    }
    observeSession()
  }

  private func handle(_ out: AnalysisOutput) {
    switch out {
    case .note(let e):
      onNote?(e)
    case .frame(let f):
      onFrame?(f)
      // The meter and tuner at ~30 Hz.
      if f.t - lastLevelUpdate >= 0.033 {
        lastLevelUpdate = f.t
        levelDb = max(f.db, levelDb - 3)
        if let midi = f.midi, let cents = f.cents, let freq = f.freq {
          livePitch = LivePitch(midi: midi, cents: cents, freq: freq)
        } else if !f.loud {
          livePitch = nil
        }
      }
    }
  }

  private func pushSettings() {
    graph?.worker?.settings.withLock { $0 = TrackerSettings(gateDb: gateDb, checkOctave: checkOctave) }
  }

  private func observeSession() {
    guard observers.isEmpty else { return }
    let center = NotificationCenter.default
    // Plugging in an interface or headphones changes the hardware format: rebuild the graph.
    observers.append(center.addObserver(forName: .AVAudioEngineConfigurationChange, object: nil, queue: .main) { [weak self] _ in
      MainActor.assumeIsolated { self?.restart() }
    })
    #if os(iOS)
    observers.append(center.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: .main) { [weak self] note in
      let ended = (note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt) == AVAudioSession.InterruptionType.ended.rawValue
      MainActor.assumeIsolated { if ended { self?.restart() } }
    })
    // A device plugged in or out: update the list. Only update it, because configure() changes the
    // category itself, which posts this too. The configuration change above does the rebuilding.
    observers.append(center.addObserver(forName: AVAudioSession.routeChangeNotification, object: nil, queue: .main) { [weak self] note in
      let reason = (note.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt).flatMap(AVAudioSession.RouteChangeReason.init)
      MainActor.assumeIsolated {
        guard let self else { return }
        // Plugging something in means "use this": drop an earlier pick so iPadOS switches to it.
        if reason == .newDeviceAvailable, self.preferredInputID != nil, self.micState == .listening {
          self.preferredInputID = nil
          self.restart()
        } else {
          self.refreshInputs()
        }
      }
    })
    #endif
  }

  private func refreshInputs() {
    #if os(iOS)
    let session = AVAudioSession.sharedInstance()
    let listening = graph?.worker != nil
    inputs = listening ? (session.availableInputs ?? []).map(AudioInput.init) : []
    currentInput = listening ? session.currentRoute.inputs.first.map(AudioInput.init) : nil
    if let id = preferredInputID, listening, !inputs.contains(where: { $0.id == id }) { preferredInputID = nil }
    #endif
  }

  private func restart() {
    guard isRunning || micState == .listening else { return }
    let withInput = micState == .listening
    do { try configure(withInput: withInput) } catch { micState = .failed(error.localizedDescription) }
  }

  // MARK: Metronome

  /// Start clicking at host time `start` (use now() + a little).
  public func startMetronome(bpm: Double, at start: Double, beatsPerBar: Int = 4) {
    metronomeConfig = (bpm, start, beatsPerBar)
    guard let m = graph?.metronome else { return }
    m.running.store(false, ordering: .relaxed)
    m.start.store(start.bitPattern, ordering: .relaxed)
    m.beat.store((60 / bpm).bitPattern, ordering: .relaxed)
    m.beatsPerBar.store(beatsPerBar, ordering: .relaxed)
    m.running.store(true, ordering: .releasing)
  }

  public func stopMetronome() {
    metronomeConfig = nil
    graph?.metronome.running.store(false, ordering: .relaxed)
  }

  // MARK: Synth

  /// Play a note on a plucked string (for notes tapped on the screen).
  public func pluck(midi: Int) {
    if graph == nil {
      Task {
        await startOutput()
        graph?.pluck(midi: midi)
      }
      return
    }
    graph?.pluck(midi: midi)
  }
}

#if os(iOS)
extension GuitarAudioEngine.AudioInput {
  init(_ port: AVAudioSessionPortDescription) {
    let kind: Kind = switch port.portType {
    case .builtInMic: .builtInMic
    case .usbAudio: .usb
    case .headsetMic: .headset
    case .lineIn: .line
    default: .other
    }
    self.init(id: port.uid, name: port.portName, kind: kind)
  }
}
#endif
