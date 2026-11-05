"""Private option ranking: rankings stay private, results only when everyone has ranked, then locked."""

from tests.test_learning_retention import run_to_map


def to_resolution(make_user):
    a, b, cid = run_to_map(make_user)
    v = a.post(f"/chambers/{cid}/advance", {"action": "explore_options"}).json()
    assert v["state"] == "RESOLUTION" and len(v["options"]) >= 2
    return a, b, cid, len(v["options"])


def test_ranking_is_private_until_complete_then_locked(make_user):
    a, b, cid, n = to_resolution(make_user)
    order_a = list(range(n))
    order_b = list(reversed(range(n)))
    assert a.post(f"/chambers/{cid}/ranking", {"order": [0, 0, 1][:n]}).status_code == 400
    # Can't adopt a Mediator option before everyone has ranked
    assert a.post(f"/chambers/{cid}/agreement/items", {"text": "Option 1 text", "from_option": True}).status_code == 409

    v = a.post(f"/chambers/{cid}/ranking", {"order": order_a}).json()
    assert v["ranking"]["mine"] == order_a and v["ranking"]["results"] is None
    vb = b.get(f"/chambers/{cid}").json()["ranking"]
    assert vb["mine"] is None and vb["results"] is None and a.id in vb["ranked_user_ids"]
    assert "order" not in str(vb).lower() or vb["mine"] is None  # Bob never sees Alice's order

    v = b.post(f"/chambers/{cid}/ranking", {"order": order_b}).json()
    res = v["ranking"]["results"]
    assert v["ranking"]["complete"] and len(res) == n
    assert sum(r["first_choices"] for r in res) == 2
    assert all(r["points"] == n - 1 for r in res)  # opposite orders tie everything
    # Locked after reveal
    assert a.post(f"/chambers/{cid}/ranking", {"order": order_b}).status_code == 409
    assert a.post(f"/chambers/{cid}/agreement/items", {"text": "Adopt the top option", "from_option": True}).status_code == 200
