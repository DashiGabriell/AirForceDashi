import { EconomyError, EconomyService } from "@afd/economy";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { createAfdSupabase } from "./supabase/client";
import { SupabaseEconomyPersist } from "./supabase/persist";

export function createApiApp(
  eco = new EconomyService(),
  options?: { persist?: SupabaseEconomyPersist | null },
) {
  const app = new Hono();
  const db = options?.persist === undefined ? createAfdSupabase() : null;
  const persist =
    options?.persist === undefined
      ? db
        ? new SupabaseEconomyPersist(db)
        : null
      : options.persist;

  let bootstrapped = false;
  async function ensureBoot(): Promise<void> {
    if (!persist || bootstrapped) return;
    bootstrapped = true;
    try {
      await persist.loadTelemetry(eco.store);
      await persist.loadLeaderboards(eco.store);
    } catch (e) {
      console.warn("[afd-api] supabase boot load failed", e);
    }
  }

  async function resolvePlayer(authHeader: string | undefined): Promise<string> {
    await ensureBoot();
    const token = bearer(authHeader);
    if (!token) throw new EconomyError("unauthorized", 401);
    let playerId = eco.store.playerIdFromToken(token);
    if (!playerId && persist) {
      playerId = await persist.hydrateByToken(eco.store, token);
    }
    if (!playerId) throw new EconomyError("unauthorized", 401);
    return playerId;
  }

  async function afterWrite(playerId: string): Promise<void> {
    if (!persist) return;
    try {
      await persist.persistPlayer(eco.store, playerId);
      await persist.persistLeaderboard(eco.store);
      await persist.persistTelemetry(eco.store.telemetry);
    } catch (e) {
      console.error("[afd-api] supabase persist failed", e);
    }
  }

  app.use(
    "*",
    cors({
      origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
      allowHeaders: ["Content-Type", "Authorization"],
    }),
  );

  app.get("/health", (c) =>
    c.json({
      ok: true,
      service: "afd-economy",
      persist: Boolean(persist),
      project: "pkcupqxmeftiakpzdxls",
    }),
  );

  app.post("/auth/guest", async (c) => {
    await ensureBoot();
    const body = (await c.req.json().catch(() => ({}))) as { callsign?: string };
    const g = eco.authGuest(body.callsign);
    await afterWrite(g.playerId);
    return c.json(g);
  });

  app.get("/me", async (c) => {
    try {
      const playerId = await resolvePlayer(c.req.header("Authorization"));
      return c.json(eco.getSnapshot(playerId));
    } catch (e) {
      return err(c, e);
    }
  });

  app.get("/wallet", async (c) => {
    try {
      const playerId = await resolvePlayer(c.req.header("Authorization"));
      return c.json(eco.getSnapshot(playerId).wallet);
    } catch (e) {
      return err(c, e);
    }
  });

  app.post("/rewards/grant", async (c) => {
    try {
      const playerId = await resolvePlayer(c.req.header("Authorization"));
      const body = await c.req.json();
      if (!body?.matchId || !body?.mode) {
        return c.json({ error: "invalid_body" }, 400);
      }
      const aircraftId =
        body?.aircraftId === "f15" ? "f15" : body?.aircraftId === "f22" ? "f22" : undefined;
      const mode =
        body.mode === "antidrone" ||
        body.mode === "freeflight" ||
        body.mode === "checkpoint" ||
        body.mode === "attack" ||
        body.mode === "tvt"
          ? body.mode
          : null;
      if (!mode) return c.json({ error: "invalid_mode" }, 400);
      const result = eco.grantMatchReward(playerId, {
        matchId: String(body.matchId),
        mode,
        won: Boolean(body.won),
        abandoned: Boolean(body.abandoned),
        performanceBonus: Number(body.performanceBonus ?? 0),
        ...(body.kills != null ? { kills: Number(body.kills) } : {}),
        ...(body.timeLeftSec != null ? { timeLeftSec: Number(body.timeLeftSec) } : {}),
        ...(aircraftId ? { aircraftId } : {}),
        ...(body.score != null ? { score: Number(body.score) } : {}),
      });
      await afterWrite(playerId);
      return c.json(result);
    } catch (e) {
      return err(c, e);
    }
  });

  app.post("/hangar/purchase", async (c) => {
    try {
      const playerId = await resolvePlayer(c.req.header("Authorization"));
      const body = await c.req.json();
      const aircraftId = body?.aircraftId === "f15" ? "f15" : body?.aircraftId === "f22" ? "f22" : null;
      if (!aircraftId) return c.json({ error: "invalid_aircraft" }, 400);
      const result = eco.purchaseAircraft(playerId, aircraftId);
      await afterWrite(playerId);
      return c.json(result);
    } catch (e) {
      return err(c, e);
    }
  });

  app.get("/shop/catalog", (c) => c.json({ items: eco.listShop(), flags: eco.flags }));

  app.post("/shop/purchase", async (c) => {
    try {
      const playerId = await resolvePlayer(c.req.header("Authorization"));
      const body = await c.req.json();
      if (!body?.itemId) return c.json({ error: "invalid_body" }, 400);
      const result = eco.purchaseItem(playerId, String(body.itemId));
      await afterWrite(playerId);
      return c.json(result);
    } catch (e) {
      return err(c, e);
    }
  });

  app.post("/inventory/equip", async (c) => {
    try {
      const playerId = await resolvePlayer(c.req.header("Authorization"));
      const body = await c.req.json();
      if (!body?.itemId) return c.json({ error: "invalid_body" }, 400);
      const inventory = eco.equipItem(playerId, String(body.itemId));
      await afterWrite(playerId);
      return c.json({ inventory });
    } catch (e) {
      return err(c, e);
    }
  });

  app.get("/flags", (c) => c.json(eco.flags));

  app.get("/telemetry/summary", async (c) => {
    await ensureBoot();
    return c.json(eco.telemetrySummary());
  });

  app.get("/operations", async (c) => {
    try {
      const playerId = await resolvePlayer(c.req.header("Authorization"));
      return c.json({
        operations: eco.listOperations(playerId),
        claimable: eco.listOperations(playerId).filter((o) => o.claimable).length,
      });
    } catch (e) {
      return err(c, e);
    }
  });

  app.post("/operations/claim", async (c) => {
    try {
      const playerId = await resolvePlayer(c.req.header("Authorization"));
      const body = await c.req.json();
      if (!body?.defId) return c.json({ error: "invalid_body" }, 400);
      const result = eco.claimOperation(playerId, String(body.defId));
      await afterWrite(playerId);
      return c.json(result);
    } catch (e) {
      return err(c, e);
    }
  });

  app.get("/mastery", async (c) => {
    try {
      const playerId = await resolvePlayer(c.req.header("Authorization"));
      return c.json({
        mastery: eco.getMastery(playerId),
        combatBuff: eco.masteryAffectsCombat(),
      });
    } catch (e) {
      return err(c, e);
    }
  });

  app.get("/medals", async (c) => {
    try {
      const playerId = await resolvePlayer(c.req.header("Authorization"));
      return c.json({ medals: eco.listMedals(playerId) });
    } catch (e) {
      return err(c, e);
    }
  });

  app.get("/leaderboard", async (c) => {
    await ensureBoot();
    const modeRaw = c.req.query("mode") ?? "checkpoint";
    const mode =
      modeRaw === "antidrone" ||
      modeRaw === "freeflight" ||
      modeRaw === "checkpoint" ||
      modeRaw === "attack" ||
      modeRaw === "tvt"
        ? modeRaw
        : "checkpoint";
    return c.json({ mode, entries: eco.getLeaderboard(mode) });
  });

  app.get("/shop/premium", async (c) => {
    try {
      const token = bearer(c.req.header("Authorization"));
      const playerId = token ? await resolvePlayer(c.req.header("Authorization")) : null;
      return c.json({
        packs: eco.listDcPacks(playerId ?? undefined),
        items: eco.listPremiumShop(),
        passes: eco.listPassOffers(),
      });
    } catch (e) {
      return err(c, e);
    }
  });

  app.post("/payments/stub/checkout", async (c) => {
    try {
      const playerId = await resolvePlayer(c.req.header("Authorization"));
      const body = await c.req.json();
      if (!body?.packId) return c.json({ error: "invalid_body" }, 400);
      const result = eco.stubCheckoutDc(playerId, String(body.packId));
      await afterWrite(playerId);
      return c.json(result);
    } catch (e) {
      return err(c, e);
    }
  });

  app.post("/shop/premium/purchase", async (c) => {
    try {
      const playerId = await resolvePlayer(c.req.header("Authorization"));
      const body = await c.req.json();
      if (!body?.itemId) return c.json({ error: "invalid_body" }, 400);
      const result = eco.purchasePremiumItem(playerId, String(body.itemId));
      await afterWrite(playerId);
      return c.json(result);
    } catch (e) {
      return err(c, e);
    }
  });

  app.get("/season", async (c) => {
    try {
      const playerId = await resolvePlayer(c.req.header("Authorization"));
      return c.json(eco.getSeasonSnapshot(playerId));
    } catch (e) {
      return err(c, e);
    }
  });

  app.post("/payments/stub/pass", async (c) => {
    try {
      const playerId = await resolvePlayer(c.req.header("Authorization"));
      const body = await c.req.json();
      if (!body?.offerId) return c.json({ error: "invalid_body" }, 400);
      const result = eco.stubBuyPass(playerId, String(body.offerId));
      await afterWrite(playerId);
      return c.json(result);
    } catch (e) {
      return err(c, e);
    }
  });

  app.post("/season/claim", async (c) => {
    try {
      const playerId = await resolvePlayer(c.req.header("Authorization"));
      const body = await c.req.json();
      const track = body?.track === "premium" ? "premium" : "free";
      const level = Number(body?.level);
      if (!Number.isFinite(level)) return c.json({ error: "invalid_body" }, 400);
      const result = eco.claimPassReward(playerId, level, track);
      await afterWrite(playerId);
      return c.json(result);
    } catch (e) {
      return err(c, e);
    }
  });

  app.post("/lobby/create", async (c) => {
    try {
      const playerId = await resolvePlayer(c.req.header("Authorization"));
      const account = eco.getAccount(playerId);
      return c.json(eco.createLobby(playerId, account?.callsign ?? "DASHI-1"));
    } catch (e) {
      return err(c, e);
    }
  });

  return { app, eco, persist };
}

function bearer(header: string | undefined): string {
  if (!header?.startsWith("Bearer ")) return "";
  return header.slice(7).trim();
}

function err(c: { json: (body: unknown, status?: number) => Response }, e: unknown) {
  if (e instanceof EconomyError) {
    return c.json({ error: e.code }, e.status);
  }
  return c.json({ error: "internal" }, 500);
}
