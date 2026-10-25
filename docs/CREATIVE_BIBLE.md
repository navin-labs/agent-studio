# Creative bible: what we make, why people stay, how it earns

Status (2026-10-23): draft for Navin's approval. Once approved, this is the contract every Director, Critic and Writer session reads first. When a rule here and a habit disagree, this file wins. Companion: docs/FILM_PIPELINE_PLAN.md (the engine), docs/FX.md (the effect catalogue, from F2).

## 1. The goal: money
- **What earns:**
  - YouTube Partner Program (Shorts views after the subscriber and views threshold);
  - Facebook content monetisation;
  - follows that turn into C1's paid audit funnel (DM AUDIT).
- **What that needs:** views, follows and a few DMs. Shorts pay little per view, so **volume x retention x follows** is the business. One post every other day per channel, each one strong enough to be pushed by the algorithm.
- **The algorithm pushes what people don't swipe away and watch to the end.** We optimise, in this order:
  1. **Viewed vs swiped away:** the first second decides. Target 70%+ (YouTube Studio).
  2. **Average percentage viewed:** target 80% to 100%+ (loops count).
  3. **Sends and shares** (Instagram reach), then **follows**.
  4. Comments: a question or a mild debate in the script.
- **The risk that kills income:** YouTube demonetises "repetitive or inauthentic" automated content. Every video must look made for its story, never a template run again. Uniqueness is a money rule, not a taste rule.

## 2. The competition and what they do that we must do
| Who | Format | Why people stay |
|---|---|---|
| Zack D. Films (~29M) | 3D "what happens if / inside your body" | Frame 0 already dramatic; camera inside things; something changes every second; "you" POV; loops |
| BRIGHT SIDE, The Infographics Show (15M+) | animated stories | A character in trouble; "what if" hook; narrator who tells, not reads |
| Kurzgesagt-type | rich flat illustration | Scale journeys (atom to planet), smooth camera, every frame full |
| Absurd 3D (Skibidi-type, 40M+) | spectacle + characters | No text at all; pure motion and character |
| Casually Explained (~4M) | stick figures | Cheap art, sharp writing and timing |
| **The reference ad Navin chose** (PickUs, 20 s) | kinetic type + chunky pixel/voxel props | Letters fly together; objects with faces; red pen circles; hard light/dark flips; never still |

**Calm, not forced (Navin, 2026-10-23).** The viewer stays because the film is beautiful and clear, not because it shouts. Energy is a *band*, not a maximum: below it feels like a newspaper, above it feels like slop (the first loud hook scored 767 and was rejected). Refinement over noise: soft matte forms, one accent colour, generous negative space, one slow continuous camera, soft dissolves and match cuts, words that rise into place, a quiet music bed, few sounds. No confetti storms, shakes, spinning letters or flash flips as a habit; each is a rare accent at most.

**Measured on the reference with our own QA tool** (`film.mjs analyse`). The band (the calm hook, HookCalm, measured 242 / 72):

| Measure | Reference | Our F1 demo | Band for every film |
|---|---|---|---|
| hook_activity (first 3 s) | 284 | 25 | **150 to 450** |
| activity_per_s | 113 | 27 | **60 to 160** |
| change_by_0_3s | 9.1 | 2.7 | **at least 2.5** (frame 0 must already show the subject) |
| longest_still | 0.3 s | 1.0 s | **0.8 s at most** (an earned pause up to 1.6 s, once per film, marked in the scene) |

## 3. The attention grammar (QA fails a film that breaks these)
1. **Frame 0 is a picture in motion:** the story's object or character, never a title card, never a blank or slow fade.
2. **By 0.3 s something big has moved; by 1 s the viewer has a question; by 3 s they want the answer.**
3. **Something new every 1 to 2 s:** a reveal, a word, a camera arrival, a dissolve to the next idea. The camera never stops gliding, so no frame is dead; ambient wobble doesn't count.
4. **Sound is quiet and earned:** a soft music bed always; a few physical touches on the moments that matter (a catch, a press), never a hit on every cut. Music climbs in steps, with a burst near 37% of the runtime and the hero moment on the strongest beat.
5. **One focal point per moment, big:** the hero object fills at least 35% of the frame width while it acts. Nothing important is smaller than a thumbnail.
6. **Text is never the shot.** Words appear as:
   - captions: 1 to 3 words, centre band, scale-pop on each word, the key word in the accent colour;
   - built type: letters fly together, stamp, type with a cursor, get circled by a pen.
   Title-card shots are banned.
