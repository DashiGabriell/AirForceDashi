import { Aircraft } from "@afd/shared-types";
import { aircraftIdOf, FLEET, type FleetAircraftId } from "./fleet";

/** Papel tático do armamento no loadout. */
export type WeaponRole = "aa" | "ag";

/** Família de engajamento (MVP: BVR simplificado, WVR/AG sólidos). */
export type WeaponCategory = "wvr" | "bvr" | "ag";

/** Multiplicadores leves no handling do jato quando o rack está equipado. */
export type WeaponHandlingBias = Partial<{
  baseSpeed: number;
  abMult: number;
  turnRate: number;
  pitchRate: number;
  accelRate: number;
}>;

export interface WeaponDef {
  id: string;
  label: string;
  shortLabel: string;
  role: WeaponRole;
  category: WeaponCategory;
  /** GLB público sob `/models/missiles/`. */
  modelUrl: string;
  /** Aeronaves que podem montar este armamento. */
  aircraft: readonly Aircraft[];
  /** Peso relativo (soma vs payloadCapacity da aeronave). */
  mass: number;
  /** Dano arcade em alvos/destructibles. */
  damage: number;
  /** Raio de blast no impacto. */
  blastRadius: number;
  /** Raio de hit em segmento (drones). */
  hitRadius: number;
  /** Mult. sobre MISSILE_SPEED. */
  speedMult: number;
  /** Mult. sobre MISSILE_LIFE (alcance efetivo). */
  lifeMult: number;
  /** Mult. sobre MISSILE_REARM (maior = mais lento). */
  rearmMult: number;
  blurb: string;
  tradeoff: string;
  handlingBias: WeaponHandlingBias;
}

const WEST: readonly Aircraft[] = [
  Aircraft.F22_RAPTOR,
  Aircraft.F15_EAGLE,
  Aircraft.F16_FALCON,
  Aircraft.FA18_SUPER_HORNET,
  Aircraft.TYPHOON,
  Aircraft.RAFALE,
  Aircraft.F35_LIGHTNING,
  Aircraft.F14_TOMCAT,
  Aircraft.GRIPEN,
  Aircraft.MIRAGE_2000,
  Aircraft.F2,
  Aircraft.YF23,
  Aircraft.F4_PHANTOM,
  Aircraft.A10,
  Aircraft.B2,
  Aircraft.U2,
];

const EAST: readonly Aircraft[] = [
  Aircraft.SU35,
  Aircraft.MIG29,
  Aircraft.MIG35,
  Aircraft.SU57,
  Aircraft.SU34,
];

const STRIKE_WEST: readonly Aircraft[] = [
  Aircraft.F15_EAGLE,
  Aircraft.F16_FALCON,
  Aircraft.FA18_SUPER_HORNET,
  Aircraft.TYPHOON,
  Aircraft.RAFALE,
  Aircraft.F35_LIGHTNING,
  Aircraft.F2,
  Aircraft.F4_PHANTOM,
  Aircraft.A10,
  Aircraft.B2,
  Aircraft.F22_RAPTOR,
  Aircraft.YF23,
];

function w(
  partial: Omit<WeaponDef, "handlingBias"> & { handlingBias?: WeaponHandlingBias },
): WeaponDef {
  return { handlingBias: {}, ...partial };
}

/**
 * Catálogo jogável — modelos GLB existentes + stats arcade derivados do papel real.
 */
