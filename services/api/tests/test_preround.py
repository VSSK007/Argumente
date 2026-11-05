"""Delegate pre-round: owner review before release, simultaneous reveal, human-only release, scoped memory."""

from app.auth import create_session
from app.db import SessionLocal
from app.models import User

Q = {"template": "decision", "title": "Trip", "question": "Where should we go on our trip, and what should we spend?"}


def two_with_delegates(make_user):
    a, b = make_user("Alice"), make_user("Bob")
    a.make_delegate()
    b.make_delegate([
        {"statement": "Splitting shared costs equally is fair even when incomes differ", "stance": "agree", "topic": "money"},
        {"statement": "On a group trip, rest matters more than seeing everything", "stance": "disagree", "topic": "travel"},
    ])
    ch = a.post("/chambers", Q).json()
    b.post(f"/invites/{ch['invite_token']}/accept")
    return a, b, ch["id"]


def mine(u, cid, kind):
    return next(t for t in u.get(f"/chambers/{cid}").json()["preround"]["turns"] if t["is_mine"] and t["kind"] == kind)


def test_preround_requires_two_delegates(make_user):
    a, b = make_user("Alice"), make_user("Guest")
    a.make_delegate()
    ch = a.post("/chambers", Q).json()
    b.post(f"/invites/{ch['invite_token']}/accept")
    assert a.get(f"/chambers/{ch['id']}").json()["preround"]["can_start"] is False
    r = a.post(f"/chambers/{ch['id']}/preround/start")
    assert r.status_code == 409


def test_preround_full_flow_with_simultaneous_reveal(make_user):
    a, b, cid = two_with_delegates(make_user)
    v = a.post(f"/chambers/{cid}/preround/start").json()
    assert v["preround"]["phase"] == "openings"

    # Each owner sees only their own draft; nothing from the other side yet.
    va = a.get(f"/chambers/{cid}").json()["preround"]
    assert [t["is_mine"] for t in va["turns"]] == [True]
    ta = mine(a, cid, "opening")
    assert ta["status"] == "DRAFT" and ta["text"]
    assert "I, Alice" not in ta["text"] and "Alice" in ta["text"]  # third person, never impersonation

    # Alice releases; Bob still can't see it until Bob has also decided.
    a.post(f"/preround-turns/{ta['id']}/release", {"text": ta["text"]})
    vb = b.get(f"/chambers/{cid}").json()["preround"]
    assert all(t["is_mine"] for t in vb["turns"])
    assert vb["pending"]["opening"] == ["Bob"]

    tb = mine(b, cid, "opening")
    b.post(f"/preround-turns/{tb['id']}/release", {"text": "Bob would rather explore somewhere new; rest is secondary."})
    vb = b.get(f"/chambers/{cid}").json()["preround"]
    others = [t for t in vb["turns"] if not t["is_mine"] and t["kind"] == "opening"]
    assert others and others[0]["owner_name"] == "Alice"
    assert next(t for t in vb["turns"] if t["is_mine"] and t["kind"] == "opening")["authored_by"] == "human"

    # Replies were drafted automatically, again owner-review first.
    assert vb["phase"] == "replies"
    ra, rb = mine(a, cid, "reply"), mine(b, cid, "reply")
    assert ra["status"] == "DRAFT"
    assert not any(t["kind"] == "reply" and not t["is_mine"] for t in a.get(f"/chambers/{cid}").json()["preround"]["turns"])
    a.post(f"/preround-turns/{ra['id']}/release", {"text": ra["text"] or "Alice hasn't said."})
    b.post(f"/preround-turns/{rb['id']}/withdraw")
    v = a.get(f"/chambers/{cid}").json()["preround"]
    assert v["phase"] == "done"
    # Withdrawn turns are never shown to others
    assert not any(t["owner_name"] == "Bob" and t["kind"] == "reply" for t in v["turns"])


def test_only_owner_and_only_humans_can_release(make_user, client):
    a, b, cid = two_with_delegates(make_user)
    a.post(f"/chambers/{cid}/preround/start")
    ta = mine(a, cid, "opening")
    assert b.post(f"/preround-turns/{ta['id']}/release", {"text": "hijack"}).status_code == 403
    db = SessionLocal()
    svc = create_session(db, db.get(User, a.id), actor_type="service")
    db.close()
    r = client.post(f"/api/v1/preround-turns/{ta['id']}/release", headers={"Authorization": f"Bearer {svc}"}, json={"text": "auto"})
    assert r.status_code == 403


def test_preround_never_uses_other_chamber_memory(make_user):
    a, b, cid = two_with_delegates(make_user)
    # Alice endorses a secret in a different Chamber with Bob
    other = a.post("/chambers", {**Q, "title": "Other"}).json()
    b.post(f"/invites/{other['invite_token']}/accept")
    a.post(f"/chambers/{other['id']}/intake", {"text": "SECRET-OTHER: trip spend must stay under 300 because of debt", "endorse": True})
    a.post(f"/chambers/{cid}/preround/start")
    assert "SECRET-OTHER" not in str(a.get(f"/chambers/{cid}").json()["preround"])


def test_pause_blocks_release(make_user):
    a, b, cid = two_with_delegates(make_user)
    a.post(f"/chambers/{cid}/preround/start")
    ta = mine(a, cid, "opening")
    b.post(f"/chambers/{cid}/pause")
    r = a.post(f"/preround-turns/{ta['id']}/release", {"text": ta["text"]})
    assert r.status_code == 409 and r.json()["detail"]["code"] == "PAUSED"
