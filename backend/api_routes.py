"""FastAPI routes split out from main.py to keep main minimal."""

import base64
import json
import os
from typing import Any, List, Optional

import fitz  # PyMuPDF
from fastapi import APIRouter, File, Form, UploadFile
from pydantic import BaseModel

from deps import clamp_int_0_100, create_chat_completion
import learning_resources as lr

try:
    from memory import open_memory, Status
    _MEMORY_AVAILABLE = True
except ImportError:
    _MEMORY_AVAILABLE = False

MEMORY_ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "memory")
FOCS_BOOK_ID = "focs"


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


@router.post("/api/chat")
async def chat(chat_message: ChatMessage):
    print("[Chat] request received", flush=True)
    # 0) LLM 匹配 topic → 从 data 书本提取对应页
    page_context = ""
    matched_topic: Optional[dict[str, Any]] = None
    try:
        matched_topic = lr.match_topic_with_llm(chat_message.message)
        if matched_topic:
            pdf_bytes = lr.load_focs_pdf()
            if pdf_bytes:
                page_context = lr.extract_pdf_pages_text(
                    pdf_bytes,
                    matched_topic["start"] + lr.PDF_PAGE_OFFSET,
                    matched_topic["end"] + lr.PDF_PAGE_OFFSET,
                )
    except Exception as e:
        print(f"[Learning] topic match/page extract failed: {e}")

    system_content = (
        "You are an AI math tutor. Explain clearly and step-by-step. "
        "When the student asks which chapter to learn or review, or names a topic/chapter (e.g. Chapter 5, Induction, Proofs), "
        "use the reference below to guide them through the most important formulas and definitions from that section."
    )
    section_hint = lr.extract_section_from_message(chat_message.message)
    section_info = lr.get_section_start_end_name(section_hint) if section_hint else None
    is_subsection_request = bool(section_hint and "." in section_hint and section_info)

    if is_subsection_request:
        start_book, end_book, section_name = section_info
        start_pdf = start_book + lr.PDF_PAGE_OFFSET
        end_pdf = end_book + lr.PDF_PAGE_OFFSET
        system_content += (
            f"\n\nThe student has already chosen section: {section_name}. "
            "Do NOT show the section list or ask them to pick again. Use the reference below to walk them through this section's key formulas and definitions."
        )
        _pdf = lr.load_focs_pdf()
        if _pdf:
            page_context = lr.extract_pdf_pages_text(_pdf, start_pdf, end_pdf)
            if page_context:
                system_content += (
                    f"\n\n--- Reference from textbook ({section_name}, PDF pp. {start_pdf}-{end_pdf}) ---\n"
                    f"{page_context[:12000]}\n"
                    "--- End of reference ---\n\n"
                    "Use the above to explain this section. Point to the right-hand pages when relevant."
                )
    else:
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
        s = matched_topic["start"] + lr.PDF_PAGE_OFFSET
        e = matched_topic["end"] + lr.PDF_PAGE_OFFSET
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
    if _MEMORY_AVAILABLE and memory_addr:
        try:
            mem = open_memory(MEMORY_ROOT, FOCS_BOOK_ID)
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

    # 1) Tutor answer（当前轮可带图片，走 vision）
    messages: List[dict[str, Any]] = [{"role": "system", "content": system_content}]
    for msg in chat_message.history:
        role = "assistant" if msg["sender"] == "ai" else "user"
        messages.append({"role": role, "content": msg["text"]})
    # 最后一条 user：无图则纯文本，有图则 content 为多 part（text + image_url）
    if not (chat_message.images_b64 and len(chat_message.images_b64) > 0):
        messages.append({"role": "user", "content": chat_message.message})
    else:
        parts: List[dict[str, Any]] = [{"type": "text", "text": chat_message.message or "(用户发送了图片)"}]
        for b64 in chat_message.images_b64:
            url = f"data:image/png;base64,{b64}" if not b64.startswith("data:") else b64
            parts.append({"type": "image_url", "image_url": {"url": url}})
        messages.append({"role": "user", "content": parts})

    answer = run_tutor_with_optional_memory_tool(
        messages,
        memory_addr=memory_addr,
        mem=mem,
        enable_memory_tool=enable_memory_tool,
    )

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
    confidence = clamp_int_0_100(raw_score)

    result: dict[str, Any] = {"reply": answer, "confidence": confidence}

    # 若用户问的是某一章或小节（chapter 5 / 5.1 / 5.1.1），左侧显示该章/节全部页并可翻页，不跑 snippet 检索
    if section_hint:
        section_info = lr.get_section_start_end_name(section_hint)
        if section_info:
            start_book, end_book, name = section_info
            start_pdf = start_book + lr.PDF_PAGE_OFFSET
            end_pdf = end_book + lr.PDF_PAGE_OFFSET
            result["matched_topic"] = {"name": name, "start": start_pdf, "end": end_pdf}
            _pdf = lr.load_focs_pdf()
            if _pdf:
                pages_b64 = lr.render_pdf_page_range_to_base64(_pdf, start_pdf, end_pdf)
                if pages_b64:
                    result["reference_section_pages_b64"] = pages_b64
            if _MEMORY_AVAILABLE:
                try:
                    if mem is None:
                        mem = open_memory(MEMORY_ROOT, FOCS_BOOK_ID)
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
        start_pdf = matched_topic["start"] + lr.PDF_PAGE_OFFSET
        end_pdf = matched_topic["end"] + lr.PDF_PAGE_OFFSET
        result["matched_topic"] = {
            "name": matched_topic["name"],
            "start": start_pdf,
            "end": end_pdf,
        }
        # 教材裁剪：只输出公式/定义类片段（0～3 个），不足 3 不补齐；无公式/定义时不展示参考图
        _pdf = lr.load_focs_pdf()
        if _pdf:
            snippets_b64 = lr.get_three_relevant_snippet_images(
                _pdf, start_pdf, chat_message.message
            )
            if snippets_b64 is not None and len(snippets_b64) > 0:
                result["reference_page_snippets_b64"] = snippets_b64
            elif snippets_b64 is None:
                # 仅异常时退回整页图
                page_b64 = lr.render_pdf_page_to_base64(_pdf, start_pdf)
                if page_b64:
                    result["reference_page_image_b64"] = page_b64

        # 按 FOCS topic 写入 memory：事件（完整 Q&A，带时间）+ summary 流
        if _MEMORY_AVAILABLE and matched_topic:
            try:
                if mem is None:
                    mem = open_memory(MEMORY_ROOT, FOCS_BOOK_ID)
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
    print("[Chat] response sent", flush=True)
    return result


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

