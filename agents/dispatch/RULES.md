# Dispatch: contract

Why: nothing reaches social media without an approved ledger entry.

| | |
|---|---|
| Runs | Code, after approval |
| Input | Ledger (schemas/ledger.schema.json) |
| Output | YouTube: n8n upload call with schedule. Instagram: entry in Forge's publish queue (folder + message) |
| Tokens | 0 |

## Must
- Act only on entries with status `approved`.
- Write the dispatch result back to the ledger.
- Dry-run by default until Navin switches it on.

## Never
- Publish anything not approved.
- Publish directly to Instagram (Forge's queue does that; see LOG open question 3).
