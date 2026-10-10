import Link from "next/link";
import type { Metadata } from "next";

import { ArtFrame } from "@/components/art/ArtFrame";

export const metadata: Metadata = {
  title: "Sarthi for ChatGPT — how to use it",
  description: "Connect Sarthi to ChatGPT, talk about your day, and confirm anything ChatGPT guessed with one tap.",
};

// Static public page. The sibling `[secret]` route handler never shadows this literal segment.
export const dynamic = "force-static";

const SETUP_STEPS = [
  "Open ChatGPT (Plus works) → Settings → Apps & Connectors.",
  "Enable Developer mode.",
  "Go to Plugins → + → Add custom MCP server.",
  "Paste the plugin URL below.",
  "Authentication: No authentication → tick “I understand” → Create.",
  "Refresh ChatGPT.",
  "In a new chat, attach Sarthi — type @ in the desktop app, or tap + in the composer on web.",
];

const PROMPTS = [
  { say: "Set up my Sarthi: I track meditation and water, I'm learning DSA", see: "Sarthi builds your space with those habits and that skill." },
  { say: "Spent 450 on a team lunch, had a paneer wrap and lassi, 45 min of DSA", see: "₹450 and 45 min file instantly; the meal's estimated nutrition waits as a card." },
  { say: "Tap Keep on the card", see: "Only your tap files the estimate — the panel updates in place." },
  { say: "Add 'submit DevDay project' to my day", see: "A to-do lands on today's list." },
  { say: "Undo that", see: "The last change is reversed (within 5 minutes)." },
  { say: "What does my day look like?", see: "Today's entries, open cards, habits and to-dos in one panel." },
];

const FLOW = [
  { title: "Filed instantly", body: "Numbers you actually said — amounts, minutes, counts — are written straight away." },
  { title: "Waits as a card", body: "Anything ChatGPT estimated is held back. A plain-code check flags it, and the OpenAI Decisions API (GPT-6 Luna) can only demote, never promote." },
  { title: "Only your tap confirms", body: "The confirm tool is app-only — the model can't call it — and every card is signed, so it can't be forged." },
];

const TOOLS = [
  { name: "log_entries", what: "Turns what you said into typed entries across Health, Money, Habits and Skills." },
  { name: "confirm_entry", what: "Files a waiting card after you tap Keep.", note: "panel only" },
  { name: "undo_last", what: "Reverses the most recent batch." },
  { name: "get_today", what: "Shows today's entries, cards, habits and to-dos." },
  { name: "setup_space", what: "Creates your space from the things you track." },
  { name: "add_todo", what: "Adds a to-do to today." },
  { name: "complete_todo", what: "Ticks a to-do off." },
];

const OPENAI = [
  "ChatGPT plugins over MCP, rendered as an inline MCP Apps panel.",
  "App-only tool visibility keeps confirmation out of the model's hands.",
  "Decisions API (gpt-6-luna) predicates and choices — demote-only.",
  "Per-account spaces from ChatGPT's anonymized user id and timezone.",
];

