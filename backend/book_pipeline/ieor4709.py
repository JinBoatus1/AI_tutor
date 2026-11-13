"""Build the IEOR E4709 course (Capponi, *Statistical Analysis and Time Series*) from its
lecture notes. Unlike FOCS and Lathi there is no textbook: the 27 lecture PDFs plus the
course intro are merged into one book.pdf, one lecture per chapter.

Run from backend/:

  python -m book_pipeline.ieor4709        writes data/books/ieor4709/book.pdf and outline.json

Page numbers in the outline are pages of the merged PDF (pdf_page_offset 0). Chapters are
lectures ("3 Mean-Variance Tradeoff, ..."); sections are each lecture's numbered top-level
headings ("3.2 Method of Moments"), found by font size since the PDFs have no bookmarks.
"""

from __future__ import annotations

import json
import os
import re
import sys
from typing import Dict, List, Tuple

import pymupdf

BOOK_ID = "ieor4709"
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
SRC_DIR = os.path.join(REPO, "Capponi_tutor_demo", "IEOR4709_Lecture_Notes")
OUT_DIR = os.path.join(os.path.dirname(HERE), "data", "books", BOOK_ID)

LECTURE_COUNT = 27
INTRO_FILE = "Lecture01_Intro.pdf"
INTRO_TITLE = "0 Course Introduction"
# Housekeeping headings, not course content.
SKIP_HEADINGS = re.compile(r"^(announcements?|annoucements?)$", re.I)
# Lecture 4 and 10 have no "Lecture N:" prefix; their titles are kept as printed.
TITLE_PREFIX = re.compile(r"^lecture\s*\d+\s*:\s*", re.I)

SECTION_SIZE = 14.0   # LaTeX \section is 14.3pt; \subsection 12pt; title 17.2pt
TITLE_SIZE = 16.5
TOP_OF_PAGE = 100.0   # a heading above this y starts the page, so the previous section ends before it


def _lines(page) -> List[Tuple[float, float, str]]:
    out = []
    for b in page.get_text("dict")["blocks"]:
        for ln in b.get("lines", []):
            txt = "".join(s["text"] for s in ln["spans"]).strip()
            if txt:
                out.append((max(s["size"] for s in ln["spans"]), ln["bbox"][1], txt))
    return out


def lecture_title(doc) -> str:
    parts = [t for sz, _, t in _lines(doc[0]) if sz >= TITLE_SIZE]
    return TITLE_PREFIX.sub("", " ".join(parts)).strip()


def lecture_sections(doc) -> List[Tuple[str, str, int, float]]:
    """(number, title, 0-based page, y) for each top-level numbered heading."""
    found = []
    for pno, page in enumerate(doc):
        lines = [l for l in _lines(page) if SECTION_SIZE <= l[0] < TITLE_SIZE]
        i = 0
        while i < len(lines):
            _, y, txt = lines[i]
            if re.fullmatch(r"\d+", txt) and i + 1 < len(lines):
                title, ty = lines[i + 1][2], lines[i + 1][1]
                i += 2
                # A long heading wraps onto the next line(s) at the same size.
                while i < len(lines) and not re.fullmatch(r"\d+", lines[i][2]) and lines[i][1] - ty < 20:
                    title, ty = f"{title} {lines[i][2]}", lines[i][1]
                    i += 1
                found.append((txt, title, pno, y))
            else:
                i += 1
    return found


def build() -> Dict[str, Dict]:
    merged = pymupdf.open()
    outline: Dict[str, Dict] = {}

    def add(path: str, chapter_key: str, chapter_no: str) -> None:
        doc = pymupdf.open(path)
        base = merged.page_count  # 0-based index of this lecture's first page
        merged.insert_pdf(doc)
        first, last = base + 1, base + doc.page_count
        chapter: Dict[str, Dict] = {"_range": {"start": first, "end": last}}
        heads = [h for h in lecture_sections(doc) if not SKIP_HEADINGS.match(h[1].strip())]
        for k, (_, title, pno, _) in enumerate(heads):
            start = base + pno + 1
            if k + 1 < len(heads):
                _, _, npno, ny = heads[k + 1]
                end = base + npno + (0 if ny < TOP_OF_PAGE else 1)
                end = max(start, end)
            else:
                end = last
            chapter[f"{chapter_no}.{k + 1} {title.strip()}"] = {"start": start, "end": end}
        outline[chapter_key] = chapter
        doc.close()

    add(os.path.join(SRC_DIR, INTRO_FILE), INTRO_TITLE, "0")
    for n in range(1, LECTURE_COUNT + 1):
        path = os.path.join(SRC_DIR, f"Lecture{n:02d}.pdf")
        with pymupdf.open(path) as d:
            title = lecture_title(d)
        add(path, f"{n} {title}", str(n))

    os.makedirs(OUT_DIR, exist_ok=True)
    merged.save(os.path.join(OUT_DIR, "book.pdf"), garbage=3, deflate=True)
    merged.close()
    with open(os.path.join(OUT_DIR, "outline.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(outline, f, ensure_ascii=False, indent=2)
        f.write("\n")
    return outline


if __name__ == "__main__":
    o = build()
    for ch, body in o.items():
        print(ch, body["_range"])
        for sec, r in body.items():
            if sec != "_range":
                print("   ", sec, r)
    sys.exit(0)
