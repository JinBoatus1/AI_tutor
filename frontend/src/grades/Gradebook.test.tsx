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

describe("Gradebook — transparency (per-category subtotal + replace boost)", () => {
  const render3 = (extra: {
    catStandings?: { name: string; weight: number; percent: number | null; graded: boolean }[] | null;
    boosts?: { categoryName: string; replacer: string; lifted: string; deltaPct: number }[] | null;
  }) =>
    render(
      <LocaleProvider>
        <Gradebook course={course()} onChange={vi.fn()} {...extra} />
      </LocaleProvider>,
    );

  it("shows the per-category subtotal when the category is graded", () => {
    render3({ catStandings: [{ name: "Exams", weight: 100, percent: 92, graded: true }], boosts: [] });
    expect(screen.getByText(/92%/)).toBeTruthy();
    expect(screen.getByText(/so far/i)).toBeTruthy();
  });
  it("hides the subtotal when the category has no grades", () => {
    render3({ catStandings: [{ name: "Exams", weight: 100, percent: null, graded: false }], boosts: [] });
    expect(screen.queryByText(/so far/i)).toBeNull();
  });
  it("renders a replace-boost note for the matching category", () => {
    render3({ boosts: [{ categoryName: "Exams", replacer: "Final", lifted: "Midterm 2", deltaPct: 3.2 }] });
    expect(screen.getByText(/Final/)).toBeTruthy();
    expect(screen.getByText(/Midterm 2/)).toBeTruthy();
    expect(screen.getByText(/\+3\.2%/)).toBeTruthy();
  });
  it("shows no boost note when there are none", () => {
    render3({ boosts: [] });
    expect(screen.queryByText(/replaced/i)).toBeNull();
  });
});
