from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import protocol, ratelimit, safety
from ..auth import current_user, human_user
from ..db import get_db
from ..engine import get_engine
from ..engine.types import OtherOpening
from ..models import Delegate, SparSession, User
from .delegates import METHODOLOGIES

router = APIRouter(tags=["spar"])
MAX_ROUNDS = 5


def spar_out(s: SparSession, db: Session | None = None) -> dict:
    rounds = len([t for t in s.turns if t["role"] in ("opponent", "delegate")])
    target = None
    if s.target_delegate_id and db is not None:
        d = db.get(Delegate, s.target_delegate_id)
        if d:
            target = {"name": d.name, "handle": d.handle, "glyph_seed": d.glyph_seed, "owner_name": d.owner.name}
    return {
        "target": target,
        "id": s.id,
        "claim": s.claim,
        "mode": s.mode,
        "methodology": s.methodology,
        "turns": s.turns,
        "report": s.report,
        "status": s.status,
        "rounds": rounds,
        "max_rounds": MAX_ROUNDS,
        "engine_mode": s.engine_mode,
        "created_at": s.created_at.isoformat(),
    }


class SparIn(BaseModel):
    claim: str = Field(min_length=5, max_length=1000)
    mode: str = Field(pattern="^(devils_advocate|steelman)$")
    methodology: str = "socratic"


@router.post("/spar")
def start_spar(body: SparIn, user: User = Depends(human_user), db: Session = Depends(get_db)):
    ratelimit.check(user.id, "engine")
    if body.methodology not in METHODOLOGIES:
        raise HTTPException(400, {"code": "BAD_METHODOLOGY", "message": "Unknown methodology."})
    s = SparSession(user_id=user.id, claim=body.claim.strip(), mode=body.mode, methodology=body.methodology)
    history = [{"role": "user", "text": s.claim}]
    out, mode = get_engine().spar_turn(s.claim, history, s.mode, s.methodology)
    s.turns = [*history, {"role": "opponent", "text": out.challenge, "attack_type": out.attack_type}]
    s.engine_mode = mode
    db.add(s)
    db.commit()
    return spar_out(s, db)


