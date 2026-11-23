import { Aircraft } from "@afd/shared-types";
import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  ConeGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  RingGeometry,
  Sprite,
  SpriteMaterial,
} from "three";

export type NozzleLayout = { twin: boolean; x: number; z: number };

/** Same offsets as JetModel nozzles — local aft = +Z. */
export const EXHAUST_NOZZLES: Record<Aircraft, NozzleLayout> = {
  [Aircraft.F22_RAPTOR]: { twin: true, x: 0.42, z: 4.15 },
  [Aircraft.F15_EAGLE]: { twin: true, x: 0.7, z: 4.2 },
  [Aircraft.F16_FALCON]: { twin: false, x: 0, z: 4.05 },
  [Aircraft.FA18_SUPER_HORNET]: { twin: true, x: 0.55, z: 4.15 },
  [Aircraft.TYPHOON]: { twin: true, x: 0.5, z: 4.1 },
  [Aircraft.RAFALE]: { twin: true, x: 0.5, z: 4.1 },
  [Aircraft.SU35]: { twin: true, x: 0.65, z: 4.2 },
  [Aircraft.F35_LIGHTNING]: { twin: false, x: 0, z: 4.1 },
  [Aircraft.F14_TOMCAT]: { twin: true, x: 0.55, z: 4.2 },
  [Aircraft.GRIPEN]: { twin: false, x: 0, z: 4.05 },
  [Aircraft.MIRAGE_2000]: { twin: false, x: 0, z: 4.05 },
  [Aircraft.F2]: { twin: false, x: 0, z: 4.05 },
  [Aircraft.MIG29]: { twin: true, x: 0.55, z: 4.15 },
  [Aircraft.MIG35]: { twin: true, x: 0.55, z: 4.15 },
  [Aircraft.SU57]: { twin: true, x: 0.55, z: 4.2 },
  [Aircraft.YF23]: { twin: true, x: 0.45, z: 4.1 },
  [Aircraft.F4_PHANTOM]: { twin: true, x: 0.5, z: 4.15 },
  [Aircraft.SU34]: { twin: true, x: 0.6, z: 4.2 },
  [Aircraft.A10]: { twin: true, x: 0.7, z: 4.0 },
  [Aircraft.B2]: { twin: true, x: 0.8, z: 3.6 },
  [Aircraft.U2]: { twin: false, x: 0, z: 4.2 },
};

interface EnginePlume {
  root: Group;
  core: Mesh;
  sheath: Mesh;
  diamonds: Mesh[];
  haze: Sprite;
}

function glowTexture(): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const g = c.getContext("2d");
  if (g) {
    const grd = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    grd.addColorStop(0, "rgba(255,255,255,0.95)");
    grd.addColorStop(0.35, "rgba(255,180,80,0.55)");
    grd.addColorStop(1, "rgba(255,80,20,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
  }
  const tex = new CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

function makeConeMat(color: number, opacity: number): MeshBasicMaterial {
  return new MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
  });
}

/**
 * Near-field afterburner: core plume, sheath, shock diamonds, soft haze.
 * Lives in jet local space (aft = +Z). Intensity lerps with AB.
 */
export class ExhaustFx {
  readonly group = new Group();
  private intensity = 0;
  private want = 0;
  private readonly engines: EnginePlume[] = [];
  private readonly glowMap: CanvasTexture;
  private time = 0;

  constructor(aircraft: Aircraft) {
    this.group.name = "ExhaustFx";
    this.glowMap = glowTexture();
    const layout = EXHAUST_NOZZLES[aircraft] ?? EXHAUST_NOZZLES[Aircraft.F22_RAPTOR]!;
    if (layout.twin) {
      this.engines.push(this.buildEngine(-layout.x, layout.z));
      this.engines.push(this.buildEngine(layout.x, layout.z));
    } else {
      this.engines.push(this.buildEngine(0, layout.z));
    }
    this.group.visible = false;
  }

  setActive(on: boolean): void {
    this.want = on ? 1 : 0;
  }

