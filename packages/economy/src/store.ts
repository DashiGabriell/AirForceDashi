import type {
  AircraftId,
  AircraftMasteryRow,
  LeaderboardEntry,
  MatchMode,
  PlayerAccount,
  PlayerAircraft,
  PlayerInventoryItem,
  PlayerMedal,
  PlayerOperationProgress,
  PlayerProgression,
  PlayerSeason,
  PlayerWallet,
  TelemetryCounters,
  WalletTransaction,
} from "./schemas";
import { levelFromXp, rankFromLevel } from "./xp";

export const CURRENT_SEASON_ID = "s1_lake_dusk";

export class EconomyStore {
  accounts = new Map<string, PlayerAccount>();
  tokens = new Map<string, string>(); // token → playerId
  wallets = new Map<string, PlayerWallet>();
  txs: WalletTransaction[] = [];
  progression = new Map<string, PlayerProgression>();
  aircraft = new Map<string, PlayerAircraft[]>();
  inventory = new Map<string, PlayerInventoryItem[]>();
  /** grant refId → already applied */
  grantIds = new Set<string>();
  /** playerId → operation progress rows */
  operations = new Map<string, PlayerOperationProgress[]>();
  /** playerId → mastery rows */
  mastery = new Map<string, AircraftMasteryRow[]>();
  /** playerId → medals */
  medals = new Map<string, PlayerMedal[]>();
  /** playerId → season progress */
  seasons = new Map<string, PlayerSeason>();
  /** mode → leaderboard entries */
  leaderboards = new Map<MatchMode, LeaderboardEntry[]>();
  /** playerId → period sets for distinct tracking */
  opSets = new Map<
    string,
    {
      aircraft: Set<string>;
      modes: Set<string>;
      dayKey: string;
      weekKey: string;
    }
  >();
  telemetry: TelemetryCounters = {
    creditsEarned: 0,
    creditsSpent: 0,
    matchesRewarded: 0,
    purchases: 0,
    walletSum: 0,
    walletSamples: 0,
    dcPurchased: 0,
    dcSpent: 0,
    stubCheckouts: 0,
    passPurchases: 0,
    starterPackClaims: 0,
  };

  createGuest(callsign = "DASHI-1"): { account: PlayerAccount; wallet: PlayerWallet } {
    const playerId = `p_${cryptoRandom()}`;
    const token = `t_${cryptoRandom()}`;
    const now = new Date().toISOString();
    const account: PlayerAccount = {
      playerId,
      token,
      callsign: callsign.slice(0, 16),
      createdAt: now,
    };
    this.accounts.set(playerId, account);
    this.tokens.set(token, playerId);
    const wallet: PlayerWallet = {
      playerId,
      credits: 500,
      dashiCoins: 0,
      updatedAt: now,
    };
    this.wallets.set(playerId, wallet);
    this.progression.set(playerId, {
      playerId,
      xp: 0,
      level: 1,
      rank: rankFromLevel(1),
    });
    this.aircraft.set(playerId, [
      { playerId, aircraftId: "f22", unlockedAt: now },
    ]);
    this.inventory.set(playerId, []);
    this.operations.set(playerId, []);
    this.mastery.set(playerId, [
      {
        playerId,
        aircraftId: "f22",
        xp: 0,
        level: 1,
        claimedLevels: [],
      },
    ]);
    this.medals.set(playerId, []);
    this.seasons.set(playerId, {
      playerId,
      seasonId: CURRENT_SEASON_ID,
      xp: 0,
      level: 1,
      hasPremium: false,
      claimedFree: [],
      claimedPremium: [],
      starterPackOwned: false,
    });
    this.sampleWallet(wallet.credits);
    return { account, wallet };
  }

  playerIdFromToken(token: string): string | null {
    return this.tokens.get(token) ?? null;
  }

  getWallet(playerId: string): PlayerWallet | null {
    return this.wallets.get(playerId) ?? null;
  }

  appendTx(
    playerId: string,
    deltaCredits: number,
    reason: string,
    refId: string,
    deltaDashiCoins = 0,
  ): WalletTransaction {
    const wallet = this.wallets.get(playerId);
    if (!wallet) throw new Error("wallet_missing");
    wallet.credits += deltaCredits;
    wallet.dashiCoins += deltaDashiCoins;
    if (wallet.credits < 0) {
      wallet.credits -= deltaCredits;
      wallet.dashiCoins -= deltaDashiCoins;
      throw new Error("insufficient_credits");
    }
    if (wallet.dashiCoins < 0) {
      wallet.credits -= deltaCredits;
      wallet.dashiCoins -= deltaDashiCoins;
      throw new Error("insufficient_dc");
    }
    wallet.updatedAt = new Date().toISOString();
    const tx: WalletTransaction = {
      id: `tx_${cryptoRandom()}`,
      playerId,
      deltaCredits,
      deltaDashiCoins,
      reason,
      refId,
      createdAt: wallet.updatedAt,
      balanceAfter: wallet.credits,
    };
    this.txs.push(tx);
    if (deltaCredits > 0) this.telemetry.creditsEarned += deltaCredits;
    if (deltaCredits < 0) this.telemetry.creditsSpent += -deltaCredits;
    if (deltaDashiCoins > 0) this.telemetry.dcPurchased += deltaDashiCoins;
    if (deltaDashiCoins < 0) this.telemetry.dcSpent += -deltaDashiCoins;
    this.sampleWallet(wallet.credits);
    return tx;
  }

  getSeason(playerId: string): PlayerSeason | null {
    return this.seasons.get(playerId) ?? null;
  }

  addXp(playerId: string, amount: number): PlayerProgression {
    const prog = this.progression.get(playerId);
    if (!prog) throw new Error("progression_missing");
    prog.xp += Math.max(0, amount);
    prog.level = levelFromXp(prog.xp);
    prog.rank = rankFromLevel(prog.level);
    return prog;
  }

  ownsAircraft(playerId: string, aircraftId: AircraftId): boolean {
    return (this.aircraft.get(playerId) ?? []).some((a) => a.aircraftId === aircraftId);
  }

  unlockAircraft(playerId: string, aircraftId: AircraftId): PlayerAircraft {
    const list = this.aircraft.get(playerId) ?? [];
    if (list.some((a) => a.aircraftId === aircraftId)) {
      return list.find((a) => a.aircraftId === aircraftId)!;
    }
    const row: PlayerAircraft = {
      playerId,
      aircraftId,
      unlockedAt: new Date().toISOString(),
    };
    list.push(row);
    this.aircraft.set(playerId, list);
    return row;
  }

  private sampleWallet(credits: number): void {
    this.telemetry.walletSum += credits;
    this.telemetry.walletSamples += 1;
  }
}

function cryptoRandom(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
