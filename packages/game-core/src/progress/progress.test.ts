import { describe, expect, it, beforeEach } from "vitest";
import { Aircraft } from "@afd/shared-types";
import {
  avatarLabel,
  avatarPublicPath,
  clampAvatarId,
} from "./avatars";
import { jetSkinById } from "./skins";
import {
  DEFAULT_PROGRESS,
  F15_UNLOCK_COST,
  applyMissionReward,
  currentLoadout,
  setAaWeapon,
  setAgWeapon,
  setAvatar,
  setSkin,
  tryUnlockF15,
  updateSettings,
} from "./localProgress";
import { internalHeightForQuality, normalizeSettings } from "./settings";
import {
  isWeaponCompatible,
  weaponsForAircraft,
} from "./weapons";

describe("settings", () => {
  it("maps quality to internal render height", () => {
    expect(internalHeightForQuality("low")).toBeLessThan(
      internalHeightForQuality("medium"),
    );
    expect(internalHeightForQuality("high")).toBeGreaterThan(
      internalHeightForQuality("medium"),
    );
  });

  it("normalizes invalid settings", () => {
    const s = normalizeSettings({
      quality: "nope" as never,
      masterVolume: 4,
      mouseSens: 0.01,
    });
    expect(s.quality).toBe("medium");
    expect(s.masterVolume).toBe(1);
    expect(s.mouseSens).toBe(0.35);
  });
});

describe("progress economy stub", () => {
  beforeEach(() => {
    // vitest node — no localStorage required (save is best-effort)
  });

  it("applies offline reward credits/xp", () => {
    const p = applyMissionReward({ ...DEFAULT_PROGRESS }, 100, 25);
    expect(p.credits).toBe(DEFAULT_PROGRESS.credits + 100);
    expect(p.xp).toBe(25);
  });

  it("unlocks F-15 when funds allow", () => {
    const rich = {
      ...DEFAULT_PROGRESS,
      credits: F15_UNLOCK_COST,
      ownedAircraft: [Aircraft.F22_RAPTOR],
    };
    const { ok, progress } = tryUnlockF15(rich);
    expect(ok).toBe(true);
    expect(progress.ownedAircraft).toContain(Aircraft.F15_EAGLE);
    expect(progress.credits).toBe(0);
  });

  it("rejects F-15 unlock without funds", () => {
    const { ok, reason } = tryUnlockF15({
      ...DEFAULT_PROGRESS,
      credits: 100,
    });
    expect(ok).toBe(false);
    expect(reason).toBe("funds");
  });

  it("persists settings patch", () => {
    const p = updateSettings(DEFAULT_PROGRESS, { quality: "high", mouseSens: 1.4 });
    expect(p.settings.quality).toBe("high");
    expect(p.settings.mouseSens).toBe(1.4);
  });

  it("sets and clamps avatar id", () => {
    expect(clampAvatarId(99)).toBe(5);
    expect(avatarLabel(0)).toBe("RAPTOR-1");
    expect(avatarPublicPath(0)).toBe("/avatars/avatar_01.png");
    const p = setAvatar(DEFAULT_PROGRESS, 3);
    expect(p.avatarId).toBe(3);
    expect(avatarLabel(p.avatarId)).toBe("HAWK-4");
  });

  it("sets a known skin and falls back when the id is unknown", () => {
    const painted = setSkin(DEFAULT_PROGRESS, "night");
    expect(painted.skinId).toBe("night");
    expect(jetSkinById("nope").id).toBe("factory");
    expect(setSkin(painted, "nope").skinId).toBe("factory");
  });

  it("exposes F-22 AIM-9 / AIM-120C + JDAM loadout and rejects incompatible mounts", () => {
    const aa = weaponsForAircraft(Aircraft.F22_RAPTOR, "aa");
    const ag = weaponsForAircraft(Aircraft.F22_RAPTOR, "ag");
    expect(aa.map((w) => w.id)).toEqual(
      expect.arrayContaining(["aim-9-sidewinder", "aim-120c-amraam"]),
    );
    expect(ag.map((w) => w.id)).toContain("jdam");
    expect(isWeaponCompatible("aim-9-sidewinder", Aircraft.F15_EAGLE)).toBe(
      true,
    );
    expect(isWeaponCompatible("r-77", Aircraft.F22_RAPTOR)).toBe(false);

    const base = currentLoadout(DEFAULT_PROGRESS);
    expect(base.aaWeaponId).toBe("aim-9-sidewinder");
    expect(base.agWeaponId).toBe("jdam");

    const amraam = setAaWeapon(DEFAULT_PROGRESS, "aim-120c-amraam");
    expect(currentLoadout(amraam).aaWeaponId).toBe("aim-120c-amraam");

    const rejected = setAaWeapon(DEFAULT_PROGRESS, "jdam");
    expect(currentLoadout(rejected).aaWeaponId).toBe("aim-9-sidewinder");

    const ok = setAgWeapon(DEFAULT_PROGRESS, "jdam");
    expect(currentLoadout(ok).agWeaponId).toBe("jdam");
  });
});
