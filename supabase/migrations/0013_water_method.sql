-- Planto – kort, tydelig «slik vanner du»-instruks per art/plante.
-- Ett fritekstfelt (én kort setning) som forklarer VANNEMÅTEN: hvor grundig,
-- om jorda skal gjennomfuktes eller bare toppen, om bladene skal holdes tørre
-- osv. Fylles av AI-stellguiden og kan overstyres per plante.
-- Kjør i Supabase SQL Editor etter de tidligere migrasjonene.

alter table public.species add column if not exists water_method text;
alter table public.plants  add column if not exists water_method text;

-- ---------------------------------------------------------------------------
-- Utvid upsert_species med p_water_method (berik-mønster: tomt felt fylles,
-- kanonisk verdi beholdes). Gammel signatur droppes først så vi ikke får en
-- overload.
-- ---------------------------------------------------------------------------
drop function if exists public.upsert_species(text, text, text, int, int, int, boolean, text);

create or replace function public.upsert_species(
  p_latin_name text,
  p_common_name text default null,
  p_light_needs text default null,
  p_water_interval_days int default null,
  p_fertilize_interval_days int default null,
  p_repot_interval_months int default null,
  p_toxic_to_pets boolean default null,
  p_notes text default null,
  p_water_method text default null
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
    fertilize_interval_days, repot_interval_months, toxic_to_pets, notes, water_method
  ) values (
    v_latin, nullif(trim(coalesce(p_common_name, '')), ''), p_light_needs,
    p_water_interval_days, p_fertilize_interval_days, p_repot_interval_months,
    p_toxic_to_pets, p_notes, p_water_method
  )
  on conflict (lower(latin_name)) do update set
    common_name             = coalesce(s.common_name, excluded.common_name),
    light_needs             = coalesce(s.light_needs, excluded.light_needs),
    water_interval_days     = coalesce(s.water_interval_days, excluded.water_interval_days),
    fertilize_interval_days = coalesce(s.fertilize_interval_days, excluded.fertilize_interval_days),
    repot_interval_months   = coalesce(s.repot_interval_months, excluded.repot_interval_months),
    toxic_to_pets           = coalesce(s.toxic_to_pets, excluded.toxic_to_pets),
    notes                   = coalesce(s.notes, excluded.notes),
    water_method            = coalesce(s.water_method, excluded.water_method)
  returning s.id into v_id;

  return v_id;
end;
$$;

