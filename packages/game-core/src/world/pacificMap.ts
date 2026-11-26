import { AIRBASE, airbaseWorld } from "./airbaseLayout";
import type { MapDefinition } from "./mapDefinition";
import type { PlaceOfInterest } from "./places";
import { PACIFIC_HMAX, PACIFIC_HMIN, PACIFIC_RES, PACIFIC_U16 } from "./pacificHeights";

const AFB = (lx: number, lz: number) => airbaseWorld(lx, lz);

/** Northeast village — checkpoint courses always start here. */
export const NE_VILLAGE: PlaceOfInterest = {
  name: "NE Village",
  x: 3800,
  z: 3600,
  kind: "SUBURB",
};

/** Pacific Islands. Every number that only this map uses lives here. */
export const PACIFIC_MAP: MapDefinition = {
  id: "pacific",
  worldSize: 16000,
  // Approach from the west, nose toward runway 09.
  spawn: { x: -4200, z: -1800, heading: -Math.PI / 2 },
  heightfield: {
    res: PACIFIC_RES,
    hmin: PACIFIC_HMIN,
    hmax: PACIFIC_HMAX,
    u16: PACIFIC_U16,
  },
  village: { x: NE_VILLAGE.x, z: NE_VILLAGE.z, radius: 420 },
  places: [
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
    NE_VILLAGE,
    { name: "Carrier Anchorage", x: -6200, z: 1200, kind: "AIRPORT" },
  ],
};
