# LOG: session memory

## 2026-09-30, session 1: docs + scaffold
Did: Read AGENT_STUDIO_PLAN.md (v2), FORGE_CONTENT_SKILL.md and reel-engine (read only). Created repo scaffold: README, CLAUDE.md, docs, agent RULES, schema drafts, channel configs, settings, git init (no commit).
Decisions: Commits authored by Navin only, no Claude attribution, each commit logged here. Every approved commit is pushed to origin. Channel gates taken from AGENT_STUDIO_PLAN section 7 because MULTI_CHANNEL_PLAN.md was not found. agent-studio language left TBD.
Commit: 610f352 docs: scaffold agent-studio (plan docs, agent contracts, schema drafts, channel configs), pushed to origin/main
Next: Phase A, task A1 (`themes.ts` + contrast test) in reel-engine, after the open questions below are answered.
Open questions:
1. `~/Downloads/MULTI_CHANNEL_PLAN.md` does not exist. Where is it, or is AGENT_STUDIO_PLAN section 1 and 7 the full source for channels and gates?
2. (Answered 2026-10-01: voice on via Sarvam; QA requires an audio stream.) Voice: plan QA requires an audio stream and "render with voice"; Forge skill says videos are silent and the voiceover is parked; reel-engine has Sarvam voice. Which is true?
3. Instagram publishing: plan says Forge publishes from a queue; Forge skill says Navin posts from his phone and Forge never posts. Which?
4. C1 CTA mix: plan says DM AUDIT 1 in 3; Forge skill says 1 in 5.
5. C1 goal: plan says leads (DMs + profile visits); Forge skill says the goal is followers.
6. Brand accent: plan says signal-lime accent is fixed everywhere, but the `studio` theme's accent is #2B4BFF.
7. Look: Forge skill says Paper & Signal is locked; plan adds 3 more themes and lets C1 alternate with `studio`.
8. Structure: Forge skill locks `pile-to-flow` with exactly 6 scenes; plan replaces templates with primitive recipes. Does the Forge skill get rewritten in the "Weekly Writer" update?
9. "Break the 4 current templates": reel-engine content only uses `pile-to-flow`; formats are story, reel, carousel. Which 4 templates?
10. Primitive list points to "section 1 of v1", which I don't have. Is the list in plan section 5 (28 names) complete?
11. (Partly answered 2026-10-01: weekly page + signed links built in B4; whether Forge's "approve <id>" message stays as a second path is still open.) Approval: Forge skill uses "approve <id>" messages; plan uses a weekly HTML page + n8n webhook. Does the page replace the message?
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
Commit: 059fca1 (combined A4 to A6.2 commit), pushed to origin/main
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
Commit: 059fca1 (combined A4 to A6.2 commit), pushed to origin/main
Next: A6 host format (plan first; ask before @remotion/three, three, @remotion/media-utils).
Open questions: 19 to 21, 26 open; A6 needs 3 original 3D mascot models (owner: Navin).

## 2026-10-01, session 6: A6 host format, step 1 (mascot concepts)
Did: Navin's master prompt (pixel-narrator reel) adopted as the host-format style, different per channel and platform. Added `night` theme (#0B0B10 stage, lime primary, flow blue secondary, paper text) and a `warn` token (amber, pain only) to every theme; `CHARACTER` and `MASK` constants in themes.ts. `engine/src/host/mascots.tsx`: 3 C1 host concepts drawn fully in code (SVG parts + 7-step pixel dither + lime/blue rim glow): BAHI (ledger capsule, pencil), TIKKU (stamp-handle cube head, screen face), CHAKRI (flow-arrow body, narrator headset). Each takes mouth / blink / tilt. `Stage` (starfield, warm glow). `MascotConcept` still in Root. Renders: engine/out/host/concept-*.png.
Verified: theme gate passes (night AA on all text pairs; mask values moved into themes.ts rather than an exception). Fixed first-draft defects found by looking: hard dither steps, invisible Tikku mouth, detached arms, mic across the eye. Acting test (mouth 0.8, blink 1, tilt -6) renders.
Decisions: the master prompt's "one self-contained composition per topic" is adapted into the engine's storyboard recipe + reusable primitives (ADR 2: no per-video code). Mascots drawn in code settles Q23: no @remotion/three, no model files. Self-host VT323 instead of adding @remotion/google-fonts.
Commit: 059fca1 (combined A4 to A6.2 commit), pushed to origin/main
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
Commit: 059fca1 feat(engine): Composer, text box QA, night theme, Chiku host with lip-sync and karaoke, pushed to origin/main (covers sessions 5 and 6)
Next: A6.3 UI window primitives.
Open questions: 19 (story format logo, legacy only) and 20 (ink shadows) open; 26 music bed; 30 C2/C3 hosts (C2: original stopwatch character, later); 31 YouTube safe zones (A6.6); Sarvam key into engine/.env before A6.5.

## 2026-10-01, session 6 (cont.): voice test before commit (Navin's request)
Did: Rendered host-supplier-bills with real Sarvam voice (`TTS_PROVIDER=sarvam VOICE=on` on the command line; engine/.env present, git-ignored, never read). 4 clips generated into public/vo/host-supplier-bills/ (git-ignored).
Verified: MP4 14.3 s with voice; text boxes 83/83 frames, 0 errors. Stills rendered with the same voice timing show Chiku's mouth open mid-word and shut between words, karaoke tracking the measured voice, pain shake on the accent.
Finding: Sarvam reads about 3.6 words/s (s03: 17 words in 4.7 s) versus the 2.4 words/s estimate, so voiced videos run about 30 percent shorter than their silent estimate. A6.5 must size the 60 to 75 s recipe on measured voice (or set SARVAM_PACE in engine/.env, Navin's call) and compare Sarvam speakers for "best voice".
Note: Remotion printed a media-parser licence notice; Remotion is free for individuals and companies of up to 3 people (confirm Navin's case, owner: Navin).
Decision (Navin, 2026-10-01): host-format videos run 40 to 60 s with real voice (replaces 60 to 75 s). Since Sarvam reads ~3.6 words/s, a 40 to 60 s script needs about 145 to 215 spoken words across the 7 scenes.
Fix: test board said "typed into Tally" (a real product); honesty rules forbid real brands, changed to "the accounts software".

## 2026-10-01, session 7: A6.3 UI window primitives
Did: `engine/src/host/ui.tsx` (Window, Cursor, Tag, UiShot: night stage + window + Chiku bottom-right leaning in, groan when manual, hop when auto). Primitives ui-inbox, ui-sheet, ui-chat, ui-diff (manual = amber + cursor, auto = lime), specs with fictional Indian SME examples. Floor shadow moved from Stage into Host (it followed centre screen). Rows and type scale to fill each window. `engine/test/stress-ui.json` + `npm run stress`.
Found and fixed: `ui-diff` used WIN without importing it (crashed the render; a type checker would catch this, see Q21); the stress test showed chat history rising out of the window, and the probe counted clipped text as visible, so measurement now trims to clipping ancestors and flags trimmed text as "cut off" unless in a `data-tb-scroll` area; duplicate reports of one moving problem (dedupe key now ignores pixel values); the brand fix lengthened a vo line past pile-drop's 6 s max (the gate caught it; shortened).
Verified: stress board 0 errors; over-wide subject fails with "cut off by its window"; textcheck self-test; theme gate; 75 contact sheets (15 primitives x 5 themes); 12 scripts gated; story regression 24/24; 4 boards 0 text errors; host board re-voiced (only the changed line regenerated).
Commit: 5f1d813 feat(engine): UI window primitives (inbox, sheet, chat, diff), clip-aware text QA, stress fixture, pushed to origin/main
Next: A6.4 pixel-wipe, payoff card, VT323 logo line.
Open questions: 21 (add `typescript` as a dev dependency so `tsc --noEmit` catches missing imports before render; needs Navin's OK).

## 2026-10-01, session 8: TypeScript + A6.4 closing beats
Did: Added dev dependencies typescript 7.0.2 and @types/react 19.1.17 (approved), `engine/tsconfig.json` (strict, noEmit), `npm run typecheck` and `npm run check` (tsc + theme gate + textcheck); CLAUDE.md now requires `npm run check` before a commit. First typecheck found 37 errors: dead reel scene cases left in lib/timing.ts (removed) and unguarded nulls from getPointAtLength (primitives skip a degenerate point; legacy Story.tsx asserts non-null, frames unchanged). Verified tsc catches the missing-import bug that crashed ui-diff in session 7.
A6.4: `pixel-wipe` transition (lib/pixels.ts, asserted), `host-payoff` (shared HostLine with host-hook, happy hop), `host-cta` closing card (CTA, offer line, brand line in TYPE.pixel, host waving), spec `closer` flag (last scene must be end-card or host-cta). Test board now: hook, pile (whip), flow-run (pixel-wipe), payoff (whip), CTA; re-voiced (only new lines generated): 17.5 s, 0 text errors.
Verified: npm run check passes; 85 contact sheets (17 primitives x 5 themes); 12 scripts gated; story regression 24/24; 3 composed boards + stress board 0 text errors.
Commit: 60a2cc7 feat(engine): TypeScript checks, pixel-wipe transition, host payoff and CTA card, VT323 brand line
Next: A6.5 C1 host recipe: 7 scenes, 40 to 60 s measured with voice, Sarvam best voice.
Open questions: none new. VT323 approved by Navin, self-hosted (public/fonts/vt323-latin-400-normal.woff2, 18 KB, OFL-VT323.txt).

## 2026-10-01, session 9: A6.5 C1 host recipe + real voice
Did: VT323 self-hosted (approved) and loaded in fonts.ts; committed session 8. Rewrote host-supplier-bills as the full 8-shot C1 recipe: hook (host-hook), pain A (ui-inbox manual), pain B (ui-sheet manual), turn (ui-diff, pixel-wipe), demo A (flow-run), demo B (ui-chat auto), payoff (host-payoff, pixel-wipe), CTA (host-cta). 135 spoken words. Voiced with Sarvam bulbul:v3 / shubh: 43.8 s measured, 0 text errors.
Voice comparison: same 3 lines in 6 speakers (out/voices/*.mp3). shubh 3.5 words/s; aditya, rohan, priya, kavya, shreya 2.6 to 2.8 words/s (the same script would run about 52 to 56 s).
Decisions: storyboards estimate vo at VOICE_WPS 3.0 words/s (lib/timing.ts) instead of 2.4; the old rate rejected lines that measure well inside the shot. Story format keeps 2.4 (frames unchanged). Measured voice still overrides the estimate.
Verified: npm run check; 3 composed boards + stress board 0 text errors; story regression 24/24 identical.
Commit: 93e6d48 feat(engine): 8-shot C1 host video with Sarvam voice, storyboard speech rate 3.0 words/s
Next: A6.6 per-format QA (host 40 to 60 s after voice; the 20 to 45 s warning on host boards goes away).
Open questions: which Sarvam speaker is Chiku's voice (Navin picks later from out/voices/; re-voice only, shubh until then).

## 2026-10-01, session 10: A6.6 per-format QA
Did: Length limits per format (storyboard.ts LENGTH, boardFormat, lengthIssue): host 40 to 60 s, composed 20 to 45 s; estimate warns, a voiced render out of range fails (make.mjs); asserted in primitives.mjs. Text QA checks every platform profile (textcheck.ts SAFE_ZONES: instagram, youtube; self-test extended). YouTube's right 120 px button column failed 13 texts on the host board: added SIDE = 120 (theme.ts) and moved the UI window, karaoke, big type, CTA and end-card sub inside it; big type and CTA get +20 px for the push-in zoom; flow-run's done pill rises straight up instead of drifting right. Stress board now also holds host-hook, word-stack-slam, highlighter-swipe, host-payoff and host-cta at max length. It caught: payoff at 56 chars ran above the safe area (payoff type 104 -> 96 px); CTA overflowed the screen (now wraps, font fits the longest word, max 12 chars "DM " + keyword); CTA brand line was covered by the card, then by the host (brand now follows the card in flow; host moved to y 1400).
Verified: npm run check; 85 contact sheets; host board voiced 43.8 s, 3 composed boards and stress board 0 text errors on both platforms; story regression 24/24.
Decisions: every board is checked against all platform profiles (one cut posts everywhere). Text-vs-text and text-vs-host overlap is not measured (only caption overlap); the stress board plus a still review covers it for now.
Commit: 9c412dc feat(engine): per-format length limits, Instagram and YouTube safe zones, max-length stress fixes
Next: Phase A done. B1 schemas final.
Open questions: Chiku's Sarvam voice (re-voice later).

## 2026-10-01, session 11: B1 schemas final
Did: `schemas/validate.ts`: dependency-free validator for the JSON Schema subset in use (unsupported keyword = throw), CLI `node schemas/validate.ts [<schema> <file...>]`, `npm run schemas`, part of `npm run check` (and tsc). Final schemas: additionalProperties false, ids, lengths, formats; ledger requires approved_by, approved_at and targets once status is approved/dispatched/published; qa requires an error text on a failed check; storyboard schema now matches what the engine renders (format, host, captionStyle, hookPattern, say, captions, meta.source/idea_id/recipe_id required). Enum sync asserted against the engine (themes, hosts, caption styles, transitions, primitives, hook patterns; channel and platform enums agree across schemas). HOOK_PATTERNS moved from make.mjs to storyboard.ts. channel.json platform youtube-shorts -> youtube. The 4 engine boards gained channel + meta.source/recipe_id (example.com links).
Samples: channel = the real c1 channel.json; storyboard = the 4 real engine boards (schema + engine checks); 6 samples in schemas/samples/. Negative tests: 6 broken copies fail with the expected error. The validator caught a bad recipe id in my own sample.
Verified: npm run check; all 4 boards pass make.mjs validation; story validation unchanged.
Decisions: ADR 16.
Commit: 896adc5 feat(schemas): final JSON schemas, dependency-free validator, engine enum sync
Next: B2 recipe generator + novelty rules.
Open questions: Chiku's Sarvam voice; recipe "rhythm" vocabulary still TBD (owner: Navin).

## 2026-10-01, session 12: B2 recipe generator + novelty rules
Did: `studio/novelty.ts`: the 7 rules as pure functions over fingerprints (trigram topic similarity, structure distance over shots + ordered pairs, opening, hero metaphor, theme run, hook run + caption opener, cross-channel same ISO week), ISO week helpers. `studio/recipe.ts`: seeded generator (mulberry32 on sha256 of channel|week), two shapes (host 8 beats on night, composed 6 beats on the channel's other themes), channel + bench filters, 2 of 7 slots flagged experiments, redraws up to 3000 times then throws with the last rule errors. CLI writes recipes/<channel>/<week>.json using every other recipe file as history. Generated recipes/c1-automation/2026-W41.json (7 recipes, all schema-valid).
Verified: `studio/recipe.test.ts` (in npm run check): 8 weeks x C1 + a stand-in C3 = 112 recipes, schema-valid, 0 rule breaks on an independent re-check; seeded repeatability; bench respected; impossible constraints throw; each of the 7 rules fires on a crafted violation and not on its boundary case. Mutation check: a generator that skips the rules fails the test.
Decisions: ADR 17 (TypeScript on Node for agent-studio). Topic, hero metaphor and caption opener are enforced at QA time (only known after writing).
Commit: 6956894 feat(studio): seeded recipe generator and the 7 novelty rules
Next: B3 QA runner + contact sheet.
Open questions: host format is capped at 2 per week by the opening rule (host-hook is its only opener); a second host opener primitive (Phase C) or an opening rule scoped per format would lift it. Navin to decide. Recipe "rhythm" vocabulary TBD. Chiku's voice.

## 2026-10-01, session 13: B3 QA runner + contact sheet
Did: `studio/qa.ts`: 8 checks (schema, text-limits, audio, format, duration, safe-zones, fingerprint, naming), pure `evaluate()` + `runQa()` that reads reel.mp4, text-boxes.json, contact.png, the recipe (recipes/ or --recipes) and state/fingerprints.jsonl (approved videos, written from B4); writes qa.json (validated against qa.schema.json); exit 1 on fail. `engine/scripts/probe.ts` reads container, size, fps, length and audio with @remotion/media-parser (already installed; no ffprobe). Fingerprint check = storyboard matches its recipe (shots, theme, hook, transitions) + all 7 novelty rules, including topic, hero metaphor and caption opener from the written storyboard (storyboard meta.hero_metaphor added, optional). Contact sheet: new BoardSheet composition (real Composer frozen at each scene's middle), rendered by make.mjs as contact.png.
Fixtures: good = host-supplier-bills render + studio/fixtures/recipes/host-supplier-bills.json: all 8 pass. Broken = studio/fixtures/qa-broken.json (rendered): fails audio (no stream), duration (11.3 s), fingerprint (4 recipe differences), naming (file vs id). `studio/qa.test.ts` (in npm run check): good passes, 14 broken cases fail with their exact error strings.
Decisions: naming convention = `<id>.json` + `out/<id>/{reel.mp4,contact.png}`. Open question 2 closed (voice on, audio required).
Commit: 1eda0ab feat(studio): QA runner with exact errors, storyboard contact sheet, media-parser probe
Next: B4 approval page.
Open questions: host 2-per-week cap (opening rule); recipe rhythm vocabulary; Chiku's voice; Remotion licence check (media-parser prints the notice too).

## 2026-10-01, session 14: B4 approval page
Did: `studio/ledger.ts` (append-only state/ledger.jsonl, signed approvals: HMAC-SHA256 over channel|week|ids|by|exp, strict parsing, timing-safe compare, 7-day expiry; apply checks storyboard exists, channel, week, QA passed, not already approved; writes schema-checked entries + the video's fingerprint to state/fingerprints.jsonl, which QA now reads). `studio/approval-page.ts` (static weekly page per channel: contact sheet, hook, caption, QA errors; Approve per video and Approve all for QA-passed ones only; all Forge text HTML-escaped; https webhook URL required). `studio/approval.test.ts` in npm run check.
Verified: test approval writes exactly one ledger entry (schema-valid) and one fingerprint; replay, tampered ids, wrong or short secret, expired link, malformed/injected ids, failed QA, wrong week, unknown board write nothing; a failed video has no link; markup in a caption is escaped. Preview page built from the real host render.
Decisions: n8n is a relay only (secret stays on the Mac); state/ stays gitignored (ledger and pages with live links never committed).
Commit: 5659db3 feat(studio): weekly approval page, signed approve links, append-only ledger
Next: B4b switch-over (watcher + Forge onto engine/, retire reel-engine).
Open questions: where n8n runs (local Execute Command vs cloud queue) and adding the webhook workflow (Navin); APPROVAL_WEBHOOK_URL and APPROVAL_SECRET to be added to agent-studio/.env by Navin; Forge "approve <id>" message path (Q11).

## 2026-10-01, session 15: n8n approval relay + B4b prep
Did: n8n runs in Docker (~/Dev/tools/n8n, 2.31.4, 127.0.0.1:5678) and cannot see this repo, so `studio/approve-server.ts` receives approvals on the Mac (127.0.0.1:5680, GET only, never logs the signed query) and hands them to ledger.ts. `n8n/approval-webhook.json` (Webhook -> HTTP Request to host.docker.internal:5680 -> Respond) imported into n8n inactive via the n8n CLI (id agStudioApprove1); no file under ~/Dev/tools/n8n changed, no credential used. Approval links may be https or http on localhost. Created agent-studio/.env (0600, gitignored) with APPROVAL_WEBHOOK_URL and a generated 48-char APPROVAL_SECRET (value never displayed). Receiver tests added to approval.test.ts.
Verified: container -> Mac hop (host.docker.internal) from n8n_main and n8n_worker; receiver live: health 200, bad signature 403, POST 405. B4b prep: the 7 live Forge stories in engine/content/stories are byte-identical to reel-engine's; latest Forge story rendered from engine/ matches the old render (1080x1920, 30 fps, 37.419 s, audio); watcher first run marks existing files done (no re-render, no Drive duplicates).
Decisions: the watcher switch waits for Forge's output folder to move (the watcher writes .status.txt beside each story; a bridge would write into reel-engine).
Commit: 1b65c98 feat(studio): approve receiver for the dockerised n8n, approval webhook workflow
Next: finish B4b once Forge is repointed; end-to-end test through n8n once the workflow is published.
Open questions: n8n workflow shows as not active (Navin to publish it); receiver as a LaunchAgent (needs Navin's OK); Forge output folder change (Navin).

## 2026-10-01, session 15b: n8n approval relay live
Did: first publish failed ("URL parameter must be a string": n8n's expression sandbox has no URLSearchParams). Forward node now uses a fixed URL + "send query parameters" as JSON; re-imported (same id) and republished by Navin.
Verified end to end through n8n (localhost:5678/webhook/agent-studio-approve -> host.docker.internal:5680 -> ledger.ts): tampered link -> 403 "approval signature does not match"; correctly signed link for an unknown video -> 200 "storyboard not found"; ledger and fingerprint files stay empty.
Commit: fd17b0a fix(n8n): forward approval query as parameters, verified end to end
Next: B4b switch-over after Forge is repointed.
Open questions: receiver LaunchAgent (Navin's OK); Forge output folder change (Navin).

## 2026-10-01, session 15c: receiver installed
Did: `node studio/approve-server.ts --install` (Navin's OK): LaunchAgent com.theautomationguy.approve, RunAtLoad + KeepAlive, log state/approve.log. Re-verified through n8n: signed link -> 200 via the installed receiver; ledger still empty.
Commit: 8a9296a feat(studio): install the approve receiver as a LaunchAgent
Next: B4b switch-over after Forge is repointed.
Open questions: Forge output folder change (Navin).

## 2026-10-01, session 16: B5 dispatcher
Did: `studio/dispatch.ts`: plan (latest ledger line per video; only valid "approved" entries; re-checks QA, video file, recipe) and dispatch (YouTube job to the n8n webhook with the Drive path, then the Instagram queue folder, then a "dispatched" ledger line). Dry run by default; live needs --live and DISPATCH_LIVE=on. YouTube failure queues nothing and leaves the entry approved for a retry. `studio/dispatch.test.ts` in npm run check.
Verified: 10 ledger states (approved, pending, rejected, qa-failed, rendered, revoked by a later line, hand-typed approval without approver, QA now failing, video missing, already dispatched): only the approved one reaches YouTube and the Instagram queue; dry run makes no call and writes nothing; YouTube 502 queues nothing; after a live run nothing is left to send. A sabotaged dispatcher that lets pending-approval through fails the test. Real dry run: 0 to send (ledger empty).
Decisions: YouTube upload reads the video from Google Drive (n8n in Docker cannot see the Mac); posting time 19:00 IST for all channels for now.
Commit: b7a5241 feat(studio): dispatcher with n8n YouTube upload, approval check, one Instagram queue, data-driven times
Next: B4b (waiting on Forge's folder), then B6 Learn.
Open questions: n8n YouTube upload workflow (needs a YouTube credential in n8n; Navin); how Forge picks up the Instagram queue folder (Q3); posting time per channel; YOUTUBE_WEBHOOK_URL and DISPATCH_LIVE stay unset until then.

## 2026-10-01, session 16b: dispatch wired to n8n, data-driven times, one IG queue
Did (Navin's answers): YouTube upload workflow `n8n/youtube-upload.json` imported inactive (agStudioYoutube1): webhook -> Code node asks the Mac receiver `/dispatch-check?id=` (new endpoint: yes only for what the dispatcher would send now) -> upload private with publishAt, or 403. Dispatcher sends the job and the video file as multipart (no Drive dependency). Instagram: one queue folder for all channels; each post.json carries channel and handles. Posting times from data: state/learn/posting-times.json (written by Learn), 19:00 IST until then; past slots move to now + 15 min. Receiver restarted with the new endpoint.
Verified: dispatch and approval tests (data times, past slot, dispatch-check yes/no for 6 states, video bytes in the multipart, post.json handles); dispatch-check reachable from the n8n container (403 for an unknown id).
Commit: b7a5241 feat(studio): dispatcher with n8n YouTube upload, approval check, one Instagram queue, data-driven times
Verified through n8n after Navin published (credential attached): job for an unapproved video -> 403 "not approved for dispatch", receiver logged the check, nothing uploaded; the file arrives as binary "video", which the upload node reads.
Next: a real upload test needs Navin's OK (one private video on the channel).
Open questions: B4b Forge folder.

## 2026-10-01, session 16c: real YouTube upload test (Navin: "test and fix")
Did: hold mode (`dispatch.ts --hold`: private upload, no publish time), so a test can never go public; n8n upload node now omits publishAt when empty (patched on the exported live workflow so Navin's credential stayed attached; re-published by Navin). STUDIO_RECIPES env for sandboxes. Ran the real chain against a sandbox ledger (installed receiver swapped out for the run, then restored; real ledger untouched): signed approval -> dispatch --live --hold -> n8n -> Mac dispatch-check 200 -> YouTube upload.
Result: n8n execution 56 success; YouTube video id Q8sNfIm_PMU (private, on Navin's channel; not deleted, Navin's call). Sandbox ledger got its "dispatched" line; Instagram queue folder had reel.mp4, caption.txt, post.json (channel + handle).
Fixed from the test: the dispatcher ignored n8n's reply, so the video id was lost; it now requires {uploaded: true, youtube_id} and records the Shorts link in post_urls (any other 200 reply is a failure, nothing queued). Hold no longer writes a scheduled_for. Tests added for both.
Verified: npm run check.
Commit: b7a5241 feat(studio): dispatcher with n8n YouTube upload, approval check, one Instagram queue, data-driven times
Next: B4b (Forge folder), then B6 Learn (writes state/learn/posting-times.json from metrics).
Confirmed by Navin: Q8sNfIm_PMU is private (he deletes it later).
Open questions: publishAt path gets its first live check on the first real approved video; YOUTUBE_WEBHOOK_URL and DISPATCH_LIVE not yet in .env.


## 2026-10-02, session 17: B6 Learn
Did: channel KPI formula in channel.json (kpi.numerator/denominator, schema updated); `studio/learn.ts` (KPI by primitive, theme, hook pattern, topic word, posting hour; bench bottom quartile for 2 weeks, never a single-option beat; proven = at or above median; missing-kind hint; writes state/learn/<channel>/{learn.json,scoreboard.md} and state/learn/posting-times.json); recipe.ts reads learn.json (bench + proven; experiments must try something unproven); STUDIO_RECIPES env for the recipe CLI. recipe.test.ts still passes; tsc passes.
Fixed: the test planted its "good" primitive on ui-diff, which had only 2 sample videos (Learn rightly refused to judge it); planted on chat-pop instead, plus an assert that under-sampled primitives are shown but not judged. learn.test.ts in npm run check: 28 sample videos -> bench (bottom quartile incl. stamp-hit, until W43), proven list incl. chat-pop, YouTube best at 21:00, 24h numbers replaced by 7d, bad metrics refused; the real recipe CLI reads learn.json (no benched primitive, experiments try something unproven, bench expires at W43). Real run on empty data: nothing benched, defaults kept.
Go live (Navin: "do the best option"): YOUTUBE_WEBHOOK_URL and DISPATCH_LIVE=on appended to agent-studio/.env (file not read); `dispatch.ts --live` runs live, 0 to send. Only approved ledger entries can go out.
B4b: Forge's folder is set by the skill text Navin installs in Forge (paths are relative to where Forge runs); the switch-over goes into the B7 Forge skill draft so one install moves Forge and the watcher together. Old watcher keeps rendering until then.
Test video Q8sNfIm_PMU: left for Navin to delete (permanent delete is his).
Open questions: metrics collector (n8n in Docker cannot write state/metrics.jsonl; it will need a receiver endpoint like approvals).
Commit: 9061301 feat(studio): Learn scoreboard, bench, 70/30 split and data-driven posting times

## 2026-10-02, session 18: B7 Forge Weekly Writer
Did: Forge skill text `agents/writer/FORGE_WEEKLY_WRITER.md` (Navin installs it): reads recipes/<channel>/<week>.json, ideas/<channel>.jsonl, scoreboard.md, RULEBOOK, primitive specs; writes one storyboard per recipe to `engine/content/storyboards/<recipe id>.json`; reads `<id>.status.txt` to fix; never touches recipes, state, engine code or .env; posts only from the Instagram queue. Writer RULES and TECH diagram point at the real folder.
Watcher (`engine/scripts/watch.mjs`): after a storyboard renders it runs `studio/qa.ts`; `.status.txt` says `ok` with the 8 checks, or `failed QA` with the exact error (tested both: good board ok, wrong recipe id -> "FAIL fingerprint recipe no-such-recipe not found"). QA-failed renders are not copied to Drive.
Dry-run week 2026-W41: 7 storyboards written to the skill (Claude standing in for Forge), voiced with Sarvam shubh, rendered, 7 of 7 pass QA. Lengths: composed 24.9 to 25.6 s, host 45.7 s and 40.7 s. One per role family: payment reminders, order emails (DM AUDIT), morning MIS, dispatch status, leave register, stock reorder, quote follow-up. Approval page: state/approval/c1-automation/2026-W41/index.html.
Fix: schemas/validate.ts read the new `.status.txt` files as storyboards; now `.json` only.
Decisions: Writer output goes to engine/content/storyboards (watched), not root content/. No feed yet, so the Writer adds idea lines itself, each with a real link (ideas/c1-automation.jsonl has 7 dry-run seeds with Google Trends India links; Reddit is not reachable from Claude's search). Hook on screen max 6 words (RULEBOOK), now in the skill.
Next: B4b on install: Navin installs the skill in Forge; then unload com.theautomationguy.reelwatch and run `npm run watch:install` in engine/ (first run marks existing files done), and Forge writes its first real week.
Open questions: host board 4 is 40.7 s, close to the 40 s floor (re-voicing with Chiku's speaker may change it; QA will catch it). Metrics collector still open. Forge posting from the IG queue vs Navin posting from phone (old skill) needs Navin's call.
Telegram approvals (Navin: approve from the phone, the page and links are localhost-only): `studio/telegram.ts` sends each QA-passed, unapproved video of the week to Navin's chat with an Approve button (+ Approve all); the approve receiver long-polls Telegram (outbound only, no tunnel, no webhook) and turns a tap into the same signed approval (`applyApproval`). Only taps from TELEGRAM_CHAT_ID in that private chat count; replays write nothing; offset file stops restarts replaying. `weekVideos()` in ledger.ts now shared by the page and Telegram. Test: `studio/telegram.test.ts` in npm run check. Needs TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in agent-studio/.env (Navin adds them; never pasted in chat).
Commit: e3c0467 feat(writer): Forge Weekly Writer skill, watcher QA status, Telegram approvals; dry-run week W41 passes QA

## 2026-10-02, session 19: Phase C, primitives batches 1 to 3
Did: two primitives from plan section 5, chosen for what C1's videos lack (Learn has no data yet, so no missing-kind hint):
- `split-flap` (data, all channels, 2.5 to 5 s): airport board, tiles flip through letters and land left to right from cue 0; flip speed adapts so the last tile lands 20 frames before the cut. Params label 24, text 10, sub 40 (optional).
- `before-after-split` (world, C1 and C3, 3 to 7 s): manual steps fill the top half (cue 0), a divider sweeps and the automatic steps fill the bottom (cue 1); no cues: before at once, after at 45%. Params before/after {title 14, lines 2 to 3 of 26}.
Both: role tokens only (theme gate passes), spec example = test storyboard, contact sheets in all 5 themes (out/primitives/), max-length cases added to the stress fixture: 0 text errors. Added to the recipe pools (split-flap: composed opener and result beats; before-after-split: the turn beat in host and composed) and to the recipe, fingerprint and storyboard schema enums. Forge sees them through specs.ts, no skill change needed.
Fixes during review: before-after-split stayed empty for 1.4 s without cues; type sizes raised on both.
Decisions: skipped bar race and line draw for now (charts invite result claims the honesty rules forbid).
C2: two more, again for C1's story:
- `phone-buzz` (world, all channels, 2.5 to 6 s): a phone lock screen fills with notifications, one per cue, newest on top; the phone buzzes and the badge counts. Params time 5, notes 3 to 5 of {icon, from 18, text 26}. In the pain pools (host PAIN, composed beats 1 and 2).
- `maze-to-line` (world, C1 and C3, 3 to 6 s): a tangled path (manual) snaps into one straight line on cue 0 (default 45%), a dot zips to the end, the end label lights up. Params from 14, to 14. In the turn pools (host and composed).
Stress: storyboards cap at 12 scenes, so the 4 new primitives moved to `engine/test/stress-ui-2.json`; `npm run stress` renders both files, 0 text errors each. Contact sheets in 5 themes. Fixes from review: maze labels overlapped the tangle (tangle now above the line, labels below); phone wider, larger type.
Bug found and fixed: with the bigger pools, Learn's sample bench (5 primitives) left the 70% proven slots too few options and Recipe threw on novelty. Proven picks are now a preference: the first half of the draws prefer them, the second half use the whole pool (benched stay out). learn.test now checks a share (proven used in 14 of 17 eligible beats) instead of every beat.
C3: `zoom-dive` (camera, all channels, 3 to 7 s), the first camera-family primitive: the camera dives through 2 to 4 nested layers (e.g. inbox > email > attachment > the one number), one cue per landing; each layer sits in its parent's centre box at 1/3.2 scale; a passed layer's text fades out (1.08 to 1.4x) and the card itself fades (1.15 to 1.9x) so nothing oversized reaches the frame edge; the last layer shows its label large (font fitted to length). Params layers {icon, label 18, sub 26 optional}. In the opener and pain pools. Stress (wide letters) caught an 18-char title overflowing its card: titles now wrap to 2 lines. Contact sheets in 5 themes.
learn.test: the "too few videos" check no longer names ui-diff (absent from the bigger-pool sample); it checks every thin row.
Phase C done: 22 primitives, families kinetic-type, world, data, texture, camera.
Next: Phase D is gated on go-live (C1 must run 14 days first). Before Navin returns for production setup: the metrics collector (Forge, via its Meta connector, as the Instagram source) and the list of Forge skills per channel.
Navin (2026-10-02): no go-live until every channel is set up; he returns for the production setup and start. W41 stays approved, not dispatched. Forge skills (all of them) are installed at the end, B4b with them. Instagram posting is Forge's job via its native Meta connector, which also makes Forge the likely metrics source for Learn.
Open questions: none new.
Commit: 8d1d8a3 feat(engine): 5 new primitives (split-flap, before-after-split, phone-buzz, maze-to-line, zoom-dive); Recipe proven picks are a preference

## 2026-10-02, session 20: production pass (Phase P)
Did:
- Metrics: `studio/metrics.ts` (ingest Forge's `inbox/metrics/` files, `record()`, `due()`); receiver `GET /metrics-due` and `POST /metrics`; n8n `youtube-stats.json` imported inactive, container reaches the receiver (checked live: undispatched video refused, nothing written). Learn: a row counts only if it carries a KPI numerator field; a later reading of the same window replaces the earlier one.
- Per-channel output: closers show the channel's own handle (HandleCtx; make.mjs reads channel.json; no real handle = no render; PREVIEW_HANDLE only for samples). Every render records its handle in `out/<id>/render.json`; Dispatch blocks a video whose handle is not the channel's, and any channel without `"live": true`.
- Channels: C2/C3 configs fixed (KPI numerator/denominator, youtube platform), `live: false` on all, every channel.json validated in check; Facebook as a platform (Forge queue `post.json` now lists `accounts`); per-channel YouTube `webhook`.
- Formats: new C2 `reach` format (no automation flow); formats now name their channels; pile-drop, chat-pop, before-after-split, maze-to-line opened to C2. 8-week test covers all three channels: 168 recipes, 0 rule breaks.
- Production loop `studio/run.ts` (hourly tick, `--install` for launchd): metrics, Thursday planning (never overwrites), Telegram send-once, dispatch, publish confirmation (Forge `posted.json`), problems to Telegram. Real tick with nothing live: does nothing. `planWeek()` extracted from the recipe CLI.
- Telegram: each video shown once; "Approve all" covers only videos already shown.
- Forge skills: Weekly Writer now covers all three channels (table of topic, format, CTA, caption per channel); new Queue Publisher and Metrics Reporter. `docs/SETUP.md`: the go-live list.
- Samples: C2 W42 slots 1 to 2 and C3 W42 slots 1 to 2 written, voiced, rendered with a preview handle: 4 of 4 pass QA (C2 26.6 s, 23.1 s; C3 21.5 s, 23.8 s).
Fixes found by the samples: zoom headroom was SIDE + 20 but the 6% push-in needs 24+ (word-stack-slam ran 3 px into YouTube's button column at 28 characters): now SIDE + 30 everywhere, both stress files 0 errors. split-flap now lands on its cue (it started flipping on it, so a hook with the accent at the end showed blank tiles).
Decisions: C2 makes one-idea explainers with no invented facts; C3 makes explainers for clearly labelled example brands ("made with our motion engine"). YouTube reach = views until the Analytics API is wired. The loop is installed at go-live, not now.
Next: P5 go-live with Navin (docs/SETUP.md), then Phase D.
Open questions: C2's week leaned on before-after-split (4 of 7 in W42; Learn will rebalance once data exists). W41 C1 renders predate render.json, so they would need a re-render before dispatch (their dates will have passed anyway).
Commit: 5ddfc07 feat(studio): production pass: metrics, per-channel output and live switch, C2 reach format, hourly loop, Forge skills, SETUP.md

## 2026-10-02, session 21: end-to-end audit (P6)
Did:
- Feed (P0): `studio/feed.ts` parses RSS/Atom (no dependency), keeps each item's own link (Google Trends: its news link, else that query's Trends page), checks idea.schema.json, dedupes by id and link per channel, writes `ideas/<channel>.jsonl`. Feeds per channel in channel.json `feeds` (schema added). Receiver `GET /feeds`, `POST /feed {url, body}` (unknown feed, non-feed, no items: 400, nothing written; 5 MB cap). n8n `feed.json` (daily 07:00, 8 s between feeds) imported inactive. Live from the container: Google Trends 20 ideas written, all valid; Reddit 403/429 to the container, nothing written.
- Dispatch idempotency (P0): per-video claim (`dispatching`, new ledger status) before calling n8n; YouTube URL written the moment it is known; queue folder written via temp+rename with post.json last; then `dispatched`. `{uploaded:false}` or a refused connection releases the claim (retry); 5xx/timeout/garbled = unknown, stuck, never re-sent (`plan().stuck`, Telegram alert, `node studio/dispatch.ts --resolve <id> <youtube id|none>`); a local failure after the upload resumes with local steps only. `/dispatch-check` says yes to a fresh claim (30 min). Tests: refused x2, unknown x3, crash after upload, died after claim, torn ledger line.
- B4b (P0): the only watcher running was the old reel-engine one. The agent-studio watcher now has its own label (com.theautomationguy.studiowatch, no longer the old one's) and is installed and running next to the old one; the tick reports a problem (once any channel is live) if it is missing, stopped or pointing at another engine. reel-engine untouched; the old watcher is retired at Forge's switch (SETUP).
- Ledger/fingerprints (P1): crash-safe JSONL for ledger, fingerprints and metrics (a torn last line is ignored and cut off before the next append; a broken middle line stops as corruption). `repairFingerprints()` runs on every approval and every tick; fingerprints dedupe by id. `node studio/ledger.ts reject <id...>` (approved only).
- Loop (P1): `studio/loop.test.ts` drives feed -> Thursday plan -> Forge boards -> QA -> Telegram "Approve all" -> ledger + fingerprints -> live dispatch (7 uploads, none repeated) -> posted.json -> published -> Forge + n8n metrics -> next Thursday: Learn (bench, proven, posting times) -> next week's recipes avoid the bench.
- Skills: Queue Publisher skips folders without post.json; Writer knows the feed fills the idea list.
- Docs: README status/stack/how to run, TECH (contracts table, crash safety, dispatch protocol), SETUP (watcher done, feed workflow, reject the W41 test approvals, stuck/resolve), n8n README (feed, upload contract), dispatch RULES, metrics schema, C1 RULEBOOK CTA ratio, WORKFLOW feed fallback. Learn's no-per-shot-attribution limit kept.
Checks: npm run check 14 steps pass (incl. feed, loop); stress 0 text errors x2; live receiver endpoints from the n8n container: /health 200, /feeds 200, /metrics-due 200, /dispatch-check 403 (not live), /approve 403 (unsigned); real tick: nothing live, nothing done.
Next: P5 go-live (docs/SETUP.md).
Open questions: Reddit RSS blocks the container (403/429); Google Trends works. A Reddit fix needs Reddit's API (an app key) or fetching from the Mac; Navin's call. DISPATCH_LIVE=on is still in .env, but no channel is live, so nothing can go out.
Refinements (same session, Navin's list):
- Telegram resolve buttons: an unknown upload gets one message per claim with "Not uploaded" / "Uploaded" (telegram.ts `askResolve`); taps and the ID reply are gated to TELEGRAM_CHAT_ID and go through a signed query like approvals (dispatch.ts `resolveQuery`/`applyResolve`, HMAC with APPROVAL_SECRET, 60 s). "Uploaded" asks via a forced reply for the ID or link (`youtubeId()` accepts a bare ID, shorts/watch/youtu.be links), records it, and the next tick finishes the queue without uploading. Polling now also takes messages. The tick sends the buttons instead of putting those videos in the hourly problem text. Tests: both taps end to end, chat gating, replies to other messages, bad IDs, bad/tampered/expired signatures, asked once per claim, never auto-retried.
- Reddit via the Mac: `POST /feed {url}` makes the Mac fetch the listed feed (`pullFeed`; unlisted URLs never fetched; non-200 = nothing written + reason). n8n feed workflow sends URLs only (re-imported, inactive). Real run through the container -> Mac: r/productivity 25 valid ideas; three Reddit feeds rate-limited (429) that hour, nothing written, reason reported.
- Watcher handover: SETUP step 5 order (Forge skills, unload reelwatch, watch:install); the tick alerts "two watchers" when both are loaded and a channel is live (test).
- DISPATCH_LIVE: an in-place edit of .env is blocked by the deny rule, so `DISPATCH_LIVE=off` was appended (Node's env loader keeps the last value, checked on a scratch file); verified through `node studio/dispatch.ts --live` -> "--live ignored ... (dry run)". SETUP step 6 appends `DISPATCH_LIVE=on` at go-live.
Checks: npm run check 14 steps pass.
Commit: 1ae073a (with session 22)

## 2026-10-03, session 22: P5 channel setup (C1 + C2 accounts, brand, Archive Gold)
Did:
- Handle @theautomationguy.navin -> @theautomationguynavin everywhere (Instagram + YouTube claimed); email in engine/README.md replaced by a placeholder.
- brand/c1-automation: YouTube banner (Night Signal, live), profile picture, Facebook cover, two Instagram highlight covers. brand/c2-reach: barcode B mark with the rewind arrow in the stem (master, small cut, circle, mono), YouTube banner, Facebook cover, 110/32/16 px legibility sheet (two Forge review rounds).
- C1: night theme only; Facebook publisher by page_id 1429203763599559, handle pending_retry_2026-10-05.
- C2 is Backstory (@backstory.minute): role, audience, content_mix, archive theme, feeds (Google Trends IN, r/todayilearned, r/history), RULEBOOK (sources for every claim, no fiction as fact, sixty-second story grammar, Archive Gold only, maker credit), own n8n YouTube webhook; Facebook pending, no page_id yet.
- Archive Gold theme (themes.ts, four schemas). Pending handles: not an approval target, skipped by dispatch; publisher `page_id` in schema and Forge queue.
- One-theme channels skip the theme-run novelty rule (recipe + QA, tested). Per-channel end-card logo (MarkCtx; engine/public/brand/c2-reach/mark.svg), verified with a C2 render (handle @backstory.minute).
- Writer table, Queue Publisher post.json, SETUP rows updated.
Decisions: C2 = Backstory, Archive Gold (navy, paper, gold, grey; terracotta warn; no lime or blue). C1 night only, night muted stays #9C9A94. Brand files stay in brand/<id>/. One Google login owns every YouTube channel as a Brand Account (one Cloud project, one n8n credential per channel); separate emails only for Instagram. Old handle stays in past commits (no history rewrite).
Checks: npm run check 14 steps pass; theme gate passes archive; old handle 0 matches; all channels live false.
Next: P5 go-live (docs/SETUP.md): Facebook usernames retry 2026-10-05 to 09; C2 page_id; duplicate the n8n YouTube workflow for C2; Forge skills; watcher handover; W41 rejects.
Open questions: ideas/c2-reach.jsonl holds 37 ideas from the old reach feeds (archive them?). C2 Facebook page_id.
Commit: 1ae073a feat: C1 night-only and C2 Backstory channel setup; Archive Gold theme; pending Facebook usernames; brand assets

## 2026-10-03, session 23: Part 4 (packaging, retention, SEO), voices locked, production review, motion styles, style presets, self-improving loop
Did:
- Part 4: SEO preflight (studio/seo.ts, QA check `seo`), scene retention (render.json scenes, metrics `retention`, Learn holds/leaks, Recipe prefers holds), thumbnails A/B (Thumbnail.tsx) and title/thumbnail experiments (studio/experiment.ts, ABBAAB by Pacific day, off unless EXPERIMENTS=on). n8n: C2 upload, C1/C2 stats with YouTube Analytics, C1/C2 packaging (imported inactive).
- Voices: local Kokoro, no API, no cloning (Sarvam removed). C1 af_heart 1.15 with Tally pinned to /tˈæli/; C2 am_fenrir 1.0 (channel.json `voice`). Every clip levelled to -20 dBFS and trimmed to 40 ms lead/tail; locked lines re-rendered: no clipping, longest pause 0.45 s.
- Review fixes: voicing crashed on any scene without a line (every end card) with VOICE=on; all three C2 n8n workflows had been given C1's YouTube credential at import (now named references that fail closed); /dispatch-check and /packaging-check refuse another channel's video (`channel=`); a thumbnail failure no longer hides a finished upload; one unreadable video no longer stops the stats run; dead helpers and unused imports removed; stale C2 dry-run boards, recipe and 27 off-genre ideas removed; .gitignore covers client secrets, token files and keys; working tree and full history scanned, no secrets.
- Motion (docs/MOTION.md): maker-motion's rules in our words (eased moves, 0.3 s transitions, one camera move per shot, text on cuts, no dead air over 0.5 s; measured 0.42 to 0.45 s between lines).
- Style presets (styles/*.json, schema, docs/MOTION.md): c1-night-v0 and c2-archive-v0 (current looks, active), c1-night-signal-v1 (arrow-fold opener, fold sweep, lime only when automated, strike-through then lime pulse) and c2-archive-gold-v1 (year-flap opener, gold thread, gold name and year as spoken) on review. One setting `style` per channel; render.json, ledger line and fingerprint record the version. Test videos style-c1 (24.8 s) and style-c2 (31.5 s), 0 text errors.
- Self-improving loop (studio/learn.ts, studio/improve.ts, run.ts, telegram.ts): Learn daily with machine-readable findings (primitive KPI and retention, style version, hook, caption kind, CTA, length, slots); Tier 1 applied by Recipe/Writer/Dispatch and logged with evidence (state/learn/changes.jsonl); Tier 2 style/grammar proposals on Telegram, applied only by Navin's tap, one whitelisted setting; guarded list refused; weekly plain-words note with the Thursday recipes. Test studio/improve.test.ts drives the real tick.
Decisions: C2 voice am_fenrir 1.0. maker-motion for motion. Styles as versioned presets; recipe defaults unchanged until Navin approves v1. A styled channel takes its theme from the preset (C1/C2 `themes` removed). The C2 thread is gold (`thread-paper` is the paper option).
Checks: npm run check 16 steps pass; stress fixtures 0 text errors; n8n dry run of every Code node (YouTube faked) passes; channels live false, DISPATCH_LIVE off, nothing published.
Next: Navin reviews the two test videos and sets `style` to v1 (or taps the proposal). Navin's n8n credentials (SETUP step 3), receiver restart, C1 upload/stats re-import on his OK.
Open questions: C2 length floor (30 s is only reached when every line fills its shot); SARVAM_* lines in engine/.env.example (not read by Claude).

## 2026-10-03, session 24: platform variants, clean slate, production and open-source readiness
Did:
- Variants: every approved video renders three platform variants (YouTube, Instagram, Facebook), each its own render from the style preset's `platforms` spec (size, thumbnail, end card account, caption template, CTA per kind with spoken line, file name rule, destination; schema + validate.ts check them against studio/variant.ts). Canonical `engine/out/<channel>/<date>/<id>/<platform>/` and `queue/<channel>/<platform>/`; every file named `<channel>-<platform>-<date>-<id>.<kind>`; manifests (schemas/manifest.schema.json, schemas/queue.schema.json) are authoritative. Only boards in the Writer's folder render into `out/`; tests render to `engine/test/out/`. A re-render replaces the variant folders whole; one platform failing to render fails alone; new voice clips trigger a rebundle (the second and third platforms 404'd on their clips before).
- QA per variant adds `manifest` (schema, identity, render.json platform and style, file hash, no copy of a sibling), `cta` (the preset's words, Subscribe only on YouTube, Instagram funnel names Instagram, end card account, caption CTA line) and `destination` (own publisher, route, own YouTube webhook, Facebook page_id; a pending username holds the variant "for Navin", not as a board error). Size from the preset.
- Ledger one line per (video, platform) with the approved video's SHA-256 and the link id; one Telegram tap approves the master and its QA-passed variants; replayed links refused (also after a rejection); a re-render needs and gets a new approval; `reject` takes back only waiting variants.
- Dispatch by (channel, platform): YouTube only to `channels/<id>` webhook `/webhook/agent-studio-youtube-<channel>` (YOUTUBE_WEBHOOK_URL fallback removed), Instagram/Facebook to their queue folder; refuses unknown channel/platform, pair mismatch, malformed or missing manifest, wrong destination/handle/page_id, failed QA, changed video (sends the hashed bytes), already-queued items. YouTube variants marked published once their publish time passes (experiments need it). `/dispatch-check` and `/packaging-check` require channel (and platform=youtube).
- Length: C1 40 to 60 s in both formats (8-beat explainer); C2 25 to 45 s; Recipe only hands out shot lists that can reach the floor (`reachable`: a third of C1 explainer recipes could not). C1 test board rewritten (8 shots): 46.1 to 46.5 s voiced on all three platforms; C2 30.8 to 31.2 s.
- n8n: upload workflows take only their own channel's YouTube jobs before asking the Mac; C1 upload path renamed to `agent-studio-youtube-c1-automation`. C1 upload, C1 stats and C2 upload imported, published, n8n restarted; export matches the repo for all 9 files; 8 active.
- Clean slate: 7 W41 test approvals, fingerprints, learn and approval pages, 161 MB of renders, voice cache, W41/C3 dry-run boards, legacy stories, dry-run recipes, 9 dry-run seed ideas and the retired Forge content skill archived (verified identical) to `~/Dev/projects/agent-studio-archive/2026-10-03-clean-slate/` (README inside), then purged (git rm / moved to the Trash). Ideas, recipes, Writer boards and the queue are now ignored by git (production state).
- Docs: README, SETUP (rewritten), TECH (Variants, contracts, QA, approval, security), MOTION, Writer skill (per-platform CTA vocabulary), Queue Publisher and Metrics Reporter skills (new queue layout, manifest-only routing), dispatch/render-qa/writer RULES, rulebooks, FORMATS_PROPOSAL, AGENTS, WORKFLOW, DECISIONS (ADR 18 to 21), BUILD_PLAN P7, n8n README, engine README (rewritten; private path removed), `.env.example` (the names the code reads).
- `studio/simulate.ts`: a production cycle on the real renders in a sandbox (fake n8n and Telegram).
Decisions: file names carry identity everywhere (also inside render folders), hyphenated `<channel>-<platform>-<date>-<id>`; a pending username renders the variant with no account on its end card and QA holds it; Writer boards, recipes, ideas and the queue are not committed.
Checks: npm run check (16 steps) pass; npm run stress and npm run primitives (see below); node studio/simulate.ts pass; live n8n contract checks (never-approvable id): right channel asks the Mac -> 403, wrong channel/platform/garbled job refused in n8n, old shared path 404, tampered/expired/malformed approval links 403; channels live false, DISPATCH_LIVE off (dispatch.ts --live says dry run), ledger and queue empty, nothing published.
Open-source audit: no credentials in the working tree or any of the 27 commits (every key in every .env.example version is empty; only labelled test secrets). Older engine/README.md versions (489d26b to c04785c) contain two email addresses (one is the commit author address) and a home-folder path; removing them needs a history rewrite (Navin's call). Public identifiers kept on purpose: handles, YouTube channel IDs, the C1 Facebook page ID, n8n credential IDs (references, not secrets). No LICENSE yet (Navin picks one).
Next: P5 go-live (docs/SETUP.md): Facebook usernames (retry 2026-10-05) and C2 page_id; install the updated Forge skills; watcher handover; hourly loop install.
Open questions: engine/.env.example still lists empty SARVAM_* lines (Sarvam removed; not edited by Claude per the standing rule); history rewrite for the old README emails before going public; a licence.
Commit: 3ea7a92 feat: finalize multi-platform production pipeline

## 2026-10-03, session 25: open-source README, MIT license, dotfile-safe scans
Did: README rewritten for open source with freshly run verification evidence; MIT LICENSE; folder scans skip dotfiles (a Finder .DS_Store in channels/ crashed schema validation, feed and the live-channel scan), regression check in studio/loop.test.ts.
Decisions: C2 stays 25 to 45 s until the phase-2 history shots (the current 6-beat pool tops out at 34 s, so 40 s is unreachable). No history rewrite: the only personal data in old commits is the author's own email (already public as the commit author on every commit) and a home path in old engine/README.md versions; the other address found is the VT323 font author's, required by its OFL licence.
Next: P5 go-live (docs/SETUP.md).
Open questions: none blocking.
Commit: 73b35d5 docs: open-source README, MIT license; fix: skip dotfiles in folder scans
