# Putting Fretboard Freedom on the App Store

A first-timer's path from this folder to the App Store, in order. Steps marked **you** need your Apple ID, your money or your iPad; nobody else can do them.

Plan on about a week: enrolling takes a day or two, testing on your iPad takes as long as you want, and review usually takes a day or two.

## Already done in this repo

- **Release build.** The app builds in Release for a real iPad, and the engine's tests pass.
- **App icon.** A starter icon in `FretboardFreedom/Assets.xcassets/AppIcon.appiconset/AppIcon.png`: A minor pentatonic box 1 on a slice of rosewood, in the app's colors. It's drawn by `ios/Tools/MakeAppIcon.swift`, so you can tweak it and run `swift ios/Tools/MakeAppIcon.swift` again, or drop in your own 1024 × 1024 PNG with no transparency.
- **Privacy manifest.** `FretboardFreedom/PrivacyInfo.xcprivacy` says the app collects and tracks nothing, and gives Apple's required reasons for the two "required reason" APIs it uses: `UserDefaults` (settings) and `mach_absolute_time` (note timing). App Store Connect rejects an upload without it.
- **Export compliance.** `ITSAppUsesNonExemptEncryption = NO` in the Info.plist, because the app uses no encryption. Without it, App Store Connect asks you about encryption on every build.
- **Version.** 1.0, build 1.
- **Privacy policy and support pages.** `docs/privacy.html` and `docs/support.html`. Apple requires both URLs for every app. They need hosting (step 5) and a real email address first.

## Decide first

Some of these can't be changed later.

| Decision | What to know | Suggestion |
|---|---|---|
| **Bundle ID** | `app.fretboardfreedom.practice`. Once you upload a build with it, it's the app's ID forever. It doesn't have to match a domain you own, but it has to be unique across the App Store. | Keep it, unless you'd rather use your own domain backwards (`com.yourname.fretboardfreedom`). Change `PRODUCT_BUNDLE_IDENTIFIER` in both build configurations before step 3. |
| **Individual or organization account** | Individual: quick, and your legal name is shown as the seller. Organization: shows a company name, but needs a legal entity and a D-U-N-S number, which can take a couple of weeks. | Individual, unless you already have a company. |
| **App name** | Up to 30 characters, and it must not be taken by another app. You'll find out in step 4. | "Fretboard Freedom". If it's taken: "Fretboard Freedom: Guitar". |
| **Price** | A free app needs no bank or tax forms. A paid app or in-app purchases need the Paid Apps agreement, a bank account and tax forms first. | Free for 1.0. Charging can come later. |
| **The "Coming next" pages** | Six of the seven sidebar pages are placeholders. App Review guideline 2.1 asks for complete apps with no placeholder content, and a sidebar of "Coming next" pages is a common reason for rejection. | Hide them in 1.0 and add each page in an update as it's built. |
| **Where it's sold** | Mainland China needs a government ICP filing number before Apple will list an app there. In the EU, you have to declare whether you're a "trader"; a trader's address, phone and email are shown on the EU product page. | Leave out China mainland for 1.0. Declare your EU status in App Store Connect › Business. |
| **Mac and Vision Pro** | iPad apps are offered on Apple silicon Macs and Apple Vision Pro by default. The app hasn't been tested on either. | Turn both off in Pricing and Availability for 1.0. |

## 1. Set up your Mac (once) · you

