import type { DayPhase } from "@afd/game-core";
import {
  Box3,
  BufferGeometry,
  Color,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Vector3,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/**
 * Three authored cumulus meshes. The pool is larger than a thin sky:
 * time of day and a slow swell decide how many are actually drawn.
 */
const MESH_CLOUDS = 18;
const URLS = ["/sky/cloud_nv1.glb", "/sky/cloud_nv2.glb", "/sky/cloud_nv3.glb"];

const RECYCLE = 9800;
const RING_NEAR_MIN = 1600;
const RING_NEAR_MAX = 3400;
const RING_MID_MIN = 3400;
const RING_MID_MAX = 5600;
const RING_FAR_MIN = 5600;
const RING_FAR_MAX = 7800;

/** Hide the shell once the jet is this far into the ellipsoid, so the sky stays visible inside. */
const INSIDE = 0.62;

type CloudLayer = "low" | "mid" | "high";

export interface CloudFieldOptions {
  /** Mass count. Pacific uses the default. Capped, because each mass is a full mesh. */
  clusters?: number;
  /** When set, every mass sits in this band. */
  deck?: { min: number; max: number };
  /** Locks coverage. Phase density is ignored and every mass stays visible. */
  fixedDensity?: number;
  /** Shared wind heading in radians. Speed still varies per mass. */
  windAngle?: number;
}

interface Mass {
  variant: number;
  slot: number;
  layer: CloudLayer;
  x: number;
  z: number;
  y: number;
  vx: number;
  vz: number;
  /** World metres per authored unit. */
  scale: number;
  yaw: number;
  /** Target width in metres. Scale is derived once the mesh extents are known. */
  span: number;
  /** Stable 0..1 used to cull by phase density. */
  priority: number;
  shown: boolean;
  /** Authored half-extents, metres at scale 1. */
  hx: number;
  hy: number;
  hz: number;
}

interface Variant {
  mesh: InstancedMesh | null;
  hx: number;
  hy: number;
  hz: number;
}

function hash(n: number): number {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

function layerForIndex(i: number, count: number): CloudLayer {
  const third = Math.max(1, Math.floor(count / 3));
  if (i < third) return "low";
  if (i < third * 2) return "mid";
  return "high";
}

function altitudeFor(layer: CloudLayer, salt: number): number {
  if (layer === "low") return 980 + hash(salt + 8.2) * 420;
  if (layer === "mid") return 1600 + hash(salt + 8.2) * 700;
  return 2500 + hash(salt + 8.2) * 1100;
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

/**
 * Cumulus field built from the three shaded cloud meshes.
 * The jet flies through: the shell hides while the aircraft is inside it.
 */
export class CloudField {
  readonly group = new Group();
  private readonly options: CloudFieldOptions;
  private readonly masses: Mass[] = [];
  private readonly variants: Variant[] = [
    { mesh: null, hx: 1, hy: 1, hz: 1 },
    { mesh: null, hx: 1, hy: 1, hz: 1 },
    { mesh: null, hx: 1, hy: 1, hz: 1 },
  ];
  private readonly materials: MeshStandardMaterial[] = [];
  private readonly geometries: BufferGeometry[] = [];
  private readonly dummy = new Object3D();
  private readonly tint = new Color();
  private readonly night = new Color(0.28, 0.32, 0.42);
  private readonly day = new Color(1, 1, 1);
  private readonly dusk = new Color(1, 0.82, 0.62);
  private readonly dawn = new Color(0.9, 0.86, 0.95);
  private readonly packSlot = [0, 0, 0];
  private coverT = 0;
  private disposed = false;

  constructor(options: CloudFieldOptions = {}) {
    this.options = options;
    this.group.name = "CloudField";
    const count = Math.min(options.clusters ?? MESH_CLOUDS, MESH_CLOUDS);
    const slots = [0, 0, 0];
    for (let i = 0; i < count; i++) {
      const variant = i % 3;
      this.masses.push({
        variant,
        slot: slots[variant]!,
        layer: layerForIndex(i, count),
        x: 0,
        z: 0,
        y: 1200,
        vx: 0,
        vz: 0,
        scale: 1,
        yaw: hash(i * 4.1) * Math.PI * 2,
        span: 700,
        priority: hash(i * 31.7),
        shown: true,
        hx: 1,
        hy: 1,
        hz: 1,
      });
      slots[variant]! += 1;
    }
    this.seed(0, 0);
    const loader = new GLTFLoader();
    URLS.forEach((url, variant) => {
      loader.load(
        url,
        (gltf) => {
          if (this.disposed) return;
          this.mount(variant, gltf.scene, slots[variant]!);
        },
        undefined,
        () => {
          /* this shape stays absent */
        },
      );
    });
  }

  /** Scatter a first ring so the sky is not empty at spawn. */
  seed(wx: number, wz: number): void {
    for (let i = 0; i < this.masses.length; i++) {
      const mass = this.masses[i]!;
      const band = i % 5;
      if (band < 2) this.place(mass, wx, wz, i * 19.7, RING_NEAR_MIN, RING_NEAR_MAX);
      else if (band < 4) this.place(mass, wx, wz, i * 19.7, RING_MID_MIN, RING_MID_MAX);
      else this.place(mass, wx, wz, i * 19.7, RING_FAR_MIN, RING_FAR_MAX);
    }
    this.writeAll();
  }

  update(
    dt: number,
    wx: number,
    wz: number,
    dayFactor: number,
    _sun: { x: number; y: number; z: number },
    _fog: { color: Color; near: number; far: number },
    opts?: {
      phase?: DayPhase;
      duskFactor?: number;
      dawnFactor?: number;
      /** Jet altitude. The shell hides while this point is inside the cloud. */
      altitude?: number;
    },
  ): void {
    const phase = opts?.phase ?? "morning";
    const locked = this.options.fixedDensity;
    this.coverT += dt;
    // Thickens and thins over a few minutes, on top of the time of day.
    const wave = 0.5 + 0.5 * Math.sin(this.coverT * 0.022);
    const dens = locked ?? cloudDensityForPhase(phase);
    const cover = locked != null ? 1 : Math.min(1, dens * (0.4 + wave * 0.78));
    const showFloor = 1 - cover;
    const altitude = opts?.altitude;

    this.tint.copy(this.night).lerp(this.day, Math.min(1, Math.max(0, dayFactor)));
    this.tint.lerp(this.dusk, Math.min(1, Math.max(0, opts?.duskFactor ?? 0)) * 0.7);
    this.tint.lerp(this.dawn, Math.min(1, Math.max(0, opts?.dawnFactor ?? 0)) * 0.45);
    for (const mat of this.materials) mat.emissive.copy(this.tint);

    for (let i = 0; i < this.masses.length; i++) {
      const mass = this.masses[i]!;
      mass.x += mass.vx * dt;
      mass.z += mass.vz * dt;
      const dx = mass.x - wx;
      const dz = mass.z - wz;
      if (dx * dx + dz * dz > RECYCLE * RECYCLE) {
        const nearBias = hash(i * 13.1 + mass.x * 0.001);
        if (nearBias < 0.55) this.place(mass, wx, wz, i * 13.1 + mass.x * 0.001, RING_NEAR_MIN, RING_NEAR_MAX);
        else if (nearBias < 0.88) this.place(mass, wx, wz, i * 13.1 + mass.x * 0.001, RING_MID_MIN, RING_MID_MAX);
        else this.place(mass, wx, wz, i * 13.1 + mass.x * 0.001, RING_FAR_MIN, RING_FAR_MAX);
      }
      const covered = mass.priority >= showFloor;
      const inside =
        altitude != null && covered && this.contains(mass, wx, altitude, wz);
      mass.shown = covered && !inside;
    }
    this.pack();
  }

  dispose(): void {
    this.disposed = true;
    for (const variant of this.variants) variant.mesh?.removeFromParent();
    for (const geo of this.geometries) geo.dispose();
    for (const mat of this.materials) {
      mat.emissiveMap?.dispose();
      mat.map?.dispose();
      mat.dispose();
    }
    this.group.removeFromParent();
  }

  private mount(variant: number, root: Object3D, count: number): void {
    if (count <= 0) return;
    root.updateMatrixWorld(true);
    let found: Mesh | null = null;
    root.traverse((obj) => {
      const mesh = obj as Mesh;
      if (!found && mesh.isMesh) found = mesh;
    });
    if (!found) return;
    const source = found as Mesh;
    const geo = source.geometry.clone();
    geo.applyMatrix4(source.matrixWorld);
    geo.computeBoundingBox();
    const box = geo.boundingBox ?? new Box3();
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    geo.translate(-center.x, -center.y, -center.z);
    const srcMat = Array.isArray(source.material) ? source.material[0] : source.material;
    const mat = (srcMat as MeshStandardMaterial).clone();
    mat.color.set(0, 0, 0);
    mat.emissive.set(1, 1, 1);
    mat.metalness = 0;
    mat.roughness = 1;
    mat.toneMapped = false;
    mat.fog = false;

    const mesh = new InstancedMesh(geo, mat, count);
    mesh.name = `CloudMesh${variant}`;
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.raycast = () => {};
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.group.add(mesh);

    const info = this.variants[variant]!;
    info.mesh = mesh;
    info.hx = size.x * 0.5;
    info.hy = size.y * 0.5;
    info.hz = size.z * 0.5;
    this.geometries.push(geo);
    this.materials.push(mat);
    for (const mass of this.masses) {
      if (mass.variant !== variant) continue;
      mass.hx = info.hx;
      mass.hy = info.hy;
      mass.hz = info.hz;
      this.fit(mass);
    }
    this.writeAll();
  }

  private place(
    mass: Mass,
    wx: number,
    wz: number,
    salt: number,
    minR: number,
    maxR: number,
  ): void {
    const ang = hash(salt + 1.3) * Math.PI * 2;
    const dist = minR + hash(salt + 4.7) * (maxR - minR);
    mass.x = wx + Math.cos(ang) * dist;
    mass.z = wz + Math.sin(ang) * dist;
    const deck = this.options.deck;
    mass.y = deck
      ? deck.min + hash(salt + 8.2) * (deck.max - deck.min)
      : altitudeFor(mass.layer, salt);
    const wind = mass.layer === "high" ? 8 + hash(salt + 2.2) * 8 : 4 + hash(salt + 2.2) * 6;
    const wobble = (hash(salt + 6.4) - 0.5) * 0.35;
    const windAngle = this.options.windAngle ?? 0.55 + wobble;
    mass.vx = Math.cos(windAngle) * wind;
    mass.vz = Math.sin(windAngle) * wind;
    // Today's width is the floor. The rest grow, up to a little over three times.
    const base = deck ? 980 : 560;
    const t = hash(salt + 9.1);
    const grow = 1 + t * t * 2.4;
    mass.span = base * grow;
    if (!deck) mass.y += (grow - 1) * 240;
    this.fit(mass);
  }

  private fit(mass: Mass): void {
    mass.scale = mass.span / Math.max(mass.hx * 2, 0.2);
  }

  private renderedY(mass: Mass): number {
    return mass.y + Math.sin(mass.x * 0.002 + mass.z * 0.0015) * 10;
  }

  private contains(mass: Mass, wx: number, wy: number, wz: number): boolean {
    const hx = mass.hx * mass.scale * INSIDE;
    const hy = mass.hy * mass.scale * INSIDE;
    const hz = mass.hz * mass.scale * INSIDE;
    if (hx < 1 || hy < 1 || hz < 1) return false;
    const dx = wx - mass.x;
    const dy = wy - this.renderedY(mass);
    const dz = wz - mass.z;
    return (dx * dx) / (hx * hx) + (dy * dy) / (hy * hy) + (dz * dz) / (hz * hz) < 1;
  }

  private writeAll(): void {
    for (const mass of this.masses) mass.shown = true;
    this.pack();
  }

  /** Draw only the masses that are in the sky right now. */
  private pack(): void {
    this.packSlot[0] = 0;
    this.packSlot[1] = 0;
    this.packSlot[2] = 0;
    for (const mass of this.masses) {
      if (!mass.shown) continue;
      const mesh = this.variants[mass.variant]?.mesh;
      if (!mesh) continue;
      const slot = this.packSlot[mass.variant]!;
      this.packSlot[mass.variant] = slot + 1;
      const y = this.renderedY(mass);
      this.dummy.position.set(mass.x, y, mass.z);
      this.dummy.rotation.set(0, mass.yaw, 0);
      this.dummy.scale.setScalar(mass.scale);
      this.dummy.updateMatrix();
      mesh.setMatrixAt(slot, this.dummy.matrix);
    }
    for (let v = 0; v < this.variants.length; v++) {
      const mesh = this.variants[v]?.mesh;
      if (!mesh) continue;
      mesh.count = this.packSlot[v]!;
      mesh.instanceMatrix.needsUpdate = true;
    }
  }
}
