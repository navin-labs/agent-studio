# Deep research brief v2: best possible films, heavy work off my Mac, using my Google AI Pro plan

You are a senior research lead with experience in film pre-production, motion design studios, generative media, Google's AI products and agentic software. Research thoroughly with current sources (2025 and 2026) and give me a decision-ready report. You cannot see my code; everything you need is below. Where my assumptions are wrong, say so.

## 1. What I want
An automated short-video studio (vertical 1080x1920, 25 to 60 s; YouTube Shorts, Instagram Reels, Facebook Reels) where every video is directed like an award-winning short film:
- **Script-faithful visuals.** Whatever the script names, the viewer sees, big enough to read on a phone, at the moment it is spoken. "A burr caught on the dog's fur" means a real-looking burr on the dog's fur.
- **A different film every time**: its own world, medium, palette, typography, camera, animation and music.
- **Studio-level craft**: a strong first frame and 3 s hook, one focal point per moment, motivated camera and transitions, real objects, deliberate sound.
- **Best results first.** Quality is the priority. I do not want to settle for a weaker model just because it runs locally.
- **Light load on my Mac.** Heavy generation (images, video, upscaling, big vision models) should run on Google's side or another free cloud GPU, not on my laptop. The Mac should mostly orchestrate, composite and render.
- **No new spend.** I want to use what I already have (below) and free tiers. If something truly needs money, say what it is, why, and the cost.
- **Still safe**: I approve each finished video with one Telegram tap; nothing is published without it.

## 2. What I already have
- **Google AI Pro**, free through Jio (India). I believe it includes the Gemini app (Gemini 3 Pro / 2.5 Pro), Nano Banana Pro image generation, **Flow** and **Veo** video generation with monthly AI credits, Whisk, NotebookLM, Jules / Gemini Code Assist / Gemini CLI, and 2 TB Google storage. I am not sure about GPU access. **Verify exactly what my plan includes**, with quotas.
- **Claude Code** subscription (my coding and agent runtime; headless sessions direct the films today).
- **Meta Muse / "Forge"** agent (writes scripts, posts to Instagram/Facebook).
- **Mac**: Apple M5, **24 GB unified memory**, 728 GB free disk.

## 3. The system today
- **Stack:** Remotion 4.0.527 (React 19, TypeScript) renders locally. p5.brush, Rough.js, @remotion/paths, @remotion/noise, @remotion/motion-blur. Voice: Kokoro TTS (local). Music: ACE-Step 1.5 (local, MIT). Foley: Kenney CC0. Orchestration: Node/TypeScript, n8n (YouTube upload), Telegram approvals, append-only JSONL ledgers, SHA-256 bound approvals, 12 deterministic QA checks (length, text fit, captions in safe area, loudness, frame-0 contrast, no still stretch over 2.5 s).
- **Pipeline:** Feed (RSS) -> Recipe -> Writer (AI writes storyboard JSON: voice line, headline, caption per scene) -> render 3 platform variants -> QA -> Telegram approval -> dispatch.
- **Template path (live):** 21 reusable motion primitives drawn partly at random. Competent but generic: the Velcro story was told with SaaS UI cards and the burr never appeared.
- **Authored-film path (experimental):** a Claude "Director" writes a creative brief and 800 to 1,340 lines of bespoke Remotion SVG/canvas code per film; a "Critic" scores rendered frames (15 scores + 8 anti-slop tests). Failures: code-drawn objects look wrong (a 1940s microscope "reads as a robot face"), story objects a few pixels wide, 20 to 40% empty frame bands, captions over the key object, every film fails first review, some fail after three rounds, one session crashed with no film.

## 4. The plan I have so far (critique it, improve it)
Two earlier research reports agreed: code must stop drawing story objects.
1. Lock voice timing (word level).
2. **Breakdown** (LLM + code gate): every object, person, animal, place, era, number and action per clause with its time window; every explicit one must be the focal or supporting subject of the shot that speaks it.
3. **Director + art director**: a machine-readable style bible (a real physical medium such as cut paper, copperplate engraving, risograph, cyanotype blueprint, archival collage, gouache, clay diorama, macro specimen plate; 5 to 6 hex palette; light direction; texture plate; fonts; motion family; music caption) plus a shot list (focal entity, framing, minimum on-screen size, camera move, transition, sound events). A uniqueness gate keeps each film far from recent ones.
4. **Asset foundry**: public-domain archive first (patents, Smithsonian CC0, Library of Congress), otherwise generate each object on a flat ground from an approved style frame, cut out, palette-lock, depth map, vectorise if flat.
5. **Scene compiler**: the Director emits about 150 lines of scene config into tested Remotion rigs (world camera, parallax layers, cut-out puppet, macro loupe, diegetic type, caption layout solver, texture overlay, motivated transitions). 540p animatic first.
6. **Sound**: ACE-Step score, foley spotted from animation events, ducking, -14 LUFS master.
7. **Gates**: existing QA, then an object-grounding gate (Florence-2 on frames: present, large enough, not under captions, no dead bands), then a taste critic from a different model family, with fix codes per shot.

The local-only version used FLUX.2 [klein] 4B, BiRefNet, Depth Anything V2 Small, VTracer, Florence-2, Qwen2.5-VL-7B on the Mac: about 45 to 70 minutes and heavy load per film, with weaker world knowledge than Nano Banana Pro for era-specific objects. **I now want to move the heavy, quality-critical steps onto my Google plan and free cloud compute.**

