"""Build tooling for Lathi & Green, Linear Systems and Signals, 3rd ed. (spec §0).

The book is a text PDF, so nothing is split, OCR'd or sent to a model. Run from backend/:

  python -m book_pipeline.lathi outline   bookmarks + printed CONTENTS -> .build/outline.json
                                          and .build/outline_review.md; a human reviews it, then
                                          it is copied to data/books/lathi/outline.json
"""

from __future__ import annotations

import argparse
import json
import os
import sys

import pymupdf

from book_pipeline import outline as S3

BOOK_ID = "lathi"
PDF_PAGE_OFFSET = 20       # pdf_page (1-based) = book_page + 20 (spec §0)
CONTENTS_PAGES = (7, 16)   # 1-based PDF pages of the printed CONTENTS
CHAPTER_TITLES = {
    "B": "Background",
    "1": "Signals and Systems",
    "2": "Time-Domain Analysis of Continuous-Time Systems",
    "3": "Time-Domain Analysis of Discrete-Time Systems",
    "4": "Continuous-Time System Analysis Using the Laplace Transform",
    "5": "Discrete-Time System Analysis Using the z-Transform",
    "6": "Continuous-Time Signal Analysis: The Fourier Series",
    "7": "Continuous-Time Signal Analysis: The Fourier Transform",
    "8": "Sampling: The Bridge from Continuous to Discrete",
    "9": "Fourier Analysis of Discrete-Time Signals",
    "10": "State-Space Analysis",
}
CHAPTER_STARTS = {
    "B": 1, "1": 64, "2": 150, "3": 237, "4": 330, "5": 488,
    "6": 593, "7": 680, "8": 776, "9": 845, "10": 908,
}
LAST_CHAPTER_END = 974
BACK_MATTER = [("Index", 975)]
BACK_MATTER_TITLES = {"INDEX": "Index"}
FIRST_BODY_PAGE = 1

HERE = os.path.dirname(os.path.abspath(__file__))
BOOK_DIR = os.path.normpath(os.path.join(HERE, "..", "data", "books", BOOK_ID))
BUILD_DIR = os.path.join(BOOK_DIR, ".build")
BOOK_PDF = os.path.join(BOOK_DIR, "book.pdf")
OUTLINE_PATH = os.path.join(BOOK_DIR, "outline.json")


def _write_json(name: str, data) -> str:
    os.makedirs(BUILD_DIR, exist_ok=True)
    path = os.path.join(BUILD_DIR, name)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")
    return path


def _gates(outline: dict) -> list:
    return S3.validate_outline(
        outline, chapter_starts=CHAPTER_STARTS, last_chapter_end=LAST_CHAPTER_END, back_matter=BACK_MATTER
    )


def cmd_outline(args) -> int:
    if args.check:
        with open(args.check, encoding="utf-8") as f:
            problems = _gates(json.load(f))
        for problem in problems:
            print("    GATE:", problem)
        print("outline check:", "OK" if not problems else f"{len(problems)} problem(s)")
        return 1 if problems else 0

    doc = pymupdf.open(args.source)
    entries, problems = S3.entries_from_pdf(
        doc, offset=PDF_PAGE_OFFSET, contents_pages=CONTENTS_PAGES,
        chapter_titles=CHAPTER_TITLES, back_matter_titles=BACK_MATTER_TITLES,
    )
    outline, dropped = S3.build_outline(entries, last_chapter_end=LAST_CHAPTER_END)
    candidate = _write_json("outline.json", outline)
    _write_json("outline_dropped.json", dropped)
    review = os.path.join(BUILD_DIR, "outline_review.md")
    with open(review, "w", encoding="utf-8") as f:
        f.write(S3.review_markdown(outline))
    problems += _gates(outline)
    sections = sum(len(v) - 1 for k, v in outline.items() if k.split(" ", 1)[0] in CHAPTER_STARTS)
    print(f"outline: {len(entries)} entries -> {len(outline)} top-level entries, {sections} sections; "
          f"{len(dropped)} dropped")
    for problem in problems:
        print("    GATE:", problem)
    print(f"    review {review} against the printed CONTENTS, then copy {candidate} to {OUTLINE_PATH}")
    return 1 if problems else 0


def build_parser() -> argparse.ArgumentParser:
    ap = argparse.ArgumentParser(prog="python -m book_pipeline.lathi", description=__doc__.splitlines()[0])
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("outline", help="build outline.json from the bookmarks and the printed CONTENTS")
    p.add_argument("--source", default=BOOK_PDF, help="the book PDF (default: data/books/lathi/book.pdf)")
    p.add_argument("--check", metavar="OUTLINE_JSON", help="only validate an edited outline")
    p.set_defaults(func=cmd_outline)
    return ap


def main(argv=None) -> int:
    args = build_parser().parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
