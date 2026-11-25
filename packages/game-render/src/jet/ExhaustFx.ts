import { Aircraft } from "@afd/shared-types";
import {
  AdditiveBlending,
  CanvasTexture,
  Group,
  Sprite,
  SpriteMaterial,
} from "three";

export type NozzleLayout = { twin: boolean; x: number; z: number; y?: number };

/** Same offsets as JetModel nozzles — local aft = +Z. */
export const EXHAUST_NOZZLES: Record<Aircraft, NozzleLayout> = {
  [Aircraft.F22_RAPTOR]: { twin: true, x: 0.42, z: 4.15, y: 0 },
  [Aircraft.F15_EAGLE]: { twin: true, x: 0.7, z: 4.2, y: 0 },
  [Aircraft.F16_FALCON]: { twin: false, x: 0, z: 4.05, y: 0 },
  [Aircraft.FA18_SUPER_HORNET]: { twin: true, x: 0.55, z: 4.15, y: 0 },
  [Aircraft.TYPHOON]: { twin: true, x: 0.5, z: 4.1, y: 0 },
  [Aircraft.RAFALE]: { twin: true, x: 0.5, z: 4.1, y: 0 },
  [Aircraft.SU35]: { twin: true, x: 0.65, z: 4.2, y: 0 },
  [Aircraft.F35_LIGHTNING]: { twin: false, x: 0, z: 4.1, y: 0 },
  [Aircraft.F14_TOMCAT]: { twin: true, x: 0.55, z: 4.2, y: 0 },
  [Aircraft.GRIPEN]: { twin: false, x: 0, z: 4.05, y: 0 },
  [Aircraft.MIRAGE_2000]: { twin: false, x: 0, z: 4.05, y: 0 },
  [Aircraft.F2]: { twin: false, x: 0, z: 4.05, y: 0 },
  [Aircraft.MIG29]: { twin: true, x: 0.55, z: 4.15, y: 0 },
  [Aircraft.MIG35]: { twin: true, x: 0.55, z: 4.15, y: 0 },
  [Aircraft.SU57]: { twin: true, x: 0.55, z: 4.2, y: 0 },
  [Aircraft.YF23]: { twin: true, x: 0.45, z: 4.1, y: 0 },
  [Aircraft.F4_PHANTOM]: { twin: true, x: 0.5, z: 4.15, y: 0 },
  [Aircraft.SU34]: { twin: true, x: 0.6, z: 4.2, y: 0 },
  [Aircraft.A10]: { twin: true, x: 0.7, z: 4.0, y: 0.15 },
  [Aircraft.B2]: { twin: true, x: 0.8, z: 3.6, y: 0 },
  [Aircraft.U2]: { twin: false, x: 0, z: 4.2, y: 0 },
};

interface EnginePlume {
  root: Group;
  throat: Sprite;
  core: Sprite;
  mid: Sprite[];
  tip: Sprite[];
}

function clamp(v: number, a: number, b: number): number {
  return Math.min(b, Math.max(a, v));
}

function makeSoftOrb(
  r0: string,
  r1: string,
  r2: string,
  size = 128,
): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const g = c.getContext("2d");
  if (g) {
    g.clearRect(0, 0, size, size);
    const cx = size * 0.5;
    const grd = g.createRadialGradient(cx, cx, size * 0.02, cx, cx, size * 0.48);
    grd.addColorStop(0, r0);
    grd.addColorStop(0.35, r1);
    grd.addColorStop(0.72, r2);
    grd.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, size, size);
  }
  const tex = new CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

function makeSoftTeardrop(): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 256;
  const g = c.getContext("2d");
  if (g) {
    g.clearRect(0, 0, 128, 256);
    for (let y = 0; y < 256; y++) {
      const t = y / 255;
      const envelope =
        Math.sin(Math.PI * Math.min(1, t * 1.15)) * Math.pow(1 - t, 0.35);
      const w = 3 + envelope * 48;
      const a = Math.pow(1 - t, 0.55) * envelope;
      const cx = 64;
      const grd = g.createRadialGradient(cx, y, 0, cx, y, w);
      grd.addColorStop(0, `rgba(255,255,245,${(0.95 * a).toFixed(3)})`);
      grd.addColorStop(0.35, `rgba(255,190,90,${(0.7 * a).toFixed(3)})`);
      grd.addColorStop(0.7, `rgba(255,90,25,${(0.35 * a).toFixed(3)})`);
      grd.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = grd;
      g.fillRect(cx - w - 1, y, w * 2 + 2, 2);
    }
  }
  const tex = new CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

