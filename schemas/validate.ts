// Validates JSON files against the schemas in this folder. No dependency: covers the JSON Schema subset these schemas use
// (type, enum, const, required, properties, additionalProperties: false, items, min/max Items/Length/imum, pattern, format, if/then).
// ponytail: subset validator; an unsupported keyword throws, so a schema can't silently go unchecked. Swap for ajv if schemas outgrow it.
//
// node schemas/validate.ts                      every sample + self-test + enum sync with the engine
// node schemas/validate.ts <schema> <file...>   check files, e.g. node schemas/validate.ts storyboard content/c1/*.json
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

type Schema = Record<string, any>;
const DIR = import.meta.dirname;
const ROOT = path.join(DIR, '..');

const KNOWN = new Set(['$schema', 'title', 'description', 'type', 'enum', 'const', 'required', 'properties', 'additionalProperties', 'items', 'minItems', 'maxItems', 'minLength', 'maxLength', 'minimum', 'maximum', 'pattern', 'format', 'if', 'then']);
const FORMATS: Record<string, (v: string) => boolean> = {
  date: (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v)),
  'date-time': (v) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(v) && !isNaN(Date.parse(v)),
  uri: (v) => URL.canParse(v) && /^https?:$/.test(new URL(v).protocol),
};
const typeOf = (v: unknown) => (Array.isArray(v) ? 'array' : v === null ? 'null' : Number.isInteger(v) ? 'integer' : typeof v);

export const validate = (s: Schema, v: unknown, at = '$'): string[] => {
  for (const k of Object.keys(s)) if (!KNOWN.has(k)) throw new Error(`${at}: schema keyword "${k}" is not supported by validate.ts`);
  const t = typeOf(v);
  if (s.type && !(s.type === t || (s.type === 'number' && t === 'integer'))) return [`${at}: expected ${s.type}, got ${t}`];
  if (s.enum && !s.enum.includes(v)) return [`${at}: must be one of ${s.enum.join(', ')}, got ${JSON.stringify(v)}`];
  if ('const' in s && v !== s.const) return [`${at}: must be ${JSON.stringify(s.const)}`];
  const e: string[] = [];
  if (t === 'string') {
    const str = v as string;
    if (s.minLength != null && str.length < s.minLength) e.push(`${at}: at least ${s.minLength} characters`);
    if (s.maxLength != null && str.length > s.maxLength) e.push(`${at}: at most ${s.maxLength} characters, got ${str.length}`);
    if (s.pattern && !new RegExp(s.pattern).test(str)) e.push(`${at}: must match ${s.pattern}`);
    if (s.format && !FORMATS[s.format]?.(str)) e.push(`${at}: not a valid ${s.format}`);
  }
  if ((t === 'integer' || t === 'number') && s.minimum != null && (v as number) < s.minimum) e.push(`${at}: at least ${s.minimum}`);
  if ((t === 'integer' || t === 'number') && s.maximum != null && (v as number) > s.maximum) e.push(`${at}: at most ${s.maximum}`);
  if (t === 'array') {
    const a = v as unknown[];
    if (s.minItems != null && a.length < s.minItems) e.push(`${at}: at least ${s.minItems} items, got ${a.length}`);
    if (s.maxItems != null && a.length > s.maxItems) e.push(`${at}: at most ${s.maxItems} items, got ${a.length}`);
    if (s.items) a.forEach((x, i) => e.push(...validate(s.items, x, `${at}[${i}]`)));
  }
  if (t === 'object') {
    const o = v as Record<string, unknown>;
    for (const r of s.required ?? []) if (!(r in o)) e.push(`${at}: missing "${r}"`);
    for (const [k, x] of Object.entries(o)) {
      if (s.properties?.[k]) e.push(...validate(s.properties[k], x, `${at}.${k}`));
      else if (s.additionalProperties === false) e.push(`${at}: unknown field "${k}"`);
    }
  }
  if (s.if && !validate(s.if, v, at).length) e.push(...validate(s.then, v, at));
  return e;
};

export const loadSchema = (name: string): Schema => JSON.parse(fs.readFileSync(path.join(DIR, `${name}.schema.json`), 'utf8'));
const read = (f: string) => JSON.parse(fs.readFileSync(path.resolve(ROOT, f), 'utf8'));

// One sample per schema (paths from the repo root). Real files where they exist, so the contract is tested on what runs.
const SAMPLES: Record<string, string[]> = {
  channel: fs.readdirSync(path.join(ROOT, 'channels')).map((c) => `channels/${c}/channel.json`), // every channel, not one sample
  idea: ['schemas/samples/idea.json'],
  recipe: ['schemas/samples/recipe.json'],
  storyboard: fs.readdirSync(path.join(ROOT, 'engine/content/storyboards')).filter((f) => f.endsWith('.json')).map((f) => `engine/content/storyboards/${f}`),
  fingerprint: ['schemas/samples/fingerprint.json'],
  qa: ['schemas/samples/qa.json'],
  ledger: ['schemas/samples/ledger.json'],
  metrics: ['schemas/samples/metrics.json'],
};

