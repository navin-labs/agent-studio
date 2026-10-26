# Final pre-commit audit

Date 2026-10-26. `main` at `d651ba8` = `origin/main`. **Nothing committed, pushed, deployed, restarted or published; no paid call; no live service contacted.** macOS arm64, Node v26.10.0.

## Protected paths
`engine/test/films/*w44*` and `.scratch/`: unchanged (file times predate this work; no `.scratch` file is newer than the first proof file; the tracked diff of `c2-2026-w44-4.json` is byte-identical to the capture taken before the first edit; git status for those paths is identical to the capture). **`engine/test/films/c2-2026-w44-4.json` and the seven untracked week-44 boards are NOT in the proposed change set.**

## Exact files intended for a commit (53)
Modified (30):
- `.env.example`
- `README.md`
- `agents/learn/FORGE_METRICS_REPORTER.md`
- `agents/publisher/FORGE_QUEUE_PUBLISHER.md`
- `agents/writer/FORGE_WEEKLY_WRITER.md`
- `docs/INSTALL.md`
- `docs/PRD.md`
- `docs/SETUP.md`
- `docs/TECH.md`
- `engine/README.md`
- `engine/package.json`
- `engine/scripts/assets.mjs`
- `engine/scripts/film.mjs`
- `engine/scripts/make.mjs`
- `engine/scripts/probe.ts`
- `engine/src/lib/mediaHub.ts`
- `n8n/README.md`
- `studio/approval-page.ts`
- `studio/approve-server.ts`
- `studio/costguard.ts`
- `studio/creative.ts`
- `studio/director.ts`
- `studio/dispatch.test.ts`
- `studio/dispatch.ts`
- `studio/feed.ts`
- `studio/ledger.ts`
- `studio/qa.test.ts`
- `studio/qa.ts`
- `studio/script.test.ts`
- `studio/telegram.ts`

New (23):
- `.github/workflows/ci.yml`
- `docs/RELEASE_CHECKLIST.md`
- `docs/RUNBOOK.md`
- `docs/SECURITY.md`
- `docs/proof/final-audit-report.md`
- `docs/proof/pre-commit-report.md`
- `docs/proof/production-readiness-baseline.md`
- `docs/proof/production-readiness-progress.md`
- `docs/proof/production-readiness-report.md`
- `engine/scripts/required-assets.mjs`
- `engine/scripts/tts-budget.mjs`
- `studio/budget.test.ts`
- `studio/ledger-lock.test.ts`
- `studio/make-required.test.ts`
- `studio/mediahub.test.ts`
- `studio/modelcalls.test.ts`
- `studio/n8n-compat.test.ts`
- `studio/receiver.test.ts`
- `studio/render-faults.test.ts`
- `studio/render-integrity.test.ts`
- `studio/skills.test.ts`
- `studio/trial-report.test.ts`
- `studio/trial-report.ts`

Stage with explicit paths only (never `git add -A` / `git add .`). The list is exactly `git status --short` minus `engine/test/films/*` and `.scratch/`.

## 1. Required assets and `--force`
Finding: `--force` skipped the brand-asset errors; `--no-vo` / `VOICE` off let a voiced channel render silent in production (only a later QA check noticed); a TTS that wrote no clip for one line failed with a raw ENOENT carrying an absolute path. Fixed: missing required assets are a separate `fatal` list that `--force` does not apply to; a channel with a voice cannot render to production with `--no-vo` or VOICE off (previews with `--out=` can); a missing or empty clip is "the voice engine wrote no clip for this line". Proof: `studio/make-required.test.ts` runs the real `make.mjs` against a temporary engine tree (`FORGE_TEST_ROOT`) with a fake TTS program: music, mark, live-channel audio (missing, half, none), `--force`, `--no-vo`, VOICE off, complete clips, skipped line, TTS failure, empty file, garbage file. 5 mutants killed. Nothing renders; real `engine/public` and `engine/out` are untouched. Not proved: the brand-asset rules for a *non-live* channel through make.mjs beyond the warning case; `FORGE_TEST_ROOT` is a test hook that must not be set in production.

