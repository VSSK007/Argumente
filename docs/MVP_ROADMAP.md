# MVP Roadmap

## 1. The smallest compelling product

**[REC] One end-to-end loop, done beautifully:**

> **Create your Delegate → open a Chamber on a real disagreement or decision → invite 1–4 people → private positions → the Mediator decomposes the disagreement → Mutual Restatement Gate → Understanding Map → (optional) a simple Agreement, approved by everyone → (optional) publish the Map with consent.**

Plus **Solo Spar**. Someone arriving alone gets value immediately, and it also demos Argumentative Intelligence without needing a second person.

### What's in and what's out, and why

| Candidate | MVP? | Reason |
|---|---|---|
| Persona creation | ✅ Must | Core identity. Needed by every invitee. |
| AI²: decomposition, restatement, crux, Map | ✅ Must | This *is* the product |
| Private Chambers | ✅ Must | The invite engine |
| Human intervention (pause, endorse, correct) | ✅ Must | Safety principle and differentiator |
| Solo Spar (Devil's Advocate / Steelman) | ✅ Must | Single-player value and demo |
| Basic Agreements (text items, per-person approval) | ⚠️ Should | Closes the loop. Small effort. |
| Publish Map + public Map page | ⚠️ Should | Viral artifact. Static page. |
| Persona profiles (public) | ⏳ Could | Minimal: handle, glyph, public positions |
| AI-to-AI discussions (Delegate pre-round) | ⏳ Could | Impressive but risky. Only if the core is solid by hour 48. |
| Public social feed / AI-generated posts | ❌ Deferred | The slop risk. The Commons index of published Maps is enough. |
| Expenses / debt simplification | ❌ Deferred (v1) | Mature category. Not the thesis. |
| Couple template | ❌ Deferred (v1) | Requires safety-expert review |
| Native apps, PWA push, follows, topics | ❌ Deferred | |

## Build status (local MVP, branch `feat/local-mvp`)
Built: M1–M12, S1 (agreements), S2 (publish + public page), S3 (eval harness, `evals/`), S4 (rule-based screening), C1 (Delegate pre-round), C2 (public Delegate profile), C3 (Interpretation Diff), C4 (Commons), plus from P2: Delegate candidate-position review, SSE live updates, D21 retention, agree-to-disagree records (PRD #13), revisits (F4.4), per-user rate limits, private option ranking, Decision Replay (PRD #15), Rehearsal Room (#17), Chamber page reorganised by stage with argument graph and timeline, Postgres + Docker Compose, CI, an accessibility/visual/JS-budget quality gate, Steelman Exchange, Understanding Score, crux what-if + evidence board, Position Record, a landing page with a guided demo, and the Delegate Mandate (draft spec). Public topics (Polis-style) built at the founder's request (D25). Real sign-in and moderation (D26). Notifications, feedback and metrics, legal drafts, security headers, backup script and deployment guide (D27). Not built: S5 deploy (waiting on accounts and keys, D15).

## 2. Prioritized backlog

**Must-have (demo fails without these)**
- M1 Auth (magic link plus dev login), user, Delegate creation with position cards
- M2 Memory Inspector (list, edit, retract positions)
- M3 Chamber create from 3 templates, invite link, guest join (Delegate optional, offered afterwards; D19)
- M4 Private intake: human write, or Delegate draft then endorse
- M5 Engine: decompose → typed nodes, assumptions, crux candidates
- M6 Restatement Gate (accept/reject with feedback → regenerate, max 3 revisions)
- M7 Understanding Map screen (editorial)
- M8 Pause/resume. SSE state updates.
- M9 Solo Spar (5 rounds, robustness report)
- M10 Identity grammar everywhere (DelegateBadge, EpistemicTag)
- M11 Security invariants: scope-filtered retrieval, human-only approval and endorsement
- M12 Seeded demo: 2 personas plus 1 pre-built Chamber for a cold demo

**Should-have**
- S1 Agreement (text items, per-person approval, APPROVED state)
- S2 Publish Map with all-party consent → `/m/{slug}` public page plus an OG image
- S3 Eval harness with 10 scenarios (fidelity, fabrication, balance)
- S4 Moderation hook on input/output
- S5 Deploy to a public URL

**Could-have**
- C1 Delegate pre-round (2 turns each, all INFERRED, owner review). Only if the core loop is solid by H48 (D23).
- C2 Public Delegate profile
- C3 Interpretation Diff view
- C4 Commons index page

**Explicitly deferred:** feed, follows, expenses, couple template, imports, L2/L3 autonomy, native, A2A Mandate, payments, topics/clustering.

## 3. 72-hour execution timeline

The clock is wall-clock time. Claude Code Cloud sessions run in parallel. The founder's job is review, merging, and decisions.

| Window | Work | Gate to proceed |
|---|---|---|
| **H0–H6** | **Wave 1, T0 Foundation** (single session): monorepo, compose, DB schema and migrations, FastAPI stubs for all MVP endpoints returning schema-valid fixtures, OpenAPI export plus TS client generation, Next app shell plus design tokens, CI | `docker compose up` works. `/docs` lists all endpoints. The web app renders the shell. CI green. **Contract frozen (v0).** |
| **H6–H30** | **Wave 2, parallel:** T1 Backend core · T2 AI² engine · T3 Web: identity and Delegate · T4 Web: Chamber, Map, Spar | Each task merged behind its own tests. Web runs against the stub API. The engine passes its fake-LLM tests and 5 live scenarios. |
| **H30–H48** | **Wave 3:** T5 Integration (wire engine and workers, real API to web, Agreements, publish) · T6 Trust & Safety plus security tests plus deploy | The E2E Playwright test of J1 (3-person decision) and J3 (spar) passes against the real stack with a live model. |
| **H48–H64** | **Wave 4:** T7 Polish and demo (seed data, copy, empty states, mobile pass, OG images) · T8 Eval run plus fixes (optional: C1 pre-round) | Demo script runs cleanly twice in a row on the deployed URL |
| **H64–H72** | Buffer: bug fixes, README, recorded demo, retro | — |

Critical path: **T0 → T1 + T2 → T5 → T7.** T3 and T4 are off the critical path because they build against stubs.

## 4. Acceptance criteria for "MVP done"

1. A fresh user on the deployed URL can complete J1 with 2 other real people in under 15 minutes total.
2. PRD AC1–AC8 pass (automated where specified).
3. Map quality: in 10 eval scenarios, fabrication = 0 and restatement first-pass acceptance (LLM-judge proxy) ≥ 70%.
4. The pause button halts an in-flight engine run.
5. Lighthouse mobile performance ≥ 80 on the Map page. Accessibility ≥ 90.

## 5. Phased roadmap after MVP

| Phase | Theme | Key items | Exit signal |
|---|---|---|---|
| **P1 (weeks 1–4)** | Learn | 20–50 real Chambers with friends of the founder, interviews, instrument RF/MUG, fix the protocol | ≥ 40% of Chambers reach a Map. ≥ 30% of joiners create their own Chamber within 14 days. |
| **P2 (months 2–3)** | Retain | Agreements with expenses and responsibilities, revisit flows, PWA push, Delegate candidate-position review, pre-rounds | Weekly active groups growing without paid acquisition |
| **P3 (months 3–6)** | Public | Profiles, Spar invites, Commons, topics (Polis-style), Steelman reputation | Shares → new Chamber creators |
| **P4 (6+ months)** | Expand | Couple template (after expert review), Plus/Household billing, Teams pilot, Mandate spec draft (A2A) | Paying groups. Mandate RFC feedback. |
