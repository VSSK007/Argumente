"""Decision Replay (sealed predictions) and the Rehearsal Room (public positions only, owner opt-in)."""

from tests.test_learning_retention import run_to_map


def test_predictions_sealed_until_revisit_then_reviewable(make_user):
    a, b, cid = run_to_map(make_user)
    assert a.post(f"/chambers/{cid}/prediction", {"text": "We'll be fine", "confidence": 70}).status_code == 409  # not closed yet
    a.post(f"/chambers/{cid}/advance", {"action": "close_understood"})
    a.post(f"/chambers/{cid}/prediction", {"text": "We'll still argue about the bathroom by spring", "confidence": 70})
    b.post(f"/chambers/{cid}/prediction", {"text": "Alternating will just work", "confidence": 85})

    va = a.get(f"/chambers/{cid}").json()["predictions"]
    assert va["sealed"] and va["count"] == 2 and va["all"] is None
    assert va["mine"]["text"].startswith("We'll still argue")
    assert "Alternating" not in str(a.get(f"/chambers/{cid}").json())  # Bob's stays sealed from Alice
    assert a.post(f"/chambers/{cid}/prediction/review", {"verdict": "right"}).status_code == 409

    new = a.post(f"/chambers/{cid}/revisit").json()
    preds = new["lineage"]["parent"]["predictions"]
    assert not preds["sealed"] and {p["name"] for p in preds["all"]} == {"Alice", "Bob"}
    # sealed for edits now, open for review
    assert a.post(f"/chambers/{cid}/prediction", {"text": "changed my mind", "confidence": 10}).status_code == 409
    v = a.post(f"/chambers/{cid}/prediction/review", {"verdict": "partly", "note": "Only once"}).json()
    assert v["predictions"]["mine"]["verdict"] == "partly"
    # Newcomers to the revisit never see the earlier predictions
    c = make_user("New")
    c.post(f"/invites/{new['invite_token']}/accept")
    assert c.get(f"/chambers/{new['id']}").json()["lineage"]["parent"] is None


def test_rehearsal_requires_opt_in_and_uses_public_positions_only(make_user):
    owner, visitor = make_user("Bob"), make_user("Cara")
    owner.make_delegate([
        {"statement": "Rent should be split equally because we share the common rooms", "stance": "agree", "topic": "money", "scope_type": "PUBLIC"},
        {"statement": "PRIVATE-NOTE rent matters because I am in debt", "stance": "agree", "topic": "money", "scope_type": "PRIVATE"},
    ])
    handle = owner.get("/delegates/me").json()["handle"]
    # Also a Chamber-scoped secret
    ch = owner.post("/chambers", {"template": "household", "title": "Rent", "question": "How should we split rent?"}).json()
    visitor.post(f"/invites/{ch['invite_token']}/accept")
    owner.post(f"/chambers/{ch['id']}/intake", {"text": "CHAMBER-SECRET rent: I can only pay 500", "endorse": True})

    r = visitor.post("/rehearsals", {"handle": handle, "topic": "How should we split the rent?"})
    assert r.status_code == 403  # not opted in
    owner.patch("/delegates/me", {"allow_rehearsal": True})
    assert owner.post("/rehearsals", {"handle": handle, "topic": "How should we split rent?"}).status_code == 400  # not yourself

    s = visitor.post("/rehearsals", {"handle": handle, "topic": "How should we split the rent?"}).json()
    assert s["mode"] == "rehearsal" and s["target"]["owner_name"] == "Bob"
    for _ in range(2):
        s = visitor.post(f"/spar/{s['id']}/turn", {"response": "I think rent should depend on room size, it's only fair."}).json()
    blob = str(s)
    assert "PRIVATE-NOTE" not in blob and "CHAMBER-SECRET" not in blob
    assert "Rent should be split equally" in blob
    assert "I, Bob" not in blob

    assert owner.get("/delegates/me").json()["rehearsal_count"] == 1
    # Owner opts out: further turns are refused
    owner.patch("/delegates/me", {"allow_rehearsal": False})
    assert visitor.post(f"/spar/{s['id']}/turn", {"response": "And chores?"}).status_code == 403
    fin = visitor.post(f"/spar/{s['id']}/finish").json()
    assert fin["status"] == "FINISHED" and fin["report"]["what_to_strengthen"]
