import type { BuildingAabb } from "./buildingHit";
import type { BuildingInstance } from "./chunk";

/**
 * Dashi AFB master-plan anchors (metres, world XZ).
 * Runway 09-27 is E–W; local +X = east, local +Z = south.
 */
export const AIRBASE = {
  x: -2200,
  z: -1800,
  /** Soft envelope for region / vegetation / HLOD exclusion. */
  halfX: 2100,
  halfZ: 950,
  runwayLength: 3500,
  runwayWidth: 60,
  blastPad: 220,
  taxiWidth: 28,
  taxiOffset: 95,
} as const;

export interface AirbaseMarker {
  id: string;
  name: string;
  /** Local metres from runway centre (+X east, +Z south). */
  lx: number;
  lz: number;
  kind:
    | "runway"
    | "apron"
    | "hangar"
    | "shelter"
    | "fuel"
    | "bunker"
    | "admin"
    | "helipad"
    | "fire";
}

/** Footprints used for radar labels (local → world). */
export const AIRBASE_MARKERS: AirbaseMarker[] = [
  { id: "runway", name: "Runway 09-27", lx: 0, lz: 0, kind: "runway" },
  { id: "apron-main", name: "Main Apron", lx: -200, lz: 280, kind: "apron" },
  { id: "apron-alert", name: "Alert Apron", lx: 520, lz: 260, kind: "apron" },
  { id: "hangar-1", name: "Maintenance Hangar 1", lx: -780, lz: 460, kind: "hangar" },
  { id: "hangar-2", name: "Maintenance Hangar 2", lx: -620, lz: 460, kind: "hangar" },
  { id: "hangar-3", name: "Maintenance Hangar 3", lx: -460, lz: 460, kind: "hangar" },
  { id: "has-1", name: "HAS-1", lx: -980, lz: 380, kind: "shelter" },
  { id: "has-2", name: "HAS-2", lx: -980, lz: 480, kind: "shelter" },
  { id: "has-3", name: "HAS-3", lx: -980, lz: 580, kind: "shelter" },
  { id: "has-4", name: "HAS-4", lx: -980, lz: 680, kind: "shelter" },
  { id: "has-5", name: "HAS-5", lx: -880, lz: 380, kind: "shelter" },
  { id: "has-6", name: "HAS-6", lx: -880, lz: 480, kind: "shelter" },
  { id: "fuel", name: "Fuel Depot", lx: -520, lz: 180, kind: "fuel" },
  { id: "bunker-1", name: "Munitions 1", lx: -1100, lz: 200, kind: "bunker" },
  { id: "bunker-2", name: "Munitions 2", lx: -1100, lz: 280, kind: "bunker" },
  { id: "bunker-3", name: "Munitions 3", lx: -1100, lz: 360, kind: "bunker" },
  { id: "bunker-4", name: "Munitions 4", lx: -1100, lz: 440, kind: "bunker" },
  { id: "hq", name: "HQ Admin", lx: 420, lz: 520, kind: "admin" },
  { id: "barracks-a", name: "Barracks A", lx: 280, lz: 620, kind: "admin" },
  { id: "barracks-b", name: "Barracks B", lx: 360, lz: 620, kind: "admin" },
  { id: "barracks-c", name: "Barracks C", lx: 440, lz: 620, kind: "admin" },
  { id: "barracks-d", name: "Barracks D", lx: 520, lz: 620, kind: "admin" },
  { id: "fire", name: "Fire Station", lx: 180, lz: 200, kind: "fire" },
  { id: "helipad-1", name: "Helipad 01", lx: 680, lz: 420, kind: "helipad" },
  { id: "helipad-2", name: "Helipad 02", lx: 760, lz: 420, kind: "helipad" },
  { id: "helipad-3", name: "Helipad 03", lx: 680, lz: 500, kind: "helipad" },
  { id: "helipad-4", name: "Helipad 04", lx: 760, lz: 500, kind: "helipad" },
];

