"""Side-effect-free evaluation endpoints for AI Tutor.

See docs/agent-eval-workflow-design.md for architecture.
"""

from __future__ import annotations

import os
import time
import uuid
from typing import Any, Literal, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from deps import create_chat_completion
import learning_resources as lr
from evals.fixtures import load_practice_t1_cases, problem_from_fixture
from evals.practice_prompts import (
    build_grade_prompt,
    build_hint_prompt,
    parse_verdict,
    verdict_to_api,
)
from evals.runner import run_practice_t1_eval
from evals.config import EvalPipelineConfig
from evals.pipeline import run_simulate_evaluate

router = APIRouter(prefix="/api/eval", tags=["eval"])


def _eval_enabled() -> bool:
    return os.getenv("EVAL_MODE", "1").strip().lower() not in {"0", "false", "no", "off"}


def _require_eval_mode() -> None:
    if not _eval_enabled():
        raise HTTPException(status_code=404, detail="Eval endpoints are disabled (EVAL_MODE=0).")


MemoryMode = Literal["none", "read_only", "isolated_write"]


class EvalContext(BaseModel):
    textbook_id: str = "focs"
    section_hint: Optional[str] = None
    skip_topic_matching: bool = True
    inject_grades: bool = False
    inject_student_bar: bool = False
    memory_mode: MemoryMode = "none"
    temperature: float = 0.3


class ChatTurn(BaseModel):
    role: str
    content: str


class EvalTutorChatRequest(BaseModel):
    messages: list[ChatTurn] = Field(default_factory=list)
    message: Optional[str] = None
    context: EvalContext = Field(default_factory=EvalContext)
    eval_run_id: Optional[str] = None


class EvalPracticeProblem(BaseModel):
    id: str = "unknown"
    prompt: str
    solution: str
    rubric: str


class EvalPracticeGradeRequest(BaseModel):
    problem: EvalPracticeProblem
    student_attempt: str = ""
    eval_run_id: Optional[str] = None


class EvalPracticeHintRequest(BaseModel):
    problem: EvalPracticeProblem
    student_attempt: str = ""
    hint_rung: int = Field(ge=0, le=6, default=1)
    eval_run_id: Optional[str] = None


class OpenAIChatMessage(BaseModel):
    role: str
    content: str | list[Any]


class OpenAIChatCompletionsRequest(BaseModel):
    model: str = "gpt-5.2"
    messages: list[OpenAIChatMessage] = Field(default_factory=list)
    temperature: Optional[float] = None


def _book_label(textbook_id: str) -> str:
    if textbook_id == "focs":
        return "FOCS (Mathematics for Computer Science)"
    return "the textbook the student selected"


def _section_page_context(textbook_id: str, section_hint: str) -> tuple[str, Optional[dict[str, Any]]]:
    section_info = lr.get_section_start_end_name(section_hint)
    if not section_info:
        return "", None
    start_book, end_book, section_name = section_info
    start_pdf = start_book + lr.effective_pdf_page_offset()
    end_pdf = end_book + lr.effective_pdf_page_offset()
    ctx = ""
    _pdf = lr.get_effective_pdf_bytes()
    if _pdf:
        page_text = lr.extract_pdf_pages_text(_pdf, start_pdf, end_pdf)
        if page_text:
            ctx = (
                f"\n\n--- Textbook reference ({section_name}, PDF pp. {start_pdf}-{end_pdf}) ---\n"
                f"{page_text[:12000]}\n--- End ---"
            )
    matched = {
        "name": section_name,
        "start_book": start_book,
        "end_book": end_book,
        "start_pdf": start_pdf,
        "end_pdf": end_pdf,
    }
    return ctx, matched


