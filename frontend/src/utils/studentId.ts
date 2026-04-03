export const STUDENT_ID_KEY = "aiTutorStudentId";

export function getOrCreateStudentId(): string {
  try {
    const existed = localStorage.getItem(STUDENT_ID_KEY);
    if (existed && existed.trim()) return existed;
    const created = `student_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(STUDENT_ID_KEY, created);
    return created;
  } catch {
    return `student_fallback_${Date.now()}`;
  }
}
