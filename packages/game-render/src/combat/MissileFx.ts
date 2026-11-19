import { Group, Mesh, MeshBasicMaterial, SphereGeometry, Color } from "three";
import { TrailPool } from "../trails/TrailPool";

export class MissileFx {
  readonly group = new Group();
  private meshes: Mesh[] = [];
  private trails: TrailPool;
  private trailIds: number[] = [];
  private booms: Array<{ mesh: Mesh; life: number }> = [];
  private boomMat = new MeshBasicMaterial({
    color: new Color(0xff8c2a),
    transparent: true,
    opacity: 0.9,
  });

  constructor(poolSize = 12) {
    this.trails = new TrailPool(poolSize, 32, 0xffcc66, 0.8);
    this.group.add(this.trails.group);
    const geo = new SphereGeometry(0.35, 6, 4);
    const mat = new MeshBasicMaterial({ color: 0xffe0a0 });
    for (let i = 0; i < poolSize; i++) {
      const m = new Mesh(geo, mat);
      m.visible = false;
      this.group.add(m);
      this.meshes.push(m);
      this.trailIds.push(-1);
    }
  }

  sync(
    missiles: Array<{
      active: boolean;
      x: number;
      y: number;
      z: number;
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
    this.trails.dispose();
    for (const m of this.meshes) {
      m.geometry.dispose();
      (m.material as MeshBasicMaterial).dispose();
    }
    this.boomMat.dispose();
  }
}
