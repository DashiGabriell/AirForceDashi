import type { DroneState } from "@afd/game-core";
import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Color,
} from "three";

export class DroneField {
  readonly group = new Group();
  private nodes = new Map<number, Group>();
  private mat = new MeshBasicMaterial({ color: new Color(0x1a1c20) });

  sync(drones: DroneState[]): void {
    const live = new Set<number>();
    for (const d of drones) {
      if (!d.alive) continue;
      live.add(d.id);
      let root = this.nodes.get(d.id);
      if (!root) {
        root = this.build(d.kind);
        this.nodes.set(d.id, root);
        this.group.add(root);
      }
      root.position.set(d.x, d.y, d.z);
      root.lookAt(d.x + d.vx, d.y + d.vy, d.z + d.vz);
    }
    for (const [id, root] of this.nodes) {
      if (!live.has(id)) {
        this.group.remove(root);
        root.traverse((o) => {
          if (o instanceof Mesh) o.geometry.dispose();
        });
        this.nodes.delete(id);
      }
    }
  }

  private build(kind: number): Group {
    const g = new Group();
    const box = (w: number, h: number, d: number, x: number, y: number, z: number) => {
      const m = new Mesh(new BoxGeometry(w, h, d), this.mat);
      m.position.set(x, y, z);
      g.add(m);
    };
    if (kind === 0) {
      // Geran
      box(1.2, 0.4, 4.5, 0, 0, 0);
      box(6, 0.08, 1.2, 0, 0, 0.2);
    } else if (kind === 1) {
      box(0.9, 0.35, 3.2, 0, 0, 0);
      box(4.5, 0.08, 1, 0, 0.05, 0);
    } else {
      box(0.6, 0.25, 2.2, 0, 0, 0);
      box(2.8, 0.06, 0.8, 0, 0, 0);
      box(0.06, 0.8, 0.8, 0, 0.3, 0.5);
    }
    return g;
  }

  dispose(): void {
    for (const root of this.nodes.values()) {
      root.traverse((o) => {
        if (o instanceof Mesh) o.geometry.dispose();
      });
    }
    this.nodes.clear();
    this.mat.dispose();
  }
}
