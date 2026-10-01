"""In-app feedback: validate a student's report, then file it as a GitHub issue.

The route in api_routes.py checks auth and the rate limit, then calls into this module.
Design: docs/superpowers/specs/2026-10-01-in-app-feedback-design.md
"""

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
