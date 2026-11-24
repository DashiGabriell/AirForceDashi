import { Aircraft } from "@afd/shared-types";
import { clampAvatarId } from "./avatars";
import { jetEmblemById, jetEffectById } from "./cosmetics";
import {
  F15_UNLOCK_COST,
  FLEET,
  fleetEntry,
  normalizeOwnedAircraft,
  normalizeSelectedAircraft,
} from "./fleet";
import { jetSkinById } from "./skins";
import {
  DEFAULT_SETTINGS,
  normalizeSettings,
  type PlayerSettings,
} from "./settings";
import {
  aircraftLoadoutKey,
  DEFAULT_LOADOUTS,
  isWeaponCompatible,
  loadoutForAircraft,
  normalizeLoadoutMap,
  type AircraftLoadout,
  type LoadoutMap,
} from "./weapons";

export interface LocalProgress {
  callsign: string;
  /** 0..5 — mesmo índice do Godot `Game.avatar_id`. */
  avatarId: number;
  /** Livrea do material Paint (`JET_SKINS`). */
  skinId: string;
  /** Emblema cosmético do Hangar (`JET_EMBLEMS`). */
  emblemId: string;
  /** Efeito cosmético do Hangar (`JET_EFFECTS`). */
  effectId: string;
  /** Loadouts por aeronave (AA + AG). */
  loadouts: LoadoutMap;
  aircraft: Aircraft;
  ownedAircraft: Aircraft[];
  cpUnlocked: number;
  adUnlocked: number;
  atUnlocked: number;
  tpUnlocked: number;
  /** Offline Credits stub — server becomes source of truth in M5. */
  credits: number;
  xp: number;
  settings: PlayerSettings;
}

const KEY = "afd_progress_v1";
export { F15_UNLOCK_COST, FLEET, fleetEntry };

export const DEFAULT_PROGRESS: LocalProgress = {
  callsign: "DASHI-1",
  avatarId: 0,
  skinId: "factory",
  emblemId: "wing",
  effectId: "trail_off",
  loadouts: normalizeLoadoutMap(DEFAULT_LOADOUTS),
  aircraft: Aircraft.F22_RAPTOR,
  ownedAircraft: [Aircraft.F22_RAPTOR],
  cpUnlocked: 1,
  adUnlocked: 1,
  atUnlocked: 1,
  tpUnlocked: 1,
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
    const owned = normalizeOwnedAircraft(parsed.ownedAircraft);
    const aircraft = normalizeSelectedAircraft(parsed.aircraft, owned);

    return {
      callsign: String(parsed.callsign || DEFAULT_PROGRESS.callsign).slice(0, 16),
      avatarId: clampAvatarId(
        typeof parsed.avatarId === "number" ? parsed.avatarId : 0,
      ),
      skinId: jetSkinById(typeof parsed.skinId === "string" ? parsed.skinId : "factory").id,
      emblemId: jetEmblemById(
        typeof parsed.emblemId === "string" ? parsed.emblemId : "wing",
      ).id,
      effectId: jetEffectById(
        typeof parsed.effectId === "string" ? parsed.effectId : "trail_off",
      ).id,
      loadouts: normalizeLoadoutMap(parsed.loadouts),
      aircraft,
      ownedAircraft: owned,
      cpUnlocked: clampLevel(parsed.cpUnlocked ?? 1),
      adUnlocked: clampLevel(parsed.adUnlocked ?? 1),
      atUnlocked: clampLevel(parsed.atUnlocked ?? 1),
      tpUnlocked: clampLevel(parsed.tpUnlocked ?? 1),
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

export function unlockTargetPractice(
  progress: LocalProgress,
  nextLevel: number,
): LocalProgress {
  const n = clampLevel(nextLevel);
  if (n > progress.tpUnlocked) {
    progress = { ...progress, tpUnlocked: n };
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

export function tryUnlockAircraft(
  progress: LocalProgress,
  aircraft: Aircraft,
): {
  progress: LocalProgress;
  ok: boolean;
  reason?: string;
} {
  const entry = fleetEntry(aircraft);
  if (entry.unlockCost <= 0) {
    return { progress, ok: false, reason: "starter" };
  }
  if (progress.ownedAircraft.includes(aircraft)) {
    return { progress, ok: false, reason: "already" };
  }
  if (progress.credits < entry.unlockCost) {
    return { progress, ok: false, reason: "funds" };
  }
  const next: LocalProgress = {
    ...progress,
    credits: progress.credits - entry.unlockCost,
    ownedAircraft: [...progress.ownedAircraft, aircraft],
    aircraft,
  };
  saveProgress(next);
  return { progress: next, ok: true };
}

export function tryUnlockF15(progress: LocalProgress): {
  progress: LocalProgress;
  ok: boolean;
  reason?: string;
} {
  return tryUnlockAircraft(progress, Aircraft.F15_EAGLE);
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

export function setEmblem(progress: LocalProgress, emblemId: string): LocalProgress {
  const next = { ...progress, emblemId: jetEmblemById(emblemId).id };
  saveProgress(next);
  return next;
}

export function setEffect(progress: LocalProgress, effectId: string): LocalProgress {
  const next = { ...progress, effectId: jetEffectById(effectId).id };
  saveProgress(next);
  return next;
}

export function currentLoadout(progress: LocalProgress): AircraftLoadout {
  return loadoutForAircraft(progress.loadouts, progress.aircraft);
}

export function setAaWeapon(
  progress: LocalProgress,
  weaponId: string,
  aircraft: Aircraft = progress.aircraft,
): LocalProgress {
  if (weaponId && !isWeaponCompatible(weaponId, aircraft, "aa")) return progress;
  const key = aircraftLoadoutKey(aircraft);
  const cur = loadoutForAircraft(progress.loadouts, aircraft);
  const next: LocalProgress = {
    ...progress,
    loadouts: {
      ...normalizeLoadoutMap(progress.loadouts),
      [key]: { ...cur, aaWeaponId: weaponId },
    },
  };
  saveProgress(next);
  return next;
}

export function setAgWeapon(
  progress: LocalProgress,
  weaponId: string,
  aircraft: Aircraft = progress.aircraft,
): LocalProgress {
  if (weaponId && !isWeaponCompatible(weaponId, aircraft, "ag")) return progress;
  const key = aircraftLoadoutKey(aircraft);
  const cur = loadoutForAircraft(progress.loadouts, aircraft);
  const next: LocalProgress = {
    ...progress,
    loadouts: {
      ...normalizeLoadoutMap(progress.loadouts),
      [key]: { ...cur, agWeaponId: weaponId },
    },
  };
  saveProgress(next);
  return next;
}

function clampLevel(n: number): number {
  return Math.min(30, Math.max(1, Math.floor(n)));
}

function structuredClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}
