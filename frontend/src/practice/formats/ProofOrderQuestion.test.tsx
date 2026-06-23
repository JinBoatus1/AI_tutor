// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ProofOrderQuestion } from "./ProofOrderQuestion";
import type { ProofOrderQuestion as Q } from "../types";

afterEach(cleanup);

const q: Q = {
  kind: "proof-order",
  id: "po",
  prompt: "Order it",
  why: "fix it",
  steps: [
    { id: "a", text: "first", deps: [] },
    { id: "b", text: "second", deps: ["a"] },
  ],
};

describe("ProofOrderQuestion keyboard reorder (a11y)", () => {
  it("starts scrambled (invalid), grades false on Check", () => {
    const onAnswered = vi.fn();
    render(<ProofOrderQuestion question={q} onAnswered={onAnswered} />);
    fireEvent.click(screen.getByRole("button", { name: /check order/i }));
    expect(onAnswered).toHaveBeenLastCalledWith(false);
  });

  it("reordering via the up button produces a valid order and grades true", () => {
    const onAnswered = vi.fn();
    render(<ProofOrderQuestion question={q} onAnswered={onAnswered} />);
    // scrambled = reverse([a,b]) = [b,a]; row 2 is "a". Move it up -> [a,b] (valid).
    fireEvent.click(screen.getByRole("button", { name: /move step 2 up/i }));
    fireEvent.click(screen.getByRole("button", { name: /check order/i }));
    expect(onAnswered).toHaveBeenLastCalledWith(true);
    expect(screen.getByText(/valid proof order/i)).toBeTruthy();
  });
});
