-- Planto – logg over AI-kall for dagsgrenser og kostnadsinnsikt.
-- Skrives KUN av Edge-funksjonen plant-ai (service-rolle, forbi RLS).
create table if not exists public.ai_calls (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  action     text not null check (action in ('identify', 'diagnose', 'careguide', 'chat')),
  created_at timestamptz not null default now()
);
create index if not exists ai_calls_user_created_idx
  on public.ai_calls (user_id, created_at desc);
alter table public.ai_calls enable row level security;
