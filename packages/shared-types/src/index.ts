/** Shared enums/DTOs — no DOM, no Three. */

export enum Cam {
  TOP = 0,
  CHASE = 1,
  REAR = 2,
  COCKPIT = 3,
  FREE = 4,
}

export enum PlayMode {
  NONE = 0,
  FREE_FLIGHT = 1,
  CHECKPOINT = 2,
  ANTI_DRONE = 3,
  ATTACK = 4,
}

export enum Aircraft {
  F22_RAPTOR = 0,
  F15_EAGLE = 1,
}

export type QualityProfile = "low" | "medium" | "high";

export interface PerfSnapshot {
  fps: number;
  frameMs: number;
  drawCalls: number;
  triangles: number;
  jsHeapMb: number | null;
}

export interface BundleBudget {
  /** Max initial JS transfer (approx), bytes gzip-ish gate on raw bundle for M0. */
  maxEntryJsBytes: number;
}

/** M0 gate — tighten in later phases (see docs/migracao-threejs-v1.md §1.1). */
export const M0_BUNDLE_BUDGET: BundleBudget = {
  maxEntryJsBytes: 900_000,
};

/** M1 gate — flight scene + cameras still under soft ceiling. */
export const M1_BUNDLE_BUDGET: BundleBudget = {
  maxEntryJsBytes: 1_100_000,
};

/** M2 gate — world streaming + instancing. */
export const M2_BUNDLE_BUDGET: BundleBudget = {
  maxEntryJsBytes: 1_250_000,
};

/** M3 gate — missions + FX. */
export const M3_BUNDLE_BUDGET: BundleBudget = {
  maxEntryJsBytes: 1_450_000,
};

/** M4 gate — product hubs shell. */
export const M4_BUNDLE_BUDGET: BundleBudget = {
  maxEntryJsBytes: 1_550_000,
};

export {
  previewReward,
  type MissionRewardDto,
} from "./reward";

