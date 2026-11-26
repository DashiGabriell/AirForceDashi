import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import {
  METRO_CIRCLE_R,
  METRO_GRID_N,
  METRO_H_MAX,
  METRO_STEP,
  METRO_ZONE_RGB,
  decodeMetroHeights,
  metroRawToMetres,
  metroZoneAt,
  sampleMetroHeight,
  type MetroTerrainData,
} from "./metroGrid";

const DIR = fileURLToPath(
  new URL("../../../../assets/maps/metropolitan/", import.meta.url),
);
const N = METRO_GRID_N;

const terrain: MetroTerrainData = {
  n: N,
  heights: decodeMetroHeights(
    new Uint8Array(gunzipSync(readFileSync(DIR + "heightmap_2049.u16.gz"))),
    N,
  ),
  zones: new Uint8Array(gunzipSync(readFileSync(DIR + "zoning_2049.u8.gz"))),
};

function nodeX(i: number): number {
  return -METRO_CIRCLE_R + i * METRO_STEP;
}

describe("metroGrid", () => {
  it("decodes a full grid of heights and zones", () => {
    expect(terrain.heights.length).toBe(N * N);
    expect(terrain.zones.length).toBe(N * N);
  });

  it("returns the stored value at a grid node", () => {
    const i = 100;
    const j = 200;
    const raw = terrain.heights[j * N + i]!;
    expect(sampleMetroHeight(terrain, nodeX(i), nodeX(j))).toBeCloseTo(
      metroRawToMetres(raw),
      6,
    );
  });

  it("interpolates halfway between two neighbouring nodes", () => {
    const i = 300;
    const j = 400;
    const a = metroRawToMetres(terrain.heights[j * N + i]!);
    const b = metroRawToMetres(terrain.heights[j * N + i + 1]!);
    const mid = sampleMetroHeight(terrain, nodeX(i) + METRO_STEP / 2, nodeX(j));
    expect(mid).toBeCloseTo((a + b) / 2, 6);
  });

  it("clamps outside the grid to the nearest corner", () => {
    const corner = metroRawToMetres(terrain.heights[0]!);
    expect(sampleMetroHeight(terrain, -1e7, -1e7)).toBeCloseTo(corner, 6);
    const far = metroRawToMetres(terrain.heights[N * N - 1]!);
    expect(sampleMetroHeight(terrain, 1e7, 1e7)).toBeCloseTo(far, 6);
  });

  it("stays within 0..200 m", () => {
    let max = 0;
    for (let k = 0; k < terrain.heights.length; k++) {
      max = Math.max(max, terrain.heights[k]!);
    }
    expect(metroRawToMetres(max)).toBeLessThanOrEqual(METRO_H_MAX);
  });

  it("reads the ocean at the corner and the airport at the spawn", () => {
    expect(metroZoneAt(terrain, -METRO_CIRCLE_R, -METRO_CIRCLE_R)).toBe(0);
    // Test spawn at the airport (-859, -13266).
    expect(metroZoneAt(terrain, -859, -13266)).toBe(5);
  });

  it("puts the test towers in Downtown on its 12 m plateau", () => {
    for (const [x, z] of [
      [-650, -5000],
      [-300, -5000],
      [-470, -5250],
      [-470, -4850],
    ] as const) {
      expect(metroZoneAt(terrain, x, z)).toBe(1);
      expect(Math.abs(sampleMetroHeight(terrain, x, z) - 12)).toBeLessThan(1.5);
    }
  });

  it("has a color for every zone code 0..8", () => {
    for (let c = 0; c <= 8; c++) {
      expect(METRO_ZONE_RGB[c]).toBeDefined();
    }
  });

  it("rejects a heightmap of the wrong size", () => {
    expect(() => decodeMetroHeights(new Uint8Array(10), N)).toThrow();
  });
});
