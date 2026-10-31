"""Offline Argumentative Intelligence engine.

Deterministic heuristics, no network, no API key. It is deliberately conservative: it quotes
people's own words rather than paraphrasing, so it can never put words in anyone's mouth.
Quality is far below the LLM provider, but the whole protocol works end to end.
"""

import re

from .types import (
    CruxCandidate,
    Decomposition,
    Disagreement,
    DraftOut,
    ExtractedClaim,
    MapDifference,
    MapOut,
    OptionOut,
    OptionsOut,
    Party,
    PartyNote,
    ReplyOut,
    RestatementOut,
    SparReport,
    SparTurnOut,
)

NAME = "local"

# Value lexicon: theme -> trigger words. Used to find shared and differing priorities.
THEMES: dict[str, list[str]] = {
    "cost and money": ["money", "budget", "afford", "cost", "cheap", "expensive", "price", "pay", "spend", "€", "$", "£", "rent", "income", "save"],
    "fairness": ["fair", "equal", "unfair", "share", "split", "deserve", "everyone"],
    "rest and wellbeing": ["rest", "relax", "tired", "exhausted", "calm", "health", "sleep", "stress", "burnout"],
    "adventure and novelty": ["adventure", "new", "explore", "exciting", "experience", "hike", "discover"],
    "time": ["time", "busy", "schedule", "hours", "weekend", "late", "early", "deadline"],
    "recognition and effort": ["effort", "work", "contribute", "notice", "appreciate", "recognised", "recognized", "hard"],
    "connection and attention": ["attention", "together", "listen", "connect", "close", "care", "lonely", "present"],
    "freedom and autonomy": ["freedom", "choose", "control", "independent", "my own", "space", "decide"],
    "responsibility": ["responsible", "chores", "clean", "duty", "reliable", "promise", "commit"],
    "convenience": ["easy", "convenient", "close by", "nearby", "simple", "quick", "hassle"],
    "honesty and trust": ["honest", "trust", "truth", "lie", "transparent", "open"],
    "travel": ["trip", "holiday", "travel", "vacation", "getaway"],
    "family": ["family", "kids", "children", "parents", "mum", "mom", "dad", "sister", "brother"],
}

WHY_TYPE = {
    "FACT": "This could be settled by checking evidence together.",
    "VALUE": "This is a difference in priorities. More facts alone won't resolve it; a trade-off or a rule you both accept might.",
    "INTEREST": "Different people have different stakes here. Options that serve both stakes beat arguing about who is right.",
    "INTERPRETATION": "You may agree on what happened but read different meanings into it. Comparing interpretations helps more than debating events.",
    "PREDICTION": "You expect different outcomes. Agreeing on how you'd find out, or trying it for a while, can resolve it.",
    "DEFINITION": "You may be using the same word to mean different things. Agreeing on terms comes first.",
}

STOPWORDS = {
    "should", "would", "could", "what", "where", "when", "which", "this", "that", "there", "their", "they", "them",
    "with", "from", "have", "about", "into", "more", "most", "some", "than", "then", "your", "ours", "make", "want",
    "think", "much", "many", "just", "like", "does", "doesn't", "will", "been", "being", "were", "each", "every",
}

_SENT = re.compile(r"(?<=[.!?])\s+|\n+")


def sentences(text: str) -> list[str]:
    out = [s.strip(" -•\t") for s in _SENT.split(text or "")]
    return [s for s in out if len(s) > 3]


def classify(s: str) -> str:
    low = s.lower()
    if re.search(r"\b(i mean|by .{1,30} i mean|define|definition|counts as)\b", low) or re.match(r"^[\w ]{1,20} means\b", low):
        return "DEFINITION"
    if re.search(r"\b(will|going to|would lead|likely|probably|end up|risk)\b", low):
        return "PREDICTION"
    if re.search(r"\b(feel|feels|felt|seems|means that|shows that|ignore|doesn't care|don't care|never|always|enough)\b", low):
        return "INTERPRETATION"
    if _interest(s):
        return "VALUE"
    if re.search(r"\b(we should|let's|i propose|i suggest|we could|we need to)\b", low):
        return "POLICY"
    if re.search(r"\b(should|fair|unfair|important|matters|deserve|right|wrong|better|worse|prefer)\b", low):
        return "VALUE"
    return "FACT"


def themes_of(text: str) -> set[str]:
    low = (text or "").lower()
    return {t for t, words in THEMES.items() if any(w in low for w in words)}


def _lower_first(s: str) -> str:
    return s[:1].lower() + s[1:] if s and not s[:2].isupper() else s