7. **Contrast schedule:** alternate close and wide, fast and slow, light and dark. Never three pushes in a row, never the same move three times (huashu rule).
8. **Enter slow, exit fast, settle and hold:** entrances 0.3 to 0.4 s, exits about 0.18 s, at least 0.5 s on a landed number. Camera moves smoothly; objects step at 12 fps when the look is handmade.
9. **20 to 45 s, and the last frame loops into the first.**
10. **The hook line is a question or a surprising true claim, spoken by 2 s:** "This tiny thing is on your shoes right now", "What happens if you…". Never a greeting, never "In this video".

## 4. The visual language
**We want:**
- **Chunky, physical objects:** extruded pixel/voxel props, clay/toy 3D, cut paper with real shadows. They read on a phone and look made, not generated.
- **Depth:** depth of field, soft contact shadows, parallax layers, the camera moving *through* the world (zoom-through cuts, pullback reveals).
- **Characters with faces:** tiny expressive things (a burr with eyes, a nervous invoice, a "you" hand). Someone the story happens to.
- **Hand marks:** red pen circles, underlines, arrows, doodle boil.
- **Energy tools:** motion blur on fast moves, particle bursts, world flips, glitch splits, typewriter cursors.
- **One look per film**, held to the last frame, chosen for the story. Two or three meaning colours, never more.

**Banned (this is the slop we are removing):**
- beige "newspaper" frames of text;
- title cards as shots;
- SaaS cards and dashboards unless the story is literally about that screen;
- generic stock-looking icons and emoji;
- centred static compositions;
- slow uniform pushes on every shot;
- dead bands of empty frame;
- captions over the hero;
- UI blips as sound;
- the same look two films in a row.

**Also banned:** "in the style of" any living artist or named studio/show. That includes huashu recipes 25 ghibli, 35 shinkai, 37 rick_morty, 52 south_park, 53 pixar, 21 kusama and the Kurzgesagt/Vox/3B1B-named grammars: we use their measured *mechanics* (scale travel, evidence board, derivation), never their name or look.

## 5. The voice
- Now: Kokoro (local). Later: **Sarvam Bulbul v4**: expressive, non-Indian-accent voices (Navin's decision; swap when ready, it plugs into `scripts/tts_local.py`'s place).
- **Delivery rules:**
  - storyteller, not reader;
  - short sentences;
  - a beat of silence before the reveal;
  - emphasis on one word per line;
  - 3.5 to 4 words per second.
- The edit follows the voice: cuts on breaths and sentence ends, reveals on the key word.

