# ================================
# AI TUTOR BACKEND — FINAL VERSION
# New OpenAI SDK (OpenAI class)
# With Chat + AutoGrade + Vision + CurriculumTree
# ================================

from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI

import os
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
_raw = (os.getenv("OPENAI_API_KEY") or os.getenv("API_KEY") or "").strip()
# 去除可能被误读的引号及 BOM（Windows UTF-8 保存时可能产生）
if _raw.startswith('"') and _raw.endswith('"'):
    _raw = _raw[1:-1]
elif _raw.startswith("'") and _raw.endswith("'"):
    _raw = _raw[1:-1]
if _raw.startswith("\ufeff"):  # BOM
    _raw = _raw[1:]
API_KEY = _raw.strip()
if not API_KEY:
    raise RuntimeError(
        "❌ 请在 backend/.env 中设置 OPENAI_API_KEY=你的密钥（或 API_KEY=你的密钥）。"
    )

client = OpenAI(api_key=API_KEY)

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

    tutor_resp = client.chat.completions.create(
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

    eval_resp = client.chat.completions.create(
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

    resp = client.chat.completions.create(
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
        ocr_resp = client.chat.completions.create(
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

    tree_resp = client.chat.completions.create(
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
