export const MISSILE_MAX = 4;
export const MISSILE_REARM = 4.5;
export const MISSILE_SPEED = 280;
export const MISSILE_LIFE = 4.5;

export interface Missile {
  active: boolean;
  x: number;
  y: number;
  z: number;
  px: number;
  py: number;
  pz: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  trailId: number;
}

export interface AimSample {
  x: number;
  y: number;
  z: number;
  range: number;
  valid: boolean;
}

export class MissileSystem {
  ready = MISSILE_MAX;
  private cds = [0, 0, 0, 0];
  private rail = 0;
  readonly missiles: Missile[] = Array.from({ length: 12 }, () => ({
    active: false,
    x: 0, y: 0, z: 0,
    px: 0, py: 0, pz: 0,
    vx: 0, vy: 0, vz: 0,
    life: 0,
    trailId: -1,
  }));

  tryFire(
    origin: { x: number; y: number; z: number },
    dir: { x: number; y: number; z: number },
  ): Missile | null {
    if (this.ready <= 0) return null;
    let slot = -1;
    for (let i = 0; i < 4; i++) {
      const idx = (this.rail + i) % 4;
      if (this.cds[idx]! <= 0) {
        slot = idx;
        break;
      }
    }
    if (slot < 0) return null;
    this.cds[slot] = MISSILE_REARM;
    this.rail = (slot + 1) % 4;
    this.ready = Math.max(0, this.ready - 1);

    const m = this.missiles.find((x) => !x.active);
    if (!m) return null;
    const len = Math.hypot(dir.x, dir.y, dir.z) || 1;
    m.active = true;
    m.x = origin.x;
    m.y = origin.y;
    m.z = origin.z;
    m.px = origin.x;
    m.py = origin.y;
    m.pz = origin.z;
    m.vx = (dir.x / len) * MISSILE_SPEED;
    m.vy = (dir.y / len) * MISSILE_SPEED;
    m.vz = (dir.z / len) * MISSILE_SPEED;
    m.life = MISSILE_LIFE;
    return m;
  }

  tick(dt: number, groundFn: (x: number, z: number) => number): Missile[] {
    for (let i = 0; i < 4; i++) {
      if (this.cds[i]! > 0) {
        this.cds[i]! -= dt;
        if (this.cds[i]! <= 0) {
          this.cds[i] = 0;
          if (this.ready < MISSILE_MAX) this.ready += 1;
        }
      }
    }

    const impacts: Missile[] = [];
    for (const m of this.missiles) {
      if (!m.active) continue;
      m.px = m.x;
      m.py = m.y;
      m.pz = m.z;
      m.vy -= 4 * dt; // mild drop
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      m.z += m.vz * dt;
      m.life -= dt;
      const floor = groundFn(m.x, m.z);
      if (m.life <= 0 || m.y <= floor + 1) {
        m.active = false;
        impacts.push(m);
      }
    }
    return impacts;
  }
}

/** CCIP-style aim point along nose with light drop. */
export function sampleAim(
  origin: { x: number; y: number; z: number },
  nose: { x: number; y: number; z: number },
  groundFn: (x: number, z: number) => number,
  maxRange = 1400,
): AimSample {
  let dist = 16;
  let drop = 0;
  let prev = { ...origin };
  while (dist < maxRange) {
    drop += 0.012 * dist * 0.02;
    const x = origin.x + nose.x * dist;
    const y = origin.y + nose.y * dist - drop;
    const z = origin.z + nose.z * dist;
    const surface = groundFn(x, z);
    if (y <= surface + 1) {
      return {
        x,
        y: surface + 0.6,
        z,
        range: Math.hypot(x - origin.x, y - origin.y, z - origin.z),
        valid: true,
      };
    }
    const agl = y - surface;
    prev = { x, y, z };
    dist += Math.min(36, Math.max(3.5, agl * 0.3));
  }
  void prev;
  const x = origin.x + nose.x * 500;
  const z = origin.z + nose.z * 500;
  const y = groundFn(x, z) + 0.6;
  return { x, y, z, range: 500, valid: true };
}
