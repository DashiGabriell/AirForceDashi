import {
  buildCheckpointPoints,
  checkpointDef,
  type GatePoint,
} from "./checkpointLevels";

export type CourseStatus = "IDLE" | "RUN" | "WIN" | "FAIL";

export interface CheckpointState {
  active: boolean;
  level: number;
  status: CourseStatus;
  ringIndex: number;
  ringTotal: number;
  timeLeft: number;
  timeLimit: number;
  next: GatePoint | null;
  gates: Array<GatePoint & { done: boolean }>;
  failReason: string | null;
}

export class CheckpointCourse {
  state: CheckpointState = {
    active: false,
    level: 1,
    status: "IDLE",
    ringIndex: 0,
    ringTotal: 0,
    timeLeft: 0,
    timeLimit: 0,
    next: null,
    gates: [],
    failReason: null,
  };

  private origin = { x: 0, y: 0, z: 0 };
  private heading = 0;
  private finished = false;

  start(
    level: number,
    origin: { x: number; y: number; z: number },
    heading: number,
    heightFn?: (x: number, z: number) => number,
  ): void {
    const def = checkpointDef(level);
    const pts = buildCheckpointPoints(level, origin, heading, heightFn);
    this.origin = { ...origin };
    this.heading = heading;
    this.finished = false;
    this.state = {
      active: true,
      level: def.level,
      status: "RUN",
      ringIndex: 0,
      ringTotal: pts.length,
      timeLeft: def.timeLimit,
      timeLimit: def.timeLimit,
      next: pts[0] ?? null,
      gates: pts.map((p) => ({ ...p, done: false })),
      failReason: null,
    };
  }

  restart(heightFn?: (x: number, z: number) => number): void {
    this.start(this.state.level, this.origin, this.heading, heightFn);
  }

  tick(
    dt: number,
    jetPos: { x: number; y: number; z: number },
  ): void {
    if (!this.state.active || this.finished) return;
    this.state.timeLeft = Math.max(0, this.state.timeLeft - dt);
    if (this.state.timeLeft <= 0) {
      this.fail("TIME");
      return;
    }
    this.checkPass(jetPos);
  }

  private checkPass(jet: { x: number; y: number; z: number }): void {
    const i = this.state.ringIndex;
    if (i >= this.state.gates.length) return;
    const g = this.state.gates[i]!;
    const dx = jet.x - g.x;
    const dy = jet.y - g.y;
    const dz = jet.z - g.z;
    const planeD = Math.abs(dx * g.nx + dy * g.ny + dz * g.nz);
    if (planeD > 18) return;
    const along = dx * g.nx + dy * g.ny + dz * g.nz;
    const rx = dx - g.nx * along;
    const ry = dy - g.ny * along;
    const rz = dz - g.nz * along;
    if (Math.hypot(rx, ry, rz) > g.radius * 0.92) return;

    g.done = true;
    this.state.ringIndex = i + 1;
    if (this.state.ringIndex >= this.state.gates.length) {
      this.win();
    } else {
      this.state.next = this.state.gates[this.state.ringIndex]!;
    }
  }

  private win(): void {
    this.finished = true;
    this.state.active = false;
    this.state.status = "WIN";
    this.state.next = null;
  }

  private fail(reason: string): void {
    this.finished = true;
    this.state.active = false;
    this.state.status = "FAIL";
    this.state.failReason = reason;
  }
}
