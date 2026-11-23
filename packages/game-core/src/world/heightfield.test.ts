import { describe, expect, it } from "vitest";
import { ChunkCache, syncChunkKeys } from "./streaming";
import {
  generateChunkMesh,
  neededChunks,
  neededChunksLookahead,
  STREAM_RADIUS,
  chunkKey,
} from "./chunk";
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
    expect(sampleHeight(-1800, -900)).toBeGreaterThan(20);
    expect(sampleHeight(-1800, -900)).toBeLessThan(120);
    expect(sampleRegion(-1800, -900)).toBe(Region.CITY);
    expect(sampleRegion(7900, 7500)).toBe(Region.WATER);
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
