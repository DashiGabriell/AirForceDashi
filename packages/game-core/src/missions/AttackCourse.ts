import { gatherBuildings, type BuildingInstance } from "../world/chunk";
import { buildingHitQuery } from "../world/buildingHit";
import {
  createDestructibleFromBuilding,
  damageDestructible,
  promoteToDestructible,
  type DestructibleTarget,
} from "./DestructibleTarget";
import { attackDef, type AttackDef } from "./attackLevels";

export interface AttackState {
  active: boolean;
  level: number;
  status: "IDLE" | "RUN" | "WIN" | "FAIL";
  destroyed: number;
  total: number;
  timeLeft: number;
  timeLimit: number;
  failReason: string | null;
  targets: DestructibleTarget[];
}

export class AttackCourse {
  state: AttackState = {
    active: false,
    level: 1,
    status: "IDLE",
    destroyed: 0,
    total: 0,
    timeLeft: 0,
    timeLimit: 0,
    failReason: null,
    targets: [],
  };

  private def: AttackDef | null = null;
  private finished = false;

  start(
    level: number,
    origin: { x: number; y: number; z: number },
    _heading: number,
  ): void {
    this.def = attackDef(level);
    this.finished = false;
    const candidates = pickTargets(origin.x, origin.z, this.def.targetCount);
    const targets = candidates.map((b) =>
      createDestructibleFromBuilding(b, this.def!.hitsToDestroy),
    );
    for (const t of targets) promoteToDestructible(t);

    this.state = {
      active: true,
      level: this.def.level,
      status: "RUN",
      destroyed: 0,
      total: targets.length,
      timeLeft: this.def.timeLimitSec,
      timeLimit: this.def.timeLimitSec,
      failReason: null,
      targets,
    };
  }

  tick(dt: number): void {
    if (!this.state.active || this.finished) return;
    this.state.timeLeft -= dt;
    if (this.state.timeLeft <= 0) {
      this.fail("TIME");
    }
  }

  /** Segment hit against promoted (non-destroyed) targets. */
  tryHitSegment(
    ax: number,
    ay: number,
    az: number,
    bx: number,
    by: number,
    bz: number,
  ): { hit: boolean; target: DestructibleTarget | null; destroyed: boolean } {
    if (!this.state.active || this.finished) {
      return { hit: false, target: null, destroyed: false };
    }
    const boxes = this.state.targets
      .filter((t) => t.promoted && !t.destroyed)
      .map((t) => t.aabb);
    const hit = buildingHitQuery(
      { x: ax, y: ay, z: az },
      { x: bx, y: by, z: bz },
      boxes,
    );
    if (!hit) return { hit: false, target: null, destroyed: false };
    const t = this.state.targets.find((x) => x.buildingId === hit.id);
    if (!t || t.destroyed) return { hit: false, target: null, destroyed: false };
    const destroyed = damageDestructible(t, 1);
    if (destroyed) {
      this.state.destroyed += 1;
      this.checkWin();
    }
    return { hit: true, target: t, destroyed };
  }

  tryBlast(x: number, y: number, z: number, radius = 22): number {
    if (!this.state.active || this.finished) return 0;
    let n = 0;
    for (const t of this.state.targets) {
      if (!t.promoted || t.destroyed) continue;
      const dist = Math.hypot(t.aabb.cx - x, t.aabb.cy - y, t.aabb.cz - z);
      if (dist <= radius + Math.max(t.aabb.hx, t.aabb.hz)) {
        const destroyed = damageDestructible(t, 1);
        n += 1;
        if (destroyed) this.state.destroyed += 1;
      }
    }
    if (n) this.checkWin();
    return n;
  }

  private checkWin(): void {
    if (this.finished) return;
    if (this.state.destroyed >= this.state.total && this.state.total > 0) {
      this.win();
    }
  }

  private win(): void {
    this.finished = true;
    this.state.active = false;
    this.state.status = "WIN";
  }

  private fail(reason: string): void {
    this.finished = true;
    this.state.active = false;
    this.state.status = "FAIL";
    this.state.failReason = reason;
  }
}

function pickTargets(wx: number, wz: number, count: number): BuildingInstance[] {
  const list = gatherBuildings(wx, wz)
    .filter((b) => b.kind === "city" && b.h >= 40)
    .sort((a, b) => {
      const da = (a.x - wx) ** 2 + (a.z - wz) ** 2;
      const db = (b.x - wx) ** 2 + (b.z - wz) ** 2;
      return da - db || b.h - a.h;
    });
  const picked = list.slice(0, Math.max(1, Math.min(3, count)));
  if (picked.length >= 1) return picked;
  return gatherBuildings(wx, wz)
    .sort((a, b) => b.h - a.h)
    .slice(0, Math.max(1, Math.min(3, count)));
}
