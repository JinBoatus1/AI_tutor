from __future__ import annotations

import json
import sys
from pathlib import Path

import httpx


def main() -> None:
    base_url = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000"
    test_dir = Path(__file__).resolve().parent / "test_pdfs"
    question_bytes = (test_dir / "Q5Q6.jpg").read_bytes()
    answer_bytes = (test_dir / "Answer.jpg").read_bytes()

    with httpx.Client(timeout=600.0) as client:
        response = client.post(
            f"{base_url.rstrip('/')}/api/autograder/grade-batch",
            data={"batch_id": "live-q5q6-batch"},
            files=[
                ("question_file", ("Q5Q6.jpg", question_bytes, "image/jpeg")),
                ("answer_files", ("Student_A.jpg", answer_bytes, "image/jpeg")),
                ("answer_files", ("Student_B.jpg", answer_bytes, "image/jpeg")),
            ],
        )

    response.raise_for_status()
    payload = response.json()
    papers = payload.get("papers", [])
    assert payload.get("paper_count") == 2
    assert len(papers) == 2
    assert len({paper["paper_id"] for paper in papers}) == 2
    worker_report = payload.get("worker_report") or {}
    assert worker_report.get("batches_completed") == 1
    assert worker_report.get("attempts_completed") == 2
    assert worker_report.get("manual_review_count") == 2
    assert worker_report.get("failed_batches") == 0

    for paper in papers:
        for score in paper["scores"].values():
            assert score["paper_instance_id"] == paper["paper_id"]
            assert score["question_attempt_id"].startswith(f"{paper['paper_id']}:")

    summary = {
        "status_code": response.status_code,
        "paper_count": payload["paper_count"],
        "worker_report": payload.get("worker_report"),
        "papers": [
            {
                "paper_id": paper["paper_id"],
                "display_name": paper["display_name"],
                "pair_count": paper["pair_count"],
                "question_labels": list(paper["scores"]),
                "scores": {
                    label: {
                        "score": item["score"],
                        "max_score": item["max_score"],
                        "confidence": item["confidence"],
                        "agent_count": item["agent_count"],
                        "arbitrated": item["arbitrated"],
                        "feedback_summary": (item.get("feedback") or {}).get("summary"),
                    }
                    for label, item in paper["scores"].items()
                },
                "total_score": paper["total_score"],
                "total_max_score": paper["total_max_score"],
            }
            for paper in papers
        ],
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
