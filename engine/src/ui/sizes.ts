import type {UIBlock} from '../types';
import {flowHeight} from './FlowDiagram';

// Natural pixel height of each UI block at width 888, used to scale it into a box.
export const uiHeight = (b: UIBlock | {kind: 'math'; lines: unknown[]}): number => {
  switch (b.kind) {
    case 'inbox':
      return 96 + b.emails.length * 112 + 8;
    case 'sheet':
      return 90 + 66 + b.rows.length * 84;
    case 'chat':
      return 700;
    case 'steps': {
      const rowH = b.steps.length > 5 ? 100 : 124;
      return b.steps.length * rowH + (b.steps.length - 1) * 18;
    }
    case 'flow':
      return flowHeight(b.nodes.length);
    case 'notify':
      return b.items.length * 184 + (b.items.length - 1) * 20;
    case 'math':
      return 80 + 50 + 26 + b.lines.length * 104 + 230;
    default:
      return 700;
  }
};