## 6. Every skill and source we use, and exactly what for
| Source | What it gives us | How we use it |
|---|---|---|
| **Remotion skills** (12, installed: best-practices, captions, create, docs, interactivity, maps, markup, multimedia, render, saas, studio, upgrade) | Correct, deterministic Remotion code: timing, sequences, captions, audio, maps, fonts, rendering | Every effect follows `remotion-best-practices`; captions from `remotion-captions`; maps from `remotion-maps` (journeys, places) |
| **huashu-motion** (MIT) | Rhythm rules (hook < 3 s, steps, burst at 37%, hero on the strongest beat, earned stop); QA list (single-frame pops, dead time, empty frame 0, covered or cut text, flat energy, loop seam); director habits (3 directions, treatment with 4 key stills, hardest shot first, self-notes); "a sound on every landing"; 20 motion languages (3D object, card montage, character, continuous morph, data story, editorial collage, flat world, generative field, hand-drawn, kinetic type, mechanism, modular grid, photo-led, retro digital, system diagram...) | Rules into DIRECTOR.md and QA (F6); motion languages become our look and effect families |
| **huashu-art-motion** (MIT) | Camera grammar (镜头语言: move only to send the eye somewhere new; slow for transitions, fast only for reveals; give and take; never three pushes); 9 explainer grammars' measured numbers (enter 0.3 to 0.4 s, exit 0.18 s, hold 0.5 s after a number, smooth camera with elements stepping at 12 fps, colour = concept); the 95-point style protocol (anchor on real works, draw the clean shape *then* pass it through a real medium, one frame first, score at least 80, at most two rounds); 36 style recipes painted in code; transitions (card flip, desk pull-out, bloom, paper slide, pull, slap) | Camera and timing rules into DIRECTOR.md; the protocol becomes how every new look is built; public-domain recipes (cave, Egypt, Greek, Gothic, Renaissance, impressionism, post-impressionism, nouveau, cubism, Bauhaus, pop, 8-bit, ink, Klimt, Munch, Dunhuang, constructivism, Hopper, Monet, Seurat, Matisse, Rembrandt, rubber-hose, shadow puppet, Giotto, Persian miniature...) become looks; its transitions get ported as effects |
| **awesome-opus5-5-videos** (MIT, 703 prompts) | What went viral when Opus animated in code: 369 motion, 117 3D, 116 explainer, 101 interactive; techniques canvas 267, svg 183, three.js 131, shader 92, gsap 86, particles, physics | Technique references when building each effect (studied, never copied); the "viral list" for the next effects |
| **p5.brush** (MIT, installed) | Real-media strokes: charcoal, ink, watercolour, hatching | Hand-made looks and the medium pass of the 95-point protocol |
| **Stitch** (Google, via its connector) | Real, story-specific app and web screens (HTML + design system) | Phone mockup, UI word, checklist and chart screens for C1, rebuilt and animated in Remotion |
| **Forge (Muse)** | Writing, fact-checking with sources, Instagram/Facebook posting and insights | Writes hook-first, showable scripts with sources; reports retention per film; weekly trend notes |
| **youtube-automation-agent** (MIT) | Evidence desk (each claim to a source), single-scene repair, lessons from retention curves only with approval | Fact links on the board; re-render one shot; Learn proposes, Navin approves |
| **MoneyPrinterTurbo** (MIT) | Batch job queue, one job at a time | Queue discipline only. Its stock-footage approach is exactly the slop we avoid |
| **Claude Code** (Director, Critic) | Directing, scene writing, effect and prop engineering, frame review | Two-pass Director; a separate Critic session; never grades its own film |

## 7. The quality bar
- **Gate 1, deterministic (QA):**
  - the energy floor (section 2);
  - the attention grammar (section 3);
  - grounding by construction: every script object at its size, at its word, not under a caption;
  - loudness -14 LUFS, true peak -1 dBTP or lower.
- **Gate 2, Critic** (separate session, reads frames and the energy report):
  - a yes/no checklist: frame 0 strange and moving? a question by 1 s? the hero big? one look? a character? a moment worth sending to a friend? loops?
  - each failure is a fix code for one shot. Score at least 80/100, at most two rounds, then the film is held with its frames sent to Navin.
- **Gate 3, Navin:** one Telegram tap. Every approve or reject is logged against the Critic's answers. After about 30 films, the checklist items that don't predict Navin or retention get deleted.

## 8. What changes in the build (FILM_PIPELINE_PLAN.md)
- **F2 becomes "attention effects" first:**
  - letter assembly (built type);
  - voxel/pixel props with depth of field;
  - ribbon conveyor;
  - face bubbles (characters);
  - pen marks;
  - world flip;
  - typewriter + cursor;
  - particle burst;
  - motion blur on every fast move.
  The cinematic effects (vertigo, pullback, parallax world, macro loupe, paper cut, doodle boil) move to F3.
- **The energy floor and attention grammar become QA checks in F2 itself**, not F6, so nothing below the floor is ever shown to Navin again.
- **The first proof is a 5 s Velcro hook at the reference's energy**, measured before it's shown.