  update(dt: number): void {
    this.time += dt;
    const rate = this.want > this.intensity ? 12 : 5.5;
    const k = 1 - Math.exp(-rate * dt);
    this.intensity += (this.want - this.intensity) * k;
    const t = this.intensity;
    this.group.visible = t > 0.02;
    if (!this.group.visible) return;

    const pulse = 0.92 + Math.sin(this.time * 28) * 0.08;
    const len = 0.35 + t * 2.4 * pulse;
    const width = 0.45 + t * 0.55;

    for (const e of this.engines) {
      e.core.scale.set(width * 0.55, len, width * 0.55);
      e.sheath.scale.set(width, len * 1.15, width);
      (e.core.material as MeshBasicMaterial).opacity = 0.55 + t * 0.4;
      (e.sheath.material as MeshBasicMaterial).opacity = 0.18 + t * 0.35;

      for (let i = 0; i < e.diamonds.length; i++) {
        const d = e.diamonds[i]!;
        const along = 0.55 + i * 0.55 * (0.85 + t * 0.35);
        d.position.z = along;
        const s = (0.12 + t * 0.16) * (1 - i * 0.12) * pulse;
        d.scale.set(s, s, s);
        (d.material as MeshBasicMaterial).opacity = t * (0.55 - i * 0.12) * pulse;
      }

      e.haze.position.z = 0.9 + t * 1.2;
      e.haze.scale.setScalar(1.2 + t * 2.2);
      (e.haze.material as SpriteMaterial).opacity = t * 0.35;
    }
  }

  dispose(): void {
    this.group.traverse((obj) => {
      if (obj instanceof Mesh) {
        obj.geometry.dispose();
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) m.dispose();
      }
      if (obj instanceof Sprite) {
        const mat = obj.material as SpriteMaterial;
        mat.map = null;
        mat.dispose();
      }
    });
    this.glowMap.dispose();
  }

  private buildEngine(x: number, z: number): EnginePlume {
    const root = new Group();
    root.position.set(x, 0.02, z);

    // ConeGeometry: tip at +Y/2 — rotate so tip points aft (+Z).
    const coreGeo = new ConeGeometry(0.35, 1, 8, 1, true);
    const core = new Mesh(coreGeo, makeConeMat(0xfff0c8, 0.7));
    // Tip (+Y) → aft (+Z)
    core.rotation.x = -Math.PI * 0.5;
    core.position.z = 0.55;
    root.add(core);

    const sheathGeo = new ConeGeometry(0.55, 1, 10, 1, true);
    const sheath = new Mesh(sheathGeo, makeConeMat(0xff6a18, 0.35));
    sheath.rotation.x = -Math.PI * 0.5;
    sheath.position.z = 0.65;
    root.add(sheath);

    const diamonds: Mesh[] = [];
    for (let i = 0; i < 3; i++) {
      const ring = new Mesh(
        new RingGeometry(0.08, 0.22, 16),
        new MeshBasicMaterial({
          color: new Color(0xffe6a0),
          transparent: true,
          opacity: 0.4,
          depthWrite: false,
          blending: AdditiveBlending,
          side: DoubleSide,
        }),
      );
      // Ring in XY faces aft (+Z) — readable from chase.
      diamonds.push(ring);
      root.add(ring);
    }

    const haze = new Sprite(
      new SpriteMaterial({
        map: this.glowMap,
        color: 0xffa040,
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    );
    haze.position.set(0, 0, 1.2);
    root.add(haze);

    // Tiny plane for slight “heat sheet” without post-process.
    const sheet = new Mesh(
      new PlaneGeometry(0.8, 1.6),
      new MeshBasicMaterial({
        color: 0xff8040,
        transparent: true,
        opacity: 0.08,
        depthWrite: false,
        blending: AdditiveBlending,
        side: DoubleSide,
      }),
    );
    sheet.rotation.y = Math.PI * 0.5;
    sheet.position.z = 1.1;
    root.add(sheet);

    this.group.add(root);
    return { root, core, sheath, diamonds, haze };
  }
}
