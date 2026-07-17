import "server-only";

import { cache } from "react";

import type { AuthenticatedUser, UserScopedRepositories } from "@/core/contracts";
import { createSqliteRepositoryFactory } from "@/data/repository";
import { createAuthProvider } from "@/providers/auth";

import { getRuntimeConfig } from "./runtime";

/*
 * app/lib/session.ts — SAR-005 (D-E). The missing composition wire between the
 * SAR-003 auth + repository layers and the UI: verify the user, then bind a
 * per-user scope. Server-only; the client never sees a `userId` and can never
 * supply one (SAR-003 scoping holds). Memoised per request via React `cache`.
 */
export interface Session {
  user: AuthenticatedUser;
  repos: UserScopedRepositories;
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

export const getSession = cache(async (): Promise<Session> => {
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
  return { user, repos };
});
