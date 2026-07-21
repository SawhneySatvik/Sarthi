import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { SarthiThemeProvider, useSarthiTheme } from "@mobile/theme";
import { installForegroundNotificationHandler } from "@mobile/notifications/expo-local";

installForegroundNotificationHandler();

function RootNavigator() {
  const { theme } = useSarthiTheme();

  return (
    <>
      <StatusBar style={theme.mode === "dark" ? "light" : "dark"} />
      <Stack screenOptions={{ contentStyle: { backgroundColor: theme.colors.canvas }, headerShown: false }} />
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SarthiThemeProvider>
        <RootNavigator />
      </SarthiThemeProvider>
    </SafeAreaProvider>
  );
}
