# BUILD_PLAN

Why: one task per Claude Code session, each with a clear stop condition. Check a box only when "done when" passes.

## Phase 0: docs + scaffold (agent-studio)
- [x] **0.1 Docs and scaffold.** Done when: every file in the scaffold exists and open questions are logged.

## Phase A: themes + primitives + Composer (`engine/`)
Phase done when: the same storyboard renders correctly in all 4 themes, and 3 storyboards with different openings render with voice.

- [x] **A1 themes.ts + contrast test.** Done when: 4 themes define all 11 role tokens and `npm run gate:themes` passes WCAG AA for each.
  > Read CLAUDE.md, docs/TECH.md "Themes". In engine/, create src/themes.ts with role tokens and 4 themes, plus a contrast check script.
  > Keep existing renders working. No hex outside themes.ts in new code.
  > Stop when the contrast script passes for all 4 themes.
- [x] **A2 Refactor to role tokens.** Done when: `npm run gate:themes` finds no raw colour outside themes.ts and existing stories still render (`node scripts/stills.mjs <dir>` frame diff).
  > Read CLAUDE.md. In engine/, replace every hex colour in src/ with role tokens from themes.ts.
  > Add the grep check to the gate. Re-render story-order-emails to confirm nothing changed.
  > Stop when the grep check passes and the render matches.
- [x] **A3 Primitive interface + registry.** Done when: about 12 primitives are registered, each with schema, cue points, suited channels, test storyboard, contact sheet. (10 shots; whip-pan and ink-wipe transitions land in A4. Check: `npm run primitives -- --all-themes`.)
  > Read CLAUDE.md, docs/TECH.md. Define the primitive interface (params, text limits, min/max seconds, cues, channels) and a registry.
  > Break the `pile-to-flow` story (engine/src/story/Story.tsx, the only template left) into about 12 primitives. One test storyboard per primitive.
  > Stop when all primitives render their test storyboard.
- [ ] **A4 Composer.** Done when: a storyboard (list of primitives + transitions + cues) renders to one composition.
  > Read CLAUDE.md, schemas/storyboard.schema.json, engine/src/primitives/specs.ts. Build the Composer: storyboard to composition, accent cues, captions, transitions (whip-pan, ink-wipe).
  > Rebuild pile-to-flow as a storyboard from primitives, then delete story/Story.tsx and the copied atoms.
  > Keep old formats rendering until the Composer reproduces them.
  > Stop when one storyboard renders in all 4 themes.
- [ ] **A5 Text box measurement.** Done when: each render writes measured text boxes to a JSON file QA can read.
  > Read CLAUDE.md, schemas/qa.schema.json. Measure text boxes at compose time and write them next to the render.
  > No guessing from pixels. One runnable check.
  > Stop when 3 storyboards with different openings write their text boxes.

## Phase B: agent-studio core
Phase done when: a dry-run week for C1 goes from feed to approved queue with zero hand edits except approval.

- [ ] **B1 Schemas final.** Done when: all 8 schemas validate one sample file each.
  > Read CLAUDE.md, schemas/. Turn the drafts into final JSON Schemas with one valid sample each.
  > Add a validate command. No new dependency without asking.
  > Stop when every sample validates.
- [ ] **B2 Recipe generator + novelty rules.** Done when: a unit test proves 8 weeks of recipes never break the 7 rules.
  > Read CLAUDE.md, docs/TECH.md "Novelty rules", agents/recipe/RULES.md.
  > Build the generator and the 7 checks. Seeded random so tests are repeatable.
  > Stop when the 8-week test passes.
- [ ] **B3 QA runner + contact sheet.** Done when: QA passes a good render and fails a bad one with the exact error.
  > Read CLAUDE.md, agents/render-qa/RULES.md. Build QA: ffprobe, schema, text boxes, fingerprint, naming.
  > Write the contact sheet PNG. One good and one broken fixture.
  > Stop when both fixtures give the expected result.
- [ ] **B4 Approval page.** Done when: a static weekly HTML shows contact sheets and approve links that write the ledger via the n8n webhook.
  > Read CLAUDE.md, schemas/ledger.schema.json. Generate the weekly page per channel with approve and approve-all.
  > Webhook URL from env name only. Never read .env.
  > Stop when a test approval writes one ledger entry.
- [ ] **B4b Switch-over.** Done when: the watcher and Forge use `engine/`, and the old reel-engine is retired.
  > Read CLAUDE.md. Point the watcher (launchd) and Forge's content path at agent-studio/engine.
  > Render one story from the new path. Old reel-engine stays as a read-only backup.
  > Stop when a Forge story renders from engine/.
- [ ] **B5 Dispatcher.** Done when: only "approved" ledger entries reach the n8n YouTube call or the Forge IG queue (dry run).
  > Read CLAUDE.md, agents/dispatch/RULES.md. Build ledger to n8n (YouTube) and Forge queue (Instagram).
  > Dry-run mode by default. Nothing publishes.
  > Stop when a test proves unapproved entries are never dispatched.
- [ ] **B6 Learn.** Done when: sample metrics produce a scoreboard, bench list and 70/30 split the Recipe step reads.
  > Read CLAUDE.md, agents/learn/RULES.md, schemas/metrics.schema.json.
  > Build KPI by primitive, theme, hook pattern and topic; bench bottom quartile for 2 weeks.
  > Stop when the Recipe step consumes the output in a test.
- [ ] **B7 Forge Weekly Writer skill update.** Done when: Forge produces 7 C1 storyboards that pass QA from one recipe file.
  > Read CLAUDE.md, agents/writer/RULES.md. Draft the "Weekly Writer" skill text for Forge (Navin installs it).
  > Inputs and outputs as in plan section 8.
  > Stop when the dry-run week passes.

## Phase C: 8 new primitives (`engine/`), 2 or 3 per session
- [ ] **C1 Primitives batch 1.** Done when: each new primitive has schema, cues, channels, test storyboard, contact sheet and renders in 4 themes.
  > Read CLAUDE.md, the Learn missing-primitive hint. Build 2 or 3 primitives from the plan section 5 list.
  > Role tokens only. One test storyboard each.
  > Stop when all render in 4 themes.
- [ ] **C2 Primitives batch 2.** Done when: same as C1.
- [ ] **C3 Primitives batch 3.** Done when: same as C1; registry has 20 primitives.

## Phase D: channels (gated)
- [ ] **D1 Launch C2 reach.** Done when: C1 has run 14 days with no missed posts, and a C2 dry-run week passes.
  > Read CLAUDE.md, channels/c2-reach/. Fill channel.json TBDs with Navin. Run a dry-run week.
  > Nothing publishes without approval.
  > Stop when the C2 approved queue is ready.
- [ ] **D2 Launch C3 studio.** Done when: 20 approved videos exist, and a C3 dry-run week passes.
  > Read CLAUDE.md, channels/c3-studio/. Pick showcase pieces from approved videos. Run a dry-run week.
  > Nothing publishes without approval.
  > Stop when the C3 approved queue is ready.
