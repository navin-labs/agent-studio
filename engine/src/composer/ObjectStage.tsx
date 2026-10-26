// The literal prop of a scene (the noun in the sentence, drawn as a colour SVG) acting out one of five modes over the plate.
// No text: the plate carries the place, the prop carries the noun, the Composer's captions carry the voice.
//   missing-ghost      blurry POV; the prop drains away and leaves a pulsing dashed outline ("missing my glasses")
//   rack-focus-reveal  plate starts defocused and snaps sharp as the prop drops in
//   spotlight-search   a moving light searches the dark; the prop is found at the end
//   zoom-through       the camera pushes into the prop
//   split-action       plate split drained | live; the prop lands on the live side
import React from 'react';
import {Img, interpolate, spring, staticFile} from 'remotion';
import {FPS} from '../lib/timing';
import {alpha, useTheme} from '../themes';

export const ACTION_MODES = ['missing-ghost', 'rack-focus-reveal', 'spotlight-search', 'zoom-through', 'split-action'] as const;
export type ActionMode = (typeof ACTION_MODES)[number];
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

// plate defocus for the mode, in px
export const blurFor = (mode: ActionMode | undefined, t: number) =>
  mode === 'missing-ghost' ? interpolate(t, [0, 1.5], [2, 12], clamp) : mode === 'rack-focus-reveal' ? interpolate(t, [0, 0.9], [16, 0], clamp) : 0;

export const ObjectStage: React.FC<{mode: ActionMode; src?: string | null; t: number; d: number; look?: string}> = ({mode, src, t, d, look = ''}) => {
  const th = useTheme();
  const f = Math.round(t * FPS);
  const pop = spring({frame: f, fps: FPS, config: {damping: 12, stiffness: 160}});
  const sx = interpolate(t, [0, d * 0.33, d * 0.66, d], [25, 72, 38, 55], clamp);
  const sy = interpolate(t, [0, d * 0.33, d * 0.66, d], [60, 35, 70, 48], clamp);
  const found = mode === 'spotlight-search' ? interpolate(t, [d * 0.7, d * 0.85], [0, 1], clamp) : 1;
  const prop = (size: number, style: React.CSSProperties) => (src ? <Img src={staticFile(src)} style={{width: size, height: size, objectFit: 'contain', ...style, filter: `${look} ${style.filter ?? `drop-shadow(0 24px 40px ${alpha(th.shadow, 0.7)})`}`}} /> : null);
  const at: React.CSSProperties = {position: 'absolute', left: 0, right: 0, top: 380, height: 700, display: 'flex', justifyContent: mode === 'split-action' ? 'flex-end' : 'center', alignItems: 'center', paddingRight: mode === 'split-action' ? 110 : 0};
  return (
    <>
      {mode === 'spotlight-search' ? <div style={{position: 'absolute', inset: 0, background: `radial-gradient(circle 280px at ${sx}% ${sy}%, transparent 0%, ${alpha(th.shadow, 0.78)} 100%)`}} /> : null}
      <div style={at}>
        {mode === 'missing-ghost' ? (
          <div style={{width: 420, height: 420, borderRadius: '50%', border: `6px dashed ${alpha(th.ink, 0.85)}`, display: 'flex', justifyContent: 'center', alignItems: 'center', transform: `scale(${interpolate(Math.sin(f / 4), [-1, 1], [0.95, 1.06])})`}}>
            {prop(270, {opacity: interpolate(t, [0, 0.9], [0.9, 0.12], clamp), filter: 'grayscale(1)'})}
          </div>
        ) : mode === 'zoom-through' ? (
          prop(360, {transform: `scale(${interpolate(t, [0, d], [0.6, 3.4])})`, opacity: interpolate(t, [d * 0.8, d], [1, 0], clamp)})
        ) : mode === 'spotlight-search' ? (
          prop(380, {opacity: found, transform: `scale(${0.8 + 0.2 * found})`})
        ) : (
          prop(400, {transform: `scale(${pop}) translateY(${interpolate(pop, [0, 1], [-120, 0])}px)`})
        )}
      </div>
    </>
  );
};
