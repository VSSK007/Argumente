import hashlib
import json
import os
import re
import secrets
from datetime import timedelta, timezone

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import create_session, current_user, dev_mode, human_user
from ..db import get_db, now
from ..models import AuthSession, Delegate, Intake, MagicLink, Membership, Passkey, Position, SparSession, User, WebAuthnChallenge

router = APIRouter(tags=["auth"])


class LoginIn(BaseModel):
    email: str = Field(min_length=3, max_length=200)
    name: str = Field(min_length=1, max_length=60)
    is_adult: bool


def user_out(u: User, db: Session) -> dict:
    d = db.scalar(select(Delegate).where(Delegate.owner_id == u.id))
    return {
        "id": u.id,
        "email": u.email,
        "name": u.name,
        "has_delegate": d is not None,
        "delegate_handle": d.handle if d else None,
        "email_verified": u.email_verified_at is not None,
        "is_admin": bool(u.is_admin),
    }


@router.post("/auth/login")
def login(body: LoginIn, db: Session = Depends(get_db)):
    """Local-dev login: no password. Creates the account on first use. Disabled unless ARGUMENTE_DEV=1."""
    if not dev_mode():
        raise HTTPException(404, {"code": "DEV_LOGIN_DISABLED", "message": "Sign in with an email link or a passkey."})
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
    if not dev_mode():
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


# ------------------------------------------------------------------------------------------ config
@router.get("/auth/config")
def auth_config():
    from .. import mailer

    return {"dev_login": dev_mode(), "email_delivery": mailer.delivery(), "passkeys": True}


@router.post("/auth/logout")
def logout(authorization: str | None = Header(default=None), db: Session = Depends(get_db)):
    if authorization and authorization.lower().startswith("bearer "):
        sess = db.get(AuthSession, authorization.split(" ", 1)[1].strip())
        if sess:
            db.delete(sess)
            db.commit()
    return {"ok": True}


@router.post("/auth/logout-everywhere")
def logout_everywhere(user: User = Depends(human_user), db: Session = Depends(get_db)):
    for sess in db.scalars(select(AuthSession).where(AuthSession.user_id == user.id)):
        db.delete(sess)
    db.commit()
    return {"ok": True}


# ------------------------------------------------------------------------------------------ magic links
MAGIC_MINUTES = 15
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _safe_next(path: str | None) -> str | None:
    return path if path and path.startswith("/") and not path.startswith("//") and len(path) < 300 else None


class MagicIn(BaseModel):
    email: str = Field(min_length=3, max_length=200)
    name: str | None = Field(default=None, max_length=60)
    is_adult: bool
    next: str | None = None


@router.post("/auth/magic-link")
def request_magic_link(body: MagicIn, db: Session = Depends(get_db)):
    """Email a single-use sign-in link. The response is the same whether or not the account exists."""
    from .. import mailer, ratelimit

    email = body.email.strip().lower()
    if not EMAIL_RE.match(email):
        raise HTTPException(400, {"code": "BAD_EMAIL", "message": "That doesn't look like an email address."})
    if not body.is_adult:
        raise HTTPException(400, {"code": "AGE_REQUIRED", "message": "Argumenté is for people aged 18 and over."})
    exists = db.scalar(select(User.id).where(User.email == email)) is not None
    if not exists and not (body.name or "").strip():
        raise HTTPException(400, {"code": "NAME_REQUIRED", "message": "Tell us your name to create your account."})
    ratelimit.check(f"email:{email}", "auth")
    token = secrets.token_urlsafe(32)
    db.add(
        MagicLink(
            token_hash=_hash(token),
            email=email,
            name=(body.name or "").strip() or None,
            next_path=_safe_next(body.next),
            expires_at=now() + timedelta(minutes=MAGIC_MINUTES),
        )
    )
    db.commit()
    # In the fragment, so the token never reaches server logs or Referer headers.
    url = f"{os.environ.get('WEB_ORIGIN', 'http://localhost:3000')}/auth/verify#token={token}"
    mailer.send(
        email,
        "Your Argumenté sign-in link",
        f"Sign in to Argumenté:\n\n{url}\n\nThis link works once and expires in {MAGIC_MINUTES} minutes. "
        "If you didn't ask for it, ignore this email.",
    )
    out = {"sent": True, "delivery": mailer.delivery()}
    if dev_mode():
        out["dev_link"] = url  # local development only: no inbox needed
    return out


