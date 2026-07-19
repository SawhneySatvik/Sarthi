import "server-only";

import { cache } from "react";

import type { AuthenticatedUser, LlmGateway, MediaProvider, UserScopedRepositories, VisionProvider, VoiceProvider } from "@/core/contracts";
import { createSqliteRepositoryFactory } from "@/data/repository";
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
// is memoised per url at MODULE level — one connection per server instance, reused
// across requests. `forUser` still mints a fresh per-request scope from it.
const factories = new Map<string, ReturnType<typeof createSqliteRepositoryFactory>>();

function factoryFor(url: string): ReturnType<typeof createSqliteRepositoryFactory> {
  let factory = factories.get(url);
  if (!factory) {
    factory = createSqliteRepositoryFactory(url);
    factories.set(url, factory);
  }
  return factory;
}

const getSessionBase = cache(async (): Promise<SessionBase> => {
  const config = getRuntimeConfig();
  if (config.databaseProvider !== "sqlite") {
    // Postgres UI reads are wired in SAR-021; dev/CI runs keyless on SQLite.
    throw new Error(
      `database provider '${config.databaseProvider}' is not wired for UI reads yet (SAR-021 owns Postgres).`,
    );
  }
  const auth = createAuthProvider(config.authProvider);
  const user = await auth.requireUser();
  const repos = factoryFor(config.databaseUrl).forUser(user);
  const vision = createVisionProvider(config.visionProvider);
  const voice = createVoiceProvider(config.voiceProvider);
  const media = createMediaProvider(config.databaseProvider === "sqlite" ? "fake" : "production");
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
