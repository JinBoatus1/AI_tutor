"""Per-student learning progress bar storage and prompt helpers."""

from __future__ import annotations

import json
import os
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import learning_resources as lr
import database


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


def load_bar_mongo(user_email: str) -> Dict[str, Any]:
    """Load learning bar from MongoDB for a logged-in user."""
    col = database.learning_bars()
    if col is None:
        return _empty_bar(user_email)
    doc = col.find_one({"user_email": user_email, "subject": "focs"})
    if not doc:
        return _empty_bar(user_email)
    bar = dict(doc)
    bar.pop("_id", None)
    bar.pop("user_email", None)
    bar.pop("subject", None)
    bar.setdefault("student_id", user_email)
    bar.setdefault("current_section", None)
    bar.setdefault("learned_sections", [])
    bar.setdefault("planned_sections", [])
    bar.setdefault("confusion_counts", {})
    bar.setdefault("updated_at", _now_iso())
    return bar


def save_bar_mongo(user_email: str, bar: Dict[str, Any]) -> None:
    """Save learning bar to MongoDB for a logged-in user."""
    col = database.learning_bars()
    if col is None:
        return
    bar["updated_at"] = _now_iso()
    doc = {k: v for k, v in bar.items() if k not in ("_id",)}
    doc["user_email"] = user_email
    doc["subject"] = "focs"
    col.update_one(
        {"user_email": user_email, "subject": "focs"},
        {"$set": doc},
        upsert=True,
    )


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


def _root_chapter_ints_from_focs() -> List[int]:
    """FOCS.json 顶层章编号（如 1,2,…,5），不含小节。"""
    if not os.path.exists(lr.FOCS_JSON_PATH):
        return []
    with open(lr.FOCS_JSON_PATH, "r", encoding="utf-8") as f:
        raw = json.load(f)
    nums: List[int] = []
    for k, v in raw.items():
        if k == "_range" or not isinstance(v, dict):
            continue
        first = k.split()[0] if k.split() else ""
        if re.match(r"^\d+$", first):
            try:
                nums.append(int(first))
            except ValueError:
                pass
    return sorted(set(nums))


def _extract_explicit_chapter_numbers(msg: str) -> List[int]:
    """
    仅识别「整章」引用，避免把 5.1 当成章 5。
    返回消息中出现的所有候选章号；调用方再取 max 作为「学到第几章」。
    """
    s = msg or ""
    found: List[int] = []
    for m in re.finditer(r"(?i)\bch(?:apter)?\.?\s*(\d+)\b", s):
        found.append(int(m.group(1)))
    for m in re.finditer(r"第\s*(\d+)\s*章", s):
        found.append(int(m.group(1)))
    for m in re.finditer(r"(?i)(?<![a-z0-9.])c(\d+)\b", s):
        found.append(int(m.group(1)))
    for m in re.finditer(r"(?i)\bcapter\.?\s*(\d+)\b", s):
        found.append(int(m.group(1)))
    for m in re.finditer(r"(?i)chapters?\s*(\d+)\s*[-–]\s*(\d+)", s):
        found.append(int(m.group(1)))
        found.append(int(m.group(2)))
    return found


def _apply_learned_through_chapter_n(
    bar: Dict[str, Any], n: int, valid_tokens: set[str]
) -> None:
    """学到第 n 章 → 默认正文第 1..n 章（FOCS 顶层章号，跳过第 0 章 Background）均已掌握。"""
    learned = set(bar.get("learned_sections") or [])
    for ch in _root_chapter_ints_from_focs():
        if ch == 0:
            continue
        if ch <= n:
            tok = str(ch)
            if tok in valid_tokens:
                learned.add(tok)
    bar["learned_sections"] = sorted(learned, key=lambda x: tuple(int(p) for p in x.split(".")))
    bar["current_section"] = str(n)


def _ordered_section_tokens_preorder() -> List[str]:
    """FOCS 树前序遍历的节号列表（与教材目录顺序一致）。"""
    if not os.path.exists(lr.FOCS_JSON_PATH):
        return []
    with open(lr.FOCS_JSON_PATH, "r", encoding="utf-8") as f:
        raw = json.load(f)
    out: List[str] = []

    def walk(obj: Dict[str, Any]) -> None:
        for k, v in obj.items():
            if k == "_range" or not isinstance(v, dict):
                continue
            first = k.split()[0] if k.split() else ""
            if re.match(r"^\d+(?:\.\d+)*$", first):
                out.append(first)
            walk(v)

    walk(raw)
    return out


