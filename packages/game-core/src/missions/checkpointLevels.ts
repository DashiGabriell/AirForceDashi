import { WATER_LEVEL } from "../constants";
import { lerp } from "../math/vec3";
import { NE_VILLAGE } from "../world/places";

/** Every checkpoint level starts over NE Village, nose toward the map interior. */
export const CHECKPOINT_START = {
  x: NE_VILLAGE.x,
  z: NE_VILLAGE.z,
  heading: Math.atan2(NE_VILLAGE.x, NE_VILLAGE.z),
};
/** Straight run to the first gate so it is not on top of the jet. */
export const CHECKPOINT_FIRST_LEAD = 1800;

export const CP_LEVEL_COUNT = 30;

export interface CheckpointDef {
  level: number;
  name: string;
  rings: number;
  radius: number;
  /** Path step length between consecutive gates (m). */
  spacing: number;
  timeLimit: number;
  /** Max yaw change per gate (rad). */
  turnAmp: number;
  /** Max path pitch magnitude (rad). */
  altAmp: number;
  startAlt: number;
}

export interface GatePoint {
  x: number;
  y: number;
  z: number;
  /** Unit normal = path tangent (fly-through axis). */
  nx: number;
  ny: number;
  nz: number;
  radius: number;
}

const NAMES = [
  "FIRST GATES", "LAKE LANE", "EASY SWEEP", "SHORE HOPS", "GENTLE S",
  "VALLEY RUN", "LOW STRAFE", "RIDGE LINE", "CITY EDGE", "TEN GATES",
  "TIGHT TURN", "ALTITUDE WAVE", "NEEDLE PASS", "STEEP ENTRY", "MID RANGE",
  "ZIPPER", "CROSSWIND S", "SKY LADDER", "NARROW GATES", "TWENTY",
  "HARD BANK", "SPLIT PATH", "PRESSURE", "THIN AIR", "RAPID GATES",
  "FINAL APPROACH", "ACE RUN", "BLACK DIAMOND", "LAST LIGHT", "CHECKMATE",
];

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function hash01(n: number): number {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

export function checkpointDef(level: number): CheckpointDef {
  const lv = Math.min(CP_LEVEL_COUNT, Math.max(1, level));
  const t = (lv - 1) / (CP_LEVEL_COUNT - 1);
  // Front-load so early levels already diverge (lv1 ≠ lv4 ≠ lv10).
  const ease = 1 - (1 - t) * (1 - t);
  const rings = Math.min(4 + Math.floor(ease * 8), 12);
  const turnAmp = lerp(0.38, 1.15, ease);
  /** 0 on the first levels (rings stay upright). Climbs appear from ~lv 6. */
  const altAmp = t < 0.12 ? 0 : lerp(0.15, 0.95, ease);
  return {
    level: lv,
    name: NAMES[lv - 1] ?? `LEVEL ${lv}`,
    rings,
    radius: lerp(55, 22, t),
    spacing: lerp(480, 820, ease),
    // Extra budget for banking / climbing the designed path.
    timeLimit:
      lerp(78, 105, t) +
      rings * lerp(10, 7.5, t) +
      turnAmp * 28 +
      altAmp * 36,
    turnAmp,
    altAmp,
    startAlt: lerp(240, 520, t),
  };
}

/**
 * True when the gate lies closer to horizontal ("deitado") than vertical ("de pé").
 * Driven by path pitch: climb/dive segments lay the ring flat.
 */
export function gateIsFlat(g: Pick<GatePoint, "ny">): boolean {
  return Math.abs(g.ny) >= 0.35;
}

/**
 * Build a flyable 3D ribbon: S-curves + climb/dive ladders that intensify with level.
 * Each gate faces along the path tangent (upright on flat legs, laid flat on steep legs).
 */
export function buildCheckpointPoints(
  level: number,
  origin: { x: number; y: number; z: number },
  heading: number,
  heightFn?: (x: number, z: number) => number,
): GatePoint[] {
  const d = checkpointDef(level);
  const t = (d.level - 1) / (CP_LEVEL_COUNT - 1);
  const seed = (d.level * 2654435761) >>> 0;

  let yaw = heading;
  let pitch = 0;
  let x = origin.x;
  let y = origin.y;
  let z = origin.z;

  const out: GatePoint[] = [];

  for (let i = 0; i < d.rings; i++) {
    const jitter = hash01(seed + i * 17.3);
    const first = i === 0;
    // First leg stays on the spawn heading so the opening gate is straight ahead.
    if (!first) {
      const hand = (d.level % 2 === 0 ? -1 : 1) * (i % 2 === 0 ? 1 : -1);
      let turn = hand * d.turnAmp * (0.75 + 0.25 * Math.sin(i * 1.3 + d.level));
      if (t > 0.28 && i % 4 === 0) {
        turn = hand * d.turnAmp * lerp(1.1, 1.45, t);
      }
      yaw += turn;
    }
    const step = first ? CHECKPOINT_FIRST_LEAD : d.spacing;

    // Climb / level / dive / level. Flat legs keep the ring upright ("de pé").
    // Steep legs lay it down ("deitado"). Early levels stay level.
    let pitchTarget = 0;
    if (d.altAmp > 0) {
      const leg = Math.floor(i / 2) % 4;
      const climbSign = d.level % 3 === 0 ? -1 : 1;
      if (leg === 0) pitchTarget = climbSign * d.altAmp;
      else if (leg === 2) pitchTarget = -climbSign * d.altAmp;
      else pitchTarget = 0;
      if (jitter > 0.82) pitchTarget *= 0.45;
    }
    pitch += (pitchTarget - pitch) * (d.altAmp > 0 ? 0.9 : 1);
    pitch = clamp(pitch, -Math.max(d.altAmp, 0.001), Math.max(d.altAmp, 0.001));
    if (d.altAmp === 0) pitch = 0;

    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    const nx = -Math.sin(yaw) * cp;
    const ny = sp;
    const nz = -Math.cos(yaw) * cp;
    const len = Math.hypot(nx, ny, nz) || 1;

    x += (nx / len) * step;
    y += (ny / len) * step;
    z += (nz / len) * step;

    out.push({
      x,
      y,
      z,
      nx: nx / len,
      ny: ny / len,
      nz: nz / len,
      radius: d.radius,
    });
  }

  // Lift the whole ribbon together so terrain clearance does not flatten climbs.
  let lift = WATER_LEVEL + 80 - Math.min(...out.map((g) => g.y));
  if (heightFn) {
    for (const g of out) {
      lift = Math.max(lift, heightFn(g.x, g.z) + 110 - g.y);
    }
  }
  if (lift > 0) {
    for (const g of out) g.y += lift;
  }

  return out;
}
