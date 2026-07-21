import { nativeMigrations } from "../../drizzle/native-migrations";

import type { LocalRepositoryStorage } from "./types";

const ledgerTable = "sarthi_native_migrations";

/**
 * Run before exposing repositories to the app. All statements are bundled from
 * the immutable contract; no migration ever derives SQL from user input.
 */
export async function applyNativeMigrations(storage: LocalRepositoryStorage): Promise<void> {
  await storage.executeMigration(
    `CREATE TABLE IF NOT EXISTS "${ledgerTable}" (
      "version" INTEGER PRIMARY KEY NOT NULL,
      "name" TEXT NOT NULL,
      "appliedAt" TEXT NOT NULL
    )`,
  );

  const applied = new Set(
    (await storage.select(ledgerTable, [])).map((row) => Number(row.version)),
  );
  for (const migration of nativeMigrations) {
    if (applied.has(migration.version)) continue;
    await storage.transaction(async () => {
      for (const statement of migration.statements) {
        await storage.executeMigration(statement);
      }
      await storage.insert(ledgerTable, {
        version: migration.version,
        name: migration.name,
        appliedAt: new Date().toISOString(),
      });
    });
  }
}
