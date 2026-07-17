/**
 * tests/auth.test.ts — auth providers, keyless and network-free.
 *
 * Each test overrides globalThis.fetch to throw and saves/restores APP_PASSWORD,
 * proving the local-password gate runs with no account store and no network, and
 * that the Supabase stub refuses every method until it is wired (SAR-021).
 */
import assert from "node:assert/strict";
import test from "node:test";

import { ProviderConfigurationError } from "../core/contracts";
import { createAuthProvider } from "../providers/auth";
import { LocalPasswordAuthProvider } from "../providers/auth/local-password";
import { SupabaseAuthProvider } from "../providers/auth/supabase";

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

test("createAuthProvider('supabase') returns a stub that refuses every method", async () => {
  await withSentinels("test-secret", async () => {
    const auth = createAuthProvider("supabase");
    await assert.rejects(auth.requireUser(), ProviderConfigurationError);
    await assert.rejects(
      auth.signUp({ email: "a@b.co", password: "x" }),
      ProviderConfigurationError,
    );
    await assert.rejects(
      auth.signIn({ email: "a@b.co", password: "x" }),
      ProviderConfigurationError,
    );
    await assert.rejects(auth.signOut(), ProviderConfigurationError);
    await assert.rejects(
      auth.requestPasswordReset({ email: "a@b.co", redirectTo: "/" }),
      ProviderConfigurationError,
    );
    await assert.rejects(
      auth.updatePassword({ password: "x" }),
      ProviderConfigurationError,
    );
    // instanceof narrows the concrete type, so assert it last (after interface calls).
    assert.ok(auth instanceof SupabaseAuthProvider);
  });
});

test("createAuthProvider defaults to the keyless local-password gate", async () => {
  await withSentinels("test-secret", async () => {
    const auth = createAuthProvider("local-password");
    assert.ok(auth instanceof LocalPasswordAuthProvider);
  });
});
