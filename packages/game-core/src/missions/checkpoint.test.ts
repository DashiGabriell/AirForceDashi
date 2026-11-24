import { describe, expect, it } from "vitest";
import { CheckpointCourse } from "./CheckpointCourse";
import {
  buildCheckpointPoints,
  checkpointDef,
  gateIsFlat,
  CP_LEVEL_COUNT,
} from "./checkpointLevels";
import { antidroneDef, AD_LEVEL_COUNT } from "./antidroneLevels";
import { AntiDroneCourse } from "./AntiDroneCourse";
import { MissileSystem } from "../combat/MissilePool";

describe("checkpoint levels", () => {
  it("defines 30 valid courses", () => {
    for (let i = 1; i <= CP_LEVEL_COUNT; i++) {
      const d = checkpointDef(i);
      expect(d.rings).toBeGreaterThanOrEqual(3);
      expect(d.radius).toBeGreaterThan(10);
      const pts = buildCheckpointPoints(i, { x: 0, y: 300, z: 0 }, 0);
      expect(pts.length).toBe(d.rings);
      for (const g of pts) {
        const n = Math.hypot(g.nx, g.ny, g.nz);
        expect(n).toBeCloseTo(1, 5);
      }
    }
  });

  it("builds a curved 3D path that intensifies with level", () => {
    const easy = buildCheckpointPoints(1, { x: 0, y: 300, z: 0 }, 0);
    const hard = buildCheckpointPoints(25, { x: 0, y: 300, z: 0 }, 0);

    const lateralSpan = (pts: typeof easy) => {
      const xs = pts.map((p) => p.x);
      return Math.max(...xs) - Math.min(...xs);
    };
    const altSpan = (pts: typeof easy) => {
      const ys = pts.map((p) => p.y);
      return Math.max(...ys) - Math.min(...ys);
    };

    expect(lateralSpan(hard)).toBeGreaterThan(lateralSpan(easy));
    expect(altSpan(hard)).toBeGreaterThan(altSpan(easy) + 40);

    // Hard courses must include laid-flat (climb/dive) gates.
    expect(hard.some(gateIsFlat)).toBe(true);
    // Early course stays mostly upright.
    expect(easy.filter(gateIsFlat).length).toBeLessThan(easy.length);
  });

  it("registers a gate pass and can win level 1", () => {
    const course = new CheckpointCourse();
    course.start(1, { x: 0, y: 300, z: 0 }, 0);
    const g0 = course.state.gates[0]!;
    course.tick(0.016, { x: g0.x, y: g0.y, z: g0.z });
    expect(course.state.ringIndex).toBe(1);

    for (const g of course.state.gates) {
      if (!g.done) course.tick(0.016, { x: g.x, y: g.y, z: g.z });
    }
    expect(course.state.status).toBe("WIN");
  });

  it("can clear a pitched gate by flying along its normal", () => {
    const course = new CheckpointCourse();
    course.start(20, { x: 0, y: 400, z: 0 }, 0);
    const pitched = course.state.gates.find(gateIsFlat);
    expect(pitched).toBeTruthy();
    // Walk every gate in order along its center — orientation must still accept.
    for (const g of course.state.gates) {
      if (!g.done) course.tick(0.016, { x: g.x, y: g.y, z: g.z });
    }
    expect(course.state.status).toBe("WIN");
  });
});

describe("antidrone levels", () => {
  it("defines 30 levels with waves", () => {
    for (let i = 1; i <= AD_LEVEL_COUNT; i++) {
      const d = antidroneDef(i);
      expect(d.total).toBeGreaterThan(0);
      expect(d.waves.length).toBeGreaterThan(0);
    }
  });

  it("kills drones with missile segment and can clear tutorial", () => {
    const course = new AntiDroneCourse();
    course.start(1, { x: 0, y: 400, z: 0 }, 0);
    expect(course.state.drones.length).toBeGreaterThan(0);
    for (const d of [...course.state.drones]) {
      course.tryBlast(d.x, d.y, d.z, 20);
    }
    for (let i = 0; i < 40; i++) {
      course.tick(1);
      for (const d of course.state.drones) {
        if (d.alive) course.tryBlast(d.x, d.y, d.z, 30);
      }
      if (course.state.status === "WIN") break;
    }
    expect(course.state.status).toBe("WIN");
  });
});

describe("MissileSystem", () => {
  it("fires and impacts ground", () => {
    const sys = new MissileSystem();
    const m = sys.tryFire({ x: 0, y: 100, z: 0 }, { x: 0, y: -1, z: 0 });
    expect(m).not.toBeNull();
    expect(sys.ready).toBe(3);
    let hit = false;
    for (let i = 0; i < 120; i++) {
      const impacts = sys.tick(1 / 60, () => 0);
      if (impacts.length) {
        hit = true;
        break;
      }
    }
    expect(hit).toBe(true);
  });
});
