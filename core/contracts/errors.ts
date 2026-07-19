/** Shared typed error taxonomy for framework-clean core and adapter implementations. */

/** Base class for every expected, typed Sarthi error. */
export class SarthiError extends Error {
  constructor(message: string) {
    super(message);
    // `new.target` resolves to the concrete subclass, preserving each class name.
    this.name = new.target.name;
  }
}

/**
 * A provider was selected but is not configured or enabled for the requested tier.
 * Canonical home; `providers/llm` re-exports it so existing provider imports keep working.
 */
export class ProviderConfigurationError extends SarthiError {}

/** A repository/persistence operation failed against a per-domain table. */
export class RepositoryError extends SarthiError {}
