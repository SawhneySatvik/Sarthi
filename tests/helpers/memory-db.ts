/**
 * tests/helpers/memory-db.ts — keyless, network-free SQLite fixture.
 *
 * Builds a fresh, ISOLATED libSQL database and applies the *committed* Drizzle
 * migration SQL directly (the migration smoke path). It never shells out to
 * drizzle-kit: it reads the checked-in `.sql` files and executes each statement,
 * so the test proves the migration that ships is the migration that runs.
 *
 * Storage note: a bare libSQL `:memory:` URL gives every *connection* its own
 * private database, so `db.transaction()` (which acquires a separate connection)
 * cannot see tables created on the base connection — schema and writes vanish on
 * rollback. libSQL also rejects `mode=memory` on the URL, so a named shared-cache
 * memory db is unavailable, and a single global `:memory:?cache=shared` would be
 * shared across every `createMemoryDb()` call (re-running the migration collides).
 * To keep each fixture isolated AND let all connections (base + transaction) share
 * one database, each call opens a unique throwaway file under the OS temp dir and
 * unlinks it on process exit. It is still keyless and never touches the network.
 */
import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import * as schema from "../../data/schema/sqlite";

export interface MemoryDb {
  client: Client;
  db: ReturnType<typeof drizzle<typeof schema>>;
}

// One process-exit handler drains every temp path, so opening many fixtures in
// one file never accumulates listeners (no MaxListenersExceededWarning).
const tempPaths = new Set<string>();
let exitHookInstalled = false;

/** Best-effort unlink of a temp db file and its WAL/SHM sidecars. */
function cleanup(path: string): void {
  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      rmSync(`${path}${suffix}`, { force: true });
    } catch {
      // A process tearing down mid-write is fine to ignore.
    }
  }
}

/** Register a temp db path for a single shared exit-time cleanup. */
function scheduleCleanup(path: string): void {
  tempPaths.add(path);
  if (exitHookInstalled) return;
  exitHookInstalled = true;
  process.once("exit", () => {
    for (const p of tempPaths) cleanup(p);
  });
}

/**
 * Applies every committed migration (`data/migrations/*.sql`, lexically ordered)
 * against a fresh isolated database. Repo-root relative — tests run from root.
 */
export async function createMemoryDb(): Promise<MemoryDb> {
  const path = join(tmpdir(), `sarthi-test-${randomUUID()}.db`);
  const client = createClient({ url: `file:${path}` });
  scheduleCleanup(path);

  const dir = "data/migrations";
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const f of files) {
    const sql = readFileSync(`${dir}/${f}`, "utf8");
    const statements = sql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const stmt of statements) {
      await client.execute(stmt);
    }
  }
  return { client, db: drizzle(client, { schema }) };
}
