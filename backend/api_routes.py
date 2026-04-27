"""FastAPI routes split out from main.py to keep main minimal."""

import base64
import json
import os
import re
import shutil
import tempfile
from typing import Any, Dict, List, Optional

import fitz  # PyMuPDF
from fastapi import APIRouter, File, Form, Header, HTTPException, Query, UploadFile
from pydantic import BaseModel

from deps import clamp_int_0_100, create_chat_completion
import learning_resources as lr
import student_bar_store as sbs
import user_textbook_store as uts
from bson import ObjectId
from datetime import datetime, timezone
from AutoGrader.public_api import AutoGraderGradeRequest, grade_paper_once

from auth import verify_token
import database

try:
    from memory import open_memory, Status
    _MEMORY_AVAILABLE = True
except ImportError:
    _MEMORY_AVAILABLE = False

MEMORY_ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "memory")
FOCS_BOOK_ID = "focs"  # legacy constant; chat uses lr.effective_memory_book_id()


router = APIRouter()

# 与本 subtopic 相关的 memory：summary 进 prompt；完整 events 通过 tool 按需拉取
MAX_SUMMARY_IN_PROMPT_CHARS = 12000
MAX_EVENTS_TOOL_CHARS = 120000
TUTOR_TOOL_ROUNDS_MAX = 8

MEMORY_TOOL_DEFS: List[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "get_subtopic_memory_full",
            "description": (
                "Load the complete past Q&A transcript (full event log) for the current textbook subtopic. "
                "Call this when the summary lines in the system prompt are not enough, or when the student "
                "refers to something from a previous session and you need exact prior wording."
            ),
            "parameters": {"type": "object", "properties": {}, "additionalProperties": False},
        },
    }
]


def _format_summary_records_for_prompt(records: List[dict[str, Any]]) -> str:
    if not records:
        return ""
    lines: List[str] = []
    for i, rec in enumerate(records, start=1):
        c = (rec.get("content") or "").strip()
        if not c:
            continue
        ts = rec.get("ts") or ""
        lines.append(f"[{i}] ({ts}) {c}")
    text = "\n".join(lines)
    if len(text) > MAX_SUMMARY_IN_PROMPT_CHARS:
        text = text[: MAX_SUMMARY_IN_PROMPT_CHARS] + "\n...[truncated]"
    return text


def _format_events_for_tool(events: List[dict[str, Any]]) -> str:
    if not events:
        return "（暂无完整问答记录）"
    parts: List[str] = []
    for i, ev in enumerate(events, start=1):
        c = (ev.get("content") or "").strip()
        if not c:
            continue
        parts.append(f"--- 第 {i} 轮 ({ev.get('ts', '')}) ---\n{c}")
    return "\n\n".join(parts)


def run_tutor_with_optional_memory_tool(
    messages: List[dict[str, Any]],
    *,
    memory_addr: Optional[str],
    mem: Any,
    enable_memory_tool: bool,
) -> str:
    """
    若 enable_memory_tool 且 mem/addr 有效，则注册 get_subtopic_memory_full，
    模型可多次调用以读取该 subtopic 下 events.jsonl 的完整历史（有长度上限）。
    """
    for _ in range(TUTOR_TOOL_ROUNDS_MAX):
        kwargs: dict[str, Any] = {
            "model": "gpt-5.2",
            "messages": messages,
        }
        if enable_memory_tool and mem is not None and memory_addr:
            kwargs["tools"] = MEMORY_TOOL_DEFS
            kwargs["tool_choice"] = "auto"
            kwargs["parallel_tool_calls"] = False
        resp = create_chat_completion(**kwargs)
        msg = resp.choices[0].message
        tool_calls = getattr(msg, "tool_calls", None)
        if tool_calls:
            messages.append(
                {
                    "role": "assistant",
                    "content": msg.content or None,
                    "tool_calls": [
                        {
                            "id": tc.id,
                            "type": "function",
                            "function": {
                                "name": tc.function.name,
                                "arguments": tc.function.arguments or "{}",
                            },
                        }
                        for tc in tool_calls
                    ],
                }
            )
            for tc in tool_calls:
                fn = tc.function.name
                tid = tc.id
                if fn == "get_subtopic_memory_full" and mem is not None and memory_addr:
                    st_ev, ev_recs = mem.read(memory_addr)
                    # Status.OK == 1（避免 memory 未安装时 NameError）
                    full_text = _format_events_for_tool(ev_recs if st_ev == 1 else [])
                    if len(full_text) > MAX_EVENTS_TOOL_CHARS:
                        full_text = full_text[:MAX_EVENTS_TOOL_CHARS] + "\n\n...[truncated]"
                else:
                    full_text = "（工具不可用）"
                messages.append({"role": "tool", "tool_call_id": tid, "content": full_text})
            continue
        return msg.content or ""
    return ""


class ChatMessage(BaseModel):
    message: str
    history: List[dict] = []  # [{sender:"user"/"ai", text:"..."}]
    images_b64: Optional[List[str]] = None  # 当前轮用户附带的图片（base64，无 data URL 前缀）
    pdf_b64: Optional[str] = None  # 单份 PDF（可带 data:application/pdf;base64, 前缀）；服务端渲染前若干页为图
    student_id: Optional[str] = None
    session_id: Optional[str] = None
    textbook_id: Optional[str] = None  # "focs" 或 "user_<id>"（后者需登录且为本人教材）
    silent: bool = False  # 不写会话/Memory/进度条；用于仅拉书页的降级请求


# 教材整本 PDF 上限（聊天附件与 /api/user_textbooks/from_pdf 共用）；可用环境变量 MAX_USER_PDF_MB（1–512，默认 100）
def _max_user_pdf_mb() -> int:
    raw = os.getenv("MAX_USER_PDF_MB", "100").strip()
    try:
        v = int(raw)
    except ValueError:
        return 100
    v = max(1, min(v, 512))
    # 忽略误配的旧上限（如 14）；低于 25 一律按默认 100MB，避免线上仍显示「max 14 MB」
    if v < 25:
        return 100
    return v


