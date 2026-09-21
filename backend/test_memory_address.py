"""topic_name_to_memory_address: widening the token must not move FOCS addresses.

Memory lives on disk under backend/data/memory/<book_id>/<address>, so any change
to the address function silently orphans history. This test pins that it cannot.

Run: pytest test_memory_address.py   (from backend/)
"""

import json
import re

import builtin_books as bb
import learning_resources as lr


# --- the implementation exactly as it stood before the widening ------------- #
def _legacy_address(topic_name: str) -> str:
    if not topic_name or not isinstance(topic_name, str):
        return "unknown"
    s = topic_name.strip()
    parts = s.split()
    if not parts:
        return "unknown"
    token = parts[0]
    if re.match(r"^\d+\.\d+(?:\.\d+)*$", token):
        chapter_num = token.split(".")[0]
        ch_key = lr.get_chapter_heading_key(chapter_num)
        if ch_key:
            return f"{lr._sanitize_memory_segment(ch_key)}/{lr._sanitize_memory_segment(s)}"
        return lr._sanitize_memory_segment(s)
    if re.match(r"^\d+$", token):
        ch_key = lr.get_chapter_heading_key(token)
        if ch_key:
            return lr._sanitize_memory_segment(ch_key)
        return lr._sanitize_memory_segment(s)
    return lr._sanitize_memory_segment(s)


def _all_titles(node, out):
    for k, v in node.items():
        if k in ("_range", "start", "end") or not isinstance(v, dict):
            continue
        out.append(k)
        _all_titles(v, out)
    return out


def test_every_focs_topic_address_is_byte_identical():
    titles = _all_titles(bb.load_outline("focs") or {}, [])
    assert len(titles) > 50, "FOCS outline looks empty; test would be vacuous"
    with lr.request_book("focs", None):
        for title in titles:
            assert lr.topic_name_to_memory_address(title) == _legacy_address(title), title


def test_lettered_chapter_sections_now_nest_under_their_chapter(tmp_path, monkeypatch):
    root = tmp_path / "books"
    (root / "tb").mkdir(parents=True)
    (root / "tb" / "meta.json").write_text(json.dumps({
        "id": "tb", "display_name": "Test Book", "short_label": "TB",
        "pdf_page_offset": 0, "practice_anchor": {"kind": "chapter"}}), encoding="utf-8")
    (root / "tb" / "outline.json").write_text(json.dumps({
        "B Background": {"_range": {"start": 1, "end": 50},
                         "B.1 Complex Numbers": {"start": 1, "end": 13}},
        "1 Introduction": {"_range": {"start": 51, "end": 103}},
    }), encoding="utf-8")
    monkeypatch.setattr(bb, "BOOKS_DIR", str(root))
    bb.invalidate_cache()

    with lr.request_book("tb", None):
        assert lr.topic_name_to_memory_address("B.1 Complex Numbers") == "B_Background/B_1_Complex_Numbers"
        assert lr.topic_name_to_memory_address("B Background") == "B_Background"
        assert lr.topic_name_to_memory_address("1 Introduction") == "1_Introduction"


def test_back_matter_titles_are_not_treated_as_chapters(tmp_path, monkeypatch):
    """'Answers to Selected Problems' must stay a flat address, not a chapter."""
    root = tmp_path / "books"
    (root / "tb").mkdir(parents=True)
    (root / "tb" / "meta.json").write_text(json.dumps({
        "id": "tb", "display_name": "Test Book", "short_label": "TB",
        "pdf_page_offset": 0, "practice_anchor": {"kind": "chapter"}}), encoding="utf-8")
    (root / "tb" / "outline.json").write_text(json.dumps({
        "Answers to Selected Problems": {"_range": {"start": 837, "end": 842}},
    }), encoding="utf-8")
    monkeypatch.setattr(bb, "BOOKS_DIR", str(root))
    bb.invalidate_cache()

    with lr.request_book("tb", None):
        assert lr.topic_name_to_memory_address("Answers to Selected Problems") == "Answers_to_Selected_Problems"


def test_lettered_background_chapter_is_not_auto_marked_as_learned():
    """A lettered chapter is background material and is skipped, like FOCS chapter 0."""
    import student_bar_store as sbs

    raw = {
        "B Background": {"_range": {"start": 1, "end": 50}},
        "1 Introduction": {"_range": {"start": 51, "end": 103}},
        "2 Time-Domain": {"_range": {"start": 104, "end": 170}},
    }
    assert sbs._root_chapter_ints_from_raw(raw) == [1, 2], "lettered chapter must not become an int"

    bar = {"learned_sections": []}
    sbs._apply_learned_through_chapter_n(bar, 2, {"B", "1", "2"}, raw)
    assert "B" not in bar["learned_sections"]
    assert set(bar["learned_sections"]) == {"1", "2"}


def test_focs_chapter_zero_is_still_skipped():
    import student_bar_store as sbs

    raw = {
        "0 Background and Pep Talk": {"_range": {"start": 3, "end": 6}},
        "1 A Taste": {"_range": {"start": 7, "end": 14}},
    }
    bar = {"learned_sections": []}
    sbs._apply_learned_through_chapter_n(bar, 1, {"0", "1"}, raw)
    assert bar["learned_sections"] == ["1"]
