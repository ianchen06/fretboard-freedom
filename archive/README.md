# Archive

Code that's no longer built or shipped, kept for reference.

## `swift-ios/`: native SwiftUI iPad app (archived November 2026)

A SwiftUI version of the practice app, with a Swift port of the web engine (`Packages/FretboardKit`). It covered Pentatonic boxes, Arpeggios and Find any note.

The App Store app is now the Capacitor wrapper in [`../ipad-wrapper`](../ipad-wrapper), which bundles the web app in `../web` so there's one codebase to maintain. The wrapper took over the bundle ID `app.fretboardfreedom.practice`.

Nothing here runs in CI. To build it again, open `swift-ios/FretboardFreedom.xcodeproj` in Xcode and change its bundle ID first, so it doesn't clash with the shipping app.
