"""Route tests for POST /api/feedback (spec §4).

The app is minimal: only api_routes.router. verify_token, the GitHub sender and the MongoDB
collection are replaced; feedback.py's validation, formatting and rate limiter run for real.

Run from backend/: pytest test_feedback_api.py --ignore=test_output.txt
"""

import json
import urllib.error
import urllib.request

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import api_routes
import database
import feedback as fb

REAL_CREATE_GITHUB_ISSUE = fb.create_github_issue
TOKEN = "github_pat_test_secret_123"
AUTH = {"Authorization": "Bearer fake-token", "User-Agent": "Mozilla/5.0 Test"}
BODY = {
    "type": "content",
    "description": "Page 170 shows the wrong figure.",
    "context": {
        "book_id": "lathi",
        "section": "2.4 System Response to External Input: The Zero-State Response",
        "page": 170,
        "locale": "zh",
        "route": "/learning",
    },
}


class FakeCollection:
    def __init__(self, error=None):
        self.docs = []
        self.error = error

    def insert_one(self, doc):
        if self.error:
            raise self.error
        self.docs.append(doc)


@pytest.fixture
def env(monkeypatch):
    """Signed in as student@example.com. GitHub and MongoDB are fakes each test can adjust."""
    state = {"identity": "student@example.com", "filed": [], "github_error": None, "collection": FakeCollection()}

    def fake_create(issue):
        if state["github_error"]:
            raise fb.FeedbackDeliveryError(state["github_error"])
        state["filed"].append(issue)
        return len(state["filed"])

    monkeypatch.setattr(api_routes, "verify_token", lambda auth: state["identity"] if auth else None)
    monkeypatch.setattr(fb, "create_github_issue", fake_create)
    monkeypatch.setattr(database, "feedback", lambda: state["collection"])
    monkeypatch.setattr(api_routes, "_feedback_limiter", fb.FeedbackRateLimiter(clock=lambda: 1000.0))
    app = FastAPI()
    app.include_router(api_routes.router)
    state["client"] = TestClient(app)
    return state


def post(env, body=BODY, headers=AUTH):
    return env["client"].post("/api/feedback", json=body, headers=headers)


def test_no_token_is_401(env):
    resp = post(env, headers={})
    assert (resp.status_code, resp.json()) == (401, {"detail": "Not authenticated"})


def test_guest_is_403(env):
    env["identity"] = "anon:abc123"
    resp = post(env)
    assert (resp.status_code, resp.json()) == (403, {"detail": "Guests can't send feedback"})


def test_empty_description_is_422(env):
    assert post(env, body={**BODY, "description": "   "}).status_code == 422


def test_success_files_the_issue(env):
    resp = post(env)
    assert (resp.status_code, resp.json()) == (200, {"ok": True})
    (issue,) = env["filed"]
    assert issue.title == "[Content] Page 170 shows the wrong figure."
    assert issue.labels == ["type:content", "book:lathi"]
    assert "| Page | 170 |" in issue.body
    assert "| Browser | Mozilla/5.0 Test |" in issue.body
    assert env["collection"].docs == []


def test_github_failure_is_stored_and_still_200(env):
    env["github_error"] = "HTTP 502"
    resp = post(env)
    assert (resp.status_code, resp.json()) == (200, {"ok": True})
    assert [(d["status"], d["github_error"]) for d in env["collection"].docs] == [("pending", "HTTP 502")]


def test_unconfigured_github_is_stored_and_still_200(env, monkeypatch):
    monkeypatch.setattr(fb, "create_github_issue", REAL_CREATE_GITHUB_ISSUE)
    monkeypatch.delenv("FEEDBACK_GITHUB_TOKEN", raising=False)
    assert post(env).status_code == 200
    assert [d["github_error"] for d in env["collection"].docs] == ["not configured"]


@pytest.mark.parametrize("collection", [None, FakeCollection(error=RuntimeError("down"))])
def test_both_failing_is_503_and_gives_the_slot_back(env, collection):
    env["github_error"] = "HTTP 502"
    env["collection"] = collection
    resp = post(env)
    assert (resp.status_code, resp.json()) == (503, {"detail": "Feedback is temporarily unavailable"})

    env["github_error"] = None
    assert [post(env).status_code for _ in range(5)] == [200] * 5


def test_sixth_report_in_an_hour_is_429(env):
    assert [post(env).status_code for _ in range(5)] == [200] * 5
    resp = post(env)
    assert resp.status_code == 429
    assert resp.headers["Retry-After"] == "3600"
    assert resp.json() == {"detail": "Too many feedback submissions", "retry_after_seconds": 3600}


def test_the_token_never_reaches_logs_or_the_stored_record(env, monkeypatch, capsys):
    monkeypatch.setattr(fb, "create_github_issue", REAL_CREATE_GITHUB_ISSUE)
    monkeypatch.setenv("FEEDBACK_GITHUB_TOKEN", TOKEN)
    monkeypatch.setenv("FEEDBACK_GITHUB_REPO", "lius24/ai-tutor-feedback")

    def github_rejects(request, timeout=None):
        raise urllib.error.HTTPError(request.full_url, 500, "error", {}, None)

    monkeypatch.setattr(urllib.request, "urlopen", github_rejects)
    assert post(env).status_code == 200
    (doc,) = env["collection"].docs
    assert doc["github_error"] == "HTTP 500"
    assert TOKEN not in json.dumps(doc, default=str)
    assert TOKEN not in capsys.readouterr().out


def test_startup_reports_feedback_delivery(monkeypatch, capsys):
    import main

    monkeypatch.delenv("FEEDBACK_GITHUB_TOKEN", raising=False)
    monkeypatch.delenv("MONGODB_URI", raising=False)
    with TestClient(main.app):
        pass
    assert "[Feedback] GitHub delivery disabled" in capsys.readouterr().out
