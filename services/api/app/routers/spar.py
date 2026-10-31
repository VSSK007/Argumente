from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import current_user, human_user
from ..db import get_db
from ..engine import get_engine
from ..models import SparSession, User
from .delegates import METHODOLOGIES

router = APIRouter(tags=["spar"])
MAX_ROUNDS = 5


def spar_out(s: SparSession) -> dict:
    rounds = len([t for t in s.turns if t["role"] == "opponent"])
    return {
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
    if body.methodology not in METHODOLOGIES:
        raise HTTPException(400, {"code": "BAD_METHODOLOGY", "message": "Unknown methodology."})
    s = SparSession(user_id=user.id, claim=body.claim.strip(), mode=body.mode, methodology=body.methodology)
    history = [{"role": "user", "text": s.claim}]
    out, mode = get_engine().spar_turn(s.claim, history, s.mode, s.methodology)
    s.turns = [*history, {"role": "opponent", "text": out.challenge, "attack_type": out.attack_type}]
    s.engine_mode = mode
    db.add(s)
    db.commit()
    return spar_out(s)


@router.get("/spar")
def list_spar(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return [spar_out(s) for s in db.scalars(select(SparSession).where(SparSession.user_id == user.id).order_by(SparSession.created_at.desc()))]


def _own(sid: str, user: User, db: Session) -> SparSession:
    s = db.get(SparSession, sid)
    if not s or s.user_id != user.id:
        raise HTTPException(404, {"code": "NOT_FOUND", "message": "Sparring session not found."})
    return s


@router.get("/spar/{sid}")
def get_spar(sid: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return spar_out(_own(sid, user, db))


class TurnIn(BaseModel):
    response: str = Field(min_length=1, max_length=2000)


@router.post("/spar/{sid}/turn")
def spar_turn(sid: str, body: TurnIn, user: User = Depends(human_user), db: Session = Depends(get_db)):
    s = _own(sid, user, db)
    if s.status != "ACTIVE":
        raise HTTPException(409, {"code": "FINISHED", "message": "This session is finished."})
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
    return spar_out(s)


@router.post("/spar/{sid}/finish")
def finish_spar(sid: str, user: User = Depends(human_user), db: Session = Depends(get_db)):
    s = _own(sid, user, db)
    if s.status == "ACTIVE":
        report, mode = get_engine().spar_report(s.claim, s.turns)
        s.report, s.status, s.engine_mode = report.model_dump(), "FINISHED", mode
        db.commit()
    return spar_out(s)