function spriteMat(map: CanvasTexture, color: number, opacity: number): SpriteMaterial {
  const mat = new SpriteMaterial({
    map,
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  (mat as SpriteMaterial & { toneMapped?: boolean }).toneMapped = false;
  return mat;
}

/**
 * Soft nozzle plume: cruise glow scales with speed; AB adds long hot wake.
 * Sprite-only (no hard flame planes) so chase-cam never shows orange cards.
 */
export class ExhaustFx {
  readonly group = new Group();
  /** Smoothed 0..1 visual drive (cruise + AB). */
  intensity = 0;
  private want = 0;
  private abWant = 0;
  private abSmooth = 0;
  private readonly engines: EnginePlume[] = [];
  private readonly throatMap: CanvasTexture;
  private readonly coreMap: CanvasTexture;
  private readonly bloomMap: CanvasTexture;
  private readonly plumeMap: CanvasTexture;
  private time = 0;
  readonly layout: NozzleLayout;

  constructor(aircraft: Aircraft) {
    this.group.name = "ExhaustFx";
    this.layout =
      EXHAUST_NOZZLES[aircraft] ?? EXHAUST_NOZZLES[Aircraft.F22_RAPTOR]!;

    this.throatMap = makeSoftOrb(
      "rgba(255,255,255,1)",
      "rgba(255,220,140,0.85)",
      "rgba(255,110,30,0.15)",
      128,
    );
    this.coreMap = makeSoftOrb(
      "rgba(255,255,250,1)",
      "rgba(255,200,110,0.75)",
      "rgba(255,70,15,0.08)",
      128,
    );
    this.bloomMap = makeSoftOrb(
      "rgba(255,170,80,0.65)",
      "rgba(255,90,25,0.28)",
      "rgba(255,40,0,0.04)",
      128,
    );
    this.plumeMap = makeSoftTeardrop();

    if (this.layout.twin) {
      this.engines.push(this.buildEngine(-this.layout.x, this.layout.z));
      this.engines.push(this.buildEngine(this.layout.x, this.layout.z));
    } else {
      this.engines.push(this.buildEngine(0, this.layout.z));
    }
    this.group.visible = false;
  }

  nozzleLocals(): Array<{ x: number; y: number; z: number }> {
    const y = this.layout.y ?? 0;
    if (this.layout.twin) {
      return [
        { x: -this.layout.x, y, z: this.layout.z + 0.35 },
        { x: this.layout.x, y, z: this.layout.z + 0.35 },
      ];
    }
    return [{ x: 0, y, z: this.layout.z + 0.35 }];
  }

  /** @deprecated Prefer setDrive. */
  setActive(on: boolean): void {
    this.setDrive(on, on ? 1 : 0.35);
  }

  /**
   * Cruise plume from speed; afterburner boosts length/heat.
   * speedNorm: 0 idle … ~1 peak (from JetTelemetry).
   */
  setDrive(afterburner: boolean, speedNorm: number): void {
    const sn = clamp(speedNorm, 0, 1.1);
    const cruise = clamp(0.05 + sn * 0.32, 0.05, 0.42);
    this.abWant = afterburner ? 1 : 0;
    this.want = afterburner ? clamp(0.72 + sn * 0.28, 0.72, 1) : cruise;
  }

  update(dt: number): void {
    this.time += dt;
    const up = this.want > this.intensity;
    const rate = up ? 12 : 5.5;
    const k = 1 - Math.exp(-rate * dt);
    this.intensity += (this.want - this.intensity) * k;
    this.abSmooth +=
      (this.abWant - this.abSmooth) * (1 - Math.exp(-(up ? 10 : 4.5) * dt));

    const t = this.intensity;
    const ab = this.abSmooth;
    this.group.visible = t > 0.02;
    if (!this.group.visible) return;

    const flicker =
      0.9 +
      Math.sin(this.time * 29.0) * 0.05 +
      Math.sin(this.time * 47.7) * 0.04 +
      Math.sin(this.time * 71.3) * 0.025;

    const len = 0.55 + t * 1.4 + ab * 3.4 * flicker;
    const heat = t * (0.55 + ab * 0.55);

    for (const e of this.engines) {
      const throatOp = (0.2 + heat * 0.75) * flicker;
      e.throat.scale.setScalar(0.45 + t * 0.55 + ab * 0.55);
      (e.throat.material as SpriteMaterial).opacity = throatOp;
      (e.throat.material as SpriteMaterial).color.setHex(
        ab > 0.35 ? 0xfff4d8 : 0xffd9a0,
      );

      const coreOp = (0.18 + heat * 0.7) * flicker;
      const coreScale = 0.5 + t * 0.7 + ab * 0.9;
      e.core.scale.setScalar(coreScale);
      e.core.position.z = 0.18 + t * 0.35 + ab * 0.55;
      (e.core.material as SpriteMaterial).opacity = coreOp;
      (e.core.material as SpriteMaterial).color.setHex(
        ab > 0.4 ? 0xfff0c8 : 0xffc878,
      );

      for (let i = 0; i < e.mid.length; i++) {
        const s = e.mid[i]!;
        const u = (i + 1) / (e.mid.length + 1);
        const along = 0.35 + len * (0.25 + u * 0.85);
        const fall = Math.pow(1 - u, 0.85);
        s.position.z = along;
        s.scale.setScalar((0.7 + t * 1.1 + ab * 1.6) * (0.55 + fall));
        (s.material as SpriteMaterial).opacity =
          heat * (0.34 - i * 0.07) * fall * flicker;
        s.visible = heat > 0.04;
      }

      for (let i = 0; i < e.tip.length; i++) {
        const s = e.tip[i]!;
        const u = (i + 1) / (e.tip.length + 1);
        const along = 0.9 + len * (0.55 + u * 1.15);
        const fall = Math.pow(1 - u, 1.1);
        s.position.z = along;
        s.scale.setScalar((1.1 + ab * 2.4) * (0.7 + fall));
        (s.material as SpriteMaterial).opacity =
          ab * heat * (0.22 - i * 0.05) * fall * flicker;
        s.visible = ab > 0.12 && heat > 0.08;
      }
    }
  }

  dispose(): void {
    this.group.traverse((obj) => {
      if (obj instanceof Sprite) {
        const mat = obj.material as SpriteMaterial;
        mat.map = null;
        mat.dispose();
      }
    });
    this.throatMap.dispose();
    this.coreMap.dispose();
    this.bloomMap.dispose();
    this.plumeMap.dispose();
  }

  private buildEngine(x: number, z: number): EnginePlume {
    const root = new Group();
    root.position.set(x, this.layout.y ?? 0, z);

    const throat = new Sprite(spriteMat(this.throatMap, 0xfff2c8, 0.4));
    throat.position.set(0, 0, 0.04);
    throat.renderOrder = 3;
    root.add(throat);

    const core = new Sprite(spriteMat(this.coreMap, 0xffe8b0, 0.35));
    core.position.set(0, 0, 0.22);
    core.renderOrder = 3;
    root.add(core);

    const mid: Sprite[] = [];
    for (let i = 0; i < 3; i++) {
      const s = new Sprite(spriteMat(this.coreMap, 0xffc060, 0.2));
      s.renderOrder = 2;
      mid.push(s);
      root.add(s);
    }

    const tip: Sprite[] = [];
    for (let i = 0; i < 3; i++) {
      const s = new Sprite(spriteMat(this.bloomMap, 0xff7020, 0.15));
      s.renderOrder = 1;
      tip.push(s);
      root.add(s);
    }

    this.group.add(root);
    return { root, throat, core, mid, tip };
  }
}