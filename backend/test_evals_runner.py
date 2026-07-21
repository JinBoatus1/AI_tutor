"""Runner tests without importing the FastAPI app."""

from evals.runner import run_practice_t1_eval


def test_run_t1_with_mock_grader():
    def fake_grade(prompt: str) -> str:
        if "weather today" in prompt:
            return "VERDICT: INCORRECT\nOff topic."
        if 'STUDENT SUBMISSION: """"""' in prompt:
            return "VERDICT: INCOMPLETE\nNo work shown."
        if "Assume n is even." in prompt and "Assume n is not even" not in prompt:
            return "VERDICT: INCORRECT\nWrong assumption."
        if "obvious" in prompt.lower():
            return "VERDICT: INCOMPLETE\nToo hand-wavy."
        return "VERDICT: CORRECT\nLooks good."

    summary = run_practice_t1_eval(grade_fn=fake_grade)
    assert summary["total"] == 5
    assert summary["passed"] == 5
    assert summary["go"] is True