MAX_USER_PDF_MB = _max_user_pdf_mb()
MAX_USER_PDF_BYTES = MAX_USER_PDF_MB * 1024 * 1024
MAX_USER_PDF_PAGES_RENDER = 8
# Learning Mode: sidebar outline → PDF preview (max pages per request)
MAX_TEXTBOOK_PREVIEW_PAGES = 72


def _strip_base64_payload(s: str) -> str:
    t = (s or "").strip()
    if "base64," in t:
        return t.split("base64,", 1)[1]
    return t


def _should_compute_confidence(
    user_message: str,
    tutor_answer: str,
    *,
    section_hint: Optional[str],
    has_prior_user_messages: bool,
) -> bool:
    """Only show confidence for concrete problem-solving Q&A."""
    if not user_message or not user_message.strip():
        return False
    if not has_prior_user_messages:
        # 首轮通常是 intake / 选章导航，不显示 confidence
        return False

    msg = user_message.strip().lower()
    ans = (tutor_answer or "").lower()

    # 纯章节/小节选择，不是解题
    if re.fullmatch(r"(?:chapter|ch\.?|section|sec\.?|topic)?\s*\d+(?:\.\d+)*", msg):
        return False

    # 计划/选题/导航型提问：不显示 confidence
    meta_keywords = [
        "topic",
        "chapter",
        "section",
        "plan",
        "roadmap",
        "curriculum",
        "review plan",
        "study plan",
        "which chapter",
        "what to learn",
        "学到",
        "章节",
        "小节",
        "计划",
        "复习",
        "新内容",
        "topic tree",
        "tree structure",
    ]
    if any(k in msg for k in meta_keywords):
        return False

    # Tutor reply is organizing tasks / navigation instead of solving
    answer_meta_signals = [
        "study plan",
        "task 1",
        "task 2",
        "pick one section",
        "quick summary of the whole topic",
        "which section",
    ]
    if any(k in ans for k in answer_meta_signals):
        return False

    # 用户明确给了 section hint 且消息很短，通常是选章节
    if section_hint and len(msg) <= 24:
        return False

    return True


def _is_simple_definition_question(message: str) -> bool:
    """
    Heuristic: short definitional questions should get a one-sentence textbook-style answer.

    Examples:
    - "what is induction", "wat is induction", "define induction", "definition of induction"
    - "induction 是什么", "归纳法是什么", "给出…的定义"
    """
    if not message or not isinstance(message, str):
        return False
    s = message.strip()
    if not s:
        return False
    # Too long usually implies a real problem / multi-part request.
    if len(s) > 120:
        return False

    low = s.lower()

    # Avoid triggering on tasks that clearly ask for proofs/solutions/examples.
    non_simple_signals = [
        "prove",
        "show that",
        "derive",
        "calculate",
        "solve",
        "evaluate",
        "compute",
        "example",
        "examples",
        "exercise",
        "problem",
        "homework",
        "证明",
        "推导",
        "计算",
        "求解",
        "例",
        "举例",
        "习题",
        "题",
    ]
    if any(k in low for k in non_simple_signals):
        return False

    # Common definitional patterns (English + Chinese). Keep broad but safe.
    definitional_patterns = [
        r"^\s*what\s+is\s+.+\??\s*$",
        r"^\s*wat\s+is\s+.+\??\s*$",
        r"^\s*define\s+.+\??\s*$",
        r"^\s*definition\s+of\s+.+\??\s*$",
        r"^\s*meaning\s+of\s+.+\??\s*$",
        r".+\s*(?:is\s+what)\s*\??\s*$",
        r".+\s*是什么\s*\??\s*$",
        r".+\s*的定义\s*(?:是|是什么)?\s*\??\s*$",
        r"^\s*定义\s*.+\s*$",
        r".+\s*含义\s*(?:是|是什么)?\s*\??\s*$",
        r".+\s*什么意思\s*\??\s*$",
        r".+\s*指什么\s*\??\s*$",
    ]
    if any(re.search(p, low, flags=re.IGNORECASE) for p in definitional_patterns):
        return True

    # Very short noun-phrase queries like "induction?" or "归纳法？" are often definitions.
    compact = re.sub(r"[\s\?\!\.\,\;\:\(\)\[\]\{\}\"\']", "", low)
    if 1 <= len(compact) <= 18 and re.fullmatch(r"[a-z0-9_\-\u4e00-\u9fff]+", compact):
        return True

    return False


