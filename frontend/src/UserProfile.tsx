import { useCallback, useEffect, useRef, useState } from "react";
import { apiUrl } from "./apiBase";
import { useAuth } from "./context/AuthContext";
import { useProfileSettings } from "./context/ProfileSettingsContext";
import { useLocale } from "./i18n/LocaleContext";
import { APP_LOCALES, LOCALE_NATIVE_LABELS, type AppLocale } from "./i18n/types";
import type { MessageKey } from "./i18n/messages";
import { PAGE_BACKGROUND_OPTIONS, type PageBackgroundId } from "./profile/profileSettings";
import {
  clearAllUploadedTextbooksFromBrowser,
  fetchTextbookOptionsFromServer,
  invalidateTextbookCatalogSync,
  isValidUploadedTextbookId,
  readSelectedTextbookId,
  readTextbookOptionList,
  reconcileSelectedTextbookWithCatalog,
  removeUploadedTextbookFromLocal,
  type TextbookTreeRoot,
  writeCatalogAndTree,
  writeSelectedTextbookId,
} from "./learningTextbooks";
import "./UserProfile.css";

export default function UserProfile() {
  const { user, loading, logout, setShowSignIn, token } = useAuth();
  const { pageBackground, setPageBackground } = useProfileSettings();
  const { locale, applyLocale, t } = useLocale();
  const [localeNotice, setLocaleNotice] = useState<string | null>(null);
  const [textbookOptions, setTextbookOptions] = useState(() => readTextbookOptionList());
  const [selectedTextbook, setSelectedTextbook] = useState(() => readSelectedTextbookId());
  const [textbookUploading, setTextbookUploading] = useState(false);
  const [textbookDeleting, setTextbookDeleting] = useState(false);
  const [catalogSyncing, setCatalogSyncing] = useState(false);
  const [textbookError, setTextbookError] = useState<string | null>(null);
  const [pickedPdfName, setPickedPdfName] = useState<string | null>(null);
  const textbookFileRef = useRef<HTMLInputElement>(null);

  const refreshTextbookOptions = useCallback(async () => {
    reconcileSelectedTextbookWithCatalog();
    if (token) {
      try {
        await fetchTextbookOptionsFromServer(token);
      } catch {
        /* keep current in-memory list */
      }
    }
    setTextbookOptions(readTextbookOptionList());
    setSelectedTextbook(readSelectedTextbookId());
  }, [token]);

  useEffect(() => {
    if (!token) return;
    void refreshTextbookOptions();
  }, [token, refreshTextbookOptions]);

  const onClearLocalUploadsOnly = () => {
    if (!window.confirm(t("profile.clearLocalConfirm"))) {
      return;
    }
    clearAllUploadedTextbooksFromBrowser();
    void refreshTextbookOptions();
  };

  useEffect(() => {
    const onChange = () => void refreshTextbookOptions();
    window.addEventListener("ai-tutor-textbook-changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("ai-tutor-textbook-changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [refreshTextbookOptions]);

  const clearTextbookFileInput = () => {
    setPickedPdfName(null);
    if (textbookFileRef.current) textbookFileRef.current.value = "";
  };

  const onTextbookFile = async (file: File | null) => {
    if (!file) return;
    if (!token) {
      setTextbookError(t("profile.errSignInUpload"));
      clearTextbookFileInput();
      return;
    }
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setTextbookError(t("profile.errPdfOnly"));
      clearTextbookFileInput();
      return;
    }
    setTextbookUploading(true);
    setTextbookError(null);
    setPickedPdfName(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("label", file.name.replace(/\.pdf$/i, "") || "My textbook");
      const resp = await fetch(apiUrl("/api/user_textbooks/from_pdf"), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = (await resp.json()) as { detail?: string; id?: string; label?: string; tree?: TextbookTreeRoot | null };
      if (!resp.ok) {
        setTextbookError(typeof data?.detail === "string" ? data.detail : t("profile.errUploadFailed"));
        return;
      }
      if (!data?.id || !data?.tree) {
        setTextbookError(t("profile.errIncompleteResponse"));
        return;
      }
      writeCatalogAndTree(data.id, data.label || data.id, data.tree);
      writeSelectedTextbookId(data.id);
      void refreshTextbookOptions();
    } catch {
      setTextbookError(t("profile.errServer"));
    } finally {
      setTextbookUploading(false);
      clearTextbookFileInput();
    }
  };

  const onDeleteSelectedUpload = async () => {
    if (!token || !isValidUploadedTextbookId(selectedTextbook)) return;
    const label =
      textbookOptions.find((o) => o.id === selectedTextbook)?.linkLabel ?? selectedTextbook;
    if (!window.confirm(t("profile.deleteConfirm", { label }))) {
      return;
    }
    setTextbookDeleting(true);
    setTextbookError(null);
    try {
      const resp = await fetch(
        apiUrl(`/api/user_textbooks/${encodeURIComponent(selectedTextbook)}/delete`),
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      let data: { detail?: string } = {};
      try {
        data = (await resp.json()) as { detail?: string };
      } catch {
        /* non-JSON body */
      }
      if (!resp.ok) {
        if (resp.status === 404 && isValidUploadedTextbookId(selectedTextbook)) {
          invalidateTextbookCatalogSync();
          removeUploadedTextbookFromLocal(selectedTextbook);
          await fetchTextbookOptionsFromServer(token);
          setTextbookOptions(readTextbookOptionList());
          setSelectedTextbook(readSelectedTextbookId());
          setTextbookError(null);
          return;
        }
        setTextbookError(typeof data?.detail === "string" ? data.detail : t("profile.errDeleteFailed"));
        return;
      }
      invalidateTextbookCatalogSync();
      removeUploadedTextbookFromLocal(selectedTextbook);
      await fetchTextbookOptionsFromServer(token);
      setTextbookOptions(readTextbookOptionList());
      setSelectedTextbook(readSelectedTextbookId());
    } catch {
      setTextbookError(t("profile.errServer"));
    } finally {
      setTextbookDeleting(false);
    }
  };

  /** Re-fetch the textbook list from the server and refresh this browser (fixes “ghost” books after a race or 404 delete). */
  const onResyncCatalogFromServer = async () => {
    if (!token) return;
    setCatalogSyncing(true);
    setTextbookError(null);
    try {
      invalidateTextbookCatalogSync();
      try {
        await fetchTextbookOptionsFromServer(token);
      } catch {
        setTextbookError(t("profile.errCatalogLoad"));
        return;
      }
      setTextbookOptions(readTextbookOptionList());
      setSelectedTextbook(readSelectedTextbookId());
    } catch {
      setTextbookError(t("profile.errServer"));
    } finally {
      setCatalogSyncing(false);
    }
  };

  const onApplyLocale = (next: AppLocale) => {
    applyLocale(next);
    setLocaleNotice(t("locale.applied"));
    window.setTimeout(() => setLocaleNotice(null), 2400);
  };

  return (
    <div className="profile-page">
      <header className="profile-page-header">
        <h1 className="profile-page-title">{t("profile.title")}</h1>
        <p className="profile-page-subtitle">{t("profile.subtitle")}</p>
      </header>

      <section className="profile-card" aria-labelledby="profile-locale-heading">
        <h2 id="profile-locale-heading" className="profile-card-title">
          {t("locale.sectionTitle")}
        </h2>
        <p className="profile-setting-desc">{t("locale.sectionDesc")}</p>
        <div className="profile-locale-grid" role="radiogroup" aria-label={t("locale.sectionTitle")}>
          {APP_LOCALES.map((code) => (
            <button
              key={code}
              type="button"
              role="radio"
              aria-checked={locale === code}
              className={`profile-locale-option${locale === code ? " profile-locale-option--active" : ""}`}
              onClick={() => onApplyLocale(code)}
            >
              <span className="profile-locale-option-label">{LOCALE_NATIVE_LABELS[code]}</span>
              <span className="profile-locale-option-code">{code.toUpperCase()}</span>
            </button>
          ))}
        </div>
        <button type="button" className="profile-locale-apply-all" onClick={() => onApplyLocale(locale)}>
          {t("locale.applyAll")}
        </button>
        {localeNotice ? (
          <p className="profile-locale-notice" role="status" aria-live="polite">
            {localeNotice}
          </p>
        ) : null}
      </section>

      <section className="profile-card" aria-labelledby="profile-account-heading">
        <h2 id="profile-account-heading" className="profile-card-title">
          {t("profile.account")}
        </h2>
        {loading ? (
          <p className="profile-muted">{t("profile.loading")}</p>
        ) : user ? (
          <div className="profile-account-block">
            <div className="profile-account-row">
              {user.photoURL ? (
                <img src={user.photoURL} alt="" className="profile-avatar-lg" referrerPolicy="no-referrer" />
              ) : (
                <div className="profile-avatar-placeholder" aria-hidden>
                  {(user.displayName || user.email || "?").slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="profile-account-text">
                <p className="profile-display-name">{user.displayName || "—"}</p>
                <p className="profile-email">{user.email}</p>
              </div>
            </div>
            <button type="button" className="profile-signout-btn" onClick={() => void logout()}>
              {t("profile.signOut")}
            </button>
          </div>
        ) : (
          <div className="profile-account-block">
            <p className="profile-muted">{t("profile.notSignedIn")}</p>
            <button type="button" className="profile-google-btn" onClick={() => setShowSignIn(true)}>
              {t("profile.signIn")}
            </button>
          </div>
        )}
      </section>

      <section className="profile-card" aria-labelledby="profile-textbook-heading">
        <h2 id="profile-textbook-heading" className="profile-card-title">
          {t("profile.textbooks")}
        </h2>
        <p className="profile-setting-desc">{t("profile.textbooksDesc")}</p>
        {!user ? (
          <p className="profile-muted">{t("profile.signInToUpload")}</p>
        ) : (
          <>
            <div className="profile-account-row" style={{ flexWrap: "wrap", gap: "0.75rem", marginBottom: "0.75rem" }}>
              <label htmlFor="profile-textbook-select" className="profile-muted">
                {t("profile.currentTextbook")}
              </label>
              <select
                id="profile-textbook-select"
                className="profile-signout-btn"
                style={{ minWidth: "12rem", cursor: "pointer" }}
                value={selectedTextbook}
                disabled={textbookUploading || textbookDeleting || catalogSyncing}
                onChange={(e) => {
                  const id = e.target.value;
                  setSelectedTextbook(id);
                  writeSelectedTextbookId(id);
                }}
              >
                {textbookOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.linkLabel}
                  </option>
                ))}
              </select>
            </div>
            {isValidUploadedTextbookId(selectedTextbook) ? (
              <div className="profile-textbook-delete-row">
                <button
                  type="button"
                  className="profile-textbook-delete-btn"
                  disabled={textbookUploading || textbookDeleting || catalogSyncing}
                  onClick={() => void onDeleteSelectedUpload()}
                >
                  {textbookDeleting ? t("profile.deleting") : t("profile.deleteUpload")}
                </button>
                <span className="profile-muted profile-textbook-delete-hint">{t("profile.deleteHint")}</span>
              </div>
            ) : null}
            <div className="profile-textbook-sync-row">
              <button
                type="button"
                className="profile-textbook-sync-btn"
                disabled={textbookUploading || textbookDeleting || catalogSyncing}
                onClick={() => void onResyncCatalogFromServer()}
              >
                {catalogSyncing ? t("profile.syncing") : t("profile.syncCatalog")}
              </button>
              <span className="profile-muted profile-textbook-sync-hint">{t("profile.syncHint")}</span>
              <button
                type="button"
                className="profile-textbook-reset-local-btn"
                disabled={textbookUploading || textbookDeleting || catalogSyncing}
                onClick={onClearLocalUploadsOnly}
              >
                {t("profile.clearLocalUploads")}
              </button>
              <span className="profile-muted profile-textbook-sync-hint">{t("profile.clearLocalHint")}</span>
            </div>
            <div className="profile-account-row profile-file-upload-row">
              <span className="profile-muted" id="profile-textbook-file-label">
                {t("profile.uploadLabel")}
              </span>
              <div className="profile-file-upload-controls">
                <input
                  ref={textbookFileRef}
                  id="profile-textbook-file"
                  type="file"
                  accept="application/pdf,.pdf"
                  className="profile-file-input-hidden"
                  tabIndex={-1}
                  aria-labelledby="profile-textbook-file-label"
                  disabled={textbookUploading || textbookDeleting || catalogSyncing}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    setPickedPdfName(f.name);
                    void onTextbookFile(f);
                  }}
                />
                <button
                  type="button"
                  className="profile-file-choose-btn"
                  disabled={textbookUploading || textbookDeleting || catalogSyncing}
                  onClick={() => textbookFileRef.current?.click()}
                >
                  {t("profile.chooseFile")}
                </button>
                <span className="profile-file-status" aria-live="polite">
                  {textbookUploading ? t("profile.buildingOutline") : pickedPdfName ?? t("profile.noFileChosen")}
                </span>
              </div>
            </div>
            {textbookError ? (
              <p className="profile-muted" style={{ color: "#c62828", marginTop: "0.5rem" }}>
                {textbookError}
              </p>
            ) : null}
          </>
        )}
      </section>

      <section className="profile-card" aria-labelledby="profile-appearance-heading">
        <h2 id="profile-appearance-heading" className="profile-card-title">
          {t("profile.appearance")}
        </h2>
        <p className="profile-setting-desc">{t("profile.appearanceDesc")}</p>
        <div className="profile-bg-grid" role="radiogroup" aria-label={t("profile.appearanceGroup")}>
          {PAGE_BACKGROUND_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={pageBackground === opt.id}
              className={`profile-bg-swatch ${pageBackground === opt.id ? "profile-bg-swatch--active" : ""}`}
              onClick={() => setPageBackground(opt.id as PageBackgroundId)}
              title={`${t(`theme.${opt.id}` as MessageKey)}: ${t("theme.titleSuffix")}`}
            >
              <span
                className="profile-bg-swatch-dot"
                style={{
                  background: `linear-gradient(135deg, ${opt.page} 45%, ${opt.chat} 45%)`,
                }}
                aria-hidden
              />
              <span className="profile-bg-swatch-label">{t(`theme.${opt.id}` as MessageKey)}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
