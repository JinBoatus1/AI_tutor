"""A question asking only what a term means gets a short answer drawn from the textbook.

Other questions that merely look short ("what is wrong with my proof?", "hi") get the
normal answer. Keyless: every model call is replaced by a fake.
"""

from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import api_routes
import learning_resources as lr
import student_bar_store as sbs


@pytest.mark.parametrize("message", [
    "what is induction",
    "What is induction?",
    "What is a random variable?",
    "What is the zero-state response?",
    "define induction",
    "Definition of convolution",
    "meaning of eigenfunction",
    "induction?",
    "归纳法是什么",
    "卷积是什么意思",
    "什么是卷积？",
    "卷积？",
    "Define: well ordering principle",
    "What is h(t)?",
    "What is the Laplace transform?",
])
def test_these_ask_what_a_term_means(message):
    assert api_routes._is_simple_definition_question(message)


@pytest.mark.parametrize("message", [
    "What is wrong with my proof?",
    "What is the difference between zero-input and zero-state response?",
    "What is the expected value of a sum of random variables?",
    "What is 2+2?",
    "What is B.4?",
    "what is 5.1",
    "Can you explain B.4?",
    "chapter 5",
    "explain this",
    "help me",
    "hi",
    "thanks!",
    "what is it?",
    "what is the answer?",
    "这个是什么",
    "卷积和相关有什么区别",
    "你好",
    "continue",
    "induction",
    "What is this section about?",
    "what is my grade?",
    "这一节讲的是什么",
    "What is the next step?",
    "What is the answer to 5.3?",
    "What is going on here?",
    "What?",
    "lol?",
])
def test_these_do_not(message):
    assert not api_routes._is_simple_definition_question(message)


# --- through /api/chat ---------------------------------------------------------

TUTOR_ANSWER = "Induction proves a statement for every natural number. Think of a line of dominoes."


@pytest.fixture
def model(monkeypatch, tmp_path):
    """Fake model: the topic matcher picks FOCS 5.1; every other call gets a two-sentence answer."""
    calls = []

    def fake(**kwargs):
        messages = kwargs["messages"]
        calls.append(messages)
        if messages[0]["content"].startswith("You are matching a student question"):
            content = "5.1 Ordinary Induction"
        else:
            content = TUTOR_ANSWER
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content))])

    monkeypatch.setattr(api_routes, "create_chat_completion", fake)
    monkeypatch.setattr(lr, "create_chat_completion", fake)
    # The normal path writes memory and, for guests, a progress file; keep both out of backend/data.
    monkeypatch.setattr(sbs, "STUDENT_BAR_DIR", str(tmp_path / "student_bars"))
    monkeypatch.setattr(api_routes, "MEMORY_ROOT", str(tmp_path / "memory"))
    return calls


@pytest.fixture
def saved(monkeypatch):
    rows = []
    monkeypatch.setattr(api_routes, "_persist_chat_messages", lambda msg, email, answer, result: rows.append(answer))
    return rows


@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(api_routes.router)
    return TestClient(app)


def _tutor_system_prompt(calls):
    return next(m[0]["content"] for m in calls if m[0]["content"].startswith("You are an AI math tutor"))


def test_a_definition_question_is_answered_from_the_textbook(client, model, saved):
    body = client.post("/api/chat", json={"message": "What is induction?", "textbook_id": "focs"}).json()
    system = _tutor_system_prompt(model)
    assert "asked what a term means" in system
    assert "--- Reference from textbook (topic: 5.1 Ordinary Induction" in system
    assert body["matched_topic"]["name"] == "5.1 Ordinary Induction"
    assert body.get("reference_section_pages_b64")


def test_a_definition_answer_is_not_cut_to_one_sentence(client, model, saved):
    body = client.post("/api/chat", json={"message": "What is induction?", "textbook_id": "focs"}).json()
    assert body["reply"] == TUTOR_ANSWER


def test_a_definition_question_is_saved_to_the_session(client, model, saved):
    client.post("/api/chat", json={"message": "What is induction?", "textbook_id": "focs"})
    assert saved == [TUTOR_ANSWER]


def test_a_question_that_only_looks_short_gets_the_normal_answer(client, model, saved):
    client.post("/api/chat", json={"message": "What is wrong with my proof?", "textbook_id": "focs"})
    system = _tutor_system_prompt(model)
    assert "explain clearly step-by-step" in system
    assert "asked what a term means" not in system


def test_a_definition_answer_gets_no_confidence_score(client, model, saved):
    history = [{"sender": "user", "text": "Hi"}, {"sender": "ai", "text": "Hello!"}]
    body = client.post("/api/chat", json={"message": "What is induction?", "textbook_id": "focs", "history": history}).json()
    assert "confidence" not in body
    assert not any(m[0]["content"].startswith("You are a strict evaluator") for m in model)
