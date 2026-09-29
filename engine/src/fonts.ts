import {loadFont} from '@remotion/fonts';
import {continueRender, delayRender, staticFile} from 'remotion';

const LATIN =
  'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const LATIN_EXT =
  'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';

const weights = ['400', '500', '600', '700', '800', '900'];

let started = false;
export const ensureFonts = () => {
  if (started) return;
  started = true;
  const handle = delayRender('Loading Inter');
  Promise.all(
    weights.flatMap((w) => [
      loadFont({family: 'Inter', url: staticFile(`fonts/inter-latin-${w}-normal.woff2`), weight: w, unicodeRange: LATIN}),
      loadFont({family: 'Inter', url: staticFile(`fonts/inter-latin-ext-${w}-normal.woff2`), weight: w, unicodeRange: LATIN_EXT}),
    ]).concat([
      loadFont({family: 'Inter Tight', url: staticFile('fonts/inter-tight-latin-800-normal.woff2'), weight: '800'}),
      loadFont({family: 'Inter Tight', url: staticFile('fonts/inter-tight-latin-900-normal.woff2'), weight: '900'}),
      loadFont({family: 'JetBrains Mono', url: staticFile('fonts/jetbrains-mono-latin-600-normal.woff2'), weight: '600'}),
      loadFont({family: 'JetBrains Mono', url: staticFile('fonts/jetbrains-mono-latin-700-normal.woff2'), weight: '700'}),
    ]),
  )
    .then(() => continueRender(handle))
    .catch((e) => {
      console.error(e);
      continueRender(handle);
    });
};
