"""Real sign-in (magic links, sessions, passkey endpoints) and the moderation queue."""

from datetime import timedelta

from app import ratelimit
from app.db import SessionLocal, now
from app.models import AuthSession, MagicLink

API = "/api/v1"


def token_from(link: str) -> str:
    return link.split("#token=", 1)[1]


def test_dev_login_off_by_default(client, monkeypatch):
    monkeypatch.setenv("ARGUMENTE_DEV", "0")
    r = client.post(f"{API}/auth/login", json={"email": "x@example.com", "name": "X", "is_adult": True})
    assert r.status_code == 404
    assert client.get(f"{API}/auth/dev-users").json() == []
    assert client.get(f"{API}/auth/config").json()["dev_login"] is False
    r = client.post(f"{API}/auth/magic-link", json={"email": "x@example.com", "name": "X", "is_adult": True})
    assert r.status_code == 200 and "dev_link" not in r.json()  # never leak the link outside dev mode


def test_magic_link_flow(client):
    ratelimit.reset()
    assert client.post(f"{API}/auth/magic-link", json={"email": "new@example.com", "is_adult": True}).status_code == 400  # name needed
    assert client.post(f"{API}/auth/magic-link", json={"email": "nope", "name": "N", "is_adult": True}).status_code == 400
    r = client.post(f"{API}/auth/magic-link", json={"email": "New@Example.com", "name": "Nia", "is_adult": True, "next": "//evil.example/x"}).json()
    assert r["sent"] and r["dev_link"].startswith("http://localhost:3000/auth/verify#token=")
    v = client.post(f"{API}/auth/magic-link/verify", json={"token": token_from(r["dev_link"])}).json()
    assert v["user"]["email"] == "new@example.com" and v["user"]["email_verified"] and v["next"] is None
    h = {"Authorization": f"Bearer {v['token']}"}
    assert client.get(f"{API}/me", headers=h).status_code == 200
    # single use
    assert client.post(f"{API}/auth/magic-link/verify", json={"token": token_from(r["dev_link"])}).status_code == 400
    # existing account: no name needed, same response shape (no account enumeration)
    r2 = client.post(f"{API}/auth/magic-link", json={"email": "new@example.com", "is_adult": True, "next": "/join/abc"}).json()
    assert set(r2) == set(r)
    db = SessionLocal()
    for link in db.query(MagicLink).filter(MagicLink.used_at.is_(None)).all():
        link.expires_at = now() - timedelta(minutes=1)
    db.commit()
    db.close()
    assert client.post(f"{API}/auth/magic-link/verify", json={"token": token_from(r2["dev_link"])}).status_code == 400  # expired
    # logout ends the session
    client.post(f"{API}/auth/logout", headers=h)
    assert client.get(f"{API}/me", headers=h).status_code == 401


def test_magic_link_rate_limited(client):
    ratelimit.reset()
    body = {"email": "spam@example.com", "name": "S", "is_adult": True}
    codes = [client.post(f"{API}/auth/magic-link", json=body).status_code for _ in range(6)]
    assert codes[:5] == [200] * 5 and codes[5] == 429
    ratelimit.reset()


def test_sessions_expire(make_user):
    u = make_user("Exp")
    db = SessionLocal()
    s = db.get(AuthSession, u.token)
    assert s.expires_at is not None
    s.expires_at = now() - timedelta(seconds=1)
    db.commit()
    db.close()
    assert u.get("/me").status_code == 401


def test_passkey_endpoints(make_user, client):
    u = make_user("Pat")
    assert client.post(f"{API}/auth/passkeys/register/options").status_code == 401
    o = u.post("/auth/passkeys/register/options").json()
    assert o["options"]["rp"]["id"] == "localhost" and o["options"]["authenticatorSelection"]["residentKey"] == "required"
    lo = client.post(f"{API}/auth/passkeys/login/options").json()
    assert lo["options"]["challenge"] and lo["challenge_id"]
    bad = client.post(f"{API}/auth/passkeys/login/verify", json={"challenge_id": lo["challenge_id"], "credential": {"id": "nope"}})
    assert bad.status_code == 400
    # challenges are single use
    again = client.post(f"{API}/auth/passkeys/login/verify", json={"challenge_id": lo["challenge_id"], "credential": {"id": "nope"}})
    assert again.status_code == 400 and again.json()["detail"]["code"] == "CHALLENGE_EXPIRED"
    assert u.get("/me/passkeys").json() == []


