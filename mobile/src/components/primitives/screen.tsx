import { View, type ViewProps } from "react-native";

import { useSarthiTheme } from "@mobile/theme";

export function Screen({ style, ...props }: ViewProps) {
  const { theme } = useSarthiTheme();
  return <View {...props} style={[{ flex: 1, backgroundColor: theme.colors.canvas }, style]} />;
}
