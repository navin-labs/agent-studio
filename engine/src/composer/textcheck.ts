// Text box QA: boxes are measured in the browser while a storyboard renders (see TextProbe in Composer.tsx),
// written to out/<id>/text-boxes.json, then checked here. Pure data, no React.
// Self-test: node src/composer/textcheck.ts

export type Rect = {x: number; y: number; w: number; h: number};
export type TextBox = Rect & {scene: number; primitive: string; role: string; text: string; box?: Rect};
export type FrameBoxes = {frame: number; boxes: TextBox[]};
export type Issue = {level: 'error' | 'warning'; frame: number; scene: number; primitive: string; text: string; problem: string};

// Instagram Reels UI covers the top (header) and the bottom (caption, buttons); keep text inside this band.
export const SAFE: Rect = {x: 60, y: 250, w: 960, h: 1250}; // x 60..1020, y 250..1500
const TOL = 2; // px of anti-aliasing slack

const inside = (a: Rect, b: Rect) => a.x >= b.x - TOL && a.y >= b.y - TOL && a.x + a.w <= b.x + b.w + TOL && a.y + a.h <= b.y + b.h + TOL;
const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w - TOL && b.x < a.x + a.w - TOL && a.y < b.y + b.h - TOL && b.y < a.y + a.h - TOL;

export const checkTextBoxes = (frames: FrameBoxes[]): Issue[] => {
  const seen = new Set<string>();
  const issues: Issue[] = [];
  const add = (i: Issue) => {
    const key = `${i.scene}|${i.problem}|${i.text}`; // one report per problem per scene, not per frame
    if (!seen.has(key)) seen.add(key), issues.push(i);
  };
  for (const {frame, boxes} of frames)
    boxes.forEach((b, k) => {
      const at = {frame, scene: b.scene, primitive: b.primitive, text: b.text};
      if (!inside(b, SAFE)) add({...at, level: 'error', problem: `outside the safe area (x ${Math.round(b.x)}..${Math.round(b.x + b.w)}, y ${Math.round(b.y)}..${Math.round(b.y + b.h)})`});
      if (b.box && !inside(b, b.box)) add({...at, level: 'error', problem: 'text overflows its card'});
      for (const o of boxes.slice(k + 1))
        if (o.scene === b.scene && o.role !== b.role && (o.role === 'caption' || b.role === 'caption') && overlaps(b, o))
          add({...at, level: 'warning', problem: `caption overlaps "${(b.role === 'caption' ? o : b).text}"`});
    });
  return issues;
};

if (import.meta.main) {
  const {default: assert} = await import('node:assert');
  const t = (r: Partial<TextBox>): TextBox => ({scene: 0, primitive: 'p', role: 'text', text: 't', x: 100, y: 400, w: 200, h: 50, ...r});
  assert.deepEqual(checkTextBoxes([{frame: 0, boxes: [t({})]}]), [], 'a box inside the safe area passes');
  assert.equal(checkTextBoxes([{frame: 0, boxes: [t({y: 200})]}])[0].level, 'error', 'above the IG header fails');
  assert.equal(checkTextBoxes([{frame: 0, boxes: [t({x: 900, w: 200})]}]).length, 1, 'off the right edge fails');
  assert.match(checkTextBoxes([{frame: 0, boxes: [t({box: {x: 100, y: 400, w: 150, h: 50}})]}])[0].problem, /overflows/, 'wider than its card fails');
  assert.equal(checkTextBoxes([{frame: 0, boxes: [t({x: 101, box: {x: 100, y: 400, w: 200, h: 50}})]}]).length, 0, '1px anti-alias slack passes');
  const cap = t({role: 'caption', y: 420});
  assert.equal(checkTextBoxes([{frame: 0, boxes: [t({}), cap]}])[0].level, 'warning', 'caption over shot text warns');
  assert.equal(checkTextBoxes([0, 1, 2].map((frame) => ({frame, boxes: [t({y: 200})]}))).length, 1, 'same problem is reported once per scene');
  console.log('textcheck ok');
}
