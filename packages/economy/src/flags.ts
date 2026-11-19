import type { EconomyFlags } from "./schemas";
import { ITEM_CATALOG } from "./catalog";

export function defaultFlags(): EconomyFlags {
  const prices: Record<string, number> = {};
  for (const item of ITEM_CATALOG) {
    prices[item.id] = item.costCredits;
  }
  prices.f15 = 8000;
  return {
    f15CostCredits: 8000,
    matchBonusCap: 50,
    shopEnabled: true,
    prices,
  };
}
