import { useEffect, useId, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useLocale } from "../i18n/LocaleContext";
import type { MessageKey } from "../i18n/messages";
import { useFeedback } from "./FeedbackContext";
import { submitFeedback, type SubmitResult } from "./feedbackApi";
import { FEEDBACK_TYPES, MAX_DESCRIPTION_CHARS, type FeedbackType } from "./types";
import "./FeedbackModal.css";

/** How long "Thanks, we got it." stays before the dialog closes itself. */
const SENT_CLOSE_DELAY_MS = 2500;

const TYPE_LABEL_KEYS: Record<FeedbackType, MessageKey> = {
  bug: "feedback.type.bug",
  content: "feedback.type.content",
  suggestion: "feedback.type.suggestion",
  other: "feedback.type.other",
};

type Failure = Exclude<SubmitResult, { ok: true }>;

/** Mounted once, next to SignInModal. */
export default function FeedbackModal() {
  const { isOpen } = useFeedback();
  // The form's state lives in FeedbackDialog, so every open starts with an empty form.
  return isOpen ? <FeedbackDialog /> : null;
}

function FeedbackDialog() {
  const { presetType, snapshot, closeFeedback } = useFeedback();
  const { user, getFreshToken, showSignIn, setShowSignIn } = useAuth();
  const { t } = useLocale();
  const [type, setType] = useState<FeedbackType | null>(presetType);
  const [description, setDescription] = useState("");
  const [contactOk, setContactOk] = useState(false);
  const [phase, setPhase] = useState<"editing" | "sending" | "sent">("editing");
  const [failure, setFailure] = useState<Failure | null>(null);
  const inFlight = useRef(false);
  const firstTypeRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const sending = phase === "sending";

  useEffect(() => {
    (presetType ? descriptionRef.current : firstTypeRef.current)?.focus();
  }, [presetType]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Esc never closes mid-send, or while the sign-in modal sits on top of the dialog.
      if (event.key === "Escape" && !sending && !showSignIn) closeFeedback();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [sending, showSignIn, closeFeedback]);

  useEffect(() => {
    if (phase !== "sent") return;
    const timer = setTimeout(closeFeedback, SENT_CLOSE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [phase, closeFeedback]);

  const canSend = phase === "editing" && type !== null && description.trim() !== "";

  const send = async () => {
    // The ref stops a second click that lands before React re-renders the disabled button.
    if (!canSend || type === null || inFlight.current) return;
    inFlight.current = true;
    setPhase("sending");
    setFailure(null);
    let result: SubmitResult;
    try {
      const token = await getFreshToken();
      result = token
        ? await submitFeedback(token, { type, description, contact_ok: contactOk, context: snapshot })
        : { ok: false, kind: "auth" };
    } catch {
      result = { ok: false, kind: "unavailable" }; // Firebase couldn't produce a token, e.g. offline
    } finally {
      inFlight.current = false;
    }
    if (result.ok) {
      setPhase("sent");
    } else {
      setFailure(result);
      setPhase("editing");
    }
  };

  const failureMessage = (f: Failure): string => {
    switch (f.kind) {
      case "auth":
        return t("feedback.errorAuth");
      case "rateLimited":
        return t("feedback.errorRateLimited", { minutes: String(f.retryAfterMinutes) });
      case "invalid":
        return t("feedback.errorInvalid");
      case "unavailable":
        return t("feedback.errorUnavailable");
    }
  };

  return (
    // No onClick on the overlay: a stray click must not throw away a long description.
    <div className="feedback-overlay">
      <div className="feedback-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <button
          type="button"
          className="feedback-close"
          onClick={closeFeedback}
          disabled={sending}
          aria-label={t("feedback.close")}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <h2 id={titleId} className="feedback-title">{t("feedback.title")}</h2>

        {phase === "sent" ? (
          <div className="feedback-sent">
            <p role="status">{t("feedback.sent")}</p>
            <div className="feedback-actions">
              <button type="button" className="feedback-btn feedback-btn--primary" onClick={closeFeedback}>
                {t("feedback.close")}
              </button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
          >
            <fieldset className="feedback-types" disabled={sending}>
              <legend className="feedback-label">{t("feedback.typeLegend")}</legend>
              {FEEDBACK_TYPES.map((value, index) => (
                <label key={value} className="feedback-type">
                  <input
                    ref={index === 0 ? firstTypeRef : undefined}
                    type="radio"
                    name="feedback-type"
                    value={value}
                    checked={type === value}
                    onChange={() => setType(value)}
                  />
                  <span>{t(TYPE_LABEL_KEYS[value])}</span>
                </label>
              ))}
            </fieldset>

            <label className="feedback-label" htmlFor={descriptionId}>
              {t("feedback.descriptionLabel")}
            </label>
            <textarea
              id={descriptionId}
              ref={descriptionRef}
              className="feedback-textarea"
              rows={6}
              maxLength={MAX_DESCRIPTION_CHARS}
              value={description}
              placeholder={t("feedback.descriptionPlaceholder")}
              disabled={sending}
              onChange={(event) => setDescription(event.target.value)}
            />
            <div className="feedback-count">
              {t("feedback.charCount", { count: String(description.length), max: String(MAX_DESCRIPTION_CHARS) })}
            </div>

            <label className="feedback-contact">
              <input
                type="checkbox"
                checked={contactOk}
                disabled={sending}
                onChange={(event) => setContactOk(event.target.checked)}
              />
              <span>{t("feedback.contact", { email: user?.email ?? "" })}</span>
            </label>
            <p className="feedback-attached">{t("feedback.attached")}</p>

            {failure ? (
              <div className="feedback-error" role="alert">
                <span>{failureMessage(failure)}</span>
                {failure.kind === "auth" ? (
                  <button type="button" className="feedback-error-signin" onClick={() => setShowSignIn(true)}>
                    {t("feedback.signIn")}
                  </button>
                ) : null}
              </div>
            ) : null}

            <div className="feedback-actions">
              <button type="button" className="feedback-btn" onClick={closeFeedback} disabled={sending}>
                {t("feedback.cancel")}
              </button>
              <button type="submit" className="feedback-btn feedback-btn--primary" disabled={!canSend}>
                {sending ? (
                  <>
                    <span className="feedback-spinner" aria-hidden />
                    {t("feedback.sending")}
                  </>
                ) : (
                  t("feedback.send")
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
