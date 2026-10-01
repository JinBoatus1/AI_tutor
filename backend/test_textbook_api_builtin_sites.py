"""TestClient coverage for the three bb.is_builtin() sites in api_routes.py
(the regression tests test_textbook_api.py deferred to this PR)."""

import json
import os
import shutil

import pymupdf
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import api_routes
import builtin_books as bb

AUTH = {"Authorization": "Bearer test"}


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(api_routes, "verify_token", lambda auth: "student@example.com" if auth else None)
    app = FastAPI()
    app.include_router(api_routes.router)
    return TestClient(app)


@pytest.fixture
def fixture_book(tmp_path, monkeypatch):
    """A throwaway builtin beside copies of the real ones (FOCS keeps its PDF): offset 2 and a 4-page PDF."""
    books = tmp_path / "books"
    shutil.copytree(bb.BOOKS_DIR, books, ignore=shutil.ignore_patterns("book.pdf", ".build"))
    os.symlink(os.path.join(bb.BOOKS_DIR, "focs", "book.pdf"), books / "focs" / "book.pdf")
    d = books / "tiny"
    d.mkdir()
    (d / "meta.json").write_text(json.dumps({
        "id": "tiny", "display_name": "Tiny", "short_label": "Tiny",
        "pdf_page_offset": 2, "practice_anchor": {"kind": "chapter"},
    }))
    (d / "outline.json").write_text(json.dumps({"1 One": {"_range": {"start": 1, "end": 2}, "1.1 A": {"start": 1, "end": 2}}}))
    doc = pymupdf.open()
    for i in range(4):
        doc.new_page(width=300, height=400).insert_text((40, 60), f"pdf page {i + 1}")
    doc.save(d / "book.pdf")
    monkeypatch.setattr(bb, "BOOKS_DIR", str(books))
    bb.invalidate_cache()
    yield "tiny"
    bb.invalidate_cache()


def test_a_builtin_tree_is_served_to_signed_in_students(client):
    resp = client.get("/api/user_textbooks/lathi/tree", headers=AUTH)
    assert resp.status_code == 200 and resp.json() == bb.load_outline("lathi")


def test_an_unknown_book_tree_is_404(client):
    assert client.get("/api/user_textbooks/nope/tree", headers=AUTH).status_code == 404


def test_textbook_pages_renders_a_builtin_book_with_its_offset(client, fixture_book):
    resp = client.get("/api/textbook_pages", params={"textbook_id": fixture_book, "start_book": 1, "end_book": 1})
    body = resp.json()
    assert resp.status_code == 200 and len(body["pages_b64"]) == 1 and body["matched_topic"]["start_pdf"] == 3


def test_textbook_pages_coerces_an_unknown_id_to_the_default_book(client):
    body = client.get("/api/textbook_pages", params={"textbook_id": "nope", "start_book": 5, "end_book": 5}).json()
    assert body["matched_topic"]["start_pdf"] == 5 + bb.load_meta("focs")["pdf_page_offset"]


def test_textbook_pages_for_builtin_without_pdf_is_empty_not_error(client, fixture_book):
    os.remove(os.path.join(bb.BOOKS_DIR, fixture_book, "book.pdf"))
    bb.invalidate_cache()
    resp = client.get("/api/textbook_pages", params={"textbook_id": fixture_book, "start_book": 1, "end_book": 1})
    assert resp.status_code == 200 and resp.json()["pages_b64"] == []


@pytest.mark.parametrize("book_id", ["focs", "lathi"])
def test_builtin_books_cannot_be_deleted(client, book_id):
    assert client.delete(f"/api/user_textbooks/{book_id}", headers=AUTH).status_code == 400
    assert client.post(f"/api/user_textbooks/{book_id}/delete", headers=AUTH).status_code == 400
