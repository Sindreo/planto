-- Planto – strukturert vannmengde per art/plante, i tillegg til fritekst-
-- instruksen fra 0013. Tre nivåer som dekker de vanligste vannemønstrene for
-- stueplanter, og som vises som en dråpe-badge i UI-et:
--   'sparsom'  – la jorda tørke helt ut, vann lite og sjelden (sukkulenter o.l.)
--   'moderat'  – vann grundig når toppen av jorda er tørr
--   'rikelig'  – hold jorda jevnt fuktig, la den aldri tørke helt ut
-- Fylles av AI-stellguiden og kan overstyres per plante.
-- Kjør i Supabase SQL Editor etter de tidligere migrasjonene.

alter table public.species add column if not exists water_amount text
  check (water_amount in ('sparsom', 'moderat', 'rikelig'));
alter table public.plants add column if not exists water_amount text
  check (water_amount in ('sparsom', 'moderat', 'rikelig'));

-- ---------------------------------------------------------------------------
-- Utvid upsert_species med p_water_amount (berik-mønster: tomt felt fylles,
-- kanonisk verdi beholdes). Gammel signatur droppes først så vi ikke får en
-- overload.
-- ---------------------------------------------------------------------------
drop function if exists public.upsert_species(text, text, text, int, int, int, boolean, text, text);

