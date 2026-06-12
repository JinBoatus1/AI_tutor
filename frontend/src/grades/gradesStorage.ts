import type { Course } from "./mockEngine";

const STORAGE_KEY = "aiTutorGradesCourseV1";

export function loadSavedCourse(): Course | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Course;
  } catch {
    return null;
  }
}

export function saveCourse(course: Course): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(course));
  } catch {
    /* quota / private mode — ignore */
  }
}

export function clearSavedCourse(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
