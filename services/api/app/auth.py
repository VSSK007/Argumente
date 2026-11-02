"""Local-dev authentication.

Login is email + name with no password (DEV mode). Production would use magic links / passkeys
(see docs/SYSTEM_ARCHITECTURE.md §1). Sessions carry an actor_type so that only interactive
human sessions can endorse, approve or consent (invariant 1).
"""

import base64
import hashlib
import hmac
import os
import secrets
import time

from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from datetime import timedelta, timezone

from .db import get_db, now
from .models import AuthSession, User

SESSION_DAYS = int(os.environ.get("SESSION_DAYS", "30"))


def dev_mode() -> bool:
    """Password-less dev login and account switching. Off unless ARGUMENTE_DEV=1 (scripts/dev.sh sets it)."""
    return os.environ.get("ARGUMENTE_DEV", "0") == "1"


def admin_emails() -> set[str]:
    return {e.strip().lower() for e in os.environ.get("ADMIN_EMAILS", "").split(",") if e.strip()}


def create_session(db: Session, user: User, actor_type: str = "human") -> str:
    if user.email.lower() in admin_emails() and not user.is_admin:
        user.is_admin = True
    token = secrets.token_urlsafe(32)
    db.add(AuthSession(token=token, user_id=user.id, actor_type=actor_type, expires_at=now() + timedelta(days=SESSION_DAYS)))
    db.commit()
    return token


def _session(authorization: str | None, db: Session) -> AuthSession:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, {"code": "UNAUTHENTICATED", "message": "Sign in first."})
    sess = db.get(AuthSession, authorization.split(" ", 1)[1].strip())
    exp = sess.expires_at if sess else None
    if exp is not None and exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if not sess or (exp is not None and exp < now()):
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


# Short-lived, scope-bound tickets for EventSource connections (which can't send headers),
# so long-lived session tokens never appear in URLs or logs.
_SECRET = (os.environ.get("ARGUMENTE_SECRET") or secrets.token_hex(32)).encode()


def make_ticket(user_id: str, scope: str, ttl: int = 60) -> str:
    payload = f"{user_id}|{scope}|{int(time.time()) + ttl}"
    sig = hmac.new(_SECRET, payload.encode(), hashlib.sha256).hexdigest()[:32]
    return base64.urlsafe_b64encode(payload.encode()).decode().rstrip("=") + "." + sig


def read_ticket(ticket: str, scope: str) -> str | None:
    try:
        b64, sig = ticket.rsplit(".", 1)
        payload = base64.urlsafe_b64decode(b64 + "=" * (-len(b64) % 4)).decode()
        user_id, t_scope, exp = payload.split("|")
    except (ValueError, UnicodeDecodeError):
        return None
    expected = hmac.new(_SECRET, payload.encode(), hashlib.sha256).hexdigest()[:32]
    if not hmac.compare_digest(sig, expected) or t_scope != scope or int(exp) < time.time():
        return None
    return user_id


def admin_user(user: User = Depends(human_user)) -> User:
    if not user.is_admin:
        raise HTTPException(403, {"code": "ADMIN_ONLY", "message": "Moderators only."})
    return user
