"""Delegate Mandate: signed, verifiable, never grants commitment, tamper-evident."""

import copy

from app import mandate


def test_mandate_signed_and_verifiable(make_user, client):
    u = make_user("Mia")
    handle = u.make_delegate()["handle"]
    m = client.get(f"/api/v1/delegates/{handle}/mandate").json()
    body = m["mandate"]
    assert body["may_commit"] is False and body["speaks_as"] == "third_person"
    assert body["position_scopes"] == ["PUBLIC"] and body["may_assert"] == ["ENDORSED"]
    jwk = client.get("/.well-known/argumente-keys.json").json()["keys"][0]
    assert m["signature"]["kid"] == jwk["kid"]
    assert mandate.verify(m, jwk)
    forged = copy.deepcopy(m)
    forged["mandate"]["may_commit"] = True
    assert not mandate.verify(forged, jwk)
    assert client.get("/api/v1/delegates/nobody.d/mandate").status_code == 404
