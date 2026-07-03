"""Per-user Course Grade Tracker persistence.

Clones student_bar_store's shape (D4 — do NOT refactor the shared store; a little
duplication is cheaper than a cross-module refactor of Jin's code):

    - MongoDB primary (`database.grades()` collection), keyed {user_email, course_id}
    - filesystem fallback (data/student_grades/<safe_email>__<course_id>.json) for local
      dev with no MONGODB_URI
    - graceful disable: every accessor no-ops / returns None when the DB is absent AND the
      file path is unavailable

v1 stores ONE rich course per user under a FIXED course_id slot ("default", D1). course_id
is kept as a parameter so multi-course later is an ADDITIVE change with no data migration.

The stored doc is the RICH wire/frontend course shape (name/term/categories/cutoffs, with
item ids and null scores) stored VERBATIM. grades_serde projects it down to grades_math only
at compute time; this layer never computes and never mutates the course body (it only stamps
`updated_at`).
"""

from __future__ import annotations

import json
import os
import re
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import database

GRADE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "student_grades")

DEFAULT_COURSE_ID = "default"

# Reserved doc keys that belong to the storage layer, not the course body.
_STORAGE_KEYS = ("_id", "user_email", "course_id")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _safe_id(value: Optional[str], fallback: str) -> str:
    if not value:
        return fallback
    cleaned = re.sub(r"[^A-Za-z0-9_@.\-]", "_", value.strip())
    cleaned = re.sub(r"_+", "_", cleaned).strip("_")
    return cleaned or fallback


def _grade_path(user_email: str, course_id: str) -> str:
    os.makedirs(GRADE_DIR, exist_ok=True)
    uid = _safe_id(user_email, "unknown")[:200]
    cid = _safe_id(course_id, DEFAULT_COURSE_ID)
    return os.path.join(GRADE_DIR, f"{uid}__{cid}.json")


def _clean_stored_doc(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Strip storage-layer keys so callers get the pure rich course body back."""
    out = {k: v for k, v in doc.items() if k not in _STORAGE_KEYS}
    return out


# --------------------------------------------------------------------------- #
# File fallback
# --------------------------------------------------------------------------- #
def _load_course_file(user_email: str, course_id: str) -> Optional[Dict[str, Any]]:
    path = _grade_path(user_email, course_id)
    if not os.path.exists(path):
        return None
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return _clean_stored_doc(data) if isinstance(data, dict) else None
    except Exception:
        return None


def _save_course_file(user_email: str, course_id: str, stored: Dict[str, Any]) -> None:
    path = _grade_path(user_email, course_id)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(stored, f, ensure_ascii=False, indent=2)


def _delete_course_file(user_email: str, course_id: str) -> bool:
    path = _grade_path(user_email, course_id)
    if not os.path.exists(path):
        return False
    try:
        os.remove(path)
        return True
    except OSError:
        return False


# --------------------------------------------------------------------------- #
# Public API (Mongo-primary, file-fallback)
# --------------------------------------------------------------------------- #
def load_course(user_email: str, course_id: str = DEFAULT_COURSE_ID) -> Optional[Dict[str, Any]]:
    """Return the user's saved rich course doc, or None if none saved."""
    col = database.grades()
    if col is not None:
        doc = col.find_one({"user_email": user_email, "course_id": course_id})
        return _clean_stored_doc(dict(doc)) if doc else None
    return _load_course_file(user_email, course_id)


def save_course(
    user_email: str, course: Dict[str, Any], course_id: str = DEFAULT_COURSE_ID
) -> Dict[str, Any]:
    """Persist the rich course doc VERBATIM (+ updated_at). Returns the stored body."""
    stored = {k: v for k, v in course.items() if k not in _STORAGE_KEYS}
    stored["updated_at"] = _now_iso()
    col = database.grades()
    if col is not None:
        doc = dict(stored)
        doc["user_email"] = user_email
        doc["course_id"] = course_id
        col.update_one(
            {"user_email": user_email, "course_id": course_id},
            {"$set": doc},
            upsert=True,
        )
    else:
        _save_course_file(user_email, course_id, stored)
    return stored


def delete_course(user_email: str, course_id: str = DEFAULT_COURSE_ID) -> bool:
    """Remove the user's saved course. Returns True if something was deleted."""
    col = database.grades()
    if col is not None:
        res = col.delete_one({"user_email": user_email, "course_id": course_id})
        return getattr(res, "deleted_count", 0) > 0
    return _delete_course_file(user_email, course_id)
