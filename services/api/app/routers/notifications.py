from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..auth import current_user, human_user
from ..db import get_db, now
from ..models import Notification, User

router = APIRouter(tags=["notifications"])


@router.get("/notifications")
def list_notifications(user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = list(db.scalars(select(Notification).where(Notification.user_id == user.id).order_by(Notification.created_at.desc()).limit(50)))
    unread = db.scalar(select(func.count()).select_from(Notification).where(Notification.user_id == user.id, Notification.read_at.is_(None))) or 0
    return {
        "unread": unread,
        "email": user.notify_email is not False,
        "items": [
            {"id": n.id, "title": n.title, "body": n.body, "link": n.link, "at": n.created_at.isoformat(), "read": n.read_at is not None}
            for n in rows
        ],
    }


@router.get("/notifications/unread")
def unread_count(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return {"unread": db.scalar(select(func.count()).select_from(Notification).where(Notification.user_id == user.id, Notification.read_at.is_(None))) or 0}


class ReadIn(BaseModel):
    ids: list[str] | None = None  # omit to mark everything read


@router.post("/notifications/read")
def mark_read(body: ReadIn, user: User = Depends(human_user), db: Session = Depends(get_db)):
    q = select(Notification).where(Notification.user_id == user.id, Notification.read_at.is_(None))
    if body.ids is not None:
        q = q.where(Notification.id.in_(body.ids))
    for n in db.scalars(q):
        n.read_at = now()
    db.commit()
    return unread_count(user, db)


class SettingsIn(BaseModel):
    email: bool


@router.patch("/me/notification-settings")
def settings(body: SettingsIn, user: User = Depends(human_user), db: Session = Depends(get_db)):
    user.notify_email = body.email
    db.commit()
    return {"email": body.email}
