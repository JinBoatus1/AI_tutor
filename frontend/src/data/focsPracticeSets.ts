// FOCS chapter practice banks — one hand-authored PracticeSet per "X.Y Problems" section.
// Content lives under ./practice/; this module is the registry + lookup.
import focsTree from "./focsTree.json";
import { chapterOfProblems } from "../practice/isProblemsSection";
import type { PracticeSet } from "../practice/types";
import { chapter04 } from "./practice/chapter04";
import {
  chapter01,
  chapter02,
  chapter03,
  chapter05,
  chapter06,
  chapter07,
  chapter08,
  chapter09,
  chapter10,
} from "./practice/chapters01to10";
import {
  chapter11,
  chapter12,
  chapter13,
  chapter14,
  chapter15,
  chapter16,
  chapter17,
  chapter18,
  chapter19,
  chapter20,
} from "./practice/chapters11to20";
import {
  chapter21,
  chapter22,
  chapter23,
  chapter24,
  chapter25,
  chapter26,
  chapter27,
  chapter28,
  chapter29,
} from "./practice/chapters21to29";

const ALL_CHAPTER_SETS: PracticeSet[] = [
  chapter01,
  chapter02,
  chapter03,
  chapter04,
  chapter05,
  chapter06,
  chapter07,
  chapter08,
  chapter09,
  chapter10,
  chapter11,
  chapter12,
  chapter13,
  chapter14,
  chapter15,
  chapter16,
  chapter17,
  chapter18,
  chapter19,
  chapter20,
  chapter21,
  chapter22,
  chapter23,
  chapter24,
  chapter25,
  chapter26,
  chapter27,
  chapter28,
  chapter29,
];

export const FOCS_PROBLEM_CHAPTERS: string[] = (() => {
  const chapters = new Set<string>();
  collectProblemChapters(focsTree as Record<string, unknown>, chapters);
  return [...chapters].sort((a, b) => Number(a) - Number(b));
})();

export const FOCS_PRACTICE_SETS: Record<string, PracticeSet> = Object.fromEntries(
  ALL_CHAPTER_SETS.map((set) => [set.chapter, set]),
);

/** Practice set for a chapter token (e.g. "4"), or null if none is authored. */
export function getPracticeSet(chapter: string): PracticeSet | null {
  return FOCS_PRACTICE_SETS[chapter] ?? null;
}

function collectProblemChapters(node: Record<string, unknown>, chapters: Set<string>): void {
  for (const [key, value] of Object.entries(node)) {
    if (key === "_range" || key === "start" || key === "end") continue;
    const ch = chapterOfProblems(key);
    if (ch) chapters.add(ch);
    if (value && typeof value === "object") {
      collectProblemChapters(value as Record<string, unknown>, chapters);
    }
  }
}
