import {
  AUTO_PULL,
  BASE_SPEED,
  CAUTION_AGL,
  CRITICAL_AGL,
  CRUISE_ALT,
  MAX_ALT,
  MIN_AGL,
  SAFE_AGL,
  VERTICAL_DOT,
  WATER_LEVEL,
} from "../constants";
import { Basis } from "../math/basis";
import { clamp, lerp, radToDeg, Vec3, wrap, wrapPi, wrapTau } from "../math/vec3";
import {
  DEFAULT_HANDLING,
  type FlightHandling,
} from "./flightHandling";

/** Escalated AGL / terrain caution for HUD + audio. */
export type AltWarnLevel = "none" | "caution" | "warning" | "pullup";

/**
 * Risk from radar height + sink rate.
 * Effective AGL shrinks while diving; TTI (s) escalates urgency.
 * Slow/shallow near ground stays quieter (approach).
 */
export function evaluateAltWarn(
  agl: number,
  vspeed: number,
  airspeed: number,
): AltWarnLevel {
  const sink = Math.max(0, -vspeed);
  const effective = agl - sink * 1.35;
  const tti = sink > 2 ? agl / sink : Number.POSITIVE_INFINITY;
  const landingQuiet = airspeed < 55 && sink < 6 && agl < 48;

  if (!landingQuiet && (effective < CRITICAL_AGL || tti < 3.5)) {
    return "pullup";
  }
  if (effective < SAFE_AGL || tti < 6) {
    return landingQuiet ? "caution" : "warning";
  }
  if (effective < CAUTION_AGL || tti < 9) {
    return "caution";
  }
  return "none";
}

export interface JetTelemetry {
  airspeed: number;
  altitude: number;
  headingDeg: number;
  pitchDeg: number;
  rollDeg: number;
  vspeed: number;
  radarHeight: number;
  gForce: number;
  turnRate: number;
  afterburner: boolean;
  /** Aerodynamic brake engaged (E). */
  airbrake: boolean;
  warnTerrain: boolean;
  warnLowAlt: boolean;
  /** Escalated low-alt / terrain cue. */
  altWarn: AltWarnLevel;
  /** 0 = idle, 1 = at peak (baseSpeed × abMult). */
  speedNorm: number;
}

export class JetSimulation {
  position = new Vec3(0, CRUISE_ALT, 0);
  basis = Basis.fromEuler(0.08, 0, 0);
  velocity = new Vec3(0, 0, -BASE_SPEED);
  speed = BASE_SPEED;
  yaw = 0;
  pitch = 0.08;
  roll = 0;
  targetRoll = 0;
  afterburner = false;
  /** Aerodynamic brake (E). Nose-up bleed makes the jet hang, then sink. */
  airbrake = false;
  steer = new Vec3(0, 0, 0); // x=bank, y=pitch axis
  engaged = false;

  private sTurnT = 0;
  private prevVel = new Vec3(0, 0, -BASE_SPEED);
  private rollAnim = 0;
  private rolling = false;
  private holdAb = false;
  private holdBrake = false;
  private usingKeys = false;
  private gForce = 1;
  private warnTerrain = false;
  private warnLowAlt = false;
  private altWarn: AltWarnLevel = "none";
  private groundFn: (x: number, z: number) => number = () => 0;
  private handling: FlightHandling = { ...DEFAULT_HANDLING };

  /** Swap flight knobs (call before `resetPose` when possible). */
  setHandling(next: FlightHandling): void {
    this.handling = { ...next };
  }

  getHandling(): FlightHandling {
    return this.handling;
  }

  setGroundSampler(fn: (x: number, z: number) => number): void {
    this.groundFn = fn;
  }

  setAfterburnerHold(on: boolean): void {
    this.holdAb = on;
  }

  setAirbrakeHold(on: boolean): void {
    this.holdBrake = on;
  }

  triggerBarrelRoll(): void {
    if (!this.rolling) {
      this.rolling = true;
      this.rollAnim = 0;
    }
  }

