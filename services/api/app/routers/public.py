from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import human_user
from ..db import get_db
from ..engine import engine_status
from ..models import Publication, Report, User

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
    target_type: str = Field(pattern="^(map|chamber|delegate|spar)$")
    target_id: str
    reason: str = Field(min_length=3, max_length=1000)


@router.post("/reports")
def report(body: ReportIn, user: User = Depends(human_user), db: Session = Depends(get_db)):
    db.add(Report(reporter_id=user.id, **body.model_dump()))
    db.commit()
    return {"received": True}
