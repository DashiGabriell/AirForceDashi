import { AIRBASE } from "@afd/game-core";
import {
  BoxGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Shape,
} from "three";

/**
 * Full Dashi AFB mesh. Local coords: +X east, +Z south, origin = runway centre.
 * World position is set by WorldSystem to (AIRBASE.x, padY, AIRBASE.z).
 */
export class AirbaseComplex {
  readonly group = new Group();
  private readonly geos: Array<{ dispose(): void }> = [];
  private readonly mats: Array<{ dispose(): void }> = [];

  constructor() {
    this.group.name = "AirbaseComplex";

    const asphalt = this.mat(0x2a2c30, 0.92, 0.02);
    const concrete = this.mat(0x7a7870, 0.85, 0.04);
    const mark = this.mat(0xe8e4d8, 0.7, 0.05);
    const steel = this.mat(0x5a6270, 0.45, 0.55);
    const dark = this.mat(0x1e2228, 0.7, 0.15);
    const earth = this.mat(0x5a4a38, 0.95, 0);
    const accent = this.mat(0x8b2e2e, 0.65, 0.1);
    const glass = this.mat(0x6a8aa0, 0.2, 0.35);
    glass.emissive.setHex(0x102030);
    glass.emissiveIntensity = 0.35;

    this.buildPavement(asphalt, concrete, mark);
    this.buildHangars(steel, dark, concrete);
    this.buildHas(concrete, dark, earth);
    this.buildFuel(steel, dark, concrete);
    this.buildAmmo(concrete, earth, dark);
    this.buildAdmin(concrete, dark, glass, accent, mark);
  }

  dispose(): void {
    this.group.removeFromParent();
    for (const g of this.geos) g.dispose();
    for (const m of this.mats) m.dispose();
  }

  private mat(color: number, roughness: number, metalness: number): MeshStandardMaterial {
    const m = new MeshStandardMaterial({ color, roughness, metalness });
    this.mats.push(m);
    return m;
  }

  private box(
    mat: MeshStandardMaterial,
    w: number,
    h: number,
    d: number,
    lx: number,
    y: number,
    lz: number,
  ): Mesh {
    const geo = new BoxGeometry(w, h, d);
    this.geos.push(geo);
    const mesh = new Mesh(geo, mat);
    mesh.position.set(lx, y, lz);
    this.group.add(mesh);
    return mesh;
  }

  private cyl(
    mat: MeshStandardMaterial,
    rTop: number,
    rBot: number,
    h: number,
    lx: number,
    y: number,
    lz: number,
    seg = 16,
  ): Mesh {
    const geo = new CylinderGeometry(rTop, rBot, h, seg);
    this.geos.push(geo);
    const mesh = new Mesh(geo, mat);
    mesh.position.set(lx, y, lz);
    this.group.add(mesh);
    return mesh;
  }

