import { PACIFIC_MAP } from "./pacificMap";

export interface PlaceOfInterest {
  name: string;
  x: number;
  z: number;
  kind: "CITY" | "FARM" | "AIRPORT" | "SUBURB";
}

export { NE_VILLAGE } from "./pacificMap";

/** Places of the active map that sit inside its playfield. */
export function buildPlaces(): PlaceOfInterest[] {
  const half = PACIFIC_MAP.worldSize * 0.5;
  return PACIFIC_MAP.places.filter((p) => {
    return Math.abs(p.x) < half && Math.abs(p.z) < half;
  });
}

export function nearestPlace(
  wx: number,
  wz: number,
  places: PlaceOfInterest[],
  maxDist = 3500,
): PlaceOfInterest | null {
  let best: PlaceOfInterest | null = null;
  let bestD = maxDist;
  for (const p of places) {
    const d = Math.hypot(wx - p.x, wz - p.z);
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
  const scored: Array<{ p: PlaceOfInterest; d: number }> = [];
  for (const p of places) {
    const d = Math.hypot(wx - p.x, wz - p.z);
    if (d <= maxDist) scored.push({ p, d });
  }
  scored.sort((a, b) => a.d - b.d);
  return scored.slice(0, limit).map((s) => s.p);
}
