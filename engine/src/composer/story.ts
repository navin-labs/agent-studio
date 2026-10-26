// What a board tells every shot that draws its own chrome (the composite): its plates, the router's rig, the case tag and
// citation, each scene's start frame for the running timecode. The Composer provides it.
import React from 'react';
import type {PlateRef} from './CinematicComposite';
import {type WorldId, worldOf} from './worldmap';

export type Story = {world?: WorldId; objects?: (string | null)[]; plates?: (PlateRef | null)[]; rig?: {moves: string[]; grade: string}; fx?: string; caseTag: string; citation: string; starts: number[]};
export const StoryCtx = React.createContext<Story>({caseTag: '', citation: '', starts: []});

// the chrome's words come from the board: its topic as a case tag, its sourced proof as the citation
export const storyOf = (sb: {id: string; objects?: (string | null)[]; channel?: string; meta?: {proof?: {source?: string}; case?: string}; plates?: (PlateRef | null)[]; rig?: {moves: string[]; grade: string}; skin?: {id?: string; fxOverlay: string}}, starts: number[]): Story => ({
  plates: sb.plates,
  objects: sb.objects,
  world: sb.skin?.id ? worldOf(sb.skin.id) : undefined,
  rig: sb.rig,
  fx: sb.skin?.fxOverlay,
  caseTag: (sb.meta?.case ?? `FILE ${sb.id}`).toUpperCase().slice(0, 28),
  citation: sb.meta?.proof?.source ? `SOURCE  ${sb.meta.proof.source}`.slice(0, 90) : '',
  starts,
});
