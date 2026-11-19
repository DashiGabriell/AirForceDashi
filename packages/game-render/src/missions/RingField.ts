import type { GatePoint } from "@afd/game-core";
import {
  Group,
  Mesh,
  MeshBasicMaterial,
  TorusGeometry,
  Vector3,
} from "three";

export class RingField {
  readonly group = new Group();
  private rings: Mesh[] = [];
  private activeMat = new MeshBasicMaterial({
    color: 0x44ff88,
    transparent: true,
    opacity: 0.85,
  });
  private idleMat = new MeshBasicMaterial({
    color: 0x88aacc,
    transparent: true,
    opacity: 0.35,
  });
  private doneMat = new MeshBasicMaterial({
    color: 0xffcc44,
    transparent: true,
    opacity: 0.25,
  });
  private t = 0;

  setGates(gates: GatePoint[]): void {
    this.clear();
    for (let i = 0; i < gates.length; i++) {
      const g = gates[i]!;
      const mesh = new Mesh(
        new TorusGeometry(g.radius, Math.max(1.2, g.radius * 0.04), 8, 32),
        i === 0 ? this.activeMat : this.idleMat,
      );
      mesh.position.set(g.x, g.y, g.z);
      // Orient torus so its plane faces the gate normal (-Z of torus is axis)
      const n = new Vector3(g.nx, g.ny, g.nz).normalize();
      mesh.quaternion.setFromUnitVectors(new Vector3(0, 0, 1), n);
      this.group.add(mesh);
      this.rings.push(mesh);
    }
  }

  update(ringIndex: number, dt: number): void {
    this.t += dt;
    for (let i = 0; i < this.rings.length; i++) {
      const mesh = this.rings[i]!;
      if (i < ringIndex) mesh.material = this.doneMat;
      else if (i === ringIndex) {
        mesh.material = this.activeMat;
        const s = 1 + 0.04 * Math.sin(this.t * 8);
        mesh.scale.setScalar(s);
      } else {
        mesh.material = this.idleMat;
        mesh.scale.setScalar(1);
      }
    }
  }

  clear(): void {
    for (const m of this.rings) {
      this.group.remove(m);
      m.geometry.dispose();
    }
    this.rings = [];
  }

  dispose(): void {
    this.clear();
    this.activeMat.dispose();
    this.idleMat.dispose();
    this.doneMat.dispose();
  }
}
