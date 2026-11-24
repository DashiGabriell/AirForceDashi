import { describe, expect, it } from "vitest";
import { CountermeasureSystem, FLARE_MAX } from "./countermeasures";
import { MissileSystem } from "./MissilePool";

describe("CountermeasureSystem", () => {
  it("deploys pellets and opens an IR window", () => {
    const cm = new CountermeasureSystem();
    const ok = cm.tryDeploy({
      x: 0,
      y: 200,
      z: 0,
      vx: 0,
      vy: 0,
      vz: -200,
    });
    expect(ok).toBe(true);
    expect(cm.ready).toBe(FLARE_MAX - 1);
    expect(cm.windowOpen).toBe(true);
    expect(cm.decoyPoint()).not.toBeNull();
    expect(cm.pellets.some((p) => p.active)).toBe(true);
  });

  it("respects cooldown between dumps", () => {
    const cm = new CountermeasureSystem();
    const origin = { x: 0, y: 100, z: 0, vx: 0, vy: 0, vz: -100 };
    expect(cm.tryDeploy(origin)).toBe(true);
    expect(cm.tryDeploy(origin)).toBe(false);
  });

  it("auto only in the danger closing band", () => {
    const cm = new CountermeasureSystem();
    expect(cm.shouldAutoDeploy(400, 0.8)).toBe(true);
    expect(cm.shouldAutoDeploy(50, 0.9)).toBe(false);
    expect(cm.shouldAutoDeploy(400, 0.1)).toBe(false);
  });
});

describe("MissileSystem flare divert", () => {
  it("diverts a seekPlayer missile into the decoy cloud", () => {
    const missiles = new MissileSystem();
    const player = { x: 0, y: 200, z: 0 };
    const fired = missiles.tryFireHostile(
      { x: 0, y: 200, z: -400 },
      player,
    );
    expect(fired).not.toBeNull();
    expect(fired!.seekPlayer).toBe(true);

    const decoy = { x: 40, y: 180, z: -120 };
    missiles.tick(0.05, () => 0, {
      player,
      flareDecoy: decoy,
      flareWindowOpen: true,
    });
    const m = missiles.missiles.find((x) => x.active)!;
    expect(m.flared).toBe(true);
    expect(m.seekPlayer).toBe(false);
    expect(m.lockX).toBe(decoy.x);
  });
});
