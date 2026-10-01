"""verify: the page convention from printed folios, and every section start through the runtime paths."""

import pymupdf

from book_pipeline import verify as V

OUTLINE = {"1 One": {"_range": {"start": 1, "end": 4}, "1.1 A": {"start": 1, "end": 2}, "1.2 B": {"start": 3, "end": 4}}}
HEADINGS = {1: "1.1 A heading", 3: "1.2 B heading"}


def _book(path, pages, offset, *, no_folio=(), headings=None, landscape=(), blank=()):
    """PDF page i holds book page i - offset: a running head carrying its number, an optional
    heading, and body text."""
    doc = pymupdf.open()
    for pdf_page in range(1, pages + 1):
        book_page = pdf_page - offset
        w, h = (500, 300) if book_page in landscape else (300, 400)
        page = doc.new_page(width=w, height=h)
        if book_page in blank:
            continue
        if book_page >= 1 and book_page not in no_folio:
            page.insert_text((20, 20), f"Running head {book_page}", fontsize=8)
        heading = (headings or {}).get(book_page, "")
        page.insert_textbox(pymupdf.Rect(20, 40, w - 20, h - 20), heading + "\n" + "Body text of this page. " * 25, fontsize=8)
    doc.save(path)
    return path.read_bytes()


def test_the_folio_sweep_confirms_the_offset_and_rejects_a_wrong_one(tmp_path):
    pdf = _book(tmp_path / "b.pdf", 8, 2, headings=HEADINGS)
    good = V.folio_sweep(pdf, offset=2, first=1, last=6)
    assert good.confirmed == [1, 2, 3, 4, 5, 6] and good.coverage == 1.0
    bad = V.folio_sweep(pdf, offset=3, first=1, last=5)
    assert bad.confirmed == [] and bad.coverage == 0.0


def test_pages_without_a_printed_number_are_unconfirmed_not_errors(tmp_path):
    pdf = _book(tmp_path / "b.pdf", 8, 2, no_folio={3}, blank={5})
    rep = V.folio_sweep(pdf, offset=2, first=1, last=7)   # book page 7 would be pdf page 9: past the end
    assert rep.confirmed == [1, 2, 4, 6] and rep.unconfirmed == [3, 5, 7]
    assert round(rep.coverage, 3) == round(4 / 7, 3)


def test_sections_open_on_their_heading_in_portrait_with_text(tmp_path):
    pdf = _book(tmp_path / "b.pdf", 8, 2, headings=HEADINGS)
    rep = V.check_sections(pdf, OUTLINE, offset=2)
    assert rep.checked == 2
    assert rep.render_failed == [] and rep.landscape == [] and rep.missing_heading == [] and rep.thin_text == []


def test_section_problems_are_each_reported(tmp_path):
    pdf = _book(tmp_path / "b.pdf", 8, 2, headings={1: "1.1 A heading"}, landscape={1}, blank={3, 4})
    rep = V.check_sections(pdf, OUTLINE, offset=2)
    assert rep.landscape == [1]
    assert rep.missing_heading == ["1.2 B"]
    assert rep.thin_text == ["1.2 B"]


def test_the_gate_never_passes_vacuously_and_names_each_failure():
    ok = V.FolioReport(confirmed=list(range(1, 101)), coverage=1.0)
    assert V.gate(ok, V.SectionReport(checked=10)) == []
    assert any("no sections were checked" in p for p in V.gate(ok, V.SectionReport()))
    low = V.FolioReport(confirmed=list(range(1, 91)), unconfirmed=list(range(91, 101)), coverage=0.9)
    assert any("90.0%" in p for p in V.gate(low, V.SectionReport(checked=10)))
    bad = V.SectionReport(checked=10, render_failed=[3], landscape=[4], missing_heading=["2.1 X"], thin_text=["2.1 X"])
    assert len(V.gate(ok, bad)) == 4
