import React from 'react';
import {interpolate, useCurrentFrame} from 'remotion';
import {chunkWords, parseAccent, splitWords} from '../lib/text';
import {C, FONT, P, ZONES} from '../theme';

// Word-by-word captions for the voiceover. Active word turns blue.
// keywordsOnly: only *marked* words turn blue, no word-by-word karaoke (research: selective highlights aid recall, karaoke distracts).
export const Captions: React.FC<{vo: string; starts: number[]; keywordsOnly?: boolean; top?: number; paper?: boolean}> = ({vo, starts, keywordsOnly, top, paper}) => {
  const frame = useCurrentFrame();
  const words = splitWords(vo);
  const accent = parseAccent(vo).map((w) => w.accent);
  if (!words.length || frame < starts[0] - 1) return null;
  const chunks = paper ? chunkWords(words, 5, 26) : chunkWords(words); // tokens: 3-5 words per line
  let ci = 0;
  chunks.forEach((c, i) => {
    if (starts[c.startIdx] <= frame) ci = i;
  });
  const chunk = chunks[ci];
  const chunkStart = starts[chunk.startIdx];
  const pop = interpolate(frame - chunkStart, [0, 4], [0.9, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  let active = -1;
  starts.forEach((s, i) => {
    if (s <= frame) active = i;
  });

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
          fontSize: paper ? 58 : 66,
          fontWeight: paper ? 800 : 900,
          lineHeight: 1.12,
          letterSpacing: '-0.02em',
          textAlign: 'center',
          transform: `scale(${pop})`,
          textShadow: paper ? undefined : '0 6px 24px rgba(0,0,0,0.65)',
          color: paper ? P.ink : undefined,
        }}
      >
        {chunk.words.map((w, j) => {
          const idx = chunk.startIdx + j;
          const isActive = idx === active;
          const k = isActive ? interpolate(frame - starts[idx], [0, 3], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}) : 0;
          if (paper) {
            // Paper & Signal: ink words; keywords get a signal highlighter swiped in (8 frames) as they are spoken
            const h = accent[idx] ? interpolate(frame - starts[idx], [0, 8], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}) : 0;
            return (
              <span key={idx} style={{display: 'inline-block', position: 'relative'}}>
                {h > 0 ? <span style={{position: 'absolute', left: -6, right: -6, top: '14%', bottom: '4%', background: P.signal, transformOrigin: '0 50%', transform: `scaleX(${h}) skewX(-6deg)`, borderRadius: 4}} /> : null}
                <span style={{position: 'relative'}}>{w}</span>
              </span>
            );
          }
          return (
            <span
              key={idx}
              style={{
                display: 'inline-block',
                color: keywordsOnly ? (accent[idx] ? C.accent : C.text) : isActive ? C.accent : C.text,
                opacity: keywordsOnly || idx <= active ? 1 : 0.35,
                transform: keywordsOnly ? undefined : `scale(${1 + 0.07 * k})`,
              }}
            >
              {w}
            </span>
          );
        })}
      </div>
    </div>
  );
};
