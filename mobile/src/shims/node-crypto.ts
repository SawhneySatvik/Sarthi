import { randomUUID as expoRandomUUID } from "expo-crypto";

/**
 * Native replacement for the only Node crypto surface imported by shared code.
 * Expo Crypto's UUID implementation is RFC 4122 v4 and cryptographically random.
 */
export const randomUUID = (): string => expoRandomUUID();
