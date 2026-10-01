"""Keyless checks that a Lathi chat is grounded in Lathi's own text, and never in FOCS's."""

import os
import shutil
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import api_routes
import builtin_books as bb
import learning_resources as lr

LATHI_PDF = os.path.join(bb.BOOKS_DIR, "lathi", "book.pdf")
SECTION = "2.4 System Response to External Input: The Zero-State Response"


@pytest.fixture
def prompts(monkeypatch):
    """Replace both model calls with a fake; collect each call's messages."""
    seen = []

    def fake_completion(**kwargs):
        seen.append(kwargs["messages"])
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content="ok"))])

    monkeypatch.setattr(api_routes, "create_chat_completion", fake_completion)
    monkeypatch.setattr(lr, "create_chat_completion", fake_completion)
    return seen


@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(api_routes.router)
    return TestClient(app)


def _ask_in_section_2_4(client):
    resp = client.post("/api/chat", json={
        "message": "How do I compute the zero-state response?",
        "textbook_id": "lathi",
        "section_hint": "2.4",
    })
    assert resp.status_code == 200
    return resp.json()


@pytest.mark.skipif(not os.path.isfile(LATHI_PDF), reason="private PDF not fetched (backend/data/books/README.md)")
def test_a_lathi_chat_in_an_open_section_is_grounded_in_that_sections_text(client, prompts):
    body = _ask_in_section_2_4(client)
    system = prompts[-1][0]["content"]
    assert system.startswith("You are an AI math tutor for Linear Systems and Signals (Lathi).")
    assert f"Open section: {SECTION}." in system
    assert f"--- Textbook reference ({SECTION}, PDF pp. 188-215) ---" in system
    assert "zero-state response" in system.split("--- Textbook reference", 1)[1].lower()
    assert body["matched_topic"]["start_book"] == 168 and body["matched_topic"]["start_pdf"] == 188


@pytest.fixture
def lathi_without_its_pdf(tmp_path, monkeypatch):
    """Copies of the real books where FOCS keeps its PDF and Lathi has none."""
    books = tmp_path / "books"
    shutil.copytree(bb.BOOKS_DIR, books, ignore=shutil.ignore_patterns("book.pdf", ".build", ".book.pdf.*.part"))
    os.symlink(os.path.join(bb.BOOKS_DIR, "focs", "book.pdf"), books / "focs" / "book.pdf")
    monkeypatch.setattr(bb, "BOOKS_DIR", str(books))
    bb.invalidate_cache()
    yield
    bb.invalidate_cache()


def test_without_its_pdf_a_lathi_chat_gets_no_textbook_text_rather_than_focs_text(client, prompts, lathi_without_its_pdf):
    _ask_in_section_2_4(client)
    system = prompts[-1][0]["content"]
    assert f"Open section: {SECTION}." in system
    assert "--- Textbook reference" not in system and "--- Also relevant" not in system


def test_without_its_pdf_lathi_serves_no_pages_rather_than_focs_pages(client, lathi_without_its_pdf):
    resp = client.get("/api/textbook_pages", params={"textbook_id": "lathi", "start_book": 168, "end_book": 168})
    assert resp.status_code == 200 and resp.json()["pages_b64"] == []