create or replace function public.upsert_species(
  p_latin_name text,
  p_common_name text default null,
  p_light_needs text default null,
  p_water_interval_days int default null,
  p_fertilize_interval_days int default null,
  p_repot_interval_months int default null,
  p_toxic_to_pets boolean default null,
  p_notes text default null,
  p_water_method text default null,
  p_water_amount text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_latin text := trim(p_latin_name);
  -- Ukjente verdier (f.eks. fra AI) blir null i stedet for å velte inserten.
  v_amount text := case
    when p_water_amount in ('sparsom', 'moderat', 'rikelig') then p_water_amount
    else null
  end;
begin
  if v_latin is null or v_latin = '' then
    raise exception 'Mangler latinsk navn';
  end if;

  insert into public.species as s (
    latin_name, common_name, light_needs, water_interval_days,
    fertilize_interval_days, repot_interval_months, toxic_to_pets, notes,
    water_method, water_amount
  ) values (
    v_latin, nullif(trim(coalesce(p_common_name, '')), ''), p_light_needs,
    p_water_interval_days, p_fertilize_interval_days, p_repot_interval_months,
    p_toxic_to_pets, p_notes, p_water_method, v_amount
  )
  on conflict (lower(latin_name)) do update set
    common_name             = coalesce(s.common_name, excluded.common_name),
    light_needs             = coalesce(s.light_needs, excluded.light_needs),
    water_interval_days     = coalesce(s.water_interval_days, excluded.water_interval_days),
    fertilize_interval_days = coalesce(s.fertilize_interval_days, excluded.fertilize_interval_days),
    repot_interval_months   = coalesce(s.repot_interval_months, excluded.repot_interval_months),
    toxic_to_pets           = coalesce(s.toxic_to_pets, excluded.toxic_to_pets),
    notes                   = coalesce(s.notes, excluded.notes),
    water_method            = coalesce(s.water_method, excluded.water_method),
    water_amount            = coalesce(s.water_amount, excluded.water_amount)
  returning s.id into v_id;

  return v_id;
end;
$$;

revoke all on function public.upsert_species(text, text, text, int, int, int, boolean, text, text, text) from public;
grant execute on function public.upsert_species(text, text, text, int, int, int, boolean, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Kategoriser de forhåndsseedede artene, så badgen er nyttig fra start.
-- Setter kun der det mangler (overskriver ikke redigert).
-- ---------------------------------------------------------------------------
update public.species set water_amount = case latin_name
  -- Sparsomt: la jorda tørke helt ut, vann lite og sjelden.
  when 'Dracaena trifasciata'     then 'sparsom'
  when 'Zamioculcas zamiifolia'   then 'sparsom'
  when 'Dracaena marginata'       then 'sparsom'
  when 'Aloe vera'                then 'sparsom'
  when 'Crassula ovata'           then 'sparsom'
  when 'Yucca elephantipes'       then 'sparsom'
  when 'Peperomia'                then 'sparsom'
  when 'Hoya carnosa'             then 'sparsom'
  when 'Senecio rowleyanus'       then 'sparsom'
  when 'Kalanchoe blossfeldiana'  then 'sparsom'
  when 'Beaucarnea recurvata'     then 'sparsom'
  when 'Echeveria'                then 'sparsom'
  -- Moderat: vann grundig når toppen av jorda er tørr.
  when 'Monstera deliciosa'       then 'moderat'
  when 'Epipremnum aureum'        then 'moderat'
  when 'Ficus lyrata'             then 'moderat'
  when 'Ficus elastica'           then 'moderat'
  when 'Ficus benjamina'          then 'moderat'
  when 'Chlorophytum comosum'     then 'moderat'
  when 'Phalaenopsis'             then 'moderat'
  when 'Pelargonium'              then 'moderat'
  when 'Aglaonema'                then 'moderat'
  when 'Dieffenbachia'            then 'moderat'
  when 'Philodendron hederaceum'  then 'moderat'
  when 'Anthurium andraeanum'     then 'moderat'
  when 'Tradescantia zebrina'     then 'moderat'
  when 'Chamaedorea elegans'      then 'moderat'
  when 'Howea forsteriana'        then 'moderat'
  when 'Schefflera arboricola'    then 'moderat'
  when 'Pilea peperomioides'      then 'moderat'
  when 'Aspidistra elatior'       then 'moderat'
  when 'Begonia maculata'         then 'moderat'
  -- Rikelig: hold jorda jevnt fuktig.
  when 'Spathiphyllum wallisii'   then 'rikelig'
  when 'Calathea'                 then 'rikelig'
  when 'Maranta leuconeura'       then 'rikelig'
  when 'Hedera helix'             then 'rikelig'
  when 'Saintpaulia ionantha'     then 'rikelig'
  when 'Asplenium nidus'          then 'rikelig'
  when 'Nephrolepis exaltata'     then 'rikelig'
  when 'Codiaeum variegatum'      then 'rikelig'
  when 'Strelitzia reginae'       then 'rikelig'
  else water_amount
end
where water_amount is null;

-- Arter som er lagt til via AI etter 0013 har en «slik vanner du»-setning, men
-- ingen kategori: utled den fra ordlyden så godt det lar seg gjøre.
update public.species set water_amount = case
  when water_method ilike '%tørke helt%'
    or water_method ilike '%tørke godt%'
    or water_method ilike '%sparsomt%'  then 'sparsom'
  when water_method ilike '%jevnt fuktig%'
    or water_method ilike '%aldri tørke%' then 'rikelig'
  else 'moderat'
end
where water_amount is null and water_method is not null;

-- ---------------------------------------------------------------------------
-- Fyll eksisterende planter fra arten de er koblet til, så «I dag»-skjermen og
-- plantedetaljene viser vanneveiledning uten at noen må redigere hver plante.
-- Setter kun der plantens eget felt er tomt.
-- ---------------------------------------------------------------------------
update public.plants p set
  water_amount = coalesce(p.water_amount, s.water_amount),
  water_method = coalesce(p.water_method, s.water_method)
from public.species s
where p.species_id = s.id
  and (p.water_amount is null or p.water_method is null);

-- Planter uten artskobling, men med egen vannemåte-tekst: samme utledning.
update public.plants set water_amount = case
  when water_method ilike '%tørke helt%'
    or water_method ilike '%tørke godt%'
    or water_method ilike '%sparsomt%'  then 'sparsom'
  when water_method ilike '%jevnt fuktig%'
    or water_method ilike '%aldri tørke%' then 'rikelig'
  else 'moderat'
end
where water_amount is null and water_method is not null;
