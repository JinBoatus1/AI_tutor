// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { StandingHero } from "../Grades";
import { LocaleProvider } from "../i18n/LocaleContext";
import type { WinningScheme } from "./types";

afterEach(cleanup);

function renderHero(winningScheme: WinningScheme | null) {
  render(
    <LocaleProvider>
      <StandingHero standing={{ percent: 90, letter: "A-" }} graded={1} total={2} winningScheme={winningScheme} />
    </LocaleProvider>,
  );
}

describe("StandingHero — which-scheme-won caption", () => {
  it("shows the scheme name + count when a named scheme won", () => {
    renderHero({ name: "Final-heavy", count: 2 });
    expect(screen.getByText(/Final-heavy/)).toBeTruthy();
    expect(screen.getByText(/best of 2/i)).toBeTruthy();
  });
  it("shows 'Primary weights' when the primary weights won (name null)", () => {
    renderHero({ name: null, count: 2 });
    expect(screen.getByText(/Primary weights/i)).toBeTruthy();
  });
  it("renders no caption when there are no alternate weightings", () => {
    renderHero(null);
    expect(screen.queryByText(/best of/i)).toBeNull();
  });
});
