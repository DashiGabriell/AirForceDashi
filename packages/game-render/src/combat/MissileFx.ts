import {
  Group,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  SphereGeometry,
  Vector3,
} from "three";
import type { QualityProfile } from "@afd/shared-types";
import { TrailPool } from "../trails/TrailPool";
import { BoomVfx, type BoomVfxStats } from "./BoomVfx";
import { createWeaponInstance } from "./WeaponModel";

const _dir = new Vector3();
const _look = new Vector3();

export class MissileFx {
  readonly group = new Group();
  private meshes: Object3D[] = [];
  private trails: TrailPool;
  private trailIds: number[] = [];
  private fallbackGeo = new SphereGeometry(0.35, 6, 4);
  private fallbackMat = new MeshBasicMaterial({ color: 0xffe0a0 });
  private poolSize: number;
  private modelUrl: string | null = null;
  private loadGen = 0;
  private booms: BoomVfx;

  constructor(poolSize = 12, quality: QualityProfile = "medium") {
    this.poolSize = poolSize;
    this.trails = new TrailPool(poolSize, 32, 0xffcc66, 0.8);
    this.group.add(this.trails.group);
    for (let i = 0; i < poolSize; i++) {
      const m = new Mesh(this.fallbackGeo, this.fallbackMat);
      m.visible = false;
      this.group.add(m);
      this.meshes.push(m);
      this.trailIds.push(-1);
    }
    this.booms = new BoomVfx(this.group, quality);
  }

  /** Origem da câmera para distância → variante lite / drop. */
  setViewOrigin(x: number, y: number, z: number): void {
    this.booms.setViewOrigin(x, y, z);
  }

  /** Troca o visual do míssil pelo GLB do armamento equipado (AA). */
  setModelUrl(url: string | null | undefined): void {
    const next = url?.trim() || null;
    if (next === this.modelUrl) return;
    this.modelUrl = next;
    const gen = ++this.loadGen;
    if (!next) {
      this.replaceMeshes(null);
      return;
    }
    void createWeaponInstance(next, 2.2)
      .then((proto) => {
        if (gen !== this.loadGen) {
          this.disposeObject(proto);
          return;
        }
        this.replaceMeshes(proto);
      })
      .catch(() => {
        if (gen === this.loadGen) this.replaceMeshes(null);
      });
  }

  private replaceMeshes(proto: Group | null): void {
    for (const m of this.meshes) {
      this.group.remove(m);
      this.disposeObject(m);
    }
    this.meshes = [];
    for (let i = 0; i < this.poolSize; i++) {
      let obj: Object3D;
      if (proto) {
        obj = proto.clone(true);
        obj.traverse((child) => {
          if (!(child instanceof Mesh)) return;
          child.geometry = child.geometry.clone();
          if (Array.isArray(child.material)) {
            child.material = child.material.map((mat) => mat.clone());
          } else if (child.material) {
            child.material = child.material.clone();
          }
        });
      } else {
        obj = new Mesh(this.fallbackGeo, this.fallbackMat);
      }
      obj.visible = false;
      this.group.add(obj);
      this.meshes.push(obj);
    }
    if (proto) this.disposeObject(proto);
  }

  sync(
    missiles: Array<{
      active: boolean;
      x: number;
      y: number;
      z: number;
      vx?: number;
      vy?: number;
      vz?: number;
    }>,
  ): void {
    for (let i = 0; i < this.meshes.length; i++) {
      const src = missiles[i];
      const mesh = this.meshes[i]!;
      if (!src?.active) {
        mesh.visible = false;
        if (this.trailIds[i]! >= 0) {
          this.trails.release(this.trailIds[i]!);
          this.trailIds[i] = -1;
        }
        continue;
      }
      mesh.visible = true;
      mesh.position.set(src.x, src.y, src.z);
      const vx = src.vx ?? 0;
      const vy = src.vy ?? 0;
      const vz = src.vz ?? -1;
      _dir.set(vx, vy, vz);
      if (_dir.lengthSq() > 1e-6) {
        _dir.normalize();
        _look.copy(mesh.position).add(_dir);
        mesh.lookAt(_look);
      }
      if (this.trailIds[i]! < 0) {
        this.trailIds[i] = this.trails.acquire();
      }
      if (this.trailIds[i]! >= 0) {
        this.trails.push(this.trailIds[i]!, src.x, src.y, src.z);
      }
    }
  }

  /**
   * Hot path: pool Quarks — sem TextureLoader / Geometry / Material.
   * Pool vazio ou acima do cap → drop silencioso.
   */
  boom(x: number, y: number, z: number): void {
    this.booms.boom(x, y, z);
  }

  tick(dt: number): void {
    this.booms.tick(dt);
  }

  stats(): BoomVfxStats {
    return this.booms.stats();
  }

  dispose(): void {
    this.loadGen += 1;
    this.trails.dispose();
    for (const m of this.meshes) {
      this.group.remove(m);
      this.disposeObject(m);
    }
    this.meshes = [];
    this.fallbackGeo.dispose();
    this.fallbackMat.dispose();
    this.booms.dispose();
  }

  private disposeObject(root: Object3D): void {
    root.traverse((obj) => {
      if (!(obj instanceof Mesh)) return;
      if (obj.geometry !== this.fallbackGeo) obj.geometry.dispose();
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const mat of mats) {
        if (mat && mat !== this.fallbackMat) mat.dispose();
      }
    });
  }
}
