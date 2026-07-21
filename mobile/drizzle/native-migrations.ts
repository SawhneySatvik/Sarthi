/**
 * Native migrations are generated from the immutable shared schema contract,
 * not a second hand-maintained copy of the 35 user tables. The migration ledger
 * makes the plan stable for an installed app: later contract changes require a
 * new numbered migration rather than silently changing a live database.
 */
import {
  allTableDescriptors,
  type ColumnDescriptor,
  type TableDescriptor,
} from "@schema/contract";

export interface NativeMigration {
  version: number;
  name: string;
  statements: readonly string[];
}

function quote(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function sqliteType(column: ColumnDescriptor): string {
  switch (column.type) {
    case "integer":
    case "boolean":
      return "INTEGER";
    case "uuid":
    case "text":
    case "timestamp":
    case "date":
    case "json":
      return "TEXT";
  }
}

function tableStatement(table: TableDescriptor): string {
  const definitions = table.columns.map(
    (column) => `${quote(column.name)} ${sqliteType(column)}${column.notNull ? " NOT NULL" : ""}`,
  );
  definitions.push(`PRIMARY KEY (${table.primaryKey.map(quote).join(", ")})`);
  for (const unique of table.unique) {
    definitions.push(`UNIQUE (${unique.map(quote).join(", ")})`);
  }
  return `CREATE TABLE IF NOT EXISTS ${quote(table.name)} (${definitions.join(", ")})`;
}

function identifierFor(table: TableDescriptor, suffix: string, columns: readonly string[]): string {
  return `${table.name}_${columns.join("_")}_${suffix}`.replaceAll(/[^A-Za-z0-9_]/g, "_");
}

function indexStatements(table: TableDescriptor): readonly string[] {
  return table.indexes.map((columns) => {
    const name = identifierFor(table, "idx", columns);
    return `CREATE INDEX IF NOT EXISTS ${quote(name)} ON ${quote(table.name)} (${columns
      .map(quote)
      .join(", ")})`;
  });
}

const sharedContractV1: NativeMigration = {
  version: 1,
  name: "0001_shared_schema_contract",
  statements: [
    ...allTableDescriptors.map(tableStatement),
    ...allTableDescriptors.flatMap(indexStatements),
  ],
};

/** Local-only state. It is never exposed through core repository ports. */
const nativeRepositoryV1: NativeMigration = {
  version: 2,
  name: "0002_native_repository_state",
  statements: [
    `CREATE TABLE IF NOT EXISTS "sarthi_native_meta" (
      "key" TEXT PRIMARY KEY NOT NULL,
      "value" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS "sarthi_native_outbox" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "userId" TEXT NOT NULL,
      "commitId" TEXT NOT NULL,
      "payloadJson" TEXT NOT NULL,
      "createdAt" TEXT NOT NULL,
      "state" TEXT NOT NULL,
      UNIQUE ("userId", "commitId")
    )`,
    `CREATE INDEX IF NOT EXISTS "sarthi_native_outbox_userId_state_createdAt_idx"
      ON "sarthi_native_outbox" ("userId", "state", "createdAt")`,
  ],
};

/** Durable M4 replication state. The source of truth remains the typed rows above. */
const nativeSyncV1: NativeMigration = {
  version: 3,
  name: "0003_native_sync_queue",
  statements: [
    `CREATE TABLE IF NOT EXISTS "sarthi_native_sync_mutations" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "userId" TEXT NOT NULL,
      "idempotencyKey" TEXT NOT NULL,
      "tableName" TEXT NOT NULL,
      "operation" TEXT NOT NULL,
      "payloadJson" TEXT NOT NULL,
      "createdAtMs" INTEGER NOT NULL,
      "attempts" INTEGER NOT NULL,
      "state" TEXT NOT NULL,
      UNIQUE ("userId", "idempotencyKey")
    )`,
    `CREATE INDEX IF NOT EXISTS "sarthi_native_sync_mutations_user_state_created_idx"
      ON "sarthi_native_sync_mutations" ("userId", "state", "createdAtMs")`,
    `CREATE TABLE IF NOT EXISTS "sarthi_native_sync_watermarks" (
      "userId" TEXT NOT NULL,
      "tableName" TEXT NOT NULL,
      "watermark" TEXT NOT NULL,
      PRIMARY KEY ("userId", "tableName")
    )`,
  ],
};

export const nativeMigrations: readonly NativeMigration[] = [sharedContractV1, nativeRepositoryV1, nativeSyncV1];
