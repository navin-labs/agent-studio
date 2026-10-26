// Test helper: channel recipes are composite-only now (studio/recipe.ts), so Learn and Improve have no drawn shots to compare.
// Their tests exercise the learning logic on a pool of drawn primitives; this puts the old pool back for that test process only.
import {FORMATS} from './recipe.ts';

const DRAWN: Record<string, string[][]> = {
  host: [['host-hook'], ['composite'], ['composite'], ['before-after-split', 'maze-to-line', 'highlighter-swipe', 'composite'], ['flow-run', 'flow-build', 'conveyor'], ['composite'], ['host-payoff'], ['host-cta']],
  explainer: [['composite', 'word-stack-slam', 'split-flap', 'zoom-dive'], ['composite'], ['composite'], ['before-after-split', 'maze-to-line', 'highlighter-swipe', 'composite'], ['flow-run', 'flow-build', 'conveyor', 'line-draw'], ['composite'], ['composite', 'split-flap', 'word-stack-slam'], ['end-card']],
  composed: [['composite', 'word-stack-slam', 'pile-drop', 'split-flap', 'zoom-dive', 'intertitle'], ['composite'], ['highlighter-swipe', 'flow-build', 'before-after-split', 'maze-to-line', 'line-draw', 'point-cloud'], ['flow-run', 'flow-build', 'conveyor', 'line-draw', 'stamp-hit'], ['composite'], ['end-card']],
  reach: [['composite', 'zoom-dive', 'split-flap', 'word-stack-slam', 'intertitle'], ['composite'], ['split-flap', 'highlighter-swipe', 'intertitle', 'line-draw', 'pile-drop'], ['composite', 'maze-to-line', 'before-after-split', 'zoom-dive', 'conveyor'], ['composite'], ['end-card']],
};
for (const [k, beats] of Object.entries(DRAWN)) (FORMATS as unknown as Record<string, {beats: string[][]}>)[k].beats = beats;
