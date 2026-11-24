import {
  isInsideAirbase,
  Region,
  sampleHeight,
  sampleRegion,
  WORLD_SIZE,
} from "@afd/game-core";
import {
  Color,
  ConeGeometry,
  CylinderGeometry,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  Matrix4,
  MeshLambertMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
} from "three";
import { applyRadialHorizon, applyVegetationDetail } from "./radialHorizon";

const MAX_CONE = 1000;
const MAX_SPHERE = 500;
const MAX_PALM = 360;
const MAX_TRUNK = 650;

const RADIUS = 900;
const CELL = 90;
const NEAR_RING = 400;
const LOD_NEAR = 220;
const LOD_FAR = 550;

const COL_BROADLEAF = new Color(0x2a5a34);
const COL_PALM = new Color(0x3d6b2e);
const COL_GIANT = new Color(0x1e4a28);
const COL_MONTANE = new Color(0x2f4a38);
const COL_TRUNK = new Color(0x3a2a1c);
const COL_TRUNK_PALM = new Color(0x5a4830);

type Species = "broadleaf" | "palm" | "giant" | "montane";
type Lod = "far" | "mid" | "near";

function hash2(i: number, j: number): number {
  let n = (i * 374761) ^ (j * 668265) ^ 0x27d4eb2d;
  n = Math.imul(n ^ (n >>> 15), n | 1);
  n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
  return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
}

function hash3(i: number, j: number, k: number): number {
  return hash2(i * 131 + k * 17, j * 197 + k * 53);
}

/** Cheap value-noise in world metres. */
function valueNoise(x: number, z: number, scale: number, seed: number): number {
  const px = x * scale + seed;
  const pz = z * scale + seed * 1.37;
  const ix = Math.floor(px);
  const iz = Math.floor(pz);
  const fx = px - ix;
  const fz = pz - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz);
  const b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1);
  const d = hash2(ix + 1, iz + 1);
  return a + (b - a) * ux + (c - a) * uz * (1 - ux) + (d - b) * ux * uz;
}

function canopyDensity(x: number, z: number): { density: number; cluster: number } {
  const fine = valueNoise(x, z, 0.011, 19);
  const cluster = valueNoise(x, z, 0.0024, 7);
  let density = fine * 0.55 + 0.2;
  if (cluster > 0.62) density = Math.min(1, density * 1.55 + 0.2);
  else if (cluster < 0.32) density *= 0.28;
  return { density, cluster };
}

function pickSpecies(region: Region, gh: number, cluster: number, seed: number): Species {
  if (region === Region.MEADOW || gh < 40) return "palm";
  if (gh > 420) return "montane";
  if (cluster > 0.7 && seed > 0.55) return "giant";
  if (seed > 0.82 && gh > 280) return "montane";
  return "broadleaf";
}

function speciesColor(sp: Species): Color {
  switch (sp) {
    case "palm":
      return COL_PALM;
    case "giant":
      return COL_GIANT;
    case "montane":
      return COL_MONTANE;
    default:
      return COL_BROADLEAF;
  }
}

function wrapWorld(v: number, half: number): number {
  let x = v;
  while (x > half) x -= WORLD_SIZE;
  while (x < -half) x += WORLD_SIZE;
  return x;
}

/**
 * Multi-species forest/meadow props with organic cluster density and LOD.
 */
export class VegetationField {
  readonly group = new Group();
  /** @deprecated prefer group — kept for callers that reference canopy cones. */
  readonly mesh: InstancedMesh;
  readonly trunks: InstancedMesh;
  readonly spheres: InstancedMesh;
  readonly palms: InstancedMesh;

  private lastSnap = { x: Infinity, y: Infinity };
  private readonly canopyMat = new MeshLambertMaterial({ color: new Color(0x2a5a34) });
  private readonly sphereMat = new MeshLambertMaterial({ color: new Color(0x2a5a34) });
  private readonly palmMat = new MeshLambertMaterial({ color: new Color(0x3d6b2e) });
  private readonly trunkMat = new MeshLambertMaterial({ color: new Color(0x3a2a1c) });

  private readonly m = new Matrix4();
  private readonly p = new Vector3();
  private readonly q = new Quaternion();
  private readonly s = new Vector3();
  private readonly up = new Vector3(0, 1, 0);

