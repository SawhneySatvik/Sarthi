import { randomUUID } from "node:crypto";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppState, Linking, Modal, Pressable, SafeAreaView, View } from "react-native";
import { useRouter } from "expo-router";

import type { UserScopedRepositories } from "@contracts";
import { localDateInZone } from "@core/time";
import { FakeLlmGateway } from "@providers/fake/llm";
import { FakeVoiceProvider } from "@providers/fake/voice";
import { FakeVisionProvider } from "@providers/fake/vision";
import { createMobileRepositoryRuntime } from "@mobile/adapters/repository";
import { createNativeAuthRuntime, userFromAuthSnapshot } from "@mobile/auth/runtime";
import type { AuthSnapshot } from "@mobile/auth/session";
import { handleSupabaseAuthCallback } from "@mobile/auth/supabase";
import { BearerCaptureParser, BearerVoiceProvider } from "@mobile/adapters/server-capture";
import { Card, SarthiButton, SarthiText } from "@mobile/components/primitives";
import { CaptureSheet, createCaptureRuntime, type CaptureRuntime } from "@mobile/features/capture";
import { CoachReadingRoom } from "@mobile/features/coach/coach-reading-room";
import { JourneyTimeline } from "@mobile/features/journey/journey-timeline";
import { LensRenderer } from "@mobile/features/lenses/lens-renderer";
import type { HabitLensModel, HealthLensModel, MoneyLensModel, SkillLensModel } from "@mobile/features/lenses/types";
import { SettingsScreen } from "@mobile/features/settings/settings-screen";
import { StatsWall } from "@mobile/features/stats/stats-wall";
import { TodayScreen, type TodayItem } from "@mobile/features/today/today-screen";
import { FocusTimer } from "@mobile/features/tools/focus-timer";
import { MeditationTimer } from "@mobile/features/tools/meditation-timer";
import { SqliteTimerStore } from "@mobile/features/tools/timer";
import { ToolsDesk } from "@mobile/features/tools/tools-desk";
import { useSarthiTheme } from "@mobile/theme";
import { ConfirmedOutboxSyncBridge } from "@mobile/sync/bridge";
import { attachReconnectReplay } from "@mobile/sync/connectivity";
import { expoConnectivity } from "@mobile/sync/expo-connectivity";
import { NativeSyncEngine } from "@mobile/sync/engine";
import { SqliteSyncQueueStore } from "@mobile/sync/sqlite-store";
import { SupabaseTypedSyncTransport } from "@mobile/sync/supabase-transport";
import { allTableDescriptors } from "@schema/contract";
import { AuthScreen } from "@mobile/features/auth/auth-screen";
import type { AuthScreenMode } from "@mobile/features/auth/auth-screen";

type Tab = "today" | "journey" | "coach" | "stats" | "tools";
type Counts = { water: number; meals: number; transactions: number; habits: number; sessions: number; skillId: string | null };

const timerStore = new SqliteTimerStore();
const tabLabels: ReadonlyArray<{ id: Tab; label: string }> = [
  { id: "today", label: "Today" }, { id: "journey", label: "Journey" }, { id: "coach", label: "Coach" }, { id: "stats", label: "Stats" }, { id: "tools", label: "Tools" },
];
const emptyCounts: Counts = { water: 0, meals: 0, transactions: 0, habits: 0, sessions: 0, skillId: null };

function timezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

async function readCounts(repos: UserScopedRepositories): Promise<Counts> {
  const [water, meals, transactions, habits, sessions, skills] = await Promise.all([
    repos.health.waterLogs.list({}), repos.health.meals.list({}), repos.money.transactions.list({}), repos.habits.logs.list({}), repos.skills.sessions.list({}), repos.skills.skills.list({ isArchived: false }),
  ]);
  return { water: water.length, meals: meals.length, transactions: transactions.length, habits: habits.length, sessions: sessions.length, skillId: skills[0]?.id ?? null };
}

