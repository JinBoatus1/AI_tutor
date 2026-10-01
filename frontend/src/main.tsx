import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { CurriculumProvider } from "./context/CurriculumContext";
import { AuthProvider } from "./context/AuthContext";
import { ProfileSettingsProvider } from "./context/ProfileSettingsContext";
import { LocaleProvider } from "./i18n/LocaleContext";
import { SessionBridgeProvider } from "./context/SessionBridge";
import { FeedbackProvider } from "./feedback/FeedbackContext";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <CurriculumProvider>
        <LocaleProvider>
          <ProfileSettingsProvider>
            <SessionBridgeProvider>
              <FeedbackProvider>
                <App />
              </FeedbackProvider>
            </SessionBridgeProvider>
          </ProfileSettingsProvider>
        </LocaleProvider>
      </CurriculumProvider>
    </AuthProvider>
  </StrictMode>
);
