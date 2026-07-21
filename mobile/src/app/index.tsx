import { useCallback, useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Card, SarthiButton, SarthiText, Screen } from "@mobile/components/primitives";
import { CANONICAL_CROSS_DOMAIN_DUMP, FakeLlmGateway } from "@mobile/shims/fake-llm";
import { parseDump, type ParseResult } from "@mobile/shims/parse-dump";
import { useSarthiTheme } from "@mobile/theme";

const diagnosticCapture = {
  capturedAt: "2026-07-17T05:15:00.000Z",
  source: "voice" as const,
  timezone: "Asia/Kolkata",
  transcriptConfidenceBps: 9800,
};

export default function HomeScreen() {
  const { theme } = useSarthiTheme();
  const [result, setResult] = useState<ParseResult | null>(null);
  const [isRunning, setIsRunning] = useState(true);

  const runDiagnostic = useCallback(async () => {
    setIsRunning(true);
    const parsed = await parseDump(
      { rawText: CANONICAL_CROSS_DOMAIN_DUMP, ...diagnosticCapture },
      new FakeLlmGateway(),
    );
    setResult(parsed);
    setIsRunning(false);
  }, []);

  useEffect(() => {
    void runDiagnostic();
  }, [runDiagnostic]);

  const draftText = result?.ok ? JSON.stringify(result.draft, null, theme.spacing.xs) : null;

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{
            alignSelf: "center",
            gap: theme.spacing.md,
            maxWidth: theme.layout.contentMaxWidth,
            padding: theme.spacing.shell,
            width: "100%",
          }}
          style={{ flex: 1 }}>
          <View style={{ gap: theme.spacing.xs }}>
            <SarthiText role="display">M0 seam check</SarthiText>
            <SarthiText tone="secondary">
              On-device FakeLlmGateway → shared parseDump → validated CaptureDraft. No API key or network request.
            </SarthiText>
          </View>

          <Card style={{ gap: theme.spacing.sm }}>
            <SarthiText role="caption" tone="secondary">
              CANONICAL VOICE DUMP
            </SarthiText>
            <SarthiText role="coach">{CANONICAL_CROSS_DOMAIN_DUMP}</SarthiText>
          </Card>

          <Card style={{ gap: theme.spacing.sm }}>
            <SarthiText role="caption" tone="secondary">
              {isRunning ? "PARSING KEYLESS FIXTURE" : result?.ok ? "VALIDATED CAPTURE DRAFT" : "RETRYABLE PARSE ERROR"}
            </SarthiText>
            {isRunning ? (
              <SarthiText tone="secondary">Loading deterministic provider result…</SarthiText>
            ) : draftText ? (
              <ScrollView style={{ maxHeight: theme.layout.diagnosticMaxHeight }} nestedScrollEnabled>
                <SarthiText role="code" selectable>
                  {draftText}
                </SarthiText>
              </ScrollView>
            ) : (
              <SarthiText tone="danger">{result?.ok ? "" : result?.error}</SarthiText>
            )}
          </Card>

          <SarthiButton disabled={isRunning} label="Run fake parse again" onPress={() => void runDiagnostic()} />
        </ScrollView>
      </SafeAreaView>
    </Screen>
  );
}
