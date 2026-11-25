/** Shared enums/DTOs — no DOM, no Three. */

export enum Cam {
  CHASE = 1,
  REAR = 2,
  COCKPIT = 3,
}

export enum PlayMode {
  NONE = 0,
  FREE_FLIGHT = 1,
  CHECKPOINT = 2,
  ANTI_DRONE = 3,
  ATTACK = 4,
  TARGET_PRACTICE = 5,
}

export enum Aircraft {
  F22_RAPTOR = 0,
  F15_EAGLE = 1,
  F16_FALCON = 2,
  FA18_SUPER_HORNET = 3,
  TYPHOON = 4,
  RAFALE = 5,
  SU35 = 6,
  F35_LIGHTNING = 7,
  F14_TOMCAT = 8,
  GRIPEN = 9,
  MIRAGE_2000 = 10,
  F2 = 11,
  MIG29 = 12,
  MIG35 = 13,
  SU57 = 14,
  YF23 = 15,
  F4_PHANTOM = 16,
  SU34 = 17,
  A10 = 18,
  B2 = 19,
  U2 = 20,
}

export type QualityProfile = "low" | "medium" | "high" | "ultra";

export interface PerfSnapshot {
  fps: number;
  frameMs: number;
  drawCalls: number;
  triangles: number;
  jsHeapMb: number | null;
  /** Approx 1% low FPS from recent frame-time samples. */
  fps1Low?: number;
  /** Internal RT scale (0.6–1) when adaptive quality is active. */
  adaptiveScale?: number;
  /** Partículas VFX de combate vivas (Quarks). */
  vfxParticles?: number;
  /** Booms ativos no pool. */
  vfxBooms?: number;
  /** Impacts dropados por cap/pool (acumulado na sessão). */
  vfxDropped?: number;
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

