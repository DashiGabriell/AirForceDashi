import type { QualityProfile } from "@afd/shared-types";
import { INTERNAL_BASE_H } from "../constants";
import { normalizeFlareMode, type FlareMode } from "../combat/countermeasures";

export interface PlayerSettings {
  quality: QualityProfile;
  masterVolume: number;
  sfxVolume: number;
  /** Volume do theme de menu (0–1). */
  musicVolume: number;
  /** Música de combate durante a play. */
  fightMusicEnabled: boolean;
  /** Volume da música de combate (0–1). */
  fightMusicVolume: number;
  mouseSens: number;
  /** Flare dump: X manual / auto inbound / both. */
  flareMode: FlareMode;
}

export const DEFAULT_SETTINGS: PlayerSettings = {
  quality: "medium",
  masterVolume: 0.8,
  sfxVolume: 0.85,
  musicVolume: 0.28,
  fightMusicEnabled: true,
  fightMusicVolume: 0.55,
  mouseSens: 1,
  flareMode: "manual",
};

export function internalHeightForQuality(q: QualityProfile): number {
  switch (q) {
    case "low":
      return 260;
    case "high":
      return 480;
    case "ultra":
      return 720;
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
    quality:
      q === "low" || q === "medium" || q === "high" || q === "ultra" ? q : "medium",
    masterVolume: clamp01(partial?.masterVolume ?? DEFAULT_SETTINGS.masterVolume),
    sfxVolume: clamp01(partial?.sfxVolume ?? DEFAULT_SETTINGS.sfxVolume),
    musicVolume: clamp01(partial?.musicVolume ?? DEFAULT_SETTINGS.musicVolume),
    fightMusicEnabled:
      typeof partial?.fightMusicEnabled === "boolean"
        ? partial.fightMusicEnabled
        : DEFAULT_SETTINGS.fightMusicEnabled,
    fightMusicVolume: clamp01(
      partial?.fightMusicVolume ?? DEFAULT_SETTINGS.fightMusicVolume,
    ),
    mouseSens: Math.min(2, Math.max(0.35, partial?.mouseSens ?? 1)),
    flareMode: normalizeFlareMode(partial?.flareMode ?? DEFAULT_SETTINGS.flareMode),
  };
}
