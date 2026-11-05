# ARGUMENTÉ — Vision

> **Disagree. Debate. Understand.**

Labels used throughout this package: **[FACT]** verified with a cited source · **[FINDING]** research result (see MARKET_RESEARCH.md) · **[ASSUMPTION]** taken as true for planning, not verified · **[HYPOTHESIS]** testable claim the product bets on · **[REC]** recommendation.

---

## 1. Phase 1 — What the concept actually is

Stripped down, the founder's brief contains three different ideas tangled together:

1. **A representative**: an AI that can state *my* position when I'm not there, or before I'm ready to.
2. **A reasoning partner**: an AI that refuses to just agree with me. It argues, steelmans, and finds where I'm wrong.
3. **A social place**: a network where these representatives meet each other and people discover ideas through them.

Most products in the space pick one of these. Moltbook and Chirper pick (3) with no humans involved. Delphi and Sensay pick (1) as a "clone." Mediation apps like Auralink and Mendus pick a private, one-off version of (2). Argumenté's thesis is that **(1) and (2) together create a new kind of interaction, and that (3) should come out of it, not be built first.**

## 2. Phase 2 — Challenging the founder's assumptions

I'm stating these plainly because several are load-bearing.

| # | Founder assumption | Challenge | Resolution [REC] |
|---|---|---|---|
| A1 | "AI personalities representing real humans" is the core. | An AI that *simulates a person* is a liability: it will confidently say things the person never believed. Moltbook-style feeds show what happens at scale: entertaining, then meaningless. | Reframe the persona from **digital twin** to **Delegate**. A Delegate represents *positions the owner has endorsed*, and it labels everything else as inference or speculation. It is an advocate with a mandate, not a clone. |
| A2 | AI-to-AI debate is the main experience. | Watching two bots argue is novel for about five minutes. The value appears only when a *human* learns something about another human. | AI-to-AI exchange is a **means** (a preliminary round, a rehearsal, an exploration). The **product output** is a human-legible artifact: the **Understanding Map**. |
| A3 | Build a social network (feed, followers, trends). | A cold-start feed of AI content is the exact failure mode the brief warns about. Network effects come from relationships, not content volume. | Build the **graph of disagreements between people who know each other** first. The public layer publishes *finished* Understanding Maps, not raw bot chatter. |
| A4 | Couples mediation is a flagship use case. | It is high-intensity but also the riskiest: abuse, coercion, liability, and dependency. The field is already crowded (Auralink, Mendus, Mediator, Relationship Ref). Its graph is also only two people, so it spreads poorly. | Support it carefully as one Chamber template with extra safety gates. **Do not lead with it.** |
| A5 | Resolution or compromise is the goal. | The brief already concedes this. I'm going further: optimizing for agreement is dangerous because it rewards whoever pushes hardest. | The success metric is **mutual accurate understanding**: can each side state the other's view to that person's satisfaction? Agreement is optional. |
| A6 | "Argumentative Intelligence" is a distinct technology. | Today it's mostly prompts. Prompts aren't defensible. | It becomes a technology when there's (a) a typed **argument graph** as the shared state, (b) **protocols** that run on it, and (c) **evaluations** that measure fidelity, fairness, and crux-finding. See ARGUMENTATIVE_INTELLIGENCE.md. |
| A7 | Splitwise-style finance belongs in the product. | It does, but only as the place where disagreements *end*: a decision becomes an Agreement. Leading with it makes Argumenté a worse Splitwise. | **Agreements** is a module: the human-approved output of a Chamber. Money is one type of Agreement. |

## 3. The foundational thesis

**[HYPOTHESIS] Most disagreements between people who care about each other aren't failures of logic. They're failures of *representation*: each person argues against a version of the other's view that the other doesn't hold.**

An AI Delegate that (1) states your view in a form you have *endorsed*, (2) restates the other person's view until *they* endorse it, and (3) separates factual, value, and interest disagreements can make disagreement productive. It does this without pretending disagreement can be eliminated.

That's the category: **Social Argumentative Intelligence**, software whose job is to make disagreement between people more accurate, not to make it disappear.

## 4. Long-term ambition

- **Near term (product):** the default place where friends, couples, housemates, families, and small teams take a disagreement or a shared decision when the group chat stops working.
- **Mid term (network):** a public layer of human-endorsed positions and Understanding Maps. You can invite someone's Delegate to "spar" on a topic, and each person has a visible, owner-controlled **Position Record**.
- **Long term (infrastructure):** an **open protocol for accountable representation**. Delegates carry a verifiable mandate (what they may say and what they may commit to) and interoperate with other agents (A2A, MCP). Every statement carries provenance back to a human endorsement. Argumenté becomes the trust layer for "my AI talks to your AI."

That last item is the infrastructure bet. **[FINDING]** Agent-to-agent protocols are standardizing the *transport* (A2A under the Linux Foundation). Nobody is standardizing the *mandate*: what a representative agent is authorized to claim and commit on a human's behalf. That gap is where the defensibility lies.

## 5. Product principles

1. **Endorsed, inferred, unknown.** Every Delegate statement carries a visible epistemic label. Delegates say "I don't know what Alice thinks about this" freely.
2. **Understanding before resolution.** No resolution proposal is shown until both sides have passed the *Mutual Restatement Gate*.
3. **The human holds the pen.** AI drafts. Humans endorse, edit, or reject. Nothing binds without explicit, per-item human approval.
4. **No winner-takes-all.** Nothing scores "who won." Steelmanning, conceding, and changing your mind are what earn standing.
5. **Always visibly AI.** Delegates never pass as humans: distinct visual grammar, permanent labels, no first-person impersonation of the owner ("Alice's Delegate holds…", not "I, Alice…").
6. **Privacy by construction.** Private memory never leaves its scope. A Delegate in a Chamber only knows what the owner has granted to that Chamber.
7. **Leave-ability.** Pause, export, correct, or delete a Delegate or a Chamber at any time.
8. **Artifacts over feeds.** The network is built from finished, human-endorsed artifacts, not an endless stream of generated content.
