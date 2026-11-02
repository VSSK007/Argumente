"""Public topics: opinion groups found, consensus/divisive detected, anonymity, small groups suppressed."""

from app.auth import create_session
from app.db import SessionLocal
from app.models import User
from app.topics import analyze

STATEMENTS = [
    "Rent should be split by room size",
    "Shared rooms are most of what rent pays for",
    "Whoever has the biggest room should pay more",
    "Flatmates should agree a rule before anyone moves in",
    "Fairness matters more than simplicity here",
]


def make_topic(make_user):
    creator = make_user("Host")
    slug = creator.post("/topics", {"question": "How should flatmates split rent?", "seed_statements": STATEMENTS}).json()["slug"]
    return creator, slug


def vote_all(u, slug, pattern):
    t = u.get(f"/topics/{slug}").json()
    for st, v in zip(t["statements"], pattern):
        assert u.post(f"/topic-statements/{st['id']}/vote", {"vote": v}).status_code == 200


def test_groups_consensus_divisive_and_anonymity(make_user):
    creator, slug = make_topic(make_user)
    by_size = [1, -1, 1, 1, 1]  # camp A: split by room size
    equal = [-1, 1, -1, 1, -1]  # camp B: equal rent
    people = [make_user(f"P{i}") for i in range(8)]
    for i, p in enumerate(people):
        vote_all(p, slug, by_size if i < 4 else equal)

    t = people[0].get(f"/topics/{slug}").json()
    assert t["participants"] == 8 and t["mapped"] == 8
    assert len(t["groups"]) == 2 and all(g["size"] == 4 for g in t["groups"])
    assert t["my_group"] in ("A", "B")
    assert [c["text"] for c in t["consensus"]] == ["Flatmates should agree a rule before anyone moves in"]
    assert {d["text"] for d in t["divisive"]} >= {"Rent should be split by room size"}
    me_pts = [p for p in t["points"] if p["me"]]
    assert len(me_pts) == 1
    # Anonymous: no user ids or names anywhere in the public response
    public = make_user("Outsider").get(f"/topics/{slug}").json()
    blob = str(public)
    assert not any(p.id in blob for p in people) and "P0" not in blob and creator.id not in blob
    assert public["my_group"] is None and not any(p["me"] for p in public["points"])


def test_small_groups_are_never_shown(make_user):
    _, slug = make_topic(make_user)
    for i in range(4):  # only 4 voters: a group of 2 would expose individual votes
        vote_all(make_user(f"Q{i}"), slug, [1, -1, 1, 1, 1] if i < 2 else [-1, 1, -1, 1, -1])
    t = make_user("Look").get(f"/topics/{slug}").json()
    assert t["groups"] == [] and t["consensus"] == [] and t["divisive"] == []
    assert t["statements"][0]["agree"] == 2  # overall counts are fine


def test_only_humans_vote_and_moderation(make_user, client):
    creator, slug = make_topic(make_user)
    u = make_user("Voter")
    st = u.get(f"/topics/{slug}").json()["statements"][0]
    db = SessionLocal()
    svc = create_session(db, db.get(User, u.id), actor_type="service")
    db.close()
    r = client.post(f"/api/v1/topic-statements/{st['id']}/vote", headers={"Authorization": f"Bearer {svc}"}, json={"vote": 1})
    assert r.status_code == 403  # no automated / Delegate votes
    assert u.post(f"/topics/{slug}/statements", {"text": "He hits me when I'm late with rent"}).status_code == 400  # safety screen
    assert u.post(f"/topics/{slug}/statements", {"text": STATEMENTS[0]}).status_code == 409  # duplicate
    assert u.post(f"/topic-statements/{st['id']}/hide").status_code == 403
    assert creator.post(f"/topic-statements/{st['id']}/hide").status_code == 200
    assert st["id"] not in str(u.get(f"/topics/{slug}").json()["statements"])
    creator.post(f"/topics/{slug}/close")
    assert u.post(f"/topics/{slug}/statements", {"text": "A brand new point"}).status_code == 409


def test_analyze_needs_enough_people():
    assert analyze(["a", "b"], [("u1", "a", 1), ("u1", "b", 1)])["groups"] == []
