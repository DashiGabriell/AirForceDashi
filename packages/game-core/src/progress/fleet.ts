import { Aircraft } from "@afd/shared-types";

/** String IDs shared with economy catalog / API. */
export type FleetAircraftId =
  | "f22"
  | "f15"
  | "f16"
  | "fa18"
  | "typhoon"
  | "rafale"
  | "su35"
  | "f35"
  | "f14"
  | "gripen"
  | "mirage2000"
  | "f2"
  | "mig29"
  | "mig35"
  | "su57"
  | "yf23"
  | "f4"
  | "su34"
  | "a10"
  | "b2"
  | "u2";

/** Fighter / airframe generation for Hangar grouping. */
export type FleetGenerationId =
  | "gen3"
  | "gen4"
  | "gen45"
  | "gen5"
  | "special";

export const FLEET_GENERATION_ORDER: readonly FleetGenerationId[] = [
  "gen5",
  "gen45",
  "gen4",
  "gen3",
  "special",
] as const;

export const FLEET_GENERATION_LABEL: Record<FleetGenerationId, string> = {
  gen5: "5ª geração",
  gen45: "4.5ª geração",
  gen4: "4ª geração",
  gen3: "3ª geração",
  special: "Especial / Apoio",
};

export interface FleetEntry {
  aircraft: Aircraft;
  id: FleetAircraftId;
  label: string;
  shortLabel: string;
  /** Hangar meta line (tier). */
  tierLabel: string;
  /** Hangar section (fighter generation). */
  generation: FleetGenerationId;
  unlockCost: number;
  modelUrl: string;
}

/**
 * Full playable fleet — starters + Fase A/B/C.
 * Costs: economia-v1 §4 for catalog jets; extras / silhuetas usam stubs progressivos.
 */
export const FLEET: readonly FleetEntry[] = [
  {
    aircraft: Aircraft.F22_RAPTOR,
    id: "f22",
    label: "F-22 RAPTOR",
    shortLabel: "F-22",
    tierLabel: "Starter",
    generation: "gen5",
    unlockCost: 0,
    modelUrl: "/models/f22_game.glb",
  },
  {
    aircraft: Aircraft.F15_EAGLE,
    id: "f15",
    label: "F-15 EAGLE",
    shortLabel: "F-15",
    tierLabel: "Starter",
    generation: "gen4",
    unlockCost: 8000,
    modelUrl: "/models/f15_game.glb",
  },
  {
    aircraft: Aircraft.F16_FALCON,
    id: "f16",
    label: "F-16 FALCON",
    shortLabel: "F-16",
    tierLabel: "Entrada",
    generation: "gen4",
    unlockCost: 18000,
    modelUrl: "/models/f16_game.glb",
  },
  {
    aircraft: Aircraft.FA18_SUPER_HORNET,
    id: "fa18",
    label: "F/A-18F SUPER HORNET",
    shortLabel: "F/A-18F",
    tierLabel: "Intermediária",
    generation: "gen45",
    unlockCost: 32000,
    modelUrl: "/models/fa18_game.glb",
  },
  {
    aircraft: Aircraft.TYPHOON,
    id: "typhoon",
    label: "EUROFIGHTER TYPHOON",
    shortLabel: "TYPHOON",
    tierLabel: "Avançada",
    generation: "gen45",
    unlockCost: 50000,
    modelUrl: "/models/typhoon_game.glb",
  },
  {
    aircraft: Aircraft.RAFALE,
    id: "rafale",
    label: "RAFALE M",
    shortLabel: "RAFALE",
    tierLabel: "Avançada",
    generation: "gen45",
    unlockCost: 50000,
    modelUrl: "/models/rafale_game.glb",
  },
  {
    aircraft: Aircraft.SU35,
    id: "su35",
    label: "SU-35",
    shortLabel: "SU-35",
    tierLabel: "Especializada",
    generation: "gen45",
    unlockCost: 75000,
    modelUrl: "/models/su35_game.glb",
  },
  {
    aircraft: Aircraft.F35_LIGHTNING,
    id: "f35",
    label: "F-35 LIGHTNING II",
    shortLabel: "F-35",
    tierLabel: "Especializada",
    generation: "gen5",
    unlockCost: 75000,
    modelUrl: "/models/f35_game.glb",
  },
  {
    aircraft: Aircraft.F14_TOMCAT,
    id: "f14",
    label: "F-14 TOMCAT",
    shortLabel: "F-14",
    tierLabel: "Extra",
    generation: "gen4",
    unlockCost: 28000,
    modelUrl: "/models/f14_game.glb",
  },
  {
    aircraft: Aircraft.GRIPEN,
    id: "gripen",
    label: "JAS 39 GRIPEN",
    shortLabel: "GRIPEN",
    tierLabel: "Extra",
    generation: "gen45",
    unlockCost: 22000,
    modelUrl: "/models/gripen_game.glb",
  },
  {
    aircraft: Aircraft.MIRAGE_2000,
    id: "mirage2000",
    label: "MIRAGE 2000",
    shortLabel: "MIRAGE",
    tierLabel: "Extra",
    generation: "gen4",
    unlockCost: 26000,
    modelUrl: "/models/mirage2000_game.glb",
  },
  {
    aircraft: Aircraft.F2,
    id: "f2",
    label: "MITSUBISHI F-2",
    shortLabel: "F-2",
    tierLabel: "Extra",
    generation: "gen45",
    unlockCost: 32000,
    modelUrl: "/models/f2_game.glb",
  },
  {
    aircraft: Aircraft.MIG29,
    id: "mig29",
    label: "MIG-29",
    shortLabel: "MIG-29",
    tierLabel: "Extra",
    generation: "gen4",
    unlockCost: 30000,
    modelUrl: "/models/mig29_game.glb",
  },
  {
    aircraft: Aircraft.MIG35,
    id: "mig35",
    label: "MIG-35",
    shortLabel: "MIG-35",
    tierLabel: "Extra",
    generation: "gen45",
    unlockCost: 45000,
    modelUrl: "/models/mig35_game.glb",
  },
  {
    aircraft: Aircraft.SU57,
    id: "su57",
    label: "SU-57 FELON",
    shortLabel: "SU-57",
    tierLabel: "Elite",
    generation: "gen5",
    unlockCost: 90000,
    modelUrl: "/models/su57_game.glb",
  },
  {
    aircraft: Aircraft.YF23,
    id: "yf23",
    label: "YF-23 BLACK WIDOW",
    shortLabel: "YF-23",
    tierLabel: "Elite",
    generation: "gen5",
    unlockCost: 85000,
    modelUrl: "/models/yf23_game.glb",
  },
  {
    aircraft: Aircraft.F4_PHANTOM,
    id: "f4",
    label: "F-4 PHANTOM II",
    shortLabel: "F-4",
    tierLabel: "Extra",
    generation: "gen3",
    unlockCost: 15000,
    modelUrl: "/models/f4_game.glb",
  },
  {
    aircraft: Aircraft.SU34,
    id: "su34",
    label: "SU-34 FULLBACK",
    shortLabel: "SU-34",
    tierLabel: "Especial",
    generation: "gen45",
    unlockCost: 70000,
    modelUrl: "/models/su34_game.glb",
  },
  {
    aircraft: Aircraft.A10,
    id: "a10",
    label: "A-10 THUNDERBOLT II",
    shortLabel: "A-10",
    tierLabel: "Especial",
    generation: "special",
    unlockCost: 55000,
    modelUrl: "/models/a10_game.glb",
  },
  {
    aircraft: Aircraft.B2,
    id: "b2",
    label: "B-2 SPIRIT",
    shortLabel: "B-2",
    tierLabel: "Elite",
    generation: "gen5",
    unlockCost: 120000,
    modelUrl: "/models/b2_game.glb",
  },
  {
    aircraft: Aircraft.U2,
    id: "u2",
    label: "U-2 DRAGON LADY",
    shortLabel: "U-2",
    tierLabel: "Especial",
    generation: "special",
    unlockCost: 65000,
    modelUrl: "/models/u2_game.glb",
  },
] as const;