  resetPose(
    origin: Vec3,
    heading: number,
    startSpeed: number = this.handling.baseSpeed,
  ): void {
    this.position.copy(origin);
    this.yaw = heading;
    this.pitch = 0.08;
    this.roll = 0;
    this.targetRoll = 0;
    this.steer.set(0, 0, 0);
    this.rolling = false;
    this.rollAnim = 0;
    this.basis = Basis.fromEuler(this.pitch, this.yaw, this.roll);
    this.speed = startSpeed;
    const nose = this.basis.nose();
    this.velocity.copy(nose).scale(this.speed);
    this.prevVel.copy(this.velocity);
    this.engaged = true;
  }

  /**
   * Apply axis steer for this frame (−1..1). Call before integrate when driving headless.
   */
  setSteerAxis(bank: number, pitch: number, keysActive: boolean): void {
    this.usingKeys = keysActive;
    if (keysActive) this.engaged = true;
    const desiredX = clamp(bank, -1, 1);
    const desiredY = clamp(pitch, -1, 1);
    // Instant set used by tests; updateInput lerps from sampled axes.
    this._desiredSteer = { x: desiredX, y: desiredY };
  }

  private _desiredSteer = { x: 0, y: 0 };

  updateInput(
    dt: number,
    bank: number,
    pitchAxis: number,
    afterburner: boolean,
    airbrake = false,
  ): void {
    this.holdAb = afterburner;
    this.holdBrake = airbrake;
    this.afterburner = this.holdAb && !airbrake;
    this.usingKeys = Math.hypot(bank, pitchAxis) > 0.01;
    let desiredX = 0;
    let desiredY = 0;
    if (this.usingKeys) {
      this.engaged = true;
      desiredX = clamp(bank, -1, 1);
      desiredY = clamp(pitchAxis, -1, 1);
    } else if (!this.engaged) {
      this.sTurnT += dt;
      desiredX = Math.sin(this.sTurnT * 0.35) * 0.45;
      desiredY = Math.sin(this.sTurnT * 0.22) * 0.12;
    }
    const k = 1 - Math.exp(-this.handling.steerSmooth * dt);
    this.steer.x = lerp(this.steer.x, desiredX, k);
    this.steer.y = lerp(this.steer.y, desiredY, k);
  }

  /** Headless path: set steer then integrate (skips input smoothing). */
  integrateForced(dt: number): void {
    this.steer.x = this._desiredSteer.x;
    this.steer.y = this._desiredSteer.y;
    this.afterburner = this.holdAb && !this.holdBrake;
    this.airbrake = this.holdBrake;
    this.integrate(dt);
  }

