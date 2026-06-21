-- Planto – lagret chat per plante.
-- Brukeren kan stille Planto spørsmål om en konkret plante. Meldingene lagres og
-- deles innenfor husstanden, så begge kan se samtalen. Assistent-svarene skrives
-- av Edge-funksjonen plant-ai (service-rolle), så klienten trenger kun lese.

create table if not exists public.plant_chat_messages (
  id         uuid primary key default gen_random_uuid(),
  plant_id   uuid not null references public.plants (id)   on delete cascade,
  user_id    uuid references public.profiles (id)          on delete set null,
  role       text not null check (role in ('user', 'assistant')),
  content    text not null,
  created_at timestamptz not null default now()
);
create index if not exists plant_chat_messages_plant_idx
  on public.plant_chat_messages (plant_id, created_at);

alter table public.plant_chat_messages enable row level security;

-- Lese: husstandens medlemmer ser samtalen for sine planter.
drop policy if exists plant_chat_select on public.plant_chat_messages;
create policy plant_chat_select on public.plant_chat_messages
  for select using (
    plant_id in (select id from public.plants where household_id = public.auth_household_id())
  );

-- Skriving skjer fra Edge-funksjonen med service-rolle (forbi RLS), så vi
-- trenger ingen insert-policy for vanlige brukere.
