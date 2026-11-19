import {
  BufferGeometry,
  DynamicDrawUsage,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  Vector3,
} from "three";

interface Trail {
  line: Line;
  points: Vector3[];
  head: number;
  filled: boolean;
  active: boolean;
}

/** Ring-buffer line trails for AB plume / contrail. */
export class TrailPool {
  readonly group = new Group();
  private trails: Trail[] = [];

  constructor(
    private capacity: number,
    private segments: number,
    color: number,
    opacity: number,
  ) {
    const mat = new LineBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
    });
    for (let i = 0; i < capacity; i++) {
      const positions = new Float32Array(segments * 3);
      const geo = new BufferGeometry();
      const attr = new Float32BufferAttribute(positions, 3);
      attr.setUsage(DynamicDrawUsage);
      geo.setAttribute("position", attr);
      geo.setDrawRange(0, 0);
      const line = new Line(geo, mat.clone());
      line.frustumCulled = false;
      line.visible = false;
      this.group.add(line);
      this.trails.push({
        line,
        points: Array.from({ length: segments }, () => new Vector3()),
        head: 0,
        filled: false,
        active: false,
      });
    }
  }

  acquire(): number {
    const idx = this.trails.findIndex((t) => !t.active);
    if (idx < 0) return -1;
    const t = this.trails[idx]!;
    t.active = true;
    t.head = 0;
    t.filled = false;
    t.line.visible = true;
    t.line.geometry.setDrawRange(0, 0);
    return idx;
  }

  release(idx: number): void {
    const t = this.trails[idx];
    if (!t) return;
    t.active = false;
    t.line.visible = false;
  }

  push(idx: number, x: number, y: number, z: number): void {
    const t = this.trails[idx];
    if (!t?.active) return;
    t.points[t.head]!.set(x, y, z);
    t.head = (t.head + 1) % this.segments;
    if (t.head === 0) t.filled = true;

    const attr = t.line.geometry.getAttribute("position") as Float32BufferAttribute;
    const count = t.filled ? this.segments : t.head;
    for (let i = 0; i < count; i++) {
      const src =
        t.points[(t.head - count + i + this.segments * 2) % this.segments]!;
      attr.setXYZ(i, src.x, src.y, src.z);
    }
    attr.needsUpdate = true;
    t.line.geometry.setDrawRange(0, count);
    t.line.geometry.computeBoundingSphere();
  }

  dispose(): void {
    for (const t of this.trails) {
      t.line.geometry.dispose();
      (t.line.material as LineBasicMaterial).dispose();
    }
  }
}
