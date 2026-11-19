import type { QualityProfile } from "@afd/shared-types";
import { INTERNAL_BASE_H } from "../constants";

export interface PlayerSettings {
  quality: QualityProfile;
  masterVolume: number;
  sfxVolume: number;
  mouseSens: number;
}

export const DEFAULT_SETTINGS: PlayerSettings = {
  quality: "medium",
  masterVolume: 0.8,
  sfxVolume: 0.85,
  mouseSens: 1,
};

export function internalHeightForQuality(q: QualityProfile): number {
  switch (q) {
    case "low":
      return 260;
    case "high":
      return 480;
    default:
      return INTERNAL_BASE_H;
  }
}

export function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

export function normalizeSettings(partial?: Partial<PlayerSettings>): PlayerSettings {
  const q = partial?.quality;
  return {
    quality: q === "low" || q === "high" || q === "medium" ? q : "medium",
    masterVolume: clamp01(partial?.masterVolume ?? DEFAULT_SETTINGS.masterVolume),
    sfxVolume: clamp01(partial?.sfxVolume ?? DEFAULT_SETTINGS.sfxVolume),
    mouseSens: Math.min(2, Math.max(0.35, partial?.mouseSens ?? 1)),
  };
}
