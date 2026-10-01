"""The Lathi outline: bookmarks + printed CONTENTS -> a FOCS-shaped outline, and the gates."""

import pymupdf

from book_pipeline import outline as S3

ENTRIES = [
    {"kind": "chapter", "token": "B", "title": "Background", "page": 1},
    {"kind": "section", "token": "B.1", "title": "Complex Numbers", "page": 1},
    {"kind": "section", "token": "B.2", "title": "Sinusoids", "page": 16},
    {"kind": "section", "token": "B.3", "title": "Sketching Signals", "page": 20},
    {"kind": "chapter", "token": "1", "title": "Introduction to Signals and Systems", "page": 51},
    {"kind": "section", "token": "1.1", "title": "Size of a Signal", "page": 51},
    {"kind": "section", "token": "1.2", "title": "Classification of Signals", "page": 51},
    {"kind": "back_matter", "token": None, "title": "Answers to Selected Problems", "page": 60},
    {"kind": "back_matter", "token": None, "title": "Index", "page": 66},
]
STARTS = {"B": 1, "1": 51}
BACK = [("Answers to Selected Problems", 60), ("Index", 66)]

CHAPTERS = {"B": "Background", "1": "Signals and Systems"}
BACK_TITLES = {"INDEX": "Index"}
GOOD_CONTENTS = (
    "CONTENTS B BACKGROUND B.1 Complex Numbers 1 B.1-1 A Historical Note 1 "
    "B.2 MATLAB: Elementary Operations 3 1 SIGNALS AND SYSTEMS 1.1 Size of a Signal x(t) 5 Index 8"
)


def _toc_book(tmp_path, contents):
    """A 12-page PDF whose page 2 prints `contents`, with bookmarks at offset 3:
    B at pdf 4 (book 1), chapter 1 at pdf 8 (book 5), the index at pdf 11 (book 8)."""
    doc = pymupdf.open()
    for _ in range(12):
        doc.new_page(width=300, height=400)
    doc[1].insert_textbox(pymupdf.Rect(20, 20, 280, 380), contents, fontsize=8)
    doc.set_toc([
        [1, "CONTENTS", 2],
        [1, "B BACKGROUND", 4],
        [2, "B.1 COMPLEX NUMBERS", 4],
        [3, "B.1-1 A Historical Note", 4],
        [2, "B.2 MATLAB: ELEMENTARY OPERATIONS", 6],
        [1, "1 SIGNALS AND SYSTEMS", 8],
        [2, "1.1 SIZE OF A SIGNAL x(t)", 8],
        [2, "PROBLEMS", 9],
        [1, "INDEX", 11],
    ])
    path = tmp_path / "toc.pdf"
    doc.save(path)
    return pymupdf.open(path)


def _entries(doc, chapter_titles=CHAPTERS):
    return S3.entries_from_pdf(
        doc, offset=3, contents_pages=(2, 2), chapter_titles=chapter_titles, back_matter_titles=BACK_TITLES
    )


def test_contents_title_matches_the_exact_token_and_page():
    text = ("B.1 Complex Numbers 1 B.1-1 A Historical Note 1 B.12 Something Else 40 "
            "9.6 Generalization of the DTFT to the z-Transform 905")
    assert S3.contents_title(text, "B.1", 1) == "Complex Numbers"
    assert S3.contents_title(text, "B.1", 2) is None          # the printed page disagrees
    assert S3.contents_title(text, "B.12", 40) == "Something Else"
    assert S3.contents_title(text, "9.6", 905) == "Generalization of the DTFT to the z-Transform"
    assert S3.contents_title(text, "B.3", 7) is None          # not printed at all


def test_contents_titles_fold_ligatures():
    assert S3.contents_title("1.3 Classiﬁcation of Signals 75 ", "1.3", 75) == "Classification of Signals"


def test_entries_take_structure_from_bookmarks_and_titles_from_the_contents(tmp_path):
    entries, problems = _entries(_toc_book(tmp_path, GOOD_CONTENTS))
    assert problems == []
    assert entries == [
        {"kind": "chapter", "token": "B", "title": "Background", "page": 1},
        {"kind": "section", "token": "B.1", "title": "Complex Numbers", "page": 1},
        {"kind": "section", "token": "B.2", "title": "MATLAB: Elementary Operations", "page": 3},
        {"kind": "chapter", "token": "1", "title": "Signals and Systems", "page": 5},
        {"kind": "section", "token": "1.1", "title": "Size of a Signal x(t)", "page": 5},
        {"kind": "back_matter", "token": None, "title": "Index", "page": 8},
    ]


