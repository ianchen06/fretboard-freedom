# Fretboard Freedom · Practice app

Interactive drills from the deck. You play your guitar, and the microphone checks every note. It's plain HTML, CSS and JavaScript with no build step. The only third-party code is the optional neural amp engine in `vendor/nam/` (see below).

## Run it

The browser only allows microphone access on `localhost` or `https`, so serve the folder rather than opening the file:

```bash
python3 -m http.server 8765 --directory web
```

Then open http://localhost:8765/tuner.html (Tuner), http://localhost:8765/pickups.html (Pickup height), http://localhost:8765/session.html (Daily session), http://localhost:8765 (Find any note), http://localhost:8765/scales.html (Scales), http://localhost:8765/licks.html (Call & response), http://localhost:8765/rhythm.html (Rhythm) or http://localhost:8765/write.html (Song writing) in Chrome, Edge, Firefox or Safari and click **Enable microphone**.

### On a phone or tablet (iPhone Safari, Android Chrome)

A phone can't use `localhost`, and `http://<your computer's IP>` isn't allowed to open the mic. Serve over https instead:

```bash
python3 web/tools/serve-https.py
```

It prints `https://<IP>:8443/...` addresses. Open one on the phone (same Wi-Fi). The certificate is self-signed, so Safari warns first: tap **Show Details → visit this website**. The certificate is kept in `~/.cache/guitar-teacher/`; delete it if your computer's IP changes.

On iPhone, sound plays even with the silent switch on (iOS 16.4+, or older iOS through a silent media track). Tap any button once if the sound stops after a call or after switching apps. With the mic on, use headphones so the mic doesn't hear the band.

## Stand mode (a phone or tablet on a music stand)

The Daily session, Scales and Call & response pages have a **Stand mode** (top right of the practice card, or **F**). It turns the page into one screen you can read from a music stand while both hands are on the guitar. Each page remembers it.

- **Only what you need while playing.** The neck and the tab are on the left; the title, timer, stats, feedback and big buttons on the right. In portrait it's one column in playing order. The neck zooms in on the frets you're playing, and the tab shows one line, scrolling sideways to follow the next note. Passes, tempo changes and answers flash large across the screen ("Clean 2/3", "Slower · 68 bpm", "Nailed it"). Hearing folds into a strip: the note you played, the level meter, and the input switch. **Exit** or **Esc** brings back the full page.
- **Pedals.** Bluetooth page-turner pedals (AirTurn, PageFlip and others) type arrow or page keys. In Stand mode, **right** (→, ↓, Page Down) and **left** (←, ↑, Page Up) do:

  | Page | Right pedal | Left pedal |
  |---|---|---|
  | Daily session | Start, Pause, Resume; Next when the time is up | +2 min while playing or when the time is up; else skip to the next exercise |
  | Scales | Start / Stop | The next shape along the neck |
  | Call & response | Start / Stop the band | A new lick on the next call |

  Outside Stand mode the arrow keys keep their normal job (on Scales, picking the shape).
- **Play to start.** With the input on, playing the first note (any octave) starts it: the exercise's first note, or the key's root where there's no tab (a play-along, the band). A rhythm drill starts with any strum. Notes still ringing within 1.5 s of a stop don't count.
- **Auto next** (Daily session). When the time is up, the next exercise comes after 8 seconds (left pedal for +2 min, right pedal to go now). The mic's grade stands in for the *How did it go?* rating. A break starts its timer on its own.
- **Start turns the input on** the first time, since the Hearing card is folded away.

Play to start and Auto next are under the controls, and shared by every page. With an interface on an iPhone, iOS routes both input and output through it. `js/stand.js` does the moving, the pedals and the flashes for all three pages; the layout is in `css/style.css`.

## Tuner (`tuner.html`)

A dedicated tuner, made so a beginner can tune quickly and still get it right to a cent.

