# Auto Grader

Auto Grader lets you upload a question paper and, optionally, an answer paper, then returns per-question scores with a single grading request.

## Current UI

The current Auto Grader page contains:

- one upload box for the question paper
- one optional upload box for the answer paper
- one optional Grading Criteria text area
- one `Start Grading` button

Supported file types for both inputs:

- `.pdf`
- `.jpg`
- `.jpeg`
- `.png`

The backend also accepts other image formats supported by Pillow, but the formats above are the tested ones.

## How It Works

1. Upload the question file.
2. Optionally upload the answer file.
3. Optionally enter Grading Criteria.
4. Click `Start Grading`.
5. If an answer file is supplied, the backend pairs the question and answer content.
6. If no answer file is supplied, the backend splits the question paper, derives reference answers, and scores from the question content.
7. The page shows each question score.
8. If every question is graded with an absolute score, the UI also shows the total score.

If at least one question falls back to percentage mode, the UI shows only the per-question scores and does not compute a total.

## Multi-Agent Scoring

Scoring is performed per question, not per paper:

1. Recognition runs once for the cropped question-answer pairs.
2. Three independent evaluators score each gradeable question concurrently:
   - `solution_verifier`
   - `rubric_grader`
   - `critical_reviewer`
3. A deterministic aggregator compares normalized scores, score modes, and maximum marks.
4. Material disagreement is sent to an arbitration evaluator.
5. Unresolved disagreement or insufficient valid evaluator output becomes `manual_review`.

Each result is owned by a concrete `paper_instance_id` and `question_attempt_id`. The
`canonical_question_id` is only used to group the same question across papers in the
background. It must not be used to attach one student's feedback to another paper.

The in-memory question pool can lease a `QuestionBatchTask` containing the same
canonical question from multiple papers. Batches with different rubric versions or
grading criteria are kept separate.

Optional environment settings:

- `AUTOGRADER_MODEL` (default `gpt-5.2`)
- `AUTOGRADER_MAX_CONCURRENCY` (default `6`)
- `AUTOGRADER_EVALUATOR_RETRIES` (default `1`)
- `AUTOGRADER_DISAGREEMENT_THRESHOLD` (default `0.15`)
- `AUTOGRADER_ENABLE_ARBITRATION` (default enabled)

## API Contract

The public entry point is defined in `public_api.py`:

- request model: `AutoGraderGradeRequest`
- response model: `AutoGraderGradeResponse`
- helper function: `grade_paper_once(request)`

File:

- `backend/AutoGrader/public_api.py`

### Request Fields

`AutoGraderGradeRequest` uses the following fields:

- `paper_id: string`
  - A traceable identifier for the submission
- `question_source: string`
  - Path to the question paper file
- `answer_source: string | null`
  - Optional path to the answer paper file
- `grading_criteria: string | null`
  - Optional user-supplied grading rules that are included in the scoring prompt

### Response Fields

`AutoGraderGradeResponse` returns:

- `paper_id: string`
  - Echoes the original request id
- `pair_count: int`
  - Number of matched question-answer pairs
- `grading_mode: "question_answer" | "question_only"`
  - `question_answer` when an answer file was provided
  - `question_only` when the grader derived reference answers from the question paper
- `temp_dir: string | null`
  - Internal temporary directory for cropped pair PDFs
  - The web API removes this directory after the request finishes
- `pairs: list[string]`
  - Normalized question labels, for example `['5', '6']`
- `scores: dict[string, AutoGraderScoreItem]`
  - Question label -> score object
- `all_absolute: bool`
  - `true` only when every question has an absolute score
- `total_score: float | null`
  - Sum of absolute scores when `all_absolute = true`
- `total_max_score: float | null`
  - Sum of full marks when `all_absolute = true`

### Score Item

`AutoGraderScoreItem` contains:

- `score: float`
  - The awarded score
- `mode: "absolute" | "percentage"`
  - `absolute`: the model identified or inferred full marks for the question
  - `percentage`: the model could not determine full marks, so it returned a percentage score
- `max_score: float | null`
  - Full marks for the question when `mode = "absolute"`
- `paper_instance_id: string`
  - Concrete paper that owns the result
- `question_attempt_id: string`
  - Concrete answer attempt that owns the result and feedback
- `canonical_question_id: string`
  - Background grouping identity for the standard question
- `confidence: int`
  - Deterministic 0-100 agreement score
- `consensus: "high" | "medium" | "low"`
- `agent_count: int`
  - Number of valid independent evaluator results
- `arbitrated: bool`
- `feedback: object`
  - Attempt-specific summary, awarded points, deductions, evidence, and suggestion

## Grading Rule

The grader tries to determine the full marks for each question before scoring.

- If full marks are found or can be inferred:
  - the score is returned in `absolute` mode
  - `score` and `max_score` are both shown
- If full marks cannot be determined:
  - the score is returned in `percentage` mode
  - `score` is shown as a 0-100 percentage
  - `max_score` is `null`

## Example

The example below uses the test assets `Q5Q6.jpg` and `Answer.jpg`.

```python
import asyncio

from AutoGrader.public_api import AutoGraderGradeRequest, grade_paper_once


async def main() -> None:
    request = AutoGraderGradeRequest(
        paper_id="demo-q5q6",
        question_source=r"h:\work_space\AI_tutor\backend\AutoGrader\test_pdfs\Q5Q6.jpg",
        answer_source=r"h:\work_space\AI_tutor\backend\AutoGrader\test_pdfs\Answer.jpg",
    )

    response = await grade_paper_once(request)

    print("paper_id:", response.paper_id)
    print("pair_count:", response.pair_count)
    print("pairs:", response.pairs)
    print("scores:")
    for qid, item in response.scores.items():
        if item.mode == "absolute" and item.max_score is not None:
            print(f"  Q{qid}: {item.score}/{item.max_score}")
        else:
            print(f"  Q{qid}: {item.score}%")

    if response.all_absolute and response.total_score is not None and response.total_max_score is not None:
        print("total:", f"{response.total_score}/{response.total_max_score}")


if __name__ == "__main__":
    asyncio.run(main())
```

## Example Output

```text
paper_id: demo-q5q6
pair_count: 2
pairs: ['5', '6']
scores:
  Q5: 14.0/16.0
  Q6: 2.0/14.0
total: 16.0/30.0
```

If any question is returned in percentage mode, the `total` line is omitted.

## Notes

- The API removes uploaded temporary files after grading.
- The API also removes the generated cropped pair directory after the request finishes.
- For the most stable results, use clear scans or well-cropped images.
