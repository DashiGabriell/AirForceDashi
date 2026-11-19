import { Vec3 } from "../math/vec3";
import {
  antidroneDef,
  type AntiDroneDef,
  type DroneKindId,
  type WaveDef,
} from "./antidroneLevels";

export interface DroneState {
  id: number;
  kind: DroneKindId;
  alive: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  speed: number;
  dive: number;
}

export interface AntiDroneState {
  active: boolean;
  level: number;
  status: "IDLE" | "RUN" | "WIN" | "FAIL";
  kills: number;
  total: number;
  alive: number;
  leaks: number;
  maxLeaks: number;
  failReason: string | null;
  drones: DroneState[];
}

export class AntiDroneCourse {
  state: AntiDroneState = {
    active: false,
    level: 1,
    status: "IDLE",
    kills: 0,
    total: 0,
    alive: 0,
    leaks: 0,
    maxLeaks: 3,
    failReason: null,
    drones: [],
  };

  private def: AntiDroneDef | null = null;
  private waves: WaveDef[] = [];
  private waveI = 0;
  private waveT = 0;
  private finished = false;
  private origin = { x: 0, y: 0, z: 0 };
  private heading = 0;
  private nextId = 1;
  private impact = new Vec3();

  start(
    level: number,
    origin: { x: number; y: number; z: number },
    heading: number,
  ): void {
    this.def = antidroneDef(level);
    this.waves = this.def.waves.map((w) => ({ ...w }));
    this.waveI = 0;
    this.waveT = 0.4;
    this.finished = false;
    this.origin = { ...origin };
    this.heading = heading;
    const fwdX = -Math.sin(heading);
    const fwdZ = -Math.cos(heading);
    this.impact.set(
      origin.x + fwdX * this.def.impactDist,
      origin.y - 40,
      origin.z + fwdZ * this.def.impactDist,
    );
    this.state = {
      active: true,
      level: this.def.level,
      status: "RUN",
      kills: 0,
      total: this.def.total,
      alive: 0,
      leaks: 0,
      maxLeaks: this.def.maxLeaks,
      failReason: null,
      drones: [],
    };
    this.spawnWave();
  }

  restart(): void {
    this.start(this.state.level, this.origin, this.heading);
  }

  tick(dt: number): void {
    if (!this.state.active || this.finished || !this.def) return;

    if (this.waveI < this.waves.length) {
      this.waveT -= dt;
      if (this.waveT <= 0) this.spawnWave();
    }

    for (const d of this.state.drones) {
      if (!d.alive) continue;
      const toIx = this.impact.x - d.x;
      const toIy = this.impact.y - d.y;
      const toIz = this.impact.z - d.z;
      const dist = Math.hypot(toIx, toIy, toIz) || 1;
      const sp = d.speed;
      d.vx = (toIx / dist) * sp;
      d.vy = (toIy / dist) * sp * (0.4 + d.dive * 0.6);
      d.vz = (toIz / dist) * sp;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.z += d.vz * dt;
      if (dist < 40) {
        d.alive = false;
        this.state.leaks += 1;
        if (this.state.leaks >= this.state.maxLeaks) {
          this.fail("LEAK");
          return;
        }
      }
    }

    this.state.alive = this.state.drones.filter((d) => d.alive).length;
    this.state.drones = this.state.drones.filter((d) => d.alive || this.state.status === "RUN");
    this.checkWin();
  }

  tryHitSegment(
    ax: number, ay: number, az: number,
    bx: number, by: number, bz: number,
    radius = 12,
  ): boolean {
    if (!this.state.active || this.finished) return false;
    for (const d of this.state.drones) {
      if (!d.alive) continue;
      if (segmentDist(ax, ay, az, bx, by, bz, d.x, d.y, d.z) <= radius) {
        d.alive = false;
        this.state.kills += 1;
        this.checkWin();
        return true;
      }
    }
    return false;
  }

  tryBlast(x: number, y: number, z: number, radius = 16): number {
    if (!this.state.active || this.finished) return 0;
    let n = 0;
    for (const d of this.state.drones) {
      if (!d.alive) continue;
      if (Math.hypot(d.x - x, d.y - y, d.z - z) <= radius) {
        d.alive = false;
        this.state.kills += 1;
        n++;
      }
    }
    if (n) this.checkWin();
    return n;
  }

  private spawnWave(): void {
    if (!this.def || this.waveI >= this.waves.length) return;
    const w = this.waves[this.waveI]!;
    this.waveI += 1;
    this.waveT = this.def.waveGap;
    const fwdX = -Math.sin(this.heading);
    const fwdZ = -Math.cos(this.heading);
    const rightX = Math.cos(this.heading);
    const rightZ = -Math.sin(this.heading);
    for (let i = 0; i < w.count; i++) {
      const side = (i - (w.count - 1) * 0.5) * 55;
      const near = this.def.spawnNear + (i % 3) * 40;
      const x = this.origin.x + fwdX * near + rightX * side;
      const z = this.origin.z + fwdZ * near + rightZ * side;
      const y = this.origin.y + 40 + (i % 4) * 25;
      this.state.drones.push({
        id: this.nextId++,
        kind: w.kind,
        alive: true,
        x, y, z,
        vx: 0, vy: 0, vz: 0,
        speed: w.speed,
        dive: w.dive,
      });
    }
    this.state.alive = this.state.drones.filter((d) => d.alive).length;
  }

  private checkWin(): void {
    if (this.finished) return;
    const alive = this.state.drones.some((d) => d.alive);
    const moreWaves = this.waveI < this.waves.length;
    if (alive || moreWaves) return;
    if (this.state.leaks >= this.state.maxLeaks) {
      this.fail("LEAK");
      return;
    }
    if (this.state.kills + this.state.leaks >= this.state.total) {
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
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number,
  px: number, py: number, pz: number,
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
  const cx = ax + abx * t;
  const cy = ay + aby * t;
  const cz = az + abz * t;
  return Math.hypot(px - cx, py - cy, pz - cz);
}
