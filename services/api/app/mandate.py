"""Delegate Mandate: a signed, machine-readable statement of what a Delegate may assert and commit
to on its owner's behalf. See docs/DELEGATE_MANDATE.md. Other agents (e.g. over A2A) can verify it
with the public key at /.well-known/argumente-keys.json."""

import base64
import json
import os
import secrets
from datetime import timedelta

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey, Ed25519PublicKey
from sqlalchemy import select
from sqlalchemy.orm import Session

from .db import now
from .models import Delegate, ServerKey

SPEC = "argumente.mandate/v0"
ISSUER = os.environ.get("ARGUMENTE_ISSUER", "http://localhost:8000")


def _b64(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).decode().rstrip("=")


def _key(db: Session) -> tuple[str, Ed25519PrivateKey]:
    row = db.scalars(select(ServerKey).order_by(ServerKey.created_at.desc())).first()
    if not row:
        k = Ed25519PrivateKey.generate()
        pem = k.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()).decode()
        row = ServerKey(id=f"key_{secrets.token_hex(6)}", private_pem=pem)
        db.add(row)
        db.commit()
    return row.id, serialization.load_pem_private_key(row.private_pem.encode(), password=None)


def canonical(obj: dict) -> bytes:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()


def issue(db: Session, d: Delegate, ttl_hours: int = 24) -> dict:
    """The public mandate: what this Delegate may say to anyone who isn't its owner."""
    kid, key = _key(db)
    issued = now()
    body = {
        "spec": SPEC,
        "issuer": ISSUER,
        "delegate": {"handle": d.handle, "name": d.name},
        "principal": {"display_name": d.owner.name, "verified": "email"},
        "context": {"type": "public"},
        "may_assert": ["ENDORSED"],
        "position_scopes": ["PUBLIC"],
        "speaks_as": "third_person",  # never impersonates the principal
        "autonomy": d.autonomy,
        "may_commit": False,  # no Delegate can approve, consent or agree on anyone's behalf
        "may_concede": False,
        "may_rehearse": bool(d.allow_rehearsal),
        "status": d.status,
        "issued_at": issued.isoformat(),
        "expires_at": (issued + timedelta(hours=ttl_hours)).isoformat(),
    }
    sig = key.sign(canonical(body))
    return {"mandate": body, "signature": {"alg": "Ed25519", "kid": kid, "value": _b64(sig)}}


def jwks(db: Session) -> dict:
    kid, key = _key(db)
    pub = key.public_key().public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)
    return {"keys": [{"kty": "OKP", "crv": "Ed25519", "kid": kid, "x": _b64(pub), "use": "sig"}]}


def verify(signed: dict, jwk: dict) -> bool:
    x = jwk["x"] + "=" * (-len(jwk["x"]) % 4)
    pub = Ed25519PublicKey.from_public_bytes(base64.urlsafe_b64decode(x))
    sig = signed["signature"]["value"]
    try:
        pub.verify(base64.urlsafe_b64decode(sig + "=" * (-len(sig) % 4)), canonical(signed["mandate"]))
        return True
    except Exception:  # noqa: BLE001
        return False
