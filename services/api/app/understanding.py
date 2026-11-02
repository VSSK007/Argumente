"""Making understanding visible: Steelman Exchange, Understanding Score, evidence board, Position Record.

All deterministic, no model calls: people do the judging, the app does the bookkeeping.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Chamber, Evidence, Membership, MindChange, Node, Prediction, QuizAnswer, QuizItem, Steelman, User

ACCEPTED = 4  # a steelman rated 4 or 5 by its subject is "accepted"
OPINION_TYPES = ("VALUE", "POLICY", "PREDICTION", "INTERPRETATION", "DEFINITION")
MAX_ITEMS = 6
PER_PERSON = 2

STEELMAN_STATES = ("RESTATEMENT", "MAPPING", "MAP", "OPTIONS_PENDING", "RESOLUTION", "CLOSED")


# ------------------------------------------------------------------------------------- quiz items
def make_quiz_items(db: Session, ch: Chamber):
    """Pick up to two endorsed, verbatim opinion claims per person (shown without names)."""
    for row in db.scalars(select(QuizItem).where(QuizItem.chamber_id == ch.id)):
        db.delete(row)
    claims = list(
        db.scalars(select(Node).where(Node.chamber_id == ch.id, Node.kind == "CLAIM", Node.epistemic_status == "ENDORSED"))
    )
    by_holder: dict[str, list[Node]] = {}
    for n in claims:
        by_holder.setdefault(n.holder_id, []).append(n)
    ranked = {
        h: sorted([n for n in ns if 12 <= len(n.text) <= 220], key=lambda n: n.claim_type not in OPINION_TYPES)[:PER_PERSON]
        for h, ns in by_holder.items()
    }
    # Interleave people so the items aren't grouped by who said them.
    picked = [ranked[h][r] for r in range(PER_PERSON) for h in ranked if r < len(ranked[h])]
    for i, n in enumerate(picked[:MAX_ITEMS]):
        db.add(QuizItem(chamber_id=ch.id, text=n.text.strip(), node_id=n.id, position=i))


def _members(db: Session, ch: Chamber) -> list[Membership]:
    return list(db.scalars(select(Membership).where(Membership.chamber_id == ch.id).order_by(Membership.joined_at)))


def quiz_view(db: Session, ch: Chamber, me: User) -> dict:
    items = list(db.scalars(select(QuizItem).where(QuizItem.chamber_id == ch.id).order_by(QuizItem.position)))
    if not items:
        return {"items": [], "status": "none"}
    mems = _members(db, ch)
    names = {m.user_id: m.user.name for m in mems}
    answers = list(db.scalars(select(QuizAnswer).where(QuizAnswer.chamber_id == ch.id)))
    selfs: dict[str, dict[str, str]] = {}
    guesses: dict[tuple[str, str, str], dict[str, str]] = {}  # (phase, respondent, about) -> item -> answer
    for a in answers:
        if a.phase == "self":
            selfs.setdefault(a.respondent_id, {})[a.item_id] = a.answer
        else:
            guesses.setdefault((a.phase, a.respondent_id, a.about_id), {})[a.item_id] = a.answer

    def score(phase: str, respondent: str, about: str) -> float | None:
        g = guesses.get((phase, respondent, about))
        truth = selfs.get(about)
        if not g or not truth:
            return None
        scored = [i for i in g if truth.get(i) in ("agree", "disagree")]
        if not scored:
            return None
        return round(sum(g[i] == truth[i] for i in scored) / len(scored), 2)

    others = [m.user_id for m in mems if m.user_id != me.id]
    mine = []
    for o in others:
        mine.append({"about_id": o, "about_name": names[o], "pre": score("pre", me.id, o), "post": score("post", me.id, o)})

    def group(phase: str) -> float | None:
        vals = [score(phase, a.user_id, b.user_id) for a in mems for b in mems if a.user_id != b.user_id]
        vals = [v for v in vals if v is not None]
        return round(sum(vals) / len(vals), 2) if vals else None

    pre_done = (("pre", me.id, others[0]) in guesses) if others else False
    post_done = (("post", me.id, others[0]) in guesses) if others else False
    return {
        "items": [{"id": i.id, "text": i.text} for i in items],
        "status": "ready",
        "pre_done": pre_done,
        "post_done": post_done,
        "self_done": me.id in selfs,
        "who_pre": [names[m.user_id] for m in mems if any(k[0] == "pre" and k[1] == m.user_id for k in guesses)],
        "who_post": [names[m.user_id] for m in mems if any(k[0] == "post" and k[1] == m.user_id for k in guesses)],
        # Only your own guesses are scored for you; others see the group average, never your individual scores.
        "mine": mine,
        "group": {"pre": group("pre"), "post": group("post")},
    }


# ------------------------------------------------------------------------------------- steelmen
def steelman_view(db: Session, ch: Chamber, me: User) -> dict:
    names = {m.user_id: m.user.name for m in _members(db, ch)}
    rows = list(db.scalars(select(Steelman).where(Steelman.chamber_id == ch.id).order_by(Steelman.created_at)))
    latest: dict[tuple[str, str], Steelman] = {}
    for s in rows:
        latest[(s.author_id, s.subject_id)] = s
    out = []
    for s in latest.values():
        involved = me.id in (s.author_id, s.subject_id)
        accepted = (s.rating or 0) >= ACCEPTED
        if not involved and not accepted:
            continue  # unrated or low-rated attempts stay between the two people
        out.append(
            {
                "id": s.id,
                "author_id": s.author_id,
                "author_name": names.get(s.author_id, "Former member"),
                "subject_id": s.subject_id,
                "subject_name": names.get(s.subject_id, "Former member"),
                "text": s.text,
                "rating": s.rating,
                "feedback": s.feedback if involved else None,
                "attempt": s.attempt,
                "accepted": accepted,
                "is_mine": s.author_id == me.id,
                "about_me": s.subject_id == me.id,
            }
        )
    return {"open": ch.state in STEELMAN_STATES and not ch.purged_at, "items": out}


# ------------------------------------------------------------------------------------- evidence
def evidence_view(db: Session, ch: Chamber, me: User) -> list[dict]:
    names = {m.user_id: m.user.name for m in _members(db, ch)}
    return [
        {
            "id": e.id,
            "target_id": e.target_id,
            "author_name": names.get(e.author_id, "Former member"),
            "is_mine": e.author_id == me.id,
            "text": e.text,
            "url": e.url,
            "stance": e.stance,
            "at": e.created_at.isoformat(),
        }
        for e in db.scalars(select(Evidence).where(Evidence.chamber_id == ch.id).order_by(Evidence.created_at))
    ]


# ------------------------------------------------------------------------------------- Position Record
def record_for(db: Session, user: User, public: bool) -> dict:
    """The owner sees everything; the public sees only entries marked public plus aggregate counts."""
    changes = db.scalars(select(MindChange).where(MindChange.user_id == user.id).order_by(MindChange.created_at.desc()))
    changes = [c for c in changes if c.is_public or not public]
    steelmen = list(db.scalars(select(Steelman).where(Steelman.author_id == user.id, Steelman.rating.is_not(None))))
    preds = list(db.scalars(select(Prediction).where(Prediction.user_id == user.id, Prediction.verdict.is_not(None))))
    return {
        "mind_changes": [
            {"id": c.id, "text": c.text, "is_public": c.is_public, "at": c.created_at.isoformat(), **({} if public else {"chamber_id": c.chamber_id})}
            for c in changes
        ],
        "steelmen_accepted": sum((s.rating or 0) >= ACCEPTED for s in steelmen),
        "steelmen_rated": len(steelmen),
        "calibration": {v: sum(p.verdict == v for p in preds) for v in ("right", "partly", "wrong")},
    }
