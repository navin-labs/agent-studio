# TECH: agent-studio

Why: code picks the shape, an AI writes the words, a human approves once a week.

## Architecture
```mermaid
flowchart TB
  subgraph n8n
    FEED[Feed: Reddit RSS, Google Trends RSS India, YouTube search, IG Question-box replies]
    YT[YouTube upload + schedule]
    HOOK[Approve webhook]
  end
  subgraph agent-studio
    RECIPE[Recipe generator + novelty rules]
    QA[QA runner + contact sheet]
    PAGE[Weekly approval page]
    DISP[Dispatcher]
    LEARN[Learn: scoreboard, bench, 70/30]
  end
  subgraph reel-engine
    COMP[Composer: storyboard to composition]
    PRIM[Primitive registry + themes.ts]
  end
  FORGE[Forge Weekly Writer]
  FEED --> IDEAS[(ideas/channel.jsonl)] --> FORGE
  RECIPE --> REC[(recipes/channel/week.json)] --> FORGE
  LEARN --> SB[(scoreboard.md)] --> FORGE
  FORGE --> SBJ[(content/channel/*.json storyboards)] --> COMP
  PRIM --> COMP --> MP4[(mp4 + text boxes)] --> QA
  QA -- fail + exact error --> FORGE
  QA -- pass --> PAGE --> NAVIN{Navin}
  NAVIN --> HOOK --> LEDGER[(ledger)]
  LEDGER --> DISP
  DISP --> YT
  DISP --> FQ[Forge publish queue: Instagram]
  METRICS[(metrics)] --> LEARN --> RECIPE
```

## Repos
| Repo | Owns |
|---|---|
| `reel-engine` | Motion library (primitives), `themes.ts`, Composer, renderer, gate, watcher |
| `agent-studio` | Schemas, recipes, novelty, QA, approval page, dispatch, learn, channel config, docs |

## Stack
| Layer | Choice |
|---|---|
| Rendering | Remotion 4, React 19, TypeScript (existing reel-engine) |
| agent-studio language | TBD (owner: Navin) |
| Media checks | ffprobe |
| Automation | n8n (feeds, YouTube upload, approval webhook) |
| Writer | Forge (Muse tokens) |
| Storage | Files in repo `state/` and Google Drive; no database |
| Host | Navin's Mac (watcher via launchd) |

## Data contracts (`schemas/`)
| Schema | Written by | Read by |
|---|---|---|
| idea | Feed (n8n) | Writer |
| recipe | Recipe | Writer, QA |
| storyboard | Writer | Composer, QA |
| qa | QA | Approval page, Writer (on fail) |
| ledger | Approval webhook, Dispatch | Dispatch, Learn |
| metrics | TBD (owner: Navin) | Learn |
| fingerprint | Recipe | Recipe (novelty), QA |
| channel | Navin | All steps |

## Themes and role tokens
Role tokens (every theme defines all): `bg, surface, ink, muted, rule, accent, flow, ok, alert, shadow`.

| Theme | bg | surface | ink | accent | Default for |
|---|---|---|---|---|---|
| paper | #F4F1EA | #FFFFFF | #111111 | #C6F432 | C1 |
| ink | #0E0E0E | #1A1A1A | #F4F1EA | #C6F432 | C2, C3 |
| mono | #E4E3DF | #F4F4F2 | #161616 | #C6F432 | C2, C3 |
| studio | #FFFFFF | #F6F6F6 | #0B0B0B | #2B4BFF | C1 alternate, C3 |

Rules (enforced by the gate): WCAG AA contrast (ink on bg, ink on surface, ink on accent); max 3 colours per frame; no hex outside `themes.ts` (grep check); new themes need Navin's OK once. Brand fixed everywhere: Inter Tight + JetBrains Mono, signal-lime highlighter, 3px strokes, hard offset shadows, ink-wipe end card, authorship line.

## Novelty rules (Recipe redraws until all pass)
| Check | Rule |
|---|---|
| Topic | Text similarity to last 60 posts (all channels) < 0.75 (trigram / TF-IDF) |
| Structure | Jaccard distance of primitive set + ordered pairs >= 0.6 vs each of the channel's last 10 |
| Opening | Differs from yesterday's; same opening at most 2 times in 7 days |
| Hero metaphor | Not repeated within 14 days on the channel |
| Theme | Not 3 days in a row on the channel |
| Hook pattern | Not 3 in a row; caption opener doesn't repeat the previous 2 posts |
| Cross-channel | Same recipe fingerprint never on two channels in the same week |

## QA checks (deterministic)
Schema and text limits, audio stream present, 1080x1920 @ 30fps, duration 20 to 45s, safe zones from text boxes measured at compose time, fingerprint distance, file naming. Output: qa JSON + contact sheet PNG.

## Security
| Rule | Enforced by |
|---|---|
| Never read or print `.env` | `.claude/settings.json` deny rules; CLAUDE.md |
| No publish without ledger status "approved" | Dispatcher refuses otherwise |
| Claude never publishes; never force-pushes | CLAUDE.md; force push denied |
| Forge writes only JSON into content folders; never edits engine code | Forge skill standing rules |
| Ideas only from feeds with a source link | Writer rules; `meta.source` required by storyboard schema |
