/** Flare dumps — arcade IR decoy against seekPlayer missiles. */

export type FlareMode = "manual" | "auto" | "both";

export const FLARE_MODE_LABEL: Record<FlareMode, string> = {
  manual: "Manual (X)",
  auto: "Automático",
  both: "Manual + Auto",
};

export const FLARE_MAX = 6;
export const FLARE_REARM = 5.5;
/** Min seconds between dumps. */
export const FLARE_COOLDOWN = 0.55;
/** How long decoys stay “hot” for seekers. */
export const FLARE_WINDOW = 1.35;
export const FLARE_PELLET_LIFE = 2.2;

export interface FlarePellet {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
}

export interface CountermeasureState {
  ready: number;
  maxReady: number;
  /** Seconds until next dump allowed. */
  cooldown: number;
  /** Remaining IR window after last successful dump. */
  windowLeft: number;
  pellets: FlarePellet[];
}

export interface FlareDeployOrigin {
  x: number;
  y: number;
  z: number;
  /** Jet velocity — flares drift slightly aft. */
  vx: number;
  vy: number;
  vz: number;
}

/**
 * Player flare magazine + decoy cloud.
 * Does not know about missiles — FlightScene / MissileSystem query decoy.
 */
export class CountermeasureSystem {
  ready = FLARE_MAX;
  private maxReady = FLARE_MAX;
  private rearm = FLARE_REARM;
  private cooldownLeft = 0;
  private windowLeft = 0;
  private rearmCd = 0;
  readonly pellets: FlarePellet[] = Array.from({ length: 24 }, () => ({
    active: false,
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    life: 0,
  }));

  get state(): CountermeasureState {
    return {
      ready: this.ready,
      maxReady: this.maxReady,
      cooldown: this.cooldownLeft,
      windowLeft: this.windowLeft,
      pellets: this.pellets,
    };
  }

  /** True while decoys can steal a seeker. */
  get windowOpen(): boolean {
    return this.windowLeft > 0;
  }

  /** Mean position of live pellets — seeker bait. */
  decoyPoint(): { x: number; y: number; z: number } | null {
    let n = 0;
    let x = 0;
    let y = 0;
    let z = 0;
    for (const p of this.pellets) {
      if (!p.active) continue;
      x += p.x;
      y += p.y;
      z += p.z;
      n++;
    }
    if (!n) return null;
    return { x: x / n, y: y / n, z: z / n };
  }

  /**
   * Auto should fire when a seeker is closing in the danger band.
   * Caller gates by FlareMode.
   */
  shouldAutoDeploy(threatDist: number, closingDot: number): boolean {
    if (this.ready <= 0 || this.cooldownLeft > 0) return false;
    if (this.windowLeft > 0.45) return false; // already covered
    // Sweet spot: not point-blank, not far.
    if (threatDist < 90 || threatDist > 780) return false;
    return closingDot > 0.55;
  }

  tryDeploy(origin: FlareDeployOrigin): boolean {
    if (this.ready <= 0 || this.cooldownLeft > 0) return false;
    this.ready -= 1;
    this.cooldownLeft = FLARE_COOLDOWN;
    this.windowLeft = FLARE_WINDOW;
    this.rearmCd = this.rearm;
    this.spawnPellets(origin);
    return true;
  }

  tick(dt: number): void {
    if (this.cooldownLeft > 0) {
      this.cooldownLeft = Math.max(0, this.cooldownLeft - dt);
    }
    if (this.windowLeft > 0) {
      this.windowLeft = Math.max(0, this.windowLeft - dt);
    }
    if (this.ready < this.maxReady) {
      this.rearmCd -= dt;
      if (this.rearmCd <= 0) {
        this.ready += 1;
        this.rearmCd = this.rearm;
      }
    }
    for (const p of this.pellets) {
      if (!p.active) continue;
      p.life -= dt;
      p.vy -= 6 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.life <= 0) p.active = false;
    }
  }

  private spawnPellets(origin: FlareDeployOrigin): void {
    let spawned = 0;
    for (const p of this.pellets) {
      if (p.active) continue;
      const side = (Math.random() - 0.5) * 18;
      const aft = -8 - Math.random() * 14;
      const up = (Math.random() - 0.35) * 10;
      p.active = true;
      p.x = origin.x + side * 0.4;
      p.y = origin.y + up * 0.25 - 1.2;
      p.z = origin.z;
      // Drift mostly opposite jet velocity + scatter.
      p.vx = origin.vx * 0.35 + (Math.random() - 0.5) * 22 + side * 0.8;
      p.vy = origin.vy * 0.2 + 4 + Math.random() * 10 + up * 0.3;
      p.vz = origin.vz * 0.35 + aft * 1.1 + (Math.random() - 0.5) * 16;
      p.life = FLARE_PELLET_LIFE * (0.75 + Math.random() * 0.4);
      spawned++;
      if (spawned >= 8) break;
    }
  }
}

export function normalizeFlareMode(v: unknown): FlareMode {
  if (v === "auto" || v === "both" || v === "manual") return v;
  return "manual";
}
