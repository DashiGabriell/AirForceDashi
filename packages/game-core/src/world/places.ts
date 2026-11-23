import { WORLD_SIZE } from "../constants";
import { wrap } from "../math/vec3";
import { AIRBASE, airbaseWorld } from "./airbaseLayout";

export interface PlaceOfInterest {
  name: string;
  x: number;
  z: number;
  kind: "CITY" | "FARM" | "AIRPORT" | "SUBURB";
}

const AFB = (lx: number, lz: number) => airbaseWorld(lx, lz);

/** Fixed catalog for the Pacific Islands map. */
const PACIFIC_PLACES: PlaceOfInterest[] = [
  { name: "Dashi AFB", x: AIRBASE.x, z: AIRBASE.z, kind: "AIRPORT" },
  { name: "Main Apron", ...AFB(-200, 280), kind: "AIRPORT" },
  { name: "Hangar Row", ...AFB(-620, 460), kind: "CITY" },
  { name: "Fuel Depot", ...AFB(-520, 180), kind: "FARM" },
  { name: "Ammo Dump", ...AFB(-1100, 280), kind: "FARM" },
  { name: "Admin Compound", ...AFB(420, 520), kind: "SUBURB" },
  { name: "Helipads", ...AFB(720, 460), kind: "AIRPORT" },
  { name: "Control Tower", x: 343.75, z: 625, kind: "CITY" },
  { name: "Crater Peak", x: 500, z: 400, kind: "CITY" },
  { name: "North Radar", x: 600, z: 5200, kind: "CITY" },
  { name: "West Chain", x: -5200, z: 4200, kind: "SUBURB" },
  { name: "SE Ridge", x: 4200, z: -4200, kind: "CITY" },
  { name: "NE Village", x: 3800, z: 3600, kind: "SUBURB" },
  { name: "Carrier Anchorage", x: -6200, z: 1200, kind: "AIRPORT" },
];

export function buildPlaces(): PlaceOfInterest[] {
  return PACIFIC_PLACES.filter((p) => {
    const half = WORLD_SIZE * 0.5;
    return Math.abs(p.x) < half && Math.abs(p.z) < half;
  });
}

export function nearestPlace(
  wx: number,
  wz: number,
  places: PlaceOfInterest[],
  maxDist = 3500,
): PlaceOfInterest | null {
  const half = WORLD_SIZE * 0.5;
  let best: PlaceOfInterest | null = null;
  let bestD = maxDist;
  for (const p of places) {
    let dx = Math.abs(wrap(wx, -half, half) - p.x);
    let dz = Math.abs(wrap(wz, -half, half) - p.z);
    dx = Math.min(dx, WORLD_SIZE - dx);
    dz = Math.min(dz, WORLD_SIZE - dz);
    const d = Math.hypot(dx, dz);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

export function nearbyPlaces(
  wx: number,
  wz: number,
  places: PlaceOfInterest[],
  maxDist = 3200,
  limit = 8,
): PlaceOfInterest[] {
  const half = WORLD_SIZE * 0.5;
  const scored: Array<{ p: PlaceOfInterest; d: number }> = [];
  for (const p of places) {
    let dx = Math.abs(wrap(wx, -half, half) - p.x);
    let dz = Math.abs(wrap(wz, -half, half) - p.z);
    dx = Math.min(dx, WORLD_SIZE - dx);
    dz = Math.min(dz, WORLD_SIZE - dz);
    const d = Math.hypot(dx, dz);
    if (d <= maxDist) scored.push({ p, d });
  }
  scored.sort((a, b) => a.d - b.d);
  return scored.slice(0, limit).map((s) => s.p);
}
