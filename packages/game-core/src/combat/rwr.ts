/** Pilot RWR — painted / inbound seeker alerts. */

export type RwrLevel = "none" | "lock" | "missile";

export interface RwrState {
  level: RwrLevel;
}

/** Seconds a hostile must paint before launch (gives LOCK window). */
export const RWR_LOCK_ACQUIRE = 0.85;
/** Same band Anti-Drone uses for seeker launch. */
export const RWR_PAINT_MIN = 80;
export const RWR_PAINT_MAX = 520;

export function evaluateRwr(opts: {
  /** Active seekPlayer missile still tracking the player. */
  missileThreat: boolean;
  /** Hostile unit currently locking / painting the player. */
  painted: boolean;
}): RwrLevel {
  if (opts.missileThreat) return "missile";
  if (opts.painted) return "lock";
  return "none";
}

export function emptyRwr(): RwrState {
  return { level: "none" };
}
