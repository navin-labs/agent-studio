# PRD: agent-studio

Why: publish original, sourced, on-brand motion videos on 3 channels every day, for near-zero token cost and 5 minutes of human time a week.

## Problem
| Pain | Today |
|---|---|
| Daily production is manual | Forge writes one story per day; Navin reviews and posts each one by hand |
| One look for everything | Only the Paper & Signal look and one story template (`pile-to-flow`) exist |
| Uniqueness depends on AI creativity | Nothing measures whether a new video repeats an old one |
| Token burn | v1 idea of 7 AI agents would not fit the $20 Claude plan |

## Users
| User | Needs |
|---|---|
| C1 automation audience | Indian SMB owners, ops managers: see a manual task they own, and how it can run itself |
| C2 reach audience | Anyone who likes satisfying, smart short videos |
| C3 studio audience | Founders, marketers, designers, agencies who want explainer or motion videos |
| Navin (operator) | One weekly approval page per channel; no daily work; a portfolio piece that shows engineering ability |

## Goals
1. One AI step (writing, on Forge Muse tokens). Everything else is code or n8n.
2. Uniqueness enforced by code (7 novelty rules, see TECH.md).
3. Human approval once a week, about 5 minutes.
4. Claude used only for building: about 3 Claude Code sessions a month after the build.

## KPIs per channel
| Channel | KPI that decides everything | Target |
|---|---|---|
| C1 automation | DMs + profile visits per reach | TBD (owner: Navin) |
| C2 reach | Follows per reach, sends per reach | TBD (owner: Navin) |
| C3 studio | Inbound enquiries | TBD (owner: Navin) |
| System | Posts shipped vs planned; hand edits per week (goal: 0 except approval) | TBD (owner: Navin) |

## Scope
| In | Out (non-goals) |
|---|---|
| Recipe generator + novelty rules | AI writing animation code per video |
| About 20 primitives at launch, 4 themes | Vision-model QA |
| QA runner + contact sheets | A database (files only) |
| Weekly approval page | Auto-publishing without an approved ledger entry |
| Dispatch: YouTube via n8n, Instagram via Forge queue | Commenting, liking or following from any account |
| Learn: scoreboards, bench list, 70/30 split | Daily or weekly Claude runs |

## Risks
| Risk | Mitigation (from plan) |
|---|---|
| Mac is the single render server | pmset no-sleep on charger; watcher retries; renders queue in Drive so a missed day catches up |
| YouTube mass-produced policy | Sourced ideas, enforced structural variety, synthetic flag, human approval, real process detail |
| False claims hurt trust | Forge honesty rules and banned phrases, enforced by the gate |
| Approval fatigue | One weekly batch page per channel, approve-all button |
| Channels compete for attention | Distinct roles, KPIs and CTAs; channels cross-link |
| Plans disagree on voice, publishing, CTA ratio | Listed as open questions in LOG.md; resolve before Phase A |
