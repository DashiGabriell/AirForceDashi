import {
  ChunkCache,
  chunkKey,
  generateChunkMesh,
  neededChunks,
  STREAM_RADIUS,
  type ChunkMeshData,
} from "@afd/game-core";
import {
  BufferAttribute,
  BufferGeometry,
  Group,
  Mesh,
  MeshLambertMaterial,
} from "three";

interface Tile {
  mesh: Mesh;
  key: string;
}

/**
 * Sliding terrain tiles. Prefers a module worker for height bake; falls back
 * to main-thread generation capped per frame.
 */
export class TerrainStreamer {
  readonly group = new Group();
  private tiles = new Map<string, Tile>();
  private cache = new ChunkCache((STREAM_RADIUS * 2 + 1) ** 2 + 4);
  private queue: Array<{ cx: number; cz: number }> = [];
  private mat = new MeshLambertMaterial({ vertexColors: true });
  private buildsThisFrame = 0;
  readonly maxBuildsPerFrame = 2;
  private worker: Worker | null = null;
  private pending = new Map<number, { cx: number; cz: number }>();
  private nextId = 1;
  private keep = new Set<string>();

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

  update(wx: number, wz: number): void {
    this.buildsThisFrame = 0;
    const need = neededChunks(wx, wz);
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

    while (this.queue.length && this.buildsThisFrame < this.maxBuildsPerFrame) {
      const job = this.queue.shift()!;
      const key = chunkKey(job.cx, job.cz);
      if (this.tiles.has(key) || !this.keep.has(key)) continue;

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

    this.cache.retain(this.keep);
  }

  warm(wx: number, wz: number, count = 9): void {
    const need = neededChunks(wx, wz);
    for (let i = 0; i < Math.min(count, need.length); i++) {
      const c = need[i]!;
      if (this.cache.has(c.cx, c.cz)) {
        const data = this.cache.get(c.cx, c.cz)!;
        this.spawnTile(data);
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