  bindSky(haze: Color): void {
    applyVegetationDetail(this.canopyMat, haze);
    applyVegetationDetail(this.sphereMat, haze);
    applyVegetationDetail(this.palmMat, haze);
    applyRadialHorizon(this.trunkMat, haze);
  }

  constructor() {
    this.group.name = "VegetationField";

    this.mesh = new InstancedMesh(new ConeGeometry(1, 1, 6), this.canopyMat, MAX_CONE);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;

    this.spheres = new InstancedMesh(new SphereGeometry(1, 6, 4), this.sphereMat, MAX_SPHERE);
    this.spheres.instanceMatrix.setUsage(DynamicDrawUsage);
    this.spheres.count = 0;
    this.spheres.frustumCulled = false;

    this.palms = new InstancedMesh(new ConeGeometry(1, 1, 5), this.palmMat, MAX_PALM);
    this.palms.instanceMatrix.setUsage(DynamicDrawUsage);
    this.palms.count = 0;
    this.palms.frustumCulled = false;

    this.trunks = new InstancedMesh(
      new CylinderGeometry(0.12, 0.18, 1, 5),
      this.trunkMat,
      MAX_TRUNK,
    );
    this.trunks.instanceMatrix.setUsage(DynamicDrawUsage);
    this.trunks.count = 0;
    this.trunks.frustumCulled = false;

    this.ensureInstanceColors(this.mesh, MAX_CONE);
    this.ensureInstanceColors(this.spheres, MAX_SPHERE);
    this.ensureInstanceColors(this.palms, MAX_PALM);
    this.ensureInstanceColors(this.trunks, MAX_TRUNK);

    this.group.add(this.mesh, this.spheres, this.palms, this.trunks);
  }

  private ensureInstanceColors(im: InstancedMesh, max: number): void {
    for (let i = 0; i < max; i++) im.setColorAt(i, COL_BROADLEAF);
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  }

