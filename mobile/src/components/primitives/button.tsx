import { Pressable, type PressableProps } from "react-native";

import { SarthiText } from "./text";
import { useSarthiTheme } from "@mobile/theme";

export type SarthiButtonProps = PressableProps & { label: string };

export function SarthiButton({ label, style, ...props }: SarthiButtonProps) {
  const { theme } = useSarthiTheme();
  return (
    <Pressable
      accessibilityRole="button"
      {...props}
      style={({ pressed }) => [
        {
          alignItems: "center",
          backgroundColor: theme.colors.raised,
          borderColor: theme.colors.line,
          borderRadius: theme.radius.input,
          borderWidth: theme.border.hairline,
          justifyContent: "center",
          minHeight: theme.layout.hitTarget,
          opacity: pressed ? theme.motion.fast / theme.motion.base : 1,
          paddingHorizontal: theme.spacing.md,
        },
        typeof style === "function" ? style({ pressed }) : style,
      ]}>
      <SarthiText role="body">{label}</SarthiText>
    </Pressable>
  );
}
