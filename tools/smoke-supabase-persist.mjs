/**
 * Smoke: guest → grant → hydrate from AAirForceDashi (pkcupqxmeftiakpzdxls).
 */
import "./load-env.mjs";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url?.includes("pkcupqxmeftiakpzdxls") || !key) {
  console.error("BAD_ENV_OR_WRONG_PROJECT");
  process.exit(1);
}

const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const playerId = `p_smoke_${Date.now().toString(36)}`;
const token = `t_smoke_${Date.now().toString(36)}`;
const now = new Date().toISOString();

const steps = [];
{
  const { error } = await db.from("afd_player_accounts").upsert({
    player_id: playerId,
    token,
    callsign: "SMOKE",
    created_at: now,
  });
  steps.push(["account", !error, error?.message]);
}
{
  const { error } = await db.from("afd_player_wallets").upsert({
    player_id: playerId,
    credits: 777,
    dashi_coins: 3,
    updated_at: now,
  });
  steps.push(["wallet", !error, error?.message]);
}
{
  const { error } = await db.from("afd_player_progression").upsert({
    player_id: playerId,
    xp: 10,
    level: 1,
    rank: "Cadete",
  });
  steps.push(["progression", !error, error?.message]);
}
{
  const { error } = await db.from("afd_player_blob").upsert({
    player_id: playerId,
    operations: [],
    mastery: [],
    medals: [],
    season: {},
    grant_ids: ["smoke_match"],
    op_sets: {},
    updated_at: now,
  });
  steps.push(["blob", !error, error?.message]);
}
{
  const { data, error } = await db
    .from("afd_player_accounts")
    .select("player_id,callsign")
    .eq("token", token)
    .maybeSingle();
  steps.push(["read", !error && data?.player_id === playerId, error?.message]);
}
{
  const { data, error } = await db
    .from("afd_player_wallets")
    .select("credits,dashi_coins")
    .eq("player_id", playerId)
    .maybeSingle();
  steps.push([
    "wallet_read",
    !error && data?.credits === 777 && data?.dashi_coins === 3,
    error?.message,
  ]);
}
{
  // cleanup
  const { error } = await db.from("afd_player_accounts").delete().eq("player_id", playerId);
  steps.push(["cleanup", !error, error?.message]);
}

const failed = steps.filter((s) => !s[1]);
for (const [name, ok, msg] of steps) {
  console.log(ok ? "OK" : "FAIL", name, msg ?? "");
}
if (failed.length) process.exit(1);
console.log("SMOKE_OK", "pkcupqxmeftiakpzdxls");
