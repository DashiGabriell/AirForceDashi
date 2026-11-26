import { PlayMode } from "@afd/shared-types";

/** Playable maps. Metropolitan is the teste 0 layout (flat, free flight only). */
export const MapId = {
  PACIFIC: "pacific",
  ARENA: "arena",
  METROPOLITAN: "metropolitan",
} as const;

export type MapId = (typeof MapId)[keyof typeof MapId];

/** Soft box half-extent. 32 km from edge to edge. */
export const ARENA_HALF = 16000;
/** Distance inside the wall where the nose starts turning back. */
export const ARENA_MARGIN = 1800;

/** Air spawn, nose toward the center (+Z). */
export const ARENA_SPAWN = { x: 0, z: -4000, heading: Math.PI };

export interface MapInfo {
  id: MapId;
  name: string;
  /** One line for the briefing. */
  blurb: string;
  /** Modes this map can host. Attack needs Pacific buildings. */
  modes: readonly PlayMode[];
}

const AIR_MODES: readonly PlayMode[] = [
  PlayMode.FREE_FLIGHT,
  PlayMode.CHECKPOINT,
  PlayMode.ANTI_DRONE,
  PlayMode.TARGET_PRACTICE,
];

export const MAPS: readonly MapInfo[] = [
  {
    id: MapId.PACIFIC,
    name: "Pacific Islands",
    blurb: "Ilhas, costa e base. Passeio e missões no terreno.",
    modes: [...AIR_MODES, PlayMode.ATTACK],
  },
  {
    id: MapId.ARENA,
    name: "Arena",
    blurb: "Céu, nuvens altas e mar. Combate sem distração.",
    modes: AIR_MODES,
  },
  {
    id: MapId.METROPOLITAN,
    name: "Metropolitan (teste 0)",
    blurb: "Layout por áreas em terreno plano. Torres de teste. Só voo livre.",
    modes: [PlayMode.FREE_FLIGHT],
  },
];

export function mapById(id: MapId | undefined): MapInfo {
  return MAPS.find((m) => m.id === id) ?? MAPS[0]!;
}

export function mapAllows(id: MapId, mode: PlayMode): boolean {
  return mapById(id).modes.includes(mode);
}

/** Falls back to Pacific when the chosen map cannot host the mode. */
export function resolveMap(id: MapId | undefined, mode: PlayMode): MapId {
  const map = mapById(id);
  return map.modes.includes(mode) ? map.id : MapId.PACIFIC;
}
