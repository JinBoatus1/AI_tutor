"""Textbook / FOCS data helpers and PDF utilities."""

import base64
import json
import os
import tempfile
from typing import Any, Dict, List, Optional

import fitz  # PyMuPDF
from PIL import Image
import pytesseract

from deps import create_chat_completion, clamp_int_0_100

# PDF 前 15 页无内容，教材第 "1" 页对应 PDF 第 16 页
PDF_PAGE_OFFSET = 15

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
FOCS_JSON_PATH = os.path.join(DATA_DIR, "FOCS.json")
FOCS_PDF_PATH = os.path.join(DATA_DIR, "FOCS.pdf")  # 或 data 下首个 .pdf

_topic_list: List[Dict[str, Any]] = []  # [{name, start, end}, ...]
_focs_pdf_bytes: Optional[bytes] = None

# 全局缓存：当前教材的段落
TEXTBOOK_PARAGRAPHS: List[Dict[str, Any]] = []


def load_focs_topic_list() -> List[Dict[str, Any]]:
    """从 FOCS.json 解析出所有有页码的 topic。"""
    global _topic_list
    if _topic_list:
        return _topic_list
    if not os.path.exists(FOCS_JSON_PATH):
        return []
    with open(FOCS_JSON_PATH, encoding="utf-8") as f:
        raw = json.load(f)

    def extract_topics(obj: Dict[str, Any]) -> List[Dict[str, Any]]:
        items: List[Dict[str, Any]] = []
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
                items.extend(extract_topics(v))
        return items

    _topic_list = extract_topics(raw)
    return _topic_list


def load_focs_pdf() -> Optional[bytes]:
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


def match_topic_with_llm(question: str) -> Optional[Dict[str, Any]]:
    """用 LLM 根据学生问题匹配 FOCS.json 中最相关的 topic。若问题与课程完全无关则返回 None。"""
    topics = load_focs_topic_list()
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


def render_pdf_page_to_base64(pdf_bytes: bytes, page_num_1based: int, dpi: int = 120) -> Optional[str]:
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


def extract_pdf_pages_text(pdf_bytes: bytes, start_page: int, end_page: int, max_chars: int = 15000) -> str:
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


# ================================
# PDF SAFE TEXT EXTRACTION (OCR fallback)
# ================================
def extract_pdf_text_safe(file_bytes: bytes, max_chars: int = 500000) -> str:
    text = ""

    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(file_bytes)
        tmp_path = tmp.name

    try:
        doc = fitz.open(tmp_path)
    except Exception:
        return ""

    for page in doc:
        try:
            page_text = page.get_text()
        except Exception:
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


def extract_paragraphs_from_pdf(pdf_bytes: bytes, min_len: int = 40) -> List[Dict[str, Any]]:
    """把整本 PDF 按页 → 段落解析，返回一个列表。"""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    paragraphs: List[Dict[str, Any]] = []
    pid = 0

    for page_index in range(len(doc)):
        page = doc[page_index]
        raw = page.get_text()  # 这里 Axler 是文字版，够用了

        lines = [ln.strip() for ln in raw.splitlines()]
        buf: List[str] = []

        def flush_buf():
            nonlocal pid
            if not buf:
                return
            text = " ".join(buf).strip()
            buf.clear()
            if len(text) >= min_len:
                paragraphs.append(
                    {
                        "id": pid,
                        "page": page_index + 1,  # 页码从 1 开始
                        "text": text,
                    }
                )
                pid += 1

        for ln in lines:
            if not ln:
                flush_buf()
            else:
                buf.append(ln)
        flush_buf()

    return paragraphs

