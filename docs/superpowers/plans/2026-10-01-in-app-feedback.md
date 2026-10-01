# In-App Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Signed-in students can send feedback from the sidebar or the textbook panel. The backend files each report as an issue in a private GitHub repo, and falls back to MongoDB when GitHub fails.

**Architecture:**
- **Backend.** A new module, `backend/feedback.py`, owns validation, issue formatting, the GitHub client, the MongoDB fallback and the rate limiter. `POST /api/feedback` in `api_routes.py` only checks auth, applies the limiter and maps outcomes to HTTP statuses.
- **Frontend.** `frontend/src/feedback/` holds three pieces:
  - the API client;
  - a context that opens the dialog, or the sign-in modal for visitors who can't send feedback, and records where the student is;
  - the dialog.
- The sidebar and Learning Mode only add entry points.

**Tech Stack:**
- Backend: FastAPI 0.117, Pydantic 2.11, pymongo ≥ 4.6 and the standard library's `urllib`. Python 3.11 on Render; the local venv runs 3.13.
- Frontend: React 19, TypeScript 5.8, Vite, vitest 3 and Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-01-in-app-feedback-design.md`

## Global Constraints

**Where to work**
- Work in `/Users/vnerald/ai_tutor/.worktrees/feedback-window`, on branch `feat/feedback-window`.
- The branch sits on `fix/auth-token-refresh` (PR #34), which added the background token refresh to `frontend/src/context/AuthContext.tsx`.

**Dependencies and runtime**
- No new dependencies: the backend uses the standard library's `urllib`, and the frontend uses `fetch`.
- Backend code runs on Python 3.11 on Render. Use no syntax newer than 3.11, even though the local venv is 3.13.

**Running checks**
- Backend tests: from `backend/`, run `/Users/vnerald/ai_tutor/backend/.venv/bin/python -m pytest -q --ignore=test_output.txt [files]`.
  - `--ignore=test_output.txt` is mandatory: that tracked UTF-16 file breaks collection.
  - Baseline: 250 passed, 3 skipped.
- Frontend checks: from `frontend/`, run `npx tsc -b`, `npx vitest run` and `npm run build`. Baseline: 400 tests pass.
- Vitest's default environment is `node`. Component tests start with `// @vitest-environment jsdom`.
- Python monkeypatching replaces module attributes, so code must look these up through their modules at call time: `api_routes.verify_token`, `api_routes._feedback_limiter`, `database.feedback()`, `feedback.create_github_issue` and `urllib.request.urlopen`.

**Safety**
- Tests run offline and keyless. Never create `backend/.env` or `frontend/.env` in the worktree. Never call the real GitHub API or a real MongoDB from a test.
- The repo is public. Never commit a token, a real email address or a `backend/data/books/*/book.pdf`.

**Exact values from the spec**
- Description: 1–2000 characters, after control characters are removed and the text is stripped.
- Types: `bug`, `content`, `suggestion`, `other`.
- Rate limit: 5 accepted reports per identity per rolling 3600 s.
- Timeouts: GitHub 10 s, MongoDB insert 5 s, client 30 s. The sent state closes itself after 2.5 s.
- Lengths: the title summary is 60 characters and the User-Agent 300.
- Context limits: `book_id` 64, `section` 200, `locale` 10, `route` 200. `page` must be 1–10000.
- The dialog overlay's z-index is 999, one below `.signin-overlay` (1000).

**Copy:** UI strings are spec §3.5's values, verbatim. Task 7 has them as code.

**Commits** end with the trailer `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

## Spec amendments made with this plan

These are already applied to the spec.

1. **The 30 s timeout lives inside `submitFeedback`.** Its signature is `submitFeedback(token, payload, timeoutMs = SUBMIT_TIMEOUT_MS)`, with an internal `AbortController` instead of a caller-supplied signal.
2. **Shared frontend types go in `frontend/src/feedback/types.ts`.**
3. **A GitHub `201` whose body can't be parsed still counts as delivered.** `create_github_issue` returns `None`, and the log shows `#?`. The issue exists, so raising would also store it in the fallback as a duplicate.
4. **`log_config_status()` has a third line** for when both variables are set but `FEEDBACK_GITHUB_REPO` isn't `owner/name`.

**Known, not fixed here:** the "Report a problem" button reuses the Hide button's style. That grey text is 4.39:1 against its background, just under the 4.5:1 target. The palette work the team is discussing will fix both buttons.

## Review Focus

1. **A double-click on Send:** exactly one report goes out. Test: Task 7, `sends once when Send is clicked twice`.
2. **A section title, route or browser string containing `|`, a newline, a backtick or `@name`:** the issue table stays intact and nobody gets pinged. Tests: Task 1, `test_table_cells_escape_pipes_and_newlines` and `test_mentions_in_every_user_field_are_neutralized`.
3. **Emoji or CJK text at the length limit:** the server accepts everything the textarea allows. 1000 emoji are 2000 UTF-16 units but only 1000 characters. Test: Task 1, `test_description_limit_counts_characters`.
4. **A dead network while sending:** within 30 s the dialog shows the "unavailable" message and keeps the text. Tests: Task 5, `gives up after 30 seconds`, and Task 7, `shows each failure and keeps the text`.
5. **GitHub created the issue but its reply can't be read:** no duplicate lands in the fallback. Test: Task 2, `test_created_issue_with_unreadable_reply_still_counts`.

---

## File map

| File | Responsibility | Task |
|---|---|---|
| `backend/feedback.py` (new) | Request models, issue formatting, GitHub client, MongoDB fallback, `deliver()`, startup log, rate limiter | 1, 2, 3 |
| `backend/database.py` | `feedback()` collection accessor | 2 |
| `backend/api_routes.py` | `POST /api/feedback` and the module-level `_feedback_limiter` | 4 |
| `backend/main.py` | Calls `feedback.log_config_status()` at startup | 4 |
| `backend/test_feedback.py` (new) | Unit tests for `feedback.py` | 1, 2, 3 |
| `backend/test_feedback_api.py` (new) | Route tests through `TestClient` | 4 |
| `frontend/src/context/AuthContext.tsx` and its test | `getFreshToken()` | 5 |
| `frontend/src/feedback/types.ts` (new) | Shared types and constants | 5 |
| `frontend/src/feedback/feedbackApi.ts` and its test (new) | `submitFeedback()` | 5 |
| `frontend/src/feedback/FeedbackContext.tsx` and its test (new) | Provider, `useFeedback()`, sign-in gate, snapshot | 6 |
| `frontend/src/feedback/FeedbackModal.tsx`, `.css` and test (new) | The dialog | 7 |
| `frontend/src/i18n/messages.ts` | 24 new strings in each of the 3 locales | 7 |
| `frontend/src/main.tsx`, `frontend/src/App.tsx` | Mount the provider and the dialog | 7 |
| `frontend/src/components/Sidebar.tsx`, `Sidebar.css` | Feedback item | 8 |
| `frontend/src/LearningModel.tsx` | Report a problem button and page-context registration | 8 |

---

### Task 1: Request models and issue formatting

**Files:**
- Create: `backend/feedback.py`
- Create: `backend/test_feedback.py`

**Interfaces:**
- Consumes the existing `builtin_books.is_builtin(book_id) -> bool` and `builtin_books.load_meta(book_id) -> Optional[dict]`.
- Produces, for Tasks 2–4:
  - the Pydantic models `FeedbackContext` and `FeedbackRequest`;
  - `clean_text(text: str) -> str` and `neutralize_mentions(text: str) -> str`;
  - `reporter_ref(identity: str) -> str`;
  - `@dataclass class Issue` with fields `title: str`, `body: str`, `labels: list[str]`;
  - `build_issue(req: FeedbackRequest, identity: str, user_agent: str, now: datetime) -> Issue`;
  - the constants `MAX_DESCRIPTION_CHARS = 2000`, `USER_AGENT_CHARS = 300`, `TYPE_TAGS` and `TYPE_NAMES`.

- [ ] **Step 1: Write the failing tests**

Create `backend/test_feedback.py`:

```python
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `/Users/vnerald/ai_tutor/backend/.venv/bin/python -m pytest -q --ignore=test_output.txt test_feedback.py`
Expected: collection error, `ModuleNotFoundError: No module named 'feedback'`.

- [ ] **Step 3: Write the implementation**

Create `backend/feedback.py`:

```python
"""In-app feedback: validate a student's report, then file it as a GitHub issue.

The route in api_routes.py checks auth and the rate limit, then calls into this module.
Design: docs/superpowers/specs/2026-10-01-in-app-feedback-design.md
"""

import hashlib
import re
import unicodedata
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field, ValidationInfo, field_validator

import builtin_books as bb

MAX_DESCRIPTION_CHARS = 2000
SUMMARY_CHARS = 60
USER_AGENT_CHARS = 300
MAX_PAGE = 10000
CONTEXT_LIMITS = {"book_id": 64, "section": 200, "locale": 10, "route": 200}

TYPE_TAGS = {"bug": "Bug", "content": "Content", "suggestion": "Suggestion", "other": "Other"}
TYPE_NAMES = {
    "bug": "Something is broken",
    "content": "Wrong page or content",
    "suggestion": "Suggestion",
    "other": "Other",
}

# An @ that starts a word, which GitHub would turn into a notification.
_MENTION_RE = re.compile(r"(?<![A-Za-z0-9_])@(?=[A-Za-z0-9])")


def clean_text(text: str) -> str:
    """Drop control characters (Unicode category Cc) other than newline and tab."""
    return "".join(ch for ch in text if ch in "\n\t" or unicodedata.category(ch) != "Cc")


def neutralize_mentions(text: str) -> str:
    """Put a zero-width space after any @ that starts a word, so GitHub notifies nobody."""
    return _MENTION_RE.sub("@​", text)


class FeedbackContext(BaseModel):
    """Where the student was. Best-effort metadata: bad values are cut or dropped, never rejected."""

    book_id: Optional[str] = None
    section: Optional[str] = None
    page: Optional[int] = None
    locale: Optional[str] = None
    route: Optional[str] = None

    @field_validator("book_id", "section", "locale", "route", mode="before")
    @classmethod
    def _clip_text(cls, value: Any, info: ValidationInfo) -> Optional[str]:
        if not isinstance(value, str):
            return None
        return clean_text(value).strip()[: CONTEXT_LIMITS[info.field_name]] or None

    @field_validator("page", mode="before")
    @classmethod
    def _check_page(cls, value: Any) -> Optional[int]:
        if isinstance(value, bool) or not isinstance(value, int):
            return None
        return value if 1 <= value <= MAX_PAGE else None


class FeedbackRequest(BaseModel):
    type: Literal["bug", "content", "suggestion", "other"]
    description: str
    contact_ok: bool = False
    context: FeedbackContext = Field(default_factory=FeedbackContext)

    @field_validator("description")
    @classmethod
    def _check_description(cls, value: str) -> str:
        cleaned = clean_text(value).strip()
        if not cleaned:
            raise ValueError("description is empty")
        if len(cleaned) > MAX_DESCRIPTION_CHARS:
            raise ValueError(f"description is longer than {MAX_DESCRIPTION_CHARS} characters")
        return cleaned


@dataclass
class Issue:
    title: str
    body: str
    labels: list[str]


