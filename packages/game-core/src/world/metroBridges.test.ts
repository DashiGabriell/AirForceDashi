import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { buildAirportBlockout } from "./metroAirport";
import {
  METRO_GATE_RADIUS,
  buildBridgesBlockout,
  buildMetroCheckpoint,
  footprintHalfExtents,
} from "./metroBridges";
import { buildCoastalBlockout } from "./metroCoastal";
import { buildDowntownBlockout, type MetroBuilding } from "./metroDowntown";
import {
  METRO_CIRCLE_R,
  METRO_GRID_N,
  METRO_STEP,
  decodeMetroHeights,
  metroZoneAt,
  sampleMetroHeight,
  type MetroTerrainData,
} from "./metroGrid";
import { buildHarborBlockout } from "./metroHarbor";

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
const layout = buildBridgesBlockout(terrain);
const gates = buildMetroCheckpoint(layout.bridges);
const others: MetroBuilding[] = [
  ...buildDowntownBlockout(terrain),
  ...buildAirportBlockout(terrain).buildings,
  ...buildHarborBlockout(terrain).buildings,
  ...buildCoastalBlockout(terrain).buildings,
];
const bridge = (id: string) => layout.bridges.find((b) => b.id === id)!;

describe("Metropolitan bridges", () => {
  it("spans each canal between the regions it links", () => {
    const expected: Record<string, [number, number]> = {
      "bridge-west": [3, 1],
      "bridge-east": [1, 2],
      "bridge-harbor": [7, 6],
    };
    expect(layout.bridges.map((b) => b.id).sort()).toEqual(Object.keys(expected).sort());
    for (const b of layout.bridges) {
      expect(metroZoneAt(terrain, b.x, b.z), b.id).toBe(0);
      expect([b.from, b.to], b.id).toEqual(expected[b.id]);
      expect(b.span, b.id).toBeGreaterThan(300);
      expect(b.span, b.id).toBeLessThan(700);
    }
  });

  it("keeps ship clearance under the Harbor deck", () => {
    expect(bridge("bridge-harbor").deckTop).toBeGreaterThanOrEqual(45);
    expect(bridge("bridge-west").deckTop).toBeGreaterThanOrEqual(25);
  });

  it("lands both ramps of every bridge on the ground", () => {
    for (const b of layout.bridges) {
      const decks = layout.buildings.filter(
        (p) => p.id.startsWith(`${b.id}-`) && p.kind === "deck",
      );
      for (const p of decks) {
        expect(p.base, p.id).toBeGreaterThanOrEqual(sampleMetroHeight(terrain, p.x, p.z) - 0.5);
      }
      const landed = decks.filter((p) => p.base - sampleMetroHeight(terrain, p.x, p.z) < 2);
      const sides = new Set(landed.map((p) => Math.sign((p.x - b.x) * b.ax + (p.z - b.z) * b.az)));
      expect(sides.size, b.id).toBe(2);
    }
  });

  it("opens the Harbor–Coastal canal to the sea", () => {
    const n = METRO_GRID_N;
    const b = bridge("bridge-harbor");
    const cell = (x: number) => Math.round((x + METRO_CIRCLE_R) / METRO_STEP);
    const seen = new Uint8Array(n * n);
    const queue = [cell(b.z) * n + cell(b.x)];
    seen[queue[0]!] = 1;
    let reached = false;
    for (let q = 0; q < queue.length && !reached && q < 400000; q++) {
      const k = queue[q]!;
      const x = -METRO_CIRCLE_R + (k % n) * METRO_STEP;
      const z = -METRO_CIRCLE_R + Math.floor(k / n) * METRO_STEP;
      if (Math.abs(x) > 20000 || Math.abs(z) > 20000) reached = true;
      for (const nb of [k + 1, k - 1, k + n, k - n]) {
        if (nb < 0 || nb >= n * n || seen[nb] || terrain.zones[nb] !== 0) continue;
        seen[nb] = 1;
        queue.push(nb);
      }
    }
    expect(reached).toBe(true);
  });

  it("stays clear of the other blockouts", () => {
    const clashes: string[] = [];
    for (const p of layout.buildings) {
      const a = footprintHalfExtents(p);
      for (const o of others) {
        const e = footprintHalfExtents(o);
        const apart = Math.abs(p.x - o.x) >= a.hx + e.hx || Math.abs(p.z - o.z) >= a.hz + e.hz;
        if (!apart) clashes.push(`${p.id} x ${o.id}`);
      }
    }
    expect(clashes).toEqual([]);
  });

  it("is deterministic", () => {
    expect(buildBridgesBlockout(terrain)).toEqual(layout);
  });
});

describe("Metropolitan CheckPoint course", () => {
  it("runs 12 gates from the Airport to the Harbor between 150 and 400 m", () => {
    expect(gates.length).toBe(12);
    expect(metroZoneAt(terrain, gates[0]!.x, gates[0]!.z)).toBe(5);
    expect(metroZoneAt(terrain, gates[11]!.x, gates[11]!.z)).toBe(6);
    for (const g of gates) {
      expect(g.y).toBeGreaterThanOrEqual(150);
      expect(g.y).toBeLessThanOrEqual(400);
      expect(g.radius).toBe(METRO_GATE_RADIUS);
      expect(Math.hypot(g.nx, g.ny, g.nz)).toBeCloseTo(1, 6);
    }
  });

  it("crosses the three bridges in order, along their decks", () => {
    for (const [i, id] of [[4, "bridge-west"], [6, "bridge-east"], [10, "bridge-harbor"]] as const) {
      const g = gates[i]!;
      const b = bridge(id);
      expect(Math.hypot(g.x - b.x, g.z - b.z)).toBeLessThan(1);
      expect(g.nx * b.ax + g.nz * b.az).toBeCloseTo(1, 6);
    }
  });

  it("keeps every gate clear of the ground and of every volume", () => {
    const all = [...others, ...layout.buildings];
    const clashes: string[] = [];
    for (const [i, g] of gates.entries()) {
      const bottom = g.y - g.radius;
      expect(bottom - sampleMetroHeight(terrain, g.x, g.z), `gate ${i}`).toBeGreaterThan(60);
      for (const o of all) {
        const e = footprintHalfExtents(o);
        const dx = Math.max(0, Math.abs(g.x - o.x) - e.hx);
        const dz = Math.max(0, Math.abs(g.z - o.z) - e.hz);
        if (Math.hypot(dx, dz) > g.radius + 5) continue;
        if (o.base + o.h >= bottom - 10) clashes.push(`gate ${i} x ${o.id}`);
      }
    }
    expect(clashes).toEqual([]);
  });

  it("never turns more than 100 degrees from one gate to the next", () => {
    for (let i = 1; i < gates.length; i++) {
      const a = gates[i - 1]!;
      const b = gates[i]!;
      const cos = a.nx * b.nx + a.nz * b.nz;
      expect(cos, `gate ${i}`).toBeGreaterThan(Math.cos((100 * Math.PI) / 180));
    }
  });
});
