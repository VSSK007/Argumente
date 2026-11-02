"""Seed demo data: `uv run python -m app.seed`.

Creates three local accounts (priya@demo.local, sam@demo.local, dev@demo.local), each with a Delegate,
one Chamber that has reached the Understanding Map, one Chamber waiting at intake, and a published Map.
Runs through the real API so every invariant applies.
"""

import os

os.environ.setdefault("ENGINE_SYNC", "1")

from fastapi.testclient import TestClient  # noqa: E402

from .main import app  # noqa: E402

c = TestClient(app)
API = "/api/v1"


def login(email, name):
    r = c.post(f"{API}/auth/login", json={"email": email, "name": name, "is_adult": True}).json()
    return {"Authorization": f"Bearer {r['token']}"}, r["user"]


def ensure_delegate(h, name, answers):
    if c.get(f"{API}/delegates/me", headers=h).status_code == 200:
        return
    c.post(f"{API}/delegates", headers=h, json={"name": name, "methodology": "pragmatist", "answers": answers}).raise_for_status()


def main():
    priya, _ = login("priya@demo.local", "Priya")
    sam, _ = login("sam@demo.local", "Sam")
    dev, _ = login("dev@demo.local", "Dev")
    ensure_delegate(priya, "Juniper", [
        {"statement": "On a group trip, rest matters more than seeing everything", "stance": "agree", "topic": "travel", "why": "holidays are when I recover"},
        {"statement": "People who earn more should pay a bigger share of group costs", "stance": "agree", "topic": "money", "scope_type": "PUBLIC"},
        {"statement": "Group decisions should be made by majority vote", "stance": "disagree", "topic": "decisions", "why": "the minority ends up resentful"},
    ])
    ensure_delegate(sam, "Atlas", [
        {"statement": "Splitting shared costs equally is fair even when incomes differ", "stance": "disagree", "topic": "money"},
        {"statement": "Plans made in advance should only change if everyone agrees", "stance": "agree", "topic": "time"},
    ])
    ensure_delegate(dev, "Kestrel", [
        {"statement": "Being direct is kinder than being diplomatic", "stance": "agree", "topic": "honesty"},
    ])

    existing = c.get(f"{API}/chambers", headers=priya).json()
    if any(x["title"] == "March trip" for x in existing):
        print("Demo data already present.")
        return

    ch = c.post(f"{API}/chambers", headers=priya, json={"template": "decision", "title": "March trip", "question": "Where should we go in March, and what's our budget?"}).json()
    c.post(f"{API}/invites/{ch['invite_token']}/accept", headers=sam)
    c.post(f"{API}/chambers/{ch['id']}/intake", headers=priya, json={"endorse": True, "text": "We should go to Lisbon because it's sunny and cheap in March. I want to rest, not rush between sights. I'd rather do fewer things properly."})
    c.post(f"{API}/chambers/{ch['id']}/intake", headers=sam, json={"endorse": True, "text": "My budget is 600 euros max, because I'm saving for a deposit. I'd like somewhere new to explore since we always end up in the same kind of place. A beach week would feel like a waste of my one trip this year."})
    c.post(f"{API}/chambers/{ch['id']}/advance", headers=priya, json={"action": "analyze"}).raise_for_status()
    for h in (priya, sam):
        v = c.get(f"{API}/chambers/{ch['id']}", headers=h).json()
        rid = next(r["id"] for r in v["restatements"] if r["is_mine"])
        c.post(f"{API}/restatements/{rid}/accept", headers=h)
    for h in (priya, sam):
        c.post(f"{API}/chambers/{ch['id']}/publish/consent", headers=h, json={"consent": True})

    ch2 = c.post(f"{API}/chambers", headers=sam, json={"template": "household", "title": "Flat chores", "question": "How should we split the chores in the flat?"}).json()
    c.post(f"{API}/invites/{ch2['invite_token']}/accept", headers=dev)
    c.post(f"{API}/chambers/{ch2['id']}/intake", headers=dev, json={"endorse": True, "text": "Chores should be split by time, because cleaning the bathroom takes far longer than taking out the bins. I work late on weekdays so I'd rather do a big clean on Sunday."})
    # A public topic with enough anonymous demo voters for the opinion landscape to appear
    if not c.get(f"{API}/topics").json():
        slug = c.post(f"{API}/topics", headers=dev, json={
            "question": "How should flatmates split rent?",
            "description": "A demo topic. Vote, add statements, and watch opinion groups form.",
            "seed_statements": [
                "Rent should be split by room size",
                "Shared rooms are most of what rent pays for",
                "Whoever has the biggest room should pay more",
                "Flatmates should agree a rule before anyone moves in",
                "Income should affect how much each person pays",
                "Simple and equal beats perfectly fair",
            ],
        }).json()["slug"]
        sts = c.get(f"{API}/topics/{slug}").json()["statements"]
        camps = [[1, -1, 1, 1, 0, -1], [-1, 1, -1, 1, -1, 1], [1, 1, 0, 1, 1, -1]]
        for i in range(9):
            h, _ = login(f"voter{i}@demo.local", f"Voter {i}")
            for st, v in zip(sts, camps[i % 3]):
                c.post(f"{API}/topic-statements/{st['id']}/vote", headers=h, json={"vote": v})

    print("Seeded. Sign in as priya@demo.local, sam@demo.local or dev@demo.local (any of them from the login page).")


if __name__ == "__main__":
    main()
