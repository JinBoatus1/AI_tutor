import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { CurriculumProvider } from "./context/CurriculumContext";
import { AuthProvider } from "./context/AuthContext";
import { ProfileSettingsProvider } from "./context/ProfileSettingsContext";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <CurriculumProvider>
        <ProfileSettingsProvider>
          <App />
        </ProfileSettingsProvider>
      </CurriculumProvider>
    </AuthProvider>
  </StrictMode>
);
