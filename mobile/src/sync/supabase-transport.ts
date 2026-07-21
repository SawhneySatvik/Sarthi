import type { SupabaseClient } from "@supabase/supabase-js";

import { allTableDescriptors } from "@schema/contract";

import type { PullResult, PushResult, SupabaseSyncTransport, SyncMutation } from "./contracts";

function descriptorFor(table: string) {
  return allTableDescriptors.find((descriptor) => descriptor.name === table) ?? null;
}

function timestampColumn(table: string): string {
  const columns = descriptorFor(table)?.columns.map((column) => column.name) ?? [];
  return columns.includes("updatedAt") ? "updatedAt" : "createdAt";
}

function retryForError(error: { code?: string; message?: string }): PushResult {
  const content = `${error.code ?? ""} ${error.message ?? ""}`.toLowerCase();
  if (content.includes("429") || content.includes("rate")) return { kind: "retry", reason: "rate-limited" };
  if (content.includes("401") || content.includes("jwt") || content.includes("auth") || content.includes("42501")) {
    return { kind: "retry", reason: "unauthorized" };
  }
  return { kind: "retry", reason: "server" };
}

/**
 * Supabase is a replication target. Upserting the complete typed snapshot by
 * shared primary key makes lost acknowledgements safe: commit rows and XP effect
 * rows retain their original stable IDs and cannot be duplicated on replay.
 */
export class SupabaseTypedSyncTransport implements SupabaseSyncTransport {
  constructor(private readonly client: SupabaseClient) {}

  async push(input: { userId: string; mutation: SyncMutation }): Promise<PushResult> {
    const descriptor = descriptorFor(input.mutation.table);
    const payload = input.mutation.payload;
    if (!descriptor || !payload || typeof payload !== "object") return { kind: "retry", reason: "server" };
    const row = payload as Record<string, unknown>;
    if (row.userId !== input.userId) return { kind: "retry", reason: "unauthorized" };
    const onConflict = descriptor.primaryKey.join(",");
    const { error } = await (this.client as SupabaseClient<any>)
      .from(input.mutation.table)
      .upsert(row, { onConflict });
    return error ? retryForError(error) : { kind: "ack" };
  }

  async pull(input: { userId: string; table: string; after: string | null }): Promise<PullResult> {
    const descriptor = descriptorFor(input.table);
    if (!descriptor) return { rows: [], watermark: input.after };
    const changedAt = timestampColumn(input.table);
    let request = (this.client as SupabaseClient<any>)
      .from(input.table)
      .select("*")
      .eq("userId", input.userId)
      .order(changedAt, { ascending: true });
    if (input.after) request = request.gt(changedAt, input.after);
    const { data, error } = await request;
    if (error) throw error;
    const rows = (data ?? []).map((row: Record<string, unknown>) => ({
      table: input.table,
      row,
      updatedAt: typeof row[changedAt] === "string" ? row[changedAt] : new Date(0).toISOString(),
    }));
    const watermark = rows.length > 0 ? rows[rows.length - 1].updatedAt : input.after;
    return { rows, watermark };
  }
}
