import { Aircraft } from "@afd/shared-types";
import {
  aircraftProfile,
  type AircraftRole,
} from "../balance/aircraftProfiles";

/** Half-angle FOV stored as cos for cheap nose-dot checks. */
export interface SensorProfile {
  canLockAa: boolean;
  canLockAg: boolean;
  /** Max acquire / hold range (world units). */
  lockRange: number;
  /** Cosine of half-cone for acquire. */
  lockConeCos: number;
  /** Cosine of wider break cone (must stay ≤ lockConeCos). */
  breakConeCos: number;
  /** Seconds of solid track to reach LOCKED. */
  lockTime: number;
  /** Seconds out of break cone / range before drop. */
  loseTime: number;
}

export type LockKind = "aa" | "ag";
export type LockPhase = "none" | "acquiring" | "locked";

export interface LockCandidate {
  id: string;
  kind: LockKind;
  x: number;
  y: number;
  z: number;
}

export interface TargetLockState {
  phase: LockPhase;
  /** 0..1 while acquiring; 1 when locked. */
  progress: number;
  targetId: string | null;
  kind: LockKind | null;
  range: number;
  /** Live aim point of the locked / acquiring target. */
  x: number;
  y: number;
  z: number;
}

const EMPTY: TargetLockState = {
  phase: "none",
  progress: 0,
  targetId: null,
  kind: null,
  range: 0,
  x: 0,
  y: 0,
  z: 0,
};

function degCos(halfDeg: number): number {
  return Math.cos((halfDeg * Math.PI) / 180);
}

/** Role baselines — tuned for arcade feel, not real radar. */
const ROLE_SENSOR: Record<AircraftRole, SensorProfile> = {
  interceptor: {
    canLockAa: true,
    canLockAg: true,
    lockRange: 1900,
    lockConeCos: degCos(16),
    breakConeCos: degCos(24),
    lockTime: 0.65,
    loseTime: 0.55,
  },
  stealth: {
    canLockAa: true,
    canLockAg: true,
    lockRange: 1700,
    lockConeCos: degCos(15),
    breakConeCos: degCos(22),
    lockTime: 0.8,
    loseTime: 0.6,
  },
  air_superiority: {
    canLockAa: true,
    canLockAg: true,
    lockRange: 1750,
    lockConeCos: degCos(17),
    breakConeCos: degCos(25),
    lockTime: 0.75,
    loseTime: 0.55,
  },
  multirole: {
    canLockAa: true,
    canLockAg: true,
    lockRange: 1550,
    lockConeCos: degCos(19),
    breakConeCos: degCos(28),
    lockTime: 0.95,
    loseTime: 0.7,
  },
  agile: {
    canLockAa: true,
    canLockAg: true,
    lockRange: 1450,
    lockConeCos: degCos(20),
    breakConeCos: degCos(30),
    lockTime: 0.9,
    loseTime: 0.65,
  },
  heavy: {
    canLockAa: true,
    canLockAg: true,
    lockRange: 1400,
    lockConeCos: degCos(18),
    breakConeCos: degCos(26),
    lockTime: 1.1,
    loseTime: 0.75,
  },
  strike: {
    canLockAa: false,
    canLockAg: true,
    lockRange: 1600,
    lockConeCos: degCos(22),
    breakConeCos: degCos(32),
    lockTime: 0.7,
    loseTime: 0.8,
  },
  recon: {
    canLockAa: false,
    canLockAg: true,
    lockRange: 2000,
    lockConeCos: degCos(12),
    breakConeCos: degCos(18),
    lockTime: 1.35,
    loseTime: 0.5,
  },
};

/** Derive sensor from aircraft role + radar/precision attrs. */
export function sensorFor(aircraft: Aircraft): SensorProfile {
  const profile = aircraftProfile(aircraft);
  const base = ROLE_SENSOR[profile.role];
  const radar = profile.attrs.radar / 100;
  const precision = profile.attrs.precision / 100;
  // Radar stretches range; precision shortens lock time and tightens cone slightly.
  const lockRange = base.lockRange * (0.85 + radar * 0.3);
  const lockTime = Math.max(0.4, base.lockTime * (1.25 - precision * 0.45));
  const coneBoost = (precision - 0.5) * 0.04; // small
  const lockConeCos = clampCos(base.lockConeCos + coneBoost);
  const breakConeCos = Math.min(base.breakConeCos, lockConeCos - 0.02);
  return {
    canLockAa: base.canLockAa,
    canLockAg: base.canLockAg,
    lockRange,
    lockConeCos,
    breakConeCos: Math.min(breakConeCos, lockConeCos),
    lockTime,
    loseTime: base.loseTime,
  };
}

