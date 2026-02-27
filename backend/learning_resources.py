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
        f"questions about other subjects), reply with exactly: UNRELATED\n\n"
        f"choose the most relevant topic from this list. Reply with ONLY one exact topic name, no quotes:\n"
        + "\n".join(f"- {n}" for n in names)
    )
    resp = create_chat_completion(
        model="gpt-5.2",
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


def _fallback_indices_formula_only(
    blocks: List[Dict[str, Any]], max_n: int = 3
) -> List[int]:
    """仅按硬公式/框内关键词选块；排除 Pop Quiz、quiz、riddle。"""
    if not blocks:
        return []
    exclude_keywords = ["pop quiz", "quiz 5.", "riddle"]  # 不选测验/谜语
    formula_keywords = [
        "proof template", "proof.", "definition", "theorem", "proposition",
        "lemma", "1.", "2.", "3.", "4.", "5.", "→", "⇒", "=", "p → q"
    ]
    scored: List[tuple] = []
    for i, b in enumerate(blocks):
        t = (b.get("text") or "").lower()
        if any(ex in t for ex in exclude_keywords):
            continue
        score = 0
        for kw in formula_keywords:
            if kw in t:
                score += 1
                break
        if score > 0:
            scored.append((i, score))
    scored.sort(key=lambda x: -x[1])
    return [idx for idx, _ in scored[:max_n]]


def get_three_relevant_snippet_images(
    pdf_bytes: bytes,
    page_num_1based: int,
    question: str,
    dpi: int = 120,
    padding_pt: float = 14.0,
) -> Optional[List[str]]:

    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        if page_num_1based < 1 or page_num_1based > len(doc):
            return None
        page = doc[page_num_1based - 1]
        page_rect = page.rect

        raw_blocks = page.get_text("blocks", sort=True)
        blocks: List[Dict[str, Any]] = []
        for b in raw_blocks:
            x0, y0, x1, y1 = b[0], b[1], b[2], b[3]
            text = (b[4] or "").strip()
            if len(text) < 3:
                continue
            blocks.append({"bbox": (x0, y0, x1, y1), "text": text[:800]})

        if not blocks:
            return None

        snippet_list = "\n\n".join(
            f"[{i}] {blocks[i]['text']}" for i in range(len(blocks))
        )
        prompt = (
            "Select textbook blocks that are HARD FORMULA / DEFINITION only.\n"
            "IMPORTANT: If the student question is about proving an IMPLICATION (if p then q, p→q) or a DIRECT PROOF of a conditional, "
            "PREFER blocks about 'Proof Template' for direct proof of p→q / implication. "
            "Do NOT prefer the full 'Principle of Induction' (base case P(1) + inductive step for all n) or 'Ordinary Induction' — that is for full induction, not for proving a single if-then.\n\n"
            f"Student question: {question}\n\n"
            "Numbered blocks below. Return 0 to 3 indices. For 'prove if A then B' type questions, choose Proof Template / direct proof of implication blocks, not the full induction principle.\n\n"
            f"{snippet_list}\n\n"
            "Reply with ONLY a JSON array, e.g. [0, 2] or [1] or []."
        )
        resp = create_chat_completion(
            model="gpt-5.2",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Output indices for formula/definition blocks. "
                        "For questions about proving 'if p then q' or direct proof of an implication, select Proof Template (direct proof of p→q), NOT the full Principle of Induction (base case + for all n)."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.0,
        )
        raw_out = (resp.choices[0].message.content or "").strip()
        raw_out = raw_out.replace("`", "").strip()
        if raw_out.lower().startswith("json"):
            raw_out = raw_out[4:].strip()
        indices: List[int] = []
        try:
            parsed = json.loads(raw_out)
            if isinstance(parsed, list):
                for i in parsed:
                    try:
                        idx = int(i)
                        if 0 <= idx < len(blocks):
                            indices.append(idx)
                    except (ValueError, TypeError):
                        pass
                indices = list(dict.fromkeys(indices))[:3]
        except Exception:
            pass

        # 剔除 Pop Quiz / quiz / riddle 类块，只留公式和定义
        exclude_keywords = ["pop quiz", "quiz 5.", "riddle"]
        indices = [
            idx for idx in indices
            if idx < len(blocks) and not any(
                ex in (blocks[idx].get("text") or "").lower() for ex in exclude_keywords
            )
        ][:3]

        if not indices:
            indices = _fallback_indices_formula_only(blocks, max_n=3)

        out_b64: List[str] = []
        for idx in indices:
            if idx >= len(blocks):
                continue
            x0, y0, x1, y1 = blocks[idx]["bbox"]
            w = max(x1 - x0, 1)
            h = max(y1 - y0, 1)
            # 固定边距 + 按块大小比例外扩，避免裁断整块（框线、标题等）
            pad_x = max(padding_pt, w * 0.15)
            pad_y = max(padding_pt, h * 0.12)
            r = fitz.Rect(
                max(0, x0 - pad_x),
                max(0, y0 - pad_y),
                min(page_rect.width, x1 + pad_x),
                min(page_rect.height, y1 + pad_y),
            )
            pix = page.get_pixmap(dpi=dpi, clip=r)
            img_bytes = pix.tobytes("png")
            out_b64.append(base64.b64encode(img_bytes).decode("utf-8"))

        doc.close()
        return out_b64  # 0～3 个，不足 3 不补齐；空列表表示本页无公式/定义可展示
    except Exception as e:
        print(f"[Learning] get_three_relevant_snippet_images failed: {e}")
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

