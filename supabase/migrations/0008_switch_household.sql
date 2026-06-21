-- Planto – bytte husstand + tette sikkerhetshull i profil-oppdatering.

-- 1) Lar en bruker bytte husstand via invitasjonskode. join_household oppdaterte
--    allerede household_id uansett, men ryddet ikke opp. Her fjerner vi brukerens
--    ansvar for den FORRIGE husstandens planter, så man ikke fortsetter å få
--    vanne-varsler for planter man ikke lenger har tilgang til. Plantene selv
--    blir liggende igjen hos den gamle husstanden (delt med ev. andre medlemmer).
create or replace function public.join_household(p_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id  uuid;
  v_old uuid;
begin
  select id into v_id from public.households
  where invite_code = upper(trim(p_invite_code));
  if v_id is null then
    raise exception 'Ugyldig invitasjonskode';
  end if;

  select household_id into v_old from public.profiles where id = auth.uid();

  -- Bytter man til en annen husstand: fjern ansvar for de gamle plantene.
  if v_old is not null and v_old is distinct from v_id then
    delete from public.plant_responsibles pr
    using public.plants p
    where pr.user_id = auth.uid()
      and pr.plant_id = p.id
      and p.household_id = v_old;
  end if;

  update public.profiles set household_id = v_id where id = auth.uid();
  return v_id;
end;
$$;

revoke all on function public.join_household(text) from public;
grant execute on function public.join_household(text) to authenticated;

-- 2) Tett sikkerhetshull: profiles_update-policyen begrenset ikke HVILKE kolonner
--    en bruker kunne endre, så man kunne kjøre en rå
--    `update profiles set household_id = <vilkårlig>` og bli med i en hvilken som
--    helst husstand uten invitasjonskode. Begrens direkte kolonne-oppdatering til
--    display_name. household_id endres da kun via de validerte RPC-ene, som
--    kjører som SECURITY DEFINER og dermed ikke rammes av denne begrensningen.
revoke update on public.profiles from authenticated;
grant update (display_name) on public.profiles to authenticated;
