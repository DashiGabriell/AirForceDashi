import { AIRCRAFT_CATALOG, ITEM_CATALOG, rewardFor } from "./catalog";
import { defaultFlags } from "./flags";
import {
  DC_PACKS,
  PASS_OFFERS,
  PREMIUM_CATALOG,
  SEASON_LEVELS,
  SEASON_XP_PER_LEVEL,
  buildSeasonRewards,
  seasonEndsAt,
  seasonLevelFromXp,
} from "./monetization";
import {
  MASTERY_XP_CAP,
  MEDAL_CATALOG,
  OPERATION_DEFS,
  masteryLevelFromXp,
  masteryRewardsFor,
  nextResetIso,
  periodKeyFor,
} from "./retention";
import type {
  AircraftId,
  EconomyFlags,
  MatchMode,
  PlayerAccount,
  PlayerWallet,
} from "./schemas";
import { CURRENT_SEASON_ID, EconomyStore } from "./store";
import { xpProgress } from "./xp";

export interface GrantMatchInput {
  matchId: string;
  mode: MatchMode;
  won: boolean;
  abandoned?: boolean;
  /** Performance bonus before cap (0..n). */
  performanceBonus?: number;
  kills?: number;
  timeLeftSec?: number;
  aircraftId?: AircraftId;
  /** Score for solo leaderboard (higher = better). */
  score?: number;
}

export class EconomyService {
  readonly store = new EconomyStore();
  flags: EconomyFlags = defaultFlags();

  authGuest(callsign?: string): {
    token: string;
    playerId: string;
    callsign: string;
    wallet: PlayerWallet;
  } {
    const { account, wallet } = this.store.createGuest(callsign);
    return {
      token: account.token,
      playerId: account.playerId,
      callsign: account.callsign,
      wallet,
    };
  }

  requirePlayer(token: string): string {
    const id = this.store.playerIdFromToken(token);
    if (!id) throw new EconomyError("unauthorized", 401);
    return id;
  }

  getSnapshot(playerId: string) {
    const wallet = this.store.getWallet(playerId);
    const account = this.store.accounts.get(playerId);
    const progression = this.store.progression.get(playerId);
    if (!wallet || !account || !progression) {
      throw new EconomyError("not_found", 404);
    }
    const xp = xpProgress(progression.xp);
    return {
      playerId,
      callsign: account.callsign,
      wallet,
      progression: { ...progression, ...xp },
      aircraft: this.store.aircraft.get(playerId) ?? [],
      inventory: this.store.inventory.get(playerId) ?? [],
      mastery: this.store.mastery.get(playerId) ?? [],
      medals: this.listMedals(playerId),
      operations: this.listOperations(playerId),
      season: this.getSeasonSnapshot(playerId),
      flags: this.flags,
    };
  }

