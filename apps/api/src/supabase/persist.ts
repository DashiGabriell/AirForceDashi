import type {
  AircraftId,
  AircraftMasteryRow,
  LeaderboardEntry,
  MatchMode,
  PlayerInventoryItem,
  PlayerMedal,
  PlayerOperationProgress,
  PlayerSeason,
  TelemetryCounters,
  WalletTransaction,
} from "@afd/economy";
import { EconomyStore } from "@afd/economy";
import type { AfdSupabase } from "./client";

type OpSetsBlob = {
  aircraft: string[];
  modes: string[];
  dayKey: string;
  weekKey: string;
};

export class SupabaseEconomyPersist {
  constructor(private readonly db: AfdSupabase) {}

  async hydrateByToken(store: EconomyStore, token: string): Promise<string | null> {
    const { data: account, error } = await this.db
      .from("afd_player_accounts")
      .select("*")
      .eq("token", token)
      .maybeSingle();
    if (error) throw new Error(`supabase_hydrate: ${error.message}`);
    if (!account) return null;

    const playerId = account.player_id as string;
    if (store.accounts.has(playerId)) {
      store.tokens.set(token, playerId);
      return playerId;
    }

    const [
      walletRes,
      progRes,
      aircraftRes,
      invRes,
      blobRes,
      txRes,
    ] = await Promise.all([
      this.db.from("afd_player_wallets").select("*").eq("player_id", playerId).maybeSingle(),
      this.db.from("afd_player_progression").select("*").eq("player_id", playerId).maybeSingle(),
      this.db.from("afd_player_aircraft").select("*").eq("player_id", playerId),
      this.db.from("afd_player_inventory").select("*").eq("player_id", playerId),
      this.db.from("afd_player_blob").select("*").eq("player_id", playerId).maybeSingle(),
      this.db
        .from("afd_wallet_transactions")
        .select("*")
        .eq("player_id", playerId)
        .order("created_at", { ascending: true }),
    ]);

    if (walletRes.error) throw new Error(walletRes.error.message);
    if (progRes.error) throw new Error(progRes.error.message);
    if (aircraftRes.error) throw new Error(aircraftRes.error.message);
    if (invRes.error) throw new Error(invRes.error.message);
    if (blobRes.error) throw new Error(blobRes.error.message);
    if (txRes.error) throw new Error(txRes.error.message);

    const now = new Date().toISOString();
    store.accounts.set(playerId, {
      playerId,
      token: account.token as string,
      callsign: account.callsign as string,
      createdAt: (account.created_at as string) ?? now,
    });
    store.tokens.set(account.token as string, playerId);

    const w = walletRes.data;
    store.wallets.set(playerId, {
      playerId,
      credits: Number(w?.credits ?? 500),
      dashiCoins: Number(w?.dashi_coins ?? 0),
      updatedAt: (w?.updated_at as string) ?? now,
    });

    const p = progRes.data;
    store.progression.set(playerId, {
      playerId,
      xp: Number(p?.xp ?? 0),
      level: Number(p?.level ?? 1),
      rank: (p?.rank as string) ?? "Cadete",
    });

    store.aircraft.set(
      playerId,
      (aircraftRes.data ?? []).map((row) => ({
        playerId,
        aircraftId: row.aircraft_id as AircraftId,
        unlockedAt: row.unlocked_at as string,
      })),
    );

    store.inventory.set(
      playerId,
      (invRes.data ?? []).map(
        (row): PlayerInventoryItem => ({
          playerId,
          itemId: row.item_id as string,
          equipped: Boolean(row.equipped),
          acquiredAt: row.acquired_at as string,
        }),
      ),
    );

    const blob = blobRes.data;
    store.operations.set(
      playerId,
      ((blob?.operations as PlayerOperationProgress[]) ?? []).slice(),
    );
    store.mastery.set(
      playerId,
      ((blob?.mastery as AircraftMasteryRow[]) ?? []).slice(),
    );
    store.medals.set(playerId, ((blob?.medals as PlayerMedal[]) ?? []).slice());
    const season = (blob?.season as PlayerSeason | null) ?? null;
    if (season) store.seasons.set(playerId, season);

    for (const id of (blob?.grant_ids as string[] | null) ?? []) {
      store.grantIds.add(id);
    }

    const opSets = blob?.op_sets as OpSetsBlob | null;
    if (opSets) {
      store.opSets.set(playerId, {
        aircraft: new Set(opSets.aircraft ?? []),
        modes: new Set(opSets.modes ?? []),
        dayKey: opSets.dayKey ?? "",
        weekKey: opSets.weekKey ?? "",
      });
    }

    for (const row of txRes.data ?? []) {
      const tx: WalletTransaction = {
        id: row.id as string,
        playerId,
        deltaCredits: Number(row.delta_credits),
        deltaDashiCoins: Number(row.delta_dashi_coins ?? 0),
        reason: row.reason as string,
        refId: row.ref_id as string,
        createdAt: row.created_at as string,
        balanceAfter: Number(row.balance_after),
      };
      if (!store.txs.some((t) => t.id === tx.id)) store.txs.push(tx);
    }

    return playerId;
  }

