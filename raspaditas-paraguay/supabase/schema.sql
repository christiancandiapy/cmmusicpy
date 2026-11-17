-- Raspaditas Paraguay: esquema inicial.
-- Antes de operar premios reales: completar revisiones legales y técnicas.

create extension if not exists pgcrypto;

create type public.app_role as enum ('admin', 'operator');
create type public.campaign_status as enum ('draft', 'paused', 'active', 'closed');
create type public.code_status as enum ('available', 'redeemed', 'cancelled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role public.app_role not null default 'operator',
  created_at timestamptz not null default now()
);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  status public.campaign_status not null default 'draft',
  starts_at timestamptz,
  ends_at timestamptz,
  terms_url text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.prizes (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete restrict,
  name text not null,
  description text not null default '',
  quantity_total integer not null check (quantity_total >= 0),
  quantity_reserved integer not null default 0 check (quantity_reserved >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (quantity_reserved <= quantity_total)
);

create table public.participation_codes (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete restrict,
  code_hash text not null unique,
  code_hint text not null,
  status public.code_status not null default 'available',
  assigned_prize_id uuid references public.prizes(id) on delete restrict,
  created_by uuid references auth.users(id),
  redeemed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.plays (
  id uuid primary key default gen_random_uuid(),
  code_id uuid not null unique references public.participation_codes(id) on delete restrict,
  campaign_id uuid not null references public.campaigns(id) on delete restrict,
  prize_id uuid references public.prizes(id) on delete restrict,
  result_label text not null,
  participant_name text,
  participant_phone text,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id),
  action text not null,
  entity text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.is_staff()
returns boolean language sql stable security definer
set search_path = public
as $$
  select exists(select 1 from public.profiles p where p.id = auth.uid());
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer
set search_path = public
as $$
  select exists(select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin');
$$;

alter table public.profiles enable row level security;
alter table public.campaigns enable row level security;
alter table public.prizes enable row level security;
alter table public.participation_codes enable row level security;
alter table public.plays enable row level security;
alter table public.audit_logs enable row level security;

create policy "staff read profiles" on public.profiles for select to authenticated using (public.is_staff());
create policy "admin manage profiles" on public.profiles for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "staff read campaigns" on public.campaigns for select to authenticated using (public.is_staff());
create policy "admin manage campaigns" on public.campaigns for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "staff read prizes" on public.prizes for select to authenticated using (public.is_staff());
create policy "admin manage prizes" on public.prizes for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "staff read codes" on public.participation_codes for select to authenticated using (public.is_staff());
create policy "admin manage codes" on public.participation_codes for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "staff read plays" on public.plays for select to authenticated using (public.is_staff());
create policy "staff read audit" on public.audit_logs for select to authenticated using (public.is_staff());

-- Las escrituras públicas quedan deshabilitadas. El canje requiere Edge Function
-- segura y transacción atómica para validar código, campaña e inventario.

-- Tickets individuales por código: cada ticket tendrá resultado propio.
-- La asignación de premios y el raspado público deben hacerse exclusivamente
-- mediante funciones servidor con transacción atómica; no desde el navegador.
do $$ begin
  create type public.ticket_status as enum ('available','revealed','cancelled');
exception when duplicate_object then null; end $$;

alter table public.participation_codes
  add column if not exists tickets_count integer not null default 1;

do $$ begin
  alter table public.participation_codes
    add constraint participation_codes_tickets_count_positive
    check (tickets_count > 0);
exception when duplicate_object then null; end $$;

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  code_id uuid not null references public.participation_codes(id) on delete restrict,
  campaign_id uuid not null references public.campaigns(id) on delete restrict,
  ticket_number integer not null check (ticket_number > 0),
  prize_id uuid references public.prizes(id) on delete restrict,
  result_label text not null default 'Sin premio',
  status public.ticket_status not null default 'available',
  revealed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (code_id, ticket_number)
);

create index if not exists tickets_campaign_id_idx on public.tickets(campaign_id);
create index if not exists tickets_code_id_idx on public.tickets(code_id);
alter table public.tickets enable row level security;

-- Roles y canje individual de premios (sin almacenar códigos en texto plano).
do $$ begin
  alter type public.app_role add value if not exists 'seller';
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.redemption_status as enum ('pending','redeemed','revoked');
exception when duplicate_object then null; end $$;

create table if not exists public.prize_redemptions (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null unique references public.tickets(id) on delete restrict,
  campaign_id uuid not null references public.campaigns(id) on delete restrict,
  prize_id uuid not null references public.prizes(id) on delete restrict,
  redeem_code_hash text not null unique,
  redeem_code_hint text not null,
  status public.redemption_status not null default 'pending',
  redeemed_by uuid references auth.users(id),
  redeemed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.prize_redemptions enable row level security;