  integrate(dt: number): void {
    const steerX = this.steer.x;
    const steerY = this.steer.y;
    let basis = this.basis.clone();
    const h = this.handling;
    this.targetRoll = steerX * h.rollAmount;

    const pitchDelta = -steerY * h.pitchRate * dt;
    if (Math.abs(pitchDelta) > 1e-5) {
      basis = basis.rotated(basis.x.normalized(), pitchDelta);
    }

    const yawDelta = -steerX * h.turnRate * dt;
    if (Math.abs(yawDelta) > 1e-5) {
      const nose = basis.nose();
      if (Math.abs(nose.dot(Vec3.UP)) > VERTICAL_DOT) {
        basis = basis.rotated(basis.y.normalized(), yawDelta);
      } else {
        basis = basis.rotated(Vec3.UP, yawDelta);
      }
    }

    if (this.rolling) {
      this.rollAnim += dt * 6.5;
      basis = basis.rotated(basis.nose().normalized(), 6.5 * dt);
      if (this.rollAnim >= Math.PI * 2) {
        this.rollAnim = 0;
        this.rolling = false;
      }
    } else if (Math.abs(steerY) < 0.55) {
      basis = this.blendHorizonBank(basis, this.targetRoll, dt);
    } else if (Math.abs(steerX) > 0.05) {
      basis = this.blendHorizonBank(basis, this.targetRoll, dt);
    }

    const floorProbe = this.solidFloor(this.position.x, this.position.z);
    const agl = this.position.y - floorProbe;
    const airspeedHud = this.speed * 1.85;
    this.altWarn = evaluateAltWarn(agl, this.velocity.y, airspeedHud);
    this.warnLowAlt = this.altWarn !== "none";
    this.warnTerrain =
      this.altWarn === "warning" || this.altWarn === "pullup";

    if (agl < MIN_AGL) {
      basis = this.nudgeNoseUp(basis, AUTO_PULL * dt);
    }
    if (this.position.y > MAX_ALT * 0.92) {
      basis = this.nudgeNoseDown(basis, AUTO_PULL * 0.55 * dt);
    }
    if (this.position.y > MAX_ALT) {
      this.position.y = MAX_ALT;
      basis = this.nudgeNoseDown(basis, AUTO_PULL * dt);
    }

    basis = basis.orthonormalize();
    this.basis.copy(basis);
    this.syncAngles(basis);

    this.airbrake = this.holdBrake;
    if (this.airbrake) this.afterburner = false;
    const cruise = h.baseSpeed;
    let targetSpeed = cruise * (this.afterburner ? h.abMult : 1);
    let rate = h.accelRate;
    if (this.airbrake) {
      const noseUp = clamp((this.pitch - 0.06) / 0.3, 0, 1);
      targetSpeed = cruise * 0.32;
      rate = 5.5 + noseUp * 3.5;
    }
    this.speed = lerp(this.speed, targetSpeed, 1 - Math.exp(-rate * dt));
    const nose = basis.nose();
    const vel = nose.clone().scale(this.speed);
    if (this.airbrake && this.pitch > 0.1) {
      // Lift fades with speed: the nose stays up, the path hangs, then sinks.
      const energy = clamp((this.speed - cruise * 0.42) / (cruise * 0.65), 0, 1);
      const sink = (1 - energy) * 46;
      vel.y = vel.y * (0.3 + 0.7 * energy) - sink;
    }
    this.velocity.copy(vel);
    this.position.addScaled(this.velocity, dt);

    let floorY = this.solidFloor(this.position.x, this.position.z) + 8;
    floorY = Math.max(floorY, WATER_LEVEL + 4);
    if (this.position.y < floorY) {
      this.position.y = floorY;
      basis = this.nudgeNoseUp(basis, 0.55).orthonormalize();
      this.basis.copy(basis);
      this.syncAngles(basis);
      this.velocity.copy(basis.nose()).scale(this.speed);
    }
  }

  /**
   * Slide the aircraft on a real surface.
   * A steep face (ny > 0.5) is a roof and keeps the same 8 m clearance as terrain.
   * A wall turns the nose onto the face so the next frame does not tunnel back in.
   */
  resolveSurface(
    hit: { x: number; y: number; z: number; nx: number; ny: number; nz: number },
    noseReach = 11,
  ): void {
    const n = new Vec3(hit.nx, hit.ny, hit.nz);
    if (n.lengthSq() < 1e-8) return;
    n.normalize();
    if (n.y > 0.5) {
      const roof = hit.y + 8;
      if (this.position.y >= roof) return;
      this.position.y = roof;
      if (this.velocity.y < 0) {
        const basis = this.nudgeNoseUp(this.basis.clone(), 0.35).orthonormalize();
        this.basis.copy(basis);
        this.syncAngles(basis);
      }
      this.velocity.copy(this.basis.nose()).scale(this.speed);
      if (this.velocity.y < 0) this.velocity.y = 0;
      return;
    }

    const nose = this.basis.nose();
    const into = nose.dot(n);
    if (into < -0.02) {
      const fwd = nose.clone().addScaled(n, -into);
      if (fwd.lengthSq() > 1e-6) {
        fwd.normalize();
        const right = this.basis.x.clone();
        right.addScaled(fwd, -right.dot(fwd));
        if (right.lengthSq() < 1e-6) right.copy(Vec3.UP.cross(fwd));
        right.normalize();
        this.basis.z.copy(fwd).scale(-1);
        this.basis.x.copy(right);
        this.basis.y.copy(this.basis.z.cross(this.basis.x)).normalize();
        this.basis.orthonormalize();
        this.syncAngles(this.basis);
      }
    }
    const slide = this.basis.nose();
    const gap = 1.4;
    const tipX = this.position.x + slide.x * noseReach;
    const tipY = this.position.y + slide.y * noseReach;
    const tipZ = this.position.z + slide.z * noseReach;
    const past = (tipX - hit.x) * n.x + (tipY - hit.y) * n.y + (tipZ - hit.z) * n.z;
    if (past < gap) {
      this.position.x = hit.x + n.x * gap - slide.x * noseReach;
      this.position.y = hit.y + n.y * gap - slide.y * noseReach;
      this.position.z = hit.z + n.z * gap - slide.z * noseReach;
    }
    this.velocity.copy(slide).scale(this.speed);
  }