function clampCos(c: number): number {
  return Math.min(0.999, Math.max(0.5, c));
}

function scoreCandidate(
  origin: { x: number; y: number; z: number },
  nose: { x: number; y: number; z: number },
  c: LockCandidate,
  profile: SensorProfile,
): number | null {
  if (c.kind === "aa" && !profile.canLockAa) return null;
  if (c.kind === "ag" && !profile.canLockAg) return null;
  const dx = c.x - origin.x;
  const dy = c.y - origin.y;
  const dz = c.z - origin.z;
  const range = Math.hypot(dx, dy, dz);
  if (range < 40 || range > profile.lockRange) return null;
  const inv = 1 / range;
  const dot = nose.x * dx * inv + nose.y * dy * inv + nose.z * dz * inv;
  if (dot < profile.lockConeCos) return null;
  // Prefer near bore + nearer targets.
  return dot * 2 - range / profile.lockRange;
}

function stillTracked(
  origin: { x: number; y: number; z: number },
  nose: { x: number; y: number; z: number },
  c: LockCandidate,
  profile: SensorProfile,
): { ok: boolean; range: number } {
  if (c.kind === "aa" && !profile.canLockAa) return { ok: false, range: 0 };
  if (c.kind === "ag" && !profile.canLockAg) return { ok: false, range: 0 };
  const dx = c.x - origin.x;
  const dy = c.y - origin.y;
  const dz = c.z - origin.z;
  const range = Math.hypot(dx, dy, dz);
  if (range < 20 || range > profile.lockRange * 1.08) return { ok: false, range };
  const inv = 1 / Math.max(range, 1e-3);
  const dot = nose.x * dx * inv + nose.y * dy * inv + nose.z * dz * inv;
  if (dot < profile.breakConeCos) return { ok: false, range };
  return { ok: true, range };
}

/**
 * Single-target lock tracker. Call `tick` once per frame with live candidates.
 */
export class TargetLockTracker {
  private profile: SensorProfile = ROLE_SENSOR.multirole;
  private loseAccum = 0;
  state: TargetLockState = { ...EMPTY };

  setProfile(next: SensorProfile): void {
    this.profile = { ...next };
  }

  getProfile(): SensorProfile {
    return { ...this.profile };
  }

  clear(): void {
    this.state = { ...EMPTY };
    this.loseAccum = 0;
  }

  tick(
    dt: number,
    origin: { x: number; y: number; z: number },
    nose: { x: number; y: number; z: number },
    candidates: readonly LockCandidate[],
  ): TargetLockState {
    const profile = this.profile;
    if (!profile.canLockAa && !profile.canLockAg) {
      this.clear();
      return this.state;
    }

    const byId = new Map(candidates.map((c) => [c.id, c]));
    const current =
      this.state.targetId != null ? byId.get(this.state.targetId) ?? null : null;

    if (this.state.phase !== "none" && current) {
      const track = stillTracked(origin, nose, current, profile);
      if (track.ok) {
        this.loseAccum = 0;
        this.state = {
          ...this.state,
          range: track.range,
          x: current.x,
          y: current.y,
          z: current.z,
          kind: current.kind,
        };
        if (this.state.phase === "acquiring") {
          const next = Math.min(1, this.state.progress + dt / profile.lockTime);
          this.state = {
            ...this.state,
            progress: next,
            phase: next >= 1 ? "locked" : "acquiring",
          };
        } else {
          this.state = { ...this.state, progress: 1, phase: "locked" };
        }
        return this.state;
      }
      this.loseAccum += dt;
      if (this.loseAccum < profile.loseTime) {
        // Keep last known point briefly while breaking.
        return this.state;
      }
      this.clear();
    } else if (this.state.phase !== "none" && !current) {
      this.clear();
    }

    // Acquire new
    let best: LockCandidate | null = null;
    let bestScore = -1e9;
    for (const c of candidates) {
      const s = scoreCandidate(origin, nose, c, profile);
      if (s == null) continue;
      if (s > bestScore) {
        bestScore = s;
        best = c;
      }
    }
    if (!best) {
      this.clear();
      return this.state;
    }

    const dx = best.x - origin.x;
    const dy = best.y - origin.y;
    const dz = best.z - origin.z;
    const range = Math.hypot(dx, dy, dz);
    const progress = Math.min(1, dt / profile.lockTime);
    this.loseAccum = 0;
    this.state = {
      phase: progress >= 1 ? "locked" : "acquiring",
      progress,
      targetId: best.id,
      kind: best.kind,
      range,
      x: best.x,
      y: best.y,
      z: best.z,
    };
    return this.state;
  }
}
