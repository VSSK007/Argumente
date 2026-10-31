# Argumenté: notes for Claude Code sessions

- Run: `./scripts/dev.sh` (API :8000, web :3000). Tests: `cd services/api && uv run pytest`; E2E: `node e2e/flow.cjs` with servers up.
- Product decisions: `docs/OPEN_QUESTIONS.md` §1 (D1–D24). Specs live in `docs/`.

## Invariants (check on every change)
1. Only `actor_type=human` sessions (`auth.human_user`) can endorse, accept their own restatement, approve agreement items, or consent to publishing.
2. Delegate/engine reads of stored positions go only through `protocol.scoped_positions()`. Chamber-scoped positions never leave their Chamber.
3. Human-attributed text in shared views is either the person's accepted restatement or a verbatim claim from their endorsed intake (`epistemic_status=ENDORSED`). Everything else is labelled Mediator/inferred.
4. Every Delegate-rendered message shows `DelegateBadge` and an `EpistemicTag`.
5. No options or agreements before the Restatement Gate passes (enforced server-side in `routers/chambers.py`).
6. Pause blocks all actions and cancels in-flight engine runs.
7. No model keys in the web app. Tests use `ENGINE_PROVIDER=local`.