## 9. The house format: "Editorial Object" (reference: Navin's Video-93990, 2026-10-25)
Measured: 18.7 s, hook 396, 91 per second, never still. It opens from a soft blur that pulls into focus.
- **World:** off-white paper, monochrome, plus **one deep red** (strike lines, circles, the key word). Nothing else coloured.
- **Real objects, photographed and cut out, that act on the words:**
  - round spectacles land over "content" and magnify it;
  - a magnifying glass passes over bricks and reveals the hidden line "hides the Problem";
  - a classical column stands for "Structure", and crumbles for "Structure Problem";
  - a torn notepad page, pinned, with "Weak" circled in red pen;
  - pens framing the shot.
  The object *is* the metaphor, and it interacts with the type.
- **Type as the hero:** three voices in one frame:
  - a clean grotesk ("Your content is");
  - a heavy condensed display ("INVISIBLE", "OVEREDITING", "MOTION DESIGN"), in grey or deep red;
  - an elegant serif italic ("if your script is", "framework").
  Huge size contrast between them.
- **Editorial texture:** a tiny justified definition paragraph, technical-drawing marks (crop marks, dimension lines, X2/X4 labels, braille-like dots). This makes it feel *designed*, like a magazine page.
- **Motion:**
  - focus pulls (blur to sharp) as transitions;
  - objects arrive with motion blur and settle;
  - glass shards and hashtags fly past out of focus in the foreground (depth);
  - a red laser line strikes through a word;
  - a slight RGB-split (chromatic) edge and grain.
  One idea per frame; calm composition, but always moving.
- **Rule:** every script noun is a real object (photo cut-out, never drawn from shapes), placed in this editorial world. Sources, in order:
  1. a cached prop library;
  2. free stock (Pexels, Pixabay, Openverse/CC0), cut out locally;
  3. Stitch-generated photo when stock lacks it.

## 10. Second house format: "Duotone Story" (reference: Navin's Video-28089, 2026-10-25)
Measured: 51.7 s, hook 101, 34 per second, never still. It's calmer than the band in section 2, so the lower bound of the band is now **hook 90, 30 per second** for story-led films. Here the words carry the motion.
- **One hue for everything:** a soft periwinkle radial background, and every object a black-and-white photo cut-out tinted into the same hue (duotone).
  - This is the trick that makes stock photos from different sources look like one film.
  - Only a rare accent breaks it (fire on "E=mc²").
- **One real object per line, centred, acting the line:**
  - Einstein holding a violin;
  - an alarm clock at 2 AM;
  - a hand putting down chalk;
  - a muscle car for "cars";
  - a runner for "running shoes";
  - a man and a robot on a motorbike for "the engine does the work";
  - a brain on crutches for "happens to the mind";
  - a laptop hanging from light bulbs for "shortcut";
  - a brain on a parachute for "talent goes down";
  - pen nibs for "the future of art".
  Each object has a soft shadow and a thin orbit ring (an ellipse) around it.
- **The transcript is the typography:** words appear as spoken.
  - Key words are huge condensed caps in deep navy ("ALBERT EINSTEIN", "GRAVITY", "FLOW STATE", "WHY?").
  - Connector words are tiny italics tucked beside them ("was losing a war against", "by candlelight").
  - The stack builds line by line.
- **Small touches:**
  - pixel-dissolve when an object appears or changes;
  - cursor arrows for "AI";
  - an orbit ring that turns slowly.
- **Engine parts it needs, beyond section 9:** a `Duotone` grade on every cut-out (CSS filter or canvas, by theme), `Orbit` rings, `KineticTranscript` (word-timed, keyword vs connector sizing), `PixelDissolve`.
- **Both formats share one rule:** every noun is a real cut-out object, from the asset pipeline (scripts/assets.mjs).

## 11. The format library (2026-10-25): four house formats, one rule
Every film picks **one** format. The rule underneath all four: what the script names is shown as itself. A real object is a real cut-out; an abstract idea gets an abstract, code-native visual. Never a code-drawn imitation of a real object. Energy is judged against the format's own reference, not one global number (floor = 0.6 x the reference's hook and per-second figures).

