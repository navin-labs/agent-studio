// A channel's sound identity (scripts/brand_audio.py): a music bed under the voice and a 2 s sonic bumper that closes every video.
// Pure data, so storyboard.ts (timing) and the Composer (sound) agree on the bumper's length.
export const BUMPER_FRAMES = 60; // 2 s at 30 fps
export const BRAND_AUDIO: Record<string, {bed: string; bumper: string}> = {
  'c1-automation': {bed: 'brand/audio/c1-automation-bed.wav', bumper: 'brand/audio/c1-automation-bumper.wav'},
  'c2-reach': {bed: 'brand/audio/c2-reach-bed.wav', bumper: 'brand/audio/c2-reach-bumper.wav'},
};
