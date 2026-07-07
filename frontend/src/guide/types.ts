import type { Flashcard, PracticeQuestion } from "../practice/types";

export type GuideStepKind = "read" | "flashcard" | "question" | "done";

export interface GuideReadStep {
  id: string;
  label: string;
  kind: "read";
  title: string;
  body: string;
  bookHint?: string;
}

export interface GuideFlashcardStep {
  id: string;
  label: string;
  kind: "flashcard";
  title: string;
  card: Flashcard;
}

export interface GuideQuestionStep {
  id: string;
  label: string;
  kind: "question";
  title: string;
  question: PracticeQuestion;
}

export interface GuideDoneStep {
  id: string;
  label: string;
  kind: "done";
  title: string;
  body: string;
}

export type GuideStep = GuideReadStep | GuideFlashcardStep | GuideQuestionStep | GuideDoneStep;

export interface GuideScript {
  chapter: string;
  title: string;
  steps: GuideStep[];
}

export interface GuideProgress {
  completedStepIds: string[];
}

export function emptyGuideProgress(): GuideProgress {
  return { completedStepIds: [] };
}
