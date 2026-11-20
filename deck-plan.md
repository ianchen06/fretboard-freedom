# Fretboard Freedom: Deck Plan

A deep-dive PowerPoint course for electric guitar. It's for someone who knows open and power chords and the first minor pentatonic box, and wants to use the whole neck, find any note, solo and jam. The examples lean toward **blues & rock** and **rock & metal**.

**Format:** .pptx, 16:9, about 81 slides. Every slide has detailed speaker notes so the deck works for self-study. Drill and lick slides include tab. The deck also has printable cheat sheets and a practice log.

---

## Design

- **The colors mean the same thing on every slide:**
  - Root: red
  - 3rd (major or minor): amber
  - 5th: blue
  - 7th: purple
  - ♭5 "blue note": teal
  - Other scale notes: light gray

  You'll learn to see chord tones inside every scale shape.
- **Fretboard diagrams** are horizontal, with the high e string on top so they read like tab. They're drawn as rosewood with cream frets and fret markers.
- **Look:** dark charcoal, like a stage, so the colored notes stand out. The cheat sheets and practice log use a white background so they print cleanly.
- **Default keys:** A for the blues and rock examples, E for the metal examples.

## How it gets built

1. A small Python music-theory module calculates notes, intervals, scales and chords. Every fretboard diagram is generated from it, not drawn by hand, so no dot can be wrong.
2. Diagrams and tab are native PowerPoint shapes, so they stay sharp and editable.
3. QA: every slide is rendered to an image and checked for layout. A script also checks that every labeled dot matches the computed note.
4. **Staged build:** first a sample of about 8 slides to approve the look, then the rest.

---

## Slide outline

### 0 · Start here
1. **Title**: Fretboard Freedom
2. **Roadmap**: from box 1 to the whole neck, in 8 stages
3. **How to read this deck**: the color code, how the diagrams are oriented, how to read tab
4. **How to practice**: go slow with a metronome, accuracy before speed, a little every day beats a lot once a week, record yourself

### 1 · Theory you actually need
5. Section divider
6. **The 12 notes**: the musical alphabet, sharps and flats, no sharp between B–C and E–F, 1 fret = 1 half step
7. **Intervals**: all 12 distances, with the semitone count, name and character of each
8. **The major scale**: W W H W W W H, built along one string, scale degrees 1–7
9. **Minor scale & relative keys**: the natural minor formula, A minor has the same notes as C major, the keys guitarists use most (E, A, D, G)
10. **Building chords**: triads from stacked 3rds (major, minor, diminished). A power chord is 1 + 5, which is why it works so well with distortion.
11. **7th chords**: maj7, dominant 7, m7, and why blues uses dominant 7s everywhere
12. **Chords in a key**: major I ii iii IV V vi vii°; minor i ii° ♭III iv v ♭VI ♭VII
13. **Common progressions**: 12-bar blues, I–IV–V, I–V–vi–IV, i–♭VI–♭VII, i–♭VII–♭VI–V
14. **Practice this**: spell the scales and chords in 5 keys, a Roman-numeral quiz

### 2 · Mapping the fretboard
15. Section divider
16. **Anatomy**: E A D G B E (with a memory trick), frets, inlays, everything repeats after the 12th fret
17. **The full map**: every note on frets 0–12, natural notes bright, sharps and flats dimmed
18. **Landmarks**: natural notes on the low E string
19. **Landmarks**: natural notes on the A string, your root finder for power and barre chords
20. **How the strings are tuned**: 5-5-5-4-5, and the G–B shift that bends every shape
21. **Octave shapes**: the 4 shapes that carry a note across all 6 strings
22. **One note, five places**: the same pitch in different positions
23. **Practice this**: fretboard map drills

### 3 · Find any note
24. Section divider
25. **The 3-step method**: find it on the E or A string → use an octave shape → name it
26. **Drill: one note everywhere**: find a note on all 6 strings, with a metronome schedule
27. **Drills: string by string + circle of fourths** (C F B♭ E♭ A♭ D♭ G♭ B E A D G)
28. **Interval shapes**: where the 3rd, 5th, ♭7 and octave sit around any root, for roots on the 6th and 5th strings
29. **Practice this**: a 5-minute daily note finder. Checkpoint: name any note on any string in under 2 seconds.

