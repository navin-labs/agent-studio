// The production loop: one idempotent tick, run every hour by launchd. Safe to run any time, any number of times.
//   every tick:  file Forge's metrics (inbox/metrics), send newly QA-passed videos to Telegram (each once), dispatch approved,
//                mark videos Forge has posted (posted.json in their queue folder) as published
//   PLAN_DAY:    for each live channel, Learn for next week, then write next week's recipes (never overwrites) and tell Navin
//                they are ready for Forge
// Only channels with "live": true in channel.json are touched. Dispatch also needs DISPATCH_LIVE=on (else it is a dry run).
// Every failure is logged and sent to Telegram; one failing step never stops the others.
//
// node studio/run.ts tick              run once now
// node studio/run.ts --install         run every hour via launchd (log: state/run.log)
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {dispatch, markPublished, plan} from './dispatch.ts';
import {runLearn} from './learn.ts';
import {PATHS, type Paths, repairFingerprints} from './ledger.ts';
import {ingest} from './metrics.ts';
import {addDays, isoWeek} from './novelty.ts';
import {planWeek} from './recipe.ts';
import {askResolve, notify, send, type Tg, telegram} from './telegram.ts';

export const PLAN_DAY = 4; // Thursday (IST): recipes for next week, so Forge writes Thu-Fri and Navin approves over the weekend
const ROOT = path.join(import.meta.dirname, '..');

export const liveChannels = (p: Paths = PATHS): string[] =>
  fs.readdirSync(p.channels).filter((c) => JSON.parse(fs.readFileSync(path.join(p.channels, c, 'channel.json'), 'utf8')).live === true);

// IST calendar date and weekday for a moment
const ist = (now: number) => {
  const d = new Date(now + 5.5 * 3600_000);
  return {date: d.toISOString().slice(0, 10), weekday: d.getUTCDay()};
};

// Production renders with THIS repo's engine: the studiowatch LaunchAgent must be loaded and point at agent-studio/engine.
// (The old v1 watcher, com.theautomationguy.reelwatch, only watches ~/Dev/projects/reel-engine and never sees these boards.)
export const WATCH_LABEL = 'com.theautomationguy.studiowatch';
export const OLD_WATCH_LABEL = 'com.theautomationguy.reelwatch'; // the v1 watcher (reel-engine)
export const watcherProblem = (o: {agents?: string; loaded?: () => string} = {}): string | null => {
  const plist = path.join(o.agents ?? path.join(os.homedir(), 'Library/LaunchAgents'), `${WATCH_LABEL}.plist`);
  if (!fs.existsSync(plist)) return `the render watcher is not installed: cd engine && npm run watch:install`;
  const want = path.join(ROOT, 'engine', 'scripts', 'watch.mjs');
  if (!fs.readFileSync(plist, 'utf8').includes(`<string>${want}</string>`)) return `the render watcher (${WATCH_LABEL}) does not run ${want}: cd engine && npm run watch:install`;
  const loaded = (o.loaded ?? (() => spawnSync('launchctl', ['list'], {encoding: 'utf8'}).stdout ?? ''))();
  const running = (label: string) => loaded.split('\n').some((l) => l.trim().endsWith(label));
  if (!running(WATCH_LABEL)) return `the render watcher is installed but not running: launchctl load -w ${plist}`;
  // both watchers render and copy to Drive; once a channel is live only this repo's may run (SETUP.md step 5 order)
  if (running(OLD_WATCH_LABEL)) return `two watchers are loaded (${OLD_WATCH_LABEL} from reel-engine and ${WATCH_LABEL}): install the Forge skills, then launchctl unload ~/Library/LaunchAgents/${OLD_WATCH_LABEL}.plist`;
  return null;
};

export type TickOpts = {watcher?: () => string | null; fetch?: Parameters<typeof dispatch>[1]['fetch']; now?: number; paths?: Paths; tg?: Tg | null; chatId?: string; live?: boolean; youtubeUrl?: string; plan?: (ch: string, week: string) => {recipes: unknown[]}; inbox?: string};

