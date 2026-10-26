# Production readiness: baseline

Commit audited: `d651ba8` on `main` (working tree had only untracked local test boards and `.scratch/`). This file is the pass-1 baseline; pass-2 results are in [production-readiness-report.md](production-readiness-report.md). Date: 2026-10-26. Host: macOS (Darwin), Node v26.10.0. No credentials were used, no network publishing, no model calls.

## Verified working (current commit)
- `cd engine && npm run check`: exit 0, 24 suites print `ok` (tsc, theme gate, text QA, schemas, recipe, qa, approval, dispatch, learn, telegram, metrics, run, feed, experiment, improve, loop, creative, script, density, power, score, costguard, formatstyle, router, artgate, mediaHub, styles, direction). Output: this review's scratch log; rerun to reproduce.
- Approval, dispatch, Telegram, costguard and ledger have negative-path tests that pass (replay, tamper, expiry, changed video, wrong destination, unknown outcome, torn ledger line, cost cap). These are in the suites above.
- Source-level review: HMAC + `timingSafeEqual` + strict parsing + expiry + single use for approvals; approve receiver bound to 127.0.0.1; approval page escapes output; single-dispatcher lock.

## Defects found and their pass-2 status
| # | Sev | Finding | Status after pass 2 |
|---|---|---|---|
| 1 | High | Media downloads: no timeout, size cap, host/redirect/DNS checks, file-type check; ffmpeg given all protocols | Fixed; `studio/mediahub.test.ts` (local server; 6 mutants killed) |
| 2 | High | **Ledger race**: approval read status, hashed videos, then appended "approved"; a dispatch claim written in between could be overwritten, re-opening an upload under way (duplicate upload) | Fixed with `withLedgerLock` + compare-and-set claim; cross-process tests; mutants killed |
| 3 | Med | Receiver: no Host/Origin/content-type checks (DNS rebinding, cross-site no-preflight POST), unbounded trickle bodies | Fixed; `studio/receiver.test.ts` on a real socket |
| 4 | Med | Claude CLI executor: unbounded stdout | Fixed (2 MB cap); `studio/modelcalls.test.ts` |
| 5 | Med | QA passed on a truncated mp4 header; unreadable file crashed QA | Fixed; `studio/render-integrity.test.ts` |
| 6 | Med | No CI | `.github/workflows/ci.yml` added; **not run on GitHub** |
| 7 | Low | Temp image and non-atomic plate index | Fixed |
| 8 | Low | Stale `agent-studio` names | Docs, messages and user agents updated; deployed ids and others kept on purpose (SECURITY.md limitation 9) |
| 9 | Info | Helper endpoints unauthenticated by default | Browser/rebinding guards unconditional; token opt-in and NOT enabled (procedure + readiness gate in n8n/README.md) |
| 10 | Med | Killed/timed-out model call booked at $0 | Fixed in pass 3: booked at its cap as `unknown`, reconcilable |
| 11 | Med | Writer prompt never stated the sentence-length rule the gate enforces | Fixed in pass 3 |
| 12 | Med | ffmpeg could read network URLs and follow playlists; DNS could change between check and connect | Fixed in pass 3: ffmpeg is file-only, connect is pinned |
| 13 | Low | Mastering/contact-sheet failures left partial files; no ffmpeg timeout | Fixed in pass 3 |

## Not implemented
- Automatic reconciliation of unknown publish outcomes (manual by design).
- Structured JSON logs with run ids; stale-job alerts beyond the existing Telegram messages.
- Per-approved-video cost (runs are not tied to approvals); QA first-pass and generation-success rates (not in the ledger).

## Blocked / not inspected
- Live `.env`, n8n credentials, YouTube OAuth scopes, launch agents: not read or changed. The running launchd receiver still has the old code until it is restarted.
- GitHub Actions: no run exists.
- Paid model calls, live YouTube/Telegram/n8n: not exercised.
