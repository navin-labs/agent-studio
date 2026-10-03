// Contact sheet for a rendered storyboard: the real Composer frozen at the middle of each scene, 4 across.
// Rendered by make.mjs next to each variant's video (<prefix>.contact.png) with the same props, so it shows exactly what QA and Navin approve.
import React from 'react';
import {AbsoluteFill, Freeze} from 'remotion';
import {TYPE} from '../theme';
import {THEMES} from '../themes';
import {Composer, type ComposerProps} from './Composer';
import {sceneFrames} from './storyboard';

export const BOARD_SHEET = {w: 1120, tileW: 262, tileH: 466, head: 60, label: 30, gap: 12};
export const boardSheetHeight = (scenes: number) => BOARD_SHEET.head + Math.ceil(scenes / 4) * (BOARD_SHEET.tileH + BOARD_SHEET.label + BOARD_SHEET.gap) + 16;
export const sceneMids = (p: ComposerProps) => {
  const frames = p.frames ?? sceneFrames(p.script, p.timing);
  return frames.map((f, i) => frames.slice(0, i).reduce((a, b) => a + b, 0) + Math.floor(f / 2));
};

export const BoardSheet: React.FC<ComposerProps> = (p) => {
  const th = THEMES.paper;
  const frames = p.frames ?? sceneFrames(p.script, p.timing);
  const secs = frames.reduce((a, b) => a + b, 0) / 30;
  return (
    <AbsoluteFill style={{background: th.surface, padding: 16, color: th.ink, fontFamily: TYPE.data}}>
      <div style={{fontSize: 26, fontWeight: 700, height: BOARD_SHEET.head - 16}}>
        {p.script.id} · {p.script.theme ?? 'paper'} · {secs.toFixed(1)}s · {p.script.scenes.length} scenes
      </div>
      <div style={{display: 'grid', gridTemplateColumns: `repeat(4, ${BOARD_SHEET.tileW}px)`, gap: BOARD_SHEET.gap}}>
        {sceneMids(p).map((fr, i) => (
          <div key={i}>
            <div style={{width: BOARD_SHEET.tileW, height: BOARD_SHEET.tileH, overflow: 'hidden', border: `2px solid ${th.ink}`, position: 'relative'}}>
              <div style={{width: 1080, height: 1920, transform: `scale(${BOARD_SHEET.tileW / 1080})`, transformOrigin: '0 0', position: 'absolute'}}>
                <Freeze frame={fr}>
                  <Composer {...p} frames={frames} />
                </Freeze>
              </div>
            </div>
            <div style={{fontSize: 18, height: BOARD_SHEET.label, paddingTop: 4}}>
              {i + 1}. {p.script.scenes[i].primitive}
            </div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
