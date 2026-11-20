import type {
  AircraftCatalogEntry,
  AircraftId,
  GameRewardConfig,
  ItemCatalogEntry,
} from "./schemas";

export const AIRCRAFT_CATALOG: AircraftCatalogEntry[] = [
  { id: "f22", name: "F-22 Raptor", category: "starter", costCredits: 0 },
  { id: "f15", name: "F-15 Eagle", category: "starter", costCredits: 8000 },
  { id: "f16", name: "F-16 Fighting Falcon", category: "entry", costCredits: 18000 },
  { id: "fa18", name: "F/A-18F Super Hornet", category: "mid", costCredits: 32000 },
  { id: "typhoon", name: "Eurofighter Typhoon", category: "advanced", costCredits: 50000 },
  { id: "rafale", name: "Rafale M", category: "advanced", costCredits: 50000 },
  { id: "su35", name: "Su-35", category: "special", costCredits: 75000 },
  { id: "f35", name: "F-35 Lightning II", category: "special", costCredits: 75000 },
  { id: "f14", name: "F-14 Tomcat", category: "mid", costCredits: 28000 },
  { id: "gripen", name: "JAS 39 Gripen", category: "entry", costCredits: 22000 },
  { id: "mirage2000", name: "Mirage 2000", category: "mid", costCredits: 26000 },
  { id: "f2", name: "Mitsubishi F-2", category: "mid", costCredits: 32000 },
  { id: "mig29", name: "MiG-29", category: "mid", costCredits: 30000 },
  { id: "mig35", name: "MiG-35", category: "advanced", costCredits: 45000 },
  { id: "su57", name: "Su-57 Felon", category: "elite", costCredits: 90000 },
  { id: "yf23", name: "YF-23 Black Widow II", category: "elite", costCredits: 85000 },
  { id: "f4", name: "F-4 Phantom II", category: "entry", costCredits: 15000 },
  { id: "su34", name: "Su-34 Fullback", category: "special", costCredits: 70000 },
  { id: "a10", name: "A-10 Thunderbolt II", category: "special", costCredits: 55000 },
  { id: "b2", name: "B-2 Spirit", category: "elite", costCredits: 120000 },
  { id: "u2", name: "U-2 Dragon Lady", category: "special", costCredits: 65000 },
];

export function isAircraftId(value: unknown): value is AircraftId {
  return (
    typeof value === "string" &&
    AIRCRAFT_CATALOG.some((entry) => entry.id === value)
  );
}

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
