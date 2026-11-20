// Part 5 · Soloing (slides 44–61)
const T = require('../lib/theory');
const D = require('../lib/draw');
const { HEX, M, CONTENT_TOP, CONTENT_BOTTOM, section } = require('../lib/deck');

const K = '5 · Soloing';
const FULL_W = 12.13;

// Small bold pearl sub-heading.
function heading(slide, str, x, y, w, opts = {}) {
  slide.addText(D.runs(str, { color: opts.color || HEX.pearl, fontSize: opts.fontSize || 14, bold: true }), {
    x, y, w, h: opts.h || 0.32, margin: 0, valign: 'top', align: opts.align || 'left', isTextBox: true,
  });
}

// Muted caption line.
function caption(slide, str, x, y, w, opts = {}) {
  slide.addText(D.runs(str, { color: HEX.muted, fontSize: opts.fontSize || 12 }), {
    x, y, w, h: opts.h || 0.3, margin: 0, valign: 'top', align: opts.align || 'left', isTextBox: true,
  });
}

// Center x of tab column i (mirrors the layout math inside D.tab).
function tabColX(x, w, nCols, i) {
  const colW = (w - 0.3 - 0.15) / nCols;
  return x + 0.3 + 0.08 + (i + 0.5) * colW;
}

function arrow(pres, slide, x1, y1, x2, y2, color = HEX.pearl, width = 2) {
  D.lineBetween(slide, x1, y1, x2, y2, { color, width, endArrowType: 'triangle' });
}

const minPentA = { root: 'A', scale: T.SCALES.minPent };

