// Theory Intensive · Part 8 · Rhythm, phrase and form (slides 74–81)
const D = require('../lib/draw');
const I = require('../lib/intensive');
const { HEX, M, CONTENT_TOP, section } = require('../lib/deck');

const K = '8 · Rhythm, phrase and form';
const FULL_W = 12.13;
const assert = (c, m) => { if (!c) throw new Error(`Part 8: ${m}`); };

function heading(s, str, x, y, w, size = 15) {
  s.addText(D.runs(str, { color: HEX.pearl, fontSize: size, bold: true }), { x, y, w, h: 0.32, margin: 0, valign: 'middle', isTextBox: true });
}

// Meter from a time signature: simple if the top number isn't a multiple of 3 above 3.
const COUNT_NAME = { 2: 'duple', 3: 'triple', 4: 'quadruple' };
function meterOf(top) {
  const compound = top > 3 && top % 3 === 0;
  const beats = compound ? top / 3 : top;
  return `${compound ? 'compound' : 'simple'} ${COUNT_NAME[beats]} (${beats} beats)`;
}
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const lcm = (a, b) => (a * b) / gcd(a, b);

// Cells of an even grid: n notes spread over `cells`, each `len` long.
const pulse = (n, cells, role, extra = {}) => Array.from({ length: n }, (_, i) => ({ at: (i * cells) / n, len: cells / n, role, ...extra }));
const numberCounts = (sub) => (b, k) => String(b * sub + k + 1);

// Section bar for the energy map.
function energyBar(s, pres, { x, y0, w, h, role, label, hint }) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: y0 - h, w, h, rectRadius: 0.06, fill: { color: D.ROLE_HEX[role] }, line: { color: D.ROLE_HEX[role], width: 0 } });
  s.addText(hint, { x: x - 0.1, y: y0 - h - 0.34, w: w + 0.2, h: 0.28, fontSize: 12, bold: true, color: HEX.pearl, align: 'center', valign: 'bottom', margin: 0, isTextBox: true });
  s.addText(label, { x: x - 0.1, y: y0 + 0.06, w: w + 0.2, h: 0.28, fontSize: 12, bold: true, color: HEX.text, align: 'center', valign: 'top', margin: 0, isTextBox: true });
}

// One phrase diagram: 8 bar cells with brackets above and chord names below.
function phraseRow(s, pres, { y, label, cells, brackets, chords }) {
  const lx = M; const labelW = 1.55;
  const gx = M + labelW; const gw = FULL_W - labelW; const gap = 0.08;
  const cw = (gw - gap * 7) / 8;
  const cx = (i) => gx + i * (cw + gap);
  const cellY = y + 0.5; const cellH = 0.95;
  s.addText(label, { x: lx, y: cellY, w: labelW - 0.15, h: cellH, fontSize: 18, bold: true, color: HEX.white, margin: 0, valign: 'middle', isTextBox: true });
  for (const b of brackets) {
    const x1 = cx(b.from) + 0.04; const x2 = cx(b.to) + cw - 0.04; const by = y + 0.36;
    const col = b.color || HEX.pearl;
    s.addShape(pres.shapes.LINE, { x: x1, y: by, w: x2 - x1, h: 0, line: { color: col, width: 1.5 } });
    s.addShape(pres.shapes.LINE, { x: x1, y: by, w: 0, h: 0.1, line: { color: col, width: 1.5 } });
    s.addShape(pres.shapes.LINE, { x: x2, y: by, w: 0, h: 0.1, line: { color: col, width: 1.5 } });
    s.addText(b.label, { x: x1, y: by - 0.32, w: x2 - x1, h: 0.28, fontSize: 13, bold: true, color: col, align: 'center', valign: 'bottom', margin: 0, isTextBox: true });
  }
  cells.forEach((c, i) => {
    const st = D.roleStyle(c.role);
    s.addText([{ text: c.text, options: { bold: true, fontSize: 14, color: st.text, breakLine: !!c.sub } }, ...(c.sub ? [{ text: c.sub, options: { fontSize: 11, color: st.text } }] : [])], {
      shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: 0.06, x: cx(i), y: cellY, w: cw, h: cellH,
      fill: { color: st.fill }, line: { color: st.fill, width: 0 }, align: 'center', valign: 'middle', margin: 2, fontFace: 'Arial',
    });
    s.addText(D.runs(chords[i], { color: HEX.text, fontSize: 14, bold: true }), { x: cx(i), y: cellY + cellH + 0.06, w: cw, h: 0.3, align: 'center', margin: 0, isTextBox: true });
  });
  return cellY + cellH + 0.4;
}

