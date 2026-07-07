import { isProblemsSection } from "../practice/isProblemsSection";

/** Chapter token (e.g. "5") from "5.1 Foo" or "5 Induction…", or null. */
export function chapterOfSectionTitle(title: string | null | undefined): string | null {
  if (!title) return null;
  const first = title.trim().split(/\s+/)[0] ?? "";
  const m = first.match(/^(\d+)/);
  return m ? m[1] : null;
}

/** Chapter 5 induction guided walkthrough (demo) — any Ch.5 section except Problems. */
export function isInductionGuideSection(title: string | null | undefined): boolean {
  if (!title || isProblemsSection(title)) return false;
  return chapterOfSectionTitle(title) === "5";
}
