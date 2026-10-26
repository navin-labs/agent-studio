// Approve receiver on the Mac. n8n runs in Docker and cannot see this repo, so its approval webhook forwards the signed query
// here (http://host.docker.internal:5680/approve?...). Everything is verified by ledger.ts; this only moves bytes.
// /dispatch-check?id=&channel=&platform=youtube lets a channel's n8n YouTube workflow confirm that exactly this video of exactly
// that channel is being dispatched now, before it uploads (defence in depth; channel and platform are required).
// Also polls Telegram for Approve taps when configured (studio/telegram.ts). Listens on 127.0.0.1 only. The secret stays in the repo-root .env (APPROVAL_SECRET); n8n never holds it.
//
// node studio/approve-server.ts            (APPROVE_PORT, default 5680)
// node studio/approve-server.ts --install  run it at login via launchd (log: state/approve.log)
import {daysDue, recordDays, step as expStep} from './experiment.ts';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import {timingSafeEqual} from 'node:crypto';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {plan} from './dispatch.ts';
import {applyApproval, currentStatus, lkey} from './ledger.ts';
import {feeds, type Get, ingestFeed, pullFeed} from './feed.ts';
import {due, record} from './metrics.ts';
import {poll, telegram} from './telegram.ts';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c]!);
const page = (title: string, lines: string[]) =>
  `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title><body style="font:18px/1.5 system-ui;padding:24px"><h1>${esc(title)}</h1>${lines.map((l) => `<p>${esc(l)}</p>`).join('')}</body>`;

export const handle = (url: string, secret: string, opts?: Parameters<typeof applyApproval>[2]): {status: number; body: string} => {
  const u = new URL(url, 'http://local');
  if (u.pathname === '/health') return {status: 200, body: 'ok'};
  // ?channel=<id>: each channel's n8n workflow (its own YouTube credential) sees and may change only that channel's videos
  const only = u.searchParams.get('channel');
  const mine = <T extends {channel: string}>(xs: T[]) => (only ? xs.filter((x) => x.channel === only) : xs);
  // n8n's YouTube workflow asks this before every upload: yes only if the dispatcher would send this video now
  if (u.pathname === '/dispatch-check') {
    const id = u.searchParams.get('id') ?? '';
    // each channel's upload workflow names its channel and the platform on every ask; anything else is a wrong pair: refused
    if (!only || u.searchParams.get('platform') !== 'youtube') return {status: 403, body: 'ask with channel=<this workflow\'s channel> and platform=youtube'};
    // dispatch claims a variant ("dispatching") just before it calls n8n, so the claim in flight is what says yes (30 minutes)
    const e = currentStatus(opts?.paths).get(lkey(id, 'youtube'));
    const inFlight = e?.status === 'dispatching' && e.channel === only && !e.post_urls?.some((x) => x.includes('youtube.com/')) && (opts?.now ?? Date.now()) - Date.parse(e.updated_at) < 30 * 60_000;
    const ok = inFlight || mine(plan(opts?.paths, opts?.now).youtube).some((j) => j.storyboard_id === id);
    return {status: ok ? 200 : 403, body: ok ? 'approved' : 'not approved for dispatch'};
  }
  // n8n's feed workflow: which feeds to fetch (JSON)
  if (u.pathname === '/feeds') return {status: 200, body: JSON.stringify(feeds(opts?.paths).map(({source, url}) => ({source, url})))};
  // n8n's YouTube stats workflow: which readings are due (JSON)
  if (u.pathname === '/metrics-due') return {status: 200, body: JSON.stringify(mine(due(opts?.paths, opts?.now)))};
  // n8n's packaging workflow asks this before changing a live title or thumbnail: yes only if the experiment step wants exactly this now
  if (u.pathname === '/packaging-check') {
    const q = (k: string) => u.searchParams.get(k);
    const ok = !!only && mine(expStep(opts?.paths, opts?.now).actions).some((a) => a.storyboard_id === q('id') && a.video_id === q('video_id') && a.title === q('title'));
    return {status: ok ? 200 : 403, body: ok ? 'approved' : 'not an experiment step due now'};
  }
  // n8n's YouTube stats workflow: which experiment days still need YouTube Analytics numbers (JSON)
  if (u.pathname === '/experiment-days-due') return {status: 200, body: JSON.stringify(mine(daysDue(opts?.paths, opts?.now)))};
  if (u.pathname !== '/approve') return {status: 404, body: page('Not found', [])};
  try {
    const r = applyApproval(u.search.slice(1), secret, opts);
    return {status: 200, body: page(r.written.length ? `Approved ${r.written.length}` : 'Nothing new approved', [...r.written.map((e) => `${e.storyboard_id} ${e.platform}: approved`), ...r.skipped])};
  } catch (e) {
    return {status: 403, body: page('Refused', [(e as Error).message])};
  }
};

