"""Shared tutor agent callable for eval simulation and HTTP routes."""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any, Literal, Optional

from deps import create_chat_completion
import learning_resources as lr

MemoryMode = Literal["none", "read_only", "isolated_write"]


@dataclass
class TutorContext:
    textbook_id: str = "focs"
    section_hint: Optional[str] = None
    skip_topic_matching: bool = True
    inject_grades: bool = False
    inject_student_bar: bool = False
    memory_mode: MemoryMode = "none"
    temperature: float = 0.3


@dataclass
class ChatTurn:
    role: str
    content: str


def _book_label(textbook_id: str) -> str:
    if textbook_id == "focs":
        return "FOCS (Mathematics for Computer Science)"
    return "the textbook the student selected"


def _section_page_context(textbook_id: str, section_hint: str) -> tuple[str, Optional[dict[str, Any]]]:
    section_info = lr.get_section_start_end_name(section_hint)
    if not section_info:
        return "", None
    start_book, end_book, section_name = section_info
    start_pdf = start_book + lr.effective_pdf_page_offset()
    end_pdf = end_book + lr.effective_pdf_page_offset()
    ctx = ""
    _pdf = lr.get_effective_pdf_bytes()
    if _pdf:
        page_text = lr.extract_pdf_pages_text(_pdf, start_pdf, end_pdf)
        if page_text:
            ctx = (
                f"\n\n--- Textbook reference ({section_name}, PDF pp. {start_pdf}-{end_pdf}) ---\n"
                f"{page_text[:12000]}\n--- End ---"
            )
    matched = {
        "name": section_name,
        "start_book": start_book,
        "end_book": end_book,
        "start_pdf": start_pdf,
        "end_pdf": end_pdf,
    }
    return ctx, matched


def build_tutor_messages(
    turns: list[ChatTurn],
    context: TutorContext,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    metadata: dict[str, Any] = {
        "skip_topic_matching": context.skip_topic_matching,
        "inject_grades": context.inject_grades,
        "inject_student_bar": context.inject_student_bar,
        "memory_mode": context.memory_mode,
    }

    system_content = (
        f"You are an AI math tutor for {_book_label(context.textbook_id)}. "
        "Answer the student's question directly with a clear explanation and a short example when helpful. "
        "Never ask intake questions, never list optional sections, and never ask them to pick a chapter."
    )

    matched_topic: Optional[dict[str, Any]] = None
    if context.section_hint:
        page_ctx, matched_topic = _section_page_context(context.textbook_id, context.section_hint)
        if page_ctx:
            system_content += page_ctx
        metadata["section_hint"] = context.section_hint

    if not context.skip_topic_matching and turns:
        last_user = next((t.content for t in reversed(turns) if t.role == "user"), "")
        if last_user:
            try:
                matched = lr.match_topic_with_llm(last_user)
            except Exception as exc:
                matched = None
                metadata["topic_match_error"] = str(exc)
            if matched:
                matched_topic = {
                    "name": matched.get("name"),
                    "start_book": matched.get("start"),
                    "end_book": matched.get("end"),
                }
                _pdf = lr.get_effective_pdf_bytes()
                if _pdf:
                    s = matched["start"] + lr.effective_pdf_page_offset()
                    e = matched["end"] + lr.effective_pdf_page_offset()
                    mt_ctx = lr.extract_pdf_pages_text(_pdf, s, e)
                    if mt_ctx:
                        system_content += (
                            f"\n\n--- Reference from textbook ({matched.get('name')}, PDF pp. {s}-{e}) ---\n"
                            f"{mt_ctx[:12000]}\n--- End ---"
                        )

    messages: list[dict[str, Any]] = [{"role": "system", "content": system_content}]
    for turn in turns:
        role = turn.role if turn.role in {"system", "user", "assistant"} else "user"
        if role == "system":
            continue
        messages.append({"role": role, "content": turn.content})

    metadata["matched_topic"] = matched_topic
    return messages, metadata


def call_tutor_agent(
    turns: list[ChatTurn],
    context: Optional[TutorContext] = None,
) -> tuple[str, dict[str, Any]]:
    """Call the eval tutor agent and return (reply, metadata)."""
    ctx = context or TutorContext()
    tid = (ctx.textbook_id or "focs").strip() or "focs"
    with lr.request_book(tid, None):
        messages, meta = build_tutor_messages(turns, ctx)
        started = time.perf_counter()
        resp = create_chat_completion(
            model="gpt-5.2",
            messages=messages,
            temperature=ctx.temperature,
        )
        reply = (resp.choices[0].message.content or "").strip()
        meta["latency_ms"] = int((time.perf_counter() - started) * 1000)
        meta["tool_calls"] = []
        meta["memory_events_used"] = 0
        return reply, meta