@router.post("/api/chat")
async def chat(chat_message: ChatMessage, authorization: Optional[str] = Header(None)):
    print("[Chat] request received", flush=True)
    has_prior_user_messages = any((m.get("sender") == "user") for m in (chat_message.history or []))
    student_id = chat_message.student_id or "default_student"
    user_email = verify_token(authorization)

    combined_images: List[str] = list(chat_message.images_b64 or [])
    if chat_message.pdf_b64:
        try:
            raw = _strip_base64_payload(chat_message.pdf_b64)
            pdf_bytes = base64.b64decode(raw, validate=False)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid PDF (base64).")
        if len(pdf_bytes) > MAX_USER_PDF_BYTES:
            raise HTTPException(
                status_code=400,
                detail=f"PDF too large (max {MAX_USER_PDF_MB} MB).",
            )
        try:
            pdf_pages = lr.render_user_pdf_first_pages_to_base64(
                pdf_bytes, max_pages=MAX_USER_PDF_PAGES_RENDER
            )
        except Exception as e:
            print(f"[Chat] user PDF render failed: {e}", flush=True)
            raise HTTPException(status_code=400, detail="Could not open or render PDF.")
        if not pdf_pages:
            raise HTTPException(status_code=400, detail="PDF has no pages to render.")
        combined_images.extend(pdf_pages)
    tid = (chat_message.textbook_id or "focs").strip() or "focs"
    if not user_email and tid.startswith("user_"):
        tid = "focs"
    with lr.request_book(tid, user_email):

        # 0) LLM 匹配 topic → 从 data 书本提取对应页
        page_context = ""
        matched_topic: Optional[dict[str, Any]] = None
        try:
            matched_topic = lr.match_topic_with_llm(chat_message.message)
            if matched_topic:
                pdf_bytes = lr.get_effective_pdf_bytes()
                if pdf_bytes:
                    page_context = lr.extract_pdf_pages_text(
                        pdf_bytes,
                        matched_topic["start"] + lr.effective_pdf_page_offset(),
                        matched_topic["end"] + lr.effective_pdf_page_offset(),
                    )
        except Exception as e:
            print(f"[Learning] topic match/page extract failed: {e}")

        _book_label = (
            "FOCS (Mathematics for Computer Science)"
            if tid == "focs"
            else "the textbook the student selected (outline + PDF pages)"
        )
        is_simple_def = _is_simple_definition_question(chat_message.message)
        system_content = (
            f"You are an AI math tutor for {_book_label}. Explain clearly and step-by-step, and always ground guidance in the textbook tree/reference below. "
            "Before giving teaching content, first complete a short study intake and learning-plan design with the student. "
            "Use concise bullet points and keep each turn focused on one clear next action."
        )
        if is_simple_def:
            # Hard override: keep answers extremely short and avoid 'plan/intake' patterns.
            system_content = (
                f"You are an AI math tutor for {_book_label}. "
                "The student asked a SIMPLE definition/meaning question. "
                "Answer in EXACTLY ONE sentence, textbook-style, grounded in the textbook reference when available. "
                "Do NOT include bullet points, steps, study plans, examples, or follow-up questions. "
                "Return ONE sentence only."
            )

        if not has_prior_user_messages and not is_simple_def:
            system_content += (
                "\n\nThis is the beginning of a new learning session. In this first tutor reply, ask the student these three required intake questions in one place:\n"
                "1) Are they learning a NEW topic or REVIEWING for exam/quiz?\n"
                "2) Where are they now (chapter/section already learned)?\n"
                "3) Which chapter(s)/section(s) do they want to study now?\n"
                "Do not teach yet in this first reply; only collect the above info.\n"
                "\nAfter intake is answered, design a task list and execute tasks one by one in chat.\n"
                "Use exactly this style:\n"
                "- Study Plan (Task 1..N)\n"
                "- Current Task (only one task in progress)\n"
                "- Checkpoint question before moving to next task\n"
                "\nTask template for NEW topic:\n"
                "Task 1: Big picture of the selected topic/section\n"
                "Task 2: Core formulas/definitions/proof templates\n"
                "Task 3: Guided worked example\n"
                "Task 4: Student practice with hints and feedback\n"
                "\nTask template for REVIEW:\n"
                "Task 1: Pick representative original-style textbook problems\n"
                "Task 2: Ask what the student cannot solve\n"
                "Task 3: Retrieve related formulas/definitions/proof templates\n"
                "Task 4: Targeted gap-filling drills and recap\n"
                "\nAlways map chapters/sections to the textbook tree names exactly. If student wording is vague, propose 2-4 closest options from the tree and ask them to choose."
            )
        # Hidden per-student progress bar from tree structure (skip for one-sentence definition replies).
        if not chat_message.silent and not is_simple_def:
            try:
                if user_email:
                    bar = sbs.load_bar_mongo(user_email, tid)
                    bar = sbs.update_bar_from_message_on_bar(bar, chat_message.message, tid, user_email)
                    bar["textbook_id"] = tid
                    sbs.save_bar_mongo(user_email, bar, tid)
                else:
                    bar = sbs.update_bar_from_message(student_id, chat_message.message, tid)
                system_content += sbs.build_bar_prompt(bar, user_email)
            except Exception as e:
                print(f"[StudentBar] update failed: {e}")
        section_hint = lr.extract_section_from_message(chat_message.message)
        section_info = lr.get_section_start_end_name(section_hint) if section_hint else None
        is_subsection_request = bool(section_hint and "." in section_hint and section_info)

        if is_subsection_request and not is_simple_def:
            start_book, end_book, section_name = section_info
            start_pdf = start_book + lr.effective_pdf_page_offset()
            end_pdf = end_book + lr.effective_pdf_page_offset()
            system_content += (
                f"\n\nThe student has already chosen section: {section_name}. "
                "Do NOT show the section list or ask them to pick again. Use the reference below to walk them through this section's key formulas and definitions."
            )
            _pdf = lr.get_effective_pdf_bytes()
            if _pdf:
                page_context = lr.extract_pdf_pages_text(_pdf, start_pdf, end_pdf)
                if page_context:
                    system_content += (
                        f"\n\n--- Reference from textbook ({section_name}, PDF pp. {start_pdf}-{end_pdf}) ---\n"
                        f"{page_context[:12000]}\n"
                        "--- End of reference ---\n\n"
                        "Use the above to explain this section. Point to the right-hand pages when relevant."
                    )
        elif not is_simple_def:
            chapter_for_tree = (section_hint.split(".")[0] if section_hint and "." in section_hint else section_hint) or lr.extract_chapter_from_message(chat_message.message)
            chapter_tree = lr.get_focs_chapter_tree(chapter_filter=chapter_for_tree)
            if chapter_tree:
                if chapter_for_tree:
                    system_content += (
                        "\n\n--- Sections of the chapter they asked for (list only these in your reply) ---\n"
                        + chapter_tree
                        + "\n--- End ---\n"
                        "In your reply: list ONLY the sections above, then ask exactly one of two options (no goals like 'understand the idea' or 'practice problems'): "
                        "either pick one section to dive into, OR get a quick summary of the whole topic first and then pick what they don't understand."
                    )
                else:
                    system_content += (
                        "\n\n--- Textbook chapter tree ---\n"
                        + chapter_tree
                        + "\n--- End of chapter tree ---\n"
                        "In your reply: list the sections above, then ask either pick one section, OR get a quick summary of the whole topic first and then pick what they don't understand. Do NOT ask about goals (understand the idea, proof template, practice problems)."
                    )
        if page_context and matched_topic and not is_subsection_request:
            s = matched_topic["start"] + lr.effective_pdf_page_offset()
            e = matched_topic["end"] + lr.effective_pdf_page_offset()
            system_content += (
                f"\n\n--- Reference from textbook (topic: {matched_topic['name']}, PDF pages {s}-{e}) ---\n"
                f"{page_context[:12000]}\n"
                "--- End of reference ---\n\n"
                "Use the above to walk the student through key formulas, definitions, and proof templates. Point to the right-hand snippets when they appear."
            )

        # 与写入 memory 时相同的 subtopic 地址：优先小节名，否则 LLM 匹配的 topic 名
        memory_addr: Optional[str] = None
        if section_hint and section_info:
            memory_addr = lr.topic_name_to_memory_address(section_info[2])
        elif matched_topic:
            memory_addr = lr.topic_name_to_memory_address(matched_topic["name"])

        mem: Any = None
        enable_memory_tool = False
        if _MEMORY_AVAILABLE and memory_addr and not is_simple_def:
            try:
                mem = open_memory(MEMORY_ROOT, lr.effective_memory_book_id())
                st_sum, sum_recs = mem.read(f"{memory_addr}/__summary__")
                st_ev, ev_recs = mem.read(memory_addr)
                has_summaries = st_sum == Status.OK and bool(sum_recs)
                has_events = st_ev == Status.OK and len(ev_recs) > 0
                if has_summaries:
                    summary_block = _format_summary_records_for_prompt(sum_recs)
                    system_content += (
                        "\n\n--- Past sessions on this subtopic (summary log; compressed Q&A lines) ---\n"
                        f"{summary_block}\n"
                        "--- End summary ---\n"
                    )
                if has_events:
                    system_content += (
                        "\nFull verbatim Q&A for this subtopic is available. "
                        "If the summary is not enough (e.g. the student refers to a prior explanation), "
                        "call the tool `get_subtopic_memory_full` to load the complete event history."
                    )
                    enable_memory_tool = True
            except Exception as e:
                print(f"[Memory] read for prompt failed ({memory_addr}): {e}")

        if chat_message.pdf_b64 and not is_simple_def:
            system_content += (
                "\n\nThe student attached a PDF file. Their message may include up to "
                f"{MAX_USER_PDF_PAGES_RENDER} rendered page images from that PDF in order, after any separate photos."
            )

        # 1) Tutor answer（当前轮可带图片，走 vision）
        messages: List[dict[str, Any]] = [{"role": "system", "content": system_content}]
        # For simple definition questions, ignore prior history to prevent long plan/intake outputs.
        if not is_simple_def:
            for msg in chat_message.history:
                role = "assistant" if msg["sender"] == "ai" else "user"
                messages.append({"role": role, "content": msg["text"]})
        # 最后一条 user：无图则纯文本，有图则 content 为多 part（text + image_url）
        if not combined_images:
            messages.append({"role": "user", "content": chat_message.message})
        else:
            parts: List[dict[str, Any]] = [{"type": "text", "text": chat_message.message or "(attachments)"}]
            for b64 in combined_images:
                url = f"data:image/png;base64,{b64}" if not b64.startswith("data:") else b64
                parts.append({"type": "image_url", "image_url": {"url": url}})
            messages.append({"role": "user", "content": parts})

        answer = run_tutor_with_optional_memory_tool(
            messages,
            memory_addr=memory_addr,
            mem=mem,
            enable_memory_tool=enable_memory_tool,
        )

        result: dict[str, Any] = {"reply": answer}
        if _should_compute_confidence(
            chat_message.message,
            answer,
            section_hint=section_hint,
            has_prior_user_messages=has_prior_user_messages,
        ):
            # 2) Evaluator confidence (0-100)
            eval_messages = [
                {
                    "role": "system",
                    "content": (
                        "You are a strict evaluator for a math tutor. "
                        "Score the reliability of the tutor's answer for a student. "
                        "Return ONLY one integer from 0 to 100. No other words."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"Student question:\n{chat_message.message}\n\nTutor answer:\n{answer}\n\n"
                        "Give confidence score 0-100:"
                    ),
                },
            ]

            eval_resp = create_chat_completion(
                model="gpt-5.2",
                messages=eval_messages,
                temperature=0.0,
            )
            raw_score = eval_resp.choices[0].message.content
            result["confidence"] = clamp_int_0_100(raw_score)

        # 若用户问的是某一章或小节（chapter 5 / 5.1 / 5.1.1），左侧显示该章/节全部页并可翻页，不跑 snippet 检索
        if section_hint:
            section_info = lr.get_section_start_end_name(section_hint)
            if section_info:
                start_book, end_book, name = section_info
                start_pdf = start_book + lr.effective_pdf_page_offset()
                end_pdf = end_book + lr.effective_pdf_page_offset()
                result["matched_topic"] = {"name": name, "start": start_pdf, "end": end_pdf}
                _pdf = lr.get_effective_pdf_bytes()
                if _pdf:
                    pages_b64 = lr.render_pdf_page_range_to_base64(_pdf, start_pdf, end_pdf)
                    if pages_b64:
                        result["reference_section_pages_b64"] = pages_b64
                if _MEMORY_AVAILABLE and not chat_message.silent:
                    try:
                        if mem is None:
                            mem = open_memory(MEMORY_ROOT, lr.effective_memory_book_id())
                        addr = lr.topic_name_to_memory_address(name)
                        event_content = f"Q: {chat_message.message}\nA: {answer}"
                        if mem.write(addr, event_content) == Status.OK:
                            summary_line = (
                                f"Q: {chat_message.message[:100]}{'...' if len(chat_message.message) > 100 else ''} | "
                                f"A: {answer[:200]}{'...' if len(answer) > 200 else ''}"
                            )
                            mem.write(f"{addr}/__summary__", summary_line)
                    except Exception as e:
                        print(f"[Memory] write failed for topic {name}: {e}")
        elif matched_topic:
            start_pdf = matched_topic["start"] + lr.effective_pdf_page_offset()
            end_pdf = matched_topic["end"] + lr.effective_pdf_page_offset()
            result["matched_topic"] = {
                "name": matched_topic["name"],
                "start": start_pdf,
                "end": end_pdf,
            }
            # 与显式 chapter/section 一致：展示该 topic 在目录中的整段书页（可翻页），避免仅在首页做
            # snippet 裁剪导致「问 Induction 却像随机切块」的观感。
            _pdf = lr.get_effective_pdf_bytes()
            if _pdf:
                pages_b64 = lr.render_pdf_page_range_to_base64(_pdf, start_pdf, end_pdf)
                if pages_b64:
                    result["reference_section_pages_b64"] = pages_b64

            # 按 FOCS topic 写入 memory：事件（完整 Q&A，带时间）+ summary 流
            if _MEMORY_AVAILABLE and matched_topic and not chat_message.silent:
                try:
                    if mem is None:
                        mem = open_memory(MEMORY_ROOT, lr.effective_memory_book_id())
                    addr = lr.topic_name_to_memory_address(matched_topic["name"])
                    event_content = f"Q: {chat_message.message}\nA: {answer}"
                    if mem.write(addr, event_content) == Status.OK:
                        summary_line = (
                            f"Q: {chat_message.message[:100]}{'...' if len(chat_message.message) > 100 else ''} | "
                            f"A: {answer[:200]}{'...' if len(answer) > 200 else ''}"
                        )
                        mem.write(f"{addr}/__summary__", summary_line)
                except Exception as e:
                    print(f"[Memory] write failed for topic {matched_topic.get('name')}: {e}")
        # Save to MongoDB if user is authenticated
        if user_email and not chat_message.silent:
            col = database.chat_sessions()
            if col is not None:
                now = datetime.now(timezone.utc).isoformat()
                new_msg_pair = [
                    {"sender": "user", "text": chat_message.message, "ts": now},
                    {"sender": "ai", "text": answer, "ts": now},
                ]
                if chat_message.session_id:
                    # Append to existing session
                    try:
                        col.update_one(
                            {"_id": ObjectId(chat_message.session_id), "user_email": user_email},
                            {
                                "$push": {"messages": {"$each": new_msg_pair}},
                                "$set": {"updated_at": now},
                            },
                        )
                    except Exception as e:
                        print(f"[DB] session update failed: {e}", flush=True)
                else:
                    # Create new session
                    try:
                        title = chat_message.message[:80]
                        doc = col.insert_one({
                            "user_email": user_email,
                            "title": title,
                            "created_at": now,
                            "updated_at": now,
                            "messages": new_msg_pair,
                        })
                        result["session_id"] = str(doc.inserted_id)
                    except Exception as e:
                        print(f"[DB] session create failed: {e}", flush=True)

        print("[Chat] response sent", flush=True)
        return result


