import { describe, expect, it } from "vitest";
import { JetSimulation } from "./JetSimulation";
import { Vec3 } from "../math/vec3";

describe("JetSimulation", () => {
  it("completes a loop: vertical → inverted → recover", () => {
    const jet = new JetSimulation();
    jet.resetPose(new Vec3(0, 2200, 0), 0, 110);
    jet.setAfterburnerHold(true);

    let sawVertical = false;
    let sawInverted = false;
    let sawRecover = false;
    let minNoseY = 1;
    let maxNoseY = -1;
    const dt = 1 / 60;

    for (let i = 0; i < 480; i++) {
      jet.setSteerAxis(0, -1, true);
      jet.integrateForced(dt);
      const nose = jet.basis.nose();
      minNoseY = Math.min(minNoseY, nose.y);
      maxNoseY = Math.max(maxNoseY, nose.y);
      if (nose.y > 0.85) sawVertical = true;
      if (nose.y < -0.45) sawInverted = true;
      if (sawInverted && nose.y > -0.15) {
        sawRecover = true;
        break;
      }
    }

    expect(sawVertical, `max nose.y=${maxNoseY}`).toBe(true);
    expect(sawInverted, `min nose.y=${minNoseY}`).toBe(true);
    expect(sawRecover).toBe(true);
    expect(jet.basis.isFinite()).toBe(true);
  });

  it("banks right wing down on positive bank (D)", () => {
    const jet = new JetSimulation();
    jet.resetPose(new Vec3(0, 2200, 0), 0, 95);
    const dt = 1 / 60;
    for (let i = 0; i < 45; i++) {
      jet.setSteerAxis(1, 0, true);
      jet.integrateForced(dt);
    }
    // Positive bank → right wing down → local +X tilts toward world down on the right.
    // roll should be positive (right wing down) for D.
    expect(jet.roll).toBeGreaterThan(0.15);
    // Heading should turn right (negative yaw delta on +bank in Godot → yaw decreases)
    // After right bank/turn, yaw should move (nose swings).
    expect(Math.abs(jet.yaw)).toBeGreaterThan(0.05);
  });

  it("clamps above ground / water floor", () => {
    const jet = new JetSimulation();
    jet.setGroundSampler(() => 0);
    jet.resetPose(new Vec3(0, 5, 0), 0, 95);
    // Dive hard toward ground
    for (let i = 0; i < 120; i++) {
      jet.setSteerAxis(0, 1, true);
      jet.integrateForced(1 / 60);
    }
    expect(jet.position.y).toBeGreaterThanOrEqual(4);
    expect(jet.basis.nose().y).toBeGreaterThan(-0.2);
  });
});
