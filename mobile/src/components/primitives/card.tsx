import { View, type ViewProps } from "react-native";

import { useSarthiTheme } from "@mobile/theme";

export function Card({ style, ...props }: ViewProps) {
  const { theme } = useSarthiTheme();
  return (
    <View
      {...props}
      style={[
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.line,
          borderRadius: theme.radius.card,
          borderWidth: theme.border.hairline,
          padding: theme.spacing.card,
          ...theme.shadows.card,
        },
        style,
      ]}
    />
  );
}
