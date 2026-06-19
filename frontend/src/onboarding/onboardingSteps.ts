import type { MessageKey } from "../i18n/messages";

export type OnboardingPlacement = "right" | "left" | "top" | "bottom";

export type OnboardingStepDef = {
  id: string;
  target: string;
  titleKey: MessageKey;
  bodyKey: MessageKey;
  placement: OnboardingPlacement;
};

export const ONBOARDING_STEPS: OnboardingStepDef[] = [
  {
    id: "progress",
    target: "learning-progress",
    titleKey: "onboarding.progressTitle",
    bodyKey: "onboarding.progressBody",
    placement: "right",
  },
  {
    id: "history",
    target: "history",
    titleKey: "onboarding.historyTitle",
    bodyKey: "onboarding.historyBody",
    placement: "right",
  },
  {
    id: "chat",
    target: "chat-panel",
    titleKey: "onboarding.chatTitle",
    bodyKey: "onboarding.chatBody",
    placement: "left",
  },
  {
    id: "input",
    target: "chat-input",
    titleKey: "onboarding.inputTitle",
    bodyKey: "onboarding.inputBody",
    placement: "top",
  },
  {
    id: "new-session",
    target: "new-session",
    titleKey: "onboarding.newSessionTitle",
    bodyKey: "onboarding.newSessionBody",
    placement: "bottom",
  },
];
