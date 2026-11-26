import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { footprintInZone } from "./metroAirport";
import {
  COASTAL_CODE,
  PLAZA_D,
  PLAZA_W,
  STADIUM_CENTER,
  STADIUM_SEGMENTS,
  buildCoastalBlockout,
  coastZAt,
} from "./metroCoastal";
import { METRO_GRID_N, decodeMetroHeights, type MetroTerrainData } from "./metroGrid";

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
const coastal = buildCoastalBlockout(terrain);
const resorts = coastal.buildings.filter((b) => b.kind === "resort");

describe("Coastal blockout", () => {
  it("closes the stadium bowl with one stand per segment around the pitch", () => {
    const stands = coastal.buildings.filter((b) => b.kind === "stadium");
    expect(stands.length).toBe(STADIUM_SEGMENTS);
    for (const s of stands) {
      const r = Math.hypot(s.x - STADIUM_CENTER.x, s.z - STADIUM_CENTER.z);
      expect(r).toBeGreaterThan(80);
      expect(r).toBeLessThan(160);
      expect(s.yaw).toBeDefined();
    }
    const pitch = coastal.slabs.find((s) => s.kind === "pitch")!;
    expect(pitch.w).toBe(105);
    expect(pitch.d).toBe(68);
  });

  it("puts the stadium on Coastal ground, at least 600 m from the sea", () => {
    const plaza = coastal.slabs.find((s) => s.id === "stadium-plaza")!;
    expect(footprintInZone(terrain, plaza, COASTAL_CODE)).toBe(true);
    const coast = coastZAt(terrain, STADIUM_CENTER.x)!;
    expect(coast - (STADIUM_CENTER.z + PLAZA_D / 2)).toBeGreaterThanOrEqual(600);
  });

  it("keeps the beach, avenue and resorts on Coastal ground", () => {
    for (const s of coastal.slabs.filter((s) => s.kind === "sand" || s.kind === "road")) {
      expect(footprintInZone(terrain, s, COASTAL_CODE), s.id).toBe(true);
    }
    for (const b of resorts) {
      expect(footprintInZone(terrain, b, COASTAL_CODE), b.id).toBe(true);
    }
  });

  it("lines the shore with resorts between 30 and 90 m", () => {
    expect(resorts.length).toBeGreaterThanOrEqual(60);
    for (const b of resorts) {
      expect(b.h).toBeGreaterThanOrEqual(30);
      expect(b.h).toBeLessThanOrEqual(90);
    }
  });

  it("keeps resorts behind the avenue and clear of each other and the plaza", () => {
    const roads = coastal.slabs.filter((s) => s.kind === "road");
    const boxes = [
      ...resorts,
      { id: "plaza", x: STADIUM_CENTER.x, z: STADIUM_CENTER.z, w: PLAZA_W, d: PLAZA_D },
      ...roads,
    ];
    for (const r of resorts) {
      for (const o of boxes) {
        if (o === r) continue;
        const apart =
          Math.abs(r.x - o.x) >= (r.w + o.w) / 2 || Math.abs(r.z - o.z) >= (r.d + o.d) / 2;
        expect(apart, `${r.id} x ${o.id}`).toBe(true);
      }
    }
  });

  it("is deterministic", () => {
    expect(buildCoastalBlockout(terrain)).toEqual(coastal);
  });
});
