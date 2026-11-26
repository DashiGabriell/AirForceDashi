import { footprintInZone, groundRange, groundUnder, type MetroSlab } from "./metroAirport";
import type { MetroBuilding } from "./metroDowntown";
import { metroZoneAt, type MetroTerrainData } from "./metroGrid";

export interface MetroCoastalLayout {
  slabs: MetroSlab[];
  buildings: MetroBuilding[];
}

export const COASTAL_CODE = 7;
/** Stadium centre, ~1.2 km inland on the 6 m Coastal plateau. */
export const STADIUM_CENTER = { x: 2000, z: 13900 } as const;
/** Stand centreline ellipse, metres. */
const STAND_A = 135;
const STAND_B = 110;
const STAND_DEPTH = 40;
const STAND_H = 42;
export const STADIUM_SEGMENTS = 28;
const ROOF_INSET = 14;
const ROOF_DEPTH = 34;
const ROOF_H = 6;
export const PLAZA_W = 560;
export const PLAZA_D = 460;

/** Waterfront runs along the south coast, between these x. */
const WATERFRONT_X_MIN = -2000;
const WATERFRONT_X_MAX = 12000;
const STRIP_STEP = 250;
const SEA_MARGIN = 10;
const BEACH_DEPTH = 80;
const ROAD_GAP = 20;
const ROAD_W = 30;
const RESORT_SETBACK = 30;
const RESORT_PITCH = 160;

function rand(i: number, salt: number): number {
  let h = Math.imul(i, 374761393) ^ Math.imul(salt, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** z of the first land cell met coming in from the sea at +z, if that land is Coastal. */
export function coastZAt(t: MetroTerrainData, x: number): number | null {
  for (let z = 19990; z > 0; z -= 10) {
    const code = metroZoneAt(t, x, z);
    if (code !== 0) return code === COASTAL_CODE ? z : null;
  }
  return null;
}

/** Lowest coast z over [x0, x1], so a strip set back from it never reaches the water. */
function coastMin(t: MetroTerrainData, x0: number, x1: number): number | null {
  let min = Infinity;
  for (let x = x0; x <= x1 + 0.5; x += 25) {
    const z = coastZAt(t, x);
    if (z === null) return null;
    min = Math.min(min, z);
  }
  return min;
}

/**
 * Coastal blockout: the stadium (oval stands of rotated segments, roof ring,
 * pitch, plaza, floodlight masts) and a waterfront that follows the real
 * coastline: beach, beachfront avenue and a row of resort towers.
 * Deterministic for a given terrain.
 */
export function buildCoastalBlockout(t: MetroTerrainData): MetroCoastalLayout {
  const slabs: MetroSlab[] = [];
  const buildings: MetroBuilding[] = [];

  /** Slab from the lowest ground up to the highest plus thickness. Returns its top. */
  const groundSlab = (
    kind: MetroSlab["kind"],
    id: string,
    x: number,
    z: number,
    w: number,
    d: number,
    thickness: number,
  ): number => {
    const r = { id, x, z, w, d };
    const { min, max } = groundRange(t, r);
    slabs.push({ ...r, kind, base: min, h: max - min + thickness });
    return max + thickness;
  };

  const { x: sx, z: sz } = STADIUM_CENTER;
  const plazaTop = groundSlab("apron", "stadium-plaza", sx, sz, PLAZA_W, PLAZA_D, 0.6);
  slabs.push({ id: "stadium-pitch", kind: "pitch", x: sx, z: sz, w: 105, d: 68, base: plazaTop, h: 0.3 });

  const ring = (a: number, b: number, angle: number): { x: number; z: number } => ({
    x: sx + a * Math.cos(angle),
    z: sz + b * Math.sin(angle),
  });
  for (let k = 0; k < STADIUM_SEGMENTS; k++) {
    const a0 = (k / STADIUM_SEGMENTS) * Math.PI * 2;
    const a1 = ((k + 1) / STADIUM_SEGMENTS) * Math.PI * 2;
    const am = (a0 + a1) / 2;
    for (const [kind, inset, depth, base, h] of [
      ["stadium", 0, STAND_DEPTH, plazaTop, STAND_H],
      ["canopy", ROOF_INSET, ROOF_DEPTH, plazaTop + STAND_H - 1, ROOF_H],
    ] as const) {
      const p0 = ring(STAND_A - inset, STAND_B - inset, a0);
      const p1 = ring(STAND_A - inset, STAND_B - inset, a1);
      const mid = ring(STAND_A - inset, STAND_B - inset, am);
      const tx = p1.x - p0.x;
      const tz = p1.z - p0.z;
      buildings.push({
        id: `${kind}-${k}`,
        kind,
        x: mid.x,
        z: mid.z,
        w: Math.hypot(tx, tz) + 4,
        d: depth,
        h,
        base,
        yaw: Math.atan2(-tz, tx),
      });
    }
  }
  for (let m = 0; m < 4; m++) {
    const p = ring(STAND_A * 1.3, STAND_B * 1.3, Math.PI / 4 + (m * Math.PI) / 2);
    buildings.push({ id: `mast-${m}`, kind: "mast", x: p.x, z: p.z, w: 5, d: 5, h: 70, base: plazaTop });
  }

  for (let x0 = WATERFRONT_X_MIN; x0 < WATERFRONT_X_MAX; x0 += STRIP_STEP) {
    const coast = coastMin(t, x0, x0 + STRIP_STEP);
    if (coast === null) continue;
    const xc = x0 + STRIP_STEP / 2;
    const beachZ = coast - SEA_MARGIN - BEACH_DEPTH / 2;
    groundSlab("sand", `beach-${x0}`, xc, beachZ, STRIP_STEP, BEACH_DEPTH, 0.4);
    const roadZ = coast - SEA_MARGIN - BEACH_DEPTH - ROAD_GAP - ROAD_W / 2;
    groundSlab("road", `avenue-${x0}`, xc, roadZ, STRIP_STEP, ROAD_W, 0.5);
  }

  const plaza = { x: sx, z: sz, w: PLAZA_W, d: PLAZA_D };
  let i = 0;
  for (let xc = WATERFRONT_X_MIN + 80; xc < WATERFRONT_X_MAX - 80; xc += RESORT_PITCH, i++) {
    const w = 50 + 40 * rand(i, 1);
    const d = 40 + 20 * rand(i, 2);
    const strip0 = Math.floor((xc - w / 2 - WATERFRONT_X_MIN) / STRIP_STEP) * STRIP_STEP + WATERFRONT_X_MIN;
    const strip1 = Math.floor((xc + w / 2 - WATERFRONT_X_MIN) / STRIP_STEP) * STRIP_STEP + WATERFRONT_X_MIN;
    const coast = coastMin(t, strip0, strip1 + STRIP_STEP);
    if (coast === null) continue;
    const front = coast - SEA_MARGIN - BEACH_DEPTH - ROAD_GAP - ROAD_W - RESORT_SETBACK;
    const r = { id: `resort-${i}`, x: xc, z: front - d / 2, w, d };
    if (!footprintInZone(t, r, COASTAL_CODE)) continue;
    if (Math.abs(r.x - plaza.x) < (r.w + plaza.w) / 2 && Math.abs(r.z - plaza.z) < (r.d + plaza.d) / 2) {
      continue;
    }
    buildings.push({ ...r, kind: "resort", h: 30 + 60 * rand(i, 3), base: groundUnder(t, r) });
  }

  return { slabs, buildings };
}
