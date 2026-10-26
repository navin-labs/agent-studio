# RELEASE CHECKLIST

Run before any change goes live or a channel is switched to `"live": true`. Every box is a human act; passing tests never authorises publishing.

## Automated (no secrets, no spend)
- [ ] `cd engine && npm ci && npm run check` exits 0 (CI runs the same on push and PR: `.github/workflows/ci.yml`).
- [ ] `git grep -nIE "(sk-[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{30,}|xox[bp]-|ghp_[A-Za-z0-9]{30,}|[0-9]{9,}:AA[A-Za-z0-9_-]{30,})"` prints nothing.
- [ ] `git ls-files | grep -iE '\.env$|\.pem$|token.*\.json$|credentials.*\.json$'` prints nothing.

## Manual, on the Mac
- [ ] Paid TTS is off unless you chose it: `TTS_PROVIDER` is unset (channel voices are local and free). If you do set it, set `TTS_MAX_CHARS` to a figure you accept.
- [ ] `COSTGUARD_MAX_USD`, `COSTGUARD_MAX_MS`, `COSTGUARD_MAX_CALLS` are unset, or set to numbers you chose on purpose (bad values now stop the Director; they used to switch the ceiling off).
- [ ] `.env` has `APPROVAL_SECRET` (16+ chars) and `DISPATCH_LIVE` is `off` until the last step.
- [ ] `curl -s 127.0.0.1:5680/health` -> `ok`; the receiver listens on 127.0.0.1 only (`lsof -iTCP:5680 -sTCP:LISTEN`).
- [ ] `LOCAL_API_TOKEN`: it is OFF and the helper endpoints are unauthenticated. To turn it on follow n8n/README.md in order; `node studio/n8n-compat.test.ts --require-token` must exit 0 first. Leaving it off is a documented risk (docs/SECURITY.md limitation 1), not a safe default.
- [ ] A GitHub Actions run of `.github/workflows/ci.yml` is green (a local pass is not a CI pass).
- [ ] Render one board, run `node studio/qa.ts <board>`, watch the whole video with sound; rate it with the protocol in [proof/production-readiness-report.md](proof/production-readiness-report.md) (subjective quality is a human judgement, not an automated gate).
- [ ] A dry run (`node studio/dispatch.ts`, no flags) lists exactly the expected variants and destinations.
- [ ] YouTube credentials per channel point at the right channel; scopes reviewed in the Google console.
- [ ] Upload one test video with `--hold` (private) and confirm it in YouTube Studio before enabling schedules.
- [x] Launch agents recovered from this folder on 2026-10-26 (docs/RUNBOOK.md): receiver on the current code and SQLite lock; tick loaded with `DISPATCH_LIVE=off` and `EXPERIMENTS=off` (remove them only to go live); watcher loaded with `FILMS=off`.
- [ ] Restart the approve receiver AND the tick together on this code (the old receiver uses the old file lock, which does not exclude the new SQLite lock). Exactly one of each. Do not restart anything until you decide to.
- [ ] **Before installing the Queue Publisher skill in Forge:** three queued items are 16+ days overdue (c2-reach Instagram `c2-2026-w41-2` and `c2-2026-w41-3`, Facebook `c2-2026-w41-3`) and the Publisher would post them at once. Decide per item: post, or hold.
- [ ] Back up `state/` (see [RUNBOOK.md](RUNBOOK.md)).
- [ ] Only then: `DISPATCH_LIVE=on`, `"live": true` for the channel.

## Rollback
Set `DISPATCH_LIVE=off`, unload the launch agents (`launchctl unload ~/Library/LaunchAgents/com.theautomationguy.*.plist`), restore `state/` from backup if the ledger is damaged.
