import { Aircraft } from "@afd/shared-types";
import {
  AdditiveBlending,
  CanvasTexture,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
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
  coreV: Mesh;
  coreH: Mesh;
  sheathV: Mesh;
  sheathH: Mesh;
  diamonds: Mesh[];
  haze: Sprite[];
}

function makeRadialGlow(
  inner: string,
  mid: string,
  outer: string,
): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const g = c.getContext("2d");
  if (g) {
    const grd = g.createRadialGradient(32, 32, 1, 32, 32, 30);
    grd.addColorStop(0, inner);
    grd.addColorStop(0.4, mid);
    grd.addColorStop(1, outer);
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
  }
  const tex = new CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

/** Soft flame streak along +Y on the canvas (tip at top). */
function makeFlameStreak(
  core: string,
  mid: string,
  rim: string,
): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 128;
  const g = c.getContext("2d");
  if (g) {
    g.clearRect(0, 0, 64, 128);
    for (let y = 0; y < 128; y++) {
      const t = y / 127;
      const edge = Math.sin(Math.PI * (1 - t));
      const w = 4 + edge * 26;
      const cx = 32;
      const aCore = Math.pow(1 - t, 0.55);
      const aMid = Math.pow(1 - t, 0.85) * 0.85;
      const grd = g.createRadialGradient(cx, y, 0, cx, y, w);
      grd.addColorStop(0, core.replace("ALPHA", String(aCore)));
      grd.addColorStop(0.45, mid.replace("ALPHA", String(aMid)));
      grd.addColorStop(1, rim.replace("ALPHA", "0"));
      g.fillStyle = grd;
      g.fillRect(cx - w, y, w * 2, 1.5);
    }
  }
  const tex = new CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

function makeDiamondTex(): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const g = c.getContext("2d");
  if (g) {
    g.clearRect(0, 0, 64, 64);
    g.beginPath();
    g.moveTo(32, 4);
    g.lineTo(52, 32);
    g.lineTo(32, 60);
    g.lineTo(12, 32);
    g.closePath();
    const grd = g.createRadialGradient(32, 32, 2, 32, 32, 28);
    grd.addColorStop(0, "rgba(255,255,240,0.95)");
    grd.addColorStop(0.4, "rgba(255,200,100,0.65)");
    grd.addColorStop(1, "rgba(255,80,20,0)");
    g.fillStyle = grd;
    g.fill();
  }
  const tex = new CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

function flameMat(map: CanvasTexture, color: number, opacity: number): MeshBasicMaterial {
  return new MeshBasicMaterial({
    map,
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
  });
}

/**
 * Near-field afterburner: crossed flame sheets, throat glow, shock diamonds.
 * Lives in jet local space (aft = +Z). Intensity lerps with AB.
 */
export class ExhaustFx {
  readonly group = new Group();
  private intensity = 0;
  private want = 0;
  private readonly engines: EnginePlume[] = [];
  private readonly throatMap: CanvasTexture;
  private readonly flameMap: CanvasTexture;
  private readonly sheathMap: CanvasTexture;
  private readonly diamondMap: CanvasTexture;
  private readonly hazeMap: CanvasTexture;
  private time = 0;
  readonly layout: NozzleLayout;

  constructor(aircraft: Aircraft) {
    this.group.name = "ExhaustFx";
    this.layout =
      EXHAUST_NOZZLES[aircraft] ?? EXHAUST_NOZZLES[Aircraft.F22_RAPTOR]!;
    this.throatMap = makeRadialGlow(
      "rgba(255,255,255,1)",
      "rgba(255,210,120,0.7)",
      "rgba(255,80,20,0)",
    );
    this.flameMap = makeFlameStreak(
      "rgba(255,255,240,ALPHA)",
      "rgba(255,170,60,ALPHA)",
      "rgba(255,60,10,ALPHA)",
    );
    this.sheathMap = makeFlameStreak(
      "rgba(255,160,60,ALPHA)",
      "rgba(255,70,20,ALPHA)",
      "rgba(180,30,0,ALPHA)",
    );
    this.diamondMap = makeDiamondTex();
    this.hazeMap = makeRadialGlow(
      "rgba(255,180,80,0.55)",
      "rgba(255,90,30,0.25)",
      "rgba(255,40,0,0)",
    );

    if (this.layout.twin) {
      this.engines.push(this.buildEngine(-this.layout.x, this.layout.z));
      this.engines.push(this.buildEngine(this.layout.x, this.layout.z));
    } else {
      this.engines.push(this.buildEngine(0, this.layout.z));
    }
    this.group.visible = false;
  }

  /** World-local nozzle anchors for wake ribbons (jet space). */
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

  setActive(on: boolean): void {
    this.want = on ? 1 : 0;
  }

