import { describe, expect, it } from "vitest";
import { Aircraft } from "@afd/shared-types";
import { sensorFor, TargetLockTracker } from "./targetLock";

describe("TargetLockTracker", () => {
  it("acquires then locks a ground target in the nose cone", () => {
    const lock = new TargetLockTracker();
    lock.setProfile(sensorFor(Aircraft.A10));
    const origin = { x: 0, y: 120, z: 0 };
    const nose = { x: 0, y: -0.15, z: -0.989 };
    const target = { id: "ag1", kind: "ag" as const, x: 0, y: 20, z: -500 };

    let state = lock.tick(0.2, origin, nose, [target]);
    expect(state.phase).toBe("acquiring");
    expect(state.targetId).toBe("ag1");

    // Finish acquire
    for (let i = 0; i < 20; i++) {
      state = lock.tick(0.2, origin, nose, [target]);
    }
    expect(state.phase).toBe("locked");
    expect(state.progress).toBe(1);
  });

  it("rejects A/A lock on strike jets that cannot lock air", () => {
    const lock = new TargetLockTracker();
    lock.setProfile(sensorFor(Aircraft.A10));
    expect(lock.getProfile().canLockAa).toBe(false);
    const origin = { x: 0, y: 400, z: 0 };
    const nose = { x: 0, y: 0, z: -1 };
    const drone = { id: "aa1", kind: "aa" as const, x: 0, y: 400, z: -300 };
    const state = lock.tick(0.5, origin, nose, [drone]);
    expect(state.phase).toBe("none");
  });

  it("gives interceptors faster A/A lock than recon A/G", () => {
    const f22 = sensorFor(Aircraft.F22_RAPTOR);
    const u2 = sensorFor(Aircraft.U2);
    expect(f22.canLockAa).toBe(true);
    expect(u2.canLockAa).toBe(false);
    expect(f22.lockTime).toBeLessThan(u2.lockTime);
  });

  it("drops lock after leaving the break cone long enough", () => {
    const lock = new TargetLockTracker();
    lock.setProfile({
      ...sensorFor(Aircraft.F22_RAPTOR),
      lockTime: 0.2,
      loseTime: 0.3,
    });
    const origin = { x: 0, y: 200, z: 0 };
    const nose = { x: 0, y: 0, z: -1 };
    const target = { id: "ag1", kind: "ag" as const, x: 0, y: 180, z: -500 };
    for (let i = 0; i < 10; i++) lock.tick(0.1, origin, nose, [target]);
    expect(lock.state.phase).toBe("locked");

    // Target far off-bore
    const off = { id: "ag1", kind: "ag" as const, x: 800, y: 180, z: -100 };
    lock.tick(0.1, origin, nose, [off]);
    expect(lock.state.phase).toBe("locked"); // grace
    lock.tick(0.5, origin, nose, [off]);
    expect(lock.state.phase).toBe("none");
  });
});
