"""Unit tests for feedback.py: validation, issue formatting, delivery and the rate limiter.

Run from backend/: pytest test_feedback.py --ignore=test_output.txt
"""

import json
import urllib.error
import urllib.request
from datetime import datetime, timezone

import pytest
from pydantic import ValidationError

import database
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


# === Task 2: delivery =========================================================

TOKEN = "github_pat_test_secret_123"
REPO = "lius24/ai-tutor-feedback"


@pytest.fixture
def github_env(monkeypatch):
    monkeypatch.setenv("FEEDBACK_GITHUB_TOKEN", TOKEN)
    monkeypatch.setenv("FEEDBACK_GITHUB_REPO", REPO)


class FakeResponse:
    def __init__(self, status, body):
        self.status = status
        self._body = body

    def read(self):
        return self._body

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


class FakeUrlopen:
    """Stands in for urllib.request.urlopen: records each request and plays back outcomes in order."""

    def __init__(self, *outcomes):
        self.outcomes = list(outcomes)
        self.requests = []

    def __call__(self, request, timeout=None):
        self.requests.append((request, timeout))
        outcome = self.outcomes.pop(0)
        if isinstance(outcome, BaseException):
            raise outcome
        return outcome


def http_error(code):
    return urllib.error.HTTPError(f"https://api.github.com/repos/{REPO}/issues", code, "error", {}, None)


def sample_issue():
    return fb.Issue(title="[Bug] It broke", body="body text", labels=["type:bug", "book:lathi"])


class FakeCollection:
    def __init__(self, error=None):
        self.docs = []
        self.error = error

    def insert_one(self, doc):
        if self.error:
            raise self.error
        self.docs.append(doc)


# --- configuration -----------------------------------------------------------

def test_github_config_needs_a_token_and_an_owner_name_repo(monkeypatch):
    monkeypatch.delenv("FEEDBACK_GITHUB_TOKEN", raising=False)
    monkeypatch.setenv("FEEDBACK_GITHUB_REPO", REPO)
    assert fb.github_config() is None
    monkeypatch.setenv("FEEDBACK_GITHUB_TOKEN", TOKEN)
    assert fb.github_config() == (TOKEN, REPO)
    for bad in ("", "no-slash", "a/b/c", "../etc/passwd", "owner/name?x=1"):
        monkeypatch.setenv("FEEDBACK_GITHUB_REPO", bad)
        assert fb.github_config() is None, bad


# --- GitHub client -----------------------------------------------------------

def test_create_github_issue_sends_the_documented_request(github_env, monkeypatch):
    urlopen = FakeUrlopen(FakeResponse(201, json.dumps({"number": 12}).encode()))
    monkeypatch.setattr(urllib.request, "urlopen", urlopen)

    assert fb.create_github_issue(sample_issue()) == 12

    request, timeout = urlopen.requests[0]
    assert request.full_url == f"https://api.github.com/repos/{REPO}/issues"
    assert request.get_method() == "POST"
    assert {k.lower(): v for k, v in request.header_items()} == {
        "authorization": f"Bearer {TOKEN}",
        "accept": "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
        "user-agent": "ai-tutor-feedback",
        "content-type": "application/json",
    }
    assert json.loads(request.data) == {
        "title": "[Bug] It broke",
        "body": "body text",
        "labels": ["type:bug", "book:lathi"],
    }
    assert timeout == 10


def test_created_issue_with_unreadable_reply_still_counts(github_env, monkeypatch):
    monkeypatch.setattr(urllib.request, "urlopen", FakeUrlopen(FakeResponse(201, b"<html>oops")))
    assert fb.create_github_issue(sample_issue()) is None


def test_a_rejected_label_is_retried_once_without_labels(github_env, monkeypatch):
    urlopen = FakeUrlopen(http_error(422), FakeResponse(201, b'{"number": 13}'))
    monkeypatch.setattr(urllib.request, "urlopen", urlopen)

    assert fb.create_github_issue(sample_issue()) == 13
    assert [json.loads(r.data) for r, _ in urlopen.requests] == [
        {"title": "[Bug] It broke", "body": "body text", "labels": ["type:bug", "book:lathi"]},
        {"title": "[Bug] It broke", "body": "body text"},
    ]


def test_a_second_422_is_a_delivery_error(github_env, monkeypatch):
    monkeypatch.setattr(urllib.request, "urlopen", FakeUrlopen(http_error(422), http_error(422)))
    with pytest.raises(fb.FeedbackDeliveryError, match="^HTTP 422$"):
        fb.create_github_issue(sample_issue())


@pytest.mark.parametrize(
    "outcome, message",
    [
        (http_error(500), "HTTP 500"),
        (http_error(401), "HTTP 401"),
        (urllib.error.URLError("no route"), "URLError"),
        (TimeoutError("timed out"), "TimeoutError"),
        (FakeResponse(200, b"{}"), "HTTP 200"),
    ],
)
def test_failures_become_short_delivery_errors_without_the_token(github_env, monkeypatch, outcome, message):
    monkeypatch.setattr(urllib.request, "urlopen", FakeUrlopen(outcome))
    with pytest.raises(fb.FeedbackDeliveryError) as excinfo:
        fb.create_github_issue(sample_issue())
    assert str(excinfo.value) == message
    assert TOKEN not in repr(excinfo.value)


def test_missing_configuration_never_calls_github(monkeypatch):
    monkeypatch.delenv("FEEDBACK_GITHUB_TOKEN", raising=False)
    urlopen = FakeUrlopen()
    monkeypatch.setattr(urllib.request, "urlopen", urlopen)
    with pytest.raises(fb.FeedbackDeliveryError, match="^not configured$"):
        fb.create_github_issue(sample_issue())
    assert urlopen.requests == []