- **It finds the string.** In **Auto** it follows whichever open string you pluck (the nearest one in the chosen tuning; a stray reading doesn't flip it). **Pick a string** (or keys **1**–**6**, 1 = high e) locks the target, for a string so far out it would pass for its neighbour; it then says how many semitones to go. **Guide me** walks through low E to high e and moves on once each one is in tune; if the string you just did is still ringing, it says so instead of reading it against the next.
- **It says what to do.** *Tighten* or *Loosen*, in words and an arrow, with "go a little below and come back up" when you're sharp, and a warning when a string is a few semitones high.
- **Precise.** To about a tenth of a cent on a clean note: on realistic synthetic plucks (stiff strings, beating, the pitch glide after the pick, a phone's mic) the readings are within 0.14¢ of the truth half the time and within 0.7¢ 95% of the time. The gauge gives half its swing to ±10¢, the readout shows tenths of a cent (hundredths in Exact), and the strobe stands still in tune. **Precision** sets what counts as in tune: Quick ±3¢, Precise ±1¢ (default), Exact ±0.3¢ for intonation. A string gets its ✓ after holding steady inside that for 0.6 s, and loses it if it drifts well out later. The first reading comes ~0.2 s after the pick (a hard pick starts a few cents sharp and settles over the next ~0.2 s: the needle shows that).
- **The low E, through a phone or tablet.** A small mic hears almost none of the low E's fundamental: in real recordings it's 20–30 dB under the 2nd harmonic, and a phone's mic takes another ~10 dB off. The tuner finds the pitch from all the harmonics together, rules out reading the 2nd harmonic as the note by which harmonics are there, and reports the fundamental all the same.
- **Unplugged electric.** No setting to change: hold the device close, its mic towards the strings, and pluck firmly. An electric with no amp is only a few dB louder than the room's hiss, but the hiss is spread over the whole spectrum and the string's sound is in a few narrow lines; the tuner listens for those lines, so it hears a string far below where a loudness gate would open (the Sensitivity slider doesn't affect the Tuner).
- **Noise filter** (on by default). Only a plucked string moves the needle; hum, a fan, a fridge and people talking don't. A string is told by how it starts and carries on: its harmonics jump up together at the pick (a voice swells into a syllable over 60–160 ms), its pitch settles and holds (a voice glides), and it only fades (a syllable dies away, the next one comes back up; a hum doesn't fade at all). Steady sounds (mains hum, a fan's whine) are learnt into the background, so they don't count, and a string at their pitch reads once it's plucked louder than them. A tone that switches on mid-way (an attack, a steady pitch) shows for at most ~1.3 s, until it's clear it isn't fading like a string. While a string rings the tuner follows only it: a new pick on another string takes over (even the high e over a ringing low E, two octaves up), someone talking on top of it isn't read as it (the readings pause rather than go wrong), and a peg turned while it rings moves the needle along with it. Without the filter, mains hum alone gives a reading every 30 ms; with it, none. Turn it off for a sound with no pick attack (a bowed string, an e-bow). Music playing in the room has attacks and steady notes of its own, so the filter can't keep it out.
- **Strum all six** (Mode, or **S**). Strum the open strings and every string shows on its own bar at once (sharp up, flat down, the green band ±3¢), like a polyphonic tuner pedal. A message names the string most out and which way to turn it. The bars keep updating while the strings ring, so you see a peg turn without strumming again. Tap a bar to fine-tune that string on its own. How it works (`js/polytune.js`): the tuner knows which six notes to expect, so it doesn't have to pull an unknown chord apart. It takes one spectrum of ~0.7 s of the strum (Hann window, zero-padded 4×) and reads each string's fundamental and first three harmonics near where they should be. Strings share frequencies (in standard tuning the low E's 3rd harmonic is the B, the low E's 4th and the A's 3rd are the high e), so each harmonic counts only if it's mostly the string's own. A neighbour far enough away to tell apart narrows the search instead, and where a string's harmonics disagree, the ones that agree win. On synthetic strums with every string detuned, random pick positions and levels, stiff strings and room noise, every string reads within 2¢ (`test/polytune.test.js`). It can't tell a silent B or high e from the low strings' harmonics on the same notes, so strum all six. A string more than ~50¢ out is flagged to tune on its own first. At 88.2/96 kHz the analyser holds only ~0.35 s, so readings are coarser.
- **Play the note** (**R**) plays the target pitch as a clean tone; the tuner ignores the input while it plays.
- Tuning and A4 (430–450 Hz) are shared with the practice pages. The screen stays on while tuning, where the browser allows it.

The pitch engine is `js/tunerengine.js` (no DOM, below); what a reading means for the string you're tuning is `js/tuneguide.js` (no DOM), tested by `test/tuneguide.test.js` down to synthetic plucks through the engine; the page is `js/tuner-app.js` and `css/tuner.css`. The input card is the shared Hearing card (`js/micpanel.js`) without its own tuner. The Hearing card's **Precise tuner** on every page is the same engine, as a chromatic tuner.

### How the pitch engine works (`js/tunerengine.js`)

It was rebuilt from the published work on pitch estimation and from how open-source tuners do it, then checked against real guitar recordings, not only synthetic strings (an earlier engine passed every synthetic test and still missed the low E and an unplugged electric). About 30 times a second it takes the latest ~0.7 s of the untouched input (an AnalyserNode's 32768 samples) and:

1. **Decimates to ~12 kHz** (a Kaiser-windowed sinc, ~80 dB down, so a device's ultrasonic whine can't alias into the band as a tone; only the new samples are filtered each time), and analyses up to 4.5 kHz.
2. **Whitens the spectrum.** A 170 ms spectrum, each bin compared with the noise floor there: the spectrum's own median (as LINGOT does) and a learnt background of the room's steady sounds (hum, a fan), learnt only while no string is heard.
3. **Picks the pitch** with SWIPE's kernel (Camacho & Harris, 2008) on the spectrum's peaks: around each harmonic of a candidate, a peak counts fully on the harmonic and against it halfway (the candidate is an octave too high) or a third of the way (a twelfth too high) to the next. An octave too low gets only the even harmonics' share, at most 1/√2 of the right note; the tuning's open strings (and the string picked, or the note already ringing) settle it, as LINGOT's and Cycfi Q's trackers lean on the last pitch.
4. **Measures each harmonic's frequency from its phase**, like a strobe tuner: each partial demodulated in short frames through the note (since the pick, up to ~0.6 s, leaning to the newest frames), and the frequency is the slope of a weighted least-squares line through its unwrapped phase. While a peg is being turned (all the partials gliding the same way, reading after reading) only the newest ~0.12 s counts, carried forward at the rate it moves.
5. **Fits a stiff string** to all the partials: partial *n* is at *n*·f0·√(1 + B·*n*²) (Fletcher; the partial-frequency fit of Rauhala, Lehtonen & Välimäki, 2007). The reading is the fundamental of the fit, so it's the same whichever harmonics happen to be loud (the pick, the mic, how long it's rung), and it's there even when the fundamental itself can't be heard. Real partials don't sit exactly on the model (one near a body resonance, one an open string rings along with in sympathy, a few cents off), so the fit is robust (Tukey's biweight from a median start), and each partial counts less the higher and the weaker it is.
6. **Tracks the note** (the noise filter above): the pick found in the note's own harmonics' envelope (a jump of 6 dB or more, timed to where it crosses half its new level, with its rise time), and the readings steadied over 0.2–0.5 s (longer the less precise they are).

Measured on 53 real recordings (steel-string, electric and nylon guitars, E2 to E4) as the Tuner hears them: through a line input, a phone's mic close and across the room, with hum and reverb, and at an unplugged electric's level a few dB over the room. The previous engine is in brackets.

| | shown | wrong note | first reading |
|---|---|---|---|
| line input | 98–100% (99%) | 0% (0%) | 0.24 s (0.31 s) |
| phone mic, close | 98–100% (99%) | 0% (1.9%) | 0.24 s (0.32 s) |
| phone mic, across the room | 93–100% (23–33%) | 0% (2.1%) | 0.24 s (0.32 s) |
| phone mic, hum and reverb | 97–98% (8–20%) | 0% (2.1%) | 0.24 s (0.32 s) |
| unplugged electric's level | 52–66% (0%) | 0% (–) | 0.33 s (–) |

("Shown": the median share of the 0.3–3 s after each pick with a reading on the gauge, all takes and the low strings.) Where both engines read, they're as steady as each other (the needle within ~0.2¢ of where it's going), and the new one reads about a cent lower: the old one followed the strongest harmonics, which a stiff string stretches sharp; the new one reads the fundamental. On synthetic plucks with known truth the median error is 0.14¢ (0.44¢ before) and a quiet guitar is read all the time (a quarter of the time before). `test/tunerengine.test.js` and `test/realguitar.test.js` check all of this.

Sources: A. de Cheveigné & H. Kawahara, *YIN* (JASA 2002); M. Mauch & S. Dixon, *pYIN* (ICASSP 2014); P. McLeod & G. Wyvill, *A smarter way to find pitch* (ICMC 2005); A. Camacho & J. Harris, *A sawtooth waveform inspired pitch estimator* (JASA 2008); J. K. Nielsen et al., *Fast fundamental frequency estimation* (Signal Processing 2017); J. Rauhala, H.-M. Lehtonen & V. Välimäki, *Fast automatic inharmonicity estimation algorithm* (JASA-EL 2007); N. Lee, J. O. Smith et al. on the pitch glide of plucked strings (DAFx 2009); the open-source tuners LINGOT (spectral SNR, harmonic comb, Newton refinement, lock/unlock hysteresis), aubio's `yinfft` and Cycfi Q's pitch detector.

## Pickup height (`pickups.html`)

Sets the height of Gibson-style pickups, humbuckers and P-90s (soapbar or dogear), to Gibson's factory setting or StewMac's starting point, then by ear.

- **The figures.** **Gibson factory setting:** neck 3/32″ (2.4 mm), bridge 1/16″ (1.6 mm), the same under both E strings, measured with the string pressed at the last fret from the bottom of the string to the highest point of the pickup, the pole pieces flat. That's Gibson's factory setup sheet as Gibson support gives it (quoted by Gibson staff on [Gibson's forums](https://forum.gibson.com/topic/14515-measuring-pickup-height/)); Gibson's own site and manuals weren't reachable to check it against, and the same figures are what [Sweetwater](https://www.sweetwater.com/insync/high-set-pickups/) and [Premier Guitar](https://www.premierguitar.com/diy/mod-garage/humbucker-pickup-height) report as Gibson's. Gibson gives it for its humbucker guitars and publishes no separate P-90 figure, so the page says so when you pick a P-90 with it. **StewMac starting point:** about 3/32″ under the low E and 1/16″ under the high E, at the highest fret, the same for humbuckers ([StewMac's humbucker wiring diagrams](https://www.stewmac.com/video-and-ideas/online-resources/learn-about-guitar-pickups-and-electronics-and-wiring/learn-about-wiring-stewmac-pickups/stewmac-humbucker-pickup-wiring-diagrams/)) and P-90s ([StewMac's P-90 wiring diagrams](https://www.stewmac.com/video-and-ideas/online-resources/learn-about-guitar-pickups-and-electronics-and-wiring/learn-about-wiring-stewmac-pickups/stewmac-p-90-pickup-wiring-diagrams/): P-90s "are usually set closer to the strings than single-coils, because they have less of a focused magnetic pull"), then raised or lowered for the balance you prefer.
- **What to turn.** Enter the gap you measured under each E string on each pickup (step in 64ths or tenths of a mm, or type `3/32`, `2.4 mm`), and it says which way and how far. A humbucker's height screws (Gibson's are [3-48](https://gibson.com/en-GB/p/pickup-height-adjustment-screw/gibson-Historic-Reissue-Pickup-Height-Adjustment-Screws-Slotted-Nickel/PRTH-PHSN): 48 threads to the inch, a turn is 0.53 mm) turn clockwise to draw that end up, so it gives the turns, to a quarter. A soapbar P-90 is held down on foam or springs by two screws between its pole pieces: tighten to lower, loosen to raise (if nothing's under it, it needs a shim). A dogear P-90 has no height screws: it goes up or down on shims, as a whole (the two sides' average), and the pole screws even out the sides. Within 0.2 mm counts as there. Gibson's owner's manual: height by the two screws at either end of the pickup, in the mounting ring; each string's volume by its pole screw; closer is hotter.
- **The level check.** With the guitar plugged in (an audio interface, a KATANA:GO; a mic hears the strings, not the pickups), pluck each open string two or three times on the neck pickup, then on the bridge pickup. The bars show how loud each string comes out (the loudest moment of each pluck, the last three averaged), a string 3 dB or more off the others on a pickup is pointed out for its pole screw, and the two pickups are compared (within 2 dB: about as loud as each other).
- The measurements are kept in the browser. The logic is `js/pickups.js` (no DOM), tested by `test/pickups.test.js`; the page is `js/pickups-app.js` and `css/pickups.css`.

## Daily session (`session.html`)

A practice session of 60 to 120 minutes, generated fresh every day: rhythm, scales, sequences, arpeggios, triads, technique and improvising. The mic grades every exercise, and the grades decide what comes back, how fast, and when.

### What a session looks like

The minutes are split into blocks, in this order: **Warm-up** (chromatic finger patterns, then your best box), **Technique** (bends checked against the fretted pitch, pedal-point picking, and vibrato, legato, palm muting and stops graded from the sound: see below), **Rhythm** (one or two drills from the Rhythm page, about 10% of the session), **Fretboard** (every root or ♭3 in a box, one note on every string, guide tones over a blues), **Scales & sequences**, **Arpeggios & triads**, **Connect the neck** (linking two boxes, diagonal runs, one-string scales), **Apply it** (improvising under a rule, landing on the 3rd over the changes, a mode over a drone) and **Review**. Sessions of 60 minutes or more get a 2-minute break about every 30 minutes. A 90-minute session has about 17 exercises of 4 to 7 minutes each.

Rhythm exercises show the pattern lane instead of the fretboard and tab, as on the Rhythm page: every hit is a dot beside its step. They use the timing offset and Hit sensitivity you set on the Rhythm page, so measure the offset there once.

Every other exercise shows the shape on the fretboard, colored by degree as in the deck: root red, 3rd amber, 5th blue, 7th purple, flavor or blue note teal. The note sequence is shown as tab, and the next note to play is ringed. Exercises over chords (guide tones, follow the changes, land on the 3rd) play a pad with the chords. The fretboard then shows only the tones of the chord that's sounding, and the tab pointer follows the beat. Modes and improvising get a drone.

- **Timer.** Each exercise has its minutes. When they're up you get a chime and a *How did it go?* rating. **+2 min** keeps going.
- **Tempo ladder.** Clean passes in a row (90% of the notes, timing within ±60 ms) take the tempo up 3 to 4 bpm. Short sequences need three clean passes, long ones two or one. Two rough passes take it down. The next session starts each pattern at your last clean tempo.
- **Plan.** The strip at the top is the whole session; click any part to jump there. In the list below it, ↻ swaps an exercise for another from the same block. ★ marks today's focus.
- **Settings.** Length (60 to 120 minutes), focus (pentatonic & blues, scales & modes, arpeggios & triads, metal, technique), keys (*key of the day*, which moves up a 4th each day, or one fixed key), and *Where are you now?*, which only sets the starting guess.
- **Progress.** A skill map (every box, position, pattern, arpeggio and triad set, colored by how well you play it), a 15-minute-a-day streak, minutes per day, and **Back up** / **Restore** as a .json file.

### Electric-guitar technique

The Technique block also has four exercises graded from the sound itself, not only the notes. They are made for an electric through an audio interface: a clean, dry signal shows the decay, the noise and the pitch curve. A mic works too, with headphones, close to the amp.

- **Vibrato** (narrow, then wide). Hold each note for a bar with vibrato. Each held note's pitch curve gives the width (cents, peak to peak: a narrow vibrato is 20–60¢, a wide blues/rock one 70–160¢), the speed (aim for 5–7 a second), how even the cycles are, and whether the pitch comes back down to the note.
- **Legato** (on the G, B or high e string). One pick a beat, then hammer-on, hammer-on, pull-off in 16ths. Notes are checked in order with timing, and the hammer-ons and pull-offs are compared with the picked note: within a few dB is even, 6 dB quieter or more is the usual fade. The notes come from the pitch frames, since the note tracker drops a pitch that rang a moment ago, which is what legato does.
- **Palm mute vs open** (six chugs and two opens, then opens on the off-beats). Down-picked 8ths on the low root. The onset detector finds every pick, muted or not; each note's decay 150–180 ms later sorts the mutes from the opens, and the grade wants them clearly apart (7 dB or more) and each note on the right side.
- **Stops.** Root and 5th in 8ths for two beats, then silence from beat 3. The grade measures how close to beat 3 the sound stops (±60 ms is clean), how quiet the rest is, and whether a string keeps ringing.

They use the tempo ladder (vibrato has a fixed 72 bpm) and feed the skill map like any other exercise. The tab marks the technique: `~~~` vibrato, `h` and `p` hammer-on and pull-off, `PM` palm mute, and a dash for a rest. The analysis is in `js/technique.js`; `test/technique.test.js` runs synthetic electric-guitar audio through the real note tracker and onset detector.

### How exercises are generated

No exercise is stored. They're built from rules and music theory every time:

1. **Shapes come from pitches** (`js/scales.js`). A pentatonic box takes two notes on each string, each string carrying on where the string below stopped. Box *k* starts on the *k*-th note of the scale on the low E string. A 7-note position fills the same fret window with the extra notes: box *k* plus two. A 3-notes-per-string pattern takes three notes on each string. Arpeggios are the chord tones inside a box's window, and triads are close voicings on three adjacent strings. This gives the deck's shapes in every key and tuning. Note and chord names are spelled by degree, one letter each (`Theory.spellSet`): A Phrygian has B♭, not A♯; the 3rd of D7 is F♯; the ♭VI of E♭ minor is C♭. The tests check every scale in every key and position: right notes, none skipped, and each shape within reach.
2. **Sequences** turn a shape into an exercise: up and down, in 3s, in 4s, in 3rds, or descending 6s. The rhythm matches the grouping (3s as triplets, 4s as 16ths). Once a shape is solid, 3s sometimes run over 16ths, so the accent moves (displacement). No pattern plays the same note twice in a row, even where it loops.
3. **Rules choose what to practice** (`js/sessiongen.js`):
   - **Your path comes first.** The next shape on your path that you haven't consolidated is always in the session (★): the next pentatonic box, natural-minor position or 3-notes-per-string pattern, plus the next arpeggio position. Rhythm has its own path: 8ths → 16ths → triplets → the pop strum → ballad 16ths → the gap click → chucks → 3 + 3 + 2 → funk. With the Metal focus it then carries on to chugs, gallops and accents in 3s, and metal patterns come up more often.
   - **Rhythm.** Each rhythm pattern lists what it builds on (16ths after solid 8ths, the gallop after 16th chugs, the gap click after 8ths). Quarters and 8ths start with a guess, since anyone who strums chords plays them already. A pattern you play solidly sometimes comes back with less help from the click: a gap click, or only 2 and 4. The Rhythm block holds at most two exercises.
   - **Readiness.** An exercise is offered once its prerequisites are there: box 3 after box 2, position *k* after box *k*, 7th arpeggios after triads, harder sequences after the plain run. A family that's one step short still shows up now and then.
   - **Need and spacing.** Shapes you're still consolidating are weighted up, mastered ones down. Each skill has a review interval that grows with good grades (2.2× each time) and resets after bad ones. Due skills come back in the Review block. On your first day, Review revisits today's new material in another key.
   - **Variety.** A session never repeats a skill. It picks the exercise family first, then the variant, so a family with many variants doesn't crowd out one with a few. It avoids running the same family back to back, and caps brand-new material at about a quarter of the session.
   - **Keys.** The key of the day for most exercises. Blues exercises also use A and metal ones E, as in the deck.
4. **Seeded.** The plan is generated from the date. Reloading keeps today's session. **↻ Generate new session** (top of the page) draws a different one at any time, using your current settings and progress.

### The learner model

`ff.learner` keeps, per skill (for example `box:minPent:3`, `arp:dom7:1`, `nps3:aeolian:2`):

- **Mastery** from 0 to 1. Each exercise moves it toward the grade, quickly for new skills and then more slowly.
- **Review interval and last practice date.**
- **Tempo ladder.** For each pattern and rhythm, the start tempo and the best clean tempo.

The grade is the mic's score: accuracy over the last passes, with timing for sequence exercises. For rhythm, it's the timing score of the last three passes: hits × timing (an average error of 10 ms or less scores full marks), minus extras. A pass where nothing was heard isn't graded. Runs on the Rhythm page update the same skills (`rhythm:pop` and so on) and tempos, so the planner knows what you've played there. For improvising, it's how many notes fit the rule plus how many beat-1 landings hit the target. If you rate the exercise as well, the grade is 70% mic and 30% your rating. With the mic off, your rating alone counts.

### Grading

- **Sequences.** Notes are checked in order, and the pointer only moves forward when you hit the next note. A note that skips one counts the skipped note as missed. Timing is each note's distance from the nearest grid point, at the exercise's subdivision, corrected for latency.
- **Bends.** A bend counts when you pick the note below and then hold the target pitch for 70 ms. The ringing fretted reference note alone doesn't count. The page shows how many cents sharp or flat you were.
- **Rhythm.** Every attack the onset detector hears is lined up with the nearest step of the pattern, as on the Rhythm page. A clean pass needs 95% of the hits, at most one extra, and timing within ±20 ms (average and spread). With the tempo ladder on, two clean passes in a row take the tempo up about 4%.
- **Chords and improvising.** Each note is checked against the rule: chord tones of the chord sounding at that moment, the 3rd and 7th, scale + chord, or the three allowed notes. A note slightly ahead of a chord change also counts for the next chord. Landings are judged on the first note near beat 1.

### Which string you played

A pitch can be played in two to five places on the neck, and pitch alone can't tell them apart. The Scales page guesses the place from two things (`js/stringid.js`):

- **The note's sound.** A real string is stiff, so its overtones run slightly sharp of whole multiples of the pitch: overtone *n* sits at *n*·f0·√(1 + B·n²). The stiffness B depends on the string's thickness and gets about 4× bigger every 12 frets, so the same E4 has a small B on the open high E string and a much bigger one at the 5th fret of the B string. About 30 ms after each attack, the app takes up to 170 ms of the note, finds its overtones in a zero-padded FFT, and fits B by least squares (outliers dropped).
- **Where your hand has been.** The place nearest your recent notes (and the shape on screen) is more likely.

The two are combined as probabilities: hand position as the prior, and how well the measured B fits each string and fret as the likelihood. The note is placed at once from the hand, then moved if its sound says otherwise, about 0.2 s later.

**String hints.** *Find any note*, Scales sequences and the Daily session ask for each note at a given place. Notes still count by pitch, but when a found note's sound clearly says another string (90% sure from the sound alone), you get a hint: "Right note, but it sounded like the low E string, fret 8." It never costs you the note, and *Find any note* lists those notes after the round. Bends and any-octave exercises aren't checked.

**Blind spot: G and D.** A plain G string is so stiff that the D string a few frets higher measures almost the same (for example A3 at fret 2 of the G and fret 7 of the D). About 13% of same-pitch pairs on the neck are like this, all of them G against D. There the app stays quiet instead of guessing. A wound G (most acoustic sets) doesn't have this problem as much.

**Other tunings.** Tuning a string down lowers its tension, which makes it a little stiffer for its pitch; the model takes that into account (B ∝ 1/tension). Teaching it your guitar uses the tuning the page is set to, and remembers it.

Out of the box the app assumes a typical 10–46 set. **Hearing → Teach it your guitar** asks for 12 notes (each open string, then each string at the 7th fret) and fits each string's stiffness to your guitar. Do it again after changing string gauge.

How good is it? On synthetic notes that follow string physics, with realistic flaws added (detuned overtones, pitch glide after the pick, another string ringing), it picks the right string about 99% of the time after teaching and about 89% without it (`test/stringid.test.js`). A real guitar through a laptop mic in a room will do worse than that: chords, very fast playing, heavy distortion and loud backing in the mic all make the overtones harder to measure. So **Where you played** is still an estimate, and grading still goes by pitch, never by string.

### Why rules, not AI or machine learning, for the content

The exercises have to be exactly right. A shape with one wrong dot teaches the wrong thing, and theory can compute every shape and check it. A language model would have to be checked by the same theory anyway, and it would need a network connection. Learning a generator from data would need a large set of graded practice sessions, which don't exist. The part that has to adapt to you, *what* to practice and *how fast*, is the learner model: a small knowledge-tracing and spaced-repetition model fed by your mic grades.

That reasoning is about exercise content. For where AI models could still help (lyrics, a sung demo, real songs), see [AI-OPTIONS.md](AI-OPTIONS.md).

The backing pad sits in the guitar's range. Use headphones, or an audio interface, so the mic doesn't hear it.

## Scales (`scales.html`)

Any scale across the whole neck: its CAGED shapes in any key, routes that travel up and down the neck, and a band to play along with. The mic checks every note.

**What to play.** The top of the page sets four things:

- **Genre:** Blues, Rock, Metal, Pop 流行 or Ballad 抒情. A dot marks the keys common in the genre (blues: A E G C D; rock: E A D G C; metal: E D C B F♯; pop: C G D E F A; ballad: C G D F B♭). Picking a genre moves to its first common key if yours isn't one of them, switches to the genre's usual scale if yours isn't one it uses, and picks a backing that fits.
- **Key:** any of the 12. **↻ Up a 4th** (or <kbd>K</kbd>) steps round the circle of 4ths, the order the deck drills keys in.
- **Scale:** minor and major pentatonic, blues, major, natural minor, Dorian, Mixolydian, Phrygian, Lydian, harmonic minor and Phrygian dominant. A dot marks the ones the genre uses.
- **Shapes:** CAGED (5 positions) or 3 notes per string (7 patterns, for 7-note scales).

**The neck** shows frets 0–22. The shape in play is in the deck's colors, and the rest of the scale is faded behind it (**Whole neck**). The strip above the neck shows every placement of every shape, lined up with the frets, with its CAGED letter and box number; click one to pick it, or use <kbd>←</kbd> <kbd>→</kbd>. **Chord grip** rings the barre chord each shape is built around: for A minor pentatonic, box 1 is the E shape (the Am barre at fret 5), box 2 the D shape, then C, A and G. The letters move with the key, but their order up the neck never changes. Notes you play light up on the neck.

**Learn a shape.** Pick a shape (E D C A G, or patterns 1–7) and a pattern: up & down, in 3s, in 4s, in 3rds or descending 6s. This is the Daily session's shape exercise, so it uses the same skill and the same tempo ladder.

**Arpeggios.** Pick a root, a chord type and one of five positions. Play the chord tones up and down or in groups of three, following the fretboard and tab. Use **Play along** to hear the exercise and **From memory** to hide the frets. The mic grades each pass, and the Daily session shares its mastery and tempo history. You can also tap the fretboard without a guitar.

**Up & down the neck.** Three routes:

- **Shape ladder:** up one shape, down the next, up the next. At the top it turns around in the same shape and comes back down the same way. You shift between shapes on the high e and the low E strings. It links 2 or 3 shapes, or all 5 (the whole cycle). The strip and the neck follow the shape you're in.
- **Diagonal:** 3 notes per string for pentatonics and the blues scale, 4 for 7-note scales, from the start shape's lowest note. The run climbs the neck as it crosses the strings.
- **One string:** the scale from the root to the root an octave up, along one string.

The sequence modes share the same controls.

- the click and the tempo ladder from the Daily session;
- **Drone** on the root;
- **From memory**, where the dots and tab show "?" until you find each note;
- **Play along**, where the page plays the notes with you in time on a clean guitar. An amber outline in the tab shows where it is. It's heard by a mic in the room, so use headphones.

**Play along (the band).** A backing in your key: the blues band's shuffle (12-bar, quick change, one-chord vamp) or the song band's rock, metal (palm-muted), pop and ballad grooves, or a drone. The list puts first the backings whose chords fit your scale (outside the blues, a 7-note scale that fits has every chord tone; over a 12-bar, Mixolydian fits the I7 and Dorian the IV7, which is the sound of the style; tested). Below them are the ones from other genres that fit, then the genre's others, which will clash. The neck shows the scale and rings the tones of the chord that's playing. Every note you play lights up where you probably played it. You choose where to play:

- **Anywhere.** The report shows which shapes you used.
- **Stay in one shape.**
- **Move every 4 bars** or **every 2 bars.** The shape moves up the neck through five shapes, then back down. The next shape is outlined above the neck a bar ahead.

The stats count notes in the scale and bars that start on a chord tone. They also count notes in the shape of the moment, or the shapes you used. The report shows notes per shape and per fret, with tips: you stayed in one box, beat 1 missed the chord, these notes were outside the scale.

**What the mic can and can't tell.** It hears pitch, not strings. Sequences are checked note by note in order, with timing against the click. In the play-along, each note is placed from its sound and where your hand has been (`StringLocator`, see *Which string you played*). That makes "which shape" and "notes per fret" estimates, though better ones once you've taught it your guitar. "In the shape" means the note's exact pitch is one of the shape's notes.

**Progress.** Settings are kept in `ff.scales`. These runs update the Daily session's skill model and tempos in `ff.learner`:

- single-shape sequences (`box:minPent:1`, `pos:aeolian:3`, `nps3:…`);
- two-shape CAGED ladders in minor pentatonic or natural minor (`link:…`);
- minor-pentatonic diagonals (`diag:k`);
- one-string runs (`onestring:s`).

Other routes keep their own tempo. Minutes and grades go into `ff.days`, so they count toward the streak. Both are written with read-add-write, so an open Session tab doesn't lose them.

## Practice 1: Find any note (Part 3 of the deck)

- **One note everywhere.** Find one note on every string, low E → high e → back. The note order follows the circle of 4ths (C, F, B♭, E♭, …), so you get a new note each round.
- **Flash cards.** A random note and string. You can limit it to natural notes, to chosen strings, or to a fret range. The **Focus on weak spots** option brings up your slow and missed notes more often.
- **Pace.** Free (timed against the 2-second checkpoint), or the deck's four metronome stages: 40 bpm with 4 clicks per note, up to 80 bpm with 1. The app counts clean rounds and tells you when to move up.
- **Hints** follow the 3-step method. The first hint shows your anchors on the E and A strings, or the landmark notes when the target is on E or A. The second hint shows where the note is.
- **Speed map.** Every string-and-note pair is colored by your average time: teal for under 2 s. It's saved in this browser.
- No guitar handy? Click the fretboard to answer.

## Practice 2: Call & response (`licks.html`)

A backing band plays a blues. Every four bars, it plays a two-bar lick (**Listen**), then gives you two bars to play it back (**Your turn**). The mic checks your notes in order, and they light up as you hit them.

- **The band** is drums, a walking bass and a boogie-shuffle rhythm guitar. It plays a 12-bar blues, a quick-change 12-bar, or a one-chord vamp, in any key, from 50 to 140 bpm. It's all synthesized in the browser: there are no sample files.
- **The licks** use the minor pentatonic, box 1, plus the blue ♭5 and the "curl" (♭3 bent up to the 3rd). There are three levels: 1 (up to 5 notes, no bends), 2 (bends, triplets) and 3 (runs, sixteenths).
- **Every lick lands on a chord tone.** The landing note has to work over the chord under the call *and* the chord under your answer. The page tells you which chord tone it is.
- **Repeat until I nail it** gives each lick up to 3 tries. If the chords have changed, the generator moves the last note so the lick still lands on a chord tone. It marks the new ending in purple, and colors each note by how you did on the previous try.
- **Ear training** hides the tab on a lick's first try.
- **On your turn: Drums only** mutes the bass and guitar while you answer. Use it if you're not on headphones. The page warns you if the mic can hear the band.

### Where the licks come from

`js/licks-blues.js` is a library of 28 one-bar cells and 16 two-bar licks, written in A as tab. Claude (an AI) drafted it once, by hand. The rule checker in `js/lickgen.js` then checks every phrase against these rules:

- every note is in the scale, and passing notes are short;
- the whole lick fits within 4 frets;
- bends are on the top four strings, a whole step, or the ♭3→3 curl;
- hammer-ons, pull-offs, slides and releases follow a note on the same string;
- at most 4 notes per beat, and the last note rings for at least a beat.

The tests fail if any entry breaks a rule.

When the band runs, the generator builds every two-bar phrase it can: whole licks, two cells joined (if the jump between them is small), and single cells. That gives about 210 phrases. For each call, it scores them against the chords: strong beats, long notes and the landing note should be chord tones. It then picks one at your level, avoiding the last few, and moves it to your key.

### The amp

The lead guitar goes through an amp. The built-in one is a waveshaper drive into a cabinet EQ. For a real amp tone, open **Sound and amp**, pick **Neural (NAM)**, and load a `.nam` capture: free ones are on tone3000.com. The page stores the capture in the browser (IndexedDB), so you load it once. It turns on **Add a cabinet** by itself when the capture's metadata says it's amp-only.

`vendor/nam/` holds three files from the npm package `neural-amp-modeler-wasm@3.2.0` (MIT, © TONE3000; see `vendor/nam/LICENSE`):

- `index.js`, the loader;
- `nam-worklet.js`, the AudioWorklet;
- `nam-engine.wasm`, Steve Atkinson's NeuralAmpModelerCore compiled to WebAssembly.

The engine needs no special server headers. Captures are made at 48 kHz. If your audio device runs at a different rate, the page says so, and the tone may be slightly off.

### Grading

The note tracker reports picked notes. Some notes aren't picked: the top of a bend, a hammer-on, a slide. The grader also counts any pitch the detector holds for 60 ms. It then lines up what you played with the lick, in order, using an alignment that tolerates extra notes. The rules:

- A bent note also counts if the mic only heard the fret under it. The tip then says "bend higher".
- Hammer-ons, pull-offs and releases are optional.
- You pass with 80% of the other notes.
- Timing doesn't affect the score. It's reported as on time, early or late, corrected for your audio latency.

## Rhythm (`rhythm.html`)

Timing drills for the strumming and picking hand. The page times every attack you play (a strum, a muted chuck, a palm-muted chug) against the click, to about a millisecond. It shows where you rush, drag or scatter.

- **Exercises.** 29 patterns in four groups:
  - **Time & subdivisions:** quarters, 8ths, triplets and 16ths; the subdivision ladder (one bar of each); offbeats only; the "e" and the "a"; 3 + 3 + 2.
  - **Strumming:** the pop strum D DU UDU (the Mandopop band's pattern on the Song writing page); ballad 16ths (抒情); 6/8 ballad; rock 8ths in downstrokes; chucks on 2 and 4; the shuffle; funk 16ths; fingerpicked 8ths (分解和弦).
  - **Palm mute & metal:** downpicked 8ths; 16th chugs; the gallop and reverse gallop; chugs and stops; syncopated 3 + 3 + 2 chugs; accents in 3s over 16ths; 16ths ↔ sextuplets.
  - **Inner clock:** gap clicks (2 bars on and 2 off, or 1 on and 3 off); the click on 2 and 4 only; on beat 1 only; on the "&" only.
- **The lane** shows the pattern with strum arrows. Faint arrows are ghost strokes: the hand moves but misses the strings. It also shows chucks ✕, palm-muted picks ⊓ V, accents > and the counts (1 e & a). Each hit appears as a dot beside its step: left is early, right is late, spread 3× wider than real time. Teal is within 25 ms, amber within 45, red further. Extra hits get a ✕, missed steps a dashed ring.
- **Click.** Every beat, a gap click, 2 & 4, beat 1, or the "&". **Drums** swaps the click for a groove that follows the same choice. In the gap's silent bars the drums drop out too.
- **Tempo ladder.** Two clean passes in a row (one for long patterns) take the tempo up about 4%; two rough ones take it down. A clean pass needs:
  - at least 95% of the hits;
  - at most one extra;
  - an average within ±20 ms of the beat;
  - a spread under ±20 ms.

  The next time you open an exercise, it starts at the tempo of your last clean pass.
- **Report.** Every hit plotted over the run, with the silent bars shaded and a running average showing drift. Your average offset at each place in the beat (the "&" or the "a" being late is the usual one). Tips cover:
  - rushing or dragging;
  - scatter;
  - ghost strokes that hit the strings;
  - sound in the rests;
  - accents that don't stand out;
  - for gap clicks, the tempo you drifted to and how far off it left you.
- **Progress.** Recent runs and best clean tempos are kept in `ff.rhythm`. Minutes and run scores also go into the day log, so rhythm practice counts toward the Daily session's streak. Each run also updates the Daily session's skill model and tempos. The session's Rhythm block then picks up where you left off.

### Timing offset (latency)

The click takes time to reach your ears, and your guitar takes time to come back through the input. The page takes that delay off every hit. Measure it once per setup in the **Timing offset** card:

- **Measure by playing.** Play a muted strum with each of 16 clicks; the typical offset becomes the correction. This also sets your own habit of playing slightly ahead of or behind the click as zero.
- **Loopback.** The input listens to the clicks themselves: laptop speakers into the mic, or an interface with loopback on. This measures the equipment alone. Turn loopback off again before you play.
- **− / +** nudge it by 1 ms.

Until it's measured, the page estimates the delay from what the browser reports.

### How the timing detection works

`js/onset.js` runs in an AudioWorklet, so it sees every sample with its exact time on the audio clock. It splits the input into six bands, about an octave each. An attack is a sudden rise of each band's 6 ms level above the *loudest* level in the 6–24 ms before it. A ringing or distorted chord pulses and beats, but it never rises above its own recent peaks, so only a real attack counts. A soft strum right after an accented one still counts, because its top end is new. The attack time is then the first 1 ms step that rose well above the previous 12 ms. In a strum that's the first string the pick hits.

The tests use synthetic notes, strums and palm-muted chugs, clean and through a high-gain clipper. They check that every attack is found, that nothing extra is, and that 90% of attacks are timed within 1–2 ms. The detector was also run on GarageBand's acoustic, funk and distorted rock guitar loops, to check that real strums stand out from the noise between them.

- **Hit sensitivity** sets how big a rise counts. Raise it if soft strums are missed; lower it if one strum counts twice. The *attacks heard* light flashes for every attack, so you can tune it by strumming.
- **Headphones.** A mic that hears the click would count it as your hits. The count-in checks for this. If the input heard every count-in click at the same delay, the page tells you.

## Song writing 写歌 (`write.html`)

A sketchpad for Mandarin ballads (抒情), Mandopop (流行) and rock (摇滚). You pick chords, write lyrics line by line, and the page sets each line to a melody that moves with the tones of the words. A band plays it all back.

- **Song form.** Intro, verse (主歌), pre-chorus (导歌), chorus (副歌), bridge (桥段), outro. *Verse 2*, *Chorus 2* and so on play the same tune with the **2nd-time lyrics**, so you can check that the new words fit the old melody. Add, remove or reset parts in the form strip.
- **Chords.** Written as 简谱 numbers (1, 6m, 5/7, ♭7) so they work in any key. Each part starts from a classic progression: 卡农 Canon (with a walking bass), 王道 4536, 1564, 6415, the major-3 heart-tug, the 2345 climb, 4 → 4m, ♭6-♭7-1, and more. Click a chord for swaps (add9, maj7, sus4, slash chords, borrowed chords), each with what it does. Or type your own.
- **The band** has a groove per style: fingerpicked clean guitar and a pad for ballads, D D U U D U strumming and an 8-beat for Mandopop, palm-muted then open power chords for rock. Verses are lighter than choruses, and the drums fill into the next part. A guide voice (or the lead guitar) sings the melody.
- **✨ Suggest** writes a melody for a line. It picks a rhythm (with breaths at spaces and commas, and a long last note), then searches the pitches. It favors chord tones on strong beats and steps over leaps. Over a chord from outside the key it sings the chord's note, not the key's: ♯5 over a major 3, ♭6 over 4m, ♭7 over ♭7. The pitch moves the way the tones go from one syllable to the next. It may end a line on a short 拖腔 (melisma). Each click gives a new idea. *Follow the tones* sets how strict it is.
- **● Record** plays the line's chords with a one-bar count-in. Play or hum the line, and your notes are snapped to 16ths. The words are laid on your notes in order. While you record, it's drums only by default, so the mic doesn't hear the band.
- **Edit by hand.** Click the lane to add a note. Click a note, then use ↑ ↓ to move it in the scale (Shift for a half step), ← → for the next note, `[` `]` to make it shorter or longer, M for 拖腔, Delete to remove it. The notes are colored by the chord: root red, 3rd amber, 5th blue.
- **Tone fit (倒字 check).** Mandarin listeners hear part of a word's tone in the melody. If the tune moves against the tones, a word can sound like another one. Each pair of syllables is checked: for example, a 3rd tone followed by a 1st wants the melody to go up. Red links mark leaps the wrong way, amber links mark steps. Below the lane, the page explains the worst ones. The pinyin is colored by tone and includes the spoken tone changes: 3 + 3 → 2 + 3, 一 and 不. Tap a syllable to fix a character the page reads wrong (行 háng, 了 liǎo).
- **押韵 Rhyme.** Each line's last syllable is sorted into one of the 十三辙, the 13 rhyme groups singers use: 发花, 梭波, 江阳, 中东 and the rest. The page labels the rhyme scheme (A, B…) and says whether the line ends on a level (平) or oblique (仄) tone. Each group has a bank of lyric words: click one to put it at the caret.
- **灵感 Spark** suggests a scene, an object, a feeling and an angle when you're stuck.
- **Lead sheet.** Shows the whole song as text: chords, 简谱 and lyrics. You can copy it or download it as .txt. **Back up** saves the song as .json, and **Restore** loads it back. Songs are saved in this browser.

### Where the pinyin comes from

`js/pinyin-data.js` lists the pinyin and tone of the 20,924 characters in the CJK Unified Ideographs block (U+4E00–U+9FFF), traditional and simplified. It was generated once by `tools/gen-pinyin.swift`, which uses macOS's own Mandarin transliterator (`CFStringTransform`), so nothing was downloaded. To rebuild it on a Mac:

```bash
swift web/tools/gen-pinyin.swift > web/js/pinyin-data.js
```

The data gives each character a single reading. `js/zh.js` adds the readings that lyrics need most: 长 cháng by default but zhǎng in 长大, 少年, 音乐, 重来, 了解, 觉得 and about 100 other words. It also applies the tone changes of speech.

## Looper (`looper.html`)

A four-track looper for building music out of your own playing: lay down a bass line, chords and a riff, then solo over them. The page tells you which key the loops are in and which scale to solo with.

- **Tempo or Free.** In **Tempo** mode, loops snap to bars of a tempo (40–240 bpm, 3/4 to 7/4), with an optional count-in, click and drum groove: rock, half-time, four on the floor, funk 16ths, shuffle or a rim-click ballad. In **Free** mode there's no tempo: your first loop sets the length (the *cycle*) that every later loop snaps to. Once a loop exists, the tempo is locked.
- **One button per track**, as on a looper pedal: record → play → overdub → play. **New loops** can run until you press again (ending on the nearest bar line) or stop by themselves after 1, 2, 4 or 8 bars. **Then** sets what happens when a loop closes: play it, go straight into overdub, or select the next track.
- **Hands-free.** Your hands are on the guitar, so a recording can start and hand over by itself:
  - **Start: When I play.** Press (or tap a pedal) to arm the track; it shows *Listening*. Recording starts on your first pick attack. If nothing is playing yet, the bar grid, click and drums start on that note too, at the tempo you set. If loops are already playing, it starts on the bar line, by the same rule as a press. The attack detector is the Rhythm page's (`js/onset.js`), listening above the Input card's noise gate (press *Auto-set* in a quiet room). SooperLooper has the same idea as its *Record Threshold*, which starts recording once the input level crosses a threshold, on that sample. We use attacks rather than level, so hum or a ringing string can't start it, and we start 5 ms before the attack, from the input buffer, so the pick's attack isn't clipped.
  - **Then: Record next** (chain mode). When a loop closes, the next empty track starts recording on that same bar line, or, with *When I play*, listens from then on. Give each track its own length with its **Bars** menu (say 4, 4, 2, 2): one press and you build the whole stack while playing.
  - **Count-in** of 1, 2 or 4 bars, to get your hands into place after pressing.
- **Undo / Redo.** Every overdub is a layer of its own. Undo takes the last one off, and pressing it during a recording cancels the recording. Undoing a track's first recording empties it, and Redo brings it back in time with the others.
- **Per track:** mute, solo, **Rev** (backwards), **½×** (an octave down and twice as long) and **2×** (an octave up), **×2 length** (the loop repeated, so you can overdub a different second half), volume, pan, a dotted-8th **Echo** in time with the tempo, **Room** reverb, and **Fade**. Fade is the feedback while you overdub: at 75%, the old layers lose a quarter each pass, so the loop slowly turns into what you're playing now. Loops of different lengths (3 bars against 4) stay locked together.
- **What to play over it.** After each recording, the page measures how much of each note is in the audible loops and names the key. It shows a scale to solo with (minor or major pentatonic first, then the mode the loops' own notes point to: Dorian for a major 6th in a minor key, Mixolydian for a ♭7 in a major key, and so on) and draws it on the neck, box 1 to 5.
- **Hear yourself.** With an audio interface, *Play my guitar through the page* sends your guitar through a dry, clean, crunch or lead amp, and the loops record that tone. It's off for a microphone, which would feed back.
- **Download the mix** renders all the loops, their effects and the drums to a WAV file. It runs until the loops come round together (at least 12 s, at most 3 min). Loops aren't saved in the browser: they stay in the tab until you close it, and the page asks before you leave.
- **Footswitch.** Keys: <kbd>Space</kbd> = the selected track's button, <kbd>1</kbd>–<kbd>4</kbd> select, <kbd>Z</kbd> undo, <kbd>Y</kbd> redo, <kbd>R</kbd> reverse, <kbd>H</kbd> ½×, <kbd>D</kbd> ×2, <kbd>M</kbd> mute, <kbd>S</kbd> solo, <kbd>T</kbd> tap tempo, <kbd>K</kbd> click, <kbd>Enter</kbd> play/stop all, <kbd>Esc</kbd> stop. A Bluetooth page-turner pedal works too: its right switch (PageDown or →) is the button, its left (PageUp or ←) is undo.

### How the loop engine works

`js/looper-worklet.js` runs in an AudioWorklet. The page sends it each action with an exact frame on the audio clock, so loops wrap on the sample and never drift apart. The design follows [SooperLooper](https://github.com/essej/sooperlooper) by Jesse Chappell: we read its `doc/html/doc_commands.html`, `doc_sync.html` and `parameters.html`, and its `src/looper.cpp` and `src/plugin.cc`.

- **Quantizing.** Recordings start and stop on a cycle boundary (the bar), and a loop is always a whole number of cycles. Overdubs are never quantized, as in SooperLooper. Our addition: a press up to 0.15 s *after* a bar line still counts as on it. The worklet keeps the last ~6 s of input in a ring buffer, so it can start the recording in the past.
- **Crossfades.** SooperLooper fades every operation over 64 samples by default. We use 3 ms (144 samples at 48 kHz), because 64 samples is a tenth of the low E's period and can click on a loud low note. The seam is closed by recording one fade past the end and crossfading that run-on into the loop's start, so a note ringing across the seam carries on instead of being cut. Overdub punch-ins and punch-outs, and switches of reverse or speed, are crossfaded the same way.
- **Feedback.** It works as in SooperLooper (default 100%): while you overdub, it scales the old loop on every pass, from the first one. SooperLooper multiplies the samples in place. Here each pass is its own layer with a gain, so the sound is the same and Undo can still give the older layers their level back.
- **Latency.** SooperLooper compensates input and output latency separately. We use one number, the round trip: you hear frame *f* a moment late, play along with it, and your playing arrives later still. So input arriving at frame *g* is written at loop time *g* minus the round trip. The value comes from the **Timing offset** you measured on the Rhythm page if there is one, else the browser's estimate. The Looper's own card can nudge it.

### How the key is found

`js/looper.js` builds a pitch-class profile (*chroma*) of the loops: each spectral peak between 60 Hz and 2 kHz adds its magnitude to its semitone (Fujishima, *Realtime chord recognition of musical sound*, ICMC 1999). A **harmonic sieve** first lowers any peak at 3, 5, 6 or 7 times a stronger one below it. A guitar's overtones are strong: the 3rd harmonic of an A is an E, and without the sieve an Am7 vamp reads as E minor. The profile is then matched to the 24 Krumhansl–Kessler key profiles (Krumhansl & Kessler, *Psychological Review* 89, 1982; Krumhansl, *Cognitive Foundations of Musical Pitch*, 1990): this is the Krumhansl–Schmuckler algorithm. The profile values are music21's (`music21/analysis/discrete.py`, `KrumhanslSchmuckler`), a secondary source: we didn't check them against the 1982 paper itself.

A relative major and minor (C major and A minor) have the same notes, so the profiles often can't separate them. When the two best keys are relatives within 0.15 of each other, we break the tie with a rule of our own: the loops' opening bass note decides, because a loop usually starts at home. The bass is found by subharmonic summation (Hermes, *Measurement of pitch by subharmonic summation*, JASA 83, 1988). This handles the low E's weak fundamental, which can sit 20–30 dB under its 2nd harmonic. The card always names the relative key too, since the same scales work over both. The scale suggestions are rules, written out in `suggest()`.

**Hands-free, checked end to end** in Chromium, with a fake mic playing real guitar notes. *When I play* plus *Record next*, with tracks of 2, 1, 1 and 1 bars, took one press: track 1 started on the first note (and the grid and drums with it), and each track took over exactly on the bar line. The recorded loop starts 5 ms before the attack the detector reported: the level profile from the loop's first sample matches the file's own, read from 5 ms before that attack.

**Checked against:** ten synthetic chord progressions in eight keys, including Am F C G, which K–S hears as C major and either reading is fair; the six real guitar recordings in `test/data`, where the strongest pitch class and the bass note of each are right; and an E + G + E chord of real strings, which reads as E minor. The loop engine is tested sample by sample, with a real low E through it at a 23 ms round trip: it plays back exactly, with no click at the seam.

## Using a USB audio interface (BOSS KATANA:GO and others)

Plug the interface in, click **Enable microphone**, then pick it in the input list on the Hearing card. A guitar signal over USB is much cleaner than a mic in the room, so note detection is more reliable and the band can't leak in through the air. Switching devices runs **Auto-set** again, so stay quiet for a second.

- **Channel.** For a stereo input you can listen to **Both** channels, or only **1 · Left** or **2 · Right**. On a two-input interface, pick the input your guitar is plugged into.
- **Output** (Chrome and Edge). Pick where the page's sound goes. When you select an interface as the input, the output switches to it automatically, so the band and the metronome play in its headphones. Safari and Firefox can't choose an output per page: set the computer's sound output to the interface instead.
- **Loopback.** If the interface sends its playback back to the computer, the band leaks into the input. The Call & response page notices when it hears the lick during the call and tells you to turn Loopback off.

**KATANA:GO.** It's a class-compliant USB interface running at 48 kHz. Over USB it normally sends your amp tone, with its effects. There's no official dry output, but BOSS users report a workaround:

1. Turn **Loopback off** (in BOSS TONE STUDIO).
2. Connect the GO over USB before you turn it on.
3. Turn on the **tuner**. The GO then sends your dry guitar to the computer. You still hear the USB audio (the band) and your guitar, quietly, in its headphones. This doesn't work over Bluetooth.

A dry signal gives the most reliable detection. If you'd rather play with your amp tone, keep delay and reverb low, since echoes look like extra notes. This workaround comes from forum reports, not from BOSS, and may depend on firmware. If the page reports wrong notes, try the other mode.

On the Call & response page, **Sound and amp → Play my guitar through this amp** sends the dry input through the lick's amp, including a loaded NAM capture. You then hear your guitar with the same tone as the licks, at the cost of a little latency. It only works when the input is an interface, never a mic, because a mic would feed back.

## How the note detection works

`js/pitch.js` runs the YIN pitch estimator about 100 times a second on ~40 ms of audio. A note counts once its pitch holds for ~45 ms. A ringing string isn't counted twice. Picking the same pitch again counts as a new note, because each pick attack is detected and confirmed (a metronome click doesn't pass that check).

When you pick a note an octave above a string that's still ringing, the detector compares which harmonics just got louder to tell the two notes apart.

Grading goes by **pitch, not strings**. It catches wrong notes and wrong octaves, but it doesn't mark G3 on the A string (fret 10) wrong when the exercise asked for G3 on the D string (fret 5). The app does guess the string from each note's sound (see *Which string you played*) and gives a hint when a note seems to be on another string, but that guess isn't reliable enough to grade you on.

Tips:
- Tune up first. The *Hearing* panel doubles as a tuner. For fine tuning or setting intonation, press **Precise tuner**. The scale then spans ±10¢ and reads to a tenth of a cent, a strobe stands still when you're in tune, and you can set the reference pitch (A4 = 430–450 Hz; the note detection uses it too).
- Wear headphones for the metronome.
- If notes don't register, raise **Sensitivity**. If noise triggers notes, lower it, or press **Auto-set** while the room is quiet.
- If your mic keeps hearing the wrong octave, turn off **Check the octave** under *More options*.

## Files

| File | What it does |
|---|---|
| `pickups.html`, `css/pickups.css`, `js/pickups-app.js` | Pickup height page, styles and UI wiring: the figures, the measurements, the diagrams, the level check |
| `js/pickups.js` | Gibson's and StewMac's pickup heights, units, what to turn and how far, the level check (no DOM) |
| `test/pickups.test.js` | The pickup figures, units, the screw and shim advice, the level check: `node web/test/pickups.test.js` |
| `session.html`, `css/session.css`, `js/session-app.js` | Daily session page, styles and UI wiring |
| `js/scales.js` | Scales, chords and shapes computed from pitches: pentatonic boxes, 7-note positions, 3-notes-per-string, arpeggios, triads on string sets (no DOM) |
| `js/sessiongen.js` | Exercise families (rhythm included), sequences, the session planner and its rules, the learner model, sequence, free-play and rhythm graders (no DOM) |
| `js/pad.js`, `js/seqtab.js` | The session's drone/chord pad and chime, and the wrapping sequence tab (with technique marks and rests) |
| `js/technique.js` | Vibrato, legato, palm-mute and stop graders, from the tracker's frames and the onset detector (no DOM) |
| `js/stand.js` | Stand mode for the Daily session, Scales and Call & response: the one-screen view, pedals, play to start, the big flashes |
| `scales.html`, `css/scales.css`, `js/scales-app.js` | Scales page, styles and UI wiring: setup, the whole-neck board and CAGED strip, drills, the play-along and its report |
| `js/scaleneck.js` | CAGED letters and chord grips, every shape across the neck, ladders, diagonals and one-string routes, backings per genre, the hand-position estimate, play-along stats and tips (no DOM) |
| `test/scaleneck.test.js` | Grips in every key, shapes cover the neck, routes, backings fit their scales, tracker and stats: `node web/test/scaleneck.test.js` |
| `test/sessiongen.test.js` | Every shape in every key, sequences, every exercise family, plans, the learner, the graders: `node web/test/sessiongen.test.js` |
| `test/technique.test.js` | Vibrato width and speed, legato level, palm mute vs open and stops on synthetic electric-guitar audio, through the real tracker and onset detector: `node web/test/technique.test.js` |
| `test/tunerengine.test.js` | The Tuner's pitch engine on synthetic sound with known truth: accuracy on realistic plucks (line and phone mic), quiet strings with no special mode, the noise filter (hum, a fan, talking and a held vowel kept off the gauge; every string still tuned with them in the room), a peg turned while ringing, switching strings (the low E under a ringing high e and back), other sample rates, a chromatic tuner: `node web/test/tunerengine.test.js` |
| `test/realguitar.test.js` | The same engine on six real guitar recordings (`test/data/`, three of them low E's): line input, a phone's mic close and across the room, an unplugged electric's level: `node web/test/realguitar.test.js` |
| `test/stand.test.js` | Stand mode's pedal keys, start notes and zoomed fret windows: `node web/test/stand.test.js` |
| `index.html`, `css/style.css` | Page and styles. The colors match the deck: root red, 3rd amber, 5th blue. |
| `js/theory.js` | Notes, tunings and fret math (a port of `build/lib/theory.js`) |
| `js/pitch.js` | YIN detector + `NoteTracker` (turns audio frames into note events), quiet mode's settings |
| `js/tunerengine.js` | The Tuner's pitch engine (the Tuner page and the Hearing card's precise tuner): harmonic detection on a whitened spectrum, phase-based partial frequencies, a stiff-string fit, the noise filter |
| `js/audio.js` | Input (mic or interface, channel routing), output device, analysis loop, the onset worklet, metronome, plucked-string synth |
| `js/fretboard.js` | SVG fretboard |
| `js/drill.js` | Drill logic, timing, scoring, speed stats (no DOM) |
| `js/app.js` | UI wiring |
| `licks.html`, `css/licks.css` | Call & response page and its styles |
| `js/licks-blues.js` | The lick library (tab tokens, written in A) |
| `js/lickgen.js` | Rule checker, chord fit, generator, retargeting, grading (no DOM) |
| `js/band.js` | Backing band: synthesized drums/bass/guitars, amps (built-in or NAM), scheduler |
| `js/tab.js` | SVG tab with bends, slides, hammer-ons and a playhead |
| `js/micpanel.js` | The Hearing card shared by every page: input device and channel, output device, interface tips, sensitivity, tuner (and its precise mode) |
| `js/licks-app.js` | Call & response UI wiring |
| `vendor/nam/` | Neural Amp Modeler engine (third-party, MIT) |
| `AI-OPTIONS.md` | Survey of AI models and open-source projects that could be added, with a recommendation (nothing in it is built yet) |
| `rhythm.html`, `css/rhythm.css`, `js/rhythm-app.js` | Rhythm page, styles and UI wiring: scheduler, lane, timing offset, report |
| `js/rhythm.js` | Rhythm patterns and their prerequisites, step timing and swing, click and drum parts, the timing grader, statistics, tips, tempo ladder (no DOM) |
| `js/rhythmplay.js` | The lane, the recent-hits strip, and a run (count-in, click or drums, grading, passes, ladder): shared by the Rhythm page and the Daily session |
| `js/onset.js` | Attack (onset) detector, and the AudioWorklet that runs it |
| `test/rhythm.test.js` | Library, timing, grader, drift, ladder and tip tests: `node web/test/rhythm.test.js` |
| `test/onset.test.js` | Detector tests on synthetic notes, strums, chugs and clicks: `node web/test/onset.test.js` |
| `looper.html`, `css/looper.css`, `js/looper-app.js` | Looper page, styles and UI wiring: transport and beat, tracks, monitoring, timing offset, key card, WAV download |
| `js/looper-worklet.js` | The loop engine (`LoopCore`) and the AudioWorklet that runs it: record, overdub layers, undo/redo, feedback, reverse, ½×/2×, ×2, crossfades, latency |
| `js/looper.js` | Looper logic (no DOM): quantizing to the bar, where a play-triggered recording starts, chain order, drum grooves, chroma with a harmonic sieve, Krumhansl–Schmuckler key finding, bass note, scale suggestions, mix length, WAV encoder |
| `test/looper.test.js` | Loop engine (sample-exact playback, latency, seam, overdub, undo/redo, feedback, reverse, ½×, ×2), quantizing, grooves, key finding on synthetic and real guitar, WAV: `node web/test/looper.test.js` |
| `write.html`, `css/write.css`, `js/write-app.js` | Song writing page, styles and UI wiring |
| `js/pinyin-data.js`, `tools/gen-pinyin.swift` | Pinyin and tone for every common character, and the script that generates it |
| `js/zh.js` | Mandarin lyric helpers: syllables, word readings, tone sandhi, 十三辙 rhyme groups and word banks, the tone/melody judge (no DOM) |
| `js/songtheory.js` | 简谱 chords, progressions, swaps, styles and song forms, the melody generator, quantizing, 简谱 text, lead sheet (no DOM) |
| `js/songband.js` | The song band: ballad, Mandopop and rock grooves, pad, guide voice (extends `band.js`) |
| `test/songwriter.test.js` | Pinyin, sandhi, rhymes, tone judge, chords, melody generator: `node web/test/songwriter.test.js` |
| `test/lickgen.test.js` | Library, rules, generator and grader tests: `node web/test/lickgen.test.js` |
| `test/pitch.test.js` | Detector tests on synthetic plucked strings: `node web/test/pitch.test.js` |
| `test/polytune.test.js` | Strum all six: every string within 2¢ from one synthetic strum, shared harmonics, far-off strings, drop D, A4 = 442, noise: `node web/test/polytune.test.js` |
| `test/quiet.test.js` | Unplugged-guitar mode for note detection: quiet strings in hiss, unheard normally, heard as their notes; nothing on hiss alone: `node web/test/quiet.test.js` |
| `test/tuneguide.test.js` | The Tuner page's logic: string choice, direction, holds, guided order, end to end: `node web/test/tuneguide.test.js` |
