import { SQLiteStorage } from "expo-sqlite/kv-store";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { useColorScheme } from "react-native";

import { makeTheme, type ResolvedThemeMode, type SarthiTheme, type ThemeMode, type ThemeName } from "./tokens";

type ThemeContextValue = Readonly<{
  theme: SarthiTheme;
  themeName: ThemeName;
  themeMode: ThemeMode;
  resolvedMode: ResolvedThemeMode;
  hydrated: boolean;
  setThemeName: (name: ThemeName) => void;
  setThemeMode: (mode: ThemeMode) => void;
}>;

const ThemeContext = createContext<ThemeContextValue | null>(null);

export type SarthiThemeProviderProps = PropsWithChildren<{
  themeName?: ThemeName;
  themeMode?: ThemeMode;
}>;

const preferences = new SQLiteStorage("sarthi-native-preferences.db");
const themeNameKey = "appearance:theme-name";
const themeModeKey = "appearance:theme-mode";

function isThemeName(value: string | null): value is ThemeName {
  return value === "ember" || value === "bone" || value === "moss";
}

function isThemeMode(value: string | null): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system";
}

/**
 * M0 resolves the device preference; M1 will hydrate the same inputs from the
 * local profile, so consumers never branch on a palette or platform scheme.
 */
export function SarthiThemeProvider({
  children,
  themeName: initialThemeName = "bone",
  themeMode: initialThemeMode = "system",
}: SarthiThemeProviderProps) {
  const deviceMode = useColorScheme();
  const [themeName, setThemeNameState] = useState<ThemeName>(initialThemeName);
  const [themeMode, setThemeModeState] = useState<ThemeMode>(initialThemeMode);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let alive = true;
    void Promise.all([preferences.getItem(themeNameKey), preferences.getItem(themeModeKey)])
      .then(([storedName, storedMode]) => {
        if (!alive) return;
        if (isThemeName(storedName)) setThemeNameState(storedName);
        if (isThemeMode(storedMode)) setThemeModeState(storedMode);
      })
      .finally(() => {
        if (alive) setHydrated(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const setThemeName = useCallback((name: ThemeName) => {
    setThemeNameState(name);
    void preferences.setItem(themeNameKey, name);
  }, []);
  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode);
    void preferences.setItem(themeModeKey, mode);
  }, []);
  const resolvedMode: ResolvedThemeMode = themeMode === "system" ? (deviceMode === "dark" ? "dark" : "light") : themeMode;
  const value = useMemo(
    () => ({ theme: makeTheme(themeName, resolvedMode), themeName, themeMode, resolvedMode, hydrated, setThemeName, setThemeMode }),
    [hydrated, resolvedMode, setThemeMode, setThemeName, themeMode, themeName],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useSarthiTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useSarthiTheme must be used within SarthiThemeProvider");
  return context;
}
