import type React from 'react';
// Style presets (docs/MOTION.md "Presets"): a channel's look and motion as data in styles/<id>.json, chosen per channel with one
// setting (channel.json "style"). The engine only knows the building blocks below; a new style is a new file, not new code.
// make.mjs loads the preset and hands it to the Composer as `preset` (render time, like the handle).

export const OPENERS = ['none', 'arrow-fold', 'year-flap'] as const; // the first 0.6 s of every video
export const OVERLAYS = ['none', 'thread', 'thread-paper'] as const; // drawn over the whole video (thread: in the reveal colour)

// Camera move per shot role, as a fraction of zoom: positive pushes in over the shot (eased in and out), negative starts
// pushed in and pulls out (eased out, done by 60% of the shot), 0 holds still. Left out: the legacy slow drift.
export type Camera = {pain: number; result: number; other: number};

export type StylePreset = {
  id: string;
  channel: string;
  version: number;
  about: string;
  expect?: string; // what this version should improve (shown with a Tier 2 proposal)
  theme: string;
  transitions: string[]; // what Recipe draws scene transitions from
  opener: (typeof OPENERS)[number];
  overlay: (typeof OVERLAYS)[number];
  camera?: Camera;
  strike: boolean; // before-after-split: strike through the manual steps, one pulse of `ok` on the automatic half
};

// A format style (engine/styles/<id>.json): a visual world any primitive board can wear with --style=<id> or "formatStyle".
// It sets the theme and faces (fonts loaded in src/fonts.ts), the spring, the caption case, how the camera moves on every shot
// (composer/look.tsx), the texture laid over the frame, what the host does, and the voice pace. Channel presets above still
// give the platforms and CTAs.
export const CAMERA_MODES = ['still', '3d-tilt', 'whip-pan', 'kinetic-punch', 'handheld-doc'] as const;
export const FX_OVERLAYS = ['none', 'crt', 'print', 'film', 'tactical'] as const;
export const HOST_MODES = ['keep', 'tint', 'hide'] as const;
export type FormatStyle = {
  id: string;
  name: string;
  about: string;
  theme: string;
  fonts: {display: string; title: string; caption: string; data: string};
  spring: {damping: number; stiffness: number; mass: number};
  caption: {case: 'none' | 'uppercase' | 'lowercase'};
  cameraMode: (typeof CAMERA_MODES)[number];
  fxOverlay: (typeof FX_OVERLAYS)[number];
  hostMode: (typeof HOST_MODES)[number];
  pace: 'steady' | 'quick'; // the voice speed for lines that set none (make.mjs PACE)
  fits: string[]; // the primitives this look was tuned on
};

const face = (f: string, fallback: string) => `'${f}', ${fallback}`;
// the CSS variables TYPE and FONT read (src/theme.ts); font-synthesis off so a one-weight face is never faux-bolded
export const styleVars = (s?: FormatStyle): React.CSSProperties =>
  s
    ? ({
        '--font-display': face(s.fonts.display, 'sans-serif'),
        '--font-title': face(s.fonts.title, 'sans-serif'),
        '--font-caption': face(s.fonts.caption, 'sans-serif'),
        '--font-body': face(s.fonts.caption, 'sans-serif'),
        '--font-data': face(s.fonts.data, 'monospace'),
        '--caption-case': s.caption.case,
        '--caption-scale': s.caption.case === 'uppercase' ? 0.86 : 1,
        fontSynthesis: 'none',
      } as React.CSSProperties)
    : {};
export const CAPTION_CASE = 'var(--caption-case, none)' as React.CSSProperties['textTransform'];

// A storyboard rendered without a preset (stills, old tests) looks exactly as before presets existed.
export const NO_STYLE: Pick<StylePreset, 'opener' | 'overlay' | 'camera' | 'strike'> = {opener: 'none', overlay: 'none', strike: false};
