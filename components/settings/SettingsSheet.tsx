"use client";

import { ChevronRight, Download, UserRound, X } from "lucide-react";
import { useSyncExternalStore, useState } from "react";

import type { LlmProviderName, VoiceProviderName } from "@/core/contracts";
import type { ProfileGapRecord, ProfileRecord } from "@/data/schema/contract";
import { LLM_MODEL_MATRIX } from "@/providers/llm";
import { DetailFlow } from "@/components/onboarding/detail/DetailFlow";

import {
  getRuntimeProviderOverride,
  setRuntimeProviderOverride,
  subscribeRuntimeProviderOverride,
} from "./runtimeOverride";

type Theme = "ember" | "bone" | "moss";
type Mode = "light" | "dark" | "system";
type PreferenceKey = "mic" | "tts" | "brief";

const THEMES: readonly Theme[] = ["ember", "bone", "moss"];
const LLM_CHOICES: readonly LlmProviderName[] = ["google", "openai", "anthropic", "fake"];
const VOICE_CHOICES: readonly VoiceProviderName[] = ["gemini", "sarvam", "openai", "webspeech", "fake"];

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
        className="ml-auto bg-transparent font-ui text-caption text-ink-2 outline-none"
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
        <select value={selectedProvider} onChange={(event) => setRuntimeProviderOverride(event.target.value as LlmProviderName)} className="ml-auto bg-transparent font-ui text-caption text-ink-2 outline-none" aria-label="AI provider">
          {LLM_CHOICES.map((provider) => <option key={provider} value={provider} disabled={provider === "anthropic"}>{provider === "google" ? "Gemini" : provider === "openai" ? "GPT-5.6" : provider === "anthropic" ? "Claude (unavailable)" : "Fake"}</option>)}
        </select>
      </label>
      <p className="border-b border-line px-4 py-3 font-ui text-caption text-ink-3">
        deep = {modelMap.deep ?? "unverified"} · balanced = {modelMap.balanced ?? "unverified"} · fast = {modelMap.fast ?? "unverified"}
      </p>
      <label className="flex min-h-12 items-center border-b border-line px-4">
        <span className="font-ui text-body text-ink-1">Voice provider</span>
        <select value="fake" className="ml-auto bg-transparent font-ui text-caption text-ink-2 outline-none" aria-label="Voice provider">
          {VOICE_CHOICES.map((provider) => <option key={provider} value={provider} disabled={provider !== "fake"}>{provider === "fake" ? "Fake" : `${provider} (unavailable)`}</option>)}
        </select>
      </label>
      <button type="button" onClick={seed} disabled={seedStatus === "working"} className="flex min-h-12 w-full items-center px-4 text-left font-ui text-body text-ink-1 disabled:text-ink-3">
        Seed demo data <span className="ml-auto font-ui text-caption text-ink-2">{seedStatus === "done" ? "Seeded" : seedStatus === "error" ? "Unavailable" : seedStatus === "working" ? "Seeding" : "Run"}</span>
      </button>
    </Section>
  );
}

