import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
} from "three";

/**
 * ATC-001 control tower, real metres, origin on the pad.
 * Cab glass stays MeshStandard (no transmission) so it reads without an env map.
 */
export class ControlTower {
  readonly group = new Group();
  private readonly geos: Array<{ dispose(): void }> = [];
  private readonly mats: Array<{ dispose(): void }> = [];

  constructor() {
    this.group.name = "ControlTower";

    const concrete = new MeshStandardMaterial({
      color: 0xb0ada4,
      roughness: 0.78,
      metalness: 0.04,
    });
    const dark = new MeshStandardMaterial({
      color: 0x3a414a,
      roughness: 0.55,
      metalness: 0.18,
    });
    const radome = new MeshStandardMaterial({
      color: 0xf0ece4,
      roughness: 0.4,
      metalness: 0.02,
    });
    const glass = new MeshStandardMaterial({
      color: 0x7eb4d4,
      metalness: 0.15,
      roughness: 0.18,
      transparent: true,
      opacity: 0.72,
      emissive: 0x2a6a8c,
      emissiveIntensity: 0.35,
      depthWrite: false,
    });
    glass.name = "TowerGlass";
    this.mats.push(concrete, dark, radome, glass);

    // Ops building, 24 × 11 × 12, south of the shaft. Roof line ~12 m on the sheet.
    this.box(concrete, 24, 11, 12, 0, 5.5, -2);
    this.box(dark, 3.2, 2.4, 0.15, 0, 1.4, -8.05);
    for (const x of [-8, -3, 3, 8]) {
      this.box(glass, 2.2, 1.6, 0.12, x, 3.2, -8.02);
      this.box(glass, 2.2, 1.6, 0.12, x, 7.4, -8.02);
    }

    // Shaft to the catwalk at 36.5 m. Octagonal core, ~4.8 m across.
    const shaft = this.mesh(
      new CylinderGeometry(2.4, 2.6, 36.5, 8),
      concrete,
      0,
      18.25,
      5.2,
    );
    shaft.rotation.y = Math.PI / 8;
    for (let i = 0; i < 7; i++) {
      this.box(dark, 0.35, 1.1, 0.08, 2.55, 8 + i * 3.6, 5.2);
    }

    // Catwalk and rail around the cab.
    const deck = this.mesh(new CylinderGeometry(6.4, 6.4, 0.25, 16), concrete, 0, 36.5, 5.2);
    deck.rotation.y = 0;
    const rail = this.mesh(new TorusGeometry(6.3, 0.08, 6, 20), dark, 0, 37.35, 5.2);
    rail.rotation.x = Math.PI / 2;

    // Cab: wider than the shaft, glass tilted outward (top broader).
    const cab = this.mesh(
      new CylinderGeometry(5.2, 3.6, 6.6, 8),
      glass,
      0,
      40.1,
      5.2,
    );
    cab.rotation.y = Math.PI / 8;
    this.mesh(new CylinderGeometry(5.35, 5.35, 0.35, 8), concrete, 0, 43.5, 5.2);

    // Radome apex ~48 m, antenna tip 55 m.
    this.mesh(new SphereGeometry(2.15, 18, 14), radome, 0, 46.2, 5.2);
    this.mesh(new CylinderGeometry(0.12, 0.16, 6.2, 8), dark, 0, 50.6, 5.2);
    this.mesh(new CylinderGeometry(0.04, 0.04, 1.6, 6), dark, 0, 54.2, 5.2);
  }

  dispose(): void {
    this.group.removeFromParent();
    for (const g of this.geos) g.dispose();
    for (const m of this.mats) m.dispose();
  }

  private box(
    mat: MeshStandardMaterial,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
  ): Mesh {
    return this.mesh(new BoxGeometry(w, h, d), mat, x, y, z);
  }

  private mesh(
    geo: BoxGeometry | CylinderGeometry | SphereGeometry | TorusGeometry,
    mat: MeshStandardMaterial,
    x: number,
    y: number,
    z: number,
  ): Mesh {
    this.geos.push(geo);
    const mesh = new Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    this.group.add(mesh);
    return mesh;
  }
}