  grantMatchReward(playerId: string, input: GrantMatchInput) {
    if (this.store.grantIds.has(input.matchId)) {
      return {
        idempotent: true as const,
        wallet: this.store.getWallet(playerId)!,
        credited: 0,
        xp: 0,
        masteryXp: 0,
        seasonXp: 0,
        medalsUnlocked: [] as string[],
        operationsUpdated: 0,
      };
    }

    if (input.abandoned) {
      this.store.grantIds.add(input.matchId);
      return {
        idempotent: false as const,
        wallet: this.store.getWallet(playerId)!,
        credited: 0,
        xp: 0,
        masteryXp: 0,
        seasonXp: 0,
        medalsUnlocked: [] as string[],
        operationsUpdated: 0,
        note: "abandoned",
      };
    }

    const cfg = rewardFor(input.mode);
    let bonus = Math.max(0, input.performanceBonus ?? 0);
    if (input.won && input.timeLeftSec != null) {
      bonus += Math.floor(input.timeLeftSec * 0.3);
    }
    if (input.kills != null) bonus += input.kills * 8;
    const cap = Math.min(cfg.bonusCap, this.flags.matchBonusCap);
    bonus = Math.min(bonus, cap);

    // Defeat still pays base participation — no economic penalty
    let credits = cfg.baseCredits + (input.won ? bonus : Math.min(10, bonus));
    let xp = cfg.baseXp + (input.won ? Math.floor(bonus * 0.5) : 5);
    if (input.mode === "tvt" && input.won) {
      credits += 30;
    }

    this.store.appendTx(playerId, credits, `match_${input.mode}`, input.matchId);
    this.store.addXp(playerId, xp);
    this.store.grantIds.add(input.matchId);
    this.store.telemetry.matchesRewarded += 1;

    const seasonXp = this.addSeasonXp(playerId, input.won ? 120 : 40);

    const aircraftId = input.aircraftId ?? "f22";
    const masteryXp =
      input.mode === "tvt"
        ? 0
        : this.addMasteryXp(playerId, aircraftId, this.computeMasteryXp(input));
    const operationsUpdated = this.progressOperationsFromMatch(playerId, {
      mode: input.mode,
      kills: input.kills ?? 0,
      aircraftId,
      won: input.won,
    });
    const medalsUnlocked = this.evaluateMedals(playerId, {
      mode: input.mode,
      won: input.won,
      kills: input.kills ?? 0,
    });

    if (input.mode !== "tvt" && (input.score != null || input.won)) {
      this.submitSoloScore(
        playerId,
        input.mode,
        input.score ?? this.defaultScore(input),
        input.matchId,
      );
    }

    return {
      idempotent: false as const,
      wallet: this.store.getWallet(playerId)!,
      credited: credits,
      xp,
      masteryXp,
      seasonXp,
      medalsUnlocked,
      operationsUpdated,
    };
  }

  listOperations(playerId: string) {
    this.ensureOperationRows(playerId);
    const rows = this.store.operations.get(playerId) ?? [];
    const dayKey = periodKeyFor("daily");
    const weekKey = periodKeyFor("weekly");
    return OPERATION_DEFS.map((def) => {
      const key = def.kind === "daily" ? dayKey : weekKey;
      const row = rows.find((r) => r.defId === def.id && r.periodKey === key);
      const progress = row?.progress ?? 0;
      const claimed = row?.claimed ?? false;
      let complete = progress >= def.target;
      if (def.isBonus && def.requires) {
        complete = def.requires.every((id) => {
          const sibDef = OPERATION_DEFS.find((d) => d.id === id)!;
          const sib = rows.find((r) => r.defId === id && r.periodKey === key);
          return (sib?.progress ?? 0) >= sibDef.target;
        });
      }
      return {
        ...def,
        periodKey: key,
        progress: def.isBonus ? (complete ? 1 : 0) : progress,
        target: def.target,
        complete,
        claimed,
        claimable: complete && !claimed,
        resetsAt: nextResetIso(def.kind),
      };
    });
  }

  claimOperation(playerId: string, defId: string) {
    const ops = this.listOperations(playerId);
    const op = ops.find((o) => o.id === defId);
    if (!op) throw new EconomyError("unknown_operation", 404);
    if (!op.claimable) throw new EconomyError("not_claimable", 400);
    const refId = `op_${defId}_${op.periodKey}`;
    if (this.store.grantIds.has(refId)) {
      throw new EconomyError("already_claimed", 409);
    }
    this.store.appendTx(playerId, op.rewardCredits, `operation_${op.kind}`, refId);
    this.store.addXp(playerId, op.rewardXp);
    this.store.grantIds.add(refId);
    const rows = this.store.operations.get(playerId) ?? [];
    let row = rows.find((r) => r.defId === defId && r.periodKey === op.periodKey);
    if (!row) {
      row = { defId, periodKey: op.periodKey, progress: op.progress, claimed: true };
      rows.push(row);
    } else {
      row.claimed = true;
    }
    this.store.operations.set(playerId, rows);
    if (defId === "daily_bonus") {
      this.unlockMedal(playerId, "daily_complete");
    }
    return {
      ok: true as const,
      credited: op.rewardCredits,
      xp: op.rewardXp,
      wallet: this.store.getWallet(playerId)!,
      operations: this.listOperations(playerId),
    };
  }

