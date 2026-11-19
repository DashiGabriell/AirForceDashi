import type {
  AircraftCatalogEntry,
  GameRewardConfig,
  ItemCatalogEntry,
} from "./schemas";

export const AIRCRAFT_CATALOG: AircraftCatalogEntry[] = [
  { id: "f22", name: "F-22 Raptor", category: "starter", costCredits: 0 },
  { id: "f15", name: "F-15 Eagle", category: "starter", costCredits: 8000 },
];

/** 12 Credits cosmetics — Common/Rare only (M5 Fase 4). */
export const ITEM_CATALOG: ItemCatalogEntry[] = [
  { id: "emb_star", name: "Emblema Estrela", kind: "emblem", rarity: "common", costCredits: 500, combatEffect: false },
  { id: "emb_lake", name: "Emblema Lago", kind: "emblem", rarity: "common", costCredits: 750, combatEffect: false },
  { id: "emb_wing", name: "Emblema Asa", kind: "emblem", rarity: "rare", costCredits: 2000, combatEffect: false },
  { id: "paint_grey", name: "Pintura Cinza", kind: "skin", rarity: "common", costCredits: 1000, combatEffect: false },
  { id: "paint_dusk", name: "Pintura Entardecer", kind: "skin", rarity: "common", costCredits: 1500, combatEffect: false },
  { id: "paint_camo", name: "Camuflagem Vale", kind: "skin", rarity: "rare", costCredits: 3500, combatEffect: false },
  { id: "paint_stripe", name: "Faixa SP", kind: "skin", rarity: "rare", costCredits: 4000, combatEffect: false },
  { id: "decal_num", name: "Decalque Número", kind: "decal", rarity: "common", costCredits: 600, combatEffect: false },
  { id: "decal_kill", name: "Decalque Marcas", kind: "decal", rarity: "rare", costCredits: 2500, combatEffect: false },
  { id: "frame_steel", name: "Moldura Aço", kind: "frame", rarity: "common", costCredits: 1200, combatEffect: false },
  { id: "frame_red", name: "Moldura Vermelha", kind: "frame", rarity: "rare", costCredits: 2000, combatEffect: false },
  { id: "pack_starter_look", name: "Pacote Visual Básico", kind: "skin", rarity: "rare", costCredits: 5000, combatEffect: false },
];

export const REWARD_TABLE: GameRewardConfig[] = [
  { mode: "checkpoint", baseCredits: 120, baseXp: 40, bonusCap: 50 },
  { mode: "antidrone", baseCredits: 160, baseXp: 50, bonusCap: 50 },
  { mode: "attack", baseCredits: 190, baseXp: 55, bonusCap: 50 },
  { mode: "tvt", baseCredits: 160, baseXp: 140, bonusCap: 30 },
  { mode: "freeflight", baseCredits: 40, baseXp: 15, bonusCap: 20 },
];

export function rewardFor(mode: GameRewardConfig["mode"]): GameRewardConfig {
  return REWARD_TABLE.find((r) => r.mode === mode) ?? REWARD_TABLE[2]!;
}
