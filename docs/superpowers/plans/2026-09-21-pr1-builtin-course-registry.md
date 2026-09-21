# PR1 — Builtin Course Registry (Zero Behaviour Change) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded `focs` special cases with a builtin-course registry on both backend and frontend, so a second course can later be added by dropping in a directory — while FOCS behaves **identically**, byte for byte.

**Architecture:** Builtin books move to `backend/data/books/<id>/{meta.json,outline.json,book.pdf}` — the same three-file shape `user_textbook_store.py` already uses for uploads — and `resolve_textbook_for_request` becomes the single seam that resolves builtin → upload → default. The frontend gains `src/books/registry.ts` as the mirror source of truth. Chapter-token regexes widen from numeric-only to `(?:\d+|[A-Z])` so a lettered chapter (`B`) is expressible, which is provably a no-op for FOCS's all-numeric tokens.

**Tech Stack:** Python 3 / FastAPI / PyMuPDF (backend, tests via pytest run from `backend/`), React + TypeScript / Vite / Vitest (frontend, tests run from `frontend/`).

**Spec:** `docs/superpowers/specs/2026-09-21-multi-course-signal-processing-design.md`

**Branch:** `feat/multi-course-signals` (already created, spec committed as `bdd8b16`)

## Global Constraints

- **PR1 contains no Lathi content.** No Lathi PDF, outline, practice sets or notes. Second-book behaviour is proven with a throwaway test fixture book, never with real course content.
- **Zero behaviour change for FOCS.** Every existing pytest and vitest suite must stay green, and no FOCS memory address may change by a single byte.
- `display_name` for FOCS must be exactly `FOCS (Mathematics for Computer Science)` — the string currently inlined at `api_routes.py:420`, `:556`, `:622`.
- FOCS `pdf_page_offset` must remain `15` (currently `learning_resources.py` `PDF_PAGE_OFFSET`).
- The widened chapter-token pattern is exactly `/^(?:\d+|[A-Z])(?:\.\d+)*$/`. Do **not** use `[A-Za-z0-9]+` — it would accept `Answers` and `Supplementary` (first words of Lathi back-matter titles) as chapter tokens.
- Backend tests run from `backend/` with bare-name imports (`import learning_resources as lr`), matching `backend/test_grade_store.py`.
- Frontend tests run from `frontend/` via `npx vitest run <path>`.
- User-visible label spelling is **FOCS**, not `FCOS`.

---

### Task 1: Backend builtin-book registry module + FOCS data migration

Moves the FOCS data files into the registry layout and adds the module that reads it. The `sync-focs` npm script reads the old path and breaks the moment the data moves, so fixing it belongs to this task.

**Files:**
- Create: `backend/builtin_books.py`
- Create: `backend/data/books/focs/meta.json`
- Move: `backend/data/FOCS.json` → `backend/data/books/focs/outline.json`
- Move: `backend/data/FOCS.pdf` → `backend/data/books/focs/book.pdf`
- Modify: `frontend/scripts/sync-focs-tree.mjs`
- Test: `backend/test_builtin_books.py`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: module `builtin_books` with
  `DEFAULT_BOOK_ID: str = "focs"`,
  `is_builtin(book_id: str) -> bool`,
  `list_builtin() -> List[Dict[str, str]]` (rows `{"id": str, "label": str}`),
  `load_meta(book_id: str) -> Optional[Dict[str, Any]]`,
  `load_outline(book_id: str) -> Optional[Dict[str, Any]]`,
  `load_pdf_bytes(book_id: str) -> Optional[bytes]`,
  `books_root() -> str`.

- [ ] **Step 1: Move the data files with git so the 83 MB PDF records as a rename**

```bash
cd /Users/vnerald/ai_tutor
mkdir -p backend/data/books/focs
git mv backend/data/FOCS.json backend/data/books/focs/outline.json
git mv backend/data/FOCS.pdf  backend/data/books/focs/book.pdf
git status --short
```

Expected: two `R` (rename) entries, no new large blob.

- [ ] **Step 2: Write `backend/data/books/focs/meta.json`**

`display_name` and `pdf_page_offset` are reproduced verbatim from the values they replace — see Global Constraints.

```json
{
  "id": "focs",
  "display_name": "FOCS (Mathematics for Computer Science)",
  "short_label": "FOCS",
  "pdf_page_offset": 15,
  "practice_anchor": { "kind": "problems_section" }
}
```

- [ ] **Step 3: Write the failing test**

Create `backend/test_builtin_books.py`:

```python
"""Tests for builtin_books: the builtin course registry.

Run: pytest test_builtin_books.py   (from backend/)
"""

import json
import os

import builtin_books as bb


def test_focs_is_builtin_and_unknown_is_not():
    assert bb.is_builtin("focs") is True
    assert bb.is_builtin("lathi") is False
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
    assert {r["id"] for r in rows} == {"focs"}
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
```

- [ ] **Step 4: Run the test to verify it fails**

```bash
cd /Users/vnerald/ai_tutor/backend && pytest test_builtin_books.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'builtin_books'`.

- [ ] **Step 5: Write `backend/builtin_books.py`**

```python
"""Builtin (shipped) course textbooks.

Same on-disk shape as user_textbook_store's per-user books, so builtin and
uploaded books resolve through one code path:

    backend/data/books/<id>/meta.json      required
    backend/data/books/<id>/outline.json   required
    backend/data/books/<id>/book.pdf       optional
"""

from __future__ import annotations

import json
import os
import re
import threading
from typing import Any, Dict, List, Optional

BOOKS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "books")

DEFAULT_BOOK_ID = "focs"

_BOOK_ID_RE = re.compile(r"^[a-z][a-z0-9_-]{0,63}$")

_lock = threading.Lock()
_meta_cache: Dict[str, Optional[Dict[str, Any]]] = {}
_outline_cache: Dict[str, Optional[Dict[str, Any]]] = {}
_pdf_cache: Dict[str, Optional[bytes]] = {}


def books_root() -> str:
    return BOOKS_DIR


def invalidate_cache() -> None:
    """Drop memoized reads. Used by tests that repoint BOOKS_DIR."""
    with _lock:
        _meta_cache.clear()
        _outline_cache.clear()
        _pdf_cache.clear()


def _book_dir(book_id: str) -> Optional[str]:
    if not book_id or not _BOOK_ID_RE.match(book_id):
        return None
    d = os.path.join(BOOKS_DIR, book_id)
    return d if os.path.isdir(d) else None


def is_builtin(book_id: str) -> bool:
    d = _book_dir(book_id or "")
    return bool(d and os.path.isfile(os.path.join(d, "meta.json")))


def _read_json(path: str) -> Optional[Dict[str, Any]]:
    if not os.path.isfile(path):
        return None
    try:
        with open(path, encoding="utf-8") as f:
            raw = json.load(f)
        return raw if isinstance(raw, dict) else None
    except Exception:
        return None


def load_meta(book_id: str) -> Optional[Dict[str, Any]]:
    with _lock:
        if book_id in _meta_cache:
            return _meta_cache[book_id]
    d = _book_dir(book_id or "")
    meta = _read_json(os.path.join(d, "meta.json")) if d else None
    with _lock:
        _meta_cache[book_id] = meta
    return meta


def load_outline(book_id: str) -> Optional[Dict[str, Any]]:
    with _lock:
        if book_id in _outline_cache:
            return _outline_cache[book_id]
    d = _book_dir(book_id or "")
    outline = _read_json(os.path.join(d, "outline.json")) if d else None
    with _lock:
        _outline_cache[book_id] = outline
    return outline


def load_pdf_bytes(book_id: str) -> Optional[bytes]:
    with _lock:
        if book_id in _pdf_cache:
            return _pdf_cache[book_id]
    d = _book_dir(book_id or "")
    data: Optional[bytes] = None
    if d:
        p = os.path.join(d, "book.pdf")
        if os.path.isfile(p):
            try:
                with open(p, "rb") as f:
                    data = f.read()
            except Exception:
                data = None
    with _lock:
        _pdf_cache[book_id] = data
    return data


def list_builtin() -> List[Dict[str, str]]:
    """Rows for the textbook picker, default book first."""
    out: List[Dict[str, str]] = []
    if not os.path.isdir(BOOKS_DIR):
        return out
    for name in sorted(os.listdir(BOOKS_DIR)):
        if not is_builtin(name):
            continue
        meta = load_meta(name) or {}
        out.append({"id": name, "label": str(meta.get("short_label") or name)})
    out.sort(key=lambda r: (r["id"] != DEFAULT_BOOK_ID, r["id"]))
    return out
```

