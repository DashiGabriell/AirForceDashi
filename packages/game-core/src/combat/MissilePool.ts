export const MISSILE_MAX = 4;
export const MISSILE_REARM = 4.5;
/** Must outpace peak fighter TAS (~800 m/s) so chase shots still connect. */
export const MISSILE_SPEED = 1350;
export const MISSILE_LIFE = 4.5;

/** Perfil de tiro derivado do armamento equipado. */
export interface MissileFireProfile {
  maxReady: number;
  rearm: number;
  speed: number;
  life: number;
  damage: number;
  blastRadius: number;
  hitRadius: number;
}

export const DEFAULT_MISSILE_PROFILE: MissileFireProfile = {
  maxReady: MISSILE_MAX,
  rearm: MISSILE_REARM,
  speed: MISSILE_SPEED,
  life: MISSILE_LIFE,
  damage: 1,
  blastRadius: 16,
  hitRadius: 12,
};

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
  damage: number;
  blastRadius: number;
  hitRadius: number;
  /** Soft seek toward lock snapshot when guided. */
  guided: boolean;
  lockX: number;
  lockY: number;
  lockZ: number;
}

/** Dynamic Launch Zone bands — Godot `Game.DLZ_*`. */
export const DLZ_RMIN = 90;
export const DLZ_ROPT = 350;
export const DLZ_RPI = 900;
export const DLZ_RAERO = 2200;

export interface AimSample {
  x: number;
  y: number;
  z: number;
  range: number;
  valid: boolean;
  ready: boolean;
  inDlz: boolean;
  /** Flight-path marker world point (velocity vector ahead). */
  fpmX: number;
  fpmY: number;
  fpmZ: number;
  /** Nose boresight world point. */
  boreX: number;
  boreY: number;
  boreZ: number;
}

export interface AimSampleOpts {
  velocity?: { x: number; y: number; z: number };
  missilesReady?: number;
  /** Building AABBs for face hits along the CCIP ray (Godot building_segment_hit). */
  buildings?: { cx: number; cy: number; cz: number; hx: number; hy: number; hz: number }[];
  waterLevel?: number;
}

export class MissileSystem {
  ready = MISSILE_MAX;
  private cds = [0, 0, 0, 0];
  private rail = 0;
  private profile: MissileFireProfile = { ...DEFAULT_MISSILE_PROFILE };
  readonly missiles: Missile[] = Array.from({ length: 12 }, () => ({
    active: false,
    x: 0, y: 0, z: 0,
    px: 0, py: 0, pz: 0,
    vx: 0, vy: 0, vz: 0,
    life: 0,
    trailId: -1,
    damage: 1,
    blastRadius: 16,
    hitRadius: 12,
    guided: false,
    lockX: 0,
    lockY: 0,
    lockZ: 0,
  }));

  /** Homing turn rate (rad/s) when guided. */
  private guideTurn = 2.4;

  setProfile(next: Partial<MissileFireProfile>): void {
    this.profile = { ...this.profile, ...next };
    this.ready = Math.min(this.ready, this.profile.maxReady);
  }

  getProfile(): MissileFireProfile {
    return { ...this.profile };
  }

  tryFire(
    origin: { x: number; y: number; z: number },
    dir: { x: number; y: number; z: number },
    lock?: { x: number; y: number; z: number } | null,
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
    this.cds[slot] = this.profile.rearm;
    this.rail = (slot + 1) % 4;
    this.ready = Math.max(0, this.ready - 1);

    const m = this.missiles.find((x) => !x.active);
    if (!m) return null;
    let dx: number;
    let dy: number;
    let dz: number;
    if (lock) {
      dx = lock.x - origin.x;
      dy = lock.y - origin.y;
      dz = lock.z - origin.z;
    } else {
      dx = dir.x;
      dy = dir.y;
      dz = dir.z;
    }
    const dlen = Math.hypot(dx, dy, dz) || 1;
    dx /= dlen;
    dy /= dlen;
    dz /= dlen;
    m.active = true;
    m.x = origin.x;
    m.y = origin.y;
    m.z = origin.z;
    m.px = origin.x;
    m.py = origin.y;
    m.pz = origin.z;
    m.vx = dx * this.profile.speed;
    m.vy = dy * this.profile.speed;
    m.vz = dz * this.profile.speed;
    m.life = this.profile.life;
    m.damage = this.profile.damage;
    m.blastRadius = this.profile.blastRadius;
    m.hitRadius = this.profile.hitRadius;
    if (lock) {
      m.guided = true;
      m.lockX = lock.x;
      m.lockY = lock.y;
      m.lockZ = lock.z;
    } else {
      m.guided = false;
      m.lockX = 0;
      m.lockY = 0;
      m.lockZ = 0;
    }
    return m;
  }

