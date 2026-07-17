import { createHash, timingSafeEqual } from "node:crypto";

import type { AuthProvider, AuthenticatedUser } from "@/core/contracts";
import { ProviderConfigurationError, RepositoryError } from "@/core/contracts";

/** Single fixed identity for the keyless dev/CI single-user gate. */
const LOCAL_IDENTITY: AuthenticatedUser = {
  userId: "local-dev",
  email: null,
  mode: "local",
};

/**
 * Reduces any input to a fixed-length 32-byte digest so the comparison never
 * early-returns on a length mismatch (which would leak the secret's length).
 */
function fixedLengthDigest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

/**
 * Keyless single-user auth for dev/CI. The loop runs without any account store:
 * the whole app is a single fixed local identity guarded by one shared password
 * held in `APP_PASSWORD`. Account lifecycle methods refuse rather than pretend.
 */
export class LocalPasswordAuthProvider implements AuthProvider {
  async requireUser(): Promise<AuthenticatedUser> {
    return LOCAL_IDENTITY;
  }

  async signIn(input: { email: string; password: string }): Promise<void> {
    const expected = process.env.APP_PASSWORD;
    if (expected === undefined || expected.length === 0) {
      throw new ProviderConfigurationError(
        "APP_PASSWORD is not set; local-password sign-in is unavailable.",
      );
    }

    // Both sides are hashed to identical-length buffers first, so `timingSafeEqual`
    // sees equal-length inputs and no branch depends on the candidate's length.
    const candidate = fixedLengthDigest(input.password);
    const secret = fixedLengthDigest(expected);
    if (!timingSafeEqual(candidate, secret)) {
      throw new RepositoryError("Invalid credentials.");
    }
  }

  async signOut(): Promise<void> {
    // No session store in single-user mode; there is nothing to tear down.
  }

  async signUp(): Promise<void> {
    throw new ProviderConfigurationError(
      "signUp is not supported in local-password mode (use Supabase in production).",
    );
  }

  async requestPasswordReset(): Promise<void> {
    throw new ProviderConfigurationError(
      "requestPasswordReset is not supported in local-password mode (use Supabase in production).",
    );
  }

  async updatePassword(): Promise<void> {
    throw new ProviderConfigurationError(
      "updatePassword is not supported in local-password mode (use Supabase in production).",
    );
  }
}