def _extract_subsection_tokens(message: str, valid_tokens: set[str]) -> List[str]:
    """仅匹配含小数点的小节 token（5.3、5.1.1），按在消息中首次出现顺序去重。"""
    found = re.findall(r"\b\d+\.\d+(?:\.\d+)*\b", message or "")
    seen: List[str] = []
    for t in found:
        if t in valid_tokens and t not in seen:
            seen.append(t)
    return seen


def _apply_learned_through_subsection(
    bar: Dict[str, Any],
    target_token: str,
    valid_tokens: set[str],
    ordered: List[str],
) -> None:
    """
    学到小节如 5.3 → 在该章子树内，从章根（5）到 5.3 的前序闭包全部标为已学（含 5、5.1、5.1.1…5.3）。
    不推断其它章（1–4）已学。
    """
    if target_token not in ordered:
        return
    root = target_token.split(".")[0]
    try:
        start = next(i for i, t in enumerate(ordered) if t == root)
    except StopIteration:
        return
    try:
        end = ordered.index(target_token)
    except ValueError:
        return
    if end < start:
        return
    learned = set(bar.get("learned_sections") or [])
    for t in ordered[start : end + 1]:
        if t in valid_tokens:
            learned.add(t)
    bar["learned_sections"] = sorted(learned, key=lambda x: tuple(int(p) for p in x.split(".")))
    bar["current_section"] = target_token


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

    # 必须同时命中「进度语义」+ 消息里的节号，才会写入 learned（避免只贴目录就标成已学）
    learned_kw = [
        "学过",
        "已经学",
        "学完了",
        "学会",
        "掌握",
        "finished",
        "completed",
        "already learned",
        "already learnt",
        "have learned",
        "have learnt",
        "have done",
        "i've done",
        "ive done",
        "done with",
        "mastered",
        "covered",
        "learned",  # e.g. "I learned 5.1" (substring of already learned is ok)
        "learnt",
        "reached",
        "up to",
        "through section",
        "through ch",
        "through chapter",
        "as far as",
    ]
    # 「学到」只在明显表「已学过」时用 learned；表「目前进度」走 current，避免与 learned 重复一套词
    current_kw = [
        "目前",
        "现在",
        "学到",  # 进度：「学到 6.3」不等同于整章已学完
        "i'm at",
        "im at",
        "currently",
        "currently at",
        "so far",
        "right now",
        "stuck at",
        "working on",
    ]
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

    # 学到第 N 章（c5 / chapter 5 / 第5章）→ 默认第 1..N 章在 bar 里都标为已学（仅当语义是「已学到/完成到」而非「想学」）。
    past_through_chapter_kw = [
        "学到",
        "学过",
        "学完了",
        "已经学",
        "finished",
        "completed",
        "learned",
        "learnt",
        "reached",
        "up to",
        "through chapter",
        "through ch",
        "mastered",
        "covered",
        "have learned",
        "have learnt",
        "have done",
        "as far as",
        "done with",
        "already learned",
        "already learnt",
    ]
    # 仅排除「主要是接下来要学这章」而没有任何已学到语义的情况（避免误把计划学 ch5 标成已学 1–5）
    future_study_kw = [
        "want to learn",
        "want to study",
        "要学",
        "想学",
        "will study",
        "going to study",
    ]
    has_past_through = _contains_any(msg, past_through_chapter_kw)
    wants_only_future = _contains_any(msg_lower, future_study_kw) and not re.search(
        r"(?i)(finished|completed|学到|学过|学完了|reached|have\s+learned|have\s+learnt|up\s+to|through\s+ch)",
        msg,
    )
    should_apply_through = has_past_through and not wants_only_future

    explicit_chapters = _extract_explicit_chapter_numbers(msg)
    if explicit_chapters and should_apply_through:
        n_through = max(explicit_chapters)
        _apply_learned_through_chapter_n(bar, n_through, valid)

    # 学到 5.3 等小节 → 该章内从章根到该节的前序节点全部标为已学（不自动标 1–4 章）
    subsection_hits = _extract_subsection_tokens(msg, valid)
    if subsection_hits and should_apply_through:
        ordered = _ordered_section_tokens_preorder()
        in_order = [t for t in subsection_hits if t in ordered]
        if in_order:
            target_sub = max(in_order, key=lambda t: ordered.index(t))
            _apply_learned_through_subsection(bar, target_sub, valid, ordered)

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


