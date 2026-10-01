"""Tests for builtin_books: the builtin course registry.

Run: pytest test_builtin_books.py   (from backend/)
"""

import json

import builtin_books as bb


def test_focs_is_builtin_and_unknown_is_not():
    assert bb.is_builtin("focs") is True
    assert bb.is_builtin("nosuchbook") is False
    assert bb.is_builtin("user_abcd1234") is False
    assert bb.is_builtin("") is False
    assert bb.is_builtin("../etc") is False


def test_focs_meta_preserves_the_inlined_values():
    meta = bb.load_meta("focs")
    assert meta is not None
    assert meta["display_name"] == "FOCS (Mathematics for Computer Science)"
    assert meta["pdf_page_offset"] == 15
    assert meta["practice_anchor"] == {"kind": "problems_section"}


def test_focs_outline_loads_and_has_chapter_four():
    outline = bb.load_outline("focs")
    assert isinstance(outline, dict) and outline
    assert any(k.startswith("4 ") for k in outline), "chapter 4 heading missing"


def test_focs_pdf_loads_as_a_pdf():
    data = bb.load_pdf_bytes("focs")
    assert data is not None
    assert data[:5] == b"%PDF-", "not a PDF header"


def test_list_builtin_returns_focs_spelled_correctly():
    rows = bb.list_builtin()
    assert {r["id"] for r in rows} == {"focs", "lathi"}
    assert rows[0]["label"] == "FOCS"


def test_unknown_book_reads_return_none_not_raise():
    assert bb.load_meta("nope") is None
    assert bb.load_outline("nope") is None
    assert bb.load_pdf_bytes("nope") is None


def test_second_book_is_discovered_from_disk(tmp_path, monkeypatch):
    """A throwaway fixture book proves the registry is not focs-shaped."""
    root = tmp_path / "books"
    (root / "focs").mkdir(parents=True)
    (root / "focs" / "meta.json").write_text(
        json.dumps({"id": "focs", "display_name": "FOCS (Mathematics for Computer Science)",
                    "short_label": "FOCS", "pdf_page_offset": 15,
                    "practice_anchor": {"kind": "problems_section"}}),
        encoding="utf-8",
    )
    (root / "focs" / "outline.json").write_text('{"1 One": {"_range": {"start": 1, "end": 2}}}', encoding="utf-8")
    (root / "tb").mkdir()
    (root / "tb" / "meta.json").write_text(
        json.dumps({"id": "tb", "display_name": "Test Book", "short_label": "TB",
                    "pdf_page_offset": 7, "practice_anchor": {"kind": "chapter"}}),
        encoding="utf-8",
    )
    (root / "tb" / "outline.json").write_text('{"B Background": {"_range": {"start": 1, "end": 9}}}', encoding="utf-8")

    monkeypatch.setattr(bb, "BOOKS_DIR", str(root))
    bb.invalidate_cache()

    assert bb.is_builtin("tb") is True
    assert bb.load_meta("tb")["pdf_page_offset"] == 7
    assert "B Background" in bb.load_outline("tb")
    assert sorted(r["id"] for r in bb.list_builtin()) == ["focs", "tb"]
    assert bb.load_pdf_bytes("tb") is None, "book.pdf absent -> None, not an exception"


def test_cache_is_keyed_by_books_dir_so_a_repoint_cannot_serve_stale_data(tmp_path, monkeypatch):
    """No invalidate_cache() here on purpose: correctness must not depend on callers remembering it."""
    real = bb.load_outline("focs")
    assert len(real) > 5, "real FOCS outline should be substantial"

    root = tmp_path / "books"
    (root / "focs").mkdir(parents=True)
    (root / "focs" / "meta.json").write_text(
        json.dumps({"id": "focs", "display_name": "Fixture", "short_label": "FX",
                    "pdf_page_offset": 1, "practice_anchor": {"kind": "chapter"}}),
        encoding="utf-8",
    )
    (root / "focs" / "outline.json").write_text('{"1 Only": {"_range": {"start": 1, "end": 2}}}', encoding="utf-8")

    monkeypatch.setattr(bb, "BOOKS_DIR", str(root))
    assert bb.load_outline("focs") == {"1 Only": {"_range": {"start": 1, "end": 2}}}
    assert bb.load_meta("focs")["display_name"] == "Fixture"

    monkeypatch.undo()
    assert bb.load_outline("focs") == real, "reverting BOOKS_DIR must restore the real outline"
    assert bb.load_meta("focs")["display_name"] == "FOCS (Mathematics for Computer Science)"


def test_unknown_ids_are_never_cached():
    """GET /api/textbook_tree?id=<x> takes an arbitrary, unauthenticated id. A loop of
    unknown ids must not grow the module-level caches without bound — each read of an
    id that does not resolve to a real book directory must be rejected before the
    cache is ever written to."""
    bb.invalidate_cache()
    for i in range(100):
        book_id = f"unknown_{i}"
        assert bb.load_meta(book_id) is None
        assert bb.load_outline(book_id) is None
        assert bb.load_pdf_bytes(book_id) is None

    assert len(bb._meta_cache) == 0
    assert len(bb._outline_cache) == 0
    assert len(bb._pdf_cache) == 0
