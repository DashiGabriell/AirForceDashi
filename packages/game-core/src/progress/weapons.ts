import { Aircraft } from "@afd/shared-types";
import { aircraftIdOf, FLEET, type FleetAircraftId } from "./fleet";

/** Papel tático do armamento no loadout. */
export type WeaponRole = "aa" | "ag";

export interface WeaponDef {
  id: string;
  label: string;
  shortLabel: string;
  role: WeaponRole;
  /** GLB público sob `/models/missiles/`. */
  modelUrl: string;
  /** Aeronaves que podem montar este armamento. */
  aircraft: readonly Aircraft[];
}

/**
 * Catálogo jogável — F-22: AIM-9 / AIM-120C (AA) + JDAM (AG).
 * Demais modelos do catálogo 3D ficam em assets até liberar por aeronave.
 */
export const WEAPONS: readonly WeaponDef[] = [
  {
    id: "aim-9-sidewinder",
    label: "AIM-9 Sidewinder",
    shortLabel: "AIM-9",
    role: "aa",
    modelUrl: "/models/missiles/aim-9-sidewinder.glb",
    aircraft: [Aircraft.F22_RAPTOR],
  },
  {
    id: "aim-120c-amraam",
    label: "AIM-120C AMRAAM",
    shortLabel: "AIM-120C",
    role: "aa",
    modelUrl: "/models/missiles/aim-120c-amraam.glb",
    aircraft: [Aircraft.F22_RAPTOR],
  },
  {
    id: "jdam",
    label: "JDAM",
    shortLabel: "JDAM",
    role: "ag",
    modelUrl: "/models/missiles/jdam.glb",
    aircraft: [Aircraft.F22_RAPTOR],
  },
] as const;

export type WeaponId = (typeof WEAPONS)[number]["id"];

/** Slots de loadout por aeronave (AA curto + AG de precisão). */
export interface AircraftLoadout {
  aaWeaponId: string;
  agWeaponId: string;
}

export type AircraftLoadoutKey = FleetAircraftId;

export type LoadoutMap = Partial<Record<AircraftLoadoutKey, AircraftLoadout>>;

export const DEFAULT_F22_LOADOUT: AircraftLoadout = {
  aaWeaponId: "aim-9-sidewinder",
  agWeaponId: "jdam",
};

export const DEFAULT_EMPTY_LOADOUT: AircraftLoadout = {
  aaWeaponId: "",
  agWeaponId: "",
};

/** @deprecated use DEFAULT_EMPTY_LOADOUT */
export const DEFAULT_F15_LOADOUT = DEFAULT_EMPTY_LOADOUT;

export const DEFAULT_LOADOUTS: LoadoutMap = Object.fromEntries(
  FLEET.map((entry) => [
    entry.id,
    entry.aircraft === Aircraft.F22_RAPTOR
      ? { ...DEFAULT_F22_LOADOUT }
      : { ...DEFAULT_EMPTY_LOADOUT },
  ]),
) as LoadoutMap;

export function aircraftLoadoutKey(aircraft: Aircraft): AircraftLoadoutKey {
  return aircraftIdOf(aircraft);
}

export function weaponById(id: string | undefined | null): WeaponDef | null {
  if (!id) return null;
  return WEAPONS.find((w) => w.id === id) ?? null;
}

export function weaponsForAircraft(
  aircraft: Aircraft,
  role?: WeaponRole,
): WeaponDef[] {
  return WEAPONS.filter(
    (w) =>
      w.aircraft.includes(aircraft) && (role === undefined || w.role === role),
  );
}

export function isWeaponCompatible(
  weaponId: string,
  aircraft: Aircraft,
  role?: WeaponRole,
): boolean {
  const w = weaponById(weaponId);
  if (!w) return false;
  if (!w.aircraft.includes(aircraft)) return false;
  if (role !== undefined && w.role !== role) return false;
  return true;
}

export function defaultLoadoutFor(aircraft: Aircraft): AircraftLoadout {
  return aircraft === Aircraft.F22_RAPTOR
    ? { ...DEFAULT_F22_LOADOUT }
    : { ...DEFAULT_EMPTY_LOADOUT };
}

/** Garante IDs compatíveis (ou vazio) para a aeronave. */
export function normalizeAircraftLoadout(
  aircraft: Aircraft,
  raw?: Partial<AircraftLoadout> | null,
): AircraftLoadout {
  const fallback = defaultLoadoutFor(aircraft);
  const aa =
    raw?.aaWeaponId && isWeaponCompatible(raw.aaWeaponId, aircraft, "aa")
      ? raw.aaWeaponId
      : fallback.aaWeaponId;
  const ag =
    raw?.agWeaponId && isWeaponCompatible(raw.agWeaponId, aircraft, "ag")
      ? raw.agWeaponId
      : fallback.agWeaponId;
  return { aaWeaponId: aa, agWeaponId: ag };
}

export function normalizeLoadoutMap(raw?: LoadoutMap | null): LoadoutMap {
  const out: LoadoutMap = {};
  for (const entry of FLEET) {
    out[entry.id] = normalizeAircraftLoadout(
      entry.aircraft,
      raw?.[entry.id] ?? DEFAULT_LOADOUTS[entry.id],
    );
  }
  return out;
}

export function loadoutForAircraft(
  map: LoadoutMap | undefined,
  aircraft: Aircraft,
): AircraftLoadout {
  const key = aircraftLoadoutKey(aircraft);
  return normalizeAircraftLoadout(aircraft, map?.[key]);
}
