-- ============================================================================
-- Zentra — Module 1: Geographic Hierarchy backfill
-- Seeds Nigeria → Borno → Maiduguri → existing zones → placeholder areas
-- and streets, then re-points existing merchants/addresses at the new chain.
-- Idempotent: safe to re-run.
-- ============================================================================

-- 1. Country
insert into public.countries (id, name, iso_code, currency_code, currency_symbol, phone_code, timezone)
values ('00000000-0000-4000-8000-000000000001', 'Nigeria', 'NG', 'NGN', '₦', '+234', 'Africa/Lagos')
on conflict (iso_code) do nothing;

-- 2. State
insert into public.states (id, country_id, name, code, capital)
values (
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000001',
  'Borno State', 'BO', 'Maiduguri'
)
on conflict (country_id, name) do nothing;

-- 3. City
insert into public.cities (id, state_id, name, slug, timezone, latitude, longitude)
values (
  '00000000-0000-4000-8000-000000000003',
  '00000000-0000-4000-8000-000000000002',
  'Maiduguri', 'maiduguri', 'Africa/Lagos', 11.8464, 13.1600
)
on conflict (state_id, name) do nothing;

-- 4. Point the two existing zones at Maiduguri (they were created with only
--    id/name before this migration; city_id is now populated for both).
update public.zones
set city_id = '00000000-0000-4000-8000-000000000003'
where city_id is null;

-- 5. One placeholder area per existing zone, named after the zone, so every
--    zone has at least one area to hang streets/addresses off.
insert into public.areas (id, zone_id, area_name)
select gen_random_uuid(), z.id, z.name
from public.zones z
where z.city_id = '00000000-0000-4000-8000-000000000003'
  and not exists (select 1 from public.areas a where a.zone_id = z.id);

-- 6. One placeholder "General Area" street per area, so existing addresses
--    have somewhere to attach without inventing fake street names for them.
insert into public.streets (id, area_id, street_name)
select gen_random_uuid(), a.id, 'Unspecified Street'
from public.areas a
where not exists (select 1 from public.streets s where s.area_id = a.id);

-- 7. Re-point existing addresses at the placeholder street closest to them.
--    Since we only have 2 rows today and 2 zones, this attaches every
--    address without a street_id to the first available placeholder street.
--    This is a one-time convenience backfill — it does not attempt real
--    geocoding. Re-assign properly via the admin UI once it exists.
with fallback_street as (
  select s.id
  from public.streets s
  join public.areas a on a.id = s.area_id
  join public.zones z on z.id = a.zone_id
  where z.city_id = '00000000-0000-4000-8000-000000000003'
  order by s.created_at
  limit 1
)
update public.addresses
set street_id = (select id from fallback_street)
where street_id is null;

-- 8. Re-point the existing merchant at the same fallback street via a new
--    addresses row built from its existing lat/lng/address_text, then link
--    merchants.address_id to it. merchants.lat/lng/address_text are left
--    untouched for map pins.
with fallback_street as (
  select s.id
  from public.streets s
  join public.areas a on a.id = s.area_id
  join public.zones z on z.id = a.zone_id
  where z.city_id = '00000000-0000-4000-8000-000000000003'
  order by s.created_at
  limit 1
),
new_addr as (
  insert into public.addresses (street_id, lat, lng, formatted, landmark)
  select fallback_street.id, m.lat, m.lng, m.address_text, m.address_text
  from public.merchants m, fallback_street
  where m.address_id is null
  returning id, lat, lng
)
update public.merchants m
set address_id = na.id
from new_addr na
where m.address_id is null
  and m.lat = na.lat
  and m.lng = na.lng;
