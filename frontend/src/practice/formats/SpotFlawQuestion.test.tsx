// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { SpotFlawQuestion } from "./SpotFlawQuestion";
import type { SpotFlawQuestion as Q } from "../types";

afterEach(cleanup);

const q: Q = {
  kind: "spot-flaw",
  id: "sf",
  prompt: "Find the flaw",
  why: "you divided by zero",
  lines: [
    { id: "l1", text: "Let a equal b" },
    { id: "l2", text: "Divide both sides by a minus b" },
  ],
  flawLineId: "l2",
};

describe("SpotFlawQuestion click-to-select (a11y)", () => {
  it("picking the flaw line then Check grades true", () => {
    const onAnswered = vi.fn();
    render(<SpotFlawQuestion question={q} onAnswered={onAnswered} />);
    fireEvent.click(screen.getByRole("button", { name: /divide both sides/i }));
    fireEvent.click(screen.getByRole("button", { name: /^check$/i }));
    expect(onAnswered).toHaveBeenLastCalledWith(true);
    expect(screen.getByText(/found the flaw/i)).toBeTruthy();
  });

  it("picking a valid line grades false with explain + retry", () => {
    const onAnswered = vi.fn();
    render(<SpotFlawQuestion question={q} onAnswered={onAnswered} />);
    fireEvent.click(screen.getByRole("button", { name: /let a equal b/i }));
    fireEvent.click(screen.getByRole("button", { name: /^check$/i }));
    expect(onAnswered).toHaveBeenLastCalledWith(false);
    expect(screen.getByText(/not quite/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /try again/i })).toBeTruthy();
  });
});