  private vault(
    mat: MeshStandardMaterial,
    span: number,
    depth: number,
    height: number,
    lx: number,
    lz: number,
  ): void {
    const shape = new Shape();
    const r = span * 0.5;
    shape.moveTo(-r, 0);
    shape.absarc(0, 0, r, Math.PI, 0, true);
    const geo = new ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: false,
      curveSegments: 18,
    });
    this.geos.push(geo);
    const shell = new Mesh(geo, mat);
    shell.rotation.x = -Math.PI / 2;
    shell.position.set(lx, 0.1, lz - depth * 0.5);
    shell.scale.y = height / r;
    this.group.add(shell);
  }

  private buildPavement(
    asphalt: MeshStandardMaterial,
    concrete: MeshStandardMaterial,
    mark: MeshStandardMaterial,
  ): void {
    const L = AIRBASE.runwayLength;
    const W = AIRBASE.runwayWidth;
    const blast = AIRBASE.blastPad;
    const tw = AIRBASE.taxiWidth;
    const to = AIRBASE.taxiOffset;

    this.box(asphalt, L, 0.12, W, 0, 0.08, 0);
    this.box(concrete, blast, 0.1, W + 8, -(L * 0.5 + blast * 0.5), 0.07, 0);
    this.box(concrete, blast, 0.1, W + 8, L * 0.5 + blast * 0.5, 0.07, 0);
    for (let i = -16; i <= 16; i++) {
      this.box(mark, 28, 0.04, 0.9, i * 100, 0.15, 0);
    }
    for (const side of [-1, 1] as const) {
      for (let k = 0; k < 8; k++) {
        this.box(mark, 22, 0.04, 1.4, side * (L * 0.5 - 40), 0.15, -18 + k * 5);
      }
    }

    this.box(asphalt, L - 200, 0.11, tw, 0, 0.075, to);
    for (let i = -3; i <= 3; i++) {
      this.box(asphalt, tw, 0.11, to - W * 0.5 + 4, i * 420, 0.075, to * 0.5);
    }

    this.box(concrete, 900, 0.1, 220, -200, 0.06, to + 160);
    this.box(concrete, 520, 0.1, 180, 520, 0.06, to + 140);
    for (let i = 0; i < 10; i++) {
      this.box(mark, 18, 0.03, 3, -560 + i * 72, 0.12, to + 80);
    }
    for (let i = 0; i < 8; i++) {
      this.box(mark, 16, 0.03, 3, 380 + i * 48, 0.12, to + 70);
    }

    this.box(asphalt, 3800, 0.08, 8, 0, 0.05, 780);
    this.box(asphalt, 8, 0.08, 700, -1900, 0.05, 450);
    this.box(asphalt, 8, 0.08, 700, 1900, 0.05, 450);
  }

  private buildHangars(
    steel: MeshStandardMaterial,
    dark: MeshStandardMaterial,
    concrete: MeshStandardMaterial,
  ): void {
    for (const lx of [-780, -620, -460]) {
      const lz = 460;
      const span = 54;
      const depth = 72;
      const height = 16.5;
      this.vault(steel, span, depth, height, lx, lz);
      for (let k = 1; k < 6; k++) {
        this.box(dark, span * 0.98, 0.45, 0.55, lx, height * 0.55, lz - depth * 0.5 + (k / 6) * depth);
      }
      const leafW = span / 4;
      for (let leaf = 0; leaf < 4; leaf++) {
        this.box(
          dark,
          leafW - 0.4,
          height * 0.88,
          0.35,
          lx - span * 0.5 + leafW * (leaf + 0.5),
          height * 0.44,
          lz - depth * 0.5 - 0.2,
        );
      }
      this.box(steel, span + 2, 0.5, 0.8, lx, height * 0.95, lz - depth * 0.5 - 0.3);
      this.box(concrete, span + 10, 0.08, 18, lx, 0.06, lz - depth * 0.5 - 12);
    }
  }

  private buildHas(
    concrete: MeshStandardMaterial,
    dark: MeshStandardMaterial,
    earth: MeshStandardMaterial,
  ): void {
    const sites = [
      [-980, 380],
      [-980, 480],
      [-980, 580],
      [-980, 680],
      [-880, 380],
      [-880, 480],
    ] as const;
    for (const [lx, lz] of sites) {
      const span = 24.5;
      const depth = 36;
      const height = 8.2;
      this.vault(concrete, span, depth, height, lx, lz);
      this.box(earth, span + 8, height * 0.55, depth * 0.55, lx, height * 0.28, lz + 2);
      this.box(concrete, 3, 4.5, 12, lx - span * 0.55, 2.3, lz - depth * 0.5 - 4);
      this.box(concrete, 3, 4.5, 12, lx + span * 0.55, 2.3, lz - depth * 0.5 - 4);
      this.box(dark, span * 0.48, height * 0.85, 0.4, lx - span * 0.25, height * 0.42, lz - depth * 0.5 - 0.15);
      this.box(dark, span * 0.48, height * 0.85, 0.4, lx + span * 0.25, height * 0.42, lz - depth * 0.5 - 0.15);
      this.box(concrete, span * 0.7, 3.2, 4, lx, 1.6, lz + depth * 0.5 + 1);
    }
  }

  private buildFuel(
    steel: MeshStandardMaterial,
    dark: MeshStandardMaterial,
    concrete: MeshStandardMaterial,
  ): void {
    const cx = -520;
    const cz = 180;
    this.box(concrete, 72, 1.6, 2, cx, 0.85, cz - 34);
    this.box(concrete, 72, 1.6, 2, cx, 0.85, cz + 34);
    this.box(concrete, 2, 1.6, 70, cx - 35, 0.85, cz);
    this.box(concrete, 2, 1.6, 70, cx + 35, 0.85, cz);
    this.box(concrete, 68, 0.15, 66, cx, 0.1, cz);

    const positions = [
      [-18, -18],
      [18, -18],
      [-18, 18],
      [18, 18],
      [0, 0],
      [0, -28],
    ] as const;
    for (const [dx, dz] of positions) {
      const tx = cx + dx;
      const tz = cz + dz;
      this.cyl(steel, 8.5, 8.5, 11, tx, 5.6, tz, 20);
      this.cyl(steel, 0.4, 8.5, 1.4, tx, 11.8, tz, 16);
      this.box(dark, 0.35, 11, 0.35, tx + 8.7, 5.5, tz);
      this.cyl(dark, 8.2, 8.2, 0.25, tx, 11.2, tz, 16);
    }

    this.box(concrete, 18, 6, 24, cx + 70, 3.05, cz);
    for (let i = 0; i < 5; i++) {
      this.box(dark, 3.5, 4.2, 0.3, cx + 55, 2.2, cz - 20 + i * 10);
      this.box(steel, 0.35, 0.35, 12, cx + 48, 1.2, cz - 20 + i * 10);
    }
    this.box(steel, 40, 0.45, 0.45, cx + 25, 1.4, cz - 18);
    this.box(steel, 40, 0.45, 0.45, cx + 25, 1.4, cz + 18);
    this.box(steel, 0.45, 0.45, 36, cx + 5, 1.4, cz);
  }

  private buildAmmo(
    concrete: MeshStandardMaterial,
    earth: MeshStandardMaterial,
    dark: MeshStandardMaterial,
  ): void {
    for (let i = 0; i < 4; i++) {
      const lx = -1100;
      const lz = 200 + i * 80;
      this.box(earth, 22, 5.5, 30, lx, 2.8, lz);
      this.cyl(earth, 11, 14, 6, lx, 3.2, lz, 12);
      this.box(concrete, 16, 5.2, 1.2, lx, 2.7, lz - 15);
      this.box(dark, 5.5, 4.2, 0.5, lx, 2.3, lz - 15.6);
      this.box(concrete, 2.2, 4.5, 10, lx - 10, 2.3, lz - 12);
      this.box(concrete, 2.2, 4.5, 10, lx + 10, 2.3, lz - 12);
      this.cyl(dark, 0.12, 0.12, 12, lx - 6, 8, lz + 4, 6);
      this.cyl(dark, 0.12, 0.12, 12, lx + 6, 8, lz + 4, 6);
    }
  }

  private buildAdmin(
    concrete: MeshStandardMaterial,
    dark: MeshStandardMaterial,
    glass: MeshStandardMaterial,
    accent: MeshStandardMaterial,
    mark: MeshStandardMaterial,
  ): void {
    this.box(concrete, 48, 11.4, 28, 420, 5.75, 520);
    this.box(dark, 8, 3.2, 0.3, 420, 2.2, 506);
    for (let row = 0; row < 2; row++) {
      for (let c = 0; c < 6; c++) {
        this.box(glass, 3.2, 1.8, 0.15, 400 + c * 7, 3.5 + row * 3.8, 505.9);
      }
    }
    this.box(dark, 6, 1.4, 4, 410, 12.2, 520);
    this.box(dark, 6, 1.4, 4, 430, 12.2, 515);
    this.cyl(accent, 0.15, 0.15, 8, 420, 15.5, 520, 6);

    for (const lx of [280, 360, 440, 520]) {
      const lz = 620;
      this.box(concrete, 16, 10.5, 44, lx, 5.3, lz);
      for (let floor = 0; floor < 3; floor++) {
        for (let w = 0; w < 5; w++) {
          this.box(glass, 2.2, 1.4, 0.12, lx - 6 + w * 3, 2.2 + floor * 3.2, lz - 22.1);
        }
      }
      this.box(dark, 3.5, 1.1, 2.5, lx, 11.1, lz);
    }

    this.box(concrete, 42, 9, 28, 180, 4.55, 200);
    for (let i = 0; i < 4; i++) {
      this.box(dark, 7.5, 5.5, 0.25, 162 + i * 10, 3.2, 186);
    }
    this.box(accent, 6, 12, 6, 198, 6.1, 205);

    const pads = [
      [680, 420],
      [760, 420],
      [680, 500],
      [760, 500],
    ] as const;
    for (const [lx, lz] of pads) {
      this.cyl(concrete, 12.5, 12.5, 0.18, lx, 0.12, lz, 24);
      this.box(mark, 1.2, 0.05, 8, lx - 2.2, 0.22, lz);
      this.box(mark, 1.2, 0.05, 8, lx + 2.2, 0.22, lz);
      this.box(mark, 5.6, 0.05, 1.2, lx, 0.22, lz);
      this.cyl(mark, 11.2, 11.2, 0.04, lx, 0.2, lz, 28);
      this.box(concrete, 8, 0.1, 24, lx - 20, 0.08, lz);
    }

    this.box(concrete, 8, 3.5, 6, 0, 1.8, 820);
    this.box(dark, 40, 2.2, 0.25, -30, 1.2, 820);
    this.box(dark, 40, 2.2, 0.25, 30, 1.2, 820);
  }
}
