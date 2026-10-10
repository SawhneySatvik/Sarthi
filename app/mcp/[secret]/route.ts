/**
 * app/mcp/[secret]/route.ts — the Sarthi ChatGPT app on Vercel (DEVDAY-0 A2).
 *
 * Same tools/resources as the local tunnel server (`mcp/server.ts`) via the shared
 * `mcp/register.ts`; this file is only the web-standard transport. Capability URL:
 * `/mcp/<MCP_SECRET>` — anything else (or MCP_SECRET unset) is a 404. Stateless,
 * JSON responses, one McpServer per request. Repos come from the SAME memoised factory
 * the web app uses (DATABASE_PROVIDER / DB_URL / DB_AUTH_TOKEN).
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

import { getRuntimeConfig } from "@/app/lib/runtime";
import { reposForUserId } from "@/app/lib/session";
import { createMcpRuntime, MAX_BODY_BYTES, normalizeOrigin, PLACEHOLDER_PANEL, type McpRuntime } from "@/mcp/register";
import { createLlmGateway } from "@/providers/llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const log = (line: string) => console.log(`[sarthi-mcp] ${line}`);
const logError = (what: string, error: unknown) => console.error(`[sarthi-mcp] ERROR ${what}`, error);

const BASE_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Expose-Headers": "Mcp-Session-Id",
  "Cache-Control": "no-store",
} as const;

function mcpSecret(): string | null {
  return process.env.MCP_SECRET?.trim() || null;
}

/** Constant-time compare (hash both sides so a length mismatch never throws or leaks). */
function secretMatches(candidate: string): boolean {
  const secret = mcpSecret();
  if (!secret) return false;
  const a = createHash("sha256").update(candidate).digest();
  const b = createHash("sha256").update(secret).digest();
  return timingSafeEqual(a, b);
}

// Lazy: `next build` evaluates this module — never open the DB at import time.
let runtimeMemo: McpRuntime | null = null;
function mcpRuntime(secret: string): McpRuntime {
  if (!runtimeMemo) {
    const requireCardToken = process.env.REQUIRE_CARD_TOKEN !== "0";
    const multiUser = process.env.MULTI_USER === "1";
    log(multiUser ? "MULTI_USER=1 — one Sarthi space per ChatGPT account" : "single-user mode (local-dev)");
    if (!requireCardToken) log("WARNING: REQUIRE_CARD_TOKEN=0 — confirm_entry accepts cards without a panel token.");
    runtimeMemo = createMcpRuntime({
      reposFor: reposForUserId,
      llm: createLlmGateway(getRuntimeConfig().llmProvider),
      // Stable across serverless instances: a card issued on one may be confirmed on another.
      cardSecret: secret,
      requireCardToken,
      multiUser,
      log,
      logError,
    });
  }
  return runtimeMemo;
}

const PANEL_PATH = path.join(process.cwd(), "mcp", "panel.html");
let panelMemo: string | null = null;
function panelHtml(): string {
  if (panelMemo !== null) return panelMemo;
  try {
    panelMemo = readFileSync(PANEL_PATH, "utf8");
  } catch (error) {
    logError(`panel missing at ${PANEL_PATH}`, error);
    return PLACEHOLDER_PANEL;
  }
  return panelMemo;
}

function assetOrigin(request: Request): string | null {
  return normalizeOrigin(process.env.SARTHI_PUBLIC_ORIGIN) ?? normalizeOrigin(request.url);
}

type RouteContext = { params: Promise<{ secret: string }> };

/** 404 unless the path secret matches; returns the configured secret when it does. */
async function gate(context: RouteContext): Promise<string | null> {
  const { secret } = await context.params;
  return secretMatches(secret) ? mcpSecret() : null;
}

const notFound = () => new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });

/** Read the body with a hard byte cap; `null` once it exceeds MAX_BODY_BYTES. */
async function readCapped(request: Request): Promise<string | null> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) return null;
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function OPTIONS(_request: Request, context: RouteContext): Promise<Response> {
  if (!(await gate(context))) return notFound();
  return new Response(null, {
    status: 204,
    headers: {
      ...BASE_HEADERS,
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "content-type, mcp-session-id",
    },
  });
}

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  if (!(await gate(context))) return notFound();
  // Stateless server: no server-initiated SSE stream. 405 tells clients to use POST.
  log(`GET -> 405 ${(request.headers.get("user-agent") ?? "").slice(0, 60)}`);
  return new Response(null, { status: 405, headers: { ...BASE_HEADERS, Allow: "POST, OPTIONS" } });
}

async function handle(request: Request, context: RouteContext): Promise<Response> {
  const secret = await gate(context);
  if (!secret) return notFound();

  const raw = await readCapped(request).catch(() => null);
  if (raw === null) {
    log(`${request.method} -> 413 body over ${MAX_BODY_BYTES} bytes`);
    return new Response("payload too large", { status: 413, headers: { ...BASE_HEADERS, Connection: "close" } });
  }
  let body: unknown;
  try {
    body = raw ? JSON.parse(raw) : undefined;
  } catch {
    body = undefined;
  }

  try {
    const mcp = mcpRuntime(secret);
    log(`${request.method} ${mcp.describeBody(body)}`);
    const server = await mcp.buildMcpServer({ panelHtml, assetOrigin: assetOrigin(request) });
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    await server.connect(transport);
    try {
      const response = await transport.handleRequest(request, { parsedBody: body });
      const headers = new Headers(response.headers);
      for (const [key, value] of Object.entries(BASE_HEADERS)) headers.set(key, value);
      const text = await response.text();
      return new Response(text || null, { status: response.status, statusText: response.statusText, headers });
    } finally {
      void transport.close();
      void server.close();
    }
  } catch (error) {
    logError("request failed", error);
    return new Response("error", { status: 500, headers: BASE_HEADERS });
  }
}

export const POST = handle;
export const DELETE = handle;