# --- MongoDB fallback --------------------------------------------------------

def test_store_pending_keeps_a_ready_to_file_record(monkeypatch):
    collection = FakeCollection()
    monkeypatch.setattr(database, "feedback", lambda: collection)
    req = make_request(context={"book_id": "lathi", "page": 170})
    issue = build_issue(req, "student@example.com", "Mozilla/5.0 Test", NOW)

    fb.store_pending(issue, req, "student@example.com", "Mozilla/5.0 Test", "HTTP 502", NOW)

    assert collection.docs == [{
        "created_at": NOW,
        "type": "content",
        "title": issue.title,
        "body": issue.body,
        "labels": ["type:content", "book:lathi"],
        "reporter_ref": "66048931",
        "contact_email": None,
        "context": {"book_id": "lathi", "page": 170},
        "user_agent": "Mozilla/5.0 Test",
        "status": "pending",
        "github_error": "HTTP 502",
    }]


def test_store_pending_keeps_the_email_only_with_consent(monkeypatch):
    collection = FakeCollection()
    monkeypatch.setattr(database, "feedback", lambda: collection)
    req = make_request(contact_ok=True)
    issue = build_issue(req, "student@example.com", "", NOW)
    fb.store_pending(issue, req, "student@example.com", "", "HTTP 502", NOW)
    assert collection.docs[0]["contact_email"] == "student@example.com"


def test_store_pending_fails_without_mongodb(monkeypatch):
    monkeypatch.setattr(database, "feedback", lambda: None)
    req = make_request()
    with pytest.raises(fb.FeedbackStoreError, match="^not configured$"):
        fb.store_pending(build_issue(req, "a@b.com", "", NOW), req, "a@b.com", "", "HTTP 502", NOW)


def test_store_pending_turns_driver_errors_into_store_errors(monkeypatch):
    monkeypatch.setattr(database, "feedback", lambda: FakeCollection(error=RuntimeError("boom")))
    req = make_request()
    with pytest.raises(fb.FeedbackStoreError, match="^RuntimeError$"):
        fb.store_pending(build_issue(req, "a@b.com", "", NOW), req, "a@b.com", "", "HTTP 502", NOW)


# --- deliver -----------------------------------------------------------------

def _github_down(issue):
    raise fb.FeedbackDeliveryError("HTTP 502")


def test_deliver_files_the_issue_and_skips_the_fallback(monkeypatch, capsys):
    filed = []
    monkeypatch.setattr(fb, "create_github_issue", lambda issue: filed.append(issue) or 12)
    collection = FakeCollection()
    monkeypatch.setattr(database, "feedback", lambda: collection)

    assert fb.deliver(make_request(context={"book_id": "lathi"}), "student@example.com", "UA") is True
    assert [i.title for i in filed] == ["[Content] Page 170 shows the wrong figure."]
    assert collection.docs == []
    assert capsys.readouterr().out == "[Feedback] issue #12 created (type=content, book=lathi)\n"


def test_deliver_falls_back_to_mongodb(monkeypatch, capsys):
    monkeypatch.setattr(fb, "create_github_issue", _github_down)
    collection = FakeCollection()
    monkeypatch.setattr(database, "feedback", lambda: collection)

    assert fb.deliver(make_request(), "student@example.com", "UA") is True
    assert [d["github_error"] for d in collection.docs] == ["HTTP 502"]
    assert capsys.readouterr().out == "[Feedback] GitHub failed (HTTP 502); stored in MongoDB as pending\n"


def test_deliver_reports_failure_when_both_fail(monkeypatch, capsys):
    monkeypatch.setattr(fb, "create_github_issue", _github_down)
    monkeypatch.setattr(database, "feedback", lambda: None)

    assert fb.deliver(make_request(contact_ok=True), "student@example.com", "UA") is False
    assert capsys.readouterr().out == (
        "[Feedback] GitHub failed (HTTP 502) and MongoDB failed (not configured); returned 503\n"
    )


def test_deliver_logs_an_unknown_issue_number_as_a_question_mark(monkeypatch, capsys):
    monkeypatch.setattr(fb, "create_github_issue", lambda issue: None)
    assert fb.deliver(make_request(), "student@example.com", "UA") is True
    assert capsys.readouterr().out == "[Feedback] issue #? created (type=content, book=-)\n"


# --- startup log -------------------------------------------------------------

def test_log_config_status_names_the_repo_when_enabled(github_env, capsys):
    fb.log_config_status()
    assert capsys.readouterr().out == f"[Feedback] GitHub delivery enabled ({REPO})\n"


def test_log_config_status_when_disabled(monkeypatch, capsys):
    monkeypatch.delenv("FEEDBACK_GITHUB_TOKEN", raising=False)
    monkeypatch.delenv("FEEDBACK_GITHUB_REPO", raising=False)
    fb.log_config_status()
    assert capsys.readouterr().out == (
        "[Feedback] GitHub delivery disabled: FEEDBACK_GITHUB_TOKEN or FEEDBACK_GITHUB_REPO not set; "
        "feedback is stored in MongoDB only\n"
    )


def test_log_config_status_flags_a_malformed_repo(monkeypatch, capsys):
    monkeypatch.setenv("FEEDBACK_GITHUB_TOKEN", TOKEN)
    monkeypatch.setenv("FEEDBACK_GITHUB_REPO", "https://github.com/lius24/ai-tutor-feedback")
    fb.log_config_status()
    out = capsys.readouterr().out
    assert out == "[Feedback] GitHub delivery disabled: FEEDBACK_GITHUB_REPO must look like owner/name\n"
    assert TOKEN not in out
