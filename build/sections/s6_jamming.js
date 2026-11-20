// Part 6 · Rhythm & jamming (slides 62–72)
const T = require('../lib/theory');
const D = require('../lib/draw');
const { HEX, M, CONTENT_TOP, section } = require('../lib/deck');

const KICK = '6 · Rhythm & jamming';

// ---------- local helpers ----------
// Roman numeral -> semitones above the key root. Used to check every numeral/chord pair on these slides.
const ROMAN = { i: 0, ii: 2, iii: 4, iv: 5, v: 7, vi: 9, vii: 11 };
function numeralSemis(numeral) {
  const m = numeral.match(/^(♭?)([ivIV]+)/);
  if (!m) throw new Error(`Bad numeral ${numeral}`);
  return T.mod12(ROMAN[m[2].toLowerCase()] - (m[1] ? 1 : 0));
}
function chordRoot(chord) { return chord.match(/^[A-G][♯♭]?/)[0]; }
function checkNumeral(key, numeral, chord) {
  const want = numeralSemis(numeral);
  const got = T.semis(key, T.pc(chordRoot(chord)));
  if (want !== got) throw new Error(`Numeral ${numeral} does not match chord ${chord} in key ${key}`);
  return T.role(got);
}

// 12-bar chart: 3 rows x 4 bars. Badge color = the chord root's job in the key.
function barGrid(pres, slide, { x, y, w, h, key, bars, highlight = [] }) {
  const cols = 4; const rows = 3; const gap = 0.12;
  const cw = (w - gap * (cols - 1)) / cols;
  const ch = (h - gap * (rows - 1)) / rows;
  bars.forEach(([numeral, chord], i) => {
    const role = checkNumeral(key, numeral, chord);
    const cx = x + (i % cols) * (cw + gap);
    const cy = y + Math.floor(i / cols) * (ch + gap);
    const hl = highlight.includes(i + 1);
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: cx, y: cy, w: cw, h: ch, rectRadius: 0.08, fill: { color: HEX.card }, line: hl ? { color: HEX.pearl, width: 2 } : { color: HEX.card, width: 0 } });
    slide.addText(String(i + 1), { x: cx + 0.1, y: cy + 0.05, w: 0.4, h: 0.2, fontSize: 10, color: HEX.faint, margin: 0, isTextBox: true });
    D.badge(slide, { x: cx + 0.12, y: cy + ch / 2 - 0.16, d: 0.46, label: numeral, role });
    slide.addText(chord, { x: cx + 0.66, y: cy + 0.12, w: cw - 0.72, h: ch - 0.2, fontSize: 18, bold: true, color: HEX.white, valign: 'middle', margin: 0, isTextBox: true });
  });
}

function heading(slide, str, x, y, w, color = HEX.pearl, size = 14) {
  slide.addText(str, { x, y, w, h: 0.32, fontSize: size, bold: true, color, margin: 0, valign: 'middle', isTextBox: true });
}

