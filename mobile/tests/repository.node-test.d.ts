/**
 * The Expo app deliberately does not ship Node typings. These minimal test-only
 * declarations keep the M1 contract tests type-checkable without adding a
 * runtime or production dependency; Node supplies both built-ins when run.
 */
declare module "node:assert/strict" {
  const assert: {
    equal(actual: unknown, expected: unknown, message?: string): void;
    deepEqual(actual: unknown, expected: unknown, message?: string): void;
    rejects(block: () => Promise<unknown>, message?: string | RegExp): Promise<void>;
  };
  export default assert;
}

declare module "node:test" {
  const test: (name: string, work: () => void | Promise<void>) => void;
  export default test;
}
