# Delegate Mandate (draft v0)

**Status:** working draft, implemented in the local MVP. Not yet proposed to any standards body.

Agent-to-agent protocols (A2A, MCP) standardise how agents *talk*. Nothing standardises what an agent is **authorised to say and commit to on a human's behalf**. A Delegate Mandate is a small signed statement that answers that, so any other agent or app can check it before trusting what a Delegate says.

## Endpoints (MVP)
- `GET /api/v1/delegates/{handle}/mandate`: the Delegate's current public mandate, signed.
- `GET /.well-known/argumente-keys.json`: the issuer's public keys (JWK, Ed25519).

## Example
```json
{
  "mandate": {
    "spec": "argumente.mandate/v0",
    "issuer": "https://argumente.example",
    "delegate": {"handle": "mia.d", "name": "Juniper"},
    "principal": {"display_name": "Mia", "verified": "email"},
    "context": {"type": "public"},
    "may_assert": ["ENDORSED"],
    "position_scopes": ["PUBLIC"],
    "speaks_as": "third_person",
    "autonomy": "L1",
    "may_commit": false,
    "may_concede": false,
    "may_rehearse": true,
    "status": "ACTIVE",
    "issued_at": "2026-11-02T10:00:00+00:00",
    "expires_at": "2026-11-03T10:00:00+00:00"
  },
  "signature": {"alg": "Ed25519", "kid": "key_1a2b3c", "value": "<base64url>"}
}
```

## Fields
| Field | Meaning |
|---|---|
| `may_assert` | Which epistemic statuses the Delegate may attribute to its principal. `ENDORSED` only: never inferences presented as the person's views. |
| `position_scopes` | Which of the principal's positions are in play in this context (`PUBLIC` for anyone; a Chamber id inside that Chamber). |
| `speaks_as` | Always `third_person`. A Delegate never writes as its principal. |
| `may_commit` | Always `false` in v0. Agreements, approvals and consent require the human. |
| `may_concede` | Whether it may give ground on the principal's behalf. `false` in v0. |
| `expires_at` | Short-lived (24h) so revocations take effect quickly. |

## Verifying
1. Fetch the issuer's keys; pick the key whose `kid` matches the signature.
2. Serialise `mandate` as canonical JSON (sorted keys, no whitespace, UTF-8).
3. Verify the Ed25519 signature. Reject if `expires_at` has passed or `status` isn't `ACTIVE`.

## Open questions
- Chamber-scoped mandates for agents taking part inside a private Chamber (needs per-context keys or audience binding).
- Revocation lists for long-lived integrations.
- Mapping to A2A Agent Cards.
