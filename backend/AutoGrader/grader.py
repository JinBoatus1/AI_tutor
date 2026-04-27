import argparse
import asyncio
import base64
import io
import json
import tempfile
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any

import fitz
from PIL import Image

from deps import create_chat_completion
from .models import (
    AutoGradeJobResultsResponse,
    AutoGradeJobStatusResponse,
    AutoGradeJobSubmitRequest,
    AutoGradeJobSubmitResponse,
    AutoGradePaperResult,
    AutoGradeResult,
    EvaluationResult,
    GradeTaskItem,
    PaperQuestionAnswerPairs,
    QuestionAnswerPdfPair,
)
from .recognizer import QuestionAnswerRecognizer
from .question_splitter import DocumentSplitter, QuestionDetector, QuestionSplitter


class AutoGraderBase(ABC):
    @abstractmethod
    async def submit_job(self, request: AutoGradeJobSubmitRequest) -> AutoGradeJobSubmitResponse:
        """Submit a batch of grading tasks."""

    @abstractmethod
    async def get_job_status(self, job_id: str) -> AutoGradeJobStatusResponse:
        """Check the status of a job."""

    @abstractmethod
    async def get_job_results(self, job_id: str) -> AutoGradeJobResultsResponse:
        """Fetch all paper results for a job."""


class SchedulerBase(ABC):
    @abstractmethod
    async def enqueue(self, request: AutoGradeJobSubmitRequest) -> str:
        """Enqueue a batch grading request."""

    @abstractmethod
    async def cancel(self, job_id: str) -> None:
        """Cancel a job that has not finished yet."""


class EvaluatorBase(ABC):
    @abstractmethod
    async def evaluate(self, task: GradeTaskItem) -> EvaluationResult:
        """Evaluate one paper with a single criterion or model."""


class AggregatorBase(ABC):
    @abstractmethod
    def aggregate(self, paper_id: str, results: list[EvaluationResult]) -> AutoGradeResult:
        """Aggregate multiple evaluator outputs into a final score."""


class WorkerPoolBase(ABC):
    @abstractmethod
    async def submit(self, task: GradeTaskItem) -> AutoGradePaperResult:
        """Submit one paper to a worker for execution."""


# TODO: Implement the scheduler, worker pool, and aggregator in a concrete module later.


