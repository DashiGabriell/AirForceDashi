import { WORLD_SIZE, WATER_LEVEL } from "../constants";
import { clamp, wrap } from "../math/vec3";
import { isInsideAirbase } from "./airbaseLayout";
import { PACIFIC_HMAX, PACIFIC_HMIN, PACIFIC_RES, PACIFIC_U16 } from "./pacificHeights";

/** Peak of the baked Pacific map, in metres. */
export const HEIGHT_SCALE = PACIFIC_HMAX;

const SPAN = Math.max(PACIFIC_HMAX - PACIFIC_HMIN, 1e-6);

/** Flatter north-east island settlement. */
const VILLAGE = { x: 3800, z: 3600, radius: 420 };

export enum Region {
  WATER = 0,
  RIVER = 1,
  CITY = 2,
  SUBURB = 3,
  FARM = 4,
  FOREST = 5,
  MEADOW = 6,
  ROCK = 7,
}

export function regionLabel(region: Region): string {
  switch (region) {
    case Region.WATER:
      return "OCEAN";
    case Region.RIVER:
      return "CHANNEL";
    case Region.CITY:
      return "AIRBASE";
    case Region.SUBURB:
      return "VILLAGE";
    case Region.FARM:
      return "COAST";
    case Region.FOREST:
      return "JUNGLE";
    case Region.ROCK:
      return "PEAKS";
    default:
      return "SHORE";
  }
}

function wrapXZ(wx: number, wz: number): { x: number; z: number } {
  return {
    x: wrap(wx, -WORLD_SIZE * 0.5, WORLD_SIZE * 0.5),
    z: wrap(wz, -WORLD_SIZE * 0.5, WORLD_SIZE * 0.5),
  };
}

function sampleMeters(wx: number, wz: number): number {
  const { x, z } = wrapXZ(wx, wz);
  const half = WORLD_SIZE * 0.5;
  const u = ((x + half) / WORLD_SIZE) * (PACIFIC_RES - 1);
  const v = ((z + half) / WORLD_SIZE) * (PACIFIC_RES - 1);
  const x0 = clamp(Math.floor(u), 0, PACIFIC_RES - 1);
  const z0 = clamp(Math.floor(v), 0, PACIFIC_RES - 1);
  const x1 = Math.min(x0 + 1, PACIFIC_RES - 1);
  const z1 = Math.min(z0 + 1, PACIFIC_RES - 1);
  const tx = u - x0;
  const tz = v - z0;
  const h00 = PACIFIC_U16[z0 * PACIFIC_RES + x0]!;
  const h10 = PACIFIC_U16[z0 * PACIFIC_RES + x1]!;
  const h01 = PACIFIC_U16[z1 * PACIFIC_RES + x0]!;
  const h11 = PACIFIC_U16[z1 * PACIFIC_RES + x1]!;
  const hx0 = h00 + (h10 - h00) * tx;
  const hx1 = h01 + (h11 - h01) * tx;
  const q = (hx0 + (hx1 - hx0) * tz) / 65535;
  return PACIFIC_HMIN + q * SPAN;
}

/** Metres above the heightmap origin (sea level is 0). */
export function sampleHeight(wx: number, wz: number): number {
  return sampleMeters(wx, wz);
}

/** Height relative to the map peak, about 0 on the ocean and 1 on the summit. */
export function sampleHeight01(wx: number, wz: number): number {
  return sampleMeters(wx, wz) / HEIGHT_SCALE;
}

export function sampleRegion(wx: number, wz: number): Region {
  const { x, z } = wrapXZ(wx, wz);
  const h = sampleMeters(x, z);
  if (h < 1.2) return Region.WATER;
  if (isInsideAirbase(x, z) && h > 8 && h < 200) {
    return Region.CITY;
  }
  if (
    Math.hypot(x - VILLAGE.x, z - VILLAGE.z) < VILLAGE.radius &&
    h > 6 &&
    h < 200
  ) {
    return Region.SUBURB;
  }
  if (h < 35) return Region.MEADOW;
  if (h < 700) return Region.FOREST;
  return Region.ROCK;
}

export function biomeColor(region: Region, elev: number): [number, number, number] {
  switch (region) {
    case Region.WATER:
    case Region.RIVER:
      return [0.04, 0.22, 0.32];
    case Region.CITY:
      return [0.55, 0.52, 0.42];
    case Region.SUBURB:
      return [0.62, 0.58, 0.4];
    case Region.MEADOW:
      return elev < 18 ? [0.76, 0.68, 0.46] : [0.45, 0.58, 0.28];
    case Region.FOREST:
      return elev > 240 ? [0.16, 0.32, 0.16] : [0.28, 0.48, 0.2];
    case Region.ROCK:
      return elev > 1400 ? [0.82, 0.8, 0.76] : [0.48, 0.42, 0.36];
    default:
      return [0.4, 0.48, 0.3];
  }
}

export function solidFloor(wx: number, wz: number): number {
  return Math.max(sampleHeight(wx, wz), WATER_LEVEL);
}
