# Feed: contract

Why: every video starts from a real topic with a source, never an invented one.

| | |
|---|---|
| Runs | n8n, weekly |
| Input | Reddit RSS (r/smallbusiness, r/IndiaBusiness, r/Excel), Google Trends RSS (India), YouTube search results, IG Question-box replies logged by Forge |
| Output | Append to `ideas/<channel>.jsonl`, one `idea` per line (schemas/idea.schema.json) |
| Tokens | 0 |

## Must
- Every idea has `source_url` and `date`.
- Tag each idea with its channel.

## Never
- Invent or rewrite a topic.
- Write outside `ideas/`.