@router.get("/api/focs_tree")
async def focs_tree():
    """FOCS 教材目录树（与 learning_resources.FOCS.json 一致）。"""
    if not os.path.exists(lr.FOCS_JSON_PATH):
        return {}
    with open(lr.FOCS_JSON_PATH, encoding="utf-8") as f:
        return json.load(f)


FOCS_STYLE_OUTLINE_PROMPT_HEAD = """You must return ONLY a valid JSON object. No markdown, no code fences.

The JSON must match this textbook outline shape (same style as FOCS / MCS):
- Top-level keys are chapter or section titles as strings (e.g. "1 Introduction" or "5 Induction: ...").
- Do NOT return a flat "topics" / "chapters" curriculum wrapper — use ONLY nested objects like the example.
- Each node that covers printed book pages is an object with EITHER:
  - "_range": {"start": <int>, "end": <int>} (inclusive printed book page numbers), OR
  - "start": <int>, "end": <int> (same meaning)
- Subsections are nested as more keys inside their parent object.
- Use printed book page numbers for start/end (not PDF file index unless they are the same).

Also at the ROOT of the JSON object, include once:
- "pdf_page_offset": integer such that PDF_page = printed_book_page + pdf_page_offset (if printed page 1 is PDF page 16, pdf_page_offset is 15). If unknown, use 0.

Example fragment:
{
  "pdf_page_offset": 0,
  "1 Introduction": {
    "_range": {"start": 1, "end": 10},
    "1.1 Basics": {"start": 1, "end": 5},
    "1.2 Advanced": {"start": 6, "end": 10}
  }
}

Now build the full tree from the OCR text below.

OCR text:
"""