class VerifyIn(BaseModel):
    token: str = Field(min_length=10, max_length=200)


@router.post("/auth/magic-link/verify")
def verify_magic_link(body: VerifyIn, db: Session = Depends(get_db)):
    link = db.get(MagicLink, _hash(body.token))
    exp = link.expires_at if link else None
    if exp is not None and exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if not link or link.used_at or exp < now():
        raise HTTPException(400, {"code": "LINK_INVALID", "message": "This link has expired or was already used. Request a new one."})
    link.used_at = now()
    user = db.scalar(select(User).where(User.email == link.email))
    if not user:
        user = User(email=link.email, name=link.name or link.email.split("@")[0], is_adult=True)
        db.add(user)
    if not user.email_verified_at:
        user.email_verified_at = now()
    db.commit()
    token = create_session(db, user)
    return {"token": token, "user": user_out(user, db), "next": link.next_path}


# ------------------------------------------------------------------------------------------ passkeys
def _rp() -> tuple[str, list[str]]:
    origins = [o.strip() for o in os.environ.get("WEBAUTHN_ORIGINS", os.environ.get("WEB_ORIGIN", "http://localhost:3000")).split(",") if o.strip()]
    return os.environ.get("WEBAUTHN_RP_ID", "localhost"), origins


def _store_challenge(db: Session, challenge: bytes, kind: str, user_id: str | None) -> str:
    from webauthn.helpers import bytes_to_base64url

    c = WebAuthnChallenge(user_id=user_id, kind=kind, challenge=bytes_to_base64url(challenge), expires_at=now() + timedelta(minutes=5))
    db.add(c)
    db.commit()
    return c.id


def _take_challenge(db: Session, cid: str, kind: str) -> WebAuthnChallenge:
    c = db.get(WebAuthnChallenge, cid)
    exp = c.expires_at if c else None
    if exp is not None and exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if not c or c.kind != kind or exp < now():
        raise HTTPException(400, {"code": "CHALLENGE_EXPIRED", "message": "That took too long. Try again."})
    db.delete(c)  # single use
    db.commit()
    return c


@router.post("/auth/passkeys/register/options")
def passkey_register_options(user: User = Depends(human_user), db: Session = Depends(get_db)):
    from webauthn import generate_registration_options, options_to_json
    from webauthn.helpers import base64url_to_bytes
    from webauthn.helpers.structs import (
        AuthenticatorSelectionCriteria,
        PublicKeyCredentialDescriptor,
        ResidentKeyRequirement,
        UserVerificationRequirement,
    )

    if not user.webauthn_id:
        user.webauthn_id = secrets.token_urlsafe(16)
        db.commit()
    rp_id, _ = _rp()
    existing = [PublicKeyCredentialDescriptor(id=base64url_to_bytes(p.id)) for p in db.scalars(select(Passkey).where(Passkey.user_id == user.id))]
    opts = generate_registration_options(
        rp_id=rp_id,
        rp_name="Argumenté",
        user_name=user.email,
        user_id=user.webauthn_id.encode(),
        user_display_name=user.name,
        exclude_credentials=existing,
        authenticator_selection=AuthenticatorSelectionCriteria(resident_key=ResidentKeyRequirement.REQUIRED, user_verification=UserVerificationRequirement.PREFERRED),
    )
    cid = _store_challenge(db, opts.challenge, "register", user.id)
    return {"challenge_id": cid, "options": json.loads(options_to_json(opts))}