const link = "underline underline-offset-4 rounded-chip focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function connectorUrl(): string | null {
  const secret = process.env.MCP_SECRET;
  if (process.env.MCP_INFO_SHOW_CONNECTOR === "1" && secret) return `https://sarthi-gray.vercel.app/mcp/${secret}`;
  return null;
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="font-display text-title text-ink-1">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function McpInfoPage() {
  const fullUrl = connectorUrl();
  return (
    <main className="min-h-dvh bg-canvas px-5 py-10 text-ink-1 sm:px-8 sm:py-14">
      <article className="mx-auto flex w-full max-w-2xl flex-col gap-10">
        <header>
          <ArtFrame artKey="today.header.day" eager ratio="aspect-[4/3] sm:aspect-[16/9]">
            <div className="flex h-full flex-col justify-end gap-2 p-5 sm:p-7">
              <p className="on-art font-ui text-caption font-medium uppercase tracking-[0.14em]">Sarthi for ChatGPT</p>
              <h1 className="on-art font-display text-display">Sarthi, inside ChatGPT</h1>
              <p className="on-art font-coach text-body leading-relaxed">
                Talk about your day. Sarthi files what you said — and asks before saving anything ChatGPT guessed.
              </p>
            </div>
          </ArtFrame>
        </header>

        <Section id="setup" title="Set up in 60 seconds">
          <ol className="flex flex-col gap-2 font-ui text-body text-ink-2">
            {SETUP_STEPS.map((step, i) => (
              <li key={step} className="flex gap-3">
                <span className="w-5 shrink-0 text-right tabular-nums text-ink-3">{i + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <div className="flex flex-col gap-2 rounded-card border border-line bg-raised p-4">
            <p className="font-ui text-caption font-medium uppercase tracking-[0.14em] text-ink-3">Plugin URL</p>
            {fullUrl ? (
              <code className="select-all break-all font-mono text-body text-ink-1">{fullUrl}</code>
            ) : (
              <>
                <code className="break-all font-mono text-body text-ink-1">https://sarthi-gray.vercel.app/mcp/&lt;plugin-secret&gt;</code>
                <p className="font-ui text-caption text-ink-3">The full plugin URL (with its secret) is in the project submission.</p>
              </>
            )}
          </div>
        </Section>

        <Section id="try" title="Try these">
          <ol className="flex flex-col divide-y divide-line border-y border-line">
            {PROMPTS.map((p, i) => (
              <li key={p.say} className="flex gap-3 py-3">
                <span className="w-5 shrink-0 text-right font-ui text-body tabular-nums text-ink-3">{i + 1}.</span>
                <div className="flex flex-col gap-1">
                  <p className="font-coach text-body text-ink-1">{i === 2 ? p.say : `“${p.say}”`}</p>
                  <p className="font-ui text-caption text-ink-3">{p.see}</p>
                </div>
              </li>
            ))}
          </ol>
        </Section>

        <Section id="flow" title="What happens to what you say">
          <dl className="flex flex-col divide-y divide-line border-y border-line">
            {FLOW.map((f) => (
              <div key={f.title} className="flex flex-col gap-1 py-3 sm:flex-row sm:gap-6">
                <dt className="font-ui text-body font-medium text-ink-1 sm:w-48 sm:shrink-0">{f.title}</dt>
                <dd className="font-ui text-body text-ink-2">{f.body}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section id="tools" title="Tools">
          <ul className="flex flex-col gap-2">
            {TOOLS.map((t) => (
              <li key={t.name} className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
                <code className="font-mono text-body text-ink-1 sm:w-40 sm:shrink-0">{t.name}</code>
                <span className="font-ui text-body text-ink-2">
                  {t.what}
                  {t.note && <span className="text-ink-3"> ({t.note})</span>}
                </span>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="openai" title="Built on OpenAI">
          <ul className="flex list-disc flex-col gap-1.5 pl-5 font-ui text-body text-ink-2 marker:text-ink-3">
            {OPENAI.map((o) => (
              <li key={o}>{o}</li>
            ))}
          </ul>
        </Section>

        <nav aria-label="More about Sarthi" className="flex flex-wrap gap-x-5 gap-y-2 border-t border-line pt-6 font-ui text-body text-ink-2">
          <a href="/api/try-demo" className={link}>
            Open the Sarthi web app
          </a>
          <a href="https://github.com/SawhneySatvik/Sarthi/tree/hack/devday-chatgpt" className={link}>
            GitHub
          </a>
          <a href="https://www.youtube.com/watch?v=DtNvdCOvIY4" className={link}>
            Sarthi product video (Build Week)
          </a>
          <Link href="/privacy" className={link}>
            Privacy
          </Link>
        </nav>
      </article>
    </main>
  );
}
