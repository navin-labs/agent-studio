# Pre-commit report (superseded by final-audit-report.md)

Date 2026-10-26. Branch `main` at `d651ba8` = `origin/main`. **Nothing committed, pushed, deployed, restarted or published; no paid call; no live service contacted by the tests.** macOS arm64, Node v26.10.0.

## Protected user changes
`engine/test/films/*w44*` (7 untracked boards + the modified `c2-2026-w44-4.json`) and `.scratch/` are unchanged: file times predate this work, the tracked diff of `c2-2026-w44-4.json` is byte-identical to the capture taken before the first edit, and no `.scratch` file is newer than the first proof file. **`c2-2026-w44-4.json` is a user change that is not part of this work: leave it out of any commit unless you want it in.**

## Changed files (27 tracked + 17 new, excluding the protected paths)
Modified: `.env.example`, `README.md`, `agents/writer/FORGE_WEEKLY_WRITER.md`, `docs/INSTALL.md`, `docs/PRD.md`, `docs/SETUP.md`, `docs/TECH.md`, `engine/README.md`, `engine/package.json`, `engine/scripts/assets.mjs`, `engine/scripts/film.mjs`, `engine/scripts/make.mjs`, `engine/scripts/probe.ts`, `engine/src/lib/mediaHub.ts`, `n8n/README.md`, `studio/approval-page.ts`, `studio/approve-server.ts`, `studio/costguard.ts`, `studio/creative.ts`, `studio/dispatch.test.ts`, `studio/dispatch.ts`, `studio/feed.ts`, `studio/ledger.ts`, `studio/qa.test.ts`, `studio/qa.ts`, `studio/script.test.ts`, `studio/telegram.ts`.
New: `.github/workflows/ci.yml`, `docs/RELEASE_CHECKLIST.md`, `docs/RUNBOOK.md`, `docs/SECURITY.md`, `docs/proof/{production-readiness-baseline,production-readiness-progress,production-readiness-report,pre-commit-report}.md`, `engine/scripts/required-assets.mjs`, `studio/{mediahub,modelcalls,n8n-compat,receiver,render-faults,render-integrity,trial-report}.test.ts`, `studio/trial-report.ts`.

## Commands and exit codes (this pass)
| Command | Exit |
|---|---|
| `cd engine && CI=1 npm run check` under the network/spawn recorder | 0; 0 skipped; 0 external network events; 11 `claude` spawns, all the fake test binary |
| `npx tsc`; `node scripts/theme-gate.ts`; `node ../schemas/validate.ts` | 0; 0; 0 |
| `npm ci --dry-run` (clean clone) | 0 |
| `CI=1 npm run check` in a clean clone of `d651ba8` + the working-tree overlay | 0; 0 skipped |
| `node studio/receiver.test.ts` x5 (flakiness) | 0 x5 |
| `dispatch`, `approval`, `telegram`, `run`, `loop` tests, `simulate.ts` after the lock change | 0 each |
| `node scripts/make.mjs <board> --check` on `test/c1-literal.json` and on a protected week-44 board (read-only) | 1 (existing script-gate errors on those boards; no asset errors) |
| `node studio/creative.ts status` on two week-44 boards (read-only) | 1 (their creative review fails on scores and a stale hash) |
| Mutation checks this pass | lock 3/3, assets 4/4 killed |
| Lint / build | none configured; not run |

## CI workflow, checked against GitHub's published data (not by a run)
Read from GitHub on 2026-10-26: `actions/node-versions` lists Node 26.x (latest 26.12.1) for darwin arm64 and x64, so `setup-node` can supply Node 26; `macos-latest` = macOS 26 arm64 in `actions/runner-images`; latest `actions/checkout` is v7.0.1 and `actions/setup-node` v7.1.0 (the workflow said v4; changed to `@v7`, whose inputs `node-version`, `cache`, `cache-dependency-path`, `persist-credentials` I confirmed in their `action.yml`, runtime node24). Added `persist-credentials: false`, a step that fails unless the runner is arm64 and prints node/openssl versions, and the HTTPS test now fails (not skips) when `CI` is set and openssl cannot make a certificate. Locally: YAML parses; the same commands pass in a clean clone with `CI=1`.
**GitHub CI is unverified: the workflow has never run.** Unknowns: that the runner's openssl supports `-addext`, that action tags are pinned only by tag (not commit), cache behaviour, and the real timing.

## Ledger lock: finding and decision
Finding: the previous lock file could not close its stale-takeover race (two processes judging one stale file could both proceed; a holder stalled over 2 minutes lost the lock while still writing). It could produce conflicting writes: an approval of a re-render landing between a dispatch claim and its upload could flip `dispatching` back to `approved`, so a second render could be sent. The window needs both a coincident takeover and a re-render approval, but it was real.
Change: the lock is now an exclusive SQLite transaction (`node:sqlite`, Node core, no dependency). The kernel releases it on death; there is no stale file, takeover or expiry; a stalled holder is waited for, never overtaken. `resolve` and `markPublished` are now locked as well. Tested across real processes (counter, same-link taps, SIGKILL holder, SIGSTOP holder, rival rejection during a claim).
Residual risk and constraint: POSIX advisory, one machine, local disk; only code that takes the lock is protected; a stuck holder blocks others for 30 s then they fail safely; **the running receiver still uses the old lock, so restart the receiver and the tick together**. Details: SECURITY.md limitation 2, RUNBOOK.

## Required assets
`make.mjs` previously rendered without a named music file (warning), with the studio mark or no bumper when brand files were missing, and with some voiced lines silent (warning). Now: a named music file must exist (quality-gate error and a hard stop in the render even with `--force`); the end-card mark must exist; a live channel needs both brand audio files; one of the pair alone is always an error; only a not-live channel may go without, with a warning; a channel with a voice configured stops if any voiced line has no clip. Tested: rule unit test, music rule through `make.mjs --check`. **Not tested:** the voiceover-gap stop (needs the TTS engine) and the brand-asset errors through make.mjs (`--force` bypasses them). Behaviour change: a render that used to proceed with a warning now stops.

## Security limitations that remain (full list: docs/SECURITY.md)
Helper endpoints unauthenticated (`LOCAL_API_TOKEN` off; 0 of 14 n8n calls send the header; procedure and gate in n8n/README.md); lock limits above; killed-call cost is an upper bound by a flag that has overshot; JPEG/WebP/GIF/video canvas size unchecked; creative-review hash does not cover shared render code; mocks, not live n8n/Telegram/YouTube/providers; render faults inside Chromium and a real full disk untested.

## Release blockers
1. A completed GitHub Actions run (none exists).
2. Restart receiver and tick together on the new code (not done; deliberately).
3. Decide on the helper token: enable only after all 14 n8n calls send the header.
4. Week-44 films fail the creative gate (scores 5.1 and 6.5 against 7.5); a paid Critic review after improving them is needed. Writer scripts on those boards still break the sentence limit (the Writer prompt now states it; the boards were not edited).
5. Walk `docs/RELEASE_CHECKLIST.md` with a held-private test upload.

## Recommendation
Controlled trial only after blockers 1-3 and 5; not ready for unattended production. No live-service compatibility is claimed.
