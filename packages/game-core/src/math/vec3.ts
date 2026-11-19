/** Mutable Y-up vector — Godot/Three compatible. */

export class Vec3 {
  constructor(
    public x = 0,
    public y = 0,
    public z = 0,
  ) {}

  static readonly UP = Object.freeze(new Vec3(0, 1, 0)) as Vec3;

  set(x: number, y: number, z: number): this {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }

  copy(v: Vec3): this {
    this.x = v.x;
    this.y = v.y;
    this.z = v.z;
    return this;
  }

  clone(): Vec3 {
    return new Vec3(this.x, this.y, this.z);
  }

  add(v: Vec3): this {
    this.x += v.x;
    this.y += v.y;
    this.z += v.z;
    return this;
  }

  addScaled(v: Vec3, s: number): this {
    this.x += v.x * s;
    this.y += v.y * s;
    this.z += v.z * s;
    return this;
  }

  scale(s: number): this {
    this.x *= s;
    this.y *= s;
    this.z *= s;
    return this;
  }

  multiplyScalar(s: number): Vec3 {
    return new Vec3(this.x * s, this.y * s, this.z * s);
  }

  dot(v: Vec3): number {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }

  cross(v: Vec3): Vec3 {
    return new Vec3(
      this.y * v.z - this.z * v.y,
      this.z * v.x - this.x * v.z,
      this.x * v.y - this.y * v.x,
    );
  }

  length(): number {
    return Math.hypot(this.x, this.y, this.z);
  }

  lengthSq(): number {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }

  normalize(): this {
    const len = this.length();
    if (len > 1e-12) {
      this.x /= len;
      this.y /= len;
      this.z /= len;
    }
    return this;
  }

  normalized(): Vec3 {
    return this.clone().normalize();
  }

  lerp(to: Vec3, t: number): this {
    this.x += (to.x - this.x) * t;
    this.y += (to.y - this.y) * t;
    this.z += (to.z - this.z) * t;
    return this;
  }

  /** Rotate this vector around a unit axis by angle (rad). */
  rotateAround(axis: Vec3, angle: number): this {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const ax = axis.x;
    const ay = axis.y;
    const az = axis.z;
    const dot = this.dot(axis);
    const cx = ay * this.z - az * this.y;
    const cy = az * this.x - ax * this.z;
    const cz = ax * this.y - ay * this.x;
    this.x = this.x * c + cx * s + ax * dot * (1 - c);
    this.y = this.y * c + cy * s + ay * dot * (1 - c);
    this.z = this.z * c + cz * s + az * dot * (1 - c);
    return this;
  }

  isFinite(): boolean {
    return Number.isFinite(this.x) && Number.isFinite(this.y) && Number.isFinite(this.z);
  }
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function wrap(v: number, lo: number, hi: number): number {
  const range = hi - lo;
  if (range <= 0) return lo;
  let x = (v - lo) % range;
  if (x < 0) x += range;
  return x + lo;
}

export function wrapPi(v: number): number {
  return wrap(v, -Math.PI, Math.PI);
}

export function wrapTau(v: number): number {
  return wrap(v, 0, Math.PI * 2);
}

export function radToDeg(r: number): number {
  return (r * 180) / Math.PI;
}

export function signedAngle(from: Vec3, to: Vec3, axis: Vec3): number {
  const cross = from.cross(to);
  const sin = cross.dot(axis);
  const cos = from.dot(to);
  return Math.atan2(sin, cos);
}
