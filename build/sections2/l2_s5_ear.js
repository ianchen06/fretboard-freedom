// Level 2 · Part 5 · Ear training (slides 52–59)
const T = require('../lib/theory');
const D = require('../lib/draw');
const { HEX, M, CONTENT_TOP, section } = require('../lib/deck');

const KICKER = '5 · Ear training';
const FULL_W = 12.13;

function heading(s, str, x, y, w) {
  s.addText(str, { x, y, w, h: 0.32, fontSize: 15, bold: true, color: HEX.pearl, margin: 0, valign: 'middle', isTextBox: true });
}

function arrow(s, x, y) {
  s.addText('→', { x, y, w: 0.34, h: 0.4, fontSize: 18, color: HEX.muted, align: 'center', valign: 'middle', margin: 0, isTextBox: true });
}

// Chord tile with its Roman numeral (colored by the bass note's role in the key).
function tile(pres, s, x, y, w, h, name, numeral, role) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.08, fill: { color: HEX.card }, line: { color: HEX.card, width: 0 } });
  s.addText(numeral, { x, y: y + 0.06, w, h: h * 0.45, fontSize: 15, bold: true, color: D.ROLE_HEX[role] || HEX.pearl, align: 'center', valign: 'middle', margin: 0, isTextBox: true });
  s.addText(name, { x, y: y + h * 0.48, w, h: h * 0.45, fontSize: 16, bold: true, color: HEX.white, align: 'center', valign: 'middle', margin: 0, isTextBox: true });
}