TEXTBOOK_CLASSIFY_PROMPT = """You classify OCR text taken from the first pages of a PDF.

Answer whether this is primarily a **textbook or standard course book** for teaching/learning: structured chapters or sections, instructional prose, definitions, examples, exercises—meant to be studied over many pages.

Answer **not** a textbook if it is mainly: a single research paper or preprint, a benchmark/score report, an exam paper, worksheets only, slide decks, legal or financial forms, a novel or news article, a CV/resume, a poster, marketing material, or similar non-textbook documents.

OCR excerpt:
---
{snippet}
---

Return ONLY valid JSON on one line: {{"is_textbook": true}} or {{"is_textbook": false}}. No markdown, no code fences, no other text."""


def _ocr_looks_like_textbook(ocr_text: str) -> bool:
    """LLM gate: My Profile only saves uploads that look like real textbooks/course books."""
    snippet = (ocr_text or "").strip()[:8000]
    if len(snippet) < 30:
        return False
    prompt = TEXTBOOK_CLASSIFY_PROMPT.format(snippet=snippet)
    resp = create_chat_completion(
        model="gpt-5.2",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.0,
    )
    raw = (resp.choices[0].message.content or "").strip()
    cleaned = re.sub(r"```(?:json)?\s*|\s*```", "", raw, flags=re.I).strip()
    try:
        obj = json.loads(cleaned)
    except json.JSONDecodeError:
        m = re.search(r'\{\s*"is_textbook"\s*:\s*(true|false)\s*\}', cleaned, re.I)
        if not m:
            return False
        try:
            obj = json.loads(m.group(0))
        except json.JSONDecodeError:
            return False
    val = obj.get("is_textbook")
    if val is True:
        return True
    if val is False:
        return False
    if isinstance(val, str) and val.lower() in ("true", "false"):
        return val.lower() == "true"
    return False


NOT_TEXTBOOK_UPLOAD_DETAIL = (
    "This PDF does not look like a textbook or standard course book. "
    "My Profile only accepts textbook-style PDFs for Learning Mode. "
    "Use Auto Grader for other document types."
)


