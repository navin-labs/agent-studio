# LOG: session memory

## 2026-09-30, session 1: docs + scaffold
Did: Read AGENT_STUDIO_PLAN.md (v2), FORGE_CONTENT_SKILL.md and reel-engine (read only). Created repo scaffold: README, CLAUDE.md, docs, agent RULES, schema drafts, channel configs, settings, git init (no commit).
Decisions: Commits authored by Navin only, no Claude attribution, each commit logged here. Every approved commit is pushed to origin. Channel gates taken from AGENT_STUDIO_PLAN section 7 because MULTI_CHANNEL_PLAN.md was not found. agent-studio language left TBD.
Commit: 610f352 docs: scaffold agent-studio (plan docs, agent contracts, schema drafts, channel configs), pushed to origin/main
Next: Phase A, task A1 (`themes.ts` + contrast test) in reel-engine, after the open questions below are answered.
Open questions:
1. `~/Downloads/MULTI_CHANNEL_PLAN.md` does not exist. Where is it, or is AGENT_STUDIO_PLAN section 1 and 7 the full source for channels and gates?
2. Voice: plan QA requires an audio stream and "render with voice"; Forge skill says videos are silent and the voiceover is parked; reel-engine has Sarvam voice. Which is true?
3. Instagram publishing: plan says Forge publishes from a queue; Forge skill says Navin posts from his phone and Forge never posts. Which?
4. C1 CTA mix: plan says DM AUDIT 1 in 3; Forge skill says 1 in 5.
5. C1 goal: plan says leads (DMs + profile visits); Forge skill says the goal is followers.
6. Brand accent: plan says signal-lime accent is fixed everywhere, but the `studio` theme's accent is #2B4BFF.
7. Look: Forge skill says Paper & Signal is locked; plan adds 3 more themes and lets C1 alternate with `studio`.
8. Structure: Forge skill locks `pile-to-flow` with exactly 6 scenes; plan replaces templates with primitive recipes. Does the Forge skill get rewritten in the "Weekly Writer" update?
9. "Break the 4 current templates": reel-engine content only uses `pile-to-flow`; formats are story, reel, carousel. Which 4 templates?
10. Primitive list points to "section 1 of v1", which I don't have. Is the list in plan section 5 (28 names) complete?
11. Approval: Forge skill uses "approve <id>" messages; plan uses a weekly HTML page + n8n webhook. Does the page replace the message?
12. Metrics: Forge logs to Notion "Post Log"; plan says files, not DB. Where does Learn read metrics from, and who pulls them?
13. Duration: QA gate 20 to 45s; Forge target 25 to 35s; brief says 15 to 60s performs best. Which range does the gate enforce?
14. reel-engine is not a git repo. Init git there before Phase A so changes can be reviewed and rolled back?
15. KPI targets per channel, C2 and C3 account handles, max QA retry count: all TBD.
16. "About 1B Muse tokens": per month, or total?
17. C2 gate says "14 days with no missed posts", but the Forge skill allows down to 5 posts a week. Does a skipped slot count as missed?
18. agent-studio language: TypeScript to share types with reel-engine, or something else?

## 2026-09-30, session 2: A1 themes.ts + contrast test
Did: Built `engine/src/themes.ts` (4 themes, 11 role tokens) and `engine/scripts/contrast.ts` (`npm run contrast`, WCAG AA, exits 1 on fail, self-checks its maths). Negative test: a broken theme exits 1. Copied reel-engine v1 into `engine/` (no node_modules, out, .env, voice clips, status files). Old reel-engine restored untouched.
Decisions: ADR 7 one repo, engine in `engine/`, old reel-engine stays live until B4b switch-over. ADR 8 `onAccent` token (plan colours failed AA: ink theme 1.14, studio 3.33). Navin approved the 18 proposed colours. Open questions 6 and 14 resolved.
Commit: 489d26b feat(engine): bring engine into repo, add role-token themes and WCAG contrast gate, pushed to origin/main
Next: A2 refactor engine components to role tokens (needs `npm install` in engine/, about 640 MB).
Open questions: 2, 3, 4, 5, 7 to 13, 15 to 18 from session 1 still open. Q18 leaning TypeScript (engine is TS, contrast script runs on Node 26 with no build step).

## 2026-09-30, session 3: A2 refactor to role tokens
Did: Story + Captions read colours from a theme (React context, `useTheme()`); scripts pick it with `"theme"` (default paper). Removed reel and carousel formats, their UI cards, the unused Mascot and the old dark palette (ADR 9). `theme.ts` now holds no colours. `scripts/contrast.ts` became `scripts/theme-gate.ts` (`npm run gate:themes`): contrast + raw-colour scan of src/. `make.mjs` runs the theme gate before rendering, rejects unknown themes and non-story formats; watcher watches content/stories only. Added `scripts/stills.mjs` (8 frames x 3 stories) for visual regression.
Verified: paper renders 21/24 frames byte-identical to before; the 3 that differ are the cursor drop shadow (#000 to shadow token #111). All 7 real stories pass `--check`. Bad theme and reel format are rejected (exit 1). Full MP4 render: 1080x1920, 30 fps, audio stream, 31.4 s. Story renders in ink, mono and studio.
Decisions: ADR 9. Text on the highlighter uses onAccent in Story and Captions.
Commit: pending "approve commit"
Next: A3 primitive interface + registry.
Open questions:
19. Brand mark `public/brand/mark.png` is light grey. It vanishes on the ink theme's end card (which is light, because the ink wipe uses the ink token). Need a dark variant or a tinted mark.
20. ink theme: black card shadows are invisible on the near-black background (approved colours, flagged for a look).
21. No TypeScript compiler in engine/ (types are never checked; esbuild only strips them). Add `typescript` as a dev dependency?
Still open from session 1: 2, 3, 4, 5, 7, 8, 10 to 13, 15 to 18. Q9 resolved: only one template (`pile-to-flow`) exists.
