/** Target Practice — aim trainer (static first, movers later). */

export const TP_LEVEL_COUNT = 30;
/** Fully authored levels shipped in this pass. */
export const TP_AUTHORED_COUNT = 5;

export type LockPolicy = "free" | "lock_required" | "lock_forbidden";

export interface PracticeTargetSpawn {
  /** Metres ahead of spawn along jet heading. */
  forward: number;
  /** Metres to the right of heading. */
  right: number;
  /** Metres above spawn altitude. */
  up: number;
  /** Hit sphere radius (world units). */
  radius: number;
  /** 0 = static. Movers come after the authored block. */
  speed: number;
}

export interface TargetPracticeDef {
  level: number;
  name: string;
  lockPolicy: LockPolicy;
  /** 0 = no timer. */
  timeLimit: number;
  targets: PracticeTargetSpawn[];
}

const NAMES = [
  "BORE SIGHT",
  "LOCK DRILL",
  "CCIP ONLY",
  "MIXED RANGE",
  "TIGHT LOCK",
  "HOLD PATTERN",
  "WIDE FAN",
  "HIGH BALL",
  "LOW SLICE",
  "TEN RINGS",
  "PRESSURE",
  "SPLIT SKY",
  "NARROW GATE",
  "LONG SHOT",
  "RAPID ACQ",
  "HARD BORE",
  "CROSSWIND",
  "THIN MARGIN",
  "DEEP RANGE",
  "TWENTY",
  "ACE RING",
  "BLACK BOARD",
  "FINAL STATIC",
  "MOVE INTRO",
  "SLOW DRIFT",
  "CROSS PATH",
  "FAST CUT",
  "CHAOS BOX",
  "LAST LIGHT",
  "CHECKMATE",
];

function t(
  forward: number,
  right: number,
  up: number,
  radius: number,
  speed = 0,
): PracticeTargetSpawn {
  return { forward, right, up, radius, speed };
}

const AUTHORED: TargetPracticeDef[] = [
  {
    level: 1,
    name: NAMES[0]!,
    lockPolicy: "free",
    timeLimit: 0,
    targets: [
      t(380, -70, 40, 20),
      t(420, 0, 55, 20),
      t(380, 70, 40, 20),
    ],
  },
  {
    level: 2,
    name: NAMES[1]!,
    lockPolicy: "lock_required",
    timeLimit: 0,
    targets: [
      t(400, -90, 30, 16),
      t(440, -30, 50, 16),
      t(440, 30, 50, 16),
      t(400, 90, 30, 16),
    ],
  },
  {
    level: 3,
    name: NAMES[2]!,
    lockPolicy: "lock_forbidden",
    timeLimit: 0,
    targets: [
      t(520, -80, 20, 15),
      t(560, -25, 45, 15),
      t(560, 25, 45, 15),
      t(520, 80, 20, 15),
    ],
  },
  {
    level: 4,
    name: NAMES[3]!,
    lockPolicy: "free",
    timeLimit: 90,
    targets: [
      t(360, -110, 25, 14),
      t(420, -40, 60, 14),
      t(480, 0, 35, 14),
      t(420, 40, 60, 14),
      t(360, 110, 25, 14),
    ],
  },
  {
    level: 5,
    name: NAMES[4]!,
    lockPolicy: "lock_required",
    timeLimit: 100,
    targets: [
      t(450, -100, 20, 11),
      t(500, -45, 55, 11),
      t(540, 0, 35, 11),
      t(500, 45, 55, 11),
      t(450, 100, 20, 11),
    ],
  },
];

function procedural(level: number): TargetPracticeDef {
  const lv = Math.min(TP_LEVEL_COUNT, Math.max(6, Math.floor(level)));
  const tNorm = (lv - 6) / Math.max(1, TP_LEVEL_COUNT - 6);
  const count = Math.min(12, 5 + Math.floor(tNorm * 7));
  const radius = Math.max(8, 14 - tNorm * 5);
  const baseFwd = 420 + tNorm * 180;
  const policies: LockPolicy[] = ["free", "lock_required", "lock_forbidden"];
  const lockPolicy = policies[(lv - 1) % policies.length]!;
  const targets: PracticeTargetSpawn[] = [];
  for (let i = 0; i < count; i++) {
    const side = (i - (count - 1) * 0.5) * (55 + tNorm * 20);
    const fwd = baseFwd + (i % 3) * 40;
    const up = 20 + (i % 4) * 18;
    targets.push(t(fwd, side, up, radius, 0));
  }
  return {
    level: lv,
    name: NAMES[lv - 1] ?? `RANGE ${lv}`,
    lockPolicy,
    timeLimit: Math.round(80 + tNorm * 40),
    targets,
  };
}

export function targetPracticeDef(level: number): TargetPracticeDef {
  const lv = Math.min(TP_LEVEL_COUNT, Math.max(1, Math.floor(level)));
  if (lv <= TP_AUTHORED_COUNT) {
    return structuredClone(AUTHORED[lv - 1]!);
  }
  return procedural(lv);
}

function structuredClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}
