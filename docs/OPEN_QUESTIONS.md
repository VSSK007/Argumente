# Open Questions, Risks & Decision Log

## 1. Decision log

| ID | Decision | Status | Rationale | Reversible? |
|---|---|---|---|---|
| D1 | The persona is a **Delegate** (accountable representative), not a digital twin | Recommended | Avoids fabricated beliefs and impersonation. Differentiates from clone products. | Hard to reverse later, so decide now |
| D2 | The product output is the **Understanding Map**, not the debate transcript | Recommended | Human value plus shareable artifact. Avoids Moltbook-style spectacle. | Yes |
| D3 | Success metric is **mutual understanding**, not agreement | Recommended | Avoids rewarding the dominant party and manufactured consent | Yes |
| D4 | The **Mutual Restatement Gate** is mandatory before resolution | Recommended | Signature mechanic, de-escalation hypothesis | Yes (could become optional per template) |
| D5 | Launch wedge = **small-group decisions/disagreements**. Spar for single players. | Recommended | Structural invites. Couples is too risky and crowded to lead. | Yes |
| D6 | Couple template deferred until expert safety review | Recommended | Abuse and coercion risk | — |
| D7 | No autonomous public AI posting (MVP/v1) | Recommended | Slop and spam prevention | Yes |
| D8 | Finance is an **Agreements** module, v1 | Recommended | Keeps identity focused. Retention driver later. | Yes |
| D9 | Stack: Next.js 16 + FastAPI + Postgres/pgvector + Redis. **No LangGraph in the MVP.** SSE before WebSockets. | Recommended | Contract seam enables parallel work. Deterministic protocols are auditable. | Yes |
| D10 | Model router with a different-family critic | Recommended | Reduces correlated errors | Yes |
| D11 | 18+ only at launch | Recommended | Character.AI precedent | Yes |
| D12 | One Delegate per verified human | Recommended | Anti-sock-puppet | Yes (hats later) |
| D13 | No ads, no training on private content by default | Recommended | Trust is the moat | Shouldn't be reversed |

## 2. Critical product decisions needing the founder

1. **Confirm the launch wedge (D5).** Is the founder's own conviction with couples strong enough to accept the slower, riskier path? My recommendation stays groups-first.
2. **Name and handle grammar:** "Delegate" versus "Persona" versus a branded noun (e.g. "Second," "Advocate"). This affects all copy.
3. **Deployment accounts:** are Vercel, Fly/Render, Neon, and Upstash accounts and an LLM API key available? This decides T6's path.
4. **Primary model provider** for `analyze`, and a second provider for `critic`.
5. **Publishing default:** anonymized names (recommended) or real handles?
6. **Who is in the first 20 Chambers?** Recruitment plan for P1.

## 3. Unresolved assumptions

- A1: Users will tolerate a *slower, staged* protocol instead of chat speed. (Test: drop-off per stage.)
- A2: Endorsing 6–10 position cards is enough to make a useful Delegate.
- A3: Invitees will create a Delegate at join time instead of bouncing. (Mitigation: allow a "guest participant" without a Delegate, as a fallback.)
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
