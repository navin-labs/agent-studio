import React from 'react';
import {interpolate, useVideoConfig} from 'remotion';
import {springAt, useF} from '../lib/frame';
import {heroSize, parseAccent} from '../lib/text';
import {C, FONT} from '../theme';

// Big kinetic headline. Each word lands when it is spoken (starts[] = frame per word).
export const HeroText: React.FC<{
  text: string;
  starts?: number[];
  size?: number;
  align?: 'center' | 'left';
  maxWidth?: number;
  color?: string;
}> = ({text, starts, size, align = 'center', maxWidth = 900, color = C.text}) => {
  const frame = useF();
  const {fps} = useVideoConfig();
  // "\n" in the text forces a line break; each line wraps in a balanced way on its own
  const lines = text.split('\n').map((l) => parseAccent(l));
  const fontSize = size ?? heroSize(text.replace(/\n/g, ' '));
  let idx = 0;
  return (
    <div
      style={{
        maxWidth,
        fontFamily: FONT,
        fontSize,
        fontWeight: 800,
        lineHeight: 1.08,
        letterSpacing: '-0.035em',
        color,
        textAlign: align,
      }}
    >
      {lines.map((words, li) => (
        <div key={li} style={{textWrap: 'balance'}}>
          {words.map((w, wi) => {
            const i = idx++;
            const at = starts?.[i] ?? i * 4;
            const p = springAt(frame, at, fps, {damping: 14, stiffness: 210, mass: 0.6});
            const u = springAt(frame, at + 4, fps, {damping: 20, stiffness: 160});
            return (
              <React.Fragment key={wi}>
                <span
                  style={{
                    position: 'relative',
                    display: 'inline-block',
                    color: w.accent ? C.accent : color,
                    opacity: p,
                    transform: `translateY(${interpolate(p, [0, 1], [fontSize * 0.35, 0])}px) scale(${0.92 + 0.08 * p})`,
                  }}
                >
                  {w.w}
                  {w.accent ? (
                    <span
                      style={{
                        position: 'absolute',
                        left: 0,
                        right: words[wi + 1]?.accent ? -fontSize * 0.25 : 0,
                        bottom: -fontSize * 0.02,
                        height: fontSize * 0.075,
                        borderRadius: fontSize * 0.04,
                        background: C.accent,
                        transform: `scaleX(${u})`,
                        transformOrigin: 'left center',
                        opacity: 0.9,
                      }}
                    />
                  ) : null}
                </span>
                {wi < words.length - 1 ? ' ' : null}
              </React.Fragment>
            );
          })}
        </div>
      ))}
    </div>
  );
};

// Map hero words onto spoken word timings. Same count: exact. Otherwise: spread across the first 70% of the VO.
export const heroStarts = (heroText: string, voStarts: number[], lead: number, span: number) => {
  const n = parseAccent(heroText).length;
  if (n === voStarts.length) return voStarts;
  const s = (span * 0.7) / Math.max(1, n);
  return Array.from({length: n}, (_, i) => Math.round(lead + i * s));
};
