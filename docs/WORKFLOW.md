# WORKFLOW: the weekly loop

Why: one batch per channel per week keeps AI cost and human time fixed.

## Weekly sequence
```mermaid
sequenceDiagram
  participant N8N as n8n
  participant REC as Recipe (code)
  participant FG as Forge (Writer)
  participant RE as Render + QA (code)
  participant NV as Navin
  participant DS as Dispatch (code)
  participant LN as Learn (code)
  N8N->>N8N: Feed: pull topics into ideas/<channel>.jsonl
  LN->>REC: scoreboard, bench list, 70/30 split
  REC->>REC: 7 recipes per channel, redraw until novelty rules pass
  REC->>FG: recipes + top 20 ideas + RULEBOOK + scoreboard
  FG->>RE: 7 storyboards (content/<channel>/)
  RE->>RE: render, QA, contact sheet
  alt QA fails
    RE->>FG: exact error
    FG->>RE: fixed storyboard
  end
  RE->>NV: approval page (contact sheets, hooks, captions)
  NV->>DS: approve per video or approve all (ledger = approved)
  DS->>N8N: YouTube upload + schedule
  DS->>FG: Instagram publish queue
  FG->>FG: publish Instagram
  N8N->>LN: metrics
```

## Human gates
| Gate | Who | When |
|---|---|---|
| Weekly approval | Navin | Once a week per channel, about 5 minutes |
| New theme | Navin | Once per theme |
| Commit + push | Navin ("approve commit") | End of each Claude Code session |
| Channel launch | Navin | C2 after C1 runs 14 days with no missed posts; C3 after 20 approved videos |

## Failure paths
| Failure | What happens |
|---|---|
| Novelty rule fails | Recipe redraws |
| QA fails | Exact error goes back to Forge; Forge fixes and resubmits. Max attempts TBD (owner: Navin) |
| Mac asleep / missed render | Watcher retries; renders queue in Drive; missed day catches up |
| Video not approved | Not dispatched. Replacement policy TBD (owner: Navin) |
| Feed returns too few ideas | The Weekly Writer adds ideas itself, each with a real link it opened (no link, no idea) |

## Who does what
| Actor | Does | Never does |
|---|---|---|
| n8n | Feeds, YouTube upload, approval webhook, metrics pull | Writes words |
| Code | Recipe, QA, dispatch, learn | Publishes without approval |
| Forge | Writes words; publishes Instagram from the approved queue | Changes recipe shape, edits engine code |
| Navin | Approves weekly; approves commits; approves themes | Hand-edits storyboards (goal) |
| Claude | Builds engine and primitives; monthly audit | Runs in the weekly loop |
