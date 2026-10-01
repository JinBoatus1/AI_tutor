"""End-to-end check of a built book through the runtime code paths (spec §7 AC2, AC3).

folio_sweep() confirms the page convention on every body page from the printed page number in
the text layer. check_sections() opens each section's start page with the same render and text
functions the API uses. gate() turns both reports into problems.
"""

from __future__ import annotations

import base64
import io
import re
from dataclasses import dataclass, field
from typing import Dict, List, Tuple

import pymupdf
from PIL import Image

import learning_resources as lr

EDGE_LINES = 3  # running heads and footers sit in a page's first or last lines of text


@dataclass
class FolioReport:
    confirmed: List[int] = field(default_factory=list)
    unconfirmed: List[int] = field(default_factory=list)
    coverage: float = 0.0


@dataclass
class SectionReport:
    checked: int = 0
    render_failed: List[int] = field(default_factory=list)
    landscape: List[int] = field(default_factory=list)
    missing_heading: List[str] = field(default_factory=list)
    thin_text: List[str] = field(default_factory=list)


def prints_folio(text: str, book_page: int) -> bool:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    edge = lines[:EDGE_LINES] + lines[-EDGE_LINES:]
    return any(re.search(rf"(?<![\d.]){book_page}(?![\d.])", line) for line in edge)


def folio_sweep(pdf_bytes: bytes, *, offset: int, first: int, last: int) -> FolioReport:
    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    rep = FolioReport()
    for book_page in range(first, last + 1):
        index0 = book_page + offset - 1
        ok = 0 <= index0 < doc.page_count and prints_folio(doc[index0].get_text(), book_page)
        (rep.confirmed if ok else rep.unconfirmed).append(book_page)
    total = last - first + 1
    rep.coverage = len(rep.confirmed) / total if total > 0 else 0.0
    return rep


def section_starts(outline: Dict[str, dict]) -> List[Tuple[str, int, int]]:
    rows = []
    for node in outline.values():
        for key, sub in node.items():
            if key != "_range" and isinstance(sub, dict) and isinstance(sub.get("start"), int):
                rows.append((key, sub["start"], sub.get("end") or sub["start"]))
    return rows


def check_sections(pdf_bytes: bytes, outline: Dict[str, dict], *, offset: int, min_chars: int = 200) -> SectionReport:
    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    rep = SectionReport()
    for key, start, end in section_starts(outline):
        rep.checked += 1
        b64 = lr.render_pdf_page_to_base64(pdf_bytes, start + offset)
        if not b64:
            rep.render_failed.append(start)
        else:
            img = Image.open(io.BytesIO(base64.b64decode(b64)))
            if img.width >= img.height:
                rep.landscape.append(start)
        token = key.split(" ", 1)[0]
        index0 = start + offset - 1
        page_text = doc[index0].get_text() if 0 <= index0 < doc.page_count else ""
        if not re.search(rf"(?m)^\s*{re.escape(token)}(?=\s)", page_text):
            rep.missing_heading.append(key)
        if len(lr.extract_pdf_pages_text(pdf_bytes, start + offset, end + offset).strip()) < min_chars:
            rep.thin_text.append(key)
    return rep


def gate(folio: FolioReport, sections: SectionReport, *, min_coverage: float = 0.95) -> List[str]:
    problems: List[str] = []
    if folio.coverage < min_coverage:
        problems.append(f"only {folio.coverage:.1%} of body pages print the expected number "
                        f"(need {min_coverage:.0%}); unconfirmed: {folio.unconfirmed[:10]}")
    if sections.checked == 0:
        problems.append("no sections were checked: the outline has no sections")
    if sections.render_failed:
        problems.append(f"render failed at book pages {sections.render_failed[:10]}")
    if sections.landscape:
        problems.append(f"landscape pages at book pages {sections.landscape[:10]}")
    if sections.missing_heading:
        problems.append(f"{len(sections.missing_heading)} section(s) do not open on their heading: "
                        f"{sections.missing_heading[:5]}")
    if len(sections.thin_text) > 0.05 * sections.checked:
        problems.append(f"{len(sections.thin_text)} of {sections.checked} sections have almost no text: "
                        f"{sections.thin_text[:5]}")
    return problems