function useLocalCounts(runtime: ReturnType<typeof createMobileRepositoryRuntime>, repos: UserScopedRepositories | null): Counts {
  const [counts, setCounts] = useState<Counts>(emptyCounts);
  const refresh = useCallback(() => { if (repos) void readCounts(repos).then(setCounts); }, [repos]);
  useEffect(() => {
    refresh();
    return runtime.versions.subscribe(() => refresh());
  }, [refresh, runtime.versions]);
  return counts;
}

function lensModels(counts: Counts): { health: HealthLensModel; money: MoneyLensModel; habits: HabitLensModel; skills: SkillLensModel } {
  return {
    health: { headline: `${counts.water > 0 ? counts.water : "—"} water logs`, coachRead: counts.water > 0 ? "Hydration is now part of today’s evidence." : "A single glass is enough to start the signal.", metrics: [{ id: "water", label: "Water", valueLabel: `${counts.water} logged` }, { id: "meals", label: "Meals", valueLabel: `${counts.meals} logged` }], meals: counts.meals ? [{ id: "recent-meal", title: "Captured meal", detail: "from local Health", valueLabel: `${counts.meals} total`, source: "capture" }] : [] },
    money: { balanceLabel: "Local ledger", safeToSpendLabel: "Needs a budget", coachRead: "Every accepted expense stays typed and reviewable.", budgets: [{ id: "start", label: "This month", valueLabel: `${counts.transactions} entries` }], recurring: [], entries: counts.transactions ? [{ id: "recent-transaction", title: "Captured transaction", detail: "from local Money", valueLabel: `${counts.transactions} total`, source: "capture" }] : [] },
    habits: { headline: `${counts.habits} check-ins`, coachRead: "Small evidence beats an invented streak.", habits: [{ id: "show-up", title: "Show up", streakLabel: counts.habits ? "Captured today" : "Waiting", status: counts.habits ? "satisfied" : "pending" }], month: Array.from({ length: 21 }, (_, index) => ({ id: `day-${index}`, label: `Day ${index + 1}`, complete: index < counts.habits })) },
    skills: { tracks: counts.skillId ? [{ id: counts.skillId, title: "Your practice", hoursLabel: `${counts.sessions} sessions`, levelLabel: "Building", next: "Start a measured focus session", milestones: [{ id: "first", title: "First focused session", done: counts.sessions > 0, suggested: counts.sessions === 0 }], sessions: counts.sessions ? [{ id: "recent-session", title: "Focused practice", detail: "from local Skills", valueLabel: `${counts.sessions} total` }] : [] }] : [] },
  };
}