@router.get("/spar")
def list_spar(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return [spar_out(s, db) for s in db.scalars(select(SparSession).where(SparSession.user_id == user.id).order_by(SparSession.created_at.desc()))]


def _own(sid: str, user: User, db: Session) -> SparSession:
    s = db.get(SparSession, sid)
    if not s or s.user_id != user.id:
        raise HTTPException(404, {"code": "NOT_FOUND", "message": "Sparring session not found."})
    return s


@router.get("/spar/{sid}")
def get_spar(sid: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return spar_out(_own(sid, user, db), db)


class TurnIn(BaseModel):
    response: str = Field(min_length=1, max_length=2000)


@router.post("/spar/{sid}/turn")
def spar_turn(sid: str, body: TurnIn, user: User = Depends(human_user), db: Session = Depends(get_db)):
    s = _own(sid, user, db)
    if s.status != "ACTIVE":
        raise HTTPException(409, {"code": "FINISHED", "message": "This session is finished."})
    ratelimit.check(user.id, "engine")
    if s.mode == "rehearsal":
        return _rehearsal_turn(s, body.response.strip(), user, db)
    history = [*s.turns, {"role": "user", "text": body.response.strip()}]
    engine = get_engine()
    if len([t for t in history if t["role"] == "opponent"]) >= MAX_ROUNDS:
        report, mode = engine.spar_report(s.claim, history)
        s.turns, s.report, s.status = history, report.model_dump(), "FINISHED"
    else:
        out, mode = engine.spar_turn(s.claim, history, s.mode, s.methodology)
        s.turns = [*history, {"role": "opponent", "text": out.challenge, "attack_type": out.attack_type}]
    s.engine_mode = mode
    db.commit()
    return spar_out(s, db)


@router.post("/spar/{sid}/finish")
def finish_spar(sid: str, user: User = Depends(human_user), db: Session = Depends(get_db)):
    s = _own(sid, user, db)
    if s.status == "ACTIVE" and s.mode == "rehearsal":
        s.report, s.status = _rehearsal_report(s), "FINISHED"
        db.commit()
    elif s.status == "ACTIVE":
        ratelimit.check(user.id, "engine")
        report, mode = get_engine().spar_report(s.claim, s.turns)
        s.report, s.status, s.engine_mode = report.model_dump(), "FINISHED", mode
        db.commit()
    return spar_out(s, db)


# --------------------------------------------------------------------------------------------- Rehearsal Room
class RehearsalIn(BaseModel):
    handle: str
    topic: str = Field(min_length=5, max_length=600)


def _target(db: Session, delegate_id: str | None, user: User) -> Delegate:
    d = db.get(Delegate, delegate_id) if delegate_id else None
    if not d or not d.allow_rehearsal or d.status != "ACTIVE":
        raise HTTPException(403, {"code": "NO_REHEARSAL", "message": "This Delegate doesn't accept rehearsals (its owner hasn't opted in)."})
    if d.owner_id == user.id:
        raise HTTPException(400, {"code": "OWN_DELEGATE", "message": "Use Spar to argue with yourself."})
    return d


def _public(db: Session, d: Delegate) -> list[dict]:
    # Invariant 2: other people only ever see a Delegate's ENDORSED, PUBLIC positions.
    return [{"id": p.id, "statement": p.statement, "stance": p.stance} for p in protocol.public_positions(db, d.id)]


@router.post("/rehearsals")
def start_rehearsal(body: RehearsalIn, user: User = Depends(human_user), db: Session = Depends(get_db)):
    """Practise a hard conversation against someone's Delegate, using only their public positions."""
    d = _target(db, (db.scalar(select(Delegate.id).where(Delegate.handle == body.handle))), user)
    ratelimit.check(user.id, "engine")
    out, mode = get_engine().draft_position(body.topic, d.owner.name, _public(db, d), voice="third")
    text = safety.check_output(out.text, [d.owner.name]) or f"{d.owner.name} hasn't made any public position on this. I can't say what they think."
    s = SparSession(user_id=user.id, claim=body.topic.strip(), mode="rehearsal", methodology="rehearsal", target_delegate_id=d.id, engine_mode=mode)
    s.turns = [{"role": "user", "text": s.claim}, {"role": "delegate", "text": text, "unknowns": out.unknowns}]
    db.add(s)
    db.commit()
    return spar_out(s, db)


def _rehearsal_turn(s: SparSession, response: str, user: User, db: Session) -> dict:
    d = _target(db, s.target_delegate_id, user)
    out, mode = get_engine().delegate_reply(s.claim, d.owner.name, _public(db, d), "", [OtherOpening(label=user.name, text=response)])
    text = safety.check_output(out.text, [d.owner.name]) or f"{d.owner.name} hasn't said anything public about that."
    s.turns = [*s.turns, {"role": "user", "text": response}, {"role": "delegate", "text": text, "unknowns": out.unknowns}]
    s.engine_mode = mode
    if len([t for t in s.turns if t["role"] == "delegate"]) > MAX_ROUNDS:
        s.report, s.status = _rehearsal_report(s), "FINISHED"
    db.commit()
    return spar_out(s, db)


def _rehearsal_report(s: SparSession) -> dict:
    unknowns = list(dict.fromkeys(u for t in s.turns if t["role"] == "delegate" for u in t.get("unknowns", [])))
    replies = [t["text"] for t in s.turns if t["role"] == "delegate"]
    return {
        "verdict": "open",
        "strongest_objection": replies[1] if len(replies) > 1 else (replies[0] if replies else ""),
        "how_you_responded": f"You practised {len([t for t in s.turns if t['role'] == 'user']) - 1} response(s). "
        "Remember: this was based only on what they've made public, so the real conversation will differ.",
        "what_to_strengthen": [f"Ask them directly: {u}" for u in unknowns[:4]]
        or ["Their public positions covered your points. In the real conversation, check that they still hold them."],
    }