/** Fleet entries grouped for Hangar (skips empty generations). */
export function fleetByGeneration(): Array<{
  id: FleetGenerationId;
  label: string;
  entries: FleetEntry[];
}> {
  return FLEET_GENERATION_ORDER.map((id) => ({
    id,
    label: FLEET_GENERATION_LABEL[id],
    entries: FLEET.filter((e) => e.generation === id),
  })).filter((g) => g.entries.length > 0);
}

const BY_AIRCRAFT = new Map(FLEET.map((e) => [e.aircraft, e]));
const BY_ID = new Map(FLEET.map((e) => [e.id, e]));
const KNOWN = new Set(FLEET.map((e) => e.aircraft));

export const F15_UNLOCK_COST = BY_AIRCRAFT.get(Aircraft.F15_EAGLE)!.unlockCost;

export function fleetEntry(aircraft: Aircraft): FleetEntry {
  return BY_AIRCRAFT.get(aircraft) ?? FLEET[0]!;
}

export function fleetById(id: string): FleetEntry | null {
  return BY_ID.get(id as FleetAircraftId) ?? null;
}

export function aircraftIdOf(aircraft: Aircraft): FleetAircraftId {
  return fleetEntry(aircraft).id;
}

export function aircraftFromId(id: string): Aircraft | null {
  return fleetById(id)?.aircraft ?? null;
}

export function aircraftLabel(aircraft: Aircraft): string {
  return fleetEntry(aircraft).label;
}

export function isKnownAircraft(value: unknown): value is Aircraft {
  return typeof value === "number" && KNOWN.has(value);
}

export function normalizeOwnedAircraft(raw: unknown): Aircraft[] {
  const list = Array.isArray(raw)
    ? raw.filter(isKnownAircraft)
    : [Aircraft.F22_RAPTOR];
  if (!list.includes(Aircraft.F22_RAPTOR)) list.unshift(Aircraft.F22_RAPTOR);
  return list;
}

export function normalizeSelectedAircraft(
  selected: unknown,
  owned: Aircraft[],
): Aircraft {
  if (isKnownAircraft(selected) && owned.includes(selected)) return selected;
  return Aircraft.F22_RAPTOR;
}
