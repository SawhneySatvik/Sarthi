import type { NativeSyncEngine } from './engine';

/** A narrow adapter around NetInfo/background tasks, intentionally injected for Expo wiring. */
export type ConnectivitySource = {
  subscribe(listener: (online: boolean) => void): () => void;
};

export function attachReconnectReplay(input: {
  source: ConnectivitySource;
  engine: NativeSyncEngine;
  userId: () => string | null;
  tables: readonly string[];
  onError?: (error: unknown) => void;
}): () => void {
  return input.source.subscribe((online) => {
    const userId = input.userId();
    if (!online || !userId) return;
    void input.engine.sync(userId, input.tables).catch(input.onError);
  });
}
