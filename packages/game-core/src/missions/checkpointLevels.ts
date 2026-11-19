import { WATER_LEVEL } from "../constants";
import { lerp } from "../math/vec3";

export const CP_LEVEL_COUNT = 30;

export interface CheckpointDef {
  level: number;
  name: string;
  rings: number;
  radius: number;
  spacing: number;
  timeLimit: number;
  turnAmp: number;
  altAmp: number;
  startAlt: number;
  bankTwist: number;
}

export interface GatePoint {
  x: number;
  y: number;
  z: number;
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

export function checkpointDef(level: number): CheckpointDef {
  const lv = Math.min(CP_LEVEL_COUNT, Math.max(1, level));
  const t = (lv - 1) / (CP_LEVEL_COUNT - 1);
  const rings = Math.min(3 + Math.floor(t * 9), 12);
  return {
    level: lv,
    name: NAMES[lv - 1] ?? `LEVEL ${lv}`,
    rings,
    radius: lerp(55, 22, t),
    spacing: lerp(380, 220, t),
    timeLimit: lerp(75, 95, t) + rings * lerp(9, 6.5, t),
    turnAmp: lerp(40, 220, t),
    altAmp: lerp(0, 180, t),
    startAlt: lerp(240, 520, t),
    bankTwist: lerp(0, 0.55, t),
  };
}

export function buildCheckpointPoints(
  level: number,
  origin: { x: number; y: number; z: number },
  heading: number,
  heightFn?: (x: number, z: number) => number,
): GatePoint[] {
  const d = checkpointDef(level);
  const fwdX = -Math.sin(heading);
  const fwdZ = -Math.cos(heading);
  const rightX = Math.cos(heading);
  const rightZ = -Math.sin(heading);
  const seed = (level * 2654435761) >>> 0;
  const out: GatePoint[] = [];

  for (let i = 0; i < d.rings; i++) {
    const along = d.spacing * (i + 1);
    const phase = i * 0.85 + (seed % 7) * 0.15;
    let side = Math.sin(phase) * d.turnAmp;
    if (i % 3 === 2) side *= -0.65;
    const up = Math.sin(phase * 0.7 + 0.4) * d.altAmp;
    let x = origin.x + fwdX * along + rightX * side;
    let y = origin.y + up;
    let z = origin.z + fwdZ * along + rightZ * side;
    y = Math.max(y, WATER_LEVEL + 60);
    if (heightFn) y = Math.max(y, heightFn(x, z) + 80);
    const yawOff = Math.sin(phase * 1.1) * d.bankTwist;
    const nx = -Math.sin(heading + yawOff);
    const nz = -Math.cos(heading + yawOff);
    out.push({ x, y, z, nx, ny: 0, nz, radius: d.radius });
  }
  return out;
}
