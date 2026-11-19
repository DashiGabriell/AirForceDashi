import { describe, expect, it } from "vitest";
import { createApiApp } from "./app";

describe("API routes", () => {
  it("guest auth → grant → idempotent retry", async () => {
    const { app } = createApiApp();
    const auth = await app.request("/auth/guest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ callsign: "API-1" }),
    });
    expect(auth.status).toBe(200);
    const g = (await auth.json()) as { token: string; wallet: { credits: number } };
    const headers = {
      authorization: `Bearer ${g.token}`,
      "content-type": "application/json",
    };

    const grant1 = await app.request("/rewards/grant", {
      method: "POST",
      headers,
      body: JSON.stringify({
        matchId: "match-api-1",
        mode: "checkpoint",
        won: true,
        timeLeftSec: 12,
      }),
    });
    expect(grant1.status).toBe(200);
    const r1 = (await grant1.json()) as { credited: number; idempotent: boolean };

    const grant2 = await app.request("/rewards/grant", {
      method: "POST",
      headers,
      body: JSON.stringify({
        matchId: "match-api-1",
        mode: "checkpoint",
        won: true,
      }),
    });
    const r2 = (await grant2.json()) as { credited: number; idempotent: boolean };
    expect(r2.idempotent).toBe(true);
    expect(r1.credited).toBeGreaterThan(0);

    const me = await app.request("/me", { headers });
    expect(me.status).toBe(200);
  });

  it("shop catalog has 10–15 credit items", async () => {
    const { app } = createApiApp();
    const res = await app.request("/shop/catalog");
    const body = (await res.json()) as { items: unknown[] };
    expect(body.items.length).toBeGreaterThanOrEqual(10);
    expect(body.items.length).toBeLessThanOrEqual(15);
  });

  it("premium stub + season + lobby", async () => {
    const { app } = createApiApp();
    const auth = await app.request("/auth/guest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ callsign: "M8" }),
    });
    const g = (await auth.json()) as { token: string };
    const headers = {
      authorization: `Bearer ${g.token}`,
      "content-type": "application/json",
    };

    const prem = await app.request("/shop/premium", { headers });
    expect(prem.status).toBe(200);
    const checkout = await app.request("/payments/stub/checkout", {
      method: "POST",
      headers,
      body: JSON.stringify({ packId: "dc_100" }),
    });
    expect(checkout.status).toBe(200);
    const season = await app.request("/season", { headers });
    expect(season.status).toBe(200);
    const pass = await app.request("/payments/stub/pass", {
      method: "POST",
      headers,
      body: JSON.stringify({ offerId: "premium_pass" }),
    });
    expect(pass.status).toBe(200);
    const lobby = await app.request("/lobby/create", {
      method: "POST",
      headers,
    });
    expect(lobby.status).toBe(200);
  });

  it("operations mastery medals leaderboard", async () => {
    const { app } = createApiApp();
    const auth = await app.request("/auth/guest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ callsign: "M6" }),
    });
    const g = (await auth.json()) as { token: string };
    const headers = {
      authorization: `Bearer ${g.token}`,
      "content-type": "application/json",
    };

    await app.request("/rewards/grant", {
      method: "POST",
      headers,
      body: JSON.stringify({
        matchId: "m6-1",
        mode: "checkpoint",
        won: true,
        aircraftId: "f22",
        score: 1200,
      }),
    });

    const ops = await app.request("/operations", { headers });
    expect(ops.status).toBe(200);
    const mastery = await app.request("/mastery", { headers });
    expect(mastery.status).toBe(200);
    const mBody = (await mastery.json()) as { combatBuff: boolean };
    expect(mBody.combatBuff).toBe(false);
    const medals = await app.request("/medals", { headers });
    expect(medals.status).toBe(200);
    const lb = await app.request("/leaderboard?mode=checkpoint");
    expect(lb.status).toBe(200);
    const board = (await lb.json()) as { entries: unknown[] };
    expect(board.entries.length).toBeGreaterThan(0);
  });
});
