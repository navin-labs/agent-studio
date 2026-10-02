// Telegram approvals: approve the week from the phone, anywhere, with nothing opened to the internet.
// send(): each QA-passed, not yet approved video of the week goes to Navin's chat with an Approve button (+ "Approve all").
// poll(): the Mac long-polls Telegram for button taps (no webhook, no tunnel). A tap only counts when it comes from
// TELEGRAM_CHAT_ID in that private chat; it is then turned into the same signed approval the web links use and goes through
// applyApproval() (QA, week, channel and replay checks all apply). The bot token never leaves .env and is never logged.
//
// node studio/telegram.ts <channel> <YYYY-Www>   send the week for approval
// polling runs inside approve-server.ts when TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are set
import fs from 'node:fs';
import path from 'node:path';
import {applyApproval, approvalQuery, currentStatus, findVideo, PATHS, type Paths, weekVideos} from './ledger.ts';

export type Tg = (method: string, body: Record<string, unknown> | FormData) => Promise<any>;
export const telegram = (token: string): Tg => async (method, body) => {
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, body instanceof FormData ? {method: 'POST', body} : {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(body)});
  const j = await r.json().catch(() => ({}));
  if (!j.ok) throw new Error(`telegram ${method}: ${j.description ?? `HTTP ${r.status}`}`); // never includes the token
  return j.result;
};

const button = (text: string, data: string) => ({inline_keyboard: [[{text, callback_data: data}]]}); // callback_data max 64 bytes

export const send = async (tg: Tg, chatId: string, channel: string, week: string, p: Paths = PATHS) => {
  const status = currentStatus(p);
  const ready = weekVideos(channel, week, p).map((x) => x.video).filter((v) => v?.qa?.pass && !status.get(v.id)?.status?.match(/approved|dispatched|published/));
  for (const v of ready) {
    const form = new FormData();
    form.set('chat_id', chatId);
    form.set('caption', `${v!.id}\n\n${String(v!.doc.caption).slice(0, 900)}`);
    form.set('reply_markup', JSON.stringify(button('Approve', `a|${v!.id}`)));
    form.set('video', new Blob([fs.readFileSync(path.join(v!.outDir, 'reel.mp4'))], {type: 'video/mp4'}), `${v!.id}.mp4`);
    await tg('sendVideo', form);
  }
  if (ready.length > 1) await tg('sendMessage', {chat_id: chatId, text: `${channel} ${week}: ${ready.length} videos passed QA.`, reply_markup: button(`Approve all ${ready.length}`, `A|${channel}|${week}`)});
  return ready.map((v) => v!.id);
};

// One update from getUpdates. Returns the reply shown to Navin, or null when the update is ignored.
export const onUpdate = async (tg: Tg, u: any, o: {chatId: string; secret: string; paths?: Paths; now?: number}) => {
  const q = u.callback_query;
  if (!q) return null;
  const mine = String(q.from?.id) === o.chatId && String(q.message?.chat?.id) === o.chatId; // Navin, in his private chat with the bot
  let text: string;
  if (!mine) text = 'Not allowed.';
  else {
    const p = o.paths ?? PATHS;
    const now = o.now ?? Date.now();
    const [kind, a, b] = String(q.data ?? '').split('|');
    const v = kind === 'a' ? findVideo(a, p) : null;
    const target = kind === 'A' ? {channel: a, week: b, ids: weekVideos(a, b, p).flatMap((x) => (x.video ? [x.video.id] : []))} : v?.recipe ? {channel: v.doc.channel, week: v.recipe.week, ids: [v.id]} : null;
    if (!target) text = 'Video not found.';
    else
      try {
        const r = applyApproval(approvalQuery({...target, by: 'navin', exp: Math.floor(now / 1000) + 60}, o.secret), o.secret, {paths: p, now});
        text = [r.written.length ? `Approved: ${r.written.map((e) => e.storyboard_id).join(', ')}` : 'Nothing new approved.', ...r.skipped].join('\n');
      } catch (e) {
        text = `Refused: ${(e as Error).message}`;
      }
    await tg('sendMessage', {chat_id: o.chatId, text});
  }
  await tg('answerCallbackQuery', {callback_query_id: q.id, text: text.slice(0, 190)}).catch(() => {});
  return text;
};

// Long-poll forever; the offset file stops a restart from replaying taps.
export const poll = async (tg: Tg, o: {chatId: string; secret: string}, p: Paths = PATHS) => {
  const f = path.join(p.state, 'telegram-offset');
  let offset = fs.existsSync(f) ? Number(fs.readFileSync(f, 'utf8')) : 0;
  for (;;) {
    try {
      for (const u of await tg('getUpdates', {offset, timeout: 50, allowed_updates: ['callback_query']})) {
        offset = u.update_id + 1;
        fs.writeFileSync(f, String(offset));
        console.log(`telegram: ${(await onUpdate(tg, u, o)) ?? 'ignored'}`.replace(/\n/g, '; '));
      }
    } catch (e) {
      console.error((e as Error).message);
      await new Promise((r) => setTimeout(r, 10_000));
    }
  }
};

if (import.meta.main) {
  const [channel, week] = process.argv.slice(2);
  if (!channel || !/^\d{4}-W\d{2}$/.test(week ?? '')) {
    console.error('usage: node studio/telegram.ts <channel> <YYYY-Www>');
    process.exit(2);
  }
  const envFile = path.join(import.meta.dirname, '..', '.env');
  if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
  const {TELEGRAM_BOT_TOKEN: token, TELEGRAM_CHAT_ID: chatId} = process.env;
  if (!token || !chatId) {
    console.error('Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in agent-studio/.env first.');
    process.exit(2);
  }
  const ids = await send(telegram(token), chatId, channel, week);
  console.log(ids.length ? `sent ${ids.length} for approval: ${ids.join(', ')}` : 'nothing to send (no QA-passed video waiting for approval)');
}
