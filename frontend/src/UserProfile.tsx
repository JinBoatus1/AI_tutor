import { useCallback, useEffect, useRef, useState } from "react";
import { apiUrl } from "./apiBase";
import { useAuth } from "./context/AuthContext";
import { useProfileSettings } from "./context/ProfileSettingsContext";
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
    if (
      !window.confirm(
        "Remove every uploaded book from this browser only? This does not delete files on the server. FCOS stays available."
      )
    ) {
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
      void refreshTextbookOptions();
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
        setTextbookError(typeof data?.detail === "string" ? data.detail : "Delete failed.");
        return;
      }
      invalidateTextbookCatalogSync();
      removeUploadedTextbookFromLocal(selectedTextbook);
      await fetchTextbookOptionsFromServer(token);
      setTextbookOptions(readTextbookOptionList());
      setSelectedTextbook(readSelectedTextbookId());
    } catch {
      setTextbookError("Could not reach the server. Try again later.");
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
        setTextbookError(
          "Could not load your textbook list from the server (network or sign-in). Your local list was not changed."
        );
        return;
      }
      setTextbookOptions(readTextbookOptionList());
      setSelectedTextbook(readSelectedTextbookId());
    } catch {
      setTextbookError("Could not reach the server. Try again later.");
    } finally {
      setCatalogSyncing(false);
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
            <button type="button" className="profile-google-btn" onClick={() => setShowSignIn(true)}>
              Sign in
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
                  {textbookDeleting ? "Deleting…" : "Delete this uploaded textbook"}
                </button>
                <span className="profile-muted profile-textbook-delete-hint">
                  Removes the PDF and outline from your account and clears learning progress for this book.
                </span>
              </div>
            ) : null}
            <div className="profile-textbook-sync-row">
              <button
                type="button"
                className="profile-textbook-sync-btn"
                disabled={textbookUploading || textbookDeleting || catalogSyncing}
                onClick={() => void onResyncCatalogFromServer()}
              >
                {catalogSyncing ? "Syncing…" : "Sync textbook list with server"}
              </button>
              <span className="profile-muted profile-textbook-sync-hint">
                Replaces this browser's list with what your account has on the server. If this fails (offline / 401),
                the red message above explains it. Learning Mode uses the same data.
              </span>
              <button
                type="button"
                className="profile-textbook-reset-local-btn"
                disabled={textbookUploading || textbookDeleting || catalogSyncing}
                onClick={onClearLocalUploadsOnly}
              >
                Clear uploaded books from this browser only
              </button>
              <span className="profile-muted profile-textbook-sync-hint">
                Removes all user-uploaded entries from local storage (not the server). Use when the list is stuck or
                shows duplicates; then use Sync to pull real books back from the server.
              </span>
            </div>
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
