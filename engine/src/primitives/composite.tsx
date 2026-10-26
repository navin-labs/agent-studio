import React from 'react';
import {useCurrentFrame} from 'remotion';
import {CinematicComposite, type Grade, type Move} from '../composer/CinematicComposite';
import {type ActionMode, blurFor, ObjectStage} from '../composer/ObjectStage';
import {OVERLAYS, type OverlayName} from '../composer/overlays';
import {WORLDS} from '../composer/worlds';
import {StoryCtx} from '../composer/story';
import {FPS} from '../lib/timing';
import {useTheme} from '../themes';
import {type PrimitiveProps, SceneCtx} from './atoms';

type P = {query: string; video?: boolean; hero?: string; unit?: string; label?: string; quote?: string; source?: string; move?: Move; overlay?: OverlayName | 'none'; objectNoun?: string; actionMode?: ActionMode};
const GRADES: Record<string, Grade> = {crt: 'mono-tint', film: 'warm-archive', print: 'warm-archive', tactical: 'cold', none: 'teal-orange'};

// A documentary shot (composer/CinematicComposite.tsx) inside a board: the plate make.mjs resolved for this scene, the style's
// grade and the router's move, the overlay, the hero or quote, and the board's chrome. The Composer draws the captions.
export const Composite: React.FC<PrimitiveProps<P>> = ({p, dur, cues}) => {
  const th = useTheme();
  const f = useCurrentFrame();
  const story = React.useContext(StoryCtx);
  const {index = 0} = React.useContext(SceneCtx);
  const plate = story.plates?.[index] ?? {src: 'brand/mark.png', kind: 'image' as const};
  const world = WORLDS[story.world ?? 'clean'];
  const t = Math.floor((f / FPS) * world.fps) / world.fps, d = dur / FPS; // the world's own frame rate
  const at = cues[0] !== undefined ? cues[0] / FPS : d * 0.3;
  const prop = story.objects?.[index];
  const Overlay = p.overlay && p.overlay !== 'none' ? OVERLAYS[p.overlay] : null;
  return (
    <world.Frame t={t} d={d} seed={index}>
    <CinematicComposite
      t={t}
      d={d}
      seed={index}
      plate={plate}
      move={p.move ?? (story.rig?.moves[index] as Move | undefined) ?? 'ken-burns'}
      grade={(story.rig?.grade as Grade | undefined) ?? GRADES[story.fx ?? 'none']}
      blur={blurFor(p.actionMode, t)}
      split={p.actionMode === 'split-action'}
      atmos={story.world && story.world !== 'clean' ? world.atmos : index % 2 ? ['grain', 'scanlines'] : ['grain', 'flare']}
      look={world.plate}
      chromeOn={world.chrome}
      hero={p.hero ? {value: p.hero, unit: p.unit, label: p.label, at} : undefined}
      artifact={p.quote ? {quote: p.quote, source: p.source ?? '', at} : undefined}
      chrome={{caseTag: story.caseTag, citation: story.citation, at: (story.starts[index] ?? 0) / FPS + t}}
    >
      {p.actionMode ? <ObjectStage mode={p.actionMode} src={prop} t={t} d={d} look={world.prop(th)} /> : null}
      {Overlay ? <Overlay t={t} d={d} th={th} /> : null}
    </CinematicComposite>
    </world.Frame>
  );
};
