/** Offline reward DTO — server will validate later (economia-v1). */

export interface MissionRewardDto {
  mode: "checkpoint" | "antidrone" | "freeflight" | "attack";
  level: number;
  won: boolean;
  /** Display units only — not authoritative currency. */
  creditsPreview: number;
  xpPreview: number;
  timeLeftSec: number | null;
  kills: number | null;
  callsign: string;
  aircraft: number;
  clearedAt: string;
}

export function previewReward(input: {
  mode: MissionRewardDto["mode"];
  level: number;
  won: boolean;
  timeLeftSec?: number | null;
  kills?: number | null;
  callsign: string;
  aircraft: number;
}): MissionRewardDto {
  const attackBoost = input.mode === "attack" ? 30 : 0;
  const base = input.won ? 40 + input.level * 8 + attackBoost : 5;
  const timeBonus = input.won && input.timeLeftSec != null
    ? Math.floor(input.timeLeftSec * 0.4)
    : 0;
  const killBonus = input.kills != null ? input.kills * 12 : 0;
  return {
    mode: input.mode,
    level: input.level,
    won: input.won,
    creditsPreview: base + timeBonus + killBonus,
    xpPreview: input.won ? 20 + input.level * 5 + killBonus : 2,
    timeLeftSec: input.timeLeftSec ?? null,
    kills: input.kills ?? null,
    callsign: input.callsign,
    aircraft: input.aircraft,
    clearedAt: new Date().toISOString(),
  };
}
