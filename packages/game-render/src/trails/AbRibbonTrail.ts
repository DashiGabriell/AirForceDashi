import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  DynamicDrawUsage,
  Group,
  Mesh,
  MeshBasicMaterial,
  Vector3,
} from "three";

interface Ribbon {
  mesh: Mesh;
  points: Vector3[];
  head: number;
  filled: boolean;
  active: boolean;
}

const _side = new Vector3();
const _prev = new Vector3();
const _up = new Vector3(0, 1, 0);

/**
 * Soft additive ribbon wake for afterburner — replaces 1px Line trails.
 */
export class AbRibbonTrail {
  readonly group = new Group();
  private ribbons: Ribbon[] = [];
  private readonly halfWidth: number;

  constructor(
    capacity: number,
    private segments: number,
    color: number,
    opacity: number,
    halfWidth = 0.22,
  ) {
    this.halfWidth = halfWidth;
    const mat = new MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
    });
    for (let i = 0; i < capacity; i++) {
      const geo = new BufferGeometry();
      const vertCount = segments * 2;
      const positions = new Float32Array(vertCount * 3);
      const colors = new Float32Array(vertCount * 4);
      const indices = new Uint16Array(Math.max(0, segments - 1) * 6);
      let ii = 0;
      for (let s = 0; s < segments - 1; s++) {
        const a = s * 2;
        indices[ii++] = a;
        indices[ii++] = a + 1;
        indices[ii++] = a + 2;
        indices[ii++] = a + 1;
        indices[ii++] = a + 3;
        indices[ii++] = a + 2;
      }
      const posAttr = new BufferAttribute(positions, 3);
      posAttr.setUsage(DynamicDrawUsage);
      const colAttr = new BufferAttribute(colors, 4);
      colAttr.setUsage(DynamicDrawUsage);
      geo.setAttribute("position", posAttr);
      geo.setAttribute("color", colAttr);
      geo.setIndex(new BufferAttribute(indices, 1));
      geo.setDrawRange(0, 0);

      const meshMat = mat.clone();
      meshMat.vertexColors = true;
      const mesh = new Mesh(geo, meshMat);
      mesh.frustumCulled = false;
      mesh.visible = false;
      mesh.renderOrder = 2;
      this.group.add(mesh);
      this.ribbons.push({
        mesh,
        points: Array.from({ length: segments }, () => new Vector3()),
        head: 0,
        filled: false,
        active: false,
      });
    }
    mat.dispose();
  }

  acquire(): number {
    const idx = this.ribbons.findIndex((r) => !r.active);
    if (idx < 0) return -1;
    const r = this.ribbons[idx]!;
    r.active = true;
    r.head = 0;
    r.filled = false;
    r.mesh.visible = true;
    r.mesh.geometry.setDrawRange(0, 0);
    return idx;
  }

  release(idx: number): void {
    const r = this.ribbons[idx];
    if (!r) return;
    r.active = false;
    r.mesh.visible = false;
  }

  push(idx: number, x: number, y: number, z: number): void {
    const r = this.ribbons[idx];
    if (!r?.active) return;
    r.points[r.head]!.set(x, y, z);
    r.head = (r.head + 1) % this.segments;
    if (r.head === 0) r.filled = true;
    this.rebuild(r);
  }

  private rebuild(r: Ribbon): void {
    const count = r.filled ? this.segments : r.head;
    if (count < 2) {
      r.mesh.geometry.setDrawRange(0, 0);
      return;
    }
    const pos = r.mesh.geometry.getAttribute("position") as BufferAttribute;
    const col = r.mesh.geometry.getAttribute("color") as BufferAttribute;
    const hw = this.halfWidth;

    for (let i = 0; i < count; i++) {
      const src =
        r.points[(r.head - count + i + this.segments * 2) % this.segments]!;
      const nextIdx = Math.min(i + 1, count - 1);
      const nxt =
        r.points[
          (r.head - count + nextIdx + this.segments * 2) % this.segments
        ]!;
      if (i === count - 1 && i > 0) {
        const prev =
          r.points[
            (r.head - count + (i - 1) + this.segments * 2) % this.segments
          ]!;
        _prev.subVectors(src, prev);
      } else {
        _prev.subVectors(nxt, src);
      }
      if (_prev.lengthSq() < 1e-8) _prev.set(0, 0, 1);
      _prev.normalize();
      _side.crossVectors(_up, _prev);
      if (_side.lengthSq() < 1e-8) _side.set(1, 0, 0);
      else _side.normalize();

      const age = i / Math.max(count - 1, 1);
      const taper = (1 - age) * (0.55 + 0.45 * (1 - age));
      const w = hw * taper;
      const a = (1 - age) * (1 - age) * 0.95;

      const vi = i * 2;
      pos.setXYZ(vi, src.x - _side.x * w, src.y - _side.y * w, src.z - _side.z * w);
      pos.setXYZ(
        vi + 1,
        src.x + _side.x * w,
        src.y + _side.y * w,
        src.z + _side.z * w,
      );
      col.setXYZW(vi, 1, 0.75, 0.35, a);
      col.setXYZW(vi + 1, 1, 0.55, 0.2, a * 0.85);
    }
    // Clear unused verts so stale geometry doesn't flash.
    for (let i = count; i < this.segments; i++) {
      const vi = i * 2;
      pos.setXYZ(vi, 0, 0, 0);
      pos.setXYZ(vi + 1, 0, 0, 0);
      col.setXYZW(vi, 0, 0, 0, 0);
      col.setXYZW(vi + 1, 0, 0, 0, 0);
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
    r.mesh.geometry.setDrawRange(0, Math.max(0, count - 1) * 6);
    r.mesh.geometry.computeBoundingSphere();
  }

  dispose(): void {
    for (const r of this.ribbons) {
      r.mesh.geometry.dispose();
      (r.mesh.material as MeshBasicMaterial).dispose();
    }
  }
}
