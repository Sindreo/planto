-- Planto – M-register: voksende, delt arts-register (hybrid).
-- Et felles register over plantearter (kanonisk nøkkel = latinsk navn) som
-- vokser hver gang AI finner en art. Gir søk, delte stellrutiner per art og
-- grunnlag for statistikk på tvers av husstanden.
--
-- Kjør i Supabase SQL Editor etter de tidligere migrasjonene.

-- ---------------------------------------------------------------------------
-- Tabell: species (delt referansedata)
-- ---------------------------------------------------------------------------

create table if not exists public.species (
  id                      uuid primary key default gen_random_uuid(),
  latin_name              text not null,
  common_name             text,
  light_needs             text,
  water_interval_days     int,
  fertilize_interval_days int,
  repot_interval_months   int,
  toxic_to_pets           boolean,
  notes                   text,
  created_at              timestamptz not null default now()
);

-- Unik på latinsk navn (case-insensitivt) – holder registeret kanonisk.
create unique index if not exists species_latin_lower_idx
  on public.species (lower(latin_name));

-- Koble plante til en art i registeret (valgfritt; fritekst-art beholdes òg).
alter table public.plants
  add column if not exists species_id uuid references public.species (id) on delete set null;

-- ---------------------------------------------------------------------------
-- RLS: registeret er delt referansedata – lesbart for alle innloggede.
-- Skriving skjer kun via upsert_species (SECURITY DEFINER), aldri direkte.
-- ---------------------------------------------------------------------------

alter table public.species enable row level security;

drop policy if exists species_select on public.species;
create policy species_select on public.species
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- RPC: upsert_species – legg til art hvis ny, eller berik manglende felter.
-- Eksisterende (kanoniske) verdier overskrives ikke; tomme felter fylles inn.
-- ---------------------------------------------------------------------------

create or replace function public.upsert_species(
  p_latin_name text,
  p_common_name text default null,
  p_light_needs text default null,
  p_water_interval_days int default null,
  p_fertilize_interval_days int default null,
  p_repot_interval_months int default null,
  p_toxic_to_pets boolean default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_latin text := trim(p_latin_name);
begin
  if v_latin is null or v_latin = '' then
    raise exception 'Mangler latinsk navn';
  end if;

  insert into public.species as s (
    latin_name, common_name, light_needs, water_interval_days,
    fertilize_interval_days, repot_interval_months, toxic_to_pets, notes
  ) values (
    v_latin, nullif(trim(coalesce(p_common_name, '')), ''), p_light_needs,
    p_water_interval_days, p_fertilize_interval_days, p_repot_interval_months,
    p_toxic_to_pets, p_notes
  )
  on conflict (lower(latin_name)) do update set
    common_name             = coalesce(s.common_name, excluded.common_name),
    light_needs             = coalesce(s.light_needs, excluded.light_needs),
    water_interval_days     = coalesce(s.water_interval_days, excluded.water_interval_days),
    fertilize_interval_days = coalesce(s.fertilize_interval_days, excluded.fertilize_interval_days),
    repot_interval_months   = coalesce(s.repot_interval_months, excluded.repot_interval_months),
    toxic_to_pets           = coalesce(s.toxic_to_pets, excluded.toxic_to_pets),
    notes                   = coalesce(s.notes, excluded.notes)
  returning s.id into v_id;

  return v_id;
end;
$$;

revoke all on function public.upsert_species(text, text, text, int, int, int, boolean, text) from public;
grant execute on function public.upsert_species(text, text, text, int, int, int, boolean, text) to authenticated;
