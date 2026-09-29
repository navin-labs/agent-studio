import React from 'react';
import {AbsoluteFill, Audio, interpolate, Sequence, Series, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {ensureFonts} from '../fonts';
import {Sfx, SfxEnabled} from '../lib/frame';
import {splitWords, wordStarts} from '../lib/text';
import {captionsOn, computeFrames, LEAD, TEXT_SCENES as TEXT_TYPES, voSpanFrames} from '../lib/timing';
import {REEL, ZONES} from '../theme';
import type {ReelProps, Scene} from '../types';
import {ChatCard} from '../ui/ChatCard';
import {FlowDiagram} from '../ui/FlowDiagram';
import {InboxCard} from '../ui/InboxCard';
import {MathCard} from '../ui/MathCard';
import {NotifyStack} from '../ui/NotifyStack';
import {SheetCard} from '../ui/SheetCard';
import {uiHeight} from '../ui/sizes';
import {StepsList} from '../ui/StepsList';
import {Captions} from './Captions';
import {Background, Kicker, ProgressBar} from './Chrome';
import {heroStarts} from './HeroText';
import {CtaScene, HookScene, MythScene} from './TextScenes';

ensureFonts();

const visualHeight = (s: Scene): number =>
  TEXT_TYPES.has(s.type) ? ZONES.heroHeight : uiHeight({...(s as object), kind: s.type} as Parameters<typeof uiHeight>[0]);

// Frame of the first spoken word matching `re`, capped so the animation finishes inside the scene.
const cueAt = (vo: string, starts: number[], re: RegExp, cap: number) => {
  const idx = splitWords(vo).findIndex((w) => re.test(w));
  return idx >= 0 ? Math.min(starts[idx], cap) : undefined;
};

const Visual: React.FC<{scene: Scene; starts: number[]; span: number}> = ({scene: s, starts, span}) => {
  const cap = LEAD + Math.round(span * 0.75);
  switch (s.type) {
    case 'inbox':
      return <InboxCard emails={s.emails} sorted={s.sorted} label={s.label} />;
    case 'sheet':
      return (
        <SheetCard
          file={s.file}
          columns={s.columns}
          rows={s.rows}
          highlight={s.highlight}
          fill={s.fill}
          highlightAt={cueAt(s.vo, starts, /overdue|late|pending|error|missing|unpaid|wrong|mistake|mismatch/i, cap)}
        />
      );
    case 'chat':
      return <ChatCard contact={s.contact} status={s.status} messages={s.messages} pace={span} />;
    case 'steps':
      return <StepsList steps={s.steps} strike={s.strike} pace={span} strikeAt={LEAD + Math.round(span * 0.7)} />;
    case 'flow':
      return <FlowDiagram nodes={s.nodes} pace={span} />;
    case 'notify':
      return <NotifyStack items={s.items} pace={span} />;
    case 'math':
      return <MathCard lines={s.lines} total={s.total} note={s.note} />;
    default:
      return null;
  }
};

const SceneShell: React.FC<{props: ReelProps; index: number; frames: number[]}> = ({props, index, frames}) => {
  const frame = useCurrentFrame();
  const scene = props.script.scenes[index];
  const dur = frames[index];
  const span = voSpanFrames(props, index);
  const starts = wordStarts(scene.vo, LEAD, span);
  const audio = props.timing?.audio?.[index] ?? null;
  const opacity = interpolate(frame, [0, 4, dur - 4, dur], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const scale = interpolate(frame, [0, 8], [0.985, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  let body: React.ReactNode;
  if (scene.type === 'hook' || scene.type === 'statement') {
    const hs = heroStarts(scene.text, starts, LEAD, span);
    body = <HookScene text={scene.text} sub={scene.sub} starts={hs} lastWord={hs[hs.length - 1] ?? 0} calm={scene.type === 'statement'} />;
  } else if (scene.type === 'myth') {
    body = <MythScene myth={scene.myth} reality={scene.reality} vo={scene.vo} starts={starts} span={span} />;
  } else if (scene.type === 'cta') {
    body = <CtaScene text={scene.text} sub={scene.sub} />;
  } else {
    const h = visualHeight(scene);
    const fit = Math.min(1, ZONES.heroHeight / h);
    body = (
      <>
        <Kicker kicker={scene.kicker} title={scene.title} />
        <div
          style={{
            position: 'absolute',
            top: ZONES.heroTop,
            height: ZONES.heroHeight,
            left: 0,
            right: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{transform: `scale(${fit})`, transformOrigin: 'center center'}}>
            <Visual scene={scene} starts={starts} span={span} />
          </div>
        </div>
      </>
    );
  }

  return (
    <AbsoluteFill style={{opacity, transform: `scale(${scale})`}}>
      {body}
      {captionsOn(scene) && splitWords(scene.vo).length ? <Captions vo={scene.vo} starts={starts} /> : null}
      {audio ? (
        <Sequence from={LEAD} layout="none">
          <Audio src={staticFile(audio)} />
        </Sequence>
      ) : null}
      {index > 0 ? <Sfx at={0} name="whoosh" /> : null}
    </AbsoluteFill>
  );
};

export const Reel: React.FC<ReelProps> = (props) => {
  const {durationInFrames} = useVideoConfig();
  const frames = props.frames ?? computeFrames(props);
  const music = props.timing?.music ?? null;
  return (
    <SfxEnabled.Provider value={props.script.sfx !== false}>
      <AbsoluteFill style={{width: REEL.w, height: REEL.h}}>
        <Background />
        <Series>
          {props.script.scenes.map((_, i) => (
            <Series.Sequence key={i} durationInFrames={frames[i]}>
              <SceneShell props={props} index={i} frames={frames} />
            </Series.Sequence>
          ))}
        </Series>
        <ProgressBar frames={frames} />
        {music ? (
          <Audio
            src={staticFile(music)}
            loop
            volume={(f) =>
              interpolate(f, [0, 15, durationInFrames - 30, durationInFrames], [0, 0.07, 0.07, 0], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              })
            }
          />
        ) : null}
      </AbsoluteFill>
    </SfxEnabled.Provider>
  );
};
