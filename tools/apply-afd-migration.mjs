/**
 * Apply afd economy schema on the project from .env (never prints secrets).
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
console.log("MIGRATE_REF", ref);

const sql = `
create schema if not exists afd;

create table if not exists afd.player_accounts (
  player_id text primary key,
  token text not null unique,
  callsign text not null,
  created_at timestamptz not null default now()
);

create table if not exists afd.player_wallets (
  player_id text primary key references afd.player_accounts(player_id) on delete cascade,
  credits integer not null default 500 check (credits >= 0),
  dashi_coins integer not null default 0 check (dashi_coins >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists afd.wallet_transactions (
  id text primary key,
  player_id text not null references afd.player_accounts(player_id) on delete cascade,
  delta_credits integer not null,
  delta_dashi_coins integer not null default 0,
  reason text not null,
  ref_id text not null,
  created_at timestamptz not null default now(),
  balance_after integer not null
);

create unique index if not exists wallet_transactions_player_ref_uidx
  on afd.wallet_transactions (player_id, ref_id);

create index if not exists wallet_transactions_player_created_idx
  on afd.wallet_transactions (player_id, created_at desc);

create table if not exists afd.player_progression (
  player_id text primary key references afd.player_accounts(player_id) on delete cascade,
  xp integer not null default 0 check (xp >= 0),
  level integer not null default 1 check (level >= 1),
  rank text not null default 'Cadete'
);

create table if not exists afd.player_aircraft (
  player_id text not null references afd.player_accounts(player_id) on delete cascade,
  aircraft_id text not null,
  unlocked_at timestamptz not null default now(),
  primary key (player_id, aircraft_id)
);

create table if not exists afd.player_inventory (
  player_id text not null references afd.player_accounts(player_id) on delete cascade,
  item_id text not null,
  equipped boolean not null default false,
  acquired_at timestamptz not null default now(),
  primary key (player_id, item_id)
);

create table if not exists afd.player_blob (
  player_id text primary key references afd.player_accounts(player_id) on delete cascade,
  operations jsonb not null default '[]'::jsonb,
  mastery jsonb not null default '[]'::jsonb,
  medals jsonb not null default '[]'::jsonb,
  season jsonb not null default '{}'::jsonb,
  grant_ids text[] not null default '{}',
  op_sets jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists afd.leaderboard_entries (
  mode text not null,
  player_id text not null references afd.player_accounts(player_id) on delete cascade,
  callsign text not null,
  score numeric not null,
  match_id text not null default '',
  updated_at timestamptz not null default now(),
  primary key (mode, player_id)
);

create table if not exists afd.telemetry (
  id smallint primary key default 1 check (id = 1),
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into afd.telemetry (id, payload) values (1, '{}'::jsonb)
on conflict (id) do nothing;

alter table afd.player_accounts enable row level security;
alter table afd.player_wallets enable row level security;
alter table afd.wallet_transactions enable row level security;
alter table afd.player_progression enable row level security;
alter table afd.player_aircraft enable row level security;
alter table afd.player_inventory enable row level security;
alter table afd.player_blob enable row level security;
alter table afd.leaderboard_entries enable row level security;
alter table afd.telemetry enable row level security;

revoke all on schema afd from anon, authenticated;
grant usage on schema afd to service_role;
grant all on all tables in schema afd to service_role;
grant all on all sequences in schema afd to service_role;
alter default privileges in schema afd grant all on tables to service_role;
`;

const res = await fetch(
  `https://api.supabase.com/v1/projects/${ref}/database/query`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${map.SUPABASE_TOKEN}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  },
);
const text = await res.text();
if (!res.ok) {
  console.error("SQL_HTTP", res.status, text.slice(0, 400));
  process.exit(1);
}
console.log("MIGRATION_OK");

const check = await fetch(
  `https://api.supabase.com/v1/projects/${ref}/database/query`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${map.SUPABASE_TOKEN}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query:
        "select table_name from information_schema.tables where table_schema='afd' order by 1",
    }),
  },
);
const checkBody = await check.text();
if (!check.ok) {
  console.error("CHECK_HTTP", check.status, checkBody.slice(0, 200));
  process.exit(1);
}
const tables = JSON.parse(checkBody);
console.log(
  "TABLES",
  Array.isArray(tables)
    ? tables.map((r) => r.table_name || r.tablename).join(",")
    : "ok",
);
