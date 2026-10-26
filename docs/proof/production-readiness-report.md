# Production readiness report (pass 3)

**State tested:** base commit `d651ba8` plus the uncommitted working-tree changes (`git status` lists them; nothing committed, pushed, deployed or published; no paid call). **Environment:** macOS (Darwin 27, arm64), Node v26.10.0, 2026-10-26. This report supersedes pass 2; pass-2 text is in the progress file's history only.

## Commands actually run (exit codes)
| Command | Exit |
|---|---|
| `cd engine && npm run check` (28+2 test files: tsc, theme gate, text QA, schemas, all suites; 0 skipped) | 0 (last run, ~23 s) |
| `npx tsc`; `node scripts/theme-gate.ts`; `node ../schemas/validate.ts` (run separately) | 0; 0; 0 |
| `npm run check` under a recorder of every non-loopback `fetch`/socket/DNS and every spawn of `claude`, `curl`, `open`, `launchctl` | 0; **0** external events; 11 `claude` spawns, all the fake test binary |
| `npm run sheet -- test/style-showcase.json --style=terminal-dark` (README command, a real Remotion render) under the same recorder | 0; only 0.0.0.0/:: lookups (Remotion's local server) |
| `node studio/simulate.ts` (README full cycle, fake Telegram and n8n) under the recorder | 0 (pass 2); 0 external events |
| Clean clone of `d651ba8` + working-tree overlay, existing `node_modules`, `npm run check` | 0 (after the clean clone found two real problems, below) |
| `npm ci --dry-run` in the clean clone | 0 (lockfile consistent) |
| Mutation checks (break one control, expect its test to fail; hangs count as killed) | every mutant run in this pass was killed (8 render-fault, 8 media, 4 lock, 3 cost, 1 Writer prompt = 24; plus pass 2's); one survived first (atomic contact-sheet write) and one earlier by timing (stream cap): both fixed by a stronger test, then killed |
| Configured lint / build | **None configured** (`package.json` has `typecheck`, theme gate, schema validation, no lint or build script); not run |
| Test files skipped | 0 (the HTTPS test would print `mediahub SKIPPED` if openssl could not make a certificate; it did not) |

**A local pass is not a GitHub Actions pass.** `.github/workflows/ci.yml` (macOS runner, Node 26, `npm ci`, `npm run check`, `contents: read`, no secrets) has never run. Unverified for it: that `setup-node` offers Node 26, that the runner has openssl with `-addext` (the HTTPS test needs it; it skips loudly otherwise), the arm64 assumption (the ffmpeg path in `film.mjs` is `compositor-darwin-arm64`), and action versions are pinned by tag, not commit hash.

## What this pass added, and the failure modes it verifies
| Area | Verified behaviour | Test |
|---|---|---|
| ffmpeg runner (`film.mjs`) | missing, not executable, non-zero, killed by signal, hung (SIGKILL at timeout, no orphan, also when it ignores SIGTERM), bad arguments, missing input all become clear errors that carry the tool's last words and no environment | `render-faults.test.ts` |
| Mastering | a failing, hanging or empty pass never replaces the good mp4; no `.master.mp4` left; measuring nothing or invalid JSON is an error | same |
| Motion / contact sheet | text, HTML, zero-byte, missing and too-short videos fail loudly; the previous contact sheet survives; output via temp name + rename; missing or read-only output dir fails | same |
| Assets | every literal `staticFile()` exists (demos excluded: found that a clean clone cannot render `fx/demos`, which read git-ignored `public/hook-test/`) | same |
| Gate to approval | QA failed, no QA, video emptied/truncated/deleted after QA, missing manifest: refused, ledger unchanged, no status | same + existing `dispatch.test.ts` (changed video, no video, QA of another file) |
| Video downloads | 200 MB cap on declared and streamed bytes, partial file removed; only mp4/mov/webm/mkv by first bytes; ffmpeg reads a local file with `-protocol_whitelist file` and a forced `-f`; real ffmpeg refuses `concat:`, `subfile:`, `data:`, `http:`, `https:`, `tcp:`; a playlist is refused before ffmpeg starts and, forced as mp4, never opens the file it names | `mediahub.test.ts` |
| DNS rebinding | name resolved once per hop; connection pinned to the validated address (a `.test` name only the pinned answer can reach connects; a second private answer is never used) | same |
| HTTPS | throwaway-certificate server: works; untrusted cert and wrong-name cert refused; https→http redirect and plain http refused | same |
| Ledger lock | superseded in the pre-commit pass: exclusive SQLite transaction (OS-released on death); see docs/proof/pre-commit-report.md and SECURITY.md limitation 2 | `receiver.test.ts` |
| Cost accounting | killed, timed-out or crashed call with no cost is booked at its budget cap as `unknown` (never $0) and ends the run at the ceiling; CLI that cannot start is `none` ($0); `reconcile` fixes one unknown call once; trial report counts unknown calls | `modelcalls.test.ts`, `trial-report.test.ts` |
| Writer sentence defect | the Writer prompt never mentioned the 15-word / 10-average rule the gate enforces; it now states both, and a test ties the prompt text to the gate's constants and shows a 21-word sentence is named | `script.test.ts` |
| Creative gate | no defect: on the week-44 boards it correctly fails (scores 5.1 and 6.5 against 7.5, stale hash). New free command `node studio/creative.ts status <board>...` prints why | run on both boards (read-only) |
| n8n vs receiver | all 14 calls in 7 workflows satisfy the Host/JSON guards; 0 of 14 send the token; `--require-token` exits 1 | `n8n-compat.test.ts` |

## Security properties, evidence, and what is still not true
- **True and tested:** the items above, plus pass 2's receiver guards, approval replay/tamper/expiry refusal, claim compare-and-set, output caps.
- **DNS rebinding:** closed for the media hub's own fetch path (pinned connect, tested). Not applicable to ffmpeg any more (no network use). Not claimed for anything else.
- **Helper endpoints are NOT authenticated.** `LOCAL_API_TOKEN` is off and cannot be turned on safely until all 14 n8n calls send the header; the exact procedure and a readiness gate are in `n8n/README.md`. The live n8n instance and these workflows were not changed.
- **The ledger lock** was replaced after this report's first draft; read SECURITY.md limitation 2 for its limits.
- **Costs of a killed call are an upper bound by the CLI's flag**, which has overshot before; real spend is on the provider's usage page.
- **Behaviour change to know about:** video plates are downloaded whole (≤200 MB) instead of range-seeked.

## Not run / not verified
- GitHub Actions; live n8n, Telegram, YouTube, the media providers' real certificates and CDNs, the real `claude` CLI; the running launchd receiver still has the old code until restarted.
- The Remotion/Chromium render under fault (font-load failure, `delayRender` timeout, render killed half-way), a real full disk, killing the parent while it waits on ffmpeg, audio truncation or sync drift, a missing music file (rendered without it by design; QA does not know), JPEG/WebP/GIF canvas bombs. See SECURITY.md "Render fault injection".
- Creative gate and the week-44 films still need a paid Critic review; not run (no paid calls allowed). Scores say they would not pass today.
- Subjective video quality, sound, business outcomes: human review only (protocol in the previous report; summary: six 1-5 scores per video, no score under 3, mean 4+).

## Remaining risks by severity
1. CI unproven on GitHub; the arm64/macOS/openssl assumptions above.
2. Helper endpoints open by default (procedure ready, not applied).
3. Ledger lock: single machine, local disk; receiver and tick must be restarted together (old receiver uses the old lock).
4. Render faults inside Chromium and disk-full are untested.
5. Creative gate: films fail on content, and need a paid review after improvement.
6. Whole-video downloads are heavier than before.

## Recommendation
**Controlled trial only**: every video human-approved, uploads held private first, after the receiver is restarted on the new code, a green GitHub Actions run exists, and `docs/RELEASE_CHECKLIST.md` is walked through. **Not ready for unattended production.**
