# ================================
# AI TUTOR BACKEND — FINAL VERSION
# New OpenAI SDK (OpenAI class)
# With Chat + AutoGrade + Vision + CurriculumTree
# ================================

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI, AuthenticationError, OpenAIError

import os
import base64
import fitz               # PyMuPDF
import tempfile
from PIL import Image
import pytesseract
from dotenv import load_dotenv

load_dotenv()


import re

def clamp_int_0_100(x: str) -> int:
    m = re.search(r"-?\d+", x or "")
    if not m:
        return 50
    v = int(m.group(0))
    return max(0, min(100, v))

# ================================
# API KEY & CLIENT INIT
# ================================
def _normalize_api_key(raw: str | None) -> str | None:
    if raw is None:
        return None
    cleaned = raw.strip().strip('"').strip("'")
    return cleaned or None


API_KEY_SOURCE = "OPENAI_API_KEY" if os.getenv("OPENAI_API_KEY") else ("API_KEY" if os.getenv("API_KEY") else None)
API_KEY = _normalize_api_key(os.getenv("OPENAI_API_KEY") or os.getenv("API_KEY"))
MASKED_KEY = f"{API_KEY[:7]}...{API_KEY[-4:]}" if API_KEY and len(API_KEY) >= 12 else "<missing>"
client = OpenAI(api_key=API_KEY) if API_KEY else None


def require_openai_client() -> OpenAI:
    if client is None:
        raise HTTPException(
            status_code=503,
            detail="Missing OPENAI_API_KEY. Set it in environment or .env before using AI endpoints.",
        )
    return client


def create_chat_completion(**kwargs):
    api_client = require_openai_client()
    try:
        return api_client.chat.completions.create(**kwargs)
    except AuthenticationError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"OpenAI authentication failed. source={API_KEY_SOURCE or 'none'}, key={MASKED_KEY}. Please verify the key is valid and not revoked.",
        ) from exc
    except OpenAIError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"OpenAI request failed: {exc.__class__.__name__}",
        ) from exc

# ================================
# FASTAPI APP INIT
# ================================
app = FastAPI()
# 全局缓存：当前教材的段落
TEXTBOOK_PARAGRAPHS: list[dict] = []


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ================================
# MODELS
# ================================
class ChatMessage(BaseModel):
    message: str
    history: list = []  # [{sender:"user"/"ai", text:"..."}]


# ================================
# PDF SAFE TEXT EXTRACTION (OCR fallback)
# ================================
def extract_pdf_text_safe(file_bytes: bytes, max_chars=500000):
    text = ""

    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(file_bytes)
        tmp_path = tmp.name

    try:
        doc = fitz.open(tmp_path)
    except:
        return ""

    for i, page in enumerate(doc):
        try:
            page_text = page.get_text()
        except:
            page_text = ""

        # fallback OCR
        if len(page_text.strip()) < 20:
            pix = page.get_pixmap(dpi=120)
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            page_text = pytesseract.image_to_string(img)

        text += page_text + "\n"

        if len(text) > max_chars:
            break

    return text


# ================================
# CHAT ENDPOINT
# ================================
@app.post("/api/chat")
async def chat(chat_message: ChatMessage):
    # 1) Tutor answer
    messages = [{"role": "system", "content": "You are an AI math tutor. Explain clearly and step-by-step."}]
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
        {"role": "system", "content":
            "You are a strict evaluator for a math tutor. "
            "Score the reliability of the tutor's answer for a student. "
            "Return ONLY one integer from 0 to 100. No other words."
        },
        {"role": "user", "content":
            f"Student question:\n{chat_message.message}\n\nTutor answer:\n{answer}\n\n"
            "Give confidence score 0-100:"
        }
    ]

    eval_resp = create_chat_completion(
        model="gpt-5.2",
        messages=eval_messages,
        temperature=0.0,
    )
    raw_score = eval_resp.choices[0].message.content
    confidence = clamp_int_0_100(raw_score)

    return {"reply": answer, "confidence": confidence}

# ================================
# AUTO GRADER ENDPOINT
# ================================
@app.post("/api/grade")
async def grade(prompt: str = Form(...), text: str = Form(""), files: list[UploadFile] = None):

    user_content = []

    if text.strip():
        user_content.append({"type": "text", "text": text})

    if files:
        for f in files:
            img_bytes = await f.read()
            b64 = base64.b64encode(img_bytes).decode("utf-8")
            user_content.append({
                "type": "image_url",
                "image_url": {"url": f"data:image/png;base64,{b64}"}
            })

    resp = create_chat_completion(
        model="gpt-5.2",
        messages=[
            {"role": "system", "content": prompt},
            {"role": "user", "content": user_content},
        ]
    )

    return {"reply": resp.choices[0].message.content}