def _build_eval_tutor_messages(
    turns: list[ChatTurn],
    context: EvalContext,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    metadata: dict[str, Any] = {
        "skip_topic_matching": context.skip_topic_matching,
        "inject_grades": context.inject_grades,
        "inject_student_bar": context.inject_student_bar,
        "memory_mode": context.memory_mode,
    }

    system_content = (
        f"You are an AI math tutor for {_book_label(context.textbook_id)}. "
        "Answer the student's question directly with a clear explanation and a short example when helpful. "
        "Never ask intake questions, never list optional sections, and never ask them to pick a chapter."
    )

    matched_topic: Optional[dict[str, Any]] = None
    if context.section_hint:
        page_ctx, matched_topic = _section_page_context(context.textbook_id, context.section_hint)
        if page_ctx:
            system_content += page_ctx
        metadata["section_hint"] = context.section_hint

    if not context.skip_topic_matching and turns:
        last_user = next((t.content for t in reversed(turns) if t.role == "user"), "")
        if last_user:
            try:
                matched = lr.match_topic_with_llm(last_user)
            except Exception as exc:
                matched = None
                metadata["topic_match_error"] = str(exc)
            if matched:
                matched_topic = {
                    "name": matched.get("name"),
                    "start_book": matched.get("start"),
                    "end_book": matched.get("end"),
                }
                _pdf = lr.get_effective_pdf_bytes()
                if _pdf:
                    s = matched["start"] + lr.effective_pdf_page_offset()
                    e = matched["end"] + lr.effective_pdf_page_offset()
                    mt_ctx = lr.extract_pdf_pages_text(_pdf, s, e)
                    if mt_ctx:
                        system_content += (
                            f"\n\n--- Reference from textbook ({matched.get('name')}, PDF pp. {s}-{e}) ---\n"
                            f"{mt_ctx[:12000]}\n--- End ---"
                        )

    messages: list[dict[str, Any]] = [{"role": "system", "content": system_content}]
    for turn in turns:
        role = turn.role if turn.role in {"system", "user", "assistant"} else "user"
        if role == "system":
            continue
        messages.append({"role": role, "content": turn.content})

    metadata["matched_topic"] = matched_topic
    return messages, metadata


def _call_eval_llm(prompt: str, *, temperature: float = 0.0) -> tuple[str, int]:
    started = time.perf_counter()
    resp = create_chat_completion(
        model="gpt-5.2",
        messages=[
            {
                "role": "system",
                "content": (
                    "You are an AI math tutor in evaluation mode. "
                    "Follow the user's instructions exactly."
                ),
            },
            {"role": "user", "content": prompt},
        ],
        temperature=temperature,
    )
    latency_ms = int((time.perf_counter() - started) * 1000)
    return (resp.choices[0].message.content or "").strip(), latency_ms


@router.get("/health")
async def eval_health():
    _require_eval_mode()
    return {
        "status": "ok",
        "eval_mode": True,
        "fixtures": {"practice_t1_cases": len(load_practice_t1_cases())},
    }


@router.post("/tutor/chat")
async def eval_tutor_chat(body: EvalTutorChatRequest):
    """Side-effect-free tutor chat for simulation and manual eval."""
    _require_eval_mode()

    turns = list(body.messages)
    if body.message:
        turns.append(ChatTurn(role="user", content=body.message))
    if not turns:
        raise HTTPException(status_code=400, detail="messages or message is required")

    tid = (body.context.textbook_id or "focs").strip() or "focs"
    with lr.request_book(tid, None):
        messages, meta = _build_eval_tutor_messages(turns, body.context)
        started = time.perf_counter()
        resp = create_chat_completion(
            model="gpt-5.2",
            messages=messages,
            temperature=body.context.temperature,
        )
        reply = (resp.choices[0].message.content or "").strip()
        meta["latency_ms"] = int((time.perf_counter() - started) * 1000)
        meta["eval_run_id"] = body.eval_run_id
        meta["tool_calls"] = []
        meta["memory_events_used"] = 0
        return {"reply": reply, "metadata": meta}


@router.post("/tutor/chat/completions")
async def eval_tutor_chat_completions(body: OpenAIChatCompletionsRequest):
    """OpenAI-compatible endpoint for ArkSim chat_completions adapter."""
    _require_eval_mode()

    turns: list[ChatTurn] = []
    context = EvalContext()
    for msg in body.messages:
        content = msg.content
        if isinstance(content, list):
            text_parts = [p.get("text", "") for p in content if isinstance(p, dict) and p.get("type") == "text"]
            content = "\n".join(text_parts)
        if msg.role == "system":
            continue
        turns.append(ChatTurn(role=msg.role, content=str(content)))

    req = EvalTutorChatRequest(
        messages=turns[:-1] if len(turns) > 1 else [],
        message=turns[-1].content if turns else None,
        context=context,
    )
    result = await eval_tutor_chat(req)
    return {
        "id": f"chatcmpl-{uuid.uuid4().hex[:24]}",
        "object": "chat.completion",
        "model": body.model,
        "choices": [
            {
                "index": 0,
                "message": {"role": "assistant", "content": result["reply"]},
                "finish_reason": "stop",
            }
        ],
    }


@router.post("/practice/grade")
async def eval_practice_grade(body: EvalPracticeGradeRequest):
    """Grade a free-response practice attempt (T1 eval core)."""
    _require_eval_mode()

    problem = body.problem.model_dump()
    prompt = build_grade_prompt(problem, body.student_attempt)
    raw_reply, latency_ms = _call_eval_llm(prompt, temperature=0.0)
    verdict = parse_verdict(raw_reply)
    feedback = raw_reply.split("\n", 1)[1].strip() if "\n" in raw_reply else ""
    return {
        "verdict": verdict_to_api(verdict),
        "feedback": feedback,
        "raw_reply": raw_reply,
        "metadata": {"latency_ms": latency_ms, "eval_run_id": body.eval_run_id},
    }


@router.post("/practice/hint")
async def eval_practice_hint(body: EvalPracticeHintRequest):
    """Return a rung-constrained practice hint."""
    _require_eval_mode()

    problem = body.problem.model_dump()
    prompt = build_hint_prompt(body.hint_rung, problem, body.student_attempt)
    raw_reply, latency_ms = _call_eval_llm(prompt, temperature=0.2)
    return {
        "hint": raw_reply,
        "metadata": {
            "hint_rung": body.hint_rung,
            "latency_ms": latency_ms,
            "eval_run_id": body.eval_run_id,
        },
    }


@router.post("/practice/run_t1")
async def eval_practice_run_t1():
    """Run all T1 practice grading fixtures and return pass/fail summary."""
    _require_eval_mode()
    return run_practice_t1_eval()


@router.get("/practice/fixtures/t1")
async def eval_practice_fixtures_t1():
    """List T1 fixture cases (without running LLM)."""
    _require_eval_mode()
    cases = load_practice_t1_cases()
    return {
        "count": len(cases),
        "cases": [
            {
                "id": c.get("id"),
                "expected_verdict": c.get("expected_verdict"),
                "description": c.get("description"),
                "problem_id": problem_from_fixture(c).get("id"),
            }
            for c in cases
        ],
    }


class SimulateEvaluateRequest(BaseModel):
    smoke: bool = True
    scenario_ids: Optional[list[str]] = None
    output_dir: Optional[str] = None


@router.post("/simulate-evaluate")
async def eval_simulate_evaluate(body: SimulateEvaluateRequest):
    """Run ArkSim-style simulate → evaluate → report pipeline."""
    _require_eval_mode()
    config = EvalPipelineConfig.from_yaml()
    result = run_simulate_evaluate(
        config,
        output_dir=body.output_dir,
        scenario_ids=body.scenario_ids,
        smoke=body.smoke,
    )
    return result
