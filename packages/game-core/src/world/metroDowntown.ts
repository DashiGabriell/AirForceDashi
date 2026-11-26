import { metroZoneAt, sampleMetroHeight, type MetroTerrainData } from "./metroGrid";

export type MetroBuildingKind = "icon" | "tower" | "mid" | "low";

export interface MetroBuilding {
  id: string;
  kind: MetroBuildingKind;
  /** Footprint centre, metres. */
  x: number;
  z: number;
  /** Footprint size along x and along z. */
  w: number;
  d: number;
  /** Height above the base. */
  h: number;
  /** Highest ground under the footprint, so no corner floats. */
  base: number;
}

const DOWNTOWN_CODE = 1;
/** Crossing of the two main avenues, on the 12 m Downtown plateau. */
export const DOWNTOWN_CENTER = { x: -400, z: -5000 } as const;
/** Block centre to block centre. */
const PITCH = 260;
/** Buildable block side. Regular streets are PITCH - BLOCK = 80 m wide. */
const BLOCK = 180;
/** The two main avenues through the centre are 80 m wider (160 m). */
const AVENUE_EXTRA = 80;
const GRID_HALF = 12;
const MAX_RADIUS = 3200;
const PLAZA_CHANCE = 0.08;
const PLAZA_MIN_DIST = 600;

/** The five landmarks around the main crossing. Only these pass 200 m. */
const ICONS: readonly { bi: number; bj: number; h: number }[] = [
  { bi: -1, bj: -1, h: 450 },
  { bi: 0, bj: -1, h: 400 },
  { bi: -1, bj: 0, h: 350 },
  { bi: 0, bj: 0, h: 300 },
  { bi: 1, bj: 1, h: 260 },
];
/** Commercial towers, 80–200 m, nearest the centre after the icons. */
export const DOWNTOWN_TOWERS = 30;
const MID_COUNT = 120;
const LOW_COUNT = 80;

const FOOTPRINT: Record<MetroBuildingKind, readonly [number, number]> = {
  icon: [70, 90],
  tower: [50, 80],
  mid: [90, 150],
  low: [110, 170],
};

function rand(i: number, j: number, salt: number): number {
  let h =
    Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(salt, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Blocks sit on a half-offset grid, so both main avenues run through the centre. */
function blockCentre(bi: number, bj: number): { x: number; z: number } {
  const off = (b: number): number =>
    (b + 0.5) * PITCH + Math.sign(b + 0.5) * AVENUE_EXTRA * 0.5;
  return { x: DOWNTOWN_CENTER.x + off(bi), z: DOWNTOWN_CENTER.z + off(bj) };
}

function place(
  t: MetroTerrainData,
  bi: number,
  bj: number,
  kind: MetroBuildingKind,
  h: number,
): MetroBuilding | null {
  const c = blockCentre(bi, bj);
  const [lo, hi] = FOOTPRINT[kind];
  const w = lerp(lo, hi, rand(bi, bj, 11));
  const d = lerp(lo, hi, rand(bi, bj, 12));
  const x = c.x + (BLOCK - w) * 0.25 * (rand(bi, bj, 13) * 2 - 1);
  const z = c.z + (BLOCK - d) * 0.25 * (rand(bi, bj, 14) * 2 - 1);
  const probes: readonly (readonly [number, number])[] = [
    [x, z],
    [x - w / 2, z - d / 2],
    [x + w / 2, z - d / 2],
    [x - w / 2, z + d / 2],
    [x + w / 2, z + d / 2],
  ];
  let base = -Infinity;
  for (const [px, pz] of probes) {
    if (metroZoneAt(t, px, pz) !== DOWNTOWN_CODE) return null;
    base = Math.max(base, sampleMetroHeight(t, px, pz));
  }
  return { id: `dt-${kind}-${bi}-${bj}`, kind, x, z, w, d, h, base };
}

/**
 * Downtown blockout: five icons around the main crossing, then commercial
 * towers, mid-rise and low-rise blocks by distance from the centre, so the
 * skyline peaks in the middle. One building per block; some blocks stay empty
 * as plazas. Deterministic for a given terrain.
 */
export function buildDowntownBlockout(t: MetroTerrainData): MetroBuilding[] {
  const out: MetroBuilding[] = [];
  const iconBlocks = new Set<string>();
  for (const icon of ICONS) {
    iconBlocks.add(`${icon.bi},${icon.bj}`);
    const b = place(t, icon.bi, icon.bj, "icon", icon.h);
    if (b) out.push(b);
  }

  const blocks: { bi: number; bj: number; dist: number }[] = [];
  for (let bj = -GRID_HALF; bj < GRID_HALF; bj++) {
    for (let bi = -GRID_HALF; bi < GRID_HALF; bi++) {
      if (iconBlocks.has(`${bi},${bj}`)) continue;
      const c = blockCentre(bi, bj);
      const dist = Math.hypot(c.x - DOWNTOWN_CENTER.x, c.z - DOWNTOWN_CENTER.z);
      if (dist > MAX_RADIUS) continue;
      if (dist > PLAZA_MIN_DIST && rand(bi, bj, 7) < PLAZA_CHANCE) continue;
      blocks.push({ bi, bj, dist });
    }
  }
  blocks.sort((a, b) => a.dist - b.dist || a.bj - b.bj || a.bi - b.bi);

  let towers = 0;
  let mids = 0;
  let lows = 0;
  for (const { bi, bj } of blocks) {
    const jitter = rand(bi, bj, 21) - 0.5;
    let b: MetroBuilding | null;
    if (towers < DOWNTOWN_TOWERS) {
      const h = clamp(lerp(200, 90, towers / (DOWNTOWN_TOWERS - 1)) + jitter * 20, 80, 200);
      b = place(t, bi, bj, "tower", h);
      if (b) towers++;
    } else if (mids < MID_COUNT) {
      const h = clamp(lerp(78, 35, mids / (MID_COUNT - 1)) + jitter * 16, 30, 78);
      b = place(t, bi, bj, "mid", h);
      if (b) mids++;
    } else if (lows < LOW_COUNT) {
      b = place(t, bi, bj, "low", 18 + 22 * rand(bi, bj, 22));
      if (b) lows++;
    } else {
      break;
    }
    if (b) out.push(b);
  }
  return out;
}
