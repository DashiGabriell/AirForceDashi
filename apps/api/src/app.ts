import { EconomyError, EconomyService } from "@afd/economy";
import { Hono } from "hono";
import { cors } from "hono/cors";

export function createApiApp(eco = new EconomyService()) {
  const app = new Hono();

  app.use(
    "*",
    cors({
      origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
      allowHeaders: ["Content-Type", "Authorization"],
    }),
  );

  app.get("/health", (c) => c.json({ ok: true, service: "afd-economy" }));

  app.post("/auth/guest", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { callsign?: string };
    const g = eco.authGuest(body.callsign);
    return c.json(g);
  });

  app.get("/me", (c) => {
    try {
      const playerId = eco.requirePlayer(bearer(c.req.header("Authorization")));
      return c.json(eco.getSnapshot(playerId));
    } catch (e) {
      return err(c, e);
    }
  });

  app.get("/wallet", (c) => {
    try {
      const playerId = eco.requirePlayer(bearer(c.req.header("Authorization")));
      return c.json(eco.getSnapshot(playerId).wallet);
    } catch (e) {
      return err(c, e);
    }
  });

  app.post("/rewards/grant", async (c) => {
    try {
      const playerId = eco.requirePlayer(bearer(c.req.header("Authorization")));
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
      return c.json(result);
    } catch (e) {
      return err(c, e);
    }
  });

  app.post("/hangar/purchase", async (c) => {
    try {
      const playerId = eco.requirePlayer(bearer(c.req.header("Authorization")));
      const body = await c.req.json();
      const aircraftId = body?.aircraftId === "f15" ? "f15" : body?.aircraftId === "f22" ? "f22" : null;
      if (!aircraftId) return c.json({ error: "invalid_aircraft" }, 400);
      return c.json(eco.purchaseAircraft(playerId, aircraftId));
    } catch (e) {
      return err(c, e);
    }
  });

  app.get("/shop/catalog", (c) => c.json({ items: eco.listShop(), flags: eco.flags }));

  app.post("/shop/purchase", async (c) => {
    try {
      const playerId = eco.requirePlayer(bearer(c.req.header("Authorization")));
      const body = await c.req.json();
      if (!body?.itemId) return c.json({ error: "invalid_body" }, 400);
      return c.json(eco.purchaseItem(playerId, String(body.itemId)));
    } catch (e) {
      return err(c, e);
    }
  });

  app.post("/inventory/equip", async (c) => {
    try {
      const playerId = eco.requirePlayer(bearer(c.req.header("Authorization")));
      const body = await c.req.json();
      if (!body?.itemId) return c.json({ error: "invalid_body" }, 400);
      return c.json({ inventory: eco.equipItem(playerId, String(body.itemId)) });
    } catch (e) {
      return err(c, e);
    }
  });

  app.get("/flags", (c) => c.json(eco.flags));

  app.get("/telemetry/summary", (c) => c.json(eco.telemetrySummary()));

  app.get("/operations", (c) => {
    try {
      const playerId = eco.requirePlayer(bearer(c.req.header("Authorization")));
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
      const playerId = eco.requirePlayer(bearer(c.req.header("Authorization")));
      const body = await c.req.json();
      if (!body?.defId) return c.json({ error: "invalid_body" }, 400);
      return c.json(eco.claimOperation(playerId, String(body.defId)));
    } catch (e) {
      return err(c, e);
    }
  });

  app.get("/mastery", (c) => {
    try {
      const playerId = eco.requirePlayer(bearer(c.req.header("Authorization")));
      return c.json({
        mastery: eco.getMastery(playerId),
        combatBuff: eco.masteryAffectsCombat(),
      });
    } catch (e) {
      return err(c, e);
    }
  });

  app.get("/medals", (c) => {
    try {
      const playerId = eco.requirePlayer(bearer(c.req.header("Authorization")));
      return c.json({ medals: eco.listMedals(playerId) });
    } catch (e) {
      return err(c, e);
    }
  });

  app.get("/leaderboard", (c) => {
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

  app.get("/shop/premium", (c) => {
    try {
      const token = bearer(c.req.header("Authorization"));
      const playerId = token ? eco.requirePlayer(token) : null;
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
      const playerId = eco.requirePlayer(bearer(c.req.header("Authorization")));
      const body = await c.req.json();
      if (!body?.packId) return c.json({ error: "invalid_body" }, 400);
      return c.json(eco.stubCheckoutDc(playerId, String(body.packId)));
    } catch (e) {
      return err(c, e);
    }
  });

  app.post("/shop/premium/purchase", async (c) => {
    try {
      const playerId = eco.requirePlayer(bearer(c.req.header("Authorization")));
      const body = await c.req.json();
      if (!body?.itemId) return c.json({ error: "invalid_body" }, 400);
      return c.json(eco.purchasePremiumItem(playerId, String(body.itemId)));
    } catch (e) {
      return err(c, e);
    }
  });

  app.get("/season", (c) => {
    try {
      const playerId = eco.requirePlayer(bearer(c.req.header("Authorization")));
      return c.json(eco.getSeasonSnapshot(playerId));
    } catch (e) {
      return err(c, e);
    }
  });

  app.post("/payments/stub/pass", async (c) => {
    try {
      const playerId = eco.requirePlayer(bearer(c.req.header("Authorization")));
      const body = await c.req.json();
      if (!body?.offerId) return c.json({ error: "invalid_body" }, 400);
      return c.json(eco.stubBuyPass(playerId, String(body.offerId)));
    } catch (e) {
      return err(c, e);
    }
  });

  app.post("/season/claim", async (c) => {
    try {
      const playerId = eco.requirePlayer(bearer(c.req.header("Authorization")));
      const body = await c.req.json();
      const track = body?.track === "premium" ? "premium" : "free";
      const level = Number(body?.level);
      if (!Number.isFinite(level)) return c.json({ error: "invalid_body" }, 400);
      return c.json(eco.claimPassReward(playerId, level, track));
    } catch (e) {
      return err(c, e);
    }
  });

  app.post("/lobby/create", (c) => {
    try {
      const playerId = eco.requirePlayer(bearer(c.req.header("Authorization")));
      const account = eco.getAccount(playerId);
      return c.json(eco.createLobby(playerId, account?.callsign ?? "DASHI-1"));
    } catch (e) {
      return err(c, e);
    }
  });

  return { app, eco };
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
