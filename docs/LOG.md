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
Commit: e3cd4ab feat(engine): stories on role tokens, theme gate, remove reel and carousel formats, pushed to origin/main
Next: A3 primitive interface + registry.
Open questions:
19. Brand mark `public/brand/mark.png` is light grey. It vanishes on the ink theme's end card (which is light, because the ink wipe uses the ink token). Need a dark variant or a tinted mark.
20. ink theme: black card shadows are invisible on the near-black background (approved colours, flagged for a look).
21. No TypeScript compiler in engine/ (types are never checked; esbuild only strips them). Add `typescript` as a dev dependency?
Still open from session 1: 2, 3, 4, 5, 7, 8, 10 to 13, 15 to 18. Q9 resolved: only one template (`pile-to-flow`) exists.

## 2026-09-30, session 4: A3 primitive interface + registry
Did: `engine/src/primitives/`: `specs.ts` (10 specs + `validateParams`), `atoms.tsx` (Shot, timing helpers, brand cards copied from Story.tsx), 10 shots (word-stack-slam, highlighter-swipe, pile-drop, counter-drop, flow-build, flow-run, conveyor, chat-pop, stamp-hit, end-card), `index.ts` registry, `Preview.tsx` (Primitive video + ContactSheet). `npm run primitives` validates every example, then renders contact sheets to `out/primitives/`.
Verified: 40/40 contact sheets (10 x 4 themes) rendered and inspected; fixed 4 visual bugs found by looking (blank sheets, flow-run links before nodes, pile too small then off-frame, tiny stamps). Validator rejects over-long text, missing fields, unknown icons/fields/primitives. flow-run MP4: 1080x1920, audio, 5.5 s. Story regression 24/24 identical. Theme gate passes.
Decisions: ADR 10. Transitions (whip-pan, ink-wipe) move to A4 with the Composer (total 12). Story.tsx stays untouched until A4 rebuilds pile-to-flow from primitives.
Lesson: a Remotion `<Still>` has 1 frame, so `<Freeze>` children scheduled later render nothing; the contact sheet is a full-length Composition rendered at frame 0.
Commit: 9d538e5 feat(engine): primitive specs, registry, 10 shot primitives, contact sheets, pushed to origin/main
Next: A4 Composer.
Open questions: 19 to 21 still open (logo on ink end card, ink shadows, TypeScript).

