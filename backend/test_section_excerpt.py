"""A long section is excerpted around the page being read; a section that fits is sent whole.

Keyless and offline: the PDFs are generated on the fly, except the one Lathi check,
which skips without the private PDF.
"""

import json
import os
import re
from types import SimpleNamespace

import pymupdf
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import api_routes
import builtin_books as bb
import learning_resources as lr
import student_bar_store as sbs

# About 2.4k characters, so a dozen pages is well past the 12k budget.
FILLER = "The output of the system follows from its input and its initial state. " * 34


def _pdf(pages):
    doc = pymupdf.open()
    for text in pages:
        page = doc.new_page(width=576, height=720)
        page.insert_textbox(pymupdf.Rect(20, 20, 556, 700), text, fontsize=6)
    data = doc.tobytes()
    doc.close()
    return data


def _long_section(n=12, extra=None):
    """n long pages; page i (1-based) starts with marker{i:02d}."""
    extra = extra or {}
    return _pdf([f"marker{i:02d} {extra.get(i, '')} {FILLER}" for i in range(1, n + 1)])


def _labelled_pages(text):
    return [int(p) for p in re.findall(r"\[book p\. (\d+)\]", text)]


def test_a_section_that_fits_is_sent_exactly_as_before():
    pdf = _pdf([f"marker{i:02d} a short page" for i in range(1, 4)])
    before = lr.extract_pdf_pages_text(pdf, 1, 3)[:12000]
    assert lr.select_section_text(pdf, 1, 3, offset=0, question="anything", focus_book=2) == before


def test_a_long_section_includes_the_page_being_viewed_and_its_neighbours():
    text = lr.select_section_text(_long_section(), 1, 12, offset=0, question="", focus_book=10)
    for marker in ("marker09", "marker10", "marker11"):
        assert marker in text
    assert "[book p. 10]" in text
    assert len(text) <= 12000


def test_without_a_viewed_page_the_excerpt_starts_at_the_first_page():
    text = lr.select_section_text(_long_section(), 1, 12, offset=0, question="")
    assert "marker01" in text


def test_a_viewed_page_outside_the_section_is_ignored():
    text = lr.select_section_text(_long_section(), 1, 12, offset=0, question="", focus_book=40)
    assert "marker01" in text


def test_pages_that_match_the_question_are_added():
    pdf = _long_section(extra={7: "An eigenfunction of the system keeps its shape."})
    text = lr.select_section_text(pdf, 1, 12, offset=0, question="What is an eigenfunction?", focus_book=1)
    assert "marker07" in text


def test_a_question_in_everyday_words_keeps_to_the_pages_around_the_viewed_one():
    pdf = _long_section(extra={2: "Some say otherwise."})
    text = lr.select_section_text(pdf, 1, 12, offset=0, question="What does this page say?", focus_book=9)
    assert _labelled_pages(text) == [7, 8, 9, 10, 11]


def test_the_fill_stops_at_a_page_that_does_not_fit_instead_of_skipping_far_ahead():
    pages = [f"marker{i:02d} tiny" for i in range(1, 5)] + [f"marker{i:02d} {FILLER}" for i in range(5, 13)]
    text = lr.select_section_text(_pdf(pages), 1, 12, offset=0, question="", focus_book=9)
    assert _labelled_pages(text) == [7, 8, 9, 10, 11]


def test_a_word_on_most_pages_does_not_pull_in_distant_ones():
    pdf = _long_section(extra={i: "convolution" for i in range(1, 8)})
    text = lr.select_section_text(pdf, 1, 12, offset=0, question="convolution", focus_book=11)
    assert _labelled_pages(text) == [8, 9, 10, 11, 12]


def test_the_excerpt_says_which_page_the_student_is_viewing():
    text = lr.select_section_text(_long_section(), 1, 12, offset=0, question="", focus_book=10)
    assert "book pp. 1-12" in text
    assert "The student is viewing book p. 10." in text


def test_a_page_that_does_not_fit_is_cut_to_fill_the_budget():
    text = lr.select_section_text(_long_section(), 1, 12, offset=0, question="", focus_book=1)
    assert 11000 <= len(text) <= 12000


def test_the_previous_page_keeps_its_end_when_cut():
    dense = [f"marker{i:02d} {FILLER * 2} ENDOF{i:02d}" for i in range(1, 13)]
    text = lr.select_section_text(_pdf(dense), 1, 12, offset=0, question="", focus_book=9)
    assert "ENDOF08" in text and "marker08" not in text


def test_a_matching_page_that_does_not_fit_keeps_the_matching_part():
    page = FILLER + " " + FILLER[:900]
    pages = [f"marker{i:02d} {page}" for i in range(1, 13)]
    pages[11] = f"marker12 {FILLER[:1500]} eigenfunction {FILLER[:1500]}"
    text = lr.select_section_text(_pdf(pages), 1, 12, offset=0, question="eigenfunction", focus_book=5)
    assert "eigenfunction" in text


