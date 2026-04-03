"""Per-student learning progress bar storage and prompt helpers."""

from __future__ import annotations

import json
import os
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import learning_resources as lr


STUDENT_BAR_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "student_bars")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _safe_student_id(student_id: Optional[str]) -> str:
    if not student_id:
        return "default_student"
    cleaned = re.sub(r"[^A-Za-z0-9_\-]", "_", student_id.strip())
    cleaned = re.sub(r"_+", "_", cleaned).strip("_")
    return cleaned or "default_student"


def _bar_path(student_id: str) -> str:
    os.makedirs(STUDENT_BAR_DIR, exist_ok=True)
    sid = _safe_student_id(student_id)
    return os.path.join(STUDENT_BAR_DIR, f"{sid}.json")


def _empty_bar(student_id: str) -> Dict[str, Any]:
    return {
        "student_id": _safe_student_id(student_id),
        "current_section": None,
        "learned_sections": [],
        "planned_sections": [],
        "confusion_counts": {},
        "updated_at": _now_iso(),
    }


def load_bar(student_id: str) -> Dict[str, Any]:
    path = _bar_path(student_id)
    if not os.path.exists(path):
        return _empty_bar(student_id)
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, dict):
            return _empty_bar(student_id)
        # Backward/defensive defaults
        data.setdefault("student_id", _safe_student_id(student_id))
        data.setdefault("current_section", None)
        data.setdefault("learned_sections", [])
        data.setdefault("planned_sections", [])
        data.setdefault("confusion_counts", {})
        data.setdefault("updated_at", _now_iso())
        return data
    except Exception:
        return _empty_bar(student_id)


def save_bar(student_id: str, bar: Dict[str, Any]) -> None:
    path = _bar_path(student_id)
    bar["student_id"] = _safe_student_id(student_id)
    bar["updated_at"] = _now_iso()
    with open(path, "w", encoding="utf-8") as f:
        json.dump(bar, f, ensure_ascii=False, indent=2)


def _load_tree_token_map() -> Dict[str, str]:
    """Map section token (e.g. 5, 5.1, 5.1.1) -> canonical tree title."""
    if not os.path.exists(lr.FOCS_JSON_PATH):
        return {}
    with open(lr.FOCS_JSON_PATH, "r", encoding="utf-8") as f:
        raw = json.load(f)
    mapping: Dict[str, str] = {}

    def walk(obj: Dict[str, Any]) -> None:
        for k, v in obj.items():
            if k == "_range" or not isinstance(v, dict):
                continue
            first = k.split()[0] if k.split() else ""
            if re.match(r"^\d+(?:\.\d+)*$", first):
                mapping[first] = k
            walk(v)

    walk(raw)
    return mapping


def _extract_section_tokens(message: str, valid_tokens: set[str]) -> List[str]:
    tokens = re.findall(r"\b\d+(?:\.\d+)*\b", message or "")
    out: List[str] = []
    for t in tokens:
        if t in valid_tokens and t not in out:
            out.append(t)
    return out


def _contains_any(text: str, keywords: List[str]) -> bool:
    s = (text or "").lower()
    return any(k in s for k in keywords)


def update_bar_from_message(student_id: str, message: str) -> Dict[str, Any]:
    """Heuristic update: parse progress mentions from user's message."""
    bar = load_bar(student_id)
    token_map = _load_tree_token_map()
    valid = set(token_map.keys())
    msg = (message or "").strip()
    tokens = _extract_section_tokens(msg, valid)
    msg_lower = msg.lower()

    learned_kw = [
        "学过",
        "学到",
        "已经学",
        "finished",
        "completed",
        "already learned",
        "covered",
    ]
    current_kw = ["目前", "现在", "学到", "at", "currently", "currently at", "so far"]
    planned_kw = [
        "想学",
        "要学",
        "next",
        "plan to learn",
        "want to study",
        "study now",
        "review",
        "复习",
    ]
    confusion_kw = [
        "不懂",
        "没懂",
        "看不懂",
        "不会",
        "卡住",
        "confused",
        "don't understand",
        "cannot solve",
        "stuck",
    ]

    # Update learned sections when user explicitly says learned/completed.
    if tokens and _contains_any(msg, learned_kw):
        learned = set(bar.get("learned_sections") or [])
        for t in tokens:
            learned.add(t)
        bar["learned_sections"] = sorted(learned, key=lambda x: tuple(int(p) for p in x.split(".")))

    # Update current section.
    if tokens and _contains_any(msg, current_kw):
        bar["current_section"] = tokens[-1]

    # Update planned sections.
    if tokens and _contains_any(msg, planned_kw):
        planned = set(bar.get("planned_sections") or [])
        for t in tokens:
            planned.add(t)
        bar["planned_sections"] = sorted(planned, key=lambda x: tuple(int(p) for p in x.split(".")))

    # Confusion tracking: if user says "don't understand", count it on mentioned/current section.
    if _contains_any(msg_lower, confusion_kw):
        confusion_counts = bar.get("confusion_counts") or {}
        targets = tokens[:] if tokens else ([bar.get("current_section")] if bar.get("current_section") else [])
        for t in targets:
            if not t:
                continue
            confusion_counts[t] = int(confusion_counts.get(t, 0)) + 1
        bar["confusion_counts"] = confusion_counts

    save_bar(student_id, bar)
    return bar


def _label(token: str, token_map: Dict[str, str]) -> str:
    return token_map.get(token, token)


def build_bar_prompt(bar: Dict[str, Any]) -> str:
    token_map = _load_tree_token_map()
    learned = bar.get("learned_sections") or []
    planned = bar.get("planned_sections") or []
    current = bar.get("current_section")
    confusion_counts = bar.get("confusion_counts") or {}

    learned_labels = [_label(t, token_map) for t in learned]
    planned_labels = [_label(t, token_map) for t in planned]
    current_label = _label(current, token_map) if current else "None yet"

    repeated_confusions: List[Tuple[str, int]] = []
    learned_set = set(learned)
    for sec, cnt in confusion_counts.items():
        if sec in learned_set and int(cnt) >= 2:
            repeated_confusions.append((sec, int(cnt)))
    repeated_confusions.sort(key=lambda x: -x[1])
    repeated_labels = [f"{_label(sec, token_map)} (x{cnt})" for sec, cnt in repeated_confusions[:5]]

    return (
        "\n\n--- Hidden student progress bar (tree-aligned; do not expose as raw JSON) ---\n"
        f"Current section: {current_label}\n"
        f"Learned sections: {', '.join(learned_labels) if learned_labels else 'None recorded'}\n"
        f"Planned sections: {', '.join(planned_labels) if planned_labels else 'None recorded'}\n"
        f"Repeated confusion in already-learned sections: {', '.join(repeated_labels) if repeated_labels else 'None'}\n"
        "--- End progress bar ---\n"
        "Tutor policy using this bar:\n"
        "1) Prefer concepts from learned/current/planned sections.\n"
        "2) Avoid unexplained advanced concepts outside this scope.\n"
        "3) If you must use a beyond-scope concept, add a one-line bridge definition first.\n"
        "4) If repeated confusion appears in a section marked learned, gently remind the student this was marked as learned and schedule a quick remediation step.\n"
    )

