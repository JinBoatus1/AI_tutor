"""Per-user uploaded textbooks: outline JSON (FOCS tree shape), PDF, metadata."""

from __future__ import annotations

import json
import os
import re
import uuid
from typing import Any, Dict, List, Optional

BASE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "user_textbooks")

_BOOK_ID_RE = re.compile(r"^user_[A-Za-z0-9_-]{4,64}$")


def _safe_email_segment(email: str) -> str:
    e = (email or "").strip().lower()
    return re.sub(r"[^a-z0-9@._-]", "_", e)[:200] or "unknown"


def user_dir(email: str) -> str:
    d = os.path.join(BASE_DIR, _safe_email_segment(email))
    os.makedirs(d, exist_ok=True)
    return d


def new_book_id() -> str:
    return f"user_{uuid.uuid4().hex[:12]}"


def is_valid_user_book_id(book_id: str) -> bool:
    return bool(book_id and _BOOK_ID_RE.match(book_id))


def book_root(email: str, book_id: str) -> str:
    return os.path.join(user_dir(email), book_id)


def save_user_textbook(
    email: str,
    book_id: str,
    outline: Dict[str, Any],
    pdf_bytes: bytes,
    *,
    label: str,
    pdf_page_offset: int,
) -> None:
    root = book_root(email, book_id)
    os.makedirs(root, exist_ok=True)
    meta = {
        "id": book_id,
        "label": label or book_id,
        "pdf_page_offset": int(pdf_page_offset),
    }
    with open(os.path.join(root, "meta.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
    with open(os.path.join(root, "outline.json"), "w", encoding="utf-8") as f:
        json.dump(outline, f, ensure_ascii=False, indent=2)
    with open(os.path.join(root, "book.pdf"), "wb") as f:
        f.write(pdf_bytes)


def list_user_textbooks(email: str) -> List[Dict[str, Any]]:
    d = user_dir(email)
    out: List[Dict[str, Any]] = []
    if not os.path.isdir(d):
        return out
    for name in sorted(os.listdir(d)):
        path = os.path.join(d, name)
        if not os.path.isdir(path):
            continue
        meta_path = os.path.join(path, "meta.json")
        if not os.path.isfile(meta_path):
            continue
        try:
            with open(meta_path, encoding="utf-8") as f:
                meta = json.load(f)
            bid = meta.get("id") or name
            if not is_valid_user_book_id(str(bid)):
                continue
            out.append({"id": str(bid), "label": str(meta.get("label") or bid)})
        except Exception:
            continue
    return out


def load_meta(email: str, book_id: str) -> Optional[Dict[str, Any]]:
    p = os.path.join(book_root(email, book_id), "meta.json")
    if not os.path.isfile(p):
        return None
    try:
        with open(p, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


def load_outline(email: str, book_id: str) -> Optional[Dict[str, Any]]:
    p = os.path.join(book_root(email, book_id), "outline.json")
    if not os.path.isfile(p):
        return None
    try:
        with open(p, encoding="utf-8") as f:
            raw = json.load(f)
        return raw if isinstance(raw, dict) else None
    except Exception:
        return None


def load_pdf_bytes(email: str, book_id: str) -> Optional[bytes]:
    p = os.path.join(book_root(email, book_id), "book.pdf")
    if not os.path.isfile(p):
        return None
    try:
        with open(p, "rb") as f:
            return f.read()
    except Exception:
        return None


def user_owns_book(email: str, book_id: str) -> bool:
    return bool(load_meta(email, book_id))
