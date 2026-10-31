# Argumenté

> **Disagree. Debate. Understand.**

Human-owned AI **Delegates** plus a neutral **Mediator** that helps people understand each other before anyone tries to resolve anything.

## Run it locally

Prerequisites: [uv](https://docs.astral.sh/uv/) (Python 3.11+) and Node.js 20.9+.

```bash
./scripts/dev.sh --seed     # first run: installs deps, seeds demo data, starts both servers
./scripts/dev.sh            # later runs
```

- App: http://localhost:3000
- API docs (OpenAPI): http://localhost:8000/docs

**No API keys needed.** Without a key, the Mediator uses an offline heuristic engine that quotes people's own words. To switch to Claude, create `services/api/.env`:

```bash
ANTHROPIC_API_KEY=sk-ant-...
# optional overrides
# ENGINE_ANALYZE_MODEL=claude-sonnet-5-5
# ENGINE_FAST_MODEL=claude-haiku-5-5
```

Then restart. If a Claude call fails (bad key, network, refusal), that step falls back to the offline engine and the Chamber tells you.

### Trying a multi-person Chamber on one machine
Sign in is local-dev only (name + email, no password). Open a second browser profile or a private window to be a second person. The login page lists existing local accounts for quick switching. With `--seed`, you get `priya@demo.local`, `sam@demo.local` and `dev@demo.local`, a Chamber already at its Understanding Map, and a published Map in the Commons.

## What works

| Flow | Notes |
|---|---|
| Delegate onboarding | Name, voice, methodology, position cards → endorsed positions. Guests can skip it (D19). |
| Chambers | Decision / Disagreement / Household templates, invite links, up to 8 people |
| Private intake | Write your position, or have your Delegate draft it from endorsed positions (stays a draft until you endorse) |
| **Delegate pre-round** | Optional. Delegates draft openings, then one round of replies, from endorsed positions only. Each owner reviews, edits or withdraws their own Delegate's turn. Turns are revealed to everyone at once, so nobody anchors on the others. |
| Mediator analysis | Claims typed FACT/VALUE/INTEREST/INTERPRETATION/PREDICTION/DEFINITION, assumptions, interests, cruxes |
| **Restatement Gate** | Each person must accept how their view was explained ("Not quite" → revision, max 3, then write it yourself) before anything else unlocks |
| Understanding Map | Where each person stands (only accepted restatements), shared ground, typed differences, cruxes, questions |
| Interpretation Diff | For "same events, different meaning" disagreements: each person's observations next to their interpretations (endorsed words only) |
| Options & Agreement | Mediator options, per-item approval by every person, nothing pre-approved |
| Pause | Anyone can pause at any time. In-flight Mediator runs stop. Only the pauser can resume. |
| Safety | Abuse/coercion/self-harm screening → private resources + quiet pause |
| Publishing | Needs every participant's consent, anonymized by default, revocable → `/commons`, `/m/<slug>` |
| Spar | Devil's Advocate / Steelman against 5 reasoning methodologies, with a robustness report |
| Delegate learning | After a Chamber closes, your Delegate suggests up to 3 general positions, each backed by a quote of what you endorsed. Nothing is used until you **Keep** (private or public), edit, or discard it. |
| Memory Inspector | View, edit (with change-of-mind history), retract, change scope; export JSON; delete account |
| Live updates | Server-sent events push every change to everyone in the Chamber within about half a second. Polling is the fallback if the stream drops. |
| Retention (D21) | A closed Chamber's private content (positions, restatements, Map, pre-round) is deleted 90 days after close unless a member extends it. Agreements, the event record, consented published Maps and positions you chose to keep survive. `RETENTION_DAYS` overrides. |

## Tests

```bash
cd services/api && uv run pytest          # 20 API tests incl. the safety invariants and the eval gate
node e2e/flow.cjs                          # browser E2E: full two-person loop (needs both servers running)
node e2e/preround.cjs                      # browser E2E: Delegate pre-round
cd services/api && uv run python ../../evals/run.py   # Mediator eval → evals/REPORT.md
```

### Mediator evals
`evals/scenarios/` holds 10 disagreements (trips, couples, chores, rent, family, work, money, definitions). `evals/run.py` scores fabricated or misattributed quotes (target 0), coverage, disagreement-type recall and restatement balance for whichever engine is configured, so you can compare the offline engine against Claude once you add a key. The offline baseline is in [`evals/REPORT.md`](evals/REPORT.md). `tests/test_evals.py` fails the build if the offline engine ever fabricates a quote.

## Layout

```
services/api/   FastAPI + SQLAlchemy (SQLite by default; set DATABASE_URL for Postgres)
  app/engine/   Argumentative Intelligence engine: local.py (offline), anthropic_provider.py, router.py
  app/protocol.py  Chamber state machine, engine runs, scoped memory retrieval
apps/web/       Next.js 16 + React 19 + Tailwind 4
e2e/            Playwright end-to-end flows
evals/          Mediator eval scenarios + harness
docs/           Product ideation package (vision, PRD, architecture, safety, roadmap…)
```

### Deliberate simplifications vs `docs/SYSTEM_ARCHITECTURE.md`
SQLite instead of Postgres/pgvector, in-process background threads instead of Redis/arq, an SSE stream that polls the event table instead of Redis pub/sub (and takes the session token as a query parameter, since `EventSource` can't send headers), and dev login instead of magic links. All of these are behind small seams (`DATABASE_URL`, `protocol.start_run`, `routers/chambers.py:stream`, `auth.py`). New columns are added automatically to existing local databases on startup (`db.ensure_schema`).

## Product docs

[Vision](docs/VISION.md) · [PRD](docs/PRD.md) · [Market research](docs/MARKET_RESEARCH.md) · [Argumentative Intelligence](docs/ARGUMENTATIVE_INTELLIGENCE.md) · [Delegates](docs/PERSONA_ARCHITECTURE.md) · [Architecture](docs/SYSTEM_ARCHITECTURE.md) · [Trust & Safety](docs/TRUST_AND_SAFETY.md) · [UX](docs/UX_PRODUCT_SPEC.md) · [Business](docs/BUSINESS_MODEL.md) · [MVP roadmap](docs/MVP_ROADMAP.md) · [Execution plan](docs/CLAUDE_CODE_EXECUTION_PLAN.md) · [Open questions](docs/OPEN_QUESTIONS.md)

![Understanding Map](docs/screenshots/05-understanding-map.png)
