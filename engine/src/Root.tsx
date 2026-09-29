import React from 'react';
import {CalculateMetadataFunction, Composition, Still} from 'remotion';
import exampleDeck from '../content/carousels/example-mis-signs.json';
import exampleReel from '../content/reels/example-invoice-reminders.json';
import exampleStory from '../content/stories/story-invoice-chase.json';
import {SlideView} from './carousel/Slide';
import {computeFrames, FPS} from './lib/timing';
import {Reel} from './reel/Reel';
import {Story} from './story/Story';
import {REEL, SLIDE} from './theme';
import type {CarouselDeck, ReelProps, ReelScript, SlideProps} from './types';

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
      id="Reel"
      component={Reel}
      width={REEL.w}
      height={REEL.h}
      fps={FPS}
      durationInFrames={300}
      defaultProps={{script: exampleReel as unknown as ReelScript} satisfies ReelProps}
      calculateMetadata={calculateReel}
    />
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
    <Still
      id="Slide"
      component={SlideView}
      width={SLIDE.w}
      height={SLIDE.h}
      defaultProps={{deck: exampleDeck as unknown as CarouselDeck, index: 0} satisfies SlideProps}
    />
  </>
);