  update(wx: number, wz: number, force = false): void {
    const sx = Math.round(wx / 80) * 80;
    const sz = Math.round(wz / 80) * 80;
    if (!force && Math.hypot(sx - this.lastSnap.x, sz - this.lastSnap.y) < 50) {
      return;
    }
    this.lastSnap = { x: sx, y: sz };

    const half = WORLD_SIZE * 0.5;
    const i0 = Math.floor((sx + half - RADIUS) / CELL);
    const i1 = Math.floor((sx + half + RADIUS) / CELL);
    const j0 = Math.floor((sz + half - RADIUS) / CELL);
    const j1 = Math.floor((sz + half + RADIUS) / CELL);

    let nCone = 0;
    let nSphere = 0;
    let nPalm = 0;
    let nTrunk = 0;

    const pushCone = (col: Color): boolean => {
      if (nCone >= MAX_CONE) return false;
      this.mesh.setMatrixAt(nCone, this.m);
      this.mesh.setColorAt(nCone, col);
      nCone++;
      return true;
    };
    const pushSphere = (col: Color): boolean => {
      if (nSphere >= MAX_SPHERE) return false;
      this.spheres.setMatrixAt(nSphere, this.m);
      this.spheres.setColorAt(nSphere, col);
      nSphere++;
      return true;
    };
    const pushPalm = (col: Color): boolean => {
      if (nPalm >= MAX_PALM) return false;
      this.palms.setMatrixAt(nPalm, this.m);
      this.palms.setColorAt(nPalm, col);
      nPalm++;
      return true;
    };
    const pushTrunk = (col: Color): boolean => {
      if (nTrunk >= MAX_TRUNK) return false;
      this.trunks.setMatrixAt(nTrunk, this.m);
      this.trunks.setColorAt(nTrunk, col);
      nTrunk++;
      return true;
    };

    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        if (nCone >= MAX_CONE && nSphere >= MAX_SPHERE && nPalm >= MAX_PALM) break;

        let cellX = -half + (i + 0.5) * CELL;
        let cellZ = -half + (j + 0.5) * CELL;
        cellX = wrapWorld(cellX, half);
        cellZ = wrapWorld(cellZ, half);

        const cellDist = Math.hypot(cellX - sx, cellZ - sz);
        if (cellDist > RADIUS) continue;

        // Far ring: keep every other cell to save instances.
        if (cellDist > NEAR_RING && ((i + j) & 1) !== 0) continue;

        const subdiv = cellDist < NEAR_RING ? 2 : 1;
        const step = CELL / subdiv;

        for (let sj = 0; sj < subdiv; sj++) {
          for (let si = 0; si < subdiv; si++) {
            if (nCone >= MAX_CONE) break;

            const subI = i * 4 + si;
            const subJ = j * 4 + sj;
            let baseX = -half + i * CELL + (si + 0.5) * step;
            let baseZ = -half + j * CELL + (sj + 0.5) * step;
            baseX = wrapWorld(baseX, half);
            baseZ = wrapWorld(baseZ, half);

            const region = sampleRegion(baseX, baseZ);
            if (region !== Region.FOREST && region !== Region.MEADOW) continue;
            if (isInsideAirbase(baseX, baseZ)) continue;

            const { density, cluster } = canopyDensity(baseX, baseZ);
            let d = density;
            if (region === Region.MEADOW) d *= 0.45;
            if (cellDist > LOD_FAR) d *= 0.55;

            const maxPer = region === Region.FOREST ? (cluster > 0.62 ? 5 : 3) : 2;
            const kMax = Math.min(maxPer, Math.floor(d * maxPer + 0.0001));
            if (kMax <= 0) continue;

            for (let k = 0; k < kMax; k++) {
              if (nCone >= MAX_CONE && nPalm >= MAX_PALM) break;

              const u = hash3(subI, subJ, k);
              const v = hash3(subJ, subI, k + 31);
              if (u > d + 0.12) continue;

              const jx = (hash3(subI, k, subJ) - 0.5) * step * 0.92;
              const jz = (hash3(subJ, k, subI + 9) - 0.5) * step * 0.92;
              const tx = wrapWorld(baseX + jx, half);
              const tz = wrapWorld(baseZ + jz, half);

              if (isInsideAirbase(tx, tz)) continue;

              const gh = sampleHeight(tx, tz);
              if (gh < 4) continue;
              // Skip steep slopes (simple neighbour delta).
              const slope =
                Math.abs(sampleHeight(tx + 6, tz) - gh) +
                Math.abs(sampleHeight(tx, tz + 6) - gh);
              if (slope > 14) continue;

              const dist = Math.hypot(tx - sx, tz - sz);
              const lod: Lod = dist < LOD_NEAR ? "near" : dist < LOD_FAR ? "mid" : "far";
              const sp = pickSpecies(region, gh, cluster, v);
              const col = speciesColor(sp);
              const yaw = u * Math.PI * 2;

              this.placeTree(sp, lod, tx, tz, gh, yaw, col, u, pushCone, pushSphere, pushPalm, pushTrunk);
            }
          }
        }
      }
    }

    this.mesh.count = nCone;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;

    this.spheres.count = nSphere;
    this.spheres.instanceMatrix.needsUpdate = true;
    if (this.spheres.instanceColor) this.spheres.instanceColor.needsUpdate = true;

    this.palms.count = nPalm;
    this.palms.instanceMatrix.needsUpdate = true;
    if (this.palms.instanceColor) this.palms.instanceColor.needsUpdate = true;

    this.trunks.count = nTrunk;
    this.trunks.instanceMatrix.needsUpdate = true;
    if (this.trunks.instanceColor) this.trunks.instanceColor.needsUpdate = true;
  }

  private placeTree(
    sp: Species,
    lod: Lod,
    x: number,
    z: number,
    gh: number,
    yaw: number,
    col: Color,
    rnd: number,
    pushCone: (c: Color) => boolean,
    pushSphere: (c: Color) => boolean,
    pushPalm: (c: Color) => boolean,
    pushTrunk: (c: Color) => boolean,
  ): void {
    this.q.setFromAxisAngle(this.up, yaw);

    if (sp === "palm") {
      const h = 9 + rnd * 7;
      const trunkH = h * 0.72;
      const crownR = 3.2 + rnd * 1.8;
      if (lod !== "far") {
        this.p.set(x, gh + trunkH * 0.5, z);
        this.s.set(0.28 + rnd * 0.12, trunkH, 0.28 + rnd * 0.12);
        this.m.compose(this.p, this.q, this.s);
        pushTrunk(COL_TRUNK_PALM);
      }
      // Crown: flattened cones as fronds (1 far, 3 near).
      const fronds = lod === "near" ? 3 : 1;
      for (let f = 0; f < fronds; f++) {
        const fyaw = yaw + (f / fronds) * Math.PI * 2 * 0.2;
        this.q.setFromAxisAngle(this.up, fyaw);
        this.p.set(x, gh + trunkH + 0.6, z);
        this.s.set(crownR, 1.4 + rnd * 0.6, crownR);
        this.m.compose(this.p, this.q, this.s);
        pushPalm(col);
      }
      this.q.setFromAxisAngle(this.up, yaw);
      return;
    }

    if (sp === "montane") {
      const h = 8 + rnd * 12;
      const r = 1.6 + rnd * 1.2;
      const trunkH = h * 0.22;
      if (lod !== "far") {
        this.p.set(x, gh + trunkH * 0.5, z);
        this.s.set(r * 0.14, trunkH, r * 0.14);
        this.m.compose(this.p, this.q, this.s);
        pushTrunk(COL_TRUNK);
      }
      const layers = lod === "near" ? 3 : 1;
      for (let L = 0; L < layers; L++) {
        const t = layers === 1 ? 0.55 : 0.35 + L * 0.28;
        const lr = r * (1.15 - L * 0.28);
        const lh = h * (0.42 - L * 0.08);
        this.p.set(x, gh + trunkH + h * t, z);
        this.s.set(lr, lh, lr);
        this.m.compose(this.p, this.q, this.s);
        pushCone(col);
      }
      return;
    }

    if (sp === "giant") {
      const h = 14 + rnd * 10;
      const r = 4.5 + rnd * 2.5;
      const trunkH = h * 0.32;
      if (lod !== "far") {
        this.p.set(x, gh + trunkH * 0.5, z);
        this.s.set(r * 0.2, trunkH, r * 0.2);
        this.m.compose(this.p, this.q, this.s);
        pushTrunk(COL_TRUNK);
      }
      if (lod === "far") {
        this.p.set(x, gh + trunkH + h * 0.4, z);
        this.s.set(r, h * 0.7, r);
        this.m.compose(this.p, this.q, this.s);
        pushCone(col);
        return;
      }
      // Wide canopy: sphere lobes + optional tip cone.
      this.p.set(x, gh + trunkH + h * 0.38, z);
      this.s.set(r * 0.85, r * 0.7, r * 0.85);
      this.m.compose(this.p, this.q, this.s);
      pushSphere(col);
      if (lod === "near") {
        this.p.set(x + r * 0.35, gh + trunkH + h * 0.48, z);
        this.s.set(r * 0.45, r * 0.4, r * 0.45);
        this.m.compose(this.p, this.q, this.s);
        pushSphere(col);
        this.p.set(x, gh + trunkH + h * 0.72, z);
        this.s.set(r * 0.55, h * 0.35, r * 0.55);
        this.m.compose(this.p, this.q, this.s);
        pushCone(col);
      }
      return;
    }

    // broadleaf
    const h = 7 + rnd * 11;
    const r = 2.4 + rnd * 2.2;
    const trunkH = h * 0.28;
    if (lod !== "far") {
      this.p.set(x, gh + trunkH * 0.5, z);
      this.s.set(r * 0.18, trunkH, r * 0.18);
      this.m.compose(this.p, this.q, this.s);
      pushTrunk(COL_TRUNK);
    }
    if (lod === "far" || lod === "mid") {
      this.p.set(x, gh + trunkH + h * 0.4, z);
      this.s.set(r, h * 0.72, r);
      this.m.compose(this.p, this.q, this.s);
      pushCone(col);
      return;
    }
    // Near: stacked lobes
    this.p.set(x, gh + trunkH + h * 0.28, z);
    this.s.set(r * 0.7, r * 0.55, r * 0.7);
    this.m.compose(this.p, this.q, this.s);
    pushSphere(col);
    this.p.set(x, gh + trunkH + h * 0.52, z);
    this.s.set(r * 0.85, r * 0.65, r * 0.85);
    this.m.compose(this.p, this.q, this.s);
    pushSphere(col);
    this.p.set(x, gh + trunkH + h * 0.78, z);
    this.s.set(r * 0.55, h * 0.32, r * 0.55);
    this.m.compose(this.p, this.q, this.s);
    pushCone(col);
  }

  dispose(): void {
    this.group.removeFromParent();
    this.mesh.geometry.dispose();
    this.spheres.geometry.dispose();
    this.palms.geometry.dispose();
    this.trunks.geometry.dispose();
    this.canopyMat.dispose();
    this.sphereMat.dispose();
    this.palmMat.dispose();
    this.trunkMat.dispose();
  }
}
