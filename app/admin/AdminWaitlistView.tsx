import type { WaitlistRecord, WaitlistStatus } from "@/data/schema/contract";
import { Button } from "@/components/ui/Button";

import { approveEntry, inviteEntry, rejectEntry } from "./actions";

/*
 * app/admin/AdminWaitlistView.tsx — the PURELY PRESENTATIONAL admin waitlist surface (PL-2).
 *
 * Takes the already-fetched rows + the signed-in admin's email as props; the gated server page
 * (`page.tsx`) does the auth/allowlist enforcement and the unscoped read. Keeping this component
 * dumb means it can be rendered from a throwaway keyless harness for screenshots without relaxing
 * the gate. Tokens-only, Bone, no amber; every action is a 44px keyboard-focusable button.
 */

const STATUS_ORDER: readonly WaitlistStatus[] = ["pending", "approved", "invited", "rejected"];

const STATUS_LABEL: Record<WaitlistStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  invited: "Invited",
  rejected: "Rejected",
};

function countsByStatus(rows: readonly WaitlistRecord[]): Record<WaitlistStatus, number> {
  const counts: Record<WaitlistStatus, number> = { pending: 0, approved: 0, invited: 0, rejected: 0 };
  for (const row of rows) {
    if (row.status in counts) counts[row.status] += 1;
  }
  return counts;
}

/** Neutral status chip — ink weight signals openness (approved/invited read stronger). No amber. */
function StatusBadge({ status }: { status: WaitlistStatus }) {
  const open = status === "approved" || status === "invited";
  return (
    <span
      className={`inline-flex items-center rounded-chip border border-line px-2 py-0.5 font-ui text-caption ${
        open ? "bg-card text-ink-1" : "bg-raised text-ink-3"
      }`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

/** One row's three status transitions, each a self-contained form posting the row id. */
function RowActions({ id }: { id: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <form action={approveEntry}>
        <input type="hidden" name="id" value={id} />
        <Button type="submit" variant="ghost" className="min-h-11 focus-visible:ring-2 focus-visible:ring-ring">
          Approve
        </Button>
      </form>
      <form action={inviteEntry}>
        <input type="hidden" name="id" value={id} />
        <Button type="submit" variant="ghost" className="min-h-11 focus-visible:ring-2 focus-visible:ring-ring">
          Generate invite
        </Button>
      </form>
      <form action={rejectEntry}>
        <input type="hidden" name="id" value={id} />
        <Button type="submit" variant="quiet" className="min-h-11 focus-visible:ring-2 focus-visible:ring-ring">
          Reject
        </Button>
      </form>
    </div>
  );
}

export function AdminWaitlistView({
  rows,
  adminEmail,
}: {
  rows: readonly WaitlistRecord[];
  adminEmail: string;
}) {
  const counts = countsByStatus(rows);

  return (
    <main className="min-h-dvh bg-canvas px-5 py-10 text-ink-1 sm:px-8">
      <div className="mx-auto w-full max-w-3xl">
        <header className="flex flex-col gap-1">
          <p className="font-ui text-caption font-medium uppercase tracking-[0.14em] text-ink-3">Sarthi admin</p>
          <h1 className="font-display text-display text-ink-1">Waitlist</h1>
          <p className="font-ui text-caption text-ink-3">Signed in as {adminEmail}</p>
        </header>

        {/* Counts — total + per-status. */}
        <section aria-label="Counts" className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div className="rounded-card border border-line bg-raised px-4 py-3">
            <p className="font-display text-title text-ink-1">{rows.length}</p>
            <p className="font-ui text-caption text-ink-3">Total</p>
          </div>
          {STATUS_ORDER.map((status) => (
            <div key={status} className="rounded-card border border-line bg-raised px-4 py-3">
              <p className="font-display text-title text-ink-1">{counts[status]}</p>
              <p className="font-ui text-caption text-ink-3">{STATUS_LABEL[status]}</p>
            </div>
          ))}
        </section>

        {/* Entries. */}
        <section aria-label="Waitlist entries" className="mt-8">
          {rows.length === 0 ? (
            <p className="rounded-card border border-line bg-raised px-4 py-8 text-center font-ui text-body text-ink-3">
              No one on the waitlist yet.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {rows.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-col gap-3 rounded-card border border-line bg-raised px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="truncate font-ui text-body text-ink-1">{row.email}</span>
                    <span className="flex items-center gap-2">
                      <StatusBadge status={row.status} />
                      <span className="font-ui text-caption text-ink-3">Joined {row.createdAt.slice(0, 10)}</span>
                    </span>
                  </div>
                  <RowActions id={row.id} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
