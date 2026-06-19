const DONE_PREFIX = "ai_tutor_onboarding_done";

export function onboardingStorageKey(userUid: string | null, guestStudentId: string): string {
  if (userUid) return `${DONE_PREFIX}_${userUid}`;
  return `${DONE_PREFIX}_guest_${guestStudentId}`;
}

export function readOnboardingDone(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

export function writeOnboardingDone(key: string): void {
  try {
    localStorage.setItem(key, "1");
  } catch {
    /* ignore */
  }
}

export const ONBOARDING_PREPARE_EVENT = "ai-tutor-onboarding-prepare";

export function emitOnboardingPrepare(): void {
  window.dispatchEvent(new Event(ONBOARDING_PREPARE_EVENT));
}

export const ONBOARDING_STEP_EVENT = "ai-tutor-onboarding-step";

export function emitOnboardingStep(stepId: string): void {
  window.dispatchEvent(new CustomEvent(ONBOARDING_STEP_EVENT, { detail: { stepId } }));
}

export const ONBOARDING_NOTE_READY_EVENT = "ai-tutor-onboarding-note-ready";

export function emitOnboardingNoteReady(): void {
  window.dispatchEvent(new Event(ONBOARDING_NOTE_READY_EVENT));
}

export const ONBOARDING_PROBLEMS_READY_EVENT = "ai-tutor-onboarding-problems-ready";

export function emitOnboardingProblemsReady(): void {
  window.dispatchEvent(new Event(ONBOARDING_PROBLEMS_READY_EVENT));
}

export const ONBOARDING_EXPAND_PATHS_EVENT = "ai-tutor-onboarding-expand-paths";

export function emitOnboardingExpandPaths(paths: string[]): void {
  window.dispatchEvent(new CustomEvent(ONBOARDING_EXPAND_PATHS_EVENT, { detail: { paths } }));
}
