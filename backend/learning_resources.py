"""Textbook / FOCS data helpers and PDF utilities."""

import base64
import json
import os
import re
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


def _sanitize_memory_segment(s: str) -> str:
    """单段路径：仅 [A-Za-z0-9_-]，供 memory address 使用。"""
    if not s or not isinstance(s, str):
        return "unknown"
    s = s.strip()
    s = re.sub(r"[^A-Za-z0-9_\-]", "_", s)
    s = re.sub(r"_+", "_", s).strip("_")
    return s or "unknown"


def get_chapter_heading_key(chapter_num: str) -> Optional[str]:
    """
    在 FOCS.json 顶层查找章节标题键，如 chapter_num='5' -> '5 Induction: Proving \"FOR ALL ...\" '。
    仅匹配顶层章（首词等于章节号）。
    """
    if not chapter_num or not os.path.exists(FOCS_JSON_PATH):
        return None
    num = str(chapter_num).strip()
    with open(FOCS_JSON_PATH, encoding="utf-8") as f:
        raw = json.load(f)
    for k, v in raw.items():
        if k == "_range" or not isinstance(v, dict):
            continue
        first = k.split()[0] if k.split() else ""
        if first == num:
            return k
    return None


def topic_name_to_memory_address(topic_name: str) -> str:
    """
    将 FOCS.json 的 topic 名称转为 memory 地址（允许用 / 分层）。

    - 小节（首词形如 5.1、5.1.1）：存到「章」目录下，例如
      5_Induction_.../5_1_Ordinary_Induction，这样同一章下 5.1、5.2 共用父目录。
    - 章级（首词为纯数字，如整章 topic）：单层目录，例如 5_Induction_...。
    - 其它：整段 sanitize 成单段（兼容旧行为）。
    """
    if not topic_name or not isinstance(topic_name, str):
        return "unknown"
    s = topic_name.strip()
    parts = s.split()
    if not parts:
        return "unknown"
    token = parts[0]

    # 小节：5.1 / 5.1.1 → 父目录为 FOCS 顶层章标题，子目录为本节
    if re.match(r"^\d+\.\d+(?:\.\d+)*$", token):
        chapter_num = token.split(".")[0]
        ch_key = get_chapter_heading_key(chapter_num)
        if ch_key:
            parent = _sanitize_memory_segment(ch_key)
            child = _sanitize_memory_segment(s)
            return f"{parent}/{child}"
        return _sanitize_memory_segment(s)

    # 章级：首词仅为章节号 → 单层（对应整章记忆）
    if re.match(r"^\d+$", token):
        ch_key = get_chapter_heading_key(token)
        if ch_key:
            return _sanitize_memory_segment(ch_key)
        return _sanitize_memory_segment(s)

    return _sanitize_memory_segment(s)


def get_focs_chapter_tree(chapter_filter: Optional[str] = None) -> str:
    """
    从 FOCS.json 生成教材章节树（缩进 + 页码）。
    chapter_filter: 若为 "5"，只返回第 5 章及其 sections，不返回全书；None 则返回全书。
    """
    if not os.path.exists(FOCS_JSON_PATH):
        return ""
    with open(FOCS_JSON_PATH, encoding="utf-8") as f:
        raw = json.load(f)

    def fmt_range(d: Dict[str, Any]) -> str:
        start = d.get("start") or (d.get("_range", {}) or {}).get("start")
        end = d.get("end") or (d.get("_range", {}) or {}).get("end")
        if start is not None and end is not None:
            if start == end:
                return f" (p. {start})"
            return f" (pp. {start}-{end})"
        return ""

    def walk(obj: Dict[str, Any], indent: int) -> List[str]:
        lines: List[str] = []
        prefix = "  " * indent
        for k, v in obj.items():
            if k == "_range" or not isinstance(v, dict):
                continue
            rng = fmt_range(v)
            lines.append(f"{prefix}{k}{rng}")
            sub = walk(v, indent + 1)
            lines.extend(sub)
        return lines

    if chapter_filter is not None and str(chapter_filter).strip():
        num = str(chapter_filter).strip()
        for k, v in raw.items():
            if k == "_range" or not isinstance(v, dict):
                continue
            first_word = k.split()[0] if k.split() else ""
            if first_word == num or k.startswith(num + " "):
                lines = [k + fmt_range(v)] + walk(v, 1)
                return "\n".join(lines)
        return ""

    lines = walk(raw, 0)
    return "\n".join(lines) if lines else ""


