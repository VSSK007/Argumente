"""Delegate learning suggestions (never auto-kept) and Chamber retention (D21)."""

from datetime import timedelta

from app import retention
from app.db import SessionLocal, now
from app.models import Chamber, Intake, Position
from app.protocol import delegate_for, scoped_positions

Q = {"template": "household", "title": "Chores", "question": "How should we split the chores in the flat?"}
ALICE = "Chores should be split by time spent, because the bathroom takes far longer than the bins. I work late on Tuesdays."
BOB = "We should just alternate weeks. A time log will create more arguments, not fewer."


def run_to_map(make_user):
    a, b = make_user("Alice"), make_user("Bob")
    a.make_delegate()
    ch = a.post("/chambers", Q).json()
    cid = ch["id"]
    b.post(f"/invites/{ch['invite_token']}/accept")
    a.post(f"/chambers/{cid}/intake", {"text": ALICE, "endorse": True})
    b.post(f"/chambers/{cid}/intake", {"text": BOB, "endorse": True})
    a.post(f"/chambers/{cid}/advance", {"action": "analyze"})
    for u in (a, b):
        rid = next(x["id"] for x in u.get(f"/chambers/{cid}").json()["restatements"] if x["is_mine"])
        u.post(f"/restatements/{rid}/accept")
    return a, b, cid


def test_close_suggests_candidates_that_are_unused_until_kept(make_user):
    a, b, cid = run_to_map(make_user)
    v = a.post(f"/chambers/{cid}/advance", {"action": "close_understood"}).json()
    assert v["state"] == "CLOSED" and v["retention"]["retain_until"]

    cands = a.get("/delegates/me/candidates").json()
    assert cands, "expected at least one suggestion"
    for c in cands:
        assert c["quote"].lower() in ALICE.lower()  # backed by her own words
    assert b.get("/delegates/me/candidates").json() == []  # guests get nothing; and never someone else's

    # Not in the Memory Inspector list and never used by the Delegate until kept
    assert not any(p["status"] == "CANDIDATE" for p in a.get("/delegates/me/positions").json())
    db = SessionLocal()
    d = delegate_for(db, a.id)
    assert not any(p.status != "ENDORSED" for p in scoped_positions(db, d.id, None))
    db.close()

    kept = a.post(f"/delegates/me/candidates/{cands[0]['id']}/keep", {"scope_type": "PRIVATE"}).json()
    assert kept["status"] == "ENDORSED" and kept["scope_type"] == "PRIVATE" and kept["scope_id"] is None
    if len(cands) > 1:
        assert a.post(f"/delegates/me/candidates/{cands[1]['id']}/discard").json()["discarded"]
    assert b.post(f"/delegates/me/candidates/{cands[0]['id']}/keep", {}).status_code in (403, 404)


def test_retention_purges_private_content_but_keeps_what_owner_kept(make_user, client):
    a, b, cid = run_to_map(make_user)
    a.post(f"/chambers/{cid}/advance", {"action": "close_understood"})
    cands = a.get("/delegates/me/candidates").json()
    kept_id = cands[0]["id"]
    a.post(f"/delegates/me/candidates/{kept_id}/keep", {})

    # Extending pushes the date out
    before = a.get(f"/chambers/{cid}").json()["retention"]["retain_until"]
    after = a.post(f"/chambers/{cid}/retention/extend").json()["retention"]["retain_until"]
    assert after > before

    db = SessionLocal()
    ch = db.get(Chamber, cid)
    ch.retain_until = now() - timedelta(days=1)
    db.commit()
    assert retention.purge_expired(db) == 1
    assert db.query(Intake).filter(Intake.chamber_id == cid).count() == 0
    assert not db.query(Position).filter(Position.scope_type == "CHAMBER", Position.scope_id == cid).count()
    assert db.get(Position, kept_id) is not None  # the owner's choice survives
    db.close()

    v = a.get(f"/chambers/{cid}").json()
    assert v["retention"]["purged"] and v["map"] is None and v["restatements"] == []
    assert a.post(f"/chambers/{cid}/retention/extend").status_code == 409
