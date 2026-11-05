import hashlib
import re

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import current_user, human_user
from ..cards import CARDS
from ..db import get_db, now
from ..models import Delegate, Position, SparSession, User

router = APIRouter(tags=["delegates"])

METHODOLOGIES = {
    "socratic": "Asks questions until the assumptions show.",
    "empiricist": "Wants evidence, examples and numbers.",
    "pragmatist": "Cares what works in practice and what it costs.",
    "principled": "Tests ideas against consistent principles.",
    "contrarian": "Takes the other side to see what survives.",
}


def delegate_out(d: Delegate) -> dict:
    return {
        "id": d.id,
        "handle": d.handle,
        "name": d.name,
        "glyph_seed": d.glyph_seed,
        "voice": d.voice,
        "methodology": d.methodology,
        "autonomy": d.autonomy,
        "status": d.status,
        "allow_rehearsal": bool(d.allow_rehearsal),
        "show_record": bool(d.show_record),
        "owner": {"id": d.owner.id, "name": d.owner.name},
    }


def position_out(p: Position) -> dict:
    return {
        "id": p.id,
        "statement": p.statement,
        "topic": p.topic,
        "stance": p.stance,
        "status": p.status,
        "scope_type": p.scope_type,
        "scope_id": p.scope_id,
        "is_boundary": p.is_boundary,
        "source": p.source,
        "history": p.history,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }


def _my_delegate(user: User, db: Session) -> Delegate:
    d = db.scalar(select(Delegate).where(Delegate.owner_id == user.id))
    if not d:
        raise HTTPException(404, {"code": "NO_DELEGATE", "message": "You haven't created a Delegate yet."})
    return d


@router.get("/position-cards")
def position_cards(template: str = "general"):
    return {"cards": CARDS.get(template, CARDS["general"]), "methodologies": METHODOLOGIES}


class CardAnswer(BaseModel):
    card_id: str | None = None
    statement: str = Field(min_length=3, max_length=500)
    topic: str = "general"
    stance: str = Field(pattern="^(agree|disagree|depends)$")
    why: str | None = Field(default=None, max_length=500)
    scope_type: str = Field(default="PRIVATE", pattern="^(PUBLIC|PRIVATE)$")
    is_boundary: bool = False


class DelegateIn(BaseModel):
    name: str = Field(min_length=1, max_length=40)
    handle: str | None = Field(default=None, max_length=30)
    voice: dict = Field(default_factory=lambda: {"directness": 0.5, "thoroughness": 0.5, "warmth": 0.5})
    methodology: str = "pragmatist"
    answers: list[CardAnswer] = Field(default_factory=list)


def _statement(a: CardAnswer) -> str:
    base = a.statement.strip().rstrip(".")
    if a.why:
        return f"{base}. Why: {a.why.strip()}"
    return base + "."


@router.post("/delegates")
def create_delegate(body: DelegateIn, user: User = Depends(human_user), db: Session = Depends(get_db)):
    if db.scalar(select(Delegate).where(Delegate.owner_id == user.id)):
        raise HTTPException(409, {"code": "DELEGATE_EXISTS", "message": "You already have a Delegate (one per person)."})
    if body.methodology not in METHODOLOGIES:
        raise HTTPException(400, {"code": "BAD_METHODOLOGY", "message": "Unknown methodology."})
    base = re.sub(r"[^a-z0-9]", "", (body.handle or user.name).lower())[:20] or "delegate"
    handle, i = f"{base}.d", 1
    while db.scalar(select(Delegate).where(Delegate.handle == handle)):
        i += 1
        handle = f"{base}{i}.d"
    d = Delegate(
        owner_id=user.id,
        handle=handle,
        name=body.name.strip(),
        glyph_seed=hashlib.sha1(f"{user.id}{body.name}".encode()).hexdigest()[:12],
        voice=body.voice,
        methodology=body.methodology,
    )
    db.add(d)
    db.flush()
    for a in body.answers:
        db.add(
            Position(
                delegate_id=d.id,
                statement=_statement(a),
                topic=a.topic,
                stance=a.stance,
                status="ENDORSED",
                scope_type=a.scope_type,
                is_boundary=a.is_boundary,
                source="ONBOARDING",
                history=[{"at": now().isoformat(), "event": "endorsed at onboarding"}],
            )
        )
    db.commit()
    db.refresh(d)
    return delegate_out(d)


