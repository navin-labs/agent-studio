// Do the shipped n8n workflows satisfy the receiver's guards, and do they send the helper token yet? Reads n8n/*.json only (no n8n,
// no network). node studio/n8n-compat.test.ts            guards: every call goes to an allowed Host, every POST is JSON, none sends Origin
//                node studio/n8n-compat.test.ts --require-token   also fails unless EVERY call sends x-forge-token: run this, and get
//                                                          exit 0, before setting LOCAL_API_TOKEN (docs/SECURITY.md, n8n/README.md)
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const dir = path.join(import.meta.dirname, '../n8n');
type Call = {file: string; node: string; route: string; post: boolean; json: boolean; host: string; token: boolean};
// the object literal after each `httpRequest(`, by brace matching
const literals = (code: string) => {
  const out: string[] = [];
  for (let i = code.indexOf('httpRequest('); i >= 0; i = code.indexOf('httpRequest(', i + 1)) {
    const start = code.indexOf('{', i);
    let depth = 0, j = start;
    for (; j < code.length; j++) {
      if (code[j] === '{') depth++;
      else if (code[j] === '}' && --depth === 0) break;
    }
    out.push(code.slice(start, j + 1));
  }
  return out;
};
export const receiverCalls = (): Call[] =>
  fs.readdirSync(dir).filter((f) => f.endsWith('.json')).flatMap((file) => {
    const wf = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    const code = (wf.nodes as {name: string; parameters?: {jsCode?: string}}[]).flatMap((n) => literals(n.parameters?.jsCode ?? '').map((lit) => ({node: n.name, lit, all: n.parameters!.jsCode!})));
    return code.flatMap(({node, lit, all}) => {
      const url = lit.match(/url:\s*[`'"]([^`'"]*)[`'"]/)?.[1] ?? '';
      const viaMac = url.startsWith('${mac}');
      if (!viaMac && !url.includes(':5680')) return [];
      const host = viaMac ? all.match(/const mac = ['"`]https?:\/\/([^:'"`/]+)/)?.[1] ?? '?' : url.match(/https?:\/\/([^:/]+)/)?.[1] ?? '?';
      return [{file, node, route: (viaMac ? url.slice(6) : url.split(':5680')[1]).split('?')[0], post: /method:\s*['"]POST['"]/.test(lit), json: /json:\s*true/.test(lit), host, token: /x-forge-token/i.test(lit)}];
    });
  });

if (import.meta.main) {
  const calls = receiverCalls();
  assert.ok(calls.length >= 12, `found ${calls.length} receiver calls in n8n/*.json`);
  for (const c of calls) {
    assert.ok(['host.docker.internal', '127.0.0.1', 'localhost'].includes(c.host), `${c.file} ${c.route}: Host ${c.host} would be refused by the receiver`);
    assert.ok(!c.post || c.json, `${c.file} ${c.route}: a POST must send json: true (the receiver refuses bodies that are not application/json)`);
  }
  const without = calls.filter((c) => !c.token);
  console.log(`n8n-compat ok: ${calls.length} calls in ${new Set(calls.map((c) => c.file)).size} workflows satisfy the Host and JSON guards; ${calls.length - without.length} of ${calls.length} send x-forge-token`);
  if (process.argv.includes('--require-token') && without.length) {
    console.error(`NOT READY for LOCAL_API_TOKEN: ${without.length} call(s) do not send x-forge-token:\n${without.map((c) => `  ${c.file}  ${c.route}`).join('\n')}`);
    process.exit(1);
  }
}
