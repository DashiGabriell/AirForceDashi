import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  NormalBlending,
  Object3D,
  PlaneGeometry,
  PointLight,
  SphereGeometry,
  SRGBColorSpace,
} from "three";
import {
  ApplyForce,
  BatchedRenderer,
  Bezier,
  ColorOverLife,
  ConstantColor,
  ConstantValue,
  Gradient,
  IntervalValue,
  ParticleSystem,
  type ParticleSystemParameters,
  PiecewiseBezier,
  HemisphereEmitter,
  PointEmitter,
  RenderMode,
  RotationOverLife,
  SizeOverLife,
  SpeedOverLife,
  SphereEmitter,
  Vector3 as QVector3,
  Vector4 as QVector4,
} from "three.quarks";
import type { QualityProfile } from "@afd/shared-types";

/** Solo vs ar vs água — escolhe camadas e punch sem segundo pool. */
export type BoomSurface = "air" | "ground" | "water";

/** Caps §8.2 — booms simultâneos. */
const BOOM_POOL: Record<QualityProfile, number> = {
  low: 4,
  medium: 8,
  high: 12,
  ultra: 18,
};

const PARTICLE_CAP: Record<QualityProfile, number> = {
  low: 400,
  medium: 1200,
  high: 2500,
  ultra: 4000,
};

/** Luzes pontuais pooled — baratas se poucas; iluminam terreno Lambert. */
const LIGHT_POOL: Record<QualityProfile, number> = {
  low: 1,
  medium: 2,
  high: 3,
  ultra: 5,
};

const LITE_DIST = 480;
const LITE_DIST_SQ = LITE_DIST * LITE_DIST;
const MESH_PUNCH_LIFE = 0.42;

const TILE = {
  glow: 0,
  ring: 1,
  smoke: 2,
  ember: 3,
} as const;

type LayerKind =
  | "core"
  | "flash"
  | "shock"
  | "fireball"
  | "sparks"
  | "embers"
  | "smoke"
  | "debris"
  | "dust"
  | "spray";

type BoomLayer = {
  kind: LayerKind;
  system: ParticleSystem;
};

type BoomSlot = {
  layers: BoomLayer[];
  busy: boolean;
  ttl: number;
  surface: BoomSurface;
  /** Punch mesh (flash + anel) — custo fixo, zero partículas. */
  flash: Mesh;
  ring: Mesh;
  flashMat: MeshBasicMaterial;
  ringMat: MeshBasicMaterial;
  meshAge: number;
  meshActive: boolean;
  flashEnd: number;
  ringEnd: number;
  flashPeakOp: number;
  ringPeakOp: number;
};

type LightSlot = {
  light: PointLight;
  busy: boolean;
  age: number;
  life: number;
  peak: number;
};

export type BoomVfxStats = {
  particles: number;
  booms: number;
  dropped: number;
  poolSize: number;
  free: number;
};

const LITE_KINDS = new Set<LayerKind>(["core", "flash", "sparks", "fireball"]);