export const WEAPONS: readonly WeaponDef[] = [
  w({
    id: "aim-9-sidewinder",
    label: "AIM-9 Sidewinder",
    shortLabel: "AIM-9",
    role: "aa",
    category: "wvr",
    modelUrl: "/models/missiles/aim-9-sidewinder.glb",
    aircraft: WEST,
    mass: 2.2,
    damage: 1,
    blastRadius: 14,
    hitRadius: 11,
    speedMult: 1.05,
    lifeMult: 0.85,
    rearmMult: 0.85,
    blurb: "WVR IR — perseguição curta, lock rápido.",
    tradeoff: "Leve no jato · alcance curto",
    handlingBias: { turnRate: 1.02, accelRate: 1.02 },
  }),
  w({
    id: "aim-132-asraam",
    label: "AIM-132 ASRAAM",
    shortLabel: "ASRAAM",
    role: "aa",
    category: "wvr",
    modelUrl: "/models/missiles/aim-132-asraam.glb",
    aircraft: [
      Aircraft.TYPHOON,
      Aircraft.RAFALE,
      Aircraft.GRIPEN,
      Aircraft.F35_LIGHTNING,
      Aircraft.FA18_SUPER_HORNET,
    ],
    mass: 2.4,
    damage: 1.1,
    blastRadius: 15,
    hitRadius: 12,
    speedMult: 1.08,
    lifeMult: 0.9,
    rearmMult: 0.9,
    blurb: "WVR europeu — alta off-boresight.",
    tradeoff: "Excelente em dogfight · pouco BVR",
    handlingBias: { turnRate: 1.01 },
  }),
  w({
    id: "aim-120c-amraam",
    label: "AIM-120C AMRAAM",
    shortLabel: "AIM-120C",
    role: "aa",
    category: "bvr",
    modelUrl: "/models/missiles/aim-120c-amraam.glb",
    aircraft: WEST.filter((a) => a !== Aircraft.U2 && a !== Aircraft.A10),
    mass: 3.6,
    damage: 1.35,
    blastRadius: 18,
    hitRadius: 13,
    speedMult: 1.12,
    lifeMult: 1.25,
    rearmMult: 1.15,
    blurb: "BVR ativo — médio/longo alcance.",
    tradeoff: "Mais dano/alcance · mais peso",
    handlingBias: { baseSpeed: 0.97, turnRate: 0.96, accelRate: 0.96 },
  }),
  w({
    id: "aim-120-amraam",
    label: "AIM-120 AMRAAM",
    shortLabel: "AIM-120",
    role: "aa",
    category: "bvr",
    modelUrl: "/models/missiles/aim-120-amraam.glb",
    aircraft: [
      Aircraft.F15_EAGLE,
      Aircraft.F16_FALCON,
      Aircraft.FA18_SUPER_HORNET,
      Aircraft.F4_PHANTOM,
      Aircraft.F14_TOMCAT,
    ],
    mass: 3.4,
    damage: 1.25,
    blastRadius: 17,
    hitRadius: 12,
    speedMult: 1.1,
    lifeMult: 1.15,
    rearmMult: 1.1,
    blurb: "BVR clássico — equilíbrio alcance/peso.",
    tradeoff: "Bom BVR · atrasa o jato um pouco",
    handlingBias: { baseSpeed: 0.98, turnRate: 0.97 },
  }),
  w({
    id: "aim-7-sparrow",
    label: "AIM-7 Sparrow",
    shortLabel: "AIM-7",
    role: "aa",
    category: "bvr",
    modelUrl: "/models/missiles/aim-7-sparrow.glb",
    aircraft: [Aircraft.F14_TOMCAT, Aircraft.F4_PHANTOM, Aircraft.F15_EAGLE],
    mass: 3.8,
    damage: 1.2,
    blastRadius: 16,
    hitRadius: 11,
    speedMult: 1.0,
    lifeMult: 1.1,
    rearmMult: 1.2,
    blurb: "Semi-ativo legado — BVR antigo.",
    tradeoff: "Alcance ok · pesado e lento de rearmar",
    handlingBias: { baseSpeed: 0.96, turnRate: 0.94, accelRate: 0.94 },
  }),
  w({
    id: "aim-54-phoenix",
    label: "AIM-54 Phoenix",
    shortLabel: "AIM-54",
    role: "aa",
    category: "bvr",
    modelUrl: "/models/missiles/aim-54-phoenix.glb",
    aircraft: [Aircraft.F14_TOMCAT],
    mass: 5.2,
    damage: 1.7,
    blastRadius: 22,
    hitRadius: 14,
    speedMult: 1.18,
    lifeMult: 1.55,
    rearmMult: 1.45,
    blurb: "BVR naval extremo — longo alcance.",
    tradeoff: "Dano/alcance altos · jato bem mais lento",
    handlingBias: { baseSpeed: 0.9, turnRate: 0.88, pitchRate: 0.9, accelRate: 0.88 },
  }),
  w({
    id: "r-77",
    label: "R-77 Adder",
    shortLabel: "R-77",
    role: "aa",
    category: "bvr",
    modelUrl: "/models/missiles/r-77.glb",
    aircraft: EAST,
    mass: 3.5,
    damage: 1.3,
    blastRadius: 17,
    hitRadius: 13,
    speedMult: 1.1,
    lifeMult: 1.2,
    rearmMult: 1.12,
    blurb: "BVR russo — médio alcance ativo.",
    tradeoff: "Bom BVR · peso médio",
    handlingBias: { baseSpeed: 0.97, turnRate: 0.96 },
  }),
  w({
    id: "r-27",
    label: "R-27 Alamo",
    shortLabel: "R-27",
    role: "aa",
    category: "bvr",
    modelUrl: "/models/missiles/r-27.glb",
    aircraft: EAST,
    mass: 3.9,
    damage: 1.25,
    blastRadius: 16,
    hitRadius: 12,
    speedMult: 1.05,
    lifeMult: 1.15,
    rearmMult: 1.18,
    blurb: "BVR semi-ativo — energia de interceptação.",
    tradeoff: "Alcance · menos ágil no jato",
    handlingBias: { baseSpeed: 0.96, turnRate: 0.95, accelRate: 0.95 },
  }),
  w({
    id: "r-27-b",
    label: "R-27 ER",
    shortLabel: "R-27ER",
    role: "aa",
    category: "wvr",
    modelUrl: "/models/missiles/r-27-b.glb",
    aircraft: [Aircraft.SU35, Aircraft.MIG29, Aircraft.MIG35, Aircraft.SU57],
    mass: 2.6,
    damage: 1.05,
    blastRadius: 14,
    hitRadius: 12,
    speedMult: 1.06,
    lifeMult: 0.95,
    rearmMult: 0.95,
    blurb: "Variante ágil — pressão em médio/curto.",
    tradeoff: "Mais leve que R-77 · menos BVR",
    handlingBias: { turnRate: 1.01 },
  }),
  w({
    id: "ks-172-novator",
    label: "KS-172 Novator",
    shortLabel: "KS-172",
    role: "aa",
    category: "bvr",
    modelUrl: "/models/missiles/ks-172-novator.glb",
    aircraft: [Aircraft.SU57, Aircraft.SU35],
    mass: 5.5,
    damage: 1.8,
    blastRadius: 24,
    hitRadius: 15,
    speedMult: 1.2,
    lifeMult: 1.6,
    rearmMult: 1.5,
    blurb: "BVR extremo — caça AWACS / longo alcance.",
    tradeoff: "Dano máximo · peso severo",
    handlingBias: { baseSpeed: 0.88, turnRate: 0.86, pitchRate: 0.88, accelRate: 0.85 },
  }),
  w({
    id: "ty-90",
    label: "TY-90",
    shortLabel: "TY-90",
    role: "aa",
    category: "wvr",
    modelUrl: "/models/missiles/ty-90.glb",
    aircraft: [Aircraft.SU34, Aircraft.MIG35],
    mass: 2.0,
    damage: 0.95,
    blastRadius: 12,
    hitRadius: 10,
    speedMult: 1.0,
    lifeMult: 0.8,
    rearmMult: 0.8,
    blurb: "WVR leve — defesa de curto alcance.",
    tradeoff: "Muito leve · pouco punch",
    handlingBias: { accelRate: 1.03, turnRate: 1.02 },
  }),
  w({
    id: "jdam",
    label: "JDAM",
    shortLabel: "JDAM",
    role: "ag",
    category: "ag",
    modelUrl: "/models/missiles/jdam.glb",
    aircraft: [...STRIKE_WEST, Aircraft.U2, Aircraft.MIRAGE_2000, Aircraft.F14_TOMCAT],
    mass: 4.5,
    damage: 1.6,
    blastRadius: 26,
    hitRadius: 14,
    speedMult: 0.85,
    lifeMult: 1.0,
    rearmMult: 1.25,
    blurb: "Bomba guiada GPS — precisão em solo.",
    tradeoff: "Alto dano AG · jato mais lento",
    handlingBias: { baseSpeed: 0.94, turnRate: 0.93, accelRate: 0.92 },
  }),
  w({
    id: "jdam-b",
    label: "JDAM (rack B)",
    shortLabel: "JDAM-B",
    role: "ag",
    category: "ag",
    modelUrl: "/models/missiles/jdam-b.glb",
    aircraft: [Aircraft.B2, Aircraft.F15_EAGLE, Aircraft.F35_LIGHTNING],
    mass: 4.8,
    damage: 1.7,
    blastRadius: 28,
    hitRadius: 14,
    speedMult: 0.82,
    lifeMult: 1.0,
    rearmMult: 1.3,
    blurb: "JDAM reforçado — mais massa, mais crater.",
    tradeoff: "Dano AG ↑ · peso ↑",
    handlingBias: { baseSpeed: 0.92, turnRate: 0.9, accelRate: 0.9 },
  }),
  w({
    id: "gbu-12-paveway-ii",
    label: "GBU-12 Paveway II",
    shortLabel: "GBU-12",
    role: "ag",
    category: "ag",
    modelUrl: "/models/missiles/gbu-12-paveway-ii.glb",
    aircraft: [
      Aircraft.F16_FALCON,
      Aircraft.FA18_SUPER_HORNET,
      Aircraft.F15_EAGLE,
      Aircraft.F2,
      Aircraft.A10,
      Aircraft.RAFALE,
      Aircraft.TYPHOON,
    ],
    mass: 3.8,
    damage: 1.45,
    blastRadius: 22,
    hitRadius: 13,
    speedMult: 0.88,
    lifeMult: 0.95,
    rearmMult: 1.15,
    blurb: "Laser Paveway — preciso e um pouco mais leve.",
    tradeoff: "Bom AG · menos massa que JDAM",
    handlingBias: { baseSpeed: 0.96, turnRate: 0.95 },
  }),
  w({
    id: "gbu-24-paveway",
    label: "GBU-24 Paveway",
    shortLabel: "GBU-24",
    role: "ag",
    category: "ag",
    modelUrl: "/models/missiles/gbu-24-paveway.glb",
    aircraft: [Aircraft.F15_EAGLE, Aircraft.F4_PHANTOM, Aircraft.B2, Aircraft.A10],
    mass: 5.2,
    damage: 2.0,
    blastRadius: 32,
    hitRadius: 15,
    speedMult: 0.78,
    lifeMult: 1.05,
    rearmMult: 1.4,
    blurb: "Paveway pesada — penetra e explode forte.",
    tradeoff: "Dano máximo AG · jato bem carregado",
    handlingBias: { baseSpeed: 0.9, turnRate: 0.88, accelRate: 0.86 },
  }),
  w({
    id: "agm-65-maverick",
    label: "AGM-65 Maverick",
    shortLabel: "Maverick",
    role: "ag",
    category: "ag",
    modelUrl: "/models/missiles/agm-65-maverick.glb",
    aircraft: [
      Aircraft.A10,
      Aircraft.F16_FALCON,
      Aircraft.FA18_SUPER_HORNET,
      Aircraft.F4_PHANTOM,
      Aircraft.F15_EAGLE,
    ],
    mass: 3.2,
    damage: 1.4,
    blastRadius: 20,
    hitRadius: 12,
    speedMult: 1.0,
    lifeMult: 1.05,
    rearmMult: 1.05,
    blurb: "AGM tático — velocidade de míssil em solo.",
    tradeoff: "AG ágil · dano médio",
    handlingBias: { baseSpeed: 0.97, accelRate: 0.97 },
  }),
  w({
    id: "agm-114-hellfire",
    label: "AGM-114 Hellfire",
    shortLabel: "Hellfire",
    role: "ag",
    category: "ag",
    modelUrl: "/models/missiles/agm-114-hellfire.glb",
    aircraft: [Aircraft.A10, Aircraft.FA18_SUPER_HORNET],
    mass: 2.4,
    damage: 1.15,
    blastRadius: 16,
    hitRadius: 11,
    speedMult: 1.05,
    lifeMult: 0.9,
    rearmMult: 0.9,
    blurb: "Precisão leve — vários tiros rápidos.",
    tradeoff: "Leve · menos crater",
    handlingBias: { turnRate: 1.01, accelRate: 1.01 },
  }),
  w({
    id: "agm-154-jsow",
    label: "AGM-154 JSOW",
    shortLabel: "JSOW",
    role: "ag",
    category: "ag",
    modelUrl: "/models/missiles/agm-154-jsow.glb",
    aircraft: [Aircraft.FA18_SUPER_HORNET, Aircraft.F35_LIGHTNING, Aircraft.B2, Aircraft.F15_EAGLE],
    mass: 4.2,
    damage: 1.55,
    blastRadius: 24,
    hitRadius: 13,
    speedMult: 0.9,
    lifeMult: 1.2,
    rearmMult: 1.2,
    blurb: "Planador stand-off — alcance AG maior.",
    tradeoff: "Alcance AG · peso médio-alto",
    handlingBias: { baseSpeed: 0.95, turnRate: 0.94 },
  }),
  w({
    id: "mbda-brimstone",
    label: "MBDA Brimstone",
    shortLabel: "Brimstone",
    role: "ag",
    category: "ag",
    modelUrl: "/models/missiles/mbda-brimstone.glb",
    aircraft: [Aircraft.TYPHOON, Aircraft.RAFALE, Aircraft.GRIPEN],
    mass: 2.8,
    damage: 1.25,
    blastRadius: 18,
    hitRadius: 12,
    speedMult: 1.02,
    lifeMult: 1.0,
    rearmMult: 0.95,
    blurb: "AG europeu — preciso e relativamente leve.",
    tradeoff: "Bom AG tático · menos área",
    handlingBias: { accelRate: 0.99 },
  }),
  w({
    id: "mk83-bomb",
    label: "Mk 83 Bomb",
    shortLabel: "Mk83",
    role: "ag",
    category: "ag",
    modelUrl: "/models/missiles/mk83-bomb.glb",
    aircraft: [Aircraft.F4_PHANTOM, Aircraft.A10, Aircraft.FA18_SUPER_HORNET, Aircraft.B2],
    mass: 5.0,
    damage: 1.9,
    blastRadius: 30,
    hitRadius: 14,
    speedMult: 0.75,
    lifeMult: 0.9,
    rearmMult: 1.35,
    blurb: "Bomba burra pesada — área e impacto.",
    tradeoff: "Dano bruto · atrasa muito o jato",
    handlingBias: { baseSpeed: 0.9, turnRate: 0.87, accelRate: 0.85 },
  }),
  w({
    id: "kh-29",
    label: "Kh-29",
    shortLabel: "Kh-29",
    role: "ag",
    category: "ag",
    modelUrl: "/models/missiles/kh-29.glb",
    aircraft: EAST,
    mass: 4.6,
    damage: 1.65,
    blastRadius: 25,
    hitRadius: 13,
    speedMult: 0.95,
    lifeMult: 1.1,
    rearmMult: 1.22,
    blurb: "AGM russo pesado — punch em solo.",
    tradeoff: "Dano alto · peso alto",
    handlingBias: { baseSpeed: 0.93, turnRate: 0.92, accelRate: 0.9 },
  }),
  w({
    id: "kab-500l",
    label: "KAB-500L",
    shortLabel: "KAB-500",
    role: "ag",
    category: "ag",
    modelUrl: "/models/missiles/kab-500l.glb",
    aircraft: [Aircraft.SU34, Aircraft.SU35, Aircraft.SU57, Aircraft.MIG35],
    mass: 5.0,
    damage: 1.85,
    blastRadius: 28,
    hitRadius: 14,
    speedMult: 0.8,
    lifeMult: 0.95,
    rearmMult: 1.3,
    blurb: "Bomba guiada 500 kg — crater russa.",
    tradeoff: "Máximo AG · manobra sofre",
    handlingBias: { baseSpeed: 0.9, turnRate: 0.88, accelRate: 0.86 },
  }),
] as const;

