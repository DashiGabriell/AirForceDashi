import {
  chunkKey,
  neededChunks,
  neededChunksLookahead,
  type ChunkMeshData,
  type StreamMotion,
} from "./chunk";

/** LRU-ish chunk cache — bounds memory for long flights. */
export class ChunkCache {
  private map = new Map<string, ChunkMeshData>();
  constructor(readonly maxEntries: number) {}

  get size(): number {
    return this.map.size;
  }

  has(cx: number, cz: number): boolean {
    return this.map.has(chunkKey(cx, cz));
  }

  get(cx: number, cz: number): ChunkMeshData | undefined {
    const k = chunkKey(cx, cz);
    const v = this.map.get(k);
    if (!v) return undefined;
    // refresh LRU order
    this.map.delete(k);
    this.map.set(k, v);
    return v;
  }

  set(data: ChunkMeshData): void {
    const k = chunkKey(data.cx, data.cz);
    if (this.map.has(k)) this.map.delete(k);
    this.map.set(k, data);
    while (this.map.size > this.maxEntries) {
      const oldest = this.map.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
  }

  retain(keys: Set<string>): void {
    for (const k of [...this.map.keys()]) {
      if (!keys.has(k)) this.map.delete(k);
    }
  }
}

export function syncChunkKeys(
  wx: number,
  wz: number,
  radius?: number,
  motion?: StreamMotion,
): Set<string> {
  const need = motion
    ? neededChunksLookahead(wx, wz, motion, radius)
    : neededChunks(wx, wz, radius);
  return new Set(need.map((c) => chunkKey(c.cx, c.cz)));
}