- [ ] **Step 6: Run the test to verify it passes**

```bash
cd /Users/vnerald/ai_tutor/backend && pytest test_builtin_books.py -v
```

Expected: 7 passed.

- [ ] **Step 7: Point the frontend sync script at the new layout**

Replace the body of `frontend/scripts/sync-focs-tree.mjs` (keep the filename and the `sync-focs` npm script name so no other tooling breaks):

```js
/**
 * Copy backend/data/books/<id>/outline.json -> src/data/<id>Tree.json for every
 * builtin book, so the Learning bar trees stay bundled.
 * Run from frontend: npm run sync-focs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.join(__dirname, "..");
const repoRoot = path.join(frontendRoot, "..");
const booksDir = path.join(repoRoot, "backend", "data", "books");

/** book id -> bundled tree filename (kept explicit so imports stay greppable). */
const TREE_FILE = { focs: "focsTree.json" };

if (!fs.existsSync(booksDir)) {
  console.error("Books directory not found:", booksDir);
  process.exit(1);
}

let synced = 0;
for (const id of fs.readdirSync(booksDir).sort()) {
  const src = path.join(booksDir, id, "outline.json");
  const name = TREE_FILE[id];
  if (!name || !fs.existsSync(src)) continue;
  const dst = path.join(frontendRoot, "src", "data", name);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  console.log("Synced:", dst);
  synced++;
}

if (synced === 0) {
  console.error("No builtin outlines synced — check TREE_FILE mapping.");
  process.exit(1);
}
```

- [ ] **Step 8: Verify the sync script is a no-op against the committed tree**

```bash
cd /Users/vnerald/ai_tutor/frontend && npm run sync-focs && cd .. && git diff --stat frontend/src/data/focsTree.json
```

Expected: "Synced: .../focsTree.json" and an **empty** diff — the bundled tree already matches the outline.

- [ ] **Step 9: Commit**

```bash
cd /Users/vnerald/ai_tutor
git add backend/builtin_books.py backend/data/books backend/test_builtin_books.py frontend/scripts/sync-focs-tree.mjs
git commit -m "refactor(books): add builtin course registry, migrate FOCS data into it"
```

---

### Task 2: Route textbook resolution through the registry

**Files:**
- Modify: `backend/learning_resources.py:1-140` (globals + `resolve_textbook_for_request`), `:391-407` (`load_focs_pdf`)
- Test: `backend/test_textbook_resolution.py`

**Interfaces:**
- Consumes: `builtin_books` (Task 1) — `is_builtin`, `load_meta`, `load_outline`, `load_pdf_bytes`, `DEFAULT_BOOK_ID`.
- Produces: `learning_resources.resolve_textbook_for_request(book_id, user_email) -> ActiveTextbook` now resolving builtin ids, plus `learning_resources.active_display_name() -> str` used by Task 4.

- [ ] **Step 1: Write the failing test**

Create `backend/test_textbook_resolution.py`:

```python
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
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd /Users/vnerald/ai_tutor/backend && pytest test_textbook_resolution.py -v
```

Expected: `test_second_builtin_resolves_with_its_own_offset_and_outline` FAILS — `ctx.book_id == "focs"` because the current code falls through; `test_active_display_name_follows_the_active_book` FAILS with `AttributeError: module 'learning_resources' has no attribute 'active_display_name'`.

- [ ] **Step 3: Replace the FOCS globals with registry-backed helpers**

In `backend/learning_resources.py`, add `import builtin_books as bb` next to `import user_textbook_store as uts`, then replace lines 25-35 (the `PDF_PAGE_OFFSET` / `FOCS_JSON_PATH` / `FOCS_PDF_PATH` / `_focs_pdf_bytes` / `_focs_json_disk_cache` block) with:

```python
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")

# Kept as module attributes because other modules still read them; they now
# describe the default builtin book rather than a special-cased FOCS.
DEFAULT_BOOK_ID = bb.DEFAULT_BOOK_ID

_topic_list: List[Dict[str, Any]] = []  # [{name, start, end}, ...]
```

Delete `_load_focs_json_from_disk()` entirely and replace `load_focs_pdf()` (lines 391-407) with:

```python
def load_focs_pdf() -> Optional[bytes]:
    """Default builtin book's PDF. Name kept for existing callers."""
    return bb.load_pdf_bytes(DEFAULT_BOOK_ID)
```

Point the two `get_effective_*` fallbacks at the default book:

```python
def get_effective_raw() -> Dict[str, Any]:
    ctx = getattr(_tls, "book", None)
    if ctx is not None:
        return ctx.raw
    return bb.load_outline(DEFAULT_BOOK_ID) or {}


def effective_pdf_page_offset() -> int:
    ctx = getattr(_tls, "book", None)
    if ctx is not None:
        return int(ctx.pdf_page_offset)
    meta = bb.load_meta(DEFAULT_BOOK_ID) or {}
    return int(meta.get("pdf_page_offset", 0))


def effective_memory_book_id() -> str:
    ctx = getattr(_tls, "book", None)
    if ctx is not None:
        return ctx.book_id
    return DEFAULT_BOOK_ID
```

- [ ] **Step 4: Rewrite the single resolution seam**

Replace `resolve_textbook_for_request` (currently `learning_resources.py:110`) in full:

```python
def _builtin_ctx(book_id: str) -> Optional["ActiveTextbook"]:
    meta = bb.load_meta(book_id)
    if meta is None:
        return None
    return ActiveTextbook(
        book_id=book_id,
        raw=bb.load_outline(book_id) or {},
        pdf_bytes=bb.load_pdf_bytes(book_id),
        pdf_page_offset=int(meta.get("pdf_page_offset", 0)),
    )


def resolve_textbook_for_request(book_id: Optional[str], user_email: Optional[str]) -> ActiveTextbook:
    bid = (book_id or DEFAULT_BOOK_ID).strip() or DEFAULT_BOOK_ID

    ctx = _builtin_ctx(bid)
    if ctx is not None:
        return ctx

    if (
        bid.startswith("user_")
        and user_email
        and uts.is_valid_user_book_id(bid)
        and uts.user_owns_book(user_email, bid)
    ):
        meta = uts.load_meta(user_email, bid) or {}
        return ActiveTextbook(
            book_id=bid,
            raw=uts.load_outline(user_email, bid) or {},
            pdf_bytes=uts.load_pdf_bytes(user_email, bid),
            pdf_page_offset=int(meta.get("pdf_page_offset", 0)),
        )

    fallback = _builtin_ctx(DEFAULT_BOOK_ID)
    if fallback is not None:
        return fallback
    return ActiveTextbook(book_id=DEFAULT_BOOK_ID, raw={}, pdf_bytes=None, pdf_page_offset=0)


def active_display_name() -> str:
    """Human name of the active book, for tutor prompts."""
    ctx = getattr(_tls, "book", None)
    bid = ctx.book_id if ctx is not None else DEFAULT_BOOK_ID
    meta = bb.load_meta(bid)
    if meta and meta.get("display_name"):
        return str(meta["display_name"])
    if bid.startswith("user_"):
        return "the textbook the student selected"
    return bid
```

- [ ] **Step 5: Run the new test plus the whole backend suite**

```bash
cd /Users/vnerald/ai_tutor/backend && pytest test_textbook_resolution.py -v && pytest -q
```

Expected: new file passes; the full suite shows no new failures versus the pre-change baseline.

- [ ] **Step 6: Commit**

```bash
cd /Users/vnerald/ai_tutor
git add backend/learning_resources.py backend/test_textbook_resolution.py
git commit -m "refactor(books): resolve textbooks through the builtin registry"
```

---

### Task 3: Widen chapter tokens in the backend, proving FOCS addresses cannot move

This is the only change in PR1 that touches already-persisted data (`backend/data/memory/<book_id>/`), so it gets its own task and its own invariance proof.

**Files:**
- Modify: `backend/learning_resources.py` (`topic_name_to_memory_address`)
- Modify: `backend/student_bar_store.py:198-212`, `:236-249` (docstrings only — see Step 6)
- Test: `backend/test_memory_address.py`

**Interfaces:**
- Consumes: `learning_resources.topic_name_to_memory_address(topic_name: str) -> str`, `learning_resources.request_book`.
- Produces: no new symbols; behaviour widened only for non-numeric chapter tokens.

- [ ] **Step 1: Write the failing test**

Create `backend/test_memory_address.py`. It embeds the pre-change implementation and asserts equality across every topic in the real FOCS outline — that is the byte-identity proof.

```python
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
```

- [ ] **Step 2: Run the test to verify the lettered-chapter case fails**

```bash
cd /Users/vnerald/ai_tutor/backend && pytest test_memory_address.py -v
```

Expected: `test_every_focs_topic_address_is_byte_identical` PASSES already (nothing changed yet); `test_lettered_chapter_sections_now_nest_under_their_chapter` FAILS — it gets the flat `B_1_Complex_Numbers` instead of the nested address.

- [ ] **Step 3: Widen the two regexes**

In `backend/learning_resources.py`, inside `topic_name_to_memory_address`, change only the two patterns:

```python
    # 小节：5.1 / 5.1.1 / B.1 → 父目录为顶层章标题，子目录为本节
    if re.match(r"^(?:\d+|[A-Z])\.\d+(?:\.\d+)*$", token):
```

```python
    # 章级：首词仅为章节号（数字或单个大写字母，如 B）→ 单层
    if re.match(r"^(?:\d+|[A-Z])$", token):
```

Leave `get_chapter_heading_key` unchanged — it already compares tokens as strings, so `"B"` matches `"B Background"`.

- [ ] **Step 4: Run the test to verify all four cases pass**

```bash
cd /Users/vnerald/ai_tutor/backend && pytest test_memory_address.py -v
```

Expected: 3 passed. The byte-identity test still passes — that is the point.

- [ ] **Step 5: Pin the learning-bar's treatment of a lettered chapter**