| Format | Reference (measured: hook / per second / longest still) | World | What carries the film | How we build it | Best for |
|---|---|---|---|---|---|
| **A. Editorial Object** | Video-93990: 396 / 91 / 0 s | off-white paper, black and grey, one deep red | real cut-out objects acting on big editorial type; definition text, crop marks | asset pipeline (photo cut-outs) + type system + marks + focus pulls | C1 and C2 explainers |
| **B. Duotone Story** (Rituraj Das, "Creative Inflation") | Video-28089: 101 / 34 / 0.1 s | one hue (periwinkle) radial background, every cut-out tinted into it | one real object per line + the transcript as typography (huge condensed keywords, tiny italic connectors); soft glow on type (Deepglow-like), per-word stagger (TextExploder-like) | asset pipeline + `Duotone` grade + `KineticTranscript` + `Orbit` ring + `PixelDissolve` | philosophy and story pieces; history people (PD archival photos) |
| **C. Network Line** (Aixsponza) | Video-40262: 156 / 65 / 1.3 s | black-to-white split, one blue-violet light | a glowing line grows into branching networks, a tunnel of nodes, a mesh, a planet; tiny clean sans text, one phrase at a time | **code-native three.js** (the subject is abstract, so code is the right tool): line growth, branching splines with sphere nodes, ring tunnel, wire mesh, shaded sphere, slow camera | C1 positioning: systems, automation, "how we evolved" |
| **D. Flat Journey** | Video-45335: 53 / 38 / 0.6 s | cream paper, two inks (coral and navy), grain | a side-scrolling illustrated world: landmarks, vehicles, stations, a timeline scrubber with years, a lone figure under a spotlight | flat two-colour **vector illustrations** from the asset pipeline (Pixabay vectors, Openverse SVG, Stitch flat illustration), recoloured to the two inks + grain; a horizontal world camera; a `Timeline` scrubber | C2 history: journeys, eras, "then vs now" (the India bullet-train story is this exact shape) |

Not a format but a toolkit: the PickUs ad's kinetic tricks (letters that fly together, pen marks, world flips) are effects any format may borrow, sparingly.

## 12. Formats x Looks: many styles, never repetitive (2026-10-25)
Four formats are not four styles. A **format** is the structure and motion grammar (how a film is built). A **look** is the medium (what it is made of: pencil, ink, paper, photo...). Any format can wear any look that suits it, so the feed never repeats.
- **Formats (structure):** A Editorial Object, B Duotone Story, C Network Line, D Flat Journey. More are added as tested (e.g. Evidence Board, Then/Now Split).
- **Looks are data, not code.** Each look is one file with:
  - the medium sentence every asset prompt carries, so all images in a film share one hand;
  - the grade code applies to every asset (duotone, B&W, posterise to inks, paper key, line-only);
  - a texture overlay (paper, grain, halftone, canvas);
  - a type pairing;
  - a motion temperament (stepped 12 fps for hand-made media, smooth for photo and 3D).

| Look | Asset medium (prompt) | Grade + texture | Type pairing | Suits |
|---|---|---|---|---|
| Pencil sketch | graphite pencil sketch on off-white paper, visible hatching | multiply on paper, line boil on 2s | serif italic + grotesk | A, B, D |
| Charcoal | soft charcoal drawing, smudged shadows | B&W + paper tooth | condensed + serif | A, B |
| Ink & wash | brush ink with grey wash | 2-tone ink | serif | A, D |
| Watercolour | loose watercolour on cold-press paper | soft edges, paper | serif italic | B, D |
| Gouache storybook | matte gouache, mid-century | posterise, grain | rounded grotesk | D |
| Risograph | 2-ink riso print, misregistration, halftone | 2-ink + offset + halftone | grotesk bold | A, D |
| Cut paper | layered cut paper, soft shadows | paper key + lift shadow | condensed | D, A |
| Linocut / woodcut | relief print, carved lines | 1-ink + paper | slab or condensed | A, D |
| Copperplate engraving | 19th-century engraving, cross-hatching | 1-ink + spot red | serif | A, B |
| Blueprint / cyanotype | technical drawing, white lines on blue | invert + line | mono + condensed | A, C |
| Archival collage | public-domain photos and paper scraps | B&W + torn edges | serif + typewriter | A |
| Minimal line art | single continuous line drawing | line only, one accent | thin grotesk | A, D |
| Chalkboard | chalk on dark board | invert, chalk texture | handwritten + condensed | B, D |
| Comic halftone | bold ink and halftone dots | posterise + dots | condensed italic | A |
| Clay / toy | clay or toy photo, soft studio light | none (photo) + soft shadow | rounded | B, D |
| Photo editorial B&W | studio photo cut-outs | B&W + contrast (format A) | condensed + serif | A |
| One-hue duotone | photo cut-outs | duotone curve (format B) | condensed + italic | B |
| Two-ink flat | flat vector, two inks | paper key (format D) | condensed + italic | D |
| Light network | none (code) | glow | thin sans | C |

