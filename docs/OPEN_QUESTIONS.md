# Open Questions, Risks & Decision Log

## 1. Decision log

| ID | Decision | Status | Rationale | Reversible? |
|---|---|---|---|---|
| D1 | The persona is a **Delegate** (accountable representative), not a digital twin | **Accepted** | Avoids fabricated beliefs and impersonation. Differentiates from clone products. | Hard to reverse later, so decide now |
| D2 | The product output is the **Understanding Map**, not the debate transcript | **Accepted** | Human value plus shareable artifact. Avoids Moltbook-style spectacle. | Yes |
| D3 | Success metric is **mutual understanding**, not agreement | **Accepted** | Avoids rewarding the dominant party and manufactured consent | Yes |
| D4 | The **Mutual Restatement Gate** is mandatory before resolution | **Accepted** | Signature mechanic, de-escalation hypothesis | Yes (could become optional per template) |
| D5 | Launch wedge = **small-group decisions/disagreements**. Spar for single players. | **Accepted** | Structural invites. Couples is too risky and crowded to lead. | Yes |
| D6 | Couple template deferred until expert safety review | **Accepted** | Abuse and coercion risk | — |
| D7 | No autonomous public AI posting (MVP/v1) | **Accepted** | Slop and spam prevention | Yes |
| D8 | Finance is an **Agreements** module, v1 | **Accepted** | Keeps identity focused. Retention driver later. | Yes |
| D9 | Stack: Next.js 16 + FastAPI + Postgres/pgvector + Redis. **No LangGraph in the MVP.** SSE before WebSockets. | **Accepted** | Contract seam enables parallel work. Deterministic protocols are auditable. | Yes |
| D10 | Model router with a different-family critic | **Accepted** | Reduces correlated errors | Yes |
| D11 | 18+ only at launch | **Accepted** | Character.AI precedent | Yes |
| D12 | One Delegate per verified human | **Accepted** | Anti-sock-puppet | Yes (hats later) |
| D13 | No ads, no training on private content by default | **Accepted** | Trust is the moat | Shouldn't be reversed |
| D14 | Naming: **Delegate** (owner's representative), **Mediator** (neutral engine), `.d` handle suffix | **Accepted** | Literal naming supports the always-visibly-AI principle. "Advocate" reads adversarial, "Second" reads duel. | Copy-wide, so decide once |
| D15 | Hosting: Docker Compose locally during the 72h build, then free tiers (Vercel web, Render or Fly api+worker, Neon Postgres+pgvector, Upstash Redis). Single-VM Compose as fallback. No paid infrastructure before real usage. | **Accepted** | Cost discipline. Keeps T6 unblocked. | Yes |
| D16 | Model routing: `extract` = `claude-haiku-5-5`; `analyze` = `claude-sonnet-5-5` (upgrade `render_map` to `claude-opus-5-5` only if evals show a real gain); `critic` = a non-Anthropic model (Gemini or OpenAI, configured by env); `moderate` = provider moderation endpoint plus rules | **Accepted** | Cost/quality balance. Different-family critic reduces correlated errors. Prices not yet checked; measure $ per Map in the first eval run. | Yes |
| D17 | Publishing: anonymized ("Participant A/B") by default. Real handles only if **every** participant opts in. Any revocation unpublishes. | **Accepted** | Encourages honest sharing. Avoids exposing friends. | Yes |
| D18 | P1 recruitment: 4–5 of the founder's friend groups/households with a live decision (~12 Chambers) plus 1–2 debate or writing societies for Spar (~8 sessions). No couples. No stranger recruitment from Reddit. 15-minute interview after each. Stage drop-off instrumented. | **Accepted** | Fast, honest feedback. Avoids the Zurich failure mode. | Yes |
| D19 | **Guest participants**: an invitee may join and submit a position without creating a Delegate; Delegate creation is offered afterwards | **Accepted** | Reduces join friction (A3). Join rate beats Delegate setup. | Yes |
| D20 | Autonomy at launch: L0/L1 only (draft-and-approve). L2/L3 deferred. | **Accepted** | Safety and representation fidelity | Yes |
| D21 | Chamber retention: 90 days after close, owner-extendable | **Accepted** | Data minimization | Yes |
| D22 | Groups of >2: each party's view is restated to the group once (not per pair) | **Accepted** | Avoids quadratic restatement load | Yes |
| D23 | Delegate pre-round (C1) only if the core loop is solid by H48 | **Accepted** | Protects the critical path | Yes |
| D24 | Expenses deferred to v1. MVP Agreements are text items with per-person approval. | **Accepted** | Focus | Yes |

## 2. Critical product decisions needing the founder

All six were resolved on 2026-10-31 (founder accepted every recommendation):

1. ~~Launch wedge~~ → **D5:** small-group decisions and disagreements first. Couples later, after a safety review.
2. ~~Name and handle grammar~~ → **D14:** Delegate / Mediator / `.d`.
3. ~~Deployment accounts~~ → **D15:** local Compose, then free tiers, with a single-VM fallback. *Still needed from the founder before T6 deploys: which of these accounts exist, plus the LLM API keys (Anthropic plus one of Google/OpenAI).*
4. ~~Model providers~~ → **D16.**
5. ~~Publishing default~~ → **D17:** anonymized.
6. ~~First 20 Chambers~~ → **D18.**

## 3. Unresolved assumptions

- A1: Users will tolerate a *slower, staged* protocol instead of chat speed. (Test: drop-off per stage.)
- A2: Endorsing 6–10 position cards is enough to make a useful Delegate.
- A3: Invitees will create a Delegate at join time instead of bouncing. (Mitigation adopted as D19: guest participants.)
- A4: LLM cost per Map is low enough for a generous free tier.
- A5: People want to *publish* Maps of their disagreements, even anonymized.
- A6: Credit consumption is roughly predictable from session scope (see the execution plan).

## 4. Research gaps

- Patent search (none performed). Required before any novelty claim in fundraising.
- Primary user research: 10–15 interviews across the persona types before P2.
- Kialo's current product, and whether any argument-mapping product offers AI representation.
- Retention and revenue data for AI mediation apps (Auralink et al.): unknown.
- Evidence on AI mediation outcomes in *intimate* relationships specifically. The Habermas Machine covers policy deliberation among strangers, which doesn't transfer automatically.
- Whether restatement gating measurably improves understanding (MUG) in AI-mediated settings. Run an A/B test in P1.
- Legal: does "binding within Argumenté" create any contract-law implications? Data-protection classification of relationship content.

## 5. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Users see it as "a slower group chat" | Med | High | Make the Map the payoff. Measure time-to-first-Map. Templates. |
| Engine misrepresents someone → trust collapse | Med | High | Endorsement invariant, fabrication guard, labels, evals |
| Safety incident in a relationship Chamber | Low–Med | Severe | Defer couples. Screening. Classifiers. Quiet pause. Expert review. |
| Platform giants ship group mediation | Med | High | Neutral-trust positioning, relationship data, speed |
| Cold start of the public layer | High | Med | Public layer is secondary. Growth comes from private Chambers. |
| LLM cost overrun | Med | Med | Routing, caching, per-Chamber budget caps |
| 72-hour build slips | High | Med | Strict Must list, stubs-first parallelism, 15% credit reserve, critical path focus |
| Engagement pressure pushes toward hostility | Med | High | No win metrics. Product principles in VISION §5 as a review checklist. |

## 6. Questions for the next research cycle

- Can **MUG** (mutual understanding gain) be measured cheaply enough to be a live product metric?
- Should Delegates have *different reasoning methodologies* only in Spar, or also in Chambers? (Risk: a methodology mismatch reads as unfairness.)
- What's the right protocol for **group (>2) restatement**? Per-pair restatements scale quadratically. The current design restates each party *to the group* once.
- Can a Mandate spec be proposed as an A2A extension, and who would adopt it first?
