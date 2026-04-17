import { useCallback, useEffect, useRef, useState } from "react";
import { apiUrl } from "./apiBase";
import { useAuth } from "./context/AuthContext";
import { useProfileSettings } from "./context/ProfileSettingsContext";
import { PAGE_BACKGROUND_OPTIONS, type PageBackgroundId } from "./profile/profileSettings";
import {
  invalidateTextbookCatalogSync,
  isValidUploadedTextbookId,
  readSelectedTextbookId,
  readTextbookOptionList,
  removeUploadedTextbookFromLocal,
  syncTextbookCatalogFromServer,
  type TextbookTreeRoot,
  writeCatalogAndTree,
  writeSelectedTextbookId,
} from "./learningTextbooks";
import "./UserProfile.css";

function GoogleIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

export default function UserProfile() {
  const { user, loading, login, logout, token } = useAuth();
  const { pageBackground, setPageBackground } = useProfileSettings();
  const [textbookOptions, setTextbookOptions] = useState(() => readTextbookOptionList());
  const [selectedTextbook, setSelectedTextbook] = useState(() => readSelectedTextbookId());
  const [textbookUploading, setTextbookUploading] = useState(false);
  const [textbookDeleting, setTextbookDeleting] = useState(false);
  const [textbookError, setTextbookError] = useState<string | null>(null);
  const [pickedPdfName, setPickedPdfName] = useState<string | null>(null);
  const textbookFileRef = useRef<HTMLInputElement>(null);

  const refreshTextbookOptions = useCallback(() => {
    setTextbookOptions(readTextbookOptionList());
    setSelectedTextbook(readSelectedTextbookId());
  }, []);

  useEffect(() => {
    if (!token) return;
    void (async () => {
      await syncTextbookCatalogFromServer(token);
      refreshTextbookOptions();
    })();
  }, [token, refreshTextbookOptions]);

  useEffect(() => {
    const onChange = () => refreshTextbookOptions();
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
      setTextbookError("Sign in to upload a PDF textbook.");
      clearTextbookFileInput();
      return;
    }
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setTextbookError("Please choose a PDF file.");
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
        setTextbookError(typeof data?.detail === "string" ? data.detail : "Upload or outline parsing failed.");
        return;
      }
      if (!data?.id || !data?.tree) {
        setTextbookError("The server response was incomplete.");
        return;
      }
      writeCatalogAndTree(data.id, data.label || data.id, data.tree);
      writeSelectedTextbookId(data.id);
      refreshTextbookOptions();
    } catch {
      setTextbookError("Could not reach the server. Try again later.");
    } finally {
      setTextbookUploading(false);
      clearTextbookFileInput();
    }
  };

  const onDeleteSelectedUpload = async () => {
    if (!token || !isValidUploadedTextbookId(selectedTextbook)) return;
    const label =
      textbookOptions.find((o) => o.id === selectedTextbook)?.linkLabel ?? selectedTextbook;
    if (
      !window.confirm(
        `Permanently delete "${label}"? The PDF, outline, and learning progress for this book will be removed. This cannot be undone.`
      )
    ) {
      return;
    }
    setTextbookDeleting(true);
    setTextbookError(null);
    try {
      const resp = await fetch(apiUrl(`/api/user_textbooks/${encodeURIComponent(selectedTextbook)}`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      let data: { detail?: string } = {};
      try {
        data = (await resp.json()) as { detail?: string };
      } catch {
        /* non-JSON body */
      }
      if (!resp.ok) {
        setTextbookError(typeof data?.detail === "string" ? data.detail : "Delete failed.");
        return;
      }
      invalidateTextbookCatalogSync();
      removeUploadedTextbookFromLocal(selectedTextbook);
      await syncTextbookCatalogFromServer(token);
      refreshTextbookOptions();
      setSelectedTextbook(readSelectedTextbookId());
      window.dispatchEvent(
        new CustomEvent("ai-tutor-textbook-changed", { detail: { id: readSelectedTextbookId() } })
      );
    } catch {
      setTextbookError("Could not reach the server. Try again later.");
    } finally {
      setTextbookDeleting(false);
    }
  };

  return (
    <div className="profile-page">
      <header className="profile-page-header">
        <h1 className="profile-page-title">My profile</h1>
        <p className="profile-page-subtitle">Account and appearance. More options can be added here later.</p>
      </header>

      <section className="profile-card" aria-labelledby="profile-account-heading">
        <h2 id="profile-account-heading" className="profile-card-title">
          Account
        </h2>
        {loading ? (
          <p className="profile-muted">Loading…</p>
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
              Sign out
            </button>
          </div>
        ) : (
          <div className="profile-account-block">
            <p className="profile-muted">You are not signed in. Sign in to save chat history and sync learning progress.</p>
            <button type="button" className="profile-google-btn" onClick={login}>
              <GoogleIcon size={18} />
              Sign in with Google
            </button>
          </div>
        )}
      </section>

      <section className="profile-card" aria-labelledby="profile-textbook-heading">
        <h2 id="profile-textbook-heading" className="profile-card-title">
          Textbooks and outlines
        </h2>
        <p className="profile-setting-desc">
          When you pick a textbook, the learning progress bar and all outline / PDF references in Learning Mode switch
          to that book. After you upload a PDF, the server checks that it is a real textbook or course book, then builds
          an outline JSON in the same shape as FCOS (nested objects and page numbers). Other PDF types are not accepted
          here—use Auto Grader for those.
        </p>
        {!user ? (
          <p className="profile-muted">Sign in to upload your own PDF and save it to your account.</p>
        ) : (
          <>
            <div className="profile-account-row" style={{ flexWrap: "wrap", gap: "0.75rem", marginBottom: "0.75rem" }}>
              <label htmlFor="profile-textbook-select" className="profile-muted">
                Current textbook
              </label>
              <select
                id="profile-textbook-select"
                className="profile-signout-btn"
                style={{ minWidth: "12rem", cursor: "pointer" }}
                value={selectedTextbook}
                disabled={textbookUploading || textbookDeleting}
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
                  disabled={textbookUploading || textbookDeleting}
                  onClick={() => void onDeleteSelectedUpload()}
                >
                  {textbookDeleting ? "Deleting…" : "Delete this uploaded textbook"}
                </button>
                <span className="profile-muted profile-textbook-delete-hint">
                  Removes the PDF and outline from your account and clears learning progress for this book.
                </span>
              </div>
            ) : null}
            <div className="profile-account-row profile-file-upload-row">
              <span className="profile-muted" id="profile-textbook-file-label">
                Upload new textbook (PDF)
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
                  disabled={textbookUploading || textbookDeleting}
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
                  disabled={textbookUploading || textbookDeleting}
                  onClick={() => textbookFileRef.current?.click()}
                >
                  Choose file
                </button>
                <span className="profile-file-status" aria-live="polite">
                  {textbookUploading ? "Building outline…" : pickedPdfName ?? "No file chosen"}
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
          Appearance
        </h2>
        <p className="profile-setting-desc">
          Page background and Learning Mode chat panel — each preset updates both so text stays easy to read.
        </p>
        <div className="profile-bg-grid" role="radiogroup" aria-label="Page and chat panel colors">
          {PAGE_BACKGROUND_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={pageBackground === opt.id}
              className={`profile-bg-swatch ${pageBackground === opt.id ? "profile-bg-swatch--active" : ""}`}
              onClick={() => setPageBackground(opt.id as PageBackgroundId)}
              title={`${opt.label}: page + chat panel`}
            >
              <span
                className="profile-bg-swatch-dot"
                style={{
                  background: `linear-gradient(135deg, ${opt.page} 45%, ${opt.chat} 45%)`,
                }}
                aria-hidden
              />
              <span className="profile-bg-swatch-label">{opt.label}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
