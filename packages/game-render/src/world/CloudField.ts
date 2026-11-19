import {
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Color,
} from "three";

/** Soft billboard cloud cards — few draw calls. */
export class CloudField {
  readonly group = new Group();
  private mats: MeshBasicMaterial[] = [];

  constructor(count = 18) {
    const geo = new PlaneGeometry(280, 140);
    for (let i = 0; i < count; i++) {
      const mat = new MeshBasicMaterial({
        color: new Color(0xe8eef5),
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      });
      this.mats.push(mat);
      const m = new Mesh(geo, mat);
      const a = (i / count) * Math.PI * 2;
      const r = 1800 + (i % 5) * 400;
      m.position.set(Math.cos(a) * r, 900 + (i % 4) * 120, Math.sin(a) * r);
      m.rotation.x = -0.15;
      this.group.add(m);
    }
  }

  update(wx: number, wz: number, dayFactor: number): void {
    this.group.position.set(wx, 0, wz);
    for (const mat of this.mats) {
      mat.opacity = 0.15 + dayFactor * 0.28;
    }
  }

  dispose(): void {
    for (const mat of this.mats) mat.dispose();
    const first = this.group.children[0] as Mesh | undefined;
    first?.geometry.dispose();
  }
}
