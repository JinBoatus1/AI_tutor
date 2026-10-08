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

  it("is false for other pages or another book", () => {
    expect(replyIsAboutSection(s24, "lathi", { ...reply24, start_book: 196, end_book: 202 })).toBe(false);
    expect(replyIsAboutSection(s24, "lathi", { ...reply24, end_book: 194 })).toBe(false);
    expect(replyIsAboutSection(s24, "focs", reply24)).toBe(false);
  });

  it("goes by pages, not titles, which can differ in spacing", () => {
    // FOCS's chapter 5 key ends in a space; /api/textbook_pages strips it, chat replies keep it.
    const ch5 = { bookId: "focs", name: '5 Induction: Proving "FOR ALL ..."', startBook: 55, endBook: 70 };
    const reply = { name: '5 Induction: Proving "FOR ALL ..." ', start_book: 55, end_book: 70 };
    expect(replyIsAboutSection(ch5, "focs", reply)).toBe(true);
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
