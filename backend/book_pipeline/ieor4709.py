"""Build the IEOR E4709 course (Capponi, *Statistical Analysis and Time Series*) from its
lecture notes. Unlike FOCS and Lathi there is no textbook: the 27 lecture PDFs plus the
course intro are merged into one book.pdf.

Run from backend/:

  python -m book_pipeline.ieor4709        writes data/books/ieor4709/book.pdf and outline.json

Page numbers in the outline are pages of the merged PDF (pdf_page_offset 0). The outline is
the 27 lectures and nothing else ("3 Mean-Variance Tradeoff, ..."): opening one shows all of
its pages. The course intro is merged into lecture 1.
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
# Lecture 4 and 10 have no "Lecture N:" prefix; their titles are kept as printed.
TITLE_PREFIX = re.compile(r"^lecture\s*\d+\s*:\s*", re.I)

TITLE_SIZE = 16.5    # the lecture title is 17.2pt; section headings 14.3pt


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


def build() -> Dict[str, Dict]:
    """One outline entry per lecture, no sections: clicking a lecture opens all its pages.
    The course intro is the first part of lecture 1, so it is merged into that entry."""
    merged = pymupdf.open()
    outline: Dict[str, Dict] = {}
    for n in range(1, LECTURE_COUNT + 1):
        files = ([INTRO_FILE] if n == 1 else []) + [f"Lecture{n:02d}.pdf"]
        first = merged.page_count + 1
        title = ""
        for name in files:
            with pymupdf.open(os.path.join(SRC_DIR, name)) as doc:
                if name != INTRO_FILE:
                    title = lecture_title(doc)
                merged.insert_pdf(doc)
        outline[f"{n} {title}"] = {"_range": {"start": first, "end": merged.page_count}}

    os.makedirs(OUT_DIR, exist_ok=True)
    merged.save(os.path.join(OUT_DIR, "book.pdf"), garbage=3, deflate=True)
    merged.close()
    with open(os.path.join(OUT_DIR, "outline.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(outline, f, ensure_ascii=False, indent=2)
        f.write("\n")
    return outline


if __name__ == "__main__":
    o = build()
    for lecture, body in o.items():
        print(lecture, body["_range"])
    sys.exit(0)
