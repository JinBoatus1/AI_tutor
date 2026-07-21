"""HTTP tests for eval routes (no LLM for most cases)."""

import os

import pytest
from fastapi.testclient import TestClient

import main


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("EVAL_MODE", "1")
    return TestClient(main.app)


def test_eval_health(client):
    resp = client.get("/api/eval/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["fixtures"]["practice_t1_cases"] == 5


def test_eval_disabled_returns_404(client, monkeypatch):
    monkeypatch.setenv("EVAL_MODE", "0")
    resp = client.get("/api/eval/health")
    assert resp.status_code == 404


def test_list_t1_fixtures(client):
    resp = client.get("/api/eval/practice/fixtures/t1")
    assert resp.status_code == 200
    data = resp.json()
    assert data["count"] == 5
    assert {c["id"] for c in data["cases"]} == {
        "t1-correct",
        "t1-subtle-wrong",
        "t1-hand-wavy",
        "t1-off-topic",
        "t1-blank",
    }


def test_eval_tutor_chat_requires_message(client):
    resp = client.post("/api/eval/tutor/chat", json={"messages": []})
    assert resp.status_code == 400


def test_openai_completions_adapter_shape(client, monkeypatch):
    def fake_completion(**kwargs):
        class Choice:
            message = type("M", (), {"content": "Mock tutor reply."})()

        class Resp:
            choices = [Choice()]

        return Resp()

    monkeypatch.setattr("eval_routes.create_chat_completion", fake_completion)
    resp = client.post(
        "/api/eval/tutor/chat/completions",
        json={
            "model": "gpt-5.2",
            "messages": [{"role": "user", "content": "What is a proof?"}],
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["object"] == "chat.completion"
    assert data["choices"][0]["message"]["content"] == "Mock tutor reply."


def test_eval_practice_grade_mock(client, monkeypatch):
    def fake_completion(**kwargs):
        class Choice:
            message = type(
                "M",
                (),
                {"content": "VERDICT: CORRECT\nSolid contraposition."},
            )()

        class Resp:
            choices = [Choice()]

        return Resp()

    monkeypatch.setattr("eval_routes.create_chat_completion", fake_completion)
    resp = client.post(
        "/api/eval/practice/grade",
        json={
            "problem": {
                "id": "c1",
                "prompt": "Prove x.",
                "solution": "Because y.",
                "rubric": "Correct logic.",
            },
            "student_attempt": "My proof.",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["verdict"] == "CORRECT"
    assert "Solid contraposition" in data["feedback"]



@pytest.mark.integration
def test_run_t1_live_llm(client):
    if not os.getenv("OPENAI_API_KEY") and not os.getenv("API_KEY"):
        pytest.skip("OPENAI_API_KEY not set")
    resp = client.post("/api/eval/practice/run_t1")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 5
    assert "pass_rate" in data
