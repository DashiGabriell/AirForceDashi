-- AFD economy — fonte de verdade do schema.
-- Tabelas em public.afd_* (PostgREST default) · acesso só via service_role.
-- Consome: apps/api/src/supabase/persist.ts

-- player accounts (guest token)
create table if not exists public.afd_player_accounts (
  player_id text primary key,
  token text not null unique,
  callsign text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.afd_player_wallets (
  player_id text primary key
    references public.afd_player_accounts (player_id) on delete cascade,
  credits integer not null default 500 check (credits >= 0),
  dashi_coins integer not null default 0 check (dashi_coins >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.afd_wallet_transactions (
  id text primary key,
  player_id text not null
    references public.afd_player_accounts (player_id) on delete cascade,
  delta_credits integer not null,
  delta_dashi_coins integer not null default 0,
  reason text not null,
  ref_id text not null,
  created_at timestamptz not null default now(),
  balance_after integer not null
);

create unique index if not exists afd_wallet_tx_player_ref_uidx
  on public.afd_wallet_transactions (player_id, ref_id);

create index if not exists afd_wallet_tx_player_created_idx
  on public.afd_wallet_transactions (player_id, created_at desc);

create table if not exists public.afd_player_progression (
  player_id text primary key
    references public.afd_player_accounts (player_id) on delete cascade,
  xp integer not null default 0 check (xp >= 0),
  level integer not null default 1 check (level >= 1),
  rank text not null default 'Cadete'
);

create table if not exists public.afd_player_aircraft (
  player_id text not null
    references public.afd_player_accounts (player_id) on delete cascade,
  aircraft_id text not null,
  unlocked_at timestamptz not null default now(),
  primary key (player_id, aircraft_id)
);

create table if not exists public.afd_player_inventory (
  player_id text not null
    references public.afd_player_accounts (player_id) on delete cascade,
  item_id text not null,
  equipped boolean not null default false,
  acquired_at timestamptz not null default now(),
  primary key (player_id, item_id)
);

-- operations / mastery / medals / season / grants (JSON blob por jogador)
create table if not exists public.afd_player_blob (
  player_id text primary key
    references public.afd_player_accounts (player_id) on delete cascade,
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
  player_id text not null
    references public.afd_player_accounts (player_id) on delete cascade,
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

insert into public.afd_telemetry (id, payload)
values (1, '{}'::jsonb)
on conflict (id) do nothing;

-- RLS on; sem policies para anon/authenticated → só service_role (bypass RLS)
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
