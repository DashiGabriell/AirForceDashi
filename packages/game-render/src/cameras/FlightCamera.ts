import { Cam } from "@afd/shared-types";
import type { JetTelemetry } from "@afd/game-core";
import { PerspectiveCamera, Vector3 } from "three";
import type { Basis } from "@afd/game-core";

export interface CamTarget {
  position: { x: number; y: number; z: number };
  basis: Basis;
  telemetry: JetTelemetry;
}

const _pos = new Vector3();
const _look = new Vector3();
const _up = new Vector3();
const _tmp = new Vector3();

export class FlightCamera {
  readonly camera = new PerspectiveCamera(58, 1, 0.2, 36000);
  chasePivot = new Vector3();
  lookAhead = new Vector3();
  private freePos = new Vector3(18, 12, 28);
  private freeYaw = 0;
  private freePitch = -0.2;
  private freeReady = false;
  freeCamSpeed = 120;
  private fovPunch = 0;
  private abWas = false;
  /** High-frequency buffet when near peak TAS. */
  private shakePhase = 0;
  mode: Cam = Cam.CHASE;
  /** Segurar Q: órbita próxima do jato. */
  private inspectActive = false;
  private inspectYaw = 0.85;
  private inspectPitch = 0.22;
  private inspectDist = 15;
  private readonly inspectDistMin = 5.5;
  private readonly inspectDistMax = 42;

  setMode(mode: Cam): void {
    if (mode === Cam.FREE && this.mode !== Cam.FREE) {
      this.freeReady = true;
    }
    if (mode !== Cam.FREE) this.freeReady = false;
    this.mode = mode;
  }

  enterFree(target: CamTarget): void {
    const b = target.basis;
    this.freePos.set(
      target.position.x + b.x.x * 18 + b.y.x * 12 + b.z.x * 28,
      target.position.y + b.x.y * 18 + b.y.y * 12 + b.z.y * 28,
      target.position.z + b.x.z * 18 + b.y.z * 12 + b.z.z * 28,
    );
    const nose = b.nose();
    this.freeYaw = Math.atan2(-nose.x, -nose.z);
    this.freePitch = -0.2;
    this.freeReady = true;
    this.mode = Cam.FREE;
    this.inspectActive = false;
  }

  /** Entra/sai do modo inspeção (segurar Q). Seed a partir da câmera atual. */
  setInspect(active: boolean, target?: CamTarget): void {
    if (active && !this.inspectActive && target) {
      const p = target.position;
      const dx = this.camera.position.x - p.x;
      const dy = this.camera.position.y - p.y;
      const dz = this.camera.position.z - p.z;
      const dist = Math.hypot(dx, dy, dz);
      this.inspectDist = Math.min(
        this.inspectDistMax,
        Math.max(this.inspectDistMin, dist || 15),
      );
      this.inspectYaw = Math.atan2(dx, dz);
      this.inspectPitch = Math.asin(
        Math.min(0.92, Math.max(-0.15, dy / Math.max(1e-3, this.inspectDist))),
      );
    }
    this.inspectActive = active;
  }

  get isInspecting(): boolean {
    return this.inspectActive;
  }

