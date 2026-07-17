import type { AuthProvider, AuthenticatedUser } from "@/core/contracts";
import { ProviderConfigurationError } from "@/core/contracts";

const NOT_IMPLEMENTED = "Supabase auth is not implemented until SAR-021";

/**
 * Composition-ready stub for production auth. Constructing it is side-effect free
 * (no `@supabase/*` import, no live client); every method call refuses clearly so
 * the factory can wire it today and SAR-021 fills in the real client later.
 */
export class SupabaseAuthProvider implements AuthProvider {
  async requireUser(): Promise<AuthenticatedUser> {
    throw new ProviderConfigurationError(NOT_IMPLEMENTED);
  }

  async signUp(): Promise<void> {
    throw new ProviderConfigurationError(NOT_IMPLEMENTED);
  }

  async signIn(): Promise<void> {
    throw new ProviderConfigurationError(NOT_IMPLEMENTED);
  }

  async signOut(): Promise<void> {
    throw new ProviderConfigurationError(NOT_IMPLEMENTED);
  }

  async requestPasswordReset(): Promise<void> {
    throw new ProviderConfigurationError(NOT_IMPLEMENTED);
  }

  async updatePassword(): Promise<void> {
    throw new ProviderConfigurationError(NOT_IMPLEMENTED);
  }
}
