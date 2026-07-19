import type { MediaProvider } from "@/core/contracts";
import { ProviderConfigurationError } from "@/core/contracts";

/** Production-shaped seam; real object storage is intentionally outside SAR-019A. */
export class ProductionMediaProvider implements MediaProvider {
  async put(): Promise<never> { throw new ProviderConfigurationError("Production media storage is not configured."); }
  async read(): Promise<never> { throw new ProviderConfigurationError("Production media storage is not configured."); }
}
