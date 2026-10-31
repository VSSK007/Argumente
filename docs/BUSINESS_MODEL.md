# Business Model, Distribution & Network Effects

No TAM or revenue projections are given. There's no responsible basis for them yet. This document defines *how* value is captured and *what to measure* so projections can be made later from real data.

---

## 1. Which use case leads the launch?

| Motivation | Example | Acquisition | Retention | Network effect | Risk |
|---|---|---|---|---|---|
| 1. Entertainment | AI-vs-AI debates | High spike | Low (novelty decays, see the Moltbook dynamic) | Weak (spectators) | Slop, hostility |
| 2. Intellectual engagement | Sparring, public Maps | Medium | Medium (identity-driven) | Medium (reputation) | Niche |
| 3. Practical coordination | Group decisions, households, trips | Medium | Medium–high | **Strong: every use requires invites** | Competes with the group chat |
| 4. Relationships depend on it | Agreements, shared records, expenses | Low initially | **Highest** (switching cost = shared history) | Strongest (multi-party data) | Takes time |

**[REC] Lead with #3, small-group decisions and disagreements (2–8 people). Use #2 as the public distribution surface, and grow into #4 through Agreements.** Couples are a v1 template, not the headline (safety, a crowded field, and a two-person graph).

Why #3 leads: **[HYPOTHESIS]** a Chamber is useless alone, so *every activation produces 1–7 invites to people who already know the inviter*. That's a referral with built-in context ("Priya needs your view on the trip"). It's the same structural virality that made group expense apps spread, with a broader trigger.

## 2. The network effect, precisely

1. **Direct (per-Chamber) loop:** create → invite → join (a Delegate is made at join) → each new user now has a Delegate and will start their own Chambers with *their* groups. The key metric is the **K-factor = invites accepted per creator × share of joiners who later create a Chamber.**
2. **Relationship data loop:** shared Agreements and history make the *pair or group* more valuable on Argumenté over time.
3. **Delegate loop [v1]:** Delegates with rich endorsed positions are more useful. They can join a Chamber at L1 quickly, enter Rehearsal Rooms, and answer Group Proxy Votes. Users invest in their Delegate because others interact with it.
4. **Public artifact loop:** published Maps → observers → "Spar this" or "Start a Chamber like this" → creators. Maps are SEO- and share-friendly (OG images of the Map headline and cruxes).

Avoided on purpose: autonomous Delegate posting to drive "activity," streaks, follower counts as the primary status signal, and outrage-ranked feeds.

## 3. Distribution plan

- **Seed via group chats:** the invite link preview *is* the product ("5 friends, 1 question: where do we go in March?"). Design the OG card carefully.
- **Template content:** "Disagreement kits" for common fights (chores, splitting rent, holidays with family, trip budget).
- **Communities:** university debate societies, rationalist and "changemyview"-adjacent communities (with full disclosure, given the Zurich lesson), writing communities. Spar plus public Maps.
- **Creators:** public intellectuals publishing endorsed Maps with an opponent. "Steelman each other on Argumenté" as a format.
- **Not at launch:** paid acquisition (no unit economics yet).

## 4. Monetization

| Tier | Price [ASSUMPTION, to test] | Includes | Rationale |
|---|---|---|---|
| **Free** | — | A Delegate, unlimited Chamber *joins*, 3 active Chambers created per month, Understanding Maps, basic Agreements, Spar (limited rounds), publishing | **Everything that drives invites stays free.** Joining is never paywalled. |
| **Plus** (individual) | ~$6–10/mo | Unlimited Chambers, Delegate pre-rounds, advanced modes (Resolution Architect, Common Ground loop, Perspective Switch), Decision Replay, deeper Spar, Position Record analytics | Power users and sparring minds |
| **Household / Group** | ~$10–15/mo per group | Shared Agreements with expenses, responsibilities, a group "Disagreement Weather," all members get Plus features *inside* the group | Monetizes motivation #4. One payer, many beneficiaries. |
| **Pro / Teams** [Later] | per seat | Team decision records, facilitator tools, SSO, retention controls | B2B expansion |
| **API / Protocol** [Later] | usage | Mandate-verified Delegate interactions, AI² analysis API | Infrastructure ambition |

**Never:** ads, selling or sharing conversation data, "boost your Delegate's reach," paywalling the gate or safety features, charging per invitee.

**Unit economics to watch:** `LLM $ per completed Map` versus ARPU. **[ASSUMPTION]** A Map costs low cents to tens of cents with routing. Must be measured in week 1.

## 5. Competitive positioning

> **Argumenté is where people take a disagreement when they care about getting it right, and about each other.**

- vs **Moltbook / AI social networks:** we're about humans understanding humans. Agents are accountable delegates, not the show.
- vs **mediation apps:** persistent across relationships, multi-party, a shared argument graph, agreements, a public layer.
- vs **general assistants (ChatGPT/Claude/Gemini):** they talk to one person and lean sycophantic (Sharma et al. 2024). We're multi-party by construction, with fairness checks.
- vs **Splitwise:** we handle the *why* and *what we agreed*, not just the *how much*.
- vs **Polis / Habermas Machine:** we bring deliberation tech to private, small-group, everyday life.

## 6. Defensibility (ranked by realism)

1. **Relationship data and agreements** (switching costs for groups).
2. **Delegates with endorsed position histories** (user-invested, portable *by us* through export, but most useful where your contacts are).
3. **Evaluation datasets and protocols** (fidelity, crux, balance). These are hard to copy well.
4. **Brand trust** in a category where incumbents have trust problems.
5. **The Mandate standard**, if it's adopted.

Weak moats: prompts, UI, model access. Assume the platforms (Meta, OpenAI) could ship "group mediation" at any time. The response is to be *the trusted, neutral place* rather than an engagement platform.
