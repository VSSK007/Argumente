# Argumenté: notes for Claude Code sessions

- Run: `./scripts/dev.sh` (API :8000, web :3000) or `docker compose up --build`. Tests: `cd services/api && uv run pytest`; E2E: `node e2e/*.cjs` with servers up; `node e2e/quality.cjs` must stay green (axe WCAG 2.2 AA, /design screenshots).
- Product decisions: `docs/OPEN_QUESTIONS.md` §1 (D1–D24). Specs live in `docs/`.

## Invariants (check on every change)
1. Only `actor_type=human` sessions (`auth.human_user`) can endorse, accept their own restatement, approve agreement items, or consent to publishing.
2. Delegate/engine reads of stored positions go only through `protocol.scoped_positions()` (the owner's own Delegate) or `protocol.public_positions()` (anyone else, e.g. rehearsals: ENDORSED + PUBLIC only). Both return ENDORSED positions only. Chamber-scoped positions never leave their Chamber; CANDIDATE suggestions are never used until the owner keeps them.
3. Human-attributed text in shared views is either the person's accepted restatement or a verbatim claim from their endorsed intake (`epistemic_status=ENDORSED`). Everything else is labelled Mediator/inferred.
4. Every Delegate-rendered message shows `DelegateBadge` and an `EpistemicTag`.
5. No options or agreements before the Restatement Gate passes (enforced server-side in `routers/chambers.py`).
6. Pause blocks all actions and cancels in-flight engine runs.
7. No model keys in the web app. Tests use `ENGINE_PROVIDER=local`.
8. Retention purges a closed Chamber's private content; never purge agreements, consented publications, or positions the owner kept.
9. Schema changes must be additive (new tables/nullable columns) so `db.ensure_schema()` can upgrade existing local databases.
10. Never put session tokens in URLs. Streams use short-lived scoped tickets (`auth.make_ticket`). New endpoints that call the Mediator must call `ratelimit.check(user.id, "engine")`.
11. Individual option rankings and sealed predictions are never shown to other people (only aggregates / after a revisit). Colours must pass WCAG AA; the quality gate enforces it.
