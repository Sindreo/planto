-- Planto – M2+: la en bruker knytte en «løs» diagnose (uten plante) til en
-- plante i ettertid. Trengs for standalone-diagnose-flyten der man først
-- analyserer et bilde, og deretter velger «opprett ny plante» eller
-- «knytt til eksisterende plante».
--
-- Kjør i Supabase SQL Editor etter de tidligere migrasjonene.

drop policy if exists diagnoses_update on public.diagnoses;
create policy diagnoses_update on public.diagnoses
  for update
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (
      plant_id is null
      or plant_id in (select id from public.plants where household_id = public.auth_household_id())
    )
  );
