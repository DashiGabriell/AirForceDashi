import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { footprintInZone } from "./metroAirport";
import { METRO_CIRCLE_R, METRO_GRID_N, decodeMetroHeights, type MetroTerrainData } from "./metroGrid";
import { HARBOR_CODE, HARBOR_PIERS_Z, buildHarborBlockout } from "./metroHarbor";

const DIR = fileURLToPath(
  new URL("../../../../assets/maps/metropolitan/", import.meta.url),
);
const terrain: MetroTerrainData = {
  n: METRO_GRID_N,
  heights: decodeMetroHeights(
    new Uint8Array(gunzipSync(readFileSync(DIR + "heightmap_2049.u16.gz"))),
    METRO_GRID_N,
  ),
  zones: new Uint8Array(gunzipSync(readFileSync(DIR + "zoning_2049.u8.gz"))),
};
const harbor = buildHarborBlockout(terrain);
const WATER = 0;

const onLand = harbor.buildings.filter(
  (b) => b.kind === "container" || b.kind === "warehouse",
);

describe("Harbor blockout", () => {
  it("keeps the quay, yard, containers and warehouses on Harbor ground", () => {
    for (const s of harbor.slabs.filter((s) => s.kind === "apron")) {
      expect(footprintInZone(terrain, s, HARBOR_CODE), s.id).toBe(true);
    }
    for (const b of onLand) {
      expect(footprintInZone(terrain, b, HARBOR_CODE), b.id).toBe(true);
    }
  });

  it("runs every pier from the quay into the sea", () => {
    const piers = harbor.slabs.filter((s) => s.kind === "pier");
    expect(piers.length).toBe(HARBOR_PIERS_Z.length);
    for (const p of piers) {
      const seaEnd = { id: p.id, x: p.x + p.w / 2 - 20, z: p.z, w: 20, d: p.d };
      expect(footprintInZone(terrain, seaEnd, WATER), p.id).toBe(true);
    }
  });

  it("floats the ships on water", () => {
    for (const b of harbor.buildings.filter((b) => b.kind === "ship")) {
      expect(footprintInZone(terrain, b, WATER), b.id).toBe(true);
      expect(b.base).toBe(0);
    }
  });

  it("sets the pier deck level with the quay", () => {
    const quay = harbor.slabs.find((s) => s.id === "quay")!;
    const quayTop = quay.base + quay.h!;
    for (const p of harbor.slabs.filter((s) => s.kind === "pier")) {
      expect(p.base + p.h!).toBeCloseTo(quayTop, 6);
    }
  });

  it("has two cranes per pier side, booms at least 45 m above the water", () => {
    const booms = harbor.buildings.filter((b) => b.id.endsWith("-boom"));
    expect(booms.length).toBe(HARBOR_PIERS_Z.length * 4);
    for (const b of booms) expect(b.base).toBeGreaterThanOrEqual(45);
  });

  it("does not overlap buildings on land", () => {
    for (let a = 0; a < onLand.length; a++) {
      for (let c = a + 1; c < onLand.length; c++) {
        const p = onLand[a]!;
        const q = onLand[c]!;
        const apart =
          Math.abs(p.x - q.x) >= (p.w + q.w) / 2 || Math.abs(p.z - q.z) >= (p.d + q.d) / 2;
        expect(apart, `${p.id} x ${q.id}`).toBe(true);
      }
    }
  });

  it("stays inside the world circle", () => {
    for (const s of harbor.slabs) {
      expect(Math.hypot(s.x + s.w / 2, s.z)).toBeLessThan(METRO_CIRCLE_R - 2000);
    }
  });

  it("is deterministic", () => {
    expect(buildHarborBlockout(terrain)).toEqual(harbor);
  });
});
