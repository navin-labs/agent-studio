import React from 'react';
import {interpolate, useCurrentFrame} from 'remotion';
import {chunkWords, parseAccent, splitWords} from '../lib/text';
import {FONT, ZONES} from '../theme';
import {useTheme} from '../themes';

// Captions for each scene's vo, 3 to 5 words per line, in ink.
// Only *marked* words get the accent highlighter (research: selective highlights aid recall, karaoke distracts).
export const Captions: React.FC<{vo: string; starts: number[]; top?: number}> = ({vo, starts, top}) => {
  const th = useTheme();
  const frame = useCurrentFrame();
  const words = splitWords(vo);
  const accent = parseAccent(vo).map((w) => w.accent);
  if (!words.length || frame < starts[0] - 1) return null;
  const chunks = chunkWords(words, 5, 26);
  let ci = 0;
  chunks.forEach((c, i) => {
    if (starts[c.startIdx] <= frame) ci = i;
  });
  const chunk = chunks[ci];
  const pop = interpolate(frame - starts[chunk.startIdx], [0, 4], [0.9, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  return (
    <div
      style={{
        position: 'absolute',
        top: top ?? ZONES.captionTop,
        height: ZONES.captionHeight,
        left: 90,
        right: 90,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          columnGap: 18,
          fontFamily: FONT,
          fontSize: 58,
          fontWeight: 800,
          lineHeight: 1.12,
          letterSpacing: '-0.02em',
          textAlign: 'center',
          transform: `scale(${pop})`,
          color: th.ink,
        }}
      >
        {chunk.words.map((w, j) => {
          const idx = chunk.startIdx + j;
          // keywords get the highlighter swiped in (8 frames) as they appear
          const h = accent[idx] ? interpolate(frame - starts[idx], [0, 8], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}) : 0;
          return (
            <span key={idx} style={{display: 'inline-block', position: 'relative'}}>
              {h > 0 ? <span style={{position: 'absolute', left: -6, right: -6, top: '14%', bottom: '4%', background: th.accent, transformOrigin: '0 50%', transform: `scaleX(${h}) skewX(-6deg)`, borderRadius: 4}} /> : null}
              <span style={{position: 'relative', color: h > 0.5 ? th.onAccent : undefined}}>{w}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
};
