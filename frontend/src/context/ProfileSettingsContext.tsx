import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { applyTheme, readTheme, writeTheme, type ThemeId } from "../profile/profileSettings";

type ProfileSettingsContextValue = {
  theme: ThemeId;
  setTheme: (id: ThemeId) => void;
};

const ProfileSettingsContext = createContext<ProfileSettingsContextValue | null>(null);

export function ProfileSettingsProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(() => readTheme());

  useLayoutEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback((id: ThemeId) => {
    setThemeState(id);
    writeTheme(id);
    applyTheme(id);
  }, []);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

  return <ProfileSettingsContext.Provider value={value}>{children}</ProfileSettingsContext.Provider>;
}

export function useProfileSettings(): ProfileSettingsContextValue {
  const ctx = useContext(ProfileSettingsContext);
  if (!ctx) {
    throw new Error("useProfileSettings must be used within ProfileSettingsProvider");
  }
  return ctx;
}
