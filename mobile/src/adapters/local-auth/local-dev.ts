import type { AuthProvider, AuthenticatedUser } from "@contracts";

/** Keyless M1 identity. Future Supabase auth passes its verified userId to the same factory. */
export const LOCAL_DEV_USER: AuthenticatedUser = {
  userId: "local-dev",
  email: "local-dev@sarthi.local",
  mode: "local",
};

/**
 * No credentials are persisted in this adapter. It gives M0/M1 the identical
 * authenticated boundary as production while retaining the deterministic local
 * identity required by the fake stack.
 */
export class LocalDevAuthProvider implements AuthProvider {
  constructor(private readonly user: AuthenticatedUser = LOCAL_DEV_USER) {}

  async requireUser(): Promise<AuthenticatedUser> {
    return this.user;
  }

  async signUp(_input: { email: string; password: string }): Promise<void> {}
  async signIn(_input: { email: string; password: string }): Promise<void> {}
  async signOut(): Promise<void> {}
  async requestPasswordReset(_input: { email: string; redirectTo: string }): Promise<void> {}
  async updatePassword(_input: { password: string }): Promise<void> {}
}
