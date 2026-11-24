import {
  targetPracticeDef,
  type LockPolicy,
  type TargetPracticeDef,
} from "./targetPracticeLevels";

export interface PracticeTargetState {
  id: number;
  alive: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  radius: number;
  speed: number;
}

/** World hit report for FX (shatter / boom). */
export interface PracticeHit {
  x: number;
  y: number;
  z: number;
  radius: number;
}

export interface TargetPracticeState {
  active: boolean;
  level: number;
  name: string;
  status: "IDLE" | "RUN" | "WIN" | "FAIL";
  lockPolicy: LockPolicy;
  kills: number;
  total: number;
  alive: number;
  timeLeft: number;
  timeLimit: number;
  failReason: string | null;
  targets: PracticeTargetState[];
}

export class TargetPracticeCourse {
  state: TargetPracticeState = {
    active: false,
    level: 1,
    name: "",
    status: "IDLE",
    lockPolicy: "free",
    kills: 0,
    total: 0,
    alive: 0,
    timeLeft: 0,
    timeLimit: 0,
    failReason: null,
    targets: [],
  };

  private def: TargetPracticeDef | null = null;
  private finished = false;
  private origin = { x: 0, y: 0, z: 0 };
  private heading = 0;
  private nextId = 1;

  start(
    level: number,
    origin: { x: number; y: number; z: number },
    heading: number,
  ): void {
    this.def = targetPracticeDef(level);
    this.finished = false;
    this.origin = { ...origin };
    this.heading = heading;
    this.nextId = 1;

    const fwdX = -Math.sin(heading);
    const fwdZ = -Math.cos(heading);
    const rightX = Math.cos(heading);
    const rightZ = -Math.sin(heading);

    const targets: PracticeTargetState[] = this.def.targets.map((s) => {
      const x = origin.x + fwdX * s.forward + rightX * s.right;
      const z = origin.z + fwdZ * s.forward + rightZ * s.right;
      const y = origin.y + s.up;
      return {
        id: this.nextId++,
        alive: true,
        x,
        y,
        z,
        vx: 0,
        vy: 0,
        vz: 0,
        radius: s.radius,
        speed: s.speed,
      };
    });

    this.state = {
      active: true,
      level: this.def.level,
      name: this.def.name,
      status: "RUN",
      lockPolicy: this.def.lockPolicy,
      kills: 0,
      total: targets.length,
      alive: targets.length,
      timeLeft: this.def.timeLimit,
      timeLimit: this.def.timeLimit,
      failReason: null,
      targets,
    };
  }

  restart(): void {
    this.start(this.state.level, this.origin, this.heading);
  }

  tick(dt: number): void {
    if (!this.state.active || this.finished || !this.def) return;

    if (this.state.timeLimit > 0) {
      this.state.timeLeft = Math.max(0, this.state.timeLeft - dt);
      if (this.state.timeLeft <= 0) {
        this.fail("TIME");
        return;
      }
    }

    for (const t of this.state.targets) {
      if (!t.alive || t.speed <= 0) continue;
      // Movers reserved for later levels — keep velocity integration ready.
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      t.z += t.vz * dt;
    }

    this.state.alive = this.state.targets.filter((t) => t.alive).length;
    this.checkWin();
  }

  /**
   * Segment hit. `guided` must match lock policy:
   * lock_required → only guided; lock_forbidden → only dumb; free → both.
   */
  tryHitSegment(
    ax: number,
    ay: number,
    az: number,
    bx: number,
    by: number,
    bz: number,
    hitRadius: number,
    guided: boolean,
  ): PracticeHit | null {
    if (!this.state.active || this.finished) return null;
    if (!this.acceptsShot(guided)) return null;

    for (const t of this.state.targets) {
      if (!t.alive) continue;
      const need = Math.max(t.radius, hitRadius);
      if (segmentDist(ax, ay, az, bx, by, bz, t.x, t.y, t.z) <= need) {
        t.alive = false;
        this.state.kills += 1;
        this.state.alive = this.state.targets.filter((x) => x.alive).length;
        const hit: PracticeHit = {
          x: t.x,
          y: t.y,
          z: t.z,
          radius: t.radius,
        };
        this.checkWin();
        return hit;
      }
    }
    return null;
  }

  tryBlast(
    x: number,
    y: number,
    z: number,
    radius: number,
    guided: boolean,
  ): PracticeHit[] {
    if (!this.state.active || this.finished) return [];
    if (!this.acceptsShot(guided)) return [];
    const hits: PracticeHit[] = [];
    for (const t of this.state.targets) {
      if (!t.alive) continue;
      if (Math.hypot(t.x - x, t.y - y, t.z - z) <= radius + t.radius * 0.5) {
        t.alive = false;
        this.state.kills += 1;
        hits.push({ x: t.x, y: t.y, z: t.z, radius: t.radius });
      }
    }
    if (hits.length) {
      this.state.alive = this.state.targets.filter((x) => x.alive).length;
      this.checkWin();
    }
    return hits;
  }

  private acceptsShot(guided: boolean): boolean {
    const p = this.state.lockPolicy;
    if (p === "lock_required") return guided;
    if (p === "lock_forbidden") return !guided;
    return true;
  }

  private checkWin(): void {
    if (this.finished) return;
    if (this.state.kills >= this.state.total && this.state.total > 0) {
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

function segmentDist(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  px: number,
  py: number,
  pz: number,
): number {
  const abx = bx - ax;
  const aby = by - ay;
  const abz = bz - az;
  const apx = px - ax;
  const apy = py - ay;
  const apz = pz - az;
  const abLen2 = abx * abx + aby * aby + abz * abz || 1;
  let t = (apx * abx + apy * aby + apz * abz) / abLen2;
  t = Math.min(1, Math.max(0, t));
  return Math.hypot(px - (ax + abx * t), py - (ay + aby * t), pz - (az + abz * t));
}
