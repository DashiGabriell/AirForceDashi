import { AIRBASE, airbaseWorld } from "./airbaseLayout";
import { CONTROL_TOWER } from "./controlTower";
import { PACIFIC_MAP } from "./pacificMap";

const WORLD_SIZE = PACIFIC_MAP.worldSize;
const {
  res: PACIFIC_RES,
  u16: PACIFIC_U16,
  hmin: PACIFIC_HMIN,
  hmax: PACIFIC_HMAX,
} = PACIFIC_MAP.heightfield;

/** World-space polyline (open or closed). */
export type RadarPoly = ReadonlyArray<{ readonly x: number; readonly z: number }>;

const SPAN = Math.max(PACIFIC_HMAX - PACIFIC_HMIN, 1e-6);
/** Land if height ≥ ~1.2 m (matches sampleRegion water cut). */
const LAND_U16 = Math.floor(((1.2 - PACIFIC_HMIN) / SPAN) * 65535);
/** Subsample heightmap for radar outline (~64² cells). */
const STEP = 8;

function isLand(ix: number, iz: number): boolean {
  const i = Math.min(PACIFIC_RES - 1, Math.max(0, iz)) * PACIFIC_RES
    + Math.min(PACIFIC_RES - 1, Math.max(0, ix));
  return (PACIFIC_U16[i] ?? 0) >= LAND_U16;
}

function cellToWorld(ix: number, iz: number): { x: number; z: number } {
  const half = WORLD_SIZE * 0.5;
  const u = ix / (PACIFIC_RES - 1);
  const v = iz / (PACIFIC_RES - 1);
  return { x: u * WORLD_SIZE - half, z: v * WORLD_SIZE - half };
}

type Pt = { x: number; z: number };
type Seg = [Pt, Pt];

function edgeKey(a: Pt, b: Pt): string {
  const a1 = `${a.x.toFixed(1)},${a.z.toFixed(1)}`;
  const b1 = `${b.x.toFixed(1)},${b.z.toFixed(1)}`;
  return a1 < b1 ? `${a1}|${b1}` : `${b1}|${a1}`;
}

/** Marching-squares land/water edges → chained coast polylines. */
function buildCoastlines(): RadarPoly[] {
  const segs: Seg[] = [];
  const seen = new Set<string>();

  const pushSeg = (a: Pt, b: Pt) => {
    const k = edgeKey(a, b);
    if (seen.has(k)) return;
    seen.add(k);
    segs.push([a, b]);
  };

  for (let iz = 0; iz < PACIFIC_RES - 1; iz += STEP) {
    for (let ix = 0; ix < PACIFIC_RES - 1; ix += STEP) {
      const ix1 = Math.min(PACIFIC_RES - 1, ix + STEP);
      const iz1 = Math.min(PACIFIC_RES - 1, iz + STEP);
      const c0 = isLand(ix, iz) ? 1 : 0;
      const c1 = isLand(ix1, iz) ? 1 : 0;
      const c2 = isLand(ix1, iz1) ? 1 : 0;
      const c3 = isLand(ix, iz1) ? 1 : 0;
      const code = c0 | (c1 << 1) | (c2 << 2) | (c3 << 3);
      if (code === 0 || code === 15) continue;

      const tl = cellToWorld(ix, iz);
      const tr = cellToWorld(ix1, iz);
      const br = cellToWorld(ix1, iz1);
      const bl = cellToWorld(ix, iz1);
      const t = { x: (tl.x + tr.x) * 0.5, z: (tl.z + tr.z) * 0.5 };
      const r = { x: (tr.x + br.x) * 0.5, z: (tr.z + br.z) * 0.5 };
      const b = { x: (bl.x + br.x) * 0.5, z: (bl.z + br.z) * 0.5 };
      const l = { x: (tl.x + bl.x) * 0.5, z: (tl.z + bl.z) * 0.5 };

      // Standard MS cases (simplified — dual edges for saddles).
      switch (code) {
        case 1:
        case 14:
          pushSeg(l, t);
          break;
        case 2:
        case 13:
          pushSeg(t, r);
          break;
        case 3:
        case 12:
          pushSeg(l, r);
          break;
        case 4:
        case 11:
          pushSeg(r, b);
          break;
        case 5:
          pushSeg(l, t);
          pushSeg(r, b);
          break;
        case 6:
        case 9:
          pushSeg(t, b);
          break;
        case 7:
        case 8:
          pushSeg(l, b);
          break;
        case 10:
          pushSeg(t, r);
          pushSeg(l, b);
          break;
        default:
          break;
      }
    }
  }

  return chainSegments(segs);
}

function ptKey(p: Pt): string {
  return `${p.x.toFixed(1)},${p.z.toFixed(1)}`;
}

