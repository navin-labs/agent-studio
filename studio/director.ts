// Director stage: turns a Writer's board into a format film (agents/director/DIRECTOR.md: style, assets, direction), one board at a time, in order, so
// each film is checked against the ones made just before it. The creative work runs in a headless Claude Code session
// (`claude -p`): the Director authors (agents/director/DIRECTOR.md), then a Critic who never saw the code judges the rendered film
// (CRITIC.md; its review is the binding one). This file prepares the working copy, starts each session through the cost guard
// (studio/costguard.ts), and verifies the outcome independently: the film is registered, its brief is in the creative ledger and
// passed its review, and QA passes on the preview render.
// Cost control (session 44: an unattended run burned about 60% of a weekly allowance): every model call goes through CostGuard, which
// caps cost, calls, wall clock and prompt size and writes run-ledger.json; failing lines are repaired with a stateless micro-prompt
// (studio/repair.ts) before any film work; the paid Critic runs once, and only after every free gate passes; a failed review never
// starts another revision by itself.
//   node studio/director.ts <board.json>... [--test] [--judge] [--approve-retry]
//   --test: never hand anything to production; --judge: an authored film is only judged by the critic;
//   --approve-retry: you approve ONE revision on the last critic's notes, which is then judged again (a new run, a new budget)
// Production (FILMS=on in engine/.env, see watch.mjs): a passing board is copied back to engine/content/storyboards, where the
// watcher renders every platform and QA and Telegram take over as for any board. A failing film is reported, the board is not.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {CostGuard, type Limits, LIMITS} from './costguard.ts';
import {creativeErrors, readFilms} from './creative.ts';
import {boardDirectionErrors} from './direction.ts';
import {gateFailures} from './gates.ts';
import {repairBoard} from './repair.ts';

const ROOT = path.join(import.meta.dirname, '..');
const WORK = path.join(ROOT, 'engine/test/films');
const PRODUCTION = path.join(ROOT, 'engine/content/storyboards');

export type Outcome = {id: string; ok: boolean; problems: string[]; minutes: number; ledger?: string};

// Human-only knobs, read here (never by the Director): a real film needs far more than the default ceilings, so raising them is a
// deliberate act in the shell or the watcher's plist, printed loudly. Without them the defaults in costguard.ts apply.
export const limitsFromEnv = (env = process.env): Partial<Limits> => {
  const o: Partial<Limits> = {};
  if (env.COSTGUARD_MAX_USD) o.MAX_RUN_COST_USD = Number(env.COSTGUARD_MAX_USD);
  if (env.COSTGUARD_MAX_MS) o.MAX_WALL_CLOCK_MS = Number(env.COSTGUARD_MAX_MS);
  if (env.COSTGUARD_MAX_CALLS) o.MAX_TOTAL_CALLS_PER_RUN = Number(env.COSTGUARD_MAX_CALLS);
  if (o.MAX_RUN_COST_USD) o.WARN_COST_USD = o.MAX_RUN_COST_USD * (LIMITS.WARN_COST_USD / LIMITS.MAX_RUN_COST_USD);
  return o;
};

// the guard's own files may not be edited from inside a session
const PROTECTED = ['costguard', 'gates', 'repair', 'director'].flatMap((f) => [`Edit(studio/${f}.ts)`, `Write(studio/${f}.ts)`]).join(' ');
const AUTHOR = 'Read Write Edit Glob Grep Bash(node:*) Bash(npm run:*) Bash(npx tsc:*) Bash(ls:*) Bash(cd:*) Bash(mkdir:*) Bash(cp:*) Bash(cat:*) mcp__stitch__generate_screen_from_text mcp__stitch__download_file mcp__stitch__get_screen';
const CRITIC = 'Read Write Glob Bash(node:*) Bash(ls:*) Bash(mkdir:*) Bash(cat:*)'; // no Edit: the critic never touches the film
const PRIORITIES = 'In this session your skill governs. The film\'s visual and sound craft is the requirement: minimal-code habits apply to infrastructure, never to the richness of the film. Do not open notes vaults or other projects.';