def _get_range_from_node(v: Dict[str, Any]) -> Optional[tuple]:
    start = v.get("start") or (v.get("_range") or {}).get("start")
    end = v.get("end") or (v.get("_range") or {}).get("end")
    if start is not None and end is not None:
        try:
            return (int(start), int(end))
        except (TypeError, ValueError):
            pass
    return None


def get_chapter_start_end_name(chapter_filter: str) -> Optional[tuple]:
    """
    根据章节号取该章在 FOCS 中的起始/结束页（教材页码）及章节名。
    返回 (start_book, end_book, name) 或 None。
    """
    if not chapter_filter or not os.path.exists(FOCS_JSON_PATH):
        return None
    with open(FOCS_JSON_PATH, encoding="utf-8") as f:
        raw = json.load(f)
    num = str(chapter_filter).strip()
    for k, v in raw.items():
        if k == "_range" or not isinstance(v, dict):
            continue
        first_word = k.split()[0] if k.split() else ""
        if first_word != num and not k.startswith(num + " "):
            continue
        r = _get_range_from_node(v)
        if r:
            return (r[0], r[1], k)
        break
    return None


def get_section_start_end_name(section_filter: str) -> Optional[tuple]:
    """
    根据小节号（如 5.1、5.1.1）在 FOCS 整棵树中查找，返回 (start_book, end_book, name)。
    支持 chapter（5）和 subsection（5.1、5.1.1）。
    """
    if not section_filter or not os.path.exists(FOCS_JSON_PATH):
        return None
    with open(FOCS_JSON_PATH, encoding="utf-8") as f:
        raw = json.load(f)
    prefix = str(section_filter).strip()

    def walk(obj: Dict[str, Any]) -> Optional[tuple]:
        for k, v in obj.items():
            if k == "_range" or not isinstance(v, dict):
                continue
            first_word = k.split()[0] if k.split() else ""
            if first_word == prefix:
                r = _get_range_from_node(v)
                if r:
                    return (r[0], r[1], k)
            found = walk(v)
            if found:
                return found
        return None

    return walk(raw)


def extract_chapter_from_message(message: str) -> Optional[str]:
    """从用户消息中解析出章节号，例如 'chapter 5' / '第5章' / '5' -> '5'。"""
    if not message or not isinstance(message, str):
        return None
    s = message.strip()
    m = re.search(r"(?:chapter|ch\.?)\s*(\d+)", s, re.IGNORECASE)
    if m:
        return m.group(1)
    m = re.search(r"第\s*(\d+)\s*章", s)
    if m:
        return m.group(1)
    if re.match(r"^\d+\s*$", s):
        return s.strip()
    m = re.search(r"\b(\d+)\s*章", s)
    if m:
        return m.group(1)
    return None


def extract_section_from_message(message: str) -> Optional[str]:
    """
    从用户消息中解析出章节或小节号，如 '5.1' / 'section 5.1' / '5.1.1' -> '5.1' 或 '5.1.1'；
    'chapter 5' / '5' -> '5'。优先匹配 subsection（含小数点），否则用 chapter。
    """
    if not message or not isinstance(message, str):
        return None
    s = message.strip()
    m = re.search(r"(?:section|subsection)?\s*(\d+\.\d+(?:\.\d+)*)", s, re.IGNORECASE)
    if m:
        return m.group(1).strip()
    m = re.search(r"\b(\d+\.\d+(?:\.\d+)*)\b", s)
    if m:
        return m.group(1)
    return extract_chapter_from_message(message)


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
        f"You are matching a student question to a textbook topic, remember to choose the topic by how to solve the question instead of the words\n\n"
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


