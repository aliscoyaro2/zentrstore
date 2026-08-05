-- ============================================================================
-- Zentra — Module 1: Geographic Hierarchy Service
-- Migration: create countries/states/cities/areas/streets, extend zones,
-- extend addresses, link merchants to the new hierarchy.
-- Non-destructive: no existing column is dropped or renamed.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Shared enum for soft-delete / lifecycle status across the hierarchy
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'geo_status') then
    create type public.geo_status as enum ('active', 'inactive', 'under_maintenance', 'archived');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. countries
-- ---------------------------------------------------------------------------
create table if not exists public.countries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  iso_code text not null,
  currency_code text not null default 'NGN',
  currency_symbol text not null default '₦',
  phone_code text,
  timezone text not null default 'Africa/Lagos',
  status public.geo_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint countries_iso_code_unique unique (iso_code),
  constraint countries_name_unique unique (name)
);

-- ---------------------------------------------------------------------------
-- 2. states
-- ---------------------------------------------------------------------------
create table if not exists public.states (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references public.countries(id) on delete restrict,
  name text not null,
  code text,
  capital text,
  status public.geo_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint states_name_per_country_unique unique (country_id, name)
);

create index if not exists idx_states_country_id on public.states(country_id);

-- ---------------------------------------------------------------------------
-- 3. cities
-- ---------------------------------------------------------------------------
create table if not exists public.cities (
  id uuid primary key default gen_random_uuid(),
  state_id uuid not null references public.states(id) on delete restrict,
  name text not null,
  slug text not null,
  population integer,
  timezone text not null default 'Africa/Lagos',
  latitude double precision,
  longitude double precision,
  status public.geo_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cities_name_per_state_unique unique (state_id, name),
  constraint cities_slug_unique unique (slug),
  constraint cities_latitude_range check (latitude is null or (latitude between -90 and 90)),
  constraint cities_longitude_range check (longitude is null or (longitude between -180 and 180))
);

create index if not exists idx_cities_state_id on public.cities(state_id);

-- ---------------------------------------------------------------------------
-- 4. zones — EXTEND existing table rather than replace it.
--    Existing business columns (delivery_fee_kobo, max_radius_km, etc.) are
--    preserved untouched. We only add the hierarchy link and rename nothing.
-- ---------------------------------------------------------------------------
alter table public.zones
  add column if not exists city_id uuid references public.cities(id) on delete restrict,
  add column if not exists zone_code text,
  add column if not exists polygon_coordinates jsonb,
  add column if not exists priority integer not null default 0,
  add column if not exists status public.geo_status not null default 'active',
  add column if not exists updated_at timestamptz not null default now();

-- boundary already exists as jsonb (free-form) — polygon_coordinates is the
-- PRD-named field for the same concept going forward; both are kept so
-- nothing currently reading `boundary` breaks.

create index if not exists idx_zones_city_id on public.zones(city_id);
create unique index if not exists idx_zones_code_per_city on public.zones(city_id, zone_code) where zone_code is not null;

-- ---------------------------------------------------------------------------
-- 5. areas
-- ---------------------------------------------------------------------------
create table if not exists public.areas (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references public.zones(id) on delete restrict,
  area_name text not null,
  postal_code text,
  status public.geo_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint areas_name_per_zone_unique unique (zone_id, area_name)
);

create index if not exists idx_areas_zone_id on public.areas(zone_id);

-- ---------------------------------------------------------------------------
-- 6. streets
-- ---------------------------------------------------------------------------
create table if not exists public.streets (
  id uuid primary key default gen_random_uuid(),
  area_id uuid not null references public.areas(id) on delete restrict,
  street_name text not null,
  status public.geo_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint streets_name_per_area_unique unique (area_id, street_name)
);

create index if not exists idx_streets_area_id on public.streets(area_id);