export const direct = async (board: string, opts: {test?: boolean; model?: string; judgeOnly?: boolean; approveRetry?: boolean; limits?: Partial<Limits>; guard?: CostGuard} = {}): Promise<Outcome> => {
  const t0 = Date.now();
  let doc = JSON.parse(fs.readFileSync(board, 'utf8'));
  const id: string = doc.id;
  const work = path.join(WORK, `${id}.json`);
  fs.mkdirSync(WORK, {recursive: true});
  const fresh = !fs.existsSync(work);
  if (fresh) fs.copyFileSync(board, work); // a rerun continues the film already started
  const log = path.join(ROOT, 'engine/test/out/director');
  fs.mkdirSync(log, {recursive: true});
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const guard = opts.guard ?? new CostGuard(path.join(log, id, stamp), board, {limits: opts.limits});
  const ledger = guard.file;
  const model = opts.model ?? process.env.DIRECTOR_MODEL ?? 'sonnet';
  try {
    // 1) free gates first: a failing line is repaired with a stateless micro-prompt, never by restarting the whole film
    if (fresh) {
      const r = await repairBoard(guard, doc, {model});
      if (r.attempts) {
        doc = r.board;
        fs.writeFileSync(work, JSON.stringify(doc, null, 2) + '\n');
        console.log(`repaired ${r.attempts} time(s) before directing`);
      }
    }
    const session = async (prompt: string, allowed: string, stage: string, extra: {critic?: boolean; gates?: string[]} = {}) => {
      const r = await guard.call({stage, model, prompt, allowed, disallowed: PROTECTED, appendSystem: PRIORITIES, cwd: ROOT, ...extra});
      fs.writeFileSync(path.join(log, `${id}.${stage}.md`), r.text);
      // a dead login or a usage limit is not a creative failure: say so plainly and stop (no waiting, no retry loop)
      if (/Failed to authenticate|OAuth session expired|Not logged in/i.test(r.text)) throw new Error('the headless claude login has expired: run `claude` in a terminal and use /login, then run the Director again');
      if (/hit your (session|usage) limit/i.test(r.text)) throw new Error('the usage limit was reached; stopping instead of waiting. Run the Director again after the reset');
      return r;
    };
    const BOARD = `engine/test/films/${id}.json`;
    // 2) the author, or (only on your --approve-retry) one revision on the last critic's notes
    let authorOk = true;
    if (opts.approveRetry) {
      const e = readFilms().find((f) => f.id === id);
      const notes = e?.review ? `Generic or crude: ${e.review.generic}\n\nFixes, most important first: ${e.review.remove}\n\nKeep (exceptional): ${e.review.exceptional}\n\nScores: ${JSON.stringify(e.review.scores)}` : '(no notes recorded)';
      authorOk = !(await session(`Your film for BOARD = ${BOARD} was judged by an independent critic and did not pass. Its notes:\n\n${notes}\n\nFix what it names, most important first, following agents/director/DIRECTOR.md (sections 3 to 6: assets, direction, preview, full render, QA). Fix in the direction and the assets; keep the style.`, AUTHOR, 'revise')).isError;
    } else if (!opts.judgeOnly) {
      authorOk = !(await session(`Follow agents/director/DIRECTOR.md exactly for BOARD = ${BOARD}. Work autonomously; make every creative decision yourself. Finish with step 7 and the reply it asks for.`, AUTHOR, 'director')).isError;
    }
    // 3) the one paid Critic call, only when every free gate passes
    let judged = false;
    let held: string | null = null;
    if (authorOk) {
      const gates = gateFailures(JSON.parse(fs.readFileSync(work, 'utf8')));
      const since = new Date().toISOString();
      if (gates.length) held = `the Critic was not called: free gates fail (${gates.slice(0, 4).join(' | ')})`;
      else {
        await session(`Follow agents/director/CRITIC.md exactly for BOARD = ${BOARD}.`, CRITIC, 'critic', {critic: true, gates});
        const e = readFilms().find((f) => f.id === id);
        judged = !!e && e.at > since; // the critic's own review, not the author's earlier one
        if (judged && e?.status !== 'reviewed') held = `the critic held the film; read its notes, then rerun with --approve-retry to approve one revision (${e?.review?.remove ?? 'no notes'})`;
      }
    }
    // verify, never trust the session's own account
    const done = JSON.parse(fs.readFileSync(work, 'utf8'));
    const problems = [
      ...(authorOk ? [] : ['the director session ended in an error']),
      ...(held ? [held] : judged || !authorOk ? [] : ['the critic recorded no review']),
      ...(done.film && fs.existsSync(path.join(ROOT, 'engine/src/films', `${done.film}.tsx`)) ? [] : ['no film file']),
      ...(fs.readFileSync(path.join(ROOT, 'engine/src/films/index.ts'), 'utf8').includes(`'${done.film}'`) ? [] : ['film not registered in index.ts']),
      ...(done.direction ? boardDirectionErrors(done) : []),
      ...(done.film ? creativeErrors(done, readFilms()) : []),
      ...(['scenes', 'caption', 'hashtags', 'meta'] as const).filter((k) => JSON.stringify(doc[k]) !== JSON.stringify(done[k])).map((k) => `the director changed the Writer's ${k}`),
    ];
    const qa = spawnSync(process.execPath, ['studio/qa.ts', work, '--out', 'engine/test/out'], {cwd: ROOT, encoding: 'utf8'});
    if (qa.status !== 0) problems.push(`QA: ${qa.stdout.split('\n').filter((l) => l.includes('FAIL')).slice(0, 6).join(' | ')}`);
    const ok = problems.length === 0;
    if (ok && !opts.test) fs.writeFileSync(path.join(PRODUCTION, `${id}.json`), JSON.stringify(done, null, 2) + '\n'); // the watcher takes it from here
    guard.finish(ok ? 'done' : 'human-review', ok ? undefined : problems[0]);
    return {id, ok, problems, minutes: Math.round((Date.now() - t0) / 60_000), ledger};
  } catch (e) {
    guard.finish('aborted', (e as Error).message);
    throw e;
  } finally {
    console.log('\n' + guard.summary() + `\nledger: ${ledger}\n`);
  }
};

if (import.meta.main) {
  const args = process.argv.slice(2);
  const boards = args.filter((a) => !a.startsWith('--'));
  if (!boards.length) (console.error('usage: node studio/director.ts <board.json>... [--test] [--judge] [--approve-retry]'), process.exit(2));
  const limits = limitsFromEnv();
  if (Object.keys(limits).length) console.error(`!!! cost ceilings raised by the environment: ${JSON.stringify(limits)}`);
  let failed = 0;
  for (const b of boards) {
    let o: Outcome;
    try {
      o = await direct(b, {test: args.includes('--test'), judgeOnly: args.includes('--judge'), approveRetry: args.includes('--approve-retry'), limits});
    } catch (e) {
      o = {id: path.basename(b, '.json'), ok: false, problems: [`${(e as Error).name}: ${(e as Error).message}`], minutes: 0};
    }
    console.log(`${o.ok ? 'FILM' : 'HELD'} ${o.id} (${o.minutes} min)${o.problems.length ? ': ' + o.problems.join('; ') : ''}`);
    if (!o.ok) failed++;
  }
  process.exit(failed ? 1 : 0);
}