export const tick = async (o: TickOpts = {}) => {
  const p = o.paths ?? PATHS;
  const now = o.now ?? Date.now();
  const log: string[] = [];
  const problems: string[] = [];
  const step = async (name: string, fn: () => unknown) => {
    try {
      const r = await fn();
      if (r) log.push(`${name}: ${r}`);
    } catch (e) {
      problems.push(`${name}: ${(e as Error).message}`);
    }
  };
  const say = async (text: string) => (o.tg && o.chatId ? notify(o.tg, o.chatId, text) : undefined);
  const {date, weekday} = ist(now);
  const thisWeek = isoWeek(date);
  const nextWeek = isoWeek(addDays(date, 7));
  const channels = liveChannels(p);

  if (channels.length) {
    const w = (o.watcher ?? watcherProblem)();
    if (w) problems.push(`render: ${w}`);
  }

  await step('fingerprints', () => {
    const fixed = repairFingerprints(p); // heals an approval that crashed between the ledger and the fingerprint write
    return fixed.length ? `repaired ${fixed.join(', ')}` : '';
  });

  await step('metrics', () => {
    const r = ingest(p, o.inbox);
    if (r.rejected.length) problems.push(`metrics rejected: ${r.rejected.join('; ')}`);
    return r.files ? `${r.recorded} row(s) from ${r.files} file(s)` : '';
  });

  for (const ch of channels) {
    if (weekday === PLAN_DAY && !fs.existsSync(path.join(p.recipes, ch, `${nextWeek}.json`)))
      await step(`plan ${ch} ${nextWeek}`, async () => {
        runLearn(ch, nextWeek, p);
        const r = o.plan ? o.plan(ch, nextWeek) : planWeek(ch, nextWeek, {recipes: p.recipes, state: p.state});
        await say(`${ch} ${nextWeek}: ${r.recipes.length} recipes are ready. Forge: write the week (Weekly Writer skill).`);
        return `${r.recipes.length} recipes`;
      });
    if (o.tg && o.chatId)
      for (const w of [thisWeek, nextWeek])
        await step(`telegram ${ch} ${w}`, async () => {
          const ids = await send(o.tg!, o.chatId!, ch, w, p);
          return ids.length ? `sent ${ids.join(', ')}` : '';
        });
  }

  await step('dispatch', async () => {
    const pl = plan(p, now);
    const r = await dispatch(pl, {live: o.live ?? false, youtubeUrl: o.youtubeUrl, fetch: o.fetch, paths: p, now});
    // an upload whose YouTube result is unknown gets its own Telegram message with two buttons (askResolve), once per claim
    const buttons = !!(o.tg && o.chatId);
    const unknown = (x: string) => buttons && /--resolve|upload state unknown/.test(x);
    problems.push(...r.failed.filter((f) => !unknown(f)).map((f) => `dispatch ${f}`));
    // blocked videos of live channels are a problem worth a message; other channels' are expected until go-live
    problems.push(...pl.blocked.filter((b) => !/is not live/.test(b)).map((b) => `blocked ${b}`), ...pl.stuck.filter((b) => !unknown(b)).map((b) => `stuck ${b}`));
    if (buttons) await askResolve(o.tg!, o.chatId!, p);
    return r.sent.length ? `sent ${r.sent.join('; ')}` : '';
  });

  await step('published', () => {
    const r = markPublished(p, now);
    problems.push(...r.problems.map((x) => `queue ${x}`));
    return r.published.length ? `published ${r.published.join(', ')}` : '';
  });

  if (problems.length) await say(`agent-studio needs you:\n${problems.join('\n')}`).catch(() => {});
  return {log, problems, channels};
};

const install = () => {
  const label = 'com.theautomationguy.studio';
  const plist = path.join(os.homedir(), 'Library/LaunchAgents', `${label}.plist`);
  const log = path.join(ROOT, 'state', 'run.log');
  fs.mkdirSync(path.dirname(log), {recursive: true});
  fs.writeFileSync(
    plist,
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>${label}</string>
  <key>ProgramArguments</key><array><string>${process.execPath}</string><string>${path.join(ROOT, 'studio/run.ts')}</string><string>tick</string></array>
  <key>WorkingDirectory</key><string>${ROOT}</string>
  <key>StartInterval</key><integer>3600</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>${log}</string>
  <key>StandardErrorPath</key><string>${log}</string>
</dict></plist>
`,
  );
  spawnSync('launchctl', ['unload', plist]);
  const r = spawnSync('launchctl', ['load', '-w', plist], {encoding: 'utf8'});
  console.log(r.status === 0 ? `installed ${label} (every hour); log: ${log}` : `launchctl failed: ${r.stderr}`);
};

if (import.meta.main) {
  if (process.argv.includes('--install')) install();
  else if (process.argv[2] === 'tick') {
    const envFile = path.join(ROOT, '.env');
    if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
    const {TELEGRAM_BOT_TOKEN: token, TELEGRAM_CHAT_ID: chatId, DISPATCH_LIVE, YOUTUBE_WEBHOOK_URL} = process.env;
    const r = await tick({tg: token && chatId ? telegram(token) : null, chatId, live: DISPATCH_LIVE === 'on', youtubeUrl: YOUTUBE_WEBHOOK_URL});
    console.log(`${new Date().toISOString()} tick: live channels ${r.channels.join(', ') || 'none'}${r.log.length ? `; ${r.log.join('; ')}` : ''}${r.problems.length ? `; PROBLEMS: ${r.problems.join('; ')}` : ''}`);
  } else {
    console.error('usage: node studio/run.ts tick | --install');
    process.exit(2);
  }
}
