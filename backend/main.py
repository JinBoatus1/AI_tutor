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
import json
import base64
import fitz               # PyMuPDF
import tempfile
from PIL import Image
import pytesseract
from dotenv import load_dotenv

# 从 main.py 所在目录加载 .env，避免从项目根启动时读不到 backend/.env
_env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
load_dotenv(dotenv_path=_env_path)
load_dotenv()  # 再读当前工作目录的 .env（可选）


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
    """清洗环境变量中的 API Key，去掉引号和 BOM 等异常字符。"""
    if raw is None:
        return None
    cleaned = raw.strip().strip('"').strip("'")
    # Windows UTF-8 文件有时会带 BOM
    if cleaned.startswith("\ufeff"):
        cleaned = cleaned.lstrip("\ufeff")
    cleaned = cleaned.strip()
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

# ================================
# DATA: FOCS.json + PDF (Learning Mode)
# ================================
# PDF 前 15 页无内容，教材第 "1" 页对应 PDF 第 16 页
PDF_PAGE_OFFSET = 15

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
FOCS_JSON_PATH = os.path.join(DATA_DIR, "FOCS.json")
FOCS_PDF_PATH = os.path.join(DATA_DIR, "FOCS.pdf")  # 或 data 下首个 .pdf

_topic_list: list[dict] = []  # [{name, start, end}, ...]
_focs_pdf_bytes: bytes | None = None


def _load_focs_topic_list():
    """从 FOCS.json 解析出所有有页码的 topic。"""
    global _topic_list
    if _topic_list:
        return _topic_list
    if not os.path.exists(FOCS_JSON_PATH):
        return []
    with open(FOCS_JSON_PATH, encoding="utf-8") as f:
        raw = json.load(f)

    def extract_topics(obj: dict, prefix: str = ""):
        items = []
        for k, v in obj.items():
            if k == "_range":
                continue
            if isinstance(v, dict):
                start = v.get("start") or (v.get("_range", {}).get("start"))
                end = v.get("end") or (v.get("_range", {}).get("end"))
                if start is not None and end is not None:
                    try:
                        s, e = int(start), int(end)
                        items.append({"name": k, "start": s, "end": e})
                    except (TypeError, ValueError):
                        pass
                items.extend(extract_topics(v, k))
        return items

    _topic_list = extract_topics(raw)
    return _topic_list


def _load_focs_pdf() -> bytes | None:
    """加载 data 下的 PDF。优先 FOCS.pdf，否则取首个 .pdf。"""
    global _focs_pdf_bytes
    if _focs_pdf_bytes is not None:
        return _focs_pdf_bytes
    if os.path.exists(FOCS_PDF_PATH):
        with open(FOCS_PDF_PATH, "rb") as f:
            _focs_pdf_bytes = f.read()
        return _focs_pdf_bytes
    if os.path.isdir(DATA_DIR):
        for fn in os.listdir(DATA_DIR):
            if fn.lower().endswith(".pdf"):
                path = os.path.join(DATA_DIR, fn)
                with open(path, "rb") as f:
                    _focs_pdf_bytes = f.read()
                return _focs_pdf_bytes
    return None


def _match_topic_with_llm(question: str) -> dict | None:
    """用 LLM 根据学生问题匹配 FOCS.json 中最相关的 topic。若问题与课程完全无关则返回 None。"""
    topics = _load_focs_topic_list()
    if not topics:
        return None
    names = [t["name"] for t in topics[:120]]  # 限制长度
    prompt = (
        f"You are matching a student question to a textbook topic.\n\n"
        f"Student question: {question}\n\n"
        f"If the question is COMPLETELY unrelated to this course (e.g. greetings like 'hi', random chat, "
        f"questions about other subjects like cooking/sports/general knowledge), reply with exactly: UNRELATED\n\n"
        f"Otherwise, choose the most relevant topic from this list. Reply with ONLY one exact topic name, no quotes:\n"
        + "\n".join(f"- {n}" for n in names)
    )
    resp = create_chat_completion(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.0,
    )
    chosen = (resp.choices[0].message.content or "").strip().strip('"\'')
    if chosen.upper() == "UNRELATED":
        return None
    for t in topics:
        if t["name"] == chosen:
            return t
    # 模糊匹配
    for t in topics:
        if chosen in t["name"] or t["name"] in chosen:
            return t
    return None