  tick(dt: number, groundFn: (x: number, z: number) => number): Missile[] {
    const maxReady = this.profile.maxReady;
    for (let i = 0; i < 4; i++) {
      if (this.cds[i]! > 0) {
        this.cds[i]! -= dt;
        if (this.cds[i]! <= 0) {
          this.cds[i] = 0;
          if (this.ready < maxReady) this.ready += 1;
        }
      }
    }

    const impacts: Missile[] = [];
    for (const m of this.missiles) {
      if (!m.active) continue;
      m.px = m.x;
      m.py = m.y;
      m.pz = m.z;
      if (m.guided) {
        const dx = m.lockX - m.x;
        const dy = m.lockY - m.y;
        const dz = m.lockZ - m.z;
        const dlen = Math.hypot(dx, dy, dz) || 1;
        const wantX = dx / dlen;
        const wantY = dy / dlen;
        const wantZ = dz / dlen;
        const speed = Math.hypot(m.vx, m.vy, m.vz) || this.profile.speed;
        const curX = m.vx / speed;
        const curY = m.vy / speed;
        const curZ = m.vz / speed;
        const maxStep = this.guideTurn * dt;
        const dot = Math.max(-1, Math.min(1, curX * wantX + curY * wantY + curZ * wantZ));
        const ang = Math.acos(dot);
        const t = ang < 1e-4 ? 1 : Math.min(1, maxStep / ang);
        let nx = curX + (wantX - curX) * t;
        let ny = curY + (wantY - curY) * t;
        let nz = curZ + (wantZ - curZ) * t;
        const nlen = Math.hypot(nx, ny, nz) || 1;
        nx /= nlen;
        ny /= nlen;
        nz /= nlen;
        m.vx = nx * speed;
        m.vy = ny * speed;
        m.vz = nz * speed;
      } else {
        m.vy -= 4 * dt; // mild drop (dumb fire only)
      }
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      m.z += m.vz * dt;
      m.life -= dt;
      const floor = groundFn(m.x, m.z);
      if (m.y <= floor + 1) {
        m.active = false;
        // Assenta no solo para o VFX de impacto terrestre.
        m.y = floor + 0.55;
        impacts.push(m);
      } else if (m.life <= 0) {
        m.active = false;
        impacts.push(m);
      }
    }
    return impacts;
  }
}

function roofAt(
  x: number,
  z: number,
  buildings: AimSampleOpts["buildings"],
): number {
  if (!buildings?.length) return -1e9;
  let best = -1e9;
  for (const b of buildings) {
    if (
      x >= b.cx - b.hx &&
      x <= b.cx + b.hx &&
      z >= b.cz - b.hz &&
      z <= b.cz + b.hz
    ) {
      best = Math.max(best, b.cy + b.hy);
    }
  }
  return best;
}

