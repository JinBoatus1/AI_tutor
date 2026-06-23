import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useOnboarding } from "../context/OnboardingContext";
import { useLocale } from "../i18n/LocaleContext";
import { ONBOARDING_STEPS } from "../onboarding/onboardingSteps";
import { emitOnboardingStep, ONBOARDING_NOTE_READY_EVENT, ONBOARDING_PROBLEMS_READY_EVENT } from "../onboarding/onboardingStorage";
import "./OnboardingTour.css";

const SPOTLIGHT_PAD = 10;

type TooltipPos = { top: number; left: number; placement: "right" | "left" | "top" | "bottom" };

function computeTooltipPos(
  rect: DOMRect,
  placement: TooltipPos["placement"],
  tooltipW: number,
  tooltipH: number
): TooltipPos {
  const gap = 16;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let top = 0;
  let left = 0;
  let resolved = placement;

  const tryPlacement = (p: TooltipPos["placement"]) => {
    switch (p) {
      case "right":
        top = rect.top + rect.height / 2 - tooltipH / 2;
        left = rect.right + gap;
        break;
      case "left":
        top = rect.top + rect.height / 2 - tooltipH / 2;
        left = rect.left - tooltipW - gap;
        break;
      case "top":
        top = rect.top - tooltipH - gap;
        left = rect.left + rect.width / 2 - tooltipW / 2;
        break;
      case "bottom":
        top = rect.bottom + gap;
        left = rect.left + rect.width / 2 - tooltipW / 2;
        break;
    }
    const fits =
      left >= 12 &&
      top >= 12 &&
      left + tooltipW <= vw - 12 &&
      top + tooltipH <= vh - 12;
    return fits;
  };

  const order: TooltipPos["placement"][] =
    placement === "right"
      ? ["right", "left", "bottom", "top"]
      : placement === "left"
        ? ["left", "right", "bottom", "top"]
        : placement === "top"
          ? ["top", "bottom", "left", "right"]
          : ["bottom", "top", "left", "right"];

  for (const p of order) {
    if (tryPlacement(p)) {
      resolved = p;
      break;
    }
    resolved = p;
  }

  top = Math.max(12, Math.min(top, vh - tooltipH - 12));
  left = Math.max(12, Math.min(left, vw - tooltipW - 12));
  return { top, left, placement: resolved };
}

export default function OnboardingTour() {
  const { active, stepIndex, stepCount, nextStep, skipOnboarding } = useOnboarding();
  const { t } = useLocale();
  const step = ONBOARDING_STEPS[stepIndex];
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [tooltipPos, setTooltipPos] = useState<TooltipPos | null>(null);

  const measure = useCallback(() => {
    if (!active || !step) return;
    const targets =
      step.id === "note"
        ? ["section-note-panel", "section-note"]
        : step.id === "problems"
          ? ["learning-progress", "chapter-practice"]
          : [step.target];
    for (const id of targets) {
      const el = document.querySelector(`[data-onboarding="${id}"]`);
      if (el) {
        setRect(el.getBoundingClientRect());
        return;
      }
    }
    setRect(null);
  }, [active, step]);

  useLayoutEffect(() => {
    measure();
    if (!active) return;
    if (step) emitOnboardingStep(step.id);
    const t1 = window.setTimeout(measure, 80);
    const t2 = window.setTimeout(measure, 360);
    const t3 =
      step.id === "note" || step.id === "problems" ? window.setTimeout(measure, 900) : undefined;
    const t4 =
      step.id === "note" || step.id === "problems" ? window.setTimeout(measure, 1800) : undefined;
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    window.addEventListener(ONBOARDING_NOTE_READY_EVENT, measure);
    window.addEventListener(ONBOARDING_PROBLEMS_READY_EVENT, measure);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      if (t3) window.clearTimeout(t3);
      if (t4) window.clearTimeout(t4);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener(ONBOARDING_NOTE_READY_EVENT, measure);
      window.removeEventListener(ONBOARDING_PROBLEMS_READY_EVENT, measure);
    };
  }, [active, measure, stepIndex]);

  useEffect(() => {
    if (!active) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [active]);

  useLayoutEffect(() => {
    if (!rect || !step) {
      setTooltipPos(null);
      return;
    }
    const tooltipW = 300;
    const tooltipH = 168;
    setTooltipPos(computeTooltipPos(rect, step.placement, tooltipW, tooltipH));
  }, [rect, step]);

  if (!active || !step) return null;

  const isLast = stepIndex >= stepCount - 1;
  const spotlight = rect
    ? {
        top: rect.top - SPOTLIGHT_PAD,
        left: rect.left - SPOTLIGHT_PAD,
        width: rect.width + SPOTLIGHT_PAD * 2,
        height: rect.height + SPOTLIGHT_PAD * 2,
      }
    : null;

  return createPortal(
    <div
      className="onboarding-root"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      onClick={skipOnboarding}
    >
      {spotlight ? (
        <div
          className="onboarding-spotlight"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
          }}
          onClick={(e) => e.stopPropagation()}
          aria-hidden
        />
      ) : null}
      <div
        className={`onboarding-tooltip onboarding-tooltip--${tooltipPos?.placement ?? step.placement}`}
        style={
          tooltipPos
            ? { top: tooltipPos.top, left: tooltipPos.left }
            : { top: "50%", left: "50%", transform: "translate(-50%, -50%)" }
        }
        onClick={(e) => e.stopPropagation()}
      >
        <p className="onboarding-step-count">
          {t("onboarding.stepOf", { current: String(stepIndex + 1), total: String(stepCount) })}
        </p>
        <h2 id="onboarding-title" className="onboarding-title">
          {t(step.titleKey)}
        </h2>
        <p className="onboarding-body">{t(step.bodyKey)}</p>
        <div className="onboarding-actions">
          <button type="button" className="onboarding-skip" onClick={skipOnboarding}>
            {t("onboarding.skip")}
          </button>
          <button type="button" className="onboarding-next" onClick={nextStep}>
            {isLast ? t("onboarding.done") : t("onboarding.next")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