- **Where assets come from:**
  - **outsourced:** Stitch generates them in the look's medium; Pixabay, Pexels and Openverse supply photos (cut out);
  - **otherwise an alternative built from the script:** archive or public-domain material, or the code-native format C for abstract ideas.
- **Rotation (uniqueness gate):**
  - no look repeats within the last 6 posts of a channel;
  - no format runs twice in a row;
  - the look is chosen to fit the story's world (history → engraving, archival, blueprint; automation → line art, risograph, network);
  - a film is a fingerprint of six axes: format, look, suit (chosen by studio/styles.ts) and hook type, structure, CTA (from the script). The hook type may not repeat the previous film's; the structure and CTA may not repeat either of the last 2. No film may share 4 or more axes with any of the last 8 (2026-10-25, from Forge's review of 9 reference reels: repetition comes from the same idea, look and structure together, never from the look alone);
  - a numbered series (`meta.series`) keeps one world (format, look, suit) across its parts, and each part has a new idea; a small, consistent world travels (pixelnoir: 6x and 14x followers in likes).
- **Idea first:** the one-line idea, hook and payoff are fixed in words before any scene is written. If the idea is only interesting with effects, the idea is rewritten.

## 13. Script craft: the words that make people stay (2026-10-25)
Research basis:
- Loewenstein's information-gap theory: curiosity comes from a noticed, right-sized gap in what you know. Triggers: a question or puzzle, a sequence with an unknown end, a violated expectation, someone else holding the answer.
- Short-form practice: hook, context, payoff, loop; 80 to 150 spoken words for 30 to 60 s; a visual reset at every new beat.
- The but/therefore rule: every line turns the story, never "and then".

**Structure (every script):**
1. **Hook (0 to 2 s, at most 12 words):** a violated expectation, a puzzle, or an illusion of novelty. "You've touched this every day and never noticed it." Never a greeting or a topic label.
2. **Context (one line):** just enough to make the gap matter.
3. **Turns (2 to 4 beats), each a "but" or "therefore":** every 3 to 5 s, a **new reveal** the viewer didn't have.
4. **Contrast framing (at least once):** then vs now, tiny vs huge, expected vs actual, manual vs automatic.
5. **Bullseye proof (at least once):** one hard, specific fact shown on screen with its source (a date, a patent number, a measured number). Specificity is credibility.
6. **Stakes or urgency (at least once):** why this matters to *you*, now.
7. **Payoff at about 70%:** the gap opened in the hook closes.
8. **Loop line:** the last line hands back to the first, so a replay feels natural.

**Devices the Writer chooses from (name them on the board, so the Director stages them):** illusion of novelty, open loop, new reveal, contrast frame, bullseye proof, stakes, urgency, specific number, second person ("you"), pattern-interrupt line, callback, loop.

**Script checks:**
- **Code (QA):**
  - the hook is 12 words or fewer, opens no greeting, and has a question, a contradiction or a number;
  - at least two turn words (but, instead, actually, so, until);
  - at least one specific number or date with a source;
  - 80 to 150 words for 30 to 60 s;
  - the last line shares a key word with the first.
- **Critic (a separate Claude pass):** checks each declared device, and rejects flat lines ("and then") and claims without proof.


