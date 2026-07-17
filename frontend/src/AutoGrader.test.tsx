// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AutoGrader from "./AutoGrader";
import { LocaleProvider } from "./i18n/LocaleContext";

function paperResult(paperId: string, displayName: string, summary: string, score: number) {
  return {
    paper_id: paperId,
    display_name: displayName,
    pair_count: 1,
    grading_mode: "question_answer",
    pairs: ["5"],
    all_absolute: true,
    total_score: score,
    total_max_score: 10,
    scores: {
      "5": {
        score,
        mode: "absolute",
        max_score: 10,
        paper_instance_id: paperId,
        question_attempt_id: `${paperId}:1:5`,
        confidence: 92,
        consensus: "high",
        agent_count: 3,
        arbitrated: false,
        feedback: {
          summary,
          awarded_points: [`${displayName} awarded point`],
          deductions: [],
          evidence: [],
          suggestion: null,
        },
      },
    },
  };
}

describe("AutoGrader batch results", () => {
  beforeEach(() => {
    localStorage.setItem("ai_tutor_system_locale", "en");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("uploads several answer files and keeps feedback scoped to the selected paper", async () => {
    const response = {
      paper_count: 2,
      papers: [
        paperResult("batch-1", "Student A.pdf", "Feedback only for student A", 8),
        paperResult("batch-2", "Student B.pdf", "Feedback only for student B", 6),
      ],
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => response,
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(
      <LocaleProvider>
        <AutoGrader />
      </LocaleProvider>,
    );

    await user.upload(
      screen.getByLabelText("Upload question file"),
      new File(["question"], "Questions.pdf", { type: "application/pdf" }),
    );
    await user.upload(screen.getByLabelText("Upload answer file"), [
      new File(["answer-a"], "Student A.pdf", { type: "application/pdf" }),
      new File(["answer-b"], "Student B.pdf", { type: "application/pdf" }),
    ]);
    await user.click(screen.getByRole("button", { name: "Start grading" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const [requestUrl, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(requestUrl).toBe("/api/autograder/grade-batch");
    const formData = requestInit.body as FormData;
    expect(formData.getAll("answer_files")).toHaveLength(2);
    expect(formData.getAll("answer_display_names")).toEqual(["Student A.pdf", "Student B.pdf"]);

    expect(await screen.findByText("Feedback only for student A")).toBeInTheDocument();
    expect(screen.queryByText("Feedback only for student B")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /Student B\.pdf/ }));
    expect(await screen.findByText("Feedback only for student B")).toBeInTheDocument();
    expect(screen.queryByText("Feedback only for student A")).not.toBeInTheDocument();
    expect(screen.getByText("batch-2")).toBeInTheDocument();
  });

  it("imports only PDFs from a folder and submits their relative paths", async () => {
    const response = {
      paper_count: 2,
      papers: [
        paperResult("folder-1", "Class A/Student.pdf", "Class A feedback", 9),
        paperResult("folder-2", "Class B/Student.pdf", "Class B feedback", 7),
      ],
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => response,
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(
      <LocaleProvider>
        <AutoGrader />
      </LocaleProvider>,
    );

    await user.upload(
      screen.getByLabelText("Upload question file"),
      new File(["question"], "Questions.pdf", { type: "application/pdf" }),
    );
    const classAPdf = new File(["answer-a"], "Student.pdf", { type: "application/pdf" });
    const classBPdf = new File(["answer-b"], "Student.pdf", { type: "application/pdf" });
    const ignoredImage = new File(["image"], "scan.png", { type: "image/png" });
    Object.defineProperty(classAPdf, "webkitRelativePath", { value: "Class A/Student.pdf" });
    Object.defineProperty(classBPdf, "webkitRelativePath", { value: "Class B/Student.pdf" });
    Object.defineProperty(ignoredImage, "webkitRelativePath", { value: "Class B/scan.png" });

    const folderInput = screen.getByLabelText("Upload answer folder");
    expect(folderInput).toHaveAttribute("webkitdirectory");
    expect(folderInput).toHaveAttribute("accept", ".pdf,application/pdf");
    fireEvent.change(folderInput, {
      target: { files: [classBPdf, ignoredImage, classAPdf] },
    });

    expect(screen.getByText("Class A/Student.pdf")).toBeInTheDocument();
    expect(screen.getByText("Class B/Student.pdf")).toBeInTheDocument();
    expect(screen.queryByText("Class B/scan.png")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Start grading" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const formData = requestInit.body as FormData;
    expect(formData.getAll("answer_files")).toHaveLength(2);
    expect(formData.getAll("answer_display_names")).toEqual([
      "Class A/Student.pdf",
      "Class B/Student.pdf",
    ]);
  });
});
