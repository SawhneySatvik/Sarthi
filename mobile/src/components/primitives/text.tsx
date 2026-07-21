import { Text, type TextProps } from "react-native";

import { useSarthiTheme } from "@mobile/theme";

export type TextTone = "primary" | "secondary" | "muted" | "coach" | "health" | "money" | "habits" | "skills" | "danger";
export type TextRole = "displayXl" | "display" | "title" | "body" | "coach" | "caption" | "code";

const toneKey: Readonly<Record<TextTone, keyof ReturnType<typeof useSarthiTheme>["theme"]["colors"]>> = {
  primary: "ink1",
  secondary: "ink2",
  muted: "ink3",
  coach: "ink1",
  health: "healthStrong",
  money: "moneyStrong",
  habits: "habitsStrong",
  skills: "skillsStrong",
  danger: "danger",
};

export type SarthiTextProps = Omit<TextProps, "role" | "tone"> & { role?: TextRole; tone?: TextTone };

export function SarthiText({ style, role = "body", tone = "primary", ...props }: SarthiTextProps) {
  const { theme } = useSarthiTheme();
  return <Text {...props} style={[theme.typography[role], { color: theme.colors[toneKey[tone]] }, style]} />;
}
