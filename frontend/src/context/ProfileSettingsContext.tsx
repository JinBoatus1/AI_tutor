import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  applyPageBackground,
  readPageBackground,
  writePageBackground,
  type PageBackgroundId,
} from "../profile/profileSettings";

type ProfileSettingsContextValue = {
  pageBackground: PageBackgroundId;
  setPageBackground: (id: PageBackgroundId) => void;
};

const ProfileSettingsContext = createContext<ProfileSettingsContextValue | null>(null);

export function ProfileSettingsProvider({ children }: { children: ReactNode }) {
  const [pageBackground, setPageBackgroundState] = useState<PageBackgroundId>(() => readPageBackground());

  useLayoutEffect(() => {
    applyPageBackground(pageBackground);
  }, [pageBackground]);

  const setPageBackground = useCallback((id: PageBackgroundId) => {
    setPageBackgroundState(id);
    writePageBackground(id);
    applyPageBackground(id);
  }, []);

  const value = useMemo(
    () => ({ pageBackground, setPageBackground }),
    [pageBackground, setPageBackground]
  );

  return (
    <ProfileSettingsContext.Provider value={value}>{children}</ProfileSettingsContext.Provider>
  );
}

export function useProfileSettings(): ProfileSettingsContextValue {
  const ctx = useContext(ProfileSettingsContext);
  if (!ctx) {
    throw new Error("useProfileSettings must be used within ProfileSettingsProvider");
  }
  return ctx;
}
