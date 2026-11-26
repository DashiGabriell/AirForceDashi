import { AIRBASE, CONTROL_TOWER } from "@afd/game-core";
import {
  Box3,
  DoubleSide,
  Material,
  Mesh,
  Object3D,
  Raycaster,
  Vector3,
} from "three";

export interface SurfaceHit {
  x: number;
  y: number;
  z: number;
  nx: number;
  ny: number;
  nz: number;
  dist: number;
}

const AFB_REACH = 2800;
const TOWER_REACH = 520;

/**
 * Triangle hits on the authored airbase and control tower.
 * Pavement, paint and rivets are left out so the jet meets walls, vaults and tanks.
 */
export class ConstructionHit {
  private readonly ray = new Raycaster();
  private readonly origin = new Vector3();
  private readonly dir = new Vector3();
  private readonly box = new Box3();
  private readonly size = new Vector3();
  private readonly normal = new Vector3();
  private readonly meshes: Mesh[] = [];
  private ready = false;

  constructor(private readonly roots: Object3D[]) {}

  private collect(): void {
    if (this.ready) return;
    this.ready = true;
    for (const root of this.roots) {
      root.updateMatrixWorld(true);
      root.traverse((obj) => {
        const mesh = obj as Mesh;
        if (!mesh.isMesh || !mesh.geometry) return;
        if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
        const local = mesh.geometry.boundingBox;
        if (!local) return;
        this.box.copy(local).applyMatrix4(mesh.matrixWorld);
        this.box.getSize(this.size);
        const maxDim = Math.max(this.size.x, this.size.y, this.size.z);
        if (this.size.y < 1 || maxDim < 1.2) return;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mat of mats) {
          if (mat && "side" in mat) (mat as Material).side = DoubleSide;
        }
        this.meshes.push(mesh);
      });
    }
  }

  private nearby(x: number, z: number): boolean {
    const dx = x - AIRBASE.x;
    const dz = z - AIRBASE.z;
    if (dx * dx + dz * dz < AFB_REACH * AFB_REACH) return true;
    const tx = x - CONTROL_TOWER.x;
    const tz = z - CONTROL_TOWER.z;
    return tx * tx + tz * tz < TOWER_REACH * TOWER_REACH;
  }

  /** Closest triangle between two world points, or null when the segment misses. */
  segment(
    ax: number,
    ay: number,
    az: number,
    bx: number,
    by: number,
    bz: number,
  ): SurfaceHit | null {
    if (!this.nearby(ax, az) && !this.nearby(bx, bz)) return null;
    this.collect();
    if (this.meshes.length === 0) return null;
    this.dir.set(bx - ax, by - ay, bz - az);
    const len = this.dir.length();
    if (len < 1e-3) return null;
    this.dir.multiplyScalar(1 / len);
    this.origin.set(ax, ay, az);
    this.ray.set(this.origin, this.dir);
    this.ray.near = 0;
    this.ray.far = len;
    const hits = this.ray.intersectObjects(this.meshes, false);
    const hit = hits[0];
    if (!hit?.face) return null;
    this.normal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld);
    if (this.normal.lengthSq() < 1e-8) return null;
    this.normal.normalize();
    if (this.normal.dot(this.dir) > 0) this.normal.negate();
    return {
      x: hit.point.x,
      y: hit.point.y,
      z: hit.point.z,
      nx: this.normal.x,
      ny: this.normal.y,
      nz: this.normal.z,
      dist: hit.distance,
    };
  }
}