  getMastery(playerId: string) {
    return (this.store.mastery.get(playerId) ?? []).map((row) => {
      const rewards = masteryRewardsFor(row.aircraftId);
      const next = rewards.find((r) => r.level > row.level);
      return {
        ...row,
        rewards,
        nextReward: next ?? null,
        combatBuff: false as const,
      };
    });
  }

  listMedals(playerId: string) {
    const owned = this.store.medals.get(playerId) ?? [];
    return MEDAL_CATALOG.map((m) => {
      const hit = owned.find((o) => o.medalId === m.id);
      return {
        ...m,
        unlocked: Boolean(hit),
        unlockedAt: hit?.unlockedAt ?? null,
      };
    });
  }

  getLeaderboard(mode: MatchMode, limit = 20) {
    const list = [...(this.store.leaderboards.get(mode) ?? [])];
    list.sort((a, b) => b.score - a.score);
    return list.slice(0, limit).map((e, i) => ({ rank: i + 1, ...e }));
  }

  purchaseAircraft(playerId: string, aircraftId: AircraftId) {
    if (this.store.ownsAircraft(playerId, aircraftId)) {
      throw new EconomyError("already_owned", 409);
    }
    const entry = AIRCRAFT_CATALOG.find((a) => a.id === aircraftId);
    if (!entry) throw new EconomyError("unknown_aircraft", 404);
    const cost =
      aircraftId === "f15" ? this.flags.f15CostCredits : entry.costCredits;
    if (cost <= 0) {
      this.store.unlockAircraft(playerId, aircraftId);
      return { ok: true, cost: 0, wallet: this.store.getWallet(playerId)! };
    }
    const refId = `buy_ac_${aircraftId}_${playerId}`;
    try {
      this.store.appendTx(playerId, -cost, "aircraft_unlock", refId);
    } catch {
      throw new EconomyError("insufficient_credits", 402);
    }
    this.store.unlockAircraft(playerId, aircraftId);
    this.ensureMasteryRow(playerId, aircraftId);
    this.unlockMedal(playerId, "second_jet");
    this.store.telemetry.purchases += 1;
    return { ok: true, cost, wallet: this.store.getWallet(playerId)! };
  }

  listShop() {
    return ITEM_CATALOG.map((item) => ({
      ...item,
      costCredits: this.flags.prices[item.id] ?? item.costCredits,
    }));
  }

  purchaseItem(playerId: string, itemId: string) {
    if (!this.flags.shopEnabled) throw new EconomyError("shop_disabled", 403);
    const item = ITEM_CATALOG.find((i) => i.id === itemId);
    if (!item) throw new EconomyError("unknown_item", 404);
    if (item.combatEffect !== false) {
      throw new EconomyError("combat_item_forbidden", 400);
    }
    const inv = this.store.inventory.get(playerId) ?? [];
    if (inv.some((i) => i.itemId === itemId)) {
      throw new EconomyError("already_owned", 409);
    }
    const cost = this.flags.prices[itemId] ?? item.costCredits;
    const refId = `buy_item_${itemId}_${playerId}`;
    try {
      this.store.appendTx(playerId, -cost, "shop_purchase", refId);
    } catch {
      throw new EconomyError("insufficient_credits", 402);
    }
    inv.push({
      playerId,
      itemId,
      equipped: false,
      acquiredAt: new Date().toISOString(),
    });
    this.store.inventory.set(playerId, inv);
    this.store.telemetry.purchases += 1;
    return { ok: true, cost, wallet: this.store.getWallet(playerId)!, inventory: inv };
  }

