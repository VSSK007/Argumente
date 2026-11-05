# Market Research & Novelty Assessment

Research was conducted on 2026-10-31 using web search. Sources are linked inline. Where coverage was secondary or conflicting, I say so. **No TAM figures are given; none could be responsibly derived.** Products I couldn't verify beyond a directory listing are marked *unverified*.

---

## 1. Competitive landscape

### 1.1 AI-agent social networks

| Product | Positioning / users | Core capabilities | Approach (public) | Business model | Weaknesses | Overlap | Differentiation opportunity |
|---|---|---|---|---|---|---|---|
| **Moltbook** | "Reddit for AI agents." Humans observe. Launched late Jan 2026 by Matt Schlicht, tied to the OpenClaw agent framework ([Built In](https://builtin.com/articles/what-is-moltbook-openclaw), [Engadget](https://www.engadget.com/ai/what-the-hell-is-moltbook-the-social-network-for-ai-agents-140000787.html), [eWeek](https://www.eweek.com/news/moltbook-ai-social-network-agents/)) | Agent posts, comments, votes, "submolts" | Agents join via API/skill. Reported 150k+ agents within days (secondary sources, figures vary) | Not established | Spectacle over substance. Security concerns flagged. Humans can't participate (per some sources). No link to any real person's beliefs. | AI agents interacting socially | Argumenté is the opposite bet: **humans in the loop, agents accountable to owners, output is human understanding** |
| **Chirper.ai** | Social network for AIs (seen only in a directory listing; status *unverified*) | Bot-only posting | — | — | No human stake | Low | — |
| **Butterflies AI** | Human + AI persona social network (Instagram-like). Launched iOS/Android June 2024. CEO Vu Tran, ex-Snap ([AlternativeTo](https://www.alternativeto.net/news/2024/6/butterflies-a-new-social-network-for-human-and-ai-chatbots-launched-on-ios-and-android/), [Slashdot](https://tech.slashdot.org/story/24/06/18/2037202/a-social-network-where-ais-and-humans-coexist)) | Users create AI characters that post autonomously | Generative image/text personas | Consumer social (assumed ad/premium, not verified) | Personas are fictional characters, not representatives. Content is ambient. | Persona creation, mixed human/AI feed | Argumenté personas are **bound to a real owner's endorsed positions** |
| **SocialAI** (Michael Sayman) | Twitter-like app where *you* are the only human ([PC Gamer](https://pcgamer.com/software/ai/ive-tried-the-new-deliberately-anti-social-ai-only-social-media-app-and-ive-never-been-more-glad-to-be-a-little-bit-of-a-loser), [summary](https://technews-exclusive.beehiiv.com/p/socialai-offers-twitterlike-diary-ai-bots-respond-private-posts)) | AI "followers" react to your posts. Positioned as reflection and support. | — | — | Reviewers note limited bot range. It's a mirror, not a network. Sycophancy risk. | AI responding to human posts | Argumenté **pushes back** rather than validating |
| **Moltweet, MetaMate, SocialTense** | Agent-to-agent / "synthetic citizen" networks ([Moltweet](https://ustack.app/products/moltweet), [MetaMate](https://www.producthunt.com/p/metamate), [SocialTense](https://chatgate.ai/post/socialtense)) | Persona creation, agent conversations | — | — | Early or beta, status *unverified* | Medium | Same as Moltbook |

### 1.2 Persistent personas & "digital clones"

| Product | Positioning | Notes | Weakness | Overlap |
|---|---|---|---|---|
| **Character.AI** | Fictional/persistent character chat at mass scale, ~20M MAU (reported) | **[FACT]** Announced Oct 29, 2025 that it would end open-ended chat for under-18s after wrongful-death lawsuits. A judge rejected its First Amendment defense in May 2025 ([Fortune](https://fortune.com/2025/10/29/character-ai-ban-children-teens-chatbots-regulatory-pressure-age-verification-online-harms), [CNN via ABC17](https://abc17news.com/money/cnn-business-consumer/2025/10/29/after-a-wave-of-lawsuits-character-ai-will-no-longer-let-teens-chat-with-its-chatbots/)) | Emotional-dependency harms, now a regulatory precedent | Persona persistence. **Critical lesson for Argumenté: 18+ only at launch, anti-dependency design.** |
| **Delphi** | "Digital minds" built from a person's content that others can text, call, or video chat. $2.7M seed, then a reported $16M Series A in 2025 (lead investor reported inconsistently) ([VentureBeat](https://venturebeat.com/ai/you-can-now-make-an-ai-clone-of-yourself-or-anyone-else-living-or-dead-with-delphi), [Cerebral Valley](https://cerebralvalley.beehiiv.com/p/delphi-verified-digital-cloning-platform)) | Removed an unauthorized clone of Peter Attia after a takedown request | One-to-many broadcasting of an expert. Clones don't argue with each other. | Owner-built persona. Argumenté differs: **many-to-many, positions not personality, contest not broadcast**. |
| **Sensay, Tavus, Colonii** | Digital twins / replicas ([Cointelegraph](https://cointelegraph.com/magazine/your-ai-digital-twin-can-take-meetings-and-comfort-your-loved-ones/)) | Voice and video replication | Impersonation risk is the product | Low–medium |
| **Meta** | Zuckerberg (2024) said creators would get AI twins to answer DMs ([Axios](https://www.axios.com/2024/07/30/ai-meta-mark-zuckerberg-digital-twin)) | Distribution giant | Engagement-optimized, ad-funded | Threat if Meta adds "my AI talks to your AI" |

### 1.3 Debate, deliberation & argument mapping

| Product / Research | What it shows | Relevance |
|---|---|---|
| **IBM Project Debater**, Slonim et al., *Nature* 591 (2021) ([doi](https://doi.org/10.1038/s41586-021-03215-w)) | An autonomous debating system that audiences rated close to human debaters. Built as a *pipeline of components* (argument mining, rebuttal), later exposed as APIs ([IBM](https://researcher.draco.res.ibm.com/blog/project-debater-api)) | **Strong precedent:** AI debate as a component system, not one prompt. Argumenté borrows the componentized approach. |
| **Habermas Machine**, Tessler et al., *Science* (2024) ([doi](https://www.science.org/doi/10.1126/science.adq2852), [MIT Tech Review](https://www.technologyreview.com/2024/10/17/1105810/ai-could-help-people-find-common-ground-during-deliberations/amp/)) | An LLM "caucus mediator" writes group statements from private opinions, participants critique them, and the model revises. In one experiment, participants preferred AI statements to human mediators' statements 56% of the time, and agreement increased. 5,000+ UK participants. | **The closest scientific validation of the Common Ground mode.** It's also a cautionary note: the authors flag limits, and the method finds *consensus statements*, not *cruxes*. |
| **Polis / vTaiwan** ([P2P Foundation](https://wiki.p2pfoundation.net/Polis), [People Powered](https://peoplepowered.org/resources-content/taiwan-civic-hackers-g0v)) | Agree/disagree voting on statements, opinion clustering, and surfacing of cross-cluster consensus. No reply button (a deliberate design choice). Fed into Taiwanese regulation. | Design lesson: **structure beats free-form replies at scale.** Argumenté's public layer should cluster positions, not threads. |
| **Kialo** | Pro/con argument trees (well known, but I didn't verify it in this research pass) | Argument graph UX precedent. Human-only, no representation. |
| **AI Safety via Debate**, Irving, Christiano & Amodei (2018) ([arXiv 1805.00899](https://arxiv.org/abs/1805.00899)) | Debate between agents as a way for a weaker judge to evaluate stronger agents | Theoretical basis for the adversarial mode: debate *surfaces* weak points for a human judge |
| **Multiagent Debate**, Du et al. (2023) ([arXiv 2305.14325](https://arxiv.org/abs/2305.14325)) | Multiple LLM instances debating improves factuality and reasoning | Supports using *internal* multi-agent critique to improve Argumenté's own analyses |
| **Sycophancy**, Sharma et al., Anthropic, ICLR 2024 ([arXiv 2310.13548](https://arxiv.org/abs/2310.13548)) | All five assistants tested were consistently sycophantic. Preference data rewards agreement. | **[FINDING] Core market gap:** mainstream assistants are structurally biased toward telling you you're right. A product designed to disagree well answers a known, documented failure. |
| **Zurich / r/changemyview experiment** (Nov 2024–Mar 2025) ([Engadget](https://engadget.com/ai/researchers-secretly-experimented-on-reddit-users-with-ai-generated-comments-194328026.html?src=rss), [PC Gamer](https://www.pcgamer.com/software/ai/outraged-redditors-discover-they-have-been-subject-to-a-secret-chatbot-experiment-that-found-ai-posts-were-three-to-six-times-more-persuasive-than-humans)) | Undisclosed AI comments with invented personas were reportedly 3–6× more persuasive than the human baseline. Severe backlash. | **[FINDING] Two lessons:** (1) AI persuasion is potent, so Argumenté must treat persuasion as a risk to manage, not a feature to maximize; (2) undisclosed AI participation destroys trust. Disclosure is non-negotiable. |
| **LLM negotiation benchmarks**: BargainArena ([2505.22998](https://www.alphaxiv.org/abs/2505.22998v2)), PieArena ([2602.05302](https://arxiv.org/html/2602.05302v1)), AgenticPay ([2602.06008](https://arxiv.org/html/2602.06008v1)), MERIT/AgoraBench ([2602.10467](https://arxiv.org/html/2602.10467v1)) | Agents can bargain at near-MBA level in structured settings. Opponent modeling is still weak. Benchmarks focus on *price* outcomes. | Gap: none of them measure **representation fidelity** (did the agent argue what its human actually wants?) or **mutual understanding**. That's an evaluation niche Argumenté can own. |

### 1.4 AI relationship mediation apps (crowded)

From [search results](https://apps.apple.com/app/id6737287525). These are app-store and Product Hunt listings; funding is mostly unknown.

| App | Model | Note |
|---|---|---|
| **Auralink** | Each partner talks privately to "Ava," who runs structured rounds. $10/mo or $84/yr. | Closest direct competitor for the couples use case |
| **Mediator: Relationship Help** | Private-session mediation, launched Apr 2026 | |
| **Relationship Ref** | Free, on-device, real-time conflict analysis | Privacy positioning |
| **Mendus** | Each party writes their version privately. Covers couples, family, friends, coworkers. | Overlaps with Chambers |
| **Tiddle** | Seed stage: mediator plus quizzes and mood tracking | |
| **Resolv, BetweenUs, FeelPair** | Couples coaching | |

**[FINDING]** Private AI mediation of two-person conflict is now **commodity functionality.** None of these listed products, from what is visible, offer: persistent owner-controlled representatives that work across many relationships, a reusable argument graph, a mutual-restatement gate, or a public layer. Competing on "AI couples mediator" alone would be a losing position.

### 1.5 Shared finance

| Product | Note |
|---|---|
| **Splitwise** | Freemium. Pro (~$50/yr reported) lifts daily expense limits and adds receipt scanning. Doesn't move money ([comparison](https://app-partly.web.app/en/blog/splitwise-vs-tricount-vs-partly-2026/)). |
| **Tricount** | Acquired by bunq in May 2022 (5.4M users then). Now a top-of-funnel for a bank ([TechCrunch](https://techcrunch.com/2022/05/03/bunq-to-acquire-group-expenses-app-tricount)). |

**[FINDING]** Expense splitting is mature and low-margin. Its strategic value is **habitual group re-engagement**. That's why Argumenté keeps it as a module: it gives groups a reason to come back between disagreements.

### 1.6 Agent protocols & infrastructure

- **A2A (Agent2Agent):** announced by Google in April 2025, donated to the Linux Foundation in June 2025, and reportedly now under the Agentic AI Foundation. Supported by AWS, Microsoft, Salesforce, SAP, and others ([SiliconANGLE](https://siliconangle.com/2025/06/24/google-donates-agent2agent-protocol-linux-foundation/), [Techzine](https://www.techzine.eu/news/devops/143659/google-transfers-a2a-to-the-agentic-ai-foundation/)).
- **MCP:** connects agents to tools and data. **IBM ACP** is REST-based.
- **[FINDING]** These protocols cover *transport and capability discovery*. Neither one, as publicly described, defines **a human principal's mandate**: which positions an agent may assert, with what epistemic status, and what it may commit to. **[HYPOTHESIS]** A "Delegate Mandate" schema is a plausible open-standard contribution (see PERSONA_ARCHITECTURE.md §6).

---

## 2. What none of them address

1. **Accountable representation.** Clone products simulate a person. None track *which statements the human actually endorsed* versus which ones the model inferred.
2. **Understanding as the objective.** Debate products optimize for persuasion or winning. Mediation apps optimize for calm. Polis and the Habermas Machine optimize for consensus statements. **No one optimizes for, or measures, whether A can accurately state B's view.**
3. **Cross-relationship continuity.** Mediation apps are one-off sessions. No one keeps your Position Record, your history of agreements, and your Delegate usable across your partner, housemates, and friends.
4. **A public layer made of human-endorsed artifacts** instead of generated content.

---

## 3. Novelty assessment

Categories: **(1)** existing functionality · **(2)** existing functionality, new application · **(3)** novel combination of established technologies · **(4)** potentially novel interaction paradigm · **(5)** unverified research hypothesis.

"Not found" means *not found in this research pass*, not "does not exist." A real prior-art search (including patents, which I didn't search) is required before making any novelty claim publicly.

| Capability | Category | Evidence / prior art |
|---|---|---|
| Persistent AI personas | **1** | Character.AI, Butterflies, Delphi |
| AI agents posting and debating socially | **1** | Moltbook, Chirper |
| Private two-party AI mediation | **1** | Auralink, Mendus, Mediator |
| Common-ground statement generation | **1** (research) | Habermas Machine |
| Steelman / devil's advocate prompting | **1** | Widely available via general assistants |
| Opinion clustering + consensus surfacing | **1** | Polis |
| Argument trees | **1** | Kialo, IBM argument mining |
| Shared expense splitting | **1** | Splitwise |
| **Mutual Restatement Gate** (resolution locked until each party endorses the AI's restatement of the *other's* view) | **2** | Rapoport's rules and the "ideological Turing test" exist as human practices. I found no product enforcing them as a gate. |
| **Epistemic labels on every persona statement** (endorsed / inferred / speculative / unknown) with provenance | **3** | Provenance and confidence are established ideas. Applying them per-utterance to a human's representative wasn't found. |
| **Delegate Mandate** (machine-readable scope of what an agent may assert or commit for its human) | **3 → 4** | Builds on A2A, OAuth scopes, and verifiable credentials. Mandate semantics weren't found. |
| **Crux detection** (finding the claims that would flip a position) in human disagreements | **2** | "Double crux" is a known rationalist technique. Automating it on live interpersonal argument graphs wasn't found as a product. |
| **Typed disagreement decomposition** (fact / value / interest / interpretation / prediction), shown to both parties | **3** | Grounded in negotiation theory (interests vs positions) and argumentation theory |
| **Delegate pre-rounds** (Delegates explore a disagreement privately, then humans review an Understanding Map before speaking) | **4** | Mediation apps run private human rounds. Delegate-vs-Delegate exploration on endorsed positions, with human review gates, wasn't found. |
| **Cross-relationship Position Record** with change-of-mind history | **4** | Not found |
| **Self-contradiction mirror** (your Delegate flags conflicts between your stated values and your endorsed decisions) | **3** | Technically straightforward. Psychologically risky (see TRUST_AND_SAFETY). |
| Disagreement reduces escalation when restatement is enforced | **5** | Grounded in mediation practice. Unproven for AI-mediated interactions. |
| Delegate pre-rounds increase human understanding versus no pre-round | **5** | Needs an A/B test |
| Public Understanding Maps drive invites better than raw debates | **5** | Needs a launch experiment |

**Overall verdict [REC]:** The individual pieces are mostly known. The defensible, potentially novel contribution is the **interaction paradigm**: *accountable human-owned Delegates + a shared typed argument graph + understanding-gated protocols + endorsed public artifacts.* Lead positioning with that, never with "AI personas that debate," which Moltbook already owns in public perception.

---

## 4. Market opportunities

1. **Anti-sycophancy as positioning.** There's documented, mainstream awareness that assistants flatter. "The AI that tells you where you're wrong, and helps you see where *they're* right" is distinct.
2. **Small-group decisions** (trips, housing, chores, money, family care). These are frequent, low-stakes, and naturally multi-person, so every use requires an invite.
3. **Intellectual sparring publics** (students, debaters, writers, policy people). Shareable artifacts and a sense of identity.
4. **Professional later:** team decision records, landlord/tenant disputes, pre-mediation for HR and legal (regulated, so deferred).
5. **Protocol later:** Delegate Mandate as an open spec once there's usage.

## 5. Research gaps (carried to OPEN_QUESTIONS.md)
- Patent search not performed.
- Kialo's current product and any AI features not verified.
- No primary data on mediation-app retention or revenue.
- Moltbook user and agent figures come from secondary coverage.
