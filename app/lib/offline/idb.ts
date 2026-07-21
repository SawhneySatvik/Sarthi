/**
 * app/lib/offline/idb.ts — a TINY hand-rolled promise wrapper over IndexedDB.
 *
 * Deliberately NO `idb`/`dexie` dependency (T10 requirement #1). One database with two
 * object stores:
 *   - `kv`        — durable client state (KV): tool-run, theme mirror, etc. keyPath "key".
 *   - `mutations` — the capture mutation queue (see queue.ts). keyPath "id".
 *
 * NO IndexedDB is touched at import time — the db only opens on first call, so importing
 * this module flag-off (or on the server, where `indexedDB` is undefined) is inert. Every
 * helper resolves to `null`/`[]`/no-op if IndexedDB is unavailable, so a caller never
 * throws for a browser/context that lacks it.
 */

const DB_NAME = "sarthi-offline";
const DB_VERSION = 1;
export const KV_STORE = "kv";
export const MUTATIONS_STORE = "mutations";

let dbPromise: Promise<IDBDatabase | null> | null = null;

function indexedDbAvailable(): boolean {
  return typeof indexedDB !== "undefined" && indexedDB !== null;
}

/** Open (and lazily create) the database. Memoised; resolves `null` where unsupported. */
export function openDb(): Promise<IDBDatabase | null> {
  if (!indexedDbAvailable()) return Promise.resolve(null);
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(KV_STORE)) {
        db.createObjectStore(KV_STORE, { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains(MUTATIONS_STORE)) {
        db.createObjectStore(MUTATIONS_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
  return dbPromise;
}

function promisifyTx<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Read every record in a store (small stores only — the queue is a handful of rows). */
export async function idbGetAll<T>(store: string): Promise<T[]> {
  const db = await openDb();
  if (!db) return [];
  try {
    const tx = db.transaction(store, "readonly");
    const result = await promisifyTx<T[]>(tx.objectStore(store).getAll() as IDBRequest<T[]>);
    return result ?? [];
  } catch {
    return [];
  }
}

/** Read one record by its key. */
export async function idbGet<T>(store: string, key: IDBValidKey): Promise<T | null> {
  const db = await openDb();
  if (!db) return null;
  try {
    const tx = db.transaction(store, "readonly");
    const result = await promisifyTx<T | undefined>(tx.objectStore(store).get(key) as IDBRequest<T | undefined>);
    return result ?? null;
  } catch {
    return null;
  }
}

/** Upsert one record (the store's keyPath supplies the key). Best-effort. */
export async function idbPut<T>(store: string, value: T): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    const tx = db.transaction(store, "readwrite");
    await promisifyTx(tx.objectStore(store).put(value as unknown as Record<string, unknown>));
  } catch {
    /* best-effort mirror — a failed write never breaks the source-of-truth path */
  }
}

/** Delete one record by key. Best-effort. */
export async function idbDelete(store: string, key: IDBValidKey): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    const tx = db.transaction(store, "readwrite");
    await promisifyTx(tx.objectStore(store).delete(key));
  } catch {
    /* best-effort */
  }
}
