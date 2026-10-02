import type { MessageKey } from "../i18n/messages";
import { useLocale } from "../i18n/LocaleContext";
import { useProfileSettings } from "../context/ProfileSettingsContext";
import { THEME_OPTIONS, type ThemeId } from "./profileSettings";
import "./AppearancePicker.css";

/** Each variant's label. A missing entry is a type error, which a template-literal cast would hide. */
const THEME_LABELS: Record<ThemeId, MessageKey> = {
  paper: "theme.paper",
  bright: "theme.bright",
  night: "theme.night",
};

/** The Appearance card body: one preview tile per available Paper & Ink variant (spec §5.7). */
export default function AppearancePicker() {
  const { t } = useLocale();
  const { theme, setTheme } = useProfileSettings();
  return (
    <div className="profile-bg-grid" role="radiogroup" aria-label={t("profile.appearanceGroup")}>
      {THEME_OPTIONS.map((id) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={theme === id}
          className={`profile-bg-swatch theme-tile${theme === id ? " profile-bg-swatch--active" : ""}`}
          onClick={() => setTheme(id)}
        >
          <span className="theme-tile-preview" data-theme={id} aria-hidden>
            <span className="theme-tile-side" />
            <span className="theme-tile-page" />
            <span className="theme-tile-chat">
              <span className="theme-tile-line" />
              <span className="theme-tile-dot" />
            </span>
          </span>
          <span className="profile-bg-swatch-label">{t(THEME_LABELS[id])}</span>
        </button>
      ))}
    </div>
  );
}
