# LOG: session memory

## 2026-09-30, session 1: docs + scaffold
Did: Read AGENT_STUDIO_PLAN.md (v2), FORGE_CONTENT_SKILL.md and reel-engine (read only). Created repo scaffold: README, CLAUDE.md, docs, agent RULES, schema drafts, channel configs, settings, git init (no commit).
Decisions: Commits authored by Navin only, no Claude attribution, each commit logged here. Every approved commit is pushed to origin. Channel gates taken from AGENT_STUDIO_PLAN section 7 because MULTI_CHANNEL_PLAN.md was not found. agent-studio language left TBD.
Commit: pending "approve commit"
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
