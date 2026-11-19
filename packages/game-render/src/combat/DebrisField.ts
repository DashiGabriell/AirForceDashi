import {
  BoxGeometry,
  Color,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  MeshLambertMaterial,
  Object3D,
} from "three";

const MAX = 96;
const LIFE = 2.4;

interface DebrisSlot {
  active: boolean;
  life: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  s: number;
}

/** Instanced debris cubes — pooled, despawn after LIFE. */
export class DebrisField {
  readonly group = new Group();
  private readonly mesh: InstancedMesh;
  private readonly mat: MeshLambertMaterial;
  private readonly slots: DebrisSlot[] = [];
  private readonly dummy = new Object3D();

  constructor() {
    this.mat = new MeshLambertMaterial({ color: new Color(0x6a6e74) });
    this.mesh = new InstancedMesh(new BoxGeometry(1, 1, 1), this.mat, MAX);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.count = MAX;
    this.mesh.frustumCulled = false;
    this.group.add(this.mesh);
    for (let i = 0; i < MAX; i++) {
      this.slots.push({
        active: false,
        life: 0,
        x: 0,
        y: -9999,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        s: 1,
      });
      this.write(i);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  burst(x: number, y: number, z: number, count = 14): void {
    let spawned = 0;
    for (const s of this.slots) {
      if (s.active) continue;
      s.active = true;
      s.life = LIFE * (0.7 + Math.random() * 0.4);
      s.x = x + (Math.random() - 0.5) * 8;
      s.y = y + Math.random() * 6;
      s.z = z + (Math.random() - 0.5) * 8;
      s.vx = (Math.random() - 0.5) * 40;
      s.vy = 18 + Math.random() * 36;
      s.vz = (Math.random() - 0.5) * 40;
      s.s = 1.2 + Math.random() * 2.4;
      spawned += 1;
      if (spawned >= count) break;
    }
  }

  tick(dt: number): void {
    let dirty = false;
    for (let i = 0; i < this.slots.length; i++) {
      const s = this.slots[i]!;
      if (!s.active) continue;
      s.life -= dt;
      s.vy -= 55 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.z += s.vz * dt;
      if (s.life <= 0 || s.y < -50) {
        s.active = false;
        s.y = -9999;
      }
      this.write(i);
      dirty = true;
    }
    if (dirty) this.mesh.instanceMatrix.needsUpdate = true;
  }

  private write(i: number): void {
    const s = this.slots[i]!;
    this.dummy.position.set(s.x, s.y, s.z);
    this.dummy.scale.set(s.s, s.s, s.s);
    this.dummy.rotation.set(s.life, s.life * 1.3, s.life * 0.7);
    this.dummy.updateMatrix();
    this.mesh.setMatrixAt(i, this.dummy.matrix);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}
