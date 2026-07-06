// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import Gradebook from "./Gradebook";
import { LocaleProvider } from "../i18n/LocaleContext";
import type { Course } from "./types";

afterEach(cleanup);

const course = (score: number | null = 95): Course => ({
  name: "C",
  term: "",
  categories: [
    {
      id: "c1",
      name: "Exams",
      weight: 100,
      rule: { kind: "uniform", nSlots: 1 },
      items: [{ id: "i1", name: "Exam 1", score, maxScore: 100 }],
    },
  ],
  cutoffs: [],
});

function renderGb(c: Course, onChange = vi.fn()) {
  render(
    <LocaleProvider>
      <Gradebook course={c} onChange={onChange} />
    </LocaleProvider>,
  );
  return onChange;
}

describe("Gradebook — editable max score + over-max warning", () => {
  it("editing the max score calls onChange with the new maxScore", () => {
    const onChange = renderGb(course());
    fireEvent.change(screen.getByLabelText("Exam 1 max score"), { target: { value: "50" } });
    expect(onChange).toHaveBeenCalled();
    const next = onChange.mock.calls[0][0] as Course;
    expect(next.categories[0].items[0].maxScore).toBe(50);
  });
  it("a score above the max shows the warning", () => {
    renderGb(course(120));
    expect(screen.getByText(/over the max/i)).toBeTruthy();
  });
  it("an in-range score shows no warning", () => {
    renderGb(course(95));
    expect(screen.queryByText(/over the max/i)).toBeNull();
  });
  it("blanking the max score falls back to 100 (never 0)", () => {
    const onChange = renderGb(course());
    fireEvent.change(screen.getByLabelText("Exam 1 max score"), { target: { value: "" } });
    expect((onChange.mock.calls[0][0] as Course).categories[0].items[0].maxScore).toBe(100);
  });
});
