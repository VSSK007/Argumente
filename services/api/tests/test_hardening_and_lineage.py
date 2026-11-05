"""Stream tickets, rate limits, agree-to-disagree records and revisits."""

import time

from app import auth, ratelimit
from tests.test_learning_retention import run_to_map


def test_stream_requires_short_lived_scoped_ticket(make_user, client):
    a, b = make_user("Alice"), make_user("Mallory")
    ch = a.post("/chambers", {"template": "decision", "title": "Trip", "question": "Where shall we go?"}).json()
    # Old style (session token in URL) no longer works
    assert client.get(f"/api/v1/chambers/{ch['id']}/stream?token={a.token}").status_code == 422
    # Non-members can't get a ticket
    assert b.post(f"/chambers/{ch['id']}/stream-ticket").status_code == 403
    t = a.post(f"/chambers/{ch['id']}/stream-ticket").json()["ticket"]
    assert auth.read_ticket(t, f"stream:{ch['id']}") == a.id
    assert auth.read_ticket(t, "stream:chm_other") is None  # scope-bound
    assert auth.read_ticket(t[:-2] + "xx", f"stream:{ch['id']}") is None  # tamper-proof
    expired = auth.make_ticket(a.id, f"stream:{ch['id']}", ttl=-1)
    assert client.get(f"/api/v1/chambers/{ch['id']}/stream?ticket={expired}").status_code == 403


def test_rate_limit_on_engine_actions(make_user, monkeypatch):
    monkeypatch.setitem(ratelimit.LIMITS, "create", (2, 3600))
    ratelimit.reset()
    u = make_user("Busy")
    for _ in range(2):
        assert u.post("/chambers", {"template": "decision", "title": "Trip", "question": "Where shall we go?"}).status_code == 200
    r = u.post("/chambers", {"template": "decision", "title": "Trip", "question": "Where shall we go?"})
    assert r.status_code == 429 and r.json()["detail"]["code"] == "RATE_LIMITED"
    assert make_user("Other").post("/chambers", {"template": "decision", "title": "Trip", "question": "Where shall we go?"}).status_code == 200
    ratelimit.reset()


def test_agree_to_disagree_record(make_user):
    a, b, cid = run_to_map(make_user)
    # Not available before closing as understood
    r = a.post(f"/chambers/{cid}/agreement/items", {"text": "We'll alternate", "kind": "understanding"})
    assert r.status_code == 409
    a.post(f"/chambers/{cid}/advance", {"action": "close_understood"})
    v = a.post(f"/chambers/{cid}/agreement/items", {"text": "We still differ on fairness; we'll alternate months and review in June.", "kind": "understanding"}).json()
    item = next(i for i in v["agreement"]["items"] if i["kind"] == "understanding")
    assert item["status"] == "PENDING" and item["decisions"] == {}
    a.post(f"/agreement-items/{item['id']}/decide", {"decision": "approve"})
    v = b.post(f"/agreement-items/{item['id']}/decide", {"decision": "approve"}).json()
    rec = next(i for i in v["agreement"]["items"] if i["id"] == item["id"])
    assert rec["status"] == "APPROVED" and v["state"] == "CLOSED" and v["closed_state"] == "UNDERSTOOD"
    # Regular agreement items stay closed after the Chamber closes
    assert a.post(f"/chambers/{cid}/agreement/items", {"text": "x y z"}).status_code == 409


def test_revisit_links_outcome_for_previous_members_only(make_user):
    a, b, cid = run_to_map(make_user)
    a.post(f"/chambers/{cid}/advance", {"action": "close_understood"})
    v = a.post(f"/chambers/{cid}/agreement/items", {"text": "We'll alternate months.", "kind": "understanding"}).json()
    iid = v["agreement"]["items"][0]["id"]
    a.post(f"/agreement-items/{iid}/decide", {"decision": "approve"})
    b.post(f"/agreement-items/{iid}/decide", {"decision": "approve"})

    new = b.post(f"/chambers/{cid}/revisit").json()
    assert new["state"] == "INTAKE" and new["title"].startswith("Revisit:")
    assert {m["name"] for m in new["members"]} == {"Alice", "Bob"}
    assert new["lineage"]["parent"]["approved"][0]["text"] == "We'll alternate months."
    assert a.get(f"/chambers/{cid}").json()["lineage"]["revisits"][0]["id"] == new["id"]

    # Someone new who joins the revisit doesn't see the earlier outcome
    c = make_user("Newcomer")
    c.post(f"/invites/{new['invite_token']}/accept")
    assert c.get(f"/chambers/{new['id']}").json()["lineage"]["parent"] is None
    # Open Chambers can't be revisited
    assert a.post(f"/chambers/{new['id']}/revisit").status_code == 409


def test_database_url_normalised_for_hosts():
    from app.db import normalize_url

    assert normalize_url("postgres://u:p@h:5432/d") == "postgresql+psycopg://u:p@h:5432/d"
    assert normalize_url("postgresql://u@h/d?sslmode=require") == "postgresql+psycopg://u@h/d?sslmode=require"
    assert normalize_url("postgresql+psycopg://u@h/d") == "postgresql+psycopg://u@h/d"
    assert normalize_url("sqlite:///x.db") == "sqlite:///x.db"