function segmentBuildingHit(
  from: { x: number; y: number; z: number },
  to: { x: number; y: number; z: number },
  buildings: AimSampleOpts["buildings"],
): { x: number; y: number; z: number } | null {
  if (!buildings?.length) return null;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  let bestT = 1.0001;
  let best: { x: number; y: number; z: number } | null = null;
  for (const b of buildings) {
    const minX = b.cx - b.hx;
    const maxX = b.cx + b.hx;
    const minY = b.cy - b.hy;
    const maxY = b.cy + b.hy;
    const minZ = b.cz - b.hz;
    const maxZ = b.cz + b.hz;
    let tMin = 0;
    let tMax = 1;
    const axes: [number, number, number, number][] = [
      [dx, from.x, minX, maxX],
      [dy, from.y, minY, maxY],
      [dz, from.z, minZ, maxZ],
    ];
    let miss = false;
    for (const [d, o, mn, mx] of axes) {
      if (Math.abs(d) < 1e-9) {
        if (o < mn || o > mx) {
          miss = true;
          break;
        }
        continue;
      }
      let t1 = (mn - o) / d;
      let t2 = (mx - o) / d;
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
      }
      tMin = Math.max(tMin, t1);
      tMax = Math.min(tMax, t2);
      if (tMin > tMax) {
        miss = true;
        break;
      }
    }
    if (!miss && tMin >= 0 && tMin <= 1 && tMin < bestT) {
      bestT = tMin;
      best = {
        x: from.x + dx * tMin,
        y: from.y + dy * tMin,
        z: from.z + dz * tMin,
      };
    }
  }
  return best;
}

/** CCIP-style aim — Godot `Jet.update_aim` parity (drop + building faces + DLZ). */
export function sampleAim(
  origin: { x: number; y: number; z: number },
  nose: { x: number; y: number; z: number },
  groundFn: (x: number, z: number) => number,
  opts: AimSampleOpts = {},
): AimSample {
  const water = opts.waterLevel ?? 0;
  const buildings = opts.buildings;
  const ready = (opts.missilesReady ?? 1) > 0;

  const vel = opts.velocity;
  const velLen = vel ? Math.hypot(vel.x, vel.y, vel.z) : 0;
  const velDir =
    vel && velLen > 1
      ? { x: vel.x / velLen, y: vel.y / velLen, z: vel.z / velLen }
      : nose;

  const fpmX = origin.x + velDir.x * 600;
  const fpmY = origin.y + velDir.y * 600;
  const fpmZ = origin.z + velDir.z * 600;
  const boreX = origin.x + nose.x * 600;
  const boreY = origin.y + nose.y * 600;
  const boreZ = origin.z + nose.z * 600;

  const finish = (
    hx: number,
    hy: number,
    hz: number,
    valid: boolean,
  ): AimSample => {
    const range = Math.hypot(hx - origin.x, hy - origin.y, hz - origin.z);
    const inDlz =
      ready && valid && range >= DLZ_RMIN && range <= DLZ_RAERO;
    return {
      x: hx,
      y: hy,
      z: hz,
      range,
      valid,
      ready,
      inDlz,
      fpmX,
      fpmY,
      fpmZ,
      boreX,
      boreY,
      boreZ,
    };
  };

  const maxRange = DLZ_RAERO + 400;
  let dist = 16;
  let drop = 0;
  let prev = { ...origin };
  while (dist < maxRange) {
    drop += 0.012 * dist * 0.02;
    const x = origin.x + nose.x * dist;
    const y = origin.y + nose.y * dist - drop;
    const z = origin.z + nose.z * dist;
    const p = { x, y, z };

    const bhit = segmentBuildingHit(prev, p, buildings);
    if (bhit) return finish(bhit.x, bhit.y, bhit.z, true);

    let surface = Math.max(groundFn(x, z), water);
    const roof = roofAt(x, z, buildings);
    if (roof > -1e8) surface = Math.max(surface, roof);

    if (y <= surface + 1) {
      return finish(x, surface + 0.6, z, true);
    }
    const agl = y - surface;
    prev = p;
    dist += Math.min(36, Math.max(3.5, agl * 0.3));
  }

  const ax = origin.x + nose.x * 500;
  const az = origin.z + nose.z * 500;
  let ay = Math.max(groundFn(ax, az), water) + 0.6;
  const roofA = roofAt(ax, az, buildings);
  if (roofA > -1e8) ay = Math.max(ay, roofA + 0.6);
  return finish(ax, ay, az, true);
}
