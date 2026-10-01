"""The builtin outline (spec §0, §4 S3): bookmarks + printed CONTENTS -> the shape of
books/focs/outline.json, plus the spec's gates.

entries_from_pdf() takes structure and pages from a text PDF's bookmarks, and the titles as
printed from its CONTENTS pages. build_outline() turns entries into the FOCS shape, and
validate_outline() enforces the gates. A human reads review_markdown() before the outline is
committed. No model is called.
"""

from __future__ import annotations

import re
import unicodedata
from typing import Dict, List, Optional, Tuple

import pymupdf

_CHAPTER = re.compile(r"^(?:\d+|[A-Z])$")
_SECTION = re.compile(r"^(?:\d+|[A-Z])\.\d+$")


def contents_text(doc: pymupdf.Document, first_page: int, last_page: int) -> str:
    """The printed CONTENTS (1-based PDF pages, inclusive) as one whitespace-collapsed string."""
    return re.sub(r"\s+", " ", " ".join(doc[i].get_text() for i in range(first_page - 1, last_page)))


def contents_title(contents: str, token: str, book_page: int) -> Optional[str]:
    """The title printed after `token` in the CONTENTS, or None unless that entry's page is `book_page`."""
    m = re.search(rf"(?<!\S){re.escape(token)} (.+?) (\d{{1,4}})(?= |$)", contents)
    if not m or int(m.group(2)) != book_page:
        return None
    return unicodedata.normalize("NFKC", m.group(1)).strip()


def entries_from_pdf(
    doc: pymupdf.Document,
    *,
    offset: int,
    contents_pages: Tuple[int, int],
    chapter_titles: Dict[str, str],
    back_matter_titles: Dict[str, str],
) -> Tuple[List[dict], List[str]]:
    """build_outline() entries from the bookmarks, titled from the printed CONTENTS.

    Level-1 bookmarks give the chapters (token = first word, title from chapter_titles) and the
    back matter (upper-cased bookmark title -> back_matter_titles). Level-2 bookmarks whose first
    word is a section token give the sections. Pages are book pages (bookmark page - offset).
    A section whose CONTENTS entry is missing, or prints another page, is reported as a problem
    and kept under its bookmark title, so the human pass sees it.
    """
    contents = contents_text(doc, *contents_pages)
    entries: List[dict] = []
    problems: List[str] = []
    for level, raw_title, pdf_page in doc.get_toc():
        title = raw_title.strip()
        token, _, rest = title.partition(" ")
        page = pdf_page - offset
        if level == 1 and token in chapter_titles and _CHAPTER.match(token):
            entries.append({"kind": "chapter", "token": token, "title": chapter_titles[token], "page": page})
        elif level == 1 and title.upper() in back_matter_titles:
            entries.append({"kind": "back_matter", "token": None, "title": back_matter_titles[title.upper()], "page": page})
        elif level == 2 and _SECTION.match(token):
            printed = contents_title(contents, token, page)
            if printed is None:
                problems.append(f"{title!r}: no CONTENTS entry '{token} … {page}'")
                printed = rest.strip() or title
            entries.append({"kind": "section", "token": token, "title": printed, "page": page})
    missing = sorted(set(chapter_titles) - {e["token"] for e in entries if e["kind"] == "chapter"})
    if missing:
        problems.append(f"no level-1 bookmark for chapter(s) {missing}")
    return entries, problems


