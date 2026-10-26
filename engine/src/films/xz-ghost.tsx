// Film "xz-ghost", the GitHub showcase: the 500 ms SSH ghost (CVE-2024-3094), from Andres Freund's oss-security advisory of
// 29 March 2024. Seven documentary shots, each a CinematicComposite (composer/CinematicComposite.tsx): a real photographic
// plate or archive clip from the media hub (meta.plates, src/lib/mediaHub.ts), graded and moved by the router's rig
// (meta.rig, studio/router.ts), an illustrated overlay that carries the metaphor (a heartbeat that stalls, two beams racing,
// an X-ray lens, a scan band through the crates, a spotlight, pins lifting, a stopwatch hand cutting a red ring), one hero
// number or one verbatim quote from the advisory, and broadcast chrome. A silent closing beat holds the channel's bumper; the
// music bed ducks 10 dB under every line. Every colour is a theme token.
import React from 'react';
import {Audio, Sequence, staticFile} from 'remotion';
import {BRAND_AUDIO} from '../composer/brand-audio';
import {type Artifact, CinematicComposite, type Grade, type Hero, type Move, type PlateRef} from '../composer/CinematicComposite';
import {FPS} from '../lib/timing';
import {Beams, Heartbeat, Lens, type O, Pins, RingCut, ScanBand, Spotlight, stallAt} from '../composer/overlays';
import {useTheme} from '../themes';
import {k, Score, useFilm} from './kit';

const SOURCE = 'SOURCE  A. FREUND · OSS-SECURITY · 29 MAR 2024';
const QUOTE_SOURCE = 'A. FREUND · OSS-SECURITY · 29.03.2024';

type Shot = {overlay: React.FC<O>; hero?: Hero & {at?: (d: number) => number}; artifact?: Artifact & {at?: number}};
const SHOTS: Shot[] = [
  {overlay: Heartbeat, hero: {value: '0.5', unit: 's', label: 'the stall', at: stallAt}},
  {overlay: Beams, hero: {value: '0.807', unit: 's', label: 'was 0.299 s', at: (d) => d * 0.35}},
  {overlay: Lens, artifact: {quote: 'logins with ssh taking a lot of CPU', source: QUOTE_SOURCE}},
  {overlay: ScanBand, artifact: {quote: 'present in the tarballs released upstream', source: QUOTE_SOURCE, at: 1.2}},
  {overlay: Spotlight, hero: {value: '2', unit: 'years', label: 'Jia Tan', at: (d) => d * 0.45}},
  {overlay: Pins, artifact: {quote: 'changes the value of RSA_public_decrypt', source: QUOTE_SOURCE, at: 1}},
  {overlay: RingCut, hero: {value: '500', unit: 'ms', label: 'two years undone', at: (d) => d * 0.5}},
];

type Meta = {plates?: PlateRef[]; rig?: {moves?: Move[]; grade?: Grade}};

export const Film: React.FC = () => {
  const th = useTheme();
  const {t, beats, total, script} = useFilm();
  const meta = (script.meta ?? {}) as Meta;
  const i = Math.max(0, beats.findIndex((b) => t >= b.start && t < b.end));
  const n = Math.min(i, SHOTS.length - 1); // the silent closer keeps the last shot running under the bumper
  const b = beats[n];
  const end = beats[Math.min(i, beats.length - 1)].end;
  const lt = t - b.start, d = end - b.start;
  const shot = SHOTS[n];
  const plate = meta.plates?.[n] ?? {src: 'brand/mark.png', kind: 'image' as const};
  const Overlay = shot.overlay;
  const vo = script.scenes[n].vo ?? '';
  const words = b.words?.map((w) => ({s: w.s - b.start}));
  const brand = BRAND_AUDIO['c1-automation'];
  const talk = beats.filter((x) => x.vo).map((x) => x.vo!);
  const lastVo = talk.at(-1)?.[1] ?? total;
  return (
    <>
      <CinematicComposite
        t={lt}
        d={d}
        seed={n}
        plate={plate}
        move={meta.rig?.moves?.[n] ?? 'ken-burns'}
        grade={meta.rig?.grade ?? 'teal-orange'}
        atmos={n % 2 ? ['grain', 'scanlines'] : ['grain', 'flare']}
        flareY={n === 0 ? 1060 : 700}
        hero={shot.hero ? {...shot.hero, at: shot.hero.at?.(d)} : undefined}
        artifact={shot.artifact}
        chrome={{caseTag: 'CASE CVE-2024-3094', citation: SOURCE, at: t}}
        caption={b.vo ? {vo, from: b.vo[0] - b.start, to: b.vo[1] - b.start, words} : undefined}
      >
        <Overlay t={lt} d={d} th={th} />
      </CinematicComposite>
      {/* a white flash on every cut */}
      <div style={{position: 'absolute', inset: 0, background: th.ink, opacity: n > 0 && i === n ? 0.3 * (1 - k(lt, [0, 0.2], [0, 1])) : 0}} />
      <Score src={brand.bed} base={-20} duck={10} talk={talk} shape={[[0, -12], [0.8, 0], [lastVo - 0.3, 0], [lastVo + 0.2, -40]]} />
      <Sequence from={Math.round(lastVo * FPS)} layout="none">
        <Audio src={staticFile(brand.bumper)} volume={0.35} />
      </Sequence>
    </>
  );
};
