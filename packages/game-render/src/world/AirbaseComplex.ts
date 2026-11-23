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

    const cladding = this.mat(0x6e7682, 0.55, 0.42);
    const rivet = this.mat(0x3a4048, 0.5, 0.35);

    this.buildPavement(asphalt, concrete, mark);
    this.buildHangars(cladding, steel, dark, concrete, glass, rivet);
    this.buildHas(concrete, dark, earth, steel, rivet);
    this.buildFuel(steel, dark, concrete, rivet, accent);
    this.buildAmmo(concrete, earth, dark, steel, rivet, accent);
    this.buildAdmin(concrete, dark, glass, accent, mark, steel, rivet);
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
    cladding: MeshStandardMaterial,
    steel: MeshStandardMaterial,
    dark: MeshStandardMaterial,
    concrete: MeshStandardMaterial,
    glass: MeshStandardMaterial,
    rivet: MeshStandardMaterial,
  ): void {
    for (const lx of [-780, -620, -460]) {
      this.addMaintenanceHangar(lx, 460, cladding, steel, dark, concrete, glass, rivet);
    }
  }

  /** Vaulted maintenance hangar — ribs, track housing, sliding leaves, vents. */
  private addMaintenanceHangar(
    lx: number,
    lz: number,
    cladding: MeshStandardMaterial,
    steel: MeshStandardMaterial,
    dark: MeshStandardMaterial,
    concrete: MeshStandardMaterial,
    glass: MeshStandardMaterial,
    rivet: MeshStandardMaterial,
  ): void {
    const span = 54;
    const depth = 72;
    const height = 16.5;
    const r = span * 0.5;
    const zFront = lz - depth * 0.5;
    const zBack = lz + depth * 0.5;

    // Outer shell + slightly inset inner shell for thickness read
    this.vault(cladding, span, depth, height, lx, lz);
    this.vault(dark, span * 0.96, depth - 1.2, height * 0.94, lx, lz + 0.4);

    // Concrete sill / footing strip along both long edges
    this.box(concrete, 1.8, 1.1, depth + 2, lx - r - 0.2, 0.55, lz);
    this.box(concrete, 1.8, 1.1, depth + 2, lx + r + 0.2, 0.55, lz);

    // Structural ribs along depth (arched via rotated segments)
    const ribCount = 9;
    for (let k = 0; k < ribCount; k++) {
      const z = zFront + 2 + (k / (ribCount - 1)) * (depth - 4);
      this.addArchRib(steel, lx, z, span, height, 0.55);
    }

    // Longitudinal ridge beam
    this.box(steel, 1.2, 0.7, depth - 2, lx, height + 0.15, lz);

    // Roof ventilators along the ridge
    for (let i = 0; i < 5; i++) {
      const z = zFront + 10 + i * 12;
      this.box(dark, 3.2, 1.1, 2.4, lx, height + 0.9, z);
      this.box(rivet, 2.6, 0.35, 2.8, lx, height + 1.55, z);
    }

    // Rear wall + service door
    this.box(cladding, span - 2, height * 0.92, 0.45, lx, height * 0.46, zBack - 0.3);
    this.box(dark, 4.2, 3.6, 0.35, lx, 1.9, zBack + 0.05);
    for (let w = 0; w < 4; w++) {
      this.box(glass, 3.5, 1.6, 0.12, lx - 16 + w * 10, height * 0.72, zBack + 0.1);
    }

    // Front clerestory band above the doors
    this.box(steel, span + 1.5, 0.55, 1.1, lx, height * 0.92, zFront - 0.55);
    for (let w = 0; w < 8; w++) {
      this.box(glass, 4.8, 1.35, 0.12, lx - span * 0.5 + 4 + w * 6.2, height * 0.82, zFront - 0.35);
    }

    // Upper sliding-door track housing
    this.box(steel, span + 3.5, 1.15, 1.6, lx, height * 0.98, zFront - 0.9);
    this.box(dark, span + 3.2, 0.35, 0.45, lx, height * 0.98 - 0.55, zFront - 1.35);

    // Four sliding leaves with panel breaks + rollers
    const leafW = span / 4;
    for (let leaf = 0; leaf < 4; leaf++) {
      const cx = lx - span * 0.5 + leafW * (leaf + 0.5);
      const leafH = height * 0.78;
      this.box(dark, leafW - 0.55, leafH, 0.42, cx, leafH * 0.5 + 0.15, zFront - 0.25);
      // Vertical panel seams
      this.box(rivet, 0.18, leafH * 0.92, 0.48, cx - leafW * 0.22, leafH * 0.5 + 0.15, zFront - 0.05);
      this.box(rivet, 0.18, leafH * 0.92, 0.48, cx + leafW * 0.22, leafH * 0.5 + 0.15, zFront - 0.05);
      // Horizontal stiffener
      this.box(steel, leafW - 0.9, 0.28, 0.5, cx, leafH * 0.55, zFront + 0.05);
      // Roller trucks under track
      this.box(steel, 1.4, 0.35, 0.55, cx, height * 0.92, zFront - 0.7);
      // Bottom guide
      this.box(concrete, leafW - 0.4, 0.22, 0.7, cx, 0.2, zFront - 0.15);
    }

    // Door jambs
    this.box(steel, 0.7, height * 0.9, 1.2, lx - r + 0.2, height * 0.45, zFront - 0.4);
    this.box(steel, 0.7, height * 0.9, 1.2, lx + r - 0.2, height * 0.45, zFront - 0.4);

    // Apron slab + drainage channel in front
    this.box(concrete, span + 14, 0.1, 22, lx, 0.07, zFront - 14);
    this.box(dark, span + 12, 0.12, 0.55, lx, 0.14, zFront - 3.2);
    // Tie-down pads
    for (let i = -2; i <= 2; i++) {
      this.box(steel, 1.6, 0.08, 1.6, lx + i * 9, 0.16, zFront - 10);
    }
  }

  /** Thin arched rib on the hangar vault (rotated box segments). */
  private addArchRib(
    mat: MeshStandardMaterial,
    lx: number,
    z: number,
    span: number,
    height: number,
    thickness: number,
  ): void {
    const segments = 12;
    const r = span * 0.5;
    for (let i = 0; i < segments; i++) {
      const a0 = Math.PI - (i / segments) * Math.PI;
      const a1 = Math.PI - ((i + 1) / segments) * Math.PI;
      const a = (a0 + a1) * 0.5;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * height;
      const mesh = this.box(mat, thickness, 0.85, thickness + 0.15, lx + x, y, z);
      mesh.rotation.z = a - Math.PI * 0.5;
    }
  }

  private buildHas(
    concrete: MeshStandardMaterial,
    dark: MeshStandardMaterial,
    earth: MeshStandardMaterial,
    steel: MeshStandardMaterial,
    rivet: MeshStandardMaterial,
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
      this.addHardenedShelter(lx, lz, concrete, dark, earth, steel, rivet);
    }
  }

  /** Hardened Aircraft Shelter — thick vault, berm, blast doors, wing walls. */
  private addHardenedShelter(
    lx: number,
    lz: number,
    concrete: MeshStandardMaterial,
    dark: MeshStandardMaterial,
    earth: MeshStandardMaterial,
    steel: MeshStandardMaterial,
    rivet: MeshStandardMaterial,
  ): void {
    const span = 24.5;
    const depth = 36;
    const height = 8.2;
    const r = span * 0.5;
    const zFront = lz - depth * 0.5;
    const zBack = lz + depth * 0.5;

    // Double-shell vault (outer + inset inner read as thick RC)
    this.vault(concrete, span, depth, height, lx, lz);
    this.vault(dark, span * 0.9, depth - 1.4, height * 0.9, lx, lz + 0.3);

    // Earth berm over rear / flanks
    this.box(earth, span + 10, height * 0.62, depth * 0.62, lx, height * 0.32, lz + 4);
    this.box(earth, span + 14, height * 0.38, depth * 0.4, lx, height * 0.2, lz + 8);
    // Side berm shoulders
    this.box(earth, 5.5, height * 0.7, depth * 0.85, lx - r - 4, height * 0.35, lz + 1);
    this.box(earth, 5.5, height * 0.7, depth * 0.85, lx + r + 4, height * 0.35, lz + 1);

    // Arch ribs (fewer, thicker than hangars)
    for (let k = 0; k < 5; k++) {
      const z = zFront + 3 + (k / 4) * (depth - 6);
      this.addArchRib(steel, lx, z, span * 0.96, height * 0.96, 0.7);
    }

    // Longitudinal crown beam under earth cover
    this.box(concrete, 1.4, 0.55, depth - 4, lx, height + 0.05, lz);

    // Rear blast wall + small personnel door + exhaust vents
    this.box(concrete, span - 1.5, height * 0.95, 0.7, lx, height * 0.48, zBack - 0.2);
    this.box(dark, 2.4, 2.8, 0.35, lx, 1.5, zBack + 0.25);
    for (const side of [-1, 1] as const) {
      this.box(dark, 1.6, 1.1, 0.25, lx + side * 6, height * 0.55, zBack + 0.3);
      this.cyl(dark, 0.35, 0.45, 2.2, lx + side * 8.5, height + 0.4, zBack - 2, 10);
    }

    // Wing / retaining walls at entrance (classic HAS throat)
    const wingZ = zFront - 5;
    this.box(concrete, 3.2, 5.2, 14, lx - r - 0.6, 2.6, wingZ);
    this.box(concrete, 3.2, 5.2, 14, lx + r + 0.6, 2.6, wingZ);
    // Cap beams on wing walls
    this.box(concrete, 3.6, 0.45, 14.5, lx - r - 0.6, 5.35, wingZ);
    this.box(concrete, 3.6, 0.45, 14.5, lx + r + 0.6, 5.35, wingZ);

    // Massive blast-door track + lintel
    this.box(steel, span + 2.5, 1.1, 1.4, lx, height * 0.95, zFront - 0.7);
    this.box(concrete, span + 1.2, 0.7, 1.8, lx, height * 0.88, zFront - 0.35);

    // Twin heavy blast leaves with hinge posts + stiffeners
    const leafW = span * 0.48;
    const leafH = height * 0.88;
    for (const side of [-1, 1] as const) {
      const cx = lx + side * span * 0.25;
      this.box(dark, leafW - 0.35, leafH, 0.55, cx, leafH * 0.5 + 0.12, zFront - 0.1);
      // Diagonal / horizontal stiffeners
      this.box(rivet, leafW - 0.8, 0.22, 0.62, cx, leafH * 0.35, zFront + 0.15);
      this.box(rivet, leafW - 0.8, 0.22, 0.62, cx, leafH * 0.65, zFront + 0.15);
      this.box(steel, 0.22, leafH * 0.9, 0.62, cx - leafW * 0.2, leafH * 0.5 + 0.12, zFront + 0.2);
      this.box(steel, 0.22, leafH * 0.9, 0.62, cx + leafW * 0.2, leafH * 0.5 + 0.12, zFront + 0.2);
      // Hinge post
      this.box(steel, 0.55, leafH + 0.4, 0.7, lx + side * (r - 0.4), leafH * 0.5 + 0.2, zFront + 0.15);
      // Roller truck
      this.box(steel, 1.2, 0.35, 0.5, cx, height * 0.92, zFront - 0.55);
    }

    // Threshold sill + tire guides
    this.box(concrete, span + 1, 0.35, 1.4, lx, 0.2, zFront - 0.2);
    this.box(steel, 0.25, 0.2, 8, lx - 3.2, 0.25, zFront - 5);
    this.box(steel, 0.25, 0.2, 8, lx + 3.2, 0.25, zFront - 5);

    // Front apron stub + rear service pad
    this.box(concrete, span + 10, 0.1, 16, lx, 0.07, zFront - 10);
    this.box(concrete, span * 0.75, 0.12, 6, lx, 0.08, zBack + 4);
    // Drainage ditch across throat
    this.box(dark, span + 8, 0.15, 0.55, lx, 0.12, zFront - 2.5);
  }

  private buildFuel(
    steel: MeshStandardMaterial,
    dark: MeshStandardMaterial,
    concrete: MeshStandardMaterial,
    rivet: MeshStandardMaterial,
    accent: MeshStandardMaterial,
  ): void {
    const cx = -520;
    const cz = 180;

    // Containment pad + perimeter bund (with corner piers + access ramp)
    this.box(concrete, 68, 0.18, 66, cx, 0.12, cz);
    this.box(dark, 8, 0.22, 8, cx, 0.08, cz + 8); // sump
    for (const [wx, wz, ww, wd] of [
      [cx, cz - 34, 72, 2],
      [cx, cz + 34, 72, 2],
      [cx - 35, cz, 2, 70],
      [cx + 35, cz, 2, 70],
    ] as const) {
      this.box(concrete, ww, 1.7, wd, wx, 0.9, wz);
    }
    // Corner piers
    for (const [dx, dz] of [
      [-34, -33],
      [34, -33],
      [-34, 33],
      [34, 33],
    ] as const) {
      this.box(concrete, 2.4, 2.2, 2.4, cx + dx, 1.15, cz + dz);
    }
    // Bund access ramp (east side cut)
    this.box(concrete, 6, 0.35, 10, cx + 38, 0.35, cz);
    this.box(concrete, 1.2, 1.1, 10, cx + 35.6, 0.7, cz);
    // Hazard stripe on ramp lip
    this.box(accent, 5.5, 0.06, 0.45, cx + 38, 0.55, cz - 4.5);
    this.box(accent, 5.5, 0.06, 0.45, cx + 38, 0.55, cz + 4.5);

    const positions = [
      [-18, -18],
      [18, -18],
      [-18, 18],
      [18, 18],
      [0, 0],
      [0, -28],
    ] as const;
    for (const [dx, dz] of positions) {
      this.addFuelTank(cx + dx, cz + dz, steel, dark, rivet, concrete);
    }

    // Inter-tank pipe manifold (low + mid headers)
    this.box(steel, 40, 0.45, 0.45, cx + 0, 1.35, cz - 18);
    this.box(steel, 40, 0.45, 0.45, cx + 0, 1.35, cz + 18);
    this.box(steel, 0.45, 0.45, 36, cx + 0, 1.35, cz);
    this.box(steel, 36, 0.35, 0.35, cx, 2.6, cz - 18);
    this.box(steel, 36, 0.35, 0.35, cx, 2.6, cz + 18);
    // Valve clusters along manifold
    for (let i = -2; i <= 2; i++) {
      this.cyl(dark, 0.55, 0.55, 0.7, cx + i * 8, 1.7, cz - 18, 10);
      this.box(rivet, 0.9, 0.25, 0.9, cx + i * 8, 2.15, cz - 18);
    }

    // Truck loading rack east of bund
    this.box(concrete, 22, 0.15, 48, cx + 58, 0.1, cz);
    this.box(steel, 1.2, 5.5, 1.2, cx + 50, 2.85, cz - 18);
    this.box(steel, 1.2, 5.5, 1.2, cx + 50, 2.85, cz + 18);
    this.box(steel, 1.0, 0.55, 38, cx + 50, 5.7, cz);
    for (let i = 0; i < 5; i++) {
      const z = cz - 20 + i * 10;
      this.box(dark, 3.5, 4.2, 0.35, cx + 55, 2.2, z);
      this.box(steel, 0.35, 0.35, 10, cx + 48, 1.35, z);
      this.cyl(steel, 0.22, 0.22, 4.5, cx + 52, 3.5, z, 8);
      this.box(accent, 0.15, 1.2, 0.15, cx + 55, 4.6, z);
    }

    // Pump / filter house
    this.box(concrete, 18, 6.2, 24, cx + 70, 3.15, cz);
    this.box(dark, 4.5, 3.2, 0.3, cx + 61.1, 2.0, cz);
    this.box(steel, 18.5, 0.35, 24.5, cx + 70, 6.4, cz);
    for (let w = 0; w < 3; w++) {
      this.box(dark, 2.8, 1.6, 0.12, cx + 70 - 5 + w * 5, 4.2, cz - 12.05);
    }
    // Roof vents + AC pack
    this.box(dark, 2.2, 0.9, 2.2, cx + 66, 7.0, cz - 4);
    this.box(dark, 2.2, 0.9, 2.2, cx + 74, 7.0, cz + 4);
    this.box(rivet, 3.5, 1.1, 2.4, cx + 70, 7.1, cz);

    // Fire posts around bund
    for (const [dx, dz] of [
      [-40, -40],
      [40, -40],
      [-40, 40],
      [40, 40],
      [0, -42],
      [0, 42],
    ] as const) {
      this.cyl(accent, 0.25, 0.25, 1.8, cx + dx, 1.0, cz + dz, 8);
      this.cyl(dark, 0.45, 0.45, 0.35, cx + dx, 2.0, cz + dz, 8);
    }
  }

  /** Vertical storage tank — shell rings, ladder, roof hatch, skirt. */
  private addFuelTank(
    tx: number,
    tz: number,
    steel: MeshStandardMaterial,
    dark: MeshStandardMaterial,
    rivet: MeshStandardMaterial,
    concrete: MeshStandardMaterial,
  ): void {
    const r = 8.5;
    const h = 11;
    // Shell + roof cone + rim
    this.cyl(steel, r, r, h, tx, h * 0.5 + 0.15, tz, 22);
    this.cyl(steel, 0.35, r * 0.98, 1.35, tx, h + 0.7, tz, 18);
    this.cyl(dark, r * 0.96, r * 0.96, 0.22, tx, h + 0.15, tz, 18);
    // Roof hatch + vent
    this.cyl(dark, 1.1, 1.1, 0.55, tx - 2.2, h + 1.55, tz, 12);
    this.cyl(rivet, 0.35, 0.45, 1.1, tx + 2.5, h + 1.9, tz + 1.5, 8);
    // Mid walkway ring
    this.cyl(steel, r + 0.35, r + 0.35, 0.28, tx, 6.2, tz, 20);
    this.box(dark, 0.2, 1.1, 0.2, tx + r + 0.25, 6.9, tz);
    this.box(dark, 0.2, 1.1, 0.2, tx - r - 0.25, 6.9, tz);
    // Ladder + cage
    this.box(dark, 0.35, h + 0.5, 0.35, tx + r + 0.55, h * 0.5 + 0.2, tz);
    this.box(steel, 0.12, h + 0.3, 0.55, tx + r + 0.9, h * 0.5 + 0.2, tz);
    for (let s = 0; s < 8; s++) {
      this.box(rivet, 0.55, 0.08, 0.12, tx + r + 0.7, 1.2 + s * 1.35, tz);
    }
    // Base skirt / drip ring + pad
    this.cyl(concrete, r + 1.2, r + 1.2, 0.35, tx, 0.25, tz, 18);
    this.cyl(dark, r + 0.15, r + 0.15, 0.4, tx, 0.5, tz, 18);
    // Bottom nozzle to manifold
    this.box(steel, 0.4, 0.4, 2.2, tx, 1.1, tz + r * 0.55);
    this.cyl(dark, 0.5, 0.5, 0.55, tx, 1.1, tz + r * 0.9, 10);
  }

  private buildAmmo(
    concrete: MeshStandardMaterial,
    earth: MeshStandardMaterial,
    dark: MeshStandardMaterial,
    steel: MeshStandardMaterial,
    rivet: MeshStandardMaterial,
    accent: MeshStandardMaterial,
  ): void {
    for (let i = 0; i < 4; i++) {
      this.addAmmoBunker(-1100, 200 + i * 80, concrete, earth, dark, steel, rivet, accent);
    }
  }

  /** Earth-covered ammo magazine — berm, blast face, wing walls, vault door. */
  private addAmmoBunker(
    lx: number,
    lz: number,
    concrete: MeshStandardMaterial,
    earth: MeshStandardMaterial,
    dark: MeshStandardMaterial,
    steel: MeshStandardMaterial,
    rivet: MeshStandardMaterial,
    accent: MeshStandardMaterial,
  ): void {
    const depth = 30;
    const zFace = lz - depth * 0.5;

    // Mounded earth cover (main berm + rounded crown)
    this.box(earth, 24, 5.8, depth + 2, lx, 2.95, lz + 1);
    this.cyl(earth, 12, 14.5, 6.2, lx, 3.4, lz + 2, 14);
    this.box(earth, 28, 3.2, depth * 0.55, lx, 1.7, lz + 6);

    // Interior concrete shell (reads through entrance)
    this.box(concrete, 14, 4.8, depth - 4, lx, 2.5, lz + 1);
    this.box(concrete, 14.5, 0.55, depth - 3, lx, 5.05, lz + 1);

    // Blast face wall + lintel
    this.box(concrete, 18, 5.6, 1.4, lx, 2.9, zFace);
    this.box(concrete, 18.5, 0.55, 1.8, lx, 5.85, zFace - 0.1);
    // Twin vault doors with stiffeners
    for (const side of [-1, 1] as const) {
      const cx = lx + side * 3.2;
      this.box(dark, 5.6, 4.4, 0.45, cx, 2.4, zFace - 0.85);
      this.box(rivet, 5.0, 0.18, 0.5, cx, 1.6, zFace - 0.55);
      this.box(rivet, 5.0, 0.18, 0.5, cx, 3.2, zFace - 0.55);
      this.box(steel, 0.2, 4.0, 0.5, cx - 1.6, 2.4, zFace - 0.5);
      this.box(steel, 0.2, 4.0, 0.5, cx + 1.6, 2.4, zFace - 0.5);
      // Hinge posts
      this.box(steel, 0.45, 4.8, 0.55, lx + side * 6.2, 2.55, zFace - 0.4);
    }
    // Center mullion / lock bar
    this.box(steel, 0.35, 4.5, 0.55, lx, 2.45, zFace - 0.7);

    // Wing / retaining walls (blast channel)
    this.box(concrete, 2.4, 4.8, 12, lx - 10.2, 2.5, zFace - 4);
    this.box(concrete, 2.4, 4.8, 12, lx + 10.2, 2.5, zFace - 4);
    this.box(concrete, 2.8, 0.4, 12.4, lx - 10.2, 5.05, zFace - 4);
    this.box(concrete, 2.8, 0.4, 12.4, lx + 10.2, 5.05, zFace - 4);

    // Threshold sill + apron + tire guides
    this.box(concrete, 16, 0.3, 1.6, lx, 0.2, zFace - 1.2);
    this.box(concrete, 18, 0.1, 14, lx, 0.08, zFace - 9);
    this.box(steel, 0.22, 0.18, 8, lx - 3.5, 0.22, zFace - 6);
    this.box(steel, 0.22, 0.18, 8, lx + 3.5, 0.22, zFace - 6);
    this.box(dark, 16, 0.14, 0.5, lx, 0.12, zFace - 2.2);

    // Rear / roof vents + lightning masts
    this.cyl(dark, 0.45, 0.55, 2.4, lx - 4, 6.6, lz + 8, 8);
    this.cyl(dark, 0.45, 0.55, 2.4, lx + 4, 6.6, lz + 8, 8);
    this.cyl(steel, 0.12, 0.12, 14, lx - 7, 8.5, lz + 6, 6);
    this.cyl(steel, 0.12, 0.12, 14, lx + 7, 8.5, lz + 6, 6);
    this.cyl(accent, 0.2, 0.05, 0.55, lx - 7, 15.6, lz + 6, 6);
    this.cyl(accent, 0.2, 0.05, 0.55, lx + 7, 15.6, lz + 6, 6);

    // Warning posts at apron corners
    for (const [dx, dz] of [
      [-9, -16],
      [9, -16],
    ] as const) {
      this.cyl(accent, 0.18, 0.18, 1.5, lx + dx, 0.85, zFace + dz, 6);
      this.box(dark, 0.35, 0.12, 0.35, lx + dx, 1.65, zFace + dz);
    }
  }

  private buildAdmin(
    concrete: MeshStandardMaterial,
    dark: MeshStandardMaterial,
    glass: MeshStandardMaterial,
    accent: MeshStandardMaterial,
    mark: MeshStandardMaterial,
    steel: MeshStandardMaterial,
    rivet: MeshStandardMaterial,
  ): void {
    this.addHq(concrete, dark, glass, accent, steel, rivet);
    this.addBarracksRow(concrete, dark, glass, steel, rivet);
    this.addFireStation(concrete, dark, glass, accent, steel, rivet);
    this.addHelipads(concrete, mark, dark, steel, accent);
    this.addMainGate(concrete, dark, glass, steel, accent);
  }

  private addHq(
    concrete: MeshStandardMaterial,
    dark: MeshStandardMaterial,
    glass: MeshStandardMaterial,
    accent: MeshStandardMaterial,
    steel: MeshStandardMaterial,
    rivet: MeshStandardMaterial,
  ): void {
    const lx = 420;
    const lz = 520;
    // Plinth + massing
    this.box(concrete, 52, 0.45, 32, lx, 0.25, lz);
    this.box(concrete, 48, 11.4, 28, lx, 5.95, lz);
    // Parapet / roof deck
    this.box(concrete, 49, 0.55, 29, lx, 11.9, lz);
    this.box(dark, 46, 0.2, 26, lx, 12.2, lz);
    // Entrance canopy + doors
    this.box(steel, 14, 0.35, 5, lx, 3.6, lz - 16.5);
    this.box(steel, 0.35, 3.4, 0.35, lx - 6.5, 1.85, lz - 15.5);
    this.box(steel, 0.35, 3.4, 0.35, lx + 6.5, 1.85, lz - 15.5);
    this.box(dark, 3.6, 3.0, 0.25, lx - 2.1, 1.7, lz - 14.15);
    this.box(dark, 3.6, 3.0, 0.25, lx + 2.1, 1.7, lz - 14.15);
    // Curtain windows south facade
    for (let row = 0; row < 2; row++) {
      for (let c = 0; c < 6; c++) {
        const wx = lx - 20 + c * 7;
        const wy = 3.7 + row * 3.8;
        this.box(glass, 3.2, 1.8, 0.12, wx, wy, lz - 14.1);
        this.box(rivet, 3.4, 0.12, 0.18, wx, wy + 1.0, lz - 14.0);
        this.box(rivet, 3.4, 0.12, 0.18, wx, wy - 1.0, lz - 14.0);
      }
    }
    // Side strip windows
    for (let c = 0; c < 4; c++) {
      this.box(glass, 0.12, 1.6, 3.5, lx - 24.05, 4.2, lz - 8 + c * 5);
      this.box(glass, 0.12, 1.6, 3.5, lx + 24.05, 4.2, lz - 8 + c * 5);
    }
    // Roof plant + flag mast
    this.box(dark, 6, 1.5, 4.2, lx - 10, 12.95, lz + 2);
    this.box(dark, 6, 1.5, 4.2, lx + 10, 12.95, lz - 4);
    this.box(rivet, 3.2, 1.1, 2.4, lx, 12.85, lz);
    this.cyl(steel, 0.12, 0.12, 9, lx + 18, 16.5, lz + 8, 6);
    this.box(accent, 1.6, 0.9, 0.08, lx + 18.7, 20.2, lz + 8);
    // Front plaza
    this.box(concrete, 36, 0.1, 16, lx, 0.08, lz - 24);
  }

  private addBarracksRow(
    concrete: MeshStandardMaterial,
    dark: MeshStandardMaterial,
    glass: MeshStandardMaterial,
    steel: MeshStandardMaterial,
    rivet: MeshStandardMaterial,
  ): void {
    for (const lx of [280, 360, 440, 520]) {
      const lz = 620;
      this.box(concrete, 18, 0.35, 48, lx, 0.2, lz);
      this.box(concrete, 16, 10.5, 44, lx, 5.45, lz);
      // Roof + parapet
      this.box(concrete, 16.8, 0.4, 44.8, lx, 10.9, lz);
      this.box(dark, 15.5, 0.15, 43, lx, 11.2, lz);
      this.box(dark, 3.8, 1.2, 2.8, lx, 11.85, lz);
      this.box(rivet, 2.4, 0.9, 2.0, lx, 11.75, lz + 8);
      // Stair core end
      this.box(concrete, 4.5, 11.2, 6, lx, 5.7, lz + 24);
      this.box(dark, 1.8, 2.4, 0.2, lx, 1.4, lz + 27.1);
      // Entrance
      this.box(steel, 5, 0.25, 2.5, lx, 3.1, lz - 22.8);
      this.box(dark, 2.4, 2.6, 0.2, lx, 1.5, lz - 22.15);
      for (let floor = 0; floor < 3; floor++) {
        for (let w = 0; w < 5; w++) {
          const wx = lx - 6 + w * 3;
          const wy = 2.4 + floor * 3.2;
          this.box(glass, 2.2, 1.4, 0.1, wx, wy, lz - 22.15);
          this.box(rivet, 2.35, 0.1, 0.14, wx, wy - 0.8, lz - 22.05);
        }
      }
      // Side windows
      for (let floor = 0; floor < 3; floor++) {
        for (let w = 0; w < 6; w++) {
          this.box(glass, 0.1, 1.2, 2.0, lx - 8.05, 2.6 + floor * 3.2, lz - 16 + w * 6);
        }
      }
      // Walkway apron
      this.box(concrete, 22, 0.08, 10, lx, 0.06, lz - 28);
    }
  }

  private addFireStation(
    concrete: MeshStandardMaterial,
    dark: MeshStandardMaterial,
    glass: MeshStandardMaterial,
    accent: MeshStandardMaterial,
    steel: MeshStandardMaterial,
    rivet: MeshStandardMaterial,
  ): void {
    const lx = 180;
    const lz = 200;
    this.box(concrete, 46, 0.3, 34, lx, 0.18, lz);
    this.box(concrete, 42, 9, 28, lx, 4.7, lz);
    this.box(concrete, 43, 0.4, 29, lx, 9.4, lz);
    // Apparatus bay doors (4)
    for (let i = 0; i < 4; i++) {
      const bx = lx - 15 + i * 10;
      this.box(dark, 7.5, 5.6, 0.3, bx, 3.1, lz - 14.15);
      this.box(steel, 7.2, 0.2, 0.35, bx, 5.95, lz - 13.9);
      this.box(rivet, 0.15, 5.2, 0.35, bx - 2.2, 3.1, lz - 13.9);
      this.box(rivet, 0.15, 5.2, 0.35, bx + 2.2, 3.1, lz - 13.9);
    }
    // Door track housing
    this.box(steel, 40, 0.7, 1.2, lx, 6.5, lz - 14.6);
    // Hose tower
    this.box(accent, 6.2, 14, 6.2, lx + 18, 7.2, lz + 6);
    this.box(dark, 5.4, 0.35, 5.4, lx + 18, 14.4, lz + 6);
    this.box(glass, 1.6, 1.4, 0.12, lx + 18, 10.5, lz + 2.95);
    this.box(glass, 0.12, 1.4, 1.6, lx + 14.95, 10.5, lz + 6);
    // Office wing windows
    for (let c = 0; c < 3; c++) {
      this.box(glass, 2.8, 1.5, 0.1, lx - 12 + c * 6, 6.8, lz + 14.05);
    }
    // Apron + striping
    this.box(concrete, 48, 0.1, 18, lx, 0.08, lz - 24);
    for (let i = 0; i < 4; i++) {
      this.box(accent, 0.35, 0.05, 10, lx - 15 + i * 10, 0.14, lz - 22);
    }
  }

  private addHelipads(
    concrete: MeshStandardMaterial,
    mark: MeshStandardMaterial,
    dark: MeshStandardMaterial,
    steel: MeshStandardMaterial,
    accent: MeshStandardMaterial,
  ): void {
    const pads = [
      [680, 420],
      [760, 420],
      [680, 500],
      [760, 500],
    ] as const;
    for (const [lx, lz] of pads) {
      // Pad disk + raised lip
      this.cyl(concrete, 13.2, 13.2, 0.22, lx, 0.14, lz, 28);
      this.cyl(dark, 13.5, 13.5, 0.08, lx, 0.06, lz, 28);
      this.cyl(mark, 11.4, 11.4, 0.04, lx, 0.26, lz, 28);
      // H mark
      this.box(mark, 1.3, 0.06, 8.2, lx - 2.3, 0.3, lz);
      this.box(mark, 1.3, 0.06, 8.2, lx + 2.3, 0.3, lz);
      this.box(mark, 5.8, 0.06, 1.3, lx, 0.3, lz);
      // Perimeter lights
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        this.cyl(accent, 0.18, 0.18, 0.35, lx + Math.cos(a) * 12.2, 0.4, lz + Math.sin(a) * 12.2, 6);
      }
      // Taxi stub
      this.box(concrete, 10, 0.1, 26, lx - 22, 0.08, lz);
    }
    // Shared windsock mast between pads
    this.cyl(steel, 0.15, 0.15, 8, 720, 4.2, 460, 6);
    this.box(accent, 2.4, 0.8, 0.15, 721.4, 7.6, 460);
    // FATO edge markers
    this.box(concrete, 100, 0.08, 2, 720, 0.06, 380);
    this.box(concrete, 2, 0.08, 140, 640, 0.06, 460);
  }

  private addMainGate(
    concrete: MeshStandardMaterial,
    dark: MeshStandardMaterial,
    glass: MeshStandardMaterial,
    steel: MeshStandardMaterial,
    accent: MeshStandardMaterial,
  ): void {
    this.box(concrete, 10, 3.8, 7, 0, 2.0, 820);
    this.box(dark, 3.2, 2.4, 0.25, 0, 1.5, 816.4);
    this.box(glass, 1.8, 1.2, 0.1, 0, 2.8, 816.35);
    this.box(steel, 1.2, 4.5, 1.2, -6, 2.4, 820);
    this.box(steel, 1.2, 4.5, 1.2, 6, 2.4, 820);
    this.box(steel, 14, 0.35, 0.35, 0, 4.8, 820);
    this.box(dark, 42, 2.4, 0.3, -28, 1.3, 820);
    this.box(dark, 42, 2.4, 0.3, 28, 1.3, 820);
    this.box(accent, 1.5, 1.0, 0.12, -8, 3.6, 816.5);
    this.box(concrete, 24, 0.1, 16, 0, 0.08, 808);
  }
}
