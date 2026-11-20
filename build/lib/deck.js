// Deck frame: theme, slide layouts, and slide factories.
const pptxgen = require('pptxgenjs');

const THEME = {
  name: 'Fretboard Freedom',
  headFontFace: 'Arial Black',
  bodyFontFace: 'Arial',
  colors: {
    dk1: '17171B', // stage black: dark backgrounds, text on light slides
    lt1: 'FFFFFF', // white: text on dark slides, light backgrounds
    dk2: '23232A', // card on dark slides
    lt2: 'E9DFC8', // pearl: kickers, natural notes on the map
    accent1: 'E5484D', // root
    accent2: 'F5A524', // 3rd
    accent3: '3B82F6', // 5th
    accent4: 'A855F7', // 7th
    accent5: '14B8A6', // blue note / flavor note
    accent6: 'D4D4D8', // other scale notes
    hlink: 'F5A524',
    folHlink: 'A855F7',
  },
};

// Hex values used where a scheme color is not allowed or the theme has no slot.
const HEX = {
  bg: '17171B', card: '23232A', card2: '2C2C35', pearl: 'E9DFC8', white: 'FFFFFF',
  text: 'E4E4E7', muted: 'A1A1AA', faint: '71717A', line: '3F3F46',
  lightBg: 'FFFFFF', lightCard: 'F4F4F5', lightCard2: 'E4E4E7', lightText: '18181B', lightMuted: '52525B', lightLine: 'D4D4D8',
  root: 'E5484D', third: 'F5A524', fifth: '3B82F6', seventh: 'A855F7', blue: '14B8A6', other: 'D4D4D8',
  wood: '3D2619', woodEdge: '2A1810', fret: 'B9B2A4', nut: 'EFE8D8', string: 'CEC6B6', inlay: '7D6754',
};

const SLIDE_W = 13.333;
const SLIDE_H = 7.5;
const M = 0.6; // side margin
const CONTENT_TOP = 1.55;
const CONTENT_BOTTOM = 6.85;

function newDeck({ title: deckTitle = 'Fretboard Freedom', footer: footerText = 'Fretboard Freedom' } = {}) {
  const pres = new pptxgen();
  pres.layout = 'LAYOUT_WIDE';
  pres.title = deckTitle;
  pres.subject = 'A practice system for electric guitar';
  pres.author = 'Fretboard Freedom';
  pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
  const C = pres.SchemeColor;

  const footer = (dark) => [
    { text: { text: footerText, options: { x: M, y: 7.02, w: 5, h: 0.3, fontSize: 9, color: dark ? HEX.faint : HEX.lightMuted, margin: 0 } } },
  ];
  const slideNumber = (dark) => ({ x: 12.13, y: 7.02, w: 0.6, h: 0.3, fontSize: 9, color: dark ? HEX.faint : HEX.lightMuted, align: 'right', margin: 0 });

  const kicker = (dark) => ({ placeholder: { options: { name: 'kicker', type: 'body', x: M, y: 0.34, w: 12.1, h: 0.3, fontSize: 12, bold: true, charSpacing: 2, color: dark ? C.background2 : HEX.lightMuted, margin: 0, valign: 'middle', align: 'left' }, text: '' } });
  const title = (dark) => ({ placeholder: { options: { name: 'title', type: 'title', x: M, y: 0.66, w: 12.1, h: 0.72, fontFace: THEME.headFontFace, fontSize: 30, color: dark ? C.background1 : C.text1, margin: 0, valign: 'top', align: 'left' }, text: '' } });

  pres.defineSlideMaster({
    title: 'Title',
    background: { color: C.text1 },
    objects: [
      { placeholder: { options: { name: 'kicker', type: 'body', x: M, y: 1.7, w: 8, h: 0.4, fontSize: 14, bold: true, charSpacing: 3, color: C.background2, margin: 0, align: 'left' }, text: '' } },
      { placeholder: { options: { name: 'title', type: 'title', x: M, y: 2.15, w: 8.2, h: 2.4, fontFace: THEME.headFontFace, fontSize: 60, color: C.background1, margin: 0, valign: 'top', align: 'left' }, text: '' } },
      { placeholder: { options: { name: 'body', type: 'body', x: M, y: 4.6, w: 7.4, h: 1.2, fontSize: 20, color: HEX.muted, margin: 0, valign: 'top', align: 'left' }, text: '' } },
    ],
  });

  pres.defineSlideMaster({
    title: 'Section',
    background: { color: C.text1 },
    objects: [
      { placeholder: { options: { name: 'kicker', type: 'body', x: M, y: 1.9, w: 6, h: 0.4, fontSize: 14, bold: true, charSpacing: 3, color: C.background2, margin: 0, align: 'left' }, text: '' } },
      { placeholder: { options: { name: 'title', type: 'title', x: M, y: 2.35, w: 6.5, h: 1.6, fontFace: THEME.headFontFace, fontSize: 44, color: C.background1, margin: 0, valign: 'top', align: 'left' }, text: '' } },
    ],
    slideNumber: slideNumber(true),
  });

  pres.defineSlideMaster({
    title: 'Content Dark',
    background: { color: C.text1 },
    objects: [...footer(true), kicker(true), title(true)],
    slideNumber: slideNumber(true),
  });

  pres.defineSlideMaster({
    title: 'Content Light',
    background: { color: C.background1 },
    objects: [...footer(false), kicker(false), title(false)],
    slideNumber: slideNumber(false),
  });

  return { pres, C };
}

let currentSection = null;
function section(pres, name) {
  pres.addSection({ title: name });
  currentSection = name;
}

// Standard content slide. Returns the slide; draw content between CONTENT_TOP and CONTENT_BOTTOM.
function content(pres, { kicker = '', title, light = false, notes }) {
  const slide = pres.addSlide({ masterName: light ? 'Content Light' : 'Content Dark', sectionTitle: currentSection });
  if (kicker) slide.addText(kicker.toUpperCase(), { placeholder: 'kicker' });
  slide.addText(title, { placeholder: 'title' });
  if (notes) slide.addNotes(notes);
  slide._light = light;
  return slide;
}

module.exports = { THEME, HEX, SLIDE_W, SLIDE_H, M, CONTENT_TOP, CONTENT_BOTTOM, newDeck, section, content, getSection: () => currentSection };
