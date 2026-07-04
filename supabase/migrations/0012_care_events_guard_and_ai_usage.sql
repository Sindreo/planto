-- Planto – tett care_events-UPDATE + innfør felles AI-bruksteller.
-- Kjør i Supabase SQL Editor etter de tidligere migrasjonene.

-- ---------------------------------------------------------------------------
-- 1) care_events UPDATE var kun begrenset på user_id, ikke på plant_id. En
--    bruker kunne dermed flytte sin egen hendelse (inkl. et fritekst-«note»)
--    til en vilkårlig plante og injisere innhold i en annen husstands tidslinje.
--    Legg husstands-sjekk på plant_id i with check (og using).
-- ---------------------------------------------------------------------------
drop policy if exists care_events_modify on public.care_events;
create policy care_events_modify on public.care_events
  for update
  using (
    user_id = auth.uid()
    and plant_id in (select id from public.plants where household_id = public.auth_household_id())
  )
  with check (
    user_id = auth.uid()
    and plant_id in (select id from public.plants where household_id = public.auth_household_id())
  );

-- ---------------------------------------------------------------------------
-- 2) Felles teller for de AI-tunge handlingene (identify/careguide/diagnose),
--    så dagsgrensen i edge-funksjonen plant-ai dekker alle – ikke bare diagnose.
--    Skrives/leses kun av edge-funksjonen (service-rolle). RLS er på uten
--    bruker-policyer → deny by default for vanlige brukere.
-- ---------------------------------------------------------------------------
create table if not exists public.ai_usage (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  action     text not null,
  created_at timestamptz not null default now()
);
create index if not exists ai_usage_user_time_idx
  on public.ai_usage (user_id, created_at desc);

alter table public.ai_usage enable row level security;
