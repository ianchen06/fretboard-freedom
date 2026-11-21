# Putting Fretboard Freedom on the App Store

The App Store app is this Capacitor wrapper: it bundles `../web`, so the iPad app and the website stay one codebase. (The earlier SwiftUI app is in [`../archive/swift-ios`](../archive/swift-ios).)

GitHub Actions builds, tests, signs and uploads it ([`.github/workflows/ios.yml`](../.github/workflows/ios.yml)). Steps marked **you** need your Apple ID, your Apple Developer account or your iPad.

## Already done in this repo

- **Bundle ID** `app.fretboardfreedom.practice`, team `VTX9N56A38`, iPad only, version 1.0. Once a build with this ID is uploaded, it's the app's ID for good.
- **App icon** (`ios/App/App/Assets.xcassets/AppIcon.appiconset`), 1024 × 1024 with no transparency.
- **Privacy manifest** (`ios/App/App/PrivacyInfo.xcprivacy`): no tracking, no data collected. Capacitor's framework carries its own manifest for the APIs it uses.
- **Export compliance**: `ITSAppUsesNonExemptEncryption = NO`, so App Store Connect doesn't ask about encryption on every build.
- **Mic prompt** text in `Info.plist`.
- **Privacy and support pages** (`docs/privacy.html`, `docs/support.html`), deployed to GitHub Pages by the CI workflow on every push to `main`:
  `https://ianchen06.github.io/fretboard-freedom/privacy.html` and `.../support.html`. Replace `support@example.com` (marked `TODO`) in both with a public address first.
- **CI**: every pull request or push to `main` that touches `web/` or `ipad-wrapper/` builds the app and runs the UI tests on an iPad simulator. The mic test is skipped there because hosted runners have no audio input; run it locally (see [README.md](README.md)).

## What CI does on a release

Pushing a tag `ios-vX.Y.Z` (or running the **iOS** workflow by hand with **upload** ticked):

1. Runs the UI tests.
2. Stages `web/` into the app with `npm run sync`.
3. Archives a Release build with version `X.Y.Z` from the tag (by hand: the version in the project) and build number = the workflow's run number, so every upload is higher than the last.
4. Signs it with your Apple Distribution certificate and App Store profile, and uploads it to App Store Connect with your API key.
5. Keeps the `.xcarchive` as a workflow artifact for 30 days.

The build appears in TestFlight once App Store Connect has processed it (5–30 minutes). Submitting it for review is still a button you press (step 6).

## 1. Join the Apple Developer Program · you