  equipItem(playerId: string, itemId: string) {
    const inv = this.store.inventory.get(playerId) ?? [];
    const row = inv.find((i) => i.itemId === itemId);
    if (!row) throw new EconomyError("not_owned", 404);
    const cat = ITEM_CATALOG.find((i) => i.id === itemId);
    for (const i of inv) {
      if (!cat) {
        i.equipped = false;
        continue;
      }
      const c = ITEM_CATALOG.find((x) => x.id === i.itemId);
      if (c && c.kind === cat.kind) i.equipped = false;
    }
    row.equipped = true;
    return inv;
  }

  telemetrySummary() {
    const t = this.store.telemetry;
    return {
      ...t,
      avgWallet:
        t.walletSamples > 0 ? Math.round(t.walletSum / t.walletSamples) : 0,
    };
  }

  patchFlags(partial: Partial<EconomyFlags>) {
    this.flags = {
      ...this.flags,
      ...partial,
      prices: { ...this.flags.prices, ...partial.prices },
    };
    return this.flags;
  }

  getAccount(playerId: string): PlayerAccount | undefined {
    return this.store.accounts.get(playerId);
  }

  /** Mastery never alters combat — exposed for tests / UI. */
  masteryAffectsCombat(): false {
    return false;
  }

  listDcPacks(playerId?: string) {
    const season = playerId ? this.store.getSeason(playerId) : null;
    return DC_PACKS.map((p) => ({
      ...p,
      owned: p.oneTime ? Boolean(season?.starterPackOwned) : false,
      available: !(p.oneTime && season?.starterPackOwned),
    }));
  }

  listPremiumShop() {
    return PREMIUM_CATALOG.map((item) => ({ ...item }));
  }

  listPassOffers() {
    return PASS_OFFERS.map((o) => ({ ...o }));
  }

  /** Stub checkout — no real payment provider. */
  stubCheckoutDc(playerId: string, packId: string) {
    const pack = DC_PACKS.find((p) => p.id === packId);
    if (!pack) throw new EconomyError("unknown_pack", 404);
    const season = this.ensureSeason(playerId);
    if (pack.oneTime && season.starterPackOwned) {
      throw new EconomyError("starter_owned", 409);
    }
    const refId = `stub_dc_${packId}_${playerId}_${Date.now()}`;
    this.store.appendTx(playerId, 0, "stub_dc_purchase", refId, pack.dashiCoins);
    if (pack.oneTime) {
      season.starterPackOwned = true;
      this.store.telemetry.starterPackClaims += 1;
    }
    this.store.telemetry.stubCheckouts += 1;
    return {
      ok: true as const,
      stub: true as const,
      packId,
      creditedDc: pack.dashiCoins,
      priceBrl: pack.priceBrl,
      wallet: this.store.getWallet(playerId)!,
    };
  }

  purchasePremiumItem(playerId: string, itemId: string) {
    const item = PREMIUM_CATALOG.find((i) => i.id === itemId);
    if (!item) throw new EconomyError("unknown_item", 404);
    if (item.combatEffect !== false) {
      throw new EconomyError("combat_item_forbidden", 400);
    }
    const inv = this.store.inventory.get(playerId) ?? [];
    if (inv.some((i) => i.itemId === itemId)) {
      throw new EconomyError("already_owned", 409);
    }
    const refId = `buy_dc_${itemId}_${playerId}`;
    try {
      this.store.appendTx(playerId, 0, "premium_purchase", refId, -item.costDashiCoins);
    } catch {
      throw new EconomyError("insufficient_dc", 402);
    }
    inv.push({
      playerId,
      itemId,
      equipped: false,
      acquiredAt: new Date().toISOString(),
    });
    this.store.inventory.set(playerId, inv);
    this.store.telemetry.purchases += 1;
    return {
      ok: true as const,
      costDc: item.costDashiCoins,
      wallet: this.store.getWallet(playerId)!,
      inventory: inv,
    };
  }

