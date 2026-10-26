// Surgical repair: when a free gate fails on specific lines, send a stateless micro-prompt with only the failing line, its neighbours
// and the exact error text, then patch the board's JSON in code. Never the session history, never the whole script. Each attempt is
// one guarded call; the guard stops a stage after MAX_STAGE_RETRIES retries and hands the board to a human.
// Self-test: node studio/costguard.test.ts
import {type CostGuard, HumanReviewRequired} from './costguard.ts';
import {type Board, gateFailures, type Target, targetsOf} from './gates.ts';

export class RepairError extends Error {}

const clip = (s: string | undefined, n: number) => (s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

export const repairPrompt = (b: Board, targets: Target[]) => {
  const voiced = b.scenes.map((s, i) => (s.vo?.trim() ? i : -1)).filter((i) => i >= 0);
  const items = targets.map((t) => {
    const at = voiced.indexOf(t.scene);
    return {scene: t.scene, primitive: b.scenes[t.scene].primitive, previous: clip(b.scenes[voiced[at - 1]]?.vo, 240), vo: clip(b.scenes[t.scene].vo, 600), next: clip(b.scenes[voiced[at + 1]]?.vo, 240), errors: t.errors};
  });
  return [
    'You repair failing lines of a short-video voiceover script. Reply with ONLY this JSON and nothing else: {"patches":[{"scene":<number>,"vo":"<the corrected line>"}]}.',
    'Change only the "vo" of the scenes listed, one patch per scene. Keep the meaning, every fact and number, and the *accent* markers where you can.',
    'Obey every error exactly. Sentences are 15 words at most and the script averages 10 or fewer. No greetings, no "did you know", no "here are", no "delve", "tapestry", "testament", "crucial", "symphony", "unlock", "game-changer". Keep a turn word (but, so, until, instead, actually) where the line needs one.',
    JSON.stringify(items),
  ].join('\n');
};

// Parse the reply and apply it to a copy of the board. Only listed scenes, only vo, only plain one-line strings.
export const applyPatches = (b: Board, reply: string, targets: Target[]): Board => {
  const a = reply.indexOf('{');
  const z = reply.lastIndexOf('}');
  let j: {patches?: {scene?: unknown; vo?: unknown}[]};
  try {
    j = JSON.parse(reply.slice(a, z + 1));
  } catch {
    throw new RepairError('the repair reply was not JSON');
  }
  if (!Array.isArray(j.patches) || !j.patches.length) throw new RepairError('the repair reply has no patches');
  const allowed = new Set(targets.map((t) => t.scene));
  const out: Board = {...b, scenes: b.scenes.map((s) => ({...s}))};
  for (const p of j.patches) {
    if (typeof p.scene !== 'number' || !allowed.has(p.scene)) throw new RepairError(`patch for scene ${String(p.scene)} was not asked for`);
    if (typeof p.vo !== 'string' || !p.vo.trim() || p.vo.length > 600 || /\n/.test(p.vo)) throw new RepairError(`patch for scene ${p.scene} is not a plain one-line string`);
    out.scenes[p.scene].vo = p.vo.trim();
  }
  return out;
};

// Repair until the free gates pass, or hand over to a human. Returns the repaired board (unchanged if it already passed).
export const repairBoard = async (guard: CostGuard, board: Board, opts: {model?: string; seconds?: (number | null)[]} = {}): Promise<{board: Board; attempts: number}> => {
  let cur = board;
  const retries = {writer: 0, composer: 0};
  let attempts = 0;
  for (;;) {
    const errors = gateFailures(cur, opts.seconds);
    if (!errors.length) return {board: cur, attempts};
    const {targets, unplaced} = targetsOf(cur, errors);
    if (unplaced.length || !targets.length) {
      const msg = `these gate errors cannot be repaired line by line, a human must fix them: ${(unplaced.length ? unplaced : errors).join(' | ')}`;
      guard.finish('human-review', msg);
      throw new HumanReviewRequired('writer', msg);
    }
    // density errors belong to the Composer stage, everything else to the Writer; each stage has its own retry count
    const stage = targets.every((t) => t.errors.every((e) => e.startsWith('density:'))) ? 'composer' : 'writer';
    const res = await guard.call({stage: `${stage}-repair`, model: opts.model ?? 'sonnet', prompt: repairPrompt(cur, targets), tools: '', lean: true, retry: retries[stage]++});
    attempts++;
    try {
      cur = applyPatches(cur, res.text, targets);
    } catch (e) {
      if (!(e instanceof RepairError)) throw e;
      // a bad reply counts as a failed attempt: the same targets are asked again, within the retry limit
    }
  }
};