  async persistPlayer(store: EconomyStore, playerId: string): Promise<void> {
    const account = store.accounts.get(playerId);
    const wallet = store.wallets.get(playerId);
    const progression = store.progression.get(playerId);
    if (!account || !wallet || !progression) return;

    const op = store.opSets.get(playerId);
    const opSets: OpSetsBlob | Record<string, never> = op
      ? {
          aircraft: [...op.aircraft],
          modes: [...op.modes],
          dayKey: op.dayKey,
          weekKey: op.weekKey,
        }
      : {};

    // Global grant set (includes abandoned matchIds without txs). Persist full snapshot.
    const playerGrantIds = [...store.grantIds];

    const { error: accErr } = await this.db.from("afd_player_accounts").upsert({
      player_id: account.playerId,
      token: account.token,
      callsign: account.callsign,
      created_at: account.createdAt,
    });
    if (accErr) throw new Error(`persist_account: ${accErr.message}`);

    const { error: wErr } = await this.db.from("afd_player_wallets").upsert({
      player_id: playerId,
      credits: wallet.credits,
      dashi_coins: wallet.dashiCoins,
      updated_at: wallet.updatedAt,
    });
    if (wErr) throw new Error(`persist_wallet: ${wErr.message}`);

    const { error: pErr } = await this.db.from("afd_player_progression").upsert({
      player_id: playerId,
      xp: progression.xp,
      level: progression.level,
      rank: progression.rank,
    });
    if (pErr) throw new Error(`persist_progression: ${pErr.message}`);

    const aircraft = store.aircraft.get(playerId) ?? [];
    if (aircraft.length) {
      const { error } = await this.db.from("afd_player_aircraft").upsert(
        aircraft.map((a) => ({
          player_id: playerId,
          aircraft_id: a.aircraftId,
          unlocked_at: a.unlockedAt,
        })),
      );
      if (error) throw new Error(`persist_aircraft: ${error.message}`);
    }

    const inventory = store.inventory.get(playerId) ?? [];
    if (inventory.length) {
      const { error } = await this.db.from("afd_player_inventory").upsert(
        inventory.map((i) => ({
          player_id: playerId,
          item_id: i.itemId,
          equipped: i.equipped,
          acquired_at: i.acquiredAt,
        })),
      );
      if (error) throw new Error(`persist_inventory: ${error.message}`);
    }

    const season = store.seasons.get(playerId) ?? null;
    const { error: bErr } = await this.db.from("afd_player_blob").upsert({
      player_id: playerId,
      operations: store.operations.get(playerId) ?? [],
      mastery: store.mastery.get(playerId) ?? [],
      medals: store.medals.get(playerId) ?? [],
      season: season ?? {},
      grant_ids: playerGrantIds,
      op_sets: opSets,
      updated_at: new Date().toISOString(),
    });
    if (bErr) throw new Error(`persist_blob: ${bErr.message}`);

    const txs = store.txs.filter((t) => t.playerId === playerId);
    if (txs.length) {
      const { error } = await this.db.from("afd_wallet_transactions").upsert(
        txs.map((t) => ({
          id: t.id,
          player_id: t.playerId,
          delta_credits: t.deltaCredits,
          delta_dashi_coins: t.deltaDashiCoins,
          reason: t.reason,
          ref_id: t.refId,
          created_at: t.createdAt,
          balance_after: t.balanceAfter,
        })),
        { onConflict: "id" },
      );
      if (error) throw new Error(`persist_txs: ${error.message}`);
    }
  }

  async persistLeaderboard(store: EconomyStore): Promise<void> {
    const rows: {
      mode: string;
      player_id: string;
      callsign: string;
      score: number;
      match_id: string;
      updated_at: string;
    }[] = [];
    for (const [mode, entries] of store.leaderboards) {
      for (const e of entries) {
        rows.push({
          mode,
          player_id: e.playerId,
          callsign: e.callsign,
          score: e.score,
          match_id: e.matchId,
          updated_at: e.updatedAt,
        });
      }
    }
    if (!rows.length) return;
    const { error } = await this.db.from("afd_leaderboard_entries").upsert(rows);
    if (error) throw new Error(`persist_leaderboard: ${error.message}`);
  }

  async persistTelemetry(telemetry: TelemetryCounters): Promise<void> {
    const { error } = await this.db.from("afd_telemetry").upsert({
      id: 1,
      payload: telemetry,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(`persist_telemetry: ${error.message}`);
  }

  async loadLeaderboards(store: EconomyStore): Promise<void> {
    const { data, error } = await this.db.from("afd_leaderboard_entries").select("*");
    if (error) throw new Error(`load_leaderboard: ${error.message}`);
    for (const row of data ?? []) {
      const mode = row.mode as MatchMode;
      const entry: LeaderboardEntry = {
        playerId: row.player_id as string,
        callsign: row.callsign as string,
        mode,
        score: Number(row.score),
        matchId: (row.match_id as string) ?? "",
        updatedAt: row.updated_at as string,
      };
      const list = store.leaderboards.get(mode) ?? [];
      if (!list.some((e) => e.playerId === entry.playerId)) {
        list.push(entry);
        store.leaderboards.set(mode, list);
      }
    }
  }

  async loadTelemetry(store: EconomyStore): Promise<void> {
    const { data, error } = await this.db
      .from("afd_telemetry")
      .select("payload")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw new Error(`load_telemetry: ${error.message}`);
    const payload = data?.payload as Partial<TelemetryCounters> | null;
    if (!payload) return;
    store.telemetry = { ...store.telemetry, ...payload };
  }
}
