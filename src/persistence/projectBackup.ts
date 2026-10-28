/** The last design, kept in the browser so a reload or crash doesn't lose it. */
export interface ProjectBackup {
  /** Resolves false when the browser won't store it (private mode, blocked storage). */
  save(text: string): Promise<boolean>;
  load(): Promise<string | null>;
}

const DB_NAME = 'cammie';
const STORE = 'backup';
const KEY = 'current';

/** Wraps one IndexedDB request in a promise. */
const request = <T>(r: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });

function openDb(): Promise<IDBDatabase> {
  const open = indexedDB.open(DB_NAME, 1);
  open.onupgradeneeded = () => open.result.createObjectStore(STORE);
  return request(open);
}

/**
 * IndexedDB rather than localStorage: designs with traced images can be
 * several megabytes, past localStorage's ~5 MB limit. Every failure is
 * swallowed: a missing backup must never break the app.
 */
export function createIndexedDbBackup(): ProjectBackup {
  const run = async <T>(mode: IDBTransactionMode, op: (store: IDBObjectStore) => IDBRequest<T>) => {
    const db = await openDb();
    try {
      return await request(op(db.transaction(STORE, mode).objectStore(STORE)));
    } finally {
      db.close();
    }
  };
  return {
    save: (text) =>
      run('readwrite', (s) => s.put(text, KEY)).then(
        () => true,
        () => false,
      ),
    load: () =>
      run('readonly', (s) => s.get(KEY) as IDBRequest<unknown>).then(
        (v) => (typeof v === 'string' ? v : null),
        () => null,
      ),
  };
}
