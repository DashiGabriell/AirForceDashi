import { CHUNK_RES, CHUNK_RES_FAR, CHUNK_RES_MID, type ChunkMeshData } from "@afd/game-core";

/** Bump when heightfield / mesh format changes — invalidates old disks. */
export const CHUNK_IDB_VERSION = 1;
const DB_NAME = `afd-terrain-v${CHUNK_IDB_VERSION}`;
const STORE = "chunks";
const MAX_ENTRIES = 180;

type StoredChunk = {
  cx: number;
  cz: number;
  res: number;
  vertices: ArrayBuffer;
  indices: ArrayBuffer;
  savedAt: number;
};

const RES_ORDER = [CHUNK_RES, CHUNK_RES_MID, CHUNK_RES_FAR] as const;

function storageKey(cx: number, cz: number, res: number): string {
  return `${cx},${cz},${res}`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("indexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "key" });
        store.createIndex("savedAt", "savedAt", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("idb open failed"));
  });
}

function rowToMesh(row: StoredChunk): ChunkMeshData {
  return {
    cx: row.cx,
    cz: row.cz,
    res: row.res,
    vertices: new Float32Array(row.vertices.slice(0)),
    indices: new Uint32Array(row.indices.slice(0)),
  };
}

/** Best cached mesh with res >= minRes, or null. */
export async function idbGetChunk(
  cx: number,
  cz: number,
  minRes: number,
): Promise<ChunkMeshData | null> {
  try {
    const db = await openDb();
    try {
      for (const res of RES_ORDER) {
        if (res < minRes) continue;
        const row = await new Promise<StoredChunk | undefined>((resolve, reject) => {
          const tx = db.transaction(STORE, "readonly");
          const req = tx.objectStore(STORE).get(storageKey(cx, cz, res));
          req.onsuccess = () =>
            resolve(req.result as (StoredChunk & { key: string }) | undefined);
          req.onerror = () => reject(req.error);
        });
        if (row && row.vertices && row.indices) return rowToMesh(row);
      }
      return null;
    } finally {
      db.close();
    }
  } catch {
    return null;
  }
}

/** Persist a baked chunk (copies buffers). Fire-and-forget safe. */
export async function idbPutChunk(data: ChunkMeshData): Promise<void> {
  try {
    const db = await openDb();
    try {
      const record = {
        key: storageKey(data.cx, data.cz, data.res),
        cx: data.cx,
        cz: data.cz,
        res: data.res,
        vertices: data.vertices.buffer.slice(
          data.vertices.byteOffset,
          data.vertices.byteOffset + data.vertices.byteLength,
        ),
        indices: data.indices.buffer.slice(
          data.indices.byteOffset,
          data.indices.byteOffset + data.indices.byteLength,
        ),
        savedAt: Date.now(),
      };
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(record);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      await pruneIfNeeded(db);
    } finally {
      db.close();
    }
  } catch {
    /* ignore quota / private mode */
  }
}

async function pruneIfNeeded(db: IDBDatabase): Promise<void> {
  const count = await new Promise<number>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  if (count <= MAX_ENTRIES) return;

  const overflow = count - MAX_ENTRIES;
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const index = store.index("savedAt");
    const req = index.openCursor();
    let removed = 0;
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor || removed >= overflow) return;
      cursor.delete();
      removed++;
      cursor.continue();
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
