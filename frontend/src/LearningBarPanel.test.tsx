// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { MessageKey } from "./i18n/messages";
import { loadAppStyleSheets, resolveInBothOrders, resolveStyle } from "./test/cssCascade";

vi.mock("./context/AuthContext", () => ({ useAuth: () => ({ token: null, user: null, loading: false }) }));
vi.mock("./i18n/LocaleContext", async () => {
  const { formatMessage, MESSAGES } = await vi.importActual<typeof import("./i18n/messages")>("./i18n/messages");
  return {
    useLocale: () => ({
      locale: "en",
      t: (key: MessageKey, vars?: Record<string, string>) => formatMessage(MESSAGES.en[key], vars),
    }),
  };
});

import LearningBarPanel, { FocsTreeBranch } from "./LearningBarPanel";

const CHAPTER = "2 Time-Domain Analysis of Continuous-Time Systems";
const S23 = "2.3 The Unit Impulse Response h(t)";
const S24 = "2.4 System Response to External Input: The Zero-State Response";
const node = {
  _range: { start: 150, end: 236 },
  [S23]: { start: 163, end: 167 },
  [S24]: { start: 168, end: 195 },
};

function renderChapter(currentPath: string | null) {
  return render(
    <MemoryRouter>
      <ul>
        <FocsTreeBranch
          title={CHAPTER}
          node={node}
          learnedSet={new Set()}
          onToggleToken={() => {}}
          expanded={{}}
          onToggleExpand={() => {}}
          path={CHAPTER}
          onOpenPages={() => {}}
          currentPath={currentPath}
        />
      </ul>
    </MemoryRouter>,
  );
}

afterEach(cleanup);

describe("outline current section", () => {
  it("marks only the section on screen", () => {
    const { container } = renderChapter(`${CHAPTER}/${S24}`);
    const current = container.querySelectorAll(".focs-node__row--current");
    expect(current).toHaveLength(1);
    expect(screen.getByRole("button", { name: new RegExp(S24.slice(0, 20)) })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("button", { name: new RegExp(S23.slice(0, 20)) })).not.toHaveAttribute("aria-current");
  });

  it("marks nothing when no section is shown", () => {
    const { container } = renderChapter(null);
    expect(container.querySelectorAll(".focs-node__row--current")).toHaveLength(0);
  });
});

describe("outline current section in the FOCS book", () => {
  // FOCS has sibling sections on one page (1.2 and 1.3 are both p. 8), so a page range alone cannot pick one.
  it.each([
    ["1.2 Speed Dating", 8, 8],
    ["1.3 Friendship Networks and Ads", 8, 8],
    ["13.3.1 Bijection", 184, 184],
  ])("marks only %s", (title, startBook, endBook) => {
    const { container } = render(
      <MemoryRouter>
        <LearningBarPanel
          variant="embed"
          onOutlineSectionPreview={() => {}}
          currentSection={{ bookId: "focs", title, startBook, endBook }}
        />
      </MemoryRouter>,
    );
    const current = container.querySelectorAll('[aria-current="true"]');
    expect(current).toHaveLength(1);
    expect(current[0].textContent?.startsWith(title)).toBe(true);
    expect(container.querySelectorAll(".focs-node__row--current")).toHaveLength(1);
  });
});

describe("outline legend", () => {
  it("draws Learned with the same check the rows use (spec §5.2)", () => {
    const { container } = render(
      <MemoryRouter>
        <LearningBarPanel variant="embed" onOutlineSectionPreview={() => {}} />
      </MemoryRouter>,
    );
    const sheets = loadAppStyleSheets();
    const legend = container.querySelector(".my-learning-bar-dot--learned")!;
    const row = document.createElement("span");
    row.className = "focs-node__learn-dot focs-node__learn-dot--on";
    container.appendChild(row);
    const rowCheck = resolveStyle(row, "content", sheets, { pseudo: "::after" });
    expect(rowCheck).toBe('"✓"');
    expect(resolveInBothOrders(legend, "content", sheets, { pseudo: "::after" })).toEqual([rowCheck, rowCheck]);
    expect(resolveInBothOrders(legend, "background", sheets)).toEqual(["transparent", "transparent"]);
  });
});