  tickTelemetry(dt: number): JetTelemetry {
    const accel = this.velocity.clone().addScaled(this.prevVel, -1);
    accel.scale(1 / Math.max(dt, 1e-4));
    this.prevVel.copy(this.velocity);
    const g = 1 + accel.dot(this.basis.y) / 9.81;
    this.gForce = lerp(this.gForce, clamp(g, -2, 9), 0.15);

    const peak = Math.max(1e-3, this.handling.baseSpeed * this.handling.abMult);
    return {
      airspeed: this.speed * 1.85,
      altitude: this.position.y,
      headingDeg: radToDeg(wrapTau(this.yaw)),
      pitchDeg: radToDeg(wrapPi(this.pitch)),
      rollDeg: radToDeg(wrapPi(this.roll)),
      vspeed: this.velocity.y,
      radarHeight: this.position.y - this.solidFloor(this.position.x, this.position.z),
      gForce: this.gForce,
      turnRate: -this.steer.x,
      afterburner: this.afterburner,
      airbrake: this.airbrake,
      warnTerrain: this.warnTerrain,
      warnLowAlt: this.warnLowAlt,
      altWarn: this.altWarn,
      speedNorm: clamp(this.speed / peak, 0, 1.05),
    };
  }

  private blendHorizonBank(basis: Basis, desiredBank: number, dt: number): Basis {
    const nose = basis.nose();
    if (Math.abs(nose.dot(Vec3.UP)) > VERTICAL_DOT) return basis;
    const flatRight = nose.cross(Vec3.UP);
    if (flatRight.lengthSq() < 1e-4) return basis;
    flatRight.normalize();
    const desiredRight = flatRight.clone().rotateAround(nose, desiredBank);
    const ang = (() => {
      const cross = basis.x.cross(desiredRight);
      const sin = cross.dot(nose);
      const cos = basis.x.dot(desiredRight);
      return Math.atan2(sin, cos);
    })();
    const step = ang * (1 - Math.exp(-this.handling.rollResp * dt));
    return basis.rotated(nose.normalized(), step);
  }

  private nudgeNoseUp(basis: Basis, amount: number): Basis {
    const nose = basis.nose();
    const lift = 1 - clamp(nose.dot(Vec3.UP), -1, 1);
    if (lift < 0.02) return basis;
    return basis.rotated(basis.x.normalized(), amount * lift);
  }

  private nudgeNoseDown(basis: Basis, amount: number): Basis {
    const nose = basis.nose();
    if (nose.y <= 0) return basis;
    return basis.rotated(basis.x.normalized(), -amount * clamp(nose.y, 0, 1));
  }

  private syncAngles(basis: Basis): void {
    const e = basis.getEuler();
    this.pitch = e.pitch;
    this.yaw = e.yaw;
    this.roll = e.roll;
  }

  private solidFloor(x: number, z: number): number {
    return Math.max(this.groundFn(x, z), WATER_LEVEL);
  }
}