export type WeaponId = (typeof WEAPONS)[number]["id"];

/** Slots de loadout por aeronave (AA + AG). */
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

const DEFAULT_BY_AIRCRAFT: Partial<Record<Aircraft, AircraftLoadout>> = {
  [Aircraft.F22_RAPTOR]: { aaWeaponId: "aim-9-sidewinder", agWeaponId: "jdam" },
  [Aircraft.F15_EAGLE]: { aaWeaponId: "aim-120c-amraam", agWeaponId: "jdam" },
  [Aircraft.F16_FALCON]: { aaWeaponId: "aim-9-sidewinder", agWeaponId: "gbu-12-paveway-ii" },
  [Aircraft.FA18_SUPER_HORNET]: { aaWeaponId: "aim-9-sidewinder", agWeaponId: "agm-65-maverick" },
  [Aircraft.TYPHOON]: { aaWeaponId: "aim-132-asraam", agWeaponId: "mbda-brimstone" },
  [Aircraft.RAFALE]: { aaWeaponId: "aim-120c-amraam", agWeaponId: "mbda-brimstone" },
  [Aircraft.SU35]: { aaWeaponId: "r-77", agWeaponId: "kh-29" },
  [Aircraft.F35_LIGHTNING]: { aaWeaponId: "aim-120c-amraam", agWeaponId: "agm-154-jsow" },
  [Aircraft.F14_TOMCAT]: { aaWeaponId: "aim-54-phoenix", agWeaponId: "jdam" },
  [Aircraft.GRIPEN]: { aaWeaponId: "aim-9-sidewinder", agWeaponId: "mbda-brimstone" },
  [Aircraft.MIRAGE_2000]: { aaWeaponId: "aim-9-sidewinder", agWeaponId: "jdam" },
  [Aircraft.F2]: { aaWeaponId: "aim-9-sidewinder", agWeaponId: "gbu-12-paveway-ii" },
  [Aircraft.MIG29]: { aaWeaponId: "r-27-b", agWeaponId: "kh-29" },
  [Aircraft.MIG35]: { aaWeaponId: "r-77", agWeaponId: "kab-500l" },
  [Aircraft.SU57]: { aaWeaponId: "r-77", agWeaponId: "kab-500l" },
  [Aircraft.YF23]: { aaWeaponId: "aim-120c-amraam", agWeaponId: "jdam" },
  [Aircraft.F4_PHANTOM]: { aaWeaponId: "aim-7-sparrow", agWeaponId: "mk83-bomb" },
  [Aircraft.SU34]: { aaWeaponId: "ty-90", agWeaponId: "kab-500l" },
  [Aircraft.A10]: { aaWeaponId: "aim-9-sidewinder", agWeaponId: "agm-65-maverick" },
  [Aircraft.B2]: { aaWeaponId: "aim-120c-amraam", agWeaponId: "jdam-b" },
  [Aircraft.U2]: { aaWeaponId: "aim-9-sidewinder", agWeaponId: "jdam" },
};

