"""FastAPI routes split out from main.py to keep main minimal."""

import base64
import json
from typing import Any, List, Optional

import fitz  # PyMuPDF
from fastapi import APIRouter, File, Form, UploadFile
from pydantic import BaseModel

from deps import clamp_int_0_100, create_chat_completion
import learning_resources as lr


router = APIRouter()


class ChatMessage(BaseModel):
    message: str
    history: List[dict] = []  # [{sender:"user"/"ai", text:"..."}]


@router.post("/api/chat")
async def chat(chat_message: ChatMessage):
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

    system_content = "You are an AI math tutor. Explain clearly and step-by-step."
    if page_context and matched_topic:
        s = matched_topic["start"] + lr.PDF_PAGE_OFFSET
        e = matched_topic["end"] + lr.PDF_PAGE_OFFSET
        system_content += (
            f"\n\n--- Reference from textbook (topic: {matched_topic['name']}, PDF pages {s}-{e}) ---\n"
            f"{page_context[:12000]}\n"
            "--- End of reference ---\n\nUse the above as context when answering. Cite relevant parts if helpful."
        )

    # 1) Tutor answer
    messages: List[dict[str, Any]] = [{"role": "system", "content": system_content}]
    for msg in chat_message.history:
        role = "assistant" if msg["sender"] == "ai" else "user"
        messages.append({"role": role, "content": msg["text"]})
    messages.append({"role": "user", "content": chat_message.message})

    tutor_resp = create_chat_completion(
        model="gpt-5.2",
        messages=messages,
    )
    answer = tutor_resp.choices[0].message.content or ""

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
    if matched_topic:
        start_pdf = matched_topic["start"] + lr.PDF_PAGE_OFFSET
        end_pdf = matched_topic["end"] + lr.PDF_PAGE_OFFSET
        result["matched_topic"] = {
            "name": matched_topic["name"],
            "start": start_pdf,
            "end": end_pdf,
        }
        # 携带重要公式的那一页：取匹配区间的起始页截图，供前端在对话中展示
        _pdf = lr.load_focs_pdf()
        if _pdf:
            page_b64 = lr.render_pdf_page_to_base64(_pdf, start_pdf)
            if page_b64:
                result["reference_page_image_b64"] = page_b64
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

