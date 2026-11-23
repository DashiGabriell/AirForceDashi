import { Region, sampleHeight, sampleRegion, WORLD_SIZE } from "@afd/game-core";
import {
  Color,
  ConeGeometry,
  CylinderGeometry,
  DynamicDrawUsage,
  InstancedMesh,
  Matrix4,
  MeshLambertMaterial,
  Quaternion,
  Vector3,
} from "three";
import { applyRadialHorizon, applyVegetationDetail } from "./radialHorizon";

const MAX_CANOPY = 320;
const MAX_TRUNK = 220;
const CELL = 90;
const RADIUS = 900;

/**
 * Forest/meadow props: cone canopy + thin trunk instances (hard caps, snap refresh).
 */
export class VegetationField {
  readonly mesh: InstancedMesh;
  readonly trunks: InstancedMesh;
  private lastSnap = { x: Infinity, y: Infinity };
  private readonly canopyMat = new MeshLambertMaterial({ color: new Color(0x2a5a34) });
  private readonly trunkMat = new MeshLambertMaterial({ color: new Color(0x3a2a1c) });

  bindSky(haze: Color): void {
    applyVegetationDetail(this.canopyMat, haze);
    applyRadialHorizon(this.trunkMat, haze);
  }

  constructor() {
    this.mesh = new InstancedMesh(new ConeGeometry(1, 1, 6), this.canopyMat, MAX_CANOPY);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;

    this.trunks = new InstancedMesh(
      new CylinderGeometry(0.12, 0.18, 1, 5),
      this.trunkMat,
      MAX_TRUNK,
    );
    this.trunks.instanceMatrix.setUsage(DynamicDrawUsage);
    this.trunks.count = 0;
    this.trunks.frustumCulled = false;
  }

  update(wx: number, wz: number, force = false): void {
    const sx = Math.round(wx / 80) * 80;
    const sz = Math.round(wz / 80) * 80;
    if (
      !force &&
      Math.hypot(sx - this.lastSnap.x, sz - this.lastSnap.y) < 50
    ) {
      return;
    }
    this.lastSnap = { x: sx, y: sz };

    const half = WORLD_SIZE * 0.5;
    const i0 = Math.floor((sx + half - RADIUS) / CELL);
    const i1 = Math.floor((sx + half + RADIUS) / CELL);
    const j0 = Math.floor((sz + half - RADIUS) / CELL);
    const j1 = Math.floor((sz + half + RADIUS) / CELL);

    let n = 0;
    let t = 0;
    const m = new Matrix4();
    const p = new Vector3();
    const q = new Quaternion();
    const s = new Vector3();

    for (let j = j0; j <= j1 && n < MAX_CANOPY; j++) {
      for (let i = i0; i <= i1 && n < MAX_CANOPY; i++) {
        let cx = -half + (i + 0.5) * CELL;
        let cz = -half + (j + 0.5) * CELL;
        while (cx > half) cx -= WORLD_SIZE;
        while (cx < -half) cx += WORLD_SIZE;
        while (cz > half) cz -= WORLD_SIZE;
        while (cz < -half) cz += WORLD_SIZE;

        const region = sampleRegion(cx, cz);
        if (region !== Region.FOREST && region !== Region.MEADOW) continue;
        if (region === Region.MEADOW && ((i * 13 + j * 7) & 3) !== 0) continue;

        const gh = sampleHeight(cx, cz);
        if (gh < 4) continue;

        const seed = (i * 374761) ^ (j * 668265);
        const h = 6 + (seed % 14);
        const r = 2.2 + (seed % 5) * 0.35;
        const yaw = (seed % 360) * 0.017;
        const trunkH = h * 0.28;
        const canopyH = h * 0.78;

        p.set(cx, gh + trunkH + canopyH * 0.5, cz);
        q.setFromAxisAngle(new Vector3(0, 1, 0), yaw);
        s.set(r, canopyH, r);
        m.compose(p, q, s);
        this.mesh.setMatrixAt(n, m);

        if (t < MAX_TRUNK && region === Region.FOREST) {
          p.set(cx, gh + trunkH * 0.5, cz);
          s.set(r * 0.22, trunkH, r * 0.22);
          m.compose(p, q, s);
          this.trunks.setMatrixAt(t, m);
          t++;
        }
        n++;
      }
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.trunks.count = t;
    this.trunks.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.trunks.geometry.dispose();
    this.canopyMat.dispose();
    this.trunkMat.dispose();
  }
}
