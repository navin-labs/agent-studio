import React from 'react';
import {AbsoluteFill} from 'remotion';
import {ensureFonts} from '../fonts';
import {parseAccent} from '../lib/text';
import {TYPE} from '../theme';
import {THEMES, type ThemeName} from '../themes';

// YouTube thumbnail (1280x720) in the channel's theme: the hook as a big headline, *accent* words on the highlighter, the
// handle small. No logo: YouTube shows the channel picture next to it. make.mjs renders arm A (the hook) and, when the
// storyboard has meta.thumb_b, arm B for the title/thumbnail experiment (studio/experiment.ts).
export const THUMB = {w: 1280, h: 720};
export type ThumbnailProps = {text: string; theme?: ThemeName; handle?: string};

export const Thumbnail: React.FC<ThumbnailProps> = ({text, theme, handle}) => {
  ensureFonts();
  const th = THEMES[theme ?? 'paper'];
  const words = parseAccent(text);
  const size = text.length > 28 ? 104 : 128;
  return (
    <AbsoluteFill style={{background: th.bg, padding: '72px 88px', justifyContent: 'center'}}>
      <div style={{width: 120, height: 14, background: th.accent, marginBottom: 40}} />
      <div style={{fontFamily: TYPE.display, fontWeight: 900, fontSize: size, lineHeight: 1.02, letterSpacing: '-0.04em', color: th.ink, maxWidth: 1100}}>
        {words.map((w, i) => (
          <React.Fragment key={i}>
            {w.accent ? <span style={{background: th.accent, color: th.onAccent, padding: '0 12px', borderRadius: 8}}>{w.w}</span> : w.w}{' '}
          </React.Fragment>
        ))}
      </div>
      {handle ? <div style={{position: 'absolute', left: 88, bottom: 56, fontFamily: TYPE.data, fontWeight: 600, fontSize: 32, color: th.muted}}>{handle}</div> : null}
    </AbsoluteFill>
  );
};