export function weaponById(id: string | undefined | null): WeaponDef | null {
  if (!id) return null;
  return WEAPONS.find((x) => x.id === id) ?? null;
}

export function weaponsForAircraft(
  aircraft: Aircraft,
  role?: WeaponRole,
): WeaponDef[] {
  return WEAPONS.filter(
    (x) =>
      x.aircraft.includes(aircraft) && (role === undefined || x.role === role),
  );
}

export function isWeaponCompatible(
  weaponId: string,
  aircraft: Aircraft,
  role?: WeaponRole,
): boolean {
  const def = weaponById(weaponId);
  if (!def) return false;
  if (!def.aircraft.includes(aircraft)) return false;
  if (role !== undefined && def.role !== role) return false;
  return true;
}

export function defaultLoadoutFor(aircraft: Aircraft): AircraftLoadout {
  const preset = DEFAULT_BY_AIRCRAFT[aircraft];
  const aaOptions = weaponsForAircraft(aircraft, "aa");
  const agOptions = weaponsForAircraft(aircraft, "ag");
  const aa =
    preset?.aaWeaponId &&
    aaOptions.some((x) => x.id === preset.aaWeaponId)
      ? preset.aaWeaponId
      : (aaOptions[0]?.id ?? "");
  const ag =
    preset?.agWeaponId &&
    agOptions.some((x) => x.id === preset.agWeaponId)
      ? preset.agWeaponId
      : (agOptions[0]?.id ?? "");
  return { aaWeaponId: aa, agWeaponId: ag };
}

export const DEFAULT_LOADOUTS: LoadoutMap = Object.fromEntries(
  FLEET.map((entry) => [entry.id, defaultLoadoutFor(entry.aircraft)]),
) as LoadoutMap;

export function aircraftLoadoutKey(aircraft: Aircraft): AircraftLoadoutKey {
  return aircraftIdOf(aircraft);
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

export const WEAPON_CATEGORY_LABEL: Record<WeaponCategory, string> = {
  wvr: "WVR · curto",
  bvr: "BVR · longo",
  ag: "Ar-solo",
};