// The POST endpoints, as a plain function (tested in feed.test.ts and metrics.test.ts).
export const post = async (route: string, raw: string, tooBig = false, opts?: {paths?: Parameters<typeof record>[1]; root?: string; fetch?: Get}): Promise<{status: number; body: unknown}> => {
  if (tooBig) return {status: 413, body: {errors: ['body over 5 MB']}};
  let j: any;
  try {
    j = JSON.parse(raw);
  } catch (e) {
    return {status: 400, body: {errors: [`not valid JSON: ${(e as Error).message}`]}};
  }
  if (route === '/experiment-days') {
    const r = recordDays(Array.isArray(j) ? j : [j], opts?.paths);
    return {status: r.errors.length ? 400 : 200, body: r};
  }
  if (route === '/metrics') {
    const r = record(Array.isArray(j) ? j : [j], opts?.paths);
    return {status: r.errors.length ? 400 : 200, body: r};
  }
  if (route !== '/feed') return {status: 404, body: {errors: [`no POST route ${route}`]}};
  try {
    if (typeof j?.url !== 'string') throw new Error('send {"url": "<feed url>"} (the Mac fetches it) or {"url", "body": "<the feed text>"}');
    // {url}: the Mac fetches (Reddit blocks the n8n container); {url, body}: n8n already fetched it
    return {status: 200, body: typeof j.body === 'string' ? ingestFeed(j.url, j.body, {paths: opts?.paths, root: opts?.root}) : await pullFeed(j.url, {paths: opts?.paths, root: opts?.root, fetch: opts?.fetch})};
  } catch (e) {
    return {status: 400, body: {errors: [(e as Error).message]}};
  }
};

// ---- the HTTP layer ----
export const LIMITS = {body: 5_000_000, bodyMs: 30_000};
const HOSTS = new Set(['127.0.0.1', 'localhost', 'host.docker.internal', '[::1]']);
const POST_ROUTES = new Set(['/metrics', '/experiment-days', '/feed']);
const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
// What a browser page on the internet could do to a loopback service: a DNS-rebinding page sends another Host, a cross-site form or
// fetch sends Origin and (without a preflight) a text/plain body. n8n sends none of these, so refusing them costs nothing.
export const guard = (method: string, route: string, h: http.IncomingHttpHeaders, token = ''): {status: number; body: string} | null => {
  const host = String(h.host ?? '').replace(/:\d+$/, '');
  if (!HOSTS.has(host)) return {status: 421, body: 'unexpected Host'};
  if (h.origin !== undefined) return {status: 403, body: 'browser requests are refused'};
  if (method !== 'GET' && method !== 'POST') return {status: 405, body: 'GET or POST only'};
  if (method === 'POST') {
    if (!POST_ROUTES.has(route)) return {status: 404, body: JSON.stringify({errors: [`no POST route ${route}`]})};
    if (!String(h['content-type'] ?? '').toLowerCase().startsWith('application/json')) return {status: 415, body: JSON.stringify({errors: ['send application/json']})};
  }
  if (token && route !== '/health' && route !== '/approve' && !same(String(h['x-forge-token'] ?? ''), token)) return {status: 401, body: 'token required'};
  return null;
};

