// Approve receiver on the Mac. n8n runs in Docker and cannot see this repo, so its approval webhook forwards the signed query
// here (http://host.docker.internal:5680/approve?...). Everything is verified by ledger.ts; this only moves bytes.
// Listens on 127.0.0.1 only. The secret stays in agent-studio/.env (APPROVAL_SECRET); n8n never holds it.
//
// node studio/approve-server.ts            (APPROVE_PORT, default 5680)
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {applyApproval} from './ledger.ts';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c]!);
const page = (title: string, lines: string[]) =>
  `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title><body style="font:18px/1.5 system-ui;padding:24px"><h1>${esc(title)}</h1>${lines.map((l) => `<p>${esc(l)}</p>`).join('')}</body>`;

export const handle = (url: string, secret: string, opts?: Parameters<typeof applyApproval>[2]): {status: number; body: string} => {
  const u = new URL(url, 'http://local');
  if (u.pathname === '/health') return {status: 200, body: 'ok'};
  if (u.pathname !== '/approve') return {status: 404, body: page('Not found', [])};
  try {
    const r = applyApproval(u.search.slice(1), secret, opts);
    return {status: 200, body: page(r.written.length ? `Approved ${r.written.length}` : 'Nothing new approved', [...r.written.map((e) => `${e.storyboard_id}: approved for ${e.targets!.join(', ')}`), ...r.skipped])};
  } catch (e) {
    return {status: 403, body: page('Refused', [(e as Error).message])};
  }
};

if (import.meta.main) {
  const envFile = path.join(import.meta.dirname, '..', '.env');
  if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
  const secret = process.env.APPROVAL_SECRET ?? '';
  if (secret.length < 16) {
    console.error('Set APPROVAL_SECRET (16+ characters) in agent-studio/.env first.');
    process.exit(1);
  }
  const port = Number(process.env.APPROVE_PORT ?? 5680);
  http
    .createServer((req, res) => {
      const {status, body} = req.method === 'GET' ? handle(req.url ?? '/', secret) : {status: 405, body: 'GET only'};
      console.log(`${new Date().toISOString()} ${req.method} ${(req.url ?? '').split('?')[0]} -> ${status}`); // never log the query (it carries the signature)
      res.writeHead(status, {'content-type': status === 200 && body === 'ok' ? 'text/plain' : 'text/html; charset=utf-8', 'cache-control': 'no-store'});
      res.end(body);
    })
    .listen(port, '127.0.0.1', () => console.log(`approve receiver on http://127.0.0.1:${port} (n8n: http://host.docker.internal:${port}/approve)`));
}