  update(
    dt: number,
    view: Cam,
    target: CamTarget,
    freeWish?: { x: number; y: number; z: number; boost: boolean },
    mouse?: { dx: number; dy: number; wheel: number },
  ): void {
    const tel = target.telemetry;
    if (tel.afterburner && !this.abWas) this.fovPunch = Math.max(this.fovPunch, 7);
    this.abWas = tel.afterburner;
    const abHold = tel.afterburner ? 4.5 : 0;
    // speedNorm 0..1 — punch grows only in the upper speed band
    const speedFov = Math.min(5, Math.max(0, (tel.speedNorm - 0.55) * 9));
    this.fovPunch +=
      (abHold + speedFov - this.fovPunch) * (1 - Math.exp(-3.5 * dt));

    if (this.inspectActive && view !== Cam.FREE) {
      this.applyInspect(dt, target, mouse);
      return;
    }

    if (view === Cam.FREE && this.freeReady) {
      if (mouse) {
        this.freeYaw -= mouse.dx * 0.0025;
        this.freePitch -= mouse.dy * 0.0022;
        this.freePitch = Math.min(1.35, Math.max(-1.35, this.freePitch));
        if (mouse.wheel) {
          this.freeCamSpeed = Math.min(
            900,
            Math.max(20, this.freeCamSpeed * (mouse.wheel > 0 ? 1.15 : 1 / 1.15)),
          );
        }
      }
      if (freeWish) {
        const boost = freeWish.boost ? 2.6 : 1;
        const cy = Math.cos(this.freeYaw);
        const sy = Math.sin(this.freeYaw);
        const cp = Math.cos(this.freePitch);
        const sp = Math.sin(this.freePitch);
        // -Z forward in yaw/pitch
        const fx = -sy * cp;
        const fy = sp;
        const fz = -cy * cp;
        const rx = cy;
        const rz = -sy;
        this.freePos.x +=
          (fx * freeWish.z + rx * freeWish.x) * this.freeCamSpeed * boost * dt;
        this.freePos.y +=
          (fy * freeWish.z + freeWish.y) * this.freeCamSpeed * boost * dt;
        this.freePos.z +=
          (fz * freeWish.z + rz * freeWish.x) * this.freeCamSpeed * boost * dt;
        this.freePos.y = Math.min(12000, Math.max(8, this.freePos.y));
      }
      this.camera.position.copy(this.freePos);
      _look.set(
        this.freePos.x - Math.sin(this.freeYaw) * Math.cos(this.freePitch),
        this.freePos.y + Math.sin(this.freePitch),
        this.freePos.z - Math.cos(this.freeYaw) * Math.cos(this.freePitch),
      );
      this.camera.up.set(0, 1, 0);
      this.camera.lookAt(_look);
      this.camera.fov = 58 + this.fovPunch;
      this.camera.updateProjectionMatrix();
      return;
    }

    this.applyPose(view, target, dt);
    this.applySpeedShake(dt, tel);
  }

