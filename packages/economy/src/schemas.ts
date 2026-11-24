/** Economy schemas — mirror of economia-v1.md tables (in-memory / API). */

export type AircraftId =
  | "f22"
  | "f15"
  | "f16"
  | "fa18"
  | "typhoon"
  | "rafale"
  | "su35"
  | "f35"
  | "f14"
  | "gripen"
  | "mirage2000"
  | "f2"
  | "mig29"
  | "mig35"
  | "su57"
  | "yf23"
  | "f4"
  | "su34"
  | "a10"
  | "b2"
  | "u2";
export type ItemRarity = "common" | "rare" | "epic" | "legendary";
export type ItemKind = "skin" | "emblem" | "frame" | "decal" | "fx";
export type MatchMode =
  | "checkpoint"
  | "antidrone"
  | "freeflight"
  | "attack"
  | "targetpractice"
  | "tvt";

export interface PlayerWallet {
  playerId: string;
  credits: number;
  dashiCoins: number;
  updatedAt: string;
}

export interface WalletTransaction {
  id: string;
  playerId: string;
  /** Positive = credit, negative = debit */
  deltaCredits: number;
  deltaDashiCoins: number;
  reason: string;
  refId: string;
  createdAt: string;
  balanceAfter: number;
}

export interface PlayerProgression {
  playerId: string;
  xp: number;
  level: number;
  rank: string;
}

export interface AircraftCatalogEntry {
  id: AircraftId;
  name: string;
  category: "starter" | "entry" | "mid" | "advanced" | "special" | "elite";
  costCredits: number;
}

export interface PlayerAircraft {
  playerId: string;
  aircraftId: AircraftId;
  unlockedAt: string;
}

export interface ItemCatalogEntry {
  id: string;
  name: string;
  kind: ItemKind;
  rarity: ItemRarity;
  costCredits: number;
  costDashiCoins?: number;
  combatEffect: false;
}

export interface PlayerSeason {
  playerId: string;
  seasonId: string;
  xp: number;
  level: number;
  hasPremium: boolean;
  claimedFree: number[];
  claimedPremium: number[];
  starterPackOwned: boolean;
}

export interface PlayerInventoryItem {
  playerId: string;
  itemId: string;
  equipped: boolean;
  acquiredAt: string;
}

export interface GameRewardConfig {
  mode: MatchMode;
  baseCredits: number;
  baseXp: number;
  bonusCap: number;
}

export interface EconomyFlags {
  f15CostCredits: number;
  matchBonusCap: number;
  shopEnabled: boolean;
  prices: Record<string, number>;
}

export interface TelemetryCounters {
  creditsEarned: number;
  creditsSpent: number;
  matchesRewarded: number;
  purchases: number;
  walletSum: number;
  walletSamples: number;
  dcPurchased: number;
  dcSpent: number;
  stubCheckouts: number;
  passPurchases: number;
  starterPackClaims: number;
}

export interface PlayerAccount {
  playerId: string;
  token: string;
  callsign: string;
  createdAt: string;
}

export type OperationKind = "daily" | "weekly";
export type OperationMetric =
  | "matches"
  | "kills"
  | "distinct_aircraft"
  | "distinct_modes"
  | "special_objectives";

export interface OperationDef {
  id: string;
  kind: OperationKind;
  title: string;
  metric: OperationMetric;
  target: number;
  rewardCredits: number;
  rewardXp: number;
  /** Bonus mission that requires all siblings complete */
  isBonus?: boolean;
  requires?: string[];
}

export interface PlayerOperationProgress {
  defId: string;
  periodKey: string;
  progress: number;
  claimed: boolean;
}

export interface AircraftMasteryRow {
  playerId: string;
  aircraftId: AircraftId;
  xp: number;
  level: number;
  claimedLevels: number[];
}

export interface MasteryLevelReward {
  level: number;
  kind: "credits" | "title" | "cosmetic";
  credits?: number;
  title?: string;
  itemId?: string;
  label: string;
}

export interface MedalDef {
  id: string;
  name: string;
  description: string;
}

export interface PlayerMedal {
  medalId: string;
  unlockedAt: string;
}

export interface LeaderboardEntry {
  playerId: string;
  callsign: string;
  mode: MatchMode;
  score: number;
  matchId: string;
  updatedAt: string;
}