function chainSegments(segs: Seg[]): RadarPoly[] {
  const adj = new Map<string, Pt[]>();
  const add = (a: Pt, b: Pt) => {
    const k = ptKey(a);
    let list = adj.get(k);
    if (!list) {
      list = [];
      adj.set(k, list);
    }
    list.push(b);
  };
  for (const [a, b] of segs) {
    add(a, b);
    add(b, a);
  }

  const used = new Set<string>();
  const polys: Pt[][] = [];

  const walk = (start: Pt, next: Pt): Pt[] => {
    const line: Pt[] = [start, next];
    used.add(edgeKey(start, next));
    let prev = start;
    let cur = next;
    for (;;) {
      const neigh = adj.get(ptKey(cur)) ?? [];
      let found: Pt | null = null;
      for (const n of neigh) {
        if (ptKey(n) === ptKey(prev)) continue;
        const ek = edgeKey(cur, n);
        if (used.has(ek)) continue;
        found = n;
        break;
      }
      if (!found) break;
      used.add(edgeKey(cur, found));
      line.push(found);
      prev = cur;
      cur = found;
      if (line.length > 8000) break;
    }
    return line;
  };

  for (const [a, b] of segs) {
    if (used.has(edgeKey(a, b))) continue;
    // Prefer starting at endpoints (degree 1).
    const degA = (adj.get(ptKey(a)) ?? []).length;
    const degB = (adj.get(ptKey(b)) ?? []).length;
    const line =
      degA <= degB ? walk(a, b) : walk(b, a);
    if (line.length >= 2) polys.push(simplify(line, 28));
  }

  return polys.filter((p) => p.length >= 2);
}

/** Drop points closer than `minDist` m (keeps ends). */
function simplify(pts: Pt[], minDist: number): Pt[] {
  if (pts.length <= 2) return pts;
  const out: Pt[] = [pts[0]!];
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i]!;
    const last = out[out.length - 1]!;
    if (Math.hypot(p.x - last.x, p.z - last.z) >= minDist) out.push(p);
  }
  out.push(pts[pts.length - 1]!);
  return out;
}

function rectPoly(
  cx: number,
  cz: number,
  hx: number,
  hz: number,
): RadarPoly {
  return [
    { x: cx - hx, z: cz - hz },
    { x: cx + hx, z: cz - hz },
    { x: cx + hx, z: cz + hz },
    { x: cx - hx, z: cz + hz },
    { x: cx - hx, z: cz - hz },
  ];
}

function buildInstallations(): RadarPoly[] {
  const out: RadarPoly[] = [];

  // Runway 09-27 (E–W).
  const rw = AIRBASE.runwayLength * 0.5;
  const rh = AIRBASE.runwayWidth * 0.5;
  out.push(rectPoly(AIRBASE.x, AIRBASE.z, rw, rh));

  // Parallel taxi strip (south of runway).
  const taxiZ = AIRBASE.z + AIRBASE.taxiOffset;
  out.push(
    rectPoly(AIRBASE.x, taxiZ, rw * 0.85, AIRBASE.taxiWidth * 0.5),
  );

  // Hangars / HAS / HQ / barracks / fuel / bunkers.
  const pads: Array<{ lx: number; lz: number; hx: number; hz: number }> = [
    { lx: -780, lz: 460, hx: 27, hz: 36 },
    { lx: -620, lz: 460, hx: 27, hz: 36 },
    { lx: -460, lz: 460, hx: 27, hz: 36 },
    { lx: -980, lz: 380, hx: 12, hz: 18 },
    { lx: -980, lz: 480, hx: 12, hz: 18 },
    { lx: -980, lz: 580, hx: 12, hz: 18 },
    { lx: -980, lz: 680, hx: 12, hz: 18 },
    { lx: -880, lz: 380, hx: 12, hz: 18 },
    { lx: -880, lz: 480, hx: 12, hz: 18 },
    { lx: -520, lz: 180, hx: 35, hz: 35 },
    { lx: -1100, lz: 200, hx: 9, hz: 14 },
    { lx: -1100, lz: 280, hx: 9, hz: 14 },
    { lx: -1100, lz: 360, hx: 9, hz: 14 },
    { lx: -1100, lz: 440, hx: 9, hz: 14 },
    { lx: 420, lz: 520, hx: 24, hz: 14 },
    { lx: 280, lz: 620, hx: 8, hz: 22 },
    { lx: 360, lz: 620, hx: 8, hz: 22 },
    { lx: 440, lz: 620, hx: 8, hz: 22 },
    { lx: 520, lz: 620, hx: 8, hz: 22 },
    { lx: 180, lz: 200, hx: 21, hz: 14 },
    { lx: -200, lz: 280, hx: 120, hz: 70 },
    { lx: 520, lz: 260, hx: 90, hz: 55 },
  ];
  for (const p of pads) {
    const w = airbaseWorld(p.lx, p.lz);
    out.push(rectPoly(w.x, w.z, p.hx, p.hz));
  }

  // Summit control tower.
  out.push(
    rectPoly(
      CONTROL_TOWER.x,
      CONTROL_TOWER.z,
      CONTROL_TOWER.halfX * 1.4,
      CONTROL_TOWER.halfZ * 1.4,
    ),
  );

  return out;
}

let cached: { coast: RadarPoly[]; install: RadarPoly[] } | null = null;

function ensureCache(): { coast: RadarPoly[]; install: RadarPoly[] } {
  if (!cached) {
    cached = {
      coast: buildCoastlines(),
      install: buildInstallations(),
    };
  }
  return cached;
}

/** Island coast outlines for the free-flight radar (soft white). */
export function radarCoastPolys(): RadarPoly[] {
  return ensureCache().coast;
}

/** Airbase / tower footprints for the free-flight radar. */
export function radarInstallPolys(): RadarPoly[] {
  return ensureCache().install;
}
