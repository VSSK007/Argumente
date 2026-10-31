import os

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import create_session, current_user, human_user
from ..db import get_db
from ..models import Delegate, Intake, Membership, Position, SparSession, User

router = APIRouter(tags=["auth"])

DEV_MODE = os.environ.get("ARGUMENTE_DEV", "1") == "1"


class LoginIn(BaseModel):
    email: str = Field(min_length=3, max_length=200)
    name: str = Field(min_length=1, max_length=60)
    is_adult: bool


def user_out(u: User, db: Session) -> dict:
    d = db.scalar(select(Delegate).where(Delegate.owner_id == u.id))
    return {"id": u.id, "email": u.email, "name": u.name, "has_delegate": d is not None, "delegate_handle": d.handle if d else None}


@router.post("/auth/login")
def login(body: LoginIn, db: Session = Depends(get_db)):
    """Local-dev login: no password. Creates the account on first use."""
    if not body.is_adult:
        raise HTTPException(400, {"code": "AGE_REQUIRED", "message": "Argumenté is for people aged 18 and over."})
    email = body.email.strip().lower()
    user = db.scalar(select(User).where(User.email == email))
    if not user:
        user = User(email=email, name=body.name.strip(), is_adult=True)
        db.add(user)
        db.commit()
    token = create_session(db, user)
    return {"token": token, "user": user_out(user, db)}


@router.get("/auth/dev-users")
def dev_users(db: Session = Depends(get_db)):
    """Quick account switching for local testing of multi-person Chambers."""
    if not DEV_MODE:
        return []
    return [{"email": u.email, "name": u.name} for u in db.scalars(select(User).order_by(User.created_at))]


@router.get("/me")
def me(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return user_out(user, db)


@router.get("/me/export")
def export_me(user: User = Depends(human_user), db: Session = Depends(get_db)):
    d = db.scalar(select(Delegate).where(Delegate.owner_id == user.id))
    positions = list(db.scalars(select(Position).where(Position.delegate_id == d.id))) if d else []
    intakes = list(db.scalars(select(Intake).where(Intake.user_id == user.id)))
    spars = list(db.scalars(select(SparSession).where(SparSession.user_id == user.id)))
    return {
        "user": {"email": user.email, "name": user.name, "created_at": user.created_at.isoformat()},
        "delegate": {"handle": d.handle, "name": d.name, "voice": d.voice, "methodology": d.methodology, "autonomy": d.autonomy} if d else None,
        "positions": [
            {"statement": p.statement, "stance": p.stance, "status": p.status, "scope": p.scope_type, "scope_id": p.scope_id, "history": p.history}
            for p in positions
        ],
        "chamber_positions": [{"chamber_id": i.chamber_id, "text": i.text, "status": i.status} for i in intakes],
        "spar_sessions": [{"claim": s.claim, "turns": s.turns, "report": s.report} for s in spars],
    }


@router.delete("/me")
def delete_me(user: User = Depends(human_user), db: Session = Depends(get_db)):
    """Hard-deletes the account, Delegate, positions and Chamber contributions."""
    for m in db.scalars(select(Membership).where(Membership.user_id == user.id)):
        db.delete(m)
    db.delete(user)
    db.commit()
    return {"deleted": True}
