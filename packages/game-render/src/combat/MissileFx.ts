import {
  Group,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  SphereGeometry,
  Color,
  Vector3,
} from "three";
import { TrailPool } from "../trails/TrailPool";
import { createWeaponInstance } from "./WeaponModel";

const _dir = new Vector3();
const _look = new Vector3();

export class MissileFx {
  readonly group = new Group();
  private meshes: Object3D[] = [];
  private trails: TrailPool;
  private trailIds: number[] = [];
  private booms: Array<{ mesh: Mesh; life: number }> = [];
  private boomMat = new MeshBasicMaterial({
    color: new Color(0xff8c2a),
    transparent: true,
    opacity: 0.9,
  });
  private fallbackGeo = new SphereGeometry(0.35, 6, 4);
  private fallbackMat = new MeshBasicMaterial({ color: 0xffe0a0 });
  private poolSize: number;
  private modelUrl: string | null = null;
  private loadGen = 0;

  constructor(poolSize = 12) {
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
        // Nariz do modelo = −Z → olhar para a frente do vetor de velocidade.
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

  boom(x: number, y: number, z: number): void {
    const mesh = new Mesh(new SphereGeometry(1, 8, 6), this.boomMat.clone());
    mesh.position.set(x, y, z);
    this.group.add(mesh);
    this.booms.push({ mesh, life: 0.45 });
  }

  tick(dt: number): void {
    for (let i = this.booms.length - 1; i >= 0; i--) {
      const b = this.booms[i]!;
      b.life -= dt;
      const t = Math.max(0, b.life / 0.45);
      b.mesh.scale.setScalar(2 + (1 - t) * 10);
      (b.mesh.material as MeshBasicMaterial).opacity = t;
      if (b.life <= 0) {
        this.group.remove(b.mesh);
        b.mesh.geometry.dispose();
        (b.mesh.material as MeshBasicMaterial).dispose();
        this.booms.splice(i, 1);
      }
    }
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
    this.boomMat.dispose();
  }

  private disposeObject(root: Object3D): void {
    root.traverse((obj) => {
      if (!(obj instanceof Mesh)) return;
      if (obj.geometry !== this.fallbackGeo) obj.geometry.dispose();
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const mat of mats) {
        if (mat && mat !== this.fallbackMat && mat !== this.boomMat) {
          mat.dispose();
        }
      }
    });
  }
}
