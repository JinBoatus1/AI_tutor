"""resolve_textbook_for_request must serve any builtin book, not just focs.

Run: pytest test_textbook_resolution.py   (from backend/)
"""

import json

import builtin_books as bb
import learning_resources as lr


def _fixture_books(tmp_path):
    root = tmp_path / "books"
    (root / "focs").mkdir(parents=True)
    (root / "focs" / "meta.json").write_text(json.dumps({
        "id": "focs", "display_name": "FOCS (Mathematics for Computer Science)",
        "short_label": "FOCS", "pdf_page_offset": 15,
        "practice_anchor": {"kind": "problems_section"}}), encoding="utf-8")
    (root / "focs" / "outline.json").write_text('{"1 One": {"_range": {"start": 1, "end": 2}}}', encoding="utf-8")
    (root / "tb").mkdir()
    (root / "tb" / "meta.json").write_text(json.dumps({
        "id": "tb", "display_name": "Test Book", "short_label": "TB",
        "pdf_page_offset": 7, "practice_anchor": {"kind": "chapter"}}), encoding="utf-8")
    (root / "tb" / "outline.json").write_text('{"B Background": {"_range": {"start": 1, "end": 9}}}', encoding="utf-8")
    return str(root)


def test_real_focs_still_resolves_with_offset_15():
    ctx = lr.resolve_textbook_for_request("focs", None)
    assert ctx.book_id == "focs"
    assert ctx.pdf_page_offset == 15
    assert ctx.raw, "FOCS outline should be non-empty"
    assert ctx.pdf_bytes is not None, "FOCS PDF should still resolve"


def test_second_builtin_resolves_with_its_own_offset_and_outline(tmp_path, monkeypatch):
    monkeypatch.setattr(bb, "BOOKS_DIR", _fixture_books(tmp_path))
    bb.invalidate_cache()
    ctx = lr.resolve_textbook_for_request("tb", None)
    assert ctx.book_id == "tb"
    assert ctx.pdf_page_offset == 7
    assert "B Background" in ctx.raw


def test_unknown_id_falls_back_to_default(tmp_path, monkeypatch):
    monkeypatch.setattr(bb, "BOOKS_DIR", _fixture_books(tmp_path))
    bb.invalidate_cache()
    ctx = lr.resolve_textbook_for_request("no_such_book", None)
    assert ctx.book_id == bb.DEFAULT_BOOK_ID


def test_upload_id_without_owner_falls_back_to_default(tmp_path, monkeypatch):
    monkeypatch.setattr(bb, "BOOKS_DIR", _fixture_books(tmp_path))
    bb.invalidate_cache()
    ctx = lr.resolve_textbook_for_request("user_deadbeef1234", None)
    assert ctx.book_id == bb.DEFAULT_BOOK_ID


def test_active_display_name_follows_the_active_book(tmp_path, monkeypatch):
    monkeypatch.setattr(bb, "BOOKS_DIR", _fixture_books(tmp_path))
    bb.invalidate_cache()
    with lr.request_book("tb", None):
        assert lr.active_display_name() == "Test Book"
    with lr.request_book("focs", None):
        assert lr.active_display_name() == "FOCS (Mathematics for Computer Science)"
