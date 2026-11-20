import {
  aircraftFromId,
  aircraftIdOf,
  DEFAULT_SETTINGS,
  normalizeLoadoutMap,
  normalizeOwnedAircraft,
  normalizeSelectedAircraft,
  type FleetAircraftId,
  type LocalProgress,
} from "@afd/game-core";
import { Aircraft } from "@afd/shared-types";

const TOKEN_KEY = "afd_api_token_v1";
/** Empty = same-origin (Vite proxy in dev). Override with VITE_API_URL. */
const API_BASE = import.meta.env.VITE_API_URL ?? "";

export interface ApiSnapshot {
  playerId: string;
  callsign: string;
  wallet: { credits: number; dashiCoins: number };
  progression: { xp: number; level: number; rank: string };
  aircraft: Array<{ aircraftId: FleetAircraftId }>;
  inventory: Array<{ itemId: string; equipped: boolean }>;
  mastery?: MasteryRow[];
  medals?: MedalRow[];
  operations?: OperationRow[];
}

export interface ShopItem {
  id: string;
  name: string;
  kind: string;
  rarity: string;
  costCredits: number;
}

export interface DcPack {
  id: string;
  name: string;
  dashiCoins: number;
  priceBrl: number;
  oneTime?: boolean;
  owned?: boolean;
  available?: boolean;
}

export interface PremiumItem {
  id: string;
  name: string;
  rarity: string;
  costDashiCoins: number;
}

export interface PassOffer {
  id: string;
  name: string;
  priceBrl: number;
  bonusLevels: number;
}

export interface SeasonReward {
  level: number;
  track: "free" | "premium";
  label: string;
  claimable: boolean;
  claimed: boolean;
}

export interface SeasonSnapshot {
  seasonId: string;
  xp: number;
  level: number;
  hasPremium: boolean;
  endsAt: string;
  maxLevel: number;
  rewards: SeasonReward[];
  offers: PassOffer[];
}

export interface LobbyStub {
  code: string;
  hostCallsign: string;
  slots: Array<{
    seat: number;
    playerId: string | null;
    callsign: string | null;
    ready: boolean;
  }>;
  status: string;
  note: string;
}

export interface OperationRow {
  id: string;
  kind: "daily" | "weekly";
  title: string;
  progress: number;
  target: number;
  rewardCredits: number;
  rewardXp: number;
  complete: boolean;
  claimed: boolean;
  claimable: boolean;
  resetsAt: string;
  isBonus?: boolean;
}

export interface MasteryRow {
  aircraftId: FleetAircraftId;
  xp: number;
  level: number;
  nextReward: { level: number; label: string } | null;
  combatBuff: false;
}

export interface MedalRow {
  id: string;
  name: string;
  description: string;
  unlocked: boolean;
  unlockedAt: string | null;
}

export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  callsign: string;
  mode: string;
  score: number;
}

