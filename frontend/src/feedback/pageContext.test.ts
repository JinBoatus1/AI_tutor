import { describe, it, expect } from "vitest";
import { pageContextFor } from "./pageContext";

const SHOWN = { bookId: "focs", name: "1.1 Modeling Epidemics", startBook: 7 };

describe("pageContextFor", () => {
  it("names the book the section on screen came from, even after another book was selected", () => {
    expect(pageContextFor("lathi", SHOWN, true, 2)).toEqual({
      bookId: "focs",
      section: "1.1 Modeling Epidemics",
      page: 9,
    });
  });

  it("uses the selected book when no section is open", () => {
    expect(pageContextFor("lathi", null, false, 0)).toEqual({ bookId: "lathi", section: undefined, page: undefined });
  });

  it("leaves the page out while the section's pages aren't shown", () => {
    expect(pageContextFor("focs", SHOWN, false, 3)).toEqual({
      bookId: "focs",
      section: "1.1 Modeling Epidemics",
      page: undefined,
    });
  });
});
