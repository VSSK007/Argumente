# Argumenté: notes for Claude Code sessions

- Run: `./scripts/dev.sh` (API :8000, web :3000; sets ARGUMENTE_DEV=1 and ADMIN_EMAILS=dev@demo.local) or `docker compose up --build`. Tests: `cd services/api && uv run pytest`; E2E: `node e2e/*.cjs` with servers up; `node e2e/quality.cjs` must stay green (axe WCAG 2.2 AA, /design screenshots).
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
11. Individual option rankings, sealed predictions, individual Understanding Scores and unaccepted steelmen (and all steelman feedback) are never shown to other people (only aggregates / after a revisit / once accepted). Public Position Records never reveal Chamber titles. Colours must pass WCAG AA; the quality gate enforces it.
12. Delegate Mandates always say `may_commit: false` and `speaks_as: third_person`; changing that needs a product decision.
13. Public topics: votes and statement authors are never exposed; opinion groups are shown only when every group has at least `topics.MIN_GROUP` (3) people; only human sessions vote (Delegates never vote).
14. Dev sign-in (`/auth/login`) exists only when `ARGUMENTE_DEV=1`; never default it on. Magic-link tokens are stored hashed, single-use, 15 minutes, and travel only in the URL fragment. Moderators act only on public content; never expose private Chamber or Spar content in `/admin`. Every moderation action writes an `AuditLog` row.
15. Notification and metrics text is generic and aggregate: never include anyone's words, the reason for a quiet safety pause, or private scores. New Chamber events that need someone's attention get a rule in `notify.RULES`. The web app finds the API via `API_URL` at runtime (`proxy.ts`); don't reintroduce build-time rewrites.
