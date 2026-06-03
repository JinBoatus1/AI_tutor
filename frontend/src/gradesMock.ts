// PREVIEW MOCK ONLY.
// Canned data mirroring what GET /api/courses/{id}/standing + goal_seek will
// return once the backend (grades_math.py) is wired. These exact numbers come
// from the tested engine running on the motivating 4-exam course.
export type GoalStatus = "ok" | "locked" | "unreachable";
export type GoalRow = { letter: string; status: GoalStatus; needed?: number };

export const mockCourse = {
  name: "Discrete Math",
  term: "Spring 2026",
  categories: [
    { name: "Exams", weight: 25, rule: "lowest exam counts 4 · others 7 each", note: "4 exams · 3 graded" },
    { name: "Homework + Project", weight: 75, rule: "combined", note: "96% so far" },
  ],
  cutoffs: "A 93 · A- 90 · B+ 87 · B 83",
};

export const mockStanding = { percent: 94.7, letter: "A", basis: "on graded work so far" };

export const mockGoalItem = "Exam 4";
export const mockGoals: GoalRow[] = [
  { letter: "A", status: "ok", needed: 52.5 },
  { letter: "A-", status: "locked" },
  { letter: "B", status: "locked" },
];
