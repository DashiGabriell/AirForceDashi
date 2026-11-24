import { describe, expect, it } from "vitest";
import { Aircraft } from "@afd/shared-types";
import { Vec3 } from "../math/vec3";
import { handlingFor, DEFAULT_HANDLING } from "./flightHandling";
import { JetSimulation, evaluateAltWarn } from "./JetSimulation";

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

  it("keeps F-22 handling identical to legacy defaults", () => {
    expect(handlingFor(Aircraft.F22_RAPTOR)).toEqual(DEFAULT_HANDLING);
  });

  it("makes A-10 turn slower than F-22 under the same input", () => {
    const dt = 1 / 60;
    const run = (aircraft: Aircraft) => {
      const jet = new JetSimulation();
      jet.setHandling(handlingFor(aircraft));
      jet.resetPose(new Vec3(0, 2200, 0), 0);
      for (let i = 0; i < 60; i++) {
        jet.setSteerAxis(1, 0, true);
        jet.integrateForced(dt);
      }
      return Math.abs(jet.yaw);
    };
    expect(run(Aircraft.A10)).toBeLessThan(run(Aircraft.F22_RAPTOR) * 0.75);
  });

  it("hangs then sinks when aero-braking with the nose up", () => {
    const jet = new JetSimulation();
    jet.resetPose(new Vec3(0, 2200, 0), 0, 310);
    const dt = 1 / 60;
    for (let i = 0; i < 30; i++) {
      jet.setSteerAxis(0, -1, true);
      jet.integrateForced(dt);
    }
    const entry = jet.speed;
    jet.setAirbrakeHold(true);
    let minVy = 0;
    for (let i = 0; i < 150; i++) {
      jet.setSteerAxis(0, -0.35, true);
      jet.integrateForced(dt);
      minVy = Math.min(minVy, jet.velocity.y);
    }
    expect(jet.speed).toBeLessThan(entry * 0.55);
    expect(jet.pitch).toBeGreaterThan(0.1);
    expect(minVy).toBeLessThan(-8);
  });

  it("makes B-2 less pitch-agile than F-22", () => {
    const dt = 1 / 60;
    const pitchTravel = (aircraft: Aircraft) => {
      const jet = new JetSimulation();
      jet.setHandling(handlingFor(aircraft));
      jet.resetPose(new Vec3(0, 2200, 0), 0);
      const start = jet.pitch;
      for (let i = 0; i < 45; i++) {
        jet.setSteerAxis(0, -1, true);
        jet.integrateForced(dt);
      }
      return Math.abs(jet.pitch - start);
    };
    expect(pitchTravel(Aircraft.B2)).toBeLessThan(
      pitchTravel(Aircraft.F22_RAPTOR) * 0.6,
    );
  });
});

describe("evaluateAltWarn", () => {
  it("stays quiet at cruise AGL", () => {
    expect(evaluateAltWarn(800, 0, 180)).toBe("none");
  });

  it("raises caution in the soft band", () => {
    expect(evaluateAltWarn(140, 0, 180)).toBe("caution");
  });

  it("raises warning near SAFE_AGL", () => {
    expect(evaluateAltWarn(90, 0, 180)).toBe("warning");
  });

  it("raises pullup near critical or diving into terrain", () => {
    expect(evaluateAltWarn(30, 0, 180)).toBe("pullup");
    expect(evaluateAltWarn(95, -28, 200)).toBe("pullup");
  });

  it("softens near-ground slow flight without hard sink", () => {
    expect(evaluateAltWarn(35, -2, 40)).toBe("caution");
  });
});
