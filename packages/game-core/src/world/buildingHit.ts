import type { BuildingInstance } from "./chunk";

/** Collision inset on XZ (Godot BuildingField COLLISION_XZ). */
export const BUILDING_COLLISION_XZ = 0.92;

export interface BuildingAabb {
  id: string;
  cx: number;
  cy: number;
  cz: number;
  hx: number;
  hy: number;
  hz: number;
}

export interface BuildingHit {
  id: string;
  x: number;
  y: number;
  z: number;
  t: number;
}

/** Convert building instance → AABB (yaw 0/90 only — Godot parity). */
export function buildingToAabb(b: BuildingInstance): BuildingAabb {
  const yaw90 = Math.abs(Math.sin(b.yaw)) > 0.5;
  const hx = ((yaw90 ? b.d : b.w) * 0.5) * BUILDING_COLLISION_XZ;
  const hz = ((yaw90 ? b.w : b.d) * 0.5) * BUILDING_COLLISION_XZ;
  return {
    id: b.id,
    cx: b.x,
    cy: b.y + b.h * 0.5,
    cz: b.z,
    hx,
    hy: b.h * 0.5,
    hz,
  };
}

/**
 * Segment vs AABB slab — first hit along [from→to], or null.
 * Paridade Godot `building_segment_hit`.
 */
export function buildingHitQuery(
  from: { x: number; y: number; z: number },
  to: { x: number; y: number; z: number },
  boxes: BuildingAabb[],
): BuildingHit | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  let bestT = 1.0001;
  let best: BuildingHit | null = null;

  for (const b of boxes) {
    const t = rayAabb(from.x, from.y, from.z, dx, dy, dz, b);
    if (t != null && t >= 0 && t <= 1 && t < bestT) {
      bestT = t;
      best = {
        id: b.id,
        x: from.x + dx * t,
        y: from.y + dy * t,
        z: from.z + dz * t,
        t,
      };
    }
  }
  return best;
}

function rayAabb(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  b: BuildingAabb,
): number | null {
  const minX = b.cx - b.hx;
  const maxX = b.cx + b.hx;
  const minY = b.cy - b.hy;
  const maxY = b.cy + b.hy;
  const minZ = b.cz - b.hz;
  const maxZ = b.cz + b.hz;

  let tmin = 0;
  let tmax = 1;

  const axis = (
    o: number,
    d: number,
    minV: number,
    maxV: number,
  ): boolean => {
    if (Math.abs(d) < 1e-8) {
      return o >= minV && o <= maxV;
    }
    const inv = 1 / d;
    let t1 = (minV - o) * inv;
    let t2 = (maxV - o) * inv;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    return tmin <= tmax;
  };

  if (!axis(ox, dx, minX, maxX)) return null;
  if (!axis(oy, dy, minY, maxY)) return null;
  if (!axis(oz, dz, minZ, maxZ)) return null;
  if (tmax < 0 || tmin > 1) return null;
  return tmin >= 0 ? tmin : tmax;
}