function build(pres) {
  section(pres, 'Soloing');

  // 44 · Divider
  D.divider(pres, {
    num: 5,
    title: 'Soloing',
    subtitle: 'Scales give you the notes. Soloing is choosing which notes, when, and how they are played.',
    outcomes: [
      'Solo over a 12-bar blues in A with minor and major pentatonic',
      'Land on chord tones so your lines follow the changes',
      'Phrase with space, motifs and call and response',
      'Bend in tune, add vibrato, and play 10 core licks',
      'Pick the right scale for blues, rock and metal chords',
    ],
    notes: `Part 5: Soloing.

Up to now you've been building a map: where the notes are, how the boxes connect, where the chord tones hide. This part is about turning that map into music.

A scale only tells you which notes are "allowed". It says nothing about which ones to play, in what order, with what rhythm, or how to make each one sing. Two players can use the exact same A minor pentatonic box. One sounds like a practice exercise, the other sounds like a record. The difference is everything in this part.

How the part is organized:
• The four ingredients of a good solo (note choice, rhythm, phrasing, technique).
• Your home base: minor pentatonic and the blues scale, then major pentatonic and how to mix them.
• Target notes: landing on chord tones, and following the chord changes in a 12-bar blues.
• Phrasing, then the techniques that make notes expressive: bends, vibrato, slides, legato and double stops.
• Ten licks: six blues/rock in A and four rock/metal in E.
• The rock and metal scales (natural and harmonic minor), the three modes worth knowing, and a which-scale-over-which-chord table.
• Picking and speed, then how to build your own vocabulary of licks.

Keep a backing track handy (search for "A blues backing track 80 bpm" or "E minor metal backing track"). Every slide in this part should be played, not just read.`,
  });

  // 45 · What makes a solo sound good
  {
    const s = D.slideOf(pres, {
      kicker: K, title: 'What makes a solo sound good',
      notes: `Every memorable solo gets four things right. Most players only practice the first.

1. Note choice: which notes you land on. Chord tones (root, 3rd, 5th, 7th of the chord playing underneath) sound strong and resolved. The other scale notes create tension that wants to resolve. Good soloists choose where the tension goes and where it resolves.

2. Rhythm: where the notes fall in time. This is the most underrated ingredient. Try it: solo over a backing track using ONLY the note A. If you vary the rhythm, add rests, and repeat patterns, it can still groove. Now play a fast run of random notes with no rhythmic shape. It sounds like a scale exercise.

3. Phrasing: sentences, not streams. Phrases with a beginning, a middle, an end and a breath in between. Repetition and variation. Questions and answers.

4. Technique and tone: how each individual note sounds. A note that's bent perfectly in tune with a controlled vibrato says more than ten notes played flat.

The two tabs on this slide use the same A minor pentatonic box. The left one runs straight up the box: correct notes, but no message. The right one uses notes from the same box with a bend, rests, a resolved ending and vibrato. Play both, one after the other, and listen to the difference.

Rest columns in the tab are silences. Let them breathe. Everything that follows in this part trains one of these four ingredients.`,
    });
    const items = [
      ['Note choice', 'Which notes you **land on**. Chord tones sound strong; other notes add tension.'],
      ['Rhythm', 'Where notes fall. Even **one note** can groove with good rhythm.'],
      ['Phrasing', '**Sentences**, not streams. Leave space, repeat ideas, answer yourself.'],
      ['Technique', '**How** each note sounds: bends in tune, vibrato, slides, dynamics.'],
    ];
    const roles = ['root', 'third', 'fifth', 'seventh'];
    const w = (FULL_W - 0.3 * 3) / 4;
    items.forEach(([t, b], i) => {
      D.card(s, { x: M + i * (w + 0.3), y: CONTENT_TOP, w, h: 2.3, title: t, badge: String(i + 1), badgeRole: roles[i], body: b, fontSize: 14 });
    });
    heading(s, 'Scale run: correct, but says nothing', M, 4.15, 5.8);
    D.tab(s, { x: M, y: 4.7, w: 5.8, cols: ['4:5', '4:7', '3:5', '3:7', '2:5', '2:8', '1:5', '1:8'], check: minPentA });
    heading(s, 'Phrase: same box, with a bend, space and vibrato', 6.93, 4.15, 5.8);
    D.tab(s, { x: 6.93, y: 4.7, w: 5.8, cols: ['3:7b9', '', '2:5', '1:5~', '', '2:8', '2:5', '4:7~'], check: minPentA });
    caption(s, 'Both tabs use A minor pentatonic box 1. Play them back to back and listen.', M, 6.38, FULL_W, { fontSize: 13 });
  }

  // 46 · Home base: minor pentatonic + blues ♭5
  {
    const s = D.slideOf(pres, {
      kicker: K, title: 'Home base: minor pentatonic + blue note',
      notes: `A minor pentatonic is the home base for blues and rock soloing: five notes, A C D E G, intervals R ♭3 4 5 ♭7. It has no "wrong" notes over an A blues or an A minor rock progression, which is why it's everyone's first scale.

The blues scale adds one note: the ♭5, also called the blue note. In A it's E♭ (some charts spell it D♯; it's the same pitch). Inside box 1 it sits in two easy places:
• A string, fret 6 (between the D at 5 and the E at 7).
• G string, fret 8 (one fret above the D at 7).

How to use the blue note: it's a passing note, not a destination. Slide or hammer through it on the way to the 4 or the 5 (D or E), or bend the 4 up a half step to touch it. If you stop and hold the ♭5 over the A chord, it sounds unresolved. That's great for a moment of tension, bad as an ending.

The run on the right is the classic blue-note move on the G string: 5-7-8-7-5 (C, D, E♭, D, C), landing on the A at the D string 7th fret. Play it slowly, then with a shuffle feel, then try starting it on different beats.

Practice: improvise over an A blues backing track using box 1. Every 4 bars, drop the blue note in once on the way to the 5 (E). Say "flat five" in your head as you pass it. The goal is to make the ♭5 a color you add on purpose, not an accident.`,
    });
    const box = T.pentBox('A', 1);
    const blue = T.positions(T.pcsOf('A', [6]), { from: 5, to: 8 });
    D.fretboard(s, { x: M, y: 1.95, w: 7.0, h: 3.0, from: 4, to: 9, root: 'A', dots: D.dotsFor([...box, ...blue], { root: 'A', label: 'interval' }) });
    caption(s, 'A minor pentatonic box 1 + the two blue notes (teal) inside it', M + 0.3, 5.4, 6.7);
    const rx = 8.1; const rw = 4.63;
    heading(s, 'Blues scale = minor pentatonic + ♭5', rx, 1.6, rw, { color: HEX.white, fontSize: 16 });
    const labs = [['R', 'root', 'A'], ['♭3', 'third', 'C'], ['4', 'other', 'D'], ['♭5', 'blue', 'E♭'], ['5', 'fifth', 'E'], ['♭7', 'seventh', 'G']];
    labs.forEach(([l, r, n], i) => {
      const bx = rx + i * 0.77;
      D.badge(s, { x: bx, y: 2.1, d: 0.55, label: l, role: r });
      s.addText(n, { x: bx - 0.1, y: 2.72, w: 0.75, h: 0.28, fontSize: 14, color: HEX.muted, align: 'center', margin: 0, isTextBox: true });
    });
    D.text(s, 'The ♭5 (E♭ in A) is a **passing note**: slide or bend through it on the way to the 4 or 5. Don’t park on it.', { x: rx, y: 3.15, w: rw, h: 0.8, fontSize: 14 });
    heading(s, 'Blue-note run on the G string', rx, 4.05, rw);
    D.tab(s, { x: rx, y: 4.5, w: rw, gap: 0.24, cols: ['4:5', '4:7', '3:5', '3:7', '3:8', '3:7', '3:5', '4:7~'], check: { root: 'A', scale: T.SCALES.blues } });
    D.legend(s, { x: M, y: 6.3, roles: ['root', 'third', 'fifth', 'seventh', 'other', 'blue'], names: { root: 'R = A', third: '♭3 = C', fifth: '5 = E', seventh: '♭7 = G', other: '4 = D', blue: '♭5 = E♭' }, fontSize: 12, gap: 0.3 });
  }

  // 47 · Major pentatonic
  {
    const s = D.slideOf(pres, {
      kicker: K, title: 'Major pentatonic: same shape, 3 frets down',
      notes: `Here's one of the most useful shortcuts on the guitar: every major pentatonic scale uses the same shapes as a minor pentatonic, just in a different place.

A major pentatonic is A B C♯ E F♯ (R 2 3 5 6). F♯ minor pentatonic is F♯ A B C♯ E: the same five notes. F♯ is the relative minor of A major (A major and F♯ minor share all their notes). So to play A major pentatonic, play the F♯ minor pentatonic box 1. Its starting fret on the low E string is 2, which is 3 frets below the A at fret 5.

The rule: slide any minor pentatonic box down 3 frets and it becomes the major pentatonic with the same root name. Box 1 of A minor at fret 5 becomes A major pentatonic at fret 2. All five boxes move the same way.

Notice the labels on the right diagram. The red root A is now in a different spot in the shape: the shape is the same, but its job has changed. The root is the 2nd note on the low E string (fret 5), not the first.

Sound and use:
• Minor pentatonic: dark, bluesy, tough. Default for blues and minor-key rock.
• Major pentatonic: sweet, open, "happy". It's the country, southern-rock and classic-rock major-key sound. Use it over A major chords, the A7 (I chord) of a blues, and major-key rock progressions like A–D–E.

Common mistake: playing minor pentatonic's ♭3 (C) and holding it over a major-key, non-blues song. It clashes with the chord's C♯. In a blues that clash is the point; in a happy major-key song it just sounds wrong.

Try it: over an A major backing track (A–D–E), play box 1 at fret 2. Then switch to the minor box at fret 5 and hear the mood change.`,
    });
    D.text(s, '**Rule:** slide any minor pentatonic box **down 3 frets** and it becomes the major pentatonic of the same root.', { x: M, y: CONTENT_TOP, w: FULL_W, h: 0.4, fontSize: 16 });
    const bw = 5.75;
    heading(s, 'A minor pentatonic · box 1 at fret 5', M, 2.1, bw, { color: HEX.white, fontSize: 15 });
    D.fretboard(s, { x: M, y: 2.55, w: bw, h: 2.3, from: 4, to: 9, root: 'A', dots: D.dotsFor(T.pentBox('A', 1), { root: 'A', label: 'interval' }) });
    heading(s, 'A major pentatonic · same shape at fret 2', 6.98, 2.1, bw, { color: HEX.white, fontSize: 15 });
    D.fretboard(s, { x: 6.98, y: 2.55, w: bw, h: 2.3, from: 1, to: 6, root: 'A', dots: D.dotsFor(T.pentBox('F♯', 1), { root: 'A', label: 'interval' }) });
    D.card(s, { x: M, y: 5.4, w: bw, h: 1.42, title: 'Minor: R ♭3 4 5 ♭7', body: 'Dark and bluesy. Default for blues and minor-key rock.', fontSize: 14, titleSize: 16 });
    D.card(s, { x: 6.98, y: 5.4, w: bw, h: 1.42, title: 'Major: R 2 3 5 6', body: 'Sweet and open. Use over A, A7 (the I chord) and major-key rock.', fontSize: 14, titleSize: 16 });
  }

  // 48 · Mixing major & minor pentatonic
  {
    const s = D.slideOf(pres, {
      kicker: K, title: 'Mixing major and minor over a blues',
      notes: `The blues lives between the minor 3rd and the major 3rd.

An A7 chord is A C♯ E G. Its 3rd is C♯ (major). A minor pentatonic gives you C (♭3), a half step lower. Over A7 that C rubs against the chord's C♯. That rub is the sound of the blues, but it sounds best when you move the C toward C♯ rather than sitting on it.

Three ways to do the ♭3 → 3 move:
• Hammer-on: G string fret 5 (C) hammer to fret 6 (C♯). This is the most common blues move on the guitar.
• Curl: on the high e string fret 8 (C), bend slightly, about a quarter to a half step, toward C♯. Tab writes it here as 8b9.
• Slide: from C to C♯ on any string.

Then resolve: after the C♯, go to the root (A at the D string 7th fret) or the 5th (E).

Why mixing works on the other chords too:
• Over D7 (D F♯ A C), the minor pentatonic's C is D7's own ♭7. It fits perfectly, so plain minor pentatonic sounds great over the IV chord.
• Over E7 (E G♯ B D), go back to minor pentatonic. The G rubs against G♯ in the same bluesy way; bend G toward G♯ for extra effect.

The ringed amber dots on the diagram are the C♯s you can grab from box 1: A string 4, G string 6, and frets 9 on both E strings.

Practice: over an A blues, play box 1 normally. Every time the band is on A7, hit the 5h6 move on the G string and resolve to A. Over D7, emphasize the C. You're now soloing with the chords instead of just over them.`,
    });
    const box = T.pentBox('A', 1);
    const csharp = T.positions(T.pcsOf('A', [4]), { from: 4, to: 9 });
    D.fretboard(s, { x: M, y: 1.95, w: 7.2, h: 3.3, from: 4, to: 9, root: 'A', dots: D.dotsFor([...box, ...csharp], { root: 'A', label: 'interval', ring: (p, st) => st === 4 }) });
    caption(s, 'Ringed amber = the major 3rd (C♯) added to minor pentatonic box 1', M + 0.3, 5.65, 6.9);
    D.legend(s, { x: M + 0.3, y: 6.15, roles: ['root', 'third', 'fifth', 'seventh', 'other'], names: { root: 'R', third: '♭3 / 3', fifth: '5', seventh: '♭7', other: '4' }, fontSize: 12 });
    const rx = 8.2; const rw = 4.53;
    D.card(s, {
      x: rx, y: CONTENT_TOP, w: rw, h: 2.6, title: 'Why it works',
      bullets: [
        'A7 contains **C♯**. Minor pentatonic gives you **C**. Moving C → C♯ is the blues sound.',
        'Over **D7**, C is D7’s own ♭7: plain minor pentatonic fits.',
        'Over **E7**, back to minor pentatonic.',
      ],
      fontSize: 14,
    });
    heading(s, 'The ♭3 → 3 move, then the curl', rx, 4.45, rw);
    D.tab(s, { x: rx, y: 4.9, w: rw, gap: 0.25, cols: ['3:5h6', '4:7', '', '1:8b9', '1:5', '2:5', '3:6', '4:7~'], check: { root: 'A', scale: T.SCALES.minPent, extra: [4] } });
  }

  // 49 · Target notes
  {
    const s = D.slideOf(pres, {
      kicker: K, title: 'Target notes: land on chord tones',
      notes: `Target notes are the biggest step from "running the box" to sounding like you know what you're doing.

The idea: at any moment there's a chord playing. Its chord tones (root, 3rd, 5th, and 7th if it has one) are the notes that sound most "right" against it. Other notes in the scale sound good while you're moving, but they create tension. So aim your phrases at chord tones, and land on them at the moments the ear pays most attention to:
• Strong beats: beats 1 and 3 of the bar.
• The end of a phrase: the last note you hold.
• The moment the chord changes.

The diagram shows box 1 with only the A minor chord tones (A, C, E) at full size. The small gray dots are the passing notes: D (4) and G (♭7). Notice how many chord tones there are: one or two on every string. You're never more than a fret or two away from a safe landing.

The tab is a one-bar line where beats 1, 2, 3 and 4 land on A, E, C and G. Beats 1 and 3, the strongest, land on the root and the ♭3. The other notes mix chord tones (A, E) with passing notes (G, D). Play it slowly while counting "1 & 2 & 3 & 4 &" out loud.

The rule isn't "only play chord tones". That's boring. It's: tension is fine on weak beats and in the middle of phrases, resolution happens on strong beats and at the ends.

Practice: over an A minor vamp, improvise freely but make every phrase END on a red, amber or blue dot. Then try to have one of those land on beat 1 of every bar.`,
    });
    const box = T.pentBox('A', 1);
    D.fretboard(s, {
      x: M, y: 1.85, w: 6.6, h: 2.5, from: 4, to: 9, root: 'A',
      dots: D.dotsFor(box, { root: 'A', label: 'interval', roleOf: (st) => ([0, 3, 7].includes(st) ? T.role(st) : 'other'), small: (p, st) => ![0, 3, 7].includes(st) }),
    });
    caption(s, 'Am chord tones (R ♭3 5) inside box 1. Small gray = passing notes.', M + 0.3, 4.7, 6.3);
    heading(s, 'Chord tones on the strong beats (1 and 3)', M, 5.05, 6.6);
    D.tab(s, { x: M, y: 5.45, w: 6.6, gap: 0.2, cols: ['1:5', '2:8', '2:5', '3:7', '3:5', '4:7', '4:5', '5:7'], counts: ['1', '&', '2', '&', '3', '&', '4', '&'], check: minPentA });
    const rx = 7.6; const rw = 5.13; const h = 1.6; const g = 0.25;
    const tips = [
      ['Know the chord tones', 'For any chord, find its R, 3 and 5 (and 7) inside the box you’re in.', 'root'],
      ['Land them on strong beats', 'Beats 1 and 3 and the last note of a phrase: that’s what the ear checks.', 'third'],
      ['Pass through the rest', '2nds, 4ths, 6ths and the blue note add tension. The target releases it.', 'fifth'],
    ];
    tips.forEach(([t, b, r], i) => D.card(s, { x: rx, y: CONTENT_TOP + i * (h + g), w: rw, h, title: t, badge: String(i + 1), badgeRole: r, body: b, fontSize: 14 }));
  }

  // 50 · Following the changes (12-bar in A)
  {
    const s = D.slideOf(pres, {
      kicker: K, title: 'Following the changes in a 12-bar',
      notes: `A 12-bar blues in A uses three chords: A7 (I), D7 (IV) and E7 (V). The grid shows the standard form, one cell per bar. (In the "quick change" version, bar 2 is D7 instead of A7.)

If you play A minor pentatonic over all of it, it works, but you sound like you're ignoring the band. Players who sound like they're "following the changes" aim for the 3rd of each chord as it arrives:
• A7: A C♯ E G → 3rd = C♯
• D7: D F♯ A C → 3rd = F♯
• E7: E G♯ B D → 3rd = G♯

The 3rd is the note that defines each chord, so landing on it on beat 1 of a chord change makes the change audible in your solo.

Where they are near box 1 (frets 4–9), shown on the diagram:
• C♯: A string 4, G string 6, and fret 9 on both E strings.
• F♯: D string 4, B string 7, A string 9.
• G♯: low E 4, D string 6, high e 4, B string 9.

Guide-tone trick: the 3rds and 7ths of neighboring chords are often a half step apart. A7's ♭7 (G) moves down a half step to D7's 3rd (F♯). A7's 3rd (C♯) moves down a half step to D7's ♭7 (C). Going from A7 to E7, G moves up to G♯. Lines built on these tiny moves sound sophisticated with almost no effort.

Practice: put on a 12-bar shuffle in A. First chorus: play only the target 3rd on beat 1 of each new chord, then rest. Second chorus: approach each target from a fret below (slide or hammer-on). Third chorus: improvise with box 1, but still hit each 3rd on the change.`,
    });
    const bars = ['A7', 'A7', 'A7', 'A7', 'D7', 'D7', 'A7', 'A7', 'E7', 'D7', 'A7', 'E7'];
    const third = { A7: 'C♯', D7: 'F♯', E7: 'G♯' };
    const gx = M; const gw = 6.8; const gapB = 0.12; const bw = (gw - gapB * 3) / 4; const bh = 1.1;
    bars.forEach((c, i) => {
      const x = gx + (i % 4) * (bw + gapB); const y = 1.65 + Math.floor(i / 4) * (bh + 0.15);
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: bw, h: bh, rectRadius: 0.08, fill: { color: HEX.card }, line: { color: HEX.card, width: 0 } });
      s.addText(String(i + 1), { x: x + 0.1, y: y + 0.07, w: 0.4, h: 0.22, fontSize: 11, color: HEX.faint, margin: 0, isTextBox: true });
      s.addText(c, { x, y: y + 0.2, w: bw, h: 0.45, fontSize: 20, bold: true, color: HEX.white, align: 'center', valign: 'middle', margin: 0, isTextBox: true });
      s.addText([{ text: '3rd ', options: { color: HEX.muted, fontSize: 13 } }, { text: third[c], options: { color: HEX.third, fontSize: 16, bold: true } }], { x, y: y + 0.65, w: bw, h: 0.33, align: 'center', valign: 'middle', margin: 0, isTextBox: true });
    });
    caption(s, 'Standard 12-bar in A. Quick-change version: bar 2 is D7.', gx, 5.45, gw, { fontSize: 13 });
    // target 3rds near box 1
    const dots = [];
    for (const [c, n] of Object.entries(third)) {
      for (const p of T.positions([T.pc(n)], { from: 4, to: 9 })) dots.push({ s: p.s, f: p.f, label: n, role: 'third', noRoleCheck: true });
      void c;
    }
    const rx = 7.85; const rw = 4.88;
    heading(s, 'The three target 3rds near box 1', rx, 1.6, rw);
    D.fretboard(s, { x: rx, y: 2.05, w: rw, h: 2.5, from: 4, to: 9, root: 'A', dots });
    s.addText([
      { text: 'A7 → ', options: { color: HEX.text } }, { text: 'C♯', options: { color: HEX.third, bold: true } },
      { text: '     D7 → ', options: { color: HEX.text } }, { text: 'F♯', options: { color: HEX.third, bold: true } },
      { text: '     E7 → ', options: { color: HEX.text } }, { text: 'G♯', options: { color: HEX.third, bold: true } },
    ], { x: rx, y: 4.95, w: rw, h: 0.35, fontSize: 16, align: 'center', margin: 0, isTextBox: true });
    D.card(s, { x: rx, y: 5.45, w: rw, h: 1.38, body: 'Aim a phrase at the new chord’s 3rd **on beat 1 of the change**. The band moves; your solo should move with it.', fontSize: 14 });
  }

  // 51 · Phrasing
  {
    const s = D.slideOf(pres, {
      kicker: K, title: 'Phrasing: play sentences, not streams',
      notes: `Phrasing is how you group notes into ideas. Think of a solo as talking: words grouped into sentences, sentences separated by breaths, ideas repeated and developed.

1. Leave space. Silence is part of the solo. Rests let the listener digest what you just played and let the band be heard. A simple test: if you couldn't sing the phrase in one breath, it's probably too long. Try deliberately resting for a full bar between phrases.

2. Call and response. Play a short phrase (the call), rest, then answer it with a related phrase that ends somewhere different, often more resolved. Blues is built on this: singer, then guitar answer.

3. Motifs. A motif is a short idea of 3 to 5 notes with a recognizable rhythm. Listeners remember motifs, not scales. A good solo can be built from one or two motifs.

4. Repeat, then vary. Play the motif, play it again exactly (repetition makes it a hook), then vary it: change the rhythm, change the last note, bend one note, move it to a different string set or box, or start it on a different beat.

The tab shows exactly this: a three-note motif (G, E, D), repeated, then varied by bending the first note up to A and extending the ending down to the root with vibrato. The empty columns are rests. Respect them.

Practice: set a timer for 3 minutes over an A minor or A blues backing track. Rule: every phrase must be followed by a rest at least as long as the phrase. Then try a chorus built from a single motif, varying it each time.`,
    });
    const items = [
      ['Leave space', 'Rests are part of the solo. Can’t sing it in one breath? Too long.'],
      ['Call & answer', 'Play a short call, rest, then answer it with a phrase that ends elsewhere.'],
      ['Motifs', 'Build from a 3–5 note idea. Listeners remember ideas, not scales.'],
      ['Repeat + vary', 'Play it twice, then change its rhythm, last note or position.'],
    ];
    const roles = ['root', 'third', 'fifth', 'seventh'];
    const w = (FULL_W - 0.3 * 3) / 4;
    items.forEach(([t, b], i) => D.card(s, { x: M + i * (w + 0.3), y: CONTENT_TOP, w, h: 2.3, title: t, badge: String(i + 1), badgeRole: roles[i], body: b, fontSize: 14 }));
    heading(s, 'Motif → repeat → vary (A minor pentatonic)', M, 4.1, FULL_W);
    const cols = ['2:8', '2:5', '3:7', '', '|', '2:8', '2:5', '3:7', '', '|', '2:8b10', '2:8', '2:5', '3:7', '4:7~'];
    const tx = M; const tw = FULL_W; const ty = 5.0;
    const segs = [['Motif', 0, 3], ['Repeat', 5, 8], ['Vary', 10, 14]];
    segs.forEach(([l, a, b]) => {
      const x1 = tabColX(tx, tw, cols.length, a) - 0.2; const x2 = tabColX(tx, tw, cols.length, b) + 0.2;
      s.addText(l, { x: x1, y: 4.55, w: x2 - x1, h: 0.28, fontSize: 13, bold: true, color: HEX.muted, align: 'center', margin: 0, isTextBox: true });
    });
    D.tab(s, { x: tx, y: ty, w: tw, gap: 0.26, cols, check: minPentA });
  }

  // 52 · Bends
  {
    const s = D.slideOf(pres, {
      kicker: K, title: 'Bends: the voice of rock and blues guitar',
      notes: `Bending is pushing the string sideways to raise its pitch. It's the most vocal technique on the guitar, and the most common source of sour notes. An out-of-tune bend sounds worse than no bend.

The four bends to master (all shown starting from the D at the G string 7th fret, inside box 1):
• Half-step bend (7b8): raise the pitch by one fret's worth, D → E♭. A great way to touch the blue note.
• Whole-step bend (7b9): raise by two frets, D → E. The workhorse of rock and blues. In box 1 the most common bends are G string 7 (D → E), B string 8 (G → A) and high e 8 (C → D).
• Pre-bend and release (7pb9 r7): bend the string up silently, pick it already bent, then let it fall back down. It sounds like a sigh or a cry.
• Unison bend: fret the E on the B string (fret 5) and bend the D on the G string (fret 7) up to match it. Pick both together. When they're in tune, the wobble (beating) between them disappears.

Check your pitch: before bending, play the target fret (fret 9 for a whole step from 7) and listen. Then bend fret 7 until it matches. The diagram shows this: the ringed note at fret 9 is where the bend must land, and the E on the B string is the unison partner.

Technique:
• Use three fingers on the string: the ring finger bends while the middle and index push behind it.
• The power comes from rotating your wrist (like turning a doorknob), not from pushing with the finger.
• On G, B and high e, push toward the ceiling. On the low strings, pull toward the floor.

Practice: 2 minutes a day of whole-step bends against the target note, then unison bends. Record yourself once a week and listen for flat bends.`,
    });
    const cards = [
      ['Half step', '7b8', 'One fret up: D → E♭, the blue note.', 0.25, 'up'],
      ['Whole step', '7b9', 'Two frets up: D → E. The workhorse.', 0.5, 'up'],
      ['Pre-bend & release', '7pb9 r7', 'Bend silently, pick, let it fall: E → D.', 0.5, 'down'],
      ['Unison bend', '7b9 + 5', 'Bend G-string D up to match B-string E.', 0.5, 'unison'],
    ];
    const w = (FULL_W - 0.3 * 3) / 4; const ch = 2.25;
    cards.forEach(([t, tok, b, hgt, kind], i) => {
      const x = M + i * (w + 0.3); const y = CONTENT_TOP;
      D.card(s, { x, y, w, h: ch, title: t });
      s.addText(tok, { x: x + 0.22, y: y + 0.68, w: w - 1.1, h: 0.5, fontSize: 24, bold: true, color: HEX.pearl, margin: 0, valign: 'middle', isTextBox: true });
      const ax = x + w - 0.7; const base = y + 1.15;
      if (kind === 'up') arrow(pres, s, ax, base, ax + 0.3, base - hgt, HEX.third);
      if (kind === 'down') { arrow(pres, s, ax, base - 0.5, ax + 0.3, base - 0.5, HEX.third); arrow(pres, s, ax + 0.3, base - 0.5, ax + 0.45, base, HEX.fifth); }
      if (kind === 'unison') { arrow(pres, s, ax, base, ax + 0.3, base - 0.5, HEX.third); s.addShape(pres.shapes.LINE, { x: ax - 0.05, y: base - 0.5, w: 0.5, h: 0, line: { color: HEX.fifth, width: 2, dashType: 'dash' } }); }
      D.text(s, b, { x: x + 0.22, y: y + 1.35, w: w - 0.44, h: 0.75, fontSize: 14 });
    });
    caption(s, 'Check your pitch: a whole-step bend from fret 7 must match fret 9', M, 4.0, 6.2, { fontSize: 13 });
    D.fretboard(s, {
      x: M, y: 4.4, w: 5.9, h: 2.0, from: 5, to: 10, root: 'A',
      dots: [
        { s: 3, f: 7, label: 'D', role: 'other' },
        { s: 3, f: 9, label: 'E', role: 'fifth', ring: true },
        { s: 2, f: 5, label: 'E', role: 'fifth' },
      ],
      links: [{ a: { s: 3, f: 7 }, b: { s: 3, f: 9 }, dash: 'dash', color: HEX.third }],
    });
    D.card(s, {
      x: 6.9, y: 4.0, w: 5.83, h: 2.85, title: 'How to bend in tune',
      bullets: [
        'Bend with **three fingers**: ring bends, middle and index help.',
        '**Rotate the wrist**, like turning a doorknob.',
        'G, B, e: push up. Low strings: pull down.',
        '**Play the target fret first**, then bend to match it.',
      ],
      fontSize: 14,
    });
  }

  // 53 · Vibrato, slides, legato, double stops
  {
    const s = D.slideOf(pres, {
      kicker: K, title: 'Vibrato, slides, legato, double stops',
      notes: `Five techniques that make notes expressive. Each mini-tab uses A minor pentatonic box 1.

Vibrato (~): a controlled, repeated wobble in pitch. On guitar it's a series of tiny bends and releases, driven by the wrist, not the finger. The pitch should go slightly up from the note and come back, never below it. Match the speed to the music: wide and slow for slow blues, faster and narrower for rock. Vibrato on the last note of a phrase is the single fastest way to sound more professional.

Slides (/ and \\): pick once, keep pressing, and glide to the new fret. Slide into target notes from a fret or two below for a vocal approach. Keep the pressure even or the note dies mid-slide.

Hammer-ons (h): pick the first note, then bring the next finger down hard and fast, right behind the fret, so the second note sounds without picking.

Pull-offs (p): fret both notes. Pick the higher one, then pull the top finger slightly down and off the string (a little flick) so it plucks the lower note. Hammer-ons and pull-offs together are called legato: smooth, fast, less picking.

Double stops: two notes played together, usually on adjacent strings. Classic rock-and-roll, blues-rock and Southern rock fills. In box 1, the B and high e strings at frets 8 and 5 are the easiest pairs. Mute the strings you aren't playing.

Practice: one technique per day for a week, 3 minutes each, at a slow tempo. Then improvise over a backing track and make yourself use all five in one chorus.`,
    });
    const techs = [
      ['Vibrato', ['3:7~', '', '2:8~'], 'Wobble slightly above the note and back, from the wrist. Slow and wide for blues, faster for rock.'],
      ['Slides', ['3:5/7', '', '3:7\\5'], 'Pick once, keep pressing, glide to the new fret. Slide into targets from below.'],
      ['Hammer-ons', ['3:5h7', '', '2:5h8'], 'Pick the first note, then bring the next finger down hard to sound the second.'],
      ['Pull-offs', ['1:8p5', '', '2:8p5'], 'Fret both notes, pick the higher one, then flick the top finger off the string.'],
      ['Double stops', ['2:8 1:8', '2:5 1:5', '3:7 2:8'], 'Two notes at once on adjacent strings. Rock-and-roll fills live here.'],
    ];
    const gap = 0.25; const w = (FULL_W - gap * 4) / 5; const h = CONTENT_BOTTOM - CONTENT_TOP - 0.05;
    techs.forEach(([t, cols, b], i) => {
      const x = M + i * (w + gap); const y = CONTENT_TOP;
      D.card(s, { x, y, w, h, title: t, titleSize: 16 });
      D.tab(s, { x: x + 0.12, y: y + 0.9, w: w - 0.24, gap: 0.3, cols, bg: HEX.card, fontSize: 13, check: minPentA });
      D.text(s, b, { x: x + 0.2, y: y + 2.75, w: w - 0.4, h: h - 2.95, fontSize: 16 });
    });
  }

  // 54 · Essential blues & rock licks
  {
    const s = D.slideOf(pres, {
      kicker: K, title: 'Six essential blues and rock licks in A',
      notes: `Six building-block licks, all inside or next to A minor pentatonic box 1 (frets 5–8). They're generic vocabulary used by countless blues and rock players, not quotes from specific songs.

1. Bend and resolve: whole-step bend on the G string (D → E), release, then step down to C and land on the root A with vibrato.
2. B-string bend and answer: bend G up to A on the B string, then a descending answer that resolves to the root.
3. Blue-note run: up the D and G strings through the ♭5 (E♭ at G string fret 8) and back, ending on A.
4. Repeating pull-off triplet: high e 8 pull-off to 5, then B string 8, repeated. Play it as triplets (three notes per beat) and it becomes a classic rock-and-roll burst. Start slowly.
5. Double-stop fill: pairs on the top two strings, then a D/G pair, landing on A. Let the double stops ring.
6. ♭3 → 3 hook: hammer C to C♯ on the G string, resolve to A, repeat, then walk down the A string (E, C♯) to the root on the low E.

How to learn a lick properly:
• Learn it slowly with a metronome until it's clean.
• Play it over a backing track at the right moment: licks 1, 2 and 6 are great openers over A7; lick 4 is a high-energy climax; lick 3 works as a turnaround.
• Change it (rhythm, ending, starting beat) so it becomes yours. Slide 60 shows how.
• Move it: find the same lick in box 2 or an octave higher.

One new lick per week, used in real improvising, beats learning twenty licks you never use.`,
    });
    const licks = [
      ['Bend and resolve', ['3:7b9', '3:7b9r7', '3:5', '4:7', '', '4:7~'], minPentA],
      ['B-string bend, then answer', ['2:8b10', '1:5', '2:8', '2:5', '3:7', '3:5', '4:7~'], minPentA],
      ['The blue-note run', ['4:5', '4:7', '3:5', '3:7', '3:8', '3:7', '3:5', '4:7'], { root: 'A', scale: T.SCALES.blues }],
      ['Repeating pull-off triplet', ['1:8p5', '2:8', '1:8p5', '2:8', '1:8p5', '2:8'], minPentA],
      ['Double-stop fill', ['2:8 1:8', '2:8 1:8', '2:5 1:5', '', '3:7 2:8', '3:5 2:5', '4:7~'], minPentA],
      ['♭3 → 3 hook, down to the root', ['3:5h6', '4:7', '3:5h6', '4:7', '5:7', '5:4', '6:5~'], { root: 'A', scale: T.SCALES.minPent, extra: [4] }],
    ];
    const roles = ['root', 'third', 'fifth', 'seventh', 'blue', 'root'];
    const bw = 5.8; const xs = [M, 6.93]; const ys = [1.55, 3.3, 5.05];
    licks.forEach(([t, cols, check], i) => {
      const x = xs[i % 2]; const y = ys[Math.floor(i / 2)];
      D.badge(s, { x, y, d: 0.32, label: String(i + 1), role: roles[i], fontSize: 13 });
      heading(s, t, x + 0.45, y + 0.02, bw - 0.45, { color: HEX.white, fontSize: 15 });
      D.tab(s, { x, y: y + 0.55, w: bw, gap: 0.2, cols, fontSize: 12, check });
    });
  }

  // 55 · Rock & metal licks
  {
    const s = D.slideOf(pres, {
      kicker: K, title: 'Four rock and metal licks in E',
      notes: `Rock and metal often sit in E minor, because the open low E string is the lowest, heaviest note on the guitar. These four licks cover the core sounds.

1. Pedal point (E natural minor): keep returning to one note (E at the high e string 12th fret) while the other notes step down the scale (D, C, B, C). Pedal-point lines are everywhere in hard rock and metal. Use strict alternate picking and keep the pedal note consistent in volume.

2. Phrygian chug: palm-mute the open low E and add F (fret 1) and G (fret 3). The F is E Phrygian's ♭2, a half step above the root, and it's the darkest, most "metal" interval there is. Keep the palm mute tight and the rhythm locked to the metronome; the notes are easy, the precision is the skill.

3. 3-notes-per-string run (E natural minor): three notes on the B string (G A B), three on the high e (C D E), then back down. Three notes per string makes the picking pattern even and repeatable, which is why it's the basis of fast rock and metal runs. Start at 60 bpm in 16th notes.

4. Harmonic-minor resolution (E harmonic minor): over a B or B7 chord, the D♯ (B string fret 4) is the leading tone, a half step below E. B, C, B, G, E, D♯, E: the D♯ pulls hard back to the root. This is the "neoclassical" sound.

For all four: palm muting and alternate picking matter as much as the notes. Practice with a metronome, and only raise the tempo after three clean passes.`,
    });
    const licks = [
      ['Pedal point', 'Return to E between moving notes. Alternate pick.', ['1:12', '1:10', '1:12', '1:8', '1:12', '1:7', '1:12', '1:8'], { root: 'E', scale: T.SCALES.minor }],
      ['Phrygian chug', 'Palm-mute the open E. The F (♭2) is instant darkness.', ['6:0', '6:0', '6:1', '6:0', '6:0', '6:3', '6:0', '6:1'], { root: 'E', scale: T.SCALES.phrygian }],
      ['3-notes-per-string run', 'Up and back, strict alternate picking. Start at 60 bpm.', ['2:8', '2:10', '2:12', '1:8', '1:10', '1:12', '1:10', '1:8', '2:12', '2:10', '2:8'], { root: 'E', scale: T.SCALES.minor }],
      ['Harmonic-minor resolution', 'Over B or B7: D♯ (B string fret 4) pulls back to E.', ['1:7', '1:8', '1:7', '2:8', '2:5', '2:4', '2:5~'], { root: 'E', scale: T.SCALES.harmMinor }],
    ];
    const roles = ['root', 'blue', 'fifth', 'seventh'];
    const bw = 5.8; const xs = [M, 6.93]; const ys = [1.55, 4.3];
    licks.forEach(([t, c, cols, check], i) => {
      const x = xs[i % 2]; const y = ys[Math.floor(i / 2)];
      D.badge(s, { x, y, d: 0.32, label: String(i + 1), role: roles[i], fontSize: 13 });
      heading(s, t, x + 0.45, y + 0.02, bw - 0.45, { color: HEX.white, fontSize: 15 });
      caption(s, c, x + 0.45, y + 0.38, bw - 0.45, { fontSize: 13 });
      D.tab(s, { x, y: y + 0.95, w: bw, gap: 0.25, cols, fontSize: 13, check });
    });
  }

  // 56 · Natural & harmonic minor
  {
    const s = D.slideOf(pres, {
      kicker: K, title: 'Natural and harmonic minor',
      notes: `Minor pentatonic is five notes. The full natural minor scale (also called Aeolian) adds the 2 and the ♭6: R 2 ♭3 4 5 ♭6 ♭7. In E: E F♯ G A B C D. It's the default sound of minor-key rock and metal: darker and more melodic than pentatonic, because the ♭6 (C) adds a sad, heavy color.

Both diagrams show the scale in open position (frets 0–4), where a lot of E-minor rock and metal lives. Open strings count: the open low E, A, D, G, B and high e are all notes of E natural minor. In harmonic minor, open D becomes D♯ (D string fret 1).

Harmonic minor changes one note: the ♭7 is raised to a natural 7. In E, D becomes D♯: R 2 ♭3 4 5 ♭6 7. On the diagram it's the teal dot (D string fret 1 and B string fret 4).

Why it exists: in E minor, the chord built on the 5th degree is Bm (B D F♯). It's a weak pull back home. Raise D to D♯ and that chord becomes B major or B7 (B D♯ F♯ A), whose D♯ is a half step below E. That half-step pull is the strongest "resolve to home" in music. Many minor-key songs borrow that B or B7 chord.

So the practical rule:
• Over Em, C, D, Am (the normal chords of E minor): natural minor (or minor pentatonic).
• Over B or B7: harmonic minor, which gives you the D♯ that matches the chord.

The gap between ♭6 (C) and 7 (D♯) is three frets, the exotic, "Middle Eastern" or "neoclassical" sound of harmonic minor. Play C → D♯ → E slowly and you'll hear it immediately.

Practice: loop Em – C – D – B7. Play natural minor for the first three chords and switch to D♯ on B7, resolving to E as the loop comes back around.`,
    });
    const bw = 5.85;
    const nat = T.positions(T.pcsOf('E', T.SCALES.minor), { from: 0, to: 4 });
    const harm = T.positions(T.pcsOf('E', T.SCALES.harmMinor), { from: 0, to: 4 });
    heading(s, 'E natural minor (Aeolian)', M, 1.6, bw, { color: HEX.white, fontSize: 16 });
    caption(s, 'R  2  ♭3  4  5  ♭6  ♭7   =   E  F♯  G  A  B  C  D', M, 1.95, bw, { fontSize: 14 });
    D.fretboard(s, { x: M, y: 2.4, w: bw, h: 2.3, from: 0, to: 4, root: 'E', dots: D.dotsFor(nat, { root: 'E', label: 'interval' }) });
    heading(s, 'E harmonic minor: raise the 7th', 6.88, 1.6, bw, { color: HEX.white, fontSize: 16 });
    caption(s, 'R  2  ♭3  4  5  ♭6  7   =   E  F♯  G  A  B  C  D♯', 6.88, 1.95, bw, { fontSize: 14 });
    D.fretboard(s, { x: 6.88, y: 2.4, w: bw, h: 2.3, from: 0, to: 4, root: 'E', dots: D.dotsFor(harm, { root: 'E', label: 'interval', roleOf: (st) => (st === 11 ? 'blue' : T.role(st)) }) });
    D.text(s, '**Why it exists:** in E minor the v chord is Bm. Raising D to **D♯** makes it B or B7, which pulls hard back to Em.', { x: M, y: 5.3, w: 3.5, h: 1.5, fontSize: 14 });
    const prog = [['Em', 'natural minor', HEX.text], ['C', 'natural minor', HEX.text], ['D', 'natural minor', HEX.text], ['B7', 'harmonic minor', HEX.blue]];
    const px = 4.4; const pw = (12.73 - px - 0.2 * 3) / 4;
    prog.forEach(([c, sc, col], i) => {
      const x = px + i * (pw + 0.2);
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 5.3, w: pw, h: 1.35, rectRadius: 0.08, fill: { color: HEX.card }, line: { color: i === 3 ? HEX.blue : HEX.card, width: i === 3 ? 1.5 : 0 } });
      s.addText(c, { x, y: 5.4, w: pw, h: 0.55, fontSize: 24, bold: true, color: HEX.white, align: 'center', valign: 'middle', margin: 0, isTextBox: true });
      s.addText(sc, { x, y: 6.0, w: pw, h: 0.4, fontSize: 14, bold: i === 3, color: col, align: 'center', valign: 'middle', margin: 0, isTextBox: true });
    });
  }

  // 57 · Modes that matter
  {
    const s = D.slideOf(pres, {
      kicker: K, title: 'Three modes that matter',
      notes: `Modes have a reputation for being complicated. For rock, blues and metal you only need three, and each is just a familiar scale with ONE note changed. The grid shows every scale as a row of the 12 possible intervals. The teal dot is the note that gives each mode its flavor.

Mixolydian = major scale with a ♭7. In A: A B C♯ D E F♯ G. The G (instead of G♯) matches dominant 7 chords (A7 is A C♯ E G). Use it over A7 vamps and over "I–♭VII–IV" rock progressions like A–G–D, where the G chord needs a G natural. Classic-rock and blues-rock players blend it with major pentatonic all the time.

Dorian = natural minor with a natural 6. In A: A B C D E F♯ G. The F♯ (instead of F) brightens the minor sound. Use it over minor 7 vamps (Am7) and minor progressions where the IV chord is major, like Am–D, since the D chord contains F♯. It's the sound of funky, jammy minor rock. It also contains all of A minor pentatonic, so you can add the F♯ to your box 1 playing.

Phrygian = natural minor with a ♭2. In E: E F G A B C D. The F, a half step above the root, is the dark, tense, Spanish-flavored sound behind countless metal riffs (E5–F5). Use it over riffs that move from the root to the chord a half step above.

Natural minor and major are on the grid as references so you can see exactly which note changes.

How to practice: don't learn modes as new shapes. Take a box you know (A minor pentatonic box 1), find where the flavor note sits in it, and add it. Over an Am–D vamp, add F♯ (Dorian). Over A7, use the major box plus G (Mixolydian). Over an E5–F5 riff, lean on F (Phrygian).`,
    });
    const rows = [
      ['Major (Ionian)', T.SCALES.major, null, 'Reference: bright and resolved.'],
      ['Mixolydian', T.SCALES.mixolydian, 10, 'Major with a **♭7** (G in A). A7 vamps, A–G–D rock.'],
      ['Natural minor', T.SCALES.minor, null, 'Reference: dark. The default rock and metal minor.'],
      ['Dorian', T.SCALES.dorian, 9, 'Minor with a **natural 6** (F♯ in A). Am7 vamps, Am–D.'],
      ['Phrygian', T.SCALES.phrygian, 1, 'Minor with a **♭2** (F in E). E5–F5 metal riffs.'],
    ];
    const lx = M; const cx0 = 2.85; const cw = 0.5; const tx = 9.05; const tw = 12.73 - tx;
    T.INTERVAL.forEach((iv, k) => s.addText(iv, { x: cx0 + k * cw, y: 1.6, w: cw, h: 0.28, fontSize: 12, bold: true, color: HEX.muted, align: 'center', margin: 0, isTextBox: true }));
    const rowH = 0.74;
    rows.forEach(([name, ivs, flavor, desc], r) => {
      const y = 2.0 + r * rowH + (r >= 2 ? 0.12 : 0);
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: lx, y, w: 12.13, h: rowH - 0.1, rectRadius: 0.08, fill: { color: flavor === null ? '1D1D23' : HEX.card }, line: { color: flavor === null ? '1D1D23' : HEX.card, width: 0 } });
      s.addText(name, { x: lx + 0.18, y, w: 2.1, h: rowH - 0.1, fontSize: 15, bold: true, color: flavor === null ? HEX.muted : HEX.white, valign: 'middle', margin: 0, isTextBox: true });
      for (let k = 0; k < 12; k++) {
        const cx = cx0 + k * cw + cw / 2; const cy = y + (rowH - 0.1) / 2;
        if (ivs.includes(k)) {
          const role = k === flavor ? 'blue' : T.role(k);
          D.badge(s, { x: cx - 0.19, y: cy - 0.19, d: 0.38, label: T.INTERVAL[k], role, fontSize: 11 });
        } else {
          s.addShape(pres.shapes.OVAL, { x: cx - 0.06, y: cy - 0.06, w: 0.12, h: 0.12, fill: { color: '2C2C35' }, line: { color: '3F3F46', width: 0.75 } });
        }
      }
      D.text(s, desc, { x: tx, y: y + 0.04, w: tw - 0.1, h: rowH - 0.18, fontSize: 14, valign: 'middle', color: flavor === null ? HEX.muted : HEX.text });
    });
    D.text(s, 'A mode is a parent scale with **one note changed**. Learn that note ({blue:teal}) inside the boxes you already know, not a new shape.', { x: M, y: 6.0, w: FULL_W, h: 0.7, fontSize: 16 });
  }

  // 58 · Which scale over which chord
  {
    const s = D.slideOf(pres, {
      kicker: K, title: 'Which scale over which chord',
      notes: `A lookup table for the situations you'll meet in blues, rock and metal jams. Find the left column that matches what the band is playing; the middle column is what to reach for; the right column explains why it fits.

How to read it in practice:
1. Find the key (part 6 covers how to do that by ear).
2. Notice whether the chords are major, minor, dominant 7, or power chords.
3. Start with the pentatonic version (it's the safest), then add the extra notes from the full scale or mode once you hear where they fit.

A few principles behind the table:
• Match the chord's 3rd. Over a major or dominant chord, the scale should contain the major 3rd (C♯ over A or A7); over a minor chord, the minor 3rd (C over Am). The exception is the blues, where the ♭3 over a dominant chord is the whole point.
• Match the chord's 7th. Dominant 7 chords contain a ♭7, so Mixolydian (with ♭7) fits; the major scale (with natural 7) clashes.
• Borrowed chords tell you the mode. A major IV chord in a minor key (Am–D) means the 6th is natural: Dorian. A ♭VII chord in a major key (A–G–D) means the 7th is flat: Mixolydian. A ♭II chord in a minor key (E5–F5) means a ♭2: Phrygian. A major V chord in a minor key (B7 in E minor) means a raised 7th: harmonic minor.
• Power chords have no 3rd, so both major and minor pentatonic can work. Let the bass line, the other instruments, or the melody tell you which.

Treat the table as a starting point. Your ears have the final say: if a note sounds wrong over a chord, it is.`,
    });
    const rows = [
      ['When the band plays…', 'Reach for…', 'Why it fits'],
      ['**12-bar blues** in A (A7, D7, E7)', 'A blues scale; add major pentatonic over A7', 'The blues lives between {third:C} and {third:C♯}'],
      ['**A dominant 7 vamp** (A7)', 'A Mixolydian or A major pentatonic', 'Matches the chord’s {third:C♯} and {seventh:G}'],
      ['**Minor-key rock** (Am, Am–F–G)', 'A minor pentatonic → A natural minor', 'Natural minor’s F matches the F chord'],
      ['**Minor vamp, major IV** (Am7, Am–D)', 'A Dorian', 'The D chord contains {blue:F♯}, Dorian’s 6th'],
      ['**Major-key rock** (A–D–E, A–E–F♯m–D)', 'A major pentatonic, A major scale', 'Bright; use the ♭3 only as a passing bend'],
      ['**I–♭VII–IV rock** (A–G–D)', 'A Mixolydian (or A major pentatonic)', 'The G chord needs the {seventh:♭7} (G), not G♯'],
      ['**Metal riff** E5–F5 (i–♭II)', 'E Phrygian', 'Phrygian’s {blue:♭2} is the riff’s F'],
      ['**Minor key, major V** (Em–C–D–B7)', 'E natural minor; E harmonic minor over B7', 'B7 contains {seventh:D♯}, the raised 7th'],
      ['**Power chords only** (no 3rd)', 'Minor or major pentatonic', 'Let the bass or melody decide major vs. minor'],
    ];
    D.table(s, rows, { x: M, y: CONTENT_TOP + 0.05, w: FULL_W, colW: [3.85, 4.0, 4.28], fontSize: 14, rowH: 0.5 });
  }

  // 59 · Picking & speed
  {
    const s = D.slideOf(pres, {
      kicker: K, title: 'Picking and speed',
      notes: `Speed is a by-product of clean, relaxed, consistent picking. You don't practice speed; you practice accuracy at gradually higher tempos.

Alternate picking: strict down-up-down-up, no matter which string you're on. The arrows under the tabs show the pick direction. It feels awkward when you cross strings at first. Keep the motion small, from the wrist, with the pick barely clearing the string.

Sequences: playing a scale in groups is the classic way to build picking control and get out of "straight up, straight down" scale habits.
• Groups of 4: play notes 1-2-3-4 of the scale, then 2-3-4-5, then 3-4-5-6, and so on. Each group fills one beat of 16th notes. Accent the first note of every group.
• Groups of 3: notes 1-2-3, 2-3-4, 3-4-5... Played as 16th notes, the groups of three cross the beat, which creates a rolling, rhythmic sound used all over rock and metal. With strict alternate picking, the group accents alternate between downstrokes and upstrokes, which is excellent training.
Once these feel good in box 1, do them descending, then in other boxes.

The metronome ladder: pick a starting tempo where you're 100% clean (often 60 bpm). After three clean passes, raise it 4 bpm. If you make a mistake, drop back 10 bpm and climb again. Write your top clean tempo in the practice log each day. Progress of a few bpm per week is normal and good.

Palm muting: rest the edge of your picking hand on the strings right where they meet the bridge saddles. Too far toward the neck and the notes choke; too far back and there's no mute. It's the chug in metal riffs and the tightness in rock rhythm, and it also reduces unwanted string noise when soloing with distortion.

Relax: tension is the enemy of speed. If your forearm burns, stop, shake out, slow down.`,
    });
    const box = T.pentBox('A', 1);
    const fours = []; const pick4 = [];
    for (let g = 0; g < 4; g++) {
      if (g) { fours.push('|'); pick4.push(''); }
      for (let k = 0; k < 4; k++) { const p = box[g + k]; fours.push(`${p.s}:${p.f}`); pick4.push(k % 2 ? '↑' : '↓'); }
    }
    const threes = []; const pick3 = [];
    for (let g = 0; g < 6; g++) for (let k = 0; k < 3; k++) { const p = box[g + k]; threes.push(`${p.s}:${p.f}`); pick3.push(threes.length % 2 ? '↓' : '↑'); }
    const lw = 7.5;
    heading(s, 'Groups of 4 (A minor pentatonic, box 1)', M, 1.6, lw);
    D.tab(s, { x: M, y: 2.05, w: lw, gap: 0.24, cols: fours, counts: pick4, fontSize: 12, check: minPentA });
    heading(s, 'Groups of 3 (they roll across the beat)', M, 3.95, lw);
    D.tab(s, { x: M, y: 4.4, w: lw, gap: 0.24, cols: threes, counts: pick3, fontSize: 12, check: minPentA });
    D.text(s, 'Strict alternate picking (↓ ↑). Accent the first note of each group.', { x: M, y: 6.25, w: lw, h: 0.4, fontSize: 14, color: HEX.muted });
    // metronome ladder
    const rx = 8.45; const rw = 4.28;
    heading(s, 'The metronome ladder', rx, 1.6, rw);
    const bpms = [60, 64, 68, 72, 76, 80];
    const barW = 0.58; const barGap = (rw - barW * 6) / 5; const baseY = 3.85;
    bpms.forEach((b, i) => {
      const hh = 0.55 + i * 0.22; const x = rx + i * (barW + barGap);
      s.addShape(pres.shapes.RECTANGLE, { x, y: baseY - hh, w: barW, h: hh, fill: { color: HEX.pearl, transparency: 70 - i * 13 }, line: { color: HEX.pearl, width: 0, transparency: 100 } });
      s.addText(String(b), { x: x - 0.1, y: baseY - hh - 0.3, w: barW + 0.2, h: 0.26, fontSize: 12, bold: true, color: HEX.text, align: 'center', margin: 0, isTextBox: true });
    });
    D.text(s, '3 clean passes → **+4 bpm**. One mistake → **back 10**.', { x: rx, y: 4.0, w: rw, h: 0.4, fontSize: 14 });
    D.card(s, { x: rx, y: 4.6, w: rw, h: 2.25, title: 'Palm muting', body: 'Rest the edge of your picking hand on the strings at the bridge. Too far forward chokes the note. It’s the chug in metal and the tightness in rock rhythm.', fontSize: 14 });
  }

  // 60 · Building vocabulary
  {
    const s = D.slideOf(pres, {
      kicker: K, title: 'Building vocabulary: steal, change, own',
      notes: `Every great player built their style from other players' ideas. Licks are vocabulary: you learn words and phrases from others, then combine and change them until you have your own voice.

The four steps:
1. Transcribe. Pick a short phrase (5–10 seconds) from a solo you love. Loop it and slow it down; most music apps and many free tools can play audio at 50–75% speed without changing pitch. Find the first note by ear, then the next. This is slow at first, and it's the single best ear-training exercise there is. Check yourself against tab afterward if one exists, but try by ear first.
2. Steal. Learn it exactly, with the right bends, vibrato and rhythm. Then make it automatic: play it over a backing track until you can drop it in without thinking.
3. Change. Alter one thing at a time: the rhythm, one note, the ending, the starting beat, or the position on the neck. Each change gives you a new lick.
4. Own. Use your variation in real improvising this week, and write it in a lick log (a notebook or a file with the tab and where you got it).

The three tabs show one simple lick changed two ways:
• Original: bend D to E, then E, G, and land on A.
• New rhythm: same notes, but the bend is held longer and the ending is quicker. It already feels like a different phrase.
• New position: exactly the same pitches, played higher up the neck (D string 12 bent to 14, then G 9, G 12, B 10). Same sound, different fingering, and a door into box 3 territory.

Aim for one transcribed phrase per week. In a year that's 50 phrases of real vocabulary.`,
    });
    const steps = [
      ['Transcribe', 'Loop a 5–10 second phrase you love at half speed. Find it by ear.', 'root'],
      ['Steal', 'Learn it exactly, with the right bends, vibrato and rhythm.', 'third'],
      ['Change', 'Alter one thing: rhythm, a note, the ending, the position.', 'fifth'],
      ['Own', 'Use your version in a real solo this week. Log it.', 'seventh'],
    ];
    const gap = 0.45; const w = (FULL_W - gap * 3) / 4; const h = 2.3;
    steps.forEach(([t, b, r], i) => {
      const x = M + i * (w + gap);
      D.card(s, { x, y: CONTENT_TOP, w, h, title: t, badge: String(i + 1), badgeRole: r, body: b, fontSize: 14 });
      if (i < 3) s.addShape(pres.shapes.LINE, { x: x + w + 0.08, y: CONTENT_TOP + h / 2, w: gap - 0.16, h: 0, line: { color: HEX.pearl, width: 2, endArrowType: 'triangle' } });
    });
    heading(s, 'One lick, three ways', M, 4.15, FULL_W, { color: HEX.white, fontSize: 16 });
    const tw = 3.85; const tg = (FULL_W - tw * 3) / 2;
    const versions = [
      ['Original', ['3:7b9', '2:5', '2:8', '1:5~']],
      ['New rhythm: hold the bend', ['3:7b9', '', '', '2:5', '2:8', '', '1:5~']],
      ['New position: same pitches', ['4:12b14', '3:9', '3:12', '2:10~']],
    ];
    versions.forEach(([t, cols], i) => {
      const x = M + i * (tw + tg);
      heading(s, t, x, 4.6, tw);
      D.tab(s, { x, y: 5.1, w: tw, gap: 0.25, cols, fontSize: 13, check: minPentA });
    });
  }

  // 61 · Practice this
  D.practice(pres, {
    kicker: K,
    intro: 'Pick two drills per session and always play over a backing track. Rotate through all four each week.',
    drills: [
      { name: 'Three-note solo', how: 'Solo over an A blues using **only A, C and D** from box 1. Make it interesting with rhythm, bends, vibrato and space.', tempo: 'slow blues, 60–70 bpm', time: '5 min', done: '2 minutes without repeating yourself or running dry' },
      { name: 'One-string solo', how: 'Solo **only on the G string** using A minor pentatonic across the whole neck. Slide between notes.', tempo: 'backing track, 80–90 bpm', time: '5 min', done: 'You move freely from fret 2 to fret 17' },
      { name: 'Target-note chorus', how: 'Over a 12-bar in A, land on {third:C♯} (A7), {third:F♯} (D7) and {third:G♯} (E7) on beat 1 of each change.', tempo: 'shuffle, 70–90 bpm', time: '5 min', done: 'You hit every 3rd on the change for a full chorus' },
      { name: 'Lick of the week', how: 'Take one lick from this part. Play it in **2 boxes and 2 keys**, change it 3 ways, then use it in a solo.', tempo: 'start at 60 bpm', time: '5 min', done: 'It shows up in your improvising without planning' },
    ],
    notes: `Four drills that turn this part into skill. Do two per session, always over a backing track, and rotate so you hit all four every week.

1. Three-note solo. Over an A blues, use only A, C and D (the root, ♭3 and 4 in box 1). With so few notes you're forced to make music from rhythm, phrasing, bends (D bent up to E, C bent toward C♯), vibrato and space. This builds the skills that make every other note count. When 2 minutes feels easy, add a fourth note.

2. One-string solo. Solo only on the G string, using A minor pentatonic all the way up the neck (A at 2 and 14, C at 5 and 17, D at 7, E at 9, G at 12). Moving horizontally forces you out of box thinking and makes slides feel natural. Say the note names as you go.

3. Target-note chorus. Over a 12-bar shuffle in A, land on the 3rd of each chord on beat 1 of the bar where it changes: C♯ for A7, F♯ for D7, G♯ for E7. Start by playing only those notes, then fill in with box 1 between them. This is the drill that makes your solos follow the band.

4. Lick of the week. Take one lick from slides 54 or 55. Learn it clean, play it in two boxes and two keys (A and E, for example), make three variations (rhythm, ending, position), and use it in real improvising. Log it in the practice log.

Record one minute of improvising at the end of each week and compare it with the previous week. You're listening for more space, more confident bends, and more phrases that end on chord tones.`,
  });
}

module.exports = { build };
