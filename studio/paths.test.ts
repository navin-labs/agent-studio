// The project folder was renamed (agent-studio -> forge-content-studio). This keeps stale folder paths out of the tracked files, and
// shows that nothing in the code hard-codes a home path: every launch agent installer derives the folder it runs from, so
// reinstalling writes the current one. The installed plists live outside the repo; their repair is a runtime step (docs/RUNBOOK.md).
// Run: node studio/paths.test.ts
import assert from 'node:assert';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(import.meta.dirname, '..');
const tracked = spawnSync('git', ['ls-files'], {cwd: ROOT, encoding: 'utf8'}).stdout.split('\n').filter((f) => f && !f.startsWith('docs/research/') && !f.startsWith('engine/test/films/') && !/\.(png|jpe?g|mp4|wav|woff2?|webp|gif|ico|pdf)$/i.test(f));
const untracked = spawnSync('git', ['ls-files', '--others', '--exclude-standard'], {cwd: ROOT, encoding: 'utf8'}).stdout.split('\n').filter((f) => f && !f.startsWith('.scratch/') && !f.startsWith('engine/test/films/') && !/\.(png|jpe?g|mp4|wav|woff2?|webp|gif|ico|pdf)$/i.test(f));
const files = [...new Set([...tracked, ...untracked])].filter((f) => fs.existsSync(path.join(ROOT, f)));
const text = (f: string) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const hits = (re: RegExp) => files.filter((f) => re.test(text(f))).sort();

// Files that may NAME the old folder because they describe the rename or are history, each for a stated reason.
const MAY_NAME_OLD = new Set([
  'docs/RUNBOOK.md', // how to repair the launch agents that still point at the old folder
  'docs/RELEASE_CHECKLIST.md', // the same, as a release step
  'docs/proof/final-audit-report.md', // the audit that found it
  'docs/proof/production-readiness-baseline.md', // the stale-name audit
  'docs/proof/production-readiness-report.md',
  'docs/DECISIONS.md', // ADRs are dated history ("engine copied into agent-studio/engine/")
  'docs/SETUP.md', // "older notes say agent-studio, the project's former name"
  'docs/INSTALL.md',
  'agents/writer/FORGE_WEEKLY_WRITER.md', // says "it was called agent-studio before the rename"
  'agents/publisher/FORGE_QUEUE_PUBLISHER.md',
  'agents/learn/FORGE_METRICS_REPORTER.md',
  'docs/SECURITY.md',
  'studio/paths.test.ts',
]);

// 1. the old ABSOLUTE or home-relative folder path appears only where it is being described
assert.deepEqual(hits(/Dev\/projects\/agent-studio/).filter((f) => !MAY_NAME_OLD.has(f)), [], 'no other file names ~/Dev/projects/agent-studio');
// 2. no instruction points inside the old folder (agent-studio/.env, agent-studio/engine, ...): the folder is "the repo root"
const inside = /(?<![\w-])agent-studio\/(\.env|engine|state|studio|queue|inbox|recipes|channels|out)\b/;
assert.deepEqual(hits(inside).filter((f) => !['docs/DECISIONS.md', 'docs/RUNBOOK.md', 'docs/RELEASE_CHECKLIST.md', 'docs/proof/final-audit-report.md', 'studio/paths.test.ts'].includes(f)), [], 'no instruction points inside agent-studio/');
// 3. the three Meta/Writer skills define STUDIO as the clone folder, with the current name, and still tell the agent what to do if it is missing
for (const f of ['agents/writer/FORGE_WEEKLY_WRITER.md', 'agents/publisher/FORGE_QUEUE_PUBLISHER.md', 'agents/learn/FORGE_METRICS_REPORTER.md']) {
  const t = text(f);
  assert.match(t, /~\/Dev\/projects\/forge-content-studio/, `${f} names the current folder`);
  assert.match(t, /was called `agent-studio` before the rename/, `${f} explains the old name`);
  assert.match(t, /If (that|it) folder does not exist|If it does not exist/, `${f} says what to do when the folder is missing`);
  assert.doesNotMatch(t, /The project is `~\/Dev\/projects\/agent-studio`/, `${f} no longer defines STUDIO as the old path`);
}
// 4. code never hard-codes a home directory or either project folder (everything is relative to the file's own location)
const code = files.filter((f) => /^(studio|engine\/scripts|engine\/src)\/.*\.(ts|tsx|mjs)$/.test(f) && !/\.test\.ts$/.test(f));
assert.deepEqual(code.filter((f) => /\/Users\/[a-z]+\/|Dev\/projects\/(agent-studio|forge-content-studio)/.test(text(f))), [], 'no hard-coded home or project path in code');
// 5. every launch agent installer takes the folder from where its own file lives, so reinstalling writes the CURRENT folder
assert.match(text('studio/approve-server.ts'), /const root = path\.join\(import\.meta\.dirname, '\.\.'\)/, 'approve-server --install');
assert.match(text('studio/run.ts'), /const ROOT = path\.join\(import\.meta\.dirname, '\.\.'\)/, 'run.ts (tick) root');
assert.match(text('engine/scripts/watch.mjs'), /import\.meta|fileURLToPath|__dirname/, 'watch.mjs derives its folder from its own location');
// 6. the watcher check compares the plist with THIS checkout's watch.mjs, so a plist for another folder is reported (not silently trusted)
{
  const {watcherProblem} = await import('./run.ts');
  const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR ?? '/tmp', 'paths-test-'));
  const plist = path.join(tmp, 'com.theautomationguy.studiowatch.plist');
  const loaded = () => '-\t0\tcom.theautomationguy.studiowatch\n';
  fs.writeFileSync(plist, '<plist><string>/Users/x/Dev/projects/agent-studio/engine/scripts/watch.mjs</string></plist>');
  assert.match(String(watcherProblem({agents: tmp, loaded})), /does not run .*engine\/scripts\/watch\.mjs/, 'a plist for the old folder is reported');
  fs.writeFileSync(plist, `<plist><string>${path.join(ROOT, 'engine', 'scripts', 'watch.mjs')}</string></plist>`);
  assert.equal(watcherProblem({agents: tmp, loaded}), null, 'a plist for this checkout is accepted');
  fs.rmSync(tmp, {recursive: true});
}
console.log('paths ok: no tracked file points at ~/Dev/projects/agent-studio except where the rename is described; no instruction points inside agent-studio/; the Writer, Publisher and Reporter skills define STUDIO as the current clone folder; code hard-codes no home or project path; launch agent installers derive their folder from their own location; a watcher plist for the old folder is reported');
