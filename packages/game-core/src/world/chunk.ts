import { WORLD_SIZE } from "../constants";
import { wrap } from "../math/vec3";
import {
  Region,
  biomeColor,
  sampleHeight,
  sampleRegion,
} from "./heightfield";

/** Divides WORLD_SIZE (16 km) into 32 columns. */
export const CHUNK_SIZE = 500;
export const CHUNK_RES = 24; // verts per side (23 quads)
export const STREAM_RADIUS = 3; // chunks in each direction → 7×7

export function chunkKey(cx: number, cz: number): string {
  return `${cx},${cz}`;
}

export function worldToChunk(wx: number, wz: number): { cx: number; cz: number } {
  const half = WORLD_SIZE * 0.5;
  const x = wrap(wx, -half, half);
  const z = wrap(wz, -half, half);
  return {
    cx: Math.floor((x + half) / CHUNK_SIZE),
    cz: Math.floor((z + half) / CHUNK_SIZE),
  };
}

export function chunkOrigin(cx: number, cz: number): { x: number; z: number } {
  const half = WORLD_SIZE * 0.5;
  return {
    x: -half + cx * CHUNK_SIZE,
    z: -half + cz * CHUNK_SIZE,
  };
}

export interface ChunkMeshData {
  cx: number;
  cz: number;
  /** interleaved x,y,z,r,g,b per vertex */
  vertices: Float32Array;
  indices: Uint32Array;
  res: number;
}

export function neededChunks(
  wx: number, wz: number, radius = STREAM_RADIUS,
): Array<{ cx: number; cz: number }> {
  const { cx, cz } = worldToChunk(wx, wz);
  const maxC = Math.floor(WORLD_SIZE / CHUNK_SIZE);
  const out: Array<{ cx: number; cz: number }> = [];
  for (let dz = -radius; dz <= radius; dz++) {
    for (let dx = -radius; dx <= radius; dx++) {
      out.push({
        cx: ((cx + dx) % maxC + maxC) % maxC,
        cz: ((cz + dz) % maxC + maxC) % maxC,
      });
    }
  }
  return out;
}

/** Velocity / altitude hint for prefetching chunks ahead of the jet. */
export interface StreamMotion {
  vx: number;
  vz: number;
  /** Radar / AGL altitude (m). */
  altitude?: number;
}

/**
 * Base ring around the jet plus lookahead samples along velocity.
 * Keeps the existing STREAM_RADIUS contract; only expands when needed.
 */
export function neededChunksLookahead(
  wx: number,
  wz: number,
  motion?: StreamMotion,
  radius = STREAM_RADIUS,
): Array<{ cx: number; cz: number }> {
  let r = radius;
  const speed = Math.hypot(motion?.vx ?? 0, motion?.vz ?? 0);
  const alt = motion?.altitude ?? 400;
  if (alt > 900) r = Math.min(r + 1, STREAM_RADIUS + 1);
  if (speed > 140) r = Math.min(r + 1, STREAM_RADIUS + 1);

  const map = new Map<string, { cx: number; cz: number }>();
  const add = (list: Array<{ cx: number; cz: number }>) => {
    for (const c of list) map.set(chunkKey(c.cx, c.cz), c);
  };
  add(neededChunks(wx, wz, r));

  if (speed > 35 && motion) {
    const lookSec = Math.min(7.5, Math.max(2.2, speed * 0.035));
    const inv = 1 / speed;
    const dx = motion.vx * inv;
    const dz = motion.vz * inv;
    const aheadR = Math.max(2, r - 1);
    for (const t of [0.4, 0.7, 1]) {
      const dist = speed * lookSec * t;
      add(neededChunks(wx + dx * dist, wz + dz * dist, aheadR));
    }
  }
  return [...map.values()];
}

