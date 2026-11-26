import {
  Region,
  WORLD_SIZE,
  isInsideAirbase,
  sampleHeight,
  sampleRegion,
} from "@afd/game-core";
import {
  BoxGeometry,
  Color,
  DynamicDrawUsage,
  InstancedMesh,
  Matrix4,
  MeshLambertMaterial,
  Quaternion,
  Vector3,
} from "three";
import { applyRadialHorizon } from "./radialHorizon";

const MAX = 96;
const CELL = 420;
/** Mid-band: past near building detail, into silhouette. */
const INNER = 1050;
const OUTER = 3600;

/**
 * Cheap city/suburb proxies for medium distance — one slab per cell, not
 * thousands of near-field boxes. Fills the gap before horizon silhouette.
 */
export class CityHlod {
  readonly mesh: InstancedMesh;
  private lastSnap = { x: Infinity, y: Infinity };
  private readonly mat = new MeshLambertMaterial({ color: new Color(0x6a727c) });

  constructor() {
    this.mesh = new InstancedMesh(new BoxGeometry(1, 1, 1), this.mat, MAX);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -0.25;
  }

  bindSky(haze: Color): void {
    applyRadialHorizon(this.mat, haze, INNER, OUTER, "afd-city-hlod-v1");
  }

  update(wx: number, wz: number, force = false): void {
    const sx = Math.round(wx / 200) * 200;
    const sz = Math.round(wz / 200) * 200;
    if (
      !force &&
      Math.hypot(sx - this.lastSnap.x, sz - this.lastSnap.y) < 140
    ) {
      return;
    }
    this.lastSnap = { x: sx, y: sz };

    const half = WORLD_SIZE * 0.5;
    const i0 = Math.floor((sx + half - OUTER) / CELL);
    const i1 = Math.floor((sx + half + OUTER) / CELL);
    const j0 = Math.floor((sz + half - OUTER) / CELL);
    const j1 = Math.floor((sz + half + OUTER) / CELL);

    let n = 0;
    const m = new Matrix4();
    const p = new Vector3();
    const q = new Quaternion();
    const s = new Vector3();
    const up = new Vector3(0, 1, 0);

    for (let j = j0; j <= j1 && n < MAX; j++) {
      for (let i = i0; i <= i1 && n < MAX; i++) {
        const cx = -half + (i + 0.5) * CELL;
        const cz = -half + (j + 0.5) * CELL;
        if (Math.abs(cx) > half || Math.abs(cz) > half) continue;

        const dist = Math.hypot(cx - sx, cz - sz);
        if (dist < INNER || dist > OUTER) continue;
        if (isInsideAirbase(cx, cz)) continue;

        const region = sampleRegion(cx, cz);
        if (region !== Region.CITY && region !== Region.SUBURB) continue;

        const gh = sampleHeight(cx, cz);
        if (gh < 4) continue;

        const seed = (i * 73856093) ^ (j * 19349663);
        const city = region === Region.CITY;
        const h = city ? 28 + (seed % 55) : 10 + (seed % 14);
        const w = city ? 160 + ((seed >>> 3) % 120) : 90 + ((seed >>> 2) % 70);
        const d = city ? 140 + ((seed >>> 7) % 110) : 80 + ((seed >>> 5) % 60);
        const yaw = ((seed >>> 9) % 4) * (Math.PI * 0.5);

        p.set(cx, gh + h * 0.45, cz);
        q.setFromAxisAngle(up, yaw);
        s.set(w, h, d);
        m.compose(p, q, s);
        this.mesh.setMatrixAt(n, m);
        n++;
      }
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}
