import { lerp } from "../math/vec3";

export const AD_LEVEL_COUNT = 30;

export const DroneKind = {
  GERAN: 0,
  ORLAN: 1,
  LANCET: 2,
} as const;

export type DroneKindId = (typeof DroneKind)[keyof typeof DroneKind];

export interface WaveDef {
  kind: DroneKindId;
  count: number;
  speed: number;
  dive: number;
}

export interface AntiDroneDef {
  level: number;
  name: string;
  waves: WaveDef[];
  total: number;
  maxLeaks: number;
  spawnNear: number;
  impactDist: number;
  startAlt: number;
  waveGap: number;
}

const NAMES = [
  "FIRST SWARM", "SLOW INBOUND", "LAKE WATCH", "DOUBLE WAVE", "TUTORIAL END",
  "ORLAN MIX", "MID CHASE", "SPLIT SKY", "PRESSURE", "TEN KILLS",
  "LANCET INTRO", "FAST CUT", "THREE KINDS", "TIGHT WINDOW", "MID RANGE",
  "HEAVY SKY", "CROSSFIRE", "THIN MARGIN", "NARROW LEAK", "TWENTY",
  "HARD LOCK", "SPLIT PATH", "PRESSURE+", "THIN AIR", "RAPID WAVES",
  "FINAL SWARM", "ACE HUNT", "BLACK SORTIE", "LAST LIGHT", "CHECKMATE",
];

function wave(kind: DroneKindId, count: number, speed: number, dive: number): WaveDef {
  return {
    kind,
    count: Math.max(1, count),
    speed,
    dive: Math.min(1, Math.max(0.2, dive)),
  };
}

function wavesFor(lv: number, t: number): WaveDef[] {
  const { GERAN, ORLAN, LANCET } = DroneKind;
  if (lv <= 5) {
    const out = [wave(GERAN, 2 + lv, lerp(22, 28, t), 0.28)];
    if (lv >= 4) out.push(wave(GERAN, 2, 30, 0.35));
    return out;
  }
  if (lv <= 10) {
    return [
      wave(GERAN, 4 + (lv - 5), 30, 0.35),
      wave(ORLAN, 2 + (lv - 6), 36, 0.42),
    ];
  }
  if (lv <= 16) {
    return [
      wave(GERAN, 5, 32, 0.4),
      wave(ORLAN, 3 + (lv - 11), 40, 0.5),
      wave(LANCET, 1 + Math.floor((lv - 11) / 2), 48, 0.55),
    ];
  }
  if (lv <= 22) {
    return [
      wave(GERAN, 4, 34, 0.42),
      wave(ORLAN, 4, 44, 0.55),
      wave(LANCET, 3 + (lv - 17), 55, 0.65),
      wave(LANCET, 2, 60, 0.7),
    ];
  }
  const out = [
    wave(ORLAN, 3, 48, 0.6),
    wave(LANCET, 5 + (lv - 23), 62, 0.75),
    wave(GERAN, 3, 36, 0.48),
    wave(LANCET, 4, 68, 0.8),
  ];
  if (lv >= 28) out.push(wave(LANCET, 6, 72, 0.85));
  return out;
}

export function antidroneDef(level: number): AntiDroneDef {
  const lv = Math.min(AD_LEVEL_COUNT, Math.max(1, level));
  const t = (lv - 1) / (AD_LEVEL_COUNT - 1);
  const waves = wavesFor(lv, t);
  const total = waves.reduce((s, w) => s + w.count, 0);
  return {
    level: lv,
    name: NAMES[lv - 1] ?? `AD ${lv}`,
    waves,
    total,
    maxLeaks: Math.max(1, 3 - Math.floor(t * 2.2)),
    spawnNear: lerp(420, 620, t),
    impactDist: lerp(2200, 3200, t),
    startAlt: lerp(380, 620, t),
    waveGap: lerp(5.5, 3.2, t),
  };
}
