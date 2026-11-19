export interface AttackDef {
  level: number;
  name: string;
  /** 1–3 mission targets. */
  targetCount: number;
  timeLimitSec: number;
  /** Hits to collapse (damaged states before destroy). */
  hitsToDestroy: number;
}

export const AT_LEVEL_COUNT = 10;

const NAMES = [
  "Strike Lake",
  "Skyline Cut",
  "Harbor Punch",
  "Tower Fall",
  "Grid Sweep",
  "Neon Breach",
  "Dust Spire",
  "River Mark",
  "Glass Drop",
  "Last Stack",
];

export function attackDef(level: number): AttackDef {
  const lv = Math.min(AT_LEVEL_COUNT, Math.max(1, Math.floor(level)));
  const targetCount = lv <= 2 ? 1 : lv <= 6 ? 2 : 3;
  return {
    level: lv,
    name: NAMES[lv - 1] ?? `Attack ${lv}`,
    targetCount,
    timeLimitSec: 90 + lv * 8,
    hitsToDestroy: 2 + Math.min(2, Math.floor((lv - 1) / 3)),
  };
}
