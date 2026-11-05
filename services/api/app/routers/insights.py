"""Feedback at close and aggregate product metrics for moderators. Metrics never include anyone's content."""

from statistics import median

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import understanding
from ..auth import admin_user, human_user
from ..db import get_db
from ..models import Chamber, ChamberEvent, Feedback, Membership, Restatement, Topic, TopicVote, User
from .chambers import _chamber_for_member, err

router = APIRouter(tags=["insights"])


class FeedbackIn(BaseModel):
    useful: int = Field(ge=1, le=5)
    understood: bool | None = None
    note: str | None = Field(default=None, max_length=500)


@router.post("/chambers/{cid}/feedback")
def give_feedback(cid: str, body: FeedbackIn, user: User = Depends(human_user), db: Session = Depends(get_db)):
    ch, _ = _chamber_for_member(cid, user, db)
    if ch.state != "CLOSED":
        err(409, "NOT_CLOSED", "Feedback opens when the Chamber closes.")
    f = db.scalar(select(Feedback).where(Feedback.chamber_id == cid, Feedback.user_id == user.id))
    if f:
        f.useful, f.understood, f.note = body.useful, body.understood, (body.note or "").strip() or None
    else:
        db.add(Feedback(chamber_id=cid, user_id=user.id, useful=body.useful, understood=body.understood, note=(body.note or "").strip() or None))
    db.commit()
    return {"ok": True}


@router.get("/chambers/{cid}/feedback")
def my_feedback(cid: str, user: User = Depends(human_user), db: Session = Depends(get_db)):
    _chamber_for_member(cid, user, db)
    f = db.scalar(select(Feedback).where(Feedback.chamber_id == cid, Feedback.user_id == user.id))
    return {"given": f is not None, "useful": f.useful if f else None, "understood": f.understood if f else None}


def _pct(a: int, b: int) -> float | None:
    return round(a / b, 3) if b else None


@router.get("/admin/metrics")
def metrics(admin: User = Depends(admin_user), db: Session = Depends(get_db)):
    chambers = list(db.scalars(select(Chamber)))
    ids = {c.id for c in chambers}

    def with_event(type_: str) -> int:
        return len({cid for (cid,) in db.execute(select(ChamberEvent.chamber_id).where(ChamberEvent.type == type_)) if cid in ids})

    sizes = [n for (n,) in db.execute(select(func.count(Membership.id)).group_by(Membership.chamber_id))]
    multi = sum(1 for s in sizes if s >= 2)
    analyzed = len({cid for (cid,) in db.execute(select(ChamberEvent.chamber_id).where(ChamberEvent.type == "state.changed")) if cid in ids})
    funnel = [
        {"step": "Chambers created", "n": len(chambers)},
        {"step": "Two or more people", "n": multi},
        {"step": "Mediator read positions", "n": analyzed},
        {"step": "Restatement gate passed", "n": with_event("gate.passed")},
        {"step": "Understanding Map drawn", "n": with_event("map.generated")},
        {"step": "Closed", "n": sum(1 for c in chambers if c.state == "CLOSED")},
    ]
    closed = [c for c in chambers if c.state == "CLOSED"]
    rs = list(db.scalars(select(Restatement)))
    first_try = sum(1 for r in rs if r.status == "ACCEPTED" and r.revision == 1)
    rejected_any = sum(1 for r in rs if r.revision > 1)
    # Understanding Score: average group before/after across Chambers where both exist
    deltas = []
    for c in chambers:
        m = db.scalar(select(Membership).where(Membership.chamber_id == c.id))
        if not m or c.purged_at:
            continue
        g = understanding.quiz_view(db, c, m.user)
        if g.get("status") == "ready" and g["group"]["pre"] is not None and g["group"]["post"] is not None:
            deltas.append((g["group"]["pre"], g["group"]["post"]))
    fb = list(db.scalars(select(Feedback).order_by(Feedback.created_at.desc())))
    understood = [f.understood for f in fb if f.understood is not None]
    users = list(db.scalars(select(User)))
    return {
        "users": {"total": len(users), "verified": sum(1 for u in users if u.email_verified_at)},
        "chambers": {
            "total": len(chambers),
            "median_people": median(sizes) if sizes else None,
            "closed_agreed": sum(1 for c in closed if c.closed_state == "AGREED"),
            "closed_understood": sum(1 for c in closed if c.closed_state == "UNDERSTOOD"),
            "closed_abandoned": sum(1 for c in closed if c.closed_state == "ABANDONED"),
        },
        "funnel": funnel,
        "restatements": {"total": len(rs), "accepted_first_try": _pct(first_try, len(rs)), "needed_revision": _pct(rejected_any, len(rs))},
        "understanding_score": {
            "chambers_measured": len(deltas),
            "avg_before": round(sum(d[0] for d in deltas) / len(deltas), 3) if deltas else None,
            "avg_after": round(sum(d[1] for d in deltas) / len(deltas), 3) if deltas else None,
        },
        "feedback": {
            "responses": len(fb),
            "avg_useful": round(sum(f.useful for f in fb) / len(fb), 2) if fb else None,
            "understand_better": _pct(sum(1 for u in understood if u), len(understood)),
            "notes": [{"at": f.created_at.isoformat(), "useful": f.useful, "note": f.note} for f in fb if f.note][:20],
        },
        "topics": {
            "total": db.scalar(select(func.count()).select_from(Topic)) or 0,
            "votes": db.scalar(select(func.count()).select_from(TopicVote)) or 0,
        },
    }
