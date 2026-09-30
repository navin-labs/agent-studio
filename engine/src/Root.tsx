import React from 'react';
import {CalculateMetadataFunction, Composition} from 'remotion';
import exampleStory from '../content/stories/story-invoice-chase.json';
import {computeFrames, FPS} from './lib/timing';
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
      id="Primitive"
      component={PrimitiveVideo}
      width={REEL.w}
      height={REEL.h}
      fps={FPS}
      durationInFrames={90}
      defaultProps={{id: 'flow-run'} satisfies PreviewProps}
      calculateMetadata={({props}) => ({durationInFrames: shotFrames(props)})}
    />
    <Composition id="ContactSheet" component={ContactSheet} width={SHEET.w} height={SHEET.h} fps={FPS} durationInFrames={90} defaultProps={{id: 'flow-run'} satisfies PreviewProps} calculateMetadata={({props}) => ({durationInFrames: shotFrames(props)})} />
  </>
);
