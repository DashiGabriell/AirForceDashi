import {
  ChunkCache,
  STREAM_RADIUS,
  chunkKey,
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
}

/**
 * Sliding terrain tiles. Prefers a module worker for height bake; falls back
 * to main-thread generation capped per frame. Prefetches along jet velocity.
 *
 * Phase 1: full-ring warm + velocity priority + LRU cache (no hard retain wipe).
 */
export class TerrainStreamer {
  readonly group = new Group();
  private tiles = new Map<string, Tile>();
  private cache = new ChunkCache((STREAM_RADIUS * 2 + 1) ** 2 + 48);
  private queue: Array<{ cx: number; cz: number }> = [];
  private mat = new MeshLambertMaterial({ vertexColors: true });
  private buildsThisFrame = 0;
  readonly maxBuildsPerFrame = 2;
  private worker: Worker | null = null;
  private pending = new Map<number, { cx: number; cz: number }>();
  private nextId = 1;
  private keep = new Set<string>();
  private preferWx = 0;
  private preferWz = 0;
  private lastMotion: StreamMotion | undefined;

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
        if (!this.keep.has(key) || this.tiles.has(key)) return;
        const data: ChunkMeshData = {
          cx: msg.cx,
          cz: msg.cz,
          vertices: msg.vertices,
          indices: msg.indices,
          res: msg.res,
        };
        this.cache.set(data);
        this.spawnTile(data);
      };
      this.worker.onerror = () => {
        this.worker?.terminate();
        this.worker = null;
      };
    } catch {
      this.worker = null;
    }
  }

  /** Circular fade + near-field procedural splat into the sky haze. */
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
      if (this.tiles.has(key)) continue;
      const cached = this.cache.get(c.cx, c.cz);
      if (cached) {
        this.spawnTile(cached);
        continue;
      }
      if (!this.queue.some((q) => q.cx === c.cx && q.cz === c.cz)) {
        this.queue.push(c);
      }
    }

    // Drop stale queue entries, then priority-sort (under jet → ahead → behind).
    this.queue = this.queue.filter((q) => {
      const key = chunkKey(q.cx, q.cz);
      return this.keep.has(key) && !this.tiles.has(key);
    });
    this.queue = sortChunksByPriority(this.queue, wx, wz, motion);

    while (this.queue.length && this.buildsThisFrame < this.maxBuildsPerFrame) {
      const job = this.queue.shift()!;
      const key = chunkKey(job.cx, job.cz);
      if (this.tiles.has(key) || !this.keep.has(key)) continue;
      if ([...this.pending.values()].some((p) => p.cx === job.cx && p.cz === job.cz)) {
        continue;
      }

      if (this.worker) {
        const id = this.nextId++;
        this.pending.set(id, job);
        this.worker.postMessage({ id, cx: job.cx, cz: job.cz });
        this.buildsThisFrame++;
        continue;
      }

      const data = generateChunkMesh(job.cx, job.cz);
      this.cache.set(data);
      this.spawnTile(data);
      this.buildsThisFrame++;
    }

    // LRU only — do not wipe cached neighbors (helps circling back).
  }

  /**
   * Bake the full stream ring (optionally capped) before the first frame.
   * Sorted by load priority so the pad under the jet appears first.
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
      if (this.tiles.has(chunkKey(c.cx, c.cz))) continue;
      if (this.cache.has(c.cx, c.cz)) {
        this.spawnTile(this.cache.get(c.cx, c.cz)!);
        continue;
      }
      const data = generateChunkMesh(c.cx, c.cz);
      this.cache.set(data);
      this.spawnTile(data);
    }
  }

  private spawnTile(data: ChunkMeshData): void {
    const key = chunkKey(data.cx, data.cz);
    if (this.tiles.has(key)) return;
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
    this.tiles.set(key, { mesh, key });
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
