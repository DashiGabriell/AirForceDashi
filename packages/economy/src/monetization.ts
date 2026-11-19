/** Dashi Coins packs + Battle Pass — economia-v1.md §9 / §11. */

export interface DcPack {
  id: string;
  name: string;
  dashiCoins: number;
  priceBrl: number;
  /** One-time offer */
  oneTime?: boolean;
}

export const DC_PACKS: DcPack[] = [
  { id: "dc_100", name: "100 DC", dashiCoins: 100, priceBrl: 4.9 },
  { id: "dc_250", name: "250 DC", dashiCoins: 250, priceBrl: 9.9 },
  { id: "dc_600", name: "600 DC", dashiCoins: 600, priceBrl: 19.9 },
  { id: "dc_1500", name: "1.500 DC", dashiCoins: 1500, priceBrl: 39.9 },
  { id: "dc_3500", name: "3.500 DC", dashiCoins: 3500, priceBrl: 79.9 },
  {
    id: "starter_pack",
    name: "Starter Pack",
    dashiCoins: 200,
    priceBrl: 9.9,
    oneTime: true,
  },
];

export interface PassOffer {
  id: "premium_pass" | "premium_bundle";
  name: string;
  priceBrl: number;
  /** Bundle grants these free levels on purchase. */
  bonusLevels: number;
}

export const PASS_OFFERS: PassOffer[] = [
  { id: "premium_pass", name: "Premium Pass", priceBrl: 24.9, bonusLevels: 0 },
  {
    id: "premium_bundle",
    name: "Premium Bundle",
    priceBrl: 39.9,
    bonusLevels: 5,
  },
];

export const SEASON_LEVELS = 35;
export const SEASON_XP_PER_LEVEL = 1000;
export const SEASON_WEEKS = 8;

export type PassTrack = "free" | "premium";

export interface PassRewardDef {
  level: number;
  track: PassTrack;
  kind: "credits" | "cosmetic" | "dc";
  amount?: number;
  itemId?: string;
  label: string;
}

/** Compact sample track — Free interesting, Premium more variety, no combat. */
export function buildSeasonRewards(seasonId: string): PassRewardDef[] {
  const out: PassRewardDef[] = [];
  for (let level = 1; level <= SEASON_LEVELS; level++) {
    if (level % 2 === 1) {
      out.push({
        level,
        track: "free",
        kind: "credits",
        amount: 80 + level * 4,
        label: `${80 + level * 4} Credits`,
      });
    } else {
      out.push({
        level,
        track: "free",
        kind: "cosmetic",
        itemId: `bp_${seasonId}_free_${level}`,
        label: `Emblema Free L${level}`,
      });
    }
    if (level % 3 === 0) {
      out.push({
        level,
        track: "premium",
        kind: "dc",
        amount: 10,
        label: "10 DC",
      });
    } else if (level % 5 === 0) {
      out.push({
        level,
        track: "premium",
        kind: "cosmetic",
        itemId: `bp_${seasonId}_prem_skin_${level}`,
        label: `Skin Premium L${level}`,
      });
    } else {
      out.push({
        level,
        track: "premium",
        kind: "credits",
        amount: 150 + level * 6,
        label: `${150 + level * 6} Credits`,
      });
    }
  }
  // Final reward
  out.push({
    level: SEASON_LEVELS,
    track: "premium",
    kind: "cosmetic",
    itemId: `bp_${seasonId}_finale`,
    label: "Recompensa Final da Temporada",
  });
  return out;
}

export interface PremiumCosmetic {
  id: string;
  name: string;
  rarity: "epic" | "legendary";
  costDashiCoins: number;
  combatEffect: false;
}

export const PREMIUM_CATALOG: PremiumCosmetic[] = [
  {
    id: "fx_smoke_gold",
    name: "Fumaça Dourada",
    rarity: "epic",
    costDashiCoins: 100,
    combatEffect: false,
  },
  {
    id: "fx_entry_flare",
    name: "Entrada Flare",
    rarity: "epic",
    costDashiCoins: 150,
    combatEffect: false,
  },
  {
    id: "frame_obsidian",
    name: "Moldura Obsidiana",
    rarity: "epic",
    costDashiCoins: 75,
    combatEffect: false,
  },
  {
    id: "skin_midnight",
    name: "Skin Meia-Noite",
    rarity: "legendary",
    costDashiCoins: 400,
    combatEffect: false,
  },
  {
    id: "skin_aurora",
    name: "Skin Aurora",
    rarity: "legendary",
    costDashiCoins: 500,
    combatEffect: false,
  },
  {
    id: "pack_identity",
    name: "Pacote Identidade",
    rarity: "epic",
    costDashiCoins: 250,
    combatEffect: false,
  },
];

export function seasonEndsAt(from = new Date()): string {
  const d = new Date(from.getTime());
  d.setUTCDate(d.getUTCDate() + SEASON_WEEKS * 7);
  return d.toISOString();
}

export function seasonLevelFromXp(xp: number): number {
  return Math.min(
    SEASON_LEVELS,
    Math.max(1, Math.floor(xp / SEASON_XP_PER_LEVEL) + 1),
  );
}
