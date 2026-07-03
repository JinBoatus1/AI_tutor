// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import RubricEditor from "./RubricEditor";
import { LocaleProvider } from "../i18n/LocaleContext";
import type { Course } from "./types";

afterEach(cleanup);

const threeTests = (): Course => ({
  name: "Logic",
  term: "",
  categories: [
    {
      id: "tests",
      name: "Tests",
      weight: 50,
      rule: { kind: "uniform", nSlots: 3 },
      items: [
        { id: "t1", name: "Test #1", score: null, maxScore: 100 },
        { id: "t2", name: "Test #2", score: null, maxScore: 100 },
        { id: "t3", name: "Test #3", score: null, maxScore: 100 },
      ],
    },
  ],
  cutoffs: [
    { letter: "A", min: 90 },
    { letter: "F", min: 0 },
  ],
});

function renderEditor(course: Course) {
  const onChange = vi.fn();
  const onConfirm = vi.fn();
  render(
    <LocaleProvider>
      <RubricEditor course={course} parsed={false} onChange={onChange} onConfirm={onConfirm} onCancel={vi.fn()} />
    </LocaleProvider>,
  );
  return { onChange, onConfirm };
}

describe("RubricEditor — the core gap: 10/15/25 in ONE category", () => {
  it("Custom weights mode exposes a per-row weight and validates the sum", () => {
    renderEditor(threeTests());
    // uniform mode: no per-row weight inputs yet
    expect(screen.queryByLabelText("Test #1 weight")).toBeNull();

    fireEvent.click(screen.getByRole("radio", { name: /custom weights/i }));
    // now each row carries a weight; set the syllabus's distinct 10 / 15 / 25
    fireEvent.change(screen.getByLabelText("Test #1 weight"), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText("Test #2 weight"), { target: { value: "15" } });
    fireEvent.change(screen.getByLabelText("Test #3 weight"), { target: { value: "25" } });

    // per-category sum check reads OK at the category weight (50)
    expect(screen.getByText("✓ adds up to 50")).toBeTruthy();
  });

  it("flags a per-category weight mismatch", () => {
    renderEditor(threeTests());
    fireEvent.click(screen.getByRole("radio", { name: /custom weights/i }));
    fireEvent.change(screen.getByLabelText("Test #1 weight"), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText("Test #2 weight"), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText("Test #3 weight"), { target: { value: "10" } });
    expect(screen.getByText("= 30, not 50")).toBeTruthy();
  });
});

describe("RubricEditor — add/remove categories and items (gaps 1 & 3)", () => {
  it("adds a second category", () => {
    renderEditor(threeTests());
    expect(screen.getAllByLabelText("Category name")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: /\+ add category/i }));
    expect(screen.getAllByLabelText("Category name")).toHaveLength(2);
  });

  it("adds and removes item rows", () => {
    renderEditor(threeTests());
    expect(screen.getAllByLabelText("Item name")).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: /\+ add item/i }));
    expect(screen.getAllByLabelText("Item name")).toHaveLength(4);
    fireEvent.click(screen.getByRole("button", { name: /remove item: Test #1/i }));
    expect(screen.getAllByLabelText("Item name")).toHaveLength(3);
  });
});

describe("RubricEditor — delete-with-scores confirm (T5)", () => {
  it("deletes instantly when the category has no entered scores", () => {
    renderEditor(threeTests());
    fireEvent.click(screen.getByRole("button", { name: /delete category: Tests/i }));
    // last category gone -> empty affordance appears
    expect(screen.getByRole("button", { name: /\+ add your first category/i })).toBeTruthy();
  });

  it("asks for confirmation when the category holds a score", () => {
    const course = threeTests();
    course.categories[0].items[0].score = 88;
    renderEditor(course);
    fireEvent.click(screen.getByRole("button", { name: /delete category: Tests/i }));
    // not gone yet — a confirm bar shows
    expect(screen.getByText(/delete this category\?/i)).toBeTruthy();
    expect(screen.getAllByLabelText("Category name")).toHaveLength(1);
    // confirm removes it
    const bar = screen.getByText(/delete this category\?/i).parentElement as HTMLElement;
    fireEvent.click(within(bar).getByRole("button", { name: /^Delete$/ }));
    expect(screen.getByRole("button", { name: /\+ add your first category/i })).toBeTruthy();
  });
});

describe("RubricEditor — Replace lowest mode", () => {
  it("exposes a single-select replacer radio and per-row weights", () => {
    renderEditor(threeTests()); // 3 rows: Test #1/#2/#3, category weight 50
    fireEvent.click(screen.getByRole("radio", { name: /replace lowest/i }));
    // per-row weight inputs appear (like custom weights)
    expect(screen.getByLabelText("Test #1 weight")).toBeTruthy();
    // one replacer radio per row; last row defaults on
    const reps = screen.getAllByRole("radio", { name: /final \(replaces lowest\)/i });
    expect(reps).toHaveLength(3);
    // pick the first row as the replacer -> single select
    fireEvent.click(reps[0]);
    expect((reps[0] as HTMLInputElement).checked).toBe(true);
    expect((reps[2] as HTMLInputElement).checked).toBe(false);
  });
});
