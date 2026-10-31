"""End-to-end Chamber protocol plus the safety invariants from the PRD acceptance criteria."""

from app.auth import create_session
from app.db import SessionLocal
from app.models import User


def setup_chamber(make_user, n=2):
    users = [make_user(name) for name in ["Priya", "Sam", "Dev"][:n]]
    users[0].make_delegate()
    r = users[0].post("/chambers", {"template": "decision", "title": "March trip", "question": "Where should we go in March, and on what budget?"})
    assert r.status_code == 200, r.text
    ch = r.json()
    for u in users[1:]:
        assert u.post(f"/invites/{ch['invite_token']}/accept").status_code == 200
    return users, ch


TEXTS = {
    "Priya": "We should go to Lisbon because it's cheap and sunny. I want to rest, not rush around.",
    "Sam": "My budget is 600 euros max. I'd like somewhere new to explore, because we always go to the same places.",
    "Dev": "I think the trip will be stressful if we pack too much in.",
}


def submit_all(users, cid):
    for u in users:
        r = u.post(f"/chambers/{cid}/intake", {"text": TEXTS[u.name], "endorse": True})
        assert r.status_code == 200, r.text


def test_full_protocol(make_user):
    users, ch = setup_chamber(make_user, 3)
    cid = ch["id"]
    priya, sam, dev = users

    # AC4-style gate: can't analyze before everyone endorsed
    priya.post(f"/chambers/{cid}/intake", {"text": TEXTS["Priya"], "endorse": True})
    r = priya.post(f"/chambers/{cid}/advance", {"action": "analyze"})
    assert r.status_code == 409 and r.json()["detail"]["code"] == "GATE_NOT_SATISFIED"

    submit_all(users, cid)
    v = priya.post(f"/chambers/{cid}/advance", {"action": "analyze"}).json()
    assert v["state"] == "RESTATEMENT"
    assert v["engine_mode"] == "local"
    assert len(v["restatements"]) == 3

    # AC4: options are locked before the Restatement Gate passes
    r = priya.post(f"/chambers/{cid}/advance", {"action": "explore_options"})
    assert r.status_code == 409

    # Only the person described can accept their restatement
    sam_rst = next(x for x in v["restatements"] if x["of_user_id"] == sam.id)
    assert priya.post(f"/restatements/{sam_rst['id']}/accept").status_code == 403

    # Reject -> revise loop
    v = sam.post(f"/restatements/{sam_rst['id']}/reject", {"feedback": "It's about money more than novelty"}).json()
    sam_rst = next(x for x in v["restatements"] if x["of_user_id"] == sam.id)
    assert sam_rst["revision"] == 2 and sam_rst["status"] == "PENDING"
    assert "money more than novelty" in sam_rst["text"]

    for u in users:
        rid = next(x["id"] for x in u.get(f"/chambers/{cid}").json()["restatements"] if x["is_mine"])
        v = u.post(f"/restatements/{rid}/accept").json()
    assert v["state"] == "MAP"
    m = v["map"]
    assert m["headline"]
    # Invariant 3: "where you stand" is only accepted restatements
    accepted = {x["id"] for x in v["restatements"] if x["status"] == "ACCEPTED"}
    assert {w["restatement_id"] for w in m["where_you_stand"]} <= accepted
    assert len(m["where_you_stand"]) == 3

    v = dev.post(f"/chambers/{cid}/advance", {"action": "explore_options"}).json()
    assert v["state"] == "RESOLUTION" and len(v["options"]) >= 1

    v = priya.post(f"/chambers/{cid}/agreement/items", {"text": "Lisbon, 4 nights, cap 600 euros each"}).json()
    item = v["agreement"]["items"][0]
    assert item["status"] == "PENDING" and item["decisions"] == {}  # never pre-approved
    priya.post(f"/agreement-items/{item['id']}/decide", {"decision": "approve"})
    sam.post(f"/agreement-items/{item['id']}/decide", {"decision": "approve"})
    v = dev.get(f"/chambers/{cid}").json()
    assert v["state"] == "RESOLUTION"
    v = dev.post(f"/agreement-items/{item['id']}/decide", {"decision": "approve"}).json()
    assert v["state"] == "CLOSED" and v["closed_state"] == "AGREED"


