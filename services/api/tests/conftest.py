import os
import tempfile

_tmp = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}/test.db"
os.environ["ENGINE_SYNC"] = "1"
os.environ["ENGINE_PROVIDER"] = "local"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

API = "/api/v1"


@pytest.fixture
def client():
    return TestClient(app)


class U:
    def __init__(self, client, name):
        self.c = client
        self.name = name
        r = client.post(f"{API}/auth/login", json={"email": f"{name.lower()}-{os.urandom(3).hex()}@example.com", "name": name, "is_adult": True})
        assert r.status_code == 200, r.text
        self.token = r.json()["token"]
        self.id = r.json()["user"]["id"]

    @property
    def h(self):
        return {"Authorization": f"Bearer {self.token}"}

    def get(self, path, **kw):
        return self.c.get(API + path, headers=self.h, **kw)

    def post(self, path, json=None):
        return self.c.post(API + path, headers=self.h, json=json or {})

    def patch(self, path, json=None):
        return self.c.patch(API + path, headers=self.h, json=json or {})

    def delete(self, path):
        return self.c.delete(API + path, headers=self.h)

    def make_delegate(self, answers=None):
        answers = answers or [
            {"statement": "Splitting shared costs equally is fair even when incomes differ", "stance": "disagree", "topic": "money", "why": "people earn different amounts"},
            {"statement": "On a group trip, rest matters more than seeing everything", "stance": "agree", "topic": "travel"},
        ]
        r = self.post("/delegates", {"name": f"{self.name}'s Delegate", "methodology": "pragmatist", "answers": answers})
        assert r.status_code == 200, r.text
        return r.json()


@pytest.fixture
def make_user(client):
    return lambda name: U(client, name)
