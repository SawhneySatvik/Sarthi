"use client";

import { ChevronRight, Download, UserRound, X } from "lucide-react";
import { useEffect, useRef, useSyncExternalStore, useState } from "react";
import { createPortal } from "react-dom";

import type { AuthenticatedUser, LlmProviderName, VoiceProviderName } from "@/core/contracts";
import type { TodayIdentity } from "@/core/domains/today";
import type { ProfileGapRecord, ProfileRecord } from "@/data/schema/contract";
import { signOutAction } from "@/app/(auth)/actions";
import { LLM_MODEL_MATRIX } from "@/providers/llm";
import { DetailFlow } from "@/components/onboarding/detail/DetailFlow";
import { NotificationToggle } from "@/components/pwa/NotificationToggle";
import { mirrorDurableState } from "@/app/lib/offline/durable-state";

import {
  getRuntimeProviderOverride,
  setRuntimeProviderOverride,
  subscribeRuntimeProviderOverride,
} from "./runtimeOverride";
import {
  clearByokCredential,
  getByokCredential,
  getByokServerSnapshot,
  setByokCredential,
  subscribeByok,
  type ByokProvider,
} from "./byok";

type Theme = "ember" | "bone" | "moss";
type Mode = "light" | "dark" | "system";
type PreferenceKey = "mic" | "tts" | "brief" | "morningBriefTime" | "weeklyBriefDay" | "weeklyBriefTime";

const THEMES: readonly Theme[] = ["ember", "bone", "moss"];
const LLM_CHOICES: readonly LlmProviderName[] = ["google", "openai", "anthropic", "fake"];
const VOICE_CHOICES: readonly VoiceProviderName[] = ["gemini", "sarvam", "openai", "webspeech", "fake"];

/** A curated set of common IANA zones, grouped by region for a scannable native <select>. The
 *  user's stored zone is always shown even when it is outside this list (see TimezoneControl). */
const TIMEZONE_GROUPS: readonly { region: string; zones: readonly string[] }[] = [
  { region: "India", zones: ["Asia/Kolkata"] },
  { region: "Asia", zones: ["Asia/Dubai", "Asia/Karachi", "Asia/Dhaka", "Asia/Bangkok", "Asia/Singapore", "Asia/Shanghai", "Asia/Tokyo"] },
  { region: "Europe", zones: ["Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Moscow"] },
  { region: "Americas", zones: ["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Sao_Paulo"] },
  { region: "Pacific", zones: ["Australia/Sydney", "Pacific/Auckland"] },
  { region: "Universal", zones: ["UTC"] },
];

const WEEKDAYS: readonly { value: string; label: string }[] = [
  { value: "sun", label: "Sunday" },
  { value: "mon", label: "Monday" },
  { value: "tue", label: "Tuesday" },
  { value: "wed", label: "Wednesday" },
  { value: "thu", label: "Thursday" },
  { value: "fri", label: "Friday" },
  { value: "sat", label: "Saturday" },
];

/** "Asia/Kolkata" → "Kolkata" — the region prefix is already the optgroup label. */
function zoneCity(zone: string): string {
  const city = zone.includes("/") ? zone.slice(zone.lastIndexOf("/") + 1) : zone;
  return city.replace(/_/g, " ");
}

function resolveMode(mode: Mode): "light" | "dark" {
  if (mode !== "system") return mode;
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function applyTheme(theme: Theme, mode: Mode): void {
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.setAttribute("data-mode", resolveMode(mode));
  try {
    localStorage.setItem("sarthi-theme", JSON.stringify({ theme, mode }));
  } catch {}
  // Additive durable mirror (T10, flag-gated). localStorage + the pre-paint script stay
  // the source of truth; this only lets the choice survive a storage-cleared restart.
  void mirrorDurableState("sarthi-theme", { theme, mode });
}

function readPreference(key: PreferenceKey, fallback: string): string {
  try {
    return localStorage.getItem(`sarthi-settings-${key}`) ?? fallback;
  } catch {
    return fallback;
  }
}

function writePreference(key: PreferenceKey, value: string): void {
  try {
    localStorage.setItem(`sarthi-settings-${key}`, value);
  } catch {
    // Local-only settings degrade to the current browser session.
  }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h3 className="px-1 font-ui text-caption uppercase text-ink-3">{title}</h3>
      <div className="mt-2 overflow-hidden rounded-card border border-line bg-card">{children}</div>
    </section>
  );
}

