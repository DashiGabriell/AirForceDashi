import { signedAngle, Vec3 } from "./vec3";

/**
 * Godot-style basis: columns are local X (right), Y (up), Z (back).
 * Nose / forward = -Z.
 */
export class Basis {
  x = new Vec3(1, 0, 0);
  y = new Vec3(0, 1, 0);
  z = new Vec3(0, 0, 1);

  clone(): Basis {
    const b = new Basis();
    b.x.copy(this.x);
    b.y.copy(this.y);
    b.z.copy(this.z);
    return b;
  }

  copy(o: Basis): this {
    this.x.copy(o.x);
    this.y.copy(o.y);
    this.z.copy(o.z);
    return this;
  }

  /**
   * Godot `Basis.from_euler(Vector3(pitch, yaw, roll), YXZ)`.
   * Composition: Ry(yaw) * Rx(pitch) * Rz(roll).
   */
  static fromEuler(pitch: number, yaw: number, roll: number): Basis {
    let b = new Basis();
    b = b.rotated(new Vec3(0, 0, 1), roll);
    b = b.rotated(new Vec3(1, 0, 0), pitch);
    b = b.rotated(new Vec3(0, 1, 0), yaw);
    return b.orthonormalize();
  }

  orthonormalize(): this {
    this.x.normalize();
    const xy = this.x.dot(this.y);
    this.y.x -= this.x.x * xy;
    this.y.y -= this.x.y * xy;
    this.y.z -= this.x.z * xy;
    this.y.normalize();
    this.z = this.x.cross(this.y).normalize();
    return this;
  }

  rotated(axis: Vec3, angle: number): Basis {
    const n = axis.normalized();
    const out = this.clone();
    out.x.rotateAround(n, angle);
    out.y.rotateAround(n, angle);
    out.z.rotateAround(n, angle);
    return out.orthonormalize();
  }

  xform(v: Vec3): Vec3 {
    return new Vec3(
      this.x.x * v.x + this.y.x * v.y + this.z.x * v.z,
      this.x.y * v.x + this.y.y * v.y + this.z.y * v.z,
      this.x.z * v.x + this.y.z * v.y + this.z.z * v.z,
    );
  }

  nose(): Vec3 {
    return new Vec3(-this.z.x, -this.z.y, -this.z.z);
  }

  getEuler(): { pitch: number; yaw: number; roll: number } {
    const nose = this.nose();
    const pitch = Math.asin(Math.min(1, Math.max(-1, nose.y)));
    const yaw = Math.atan2(-nose.x, -nose.z);
    const flatRight = nose.cross(Vec3.UP);
    let roll = 0;
    if (flatRight.lengthSq() > 1e-8) {
      flatRight.normalize();
      roll = signedAngle(flatRight, this.x, nose);
    }
    return { pitch, yaw, roll };
  }

  isFinite(): boolean {
    return this.x.isFinite() && this.y.isFinite() && this.z.isFinite();
  }
}
