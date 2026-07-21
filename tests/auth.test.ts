/**
 * tests/auth.test.ts — auth providers, keyless and network-free.
 *
 * Each test overrides globalThis.fetch to throw and saves/restores APP_PASSWORD,
 * proving the local-password gate runs with no account store and no network, and
 * that the Supabase stub refuses every method until it is wired (SAR-021).
 */
import assert from "node:assert/strict";
import test from "node:test";

import type { AuthenticatedUser } from "../core/contracts";
import { ProviderConfigurationError } from "../core/contracts";
import { safeRelativeNext } from "../app/auth/callback/safe-next";
import { createAuthProvider } from "../providers/auth";
import { LocalPasswordAuthProvider } from "../providers/auth/local-password";
import { SupabaseAuthProvider } from "../providers/auth/supabase";

import { createMemoryDb } from "./helpers/memory-db";

/** Runs `body` with fetch stubbed to throw and APP_PASSWORD restored afterwards. */
async function withSentinels(
  password: string | undefined,
  body: () => Promise<void>,
): Promise<void> {
  const savedFetch = globalThis.fetch;
  const savedPassword = process.env.APP_PASSWORD;
  globalThis.fetch = (async () => {
    throw new Error("auth must not call fetch");
  }) as typeof fetch;
  if (password === undefined) delete process.env.APP_PASSWORD;
  else process.env.APP_PASSWORD = password;
  try {
    await body();
  } finally {
    globalThis.fetch = savedFetch;
    if (savedPassword === undefined) delete process.env.APP_PASSWORD;
    else process.env.APP_PASSWORD = savedPassword;
  }
}

test("local-password signIn accepts the shared secret and rejects a wrong one", async () => {
  await withSentinels("test-secret", async () => {
    const auth = new LocalPasswordAuthProvider();
    await auth.signIn({ email: "", password: "test-secret" });
    await assert.rejects(auth.signIn({ email: "", password: "wrong" }));
  });
});

test("local-password requireUser is the fixed keyless local identity", async () => {
  await withSentinels("test-secret", async () => {
    const auth = new LocalPasswordAuthProvider();
    const user = await auth.requireUser();
    assert.deepEqual(user, { userId: "local-dev", email: null, mode: "local" });
  });
});

test("local-password account-lifecycle methods refuse (ProviderConfigurationError)", async () => {
  await withSentinels("test-secret", async () => {
    const auth = new LocalPasswordAuthProvider();
    await assert.rejects(auth.signUp(), ProviderConfigurationError);
    await assert.rejects(auth.requestPasswordReset(), ProviderConfigurationError);
    await assert.rejects(auth.updatePassword(), ProviderConfigurationError);
  });
});

test("local-password signIn refuses when APP_PASSWORD is unset", async () => {
  await withSentinels(undefined, async () => {
    const auth = new LocalPasswordAuthProvider();
    await assert.rejects(
      auth.signIn({ email: "", password: "anything" }),
      ProviderConfigurationError,
    );
  });
});