## 2. Paid-call boundary
Entry points, found by scanning the source (`studio/budget.test.ts`): the Claude CLI starts only in `claudeExec` (`costguard.ts`), reached only through `CostGuard.call`, used by `director.ts` and `repair.ts`; no model SDK or other model endpoint exists in code; the only other paid endpoints are the OpenAI and ElevenLabs TTS APIs in `make.mjs`.
Defects found and fixed: (a) concurrent calls could overshoot the ceiling (each saw the full remaining budget): calls now run one at a time through a queue; (b) a limit of NaN/0/negative/infinity compared false with everything, i.e. no ceiling, and `COSTGUARD_MAX_USD=abc` produced it: limits are validated in the guard and in the environment parser, with hard maxima (USD 25, 1 h, 50 calls); (c) paid TTS was chosen from an API key alone: it now needs `TTS_PROVIDER` to name it and obeys a per-run character ceiling checked before each request (`scripts/tts-budget.mjs`).
Tested: unknown cost / killed / timed-out call (earlier, `modelcalls.test.ts`), retries (guard refuses the third), 5 concurrent calls (peak 1; two fit, the rest refused, executor never reached), a failing call does not wedge the queue, a 20-call burst stops at the call ceiling, bad `COSTGUARD_*` values, per-call budget is what is left. Mutants: 6 of 7 killed; the survivor (environment parser without its own check) is covered by the second layer in the guard (equivalent). **Not covered:** model calls by agent sessions outside this repo's code (Forge, Claude Code, Stitch/MCP).

## 3. SQLite ledger lock
Every append to `ledger.jsonl` now goes through `appendLedger` (takes the same lock if not held). `studio/ledger-lock.test.ts`: static (only `ledger.ts` knows the lock database and opens SQLite, nothing else writes the ledger file or builds its path, the simulator writes only inside its own temporary sandbox); 6 real processes x 4 sections never overlap; a symlinked spelling of the state folder is the same lock; a throw releases it; a bare append waits for another process; a holder SIGKILLed mid-append leaves a torn line that the next writer repairs without losing earlier rows; an approval racing a dispatch claim waits, then leaves the claim standing (the unclaimed variant is re-approved). 5 mutants killed. Earlier tests add SIGKILL/SIGSTOP holders and the claim compare-and-set.
Constraints (SECURITY.md limitation 2): one machine, local disk, POSIX advisory lock; protects only code that uses it (hand-editing the ledger is not covered); a stuck holder blocks others 30 s then they fail safely; **the running receiver still has the old file lock, so restart the receiver and the tick together**. The lock is a transaction on a lock database, not a transaction over the JSONL file: a throw inside the lock releases it but does not undo lines already appended.

## 4. CI
Workflow: macOS (macos-latest = macOS 26 arm64 per runner-images), `actions/checkout@v7` (persist-credentials false), `actions/setup-node@v7`, **exact Node 26.10.0** (present in actions/node-versions for darwin arm64), `npm ci`, `npm run check` with `CI=true TZ=UTC`, `contents: read`, no secrets, 20-minute timeout, an arm64/openssl/node version step. Determinism checked locally: 4 runs of the full suite (2 recorded, 1 under 8 busy processes, 1 plain) all exit 0 with TZ=UTC and CI=true; the HTTPS test fails rather than skips under `CI`; fixed sleeps in tests were replaced by waiting on the event (a flag file / polling); a clean clone passes. Flakes found and fixed this pass: a leaked empty temp file after an aborted download under load (real bug in `downloadFile`), a 500 ms fake-process timeout that a preload could exceed. Remaining nondeterminism: action versions pinned by tag, not commit; npm registry availability; runner image drift (openssl version).
**GitHub CI has not run, so it is unverified and must not be reported as passing.**