def update_bar_from_message_on_bar(bar: Dict[str, Any], message: str) -> Dict[str, Any]:
    """Same heuristic update as update_bar_from_message but operates on an existing bar dict (no file I/O)."""
    token_map = _load_tree_token_map()
    valid = set(token_map.keys())
    msg = (message or "").strip()
    tokens = _extract_section_tokens(msg, valid)
    msg_lower = msg.lower()

    learned_kw = [
        "学过", "已经学", "学完了", "学会", "掌握", "finished", "completed",
        "already learned", "already learnt", "have learned", "have learnt",
        "have done", "i've done", "ive done", "done with", "mastered",
        "covered", "learned", "learnt", "reached", "up to",
        "through section", "through ch", "through chapter", "as far as",
    ]
    current_kw = [
        "目前", "现在", "学到", "i'm at", "im at", "currently",
        "currently at", "so far", "right now", "stuck at", "working on",
    ]
    planned_kw = [
        "想学", "要学", "next", "plan to learn", "want to study",
        "study now", "review", "复习",
    ]
    confusion_kw = [
        "不懂", "没懂", "看不懂", "不会", "卡住", "confused",
        "don't understand", "cannot solve", "stuck",
    ]
    past_through_chapter_kw = [
        "学到", "学过", "学完了", "已经学", "finished", "completed",
        "learned", "learnt", "reached", "up to", "through chapter",
        "through ch", "mastered", "covered", "have learned", "have learnt",
        "have done", "as far as", "done with", "already learned", "already learnt",
    ]
    future_study_kw = [
        "want to learn", "want to study", "要学", "想学",
        "will study", "going to study",
    ]
    has_past_through = _contains_any(msg, past_through_chapter_kw)
    wants_only_future = _contains_any(msg_lower, future_study_kw) and not re.search(
        r"(?i)(finished|completed|学到|学过|学完了|reached|have\s+learned|have\s+learnt|up\s+to|through\s+ch)",
        msg,
    )
    should_apply_through = has_past_through and not wants_only_future

    explicit_chapters = _extract_explicit_chapter_numbers(msg)
    if explicit_chapters and should_apply_through:
        n_through = max(explicit_chapters)
        _apply_learned_through_chapter_n(bar, n_through, valid)

    subsection_hits = _extract_subsection_tokens(msg, valid)
    if subsection_hits and should_apply_through:
        ordered = _ordered_section_tokens_preorder()
        in_order = [t for t in subsection_hits if t in ordered]
        if in_order:
            target_sub = max(in_order, key=lambda t: ordered.index(t))
            _apply_learned_through_subsection(bar, target_sub, valid, ordered)

    if tokens and _contains_any(msg, learned_kw):
        learned_set = set(bar.get("learned_sections") or [])
        for t in tokens:
            learned_set.add(t)
        bar["learned_sections"] = sorted(learned_set, key=lambda x: tuple(int(p) for p in x.split(".")))

    if tokens and _contains_any(msg, current_kw):
        bar["current_section"] = tokens[-1]

    if tokens and _contains_any(msg, planned_kw):
        planned = set(bar.get("planned_sections") or [])
        for t in tokens:
            planned.add(t)
        bar["planned_sections"] = sorted(planned, key=lambda x: tuple(int(p) for p in x.split(".")))

    if _contains_any(msg_lower, confusion_kw):
        confusion_counts = bar.get("confusion_counts") or {}
        targets = tokens[:] if tokens else ([bar.get("current_section")] if bar.get("current_section") else [])
        for t in targets:
            if not t:
                continue
            confusion_counts[t] = int(confusion_counts.get(t, 0)) + 1
        bar["confusion_counts"] = confusion_counts

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

