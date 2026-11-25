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

/**
 * Sliding terrain tiles with distance LOD + per-frame build budget.
 * Prefers a module worker; falls back to main-thread generation.
 */
export class TerrainStreamer {
  readonly group = new Group();
  private tiles = new Map<string, Tile>();
  private cache = new ChunkCache((STREAM_RADIUS * 2 + 1) ** 2 + 48);
  private queue: BuildJob[] = [];
  private mat = new MeshLambertMaterial({ vertexColors: true });
  private buildsThisFrame = 0;
  /** Base budget; grows when the queue is deep. */
  readonly maxBuildsPerFrame = 3;
  private worker: Worker | null = null;
  private pending = new Map<number, BuildJob>();
  private nextId = 1;
  private keep = new Set<string>();
  private preferWx = 0;
  private preferWz = 0;
  private lastMotion: StreamMotion | undefined;
  private upgradeAcc = 0;

  constructor() {
    try {
      this.worker = new Worker(
        new URL("./chunkWorkerEntry.ts", import.meta.url),
        { type: "module" },
      );
      this.worker.onmessage = (ev: MessageEvent) => {
        const msg = ev.data as {
          id: number;
          cx: number;
          cz: number;
          vertices: Float32Array;
          indices: Uint32Array;
          res: number;
        };
        this.pending.delete(msg.id);
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
        this.spawnOrReplaceTile(data);
      };
      this.worker.onerror = () => {
        this.worker?.terminate();
        this.worker = null;
      };
    } catch {
      this.worker = null;
    }
  }

  bindSky(haze: Color): void {
    applyTerrainDetail(this.mat, haze);
  }

  update(wx: number, wz: number, motion?: StreamMotion): void {
    this.buildsThisFrame = 0;
    this.lastMotion = motion;
    const speed = Math.hypot(motion?.vx ?? 0, motion?.vz ?? 0);
    if (speed > 35 && motion) {
      const look = Math.min(7.5, Math.max(2.2, speed * 0.035));
      this.preferWx = wx + motion.vx * look * 0.7;
      this.preferWz = wz + motion.vz * look * 0.7;
    } else {
      this.preferWx = wx;
      this.preferWz = wz;
    }

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
      this.enqueue(c.cx, c.cz, wantRes);
    }

    // Occasional pass: upgrade coarse tiles we flew closer to.
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

    while (this.queue.length && this.buildsThisFrame < budget) {
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

      if (this.worker) {
        const id = this.nextId++;
        this.pending.set(id, job);
        this.worker.postMessage({ id, cx: job.cx, cz: job.cz, res: job.res });
        this.buildsThisFrame++;
        continue;
      }

      const data = generateChunkMesh(job.cx, job.cz, job.res);
      this.cache.set(data);
      this.spawnOrReplaceTile(data);
      this.buildsThisFrame++;
    }
  }

  /**
   * Bake the full stream ring before the first frame (LOD by distance).
   */
  warm(wx: number, wz: number, count?: number, motion?: StreamMotion): void {
    const m = motion ?? this.lastMotion;
    const raw = m ? neededChunksLookahead(wx, wz, m) : neededChunks(wx, wz);
    const need = sortChunksByPriority(raw, wx, wz, m);
    const limit = count == null ? need.length : Math.min(count, need.length);
    this.keep = new Set(need.map((c) => chunkKey(c.cx, c.cz)));
    this.preferWx = wx;
    this.preferWz = wz;

    for (let i = 0; i < limit; i++) {
      const c = need[i]!;
      const dist = chunkCenterDistance(c.cx, c.cz, wx, wz);
      const wantRes = chunkResForDistance(dist);
      const key = chunkKey(c.cx, c.cz);
      const tile = this.tiles.get(key);
      if (tile && tile.res >= wantRes) continue;
      const cached = this.cache.get(c.cx, c.cz);
      if (cached && cached.res >= wantRes) {
        this.spawnOrReplaceTile(cached);
        continue;
      }
      const data = generateChunkMesh(c.cx, c.cz, wantRes);
      this.cache.set(data);
      this.spawnOrReplaceTile(data);
    }
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
    this.worker?.terminate();
    this.worker = null;
    for (const tile of this.tiles.values()) {
      tile.mesh.geometry.dispose();
    }
    this.tiles.clear();
    this.mat.dispose();
  }
}