export function SettingsSheet({
  profile,
  gaps,
  isDeveloperControlAllowed,
  llmProvider,
}: {
  profile: ProfileRecord;
  gaps: readonly ProfileGapRecord[];
  isDeveloperControlAllowed: boolean;
  llmProvider: LlmProviderName;
}) {
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<"main" | "appearance" | "details" | "gaps" | "danger" | "about">("main");
  const [mic, setMic] = useState(() => readPreference("mic", "hold"));
  const [tts, setTts] = useState(() => readPreference("tts", "off"));
  const [brief, setBrief] = useState(() => readPreference("brief", "all"));
  const openGaps = gaps.filter((gap) => gap.status === "open");

  function close() {
    setOpen(false);
    setPanel("main");
  }
  function changePreference(key: PreferenceKey, value: string, setter: (value: string) => void) {
    setter(value);
    writePreference(key, value);
  }

  const heading = panel === "main" ? "Settings" : panel === "appearance" ? "Appearance" : panel === "details" ? "Your details" : panel === "gaps" ? "Coach questions" : panel === "danger" ? "Danger zone" : "About";
  return (
    <>
      <button type="button" aria-label="Settings and profile" aria-expanded={open} onClick={() => setOpen(true)} className="flex h-8 w-8 items-center justify-center rounded-chip border border-line bg-raised text-ink-2 transition-colors duration-[var(--t-fast)]">
        <UserRound size={17} strokeWidth={1.5} aria-hidden />
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 bg-[var(--scrim)] p-3 md:flex md:items-center md:justify-center" role="presentation">
          <section className="ml-auto flex h-full w-full max-w-[35rem] flex-col overflow-hidden rounded-card bg-canvas shadow-[var(--elev-card)] md:mx-auto md:h-auto md:max-h-[calc(100vh-var(--space-6))]" role="dialog" aria-modal="true" aria-labelledby="settings-sheet-title">
            <header className="flex items-center gap-3 border-b border-line px-4 py-4">
              <div className="min-w-0 flex-1">
                <h2 id="settings-sheet-title" className="font-display text-title text-ink-1">{heading}</h2>
                {panel === "main" ? <p className="mt-1 font-ui text-caption text-ink-3">{profile.displayName ?? "Your profile"} · local mode</p> : null}
              </div>
              <button type="button" onClick={close} className="flex min-h-11 min-w-11 items-center justify-center rounded-chip text-ink-2" aria-label="Close settings"><X size={18} strokeWidth={1.5} /></button>
            </header>
            <div className="overflow-y-auto px-4 pb-8">
              {panel === "appearance" ? <div className="pt-6"><Appearance initialTheme={profile.theme} initialMode={profile.themeMode} /></div> : null}
              {panel === "details" ? <div className="pt-6"><DetailFlow skillName={null} onDone={() => setPanel("main")} /></div> : null}
              {panel === "gaps" ? <div className="pt-6">{openGaps.length === 0 ? <p className="font-coach text-body text-ink-2">Nothing pending — I know what I need for now.</p> : <div className="space-y-2">{openGaps.map((gap) => <button type="button" key={gap.id} onClick={() => setPanel("details")} className="w-full rounded-card border border-line bg-card p-4 text-left"><p className="font-ui text-body text-ink-1">{gap.prompt}</p><p className="mt-2 font-ui text-caption text-ink-2">Answer through your signed details flow.</p></button>)}</div>}</div> : null}
              {panel === "danger" ? <div className="pt-6"><p className="font-coach text-body text-ink-2">Destructive data controls need a signed, scoped operation. This build does not pretend an unavailable reset has happened.</p><div className="mt-5 rounded-card border border-danger bg-card p-4"><p className="font-ui text-body text-ink-1">No destructive action available</p><p className="mt-2 font-ui text-caption text-ink-2">Export your data first; reset and deletion stay unavailable until their typed operations land.</p></div></div> : null}
              {panel === "about" ? <div className="pt-6"><p className="font-coach text-body text-ink-2">Sarthi is a quiet, typed life coach for Health, Money, Habits, and Skills.</p><p className="mt-4 font-ui text-caption text-ink-3">Built with an intentional house style.</p></div> : null}
              {panel === "main" ? <>
                <Section title="APPEARANCE"><Row label="Theme" value={profile.theme[0].toUpperCase() + profile.theme.slice(1)} onClick={() => setPanel("appearance")} /><Row label="Mode" value={profile.themeMode[0].toUpperCase() + profile.themeMode.slice(1)} onClick={() => setPanel("appearance")} /></Section>
                <Section title="PROFILE"><Row label="Your details" onClick={() => setPanel("details")} /><Row label="Coach's open questions" value={openGaps.length ? String(openGaps.length) : "None"} onClick={() => setPanel("gaps")} /><Row label="Units" value={profile.unitSystem === "metric" ? "Metric" : "Imperial"} /></Section>
                <Section title="CAPTURE & VOICE"><Toggle label="Mic" value={mic} onChange={(value) => changePreference("mic", value, setMic)} /><Toggle label="Spoken replies" value={tts} onChange={(value) => changePreference("tts", value, setTts)} /></Section>
                <Section title="COACH"><Row label="Morning brief" value="7:00 AM" /><Row label="Weekly brief" value="Sun evening" /><Toggle label="On-open briefs" value={brief} onChange={(value) => changePreference("brief", value, setBrief)} /></Section>
                <Section title="DATA"><a href="/api/settings/export" className="flex min-h-12 items-center px-4"><span className="font-ui text-body text-ink-1">Export my data</span><Download size={16} strokeWidth={1.5} className="ml-auto text-ink-2" aria-hidden /></a><Row label="Danger zone" onClick={() => setPanel("danger")} /></Section>
                {isDeveloperControlAllowed ? <Developer initialProvider={llmProvider} /> : null}
                <footer className="mt-8 flex items-center justify-between px-1 font-ui text-caption text-ink-3"><button type="button" onClick={() => setPanel("about")}>Sarthi v1.0 · About</button><span>Local mode</span></footer>
              </> : null}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
