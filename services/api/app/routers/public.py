from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import human_user
from ..db import get_db
from ..engine import engine_status
from ..models import AuditLog, Publication, Report, TopicStatement, User

AUTO_HIDE_REPORTS = 3

router = APIRouter(tags=["public"])


@router.get("/engine/status")
def status():
    return engine_status()


@router.get("/public/maps")
def list_maps(db: Session = Depends(get_db)):
    pubs = db.scalars(select(Publication).where(Publication.status == "PUBLISHED").order_by(Publication.published_at.desc()))
    return [
        {
            "slug": p.slug,
            "title": p.snapshot["title"],
            "headline": p.snapshot["headline"],
            "participants": p.snapshot["participants"],
            "differences": len(p.snapshot["differences"]),
            "cruxes": len(p.snapshot["cruxes"]),
            "published_at": p.published_at.isoformat() if p.published_at else None,
        }
        for p in pubs
    ]


@router.get("/public/maps/{slug}")
def get_map(slug: str, db: Session = Depends(get_db)):
    p = db.scalar(select(Publication).where(Publication.slug == slug))
    if not p or p.status != "PUBLISHED":
        raise HTTPException(404, {"code": "NOT_FOUND", "message": "This Map isn't published (or was unpublished by a participant)."})
    return {**p.snapshot, "slug": p.slug, "published_at": p.published_at.isoformat() if p.published_at else None}


class ReportIn(BaseModel):
    target_type: str = Field(pattern="^(map|chamber|delegate|spar|topic|statement)$")
    target_id: str
    reason: str = Field(min_length=3, max_length=1000)


@router.post("/reports")
def report(body: ReportIn, user: User = Depends(human_user), db: Session = Depends(get_db)):
    db.add(Report(reporter_id=user.id, status="OPEN", **body.model_dump()))
    db.flush()
    if body.target_type == "statement":
        # Three different people reporting the same public statement hide it until a moderator reviews it.
        reporters = {r.reporter_id for r in db.scalars(select(Report).where(Report.target_type == "statement", Report.target_id == body.target_id, Report.status == "OPEN"))}
        st = db.get(TopicStatement, body.target_id)
        if st and st.status == "ACTIVE" and len(reporters) >= AUTO_HIDE_REPORTS:
            st.status = "HIDDEN"
            db.add(AuditLog(actor_id="system", action="auto_hide_statement", target_type="statement", target_id=st.id, note=f"{len(reporters)} reports"))
    db.commit()
    return {"received": True}
