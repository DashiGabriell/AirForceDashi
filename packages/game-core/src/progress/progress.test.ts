import { describe, expect, it, beforeEach } from "vitest";
import { Aircraft } from "@afd/shared-types";
import {
  DEFAULT_PROGRESS,
  F15_UNLOCK_COST,
  applyMissionReward,
  tryUnlockF15,
  updateSettings,
} from "./localProgress";
import { internalHeightForQuality, normalizeSettings } from "./settings";

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
});