  getSeasonSnapshot(playerId: string) {
    const season = this.ensureSeason(playerId);
    const rewards = buildSeasonRewards(season.seasonId);
    return {
      ...season,
      endsAt: seasonEndsAt(),
      maxLevel: SEASON_LEVELS,
      xpPerLevel: SEASON_XP_PER_LEVEL,
      rewards: rewards.map((r) => ({
        ...r,
        claimable:
          season.level >= r.level &&
          (r.track === "free"
            ? !season.claimedFree.includes(r.level)
            : season.hasPremium && !season.claimedPremium.includes(r.level)),
        claimed:
          r.track === "free"
            ? season.claimedFree.includes(r.level)
            : season.claimedPremium.includes(r.level),
      })),
      offers: PASS_OFFERS,
    };
  }

  stubBuyPass(playerId: string, offerId: string) {
    const offer = PASS_OFFERS.find((o) => o.id === offerId);
    if (!offer) throw new EconomyError("unknown_offer", 404);
    const season = this.ensureSeason(playerId);
    if (season.hasPremium && offer.bonusLevels === 0) {
      throw new EconomyError("already_premium", 409);
    }
    season.hasPremium = true;
    if (offer.bonusLevels > 0) {
      season.xp += offer.bonusLevels * SEASON_XP_PER_LEVEL;
      season.level = seasonLevelFromXp(season.xp);
    }
    this.store.telemetry.passPurchases += 1;
    this.store.telemetry.stubCheckouts += 1;
    return {
      ok: true as const,
      stub: true as const,
      offerId,
      priceBrl: offer.priceBrl,
      season: this.getSeasonSnapshot(playerId),
    };
  }

  claimPassReward(playerId: string, level: number, track: "free" | "premium") {
    const season = this.ensureSeason(playerId);
    if (level < 1 || level > SEASON_LEVELS) {
      throw new EconomyError("invalid_level", 400);
    }
    if (season.level < level) throw new EconomyError("level_locked", 400);
    if (track === "premium" && !season.hasPremium) {
      throw new EconomyError("premium_required", 403);
    }
    const claimed =
      track === "free" ? season.claimedFree : season.claimedPremium;
    if (claimed.includes(level)) throw new EconomyError("already_claimed", 409);

    const reward = buildSeasonRewards(season.seasonId).find(
      (r) => r.level === level && r.track === track,
    );
    if (!reward) throw new EconomyError("unknown_reward", 404);

    const refId = `bp_${season.seasonId}_${track}_${level}_${playerId}`;
    if (this.store.grantIds.has(refId)) {
      throw new EconomyError("already_claimed", 409);
    }

    if (reward.kind === "credits" && reward.amount) {
      this.store.appendTx(playerId, reward.amount, "battle_pass", refId);
    } else if (reward.kind === "dc" && reward.amount) {
      this.store.appendTx(playerId, 0, "battle_pass_dc", refId, reward.amount);
    } else if (reward.kind === "cosmetic" && reward.itemId) {
      const inv = this.store.inventory.get(playerId) ?? [];
      if (!inv.some((i) => i.itemId === reward.itemId)) {
        inv.push({
          playerId,
          itemId: reward.itemId,
          equipped: false,
          acquiredAt: new Date().toISOString(),
        });
        this.store.inventory.set(playerId, inv);
      }
      this.store.grantIds.add(refId);
    }
    if (reward.kind !== "cosmetic") this.store.grantIds.add(refId);
    claimed.push(level);

    return {
      ok: true as const,
      reward,
      wallet: this.store.getWallet(playerId)!,
      season: this.getSeasonSnapshot(playerId),
    };
  }

  /** Local TvT lobby stub — no netcode. */
  createLobby(playerId: string, callsign: string) {
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    return {
      code,
      hostId: playerId,
      hostCallsign: callsign,
      slots: [
        { seat: 1, playerId, callsign, ready: false },
        { seat: 2, playerId: null, callsign: null, ready: false },
      ],
      status: "open" as const,
      note: "stub — sem matchmaking / netcode",
    };
  }

  private ensureSeason(playerId: string) {
    let season = this.store.getSeason(playerId);
    if (!season) {
      season = {
        playerId,
        seasonId: CURRENT_SEASON_ID,
        xp: 0,
        level: 1,
        hasPremium: false,
        claimedFree: [],
        claimedPremium: [],
        starterPackOwned: false,
      };
      this.store.seasons.set(playerId, season);
    }
    return season;
  }