def extract_paragraphs_from_pdf(pdf_bytes: bytes, min_len: int = 40):
    """把整本 PDF 按页 → 段落解析，返回一个列表。"""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    paragraphs = []
    pid = 0

    for page_index in range(len(doc)):
        page = doc[page_index]
        raw = page.get_text()  # 这里 Axler 是文字版，够用了

        lines = [ln.strip() for ln in raw.splitlines()]
        buf = []

        def flush_buf():
            nonlocal pid
            if not buf:
                return
            text = " ".join(buf).strip()
            buf.clear()
            if len(text) >= min_len:
                paragraphs.append({
                    "id": pid,
                    "page": page_index + 1,  # 页码从 1 开始
                    "text": text,
                })
                pid += 1

        for ln in lines:
            if not ln:
                flush_buf()
            else:
                buf.append(ln)
        flush_buf()

    return paragraphs

# ================================
# TEXTBOOK UPLOAD → VISION OCR → CURRICULUM TREE
# ================================
@app.post("/api/upload_textbook")
async def upload_textbook(subject: str = Form(""), file: UploadFile = File(...)):
    import json, re
    global TEXTBOOK_PARAGRAPHS   # ← 记得声明一下全局

    pdf_bytes = await file.read()

    # 1) parse paragraphs (for later retrieval / matching)
    TEXTBOOK_PARAGRAPHS = extract_paragraphs_from_pdf(pdf_bytes)
    print(f"📚 Parsed paragraphs: {len(TEXTBOOK_PARAGRAPHS)}")

    # 2) render first pages to images and OCR via model (your existing approach)
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    pages_b64 = []
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
                {"role": "system", "content": "Extract clean textbook text for curriculum structure analysis."},
                {"role": "user", "content": [
                    {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64_img}"}}
                ]}
            ]
        )
        ocr_text += (ocr_resp.choices[0].message.content or "") + "\n"

    if len(ocr_text.strip()) < 20:
        return {"error": "OCR failed. Try another file."}

    # 3) UPDATED TREE SCHEMA: chapters -> sections (1.1, 1.2, ...)
    tree_prompt = f"""
You must return ONLY valid JSON. No markdown code block.

Return JSON with EXACTLY this structure:
{{
  "subject": "{subject}",
  "chapters": [
    {{
      "id": "1",
      "title": "Chapter 1 title",
      "sections": [
        {{
          "id": "1.1",
          "title": "Section 1.1 title",
          "key_points": ["...", "..."]
        }},
        {{
          "id": "1.2",
          "title": "Section 1.2 title",
          "key_points": ["...", "..."]
        }}
      ]
    }}
  ]
}}

Rules:
- Preserve numbering if the textbook shows it (e.g., 1, 2, 3; or 1A, 1B, 2A as CHAPTER ids).
- Put subsection labels like 1.1, 1.2, 2.3 into "sections".
- If the book uses letters (1A, 1B, 1C), treat those as chapter ids (id="1A") not nested under previous chapter.
- Each section must have a short "title" and 1-4 "key_points".
- If you cannot find section numbers, still create sections with ids like "1.1", "1.2" in reading order.

Based ONLY on this textbook text:
{ocr_text[:12000]}
"""

    tree_resp = create_chat_completion(
        model="gpt-5.2",
        messages=[{"role": "user", "content": tree_prompt}],
        temperature=0.0
    )

    raw = tree_resp.choices[0].message.content or ""
    cleaned = re.sub(r"```(json)?|```", "", raw).strip()
    cleaned = cleaned.replace("\\n", "\n")

    try:
        tree = json.loads(cleaned)
    except Exception as e:
        print("JSON parse failed:", e)
        tree = {"raw": raw}

    # 4) small normalization so frontend won't crash if model slightly deviates
    if isinstance(tree, dict):
        if "chapters" not in tree or not isinstance(tree.get("chapters"), list):
            tree["chapters"] = []
        for ch in tree["chapters"]:
            if isinstance(ch, dict) and ("sections" not in ch or not isinstance(ch.get("sections"), list)):
                ch["sections"] = []

    return {"tree": tree, "paragraph_count": len(TEXTBOOK_PARAGRAPHS)}


@app.get("/")
async def root():
    return {"status": "ok", "msg": "AI Tutor backend running"}