`student_bar_store.py:198` `_root_chapter_ints_from_raw` matches `^\d+$` and calls `int()`, so a
lettered chapter is excluded from "I've learned through chapter N" auto-marking. **That is the
correct behaviour, not a bug**: a lettered chapter is a background/review chapter (Lathi's "B
Background" covers complex numbers, sinusoids and partial fractions), exactly analogous to FOCS's
chapter 0, which `_apply_learned_through_chapter_n` already skips via `if ch == 0: continue`.

No code change — but the intent is undocumented and untested, so a future reader could "fix" it
and silently change behaviour. Append to `backend/test_memory_address.py`:

```python
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
```

Then correct the two misleading docstrings so the rule reads as deliberate:

`backend/student_bar_store.py:199`:

```python
    """顶层章编号中的数字章（如 1,2,…,5），不含小节。

    字母章（如 Lathi 的 "B Background"）按设计排除：它们是背景/复习章，
    与 FOCS 的第 0 章同类，不参与「学到第 n 章」的自动标记。
    """
```

`backend/student_bar_store.py:239`:

```python
    """学到第 n 章 → 正文第 1..n 章均已掌握。

    背景章不计入：数字 0 章显式跳过，字母章（"B"）由 _root_chapter_ints_from_raw 排除。
    """
```

- [ ] **Step 6: Run the test file again**

```bash
cd /Users/vnerald/ai_tutor/backend && pytest test_memory_address.py -v
```

Expected: 5 passed.

- [ ] **Step 7: Commit**

```bash
cd /Users/vnerald/ai_tutor
git add backend/learning_resources.py backend/student_bar_store.py backend/test_memory_address.py
git commit -m "refactor(books): allow lettered chapter tokens in memory addresses"
```

---

### Task 4: De-hardcode the API layer

**Files:**
- Modify: `backend/api_routes.py` — `:420`, `:556`, `:622` (prompt label), `:868-875` (tree endpoint), `:960-968` (textbook list), `:1000-1008` (`/api/textbook_pages` coercion), `:45` (`FOCS_BOOK_ID`)
- Test: `backend/test_textbook_api.py`

**Interfaces:**
- Consumes: `learning_resources.active_display_name` (Task 2), `builtin_books.list_builtin` / `is_builtin` / `load_outline` / `DEFAULT_BOOK_ID` (Task 1).
- Produces: `GET /api/textbook_tree?id=<book_id>` returning the outline dict; `GET /api/focs_tree` retained as an alias.

- [ ] **Step 1: Write the failing test**

Create `backend/test_textbook_api.py`:

```python
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
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd /Users/vnerald/ai_tutor/backend && pytest test_textbook_api.py -v
```

Expected: the first three tests FAIL (literal present, `FCOS` present, coercion present).

- [ ] **Step 3: Replace the three prompt labels**

At `api_routes.py:419-423`, `:555-559` and `:621-625`, each currently reads a variant of:

```python
    _book_label = (
        "FOCS (Mathematics for Computer Science)"
        if textbook_id == "focs"
        else "the textbook the student selected"
    )
```

Replace each with:

```python
    _book_label = lr.active_display_name()
```

Note each site's local variable name (`textbook_id` vs `tid`) is now unused for this purpose — leave the variable itself alone, it is used elsewhere in those functions.

- [ ] **Step 4: Add the generic tree endpoint and keep the alias**

Replace `api_routes.py:868-875` with:

```python
@router.get("/api/textbook_tree")
async def textbook_tree(id: str = Query(bb.DEFAULT_BOOK_ID)):
    """Outline tree for a builtin book."""
    return bb.load_outline((id or bb.DEFAULT_BOOK_ID).strip()) or {}


@router.get("/api/focs_tree")
async def focs_tree():
    """Deprecated alias for /api/textbook_tree?id=focs."""
    return bb.load_outline(bb.DEFAULT_BOOK_ID) or {}
```

Add `import builtin_books as bb` to the imports at the top of `api_routes.py`.

- [ ] **Step 5: Drive the textbook list from the registry**

Replace the return block of `list_my_textbooks` (`api_routes.py:965-968`):

```python
    return {
        "textbooks": [
            {"id": r["id"], "label": f"{r['label']} (built-in)"} for r in bb.list_builtin()
        ]
        + uts.list_user_textbooks(email),
    }
```

This also removes the `FCOS` misspelling, because the label now comes from `short_label` in `meta.json` (`"FOCS"`).

- [ ] **Step 6: Stop `/api/textbook_pages` from swallowing builtin ids**

Replace `api_routes.py:1000-1008`:

```python
    tid = (textbook_id or bb.DEFAULT_BOOK_ID).strip() or bb.DEFAULT_BOOK_ID
    if tid.startswith("user_"):
        if not user_email:
            raise HTTPException(status_code=401, detail="Not authenticated")
        if not uts.is_valid_user_book_id(tid) or not uts.user_owns_book(user_email, tid):
            raise HTTPException(status_code=404, detail="Textbook not found")
    elif not bb.is_builtin(tid):
        tid = bb.DEFAULT_BOOK_ID
```

- [ ] **Step 7: Replace the remaining default literals**

At `api_routes.py:543`, `:553`, `:602`, `:1224`, `:1240` the pattern `tid = "focs"` guards anonymous access to a private upload and is **already correct** for builtin ids (a builtin id does not start with `user_`). Change only the literal so a future default change is honoured:

```bash
cd /Users/vnerald/ai_tutor/backend
python3 - <<'PY'
import re
p = "api_routes.py"
s = open(p, encoding="utf-8").read()
s = s.replace('tid = (chat_message.textbook_id or "focs").strip() or "focs"',
              'tid = (chat_message.textbook_id or bb.DEFAULT_BOOK_ID).strip() or bb.DEFAULT_BOOK_ID')
s = s.replace('tid = (textbook_id or "focs").strip() or "focs"',
              'tid = (textbook_id or bb.DEFAULT_BOOK_ID).strip() or bb.DEFAULT_BOOK_ID')
s = s.replace('tid = (body.textbook_id or "focs").strip() or "focs"',
              'tid = (body.textbook_id or bb.DEFAULT_BOOK_ID).strip() or bb.DEFAULT_BOOK_ID')
s = s.replace('            tid = "focs"', '            tid = bb.DEFAULT_BOOK_ID')
s = s.replace('        tid = "focs"', '        tid = bb.DEFAULT_BOOK_ID')
s = s.replace('FOCS_BOOK_ID = "focs"', 'FOCS_BOOK_ID = bb.DEFAULT_BOOK_ID')
open(p, "w", encoding="utf-8").write(s)
print("done")
PY
grep -n '"focs"' api_routes.py
```

Expected from the final `grep`: no remaining `"focs"` literals other than inside `_safe`-style validation of upload ids, if any. Inspect and convert anything left by hand.

- [ ] **Step 8: Run the test file and the full backend suite**

```bash
cd /Users/vnerald/ai_tutor/backend && pytest test_textbook_api.py -v && pytest -q
```

Expected: 5 passed in the new file; full suite no worse than baseline.

- [ ] **Step 9: Verify the server still imports and both tree routes answer**

```bash
cd /Users/vnerald/ai_tutor/backend && python3 -c "
import api_routes, builtin_books as bb
paths = {r.path for r in api_routes.router.routes}
assert '/api/textbook_tree' in paths and '/api/focs_tree' in paths, sorted(paths)
assert bb.load_outline('focs'), 'outline empty'
print('routes ok')"
```

Expected: `routes ok`.

- [ ] **Step 10: Commit**

```bash
cd /Users/vnerald/ai_tutor
git add backend/api_routes.py backend/test_textbook_api.py
git commit -m "refactor(books): drive API labels, tree route and page rendering from the registry"
```

---

### Task 5: Frontend chapter-token utility

Three frontend sites each carry their own numeric assumption. Give them one shared, tested definition first, so Tasks 7 and 8 only have to import it.

**Files:**
- Create: `frontend/src/utils/chapterToken.ts`
- Test: `frontend/src/utils/chapterToken.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `CHAPTER_TOKEN_RE: RegExp`, `isChapterToken(token: string): boolean`, `compareChapterTokens(a: string, b: string): number`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/utils/chapterToken.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { CHAPTER_TOKEN_RE, isChapterToken, compareChapterTokens } from "./chapterToken";

describe("chapter tokens", () => {
  it("accepts numeric and single-uppercase-letter chapters", () => {
    for (const t of ["4", "4.1", "24.2", "1.1.1", "B", "B.1", "B.7"]) {
      expect(isChapterToken(t), t).toBe(true);
    }
  });

  it("rejects back-matter first words", () => {
    for (const t of ["Answers", "Supplementary", "Index", "abc", "b", "4a", ""]) {
      expect(isChapterToken(t), t).toBe(false);
    }
  });

  it("is anchored so it cannot match inside a longer string", () => {
    expect(CHAPTER_TOKEN_RE.test("x4.1")).toBe(false);
    expect(CHAPTER_TOKEN_RE.test("4.1x")).toBe(false);
  });

  it("orders lettered chapters before numeric ones, numerics by value", () => {
    expect(["10", "2", "B", "1"].sort(compareChapterTokens)).toEqual(["B", "1", "2", "10"]);
  });

  it("orders multiple lettered chapters alphabetically", () => {
    expect(["C", "1", "A"].sort(compareChapterTokens)).toEqual(["A", "C", "1"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd /Users/vnerald/ai_tutor/frontend && npx vitest run src/utils/chapterToken.test.ts
```

Expected: FAIL — cannot resolve `./chapterToken`.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/utils/chapterToken.ts`:

```ts
/**
 * A chapter/section token is the first word of an outline title: "4", "4.1",
 * "B", "B.1". Lettered chapters exist (Lathi opens with "B Background"), so the
 * numeric-only assumption is gone — but the letter case is restricted to a
 * SINGLE uppercase letter on purpose. A looser [A-Za-z0-9]+ would swallow the
 * first words of back-matter titles like "Answers to Selected Problems" and
 * "Supplementary Reading" and register them as chapters.
 */
export const CHAPTER_TOKEN_RE = /^(?:\d+|[A-Z])(?:\.\d+)*$/;

export function isChapterToken(token: string): boolean {
  return CHAPTER_TOKEN_RE.test(token);
}

/** Lettered chapters (background/appendix) sort before numeric ones. */
export function compareChapterTokens(a: string, b: string): number {
  const na = Number(a);
  const nb = Number(b);
  const aNum = Number.isFinite(na);
  const bNum = Number.isFinite(nb);
  if (aNum && bNum) return na - nb;
  if (aNum) return 1;
  if (bNum) return -1;
  return a.localeCompare(b);
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd /Users/vnerald/ai_tutor/frontend && npx vitest run src/utils/chapterToken.test.ts
```

Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
cd /Users/vnerald/ai_tutor
git add frontend/src/utils/chapterToken.ts frontend/src/utils/chapterToken.test.ts
git commit -m "feat(books): shared chapter-token pattern allowing lettered chapters"
```

---

### Task 6: Frontend book registry

**Files:**
- Create: `frontend/src/books/registry.ts`
- Test: `frontend/src/books/registry.test.ts`

**Interfaces:**
- Consumes: `frontend/src/data/focsTree.json`, `frontend/src/data/focsSectionNotes.ts` (`FOCS_SECTION_NOTES`), `frontend/src/data/focsPracticeSets.ts` (`FOCS_PRACTICE_SETS`), `frontend/src/guide/inductionGuide.ts` (`INDUCTION_GUIDE`).
- Produces: `BOOKS: Record<string, BookDef>`, `DEFAULT_BOOK_ID: "focs"`, `isBuiltinBook(id: string): boolean`, `getBook(id: string): BookDef`, `builtinBookOptions(): { id: string; linkLabel: string }[]`, and the `BookDef` / `PracticeAnchor` types.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/books/registry.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { BOOKS, DEFAULT_BOOK_ID, isBuiltinBook, getBook, builtinBookOptions } from "./registry";

describe("book registry", () => {
  it("has focs as the default builtin", () => {
    expect(DEFAULT_BOOK_ID).toBe("focs");
    expect(isBuiltinBook("focs")).toBe(true);
    expect(isBuiltinBook("user_abcd1234")).toBe(false);
    expect(isBuiltinBook("nope")).toBe(false);
  });

  it("spells the label FOCS", () => {
    expect(BOOKS.focs.shortLabel).toBe("FOCS");
    expect(builtinBookOptions()).toEqual([{ id: "focs", linkLabel: "FOCS" }]);
  });

  it("carries focs content through the registry", () => {
    const b = getBook("focs");
    expect(Object.keys(b.tree).length).toBeGreaterThan(5);
    expect(b.practiceSets["4"]?.title).toBe("Proofs");
    expect(Object.keys(b.sectionNotes).length).toBeGreaterThan(0);
    expect(b.practiceAnchor).toEqual({ kind: "problems_section" });
    expect(b.guides?.length).toBeGreaterThan(0);
    expect(b.onboarding?.noteSection.sectionTitle).toBe("1.2 Speed Dating");
    expect(b.onboarding?.problemsSection.sectionTitle).toBe("5.3 Problems");
  });

  it("falls back to the default book for an unknown id", () => {
    expect(getBook("nope").id).toBe("focs");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd /Users/vnerald/ai_tutor/frontend && npx vitest run src/books/registry.test.ts
```

Expected: FAIL — cannot resolve `./registry`.

- [ ] **Step 3: Write the registry**

Create `frontend/src/books/registry.ts`:

```ts
import focsTree from "../data/focsTree.json";
import { FOCS_SECTION_NOTES } from "../data/focsSectionNotes";
import { FOCS_PRACTICE_SETS } from "../data/focsPracticeSets";
import { INDUCTION_GUIDE } from "../guide/inductionGuide";
import {
  ONBOARDING_NOTE_SECTION,
  ONBOARDING_PROBLEMS_SECTION,
  ONBOARDING_INDUCTION_EXPAND_PATHS,
} from "../onboarding/onboardingDemoSection";
import type { OutlineSectionPreviewDetail } from "../LearningBarPanel";
import type { SectionNote } from "../utils/sectionNotes";
import type { PracticeSet } from "../practice/types";
import type { GuideScript } from "../guide/types";

export type TextbookTreeRoot = Record<string, unknown>;

/** Where a chapter's practice set hangs off the outline. */
export type PracticeAnchor = { kind: "problems_section" } | { kind: "chapter" };

/**
 * Sections the onboarding tour drives the student to. Book-specific by nature —
 * the FOCS tour opens "1.2 Speed Dating" and "5.3 Problems", which do not exist
 * in any other book. A book without this simply has no guided tour.
 */
export interface BookOnboarding {
  noteSection: OutlineSectionPreviewDetail;
  problemsSection: OutlineSectionPreviewDetail;
  expandPaths: string[];
}

export interface BookDef {
  id: string;
  /** Label in the textbook picker. */
  shortLabel: string;
  practiceAnchor: PracticeAnchor;
  tree: TextbookTreeRoot;
  sectionNotes: Record<string, SectionNote>;
  practiceSets: Record<string, PracticeSet>;
  guides?: GuideScript[];
  onboarding?: BookOnboarding;
}

export const DEFAULT_BOOK_ID = "focs";

export const BOOKS: Record<string, BookDef> = {
  focs: {
    id: "focs",
    shortLabel: "FOCS",
    practiceAnchor: { kind: "problems_section" },
    tree: focsTree as TextbookTreeRoot,
    sectionNotes: FOCS_SECTION_NOTES,
    practiceSets: FOCS_PRACTICE_SETS,
    guides: [INDUCTION_GUIDE],
    onboarding: {
      noteSection: ONBOARDING_NOTE_SECTION,
      problemsSection: ONBOARDING_PROBLEMS_SECTION,
      expandPaths: ONBOARDING_INDUCTION_EXPAND_PATHS,
    },
  },
};

export function isBuiltinBook(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(BOOKS, id);
}

export function getBook(id: string): BookDef {
  return BOOKS[id] ?? BOOKS[DEFAULT_BOOK_ID];
}

export function builtinBookOptions(): { id: string; linkLabel: string }[] {
  return Object.values(BOOKS).map((b) => ({ id: b.id, linkLabel: b.shortLabel }));
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd /Users/vnerald/ai_tutor/frontend && npx vitest run src/books/registry.test.ts
```

Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
cd /Users/vnerald/ai_tutor
git add frontend/src/books/registry.ts frontend/src/books/registry.test.ts
git commit -m "feat(books): frontend builtin book registry"
```

---

### Task 7: Point `learningTextbooks.ts` at the registry

**Files:**
- Modify: `frontend/src/learningTextbooks.ts`
- Test: `frontend/src/learningTextbooks.test.ts`

**Interfaces:**
- Consumes: `isBuiltinBook`, `getBook`, `builtinBookOptions`, `DEFAULT_BOOK_ID` (Task 6).
- Produces: `outlineToCurriculum` (renamed from `focsOutlineToCurriculum`); all other exported names unchanged.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/learningTextbooks.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  BUILTIN_TEXTBOOK_OPTIONS,
  readSelectedTextbookId,
  writeSelectedTextbookId,
  getTextbookTree,
  outlineToCurriculum,
} from "./learningTextbooks";

describe("learningTextbooks", () => {
  beforeEach(() => localStorage.clear());

  it("exposes builtins from the registry, spelled FOCS", () => {
    expect(BUILTIN_TEXTBOOK_OPTIONS).toEqual([{ id: "focs", linkLabel: "FOCS" }]);
  });

  it("defaults to focs and round-trips a builtin selection", () => {
    expect(readSelectedTextbookId()).toBe("focs");
    writeSelectedTextbookId("focs");
    expect(readSelectedTextbookId()).toBe("focs");
  });

  it("rejects a bogus stored id", () => {
    localStorage.setItem("ai_tutor_selected_textbook_id", "bogus");
    expect(readSelectedTextbookId()).toBe("focs");
  });

  it("serves a bundled tree for a builtin and an empty one otherwise", () => {
    expect(Object.keys(getTextbookTree("focs")).length).toBeGreaterThan(5);
    expect(getTextbookTree("user_unknown1234")).toEqual({});
  });

  it("outlineToCurriculum walks any outline shape", () => {
    const out = outlineToCurriculum({
      "B Background": { _range: { start: 1, end: 9 }, "B.1 Complex Numbers": { start: 1, end: 5 } },
    });
    const names = out.topics[0].chapters.map((c) => c.chapter);
    expect(names).toContain("B Background");
    expect(names).toContain("B.1 Complex Numbers");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd /Users/vnerald/ai_tutor/frontend && npx vitest run src/learningTextbooks.test.ts
```

Expected: FAIL — `outlineToCurriculum` is not exported (it is currently `focsOutlineToCurriculum`), and `BUILTIN_TEXTBOOK_OPTIONS` reads `FCOS`.

- [ ] **Step 3: Replace the focs literals with registry lookups**

In `frontend/src/learningTextbooks.ts`:

Add at the top, replacing the `focsTreeBundled` import:

```ts
import { BOOKS, DEFAULT_BOOK_ID, builtinBookOptions, getBook, isBuiltinBook } from "./books/registry";
import type { TextbookTreeRoot } from "./books/registry";
export type { TextbookTreeRoot };
```

Then apply these substitutions, each of which is a literal `"focs"` today:

1. `BUILTIN_TEXTBOOK_OPTIONS` becomes `export const BUILTIN_TEXTBOOK_OPTIONS = builtinBookOptions();`
2. In `dedupeCatalogById`, `if (!row.id || row.id === "focs" || !isValidUploadedTextbookId(row.id)) continue;` → `if (!row.id || isBuiltinBook(row.id) || !isValidUploadedTextbookId(row.id)) continue;`
3. In `fetchTextbookOptionsFromServer`, `.filter((x) => x?.id && x.id !== "focs" && isValidUploadedTextbookId(x.id))` → `.filter((x) => x?.id && !isBuiltinBook(x.id) && isValidUploadedTextbookId(x.id))`
4. In `readSelectedTextbookId`, replace both `if (raw === "focs") return "focs";` and every `return "focs";` / `localStorage.setItem(STORAGE_KEY, "focs")` with the registry form: guard with `if (isBuiltinBook(raw)) return raw;` and use `DEFAULT_BOOK_ID` for every fallback.
5. In `writeSelectedTextbookId`, `const safe = id === "focs" || isValidUploadedTextbookId(id) ? id : "focs";` → `const safe = isBuiltinBook(id) || isValidUploadedTextbookId(id) ? id : DEFAULT_BOOK_ID;`
6. In `reconcileSelectedTextbookWithCatalog`, `if (!raw || raw === "focs") return;` → `if (!raw || isBuiltinBook(raw)) return;`, and both `writeSelectedTextbookId("focs")` → `writeSelectedTextbookId(DEFAULT_BOOK_ID)`
7. In `clearAllUploadedTextbooksFromBrowser` and `resetServerTextbookSessionForLogout`, every `"focs"` → `DEFAULT_BOOK_ID`
8. `getTextbookTree`: `if (id === "focs") return focsTreeBundled as TextbookTreeRoot;` → `if (isBuiltinBook(id)) return getBook(id).tree;`
9. `fetchTextbookTreeForId`: same first-line change as (8)
10. Rename `focsOutlineToCurriculum` → `outlineToCurriculum` and keep the body unchanged (it is already generic)

- [ ] **Step 4: Update the one caller of the renamed function**

```bash
cd /Users/vnerald/ai_tutor/frontend && grep -rn "focsOutlineToCurriculum" src/ && \
  grep -rl "focsOutlineToCurriculum" src/ | xargs sed -i '' 's/focsOutlineToCurriculum/outlineToCurriculum/g' && \
  grep -rn "focsOutlineToCurriculum" src/ || echo "no references left"
```

Expected: the final `grep` prints `no references left`.

- [ ] **Step 5: Run the test and the full frontend suite**

```bash
cd /Users/vnerald/ai_tutor/frontend && npx vitest run src/learningTextbooks.test.ts && npm run test:run
```

Expected: 5 passed in the new file; whole suite green.

- [ ] **Step 6: Commit**

```bash
cd /Users/vnerald/ai_tutor
git add frontend/src/learningTextbooks.ts frontend/src/learningTextbooks.test.ts frontend/src
git commit -m "refactor(books): drive textbook selection from the frontend registry"
```

---

### Task 8: Give practice a book dimension

**Files:**
- Modify: `frontend/src/utils/sectionNotes.ts:35-38`, `frontend/src/practice/isProblemsSection.ts`, `frontend/src/data/focsPracticeSets.ts`, `frontend/src/practice/PracticePanel.tsx:3,32`
- Test: `frontend/src/data/focsPracticeSets.test.ts` (update), `frontend/src/practice/isProblemsSection.test.ts` (create)

**Interfaces:**
- Consumes: `CHAPTER_TOKEN_RE`, `compareChapterTokens` (Task 5); `BOOKS`, `getBook`, `DEFAULT_BOOK_ID` (Task 6).
- Produces: `getPracticeSet(bookId: string, chapter: string): PracticeSet | null`, `problemChaptersFor(bookId: string): string[]`. `FOCS_PRACTICE_SETS` stays exported (the registry imports it).

- [ ] **Step 1: Write the failing tests**

Replace the practice-registry assertions in `frontend/src/data/focsPracticeSets.test.ts` — change every `getPracticeSet(x)` call to `getPracticeSet("focs", x)`, every `FOCS_PROBLEM_CHAPTERS` reference to `problemChaptersFor("focs")`, and add:

```ts
  it("keys practice by book, so same-numbered chapters do not collide", () => {
    expect(getPracticeSet("focs", "4")?.title).toBe("Proofs");
    expect(getPracticeSet("no_such_book", "4")?.title).toBe("Proofs"); // falls back to default
    expect(getPracticeSet("focs", "999")).toBeNull();
  });
```

Create `frontend/src/practice/isProblemsSection.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isProblemsSection, chapterOfProblems } from "./isProblemsSection";

describe("isProblemsSection", () => {
  it("still matches FOCS problem sections only", () => {
    expect(isProblemsSection("4.6 Problems")).toBe(true);
    expect(chapterOfProblems("4.6 Problems")).toBe("4");
    for (const decoy of [
      "11.5 Problem Solving with Graphs",
      "12.3 Whirlwind Tour of Graph Problems",
      "23.1 Decision Problems",
      "27 Some Problems",
    ]) {
      expect(isProblemsSection(decoy), decoy).toBe(false);
    }
  });

  it("accepts a lettered chapter's problem section", () => {
    expect(chapterOfProblems("B.8 Problems")).toBe("B");
  });

  it("rejects back-matter titles", () => {
    expect(isProblemsSection("Answers to Selected Problems")).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd /Users/vnerald/ai_tutor/frontend && npx vitest run src/data/focsPracticeSets.test.ts src/practice/isProblemsSection.test.ts
```

Expected: FAIL — `getPracticeSet` takes one argument; `problemChaptersFor` is undefined; `chapterOfProblems("B.8 Problems")` returns `null`.

- [ ] **Step 3: Widen `sectionTokenFromTitle`**

In `frontend/src/utils/sectionNotes.ts`, replace lines 34-38:

```ts
/** First token in a section title if it looks like 1, 1.1, 24.2, B, B.1, … */
export function sectionTokenFromTitle(title: string): string | null {
  const w = title.trim().split(/\s+/)[0] ?? "";
  return CHAPTER_TOKEN_RE.test(w) ? w : null;
}
```

and add at the top of the file:

```ts
import { CHAPTER_TOKEN_RE } from "./chapterToken";
```

- [ ] **Step 4: Widen `isProblemsSection`**

Replace line 5 of `frontend/src/practice/isProblemsSection.ts`:

```ts
const PROBLEMS_RE = /^((?:\d+|[A-Z]))\.\d+\s+Problems$/;
```

Leave both exported functions unchanged — the capture group still yields the chapter token.

- [ ] **Step 5: Add the book dimension to the practice registry**

In `frontend/src/data/focsPracticeSets.ts`, keep every chapter import and `ALL_CHAPTER_SETS` exactly as they are, keep `FOCS_PRACTICE_SETS` exported, and replace the trailing `FOCS_PROBLEM_CHAPTERS` / `getPracticeSet` block with:

```ts
import { compareChapterTokens } from "../utils/chapterToken";
import { BOOKS, DEFAULT_BOOK_ID } from "../books/registry";

export const FOCS_PRACTICE_SETS: Record<string, PracticeSet> = Object.fromEntries(
  ALL_CHAPTER_SETS.map((set) => [set.chapter, set]),
);

/** Chapters that have a practice entry point, per that book's anchor rule. */
export function problemChaptersFor(bookId: string): string[] {
  const book = BOOKS[bookId] ?? BOOKS[DEFAULT_BOOK_ID];
  const chapters = new Set<string>();
  if (book.practiceAnchor.kind === "problems_section") {
    collectProblemChapters(book.tree as Record<string, unknown>, chapters);
  } else {
    for (const key of Object.keys(book.tree)) {
      const token = key.trim().split(/\s+/)[0] ?? "";
      if (token) chapters.add(token);
    }
  }
  return [...chapters].sort(compareChapterTokens);
}

/** Practice set for a chapter token in a given book, or null if none is authored. */
export function getPracticeSet(bookId: string, chapter: string): PracticeSet | null {
  const book = BOOKS[bookId] ?? BOOKS[DEFAULT_BOOK_ID];
  return book.practiceSets[chapter] ?? null;
}
```

Delete the old `FOCS_PROBLEM_CHAPTERS` constant. Keep `collectProblemChapters` as-is.

Note the import cycle this creates (`registry` imports `focsPracticeSets` for `FOCS_PRACTICE_SETS`, and `focsPracticeSets` imports `BOOKS`). ES modules tolerate it because both uses are inside function bodies, not at module-evaluation time — but if Vitest reports `Cannot access 'BOOKS' before initialization`, break the cycle by moving `FOCS_PRACTICE_SETS` into a new `frontend/src/data/practice/focsSets.ts` that neither file imports back.

- [ ] **Step 6: Update the `PracticePanel` call site**

`frontend/src/practice/PracticePanel.tsx` already receives `textbookId` as a prop (used at line 36 for `loadProgress`). Change line 32:

```ts
  const rawSet = getPracticeSet(textbookId, chapter);
```

- [ ] **Step 7: Run the practice tests and the full suite**

```bash
cd /Users/vnerald/ai_tutor/frontend && npx vitest run src/data/focsPracticeSets.test.ts src/practice/isProblemsSection.test.ts src/utils && npm run test:run
```

Expected: all green.

- [ ] **Step 8: Commit**

```bash
cd /Users/vnerald/ai_tutor
git add frontend/src/utils/sectionNotes.ts frontend/src/practice frontend/src/data/focsPracticeSets.ts frontend/src/data/focsPracticeSets.test.ts
git commit -m "refactor(practice): key practice sets by book and allow lettered chapters"
```

---

### Task 9: Per-book notes and section order, then verify the whole PR

**Files:**
- Modify: `frontend/src/utils/focsSectionOrder.ts`, `frontend/src/LearningModel.tsx:448-450`, `:1025-1034`, `:1050-1066`, `:1417`, `:1420`
- Test: `frontend/src/utils/focsSectionOrder.test.ts`

**Interfaces:**
- Consumes: `getBook`, `DEFAULT_BOOK_ID` (Task 6); `getPracticeSet` (Task 8).
- Produces: `sectionTokensPreorder(bookId: string): string[]` replacing the `FOCS_SECTION_TOKENS_PREORDER` constant.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/utils/focsSectionOrder.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { sectionTokensPreorder } from "./focsSectionOrder";

describe("sectionTokensPreorder", () => {
  it("returns focs tokens in reading order", () => {
    const tokens = sectionTokensPreorder("focs");
    expect(tokens.length).toBeGreaterThan(20);
    expect(tokens.indexOf("1.1")).toBeLessThan(tokens.indexOf("1.2"));
    expect(tokens.indexOf("1.1")).toBeLessThan(tokens.indexOf("2.1"));
  });

  it("falls back to the default book for an unknown id", () => {
    expect(sectionTokensPreorder("nope")).toEqual(sectionTokensPreorder("focs"));
  });

  it("memoizes per book (same array identity on repeat calls)", () => {
    expect(sectionTokensPreorder("focs")).toBe(sectionTokensPreorder("focs"));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd /Users/vnerald/ai_tutor/frontend && npx vitest run src/utils/focsSectionOrder.test.ts
```

Expected: FAIL — `sectionTokensPreorder` is not exported.

- [ ] **Step 3: Make section order per-book**

Replace the tail of `frontend/src/utils/focsSectionOrder.ts` (the `FOCS_SECTION_TOKENS_PREORDER` constant) with:

```ts
import { getBook } from "../books/registry";

const cache = new Map<string, string[]>();

/** Outline section tokens in reading order (0, 1.1, 1.2, …), memoized per book. */
export function sectionTokensPreorder(bookId: string): string[] {
  const book = getBook(bookId);
  const hit = cache.get(book.id);
  if (hit) return hit;
  const tokens = collectSectionTokensPreorder(book.tree as FocsNode);
  cache.set(book.id, tokens);
  return tokens;
}
```

and delete the now-unused `import focsTree from "../data/focsTree.json";`.

- [ ] **Step 4: Thread `bookId` through `LearningModel.tsx`**

Three edits, each replacing an `=== "focs"` guard with a registry lookup. `textbookId` is already in scope at all three sites.

At `:448-449`:

```tsx
  const practiceActive = Boolean(practiceChapter && getPracticeSet(textbookId, practiceChapter));
  const guideActive =
    (getBook(textbookId).guides?.length ?? 0) > 0 && isInductionGuideSection(activeSectionTitle);
```

At `:1025-1034`:

```tsx
  const activeSectionNote = useMemo(() => {
    if (!dataMatchedTopic) return null;
    const book = getBook(textbookId);
    if (Object.keys(book.sectionNotes).length === 0) return null;
    return getSectionNoteWithNewVocab(
      book.sectionNotes,
      sectionTokensPreorder(textbookId),
      dataMatchedTopic.sectionHint,
      dataMatchedTopic.name
    );
  }, [textbookId, dataMatchedTopic]);
```

At `:1417`, `script={INDUCTION_GUIDE}` becomes:

```tsx
                  script={getBook(textbookId).guides![0]}
```

This line only renders when `guideActive` is true, which already requires a non-empty `guides` array.

Update the imports at the top of `LearningModel.tsx`: drop `FOCS_SECTION_NOTES`, `FOCS_SECTION_TOKENS_PREORDER` and `INDUCTION_GUIDE`; add `import { getBook } from "./books/registry";` and `import { sectionTokensPreorder } from "./utils/focsSectionOrder";`.

- [ ] **Step 5: Gate the onboarding tour on the book having one**

`ONBOARDING_NOTE_SECTION` / `ONBOARDING_PROBLEMS_SECTION` / `ONBOARDING_INDUCTION_EXPAND_PATHS`
are used at `LearningModel.tsx:1053`, `:1062`, `:1064` and `:1420` with **no** book guard today.
They name FOCS sections ("1.2 Speed Dating", "5.3 Problems"), so a student on any other book would
be walked to sections that do not exist there.

Replace the direct constant references with the registry's copy. Inside the `onTourStep` handler
(around `:1050`), take the book's onboarding config first and bail when a book has none:

```tsx
    const onTourStep = (e: Event) => {
      const stepId = (e as CustomEvent<{ stepId?: string }>).detail?.stepId;
      const onboarding = getBook(textbookId).onboarding;
      if (!onboarding) return;
      if (stepId === "note") {
        void (async () => {
          await handleOutlineSectionPreview(onboarding.noteSection);
```

and further down in the same handler, `emitOnboardingExpandPaths(ONBOARDING_INDUCTION_EXPAND_PATHS)`
becomes `emitOnboardingExpandPaths(onboarding.expandPaths)`, and
`await handleOutlineSectionPreview(ONBOARDING_PROBLEMS_SECTION)` becomes
`await handleOutlineSectionPreview(onboarding.problemsSection)`.

At `:1420`, the guide panel's `onOpenProblems` prop — this line renders only when `guideActive` is
true, which already requires a non-empty `guides` array, but read it off the registry for
consistency:

```tsx
                  onOpenProblems={() => {
                    const ob = getBook(textbookId).onboarding;
                    if (ob) void handleOutlineSectionPreview(ob.problemsSection);
                  }}
```

Finally drop the now-unused `ONBOARDING_NOTE_SECTION` / `ONBOARDING_PROBLEMS_SECTION` /
`ONBOARDING_INDUCTION_EXPAND_PATHS` import block at `LearningModel.tsx:43-46`. Leave the
`./onboarding/onboardingStorage` import above it alone — that one is still used.

Verify nothing references the constants directly any more:

```bash
cd /Users/vnerald/ai_tutor/frontend && grep -rn "ONBOARDING_NOTE_SECTION\|ONBOARDING_PROBLEMS_SECTION\|ONBOARDING_INDUCTION_EXPAND_PATHS" src/ --include="*.tsx"
```

Expected: no hits in `.tsx` files (the constants now flow through `src/books/registry.ts`).

- [ ] **Step 6: Typecheck and run every suite on both sides**

```bash
cd /Users/vnerald/ai_tutor/frontend && npx tsc -b --noEmit && npm run test:run
cd /Users/vnerald/ai_tutor/backend && pytest -q
```

Expected: typecheck clean, both suites green.

- [ ] **Step 7: Prove the zero-behaviour-change claim explicitly**

```bash
cd /Users/vnerald/ai_tutor
# No FOCS memory address moved (Task 3's invariance test, re-run in isolation)
cd backend && pytest test_memory_address.py -v && cd ..
# The bundled tree is still byte-identical to the outline the backend serves
diff <(python3 -c "import json;print(json.dumps(json.load(open('backend/data/books/focs/outline.json')),sort_keys=True))") \
     <(python3 -c "import json;print(json.dumps(json.load(open('frontend/src/data/focsTree.json')),sort_keys=True))") \
  && echo "trees identical"
# No user-visible FCOS remains anywhere
! grep -rn "FCOS" backend frontend/src frontend/scripts 2>/dev/null && echo "no FCOS left"
```

Expected: invariance test passes, `trees identical`, `no FCOS left`.

- [ ] **Step 8: Commit and push the branch**

```bash
cd /Users/vnerald/ai_tutor
git add frontend/src
git commit -m "refactor(books): per-book section notes, ordering and guides in LearningModel"
git push -u origin feat/multi-course-signals
```

---

## Verification Summary

After Task 9 the following must all hold — these are PR1's acceptance criteria:

1. `cd backend && pytest -q` green; `cd frontend && npm run test:run` green; `npx tsc -b --noEmit` clean.
2. `backend/test_memory_address.py::test_every_focs_topic_address_is_byte_identical` passes — no persisted FOCS memory is orphaned.
3. `grep -rn "FCOS"` finds nothing in `backend/`, `frontend/src/`, `frontend/scripts/`.
4. `grep -rn '"focs"' backend/api_routes.py` finds no remaining default-id literals.
5. `GET /api/textbook_tree?id=focs` and `GET /api/focs_tree` return the same outline.
6. No Lathi file exists anywhere in the tree — second-book support is proven only by the fixture-book tests in `test_builtin_books.py`, `test_textbook_resolution.py` and `test_memory_address.py`.
