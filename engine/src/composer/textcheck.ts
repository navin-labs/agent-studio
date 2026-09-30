// Text box QA: boxes are measured in the browser while a storyboard renders (see TextProbe in Composer.tsx),
// written to out/<id>/text-boxes.json, then checked here. Pure data, no React.
// Self-test: node src/composer/textcheck.ts

export type Rect = {x: number; y: number; w: number; h: number};
export type TextBox = Rect & {scene: number; primitive: string; role: string; text: string; box?: Rect; cut?: boolean};
export type FrameBoxes = {frame: number; boxes: TextBox[]};
export type Issue = {level: 'error' | 'warning'; frame: number; scene: number; primitive: string; text: string; problem: string};

// Platform UI covers parts of the frame; text must sit inside every profile the video is posted to.
// ponytail: every board is checked against all profiles (one cut posts everywhere); per-board platform lists when a channel skips one.
export const SAFE_ZONES: Record<string, Rect> = {
  instagram: {x: 60, y: 250, w: 960, h: 1250}, // header on top; caption and buttons below 1500
  youtube: {x: 60, y: 180, w: 900, h: 1350}, // like/comment/share column on the right 120 px; title and channel below 1530
};
const TOL = 2; // px of anti-aliasing slack

const inside = (a: Rect, b: Rect) => a.x >= b.x - TOL && a.y >= b.y - TOL && a.x + a.w <= b.x + b.w + TOL && a.y + a.h <= b.y + b.h + TOL;
const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w - TOL && b.x < a.x + a.w - TOL && a.y < b.y + b.h - TOL && b.y < a.y + a.h - TOL;

export const checkTextBoxes = (frames: FrameBoxes[], zones = SAFE_ZONES): Issue[] => {
  const seen = new Set<string>();
  const issues: Issue[] = [];
  const add = (i: Issue) => {
    const key = `${i.scene}|${i.problem.replace(/ \(.*$/, '')}|${i.text}`; // one report per problem kind per scene, not per frame or pixel
    if (!seen.has(key)) seen.add(key), issues.push(i);
  };
  for (const {frame, boxes} of frames)
    boxes.forEach((b, k) => {
      const at = {frame, scene: b.scene, primitive: b.primitive, text: b.text};
      for (const [name, zone] of Object.entries(zones))
        if (!inside(b, zone)) add({...at, level: 'error', problem: `outside the ${name} safe area (x ${Math.round(b.x)}..${Math.round(b.x + b.w)}, y ${Math.round(b.y)}..${Math.round(b.y + b.h)})`});
      if (b.box && !inside(b, b.box)) add({...at, level: 'error', problem: 'text overflows its card'});
      if (b.cut) add({...at, level: 'error', problem: 'text is cut off by its window'});
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
  assert.equal(checkTextBoxes([{frame: 0, boxes: [t({x: 900, w: 200})]}]).length, 2, 'off the right edge fails on both platforms');
  assert.match(checkTextBoxes([{frame: 0, boxes: [t({x: 800, w: 200})]}])[0].problem, /youtube/, 'text under the Shorts button column fails only on youtube');
  assert.equal(checkTextBoxes([{frame: 0, boxes: [t({x: 800, w: 200})]}]).length, 1, 'but passes instagram');
  assert.match(checkTextBoxes([{frame: 0, boxes: [t({box: {x: 100, y: 400, w: 150, h: 50}})]}])[0].problem, /overflows/, 'wider than its card fails');
  assert.equal(checkTextBoxes([{frame: 0, boxes: [t({x: 101, box: {x: 100, y: 400, w: 200, h: 50}})]}]).length, 0, '1px anti-alias slack passes');
  const cap = t({role: 'caption', y: 420});
  assert.equal(checkTextBoxes([{frame: 0, boxes: [t({}), cap]}])[0].level, 'warning', 'caption over shot text warns');
  assert.equal(checkTextBoxes([0, 1, 2].map((frame) => ({frame, boxes: [t({y: 200 - frame})]}))).length, 1, 'same problem is reported once per scene, even as it moves');
  assert.match(checkTextBoxes([{frame: 0, boxes: [t({cut: true})]}])[0].problem, /cut off/, 'clipped text fails');
  console.log('textcheck ok');
}
