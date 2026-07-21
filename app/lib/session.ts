import "server-only";

import { cache } from "react";

import type { AdminWaitlistRepository, AuthenticatedUser, LlmGateway, MediaProvider, UserScopedRepositories, VisionProvider, VoiceProvider } from "@/core/contracts";
import { createPostgresRepositoryFactory, createSqliteRepositoryFactory } from "@/data/repository";
import { createAuthProvider } from "@/providers/auth";
import { createLlmGateway, createMediaProvider, createVisionProvider, createVoiceProvider } from "@/providers";

import { getRuntimeConfig, type RuntimeConfig } from "./runtime";
import { resolveRequestLlmProvider } from "./runtimeOverride";

/*
 * app/lib/session.ts — SAR-005 (D-E). The missing composition wire between the
 * SAR-003 auth + repository layers and the UI: verify the user, then bind a
 * per-user scope. Server-only; the client never sees a `userId` and can never
 * supply one (SAR-003 scoping holds). Memoised per request via React `cache`.
 */
export interface Session {
  user: AuthenticatedUser;
  repos: UserScopedRepositories;
  /** The runtime LLM gateway (fake on the dev/keyless stack) — for the capture routes. */
  llm: LlmGateway;
  /** The runtime vision provider (fake on the dev/keyless stack) — for the photo parse route (SAR-011). */
  vision: VisionProvider;
  /** The runtime voice provider — only fake is callable in this ticket. */
  voice: VoiceProvider;
  media: MediaProvider;
}

interface SessionBase {
  user: AuthenticatedUser;
  repos: UserScopedRepositories;
  vision: VisionProvider;
  voice: VoiceProvider;
  media: MediaProvider;
  config: RuntimeConfig;
}

// The factory owns a single shared db connection (data/repository/factory.ts), so it
// is memoised at MODULE level, keyed by provider:url — one connection per server
// instance per (dialect, url), reused across requests. `forUser` still mints a fresh
// per-request scope from it. On Postgres this holds the pooled postgres-js client
// (data/db/postgres.ts, max:1) open across a warm serverless instance.
type RepositoryFactoryHandle = ReturnType<typeof createSqliteRepositoryFactory>;
const factories = new Map<string, RepositoryFactoryHandle>();

function factoryFor(config: RuntimeConfig): RepositoryFactoryHandle {
  const key = `${config.databaseProvider}:${config.databaseUrl}`;
  let factory = factories.get(key);
  if (!factory) {
    factory =
      config.databaseProvider === "postgres"
        ? createPostgresRepositoryFactory(config.databaseUrl)
        : createSqliteRepositoryFactory(config.databaseUrl, config.databaseAuthToken);
    factories.set(key, factory);
  }
  return factory;
}

/**
 * Bind a scoped repository set to an EXPLICIT userId, WITHOUT reading the request cookie.
 * Mirrors `getSessionBase`'s `factoryFor(getRuntimeConfig()).forUser(...)` wire, but takes the
 * id from the caller — used by `/api/try-demo` to seed a freshly-minted per-visitor sandbox
 * before that id is written to the cookie. `mode: "local"` matches the anonymous provider's
 * own `AuthenticatedUser` shape (providers/auth/anonymous.ts). Server-only.
 */
export function reposForUserId(userId: string): UserScopedRepositories {
  return factoryFor(getRuntimeConfig()).forUser({ userId, email: null, mode: "local" });
}

/**
 * The UNSCOPED admin waitlist repository (PL-2), sourced from the SAME memoized per-(dialect,url)
 * factory the request session uses. Server-only, and deliberately NOT tenant-bound — the admin
 * gate (`app/lib/admin.ts`) is responsible for authenticating + allowlisting the caller BEFORE
 * invoking this. Never call this from a tenant/user path.
 */
export function adminWaitlistRepository(): AdminWaitlistRepository {
  return factoryFor(getRuntimeConfig()).adminWaitlist();
}

const getSessionBase = cache(async (): Promise<SessionBase> => {
  const config = getRuntimeConfig();
  const auth = createAuthProvider(config.authProvider);
  const user = await auth.requireUser();
  const repos = factoryFor(config).forUser(user);
  const vision = createVisionProvider(config.visionProvider);
  const voice = createVoiceProvider(config.voiceProvider);
  // Media/object storage is not wired for serverless yet: the `fake` provider writes
  // to the local FS (read-only on Vercel) and `production` is an unimplemented throwing
  // stub. The whole stack stays on the keyless `fake` media provider until object
  // storage lands — the voice-capture demo path writes no media, so this does not
  // block the de-risk (fake-stack) Postgres deploy.
  const media = createMediaProvider("fake");
  return { user, repos, vision, voice, media, config };
});

function sessionForProvider(base: SessionBase, llmProvider: RuntimeConfig["llmProvider"]): Session {
  return {
    user: base.user,
    repos: base.repos,
    llm: createLlmGateway(llmProvider),
    vision: base.vision,
    voice: base.voice,
    media: base.media,
  };
}

/** Default request/session composition. Existing zero-argument call sites stay unchanged. */
export const getSession = cache(async (): Promise<Session> => {
  const base = await getSessionBase();
  return sessionForProvider(base, base.config.llmProvider);
});

/**
 * Request-aware composition for the small set of runtime AI routes. The base session
 * authenticates and binds the repository first; only then may a dev/judge header select
 * a matrix-supported LLM gateway. This function intentionally is not React-cached so a
 * provider selected for one request cannot bleed into another request.
 */
export async function getSessionForRuntimeRequest(request: Request): Promise<Session> {
  const base = await getSessionBase();
  const override = resolveRequestLlmProvider(request.headers, base.config);
  return sessionForProvider(base, override ?? base.config.llmProvider);
}