def test_service_session_cannot_approve_or_endorse(make_user, client):
    """AC8 / invariant 1: non-human sessions are rejected for endorse/approve/consent."""
    users, ch = setup_chamber(make_user)
    db = SessionLocal()
    svc_token = create_session(db, db.get(User, users[0].id), actor_type="service")
    db.close()
    h = {"Authorization": f"Bearer {svc_token}"}
    r = client.post(f"/api/v1/chambers/{ch['id']}/intake", headers=h, json={"text": "automated text", "endorse": True})
    assert r.status_code == 403 and r.json()["detail"]["code"] == "HUMAN_REQUIRED"
    r = client.post(f"/api/v1/chambers/{ch['id']}/publish/consent", headers=h, json={"consent": True})
    assert r.status_code == 403
    # reading is fine
    assert client.get(f"/api/v1/chambers/{ch['id']}", headers=h).status_code == 200


def test_chamber_scoped_memory_does_not_leak(make_user):
    """AC5: a position endorsed in Chamber X is never available to the Delegate in Chamber Y."""
    alice = make_user("Alice")
    bob = make_user("Bob")
    alice.make_delegate([{"statement": "Weekends should be for rest", "stance": "agree", "topic": "time"}])
    x = alice.post("/chambers", {"template": "disagreement", "title": "Private X", "question": "How should we handle money and rent?"}).json()
    bob.post(f"/invites/{x['invite_token']}/accept")
    secret = "SECRET-X: my rent budget is 900 because of my debt"
    alice.post(f"/chambers/{x['id']}/intake", {"text": secret, "endorse": True})

    # Memory Inspector shows it, scoped to X
    pos = alice.get("/delegates/me/positions").json()
    scoped = [p for p in pos if p["scope_type"] == "CHAMBER"]
    assert scoped and scoped[0]["scope_id"] == x["id"]

    y = alice.post("/chambers", {"template": "disagreement", "title": "Other Y", "question": "How should we handle money and rent?"}).json()
    r = alice.post(f"/chambers/{y['id']}/delegate-draft").json()
    assert "SECRET-X" not in str(r)
    v = alice.get(f"/chambers/{y['id']}").json()
    assert "SECRET-X" not in str(v)

    from app.db import SessionLocal
    from app.protocol import delegate_for, scoped_positions

    db = SessionLocal()
    d = delegate_for(db, alice.id)
    assert any("SECRET-X" in p.statement for p in scoped_positions(db, d.id, x["id"]))
    assert not any("SECRET-X" in p.statement for p in scoped_positions(db, d.id, y["id"]))
    db.close()


def test_other_members_cannot_see_private_intake_text(make_user):
    users, ch = setup_chamber(make_user)
    users[0].post(f"/chambers/{ch['id']}/intake", {"text": "PRIVATE-PRIYA-TEXT here", "endorse": True})
    v = users[1].get(f"/chambers/{ch['id']}").json()
    assert "PRIVATE-PRIYA-TEXT" not in str(v)
    assert next(m for m in v["members"] if m["user_id"] == users[0].id)["intake_status"] == "ENDORSED"


def test_pause_blocks_progress_and_resume_restarts(make_user):
    """AC6: pause takes effect immediately and blocks actions; resume continues."""
    users, ch = setup_chamber(make_user)
    cid = ch["id"]
    submit_all(users, cid)
    v = users[1].post(f"/chambers/{cid}/pause").json()
    assert v["paused"] and v["paused_by"] == "Sam"
    r = users[0].post(f"/chambers/{cid}/advance", {"action": "analyze"})
    assert r.status_code == 409 and r.json()["detail"]["code"] == "PAUSED"
    assert users[0].post(f"/chambers/{cid}/resume").status_code == 403  # only the pauser
    v = users[1].post(f"/chambers/{cid}/resume").json()
    assert not v["paused"]
    v = users[0].post(f"/chambers/{cid}/advance", {"action": "analyze"}).json()
    assert v["state"] == "RESTATEMENT"


