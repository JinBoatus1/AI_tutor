import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { CurriculumProvider } from "./context/CurriculumContext";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <CurriculumProvider>
      <App />
    </CurriculumProvider>
  </StrictMode>
);
