# DECISIONS (ADR log)

Why: record each big choice once, with the reason, so no session re-argues it.

| # | Date | Decision | Why | Rejected |
|---|---|---|---|---|
| 1 | 2026-09-30 | Vocabulary, not templates | About 30 primitives x 4 themes x orderings x rhythms gives an effectively endless pool that grows | Fixed templates (repetitive, easy to spot) |
| 2 | 2026-09-30 | Code picks the shape, AI writes the words | Uniqueness is computed and guaranteed; no per-video code, so no daily breakage | AI generating animation or structure per video |
| 3 | 2026-09-30 | Forge is the writer | Runs on Muse tokens (about 1B); keeps the $20 Claude plan for building only | 7 Claude agents (v1), too many tokens |
| 4 | 2026-09-30 | Files, not a database | Simple, diffable, readable by Forge, n8n and code alike | A DB server to run and back up |
| 5 | 2026-09-30 | Weekly approval | One batch page per channel, about 5 minutes; avoids approval fatigue | Per-post approval messages |
| 6 | 2026-09-30 | 4 themes on role tokens | Same clip renders in any theme; channels look distinct; contrast is checked by code | One look for every channel; hex colours in components |
| 7 | 2026-09-30 | One repo: engine copied into `agent-studio/engine/` | Navin: build everything in agent-studio. Copy (not move) so the old reel-engine keeps posting daily until switch-over (B4b) | Two repos; moving now (breaks live posting) |
| 8 | 2026-09-30 | Add 11th role token `onAccent` | Plan's own colours fail AA: light ink on lime (1.14), black on studio blue (3.33). onAccent passes in all themes | Changing brand accents |
| 9 | 2026-09-30 | Remove reel and carousel formats from `engine/` | Forge only makes stories; they held about 70 hard-coded colours in their own dark palette. The old reel-engine still has them | Freezing their palette in themes.ts; converting them to themes |
