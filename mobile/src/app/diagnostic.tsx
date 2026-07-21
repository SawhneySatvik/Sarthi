import { useCallback, useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { FakeLlmGateway } from "@providers/fake/llm";
import { CANONICAL_CROSS_DOMAIN_DUMP } from "@providers/fake/fixtures";
import { parseDump, type ParseResult } from "@core/capture/parse";
import { Card, SarthiButton, SarthiText, Screen } from "@mobile/components/primitives";
import { useSarthiTheme } from "@mobile/theme";

const input = {
  capturedAt: "2026-07-17T05:15:00.000Z",
  source: "voice" as const,
  timezone: "Asia/Kolkata",
  transcriptConfidenceBps: 9800,
};

/** A permanent, keyless device diagnostic for the M0 core/Metro seam. */
export default function DiagnosticScreen() {
  const { theme } = useSarthiTheme();
  const [result, setResult] = useState<ParseResult | null>(null);
  const [busy, setBusy] = useState(true);
  const run = useCallback(async () => {
    setBusy(true);
    setResult(await parseDump({ rawText: CANONICAL_CROSS_DOMAIN_DUMP, ...input }, new FakeLlmGateway()));
    setBusy(false);
  }, []);
  useEffect(() => { void run(); }, [run]);
  const draft = result?.ok ? JSON.stringify(result.draft, null, theme.spacing.xs) : null;
  return <Screen><SafeAreaView style={{ flex: 1 }}><ScrollView contentContainerStyle={{ gap: theme.spacing.md, padding: theme.spacing.shell }}>
    <View style={{ gap: theme.spacing.xs }}><SarthiText role="display">M0 seam check</SarthiText><SarthiText tone="secondary">FakeLlmGateway → shared parseDump → validated CaptureDraft. No key or network.</SarthiText></View>
    <Card style={{ gap: theme.spacing.sm }}><SarthiText role="caption" tone="muted">CANONICAL VOICE DUMP</SarthiText><SarthiText role="coach">{CANONICAL_CROSS_DOMAIN_DUMP}</SarthiText></Card>
    <Card style={{ gap: theme.spacing.sm }}><SarthiText role="caption" tone="muted">{busy ? "PARSING KEYLESS FIXTURE" : result?.ok ? "VALIDATED CAPTURE DRAFT" : "RETRYABLE ERROR"}</SarthiText>{busy ? <SarthiText tone="secondary">Loading deterministic provider result…</SarthiText> : draft ? <ScrollView nestedScrollEnabled style={{ maxHeight: theme.layout.diagnosticMaxHeight }}><SarthiText role="code" selectable>{draft}</SarthiText></ScrollView> : <SarthiText tone="danger">{result?.ok ? "" : result?.error}</SarthiText>}</Card>
    <SarthiButton label="Run fake parse again" disabled={busy} onPress={() => void run()} />
  </ScrollView></SafeAreaView></Screen>;
}