def _strip_end(s: str) -> str:
    return s.rstrip(" .!?")


def _reason(s: str) -> str | None:
    m = re.search(r"\b(because|since|as|so that)\b(.+)", s, flags=re.I)
    if m and len(m.group(2).strip()) > 6:
        return _strip_end(m.group(2).strip())
    return None


def _interest(s: str) -> bool:
    return bool(re.search(r"\b(i need|i (really )?want|for me|i can't|i cannot|i'd like|matters to me|i care|my budget|i'm worried|i worry)\b", s, re.I))


class LocalEngine:
    name = NAME

    # ---------------- decompose ----------------
    def decompose(self, question: str, parties: list[Party]) -> Decomposition:
        claims: list[ExtractedClaim] = []
        assumptions: list[PartyNote] = []
        interests: list[PartyNote] = []
        cruxes: list[CruxCandidate] = []
        party_themes: dict[str, set[str]] = {}

        for p in parties:
            sents = sentences(p.text)
            party_themes[p.party_id] = themes_of(p.text)
            for s in sents[:8]:
                claims.append(ExtractedClaim(party_id=p.party_id, text=s, claim_type=classify(s)))
                if _interest(s):
                    interests.append(PartyNote(party_id=p.party_id, text=s))
            reasons = [(s, _reason(s)) for s in sents]
            reasons = [(s, r) for s, r in reasons if r]
            for s, r in reasons[:2]:
                assumptions.append(
                    PartyNote(
                        party_id=p.party_id,
                        text=f"Treats “{r}” as a deciding reason, which assumes it outweighs the other considerations raised.",
                    )
                )
            if reasons:
                r = reasons[0][1]
                cruxes.append(
                    CruxCandidate(
                        party_id=p.party_id,
                        text=f"{r[:1].upper()}{r[1:]}.",
                        question=f"If it turned out that “{r}” wasn't really the case, would you still hold your position?",
                    )
                )
            elif sents:
                first = _strip_end(sents[0])
                cruxes.append(
                    CruxCandidate(
                        party_id=p.party_id,
                        text=f"{first}.",
                        question="What would you need to see or hear to change your mind on this?",
                    )
                )
            if not any(i.party_id == p.party_id for i in interests) and party_themes[p.party_id]:
                theme = sorted(party_themes[p.party_id])[0]
                interests.append(PartyNote(party_id=p.party_id, text=f"Appears to care about {theme} (inferred from wording)."))

        all_ids = [p.party_id for p in parties]
        shared_themes = set.intersection(*party_themes.values()) if party_themes else set()
        shared_values = [f"Everyone raised {t}." for t in sorted(shared_themes)]
        labels = {p.party_id: p.label for p in parties}

        disagreements: list[Disagreement] = []
        # VALUE: themes emphasized by some parties but not others
        emphasis = {pid: themes - shared_themes for pid, themes in party_themes.items()}
        if len([pid for pid, t in emphasis.items() if t]) >= 2:
            parts = [f"{labels[pid]} emphasizes {', '.join(sorted(t))}" for pid, t in emphasis.items() if t]
            disagreements.append(
                Disagreement(type="VALUE", summary="; ".join(parts) + ".", party_ids=[pid for pid, t in emphasis.items() if t])
            )
        # FACT: several parties make factual claims with numbers
        numeric = {c.party_id for c in claims if re.search(r"\d", c.text) and c.claim_type == "FACT"}
        if len(numeric) >= 2:
            disagreements.append(
                Disagreement(
                    type="FACT",
                    summary="Different figures or facts are being relied on; they may need checking together.",
                    party_ids=sorted(numeric),
                )
            )
        # INTERPRETATION
        interp = {c.party_id for c in claims if c.claim_type == "INTERPRETATION"}
        if interp:
            who = " and ".join(labels[i] for i in sorted(interp))
            disagreements.append(
                Disagreement(
                    type="INTERPRETATION",
                    summary=f"{who} describe{'s' if len(interp) == 1 else ''} what things mean, not only what happened; others may read the same events differently.",
                    party_ids=sorted(interp),
                )
            )
        # INTEREST
        ints = {i.party_id for i in interests}
        if len(ints) >= 2:
            disagreements.append(
                Disagreement(
                    type="INTEREST",
                    summary="Each person has a different stake: " + "; ".join(
                        f"{labels[i.party_id]}: {_strip_end(i.text)}" for i in interests[:4]
                    ) + ".",
                    party_ids=sorted(ints),
                )
            )
        # VALUE (fallback): several people make normative claims that don't share a theme-level emphasis
        if not any(d.type == "VALUE" for d in disagreements):
            normative = {}
            for c in claims:
                if c.claim_type in ("VALUE", "POLICY") and c.party_id not in normative:
                    normative[c.party_id] = c.text
            if len(normative) >= 2:
                disagreements.append(
                    Disagreement(
                        type="VALUE",
                        summary="Different views on what should happen: "
                        + "; ".join(f"{labels[pid]}: \u201c{_strip_end(t)}\u201d" for pid, t in normative.items())
                        + ".",
                        party_ids=sorted(normative),
                    )
                )
        # FACT (evidence): someone appeals to data that others could check
        if not any(d.type == "FACT" for d in disagreements):
            evid = {c.party_id for c in claims if re.search(r"\b(data|evidence|study|studies|shows|statistic|survey|\d+%)", c.text, re.I)}
            if evid:
                who = " and ".join(labels[i] for i in sorted(evid))
                disagreements.append(
                    Disagreement(
                        type="FACT",
                        summary=f"{who} point{'s' if len(evid) == 1 else ''} to evidence that the group could look at together.",
                        party_ids=sorted(evid),
                    )
                )
        # DEFINITION
        defs = {c.party_id for c in claims if c.claim_type == "DEFINITION"}
        if defs:
            disagreements.append(
                Disagreement(
                    type="DEFINITION",
                    summary="At least one key word is being defined explicitly; others may mean something different by it.",
                    party_ids=sorted(defs),
                )
            )
        # PREDICTION
        pred = {c.party_id for c in claims if c.claim_type == "PREDICTION"}
        if pred:
            disagreements.append(
                Disagreement(
                    type="PREDICTION",
                    summary="Some of the disagreement is about what will happen, which could be tested.",
                    party_ids=sorted(pred),
                )
            )
        if not disagreements and len(all_ids) >= 2:
            disagreements.append(
                Disagreement(
                    type="VALUE",
                    summary="The positions differ, but the offline engine could not tell why. Restatements will help.",
                    party_ids=all_ids,
                )
            )
        return Decomposition(
            claims=claims,
            assumptions=assumptions,
            interests=interests,
            shared_values=shared_values,
            disagreements=disagreements,
            cruxes=cruxes,
        )

    # ---------------- restatement ----------------
    def restate(self, question: str, party: Party, claims: list[str], previous: str | None = None, feedback: str | None = None) -> RestatementOut:
        sents = claims or sentences(party.text)
        if not sents:
            return RestatementOut(text=f"{party.label} hasn't stated a position yet.")
        main = _strip_end(sents[0])
        parts = [f"{party.label}'s position, in their words: “{main}.”"]
        reasons = [r for r in (_reason(s) for s in sents) if r]
        if reasons:
            parts.append("Their main reason: " + "; ".join(f"“{r}”" for r in reasons[:2]) + ".")
        elif len(sents) > 1:
            parts.append(f"They add: “{_strip_end(sents[1])}.”")
        interest = next((s for s in sents if _interest(s)), None)
        if interest and _strip_end(interest) != main:
            parts.append(f"What matters to them: “{_strip_end(interest)}.”")
        if feedback:
            parts.append(f"{party.label} clarified: “{_strip_end(feedback)}.”")
        return RestatementOut(text=" ".join(parts))

    # ---------------- map ----------------
    def render_map(self, question: str, parties: list[Party], decomposition: Decomposition) -> MapOut:
        n = len(parties)
        types = sorted({d.type for d in decomposition.disagreements})
        summary = (
            f"{n} people weighed in. The differences look mostly like "
            + (", ".join(t.lower() for t in types) if types else "open")
            + " disagreements"
            + (", with some shared ground." if decomposition.shared_values else ", with little explicit shared ground yet.")
        )
        diffs = [MapDifference(type=d.type, summary=d.summary, why_type_matters=WHY_TYPE[d.type]) for d in decomposition.disagreements]
        qs = []
        for d in decomposition.disagreements[:3]:
            if d.type == "VALUE":
                qs.append("Which of these priorities should win when they conflict, and is there a rule you'd all accept?")
            elif d.type == "FACT":
                qs.append("Which facts could you check together before deciding?")
            elif d.type == "INTEREST":
                qs.append("Is there an option that protects each person's main stake, even if it isn't anyone's first choice?")
            elif d.type == "INTERPRETATION":
                qs.append("What did each of you take that to mean, and what did the other person intend?")
            elif d.type == "PREDICTION":
                qs.append("How would you find out who's right? Could you try it for a while and review?")
        qs.append("What would each of you need to hear from the others to feel understood?")
        return MapOut(
            headline=question.strip().rstrip("?") + "?",
            summary=summary,
            shared=decomposition.shared_values or ["No shared priorities were stated explicitly. Worth naming some together."],
            differences=diffs,
            open_questions=list(dict.fromkeys(qs))[:5],
        )

    # ---------------- options ----------------
    def options(self, question: str, parties: list[Party], decomposition: Decomposition) -> OptionsOut:
        labels = [p.label for p in parties]
        opts = [
            OptionOut(
                title="Protect each person's main stake",
                description="Write down the one thing each person most needs from the outcome, then pick the option that keeps all of those intact, even if it's no one's favourite.",
                serves=labels,
                trade_offs="Rarely anyone's first choice; needs everyone to name a single priority.",
            ),
            OptionOut(
                title="Try it, then review",
                description="Pick one approach for a fixed period, agree in advance what you'll look at, and revisit together.",
                serves=labels,
                trade_offs="Someone goes first; needs a clear review date.",
            ),
            OptionOut(
                title="Agree a rule, not a winner",
                description="Instead of settling this case, agree a rule for cases like it (alternate, weight by stake, or a budget cap) that you'd accept whichever way it falls.",
                serves=labels,
                trade_offs="Takes longer now; saves the same argument next time.",
            ),
        ]
        return OptionsOut(options=opts)

    # ---------------- delegate draft ----------------
    def draft_position(self, question: str, owner_name: str, positions: list[dict], voice: str = "first") -> DraftOut:
        q_themes = themes_of(question)
        q_words = {w for w in re.findall(r"[a-z']{4,}", question.lower())} - STOPWORDS
        scored = []
        for p in positions:
            st = p["statement"]
            score = len(themes_of(st) & q_themes) * 2 + len(q_words & (set(re.findall(r"[a-z']{4,}", st.lower())) - STOPWORDS))
            scored.append((score, p))
        scored.sort(key=lambda x: -x[0])
        relevant = [p for s, p in scored if s > 0][:3]
        if not relevant:
            return DraftOut(
                text="",
                used_position_ids=[],
                unknowns=[f"I don't know what {owner_name} thinks about this yet. None of their endorsed positions cover it, so please write it yourself."],
            )
        lines = []
        third = voice == "third"
        for p in relevant:
            stance = p.get("stance")
            st = _strip_end(p["statement"])
            why = ""
            if third and ". Why: " in st:
                st, reason = st.split(". Why: ", 1)
                why = f" (in their words: \u201c{_strip_end(reason)}\u201d)"
            if third:
                st = st + why
            if stance == "disagree":
                lines.append(f"{owner_name} doesn't agree that {_lower_first(st)}." if third else f"I don't agree that {_lower_first(st)}.")
            elif stance == "depends":
                lines.append(f"For {owner_name}, it depends whether {_lower_first(st)}." if third else f"It depends for me whether {_lower_first(st)}.")
            else:
                lines.append(f"{owner_name} holds that {_lower_first(st)}." if third else f"{st}.")
        return DraftOut(
            text=" ".join(lines),
            used_position_ids=[p["id"] for p in relevant],
            unknowns=["How strongly you feel about this specific case", "Anything specific to this situation"],
        )

    def delegate_reply(self, question: str, owner_name: str, positions: list[dict], own_opening: str, others: list) -> ReplyOut:
        """Reply to other Delegates' released openings, using only the owner's endorsed positions."""

        def words(t: str) -> set[str]:
            return set(re.findall(r"[a-z']{4,}", t.lower())) - STOPWORDS

        # Prefer the owner's endorsed positions; fall back to the opening they released.
        sources = positions or ([{"statement": own_opening, "stance": None}] if own_opening.strip() else [])
        parts, unknowns = [], []
        for o in others:
            first = _strip_end(sentences(o.text)[0]) if sentences(o.text) else _strip_end(o.text)
            scored = []
            for p in sources:
                score = len(words(p["statement"]) & words(o.text)) + 2 * len(themes_of(p["statement"]) & themes_of(o.text))
                if score > 0:
                    scored.append((score, p))
            scored.sort(key=lambda x: -x[0])
            if not scored:
                parts.append(f"On {o.label}'s view (\u201c{first}\u201d), {owner_name} hasn't told me what they think. I'd need to ask them.")
                unknowns.append(f"Your view on {o.label}'s point: \u201c{first}\u201d")
                continue
            views = []
            for _, p in scored[:2]:
                st = _strip_end(sentences(p["statement"])[0] if sentences(p["statement"]) else p["statement"])
                if p.get("stance") == "disagree":
                    views.append(f"{owner_name} has said they don't agree that {_lower_first(st)}")
                else:
                    views.append(f"{owner_name} has endorsed \u201c{st}\u201d")
            parts.append(f"On {o.label}'s view (\u201c{first}\u201d): " + "; and ".join(views) + ".")
        return ReplyOut(text=" ".join(parts), unknowns=unknowns)

    # ---------------- spar ----------------
    def spar_turn(self, claim: str, history: list[dict], mode: str, methodology: str) -> SparTurnOut:
        rnd = len([t for t in history if t["role"] == "opponent"])
        claim_core = _strip_end(claim)
        last_user = next((t["text"] for t in reversed(history) if t["role"] == "user"), claim)
        reason = _reason(last_user) or _reason(claim)
        if mode == "steelman":
            prompts = [
                f"Here is the strongest case against “{claim_core}”: someone who disagrees would say it ignores the people for whom the opposite is true, and that the costs fall unevenly. Which part of that would a thoughtful opponent find most convincing?",
                "Now state the opposing view in a way its best defender would sign off on. What is it actually protecting?",
                "Where does the opposing view have better evidence than yours?",
                "What would you concede to someone holding that view, without giving up your position?",
                "If you had to argue their side in public tomorrow, what would your opening line be?",
            ]
            return SparTurnOut(challenge=prompts[min(rnd, len(prompts) - 1)], attack_type="steelman")
        by_method = {
            "socratic": [
                f"What do you mean, precisely, by the key terms in “{claim_core}”?",
                "How would you know if you were wrong about this?",
                "Is that true in every case, or only some? Which cases are the exceptions?",
                "What follows if we accept your position fully, including the parts you might not like?",
                "Which of your premises are you least sure of?",
            ],
            "empiricist": [
                "What's the best evidence for this, and how good is it?",
                "Is there a counterexample you've seen or heard of?",
                "Could the pattern you're relying on be explained by something else?",
                "What result would change your mind?",
                "How big is the effect you're claiming, roughly?",
            ],
            "pragmatist": [
                "Suppose you're right. What actually changes in practice, and who has to do it?",
                "What does it cost, and who pays?",
                "What's the most likely way this goes wrong when real people try it?",
                "Is there a cheaper way to get most of the benefit?",
                "What would you do if half the people involved refused?",
            ],
            "principled": [
                "Which principle is doing the work here, and do you apply it consistently?",
                "Whose rights or interests does this position set aside?",
                "Would you accept the same rule if you were on the losing side of it?",
                "Is there a principle on the other side that's just as strong?",
                "Where would you draw the line, and why there?",
            ],
            "contrarian": [
                f"I'll take the opposite: “{claim_core}” is wrong. Convince me otherwise.",
                "That's what most people think. Why isn't the popular view just a habit?",
                "Your strongest point is also your weakest. What happens if it's reversed?",
                "Name the best person who disagrees with you. What do they know that you don't?",
                "If you're right, why hasn't everyone already done this?",
            ],
        }
        qs = by_method.get(methodology, by_method["socratic"])
        challenge = qs[min(rnd, len(qs) - 1)]
        if reason and rnd in (1, 3):
            challenge = f"You lean on “{reason}”. Is that enough on its own? " + challenge
            return SparTurnOut(challenge=challenge, attack_type="undercut")
        return SparTurnOut(challenge=challenge, attack_type="question" if methodology == "socratic" else "rebut")

    def spar_report(self, claim: str, history: list[dict]) -> SparReport:
        user_turns = [t["text"] for t in history if t["role"] == "user"][1:]
        concessions = sum(bool(re.search(r"\b(fair point|you're right|i concede|good point|agree|maybe|true)\b", t, re.I)) for t in user_turns)
        avg = sum(len(t) for t in user_turns) / len(user_turns) if user_turns else 0
        if not user_turns:
            verdict = "open"
        elif concessions >= 2:
            verdict = "revised"
        elif avg > 120:
            verdict = "robust"
        else:
            verdict = "open"
        opp = [t["text"] for t in history if t["role"] == "opponent"]
        return SparReport(
            verdict=verdict,
            strongest_objection=opp[1] if len(opp) > 1 else (opp[0] if opp else "None raised yet."),
            how_you_responded=(
                f"You answered {len(user_turns)} challenge(s)"
                + (f" and conceded {concessions} point(s)" if concessions else "")
                + ". "
                + ("Your answers were detailed." if avg > 120 else "Several answers were short. Try spelling out your reasons.")
            ),
            what_to_strengthen=[
                "State the evidence that would change your mind.",
                "Name the strongest version of the opposing view.",
                "Separate the factual parts of your claim from the value parts.",
            ],
        )
