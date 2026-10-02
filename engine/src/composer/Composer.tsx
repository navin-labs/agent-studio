// Composer: storyboard -> one video. Each scene is a primitive shot in its own Sequence, with its vo as captions,
// its *accent* words as cue frames, and a transition into it (cut, whip-pan or ink-wipe).
import {CameraMotionBlur} from '@remotion/motion-blur';
import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {AbsoluteFill, Artifact, Audio, continueRender, delayRender, Easing, getRemotionEnvironment, Sequence, staticFile, useCurrentFrame} from 'remotion';
import {ensureFonts} from '../fonts';
import {Sfx, SfxEnabled} from '../lib/frame';
import {pixelWipePath} from '../lib/pixels';
import {LEAD} from '../lib/timing';
import {prog} from '../primitives/atoms';
import {PRIMITIVES} from '../primitives/index';
import {HostCtx, KaraokeCaptions, VoiceCtx} from '../host/Host';
import {Captions} from '../story/Captions';
import {HANDLE} from '../theme';
import {HandleCtx, THEMES, ThemeCtx, useTheme} from '../themes';
import type {TextBox} from './textcheck';
import {captionsOn, probeFrames, sceneCues, sceneFrames, type Storyboard, type StoryboardScene, type Timing, TRANSITION_FRAMES as T, type Transition, voWordStarts} from './storyboard';

ensureFonts();

export type ComposerProps = {script: Storyboard; timing?: Timing; frames?: number[]};

const WHIP = Easing.bezier(0.75, 0, 0.25, 1);
const CAPTION_TOP = 1120; // just under the primitives' stage band (y 280 to 1080)

// The moving part of a scene: shot + captions, shifted or clipped by the transitions at its edges.
const Moving: React.FC<{sb: Storyboard; sc: StoryboardScene; i: number; dur: number; exit: Transition; timing?: Timing}> = ({sb, sc, i, dur, exit, timing}) => {
  const th = useTheme();
  const f = useCurrentFrame();
  const enter = sc.transition ?? 'cut';
  const e = enter === 'cut' ? 1 : prog(f, 0, T, WHIP);
  const x = exit === 'whip-pan' ? prog(f, dur, T, WHIP) : 0;
  const Shot = PRIMITIVES[sc.primitive];
  const style: React.CSSProperties =
    enter === 'ink-wipe' && e < 1
      ? {clipPath: `inset(${(1 - e) * 100}% 0 0 0)`}
      : enter === 'pixel-wipe' && e < 1
        ? {clipPath: `path('${pixelWipePath(e)}')`}
        : {transform: `translateX(${(enter === 'whip-pan' ? 1080 * (1 - e) : 0) - 1080 * x}px)`};
  return (
    <AbsoluteFill style={style} data-scene={i} data-primitive={sc.primitive}>
      <Shot p={sc.params} dur={dur} cues={sceneCues(sc, i, timing)} />
      {sc.vo && captionsOn(sc, sb) ? (sb.captionStyle === 'karaoke' ? <KaraokeCaptions vo={sc.vo} starts={voWordStarts(sc, i, timing)} /> : <Captions vo={sc.vo} starts={voWordStarts(sc, i, timing)} top={CAPTION_TOP} />) : null}
      {enter === 'ink-wipe' && e < 1 ? <div style={{position: 'absolute', left: 0, right: 0, top: (1 - e) * 1920, height: 40, background: th.ink}} /> : null}
    </AbsoluteFill>
  );
};

const Scene: React.FC<{sb: Storyboard; sc: StoryboardScene; i: number; dur: number; exit: Transition; timing?: Timing}> = (props) => {
  const f = useCurrentFrame();
  const enter = props.sc.transition ?? 'cut';
  const whipping = (enter === 'whip-pan' && f < T) || (props.exit === 'whip-pan' && f >= props.dur);
  const audio = props.timing?.audio?.[props.i];
  // the host lip-syncs to this scene's voice (or its caption timing when silent)
  return (
    <VoiceCtx.Provider value={{starts: voWordStarts(props.sc, props.i, props.timing), audio}}>
    <AbsoluteFill>
      {whipping ? (
        <CameraMotionBlur samples={8} shutterAngle={240}>
          <Moving {...props} />
        </CameraMotionBlur>
      ) : (
        <Moving {...props} />
      )}
      {enter !== 'cut' ? <Sfx at={0} name="whoosh" volume={0.35} /> : null}
      {audio ? (
        <Sequence from={LEAD} layout="none">
          <Audio src={staticFile(audio)} />
        </Sequence>
      ) : null}
    </AbsoluteFill>
    </VoiceCtx.Provider>
  );
};

// ---- text box probe: on sampled frames of a render, measure every visible text block and emit it as a Remotion Artifact ----
const opacityOf = (el: Element, root: Element) => {
  let o = 1;
  for (let e: Element | null = el; e && e !== root.parentElement; e = e.parentElement) o *= Number(getComputedStyle(e).opacity);
  return o;
};

