"""Endpoints for Steelman Exchange, Understanding Score, the evidence board and the Position Record."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import protocol, understanding
from ..auth import current_user, human_user
from ..db import get_db, now
from ..models import Chamber, Crux, Evidence, Membership, MindChange, Node, QuizAnswer, QuizItem, Steelman, User
from .chambers import _chamber_for_member, _screen_and_maybe_pause, chamber_view, err

router = APIRouter(tags=["understanding"])

AFTER_MAP = ("MAP", "OPTIONS_PENDING", "RESOLUTION", "CLOSED")


def _not_paused(ch: Chamber):
    if ch.paused:
        err(409, "PAUSED", "This Chamber is paused. Resume it to continue.")
    if ch.purged_at:
        err(409, "PURGED", "This Chamber's private content has been deleted.")


# ------------------------------------------------------------------------------------- Steelman Exchange
class SteelmanIn(BaseModel):
    subject_id: str
    text: str = Field(min_length=10, max_length=2000)


@router.post("/chambers/{cid}/steelmen")
def write_steelman(cid: str, body: SteelmanIn, user: User = Depends(human_user), db: Session = Depends(get_db)):
    """Write someone else's view in your own words. They rate it; only accepted ones (4+) are shown to everyone."""
    ch, _ = _chamber_for_member(cid, user, db)
    _not_paused(ch)
    if ch.state not in understanding.STEELMAN_STATES:
        err(409, "WRONG_STATE", "The Steelman Exchange opens once the Mediator has read everyone's positions.")
    if body.subject_id == user.id:
        err(400, "SELF", "Steelman someone else's view.")
    if not db.scalar(select(Membership).where(Membership.chamber_id == ch.id, Membership.user_id == body.subject_id)):
        err(400, "NOT_A_MEMBER", "That person isn't in this Chamber.")
    prev = db.scalars(
        select(Steelman)
        .where(Steelman.chamber_id == ch.id, Steelman.author_id == user.id, Steelman.subject_id == body.subject_id)
        .order_by(Steelman.attempt.desc())
    ).first()
    if prev and prev.rating is None:
        prev.text = body.text.strip()  # still unrated: just edit it
    else:
        if prev and prev.attempt >= 5:
            err(409, "TOO_MANY", "Five attempts is plenty. Talk it through together.")
        db.add(Steelman(chamber_id=ch.id, author_id=user.id, subject_id=body.subject_id, text=body.text.strip(), attempt=(prev.attempt + 1) if prev else 1))
    _screen_and_maybe_pause(db, ch, user, body.text)
    protocol.emit(db, ch.id, "steelman.written", "human", user.id)
    db.commit()
    return chamber_view(ch, user, db)


class RateIn(BaseModel):
    rating: int = Field(ge=1, le=5)
    feedback: str | None = Field(default=None, max_length=1000)


@router.post("/steelmen/{sid}/rate")
def rate_steelman(sid: str, body: RateIn, user: User = Depends(human_user), db: Session = Depends(get_db)):
    s = db.get(Steelman, sid)
    if not s:
        err(404, "NOT_FOUND", "Steelman not found.")
    ch, _ = _chamber_for_member(s.chamber_id, user, db)
    _not_paused(ch)
    if s.subject_id != user.id:
        err(403, "NOT_YOURS", "Only the person whose view this describes can rate it.")
    s.rating, s.feedback, s.rated_at = body.rating, (body.feedback or "").strip() or None, now()
    protocol.emit(db, ch.id, "steelman.accepted" if body.rating >= understanding.ACCEPTED else "steelman.rated", "human", user.id)
    db.commit()
    return chamber_view(ch, user, db)


# ------------------------------------------------------------------------------------- Understanding Score
ANS = ("agree", "disagree", "unsure")


class QuizIn(BaseModel):
    phase: str = Field(pattern="^(pre|post)$")
    self_answers: dict[str, str] = Field(default_factory=dict)  # item_id -> answer (your own view)
    predictions: dict[str, dict[str, str]]  # about_user_id -> item_id -> answer