@router.get("/api/user_textbooks")
async def list_my_textbooks(authorization: Optional[str] = Header(None)):
    email = verify_token(authorization)
    if not email:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return {
        "textbooks": [{"id": "focs", "label": "FCOS (built-in)"}]
        + uts.list_user_textbooks(email),
    }


@router.get("/api/user_textbooks/{book_id}/tree")
async def get_user_textbook_tree(book_id: str, authorization: Optional[str] = Header(None)):
    email = verify_token(authorization)
    if not email:
        raise HTTPException(status_code=401, detail="Not authenticated")
    if book_id == "focs":
        if not os.path.exists(lr.FOCS_JSON_PATH):
            return {}
        with open(lr.FOCS_JSON_PATH, encoding="utf-8") as f:
            return json.load(f)
    if not uts.is_valid_user_book_id(book_id) or not uts.user_owns_book(email, book_id):
        raise HTTPException(status_code=404, detail="Textbook not found")
    outline = uts.load_outline(email, book_id)
    return outline if isinstance(outline, dict) else {}


@router.get("/api/textbook_pages")
async def render_textbook_pages(
    textbook_id: str = Query("focs"),
    start_book: int = Query(..., ge=1, le=10000),
    end_book: int = Query(..., ge=1, le=10000),
    section_title: str = Query(""),
    authorization: Optional[str] = Header(None),
):
    """
    Render PDF page images for an outline book-page range (printed page numbers in the tree).
    Same offset rules as chat; used when the student clicks a section in the learning progress tree.
    """
    user_email = verify_token(authorization)
    tid = (textbook_id or "focs").strip() or "focs"
    if tid.startswith("user_"):
        if not user_email:
            raise HTTPException(status_code=401, detail="Not authenticated")
        if not uts.is_valid_user_book_id(tid) or not uts.user_owns_book(user_email, tid):
            raise HTTPException(status_code=404, detail="Textbook not found")
    else:
        tid = "focs"

    sb = min(start_book, end_book)
    eb = max(start_book, end_book)
    name = (section_title or "").strip()[:600] or "Section"

    with lr.request_book(tid, user_email):
        pdf = lr.get_effective_pdf_bytes()
        off = lr.effective_pdf_page_offset()
        start_pdf = sb + off
        end_pdf = eb + off
        if not pdf:
            return {"pages_b64": [], "matched_topic": {"name": name, "start": start_pdf, "end": end_pdf}}

        try:
            doc = fitz.open(stream=pdf, filetype="pdf")
            doc_len = len(doc)
            doc.close()
        except Exception:
            return {"pages_b64": [], "matched_topic": {"name": name, "start": start_pdf, "end": end_pdf}}

        start_pdf = max(1, min(start_pdf, doc_len))
        end_pdf = max(start_pdf, min(end_pdf, doc_len))
        if end_pdf - start_pdf + 1 > MAX_TEXTBOOK_PREVIEW_PAGES:
            end_pdf = start_pdf + MAX_TEXTBOOK_PREVIEW_PAGES - 1

        pages_b64 = lr.render_pdf_page_range_to_base64(pdf, start_pdf, end_pdf)
        return {
            "pages_b64": pages_b64,
            "matched_topic": {"name": name, "start": start_pdf, "end": end_pdf},
        }


def _delete_user_textbook_core(email: str, book_id: str) -> Dict[str, Any]:
    """Delete uploaded book + learning bars. Raises HTTPException."""
    if book_id == "focs" or not uts.is_valid_user_book_id(book_id):
        raise HTTPException(status_code=400, detail="Cannot delete this textbook.")
    if not uts.user_owns_book(email, book_id):
        raise HTTPException(status_code=404, detail="Textbook not found")
    if not uts.delete_user_textbook(email, book_id):
        raise HTTPException(status_code=404, detail="Textbook not found")
    col = database.learning_bars()
    if col is not None:
        try:
            col.delete_one({"user_email": email, "subject": book_id})
        except Exception as e:
            print(f"[user_textbooks] Mongo learning_bars delete failed: {e}", flush=True)
    try:
        sbs.delete_all_file_bars_for_textbook(book_id)
    except Exception as e:
        print(f"[user_textbooks] file bar cleanup failed: {e}", flush=True)
    return {"ok": True, "id": book_id}


@router.delete("/api/user_textbooks/{book_id}")
async def delete_my_user_textbook(book_id: str, authorization: Optional[str] = Header(None)):
    """Permanently delete an uploaded textbook (not FCOS). Also drops learning-bar data for that book."""
    email = verify_token(authorization)
    if not email:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return _delete_user_textbook_core(email, book_id)


@router.post("/api/user_textbooks/{book_id}/delete")
async def delete_my_user_textbook_post(book_id: str, authorization: Optional[str] = Header(None)):
    """Same as DELETE /api/user_textbooks/{book_id}; POST for proxies that block DELETE."""
    email = verify_token(authorization)
    if not email:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return _delete_user_textbook_core(email, book_id)


