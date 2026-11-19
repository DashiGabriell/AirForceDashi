import { describe, expect, it } from "vitest";
import { buildingHitQuery, buildingToAabb } from "../world/buildingHit";
import { gatherBuildings } from "../world/chunk";
import { AttackCourse } from "./AttackCourse";
import { attackDef } from "./attackLevels";
import {
  createDestructibleFromBuilding,
  damageDestructible,
  promoteToDestructible,
} from "./DestructibleTarget";

describe("buildingHitQuery", () => {
  it("hits aabb along segment", () => {
    const list = gatherBuildings(1200, -800);
    expect(list.length).toBeGreaterThan(0);
    const b = list[0]!;
    const aabb = buildingToAabb(b);
    const from = { x: aabb.cx - aabb.hx - 20, y: aabb.cy, z: aabb.cz };
    const to = { x: aabb.cx + aabb.hx + 20, y: aabb.cy, z: aabb.cz };
    const hit = buildingHitQuery(from, to, [aabb]);
    expect(hit).not.toBeNull();
    expect(hit!.id).toBe(b.id);
  });

  it("misses when segment clears box", () => {
    const aabb = {
      id: "t",
      cx: 0,
      cy: 50,
      cz: 0,
      hx: 10,
      hy: 50,
      hz: 10,
    };
    const hit = buildingHitQuery(
      { x: -40, y: 50, z: 40 },
      { x: 40, y: 50, z: 40 },
      [aabb],
    );
    expect(hit).toBeNull();
  });
});

describe("DestructibleTarget", () => {
  it("promotes and collapses after hits without city rebuild", () => {
    const list = gatherBuildings(1200, -800);
    const b = list.find((x) => x.kind === "city") ?? list[0]!;
    const t = createDestructibleFromBuilding(b, 2);
    promoteToDestructible(t);
    expect(t.promoted).toBe(true);
    expect(damageDestructible(t, 1)).toBe(false);
    expect(t.damageState).toBeGreaterThan(0);
    expect(damageDestructible(t, 1)).toBe(true);
    expect(t.destroyed).toBe(true);
  });
});

describe("AttackCourse", () => {
  it("starts with 1–3 targets", () => {
    expect(attackDef(1).targetCount).toBe(1);
    expect(attackDef(10).targetCount).toBe(3);
    const course = new AttackCourse();
    course.start(1, { x: 1200, y: 400, z: -800 }, 0.35);
    expect(course.state.status).toBe("RUN");
    expect(course.state.total).toBeGreaterThanOrEqual(1);
    expect(course.state.total).toBeLessThanOrEqual(3);
    expect(course.state.targets.every((t) => t.promoted)).toBe(true);
  });

  it("wins when all targets destroyed via hits", () => {
    const course = new AttackCourse();
    course.start(1, { x: 1200, y: 400, z: -800 }, 0);
    expect(course.state.targets.length).toBeGreaterThan(0);
    let guard = 0;
    while (course.state.status === "RUN" && guard++ < 40) {
      for (const t of course.state.targets) {
        if (t.destroyed) continue;
        course.tryBlast(t.aabb.cx, t.aabb.cy, t.aabb.cz, 500);
      }
    }
    expect(course.state.status).toBe("WIN");
  });

  it("fails on timeout", () => {
    const course = new AttackCourse();
    course.start(1, { x: 1200, y: 400, z: -800 }, 0);
    course.state.timeLeft = 0.01;
    course.tick(0.02);
    expect(course.state.status).toBe("FAIL");
  });
});
