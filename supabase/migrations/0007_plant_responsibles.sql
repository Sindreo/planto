-- Planto – flere ansvarlige per plante (mange-til-mange).
-- Erstatter den enkle kolonnen plants.responsible_user_id (0006) med en
-- koblingstabell, så en plante kan ha flere ansvarlige. Kun de ansvarlige skal
-- få den daglige vanne-varslingen (se edge-funksjonen daily-summary).

create table if not exists public.plant_responsibles (
  plant_id   uuid not null references public.plants (id)   on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (plant_id, user_id)
);
create index if not exists plant_responsibles_user_idx
  on public.plant_responsibles (user_id);

-- Ta vare på eksisterende ansvarlige fra 0006 (hvis kolonnen finnes).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'plants'
      and column_name = 'responsible_user_id'
  ) then
    insert into public.plant_responsibles (plant_id, user_id)
    select id, responsible_user_id
    from public.plants
    where responsible_user_id is not null
    on conflict do nothing;

    alter table public.plants drop column responsible_user_id;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Row Level Security: tilgang innenfor egen husstand.
-- ---------------------------------------------------------------------------
alter table public.plant_responsibles enable row level security;

drop policy if exists plant_responsibles_select on public.plant_responsibles;
create policy plant_responsibles_select on public.plant_responsibles
  for select using (
    plant_id in (select id from public.plants where household_id = public.auth_household_id())
  );

drop policy if exists plant_responsibles_insert on public.plant_responsibles;
create policy plant_responsibles_insert on public.plant_responsibles
  for insert with check (
    plant_id in (select id from public.plants where household_id = public.auth_household_id())
    and user_id in (select id from public.profiles where household_id = public.auth_household_id())
  );

drop policy if exists plant_responsibles_delete on public.plant_responsibles;
create policy plant_responsibles_delete on public.plant_responsibles
  for delete using (
    plant_id in (select id from public.plants where household_id = public.auth_household_id())
  );