@router.post("/api/user_textbooks/from_pdf")
async def create_user_textbook_from_pdf(
    authorization: Optional[str] = Header(None),
    file: UploadFile = File(...),
    label: str = Form("My textbook"),
    pdf_page_offset: int = Form(0),
):
    email = verify_token(authorization)
    if not email:
        raise HTTPException(status_code=401, detail="Not authenticated")
    pdf_bytes = await file.read()
    if len(pdf_bytes) > MAX_USER_PDF_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"PDF too large (max {MAX_USER_PDF_MB} MB).",
        )

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    pages_b64: List[str] = []
    try:
        for page in doc[:10]:
            pix = page.get_pixmap(dpi=120)
            img_bytes = pix.tobytes("png")
            b64 = base64.b64encode(img_bytes).decode("utf-8")
            pages_b64.append(b64)
    finally:
        doc.close()

    ocr_text = ""
    for b64_img in pages_b64:
        ocr_resp = create_chat_completion(
            model="gpt-5.2",
            messages=[
                {
                    "role": "system",
                    "content": "Extract clean textbook text for table-of-contents analysis.",
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/png;base64,{b64_img}"},
                        }
                    ],
                },
            ],
        )
        ocr_text += (ocr_resp.choices[0].message.content or "") + "\n"

    if len(ocr_text.strip()) < 20:
        raise HTTPException(status_code=400, detail="OCR failed. Try another file.")

    if not _ocr_looks_like_textbook(ocr_text):
        raise HTTPException(status_code=400, detail=NOT_TEXTBOOK_UPLOAD_DETAIL)

    tree_prompt = FOCS_STYLE_OUTLINE_PROMPT_HEAD + ocr_text[:12000]
    tree_resp = create_chat_completion(
        model="gpt-5.2",
        messages=[{"role": "user", "content": tree_prompt}],
        temperature=0.0,
    )
    raw = tree_resp.choices[0].message.content or ""
    cleaned = re.sub(r"```(json)?|```", "", raw).strip()
    cleaned = cleaned.replace("\\n", "\n")
    try:
        loaded = json.loads(cleaned)
    except Exception as e:
        print("[user_textbooks] JSON parse failed:", e, flush=True)
        raise HTTPException(status_code=422, detail="Model did not return valid JSON outline.")

    if not isinstance(loaded, dict):
        raise HTTPException(status_code=422, detail="Outline must be a JSON object.")

    root_offset = loaded.pop("pdf_page_offset", pdf_page_offset)
    try:
        root_offset = int(root_offset)
    except (TypeError, ValueError):
        root_offset = int(pdf_page_offset)

    book_id = uts.new_book_id()
    uts.save_user_textbook(
        email,
        book_id,
        loaded,
        pdf_bytes,
        label=(label or "").strip() or book_id,
        pdf_page_offset=root_offset,
    )
    return {
        "id": book_id,
        "label": (label or "").strip() or book_id,
        "tree": loaded,
        "pdf_page_offset": root_offset,
    }


class StudentBarUpdate(BaseModel):
    student_id: Optional[str] = None
    learned_sections: List[str]
    textbook_id: Optional[str] = "focs"


@router.get("/api/student_bar")
async def get_student_bar(
    student_id: Optional[str] = Query(None),
    textbook_id: Optional[str] = Query("focs"),
    authorization: Optional[str] = Header(None),
):
    tid = (textbook_id or "focs").strip() or "focs"
    email = verify_token(authorization)
    if email:
        return sbs.load_bar_mongo(email, tid)
    if tid.startswith("user_"):
        tid = "focs"
    sid = student_id or "default_student"
    return sbs.load_bar(sid, tid)


@router.put("/api/student_bar")
async def put_student_bar(body: StudentBarUpdate, authorization: Optional[str] = Header(None)):
    tid = (body.textbook_id or "focs").strip() or "focs"
    email = verify_token(authorization)
    if email:
        bar = sbs.load_bar_mongo(email, tid)
        bar["learned_sections"] = sbs.sort_learned_section_list(list(set(body.learned_sections)))
        bar["textbook_id"] = tid
        sbs.save_bar_mongo(email, bar, tid)
        return bar
    if tid.startswith("user_"):
        tid = "focs"
    sid = body.student_id or "default_student"
    bar = sbs.load_bar(sid, tid)
    bar["learned_sections"] = sbs.sort_learned_section_list(list(set(body.learned_sections)))
    bar["textbook_id"] = tid
    sbs.save_bar(sid, bar, tid)
    return bar


# ============================================================
# Chat session endpoints (requires auth)
# ============================================================

@router.get("/api/sessions")
async def list_sessions(authorization: Optional[str] = Header(None)):
    email = verify_token(authorization)
    if not email:
        raise HTTPException(status_code=401, detail="Not authenticated")
    col = database.chat_sessions()
    if col is None:
        return []
    cursor = col.find(
        {"user_email": email},
        {"messages": 0},  # exclude messages for list view
    ).sort("updated_at", -1)
    sessions = []
    for doc in cursor:
        sessions.append({
            "id": str(doc["_id"]),
            "title": doc.get("title", "Untitled"),
            "created_at": doc.get("created_at"),
            "updated_at": doc.get("updated_at"),
        })
    return sessions


@router.get("/api/sessions/{session_id}")
async def get_session(session_id: str, authorization: Optional[str] = Header(None)):
    email = verify_token(authorization)
    if not email:
        raise HTTPException(status_code=401, detail="Not authenticated")
    col = database.chat_sessions()
    if col is None:
        raise HTTPException(status_code=503, detail="Database not available")
    doc = col.find_one({"_id": ObjectId(session_id), "user_email": email})
    if not doc:
        raise HTTPException(status_code=404, detail="Session not found")
    return {
        "id": str(doc["_id"]),
        "title": doc.get("title", "Untitled"),
        "created_at": doc.get("created_at"),
        "updated_at": doc.get("updated_at"),
        "messages": doc.get("messages", []),
    }


@router.delete("/api/sessions/{session_id}")
async def delete_session(session_id: str, authorization: Optional[str] = Header(None)):
    email = verify_token(authorization)
    if not email:
        raise HTTPException(status_code=401, detail="Not authenticated")
    col = database.chat_sessions()
    if col is None:
        raise HTTPException(status_code=503, detail="Database not available")
    result = col.delete_one({"_id": ObjectId(session_id), "user_email": email})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"ok": True}


@router.post("/api/grade")
async def grade(prompt: str = Form(...), text: str = Form(""), files: List[UploadFile] | None = None):
    user_content: List[dict[str, Any]] = []

    if text.strip():
        user_content.append({"type": "text", "text": text})

    if files:
        for f in files:
            img_bytes = await f.read()
            b64 = base64.b64encode(img_bytes).decode("utf-8")
            user_content.append(
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/png;base64,{b64}"},
                }
            )

    resp = create_chat_completion(
        model="gpt-5.2",
        messages=[
            {"role": "system", "content": prompt},
            {"role": "user", "content": user_content},
        ],
    )

    return {"reply": resp.choices[0].message.content}


