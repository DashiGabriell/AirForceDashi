import type { PlaceOfInterest } from "./places";

/** Height samples on a square grid, row-major (z rows, x columns). */
export interface MapHeightfield {
  /** Samples per side. */
  readonly res: number;
  /** Metres at u16 = 0. */
  readonly hmin: number;
  /** Metres at u16 = 65535. */
  readonly hmax: number;
  readonly u16: Uint16Array;
}

export interface MapSpawn {
  readonly x: number;
  readonly z: number;
  readonly heading: number;
}

export interface MapVillage {
  readonly x: number;
  readonly z: number;
  /** Metres. Inside it, low ground reads as SUBURB. */
  readonly radius: number;
}

/**
 * Everything that makes one playable map different from another.
 * Sea level, flight physics and HUD stay global; they are not part of a map.
 */
export interface MapDefinition {
  readonly id: string;
  /** Side of the square playfield, metres. Outside it is open water. */
  readonly worldSize: number;
  readonly spawn: MapSpawn;
  readonly heightfield: MapHeightfield;
  readonly village: MapVillage;
  readonly places: readonly PlaceOfInterest[];
}
