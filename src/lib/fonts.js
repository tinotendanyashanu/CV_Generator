import sansRegular from '../assets/fonts/LiberationSans-Regular.ttf?url';
import sansBold from '../assets/fonts/LiberationSans-Bold.ttf?url';
import sansItalic from '../assets/fonts/LiberationSans-Italic.ttf?url';
import sansBoldItalic from '../assets/fonts/LiberationSans-BoldItalic.ttf?url';
import serifRegular from '../assets/fonts/LiberationSerif-Regular.ttf?url';
import serifBold from '../assets/fonts/LiberationSerif-Bold.ttf?url';
import serifItalic from '../assets/fonts/LiberationSerif-Italic.ttf?url';
import serifBoldItalic from '../assets/fonts/LiberationSerif-BoldItalic.ttf?url';

const FACES = [
  ['CV Sans', sansRegular, 400, 'normal'],
  ['CV Sans', sansBold, 700, 'normal'],
  ['CV Sans', sansItalic, 400, 'italic'],
  ['CV Sans', sansBoldItalic, 700, 'italic'],
  ['CV Serif', serifRegular, 400, 'normal'],
  ['CV Serif', serifBold, 700, 'normal'],
  ['CV Serif', serifItalic, 400, 'italic'],
  ['CV Serif', serifBoldItalic, 700, 'italic']
];

export function absoluteAssetUrl(url) {
  if (typeof location === 'undefined') return url;
  return new URL(url, location.href).href;
}

export function fontFaceCss() {
  return FACES.map(([family, file, weight, style]) => `
@font-face {
  font-family: "${family}";
  src: url("${absoluteAssetUrl(file)}") format("truetype");
  font-weight: ${weight};
  font-style: ${style};
  font-display: swap;
}`).join('\n');
}
