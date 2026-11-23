import {
  BufferGeometry,
  Color,
  Group,
  LineBasicMaterial,
  LineLoop,
  Vector3,
} from "three";

export interface NavWaypoint {
  x: number;
  z: number;
}

/** Show the ground ring when the jet is within this horizontal range (m). */
export const NAV_NEAR_M = 1600;

const RING_R = 28;
const RING_R2 = 42;
const SEG = 64;
const GREEN = new Color(0x3dff6a);

function makeRing(radius: number): LineLoop {
  const pts: Vector3[] = [];
  for (let i = 0; i <= SEG; i++) {
    const a = (i / SEG) * Math.PI * 2;
    pts.push(new Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
  }
  const geo = new BufferGeometry().setFromPoints(pts);
  const mat = new LineBasicMaterial({
    color: GREEN,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });
  const loop = new LineLoop(geo, mat);
  loop.frustumCulled = false;
  return loop;
}

/**
 * Spinning green ground marker at a pause-map nav pin.
 * Visible only when the jet is nearby.
 */
export class NavBeacon {
  readonly group = new Group();
  private readonly inner = makeRing(RING_R);
  private readonly outer = makeRing(RING_R2);
  private target: NavWaypoint | null = null;
  private spin = 0;

  constructor() {
    this.group.add(this.inner);
    this.group.add(this.outer);
    this.group.visible = false;
  }

  setTarget(wp: NavWaypoint | null): void {
    this.target = wp;
    if (!wp) this.group.visible = false;
  }

  update(
    dt: number,
    jetX: number,
    jetZ: number,
    heightAt: (x: number, z: number) => number,
  ): void {
    const t = this.target;
    if (!t) {
      this.group.visible = false;
      return;
    }
    const dist = Math.hypot(jetX - t.x, jetZ - t.z);
    if (dist > NAV_NEAR_M) {
      this.group.visible = false;
      return;
    }
    this.group.visible = true;
    const y = heightAt(t.x, t.z) + 1.2;
    this.group.position.set(t.x, y, t.z);
    this.spin += dt;
    this.inner.rotation.y = this.spin * 1.35;
    this.outer.rotation.y = -this.spin * 0.85;
    const fade = Math.min(1, (NAV_NEAR_M - dist) / 400);
    const matIn = this.inner.material as LineBasicMaterial;
    const matOut = this.outer.material as LineBasicMaterial;
    matIn.opacity = 0.55 + 0.4 * fade;
    matOut.opacity = 0.35 + 0.35 * fade;
  }

  dispose(): void {
    this.inner.geometry.dispose();
    (this.inner.material as LineBasicMaterial).dispose();
    this.outer.geometry.dispose();
    (this.outer.material as LineBasicMaterial).dispose();
  }
}