async function req<T>(
  path: string,
  init: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json");
  if (token) headers.set("authorization", `Bearer ${token}`);
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `http_${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function loadApiToken(): string | null {
  try {
    return globalThis.localStorage?.getItem(TOKEN_KEY) ?? null;
  } catch {
    return null;
  }
}

export function saveApiToken(token: string): void {
  try {
    globalThis.localStorage?.setItem(TOKEN_KEY, token);
  } catch {
    /* ignore */
  }
}

export async function ensureSession(callsign: string): Promise<{
  token: string;
  snapshot: ApiSnapshot;
}> {
  let token = loadApiToken();
  if (token) {
    try {
      const snapshot = await req<ApiSnapshot>("/me", {}, token);
      return { token, snapshot };
    } catch {
      token = null;
    }
  }
  const g = await req<{ token: string }>("/auth/guest", {
    method: "POST",
    body: JSON.stringify({ callsign }),
  });
  saveApiToken(g.token);
  const snapshot = await req<ApiSnapshot>("/me", {}, g.token);
  return { token: g.token, snapshot };
}

export function snapshotToProgress(
  snap: ApiSnapshot,
  prev?: LocalProgress,
): LocalProgress {
  const owned = normalizeOwnedAircraft(
    snap.aircraft.map((a) => aircraftFromId(a.aircraftId) ?? Aircraft.F22_RAPTOR),
  );
  const aircraft = normalizeSelectedAircraft(prev?.aircraft, owned);
  return {
    callsign: snap.callsign || prev?.callsign || "DASHI-1",
    avatarId: prev?.avatarId ?? 0,
    skinId: prev?.skinId ?? "factory",
    emblemId: prev?.emblemId ?? "wing",
    effectId: prev?.effectId ?? "trail_off",
    loadouts: prev?.loadouts ?? normalizeLoadoutMap(null),
    aircraft,
    ownedAircraft: owned,
    cpUnlocked: prev?.cpUnlocked ?? 1,
    adUnlocked: prev?.adUnlocked ?? 1,
    atUnlocked: prev?.atUnlocked ?? 1,
    credits: snap.wallet.credits,
    xp: snap.progression.xp,
    settings: prev?.settings ?? { ...DEFAULT_SETTINGS },
  };
}

export async function grantMatchReward(
  token: string,
  body: {
    matchId: string;
    mode: "checkpoint" | "antidrone" | "freeflight" | "attack" | "tvt";
    won: boolean;
    abandoned?: boolean;
    kills?: number;
    timeLeftSec?: number;
    aircraftId?: FleetAircraftId;
    score?: number;
  },
): Promise<{
  credited: number;
  xp: number;
  idempotent: boolean;
  wallet: { credits: number };
  masteryXp?: number;
  medalsUnlocked?: string[];
}> {
  return req("/rewards/grant", { method: "POST", body: JSON.stringify(body) }, token);
}

export async function purchaseAircraftApi(
  token: string,
  aircraftId: FleetAircraftId,
): Promise<{ ok: boolean; cost: number; wallet: { credits: number } }> {
  return req(
    "/hangar/purchase",
    { method: "POST", body: JSON.stringify({ aircraftId }) },
    token,
  );
}

export async function fetchShop(token?: string | null): Promise<ShopItem[]> {
  const data = await req<{ items: ShopItem[] }>("/shop/catalog", {}, token);
  return data.items;
}

export async function purchaseItemApi(
  token: string,
  itemId: string,
): Promise<{ ok: boolean; cost: number; wallet: { credits: number } }> {
  return req(
    "/shop/purchase",
    { method: "POST", body: JSON.stringify({ itemId }) },
    token,
  );
}

export async function fetchFlags(): Promise<{ f15CostCredits: number }> {
  return req("/flags");
}

export async function fetchOperations(token: string): Promise<{
  operations: OperationRow[];
  claimable: number;
}> {
  return req("/operations", {}, token);
}

export async function claimOperationApi(
  token: string,
  defId: string,
): Promise<{
  credited: number;
  xp: number;
  wallet: { credits: number };
  operations: OperationRow[];
}> {
  return req(
    "/operations/claim",
    { method: "POST", body: JSON.stringify({ defId }) },
    token,
  );
}

export async function fetchMastery(token: string): Promise<MasteryRow[]> {
  const data = await req<{ mastery: MasteryRow[] }>("/mastery", {}, token);
  return data.mastery;
}

export async function fetchMedals(token: string): Promise<MedalRow[]> {
  const data = await req<{ medals: MedalRow[] }>("/medals", {}, token);
  return data.medals;
}

export async function fetchLeaderboard(
  mode: "checkpoint" | "antidrone" | "freeflight" | "attack" | "tvt",
): Promise<LeaderboardEntry[]> {
  const data = await req<{ entries: LeaderboardEntry[] }>(
    `/leaderboard?mode=${mode}`,
  );
  return data.entries;
}

export async function fetchPremiumShop(token?: string | null): Promise<{
  packs: DcPack[];
  items: PremiumItem[];
  passes: PassOffer[];
}> {
  return req("/shop/premium", {}, token);
}

export async function stubCheckoutDc(
  token: string,
  packId: string,
): Promise<{ creditedDc: number; wallet: { credits: number; dashiCoins: number } }> {
  return req(
    "/payments/stub/checkout",
    { method: "POST", body: JSON.stringify({ packId }) },
    token,
  );
}

export async function purchasePremiumApi(
  token: string,
  itemId: string,
): Promise<{ costDc: number; wallet: { credits: number; dashiCoins: number } }> {
  return req(
    "/shop/premium/purchase",
    { method: "POST", body: JSON.stringify({ itemId }) },
    token,
  );
}

export async function fetchSeason(token: string): Promise<SeasonSnapshot> {
  return req("/season", {}, token);
}

export async function stubBuyPass(
  token: string,
  offerId: string,
): Promise<{ season: SeasonSnapshot }> {
  return req(
    "/payments/stub/pass",
    { method: "POST", body: JSON.stringify({ offerId }) },
    token,
  );
}

export async function claimSeasonReward(
  token: string,
  level: number,
  track: "free" | "premium",
): Promise<{
  wallet: { credits: number; dashiCoins: number };
  season: SeasonSnapshot;
}> {
  return req(
    "/season/claim",
    { method: "POST", body: JSON.stringify({ level, track }) },
    token,
  );
}

export async function createLobbyApi(token: string): Promise<LobbyStub> {
  return req("/lobby/create", { method: "POST", body: "{}" }, token);
}

export { aircraftIdOf };
