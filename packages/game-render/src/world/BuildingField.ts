import {
  buildingToAabb,
  gatherBuildings,
  type BuildingAabb,
  type BuildingInstance,
} from "@afd/game-core";
import {
  BoxGeometry,
  Color,
  DynamicDrawUsage,
  InstancedMesh,
  Matrix4,
  MeshLambertMaterial,
  Object3D,
  Quaternion,
  Vector3,
} from "three";
import { applyBuildingFacade } from "./radialHorizon";

const MAX = 430;

const KIND_COLOR: Record<BuildingInstance["kind"], Color> = {
  city: new Color(0x7a828c),
  suburb: new Color(0x8a9080),
  farm: new Color(0x8a7a68),
};

export class BuildingField {
  readonly mesh: InstancedMesh;
  private lastSnap = { x: Infinity, y: Infinity };
  private readonly dummy = new Object3D();
  private readonly mat = new MeshLambertMaterial({
    color: new Color(0x8a9098),
    vertexColors: false,
  });
  private readonly dayFactor = { value: 1 };
  private hazeBound = false;
  /** Last applied instances (for hit query + promote hide). */
  private instances: BuildingInstance[] = [];
  private aabbs: BuildingAabb[] = [];
  private readonly hidden = new Set<string>();
  private readonly indexById = new Map<string, number>();

  bindSky(haze: Color): void {
    if (this.hazeBound) return;
    this.hazeBound = true;
    applyBuildingFacade(this.mat, haze, this.dayFactor);
  }

  constructor() {
    this.mesh = new InstancedMesh(new BoxGeometry(1, 1, 1), this.mat, MAX);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
  }

  setDayFactor(day: number): void {
    this.dayFactor.value = day;
  }

  update(wx: number, wz: number, force = false): void {
    const sx = Math.round(wx / 140) * 140;
    const sz = Math.round(wz / 140) * 140;
    if (
      !force &&
      Math.hypot(sx - this.lastSnap.x, sz - this.lastSnap.y) < 140 * 0.55
    ) {
      return;
    }
    this.lastSnap = { x: sx, y: sz };
    const list = gatherBuildings(wx, wz);
    this.apply(list);
  }

  /** Background city AABBs excluding hidden (promoted) buildings. */
  getCollisionAabbs(): BuildingAabb[] {
    return this.aabbs.filter((a) => !this.hidden.has(a.id));
  }

  hideBuilding(id: string): void {
    this.hidden.add(id);
    const idx = this.indexById.get(id);
    if (idx == null) return;
    this.writeMatrix(idx, 0, -9999, 0, 0.001, 0.001, 0.001, 0);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  getInstance(id: string): BuildingInstance | null {
    return this.instances.find((b) => b.id === id) ?? null;
  }

  private apply(list: BuildingInstance[]): void {
    const n = Math.min(list.length, MAX);
    this.instances = list.slice(0, n);
    this.aabbs = this.instances.map(buildingToAabb);
    this.indexById.clear();
    const q = new Quaternion();
    const s = new Vector3();
    const p = new Vector3();
    const m = new Matrix4();
    for (let i = 0; i < n; i++) {
      const b = this.instances[i]!;
      this.indexById.set(b.id, i);
      if (this.hidden.has(b.id)) {
        this.writeMatrix(i, 0, -9999, 0, 0.001, 0.001, 0.001, 0);
        this.mesh.setColorAt(i, KIND_COLOR[b.kind]);
        continue;
      }
      p.set(b.x, b.y + b.h * 0.5, b.z);
      q.setFromAxisAngle(new Vector3(0, 1, 0), b.yaw);
      s.set(b.w, b.h, b.d);
      m.compose(p, q, s);
      this.mesh.setMatrixAt(i, m);
      this.mesh.setColorAt(i, KIND_COLOR[b.kind]);
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  private writeMatrix(
    i: number,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    yaw: number,
  ): void {
    this.dummy.position.set(x, y, z);
    this.dummy.scale.set(sx, sy, sz);
    this.dummy.rotation.set(0, yaw, 0);
    this.dummy.updateMatrix();
    this.mesh.setMatrixAt(i, this.dummy.matrix);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}
