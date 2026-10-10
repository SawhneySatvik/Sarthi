/**
 * mcp/register.ts — the transport-agnostic half of the Sarthi MCP app (DEVDAY-0 A2).
 *
 * One runtime (per-user scopes, card key, identity mapping) + `buildMcpServer()` which
 * registers every tool and the panel resource. Shared by BOTH transports:
 *   - `mcp/server.ts`              — node `http`, local tunnel (`pnpm mcp:dev`)
 *   - `app/mcp/[secret]/route.ts`  — Next.js route handler (Vercel)
 *
 * Must stay importable under plain `tsx`: NO `server-only` / `app/lib/*` imports here —
 * the caller injects the repository scope (`reposFor`) and the LLM gateway.
 * New tools register HERE (not in a transport file).
 */
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { createCommitService, type CommitService } from "@/core/capture";
import type { LlmGateway, UserScopedRepositories } from "@/core/contracts";
import { isValidTimeZone } from "@/core/time";

import {
  bounded,
  confirmEntryRouted,
  deriveCardKey,
  ensureProvisioned,
  getToday,
  LOG_ENTRIES_GENERIC_DESCRIPTION,
  logEntries,
  logEntriesDescription,
  MAX_ENTRIES,
  MAX_TEXT_CHARS,
  modelEntrySchema,
  noSubjectResult,
  safely,
  safelyAnonymous,
  sarthiStateShape,
  setupSpace,
  undoLast,
  userKeyForSubject,
  type ToolContext,
  type ToolResult,
} from "./tools";
import { registerTodoTools } from "./todo-tools";

export const LOCAL_USER_ID = "local-dev";
export const PANEL_URI = "ui://sarthi/panel.html";
export const MAX_BODY_BYTES = 64 * 1024;
export const PLACEHOLDER_PANEL = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Sarthi</title></head><body><p>Sarthi panel is loading — panel.html not built yet.</p></body></html>`;
const MULTI_FALLBACK_TZ = "Asia/Kolkata";

export interface McpRuntimeOptions {
  /** A fresh per-user repository scope (the transport owns the factory/DB selection). */
  reposFor: (userId: string) => UserScopedRepositories;
  llm: LlmGateway;
  /** Card-token HMAC secret. Must be stable across instances (MCP_SECRET) on serverless. */
  cardSecret: string;
  requireCardToken: boolean;
  multiUser: boolean;
  log: (line: string) => void;
  logError: (what: string, error: unknown) => void;
}

export interface BuildOptions {
  panelHtml: () => string;
  /** Public origin serving `/art/*.webp` for the panel; null = no images (local tunnel). */
  assetOrigin: string | null;
}

export interface McpRuntime {
  buildMcpServer: (options: BuildOptions) => Promise<McpServer>;
  /** One log token per JSON-RPC message (tools/call adds subject=yes|no + user hash prefix). */
  describeBody: (body: unknown) => string;
}

type RequestMeta = Record<string, unknown> | undefined;
interface Identity {
  subject: string | null;
  timezone: string | null;
}
function identityOf(meta: RequestMeta): Identity {
  const subject = meta?.["openai/subject"];
  const location = meta?.["openai/userLocation"] as { timezone?: unknown } | undefined;
  const timezone = typeof location?.timezone === "string" && isValidTimeZone(location.timezone) ? location.timezone : null;
  return { subject: typeof subject === "string" && subject.trim() ? subject : null, timezone };
}

/** `https://x.vercel.app/foo` → `https://x.vercel.app`; anything non-http(s) or unparsable → null. */
export function normalizeOrigin(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : null;
  } catch {
    return null;
  }
}

/** Inject `window.__SARTHI_ASSET_ORIGIN__` as the first thing in <head> (script-safe JSON). */
export function injectAssetOrigin(html: string, origin: string | null): string {
  if (!origin) return html;
  // `origin` is URL-normalized (no line terminators); escape `<` so it can never close the tag.
  const value = JSON.stringify(origin).replace(/</g, "\\u003c");
  const tag = `<script>window.__SARTHI_ASSET_ORIGIN__=${value};</script>`;
  const head = /<head(\s[^>]*)?>/i.exec(html);
  if (head) {
    const at = head.index + head[0].length;
    return `${html.slice(0, at)}${tag}${html.slice(at)}`;
  }
  return `${tag}${html}`;
}

const INVOKING = (invoking: string, invoked: string) => ({
  "openai/toolInvocation/invoking": invoking,
  "openai/toolInvocation/invoked": invoked,
});

interface JsonRpcMessage {
  method?: string;
  params?: { name?: string; _meta?: Record<string, unknown> };
}

