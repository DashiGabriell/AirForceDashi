import { describe, expect, it } from "vitest";
import { ITEM_CATALOG } from "./catalog";
import { EconomyService } from "./service";

describe("EconomyService", () => {
  it("creates guest with starter F-22 and wallet", () => {
    const eco = new EconomyService();
    const g = eco.authGuest("TEST-1");
    expect(g.wallet.credits).toBe(500);
    const snap = eco.getSnapshot(g.playerId);
    expect(snap.aircraft.some((a) => a.aircraftId === "f22")).toBe(true);
  });

  it("grants match reward idempotently", () => {
    const eco = new EconomyService();
    const g = eco.authGuest();
    const a = eco.grantMatchReward(g.playerId, {
      matchId: "m1",
      mode: "checkpoint",
      won: true,
      timeLeftSec: 20,
    });
    expect(a.credited).toBeGreaterThanOrEqual(120);
    const bal = a.wallet.credits;
    const b = eco.grantMatchReward(g.playerId, {
      matchId: "m1",
      mode: "checkpoint",
      won: true,
    });
    expect(b.idempotent).toBe(true);
    expect(b.wallet.credits).toBe(bal);
  });

  it("does not punish defeat economically", () => {
    const eco = new EconomyService();
    const g = eco.authGuest();
    const before = g.wallet.credits;
    const r = eco.grantMatchReward(g.playerId, {
      matchId: "lose1",
      mode: "antidrone",
      won: false,
    });
    expect(r.credited).toBeGreaterThan(0);
    expect(r.wallet.credits).toBeGreaterThan(before);
  });

  it("abandons grant zero credits", () => {
    const eco = new EconomyService();
    const g = eco.authGuest();
    const r = eco.grantMatchReward(g.playerId, {
      matchId: "ab1",
      mode: "checkpoint",
      won: false,
      abandoned: true,
    });
    expect(r.credited).toBe(0);
  });

  it("unlocks F-15 for configured Credits", () => {
    const eco = new EconomyService();
    const g = eco.authGuest();
    eco.store.appendTx(g.playerId, 8000, "test_fund", "fund1");
    const buy = eco.purchaseAircraft(g.playerId, "f15");
    expect(buy.ok).toBe(true);
    expect(eco.store.ownsAircraft(g.playerId, "f15")).toBe(true);
  });

  it("shop sells only non-combat cosmetics", () => {
    const eco = new EconomyService();
    const g = eco.authGuest();
    eco.store.appendTx(g.playerId, 20000, "test_fund", "fund2");
    expect(ITEM_CATALOG.every((i) => i.combatEffect === false)).toBe(true);
    const item = ITEM_CATALOG[0]!;
    const buy = eco.purchaseItem(g.playerId, item.id);
    expect(buy.ok).toBe(true);
    const inv = eco.equipItem(g.playerId, item.id);
    expect(inv.find((i) => i.itemId === item.id)?.equipped).toBe(true);
  });

  it("exposes telemetry earned/spent", () => {
    const eco = new EconomyService();
    const g = eco.authGuest();
    eco.grantMatchReward(g.playerId, {
      matchId: "t1",
      mode: "checkpoint",
      won: true,
    });
    eco.store.appendTx(g.playerId, 5000, "fund", "f");
    eco.purchaseItem(g.playerId, "emb_star");
    const tel = eco.telemetrySummary();
    expect(tel.creditsEarned).toBeGreaterThan(0);
    expect(tel.creditsSpent).toBeGreaterThan(0);
    expect(tel.avgWallet).toBeGreaterThan(0);
  });

  it("feature flags override F-15 price", () => {
    const eco = new EconomyService();
    eco.patchFlags({ f15CostCredits: 100 });
    const g = eco.authGuest();
    eco.purchaseAircraft(g.playerId, "f15");
    expect(eco.store.ownsAircraft(g.playerId, "f15")).toBe(true);
  });

  it("progresses daily ops and claims idempotently", () => {
    const eco = new EconomyService();
    const g = eco.authGuest();
    eco.grantMatchReward(g.playerId, {
      matchId: "op1",
      mode: "checkpoint",
      won: true,
      aircraftId: "f22",
    });
    eco.grantMatchReward(g.playerId, {
      matchId: "op2",
      mode: "antidrone",
      won: true,
      kills: 10,
      aircraftId: "f15",
    });
    const ops = eco.listOperations(g.playerId);
    const matches = ops.find((o) => o.id === "daily_matches")!;
    expect(matches.complete).toBe(true);
    const claim = eco.claimOperation(g.playerId, "daily_matches");
    expect(claim.credited).toBe(100);
    expect(() => eco.claimOperation(g.playerId, "daily_matches")).toThrow();
  });

  it("mastery never affects combat and grants cosmetics/credits only", () => {
    const eco = new EconomyService();
    const g = eco.authGuest();
    expect(eco.masteryAffectsCombat()).toBe(false);
    for (let i = 0; i < 3; i++) {
      eco.grantMatchReward(g.playerId, {
        matchId: `mk${i}`,
        mode: "checkpoint",
        won: true,
        aircraftId: "f22",
      });
    }
    const m = eco.getMastery(g.playerId).find((r) => r.aircraftId === "f22")!;
    expect(m.level).toBeGreaterThanOrEqual(2);
    expect(m.combatBuff).toBe(false);
  });

  it("unlocks medals and exposes leaderboard from granted matches", () => {
    const eco = new EconomyService();
    const g = eco.authGuest();
    eco.grantMatchReward(g.playerId, {
      matchId: "lb1",
      mode: "checkpoint",
      won: true,
      timeLeftSec: 30,
      score: 1500,
    });
    const medals = eco.listMedals(g.playerId);
    expect(medals.find((m) => m.id === "first_flight")?.unlocked).toBe(true);
    expect(medals.find((m) => m.id === "checkpoint_clear")?.unlocked).toBe(true);
    const board = eco.getLeaderboard("checkpoint");
    expect(board[0]?.playerId).toBe(g.playerId);
    expect(board[0]?.score).toBeGreaterThan(0);
  });

  it("stub DC checkout and premium purchase without combat", () => {
    const eco = new EconomyService();
    const g = eco.authGuest();
    const buy = eco.stubCheckoutDc(g.playerId, "dc_100");
    expect(buy.stub).toBe(true);
    expect(buy.wallet.dashiCoins).toBe(100);
    const item = eco.purchasePremiumItem(g.playerId, "fx_smoke_gold");
    expect(item.ok).toBe(true);
    expect(eco.listPremiumShop().every((i) => i.combatEffect === false)).toBe(true);
    expect(() => eco.stubCheckoutDc(g.playerId, "starter_pack")).not.toThrow();
    expect(() => eco.stubCheckoutDc(g.playerId, "starter_pack")).toThrow();
  });

  it("battle pass stub unlock and claim free reward", () => {
    const eco = new EconomyService();
    const g = eco.authGuest();
    eco.grantMatchReward(g.playerId, {
      matchId: "s1",
      mode: "checkpoint",
      won: true,
    });
    const season = eco.getSeasonSnapshot(g.playerId);
    expect(season.level).toBeGreaterThanOrEqual(1);
    eco.stubBuyPass(g.playerId, "premium_bundle");
    const after = eco.getSeasonSnapshot(g.playerId);
    expect(after.hasPremium).toBe(true);
    expect(after.level).toBeGreaterThanOrEqual(6);
    const claim = eco.claimPassReward(g.playerId, 1, "free");
    expect(claim.ok).toBe(true);
  });

  it("tvt grant pays victory bonus", () => {
    const eco = new EconomyService();
    const g = eco.authGuest();
    const before = g.wallet.credits;
    const r = eco.grantMatchReward(g.playerId, {
      matchId: "tvt1",
      mode: "tvt",
      won: true,
    });
    expect(r.credited).toBeGreaterThanOrEqual(190);
    expect(r.wallet.credits).toBeGreaterThan(before);
  });
});
