import { createContext, useContext, useMemo, type PropsWithChildren } from "react";
import { useColorScheme } from "react-native";

import { makeTheme, type ResolvedThemeMode, type SarthiTheme, type ThemeMode, type ThemeName } from "./tokens";

type ThemeContextValue = Readonly<{
  theme: SarthiTheme;
  themeName: ThemeName;
  themeMode: ThemeMode;
  resolvedMode: ResolvedThemeMode;
}>;

const ThemeContext = createContext<ThemeContextValue | null>(null);

export type SarthiThemeProviderProps = PropsWithChildren<{
  themeName?: ThemeName;
  themeMode?: ThemeMode;
}>;

/**
 * M0 resolves the device preference; M1 will hydrate the same inputs from the
 * local profile, so consumers never branch on a palette or platform scheme.
 */
export function SarthiThemeProvider({
  children,
  themeName = "bone",
  themeMode = "system",
}: SarthiThemeProviderProps) {
  const deviceMode = useColorScheme();
  const resolvedMode: ResolvedThemeMode = themeMode === "system" ? (deviceMode === "dark" ? "dark" : "light") : themeMode;
  const value = useMemo(
    () => ({ theme: makeTheme(themeName, resolvedMode), themeName, themeMode, resolvedMode }),
    [resolvedMode, themeMode, themeName],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useSarthiTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useSarthiTheme must be used within SarthiThemeProvider");
  return context;
}