## Commands and exit codes
| Command | Exit |
|---|---|
| `cd engine && TZ=UTC CI=true npm run check` (plain, run 1) | 0 |
| same, under 8 busy processes | 0 |
| same, under the network/spawn recorder, run 1 and run 2 | 0, 0 (0 external events; 11 `claude` spawns, all the fake test binary) |
| same, plain, final | 0 |
| `npx tsc`; `node scripts/theme-gate.ts`; `node ../schemas/validate.ts` | 0; 0; 0 |
| `node scripts/required-assets.mjs test`; `node scripts/tts-budget.mjs test` | 0; 0 |
| clean clone of `d651ba8` + overlay: `npm ci --dry-run`; `TZ=UTC CI=true npm run check` | 0; 0 |
| stress, 3 repeats each under load: ledger-lock, receiver, render-faults, make-required, budget, modelcalls, dispatch | all 0 |
| mediahub test: 8 plain + 5 under load | all 0 |
| secret scan (tracked and new files; tracked secret-like files) | 0 matches; 0 files |
| Skipped tests | 0 |
| Lint / build | none configured; not run |

## Unresolved risks and release blockers
1. GitHub Actions has never run this workflow (blocker for any claim of CI).
2. Receiver and tick must be restarted together on this code; not done, by instruction.
3. Helper endpoints unauthenticated (`LOCAL_API_TOKEN` off; 0 of 14 n8n calls send the header).
4. Week-44 films fail the creative gate (5.1 / 6.5 vs 7.5) and their scripts break the sentence limit; a paid Critic review is still needed after they improve.
5. Whole-video downloads (≤200 MB) replace remote range seeks; render faults inside Chromium, a real full disk, audio truncation/sync, JPEG/WebP/GIF/video canvas bombs untested.
6. Killed-call cost is an upper bound by the CLI flag, which has overshot before; reconcile from the provider's usage page.
7. Behaviour changes that will surprise an operator: renders that used to proceed with a warning now stop (missing music, brand audio of a live channel, silent voice in production, silent TTS gaps); a single killed model call ends the run at the ceiling; paid TTS needs `TTS_PROVIDER`; bad `COSTGUARD_*` values stop the Director.
8. No live-service compatibility is claimed (n8n, Telegram, YouTube, providers, the real `claude` CLI were not contacted).

## Recommendation
Controlled trial only, after blockers 1, 2, 3 and a walk through `docs/RELEASE_CHECKLIST.md` with a held-private upload. Not ready for unattended production.

---

# Addendum: Muse native-connector skills, ops inspection and commit pass (2026-10-26, later)

## Skills (what was done and where Forge loads them)
Forge/Muse does not auto-load skills from this repository: the project convention (docs/SETUP.md section 4, docs/INSTALL.md section 7) is plain-text skill files in `agents/` that Navin installs verbatim in Forge. Two such skills already existed for Instagram/Facebook, so they were **rewritten in place, not duplicated**:
- `agents/publisher/FORGE_QUEUE_PUBLISHER.md`, skill id `meta-social-publishing`
- `agents/learn/FORGE_METRICS_REPORTER.md`, skill id `meta-social-analytics`
`docs/SETUP.md` now shows the ids beside the install table. **Re-install both in Forge to put them into service** (nothing was installed or changed in Forge).
Added to the publisher: a connector-capability step (use only the tools actually present, never invented names), SHA-256 check of the video against the manifest at the moment of posting, platform limits from the connector, a duplicate probe through the account's recent media before every post, plan-only dry run, ambiguous-result rules (no blind retry; read back first), separate Instagram/Facebook outcomes, an explicit never-list (no REST client, token, login/OAuth, direct web address). Added to the analytics skill: zero versus unavailable/delayed/failed, `reach` required so no row without it, windows reported only when due, metric definitions/period/freshness/errors in the note, engagement rate only with a stated formula (lower bound when a part is missing), comparisons only on shared metrics and equal windows, privacy, read-only tools only.
Fixed on the way: the old publisher example manifest was not valid against `schemas/queue.schema.json` (placeholder file names, an Instagram stem on a Facebook item); both skills' `STUDIO` path (`agent-studio`) now says "the folder this repository is cloned into" with the current name. The Weekly Writer skill still carries the old path (not touched).
Test: `studio/skills.test.ts` (in `npm run check`): the install docs name both files and every named skill file exists; no second skill uses the Meta connector; required sections and safety rules are present; no Meta address, credential name or client code appears in them; the manifest, `posted.json` and metrics examples validate against the studio schemas; 4 of 5 mutants killed (the survivor is an equivalent edit of a sentence that is asserted separately).