function build(pres) {
  section(pres, 'Ear training');
  const slide = (title, notes) => D.slideOf(pres, { kicker: KICKER, title, notes });

  // 52 · Divider
  D.divider(pres, {
    num: 5, title: 'Ear training',
    subtitle: 'Shapes tell you where notes are. Your ears tell you which ones to play. This part connects the two.',
    outcomes: [
      'Sing a phrase and find it on the neck on the first try',
      'Name the 12 intervals by sound',
      'Tell major, minor, 7, maj7, m7, dim and sus chords apart',
      'Follow I, IV, V and vi by the bass movement',
      'Transcribe a short solo with a repeatable method',
    ],
    notes: `Part 5 trains the skill that separates players who can jam with anyone from players who can only play what they've memorized: hearing.

Everything in Levels 1 and 2 so far has been visual and physical: shapes, positions, patterns. Those are essential, but music is sound. When you jam, nobody shows you a chart of the next chord or the phrase they want you to answer. You hear it, and you have about a second to respond.

The good news is that ear training is a skill, not a talent. Everyone improves with daily, short, focused practice, and guitarists have an advantage: the fretboard is a ruler. Once you know that a perfect 4th is "same fret, next string" (one fret higher from G to B) and you can hear a perfect 4th, finding sounds on the neck becomes fast.

What's in this part:
• The ear–hand loop: hear, sing, find, check. The core habit everything else uses.
• Intervals by ear, with reference tunes you already know.
• Chord qualities by ear: the character of each chord type.
• Progressions by ear: following the bass to tell I, IV, V and vi apart.
• A step-by-step transcription method.
• Looper games that make ear training feel like playing, not homework.

Five minutes a day is enough. Ear training works best a little at a time, every day, ideally at the start of a session while your ears are fresh. Expect it to feel slow for the first two or three weeks, then suddenly click.`,
  });

  // 53 · The ear–hand loop
  {
    const s = slide('The ear–hand loop', `The core habit of this whole part is a four-step loop. Do it slowly at first; with practice it collapses into a fraction of a second.

1. Hear. Listen to a short phrase: a lick on a record, a melody, a note someone plays. Keep it short, 2 to 5 notes to start.
2. Sing. Sing or hum it back. This is the most important step, and the one most guitarists skip. If you can't sing it, you haven't really heard it yet. Your voice doesn't need to be good, just roughly in tune.
3. Find. Find the first note on the guitar by singing it and sliding along one string until the guitar matches your voice. Then find the rest by asking "up or down? step or leap?"
4. Play and check. Play the whole phrase along with the original. If something sounds wrong, go back to step 2 for that note only.

Why singing works: singing forces your brain to build an internal model of the pitch. Playing alone lets your hands guess and your ears accept whatever comes out. Players who sing what they play (many great blues players do this audibly) develop phrasing that sounds vocal, because it is.

The diagram shows the shortcut once you know the key. Sing the home note, find it on the low E (here A at fret 5), and the whole box is suddenly around your hand. Most notes in a rock or blues phrase will be in that box, so "find" becomes "choose from 12 notes" instead of "search 150 frets".

Start every practice session with two or three loops. Five minutes is plenty.`);
    const steps = [
      ['1', 'Hear', 'Pick a phrase of **2–5 notes**. Listen to it three times.', 'root'],
      ['2', 'Sing', 'Hum it back. **If you can’t sing it, you haven’t heard it yet.**', 'third'],
      ['3', 'Find', 'Sing the first note and slide on one string until it matches. Then: **up or down? step or leap?**', 'fifth'],
      ['4', 'Play and check', 'Play along with the original. Fix only the notes that sound wrong.', 'seventh'],
    ];
    const w = (FULL_W - 3 * 0.42) / 4; const h = 2.2;
    steps.forEach(([n, t, b, role], i) => {
      const x = M + i * (w + 0.42);
      D.card(s, { x, y: CONTENT_TOP, w, h, title: t, badge: n, badgeRole: role, body: b, fontSize: 14 });
      if (i < 3) arrow(s, x + w + 0.04, CONTENT_TOP + h / 2 - 0.2);
    });
    heading(s, 'Shortcut: sing home, find it on the low E, play the box', M, 4.05, 7.0);
    D.fretboard(s, {
      x: M, y: 4.55, w: 6.6, h: 1.95, from: 3, to: 9, root: 'A', title: 'ear loop',
      dots: D.dotsFor(T.pentBox('A', 1), { root: 'A', label: 'note', ring: (p, sm) => !(p.s === 6 && p.f === 5), roleOf: (sm) => T.role(sm) }),
    });
    D.card(s, {
      x: 7.6, y: 4.05, w: 5.13, h: 2.8, title: 'Why singing works',
      bullets: ['It forces your brain to **predict** the pitch, not guess it', 'It gives your phrasing a **vocal** shape and natural breaths', 'It’s the fastest route from “hear it” to **“play it first try”**'],
      fontSize: 14, paraSpace: 6,
    });
  }

  // 54 · Intervals by ear
  {
    const s = slide('Intervals by ear', `An interval is the distance between two notes, and every interval has a recognizable sound. Learn to recognize them and you can find any melody on the guitar from its first note.

How to use the table: the "Reference" column gives a well-known tune whose first two notes (or first move) make that interval, going up. Hum the opening of the tune, and you're humming the interval. Where no reference is given, learn the sound description and the fret distance instead.

A few notes on the references:
• Happy Birthday: the jump is from the second note to the third ("py" to "birth"). The first two notes are the same.
• Smoke on the Water: the first move of the famous riff, from the first note to the second.
• The tritone (♭5) sounds unstable and unresolved. In Level 1 you met it as the blues scale's ♭5.

The guitar shortcut: every interval is a fret distance on one string (1 to 12 frets), and a shape across two strings. When you hear an interval and name it, you know exactly how far to move.

How to drill it (right-hand card):
1. Play an A on the open A string. Then play a second note and say the interval out loud before you check the fret count.
2. Sing both notes. Singing each interval is what locks it in.
3. Learn them in this order: octave, 5th, 4th, major 3rd, minor 3rd, then major 2nd, minor 2nd, then the 6ths and 7ths, and the tritone last.
4. Use an ear-training app for random quizzes once you know the sounds. Five minutes a day.

Remember the colors: the amber 3rds tell you major or minor, the blue 5th is the stable power-chord sound, and the purple 7ths are the blues bite.`);
    D.table(s, [
      ['Interval', 'Frets', 'Sounds', 'Reference (going up)'],
      ['{other:♭2}  Minor 2nd', '1', 'Tense, grinding', 'The “Jaws” theme'],
      ['{other:2}  Major 2nd', '2', 'A step, neutral', '“Happy Birthday” (on “birth”)'],
      ['{third:♭3}  Minor 3rd', '3', 'Sad, bluesy', '“Smoke on the Water” riff'],
      ['{third:3}  Major 3rd', '4', 'Bright, sweet', '“When the Saints Go Marching In”'],
      ['{other:4}  Perfect 4th', '5', 'Open, strong', '“Here Comes the Bride”'],
      ['{blue:♭5}  Tritone', '6', 'Unstable, spooky', '“Maria” (West Side Story)'],
      ['{fifth:5}  Perfect 5th', '7', 'Hollow, powerful', '“Twinkle Twinkle Little Star”'],
      ['{other:♭6}  Minor 6th', '8', 'Dark, yearning', 'A major 3rd short of the octave'],
      ['{other:6}  Major 6th', '9', 'Warm, open', '“My Bonnie Lies Over the Ocean”'],
      ['{seventh:♭7}  Minor 7th', '10', 'Bluesy, unresolved', '“Somewhere” (West Side Story)'],
      ['{seventh:7}  Major 7th', '11', 'Dreamy, wants to rise', 'One fret short of the octave'],
      ['{root:R}  Octave', '12', 'Same note, higher', '“Somewhere Over the Rainbow”'],
    ], { x: M, y: CONTENT_TOP, w: 8.6, colW: [2.25, 0.75, 2.15, 3.45], fontSize: 13, align: ['left', 'center', 'left', 'left'] });
    D.card(s, {
      x: 9.5, y: CONTENT_TOP, w: 3.23, h: 5.3, title: 'How to drill it',
      bullets: ['Play open A, then a second note. **Name the interval** before you count frets.', '**Sing** both notes.', 'Learn in order: octave, 5th, 4th, 3rds, 2nds, 6ths, 7ths, tritone.', 'Then quiz yourself with an ear-training app, **5 minutes a day**.'],
      fontSize: 14, paraSpace: 8,
    });
  }

  // 55 · Chord qualities by ear
  {
    const s = slide('Chord qualities by ear', `Every chord type has a character you can learn to recognize, the same way you recognize a friend's voice before you see their face. The table describes each one and tells you what to listen for.

The best way to learn them is in contrasting pairs, where only one note changes (right-hand cards):
• Major vs. minor: only the 3rd moves (C♯ vs. C in A). Major sounds bright and settled; minor sounds darker and more serious. Play A then Am, back and forth, until the difference is obvious.
• Dominant 7 vs. major 7: both add a 7th, but A7 adds G (the ♭7) and Amaj7 adds G♯ (the natural 7). The ♭7 sounds bluesy and restless, like it wants to move to another chord. The natural 7 sounds dreamy and floating, and doesn't need to go anywhere.
• Sus4 vs. major: the sus4 sounds like a question, and the major chord answers it. If a chord makes you want to hear the next one, it may be a sus or a dominant 7.

Other tells:
• Diminished: nothing in it sounds stable. It's a "between" chord.
• Minor 7: minor, but relaxed and smooth rather than sad. Funk and soul live here.
• Power chord: hollow, neither happy nor sad. If you can't tell major from minor, it may be a power chord, or the band may be leaving the 3rd out.

Drill: have a friend (or an app) play random chords from this list while you look away. Start with only major vs. minor, then add one new quality each week. Say the quality out loud before checking.`);
    D.table(s, [
      ['Quality', 'Formula', 'Sounds', 'Listen for'],
      ['Major', '{root:R} {third:3} {fifth:5}', 'Bright, settled', 'The happy 3rd'],
      ['Minor', '{root:R} {third:♭3} {fifth:5}', 'Dark, serious', 'The sad ♭3'],
      ['Dominant 7', '{root:R} {third:3} {fifth:5} {seventh:♭7}', 'Bluesy, restless', 'A rub that wants to move'],
      ['Major 7', '{root:R} {third:3} {fifth:5} {seventh:7}', 'Dreamy, floating', 'Top note just under the root'],
      ['Minor 7', '{root:R} {third:♭3} {fifth:5} {seventh:♭7}', 'Mellow, smooth', 'Minor, but relaxed'],
      ['Diminished', '{root:R} {third:♭3} {blue:♭5}', 'Tense, spooky', 'Nothing feels stable'],
      ['Sus4', '{root:R} {blue:4} {fifth:5}', 'Open, unresolved', 'Wants to fall to the 3rd'],
      ['Power (5)', '{root:R} {fifth:5}', 'Hollow, heavy', 'Neither happy nor sad'],
    ], { x: M, y: CONTENT_TOP, w: 7.9, colW: [1.55, 2.1, 1.9, 2.35], fontSize: 13, boldFirstCol: true });
    heading(s, 'Learn them in pairs', 8.8, CONTENT_TOP, 3.9);
    const pairs = [
      ['A vs. Am', 'Only the **3rd** moves: C♯ vs. C.', 'third', '3'],
      ['A7 vs. Amaj7', '**♭7** (G) is bluesy. **7** (G♯) is dreamy.', 'seventh', '7'],
      ['Asus4 vs. A', 'The sus4 asks a **question**. The major chord **answers** it.', 'blue', '4'],
    ];
    pairs.forEach(([t, b, role, lab], i) => {
      D.card(s, { x: 8.8, y: CONTENT_TOP + 0.45 + i * 1.62, w: 3.93, h: 1.45, title: t, badge: lab, badgeRole: role, body: b, fontSize: 14 });
    });
  }

  // 56 · Progressions by ear
  {
    const s = slide('Progressions by ear: follow the bass', `To hear a chord progression, stop listening to the whole chord and follow the lowest note, the bass. Most rock, pop and blues bass lines play the root of each chord, so the bass movement tells you the progression.

In a major key, these four chords cover most songs: I, IV, V and vi. In A they are A, D, E and F♯m. The diagram shows their bass notes on the low strings: A on the open A string or low E fret 5, D on the A string fret 5, E on the open low E or A string fret 7, and F♯ on the low E fret 2.

What each move sounds like (table):
• I → IV goes up a 4th. It sounds like a lift, a door opening.
• I → V goes up a 5th. It builds tension. The V wants to go home.
• V → I is home. It's the strongest resolution in music.
• I → vi drops a minor 3rd, and the song turns sad or reflective.
• IV → V rises a whole step, pushing forward. It often comes right before a big return to I.
• ♭VII → I also rises a whole step, but to home. It's the classic rock ending (G → A in A).

How to practice:
1. Put on a song you know. Find the home note (sing it, find it on the low E), so you know the I chord.
2. Follow the bass with one finger on the low strings. When it moves, ask "up a 4th? up a 5th? down a minor 3rd?"
3. Write the numerals down. Many songs turn out to be the same four chords in a different order.

The two progressions at the bottom are the ones to learn first: I–IV–V–I (blues, early rock, punk) and I–V–vi–IV (countless pop-rock anthems).`);
    heading(s, 'Bass notes of I, IV, V and vi in A', M, CONTENT_TOP, 6.0);
    D.fretboard(s, {
      x: M, y: CONTENT_TOP + 0.45, w: 6.0, h: 1.95, from: 0, to: 7, root: 'A', title: 'bass notes',
      dots: [
        { s: 5, f: 0, label: 'A', role: 'root' }, { s: 6, f: 5, label: 'A', role: 'root' },
        { s: 5, f: 5, label: 'D', role: 'other' },
        { s: 6, f: 0, label: 'E', role: 'fifth' }, { s: 5, f: 7, label: 'E', role: 'fifth' },
        { s: 6, f: 2, label: 'F♯', role: 'other' },
      ],
    });
    D.table(s, [
      ['Bass move', 'In A', 'What you hear'],
      ['I → IV  (up a 4th)', 'A → D', 'A lift, a door opening'],
      ['I → V  (up a 5th)', 'A → E', 'Tension building'],
      ['V → I', 'E → A', 'Home, resolved'],
      ['I → vi  (down a ♭3)', 'A → F♯m', 'Turns sad, reflective'],
      ['IV → V  (up a step)', 'D → E', 'Pushing forward'],
      ['♭VII → I  (up a step)', 'G → A', 'The rock ending'],
    ], { x: 6.95, y: CONTENT_TOP, w: 5.78, colW: [2.25, 1.1, 2.43], fontSize: 13 });
    const tw = 1.45; const th = 0.85;
    const strip = (y, label, chords) => {
      s.addText(D.runs(label, { color: HEX.white, fontSize: 15 }), { x: M, y, w: 2.9, h: th, margin: 0, valign: 'middle', isTextBox: true });
      chords.forEach(([n, num, role], i) => {
        const x = 3.6 + i * (tw + 0.45);
        tile(pres, s, x, y, tw, th, n, num, role);
        if (i < chords.length - 1) arrow(s, x + tw + 0.05, y + th / 2 - 0.2);
      });
    };
    strip(4.75, '**I–IV–V–I**: blues, early rock', [['A', 'I', 'root'], ['D', 'IV', 'other'], ['E', 'V', 'fifth'], ['A', 'I', 'root']]);
    strip(5.85, '**I–V–vi–IV**: pop-rock anthems', [['A', 'I', 'root'], ['E', 'V', 'fifth'], ['F♯m', 'vi', 'other'], ['D', 'IV', 'other']]);
  }

  // 57 · Melodies and keys by ear: transcription
  {
    const s = slide('Transcribing: a step-by-step method', `Transcribing means working out a piece of music by ear: a riff, a melody or a solo. It's the single best ear-training exercise, and it's how most great players learned. It's slow at first. Your first 8-bar transcription might take an hour, and by your tenth it might take ten minutes.

The method on the left works for anything:
1. Pick a short phrase you love, 3 to 8 seconds. Short is the key. Don't start with a whole solo.
2. Find the key: hum the home note and find it on the low E. Now you know which box most of the notes live in.
3. Loop it slower. Most music players and practice apps can loop a section and slow it to 50–75% without changing the pitch.
4. Sing it until you can sing it without the recording.
5. Find the first note by singing it and sliding along one string until it matches.
6. Map the contour. Is the next note up or down? A step or a leap? Find each note inside the box you've identified.
7. Add the rhythm. Count it, and sketch it on a rhythm grid like the one in Part 1.
8. Add the feel and check it: bends, slides, vibrato, and the exact string and position. Write it as tab, then play along with the recording until you match.

The example on the right is a five-note phrase in A minor pentatonic box 1: C, D, E, G, A. Its contour is step, step, leap, step: rising to the root on the high e. The lines on the diagram show that contour. Once you see that shape, the notes almost find themselves.

Keep a transcription notebook (or a folder of tab files). Every phrase you transcribe becomes vocabulary you can steal, change and own, as you did in Level 1.`);
    D.card(s, {
      x: M, y: CONTENT_TOP, w: 6.2, h: 5.3, title: 'The 8-step method',
      bullets: [
        'Pick a **short** phrase: 3–8 seconds',
        'Find the **key**: hum home, find it on the low E',
        '**Loop** it slower: 50–75% speed',
        '**Sing** it without the recording',
        'Find the **first note** on one string',
        'Map the **contour**: up or down, step or leap',
        'Add the **rhythm**: count it, sketch a grid',
        'Add the **feel**, write the tab, play along',
      ],
      fontSize: 15, paraSpace: 7,
    });
    heading(s, 'Contour first: step, step, leap, step', 7.15, CONTENT_TOP, 5.6);
    const path = [{ s: 3, f: 5 }, { s: 3, f: 7 }, { s: 2, f: 5 }, { s: 2, f: 8 }, { s: 1, f: 5 }];
    const links = path.slice(1).map((p, i) => ({ a: path[i], b: p, color: HEX.pearl, width: 2 }));
    D.fretboard(s, {
      x: 7.15, y: CONTENT_TOP + 0.5, w: 5.58, h: 1.95, from: 4, to: 9, root: 'A', title: 'contour',
      dots: D.dotsFor(path, { root: 'A', label: 'note' }), links,
    });
    heading(s, 'Then add the rhythm', 7.15, 4.45, 5.6);
    D.rhythm(s, {
      x: 7.15, y: 4.9, w: 5.58, beats: 4, sub: 2, labelW: 0,
      rows: [{ notes: [{ at: 0, len: 1, role: 'third', text: 'C' }, { at: 1, len: 1, role: 'other', text: 'D' }, { at: 2, len: 2, role: 'fifth', text: 'E' }, { at: 5, len: 1, role: 'seventh', text: 'G' }, { at: 6, len: 2, role: 'root', text: 'A', accent: true }] }],
    });
  }

  // 58 · Looper ear games
  {
    const s = slide('Looper ear games', `A looper pedal (or a looper app, or just your phone's voice recorder) turns ear training into playing. These four games train your ears while you're making music, which is why they stick.

1. Copy cat. Record a short phrase (2 bars), then let it loop. On the next pass, copy it by ear without looking at your hands from the first time. Then copy it in a different box or octave. This trains hearing and the fretboard at once.

2. Call and answer. Record a 1-bar "call" followed by a 1-bar gap, as in the rhythm grid. Loop it and fill every gap with an answer. Rule: the answer must end on a different chord tone from the call. This is the conversation skill you'll use in every jam.

3. Drone intervals. Record 30 seconds of the open A string ringing (or an A power chord). Over the drone, play single notes and name the interval each one makes with A: "that's the ♭3… that's the 5th…". Against a drone, every interval has a very clear color, and this is also the best way to hear modes (Part 2).

4. Chord-quality quiz. Record yourself playing 8 random chords from Part 5's list (A, Am, A7, Amaj7, Am7, Adim, Asus4, A5), with a pause after each. A day later, play it back and name each one before the next chord. Check against your list.

Keep each game to 3–5 minutes. If you have a friend to jam with, play the first two games together: one plays, the other copies or answers, then swap. That's ear training disguised as fun, and it's how a lot of players learned before apps existed.`);
    heading(s, 'Call and answer: you record bar 1, then answer in bar 2', M, CONTENT_TOP, 9.0);
    D.rhythm(s, {
      x: M, y: CONTENT_TOP + 0.4, w: FULL_W, beats: 8, sub: 2, beatsPerBar: 4,
      rows: [
        { label: 'Call (loop)', notes: [{ at: 0, len: 1, role: 'root', text: 'A' }, { at: 1, len: 1, role: 'third', text: 'C' }, { at: 2, len: 2, role: 'other', text: 'D' }, { at: 4, len: 1, role: 'third', text: 'C' }, { at: 5, len: 3, role: 'root', text: 'A' }] },
        { label: 'Answer (you)', notes: [{ at: 8, len: 1, role: 'fifth', text: 'E', ghost: true }, { at: 9, len: 1, role: 'seventh', text: 'G', ghost: true }, { at: 10, len: 2, role: 'root', text: 'A', ghost: true }, { at: 12, len: 4, role: 'fifth', text: 'E', ghost: true }] },
      ],
    });
    const games = [
      ['Copy cat', 'Loop a 2-bar phrase. Copy it by ear, then in **another box**.', 'root'],
      ['Call and answer', 'Fill every gap. **End on a different chord tone** from the call.', 'third'],
      ['Drone intervals', 'Loop open A. Play a note and **name its interval** against the drone.', 'fifth'],
      ['Chord-quality quiz', 'Record 8 random chord types. **Name them** a day later.', 'seventh'],
    ];
    const w = (FULL_W - 3 * 0.3) / 4;
    games.forEach(([t, b, role], i) => {
      D.card(s, { x: M + i * (w + 0.3), y: 3.75, w, h: 3.05, title: t, badge: String(i + 1), badgeRole: role, body: b, fontSize: 15 });
    });
  }

  // 59 · Practice this
  D.practice(pres, {
    kicker: KICKER,
    intro: 'Five minutes at the start of every session, while your ears are fresh. Sing everything.',
    drills: [
      { name: 'Interval of the day', how: 'Pick one interval. Play it from 5 different roots, sing it each time, then find it in a tune you know.', tempo: 'Free time', time: '2 min', done: 'You sing it before you play it' },
      { name: 'Sing, then play', how: 'Over an A drone, sing a 3–4 note phrase, then play it on the first try. Start inside box 1, then use any box.', tempo: 'Free time', time: '2 min', done: '8 of 10 phrases right first try' },
      { name: 'Quality quiz', how: 'With an app or a friend, name major, minor, 7, maj7, m7, dim and sus4 by ear. Add one new type each week.', tempo: 'Free time', time: '1 min', done: '90% right two days running' },
      { name: 'Weekly transcription', how: 'Each week, transcribe 4–8 bars of a solo you love with the 8-step method. Log it and add it to your licks.', tempo: 'Slow the recording to 50–75%', time: '10 min, 2–3 times a week', done: 'You play it along with the record' },
    ],
    notes: `Three drills for a daily five-minute ear routine, plus one longer weekly project.

1. Interval of the day. One interval per day, every day, cycling through all twelve over two weeks, then repeating. Play it from five different roots on different strings, and sing both notes each time. Finish by finding the interval in a tune you know: the reference tunes on the intervals slide are a starting point, but intervals you find yourself stick better.

2. Sing, then play. Let the open A string ring, or loop a drone. Sing a short phrase you invent, then try to play it on the first attempt. Count first-try hits out of ten. Start inside box 1, where you know the territory, then let yourself use any box. This is the ear–hand loop under pressure, and it's the skill you'll use most when jamming.

3. Quality quiz. Ear-training apps can play random chords for you. Or ask a friend to play them while you look away. Begin with major vs. minor only. Add one new quality each week, in this order: dominant 7, minor 7, major 7, sus4, diminished. Say the quality before you check.

4. Weekly transcription. This is the long-term project. Two or three sessions of ten minutes a week is enough to transcribe 4–8 bars. Use the 8-step method, write the tab, and add the phrase to your lick notebook. Over a year that's 50 phrases of real vocabulary, learned by ear.

Track your first-try score and your quiz accuracy in the practice log. Both numbers will climb slowly for a few weeks and then jump.`,
  });
}

module.exports = { build };
