import { Aircraft } from "@afd/shared-types";

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
 * Catálogo jogável — começa com o que o F-22 realmente usa neste pack.
 * Expandir por aeronave conforme novos modelos forem liberados.
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

export type AircraftLoadoutKey = "f22" | "f15";

export type LoadoutMap = Partial<Record<AircraftLoadoutKey, AircraftLoadout>>;

export const DEFAULT_F22_LOADOUT: AircraftLoadout = {
  aaWeaponId: "aim-9-sidewinder",
  agWeaponId: "jdam",
};

export const DEFAULT_F15_LOADOUT: AircraftLoadout = {
  aaWeaponId: "",
  agWeaponId: "",
};

export const DEFAULT_LOADOUTS: LoadoutMap = {
  f22: { ...DEFAULT_F22_LOADOUT },
  f15: { ...DEFAULT_F15_LOADOUT },
};

export function aircraftLoadoutKey(aircraft: Aircraft): AircraftLoadoutKey {
  return aircraft === Aircraft.F15_EAGLE ? "f15" : "f22";
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
  return aircraft === Aircraft.F15_EAGLE
    ? { ...DEFAULT_F15_LOADOUT }
    : { ...DEFAULT_F22_LOADOUT };
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
  return {
    f22: normalizeAircraftLoadout(
      Aircraft.F22_RAPTOR,
      raw?.f22 ?? DEFAULT_F22_LOADOUT,
    ),
    f15: normalizeAircraftLoadout(
      Aircraft.F15_EAGLE,
      raw?.f15 ?? DEFAULT_F15_LOADOUT,
    ),
  };
}

export function loadoutForAircraft(
  map: LoadoutMap | undefined,
  aircraft: Aircraft,
): AircraftLoadout {
  const key = aircraftLoadoutKey(aircraft);
  return normalizeAircraftLoadout(aircraft, map?.[key]);
}
