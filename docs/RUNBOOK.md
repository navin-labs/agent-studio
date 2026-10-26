# RUNBOOK: recovery for the failures that matter

Day-to-day operation and the full troubleshooting table are in [OPERATIONS.md](OPERATIONS.md). This file is the short recovery path for each critical scenario. All commands run from the repo root. Nothing here publishes by itself.

## Healthy means
- `curl -s http://127.0.0.1:5680/health` returns `ok` (approve receiver up).
- `state/approve.log` has recent lines; no `Refused` spikes.
- `node studio/dispatch.ts` (no flags = dry run: prints the plan, writes nothing, calls nothing) lists what would be sent and any `blocked` / `stuck` entries. Never add `--live` while diagnosing: with `DISPATCH_LIVE=on` it uploads. `tail -5 state/run.log` shows the last ticks.
- No `state/run.lock` older than one tick whose pid is gone (a stale lock is taken over automatically).

## Interrupted generation or render
1. Re-run the same command (`npm run make -- <board>` in `engine/`). `--force` only renders despite quality-gate errors; never use it to get past a real defect.
2. A half-written render is never approved: QA (`node studio/qa.ts <board>`) reads the exact file and manifest hash.
3. Disk full: free space, delete `engine/out/<old date>/` and `.cache/media/`, re-run.

## "ledger is locked by another process"
An approval, rejection, resolve, publish-mark or dispatch claim waited 30 s for the ledger lock (an exclusive SQLite transaction on `state/ledger.lock.db`). Normally the holder finishes in milliseconds. The operating system frees the lock the moment its holder dies, so there is nothing to delete and no stale lock. If it is held that long, the holder is alive but stuck: find it with `lsof state/ledger.lock.db`, look at it (a hung disk? a stopped process?), and restart that one process. Do not delete `ledger.lock.db` while a process runs. After any incident where two writers may have overlapped, run `node studio/dispatch.ts` (dry run) and read the ledger tail for a variant that went `dispatching` twice. A `state/ledger.lock` file from the old implementation can be deleted.

## Launch agents point at a folder that no longer exists (found 2026-10-26, read-only inspection)
The installed launch agents `com.theautomationguy.approve`, `.studio` (hourly tick) and `.studiowatch` run `~/Dev/projects/agent-studio/...`, which after the rename holds only a `state/` folder with the launchd log. Seen: the hourly tick exits with a Node module-not-found error (`LastExitStatus` 256, the log `agent-studio/state/run.log` shows it), the last successful tick in `state/run.log` is 2026-10-26T03:25Z, the receiver process (pid started Oct 24) still runs the OLD code from memory with the old folder path baked in, and `studiowatch` and `reelwatch` are not loaded. Nothing in this repo fixes that by itself and nothing was restarted. To repair, from the repo root and when you decide: `node studio/approve-server.ts --install`, `node studio/run.ts --install`, `node engine/scripts/watch.mjs --install` (each rewrites its plist with the current folder and reloads it), then check `launchctl list | grep theautomationguy` and `curl -s 127.0.0.1:5680/health`. Reinstalling restarts the receiver, which is also what puts the new SQLite lock into service for both the receiver and the tick at once.

## Failed QA
The variant is held alone; the others still go to approval. Fix the board (or let the Director repair it within the cost guard), re-render, re-run QA. A re-render has a new hash and needs a new approval.

## Invalid, expired, replayed or tampered approval
The receiver answers "Refused" and writes nothing. Ask for a fresh approval from Telegram or the weekly page. Never edit `ledger.jsonl` to force one.

## Corrupt ledger
- A torn last line is ignored and cut off on the next append: no action.
- "ledger.jsonl line N is not valid JSON": everything stops on purpose. Copy `state/` to a backup, open the file, fix or remove only line N after comparing with the backup and the n8n execution history, then re-run a tick. Do not delete earlier lines.

## Partial dispatch / uncertain publishing outcome
1. Status `dispatching` with no URL after 30 minutes, or Telegram "YouTube did not answer clearly": **do not re-upload.**
2. Check YouTube Studio (or the platform) for the video.
3. Published: tap Uploaded in Telegram, or `node studio/dispatch.ts --resolve <id> <youtube video id>`. Not published: tap Not uploaded; the next tick retries once.
4. Queued posts for Instagram/Facebook live in `queue/<channel>/<platform>/`; a crashed queue write resumes on the next tick.

## Model cost or call limit hit
The guard aborts the run and prints `COST WARNING` / the limit. A call that was killed or timed out reports no cost, so it is booked at its whole budget cap and marked `unknown` (the run then stops at the ceiling). Open the provider's usage page, find that call's real cost, and run `node studio/costguard.ts reconcile <path to run-ledger.json> <call number> <usd>` (the calls are numbered from 1 in the order of `calls`; the summary table says how many are unknown). A reconciled figure cannot be changed again. Look at the partial output in the run directory, adjust the board or the budget deliberately (env limits in `studio/costguard.ts` comments), and re-run. Do not loop `claude -p` unattended.

## Backup and restore
- Back up `state/` (ledger, fingerprints), `recipes/`, `ideas/`, `queue/` and `.env` (to a private location, not git). Example: `tar czf ~/forge-state-$(date +%F).tgz state recipes ideas queue`.
- Restore into a stopped system (unload the launch agents first), then start the approve receiver and run one tick.
- Rendered videos are reproducible from boards; the ledger is the only non-reproducible record.

## Retention
Keep ledger and fingerprints indefinitely (they enforce novelty and prevent double posting). `engine/out/` and `.cache/media/` can be pruned after a post's 7 day metrics reading.

## Trial report
`node studio/trial-report.ts [--since YYYY-MM-DD]` prints, from the ledger and the Director's run ledgers only: variants approved/dispatched/published/rejected/stuck per channel, approval-to-dispatch minutes, publish, rejection and re-render rates, model runs, error calls and estimated cost per run. It reads no titles, captions or links. Empty windows print `null` (n/a). Set numeric targets only after about four weeks of real data.

## Alert signals worth acting on
Repeated `Refused` on `/approve`; `unknown` upload outcomes; `stuck` entries; cost warnings; the Telegram alert "needs you". Alerting is the existing Telegram message; there is no separate monitoring stack, by design.