def _suffix_from_upload(upload: UploadFile) -> str:
    name = (upload.filename or "").lower()
    if name.endswith(".pdf"):
        return ".pdf"
    if name.endswith(".png"):
        return ".png"
    if name.endswith(".jpg") or name.endswith(".jpeg"):
        return ".jpg"
    return ".bin"


def _is_supported_upload(upload: UploadFile) -> bool:
    name = (upload.filename or "").lower()
    ctype = (upload.content_type or "").lower()
    if name.endswith((".pdf", ".png", ".jpg", ".jpeg")):
        return True
    if ctype.startswith("image/"):
        return True
    return ctype == "application/pdf"


@router.post("/api/autograder/grade")
async def autograder_grade(
    question_file: UploadFile = File(...),
    answer_file: UploadFile = File(...),
    paper_id: str = Form("web-paper"),
):
    if not _is_supported_upload(question_file):
        raise HTTPException(status_code=400, detail="question_file must be pdf/jpg/jpeg/png")
    if not _is_supported_upload(answer_file):
        raise HTTPException(status_code=400, detail="answer_file must be pdf/jpg/jpeg/png")

    q_tmp_path: Optional[str] = None
    a_tmp_path: Optional[str] = None
    generated_temp_dir: Optional[str] = None
    try:
        q_bytes = await question_file.read()
        a_bytes = await answer_file.read()
        if not q_bytes:
            raise HTTPException(status_code=400, detail="question_file is empty")
        if not a_bytes:
            raise HTTPException(status_code=400, detail="answer_file is empty")

        q_tmp = tempfile.NamedTemporaryFile(prefix="autograder_question_", suffix=_suffix_from_upload(question_file), delete=False)
        a_tmp = tempfile.NamedTemporaryFile(prefix="autograder_answer_", suffix=_suffix_from_upload(answer_file), delete=False)
        q_tmp.write(q_bytes)
        a_tmp.write(a_bytes)
        q_tmp.close()
        a_tmp.close()
        q_tmp_path = q_tmp.name
        a_tmp_path = a_tmp.name

        resp = await grade_paper_once(
            AutoGraderGradeRequest(
                paper_id=paper_id.strip() or "web-paper",
                question_source=q_tmp_path,
                answer_source=a_tmp_path,
            )
        )
        payload = resp.model_dump()
        generated_temp_dir = payload.get("temp_dir") if isinstance(payload.get("temp_dir"), str) else None

        scores = payload.get("scores", {})
        all_absolute = bool(scores) and all((item or {}).get("mode") == "absolute" for item in scores.values())
        if all_absolute:
            total_score = 0.0
            total_max_score = 0.0
            for item in scores.values():
                total_score += float(item.get("score") or 0.0)
                total_max_score += float(item.get("max_score") or 0.0)
            payload["all_absolute"] = True
            payload["total_score"] = total_score
            payload["total_max_score"] = total_max_score
        else:
            payload["all_absolute"] = False
            payload["total_score"] = None
            payload["total_max_score"] = None

        # API 输出不暴露临时目录，且请求结束即清理该目录。
        payload["temp_dir"] = None

        return payload
    finally:
        if q_tmp_path and os.path.exists(q_tmp_path):
            try:
                os.remove(q_tmp_path)
            except OSError:
                pass
        if a_tmp_path and os.path.exists(a_tmp_path):
            try:
                os.remove(a_tmp_path)
            except OSError:
                pass
        if generated_temp_dir and os.path.isdir(generated_temp_dir):
            try:
                shutil.rmtree(generated_temp_dir, ignore_errors=True)
            except OSError:
                pass


@router.post("/api/upload_textbook")
async def upload_textbook(subject: str = Form(""), file: UploadFile = File(...)):
    import re as _re

    pdf_bytes = await file.read()

    # 1) parse paragraphs (for later retrieval / matching)
    lr.TEXTBOOK_PARAGRAPHS = lr.extract_paragraphs_from_pdf(pdf_bytes)
    print(f"📚 Parsed paragraphs: {len(lr.TEXTBOOK_PARAGRAPHS)}")

    # 2) render first pages to images and OCR via model
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    pages_b64: List[str] = []
    for page in doc[:10]:
        pix = page.get_pixmap(dpi=120)
        img_bytes = pix.tobytes("png")
        b64 = base64.b64encode(img_bytes).decode("utf-8")
        pages_b64.append(b64)

    ocr_text = ""
    for b64_img in pages_b64:
        ocr_resp = create_chat_completion(
            model="gpt-5.2",
            messages=[
                {
                    "role": "system",
                    "content": "Extract clean textbook text for curriculum structure analysis.",
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/png;base64,{b64_img}"},
                        }
                    ],
                },
            ],
        )
        ocr_text += ocr_resp.choices[0].message.content + "\n"

    if len(ocr_text.strip()) < 20:
        return {"error": "OCR failed. Try another file."}

    tree_prompt = f"""
    You must return ONLY valid JSON. No markdown code block.

    Structure:
    {{
        "subject": "{subject}",
        "topics": [
            {{
                "topic": "...",
                "chapters": [
                    {{
                        "chapter": "...",
                        "key_points": ["...", "..."]
                    }}
                ]
            }}
        ]
    }}

    Based ONLY on this textbook text:
    {ocr_text[:10000]}
    Please use exactly the tree of topic from textbook if they have one.
    You must treat section labels such as 1A, 1B, 1C, 2A, 2B, 2C as top-level chapter identifiers.
    Even if they appear on the next page, they belong to the main tree structure and should not be nested under previous chapters.

    """

    tree_resp = create_chat_completion(
        model="gpt-5.2",
        messages=[{"role": "user", "content": tree_prompt}],
        temperature=0.0,
    )

    raw = tree_resp.choices[0].message.content
    cleaned = _re.sub(r"```(json)?|```", "", raw).strip()
    cleaned = cleaned.replace("\\n", "\n")

    try:
        tree = json.loads(cleaned)
    except Exception as e:
        print("JSON parse failed:", e)
        tree = {"raw": raw}

    return {"tree": tree, "paragraph_count": len(lr.TEXTBOOK_PARAGRAPHS)}

