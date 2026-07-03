-- Planto – indekser for hyppige spørringer (ratelimit, RLS, daglig cron).
create index if not exists diagnoses_user_created_idx
  on public.diagnoses (user_id, created_at desc);
create index if not exists plant_chat_messages_user_created_idx
  on public.plant_chat_messages (user_id, created_at desc);
create index if not exists profiles_household_idx
  on public.profiles (household_id);
create index if not exists plants_next_water_due_idx
  on public.plants (next_water_due) where next_water_due is not null;
create index if not exists plants_species_idx
  on public.plants (species_id) where species_id is not null;