@router.post("/chambers/{cid}/quiz")
def submit_quiz(cid: str, body: QuizIn, user: User = Depends(human_user), db: Session = Depends(get_db)):
    """Guess how the others see each statement, before reading the restatements and again after the Map."""
    ch, _ = _chamber_for_member(cid, user, db)
    _not_paused(ch)
    if body.phase == "pre" and ch.state not in ("RESTATEMENT", "MAPPING"):
        err(409, "WRONG_STATE", "The 'before' guess happens before the Understanding Map.")
    if body.phase == "post" and ch.state not in AFTER_MAP:
        err(409, "WRONG_STATE", "The 'after' guess happens once the Understanding Map is ready.")
    items = {i.id for i in db.scalars(select(QuizItem).where(QuizItem.chamber_id == ch.id))}
    if not items:
        err(409, "NO_QUIZ", "There's nothing to guess about in this Chamber.")
    view = understanding.quiz_view(db, ch, user)
    if view[f"{body.phase}_done"]:
        err(409, "ALREADY_DONE", "You've already answered this round. Answers are locked so the score stays honest.")
    others = {m.user_id for m in db.scalars(select(Membership).where(Membership.chamber_id == ch.id))} - {user.id}

    def check(ans: dict[str, str], what: str):
        if set(ans) != items or any(a not in ANS for a in ans.values()):
            err(400, "INCOMPLETE", f"Answer every statement for {what}.")

    if not view["self_done"]:
        check(body.self_answers, "yourself")
        for iid, a in body.self_answers.items():
            db.add(QuizAnswer(chamber_id=ch.id, item_id=iid, respondent_id=user.id, about_id=user.id, phase="self", answer=a))
    if set(body.predictions) != others:
        err(400, "INCOMPLETE", "Make a guess for every other person.")
    for about, ans in body.predictions.items():
        check(ans, "each person")
        for iid, a in ans.items():
            db.add(QuizAnswer(chamber_id=ch.id, item_id=iid, respondent_id=user.id, about_id=about, phase=body.phase, answer=a))
    protocol.emit(db, ch.id, f"quiz.{body.phase}", "human", user.id)
    db.commit()
    return chamber_view(ch, user, db)


# ------------------------------------------------------------------------------------- evidence board
class EvidenceIn(BaseModel):
    target_id: str
    text: str = Field(min_length=3, max_length=600)
    url: str | None = Field(default=None, max_length=500)
    stance: str = Field(pattern="^(supports|challenges|context)$")


@router.post("/chambers/{cid}/evidence")
def add_evidence(cid: str, body: EvidenceIn, user: User = Depends(human_user), db: Session = Depends(get_db)):
    """Put sources side by side for a factual difference or a crux: turn 'who's right' into 'let's check'."""
    ch, _ = _chamber_for_member(cid, user, db)
    _not_paused(ch)
    if ch.state not in AFTER_MAP:
        err(409, "WRONG_STATE", "The evidence board opens with the Understanding Map.")
    is_node = db.scalar(select(Node.id).where(Node.id == body.target_id, Node.chamber_id == ch.id, Node.kind == "DISAGREEMENT"))
    is_crux = db.scalar(select(Crux.id).where(Crux.id == body.target_id, Crux.chamber_id == ch.id))
    if not (is_node or is_crux):
        err(400, "BAD_TARGET", "Evidence attaches to a difference or a crux in this Chamber.")
    url = (body.url or "").strip() or None
    if url and not url.lower().startswith(("http://", "https://")):
        err(400, "BAD_URL", "Links must start with http:// or https://.")
    db.add(Evidence(chamber_id=ch.id, target_id=body.target_id, author_id=user.id, text=body.text.strip(), url=url, stance=body.stance))
    _screen_and_maybe_pause(db, ch, user, body.text)
    protocol.emit(db, ch.id, "evidence.added", "human", user.id)
    db.commit()
    return chamber_view(ch, user, db)


@router.delete("/evidence/{eid}")
def remove_evidence(eid: str, user: User = Depends(human_user), db: Session = Depends(get_db)):
    e = db.get(Evidence, eid)
    if not e:
        err(404, "NOT_FOUND", "Not found.")
    ch, _ = _chamber_for_member(e.chamber_id, user, db)
    if e.author_id != user.id:
        err(403, "NOT_YOURS", "You can only remove what you added.")
    db.delete(e)
    db.commit()
    return chamber_view(ch, user, db)


# ------------------------------------------------------------------------------------- Position Record
class MindChangeIn(BaseModel):
    text: str = Field(min_length=5, max_length=600)
    chamber_id: str | None = None
    is_public: bool = False


@router.post("/me/mind-changes")
def add_mind_change(body: MindChangeIn, user: User = Depends(human_user), db: Session = Depends(get_db)):
    if body.chamber_id:
        _chamber_for_member(body.chamber_id, user, db)
    db.add(MindChange(user_id=user.id, chamber_id=body.chamber_id, text=body.text.strip(), is_public=body.is_public))
    if body.chamber_id:
        protocol.emit(db, body.chamber_id, "mind.changed", "human", user.id)
    db.commit()
    return understanding.record_for(db, user, public=False)


class MindChangePatch(BaseModel):
    is_public: bool


@router.patch("/me/mind-changes/{mid}")
def update_mind_change(mid: str, body: MindChangePatch, user: User = Depends(human_user), db: Session = Depends(get_db)):
    m = db.get(MindChange, mid)
    if not m or m.user_id != user.id:
        err(404, "NOT_FOUND", "Not found.")
    m.is_public = body.is_public
    db.commit()
    return understanding.record_for(db, user, public=False)


@router.delete("/me/mind-changes/{mid}")
def delete_mind_change(mid: str, user: User = Depends(human_user), db: Session = Depends(get_db)):
    m = db.get(MindChange, mid)
    if not m or m.user_id != user.id:
        err(404, "NOT_FOUND", "Not found.")
    db.delete(m)
    db.commit()
    return understanding.record_for(db, user, public=False)


@router.get("/me/record")
def my_record(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return understanding.record_for(db, user, public=False)