  private addSeasonXp(playerId: string, amount: number): number {
    const season = this.ensureSeason(playerId);
    const gain = Math.max(0, amount);
    season.xp += gain;
    season.level = seasonLevelFromXp(season.xp);
    return gain;
  }

  private computeMasteryXp(input: GrantMatchInput): number {
    let xp = 100; // participate
    if (input.won) xp += 50;
    if (input.kills) xp += Math.min(50, input.kills * 5);
    return Math.min(MASTERY_XP_CAP, xp);
  }

  private defaultScore(input: GrantMatchInput): number {
    if (input.mode === "checkpoint") {
      return Math.max(0, Math.floor((input.timeLeftSec ?? 0) * 10) + (input.won ? 1000 : 0));
    }
    if (input.mode === "antidrone") {
      return (input.kills ?? 0) * 100 + (input.won ? 500 : 0);
    }
    if (input.mode === "attack") {
      return (input.kills ?? 0) * 200 + (input.won ? 800 : 0) + Math.floor((input.timeLeftSec ?? 0) * 5);
    }
    return 100;
  }

  private addMasteryXp(playerId: string, aircraftId: AircraftId, amount: number): number {
    const row = this.ensureMasteryRow(playerId, aircraftId);
    const gain = Math.min(MASTERY_XP_CAP, Math.max(0, amount));
    row.xp += gain;
    const prev = row.level;
    row.level = masteryLevelFromXp(row.xp);
    if (row.level > prev) {
      this.applyMasteryLevelRewards(playerId, aircraftId, prev + 1, row.level);
    }
    if (row.level >= 5) this.unlockMedal(playerId, "mastery_5");
    return gain;
  }

  private applyMasteryLevelRewards(
    playerId: string,
    aircraftId: AircraftId,
    fromLevel: number,
    toLevel: number,
  ) {
    const row = this.ensureMasteryRow(playerId, aircraftId);
    for (const reward of masteryRewardsFor(aircraftId)) {
      if (reward.level < fromLevel || reward.level > toLevel) continue;
      if (row.claimedLevels.includes(reward.level)) continue;
      row.claimedLevels.push(reward.level);
      if (reward.kind === "credits" && reward.credits) {
        this.store.appendTx(
          playerId,
          reward.credits,
          "mastery_reward",
          `mastery_${aircraftId}_L${reward.level}`,
        );
      }
      if (reward.kind === "cosmetic" && reward.itemId) {
        const inv = this.store.inventory.get(playerId) ?? [];
        if (!inv.some((i) => i.itemId === reward.itemId)) {
          inv.push({
            playerId,
            itemId: reward.itemId,
            equipped: false,
            acquiredAt: new Date().toISOString(),
          });
          this.store.inventory.set(playerId, inv);
        }
      }
    }
  }

  private ensureMasteryRow(playerId: string, aircraftId: AircraftId) {
    const list = this.store.mastery.get(playerId) ?? [];
    let row = list.find((r) => r.aircraftId === aircraftId);
    if (!row) {
      row = {
        playerId,
        aircraftId,
        xp: 0,
        level: 1,
        claimedLevels: [],
      };
      list.push(row);
      this.store.mastery.set(playerId, list);
    }
    return row;
  }

  private ensureOperationRows(playerId: string) {
    const dayKey = periodKeyFor("daily");
    const weekKey = periodKeyFor("weekly");
    const rows = this.store.operations.get(playerId) ?? [];
    for (const def of OPERATION_DEFS) {
      const key = def.kind === "daily" ? dayKey : weekKey;
      if (!rows.some((r) => r.defId === def.id && r.periodKey === key)) {
        rows.push({ defId: def.id, periodKey: key, progress: 0, claimed: false });
      }
    }
    this.store.operations.set(playerId, rows);
    return rows;
  }

