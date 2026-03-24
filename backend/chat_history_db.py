"""
聊天历史数据库：用单个 JSON 文件存储用户与 agent 的对话。

结构：
- 每个 chat session 作为一個 topic
- 每个 topic 下有多个 Q&A 条目，每条带 summary
- Agent 回答前可先 go over 这些 summary，判断是否有类似问题已回答，节省 API 调用
"""

from __future__ import annotations

import json
import os
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

# JSON 文件路径
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
CHAT_HISTORY_PATH = os.path.join(DATA_DIR, "chat_history.json")

# 默认 session（前端未传 session_id 时使用）
DEFAULT_SESSION_ID = "default"


def _ensure_data_dir() -> None:
    Path(DATA_DIR).mkdir(parents=True, exist_ok=True)


def _load() -> Dict[str, Any]:
    """加载 JSON 文件。"""
    _ensure_data_dir()
    path = CHAT_HISTORY_PATH
    if not os.path.exists(path):
        return {"version": 1, "sessions": {}}
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {"version": 1, "sessions": {}}


def _save(data: Dict[str, Any]) -> None:
    """保存 JSON 文件。"""
    _ensure_data_dir()
    with open(CHAT_HISTORY_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def _make_summary(question: str, answer: str, max_q: int = 120, max_a: int = 200) -> str:
    """生成 Q&A 的简短 summary（用于快速检索相似问题）。"""
    q = question.strip()[:max_q]
    if len(question.strip()) > max_q:
        q += "..."
    a = answer.strip()[:max_a]
    if len(answer.strip()) > max_a:
        a += "..."
    return f"Q: {q} | A: {a}"


def add_entry(
    session_id: str = DEFAULT_SESSION_ID,
    question: str = "",
    answer: str = "",
    topic_name: Optional[str] = None,
) -> Optional[str]:
    """
    添加一条 Q&A 记录到指定 session。
    返回 entry 的 id，失败返回 None。
    """
    if not question or not answer:
        return None
    data = _load()
    sessions = data.setdefault("sessions", {})
    sess = sessions.setdefault(
        session_id,
        {
            "topic": topic_name or f"Session {session_id}",
            "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "entries": [],
        },
    )
    entry_id = uuid.uuid4().hex
    summary = _make_summary(question, answer)
    entry = {
        "id": entry_id,
        "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "question": question,
        "answer": answer,
        "summary": summary,
    }
    sess.setdefault("entries", []).append(entry)
    _save(data)
    return entry_id


def get_all_summaries_for_lookup() -> List[Dict[str, Any]]:
    """
    返回所有条目的摘要，供 agent 判断新问题是否与过往类似。
    结构: [{"id", "question", "answer", "summary", "session_id"}, ...]
    """
    data = _load()
    sessions = data.get("sessions", {})
    out: List[Dict[str, Any]] = []
    for sid, sess in sessions.items():
        for entry in sess.get("entries", []):
            out.append({
                "id": entry.get("id"),
                "question": entry.get("question", ""),
                "answer": entry.get("answer", ""),
                "summary": entry.get("summary", ""),
                "session_id": sid,
            })
    return out


def get_answer_by_id(entry_id: str) -> Optional[str]:
    """按 id 获取完整 answer。找不到返回 None。"""
    data = _load()
    for sess in data.get("sessions", {}).values():
        for entry in sess.get("entries", []):
            if entry.get("id") == entry_id:
                return entry.get("answer")
    return None


def get_sessions() -> List[Dict[str, Any]]:
    """返回所有 sessions 的概要（不含完整 entries）。"""
    data = _load()
    out = []
    for sid, sess in data.get("sessions", {}).items():
        entries = sess.get("entries", [])
        out.append({
            "session_id": sid,
            "topic": sess.get("topic", sid),
            "created_at": sess.get("created_at", ""),
            "entry_count": len(entries),
        })
    return out
