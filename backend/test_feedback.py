"""Unit tests for feedback.py: validation, issue formatting, delivery and the rate limiter.

Run from backend/: pytest test_feedback.py --ignore=test_output.txt
"""

from datetime import datetime, timezone

import pytest
from pydantic import ValidationError

import feedback as fb
from feedback import FeedbackContext, FeedbackRequest, build_issue, neutralize_mentions

NOW = datetime(2026, 10, 1, 14, 3, tzinfo=timezone.utc)
SECTION = "2.4 System Response to External Input: The Zero-State Response"


def make_request(**overrides):
    fields = {"type": "content", "description": "Page 170 shows the wrong figure."}
    fields.update(overrides)
    return FeedbackRequest(**fields)


# --- title -------------------------------------------------------------------

@pytest.mark.parametrize(
    "kind, tag",
    [("bug", "Bug"), ("content", "Content"), ("suggestion", "Suggestion"), ("other", "Other")],
)
def test_title_tags_each_type(kind, tag):
    issue = build_issue(make_request(type=kind, description="It broke"), "a@b.com", "", NOW)
    assert issue.title == f"[{tag}] It broke"


def test_title_collapses_whitespace():
    issue = build_issue(make_request(description="Line one\n\n  line two\tend"), "a@b.com", "", NOW)
    assert issue.title == "[Content] Line one line two end"


def test_title_keeps_a_60_character_summary_whole():
    issue = build_issue(make_request(description="a" * 60), "a@b.com", "", NOW)
    assert issue.title == "[Content] " + "a" * 60


def test_title_cuts_a_61_character_summary():
    issue = build_issue(make_request(description="a" * 61), "a@b.com", "", NOW)
    assert issue.title == "[Content] " + "a" * 60 + "…"


# --- mentions ----------------------------------------------------------------

def test_neutralize_mentions_breaks_user_and_team_mentions():
    assert neutralize_mentions("@alice and (@org/team)") == "@​alice and (@​org/team)"


def test_neutralize_mentions_leaves_email_addresses_alone():
    assert neutralize_mentions("write to a@b.com") == "write to a@b.com"


def test_mentions_in_every_user_field_are_neutralized():
    req = make_request(
        description="@alice look",
        context={"book_id": "@bob", "section": "@carol", "route": "/@dave"},
    )
    issue = build_issue(req, "student@example.com", "@erin-agent", NOW)
    assert "@alice" not in issue.title
    for name in ("alice", "bob", "carol", "dave", "erin"):
        assert f"@{name}" not in issue.body
        assert f"@​{name}" in issue.body


# --- body --------------------------------------------------------------------

def test_body_lists_the_context_and_hides_the_email_without_consent():
    req = make_request(
        context={"book_id": "lathi", "section": SECTION, "page": 170, "locale": "zh", "route": "/learning"},
    )
    issue = build_issue(req, "student@example.com", "Mozilla/5.0 Test", NOW)
    assert issue.body == "\n".join([
        "**Type:** Wrong page or content",
        "**Reporter:** anonymous #66048931",
        "",
        "### Description",
        "",
        "Page 170 shows the wrong figure.",
        "",
        "### Context",
        "",
        "| Field | Value |",
        "|---|---|",
        "| Course | Linear Systems and Signals (Lathi) (`lathi`) |",
        f"| Section | {SECTION} |",
        "| Page | 170 |",
        "| Language | zh |",
        "| Route | /learning |",
        "| Browser | Mozilla/5.0 Test |",
        "| Submitted | 2026-10-01 14:03 UTC |",
        "",
        "<sub>Sent from the AI Tutor feedback form.</sub>",
    ])


def test_body_shows_the_email_when_the_student_opted_in():
    issue = build_issue(make_request(contact_ok=True), "student@example.com", "", NOW)
    assert "**Reporter:** student@example.com" in issue.body
    assert "anonymous" not in issue.body


def test_reporter_code_is_stable_per_identity():
    # Hand-checked: sha256("ai-tutor-feedback:<email>") truncated to 8 hex digits.
    assert fb.reporter_ref("student@example.com") == "66048931"
    assert fb.reporter_ref("other@example.com") == "0266cd63"


def test_rows_without_a_value_are_left_out():
    issue = build_issue(make_request(), "student@example.com", "", NOW)
    table_rows = issue.body.split("|---|---|\n", 1)[1].split("\n\n", 1)[0]
    assert table_rows == "| Submitted | 2026-10-01 14:03 UTC |"


def test_table_cells_escape_pipes_and_newlines():
    issue = build_issue(make_request(context={"section": "A | B\nC"}), "a@b.com", "", NOW)
    assert "| Section | A \\| B C |" in issue.body


def test_user_agent_is_cut_to_300_characters():
    issue = build_issue(make_request(), "a@b.com", "x" * 400, NOW)
    assert f"| Browser | {'x' * 300} |" in issue.body


def test_course_row_for_an_uploaded_book_shows_just_the_id():
    issue = build_issue(make_request(context={"book_id": "user_abc"}), "a@b.com", "", NOW)
    assert "| Course | `user_abc` |" in issue.body


# --- labels ------------------------------------------------------------------

@pytest.mark.parametrize(
    "kind, book_id, labels",
    [
        ("content", "lathi", ["type:content", "book:lathi"]),
        ("bug", "focs", ["type:bug", "book:focs"]),
        ("bug", "user_abc", ["type:bug"]),
        ("other", None, ["type:other"]),
    ],
)
def test_labels(kind, book_id, labels):
    issue = build_issue(make_request(type=kind, context={"book_id": book_id}), "a@b.com", "", NOW)
    assert issue.labels == labels


# --- validation --------------------------------------------------------------

def test_description_is_cleaned_and_stripped():
    assert make_request(description="  \x00Hello\x07 world\n ").description == "Hello world"


def test_whitespace_only_description_is_rejected():
    with pytest.raises(ValidationError):
        make_request(description="  \n\t ")


def test_description_limit_counts_characters():
    assert len(make_request(description="字" * 2000).description) == 2000
    assert len(make_request(description="😀" * 1000).description) == 1000  # 2000 UTF-16 units in a browser
    with pytest.raises(ValidationError):
        make_request(description="字" * 2001)


def test_unknown_type_is_rejected():
    with pytest.raises(ValidationError):
        make_request(type="praise")


def test_context_is_trimmed_never_rejected():
    ctx = FeedbackContext(book_id="b" * 100, section="s" * 250, locale="zh-Hans-CN-x", route="/" + "r" * 300)
    assert (len(ctx.book_id), len(ctx.section), ctx.locale, len(ctx.route)) == (64, 200, "zh-Hans-CN", 200)


@pytest.mark.parametrize("page", [0, -3, 10001, "170", True, 1.5])
def test_bad_pages_are_dropped(page):
    assert FeedbackContext(page=page).page is None


def test_wrong_types_in_context_are_dropped():
    ctx = FeedbackContext(section=42, book_id=["lathi"])
    assert (ctx.section, ctx.book_id) == (None, None)


def test_missing_context_is_empty():
    assert make_request().context == FeedbackContext()
