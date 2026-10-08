"""Lettered sections, like "B.4" in Lathi's Background chapter, are read as those
sections, never as the numbered chapter after the dot."""

import learning_resources as lr
import student_bar_store as sbs


def _lathi_tokens():
    """Progress-bar token for each Lathi outline label ("B", "B.4", "2.4", ...)."""
    raw = lr.load_outline_dict("lathi", None)
    return {title.split()[0]: token for token, title in sbs._load_tree_token_map_from_raw(raw).items()}


def _say(message, book="lathi"):
    return sbs.update_bar_from_message_on_bar(sbs._empty_bar("s", book), message, book)


# --- the section a chat message names ---------------------------------------------


def test_a_typed_lettered_section_is_found_in_a_book_that_has_it():
    with lr.request_book("lathi", None):
        assert lr.extract_section_from_message("Can you explain B.4?") == "B.4"
        assert lr.extract_section_from_message("what is in section b.4") == "B.4"


def test_a_lettered_section_written_against_chinese_text_is_found():
    with lr.request_book("lathi", None):
        assert lr.extract_section_from_message("B.4是什么") == "B.4"
        assert lr.extract_section_from_message("讲讲B.4吧") == "B.4"
    t = _lathi_tokens()
    assert t["B.4"] in _say("B.4我学过了")["learned_sections"]


def test_the_section_named_first_wins():
    with lr.request_book("lathi", None):
        assert lr.extract_section_from_message("B.4 and 2.3") == "B.4"
        assert lr.extract_section_from_message("2.3 and B.4") == "2.3"


def test_a_lettered_label_with_no_such_section_is_passed_over():
    with lr.request_book("lathi", None):
        assert lr.extract_section_from_message("Z.9 then 2.3") == "2.3"


def test_books_without_lettered_sections_read_messages_as_before():
    with lr.request_book("focs", None):
        assert lr.extract_section_from_message("B.4 and 5.1") == "5.1"
        assert lr.extract_section_from_message("explain 5.1.2") == "5.1.2"
        assert lr.extract_section_from_message("chapter 5") == "5"


# --- the progress bar --------------------------------------------------------------


def test_saying_a_lettered_section_is_learned_marks_it_not_the_numbered_chapter():
    t = _lathi_tokens()
    bar = _say("B.4 我学过了")
    assert "4" not in bar["learned_sections"]
    assert {t["B"], t["B.1"], t["B.2"], t["B.3"], t["B.4"]} <= set(bar["learned_sections"])
    assert t["B.5"] not in bar["learned_sections"]
    assert bar["current_section"] == t["B.4"]


def test_confusion_about_a_lettered_section_is_counted_on_it():
    t = _lathi_tokens()
    assert _say("I'm confused about B.4")["confusion_counts"] == {t["B.4"]: 1}


def test_working_on_a_lettered_section_makes_it_current():
    t = _lathi_tokens()
    assert _say("I'm currently at b.4")["current_section"] == t["B.4"]


def test_numbered_sections_are_read_as_before():
    assert _say("I finished 5.3", "focs")["learned_sections"] == ["5", "5.1", "5.1.1", "5.1.2", "5.2", "5.3"]
    assert set(_say("我学过了 2.4")["learned_sections"]) == {"2", "2.1", "2.2", "2.3", "2.4"}


def test_the_file_backed_bar_reads_lettered_sections_too(tmp_path, monkeypatch):
    monkeypatch.setattr(sbs, "STUDENT_BAR_DIR", str(tmp_path))
    t = _lathi_tokens()
    bar = sbs.update_bar_from_message("guest_1", "B.4 我学过了", "lathi")
    assert t["B.4"] in bar["learned_sections"] and "4" not in bar["learned_sections"]
