import { describe, expect, it } from "vitest";
import { ChunkCache, syncChunkKeys } from "./streaming";
import {
  CHUNK_RES,
  CHUNK_RES_FAR,
  CHUNK_RES_MID,
  CHUNK_SIZE,
  generateChunkMesh,
  neededChunks,
  neededChunksLookahead,
  chunkResForDistance,
  sortChunksByPriority,
  worldToChunk,
  STREAM_RADIUS,
  chunkKey,
} from "./chunk";
import { CONTROL_TOWER, controlTowerCeiling } from "./controlTower";
import { sampleHeight, sampleRegion, Region } from "./heightfield";
import { buildPlaces, nearestPlace } from "./places";

describe("heightfield", () => {
  it("samples finite heights in world bounds", () => {
    for (const [x, z] of [
      [0, 0],
      [5000, -3000],
      [-8000, 8000],
    ] as const) {
      const h = sampleHeight(x, z);
      expect(Number.isFinite(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(1900);
    }
  });

  it("returns a valid region enum", () => {
    const r = sampleRegion(0, 0);
    expect(r).toBeGreaterThanOrEqual(Region.WATER);
    expect(r).toBeLessThanOrEqual(Region.ROCK);
  });

  it("matches the Pacific Islands heightmap", () => {
    expect(sampleHeight(7900, 7900)).toBeLessThan(2);
    expect(sampleHeight(500, 400)).toBeGreaterThan(1200);
    expect(sampleHeight(-2200, -1800)).toBeGreaterThan(40);
    expect(sampleHeight(-2200, -1800)).toBeLessThan(80);
    expect(sampleRegion(-2200, -1800)).toBe(Region.CITY);
    expect(sampleHeight(-3500, -1800)).toBeGreaterThan(40);
    expect(sampleHeight(-3500, -1800)).toBeLessThan(80);
    expect(sampleRegion(7900, 7500)).toBe(Region.WATER);
  });

  it("keeps a flat pad under the control tower", () => {
    const pad = sampleHeight(CONTROL_TOWER.x, CONTROL_TOWER.z);
    expect(pad).toBeGreaterThan(1600);
    expect(sampleHeight(CONTROL_TOWER.x + 15, CONTROL_TOWER.z)).toBeGreaterThan(1550);
    expect(controlTowerCeiling(CONTROL_TOWER.x, CONTROL_TOWER.z, pad)).toBe(pad + 55);
    expect(controlTowerCeiling(0, 0, pad)).toBeNull();
  });
});

describe("chunk streaming", () => {
  it("requests a bounded ring of chunks", () => {
    const need = neededChunks(0, 0);
    const side = STREAM_RADIUS * 2 + 1;
    expect(need.length).toBe(side * side);
  });

  it("lookahead adds chunks ahead of velocity without exploding the set", () => {
    const base = neededChunks(0, 0);
    const ahead = neededChunksLookahead(0, 0, { vx: 0, vz: -160, altitude: 400 });
    expect(ahead.length).toBeGreaterThanOrEqual(base.length);
    expect(ahead.length).toBeLessThanOrEqual((STREAM_RADIUS * 2 + 3) ** 2 + 40);
    const keys = new Set(ahead.map((c) => chunkKey(c.cx, c.cz)));
    expect(keys.size).toBe(ahead.length);
  });

  it("chunkResForDistance steps near → mid → far", () => {
    expect(chunkResForDistance(0)).toBe(CHUNK_RES);
    expect(chunkResForDistance(CHUNK_SIZE * 0.5)).toBe(CHUNK_RES);
    expect(chunkResForDistance(CHUNK_SIZE * 2)).toBe(CHUNK_RES_MID);
    expect(chunkResForDistance(CHUNK_SIZE * 5)).toBe(CHUNK_RES_FAR);
    expect(CHUNK_RES).toBeGreaterThan(CHUNK_RES_MID);
    expect(CHUNK_RES_MID).toBeGreaterThan(CHUNK_RES_FAR);
  });

  it("sortChunksByPriority prefers under-jet then ahead of velocity", () => {
    // Sit clearly inside a chunk (not on a boundary) so "under jet" is unambiguous.
    const wx = 250;
    const wz = 250;
    const motion = { vx: 0, vz: -200, altitude: 400 };
    const { cx: originCx, cz: originCz } = worldToChunk(wx, wz);
    const ring = neededChunks(wx, wz);
    const sorted = sortChunksByPriority(ring, wx, wz, motion);
    expect(sorted.length).toBe(ring.length);
    expect(sorted[0]).toEqual({ cx: originCx, cz: originCz });
    // An ahead chunk (negative Z) should rank before a behind chunk at similar ring distance.
    const ahead = sorted.find((c) => c.cz < originCz)!;
    const behind = sorted.find((c) => c.cz > originCz)!;
    expect(sorted.indexOf(ahead)).toBeLessThan(sorted.indexOf(behind));
  });

  it("cache does not grow unboundedly over a long flight path", () => {
    const cache = new ChunkCache((STREAM_RADIUS * 2 + 1) ** 2 + 8);
    // Simulate ~10 min at 60fps stepping forward — only check every 2s equivalent
    for (let t = 0; t < 300; t++) {
      const x = t * 80;
      const z = Math.sin(t * 0.05) * 2000;
      const keys = syncChunkKeys(x, z);
      for (const c of neededChunks(x, z)) {
        if (!cache.has(c.cx, c.cz)) {
          cache.set(generateChunkMesh(c.cx, c.cz, 8)); // coarse for test speed
        }
      }
      cache.retain(keys);
      expect(cache.size).toBeLessThanOrEqual(cache.maxEntries);
    }
  });
});

describe("places", () => {
  it("builds POIs and finds a nearest label", () => {
    const places = buildPlaces();
    expect(places.length).toBeGreaterThan(3);
    const near = nearestPlace(places[0]!.x, places[0]!.z, places);
    expect(near?.name.length).toBeGreaterThan(0);
  });
});
