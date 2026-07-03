// PREVIEW MOCK data + fake syllabus parse. Replaced by the real API when the backend lands.
import type { Course } from "./types";

export function demoCourse(): Course {
  return {
    name: "Discrete Math",
    term: "Spring 2026",
    categories: [
      {
        id: "exams",
        name: "Exams",
        weight: 25,
        rule: { kind: "rankWeights", weights: [7, 7, 7, 4] }, // lowest exam counts 4, others 7
        items: [
          { id: "e1", name: "Exam 1", score: 95, maxScore: 100 },
          { id: "e2", name: "Exam 2", score: 90, maxScore: 100 },
          { id: "e3", name: "Exam 3", score: 85, maxScore: 100 },
          { id: "e4", name: "Exam 4", score: null, maxScore: 100 }, // upcoming -> goal-seek target
        ],
      },
      {
        id: "hw",
        name: "Homework + Project",
        weight: 75,
        rule: { kind: "uniform", nSlots: 1 },
        items: [{ id: "hw1", name: "HW + Project avg", score: 96, maxScore: 100 }],
      },
    ],
    cutoffs: [
      { letter: "A", min: 93 },
      { letter: "A-", min: 90 },
      { letter: "B+", min: 87 },
      { letter: "B", min: 83 },
      { letter: "B-", min: 80 },
      { letter: "F", min: 0 },
    ],
  };
}

export function emptyManualCourse(): Course {
  return {
    name: "New course",
    term: "",
    categories: [
      { id: "c1", name: "Category 1", weight: 100, rule: { kind: "uniform", nSlots: 1 }, items: [] },
    ],
    cutoffs: [
      { letter: "A", min: 93 },
      { letter: "A-", min: 90 },
      { letter: "B", min: 83 },
      { letter: "C", min: 70 },
      { letter: "F", min: 0 },
    ],
  };
}

// Fake "read the syllabus PDF and propose a rubric" — resolves after a beat.
export function fakeParseSyllabus(): Promise<Course> {
  return new Promise((resolve) => setTimeout(() => resolve(demoCourse()), 1400));
}
