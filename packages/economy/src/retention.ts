import type {
  AircraftId,
  MedalDef,
  MasteryLevelReward,
  OperationDef,
} from "./schemas";

/** Daily + Weekly templates (economia-v1.md §3). */
export const OPERATION_DEFS: OperationDef[] = [
  {
    id: "daily_matches",
    kind: "daily",
    title: "Complete 2 partidas",
    metric: "matches",
    target: 2,
    rewardCredits: 100,
    rewardXp: 100,
  },
  {
    id: "daily_kills",
    kind: "daily",
    title: "Destrua 10 drones ou alvos",
    metric: "kills",
    target: 10,
    rewardCredits: 100,
    rewardXp: 100,
  },
  {
    id: "daily_aircraft",
    kind: "daily",
    title: "Utilize uma aeronave diferente",
    metric: "distinct_aircraft",
    target: 2,
    rewardCredits: 100,
    rewardXp: 100,
  },
  {
    id: "daily_bonus",
    kind: "daily",
    title: "Complete os 3 desafios",
    metric: "matches",
    target: 1,
    rewardCredits: 150,
    rewardXp: 100,
    isBonus: true,
    requires: ["daily_matches", "daily_kills", "daily_aircraft"],
  },
  {
    id: "weekly_matches",
    kind: "weekly",
    title: "15 partidas",
    metric: "matches",
    target: 15,
    rewardCredits: 500,
    rewardXp: 300,
  },
  {
    id: "weekly_modes",
    kind: "weekly",
    title: "5 missões diferentes",
    metric: "distinct_modes",
    target: 3,
    rewardCredits: 400,
    rewardXp: 300,
  },
  {
    id: "weekly_special",
    kind: "weekly",
    title: "10 objetivos especiais",
    metric: "special_objectives",
    target: 10,
    rewardCredits: 300,
    rewardXp: 300,
  },
  {
    id: "weekly_bonus",
    kind: "weekly",
    title: "Complete todos os semanais",
    metric: "matches",
    target: 1,
    rewardCredits: 300,
    rewardXp: 300,
    isBonus: true,
    requires: ["weekly_matches", "weekly_modes", "weekly_special"],
  },
];

export const MASTERY_XP_CAP = 200;
export const MASTERY_MAX_LEVEL = 10;
/** XP thresholds to reach levels 2..10 (cumulative from 0). */
export const MASTERY_THRESHOLDS = [
  0, 200, 450, 750, 1100, 1500, 2000, 2600, 3300, 4100, 5000,
];

export function masteryLevelFromXp(xp: number): number {
  let level = 1;
  for (let i = 1; i < MASTERY_THRESHOLDS.length; i++) {
    if (xp >= MASTERY_THRESHOLDS[i]!) level = i + 1;
  }
  return Math.min(MASTERY_MAX_LEVEL, level);
}

const SPECIALIST_TITLE: Record<AircraftId, string> = {
  f22: "Raptor Specialist",
  f15: "Eagle Specialist",
  f16: "Falcon Specialist",
  fa18: "Hornet Specialist",
  typhoon: "Typhoon Specialist",
  rafale: "Rafale Specialist",
  su35: "Flanker Specialist",
  f35: "Lightning Specialist",
  f14: "Tomcat Specialist",
  gripen: "Gripen Specialist",
  mirage2000: "Mirage Specialist",
  f2: "Viper Zero Specialist",
  mig29: "Fulcrum Specialist",
  mig35: "Super Fulcrum Specialist",
  su57: "Felon Specialist",
  yf23: "Black Widow Specialist",
  f4: "Phantom Specialist",
  su34: "Fullback Specialist",
  a10: "Warthog Specialist",
  b2: "Spirit Specialist",
  u2: "Dragon Lady Specialist",
};

export function masteryRewardsFor(aircraftId: AircraftId): MasteryLevelReward[] {
  const prefix = aircraftId;
  const specialist = SPECIALIST_TITLE[aircraftId] ?? "Ace Specialist";
  return [
    { level: 2, kind: "cosmetic", itemId: `emb_${prefix}_mk`, label: "Emblema Mastery" },
    { level: 3, kind: "cosmetic", itemId: `paint_${prefix}_mk`, label: "Pintura Mastery" },
    { level: 4, kind: "credits", credits: 500, label: "500 Credits" },
    { level: 5, kind: "title", title: specialist, label: specialist },
    { level: 6, kind: "credits", credits: 800, label: "800 Credits" },
    { level: 7, kind: "cosmetic", itemId: `decal_${prefix}_mk`, label: "Decalque Mastery" },
    { level: 8, kind: "credits", credits: 1200, label: "1.200 Credits" },
    { level: 9, kind: "cosmetic", itemId: `frame_${prefix}_mk`, label: "Moldura Mastery" },
    {
      level: 10,
      kind: "cosmetic",
      itemId: `paint_${prefix}_master`,
      label: "Skin Mastery",
    },
  ];
}

export const MEDAL_CATALOG: MedalDef[] = [
  {
    id: "first_flight",
    name: "Primeiro Voo",
    description: "Complete sua primeira partida recompensada",
  },
  {
    id: "checkpoint_clear",
    name: "Anel Limpo",
    description: "Vença um nível de CheckPoint",
  },
  {
    id: "antidrone_ace",
    name: "Caça-Drone",
    description: "Vença uma partida Anti-Drone",
  },
  {
    id: "ten_kills",
    name: "Dez Alvos",
    description: "Acumule 10 kills em uma partida",
  },
  {
    id: "second_jet",
    name: "Frota Dupla",
    description: "Desbloqueie a segunda aeronave",
  },
  {
    id: "daily_complete",
    name: "Operador Diário",
    description: "Claim o bônus daily",
  },
  {
    id: "mastery_5",
    name: "Especialista",
    description: "Alcance Mastery nível 5 em qualquer aeronave",
  },
  {
    id: "credits_5k",
    name: "Tesouro de Lago",
    description: "Acumule 5.000 Credits na carteira",
  },
];

export function utcDayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/** ISO week key YYYY-Www */
export function utcWeekKey(d = new Date()): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function periodKeyFor(kind: "daily" | "weekly", d = new Date()): string {
  return kind === "daily" ? utcDayKey(d) : utcWeekKey(d);
}

export function nextResetIso(kind: "daily" | "weekly", d = new Date()): string {
  if (kind === "daily") {
    const n = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1));
    return n.toISOString();
  }
  const day = d.getUTCDay() || 7;
  const daysUntilMon = 8 - day;
  const n = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + daysUntilMon),
  );
  return n.toISOString();
}
