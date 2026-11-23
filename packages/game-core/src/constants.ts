/** Pacific Islands playfield, metres. Matches the baked heightmap. */
export const WORLD_SIZE = 16000;
/** Free-flight spawn: over the water south-west of Dashi AFB, nose toward the runway. */
export const MAP_SPAWN = { x: -2800, z: -2520, heading: Math.atan2(-1000, -1620) };
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
