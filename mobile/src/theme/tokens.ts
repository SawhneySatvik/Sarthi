import { Platform, StyleSheet, type TextStyle, type ViewStyle } from "react-native";

export const THEME_NAMES = ["ember", "bone", "moss"] as const;
export const THEME_MODES = ["light", "dark", "system"] as const;

export type ThemeName = (typeof THEME_NAMES)[number];
export type ThemeMode = (typeof THEME_MODES)[number];
export type ResolvedThemeMode = Exclude<ThemeMode, "system">;

export type ThemeColors = Readonly<{
  canvas: string;
  card: string;
  raised: string;
  line: string;
  ink1: string;
  ink2: string;
  ink3: string;
  energy: string;
  health: string;
  money: string;
  habits: string;
  skills: string;
  healthStrong: string;
  moneyStrong: string;
  habitsStrong: string;
  skillsStrong: string;
  ok: string;
  warn: string;
  danger: string;
  scrim: string;
  ring: string;
}>;

export type SarthiTheme = Readonly<{
  name: ThemeName;
  mode: ResolvedThemeMode;
  colors: ThemeColors;
  spacing: Readonly<{
    xxs: number;
    xs: number;
    sm: number;
    md: number;
    card: number;
    lg: number;
    xl: number;
    xxl: number;
    shell: number;
  }>;
  radius: Readonly<{ card: number; chip: number; input: number }>;
  layout: Readonly<{ contentMaxWidth: number; diagnosticMaxHeight: number; hitTarget: number; captureTarget: number }>;
  border: Readonly<{ hairline: number }>;
  typography: Readonly<{
    displayXl: TextStyle;
    display: TextStyle;
    title: TextStyle;
    body: TextStyle;
    coach: TextStyle;
    caption: TextStyle;
    code: TextStyle;
  }>;
  shadows: Readonly<{ card: ViewStyle }>;
  motion: Readonly<{
    fast: number;
    base: number;
    slow: number;
    hero: number;
    easing: readonly [number, number, number, number];
  }>;
}>;

const typography = {
  displayXl: { fontSize: 40, lineHeight: 44, fontFamily: Platform.select({ ios: "ui-rounded", default: "sans-serif-medium" }) },
  display: { fontSize: 28, lineHeight: 32, fontFamily: Platform.select({ ios: "ui-rounded", default: "sans-serif-medium" }) },
  title: { fontSize: 20, lineHeight: 26, fontFamily: Platform.select({ ios: "system-ui", default: "sans-serif-medium" }) },
  body: { fontSize: 15, lineHeight: 22, fontFamily: Platform.select({ ios: "system-ui", default: "sans-serif" }) },
  coach: { fontSize: 16, lineHeight: 26, fontFamily: Platform.select({ ios: "ui-serif", default: "serif" }) },
  caption: { fontSize: 12, lineHeight: 16, fontFamily: Platform.select({ ios: "system-ui", default: "sans-serif" }) },
  code: { fontSize: 12, lineHeight: 16, fontFamily: Platform.select({ ios: "ui-monospace", default: "monospace" }) },
} as const satisfies Record<string, TextStyle>;

const spacing = { xxs: 4, xs: 8, sm: 12, md: 16, card: 20, lg: 24, xl: 32, xxl: 64, shell: 24 } as const;
const radius = { card: 20, chip: 999, input: 14 } as const;
const layout = { contentMaxWidth: 720, diagnosticMaxHeight: 320, hitTarget: 44, captureTarget: 64 } as const;
const border = { hairline: StyleSheet.hairlineWidth } as const;
const motion = { fast: 120, base: 200, slow: 320, hero: 900, easing: [0.2, 0, 0, 1] as const } as const;

const shadows = {
  card: {
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 8,
    shadowOpacity: 0.16,
    elevation: 2,
  },
} as const satisfies Record<string, ViewStyle>;

type ThemePalette = Readonly<Record<ThemeName, Readonly<Record<ResolvedThemeMode, ThemeColors>>>>;

const darkDomain = {
  health: "#7FB08C",
  money: "#C0883A",
  habits: "#8189CF",
  skills: "#A97FC9",
  healthStrong: "#A6CBAF",
  moneyStrong: "#E6BD77",
  habitsStrong: "#A7ADDE",
  skillsStrong: "#C6A6DC",
  ok: "#7FB08C",
  warn: "#E6972E",
  danger: "#C96E63",
} as const;

const lightDomain = {
  health: "#7FB08C",
  money: "#D8A24A",
  habits: "#8189CF",
  skills: "#A97FC9",
  healthStrong: "#4C8A5E",
  moneyStrong: "#A47417",
  habitsStrong: "#5560B8",
  skillsStrong: "#8352A8",
  ok: "#4C8A5E",
  warn: "#A47417",
  danger: "#B0483C",
} as const;

export const themePalette = {
  ember: {
    dark: {
      canvas: "#0C0B0A", card: "#17130E", raised: "#1E1913", line: "#2A241C", ink1: "#F4EFE4", ink2: "#A79E8E", ink3: "#8D8377", energy: "#E8913E", scrim: "rgba(12, 11, 10, 0.72)", ring: "#F4EFE4", ...darkDomain,
    },
    light: {
      canvas: "#FAF6EE", card: "#FFFDF8", raised: "#FFFFFF", line: "#E8E0D2", ink1: "#1C1710", ink2: "#6B6153", ink3: "#787061", energy: "#C86F1B", scrim: "rgba(250, 246, 238, 0.72)", ring: "#1C1710", ...lightDomain,
    },
  },
  bone: {
    dark: {
      canvas: "#131211", card: "#181614", raised: "#201D1A", line: "#3A3633", ink1: "#F4F1EC", ink2: "#A3A09B", ink3: "#87847D", energy: "#E8913E", scrim: "rgba(19, 18, 17, 0.72)", ring: "#F4F1EC", ...darkDomain,
    },
    light: {
      canvas: "#FAF7F2", card: "#FFFFFF", raised: "#FDFCF9", line: "#E5DFD6", ink1: "#211E1C", ink2: "#6F6A66", ink3: "#736D65", energy: "#C86F1B", scrim: "rgba(250, 247, 242, 0.72)", ring: "#211E1C", ...lightDomain,
    },
  },
  moss: {
    dark: {
      canvas: "#0B0E0B", card: "#131A14", raised: "#1A231B", line: "#263127", ink1: "#EEF3EC", ink2: "#9FAC9D", ink3: "#828D80", energy: "#E8913E", scrim: "rgba(11, 14, 11, 0.72)", ring: "#EEF3EC", ...darkDomain,
    },
    light: {
      canvas: "#F4F7F2", card: "#FDFFFC", raised: "#FFFFFF", line: "#DDE5DA", ink1: "#1A211A", ink2: "#616B60", ink3: "#697268", energy: "#C86F1B", scrim: "rgba(244, 247, 242, 0.72)", ring: "#1A211A", ...lightDomain,
    },
  },
} as const satisfies ThemePalette;

export function makeTheme(name: ThemeName, mode: ResolvedThemeMode): SarthiTheme {
  const cardShadow = name === "bone" ? {} : { shadowColor: mode === "dark" ? "#000000" : "#3C2814", ...shadows.card };

  return {
    name,
    mode,
    colors: themePalette[name][mode],
    spacing,
    radius,
    layout,
    border,
    typography,
    shadows: { card: cardShadow },
    motion,
  };
}
