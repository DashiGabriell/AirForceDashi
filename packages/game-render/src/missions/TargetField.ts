import type { PracticeTargetState } from "@afd/game-core";
import {
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  TorusGeometry,
} from "three";

/** Floating practice balloons — bright, readable against sky/sea. */
export class TargetField {
  readonly group = new Group();
  private nodes = new Map<number, Group>();
  private matCore = new MeshBasicMaterial({
    color: new Color(0xff6b3d),
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
  });
  private matRing = new MeshBasicMaterial({
    color: new Color(0xffd93d),
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });
  private geoCore = new SphereGeometry(1, 12, 10);
  private geoRing = new TorusGeometry(1.35, 0.08, 8, 24);

  sync(targets: PracticeTargetState[]): void {
    const live = new Set<number>();
    for (const t of targets) {
      if (!t.alive) continue;
      live.add(t.id);
      let root = this.nodes.get(t.id);
      if (!root) {
        root = this.build();
        this.nodes.set(t.id, root);
        this.group.add(root);
      }
      const s = Math.max(4, t.radius * 0.55);
      root.scale.setScalar(s);
      root.position.set(t.x, t.y, t.z);
      root.rotation.y += 0.01;
    }
    for (const [id, root] of this.nodes) {
      if (!live.has(id)) {
        this.group.remove(root);
        this.nodes.delete(id);
      }
    }
  }

  private build(): Group {
    const g = new Group();
    g.add(new Mesh(this.geoCore, this.matCore));
    const ring = new Mesh(this.geoRing, this.matRing);
    ring.rotation.x = Math.PI * 0.5;
    g.add(ring);
    return g;
  }

  dispose(): void {
    this.nodes.clear();
    this.group.clear();
    this.geoCore.dispose();
    this.geoRing.dispose();
    this.matCore.dispose();
    this.matRing.dispose();
  }
}
