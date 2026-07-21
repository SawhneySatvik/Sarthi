import { randomUUID } from "node:crypto";

import type { UserScopedRepositories } from "@contracts";
import { applyNativeMigrations, createExpoRepositoryDatabase } from "@mobile/db";
import { LocalDevAuthProvider } from "@mobile/adapters/local-auth";

import { RepositoryVersionStore } from "@mobile/store";

import { MobileRepositoryFactory } from "./factory";

/**
 * App composition root. Screens/capture code await `ready`, resolve auth, then
 * receive `UserScopedRepositories` through this small bridge — no screen reads
 * a SQLite handle or chooses a user id directly.
 */
export interface MobileRepositoryRuntime {
  readonly ready: Promise<void>;
  readonly auth: LocalDevAuthProvider;
  readonly repositories: MobileRepositoryFactory;
  readonly versions: RepositoryVersionStore;
  forLocalDev(): Promise<UserScopedRepositories>;
}

export function createMobileRepositoryRuntime(databaseName = "sarthi-mobile.db"): MobileRepositoryRuntime {
  const database = createExpoRepositoryDatabase(databaseName);
  const repositories = new MobileRepositoryFactory(database.storage, { createId: randomUUID });
  const auth = new LocalDevAuthProvider();
  const versions = new RepositoryVersionStore();
  repositories.changes.subscribe((change) => versions.receive(change));
  const ready = applyNativeMigrations(database.storage);

  return {
    ready,
    auth,
    repositories,
    versions,
    async forLocalDev(): Promise<UserScopedRepositories> {
      await ready;
      return repositories.forUser(await auth.requireUser());
    },
  };
}