/** Build terrain mesh for one chunk (main or worker). */
export function generateChunkMesh(cx: number, cz: number, res = CHUNK_RES): ChunkMeshData {
  const origin = chunkOrigin(cx, cz);
  const step = CHUNK_SIZE / (res - 1);
  const vertCount = res * res;
  const vertices = new Float32Array(vertCount * 6);
  const indices = new Uint32Array((res - 1) * (res - 1) * 6);

  let vi = 0;
  for (let j = 0; j < res; j++) {
    for (let i = 0; i < res; i++) {
      const wx = origin.x + i * step;
      const wz = origin.z + j * step;
      const y = sampleHeight(wx, wz);
      const region = sampleRegion(wx, wz);
      const [r, g, b] = biomeColor(region, y);
      vertices[vi++] = wx;
      vertices[vi++] = y;
      vertices[vi++] = wz;
      vertices[vi++] = r;
      vertices[vi++] = g;
      vertices[vi++] = b;
    }
  }

  let ii = 0;
  for (let j = 0; j < res - 1; j++) {
    for (let i = 0; i < res - 1; i++) {
      const a = j * res + i;
      const b = a + 1;
      const c = a + res;
      const d = c + 1;
      indices[ii++] = a;
      indices[ii++] = c;
      indices[ii++] = b;
      indices[ii++] = b;
      indices[ii++] = c;
      indices[ii++] = d;
    }
  }

  return { cx, cz, vertices, indices, res };
}

export interface BuildingInstance {
  /** Stable cell id — used by BuildingHitQuery / promote. */
  id: string;
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  yaw: number;
  kind: "city" | "suburb" | "farm";
}

export const BUILDING_CELL = 280;
export const BUILDING_RADIUS = 1600;
export const MAX_CITY = 220;
export const MAX_SUBURB = 160;
export const MAX_FARM = 50;

export function gatherBuildings(wx: number, wz: number): BuildingInstance[] {
  const half = WORLD_SIZE * 0.5;
  const sx = Math.round(wx / 140) * 140;
  const sz = Math.round(wz / 140) * 140;
  const i0 = Math.floor((sx + half - BUILDING_RADIUS) / BUILDING_CELL);
  const i1 = Math.floor((sx + half + BUILDING_RADIUS) / BUILDING_CELL);
  const j0 = Math.floor((sz + half - BUILDING_RADIUS) / BUILDING_CELL);
  const j1 = Math.floor((sz + half + BUILDING_RADIUS) / BUILDING_CELL);

  const out: BuildingInstance[] = [];
  let city = 0;
  let suburb = 0;
  let farm = 0;

  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      let cx = -half + (i + 0.5) * BUILDING_CELL;
      let cz = -half + (j + 0.5) * BUILDING_CELL;
      cx = wrap(cx, -half, half);
      cz = wrap(cz, -half, half);
      let dx = Math.abs(cx - sx);
      let dz = Math.abs(cz - sz);
      dx = Math.min(dx, WORLD_SIZE - dx);
      dz = Math.min(dz, WORLD_SIZE - dz);
      if (dx * dx + dz * dz > BUILDING_RADIUS * BUILDING_RADIUS) continue;

      const region = sampleRegion(cx, cz);
      if (
        region !== Region.CITY &&
        region !== Region.SUBURB &&
        region !== Region.FARM
      ) {
        continue;
      }
      const gh = sampleHeight(cx, cz);
      if (gh <= 2) continue;

      const seed = (i * 73856093) ^ (j * 19349663);
      const yaw = ((seed >>> 9) % 4) * (Math.PI * 0.5);

      if (region === Region.CITY && city < MAX_CITY) {
        let h = 22 + (seed % 78);
        let w = 42 + ((seed >>> 3) % 58);
        let d = 42 + ((seed >>> 7) % 58);
        if (seed % 11 === 0) {
          h *= 1.45;
          w *= 0.72;
          d *= 0.72;
        }
        out.push({
          id: `b_${i}_${j}`,
          x: cx,
          y: gh,
          z: cz,
          w,
          h,
          d,
          yaw,
          kind: "city",
        });
        city++;
      } else if (region === Region.SUBURB && suburb < MAX_SUBURB) {
        const h = 8 + (seed % 10);
        const w = 18 + ((seed >>> 2) % 16);
        const d = 16 + ((seed >>> 5) % 14);
        out.push({
          id: `b_${i}_${j}`,
          x: cx,
          y: gh,
          z: cz,
          w,
          h,
          d,
          yaw,
          kind: "suburb",
        });
        suburb++;
      } else if (region === Region.FARM && farm < MAX_FARM) {
        const h = 10 + (seed % 8);
        const w = 28 + ((seed >>> 3) % 20);
        const d = 18 + ((seed >>> 6) % 12);
        out.push({
          id: `b_${i}_${j}`,
          x: cx,
          y: gh,
          z: cz,
          w,
          h,
          d,
          yaw,
          kind: "farm",
        });
        farm++;
      }
    }
  }
  return out;
}
