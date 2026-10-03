# C2 Backstory: RULEBOOK

Why: grow an audience with business and tech history told in under a minute, then monetize it and send it to C1 through the bio.

| Item | Rule |
|---|---|
| Name | Backstory (Facebook page "Backstory.minute") |
| Role | Followers: audience growth, future monetization |
| KPI | Follows + sends per reach |
| CTA | Kind follow or send. Each platform video says it its own way (style preset `platforms`): YouTube "Subscribe" or "Share it", Instagram "Follow" or "Send it", Facebook "Follow the page" or "Share it". No CTA line in the caption |
| Theme | archive (Archive Gold) only. Never C1's lime or flow blue, never night, paper, ink, mono or studio |
| Format | reach (studio/recipe.ts): its own storytelling grammar, no host, no automation flow |
| Content | How an everyday business or tech object came to be (the barcode, the shipping container, the spreadsheet); the person and the problem behind an invention; one surprising sourced fact, told as a story |
| Cadence | every other day from the launch (Sun 4 Oct 2026: 4, 6, 8, 10 Oct ...; 3 or 4 a week, never two days in a row; channel.json `cadence.every_days` 2 and `start`). The first video is the strongest story available, no intro |
| Publisher | Three platform videos per approved video: Instagram @backstory.minute (Forge queue), YouTube @backstory.minute (its own n8n workflow, `agent-studio-youtube-c2-reach`), Facebook page 1320532171147125 (Forge queue, posted to the page by its ID; username pending, retry 2026-10-05: until then the end card names no account) |
| Launch gate | C1 has run 14 days with no missed posts |

## Story grammar (25 to 45 s for now; 40 to 60 s arrives with the phase-2 history shots: archive photo pan, document reveal, timeline)
1. Hook: the object or the moment, max 6 words, a question the viewer cannot answer yet.
2. Setup: the world before it, one concrete problem.
3. Turn: the person, the place, the year, the fix.
4. Explainer: one idea, shown, not listed.
5. Payoff: why it still matters today.
6. Follow card.

## Writing rules
- Every factual claim needs a source: the idea's `source_url` goes in `meta.source`, and a claim the source does not support is cut.
- No fiction presented as fact. No invented quotes, dates, numbers or people. If a detail is disputed, say so or leave it out.
- Feeds (channel.json): Google Trends IN, r/todayilearned, r/history. A Reddit post is a lead, not a source: find the primary or reputable source it points to.
- Honesty rules from C1 apply: no claims about results, no em or en dashes, no real brands as endorsements.
- Bio and descriptions credit the maker: "By @theautomationguynavin" / "Made by @theautomationguynavin".
