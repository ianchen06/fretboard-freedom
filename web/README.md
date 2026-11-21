# Fretboard Freedom · Practice app

Interactive drills from the deck. You play your guitar, and the microphone checks every note. It's plain HTML, CSS and JavaScript with no build step. The only third-party code is the optional neural amp engine in `vendor/nam/` (see below).

## Run it

The browser only allows microphone access on `localhost` or `https`, so serve the folder rather than opening the file:

```bash
python3 -m http.server 8765 --directory web
```

Then open http://localhost:8765/session.html (Daily session), http://localhost:8765 (Find any note), http://localhost:8765/scales.html (Scales), http://localhost:8765/licks.html (Call & response), http://localhost:8765/rhythm.html (Rhythm) or http://localhost:8765/write.html (Song writing) in Chrome, Edge, Firefox or Safari and click **Enable microphone**.

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

**Up & down the neck.** Three routes:

- **Shape ladder:** up one shape, down the next, up the next. At the top it turns around in the same shape and comes back down the same way. You shift between shapes on the high e and the low E strings. It links 2 or 3 shapes, or all 5 (the whole cycle). The strip and the neck follow the shape you're in.
- **Diagonal:** 3 notes per string for pentatonics and the blues scale, 4 for 7-note scales, from the start shape's lowest note. The run climbs the neck as it crosses the strings.
- **One string:** the scale from the root to the root an octave up, along one string.

Both sequence modes have the same controls:

- the click and the tempo ladder from the Daily session;
- **Drone** on the root;
- **From memory**, where the dots and tab show "?" until you find each note;
- **Play along**, where the page plays the notes with you in time on a clean guitar. An amber outline in the tab shows where it is. It's heard by a mic in the room, so use headphones.

**Play along (the band).** A backing in your key: the blues band's shuffle (12-bar, quick change, one-chord vamp) or the song band's rock, metal (palm-muted), pop and ballad grooves, or a drone. The list puts first the backings whose chords fit your scale (outside the blues, a 7-note scale that fits has every chord tone; over a 12-bar, Mixolydian fits the I7 and Dorian the IV7, which is the sound of the style; tested). Below them are the ones from other genres that fit, then the genre's others, which will clash. The neck shows the scale and rings the tones of the chord that's playing. Every note you play lights up where you probably played it. You choose where to play:

- **Anywhere.** The report shows which shapes you used.
- **Stay in one shape.**
- **Move every 4 bars** or **every 2 bars.** The shape moves up the neck through five shapes, then back down. The next shape is outlined above the neck a bar ahead.

The stats count notes in the scale and bars that start on a chord tone. They also count notes in the shape of the moment, or the shapes you used. The report shows notes per shape and per fret, with tips: you stayed in one box, beat 1 missed the chord, these notes were outside the scale.

**What the mic can and can't tell.** It hears pitch, not strings. Sequences are checked note by note in order, with timing against the click. In the play-along, each note is placed where your hand has most likely been (`HandTracker`: the place nearest the hand, inside the shape you're asked to stay in). That makes "which shape" and "notes per fret" estimates. "In the shape" means the note's exact pitch is one of the shape's notes.

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

The mic hears **pitch, not strings**. It catches wrong notes and wrong octaves, but it can't tell G3 on the A string (fret 10) from G3 on the D string (fret 5).

Tips:
- Tune up first. The *Hearing* panel doubles as a tuner.
- Wear headphones for the metronome.
- If notes don't register, raise **Sensitivity**. If noise triggers notes, lower it, or press **Auto-set** while the room is quiet.
- If your mic keeps hearing the wrong octave, turn off **Check the octave** under *More options*.

## Files

| File | What it does |
|---|---|
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
| `test/stand.test.js` | Stand mode's pedal keys, start notes and zoomed fret windows: `node web/test/stand.test.js` |
| `index.html`, `css/style.css` | Page and styles. The colors match the deck: root red, 3rd amber, 5th blue. |
| `js/theory.js` | Notes, tunings and fret math (a port of `build/lib/theory.js`) |
| `js/pitch.js` | YIN detector + `NoteTracker` (turns audio frames into note events) |
| `js/audio.js` | Input (mic or interface, channel routing), output device, analysis loop, the onset worklet, metronome, plucked-string synth |
| `js/fretboard.js` | SVG fretboard |
| `js/drill.js` | Drill logic, timing, scoring, speed stats (no DOM) |
| `js/app.js` | UI wiring |
| `licks.html`, `css/licks.css` | Call & response page and its styles |
| `js/licks-blues.js` | The lick library (tab tokens, written in A) |
| `js/lickgen.js` | Rule checker, chord fit, generator, retargeting, grading (no DOM) |
| `js/band.js` | Backing band: synthesized drums/bass/guitars, amps (built-in or NAM), scheduler |
| `js/tab.js` | SVG tab with bends, slides, hammer-ons and a playhead |
| `js/micpanel.js` | The Hearing card shared by every page: input device and channel, output device, interface tips, sensitivity, tuner |
| `js/licks-app.js` | Call & response UI wiring |
| `vendor/nam/` | Neural Amp Modeler engine (third-party, MIT) |
| `AI-OPTIONS.md` | Survey of AI models and open-source projects that could be added, with a recommendation (nothing in it is built yet) |
| `rhythm.html`, `css/rhythm.css`, `js/rhythm-app.js` | Rhythm page, styles and UI wiring: scheduler, lane, timing offset, report |
| `js/rhythm.js` | Rhythm patterns and their prerequisites, step timing and swing, click and drum parts, the timing grader, statistics, tips, tempo ladder (no DOM) |
| `js/rhythmplay.js` | The lane, the recent-hits strip, and a run (count-in, click or drums, grading, passes, ladder): shared by the Rhythm page and the Daily session |
| `js/onset.js` | Attack (onset) detector, and the AudioWorklet that runs it |
| `test/rhythm.test.js` | Library, timing, grader, drift, ladder and tip tests: `node web/test/rhythm.test.js` |
| `test/onset.test.js` | Detector tests on synthetic notes, strums, chugs and clicks: `node web/test/onset.test.js` |
| `write.html`, `css/write.css`, `js/write-app.js` | Song writing page, styles and UI wiring |
| `js/pinyin-data.js`, `tools/gen-pinyin.swift` | Pinyin and tone for every common character, and the script that generates it |
| `js/zh.js` | Mandarin lyric helpers: syllables, word readings, tone sandhi, 十三辙 rhyme groups and word banks, the tone/melody judge (no DOM) |
| `js/songtheory.js` | 简谱 chords, progressions, swaps, styles and song forms, the melody generator, quantizing, 简谱 text, lead sheet (no DOM) |
| `js/songband.js` | The song band: ballad, Mandopop and rock grooves, pad, guide voice (extends `band.js`) |
| `test/songwriter.test.js` | Pinyin, sandhi, rhymes, tone judge, chords, melody generator: `node web/test/songwriter.test.js` |
| `test/lickgen.test.js` | Library, rules, generator and grader tests: `node web/test/lickgen.test.js` |
| `test/pitch.test.js` | Detector tests on synthetic plucked strings: `node web/test/pitch.test.js` |
