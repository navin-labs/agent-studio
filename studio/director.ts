// Director stage: turns a Writer's board into a format film (agents/director/DIRECTOR.md: style, assets, direction), one board at a time, in order, so
// each film is checked against the ones made just before it. The creative work runs in a headless Claude Code session
// (`claude -p`): the Director authors (agents/director/DIRECTOR.md), then a Critic who never saw the code judges the rendered film
// (CRITIC.md; its review is the binding one) and a failing film gets up to two revision rounds on the critic's notes. This file only prepares the working copy, starts the session, and verifies the outcome independently:
// the film is registered, its brief is in the creative ledger and passed its review, and QA passes on the preview render.
//   node studio/director.ts <board.json>... [--test] [--judge]   --test: never hand anything to production; --judge: an authored
//   film is only judged by the critic (and revised once if it fails); --revise: revise on the last critic's notes, then judge
// Production (FILMS=on in engine/.env, see watch.mjs): a passing board is copied back to engine/content/storyboards, where the
// watcher renders every platform and QA and Telegram take over as for any board. A failing film is reported, the board is not.
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {creativeErrors, readFilms} from './creative.ts';
import {boardDirectionErrors} from './direction.ts';

const ROOT = path.join(import.meta.dirname, '..');
const WORK = path.join(ROOT, 'engine/test/films');
const PRODUCTION = path.join(ROOT, 'engine/content/storyboards');
const ROUNDS = Number(process.env.DIRECTOR_ROUNDS ?? 2); // revision rounds on the critic's notes before a film is held

export type Outcome = {id: string; ok: boolean; problems: string[]; minutes: number};

export const direct = (board: string, opts: {test?: boolean; model?: string; judgeOnly?: boolean; revise?: boolean} = {}): Outcome => {
  const t0 = Date.now();
  const doc = JSON.parse(fs.readFileSync(board, 'utf8'));
  const id: string = doc.id;
  const work = path.join(WORK, `${id}.json`);
  fs.mkdirSync(WORK, {recursive: true});
  if (!fs.existsSync(work)) fs.copyFileSync(board, work); // a rerun continues the film already started
  const log = path.join(ROOT, 'engine/test/out/director');
  fs.mkdirSync(log, {recursive: true});
  const priorities = 'In this session your skill governs. The film\'s visual and sound craft is the requirement: minimal-code habits apply to infrastructure, never to the richness of the film. Do not open notes vaults or other projects.';
  const session = (prompt: string, tools: string, name: string) => {
    let r = run(prompt, tools);
    // a usage limit is not a creative failure: wait for the reset and run the same session again (up to 8 hours)
    for (let i = 0; i < 16 && /hit your (session|usage) limit/i.test(r.stdout ?? ''); i++) {
      spawnSync('sleep', ['1800']);
      r = run(prompt, tools);
    }
    fs.writeFileSync(path.join(log, `${id}.${name}.md`), r.stdout ?? '');
    // a dead login is not a creative failure: say so plainly, so the report (and Telegram) names the fix
    if (/Failed to authenticate|OAuth session expired|Not logged in/i.test(r.stdout ?? '')) throw new Error('the headless claude login has expired: run `claude` in a terminal and use /login, then run the Director again');
    return r;
  };
  // user-level settings load too: Stitch is a user-scope MCP server, and --setting-sources would hide it
  const run = (prompt: string, tools: string) => {
    return spawnSync('claude', ['-p', prompt, '--model', opts.model ?? process.env.DIRECTOR_MODEL ?? 'opus', '--permission-mode', 'acceptEdits', '--append-system-prompt', priorities, '--allowedTools', tools],
      {cwd: ROOT, stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8', maxBuffer: 1 << 26, timeout: 3 * 3600_000});
  };
  const AUTHOR = 'Read Write Edit Glob Grep Bash(node:*) Bash(npm run:*) Bash(npx tsc:*) Bash(ls:*) Bash(cd:*) Bash(mkdir:*) Bash(cp:*) Bash(cat:*) mcp__stitch__generate_screen_from_text mcp__stitch__download_file mcp__stitch__get_screen';
  const CRITIC = 'Read Write Glob Bash(node:*) Bash(ls:*) Bash(mkdir:*) Bash(cat:*)'; // no Edit: the critic never touches the film
  const BOARD = `engine/test/films/${id}.json`;
  let r = opts.judgeOnly || opts.revise ? {status: 0} : session(`Follow agents/director/DIRECTOR.md exactly for BOARD = ${BOARD}. Work autonomously; make every creative decision yourself. Finish with step 7 and the reply it asks for.`, AUTHOR, 'reply');
  // the binding review comes from a critic who did not make the film; up to ROUNDS revisions on its notes, each judged again
  const judge = (n: number) => session(`Follow agents/director/CRITIC.md exactly for BOARD = ${BOARD}.`, CRITIC, `critic-${n}`);
  let judged = true;
  for (let round = 1; r.status === 0; round++) {
    const since = new Date().toISOString();
    if (!(opts.revise && round === 1)) judge(round); // --revise: round 1 was judged in an earlier run
    const e = readFilms().find((f) => f.id === id);
    judged = (opts.revise && round === 1) || (!!e && e.at > since); // the critic's own review, not the author's earlier one
    if (!judged) break;
    if ((e?.status === 'reviewed' && !(opts.revise && round === 1)) || round > ROUNDS) break;
    const notes = e?.review ? `Generic or crude: ${e.review.generic}\n\nFixes, most important first: ${e.review.remove}\n\nKeep (exceptional): ${e.review.exceptional}\n\nScores: ${JSON.stringify(e.review.scores)}` : '(no notes recorded)';
    r = session(`Your film for BOARD = ${BOARD} was judged by an independent critic and did not pass. Its notes:\n\n${notes}\n\nFix what it names, most important first, following agents/director/DIRECTOR.md (sections 3 to 6: assets, direction, preview, full render, QA). Fix in the direction and the assets; keep the style.`, AUTHOR, `revise-${round}`);
  }
  // verify, never trust the session's own account
  const done = JSON.parse(fs.readFileSync(work, 'utf8'));
  const problems = [
    ...(r.status === 0 ? [] : [`director session exited ${r.status}`]),
    ...(judged ? [] : ['the critic recorded no review']),
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
  return {id, ok, problems, minutes: Math.round((Date.now() - t0) / 60_000)};
};

if (import.meta.main) {
  const args = process.argv.slice(2);
  const boards = args.filter((a) => !a.startsWith('--'));
  if (!boards.length) (console.error('usage: node studio/director.ts <board.json>... [--test]'), process.exit(2));
  let failed = 0;
  for (const b of boards) {
    let o: Outcome;
    try {
      o = direct(b, {test: args.includes('--test'), judgeOnly: args.includes('--judge'), revise: args.includes('--revise')});
    } catch (e) {
      o = {id: path.basename(b, '.json'), ok: false, problems: [(e as Error).message], minutes: 0};
    }
    console.log(`${o.ok ? 'FILM' : 'HELD'} ${o.id} (${o.minutes} min)${o.problems.length ? ': ' + o.problems.join('; ') : ''}`);
    if (!o.ok) failed++;
  }
  process.exit(failed ? 1 : 0);
}
