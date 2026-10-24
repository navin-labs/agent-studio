import React from 'react';
import {CalculateMetadataFunction, Composition, Still} from 'remotion';
import exampleStory from '../test/stories/story-invoice-chase.json';
import {BOARD_SHEET, BoardSheet, boardSheetHeight} from './composer/BoardSheet';
import {Composer, type ComposerProps} from './composer/Composer';
import {sceneFrames, type Storyboard} from './composer/storyboard';
import exampleBoard from '../test/boards/order-emails.json';
import {computeFrames, FPS} from './lib/timing';
import {ConceptSheet, type ConceptProps} from './host/ConceptSheet';
import {ContactSheet, type PreviewProps, PrimitiveVideo, SHEET, shotFrames} from './primitives/Preview';
import {Story} from './story/Story';
import {VelcroPoc} from './poc/Velcro';
import {StockPoc} from './poc/Stock';
import {SwissPoc} from './poc/Swiss';
import {GodownPoc} from './poc/Godown';
import {FX} from './fx/registry';
import {FxPreview} from './films/SceneFilm';
import {DUO_FRAMES, DuoVelcro} from './fx/demos/DuoVelcro';
import {NET_FRAMES, NetC1} from './fx/demos/NetC1';
import {FLAT_FRAMES, FlatVelcro} from './fx/demos/FlatVelcro';
import {ED_FRAMES, EdVelcro} from './fx/demos/EdVelcro';
import {THUMB, Thumbnail, type ThumbnailProps} from './thumbnail/Thumbnail';
import {REEL} from './theme';
import type {ReelProps, ReelScript} from './types';

const calculateReel: CalculateMetadataFunction<ReelProps> = ({props}) => {
  const frames = computeFrames(props);
  return {
    durationInFrames: frames.reduce((a, b) => a + b, 0),
    props: {...props, frames},
  };
};

export const Root: React.FC = () => (
  <>
    {/* POC (2026-10-07): authored scenes, not wired into the pipeline */}
    <Composition id="PocB1" component={VelcroPoc} width={1080} height={1920} fps={30} durationInFrames={907} />
    <Composition id="PocB2" component={SwissPoc} width={1080} height={1920} fps={30} durationInFrames={907} />
    <Composition id="PocC1" component={GodownPoc} width={1080} height={1920} fps={30} durationInFrames={1260} />
    <Composition id="PocC2" component={StockPoc} width={1080} height={1920} fps={30} durationInFrames={1260} />
    <Composition
      id="Story"
      component={Story}
      width={REEL.w}
      height={REEL.h}
      fps={FPS}
      durationInFrames={300}
      defaultProps={{script: exampleStory as unknown as ReelScript} satisfies ReelProps}
      calculateMetadata={calculateReel}
    />
    <Composition
      id="Composer"
      component={Composer}
      width={REEL.w}
      height={REEL.h}
      fps={FPS}
      durationInFrames={300}
      defaultProps={{script: exampleBoard as unknown as Storyboard} satisfies ComposerProps}
      calculateMetadata={({props}) => {
        const frames = sceneFrames(props.script, props.timing);
        return {durationInFrames: frames.reduce((a, b) => a + b, 0), props: {...props, frames}};
      }}
    />
    {/* full length (not a Still) so Freeze can reach any frame; make.mjs renders frame 0 */}
    <Composition
      id="BoardSheet"
      component={BoardSheet}
      width={BOARD_SHEET.w}
      height={1100}
      fps={FPS}
      durationInFrames={300}
      defaultProps={{script: exampleBoard as unknown as Storyboard} satisfies ComposerProps}
      calculateMetadata={({props}) => {
        const frames = sceneFrames(props.script, props.timing);
        return {durationInFrames: frames.reduce((a, b) => a + b, 0), height: boardSheetHeight(props.script.scenes.length), props: {...props, frames}};
      }}
    />
    <Composition
      id="Primitive"
      component={PrimitiveVideo}
      width={REEL.w}
      height={REEL.h}
      fps={FPS}
      durationInFrames={90}
      defaultProps={{id: 'flow-run'} satisfies PreviewProps}
      calculateMetadata={({props}) => ({durationInFrames: shotFrames(props)})}
    />
    <Still id="Thumbnail" component={Thumbnail} width={THUMB.w} height={THUMB.h} defaultProps={{text: 'Who drew the *first* barcode?', theme: 'archive', handle: '@backstory.minute'} satisfies ThumbnailProps} />
    <Still id="MascotConcept" component={ConceptSheet} width={REEL.w} height={REEL.h} defaultProps={{concept: 0} satisfies ConceptProps} />
    <Composition id="EdVelcro" component={EdVelcro} width={REEL.w} height={REEL.h} fps={FPS} durationInFrames={ED_FRAMES} />
    <Composition id="FlatVelcro" component={FlatVelcro} width={REEL.w} height={REEL.h} fps={FPS} durationInFrames={FLAT_FRAMES} />
    <Composition id="NetC1" component={NetC1} width={REEL.w} height={REEL.h} fps={FPS} durationInFrames={NET_FRAMES} />
    <Composition id="DuoVelcro" component={DuoVelcro} width={REEL.w} height={REEL.h} fps={FPS} durationInFrames={DUO_FRAMES} />
    {/* one composition per effect, for the gallery (scripts/fx-gallery.mjs) */}
    {Object.entries(FX).map(([id, fx]) => (
      <Composition key={id} id={`fx-${id.replace(':', '-')}`} component={FxPreview} width={REEL.w} height={REEL.h} fps={FPS} durationInFrames={Math.round(fx.seconds[1] * FPS)} defaultProps={{id}} />
    ))}
    <Composition id="ContactSheet" component={ContactSheet} width={SHEET.w} height={SHEET.h} fps={FPS} durationInFrames={90} defaultProps={{id: 'flow-run'} satisfies PreviewProps} calculateMetadata={({props}) => ({durationInFrames: shotFrames(props)})} />
  </>
);
