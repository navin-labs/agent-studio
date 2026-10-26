# Production readiness: progress (resume here)

Last updated 2026-10-26 (pass 3). Base commit `d651ba8`; everything is UNCOMMITTED. Nothing committed, pushed, deployed or published; no paid call. The week-44 boards and `.scratch/` are untouched (status and diff compared before and after).

| Task | Status | Main files | Evidence |
|---|---|---|---|
| Render fault injection | Done (scope in SECURITY.md) | `engine/scripts/film.mjs`, `studio/render-faults.test.ts`, `render-integrity.test.ts` | check exit 0; 8 mutants killed |
| Media: video byte cap, pinned connect (rebinding), HTTPS, ffmpeg file-only | Done | `engine/src/lib/mediaHub.ts`, `studio/mediahub.test.ts` | local HTTP + HTTPS servers; 8 mutants killed |
| Ledger lock (SQLite exclusive transaction) | Done in the pre-commit pass; limits in SECURITY.md | `studio/ledger.ts`, `studio/dispatch.ts`, `studio/receiver.test.ts` | cross-process tests; 3 lock mutants killed |
| Unknown-cost accounting + reconcile | Done | `studio/costguard.ts`, `studio/modelcalls.test.ts` | 3 mutants killed |
| Writer sentence defect, creative status | Done (creative gate itself correct) | `agents/writer/FORGE_WEEKLY_WRITER.md`, `studio/script.test.ts`, `studio/creative.ts` | mutant killed |
| LOCAL_API_TOKEN procedure + readiness gate | Done; token NOT enabled | `n8n/README.md`, `studio/n8n-compat.test.ts` | gate exits 1 (0 of 14) |
| CI review | Reviewed; never run on GitHub | `.github/workflows/ci.yml` (Node 26) | clean clone check exit 0; `npm ci --dry-run` 0 |

Next (needs Navin): review the diff and approve a commit; restart the receiver; push and read the first Actions run; add the token header to the 14 n8n calls and enable the token; paid Critic review after film improvements; four weeks of trial data.