  private applyInspect(
    dt: number,
    target: CamTarget,
    mouse?: { dx: number; dy: number; wheel: number },
  ): void {
    if (mouse) {
      this.inspectYaw -= mouse.dx * 0.0042;
      this.inspectPitch += mouse.dy * 0.0034;
      this.inspectPitch = Math.min(1.15, Math.max(-0.12, this.inspectPitch));
      if (mouse.wheel) {
        const factor = mouse.wheel > 0 ? 1 / 1.12 : 1.12;
        this.inspectDist = Math.min(
          this.inspectDistMax,
          Math.max(this.inspectDistMin, this.inspectDist * factor),
        );
      }
    }

    const p = target.position;
    const cy = Math.cos(this.inspectYaw);
    const sy = Math.sin(this.inspectYaw);
    const cp = Math.cos(this.inspectPitch);
    const sp = Math.sin(this.inspectPitch);
    const dist = this.inspectDist;
    _pos.set(
      p.x + sy * cp * dist,
      p.y + sp * dist + 1.1,
      p.z + cy * cp * dist,
    );
    // Suaviza um pouco para não tremer com o movimento do jato.
    this.chasePivot.lerp(_pos, 1 - Math.exp(-14 * dt));
    _look.set(p.x, p.y + 0.6, p.z);
    this.lookAhead.lerp(_look, 1 - Math.exp(-16 * dt));
    this.camera.position.copy(this.chasePivot);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(this.lookAhead);
    this.camera.fov = 48 + this.fovPunch * 0.35;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Subtle buffet when TAS is near the airframe peak (AB / Vne band).
   * Amplitude stays small — noticeable, not nauseating.
   */
  private applySpeedShake(dt: number, tel: JetTelemetry): void {
    const n = tel.speedNorm;
    if (n < 0.9) {
      this.shakePhase *= Math.max(0, 1 - 4 * dt);
      return;
    }
    const t = Math.min(1, (n - 0.9) / 0.1);
    const amp = 0.028 + t * 0.055;
    this.shakePhase += dt * (26 + t * 28);
    const p = this.shakePhase;
    this.camera.position.x += Math.sin(p * 1.73) * amp;
    this.camera.position.y += Math.cos(p * 2.11) * amp * 0.72;
    this.camera.position.z += Math.sin(p * 1.31 + 0.9) * amp * 0.55;
  }

  private applyPose(view: Cam, target: CamTarget, dt: number): void {
    const b = target.basis;
    const p = target.position;
    const tel = target.telemetry;

    if (view !== Cam.COCKPIT) this.camera.near = 0.2;

    switch (view) {
      case Cam.REAR: {
        const local = _tmp.set(0, 2.8, -10.5);
        _pos.set(
          p.x + b.x.x * local.x + b.y.x * local.y + b.z.x * local.z,
          p.y + b.x.y * local.x + b.y.y * local.y + b.z.y * local.z,
          p.z + b.x.z * local.x + b.y.z * local.y + b.z.z * local.z,
        );
        const lookLocal = _tmp.set(0, 1.2, 28);
        _look.set(
          p.x + b.x.x * lookLocal.x + b.y.x * lookLocal.y + b.z.x * lookLocal.z,
          p.y + b.x.y * lookLocal.x + b.y.y * lookLocal.y + b.z.y * lookLocal.z,
          p.z + b.x.z * lookLocal.x + b.y.z * lookLocal.y + b.z.z * lookLocal.z,
        );
        _up.set(b.y.x, b.y.y, b.y.z).lerp(new Vector3(0, 1, 0), 0.25).normalize();
        this.camera.position.copy(_pos);
        this.camera.up.copy(_up);
        this.camera.lookAt(_look);
        this.camera.fov = 64 + this.fovPunch;
        break;
      }
      case Cam.COCKPIT: {
        // Seat under the canopy (nose = −Z): slightly forward of center, raised.
        // G-load dips the eye a touch; look clears the coaming into the glass.
        const gDip = Math.min(0.4, Math.max(-0.25, 1 - tel.gForce)) * 0.12;
        const local = _tmp.set(0, 0.92 + gDip, -0.55);
        _pos.set(
          p.x + b.x.x * local.x + b.y.x * local.y + b.z.x * local.z,
          p.y + b.x.y * local.x + b.y.y * local.y + b.z.y * local.z,
          p.z + b.x.z * local.x + b.y.z * local.y + b.z.z * local.z,
        );
        const lookLocal = _tmp.set(0, 0.48, -14);
        _look.set(
          p.x + b.x.x * lookLocal.x + b.y.x * lookLocal.y + b.z.x * lookLocal.z,
          p.y + b.x.y * lookLocal.x + b.y.y * lookLocal.y + b.z.y * lookLocal.z,
          p.z + b.x.z * lookLocal.x + b.y.z * lookLocal.y + b.z.z * lookLocal.z,
        );
        this.camera.near = 0.08;
        this.camera.position.copy(_pos);
        this.camera.up.set(b.y.x, b.y.y, b.y.z).normalize();
        this.camera.lookAt(_look);
        this.camera.fov = 62 + this.fovPunch * 0.55;
        break;
      }
      case Cam.CHASE:
      default: {
        // Chase rig: legacy ×0.7×0.7×0.8×1.3×1.3×1.2 (~81% of original distance).
        const abPull = tel.afterburner ? 4.76 : 0;
        const gPull = Math.min(3, Math.max(0, tel.gForce - 1)) * 1.432;
        const back = 15.9 + abPull + gPull;
        const up = 4.38 + gPull * 0.35;
        const side = -tel.rollDeg * 0.04 + tel.turnRate * 2.5;
        _pos.set(
          p.x + b.z.x * back + b.y.x * up + b.x.x * side,
          p.y + b.z.y * back + b.y.y * up + b.x.y * side,
          p.z + b.z.z * back + b.y.z * up + b.x.z * side,
        );
        // Follow rate scales with TAS so the chase rig stays on the
        // authored offset (legacy fixed 5.5 lagged ~50m at fighter speeds).
        const speedMs = Math.max(0, tel.airspeed / 1.85);
        const follow = Math.max(18, 12 + speedMs * 0.14);
        this.chasePivot.lerp(_pos, 1 - Math.exp(-follow * dt));
        const ahead = 11.35 + (tel.afterburner ? 6.29 : 0);
        _look.set(
          p.x + -b.z.x * ahead + b.y.x * 2.44,
          p.y + -b.z.y * ahead + b.y.y * 2.44,
          p.z + -b.z.z * ahead + b.y.z * 2.44,
        );
        this.lookAhead.lerp(_look, 1 - Math.exp(-(follow + 4) * dt));
        _up.set(b.y.x, b.y.y, b.y.z).lerp(new Vector3(0, 1, 0), 0.35).normalize();
        this.camera.position.copy(this.chasePivot);
        this.camera.up.copy(_up);
        this.camera.lookAt(this.lookAhead);
        this.camera.fov = 58 + this.fovPunch;
        break;
      }
    }
    this.camera.updateProjectionMatrix();
  }
}
