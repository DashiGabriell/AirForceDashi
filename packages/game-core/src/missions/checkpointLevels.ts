import { WATER_LEVEL } from "../constants";
import { lerp } from "../math/vec3";

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
  const rings = Math.min(3 + Math.floor(t * 9), 12);
  const turnAmp = lerp(0.1, 0.72, t);
  const altAmp = lerp(0.04, 0.58, t);
  return {
    level: lv,
    name: NAMES[lv - 1] ?? `LEVEL ${lv}`,
    rings,
    radius: lerp(55, 22, t),
    spacing: lerp(360, 210, t),
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
  return Math.abs(g.ny) >= 0.42;
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
  // First gate a bit ahead of the jet.
  const lead = d.spacing * 0.45;
  let x = origin.x - Math.sin(heading) * lead;
  let y = Math.max(origin.y, d.startAlt * 0.35 + origin.y * 0.65, WATER_LEVEL + 80);
  let z = origin.z - Math.cos(heading) * lead;

  const out: GatePoint[] = [];

  for (let i = 0; i < d.rings; i++) {
    const u = i / Math.max(1, d.rings - 1);
    const jitter = hash01(seed + i * 17.3);

    // --- Yaw: deliberate left/right path (S-curve → hairpins) ---
    // Two overlapping waves so the ribbon snakes instead of a boring sinusoid.
    const waveA = Math.sin(i * lerp(0.55, 1.15, t) + (seed % 5) * 0.4);
    const waveB = Math.sin(i * 0.35 + 1.7 + jitter * 0.6);
    let turn = (waveA * 0.75 + waveB * 0.35) * d.turnAmp;
    // Occasional hard corner on mid+ levels.
    if (t > 0.25 && i > 0 && i % Math.max(3, 6 - Math.floor(t * 3)) === 0) {
      const corner = (jitter > 0.5 ? 1 : -1) * d.turnAmp * lerp(0.85, 1.35, t);
      turn = corner;
    }
    yaw += turn;

    // --- Pitch: climb / dive so the path leaves the horizontal plane ---
    // Ladder blocks: climb for ~2 gates, flatten, dive, repeat — stronger with level.
    const block = Math.floor(i / 2);
    const ladder = ((block + (seed % 3)) % 2 === 0 ? 1 : -1) * d.altAmp;
    const gentle = Math.sin(i * lerp(0.4, 0.85, t) + 0.3) * d.altAmp * 0.55;
    let pitchTarget = ladder * lerp(0.35, 1, t) + gentle;
    // Early levels stay nearly flat; late levels commit to the ladder.
    pitchTarget *= lerp(0.35, 1, t);
    // Smooth toward target so consecutive gates form a readable arc.
    const follow = lerp(0.35, 0.7, t);
    pitch += (pitchTarget - pitch) * follow;
    pitch = clamp(pitch, -d.altAmp, d.altAmp);

    // Near the end of hard courses, force a final climb or dive punch.
    if (t > 0.5 && u > 0.72) {
      pitch = clamp(pitch + (jitter > 0.45 ? 1 : -1) * d.altAmp * 0.45, -d.altAmp, d.altAmp);
    }

    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    const nx = -Math.sin(yaw) * cp;
    const ny = sp;
    const nz = -Math.cos(yaw) * cp;
    const len = Math.hypot(nx, ny, nz) || 1;

    x += (nx / len) * d.spacing;
    y += (ny / len) * d.spacing;
    z += (nz / len) * d.spacing;

    y = Math.max(y, WATER_LEVEL + 70);
    if (heightFn) y = Math.max(y, heightFn(x, z) + 95);

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

  return out;
}