def build_outline(
    entries: List[dict], *, last_chapter_end: int, back_matter_end: Optional[int] = None
) -> Tuple[Dict[str, dict], List[dict]]:
    chapters: List[list] = []  # [token, title, start, [[token, title, start], ...]]
    back: List[list] = []      # [title, start]
    dropped: List[dict] = []
    for e in entries:
        kind = e.get("kind")
        token = str(e.get("token") or "").strip()
        title = str(e.get("title") or "").strip()
        page = e.get("page")
        if not isinstance(page, int) or not title:
            dropped.append(e)
        elif kind == "chapter" and _CHAPTER.match(token):
            if chapters and chapters[-1][0] == token:
                continue  # a TOC page repeating its running chapter
            chapters.append([token, title, page, []])
        elif kind == "section" and _SECTION.match(token) and chapters and token.split(".")[0] == chapters[-1][0]:
            if any(s[0] == token for s in chapters[-1][3]):
                continue
            chapters[-1][3].append([token, title, page])
        elif kind == "back_matter":
            back.append([title, page])
        else:
            dropped.append(e)

    outline: Dict[str, dict] = {}
    for i, (token, title, start, sections) in enumerate(chapters):
        end = chapters[i + 1][2] - 1 if i + 1 < len(chapters) else last_chapter_end
        node: Dict[str, dict] = {"_range": {"start": start, "end": end}}
        for j, (stoken, stitle, sstart) in enumerate(sections):
            nxt = sections[j + 1][2] if j + 1 < len(sections) else end + 1
            node[f"{stoken} {stitle}"] = {"start": sstart, "end": max(sstart, nxt - 1)}
        outline[f"{token} {title}"] = node
    for k, (title, start) in enumerate(back):
        end = back[k + 1][1] - 1 if k + 1 < len(back) else back_matter_end
        outline[title] = {"_range": {"start": start, "end": end}}
    return outline, dropped


def validate_outline(
    outline: Dict[str, dict],
    *,
    chapter_starts: Dict[str, int],
    last_chapter_end: int,
    back_matter: List[Tuple[str, int]],
) -> List[str]:
    problems: List[str] = []
    chapters = [(k, v) for k, v in outline.items() if _CHAPTER.match(k.split(" ", 1)[0])]
    tokens = [k.split(" ", 1)[0] for k, _ in chapters]
    if tokens != list(chapter_starts):
        problems.append(f"chapter tokens {tokens} != expected {list(chapter_starts)}")
    previous = None
    for key, node in chapters:
        token = key.split(" ", 1)[0]
        start = node.get("_range", {}).get("start")
        end = node.get("_range", {}).get("end")
        if token in chapter_starts and start != chapter_starts[token]:
            problems.append(f"{key}: starts at {start}, the TOC says {chapter_starts[token]}")
        if previous is not None and not (isinstance(start, int) and start > previous):
            problems.append(f"{key}: start {start} is not after the previous chapter's {previous}")
        previous = start
        sections = [(k, v) for k, v in node.items() if k != "_range"]
        if not sections:
            problems.append(f"{key}: no sections")
        last_start = None
        for skey, snode in sections:
            s, e = snode.get("start"), snode.get("end")
            if not skey.startswith(token + "."):
                problems.append(f"{skey}: not a section of chapter {token}")
            ints = all(isinstance(v, int) for v in (s, e, start, end))
            if not (ints and start <= s <= e <= end):
                problems.append(f"{skey}: pages {s}-{e} fall outside {key} ({start}-{end})")
            if last_start is not None and isinstance(s, int) and s < last_start:
                problems.append(f"{skey}: starts before the previous section")
            if isinstance(s, int):
                last_start = s
    if chapters:
        last_end = chapters[-1][1].get("_range", {}).get("end")
        if last_end != last_chapter_end:
            problems.append(f"the last chapter ends at {last_end}, expected {last_chapter_end}")
    for title, start in back_matter:
        node = outline.get(title)
        if not isinstance(node, dict) or node.get("_range", {}).get("start") != start:
            problems.append(f"back matter {title!r} should start at {start}")
    return problems


def review_markdown(outline: Dict[str, dict]) -> str:
    lines = [
        "# Lathi outline review",
        "",
        "Check every title and start page against the book's printed CONTENTS.",
        "",
        "| entry | start | end |",
        "|---|---:|---:|",
    ]
    for key, node in outline.items():
        r = node.get("_range", {})
        lines.append(f"| **{key}** | {r.get('start')} | {r.get('end')} |")
        for skey, snode in node.items():
            if skey != "_range":
                lines.append(f"| &nbsp;&nbsp;{skey} | {snode.get('start')} | {snode.get('end')} |")
    return "\n".join(lines) + "\n"
