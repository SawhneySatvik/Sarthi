/**
 * mcp/server.ts — Sarthi as a ChatGPT app (DEVDAY-0 A5). Standalone Node `http` MCP server.
 *
 * Transport/CORS/resource wiring mirrors the spike proven against ChatGPT: stateless
 * Streamable HTTP (`sessionIdGenerator: undefined`, JSON responses), one McpServer per
 * request, GET /mcp → 405. Tool/resource registration + per-user scopes live in
 * `mcp/register.ts` (shared with the Vercel route `app/mcp/[secret]/route.ts`).
 * Single local user (or MULTI_USER=1), SQLite, keyless.
 *
 * Run: `pnpm mcp:dev` (PORT defaults to 8787).
 */
import { randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createServer, type IncomingMessage } from "node:http";
import { resolve } from "node:path";

import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import type { LlmProviderName } from "@/core/contracts";
import { createSqliteRepositoryFactory } from "@/data/repository";
import { createLlmGateway } from "@/providers/llm";

import { createMcpRuntime, MAX_BODY_BYTES, normalizeOrigin, PLACEHOLDER_PANEL } from "./register";

const PANEL_PATH = process.env.SARTHI_PANEL_PATH ?? resolve(process.cwd(), "mcp", "panel.html");

const log = (line: string) => console.log(`[sarthi-mcp] ${line}`);
const logError = (what: string, error: unknown) => console.error(`[sarthi-mcp] ERROR ${what}`, error);

const factory = createSqliteRepositoryFactory(process.env.DB_URL ?? "file:./sarthi.dev.db");
const llm = createLlmGateway(((process.env.LLM_PROVIDER as LlmProviderName | undefined) ?? "fake") as LlmProviderName);
/* ── Exposure hardening (public tunnel, no auth) ─────────────────────────── */
const HOST = "127.0.0.1"; // never all interfaces; cloudflared connects via localhost
// Capability URL: when MCP_SECRET is set, MCP lives ONLY at /mcp/<secret>; everything else 404s.
const MCP_SECRET = process.env.MCP_SECRET?.trim() || null;

// Card tokens: keyed off MCP_SECRET (stable across restarts) or a per-process random secret.
const requireCardToken = process.env.REQUIRE_CARD_TOKEN !== "0";
if (!requireCardToken) log("WARNING: REQUIRE_CARD_TOKEN=0 — confirm_entry accepts cards without a panel token.");

// MULTI_USER=1: every ChatGPT account (request `_meta["openai/subject"]`) gets its own space.
// Off: today's exact single-user behaviour (local-dev).
const MULTI_USER = process.env.MULTI_USER === "1";
log(MULTI_USER ? "MULTI_USER=1 — one Sarthi space per ChatGPT account" : "single-user mode (local-dev)");

// Panel art origin: only when explicitly configured (the local tunnel serves no /art).
const ASSET_ORIGIN = normalizeOrigin(process.env.SARTHI_PUBLIC_ORIGIN);

const runtime = createMcpRuntime({
  reposFor: (userId) => factory.forUser({ userId, email: null, mode: "local" }),
  llm,
  cardSecret: MCP_SECRET ?? randomBytes(32).toString("hex"),
  requireCardToken,
  multiUser: MULTI_USER,
  log,
  logError,
});

const MCP_PATH = MCP_SECRET ? `/mcp/${MCP_SECRET}` : "/mcp";
const MCP_PATH_BYTES = Buffer.from(MCP_PATH);

function isMcpPath(pathname: string): boolean {
  const candidate = Buffer.from(pathname);
  return candidate.length === MCP_PATH_BYTES.length && timingSafeEqual(candidate, MCP_PATH_BYTES);
}

/** Read the body, counting bytes while streaming; `null` once it exceeds the cap (stops buffering). */
function readBody(req: IncomingMessage): Promise<string | null> {
  return new Promise((resolveBody, rejectBody) => {
    const chunks: Buffer[] = [];
    let size = 0;
    const onData = (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        req.off("data", onData);
        req.off("end", onEnd);
        resolveBody(null);
        return;
      }
      chunks.push(chunk);
    };
    const onEnd = () => resolveBody(Buffer.concat(chunks).toString("utf8"));
    req.on("data", onData);
    req.on("end", onEnd);
    req.on("error", rejectBody);
  });
}

/** Read per resource request so a freshly built panel is served without a restart. */
function panelHtml(): string {
  try {
    return existsSync(PANEL_PATH) ? readFileSync(PANEL_PATH, "utf8") : PLACEHOLDER_PANEL;
  } catch {
    return PLACEHOLDER_PANEL;
  }
}
log(existsSync(PANEL_PATH) ? `panel ${PANEL_PATH}` : `panel missing at ${PANEL_PATH} — serving placeholder`);

const PORT = Number(process.env.PORT ?? 8787);
const CORS = { "Access-Control-Allow-Origin": "*" };

if (!MCP_SECRET) {
  console.warn(
    "[sarthi-mcp] WARNING: MCP_SECRET is not set — MCP is served at the guessable path /mcp with NO auth. " +
      "Set MCP_SECRET before exposing this server through a public tunnel.",
  );
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (!isMcpPath(url.pathname)) {
    if (!MCP_SECRET && req.method === "GET" && url.pathname === "/") {
      res.writeHead(200).end("sarthi mcp");
      return;
    }
    res.writeHead(404).end();
    return;
  }
  if (req.method === "OPTIONS") {
    res
      .writeHead(204, {
        ...CORS,
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "content-type, mcp-session-id",
        "Access-Control-Expose-Headers": "Mcp-Session-Id",
      })
      .end();
    return;
  }
  if (req.method === "GET") {
    // Stateless server: no server-initiated SSE stream. 405 tells clients to use POST.
    log(`GET -> 405 ${(req.headers["user-agent"] ?? "").slice(0, 60)}`);
    res.writeHead(405, { Allow: "POST, OPTIONS", ...CORS }).end();
    return;
  }
  if (req.method !== "POST" && req.method !== "DELETE") {
    res.writeHead(405, { Allow: "POST, OPTIONS", ...CORS }).end();
    return;
  }

  const declared = Number(req.headers["content-length"] ?? 0);
  const raw = declared > MAX_BODY_BYTES ? null : await readBody(req).catch(() => null);
  if (raw === null) {
    log(`${req.method} -> 413 body over ${MAX_BODY_BYTES} bytes`);
    res.writeHead(413, { ...CORS, Connection: "close" }).end("payload too large", () => req.destroy());
    return;
  }
  let body: unknown;
  try {
    body = raw ? JSON.parse(raw) : undefined;
  } catch {
    body = undefined;
  }
  log(`${req.method} ${runtime.describeBody(body)}`);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
  try {
    const server = await runtime.buildMcpServer({ panelHtml, assetOrigin: ASSET_ORIGIN });
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, body);
  } catch (error) {
    logError("request failed", error);
    if (!res.headersSent) res.writeHead(500).end("error");
  }
}).listen(PORT, HOST, () => log(`listening http://localhost:${PORT}${MCP_PATH} (bound to ${HOST} only)`));
