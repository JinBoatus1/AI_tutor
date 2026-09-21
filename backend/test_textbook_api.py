"""API-level guards for multi-book support.

Run: pytest test_textbook_api.py   (from backend/)
"""

import os

import builtin_books as bb
import learning_resources as lr

_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_SCAN_ROOTS = (
    os.path.join(_REPO_ROOT, "backend"),
    os.path.join(_REPO_ROOT, "frontend", "src"),
)
_SCAN_EXTS = (".py", ".ts", ".tsx")
_SKIP_DIRS = {"node_modules", "__pycache__", ".venv", "dist", "build"}


def _files_containing(needle: str) -> list[str]:
    hits: list[str] = []
    for root in _SCAN_ROOTS:
        for dirpath, dirnames, filenames in os.walk(root):
            dirnames[:] = [d for d in dirnames if d not in _SKIP_DIRS]
            for fname in filenames:
                if not fname.endswith(_SCAN_EXTS):
                    continue
                path = os.path.join(dirpath, fname)
                try:
                    with open(path, encoding="utf-8") as f:
                        text = f.read()
                except (UnicodeDecodeError, OSError):
                    continue
                if needle in text:
                    hits.append(path)
    return hits


def test_prompt_label_is_not_hardcoded_anywhere():
    """The FOCS display name must come from meta.json, not a string literal."""
    with open("api_routes.py", encoding="utf-8") as f:
        src = f.read()
    assert "FOCS (Mathematics for Computer Science)" not in src, (
        "prompt label still inlined; read it from meta.json via lr.active_display_name()"
    )


def test_no_user_visible_fcos_typo():
    """Scans all of backend/ and frontend/src/ (not just api_routes.py — that narrower
    scan previously let student_bar_store.py's typo through) for the letter-swapped
    misspelling of FOCS. The needle is built at runtime, and spelled out nowhere in
    this file's own source text, so this assertion cannot trip on itself."""
    needle = "FC" + "OS"
    offenders = _files_containing(needle)
    assert not offenders, f"FOCS misspelled as {needle!r} in: {offenders}"


def test_textbook_pages_else_branch_coercion_source_text_is_gone():
    """Source-text canary, not behavior coverage: greps for the exact old else-branch
    text ('else:\\n        tid = "focs"') that used to rewrite every non-user_ id to
    focs in /api/textbook_pages. A reintroduction with different indentation or
    formatting would NOT be caught by this test — it only catches the literal byte
    sequence. A real regression test needs a TestClient call (deferred to a later PR)."""
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