## Native connector: inspected vs not verifiable
**Not available to this development session.** A search of the session's tools for Instagram/Facebook/Meta/insights/publish returned nothing relevant (only unrelated Figma, Notion and browser tools), and the repository holds no connector configuration or tool names (README and docs say only "Meta connector"). So no connector name, input schema, permission set or capability was verified, none was called, and no connection is claimed. The skills therefore make the agent discover its own tools at run time and say so. What could be verified is only the studio side of the contract (queue layout, manifest schema, `posted.json` handling, metrics schema and refusals), tested locally.

## Ops findings (read-only inspection; nothing restarted, reinstalled or changed)
- **Launch agents point at a folder that no longer exists.** `approve`, `studio` (hourly tick) and `studiowatch` run `~/Dev/projects/agent-studio/...`; that folder now holds only a `state/` with the launchd log. The tick job's last exit status is 256 with a Node error in `agent-studio/state/run.log`; the last successful tick in `state/run.log` is 2026-10-26T03:25Z. `studiowatch` and the old `reelwatch` are installed but **not loaded**. This is a release blocker (RUNBOOK has the reinstall commands; I did not run them).
- **The running receiver is old code.** One process (started Oct 24, Node 26.0.0 from Homebrew) answers `/health` with `ok` (local GET, live to the local socket). It predates both the SQLite lock and everything in this change and carries the old folder path, so it does not use the new lock; its approve log shows Telegram polling enabled and 646 `fetch failed` lines (cause and dates not established). Not restarted.
- **Node used by launchd is 26.0.0:** the lock, receiver, skills, cost-guard and budget tests pass on it too (run with that binary).
- **Telegram:** configuration inspected only through the receiver's own log line ("telegram approvals: polling"), not by reading `.env`; no message was sent and no Telegram API call was made, so live connectivity is **not verified**.
- **YouTube / n8n:** the repo's workflows were read (14 receiver calls in 7 workflows; 0 send `x-forge-token`); Docker/n8n state and the YouTube credential were not queried; nothing is verified live. `LOCAL_API_TOKEN` stays off and the helper endpoints stay unauthenticated.

## Results in this pass
| What | Exit |
|---|---|
| `TZ=UTC CI=true npm run check` twice | 0, 0; 0 skipped |
| same under the network/spawn recorder | 0; 0 external events; 11 fake-`claude` spawns |
| `tsc`, theme gate, schema validation | 0, 0, 0 |
| `ledger-lock`, `receiver`, `skills`, `costguard`, `budget` tests on Node 26.0.0 | 0 each |
| clean clone of `d651ba8` + overlay: `npm ci --dry-run`, `CI=true npm run check` | 0, 0 |
| secret scan: tracked files, new files | 0, 0 |
| week-44 boards, `.scratch/` | unchanged (c2-w44-4 diff byte-identical to the pre-work capture) |

Categories: **local automated tests** = everything above; **connector capabilities inspected but not executed** = none (no connector reachable); **live integrations verified** = only the local receiver's `/health`; **not verified** = Meta connector, Telegram API, n8n, YouTube, Docker, launchd execution of the new code; **GitHub Actions** = never run, so nothing is claimed.