## 5. Hard constraints
- **Commercial use** on monetised channels. For every tool, state separately: the model/weights licence, and the output terms **under the specific plan I would use it on** (consumer Google AI Pro vs Gemini API free tier vs paid API). Flag visible watermarks (e.g. on Veo/Flow output), SynthID, and AI-content disclosure rules on YouTube and Meta.
- **Automation must be allowed.** If a tool only exists in a consumer web app (Flow, Gemini app, Whisk), say whether driving it with a script or browser automation breaks Google's terms. If it does, tell me the legitimate route (API, Vertex AI, Colab, Apps Script, AI Studio) or a semi-manual step (I generate in Flow and drop the files into a watched folder) and how much of the quality it keeps.
- No voice cloning, no real-person likeness, no copyrighted characters, no "in the style of" a living artist.
- Keep Remotion as the compositor unless strong evidence says otherwise (deterministic, code-reviewable, wired into QA).
- Throughput: 1 to 2 videos per day per channel, 2 to 3 channels; unattended except my one approval tap (and any semi-manual step you justify).

## 6. Research questions
**A. What my Google AI Pro (via Jio) actually gives me.** Exact features, models, monthly credits and quotas (Nano Banana Pro images per day, Veo 3.x / Flow credits and clip length, resolution, 9:16, audio, Gemini 3 Pro usage, Deep Research, NotebookLM, Jules, Gemini CLI, Code Assist). Is there any GPU or Colab compute included? What changes between Pro and Ultra that matters here? How long does the Jio offer last and what happens after?

**B. Programmatic access for free.** Gemini API / AI Studio free tier: which image (Nano Banana / Nano Banana Pro / Gemini 3.x image), video (Veo) and vision models are available, rate limits, whether outputs may be used commercially, whether free-tier data is used for training, and any region rules for India. Does the AI Pro subscription raise API limits? Google Cloud free trial credits (amount, duration, what they can run, e.g. Veo or Imagen on Vertex). Google Colab free tier (GPU type, session limits, whether it can host BiRefNet, Depth Anything, Florence-2/SAM, Qwen-VL, FLUX klein, Wan 2.2 or TRELLIS jobs as a remote worker) and whether Colab Pro is included in my plan. Kaggle notebooks (free GPU hours/week) as an alternative. Gemini CLI / Jules quotas for agent work.

**C. Best route per step, quality first, Mac load low.** For each pipeline step (breakdown, style bible, style frames, hero objects, characters, backgrounds, archive treatment, cut-out, depth/layers, vectorisation, video inserts, 3D props, music, foley, grounding QA, taste critique), recommend the highest-quality free route among: my Google plan, Gemini API free tier, Colab/Kaggle GPU, local Mac, Claude Code. Give a table: route, quality, consistency, automation-safe (yes/no/semi-manual), daily capacity vs my throughput, Mac load, licence and output terms.

**D. Consistency and style lock with Google tools.** How to hold one film's look across 10 to 15 assets with Nano Banana Pro (multi-image references, editing from an approved style frame, character/object sheets), and across Veo clips (reference images / ingredients, first-and-last frame). How to get objects on a flat ground ready for cut-out, and correct era details (use Gemini's world knowledge + archive references). Prompt structures that avoid the generic "AI look".

**E. Veo / Flow in a composited film.** Best use of my video credits: which shots deserve a Veo insert (macro physical action, nature, transitions), how many per film my quota allows, image-to-video from approved frames, 9:16 handling, removing or living with any watermark, matching it to the film's medium (grading, texture overlay), and the evidence on whether full-Veo films beat composited films for retention and craft.

**F. Grounding and critique.** Best free way to check automatically that each script-named object is visible, recognisable, large enough, at its timestamp, and not under captions: Gemini vision models (bounding boxes / segmentation output) vs Florence-2 / Grounding DINO / SAM 2.1 on Colab or local. Judge bias (a model grading its own family's output) and how to calibrate. Use Gemini as the cross-family critic to the Claude Director?

**G. Sound.** Is Lyria / any Google music or SFX generation in my plan or free tier, and are outputs licensed for monetised use? Compare with ACE-Step 1.5 (local). Foley generation options that are free and commercially clean (note: MMAudio checkpoints are CC-BY-NC; Hunyuan models exclude EU/UK/KR).

**H. Architecture.** Revise my 7-stage plan for this hybrid: which stages run where, the job queue between the Mac and Google/Colab (e.g. a Drive folder or API calls), caching of assets across films, failure handling when a quota is exhausted (fallback order), and an honest estimate of wall time, Mac load and quota use per film.

**I. "Award-winning" as checkable rules** for a 30 to 60 s vertical explainer or history story, including the first 3 seconds and the ending loop.

## 7. Deliverable
1. **Executive summary** (10 bullets): what to build, in order, and what my Google plan changes versus a local-only build.
2. **My plan, verified**: a table of every Google AI Pro / free-tier feature that matters, with quota, automation status and commercial output terms, each with a source.
3. **Recommended architecture** (mermaid) and a stage-by-stage tool table with the reason each choice wins, plus the fallback when a quota runs out.
4. **Schemas**: style bible, shot list, asset manifest, filled in for one story: how Velcro was invented from burrs on a dog in the Alps (walk in 1941; check the patent dates against the patent record).
5. **A 2-week proof of concept** on that story: compare (a) local-only, (b) Google-plan hybrid, (c) my existing authored film; pass/fail criteria on script-object visibility, phone legibility, caption collisions, dead bands, wall time, Mac load, and blind viewer preference.
6. **Phased roadmap**, risks (quota changes, offer ending, terms changing, model churn) and what to measure.
7. **What not to do**, with evidence (including any terms-of-service traps).
8. **Sources**: every claim linked with its date; mark anything older than 2025 or unverified. Do not quote benchmark numbers you could not open.

Be concrete: product and model names and versions, quotas, limits, licences. Evidence over opinion; label opinion.