  update(dt: number): void {
    this.time += dt;
    const rate = this.want > this.intensity ? 14 : 6;
    const k = 1 - Math.exp(-rate * dt);
    this.intensity += (this.want - this.intensity) * k;
    const t = this.intensity;
    this.group.visible = t > 0.015;
    if (!this.group.visible) return;

    const flicker =
      0.88 +
      Math.sin(this.time * 37) * 0.07 +
      Math.sin(this.time * 61.3) * 0.05;
    const len = 1.1 + t * 3.6 * flicker;
    const width = 0.55 + t * 0.85;

    for (const e of this.engines) {
      const throatOp = 0.35 + t * 0.65 * flicker;
      e.throat.scale.setScalar(0.7 + t * 1.35);
      (e.throat.material as SpriteMaterial).opacity = throatOp;

      const coreOp = 0.45 + t * 0.55;
      const sheathOp = 0.22 + t * 0.45;
      for (const m of [e.coreV, e.coreH]) {
        m.scale.set(width * 0.7, len, 1);
        m.position.z = len * 0.48;
        (m.material as MeshBasicMaterial).opacity = coreOp * flicker;
      }
      for (const m of [e.sheathV, e.sheathH]) {
        m.scale.set(width * 1.25, len * 1.2, 1);
        m.position.z = len * 0.55;
        (m.material as MeshBasicMaterial).opacity = sheathOp;
      }

      for (let i = 0; i < e.diamonds.length; i++) {
        const d = e.diamonds[i]!;
        const along = 0.7 + i * (0.7 + t * 0.55);
        d.position.z = along;
        const s = (0.22 + t * 0.28) * (1 - i * 0.14) * flicker;
        d.scale.set(s * 0.85, s * 1.35, 1);
        (d.material as MeshBasicMaterial).opacity =
          t * (0.7 - i * 0.14) * flicker;
        d.visible = t > 0.2;
      }

      for (let i = 0; i < e.haze.length; i++) {
        const h = e.haze[i]!;
        const along = 1.2 + i * 1.1 + t * 0.8;
        h.position.z = along;
        h.scale.setScalar(1.4 + t * 2.8 + i * 0.6);
        (h.material as SpriteMaterial).opacity =
          t * (0.28 - i * 0.07) * flicker;
      }
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
    this.throatMap.dispose();
    this.flameMap.dispose();
    this.sheathMap.dispose();
    this.diamondMap.dispose();
    this.hazeMap.dispose();
  }

  private buildEngine(x: number, z: number): EnginePlume {
    const root = new Group();
    root.position.set(x, this.layout.y ?? 0, z);

    const throat = new Sprite(
      new SpriteMaterial({
        map: this.throatMap,
        color: 0xfff2c8,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    );
    throat.position.set(0, 0, 0.05);
    root.add(throat);

    // Crossed flame sheets: plane local +Y becomes aft (+Z).
    const coreGeo = new PlaneGeometry(1, 1);
    const coreV = new Mesh(coreGeo, flameMat(this.flameMap, 0xfff4d0, 0.7));
    coreV.rotation.x = -Math.PI * 0.5;
    root.add(coreV);

    const coreH = new Mesh(
      coreGeo.clone(),
      flameMat(this.flameMap, 0xffe8a0, 0.55),
    );
    coreH.rotation.x = -Math.PI * 0.5;
    coreH.rotation.z = Math.PI * 0.5;
    root.add(coreH);

    const sheathV = new Mesh(
      coreGeo.clone(),
      flameMat(this.sheathMap, 0xff7a28, 0.4),
    );
    sheathV.rotation.x = -Math.PI * 0.5;
    root.add(sheathV);

    const sheathH = new Mesh(
      coreGeo.clone(),
      flameMat(this.sheathMap, 0xff5510, 0.32),
    );
    sheathH.rotation.x = -Math.PI * 0.5;
    sheathH.rotation.z = Math.PI * 0.5;
    root.add(sheathH);

    const diamonds: Mesh[] = [];
    for (let i = 0; i < 4; i++) {
      const d = new Mesh(
        new PlaneGeometry(1, 1),
        new MeshBasicMaterial({
          map: this.diamondMap,
          color: 0xffe8b0,
          transparent: true,
          opacity: 0.5,
          depthWrite: false,
          blending: AdditiveBlending,
          side: DoubleSide,
        }),
      );
      // Face roughly camera from chase (XY), still readable aft.
      diamonds.push(d);
      root.add(d);
    }

    const haze: Sprite[] = [];
    for (let i = 0; i < 3; i++) {
      const h = new Sprite(
        new SpriteMaterial({
          map: this.hazeMap,
          color: 0xff9030,
          transparent: true,
          opacity: 0.2,
          depthWrite: false,
          blending: AdditiveBlending,
        }),
      );
      haze.push(h);
      root.add(h);
    }

    this.group.add(root);
    return {
      root,
      throat,
      coreV,
      coreH,
      sheathV,
      sheathH,
      diamonds,
      haze,
    };
  }
}
