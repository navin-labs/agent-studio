// SceneFilm: renders a board's scene (storyboard "film": "scene") by placing each shot's effect on its voice beat, inside the
// shot's camera, under the film's look and captions. The Director writes the scene; nothing here is drawn per film.
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {Camera2D} from '../fx/camera';
import {FX, type Fx} from '../fx/registry';
import {type Shot, shotWindows} from '../fx/scene';
import {FPS} from '../lib/timing';
import {useTheme} from '../themes';
import {Captions, Grain, useFilm} from './kit';

const ShotView: React.FC<{s: Shot; fx: Fx; t: number; dur: number}> = ({s, fx, t, dur}) => {
  const p = {...fx.example, ...s.props};
  const body = <fx.Render t={t} dur={dur} p={p} />;
  // camera effects and primitives move their own camera unless the shot sets one; everything else sits in the 2D world camera
  const own = fx.layer === 'camera' || (s.fx.startsWith('prim:') && !s.camera);
  return own ? <AbsoluteFill>{body}</AbsoluteFill> : <Camera2D t={t} dur={dur} camera={s.camera}>{body}</Camera2D>;
};

export const SceneFilm: React.FC = () => {
  const {t, beats, script} = useFilm();
  const th = useTheme();
  if (!script.scene) throw new Error(`board ${script.id}: "film": "scene" needs a "scene"`);
  const shots = script.scene.shots;
  const win = shotWindows(shots, beats);
  return (
    <AbsoluteFill style={{background: th.bg}}>
      {shots.map((s, i) => {
        const fx = FX[s.fx];
        if (!fx) throw new Error(`scene.shots[${i}]: unknown effect "${s.fx}" (src/fx/registry.tsx)`);
        const [a, b] = win[i];
        const from = Math.round(a * FPS);
        return (
          <Sequence key={i} from={from} durationInFrames={Math.max(1, Math.round(b * FPS) - from)} layout="none">
            <ShotView s={s} fx={fx} t={t - a} dur={b - a} />
          </Sequence>
        );
      })}
      <Grain opacity={script.scene.look?.grain ?? 0.08} />
      <Captions style={{top: 1290, fontFamily: '"Inter Tight", Inter, sans-serif', fontWeight: 800, fontSize: 54, lineHeight: 1.15, color: th.ink}} />
    </AbsoluteFill>
  );
};

// One effect alone with its example props, for the gallery (scripts/fx-gallery.mjs): composition "fx-<id>".
export const FxPreview: React.FC<{id: string}> = ({id}) => {
  const fx = FX[id];
  const th = useTheme();
  const t = useCurrentFrame() / FPS;
  const dur = fx.seconds[1];
  return (
    <AbsoluteFill style={{background: th.bg}}>
      <ShotView s={{beat: 0, fx: id}} fx={fx} t={t} dur={dur} />
    </AbsoluteFill>
  );
};
