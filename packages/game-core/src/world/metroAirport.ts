import type { MetroBuilding } from "./metroDowntown";
import { metroZoneAt, sampleMetroHeight, type MetroTerrainData } from "./metroGrid";

export type MetroSlabKind = "runway" | "taxiway" | "apron" | "marking" | "pier";

/** Flat paved surface lying on the ground. No collision. */
export interface MetroSlab {
  id: string;
  kind: MetroSlabKind;
  x: number;
  z: number;
  /** Size along x and along z. */
  w: number;
  d: number;
  /** Bottom of the slab: highest ground under it, unless h is set. */
  base: number;
  /** Explicit thickness from base. When absent, the renderer uses a per-kind default. */
  h?: number;
}

export interface MetroAirportLayout {
  slabs: MetroSlab[];
  buildings: MetroBuilding[];
}

export const AIRPORT_CODE = 5;
/** Middle of the airfield, on the 9 m Airport plateau. */
export const AIRPORT_CENTER = { x: -859, z: -13266 } as const;
export const RUNWAY_LENGTH = 3000;
export const RUNWAY_WIDTH = 60;
/** Runway centrelines sit this far either side of the centre (1.6 km apart). */
export const RUNWAY_OFFSET = 800;
/** Distance from the runway threshold to the air start, along the centreline. */
const SPAWN_LEAD = 4000;

/** Air start on the west runway's extended centreline, nose up the runway (+Z) toward Downtown. */
export const METRO_AIRPORT_SPAWN = {
  x: AIRPORT_CENTER.x - RUNWAY_OFFSET,
  z: AIRPORT_CENTER.z - RUNWAY_LENGTH / 2 - SPAWN_LEAD,
  heading: Math.PI,
} as const;

interface Rect {
  id: string;
  x: number;
  z: number;
  w: number;
  d: number;
}

/** Ground probes across a footprint: a 3-wide row every ~100 m along the long side. */
function probes(r: Rect): (readonly [number, number])[] {
  const long = Math.max(r.w, r.d);
  const steps = Math.max(2, Math.ceil(long / 100));
  const out: (readonly [number, number])[] = [];
  for (let a = 0; a <= steps; a++) {
    for (let b = 0; b <= 2; b++) {
      const u = a / steps - 0.5;
      const v = b / 2 - 0.5;
      out.push(
        r.w >= r.d
          ? [r.x + u * r.w, r.z + v * r.d]
          : [r.x + v * r.w, r.z + u * r.d],
      );
    }
  }
  return out;
}

/** Highest ground under a footprint. */
export function groundUnder(t: MetroTerrainData, r: Rect): number {
  let base = -Infinity;
  for (const [x, z] of probes(r)) base = Math.max(base, sampleMetroHeight(t, x, z));
  return base;
}

/** Lowest and highest ground under a footprint. */
export function groundRange(t: MetroTerrainData, r: Rect): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const [x, z] of probes(r)) {
    const h = sampleMetroHeight(t, x, z);
    min = Math.min(min, h);
    max = Math.max(max, h);
  }
  return { min, max };
}

/** True when every probe of the footprint lies in the given zone. */
export function footprintInZone(t: MetroTerrainData, r: Rect, code: number): boolean {
  return probes(r).every(([x, z]) => metroZoneAt(t, x, z) === code);
}

/**
 * Airport blockout: two parallel 3,000 m runways along z, a parallel taxiway
 * inside each, the apron and terminal between them, the control tower on the
 * apron, hangars at the north end and maintenance at the south end.
 * Fixed layout, no randomness.
 */
export function buildAirportBlockout(t: MetroTerrainData): MetroAirportLayout {
  const { x: cx, z: cz } = AIRPORT_CENTER;
  const half = RUNWAY_LENGTH / 2;
  const slabs: MetroSlab[] = [];
  const buildings: MetroBuilding[] = [];

  const slab = (kind: MetroSlab["kind"], r: Rect): void => {
    slabs.push({ ...r, kind, base: groundUnder(t, r) });
  };
  const building = (
    kind: MetroBuilding["kind"],
    r: Rect,
    h: number,
    lift = 0,
  ): void => {
    buildings.push({ ...r, kind, h, base: groundUnder(t, r) + lift });
  };

  for (const side of [-1, 1] as const) {
    const tag = side < 0 ? "w" : "e";
    const rx = cx + side * RUNWAY_OFFSET;
    const tx = cx + side * (RUNWAY_OFFSET - 190);
    slab("runway", { id: `rwy-${tag}`, x: rx, z: cz, w: RUNWAY_WIDTH, d: RUNWAY_LENGTH });
    slab("taxiway", { id: `twy-${tag}`, x: tx, z: cz, w: 23, d: RUNWAY_LENGTH });
    for (const [k, dz] of [[0, -half + 60], [1, 0], [2, half - 60]] as const) {
      slab("taxiway", {
        id: `twy-${tag}-link-${k}`,
        x: (rx + tx) / 2,
        z: cz + dz,
        w: 190,
        d: 23,
      });
    }
    for (const [k, dz] of [[0, -600], [1, 600]] as const) {
      slab("taxiway", {
        id: `twy-${tag}-apron-${k}`,
        x: cx + side * 559,
        z: cz + dz,
        w: 80,
        d: 30,
      });
    }
    slab("marking", {
      id: `rwy-${tag}-centre`,
      x: rx,
      z: cz,
      w: 3,
      d: RUNWAY_LENGTH - 200,
    });
    for (const end of [-1, 1] as const) {
      slab("marking", {
        id: `rwy-${tag}-threshold-${end < 0 ? "s" : "n"}`,
        x: rx,
        z: cz + end * (half - 40),
        w: 40,
        d: 30,
      });
    }
  }

  slab("apron", { id: "apron", x: cx, z: cz, w: 1040, d: 1800 });

  building("terminal", { id: "terminal", x: cx, z: cz, w: 140, d: 1000 }, 24);
  const towerX = cx + 380;
  const towerZ = cz + 700;
  building("control", { id: "atc-shaft", x: towerX, z: towerZ, w: 14, d: 14 }, 70);
  building("control", { id: "atc-cab", x: towerX, z: towerZ, w: 28, d: 28 }, 12, 70);
  for (const [k, dx] of [[0, -340], [1, 0], [2, 340]] as const) {
    building("hangar", { id: `hangar-${k}`, x: cx + dx, z: cz + 1180, w: 220, d: 120 }, 30);
  }
  for (const [k, dx] of [[0, -260], [1, 260]] as const) {
    building("hangar", { id: `maintenance-${k}`, x: cx + dx, z: cz - 1200, w: 300, d: 100 }, 18);
  }

  return { slabs, buildings };
}
