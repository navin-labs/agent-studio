// The watcher remembers which boards it has handled as { key: sha1 }. The key is the board's path RELATIVE to engine/, so renaming or
// moving the project folder never makes every board look new (it once would have sent all 30 to the paid Director). Older state files
// keyed by absolute path are read as before: a key under this root, or under any former root that still ends in content/storyboards/<file>,
// becomes content/storyboards/<file>. Values are never touched; two old keys that collapse to one with different values is an error.
// Self-test: node scripts/watch-state.mjs test
import assert from 'node:assert';
import path from 'node:path';

export const keyOf = (root, file) => path.relative(root, file);

export const loadState = (raw, root) => {
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    let key = k;
    if (path.isAbsolute(k)) {
      const i = k.indexOf('/content/storyboards/');
      key = k.startsWith(root + path.sep) ? path.relative(root, k) : i >= 0 ? k.slice(i + 1) : k;
    }
    if (key in out && out[key] !== v) throw new Error(`watch state: two entries become "${key}" with different hashes`);
    out[key] = v;
  }
  return out;
};

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename) && process.argv[2] === 'test') {
  const root = '/p/forge-content-studio/engine';
  const h = (c) => c.repeat(40);
  assert.equal(keyOf(root, `${root}/content/storyboards/a.json`), 'content/storyboards/a.json');
  const old = {'/p/old-name/engine/content/storyboards/a.json': h('a'), '/p/old-name/engine/content/storyboards/b.json': h('b')};
  assert.deepEqual(loadState(old, root), {'content/storyboards/a.json': h('a'), 'content/storyboards/b.json': h('b')}, 'a former root becomes relative, values unchanged');
  assert.deepEqual(loadState({[`${root}/content/storyboards/a.json`]: h('a')}, root), {'content/storyboards/a.json': h('a')}, 'the current root too');
  const rel = {'content/storyboards/a.json': h('a')};
  assert.deepEqual(loadState(rel, root), rel, 'already relative: unchanged (idempotent)');
  assert.deepEqual(loadState(loadState(old, root), root), loadState(old, root));
  assert.deepEqual(loadState({'/somewhere/else/x.json': h('c')}, root), {'/somewhere/else/x.json': h('c')}, 'an unrelated key is left alone');
  assert.deepEqual(loadState({}, root), {});
  assert.throws(() => loadState({'/old/engine/content/storyboards/a.json': h('a'), [`${root}/content/storyboards/a.json`]: h('b')}, root), /two entries become/, 'a collision with different hashes is refused');
  assert.deepEqual(loadState({'/old/engine/content/storyboards/a.json': h('a'), [`${root}/content/storyboards/a.json`]: h('a')}, root), rel, 'the same hash twice collapses');
  console.log('watch-state ok: board keys are relative to engine/; keys under a former or current root are read as relative; values untouched; collisions with different hashes refused; idempotent');
}
