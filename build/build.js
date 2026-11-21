// Builds a deck. Usage:
//   node build.js                         -> ../Fretboard-Freedom.pptx (Level 1, all sections)
//   node build.js --deck 2                -> ../Fretboard-Freedom-Level-2.pptx (Level 2, all sections)
//   node build.js --deck bridge           -> ../Fretboard-Freedom-Chords-Scales-Arpeggios.pptx (chord → arpeggio → pentatonic lesson)
//   node build.js [--deck 2] --only a,b   -> out/a+b.pptx (chosen sections only, for checking)
const fs = require('fs');
const path = require('path');
const { newDeck, THEME } = require('./lib/deck');
const D = require('./lib/draw');
const { applyTheme } = require('./lib/apply_theme');

const DECKS = {
  1: {
    dir: 'sections', out: 'Fretboard-Freedom.pptx', title: 'Fretboard Freedom', footer: 'Fretboard Freedom',
    sections: ['s0_intro', 's1_theory', 's2_fretboard', 's3_findnotes', 's4_neck', 's5_soloing', 's6_jamming', 's7_practice'],
  },
  2: {
    dir: 'sections2', out: 'Fretboard-Freedom-Level-2.pptx', title: 'Fretboard Freedom · Level 2', footer: 'Fretboard Freedom · Level 2',
    sections: ['l2_s0_intro', 'l2_s1_rhythm', 'l2_s2_scales', 'l2_s3_chordtones', 'l2_s4_chords', 'l2_s5_ear', 'l2_s6_metal', 'l2_s7_songs'],
  },
  bridge: {
    dir: 'sections3', out: 'Fretboard-Freedom-Chords-Scales-Arpeggios.pptx', title: 'Find the Chord, Find the Scale', footer: 'Fretboard Freedom · Chords, arpeggios & pentatonics',
    sections: ['b_s0_bridge'],
  },
};

(async () => {
  const args = process.argv.slice(2);
  const deckIdx = args.indexOf('--deck');
  const deck = DECKS[deckIdx >= 0 ? args[deckIdx + 1] : '1'];
  const onlyIdx = args.indexOf('--only');
  const only = onlyIdx >= 0 ? args[onlyIdx + 1].split(',') : null;
  const list = only || deck.sections;
  const { pres } = newDeck({ title: deck.title, footer: deck.footer });
  D.init(pres);
  for (const name of list) {
    const file = path.join(__dirname, deck.dir, `${name}.js`);
    if (!fs.existsSync(file)) { console.warn(`(skipping missing section ${name})`); continue; }
    require(file).build(pres);
  }
  const out = only ? path.join(__dirname, 'out', `${list.join('+')}.pptx`) : path.join(__dirname, '..', deck.out);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await pres.writeFile({ fileName: out });
  await applyTheme(out, THEME);
  const v = D.VERIFY;
  console.log(`Wrote ${out}: ${pres.slides.length} slides. Verified ${v.dotsChecked}/${v.dots} fretboard dots and ${v.tabChecked}/${v.tabNotes} tab notes against the theory engine.`);
})().catch((e) => { console.error(e); process.exit(1); });
