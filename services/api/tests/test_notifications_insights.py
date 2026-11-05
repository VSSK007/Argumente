"""Notifications (content-free, quiet safety pause stays quiet, opt-out) and the metrics endpoint."""

from app import notify
from app.db import SessionLocal
from tests.test_learning_retention import run_to_map


def inbox(u):
    return u.get("/notifications").json()


def test_notifications_follow_the_protocol_and_stay_generic(make_user):
    a, b, cid = run_to_map(make_user)
    titles_b = [n["title"] for n in inbox(b)["items"]]
    assert "Your turn: is this what you mean?" in titles_b and "The Understanding Map is ready" in titles_b
    # joined: sent to the creator, not to the person who joined
    assert any("joined" in n["title"] for n in inbox(a)["items"]) and not any("joined" in n["title"] for n in inbox(b)["items"])
    blob = str(inbox(a)) + str(inbox(b))
    assert "bathroom" not in blob and "alternate weeks" not in blob  # never anyone's words
    assert inbox(b)["unread"] > 0
    assert b.post("/notifications/read", {}).json()["unread"] == 0


def test_quiet_safety_pause_notifies_nobody(make_user):
    a, b = make_user("Ana"), make_user("Ben")
    ch = a.post("/chambers", {"template": "household", "title": "Quiet", "question": "How do we handle money here?"}).json()
    b.post(f"/invites/{ch['invite_token']}/accept")
    before = inbox(a)["unread"]
    b.post(f"/chambers/{ch['id']}/intake", {"text": "He checks my phone and I'm not allowed to see friends", "endorse": False})
    assert inbox(a)["unread"] == before
    assert not any("paused" in n["title"] for n in inbox(a)["items"])
    # an ordinary pause does notify the others
    b.post(f"/chambers/{ch['id']}/resume")
    a.post(f"/chambers/{ch['id']}/pause")
    assert any("paused" in n["title"] for n in inbox(b)["items"])


def test_email_respects_opt_out_and_needs_smtp(make_user, monkeypatch):
    a, b, cid = run_to_map(make_user)
    assert notify.email_pending() == 0  # console delivery: nothing is emailed
    sent = []
    monkeypatch.setenv("SMTP_HOST", "smtp.test")
    monkeypatch.setattr(notify.mailer, "send", lambda to, subject, body: sent.append((to, subject, body)))
    b.patch("/me/notification-settings", {"email": False})
    notify.email_pending()
    recipients = {s[0] for s in sent}
    assert a.get("/me").json()["email"] in recipients and b.get("/me").json()["email"] not in recipients
    assert all("bathroom" not in s[2] for s in sent)
    n = len(sent)
    notify.email_pending()  # already emailed + cooldown: no repeats
    assert len(sent) == n


def test_feedback_and_metrics(make_user, monkeypatch):
    monkeypatch.setenv("ADMIN_EMAILS", "metrics@example.com")
    a, b, cid = run_to_map(make_user)
    assert a.post(f"/chambers/{cid}/feedback", {"useful": 4}).status_code == 409  # not closed
    a.post(f"/chambers/{cid}/advance", {"action": "close_understood"})
    assert a.post(f"/chambers/{cid}/feedback", {"useful": 4, "understood": True, "note": "Clearer than the group chat"}).status_code == 200
    a.post(f"/chambers/{cid}/feedback", {"useful": 5, "understood": True})  # editable
    assert b.get(f"/chambers/{cid}/feedback").json() == {"given": False, "useful": None, "understood": None}
    assert b.get("/admin/metrics").status_code == 403
    from fastapi.testclient import TestClient
    from app.main import app

    c = TestClient(app)
    tok = c.post("/api/v1/auth/login", json={"email": "metrics@example.com", "name": "M", "is_adult": True}).json()["token"]
    m = c.get("/api/v1/admin/metrics", headers={"Authorization": f"Bearer {tok}"}).json()
    assert m["feedback"]["avg_useful"] == 5.0 and m["feedback"]["understand_better"] == 1.0
    steps = {f["step"]: f["n"] for f in m["funnel"]}
    assert steps["Restatement gate passed"] >= 1 and steps["Closed"] >= 1
    assert m["restatements"]["accepted_first_try"] is not None
    assert "bathroom" not in str(m) and "alternate" not in str(m)  # aggregates only
