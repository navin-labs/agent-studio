// One mascot concept on the stage, as a 1080x1920 still, for picking a channel's host.
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {ensureFonts} from '../fonts';
import {TYPE} from '../theme';
import {alpha, THEMES, ThemeCtx} from '../themes';
import {CONCEPTS, DitherDefs, Stage} from './mascots';

ensureFonts();

export type ConceptProps = {concept: number; mouth?: number; blink?: number; tilt?: number};

export const ConceptSheet: React.FC<ConceptProps> = ({concept, mouth, blink, tilt}) => {
  const th = THEMES.night;
  const c = CONCEPTS[concept];
  return (
    <ThemeCtx.Provider value={th}>
      <AbsoluteFill>
        <Stage />
        <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{position: 'absolute', inset: 0}}>
          <DitherDefs />
          <ellipse cx={540} cy={1275} rx={240} ry={34} fill={alpha(th.shadow, 0.6)} />
          <c.Mascot mouth={mouth} blink={blink} tilt={tilt} />
        </svg>
        <div style={{position: 'absolute', top: 300, left: 0, right: 0, textAlign: 'center', fontFamily: TYPE.data, fontSize: 30, fontWeight: 700, letterSpacing: '0.2em', color: th.muted}}>
          C1 HOST · CONCEPT {concept + 1}
        </div>
        <div style={{position: 'absolute', top: 1360, left: 0, right: 0, textAlign: 'center', fontFamily: TYPE.display, fontSize: 120, fontWeight: 900, letterSpacing: '-0.03em', color: th.ink}}>
          {c.name}
        </div>
        <div style={{position: 'absolute', top: 1520, left: 120, right: 120, textAlign: 'center', fontFamily: TYPE.caption, fontSize: 36, fontWeight: 600, lineHeight: 1.3, color: th.muted}}>{c.line}</div>
      </AbsoluteFill>
    </ThemeCtx.Provider>
  );
};