function build(pres) {
  section(pres, 'Rhythm & jamming');

  // 62 · Divider
  D.divider(pres, {
    num: 6, title: 'Rhythm & jamming',
    subtitle: 'Soloing is half of jamming. The other half is rhythm, listening, and always knowing where you are in the song.',
    outcomes: [
      'Play a solid blues shuffle and a tight rock rhythm part',
      'Comp with small triads instead of open chords',
      'Find the key of a song in under a minute',
      'Follow, and signal, the common jam forms',
    ],
    notes: `Part 6: rhythm and jamming.

Most guitarists practice solos alone in their bedroom and then freeze at their first jam. That's not because they lack licks. It's because nobody taught them the other 80% of jamming: playing good rhythm, knowing where you are in the form, finding the key quickly, and reading the other players.

Here's the uncomfortable truth: in a real jam you'll spend far more time playing rhythm than lead. If there are three guitarists and you trade solos, you might solo only one chorus in three. Players who are a joy to jam with have great time, play parts that leave room, know the form cold and make the soloist sound good. Those players get invited back.

What's in this part:
• Roles: what to do as the rhythm player and what to do as the soloist.
• A rhythm toolkit: power chords, palm muting and riff building for rock and metal.
• Comping up the neck with small triads (this uses Part 4).
• Finding the key, by ear and from a chord list.
• The four jam forms you'll meet most often: the 12-bar blues shuffle, the minor blues, common rock progressions, and one-chord vamps and metal riffs.
• Etiquette and the hand signals bands use to steer a song without words.

As always, the part ends with a practice slide. You don't need other people to practice jamming. A looper pedal or a backing track gets you most of the way there.`,
  });

  // 63 · Roles in a jam
  {
    const s = D.slideOf(pres, {
      kicker: KICK, title: 'Roles in a jam: rhythm and lead',
      notes: `Every moment in a jam you have one of two jobs, and each job has its own rules.

When you're playing rhythm, you are the floor everyone else stands on.
• Lock in with the drummer. Listen to the kick drum and snare and put your strums and chugs exactly with them. Good time beats fancy chords every day.
• Play less. Use small shapes (triads, power chords, two-note double stops) and leave space in the frequency range and in time. A rhythm part that stops for a beat sounds more confident than one that never breathes.
• Turn down, or play quieter and simpler, when someone solos. Your job is to make them sound good.
• Keep the form. If the soloist gets lost, the rhythm part is the map that tells them where bar 1 is.

When you're taking a solo, you're having a conversation with the band.
• Listen first. Let one chorus go by. Hear the groove, the key and the feel before you play a note.
• Play in phrases, like sentences, and then leave a gap. The gap is where the band answers you.
• Build. Start low, simple and quiet, and save the high bends and fast runs for the last chorus. A solo needs a story arc.
• End clearly and hand it off. Land on a strong note, look at the next player and nod.

The diagram shows one chorus of a 12-bar blues. The rhythm part plays continuously. The lead part plays phrases with space between them, a call-and-response pattern you'll recognize from every great blues and rock solo.`,
    });
    D.card(s, {
      x: M, y: CONTENT_TOP + 0.05, w: 5.9, h: 2.85, title: 'When you’re playing rhythm', badge: 'R', badgeRole: 'fifth',
      bullets: ['Lock in with the drummer’s **kick and snare**', '**Play less**: small shapes, short strums, room to breathe', '**Turn down** when someone solos', 'Hold the **form**: you are the map for everyone'], fontSize: 15,
    });
    D.card(s, {
      x: M + 6.23, y: CONTENT_TOP + 0.05, w: 5.9, h: 2.85, title: 'When you’re taking a solo', badge: 'L', badgeRole: 'root',
      bullets: ['**Listen first**: let one chorus go by', 'Play in **phrases**, then leave a gap', '**Build**: low and simple first, big bends last', '**End clearly**, then hand off with a nod'], fontSize: 15,
    });
    // one chorus: rhythm lane vs lead lane
    const ly = 4.85;
    heading(s, 'One 12-bar chorus: the rhythm never stops, the lead leaves space', M, ly, 12.1, HEX.pearl, 14);
    const bx = M + 1.15; const bw = 12.13 - 1.15; const barW = bw / 12;
    for (let b = 0; b < 12; b++) {
      s.addText(String(b + 1), { x: bx + b * barW, y: ly + 0.38, w: barW, h: 0.24, fontSize: 11, color: HEX.muted, align: 'center', margin: 0, isTextBox: true });
    }
    s.addText('Rhythm', { x: M, y: ly + 0.68, w: 1.1, h: 0.42, fontSize: 14, bold: true, color: HEX.white, valign: 'middle', margin: 0, isTextBox: true });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: bx, y: ly + 0.7, w: bw, h: 0.38, rectRadius: 0.06, fill: { color: HEX.fifth }, line: { color: HEX.fifth, width: 0 } });
    s.addText('Lead', { x: M, y: ly + 1.2, w: 1.1, h: 0.42, fontSize: 14, bold: true, color: HEX.white, valign: 'middle', margin: 0, isTextBox: true });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: bx, y: ly + 1.22, w: bw, h: 0.38, rectRadius: 0.06, fill: { color: HEX.card }, line: { color: HEX.card, width: 0 } });
    [[0, 2, 'call'], [4, 6, 'answer'], [8, 11.5, 'resolve']].forEach(([a, b, lab]) => {
      s.addText(lab, { shape: pres.shapes.ROUNDED_RECTANGLE, x: bx + a * barW + 0.04, y: ly + 1.22, w: (b - a) * barW - 0.08, h: 0.38, rectRadius: 0.06, fill: { color: HEX.root }, line: { color: HEX.root, width: 0 }, fontSize: 12, bold: true, color: HEX.white, align: 'center', valign: 'middle', margin: 0 });
    });
    s.addText('space', { x: bx + 2 * barW, y: ly + 1.22, w: 2 * barW, h: 0.38, fontSize: 11, italic: true, color: HEX.muted, align: 'center', valign: 'middle', margin: 0, isTextBox: true });
    s.addText('space', { x: bx + 6 * barW, y: ly + 1.22, w: 2 * barW, h: 0.38, fontSize: 11, italic: true, color: HEX.muted, align: 'center', valign: 'middle', margin: 0, isTextBox: true });
  }

  // 64 · Rhythm toolkit
  {
    const s = D.slideOf(pres, {
      kicker: KICK, title: 'Rhythm toolkit: power chords, chugs, riffs',
      notes: `Rock and metal rhythm guitar is built from three ingredients: power chords, palm muting and riffs.

Power chords. A power chord is just the root and the 5th, often with the root doubled an octave up. Because it has no 3rd it is neither major nor minor, which is exactly why it works with heavy distortion: there's no 3rd to turn to mush. Learn both movable shapes. With the root on the 6th string, the 5th sits on the next string two frets up and the octave on the string after that, also two frets up. With the root on the 5th string, the shape is identical, one string higher. Find the root using the low E and A landmarks from Part 2, and you can play any power chord instantly.

Palm muting (P.M.). Rest the edge of your picking hand lightly on the strings right where they meet the bridge saddles. Too far forward and the note dies to a thud. Too far back and nothing changes. The sweet spot gives a tight, percussive chug. Mute the open-E "chugs" and let the power chords ring. That contrast is the whole sound of the riff.

Picking. Use all downstrokes for steady 8th-note chugs (more aggression, more consistency). Use alternate picking for 16ths. The gallop (one 8th plus two 16ths: down, down-up) is the classic metal rhythm.

Build your own riff: pick a root (E), choose 2–3 power chords from E minor (G5, A5, B5, C5, D5), add a rhythmic hook, play it three times, then change the ending on the fourth time. That "3 + 1" structure is the backbone of countless rock riffs.

The example riff stays in E natural minor: open-E chugs with G5, A5, B5 and E5 on the low strings.`,
    });
    heading(s, 'Power chords: root + 5th (+ octave)', M, CONTENT_TOP, 5.8);
    D.fretboard(s, { x: M, y: CONTENT_TOP + 0.5, w: 2.75, h: 1.55, from: 4, to: 8, root: 'A', dots: [{ s: 6, f: 5, label: 'R', role: 'root' }, { s: 5, f: 7, label: '5', role: 'fifth' }, { s: 4, f: 7, label: 'R', role: 'root' }], title: 'A5 power chord' });
    D.fretboard(s, { x: M + 3.05, y: CONTENT_TOP + 0.5, w: 2.75, h: 1.55, from: 4, to: 8, root: 'D', dots: [{ s: 5, f: 5, label: 'R', role: 'root' }, { s: 4, f: 7, label: '5', role: 'fifth' }, { s: 3, f: 7, label: 'R', role: 'root' }], title: 'D5 power chord' });
    s.addText('A5: root on the 6th string', { x: M, y: CONTENT_TOP + 2.38, w: 2.75, h: 0.28, fontSize: 12, color: HEX.muted, align: 'center', margin: 0, isTextBox: true });
    s.addText('D5: root on the 5th string', { x: M + 3.05, y: CONTENT_TOP + 2.38, w: 2.75, h: 0.28, fontSize: 12, color: HEX.muted, align: 'center', margin: 0, isTextBox: true });
    D.card(s, {
      x: M, y: CONTENT_TOP + 2.9, w: 5.8, h: 2.4, title: 'Palm muting and picking',
      bullets: ['Rest your picking hand’s edge **right at the bridge**', '**Mute the chugs**, let the power chords ring', '**Downstrokes** for 8th-note chugs, alternate for 16ths', '**Gallop** = 8th + two 16ths: down, down-up'], fontSize: 14,
    });
    const rx = M + 6.25; const rw = 12.13 - 6.25;
    heading(s, 'A riff in E: palm-muted chugs + power chords', rx, CONTENT_TOP, rw);
    s.addText('P.M. - - - - - -', { x: rx + 0.4, y: CONTENT_TOP + 0.42, w: 2.2, h: 0.26, fontSize: 12, bold: true, color: HEX.muted, margin: 0, isTextBox: true });
    D.tab(s, {
      x: rx, y: CONTENT_TOP + 0.85, w: rw, gap: 0.24,
      cols: ['6:0', '6:0', '6:0', '6:3 5:5', '6:0', '6:0', '6:5 5:7', '6:5 5:7', '|', '6:0', '6:0', '6:0', '6:7 5:9', '6:5 5:7', '6:3 5:5', '6:0 5:2', '6:0 5:2'],
      counts: ['1', '&', '2', '&', '3', '&', '4', '&', '', '1', '&', '2', '&', '3', '&', '4', '&'],
      check: { root: 'E', scale: T.SCALES.minor },
    });
    D.card(s, {
      x: rx, y: CONTENT_TOP + 2.9, w: rw, h: 2.4, title: 'Build your own riff in 4 steps', badge: '4', badgeRole: 'third',
      bullets: ['Pick a **root**: open E or open A', 'Add **2–3 power chords** from the key: G5, A5, B5, C5, D5', 'Give it a **rhythmic hook**: chugs, gallops, accents', 'Play it **3 times, change the 4th**'], fontSize: 14,
    });
  }

  // 65 · Comping up the neck
  {
    const s = D.slideOf(pres, {
      kicker: KICK, title: 'Comping up the neck with triads',
      notes: `"Comping" (from accompanying) means playing chords behind someone else. Most players comp with big open chords or full barre chords. In a jam with a bass player and another guitarist, that sounds muddy: everyone is fighting over the same low and middle frequencies.

The fix is small shapes high on the neck, the triads on the top three strings from Part 4. A triad has just three notes: root, 3rd and 5th. On the G, B and high e strings each chord takes up a narrow slice of the sound, stays out of the bass player's way, and cuts through clearly.

The second trick is voice leading: choose the triad shapes that sit closest together so your hand barely moves between chords. The three diagrams show A, D and E (I, IV and V in A) all inside frets 4–7:
• A in 1st inversion (3rd on the bottom): C♯ on the G string, E on the B string, A on the high e.
• D in root position: D, F♯, A.
• E in 2nd inversion (5th on the bottom): B, E, G♯.
Notice that A and D share the same note (A, fret 5) on the high e string, and E needs only a small shift. The top notes move smoothly, which sounds musical even with a simple strum.

How to practice: play the tab with one strum per beat, then try muted "chicks" on beats 2 and 4, then funk-style 16th scratches. Next, find the same three chords in another zone (try around frets 9–12) and compare.

Partial chords and double stops are the next step: two notes of a triad (often the 3rd and root) give an even lighter texture, as in a lot of soul and Hendrix-style rhythm playing.`,
    });
    const pick = (root, quality, firstFret) => {
      const v = T.closedTriads(root, T.CHORDS[quality], [3, 2, 1]).find((x) => x.notes[0].f === firstFret);
      if (!v) throw new Error(`No ${root} triad starting at fret ${firstFret}`);
      return v;
    };
    const boards = [
      { root: 'A', numeral: 'I', v: pick('A', 'maj', 6) },
      { root: 'D', numeral: 'IV', v: pick('D', 'maj', 7) },
      { root: 'E', numeral: 'V', v: pick('E', 'maj', 4) },
    ];
    const bw = 3.85; const gapX = (12.13 - bw * 3) / 2;
    boards.forEach((b, i) => {
      const x = M + i * (bw + gapX);
      s.addText([{ text: `${b.root} (${b.numeral})  `, options: { bold: true, color: HEX.white } }, { text: b.v.inversion.toLowerCase(), options: { color: HEX.muted } }], { x, y: CONTENT_TOP, w: bw, h: 0.3, fontSize: 14, margin: 0, isTextBox: true });
      D.fretboard(s, { x, y: CONTENT_TOP + 0.42, w: bw, h: 1.7, from: 3, to: 8, root: b.root, title: `${b.root} triad`, dots: D.dotsFor(b.v.notes, { root: b.root, label: 'interval' }) });
    });
    D.card(s, {
      x: M, y: 4.3, w: 5.6, h: 2.55, title: 'Why small shapes win in a jam',
      bullets: ['They stay **out of the bass player’s range**', 'They **cut through** without getting louder', 'Choose the **closest shapes** so your hand barely moves', 'Try **two-note partials** (3rd + root) for soul and funk'], fontSize: 14,
    });
    const rx = M + 5.95; const rw = 12.13 - 5.95;
    heading(s, 'Comp it: A – D – E – A, one strum per beat', rx, 4.3, rw);
    D.tab(s, {
      x: rx, y: 4.85, w: rw, gap: 0.24,
      cols: ['3:6 2:5 1:5', '3:6 2:5 1:5', '3:6 2:5 1:5', '|', '3:7 2:7 1:5', '3:7 2:7 1:5', '3:7 2:7 1:5', '|', '3:4 2:5 1:4', '3:4 2:5 1:4', '3:4 2:5 1:4', '|', '3:6 2:5 1:5'],
      check: { root: 'A', scale: T.SCALES.major },
    });
  }

  // 66 · Finding the key
  {
    const s = D.slideOf(pres, {
      kicker: KICK, title: 'Finding the key: by ear or by the chords',
      notes: `At a jam someone counts in a song and you have about one chorus to work out where to play. There are two ways to find the key, and you should practice both.

By ear (works with any recording or band):
1. Listen for "home." The home note is the one the music keeps resolving to, the note where a melody would end. Hum it and hold it.
2. Find it on the low E string. While humming, slide up the low E string until the note matches your voice. Use the natural-note landmarks (E open, F 1, G 3, A 5, B 7, C 8, D 10, E 12) to name it. If it falls between landmarks, it's a sharp or flat.
3. Major or minor? Play the root, then the minor 3rd (three frets up), then the major 3rd (four frets up) against the music. One will sound right and the other will clash. Clashing on the minor 3rd but fine on the major 3rd means major. In blues, the minor 3rd often still works as a "blue" note over major chords, so trust the chords.

From the chord list (when someone calls out chords or you can see the guitarist's hands):
1. Find the home chord. It's usually the first or last chord of the progression, and the one that feels like it resolves.
2. Check that the other chords fit that key using the chords-in-a-key pattern from Part 1 (major: I ii iii IV V vi vii°; minor: i ii° ♭III iv v ♭VI ♭VII).
3. Name the progression in numerals. Once you think "i–♭VI–♭VII," you know exactly which scale to grab and where the chord tones are.

The table shows four typical cases, including the A blues, where all three chords are dominant 7ths: that's the blues sound, not a "wrong" key.`,
    });
    D.card(s, {
      x: M, y: CONTENT_TOP + 0.05, w: 5.9, h: 2.75, title: 'By ear', badge: '1', badgeRole: 'root',
      bullets: ['**Hum the home note**: where the music wants to end', '**Slide up the low E** until it matches; name it from the landmarks', '**Major or minor?** Test the ♭3 (3 frets up) vs. the 3 (4 frets up)'], fontSize: 15, paraSpace: 10,
    });
    const nat = [];
    for (let f = 0; f <= 12; f++) { const p = T.pcAt(6, f); if (!T.SHARP[p].includes('♯')) nat.push({ s: 6, f, label: T.SHARP[p], role: 'note' }); }
    D.fretboard(s, { x: M, y: 4.55, w: 5.9, h: 1.6, from: 0, to: 12, dots: nat, title: 'Low E landmarks', dotSize: 0.3 });
    s.addText('Low E landmarks: slide until the note matches your hum', { x: M, y: 6.52, w: 5.9, h: 0.28, fontSize: 12, color: HEX.muted, margin: 0, isTextBox: true });
    const rx = M + 6.23; const rw = 5.9;
    D.card(s, {
      x: rx, y: CONTENT_TOP + 0.05, w: rw, h: 1.95, title: 'From the chords', badge: '2', badgeRole: 'fifth',
      bullets: ['**Home chord** = usually the first or the last', '**Check the rest fit** the key, then name the numerals'], fontSize: 15, paraSpace: 8,
    });
    const ex = [
      ['G major', ['G', 'C', 'D', 'Em'], ['I', 'IV', 'V', 'vi']],
      ['A minor', ['Am', 'F', 'G'], ['i', '♭VI', '♭VII']],
      ['E minor', ['Em', 'G', 'D', 'C'], ['i', '♭III', '♭VII', '♭VI']],
      ['A blues', ['A7', 'D7', 'E7'], ['I7', 'IV7', 'V7']],
    ];
    const rows = [['Chords you hear', 'Key', 'Numerals']];
    for (const [key, chords, nums] of ex) {
      const k = key.split(' ')[0];
      chords.forEach((c, i) => checkNumeral(k, nums[i], c));
      rows.push([chords.join('  '), `**${key}**`, nums.join('  ')]);
    }
    D.table(s, rows, { x: rx, y: CONTENT_TOP + 2.3, w: rw, colW: [2.1, 1.5, 2.3], fontSize: 14, rowH: 0.5 });
  }

  // 67 · 12-bar blues
  {
    const s = D.slideOf(pres, {
      kicker: KICK, title: 'Jam form: the 12-bar blues shuffle',
      notes: `The 12-bar blues is the most common jam form on earth. If someone says "blues in A," this is what they mean.

The form: 12 bars, three chords, all dominant 7ths: I7 (A7), IV7 (D7) and V7 (E7). The colored badges show each chord's root relative to the key, using the same color code as the notes: red for I (the root), gray for IV (the 4th), blue for V (the 5th).
• Bars 1–4: I (or, with the quick change, I–IV–I–I)
• Bars 5–6: IV. Bars 7–8: I.
• Bar 9: V. Bar 10: IV. Bars 11–12: I then V, which is the turnaround that sends you back to bar 1.

The quick change (highlighted bar 2) jumps to the IV chord for one bar early. Many jams use it, so listen for it in the first chorus.

The shuffle riff. This is the rhythm part every blues guitarist must own. Hold the open A string and alternate the D string between fret 2 (E, the 5th) and fret 4 (F♯, the 6th), two hits each. Swing the 8th notes: long-short, long-short, like a triplet with the middle note left out. For D7, move the same shape one string higher (open D with the G string at 2 and 4). For E7, one string lower (open low E with the A string). For extra grit, stretch to fret 5 for the ♭7 on the last beat.

The turnaround (bars 11–12). Hold A on the high e (fret 5) while the B string walks down chromatically G–F♯–F–E, then land on an E7 chord. That descending line tells everyone "the top is coming." It's built on the ♭7, 6, ♭6 and 5 of A.

Practice: loop the whole form with the shuffle, counting bars out loud. Never losing your place in the 12 bars is the most valuable jam skill there is.`,
    });
    heading(s, 'The form: 12 bars, 3 chords (blues in A)', M, CONTENT_TOP, 6.0);
    barGrid(pres, s, {
      x: M, y: CONTENT_TOP + 0.45, w: 6.0, h: 3.0, key: 'A', highlight: [2, 11, 12],
      bars: [['I7', 'A7'], ['IV7', 'D7'], ['I7', 'A7'], ['I7', 'A7'], ['IV7', 'D7'], ['IV7', 'D7'], ['I7', 'A7'], ['I7', 'A7'], ['V7', 'E7'], ['IV7', 'D7'], ['I7', 'A7'], ['V7', 'E7']],
    });
    D.text(s, ['{pearl:Bar 2} quick change: jump to IV7 for one bar.', '{pearl:Bars 11–12} turnaround: a lick that pulls back to bar 1.'], { x: M, y: 5.15, w: 6.0, h: 0.75, fontSize: 14, paraSpace: 4 });
    D.legend(s, { x: M, y: 6.2, roles: ['root', 'other', 'fifth'], names: { root: 'I (root)', other: 'IV (4th)', fifth: 'V (5th)' }, fontSize: 12 });
    const rx = M + 6.45; const rw = 12.13 - 6.45;
    heading(s, 'Shuffle riff on A7 (swing the 8ths)', rx, CONTENT_TOP, rw);
    D.tab(s, {
      x: rx, y: CONTENT_TOP + 0.5, w: rw, gap: 0.24,
      cols: ['5:0 4:2', '5:0 4:2', '5:0 4:4', '5:0 4:4', '5:0 4:2', '5:0 4:2', '5:0 4:4', '5:0 4:5'],
      counts: ['1', '&', '2', '&', '3', '&', '4', '&'],
      check: { root: 'A', scale: T.SCALES.mixolydian },
    });
    D.text(s, 'Same shape for D7 (strings 4–3) and E7 (strings 6–5). Fret 5 on the last beat adds the ♭7.', { x: rx, y: CONTENT_TOP + 2.2, w: rw, h: 0.6, fontSize: 13, color: HEX.muted });
    heading(s, 'Turnaround (bars 11–12)', rx, CONTENT_TOP + 2.95, rw);
    D.tab(s, {
      x: rx, y: CONTENT_TOP + 3.45, w: rw, gap: 0.24,
      cols: ['1:5 2:8', '1:5 2:7', '1:5 2:6', '1:5 2:5', '|', '5:7 4:6 3:7 2:5', '', ''],
      check: { root: 'A', scale: T.SCALES.mixolydian, extra: [8, 11] },
    });
    s.addText('A over G – F♯ – F – E, then E7', { x: rx, y: CONTENT_TOP + 4.85, w: rw, h: 0.28, fontSize: 12, color: HEX.muted, margin: 0, isTextBox: true });
  }

  // 68 · Minor blues
  {
    const s = D.slideOf(pres, {
      kicker: KICK, title: 'Jam form: minor blues and slow jams',
      notes: `The minor blues is the moody cousin of the 12-bar. It's the form behind countless slow, emotional blues and rock jams, and it's where a lot of the most expressive soloing happens.

The form in A minor: i (Am) for four bars, iv (Dm) for two, i for two, then ♭VI7 (F7) to V7 (E7), back to i, and V7 to turn around. Some versions use Dm in bar 2 (a quick change) or play F7 for one bar and E7 for the next, exactly as shown.

What to play: A minor pentatonic works over the whole form, and so does the blues scale. To sound more sophisticated, use the full A natural minor scale, which adds B (the 2nd) and F (the ♭6). The diagram shows A natural minor around box 1, colored by function.

The one note to change: over the E7 (the V chord), the G in A minor clashes with E7's G♯. Switch to G♯, the ring on the diagram. That one-note change is A harmonic minor, and it creates the strong pull back to Am that makes minor blues sound dramatic. Target G♯ over E7 and resolve it up a half step to A when the Am returns.

The F7 is a gift too: F7 contains E♭, the ♭5 blue note of A, so bluesy b5 bends sound great in bar 9.

Slow minor jams: you'll also hear simple loops like Am–Dm–Am–E7 or Am–G–F–E. Same approach: A minor pentatonic or natural minor, G♯ over the E chord.

Phrasing for slow jams: fewer notes, longer notes, wide vibrato, big bends and lots of space. At 60 bpm a single well-bent note can say more than a scale run.`,
    });
    heading(s, 'The form: minor blues in A', M, CONTENT_TOP, 6.0);
    barGrid(pres, s, {
      x: M, y: CONTENT_TOP + 0.45, w: 6.0, h: 3.0, key: 'A', highlight: [9, 10],
      bars: [['i', 'Am'], ['i', 'Am'], ['i', 'Am'], ['i', 'Am'], ['iv', 'Dm'], ['iv', 'Dm'], ['i', 'Am'], ['i', 'Am'], ['♭VI7', 'F7'], ['V7', 'E7'], ['i', 'Am'], ['V7', 'E7']],
    });
    D.card(s, {
      x: M, y: 5.2, w: 6.0, h: 1.65, title: 'Slow minor loops',
      body: '**Am – Dm – Am – E7** or **Am – G – F – E**. Fewer, longer notes; wide vibrato; lots of space.', fontSize: 14,
    });
    const rx = M + 6.45; const rw = 12.13 - 6.45;
    heading(s, 'Solo with A natural minor (G♯ over E7)', rx, CONTENT_TOP, rw);
    const nat = T.positions(T.pcsOf('A', T.SCALES.minor), { from: 4, to: 8 });
    const gs = T.positions([T.pc('G♯')], { from: 4, to: 8 });
    const dots = [...D.dotsFor(nat, { root: 'A', label: 'interval' }), ...D.dotsFor(gs, { root: 'A', label: 'interval', ring: () => true })];
    D.fretboard(s, { x: rx, y: CONTENT_TOP + 0.5, w: rw, h: 2.55, from: 4, to: 8, root: 'A', dots, title: 'A natural minor + G sharp' });
    D.legend(s, { x: rx, y: CONTENT_TOP + 3.5, roles: ['root', 'third', 'fifth', 'seventh'], names: { third: '♭3', fifth: '5', seventh: '♭7 / ring = 7' }, fontSize: 12, gap: 0.2 });
    D.text(s, ['Over **E7**, play {seventh:G♯} (the ring) instead of G: that’s harmonic minor.', 'Over **F7**, bend to the {blue:E♭} blue note.'], { x: rx, y: CONTENT_TOP + 4.0, w: rw, h: 1.2, fontSize: 14, paraSpace: 6 });
  }

  // 69 · Rock progressions
  {
    const s = D.slideOf(pres, {
      kicker: KICK, title: 'Jam form: four rock progressions',
      notes: `Outside the blues, most rock jams use a handful of progressions. Learn them as numerals and you can play them in any key the moment someone calls one out.

1. I–V–vi–IV (A–E–F♯m–D in A). The "anthem" progression behind a huge number of pop-rock songs. It's major and uplifting. Solo with A major pentatonic, which uses the same shapes as F♯ minor pentatonic (three frets below the A minor shape, see Part 5). Aim for the 3rd of each chord: C♯ over A, G♯ over E, A over F♯m, F♯ over D.

2. I–♭VII–IV (A–G–D). The classic-rock sound. The G chord is "borrowed" from A minor, and its G note is the ♭7 of A. That's A Mixolydian. You can solo with A Mixolydian, or mix A major and A minor pentatonic, which is what most classic rock guitarists do instinctively.

3. i–♭VI–♭VII (Em–C–D). The rock and metal minor progression: dark but with a rising, heroic push from ♭VI to ♭VII back to i. Solo with E minor pentatonic for safety, or E natural minor (Aeolian) to add the F♯ and C.

4. i–♭VII–♭VI–V (Am–G–F–E). The descending "Andalusian" progression, heard in flamenco and a lot of rock and metal. Note the final chord is E major, not E minor. Solo with A natural minor, and switch G to G♯ over the E chord (harmonic minor) for that dramatic pull back to Am.

The badge colors follow the color code: each chord's root is colored by its interval from the key. Red marks the home chord, blue the V (5th), purple the ♭VII, and gray the other degrees. Once you see progressions as colors and numbers instead of letter names, transposing becomes automatic.

Practice: loop each progression with triads or power chords on a looper, then solo over it, landing on chord tones on each change.`,
    });
    const PROGS = [
      { name: 'The anthem', key: 'A', label: 'key of A major', nums: ['I', 'V', 'vi', 'IV'], chords: ['A', 'E', 'F♯m', 'D'], solo: 'A major pentatonic; add G♯ (A major scale) over E.' },
      { name: 'Classic rock', key: 'A', label: 'key of A, borrowed ♭VII', nums: ['I', '♭VII', 'IV'], chords: ['A', 'G', 'D'], solo: 'A Mixolydian, or mix A major + minor pentatonic.' },
      { name: 'Rock / metal minor', key: 'E', label: 'key of E minor', nums: ['i', '♭VI', '♭VII'], chords: ['Em', 'C', 'D'], solo: 'E minor pentatonic or E natural minor.' },
      { name: 'Descending minor', key: 'A', label: 'key of A minor', nums: ['i', '♭VII', '♭VI', 'V'], chords: ['Am', 'G', 'F', 'E'], solo: 'A natural minor; G♯ over E (harmonic minor).' },
    ];
    PROGS.forEach((p, i) => {
      const y = CONTENT_TOP + 0.02 + i * 1.32;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y, w: 12.13, h: 1.18, rectRadius: 0.1, fill: { color: HEX.card }, line: { color: HEX.card, width: 0 } });
      s.addText(p.name, { x: M + 0.25, y: y + 0.18, w: 3.2, h: 0.4, fontSize: 17, bold: true, color: HEX.white, margin: 0, isTextBox: true });
      s.addText(`${p.nums.join('–')} · ${p.label}`, { x: M + 0.25, y: y + 0.62, w: 3.3, h: 0.36, fontSize: 13, color: HEX.muted, margin: 0, isTextBox: true });
      p.nums.forEach((n, j) => {
        const role = checkNumeral(p.key, n, p.chords[j]);
        const cx = M + 3.85 + j * 1.15;
        D.badge(s, { x: cx + 0.27, y: y + 0.1, d: 0.52, label: n, role });
        s.addText(p.chords[j], { x: cx, y: y + 0.68, w: 1.06, h: 0.36, fontSize: 15, bold: true, color: HEX.white, align: 'center', margin: 0, isTextBox: true });
      });
      s.addText([{ text: 'Solo with  ', options: { bold: true, color: HEX.pearl } }, { text: p.solo, options: { color: HEX.text } }], { x: M + 8.6, y: y + 0.12, w: 3.35, h: 0.95, fontSize: 14, valign: 'middle', margin: 0, isTextBox: true });
    });
  }

  // 70 · One-chord vamps & metal riffs
  {
    const s = D.slideOf(pres, {
      kicker: KICK, title: 'Jam form: one-chord vamps and metal riffs',
      notes: `Some of the best jams use just one chord, or one riff over a pedal tone. With no chord changes to chase, the whole job is choosing the right scale and then making it interesting with rhythm, dynamics and a "flavor note."

Pick the scale by the chord:
• Am7 groove (funky or Santana-style minor): A Dorian. It's natural minor with a raised 6th (F♯ instead of F). That F♯ is the flavor note, brighter and more soulful.
• A7 groove (blues-rock or funk on a dominant chord): A Mixolydian. It's major with a ♭7 (G). Mix it with A minor pentatonic for grit.
• E5 metal riff with an F in it: E Phrygian. It's natural minor with a ♭2 (F). That half step above the root is the dark, menacing, Spanish-tinged sound of metal.
• E5 rock riff: E minor pentatonic or E natural minor (Aeolian, flavor note C, the ♭6).

The fretboard shows E Phrygian in open position. The teal F (the ♭2) is the note that makes it Phrygian. Lean on it, and resolve it down to E.

Pedal-point riffs. A pedal tone is a note that keeps returning, usually the open low E, while other notes move above or around it. Riff 1 alternates open E with F, G and A on the same string. Keep the open-E notes palm muted and accent the moving notes.

♭2 power chords. Riff 2 moves E5 to F5 (the ♭2) and G5, the classic metal move. Play it with all downstrokes and tight palm muting.

Making a one-chord jam interesting: build intensity over several minutes (soft, then loud), change your register (low, then high), use rhythmic repetition (one phrase repeated with small changes) and lean on the flavor note at important moments.`,
    });
    const vt = [['Vamp', 'Reach for', 'Flavor note'],
      ['Am7 groove', 'A Dorian', '{blue:F♯} (6)'],
      ['A7 groove', 'A Mixolydian', '{blue:G} (♭7)'],
      ['E5 metal riff', 'E Phrygian', '{blue:F} (♭2)'],
      ['E5 rock riff', 'E natural minor', '{blue:C} (♭6)']];
    D.table(s, vt, { x: M, y: CONTENT_TOP + 0.05, w: 5.8, colW: [1.9, 2.1, 1.8], fontSize: 14, rowH: 0.44 });
    heading(s, 'E Phrygian in open position', M, CONTENT_TOP + 2.45, 5.8);
    const ph = T.positions(T.pcsOf('E', T.SCALES.phrygian), { from: 0, to: 5 });
    D.fretboard(s, {
      x: M, y: CONTENT_TOP + 2.9, w: 5.8, h: 2.0, from: 0, to: 5, root: 'E', title: 'E Phrygian',
      dots: D.dotsFor(ph, { root: 'E', label: 'interval', roleOf: (sm) => (sm === 1 ? 'blue' : T.role(sm)) }),
    });
    const rx = M + 6.25; const rw = 12.13 - 6.25;
    heading(s, 'Riff 1: pedal point on open E', rx, CONTENT_TOP, rw);
    D.tab(s, {
      x: rx, y: CONTENT_TOP + 0.5, w: rw, gap: 0.24,
      cols: ['6:0', '6:0', '6:1', '6:0', '6:0', '6:3', '6:0', '6:5', '|', '6:0', '6:0', '6:3', '6:0', '6:1', '6:0', '6:0', '5:2'],
      check: { root: 'E', scale: T.SCALES.phrygian },
    });
    heading(s, 'Riff 2: the ♭2 power chord (E5 – F5 – G5)', rx, CONTENT_TOP + 2.45, rw);
    D.tab(s, {
      x: rx, y: CONTENT_TOP + 2.95, w: rw, gap: 0.24,
      cols: ['6:0 5:2', '6:0 5:2', '6:1 5:3', '6:0 5:2', '|', '6:0 5:2', '6:3 5:5', '6:1 5:3', '6:0 5:2'],
      check: { root: 'E', scale: T.SCALES.phrygian },
    });
    D.text(s, 'Palm-mute the open E, accent the moving notes, all downstrokes.', { x: rx, y: CONTENT_TOP + 4.6, w: rw, h: 0.5, fontSize: 13, color: HEX.muted });
  }

  // 71 · Etiquette & signals
  {
    const s = D.slideOf(pres, {
      kicker: KICK, title: 'Jam etiquette and hand signals',
      notes: `Jams run on unwritten rules. Following them makes people want to play with you again. Breaking them, even with great chops, gets you a reputation.

The basics:
• Tune before you start, quietly, with a clip-on or pedal tuner. Never tune out loud between songs.
• Match the band's volume. The drummer sets the ceiling. If you can't hear the singer or the bass, you're too loud.
• Don't noodle between songs. When someone is talking or counting in, your hands are still.
• Listen more than you play. Leave space, especially when another guitarist is already filling it.
• Take your solo, then give it back. Two choruses is plenty unless the band is clearly egging you on.
• Agree on the key, the form and the feel before the count-in: "Shuffle in A, quick change, two choruses each."

The count-in: whoever starts the song counts "1, 2, 3, 4" in tempo, or counts with the head and hand. Everyone comes in on the next 1.

Hand signals let a band change course without stopping. The table shows the common ones, and conventions vary, so if you're unsure, ask before the song. The most important one is the ending: someone (often the singer or the person who started the song) raises a fist, lifts their guitar neck or kicks a leg near the end of a chorus. That means "this is the last time through." Watch that person in the final bars. Many blues jams end with the turnaround resolving to a final I chord, often with a little ritardando (slowing down) and a big final hit.

Eye contact is the real secret. Look up from your fretboard often. That's one more reason to know the neck well enough that you don't need to stare at it.`,
    });
    D.card(s, {
      x: M, y: CONTENT_TOP + 0.05, w: 5.4, h: 5.25, title: 'The unwritten rules',
      bullets: ['**Tune quietly** before the song, never during', '**Match the drummer’s volume**: if you can’t hear the bass, turn down', '**Don’t noodle** between songs or during the count-in', '**Agree first**: key, form, feel, who solos when', '**Two choruses** is a good solo; then hand it off', '**Look up**: eye contact runs the jam'], fontSize: 15, paraSpace: 10,
    });
    const rx = M + 5.75; const rw = 12.13 - 5.75;
    heading(s, 'Common signals', rx, CONTENT_TOP + 0.05, rw);
    D.table(s, [
      ['Signal', 'Means'],
      ['Fist raised / guitar neck up', '**Last time through**: ending coming'],
      ['Point at a player + nod', '**Your solo**: go'],
      ['Palm down, pressing', '**Bring it down**: softer'],
      ['Palm up, lifting', '**Bring it up**: louder, build'],
      ['Finger circling in the air', '**Go around again**: one more chorus'],
      ['Pat the top of your head', '**Back to the top** (the head)'],
      ['Four fingers up', '**Go to the IV chord**'],
    ], { x: rx, y: CONTENT_TOP + 0.5, w: rw, colW: [2.75, 3.63], fontSize: 14, rowH: 0.52 });
  }

  // 72 · Practice this
  D.practice(pres, {
    kicker: KICK,
    intro: 'You don’t need a band to practice jamming: a looper and backing tracks get you most of the way.',
    drills: [
      { name: 'Shuffle the form', how: 'Loop the **12-bar shuffle in A** with the quick change and the turnaround. Count the bars out loud: “one… two… twelve.”', tempo: '70 → 100 bpm, swung', time: '5 min', done: '3 choruses without losing your place' },
      { name: 'Name that key', how: 'Put on 5 songs you like. **Hum the home note**, find it on the low E, then test ♭3 vs. 3 to pick major or minor.', tempo: 'Song speed', time: '5 min', done: 'Key found in under 60 s per song' },
      { name: 'Looper trade', how: 'Record 4 bars of **triad comping (A–D–E)** or an E riff. Solo over it, then trade: 4 bars lead, 4 bars rhythm.', tempo: '80 bpm', time: '10 min', done: 'Lead and rhythm both feel steady' },
      { name: 'Backing-track gig', how: 'Search “**A minor blues backing track**” or “**E minor rock jam**.” Play one chorus of rhythm, one of lead, repeat.', tempo: 'Track speed', time: '10 min', done: '5 minutes without stopping' },
    ],
    notes: `Four drills turn this part into skills. Do one or two per session and rotate through them during the week.

1. Shuffle the form. Play the shuffle riff through the whole 12-bar form in A, with the quick change in bar 2 and the turnaround in bars 11–12. Count bars out loud as you play. It feels silly, but it's the fastest way to internalize the form. Use a metronome on a swing setting or a simple drum loop. Start around 70 bpm and work up to 100. You're done when you can play three choruses in a row without losing your place.

2. Name that key. Pick five songs you like (any style). For each: hum the home note, find it on the low E string, then test the minor 3rd vs. the major 3rd to decide major or minor. Check your answer by looking the song up afterward. Aim for under a minute per song. After a few weeks you'll do it in seconds.

3. Looper trade. If you have a looper pedal (or a looper app on your phone), record four bars of rhythm: the A–D–E triad comping from this part, or one of the E metal riffs. Solo over it, then alternate: four bars of lead, then switch to rhythm for four bars over a recorded lead, and so on. This trains the skill of switching roles cleanly, exactly what happens in a real jam.

4. Backing-track gig. Search a video site for "A minor blues backing track," "E minor rock jam track" or "A Mixolydian jam track." Pretend it's a gig: one chorus of rhythm, one chorus of lead, and no stopping for mistakes. Five minutes nonstop is the goal.

Record one of these each week and listen back. Pay most attention to timing.`,
  });
}

module.exports = { build };
