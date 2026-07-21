import type {
  LocalOutboxRow,
  LocalRepositoryStorage,
  SqliteCondition,
  SqlitePrimitive,
  SqliteRow,
} from "./types";

function matches(row: SqliteRow, conditions: readonly SqliteCondition[]): boolean {
  return conditions.every((condition) => row[condition.column] === condition.value);
}

function cloneRow(row: SqliteRow): SqliteRow {
  return { ...row };
}

/**
 * Deterministic test double. Keep one instance to model an app restart: a new
 * factory over the same storage sees the exact previous rows/meta/outbox.
 */
export class InMemoryLocalRepositoryStorage implements LocalRepositoryStorage {
  #tables = new Map<string, SqliteRow[]>();
  #meta = new Map<string, string>();
  #outbox: LocalOutboxRow[] = [];

  async insert(table: string, row: SqliteRow): Promise<void> {
    const rows = this.#tables.get(table) ?? [];
    const primary = row.id ?? row.userId ?? row.key ?? row.version;
    if (primary !== undefined && rows.some((entry) => (entry.id ?? entry.userId) === primary)) {
      throw new Error(`${table}: duplicate primary key ${primary}`);
    }
    rows.push(cloneRow(row));
    this.#tables.set(table, rows);
  }

  async select(table: string, conditions: readonly SqliteCondition[]): Promise<readonly SqliteRow[]> {
    return (this.#tables.get(table) ?? []).filter((row) => matches(row, conditions)).map(cloneRow);
  }

  async update(
    table: string,
    conditions: readonly SqliteCondition[],
    patch: SqliteRow,
  ): Promise<number> {
    const rows = this.#tables.get(table) ?? [];
    let changed = 0;
    for (const row of rows) {
      if (!matches(row, conditions)) continue;
      Object.assign(row, patch);
      changed += 1;
    }
    return changed;
  }

  async transaction<T>(work: () => Promise<T>): Promise<T> {
    const tablesBefore = new Map(
      [...this.#tables.entries()].map(([table, rows]) => [table, rows.map(cloneRow)]),
    );
    const metaBefore = new Map(this.#meta);
    const outboxBefore = this.#outbox.map((row) => ({ ...row }));
    try {
      return await work();
    } catch (error) {
      this.#tables = tablesBefore;
      this.#meta = metaBefore;
      this.#outbox = outboxBefore;
      throw error;
    }
  }

  async executeMigration(_sql: string): Promise<void> {
    // Schema is implicit for the memory double; migrations are verified as a plan.
  }

  async getMeta(key: string): Promise<string | null> {
    return this.#meta.get(key) ?? null;
  }

  async bumpMetaCounter(key: string, _updatedAt: string): Promise<number> {
    const next = Number(this.#meta.get(key) ?? "0") + 1;
    this.#meta.set(key, String(next));
    return next;
  }

  async insertConfirmedOutbox(row: LocalOutboxRow): Promise<void> {
    if (this.#outbox.some((entry) => entry.userId === row.userId && entry.commitId === row.commitId)) {
      return;
    }
    this.#outbox.push({ ...row });
  }

  async listConfirmedOutbox(userId: string): Promise<readonly LocalOutboxRow[]> {
    return this.#outbox.filter((row) => row.userId === userId).map((row) => ({ ...row }));
  }
}