export const makeServer = (secret: string, o: {token?: string; limits?: Partial<typeof LIMITS>; paths?: Parameters<typeof record>[1]; root?: string; fetch?: Get} = {}) => {
  const L = {...LIMITS, ...o.limits};
  return http.createServer((req, res) => {
    const route = (req.url ?? '').split('?')[0];
    const send = (status: number, body: unknown, close = false) => {
      const text = typeof body === 'string' ? body : JSON.stringify(body);
      res.writeHead(status, {'content-type': text.startsWith('<!doctype') ? 'text/html; charset=utf-8' : text.startsWith('[') || text.startsWith('{') ? 'application/json' : 'text/plain', 'cache-control': 'no-store', 'content-length': Buffer.byteLength(text), ...(close ? {connection: 'close'} : {})});
      res.end(text);
      console.log(`${new Date().toISOString()} ${req.method} ${route} -> ${status}`); // never log the query (it carries the signature)
    };
    const refused = guard(req.method ?? '', route, req.headers, o.token);
    if (refused) return send(refused.status, refused.body, true);
    if (req.method === 'GET') {
      const {status, body} = handle(req.url ?? '/', secret, o.paths ? {paths: o.paths as never} : undefined);
      return send(status, body);
    }
    // POST from n8n: /metrics (YouTube statistics rows), /experiment-days (experiment analytics) and /feed ({url} or {url, body}).
    // The body is bounded three ways: declared length, bytes actually received, and a total deadline (a trickling client is cut off).
    if (Number(req.headers['content-length'] ?? 0) > L.body) {
      send(413, {errors: [`body over ${L.body} bytes`]}, true);
      return void req.destroy();
    }
    const chunks: Buffer[] = [];
    let size = 0;
    let done = false;
    const finish = (status: number, body: unknown) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      send(status, body, true);
    };
    const timer = setTimeout(() => {
      finish(408, {errors: ['request body too slow']});
      req.destroy();
    }, L.bodyMs);
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > L.body) {
        finish(413, {errors: [`body over ${L.body} bytes`]});
        req.destroy(); // stop reading; nothing past the cap is ever buffered
      } else chunks.push(c);
    });
    req.on('error', () => {
      done = true;
      clearTimeout(timer);
    });
    req.on('close', () => clearTimeout(timer));
    req.on('end', async () => {
      if (done) return;
      const {status, body} = await post(route, Buffer.concat(chunks).toString('utf8'), false, {paths: o.paths, root: o.root, fetch: o.fetch}).catch((e: Error): {status: number; body: unknown} => {
        console.error(e.message);
        return {status: 500, body: {errors: ['internal error']}};
      });
      finish(status, body);
    });
  });
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
    console.error('Set APPROVAL_SECRET (16+ characters) in the repo-root .env first.');
    process.exit(1);
  }
  const port = Number(process.env.APPROVE_PORT ?? 5680);
  const apiToken = process.env.LOCAL_API_TOKEN ?? '';
  if (apiToken && apiToken.length < 16) {
    console.error('LOCAL_API_TOKEN must be 16+ characters (or unset).');
    process.exit(1);
  }
  makeServer(secret, {token: apiToken}).listen(port, '127.0.0.1', () => console.log(`approve receiver on http://127.0.0.1:${port} (n8n: http://host.docker.internal:${port}/approve)`));
  console.log(apiToken.length >= 16 ? 'helper endpoints: LOCAL_API_TOKEN required (header x-forge-token)' : 'helper endpoints: NO token (set LOCAL_API_TOKEN, 16+ characters, and send it from n8n); Host, Origin and JSON checks still apply');
  // Telegram approvals from the phone (studio/telegram.ts): outbound long-polling only
  const {TELEGRAM_BOT_TOKEN: token, TELEGRAM_CHAT_ID: chatId} = process.env;
  if (token && chatId) poll(telegram(token), {chatId, secret}).catch((e) => console.error(e.message));
  console.log(token && chatId ? 'telegram approvals: polling' : 'telegram approvals: off (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID not set)');
}