function AppShell() {
  const { theme, themeName, themeMode, setThemeName, setThemeMode } = useSarthiTheme();
  const router = useRouter();
  const repositoryRuntime = useMemo(() => createMobileRepositoryRuntime(), []);
  const authRuntime = useMemo(() => createNativeAuthRuntime({
    url: process.env.EXPO_PUBLIC_SUPABASE_URL,
    publishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  }), []);
  const [authSnapshot, setAuthSnapshot] = useState<AuthSnapshot>(authRuntime.kind === "local" ? { status: "signed-in", session: { userId: authRuntime.user.userId, accessToken: "", onboardingComplete: true } } : { status: "loading" });
  const [authMode, setAuthMode] = useState<AuthScreenMode>("login");
  const [repos, setRepos] = useState<UserScopedRepositories | null>(null);
  const [capture, setCapture] = useState<CaptureRuntime | null>(null);
  const [tab, setTab] = useState<Tab>("today");
  const [captureOpen, setCaptureOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeTool, setActiveTool] = useState<"focus" | "meditation" | null>(null);
  const [todayItems, setTodayItems] = useState<TodayItem[]>([
    { id: "water", domain: "health", title: "One glass of water", detail: "a low-friction first signal", state: "pending" },
    { id: "checkin", domain: "habits", title: "Tell Sarthi what happened", detail: "one messy sentence is enough", state: "pending" },
  ]);
  const counts = useLocalCounts(repositoryRuntime, repos);
  const models = useMemo(() => lensModels(counts), [counts]);
  const authenticatedUser = useMemo(
    () => authRuntime.kind === "local" ? authRuntime.user : userFromAuthSnapshot(authSnapshot),
    [authRuntime, authSnapshot],
  );
  const accessToken = authRuntime.kind === "supabase" && authSnapshot.status === "signed-in" ? authSnapshot.session.accessToken : null;

  useEffect(() => {
    if (authRuntime.kind === "local") return;
    const unsubscribe = authRuntime.controller.subscribe(setAuthSnapshot);
    void authRuntime.controller.restore();
    return () => {
      unsubscribe();
      authRuntime.stopRefresh();
    };
  }, [authRuntime]);

  useEffect(() => {
    if (authRuntime.kind !== "supabase") return;
    const receive = (url: string) => {
      void handleSupabaseAuthCallback(authRuntime.client, url)
        .then((session) => session ? authRuntime.controller.acceptExternalSession(session).then(() => setAuthMode("update-password")) : undefined)
        .catch(() => undefined);
    };
    void Linking.getInitialURL().then((url) => { if (url) receive(url); });
    const subscription = Linking.addEventListener("url", ({ url }) => receive(url));
    return () => subscription.remove();
  }, [authRuntime]);

  useEffect(() => {
    let alive = true;
    if (!authenticatedUser) {
      setRepos(null);
      setCapture(null);
      return () => { alive = false; };
    }
    void repositoryRuntime.ready.then(() => repositoryRuntime.repositories.forUser(authenticatedUser)).then((scoped) => {
      if (!alive) return;
      setRepos(scoped);
      const liveParser = authRuntime.kind === "supabase" && accessToken && process.env.EXPO_PUBLIC_API_BASE_URL
        ? new BearerCaptureParser(process.env.EXPO_PUBLIC_API_BASE_URL, () => accessToken)
        : null;
      setCapture(createCaptureRuntime({
        repos: scoped,
        llm: new FakeLlmGateway(),
        voice: liveParser ? new BearerVoiceProvider(process.env.EXPO_PUBLIC_API_BASE_URL!, () => accessToken) : new FakeVoiceProvider(),
        vision: new FakeVisionProvider(),
        ...(liveParser ? { parse: (input) => liveParser.parse(input) } : {}),
        now: () => new Date().toISOString(),
        timezone,
        makeIdempotencyKey: (scope) => `${scope}:${randomUUID()}`,
      }));
    });
    return () => { alive = false; };
  }, [accessToken, authRuntime.kind, authenticatedUser, repositoryRuntime]);

  useEffect(() => {
    if (authRuntime.kind !== "supabase" || !authenticatedUser) return;
    const queue = new SqliteSyncQueueStore(repositoryRuntime.storage);
    const engine = new NativeSyncEngine(queue, new SupabaseTypedSyncTransport(authRuntime.client));
    const bridge = new ConfirmedOutboxSyncBridge(repositoryRuntime.storage, repositoryRuntime.repositories.outbox, engine);
    const tables = allTableDescriptors.map((table) => table.name);
    const sync = () => void bridge.enqueueConfirmed(authenticatedUser.userId).then(() => engine.sync(authenticatedUser.userId, tables)).catch(() => undefined);
    sync();
    const changeUnsubscribe = repositoryRuntime.repositories.changes.subscribe((change) => {
      if (change.userId === authenticatedUser.userId) sync();
    });
    const reconnectUnsubscribe = attachReconnectReplay({ source: expoConnectivity, engine, userId: () => authenticatedUser.userId, tables });
    const appState = AppState.addEventListener("change", (state) => { if (state === "active") sync(); });
    return () => {
      changeUnsubscribe();
      reconnectUnsubscribe();
      appState.remove();
      void engine.signOut(authenticatedUser.userId);
    };
  }, [authRuntime, authenticatedUser?.userId, repositoryRuntime]);

  useEffect(() => {
    if (counts.water === 0) return;
    setTodayItems((items) => items.map((item) => item.id === "water" ? { ...item, state: "satisfied", source: "capture" } : item));
  }, [counts.water]);

  const now = useCallback(() => new Date().toISOString(), []);
  const completeTool = useCallback(async (kind: "focus" | "meditation", minutes: number) => {
    if (!capture) return;
    const occurredAt = now();
    const localDate = localDateInZone(occurredAt, timezone());
    if (kind === "focus") {
      if (!counts.skillId) return;
      await capture.commits.commit({ idempotencyKey: `focus:${randomUUID()}`, kind: "tool", tool: "focus", skillId: counts.skillId, minutes, occurredAt, localDate, timezone: timezone() });
    } else {
      await capture.commits.commit({ idempotencyKey: `meditation:${randomUUID()}`, kind: "tool", tool: "meditation", habit: { mode: "create" }, minutes, occurredAt, localDate, timezone: timezone() });
    }
  }, [capture, counts.skillId, now]);

  if (authRuntime.kind === "supabase" && authSnapshot.status === "loading") return <View style={{ alignItems: "center", backgroundColor: theme.colors.canvas, flex: 1, justifyContent: "center", padding: theme.spacing.shell }}><SarthiText role="coach" tone="secondary">Restoring your private local store…</SarthiText></View>;
  if (authRuntime.kind === "supabase" && (authSnapshot.status === "signed-out" || authMode === "update-password")) return <AuthScreen mode={authMode} controller={authRuntime.controller} resetRedirectTo="sarthi://auth/callback" onAuthenticated={() => setAuthMode("login")} onNavigate={setAuthMode} />;
  if (!capture || !repos) return <View style={{ alignItems: "center", backgroundColor: theme.colors.canvas, flex: 1, justifyContent: "center", padding: theme.spacing.shell }}><SarthiText role="coach" tone="secondary">Opening your local Sarthi…</SarthiText></View>;

  const today = <TodayScreen
    snapshot={{ dateLabel: "Today", arcLabel: "Start with what is true", levelLabel: "Level 1", streakLabel: "0 day streak", coachLine: "Say the messy version. I will keep the uncertainty visible.", items: todayItems, showOnboardingHint: true }}
    onComplete={(item) => setTodayItems((items) => items.map((entry) => entry.id === item.id ? { ...entry, state: "done", source: "tap" } : entry))}
    onSkip={(item) => setTodayItems((items) => items.map((entry) => entry.id === item.id ? { ...entry, state: "skipped" } : entry))}
    onOpenSettings={() => setSettingsOpen(true)}
    onOpenCoach={() => setTab("coach")}
    onOpenStats={() => setTab("stats")}
    renderLens={(domain) => <LensRenderer domain={domain} models={models} />}
  />;
  const surface = settingsOpen ? <SettingsScreen model={{ name: authRuntime.kind === "local" ? "Local dev" : "Sarthi account", dayLabel: "Offline-first on this iPhone", themeName, themeMode, units: "metric", micMode: "hold", spokenReplies: false, morningBrief: "Off", gaps: 0, isDeveloper: authRuntime.kind === "local" }} onTheme={setThemeName} onMode={setThemeMode} onPreference={() => undefined} onSignOut={() => authRuntime.kind === "supabase" ? authRuntime.controller.signOut() : undefined} onExport={() => router.push("/diagnostic")} /> : tab === "today" ? today : tab === "journey" ? <JourneyTimeline events={counts.water || counts.meals || counts.transactions ? [{ id: "capture-proof", kind: "memory", dateLabel: "Today", title: "Local capture evidence", caption: `${counts.water + counts.meals + counts.transactions} typed entries are on this device.`, domain: "Sarthi" }] : []} onStartCapture={() => setCaptureOpen(true)} /> : tab === "coach" ? <CoachReadingRoom today={{ id: "today", scope: "daily", dateLabel: "TODAY", body: "I will react to what you confirmed, not what I guessed.", evidenceLabel: `${counts.water + counts.meals + counts.transactions + counts.sessions} local signals` }} history={[]} onAsk={() => undefined} /> : tab === "stats" ? <StatsWall models={{ current: { overall: { id: "overall", label: "OVERALL", headline: `${counts.water + counts.meals + counts.transactions + counts.sessions}`, detail: "confirmed local signals", levelLabel: "Level 1" }, domains: [{ id: "health", label: "Health", headline: String(counts.water + counts.meals), detail: "logs", levelLabel: "building" }, { id: "money", label: "Money", headline: String(counts.transactions), detail: "entries", levelLabel: "clear" }, { id: "habits", label: "Habits", headline: String(counts.habits), detail: "check-ins", levelLabel: "quiet" }, { id: "skills", label: "Skills", headline: String(counts.sessions), detail: "sessions", levelLabel: "ready" }] }, potential: { overall: { id: "potential", label: "POTENTIAL", headline: "—", detail: "Needs a few days of real evidence", levelLabel: "patient" }, domains: [], potentialUnavailable: true }, "day-one": { overall: { id: "day-one", label: "DAY 1", headline: "1", detail: "a clean starting point", levelLabel: "Level 1" }, domains: [] } }} /> : <ToolsDesk tools={[{ id: "focus", title: "Focus", description: "Measured practice, then a typed commit.", status: "live" }, { id: "meditation", title: "Meditation", description: "Quiet timer with explicit completion.", status: "live" }, { id: "afford-it", title: "Afford it", description: "Connect the core flow first.", status: "soon" }, { id: "workout", title: "Workout counter", description: "Connect the core flow first.", status: "soon" }, { id: "suggest", title: "Suggest a tool", description: "Soon.", status: "soon" }]} onOpen={(tool) => setActiveTool(tool === "focus" || tool === "meditation" ? tool : null)} renderActive={activeTool === "focus" ? counts.skillId ? <FocusTimer store={timerStore} skillId={counts.skillId} presets={[{ label: "25 min", minutes: 25 }, { label: "50 min", minutes: 50 }]} onComplete={({ minutes }) => completeTool("focus", minutes)} onAbandon={() => undefined} /> : <Card><SarthiText role="title">Choose a skill first</SarthiText><SarthiText tone="secondary">Focus files measured time only to an existing Skills track.</SarthiText><SarthiButton label="Back to tools" onPress={() => setActiveTool(null)} /></Card> : activeTool === "meditation" ? <MeditationTimer store={timerStore} patterns={[{ id: "box", label: "Box · 5 min", minutes: 5, phases: ["Inhale slowly."] }, { id: "settle", label: "Settle · 10 min", minutes: 10, phases: ["Let your shoulders soften."] }]} onComplete={({ minutes }) => completeTool("meditation", minutes)} /> : undefined} />;

  return <SafeAreaView style={{ backgroundColor: theme.colors.canvas, flex: 1 }}>
    <View style={{ flex: 1 }}>{surface}</View>
    {!settingsOpen && <View style={{ backgroundColor: theme.colors.raised, borderColor: theme.colors.line, borderTopWidth: theme.border.hairline, flexDirection: "row", gap: theme.spacing.xxs, padding: theme.spacing.xs }}>{tabLabels.map((entry) => <Pressable key={entry.id} accessibilityRole="tab" accessibilityState={{ selected: tab === entry.id }} onPress={() => { setActiveTool(null); setTab(entry.id); }} style={{ alignItems: "center", flex: 1, justifyContent: "center", minHeight: theme.layout.hitTarget }}><SarthiText role="caption" tone={tab === entry.id ? "primary" : "muted"}>{entry.label}</SarthiText></Pressable>)}</View>}
    {settingsOpen ? <View style={{ backgroundColor: theme.colors.raised, padding: theme.spacing.xs }}><SarthiButton label="Back to Today" onPress={() => setSettingsOpen(false)} /></View> : <View style={{ bottom: theme.spacing.md, left: theme.spacing.shell, position: "absolute", right: theme.spacing.shell }}><SarthiButton label="Capture" onPress={() => setCaptureOpen(true)} /></View>}
    <Modal animationType="slide" transparent visible={captureOpen} onRequestClose={() => setCaptureOpen(false)}><View style={{ backgroundColor: theme.colors.scrim, flex: 1, justifyContent: "flex-end" }}><CaptureSheet runtime={capture} onClose={() => setCaptureOpen(false)} /></View></Modal>
  </SafeAreaView>;
}

export default function HomeScreen() {
  return <AppShell />;
}