class AutoGraderEntry:
    """Minimal runnable entry that pairs one question paper with one answer paper, then scores each pair once."""

    def __init__(self) -> None:
        self._papers: dict[str, PaperQuestionAnswerPairs] = {}
        self._scores: dict[str, dict[str, dict[str, Any]]] = {}
        self._paper_temp_dirs: dict[str, Path] = {}
        self._recognizer = QuestionAnswerRecognizer()

    @staticmethod
    def _load_document_bytes(source_path: str | Path) -> bytes:
        path = Path(source_path)
        if path.suffix.lower() == ".pdf":
            return path.read_bytes()

        image = Image.open(path)
        if image.mode != "RGB":
            image = image.convert("RGB")
        return QuestionSplitter.image_to_pdf_bytes(image)

    @staticmethod
    def _normalize_pair_label(label: str) -> str:
        return QuestionDetector.normalize_question_label(label)

    @staticmethod
    def _pdf_first_page_to_b64(pdf_bytes: bytes, dpi: int = 150) -> str:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        page = doc[0]
        pix = page.get_pixmap(dpi=dpi)
        doc.close()
        return base64.b64encode(pix.tobytes("png")).decode("utf-8")

    @staticmethod
    def _parse_score_map(raw_text: str) -> dict[str, dict[str, Any]]:
        cleaned = raw_text.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("```", 1)[1].strip()
            if cleaned.lower().startswith("json"):
                cleaned = cleaned[4:].strip()
        parsed = json.loads(cleaned)
        if isinstance(parsed, dict) and "scores" in parsed and isinstance(parsed["scores"], dict):
            parsed = parsed["scores"]
        if not isinstance(parsed, dict):
            raise ValueError("LLM scoring output must be a JSON object")

        scores: dict[str, dict[str, Any]] = {}
        for key, value in parsed.items():
            label = QuestionDetector.normalize_question_label(str(key))
            if isinstance(value, dict):
                score_item = dict(value)
                if "score" in score_item:
                    try:
                        score_item["score"] = float(score_item["score"])
                    except (TypeError, ValueError):
                        pass
                if "max_score" in score_item and score_item["max_score"] is not None:
                    try:
                        score_item["max_score"] = float(score_item["max_score"])
                    except (TypeError, ValueError):
                        pass
                if "mode" not in score_item:
                    score_item["mode"] = "absolute" if score_item.get("max_score") is not None else "percentage"
                scores[label] = score_item
                continue

            try:
                numeric_score = float(value)
            except (TypeError, ValueError):
                continue
            scores[label] = {"score": numeric_score, "mode": "percentage"}
        return scores

    @staticmethod
    def _save_pairs_to_temp_dir(paper_id: str, pairs: list[QuestionAnswerPdfPair]) -> Path:
        temp_root = Path(tempfile.mkdtemp(prefix=f"autograder_{paper_id}_"))
        for index, pair in enumerate(pairs, start=1):
            normalized_label = QuestionDetector.normalize_question_label(pair.question_label)
            question_path = temp_root / f"pair_{index:02d}_q_{normalized_label}.pdf"
            answer_path = temp_root / f"pair_{index:02d}_a_{normalized_label}.pdf"
            question_path.write_bytes(pair.question_pdf)
            answer_path.write_bytes(pair.answer_pdf)
        return temp_root

    async def pair_paper(self, paper_id: str, question_source: str | Path, answer_source: str | Path) -> PaperQuestionAnswerPairs:
        """Pair one question paper and one answer paper, save temp artifacts, and keep the paper registry."""
        question_pdf = self._load_document_bytes(question_source)
        answer_pdf = self._load_document_bytes(answer_source)

        pairs = await DocumentSplitter.build_question_answer_pairs(
            question_pdf,
            answer_pdf,
            detection_method="llm",
        )

        temp_dir = self._save_pairs_to_temp_dir(paper_id, pairs)
        record = PaperQuestionAnswerPairs(
            paper_id=paper_id,
            pairs=pairs,
            metadata={
                "temp_dir": str(temp_dir),
                "question_source": str(question_source),
                "answer_source": str(answer_source),
                "pair_count": len(pairs),
            },
        )
        self._papers[paper_id] = record
        self._paper_temp_dirs[paper_id] = temp_dir
        return record

    async def score_paper(self, paper_id: str) -> dict[str, dict[str, Any]]:
        """Recognize each pair first, then score only the pairs that are clear enough to grade."""
        paper = self._papers.get(paper_id)
        if paper is None or not paper.pairs:
            self._scores[paper_id] = {}
            return {}

        inspections = await self._recognizer.inspect_pairs(paper.pairs)
        inspect_by_label = {
            self._normalize_pair_label(label): data
            for label, data in inspections.items()
        }

        scored_pairs: list[tuple[QuestionAnswerPdfPair, dict[str, Any]]] = []
        scores: dict[str, dict[str, Any]] = {}

        for pair in paper.pairs:
            label = self._normalize_pair_label(pair.question_label)
            inspection = inspect_by_label.get(label)
            if not inspection:
                scores[label] = {
                    "score": None,
                    "mode": "manual_review",
                    "max_score": None,
                    "manual_review": True,
                    "reason": "Recognition output was missing for this pair",
                }
                continue

            if not inspection.get("can_grade", False):
                scores[label] = {
                    "score": None,
                    "mode": "manual_review",
                    "max_score": None,
                    "manual_review": True,
                    "reason": inspection.get("reason") or "The pair is not clear enough for automatic grading",
                    "question_text": inspection.get("question_text"),
                    "answer_text": inspection.get("answer_text"),
                }
                continue

            scored_pairs.append((pair, inspection))

        if not scored_pairs:
            self._scores[paper_id] = scores
            return scores

        system_msg = (
            "You are grading an exam. The recognized question_text and answer_text are the primary inputs. Use the page images only to verify unclear OCR or layout details. "
            "For each question-answer pair, first inspect the recognized text and determine the maximum points for that question. "
            "If the max points are explicit or can be inferred from the question/rubric, score with that absolute max and return score plus max_score. "
            "If the recognized text is too noisy, incomplete, contradictory, or otherwise not trustworthy, mark the pair for manual review instead of guessing a score. "
            "If the max points are not found but the pair is still clear enough to grade, return a percentage score from 0 to 100 and set mode to percentage. "
            "Return ONLY valid JSON. Use the shape: {\"scores\": {\"5\": {\"score\": 12, \"max_score\": 16, \"mode\": \"absolute\"}, \"6\": {\"score\": 86, \"mode\": \"percentage\"}}}."
        )
        user_parts: list[dict[str, Any]] = [
            {
                "type": "text",
                "text": (
                    "You will receive several question-answer pairs. For each pair, read the transcribed question and answer text carefully; use the page images only to resolve OCR mistakes or layout ambiguity. "
                    "Determine the full score for that question if it is visible or inferable from the paper. "
                    "If the full score is visible/inferable, return an absolute score and max_score. "
                    "If the text is not trustworthy enough to score, return manual_review metadata instead of guessing. "
                    "Otherwise return a percentage score and set mode to percentage. "
                    "Return only a JSON object mapping the question label to a score object."
                ),
            }
        ]

        for pair, inspection in scored_pairs:
            label = self._normalize_pair_label(pair.question_label)
            question_text = (inspection.get("question_text") or "").strip()
            answer_text = (inspection.get("answer_text") or "").strip()
            user_parts.append({"type": "text", "text": f"QUESTION {label}"})
            if question_text:
                user_parts.append({"type": "text", "text": f"Recognized question text: {question_text}"})
            user_parts.append({"type": "image_url", "image_url": {"url": f"data:image/png;base64,{self._pdf_first_page_to_b64(pair.question_pdf)}"}})
            user_parts.append({"type": "text", "text": f"ANSWER {label}"})
            if answer_text:
                user_parts.append({"type": "text", "text": f"Recognized answer text: {answer_text}"})
            user_parts.append({"type": "image_url", "image_url": {"url": f"data:image/png;base64,{self._pdf_first_page_to_b64(pair.answer_pdf)}"}})

        resp = create_chat_completion(
            model="gpt-5.2",
            messages=[
                {"role": "system", "content": system_msg},
                {"role": "user", "content": user_parts},
            ],
            temperature=0.0,
        )
        raw_text = resp.choices[0].message.content or ""
        scored_map = self._parse_score_map(raw_text)
        for pair, _inspection in scored_pairs:
            label = self._normalize_pair_label(pair.question_label)
            if label not in scored_map:
                scored_map[label] = {
                    "score": None,
                    "mode": "manual_review",
                    "max_score": None,
                    "manual_review": True,
                    "reason": "The scorer did not return a result for this pair",
                }
        scores.update(scored_map)
        self._scores[paper_id] = scores
        return scores

    async def pair_and_score_paper(self, paper_id: str, question_source: str | Path, answer_source: str | Path) -> dict[str, Any]:
        """Pair one question paper with one answer paper and score all pairs in a single LLM call."""
        record = await self.pair_paper(paper_id, question_source, answer_source)
        scores = await self.score_paper(paper_id)
        return {
            "paper_id": record.paper_id,
            "pair_count": len(record.pairs),
            "temp_dir": record.metadata.get("temp_dir"),
            "pairs": [pair.question_label for pair in record.pairs],
            "scores": scores,
        }

    def get_paper(self, paper_id: str) -> PaperQuestionAnswerPairs:
        return self._papers.get(
            paper_id,
            PaperQuestionAnswerPairs(paper_id=paper_id, pairs=[], metadata={"status": "not_found"}),
        )

    def get_scores(self, paper_id: str) -> dict[str, dict[str, Any]]:
        return dict(self._scores.get(paper_id, {}))


async def _run_cli() -> None:
    parser = argparse.ArgumentParser(description="Pair a question paper with its answer paper and save temp crops.")
    parser.add_argument("--paper-id", required=True, help="Paper identifier")
    parser.add_argument("--question", required=True, help="Question paper image or PDF path")
    parser.add_argument("--answer", required=True, help="Answer paper image or PDF path")
    args = parser.parse_args()

    entry = AutoGraderEntry()
    result = await entry.pair_and_score_paper(args.paper_id, args.question, args.answer)
    print(
        json.dumps(
            result,
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    asyncio.run(_run_cli())
