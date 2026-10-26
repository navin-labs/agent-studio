// SceneFilm: renders a board's scene (storyboard "film": "scene") by placing each shot's effect on its voice beat, inside the
// shot's camera, under the film's look and captions. The Director writes the scene; nothing here is drawn per film.
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {Camera2D} from '../fx/camera';
import {FX, type Fx} from '../fx/registry';
import {type Shot, shotWindows} from '../fx/scene';
import {FPS} from '../lib/timing';
import {useTheme} from '../themes';
import {faceFor, PunchLine} from '../fx/retention';
import {Grain, useFilm} from './kit';
import {BlockProvider, type BlockId, BLOCKS, Ground} from '../fx/blocks';

const ShotView: React.FC<{s: Shot; fx: Fx; t: number; dur: number}> = ({s, fx, t, dur}) => {
  const p = {...fx.example, ...s.props};
  const body = <fx.Render t={t} dur={dur} p={p} />;
  // camera effects and primitives move their own camera unless the shot sets one; everything else sits in the 2D world camera
  const own = fx.layer === 'camera' || (s.fx.startsWith('prim:') && !s.camera);
  return own ? <AbsoluteFill>{body}</AbsoluteFill> : <Camera2D t={t} dur={dur} camera={s.camera}>{body}</Camera2D>;
};

export const SceneFilm: React.FC = () => {
  const {t, beats, script, total} = useFilm();
  const th = useTheme();
  if (!script.scene) throw new Error(`board ${script.id}: "film": "scene" needs a "scene"`);
  const shots = script.scene.shots;
  const win = shotWindows(shots, beats);
  const block = script.scene.look?.block as BlockId | undefined; // a style block (blocks.tsx): the moves' feel, type and ground
  const body = (
    <AbsoluteFill style={{background: th.bg, fontFamily: block ? BLOCKS[block].display : undefined, textTransform: block && BLOCKS[block].caps ? 'uppercase' : undefined}}>
      {block ? <Ground t={t} /> : null}
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
      {beats.flatMap((b, i) => (b.vo ? [{b, i}] : [])).map(({b, i}, n, all) => (
        <PunchLine key={i} t={t} at={b.vo![0]} end={(all[n + 1]?.b.start ?? total) - 0.1} vo={script.scenes[i].vo ?? b.text} starts={b.words?.map((w) => w.s)} dur={b.vo![1] - b.vo![0]} face={faceFor(script.id)} />
      ))}
    </AbsoluteFill>
  );
  return block ? <BlockProvider id={block}>{body}</BlockProvider> : body;
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