**Voice direction (2026-10-25).** Every spoken line carries `voice: {feel, pace, hold}` (the Writer's). The feelings make an arc: open on tension or curiosity, tighten through the problem, land the proof slowly, release on the turn (surprise, then warmth or triumph), hand back on the loop. At least three different feels; at most two held silences, kept for the reveal. Now: `pace` changes the voice speed per line and `hold` adds the silence (engine/scripts/make.mjs, src/composer/storyboard.ts); the Director stages each line's feel in the picture. Next: the expressive voice (Sarvam Bulbul v4) reads `feel` directly. Gate: studio/script.ts.

**What winners do (Forge's Instagram study, 2026-10-25; docs/research/2026-10-25-forge-faceless-reels.md).** Open on one concrete scene (10 of the top 15 against 1 of the low 5), named in `meta.hook_image`. Tell a story with a failed attempt before the mechanism. End on a payoff picture (14 of 15 against 3 of 5), named in `meta.payoff_image`. Prove animated history with real archival photos at the end. Never a countdown or list (0 of 15 against 2 of 5). Captions open on a claim or question, never a channel trailer. A comment-keyword CTA with a real free thing drives comments above likes. Reuse one grammar per series and change the story and hook image each time: the hook sets the ceiling.
## 14. More references (2026-10-25): three new formats, new looks, new effects
Analysed frame by frame at 2 fps. Video-45547 duplicates 90405, and 77717 duplicates 28089.

| Ref | Measured (hook / per s / still) | What it is | New format | Look + colour suit | New effects |
|---|---|---|---|---|---|
| Video-84390 (14.8 s) | 247 / 59 / 0.5 s | A dreamy 3D world (a glowing figure flying through clouds, cities, space), letterboxed inside 9:16; real photo and video clips float beside it as inset windows (lightning, jellyfish, birds, galaxy, black hole, Neptune, the sun, candles, a comet) | **E. Memory Windows**: one dreamy world + floating real-footage windows that illustrate each line | glowing game-like 3D or painted dream; suits: deep night blue and warm gold, swinging between them | light trails, bloom, white-flash cut, picture-in-picture windows that slide and settle, sparkle particles, cinematic letterbox bars |
| Video-90405 (26.9 s) | 171 / 113 / 0 s | Real footage through a moving train window (sea, trees, stations, motion blur) in a rounded old-film frame; a hand-drawn doodle character (round face, hands, changing expressions) sings the words, which appear handwritten word by word | **F. Doodle on Footage**: real moving footage + one doodle character + handwritten words | lo-fi film (grain, scratches, rounded vignette frame, faded teal and warm); doodle in black ink | doodle line boil (stepped redraw), expression swaps on the beat, hand gestures, handwritten word reveal, film frame + grain + scratches, footage motion blur |
| Video-65602 (11.7 s) | 46 / 24 / 0.8 s | Letterboxed painted night city scenes (a basketball court behind a fence, a brick alley with a lamp, an underpass, an outdoor stair); lamps switch on and off, fog drifts | **G. Ambient Scenes**: one atmospheric scene per line, nearly still; light and weather carry the motion | painted night city; suit: navy dark + sodium amber + cold fluorescent | lamp flicker / light cone switching on, fog drift, light pooling, slow parallax |
| Video-40696 (13.2 s) | 64 / 16 / 1.7 s | The same idea in lo-fi pixel art (a laundromat, a balcony, a corridor, a riverside at night, a stairwell lamp, a vending machine in the rain, a rooftop water tower) | G (pixel variant) | pixel art night; suit: indigo night + warm window light + neon glow | rain, glowing lamp pulse, window lights blinking, water reflections shimmering |

What these add to the rules:
- **Code may draw when the look itself is drawn simply.** A doodle character (F) and line art are the look, so code-drawn strokes are right there. Code still never imitates a *real* object in a realistic look.
- **Real moving footage is now an asset type.** Pexels and Pixabay videos (train windows, sea, city, rain) feed F and E as plates, and are cut into windows for E.
- **Painted and pixel scenes come from Stitch** in the look's medium, then are lit by code (lamps, fog, rain, reflections) so a still scene lives.
- **New colour suits:** teal-and-orange film, night navy + sodium amber, deep blue + glowing gold, indigo pixel night.

The library now has **7 formats** (A to G). Every format can take several looks and colour suits, and the rotation gate (section 12) spreads them so no two posts in a row feel alike.