Point the command-line tools at Xcode, so `xcodebuild` works in Terminal:

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
```

Then open Xcode › Settings › Accounts, press **+**, and sign in with your Apple ID.

## 2. Join the Apple Developer Program · you

1. Go to [developer.apple.com/programs/enroll](https://developer.apple.com/programs/enroll/) and sign in with the Apple ID you'll use for the app. It needs two-factor authentication turned on.
2. Choose Individual (or Organization, see above), check your legal name, and pay US$99 a year (or the local price).
3. Apple usually approves an individual within 48 hours and emails you. Then you can sign in at [appstoreconnect.apple.com](https://appstoreconnect.apple.com).

**While you wait:** run the app in the iPad simulator (open `ios/FretboardFreedom.xcodeproj`, pick an iPad simulator at the top of the window, press ⌘R).

You can also put the app on your own iPad with a free Apple ID (Xcode's "Personal Team"): it stops opening after 7 days. If you do, change the bundle ID for that test (add `.test` to the end) and change it back afterwards, so the real ID stays free for your paid account.

## 3. Run it on your iPad · you

This is the most important step. The mic path has never had a real guitar through it (see "Not checked yet" in [README.md](README.md)), and the reviewer will notice if the app's main feature doesn't work.

1. Connect the iPad to the Mac with a cable and tap **Trust** on the iPad.
2. In Xcode, click the blue **FretboardFreedom** project at the top of the file list, then the **FretboardFreedom** target, then **Signing & Capabilities**. Leave "Automatically manage signing" on and pick your team. Xcode creates your certificate and registers the bundle ID.
3. Pick your iPad at the top of the window and press ⌘R. The first time, the iPad asks you to turn on **Developer Mode** (Settings › Privacy & Security › Developer Mode) and restart.

Check, with your guitar:

- [ ] The mic prompt appears and the text makes sense. Deny it once: the app should still open and say how to turn the mic on.
- [ ] Every note of box 1 in A minor is heard once, at slow and fast tempos.
- [ ] Grades feel right in time, with wired headphones and with the speaker. Try Bluetooth too, since many people will use it.
- [ ] The coach writes a tip (on an iPad with Apple Intelligence on), and says why when it can't.
- [ ] Both landscape orientations. The status bar doesn't crowd the titles.
- [ ] A call, FaceTime or Siri in the middle of a pass, then back to practice.
- [ ] Leave the app and come back. Quit it and reopen it: progress and settings are kept.

## 4. Create the app in App Store Connect · you

In App Store Connect, open **Apps**, press **+**, then **New App**:

- **Platforms:** iOS
- **Name:** Fretboard Freedom
- **Primary language:** English (U.S.)
- **Bundle ID:** pick `app.fretboardfreedom.practice` from the list. It appears there after step 3.
- **SKU:** any private ID, e.g. `FRETBOARDFREEDOM1`
- **User access:** Full access

## 5. Put the privacy and support pages online · you

1. In `docs/privacy.html` and `docs/support.html`, replace `support@example.com` (two places, marked `TODO`) with the address you want to show publicly. Consider a separate address: it will be public.
2. Host the `docs/` folder anywhere that serves static pages over https. The simplest, if this repository is public on GitHub: **Settings › Pages › Deploy from a branch › main › /docs**. The pages are then at `https://<your-github-username>.github.io/fretboard-freedom/privacy.html` and `.../support.html`. (GitHub Pages for a private repository needs a paid GitHub plan; Netlify and Cloudflare Pages host one folder for free.)
3. Open both URLs in a browser to check they load.

## 6. Upload a build · you

1. In Xcode, pick **Any iOS Device (arm64)** at the top of the window.
2. **Product › Archive.** When it's done, the Organizer window opens with the archive.
3. Press **Validate App** and fix anything it reports.
4. Press **Distribute App › App Store Connect › Distribute**. Xcode signs it for the store and uploads it.
5. After 5–30 minutes, App Store Connect emails you that the build has processed.

Every upload needs a new **build number**: raise **Build** (`CURRENT_PROJECT_VERSION`) under the target's General tab, 1, 2, 3… Leave **Version** at 1.0 until 1.0 is released.

## 7. Test the store build with TestFlight · you

The store build is a Release build: optimized, and without the `-FFDemo` mode. Test it before sending it to review.

1. In App Store Connect › your app › **TestFlight**, create an internal testing group and add yourself.
2. Install **TestFlight** from the App Store on your iPad, open the invite, and install the app.
3. Go through the checklist in step 3 again.

To let friends test, add them to an external group. Their first build goes through a short Beta App Review.

## 8. Fill in the store page · you

On the app's page in App Store Connect, under **1.0 Prepare for Submission** and the sections in the sidebar. A draft for each text field is below.

| Field | Limit | Notes |
|---|---|---|
| Name | 30 | Fretboard Freedom |
| Subtitle | 30 | Shown under the name |
| Promotional text | 170 | Can be changed any time without a new version |
| Description | 4,000 | Only describe what's in this version |
| Keywords | 100 | Comma-separated. Words in the name are already searched; don't repeat them |
| Support URL | | `.../support.html` |
| Privacy Policy URL | | `.../privacy.html` |
| Category | | Music; secondary: Education |
| Copyright | | `2026 <your legal name>` |
| Age rating | | Answer the questionnaire: no violence, no web access, no user content, no ads. It should come out as the lowest rating. |
| **App Privacy** | | Choose **"No, we do not collect data from this app."** That's true: nothing leaves the iPad. |
| Screenshots | 1–10 | Required for the 13-inch iPad: 2752 × 2064 px in landscape. Smaller iPads reuse them. |