function Row({
  label,
  value,
  onClick,
  children,
}: {
  label: string;
  value?: string;
  onClick?: () => void;
  children?: React.ReactNode;
}) {
  const content = (
    <>
      <span className="font-ui text-body text-ink-1">{label}</span>
      <span className="ml-auto flex items-center gap-2 font-ui text-caption text-ink-2">
        {children ?? value}
        {onClick ? <ChevronRight size={16} strokeWidth={1.5} aria-hidden /> : null}
      </span>
    </>
  );
  const className = "flex min-h-12 w-full items-center border-b border-line px-4 text-left last:border-b-0";
  return onClick ? (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  ) : (
    <div className={className}>{content}</div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex min-h-12 cursor-pointer items-center border-b border-line px-4 last:border-b-0">
      <span className="font-ui text-body text-ink-1">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="ml-auto bg-transparent font-ui text-caption text-ink-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={label}
      >
        {label === "Mic" ? <><option value="hold">Hold to talk</option><option value="tap">Tap to talk</option></> : null}
        {label === "Spoken replies" ? <><option value="off">Off</option><option value="on">On</option></> : null}
        {label === "On-open briefs" ? <><option value="all">Morning + weekly</option><option value="weekly">Weekly only</option><option value="off">Off</option></> : null}
      </select>
    </label>
  );
}

function ThemePreview({ theme, mode, selected, onSelect }: { theme: Theme; mode: Mode; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      data-theme={theme}
      data-mode={resolveMode(mode)}
      aria-pressed={selected}
      aria-label={`${theme} — ${resolveMode(mode)}`}
      onClick={onSelect}
      className={`rounded-card border bg-canvas p-3 text-left transition-colors duration-[var(--t-base)] ${selected ? "border-ring ring-1 ring-ring" : "border-line"}`}
    >
      <span className="block rounded-input bg-card p-2">
        <span className="block h-2 w-2/3 rounded-full bg-ink-1" />
        <span className="mt-2 block h-1.5 w-1/2 rounded-full bg-ink-3" />
        <span className="mt-3 grid grid-cols-3 gap-1">
          <span className="h-4 rounded-input bg-health" />
          <span className="h-4 rounded-input bg-habits" />
          <span className="h-4 rounded-input bg-skills" />
        </span>
      </span>
      <span className="mt-2 block font-ui text-caption capitalize text-ink-2">{theme}</span>
    </button>
  );
}

