// Approve receiver on the Mac. n8n runs in Docker and cannot see this repo, so its approval webhook forwards the signed query
// here (http://host.docker.internal:5680/approve?...). Everything is verified by ledger.ts; this only moves bytes.
// /dispatch-check?id= lets n8n's YouTube workflow confirm a video is approved before it uploads (defence in depth).
// Also polls Telegram for Approve taps when configured (studio/telegram.ts). Listens on 127.0.0.1 only. The secret stays in agent-studio/.env (APPROVAL_SECRET); n8n never holds it.
//
// node studio/approve-server.ts            (APPROVE_PORT, default 5680)
// node studio/approve-server.ts --install  run it at login via launchd (log: state/approve.log)
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {plan} from './dispatch.ts';
import {applyApproval} from './ledger.ts';
import {due, record} from './metrics.ts';
import {poll, telegram} from './telegram.ts';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c]!);
const page = (title: string, lines: string[]) =>
  `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title><body style="font:18px/1.5 system-ui;padding:24px"><h1>${esc(title)}</h1>${lines.map((l) => `<p>${esc(l)}</p>`).join('')}</body>`;

export const handle = (url: string, secret: string, opts?: Parameters<typeof applyApproval>[2]): {status: number; body: string} => {
  const u = new URL(url, 'http://local');
  if (u.pathname === '/health') return {status: 200, body: 'ok'};
  // n8n's YouTube workflow asks this before every upload: yes only if the dispatcher would send this video now
  if (u.pathname === '/dispatch-check') {
    const id = u.searchParams.get('id') ?? '';
    const ok = plan(opts?.paths, opts?.now).youtube.some((j) => j.storyboard_id === id);
    return {status: ok ? 200 : 403, body: ok ? 'approved' : 'not approved for dispatch'};
  }
  // n8n's YouTube stats workflow: which readings are due (JSON)
  if (u.pathname === '/metrics-due') return {status: 200, body: JSON.stringify(due(opts?.paths, opts?.now))};
  if (u.pathname !== '/approve') return {status: 404, body: page('Not found', [])};
  try {
    const r = applyApproval(u.search.slice(1), secret, opts);
    return {status: 200, body: page(r.written.length ? `Approved ${r.written.length}` : 'Nothing new approved', [...r.written.map((e) => `${e.storyboard_id}: approved for ${e.targets!.join(', ')}`), ...r.skipped])};
  } catch (e) {
    return {status: 403, body: page('Refused', [(e as Error).message])};
  }
};

const install = () => {
  const label = 'com.theautomationguy.approve';
  const root = path.join(import.meta.dirname, '..');
  const plist = path.join(os.homedir(), 'Library/LaunchAgents', `${label}.plist`);
  const log = path.join(root, 'state', 'approve.log');
  fs.mkdirSync(path.dirname(log), {recursive: true});
  fs.writeFileSync(
    plist,
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>${label}</string>
  <key>ProgramArguments</key><array><string>${esc(process.execPath)}</string><string>${esc(path.join(root, 'studio/approve-server.ts'))}</string></array>
  <key>WorkingDirectory</key><string>${esc(root)}</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>${esc(log)}</string>
  <key>StandardErrorPath</key><string>${esc(log)}</string>
</dict></plist>
`,
  );
  spawnSync('launchctl', ['unload', plist]);
  const r = spawnSync('launchctl', ['load', '-w', plist], {encoding: 'utf8'});
  console.log(r.status === 0 ? `installed ${label} (${plist}); log: ${log}` : `launchctl failed: ${r.stderr}`);
};

if (import.meta.main && process.argv.includes('--install')) install();
else if (import.meta.main) {
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
      // POST /metrics: rows from n8n (YouTube statistics), checked by metrics.ts before anything is written
      if (req.method === 'POST' && (req.url ?? '').split('?')[0] === '/metrics') {
        let raw = '';
        req.on('data', (c) => (raw = raw.length < 1_000_000 ? raw + c : raw));
        req.on('end', () => {
          let r: {recorded: number; errors: string[]};
          try {
            const j = JSON.parse(raw);
            r = record(Array.isArray(j) ? j : [j]);
          } catch (e) {
            r = {recorded: 0, errors: [`not valid JSON: ${(e as Error).message}`]};
          }
          console.log(`${new Date().toISOString()} POST /metrics -> ${r.errors.length ? 400 : 200} (${r.recorded} recorded)`);
          res.writeHead(r.errors.length ? 400 : 200, {'content-type': 'application/json'});
          res.end(JSON.stringify(r));
        });
        return;
      }
      const {status, body} = req.method === 'GET' ? handle(req.url ?? '/', secret) : {status: 405, body: 'GET only'};
      console.log(`${new Date().toISOString()} ${req.method} ${(req.url ?? '').split('?')[0]} -> ${status}`); // never log the query (it carries the signature)
      res.writeHead(status, {'content-type': body.startsWith('<!doctype') ? 'text/html; charset=utf-8' : body.startsWith('[') ? 'application/json' : 'text/plain', 'cache-control': 'no-store'});
      res.end(body);
    })
    .listen(port, '127.0.0.1', () => console.log(`approve receiver on http://127.0.0.1:${port} (n8n: http://host.docker.internal:${port}/approve)`));
  // Telegram approvals from the phone (studio/telegram.ts): outbound long-polling only
  const {TELEGRAM_BOT_TOKEN: token, TELEGRAM_CHAT_ID: chatId} = process.env;
  if (token && chatId) poll(telegram(token), {chatId, secret}).catch((e) => console.error(e.message));
  console.log(token && chatId ? 'telegram approvals: polling' : 'telegram approvals: off (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID not set)');
}
