import { describe, expect, it } from "vitest";
import { TargetPracticeCourse } from "./TargetPracticeCourse";
import {
  TP_AUTHORED_COUNT,
  TP_LEVEL_COUNT,
  targetPracticeDef,
} from "./targetPracticeLevels";

describe("targetPracticeLevels", () => {
  it("authors the first five levels with lock policies", () => {
    expect(TP_AUTHORED_COUNT).toBe(5);
    expect(TP_LEVEL_COUNT).toBe(30);
    expect(targetPracticeDef(1).lockPolicy).toBe("free");
    expect(targetPracticeDef(2).lockPolicy).toBe("lock_required");
    expect(targetPracticeDef(3).lockPolicy).toBe("lock_forbidden");
    expect(targetPracticeDef(4).lockPolicy).toBe("free");
    expect(targetPracticeDef(4).timeLimit).toBeGreaterThan(0);
    expect(targetPracticeDef(5).lockPolicy).toBe("lock_required");
    expect(targetPracticeDef(1).targets.length).toBe(3);
    expect(targetPracticeDef(5).targets.length).toBe(5);
  });
});

describe("TargetPracticeCourse", () => {
  it("wins when all static targets are hit under free policy", () => {
    const course = new TargetPracticeCourse();
    course.start(1, { x: 0, y: 400, z: 0 }, 0);
    expect(course.state.status).toBe("RUN");
    expect(course.state.total).toBe(3);

    for (const t of [...course.state.targets]) {
      const hit = course.tryHitSegment(
        t.x - 30,
        t.y,
        t.z,
        t.x + 30,
        t.y,
        t.z,
        4,
        false,
      );
      expect(hit).not.toBeNull();
    }
    expect(course.state.status).toBe("WIN");
    expect(course.state.kills).toBe(3);
  });

  it("rejects dumb hits when lock is required", () => {
    const course = new TargetPracticeCourse();
    course.start(2, { x: 0, y: 400, z: 0 }, 0);
    const t = course.state.targets[0]!;
    expect(
      course.tryHitSegment(t.x - 20, t.y, t.z, t.x + 20, t.y, t.z, 4, false),
    ).toBeNull();
    expect(
      course.tryHitSegment(t.x - 20, t.y, t.z, t.x + 20, t.y, t.z, 4, true),
    ).not.toBeNull();
    expect(course.state.kills).toBe(1);
  });

  it("rejects guided hits when lock is forbidden", () => {
    const course = new TargetPracticeCourse();
    course.start(3, { x: 0, y: 400, z: 0 }, 0);
    const t = course.state.targets[0]!;
    expect(
      course.tryHitSegment(t.x - 20, t.y, t.z, t.x + 20, t.y, t.z, 4, true),
    ).toBeNull();
    expect(
      course.tryHitSegment(t.x - 20, t.y, t.z, t.x + 20, t.y, t.z, 4, false),
    ).not.toBeNull();
  });

  it("fails on time when the clock runs out", () => {
    const course = new TargetPracticeCourse();
    course.start(4, { x: 0, y: 400, z: 0 }, 0);
    expect(course.state.timeLimit).toBeGreaterThan(0);
    course.tick(course.state.timeLimit + 0.1);
    expect(course.state.status).toBe("FAIL");
    expect(course.state.failReason).toBe("TIME");
  });
});