function Appearance({ initialTheme, initialMode }: { initialTheme: Theme; initialMode: Mode }) {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [mode, setMode] = useState<Mode>(initialMode);
  const select = (nextTheme: Theme, nextMode: Mode) => {
    setTheme(nextTheme);
    setMode(nextMode);
    applyTheme(nextTheme, nextMode);
    void fetch("/api/onboarding/detail", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ section: "theme", theme: nextTheme, themeMode: nextMode }),
    });
  };
  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {THEMES.map((candidate) => <ThemePreview key={candidate} theme={candidate} mode={mode} selected={candidate === theme} onSelect={() => select(candidate, mode)} />)}
      </div>
      <div className="mt-5 flex gap-2" role="group" aria-label="Display mode">
        {(["light", "dark", "system"] as const).map((candidate) => (
          <button key={candidate} type="button" onClick={() => select(theme, candidate)} aria-pressed={mode === candidate} className={`min-h-11 flex-1 rounded-chip border px-3 font-ui text-caption ${mode === candidate ? "border-ink-1 bg-raised text-ink-1" : "border-line text-ink-2"}`}>
            {candidate}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * The real day-boundary control (T2). Shows the profile's stored IANA zone and persists a
 * change through the SAME `/api/onboarding/detail` path the theme picker already uses — no new
 * endpoint, no dialect change (the `profiles.timezone` column pre-dates this). This is
 * load-bearing: every "what local day is it" read (Today, daily brief, plan rollover) keys off
 * it, so the value here is authoritative rather than cosmetic.
 */
function TimezoneControl({ initial }: { initial: string }) {
  const [tz, setTz] = useState(initial);
  const [saving, setSaving] = useState(false);
  const known = TIMEZONE_GROUPS.some((group) => group.zones.includes(tz));

  async function change(next: string) {
    setTz(next);
    setSaving(true);
    try {
      await fetch("/api/onboarding/detail", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ section: "timezone", timezone: next }),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <label className="flex min-h-12 items-center border-b border-line px-4">
        <span className="font-ui text-body text-ink-1">Time zone</span>
        <select
          value={tz}
          onChange={(event) => void change(event.target.value)}
          className="ml-auto max-w-[60%] bg-transparent font-ui text-caption text-ink-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Time zone"
        >
          {!known ? <option value={tz}>{zoneCity(tz)}</option> : null}
          {TIMEZONE_GROUPS.map((group) => (
            <optgroup key={group.region} label={group.region}>
              {group.zones.map((zone) => <option key={zone} value={zone}>{zoneCity(zone)}</option>)}
            </optgroup>
          ))}
        </select>
      </label>
      <p className="px-4 py-3 font-ui text-caption text-ink-3" role="status" aria-live="polite">
        {saving ? "Saving…" : "Sets when your day rolls over — Today, streaks, and briefs follow this zone."}
      </p>
    </>
  );
}

/**
 * Honest coach-brief scheduling (T2). The morning + weekly times were static strings implying
 * a scheduler that doesn't exist yet; these are now real, editable preferences persisted to the
 * same `localStorage` seam as the other capture/coach prefs. A later PWA ticket reads them to
 * fire local notifications — the caption says exactly that, so nothing here overpromises.
 */
function CoachBrief() {
  const [morning, setMorning] = useState(() => readPreference("morningBriefTime", "07:00"));
  const [weeklyDay, setWeeklyDay] = useState(() => readPreference("weeklyBriefDay", "sun"));
  const [weeklyTime, setWeeklyTime] = useState(() => readPreference("weeklyBriefTime", "18:00"));

  const timeInputClass =
    "min-h-11 rounded-input border border-line bg-canvas px-2 font-ui text-caption tabular-nums text-ink-1 outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <>
      <label className="flex min-h-12 items-center border-b border-line px-4">
        <span className="font-ui text-body text-ink-1">Morning brief</span>
        <input
          type="time"
          value={morning}
          onChange={(event) => { setMorning(event.target.value); writePreference("morningBriefTime", event.target.value); }}
          className={`ml-auto ${timeInputClass}`}
          aria-label="Morning brief time"
        />
      </label>
      <div className="flex min-h-12 items-center gap-2 border-b border-line px-4">
        <span className="font-ui text-body text-ink-1">Weekly brief</span>
        <select
          value={weeklyDay}
          onChange={(event) => { setWeeklyDay(event.target.value); writePreference("weeklyBriefDay", event.target.value); }}
          className="ml-auto min-h-11 rounded-input border border-line bg-canvas px-2 font-ui text-caption text-ink-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Weekly brief day"
        >
          {WEEKDAYS.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}
        </select>
        <input
          type="time"
          value={weeklyTime}
          onChange={(event) => { setWeeklyTime(event.target.value); writePreference("weeklyBriefTime", event.target.value); }}
          className={timeInputClass}
          aria-label="Weekly brief time"
        />
      </div>
    </>
  );
}

function Developer({ initialProvider }: { initialProvider: LlmProviderName }) {
  const override = useSyncExternalStore(subscribeRuntimeProviderOverride, getRuntimeProviderOverride, () => null);
  const selectedProvider = override ?? initialProvider;
  const modelMap = LLM_MODEL_MATRIX[selectedProvider];
  const [seedStatus, setSeedStatus] = useState<"idle" | "working" | "done" | "error">("idle");

  async function seed() {
    setSeedStatus("working");
    try {
      const response = await fetch("/api/dev/seed-demo", { method: "POST" });
      setSeedStatus(response.ok ? "done" : "error");
    } catch {
      setSeedStatus("error");
    }
  }

  return (
    <Section title="DEVELOPER">
      <label className="flex min-h-12 items-center border-b border-line px-4">
        <span className="font-ui text-body text-ink-1">AI provider</span>
        <select value={selectedProvider} onChange={(event) => setRuntimeProviderOverride(event.target.value as LlmProviderName)} className="ml-auto bg-transparent font-ui text-caption text-ink-2 outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="AI provider">
          {LLM_CHOICES.map((provider) => <option key={provider} value={provider} disabled={provider === "anthropic"}>{provider === "google" ? "Gemini" : provider === "openai" ? "GPT-5.6" : provider === "anthropic" ? "Claude (unavailable)" : "Fake"}</option>)}
        </select>
      </label>
      <p className="border-b border-line px-4 py-3 font-ui text-caption text-ink-3">
        deep = {modelMap.deep ?? "unverified"} · balanced = {modelMap.balanced ?? "unverified"} · fast = {modelMap.fast ?? "unverified"}
      </p>
      <label className="flex min-h-12 items-center border-b border-line px-4">
        <span className="font-ui text-body text-ink-1">Voice provider</span>
        <select value="fake" className="ml-auto bg-transparent font-ui text-caption text-ink-2 outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Voice provider">
          {VOICE_CHOICES.map((provider) => <option key={provider} value={provider} disabled={provider !== "fake"}>{provider === "fake" ? "Fake" : `${provider} (unavailable)`}</option>)}
        </select>
      </label>
      <button type="button" onClick={seed} disabled={seedStatus === "working"} className="flex min-h-12 w-full items-center px-4 text-left font-ui text-body text-ink-1 disabled:text-ink-3">
        Seed demo data <span className="ml-auto font-ui text-caption text-ink-2">{seedStatus === "done" ? "Seeded" : seedStatus === "error" ? "Unavailable" : seedStatus === "working" ? "Seeding" : "Run"}</span>
      </button>
    </Section>
  );
}

/**
 * Bring Your Own Key — visible to EVERY user (not the gated Developer block), because its
 * whole purpose is letting strangers on the live production deploy run real AI with their
 * own key. The key is written only to this browser's localStorage and attached per-request;
 * it is never sent to Sarthi's servers except transiently to power the user's own calls.
 */
function ByokPanel() {
  const saved = useSyncExternalStore(subscribeByok, getByokCredential, getByokServerSnapshot);
  const [provider, setProvider] = useState<ByokProvider>("google");
  const [draft, setDraft] = useState("");

  const savedLabel = saved ? (saved.provider === "google" ? "Gemini" : "OpenAI") : null;

  function save() {
    const apiKey = draft.trim();
    if (!apiKey) return;
    setByokCredential({ provider, apiKey });
    setDraft("");
  }

  return (
    <Section title="YOUR AI KEY">
      <p className="border-b border-line px-4 py-3 font-coach text-caption leading-[var(--leading-coach)] text-ink-2">
        Bring your own Gemini or OpenAI key to capture with real AI. It stays in this browser only —
        never saved to our servers, only sent to power your own requests. Without a key you can still
        explore the full seeded demo.
      </p>
      <label className="flex min-h-12 items-center border-b border-line px-4">
        <span className="font-ui text-body text-ink-1">Provider</span>
        <select
          value={provider}
          onChange={(event) => setProvider(event.target.value as ByokProvider)}
          className="ml-auto bg-transparent font-ui text-caption text-ink-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="AI key provider"
        >
          <option value="google">Gemini</option>
          <option value="openai">OpenAI</option>
        </select>
      </label>
      <div className="border-b border-line px-4 py-3">
        <label htmlFor="byok-key" className="font-ui text-caption text-ink-2">
          {provider === "google" ? "Gemini API key" : "OpenAI API key"}
        </label>
        <input
          id="byok-key"
          type="password"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={saved ? "Enter a new key to replace the saved one" : "Paste your key"}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          className="mt-2 min-h-11 w-full rounded-input border border-line bg-canvas px-3 font-ui text-body text-ink-1 placeholder:text-ink-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={save}
            disabled={!draft.trim()}
            className="min-h-11 flex-1 rounded-chip bg-ink-1 px-3 font-ui text-body text-canvas disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring"
          >
            Save key
          </button>
          <button
            type="button"
            onClick={() => { clearByokCredential(); setDraft(""); }}
            disabled={!saved}
            className="min-h-11 rounded-chip border border-line px-4 font-ui text-body text-ink-2 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring"
          >
            Clear
          </button>
        </div>
      </div>
      <p className="px-4 py-3 font-ui text-caption text-ink-3" role="status" aria-live="polite">
        {saved ? `Key saved · captures use real AI via ${savedLabel}.` : "No key saved · exploring the seeded demo."}
      </p>
    </Section>
  );
}

export function SettingsSheet({
  profile,
  gaps,
  identity,
  isDeveloperControlAllowed,
  llmProvider,
  accountMode,
  accountEmail,
}: {
  profile: ProfileRecord;
  gaps: readonly ProfileGapRecord[];
  /** Real progress for the identity header — same source as `view.stat` / the Stats wall. */
  identity: TodayIdentity;
  isDeveloperControlAllowed: boolean;
  llmProvider: LlmProviderName;
  /** The resolved auth mode (SAR-021). Only `"supabase"` surfaces the account/sign-out section;
   *  anonymous/local keep the "Local mode" footer. Optional so pre-SAR-021 callers stay valid. */
  accountMode?: AuthenticatedUser["mode"];
  accountEmail?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<"main" | "appearance" | "details" | "gaps" | "danger" | "about">("main");
  const [mic, setMic] = useState(() => readPreference("mic", "hold"));
  const [tts, setTts] = useState(() => readPreference("tts", "off"));
  const [brief, setBrief] = useState(() => readPreference("brief", "all"));
  const openGaps = gaps.filter((gap) => gap.status === "open");
  const closeRef = useRef<HTMLButtonElement>(null);

  function close() {
    setOpen(false);
    setPanel("main");
  }

  // GalleryViewer precedent: initial focus on Close + Escape-to-close while the dialog is open.
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setPanel("main");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  function changePreference(key: PreferenceKey, value: string, setter: (value: string) => void) {
    setter(value);
    writePreference(key, value);
  }

  const heading = panel === "main" ? "Settings" : panel === "appearance" ? "Appearance" : panel === "details" ? "Your details" : panel === "gaps" ? "Coach questions" : panel === "danger" ? "Danger zone" : "About";

  // Identity header — only what is derivable (no fabricated numbers). Join date is the profile's
  // real `createdAt`; Day/Level mirror `view.stat` / the Stats wall via the shared `buildIdentity`.
  const joinedLabel = new Intl.DateTimeFormat("en-IN", { month: "short", day: "numeric" }).format(new Date(profile.createdAt));
  const identityBits = [
    ...(identity.dayOfArc !== null ? [`Day ${identity.dayOfArc}`] : []),
    `L${identity.level}`,
    `joined ${joinedLabel}`,
  ];
  const identitySummary = `${profile.displayName ?? "Your profile"} · ${identityBits.join(" · ")}`;
  return (
    <>
      <button type="button" aria-label="Settings and profile" aria-expanded={open} onClick={() => setOpen(true)} className="flex h-11 w-11 items-center justify-center rounded-chip border border-line bg-raised text-ink-2 transition-colors duration-[var(--t-fast)]">
        <UserRound size={17} strokeWidth={1.5} aria-hidden />
      </button>
      {open && typeof document !== "undefined" ? createPortal((
        <div className="fixed inset-0 z-50 bg-[var(--scrim)] p-3 md:flex md:items-center md:justify-center" role="presentation">
          <section className="ml-auto flex h-full w-full max-w-[35rem] flex-col overflow-hidden rounded-card border border-line bg-raised shadow-[var(--elev-card)] md:mx-auto md:h-auto md:max-h-[calc(100vh-var(--space-6))]" role="dialog" aria-modal="true" aria-labelledby="settings-sheet-title">
            <header className="flex items-center gap-3 border-b border-line px-4 py-4">
              <div className="min-w-0 flex-1">
                <h2 id="settings-sheet-title" className="font-display text-title text-ink-1">{heading}</h2>
                {panel === "main" ? <p className="mt-1 font-ui text-caption tabular-nums text-ink-3">{identitySummary}</p> : null}
              </div>
              <button ref={closeRef} type="button" onClick={close} className="flex min-h-11 min-w-11 items-center justify-center rounded-chip text-ink-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Close settings"><X size={18} strokeWidth={1.5} /></button>
            </header>
            <div className="overflow-y-auto px-4 pb-8">
              {panel === "appearance" ? <div className="pt-6"><Appearance initialTheme={profile.theme} initialMode={profile.themeMode} /></div> : null}
              {panel === "details" ? <div className="pt-6"><DetailFlow skillName={null} onDone={() => setPanel("main")} /></div> : null}
              {panel === "gaps" ? <div className="pt-6">{openGaps.length === 0 ? <p className="font-coach text-body text-ink-2">Nothing pending — I know what I need for now.</p> : <div className="space-y-2">{openGaps.map((gap) => <button type="button" key={gap.id} onClick={() => setPanel("details")} className="w-full rounded-card border border-line bg-card p-4 text-left"><p className="font-ui text-body text-ink-1">{gap.prompt}</p><p className="mt-2 font-ui text-caption text-ink-2">Answer through your signed details flow.</p></button>)}</div>}</div> : null}
              {panel === "danger" ? <div className="pt-6"><p className="font-coach text-body text-ink-2">Destructive data controls need a signed, scoped operation. This build does not pretend an unavailable reset has happened.</p><div className="mt-5 rounded-card border border-danger bg-card p-4"><p className="font-ui text-body text-ink-1">No destructive action available</p><p className="mt-2 font-ui text-caption text-ink-2">Export your data first; reset and deletion stay unavailable until their typed operations land.</p></div></div> : null}
              {panel === "about" ? <div className="pt-6"><p className="font-coach text-body text-ink-2">Sarthi is a quiet, typed life coach for Health, Money, Habits, and Skills.</p><p className="mt-4 font-ui text-caption text-ink-3">Built with an intentional house style.</p><div className="mt-6 overflow-hidden rounded-card border border-line bg-card"><a href="/privacy" className="flex min-h-12 items-center border-b border-line px-4 focus-visible:ring-2 focus-visible:ring-ring"><span className="font-ui text-body text-ink-1">Privacy</span><ChevronRight size={16} strokeWidth={1.5} className="ml-auto text-ink-2" aria-hidden /></a><a href="/terms" className="flex min-h-12 items-center px-4 focus-visible:ring-2 focus-visible:ring-ring"><span className="font-ui text-body text-ink-1">Terms</span><ChevronRight size={16} strokeWidth={1.5} className="ml-auto text-ink-2" aria-hidden /></a></div></div> : null}
              {panel === "main" ? <>
                <Section title="APPEARANCE"><Row label="Theme" value={profile.theme[0].toUpperCase() + profile.theme.slice(1)} onClick={() => setPanel("appearance")} /><Row label="Mode" value={profile.themeMode[0].toUpperCase() + profile.themeMode.slice(1)} onClick={() => setPanel("appearance")} /></Section>
                <Section title="PROFILE">
                  <Row label="Your details" onClick={() => setPanel("details")} />
                  <Row label="Coach's open questions" value={openGaps.length ? String(openGaps.length) : "None"} onClick={() => setPanel("gaps")} />
                  <TimezoneControl initial={profile.timezone} />
                  <Row label="Units" value={profile.unitSystem === "metric" ? "Metric · kg, km, ₹" : "Imperial · lb, mi, ₹"} />
                  <p className="px-4 py-3 font-ui text-caption text-ink-3">Stored in metric integer units (paise, ml, minutes, grams).</p>
                </Section>
                <Section title="CAPTURE & VOICE"><Toggle label="Mic" value={mic} onChange={(value) => changePreference("mic", value, setMic)} /><Toggle label="Spoken replies" value={tts} onChange={(value) => changePreference("tts", value, setTts)} /></Section>
                <Section title="COACH">
                  <CoachBrief />
                  <Toggle label="On-open briefs" value={brief} onChange={(value) => changePreference("brief", value, setBrief)} />
                  <NotificationToggle />
                  <p className="px-4 py-3 font-ui text-caption text-ink-3">These times will drive local reminders once notifications are turned on.</p>
                </Section>
                <Section title="DATA"><a href="/api/settings/export" className="flex min-h-12 items-center px-4"><span className="font-ui text-body text-ink-1">Export my data</span><Download size={16} strokeWidth={1.5} className="ml-auto text-ink-2" aria-hidden /></a><Row label="Danger zone" onClick={() => setPanel("danger")} /></Section>
                <ByokPanel />
                {isDeveloperControlAllowed ? <Developer initialProvider={llmProvider} /> : null}
                {accountMode === "supabase" ? (
                  <Section title="ACCOUNT">
                    <div className="flex min-h-12 items-center border-b border-line px-4">
                      <span className="font-ui text-body text-ink-1">Email</span>
                      <span className="ml-auto truncate pl-3 font-ui text-caption text-ink-2">{accountEmail ?? "—"}</span>
                    </div>
                    {/* Server Action sign-out — same next/headers cookie-flush path as login, so
                        the session cookies are reliably cleared, then it redirects to /login
                        (SCREEN-AUTH §3 — no local or server data is deleted). */}
                    <form action={signOutAction}>
                      <button type="submit" className="flex min-h-12 w-full items-center px-4 text-left font-ui text-body text-ink-1 focus-visible:ring-2 focus-visible:ring-ring">
                        Sign out
                      </button>
                    </form>
                  </Section>
                ) : null}
                <footer className="mt-8 flex items-center justify-between px-1 font-ui text-caption text-ink-3"><button type="button" onClick={() => setPanel("about")}>Sarthi v1.0 · About</button><span>{accountMode === "supabase" ? "Signed in" : "Local mode"}</span></footer>
              </> : null}
            </div>
          </section>
        </div>
      ), document.body) : null}
    </>
  );
}
