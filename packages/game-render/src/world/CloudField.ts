import type { DayPhase } from "@afd/game-core";
import {
  CanvasTexture,
  Color,
  DoubleSide,
  Group,
  LinearFilter,
  Mesh,
  NormalBlending,
  PlaneGeometry,
  ShaderMaterial,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  Vector3,
} from "three";

/** Total cloud masses in world space (layered decks). */
const CLUSTERS = 72;
const RECYCLE = 8200;
const RING_NEAR_MIN = 700;
const RING_NEAR_MAX = 2400;
const RING_MID_MIN = 2400;
const RING_MID_MAX = 4800;
const RING_FAR_MIN = 4800;
const RING_FAR_MAX = 7200;

type CloudLayer = "low" | "mid" | "high";

export interface CloudFieldOptions {
  /** Mass count. Pacific uses the default 72. */
  clusters?: number;
  /** When set, every mass sits in this band and uses the lighter high-deck cards. */
  deck?: { min: number; max: number };
  /** Locks coverage. Phase density is ignored and every mass stays visible. */
  fixedDensity?: number;
  /** Shared wind heading in radians. Speed still varies per mass. */
  windAngle?: number;
}

const VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorld;
varying vec3 vLocalN;
void main() {
  vUv = uv;
  vLocalN = normalize(normalMatrix * normal);
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorld = worldPos.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const FRAG = /* glsl */ `
precision highp float;
uniform sampler2D map;
uniform vec3 sunDir;
uniform float dayFactor;
uniform float duskFactor;
uniform float dawnFactor;
uniform float density;
uniform vec3 fogColor;
uniform float fogNear;
uniform float fogFar;
varying vec2 vUv;
varying vec3 vWorld;
varying vec3 vLocalN;

void main() {
  vec4 tex = texture2D(map, vUv);
  if (tex.a < 0.02) discard;

  vec2 p = vUv * 2.0 - 1.0;
  float r2 = dot(p, p);
  vec3 n = normalize(vec3(p.x, sqrt(max(0.0, 1.0 - r2)), p.y));
  vec3 L = normalize(sunDir);
  float ndl = dot(n, L) * 0.5 + 0.5;
  float rim = pow(1.0 - abs(dot(normalize(vLocalN), vec3(0.0, 0.0, 1.0))), 2.0);

  vec3 dayLit = mix(vec3(0.58, 0.66, 0.78), vec3(1.0, 0.99, 0.96), ndl);
  vec3 duskWarm = mix(vec3(0.55, 0.42, 0.38), vec3(1.0, 0.78, 0.52), ndl);
  vec3 dawnCool = mix(vec3(0.50, 0.55, 0.72), vec3(0.95, 0.88, 0.92), ndl);
  vec3 night = mix(vec3(0.16, 0.18, 0.26), vec3(0.34, 0.38, 0.48), ndl);

  float day = clamp(dayFactor, 0.0, 1.0);
  vec3 col = mix(night, dayLit, day);
  col = mix(col, duskWarm, clamp(duskFactor, 0.0, 1.0) * 0.85);
  col = mix(col, dawnCool, clamp(dawnFactor, 0.0, 1.0) * 0.7);
  // Silver lining / limb brightening toward the sun.
  col += vec3(0.18, 0.14, 0.08) * rim * ndl * (0.35 + duskFactor * 0.9 + dawnFactor * 0.55);
  col *= tex.rgb;

  float dist = distance(cameraPosition, vWorld);
  float fog = smoothstep(fogNear, fogFar, dist);
  // Close: soft veil (still visible). Mid: full card. Far: fog eats it.
  float nearVeil = smoothstep(35.0, 220.0, dist);
  float dens = clamp(density, 0.25, 1.35);
  float baseA = mix(0.22, 0.92, nearVeil) * dens;
  col = mix(col, fogColor, fog * 0.85);
  float alpha = tex.a * baseA * (1.0 - fog * 0.78);
  // Premultiplied
  gl_FragColor = vec4(col * alpha, alpha);
}
`;

interface Cluster {
  group: Group;
  layer: CloudLayer;
  x: number;
  z: number;
  y: number;
  vx: number;
  vz: number;
  /** Stable 0..1 used to cull / fade by phase density. */
  priority: number;
  baseSpan: number;
}

function hash(n: number): number {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

function layerForIndex(i: number): CloudLayer {
  if (i < 28) return "low";
  if (i < 56) return "mid";
  return "high";
}

function altitudeFor(layer: CloudLayer, salt: number): number {
  if (layer === "low") return 380 + hash(salt + 8.2) * 340;
  if (layer === "mid") return 820 + hash(salt + 8.2) * 780;
  return 2100 + hash(salt + 8.2) * 1300;
}

/** Target coverage vs day phase (afternoon = thickest deck). */
export function cloudDensityForPhase(phase: DayPhase): number {
  switch (phase) {
    case "dawn":
      return 0.58;
    case "morning":
      return 0.72;
    case "noon":
      return 0.88;
    case "afternoon":
      return 1.18;
    case "dusk":
      return 0.95;
    case "night":
      return 0.38;
    default:
      return 0.8;
  }
}

function fallbackTexture(kind: number): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const g = c.getContext("2d");
  if (g) {
    g.clearRect(0, 0, 128, 128);
    // Soft overlapping round puffs (no thin ellipses).
    const blobs: Array<[number, number, number]> = [
      [64, 64, 48],
      [48, 60, 28],
      [80, 60, 28],
      [64, 52, 26],
      [64, 76, 24],
    ];
    g.globalCompositeOperation = "lighter";
    for (const [cx, cy, r] of blobs) {
      const grd = g.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
      grd.addColorStop(0, "rgba(255,255,255,0.55)");
      grd.addColorStop(0.55, "rgba(240,244,250,0.28)");
      grd.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = grd;
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.fill();
    }
    g.globalCompositeOperation = "source-over";
    void kind;
  }
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function prepareMap(tex: Texture): Texture {
  tex.colorSpace = SRGBColorSpace;
  tex.magFilter = LinearFilter;
  tex.minFilter = LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Layered cumulus field: crossed soft impostors, near-ring density,
 * and day-phase coverage. Jet flies through — no collision.
 */
export class CloudField {
  readonly group = new Group();
  private readonly geo = new PlaneGeometry(1, 1);
  private readonly sunDir = new Vector3(0.4, 0.8, 0.3);
  private readonly fogColor = new Color(0x8eb4d0);
  private readonly dayFactor = { value: 1 };
  private readonly duskFactor = { value: 0 };
  private readonly dawnFactor = { value: 0 };
  private readonly density = { value: 0.85 };
  private readonly fogNear = { value: 500 };
  private readonly fogFar = { value: 7500 };
  private readonly mats: ShaderMaterial[] = [];
  private readonly fallbacks: CanvasTexture[] = [];
  private readonly clusters: Cluster[] = [];
  private readonly loaded: Texture[] = [];
  private readonly options: CloudFieldOptions;

  constructor(options: CloudFieldOptions = {}) {
    this.options = options;
    this.group.name = "CloudField";
    this.fallbacks.push(fallbackTexture(0), fallbackTexture(1), fallbackTexture(2), fallbackTexture(3));
    for (const fb of this.fallbacks) {
      this.mats.push(this.makeMaterial(fb));
    }

    const loader = new TextureLoader();
    const urls = [
      "/sky/cloud_a.png?v=round5",
      "/sky/cloud_b.png?v=round5",
      "/sky/cloud_c.png?v=round5",
      "/sky/cloud_d.png?v=round5",
    ];
    urls.forEach((url, i) => {
      loader.load(
        url,
        (tex) => {
          this.loaded.push(prepareMap(tex));
          this.mats[i]!.uniforms.map!.value = tex;
        },
        undefined,
        () => {
          /* keep fallback */
        },
      );
    });

    const count = options.clusters ?? CLUSTERS;
    for (let i = 0; i < count; i++) {
      this.clusters.push(this.makeCluster(i));
    }
    this.seed(0, 0);
  }

  /** Scatter a first ring so the sky is not empty at spawn. */
  seed(wx: number, wz: number): void {
    for (let i = 0; i < this.clusters.length; i++) {
      const cluster = this.clusters[i]!;
      const band = i % 5;
      if (band < 2) {
        this.place(cluster, wx, wz, i * 19.7, RING_NEAR_MIN, RING_NEAR_MAX);
      } else if (band < 4) {
        this.place(cluster, wx, wz, i * 19.7, RING_MID_MIN, RING_MID_MAX);
      } else {
        this.place(cluster, wx, wz, i * 19.7, RING_FAR_MIN, RING_FAR_MAX);
      }
    }
  }

  update(
    dt: number,
    wx: number,
    wz: number,
    dayFactor: number,
    sun: { x: number; y: number; z: number },
    fog: { color: Color; near: number; far: number },
    opts?: {
      phase?: DayPhase;
      duskFactor?: number;
      dawnFactor?: number;
    },
  ): void {
    const phase = opts?.phase ?? "morning";
    const locked = this.options.fixedDensity;
    const dens = locked ?? cloudDensityForPhase(phase);
    this.dayFactor.value = dayFactor;
    this.duskFactor.value = opts?.duskFactor ?? 0;
    this.dawnFactor.value = opts?.dawnFactor ?? 0;
    this.density.value = dens;
    this.sunDir.set(sun.x, sun.y, sun.z);
    this.fogColor.copy(fog.color);
    this.fogNear.value = fog.near;
    this.fogFar.value = fog.far;

    // A locked deck keeps every mass. Coverage is the density uniform.
    const showFloor = locked != null ? 0 : 1 - dens * 0.72;

    for (let i = 0; i < this.clusters.length; i++) {
      const cluster = this.clusters[i]!;
      cluster.group.visible = cluster.priority >= showFloor;

      cluster.x += cluster.vx * dt;
      cluster.z += cluster.vz * dt;
      const dx = cluster.x - wx;
      const dz = cluster.z - wz;
      if (dx * dx + dz * dz > RECYCLE * RECYCLE) {
        // Prefer refill near/mid so the pilot always has a deck ahead.
        const nearBias = hash(i * 13.1 + cluster.x * 0.001);
        if (nearBias < 0.55) {
          this.place(cluster, wx, wz, i * 13.1 + cluster.x * 0.001, RING_NEAR_MIN, RING_NEAR_MAX);
        } else if (nearBias < 0.88) {
          this.place(cluster, wx, wz, i * 13.1 + cluster.x * 0.001, RING_MID_MIN, RING_MID_MAX);
        } else {
          this.place(cluster, wx, wz, i * 13.1 + cluster.x * 0.001, RING_FAR_MIN, RING_FAR_MAX);
        }
      }
      // Soft bob so masses feel alive without fighting the camera.
      const bob = Math.sin(cluster.x * 0.002 + cluster.z * 0.0015) * 6;
      cluster.group.position.set(cluster.x, cluster.y + bob, cluster.z);
      const breath = 1 + Math.sin(cluster.x * 0.01 + i) * 0.02;
      cluster.group.scale.setScalar(cluster.baseSpan * breath);
    }
  }

  dispose(): void {
    this.geo.dispose();
    for (const mat of this.mats) mat.dispose();
    for (const fb of this.fallbacks) fb.dispose();
    for (const tex of this.loaded) tex.dispose();
  }

  private makeMaterial(map: Texture): ShaderMaterial {
    return new ShaderMaterial({
      uniforms: {
        map: { value: map },
        sunDir: { value: this.sunDir },
        dayFactor: this.dayFactor,
        duskFactor: this.duskFactor,
        dawnFactor: this.dawnFactor,
        density: this.density,
        fogColor: { value: this.fogColor },
        fogNear: this.fogNear,
        fogFar: this.fogFar,
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      blending: NormalBlending,
      premultipliedAlpha: true,
      fog: false,
      toneMapped: false,
    });
  }

  private makeCluster(index: number): Cluster {
    const layer = this.options.deck ? "high" : layerForIndex(index);
    const group = new Group();
    group.name = `Cloud${layer}_${index}`;

    const puffCount =
      layer === "high" ? 3 + Math.floor(hash(index + 3) * 2) : 4 + Math.floor(hash(index + 3) * 3);

    for (let i = 0; i < puffCount; i++) {
      const mat = this.mats[(index + i) % this.mats.length]!;
      const puff = new Group();
      puff.name = `puff_${i}`;

      const ang = hash(index * 17 + i * 5) * Math.PI * 2;
      const rad =
        layer === "high"
          ? hash(index * 9 + i * 3) * 0.28
          : hash(index * 9 + i * 3) * 0.26;
      const py =
        layer === "high"
          ? (hash(index * 4 + i) - 0.5) * 0.14
          : (hash(index * 4 + i) - 0.42) * 0.28;
      puff.position.set(Math.cos(ang) * rad, py, Math.sin(ang) * rad);

      // Keep cards nearly round — squash made them look like flat wedges.
      const s =
        layer === "high"
          ? 0.75 + hash(index + i * 11) * 0.4
          : 0.62 + hash(index + i * 11) * 0.48;
      const sy = s * (0.88 + hash(index + i * 7) * 0.14);

      // Crossed soft impostors only (no tilted third sheet = no diamond edges).
      const a = new Mesh(this.geo, mat);
      a.frustumCulled = true;
      a.raycast = () => {};
      a.scale.set(s, sy, 1);
      a.rotation.y = hash(index + i * 13) * Math.PI;
      a.rotation.x = (hash(index * 8 + i * 2) - 0.5) * 0.08;

      const b = new Mesh(this.geo, mat);
      b.frustumCulled = true;
      b.raycast = () => {};
      b.scale.set(s * 0.94, sy * 0.96, 1);
      b.rotation.y = a.rotation.y + Math.PI * 0.5;
      b.rotation.x = (hash(index * 5 + i) - 0.5) * 0.06;

      puff.add(a, b);
      group.add(puff);
    }

    const spanBase =
      layer === "low"
        ? 260 + hash(index * 21) * 220
        : layer === "mid"
          ? 300 + hash(index * 21) * 280
          : 420 + hash(index * 21) * 360;
    const baseSpan = spanBase * 1.15;
    group.scale.setScalar(baseSpan);
    this.group.add(group);

    return {
      group,
      layer,
      x: 0,
      z: 0,
      y: 800,
      vx: 0,
      vz: 0,
      priority: hash(index * 31.7),
      baseSpan,
    };
  }

  private place(
    cluster: Cluster,
    wx: number,
    wz: number,
    salt: number,
    minR: number,
    maxR: number,
  ): void {
    const ang = hash(salt + 1.3) * Math.PI * 2;
    const dist = minR + hash(salt + 4.7) * (maxR - minR);
    cluster.x = wx + Math.cos(ang) * dist;
    cluster.z = wz + Math.sin(ang) * dist;
    const deck = this.options.deck;
    cluster.y = deck
      ? deck.min + hash(salt + 8.2) * (deck.max - deck.min)
      : altitudeFor(cluster.layer, salt);
    const wind =
      cluster.layer === "high" ? 10 + hash(salt + 2.2) * 12 : 5 + hash(salt + 2.2) * 9;
    const wobble = (hash(salt + 6.4) - 0.5) * 0.4;
    const windAngle = this.options.windAngle ?? 0.55 + wobble;
    cluster.vx = Math.cos(windAngle) * wind;
    cluster.vz = Math.sin(windAngle) * wind;
    cluster.group.position.set(cluster.x, cluster.y, cluster.z);
  }
}
