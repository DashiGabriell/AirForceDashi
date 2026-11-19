import { WORLD_SIZE, WATER_LEVEL } from "../constants";
import { clamp, lerp, wrap } from "../math/vec3";
import { fbm2, noise2 } from "./noise";

export const HEIGHT_SCALE = 180;

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
      return "LAKE";
    case Region.RIVER:
      return "RIVER";
    case Region.CITY:
      return "CITY";
    case Region.SUBURB:
      return "SUBURB";
    case Region.FARM:
      return "FARMS";
    case Region.FOREST:
      return "WOODS";
    case Region.ROCK:
      return "PEAKS";
    default:
      return "FIELDS";
  }
}

function wrapXZ(wx: number, wz: number): { x: number; z: number } {
  return {
    x: wrap(wx, -WORLD_SIZE * 0.5, WORLD_SIZE * 0.5),
    z: wrap(wz, -WORLD_SIZE * 0.5, WORLD_SIZE * 0.5),
  };
}

/** Pre-flatten height 0..1. */
export function sampleRawHeight01(wx: number, wz: number): number {
  const { x, z } = wrapXZ(wx, wz);
  let h = fbm2(x, z, 42, 5, 0.0038);
  h += noise2(x * 0.024, z * 0.024, 99) * 0.3;
  h = h * 0.52 - 0.02;
  if (h > 0.22) h += (h - 0.22) * 0.75;
  h = clamp(h * 0.5 + 0.34, 0, 1);

  const lake = noise2(x * 0.004, z * 0.004, 77);
  if (lake < -0.4) {
    const sink = smoothstep(-0.4, -0.7, lake);
    h = lerp(h, 0.08, sink);
  }

  const warp = noise2(x * 0.007, z * 0.007, 501) * 22;
  const ridge = Math.abs(
    noise2((x + warp) * 0.0032, (z - warp * 0.6) * 0.0032, 88),
  );
  const riverW = 0.042 + 0.018 * (0.5 + 0.5 * noise2(z * 0.01, x * 0.01, 99));
  if (ridge < riverW && h < 0.72) {
    const carve = 1 - ridge / Math.max(riverW, 0.001);
    h = lerp(h, 0.05, carve * carve * 0.95);
  }
  return h;
}

export function sampleRegion(wx: number, wz: number): Region {
  const { x, z } = wrapXZ(wx, wz);
  return classifyRegionRaw(x, z, sampleRawHeight01(x, z));
}

export function sampleHeight01(wx: number, wz: number): number {
  const { x, z } = wrapXZ(wx, wz);
  let h = sampleRawHeight01(x, z);
  const region = classifyRegionRaw(x, z, h);
  if (region === Region.CITY) h = lerp(h, 0.3, 0.78);
  else if (region === Region.SUBURB) h = lerp(h, 0.28, 0.48);
  else if (region === Region.FARM) {
    const step = Math.floor(h * 14) / 14;
    h = lerp(h, step, 0.35);
  }
  return h;
}

export function sampleHeight(wx: number, wz: number): number {
  return sampleHeight01(wx, wz) * HEIGHT_SCALE;
}

function classifyRegionRaw(x: number, z: number, h: number): Region {
  const elev = h * HEIGHT_SCALE;
  if (h < 0.145) return Region.WATER;

  const warp = noise2(x * 0.007, z * 0.007, 501) * 22;
  const ridge = Math.abs(
    noise2((x + warp) * 0.0032, (z - warp * 0.6) * 0.0032, 88),
  );
  if (ridge < 0.052 && h < 0.55) return Region.RIVER;
  if (elev > 105) return Region.ROCK;

  let macro = fbm2(x, z, 210, 3, 0.0016);
  macro += noise2(z * 0.00256, x * 0.00256, 311) * 0.28;
  const forestN = noise2(x * 0.022, z * 0.022, 7);

  if (macro > 0.18 && elev > 14 && elev < 82) return Region.CITY;
  if (macro > -0.02 && elev > 12 && elev < 88) return Region.SUBURB;
  if (macro < -0.08 && elev > 12 && elev < 72) return Region.FARM;
  if (forestN > 0.08 && elev > 18 && elev < 95) return Region.FOREST;
  return Region.MEADOW;
}

export function biomeColor(region: Region, elev: number): [number, number, number] {
  switch (region) {
    case Region.WATER:
    case Region.RIVER:
      return [0.12, 0.28, 0.36];
    case Region.CITY:
      return [0.42, 0.44, 0.48];
    case Region.SUBURB:
      return [0.45, 0.48, 0.4];
    case Region.FARM:
      return [0.48, 0.52, 0.28];
    case Region.FOREST:
      return [0.18, 0.36, 0.22];
    case Region.ROCK:
      return [0.5, 0.48, 0.46];
    default:
      return elev > 60 ? [0.4, 0.48, 0.32] : [0.32, 0.46, 0.3];
  }
}

export function solidFloor(wx: number, wz: number): number {
  return Math.max(sampleHeight(wx, wz), WATER_LEVEL);
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}
