import type { DestructibleTarget } from "@afd/game-core";
import {
  BoxGeometry,
  Color,
  Group,
  Mesh,
  MeshLambertMaterial,
} from "three";

interface Visual {
  id: string;
  root: Group;
  stacks: Mesh[];
}

const MAX_ACTIVE = 3;

/**
 * Local voxel-ish stacks for promoted targets only (K ≤ 3).
 * Background city stays on InstancedMesh.
 */
export class DestructibleField {
  readonly group = new Group();
  private visuals = new Map<string, Visual>();
  private readonly geo = new BoxGeometry(1, 1, 1);
  private readonly mats = [
    new MeshLambertMaterial({ color: new Color(0xb0b6be) }),
    new MeshLambertMaterial({ color: new Color(0x9a7a4a) }),
    new MeshLambertMaterial({ color: new Color(0x6a4030) }),
    new MeshLambertMaterial({ color: new Color(0x3a2a22) }),
  ];

  sync(targets: DestructibleTarget[]): void {
    const live = new Set<string>();
    let active = 0;
    for (const t of targets) {
      if (!t.promoted) continue;
      if (active >= MAX_ACTIVE && !this.visuals.has(t.id)) continue;
      live.add(t.id);
      active += 1;
      let v = this.visuals.get(t.id);
      if (!v) {
        v = this.spawn(t);
        this.visuals.set(t.id, v);
        this.group.add(v.root);
      }
      this.updateVisual(v, t);
    }
    for (const [id, v] of this.visuals) {
      if (live.has(id)) continue;
      this.group.remove(v.root);
      for (const m of v.stacks) {
        m.geometry = this.geo; // shared
      }
      this.visuals.delete(id);
    }
  }

  private spawn(t: DestructibleTarget): Visual {
    const root = new Group();
    const stacks: Mesh[] = [];
    const layers = 4;
    for (let i = 0; i < layers; i++) {
      const mesh = new Mesh(this.geo, this.mats[0]!);
      stacks.push(mesh);
      root.add(mesh);
    }
    root.position.set(t.aabb.cx, t.baseY, t.aabb.cz);
    root.rotation.y = t.yaw;
    return { id: t.id, root, stacks };
  }

  private updateVisual(v: Visual, t: DestructibleTarget): void {
    if (t.destroyed) {
      v.root.visible = false;
      return;
    }
    v.root.visible = true;
    const hScale = Math.max(0.2, t.hp / t.maxHp);
    const mat = this.mats[Math.min(3, t.damageState)]!;
    const layers = v.stacks.length;
    const layerH = (t.h * hScale) / layers;
    for (let i = 0; i < layers; i++) {
      const m = v.stacks[i]!;
      m.material = mat;
      m.position.set(0, layerH * (i + 0.5), 0);
      m.scale.set(t.w * 0.92, layerH * 0.92, t.d * 0.92);
      m.visible = i * (1 / layers) < hScale + 0.01;
    }
  }

  dispose(): void {
    this.geo.dispose();
    for (const m of this.mats) m.dispose();
    this.visuals.clear();
  }
}
