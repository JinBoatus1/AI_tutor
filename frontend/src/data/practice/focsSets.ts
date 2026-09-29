// FOCS chapter practice banks — one hand-authored PracticeSet per "X.Y Problems" section.
// Leaf module: imports ONLY chapter content + practice/types. Nothing here imports
// books/registry, so registry -> this module -> (chapter files) has no back edge.
// (Task 8 ruling 1: registry.ts reads FOCS_PRACTICE_SETS at module-evaluation time,
// inside the BOOKS object literal, so any module that both feeds the registry and
// imports BOOKS creates an evaluation-order-dependent import cycle. Keeping the
// content bundle in its own leaf avoids that entirely.)
import type { PracticeSet } from "../../practice/types";
import { chapter04 } from "./chapter04";
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
} from "./chapters01to10";
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
} from "./chapters11to20";
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
} from "./chapters21to29";

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

export const FOCS_PRACTICE_SETS: Record<string, PracticeSet> = Object.fromEntries(
  ALL_CHAPTER_SETS.map((set) => [set.chapter, set]),
);