export function airbaseWorld(lx: number, lz: number): { x: number; z: number } {
  return { x: AIRBASE.x + lx, z: AIRBASE.z + lz };
}

export function isInsideAirbase(x: number, z: number): boolean {
  return (
    Math.abs(x - AIRBASE.x) <= AIRBASE.halfX &&
    Math.abs(z - AIRBASE.z) <= AIRBASE.halfZ
  );
}

type Struct = {
  id: string;
  lx: number;
  lz: number;
  w: number;
  h: number;
  d: number;
  kind: BuildingInstance["kind"];
};

function structures(): Struct[] {
  const out: Struct[] = [];
  out.push(
    { id: "hangar-1", lx: -780, lz: 460, w: 54, h: 16.5, d: 72, kind: "city" },
    { id: "hangar-2", lx: -620, lz: 460, w: 54, h: 16.5, d: 72, kind: "city" },
    { id: "hangar-3", lx: -460, lz: 460, w: 54, h: 16.5, d: 72, kind: "city" },
  );
  for (let i = 0; i < 4; i++) {
    out.push({
      id: `has-${i + 1}`,
      lx: -980,
      lz: 380 + i * 100,
      w: 24.5,
      h: 8.2,
      d: 36,
      kind: "city",
    });
  }
  out.push(
    { id: "has-5", lx: -880, lz: 380, w: 24.5, h: 8.2, d: 36, kind: "city" },
    { id: "has-6", lx: -880, lz: 480, w: 24.5, h: 8.2, d: 36, kind: "city" },
  );
  out.push(
    { id: "fuel", lx: -520, lz: 180, w: 70, h: 12, d: 70, kind: "farm" },
  );
  for (let i = 0; i < 4; i++) {
    out.push({
      id: `bunker-${i + 1}`,
      lx: -1100,
      lz: 200 + i * 80,
      w: 18,
      h: 7,
      d: 28,
      kind: "farm",
    });
  }
  out.push(
    { id: "hq", lx: 420, lz: 520, w: 48, h: 11.4, d: 28, kind: "suburb" },
    { id: "barracks-a", lx: 280, lz: 620, w: 16, h: 10.5, d: 44, kind: "suburb" },
    { id: "barracks-b", lx: 360, lz: 620, w: 16, h: 10.5, d: 44, kind: "suburb" },
    { id: "barracks-c", lx: 440, lz: 620, w: 16, h: 10.5, d: 44, kind: "suburb" },
    { id: "barracks-d", lx: 520, lz: 620, w: 16, h: 10.5, d: 44, kind: "suburb" },
    { id: "fire", lx: 180, lz: 200, w: 42, h: 9, d: 28, kind: "city" },
  );
  return out;
}

export function airbaseBuildingInstances(padY: number): BuildingInstance[] {
  return structures().map((s) => {
    const w = airbaseWorld(s.lx, s.lz);
    return {
      id: `afb-${s.id}`,
      x: w.x,
      y: padY,
      z: w.z,
      w: s.w,
      h: s.h,
      d: s.d,
      yaw: 0,
      kind: s.kind,
    };
  });
}

/** Collision volumes for hangars / shelters / tanks / buildings (not pavement). */
export function airbaseCollisionAabbs(padY: number): BuildingAabb[] {
  return airbaseBuildingInstances(padY).map((b) => ({
    id: b.id,
    cx: b.x,
    cy: b.y + b.h * 0.5,
    cz: b.z,
    hx: b.w * 0.46,
    hy: b.h * 0.5,
    hz: b.d * 0.46,
  }));
}

export function airbaseCeiling(x: number, z: number, padY: number): number | null {
  if (!isInsideAirbase(x, z)) return null;
  let best: number | null = null;
  for (const b of airbaseBuildingInstances(padY)) {
    if (Math.abs(x - b.x) <= b.w * 0.5 && Math.abs(z - b.z) <= b.d * 0.5) {
      const top = b.y + b.h;
      best = best == null ? top : Math.max(best, top);
    }
  }
  return best;
}
