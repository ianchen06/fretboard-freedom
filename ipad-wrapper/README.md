# Fretboard Freedom for iPad (Capacitor)

This iPad app runs the same HTML, CSS, and JavaScript as the web app. Capacitor bundles those files in the app so the practice pages work offline. The wrapper has its own bundle identifier and local practice data. Debug builds appear as **Fretboard Web** on the Home Screen, so you can spot them alongside the SwiftUI app in `../ios`.

## Build and run

From this directory, with Node.js 22 or newer and Xcode installed:

```sh
npm ci
npm run sync
npm run open
```

In Xcode, choose the shared **App** scheme and an iPad simulator, then press **Run**. For a physical iPad, select your development team in **App → Signing & Capabilities**, and enable Developer Mode on the iPad if prompted.

Edit the practice app in `../web`. Run `npm run sync` after changing web files and before building or archiving in Xcode. The generated `www/` and Capacitor bundle contents are ignored by Git. Staging also locks the page zoom in the app's copies of the pages, so pinches and double-taps don't zoom while you practice. The web version stays zoomable.

## Tests

Use **Product → Test** in Xcode with an iPad selected, or run:

```sh
node --test ../web/test/*.test.js
xcodebuild -project ios/App/App.xcodeproj -scheme App \
  -destination 'platform=iOS Simulator,name=iPad Pro 13-inch (M5)' \
  -parallel-testing-enabled NO test
```

The Xcode UI suite navigates through the bundled practice pages, checks that drill settings survive relaunch, and exercises microphone capture and the rhythm worklet. Allow microphone access if iPadOS prompts. To check acoustic accuracy, play a round of **Find any note** and use **Measure by playing** in **Rhythm** on a physical iPad. Repeat with the USB interface and headphones if that is your practice setup.
