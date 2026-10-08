"""The topic matcher is offered the book's whole outline, not just its first 120 topics.

Keyless: the model call is replaced by a fake that records the prompt.
"""

import json
from types import SimpleNamespace

import pytest

import builtin_books as bb
import learning_resources as lr


@pytest.fixture
def prompts(monkeypatch):
    seen = []

    def fake_completion(**kwargs):
        seen.append(kwargs["messages"][0]["content"])
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content="UNRELATED"))])

    monkeypatch.setattr(lr, "create_chat_completion", fake_completion)
    return seen


def _offered(prompt):
    return [line[2:] for line in prompt.splitlines() if line.startswith("- ")]


def test_every_focs_topic_is_offered_to_the_matcher(prompts):
    with lr.request_book("focs", None):
        topics = [t["name"] for t in lr.load_focs_topic_list()]
        lr.match_topic_with_llm("What is the expected value of a sum of random variables?")
    offered = _offered(prompts[-1])
    assert len(topics) > 120
    assert "18 Random Variables" in offered
    assert offered == topics


@pytest.fixture
def huge_book(tmp_path, monkeypatch):
    """A builtin book with 2,000 short sections, far more than any prompt should carry."""
    book = tmp_path / "books" / "hugebook"
    book.mkdir(parents=True)
    (book / "meta.json").write_text(json.dumps({"id": "hugebook", "display_name": "Huge", "pdf_page_offset": 0}))
    outline = {
        "1 Everything": {
            "_range": {"start": 1, "end": 2000},
            **{f"1.{i} Topic {i}": {"start": i, "end": i} for i in range(1, 2001)},
        }
    }
    (book / "outline.json").write_text(json.dumps(outline))
    monkeypatch.setattr(bb, "BOOKS_DIR", str(tmp_path / "books"))
    bb.invalidate_cache()
    yield
    bb.invalidate_cache()


def test_a_very_long_outline_is_offered_up_to_the_budget(prompts, huge_book):
    with lr.request_book("hugebook", None):
        lr.match_topic_with_llm("anything")
    offered = _offered(prompts[-1])
    assert len(offered) > 120
    assert offered[0] == "1 Everything"
    assert sum(len(n) + 3 for n in offered) <= 12000