class PasskeyVerifyIn(BaseModel):
    challenge_id: str
    credential: dict
    name: str | None = Field(default=None, max_length=60)


@router.post("/auth/passkeys/register/verify")
def passkey_register_verify(body: PasskeyVerifyIn, user: User = Depends(human_user), db: Session = Depends(get_db)):
    from webauthn import verify_registration_response
    from webauthn.helpers import base64url_to_bytes, bytes_to_base64url

    c = _take_challenge(db, body.challenge_id, "register")
    if c.user_id != user.id:
        raise HTTPException(400, {"code": "CHALLENGE_EXPIRED", "message": "Try again."})
    rp_id, origins = _rp()
    try:
        v = verify_registration_response(credential=body.credential, expected_challenge=base64url_to_bytes(c.challenge), expected_rp_id=rp_id, expected_origin=origins)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(400, {"code": "PASSKEY_REJECTED", "message": f"That passkey couldn't be verified ({type(e).__name__})."}) from e
    pk = Passkey(id=bytes_to_base64url(v.credential_id), user_id=user.id, public_key=bytes_to_base64url(v.credential_public_key), sign_count=v.sign_count, name=(body.name or "Passkey").strip())
    db.add(pk)
    db.commit()
    return {"id": pk.id, "name": pk.name}


@router.post("/auth/passkeys/login/options")
def passkey_login_options(db: Session = Depends(get_db)):
    from webauthn import generate_authentication_options, options_to_json
    from webauthn.helpers.structs import UserVerificationRequirement

    rp_id, _ = _rp()
    opts = generate_authentication_options(rp_id=rp_id, user_verification=UserVerificationRequirement.PREFERRED)
    cid = _store_challenge(db, opts.challenge, "login", None)
    return {"challenge_id": cid, "options": json.loads(options_to_json(opts))}


@router.post("/auth/passkeys/login/verify")
def passkey_login_verify(body: PasskeyVerifyIn, db: Session = Depends(get_db)):
    from webauthn import verify_authentication_response
    from webauthn.helpers import base64url_to_bytes

    c = _take_challenge(db, body.challenge_id, "login")
    pk = db.get(Passkey, str(body.credential.get("id", "")))
    if not pk:
        raise HTTPException(400, {"code": "PASSKEY_UNKNOWN", "message": "This passkey isn't registered here."})
    rp_id, origins = _rp()
    try:
        v = verify_authentication_response(
            credential=body.credential,
            expected_challenge=base64url_to_bytes(c.challenge),
            expected_rp_id=rp_id,
            expected_origin=origins,
            credential_public_key=base64url_to_bytes(pk.public_key),
            credential_current_sign_count=pk.sign_count,
        )
    except Exception as e:  # noqa: BLE001
        raise HTTPException(400, {"code": "PASSKEY_REJECTED", "message": f"That passkey couldn't be verified ({type(e).__name__})."}) from e
    pk.sign_count, pk.last_used_at = v.new_sign_count, now()
    user = db.get(User, pk.user_id)
    db.commit()
    return {"token": create_session(db, user), "user": user_out(user, db)}


@router.get("/me/passkeys")
def my_passkeys(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return [
        {"id": p.id, "name": p.name, "created_at": p.created_at.isoformat(), "last_used_at": p.last_used_at.isoformat() if p.last_used_at else None}
        for p in db.scalars(select(Passkey).where(Passkey.user_id == user.id).order_by(Passkey.created_at))
    ]


@router.delete("/me/passkeys/{pid}")
def delete_passkey(pid: str, user: User = Depends(human_user), db: Session = Depends(get_db)):
    p = db.get(Passkey, pid)
    if not p or p.user_id != user.id:
        raise HTTPException(404, {"code": "NOT_FOUND", "message": "Not found."})
    db.delete(p)
    db.commit()
    return {"ok": True}