def reporter_ref(identity: str) -> str:
    """A short code that is the same for every report from one person, without saying who."""
    return hashlib.sha256(f"ai-tutor-feedback:{identity}".encode("utf-8")).hexdigest()[:8]


def _summary(description: str) -> str:
    flat = " ".join(description.split())
    return flat if len(flat) <= SUMMARY_CHARS else flat[:SUMMARY_CHARS] + "…"


def _cell(value: str) -> str:
    one_line = value.replace("\r", " ").replace("\n", " ").replace("|", "\\|")
    return neutralize_mentions(one_line)


def _course(book_id: str) -> str:
    meta = bb.load_meta(book_id) if bb.is_builtin(book_id) else None
    name = (meta or {}).get("display_name")
    return f"{name} (`{book_id}`)" if name else f"`{book_id}`"


def build_issue(req: FeedbackRequest, identity: str, user_agent: str, now: datetime) -> Issue:
    ctx = req.context
    rows: list[tuple[str, str]] = []
    if ctx.book_id:
        rows.append(("Course", _course(ctx.book_id)))
    if ctx.section:
        rows.append(("Section", ctx.section))
    if ctx.page is not None:
        rows.append(("Page", str(ctx.page)))
    if ctx.locale:
        rows.append(("Language", ctx.locale))
    if ctx.route:
        rows.append(("Route", ctx.route))
    browser = clean_text(user_agent).strip()[:USER_AGENT_CHARS]
    if browser:
        rows.append(("Browser", browser))
    rows.append(("Submitted", now.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")))

    reporter = identity if req.contact_ok else f"anonymous #{reporter_ref(identity)}"
    body = "\n".join([
        f"**Type:** {TYPE_NAMES[req.type]}",
        f"**Reporter:** {reporter}",
        "",
        "### Description",
        "",
        neutralize_mentions(req.description),
        "",
        "### Context",
        "",
        "| Field | Value |",
        "|---|---|",
        *(f"| {name} | {_cell(value)} |" for name, value in rows),
        "",
        "<sub>Sent from the AI Tutor feedback form.</sub>",
    ])
    labels = [f"type:{req.type}"]
    if ctx.book_id and bb.is_builtin(ctx.book_id):
        labels.append(f"book:{ctx.book_id}")
    title = neutralize_mentions(f"[{TYPE_TAGS[req.type]}] {_summary(req.description)}")
    return Issue(title=title, body=body, labels=labels)
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `/Users/vnerald/ai_tutor/backend/.venv/bin/python -m pytest -q --ignore=test_output.txt test_feedback.py`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add backend/feedback.py backend/test_feedback.py
git commit -m "feat(feedback): validate reports and format them as GitHub issues

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Delivery: GitHub client, MongoDB fallback, `deliver()`, startup log

**Files:**
- Modify: `backend/feedback.py` (imports, then append)
- Modify: `backend/database.py` (append `feedback()`)
- Modify: `backend/test_feedback.py` (imports, then append)

**Interfaces:**
- Consumes, from Task 1: `FeedbackRequest`, `Issue`, `build_issue`, `reporter_ref`, `clean_text` and `USER_AGENT_CHARS`.
- Produces, for Task 4:
  - `class FeedbackDeliveryError(Exception)` and `class FeedbackStoreError(Exception)`;
  - `github_config() -> Optional[tuple[str, str]]`, returning `(token, repo)`;
  - `create_github_issue(issue: Issue) -> Optional[int]`;
  - `store_pending(issue: Issue, req: FeedbackRequest, identity: str, user_agent: str, github_error: str, now: datetime) -> None`;
  - `deliver(req: FeedbackRequest, identity: str, user_agent: str) -> bool`, which returns False only when GitHub and MongoDB both fail;
  - `log_config_status() -> None`;
  - `database.feedback()`, which returns the collection or None.

- [ ] **Step 1: Write the failing tests**

Add to the imports at the top of `backend/test_feedback.py`:

```python
import json
import urllib.error
import urllib.request

import database
```

Append to `backend/test_feedback.py`:

```python
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `/Users/vnerald/ai_tutor/backend/.venv/bin/python -m pytest -q --ignore=test_output.txt test_feedback.py`
Expected: the Task 2 tests fail. They raise `AttributeError` for `github_config`, `create_github_issue`, `FeedbackDeliveryError` and `database.feedback`. The Task 1 tests still pass.

- [ ] **Step 3: Write the implementation**

In `backend/feedback.py`, replace the import block at the top with:

```python
import hashlib
import http.client
import json
import os
import re
import unicodedata
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Literal, Optional

import pymongo
from pydantic import BaseModel, Field, ValidationInfo, field_validator

import builtin_books as bb
import database
```

Append to `backend/feedback.py`:

```python
# --- delivery ----------------------------------------------------------------

GITHUB_API = "https://api.github.com"
GITHUB_TIMEOUT_SECONDS = 10
MONGO_TIMEOUT_SECONDS = 5
_REPO_RE = re.compile(r"[A-Za-z0-9-]+/[A-Za-z0-9._-]+")


class FeedbackDeliveryError(Exception):
    """GitHub didn't take the issue. The message is short and never contains the token."""


class FeedbackStoreError(Exception):
    """The MongoDB fallback didn't take the report."""


def _github_env() -> tuple[str, str]:
    token = (os.getenv("FEEDBACK_GITHUB_TOKEN") or "").strip()
    repo = (os.getenv("FEEDBACK_GITHUB_REPO") or "").strip()
    return token, repo


def github_config() -> Optional[tuple[str, str]]:
    """(token, repo) when GitHub delivery is configured, else None. Read at call time."""
    token, repo = _github_env()
    if not token or not _REPO_RE.fullmatch(repo):
        return None
    return token, repo


def _post_issue(token: str, repo: str, payload: dict[str, Any]) -> Optional[int]:
    request = urllib.request.Request(
        f"{GITHUB_API}/repos/{repo}/issues",
        data=json.dumps(payload).encode("utf-8"),
        method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "ai-tutor-feedback",
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(request, timeout=GITHUB_TIMEOUT_SECONDS) as response:
        if response.status != 201:
            raise FeedbackDeliveryError(f"HTTP {response.status}")
        raw = response.read()
    try:
        number = json.loads(raw)["number"]
    except (ValueError, KeyError, TypeError):
        return None  # The issue exists; we just can't tell its number.
    return number if isinstance(number, int) else None


def create_github_issue(issue: Issue) -> Optional[int]:
    """File the issue. Returns its number, or None if GitHub's reply couldn't be read."""
    config = github_config()
    if config is None:
        raise FeedbackDeliveryError("not configured")
    token, repo = config
    payload = {"title": issue.title, "body": issue.body, "labels": issue.labels}
    try:
        try:
            return _post_issue(token, repo, payload)
        except urllib.error.HTTPError as err:
            if err.code != 422:
                raise
        # 422: GitHub rejected part of the issue, usually a label. Send it once more without labels.
        return _post_issue(token, repo, {"title": issue.title, "body": issue.body})
    except FeedbackDeliveryError:
        raise
    except urllib.error.HTTPError as err:
        raise FeedbackDeliveryError(f"HTTP {err.code}") from None
    except (OSError, http.client.HTTPException) as err:
        raise FeedbackDeliveryError(type(err).__name__) from None


def store_pending(
    issue: Issue, req: FeedbackRequest, identity: str, user_agent: str, github_error: str, now: datetime,
) -> None:
    """Keep a report GitHub didn't take, ready to be filed by hand. Raises FeedbackStoreError."""
    collection = database.feedback()
    if collection is None:
        raise FeedbackStoreError("not configured")
    doc = {
        "created_at": now,
        "type": req.type,
        "title": issue.title,
        "body": issue.body,
        "labels": list(issue.labels),
        "reporter_ref": reporter_ref(identity),
        "contact_email": identity if req.contact_ok else None,
        "context": req.context.model_dump(exclude_none=True),
        "user_agent": clean_text(user_agent).strip()[:USER_AGENT_CHARS],
        "status": "pending",
        "github_error": github_error,
    }
    try:
        with pymongo.timeout(MONGO_TIMEOUT_SECONDS):
            collection.insert_one(doc)
    except Exception as err:  # any driver failure means the fallback failed
        raise FeedbackStoreError(type(err).__name__) from None


def deliver(req: FeedbackRequest, identity: str, user_agent: str) -> bool:
    """File the report on GitHub, or else store it in MongoDB. False only when both fail."""
    now = datetime.now(timezone.utc)
    issue = build_issue(req, identity, user_agent, now)
    book = req.context.book_id or "-"
    try:
        number = create_github_issue(issue)
    except FeedbackDeliveryError as err:
        github_error = str(err)
    else:
        shown = "?" if number is None else number
        print(f"[Feedback] issue #{shown} created (type={req.type}, book={book})", flush=True)
        return True
    try:
        store_pending(issue, req, identity, user_agent, github_error, now)
    except FeedbackStoreError as err:
        print(f"[Feedback] GitHub failed ({github_error}) and MongoDB failed ({err}); returned 503", flush=True)
        return False
    print(f"[Feedback] GitHub failed ({github_error}); stored in MongoDB as pending", flush=True)
    return True


def log_config_status() -> None:
    """One startup line saying whether reports go to GitHub. Never prints the token."""
    token, repo = _github_env()
    if token and _REPO_RE.fullmatch(repo):
        print(f"[Feedback] GitHub delivery enabled ({repo})", flush=True)
    elif token and repo:
        print("[Feedback] GitHub delivery disabled: FEEDBACK_GITHUB_REPO must look like owner/name", flush=True)
    else:
        print(
            "[Feedback] GitHub delivery disabled: FEEDBACK_GITHUB_TOKEN or FEEDBACK_GITHUB_REPO not set; "
            "feedback is stored in MongoDB only",
            flush=True,
        )
```

Append to `backend/database.py`:

```python
def feedback():
    """Return the feedback collection, or None."""
    return _db["feedback"] if _db is not None else None
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `/Users/vnerald/ai_tutor/backend/.venv/bin/python -m pytest -q --ignore=test_output.txt test_feedback.py`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add backend/feedback.py backend/database.py backend/test_feedback.py
git commit -m "feat(feedback): file issues on GitHub with a MongoDB fallback

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Rate limiter

**Files:**
- Modify: `backend/feedback.py` (imports, then append)
- Modify: `backend/test_feedback.py` (append)

**Interfaces:**
- Produces `class FeedbackRateLimiter`, for Task 4:
  - `__init__(limit: int = 5, window_seconds: int = 3600, clock: Callable[[], float] = time.monotonic)`
  - `reserve(identity: str) -> Optional[int]` returns None and records the submission, or returns the seconds to wait (at least 1) and records nothing.
  - `release(identity: str) -> None` forgets that identity's most recent reservation.

- [ ] **Step 1: Write the failing tests**

Append to `backend/test_feedback.py`:

```python
# === Task 3: rate limiter =====================================================

class FakeClock:
    def __init__(self, now=1000.0):
        self.now = now

    def __call__(self):
        return self.now


def test_limiter_allows_five_then_says_how_long_to_wait():
    limiter = fb.FeedbackRateLimiter(clock=FakeClock())
    assert [limiter.reserve("a@b.com") for _ in range(5)] == [None] * 5
    assert limiter.reserve("a@b.com") == 3600


def test_limiter_frees_a_slot_when_the_oldest_report_is_an_hour_old():
    clock = FakeClock(1000.0)
    limiter = fb.FeedbackRateLimiter(clock=clock)
    for _ in range(5):
        limiter.reserve("a@b.com")
    clock.now = 1000.0 + 3599.5
    assert limiter.reserve("a@b.com") == 1
    clock.now = 1000.0 + 3600
    assert limiter.reserve("a@b.com") is None


def test_limiter_counts_each_identity_separately():
    limiter = fb.FeedbackRateLimiter(clock=FakeClock())
    for _ in range(5):
        limiter.reserve("a@b.com")
    assert limiter.reserve("c@d.com") is None


def test_release_gives_the_slot_back():
    limiter = fb.FeedbackRateLimiter(clock=FakeClock())
    for _ in range(5):
        limiter.reserve("a@b.com")
    limiter.release("a@b.com")
    assert limiter.reserve("a@b.com") is None
    assert limiter.reserve("a@b.com") == 3600


def test_release_without_a_reservation_is_harmless():
    limiter = fb.FeedbackRateLimiter(clock=FakeClock())
    limiter.release("nobody@example.com")
    assert limiter.reserve("nobody@example.com") is None
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `/Users/vnerald/ai_tutor/backend/.venv/bin/python -m pytest -q --ignore=test_output.txt test_feedback.py`
Expected: the five new tests fail with `AttributeError: module 'feedback' has no attribute 'FeedbackRateLimiter'`.

- [ ] **Step 3: Write the implementation**

Add to the imports in `backend/feedback.py`, keeping them sorted:

```python
import math
import threading
import time
from collections import deque
```

Then change `from typing import Any, Literal, Optional` to `from typing import Any, Callable, Literal, Optional`.

Append to `backend/feedback.py`:

```python
# --- rate limit --------------------------------------------------------------

class FeedbackRateLimiter:
    """At most `limit` accepted reports per identity in any `window_seconds`.

    In memory, per process: it resets on restart, and separate processes count separately.
    That's enough to stop a flood, which is all it is for.
    """

    def __init__(
        self, limit: int = 5, window_seconds: int = 3600, clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._limit = limit
        self._window = window_seconds
        self._clock = clock
        self._lock = threading.Lock()  # plain route handlers run concurrently in FastAPI's thread pool
        self._stamps: dict[str, deque[float]] = {}

    def _forget_expired(self, now: float) -> None:
        cutoff = now - self._window
        for identity in list(self._stamps):
            stamps = self._stamps[identity]
            while stamps and stamps[0] <= cutoff:
                stamps.popleft()
            if not stamps:
                del self._stamps[identity]

    def reserve(self, identity: str) -> Optional[int]:
        """Record a submission and return None; or, at the limit, record nothing and return
        the seconds to wait (at least 1)."""
        with self._lock:
            now = self._clock()
            self._forget_expired(now)
            stamps = self._stamps.setdefault(identity, deque())
            if len(stamps) >= self._limit:
                return max(1, math.ceil(stamps[0] + self._window - now))
            stamps.append(now)
            return None

    def release(self, identity: str) -> None:
        """Forget identity's most recent reservation, because its delivery failed."""
        with self._lock:
            stamps = self._stamps.get(identity)
            if stamps:
                stamps.pop()
                if not stamps:
                    del self._stamps[identity]
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `/Users/vnerald/ai_tutor/backend/.venv/bin/python -m pytest -q --ignore=test_output.txt test_feedback.py`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add backend/feedback.py backend/test_feedback.py
git commit -m "feat(feedback): limit each student to five reports an hour

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: `POST /api/feedback` and the startup log line

**Files:**
- Modify: `backend/api_routes.py`. Add two imports, and append the route at the end of the file.
- Modify: `backend/main.py`. Add the import and the startup call.
- Create: `backend/test_feedback_api.py`

**Interfaces:**
- Consumes, from Tasks 1–3: `fb.FeedbackRequest`, `fb.deliver`, `fb.FeedbackRateLimiter`, `fb.create_github_issue`, `fb.FeedbackDeliveryError`, `fb.log_config_status` and `database.feedback`.
- Produces, for the frontend in Task 5, `POST /api/feedback` with these responses:
  - 200 `{"ok": true}`
  - 401 `{"detail": "Not authenticated"}`
  - 403 `{"detail": "Guests can't send feedback"}`
  - 422 (FastAPI's validation error)
  - 429 `{"detail": "Too many feedback submissions", "retry_after_seconds": N}` plus the header `Retry-After: N`
  - 503 `{"detail": "Feedback is temporarily unavailable"}`

- [ ] **Step 1: Write the failing tests**

Create `backend/test_feedback_api.py`:

```python
"""Route tests for POST /api/feedback (spec §4).

The app is minimal: only api_routes.router. verify_token, the GitHub sender and the MongoDB
collection are replaced; feedback.py's validation, formatting and rate limiter run for real.

Run from backend/: pytest test_feedback_api.py --ignore=test_output.txt
"""

import json
import urllib.error
import urllib.request

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import api_routes
import database
import feedback as fb

REAL_CREATE_GITHUB_ISSUE = fb.create_github_issue
TOKEN = "github_pat_test_secret_123"
AUTH = {"Authorization": "Bearer fake-token", "User-Agent": "Mozilla/5.0 Test"}
BODY = {
    "type": "content",
    "description": "Page 170 shows the wrong figure.",
    "context": {
        "book_id": "lathi",
        "section": "2.4 System Response to External Input: The Zero-State Response",
        "page": 170,
        "locale": "zh",
        "route": "/learning",
    },
}


class FakeCollection:
    def __init__(self, error=None):
        self.docs = []
        self.error = error

    def insert_one(self, doc):
        if self.error:
            raise self.error
        self.docs.append(doc)


@pytest.fixture
def env(monkeypatch):
    """Signed in as student@example.com. GitHub and MongoDB are fakes each test can adjust."""
    state = {"identity": "student@example.com", "filed": [], "github_error": None, "collection": FakeCollection()}

    def fake_create(issue):
        if state["github_error"]:
            raise fb.FeedbackDeliveryError(state["github_error"])
        state["filed"].append(issue)
        return len(state["filed"])

    monkeypatch.setattr(api_routes, "verify_token", lambda auth: state["identity"] if auth else None)
    monkeypatch.setattr(fb, "create_github_issue", fake_create)
    monkeypatch.setattr(database, "feedback", lambda: state["collection"])
    monkeypatch.setattr(api_routes, "_feedback_limiter", fb.FeedbackRateLimiter(clock=lambda: 1000.0))
    app = FastAPI()
    app.include_router(api_routes.router)
    state["client"] = TestClient(app)
    return state


def post(env, body=BODY, headers=AUTH):
    return env["client"].post("/api/feedback", json=body, headers=headers)


def test_no_token_is_401(env):
    resp = post(env, headers={})
    assert (resp.status_code, resp.json()) == (401, {"detail": "Not authenticated"})


def test_guest_is_403(env):
    env["identity"] = "anon:abc123"
    resp = post(env)
    assert (resp.status_code, resp.json()) == (403, {"detail": "Guests can't send feedback"})


def test_empty_description_is_422(env):
    assert post(env, body={**BODY, "description": "   "}).status_code == 422


def test_success_files_the_issue(env):
    resp = post(env)
    assert (resp.status_code, resp.json()) == (200, {"ok": True})
    (issue,) = env["filed"]
    assert issue.title == "[Content] Page 170 shows the wrong figure."
    assert issue.labels == ["type:content", "book:lathi"]
    assert "| Page | 170 |" in issue.body
    assert "| Browser | Mozilla/5.0 Test |" in issue.body
    assert env["collection"].docs == []


def test_github_failure_is_stored_and_still_200(env):
    env["github_error"] = "HTTP 502"
    resp = post(env)
    assert (resp.status_code, resp.json()) == (200, {"ok": True})
    assert [(d["status"], d["github_error"]) for d in env["collection"].docs] == [("pending", "HTTP 502")]


def test_unconfigured_github_is_stored_and_still_200(env, monkeypatch):
    monkeypatch.setattr(fb, "create_github_issue", REAL_CREATE_GITHUB_ISSUE)
    monkeypatch.delenv("FEEDBACK_GITHUB_TOKEN", raising=False)
    assert post(env).status_code == 200
    assert [d["github_error"] for d in env["collection"].docs] == ["not configured"]


@pytest.mark.parametrize("collection", [None, FakeCollection(error=RuntimeError("down"))])
def test_both_failing_is_503_and_gives_the_slot_back(env, collection):
    env["github_error"] = "HTTP 502"
    env["collection"] = collection
    resp = post(env)
    assert (resp.status_code, resp.json()) == (503, {"detail": "Feedback is temporarily unavailable"})

    env["github_error"] = None
    assert [post(env).status_code for _ in range(5)] == [200] * 5


def test_sixth_report_in_an_hour_is_429(env):
    assert [post(env).status_code for _ in range(5)] == [200] * 5
    resp = post(env)
    assert resp.status_code == 429
    assert resp.headers["Retry-After"] == "3600"
    assert resp.json() == {"detail": "Too many feedback submissions", "retry_after_seconds": 3600}


def test_the_token_never_reaches_logs_or_the_stored_record(env, monkeypatch, capsys):
    monkeypatch.setattr(fb, "create_github_issue", REAL_CREATE_GITHUB_ISSUE)
    monkeypatch.setenv("FEEDBACK_GITHUB_TOKEN", TOKEN)
    monkeypatch.setenv("FEEDBACK_GITHUB_REPO", "lius24/ai-tutor-feedback")

    def github_rejects(request, timeout=None):
        raise urllib.error.HTTPError(request.full_url, 500, "error", {}, None)

    monkeypatch.setattr(urllib.request, "urlopen", github_rejects)
    assert post(env).status_code == 200
    (doc,) = env["collection"].docs
    assert doc["github_error"] == "HTTP 500"
    assert TOKEN not in json.dumps(doc, default=str)
    assert TOKEN not in capsys.readouterr().out


def test_startup_reports_feedback_delivery(monkeypatch, capsys):
    import main

    monkeypatch.delenv("FEEDBACK_GITHUB_TOKEN", raising=False)
    monkeypatch.delenv("MONGODB_URI", raising=False)
    with TestClient(main.app):
        pass
    assert "[Feedback] GitHub delivery disabled" in capsys.readouterr().out
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `/Users/vnerald/ai_tutor/backend/.venv/bin/python -m pytest -q --ignore=test_output.txt test_feedback_api.py`
Expected: the `env` fixture errors with `AttributeError: <module 'api_routes'> has no attribute '_feedback_limiter'`. `test_startup_reports_feedback_delivery` fails because the line isn't printed.

- [ ] **Step 3: Write the implementation**

In `backend/api_routes.py`, add a line after `from fastapi import APIRouter, File, Form, Header, HTTPException, Query, UploadFile`:

```python
from fastapi.responses import JSONResponse
```

and add a line after `import database`:

```python
import feedback as fb
```

Append to the end of `backend/api_routes.py`:

```python


# ---------------------------------------------------------------------------
# In-app feedback (docs/superpowers/specs/2026-10-01-in-app-feedback-design.md)
# ---------------------------------------------------------------------------

_feedback_limiter = fb.FeedbackRateLimiter()


@router.post("/api/feedback")
def submit_feedback(
    req: fb.FeedbackRequest,
    authorization: Optional[str] = Header(None),
    user_agent: Optional[str] = Header(None),
):
    # A plain def on purpose: FastAPI runs it in its thread pool, so the blocking GitHub and
    # MongoDB calls don't stall the event loop that the async routes share.
    identity = verify_token(authorization)
    if not identity:
        raise HTTPException(status_code=401, detail="Not authenticated")
    if identity.startswith("anon:"):
        raise HTTPException(status_code=403, detail="Guests can't send feedback")
    wait = _feedback_limiter.reserve(identity)
    if wait is not None:
        return JSONResponse(
            status_code=429,
            content={"detail": "Too many feedback submissions", "retry_after_seconds": wait},
            headers={"Retry-After": str(wait)},
        )
    delivered = False
    try:
        delivered = fb.deliver(req, identity, user_agent or "")
    finally:
        if not delivered:  # failures, unexpected errors included, never use up the quota
            _feedback_limiter.release(identity)
    if not delivered:
        raise HTTPException(status_code=503, detail="Feedback is temporarily unavailable")
    return {"ok": True}
```

In `backend/main.py`, add after `import database`:

```python
import feedback
```

and replace the startup function with:

```python
@app.on_event("startup")
def startup():
    try:
        database.init_db()
    except Exception as e:
        print(f"[DB] MongoDB init failed: {e}", flush=True)
    feedback.log_config_status()
```

- [ ] **Step 4: Run the tests to verify they pass, then the whole backend suite**

Run: `/Users/vnerald/ai_tutor/backend/.venv/bin/python -m pytest -q --ignore=test_output.txt test_feedback_api.py`
Expected: all pass.

Run: `/Users/vnerald/ai_tutor/backend/.venv/bin/python -m pytest -q --ignore=test_output.txt`
Expected: no failures. That's 250 + the new tests passed, 3 skipped.

- [ ] **Step 5: Commit**

```bash
git add backend/api_routes.py backend/main.py backend/test_feedback_api.py
git commit -m "feat(feedback): POST /api/feedback with auth, rate limit and fallback

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: `getFreshToken()`, shared types and `submitFeedback()`

**Files:**
- Modify: `frontend/src/context/AuthContext.tsx`
- Modify: `frontend/src/context/AuthContext.test.tsx` (append)
- Create: `frontend/src/feedback/types.ts`
- Create: `frontend/src/feedback/feedbackApi.ts`
- Create: `frontend/src/feedback/feedbackApi.test.ts`

**Interfaces:**
- Consumes `POST /api/feedback` from Task 4 and `apiUrl()` from `frontend/src/apiBase.ts`.
- Produces, for Tasks 6 and 7:
  - on the auth context: `getFreshToken: () => Promise<string | null>`;
  - in `types.ts`:
    - `type FeedbackType = "bug" | "content" | "suggestion" | "other"`;
    - `FEEDBACK_TYPES: readonly FeedbackType[]`;
    - `MAX_DESCRIPTION_CHARS = 2000`;
    - `interface FeedbackPageContext { bookId?; section?; page? }`;
    - `interface FeedbackRequestContext { book_id?; section?; page?; locale?; route? }`;
    - `interface FeedbackPayload { type; description; contact_ok; context }`;
  - in `feedbackApi.ts`:
    - `SUBMIT_TIMEOUT_MS = 30_000`;
    - `type SubmitResult`;
    - `submitFeedback(token: string, payload: FeedbackPayload, timeoutMs?: number): Promise<SubmitResult>`.

- [ ] **Step 1: Write the failing tests**

Append to `frontend/src/context/AuthContext.test.tsx`:

```tsx
describe("getFreshToken", () => {
  function captureAuth() {
    const captured: { auth?: ReturnType<typeof useAuth> } = {};
    function Capture() {
      captured.auth = useAuth();
      return null;
    }
    render(<AuthProvider><Capture /></AuthProvider>);
    return captured;
  }

  it("returns the token Firebase hands out right now", async () => {
    const captured = captureAuth();
    const { user, rotate } = makeUser("token-1");
    await firebaseReports(user);

    rotate("token-2");

    await expect(captured.auth!.getFreshToken()).resolves.toBe("token-2");
  });

  it("returns null when nobody is signed in", async () => {
    const captured = captureAuth();
    await firebaseReports(null);

    await expect(captured.auth!.getFreshToken()).resolves.toBeNull();
  });
});
```

Create `frontend/src/feedback/feedbackApi.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { submitFeedback, SUBMIT_TIMEOUT_MS } from "./feedbackApi";
import type { FeedbackPayload } from "./types";

const PAYLOAD: FeedbackPayload = {
  type: "content",
  description: "Page 170 shows the wrong figure.",
  contact_ok: false,
  context: { book_id: "lathi", page: 170 },
};

function respondWith(status: number, body?: string) {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(body ?? null, { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("submitFeedback", () => {
  it("POSTs the payload as JSON with the bearer token", async () => {
    const fetchMock = respondWith(200, JSON.stringify({ ok: true }));

    await expect(submitFeedback("tok-1", PAYLOAD)).resolves.toEqual({ ok: true });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url.endsWith("/api/feedback")).toBe(true);
    expect(init?.method).toBe("POST");
    expect(init?.headers).toEqual({ Authorization: "Bearer tok-1", "Content-Type": "application/json" });
    expect(JSON.parse(String(init?.body))).toEqual(PAYLOAD);
  });

  it.each([401, 403])("treats %i as needing sign-in", async (status) => {
    respondWith(status, JSON.stringify({ detail: "x" }));
    await expect(submitFeedback("tok-1", PAYLOAD)).resolves.toEqual({ ok: false, kind: "auth" });
  });

  it("treats 422 as an invalid form", async () => {
    respondWith(422, JSON.stringify({ detail: [] }));
    await expect(submitFeedback("tok-1", PAYLOAD)).resolves.toEqual({ ok: false, kind: "invalid" });
  });

  it.each([
    [61, 2],
    [3600, 60],
    [1, 1],
  ])("turns retry_after_seconds=%i into %i minutes", async (seconds, minutes) => {
    respondWith(429, JSON.stringify({ detail: "Too many feedback submissions", retry_after_seconds: seconds }));
    await expect(submitFeedback("tok-1", PAYLOAD)).resolves.toEqual({
      ok: false,
      kind: "rateLimited",
      retryAfterMinutes: minutes,
    });
  });

  it("assumes an hour when a 429 doesn't say how long", async () => {
    respondWith(429, "not json");
    await expect(submitFeedback("tok-1", PAYLOAD)).resolves.toEqual({
      ok: false,
      kind: "rateLimited",
      retryAfterMinutes: 60,
    });
  });

  it.each([404, 500, 503])("treats %i as unavailable", async (status) => {
    respondWith(status, "{}");
    await expect(submitFeedback("tok-1", PAYLOAD)).resolves.toEqual({ ok: false, kind: "unavailable" });
  });

  it("treats a network error as unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    await expect(submitFeedback("tok-1", PAYLOAD)).resolves.toEqual({ ok: false, kind: "unavailable" });
  });

  it("gives up after 30 seconds", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
          }),
      ),
    );

    const pending = submitFeedback("tok-1", PAYLOAD);
    await vi.advanceTimersByTimeAsync(SUBMIT_TIMEOUT_MS);

    await expect(pending).resolves.toEqual({ ok: false, kind: "unavailable" });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run, from `frontend/`: `npx vitest run src/context/AuthContext.test.tsx src/feedback/feedbackApi.test.ts`
Expected:
- `feedbackApi.test.ts` fails to import `./feedbackApi`.
- The two `getFreshToken` tests fail with `TypeError: captured.auth.getFreshToken is not a function`.
- The other seven AuthContext tests still pass.

- [ ] **Step 3: Write the implementation**

In `frontend/src/context/AuthContext.tsx`:

1. Change the React import to `import { createContext, useCallback, useContext, useEffect, useState } from "react";`.
2. In `interface AuthContextType`, add after `setShowSignIn: (v: boolean) => void;`:

```ts
  /** Asks Firebase for a token now: the cached one, or a new one when it is close to expiring. */
  getFreshToken: () => Promise<string | null>;
```

3. Add after the `logout` function:

```tsx
  const getFreshToken = useCallback(async () => {
    const current = auth?.currentUser;
    return current ? current.getIdToken() : null;
  }, []);
```

4. Change the provider value to:

```tsx
    <AuthContext.Provider value={{
      user, token, loading,
      loginWithProvider, loginWithEmail,
      logout, showSignIn, setShowSignIn,
      getFreshToken,
    }}>
```

Create `frontend/src/feedback/types.ts`:

```ts
export type FeedbackType = "bug" | "content" | "suggestion" | "other";

export const FEEDBACK_TYPES: readonly FeedbackType[] = ["bug", "content", "suggestion", "other"];

/** The longest description the server accepts. The textarea enforces the same limit. */
export const MAX_DESCRIPTION_CHARS = 2000;

/** What Learning Mode knows about the screen. */
export interface FeedbackPageContext {
  bookId?: string;
  section?: string;
  page?: number;
}

/** The `context` object sent to POST /api/feedback. */
export interface FeedbackRequestContext {
  book_id?: string;
  section?: string;
  page?: number;
  locale?: string;
  route?: string;
}

export interface FeedbackPayload {
  type: FeedbackType;
  description: string;
  contact_ok: boolean;
  context: FeedbackRequestContext;
}
```

Create `frontend/src/feedback/feedbackApi.ts`:

```ts
import { apiUrl } from "../apiBase";
import type { FeedbackPayload } from "./types";

/** The server answers within about 15 s; past 30 s, give up and let the student retry. */
export const SUBMIT_TIMEOUT_MS = 30_000;

export type SubmitResult =
  | { ok: true }
  | { ok: false; kind: "auth" }
  | { ok: false; kind: "rateLimited"; retryAfterMinutes: number }
  | { ok: false; kind: "invalid" }
  | { ok: false; kind: "unavailable" };

export async function submitFeedback(
  token: string,
  payload: FeedbackPayload,
  timeoutMs = SUBMIT_TIMEOUT_MS,
): Promise<SubmitResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(apiUrl("/api/feedback"), {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (res.ok) return { ok: true };
    if (res.status === 401 || res.status === 403) return { ok: false, kind: "auth" };
    if (res.status === 422) return { ok: false, kind: "invalid" };
    if (res.status === 429) return { ok: false, kind: "rateLimited", retryAfterMinutes: await retryAfterMinutes(res) };
    return { ok: false, kind: "unavailable" };
  } catch {
    return { ok: false, kind: "unavailable" };
  } finally {
    clearTimeout(timer);
  }
}

/** Minutes to wait, from the 429 body. A cross-origin page can't read the Retry-After header. */
async function retryAfterMinutes(res: Response): Promise<number> {
  try {
    const body = (await res.json()) as { retry_after_seconds?: unknown };
    const seconds = body.retry_after_seconds;
    if (typeof seconds === "number" && Number.isFinite(seconds) && seconds > 0) {
      return Math.max(1, Math.ceil(seconds / 60));
    }
  } catch {
    // Not JSON: fall through to the default.
  }
  return 60;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run, from `frontend/`: `npx vitest run src/context/AuthContext.test.tsx src/feedback/feedbackApi.test.ts`
Expected: all pass.

Run, from `frontend/`: `npx tsc -b`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/context/AuthContext.tsx frontend/src/context/AuthContext.test.tsx frontend/src/feedback/types.ts frontend/src/feedback/feedbackApi.ts frontend/src/feedback/feedbackApi.test.ts
git commit -m "feat(feedback): client for POST /api/feedback and a just-in-time ID token

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: FeedbackContext: sign-in gate and snapshot

**Files:**
- Create: `frontend/src/feedback/FeedbackContext.tsx`
- Create: `frontend/src/feedback/FeedbackContext.test.tsx`

**Interfaces:**
- Consumes:
  - `useAuth()`: it reads `user` and `setShowSignIn`;
  - `useLocale()`: it reads `locale`;
  - `readSelectedTextbookId()` from `frontend/src/learningTextbooks.ts`;
  - the Task 5 types.
- Produces, for Tasks 7 and 8:
  - `FeedbackProvider`;
  - `useFeedback(): { openFeedback(opts?: { type?: FeedbackType }): void; closeFeedback(): void; registerPageContext(ctx: FeedbackPageContext | null): void; isOpen: boolean; presetType: FeedbackType | null; snapshot: FeedbackRequestContext }`.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/feedback/FeedbackContext.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { useEffect } from "react";

type TestUser = { email: string; displayName: string | null; photoURL: string | null; uid: string; isAnonymous: boolean };

// The whole auth context, as AuthProvider supplies it; the tests change `user`.
const auth = vi.hoisted(() => ({
  user: null as TestUser | null,
  token: null as string | null,
  loading: false,
  loginWithProvider: vi.fn(),
  loginWithEmail: vi.fn(),
  logout: vi.fn(),
  showSignIn: false,
  setShowSignIn: vi.fn(),
  getFreshToken: vi.fn(),
}));

vi.mock("../context/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("../i18n/LocaleContext", () => ({ useLocale: () => ({ locale: "zh" }) }));

import { FeedbackProvider, useFeedback } from "./FeedbackContext";
import { writeSelectedTextbookId } from "../learningTextbooks";
import type { FeedbackPageContext } from "./types";

const STUDENT: TestUser = {
  email: "student@example.com",
  displayName: "Student",
  photoURL: null,
  uid: "uid-1",
  isAnonymous: false,
};
const SECTION = "2.4 System Response to External Input: The Zero-State Response";

function Harness({ page }: { page?: FeedbackPageContext | null }) {
  const { openFeedback, closeFeedback, registerPageContext, isOpen, presetType, snapshot } = useFeedback();
  useEffect(() => {
    if (page !== undefined) registerPageContext(page);
  }, [page, registerPageContext]);
  return (
    <>
      <button onClick={() => openFeedback()}>open</button>
      <button onClick={() => openFeedback({ type: "content" })}>report</button>
      <button onClick={closeFeedback}>close</button>
      <output data-testid="state">{JSON.stringify({ isOpen, presetType, snapshot })}</output>
    </>
  );
}

const state = () => JSON.parse(screen.getByTestId("state").textContent ?? "{}");

beforeEach(() => {
  auth.user = null;
  auth.setShowSignIn.mockReset();
  window.history.pushState({}, "", "/learning");
});

afterEach(cleanup);

describe("FeedbackProvider", () => {
  it("asks a signed-out visitor to sign in instead of opening", () => {
    render(<FeedbackProvider><Harness /></FeedbackProvider>);
    fireEvent.click(screen.getByText("open"));
    expect(auth.setShowSignIn).toHaveBeenCalledWith(true);
    expect(state().isOpen).toBe(false);
  });

  it("asks a guest to sign in instead of opening", () => {
    auth.user = { ...STUDENT, isAnonymous: true };
    render(<FeedbackProvider><Harness /></FeedbackProvider>);
    fireEvent.click(screen.getByText("report"));
    expect(auth.setShowSignIn).toHaveBeenCalledWith(true);
    expect(state().isOpen).toBe(false);
  });

  it("opens for a signed-in student with a snapshot of the page on screen", () => {
    auth.user = STUDENT;
    render(
      <FeedbackProvider>
        <Harness page={{ bookId: "lathi", section: SECTION, page: 170 }} />
      </FeedbackProvider>,
    );
    fireEvent.click(screen.getByText("report"));
    expect(state()).toEqual({
      isOpen: true,
      presetType: "content",
      snapshot: { book_id: "lathi", section: SECTION, page: 170, locale: "zh", route: "/learning" },
    });
    expect(auth.setShowSignIn).not.toHaveBeenCalled();
  });

  it("falls back to the selected book once Learning Mode has unregistered", () => {
    auth.user = STUDENT;
    writeSelectedTextbookId("lathi");
    window.history.pushState({}, "", "/grades");
    render(<FeedbackProvider><Harness page={null} /></FeedbackProvider>);
    fireEvent.click(screen.getByText("open"));
    expect(state()).toEqual({
      isOpen: true,
      presetType: null,
      snapshot: { book_id: "lathi", locale: "zh", route: "/grades" },
    });
  });

  it("returns focus to the element that opened it", () => {
    auth.user = STUDENT;
    render(<FeedbackProvider><Harness /></FeedbackProvider>);
    const opener = screen.getByText("open");
    opener.focus();
    fireEvent.click(opener);
    screen.getByText("close").focus();
    fireEvent.click(screen.getByText("close"));
    expect(state().isOpen).toBe(false);
    expect(opener).toHaveFocus();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run, from `frontend/`: `npx vitest run src/feedback/FeedbackContext.test.tsx`
Expected: it fails to import `./FeedbackContext`.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/feedback/FeedbackContext.tsx`:

```tsx
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "../context/AuthContext";
import { useLocale } from "../i18n/LocaleContext";
import { readSelectedTextbookId } from "../learningTextbooks";
import type { FeedbackPageContext, FeedbackRequestContext, FeedbackType } from "./types";

interface FeedbackContextValue {
  /** Opens the dialog, or the sign-in modal for signed-out visitors and guests. */
  openFeedback: (opts?: { type?: FeedbackType }) => void;
  closeFeedback: () => void;
  /** Learning Mode calls this when the book, section or page changes, and with null on unmount. */
  registerPageContext: (ctx: FeedbackPageContext | null) => void;
  isOpen: boolean;
  presetType: FeedbackType | null;
  /** Where the student was when the dialog opened. It doesn't change while the dialog is open. */
  snapshot: FeedbackRequestContext;
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const { user, setShowSignIn } = useAuth();
  const { locale } = useLocale();
  // A ref, not state: turning a page must not re-render everything that reads this context.
  const pageContextRef = useRef<FeedbackPageContext | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [presetType, setPresetType] = useState<FeedbackType | null>(null);
  const [snapshot, setSnapshot] = useState<FeedbackRequestContext>({});

  const registerPageContext = useCallback((ctx: FeedbackPageContext | null) => {
    pageContextRef.current = ctx;
  }, []);

  const openFeedback = useCallback(
    (opts?: { type?: FeedbackType }) => {
      if (!user || user.isAnonymous) {
        setShowSignIn(true);
        return;
      }
      const page = pageContextRef.current;
      openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setSnapshot({
        book_id: page?.bookId ?? readSelectedTextbookId(),
        section: page?.section,
        page: page?.page,
        locale,
        route: window.location.pathname,
      });
      setPresetType(opts?.type ?? null);
      setIsOpen(true);
    },
    [user, setShowSignIn, locale],
  );

  const closeFeedback = useCallback(() => {
    setIsOpen(false);
    openerRef.current?.focus();
    openerRef.current = null;
  }, []);

  const value = useMemo(
    () => ({ openFeedback, closeFeedback, registerPageContext, isOpen, presetType, snapshot }),
    [openFeedback, closeFeedback, registerPageContext, isOpen, presetType, snapshot],
  );
  return <FeedbackContext.Provider value={value}>{children}</FeedbackContext.Provider>;
}

export function useFeedback(): FeedbackContextValue {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error("useFeedback must be used inside FeedbackProvider");
  return ctx;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run, from `frontend/`: `npx vitest run src/feedback/FeedbackContext.test.tsx`
Expected: all pass.

Run, from `frontend/`: `npx tsc -b`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/feedback/FeedbackContext.tsx frontend/src/feedback/FeedbackContext.test.tsx
git commit -m "feat(feedback): context that gates on sign-in and snapshots where the student is

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: The dialog, its strings and mounting

**Files:**
- Create: `frontend/src/feedback/FeedbackModal.tsx`
- Create: `frontend/src/feedback/FeedbackModal.css`
- Create: `frontend/src/feedback/FeedbackModal.test.tsx`
- Modify: `frontend/src/i18n/messages.ts`. Add the 24 `feedback.*` keys to each of `EN`, `ZH` and `ES`.
- Modify: `frontend/src/main.tsx`. Wrap `<App />` in `<FeedbackProvider>`.
- Modify: `frontend/src/App.tsx`. Mount `<FeedbackModal />` after `<SignInModal />`.

**Interfaces:**
- Consumes:
  - `useFeedback()` (Task 6);
  - `submitFeedback` and `SubmitResult` (Task 5);
  - `FEEDBACK_TYPES`, `MAX_DESCRIPTION_CHARS` and `FeedbackType` (Task 5);
  - `useAuth()`, which supplies `user`, `getFreshToken`, `showSignIn` and `setShowSignIn`;
  - `useLocale().t`.
- Produces:
  - a default export, `FeedbackModal`;
  - the strings `feedback.sidebarItem`, `feedback.reportProblem` and `feedback.reportProblemTitle`, which Task 8 uses.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/feedback/FeedbackModal.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import type { MessageKey } from "../i18n/messages";
import type { SubmitResult } from "./feedbackApi";

const auth = vi.hoisted(() => ({
  user: { email: "student@example.com", displayName: "Student", photoURL: null, uid: "uid-1", isAnonymous: false },
  token: "token-1",
  loading: false,
  loginWithProvider: vi.fn(),
  loginWithEmail: vi.fn(),
  logout: vi.fn(),
  showSignIn: false,
  setShowSignIn: vi.fn(),
  getFreshToken: vi.fn(async (): Promise<string | null> => "token-2"),
}));
const api = vi.hoisted(() => ({ submitFeedback: vi.fn() }));

vi.mock("../context/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("../i18n/LocaleContext", async () => {
  const { formatMessage, MESSAGES } = await vi.importActual<typeof import("../i18n/messages")>("../i18n/messages");
  return {
    useLocale: () => ({
      locale: "en",
      t: (key: MessageKey, vars?: Record<string, string>) => formatMessage(MESSAGES.en[key], vars),
    }),
  };
});
vi.mock("./feedbackApi", () => ({ submitFeedback: api.submitFeedback }));

import FeedbackModal from "./FeedbackModal";
import { FeedbackProvider, useFeedback } from "./FeedbackContext";

function Opener({ type }: { type?: "content" }) {
  const { openFeedback } = useFeedback();
  return <button onClick={() => openFeedback(type ? { type } : undefined)}>open feedback</button>;
}

function renderDialog(type?: "content") {
  render(
    <FeedbackProvider>
      <Opener type={type} />
      <FeedbackModal />
    </FeedbackProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "open feedback" }));
}

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

const sendButton = () => screen.getByRole("button", { name: "Send" });
const description = () => screen.getByLabelText("Description");

/** Lets the send chain (fresh token, then submit, then a state update) finish inside act.
 *  Microtasks only, so it also works under fake timers, where RTL's findBy* would hang. */
async function settle() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

async function typeAndSend(text: string) {
  fireEvent.change(description(), { target: { value: text } });
  await act(async () => {
    fireEvent.click(sendButton());
    await settle();
  });
}

beforeEach(() => {
  auth.showSignIn = false;
  auth.setShowSignIn.mockReset();
  auth.getFreshToken.mockReset().mockResolvedValue("token-2");
  api.submitFeedback.mockReset();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("FeedbackModal", () => {
  it("enables Send only once a type is chosen and the description has text", () => {
    renderDialog();
    expect(sendButton()).toBeDisabled();
    fireEvent.click(screen.getByLabelText("Suggestion"));
    expect(sendButton()).toBeDisabled();
    fireEvent.change(description(), { target: { value: "   " } });
    expect(sendButton()).toBeDisabled();
    fireEvent.change(description(), { target: { value: "Add dark mode" } });
    expect(sendButton()).toBeEnabled();
  });

  it("counts characters against the 2000 limit", () => {
    renderDialog();
    fireEvent.change(description(), { target: { value: "hello" } });
    expect(screen.getByText("5 / 2000")).toBeInTheDocument();
    expect(description()).toHaveAttribute("maxlength", "2000");
  });

  it("offers to share the account's email, unticked", () => {
    renderDialog();
    expect(screen.getByLabelText("You can contact me at student@example.com")).not.toBeChecked();
  });

  it("preselects the content type and focuses the description when opened from the textbook", () => {
    renderDialog("content");
    expect(screen.getByLabelText("Wrong page or content")).toBeChecked();
    expect(description()).toHaveFocus();
  });

  it("focuses the first type when opened from the sidebar", () => {
    renderDialog();
    expect(screen.getByLabelText("Something is broken")).toHaveFocus();
  });

  it("sends the form with a fresh token and the snapshot", async () => {
    api.submitFeedback.mockResolvedValue({ ok: true });
    renderDialog("content");
    fireEvent.click(screen.getByLabelText("You can contact me at student@example.com"));
    await typeAndSend("Figure 2.3 is cut off");

    expect(api.submitFeedback).toHaveBeenCalledTimes(1);
    const [token, payload] = api.submitFeedback.mock.calls[0];
    expect(token).toBe("token-2");
    expect(payload).toMatchObject({ type: "content", description: "Figure 2.3 is cut off", contact_ok: true });
    expect(payload.context).toMatchObject({ locale: "en", route: window.location.pathname });
  });

  it("sends once when Send is clicked twice", async () => {
    const pending = deferred<SubmitResult>();
    api.submitFeedback.mockReturnValue(pending.promise);
    renderDialog("content");
    fireEvent.change(description(), { target: { value: "Twice" } });

    // Both clicks land in one act scope, so React hasn't re-rendered the disabled button in
    // between: only the in-flight guard can stop the second send.
    await act(async () => {
      fireEvent.click(sendButton());
      fireEvent.click(sendButton());
      await settle();
    });

    expect(api.submitFeedback).toHaveBeenCalledTimes(1);
    await act(async () => {
      pending.resolve({ ok: true });
      await settle();
    });
  });

  it("locks the dialog while sending", async () => {
    const pending = deferred<SubmitResult>();
    api.submitFeedback.mockReturnValue(pending.promise);
    renderDialog("content");
    await typeAndSend("Slow network");

    expect(screen.getByRole("button", { name: /Sending/ })).toBeDisabled();
    expect(description()).toBeDisabled();
    expect(screen.getByRole("button", { name: "Close" })).toBeDisabled();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await act(async () => {
      pending.resolve({ ok: true });
      await settle();
    });
  });

  it("thanks the student, then closes itself after 2.5 s", async () => {
    vi.useFakeTimers();
    api.submitFeedback.mockResolvedValue({ ok: true });
    renderDialog("content");
    await typeAndSend("Thanks");

    expect(screen.getByRole("status")).toHaveTextContent("Thanks, we got it.");
    await act(async () => {
      vi.advanceTimersByTime(2500);
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it.each<[SubmitResult, string]>([
    [{ ok: false, kind: "rateLimited", retryAfterMinutes: 42 }, "You're sending feedback too often. Try again in about 42 min."],
    [{ ok: false, kind: "invalid" }, "Please check the form and try again."],
    [{ ok: false, kind: "unavailable" }, "Couldn't send right now. Please try again in a moment."],
  ])("shows each failure and keeps the text: %o", async (result, message) => {
    api.submitFeedback.mockResolvedValue(result);
    renderDialog("content");
    await typeAndSend("Keep me");

    expect(screen.getByRole("alert")).toHaveTextContent(message);
    expect(description()).toHaveValue("Keep me");
    expect(sendButton()).toBeEnabled();
  });

  it("treats a token Firebase can't produce as unavailable", async () => {
    auth.getFreshToken.mockRejectedValue(new Error("auth/network-request-failed"));
    renderDialog("content");
    await typeAndSend("Offline");

    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't send right now. Please try again in a moment.");
    expect(api.submitFeedback).not.toHaveBeenCalled();
  });

  it("asks to sign in again without losing the draft", async () => {
    api.submitFeedback.mockResolvedValue({ ok: false, kind: "auth" });
    renderDialog("content");
    await typeAndSend("Draft");

    expect(screen.getByRole("alert")).toHaveTextContent("You need to sign in again to send this.");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(auth.setShowSignIn).toHaveBeenCalledWith(true);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(description()).toHaveValue("Draft");
  });

  it("treats a missing token as needing sign-in", async () => {
    auth.getFreshToken.mockResolvedValue(null);
    renderDialog("content");
    await typeAndSend("No token");

    expect(screen.getByRole("alert")).toHaveTextContent("You need to sign in again to send this.");
    expect(api.submitFeedback).not.toHaveBeenCalled();
  });

  it("ignores Esc while the sign-in modal is open on top", () => {
    auth.showSignIn = true;
    renderDialog();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("closes on Esc, Cancel and ×, but not on a backdrop click", () => {
    renderDialog();
    fireEvent.click(screen.getByRole("dialog").parentElement!);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "open feedback" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "open feedback" }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("starts with an empty form every time it opens", () => {
    renderDialog();
    fireEvent.change(description(), { target: { value: "half-typed" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "open feedback" }));
    expect(description()).toHaveValue("");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run, from `frontend/`: `npx vitest run src/feedback/FeedbackModal.test.tsx`
Expected: it fails to import `./FeedbackModal`.

- [ ] **Step 3: Write the implementation**

**3a. Strings.** In `frontend/src/i18n/messages.ts`:

Insert these lines into `EN`, directly before the `} as const;` that closes it, after `"signin.tagline": "Personalized math learning, powered by AI",`:

```ts
  "feedback.sidebarItem": "Feedback",
  "feedback.reportProblem": "Report a problem",
  "feedback.reportProblemTitle": "Report a problem with this page",
  "feedback.title": "Send feedback",
  "feedback.close": "Close",
  "feedback.typeLegend": "What kind of feedback?",
  "feedback.type.bug": "Something is broken",
  "feedback.type.content": "Wrong page or content",
  "feedback.type.suggestion": "Suggestion",
  "feedback.type.other": "Other",
  "feedback.descriptionLabel": "Description",
  "feedback.descriptionPlaceholder": "What happened, and what did you expect?",
  "feedback.charCount": "{count} / {max}",
  "feedback.contact": "You can contact me at {email}",
  "feedback.attached":
    "We'll include where you are in the app (course, section, page), your language and your browser. Never your chats.",
  "feedback.cancel": "Cancel",
  "feedback.send": "Send",
  "feedback.sending": "Sending…",
  "feedback.sent": "Thanks, we got it.",
  "feedback.errorAuth": "You need to sign in again to send this.",
  "feedback.signIn": "Sign in",
  "feedback.errorRateLimited": "You're sending feedback too often. Try again in about {minutes} min.",
  "feedback.errorInvalid": "Please check the form and try again.",
  "feedback.errorUnavailable": "Couldn't send right now. Please try again in a moment.",
```

Insert these lines into `ZH`, directly before its closing `};`, after `"signin.tagline": "AI 驱动的个性化数学学习",`:

```ts
  "feedback.sidebarItem": "反馈",
  "feedback.reportProblem": "报告问题",
  "feedback.reportProblemTitle": "报告这一页的问题",
  "feedback.title": "反馈意见",
  "feedback.close": "关闭",
  "feedback.typeLegend": "反馈类型",
  "feedback.type.bug": "程序出错",
  "feedback.type.content": "页码或内容有误",
  "feedback.type.suggestion": "建议",
  "feedback.type.other": "其他",
  "feedback.descriptionLabel": "描述",
  "feedback.descriptionPlaceholder": "发生了什么？你原本期望看到什么？",
  "feedback.charCount": "{count} / {max}",
  "feedback.contact": "可以通过 {email} 联系我",
  "feedback.attached": "会附上你在应用中的位置（课程、章节、页码）、界面语言和浏览器信息，不包含聊天内容。",
  "feedback.cancel": "取消",
  "feedback.send": "提交",
  "feedback.sending": "提交中…",
  "feedback.sent": "谢谢，我们已收到。",
  "feedback.errorAuth": "需要重新登录后才能提交。",
  "feedback.signIn": "登录",
  "feedback.errorRateLimited": "提交太频繁，请约 {minutes} 分钟后再试。",
  "feedback.errorInvalid": "请检查填写的内容后重试。",
  "feedback.errorUnavailable": "暂时无法提交，请稍后再试。",
```

Insert these lines into `ES`, directly before its closing `};`, after `"signin.tagline": "Aprendizaje de matemáticas personalizado con IA",`:

```ts
  "feedback.sidebarItem": "Comentarios",
  "feedback.reportProblem": "Reportar un problema",
  "feedback.reportProblemTitle": "Reportar un problema con esta página",
  "feedback.title": "Enviar comentarios",
  "feedback.close": "Cerrar",
  "feedback.typeLegend": "¿Qué tipo de comentario es?",
  "feedback.type.bug": "Algo no funciona",
  "feedback.type.content": "Página o contenido incorrecto",
  "feedback.type.suggestion": "Sugerencia",
  "feedback.type.other": "Otro",
  "feedback.descriptionLabel": "Descripción",
  "feedback.descriptionPlaceholder": "¿Qué pasó y qué esperabas?",
  "feedback.charCount": "{count} / {max}",
  "feedback.contact": "Pueden contactarme en {email}",
  "feedback.attached":
    "Incluiremos dónde estás en la app (curso, sección, página), tu idioma y tu navegador. Nunca tus chats.",
  "feedback.cancel": "Cancelar",
  "feedback.send": "Enviar",
  "feedback.sending": "Enviando…",
  "feedback.sent": "Gracias, lo recibimos.",
  "feedback.errorAuth": "Tienes que volver a iniciar sesión para enviarlo.",
  "feedback.signIn": "Iniciar sesión",
  "feedback.errorRateLimited":
    "Estás enviando comentarios con demasiada frecuencia. Vuelve a intentarlo en unos {minutes} min.",
  "feedback.errorInvalid": "Revisa el formulario y vuelve a intentarlo.",
  "feedback.errorUnavailable": "No se pudo enviar en este momento. Vuelve a intentarlo en un rato.",
```

**3b. The dialog.** Create `frontend/src/feedback/FeedbackModal.tsx`:

```tsx
import { useEffect, useId, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useLocale } from "../i18n/LocaleContext";
import type { MessageKey } from "../i18n/messages";
import { useFeedback } from "./FeedbackContext";
import { submitFeedback, type SubmitResult } from "./feedbackApi";
import { FEEDBACK_TYPES, MAX_DESCRIPTION_CHARS, type FeedbackType } from "./types";
import "./FeedbackModal.css";

/** How long "Thanks, we got it." stays before the dialog closes itself. */
const SENT_CLOSE_DELAY_MS = 2500;

const TYPE_LABEL_KEYS: Record<FeedbackType, MessageKey> = {
  bug: "feedback.type.bug",
  content: "feedback.type.content",
  suggestion: "feedback.type.suggestion",
  other: "feedback.type.other",
};

type Failure = Exclude<SubmitResult, { ok: true }>;

/** Mounted once, next to SignInModal. */
export default function FeedbackModal() {
  const { isOpen } = useFeedback();
  // The form's state lives in FeedbackDialog, so every open starts with an empty form.
  return isOpen ? <FeedbackDialog /> : null;
}

function FeedbackDialog() {
  const { presetType, snapshot, closeFeedback } = useFeedback();
  const { user, getFreshToken, showSignIn, setShowSignIn } = useAuth();
  const { t } = useLocale();
  const [type, setType] = useState<FeedbackType | null>(presetType);
  const [description, setDescription] = useState("");
  const [contactOk, setContactOk] = useState(false);
  const [phase, setPhase] = useState<"editing" | "sending" | "sent">("editing");
  const [failure, setFailure] = useState<Failure | null>(null);
  const inFlight = useRef(false);
  const firstTypeRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const sending = phase === "sending";

  useEffect(() => {
    (presetType ? descriptionRef.current : firstTypeRef.current)?.focus();
  }, [presetType]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Esc never closes mid-send, or while the sign-in modal sits on top of the dialog.
      if (event.key === "Escape" && !sending && !showSignIn) closeFeedback();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [sending, showSignIn, closeFeedback]);

  useEffect(() => {
    if (phase !== "sent") return;
    const timer = setTimeout(closeFeedback, SENT_CLOSE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [phase, closeFeedback]);

  const canSend = phase === "editing" && type !== null && description.trim() !== "";

  const send = async () => {
    // The ref stops a second click that lands before React re-renders the disabled button.
    if (!canSend || type === null || inFlight.current) return;
    inFlight.current = true;
    setPhase("sending");
    setFailure(null);
    let result: SubmitResult;
    try {
      const token = await getFreshToken();
      result = token
        ? await submitFeedback(token, { type, description, contact_ok: contactOk, context: snapshot })
        : { ok: false, kind: "auth" };
    } catch {
      result = { ok: false, kind: "unavailable" }; // Firebase couldn't produce a token, e.g. offline
    } finally {
      inFlight.current = false;
    }
    if (result.ok) {
      setPhase("sent");
    } else {
      setFailure(result);
      setPhase("editing");
    }
  };

  const failureMessage = (f: Failure): string => {
    switch (f.kind) {
      case "auth":
        return t("feedback.errorAuth");
      case "rateLimited":
        return t("feedback.errorRateLimited", { minutes: String(f.retryAfterMinutes) });
      case "invalid":
        return t("feedback.errorInvalid");
      case "unavailable":
        return t("feedback.errorUnavailable");
    }
  };

  return (
    // No onClick on the overlay: a stray click must not throw away a long description.
    <div className="feedback-overlay">
      <div className="feedback-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <button
          type="button"
          className="feedback-close"
          onClick={closeFeedback}
          disabled={sending}
          aria-label={t("feedback.close")}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <h2 id={titleId} className="feedback-title">{t("feedback.title")}</h2>

        {phase === "sent" ? (
          <div className="feedback-sent">
            <p role="status">{t("feedback.sent")}</p>
            <div className="feedback-actions">
              <button type="button" className="feedback-btn feedback-btn--primary" onClick={closeFeedback}>
                {t("feedback.close")}
              </button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
          >
            <fieldset className="feedback-types" disabled={sending}>
              <legend className="feedback-label">{t("feedback.typeLegend")}</legend>
              {FEEDBACK_TYPES.map((value, index) => (
                <label key={value} className="feedback-type">
                  <input
                    ref={index === 0 ? firstTypeRef : undefined}
                    type="radio"
                    name="feedback-type"
                    value={value}
                    checked={type === value}
                    onChange={() => setType(value)}
                  />
                  <span>{t(TYPE_LABEL_KEYS[value])}</span>
                </label>
              ))}
            </fieldset>

            <label className="feedback-label" htmlFor={descriptionId}>
              {t("feedback.descriptionLabel")}
            </label>
            <textarea
              id={descriptionId}
              ref={descriptionRef}
              className="feedback-textarea"
              rows={6}
              maxLength={MAX_DESCRIPTION_CHARS}
              value={description}
              placeholder={t("feedback.descriptionPlaceholder")}
              disabled={sending}
              onChange={(event) => setDescription(event.target.value)}
            />
            <div className="feedback-count">
              {t("feedback.charCount", { count: String(description.length), max: String(MAX_DESCRIPTION_CHARS) })}
            </div>

            <label className="feedback-contact">
              <input
                type="checkbox"
                checked={contactOk}
                disabled={sending}
                onChange={(event) => setContactOk(event.target.checked)}
              />
              <span>{t("feedback.contact", { email: user?.email ?? "" })}</span>
            </label>
            <p className="feedback-attached">{t("feedback.attached")}</p>

            {failure ? (
              <div className="feedback-error" role="alert">
                <span>{failureMessage(failure)}</span>
                {failure.kind === "auth" ? (
                  <button type="button" className="feedback-error-signin" onClick={() => setShowSignIn(true)}>
                    {t("feedback.signIn")}
                  </button>
                ) : null}
              </div>
            ) : null}

            <div className="feedback-actions">
              <button type="button" className="feedback-btn" onClick={closeFeedback} disabled={sending}>
                {t("feedback.cancel")}
              </button>
              <button type="submit" className="feedback-btn feedback-btn--primary" disabled={!canSend}>
                {sending ? (
                  <>
                    <span className="feedback-spinner" aria-hidden />
                    {t("feedback.sending")}
                  </>
                ) : (
                  t("feedback.send")
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
```

**3c. Styles.** Create `frontend/src/feedback/FeedbackModal.css`:

```css
/* In-app feedback dialog. It follows SignInModal's look; the text and teal colours meet WCAG AA. */
.feedback-overlay {
  position: fixed;
  inset: 0;
  z-index: 999; /* one below .signin-overlay, so the sign-in modal can open on top */
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  box-sizing: border-box;
  background: rgba(8, 12, 24, 0.55);
  backdrop-filter: blur(16px) saturate(1.4);
  -webkit-backdrop-filter: blur(16px) saturate(1.4);
}

.feedback-modal {
  position: relative;
  width: 520px;
  max-width: 100%;
  max-height: 92vh;
  overflow-y: auto;
  box-sizing: border-box;
  padding: 32px 32px 28px;
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.08), 0 40px 120px -20px rgba(0, 0, 0, 0.45);
  font-family: "DM Sans", sans-serif;
  color: #0f172a;
}

.feedback-close {
  position: absolute;
  top: 16px;
  right: 16px;
  display: flex;
  padding: 6px;
  border: none;
  border-radius: 8px;
  background: none;
  color: #64748b;
  cursor: pointer;
}
.feedback-close:hover:not(:disabled) { color: #0f172a; background: #f1f5f9; }
.feedback-close:disabled { opacity: 0.4; cursor: not-allowed; }

.feedback-title {
  margin: 0 0 20px;
  font-family: "DM Serif Display", Georgia, serif;
  font-size: 1.6rem;
  font-weight: 400;
  letter-spacing: -0.02em;
}

.feedback-label {
  display: block;
  margin: 0 0 8px;
  padding: 0;
  font-size: 0.85rem;
  font-weight: 600;
  color: #334155;
}

.feedback-types {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin: 0 0 18px;
  padding: 0;
  border: none;
}

.feedback-type {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border: 1.5px solid #e2e8f0;
  border-radius: 12px;
  font-size: 0.88rem;
  cursor: pointer;
}
.feedback-type:has(input:checked) { border-color: #0f766e; background: #f0fdfa; }
.feedback-type input { margin: 0; accent-color: #0f766e; }

.feedback-textarea {
  display: block;
  width: 100%;
  box-sizing: border-box;
  padding: 12px 14px;
  border: 1.5px solid #cbd5e1;
  border-radius: 12px;
  background: #fafbfc;
  font: inherit;
  font-size: 0.9rem;
  color: #1e293b;
  resize: vertical;
}
.feedback-textarea:focus {
  outline: none;
  border-color: #0f766e;
  box-shadow: 0 0 0 3px rgba(15, 118, 110, 0.15);
  background: #fff;
}
.feedback-textarea::placeholder { color: #64748b; }

.feedback-count { margin: 6px 0 14px; text-align: right; font-size: 0.78rem; color: #5b6672; }

.feedback-contact { display: flex; align-items: center; gap: 8px; font-size: 0.88rem; color: #1e293b; cursor: pointer; }
.feedback-contact input { margin: 0; accent-color: #0f766e; }

.feedback-attached { margin: 10px 0 18px; font-size: 0.8rem; line-height: 1.45; color: #5b6672; }

.feedback-error {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin: 0 0 16px;
  padding: 11px 14px;
  border: 1px solid #fecaca;
  border-radius: 10px;
  background: #fef2f2;
  color: #b91c1c;
  font-size: 0.85rem;
}
.feedback-error-signin {
  padding: 5px 12px;
  border: 1px solid #b91c1c;
  border-radius: 8px;
  background: #fff;
  color: #b91c1c;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.feedback-actions { display: flex; justify-content: flex-end; gap: 10px; }

.feedback-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 11px 20px;
  border: 1.5px solid #cbd5e1;
  border-radius: 12px;
  background: #fff;
  color: #334155;
  font: inherit;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
}
.feedback-btn:disabled { opacity: 0.55; cursor: not-allowed; }
.feedback-btn--primary { border-color: #0f766e; background: #0f766e; color: #fff; }
.feedback-btn--primary:hover:not(:disabled) { border-color: #115e59; background: #115e59; }

.feedback-sent p { margin: 0 0 20px; font-size: 1rem; color: #166534; }

.feedback-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.5);
  border-top-color: #fff;
  border-radius: 50%;
  animation: feedback-spin 0.8s linear infinite;
}
@keyframes feedback-spin { to { transform: rotate(360deg); } }

/* Narrow screens: the card spans the full width, and the buttons stack at full width. */
@media (max-width: 640px) {
  .feedback-overlay { padding: 0; }
  .feedback-modal { width: 100%; max-height: 100vh; border-radius: 0; padding: 24px 16px; }
  .feedback-types { grid-template-columns: 1fr; }
  .feedback-actions { flex-direction: column-reverse; }
  .feedback-btn { width: 100%; }
}
```

**3d. Mounting.** In `frontend/src/main.tsx`:
- add `import { FeedbackProvider } from "./feedback/FeedbackContext";` after the `SessionBridgeProvider` import;
- replace `<App />` with:

```tsx
              <FeedbackProvider>
                <App />
              </FeedbackProvider>
```

In `frontend/src/App.tsx`:
- add `import FeedbackModal from "./feedback/FeedbackModal";` after `import SignInModal from "./SignInModal";`;
- replace `        <SignInModal />` with:

```tsx
        <SignInModal />
        <FeedbackModal />
```

- [ ] **Step 4: Run the tests to verify they pass, then all frontend checks**

Run, from `frontend/`: `npx vitest run src/feedback/FeedbackModal.test.tsx`
Expected: all pass.

Run, from `frontend/`: `npx tsc -b && npx vitest run && npm run build`
Expected: no type errors, every test file passes, and the build succeeds.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/feedback/FeedbackModal.tsx frontend/src/feedback/FeedbackModal.css frontend/src/feedback/FeedbackModal.test.tsx frontend/src/i18n/messages.ts frontend/src/main.tsx frontend/src/App.tsx
git commit -m "feat(feedback): feedback dialog with en/zh/es copy, mounted next to sign-in

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Entry points in the sidebar and the textbook panel

**Files:**
- Modify: `frontend/src/components/Sidebar.tsx`
- Modify: `frontend/src/components/Sidebar.css`
- Modify: `frontend/src/LearningModel.tsx`

**Interfaces:**
- Consumes:
  - `useFeedback()`, which supplies `openFeedback` and `registerPageContext` (Task 6);
  - the strings `feedback.sidebarItem`, `feedback.reportProblem` and `feedback.reportProblemTitle` (Task 7).
- Produces: the user-visible entry points. Nothing downstream depends on them.

Neither `Sidebar` nor `LearningModel` has a test harness: they need the router and five providers. This task is checked with `tsc`, the existing suite and the browser checks in Task 9.

- [ ] **Step 1: Add the sidebar item**

In `frontend/src/components/Sidebar.tsx`:

1. After `import { useLocale } from "../i18n/LocaleContext";` add:

```tsx
import { useFeedback } from "../feedback/FeedbackContext";
```

2. In the `I` icon set, after the `history` entry (the block ending `<path d="M12 8v4l3 2" />` / `</svg>` / `),`) add:

```tsx
  feedback: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
```

3. Replace

```tsx
  const { user, loading, logout, setShowSignIn } = useAuth();
  const { t } = useLocale();
```

with

```tsx
  const { user, loading, logout, setShowSignIn } = useAuth();
  const { t } = useLocale();
  const { openFeedback } = useFeedback();
```

4. Replace

```tsx
      <div className="sb-footer">
        {loading ? null : user ? (
```

with

```tsx
      <div className="sb-footer">
        {loading ? null : (
          <button
            type="button"
            className="sb-link sb-feedback"
            onClick={() => openFeedback()}
            title={t("feedback.sidebarItem")}
            aria-label={t("feedback.sidebarItem")}
          >
            <span className="sb-link-ic">{I.feedback}</span>
            <span className="sb-link-label">{t("feedback.sidebarItem")}</span>
          </button>
        )}
        {loading ? null : user ? (
```

In `frontend/src/components/Sidebar.css`:

1. After `.sb-signin:hover { background: rgba(94, 234, 212, 0.16); }` add:

```css
.sb-feedback { margin-bottom: 8px; }
```

2. Replace `.sb--collapsed .sb-footer { display: flex; justify-content: center; }` with:

```css
.sb--collapsed .sb-footer { display: flex; flex-direction: column; align-items: stretch; gap: 8px; }
.sb--collapsed .sb-feedback { margin-bottom: 0; }
```

- [ ] **Step 2: Add the textbook panel button and the page-context registration**

In `frontend/src/LearningModel.tsx`:

1. After `import { useLocale } from "./i18n/LocaleContext";` add:

```tsx
import { useFeedback } from "./feedback/FeedbackContext";
```

2. Replace `  const { token } = useAuth();` with:

```tsx
  const { token } = useAuth();
  const { openFeedback, registerPageContext } = useFeedback();
```

3. After `  const [sectionPageIndex, setSectionPageIndex] = useState(0);` add:

```tsx
  // Tell the feedback form which book, section and printed page are on screen.
  useEffect(() => {
    registerPageContext({
      bookId: textbookId,
      section: dataMatchedTopic?.name,
      page:
        dataMatchedTopic && referenceSectionPages?.length
          ? dataMatchedTopic.startBook + sectionPageIndex
          : undefined,
    });
  }, [registerPageContext, textbookId, dataMatchedTopic, referenceSectionPages, sectionPageIndex]);
  useEffect(() => () => registerPageContext(null), [registerPageContext]);
```

4. Replace

```tsx
              <div className="left-panel-topic-bar-actions">
                {activeSectionNote ? (
```

with

```tsx
              <div className="left-panel-topic-bar-actions">
                <button
                  type="button"
                  className="left-panel-hide-btn left-panel-hide-btn--in-bar left-panel-report-btn"
                  onClick={() => openFeedback({ type: "content" })}
                  title={t("feedback.reportProblemTitle")}
                >
                  {t("feedback.reportProblem")}
                </button>
                {activeSectionNote ? (
```

- [ ] **Step 3: Run all frontend checks**

Run, from `frontend/`: `npx tsc -b && npx vitest run && npm run build`
Expected: no type errors, every test file passes, and the build succeeds.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/Sidebar.tsx frontend/src/components/Sidebar.css frontend/src/LearningModel.tsx
git commit -m "feat(feedback): Feedback in the sidebar and Report a problem in the textbook panel

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Browser checks before the PR

No production code changes. This task verifies spec §6.3 in a real browser.

Use the gstack `/browse` skill (never the claude-in-chrome tools), with these quirks:
- Run `export PATH="$HOME/.bun/bin:$PATH"` first.
- Run browse from the session scratchpad, not from the repo. It appends `.gstack/` to a repo's `.gitignore`.
- Dismiss the onboarding tour with its "Skip tour" button.
- Accessibility snapshots hide names that contain ": ". Use JS DOM queries for those elements.

Put screenshots in the scratchpad, then copy them to `~/Desktop/feedback-preview/` and open them in Preview, because the user can't see images that only Claude read.

**Files:** none committed. Phase B's patches are thrown away before the end of the task.

- [ ] **Step 1: Start the local stack**

```bash
# Terminal 1: the backend, keyless (no backend/.env)
cd /Users/vnerald/ai_tutor/.worktrees/feedback-window/backend
OPENAI_API_KEY=sk-local-dummy-no-cost OPENAI_BASE_URL=http://127.0.0.1:9 \
  /Users/vnerald/ai_tutor/backend/.venv/bin/python -m uvicorn main:app --port 8000
# Terminal 2: the frontend, proxied to the local backend
cd /Users/vnerald/ai_tutor/.worktrees/feedback-window/frontend
DEV_API_PROXY_TARGET=http://127.0.0.1:8000 npm run dev -- --port 5173
```

Expected: the backend log shows `[Feedback] GitHub delivery disabled: FEEDBACK_GITHUB_TOKEN or FEEDBACK_GITHUB_REPO not set; feedback is stored in MongoDB only`.

- [ ] **Step 2: Phase A, signed out (real code)**

Without `VITE_FIREBASE_*`, auth is disabled, so the app is signed out.

1. Open `http://localhost:5173/learning` at 1440×900 and skip the tour.
2. Open a FOCS section from Learning progress. Its PDF is in the repo; the Lathi PDF isn't in the worktree.
3. **Report a problem.** It appears left of Note and Hide in the textbook header. Clicking it opens the **sign-in modal**, not the feedback dialog. Close the modal.
4. **Feedback.** Click it in the sidebar. The sign-in modal opens. Close it.
5. **Collapsed sidebar.** Collapse the sidebar. The speech-bubble icon sits above the sign-in icon, centred, and doesn't overflow. Take a screenshot. Expand the sidebar again.
6. **Tour.** Start the tour from the sidebar. Its Learning progress and History steps still highlight the right elements.

- [ ] **Step 3: Phase B, the dialog's look (throwaway patches; never commit them)**

1. In `frontend/src/feedback/FeedbackContext.tsx`, change `if (!user || user.isAnonymous) {` to `if (false) {`.
2. In `frontend/src/context/AuthContext.tsx`, change `return current ? current.getIdToken() : null;` to `return current ? current.getIdToken() : "local-dummy";`.
3. Restart the frontend with an unroutable proxy target, so every request hangs:

   ```bash
   DEV_API_PROXY_TARGET=http://10.255.255.1:9 npm run dev -- --port 5173
   ```

4. Screenshot the dialog at 1440×900:
   1. Open `/grades` and click **Feedback**. Screenshot the empty dialog.
   2. Choose **Suggestion** and type two lines. Screenshot.
   3. Click **Send**. Within 5 s, screenshot the sending state: spinner, controls disabled.
   4. Wait 31 s. Screenshot the "Couldn't send right now…" alert. The text must still be there.
5. Switch the viewport to 400×800, reopen the dialog and screenshot it. The card should span the width, with the buttons stacked.
6. Throw the patches away and confirm the tree is clean:

   ```bash
   cd /Users/vnerald/ai_tutor/.worktrees/feedback-window
   git checkout -- frontend/src/feedback/FeedbackContext.tsx frontend/src/context/AuthContext.tsx
   git status --short   # expect no output
   ```

- [ ] **Step 4: Stop both servers and report**

Report what each check showed and the screenshot paths. A failed check is a bug to fix: return to the task that owns that code, write a failing test for it, fix it, and re-run this task.

---

## After the plan: rollout

These steps need the user, or outward actions that need the user's go-ahead. They are not SDD tasks.

1. **The user sets up GitHub and Render, once:**
   - create the private repo `lius24/ai-tutor-feedback`;
   - create a fine-grained token with repository access set to that repo only and the permission Issues: Read and write;
   - add `FEEDBACK_GITHUB_TOKEN` and `FEEDBACK_GITHUB_REPO=lius24/ai-tutor-feedback` on Render.
2. **Labels.** After the user confirms, create the six labels:

   ```bash
   R=lius24/ai-tutor-feedback
   gh label create type:bug        --repo $R --color d73a4a --description "Something is broken"
   gh label create type:content    --repo $R --color e99695 --description "Wrong page or content"
   gh label create type:suggestion --repo $R --color 0e8a16 --description "Suggestion"
   gh label create type:other      --repo $R --color cfd3d7 --description "Other"
   gh label create book:focs       --repo $R --color 1d76db --description "FOCS"
   gh label create book:lathi      --repo $R --color 0f766e --description "Signals (Lathi)"
   ```

3. **The PR:**
   - Once PR #34 has merged, rebase `feat/feedback-window` onto `origin/function`, re-run both suites, push and open the PR.
   - The user merges it from the alt account, and Vercel deploys the frontend.
   - Deploy Render manually right away. Until Render is live, sends show "Couldn't send right now".
4. **After deploy** (spec §6.4):
   1. The Render log shows `[Feedback] GitHub delivery enabled (lius24/ai-tutor-feedback)`.
   2. The user, signed in on production, sends one report from the textbook panel on Signals §2.4 with the contact box unticked. Check that:
      - the issue appears;
      - it has the labels `type:content` and `book:lathi`;
      - the page is in its table;
      - it shows no email.

      Then close the issue.
   3. As a guest, both entry points open the sign-in modal.
