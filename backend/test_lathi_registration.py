"""Lathi as the second builtin: meta, outline gates, runtime context, git hygiene."""

import os
import re
import shutil
import subprocess

import pymupdf
import pytest

import builtin_books as bb
import learning_resources as lr
from book_pipeline import lathi
from book_pipeline import outline as S3

BACKEND = os.path.dirname(os.path.abspath(__file__))
BOOK_PDF = os.path.join(bb.BOOKS_DIR, "lathi", "book.pdf")


def test_meta_matches_the_spec():
    meta = bb.load_meta("lathi")
    assert {k: meta[k] for k in ("id", "display_name", "short_label", "pdf_page_offset", "practice_anchor")} == {
        "id": "lathi",
        "display_name": "Linear Systems and Signals (Lathi)",
        "short_label": "Signals",
        "pdf_page_offset": 20,
        "practice_anchor": {"kind": "chapter"},
    }
    assert meta["pdf_page_offset"] == lathi.PDF_PAGE_OFFSET


def test_pdf_source_pins_an_exact_private_file():
    src = bb.load_meta("lathi")["pdf_source"]
    assert src["kind"] == "github_private" and src["path"] == "lathi/book.pdf" and "/" in src["repo"]
    assert re.fullmatch(r"[0-9a-f]{40}", src["ref"]) and re.fullmatch(r"[0-9a-f]{64}", src["sha256"])
    assert 0 < src["bytes"] <= 95 * 1024 * 1024


def test_lathi_is_the_second_builtin():
    assert bb.is_builtin("lathi")
    assert bb.list_builtin() == [{"id": "focs", "label": "FOCS"}, {"id": "lathi", "label": "Signals"}]


def test_the_committed_outline_passes_the_gates():
    problems = S3.validate_outline(
        bb.load_outline("lathi"),
        chapter_starts=lathi.CHAPTER_STARTS,
        last_chapter_end=lathi.LAST_CHAPTER_END,
        back_matter=lathi.BACK_MATTER,
    )
    assert problems == []


def test_the_tutor_names_the_book_and_uses_its_offset():
    with lr.request_book("lathi", None):
        assert lr.active_display_name() == "Linear Systems and Signals (Lathi)"
        assert lr.effective_pdf_page_offset() == 20


def test_lettered_chapter_sections_get_nested_memory_addresses():
    b1 = next(k for k in bb.load_outline("lathi")["B Background"] if k.startswith("B.1 "))
    with lr.request_book("lathi", None):
        addr = lr.topic_name_to_memory_address(b1)
    assert addr.startswith("B_") and "/" in addr


@pytest.mark.skipif(shutil.which("git") is None, reason="needs git")
def test_the_book_pdf_and_build_reports_can_never_be_committed():
    for path in ("data/books/lathi/book.pdf", "data/books/lathi/.build/verify_report.json"):
        assert subprocess.run(["git", "check-ignore", "-q", path], cwd=BACKEND).returncode == 0, path


@pytest.mark.skipif(not os.path.isfile(BOOK_PDF), reason="private PDF not fetched (backend/data/books/README.md)")
def test_the_local_pdf_is_the_pinned_book():
    from scripts.fetch_private_books import sha256_file

    assert sha256_file(BOOK_PDF) == bb.load_meta("lathi")["pdf_source"]["sha256"]
    doc = pymupdf.open(BOOK_PDF)
    book_page_28 = 28 + lathi.PDF_PAGE_OFFSET
    assert doc.page_count == 1010 and doc[book_page_28 - 1].rect.width < doc[book_page_28 - 1].rect.height
    with open(BOOK_PDF, "rb") as f:
        assert len(lr.extract_pdf_pages_text(f.read(), book_page_28, book_page_28)) > 200