[developer.apple.com/programs/enroll](https://developer.apple.com/programs/enroll/), US$99 a year. An individual account is usually approved within 48 hours.

## 2. Create the app in App Store Connect · you

1. In [Certificates, Identifiers & Profiles › Identifiers](https://developer.apple.com/account/resources/identifiers/list), register an App ID with the bundle ID `app.fretboardfreedom.practice` (no capabilities needed). If you ran the app on your iPad from Xcode with automatic signing, it's already there.
2. In [App Store Connect](https://appstoreconnect.apple.com) › **Apps** › **+** › **New App**: platform iOS, name **Fretboard Freedom**, language English (U.S.), that bundle ID, any SKU (e.g. `FRETBOARDFREEDOM1`).

## 3. Make the signing files and API key · you

You need three things. Do this once; the certificate and profile last a year.

**a. Apple Distribution certificate (.p12)**

1. Xcode › Settings › Accounts › your team › **Manage Certificates…** › **+** › **Apple Distribution**.
2. Right-click the new certificate › **Export Certificate…**, save it as `dist.p12` and set a password.

**b. App Store provisioning profile (.mobileprovision)**

1. [Profiles](https://developer.apple.com/account/resources/profiles/list) › **+** › **App Store Connect** › App ID `app.fretboardfreedom.practice` › the distribution certificate from (a).
2. Name it, e.g. `Fretboard Freedom App Store`, and download it.

**c. App Store Connect API key (.p8)**

1. App Store Connect › **Users and Access** › **Integrations** › **App Store Connect API** › **Team Keys** › **+**.
2. Name it `GitHub Actions`, access **App Manager**.
3. Download the `AuthKey_XXXXXXXXXX.p8` (you can only download it once). Note the **Key ID** and the **Issuer ID** shown above the list.

## 4. Add them to GitHub · you

In the repository: **Settings › Environments › New environment** named `app-store`. Under it, optionally add yourself as a **required reviewer** (every upload then waits for your click) and limit deployment to tags matching `ios-v*` plus the `main` branch. Then add these **environment secrets**:

| Secret | Value |
|---|---|
| `IOS_DIST_CERT_P12_BASE64` | `base64 -i dist.p12 \| pbcopy`, then paste |
| `IOS_DIST_CERT_PASSWORD` | the .p12 password |
| `IOS_APPSTORE_PROFILE_BASE64` | `base64 -i "Fretboard_Freedom_App_Store.mobileprovision" \| pbcopy` |
| `ASC_KEY_ID` | the Key ID |
| `ASC_ISSUER_ID` | the Issuer ID |
| `ASC_KEY_P8_BASE64` | `base64 -i AuthKey_XXXXXXXXXX.p8 \| pbcopy` |

Or with the GitHub CLI, from the folder holding the files:

```bash
gh secret set IOS_DIST_CERT_P12_BASE64 --env app-store < <(base64 -i dist.p12)
```

```bash
gh secret set IOS_APPSTORE_PROFILE_BASE64 --env app-store < <(base64 -i Fretboard_Freedom_App_Store.mobileprovision)
```

```bash
gh secret set ASC_KEY_P8_BASE64 --env app-store < <(base64 -i AuthKey_XXXXXXXXXX.p8)
```

```bash
gh secret set IOS_DIST_CERT_PASSWORD --env app-store
```

```bash
gh secret set ASC_KEY_ID --env app-store
```

```bash
gh secret set ASC_ISSUER_ID --env app-store
```

Then delete the local copies, or keep them in your password manager. Never commit them (`.gitignore` blocks `*.p12`, `*.mobileprovision` and `AuthKey_*.p8`).

## 5. Ship a build to TestFlight · you

```bash
git tag ios-v1.0.0 && git push origin ios-v1.0.0
```

Watch it under **Actions › iOS**. When it's done, App Store Connect › your app › **TestFlight**: create an internal group, add yourself, and install it with the TestFlight app on your iPad.

Check, with your guitar, on a real iPad:

- [ ] The mic prompt appears and reads well. Deny it once: the app still opens and the pages say how to turn the mic on.
- [ ] Every page in the sidebar loads offline (turn on Airplane Mode).
- [ ] Find any note hears each note; Rhythm's **Measure by playing** grades in time, with the built-in mic and with a USB interface if you use one.
- [ ] Both orientations. A call or Siri mid-drill, then back to practice.
- [ ] Quit and reopen: settings and progress are kept.

A fix is a new tag (`ios-v1.0.1`), or re-run the workflow by hand to upload the same version with a higher build number.

## 6. Fill in the store page and submit · you

| Field | Notes |
|---|---|
| Subtitle (30) | Guitar practice that listens |
| Category | Music; secondary Education |
| Support URL / Privacy Policy URL | the GitHub Pages URLs above |
| Copyright | `2026 <your legal name>` |
| Age rating | No objectionable content, no web access, no user-generated content shared with others. Should come out lowest. |
| App Privacy | **"No, we do not collect data from this app."** |
| Screenshots | 13-inch iPad: 2064 × 2752 portrait or 2752 × 2064 landscape. Take them in the iPad Pro 13-inch (M5) simulator with ⌘S. |
| Pricing and Availability | Free. Turn off Mac and Apple Vision Pro availability for 1.0 (untested there). Leave out China mainland (needs an ICP filing). |

**Description draft** (only describe what's in the build):

> Fretboard Freedom is guitar practice that listens. Play your guitar and the iPad checks every note: right or wrong, early or late.
>
> FIND ANY NOTE — Learn every note on the neck with flash cards and "one note everywhere" drills, timed against a two-second goal.
>
> SCALES AND ARPEGGIOS — Pentatonic, blues and more in any key and position, with chord-tone arpeggios.
>
> CALL & RESPONSE — A backing band plays a lick; you answer it.
>
> RHYTHM — Tighten your timing against the click, measured from what you actually play.
>
> DAILY SESSION — A practice plan that puts it all together.
>
> PRIVATE BY DESIGN — Sound from the mic is analyzed on your iPad and never recorded or sent anywhere. No account, no ads, no tracking. Works offline.

**App Review notes:**

> Fretboard Freedom checks guitar playing through the microphone. No account is needed and the app makes no network requests; all pages are bundled and work offline. The app asks for the microphone only when you turn listening on in a practice page; every page can be browsed without it. <Before submitting, add one or two sentences on what a reviewer can try without a guitar.>

Then under **Build** pick the TestFlight build, choose **Manually release**, and **Submit to App Review**.

### Review risks for a web-based app

- **4.2 Minimum functionality.** Apple rejects apps that are "a repackaged website". This one is fully offline, uses the mic for real-time pitch and timing analysis, and keeps progress on the device, which is the usual answer, but say so in the review notes as above. If it's rejected under 4.2, adding a native touch (e.g. haptics on a correct note via a Capacitor plugin) and replying with what's native usually resolves it.
- **2.1 Completeness.** Every sidebar page must work; no "coming soon" placeholders.
- **5.1.1 Privacy.** Clear mic prompt, works without the mic, privacy policy URL. All in place once the support email is filled in.

## Each update

1. Change `web/` (and `ipad-wrapper/` if needed), merge to `main`. CI runs the tests.
2. Tag `ios-v1.1.0` and push. TestFlight gets the build.
3. In App Store Connect, **+** next to the versions, add **What's New**, pick the build, submit.

The certificate and profile expire after a year: make new ones (step 3a–b) and update the two secrets. If uploads fail with an authentication error, check the API key wasn't revoked.