export function createMcpRuntime(options: McpRuntimeOptions): McpRuntime {
  const { reposFor, llm, requireCardToken, log, logError } = options;
  const MULTI_USER = options.multiUser;
  const cardKey = deriveCardKey(options.cardSecret);

  /** One repos + commit service per user (the service's single-flight lock is per user). */
  const scopes = new Map<string, { repos: UserScopedRepositories; service: CommitService }>();
  function scope(userId: string) {
    let entry = scopes.get(userId);
    if (!entry) {
      const repos = reposFor(userId);
      entry = { repos, service: createCommitService({ repos, llm, origin: "chatgpt" }) };
      scopes.set(userId, entry);
    }
    return entry;
  }
  const provisioned = new Set<string>();

  function contextFor(userId: string, ownerKey: string, timezoneOverride: string | null): ToolContext {
    const { repos, service } = scope(userId);
    return {
      repos,
      service,
      userId,
      ownerKey,
      log,
      logError,
      cardKey,
      requireCardToken,
      timezoneOverride: MULTI_USER ? timezoneOverride : null,
      fallbackTimezone: MULTI_USER ? MULTI_FALLBACK_TZ : "UTC",
    };
  }

  let localCtxMemo: ToolContext | null = null;
  const localCtx = () => (localCtxMemo ??= contextFor(LOCAL_USER_ID, LOCAL_USER_ID, null));

  /**
   * The request's tool context: local-dev in single-user mode; the ChatGPT account's own
   * (first-sight provisioned) space in multi-user mode; null when multi-user and no subject —
   * callers must NEVER fall back to local-dev then.
   */
  async function requestContext(meta: RequestMeta, tool: string): Promise<ToolContext | null> {
    if (!MULTI_USER) return localCtx();
    const { subject, timezone } = identityOf(meta);
    if (!subject) {
      log(`no subject on ${tool}`);
      return null;
    }
    const { ownerKey, userId } = userKeyForSubject(subject);
    const ctx = contextFor(userId, ownerKey, timezone);
    if (!provisioned.has(userId)) {
      const created = await ensureProvisioned(ctx.repos, userId, timezone ?? MULTI_FALLBACK_TZ);
      provisioned.add(userId);
      if (created) log(`provisioned new space user=${ownerKey.slice(0, 8)}`);
    }
    return ctx;
  }

  /** Scope for a card's signed owner (multi-user: only ChatGPT-user hashes). */
  async function ownerContext(ownerKey: string): Promise<ToolContext | null> {
    if (!MULTI_USER) return ownerKey === LOCAL_USER_ID ? localCtx() : null;
    if (!/^[0-9a-f]{24}$/.test(ownerKey)) return null;
    const userId = `cg_${ownerKey}`;
    if (!(await scope(userId).repos.profile.profiles.byId(userId))) return null; // never provisioned → not a real owner
    return contextFor(userId, ownerKey, null);
  }

  /** Run a tool for the request's identity; a missing identity (multi-user) gets the honest no-subject state. */
  async function forRequest(
    meta: RequestMeta,
    tool: string,
    run: (ctx: ToolContext) => Promise<ToolResult>,
  ): Promise<ToolResult> {
    let ctx: ToolContext | null;
    try {
      ctx = await requestContext(meta, tool);
    } catch (error) {
      return safelyAnonymous(logError, tool, async () => {
        throw error;
      });
    }
    if (!ctx) return noSubjectResult();
    const resolved = ctx;
    return safely(resolved, tool, () => run(resolved));
  }

  async function buildMcpServer({ panelHtml, assetOrigin }: BuildOptions): Promise<McpServer> {
    const server = new McpServer({ name: "sarthi", version: "0.1.0" });
    const description = MULTI_USER
      ? LOG_ENTRIES_GENERIC_DESCRIPTION
      : await logEntriesDescription(localCtx().repos).catch((error: unknown) => {
          logError("entity names unavailable", error);
          return LOG_ENTRIES_GENERIC_DESCRIPTION;
        });

    // One inline panel per result (no new tab after every call). With a public asset
    // origin, the panel may load `${origin}/art/*.webp` (MCP Apps csp + ChatGPT alias).
    const origin = normalizeOrigin(assetOrigin);
    const panelMeta = {
      ui: origin ? { prefersBorder: true, csp: { resourceDomains: [origin] } } : { prefersBorder: true },
      "openai/ui": { availableDisplayModes: ["inline"] },
      ...(origin ? { "openai/widgetCSP": { resource_domains: [origin] } } : {}),
    };
    registerAppResource(server, "sarthi-panel", PANEL_URI, { _meta: panelMeta }, async () => ({
      contents: [
        { uri: PANEL_URI, mimeType: RESOURCE_MIME_TYPE, text: injectAssetOrigin(panelHtml(), origin), _meta: panelMeta },
      ],
    }));

    registerAppTool(
      server,
      "log_entries",
      {
        title: "Log to Sarthi",
        description,
        inputSchema: {
          text: z
            .string()
            .min(1)
            .max(MAX_TEXT_CHARS)
            .describe("The user's words, VERBATIM — Sarthi checks every number against them."),
          entries: z.array(modelEntrySchema).max(MAX_ENTRIES).describe("One entry per thing the user did."),
        },
        outputSchema: sarthiStateShape,
        annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
        _meta: { ui: { resourceUri: PANEL_URI }, ...INVOKING("Checking your words…", "Sarthi decided") },
      },
      async ({ text, entries }, extra) =>
        forRequest(extra._meta, "log_entries", (ctx) => logEntries(ctx, { text, entries })),
    );

    registerAppTool(
      server,
      "confirm_entry",
      {
        title: "Confirm a Sarthi card",
        description: "Panel-only: files a pending Sarthi card after the user taps Keep. Not callable by the model.",
        inputSchema: {
          proposal: z.record(z.string(), z.unknown()).describe("The card's proposal, echoed back verbatim."),
          value: bounded().nullable().optional().describe("Optional user-edited primary value in display units."),
          cardToken: z.string().max(128).optional().describe("Panel-held token for this card."),
        },
        outputSchema: sarthiStateShape,
        annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
        _meta: { ui: { resourceUri: PANEL_URI, visibility: ["app"] }, ...INVOKING("Saving…", "Saved") },
      },
      async ({ proposal, value, cardToken }, extra) => {
        const input = { proposal, value, cardToken };
        const routed = (requestCtx: ToolContext | null) => () =>
          confirmEntryRouted(requestCtx, ownerContext, input, { cardKey, requireCardToken, log });
        // No identity (e.g. a panel call): act only as the card's SIGNED owner; never as local-dev.
        if (MULTI_USER && !identityOf(extra._meta).subject) {
          return safelyAnonymous(logError, "confirm_entry", routed(null));
        }
        let requestCtx: ToolContext | null;
        try {
          requestCtx = await requestContext(extra._meta, "confirm_entry");
        } catch (error) {
          return safelyAnonymous(logError, "confirm_entry", async () => {
            throw error;
          });
        }
        return requestCtx
          ? safely(requestCtx, "confirm_entry", routed(requestCtx))
          : safelyAnonymous(logError, "confirm_entry", routed(null));
      },
    );

    // Text-only result (no UI resource): undo never opens another panel.
    server.registerTool(
      "undo_last",
      {
        title: "Undo last Sarthi entry",
        description: "Undo the most recent Sarthi batch (within 5 minutes). Use when the user says 'undo that'.",
        inputSchema: {},
        outputSchema: sarthiStateShape,
        annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
        _meta: INVOKING("Undoing…", "Undone"),
      },
      async (_args, extra) => forRequest(extra._meta, "undo_last", (ctx) => undoLast(ctx)),
    );

    // P2: the user builds their own space through ChatGPT. No UI resource.
    const spaceNames = z.array(z.string().trim().min(1).max(60));
    server.registerTool(
      "setup_space",
      {
        title: "Set up the user's Sarthi space",
        description:
          "Create the user's own Sarthi space from what THEY say they want to track — only names the user explicitly asked for; ask before adding anything they didn't name. Adds habits (simple daily), skills, and money categories; idempotent, never deletes.",
        inputSchema: {
          habits: spaceNames.max(8).optional().describe("Habit names the user asked to track, e.g. 'Meditate'."),
          skills: spaceNames.max(8).optional().describe("Skill names the user asked to practise, e.g. 'Guitar'."),
          categories: spaceNames.max(10).optional().describe("Money categories the user asked for, e.g. 'Groceries'."),
        },
        outputSchema: sarthiStateShape,
        annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
        _meta: INVOKING("Setting up your space…", "Space ready"),
      },
      async ({ habits, skills, categories }, extra) =>
        forRequest(extra._meta, "setup_space", (ctx) => setupSpace(ctx, { habits, skills, categories })),
    );

    registerAppTool(
      server,
      "get_today",
      {
        title: "Sarthi today",
        description:
          "Show today's Sarthi summary (Health kcal/water/workout, Money spent, Habits done, Skills minutes, XP) and the user's Sarthi space (`space`: their categories, habits, skills).",
        inputSchema: {},
        outputSchema: sarthiStateShape,
        annotations: { readOnlyHint: true },
        _meta: {
          ui: { resourceUri: PANEL_URI },
          "openai/ui": { entrypoints: [{ type: "global" }] },
          ...INVOKING("Opening today…", "Today"),
        },
      },
      async (_args, extra) => forRequest(extra._meta, "get_today", (ctx) => getToday(ctx)),
    );

    registerTodoTools(server, forRequest);

    return server;
  }

  function describeBody(body: unknown): string {
    const messages = (Array.isArray(body) ? body : [body]) as (JsonRpcMessage | undefined)[];
    return messages
      .map((m) => {
        if (m?.method !== "tools/call" || !m.params?.name) return m?.method ?? "?";
        const { subject } = identityOf(m.params._meta);
        const who = subject ? ` subject=yes user=${userKeyForSubject(subject).ownerKey.slice(0, 8)}` : " subject=no";
        return `tools/call ${m.params.name}${who}`;
      })
      .join(",");
  }

  return { buildMcpServer, describeBody };
}
