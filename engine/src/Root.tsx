import React from 'react';
import {CalculateMetadataFunction, Composition, Still} from 'remotion';
import exampleStory from '../content/stories/story-invoice-chase.json';
import {BOARD_SHEET, BoardSheet, boardSheetHeight} from './composer/BoardSheet';
import {Composer, type ComposerProps} from './composer/Composer';
import {sceneFrames, type Storyboard} from './composer/storyboard';
import exampleBoard from '../content/storyboards/order-emails.json';
import {computeFrames, FPS} from './lib/timing';
import {ConceptSheet, type ConceptProps} from './host/ConceptSheet';
import {ContactSheet, type PreviewProps, PrimitiveVideo, SHEET, shotFrames} from './primitives/Preview';
import {Story} from './story/Story';
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
    <Still id="MascotConcept" component={ConceptSheet} width={REEL.w} height={REEL.h} defaultProps={{concept: 0} satisfies ConceptProps} />
    <Composition id="ContactSheet" component={ContactSheet} width={SHEET.w} height={SHEET.h} fps={FPS} durationInFrames={90} defaultProps={{id: 'flow-run'} satisfies PreviewProps} calculateMetadata={({props}) => ({durationInFrames: shotFrames(props)})} />
  </>
);
