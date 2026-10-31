# Product Requirements Document — Argumenté

Status: v0.1 (ideation). Owner: founder. MVP scope is in MVP_ROADMAP.md; this PRD describes v1. Each requirement is tagged **[MVP]**, **[v1]**, or **[Later]**.

---

## 1. User personas

| Persona | Description | Primary job | Risk notes |
|---|---|---|---|
| **The Organizer** (Priya, 29) | Plans the group trip, runs the house group chat, tired of decisions dying in 200 messages | "Get my group to a decision everyone actually owns" | Can dominate the group. The engine must keep things balanced. |
| **The Sparring Mind** (Dev, 22) | Student, debater, writer. Wants to sharpen arguments, not just win them. | "Find the strongest version of the other side, and my blind spots" | Wants an audience, so it's tempting to build toward performative hostility |
| **The Partner** (Alice & Bob, 30s) | Recurring disagreement that keeps escalating | "Understand what's actually going on without a fight" | Abuse and coercion risk, dependency risk |
| **The Housemate** (Sam, 25) | Chores, bills, noise, guests | "Settle this fairly and remember what we agreed" | Low-stakes but frequent, which makes it the habit driver |
| **The Family Coordinator** (Maria, 45) | Elder care, holidays, inheritance logistics | "Get siblings aligned without reopening old wounds" | Power imbalances, emotionally loaded history |
| **The Observer** (anyone) | Arrives via a shared Understanding Map | "See both sides of something I care about" | Passive consumption. Needs a path to participation. |

Out of scope at launch: under-18 users, workplace HR disputes, legal mediation, clinical use.

## 2. Jobs to be done

1. When a decision or disagreement is stuck in a group chat, I want a structured place to lay out positions so we can decide without a fight.
2. When I'm upset with someone close to me, I want to understand what they actually think, and have them understand me, before we talk.
3. When I hold a strong view, I want it challenged by something that won't flatter me.
4. When we've agreed something (money, chores, plans), I want it recorded, approved by everyone, and easy to revisit.
5. When I see a contested topic, I want a fair map of where people really disagree.

## 3. Product pillars → requirements

### P1. Delegates (personas)
- **F1.1 [MVP]** Create a Delegate: name, glyph, voice sliders, methodology, and 6–10 position cards → ENDORSED positions.
- **F1.2 [MVP]** Each Delegate is always labeled AI, with an owner badge and the reserved `.d` handle.
- **F1.3 [MVP]** Memory Inspector: view, edit, and retract positions, with scope per position.
- **F1.4 [MVP]** Autonomy L1 (draft-and-approve) is the default. L0 is available.
- **F1.5 [v1]** L2/L3 autonomy, a candidate-position review queue, voluntary imports.
- **F1.6 [v1]** "Challenge my Delegate": private self-critique mode.
- **F1.7 [Later]** Multiple hats, A2A-exposed mandate.

### P2. Chambers (private spaces)
- **F2.1 [MVP]** Create a Chamber from a template: *Decision* (trip/purchase), *Disagreement* (general), *Household*. *Couple* is [v1] with safety gates.
- **F2.2 [MVP]** Invite by link or handle. The invitee joins as a **guest** (name plus position, no Delegate required) and is offered Delegate creation afterwards (≤ 3 min) (D19).
- **F2.3 [MVP]** Private position intake per participant (written by the human or drafted by the Delegate, then endorsed).
- **F2.4 [MVP]** Run the canonical protocol: decomposition → Restatement Gate → Understanding Map.
- **F2.5 [MVP]** Any participant can **pause** a Chamber at any time. The pause is visible to all.
- **F2.6 [v1]** Interaction modes per Chamber: human-only, AI-assisted, Delegate pre-round, supervised Delegate debate.
- **F2.7 [v1]** Resolution Architect → options → private ranking.
- **F2.8 [MVP]** Close states: *Agreed*, *Understood – still disagree*, *Abandoned*.

### P3. Argumentative Intelligence
- **F3.1 [MVP]** Disagreement typing and assumption surfacing.
- **F3.2 [MVP]** Restatement generation, plus accept/correct loops (max 3 revisions, then the human writes it).
- **F3.3 [MVP]** Crux candidates, confirmed by each party.
- **F3.4 [MVP]** Solo Sparring: Devil's Advocate and Steelman on any topic.
- **F3.5 [v1]** Common Ground loop, Fairness Guard UI, Perspective Switch.
- **F3.6 [MVP]** Every AI-generated item carries an epistemic label.

### P4. Agreements (incl. finance)
- **F4.1 [MVP-basic]** Promote a Chamber outcome to an Agreement draft (text items). Each participant approves or rejects each item. "Binding within Argumenté" only when all approve.
- **F4.2 [v1]** Expense items: shared expenses, unequal splits (by %, shares, or income ratio), group budgets, debt simplification (min-cash-flow), settle-up links (external payment apps, no money movement).
- **F4.3 [v1]** Responsibilities: recurring chores with an owner and cadence.
- **F4.4 [v1]** Agreement history and "revisit" (reopens a Chamber linked to the Agreement).
- AI may *propose* Agreement items. Only a human tap can approve them. AI can never mark an item approved.

### P5. Public layer
- **F5.1 [MVP-lite]** Publish a closed Chamber's Understanding Map publicly, only with **every** participant's consent, anonymized as "Participant A/B" by default. Real handles only if every participant opts in (D17).
- **F5.2 [v1]** Public Delegate profiles (public positions, Maps, change-of-mind record).
- **F5.3 [v1]** Spar invites: challenge someone's Delegate to a public structured debate. The human owner approves.
- **F5.4 [v1]** Topics: Polis-style position clustering on a question (agree/disagree/pass on endorsed statements).
- **F5.5 [Later]** Following, discovery, curated "Arenas," events.

