import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import {
  emitOnboardingPrepare,
  onboardingStorageKey,
  readOnboardingDone,
  writeOnboardingDone,
} from "../onboarding/onboardingStorage";
import { ONBOARDING_STEPS } from "../onboarding/onboardingSteps";
import { getOrCreateStudentId } from "../utils/studentId";

type OnboardingContextValue = {
  active: boolean;
  stepIndex: number;
  stepCount: number;
  startOnboarding: (opts?: { force?: boolean }) => void;
  tryAutoStart: () => void;
  nextStep: () => void;
  skipOnboarding: () => void;
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const guestIdRef = useRef(getOrCreateStudentId());
  const autoStartedRef = useRef(false);
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [forceRun, setForceRun] = useState(false);

  const storageKey = useMemo(
    () => onboardingStorageKey(user?.uid ?? null, guestIdRef.current),
    [user?.uid]
  );

  const finish = useCallback(() => {
    writeOnboardingDone(storageKey);
    setActive(false);
    setStepIndex(0);
    setForceRun(false);
  }, [storageKey]);

  const startOnboarding = useCallback(
    (opts?: { force?: boolean }) => {
      const force = opts?.force === true;
      if (!force && readOnboardingDone(storageKey)) return;
      setForceRun(force);
      setStepIndex(0);
      emitOnboardingPrepare();
      window.setTimeout(() => setActive(true), 320);
    },
    [storageKey]
  );

  const tryAutoStart = useCallback(() => {
    if (loading || active || forceRun) return;
    if (readOnboardingDone(storageKey)) return;
    if (location.pathname !== "/learning") return;
    if (autoStartedRef.current) return;
    autoStartedRef.current = true;
    startOnboarding();
  }, [active, forceRun, loading, location.pathname, startOnboarding, storageKey]);

  useEffect(() => {
    if (location.pathname !== "/learning") {
      autoStartedRef.current = false;
    }
  }, [location.pathname]);

  useEffect(() => {
    if (loading || location.pathname !== "/learning") return;
    const timer = window.setTimeout(() => tryAutoStart(), 450);
    return () => window.clearTimeout(timer);
  }, [loading, location.pathname, tryAutoStart, user?.uid]);

  const nextStep = useCallback(() => {
    if (stepIndex >= ONBOARDING_STEPS.length - 1) {
      finish();
      return;
    }
    setStepIndex((i) => i + 1);
  }, [finish, stepIndex]);

  const skipOnboarding = useCallback(() => {
    finish();
  }, [finish]);

  const value = useMemo(
    () => ({
      active,
      stepIndex,
      stepCount: ONBOARDING_STEPS.length,
      startOnboarding,
      tryAutoStart,
      nextStep,
      skipOnboarding,
    }),
    [active, nextStep, skipOnboarding, startOnboarding, stepIndex, tryAutoStart]
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used within OnboardingProvider");
  return ctx;
}
