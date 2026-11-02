"""Moderation queue. Moderators (ADMIN_EMAILS) review reports on PUBLIC content and act; every action is audited.

Private Chambers and Spar sessions are never opened to moderators: reports on them show only the reason.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import admin_user
from ..db import get_db, now
from ..models import AuditLog, Delegate, Publication, Report, Topic, TopicStatement, User

router = APIRouter(tags=["admin"])

ACTIONS = {
    "statement": ["hide_statement", "restore_statement", "close_topic", "dismiss"],
    "topic": ["close_topic", "dismiss"],
    "map": ["unpublish_map", "dismiss"],
    "delegate": ["suspend_delegate", "restore_delegate", "dismiss"],
    "chamber": ["dismiss"],
    "spar": ["dismiss"],
}


def _preview(db: Session, r: Report) -> dict:
    if r.target_type == "statement":
        st = db.get(TopicStatement, r.target_id)
        t = db.get(Topic, st.topic_id) if st else None
        return {"text": st.text if st else "(deleted)", "status": st.status if st else None, "context": t.question if t else None, "link": f"/topics/{t.slug}" if t else None}
    if r.target_type == "topic":
        t = db.scalar(select(Topic).where((Topic.slug == r.target_id) | (Topic.id == r.target_id)))
        return {"text": t.question if t else "(deleted)", "status": t.status if t else None, "link": f"/topics/{t.slug}" if t else None}
    if r.target_type == "map":
        p = db.scalar(select(Publication).where((Publication.slug == r.target_id) | (Publication.id == r.target_id)))
        return {"text": (p.snapshot or {}).get("headline", "(not published)") if p else "(deleted)", "status": p.status if p else None, "link": f"/m/{p.slug}" if p else None}
    if r.target_type == "delegate":
        d = db.scalar(select(Delegate).where((Delegate.handle == r.target_id) | (Delegate.id == r.target_id)))
        return {"text": f"@{d.handle} ({d.name})" if d else "(deleted)", "status": d.status if d else None, "link": f"/d/{d.handle}" if d else None}
    return {"text": "Private content: not shown to moderators. Contact the reporter if needed.", "status": None, "link": None}


def _report_out(db: Session, r: Report) -> dict:
    reporter = db.get(User, r.reporter_id)
    same = len(list(db.scalars(select(Report.id).where(Report.target_type == r.target_type, Report.target_id == r.target_id))))
    return {
        "id": r.id,
        "target_type": r.target_type,
        "target_id": r.target_id,
        "reason": r.reason,
        "status": r.status or "OPEN",
        "created_at": r.created_at.isoformat(),
        "reporter": reporter.email if reporter else None,
        "reports_on_target": same,
        "target": _preview(db, r),
        "actions": ACTIONS.get(r.target_type, ["dismiss"]),
        "resolution": r.resolution,
    }


@router.get("/admin/reports")
def list_reports(status: str = "OPEN", admin: User = Depends(admin_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(Report).order_by(Report.created_at.desc()).limit(200))
    return [_report_out(db, r) for r in rows if (r.status or "OPEN") == status or status == "ALL"]


class ResolveIn(BaseModel):
    action: str
    note: str | None = Field(default=None, max_length=500)


@router.post("/admin/reports/{rid}/resolve")
def resolve(rid: str, body: ResolveIn, admin: User = Depends(admin_user), db: Session = Depends(get_db)):
    r = db.get(Report, rid)
    if not r:
        raise HTTPException(404, {"code": "NOT_FOUND", "message": "No such report."})
    if body.action not in ACTIONS.get(r.target_type, []):
        raise HTTPException(400, {"code": "BAD_ACTION", "message": "That action doesn't apply to this kind of report."})
    tid = r.target_id
    if body.action in ("hide_statement", "restore_statement"):
        st = db.get(TopicStatement, tid)
        if st:
            st.status = "HIDDEN" if body.action == "hide_statement" else "ACTIVE"
    elif body.action == "close_topic":
        if r.target_type == "statement":
            st = db.get(TopicStatement, tid)
            t = db.get(Topic, st.topic_id) if st else None
        else:
            t = db.scalar(select(Topic).where((Topic.slug == tid) | (Topic.id == tid)))
        if t:
            t.status = "CLOSED"
    elif body.action == "unpublish_map":
        p = db.scalar(select(Publication).where((Publication.slug == tid) | (Publication.id == tid)))
        if p:
            p.status = "REMOVED"
    elif body.action in ("suspend_delegate", "restore_delegate"):
        d = db.scalar(select(Delegate).where((Delegate.handle == tid) | (Delegate.id == tid)))
        if d:
            d.status = "SUSPENDED" if body.action == "suspend_delegate" else "ACTIVE"
    # Resolve every open report on the same target together
    for other in db.scalars(select(Report).where(Report.target_type == r.target_type, Report.target_id == tid)):
        if (other.status or "OPEN") == "OPEN":
            other.status = "DISMISSED" if body.action == "dismiss" else "RESOLVED"
            other.resolved_by, other.resolved_at = admin.id, now()
            other.resolution = body.action + (f": {body.note}" if body.note else "")
    db.add(AuditLog(actor_id=admin.id, action=body.action, target_type=r.target_type, target_id=tid, note=body.note))
    db.commit()
    return _report_out(db, r)


@router.get("/admin/audit")
def audit(admin: User = Depends(admin_user), db: Session = Depends(get_db)):
    names = {}
    out = []
    for a in db.scalars(select(AuditLog).order_by(AuditLog.created_at.desc()).limit(200)):
        if a.actor_id not in names:
            u = db.get(User, a.actor_id)
            names[a.actor_id] = u.email if u else a.actor_id
        out.append({"at": a.created_at.isoformat(), "actor": names[a.actor_id], "action": a.action, "target_type": a.target_type, "target_id": a.target_id, "note": a.note})
    return out
