// Registry: primitive id -> component. Specs (limits, cues, channels) live in specs.ts.
import type React from 'react';
import type {PrimitiveProps} from './atoms';
import {BeforeAfterSplit} from './before-after-split';
import {ChatPop} from './chat-pop';
import {Conveyor} from './conveyor';
import {CounterDrop} from './counter-drop';
import {EndCard} from './end-card';
import {FlowBuild} from './flow-build';
import {FlowRun} from './flow-run';
import {HighlighterSwipe} from './highlighter-swipe';
import {HostCta} from './host-cta';
import {HostHook, HostPayoff} from './host-hook';
import {UiChat} from './ui-chat';
import {UiDiff} from './ui-diff';
import {UiInbox} from './ui-inbox';
import {UiSheet} from './ui-sheet';
import {MazeToLine} from './maze-to-line';
import {PhoneBuzz} from './phone-buzz';
import {PileDrop} from './pile-drop';
import {SPECS} from './specs';
import {SplitFlap} from './split-flap';
import {StampHit} from './stamp-hit';
import {WordStackSlam} from './word-stack-slam';
import {ZoomDive} from './zoom-dive';

export const PRIMITIVES: Record<keyof typeof SPECS, React.FC<PrimitiveProps<any>>> = {
  'word-stack-slam': WordStackSlam,
  'highlighter-swipe': HighlighterSwipe,
  'pile-drop': PileDrop,
  'counter-drop': CounterDrop,
  'flow-build': FlowBuild,
  'flow-run': FlowRun,
  conveyor: Conveyor,
  'chat-pop': ChatPop,
  'stamp-hit': StampHit,
  'host-hook': HostHook,
  'host-payoff': HostPayoff,
  'host-cta': HostCta,
  'ui-inbox': UiInbox,
  'ui-sheet': UiSheet,
  'ui-chat': UiChat,
  'ui-diff': UiDiff,
  'end-card': EndCard,
  'split-flap': SplitFlap,
  'before-after-split': BeforeAfterSplit,
  'phone-buzz': PhoneBuzz,
  'maze-to-line': MazeToLine,
  'zoom-dive': ZoomDive,
};