def test_a_section_missing_from_the_contents_or_on_another_page_is_a_problem(tmp_path):
    contents = (GOOD_CONTENTS.replace("Elementary Operations 3", "Elementary Operations 4")
                .replace("1.1 Size of a Signal x(t) 5 ", ""))
    entries, problems = _entries(_toc_book(tmp_path, contents))
    assert len(problems) == 2 and "B.2" in problems[0] and "1.1" in problems[1]
    kept = {e["token"]: e["title"] for e in entries if e["kind"] == "section"}
    assert kept["B.2"] == "MATLAB: ELEMENTARY OPERATIONS" and kept["1.1"] == "SIZE OF A SIGNAL x(t)"


def test_a_chapter_without_a_bookmark_is_a_problem(tmp_path):
    _, problems = _entries(_toc_book(tmp_path, GOOD_CONTENTS), chapter_titles={**CHAPTERS, "2": "Two"})
    assert problems == ["no level-1 bookmark for chapter(s) ['2']"]


def test_bookmarks_and_contents_build_a_valid_outline(tmp_path):
    entries, _ = _entries(_toc_book(tmp_path, GOOD_CONTENTS))
    outline, dropped = S3.build_outline(entries, last_chapter_end=7)
    assert dropped == []
    assert S3.validate_outline(outline, chapter_starts={"B": 1, "1": 5}, last_chapter_end=7, back_matter=[("Index", 8)]) == []
    assert outline["1 Signals and Systems"] == {
        "_range": {"start": 5, "end": 7},
        "1.1 Size of a Signal x(t)": {"start": 5, "end": 7},
    }
    assert outline["Index"] == {"_range": {"start": 8, "end": None}}


def test_build_outline_matches_the_focs_shape():
    outline, dropped = S3.build_outline(ENTRIES, last_chapter_end=59)
    assert dropped == []
    assert outline == {
        "B Background": {
            "_range": {"start": 1, "end": 50},
            "B.1 Complex Numbers": {"start": 1, "end": 15},
            "B.2 Sinusoids": {"start": 16, "end": 19},
            "B.3 Sketching Signals": {"start": 20, "end": 50},
        },
        "1 Introduction to Signals and Systems": {
            "_range": {"start": 51, "end": 59},
            "1.1 Size of a Signal": {"start": 51, "end": 51},
            "1.2 Classification of Signals": {"start": 51, "end": 59},
        },
        "Answers to Selected Problems": {"_range": {"start": 60, "end": 65}},
        "Index": {"_range": {"start": 66, "end": None}},
    }


def test_build_outline_drops_bad_entries_and_merges_repeats():
    entries = ENTRIES[:4] + [
        {"kind": "section", "token": "B.3-1", "title": "A sub-subsection", "page": 21},
        {"kind": "chapter", "token": "B", "title": "Background", "page": 1},       # repeated running chapter
        {"kind": "section", "token": "B.2", "title": "Sinusoids", "page": 16},     # repeated section
        {"kind": "section", "token": "3.1", "title": "Misplaced", "page": 30},
        {"kind": "chapter", "token": "Answers", "title": "to Selected Problems", "page": 837},
        {"kind": "section", "token": "B.4", "title": "No page"},
    ]
    outline, dropped = S3.build_outline(entries, last_chapter_end=50)
    assert list(outline) == ["B Background"]
    assert [k for k in outline["B Background"] if k != "_range"] == [
        "B.1 Complex Numbers", "B.2 Sinusoids", "B.3 Sketching Signals"
    ]
    assert [d.get("token") for d in dropped] == ["B.3-1", "3.1", "Answers", "B.4"]


def test_validate_accepts_a_good_outline():
    outline, _ = S3.build_outline(ENTRIES, last_chapter_end=59)
    assert S3.validate_outline(outline, chapter_starts=STARTS, last_chapter_end=59, back_matter=BACK) == []


def test_validate_reports_each_problem_class():
    outline, _ = S3.build_outline(ENTRIES, last_chapter_end=59)
    outline["1 Introduction to Signals and Systems"]["_range"]["start"] = 52
    outline["1 Introduction to Signals and Systems"]["_range"]["end"] = 58
    outline["B Background"]["B.2 Sinusoids"] = {"start": 16, "end": 70}
    del outline["Index"]
    joined = "\n".join(S3.validate_outline(outline, chapter_starts=STARTS, last_chapter_end=59, back_matter=BACK))
    assert "starts at 52" in joined
    assert "B.2 Sinusoids" in joined
    assert "'Index'" in joined
    assert "ends at 58" in joined


def test_validate_catches_missing_chapters_and_empty_chapters():
    problems = S3.validate_outline(
        {"B Background": {"_range": {"start": 1, "end": 59}}},
        chapter_starts=STARTS, last_chapter_end=59, back_matter=[],
    )
    assert any("chapter tokens" in p for p in problems) and any("no sections" in p for p in problems)


def test_review_markdown_lists_every_section_with_its_pages():
    outline, _ = S3.build_outline(ENTRIES, last_chapter_end=59)
    md = S3.review_markdown(outline)
    assert "| **B Background** | 1 | 50 |" in md
    assert "B.3 Sketching Signals | 20 | 50 |" in md
