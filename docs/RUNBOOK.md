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

## Launch agents after the folder rename (recovered 2026-10-26)
The agents `com.theautomationguy.approve`, `.studio` (hourly tick) and `.studiowatch` used to run `~/Dev/projects/agent-studio/...`, which no longer exists (the hourly tick failed from 2026-10-26T03:25Z until recovery). Recovery, done from this folder:
- **Receiver:** `/opt/homebrew/bin/node studio/approve-server.ts --install` (the Node launchd uses). Check: `/health` is `ok`, a foreign `Host` gives 421, an `Origin` header gives 403, `lsof -p <pid>` shows this folder as cwd, `state/ledger.lock.db` appears after the first locked operation.
- **Tick, first loaded in safe mode:** the plist carries `DISPATCH_LIVE=off` and `EXPERIMENTS=off` in `EnvironmentVariables`; they win over `.env`. To go live later, remove those two keys from `~/Library/LaunchAgents/com.theautomationguy.studio.plist`, then `launchctl unload` and `launchctl load -w` it (or run `node studio/run.ts --install`, which writes the plist without them). `launchctl load` on an already loaded job fails with "Input/output error": unload first.
- **Watcher:** do NOT use `watch.mjs --install` (it drops `PATH` and the overrides). The plist keeps its `PATH` and sets `FILMS=off`, `DISPATCH_LIVE=off`, `EXPERIMENTS=off`. `FILMS=on` sends every new board to the paid Director; enable it only deliberately (there is no ceiling across runs, each run has its own).
- **Watcher state:** `engine/out/.watch-state.json` is now keyed relative to `engine/` (`scripts/watch-state.mjs`); older absolute-path files are read as before. A renamed folder no longer makes every board look new.
- `com.theautomationguy.reelwatch` is the separate v1 watcher in `~/Dev/projects/reel-engine`; leave it unloaded.
- The Queue Publisher skill must not be installed in Forge until the overdue queue items are decided (see RELEASE_CHECKLIST).

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
