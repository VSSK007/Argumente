"""Steelman Exchange, Understanding Score, evidence board, Position Record."""

from tests.test_learning_retention import run_to_map


def three_at_restatement(make_user):
    a, b, c = make_user("Ana"), make_user("Ben"), make_user("Cy")
    ch = a.post("/chambers", {"template": "decision", "title": "Trip", "question": "Where should we go this summer?"}).json()
    for u in (b, c):
        u.post(f"/invites/{ch['invite_token']}/accept")
    texts = {
        a: "We should go to the coast because I want to rest. Hiking trips always feel rushed.",
        b: "We should go hiking in the mountains because it's cheaper. Beaches are boring for a whole week.",
        c: "I think a city break is the fairest option. My budget is 400 euros.",
    }
    for u, t in texts.items():
        u.post(f"/chambers/{ch['id']}/intake", {"text": t, "endorse": True})
    v = a.post(f"/chambers/{ch['id']}/advance", {"action": "analyze"}).json()
    assert v["state"] == "RESTATEMENT"
    return a, b, c, ch["id"]


def test_steelman_private_until_accepted(make_user):
    a, b, c, cid = three_at_restatement(make_user)
    v = a.post(f"/chambers/{cid}/steelmen", {"subject_id": b.id, "text": "Ben wants mountains mainly because it costs less, and a beach week bores him."}).json()
    sm = v["steelmen"]["items"][0]
    assert sm["is_mine"] and sm["rating"] is None
    assert c.get(f"/chambers/{cid}").json()["steelmen"]["items"] == []  # Cy can't see an unrated attempt
    assert a.post(f"/steelmen/{sm['id']}/rate", {"rating": 5}).status_code == 403  # only the subject rates
    assert a.post(f"/chambers/{cid}/steelmen", {"subject_id": a.id, "text": "my own view is great really"}).status_code == 400

    b.post(f"/steelmen/{sm['id']}/rate", {"rating": 2, "feedback": "It's not only money"})
    assert c.get(f"/chambers/{cid}").json()["steelmen"]["items"] == []  # low rating stays private
    mine = a.get(f"/chambers/{cid}").json()["steelmen"]["items"][0]
    assert mine["feedback"] == "It's not only money"

    v = a.post(f"/chambers/{cid}/steelmen", {"subject_id": b.id, "text": "Ben wants mountains: cheaper, more active, and a week on a beach feels wasted to him."}).json()
    second = next(x for x in v["steelmen"]["items"] if x["is_mine"])
    assert second["attempt"] == 2
    b.post(f"/steelmen/{second['id']}/rate", {"rating": 4})
    seen = c.get(f"/chambers/{cid}").json()["steelmen"]["items"]
    assert len(seen) == 1 and seen[0]["accepted"] and seen[0]["feedback"] is None  # visible, feedback still private


def test_understanding_score_before_and_after(make_user):
    a, b, c, cid = three_at_restatement(make_user)
    q = a.get(f"/chambers/{cid}").json()["quiz"]
    items = [i["id"] for i in q["items"]]
    assert 3 <= len(items) <= 6
    assert all(i["text"] for i in q["items"])

    def answers(fill):
        return {i: fill for i in items}

    # Incomplete submissions are rejected
    assert a.post(f"/chambers/{cid}/quiz", {"phase": "pre", "self_answers": answers("agree"), "predictions": {b.id: answers("agree")}}).status_code == 400
    # Everyone: self = agree. Ana guesses wrong before, right after.
    for u in (a, b, c):
        others = [x.id for x in (a, b, c) if x is not u]
        guess = "disagree" if u is a else "agree"
        r = u.post(f"/chambers/{cid}/quiz", {"phase": "pre", "self_answers": answers("agree"), "predictions": {o: answers(guess) for o in others}})
        assert r.status_code == 200, r.text
    assert a.post(f"/chambers/{cid}/quiz", {"phase": "pre", "predictions": {b.id: answers("agree"), c.id: answers("agree")}}).status_code == 409  # locked

    va = a.get(f"/chambers/{cid}").json()["quiz"]
    assert all(m["pre"] == 0.0 for m in va["mine"])
    # Others never see Ana's individual score, only the group average
    vb = b.get(f"/chambers/{cid}").json()["quiz"]
    assert all(m["about_id"] != b.id for m in vb["mine"]) and vb["group"]["pre"] is not None

    assert a.post(f"/chambers/{cid}/quiz", {"phase": "post", "predictions": {b.id: answers("agree"), c.id: answers("agree")}}).status_code == 409  # not yet
    for u in (a, b, c):
        rid = next(x["id"] for x in u.get(f"/chambers/{cid}").json()["restatements"] if x["is_mine"])
        u.post(f"/restatements/{rid}/accept")
    a.post(f"/chambers/{cid}/quiz", {"phase": "post", "predictions": {b.id: answers("agree"), c.id: answers("agree")}})
    va = a.get(f"/chambers/{cid}").json()["quiz"]
    assert all(m["pre"] == 0.0 and m["post"] == 1.0 for m in va["mine"])


def test_evidence_board_and_record(make_user):
    a, b, cid = run_to_map(make_user)
    v = a.get(f"/chambers/{cid}").json()
    diff = next(n for n in v["graph"]["nodes"] if n["kind"] == "DISAGREEMENT")
    assert a.post(f"/chambers/{cid}/evidence", {"target_id": "nope", "text": "x y z", "stance": "context"}).status_code == 400
    assert a.post(f"/chambers/{cid}/evidence", {"target_id": diff["id"], "text": "A source", "url": "javascript:alert(1)", "stance": "supports"}).status_code == 400
    v = a.post(f"/chambers/{cid}/evidence", {"target_id": diff["id"], "text": "Cleaning time survey", "url": "https://example.org/survey", "stance": "supports"}).json()
    ev = v["evidence"][0]
    assert ev["author_name"] == "Alice" and ev["is_mine"]
    assert b.get(f"/chambers/{cid}").json()["evidence"][0]["is_mine"] is False
    assert b.delete(f"/evidence/{ev['id']}").status_code == 403

    # Position Record: private by default, public only when opted in and marked public
    a.post("/me/mind-changes", {"text": "I now think alternating weeks is fairer than a time log", "chamber_id": cid})
    rec = a.post("/me/mind-changes", {"text": "Rest matters more to me than I admitted", "is_public": True})
    handle = a.get("/delegates/me").json()["handle"]
    assert b.get(f"/delegates/{handle}").json()["record"] is None  # not opted in
    a.patch("/delegates/me", {"show_record": True})
    pub = b.get(f"/delegates/{handle}").json()["record"]
    assert [m["text"] for m in pub["mind_changes"]] == ["Rest matters more to me than I admitted"]
    assert "chamber_id" not in pub["mind_changes"][0]
    assert len(a.get("/me/record").json()["mind_changes"]) == 2