def test_safety_screen_pauses_quietly(make_user):
    users, ch = setup_chamber(make_user)
    cid = ch["id"]
    v = users[1].post(f"/chambers/{cid}/intake", {"text": "He checks my phone and I'm not allowed to see friends", "endorse": False}).json()
    assert v["safety_paused"] and v["safety"]["links"]
    other = users[0].get(f"/chambers/{cid}").json()
    assert other["paused"] and other["paused_by"] is None and other["safety"] is None
    assert users[0].post(f"/chambers/{cid}/resume").status_code == 403


def test_publish_requires_everyone_and_anonymizes(make_user, client):
    users, ch = setup_chamber(make_user)
    cid = ch["id"]
    submit_all(users, cid)
    users[0].post(f"/chambers/{cid}/advance", {"action": "analyze"})
    for u in users:
        rid = next(x["id"] for x in u.get(f"/chambers/{cid}").json()["restatements"] if x["is_mine"])
        u.post(f"/restatements/{rid}/accept")
    v = users[0].post(f"/chambers/{cid}/publish/consent", {"consent": True}).json()
    assert v["publication"]["status"] == "PENDING"
    slug = v["publication"]["slug"]
    assert client.get(f"/api/v1/public/maps/{slug}").status_code == 404
    v = users[1].post(f"/chambers/{cid}/publish/consent", {"consent": True}).json()
    assert v["publication"]["status"] == "PUBLISHED"
    pub = client.get(f"/api/v1/public/maps/{slug}").json()
    assert pub["anonymized"] and "Priya" not in str(pub) and "Sam" not in str(pub)
    assert "Participant A" in str(pub)
    # Revocation unpublishes (AC10)
    users[1].post(f"/chambers/{cid}/publish/consent", {"consent": False})
    assert client.get(f"/api/v1/public/maps/{slug}").status_code == 404


def test_delegate_draft_stays_draft_and_uses_endorsed_positions(make_user):
    users, ch = setup_chamber(make_user)
    r = users[0].post(f"/chambers/{ch['id']}/delegate-draft").json()
    assert r["drafted"]
    v = users[0].get(f"/chambers/{ch['id']}").json()
    assert v["my_intake"]["status"] == "DRAFT" and v["my_intake"]["authored_by"] == "delegate"
    # Guests (no Delegate) can still join and write themselves
    assert users[1].post(f"/chambers/{ch['id']}/delegate-draft").status_code == 400


def test_spar_flow(make_user):
    u = make_user("Dev")
    s = u.post("/spar", {"claim": "Rent control makes housing more affordable because it caps prices.", "mode": "devils_advocate", "methodology": "empiricist"}).json()
    assert s["rounds"] == 1
    for _ in range(5):
        s = u.post(f"/spar/{s['id']}/turn", {"response": "Fair point, but the evidence from several cities suggests tenants benefit in the short term at least."}).json()
    assert s["status"] == "FINISHED" and s["report"]["verdict"] in ("robust", "revised", "open")


def test_memory_inspector_edit_and_retract(make_user):
    u = make_user("Alice")
    u.make_delegate()
    pos = u.get("/delegates/me/positions").json()
    pid = pos[0]["id"]
    p = u.patch(f"/delegates/me/positions/{pid}", {"statement": "Costs should be split by income", "changed_mind_because": "a housemate convinced me"}).json()
    assert p["history"][-1]["event"] == "changed mind"
    u.delete(f"/delegates/me/positions/{pid}")
    assert pid not in [x["id"] for x in u.get("/delegates/me/positions").json()]


def test_one_delegate_per_person_and_handle_suffix(make_user):
    u = make_user("Alice")
    d = u.make_delegate()
    assert d["handle"].endswith(".d")
    assert u.post("/delegates", {"name": "Second"}).status_code == 409


def test_under_18_rejected(client):
    r = client.post("/api/v1/auth/login", json={"email": "kid@example.com", "name": "Kid", "is_adult": False})
    assert r.status_code == 400
