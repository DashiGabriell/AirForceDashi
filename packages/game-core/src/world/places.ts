import { WORLD_SIZE } from "../constants";
import { wrap } from "../math/vec3";
import { Region, sampleRegion } from "./heightfield";
import { hash2 } from "./noise";

export interface PlaceOfInterest {
  name: string;
  x: number;
  z: number;
  kind: "CITY" | "FARM" | "AIRPORT" | "SUBURB";
}

const CITY_PRE = ["North", "East", "Port", "New", "Old", "Fort", "Lake", "Ridge", "South", "West"];
const CITY_SUF = ["haven", "ford", "burg", "ton", "field", "gate", "bay", "point", "mere", "wick"];
const FARM_PRE = ["Willow", "Red", "Cedar", "Maple", "Stone", "Sunny", "Oak", "Hill", "River", "Gold"];
const FARM_SUF = ["Farm", "Ranch", "Orchard", "Acres", "Fields", "Homestead", "Pasture", "Grove"];
const AP_SUF = ["Intl", "Field", "Municipal", "AFB", "Airpark"];

/** Deterministic sparse POI catalog (no full heightmap bake). */
export function buildPlaces(): PlaceOfInterest[] {
  const places: PlaceOfInterest[] = [];
  const used: Array<{ x: number; z: number }> = [];
  const step = 900;
  const half = WORLD_SIZE * 0.5;

  for (let z = -half + step; z < half; z += step) {
    for (let x = -half + step; x < half; x += step) {
      const region = sampleRegion(x, z);
      if (
        region !== Region.CITY &&
        region !== Region.FARM &&
        region !== Region.SUBURB
      ) {
        continue;
      }
      if (tooClose(x, z, used, 1100)) continue;
      const h = Math.floor(hash2(Math.floor(x), Math.floor(z), 9001) * 100000);
      let kind: PlaceOfInterest["kind"];
      let name: string;
      if (region === Region.CITY) {
        kind = "CITY";
        name = `${CITY_PRE[h % CITY_PRE.length]}${CITY_SUF[Math.floor(h / 17) % CITY_SUF.length]}`;
        if (h % 7 === 0) {
          places.push({
            name: `${name} ${AP_SUF[h % AP_SUF.length]}`,
            x,
            z: z + 180,
            kind: "AIRPORT",
          });
        }
      } else if (region === Region.FARM) {
        kind = "FARM";
        name = `${FARM_PRE[h % FARM_PRE.length]} ${FARM_SUF[Math.floor(h / 13) % FARM_SUF.length]}`;
      } else {
        kind = "SUBURB";
        name = `${CITY_PRE[(h + 3) % CITY_PRE.length]} Heights`;
      }
      places.push({ name, x, z, kind });
      used.push({ x, z });
      if (places.length >= 48) return places;
    }
  }
  return places;
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

/** Nearby POIs for free-flight radar (sorted nearest-first, capped). */
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

function tooClose(
  x: number,
  z: number,
  used: Array<{ x: number; z: number }>,
  min: number,
): boolean {
  for (const u of used) {
    if (Math.hypot(u.x - x, u.z - z) < min) return true;
  }
  return false;
}
