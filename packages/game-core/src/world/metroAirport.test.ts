import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import {
  AIRPORT_CODE,
  METRO_AIRPORT_SPAWN,
  RUNWAY_LENGTH,
  buildAirportBlockout,
  footprintInZone,
} from "./metroAirport";
import { buildDowntownBlockout } from "./metroDowntown";
import {
  METRO_CIRCLE_R,
  METRO_GRID_N,
  decodeMetroHeights,
  sampleMetroHeight,
  type MetroTerrainData,
} from "./metroGrid";

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
const airport = buildAirportBlockout(terrain);
const runways = airport.slabs.filter((s) => s.kind === "runway");

interface Box {
  x: number;
  z: number;
  w: number;
  d: number;
}

function overlaps(a: Box, b: Box): boolean {
  return (
    Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.z - b.z) < (a.d + b.d) / 2
  );
}

describe("Airport blockout", () => {
  it("has two parallel 3,000 m runways at least 1 km apart", () => {
    expect(runways.length).toBe(2);
    for (const r of runways) expect(r.d).toBe(RUNWAY_LENGTH);
    expect(Math.abs(runways[0]!.x - runways[1]!.x)).toBeGreaterThanOrEqual(1000);
    expect(runways[0]!.z).toBe(runways[1]!.z);
  });

  it("keeps every slab and building inside the Airport zone", () => {
    for (const s of airport.slabs) {
      expect(footprintInZone(terrain, s, AIRPORT_CODE), s.id).toBe(true);
    }
    for (const b of airport.buildings) {
      expect(footprintInZone(terrain, b, AIRPORT_CODE), b.id).toBe(true);
    }
  });

  it("lays the runways on flat ground", () => {
    for (const r of runways) {
      let min = Infinity;
      let max = -Infinity;
      for (let z = r.z - r.d / 2; z <= r.z + r.d / 2; z += 25) {
        for (const x of [r.x - r.w / 2, r.x, r.x + r.w / 2]) {
          const h = sampleMetroHeight(terrain, x, z);
          min = Math.min(min, h);
          max = Math.max(max, h);
        }
      }
      expect(max - min, r.id).toBeLessThan(0.5);
    }
  });

  it("builds nothing on runways or taxiways", () => {
    const paved = airport.slabs.filter((s) => s.kind === "runway" || s.kind === "taxiway");
    for (const b of airport.buildings) {
      for (const s of paved) expect(overlaps(b, s), `${b.id} x ${s.id}`).toBe(false);
    }
  });

  it("has a control tower taller than 60 m", () => {
    const shaft = airport.buildings.find((b) => b.id === "atc-shaft")!;
    const top = Math.max(
      ...airport.buildings.filter((b) => b.kind === "control").map((b) => b.base + b.h),
    );
    expect(top - sampleMetroHeight(terrain, shaft.x, shaft.z)).toBeGreaterThan(60);
  });

  it("does not collide with Downtown", () => {
    const downtown = buildDowntownBlockout(terrain);
    for (const b of airport.buildings) {
      for (const d of downtown) expect(overlaps(b, d), `${b.id} x ${d.id}`).toBe(false);
    }
  });

  it("starts the flight on a runway's extended centreline, nose up the runway", () => {
    const r = runways.find((s) => s.x === METRO_AIRPORT_SPAWN.x);
    expect(r).toBeDefined();
    expect(METRO_AIRPORT_SPAWN.z).toBeLessThan(r!.z - r!.d / 2);
    expect(METRO_AIRPORT_SPAWN.heading).toBe(Math.PI);
    expect(Math.hypot(METRO_AIRPORT_SPAWN.x, METRO_AIRPORT_SPAWN.z)).toBeLessThan(
      METRO_CIRCLE_R - 2000,
    );
  });

  it("is deterministic", () => {
    expect(buildAirportBlockout(terrain)).toEqual(airport);
  });
});
