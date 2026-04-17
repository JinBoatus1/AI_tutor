import { useAuth } from "./context/AuthContext";
import { useProfileSettings } from "./context/ProfileSettingsContext";
import { PAGE_BACKGROUND_OPTIONS, type PageBackgroundId } from "./profile/profileSettings";
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
  const { user, loading, login, logout } = useAuth();
  const { pageBackground, setPageBackground } = useProfileSettings();

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

      <section className="profile-card" aria-labelledby="profile-appearance-heading">
        <h2 id="profile-appearance-heading" className="profile-card-title">
          Appearance
        </h2>
        <p className="profile-setting-desc">Page background (applies across the app).</p>
        <div className="profile-bg-grid" role="radiogroup" aria-label="Page background">
          {PAGE_BACKGROUND_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={pageBackground === opt.id}
              className={`profile-bg-swatch ${pageBackground === opt.id ? "profile-bg-swatch--active" : ""}`}
              onClick={() => setPageBackground(opt.id as PageBackgroundId)}
              title={opt.label}
            >
              <span className="profile-bg-swatch-dot" style={{ background: opt.color }} aria-hidden />
              <span className="profile-bg-swatch-label">{opt.label}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
