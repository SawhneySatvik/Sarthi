/** Framework-clean authentication port. Implemented by the local-password and Supabase adapters. */
import type { AuthenticatedUser } from "./repositories";

export interface AuthProvider {
  requireUser(): Promise<AuthenticatedUser>;
  signUp(input: { email: string; password: string }): Promise<void>;
  signIn(input: { email: string; password: string }): Promise<void>;
  signOut(): Promise<void>;
  requestPasswordReset(input: { email: string; redirectTo: string }): Promise<void>;
  updatePassword(input: { password: string }): Promise<void>;
}
