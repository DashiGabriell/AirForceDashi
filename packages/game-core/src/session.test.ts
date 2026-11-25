import { describe, expect, it } from "vitest";
import { Cam } from "@afd/shared-types";
import { createSession, cycleCamera, viewCamera } from "./session";

describe("play cameras", () => {
  it("cycles Chase, Cockpit, Rear", () => {
    const session = createSession();
    expect(session.cameraMode).toBe(Cam.CHASE);
    expect(cycleCamera(session)).toBe(Cam.COCKPIT);
    expect(cycleCamera(session)).toBe(Cam.REAR);
    expect(cycleCamera(session)).toBe(Cam.CHASE);
  });

  it("look-back shows the rear view", () => {
    const session = createSession({ cameraMode: Cam.COCKPIT, lookBackHold: true });
    expect(viewCamera(session)).toBe(Cam.REAR);
  });
});
