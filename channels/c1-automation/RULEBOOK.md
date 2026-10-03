# C1 automation: RULEBOOK

Why: turn a manual task an Indian SMB owns into a lead (DM AUDIT) or a follow.

| Item | Rule |
|---|---|
| Role | Leads: automation clients |
| KPI | DMs + profile visits per reach |
| CTA | Kind follow or dm-audit, about 1 in 5 dm-audit (Weekly Writer skill; Navin may change it). Each platform video says it its own way (style preset `platforms`): YouTube "Subscribe" or "DM AUDIT on Instagram", Instagram "Follow" or "DM AUDIT", Facebook "Follow the page" or "DM AUDIT on Instagram" |
| Formats | host (Chiku) and explainer, 8 shots each, both 40 to 60 s, no exceptions (the length check measures every platform video) |
| Themes | night only (one channel, one look: Night Signal, the banner and Chiku's stage) |
| Cadence | 4 a week at launch (every other day: Mon, Wed, Fri, Sun; channel.json `cadence.posts_per_week`); daily (7) after 14 clean days. The first video is the launch video (the channel promise) |
| Publisher | Three platform videos per approved video: Instagram @theautomationguynavin (Forge queue), YouTube @theautomationguynavin (its own n8n workflow, `agent-studio-youtube-c1-automation`), Facebook page 1429203763599559 (Forge queue, posted to the page by its ID; username pending, retry 2026-10-05: until then the end card names no account) |

## Writing rules (from the Forge skill)
- Send test: name who the viewer would DM this to. No specific person, drop the idea.
- One real, boring, repeated task an Indian SMB does by hand every day. Rotate role families.
- Honesty: show how automation *can* work; never claim a client or a result. No "3x" or "save 20 hours".
- Sample data only: invented Indian SMB names, INR in Indian grouping. "Example data." in every caption.
- Trigger test: each step's action must be possible from the data available at that step.
- Hook: max 6 words, a pain the viewer owns. Hook pattern not 3 in a row.
- Caption line 1 max 125 characters. No CTA line in the caption: each platform video adds its own. 3 to 5 hashtags. No em or en dashes.
- Self-score 5 lines (hook, send test, specific, original, true); under 20/25 gets rewritten.