## 2026-09-30, session 5: A4 Composer
Did: `engine/src/composer/storyboard.ts` (type, sceneFrames, sceneCues, validateStoryboard) and `Composer.tsx` (sequenced shots, captions, cue frames, cut / whip-pan / ink-wipe, voice audio). Root `Composer` composition; make.mjs `"format": "storyboard"` branch (plus honesty, hashtag, caption checks); watcher watches content/storyboards. 3 storyboards: order-emails (paper, opens word-stack-slam), invoice-chase (ink, opens pile-drop), dispatch-lr (studio, opens counter-drop). `cuesOr` moved to lib/timing.ts and fixed (missing cues now fall after given ones) with asserts. stills.mjs gained `--board` mode.
Verified: 3 MP4s 24 to 29 s, 1080x1920, 30 fps, audio. order-emails renders in all 4 themes. Voice path: sfx off + placeholder clips -> audio stream present, measured durations stretch scenes. Gate rejects 7 broken storyboards with clear errors. Story regression 24/24. Theme gate and primitives check pass.
Decisions: ADR 11.
Known: flow-run re-pops its steps when it follows flow-build (9-frame blip); conveyor card numbers start at 1001 (no `start` param).
Commit: pending "approve commit"
Next: A5 text box measurement. New request from Navin (reel style: mascot host, voiced, captions, music, UI demos) needs decisions first, see open questions 22 to 26.
Open questions:
22. Voice: switch from silent to always-voiced (answers Q2). Which API: ElevenLabs, OpenAI TTS or Sarvam (all three already wired in make.mjs)? Navin puts the key in engine/.env.
23. Mascot host: original character (never a copy of the Brud Code mascot). 2D vector with halftone/pixel shading (no new dependency) or true 3D (needs @remotion/three + three.js)?
24. Lip-sync: mouth driven by voice loudness needs @remotion/media-utils (new dependency). OK?
25. New dark "pixel" theme for this style (theme additions need Navin's OK once).
26. Music bed: a royalty-free track Navin supplies into engine/public/music/.
Answered by Navin (2026-09-30): Q22 use Sarvam for now, pick its best voice (final provider decided later). Q23 true 3D mascot, a different mascot per channel (C1, C2, C3). Q24 yes, add @remotion/media-utils for lip-sync. Order: A5 first, then A6 host format.
Open for A6 planning: true 3D needs @remotion/three + three (new dependencies, ask at A6) and 3 original 3D models (source TBD, owner: Navin); 26 music still open.

## 2026-09-30, session 5 (cont.): A5 text box measurement
Did: `TextProbe` in Composer.tsx measures every visible text block (TreeWalker + Range rects, grouped by `data-tb`, container from `data-box`, decorative cards skipped via `data-tb-skip`, opacity < 0.5 skipped) on settled frames after `document.fonts.ready`, and emits `<Artifact text-boxes-<frame>.json>`. `src/composer/textcheck.ts` (pure, self-test: `node src/composer/textcheck.ts`) checks safe area, card overflow, caption overlap. make.mjs collects via `onArtifact`, writes `out/<id>/text-boxes.json`, fails the render on errors or on any missing sampled frame. `probeFrames` moved to storyboard.ts so make.mjs knows the expected count.
Verified: 3 boards: 176/150/154 frames measured, 0 errors. A 16-char label "MMMMMMMMMMMMMMMM" (passes the char limit) fails the render with "text overflows its card", exit 1. No stray artifact files. Tightest real margin: "Message customer" has 2 px inside its card. All checks pass; story regression 24/24.
Decisions: ADR 12.
Lesson: Remotion always echoes a bundle's console output (defaultOnLog uses the message's own level); use `<Artifact>` + `onArtifact` to pass data out of a render.
Commit: pending "approve commit" (A4 and A5 share files, so one commit)
Next: A6 host format (plan first; ask before @remotion/three, three, @remotion/media-utils).
Open questions: 19 to 21, 26 open; A6 needs 3 original 3D mascot models (owner: Navin).

## 2026-10-01, session 6: A6 host format, step 1 (mascot concepts)
Did: Navin's master prompt (pixel-narrator reel) adopted as the host-format style, different per channel and platform. Added `night` theme (#0B0B10 stage, lime primary, flow blue secondary, paper text) and a `warn` token (amber, pain only) to every theme; `CHARACTER` and `MASK` constants in themes.ts. `engine/src/host/mascots.tsx`: 3 C1 host concepts drawn fully in code (SVG parts + 7-step pixel dither + lime/blue rim glow): BAHI (ledger capsule, pencil), TIKKU (stamp-handle cube head, screen face), CHAKRI (flow-arrow body, narrator headset). Each takes mouth / blink / tilt. `Stage` (starfield, warm glow). `MascotConcept` still in Root. Renders: engine/out/host/concept-*.png.
Verified: theme gate passes (night AA on all text pairs; mask values moved into themes.ts rather than an exception). Fixed first-draft defects found by looking: hard dither steps, invisible Tikku mouth, detached arms, mic across the eye. Acting test (mouth 0.8, blink 1, tilt -6) renders.
Decisions: the master prompt's "one self-contained composition per topic" is adapted into the engine's storyboard recipe + reusable primitives (ADR 2: no per-video code). Mascots drawn in code settles Q23: no @remotion/three, no model files. Self-host VT323 instead of adding @remotion/google-fonts.
Commit: pending "approve commit" (A4 + A5 + this step)
Next: Navin picks C1's host; then host layer (idle bob, blink, lip-sync, tilt toward panel), karaoke captions, UI window primitives (inbox, sheet, chat, diff) with cursor, pixel-wipe transition, CTA card + pixel logo line, the 7-scene recipe.
Open questions:
27. Length: master prompt says 60 to 75 s; plan QA says 20 to 45 s; Forge skill 25 to 35 s. Which for the host format, per platform?
28. CTA: master prompt ends every reel on DM AUDIT; plan says DM AUDIT 1 in 3 for C1. Which?
29. Captions: master prompt wants karaoke word-by-word; the current engine highlights keywords only (research note: karaoke distracts). Host format uses karaoke?
30. Per channel: C2 and C3 need their own mascot, palette accents and fonts. Design after C1's host is locked?
31. Per platform: YouTube Shorts safe zones differ from Instagram; add a platform profile to text QA.

