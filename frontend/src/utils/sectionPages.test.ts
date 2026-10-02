import { describe, expect, it } from "vitest";
import { pageIndexAfterReply, replyIsAboutSection, viewingBookPage } from "./sectionPages";

const s24 = {
  bookId: "lathi",
  name: "2.4 System Response to External Input: The Zero-State Response",
  startBook: 168,
  endBook: 195,
};
const reply24 = { name: s24.name, start_book: 168, end_book: 195, start: 188, end: 215 };

describe("replyIsAboutSection", () => {
  it("is true for the section the question was asked from", () => {
    expect(replyIsAboutSection(s24, "lathi", reply24)).toBe(true);
  });

  it("is false for another section, range or book", () => {
    expect(replyIsAboutSection(s24, "lathi", { ...reply24, name: "2.5 Classical Solution" })).toBe(false);
    expect(replyIsAboutSection(s24, "lathi", { ...reply24, end_book: 194 })).toBe(false);
    expect(replyIsAboutSection(s24, "focs", reply24)).toBe(false);
  });

  it("is false when either side is missing", () => {
    expect(replyIsAboutSection(null, "lathi", reply24)).toBe(false);
    expect(replyIsAboutSection(s24, "lathi", undefined)).toBe(false);
  });
});

describe("viewingBookPage", () => {
  it("is the printed page of the page on screen", () => {
    // Lathi 2.4 starts on p. 168; the 23rd of its 28 pages is p. 190.
    expect(viewingBookPage(168, 28, 22)).toBe(190);
  });

  it("is undefined when the panel shows no section pages", () => {
    expect(viewingBookPage(168, 0, 0)).toBeUndefined();
  });

  it("is undefined without a section start", () => {
    expect(viewingBookPage(undefined, 28, 3)).toBeUndefined();
  });

  it("is undefined for an index past the pages", () => {
    expect(viewingBookPage(168, 28, 28)).toBeUndefined();
  });
});

describe("pageIndexAfterReply", () => {
  it("keeps the student's page when the reply is about the same section", () => {
    expect(pageIndexAfterReply(true, 22, 28)).toBe(22);
  });

  it("starts a different section at its first page", () => {
    expect(pageIndexAfterReply(false, 22, 28)).toBe(0);
  });

  it("stays inside the pages that came back", () => {
    expect(pageIndexAfterReply(true, 30, 28)).toBe(27);
    expect(pageIndexAfterReply(true, 5, 0)).toBe(0);
  });
});