**Screenshots** can be taken from the iPad Pro 13-inch simulator with the `-FFDemo` launch argument, which plays the box in time with a few wrong notes, so the grades on screen look like real practice.

### Draft text

**Subtitle:** Guitar practice that listens

**Promotional text:** Play the five pentatonic boxes in any key against the click. The mic checks every note, and the tempo climbs as you play cleanly.

**Description:**

> Fretboard Freedom is guitar practice that listens. Play your guitar and the iPad checks every note: right or wrong, early or late.
>
> PENTATONIC BOXES
> Learn all five boxes of the minor and major pentatonic and the blues scale, in any key. Play each one up and down, in 3s, in 4s and in 3rds. The neck lights the box and rings the next note, and the tab follows along as you play.
>
> A CLICK THAT KEEPS UP WITH YOU
> Play a pass cleanly and the tempo goes up. Struggle twice and it comes back down. You always practice at the edge of what you can play.
>
> GRADES YOU CAN USE
> Wrong notes flash on the neck as you play. After each pass, see how many notes you hit, how close you were to the click, your clean-pass streak and your best clean tempo.
>
> A COACH ON YOUR iPAD
> On iPads with Apple Intelligence, a coach turns your grades into one tip for the next pass. It runs on your iPad: free, offline and private.
>
> PRIVATE BY DESIGN
> Sound from the mic is analyzed on your iPad and never recorded or sent anywhere. No account, no ads, no tracking.
>
> Requires a guitar. Works with the iPad's built-in microphone. Designed for landscape.

**Keywords:** `guitar,pentatonic,scales,blues,practice,metronome,lead,solo,improvise,lessons,tempo,drills,minor`

### App Review notes

Under **App Review Information**, give a name, phone and email Apple can reach you at (they're not shown publicly), and leave **Sign-in required** off. In **Notes**, tell the reviewer how to try the app without a guitar:

> Fretboard Freedom checks guitar playing through the microphone. No account is needed and the app makes no network requests.
>
> To try it without a guitar: open "Pentatonic boxes" and tap the notes on the fretboard. Each tap plays the note and counts it as played. Press Start to hear the click. The app asks for the microphone the first time you press Start or Listen; if you deny it, tapping notes still works.
>
> The coach card uses Apple's on-device Foundation Models when Apple Intelligence is available. Without it, the app shows its built-in tips and says why.

## 9. Submit · you

1. Under **Build**, press **+** and pick the TestFlight build you tested.
2. Choose how to release it once approved: **Manually** lets you pick the day.
3. Press **Add for Review**, then **Submit to App Review**.

Most apps get an answer within a day or two. If it's rejected, the message names the guideline. Fix it and reply in App Store Connect, or upload a new build (with a new build number) and submit again. A rejection is common on a first app and isn't held against you.

Common reasons, and how this app stands:

- **2.1 Completeness:** placeholder content or crashes. The "Coming next" pages are the risk; see "Decide first".
- **2.3 Accurate metadata:** screenshots and the description must show the app as it is. The draft only describes box practice.
- **5.1.1 Data and privacy:** a clear mic prompt, an app that still works without the mic, and a privacy policy. All three are in place.
- **4.2 Minimum functionality:** one practice page with the mic, the grader, the tempo ladder and the coach should be enough. The reviewer can't judge it without a guitar, which is why the review notes matter.

## Each update after 1.0

1. Raise **Version** (1.1, 1.2…) and set **Build** back to 1, or keep counting up.
2. Archive, upload, and test in TestFlight.
3. In App Store Connect, press **+** next to the version list, add **What's New in This Version**, pick the build and submit.

## Still to watch

- **`UIRequiresFullScreen`** is what locks the app to landscape. Apple deprecated it in iOS 26 and says a future release will ignore it, so Xcode shows a warning. It doesn't stop an upload today. When iPadOS stops honoring it, the app still works in any window size (see [README.md](README.md)), but that layout needs testing first.
- **The icon** is a flat image. iPadOS 26 adds its glass effects automatically. For icons with separate layers, tinted and dark versions, Apple's Icon Composer app (with Xcode) makes a `.icon` file.
