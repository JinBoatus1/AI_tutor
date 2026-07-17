// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { SymbolPalette } from "./SymbolPalette";

afterEach(cleanup);

describe("SymbolPalette", () => {
  it("inserts the clicked symbol from the default (Greek) tab", () => {
    const onInsert = vi.fn();
    render(<SymbolPalette onInsert={onInsert} />);
    fireEvent.click(screen.getByRole("button", { name: "Insert ω" }));
    expect(onInsert).toHaveBeenCalledWith("ω");
  });

  it("switching category tab changes which symbols are shown", () => {
    const onInsert = vi.fn();
    render(<SymbolPalette onInsert={onInsert} />);
    expect(screen.queryByRole("button", { name: "Insert ∈" })).toBeNull(); // Sets not active yet
    fireEvent.click(screen.getByRole("tab", { name: "Sets" }));
    fireEvent.click(screen.getByRole("button", { name: "Insert ∈" }));
    expect(onInsert).toHaveBeenCalledWith("∈");
    expect(screen.queryByRole("button", { name: "Insert ω" })).toBeNull(); // Greek no longer shown
  });

  it("disables all buttons when disabled", () => {
    render(<SymbolPalette onInsert={vi.fn()} disabled />);
    expect((screen.getByRole("button", { name: "Insert ω" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("tab", { name: "Logic" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
