import {
  ChunkCache,
  STREAM_RADIUS,
  chunkCenterDistance,
  chunkKey,
  chunkResForDistance,
  generateChunkMesh,
  neededChunks,
  neededChunksLookahead,
  sortChunksByPriority,
  type ChunkMeshData,
  type StreamMotion,
} from "@afd/game-core";
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Mesh,
  MeshLambertMaterial,
} from "three";
import { idbGetChunk, idbPutChunk } from "./chunkIdbCache";
import { applyTerrainDetail } from "./radialHorizon";

interface Tile {
  mesh: Mesh;
  key: string;
  res: number;
}

interface BuildJob {
  cx: number;
  cz: number;
  res: number;
}

interface PendingJob extends BuildJob {
  worker: Worker;
}

/** How many in-flight jobs each worker may hold (pipeline depth). */
const JOBS_PER_WORKER = 2;

function nextPaint(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

function poolSize(): number {
  const cores =
    typeof navigator !== "undefined" && navigator.hardwareConcurrency
      ? navigator.hardwareConcurrency
      : 4;
  return Math.min(4, Math.max(2, Math.floor(cores / 2)));
}

/**
 * Sliding terrain tiles with distance LOD, build budget, and a worker pool.
 * Transferables move mesh buffers off the worker without structured-clone cost.
 */
export class TerrainStreamer {
  readonly group = new Group();
  private tiles = new Map<string, Tile>();
  private cache = new ChunkCache((STREAM_RADIUS * 2 + 1) ** 2 + 48);
  private queue: BuildJob[] = [];
  private mat = new MeshLambertMaterial({ vertexColors: true });
  private buildsThisFrame = 0;
  readonly maxBuildsPerFrame = 3;
  private workers: Worker[] = [];
  private workerLoad = new Map<Worker, number>();
  private pending = new Map<number, PendingJob>();
  private nextId = 1;
  private keep = new Set<string>();
  private lastMotion: StreamMotion | undefined;
  private upgradeAcc = 0;
  /** In-flight IndexedDB reads — avoid duplicate fetches. */
  private idbInflight = new Set<string>();

  constructor() {
    this.bootPool();
  }

  private persist(data: ChunkMeshData): void {
    void idbPutChunk(data);
  }

  /**
   * Pull the stream ring from IndexedDB into memory/scene (second-visit fast path).
   * Safe no-op when IDB is unavailable.
   */
  async hydrate(
    wx: number,
    wz: number,
    motion?: StreamMotion,
  ): Promise<number> {
    const m = motion ?? this.lastMotion;
    const raw = m ? neededChunksLookahead(wx, wz, m) : neededChunks(wx, wz);
    const need = sortChunksByPriority(raw, wx, wz, m);
    this.keep = new Set(need.map((c) => chunkKey(c.cx, c.cz)));
    let hits = 0;
    await Promise.all(
      need.map(async (c) => {
        const want = chunkResForDistance(
          chunkCenterDistance(c.cx, c.cz, wx, wz),
        );
        const key = chunkKey(c.cx, c.cz);
        const tile = this.tiles.get(key);
        if (tile && tile.res >= want) {
          hits++;
          return;
        }
        const mem = this.cache.get(c.cx, c.cz);
        if (mem && mem.res >= want) {
          this.spawnOrReplaceTile(mem);
          hits++;
          return;
        }
        const disk = await idbGetChunk(c.cx, c.cz, want);
        if (!disk) return;
        this.cache.set(disk);
        this.spawnOrReplaceTile(disk);
        hits++;
      }),
    );
    return hits;
  }

  private bootPool(): void {
    const n = poolSize();
    for (let i = 0; i < n; i++) {
      try {
        const worker = new Worker(
          new URL("./chunkWorkerEntry.ts", import.meta.url),
          { type: "module" },
        );
        worker.onmessage = (ev: MessageEvent) => this.onWorkerMessage(ev);
        worker.onerror = () => this.dropWorker(worker);
        this.workers.push(worker);
        this.workerLoad.set(worker, 0);
      } catch {
        break;
      }
    }
  }

  private dropWorker(worker: Worker): void {
    try {
      worker.terminate();
    } catch {
      /* ignore */
    }
    this.workers = this.workers.filter((w) => w !== worker);
    this.workerLoad.delete(worker);
    for (const [id, job] of this.pending) {
      if (job.worker === worker) {
        this.pending.delete(id);
        this.enqueue(job.cx, job.cz, job.res);
      }
    }
  }

  private onWorkerMessage(ev: MessageEvent): void {
    const msg = ev.data as {
      id: number;
      cx: number;
      cz: number;
      vertices: Float32Array;
      indices: Uint32Array;
      res: number;
    };
    const job = this.pending.get(msg.id);
    this.pending.delete(msg.id);
    if (job) {
      const load = this.workerLoad.get(job.worker) ?? 1;
      this.workerLoad.set(job.worker, Math.max(0, load - 1));
    }
    const key = chunkKey(msg.cx, msg.cz);
    if (!this.keep.has(key)) return;
    const data: ChunkMeshData = {
      cx: msg.cx,
      cz: msg.cz,
      vertices: msg.vertices,
      indices: msg.indices,
      res: msg.res,
    };
    this.cache.set(data);
    this.persist(data);
    this.spawnOrReplaceTile(data);
  }

  private pickWorker(): Worker | null {
    let best: Worker | null = null;
    let bestLoad = Infinity;
    for (const w of this.workers) {
      const load = this.workerLoad.get(w) ?? 0;
      if (load >= JOBS_PER_WORKER) continue;
      if (load < bestLoad) {
        best = w;
        bestLoad = load;
      }
    }
    return best;
  }

  bindSky(haze: Color): void {
    applyTerrainDetail(this.mat, haze);
  }

  update(wx: number, wz: number, motion?: StreamMotion): void {
    this.buildsThisFrame = 0;
    this.lastMotion = motion;

    const need = neededChunksLookahead(wx, wz, motion);
    this.keep = new Set(need.map((c) => chunkKey(c.cx, c.cz)));

    for (const [key, tile] of this.tiles) {
      if (!this.keep.has(key)) {
        this.group.remove(tile.mesh);
        tile.mesh.geometry.dispose();
        this.tiles.delete(key);
      }
    }

    for (const c of need) {
      const key = chunkKey(c.cx, c.cz);
      const dist = chunkCenterDistance(c.cx, c.cz, wx, wz);
      const wantRes = chunkResForDistance(dist);
      const existing = this.tiles.get(key);
      if (existing) {
        if (existing.res < wantRes) this.enqueue(c.cx, c.cz, wantRes);
        continue;
      }
      const cached = this.cache.get(c.cx, c.cz);
      if (cached && cached.res >= wantRes) {
        this.spawnOrReplaceTile(cached);
        continue;
      }
      this.requestIdb(c.cx, c.cz, wantRes);
      this.enqueue(c.cx, c.cz, wantRes);
    }

    this.upgradeAcc += 1;
    if (this.upgradeAcc >= 8) {
      this.upgradeAcc = 0;
      for (const tile of this.tiles.values()) {
        const [cx, cz] = tile.key.split(",").map(Number) as [number, number];
        const want = chunkResForDistance(chunkCenterDistance(cx, cz, wx, wz));
        if (tile.res < want) this.enqueue(cx, cz, want);
      }
    }

    this.queue = this.queue.filter((q) => {
      const key = chunkKey(q.cx, q.cz);
      if (!this.keep.has(key)) return false;
      const tile = this.tiles.get(key);
      if (tile && tile.res >= q.res) return false;
      return true;
    });
    const wantRes = new Map(
      this.queue.map((q) => [chunkKey(q.cx, q.cz), q.res] as const),
    );
    this.queue = sortChunksByPriority(this.queue, wx, wz, motion).map((c) => ({
      cx: c.cx,
      cz: c.cz,
      res:
        wantRes.get(chunkKey(c.cx, c.cz)) ??
        chunkResForDistance(chunkCenterDistance(c.cx, c.cz, wx, wz)),
    }));

    const budget = Math.min(
      5,
      this.maxBuildsPerFrame + Math.floor(this.queue.length / 10),
    );
    const maxPending = Math.max(1, this.workers.length) * JOBS_PER_WORKER;

    while (
      this.queue.length &&
      this.buildsThisFrame < budget &&
      this.pending.size < maxPending
    ) {
      const job = this.queue.shift()!;
      const key = chunkKey(job.cx, job.cz);
      if (!this.keep.has(key)) continue;
      const tile = this.tiles.get(key);
      if (tile && tile.res >= job.res) continue;
      if (
        [...this.pending.values()].some(
          (p) => p.cx === job.cx && p.cz === job.cz && p.res >= job.res,
        )
      ) {
        continue;
      }

      const worker = this.pickWorker();
      if (worker) {
        const id = this.nextId++;
        this.pending.set(id, { ...job, worker });
        this.workerLoad.set(worker, (this.workerLoad.get(worker) ?? 0) + 1);
        // Transferables are applied on the worker reply (chunkWorkerEntry).
        worker.postMessage({ id, cx: job.cx, cz: job.cz, res: job.res });
        this.buildsThisFrame++;
        continue;
      }

      // No free worker (or pool empty) — bake on main so streaming never stalls.
      const data = generateChunkMesh(job.cx, job.cz, job.res);
      this.cache.set(data);
      this.persist(data);
      this.spawnOrReplaceTile(data);
      this.buildsThisFrame++;
    }
  }

  /** Sync full-ring bake for gaps (LOD by distance). Call after hydrate(). */
  warm(wx: number, wz: number, count?: number, motion?: StreamMotion): void {
    const { need, limit } = this.planWarm(wx, wz, count, motion);
    for (let i = 0; i < limit; i++) {
      const c = need[i]!;
      const want = chunkResForDistance(chunkCenterDistance(c.cx, c.cz, wx, wz));
      this.bakeOne(c.cx, c.cz, want);
    }
  }

  /** Same ring as `warm`, yielding so a boot screen can paint between tiles. */
  async warmYielding(
    wx: number,
    wz: number,
    motion: StreamMotion | undefined,
    onProgress?: (t: number) => void,
  ): Promise<void> {
    const { need, limit } = this.planWarm(wx, wz, undefined, motion);
    const total = Math.max(1, limit);
    for (let i = 0; i < limit; i++) {
      const c = need[i]!;
      const want = chunkResForDistance(chunkCenterDistance(c.cx, c.cz, wx, wz));
      this.bakeOne(c.cx, c.cz, want);
      if ((i & 1) === 1) await nextPaint();
      onProgress?.((i + 1) / total);
    }
    onProgress?.(1);
  }

  /**
   * Raise tiles already in the stream ring to `res` (the approach corridor).
   * Chunks outside `keep` are skipped so the next update does not discard them.
   */
  async ensureResolution(
    chunks: Array<{ cx: number; cz: number }>,
    res: number,
    onProgress?: (t: number) => void,
  ): Promise<void> {
    const list = chunks.filter((c) => this.keep.has(chunkKey(c.cx, c.cz)));
    const total = Math.max(1, list.length);
    for (let i = 0; i < list.length; i++) {
      const c = list[i]!;
      this.bakeOne(c.cx, c.cz, res);
      if ((i & 1) === 1) await nextPaint();
      onProgress?.((i + 1) / total);
    }
    onProgress?.(1);
  }

  private planWarm(
    wx: number,
    wz: number,
    count: number | undefined,
    motion?: StreamMotion,
  ): { need: Array<{ cx: number; cz: number }>; limit: number } {
    const m = motion ?? this.lastMotion;
    const raw = m ? neededChunksLookahead(wx, wz, m) : neededChunks(wx, wz);
    const need = sortChunksByPriority(raw, wx, wz, m);
    const limit = count == null ? need.length : Math.min(count, need.length);
    this.keep = new Set(need.map((c) => chunkKey(c.cx, c.cz)));
    return { need, limit };
  }

  private bakeOne(cx: number, cz: number, res: number): void {
    const key = chunkKey(cx, cz);
    const tile = this.tiles.get(key);
    if (tile && tile.res >= res) return;
    const cached = this.cache.get(cx, cz);
    if (cached && cached.res >= res) {
      this.spawnOrReplaceTile(cached);
      return;
    }
    const data = generateChunkMesh(cx, cz, res);
    this.cache.set(data);
    this.persist(data);
    this.spawnOrReplaceTile(data);
  }

  private requestIdb(cx: number, cz: number, res: number): void {
    const ik = `${chunkKey(cx, cz)}:${res}`;
    if (this.idbInflight.has(ik)) return;
    this.idbInflight.add(ik);
    void idbGetChunk(cx, cz, res).then((disk) => {
      this.idbInflight.delete(ik);
      if (!disk) return;
      if (!this.keep.has(chunkKey(cx, cz))) return;
      this.cache.set(disk);
      this.spawnOrReplaceTile(disk);
    });
  }

  private enqueue(cx: number, cz: number, res: number): void {
    const existing = this.queue.find((q) => q.cx === cx && q.cz === cz);
    if (existing) {
      if (res > existing.res) existing.res = res;
      return;
    }
    this.queue.push({ cx, cz, res });
  }

  private spawnOrReplaceTile(data: ChunkMeshData): void {
    const key = chunkKey(data.cx, data.cz);
    const prev = this.tiles.get(key);
    if (prev && prev.res >= data.res) return;

    const geo = new BufferGeometry();
    const vertCount = data.vertices.length / 6;
    const pos = new Float32Array(vertCount * 3);
    const col = new Float32Array(vertCount * 3);
    for (let i = 0, v = 0; i < data.vertices.length; i += 6, v++) {
      pos[v * 3] = data.vertices[i]!;
      pos[v * 3 + 1] = data.vertices[i + 1]!;
      pos[v * 3 + 2] = data.vertices[i + 2]!;
      col[v * 3] = data.vertices[i + 3]!;
      col[v * 3 + 1] = data.vertices[i + 4]!;
      col[v * 3 + 2] = data.vertices[i + 5]!;
    }
    geo.setAttribute("position", new BufferAttribute(pos, 3));
    geo.setAttribute("color", new BufferAttribute(col, 3));
    geo.setIndex(new BufferAttribute(data.indices, 1));
    geo.computeVertexNormals();
    const mesh = new Mesh(geo, this.mat);
    mesh.frustumCulled = true;
    this.group.add(mesh);

    if (prev) {
      this.group.remove(prev.mesh);
      prev.mesh.geometry.dispose();
    }
    this.tiles.set(key, { mesh, key, res: data.res });
  }

  dispose(): void {
    for (const w of this.workers) {
      try {
        w.terminate();
      } catch {
        /* ignore */
      }
    }
    this.workers = [];
    this.workerLoad.clear();
    this.pending.clear();
    for (const tile of this.tiles.values()) {
      tile.mesh.geometry.dispose();
    }
    this.tiles.clear();
    this.mat.dispose();
  }
}
