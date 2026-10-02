// Role-token themes. The only file allowed to hold hex colours (A2 adds the gate check).
// Primitives read a Theme and never hard-code a colour, so any clip renders in any theme.
// Max 3 colours per frame: bg, ink, plus ONE of accent / flow / ok / alert.

export type Theme = {
  bg: string; // page background
  surface: string; // cards, UI screens
  ink: string; // headlines, outlines, lines
  muted: string; // secondary text, labels
  rule: string; // grid, dividers
  accent: string; // highlighter behind keywords ONLY, never text colour
  onAccent: string; // text sitting on the accent highlighter
  flow: string; // automation lines, nodes, travelling data
  ok: string; // large text, icons, pills only
  alert: string; // errors only: large text, icons, pills
  warn: string; // pain highlights (manual, wasteful steps)
  shadow: string; // hard offset shadow
};

export type ThemeName = 'paper' | 'ink' | 'mono' | 'studio' | 'night';

export const THEMES: Record<ThemeName, Theme> = {
  // Paper & Signal v1 (locked 2026-09-29): values copied from P in theme.ts.
  paper: {
    bg: '#F4F1EA', surface: '#FFFFFF', ink: '#111111', muted: '#5C5A55', rule: '#E3DED3',
    accent: '#C6F432', onAccent: '#111111', flow: '#2B4BFF', ok: '#1F9D55', alert: '#E5484D', warn: '#F5A623', shadow: '#111111',
  },
  // bg/surface/ink/accent from the plan; the rest approved by Navin 2026-09-30.
  ink: {
    bg: '#0E0E0E', surface: '#1A1A1A', ink: '#F4F1EA', muted: '#A8A59E', rule: '#2E2E2E',
    accent: '#C6F432', onAccent: '#0E0E0E', flow: '#6B83FF', ok: '#3DD68C', alert: '#FF6B6E', warn: '#F5A623', shadow: '#000000',
  },
  mono: {
    bg: '#E4E3DF', surface: '#F4F4F2', ink: '#161616', muted: '#55544F', rule: '#CFCEC9',
    accent: '#C6F432', onAccent: '#161616', flow: '#2B4BFF', ok: '#1F9D55', alert: '#D93A3F', warn: '#F5A623', shadow: '#161616',
  },
  studio: {
    bg: '#FFFFFF', surface: '#F6F6F6', ink: '#0B0B0B', muted: '#5E5E5E', rule: '#E6E6E6',
    accent: '#2B4BFF', onAccent: '#FFFFFF', flow: '#0B0B0B', ok: '#1F9D55', alert: '#E5484D', warn: '#F5A623', shadow: '#0B0B0B',
  },
  // Pixel-narrator host format (Navin's master prompt, 2026-10-01): near-black stage, lime primary, flow blue secondary,
  // paper white text, amber for pain only, red for errors only.
  night: {
    bg: '#0B0B10', surface: '#15151C', ink: '#F4F1EA', muted: '#9C9A94', rule: '#26262F',
    accent: '#C6F432', onAccent: '#0B0B10', flow: '#2B4BFF', ok: '#C6F432', alert: '#E5484D', warn: '#F5A623', shadow: '#000000',
  },
};

// SVG mask luminance: SHOW keeps what is under it, HIDE removes it. Not design colours.
export const MASK = {show: '#FFFFFF', hide: '#000000'};

// Mascot palettes: a character's own colours, fixed across themes (it is the channel's face).
export const CHARACTER = {
  paper: '#F4F1EA',
  paperShade: '#A9A397',
  paperDeep: '#5E5A52',
  blueLight: '#6F86FF',
  blue: '#2B4BFF',
  blueDeep: '#121F7A',
  limeLight: '#E4FF8A',
  lime: '#C6F432',
  limeDeep: '#6A850F',
  eye: '#0B0B10',
  catchlight: '#FFFFFF',
  blush: '#FF7A9A',
  glow: '#F5A623',
};

// ---- React plumbing: a composition provides its theme once; components read it with useTheme().
import React from 'react';
import {HANDLE} from './theme.ts';

export const ThemeCtx = React.createContext<Theme>(THEMES.paper);
// The channel's own account, shown on closers. Set per render from channels/<id>/channel.json (make.mjs); default C1.
export const HandleCtx = React.createContext(HANDLE);
export const useTheme = () => React.useContext(ThemeCtx);

// True for light colours (relative luminance > 0.5), e.g. to flip a light logo on a light card.
export const isLight = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).reduce((a, c, i) => a + c * [0.2126, 0.7152, 0.0722][i], 0) > 0.5;

// '#RRGGBB' + alpha -> 'rgba(r,g,b,a)', so translucent colours still come from role tokens.
export const alpha = (hex: string, a: number) =>
  `rgba(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(',')},${a})`;

// Brand card: 3px stroke + hard offset shadow.
export const card = (t: Theme) => ({background: t.surface, border: `3px solid ${t.ink}`, borderRadius: 20, boxShadow: `8px 8px 0 ${t.shadow}`});
