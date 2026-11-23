/** Pacific Islands playfield, metres. Matches the baked heightmap. */
export const WORLD_SIZE = 16000;
/** Approach from the west, nose toward runway 09. */
export const MAP_SPAWN = { x: -4200, z: -1800, heading: -Math.PI / 2 };
export const CRUISE_ALT = 2200;
export const WATER_LEVEL = 0;
export const MAX_ALT = 12000;
export const SAFE_AGL = 110;
export const CRITICAL_AGL = 36;

export const BASE_SPEED = 95;
export const AB_MULT = 1.65;
export const TURN_RATE = 1.15;
export const PITCH_RATE = 1.05;
export const ROLL_RESP = 3.2;
export const ROLL_AMOUNT = 1.05;
export const STEER_SMOOTH = 8;
export const AUTO_PULL = 2.4;
export const MIN_AGL = 18;
export const VERTICAL_DOT = 0.72;

/** Internal render height for pixel look (Godot INTERNAL_BASE_H ≈ 340). */
export const INTERNAL_BASE_H = 340;
