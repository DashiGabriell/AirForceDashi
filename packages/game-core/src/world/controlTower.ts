import type { BuildingAabb } from "./buildingHit";

/** Summit control tower. Metres, matching the ATC-001 sheet. */
export const CONTROL_TOWER = {
  x: 343.75,
  z: 625,
  /** Antenna tip above the pad. */
  height: 55,
  /** Collision footprint of the ops building plus the shaft. */
  halfX: 14,
  halfZ: 12,
} as const;

export function controlTowerContains(x: number, z: number): boolean {
  return (
    Math.abs(x - CONTROL_TOWER.x) <= CONTROL_TOWER.halfX &&
    Math.abs(z - CONTROL_TOWER.z) <= CONTROL_TOWER.halfZ
  );
}

/** Solid top of the tower, or null outside the footprint. `padY` is terrain at the site. */
export function controlTowerCeiling(x: number, z: number, padY: number): number | null {
  if (!controlTowerContains(x, z)) return null;
  return padY + CONTROL_TOWER.height;
}

export function controlTowerAabb(padY: number): BuildingAabb {
  const h = CONTROL_TOWER.height;
  return {
    id: "control-tower",
    cx: CONTROL_TOWER.x,
    cy: padY + h * 0.5,
    cz: CONTROL_TOWER.z,
    hx: CONTROL_TOWER.halfX,
    hy: h * 0.5,
    hz: CONTROL_TOWER.halfZ,
  };
}
