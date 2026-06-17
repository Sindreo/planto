-- Planto – M1: lagring av plantebilder
-- Oppretter en Storage-bucket og RLS-policyer slik at en husstand kun kan
-- skrive til sin egen mappe. Bildene er offentlig lesbare (enkelt for <img>),
-- men filstien starter alltid med household_id, og kun medlemmer kan laste opp.
--
-- Kjør i Supabase SQL Editor etter 0001_init.sql.

insert into storage.buckets (id, name, public)
values ('plant-photos', 'plant-photos', true)
on conflict (id) do nothing;

-- Lese: alle (offentlig bucket). Egen policy for tydelighet.
drop policy if exists "plant photos are publicly readable" on storage.objects;
create policy "plant photos are publicly readable" on storage.objects
  for select using (bucket_id = 'plant-photos');

-- Skrive: kun innlogget, og kun til egen husstands mappe (første mappenivå).
drop policy if exists "household can upload plant photos" on storage.objects;
create policy "household can upload plant photos" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'plant-photos'
    and (storage.foldername(name))[1] = public.auth_household_id()::text
  );

drop policy if exists "household can update plant photos" on storage.objects;
create policy "household can update plant photos" on storage.objects
  for update to authenticated using (
    bucket_id = 'plant-photos'
    and (storage.foldername(name))[1] = public.auth_household_id()::text
  );

drop policy if exists "household can delete plant photos" on storage.objects;
create policy "household can delete plant photos" on storage.objects
  for delete to authenticated using (
    bucket_id = 'plant-photos'
    and (storage.foldername(name))[1] = public.auth_household_id()::text
  );
