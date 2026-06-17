-- Planto – M0 grunnskjema
-- Kjør denne i Supabase: SQL Editor -> lim inn -> Run.
-- Oppretter tabeller, hjelpefunksjoner, RPC-er og Row Level Security (RLS).
--
-- Sikkerhetsmodell: hver bruker tilhører én husstand (household). RLS sørger
-- for at en bruker KUN ser rader for sin egen household_id. Se SPEC seksjon 6.

-- ---------------------------------------------------------------------------
-- Tabeller
-- ---------------------------------------------------------------------------

create table if not exists public.households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default 'Vår husstand',
  invite_code text not null unique,
  created_at  timestamptz not null default now()
);

-- profiles speiler auth.users (1:1) og kobler bruker til husstand.
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  household_id uuid references public.households (id) on delete set null,
  display_name text,
  created_at   timestamptz not null default now()
);

create table if not exists public.plants (
  id                      uuid primary key default gen_random_uuid(),
  household_id            uuid not null references public.households (id) on delete cascade,
  nickname                text not null,
  species                 text,
  location                text,
  photo_url               text,
  light_needs             text,
  water_interval_days     int,
  fertilize_interval_days int,
  repot_interval_months   int,
  toxic_to_pets           boolean,
  notes                   text,
  last_watered_at         timestamptz,
  last_fertilized_at      timestamptz,
  next_water_due          date,
  created_at              timestamptz not null default now()
);
create index if not exists plants_household_idx on public.plants (household_id);

create table if not exists public.care_events (
  id         uuid primary key default gen_random_uuid(),
  plant_id   uuid not null references public.plants (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  type       text not null check (type in ('watered', 'fertilized', 'repotted', 'note')),
  note       text,
  created_at timestamptz not null default now()
);
create index if not exists care_events_plant_idx on public.care_events (plant_id);

create table if not exists public.diagnoses (
  id          uuid primary key default gen_random_uuid(),
  plant_id    uuid references public.plants (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  image_urls  text[] not null default '{}',
  model       text,
  result_json jsonb,
  summary     text,
  created_at  timestamptz not null default now()
);
create index if not exists diagnoses_plant_idx on public.diagnoses (plant_id);

-- ---------------------------------------------------------------------------
-- Hjelpefunksjoner
-- ---------------------------------------------------------------------------

-- Returnerer husstanden til innlogget bruker. SECURITY DEFINER for å unngå
-- rekursjon i RLS-policyene på profiles.
create or replace function public.auth_household_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select household_id from public.profiles where id = auth.uid();
$$;

-- Genererer en kort, lett-å-lese invitasjonskode (uten lett forvekslede tegn).
create or replace function public.gen_invite_code()
returns text
language plpgsql
as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
  ok boolean;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    select not exists (select 1 from public.households where invite_code = code) into ok;
    exit when ok;
  end loop;
  return code;
end;
$$;

-- Oppretter automatisk en profil når en ny bruker registrerer seg.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RPC: opprett / bli med i husstand (kjører som DEFINER → forbi RLS-insert)
-- ---------------------------------------------------------------------------

create or replace function public.create_household(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if (select household_id from public.profiles where id = auth.uid()) is not null then
    raise exception 'Bruker er allerede med i en husstand';
  end if;
  insert into public.households (name, invite_code)
  values (coalesce(nullif(trim(p_name), ''), 'Vår husstand'), public.gen_invite_code())
  returning id into v_id;
  update public.profiles set household_id = v_id where id = auth.uid();
  return v_id;
end;
$$;

create or replace function public.join_household(p_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select id into v_id from public.households
  where invite_code = upper(trim(p_invite_code));
  if v_id is null then
    raise exception 'Ugyldig invitasjonskode';
  end if;
  update public.profiles set household_id = v_id where id = auth.uid();
  return v_id;
end;
$$;

revoke all on function public.create_household(text) from public;
revoke all on function public.join_household(text) from public;
grant execute on function public.create_household(text) to authenticated;
grant execute on function public.join_household(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.households  enable row level security;
alter table public.profiles    enable row level security;
alter table public.plants      enable row level security;
alter table public.care_events enable row level security;
alter table public.diagnoses   enable row level security;

-- households: medlemmer kan se sin egen husstand.
drop policy if exists households_select on public.households;
create policy households_select on public.households
  for select using (id = public.auth_household_id());

-- profiles: se egen + samme husstand; oppdatere egen rad.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (
    id = auth.uid() or household_id = public.auth_household_id()
  );

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- plants: full tilgang innenfor egen husstand.
drop policy if exists plants_all on public.plants;
create policy plants_all on public.plants
  for all
  using (household_id = public.auth_household_id())
  with check (household_id = public.auth_household_id());

-- care_events: lese alle i husstanden, men kun opprette/endre egne.
drop policy if exists care_events_select on public.care_events;
create policy care_events_select on public.care_events
  for select using (
    plant_id in (select id from public.plants where household_id = public.auth_household_id())
  );

drop policy if exists care_events_insert on public.care_events;
create policy care_events_insert on public.care_events
  for insert with check (
    user_id = auth.uid()
    and plant_id in (select id from public.plants where household_id = public.auth_household_id())
  );

drop policy if exists care_events_modify on public.care_events;
create policy care_events_modify on public.care_events
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists care_events_delete on public.care_events;
create policy care_events_delete on public.care_events
  for delete using (user_id = auth.uid());

-- diagnoses: husstandens planter, pluss «løse» diagnoser (uten plante) for egen bruker.
drop policy if exists diagnoses_select on public.diagnoses;
create policy diagnoses_select on public.diagnoses
  for select using (
    (plant_id is null and user_id = auth.uid())
    or plant_id in (select id from public.plants where household_id = public.auth_household_id())
  );

drop policy if exists diagnoses_insert on public.diagnoses;
create policy diagnoses_insert on public.diagnoses
  for insert with check (
    user_id = auth.uid()
    and (
      plant_id is null
      or plant_id in (select id from public.plants where household_id = public.auth_household_id())
    )
  );

drop policy if exists diagnoses_delete on public.diagnoses;
create policy diagnoses_delete on public.diagnoses
  for delete using (user_id = auth.uid());