// Every enum in the schemas that mirrors an engine list must equal it, and repeated enums must agree across schemas.
const enumsAt = (s: any, key: string, out: string[][] = []): string[][] => {
  if (s && typeof s === 'object')
    for (const [k, x] of Object.entries(s)) {
      if (k === key && x && typeof x === 'object') {
        const en = (x as Schema).enum ?? (x as Schema).items?.enum;
        if (en) out.push(en);
      }
      enumsAt(x, key, out);
    }
  return out;
};

const main = async () => {
  const [name, ...files] = process.argv.slice(2);
  if (name) {
    const s = loadSchema(name);
    let bad = 0;
    for (const f of files) {
      const errs = validate(s, read(f));
      bad += +!!errs.length;
      console.log(errs.length ? `FAIL ${f}\n  ${errs.join('\n  ')}` : `ok   ${f}`);
    }
    process.exit(bad ? 1 : 0);
  }

  // self-test: the validator catches what it claims to
  const t = {type: 'object', required: ['a'], additionalProperties: false, properties: {a: {type: 'integer', minimum: 1}, d: {type: 'string', format: 'date'}, s: {enum: ['x']}}, if: {properties: {s: {const: 'x'}}, required: ['s']}, then: {required: ['d']}};
  assert.deepEqual(validate(t, {a: 1}), []);
  assert.match(validate(t, {})[0], /missing "a"/);
  assert.match(validate(t, {a: 0})[0], /at least 1/);
  assert.match(validate(t, {a: 1, z: 1})[0], /unknown field "z"/);
  assert.match(validate(t, {a: 1, d: '2026-13-40'})[0], /valid date/);
  assert.match(validate(t, {a: 1, s: 'x'})[0], /missing "d"/, 'if/then applies');
  assert.throws(() => validate({oneOf: []}, 1), /not supported/);

  // engine sync
  const {THEMES} = await import('../engine/src/themes.ts');
  const {SPECS} = await import('../engine/src/primitives/specs.ts');
  const sb = await import('../engine/src/composer/storyboard.ts');
  const all = Object.keys(SAMPLES).map(loadSchema);
  const same = (key: string, want?: readonly string[]) => {
    const found = all.flatMap((s) => enumsAt(s, key));
    assert.ok(found.length, `no "${key}" enum found`);
    for (const en of found) assert.deepEqual([...en].sort(), [...(want ?? found[0])].sort(), `"${key}" enum out of sync`);
  };
  same('theme', Object.keys(THEMES));
  same('themes', Object.keys(THEMES));
  same('host', sb.HOST_NAMES);
  same('captionStyle', sb.CAPTION_STYLES);
  same('transition', sb.TRANSITIONS);
  same('primitive', Object.keys(SPECS));
  same('hookPattern', sb.HOOK_PATTERNS);
  same('hook_pattern', sb.HOOK_PATTERNS);
  same('primitives', Object.keys(SPECS));
  same('opening', Object.keys(SPECS));
  same('transitions', sb.TRANSITIONS);
  same('channel');
  same('platform');
  same('targets', enumsAt(loadSchema('channel'), 'platform')[0]);

  // samples: schema, and for storyboards the engine's own checks too (params, text limits, closer, vo length)
  let bad = 0;
  for (const [n, fs_] of Object.entries(SAMPLES)) {
    for (const f of fs_) {
      const doc = read(f);
      const errs = [...validate(loadSchema(n), doc), ...(n === 'storyboard' ? sb.validateStoryboard(doc).errors : [])];
      bad += +!!errs.length;
      console.log(errs.length ? `FAIL ${n.padEnd(11)} ${f}\n  ${errs.join('\n  ')}` : `ok   ${n.padEnd(11)} ${f}`);
    }
  }
  // the rules that protect publishing and honesty must reject a broken copy of a good sample
  const broken = (n: string, f: string, change: (d: any) => void, want: RegExp) => {
    const d = read(f);
    change(d);
    assert.match(validate(loadSchema(n), d).join('\n'), want, `${n}: expected ${want}`);
  };
  broken('ledger', 'schemas/samples/ledger.json', (d) => delete d.approved_by, /missing "approved_by"/); // approval needs a person
  broken('ledger', 'schemas/samples/ledger.json', (d) => (d.status = 'published', delete d.targets), /missing "targets"/);
  broken('storyboard', 'engine/content/storyboards/host-supplier-bills.json', (d) => delete d.meta.source, /missing "source"/); // no feed link, no video
  broken('storyboard', 'engine/content/storyboards/host-supplier-bills.json', (d) => (d.scenes[0].primitive = 'made-up'), /must be one of/);
  broken('qa', 'schemas/samples/qa.json', (d) => delete d.checks[3].error, /missing "error"/); // a failed check must say why
  broken('idea', 'schemas/samples/idea.json', (d) => (d.source_url = 'not a link'), /valid uri/);
  if (bad) process.exit(1);
  console.log('schemas ok');
};

if (import.meta.main) await main();