def render_pdf_page_range_to_base64(
    pdf_bytes: bytes, start_page_1based: int, end_page_1based: int, dpi: int = 120
) -> List[str]:
    """将 PDF 指定页码范围（1-based，含首尾）逐页渲染为 PNG，返回 base64 字符串列表。"""
    out: List[str] = []
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        start = max(1, min(start_page_1based, len(doc)))
        end = max(start, min(end_page_1based, len(doc)))
        for i in range(start - 1, end):
            page = doc[i]
            pix = page.get_pixmap(dpi=dpi)
            img_bytes = pix.tobytes("png")
            out.append(base64.b64encode(img_bytes).decode("utf-8"))
        doc.close()
    except Exception:
        pass
    return out


def render_user_pdf_first_pages_to_base64(
    pdf_bytes: bytes, *, max_pages: int = 8, dpi: int = 120
) -> List[str]:
    """用户上传的 PDF：将前 max_pages 页渲染为 PNG base64，供多模态对话使用。"""
    out: List[str] = []
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        n = min(len(doc), max(1, int(max_pages)))
        for i in range(n):
            page = doc[i]
            pix = page.get_pixmap(dpi=dpi)
            img_bytes = pix.tobytes("png")
            out.append(base64.b64encode(img_bytes).decode("utf-8"))
    finally:
        doc.close()
    return out


def _fallback_indices_formula_only(
    blocks: List[Dict[str, Any]], max_n: int = 3
) -> List[int]:
    """仅按硬公式/框内关键词选块；排除 Pop Quiz、quiz、riddle。"""
    if not blocks:
        return []
    exclude_keywords = ["pop quiz", "quiz 5.", "riddle"]  # 不选测验/谜语
    formula_keywords = [
        "proof template", "proof.", "definition", "theorem", "proposition",
        "lemma", "1.", "2.", "3.", "4.", "5.", "→", "⇒", "="
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
        # 按段落合并：垂直间距小于阈值的块视为同一段，合并 bbox 与文本，避免切块过小
        PARAGRAPH_GAP_PT = 14.0
        MERGED_TEXT_CAP = 1200
        segments: List[Dict[str, Any]] = []
        for b in raw_blocks:
            x0, y0, x1, y1 = b[0], b[1], b[2], b[3]
            text = (b[4] or "").strip()
            if len(text) < 3:
                continue
            if not segments:
                segments.append({"bbox": (x0, y0, x1, y1), "text": text})
                continue
            last = segments[-1]
            lx0, ly0, lx1, ly1 = last["bbox"]
            if y0 - ly1 <= PARAGRAPH_GAP_PT:
                # 同一段：合并 bbox，拼接文本
                last["bbox"] = (min(lx0, x0), min(ly0, y0), max(lx1, x1), max(ly1, y1))
                last["text"] = (last["text"] + "\n" + text).strip()
            else:
                segments.append({"bbox": (x0, y0, x1, y1), "text": text})
        blocks = [
            {"bbox": s["bbox"], "text": (s["text"][:MERGED_TEXT_CAP])}
            for s in segments
        ]

        if not blocks:
            return None

        snippet_list = "\n\n".join(
            f"[{i}] {blocks[i]['text']}" for i in range(len(blocks))
        )
        prompt = (
            "Select textbook blocks that are formula or definition content ONLY: "
            "theorem/definition/proposition/lemma statements, proof templates or proof steps, math equations, key formulas.\n"
            "Do NOT select: page or section headers, topic titles, long prose with no formulas, or quiz/riddle.\n\n"
            f"Student question: {question}\n\n"
            "Numbered blocks below. Return 0 to 3 indices (0-based) of blocks that match. Reply with ONLY a JSON array, e.g. [0, 2] or [1] or [].\n\n"
            f"{snippet_list}\n\n"
            "Reply with ONLY a JSON array, e.g. [0, 2] or [1] or []."
        )
        resp = create_chat_completion(
            model="gpt-5.2",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Choose blocks that are formula or definition content (theorems, definitions, proof steps, equations). "
                        "Do not choose page/section headers, topic titles, or prose without formulas."
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

