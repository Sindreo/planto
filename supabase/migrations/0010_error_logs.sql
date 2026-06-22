-- Planto – enkel feilsporing/observability uten ekstern leverandør.
-- Klienten og edge-funksjonene skriver feil hit, og du leser dem i Supabase
-- (SQL Editor / Table Editor med service-rollen). Holdes bevisst lettvekts.

create table if not exists public.error_logs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references public.profiles (id)   on delete set null,
  household_id uuid references public.households (id) on delete set null,
  source       text not null,        -- 'client' | 'plant-ai' | 'daily-summary'
  context      text,                 -- hvor / hvilken handling
  message      text not null,
  detail       text,                 -- stack-trace e.l.
  created_at   timestamptz not null default now()
);
create index if not exists error_logs_created_idx on public.error_logs (created_at desc);

alter table public.error_logs enable row level security;

-- Innloggede brukere kan logge sine egne feil. Lesing skjer via dashbordet
-- (service-rollen omgår RLS); edge-funksjonene skriver også via service-rollen.
drop policy if exists error_logs_insert on public.error_logs;
create policy error_logs_insert on public.error_logs
  for insert with check (auth.uid() is not null and user_id = auth.uid());
