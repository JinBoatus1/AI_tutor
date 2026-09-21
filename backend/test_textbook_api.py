"""API-level guards for multi-book support.

Run: pytest test_textbook_api.py   (from backend/)
"""

import builtin_books as bb
import learning_resources as lr


def test_prompt_label_is_not_hardcoded_anywhere():
    """The FOCS display name must come from meta.json, not a string literal."""
    with open("api_routes.py", encoding="utf-8") as f:
        src = f.read()
    assert "FOCS (Mathematics for Computer Science)" not in src, (
        "prompt label still inlined; read it from meta.json via lr.active_display_name()"
    )


def test_no_user_visible_fcos_typo():
    with open("api_routes.py", encoding="utf-8") as f:
        assert "FCOS" not in f.read()


def test_textbook_pages_does_not_coerce_a_builtin_to_the_default():
    """/api/textbook_pages used to rewrite every non-user_ id to focs."""
    with open("api_routes.py", encoding="utf-8") as f:
        src = f.read()
    assert 'else:\n        tid = "focs"' not in src, (
        "the else-branch still forces every builtin id to focs"
    )


def test_default_display_name_round_trips():
    with lr.request_book(bb.DEFAULT_BOOK_ID, None):
        assert lr.active_display_name() == "FOCS (Mathematics for Computer Science)"


def test_builtin_list_rows_are_well_formed():
    rows = bb.list_builtin()
    assert rows and rows[0]["id"] == bb.DEFAULT_BOOK_ID
    for r in rows:
        assert set(r) == {"id", "label"} and r["label"]