@router.get("/delegates/me")
def get_my_delegate(user: User = Depends(current_user), db: Session = Depends(get_db)):
    d = _my_delegate(user, db)
    count = len(list(db.scalars(select(Position.id).where(Position.delegate_id == d.id, Position.status == "ENDORSED"))))
    rehearsals = len(list(db.scalars(select(SparSession.id).where(SparSession.target_delegate_id == d.id))))
    public = len(list(db.scalars(select(Position.id).where(Position.delegate_id == d.id, Position.status == "ENDORSED", Position.scope_type == "PUBLIC"))))
    return {**delegate_out(d), "endorsed_count": count, "public_count": public, "rehearsal_count": rehearsals}


class DelegatePatch(BaseModel):
    name: str | None = Field(default=None, max_length=40)
    voice: dict | None = None
    methodology: str | None = None
    autonomy: str | None = Field(default=None, pattern="^(L0|L1)$")  # L2/L3 deferred (D20)
    status: str | None = Field(default=None, pattern="^(ACTIVE|PAUSED)$")
    allow_rehearsal: bool | None = None
    show_record: bool | None = None


@router.patch("/delegates/me")
def patch_my_delegate(body: DelegatePatch, user: User = Depends(human_user), db: Session = Depends(get_db)):
    d = _my_delegate(user, db)
    if d.status == "SUSPENDED" and body.status is not None:
        raise HTTPException(403, {"code": "SUSPENDED", "message": "This Delegate was suspended by a moderator."})
    for k, v in body.model_dump(exclude_none=True).items():
        if k == "methodology" and v not in METHODOLOGIES:
            raise HTTPException(400, {"code": "BAD_METHODOLOGY", "message": "Unknown methodology."})
        setattr(d, k, v)
    db.commit()
    return delegate_out(d)


@router.get("/delegates/me/positions")
def list_positions(include_retracted: bool = False, user: User = Depends(current_user), db: Session = Depends(get_db)):
    d = _my_delegate(user, db)
    stmt = select(Position).where(Position.delegate_id == d.id).order_by(Position.created_at.desc())
    rows = [p for p in db.scalars(stmt) if p.status != "CANDIDATE" and (include_retracted or p.status != "RETRACTED")]
    return [position_out(p) for p in rows]


class PositionIn(BaseModel):
    statement: str = Field(min_length=3, max_length=800)
    stance: str | None = Field(default=None, pattern="^(agree|disagree|depends)$")
    topic: str = "general"
    scope_type: str = Field(default="PRIVATE", pattern="^(PUBLIC|PRIVATE)$")
    is_boundary: bool = False


@router.post("/delegates/me/positions")
def add_position(body: PositionIn, user: User = Depends(human_user), db: Session = Depends(get_db)):
    d = _my_delegate(user, db)
    p = Position(
        delegate_id=d.id,
        statement=body.statement.strip(),
        stance=body.stance,
        topic=body.topic,
        scope_type=body.scope_type,
        is_boundary=body.is_boundary,
        source="OWNER_EDIT",
        status="ENDORSED",
        history=[{"at": now().isoformat(), "event": "added by owner"}],
    )
    db.add(p)
    db.commit()
    return position_out(p)


class PositionPatch(BaseModel):
    statement: str | None = Field(default=None, min_length=3, max_length=800)
    stance: str | None = Field(default=None, pattern="^(agree|disagree|depends)$")
    scope_type: str | None = Field(default=None, pattern="^(PUBLIC|PRIVATE)$")
    is_boundary: bool | None = None
    changed_mind_because: str | None = Field(default=None, max_length=300)


def _owned_position(pid: str, user: User, db: Session) -> Position:
    d = _my_delegate(user, db)
    p = db.get(Position, pid)
    if not p or p.delegate_id != d.id:
        raise HTTPException(404, {"code": "NOT_FOUND", "message": "Position not found."})
    return p