### 4 · Breaking out of box 1
30. Section divider
31. **Why box 1 traps you**, and the way out
32. **CAGED**: the 5 open chord shapes become movable shapes, with one chord shown in 5 positions (colored by root, 3rd and 5th)
33. **Minor CAGED**: the Am, Em and Dm shapes moved up the neck
34. **The 5 minor pentatonic boxes**: full-neck view in A minor
35. **Boxes 1 & 2**: the shapes and where they overlap
36. **Boxes 3, 4 & 5**: the shapes and where they overlap
37. **Pentatonic ↔ CAGED**: each box surrounds a chord shape, and here's where the roots are
38. **Playing along one string**: the scale laid out horizontally, with slides
39. **Diagonal runs**: crossing 3 boxes in one phrase (tab)
40. **3 notes per string**: natural minor shapes for rock and metal speed
41. **Triads on the top 3 strings**: major and minor, in root position plus 2 inversions
42. **Arpeggios**: minor, major and dominant 7
43. **Practice this**: linking the boxes, improvising on one string, chaining triads

### 5 · Soloing
44. Section divider
45. **What makes a solo sound good**: note choice, rhythm, phrasing, technique
46. **Home base**: minor pentatonic plus the blues scale's ♭5 blue note
47. **Major pentatonic**: the same shape, moved 3 frets down
48. **Mixing major & minor pentatonic over a blues**: the ♭3→3 move
49. **Target notes**: land on chord tones on the strong beats
50. **Following the changes**: in a 12-bar in A, aim for C♯ over A7, F♯ over D7, G♯ over E7
51. **Phrasing**: space, call and response, motifs, repetition and variation
52. **Bends**: half, whole, pre-bend, release, unison bend, and checking your pitch against the fretted note
53. **Vibrato, slides, hammer-ons, pull-offs, double stops**
54. **Essential blues & rock licks** (tab, about 6 licks)
55. **Rock & metal licks**: pedal point, repeating triplets, 3-notes-per-string runs (tab)
56. **Natural & harmonic minor**: the rock and metal sound, and harmonic minor over the V chord
57. **Modes that matter**: Dorian, Mixolydian, Phrygian, and the one note that gives each its flavor
58. **Which scale over which chord**: a lookup table
59. **Picking & speed**: alternate picking, a metronome ladder, sequences in 3s and 4s, palm muting
60. **Building vocabulary**: transcribe a lick, steal it, change it, make it yours
61. **Practice this**: a 3-note solo, a one-string solo, a solo where only the rhythm varies, a target-note solo

### 6 · Rhythm & jamming
62. Section divider
63. **Roles in a jam**: rhythm vs. lead, listening, leaving space
64. **Rhythm toolkit**: power chords, palm muting, building riffs, picking patterns
65. **Comping up the neck**: triads and partial chords instead of open chords
66. **Finding the key**: by ear (hum the "home" note and find it on the low E) or from the chord list
67. **Jam form: 12-bar blues**: shuffle riff, quick change, turnaround (tab)
68. **Jam form: minor blues** and slow minor jams
69. **Jam form: rock progressions**: I–V–vi–IV, I–♭VII–IV, i–♭VI–♭VII, i–♭VII–♭VI–V
70. **Jam form: one-chord vamps & metal riffs**: E pedal tone, the Phrygian ♭2
71. **Jam etiquette & signals**: count-ins, volume, trading solos, endings
72. **Practice this**: backing tracks, a looper, recording yourself

### 7 · Practice plan & reference
73. Section divider
74. **Daily routines**: 30-minute and 60-minute templates
75. **12-week roadmap**: milestones for each month
76. **Practice log**: a weekly tracker with tempo goals (prints well)
77. **Cheat sheet**: fretboard map + octave shapes
78. **Cheat sheet**: CAGED + the 5 pentatonic boxes
79. **Cheat sheet**: intervals, chords in a key, progressions
80. **Cheat sheet**: which scale over which chord
81. **Closing**: 3 things to do every day

---

## Proposed sample (built first, for your OK on the look)
Slides 1, 3, 12, 17, 34, 54, 61 and 76: the title, the color-code legend, a theory table, the full fretboard map, the pentatonic boxes, a lick slide with tab, a practice-drill slide and the practice log.
