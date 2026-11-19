import type { BuildingAabb } from "../world/buildingHit";
import type { BuildingInstance } from "../world/chunk";
import { buildingToAabb } from "../world/buildingHit";

export type DestructibleDamage = 0 | 1 | 2 | 3;

export interface DestructibleTarget {
  id: string;
  buildingId: string;
  aabb: BuildingAabb;
  /** Source dims for voxel mesh. */
  w: number;
  h: number;
  d: number;
  yaw: number;
  baseY: number;
  hp: number;
  maxHp: number;
  damageState: DestructibleDamage;
  promoted: boolean;
  destroyed: boolean;
}

export function createDestructibleFromBuilding(
  b: BuildingInstance,
  maxHp: number,
): DestructibleTarget {
  return {
    id: `dt_${b.id}`,
    buildingId: b.id,
    aabb: buildingToAabb(b),
    w: b.w,
    h: b.h,
    d: b.d,
    yaw: b.yaw,
    baseY: b.y,
    hp: maxHp,
    maxHp,
    damageState: 0,
    promoted: false,
    destroyed: false,
  };
}

/** Apply hit; returns true if this hit destroyed the target. */
export function damageDestructible(t: DestructibleTarget, amount = 1): boolean {
  if (t.destroyed) return false;
  t.hp = Math.max(0, t.hp - amount);
  const ratio = t.maxHp <= 0 ? 0 : t.hp / t.maxHp;
  if (ratio <= 0) t.damageState = 3;
  else if (ratio <= 0.34) t.damageState = 2;
  else if (ratio <= 0.67) t.damageState = 1;
  else t.damageState = 0;

  if (t.hp <= 0) {
    t.destroyed = true;
    t.damageState = 3;
    // Collapse AABB so further hits miss
    t.aabb.hy = 0.01;
    t.aabb.cy = t.baseY;
    return true;
  }

  // Shrink collision height with damage (local only)
  const scale = Math.max(0.25, ratio);
  const fullH = t.h;
  t.aabb.hy = (fullH * scale) * 0.5;
  t.aabb.cy = t.baseY + t.aabb.hy;
  return false;
}

export function promoteToDestructible(t: DestructibleTarget): void {
  t.promoted = true;
}
