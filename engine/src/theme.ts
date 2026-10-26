// Brand constants that are not colours. Colours live only in themes.ts.

// A format style (engine/styles/) swaps faces by setting these CSS variables on the Composer; unset, the fallbacks render as before.
export const FONT = "var(--font-body, 'Inter', system-ui, -apple-system, sans-serif)";

export const HANDLE = '@theautomationguynavin';

// Reel canvas (px)
export const REEL = {w: 1080, h: 1920};

// Caption band
export const ZONES = {captionTop: 1296, captionHeight: 190};
// Side margin for text: YouTube Shorts' button column covers the right 120 px; mirrored left so layouts stay centred.
// Text that can reach the edge sits at SIDE + 30: shots push in 6%, so x = 540 + (420 - pad) grows to 540 + (420 - pad) * 1.06, inside 960 only when pad >= 24.
export const SIDE = 120;

export const TYPE = {
  display: "var(--font-display, 'Inter Tight', 'Inter', sans-serif)", // 900, -4% tracking, 128-160px
  title: "var(--font-title, 'Inter Tight', 'Inter', sans-serif)", // 800, 64-80px
  caption: "var(--font-caption, 'Inter', sans-serif)", // 800, 58px
  data: "var(--font-data, 'JetBrains Mono', 'Inter', monospace)", // 600, 26-34px
  pixel: "'VT323', 'JetBrains Mono', monospace", // brand line in the host format (VT323 self-hosted, OFL)
};