## 2026-10-01, session 6 (cont.): A6.2 host layer + host-hook
Did: Navin locked requirements: the host format is one format among several, brand identity constant (ADR 13 to 15). C1 host = Chiku (Chakri design renamed). Pinned @remotion/media-utils 4.0.527 (approved). `engine/src/host/Host.tsx` (Host acting, VoiceCtx/HostCtx, HostStage, KaraokeCaptions), `acting.ts` (mouthFromWords, blinkAt, mouthFromAmplitude). `host-hook` primitive (night stage, huge hook type, Chiku reacting). Storyboard `host` + `captionStyle` fields; spec `captions: false` (end-card never gets captions). Test board `host-supplier-bills` (night, karaoke). Fixes: flow-run no longer re-pops after flow-build; end-card logo inverts on light cards (`isLight`, asserted in theme gate); Tikku/Bahi/Chiku defects from session 6.
Verified: host board renders, 124 frames measured, 0 text errors; placeholder voice clip opens Chiku's mouth (audio path); word-timed mouth when silent. Found and fixed by looking: pain beat shut Chiku's eyes (read as sleepy, now a head shake), karaoke leaked onto the end card. Acting asserts, theme gate (5 themes), 55 contact sheets, 11 scripts gated, story regression 24/24, all boards 0 text errors.
Lesson: files the browser bundle imports cannot hold Node-only code (top-level await self-tests broke the bundle); keep those asserts in scripts/.
Decisions: ADR 13, 14, 15. Q23, Q27 to Q29 answered by the master prompt for the host format (60 to 75 s, DM AUDIT, karaoke); other formats keep plan values until A6.6.
Commit: pending "approve commit" (A4 + A5 + A6.1 + A6.2)
Next: A6.3 UI window primitives.
Open questions: 19 (story format logo, legacy only) and 20 (ink shadows) open; 26 music bed; 30 C2/C3 hosts (C2: original stopwatch character, later); 31 YouTube safe zones (A6.6); Sarvam key into engine/.env before A6.5.

## 2026-10-01, session 6 (cont.): voice test before commit (Navin's request)
Did: Rendered host-supplier-bills with real Sarvam voice (`TTS_PROVIDER=sarvam VOICE=on` on the command line; engine/.env present, git-ignored, never read). 4 clips generated into public/vo/host-supplier-bills/ (git-ignored).
Verified: MP4 14.3 s with voice; text boxes 83/83 frames, 0 errors. Stills rendered with the same voice timing show Chiku's mouth open mid-word and shut between words, karaoke tracking the measured voice, pain shake on the accent.
Finding: Sarvam reads about 3.6 words/s (s03: 17 words in 4.7 s) versus the 2.4 words/s estimate, so voiced videos run about 30 percent shorter than their silent estimate. A6.5 must size the 60 to 75 s recipe on measured voice (or set SARVAM_PACE in engine/.env, Navin's call) and compare Sarvam speakers for "best voice".
Note: Remotion printed a media-parser licence notice; Remotion is free for individuals and companies of up to 3 people (confirm Navin's case, owner: Navin).