function createBoomAtlas(): CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, size, size);
    const cell = size / 2;

    // Tile 0 — glow quente
    {
      const cx = cell * 0.5;
      const cy = cell * 0.5;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, cell * 0.49);
      g.addColorStop(0, "rgba(255,255,255,1)");
      g.addColorStop(0.12, "rgba(255,250,220,1)");
      g.addColorStop(0.32, "rgba(255,190,80,0.95)");
      g.addColorStop(0.58, "rgba(255,90,20,0.55)");
      g.addColorStop(0.82, "rgba(180,30,5,0.18)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, cell, cell);
    }

    // Tile 1 — anel shock
    {
      const cx = cell + cell * 0.5;
      const cy = cell * 0.5;
      const r = cell * 0.44;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.arc(cx, cy, r * 0.78, 0, Math.PI * 2, true);
      ctx.clip();
      const g = ctx.createRadialGradient(cx, cy, r * 0.7, cx, cy, r);
      g.addColorStop(0, "rgba(255,255,255,0)");
      g.addColorStop(0.4, "rgba(255,240,180,1)");
      g.addColorStop(0.75, "rgba(255,140,40,0.7)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(cell, 0, cell, cell);
      ctx.restore();
    }

    // Tile 2 — fumaça volumétrica (blobs densos)
    {
      const ox = 0;
      const oy = cell;
      for (let i = 0; i < 48; i++) {
        const px = ox + Math.random() * cell;
        const py = oy + Math.random() * cell;
        const rr = cell * (0.1 + Math.random() * 0.28);
        const a = 0.1 + Math.random() * 0.4;
        const g = ctx.createRadialGradient(px, py, 0, px, py, rr);
        g.addColorStop(0, `rgba(230,220,210,${a})`);
        g.addColorStop(0.45, `rgba(120,115,110,${a * 0.5})`);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(px, py, rr, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Tile 3 — ember / streak
    {
      const cx = cell + cell * 0.5;
      const cy = cell + cell * 0.5;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, cell * 0.42);
      g.addColorStop(0, "rgba(255,255,240,1)");
      g.addColorStop(0.2, "rgba(255,200,70,1)");
      g.addColorStop(0.5, "rgba(255,80,15,0.55)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(cx, cy, cell * 0.16, cell * 0.44, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** Textura dedicada ao anel mesh (full-bleed, sem tile). */
function createRingTexture(): CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, size, size);
    const cx = size * 0.5;
    const cy = size * 0.5;
    const r = size * 0.48;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.arc(cx, cy, r * 0.82, 0, Math.PI * 2, true);
    ctx.clip();
    const g = ctx.createRadialGradient(cx, cy, r * 0.78, cx, cy, r);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.35, "rgba(255,245,200,1)");
    g.addColorStop(0.7, "rgba(255,150,40,0.75)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    ctx.restore();
  }
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createGlowTexture(): CanvasTexture {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const cx = size * 0.5;
    const cy = size * 0.5;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.5);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.25, "rgba(255,230,160,0.9)");
    g.addColorStop(0.55, "rgba(255,120,30,0.4)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function sizeCurve(a: number, b: number, c: number, d: number): SizeOverLife {
  return new SizeOverLife(new PiecewiseBezier([[new Bezier(a, b, c, d), 0]]));
}

function burst(
  count: number,
  time = 0,
): {
  time: number;
  count: ConstantValue;
  cycle: number;
  interval: number;
  probability: number;
} {
  return {
    time,
    count: new ConstantValue(count),
    cycle: 1,
    interval: 0.05,
    probability: 1,
  };
}

type SysOpts = {
  mat: MeshBasicMaterial;
  tile: number;
  mode?: RenderMode;
  order?: number;
  speedFactor?: number;
};

type SysParams = Omit<
  ParticleSystemParameters,
  | "material"
  | "looping"
  | "autoDestroy"
  | "worldSpace"
  | "emissionOverTime"
  | "renderMode"
  | "renderOrder"
  | "softParticles"
  | "uTileCount"
  | "vTileCount"
  | "startTileIndex"
  | "speedFactor"
>;

function baseSystem(opts: SysOpts, params: SysParams): ParticleSystem {
  const cfg: ParticleSystemParameters = {
    looping: false,
    autoDestroy: false,
    worldSpace: true,
    emissionOverTime: new ConstantValue(0),
    material: opts.mat,
    renderMode: opts.mode ?? RenderMode.BillBoard,
    renderOrder: opts.order ?? 0,
    softParticles: false,
    uTileCount: 2,
    vTileCount: 2,
    startTileIndex: new ConstantValue(opts.tile),
    ...params,
  };
  if (opts.speedFactor != null) cfg.speedFactor = opts.speedFactor;
  return new ParticleSystem(cfg);
}

function makeCore(mat: MeshBasicMaterial, count: number): ParticleSystem {
  return baseSystem(
    { mat, tile: TILE.glow, order: 6 },
    {
      duration: 0.05,
      shape: new PointEmitter(),
      emissionBursts: [burst(count)],
      startLife: new IntervalValue(0.08, 0.14),
      startSpeed: new ConstantValue(0),
      startSize: new IntervalValue(14, 22),
      startColor: new ConstantColor(new QVector4(1, 1, 0.97, 1)),
      behaviors: [
        sizeCurve(1, 1.45, 0.5, 0),
        new ColorOverLife(
          new Gradient(
            [
              [new QVector3(1, 1, 0.97), 0],
              [new QVector3(1, 0.6, 0.2), 0.45],
              [new QVector3(1, 0.12, 0.02), 1],
            ],
            [
              [1, 0],
              [0.9, 0.3],
              [0, 1],
            ],
          ),
        ),
      ],
    },
  );
}

function makeFlash(mat: MeshBasicMaterial, count: number): ParticleSystem {
  return baseSystem(
    { mat, tile: TILE.glow, order: 5 },
    {
      duration: 0.07,
      shape: new SphereEmitter({ radius: 0.8, thickness: 1 }),
      emissionBursts: [burst(count)],
      startLife: new IntervalValue(0.12, 0.24),
      startSpeed: new IntervalValue(3, 12),
      startSize: new IntervalValue(7, 14),
      startColor: new ConstantColor(new QVector4(1, 0.88, 0.42, 1)),
      behaviors: [
        sizeCurve(0.9, 1.3, 0.45, 0),
        new ColorOverLife(
          new Gradient(
            [
              [new QVector3(1, 0.92, 0.55), 0],
              [new QVector3(1, 0.3, 0.05), 1],
            ],
            [
              [1, 0],
              [0, 1],
            ],
          ),
        ),
      ],
    },
  );
}

function makeShock(mat: MeshBasicMaterial, count: number): ParticleSystem {
  return baseSystem(
    { mat, tile: TILE.ring, mode: RenderMode.HorizontalBillBoard, order: 4 },
    {
      duration: 0.05,
      shape: new PointEmitter(),
      emissionBursts: [burst(count)],
      startLife: new IntervalValue(0.2, 0.3),
      startSpeed: new ConstantValue(0),
      startSize: new IntervalValue(4, 6),
      startColor: new ConstantColor(new QVector4(1, 0.92, 0.6, 0.85)),
      behaviors: [
        sizeCurve(0.4, 1.2, 2.6, 3.8),
        new ColorOverLife(
          new Gradient(
            [
              [new QVector3(1, 0.95, 0.7), 0],
              [new QVector3(1, 0.4, 0.1), 0.55],
              [new QVector3(0.35, 0.12, 0.04), 1],
            ],
            [
              [0.85, 0],
              [0.3, 0.55],
              [0, 1],
            ],
          ),
        ),
      ],
    },
  );
}

function makeFireball(mat: MeshBasicMaterial, count: number): ParticleSystem {
  const late = Math.max(3, (count * 0.45) | 0);
  return baseSystem(
    { mat, tile: TILE.glow, order: 3 },
    {
      duration: 0.14,
      shape: new SphereEmitter({ radius: 1.6, thickness: 1 }),
      emissionBursts: [burst(count), burst(late, 0.05)],
      startLife: new IntervalValue(0.35, 0.7),
      startSpeed: new IntervalValue(5, 16),
      startSize: new IntervalValue(5.5, 12),
      startColor: new ConstantColor(new QVector4(1, 0.48, 0.08, 1)),
      behaviors: [
        sizeCurve(0.65, 1.35, 1.15, 0.2),
        new ColorOverLife(
          new Gradient(
            [
              [new QVector3(1, 0.8, 0.3), 0],
              [new QVector3(1, 0.28, 0.04), 0.35],
              [new QVector3(0.35, 0.08, 0.02), 0.7],
              [new QVector3(0.08, 0.03, 0.02), 1],
            ],
            [
              [1, 0],
              [0.85, 0.25],
              [0.4, 0.6],
              [0, 1],
            ],
          ),
        ),
        new ApplyForce(new QVector3(0, 1, 0), new ConstantValue(7)),
        new RotationOverLife(new IntervalValue(-2.5, 2.5)),
      ],
    },
  );
}

function makeSparks(mat: MeshBasicMaterial, count: number): ParticleSystem {
  return baseSystem(
    {
      mat,
      tile: TILE.ember,
      mode: RenderMode.StretchedBillBoard,
      order: 4,
      speedFactor: 0.14,
    },
    {
      duration: 0.08,
      shape: new SphereEmitter({ radius: 0.55, thickness: 1 }),
      emissionBursts: [burst(count)],
      startLife: new IntervalValue(0.28, 0.6),
      startSpeed: new IntervalValue(32, 72),
      startSize: new IntervalValue(0.7, 1.9),
      startColor: new ConstantColor(new QVector4(1, 0.75, 0.3, 1)),
      behaviors: [
        sizeCurve(1, 0.8, 0.28, 0),
        new SpeedOverLife(
          new PiecewiseBezier([[new Bezier(1, 0.65, 0.22, 0.04), 0]]),
        ),
        new ColorOverLife(
          new Gradient(
            [
              [new QVector3(1, 0.95, 0.5), 0],
              [new QVector3(1, 0.35, 0.06), 0.4],
              [new QVector3(0.12, 0.03, 0.01), 1],
            ],
            [
              [1, 0],
              [0.75, 0.35],
              [0, 1],
            ],
          ),
        ),
      ],
    },
  );
}

function makeEmbers(mat: MeshBasicMaterial, count: number): ParticleSystem {
  return baseSystem(
    { mat, tile: TILE.ember, order: 2 },
    {
      duration: 0.14,
      shape: new SphereEmitter({ radius: 2, thickness: 1 }),
      emissionBursts: [burst(count)],
      startLife: new IntervalValue(0.6, 1.25),
      startSpeed: new IntervalValue(4, 14),
      startSize: new IntervalValue(0.55, 1.6),
      startColor: new ConstantColor(new QVector4(1, 0.42, 0.08, 1)),
      behaviors: [
        sizeCurve(1, 0.9, 0.35, 0),
        new ApplyForce(new QVector3(0, 1, 0), new ConstantValue(9)),
        new ColorOverLife(
          new Gradient(
            [
              [new QVector3(1, 0.6, 0.18), 0],
              [new QVector3(1, 0.22, 0.04), 0.5],
              [new QVector3(0.18, 0.04, 0.02), 1],
            ],
            [
              [1, 0],
              [0.55, 0.45],
              [0, 1],
            ],
          ),
        ),
      ],
    },
  );
}

function makeSmoke(mat: MeshBasicMaterial, count: number): ParticleSystem {
  const late = Math.max(4, (count * 0.5) | 0);
  return baseSystem(
    { mat, tile: TILE.smoke, order: 0 },
    {
      duration: 0.18,
      shape: new SphereEmitter({ radius: 2.2, thickness: 1 }),
      emissionBursts: [burst(count), burst(late, 0.08)],
      startLife: new IntervalValue(1.05, 1.9),
      startSpeed: new IntervalValue(3, 11),
      startSize: new IntervalValue(6, 13),
      startColor: new ConstantColor(new QVector4(0.58, 0.52, 0.46, 0.8)),
      behaviors: [
        sizeCurve(0.4, 1.1, 1.65, 2.1),
        new ApplyForce(new QVector3(0, 1, 0), new ConstantValue(5)),
        new RotationOverLife(new IntervalValue(-1.4, 1.4)),
        new ColorOverLife(
          new Gradient(
            [
              [new QVector3(0.6, 0.5, 0.4), 0],
              [new QVector3(0.32, 0.3, 0.28), 0.5],
              [new QVector3(0.1, 0.1, 0.1), 1],
            ],
            [
              [0.75, 0],
              [0.4, 0.45],
              [0, 1],
            ],
          ),
        ),
      ],
    },
  );
}

function makeDebris(mat: MeshBasicMaterial, count: number): ParticleSystem {
  return baseSystem(
    {
      mat,
      tile: TILE.ember,
      mode: RenderMode.StretchedBillBoard,
      order: 1,
      speedFactor: 0.11,
    },
    {
      duration: 0.08,
      shape: new SphereEmitter({ radius: 0.45, thickness: 1 }),
      emissionBursts: [burst(count)],
      startLife: new IntervalValue(0.4, 0.8),
      startSpeed: new IntervalValue(24, 60),
      startSize: new IntervalValue(0.45, 1.2),
      startColor: new ConstantColor(new QVector4(0.95, 0.38, 0.08, 1)),
      behaviors: [
        sizeCurve(1, 0.55, 0.22, 0),
        new SpeedOverLife(
          new PiecewiseBezier([[new Bezier(1, 0.6, 0.18, 0.04), 0]]),
        ),
        new ApplyForce(new QVector3(0, -1, 0), new ConstantValue(14)),
        new ColorOverLife(
          new Gradient(
            [
              [new QVector3(1, 0.5, 0.14), 0],
              [new QVector3(0.22, 0.07, 0.02), 1],
            ],
            [
              [1, 0],
              [0, 1],
            ],
          ),
        ),
      ],
    },
  );
}

/** Poeira / cascalho — só solo (hemisfério pra cima). */
function makeDust(mat: MeshBasicMaterial, count: number): ParticleSystem {
  return baseSystem(
    { mat, tile: TILE.smoke, order: 1 },
    {
      duration: 0.12,
      shape: new HemisphereEmitter({ radius: 1.4, thickness: 1 }),
      emissionBursts: [burst(count)],
      startLife: new IntervalValue(0.55, 1.15),
      startSpeed: new IntervalValue(8, 22),
      startSize: new IntervalValue(2.5, 6),
      startColor: new ConstantColor(new QVector4(0.55, 0.4, 0.22, 0.85)),
      behaviors: [
        sizeCurve(0.55, 1.2, 1.55, 1.8),
        new ApplyForce(new QVector3(0, 1, 0), new ConstantValue(2.5)),
        new SpeedOverLife(
          new PiecewiseBezier([[new Bezier(1, 0.55, 0.2, 0.05), 0]]),
        ),
        new ColorOverLife(
          new Gradient(
            [
              [new QVector3(0.62, 0.45, 0.25), 0],
              [new QVector3(0.35, 0.28, 0.18), 0.55],
              [new QVector3(0.15, 0.12, 0.08), 1],
            ],
            [
              [0.85, 0],
              [0.4, 0.5],
              [0, 1],
            ],
          ),
        ),
      ],
    },
  );
}

/** Spray / névoa — só água. */
function makeSpray(mat: MeshBasicMaterial, count: number): ParticleSystem {
  return baseSystem(
    { mat, tile: TILE.glow, order: 2 },
    {
      duration: 0.12,
      shape: new HemisphereEmitter({ radius: 1.8, thickness: 1 }),
      emissionBursts: [burst(count), burst(Math.max(4, (count / 2) | 0), 0.05)],
      startLife: new IntervalValue(0.45, 0.95),
      startSpeed: new IntervalValue(10, 28),
      startSize: new IntervalValue(2, 5.5),
      startColor: new ConstantColor(new QVector4(0.75, 0.9, 1, 0.9)),
      behaviors: [
        sizeCurve(0.7, 1.25, 1.1, 0.2),
        new ApplyForce(new QVector3(0, 1, 0), new ConstantValue(6)),
        new ColorOverLife(
          new Gradient(
            [
              [new QVector3(0.9, 0.97, 1), 0],
              [new QVector3(0.55, 0.75, 0.9), 0.5],
              [new QVector3(0.3, 0.45, 0.55), 1],
            ],
            [
              [0.95, 0],
              [0.45, 0.45],
              [0, 1],
            ],
          ),
        ),
      ],
    },
  );
}

function layerKindsFor(quality: QualityProfile): LayerKind[] {
  if (quality === "low") {
    return ["core", "flash", "fireball", "sparks", "dust", "spray"];
  }
  if (quality === "medium") {
    return [
      "core",
      "flash",
      "shock",
      "fireball",
      "sparks",
      "embers",
      "smoke",
      "dust",
      "spray",
    ];
  }
  // high + ultra: full layer set
  return [
    "core",
    "flash",
    "shock",
    "fireball",
    "sparks",
    "embers",
    "smoke",
    "debris",
    "dust",
    "spray",
  ];
}

function countsFor(quality: QualityProfile): Record<LayerKind, number> {
  if (quality === "low") {
    return {
      core: 2,
      flash: 7,
      shock: 0,
      fireball: 12,
      sparks: 12,
      embers: 0,
      smoke: 0,
      debris: 0,
      dust: 8,
      spray: 10,
    };
  }
  if (quality === "medium") {
    return {
      core: 3,
      flash: 10,
      shock: 2,
      fireball: 18,
      sparks: 18,
      embers: 12,
      smoke: 18,
      debris: 0,
      dust: 14,
      spray: 14,
    };
  }
  if (quality === "ultra") {
    return {
      core: 5,
      flash: 16,
      shock: 4,
      fireball: 30,
      sparks: 30,
      embers: 22,
      smoke: 28,
      debris: 18,
      dust: 24,
      spray: 22,
    };
  }
  // high
  return {
    core: 4,
    flash: 12,
    shock: 3,
    fireball: 22,
    sparks: 22,
    embers: 16,
    smoke: 22,
    debris: 12,
    dust: 18,
    spray: 16,
  };
}

/** Quais camadas tocam por superfície (e lite). */
function shouldPlayLayer(
  kind: LayerKind,
  surface: BoomSurface,
  preferLite: boolean,
): boolean {
  if (preferLite) {
    if (surface === "water") {
      return (
        kind === "core" ||
        kind === "flash" ||
        kind === "sparks" ||
        kind === "spray"
      );
    }
    if (surface === "ground") {
      return (
        kind === "core" ||
        kind === "flash" ||
        kind === "sparks" ||
        kind === "fireball" ||
        kind === "dust"
      );
    }
    return LITE_KINDS.has(kind);
  }

  if (surface === "ground") {
    return (
      kind !== "embers" &&
      kind !== "spray"
    );
  }
  if (surface === "water") {
    return (
      kind === "core" ||
      kind === "flash" ||
      kind === "shock" ||
      kind === "sparks" ||
      kind === "spray" ||
      kind === "smoke"
    );
  }
  // ar: bola de fogo esférica, sem poeira/anel de solo
  return (
    kind !== "shock" &&
    kind !== "dust" &&
    kind !== "spray" &&
    kind !== "debris"
  );
}

function ttlFor(quality: QualityProfile): number {
  if (quality === "low") return 0.75;
  if (quality === "medium") return 2.05;
  if (quality === "ultra") return 2.7;
  return 2.3;
}

function buildLayer(
  kind: LayerKind,
  addMat: MeshBasicMaterial,
  smokeMat: MeshBasicMaterial,
  count: number,
): ParticleSystem {
  switch (kind) {
    case "core":
      return makeCore(addMat, count);
    case "flash":
      return makeFlash(addMat, count);
    case "shock":
      return makeShock(addMat, count);
    case "fireball":
      return makeFireball(addMat, count);
    case "sparks":
      return makeSparks(addMat, count);
    case "embers":
      return makeEmbers(addMat, count);
    case "smoke":
      return makeSmoke(smokeMat, count);
    case "debris":
      return makeDebris(addMat, count);
    case "dust":
      return makeDust(smokeMat, count);
    case "spray":
      return makeSpray(addMat, count);
  }
}

/**
 * Pool Quarks + punch mesh/luz pooled.
 * Ganhos visuais baratos: anel/flash mesh + PointLight curta no terreno.
 */
export class BoomVfx {
  readonly batch: BatchedRenderer;
  private readonly particleCap: number;
  private readonly atlas: CanvasTexture;
  private readonly glowTex: CanvasTexture;
  private readonly ringTex: CanvasTexture;
  private readonly addMat: MeshBasicMaterial;
  private readonly smokeMat: MeshBasicMaterial;
  private readonly flashGeo: SphereGeometry;
  private readonly ringGeo: PlaneGeometry;
  private readonly pool: BoomSlot[] = [];
  private readonly free: number[] = [];
  private readonly lights: LightSlot[] = [];
  private readonly freeLights: number[] = [];
  private viewX = 0;
  private viewY = 0;
  private viewZ = 0;
  private droppedTotal = 0;
  private dropWindow = 0;
  private dropsInWindow = 0;
  private forceLiteUntil = 0;
  private readonly defaultTtl: number;
  private readonly parent: Object3D;

  constructor(parent: Object3D, quality: QualityProfile = "medium") {
    this.parent = parent;
    this.particleCap = PARTICLE_CAP[quality];
    this.defaultTtl = ttlFor(quality);
    this.batch = new BatchedRenderer();
    parent.add(this.batch);

    this.atlas = createBoomAtlas();
    this.glowTex = createGlowTexture();
    this.ringTex = createRingTexture();
    this.addMat = new MeshBasicMaterial({
      map: this.atlas,
      color: 0xffffff,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    this.smokeMat = new MeshBasicMaterial({
      map: this.atlas,
      color: 0xffffff,
      transparent: true,
      depthWrite: false,
      blending: NormalBlending,
    });

    this.flashGeo = new SphereGeometry(1, 10, 8);
    this.ringGeo = new PlaneGeometry(1, 1);

    const kinds = layerKindsFor(quality);
    const counts = countsFor(quality);
    const n = BOOM_POOL[quality];
    for (let i = 0; i < n; i++) {
      const layers: BoomLayer[] = [];
      for (const kind of kinds) {
        const count = counts[kind];
        if (count <= 0) continue;
        const system = buildLayer(kind, this.addMat, this.smokeMat, count);
        system.stop();
        parent.add(system.emitter);
        this.batch.addSystem(system);
        layers.push({ kind, system });
      }

      const flashMat = new MeshBasicMaterial({
        map: this.glowTex,
        color: new Color(1, 0.85, 0.45),
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        opacity: 0,
      });
      const ringMat = new MeshBasicMaterial({
        map: this.ringTex,
        color: new Color(1, 0.75, 0.35),
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        opacity: 0,
        side: DoubleSide,
      });
      const flash = new Mesh(this.flashGeo, flashMat);
      flash.visible = false;
      flash.renderOrder = 8;
      const ring = new Mesh(this.ringGeo, ringMat);
      ring.rotation.x = -Math.PI * 0.5;
      ring.visible = false;
      ring.renderOrder = 7;
      parent.add(flash);
      parent.add(ring);

      this.pool.push({
        layers,
        busy: false,
        ttl: 0,
        surface: "air",
        flash,
        ring,
        flashMat,
        ringMat,
        meshAge: 0,
        meshActive: false,
        flashEnd: 24.5,
        ringEnd: 53,
        flashPeakOp: 0.95,
        ringPeakOp: 0.85,
      });
      this.free.push(i);
    }

    const lightN = LIGHT_POOL[quality];
    for (let i = 0; i < lightN; i++) {
      const light = new PointLight(0xff8a2a, 0, 110, 2);
      light.visible = false;
      parent.add(light);
      this.lights.push({ light, busy: false, age: 0, life: 0.22, peak: 55 });
      this.freeLights.push(i);
    }
  }

  setViewOrigin(x: number, y: number, z: number): void {
    this.viewX = x;
    this.viewY = y;
    this.viewZ = z;
  }

  /** Hot path: acquire + position + restart. Sem alloc. */
  boom(x: number, y: number, z: number, surface: BoomSurface = "air"): void {
    const idx = this.free.pop();
    if (idx === undefined) {
      this.noteDrop();
      return;
    }

    const dx = x - this.viewX;
    const dy = y - this.viewY;
    const dz = z - this.viewZ;
    const distSq = dx * dx + dy * dy + dz * dz;
    const live = this.countParticles();
    const preferLite =
      this.forceLiteUntil > 0 ||
      live >= this.particleCap * 0.8 ||
      distSq > LITE_DIST_SQ;

    if (live >= this.particleCap) {
      this.free.push(idx);
      this.noteDrop();
      return;
    }

    const slot = this.pool[idx]!;
    slot.busy = true;
    slot.surface = surface;
    slot.ttl =
      preferLite
        ? Math.min(0.75, this.defaultTtl)
        : surface === "ground"
          ? this.defaultTtl + 0.25
          : surface === "water"
            ? this.defaultTtl
            : Math.min(this.defaultTtl, 1.55);

    for (const layer of slot.layers) {
      layer.system.emitter.position.set(x, y, z);
      layer.system.emitter.updateMatrixWorld(true);
      const play = shouldPlayLayer(layer.kind, surface, preferLite);
      if (play) layer.system.restart();
      else layer.system.stop();
    }

    // Punch mesh — anel forte no solo, flash esférico no ar, ciano na água.
    if (surface === "ground") {
      slot.flashEnd = 20;
      slot.ringEnd = 68;
      slot.flashPeakOp = 0.9;
      slot.ringPeakOp = 0.95;
      slot.flashMat.color.setRGB(1, 0.72, 0.28);
      slot.ringMat.color.setRGB(1, 0.55, 0.18);
    } else if (surface === "water") {
      slot.flashEnd = 18;
      slot.ringEnd = 58;
      slot.flashPeakOp = 0.85;
      slot.ringPeakOp = 0.9;
      slot.flashMat.color.setRGB(0.75, 0.9, 1);
      slot.ringMat.color.setRGB(0.55, 0.82, 1);
    } else {
      slot.flashEnd = 28;
      slot.ringEnd = 22;
      slot.flashPeakOp = 1;
      slot.ringPeakOp = 0.4;
      slot.flashMat.color.setRGB(1, 0.92, 0.55);
      slot.ringMat.color.setRGB(1, 0.85, 0.45);
    }

    slot.flash.position.set(x, y, z);
    slot.ring.position.set(x, y + (surface === "air" ? 0 : 0.2), z);
    slot.flash.scale.setScalar(2.5);
    slot.ring.scale.setScalar(surface === "air" ? 2.5 : 5);
    slot.flashMat.opacity = slot.flashPeakOp;
    slot.ringMat.opacity = slot.ringPeakOp;
    slot.flash.visible = true;
    slot.ring.visible = surface !== "air" || !preferLite;
    slot.meshAge = 0;
    slot.meshActive = true;

    if (!preferLite) this.acquireLight(x, y, z, surface);
  }

  tick(dt: number): void {
    this.batch.update(dt);
    this.tickMeshes(dt);
    this.tickLights(dt);

    if (this.forceLiteUntil > 0) {
      this.forceLiteUntil = Math.max(0, this.forceLiteUntil - dt);
    }
    this.dropWindow += dt;
    if (this.dropWindow >= 1) {
      if (this.dropsInWindow >= 3) this.forceLiteUntil = 2;
      this.dropWindow = 0;
      this.dropsInWindow = 0;
    }

    for (let i = 0; i < this.pool.length; i++) {
      const slot = this.pool[i]!;
      if (!slot.busy) continue;
      slot.ttl -= dt;
      let alive = 0;
      for (const layer of slot.layers) alive += layer.system.particleNum;
      const meshBusy = slot.meshActive;
      if (slot.ttl > 0 && (alive > 0 || meshBusy)) continue;
      for (const layer of slot.layers) layer.system.stop();
      this.hideMesh(slot);
      slot.busy = false;
      slot.ttl = 0;
      this.free.push(i);
    }
  }

  stats(): BoomVfxStats {
    let booms = 0;
    for (const slot of this.pool) if (slot.busy) booms += 1;
    return {
      particles: this.countParticles(),
      booms,
      dropped: this.droppedTotal,
      poolSize: this.pool.length,
      free: this.free.length,
    };
  }

  dispose(): void {
    for (const slot of this.pool) {
      for (const layer of slot.layers) {
        layer.system.stop();
        layer.system.dispose();
      }
      this.parent.remove(slot.flash);
      this.parent.remove(slot.ring);
      slot.flashMat.dispose();
      slot.ringMat.dispose();
    }
    this.pool.length = 0;
    this.free.length = 0;
    for (const slot of this.lights) {
      slot.light.visible = false;
      this.parent.remove(slot.light);
      slot.light.dispose();
    }
    this.lights.length = 0;
    this.freeLights.length = 0;
    if (this.batch.parent) this.batch.parent.remove(this.batch);
    this.addMat.dispose();
    this.smokeMat.dispose();
    this.atlas.dispose();
    this.glowTex.dispose();
    this.ringTex.dispose();
    this.flashGeo.dispose();
    this.ringGeo.dispose();
  }

  private acquireLight(
    x: number,
    y: number,
    z: number,
    surface: BoomSurface,
  ): void {
    const li = this.freeLights.pop();
    if (li === undefined) return;
    const slot = this.lights[li]!;
    slot.busy = true;
    slot.age = 0;
    slot.life = surface === "ground" ? 0.28 : surface === "water" ? 0.24 : 0.18;
    slot.peak =
      surface === "ground"
        ? 62 + Math.random() * 24
        : surface === "water"
          ? 40 + Math.random() * 18
          : 48 + Math.random() * 22;
    if (surface === "water") slot.light.color.setRGB(0.55, 0.78, 1);
    else if (surface === "ground") slot.light.color.setRGB(1, 0.48, 0.14);
    else slot.light.color.setRGB(1, 0.72, 0.32);
    slot.light.position.set(x, y + (surface === "air" ? 0.5 : 1.8), z);
    slot.light.intensity = slot.peak;
    slot.light.distance =
      surface === "ground" ? 130 + Math.random() * 30 : 95 + Math.random() * 25;
    slot.light.visible = true;
  }

  private tickLights(dt: number): void {
    for (let i = 0; i < this.lights.length; i++) {
      const slot = this.lights[i]!;
      if (!slot.busy) continue;
      slot.age += dt;
      const t = Math.min(1, slot.age / slot.life);
      const fade = (1 - t) * (1 - t);
      slot.light.intensity = slot.peak * fade;
      if (t >= 1) {
        slot.light.intensity = 0;
        slot.light.visible = false;
        slot.busy = false;
        this.freeLights.push(i);
      }
    }
  }

  private tickMeshes(dt: number): void {
    for (const slot of this.pool) {
      if (!slot.meshActive) continue;
      slot.meshAge += dt;
      const life =
        slot.surface === "ground"
          ? MESH_PUNCH_LIFE + 0.08
          : slot.surface === "water"
            ? MESH_PUNCH_LIFE + 0.04
            : MESH_PUNCH_LIFE - 0.06;
      const t = Math.min(1, slot.meshAge / Math.max(0.2, life));
      const ease = 1 - (1 - t) * (1 - t);
      const flashScale = 2.5 + ease * (slot.flashEnd - 2.5);
      const ringScale = (slot.surface === "air" ? 2.5 : 5) + ease * (slot.ringEnd - 5);
      slot.flash.scale.setScalar(flashScale);
      slot.ring.scale.setScalar(Math.max(0.01, ringScale));
      slot.flashMat.opacity = Math.max(
        0,
        slot.flashPeakOp * (1 - t) * (1 - t * 0.35),
      );
      slot.ringMat.opacity = Math.max(0, slot.ringPeakOp * (1 - ease));
      if (t >= 1) this.hideMesh(slot);
    }
  }

  private hideMesh(slot: BoomSlot): void {
    slot.meshActive = false;
    slot.flash.visible = false;
    slot.ring.visible = false;
    slot.flashMat.opacity = 0;
    slot.ringMat.opacity = 0;
  }

  private countParticles(): number {
    let n = 0;
    for (const slot of this.pool) {
      if (!slot.busy) continue;
      for (const layer of slot.layers) n += layer.system.particleNum;
    }
    return n;
  }

  private noteDrop(): void {
    this.droppedTotal += 1;
    this.dropsInWindow += 1;
  }
}