const measure = (): TextBox[] => {
  const out: TextBox[] = [];
  document.querySelectorAll<HTMLElement>('[data-scene]').forEach((root) => {
    const groups = new Map<Element, {rects: DOMRect[]; parts: string[]}>();
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      const el = n.parentElement;
      if (!el || !n.textContent?.trim() || el.closest('[data-tb-skip]') || opacityOf(el, root) < 0.5) continue;
      const r = document.createRange();
      r.selectNodeContents(n);
      const rects = [...r.getClientRects()].filter((q) => q.width > 0 && q.height > 0);
      if (!rects.length) continue;
      const key = el.closest('[data-tb]') ?? el; // a tagged block (headline, caption...) is one box
      const g = groups.get(key) ?? {rects: [], parts: []};
      g.rects.push(...rects);
      g.parts.push(n.textContent.trim());
      groups.set(key, g);
    }
    for (const [el, g] of groups) {
      let l = Math.min(...g.rects.map((q) => q.left));
      let t = Math.min(...g.rects.map((q) => q.top));
      let r = Math.max(...g.rects.map((q) => q.right));
      let b = Math.max(...g.rects.map((q) => q.bottom));
      // only what is actually visible counts: trim to every clipping ancestor (overflow hidden), then to the frame.
      // Trimmed text is 'cut' (an error) unless it sits in a scroll area where sliding out of view is intended.
      const full = r - l + (b - t);
      for (let a = el.parentElement; a && a !== root.parentElement; a = a.parentElement) {
        if (getComputedStyle(a).overflow === 'visible') continue;
        const c = a.getBoundingClientRect();
        [l, t, r, b] = [Math.max(l, c.left), Math.max(t, c.top), Math.min(r, c.right), Math.min(b, c.bottom)];
      }
      const cut = r > l && b > t && full - (r - l + (b - t)) > 2 && !el.closest('[data-tb-scroll]');
      [l, t, r, b] = [Math.max(l, 0), Math.max(t, 0), Math.min(r, 1080), Math.min(b, 1920)];
      if (r - l < 1 || b - t < 1) continue; // fully clipped or off-frame: not visible
      const [x, y, w, h] = [l, t, r - l, b - t];
      const c = el.closest('[data-box]')?.getBoundingClientRect();
      out.push({
        scene: Number(root.dataset.scene),
        primitive: root.dataset.primitive ?? '',
        role: (el as HTMLElement).dataset.tb ?? 'text',
        text: g.parts.join(' ').slice(0, 60),
        x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h),
        ...(c ? {box: {x: Math.round(c.left), y: Math.round(c.top), w: Math.round(c.width), h: Math.round(c.height)}} : {}),
        ...(cut ? {cut: true} : {}),
      });
    }
  });
  return out;
};

// Emits text-boxes-<frame>.json via <Artifact>; make.mjs collects them with onArtifact.
const TextProbe: React.FC<{frames: Set<number>}> = ({frames}) => {
  const f = useCurrentFrame();
  const on = getRemotionEnvironment().isRendering && frames.has(f);
  const [data, setData] = useState<{frame: number; json: string} | null>(null);
  const pending = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (!on) return;
    pending.current = delayRender(`measuring text at frame ${f}`);
    document.fonts.ready.then(() => setData({frame: f, json: JSON.stringify({frame: f, boxes: measure()})})); // real fonts only
  }, [on, f]);
  useEffect(() => {
    // runs after the Artifact below has mounted for this frame
    if (data?.frame === f && pending.current !== null) continueRender(pending.current), (pending.current = null);
  }, [data, f]);
  return on && data?.frame === f ? <Artifact filename={`text-boxes-${f}.json`} content={data.json} /> : null;
};

export const Composer: React.FC<ComposerProps> = ({script, timing, frames: given}) => {
  const th = THEMES[script.theme ?? 'paper'];
  if (!th) throw new Error(`Unknown theme "${script.theme}". Use one of: ${Object.keys(THEMES).join(', ')}`);
  const frames = given ?? sceneFrames(script, timing);
  const starts = frames.map((_, i) => frames.slice(0, i).reduce((a, b) => a + b, 0));
  return (
    <ThemeCtx.Provider value={th}>
      <HandleCtx.Provider value={script.handle ?? HANDLE}>
      <HostCtx.Provider value={script.host ?? 'chiku'}>
      <SfxEnabled.Provider value={script.sfx !== false}>
        <AbsoluteFill style={{background: th.bg}}>
          {script.scenes.map((sc, i) => {
            const exit = script.scenes[i + 1]?.transition ?? 'cut';
            // the outgoing scene keeps playing under the incoming one for the transition
            return (
              <Sequence key={i} from={starts[i]} durationInFrames={frames[i] + (exit === 'cut' ? 0 : T)}>
                <Scene sb={script} sc={sc} i={i} dur={frames[i]} exit={exit} timing={timing} />
              </Sequence>
            );
          })}
          <TextProbe frames={probeFrames(script, frames, starts)} />
        </AbsoluteFill>
      </SfxEnabled.Provider>
      </HostCtx.Provider>
      </HandleCtx.Provider>
    </ThemeCtx.Provider>
  );
};