def _render_pdf_page_to_base64(pdf_bytes: bytes, page_num_1based: int, dpi: int = 120) -> str | None:
    """将 PDF 指定页（1-based）渲染为 PNG，返回 base64 字符串。用于在对话中展示「携带重要公式」的参考页。"""
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        if page_num_1based < 1 or page_num_1based > len(doc):
            return None
        page = doc[page_num_1based - 1]
        pix = page.get_pixmap(dpi=dpi)
        img_bytes = pix.tobytes("png")
        return base64.b64encode(img_bytes).decode("utf-8")
    except Exception:
        return None


def _extract_pdf_pages_text(pdf_bytes: bytes, start_page: int, end_page: int, max_chars: int = 15000) -> str:
    """提取 PDF 指定页码范围（1-based）的整页文本。"""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    text = ""
    for i in range(start_page - 1, min(end_page, len(doc))):
        page = doc[i]
        text += page.get_text() + "\n\n"
        if len(text) > max_chars:
            break
    doc.close()
    return text.strip()


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
    # 0) LLM 匹配 topic → 从 data 书本提取对应页
    page_context = ""
    matched_topic = None
    try:
        matched_topic = _match_topic_with_llm(chat_message.message)
        if matched_topic:
            pdf_bytes = _load_focs_pdf()
            if pdf_bytes:
                page_context = _extract_pdf_pages_text(
                    pdf_bytes,
                    matched_topic["start"] + PDF_PAGE_OFFSET,
                    matched_topic["end"] + PDF_PAGE_OFFSET,
                )
    except Exception as e:
        print(f"[Learning] topic match/page extract failed: {e}")

    system_content = "You are an AI math tutor. Explain clearly and step-by-step."
    if page_context and matched_topic:
        s, e = matched_topic["start"] + PDF_PAGE_OFFSET, matched_topic["end"] + PDF_PAGE_OFFSET
        system_content += (
            f"\n\n--- Reference from textbook (topic: {matched_topic['name']}, PDF pages {s}-{e}) ---\n"
            f"{page_context[:12000]}\n"
            "--- End of reference ---\n\nUse the above as context when answering. Cite relevant parts if helpful."
        )

    # 1) Tutor answer
    messages = [{"role": "system", "content": system_content}]
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

    result = {"reply": answer, "confidence": confidence}
    if matched_topic:
        start_pdf = matched_topic["start"] + PDF_PAGE_OFFSET
        end_pdf = matched_topic["end"] + PDF_PAGE_OFFSET
        result["matched_topic"] = {
            "name": matched_topic["name"],
            "start": start_pdf,
            "end": end_pdf,
        }
        # 携带重要公式的那一页：取匹配区间的起始页截图，供前端在对话中展示
        _pdf = _load_focs_pdf()
        if _pdf:
            page_b64 = _render_pdf_page_to_base64(_pdf, start_pdf)
            if page_b64:
                result["reference_page_image_b64"] = page_b64
    return result

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


    TEXTBOOK_PARAGRAPHS = extract_paragraphs_from_pdf(pdf_bytes)
    print(f"📚 Parsed paragraphs: {len(TEXTBOOK_PARAGRAPHS)}")


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
        temperature=0.0
    )

    raw = tree_resp.choices[0].message.content
    cleaned = re.sub(r"```(json)?|```", "", raw).strip()
    cleaned = cleaned.replace("\\n", "\n")

    try:
        tree = json.loads(cleaned)
    except Exception as e:
        print("JSON parse failed:", e)
        tree = {"raw": raw}


    return {"tree": tree, "paragraph_count": len(TEXTBOOK_PARAGRAPHS)}


@app.get("/")
async def root():
    return {"status": "ok", "msg": "AI Tutor backend running"}
