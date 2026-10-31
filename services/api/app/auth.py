"""Local-dev authentication.

Login is email + name with no password (DEV mode). Production would use magic links / passkeys
(see docs/SYSTEM_ARCHITECTURE.md §1). Sessions carry an actor_type so that only interactive
human sessions can endorse, approve or consent (invariant 1).
"""

import secrets

from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from .db import get_db
from .models import AuthSession, User


def create_session(db: Session, user: User, actor_type: str = "human") -> str:
    token = secrets.token_urlsafe(32)
    db.add(AuthSession(token=token, user_id=user.id, actor_type=actor_type))
    db.commit()
    return token


def _session(authorization: str | None, db: Session) -> AuthSession:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, {"code": "UNAUTHENTICATED", "message": "Sign in first."})
    sess = db.get(AuthSession, authorization.split(" ", 1)[1].strip())
    if not sess:
        raise HTTPException(401, {"code": "UNAUTHENTICATED", "message": "Session expired. Sign in again."})
    return sess


def current_user(authorization: str | None = Header(default=None), db: Session = Depends(get_db)) -> User:
    sess = _session(authorization, db)
    user = db.get(User, sess.user_id)
    if not user:
        raise HTTPException(401, {"code": "UNAUTHENTICATED", "message": "Unknown user."})
    return user


def human_user(authorization: str | None = Header(default=None), db: Session = Depends(get_db)) -> User:
    """Like current_user, but rejects non-interactive (service) sessions."""
    sess = _session(authorization, db)
    if sess.actor_type != "human":
        raise HTTPException(
            403, {"code": "HUMAN_REQUIRED", "message": "Only the person themselves can do this, not an automated session."}
        )
    user = db.get(User, sess.user_id)
    if not user:
        raise HTTPException(401, {"code": "UNAUTHENTICATED", "message": "Unknown user."})
    return user
