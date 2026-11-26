import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { DOWNTOWN_CENTER, buildDowntownBlockout } from "./metroDowntown";
import { METRO_GRID_N, decodeMetroHeights, metroZoneAt, type MetroTerrainData } from "./metroGrid";

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
const city = buildDowntownBlockout(terrain);

describe("Downtown blockout", () => {
  it("is deterministic", () => {
    expect(buildDowntownBlockout(terrain)).toEqual(city);
  });

  it("stays inside the instance budget", () => {
    expect(city.length).toBeGreaterThanOrEqual(350);
    expect(city.length).toBeLessThanOrEqual(420);
  });

  it("has exactly five icons between 250 and 450 m", () => {
    const icons = city.filter((b) => b.kind === "icon");
    expect(icons.length).toBe(5);
    for (const b of icons) {
      expect(b.h).toBeGreaterThanOrEqual(250);
      expect(b.h).toBeLessThanOrEqual(450);
    }
  });

  it("only lets the icons pass 200 m", () => {
    for (const b of city) if (b.kind !== "icon") expect(b.h).toBeLessThanOrEqual(200);
  });

  it("has 50 to 60 skyscrapers, with towers between 80 and 200 m", () => {
    const towers = city.filter((b) => b.kind === "tower");
    for (const b of towers) {
      expect(b.h).toBeGreaterThanOrEqual(80);
      expect(b.h).toBeLessThanOrEqual(200);
    }
    const skyscrapers = towers.length + city.filter((b) => b.kind === "icon").length;
    expect(skyscrapers).toBeGreaterThanOrEqual(50);
    expect(skyscrapers).toBeLessThanOrEqual(60);
  });

  it("keeps every footprint corner in Downtown", () => {
    for (const b of city) {
      for (const [x, z] of [
        [b.x - b.w / 2, b.z - b.d / 2],
        [b.x + b.w / 2, b.z - b.d / 2],
        [b.x - b.w / 2, b.z + b.d / 2],
        [b.x + b.w / 2, b.z + b.d / 2],
      ] as const) {
        expect(metroZoneAt(terrain, x, z), b.id).toBe(1);
      }
    }
  });

  it("leaves at least 60 m of street between any two buildings", () => {
    for (let a = 0; a < city.length; a++) {
      for (let b = a + 1; b < city.length; b++) {
        const p = city[a]!;
        const q = city[b]!;
        const gapX = Math.abs(p.x - q.x) - (p.w + q.w) / 2;
        const gapZ = Math.abs(p.z - q.z) - (p.d + q.d) / 2;
        expect(Math.max(gapX, gapZ), `${p.id} x ${q.id}`).toBeGreaterThanOrEqual(60);
      }
    }
  });

  it("keeps the main avenues clear through the centre", () => {
    for (const b of city) {
      const nearX = Math.abs(b.x - DOWNTOWN_CENTER.x) - b.w / 2;
      const nearZ = Math.abs(b.z - DOWNTOWN_CENTER.z) - b.d / 2;
      expect(nearX, b.id).toBeGreaterThanOrEqual(60);
      expect(nearZ, b.id).toBeGreaterThanOrEqual(60);
    }
  });

  it("puts the tallest buildings near the centre", () => {
    const dist = (b: (typeof city)[number]): number =>
      Math.hypot(b.x - DOWNTOWN_CENTER.x, b.z - DOWNTOWN_CENTER.z);
    const tall = city.filter((b) => b.h >= 150);
    const low = city.filter((b) => b.kind === "low");
    const mean = (xs: number[]): number => xs.reduce((s, v) => s + v, 0) / xs.length;
    expect(mean(tall.map(dist))).toBeLessThan(mean(low.map(dist)));
  });

  it("sits on the ground", () => {
    for (const b of city) {
      expect(b.base).toBeGreaterThanOrEqual(0);
      expect(b.base).toBeLessThan(40);
    }
  });
});
