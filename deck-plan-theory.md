# Fretboard Freedom · Theory Intensive: Deck Plan

A standalone, deep music-theory course taught on the guitar. It does not assume Level 1 or Level 2: it starts from the half step and ends at chromatic harmony, melodic line theory and song form. Every part ends with **exercises on paper** (with an answer key at the back of the deck) and **exercises on the neck** (drill cards with tempo, time and a "done when" test).

**Format:** .pptx, 16:9, about 90 slides, built with the Fretboard Freedom design system (`build/lib`):
- Dark stage slides for teaching; **light, printable slides for worksheets and the answer key**.
- Color code: root red, 3rd amber, 5th blue, 7th purple, teal for the flavor/altered note, gray for other notes.
- Harmonic-function color code (used on progression tiles): **Tonic = blue, Predominant = amber, Dominant = red, Secondary dominant = teal, Borrowed = purple**.
- Every fretboard dot, tab note and written answer is computed or checked by the theory engine (`lib/theory.js`) at build time.
- Detailed teacher's notes on every slide.

**Default keys:** C for pure theory (no accidentals to distract), A for blues/rock on the neck, E for metal, D/G where a guitar shape sits best.

Build: `cd build && node build.js --deck theory` → `Fretboard-Freedom-Theory-Intensive.pptx`.

---

## Outline

### 0 · Start here
1. **Title**: Theory Intensive: music theory, taught on the guitar
2. **How this intensive works**: the loop for every slide (read → play → sing → write), the two kinds of exercises, the answer key, how long it takes
3. **The chain of ideas**: interval → scale → chord → key → function → color → line → form (flow diagram; each part is one link)

### 1 · Intervals: the atoms (`t_s1_intervals.js`)
4. Divider
5. **Pitch, half steps and spelling**: 12 pitch classes, letters before accidentals, enharmonics, double sharps/flats
6. **Interval number and quality**: number from letters, quality from half steps; P/M/m/A/d; A2 vs m3, A4 vs d5
7. **Interval shapes on the neck**: same string, next string, and the G→B shift
8. **Inversion and octave shapes**: the rule of 9, quality flips, octave shapes across the neck
9. **Compound intervals and tensions**: 9 = 2, 11 = 4, 13 = 6, and where they sit above a root
10. **The harmonic series and consonance**: partials 1–8, the consonance ladder, why power chords love distortion
11. **Exercises on paper** (light): name intervals, build intervals, invert intervals
12. **Exercises on the neck**

### 2 · Scales, keys and the circle (`t_s2_scales.js`)
13. Divider
14. **Major scale anatomy**: W W H W W W H as two tetrachords
15. **Tetrachords build the circle**: C's top half is G's bottom half; a new sharp every 5th
16. **The circle of fifths**: key signatures, order of sharps/flats, relative minors, the two tricks
17. **The neck is a circle of fourths**: across the strings at one fret, and the G–B exception
18. **Scale degrees and tendency tones**: stable 1-3-5, unstable 2-4-6-7 and where each one pulls
19. **Three minor scales**: natural, harmonic, melodic: what each fixes
20. **The brightness ladder**: the 7 modes from one root, one flattened note at a time
21. **Why the pentatonic is safe**: five adjacent fifths, no half steps, no tritone
22. **Exercises on paper** (light)
23. **Exercises on the neck**

### 3 · Chords: construction and guitar voicing (`t_s3_chords.js`)
24. Divider
25. **Stacking thirds**: four triad qualities from two sizes of 3rd
26. **Seventh chords**: maj7, 7, m7, m7♭5, °7, m(maj7)
27. **Extensions and alterations**: 9, 11, 13, ♭9, ♯9, ♯11, ♭13, what to drop on guitar
28. **Reading chord symbols**: a decoder table, every symbol spelled from C
29. **Inversions and slash chords**: bass notes, descending-bass lines
30. **Close vs. drop voicings**: deriving drop 2 and drop 3, the guitar's natural 7th chords
31. **Shell voicings and guide tones**: R-3-7 and R-7-3 shapes on the 6th and 5th strings
32. **Power chords, sus and quartal**: chords without 3rds
33. **Exercises on paper** (light)
34. **Exercises on the neck**

### 4 · Diatonic harmony (`t_s4_diatonic.js`)
35. Divider
36. **Harmonizing the major scale**: triads, and why the qualities fall where they do
37. **Diatonic seventh chords**: one dominant 7 per key, and why that identifies the key
38. **The diatonic 7ths on the neck**: drop 2 ladder in D, top four strings
39. **Harmony in minor**: natural vs. harmonic minor chords; rock and metal minor vocabulary
40. **Harmonized lines: 3rds and 6ths**: double-stop scales on the neck
41. **Exercises on paper** (light)
42. **Exercises on the neck**

### 5 · Function: why chords move (`t_s5_function.js`)
43. Divider
44. **Tonic, predominant, dominant**: the three jobs and the shared-note logic behind them
45. **The tritone engine**: 3 and ♭7 of V7 resolving inward
46. **Root motion**: by 5th, by 3rd, by step
47. **Cadences**: authentic, half, plagal, deceptive, plus rock cadences
48. **Progression templates**: pop, rock, jazz and Mandopop (Roman numerals with 簡譜 numbers)
49. **The blues: its own system**: dominant 7 tonic, 12-bar map, why the rules bend
50. **Voice leading on the guitar**: common tones, steps, smallest motion
51. **Exercises on paper** (light)
52. **Exercises on the neck**

### 6 · Chromatic harmony (`t_s6_chromatic.js`)
53. Divider
54. **Secondary dominants**: V of anything
55. **Secondary dominants on the neck**: the borrowed leading tone and where it resolves
56. **Dominant chains and ii–V of anything**
57. **Modal interchange**: borrowing from the parallel minor
58. **Tritone substitution**
59. **The diminished 7th**: symmetry, rootless V7♭9, passing chords
60. **Chromatic mediants**: the cinematic and metal move
61. **Modulation**: pivot chord, direct (the final-chorus lift), via the new dominant
62. **Exercises on paper** (light)
63. **Exercises on the neck**

### 7 · Melody over harmony (`t_s7_melody.js`)
64. Divider
65. **Chord tones, tensions, avoid notes**
66. **The chord–scale map**
67. **Non-chord tones**: passing, neighbor, appoggiatura, suspension, anticipation, escape, pedal
68. **Targeting and guide-tone lines**
69. **Pentatonic substitution**
70. **Arpeggio superimposition**
71. **Motif development**: repetition, sequence, inversion, retrograde, displacement
72. **Exercises on paper** (light)
73. **Exercises on the neck**

### 8 · Rhythm, phrase and form (`t_s8_form.js`)
74. Divider
75. **Meter as a hierarchy**: simple vs. compound, strong and weak beats, hypermeter
76. **Polyrhythm and hemiola**: 3 against 2, 3 against 4, dotted-8th groupings
77. **Harmonic rhythm**
78. **Phrase structure**: period and sentence
79. **Song form and energy**: what harmony does in each section
80. **Exercises on paper** (light)
81. **Exercises on the neck**

### 9 · Capstone (`t_s9_capstone.js`)
82. Divider
83. **Worked analysis**: one original 8-bar progression, every tool labeled
84. **Capstone project**: write and record a 16-bar piece to spec
85. **Four-week study plan**
86. **Cheat sheet** (light, printable)
87. **Answer key** (light, printable; as many slides as it needs)
