import { PACIFIC_MAP } from "./world/pacificMap";

/** Pacific playfield size, metres. Source of truth is PACIFIC_MAP; kept for existing callers. */
export const WORLD_SIZE = PACIFIC_MAP.worldSize;
/** Pacific spawn. Source of truth is PACIFIC_MAP. */
export const MAP_SPAWN = PACIFIC_MAP.spawn;
export const CRUISE_ALT = 2200;
export const WATER_LEVEL = 0;
export const MAX_ALT = 12000;
export const SAFE_AGL = 110;
export const CRITICAL_AGL = 36;
/** Soft caution band above SAFE_AGL (AGL metres). */
export const CAUTION_AGL = 160;

/**
 * F-22 military / cruise TAS (m/s). HUD knots ≈ speed × 1.85.
 * Afterburner peak ≈ BASE_SPEED × AB_MULT (Raptor ~Mach 2.2 class).
 */
export const BASE_SPEED = 310;
export const AB_MULT = 2.35;
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
