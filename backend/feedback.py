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