## 4. Invented capabilities (beyond the brief)

Each item lists its novelty category from MARKET_RESEARCH.md §3 and the experience it creates.

1. **Mutual Restatement Gate** (cat. 2): solutions are locked until each side says "yes, that's me." *"It wouldn't let us argue until we got each other right."*
2. **Understanding Map** (cat. 3): a one-page artifact showing where you agree, where you differ by type, the cruxes, and open questions. It's shareable and the core viral unit.
3. **Crux Cards** (cat. 2): "Here's the one thing that would change Bob's mind, and he confirmed it."
4. **Delegate Pre-Round** (cat. 4): Delegates explore the disagreement overnight. Each human reviews their own side's draft before anyone else sees it.
5. **"Is this what you mean?" loop** (cat. 3): the Delegate restates your raw, angry message in an endorsed form. You choose what gets sent. This is a de-escalation filter you control.
6. **Interpretation Diff** (cat. 3): both people describe the same event, and the engine shows a side-by-side of shared observations versus divergent interpretations.
7. **Position Record with change-of-mind history** (cat. 4): a public or private ledger of your views and the arguments that changed them.
8. **Spar Invites** (cat. 2): "@dev.d challenges your Delegate on rent control." It's a structured, judged-per-point debate, and the owner approves before it goes public.
9. **Consistency Mirror** (cat. 3, private only): "You endorsed X in March and Y today. Want to reconcile?"
10. **Ask-Owner relay** (cat. 3): when a Delegate doesn't know, it asks its human asynchronously, and the answer becomes an endorsed position. Unknowns stay unknown instead of being invented.
11. **Disagreement Weather** for groups (cat. 3): a household or friend-group dashboard of open questions, agreements due for review, and settled matters. No hostility scores.
12. **Methodology personas** (cat. 2): pick an opponent who argues like an empiricist, a Socratic questioner, or a pragmatist. You can learn how different reasoning styles attack the same claim.
13. **Agree-to-Disagree Certificate** (cat. 4): a formal, mutually endorsed record that "we understand each other and still differ on X; we'll handle it by Y." It legitimizes non-resolution.
14. **Third Chair** (cat. 2): invite a trusted friend's Delegate (with consent) as a non-voting perspective in your Chamber.
15. **Decision Replay** (cat. 3): six months later, see what you each predicted and what happened. Calibration that informs future disagreements.
16. **Group Proxy Vote** (cat. 3): in a 6-person trip decision, absent members' Delegates cast *labeled provisional* preferences from endorsed positions. They expire unless confirmed.
17. **Rehearsal Room** (cat. 2): practice a hard conversation against the other person's public/consented Delegate before having it for real.
18. **Steelman Bounties** (public, cat. 4): earn standing when the opposing side rates your steelman of their view ≥ 4/5. This is reputation for understanding, not for winning.

**The "never seen this before" shortlist:** #1, #4, #6, #7, #13. They share one idea: **the product makes the act of understanding visible and verifiable.**

## 5. Key user journeys

### J1. Group decision (launch wedge) [MVP]
1. Priya creates a *Decision* Chamber: "Where do we go in March? Budget?" She sets up her Delegate in 3 minutes.
2. She shares the link in the WhatsApp group. Four friends join and each creates a Delegate during join, using Chamber-specific position cards.
3. Each person enters their position privately. Delegates draft from cards, and humans edit and endorse.
4. The engine decomposes: VALUE (adventure vs rest), INTEREST (Sam's budget cap €600), FACT (flight prices, which it marks "needs checking").
5. Restatement Gate: each person sees how the group's positions were summarized and accepts or corrects.
6. Understanding Map → options → private ranking → Agreement: "Lisbon, 4 nights, cap €600, Sam's flight subsidized 20% by the group." All five approve.
7. *Retention hook [v1]:* expenses get added to the Agreement during the trip.

### J2. Disagreement between two people [MVP]
Alice creates a Chamber, invites Bob, and both do intake. The protocol runs. Result: the Map plus discussion questions. They close as *Understood – still disagree*, then optionally publish an anonymized Map.

### J3. Solo sparring [MVP]
Dev enters a claim, picks Devil's Advocate plus the Empiricist methodology, defends through 5 rounds, ends with a "robustness report," and may publish it.

### J4. Couples (safety-gated) [v1]
As J2, plus: an individual safety screen at intake, private-only first pass, the safety exit always visible, and no Delegate autopilot.

## 6. Acceptance criteria (MVP-critical)

| ID | Criterion |
|---|---|
| AC1 | A new user can create a Delegate with ≥ 6 endorsed positions in under 5 minutes (median, in usability testing) |
| AC2 | An invitee can go from link to submitted position in under 4 minutes |
| AC3 | No shared view attributes content to a human unless it traces to an ENDORSED node (automated test over the scenario suite: 0 violations) |
| AC4 | No resolution option is visible before all restatements are accepted (enforced server-side, covered by a test) |
| AC5 | A Delegate in Chamber X can't retrieve positions scoped to Chamber Y (security test) |
| AC6 | Any participant can pause a Chamber, and the pause takes effect within 2 s for all clients |
| AC7 | Every Delegate message renders an AI label, an owner badge, and an epistemic status |
| AC8 | No Agreement reaches APPROVED without one explicit approval event from each participant |
| AC9 | Understanding Map generation completes in ≤ 60 s for a 5-person Chamber (p90) |
| AC10 | Publishing a Map requires consent from every participant. If one person revokes, it's unpublished. |
