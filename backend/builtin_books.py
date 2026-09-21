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
# Keyed by (BOOKS_DIR, book_id) — not book_id alone — because the thing being
# cached depends on BOOKS_DIR too. Tests that monkeypatch BOOKS_DIR and later
# revert it must not serve stale entries under the reverted root's book ids.
_meta_cache: Dict[Any, Optional[Dict[str, Any]]] = {}
_outline_cache: Dict[Any, Optional[Dict[str, Any]]] = {}
_pdf_cache: Dict[Any, Optional[bytes]] = {}


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
    key = (BOOKS_DIR, book_id)
    with _lock:
        if key in _meta_cache:
            return _meta_cache[key]
    d = _book_dir(book_id or "")
    meta = _read_json(os.path.join(d, "meta.json")) if d else None
    with _lock:
        _meta_cache[key] = meta
    return meta


def load_outline(book_id: str) -> Optional[Dict[str, Any]]:
    key = (BOOKS_DIR, book_id)
    with _lock:
        if key in _outline_cache:
            return _outline_cache[key]
    d = _book_dir(book_id or "")
    outline = _read_json(os.path.join(d, "outline.json")) if d else None
    with _lock:
        _outline_cache[key] = outline
    return outline


def load_pdf_bytes(book_id: str) -> Optional[bytes]:
    key = (BOOKS_DIR, book_id)
    with _lock:
        if key in _pdf_cache:
            return _pdf_cache[key]
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
        _pdf_cache[key] = data
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