function build(pres) {
  section(pres, 'Rhythm, phrase and form');
  const slide = (title, notes) => D.slideOf(pres, { kicker: K, title, notes });

  // 74 · Divider
  D.divider(pres, {
    num: 8, title: 'Rhythm, phrase and form',
    subtitle: 'Harmony and melody happen in time. This part zooms out from the beat to the bar, the phrase and the whole song.',
    outcomes: [
      'Tell simple from compound meter and feel strong and weak beats',
      'Play 3 against 2 and 3 against 4, and use hemiola',
      'Control harmonic rhythm to build and release energy',
      'Write periods and sentences that sound finished',
      'Map a song’s form and what the harmony does in each section',
    ],
    notes: `Part 8: Rhythm, phrase and form.

Everything so far has been about pitch: which notes, which chords. But music is pitch in time, and most of what makes a song feel like a song happens at time scales longer than a single note. This part zooms out in steps.

First the beat and the bar: meter. Why 6/8 and 3/4 contain the same six 8th notes but feel completely different. How strong and weak beats repeat at every level, including whole groups of bars.

Then rhythmic tension: polyrhythms, where two pulses run at once (3 against 2, 3 against 4), and hemiola, where the grouping of a bar briefly changes. These are the tools behind dotted-8th delay riffs, half-time breakdowns, and the lilting feel of many ballads.

Then harmonic rhythm: not which chords, but how often they change. It's one of the strongest energy controls a songwriter has, and it's free.

Then the phrase: how bars group into musical sentences that ask and answer. The two classic shapes, the period and the sentence, are behind an enormous number of melodies in every genre, Mandopop ballads included.

Finally the song: verse, pre-chorus, chorus and bridge, and what harmony usually does in each one to shape the energy of the whole track.

This part ties the whole deck together. Cadences from Part 5 end phrases. Modulation from Part 6 lifts the last chorus. Motifs from Part 7 fill the phrases. If you write songs, this is the part that turns theory into arrangements.`,
  });

  // 75 · Meter as a hierarchy
  {
    const s = slide('Meter as a hierarchy', `Meter is the pattern of strong and weak beats that your ear assumes once a song starts. It's a hierarchy: strong and weak alternate at the level of the subdivision, the beat, the bar and even groups of bars.

Simple vs. compound is the first distinction:
• In simple meter each beat splits into two: 2/4, 3/4, 4/4. You count "1 & 2 &".
• In compound meter each beat splits into three: 6/8, 9/8, 12/8. You count "1 la li 2 la li" or just feel the triplet swing.
Quick test: if the top number is 6, 9 or 12, divide by 3 to get the number of beats. 6/8 has two beats, 12/8 has four.

The first two grids make the point. 6/8 and 3/4 both contain six 8th notes, the same length of bar. But 6/8 groups them 3+3 (two big beats, a rocking feel), while 3/4 groups them 2+2+2 (three beats, a waltz). Same notes, different accents, different meter. The third grid is 12/8: four beats, each split into three. It's the slow blues and the shuffle written out.

The last grid is hypermeter: bars group into fours just as beats do. Bar 1 of a four-bar group is the strongest, bar 3 is medium, bars 2 and 4 are weak. That's why chord changes and phrase starts feel natural on bar 1 and bar 5 of a song section, and why a phrase that starts on bar 2 sounds odd.

Try it now: set a metronome to click 8th notes at 180. Strum six 8ths per bar and accent 1 and 4 for two bars (6/8), then 1, 3 and 5 for two bars (3/4). Keep switching. The notes don't change, only your accents, and the feel flips.

Common mistake: counting 12/8 as twelve beats. At normal tempos it's four beats. Feel the four, and let the triplets ride on top.`);
    const lw = 8.1; const labelW = 1.7;
    let y = CONTENT_TOP - 0.05;
    const cells = (n, strong, medium) => Array.from({ length: n }, (_, i) => ({ at: i, len: 1, role: strong.includes(i) ? 'root' : medium.includes(i) ? 'third' : 'other', accent: strong.includes(i) || medium.includes(i) }));
    y = D.rhythm(s, { x: M, y, w: lw, beats: 2, sub: 3, beatsPerBar: 2, labelW, rowH: 0.55, rows: [{ label: '6/8 = 3+3', notes: cells(6, [0], [3]) }], countLabels: numberCounts(3) }) + 0.4;
    y = D.rhythm(s, { x: M, y, w: lw, beats: 3, sub: 2, beatsPerBar: 3, labelW, rowH: 0.55, rows: [{ label: '3/4 = 2+2+2', notes: cells(6, [0], [2, 4]) }], countLabels: (b, k) => (k === 0 ? String(b + 1) : '&') }) + 0.4;
    y = D.rhythm(s, { x: M, y, w: lw, beats: 4, sub: 3, beatsPerBar: 4, labelW, rowH: 0.55, rows: [{ label: '12/8', notes: cells(12, [0], [3, 6, 9]) }], countLabels: (b, k) => (k === 0 ? String(b + 1) : ['', 'la', 'li'][k]) }) + 0.4;
    const bars = [['Strong', 'root'], ['Weak', 'other'], ['Medium', 'third'], ['Weak', 'other']];
    D.rhythm(s, {
      x: M, y, w: lw, beats: 4, sub: 1, beatsPerBar: 1, labelW, rowH: 0.55,
      rows: [{ label: '4 bars', notes: bars.map(([t, role], i) => ({ at: i, len: 1, role, text: t })) }],
      countLabels: (b) => `Bar ${b + 1}`,
    });
    D.card(s, {
      x: 9.0, y: CONTENT_TOP, w: 3.73, h: 5.3, title: 'Simple vs. compound',
      bullets: [
        '**Simple:** each beat splits in **2**. 2/4, 3/4, 4/4',
        '**Compound:** each beat splits in **3**. 6/8, 9/8, 12/8',
        'Top number 6, 9 or 12: **divide by 3** to get the beats',
        'Strong–weak repeats at every level: subdivision, beat, bar, **4-bar group**',
      ],
      fontSize: 14, paraSpace: 10,
    });
  }

  // 76 · Polyrhythm and hemiola
  {
    const s = slide('Polyrhythm and hemiola', `A polyrhythm is two even pulses running at the same time, where neither divides evenly into the other. The trick to playing one is to find the smallest grid both pulses fit on, which is the least common multiple of the two numbers.

• 3 against 2 needs 6 cells. The 2-pulse lands on cells 1 and 4, the 3-pulse on cells 1, 3 and 5. Count "1 2 3 4 5 6" and clap one pulse while tapping the other. It's the basic ingredient of African and Afro-Cuban rhythm, and of the 6/8 ballad lilt.
• 3 against 4 needs 12 cells. The 4-pulse lands on 1, 4, 7, 10 and the 3-pulse on 1, 5, 9. This is the polyrhythm behind triplet fills over a straight beat.

Grouping is the guitarist's everyday polyrhythm. Dotted 8ths (each three 16ths long) grouped 3+3+3+3+4 fill a bar of sixteen 16ths. The pattern of accents runs against the beat for most of the bar, then resolves with the final 4. It's the rhythm of countless delay-guitar parts and djent riffs. Play it on a palm-muted low E and it sounds instantly modern.

Hemiola is a temporary regrouping that makes the meter seem to change. In 6/8 the bar normally divides 3+3. Hemiola divides it 2+2+2 for a bar or two, so it suddenly feels like 3/4, before snapping back. Composers use it at cadences to slow the feel down without changing the tempo. You'll hear it in ballads in 6/8 and in waltz-like rock.

Try it now: metronome on 16ths at 70 bpm (quarter note = 70, clicking 16ths if your metronome allows). Palm-mute the low E and play the 3+3+3+3+4 grouping, accenting each group's first note. Count "1 2 3, 1 2 3, 1 2 3, 1 2 3, 1 2 3 4". Then speed up by 5 bpm at a time.

Common mistake: rushing the "4" group at the end. It's one 16th longer than the others, and that extra 16th is what lets the pattern land on the next downbeat.`);
    const qw = (FULL_W - 0.4) / 2; const labelW = 1.05;
    const cx = [M, M + qw + 0.4]; const cy = [CONTENT_TOP, CONTENT_TOP + 2.25];
    heading(s, '3 against 2: a 6-cell grid', cx[0], cy[0], qw, 14);
    D.rhythm(s, { x: cx[0], y: cy[0] + 0.4, w: qw, beats: 2, sub: 3, beatsPerBar: 2, labelW, rows: [{ label: 'Two', notes: pulse(2, 6, 'root') }, { label: 'Three', notes: pulse(3, 6, 'fifth') }], countLabels: numberCounts(3) });
    heading(s, '3 against 4: a 12-cell grid', cx[1], cy[0], qw, 14);
    D.rhythm(s, { x: cx[1], y: cy[0] + 0.4, w: qw, beats: 4, sub: 3, beatsPerBar: 4, labelW, rows: [{ label: 'Four', notes: pulse(4, 12, 'root') }, { label: 'Three', notes: pulse(3, 12, 'fifth') }], countLabels: numberCounts(3) });
    heading(s, 'Dotted 8ths: 3+3+3+3+4 in 16ths', cx[0], cy[1], qw, 14);
    const groups = [3, 3, 3, 3, 4];
    assert(groups.reduce((a, b) => a + b, 0) === 16, 'grouping fills a bar');
    let at = 0;
    const riff = groups.map((len) => { const n = { at, len, role: 'third', accent: true, text: String(len) }; at += len; return n; });
    D.rhythm(s, { x: cx[0], y: cy[1] + 0.4, w: qw, beats: 4, sub: 4, labelW, rows: [{ label: 'Riff', notes: riff }, { label: 'Beat', notes: pulse(4, 16, 'other') }] });
    heading(s, 'Hemiola: 6/8 regrouped as 2+2+2', cx[1], cy[1], qw, 14);
    D.rhythm(s, {
      x: cx[1], y: cy[1] + 0.4, w: qw, beats: 4, sub: 3, beatsPerBar: 2, labelW,
      rows: [{ label: '6/8', notes: pulse(4, 12, 'fifth') }, { label: 'Hemiola', notes: pulse(6, 12, 'seventh') }],
      countLabels: (b, k) => String((b % 2) * 3 + k + 1),
    });
    D.card(s, {
      x: M, y: 5.95, w: FULL_W, h: 0.9, pad: 0.18,
      body: '**Find the grid first:** the least common multiple of the two pulses (3 and 2 → 6, 3 and 4 → 12). Count the grid out loud, clap one pulse, tap the other.',
      fontSize: 14,
    });
  }

  // 77 · Harmonic rhythm
  {
    const s = slide('Harmonic rhythm', `Harmonic rhythm is how often the chords change. It's separate from the melody's rhythm and from the drum beat, and it's one of the most powerful energy controls in songwriting, because the listener feels each chord change as an event.

The four rows show the same few chords at different harmonic rhythms:
• One chord every two bars: spacious and relaxed. Typical of verses, intros and ballads, and it leaves room for the lyric.
• One chord per bar: the default pop and rock rate.
• Two chords per bar: busier and more urgent. Common in pre-choruses and in jazz standards.
• Speeding up: C for two bars, F for one, then Dm and G for half a bar each. The harmonic rhythm doubles twice as it approaches the cadence. This acceleration is the most common way to build into a chorus or into the end of a phrase. Classical composers did it constantly, and pop songwriters still do.

The opposite move also works. Slowing the harmonic rhythm right after a busy section, like a chorus that holds one chord for two bars after a busy pre-chorus, feels like an arrival or a release.

Where changes land matters too. A change on bar 1 of a four-bar group (the strong bar in hypermeter) feels natural. A change that arrives an 8th note early, an anticipation, feels pushed and exciting. That's the sound of many rock and Mandopop choruses, where the chord hits on the "&" of 4.

Try it now: loop C–Am–F–G and play it three ways: two bars per chord, one bar per chord, two chords per bar. Then play C (2 bars), F (1 bar), Dm–G (half a bar each), and listen to how the last bar pulls you into the next C.

Common mistake: changing the harmonic rhythm randomly. Keep it steady within a section and change it between sections, or accelerate deliberately toward a cadence.`);
    const labelW = 1.85;
    const ch = (name, at, len, fn) => ({ at, len, role: I.FN[fn].role, text: name });
    const y = D.rhythm(s, {
      x: M, y: CONTENT_TOP, w: FULL_W, beats: 4, sub: 4, beatsPerBar: 1, labelW, rowH: 0.5,
      rows: [
        { label: 'Every 2 bars', notes: [ch('C', 0, 8, 'T'), ch('Am', 8, 8, 'T')] },
        { label: 'Every bar', notes: [ch('C', 0, 4, 'T'), ch('Am', 4, 4, 'T'), ch('F', 8, 4, 'PD'), ch('G', 12, 4, 'D')] },
        { label: 'Twice a bar', notes: ['C', 'Am', 'F', 'G', 'C', 'Am', 'F', 'G'].map((n, i) => ch(n, i * 2, 2, { C: 'T', Am: 'T', F: 'PD', G: 'D' }[n])) },
        { label: 'Speeding up', notes: [ch('C', 0, 8, 'T'), ch('F', 8, 4, 'PD'), ch('Dm', 12, 2, 'PD'), ch('G', 14, 2, 'D')] },
      ],
      countLabels: (b, k) => (k === 0 ? `Bar ${b + 1}` : String(k + 1)),
    });
    I.fnLegend(s, { x: M + labelW, y: y + 0.08, fns: ['T', 'PD', 'D'] });
    const cw = (FULL_W - 0.3) / 2; const cy = y + 0.55;
    D.card(s, { x: M, y: cy, w: cw, h: 6.85 - cy, title: 'Faster = more energy', body: 'More changes per bar push forward. **Accelerate into a cadence** or a chorus; slow down after it to feel the arrival.', fontSize: 14 });
    D.card(s, { x: M + cw + 0.3, y: cy, w: cw, h: 6.85 - cy, title: 'Keep it steady inside a section', body: 'Change the rate **between** sections. Changes on **bar 1** of a 4-bar group feel natural; an 8th early feels pushed.', fontSize: 14 });
  }

  // 78 · Phrase structure
  {
    const s = slide('Phrase structure: period and sentence', `A phrase is a musical sentence: a span of melody and harmony that ends with a cadence. Most phrases are four bars long, and pairs of phrases make eight-bar units. Two eight-bar shapes appear so often, in classical music, pop, rock and Mandopop alike, that they're worth knowing by name.

The period is question and answer. The antecedent (bars 1–4) states a basic idea, adds a contrasting idea, and ends on a half cadence (V): it asks a question. The consequent (bars 5–8) starts with the same basic idea, so the listener recognizes it, then changes the ending to land on an authentic cadence (V–I): it answers. The return of the opening idea is what makes it a period. The example ends bar 4 on G (half cadence) and bar 8 on C after G7 (authentic cadence).

The sentence is idea, idea again, then go. The presentation states a two-bar basic idea and repeats it, often moved to a new chord (here C, then G). The continuation then breaks the idea into smaller fragments, speeds up the harmonic rhythm, and drives to a cadence in bars 7–8. It has more forward momentum than a period, which is why it suits verse melodies and riffs that build.

Both shapes reuse the tools from earlier parts: cadences (Part 5) end the phrases, harmonic rhythm accelerates in the continuation, and motif development (Part 7) supplies the repetition and fragmentation.

Try it now: over | C | F | C | G | C | F | G7 | C |, improvise an 8-bar period. Play a two-bar idea in bars 1–2, end bar 4 on a note of G (B or D), restart with the same idea in bar 5, and end bar 8 on C. Then try a sentence over the second progression.

Common mistake: writing two four-bar phrases that both end on I. Without a half cadence first, there's no question, so the answer has nothing to answer.`);
    let y = CONTENT_TOP - 0.05;
    y = phraseRow(s, pres, {
      y, label: 'Period',
      cells: [{ text: 'a', sub: 'basic idea', role: 'fifth' }, { text: 'a', role: 'fifth' }, { text: 'b', sub: 'contrast', role: 'third' }, { text: 'HC', sub: 'half cadence', role: 'root' }, { text: 'a', sub: 'same idea', role: 'fifth' }, { text: 'a', role: 'fifth' }, { text: 'c', sub: 'new ending', role: 'third' }, { text: 'PAC', sub: 'authentic', role: 'root' }],
      brackets: [{ from: 0, to: 3, label: 'Antecedent: the question' }, { from: 4, to: 7, label: 'Consequent: the answer' }],
      chords: ['C', 'F', 'C', '{root:G}', 'C', 'F', 'G7', '{fifth:C}'],
    }) + 0.4;
    y = phraseRow(s, pres, {
      y, label: 'Sentence',
      cells: [{ text: 'a', sub: 'basic idea', role: 'fifth' }, { text: 'a', role: 'fifth' }, { text: 'a′', sub: 'repeat', role: 'fifth' }, { text: 'a′', role: 'fifth' }, { text: 'frag', sub: 'faster', role: 'seventh' }, { text: 'frag', sub: 'faster', role: 'seventh' }, { text: 'drive', role: 'third' }, { text: 'PAC', sub: 'cadence', role: 'root' }],
      brackets: [{ from: 0, to: 3, label: 'Presentation: idea, idea again' }, { from: 4, to: 7, label: 'Continuation: break it up, go' }],
      chords: ['C', 'C', 'G', 'G', 'Am F', 'Dm G', 'C/G G7', '{fifth:C}'],
    });
    const cw = (FULL_W - 0.3) / 2; const cy = Math.max(y + 0.1, 5.75);
    D.card(s, { x: M, y: cy, w: cw, h: 6.85 - cy, pad: 0.18, body: '**Period:** same opening twice; the first ending asks (V), the second answers (V–I).', fontSize: 14 });
    D.card(s, { x: M + cw + 0.3, y: cy, w: cw, h: 6.85 - cy, pad: 0.18, body: '**Sentence:** 2 + 2 + 4. State, repeat, then fragment and drive to the cadence.', fontSize: 14 });
  }

  // 79 · Song form and energy
  {
    const s = slide('Song form and energy', `Song form is phrase structure at the largest scale. Most pop, rock and Mandopop songs use some version of verse, pre-chorus, chorus and bridge, and each section has a typical harmonic job. The energy map shows a common shape. Height is energy, and the label above each bar is the harmony that section often leans on.

• Verse: low to medium energy, telling the story. Harmony is stable and often slow: it sits on I or vi, the harmonic rhythm is relaxed, and the melody is lower in the singer's range.
• Pre-chorus: the ramp. It typically moves to IV or ii and leans toward V, so the ear expects an arrival. The harmonic rhythm often speeds up, and a half cadence or a held V at the end is the classic launch.
• Chorus: the peak and the hook. It either lands on I (strong arrival) or starts on IV (lift without full resolution, very common in modern pop and Mandopop). The melody sits higher, and the harmonic rhythm is steady and strong.
• Bridge: contrast. A new chord color, often starting on vi, ♭VI or IV, sometimes a different key, then a V or a held dominant to set up the return.
• Last chorus: the biggest moment. Often lifted with a direct modulation up a half or whole step (Part 6), or with a bigger arrangement.

Two second-verse details: verse 2 usually has a bit more energy than verse 1 (fuller arrangement), and the second pre-chorus often goes straight into the chorus without a gap.

Try it now: pick any song you know well and draw its energy map on paper: sections in order, bar heights by feel. Then write the chord each section starts on, and check how many match the table.

Common mistake: giving the verse and chorus the same harmony, the same harmonic rhythm and the same melodic range. Something has to change to make the chorus feel like an arrival: the starting chord, the rhythm, the register or all three.`);
    const SECTIONS = [
      ['Intro', 1.2, 'other', 'I or vi'], ['Verse 1', 2.0, 'fifth', 'I · vi'], ['Pre', 3.0, 'third', 'IV · ii → V'], ['Chorus', 4.3, 'root', 'I or IV'],
      ['Verse 2', 2.3, 'fifth', 'I · vi'], ['Pre', 3.2, 'third', 'IV → V'], ['Chorus', 4.5, 'root', 'I or IV'], ['Bridge', 3.4, 'seventh', 'vi · ♭VI'], ['Last chorus', 5.0, 'root', 'up a step'],
    ];
    const n = SECTIONS.length; const gap = 0.16; const bw = (FULL_W - gap * (n - 1)) / n;
    const y0 = 4.3; const unit = 0.44;
    s.addShape(pres.shapes.LINE, { x: M, y: y0, w: FULL_W, h: 0, line: { color: HEX.line, width: 1 } });
    SECTIONS.forEach(([label, e, role, hint], i) => energyBar(s, pres, { x: M + i * (bw + gap), y0, w: bw, h: e * unit, role, label, hint }));
    const cards = [
      ['Verse', 'fifth', 'Stable and slow: **I or vi**, relaxed harmonic rhythm, lower melody.'],
      ['Pre-chorus', 'third', 'The ramp: **IV or ii → V**, faster changes, end on or near V.'],
      ['Chorus', 'root', 'The arrival: land on **I**, or start on **IV** for lift. Highest melody.'],
      ['Bridge', 'seventh', 'Contrast: **vi, ♭VI** or a new key, then a dominant to return.'],
    ];
    const cw = (FULL_W - 0.3 * 3) / 4; const cy = 4.85;
    cards.forEach(([t, role, b], i) => D.card(s, { x: M + i * (cw + 0.3), y: cy, w: cw, h: 6.85 - cy, title: t, titleColor: D.ROLE_HEX[role], body: b, fontSize: 14 }));
  }

  // 80 · Exercises on paper
  {
    const meterItems = [6, 3, 12, 9, 2, 4].map((top) => [`${top}/${top % 3 === 0 && top > 3 ? 8 : 4}`, meterOf(top)]);
    const hitsOf = (n, cells) => Array.from({ length: n }, (_, i) => (i * cells) / n + 1).join(', ');
    const polyItems = [
      ['Smallest grid for 3 against 2?', `${lcm(3, 2)} cells`],
      ['Smallest grid for 3 against 4?', `${lcm(3, 4)} cells`],
      ['Smallest grid for 5 against 4?', `${lcm(5, 4)} cells`],
      ['3 against 4: which cells get the 3?', `cells ${hitsOf(3, 12)}`],
      ['16ths in one dotted 8th?', '3'],
      ['Dotted 8ths in a bar of 16ths: grouping?', '3+3+3+3+4'],
    ];
    const phraseItems = [
      ['| C | F | G | C |: chords per bar?', '1'],
      ['C (2 bars), F (1), Dm–G (½ each): faster or slower?', 'speeding up'],
      ['A phrase ends on V. Cadence?', 'half cadence'],
      ['Antecedent + consequent = ?', 'period'],
      ['Idea, repeat, continuation (2+2+4) = ?', 'sentence'],
      ['Strongest bar of a 4-bar group?', 'bar 1'],
    ];
    const formItems = [
      ['Leans on IV or ii toward V', 'pre-chorus'],
      ['Highest energy; the hook', 'chorus'],
      ['Contrast, often on vi or ♭VI', 'bridge'],
      ['Often lifted up a half or whole step', 'last chorus'],
      ['Stable, often on I or vi; tells the story', 'verse'],
    ];
    I.worksheet(pres, {
      part: 8, kicker: K,
      groups: [
        { key: 'A', title: 'Name the meter', instr: 'Simple or compound; duple, triple or quadruple; beats per bar.', items: meterItems, weight: 0.85 },
        { key: 'B', title: 'Polyrhythm and grouping', items: polyItems, weight: 1.1 },
        { key: 'C', title: 'Harmonic rhythm and phrases', items: phraseItems, weight: 1.15 },
        { key: 'D', title: 'Which section?', instr: 'Name the song section.', items: formItems, weight: 0.9 },
      ],
      grid: 'row',
      notes: `The Part 8 worksheet. About 15 minutes.

Group A: name the meter. Look at the top number. If it's 6, 9 or 12, the meter is compound: divide by 3 to get the beats (6/8 has 2 beats, so compound duple). Otherwise it's simple, and the top number is the number of beats (3/4 is simple triple). The bottom number doesn't change the category for these signatures.

Group B: polyrhythm and grouping. For "smallest grid" questions, find the least common multiple. For "which cells", divide the grid evenly: 3 hits in 12 cells are 4 cells apart, starting on cell 1. For the grouping question, remember that a dotted 8th is three 16ths, and that sixteen 16ths can't be split into equal 3s.

Group C: harmonic rhythm and phrases. Count chords per bar, compare rates across bars, and use the cadence names from Part 5. Period and sentence come from the phrase structure slide.

Group D: which section of a song? Use the song form slide. Some answers overlap in real songs, so give the most typical one.

Scoring: one miss per group is a pass. For group B, don't stop at the paper answer: clap and tap each polyrhythm on the 6-cell or 12-cell grid, counting out loud, until the two pulses feel independent.

Then apply group D to a real song. Map the sections of one song you love and write the chord each section starts on.`,
    });
  }

  // 81 · Exercises on the neck
  D.practice(pres, {
    kicker: K, title: 'Exercises on the neck',
    intro: 'Use a metronome for the first three. Record the fourth and listen back.',
    drills: [
      { name: '6/8 ↔ 3/4 switch', how: 'Metronome on 8th notes. Strum six 8ths per bar: accent 1 and 4 for two bars, then 1, 3 and 5 for two bars. Keep switching.', tempo: '8ths at 150 → 200', time: '5 min', done: '2 minutes of switching without losing the bar' },
      { name: '3 against 2, 3 against 4', how: 'Tap the 2 (or 4) with your foot, play the 3 as muted strums, counting the full grid out loud. Then swap: foot on 3, hand on 2.', tempo: 'Grid at 120', time: '5 min', done: 'Both ways, 8 bars each, no hesitation' },
      { name: 'Dotted-8th chug', how: 'Palm-muted low E, groups of 3+3+3+3+4 sixteenths, accent each group’s first note. Add a power chord on each accent.', tempo: '70 → 110 bpm', time: '5 min', done: '8 clean bars at 110' },
      { name: 'Write an 8-bar period', how: 'In A: | A | D | A | E | A | D | E7 | A |. Improvise a 2-bar idea, end bar 4 on a note of E, restart the idea, end bar 8 on A.', tempo: '80 bpm', time: '10 min', done: 'Three takes that sound like question and answer' },
    ],
    notes: `Four drills for Part 8. About 25 minutes in total.

1. 6/8 to 3/4 switch. Set the metronome to click every 8th note so you have a neutral grid. Strum six 8ths per bar with steady down-up motion. The only thing that changes is your accents: 1 and 4 for 6/8, then 1, 3 and 5 for 3/4. Switch every two bars. When it's easy, switch every bar. This is the hemiola in your hands.

2. Polyrhythms. Start with 3 against 2 on a 6-cell grid. Count "1 2 3 4 5 6" out loud, tap your foot on 1 and 4, and strum muted strings on 1, 3 and 5. Once it's steady, swap limbs. Then move to 3 against 4 on a 12-cell grid. Counting the grid out loud is the whole secret. Don't try to feel it until you can count it.

3. Dotted-8th chug. The grouping from the polyrhythm slide, on a palm-muted low E. Accent the first note of each group and keep the 16ths even underneath. When it's solid, put an E5 power chord on each accented note and leave the rest muted. You now have a riff that runs across the bar line and resolves on the next downbeat.

4. Write an 8-bar period. Loop the progression in A. Your melody in bars 1–2 is the basic idea. End bar 4 on E, G♯ or B (a note of the E chord) to make the half cadence. Restart the same idea in bar 5, and end bar 8 on A over the A chord. Record three takes. The best one should sound like a question and its answer even with no lyrics.

Log the tempos and keep your best period recording. It's raw material for the capstone.`,
  });
}

module.exports = { build };