@router.patch("/delegates/me/positions/{pid}")
def edit_position(pid: str, body: PositionPatch, user: User = Depends(human_user), db: Session = Depends(get_db)):
    p = _owned_position(pid, user, db)
    if p.scope_type == "CHAMBER" and body.scope_type:
        raise HTTPException(400, {"code": "SCOPE_LOCKED", "message": "Chamber positions stay inside their Chamber."})
    change = {"at": now().isoformat(), "event": "edited by owner", "before": p.statement}
    if body.changed_mind_because:
        change["event"] = "changed mind"
        change["because"] = body.changed_mind_because
    for k, v in body.model_dump(exclude_none=True, exclude={"changed_mind_because"}).items():
        setattr(p, k, v)
    p.status = "ENDORSED"
    p.history = [*p.history, change]
    db.commit()
    return position_out(p)


@router.delete("/delegates/me/positions/{pid}")
def retract_position(pid: str, user: User = Depends(human_user), db: Session = Depends(get_db)):
    p = _owned_position(pid, user, db)
    p.status = "RETRACTED"
    p.history = [*p.history, {"at": now().isoformat(), "event": "retracted by owner"}]
    db.commit()
    return position_out(p)


@router.get("/delegates/me/candidates")
def list_candidates(user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Positions the Delegate suggests remembering after a Chamber. Unused until the owner keeps them."""
    d = db.scalar(select(Delegate).where(Delegate.owner_id == user.id))
    if not d:
        return []
    rows = db.scalars(select(Position).where(Position.delegate_id == d.id, Position.status == "CANDIDATE").order_by(Position.created_at.desc()))
    return [{**position_out(p), "quote": (p.history[-1].get("quote") if p.history else None), "chamber_id": p.scope_id} for p in rows]


class KeepIn(BaseModel):
    statement: str | None = Field(default=None, min_length=3, max_length=800)
    scope_type: str = Field(default="PRIVATE", pattern="^(PUBLIC|PRIVATE)$")


def _own_candidate(pid: str, user: User, db: Session) -> Position:
    p = _owned_position(pid, user, db)
    if p.status != "CANDIDATE":
        raise HTTPException(409, {"code": "NOT_A_SUGGESTION", "message": "This position isn't a pending suggestion."})
    return p


@router.post("/delegates/me/candidates/{pid}/keep")
def keep_candidate(pid: str, body: KeepIn, user: User = Depends(human_user), db: Session = Depends(get_db)):
    p = _own_candidate(pid, user, db)
    if body.statement and body.statement.strip() != p.statement:
        p.statement = body.statement.strip()
    p.status = "ENDORSED"
    p.scope_type = body.scope_type
    p.scope_id = None
    p.source = p.source.replace("CHAMBER:", "LEARNED:")
    p.history = [*p.history, {"at": now().isoformat(), "event": "kept by owner"}]
    db.commit()
    return position_out(p)


@router.post("/delegates/me/candidates/{pid}/discard")
def discard_candidate(pid: str, user: User = Depends(human_user), db: Session = Depends(get_db)):
    p = _own_candidate(pid, user, db)
    db.delete(p)
    db.commit()
    return {"discarded": True}


@router.get("/delegates/{handle}/mandate")
def delegate_mandate(handle: str, db: Session = Depends(get_db)):
    """Signed Delegate Mandate (docs/DELEGATE_MANDATE.md): what this Delegate may assert and commit to."""
    from .. import mandate

    d = db.scalar(select(Delegate).where(Delegate.handle == handle))
    if not d:
        raise HTTPException(404, {"code": "NOT_FOUND", "message": "No Delegate with that handle."})
    return mandate.issue(db, d)


@router.get("/delegates/{handle}")
def public_profile(handle: str, db: Session = Depends(get_db)):
    d = db.scalar(select(Delegate).where(Delegate.handle == handle))
    if not d or d.status == "SUSPENDED":
        raise HTTPException(404, {"code": "NOT_FOUND", "message": "No Delegate with that handle."})
    from ..protocol import public_positions
    from ..understanding import record_for

    public = public_positions(db, d.id)
    return {
        "handle": d.handle,
        "name": d.name,
        "glyph_seed": d.glyph_seed,
        "methodology": d.methodology,
        "owner_name": d.owner.name,
        "allow_rehearsal": bool(d.allow_rehearsal),
        "public_positions": [position_out(p) for p in public],
        # Position Record, only if the owner opted in; public entries and aggregate counts only.
        "record": record_for(db, d.owner, public=True) if d.show_record else None,
    }
