/**
 * Create public.afd_* economy tables (PostgREST-visible) on project from .env.
 * RLS on; no policies for anon/authenticated → only service_role can access.
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const map = Object.fromEntries(
  fs
    .readFileSync(path.join(root, ".env"), "utf8")
    .split(/\r?\n/)
    .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")]),
);

const url = map.SUPABASE_URL || map.VITE_SUPABASE_URL;
const ref = url?.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1];
if (!ref || !map.SUPABASE_TOKEN) {
  console.error("MISSING_ENV");
  process.exit(1);
}
console.log("REF", ref);

const sql = `
create table if not exists public.afd_player_accounts (
  player_id text primary key,
  token text not null unique,
  callsign text not null,
  created_at timestamptz not null default now()
);
create table if not exists public.afd_player_wallets (
  player_id text primary key references public.afd_player_accounts(player_id) on delete cascade,
  credits integer not null default 500 check (credits >= 0),
  dashi_coins integer not null default 0 check (dashi_coins >= 0),
  updated_at timestamptz not null default now()
);
create table if not exists public.afd_wallet_transactions (
  id text primary key,
  player_id text not null references public.afd_player_accounts(player_id) on delete cascade,
  delta_credits integer not null,
  delta_dashi_coins integer not null default 0,
  reason text not null,
  ref_id text not null,
  created_at timestamptz not null default now(),
  balance_after integer not null
);
create unique index if not exists afd_wallet_tx_player_ref_uidx
  on public.afd_wallet_transactions (player_id, ref_id);
create table if not exists public.afd_player_progression (
  player_id text primary key references public.afd_player_accounts(player_id) on delete cascade,
  xp integer not null default 0,
  level integer not null default 1,
  rank text not null default 'Cadete'
);
create table if not exists public.afd_player_aircraft (
  player_id text not null references public.afd_player_accounts(player_id) on delete cascade,
  aircraft_id text not null,
  unlocked_at timestamptz not null default now(),
  primary key (player_id, aircraft_id)
);
create table if not exists public.afd_player_inventory (
  player_id text not null references public.afd_player_accounts(player_id) on delete cascade,
  item_id text not null,
  equipped boolean not null default false,
  acquired_at timestamptz not null default now(),
  primary key (player_id, item_id)
);
create table if not exists public.afd_player_blob (
  player_id text primary key references public.afd_player_accounts(player_id) on delete cascade,
  operations jsonb not null default '[]'::jsonb,
  mastery jsonb not null default '[]'::jsonb,
  medals jsonb not null default '[]'::jsonb,
  season jsonb not null default '{}'::jsonb,
  grant_ids text[] not null default '{}',
  op_sets jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create table if not exists public.afd_leaderboard_entries (
  mode text not null,
  player_id text not null references public.afd_player_accounts(player_id) on delete cascade,
  callsign text not null,
  score numeric not null,
  match_id text not null default '',
  updated_at timestamptz not null default now(),
  primary key (mode, player_id)
);
create table if not exists public.afd_telemetry (
  id smallint primary key default 1 check (id = 1),
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
insert into public.afd_telemetry (id, payload) values (1, '{}'::jsonb)
on conflict (id) do nothing;

alter table public.afd_player_accounts enable row level security;
alter table public.afd_player_wallets enable row level security;
alter table public.afd_wallet_transactions enable row level security;
alter table public.afd_player_progression enable row level security;
alter table public.afd_player_aircraft enable row level security;
alter table public.afd_player_inventory enable row level security;
alter table public.afd_player_blob enable row level security;
alter table public.afd_leaderboard_entries enable row level security;
alter table public.afd_telemetry enable row level security;

revoke all on table public.afd_player_accounts from anon, authenticated;
revoke all on table public.afd_player_wallets from anon, authenticated;
revoke all on table public.afd_wallet_transactions from anon, authenticated;
revoke all on table public.afd_player_progression from anon, authenticated;
revoke all on table public.afd_player_aircraft from anon, authenticated;
revoke all on table public.afd_player_inventory from anon, authenticated;
revoke all on table public.afd_player_blob from anon, authenticated;
revoke all on table public.afd_leaderboard_entries from anon, authenticated;
revoke all on table public.afd_telemetry from anon, authenticated;

grant all on table public.afd_player_accounts to service_role;
grant all on table public.afd_player_wallets to service_role;
grant all on table public.afd_wallet_transactions to service_role;
grant all on table public.afd_player_progression to service_role;
grant all on table public.afd_player_aircraft to service_role;
grant all on table public.afd_player_inventory to service_role;
grant all on table public.afd_player_blob to service_role;
grant all on table public.afd_leaderboard_entries to service_role;
grant all on table public.afd_telemetry to service_role;

notify pgrst, 'reload schema';
`;

const res = await fetch(
  `https://api.supabase.com/v1/projects/${ref}/database/query`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${map.SUPABASE_TOKEN}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ query: sql }),
  },
);
const text = await res.text();
if (!res.ok) {
  console.error("SQL_HTTP", res.status, text.slice(0, 400));
  process.exit(1);
}
console.log("PUBLIC_TABLES_OK");

if (!map.SUPABASE_SERVICE_ROLE_KEY) {
  console.log("NO_SERVICE_ROLE_SKIP_PROBE");
  process.exit(0);
}
await new Promise((r) => setTimeout(r, 1500));
const probe = await fetch(
  `${url}/rest/v1/afd_player_accounts?select=player_id&limit=1`,
  {
    headers: {
      apikey: map.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${map.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  },
);
console.log("REST_PROBE", probe.status);
if (!probe.ok) {
  console.error(await probe.text());
  process.exit(1);
}
console.log("REST_OK");