  private progressOperationsFromMatch(
    playerId: string,
    stats: {
      mode: MatchMode;
      kills: number;
      aircraftId: AircraftId;
      won: boolean;
    },
  ): number {
    const rows = this.ensureOperationRows(playerId);
    const dayKey = periodKeyFor("daily");
    const weekKey = periodKeyFor("weekly");
    let sets = this.store.opSets.get(playerId);
    if (!sets || sets.dayKey !== dayKey || sets.weekKey !== weekKey) {
      sets = {
        aircraft: new Set(),
        modes: new Set(),
        dayKey,
        weekKey,
      };
      this.store.opSets.set(playerId, sets);
    }
    sets.aircraft.add(stats.aircraftId);
    sets.modes.add(stats.mode);

    let updated = 0;
    const bump = (defId: string, key: string, amount: number) => {
      const row = rows.find((r) => r.defId === defId && r.periodKey === key);
      if (!row || row.claimed) return;
      const def = OPERATION_DEFS.find((d) => d.id === defId)!;
      const next = Math.min(def.target, row.progress + amount);
      if (next !== row.progress) {
        row.progress = next;
        updated += 1;
      }
    };

    bump("daily_matches", dayKey, 1);
    bump("daily_kills", dayKey, stats.kills);
    bump("weekly_matches", weekKey, 1);
    if (stats.won) bump("weekly_special", weekKey, 1);

    const aircraftRow = rows.find(
      (r) => r.defId === "daily_aircraft" && r.periodKey === dayKey,
    );
    if (aircraftRow && !aircraftRow.claimed) {
      aircraftRow.progress = Math.min(2, sets.aircraft.size);
      updated += 1;
    }
    const modesRow = rows.find(
      (r) => r.defId === "weekly_modes" && r.periodKey === weekKey,
    );
    if (modesRow && !modesRow.claimed) {
      modesRow.progress = Math.min(3, sets.modes.size);
      updated += 1;
    }

    this.store.operations.set(playerId, rows);
    return updated;
  }

  private submitSoloScore(
    playerId: string,
    mode: MatchMode,
    score: number,
    matchId: string,
  ) {
    if (!this.store.grantIds.has(matchId)) return;
    const account = this.store.accounts.get(playerId);
    if (!account) return;
    const list = this.store.leaderboards.get(mode) ?? [];
    const existing = list.find((e) => e.playerId === playerId);
    if (existing) {
      if (score > existing.score) {
        existing.score = score;
        existing.matchId = matchId;
        existing.updatedAt = new Date().toISOString();
        existing.callsign = account.callsign;
      }
    } else {
      list.push({
        playerId,
        callsign: account.callsign,
        mode,
        score,
        matchId,
        updatedAt: new Date().toISOString(),
      });
    }
    this.store.leaderboards.set(mode, list);
  }

  private evaluateMedals(
    playerId: string,
    ev: { mode: MatchMode; won: boolean; kills: number },
  ): string[] {
    const unlocked: string[] = [];
    const tryUnlock = (id: string) => {
      if (this.unlockMedal(playerId, id)) unlocked.push(id);
    };
    tryUnlock("first_flight");
    if (ev.won && ev.mode === "checkpoint") tryUnlock("checkpoint_clear");
    if (ev.won && ev.mode === "antidrone") tryUnlock("antidrone_ace");
    if (ev.kills >= 10) tryUnlock("ten_kills");
    const wallet = this.store.getWallet(playerId);
    if (wallet && wallet.credits >= 5000) tryUnlock("credits_5k");
    return unlocked;
  }

  private unlockMedal(playerId: string, medalId: string): boolean {
    if (!MEDAL_CATALOG.some((m) => m.id === medalId)) return false;
    const list = this.store.medals.get(playerId) ?? [];
    if (list.some((m) => m.medalId === medalId)) return false;
    list.push({ medalId, unlockedAt: new Date().toISOString() });
    this.store.medals.set(playerId, list);
    return true;
  }
}

export class EconomyError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code);
    this.name = "EconomyError";
  }
}
