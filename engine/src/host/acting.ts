// Host acting maths, pure so it can be checked in Node (asserted in scripts/primitives.mjs). Bundled for the browser, so no Node-only code here.

// Mouth pulsed on caption word timings (used when there is no voice clip): one open-close per word.
export const mouthFromWords = (f: number, starts: number[]) =>
  starts.reduce((m, s, i) => {
    const len = Math.max(3, Math.min(8, (starts[i + 1] ?? s + 8) - s - 1));
    const t = f - s;
    return t >= 0 && t < len ? Math.max(m, Math.sin((Math.PI * t) / len) * 0.9) : m;
  }, 0);

// Blink about every 3 s (92 frames), 6 frames long; offset so frame 0 is eyes open.
export const BLINK_EVERY = 92;
export const blinkAt = (f: number) => {
  const t = (f + 17) % BLINK_EVERY;
  return t < 6 ? Math.sin((Math.PI * t) / 6) : 0;
};

// Loudness (0..1 waveform amplitude) to mouth opening, with a noise floor.
export const mouthFromAmplitude = (amp: number) => Math.min(1, Math.max(0, (amp - 0.03) * 5));
