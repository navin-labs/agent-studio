// Art gate (Navin's visual law, 2026-10-27): a channel video is pictures with a few words on them, never text sliding past in
// boxes. Pure data, no React (make.mjs runs it on every channel board). A board fails when:
//   - a scene is anything but a composite, a host beat (hook, payoff, CTA) or the closing card (ALLOWED): boxes, sheets, flows are out
//   - a composite carries a hero number or quote (centre-screen text; the plate and its prop are the picture)
//   - a scene puts more than MAX_WORDS words on screen (every text param; not the voice line or captions, not a plate query
//     or a citation source, which is chrome)
//   - fewer than PLATE_SHARE of the non-closing scenes are composites (a real photo or clip plate under the shot)
// Self-test: node studio/artgate.test.ts
import {SPECS} from '../primitives/specs.ts';

export const ALLOWED = ['composite', 'host-hook', 'host-payoff', 'host-cta', 'end-card']; // everything else is a drawn box, sheet or diagram
export const MAX_WORDS = 12;
export const PLATE_SHARE = 0.4;
const NOT_ON_SCREEN = new Set(['query', 'source', 'icon', 'move', 'overlay', 'mode', 'tone', 'file']);

const words = (v: unknown, key = ''): number => {
  if (NOT_ON_SCREEN.has(key)) return 0;
  if (typeof v === 'string') return v.replace(/\*/g, '').split(/\s+/).filter(Boolean).length;
  if (Array.isArray(v)) return v.reduce((a: number, x) => a + words(x), 0);
  if (v && typeof v === 'object') return Object.entries(v).reduce((a, [k, x]) => a + words(x, k), 0);
  return 0;
};
export const onScreenWords = (params: unknown) => words(params);

type Board = {scenes: {primitive: string; params?: unknown}[]};
export const artIssues = (b: Board): string[] => {
  const e: string[] = [];
  b.scenes.forEach((sc, i) => {
    if (!ALLOWED.includes(sc.primitive)) e.push(`art: scene ${i + 1} (${sc.primitive}) is a drawn box or diagram; use a composite (a real plate, a literal prop, an action mode)`);
    const pr = (sc.params ?? {}) as Record<string, unknown>;
    if (sc.primitive === 'composite' && (pr.hero || pr.quote)) e.push(`art: scene ${i + 1} composite has a ${pr.hero ? 'hero number' : 'quote'}; use objectNoun + actionMode, no centre text`);
    if (sc.primitive === 'composite' && !(pr.objectNoun && pr.actionMode)) e.push(`art: scene ${i + 1} composite needs objectNoun and actionMode (the literal prop and how it acts)`);
    const n = onScreenWords(sc.params);
    if (n > MAX_WORDS) e.push(`art: scene ${i + 1} (${sc.primitive}) puts ${n} words on screen, at most ${MAX_WORDS}`);
  });
  const comps = b.scenes.filter((sc) => sc.primitive === 'composite');
  const modes = new Set(comps.map((sc) => (sc.params as Record<string, unknown> | undefined)?.actionMode).filter(Boolean));
  if (comps.length >= 4 && modes.size < 3) e.push(`art: ${comps.length} composites use ${modes.size} action mode(s); use at least 3 different ones`);
  const body = b.scenes.filter((sc) => !SPECS[sc.primitive]?.closer);
  const plates = body.filter((sc) => sc.primitive === 'composite').length;
  if (body.length && plates < Math.ceil(body.length * PLATE_SHARE)) e.push(`art: ${plates} of ${body.length} scenes have a photo or clip plate; at least ${Math.ceil(body.length * PLATE_SHARE)} must be composites`);
  return e;
};
