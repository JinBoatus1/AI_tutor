"""Route-level tests for the Course Grade Tracker endpoints (T3).

Minimal app includes only api_routes.router; verify_token + database.grades() are
monkeypatched so the routes exercise the REAL grade_store + grades_serde + grades_report
end-to-end against an in-memory collection.

Run: pytest test_api_grades.py   (from backend/)   [needs full backend requirements installed]
"""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import api_routes
import database

AUTH = {"Authorization": "Bearer fake-token"}


class _Res:
    def __init__(self, deleted_count):
        self.deleted_count = deleted_count


class FakeCollection:
    def __init__(self):
        self.docs = []

    def _match(self, doc, flt):
        return all(doc.get(k) == v for k, v in flt.items())

    def find_one(self, flt):
        for d in self.docs:
            if self._match(d, flt):
                return dict(d)
        return None

    def update_one(self, flt, update, upsert=False):
        for d in self.docs:
            if self._match(d, flt):
                d.update(update["$set"])
                return
        if upsert:
            self.docs.append(dict(update["$set"]))

    def delete_one(self, flt):
        for i, d in enumerate(self.docs):
            if self._match(d, flt):
                del self.docs[i]
                return _Res(1)
        return _Res(0)


def make_client(monkeypatch, email="u@e.com"):
    fake = FakeCollection()
    monkeypatch.setattr(database, "grades", lambda: fake)
    monkeypatch.setattr(api_routes, "verify_token", lambda auth: email if auth else None)
    app = FastAPI()
    app.include_router(api_routes.router)
    return TestClient(app)


def _course():
    return {
        "name": "Discrete Math",
        "term": "Fall 2026",
        "categories": [
            {
                "id": "c1",
                "name": "Exams",
                "weight": 100,
                "rule": {"kind": "uniform", "nSlots": 4},
                "items": [
                    {"id": "e1", "name": "E1", "score": 90, "maxScore": 100},
                    {"id": "e2", "name": "E2", "score": 80, "maxScore": 100},
                    {"id": "e3", "name": "E3", "score": 70, "maxScore": 100},
                    {"id": "final", "name": "Final", "score": None, "maxScore": 100},
                ],
            }
        ],
        "cutoffs": [{"letter": "A", "min": 90}, {"letter": "B", "min": 80}, {"letter": "C", "min": 70}],
    }


# --------------------------------------------------------------------------- #
# Auth gate (server-only, D3): every route 401 without a valid token
# --------------------------------------------------------------------------- #
@pytest.mark.parametrize(
    "method,path,body",
    [
        ("get", "/api/grades", None),
        ("put", "/api/grades", {"course": {}}),
        ("delete", "/api/grades", None),
        ("post", "/api/grades/standing", {"course": {}}),
    ],
)
def test_requires_auth(monkeypatch, method, path, body):
    client = make_client(monkeypatch)
    kwargs = {"json": body} if body is not None else {}  # httpx get/delete take no json=
    resp = getattr(client, method)(path, **kwargs)  # no AUTH header -> verify_token None
    assert resp.status_code == 401


# --------------------------------------------------------------------------- #
# GET / PUT / DELETE happy paths
# --------------------------------------------------------------------------- #
def test_get_empty_returns_null_course(monkeypatch):
    client = make_client(monkeypatch)
    resp = client.get("/api/grades", headers=AUTH)
    assert resp.status_code == 200
    assert resp.json() == {"course": None}


def test_put_then_get_round_trip(monkeypatch):
    client = make_client(monkeypatch)
    put = client.put("/api/grades", json={"course": _course()}, headers=AUTH)
    assert put.status_code == 200
    assert "warnings" in put.json()
    assert isinstance(put.json()["warnings"], list)
    assert "updated_at" in put.json()["course"]

    got = client.get("/api/grades", headers=AUTH).json()["course"]
    assert got["name"] == "Discrete Math"
    assert got["term"] == "Fall 2026"  # rich fields preserved
    assert got["categories"][0]["items"][3]["id"] == "final"  # ids + null item preserved


def test_put_malformed_returns_400(monkeypatch):
    client = make_client(monkeypatch)
    bad = {"course": {"name": "X", "categories": [{"id": "c", "name": "c", "weight": 10,
            "rule": {"kind": "bogus"}, "items": []}], "cutoffs": []}}
    resp = client.put("/api/grades", json=bad, headers=AUTH)
    assert resp.status_code == 400
    assert "Invalid course" in resp.json()["detail"]


def test_put_surfaces_validate_warnings(monkeypatch):
    client = make_client(monkeypatch)
    course = _course()
    course["categories"][0]["weight"] = 50  # weights now sum to 50, not 100
    resp = client.put("/api/grades", json={"course": course}, headers=AUTH)
    assert resp.status_code == 200
    assert any("100" in w for w in resp.json()["warnings"])


def test_delete(monkeypatch):
    client = make_client(monkeypatch)
    client.put("/api/grades", json={"course": _course()}, headers=AUTH)
    resp = client.delete("/api/grades", headers=AUTH)
    assert resp.json() == {"deleted": True}
    assert client.get("/api/grades", headers=AUTH).json() == {"course": None}


# --------------------------------------------------------------------------- #
# POST /api/grades/standing (batched ladder)
# --------------------------------------------------------------------------- #
def test_standing_only(monkeypatch):
    client = make_client(monkeypatch)
    resp = client.post("/api/grades/standing", json={"course": _course()}, headers=AUTH)
    assert resp.status_code == 200
    data = resp.json()
    assert data["ladder"] is None
    assert data["standing"]["percent"] == pytest.approx(80.0)


def test_standing_with_ladder(monkeypatch):
    client = make_client(monkeypatch)
    resp = client.post(
        "/api/grades/standing", json={"course": _course(), "unknownItemId": "final"}, headers=AUTH
    )
    assert resp.status_code == 200
    by_letter = {r["letter"]: r for r in resp.json()["ladder"]}
    assert by_letter["A"]["status"] == "unreachable"
    assert by_letter["B"]["needed"] == pytest.approx(80.0)
    assert by_letter["C"]["needed"] == pytest.approx(40.0)


def test_standing_unknown_item_400(monkeypatch):
    client = make_client(monkeypatch)
    resp = client.post(
        "/api/grades/standing", json={"course": _course(), "unknownItemId": "nope"}, headers=AUTH
    )
    assert resp.status_code == 400
