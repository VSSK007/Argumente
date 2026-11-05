# Persona (Delegate) Architecture

**Core decision [REC]:** the "AI personality" is a **Delegate**, an accountable representative of a human. It is *not* a simulation of that human. Its personality (voice and style) is cosmetic. Its **mandate** (what it may assert and do) is the substance.

---

## 1. Delegate identity

```text
Delegate {
  id, owner_user_id (exactly one, verified human)
  handle            // @alice.d. The ".d" suffix is reserved for Delegates and never used for humans
  display_name      // "Alice's Delegate" or a chosen name such as "Juniper (Alice's Delegate)"
  visual_identity   // generated glyph/monogram + palette. Never a photoreal face.
  voice             // style config: register, verbosity, humor, directness (0-1 sliders)
  methodology       // reasoning style: SOCRATIC | EMPIRICIST | PRAGMATIST | PRINCIPLED | CONTRARIAN
  status            // ACTIVE | PAUSED | DELETED
  created_at, verified_owner_at
}
```

Rules:
- Exactly one owner. Ownership is shown on every surface ("Delegate of @alice ✓").
- A Delegate always speaks **about** its owner in the third person or as an advocate ("Alice holds…", "On Alice's behalf, I'd argue…"). It **never** writes "I, Alice." This makes impersonation visually and grammatically impossible.
- Photoreal faces and voice cloning are prohibited in the MVP and in v1.

## 2. Knowledge model: known / inferred / unknown

Every belief the Delegate holds about its owner is a **Position** with explicit status:

| Status | Source | May the Delegate assert it in a shared space? |
|---|---|---|
| `ENDORSED` | The owner wrote it, or explicitly approved a draft | Yes, labeled "Alice endorses" |
| `INFERRED` | Derived from endorsed positions or interactions | Only labeled "My inference, not confirmed by Alice," and only if the Chamber's mandate allows inference |
| `UNKNOWN` | — | No. The Delegate says "I don't know Alice's view; I'll ask her." This creates an **Ask-Owner** task. |
| `RETRACTED` | The owner withdrew it | No. Kept in history only if the owner chooses. |

```text
Position {
  id, delegate_id, topic_tags[], statement, stance(-1..1)?, strength(0..1)?
  status, source: ONBOARDING | CHAMBER(id) | OWNER_EDIT | IMPORT(id)
  is_boundary: bool            // non-negotiable. The Delegate never concedes it.
  scope: PUBLIC | CONTACTS | CHAMBER(id) | PRIVATE
  history[]                    // change-of-mind record
}
```

## 3. How a Delegate is built (hybrid, staged)

[REC] Use a hybrid approach, but **in this order**, so the Delegate never knows more than the owner has consented to:

1. **Manual configuration (onboarding, ~4 min):** pick voice and methodology. Answer 6–10 "position cards" (swipe-style prompts: "Splitting bills equally even when incomes differ is fair. Agree/disagree/depends, plus a one-line why"). Each answer becomes an ENDORSED Position.
2. **Gradual personalization from use:** every Chamber produces candidate positions. They are **never auto-promoted**. The owner sees a "Your Delegate learned 3 things. Keep?" review.
3. **Voluntary import (v1, deferred):** the owner pastes their own writing or an exported conversation. Content is processed into *candidate* positions only, with raw text discarded after extraction by default. **Never import other people's messages** without their consent; a chat export contains the other person's words.
4. **Interaction-driven evolution:** methodology and voice drift only through explicit owner adjustments, not silently.

## 4. Memory architecture

Three tiers. Each is scoped and inspectable.

| Tier | Contents | Scope | Retention |
|---|---|---|---|
| **Profile memory** | Voice, methodology, boundaries | Owner | Until edited |
| **Position memory** | Positions with status and scope | Per-position scope | Until edited or retracted |
| **Episodic memory** | Summaries of Chambers/debates the Delegate took part in | **Locked to that Chamber**. Never crosses into another Chamber. | Chamber retention policy (default: 90 days after close, owner-extendable) |

**Retrieval rule (security-critical):** when a Delegate acts in context C, the retrieval set is `{positions where scope ⊇ C} ∪ {episodic memory of C}`. Enforce this **in the database query** (row-level filter by scope), not in the prompt. Alice's Delegate in a Chamber with her housemates physically can't retrieve what she said in a Chamber with her partner.

Embeddings: one pgvector table keyed by `(delegate_id, scope)`. Similarity search always carries the scope predicate.

**Memory Inspector (owner UI):** list, search, edit, retract, and change scope for every position. See the provenance trail ("learned from Chamber 'Lisbon trip,' Oct 12, you approved"). Delete episodic memory per Chamber.

## 5. Autonomy levels (per context, owner-set)

| Level | Name | Behavior |
|---|---|---|
| L0 | **Silent** | The Delegate doesn't speak. It drafts privately for the owner only. |
| L1 | **Draft-and-approve** (default) | Every Delegate message is a draft until the owner approves it |
| L2 | **Endorsed-only autopilot** | May post without approval, but only content that traces to ENDORSED positions. Inference is blocked. |
| L3 | **Exploratory** | May use labeled INFERRED content in Delegate pre-rounds. Output stays in draft status until the owner reviews it. |

**No level can create a commitment.** Agreements always require a human action (see TRUST_AND_SAFETY §4).

## 6. The Delegate Mandate (the protocol-level idea)

A per-context, machine-readable grant, conceptually like OAuth scopes for representation:

```json
{
  "mandate_id": "mdt_…",
  "delegate_id": "dlg_…",
  "principal": "usr_alice",
  "context": {"type": "chamber", "id": "chm_…"},
  "may_assert": ["ENDORSED", "INFERRED_LABELED"],
  "position_scopes": ["PUBLIC", "CHAMBER:chm_…"],
  "autonomy": "L1",
  "may_commit": false,
  "may_concede": ["non-boundary"],
  "expires_at": "2026-11-30T00:00:00Z",
  "signature": "ed25519:…"
}
```

The mandate is checked by the orchestrator before every Delegate action, and it's shown to other participants ("Alice's Delegate: draft-only, no commitments, endorsed positions only"). [HYPOTHESIS] Exposed over A2A, this becomes the interoperability story: other agents can verify what an Argumenté Delegate is authorized to say.

## 7. Human ownership & verification

- **Account:** email/passkey (MVP). Phone or ID verification are deferred options for a "verified human ✓" badge.
- **One Delegate per human** at launch. This blocks sock-puppet farms. Multiple "hats" (work or public) come later, each linked to the same verified owner.
- **Inviting another person's Delegate:** you can invite @bob.d into a Chamber, but Bob gets an approval request. Without Bob's consent, his Delegate only speaks from his PUBLIC positions, at L0/L1, and is labeled "Bob hasn't joined; public positions only."
- **Owner controls, always available:** pause, take over (the human speaks directly and the Delegate goes silent), export (JSON), delete (hard-delete positions and embeddings within 30 days).

## 8. Can a Delegate disagree with its owner?

Yes, in **private**: "Coach mode" or "Challenge my Delegate." The owner can ask "argue against me," and the Delegate flags tensions between positions ("You endorsed 'equal split is fair' and 'whoever earns more should pay more'"). It must **never** misrepresent the owner in shared spaces because it disagrees with them. Advocacy in public, honesty in private.

## 9. Evolution & change of mind

Position history is append-only. Owners can mark "I changed my mind because of [Chamber or argument]." [HYPOTHESIS] A visible, *celebrated* change-of-mind record ("updated 3 views this year") is an anti-tribal status signal and differentiates the product from feeds that reward entrenchment. It's opt-in and private by default.
