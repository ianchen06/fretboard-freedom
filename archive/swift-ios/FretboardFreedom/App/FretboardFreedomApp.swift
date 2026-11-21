import Coach
import FretboardUI
import GuitarAudio
import SwiftUI

@main
struct FretboardFreedomApp: App {
  @State private var audio = GuitarAudioEngine()
  @State private var progress = ProgressStore()
  @State private var coach = PracticeCoach()

  var body: some Scene {
    WindowGroup {
      RootView()
        .environment(audio)
        .environment(progress)
        .environment(coach)
        .preferredColorScheme(.dark)
        .tint(Palette.third)
    }
  }
}
