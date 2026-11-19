import { Aircraft } from "@afd/shared-types";
import { clampAvatarId } from "./avatars";
import { jetSkinById } from "./skins";
import {
  DEFAULT_SETTINGS,
  normalizeSettings,
  type PlayerSettings,
} from "./settings";

export interface LocalProgress {
  callsign: string;
  /** 0..5 — mesmo índice do Godot `Game.avatar_id`. */
  avatarId: number;
  /** Livrea do material Paint (`JET_SKINS`). */
  skinId: string;
  aircraft: Aircraft;
  ownedAircraft: Aircraft[];
  cpUnlocked: number;
  adUnlocked: number;
  atUnlocked: number;
  /** Offline Credits stub — server becomes source of truth in M5. */
  credits: number;
  xp: number;
  settings: PlayerSettings;
}

const KEY = "afd_progress_v1";
export const F15_UNLOCK_COST = 8000;

export const DEFAULT_PROGRESS: LocalProgress = {
  callsign: "DASHI-1",
  avatarId: 0,
  skinId: "factory",
  aircraft: Aircraft.F22_RAPTOR,
  ownedAircraft: [Aircraft.F22_RAPTOR],
  cpUnlocked: 1,
  adUnlocked: 1,
  atUnlocked: 1,
  credits: 500,
  xp: 0,
  settings: { ...DEFAULT_SETTINGS },
};

export function loadProgress(): LocalProgress {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (!raw) return structuredClone(DEFAULT_PROGRESS);
    const parsed = JSON.parse(raw) as Partial<LocalProgress> & {
      settings?: Partial<PlayerSettings>;
    };
    const owned = Array.isArray(parsed.ownedAircraft)
      ? parsed.ownedAircraft.filter(
          (a) => a === Aircraft.F22_RAPTOR || a === Aircraft.F15_EAGLE,
        )
      : [Aircraft.F22_RAPTOR];
    if (!owned.includes(Aircraft.F22_RAPTOR)) owned.unshift(Aircraft.F22_RAPTOR);

    const aircraft =
      parsed.aircraft === Aircraft.F15_EAGLE && owned.includes(Aircraft.F15_EAGLE)
        ? Aircraft.F15_EAGLE
        : Aircraft.F22_RAPTOR;

    return {
      callsign: String(parsed.callsign || DEFAULT_PROGRESS.callsign).slice(0, 16),
      avatarId: clampAvatarId(
        typeof parsed.avatarId === "number" ? parsed.avatarId : 0,
      ),
      skinId: jetSkinById(typeof parsed.skinId === "string" ? parsed.skinId : "factory").id,
      aircraft,
      ownedAircraft: owned,
      cpUnlocked: clampLevel(parsed.cpUnlocked ?? 1),
      adUnlocked: clampLevel(parsed.adUnlocked ?? 1),
      atUnlocked: clampLevel(parsed.atUnlocked ?? 1),
      credits: Math.max(0, Math.floor(parsed.credits ?? DEFAULT_PROGRESS.credits)),
      xp: Math.max(0, Math.floor(parsed.xp ?? 0)),
      settings: normalizeSettings(parsed.settings),
    };
  } catch {
    return structuredClone(DEFAULT_PROGRESS);
  }
}

export function saveProgress(p: LocalProgress): void {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(p));
  } catch {
    /* ignore quota */
  }
}

export function unlockCheckpoint(progress: LocalProgress, nextLevel: number): LocalProgress {
  const n = clampLevel(nextLevel);
  if (n > progress.cpUnlocked) {
    progress = { ...progress, cpUnlocked: n };
    saveProgress(progress);
  }
  return progress;
}

export function unlockAntidrone(progress: LocalProgress, nextLevel: number): LocalProgress {
  const n = clampLevel(nextLevel);
  if (n > progress.adUnlocked) {
    progress = { ...progress, adUnlocked: n };
    saveProgress(progress);
  }
  return progress;
}

export function unlockAttack(progress: LocalProgress, nextLevel: number): LocalProgress {
  const n = clampLevel(nextLevel);
  if (n > progress.atUnlocked) {
    progress = { ...progress, atUnlocked: n };
    saveProgress(progress);
  }
  return progress;
}

export function applyMissionReward(
  progress: LocalProgress,
  credits: number,
  xp: number,
): LocalProgress {
  const next = {
    ...progress,
    credits: progress.credits + Math.max(0, Math.floor(credits)),
    xp: progress.xp + Math.max(0, Math.floor(xp)),
  };
  saveProgress(next);
  return next;
}

export function tryUnlockF15(progress: LocalProgress): {
  progress: LocalProgress;
  ok: boolean;
  reason?: string;
} {
  if (progress.ownedAircraft.includes(Aircraft.F15_EAGLE)) {
    return { progress, ok: false, reason: "already" };
  }
  if (progress.credits < F15_UNLOCK_COST) {
    return { progress, ok: false, reason: "funds" };
  }
  const next: LocalProgress = {
    ...progress,
    credits: progress.credits - F15_UNLOCK_COST,
    ownedAircraft: [...progress.ownedAircraft, Aircraft.F15_EAGLE],
    aircraft: Aircraft.F15_EAGLE,
  };
  saveProgress(next);
  return { progress: next, ok: true };
}

export function updateSettings(
  progress: LocalProgress,
  settings: Partial<PlayerSettings>,
): LocalProgress {
  const next = {
    ...progress,
    settings: normalizeSettings({ ...progress.settings, ...settings }),
  };
  saveProgress(next);
  return next;
}

export function setAvatar(progress: LocalProgress, avatarId: number): LocalProgress {
  const next = { ...progress, avatarId: clampAvatarId(avatarId) };
  saveProgress(next);
  return next;
}

export function setSkin(progress: LocalProgress, skinId: string): LocalProgress {
  const next = { ...progress, skinId: jetSkinById(skinId).id };
  saveProgress(next);
  return next;
}

function clampLevel(n: number): number {
  return Math.min(30, Math.max(1, Math.floor(n)));
}

function structuredClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}
