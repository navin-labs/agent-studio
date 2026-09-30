// Pixel-dissolve geometry, pure so it can be checked in Node (asserted in scripts/primitives.mjs).
export const PIXEL = 120; // block size: 9 x 16 blocks on a 1080 x 1920 frame

// Stable pseudo-random in [0, 1) per block, so every render dissolves in the same order.
const noise = (i: number) => {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

// SVG/CSS path of the blocks visible at progress e (0 = none, 1 = all). Each block appears once e passes its threshold.
export const pixelWipePath = (e: number, w = 1080, h = 1920) => {
  const cols = Math.ceil(w / PIXEL);
  const rows = Math.ceil(h / PIXEL);
  let d = '';
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) if (e >= 1 || e > noise(r * cols + c) * 0.9) d += `M${c * PIXEL} ${r * PIXEL}h${PIXEL}v${PIXEL}h-${PIXEL}z`;
  return d || 'M0 0z';
};