test("supabase adapter is inert without creds and refuses only on invocation (guardrail #1)", async () => {
  // Prove the default (local-password / anonymous) stack posture: with NO Supabase creds present,
  // constructing the adapter is side-effect-free, and the session/account methods refuse clearly
  // ONLY when actually invoked — never at import/construction, so the default boot never breaks.
  const savedUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const savedKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  try {
    await withSentinels("test-secret", async () => {
      const auth = createAuthProvider("supabase");
      // Construction did not throw and pulled in no live client.
      assert.ok(auth instanceof SupabaseAuthProvider);
      await assert.rejects(auth.requireUser(), ProviderConfigurationError);
      await assert.rejects(
        auth.signUp({ email: "a@b.co", password: "supersecret" }),
        ProviderConfigurationError,
      );
      await assert.rejects(
        auth.signIn({ email: "a@b.co", password: "supersecret" }),
        ProviderConfigurationError,
      );
      await assert.rejects(auth.signOut(), ProviderConfigurationError);
      await assert.rejects(
        auth.updatePassword({ password: "supersecret" }),
        ProviderConfigurationError,
      );
      // Enumeration-safe reset ALWAYS resolves — it never signals config or account state, even
      // when the provider is unconfigured. (Resolves rather than rejects — that is the contract.)
      await auth.requestPasswordReset({
        email: "a@b.co",
        redirectTo: "https://sarthi.example/auth/callback",
      });
    });
  } finally {
    if (savedUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = savedUrl;
    if (savedKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = savedKey;
  }
});

test("supabase identities get fully isolated repository scopes (tenant isolation, keyless)", async () => {
  // Guardrail #3: a Supabase user id threads through the IDENTICAL scoped factory as any other
  // identity. Two `mode: "supabase"` users must not be able to read, mutate, or delete each
  // other's rows — and the tenant id comes only from the scope, never from caller input.
  const savedFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error("repository layer must not call fetch");
  }) as typeof fetch;
  try {
    const { db } = await createMemoryDb();
    const { createRepositoryFactory } = await import("../data/repository");
    const factory = createRepositoryFactory(db);

    const userA: AuthenticatedUser = { userId: "supabase-uid-A", email: "a@x.co", mode: "supabase" };
    const userB: AuthenticatedUser = { userId: "supabase-uid-B", email: "b@x.co", mode: "supabase" };
    const reposA = factory.forUser(userA);
    const reposB = factory.forUser(userB);

    const skillA = await reposA.skills.skills.create({
      name: "A private",
      targetMinutes: null,
      isArchived: false,
    });
    // The row is stamped with the SCOPE id, not a caller-supplied one.
    assert.equal(skillA.userId, "supabase-uid-A");

    // B cannot READ A's row (neither list nor byId).
    assert.equal((await reposB.skills.skills.list({})).length, 0);
    assert.equal(await reposB.skills.skills.byId(skillA.id), null);

    // B cannot MUTATE A's row (update refuses across the tenant boundary)…
    await assert.rejects(reposB.skills.skills.update(skillA.id, { targetMinutes: 1 }));
    // …and a cross-tenant softDelete is a scoped no-op that never touches A's row.
    await reposB.skills.skills.softDelete(skillA.id);

    // A still sees exactly its own, un-deleted row.
    const aList = await reposA.skills.skills.list({});
    assert.equal(aList.length, 1);
    assert.equal(aList[0].id, skillA.id);
    assert.ok(await reposA.skills.skills.byId(skillA.id));
  } finally {
    globalThis.fetch = savedFetch;
  }
});

test("createAuthProvider defaults to the keyless local-password gate", async () => {
  await withSentinels("test-secret", async () => {
    const auth = createAuthProvider("local-password");
    assert.ok(auth instanceof LocalPasswordAuthProvider);
  });
});

test("anonymous sandbox REFUSES signIn/signUp (no phantom account on the default deploy)", async () => {
  // F6: a resolving no-op would let the supabase-only auth UI fabricate a "success" if it were
  // ever reached on the anonymous deploy. signIn/signUp must throw; signOut stays a safe no-op.
  const savedFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error("anonymous auth must not call fetch");
  }) as typeof fetch;
  try {
    const auth = createAuthProvider("anonymous");
    await assert.rejects(
      auth.signIn({ email: "a@b.co", password: "supersecret" }),
      ProviderConfigurationError,
    );
    await assert.rejects(
      auth.signUp({ email: "a@b.co", password: "supersecret" }),
      ProviderConfigurationError,
    );
    // signOut is a best-effort no-op (no session store) — it must NOT throw.
    await auth.signOut();
  } finally {
    globalThis.fetch = savedFetch;
  }
});

test("safeRelativeNext rejects open-redirect targets, keeps same-origin relatives", () => {
  // F8: `new URL("//evil.com", origin)` → https://evil.com/, so startsWith("/") is insufficient.
  const SAFE = "/reset-password/update";
  assert.equal(safeRelativeNext("//evil.com"), SAFE);
  assert.equal(safeRelativeNext("/\\evil.com"), SAFE); // /\evil.com — backslash variant
  assert.equal(safeRelativeNext("https://evil.com"), SAFE);
  assert.equal(safeRelativeNext("evil.com"), SAFE);
  assert.equal(safeRelativeNext(null), SAFE);
  // Legitimate same-origin relative paths pass through unchanged.
  assert.equal(safeRelativeNext("/reset-password/update"), "/reset-password/update");
  assert.equal(safeRelativeNext("/today"), "/today");
});