def test_a_long_scanned_section_gives_no_text():
    doc = pymupdf.open()
    for _ in range(70):
        doc.new_page(width=576, height=720)
    pdf = doc.tobytes()
    doc.close()
    assert lr.select_section_text(pdf, 1, 70, offset=0, question="", focus_book=30) == ""


def test_a_long_sparse_section_that_fits_is_sent_whole():
    pdf = _pdf([f"p{i:03d}" for i in range(1, 101)])
    before = lr.extract_pdf_pages_text(pdf, 1, 100)[:12000]
    assert lr.select_section_text(pdf, 1, 100, offset=0, question="", focus_book=80) == before


def test_excerpt_pages_are_in_page_order_and_within_the_budget():
    pdf = _long_section(extra={11: "eigenfunction"})
    for budget in (12000, 8000):
        text = lr.select_section_text(pdf, 1, 12, offset=0, question="eigenfunction", focus_book=4, budget=budget)
        pages = _labelled_pages(text)
        assert len(pages) >= 2 and pages == sorted(pages)
        assert len(text) <= budget


def test_page_labels_are_printed_book_pages():
    front_matter = [f"front matter {i}" for i in range(5)]
    pdf = _pdf(front_matter + [f"marker{i:02d} {FILLER}" for i in range(1, 13)])
    text = lr.select_section_text(pdf, 1, 12, offset=5, question="", focus_book=6)
    assert "[book p. 6]\nmarker06" in text


def test_a_viewed_page_longer_than_the_budget_is_cut_not_dropped():
    text = lr.select_section_text(_long_section(), 1, 12, offset=0, question="", focus_book=5, budget=1000)
    assert "marker05" in text
    assert len(text) <= 1000


def test_pages_past_the_end_of_the_pdf_give_no_text():
    assert lr.select_section_text(_long_section(n=3), 10, 12, offset=0, question="") == ""


# --- through /api/chat ---------------------------------------------------------


@pytest.fixture
def prompts(monkeypatch):
    """Replace every model call with a fake; collect each call's messages."""
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


@pytest.fixture
def long_book(tmp_path, monkeypatch):
    """A builtin book whose one section, 1.1, runs 12 long pages."""
    book = tmp_path / "books" / "longbook"
    book.mkdir(parents=True)
    (book / "meta.json").write_text(json.dumps({"id": "longbook", "display_name": "Long Book", "pdf_page_offset": 0}))
    outline = {"1 Signals": {"_range": {"start": 1, "end": 12}, "1.1 A Long Section": {"start": 1, "end": 12}}}
    (book / "outline.json").write_text(json.dumps(outline))
    (book / "book.pdf").write_bytes(_long_section())
    monkeypatch.setattr(bb, "BOOKS_DIR", str(tmp_path / "books"))
    # A chat with an attachment updates the progress bar and memory; keep both out of backend/data.
    monkeypatch.setattr(sbs, "STUDENT_BAR_DIR", str(tmp_path / "student_bars"))
    monkeypatch.setattr(api_routes, "MEMORY_ROOT", str(tmp_path / "memory"))
    bb.invalidate_cache()
    yield
    bb.invalidate_cache()


def _system_prompt(prompts):
    return prompts[-1][0]["content"]


def test_a_chat_in_an_open_section_is_grounded_in_the_page_being_viewed(client, prompts, long_book):
    resp = client.post("/api/chat", json={
        "message": "Can you explain this page?",
        "textbook_id": "longbook",
        "section_hint": "1.1",
        "viewing_page": 10,
    })
    assert resp.status_code == 200
    system = _system_prompt(prompts)
    assert "[book p. 10]" in system and "marker10" in system


def test_a_chat_without_a_viewed_page_gets_the_start_of_the_section(client, prompts, long_book):
    client.post("/api/chat", json={"message": "Explain", "textbook_id": "longbook", "section_hint": "1.1"})
    assert "marker01" in _system_prompt(prompts)


def test_a_chat_with_an_attachment_in_an_open_section_uses_the_viewed_page_too(client, prompts, long_book):
    client.post("/api/chat", json={
        "message": "Is my work right?",
        "textbook_id": "longbook",
        "section_hint": "1.1",
        "viewing_page": 9,
        "images_b64": ["aGVsbG8="],
    })
    system = _system_prompt(prompts)
    assert "[book p. 9]" in system and "marker09" in system


LATHI_PDF = os.path.join(bb.BOOKS_DIR, "lathi", "book.pdf")


@pytest.mark.skipif(not os.path.isfile(LATHI_PDF), reason="private PDF not fetched (backend/data/books/README.md)")
def test_lathi_2_4_late_page_reaches_the_model(client, prompts):
    resp = client.post("/api/chat", json={
        "message": "What does this page say?",
        "textbook_id": "lathi",
        "section_hint": "2.4",
        "viewing_page": 190,
    })
    assert resp.status_code == 200
    assert "[book p. 190]" in _system_prompt(prompts)