def test_moderation(make_user, monkeypatch):
    monkeypatch.setenv("ADMIN_EMAILS", "mod@example.com")
    from tests.conftest import U

    mod = U.__new__(U)
    mod.c = make_user("tmp").c
    r = mod.c.post(f"{API}/auth/login", json={"email": "mod@example.com", "name": "Mod", "is_adult": True}).json()
    mod.token, mod.id, mod.name = r["token"], r["user"]["id"], "Mod"
    assert r["user"]["is_admin"]
    normal = make_user("Normal")
    assert normal.get("/admin/reports").status_code == 403

    # Public statement: three different reporters auto-hide it
    slug = normal.post("/topics", {"question": "Is this a fair test topic?", "seed_statements": ["A perfectly fine statement", "Another statement here"]}).json()["slug"]
    st = normal.get(f"/topics/{slug}").json()["statements"][0]
    for i in range(3):
        make_user(f"R{i}").post("/reports", {"target_type": "statement", "target_id": st["id"], "reason": "spam"})
    assert st["id"] not in str(normal.get(f"/topics/{slug}").json()["statements"])
    reports = mod.get("/admin/reports").json()
    rep = next(x for x in reports if x["target_id"] == st["id"])
    assert rep["reports_on_target"] == 3 and rep["target"]["status"] == "HIDDEN"
    out = mod.post(f"/admin/reports/{rep['id']}/resolve", {"action": "restore_statement", "note": "not spam"}).json()
    assert out["status"] == "RESOLVED"
    assert st["id"] in str(normal.get(f"/topics/{slug}").json()["statements"])
    assert not any(x["target_id"] == st["id"] for x in mod.get("/admin/reports").json())  # all 3 resolved together

    # Delegate suspension
    owner = make_user("Owner")
    handle = owner.make_delegate()["handle"]
    normal.post("/reports", {"target_type": "delegate", "target_id": handle, "reason": "impersonating someone"})
    rep = next(x for x in mod.get("/admin/reports").json() if x["target_id"] == handle)
    assert mod.post(f"/admin/reports/{rep['id']}/resolve", {"action": "hide_statement"}).status_code == 400  # wrong action for type
    mod.post(f"/admin/reports/{rep['id']}/resolve", {"action": "suspend_delegate"})
    assert normal.get(f"/delegates/{handle}").status_code == 404
    assert owner.patch("/delegates/me", {"status": "ACTIVE"}).status_code == 403

    # Private content is never shown to moderators
    ch = owner.post("/chambers", {"template": "decision", "title": "Private", "question": "Something private here?"}).json()
    normal.post("/reports", {"target_type": "chamber", "target_id": ch["id"], "reason": "worried"})
    rep = next(x for x in mod.get("/admin/reports").json() if x["target_id"] == ch["id"])
    assert "Private content" in rep["target"]["text"] and rep["actions"] == ["dismiss"]

    audit = mod.get("/admin/audit").json()
    assert {"auto_hide_statement", "restore_statement", "suspend_delegate"} <= {a["action"] for a in audit}
    assert any(a["actor"] == "system" for a in audit)


def test_unpublished_map_stays_removed(make_user, monkeypatch, client):
    from tests.test_learning_retention import run_to_map

    monkeypatch.setenv("ADMIN_EMAILS", "mod2@example.com")
    a, b, cid = run_to_map(make_user)
    for u in (a, b):
        u.post(f"/chambers/{cid}/publish/consent", {"consent": True})
    slug = a.get(f"/chambers/{cid}").json()["publication"]["slug"]
    assert client.get(f"{API}/public/maps/{slug}").status_code == 200
    m = client.post(f"{API}/auth/login", json={"email": "mod2@example.com", "name": "Mod", "is_adult": True}).json()["token"]
    h = {"Authorization": f"Bearer {m}"}
    b.post("/reports", {"target_type": "map", "target_id": slug, "reason": "names a private person"})
    rep = next(x for x in client.get(f"{API}/admin/reports", headers=h).json() if x["target_id"] == slug)
    client.post(f"{API}/admin/reports/{rep['id']}/resolve", headers=h, json={"action": "unpublish_map"})
    assert client.get(f"{API}/public/maps/{slug}").status_code == 404
    for u in (a, b):  # revoking and re-consenting can't bring it back
        u.post(f"/chambers/{cid}/publish/consent", {"consent": False})
        u.post(f"/chambers/{cid}/publish/consent", {"consent": True})
    assert client.get(f"{API}/public/maps/{slug}").status_code == 404