revoke all on function public.upsert_species(text, text, text, int, int, int, boolean, text, text) from public;
grant execute on function public.upsert_species(text, text, text, int, int, int, boolean, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Fyll inn korte vannemåte-instrukser for de forhåndsseedede artene, så feltet
-- er nyttig fra start. Setter kun der det mangler (overskriver ikke redigert).
-- ---------------------------------------------------------------------------
update public.species set water_method = case latin_name
  when 'Monstera deliciosa'       then 'Vann til hele jorda er gjennomfuktig; la de øverste 2–3 cm tørke før neste gang.'
  when 'Epipremnum aureum'        then 'Vann godt gjennom; la toppen tørke ut mellom hver gang. Tåler å glemmes.'
  when 'Dracaena trifasciata'     then 'Vann sparsomt; la jorda tørke helt ut mellom hver gang.'
  when 'Zamioculcas zamiifolia'   then 'La jorda tørke helt ut, vann så grundig. Vann lite om vinteren.'
  when 'Ficus lyrata'             then 'Vann til jorda er jevnt fuktig; la toppen tørke litt. Unngå å la den stå i vann.'
  when 'Ficus elastica'           then 'Vann godt gjennom; la de øverste cm tørke mellom hver gang.'
  when 'Ficus benjamina'          then 'Hold jorda lett fuktig; la toppen tørke litt mellom hver gang.'
  when 'Spathiphyllum wallisii'   then 'Hold jorda jevnt fuktig; vann når toppen er tørr (henger med bladene når tørst).'
  when 'Chlorophytum comosum'     then 'Vann godt; la toppen tørke litt mellom hver gang.'
  when 'Dracaena marginata'       then 'Vann til jorda er fuktig; la øverste halvdel tørke før neste gang.'
  when 'Aloe vera'                then 'La jorda tørke helt ut, vann så grundig. Unngå vann i rosetten.'
  when 'Crassula ovata'           then 'La jorda tørke helt ut mellom hver gang; vann grundig, men sjelden.'
  when 'Phalaenopsis'             then 'Dypp potta i vann 10–15 min, la renne godt av. Skal aldri stå i vann.'
  when 'Pelargonium'              then 'Vann når toppen er tørr; vann på jorda, ikke bladene.'
  when 'Calathea'                 then 'Hold jorda jevnt lett fuktig med romtemperert vann; la aldri tørke helt.'
  when 'Maranta leuconeura'       then 'Hold jevnt fuktig med romtemperert vann; unngå at jorda tørker ut.'
  when 'Aglaonema'                then 'Vann når toppen er tørr; la ikke jorda bli helt tørr.'
  when 'Dieffenbachia'            then 'Hold jorda lett fuktig; la toppen tørke litt mellom hver gang.'
  when 'Philodendron hederaceum'  then 'Vann godt; la de øverste cm tørke mellom hver gang.'
  when 'Anthurium andraeanum'     then 'Hold jorda lett fuktig; la toppen tørke litt. Liker ikke å stå i vann.'
  when 'Hedera helix'             then 'Hold jorda jevnt fuktig; la toppen så vidt tørke mellom hver gang.'
  when 'Tradescantia zebrina'     then 'Vann når toppen er tørr; hold lett fuktig i vekst.'
  when 'Chamaedorea elegans'      then 'Hold jorda jevnt lett fuktig; la toppen tørke litt. Ikke la stå i vann.'
  when 'Howea forsteriana'        then 'Vann når toppen er tørr; hold lett fuktig, unngå gjennomvåt jord.'
  when 'Yucca elephantipes'       then 'La jorda tørke godt ut; vann så grundig og sjelden.'
  when 'Schefflera arboricola'    then 'Vann når toppen er tørr; vann grundig gjennom.'
  when 'Peperomia'                then 'La toppen tørke mellom hver gang; vann sparsomt (tykke blader lagrer vann).'
  when 'Pilea peperomioides'      then 'Vann når toppen er tørr; bladene henger litt når den er tørst.'
  when 'Hoya carnosa'             then 'La jorda tørke ut mellom hver gang; vann grundig, tåler tørke.'
  when 'Senecio rowleyanus'       then 'La jorda tørke ut mellom hver gang; vann sparsomt.'
  when 'Saintpaulia ionantha'     then 'Vann nedenfra og unngå vann på bladene; hold lett fuktig.'
  when 'Kalanchoe blossfeldiana'  then 'La jorda tørke ut mellom hver gang; vann på jorda, ikke bladene.'
  when 'Asplenium nidus'          then 'Hold jorda jevnt fuktig; vann på jorda, ikke ned i hjertet.'
  when 'Nephrolepis exaltata'     then 'Hold jorda jevnt fuktig hele tiden; la aldri tørke ut.'
  when 'Aspidistra elatior'       then 'Vann når toppen er tørr; tåler å glemmes, unngå gjennomvått.'
  when 'Codiaeum variegatum'      then 'Hold jorda jevnt lett fuktig; la aldri tørke helt ut.'
  when 'Beaucarnea recurvata'     then 'La jorda tørke helt ut; vann så grundig og sjelden.'
  when 'Strelitzia reginae'       then 'Hold jorda jevnt fuktig i vekst; la toppen tørke litt mellom hver gang.'
  when 'Begonia maculata'         then 'Vann når toppen er tørr; vann på jorda, unngå våte blader.'
  when 'Echeveria'                then 'La jorda tørke helt ut; vann ved jordkanten, ikke i rosetten.'
  else water_method
end
where water_method is null;