-- ---------------------------------------------------------------------------
-- 7. addresses — EXTEND existing table.
--    street_id is nullable for now so existing rows and existing insert
--    code (label/formatted/lat/lng) keep working unmodified. New rows can
--    progressively adopt the full hierarchy; a future migration can make
--    street_id NOT NULL once the frontend always sets it.
-- ---------------------------------------------------------------------------
alter table public.addresses
  add column if not exists street_id uuid references public.streets(id) on delete restrict,
  add column if not exists building_number text,
  add column if not exists apartment text,
  add column if not exists floor text,
  add column if not exists landmark text,
  add column if not exists plus_code text,
  add column if not exists google_place_id text,
  add column if not exists status public.geo_status not null default 'active',
  add column if not exists updated_at timestamptz not null default now(),
  add constraint addresses_latitude_range check (lat between -90 and 90),
  add constraint addresses_longitude_range check (lng between -180 and 180);

create index if not exists idx_addresses_street_id on public.addresses(street_id);
create index if not exists idx_addresses_google_place_id on public.addresses(google_place_id) where google_place_id is not null;
create index if not exists idx_addresses_plus_code on public.addresses(plus_code) where plus_code is not null;

-- ---------------------------------------------------------------------------
-- 8. merchants — link to the formal hierarchy without disturbing existing
--    lat/lng/address_text columns (kept for map pins & existing UI).
-- ---------------------------------------------------------------------------
alter table public.merchants
  add column if not exists address_id uuid references public.addresses(id) on delete set null;

create index if not exists idx_merchants_address_id on public.merchants(address_id);

-- ---------------------------------------------------------------------------
-- 9. updated_at triggers (reuse one function for all hierarchy tables)
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['countries','states','cities','zones','areas','streets','addresses']
  loop
    execute format(
      'drop trigger if exists trg_set_updated_at on public.%I; ' ||
      'create trigger trg_set_updated_at before update on public.%I ' ||
      'for each row execute function public.set_updated_at();',
      t, t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 10. Row Level Security
--     Read: anon + authenticated may read ACTIVE rows of the pure reference
--     tables (countries/states/cities/areas/streets). Zones and addresses
--     keep their existing, separately-defined policies untouched — we only
--     add policies for the brand-new tables here.
-- ---------------------------------------------------------------------------
alter table public.countries enable row level security;
alter table public.states enable row level security;
alter table public.cities enable row level security;
alter table public.areas enable row level security;
alter table public.streets enable row level security;

drop policy if exists "geo_read_active_countries" on public.countries;
create policy "geo_read_active_countries" on public.countries
  for select to anon, authenticated
  using (status = 'active');

drop policy if exists "geo_read_active_states" on public.states;
create policy "geo_read_active_states" on public.states
  for select to anon, authenticated
  using (status = 'active');

drop policy if exists "geo_read_active_cities" on public.cities;
create policy "geo_read_active_cities" on public.cities
  for select to anon, authenticated
  using (status = 'active');

drop policy if exists "geo_read_active_areas" on public.areas;
create policy "geo_read_active_areas" on public.areas
  for select to anon, authenticated
  using (status = 'active');

drop policy if exists "geo_read_active_streets" on public.streets;
create policy "geo_read_active_streets" on public.streets
  for select to anon, authenticated
  using (status = 'active');

-- Admins (profiles.role = 'admin') get full read/write on all hierarchy
-- tables. Adjust the role check if your admin claim lives elsewhere.
drop policy if exists "geo_admin_all_countries" on public.countries;
create policy "geo_admin_all_countries" on public.countries
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "geo_admin_all_states" on public.states;
create policy "geo_admin_all_states" on public.states
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "geo_admin_all_cities" on public.cities;
create policy "geo_admin_all_cities" on public.cities
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "geo_admin_all_areas" on public.areas;
create policy "geo_admin_all_areas" on public.areas
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "geo_admin_all_streets" on public.streets;
create policy "geo_admin_all_streets" on public.streets
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

grant select on public.countries, public.states, public.cities, public.areas, public.streets to anon, authenticated;
grant all on public.countries, public.states, public.cities, public.areas, public.streets to service_role;
